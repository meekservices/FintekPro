import { CamsApiService } from '../cams-api';
import { kfintechApi } from '../kfintech-api';
import * as schema from '@shared/schema';
import { db } from '../db';
import { eq, and, gte, lte } from 'drizzle-orm';

interface ComprehensivePortfolioOptions {
  userId: string;
  date: string;
  includeGovernmentSchemes?: boolean;
  includeMutualFunds?: boolean;
  includeEquities?: boolean;
  includeInsurance?: boolean;
}

interface PopulatedHolding {
  symbol: string;
  assetName: string;
  assetType: string;
  assetClass: string;
  quantity?: number;
  units?: number;
  currentPrice?: number;
  marketValue: number;
  investedValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  dataSource: string;
  sourceAccountNumber?: string;
  folio?: string;
  dematAccountNumber?: string;
  metadata?: any;
}

interface ConsolidatedPortfolio {
  portfolioId: string;
  userId: string;
  snapshotDate: string;
  totalValue: number;
  totalEquityValue: number;
  totalDebtValue: number;
  totalMutualFundValue: number;
  totalGovernmentSchemeValue: number;
  totalAlternativeValue: number;
  totalCashValue: number;
  epfValue: number;
  ppfValue: number;
  epsValue: number;
  apyValue: number;
  npsValue: number;
  insuranceValue: number;
  holdings: PopulatedHolding[];
  assetBreakdown: {
    equities: number;
    mutualFunds: number;
    governmentSchemes: number;
    debt: number;
    alternatives: number;
    cash: number;
    insurance: number;
  };
}

export class ComprehensivePortfolioService {
  private camsApi: CamsApiService;
  private kfintechApi: any;

  constructor() {
    this.camsApi = new CamsApiService();
    this.kfintechApi = kfintechApi;
  }

  /**
   * Populate comprehensive portfolio holdings from all sources
   */
  async populateComprehensivePortfolio(options: ComprehensivePortfolioOptions): Promise<ConsolidatedPortfolio> {
    const { userId, date, includeGovernmentSchemes = true, includeMutualFunds = true, includeEquities = true, includeInsurance = true } = options;
    
    // Get user profile to extract PAN and other details
    const userProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
    const profile = userProfile[0];
    
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Get or create default portfolio
    const portfolios = await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userId)).limit(1);
    let portfolio = portfolios[0];
    
    if (!portfolio) {
      // Create default portfolio
      const [newPortfolio] = await db.insert(schema.portfolios).values({
        userId,
        name: 'Comprehensive Portfolio',
        isDefault: true
      }).returning();
      portfolio = newPortfolio;
    }

    const allHoldings: PopulatedHolding[] = [];
    let totalValues = {
      equity: 0,
      debt: 0,
      mutualFund: 0,
      governmentScheme: 0,
      alternative: 0,
      cash: 0,
      insurance: 0,
      epf: 0,
      ppf: 0,
      eps: 0,
      apy: 0,
      nps: 0
    };

    try {
      // 1. Populate from CAMS (Mutual Funds)
      if (includeMutualFunds && profile.panNumber) {
        const camsHoldings = await this.populateFromCams(profile.panNumber, date);
        allHoldings.push(...camsHoldings);
        totalValues.mutualFund += this.calculateTotalValue(camsHoldings);
      }

      // 2. Populate from Kfintech (Mutual Funds)
      if (includeMutualFunds && profile.panNumber) {
        const kfintechHoldings = await this.populateFromKfintech(profile.panNumber, date);
        allHoldings.push(...kfintechHoldings);
        totalValues.mutualFund += this.calculateTotalValue(kfintechHoldings);
      }

      // 3. Populate from NSDL/CDSL (Equities & Bonds)
      if (includeEquities) {
        const dematAccounts = await db.select().from(schema.userDematAccounts).where(eq(schema.userDematAccounts.userId, userId));
        
        for (const dematAccount of dematAccounts) {
          const equityHoldings = await this.populateFromDemat(dematAccount, date);
          allHoldings.push(...equityHoldings);
          totalValues.equity += this.calculateTotalValue(equityHoldings.filter(h => h.assetType === 'equity'));
          totalValues.debt += this.calculateTotalValue(equityHoldings.filter(h => h.assetType === 'debt'));
        }
      }

      // 4. Populate Government Schemes
      if (includeGovernmentSchemes) {
        const govSchemeHoldings = await this.populateGovernmentSchemes(userId, date);
        allHoldings.push(...govSchemeHoldings);
        
        govSchemeHoldings.forEach(holding => {
          if (holding.assetClass === 'epf') totalValues.epf += holding.marketValue;
          else if (holding.assetClass === 'ppf') totalValues.ppf += holding.marketValue;
          else if (holding.assetClass === 'eps') totalValues.eps += holding.marketValue;
          else if (holding.assetClass === 'apy') totalValues.apy += holding.marketValue;
          totalValues.governmentScheme += holding.marketValue;
        });
      }

      // 5. Populate Insurance Holdings
      if (includeInsurance) {
        const insuranceHoldings = await this.populateInsuranceHoldings(userId, date);
        allHoldings.push(...insuranceHoldings);
        totalValues.insurance += this.calculateTotalValue(insuranceHoldings);
      }

    } catch (error) {
      console.error('Error populating comprehensive portfolio:', error);
      // Continue with available data
    }

    // Create portfolio snapshot
    const totalValue = Object.values(totalValues).reduce((sum, val) => sum + val, 0);
    
    const snapshot = await this.createPortfolioSnapshot({
      portfolioId: portfolio.id,
      userId,
      snapshotDate: date,
      totalValue,
      totalEquityValue: totalValues.equity,
      totalDebtValue: totalValues.debt,
      totalMutualFundValue: totalValues.mutualFund,
      totalGovernmentSchemeValue: totalValues.governmentScheme,
      totalAlternativeValue: totalValues.alternative,
      totalCashValue: totalValues.cash,
      epfValue: totalValues.epf,
      ppfValue: totalValues.ppf,
      epsValue: totalValues.eps,
      apyValue: totalValues.apy,
      npsValue: totalValues.nps,
      insuranceValue: totalValues.insurance,
      metadata: {
        lastUpdated: new Date().toISOString(),
        dataSourcesUsed: this.getDataSourcesUsed(allHoldings),
        holdingsCount: allHoldings.length
      }
    });

    // Save comprehensive holdings
    await this.saveComprehensiveHoldings(portfolio.id, snapshot.id, userId, date, allHoldings);

    return {
      portfolioId: portfolio.id,
      userId,
      snapshotDate: date,
      totalValue,
      totalEquityValue: totalValues.equity,
      totalDebtValue: totalValues.debt,
      totalMutualFundValue: totalValues.mutualFund,
      totalGovernmentSchemeValue: totalValues.governmentScheme,
      totalAlternativeValue: totalValues.alternative,
      totalCashValue: totalValues.cash,
      epfValue: totalValues.epf,
      ppfValue: totalValues.ppf,
      epsValue: totalValues.eps,
      apyValue: totalValues.apy,
      npsValue: totalValues.nps,
      insuranceValue: totalValues.insurance,
      holdings: allHoldings,
      assetBreakdown: {
        equities: totalValues.equity,
        mutualFunds: totalValues.mutualFund,
        governmentSchemes: totalValues.governmentScheme,
        debt: totalValues.debt,
        alternatives: totalValues.alternative,
        cash: totalValues.cash,
        insurance: totalValues.insurance
      }
    };
  }

  /**
   * Populate holdings from CAMS
   */
  private async populateFromCams(panNumber: string, date: string): Promise<PopulatedHolding[]> {
    try {
      const portfolioDetails = await this.camsApi.getInvestorPortfolio(panNumber);
      const holdings: PopulatedHolding[] = [];

      for (const folio of portfolioDetails) {
        holdings.push({
          symbol: folio.schemeCode,
          assetName: folio.schemeName,
          assetType: 'mutual_fund',
          assetClass: this.getMutualFundAssetClass(folio.schemeName),
          units: folio.currentUnits,
          currentPrice: folio.nav,
          marketValue: folio.currentValue,
          dataSource: 'cams',
          folio: folio.folio,
          metadata: {
            navDate: folio.navDate,
            investorDetails: folio.investorDetails
          }
        });
      }

      return holdings;
    } catch (error) {
      console.error('Error fetching CAMS holdings:', error);
      return [];
    }
  }

  /**
   * Populate holdings from Kfintech
   */
  private async populateFromKfintech(panNumber: string, date: string): Promise<PopulatedHolding[]> {
    try {
      const portfolioResponse = await this.kfintechApi.getInvestorPortfolio(panNumber);
      const holdings: PopulatedHolding[] = [];

      if (portfolioResponse.success && portfolioResponse.data) {
        for (const folio of portfolioResponse.data.folios) {
          const gainLoss = folio.currentValue - folio.investmentValue;
          const gainLossPercent = folio.investmentValue > 0 ? (gainLoss / folio.investmentValue) * 100 : 0;

          holdings.push({
            symbol: folio.schemeCode,
            assetName: folio.schemeName,
            assetType: 'mutual_fund',
            assetClass: this.getMutualFundAssetClass(folio.schemeName),
            units: folio.units,
            currentPrice: folio.nav,
            marketValue: folio.currentValue,
            investedValue: folio.investmentValue,
            gainLoss,
            gainLossPercent,
            dataSource: 'kfintech',
            folio: folio.folioNumber,
            metadata: {
              gainLossPercentage: folio.gainLossPercentage
            }
          });
        }
      }

      return holdings;
    } catch (error) {
      console.error('Error fetching Kfintech holdings:', error);
      return [];
    }
  }

  /**
   * Populate holdings from Demat accounts (NSDL/CDSL)
   */
  private async populateFromDemat(dematAccount: any, date: string): Promise<PopulatedHolding[]> {
    const holdings: PopulatedHolding[] = [];

    try {
      // This would integrate with actual NSDL/CDSL APIs
      // For now, we'll simulate based on existing demat account data
      
      // You would call the actual NSDL/CDSL APIs here
      // const nsdlHoldings = await this.getNsdlHoldings(dematAccount.accountNumber, date);
      // const cdslHoldings = await this.getCdslHoldings(dematAccount.boId, date);

      // Simulated equity holdings
      const mockEquityHoldings = [
        {
          symbol: 'RELIANCE',
          assetName: 'Reliance Industries Ltd',
          assetType: 'equity',
          assetClass: 'large_cap',
          quantity: 100,
          currentPrice: 2500,
          marketValue: 250000,
          dataSource: dematAccount.depository.toLowerCase(),
          dematAccountNumber: dematAccount.accountNumber,
          metadata: {
            sector: 'Energy',
            exchange: 'NSE'
          }
        }
      ];

      holdings.push(...mockEquityHoldings);

    } catch (error) {
      console.error('Error fetching demat holdings:', error);
    }

    return holdings;
  }

  /**
   * Populate government scheme holdings
   */
  private async populateGovernmentSchemes(userId: string, date: string): Promise<PopulatedHolding[]> {
    const holdings: PopulatedHolding[] = [];

    try {
      // EPF Holdings
      const epfHoldings = await db.select().from(schema.epfHoldings).where(eq(schema.epfHoldings.userId, userId));
      for (const epf of epfHoldings) {
        holdings.push({
          symbol: epf.epfAccountNumber,
          assetName: `EPF - ${epf.employerName}`,
          assetType: 'government_scheme',
          assetClass: 'epf',
          marketValue: Number(epf.totalBalance || 0),
          dataSource: 'epf',
          sourceAccountNumber: epf.epfAccountNumber,
          metadata: {
            employerName: epf.employerName,
            memberName: epf.memberName,
            interestRate: epf.interestRate,
            isActive: epf.isActive
          }
        });
      }

      // PPF Holdings
      const ppfHoldings = await db.select().from(schema.ppfHoldings).where(eq(schema.ppfHoldings.userId, userId));
      for (const ppf of ppfHoldings) {
        holdings.push({
          symbol: ppf.ppfAccountNumber,
          assetName: `PPF - ${ppf.bankName}`,
          assetType: 'government_scheme',
          assetClass: 'ppf',
          marketValue: Number(ppf.totalBalance || 0),
          dataSource: 'ppf',
          sourceAccountNumber: ppf.ppfAccountNumber,
          metadata: {
            bankName: ppf.bankName,
            accountHolderName: ppf.accountHolderName,
            maturityDate: ppf.maturityDate,
            interestRate: ppf.currentInterestRate
          }
        });
      }

      // EPS Holdings
      const epsHoldings = await db.select().from(schema.epsHoldings).where(eq(schema.epsHoldings.userId, userId));
      for (const eps of epsHoldings) {
        holdings.push({
          symbol: eps.pensionAccountNumber,
          assetName: `EPS - ${eps.currentEmployer}`,
          assetType: 'government_scheme',
          assetClass: 'eps',
          marketValue: Number(eps.accumulatedPension || 0),
          dataSource: 'eps',
          sourceAccountNumber: eps.pensionAccountNumber,
          metadata: {
            currentEmployer: eps.currentEmployer,
            serviceYears: eps.totalServiceYears,
            estimatedMonthlyPension: eps.estimatedMonthlyPension,
            isVested: eps.isVested
          }
        });
      }

    } catch (error) {
      console.error('Error fetching government scheme holdings:', error);
    }

    return holdings;
  }

  /**
   * Populate insurance holdings
   */
  private async populateInsuranceHoldings(userId: string, date: string): Promise<PopulatedHolding[]> {
    const holdings: PopulatedHolding[] = [];

    try {
      const insuranceHoldings = await db.select().from(schema.insuranceHoldings).where(eq(schema.insuranceHoldings.userId, userId));
      
      for (const insurance of insuranceHoldings) {
        holdings.push({
          symbol: insurance.policyNumber,
          assetName: `${insurance.policyType} - ${insurance.insuranceCompany}`,
          assetType: 'insurance',
          assetClass: insurance.policyType || 'insurance',
          marketValue: Number(insurance.currentValue || insurance.sumAssured || 0),
          dataSource: 'insurance',
          sourceAccountNumber: insurance.policyNumber,
          metadata: {
            insuranceCompany: insurance.insuranceCompany,
            sumAssured: insurance.sumAssured,
            premiumAmount: insurance.premiumAmount,
            premiumFrequency: insurance.premiumFrequency,
            policyType: insurance.policyType
          }
        });
      }

    } catch (error) {
      console.error('Error fetching insurance holdings:', error);
    }

    return holdings;
  }

  /**
   * Create portfolio snapshot
   */
  private async createPortfolioSnapshot(snapshotData: any) {
    const [snapshot] = await db.insert(schema.portfolioSnapshots).values(snapshotData).returning();
    return snapshot;
  }

  /**
   * Save comprehensive holdings
   */
  private async saveComprehensiveHoldings(portfolioId: string, snapshotId: string, userId: string, date: string, holdings: PopulatedHolding[]) {
    const comprehensiveHoldings = holdings.map(holding => ({
      portfolioId,
      snapshotId,
      userId,
      holdingDate: date,
      symbol: holding.symbol,
      assetName: holding.assetName,
      assetType: holding.assetType,
      assetClass: holding.assetClass,
      quantity: holding.quantity ? holding.quantity.toString() : null,
      units: holding.units ? holding.units.toString() : null,
      currentPrice: holding.currentPrice ? holding.currentPrice.toString() : null,
      marketValue: holding.marketValue.toString(),
      investedValue: holding.investedValue ? holding.investedValue.toString() : null,
      gainLoss: holding.gainLoss ? holding.gainLoss.toString() : null,
      gainLossPercent: holding.gainLossPercent ? holding.gainLossPercent.toString() : null,
      dataSource: holding.dataSource,
      sourceAccountNumber: holding.sourceAccountNumber,
      folio: holding.folio,
      dematAccountNumber: holding.dematAccountNumber,
      metadata: holding.metadata
    }));

    // Delete existing holdings for this date
    await db.delete(schema.comprehensiveHoldings)
      .where(and(
        eq(schema.comprehensiveHoldings.portfolioId, portfolioId),
        eq(schema.comprehensiveHoldings.holdingDate, date)
      ));

    // Insert new holdings
    if (comprehensiveHoldings.length > 0) {
      await db.insert(schema.comprehensiveHoldings).values(comprehensiveHoldings);
    }
  }

  /**
   * Get comprehensive portfolio by date
   */
  async getComprehensivePortfolio(portfolioId: string, date: string): Promise<ConsolidatedPortfolio | null> {
    try {
      // Get snapshot
      const snapshots = await db.select().from(schema.portfolioSnapshots)
        .where(and(
          eq(schema.portfolioSnapshots.portfolioId, portfolioId),
          eq(schema.portfolioSnapshots.snapshotDate, date)
        ))
        .limit(1);

      if (snapshots.length === 0) {
        return null;
      }

      const snapshot = snapshots[0];

      // Get holdings
      const holdings = await db.select().from(schema.comprehensiveHoldings)
        .where(and(
          eq(schema.comprehensiveHoldings.portfolioId, portfolioId),
          eq(schema.comprehensiveHoldings.holdingDate, date)
        ));

      const populatedHoldings: PopulatedHolding[] = holdings.map(h => ({
        symbol: h.symbol,
        assetName: h.assetName,
        assetType: h.assetType,
        assetClass: h.assetClass || 'other',
        quantity: h.quantity ? Number(h.quantity) : undefined,
        units: h.units ? Number(h.units) : undefined,
        currentPrice: h.currentPrice ? Number(h.currentPrice) : undefined,
        marketValue: Number(h.marketValue),
        investedValue: h.investedValue ? Number(h.investedValue) : undefined,
        gainLoss: h.gainLoss ? Number(h.gainLoss) : undefined,
        gainLossPercent: h.gainLossPercent ? Number(h.gainLossPercent) : undefined,
        dataSource: h.dataSource,
        sourceAccountNumber: h.sourceAccountNumber,
        folio: h.folio,
        dematAccountNumber: h.dematAccountNumber,
        metadata: h.metadata
      }));

      return {
        portfolioId: snapshot.portfolioId,
        userId: snapshot.userId,
        snapshotDate: snapshot.snapshotDate,
        totalValue: Number(snapshot.totalValue || 0),
        totalEquityValue: Number(snapshot.totalEquityValue || 0),
        totalDebtValue: Number(snapshot.totalDebtValue || 0),
        totalMutualFundValue: Number(snapshot.totalMutualFundValue || 0),
        totalGovernmentSchemeValue: Number(snapshot.totalGovernmentSchemeValue || 0),
        totalAlternativeValue: Number(snapshot.totalAlternativeValue || 0),
        totalCashValue: Number(snapshot.totalCashValue || 0),
        epfValue: Number(snapshot.epfValue || 0),
        ppfValue: Number(snapshot.ppfValue || 0),
        epsValue: Number(snapshot.epsValue || 0),
        apyValue: Number(snapshot.apyValue || 0),
        npsValue: Number(snapshot.npsValue || 0),
        insuranceValue: Number(snapshot.insuranceValue || 0),
        holdings: populatedHoldings,
        assetBreakdown: {
          equities: Number(snapshot.totalEquityValue || 0),
          mutualFunds: Number(snapshot.totalMutualFundValue || 0),
          governmentSchemes: Number(snapshot.totalGovernmentSchemeValue || 0),
          debt: Number(snapshot.totalDebtValue || 0),
          alternatives: Number(snapshot.totalAlternativeValue || 0),
          cash: Number(snapshot.totalCashValue || 0),
          insurance: Number(snapshot.insuranceValue || 0)
        }
      };

    } catch (error) {
      console.error('Error getting comprehensive portfolio:', error);
      return null;
    }
  }

  /**
   * Helper methods
   */
  private calculateTotalValue(holdings: PopulatedHolding[]): number {
    return holdings.reduce((total, holding) => total + holding.marketValue, 0);
  }

  private getMutualFundAssetClass(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes('large cap') || name.includes('bluechip')) return 'large_cap';
    if (name.includes('mid cap')) return 'mid_cap';
    if (name.includes('small cap')) return 'small_cap';
    if (name.includes('debt') || name.includes('bond')) return 'debt';
    if (name.includes('hybrid') || name.includes('balanced')) return 'hybrid';
    return 'equity';
  }

  private getDataSourcesUsed(holdings: PopulatedHolding[]): string[] {
    const sources = new Set(holdings.map(h => h.dataSource));
    return Array.from(sources);
  }
}

export default ComprehensivePortfolioService;