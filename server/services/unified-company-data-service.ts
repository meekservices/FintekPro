/**
 * Unified Company Data Service
 * Aggregates company data from multiple sources with priority fallback:
 * 
 * Priority Order:
 * 1. FintekPro Own Data (Primary) - Internal database
 * 2. MCA (Fallback) - Official government filings via Sandbox API
 * 
 * This service provides a single interface for fetching company data,
 * automatically falling back to MCA if internal data is unavailable.
 */

import { storage } from '../storage';
import { mcaService, type MCACompanyMasterData } from './mca-service';
import { credhiveService } from './credhive-service';
import type { 
  CompanyFinancials, 
  CompanyRatios, 
  UnlistedCompany,
  InsertCompanyFinancials,
  InsertCompanyRatios 
} from '@shared/schema';

export type DataSource = 'fintekpro' | 'mca' | 'moneycontrol' | 'credhive';

interface CredhiveDirectorData {
  directors?: Array<{ name: string; din?: string; designation?: string }>;
}

export interface SourcedData<T> {
  data: T;
  source: DataSource;
  fetchedAt: Date;
  confidence: 'high' | 'medium' | 'low';
}

export interface FinancialData {
  financialYear: string;
  revenue?: number;
  pat?: number;
  networth?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalDebt?: number;
  ebitda?: number;
  operatingProfit?: number;
  shareCapital?: number;
  reserves?: number;
}

export interface RatiosData {
  financialYear: string;
  peRatio?: number;
  pbRatio?: number;
  roe?: number;
  roce?: number;
  debtEquity?: number;
  currentRatio?: number;
  marginEbitda?: number;
  marginPat?: number;
  marginOperating?: number;
}

export interface UnifiedCompanyData {
  basic: {
    name: string;
    cin?: string;
    isin?: string;
    sector?: string;
    industry?: string;
    status: string;
    source: DataSource;
  };
  financials: {
    years: SourcedData<FinancialData>[];
    source: DataSource;
    available: boolean;
  };
  ratios: {
    years: SourcedData<RatiosData>[];
    source: DataSource;
    available: boolean;
  };
  capital: {
    authorizedCapital?: number;
    paidUpCapital?: number;
    faceValue?: number;
    totalShares?: number;
    source: DataSource;
  };
  directors: {
    list: { name: string; din: string; designation: string }[];
    source: DataSource;
  };
  charges: {
    totalActive: number;
    totalAmount: number;
    hasActiveCharges: boolean;
    source: DataSource;
  };
  dataQuality: {
    overallScore: number; // 0-100
    sourcesUsed: DataSource[];
    missingData: string[];
    lastUpdated: Date;
    fallbackUsed: boolean;
    fallbackReason?: string;
    warnings: string[];
    primarySourceFailed: boolean;
  };
}

export interface DataFetchResult {
  success: boolean;
  source: DataSource;
  data?: any;
  error?: string;
}

/**
 * Telemetry event for data source selection monitoring
 */
export interface DataSourceTelemetry {
  requestId: string;
  companyIdOrCin: string;
  timestamp: Date;
  duration: number;
  sourcesAttempted: DataSource[];
  sourcesSucceeded: DataSource[];
  sourcesFailed: { source: DataSource; error: string }[];
  primarySource: DataSource | null;
  financialsSource: DataSource | null;
  ratiosSource: DataSource | null;
  fallbackTriggered: boolean;
  fallbackReason?: string;
  fintekproHasUsableData: boolean;
  dataQualityScore: number;
  warnings: string[];
}

class UnifiedCompanyDataService {
  private telemetryLogs: DataSourceTelemetry[] = [];

  /**
   * Get recent telemetry logs for monitoring
   */
  getTelemetryLogs(limit: number = 100): DataSourceTelemetry[] {
    return this.telemetryLogs.slice(-limit);
  }

  /**
   * Log telemetry event for production monitoring
   */
  private logTelemetry(telemetry: DataSourceTelemetry): void {
    this.telemetryLogs.push(telemetry);
    
    if (this.telemetryLogs.length > 1000) {
      this.telemetryLogs = this.telemetryLogs.slice(-500);
    }

    const logLevel = telemetry.fallbackTriggered ? '⚠️' : '✅';
    const sourcesInfo = `Primary: ${telemetry.primarySource || 'none'} | Financials: ${telemetry.financialsSource || 'none'} | Ratios: ${telemetry.ratiosSource || 'none'}`;
    
    console.log(`${logLevel} [DataSource Telemetry] ${telemetry.companyIdOrCin} | ${sourcesInfo} | Quality: ${telemetry.dataQualityScore}% | Duration: ${telemetry.duration}ms`);
    
    if (telemetry.fallbackTriggered) {
      console.log(`📊 [Fallback Analysis] Reason: ${telemetry.fallbackReason} | Attempted: [${telemetry.sourcesAttempted.join(', ')}] | Succeeded: [${telemetry.sourcesSucceeded.join(', ')}]`);
    }
    
    if (telemetry.sourcesFailed.length > 0) {
      telemetry.sourcesFailed.forEach(f => {
        console.log(`❌ [Source Failed] ${f.source}: ${f.error}`);
      });
    }

    if (telemetry.warnings.length > 0) {
      telemetry.warnings.forEach(w => {
        console.log(`⚠️ [DataSource Warning] ${w}`);
      });
    }
  }

  /**
   * Fetch complete company data with automatic fallback
   * Priority: FintekPro → MCA
   */
  async getCompanyData(
    companyIdOrCin: string,
    options: {
      forceRefresh?: boolean;
      includeMCA?: boolean;
    } = {}
  ): Promise<UnifiedCompanyData | null> {
    const { forceRefresh = false, includeMCA = true } = options;
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const warnings: string[] = [];
    const sourcesFailed: { source: DataSource; error: string }[] = [];
    
    console.log(`[UnifiedData] Fetching data for: ${companyIdOrCin} (Request: ${requestId})`);
    
    // First, check if this is a company ID or CIN
    let company = await storage.getUnlistedCompanyById(companyIdOrCin);
    let cin = company?.cin || (companyIdOrCin.length === 21 ? companyIdOrCin : undefined);
    
    const results: DataFetchResult[] = [];
    let mcaData: MCACompanyMasterData | null = null;
    let probe42Details: CredhiveDirectorData | null = null;
    let ownFinancials: CompanyFinancials[] = [];
    let ownRatios: CompanyRatios[] = [];

    // Step 1: Get FintekPro's own data (PRIMARY SOURCE)
    if (company) {
      ownFinancials = await storage.getCompanyFinancials(company.id);
      ownRatios = await storage.getCompanyRatios(company.id);
      
      if (ownFinancials.length > 0 || ownRatios.length > 0) {
        results.push({
          success: true,
          source: 'fintekpro',
          data: { financials: ownFinancials, ratios: ownRatios },
        });
      }
    }

    // Determine if FintekPro has usable data
    const fintekproHasUsableData = ownFinancials.length > 0 || ownRatios.length > 0;

    // Step 2: Try MCA as fallback when FintekPro data is insufficient
    if (includeMCA && cin && !fintekproHasUsableData) {
      try {
        if (mcaService.isConfigured()) {
          mcaData = await mcaService.getCompanyByCIN(cin);
          
          if (mcaData) {
            results.push({
              success: true,
              source: 'mca',
              data: mcaData,
            });
          } else {
            results.push({
              success: false,
              source: 'mca',
              error: 'No data found in MCA',
            });
          }
        } else {
          results.push({
            success: false,
            source: 'mca',
            error: 'MCA service not configured (missing SANDBOX_API_KEY/SANDBOX_API_SECRET)',
          });
        }
      } catch (error: any) {
        results.push({
          success: false,
          source: 'mca',
          error: error.message,
        });
      }
    }

    // Step 3: Try Credhive for additional data (especially directors)
    if (company?.cin && credhiveService.isAvailable()) {
      try {
        const dirResp = await credhiveService.getDirectors(company.cin);
        if (dirResp.success && dirResp.data && dirResp.data.length > 0) {
          probe42Details = {
            directors: dirResp.data
              .filter(d => d.is_active)
              .map(d => ({ name: d.name, din: d.din, designation: d.designation }))
          };
          results.push({ success: true, source: 'credhive', data: probe42Details });
          console.log(`[UnifiedData] Got Credhive directors: ${probe42Details.directors?.length || 0}`);
        }
      } catch (error: any) {
        console.log(`[UnifiedData] Credhive fetch failed: ${error.message}`);
        results.push({ success: false, source: 'credhive', error: error.message });
      }
    }

    // Build telemetry data
    const sourcesAttempted: DataSource[] = [];
    const sourcesSucceeded: DataSource[] = [];
    
    if (company) sourcesAttempted.push('fintekpro');
    if (includeMCA && cin && !fintekproHasUsableData) sourcesAttempted.push('mca');
    if (company?.cin && credhiveService.isAvailable()) sourcesAttempted.push('credhive');

    results.forEach(r => {
      if (r.success) {
        sourcesSucceeded.push(r.source);
      } else {
        sourcesFailed.push({ source: r.source, error: r.error || 'Unknown error' });
      }
    });

    const fallbackTriggered = !fintekproHasUsableData && sourcesAttempted.includes('mca');
    let fallbackReason: string | undefined;
    
    if (fallbackTriggered) {
      fallbackReason = 'No financial data in FintekPro database - using MCA fallback';
      if (company) {
        warnings.push('Primary data source (FintekPro) has no financial records - using MCA data');
      }
    }

    if (!sourcesSucceeded.length && !company) {
      warnings.push('All data sources failed - no data available');
    }

    // Determine primary source failure
    const primarySourceFailed = !fintekproHasUsableData;

    // Aggregate data from all sources with fallback info
    const aggregatedData = this.aggregateData(
      company || undefined, 
      mcaData, 
      probe42Details,
      ownFinancials, 
      ownRatios, 
      results,
      {
        fallbackUsed: fallbackTriggered,
        fallbackReason,
        warnings,
        primarySourceFailed,
      }
    );

    // Determine sources used for telemetry
    const financialsSource = this.determineFinancialsSource(ownFinancials, mcaData);
    const ratiosSource = this.determineRatiosSource(ownRatios);

    // Log telemetry
    this.logTelemetry({
      requestId,
      companyIdOrCin,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      sourcesAttempted,
      sourcesSucceeded,
      sourcesFailed,
      primarySource: sourcesSucceeded[0] || null,
      financialsSource,
      ratiosSource,
      fallbackTriggered,
      fallbackReason,
      fintekproHasUsableData: !!fintekproHasUsableData,
      dataQualityScore: aggregatedData?.dataQuality.overallScore || 0,
      warnings,
    });

    return aggregatedData;
  }

  /**
   * Aggregate data from multiple sources with priority
   */
  private aggregateData(
    company: UnlistedCompany | undefined,
    mcaData: MCACompanyMasterData | null,
    probe42Details: CredhiveDirectorData | null,
    ownFinancials: CompanyFinancials[],
    ownRatios: CompanyRatios[],
    fetchResults: DataFetchResult[],
    fallbackInfo?: {
      fallbackUsed: boolean;
      fallbackReason?: string;
      warnings: string[];
      primarySourceFailed: boolean;
    }
  ): UnifiedCompanyData | null {
    
    const sourcesUsed: DataSource[] = fetchResults
      .filter(r => r.success)
      .map(r => r.source);
    
    if (sourcesUsed.length === 0 && !company) {
      return null;
    }

    // Determine best source for each data type
    const financialsSource = this.determineFinancialsSource(ownFinancials, mcaData);
    const ratiosSource = this.determineRatiosSource(ownRatios);
    const basicSource = this.determineBasicSource(company, mcaData);

    // Build financials data
    const financialsYears: SourcedData<FinancialData>[] = [];
    
    if (financialsSource === 'fintekpro' && ownFinancials.length > 0) {
      ownFinancials.forEach(f => {
        financialsYears.push({
          data: this.convertOwnFinancials(f),
          source: 'fintekpro',
          fetchedAt: new Date(f.updatedAt || f.createdAt || Date.now()),
          confidence: 'high',
        });
      });
    } else if (financialsSource === 'mca' && mcaData?.balanceSheets && mcaData.balanceSheets.length > 0) {
      // MCA provides balance sheet filing info but limited financial data
      // Capital info is available from the master data
      const latestBalanceSheet = mcaData.balanceSheets[0];
      financialsYears.push({
        data: {
          financialYear: latestBalanceSheet.financialYear || 'Latest',
          shareCapital: mcaData.paidUpCapital,
        },
        source: 'mca',
        fetchedAt: new Date(),
        confidence: 'medium',
      });
    }

    // Build ratios data
    const ratiosYears: SourcedData<RatiosData>[] = [];
    
    if (ratiosSource === 'fintekpro' && ownRatios.length > 0) {
      ownRatios.forEach(r => {
        ratiosYears.push({
          data: this.convertOwnRatios(r),
          source: 'fintekpro',
          fetchedAt: new Date(r.updatedAt || r.createdAt || Date.now()),
          confidence: 'high',
        });
      });
    }

    // Build capital data
    const capitalData = this.buildCapitalData(company, mcaData);

    // Build directors data (also check company.directors from enrichment)
    const directorsData = this.buildDirectorsData(company, mcaData, probe42Details);

    // Build charges data
    const chargesData = this.buildChargesData(mcaData);

    // Calculate data quality score
    const missingData: string[] = [];
    if (financialsYears.length === 0) missingData.push('financials');
    if (ratiosYears.length === 0) missingData.push('ratios');
    if (!capitalData.paidUpCapital) missingData.push('capital');
    if (directorsData.list.length === 0) missingData.push('directors');

    const overallScore = Math.round(
      ((financialsYears.length > 0 ? 30 : 0) +
      (ratiosYears.length > 0 ? 30 : 0) +
      (capitalData.paidUpCapital ? 20 : 0) +
      (directorsData.list.length > 0 ? 10 : 0) +
      (chargesData.source === 'mca' ? 10 : 5))
    );

    return {
      basic: {
        name: company?.name || mcaData?.companyName || 'Unknown',
        cin: company?.cin || mcaData?.cin || undefined,
        isin: company?.isin || undefined,
        sector: company?.sector || undefined,
        industry: company?.industry || undefined,
        status: company?.status || mcaData?.companyStatus || 'unknown',
        source: basicSource,
      },
      financials: {
        years: financialsYears,
        source: financialsSource,
        available: financialsYears.length > 0,
      },
      ratios: {
        years: ratiosYears,
        source: ratiosSource,
        available: ratiosYears.length > 0,
      },
      capital: capitalData,
      directors: directorsData,
      charges: chargesData,
      dataQuality: {
        overallScore,
        sourcesUsed,
        missingData,
        lastUpdated: new Date(),
        fallbackUsed: fallbackInfo?.fallbackUsed ?? false,
        fallbackReason: fallbackInfo?.fallbackReason,
        warnings: fallbackInfo?.warnings ?? [],
        primarySourceFailed: fallbackInfo?.primarySourceFailed ?? false,
      },
    };
  }

  private determineFinancialsSource(
    ownFinancials: CompanyFinancials[],
    mcaData: MCACompanyMasterData | null
  ): DataSource {
    if (ownFinancials.length > 0) return 'fintekpro';
    if (mcaData?.balanceSheets && mcaData.balanceSheets.length > 0) return 'mca';
    return 'fintekpro';
  }

  private determineRatiosSource(
    ownRatios: CompanyRatios[]
  ): DataSource {
    if (ownRatios.length > 0) return 'fintekpro';
    return 'fintekpro';
  }

  private determineBasicSource(
    company: UnlistedCompany | undefined,
    mcaData: MCACompanyMasterData | null
  ): DataSource {
    if (company) return 'fintekpro';
    if (mcaData) return 'mca';
    return 'fintekpro';
  }

  private convertOwnFinancials(f: CompanyFinancials): FinancialData {
    return {
      financialYear: f.financialYear,
      revenue: f.revenue ? parseFloat(f.revenue) : undefined,
      pat: f.pat ? parseFloat(f.pat) : undefined,
      networth: f.networth ? parseFloat(f.networth) : undefined,
      totalAssets: f.totalAssets ? parseFloat(f.totalAssets) : undefined,
      totalLiabilities: f.totalLiabilities ? parseFloat(f.totalLiabilities) : undefined,
      totalDebt: f.totalDebt ? parseFloat(f.totalDebt) : undefined,
      ebitda: f.ebitda ? parseFloat(f.ebitda) : undefined,
      shareCapital: f.shareCapital ? parseFloat(f.shareCapital) : undefined,
      reserves: f.reserves ? parseFloat(f.reserves) : undefined,
    };
  }

  private convertOwnRatios(r: CompanyRatios): RatiosData {
    return {
      financialYear: r.financialYear,
      peRatio: r.peRatio ? parseFloat(r.peRatio) : undefined,
      pbRatio: r.pbRatio ? parseFloat(r.pbRatio) : undefined,
      roe: r.roe ? parseFloat(r.roe) : undefined,
      roce: r.roce ? parseFloat(r.roce) : undefined,
      debtEquity: r.debtEquity ? parseFloat(r.debtEquity) : undefined,
      currentRatio: r.currentRatio ? parseFloat(r.currentRatio) : undefined,
      marginEbitda: r.marginEbitda ? parseFloat(r.marginEbitda) : undefined,
      marginPat: r.marginPat ? parseFloat(r.marginPat) : undefined,
      marginOperating: r.marginOperating ? parseFloat(r.marginOperating) : undefined,
    };
  }

  private buildCapitalData(
    company: UnlistedCompany | undefined,
    mcaData: MCACompanyMasterData | null
  ): UnifiedCompanyData['capital'] {
    // Priority: MCA (official) → FintekPro
    if (mcaData) {
      const faceValue = 10; // Assumed
      return {
        authorizedCapital: mcaData.authorizedCapital,
        paidUpCapital: mcaData.paidUpCapital,
        faceValue,
        totalShares: mcaData.paidUpCapital > 0 ? Math.floor(mcaData.paidUpCapital / faceValue) : undefined,
        source: 'mca',
      };
    }

    if (company) {
      return {
        authorizedCapital: company.authorizedCapital ? parseFloat(company.authorizedCapital) : undefined,
        paidUpCapital: company.paidUpCapital ? parseFloat(company.paidUpCapital) : undefined,
        faceValue: company.faceValue ? parseFloat(company.faceValue) : undefined,
        totalShares: company.totalShares ? Number(company.totalShares) : undefined,
        source: 'fintekpro',
      };
    }

    return {
      source: 'fintekpro',
    };
  }

  private buildDirectorsData(
    company: UnlistedCompany | undefined,
    mcaData: MCACompanyMasterData | null,
    probe42Details: CredhiveDirectorData | null
  ): UnifiedCompanyData['directors'] {
    // Priority: MCA (official) → Credhive → FintekPro (enriched)
    if (mcaData?.directors && mcaData.directors.length > 0) {
      return {
        list: mcaData.directors.map(d => ({
          name: d.name,
          din: d.din,
          designation: d.designation,
        })),
        source: 'mca',
      };
    }

    // Fallback to Credhive directors
    if (probe42Details?.directors && probe42Details.directors.length > 0) {
      return {
        list: probe42Details.directors.map(d => ({
          name: d.name,
          din: d.din || '',
          designation: d.designation || '',
        })),
        source: 'credhive',
      };
    }

    // Fallback to company.directors (from MCA enrichment)
    if (company?.directors && Array.isArray(company.directors) && company.directors.length > 0) {
      return {
        list: (company.directors as any[]).map(d => ({
          name: d.name || '',
          din: d.din || '',
          designation: d.designation || '',
        })),
        source: 'fintekpro',
      };
    }

    return {
      list: [],
      source: 'fintekpro',
    };
  }

  private buildChargesData(
    mcaData: MCACompanyMasterData | null
  ): UnifiedCompanyData['charges'] {
    if (mcaData?.charges && mcaData.charges.length > 0) {
      const activeCharges = mcaData.charges.filter(c => c.status.toLowerCase() !== 'closed');
      return {
        totalActive: activeCharges.length,
        totalAmount: activeCharges.reduce((sum, c) => sum + c.chargeAmount, 0),
        hasActiveCharges: activeCharges.length > 0,
        source: 'mca',
      };
    }

    return {
      totalActive: 0,
      totalAmount: 0,
      hasActiveCharges: false,
      source: 'fintekpro',
    };
  }

  /**
   * Refresh and save data from MCA to FintekPro database
   */
  async refreshAndSaveData(companyId: string): Promise<{
    success: boolean;
    financialsSaved: number;
    ratiosSaved: number;
    source: DataSource;
    error?: string;
  }> {
    try {
      const company = await storage.getUnlistedCompanyById(companyId);
      if (!company) {
        return { success: false, financialsSaved: 0, ratiosSaved: 0, source: 'fintekpro', error: 'Company not found' };
      }

      const data = await this.getCompanyData(companyId, { forceRefresh: true });
      if (!data) {
        return { success: false, financialsSaved: 0, ratiosSaved: 0, source: 'fintekpro', error: 'No data available from any source' };
      }

      let financialsSaved = 0;
      let ratiosSaved = 0;

      // Save financials if from MCA
      if (data.financials.source === 'mca' && data.financials.years.length > 0) {
        for (const yearData of data.financials.years) {
          const existing = await storage.getCompanyFinancialsByYear(companyId, yearData.data.financialYear);
          if (!existing) {
            const financialsToInsert: InsertCompanyFinancials = {
              companyId,
              financialYear: yearData.data.financialYear,
              revenue: yearData.data.revenue?.toString() || null,
              pat: yearData.data.pat?.toString() || null,
              networth: yearData.data.networth?.toString() || null,
              totalAssets: yearData.data.totalAssets?.toString() || null,
              totalLiabilities: yearData.data.totalLiabilities?.toString() || null,
              totalDebt: yearData.data.totalDebt?.toString() || null,
              ebitda: yearData.data.ebitda?.toString() || null,
              shareCapital: yearData.data.shareCapital?.toString() || null,
              reserves: yearData.data.reserves?.toString() || null,
              dataSource: 'mca',
            };
            await storage.createCompanyFinancials(financialsToInsert);
            financialsSaved++;
          }
        }
      }

      return {
        success: true,
        financialsSaved,
        ratiosSaved,
        source: data.financials.source,
      };
    } catch (error: any) {
      console.error('[UnifiedData] Error refreshing data:', error);
      return {
        success: false,
        financialsSaved: 0,
        ratiosSaved: 0,
        source: 'fintekpro',
        error: error.message,
      };
    }
  }
}

export const unifiedCompanyDataService = new UnifiedCompanyDataService();
