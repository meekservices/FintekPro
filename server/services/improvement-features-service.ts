// @ts-nocheck
import { db } from "../db";
import { 
  dashboardWidgetPreferences, 
  userReferrals, 
  scheduledReports,
  compoundAlerts,
  trendingInvestments,
  themePreferences,
  users,
  listedStocks,
  mutualFunds,
  corporateBonds,
  financialGoals,
  unifiedOrders
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, ilike, or } from "drizzle-orm";
import crypto from "crypto";

interface WidgetConfig {
  id: string;
  enabled: boolean;
  position: number;
  size: 'small' | 'medium' | 'large';
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "portfolio", enabled: true, position: 0, size: "large" },
  { id: "market_movers", enabled: true, position: 1, size: "medium" },
  { id: "quick_actions", enabled: true, position: 2, size: "small" },
  { id: "kyc_progress", enabled: true, position: 3, size: "small" },
  { id: "market_news", enabled: true, position: 4, size: "medium" },
  { id: "trending", enabled: false, position: 5, size: "medium" },
  { id: "goals_progress", enabled: false, position: 6, size: "medium" },
  { id: "alerts", enabled: false, position: 7, size: "small" }
];

class ImprovementFeaturesService {
  
  async getDashboardWidgets(userId: string): Promise<WidgetConfig[]> {
    try {
      const [prefs] = await db.select()
        .from(dashboardWidgetPreferences)
        .where(eq(dashboardWidgetPreferences.userId, userId))
        .limit(1);
      
      if (!prefs) {
        return DEFAULT_WIDGETS;
      }
      
      return (prefs.widgets as WidgetConfig[]) || DEFAULT_WIDGETS;
    } catch (error) {
      console.error("Error getting dashboard widgets:", error);
      return DEFAULT_WIDGETS;
    }
  }

  async updateDashboardWidgets(userId: string, widgets: WidgetConfig[]): Promise<boolean> {
    try {
      const [existing] = await db.select()
        .from(dashboardWidgetPreferences)
        .where(eq(dashboardWidgetPreferences.userId, userId))
        .limit(1);

      if (existing) {
        await db.update(dashboardWidgetPreferences)
          .set({ widgets, updatedAt: new Date() })
          .where(eq(dashboardWidgetPreferences.userId, userId));
      } else {
        await db.insert(dashboardWidgetPreferences).values({
          userId,
          widgets
        });
      }
      return true;
    } catch (error) {
      console.error("Error updating dashboard widgets:", error);
      return false;
    }
  }

  generateReferralCode(userId: string): string {
    const hash = crypto.createHash('md5').update(userId + Date.now()).digest('hex');
    return `FTP${hash.substring(0, 8).toUpperCase()}`;
  }

  async getUserReferralCode(userId: string): Promise<string> {
    try {
      const [existing] = await db.select()
        .from(userReferrals)
        .where(and(
          eq(userReferrals.referrerId, userId),
          sql`${userReferrals.refereeId} IS NULL`
        ))
        .limit(1);

      if (existing) {
        return existing.referralCode;
      }

      const code = this.generateReferralCode(userId);
      await db.insert(userReferrals).values({
        referrerId: userId,
        referralCode: code,
        status: 'pending'
      });

      return code;
    } catch (error) {
      console.error("Error getting referral code:", error);
      return this.generateReferralCode(userId);
    }
  }

  async getReferralStats(userId: string): Promise<{
    totalInvites: number;
    registered: number;
    kycComplete: number;
    invested: number;
    totalEarnings: number;
    pendingEarnings: number;
  }> {
    try {
      const referrals = await db.select()
        .from(userReferrals)
        .where(eq(userReferrals.referrerId, userId));

      const stats = {
        totalInvites: referrals.filter(r => r.inviteSentAt).length,
        registered: referrals.filter(r => r.status !== 'pending').length,
        kycComplete: referrals.filter(r => r.kycCompletedAt).length,
        invested: referrals.filter(r => r.firstInvestmentAt).length,
        totalEarnings: referrals
          .filter(r => r.referrerRewardPaidAt)
          .reduce((sum, r) => sum + parseFloat(r.referrerRewardAmount || '0'), 0),
        pendingEarnings: referrals
          .filter(r => r.referrerRewardAmount && !r.referrerRewardPaidAt)
          .reduce((sum, r) => sum + parseFloat(r.referrerRewardAmount || '0'), 0)
      };

      return stats;
    } catch (error) {
      console.error("Error getting referral stats:", error);
      return { totalInvites: 0, registered: 0, kycComplete: 0, invested: 0, totalEarnings: 0, pendingEarnings: 0 };
    }
  }

  async sendReferralInvite(referrerId: string, email: string, phone?: string): Promise<{ success: boolean; referralCode: string }> {
    try {
      const code = this.generateReferralCode(referrerId);
      
      await db.insert(userReferrals).values({
        referrerId,
        referralCode: code,
        refereeEmail: email,
        refereePhone: phone,
        status: 'pending',
        inviteSentAt: new Date()
      });

      return { success: true, referralCode: code };
    } catch (error) {
      console.error("Error sending referral invite:", error);
      return { success: false, referralCode: '' };
    }
  }

  async getScheduledReports(userId: string): Promise<any[]> {
    try {
      return await db.select()
        .from(scheduledReports)
        .where(eq(scheduledReports.userId, userId))
        .orderBy(desc(scheduledReports.createdAt));
    } catch (error) {
      console.error("Error getting scheduled reports:", error);
      return [];
    }
  }

  async createScheduledReport(userId: string, data: {
    reportType: string;
    reportName: string;
    frequency: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    deliveryEmail: string;
  }): Promise<{ success: boolean; id?: string }> {
    try {
      const nextScheduled = this.calculateNextSchedule(data.frequency, data.dayOfWeek, data.dayOfMonth);
      
      const [result] = await db.insert(scheduledReports).values({
        userId,
        ...data,
        nextScheduledAt: nextScheduled,
        isActive: true
      }).returning({ id: scheduledReports.id });

      return { success: true, id: result.id };
    } catch (error) {
      console.error("Error creating scheduled report:", error);
      return { success: false };
    }
  }

  private calculateNextSchedule(frequency: string, dayOfWeek?: number, dayOfMonth?: number): Date {
    const now = new Date();
    const next = new Date(now);
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(8, 0, 0, 0);
        break;
      case 'weekly':
        const daysUntilTarget = (dayOfWeek || 1) - now.getDay();
        next.setDate(next.getDate() + (daysUntilTarget <= 0 ? daysUntilTarget + 7 : daysUntilTarget));
        next.setHours(8, 0, 0, 0);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(dayOfMonth || 1);
        next.setHours(8, 0, 0, 0);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        next.setDate(1);
        next.setHours(8, 0, 0, 0);
        break;
    }
    
    return next;
  }

  async getCompoundAlerts(userId: string): Promise<any[]> {
    try {
      return await db.select()
        .from(compoundAlerts)
        .where(eq(compoundAlerts.userId, userId))
        .orderBy(desc(compoundAlerts.createdAt));
    } catch (error) {
      console.error("Error getting compound alerts:", error);
      return [];
    }
  }

  async createCompoundAlert(userId: string, data: {
    name: string;
    symbol: string;
    conditions: any[];
    conditionLogic?: string;
    notifyEmail?: boolean;
    notifySms?: boolean;
    notifyPush?: boolean;
  }): Promise<{ success: boolean; id?: string }> {
    try {
      const [result] = await db.insert(compoundAlerts).values({
        userId,
        ...data,
        isActive: true
      }).returning({ id: compoundAlerts.id });

      return { success: true, id: result.id };
    } catch (error) {
      console.error("Error creating compound alert:", error);
      return { success: false };
    }
  }

  async getTrendingInvestments(category?: string): Promise<any[]> {
    try {
      const now = new Date();
      let query = db.select()
        .from(trendingInvestments)
        .where(gte(trendingInvestments.validUntil, now))
        .orderBy(desc(trendingInvestments.trendScore))
        .limit(20);

      return await query;
    } catch (error) {
      console.error("Error getting trending investments:", error);
      throw new Error('Trending investments data service not configured.');
    }
  }

  async getThemePreferences(userId: string): Promise<{
    themeMode: string;
    autoSwitchEnabled: boolean;
    lightModeStart: string;
    darkModeStart: string;
    reducedMotion: boolean;
    highContrast: boolean;
  }> {
    try {
      const [prefs] = await db.select()
        .from(themePreferences)
        .where(eq(themePreferences.userId, userId))
        .limit(1);

      if (!prefs) {
        return {
          themeMode: 'system',
          autoSwitchEnabled: false,
          lightModeStart: '07:00',
          darkModeStart: '19:00',
          reducedMotion: false,
          highContrast: false
        };
      }

      return {
        themeMode: prefs.themeMode || 'system',
        autoSwitchEnabled: prefs.autoSwitchEnabled || false,
        lightModeStart: prefs.lightModeStart || '07:00',
        darkModeStart: prefs.darkModeStart || '19:00',
        reducedMotion: prefs.reducedMotion || false,
        highContrast: prefs.highContrast || false
      };
    } catch (error) {
      console.error("Error getting theme preferences:", error);
      return {
        themeMode: 'system',
        autoSwitchEnabled: false,
        lightModeStart: '07:00',
        darkModeStart: '19:00',
        reducedMotion: false,
        highContrast: false
      };
    }
  }

  async updateThemePreferences(userId: string, prefs: {
    themeMode?: string;
    autoSwitchEnabled?: boolean;
    lightModeStart?: string;
    darkModeStart?: string;
    reducedMotion?: boolean;
    highContrast?: boolean;
  }): Promise<boolean> {
    try {
      const [existing] = await db.select()
        .from(themePreferences)
        .where(eq(themePreferences.userId, userId))
        .limit(1);

      if (existing) {
        await db.update(themePreferences)
          .set({ ...prefs, updatedAt: new Date() })
          .where(eq(themePreferences.userId, userId));
      } else {
        await db.insert(themePreferences).values({
          userId,
          ...prefs
        });
      }
      return true;
    } catch (error) {
      console.error("Error updating theme preferences:", error);
      return false;
    }
  }

  async globalSearch(query: string, userId?: string, category: string = "all"): Promise<{
    stocks: any[];
    mutualFunds: any[];
    bonds: any[];
    goals: any[];
    orders: any[];
  }> {
    const searchPattern = `%${query}%`;
    const shouldSearchStocks = category === "all" || category === "stocks";
    const shouldSearchMutualFunds = category === "all" || category === "mutualFunds";
    const shouldSearchBonds = category === "all" || category === "bonds";
    const shouldSearchGoals = category === "all" || category === "goals";
    const shouldSearchOrders = category === "all" || category === "orders";
    
    try {
      // Search stocks from listedStocks table
      const stocksResults = shouldSearchStocks ? await db
        .select({
          symbol: listedStocks.symbol,
          name: listedStocks.companyName,
          sector: listedStocks.sector,
          marketCap: listedStocks.marketCap
        })
        .from(listedStocks)
        .where(
          or(
            ilike(listedStocks.symbol, searchPattern),
            ilike(listedStocks.companyName, searchPattern),
            ilike(listedStocks.isin, searchPattern)
          )
        )
        .limit(10) : [];

      // Search mutual funds
      const mfResults = shouldSearchMutualFunds ? await db
        .select({
          id: mutualFunds.id,
          name: mutualFunds.schemeName,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse
        })
        .from(mutualFunds)
        .where(
          or(
            ilike(mutualFunds.schemeName, searchPattern),
            ilike(mutualFunds.fundHouse, searchPattern),
            ilike(mutualFunds.schemeCode, searchPattern)
          )
        )
        .limit(10) : [];

      // Search bonds
      const bondResults = shouldSearchBonds ? await db
        .select({
          id: corporateBonds.id,
          name: corporateBonds.bondName,
          issuer: corporateBonds.issuer,
          type: corporateBonds.bondType,
          rating: corporateBonds.creditRating
        })
        .from(corporateBonds)
        .where(
          or(
            ilike(corporateBonds.bondName, searchPattern),
            ilike(corporateBonds.issuer, searchPattern),
            ilike(corporateBonds.isin, searchPattern)
          )
        )
        .limit(10) : [];

      // Search goals (only for authenticated users)
      let goalsResults: any[] = [];
      if (shouldSearchGoals && userId) {
        goalsResults = await db
          .select({
            id: financialGoals.id,
            name: financialGoals.goalName,
            type: financialGoals.goalType,
            targetAmount: financialGoals.targetAmount
          })
          .from(financialGoals)
          .where(
            and(
              eq(financialGoals.userId, userId),
              ilike(financialGoals.goalName, searchPattern)
            )
          )
          .limit(5);
      }

      // Search orders (only for authenticated users)
      let ordersResults: any[] = [];
      if (shouldSearchOrders && userId) {
        ordersResults = await db
          .select({
            id: unifiedOrders.id,
            symbol: unifiedOrders.instrumentSymbol,
            type: unifiedOrders.productType,
            status: unifiedOrders.status
          })
          .from(unifiedOrders)
          .where(
            and(
              eq(unifiedOrders.userId, userId),
              or(
                ilike(unifiedOrders.instrumentSymbol, searchPattern),
                ilike(unifiedOrders.instrumentName, searchPattern)
              )
            )
          )
          .limit(5);
      }

      // Sorting helper functions
      const marketCapOrder: Record<string, number> = {
        'Large Cap': 1,
        'Mid Cap': 2,
        'Small Cap': 3
      };
      
      const creditRatingOrder: Record<string, number> = {
        'AAA': 1, 'AA+': 2, 'AA': 3, 'AA-': 4,
        'A+': 5, 'A': 6, 'A-': 7,
        'BBB+': 8, 'BBB': 9, 'BBB-': 10,
        'BB+': 11, 'BB': 12, 'BB-': 13,
        'B+': 14, 'B': 15, 'B-': 16
      };

      // Sort stocks by market cap (Large Cap first)
      const sortedStocks = stocksResults
        .map(s => ({
          symbol: s.symbol,
          name: s.name,
          type: 'stock',
          sector: s.sector,
          marketCap: s.marketCap
        }))
        .sort((a, b) => {
          const orderA = marketCapOrder[a.marketCap || ''] || 99;
          const orderB = marketCapOrder[b.marketCap || ''] || 99;
          return orderA - orderB;
        });

      // Sort mutual funds by fund house match first, then alphabetically by name
      const queryLower = query.toLowerCase();
      const sortedMutualFunds = mfResults
        .map(m => ({
          id: m.id,
          name: m.name,
          type: 'mutual_fund',
          category: m.category,
          fundHouse: m.fundHouse
        }))
        .sort((a, b) => {
          // Prioritize exact fund house match
          const aFundHouseMatch = (a.fundHouse || '').toLowerCase().includes(queryLower) ? 0 : 1;
          const bFundHouseMatch = (b.fundHouse || '').toLowerCase().includes(queryLower) ? 0 : 1;
          if (aFundHouseMatch !== bFundHouseMatch) return aFundHouseMatch - bFundHouseMatch;
          // Then by category (non-null first)
          if (a.category && !b.category) return -1;
          if (!a.category && b.category) return 1;
          // Then alphabetically by name
          return (a.name || '').localeCompare(b.name || '');
        });

      // Sort bonds by credit rating (AAA first)
      const sortedBonds = bondResults
        .map(b => ({
          id: b.id,
          name: b.name,
          issuer: b.issuer,
          type: 'bond',
          bondType: b.type,
          rating: b.rating
        }))
        .sort((a, b) => {
          const orderA = creditRatingOrder[a.rating || ''] || 99;
          const orderB = creditRatingOrder[b.rating || ''] || 99;
          return orderA - orderB;
        });

      return {
        stocks: sortedStocks,
        mutualFunds: sortedMutualFunds,
        bonds: sortedBonds,
        goals: goalsResults.map(g => ({
          id: g.id,
          name: g.name,
          type: 'goal',
          goalType: g.type,
          targetAmount: g.targetAmount
        })),
        orders: ordersResults.map(o => ({
          id: o.id,
          symbol: o.symbol,
          type: 'order',
          productType: o.type,
          status: o.status
        }))
      };
    } catch (error) {
      console.error("Error in global search:", error);
      return {
        stocks: [],
        mutualFunds: [],
        bonds: [],
        goals: [],
        orders: []
      };
    }
  }
}

export const improvementFeaturesService = new ImprovementFeaturesService();
