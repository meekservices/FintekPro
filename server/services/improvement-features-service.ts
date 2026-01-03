import { db } from "../db";
import { 
  dashboardWidgetPreferences, 
  userReferrals, 
  scheduledReports,
  compoundAlerts,
  trendingInvestments,
  themePreferences,
  users
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
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
      return this.getMockTrendingInvestments();
    }
  }

  private getMockTrendingInvestments() {
    return [
      { id: '1', assetType: 'stock', symbol: 'RELIANCE', name: 'Reliance Industries', trendScore: 95, viewCount: 15420, category: 'most_traded' },
      { id: '2', assetType: 'stock', symbol: 'TCS', name: 'Tata Consultancy Services', trendScore: 92, viewCount: 12340, category: 'top_gainers' },
      { id: '3', assetType: 'mutual_fund', symbol: 'PPFAS', name: 'Parag Parikh Flexi Cap', trendScore: 88, investorCount: 8920, category: 'newly_popular' },
      { id: '4', assetType: 'stock', symbol: 'INFY', name: 'Infosys Ltd', trendScore: 85, viewCount: 9870, category: 'most_traded' },
      { id: '5', assetType: 'stock', symbol: 'HDFCBANK', name: 'HDFC Bank', trendScore: 82, viewCount: 8540, category: 'top_gainers' },
      { id: '6', assetType: 'mutual_fund', symbol: 'AXIS-SG', name: 'Axis Small Cap Fund', trendScore: 80, investorCount: 6780, category: 'newly_popular' }
    ];
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

  async globalSearch(query: string, userId?: string): Promise<{
    stocks: any[];
    mutualFunds: any[];
    bonds: any[];
    goals: any[];
    orders: any[];
  }> {
    const searchTerm = query.toLowerCase();
    
    return {
      stocks: [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', type: 'stock', match: 'name' },
        { symbol: 'RELIANCEC', name: 'Reliance Capital', type: 'stock', match: 'symbol' }
      ].filter(s => s.name.toLowerCase().includes(searchTerm) || s.symbol.toLowerCase().includes(searchTerm)),
      mutualFunds: [
        { id: 'mf1', name: 'Reliance Large Cap Fund', type: 'mutual_fund', match: 'name' }
      ].filter(m => m.name.toLowerCase().includes(searchTerm)),
      bonds: [],
      goals: [],
      orders: []
    };
  }
}

export const improvementFeaturesService = new ImprovementFeaturesService();
