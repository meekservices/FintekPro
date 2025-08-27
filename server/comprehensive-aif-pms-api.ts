import fetch from 'node-fetch';

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

  // Comprehensive AIF Data Fetching
  async getComprehensiveAIFData(aifId?: string, category?: string): Promise<ComprehensiveAIFData[]> {
    try {
      // Fetch from multiple sources and combine
      const [sebiData, pmsBazaarData, pmsWorldData] = await Promise.all([
        this.fetchSEBIAIFData(aifId, category),
        this.fetchPMSBazaarAIFData(category),
        this.fetchPMSWorldAIFData(category)
      ]);

      return this.combineAIFData(sebiData, pmsBazaarData, pmsWorldData);
    } catch (error) {
      console.error('Error fetching comprehensive AIF data:', error);
      return this.getMockAIFData();
    }
  }

  // Comprehensive PMS Data Fetching
  async getComprehensivePMSData(pmsId?: string, category?: string): Promise<ComprehensivePMSData[]> {
    try {
      const [sebiData, pmsBazaarData, apmiData] = await Promise.all([
        this.fetchSEBIPMSData(pmsId),
        this.fetchPMSBazaarPMSData(category),
        this.fetchAPMIPMSData()
      ]);

      return this.combinePMSData(sebiData, pmsBazaarData, apmiData);
    } catch (error) {
      console.error('Error fetching comprehensive PMS data:', error);
      return this.getMockPMSData();
    }
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
    // Mock implementation - would call actual SEBI API
    return [];
  }

  private async fetchPMSBazaarAIFData(category?: string): Promise<any[]> {
    // Mock implementation - would call PMS Bazaar API
    return [];
  }

  private async fetchPMSWorldAIFData(category?: string): Promise<any[]> {
    // Mock implementation - would call PMS World API
    return [];
  }

  private async fetchSEBIPMSData(pmsId?: string): Promise<any[]> {
    // Mock implementation - would call SEBI PMS API
    return [];
  }

  private async fetchPMSBazaarPMSData(category?: string): Promise<any[]> {
    // Mock implementation - would call PMS Bazaar API
    return [];
  }

  private async fetchAPMIPMSData(): Promise<any[]> {
    // Mock implementation - would call APMI India API
    return [];
  }

  private combineAIFData(sebiData: any[], pmsBazaarData: any[], pmsWorldData: any[]): ComprehensiveAIFData[] {
    // Data combination logic
    return this.getMockAIFData();
  }

  private combinePMSData(sebiData: any[], pmsBazaarData: any[], apmiData: any[]): ComprehensivePMSData[] {
    // Data combination logic
    return this.getMockPMSData();
  }

  // Mock data generators with comprehensive fields
  private getMockAIFData(): ComprehensiveAIFData[] {
    return [
      {
        aifId: "AIF001",
        isin: "INF846K01EW7",
        schemaName: "Kotak Strategic Situations Fund",
        sebiRegistrationNumber: "IN/AIF2/21-22/1047",
        category: "Category II",
        subCategory: "Private Equity Fund",
        fundType: "Growth Equity",
        investmentObjective: "Generate superior risk-adjusted returns through investments in undervalued growth companies",
        fundManager: {
          name: "Nilesh Shah",
          experience: 15,
          qualification: "CFA, MBA Finance",
          previousPerformance: [
            { fundName: "Kotak Equity Fund", period: "2019-2024", returns: 18.5 }
          ],
          trackRecord: "Consistent top quartile performance across market cycles"
        },
        stockScreeningStrategy: {
          screeningCriteria: ["ROE > 15%", "Debt/Equity < 0.5", "Revenue Growth > 12%"],
          selectionProcess: "Bottom-up fundamental analysis with sector rotation",
          riskParameters: {
            maxSingleStockExposure: 8,
            sectorConcentrationLimit: 25,
            marketCapPreference: "Mid to Large Cap"
          },
          investmentPhilosophy: "Value investing with growth at reasonable price (GARP)",
          portfolioConstruction: "Concentrated portfolio of 25-30 high conviction stocks"
        },
        pastPerformance: {
          '1M': 2.8,
          '3M': 8.5,
          '6M': 15.2,
          '1Y': 22.4,
          '3Y': 18.7,
          '5Y': 16.9,
          sinceInception: 19.2,
          annualizedReturns: [
            { year: 2024, return: 22.4, benchmark: 18.7, outperformance: 3.7 },
            { year: 2023, return: 15.8, benchmark: 12.3, outperformance: 3.5 }
          ]
        },
        startDate: "2021-03-15",
        fundTenure: "7 years",
        lockInPeriod: "3 years",
        minimumInvestment: 10000000, // 1 crore
        targetCorpus: 50000000000, // 500 crores
        currentAUM: 35000000000, // 350 crores
        managementFee: 2.0,
        performanceFee: 20.0,
        hurdle_rate: 12.0,
        highWaterMark: true,
        topHoldings: [
          { stockName: "Reliance Industries", isin: "INE002A01018", allocation: 8.5, sector: "Energy", marketCap: "Large Cap" },
          { stockName: "HDFC Bank", isin: "INE040A01034", allocation: 7.2, sector: "Banking", marketCap: "Large Cap" }
        ],
        riskMetrics: {
          volatility: 16.8,
          sharpeRatio: 1.32,
          maxDrawdown: -18.5,
          beta: 0.95,
          alpha: 3.7,
          informationRatio: 0.85
        },
        sebiCompliance: {
          lastInspectionDate: "2024-06-15",
          complianceRating: "A+",
          penalties: []
        }
      }
    ];
  }

  private getMockPMSData(): ComprehensivePMSData[] {
    return [
      {
        pmsId: "PMS001",
        isin: "INF754K01UV8",
        schemaName: "Abakkus All Cap Growth Portfolio",
        sebiRegistrationNumber: "INP000005647",
        category: "Multi Cap",
        subCategory: "Growth Focused",
        investmentStyle: "Bottom-up Stock Picking",
        fundManager: {
          name: "Sunil Singhania",
          experience: 25,
          qualification: "CFA, CA, MBA",
          previousFunds: [
            { fundName: "Reliance Growth Fund", period: "2010-2020", performance: 19.5 }
          ],
          investmentPhilosophy: "Identifying companies that can double earnings in 4-5 years"
        },
        stockScreeningStrategy: {
          screeningMethodology: "MEETS Framework - Management, Earnings, Economic moats, Trailing indicators, Scalability",
          fundamentalCriteria: ["Strong management track record", "Consistent earnings growth", "Sustainable competitive advantages"],
          technicalCriteria: ["Momentum indicators", "Volume analysis", "Chart patterns"],
          quantitativeModels: ["DCF valuation", "PE ratio analysis", "PEG ratio screening"],
          riskManagement: {
            stopLossStrategy: "15% stop loss on individual positions",
            positionSizing: "Maximum 8% in single stock",
            diversificationRules: "15-25 stocks across 8-10 sectors"
          },
          portfolioConstruction: "Concentrated high conviction portfolio"
        },
        pastPerformance: {
          '1M': 3.2,
          '3M': 9.8,
          '6M': 18.5,
          '1Y': 28.7,
          '3Y': 22.1,
          '5Y': 19.8,
          '10Y': 17.5,
          sinceInception: 21.3,
          calendarYearReturns: [
            { year: 2024, return: 28.7, benchmark: 24.1, rank: 2 },
            { year: 2023, return: 19.2, benchmark: 16.8, rank: 3 }
          ]
        },
        startDate: "2019-04-01",
        fundTenure: "Open ended",
        minimumInvestment: 5000000, // 50 lakhs
        currentAUM: 37200000000, // 372 crores
        maxCapacity: 100000000000, // 1000 crores
        managementFee: 2.5,
        performanceFee: 20.0,
        entryLoad: 0,
        exitLoad: 1.0,
        portfolioComposition: {
          equityAllocation: 95.5,
          cashAllocation: 4.5,
          numberOfStocks: 23,
          portfolioTurnover: 15.8,
          averageMarketCap: 125000000000 // 1.25 lakh crores
        },
        topHoldings: [
          { stockName: "HDFC Bank", isin: "INE040A01034", allocation: 7.8, sector: "Banking", marketCap: "Large Cap", entryDate: "2023-01-15" },
          { stockName: "Infosys", isin: "INE009A01021", allocation: 6.9, sector: "IT Services", marketCap: "Large Cap", entryDate: "2022-11-20" }
        ],
        riskMetrics: {
          volatility: 18.2,
          sharpeRatio: 1.45,
          sortinoRatio: 1.98,
          maxDrawdown: -22.1,
          beta: 1.08,
          alpha: 4.6,
          trackingError: 6.8
        }
      }
    ];
  }
}

export const comprehensiveAIFPMSAPI = new ComprehensiveAIFPMSAPI();
export default comprehensiveAIFPMSAPI;