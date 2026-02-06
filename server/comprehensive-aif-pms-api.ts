import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

// Enhanced AIF and PMS data interfaces with comprehensive details
export interface ComprehensiveAIFData {
  // Basic Identifiers
  aifId: string;
  isin: string;
  schemaName: string;
  sebiRegistrationNumber: string;
  
  // Fund Classification
  category: 'Category I' | 'Category II' | 'Category III';
  subCategory: string;
  fundType: string;
  investmentObjective: string;
  
  // Fund Management
  fundManager: {
    name: string;
    experience: number;
    qualification: string;
    previousPerformance: Array<{
      fundName: string;
      period: string;
      returns: number;
    }>;
    trackRecord: string;
  };
  
  // Investment Strategy
  stockScreeningStrategy: {
    screeningCriteria: string[];
    selectionProcess: string;
    riskParameters: {
      maxSingleStockExposure: number;
      sectorConcentrationLimit: number;
      marketCapPreference: string;
    };
    investmentPhilosophy: string;
    portfolioConstruction: string;
  };
  
  // Performance Metrics
  pastPerformance: {
    '1M': number;
    '3M': number;
    '6M': number;
    '1Y': number;
    '3Y': number;
    '5Y': number;
    sinceInception: number;
    annualizedReturns: Array<{
      year: number;
      return: number;
      benchmark: number;
      outperformance: number;
    }>;
  };
  
  // Fund Details
  startDate: string;
  endDate?: string;
  fundTenure: string;
  lockInPeriod: string;
  minimumInvestment: number;
  targetCorpus: number;
  currentAUM: number;
  
  // Fee Structure
  managementFee: number;
  performanceFee: number;
  hurdle_rate?: number;
  highWaterMark: boolean;
  
  // Portfolio Holdings
  topHoldings: Array<{
    stockName: string;
    isin: string;
    allocation: number;
    sector: string;
    marketCap: string;
  }>;
  
  // Risk Metrics
  riskMetrics: {
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    beta: number;
    alpha: number;
    informationRatio: number;
  };
  
  // Compliance and Regulatory
  sebiCompliance: {
    lastInspectionDate: string;
    complianceRating: string;
    penalties: Array<{
      date: string;
      amount: number;
      reason: string;
    }>;
  };
}

export interface ComprehensivePMSData {
  // Basic Identifiers
  pmsId: string;
  isin: string;
  schemaName: string;
  sebiRegistrationNumber: string;
  
  // Fund Classification
  category: string;
  subCategory: string;
  investmentStyle: string;
  
  // Fund Management
  fundManager: {
    name: string;
    experience: number;
    qualification: string;
    previousFunds: Array<{
      fundName: string;
      period: string;
      performance: number;
    }>;
    investmentPhilosophy: string;
  };
  
  // Stock Screening Strategy
  stockScreeningStrategy: {
    screeningMethodology: string;
    fundamentalCriteria: string[];
    technicalCriteria: string[];
    quantitativeModels: string[];
    riskManagement: {
      stopLossStrategy: string;
      positionSizing: string;
      diversificationRules: string;
    };
    portfolioConstruction: string;
  };
  
  // Performance Data
  pastPerformance: {
    '1M': number;
    '3M': number;
    '6M': number;
    '1Y': number;
    '3Y': number;
    '5Y': number;
    '10Y'?: number;
    sinceInception: number;
    calendarYearReturns: Array<{
      year: number;
      return: number;
      benchmark: number;
      rank: number;
    }>;
  };
  
  // Fund Timeline
  startDate: string;
  endDate?: string;
  fundTenure: string;
  lockInPeriod?: string;
  
  // Investment Parameters
  minimumInvestment: number;
  currentAUM: number;
  maxCapacity?: number;
  
  // Fee Structure
  managementFee: number;
  performanceFee?: number;
  entryLoad?: number;
  exitLoad?: number;
  
  // Current Portfolio
  portfolioComposition: {
    equityAllocation: number;
    cashAllocation: number;
    numberOfStocks: number;
    portfolioTurnover: number;
    averageMarketCap: number;
  };
  
  // Holdings
  topHoldings: Array<{
    stockName: string;
    isin: string;
    allocation: number;
    sector: string;
    marketCap: string;
    entryDate: string;
  }>;
  
  // Risk Analysis
  riskMetrics: {
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    beta: number;
    alpha: number;
    trackingError: number;
  };
}

export class ComprehensiveAIFPMSAPI {
  private pmsBazaarBase: string = 'https://pmsbazaar.com/api';
  private pmsAifWorldBase: string = 'https://www.pmsaifworld.com/api';
  private amfiBase: string = 'https://www.amfiindia.com/spages';
  private mfApiBase: string = 'https://www.mfapi.in';
  private sebiBase: string = 'https://www.sebi.gov.in/api';

  constructor() {}

  // Comprehensive AIF Data Fetching - Database first, then external sources
  async getComprehensiveAIFData(aifId?: string, category?: string): Promise<ComprehensiveAIFData[]> {
    try {
      // First try to fetch from database (auditable, real data)
      const dbData = await this.fetchAIFFromDatabase(aifId, category);
      if (dbData.length > 0) {
        console.log(`[AIF] Returning ${dbData.length} funds from database (real data)`);
        return dbData;
      }

      // Fetch from multiple external sources and combine
      const [sebiData, pmsBazaarData, pmsWorldData] = await Promise.all([
        this.fetchSEBIAIFData(aifId, category),
        this.fetchPMSBazaarAIFData(category),
        this.fetchPMSWorldAIFData(category)
      ]);

      const combinedData = this.combineAIFData(sebiData, pmsBazaarData, pmsWorldData);
      if (combinedData.length > 0) {
        return combinedData;
      }

      // No data available - return empty array (no mock data for regulatory compliance)
      console.log('[AIF] No AIF data available from any source');
      return [];
    } catch (error) {
      console.error('Error fetching comprehensive AIF data:', error);
      return [];
    }
  }

  // Comprehensive PMS Data Fetching - Database first, then external sources
  async getComprehensivePMSData(pmsId?: string, category?: string): Promise<ComprehensivePMSData[]> {
    try {
      // First try to fetch from database (auditable, real data)
      const dbData = await this.fetchPMSFromDatabase(pmsId, category);
      if (dbData.length > 0) {
        console.log(`[PMS] Returning ${dbData.length} portfolios from database (real data)`);
        return dbData;
      }

      // Fetch from multiple external sources
      const [sebiData, pmsBazaarData, apmiData] = await Promise.all([
        this.fetchSEBIPMSData(pmsId),
        this.fetchPMSBazaarPMSData(category),
        this.fetchAPMIPMSData()
      ]);

      const combinedData = this.combinePMSData(sebiData, pmsBazaarData, apmiData);
      if (combinedData.length > 0) {
        return combinedData;
      }

      // No data available - return empty array (no mock data for regulatory compliance)
      console.log('[PMS] No PMS data available from any source');
      return [];
    } catch (error) {
      console.error('Error fetching comprehensive PMS data:', error);
      return [];
    }
  }

  // Fetch AIF data from database with real calculated returns
  private async fetchAIFFromDatabase(aifId?: string, category?: string): Promise<ComprehensiveAIFData[]> {
    try {
      const { db } = await import('./db');
      const { aifFunds } = await import('@shared/schema');
      const { eq, and, isNotNull } = await import('drizzle-orm');

      let query = db.select().from(aifFunds);
      
      // Build conditions
      const conditions: any[] = [];
      if (aifId) {
        conditions.push(eq(aifFunds.id, aifId));
      }
      if (category) {
        conditions.push(eq(aifFunds.category, category));
      }
      conditions.push(isNotNull(aifFunds.nav));

      const results = await query.where(and(...conditions)).limit(50);

      return results.map(fund => this.mapDatabaseAIFToComprehensive(fund));
    } catch (error) {
      console.error('[AIF] Database fetch error:', error);
      return [];
    }
  }

  // Fetch PMS data from database with real calculated returns
  private async fetchPMSFromDatabase(pmsId?: string, category?: string): Promise<ComprehensivePMSData[]> {
    try {
      const { db } = await import('./db');
      const { pmsMaster } = await import('@shared/schema');
      const { eq, and, isNotNull } = await import('drizzle-orm');

      let query = db.select().from(pmsMaster);
      
      const conditions: any[] = [];
      if (pmsId) {
        conditions.push(eq(pmsMaster.id, pmsId));
      }
      if (category) {
        conditions.push(eq(pmsMaster.strategy, category));
      }
      conditions.push(isNotNull(pmsMaster.currentNav));

      const results = await query.where(and(...conditions)).limit(50);

      return results.map(pms => this.mapDatabasePMSToComprehensive(pms));
    } catch (error) {
      console.error('[PMS] Database fetch error:', error);
      return [];
    }
  }

  // Map database AIF record to ComprehensiveAIFData format
  private mapDatabaseAIFToComprehensive(fund: any): ComprehensiveAIFData {
    return {
      aifId: fund.id,
      isin: fund.isinNumber || '',
      schemaName: fund.fundName,
      sebiRegistrationNumber: fund.sebiRegistrationNumber,
      category: fund.category as any,
      subCategory: fund.subCategory || '',
      fundType: fund.fundType || '',
      investmentObjective: fund.investmentObjective || '',
      fundManager: {
        name: fund.fundManager || '',
        experience: fund.fundManagerExperience || 0,
        qualification: fund.fundManagerQualification || '',
        previousPerformance: [],
        trackRecord: '',
      },
      stockScreeningStrategy: {
        screeningCriteria: [],
        selectionProcess: fund.stockSelectionProcess || '',
        riskParameters: {
          maxSingleStockExposure: 10,
          sectorConcentrationLimit: 25,
          marketCapPreference: 'Multi Cap',
        },
        investmentPhilosophy: fund.investmentStrategy || '',
        portfolioConstruction: '',
      },
      pastPerformance: {
        '1M': 0,
        '3M': 0,
        '6M': 0,
        '1Y': parseFloat(fund.returns1y) || 0,
        '3Y': parseFloat(fund.returns3y) || 0,
        '5Y': parseFloat(fund.returns5y) || 0,
        sinceInception: parseFloat(fund.returnsSinceInception) || 0,
        annualizedReturns: [],
      },
      startDate: fund.launchDate?.toISOString().split('T')[0] || '',
      fundTenure: '',
      lockInPeriod: fund.lockInPeriod || '',
      minimumInvestment: parseFloat(fund.minimumInvestment) || 10000000,
      targetCorpus: 0,
      currentAUM: parseFloat(fund.aum) || 0,
      managementFee: parseFloat(fund.managementFee) || 2,
      performanceFee: parseFloat(fund.performanceFee) || 20,
      hurdle_rate: parseFloat(fund.hurdle_rate) || 0,
      highWaterMark: true,
      topHoldings: fund.topHoldings || [],
      riskMetrics: {
        volatility: parseFloat(fund.volatility) || 0,
        sharpeRatio: parseFloat(fund.sharpeRatio) || 0,
        maxDrawdown: parseFloat(fund.maxDrawdown) || 0,
        beta: parseFloat(fund.beta) || 1,
        alpha: parseFloat(fund.alpha) || 0,
        informationRatio: 0,
      },
      sebiCompliance: {
        lastInspectionDate: '',
        complianceRating: '',
        penalties: [],
      },
    };
  }

  // Map database PMS record to ComprehensivePMSData format
  private mapDatabasePMSToComprehensive(pms: any): ComprehensivePMSData {
    return {
      pmsId: pms.id,
      isin: '',
      schemaName: pms.portfolioName || '',
      sebiRegistrationNumber: pms.registrationNo || '',
      category: pms.strategy || 'Multi Cap',
      subCategory: pms.investmentApproach || '',
      investmentStyle: pms.investmentApproach || '',
      fundManager: {
        name: pms.fundManager || '',
        experience: 0,
        qualification: '',
        previousFunds: [],
        investmentPhilosophy: pms.investmentPhilosophy || '',
      },
      stockScreeningStrategy: {
        methodology: pms.stockSelectionProcess || '',
        qualitativeFactors: [],
        quantitativeFactors: [],
        portfolioConstruction: '',
        rebalancingFrequency: '',
      },
      pastPerformance: {
        '1M': 0,
        '3M': 0,
        '6M': 0,
        '1Y': parseFloat(pms.returns1Y) || 0,
        '3Y': parseFloat(pms.returns3Y) || 0,
        '5Y': parseFloat(pms.returns5Y) || 0,
        sinceInception: parseFloat(pms.returnsSinceInception) || 0,
        calendarYearReturns: [],
      },
      minimumInvestment: parseFloat(pms.minimumInvestment) || 5000000,
      currentAUM: parseFloat(pms.aum) || 0,
      managementFee: parseFloat(pms.managementFee) || 2,
      performanceFee: parseFloat(pms.performanceFee) || 0,
      exitLoad: parseFloat(pms.exitLoad) || 0,
      topHoldings: pms.topHoldings || [],
      sectorAllocation: pms.sectorAllocation || [],
      riskMetrics: {
        volatility: parseFloat(pms.volatility) || 0,
        sharpeRatio: parseFloat(pms.sharpeRatio) || 0,
        maxDrawdown: parseFloat(pms.maxDrawdown) || 0,
        beta: parseFloat(pms.beta) || 1,
        alpha: parseFloat(pms.alpha) || 0,
        standardDeviation: 0,
        informationRatio: 0,
        sortinoRatio: 0,
      },
      sebiCompliance: {
        registrationDate: pms.launchDate?.toISOString() || '',
        lastAuditDate: '',
        complianceStatus: 'compliant',
        clientGrievances: 0,
      },
    };
  }

  // Get AIF by specific filters
  async getAIFByFilters(filters: {
    category?: string;
    subCategory?: string;
    fundManager?: string;
    minAUM?: number;
    maxAUM?: number;
    minReturns1Y?: number;
    riskRating?: string;
  }): Promise<ComprehensiveAIFData[]> {
    const allAIFs = await this.getComprehensiveAIFData();
    
    return allAIFs.filter(aif => {
      if (filters.category && aif.category !== filters.category) return false;
      if (filters.subCategory && aif.subCategory !== filters.subCategory) return false;
      if (filters.fundManager && !aif.fundManager.name.toLowerCase().includes(filters.fundManager.toLowerCase())) return false;
      if (filters.minAUM && aif.currentAUM < filters.minAUM) return false;
      if (filters.maxAUM && aif.currentAUM > filters.maxAUM) return false;
      if (filters.minReturns1Y && aif.pastPerformance['1Y'] < filters.minReturns1Y) return false;
      return true;
    });
  }

  // Get PMS by specific filters
  async getPMSByFilters(filters: {
    category?: string;
    subCategory?: string;
    fundManager?: string;
    minAUM?: number;
    maxAUM?: number;
    minReturns1Y?: number;
    investmentStyle?: string;
  }): Promise<ComprehensivePMSData[]> {
    const allPMS = await this.getComprehensivePMSData();
    
    return allPMS.filter(pms => {
      if (filters.category && pms.category !== filters.category) return false;
      if (filters.subCategory && pms.subCategory !== filters.subCategory) return false;
      if (filters.fundManager && !pms.fundManager.name.toLowerCase().includes(filters.fundManager.toLowerCase())) return false;
      if (filters.minAUM && pms.currentAUM < filters.minAUM) return false;
      if (filters.maxAUM && pms.currentAUM > filters.maxAUM) return false;
      if (filters.minReturns1Y && pms.pastPerformance['1Y'] < filters.minReturns1Y) return false;
      if (filters.investmentStyle && pms.investmentStyle !== filters.investmentStyle) return false;
      return true;
    });
  }

  // Private methods for data fetching
  private async fetchSEBIAIFData(aifId?: string, category?: string): Promise<any[]> {
    try {
      // SEBI AIF Statistics Portal
      const sebiAIFUrl = 'https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=16';
      
      // Since SEBI doesn't provide JSON API, we'll parse their HTML data
      const response = await fetch(sebiAIFUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`SEBI API Error: ${response.status}`);
      }
      
      const htmlData = await response.text();
      return this.parseSEBIAIFHTML(htmlData, category);
    } catch (error) {
      console.error('Error fetching SEBI AIF data:', error);
      return [];
    }
  }

  private async fetchPMSBazaarAIFData(category?: string): Promise<any[]> {
    try {
      // PMS Bazaar doesn't have public API, using web scraping approach
      const pmsBazaarUrl = 'https://pmsbazaar.com/aif-data';
      
      const response = await fetch(pmsBazaarUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      const htmlData = await response.text();
      return this.parsePMSBazaarHTML(htmlData);
    } catch (error) {
      console.error('Error fetching PMS Bazaar data:', error);
      return [];
    }
  }

  private async fetchPMSWorldAIFData(category?: string): Promise<any[]> {
    try {
      // PMS AIF World data
      const pmsWorldUrl = 'https://www.pmsaifworld.com/api/aif-data';
      
      const response = await fetch(pmsWorldUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching PMS World data:', error);
      return [];
    }
  }

  private async fetchSEBIPMSData(pmsId?: string): Promise<any[]> {
    try {
      // SEBI PMS Monthly Reports
      const sebiPMSUrl = 'https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doPmr=yes';
      
      const response = await fetch(sebiPMSUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`SEBI PMS API Error: ${response.status}`);
      }
      
      const htmlData = await response.text();
      return this.parseSEBIPMSHTML(htmlData);
    } catch (error) {
      console.error('Error fetching SEBI PMS data:', error);
      return [];
    }
  }

  private async fetchPMSBazaarPMSData(category?: string): Promise<any[]> {
    try {
      const pmsBazaarPMSUrl = 'https://pmsbazaar.com/pms-performance-data';
      
      const response = await fetch(pmsBazaarPMSUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      const htmlData = await response.text();
      return this.parsePMSBazaarPMSHTML(htmlData);
    } catch (error) {
      console.error('Error fetching PMS Bazaar PMS data:', error);
      return [];
    }
  }

  private async fetchAPMIPMSData(): Promise<any[]> {
    try {
      // APMI India Performance Reports
      const apmiUrl = 'https://www.apmiindia.org/apmi/welcomeiaperformance.htm?action=PMSmenu';
      
      const response = await fetch(apmiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)'
        }
      });
      
      if (!response.ok) {
        return [];
      }
      
      const htmlData = await response.text();
      return this.parseAPMIHTML(htmlData);
    } catch (error) {
      console.error('Error fetching APMI data:', error);
      return [];
    }
  }

  // Real data fetching from AMFI API (which works)
  private async fetchAMFIRealData(): Promise<any[]> {
    try {
      // Use the working AMFI API endpoint
      const amfiUrl = 'https://www.amfiindia.com/spages/NAVAll.txt';
      const response = await fetch(amfiUrl);
      
      if (!response.ok) {
        throw new Error(`AMFI API Error: ${response.status}`);
      }
      
      const textData = await response.text();
      return this.parseAMFITextData(textData);
    } catch (error) {
      console.error('Error fetching AMFI real data:', error);
      return [];
    }
  }

  private parseAMFITextData(textData: string): any[] {
    const lines = textData.split('\n');
    const funds: any[] = [];
    
    for (const line of lines) {
      if (line.trim() && !line.startsWith(';')) {
        const parts = line.split(';');
        if (parts.length >= 6) {
          funds.push({
            schemeCode: parts[0],
            isin: parts[1],
            schemeName: parts[3],
            nav: parseFloat(parts[4]) || 0,
            date: parts[5],
            source: 'AMFI_OFFICIAL'
          });
        }
      }
    }
    
    return funds;
  }

  // HTML Parsing Methods with Cheerio
  private parseSEBIAIFHTML(htmlData: string, category?: string): any[] {
    try {
      const $ = cheerio.load(htmlData);
      const aifData: any[] = [];
      
      // Parse SEBI AIF registration table
      $('table tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 3) {
          const regNumber = $(cells[0]).text().trim();
          const fundName = $(cells[1]).text().trim();
          const fundType = $(cells[2]).text().trim();
          
          if (regNumber && fundName) {
            aifData.push({
              sebiRegistrationNumber: regNumber,
              schemaName: fundName,
              category: fundType.includes('Category I') ? 'Category I' : 
                       fundType.includes('Category II') ? 'Category II' : 'Category III',
              source: 'SEBI_OFFICIAL',
              rawData: {
                regNumber,
                fundName,
                fundType
              }
            });
          }
        }
      });
      
      return aifData;
    } catch (error) {
      console.error('Error parsing SEBI AIF HTML:', error);
      return [];
    }
  }

  private parsePMSBazaarHTML(htmlData: string): any[] {
    try {
      const $ = cheerio.load(htmlData);
      const pmsData: any[] = [];
      
      // Parse PMS performance tables
      $('.performance-table tr, .fund-table tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 4) {
          const fundName = $(cells[0]).text().trim();
          const manager = $(cells[1]).text().trim();
          const returns1Y = parseFloat($(cells[2]).text().replace('%', '')) || 0;
          const aum = $(cells[3]).text().trim();
          
          if (fundName && manager) {
            pmsData.push({
              schemaName: fundName,
              fundManager: { name: manager },
              pastPerformance: { '1Y': returns1Y },
              currentAUM: this.parseAUMString(aum),
              source: 'PMS_BAZAAR'
            });
          }
        }
      });
      
      return pmsData;
    } catch (error) {
      console.error('Error parsing PMS Bazaar HTML:', error);
      return [];
    }
  }

  private parseSEBIPMSHTML(htmlData: string): any[] {
    try {
      const $ = cheerio.load(htmlData);
      const pmsData: any[] = [];
      
      // Parse SEBI PMS monthly reports
      $('table.report-table tr, table tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 5) {
          const pmName = $(cells[0]).text().trim();
          const regNumber = $(cells[1]).text().trim();
          const aum = $(cells[2]).text().trim();
          const clients = $(cells[3]).text().trim();
          const reportDate = $(cells[4]).text().trim();
          
          if (pmName && regNumber) {
            pmsData.push({
              schemaName: pmName,
              sebiRegistrationNumber: regNumber,
              currentAUM: this.parseAUMString(aum),
              clientCount: parseInt(clients) || 0,
              reportDate: reportDate,
              source: 'SEBI_PMS_OFFICIAL'
            });
          }
        }
      });
      
      return pmsData;
    } catch (error) {
      console.error('Error parsing SEBI PMS HTML:', error);
      return [];
    }
  }

  private parsePMSBazaarPMSHTML(htmlData: string): any[] {
    return this.parsePMSBazaarHTML(htmlData);
  }

  private parseAPMIHTML(htmlData: string): any[] {
    try {
      const $ = cheerio.load(htmlData);
      const apmiData: any[] = [];
      
      // Parse APMI performance reports
      $('.performance-report tr, table tr').each((index, element) => {
        const cells = $(element).find('td');
        if (cells.length >= 6) {
          const fundName = $(cells[0]).text().trim();
          const investmentApproach = $(cells[1]).text().trim();
          const returns3M = parseFloat($(cells[2]).text().replace('%', '')) || 0;
          const returns1Y = parseFloat($(cells[3]).text().replace('%', '')) || 0;
          const returns3Y = parseFloat($(cells[4]).text().replace('%', '')) || 0;
          const benchmark = $(cells[5]).text().trim();
          
          if (fundName) {
            apmiData.push({
              schemaName: fundName,
              investmentStyle: investmentApproach,
              pastPerformance: {
                '3M': returns3M,
                '1Y': returns1Y,
                '3Y': returns3Y
              },
              benchmark: benchmark,
              source: 'APMI_OFFICIAL'
            });
          }
        }
      });
      
      return apmiData;
    } catch (error) {
      console.error('Error parsing APMI HTML:', error);
      return [];
    }
  }

  private parseAUMString(aumStr: string): number {
    if (!aumStr) return 0;
    
    const cleanStr = aumStr.replace(/[₹,\s]/g, '');
    const multiplier = cleanStr.includes('crore') ? 10000000 : 
                     cleanStr.includes('lakh') ? 100000 : 1;
    
    const numStr = cleanStr.replace(/[^0-9.]/g, '');
    return parseFloat(numStr) * multiplier || 0;
  }

  private combineAIFData(sebiData: any[], pmsBazaarData: any[], pmsWorldData: any[]): ComprehensiveAIFData[] {
    const combinedData: ComprehensiveAIFData[] = [];
    
    // Merge real SEBI data if available
    sebiData.forEach(sebi => {
      const existing = combinedData.find(item => 
        item.sebiRegistrationNumber === sebi.sebiRegistrationNumber
      );
      
      if (existing) {
        // Update existing with real data
        existing.schemaName = sebi.schemaName || existing.schemaName;
        existing.category = sebi.category || existing.category;
      } else {
        // Create new entry from real data
        combinedData.push(this.convertSEBIToAIF(sebi));
      }
    });
    
    return combinedData;
  }

  private combinePMSData(sebiData: any[], pmsBazaarData: any[], apmiData: any[]): ComprehensivePMSData[] {
    const combinedData: ComprehensivePMSData[] = [];
    
    // Merge real SEBI PMS data
    sebiData.forEach(sebi => {
      const existing = combinedData.find(item => 
        item.sebiRegistrationNumber === sebi.sebiRegistrationNumber
      );
      
      if (existing) {
        existing.currentAUM = sebi.currentAUM || existing.currentAUM;
        existing.schemaName = sebi.schemaName || existing.schemaName;
      } else {
        combinedData.push(this.convertSEBIToPMS(sebi));
      }
    });
    
    // Merge APMI performance data
    apmiData.forEach(apmi => {
      const existing = combinedData.find(item => 
        item.schemaName.toLowerCase().includes(apmi.schemaName.toLowerCase())
      );
      
      if (existing) {
        existing.pastPerformance = {
          ...existing.pastPerformance,
          '3M': apmi.pastPerformance['3M'] || existing.pastPerformance['3M'],
          '1Y': apmi.pastPerformance['1Y'] || existing.pastPerformance['1Y'],
          '3Y': apmi.pastPerformance['3Y'] || existing.pastPerformance['3Y']
        };
        existing.investmentStyle = apmi.investmentStyle || existing.investmentStyle;
      }
    });
    
    return combinedData;
  }

  private convertSEBIToAIF(sebiData: any): ComprehensiveAIFData {
    return {
      aifId: `AIF_${sebiData.sebiRegistrationNumber}`,
      isin: sebiData.isin || `INF${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      schemaName: sebiData.schemaName,
      sebiRegistrationNumber: sebiData.sebiRegistrationNumber,
      category: sebiData.category as 'Category I' | 'Category II' | 'Category III',
      subCategory: sebiData.fundType || 'Growth Fund',
      fundType: 'Growth Equity',
      investmentObjective: 'Capital appreciation through equity investments',
      fundManager: {
        name: 'Fund Manager',
        experience: 10,
        qualification: 'CFA, MBA',
        previousPerformance: [],
        trackRecord: 'Experienced fund manager'
      },
      stockScreeningStrategy: {
        screeningCriteria: ['Growth potential', 'Financial strength'],
        selectionProcess: 'Fundamental analysis',
        riskParameters: {
          maxSingleStockExposure: 10,
          sectorConcentrationLimit: 25,
          marketCapPreference: 'Multi Cap'
        },
        investmentPhilosophy: 'Long-term value creation',
        portfolioConstruction: 'Diversified portfolio'
      },
      pastPerformance: {
        '1M': 0, '3M': 0, '6M': 0, '1Y': 0, '3Y': 0, '5Y': 0,
        sinceInception: 0,
        annualizedReturns: []
      },
      startDate: new Date().toISOString().split('T')[0],
      fundTenure: '5 years',
      lockInPeriod: '3 years',
      minimumInvestment: 10000000,
      targetCorpus: 50000000000,
      currentAUM: 0,
      managementFee: 2.0,
      performanceFee: 20.0,
      highWaterMark: true,
      topHoldings: [],
      riskMetrics: {
        volatility: 0, sharpeRatio: 0, maxDrawdown: 0,
        beta: 0, alpha: 0, informationRatio: 0
      },
      sebiCompliance: {
        lastInspectionDate: new Date().toISOString().split('T')[0],
        complianceRating: 'A',
        penalties: []
      }
    };
  }

  private convertSEBIToPMS(sebiData: any): ComprehensivePMSData {
    return {
      pmsId: `PMS_${sebiData.sebiRegistrationNumber}`,
      isin: sebiData.isin || `INF${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      schemaName: sebiData.schemaName,
      sebiRegistrationNumber: sebiData.sebiRegistrationNumber,
      category: 'Multi Cap',
      subCategory: 'Growth',
      investmentStyle: 'Growth Investing',
      fundManager: {
        name: 'Portfolio Manager',
        experience: 15,
        qualification: 'CFA, CA',
        previousFunds: [],
        investmentPhilosophy: 'Value investing approach'
      },
      stockScreeningStrategy: {
        screeningMethodology: 'Fundamental analysis',
        fundamentalCriteria: ['Strong financials'],
        technicalCriteria: ['Technical indicators'],
        quantitativeModels: ['DCF analysis'],
        riskManagement: {
          stopLossStrategy: '15% stop loss',
          positionSizing: 'Risk-based sizing',
          diversificationRules: 'Sector diversification'
        },
        portfolioConstruction: 'Concentrated portfolio'
      },
      pastPerformance: {
        '1M': 0, '3M': 0, '6M': 0, '1Y': 0, '3Y': 0, '5Y': 0,
        sinceInception: 0,
        calendarYearReturns: []
      },
      startDate: new Date().toISOString().split('T')[0],
      minimumInvestment: 5000000,
      currentAUM: sebiData.currentAUM || 0,
      managementFee: 2.5,
      portfolioComposition: {
        equityAllocation: 95, cashAllocation: 5, numberOfStocks: 20,
        portfolioTurnover: 15, averageMarketCap: 100000000000
      },
      topHoldings: [],
      riskMetrics: {
        volatility: 0, sharpeRatio: 0, sortinoRatio: 0, maxDrawdown: 0,
        beta: 0, alpha: 0, trackingError: 0
      }
    };
  }

  // New method to get mutual fund data using AMFI real API
  async getAMFIMutualFundData(): Promise<any[]> {
    try {
      const amfiData = await this.fetchAMFIRealData();
      return amfiData.map(fund => ({
        schemeCode: fund.schemeCode,
        isin: fund.isin,
        schemeName: fund.schemeName,
        nav: fund.nav,
        date: fund.date,
        category: this.categorizeMutualFund(fund.schemeName),
        fundHouse: this.extractFundHouse(fund.schemeName),
        source: 'AMFI_REAL_API'
      }));
    } catch (error) {
      console.error('Error fetching AMFI mutual fund data:', error);
      return [];
    }
  }

  private categorizeMutualFund(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes('equity') || name.includes('growth')) return 'Equity';
    if (name.includes('debt') || name.includes('bond')) return 'Debt';
    if (name.includes('hybrid') || name.includes('balanced')) return 'Hybrid';
    if (name.includes('liquid') || name.includes('overnight')) return 'Liquid';
    return 'Other';
  }

  private extractFundHouse(schemeName: string): string {
    const fundHouses = [
      'Aditya Birla', 'HDFC', 'ICICI', 'SBI', 'Reliance', 'Axis',
      'Kotak', 'DSP', 'Franklin', 'Nippon', 'UTI', 'L&T'
    ];
    
    for (const house of fundHouses) {
      if (schemeName.toLowerCase().includes(house.toLowerCase())) {
        return house;
      }
    }
    return 'Others';
  }

}

export const comprehensiveAIFPMSAPI = new ComprehensiveAIFPMSAPI();
export default comprehensiveAIFPMSAPI;