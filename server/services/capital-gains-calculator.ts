// @ts-nocheck
import { db } from "../db";
import { portfolioHoldings, capitalGainsTaxReminders, portfolios, mfOrders } from "@shared/schema";
import { eq, and, sql, inArray, gte, lte } from "drizzle-orm";
import type { InsertCapitalGainsTaxReminder } from "@shared/schema";
import { exitLoadService } from "./exit-load-service";
import { getTaxRatesForAsset, type TaxAssetClass } from './tax-regime-config';

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
    priceSource: 'market' | 'estimate';
    holdingPeriodDays: number;
    type: 'STCG' | 'LTCG';
    unrealizedGain: number;
    unrealizedTax: number;
  }[];
}

interface RealizedGainsBreakdown {
  stcgAmount: number;
  ltcgAmount: number;
  stcgTax: number;
  ltcgTax: number;
  totalTaxLiability: number;
  trades: {
    orderId: string;
    schemeName: string;
    isin?: string;
    saleDate: string;
    type: 'STCG' | 'LTCG';
    realizedGain: number;
    taxableGain: number;
    estimatedTax: number;
  }[];
}

interface CombinedGainsBreakdown {
  unrealized: CapitalGainsBreakdown;
  realized: RealizedGainsBreakdown;
  combined: {
    stcgAmount: number;
    ltcgAmount: number;
    stcgTax: number;
    ltcgTax: number;
    totalTaxLiability: number;
  };
  fiscalYear: string;
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
  private readonly QUARTERLY_SCHEDULE = [
    { quarter: 'Q1', dueDate: '06-15', percentage: 0.15 },
    { quarter: 'Q2', dueDate: '09-15', percentage: 0.45 },
    { quarter: 'Q3', dueDate: '12-15', percentage: 0.75 },
    { quarter: 'Q4', dueDate: '03-15', percentage: 1.00 },
  ];

  async getTaxRates(assetClass: TaxAssetClass = 'equity', transactionDate: Date = new Date()): Promise<{ stcgRate: number; ltcgRate: number; thresholdDays: number }> {
    const rates = getTaxRatesForAsset(assetClass, transactionDate);
    return { stcgRate: rates.stcg, ltcgRate: rates.ltcg, thresholdDays: rates.ltcgThresholdDays };
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

      const { stcgRate, ltcgRate, thresholdDays } = await this.getTaxRates();

      let totalSTCG = 0;
      let totalLTCG = 0;
      const holdingsBreakdown = [];

      for (const holding of flattenedHoldings) {
        const quantity = parseFloat(holding.quantity?.toString() || '0');
        const avgPrice = parseFloat(holding.avgPrice?.toString() || '0');
        
        const dbCurrentPrice = holding.currentPrice ? parseFloat(holding.currentPrice.toString()) : null;
        const hasMarketPrice = dbCurrentPrice !== null && dbCurrentPrice > 0;
        const currentPrice = hasMarketPrice ? dbCurrentPrice : avgPrice;
        const priceSource: 'market' | 'estimate' = hasMarketPrice ? 'market' : 'estimate';
        
        const unrealizedGain = hasMarketPrice ? (currentPrice - avgPrice) * quantity : 0;
        
        const purchaseDate = holding.purchaseDate ? new Date(holding.purchaseDate) : (holding.updatedAt ? new Date(holding.updatedAt) : new Date());
        const holdingPeriodDays = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const isSTCG = holdingPeriodDays <= thresholdDays;
        const taxRate = isSTCG ? stcgRate : ltcgRate;
        const unrealizedTax = (hasMarketPrice && unrealizedGain > 0) ? unrealizedGain * taxRate : 0;

        if (hasMarketPrice && unrealizedGain > 0) {
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
          priceSource,
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

  getCurrentFiscalYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 4 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
  }

  getFiscalYearDates(fiscalYear: string): { start: Date; end: Date } {
    const [startYear] = fiscalYear.split('-').map(Number);
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31),
    };
  }

  async calculateRealizedGains(userId: string, fiscalYear?: string): Promise<RealizedGainsBreakdown> {
    try {
      const fy = fiscalYear || this.getCurrentFiscalYear();
      const { start, end } = this.getFiscalYearDates(fy);

      const { stcgRate, ltcgRate } = await this.getTaxRates();

      const settledSellOrders = await db
        .select()
        .from(mfOrders)
        .where(
          and(
            eq(mfOrders.userId, userId),
            inArray(mfOrders.orderType, ['sell', 'redeem', 'switch']),
            eq(mfOrders.status, 'settled'),
            gte(mfOrders.settledAt, start),
            lte(mfOrders.settledAt, end)
          )
        );

      let totalSTCG = 0;
      let totalLTCG = 0;
      const trades: RealizedGainsBreakdown['trades'] = [];

      for (const order of settledSellOrders) {
        const realizedGain = parseFloat(order.realizedGain?.toString() || '0');
        const taxableGain = parseFloat(order.taxableGain?.toString() || '0');
        const estimatedTax = parseFloat(order.estimatedTax?.toString() || '0');
        const gainType = (order.gainType || 'STCG') as 'STCG' | 'LTCG';

        if (gainType === 'STCG') {
          totalSTCG += realizedGain;
        } else {
          totalLTCG += realizedGain;
        }

        trades.push({
          orderId: order.id,
          schemeName: order.schemeName,
          isin: order.isin || undefined,
          saleDate: order.settledAt?.toISOString().split('T')[0] || '',
          type: gainType,
          realizedGain,
          taxableGain,
          estimatedTax,
        });
      }

      const stcgTax = totalSTCG > 0 ? totalSTCG * stcgRate : 0;
      const equityRates = getTaxRatesForAsset('equity');
      const ltcgExemption = Math.min(equityRates.ltcgExemption, Math.max(0, totalLTCG));
      const ltcgTax = Math.max(0, totalLTCG - ltcgExemption) * ltcgRate;

      return {
        stcgAmount: Math.round(totalSTCG * 100) / 100,
        ltcgAmount: Math.round(totalLTCG * 100) / 100,
        stcgTax: Math.round(stcgTax * 100) / 100,
        ltcgTax: Math.round(ltcgTax * 100) / 100,
        totalTaxLiability: Math.round((stcgTax + ltcgTax) * 100) / 100,
        trades,
      };
    } catch (error) {
      console.error('Error calculating realized gains:', error);
      throw new Error('Failed to calculate realized capital gains');
    }
  }

  async getCombinedGains(userId: string, fiscalYear?: string): Promise<CombinedGainsBreakdown> {
    const fy = fiscalYear || this.getCurrentFiscalYear();
    
    const [unrealized, realized] = await Promise.all([
      this.calculatePortfolioGains(userId),
      this.calculateRealizedGains(userId, fy),
    ]);

    return {
      unrealized,
      realized,
      combined: {
        stcgAmount: unrealized.stcgAmount + realized.stcgAmount,
        ltcgAmount: unrealized.ltcgAmount + realized.ltcgAmount,
        stcgTax: unrealized.stcgTax + realized.stcgTax,
        ltcgTax: unrealized.ltcgTax + realized.ltcgTax,
        totalTaxLiability: unrealized.totalTaxLiability + realized.totalTaxLiability,
      },
      fiscalYear: fy,
    };
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

  /**
   * FIX SPEC SECTION 4.4: HARD BLOCKERS - FAIL CLOSED
   * Validate lots before computing capital gains
   */
  validateLotsForTax(lots: Array<{ purchaseDate: string | Date | null; units: number }>): {
    isValid: boolean;
    capitalGainsEnabled: boolean;
    exitLoadEnabled: boolean;
    validationErrors: string[];
    disabledReason: string | null;
  } {
    const errors: string[] = [];
    
    if (!lots || lots.length === 0) {
      return {
        isValid: false,
        capitalGainsEnabled: false,
        exitLoadEnabled: false,
        validationErrors: ['No transaction lots available'],
        disabledReason: 'No transaction-level data from CAS statement. Tax and exit load calculations disabled.'
      };
    }

    let lotsWithMissingDates = 0;
    let lotsWithInvalidDates = 0;
    
    for (const lot of lots) {
      if (!lot.purchaseDate) {
        lotsWithMissingDates++;
        errors.push(`Lot with ${lot.units} units has no purchase date`);
      } else {
        const date = new Date(lot.purchaseDate);
        if (isNaN(date.getTime())) {
          lotsWithInvalidDates++;
          errors.push(`Lot with ${lot.units} units has invalid date: ${lot.purchaseDate}`);
        }
      }
    }

    if (lotsWithMissingDates > 0 || lotsWithInvalidDates > 0) {
      return {
        isValid: false,
        capitalGainsEnabled: false,
        exitLoadEnabled: false,
        validationErrors: errors,
        disabledReason: `${lotsWithMissingDates + lotsWithInvalidDates} lot(s) have missing or invalid dates. Tax calculations require verified transaction dates.`
      };
    }

    return {
      isValid: true,
      capitalGainsEnabled: true,
      exitLoadEnabled: true,
      validationErrors: [],
      disabledReason: null
    };
  }

  /**
   * FIX SPEC SECTION 4.2: Tax Calculation Validation
   * Returns LTCG/STCG units breakdown for lot-wise validation
   * @param lots Array of lots with purchaseDate and units
   * @param saleDate Optional sale/redemption date (defaults to today)
   */
  validateTaxCalculation(
    lots: Array<{ purchaseDate: string; units: number }>,
    saleDate?: string | Date
  ): {
    ltcgUnits: number;
    stcgUnits: number;
    lotsBreakdown: Array<{ date: string; units: number; type: 'LTCG' | 'STCG'; holdingDays: number }>;
    referenceDate: string;
  } {
    // Allow passing a sale date for accurate STCG/LTCG calculation at redemption time
    const referenceDate = saleDate ? new Date(saleDate) : new Date();
    let ltcgUnits = 0;
    let stcgUnits = 0;
    const breakdown: Array<{ date: string; units: number; type: 'LTCG' | 'STCG'; holdingDays: number }> = [];

    for (const lot of lots) {
      const purchaseDate = new Date(lot.purchaseDate);
      const holdingDays = Math.floor((referenceDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const type: 'LTCG' | 'STCG' = holdingDays >= 365 ? 'LTCG' : 'STCG';
      
      if (type === 'LTCG') {
        ltcgUnits += lot.units;
      } else {
        stcgUnits += lot.units;
      }

      breakdown.push({
        date: lot.purchaseDate,
        units: lot.units,
        type,
        holdingDays
      });
    }

    return { 
      ltcgUnits, 
      stcgUnits, 
      lotsBreakdown: breakdown,
      referenceDate: referenceDate.toISOString().split('T')[0]
    };
  }

  /**
   * FIX SPEC SECTION 5.2: FIFO Partial Redemption Simulation
   * Uses centralized ExitLoadService for ISIN-specific exit load lookup.
   */
  async simulateFIFORedemption(
    lots: Array<{ purchaseDate: string; units: number; nav: number; isin?: string; schemeName?: string }>,
    redemptionAmount: number,
    currentNav: number,
    isin?: string,
    category?: string
  ): Promise<{
    unitsToRedeem: number;
    consumedLots: Array<{
      purchaseDate: string;
      units: number;
      taxType: 'LTCG' | 'STCG';
      hasExitLoad: boolean;
      exitLoadAmount: number;
      exitLoadSource: 'database' | 'generic';
    }>;
    totalExitLoad: number;
    ltcgAmount: number;
    stcgAmount: number;
  }> {
    const today = new Date();
    const unitsToRedeem = redemptionAmount / currentNav;
    let remainingUnits = unitsToRedeem;
    
    const consumedLots: Array<{
      purchaseDate: string;
      units: number;
      taxType: 'LTCG' | 'STCG';
      hasExitLoad: boolean;
      exitLoadAmount: number;
      exitLoadSource: 'database' | 'generic';
    }> = [];

    let totalExitLoad = 0;
    let ltcgAmount = 0;
    let stcgAmount = 0;

    const sortedLots = [...lots].sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    for (const lot of sortedLots) {
      if (remainingUnits <= 0) break;

      const unitsFromThisLot = Math.min(remainingUnits, lot.units);
      const purchaseDate = new Date(lot.purchaseDate);
      const holdingDays = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const taxType: 'LTCG' | 'STCG' = holdingDays >= 365 ? 'LTCG' : 'STCG';
      
      const lotValue = unitsFromThisLot * currentNav;
      let exitLoadAmount = 0;
      let hasExitLoad = false;
      let exitLoadSource: 'database' | 'generic' = 'generic';

      const lookupIsin = lot.isin || isin;
      try {
        const exitResult = await exitLoadService.getExitLoad({
          isin: lookupIsin,
          holdingDays,
          redemptionAmount: lotValue,
          category,
          schemeName: lot.schemeName,
        });
        exitLoadAmount = exitResult.exitLoadAmount;
        hasExitLoad = exitLoadAmount > 0;
        exitLoadSource = exitResult.source;
      } catch (error) {
        console.warn(`[CapitalGains FIFO] Exit load lookup failed for lot ${lot.purchaseDate}, using zero:`, error);
      }
      
      const gain = (currentNav - lot.nav) * unitsFromThisLot;
      if (taxType === 'LTCG') {
        ltcgAmount += Math.max(0, gain);
      } else {
        stcgAmount += Math.max(0, gain);
      }

      consumedLots.push({
        purchaseDate: lot.purchaseDate,
        units: unitsFromThisLot,
        taxType,
        hasExitLoad,
        exitLoadAmount,
        exitLoadSource
      });

      totalExitLoad += exitLoadAmount;
      remainingUnits -= unitsFromThisLot;
    }

    return {
      unitsToRedeem,
      consumedLots,
      totalExitLoad,
      ltcgAmount,
      stcgAmount
    };
  }
}

export const capitalGainsCalculator = new CapitalGainsCalculatorService();
