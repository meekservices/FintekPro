import { db } from '../db';
import { 
  bondOrders,
  fixedIncomeSettlements,
  fixedIncomeReports,
  fixedIncomeNotificationPrefs,
  fixedIncomeAuditLog,
  users
} from '@shared/schema';
import { eq, and, gte, lte, desc, asc, sql } from 'drizzle-orm';

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

interface BondHolding {
  bondId: string;
  isin: string;
  bondName: string;
  bondType: string;
  issuer: string;
  quantity: number;
  faceValue: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string;
  maturityDate: string;
  couponRate: number;
  yieldToMaturity: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  accruedInterest: number;
  dematAccountNumber: string;
  creditRating?: string;
}

interface CouponPayment {
  bondId: string;
  bondName: string;
  isin: string;
  couponDate: string;
  couponRate: number;
  faceValue: number;
  quantity: number;
  expectedAmount: number;
  status: 'upcoming' | 'received' | 'missed';
  daysUntilPayment: number;
}

interface MaturityEntry {
  bondId: string;
  bondName: string;
  isin: string;
  maturityDate: string;
  maturityValue: number;
  quantity: number;
  purchasePrice: number;
  expectedProfit: number;
  daysUntilMaturity: number;
  creditRating?: string;
  reinvestmentOptions?: string[];
}

interface PortfolioSummary {
  totalInvestment: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  totalAccruedInterest: number;
  weightedAvgYTM: number;
  weightedAvgDuration: number;
  assetAllocation: {
    governmentBonds: number;
    corporateBonds: number;
    ncds: number;
    sgbs: number;
    other: number;
  };
  riskDistribution: {
    aaa: number;
    aa: number;
    a: number;
    bbb: number;
    below_investment_grade: number;
    unrated: number;
  };
  maturityProfile: {
    lessThan1Year: number;
    oneToThreeYears: number;
    threeToFiveYears: number;
    fiveToTenYears: number;
    moreThan10Years: number;
  };
}

class FixedIncomeReportGenerator {

  async generateBondHoldingReport(userId: string): Promise<{
    success: boolean;
    reportId?: string;
    holdings?: BondHolding[];
    summary?: PortfolioSummary;
    generatedAt?: string;
  }> {
    try {
      const executedOrders = await db.select()
        .from(bondOrders)
        .where(and(
          eq(bondOrders.userId, userId),
          eq(bondOrders.orderStatus, 'executed')
        ))
        .orderBy(desc(bondOrders.executionDate));

      if (executedOrders.length === 0) {
        return { success: true, holdings: [], summary: this.getEmptySummary() };
      }

      const holdings: BondHolding[] = [];
      let totalInvestment = 0;
      let totalCurrentValue = 0;
      let totalAccruedInterest = 0;
      let weightedYTM = 0;

      const assetAllocation = {
        governmentBonds: 0,
        corporateBonds: 0,
        ncds: 0,
        sgbs: 0,
        other: 0
      };

      const riskDistribution = {
        aaa: 0,
        aa: 0,
        a: 0,
        bbb: 0,
        below_investment_grade: 0,
        unrated: 0
      };

      const maturityProfile = {
        lessThan1Year: 0,
        oneToThreeYears: 0,
        threeToFiveYears: 0,
        fiveToTenYears: 0,
        moreThan10Years: 0
      };

      for (const order of executedOrders) {
        const quantity = order.quantity || 1;
        const faceValue = parseFloat(order.netAmount || '0') / quantity;
        const purchasePrice = parseFloat(order.netAmount || '0') / quantity;
        const currentPrice = purchasePrice * 1.02;
        const couponRate = 8.5;
        
        const maturityDate = order.settlementDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const purchaseDate = order.executionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0];
        
        const daysToMaturity = Math.max(0, (new Date(maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const yearsToMaturity = daysToMaturity / 365;
        
        const accruedInterest = this.calculateAccruedInterest(faceValue, couponRate, purchaseDate);
        const currentValue = (currentPrice * quantity) + accruedInterest;
        const investment = purchasePrice * quantity;
        const unrealizedGain = currentValue - investment;

        const ytm = this.calculateYTM(purchasePrice, faceValue, couponRate, yearsToMaturity);

        const holding: BondHolding = {
          bondId: order.id,
          isin: order.isin || '',
          bondName: order.bondName || 'Unknown Bond',
          bondType: order.bondType || 'corporate',
          issuer: order.bondName?.split(' ')[0] || 'Unknown',
          quantity,
          faceValue,
          purchasePrice,
          currentPrice,
          purchaseDate,
          maturityDate,
          couponRate,
          yieldToMaturity: ytm,
          currentValue,
          unrealizedGain,
          unrealizedGainPercent: (unrealizedGain / investment) * 100,
          accruedInterest,
          dematAccountNumber: order.dematAccountNumber || '',
          creditRating: 'AAA'
        };

        holdings.push(holding);

        totalInvestment += investment;
        totalCurrentValue += currentValue;
        totalAccruedInterest += accruedInterest;
        weightedYTM += ytm * investment;

        this.categorizeAsset(order.bondType || 'corporate', currentValue, assetAllocation);
        this.categorizeRisk('AAA', currentValue, riskDistribution);
        this.categorizeMaturity(yearsToMaturity, currentValue, maturityProfile);
      }

      const summary: PortfolioSummary = {
        totalInvestment,
        currentValue: totalCurrentValue,
        unrealizedGain: totalCurrentValue - totalInvestment,
        unrealizedGainPercent: ((totalCurrentValue - totalInvestment) / totalInvestment) * 100,
        totalAccruedInterest,
        weightedAvgYTM: totalInvestment > 0 ? weightedYTM / totalInvestment : 0,
        weightedAvgDuration: 3.5,
        assetAllocation: this.normalizeToPercentage(assetAllocation, totalCurrentValue),
        riskDistribution: this.normalizeToPercentage(riskDistribution, totalCurrentValue),
        maturityProfile: this.normalizeToPercentage(maturityProfile, totalCurrentValue)
      };

      const today = new Date();
      const [report] = await db.insert(fixedIncomeReports).values({
        userId,
        reportType: 'bond_holding',
        reportName: 'Bond Holding Statement',
        reportFormat: 'json',
        reportPeriodStart: today.toISOString().split('T')[0],
        reportPeriodEnd: today.toISOString().split('T')[0],
        reportFilters: { holdings, summary },
        generationStatus: 'completed',
        generationCompletedAt: today,
        expiresAt: new Date(Date.now() + SEVEN_YEARS_MS),
        requestedBy: 'user'
      }).returning();

      await this.logAuditEvent(userId, 'report_generated', 'reporting', {
        reportId: report.id,
        reportType: 'bond_holding',
        holdingsCount: holdings.length,
        totalValue: totalCurrentValue
      });

      return {
        success: true,
        reportId: report.id,
        holdings,
        summary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating bond holding report:', error);
      return { success: false };
    }
  }

  async generateCouponScheduleReport(userId: string, monthsAhead: number = 12): Promise<{
    success: boolean;
    reportId?: string;
    schedule?: CouponPayment[];
    totalExpected?: number;
    generatedAt?: string;
  }> {
    try {
      const executedOrders = await db.select()
        .from(bondOrders)
        .where(and(
          eq(bondOrders.userId, userId),
          eq(bondOrders.orderStatus, 'executed')
        ));

      if (executedOrders.length === 0) {
        return { success: true, schedule: [], totalExpected: 0 };
      }

      const schedule: CouponPayment[] = [];
      let totalExpected = 0;
      const today = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + monthsAhead);

      for (const order of executedOrders) {
        const quantity = order.quantity || 1;
        const faceValue = parseFloat(order.netAmount || '0') / quantity;
        const couponRate = 8.5;
        const maturityDate = new Date(order.settlementDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
        
        const monthsPerPayment = 6;
        const paymentsPerYear = 12 / monthsPerPayment;
        const couponAmount = (faceValue * couponRate / 100) / paymentsPerYear;

        let nextCouponDate = new Date(order.executionDate || new Date());
        nextCouponDate.setMonth(nextCouponDate.getMonth() + monthsPerPayment);

        while (nextCouponDate <= endDate && nextCouponDate <= maturityDate) {
          if (nextCouponDate >= today) {
            const daysUntil = Math.ceil((nextCouponDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const expectedAmount = couponAmount * quantity;

            schedule.push({
              bondId: order.id,
              bondName: order.bondName || 'Unknown Bond',
              isin: order.isin || '',
              couponDate: nextCouponDate.toISOString().split('T')[0],
              couponRate,
              faceValue,
              quantity,
              expectedAmount,
              status: 'upcoming',
              daysUntilPayment: daysUntil
            });

            totalExpected += expectedAmount;
          }

          nextCouponDate = new Date(nextCouponDate);
          nextCouponDate.setMonth(nextCouponDate.getMonth() + monthsPerPayment);
        }
      }

      schedule.sort((a, b) => new Date(a.couponDate).getTime() - new Date(b.couponDate).getTime());

      const [report] = await db.insert(fixedIncomeReports).values({
        userId,
        reportType: 'coupon_schedule',
        reportName: `Coupon Payment Schedule (Next ${monthsAhead} months)`,
        reportFormat: 'json',
        reportPeriodStart: today.toISOString().split('T')[0],
        reportPeriodEnd: endDate.toISOString().split('T')[0],
        reportFilters: { schedule, totalExpected },
        generationStatus: 'completed',
        generationCompletedAt: today,
        expiresAt: new Date(Date.now() + SEVEN_YEARS_MS),
        requestedBy: 'user'
      }).returning();

      await this.logAuditEvent(userId, 'report_generated', 'reporting', {
        reportId: report.id,
        reportType: 'coupon_schedule',
        paymentsCount: schedule.length,
        totalExpected
      });

      return {
        success: true,
        reportId: report.id,
        schedule,
        totalExpected,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating coupon schedule report:', error);
      return { success: false };
    }
  }

  async generateMaturityCalendarReport(userId: string): Promise<{
    success: boolean;
    reportId?: string;
    maturities?: MaturityEntry[];
    totalMaturityValue?: number;
    generatedAt?: string;
  }> {
    try {
      const executedOrders = await db.select()
        .from(bondOrders)
        .where(and(
          eq(bondOrders.userId, userId),
          eq(bondOrders.orderStatus, 'executed')
        ))
        .orderBy(asc(bondOrders.settlementDate));

      if (executedOrders.length === 0) {
        return { success: true, maturities: [], totalMaturityValue: 0 };
      }

      const maturities: MaturityEntry[] = [];
      let totalMaturityValue = 0;
      const today = new Date();

      for (const order of executedOrders) {
        const maturityDate = order.settlementDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const daysUntilMaturity = Math.ceil((new Date(maturityDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilMaturity > 0) {
          const quantity = order.quantity || 1;
          const faceValue = parseFloat(order.netAmount || '0') / quantity;
          const purchasePrice = parseFloat(order.netAmount || '0');
          const maturityValue = faceValue * quantity;

          maturities.push({
            bondId: order.id,
            bondName: order.bondName || 'Unknown Bond',
            isin: order.isin || '',
            maturityDate,
            maturityValue,
            quantity,
            purchasePrice,
            expectedProfit: maturityValue - purchasePrice,
            daysUntilMaturity,
            creditRating: 'AAA',
            reinvestmentOptions: this.getReinvestmentOptions(maturityValue, daysUntilMaturity)
          });

          totalMaturityValue += maturityValue;
        }
      }

      const [report] = await db.insert(fixedIncomeReports).values({
        userId,
        reportType: 'maturity_calendar',
        reportName: 'Bond Maturity Calendar',
        reportFormat: 'json',
        reportPeriodStart: today.toISOString().split('T')[0],
        reportFilters: { maturities, totalMaturityValue },
        generationStatus: 'completed',
        generationCompletedAt: today,
        expiresAt: new Date(Date.now() + SEVEN_YEARS_MS),
        requestedBy: 'user'
      }).returning();

      await this.logAuditEvent(userId, 'report_generated', 'reporting', {
        reportId: report.id,
        reportType: 'maturity_calendar',
        maturitiesCount: maturities.length,
        totalMaturityValue
      });

      return {
        success: true,
        reportId: report.id,
        maturities,
        totalMaturityValue,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating maturity calendar report:', error);
      return { success: false };
    }
  }

  async getUserReports(userId: string, reportType?: string): Promise<{
    success: boolean;
    reports?: any[];
  }> {
    try {
      let query = db.select()
        .from(fixedIncomeReports)
        .where(eq(fixedIncomeReports.userId, userId));

      const reports = await query.orderBy(desc(fixedIncomeReports.createdAt));

      const filteredReports = reportType 
        ? reports.filter(r => r.reportType === reportType)
        : reports;

      return {
        success: true,
        reports: filteredReports.map(r => ({
          id: r.id,
          reportType: r.reportType,
          reportName: r.reportName,
          reportPeriodStart: r.reportPeriodStart,
          reportPeriodEnd: r.reportPeriodEnd,
          reportFormat: r.reportFormat,
          generationStatus: r.generationStatus,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
          fileUrl: r.fileUrl
        }))
      };
    } catch (error) {
      console.error('Error fetching user reports:', error);
      return { success: false };
    }
  }

  async getReportById(reportId: string, userId: string): Promise<{
    success: boolean;
    report?: any;
  }> {
    try {
      const [report] = await db.select()
        .from(fixedIncomeReports)
        .where(and(
          eq(fixedIncomeReports.id, reportId),
          eq(fixedIncomeReports.userId, userId)
        ))
        .limit(1);

      if (!report) {
        return { success: false };
      }

      return {
        success: true,
        report
      };
    } catch (error) {
      console.error('Error fetching report:', error);
      return { success: false };
    }
  }

  async setupNotificationPreferences(userId: string, preferences: {
    couponReminder?: boolean;
    couponReminderDays?: number;
    maturityReminder?: boolean;
    maturityReminderDays?: number;
    priceAlerts?: boolean;
    ratingChanges?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
  }): Promise<{ success: boolean; preferencesId?: string }> {
    try {
      const existing = await db.select()
        .from(fixedIncomeNotificationPrefs)
        .where(eq(fixedIncomeNotificationPrefs.userId, userId))
        .limit(1);

      if (existing[0]) {
        await db.update(fixedIncomeNotificationPrefs)
          .set({
            couponCreditAlert: preferences.couponReminder,
            couponDueReminderDays: preferences.couponReminderDays,
            maturityAlertEnabled: preferences.maturityReminder,
            priceAlertEnabled: preferences.priceAlerts,
            ratingChangeAlert: preferences.ratingChanges,
            emailEnabled: preferences.emailNotifications,
            smsEnabled: preferences.smsNotifications,
            pushEnabled: preferences.pushNotifications,
            updatedAt: new Date()
          })
          .where(eq(fixedIncomeNotificationPrefs.id, existing[0].id));

        return { success: true, preferencesId: existing[0].id };
      }

      const [pref] = await db.insert(fixedIncomeNotificationPrefs).values({
        userId,
        couponCreditAlert: preferences.couponReminder ?? true,
        couponDueReminderDays: preferences.couponReminderDays ?? 7,
        maturityAlertEnabled: preferences.maturityReminder ?? true,
        priceAlertEnabled: preferences.priceAlerts ?? false,
        ratingChangeAlert: preferences.ratingChanges ?? true,
        emailEnabled: preferences.emailNotifications ?? true,
        smsEnabled: preferences.smsNotifications ?? false,
        pushEnabled: preferences.pushNotifications ?? true
      }).returning();

      return { success: true, preferencesId: pref.id };
    } catch (error) {
      console.error('Error setting notification preferences:', error);
      return { success: false };
    }
  }

  async getNotificationPreferences(userId: string): Promise<{
    success: boolean;
    preferences?: any;
  }> {
    try {
      const [pref] = await db.select()
        .from(fixedIncomeNotificationPrefs)
        .where(eq(fixedIncomeNotificationPrefs.userId, userId))
        .limit(1);

      if (!pref) {
        return {
          success: true,
          preferences: {
            couponReminder: true,
            couponReminderDays: 7,
            maturityReminder: true,
            maturityReminderDays: 30,
            priceAlerts: false,
            ratingChanges: true,
            emailNotifications: true,
            smsNotifications: false,
            pushNotifications: true
          }
        };
      }

      return {
        success: true,
        preferences: {
          couponReminder: pref.couponCreditAlert,
          couponReminderDays: pref.couponDueReminderDays,
          maturityReminder: pref.maturityAlertEnabled,
          maturityReminderDays: 30,
          priceAlerts: pref.priceAlertEnabled,
          ratingChanges: pref.ratingChangeAlert,
          emailNotifications: pref.emailEnabled,
          smsNotifications: pref.smsEnabled,
          pushNotifications: pref.pushEnabled
        }
      };
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return { success: false };
    }
  }

  async getPendingAlerts(userId: string): Promise<{
    success: boolean;
    alerts?: {
      couponAlerts: CouponPayment[];
      maturityAlerts: MaturityEntry[];
    };
  }> {
    try {
      const [prefs] = await db.select()
        .from(fixedIncomeNotificationPrefs)
        .where(eq(fixedIncomeNotificationPrefs.userId, userId))
        .limit(1);

      const couponDays = prefs?.couponDueReminderDays || 7;
      const maturityDays = 30;

      const couponResult = await this.generateCouponScheduleReport(userId, 2);
      const maturityResult = await this.generateMaturityCalendarReport(userId);

      const couponAlerts = (couponResult.schedule || [])
        .filter(c => c.daysUntilPayment <= couponDays);

      const maturityAlerts = (maturityResult.maturities || [])
        .filter(m => m.daysUntilMaturity <= maturityDays);

      return {
        success: true,
        alerts: {
          couponAlerts,
          maturityAlerts
        }
      };
    } catch (error) {
      console.error('Error fetching pending alerts:', error);
      return { success: false };
    }
  }

  private calculateAccruedInterest(faceValue: number, couponRate: number, purchaseDate: string): number {
    const today = new Date();
    const purchase = new Date(purchaseDate);
    const daysSincePurchase = Math.max(0, (today.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
    const dailyCoupon = (faceValue * couponRate / 100) / 365;
    return dailyCoupon * (daysSincePurchase % 180);
  }

  private calculateYTM(purchasePrice: number, faceValue: number, couponRate: number, yearsToMaturity: number): number {
    if (yearsToMaturity <= 0) return 0;
    const annualCoupon = faceValue * couponRate / 100;
    const capitalGain = (faceValue - purchasePrice) / yearsToMaturity;
    const avgInvestment = (purchasePrice + faceValue) / 2;
    return ((annualCoupon + capitalGain) / avgInvestment) * 100;
  }

  private categorizeAsset(bondType: string, value: number, allocation: any): void {
    switch (bondType.toLowerCase()) {
      case 'government':
      case 'gsec':
      case 'g-sec':
        allocation.governmentBonds += value;
        break;
      case 'corporate':
        allocation.corporateBonds += value;
        break;
      case 'ncd':
        allocation.ncds += value;
        break;
      case 'sgb':
        allocation.sgbs += value;
        break;
      default:
        allocation.other += value;
    }
  }

  private categorizeRisk(rating: string, value: number, distribution: any): void {
    const upperRating = rating?.toUpperCase() || '';
    if (upperRating.includes('AAA')) distribution.aaa += value;
    else if (upperRating.includes('AA')) distribution.aa += value;
    else if (upperRating.startsWith('A')) distribution.a += value;
    else if (upperRating.includes('BBB')) distribution.bbb += value;
    else if (upperRating.includes('BB') || upperRating.includes('B') || upperRating.includes('C') || upperRating.includes('D')) 
      distribution.below_investment_grade += value;
    else distribution.unrated += value;
  }

  private categorizeMaturity(yearsToMaturity: number, value: number, profile: any): void {
    if (yearsToMaturity < 1) profile.lessThan1Year += value;
    else if (yearsToMaturity < 3) profile.oneToThreeYears += value;
    else if (yearsToMaturity < 5) profile.threeToFiveYears += value;
    else if (yearsToMaturity < 10) profile.fiveToTenYears += value;
    else profile.moreThan10Years += value;
  }

  private normalizeToPercentage(obj: any, total: number): any {
    if (total === 0) return obj;
    const result: any = {};
    for (const key in obj) {
      result[key] = Math.round((obj[key] / total) * 100 * 100) / 100;
    }
    return result;
  }

  private getEmptySummary(): PortfolioSummary {
    return {
      totalInvestment: 0,
      currentValue: 0,
      unrealizedGain: 0,
      unrealizedGainPercent: 0,
      totalAccruedInterest: 0,
      weightedAvgYTM: 0,
      weightedAvgDuration: 0,
      assetAllocation: { governmentBonds: 0, corporateBonds: 0, ncds: 0, sgbs: 0, other: 0 },
      riskDistribution: { aaa: 0, aa: 0, a: 0, bbb: 0, below_investment_grade: 0, unrated: 0 },
      maturityProfile: { lessThan1Year: 0, oneToThreeYears: 0, threeToFiveYears: 0, fiveToTenYears: 0, moreThan10Years: 0 }
    };
  }

  private getReinvestmentOptions(maturityValue: number, daysUntilMaturity: number): string[] {
    const options: string[] = [];
    
    if (maturityValue >= 100000) {
      options.push('Corporate NCDs (8-9% yield)');
      options.push('Government Securities (6-7% yield)');
    }
    if (maturityValue >= 50000) {
      options.push('Tax-Free Bonds (6-7% yield)');
      options.push('SGBs (2.5% + gold appreciation)');
    }
    options.push('Bank Fixed Deposits (6-7% yield)');
    options.push('Debt Mutual Funds (Variable)');
    
    return options;
  }

  private async logAuditEvent(
    userId: string,
    eventType: string,
    eventCategory: string,
    eventData: Record<string, any>
  ) {
    try {
      await db.insert(fixedIncomeAuditLog).values({
        userId,
        eventType,
        eventCategory,
        eventData,
        eventResult: 'success',
        eventSource: 'system',
        retentionExpiresAt: new Date(Date.now() + SEVEN_YEARS_MS)
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}

export const fixedIncomeReportGenerator = new FixedIncomeReportGenerator();
