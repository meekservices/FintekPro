import { db } from "../db";
import { portfolioHoldings, capitalGainsTaxReminders, taxRules, portfolios } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { InsertCapitalGainsTaxReminder } from "@shared/schema";

interface CapitalGainsBreakdown {
  stcgAmount: number;
  ltcgAmount: number;
  stcgTax: number;
  ltcgTax: number;
  totalTaxLiability: number;
  holdings: {
    symbol: string;
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    holdingPeriodDays: number;
    type: 'STCG' | 'LTCG';
    unrealizedGain: number;
    unrealizedTax: number;
  }[];
}

interface QuarterlyReminderData {
  quarter: string;
  dueDate: string;
  estimatedSTCG: number;
  estimatedLTCG: number;
  totalTaxLiability: number;
  cumulativePercentage: number;
}

export class CapitalGainsCalculatorService {
  private readonly STCG_TAX_RATE = 0.20; // 20%
  private readonly LTCG_TAX_RATE = 0.125; // 12.5%
  private readonly STCG_THRESHOLD_DAYS = 365; // 1 year for STCG vs LTCG
  
  // Quarterly due dates and percentages
  private readonly QUARTERLY_SCHEDULE = [
    { quarter: 'Q1', dueDate: '06-15', percentage: 0.15 }, // 15% by June 15
    { quarter: 'Q2', dueDate: '09-15', percentage: 0.45 }, // 45% cumulative by Sep 15
    { quarter: 'Q3', dueDate: '12-15', percentage: 0.75 }, // 75% cumulative by Dec 15
    { quarter: 'Q4', dueDate: '03-15', percentage: 1.00 }, // 100% cumulative by Mar 15
  ];

  async getTaxRates(): Promise<{ stcgRate: number; ltcgRate: number }> {
    try {
      const [stcgRule, ltcgRule] = await Promise.all([
        db.select().from(taxRules)
          .where(and(
            eq(taxRules.ruleType, 'capital_gains_tax'),
            eq(taxRules.category, 'STCG'),
            eq(taxRules.isActive, true)
          ))
          .orderBy(sql`${taxRules.effectiveFrom} DESC`)
          .limit(1),
        db.select().from(taxRules)
          .where(and(
            eq(taxRules.ruleType, 'capital_gains_tax'),
            eq(taxRules.category, 'LTCG'),
            eq(taxRules.isActive, true)
          ))
          .orderBy(sql`${taxRules.effectiveFrom} DESC`)
          .limit(1)
      ]);

      const stcgRate = stcgRule.length > 0 ? parseFloat(stcgRule[0].value || '20') / 100 : this.STCG_TAX_RATE;
      const ltcgRate = ltcgRule.length > 0 ? parseFloat(ltcgRule[0].value || '12.5') / 100 : this.LTCG_TAX_RATE;

      return { stcgRate, ltcgRate };
    } catch (error) {
      console.error('Error fetching tax rates from database, using defaults:', error);
      return { stcgRate: this.STCG_TAX_RATE, ltcgRate: this.LTCG_TAX_RATE };
    }
  }

  async calculatePortfolioGains(userId: string): Promise<CapitalGainsBreakdown> {
    try {
      // Get all portfolios for the user
      const userPortfolios = await db.select()
        .from(portfolios)
        .where(eq(portfolios.userId, userId));

      if (userPortfolios.length === 0) {
        return {
          stcgAmount: 0,
          ltcgAmount: 0,
          stcgTax: 0,
          ltcgTax: 0,
          totalTaxLiability: 0,
          holdings: []
        };
      }

      // Get all holdings for user's portfolios
      const allHoldings = await Promise.all(
        userPortfolios.map(portfolio =>
          db.select().from(portfolioHoldings)
            .where(eq(portfolioHoldings.portfolioId, portfolio.id))
        )
      );

      const flattenedHoldings = allHoldings.flat();

      if (flattenedHoldings.length === 0) {
        return {
          stcgAmount: 0,
          ltcgAmount: 0,
          stcgTax: 0,
          ltcgTax: 0,
          totalTaxLiability: 0,
          holdings: []
        };
      }

      // Get current tax rates
      const { stcgRate, ltcgRate } = await this.getTaxRates();

      let totalSTCG = 0;
      let totalLTCG = 0;
      const holdingsBreakdown = [];

      for (const holding of flattenedHoldings) {
        const quantity = parseFloat(holding.quantity?.toString() || '0');
        const avgPrice = parseFloat(holding.avgPrice?.toString() || '0');
        
        // For now, use avgPrice as current price (in production, fetch from market data)
        // This is a simplified calculation assuming unrealized gains
        const currentPrice = avgPrice * 1.1; // Assume 10% gain for calculation
        
        const unrealizedGain = (currentPrice - avgPrice) * quantity;
        
        // Calculate holding period (simplified - using updatedAt as purchase date)
        const purchaseDate = holding.purchaseDate ? new Date(holding.purchaseDate) : (holding.updatedAt ? new Date(holding.updatedAt) : new Date());
        const holdingPeriodDays = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const isSTCG = holdingPeriodDays <= this.STCG_THRESHOLD_DAYS;
        const taxRate = isSTCG ? stcgRate : ltcgRate;
        const unrealizedTax = unrealizedGain > 0 ? unrealizedGain * taxRate : 0;

        if (unrealizedGain > 0) {
          if (isSTCG) {
            totalSTCG += unrealizedGain;
          } else {
            totalLTCG += unrealizedGain;
          }
        }

        holdingsBreakdown.push({
          symbol: holding.symbol,
          quantity,
          avgPrice,
          currentPrice,
          holdingPeriodDays,
          type: isSTCG ? 'STCG' as const : 'LTCG' as const,
          unrealizedGain,
          unrealizedTax
        });
      }

      const stcgTax = totalSTCG * stcgRate;
      const ltcgTax = totalLTCG * ltcgRate;
      const totalTaxLiability = stcgTax + ltcgTax;

      return {
        stcgAmount: Math.round(totalSTCG * 100) / 100,
        ltcgAmount: Math.round(totalLTCG * 100) / 100,
        stcgTax: Math.round(stcgTax * 100) / 100,
        ltcgTax: Math.round(ltcgTax * 100) / 100,
        totalTaxLiability: Math.round(totalTaxLiability * 100) / 100,
        holdings: holdingsBreakdown
      };
    } catch (error) {
      console.error('Error calculating portfolio gains:', error);
      throw new Error('Failed to calculate capital gains');
    }
  }

  async generateQuarterlyReminders(
    userId: string,
    subscriptionId: string,
    financialYear: string
  ): Promise<QuarterlyReminderData[]> {
    try {
      // Calculate total annual tax liability
      const gainsBreakdown = await this.calculatePortfolioGains(userId);
      const annualTaxLiability = gainsBreakdown.totalTaxLiability;

      if (annualTaxLiability <= 0) {
        console.log(`No tax liability for user ${userId}, skipping reminder generation`);
        return [];
      }

      // Parse financial year (e.g., "2024-25")
      const [startYear] = financialYear.split('-');
      const fyStartYear = parseInt(startYear);
      const fyEndYear = fyStartYear + 1;

      const reminders: QuarterlyReminderData[] = [];
      const reminderRecords: InsertCapitalGainsTaxReminder[] = [];

      for (const schedule of this.QUARTERLY_SCHEDULE) {
        // Determine the year for the due date
        const [month, day] = schedule.dueDate.split('-');
        const dueMonth = parseInt(month);
        const dueYear = dueMonth <= 3 ? fyEndYear : fyStartYear;
        const dueDate = `${dueYear}-${month}-${day}`;

        // Calculate cumulative tax liability for this quarter
        const cumulativeTaxLiability = annualTaxLiability * schedule.percentage;

        const reminderData: QuarterlyReminderData = {
          quarter: schedule.quarter,
          dueDate,
          estimatedSTCG: gainsBreakdown.stcgAmount * schedule.percentage,
          estimatedLTCG: gainsBreakdown.ltcgAmount * schedule.percentage,
          totalTaxLiability: cumulativeTaxLiability,
          cumulativePercentage: schedule.percentage * 100
        };

        reminders.push(reminderData);

        // Create database record
        reminderRecords.push({
          userId,
          subscriptionId,
          quarter: schedule.quarter,
          financialYear,
          dueDate,
          estimatedSTCG: Math.round(reminderData.estimatedSTCG * 100).toString(),
          estimatedLTCG: Math.round(reminderData.estimatedLTCG * 100).toString(),
          totalTaxLiability: Math.round(cumulativeTaxLiability * 100).toString(),
          status: 'pending'
        });
      }

      // Insert all reminders in a transaction
      if (reminderRecords.length > 0) {
        await db.insert(capitalGainsTaxReminders).values(reminderRecords);
        console.log(`Created ${reminderRecords.length} quarterly reminders for user ${userId}`);
      }

      return reminders;
    } catch (error) {
      console.error('Error generating quarterly reminders:', error);
      throw new Error('Failed to generate quarterly reminders');
    }
  }

  async getRemindersForUser(userId: string): Promise<any[]> {
    try {
      const reminders = await db.select()
        .from(capitalGainsTaxReminders)
        .where(eq(capitalGainsTaxReminders.userId, userId))
        .orderBy(capitalGainsTaxReminders.dueDate);

      return reminders;
    } catch (error) {
      console.error('Error fetching reminders for user:', error);
      throw new Error('Failed to fetch reminders');
    }
  }

  async updateReminderStatus(reminderId: string, status: string): Promise<void> {
    try {
      await db.update(capitalGainsTaxReminders)
        .set({ 
          status,
          reminderSentAt: status === 'sent' ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(capitalGainsTaxReminders.id, reminderId));
    } catch (error) {
      console.error('Error updating reminder status:', error);
      throw new Error('Failed to update reminder status');
    }
  }
}

export const capitalGainsCalculator = new CapitalGainsCalculatorService();
