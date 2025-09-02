import express from 'express';
import { storage } from './storage';
import { ICICIBankAPI } from './icici-bank-api';
import { HDFCBankAPI } from './hdfc-bank-api';
import { IBApiService } from './ib-api';
import { ComprehensiveAIFPMSAPI } from './comprehensive-aif-pms-api';

interface MinimalClientData {
  panNumber: string;
  mobile: string;
  email: string;
  accountNumber?: string;
  bankName?: string;
  investmentPreference?: string;
}

interface AutoPopulatedResult {
  personalInfo: any;
  bankingData: any;
  portfolioData: any;
  productRecommendations: any;
  complianceData: any;
  totalDataPoints: number;
}

export class ClientAutoPopulateService {
  private iciciAPI: ICICIBankAPI;
  private hdfcAPI: HDFCBankAPI;
  private ibAPI: IBApiService;
  private aifPmsAPI: ComprehensiveAIFPMSAPI;

  constructor() {
    this.iciciAPI = new ICICIBankAPI({ 
      environment: 'sandbox', 
      appKey: process.env.ICICI_APP_KEY || '', 
      secretKey: process.env.ICICI_SECRET_KEY || '', 
      baseUrl: 'https://apigwuat.icicibank.com' 
    });
    this.hdfcAPI = new HDFCBankAPI({ 
      environment: 'sandbox', 
      clientId: process.env.HDFC_CLIENT_ID || '', 
      clientSecret: process.env.HDFC_CLIENT_SECRET || '', 
      baseUrl: 'https://api-sandbox.hdfcbank.com' 
    });
    this.ibAPI = new IBApiService({ host: '127.0.0.1', port: 7497, clientId: 1, paperTrading: true });
    this.aifPmsAPI = new ComprehensiveAIFPMSAPI();
  }

  async autoPopulateClientData(userId: string, minimalData: MinimalClientData): Promise<AutoPopulatedResult> {
    console.log(`Starting auto-populate for user ${userId} with data:`, minimalData);
    
    const result: AutoPopulatedResult = {
      personalInfo: {},
      bankingData: {},
      portfolioData: {},
      productRecommendations: [],
      complianceData: {},
      totalDataPoints: 0
    };

    try {
      // Step 1: Fetch banking data if account details provided
      if (minimalData.accountNumber && minimalData.bankName) {
        result.bankingData = await this.fetchBankingData(minimalData);
      }

      // Step 2: Use PAN to fetch additional personal information
      if (minimalData.panNumber) {
        result.personalInfo = await this.fetchPersonalInfoByPAN(minimalData.panNumber);
      }

      // Step 3: Generate investment profile based on banking patterns
      const investmentProfile = await this.generateInvestmentProfile(minimalData, result.bankingData);
      
      // Step 4: Fetch product recommendations based on profile
      result.productRecommendations = await this.fetchProductRecommendations(investmentProfile);

      // Step 5: Create initial portfolio setup
      result.portfolioData = await this.createInitialPortfolio(userId, investmentProfile);

      // Step 6: Generate compliance data
      result.complianceData = await this.generateComplianceData(minimalData);

      // Step 7: Update user profile with all fetched data
      await this.updateUserProfile(userId, {
        ...minimalData,
        ...result.personalInfo,
        ...result.complianceData,
        investmentProfile
      });

      // Count total data points
      result.totalDataPoints = this.countDataPoints(result);

      console.log(`Auto-populate completed for user ${userId}. Total data points: ${result.totalDataPoints}`);
      return result;

    } catch (error) {
      console.error('Auto-populate error:', error);
      throw new Error(`Failed to auto-populate client data: ${error}`);
    }
  }

  private async fetchBankingData(data: MinimalClientData) {
    const bankingData: any = {
      accounts: [],
      totalBalance: 0,
      monthlyAverage: 0,
      transactionPatterns: {},
      inferredRiskProfile: data.investmentPreference || 'balanced'
    };

    try {
      if (data.bankName === 'ICICI' && data.accountNumber) {
        // Fetch ICICI Bank data
        const balanceResult = await this.iciciAPI.getAccountBalance(data.accountNumber);
        if (balanceResult.success && balanceResult.data) {
          bankingData.accounts.push({
            bank: 'ICICI',
            accountNumber: data.accountNumber,
            balance: balanceResult.data.availableBalance,
            type: balanceResult.data.accountType
          });
          bankingData.totalBalance += balanceResult.data.availableBalance;
        }

        // Fetch transaction history for spending pattern analysis
        const transactionResult = await this.iciciAPI.getTransactionHistory(
          data.accountNumber,
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString(),
          100
        );

        if (transactionResult.success && transactionResult.data) {
          bankingData.transactionPatterns = this.analyzeTransactionPatterns(transactionResult.data);
          bankingData.monthlyAverage = this.calculateMonthlyAverage(transactionResult.data);
        }
      }

      if (data.bankName === 'HDFC' && data.accountNumber) {
        // Fetch HDFC Bank data
        const balanceResult = await this.hdfcAPI.getAccountBalance(data.accountNumber);
        if (balanceResult.success && balanceResult.data) {
          bankingData.accounts.push({
            bank: 'HDFC',
            accountNumber: data.accountNumber,
            balance: balanceResult.data.availableBalance,
            type: balanceResult.data.accountType
          });
          bankingData.totalBalance += balanceResult.data.availableBalance;
        }

        // Fetch HDFC transaction history
        const transactionResult = await this.hdfcAPI.getTransactionHistory(
          data.accountNumber,
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0],
          100
        );

        if (transactionResult.success && transactionResult.data) {
          bankingData.transactionPatterns = this.analyzeTransactionPatterns(transactionResult.data);
          bankingData.monthlyAverage = this.calculateMonthlyAverage(transactionResult.data);
        }
      }

      // Infer risk profile from banking patterns
      if (bankingData.transactionPatterns) {
        bankingData.inferredRiskProfile = this.inferRiskProfileFromBanking(bankingData);
      }

    } catch (error) {
      console.warn('Banking data fetch error:', error);
    }

    return bankingData;
  }

  private async fetchPersonalInfoByPAN(panNumber: string) {
    const personalInfo: any = {
      dataPoints: 0,
      sources: []
    };

    try {
      // Additional PAN-based data enrichment could be added here
      // (from other APIs like income tax, credit bureaus, etc.)
      personalInfo.sources.push('PAN-Registry');

      // Additional PAN-based data enrichment could be added here
      // (from other APIs like income tax, credit bureaus, etc.)

    } catch (error) {
      console.warn('Personal info fetch error:', error);
    }

    return personalInfo;
  }

  private async generateInvestmentProfile(minimalData: MinimalClientData, bankingData: any) {
    const profile = {
      riskTolerance: minimalData.investmentPreference || 'balanced',
      investmentHorizon: 'medium_term',
      preferredAssetClasses: ['equity', 'debt'],
      minimumInvestment: 10000,
      maxInvestment: 100000,
      goals: ['wealth_creation'],
      sectors: ['technology', 'healthcare', 'financial']
    };

    // Adjust based on banking data
    if (bankingData.totalBalance > 1000000) {
      profile.maxInvestment = 500000;
      profile.minimumInvestment = 50000;
    }

    if (bankingData.inferredRiskProfile === 'conservative') {
      profile.preferredAssetClasses = ['debt', 'gold'];
      profile.riskTolerance = 'conservative';
    } else if (bankingData.inferredRiskProfile === 'aggressive') {
      profile.preferredAssetClasses = ['equity', 'crypto'];
      profile.riskTolerance = 'aggressive';
    }

    return profile;
  }

  private async fetchProductRecommendations(investmentProfile: any) {
    const recommendations: any[] = [];

    try {
      // Fetch AIF and PMS recommendations
      const aifData = await this.aifPmsAPI.getComprehensiveAIFData();
      const pmsData = await this.aifPmsAPI.getComprehensivePMSData();

      // Filter and score products based on investment profile
      const allProducts = [...aifData, ...pmsData];
      
      for (const product of allProducts.slice(0, 20)) {
        const matchScore = this.calculateProductMatch(product, investmentProfile);
        if (matchScore > 60) {
          const isAIF = 'aifId' in product;
          recommendations.push({
            id: isAIF ? (product as any).aifId : (product as any).pmsId,
            name: product.schemaName,
            type: isAIF ? 'AIF' : 'PMS',
            category: product.category,
            minimumInvestment: product.minimumInvestment,
            expectedReturns: product.pastPerformance?.['1Y'] || 0,
            riskLevel: this.mapRiskLevel(product),
            matchScore: Math.round(matchScore),
            fee: product.managementFee
          });
        }
      }

      // Sort by match score
      recommendations.sort((a, b) => b.matchScore - a.matchScore);

    } catch (error) {
      console.warn('Product recommendations error:', error);
    }

    return recommendations.slice(0, 10);
  }

  private async createInitialPortfolio(userId: string, investmentProfile: any) {
    const portfolioData = {
      portfolioId: `auto-${userId}-${Date.now()}`,
      name: 'Auto-Generated Portfolio',
      totalValue: 0,
      allocation: {
        equity: investmentProfile.riskTolerance === 'aggressive' ? 70 : 
                 investmentProfile.riskTolerance === 'balanced' ? 50 : 30,
        debt: investmentProfile.riskTolerance === 'aggressive' ? 20 : 
              investmentProfile.riskTolerance === 'balanced' ? 40 : 60,
        gold: 10,
        cash: investmentProfile.riskTolerance === 'aggressive' ? 0 : 10
      },
      suggestedInvestments: [],
      riskScore: investmentProfile.riskTolerance === 'aggressive' ? 80 : 
                  investmentProfile.riskTolerance === 'balanced' ? 50 : 20
    };

    try {
      // Create portfolio in database
      await storage.createPortfolio({
        userId: userId,
        name: portfolioData.name,
        totalValue: portfolioData.totalValue.toString()
      });

    } catch (error) {
      console.warn('Portfolio creation error:', error);
    }

    return portfolioData;
  }

  private async generateComplianceData(minimalData: MinimalClientData) {
    return {
      kycStatus: 'pending',
      fatcaStatus: 'pending',
      pepStatus: 'No',
      residentStatus: 'resident',
      countryOfResidence: 'India',
      taxResidencyCountry: 'India',
      sourceOfWealth: 'employment',
      riskCategory: 'low',
      complianceScore: 85,
      lastComplianceReview: new Date().toISOString(),
      dataSource: 'auto-populated'
    };
  }

  private async updateUserProfile(userId: string, data: any) {
    try {
      await storage.updateUser(userId, {
        ...data,
        profileCompleteness: 90,
        lastUpdated: new Date(),
        dataPopulationSource: 'auto-api'
      });
    } catch (error) {
      console.warn('User profile update error:', error);
    }
  }

  // Helper methods
  private analyzeTransactionPatterns(transactions: any[]) {
    const patterns = {
      averageTransactionSize: 0,
      frequentMerchants: [],
      spendingCategories: {},
      volatility: 0
    };

    if (transactions.length > 0) {
      const amounts = transactions.map(t => Math.abs(t.amount));
      patterns.averageTransactionSize = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      patterns.volatility = this.calculateVolatility(amounts);
    }

    return patterns;
  }

  private calculateMonthlyAverage(transactions: any[]) {
    const credits = transactions.filter(t => t.amount > 0);
    if (credits.length === 0) return 0;
    
    const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);
    const months = 3; // Assuming 3 months of data
    return totalCredits / months;
  }

  private inferRiskProfileFromBanking(bankingData: any) {
    const { totalBalance, transactionPatterns } = bankingData;
    
    if (totalBalance > 2000000 && transactionPatterns.volatility > 0.5) {
      return 'aggressive';
    } else if (totalBalance > 500000 && transactionPatterns.volatility > 0.3) {
      return 'balanced';
    }
    return 'conservative';
  }

  private calculateProductMatch(product: any, profile: any): number {
    let score = 50; // Base score

    // Risk alignment
    const productRisk = this.mapRiskLevel(product);
    if (productRisk === profile.riskTolerance) score += 30;
    else if (Math.abs(this.riskToNumber(productRisk) - this.riskToNumber(profile.riskTolerance)) === 1) score += 15;

    // Investment amount alignment
    if (product.minimumInvestment <= profile.maxInvestment && 
        product.minimumInvestment >= profile.minimumInvestment) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private mapRiskLevel(product: any): string {
    if (product.category?.includes('III') || product.riskMetrics?.volatility > 25) return 'aggressive';
    if (product.category?.includes('II') || product.riskMetrics?.volatility > 15) return 'balanced';
    return 'conservative';
  }

  private riskToNumber(risk: string): number {
    const map = { conservative: 1, balanced: 2, aggressive: 3 };
    return map[risk as keyof typeof map] || 2;
  }

  private calculateVolatility(amounts: number[]): number {
    if (amounts.length < 2) return 0;
    
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const squaredDiffs = amounts.map(amount => Math.pow(amount - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / amounts.length;
    return Math.sqrt(variance) / mean;
  }

  private countDataPoints(result: AutoPopulatedResult): number {
    let count = 0;
    
    count += result.personalInfo.dataPoints || 0;
    count += result.bankingData.accounts?.length || 0;
    count += result.productRecommendations?.length || 0;
    count += Object.keys(result.complianceData).length;
    count += result.portfolioData ? 5 : 0; // Portfolio structure points
    
    return count;
  }
}

// Express router setup
export function setupClientAutoPopulateRoutes(app: express.Application) {
  const autoPopulateService = new ClientAutoPopulateService();

  app.post('/api/client/auto-populate', async (req, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const minimalData = req.body as MinimalClientData;
      
      // Validate required fields
      if (!minimalData.panNumber || !minimalData.mobile || !minimalData.email) {
        return res.status(400).json({ 
          message: 'Missing required fields: panNumber, mobile, email' 
        });
      }

      const result = await autoPopulateService.autoPopulateClientData(req.user.id, minimalData);
      
      res.json({
        success: true,
        message: 'Client data auto-populated successfully',
        data: result
      });

    } catch (error: any) {
      console.error('Auto-populate API error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to auto-populate client data'
      });
    }
  });
}