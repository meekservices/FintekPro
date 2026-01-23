/**
 * MCA Intelligence Service
 * Internal service for MCA-related queries, filing tracking, and analytics
 * 
 * SEBI/RBI Compliant:
 * - No web scraping or CAPTCHA bypass
 * - Derived data only (no raw MCA file redistribution)
 * - Source attribution stored per record
 * - Comprehensive audit logging
 */

import { db } from '../db';
import { eq, gte, lte, desc, and, sql, like, or } from 'drizzle-orm';
import { 
  mcaCompanyMaster, 
  mcaFinancialSnapshot, 
  mcaFilingTracker, 
  mcaQueryLog,
  mcaWalletStatus,
  mcaWalletPayments,
  type McaCompanyMaster,
  type McaFinancialSnapshot,
  type McaFilingTracker,
  type McaQueryLog,
  type McaWalletStatus,
  type McaWalletPayment,
  type InsertMcaWalletPayment,
} from '@shared/schema';
import { mcaService } from './mca-service';

// MCA Role Types for RBAC
export type McaRole = 'admin' | 'compliance' | 'advisor' | 'ops';

// Query Types for MCA Console
export type McaQueryType = 
  | 'company_lookup'
  | 'financial_availability'
  | 'last_filed_aoc4'
  | 'profit_check'
  | 'filing_status'
  | 'wallet_check'
  | 'profitable_filter'
  | 'director_search'
  | 'charges_analysis'
  | 'sensitive_access'
  | 'audit_export';

// Parsed XBRL Financial Data
export interface XBRLFinancials {
  revenue?: number;
  profitBeforeTax?: number;
  profitAfterTax?: number;
  netWorth?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  shareCapital?: number;
  reserves?: number;
  longTermBorrowing?: number;
  shortTermBorrowing?: number;
}

// Query Response
export interface McaQueryResponse {
  success: boolean;
  queryType: McaQueryType;
  result: any;
  message?: string;
  timestamp: string;
}

// Profitable Company Result with computed ratios
export interface ProfitableCompanyResult {
  cin: string;
  companyName: string;
  profitAfterTax: number;
  financialYear: string;
  revenue?: number;
  netWorth?: number;
  state?: string;
  industry?: string;
  // Computed ratios for Profitable Radar
  ratios?: {
    patMargin?: number;       // PAT / Revenue * 100
    returnOnEquity?: number;  // PAT / Net Worth * 100
    debtToEquity?: number;    // Total Borrowing / Net Worth
  };
}

// Filing Status Result
export interface FilingStatusResult {
  cin: string;
  companyName: string;
  lastAoc4Year?: string;
  lastBalanceSheet?: string;
  isCurrent: boolean;
  daysOverdue?: number;
  status: 'current' | 'delayed' | 'missing';
}

// Wallet Status
export interface WalletInfo {
  currentBalance: number;
  monthlySpend: number;
  totalSpentAllTime: number;
  monthlyBudget: number;
  alertThreshold: number;
  isLowBalance: boolean;
  lastRechargeDate?: string;
}

class McaIntelligenceService {
  private readonly SOURCE_ATTRIBUTION = 'Derived from statutory public filings sourced from MCA.';

  constructor() {
    console.log('✅ MCA Intelligence Service initialized');
  }

  /**
   * Check if user has access based on role
   */
  hasAccess(role: McaRole, action: 'read' | 'query' | 'ingest' | 'full'): boolean {
    const permissions: Record<McaRole, string[]> = {
      admin: ['read', 'query', 'ingest', 'full'],
      compliance: ['read', 'query'],
      advisor: ['read'],
      ops: ['read', 'ingest'],
    };
    return permissions[role]?.includes(action) || permissions[role]?.includes('full') || false;
  }

  /**
   * Log a query for audit trail
   */
  async logQuery(params: {
    userId?: string;
    userName?: string;
    userRole?: string;
    queryType: McaQueryType;
    cin?: string;
    companyName?: string;
    queryParameters?: Record<string, any>;
    actionTaken?: string;
    responseSummary?: string;
    resultCount?: number;
    success: boolean;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await db.insert(mcaQueryLog).values({
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        queryType: params.queryType,
        cin: params.cin,
        companyName: params.companyName,
        queryParameters: params.queryParameters,
        actionTaken: params.actionTaken,
        responseSummary: params.responseSummary,
        resultCount: params.resultCount,
        success: params.success,
        errorMessage: params.errorMessage,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (error) {
      console.error('[MCA Intelligence] Failed to log query:', error);
    }
  }

  /**
   * Get audit logs for export/compliance
   */
  async getAuditLogs(params: {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    queryType?: string;
    limit?: number;
  }): Promise<Array<{
    id: number;
    userId?: string;
    userName?: string;
    userRole?: string;
    queryType: string;
    cin?: string;
    actionTaken?: string;
    responseSummary?: string;
    success: boolean;
    createdAt: string;
  }>> {
    try {
      let query = db.select().from(mcaQueryLog);
      
      const conditions = [];
      if (params.startDate) {
        conditions.push(gte(mcaQueryLog.createdAt, params.startDate));
      }
      if (params.endDate) {
        conditions.push(lte(mcaQueryLog.createdAt, params.endDate));
      }
      if (params.userId) {
        conditions.push(eq(mcaQueryLog.userId, params.userId));
      }
      if (params.queryType) {
        conditions.push(eq(mcaQueryLog.queryType, params.queryType));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }
      
      const logs = await query
        .orderBy(desc(mcaQueryLog.createdAt))
        .limit(params.limit || 1000);
      
      return logs.map(log => ({
        id: log.id,
        userId: log.userId || undefined,
        userName: log.userName || undefined,
        userRole: log.userRole || undefined,
        queryType: log.queryType,
        cin: log.cin || undefined,
        actionTaken: log.actionTaken || undefined,
        responseSummary: log.responseSummary || undefined,
        success: log.success ?? true,
        createdAt: log.createdAt?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[MCA Intelligence] Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Handle MCA query console requests
   */
  async handleQuery(
    queryType: McaQueryType,
    params: Record<string, any>,
    user: { id?: string; name?: string; role: McaRole }
  ): Promise<McaQueryResponse> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (queryType) {
        case 'company_lookup':
          result = await this.lookupCompany(params.cin);
          break;

        case 'financial_availability':
          result = await this.checkFinancialAvailability(params.cin);
          break;

        case 'last_filed_aoc4':
          result = await this.getLastFiledAoc4(params.cin);
          break;

        case 'profit_check':
          result = await this.checkProfitability(params.cin, params.threshold || 10000000);
          break;

        case 'filing_status':
          result = await this.getFilingStatus(params.cin);
          break;

        case 'wallet_check':
          // Now returns API usage stats (direct billing via Sandbox.co.in)
          result = await this.getApiUsageStats();
          break;

        case 'profitable_filter':
          result = await this.getProfitableCompanies(params);
          break;

        case 'director_search':
          result = await this.searchByDirector(params.din || params.directorName);
          break;

        case 'charges_analysis':
          result = await this.analyzeCharges(params.cin);
          break;

        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }

      await this.logQuery({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        queryType,
        cin: params.cin,
        queryParameters: params,
        actionTaken: `Executed ${queryType} query`,
        responseSummary: `Query completed in ${Date.now() - startTime}ms`,
        resultCount: Array.isArray(result) ? result.length : 1,
        success: true,
      });

      return {
        success: true,
        queryType,
        result,
        message: this.SOURCE_ATTRIBUTION,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      await this.logQuery({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        queryType,
        cin: params.cin,
        queryParameters: params,
        success: false,
        errorMessage: error.message,
      });

      return {
        success: false,
        queryType,
        result: null,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Lookup company by CIN
   */
  async lookupCompany(cin: string): Promise<McaCompanyMaster | null> {
    if (!cin || cin.length !== 21) {
      throw new Error('Invalid CIN format. CIN must be 21 characters.');
    }

    const [existing] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    if (existing) {
      return existing;
    }

    const mcaData = await mcaService.getCompanyByCIN(cin);
    if (mcaData) {
      const [inserted] = await db
        .insert(mcaCompanyMaster)
        .values({
          cin: mcaData.cin,
          companyName: mcaData.companyName,
          companyStatus: mcaData.companyStatus,
          incorporationDate: mcaData.dateOfIncorporation || null,
          registeredState: this.extractState(mcaData.registeredAddress),
          registeredAddress: mcaData.registeredAddress,
          companyCategory: mcaData.companyCategory,
          companySubCategory: mcaData.companySubcategory,
          companyClass: mcaData.classOfCompany,
          authorizedCapital: mcaData.authorizedCapital?.toString(),
          paidUpCapital: mcaData.paidUpCapital?.toString(),
          lastFilingYear: this.extractLatestFilingYear(mcaData),
          email: mcaData.emailId,
          sourceAttribution: this.SOURCE_ATTRIBUTION,
        })
        .onConflictDoUpdate({
          target: mcaCompanyMaster.cin,
          set: {
            companyStatus: mcaData.companyStatus,
            updatedAt: new Date(),
          },
        })
        .returning();

      return inserted;
    }

    return null;
  }

  /**
   * Check if financial data is available for a company
   */
  async checkFinancialAvailability(cin: string): Promise<{
    hasFinancials: boolean;
    availableYears: string[];
    latestYear?: string;
    latestPat?: number;
  }> {
    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear));

    return {
      hasFinancials: snapshots.length > 0,
      availableYears: snapshots.map(s => s.financialYear),
      latestYear: snapshots[0]?.financialYear,
      latestPat: snapshots[0]?.profitAfterTax ? parseFloat(snapshots[0].profitAfterTax) : undefined,
    };
  }

  /**
   * Get the last filed AOC-4 year for a company
   */
  async getLastFiledAoc4(cin: string): Promise<{
    cin: string;
    lastFiledYear?: string;
    filingDate?: string;
    status: string;
  }> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    const [latestFiling] = await db
      .select()
      .from(mcaFilingTracker)
      .where(and(
        eq(mcaFilingTracker.cin, cin),
        eq(mcaFilingTracker.filingType, 'AOC-4')
      ))
      .orderBy(desc(mcaFilingTracker.filingYear))
      .limit(1);

    return {
      cin,
      lastFiledYear: company?.lastFilingYear || latestFiling?.filingYear,
      filingDate: latestFiling?.downloadDate?.toISOString(),
      status: company?.lastFilingYear ? 'available' : 'not_found',
    };
  }

  /**
   * Check if company's PAT exceeds threshold
   */
  async checkProfitability(cin: string, thresholdInr: number = 10000000): Promise<{
    cin: string;
    companyName?: string;
    qualifies: boolean;
    latestPat?: number;
    threshold: number;
    financialYear?: string;
  }> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    const [latestSnapshot] = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear))
      .limit(1);

    const pat = latestSnapshot?.profitAfterTax ? parseFloat(latestSnapshot.profitAfterTax) : undefined;

    return {
      cin,
      companyName: company?.companyName,
      qualifies: pat !== undefined && pat >= thresholdInr,
      latestPat: pat,
      threshold: thresholdInr,
      financialYear: latestSnapshot?.financialYear,
    };
  }

  /**
   * Get computed financial ratios for a company
   * Returns derived metrics like PAT Margin, RoE, Debt-to-Equity, Revenue CAGR
   * Used by Unlisted Shares pages and Profitable Company Radar
   */
  async getCompanyFinancialRatios(cin: string): Promise<{
    cin: string;
    companyName?: string;
    hasData: boolean;
    latestYear?: string;
    metrics?: {
      revenue: number | null;
      profitAfterTax: number | null;
      netWorth: number | null;
      totalAssets: number | null;
      totalLiabilities: number | null;
      totalBorrowing: number | null;
    };
    ratios?: {
      patMargin: number | null;       // PAT / Revenue * 100
      returnOnEquity: number | null;  // PAT / Net Worth * 100
      returnOnAssets: number | null;  // PAT / Total Assets * 100
      debtToEquity: number | null;    // Total Borrowing / Net Worth
      assetTurnover: number | null;   // Revenue / Total Assets
    };
    growth?: {
      revenueCAGR: number | null;     // Compound Annual Growth Rate for Revenue
      patCAGR: number | null;         // CAGR for PAT
      revenueYoY: number | null;      // Year-over-Year Revenue Growth
      patYoY: number | null;          // Year-over-Year PAT Growth
      yearsOfData: number;
    };
    source: string;
    attribution: string;
    lastUpdated?: string;
  }> {
    // Get company master info
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    // Get all financial snapshots for CAGR calculation (up to 5 years)
    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear))
      .limit(5);

    if (snapshots.length === 0) {
      return {
        cin,
        companyName: company?.companyName,
        hasData: false,
        source: 'MCA_AOC4_XBRL',
        attribution: this.SOURCE_ATTRIBUTION,
      };
    }

    const latest = snapshots[0];
    
    // Parse financial values from latest snapshot
    const revenue = latest.revenue ? parseFloat(latest.revenue) : null;
    const pat = latest.profitAfterTax ? parseFloat(latest.profitAfterTax) : null;
    const netWorth = latest.netWorth ? parseFloat(latest.netWorth) : null;
    const totalAssets = latest.totalAssets ? parseFloat(latest.totalAssets) : null;
    const totalLiabilities = latest.totalLiabilities ? parseFloat(latest.totalLiabilities) : null;
    const longTermBorrowing = latest.longTermBorrowing ? parseFloat(latest.longTermBorrowing) : 0;
    const shortTermBorrowing = latest.shortTermBorrowing ? parseFloat(latest.shortTermBorrowing) : 0;
    const totalBorrowing = longTermBorrowing + shortTermBorrowing;

    // Calculate ratios
    const patMargin = (revenue && pat && revenue > 0) ? (pat / revenue) * 100 : null;
    const returnOnEquity = (netWorth && pat && netWorth > 0) ? (pat / netWorth) * 100 : null;
    const returnOnAssets = (totalAssets && pat && totalAssets > 0) ? (pat / totalAssets) * 100 : null;
    const debtToEquity = (netWorth && netWorth > 0) ? totalBorrowing / netWorth : null;
    const assetTurnover = (totalAssets && revenue && totalAssets > 0) ? revenue / totalAssets : null;

    // Calculate CAGR and YoY if we have multiple years
    let revenueCAGR: number | null = null;
    let patCAGR: number | null = null;
    let revenueYoY: number | null = null;
    let patYoY: number | null = null;

    if (snapshots.length >= 2) {
      const oldest = snapshots[snapshots.length - 1];
      const previousYear = snapshots[1]; // Second most recent
      const years = snapshots.length - 1;

      // Revenue CAGR
      const oldestRevenue = oldest.revenue ? parseFloat(oldest.revenue) : null;
      if (oldestRevenue && oldestRevenue > 0 && revenue && revenue > 0) {
        revenueCAGR = (Math.pow(revenue / oldestRevenue, 1 / years) - 1) * 100;
      }

      // PAT CAGR (only if both are positive)
      const oldestPat = oldest.profitAfterTax ? parseFloat(oldest.profitAfterTax) : null;
      if (oldestPat && oldestPat > 0 && pat && pat > 0) {
        patCAGR = (Math.pow(pat / oldestPat, 1 / years) - 1) * 100;
      }

      // YoY Growth (year-over-year from previous year)
      const prevRevenue = previousYear.revenue ? parseFloat(previousYear.revenue) : null;
      if (prevRevenue && prevRevenue > 0 && revenue) {
        revenueYoY = ((revenue - prevRevenue) / prevRevenue) * 100;
      }

      const prevPat = previousYear.profitAfterTax ? parseFloat(previousYear.profitAfterTax) : null;
      if (prevPat && prevPat > 0 && pat) {
        patYoY = ((pat - prevPat) / prevPat) * 100;
      }
    }

    return {
      cin,
      companyName: company?.companyName,
      hasData: true,
      latestYear: latest.financialYear,
      metrics: {
        revenue,
        profitAfterTax: pat,
        netWorth,
        totalAssets,
        totalLiabilities,
        totalBorrowing,
      },
      ratios: {
        patMargin: patMargin !== null ? Math.round(patMargin * 100) / 100 : null,
        returnOnEquity: returnOnEquity !== null ? Math.round(returnOnEquity * 100) / 100 : null,
        returnOnAssets: returnOnAssets !== null ? Math.round(returnOnAssets * 100) / 100 : null,
        debtToEquity: debtToEquity !== null ? Math.round(debtToEquity * 100) / 100 : null,
        assetTurnover: assetTurnover !== null ? Math.round(assetTurnover * 100) / 100 : null,
      },
      growth: {
        revenueCAGR: revenueCAGR !== null ? Math.round(revenueCAGR * 100) / 100 : null,
        patCAGR: patCAGR !== null ? Math.round(patCAGR * 100) / 100 : null,
        revenueYoY: revenueYoY !== null ? Math.round(revenueYoY * 100) / 100 : null,
        patYoY: patYoY !== null ? Math.round(patYoY * 100) / 100 : null,
        yearsOfData: snapshots.length,
      },
      source: latest.source || 'MCA_AOC4_XBRL',
      attribution: this.SOURCE_ATTRIBUTION,
      lastUpdated: latest.derivedAt?.toISOString(),
    };
  }

  /**
   * Get financial history with FY-wise data and YoY calculations
   * Used by the Company Profile page for trend visualization
   */
  async getFinancialHistory(cin: string, limit: number = 10): Promise<{
    cin: string;
    companyName?: string;
    hasData: boolean;
    financialYears: Array<{
      financialYear: string;
      revenue: number | null;
      profitAfterTax: number | null;
      netWorth: number | null;
      totalAssets: number | null;
      totalLiabilities: number | null;
      totalBorrowing: number | null;
      ratios: {
        patMargin: number | null;
        returnOnEquity: number | null;
        returnOnAssets: number | null;
        debtToEquity: number | null;
        assetTurnover: number | null;
      };
      yoyGrowth: {
        revenueGrowth: number | null;
        patGrowth: number | null;
        netWorthGrowth: number | null;
      };
    }>;
    source: string;
    attribution: string;
  }> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear))
      .limit(limit);

    if (snapshots.length === 0) {
      return {
        cin,
        companyName: company?.companyName,
        hasData: false,
        financialYears: [],
        source: 'MCA_AOC4_XBRL',
        attribution: this.SOURCE_ATTRIBUTION,
      };
    }

    const financialYears = snapshots.map((snapshot, index) => {
      const revenue = snapshot.revenue ? parseFloat(snapshot.revenue) : null;
      const pat = snapshot.profitAfterTax ? parseFloat(snapshot.profitAfterTax) : null;
      const netWorth = snapshot.netWorth ? parseFloat(snapshot.netWorth) : null;
      const totalAssets = snapshot.totalAssets ? parseFloat(snapshot.totalAssets) : null;
      const totalLiabilities = snapshot.totalLiabilities ? parseFloat(snapshot.totalLiabilities) : null;
      const longTermBorrowing = snapshot.longTermBorrowing ? parseFloat(snapshot.longTermBorrowing) : 0;
      const shortTermBorrowing = snapshot.shortTermBorrowing ? parseFloat(snapshot.shortTermBorrowing) : 0;
      const totalBorrowing = longTermBorrowing + shortTermBorrowing;

      // Calculate ratios
      const patMargin = (revenue && pat && revenue > 0) ? Math.round((pat / revenue) * 10000) / 100 : null;
      const returnOnEquity = (netWorth && pat && netWorth > 0) ? Math.round((pat / netWorth) * 10000) / 100 : null;
      const returnOnAssets = (totalAssets && pat && totalAssets > 0) ? Math.round((pat / totalAssets) * 10000) / 100 : null;
      const debtToEquity = (netWorth && netWorth > 0) ? Math.round((totalBorrowing / netWorth) * 100) / 100 : null;
      const assetTurnover = (totalAssets && revenue && totalAssets > 0) ? Math.round((revenue / totalAssets) * 100) / 100 : null;

      // Calculate YoY growth (compare with next item which is the previous year)
      let revenueGrowth: number | null = null;
      let patGrowth: number | null = null;
      let netWorthGrowth: number | null = null;

      if (index < snapshots.length - 1) {
        const prevSnapshot = snapshots[index + 1];
        const prevRevenue = prevSnapshot.revenue ? parseFloat(prevSnapshot.revenue) : null;
        const prevPat = prevSnapshot.profitAfterTax ? parseFloat(prevSnapshot.profitAfterTax) : null;
        const prevNetWorth = prevSnapshot.netWorth ? parseFloat(prevSnapshot.netWorth) : null;

        if (prevRevenue && prevRevenue > 0 && revenue) {
          revenueGrowth = Math.round(((revenue - prevRevenue) / prevRevenue) * 10000) / 100;
        }
        if (prevPat && prevPat > 0 && pat) {
          patGrowth = Math.round(((pat - prevPat) / prevPat) * 10000) / 100;
        }
        if (prevNetWorth && prevNetWorth > 0 && netWorth) {
          netWorthGrowth = Math.round(((netWorth - prevNetWorth) / prevNetWorth) * 10000) / 100;
        }
      }

      return {
        financialYear: snapshot.financialYear,
        revenue,
        profitAfterTax: pat,
        netWorth,
        totalAssets,
        totalLiabilities,
        totalBorrowing,
        ratios: {
          patMargin,
          returnOnEquity,
          returnOnAssets,
          debtToEquity,
          assetTurnover,
        },
        yoyGrowth: {
          revenueGrowth,
          patGrowth,
          netWorthGrowth,
        },
      };
    });

    return {
      cin,
      companyName: company?.companyName,
      hasData: true,
      financialYears,
      source: 'MCA_AOC4_XBRL',
      attribution: this.SOURCE_ATTRIBUTION,
    };
  }

  /**
   * Calculate Risk Score for a company (0-100, lower = safer)
   * Composite scoring based on profit consistency, leverage, compliance freshness
   */
  async calculateRiskScore(cin: string): Promise<{
    cin: string;
    companyName?: string;
    hasData: boolean;
    overallScore: number; // 0-100, lower = safer
    riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    components: {
      profitConsistency: { score: number; weight: number; details: string };
      leverage: { score: number; weight: number; details: string };
      complianceFreshness: { score: number; weight: number; details: string };
      companyStatus: { score: number; weight: number; details: string };
      operatingMargins: { score: number; weight: number; details: string };
    };
    calculatedAt: string;
  }> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    const snapshots = await db
      .select()
      .from(mcaFinancialSnapshot)
      .where(eq(mcaFinancialSnapshot.cin, cin))
      .orderBy(desc(mcaFinancialSnapshot.financialYear))
      .limit(10);

    if (!company) {
      return {
        cin,
        hasData: false,
        overallScore: 100,
        riskGrade: 'F',
        components: {
          profitConsistency: { score: 100, weight: 0.30, details: 'No data' },
          leverage: { score: 100, weight: 0.30, details: 'No data' },
          complianceFreshness: { score: 100, weight: 0.20, details: 'No data' },
          companyStatus: { score: 100, weight: 0.10, details: 'No data' },
          operatingMargins: { score: 100, weight: 0.10, details: 'No data' },
        },
        calculatedAt: new Date().toISOString(),
      };
    }

    // 1. Profit Consistency Score (30% weight) - lower volatility = lower score
    let profitScore = 50;
    let profitDetails = 'Insufficient data';
    if (snapshots.length >= 2) {
      const patValues = snapshots
        .map(s => parseFloat(s.profitAfterTax || '0'))
        .filter(v => !isNaN(v));
      
      if (patValues.length >= 2) {
        const profitableYears = patValues.filter(v => v > 0).length;
        const profitRatio = profitableYears / patValues.length;
        
        // Calculate volatility (standard deviation / mean)
        const mean = patValues.reduce((a, b) => a + b, 0) / patValues.length;
        const variance = patValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / patValues.length;
        const stdDev = Math.sqrt(variance);
        const volatility = mean !== 0 ? Math.abs(stdDev / mean) : 1;
        
        // Lower volatility = lower risk, more profitable years = lower risk
        profitScore = Math.min(100, Math.max(0, Math.round(
          (1 - profitRatio) * 50 + volatility * 50
        )));
        
        profitDetails = `${profitableYears}/${patValues.length} profitable years, volatility: ${(volatility * 100).toFixed(0)}%`;
      }
    }

    // 2. Leverage Score (30% weight) - higher D/E = higher score
    let leverageScore = 50;
    let leverageDetails = 'No borrowing data';
    if (snapshots.length > 0) {
      const latest = snapshots[0];
      const netWorth = parseFloat(latest.netWorth || '0');
      const longTerm = parseFloat(latest.longTermBorrowing || '0');
      const shortTerm = parseFloat(latest.shortTermBorrowing || '0');
      const totalBorrowing = longTerm + shortTerm;
      
      if (netWorth > 0) {
        const debtToEquity = totalBorrowing / netWorth;
        // D/E <= 0.5 = 0-20, 0.5-1 = 20-40, 1-2 = 40-60, 2-3 = 60-80, >3 = 80-100
        if (debtToEquity <= 0.5) {
          leverageScore = Math.round(debtToEquity * 40);
        } else if (debtToEquity <= 1) {
          leverageScore = Math.round(20 + (debtToEquity - 0.5) * 40);
        } else if (debtToEquity <= 2) {
          leverageScore = Math.round(40 + (debtToEquity - 1) * 20);
        } else if (debtToEquity <= 3) {
          leverageScore = Math.round(60 + (debtToEquity - 2) * 20);
        } else {
          leverageScore = Math.min(100, Math.round(80 + (debtToEquity - 3) * 10));
        }
        leverageDetails = `Debt/Equity: ${debtToEquity.toFixed(2)}`;
      } else if (totalBorrowing > 0) {
        leverageScore = 90;
        leverageDetails = 'Negative net worth with borrowing';
      } else {
        leverageScore = 10;
        leverageDetails = 'No debt';
      }
    }

    // 3. Compliance Freshness Score (20% weight) - older filing = higher score
    let complianceScore = 50;
    let complianceDetails = 'No filing data';
    const currentYear = new Date().getFullYear();
    if (company.lastBalanceSheet || company.lastFilingYear) {
      let yearsAgo = 2;
      if (company.lastBalanceSheet) {
        yearsAgo = currentYear - company.lastBalanceSheet.getFullYear();
      } else if (company.lastFilingYear) {
        const fyMatch = company.lastFilingYear.match(/(\d{4})/);
        if (fyMatch) {
          yearsAgo = currentYear - parseInt(fyMatch[1]) - 1;
        }
      }
      
      // 0-1 years = 0-20, 1-2 = 20-40, 2-3 = 40-60, 3+ = 60-100
      if (yearsAgo <= 1) {
        complianceScore = yearsAgo * 20;
      } else if (yearsAgo <= 2) {
        complianceScore = 20 + (yearsAgo - 1) * 20;
      } else if (yearsAgo <= 3) {
        complianceScore = 40 + (yearsAgo - 2) * 20;
      } else {
        complianceScore = Math.min(100, 60 + (yearsAgo - 3) * 20);
      }
      
      complianceDetails = `Last filing: ${yearsAgo <= 1 ? 'Current' : `${yearsAgo} years ago`}`;
    }

    // 4. Company Status Score (10% weight)
    let statusScore = 50;
    let statusDetails = 'Unknown status';
    const status = (company.companyStatus || '').toLowerCase();
    if (status.includes('active')) {
      statusScore = 0;
      statusDetails = 'Active company';
    } else if (status.includes('dormant')) {
      statusScore = 60;
      statusDetails = 'Dormant company';
    } else if (status.includes('strike') || status.includes('under')) {
      statusScore = 90;
      statusDetails = 'Under strike-off or similar';
    } else if (status) {
      statusScore = 40;
      statusDetails = status;
    }

    // 5. Operating Margins Score (10% weight)
    let marginScore = 50;
    let marginDetails = 'No margin data';
    if (snapshots.length > 0) {
      const latest = snapshots[0];
      const revenue = parseFloat(latest.revenue || '0');
      const pat = parseFloat(latest.profitAfterTax || '0');
      
      if (revenue > 0) {
        const patMargin = (pat / revenue) * 100;
        // >20% = 0-10, 10-20% = 10-30, 5-10% = 30-50, 0-5% = 50-70, <0% = 70-100
        if (patMargin >= 20) {
          marginScore = 0;
        } else if (patMargin >= 10) {
          marginScore = Math.round(10 + (20 - patMargin));
        } else if (patMargin >= 5) {
          marginScore = Math.round(30 + (10 - patMargin) * 4);
        } else if (patMargin >= 0) {
          marginScore = Math.round(50 + (5 - patMargin) * 4);
        } else {
          marginScore = Math.min(100, Math.round(70 + Math.abs(patMargin) * 0.5));
        }
        marginDetails = `PAT Margin: ${patMargin.toFixed(1)}%`;
      }
    }

    // Calculate overall weighted score
    const overallScore = Math.round(
      profitScore * 0.30 +
      leverageScore * 0.30 +
      complianceScore * 0.20 +
      statusScore * 0.10 +
      marginScore * 0.10
    );

    // Determine risk grade
    let riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (overallScore <= 20) riskGrade = 'A';
    else if (overallScore <= 40) riskGrade = 'B';
    else if (overallScore <= 60) riskGrade = 'C';
    else if (overallScore <= 80) riskGrade = 'D';
    else riskGrade = 'F';

    return {
      cin,
      companyName: company.companyName,
      hasData: true,
      overallScore,
      riskGrade,
      components: {
        profitConsistency: { score: profitScore, weight: 0.30, details: profitDetails },
        leverage: { score: leverageScore, weight: 0.30, details: leverageDetails },
        complianceFreshness: { score: complianceScore, weight: 0.20, details: complianceDetails },
        companyStatus: { score: statusScore, weight: 0.10, details: statusDetails },
        operatingMargins: { score: marginScore, weight: 0.10, details: marginDetails },
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get filing status for a company
   */
  async getFilingStatus(cin: string): Promise<FilingStatusResult> {
    const [company] = await db
      .select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);

    if (!company) {
      return {
        cin,
        companyName: undefined,
        isCurrent: false,
        status: 'missing',
      };
    }

    const currentYear = new Date().getFullYear();
    const expectedFilingYear = `${currentYear - 1}-${(currentYear).toString().slice(-2)}`;
    
    const lastFilingYear = company.lastFilingYear;
    const isCurrent = lastFilingYear === expectedFilingYear || 
                      lastFilingYear === `${currentYear - 2}-${(currentYear - 1).toString().slice(-2)}`;

    return {
      cin,
      companyName: company.companyName,
      lastAoc4Year: lastFilingYear || undefined,
      lastBalanceSheet: company.lastBalanceSheet?.toISOString(),
      isCurrent,
      status: lastFilingYear ? (isCurrent ? 'current' : 'delayed') : 'missing',
    };
  }

  /**
   * Get wallet status
   */
  async getWalletStatus(): Promise<WalletInfo> {
    const [wallet] = await db.select().from(mcaWalletStatus).limit(1);

    if (!wallet) {
      return {
        currentBalance: 0,
        monthlySpend: 0,
        totalSpentAllTime: 0,
        monthlyBudget: 50000,
        alertThreshold: 1000,
        isLowBalance: true,
      };
    }

    const balance = parseFloat(wallet.currentBalance || '0');
    const threshold = parseFloat(wallet.alertThreshold || '1000');

    return {
      currentBalance: balance,
      monthlySpend: parseFloat(wallet.totalSpentThisMonth || '0'),
      totalSpentAllTime: parseFloat(wallet.totalSpentAllTime || '0'),
      monthlyBudget: parseFloat(wallet.monthlyBudget || '50000'),
      alertThreshold: threshold,
      isLowBalance: balance < threshold,
      lastRechargeDate: wallet.lastRechargeDate?.toISOString(),
    };
  }

  /**
   * Get API usage statistics for direct pay-per-request mode
   * Billing is handled directly by Sandbox.co.in - this just tracks usage
   */
  async getApiUsageStats(): Promise<{
    totalRequests: number;
    requestsThisMonth: number;
    lastRequestDate?: string;
  }> {
    try {
      // Get total requests from query log
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcaQueryLog);

      // Get requests this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [monthlyResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(mcaQueryLog)
        .where(gte(mcaQueryLog.createdAt, startOfMonth));

      // Get last request date
      const [lastRequest] = await db
        .select({ createdAt: mcaQueryLog.createdAt })
        .from(mcaQueryLog)
        .orderBy(desc(mcaQueryLog.createdAt))
        .limit(1);

      return {
        totalRequests: Number(totalResult?.count) || 0,
        requestsThisMonth: Number(monthlyResult?.count) || 0,
        lastRequestDate: lastRequest?.createdAt?.toISOString(),
      };
    } catch (error) {
      console.error('[MCA Intelligence] Failed to get API usage stats:', error);
      return {
        totalRequests: 0,
        requestsThisMonth: 0,
      };
    }
  }

  /**
   * Get profitable companies (Profitable Company Radar)
   * Enhanced to include computed financial ratios
   */
  async getProfitableCompanies(params: {
    patMin?: number;
    patMax?: number;
    state?: string;
    industry?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'pat' | 'revenue' | 'patMargin' | 'roe';
  }): Promise<ProfitableCompanyResult[]> {
    const patMin = params.patMin || 10000000; // Default ₹1 Cr
    // Strict pagination caps to prevent resource exhaustion
    const MAX_LIMIT = 100;
    const MAX_OFFSET = 10000;
    const limit = Math.min(Math.max(1, params.limit || 50), MAX_LIMIT);
    const offset = Math.min(Math.max(0, params.offset || 0), MAX_OFFSET);

    let query = db
      .select({
        cin: mcaFinancialSnapshot.cin,
        companyName: mcaCompanyMaster.companyName,
        profitAfterTax: mcaFinancialSnapshot.profitAfterTax,
        financialYear: mcaFinancialSnapshot.financialYear,
        revenue: mcaFinancialSnapshot.revenue,
        netWorth: mcaFinancialSnapshot.netWorth,
        longTermBorrowing: mcaFinancialSnapshot.longTermBorrowing,
        shortTermBorrowing: mcaFinancialSnapshot.shortTermBorrowing,
        state: mcaCompanyMaster.registeredState,
        industry: mcaCompanyMaster.industry,
      })
      .from(mcaFinancialSnapshot)
      .leftJoin(mcaCompanyMaster, eq(mcaFinancialSnapshot.cin, mcaCompanyMaster.cin))
      .where(
        and(
          gte(mcaFinancialSnapshot.profitAfterTax, patMin.toString()),
          params.patMax ? lte(mcaFinancialSnapshot.profitAfterTax, params.patMax.toString()) : undefined,
          params.state ? eq(mcaCompanyMaster.registeredState, params.state) : undefined,
          params.industry ? like(mcaCompanyMaster.industry, `%${params.industry}%`) : undefined
        )
      )
      .orderBy(desc(mcaFinancialSnapshot.profitAfterTax))
      .limit(limit)
      .offset(offset);

    const results = await query;

    return results.map(r => {
      const pat = parseFloat(r.profitAfterTax || '0');
      const revenue = r.revenue ? parseFloat(r.revenue) : undefined;
      const netWorth = r.netWorth ? parseFloat(r.netWorth) : undefined;
      const longTermBorrowing = r.longTermBorrowing ? parseFloat(r.longTermBorrowing) : 0;
      const shortTermBorrowing = r.shortTermBorrowing ? parseFloat(r.shortTermBorrowing) : 0;
      const totalBorrowing = longTermBorrowing + shortTermBorrowing;

      // Compute ratios
      const patMargin = (revenue && revenue > 0) ? Math.round((pat / revenue) * 10000) / 100 : undefined;
      const returnOnEquity = (netWorth && netWorth > 0) ? Math.round((pat / netWorth) * 10000) / 100 : undefined;
      const debtToEquity = (netWorth && netWorth > 0) ? Math.round((totalBorrowing / netWorth) * 100) / 100 : undefined;

      return {
        cin: r.cin,
        companyName: r.companyName || 'Unknown',
        profitAfterTax: pat,
        financialYear: r.financialYear,
        revenue,
        netWorth,
        state: r.state || undefined,
        industry: r.industry || undefined,
        ratios: {
          patMargin,
          returnOnEquity,
          debtToEquity,
        },
      };
    });
  }

  /**
   * Search companies by director DIN or name
   */
  async searchByDirector(query: string): Promise<any[]> {
    // This would integrate with the director search in MCA service
    // For now, return companies from our database
    const results = await db
      .select()
      .from(mcaCompanyMaster)
      .where(
        or(
          like(mcaCompanyMaster.companyName, `%${query}%`),
          eq(mcaCompanyMaster.cin, query)
        )
      )
      .limit(20);

    return results;
  }

  /**
   * Analyze charges for a company
   */
  async analyzeCharges(cin: string): Promise<{
    cin: string;
    companyName?: string;
    totalCharges: number;
    openCharges: number;
    closedCharges: number;
    totalAmount: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const company = await this.lookupCompany(cin);
    
    // Get charges from MCA service
    const mcaData = await mcaService.getCompanyByCIN(cin);
    const charges = mcaData?.charges || [];

    const openCharges = charges.filter(c => c.status.toLowerCase() !== 'closed');
    const closedCharges = charges.filter(c => c.status.toLowerCase() === 'closed');
    const totalAmount = charges.reduce((sum, c) => sum + c.chargeAmount, 0);

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (openCharges.length > 5 || totalAmount > 1000000000) {
      riskLevel = 'high';
    } else if (openCharges.length > 2 || totalAmount > 100000000) {
      riskLevel = 'medium';
    }

    return {
      cin,
      companyName: company?.companyName,
      totalCharges: charges.length,
      openCharges: openCharges.length,
      closedCharges: closedCharges.length,
      totalAmount,
      riskLevel,
    };
  }

  /**
   * Ingest XBRL filing and extract financial data
   */
  async ingestXBRLFiling(params: {
    cin: string;
    financialYear: string;
    xbrlContent: string;
    uploadedBy: string;
    uploadedByRole: McaRole;
  }): Promise<{ success: boolean; snapshotId?: string; message: string }> {
    try {
      const financials = this.parseXBRL(params.xbrlContent);
      
      const [snapshot] = await db
        .insert(mcaFinancialSnapshot)
        .values({
          cin: params.cin,
          financialYear: params.financialYear,
          revenue: financials.revenue?.toString(),
          profitBeforeTax: financials.profitBeforeTax?.toString(),
          profitAfterTax: financials.profitAfterTax?.toString(),
          netWorth: financials.netWorth?.toString(),
          totalAssets: financials.totalAssets?.toString(),
          totalLiabilities: financials.totalLiabilities?.toString(),
          shareCapital: financials.shareCapital?.toString(),
          reserves: financials.reserves?.toString(),
          longTermBorrowing: financials.longTermBorrowing?.toString(),
          shortTermBorrowing: financials.shortTermBorrowing?.toString(),
          source: 'MCA_AOC4_XBRL',
          derivedBy: params.uploadedBy,
        })
        .returning();

      await db.insert(mcaFilingTracker).values({
        cin: params.cin,
        filingType: 'XBRL',
        filingYear: params.financialYear,
        downloadedBy: params.uploadedBy,
        downloadedByRole: params.uploadedByRole,
        status: 'SUCCESS',
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
      });

      await this.logQuery({
        userId: params.uploadedBy,
        userRole: params.uploadedByRole,
        queryType: 'company_lookup',
        cin: params.cin,
        actionTaken: `XBRL ingestion for FY ${params.financialYear}`,
        responseSummary: `Extracted financials: PAT=${financials.profitAfterTax}, Revenue=${financials.revenue}`,
        success: true,
      });

      return {
        success: true,
        snapshotId: snapshot.id,
        message: `Successfully ingested XBRL for ${params.cin} (FY ${params.financialYear})`,
      };
    } catch (error: any) {
      await this.logQuery({
        userId: params.uploadedBy,
        userRole: params.uploadedByRole,
        queryType: 'company_lookup',
        cin: params.cin,
        actionTaken: 'XBRL ingestion failed',
        success: false,
        errorMessage: error.message,
      });

      return {
        success: false,
        message: `Failed to ingest XBRL: ${error.message}`,
      };
    }
  }

  /**
   * Parse XBRL content and extract financial metrics
   * Note: This is a simplified parser - real implementation would use proper XBRL library
   */
  private parseXBRL(xbrlContent: string): XBRLFinancials {
    const financials: XBRLFinancials = {};

    const extractValue = (pattern: RegExp): number | undefined => {
      const match = xbrlContent.match(pattern);
      if (match && match[1]) {
        return parseFloat(match[1].replace(/[,\s]/g, ''));
      }
      return undefined;
    };

    financials.profitAfterTax = extractValue(/ProfitLossForPeriod[^>]*>([0-9.,]+)</i) ||
                                 extractValue(/ProfitAfterTax[^>]*>([0-9.,]+)</i);
    
    financials.profitBeforeTax = extractValue(/ProfitBeforeTax[^>]*>([0-9.,]+)</i);
    
    financials.revenue = extractValue(/RevenueFromOperations[^>]*>([0-9.,]+)</i) ||
                         extractValue(/TotalRevenue[^>]*>([0-9.,]+)</i);
    
    financials.netWorth = extractValue(/NetWorth[^>]*>([0-9.,]+)</i) ||
                          extractValue(/ShareholdersEquity[^>]*>([0-9.,]+)</i);
    
    financials.totalAssets = extractValue(/TotalAssets[^>]*>([0-9.,]+)</i);
    
    financials.totalLiabilities = extractValue(/TotalLiabilities[^>]*>([0-9.,]+)</i);
    
    financials.shareCapital = extractValue(/ShareCapital[^>]*>([0-9.,]+)</i) ||
                              extractValue(/PaidUpCapital[^>]*>([0-9.,]+)</i);
    
    financials.reserves = extractValue(/ReservesAndSurplus[^>]*>([0-9.,]+)</i);
    
    financials.longTermBorrowing = extractValue(/LongTermBorrowings[^>]*>([0-9.,]+)</i);
    
    financials.shortTermBorrowing = extractValue(/ShortTermBorrowings[^>]*>([0-9.,]+)</i);

    return financials;
  }

  /**
   * Get filing history for a company
   */
  async getFilingHistory(cin: string): Promise<McaFilingTracker[]> {
    return db
      .select()
      .from(mcaFilingTracker)
      .where(eq(mcaFilingTracker.cin, cin))
      .orderBy(desc(mcaFilingTracker.downloadDate));
  }

  /**
   * Get query history (for audit)
   */
  async getQueryHistory(params: {
    userId?: string;
    queryType?: string;
    cin?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<McaQueryLog[]> {
    let conditions = [];

    if (params.userId) {
      conditions.push(eq(mcaQueryLog.userId, params.userId));
    }
    if (params.queryType) {
      conditions.push(eq(mcaQueryLog.queryType, params.queryType));
    }
    if (params.cin) {
      conditions.push(eq(mcaQueryLog.cin, params.cin));
    }
    if (params.startDate) {
      conditions.push(gte(mcaQueryLog.createdAt, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(mcaQueryLog.createdAt, params.endDate));
    }

    return db
      .select()
      .from(mcaQueryLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(mcaQueryLog.createdAt))
      .limit(params.limit || 100);
  }

  /**
   * Update wallet balance
   */
  async updateWalletBalance(amount: number, type: 'spend' | 'recharge'): Promise<void> {
    const [wallet] = await db.select().from(mcaWalletStatus).limit(1);

    if (!wallet) {
      await db.insert(mcaWalletStatus).values({
        currentBalance: type === 'recharge' ? amount.toString() : '0',
        totalSpentThisMonth: type === 'spend' ? amount.toString() : '0',
        totalSpentAllTime: type === 'spend' ? amount.toString() : '0',
        lastRechargeDate: type === 'recharge' ? new Date() : null,
      });
      return;
    }

    if (type === 'spend') {
      await db
        .update(mcaWalletStatus)
        .set({
          currentBalance: sql`${mcaWalletStatus.currentBalance} - ${amount}`,
          totalSpentThisMonth: sql`${mcaWalletStatus.totalSpentThisMonth} + ${amount}`,
          totalSpentAllTime: sql`${mcaWalletStatus.totalSpentAllTime} + ${amount}`,
          lastUpdated: new Date(),
        })
        .where(eq(mcaWalletStatus.id, wallet.id));
    } else {
      await db
        .update(mcaWalletStatus)
        .set({
          currentBalance: sql`${mcaWalletStatus.currentBalance} + ${amount}`,
          lastRechargeAmount: amount.toString(),
          lastRechargeDate: new Date(),
          lastUpdated: new Date(),
        })
        .where(eq(mcaWalletStatus.id, wallet.id));
    }
  }

  /**
   * Get dashboard stats
   */
  async getDashboardStats(): Promise<{
    totalCompanies: number;
    totalFilings: number;
    totalQueries: number;
    profitableCompanies: number;
    walletBalance: number;
    recentQueries: McaQueryLog[];
  }> {
    const [companyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcaCompanyMaster);

    const [filingCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcaFilingTracker);

    const [queryCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcaQueryLog);

    const [profitableCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcaFinancialSnapshot)
      .where(gte(mcaFinancialSnapshot.profitAfterTax, '10000000'));

    const apiUsage = await this.getApiUsageStats();

    const recentQueries = await db
      .select()
      .from(mcaQueryLog)
      .orderBy(desc(mcaQueryLog.createdAt))
      .limit(10);

    return {
      totalCompanies: companyCount?.count || 0,
      totalFilings: filingCount?.count || 0,
      totalQueries: queryCount?.count || 0,
      profitableCompanies: profitableCount?.count || 0,
      // Direct pay-per-request mode - no wallet balance needed
      // Billing is handled directly by Sandbox.co.in
      apiRequestsThisMonth: apiUsage.requestsThisMonth,
      recentQueries,
    };
  }

  /**
   * Extract state from registered address
   */
  private extractState(address: string): string | null {
    if (!address) return null;
    
    const indianStates = [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
      'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
      'Delhi', 'NCT of Delhi', 'Chandigarh'
    ];

    for (const state of indianStates) {
      if (address.toLowerCase().includes(state.toLowerCase())) {
        return state;
      }
    }

    return null;
  }

  /**
   * Extract latest filing year from MCA data
   */
  private extractLatestFilingYear(mcaData: any): string | null {
    if (mcaData.balanceSheets && mcaData.balanceSheets.length > 0) {
      const latest = mcaData.balanceSheets[0];
      return latest.financialYear || null;
    }
    return null;
  }

  /**
   * Create a new wallet payment record
   */
  async createWalletPayment(payment: {
    orderId: string;
    paymentSessionId?: string;
    amount: number;
    initiatedBy: string;
    initiatedByUserId?: string;
    paymentUrl?: string;
    returnUrl?: string;
  }): Promise<McaWalletPayment> {
    const [created] = await db.insert(mcaWalletPayments).values({
      orderId: payment.orderId,
      paymentSessionId: payment.paymentSessionId,
      amount: payment.amount.toString(),
      status: 'pending',
      initiatedBy: payment.initiatedBy,
      initiatedByUserId: payment.initiatedByUserId,
      paymentUrl: payment.paymentUrl,
      returnUrl: payment.returnUrl,
    }).returning();
    return created;
  }

  /**
   * Get wallet payment by order ID
   */
  async getWalletPaymentByOrderId(orderId: string): Promise<McaWalletPayment | null> {
    const [payment] = await db.select()
      .from(mcaWalletPayments)
      .where(eq(mcaWalletPayments.orderId, orderId))
      .limit(1);
    return payment || null;
  }

  /**
   * Update wallet payment status
   */
  async updateWalletPaymentStatus(orderId: string, update: {
    status: 'pending' | 'success' | 'failed';
    transactionId?: string;
    paymentMethod?: string;
    failureReason?: string;
    creditedAt?: Date;
    zohoExpenseId?: string;
  }): Promise<McaWalletPayment | null> {
    const [updated] = await db.update(mcaWalletPayments)
      .set({
        status: update.status,
        transactionId: update.transactionId,
        paymentMethod: update.paymentMethod,
        failureReason: update.failureReason,
        creditedAt: update.creditedAt,
        zohoExpenseId: update.zohoExpenseId,
        updatedAt: new Date(),
      })
      .where(eq(mcaWalletPayments.orderId, orderId))
      .returning();
    return updated || null;
  }

  /**
   * Atomically mark payment as success (only if currently pending)
   * Returns true if the transition occurred, false if already processed
   * This prevents race conditions in concurrent callback/status requests
   */
  async markPaymentSuccessIfPending(orderId: string, update: {
    transactionId?: string;
    paymentMethod?: string;
  }): Promise<boolean> {
    const result = await db.update(mcaWalletPayments)
      .set({
        status: 'success',
        transactionId: update.transactionId,
        paymentMethod: update.paymentMethod,
        creditedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(mcaWalletPayments.orderId, orderId),
        eq(mcaWalletPayments.status, 'pending')
      ))
      .returning();
    
    // Returns true only if we successfully transitioned from pending to success
    return result.length > 0;
  }

  /**
   * Get recent wallet payments
   */
  async getRecentWalletPayments(limit: number = 10): Promise<McaWalletPayment[]> {
    return db.select()
      .from(mcaWalletPayments)
      .orderBy(desc(mcaWalletPayments.createdAt))
      .limit(limit);
  }

  // ===============================================
  // DIRECT DATA INGEST METHODS
  // For populating MCA data via JSON API
  // ===============================================

  /**
   * Check if a company exists in the master table
   */
  async companyExists(cin: string): Promise<boolean> {
    const [existing] = await db.select({ cin: mcaCompanyMaster.cin })
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, cin))
      .limit(1);
    return !!existing;
  }

  /**
   * Upsert company master data (insert or update on conflict)
   */
  async upsertCompanyMaster(data: {
    cin: string;
    companyName: string;
    companyStatus?: string;
    incorporationDate?: string;
    registeredState?: string;
    registeredCity?: string;
    registeredAddress?: string;
    companyCategory?: string;
    companySubCategory?: string;
    companyClass?: string;
    authorizedCapital?: string;
    paidUpCapital?: string;
    lastFilingYear?: string;
    email?: string;
    industry?: string;
    sourceAttribution?: string;
  }): Promise<McaCompanyMaster> {
    const [existing] = await db.select()
      .from(mcaCompanyMaster)
      .where(eq(mcaCompanyMaster.cin, data.cin))
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db.update(mcaCompanyMaster)
        .set({
          companyName: data.companyName,
          companyStatus: data.companyStatus || existing.companyStatus,
          incorporationDate: data.incorporationDate || existing.incorporationDate,
          registeredState: data.registeredState || existing.registeredState,
          registeredCity: data.registeredCity || existing.registeredCity,
          registeredAddress: data.registeredAddress || existing.registeredAddress,
          companyCategory: data.companyCategory || existing.companyCategory,
          companySubCategory: data.companySubCategory || existing.companySubCategory,
          companyClass: data.companyClass || existing.companyClass,
          authorizedCapital: data.authorizedCapital || existing.authorizedCapital,
          paidUpCapital: data.paidUpCapital || existing.paidUpCapital,
          lastFilingYear: data.lastFilingYear || existing.lastFilingYear,
          email: data.email || existing.email,
          industry: data.industry || existing.industry,
          sourceAttribution: data.sourceAttribution || existing.sourceAttribution,
          updatedAt: new Date(),
        })
        .where(eq(mcaCompanyMaster.cin, data.cin))
        .returning();
      console.log(`[MCA Intelligence] Updated company master: ${data.cin} - ${data.companyName}`);
      return updated;
    } else {
      // Insert new record
      const [created] = await db.insert(mcaCompanyMaster)
        .values({
          cin: data.cin,
          companyName: data.companyName,
          companyStatus: data.companyStatus || 'Active',
          incorporationDate: data.incorporationDate,
          registeredState: data.registeredState,
          registeredCity: data.registeredCity,
          registeredAddress: data.registeredAddress,
          companyCategory: data.companyCategory,
          companySubCategory: data.companySubCategory,
          companyClass: data.companyClass,
          authorizedCapital: data.authorizedCapital,
          paidUpCapital: data.paidUpCapital,
          lastFilingYear: data.lastFilingYear,
          email: data.email,
          industry: data.industry,
          sourceAttribution: data.sourceAttribution || 'DIRECT_INGEST',
        })
        .returning();
      console.log(`[MCA Intelligence] Created company master: ${data.cin} - ${data.companyName}`);
      return created;
    }
  }

  /**
   * Upsert financial snapshot data (insert or update on conflict for same CIN + FY)
   */
  async upsertFinancialSnapshot(data: {
    cin: string;
    financialYear: string;
    revenue?: string;
    profitBeforeTax?: string;
    profitAfterTax?: string;
    netWorth?: string;
    totalAssets?: string;
    totalLiabilities?: string;
    shareCapital?: string;
    reserves?: string;
    longTermBorrowing?: string;
    shortTermBorrowing?: string;
    source?: string;
    derivedBy?: string;
    notes?: string;
  }): Promise<McaFinancialSnapshot> {
    // Check if financial record exists for this CIN + FY combo
    const [existing] = await db.select()
      .from(mcaFinancialSnapshot)
      .where(and(
        eq(mcaFinancialSnapshot.cin, data.cin),
        eq(mcaFinancialSnapshot.financialYear, data.financialYear)
      ))
      .limit(1);

    if (existing) {
      // Update existing record
      const [updated] = await db.update(mcaFinancialSnapshot)
        .set({
          revenue: data.revenue ?? existing.revenue,
          profitBeforeTax: data.profitBeforeTax ?? existing.profitBeforeTax,
          profitAfterTax: data.profitAfterTax ?? existing.profitAfterTax,
          netWorth: data.netWorth ?? existing.netWorth,
          totalAssets: data.totalAssets ?? existing.totalAssets,
          totalLiabilities: data.totalLiabilities ?? existing.totalLiabilities,
          shareCapital: data.shareCapital ?? existing.shareCapital,
          reserves: data.reserves ?? existing.reserves,
          longTermBorrowing: data.longTermBorrowing ?? existing.longTermBorrowing,
          shortTermBorrowing: data.shortTermBorrowing ?? existing.shortTermBorrowing,
          source: data.source || existing.source,
          derivedBy: data.derivedBy || existing.derivedBy,
          notes: data.notes || existing.notes,
          derivedAt: new Date(),
        })
        .where(eq(mcaFinancialSnapshot.id, existing.id))
        .returning();
      console.log(`[MCA Intelligence] Updated financial snapshot: ${data.cin} FY ${data.financialYear}`);
      return updated;
    } else {
      // Insert new record
      const [created] = await db.insert(mcaFinancialSnapshot)
        .values({
          cin: data.cin,
          financialYear: data.financialYear,
          revenue: data.revenue,
          profitBeforeTax: data.profitBeforeTax,
          profitAfterTax: data.profitAfterTax,
          netWorth: data.netWorth,
          totalAssets: data.totalAssets,
          totalLiabilities: data.totalLiabilities,
          shareCapital: data.shareCapital,
          reserves: data.reserves,
          longTermBorrowing: data.longTermBorrowing,
          shortTermBorrowing: data.shortTermBorrowing,
          source: data.source || 'DIRECT_INGEST',
          derivedBy: data.derivedBy,
          notes: data.notes,
        })
        .returning();
      console.log(`[MCA Intelligence] Created financial snapshot: ${data.cin} FY ${data.financialYear}`);
      return created;
    }
  }
}

export const mcaIntelligenceService = new McaIntelligenceService();
