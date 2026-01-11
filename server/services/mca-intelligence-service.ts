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
  | 'charges_analysis';

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

// Profitable Company Result
export interface ProfitableCompanyResult {
  cin: string;
  companyName: string;
  profitAfterTax: number;
  financialYear: string;
  revenue?: number;
  netWorth?: number;
  state?: string;
  industry?: string;
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
          result = await this.getWalletStatus();
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
   * Get profitable companies (Profitable Company Radar)
   */
  async getProfitableCompanies(params: {
    patMin?: number;
    state?: string;
    industry?: string;
    limit?: number;
  }): Promise<ProfitableCompanyResult[]> {
    const patMin = params.patMin || 10000000; // Default ₹1 Cr
    const limit = Math.min(params.limit || 100, 500);

    let query = db
      .select({
        cin: mcaFinancialSnapshot.cin,
        companyName: mcaCompanyMaster.companyName,
        profitAfterTax: mcaFinancialSnapshot.profitAfterTax,
        financialYear: mcaFinancialSnapshot.financialYear,
        revenue: mcaFinancialSnapshot.revenue,
        netWorth: mcaFinancialSnapshot.netWorth,
        state: mcaCompanyMaster.registeredState,
        industry: mcaCompanyMaster.industry,
      })
      .from(mcaFinancialSnapshot)
      .leftJoin(mcaCompanyMaster, eq(mcaFinancialSnapshot.cin, mcaCompanyMaster.cin))
      .where(
        and(
          gte(mcaFinancialSnapshot.profitAfterTax, patMin.toString()),
          params.state ? eq(mcaCompanyMaster.registeredState, params.state) : undefined,
          params.industry ? like(mcaCompanyMaster.industry, `%${params.industry}%`) : undefined
        )
      )
      .orderBy(desc(mcaFinancialSnapshot.profitAfterTax))
      .limit(limit);

    const results = await query;

    return results.map(r => ({
      cin: r.cin,
      companyName: r.companyName || 'Unknown',
      profitAfterTax: parseFloat(r.profitAfterTax || '0'),
      financialYear: r.financialYear,
      revenue: r.revenue ? parseFloat(r.revenue) : undefined,
      netWorth: r.netWorth ? parseFloat(r.netWorth) : undefined,
      state: r.state || undefined,
      industry: r.industry || undefined,
    }));
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

    const wallet = await this.getWalletStatus();

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
      walletBalance: wallet.currentBalance,
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
   * Get recent wallet payments
   */
  async getRecentWalletPayments(limit: number = 10): Promise<McaWalletPayment[]> {
    return db.select()
      .from(mcaWalletPayments)
      .orderBy(desc(mcaWalletPayments.createdAt))
      .limit(limit);
  }
}

export const mcaIntelligenceService = new McaIntelligenceService();
