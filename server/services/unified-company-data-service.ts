/**
 * Unified Company Data Service
 * Aggregates company data from multiple sources with priority fallback:
 * 
 * Priority Order:
 * 1. Tofler (Primary) - Best for cleaned financials and ratios
 * 2. FintekPro Own Data - Internal database from previous syncs
 * 3. MCA (Fallback) - Official government filings via Sandbox API
 * 
 * This service provides a single interface for fetching company data,
 * automatically falling back to secondary sources if primary is unavailable.
 */

import { storage } from '../storage';
import { toflerService, type ToflerCompanyFullData, type ToflerFinancialData, type ToflerRatiosData } from './tofler-service';
import { mcaService, type MCACompanyMasterData } from './mca-service';
import type { 
  CompanyFinancials, 
  CompanyRatios, 
  UnlistedCompany,
  InsertCompanyFinancials,
  InsertCompanyRatios 
} from '@shared/schema';

export type DataSource = 'tofler' | 'fintekpro' | 'mca' | 'moneycontrol' | 'probe42';

export interface SourcedData<T> {
  data: T;
  source: DataSource;
  fetchedAt: Date;
  confidence: 'high' | 'medium' | 'low';
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
    years: SourcedData<ToflerFinancialData>[];
    source: DataSource;
    available: boolean;
  };
  ratios: {
    years: SourcedData<ToflerRatiosData>[];
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
  };
}

export interface DataFetchResult {
  success: boolean;
  source: DataSource;
  data?: any;
  error?: string;
}

class UnifiedCompanyDataService {

  /**
   * Fetch complete company data with automatic fallback
   */
  async getCompanyData(
    companyIdOrCin: string,
    options: {
      forceRefresh?: boolean;
      includeMCA?: boolean;
      skipTofler?: boolean;
    } = {}
  ): Promise<UnifiedCompanyData | null> {
    const { forceRefresh = false, includeMCA = true, skipTofler = false } = options;
    
    console.log(`[UnifiedData] Fetching data for: ${companyIdOrCin}`);
    
    // First, check if this is a company ID or CIN
    let company = await storage.getUnlistedCompanyById(companyIdOrCin);
    let cin = company?.cin || (companyIdOrCin.length === 21 ? companyIdOrCin : undefined);
    
    const results: DataFetchResult[] = [];
    let toflerData: ToflerCompanyFullData | null = null;
    let mcaData: MCACompanyMasterData | null = null;
    let ownFinancials: CompanyFinancials[] = [];
    let ownRatios: CompanyRatios[] = [];

    // Step 1: Try Tofler FIRST (primary external source - always attempt unless skipTofler)
    // This ensures we get the freshest data from the primary source
    if (!skipTofler) {
      try {
        if (cin) {
          toflerData = await toflerService.getCompanyDetails(cin);
        } else if (company?.name) {
          const searchResults = await toflerService.searchCompanies(company.name);
          if (searchResults.length > 0) {
            toflerData = await toflerService.getCompanyDetails(searchResults[0].url);
          }
        }
        
        if (toflerData) {
          results.push({
            success: true,
            source: 'tofler',
            data: toflerData,
          });
        } else {
          results.push({
            success: false,
            source: 'tofler',
            error: 'No data found on Tofler',
          });
        }
      } catch (error: any) {
        results.push({
          success: false,
          source: 'tofler',
          error: error.message,
        });
      }
    }

    // Step 2: Get FintekPro's own data (fallback if Tofler fails or for supplementary data)
    // Only used if Tofler data is not available
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

    // Step 3: Try MCA as final fallback
    // Engage when: Tofler failed (null) OR Tofler returned shell data (no usable financials/ratios)
    const toflerHasUsableData = toflerData && 
      ((toflerData.financials && toflerData.financials.length > 0) || 
       (toflerData.ratios && toflerData.ratios.length > 0));
    
    if (includeMCA && cin && !toflerHasUsableData) {
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
        }
      } catch (error: any) {
        results.push({
          success: false,
          source: 'mca',
          error: error.message,
        });
      }
    }

    // Aggregate data from all sources
    return this.aggregateData(company || undefined, toflerData, mcaData, ownFinancials, ownRatios, results);
  }

  /**
   * Aggregate data from multiple sources with priority
   */
  private aggregateData(
    company: UnlistedCompany | undefined,
    toflerData: ToflerCompanyFullData | null,
    mcaData: MCACompanyMasterData | null,
    ownFinancials: CompanyFinancials[],
    ownRatios: CompanyRatios[],
    fetchResults: DataFetchResult[]
  ): UnifiedCompanyData | null {
    
    const sourcesUsed: DataSource[] = fetchResults
      .filter(r => r.success)
      .map(r => r.source);
    
    if (sourcesUsed.length === 0 && !company) {
      return null;
    }

    // Determine best source for each data type
    const financialsSource = this.determineFinancialsSource(toflerData, ownFinancials, mcaData);
    const ratiosSource = this.determineRatiosSource(toflerData, ownRatios);
    const basicSource = this.determineBasicSource(company, toflerData, mcaData);

    // Build financials data
    const financialsYears: SourcedData<ToflerFinancialData>[] = [];
    
    if (financialsSource === 'tofler' && toflerData?.financials) {
      toflerData.financials.forEach(f => {
        financialsYears.push({
          data: f,
          source: 'tofler',
          fetchedAt: new Date(),
          confidence: 'high',
        });
      });
    } else if (financialsSource === 'fintekpro' && ownFinancials.length > 0) {
      ownFinancials.forEach(f => {
        financialsYears.push({
          data: this.convertOwnFinancials(f),
          source: 'fintekpro',
          fetchedAt: new Date(f.updatedAt || f.createdAt || Date.now()),
          confidence: 'medium',
        });
      });
    }

    // Build ratios data
    const ratiosYears: SourcedData<ToflerRatiosData>[] = [];
    
    if (ratiosSource === 'tofler' && toflerData?.ratios) {
      toflerData.ratios.forEach(r => {
        ratiosYears.push({
          data: r,
          source: 'tofler',
          fetchedAt: new Date(),
          confidence: 'high',
        });
      });
    } else if (ratiosSource === 'fintekpro' && ownRatios.length > 0) {
      ownRatios.forEach(r => {
        ratiosYears.push({
          data: this.convertOwnRatios(r),
          source: 'fintekpro',
          fetchedAt: new Date(r.updatedAt || r.createdAt || Date.now()),
          confidence: 'medium',
        });
      });
    }

    // Build capital data
    const capitalData = this.buildCapitalData(company, toflerData, mcaData);

    // Build directors data
    const directorsData = this.buildDirectorsData(toflerData, mcaData);

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
      (chargesData.source !== 'fintekpro' ? 10 : 5))
    );

    return {
      basic: {
        name: company?.name || toflerData?.details.name || mcaData?.companyName || 'Unknown',
        cin: company?.cin || toflerData?.details.cin || mcaData?.cin || undefined,
        isin: company?.isin || undefined,
        sector: company?.sector || toflerData?.details.industry || undefined,
        industry: company?.industry || toflerData?.details.category || undefined,
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
      },
    };
  }

  private determineFinancialsSource(
    toflerData: ToflerCompanyFullData | null,
    ownFinancials: CompanyFinancials[],
    mcaData: MCACompanyMasterData | null
  ): DataSource {
    if (toflerData?.financials && toflerData.financials.length > 0) return 'tofler';
    if (ownFinancials.length > 0) return 'fintekpro';
    if (mcaData) return 'mca';
    return 'fintekpro';
  }

  private determineRatiosSource(
    toflerData: ToflerCompanyFullData | null,
    ownRatios: CompanyRatios[]
  ): DataSource {
    if (toflerData?.ratios && toflerData.ratios.length > 0) return 'tofler';
    if (ownRatios.length > 0) return 'fintekpro';
    return 'fintekpro';
  }

  private determineBasicSource(
    company: UnlistedCompany | undefined,
    toflerData: ToflerCompanyFullData | null,
    mcaData: MCACompanyMasterData | null
  ): DataSource {
    if (company) return 'fintekpro';
    if (toflerData) return 'tofler';
    if (mcaData) return 'mca';
    return 'fintekpro';
  }

  private convertOwnFinancials(f: CompanyFinancials): ToflerFinancialData {
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

  private convertOwnRatios(r: CompanyRatios): ToflerRatiosData {
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
    toflerData: ToflerCompanyFullData | null,
    mcaData: MCACompanyMasterData | null
  ): UnifiedCompanyData['capital'] {
    // Priority: MCA (official) → Tofler → FintekPro
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

    if (toflerData?.details) {
      return {
        authorizedCapital: toflerData.details.authorizedCapital,
        paidUpCapital: toflerData.details.paidUpCapital,
        faceValue: undefined,
        totalShares: undefined,
        source: 'tofler',
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
    toflerData: ToflerCompanyFullData | null,
    mcaData: MCACompanyMasterData | null
  ): UnifiedCompanyData['directors'] {
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
   * Refresh and save data from external sources to FintekPro database
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

      // Save financials if from Tofler
      if (data.financials.source === 'tofler' && data.financials.years.length > 0) {
        for (const yearData of data.financials.years) {
          // Check if already exists for this year
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
              dataSource: 'tofler',
            };
            
            await storage.createCompanyFinancials(financialsToInsert);
            financialsSaved++;
          }
        }
      }

      // Save ratios if from Tofler
      if (data.ratios.source === 'tofler' && data.ratios.years.length > 0) {
        for (const yearData of data.ratios.years) {
          // Check if already exists for this year
          const existing = await storage.getCompanyRatiosByYear(companyId, yearData.data.financialYear);
          if (!existing) {
            const ratiosToInsert: InsertCompanyRatios = {
              companyId,
              financialYear: yearData.data.financialYear,
              peRatio: yearData.data.peRatio?.toString() || null,
              pbRatio: yearData.data.pbRatio?.toString() || null,
              roe: yearData.data.roe?.toString() || null,
              roce: yearData.data.roce?.toString() || null,
              debtEquity: yearData.data.debtEquity?.toString() || null,
              currentRatio: yearData.data.currentRatio?.toString() || null,
              marginEbitda: yearData.data.marginEbitda?.toString() || null,
              marginPat: yearData.data.marginPat?.toString() || null,
              marginOperating: yearData.data.marginOperating?.toString() || null,
              dataSource: 'tofler',
            };
            
            await storage.createCompanyRatios(ratiosToInsert);
            ratiosSaved++;
          }
        }
      }

      return {
        success: true,
        financialsSaved,
        ratiosSaved,
        source: data.financials.source || data.ratios.source || 'fintekpro',
      };
    } catch (error: any) {
      console.error('[UnifiedData] Error refreshing data:', error.message);
      return {
        success: false,
        financialsSaved: 0,
        ratiosSaved: 0,
        source: 'fintekpro',
        error: error.message,
      };
    }
  }

  /**
   * Search for company across all sources
   */
  async searchCompany(query: string): Promise<{
    source: DataSource;
    results: Array<{
      name: string;
      cin?: string;
      status?: string;
      url?: string;
    }>;
  }[]> {
    const allResults: {
      source: DataSource;
      results: Array<{
        name: string;
        cin?: string;
        status?: string;
        url?: string;
      }>;
    }[] = [];

    // Search Tofler
    try {
      const toflerResults = await toflerService.searchCompanies(query);
      if (toflerResults.length > 0) {
        allResults.push({
          source: 'tofler',
          results: toflerResults.map(r => ({
            name: r.name,
            cin: r.cin,
            status: r.status,
            url: r.url,
          })),
        });
      }
    } catch (error) {
      console.error('[UnifiedData] Tofler search error:', error);
    }

    // Search FintekPro database (filter locally)
    try {
      const allCompanies = await storage.getAllUnlistedCompanies();
      const queryLower = query.toLowerCase();
      const ownResults = allCompanies
        .filter(c => 
          c.name.toLowerCase().includes(queryLower) ||
          (c.cin && c.cin.toLowerCase().includes(queryLower)) ||
          (c.isin && c.isin.toLowerCase().includes(queryLower))
        )
        .slice(0, 10);
      
      if (ownResults.length > 0) {
        allResults.push({
          source: 'fintekpro',
          results: ownResults.map((r: UnlistedCompany) => ({
            name: r.name,
            cin: r.cin || undefined,
            status: r.status,
          })),
        });
      }
    } catch (error) {
      console.error('[UnifiedData] FintekPro search error:', error);
    }

    return allResults;
  }
}

export const unifiedCompanyDataService = new UnifiedCompanyDataService();
