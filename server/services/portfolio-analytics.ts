/**
 * Portfolio Analytics Service
 * 
 * Aggregates holdings from all 8 data sources and provides comprehensive analytics:
 * - Portfolio-level XIRR, IRR, CAGR
 * - Asset allocation analysis
 * - Risk profiling
 * - Category-wise performance
 */

import { db } from '../db';
import { 
  comprehensiveHoldings, 
  epfHoldings, 
  npsAccounts, 
  apyAccounts,
  userBankAccounts,
  insuranceHoldings,
  usHoldings
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { FinancialCalculations, CashFlow, XIRRResult, CAGRResult } from './financial-calculations';
import { getEnrichedStockSnapshot, getEnrichedStockSnapshots } from './screener/enriched-stock-data';

interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  absoluteReturns: number;
  absoluteReturnsPercentage: number;
  xirr: XIRRResult | null;
  assetAllocation: AssetAllocation;
  categoryPerformance: CategoryPerformance[];
  riskProfile: RiskProfile;
}

interface AssetAllocation {
  equity: AllocationItem;
  internationalEquity: AllocationItem;
  debt: AllocationItem;
  gold: AllocationItem;
  realEstate: AllocationItem;
  retirement: AllocationItem;
  cash: AllocationItem;
  insurance: AllocationItem;
  total: number;
}

interface AllocationItem {
  value: number;
  percentage: number;
  count: number; // Number of holdings
}

interface CategoryPerformance {
  category: string;
  invested: number;
  currentValue: number;
  returns: number;
  returnsPercentage: number;
  xirr?: number;
  cagr?: CAGRResult;
}

interface RiskProfile {
  score: number; // 0-100
  classification: 'Conservative' | 'Moderate' | 'Aggressive' | 'Very Aggressive';
  equityExposure: number;
  debtExposure: number;
  recommendation: string;
}

interface EnrichedHoldingMetrics {
  fundamentalHealth: number | null;
  valuationGap: number | null;
  growthOutlook: number | null;
}

interface EnrichedPortfolioMetrics {
  avgPE: number | null;
  avgROE: number | null;
  avgROIC: number | null;
  avgDCFUpside: number | null;
  holdingEnrichments: Record<string, EnrichedHoldingMetrics>;
}

export class PortfolioAnalytics {
  /**
   * Get comprehensive portfolio analytics for a user
   */
  static async getPortfolioAnalytics(userId: string): Promise<PortfolioSummary> {
    // Fetch all holdings from different sources
    const [
      mfAndDematHoldings,
      epfData,
      npsData,
      apyData,
      bankData,
      insuranceData,
      usEquityData
    ] = await Promise.all([
      db.select().from(comprehensiveHoldings).where(eq(comprehensiveHoldings.userId, userId)),
      db.select().from(epfHoldings).where(eq(epfHoldings.userId, userId)),
      db.select().from(npsAccounts).where(eq(npsAccounts.userId, userId)),
      db.select().from(apyAccounts).where(eq(apyAccounts.userId, userId)),
      db.select().from(userBankAccounts).where(eq(userBankAccounts.userId, userId)),
      db.select().from(insuranceHoldings).where(eq(insuranceHoldings.userId, userId)),
      db.select().from(usHoldings).where(eq(usHoldings.clientId, userId))
    ]);

    // Calculate totals
    let totalInvested = 0;
    let currentValue = 0;
    const allCashFlows: CashFlow[] = [];

    // Asset allocation tracking
    const allocation = {
      equity: 0,
      internationalEquity: 0,
      debt: 0,
      gold: 0,
      realEstate: 0,
      retirement: 0,
      cash: 0,
      insurance: 0
    };

    const counts = {
      equity: 0,
      internationalEquity: 0,
      debt: 0,
      gold: 0,
      realEstate: 0,
      retirement: 0,
      cash: 0,
      insurance: 0
    };

    // Process MF and Demat holdings
    for (const holding of mfAndDematHoldings) {
      const invested = parseFloat(holding.investedValue || '0');
      const current = parseFloat(holding.marketValue || '0');
      
      totalInvested += invested;
      currentValue += current;

      // Add to asset allocation
      const assetClass = this.mapAssetClass(holding.assetClass);
      allocation[assetClass] += current;
      counts[assetClass]++;

      // Generate cash flows for XIRR (simplified - using holding date)
      if (holding.holdingDate && invested > 0) {
        allCashFlows.push({
          date: new Date(holding.holdingDate),
          amount: -invested
        });
      }
    }

    // Process EPF holdings
    for (const epf of epfData) {
      const balance = parseFloat(epf.totalBalance || '0');
      const employeeContrib = parseFloat(epf.employeeContribution || '0');
      
      currentValue += balance;
      totalInvested += employeeContrib;
      allocation.retirement += balance;
      counts.retirement++;

      // EPF cash flows (simplified)
      if (epf.dateOfJoining) {
        allCashFlows.push({
          date: new Date(epf.dateOfJoining),
          amount: -employeeContrib
        });
      }
    }

    // Process NPS accounts
    for (const nps of npsData) {
      const balance = parseFloat(nps.totalBalance || '0');
      const contributions = parseFloat(nps.totalContributions || '0');
      
      currentValue += balance;
      totalInvested += contributions;
      allocation.retirement += balance;
      counts.retirement++;

      if (nps.registrationDate) {
        allCashFlows.push({
          date: new Date(nps.registrationDate),
          amount: -contributions
        });
      }
    }

    // Process APY accounts
    for (const apy of apyData) {
      const balance = parseFloat(apy.totalBalance || '0');
      const contributions = parseFloat(apy.totalContribution || '0');
      
      currentValue += balance;
      totalInvested += contributions;
      allocation.retirement += balance;
      counts.retirement++;

      if (apy.enrollmentDate) {
        allCashFlows.push({
          date: new Date(apy.enrollmentDate),
          amount: -contributions
        });
      }
    }

    // Process Bank accounts (balance data from Account Aggregator not stored in userBankAccounts)
    // Bank account balances would be fetched separately via Account Aggregator
    // For now, we track count only
    counts.cash += bankData.length;

    // Process Insurance (stored but not included in portfolio value calculation)
    for (const insurance of insuranceData) {
      // Insurance is coverage, not investment - tracked separately
      counts.insurance++;
    }

    // Process US Equity holdings (international diversification)
    for (const usHolding of usEquityData) {
      const marketValueInr = parseFloat(usHolding.marketValueInr || '0');
      const quantity = parseFloat(usHolding.quantity || '0');
      const avgPriceUsd = parseFloat(usHolding.avgPriceUsd || '0');
      // Use FX rate at time of purchase for accurate cost basis, fallback to current rate
      const fxRateAtBuy = parseFloat(usHolding.fxRateAtBuy || usHolding.currentFxRate || '0');
      const investedInr = avgPriceUsd * quantity * fxRateAtBuy;
      
      currentValue += marketValueInr;
      totalInvested += investedInr;
      allocation.internationalEquity += marketValueInr;
      counts.internationalEquity++;

      // Cash flows for XIRR (using first purchase date)
      if (usHolding.createdAt && investedInr > 0) {
        allCashFlows.push({
          date: new Date(usHolding.createdAt),
          amount: -investedInr
        });
      }
    }

    // Add current value as final cash flow for XIRR
    allCashFlows.push({
      date: new Date(),
      amount: currentValue
    });

    // Calculate XIRR
    const xirr = allCashFlows.length >= 2 
      ? FinancialCalculations.calculateXIRR(allCashFlows)
      : null;

    // Calculate absolute returns
    const absoluteReturns = currentValue - totalInvested;
    const absoluteReturnsPercentage = totalInvested > 0 
      ? (absoluteReturns / totalInvested) * 100 
      : 0;

    // Build asset allocation
    const totalValue = currentValue > 0 ? currentValue : 1; // Prevent division by zero
    const assetAllocation: AssetAllocation = {
      equity: {
        value: allocation.equity,
        percentage: parseFloat(((allocation.equity / totalValue) * 100).toFixed(2)),
        count: counts.equity
      },
      internationalEquity: {
        value: allocation.internationalEquity,
        percentage: parseFloat(((allocation.internationalEquity / totalValue) * 100).toFixed(2)),
        count: counts.internationalEquity
      },
      debt: {
        value: allocation.debt,
        percentage: parseFloat(((allocation.debt / totalValue) * 100).toFixed(2)),
        count: counts.debt
      },
      gold: {
        value: allocation.gold,
        percentage: parseFloat(((allocation.gold / totalValue) * 100).toFixed(2)),
        count: counts.gold
      },
      realEstate: {
        value: allocation.realEstate,
        percentage: parseFloat(((allocation.realEstate / totalValue) * 100).toFixed(2)),
        count: counts.realEstate
      },
      retirement: {
        value: allocation.retirement,
        percentage: parseFloat(((allocation.retirement / totalValue) * 100).toFixed(2)),
        count: counts.retirement
      },
      cash: {
        value: allocation.cash,
        percentage: parseFloat(((allocation.cash / totalValue) * 100).toFixed(2)),
        count: counts.cash
      },
      insurance: {
        value: allocation.insurance,
        percentage: parseFloat(((allocation.insurance / totalValue) * 100).toFixed(2)),
        count: counts.insurance
      },
      total: currentValue
    };

    // Calculate category performance
    const categoryPerformance = this.calculateCategoryPerformance(
      mfAndDematHoldings,
      epfData,
      npsData,
      apyData
    );

    // Calculate risk profile
    const riskProfile = this.calculateRiskProfile(assetAllocation);

    return {
      totalInvested,
      currentValue,
      absoluteReturns,
      absoluteReturnsPercentage: parseFloat(absoluteReturnsPercentage.toFixed(2)),
      xirr,
      assetAllocation,
      categoryPerformance,
      riskProfile
    };
  }

  static async getEnrichedPortfolioMetrics(userId: string): Promise<EnrichedPortfolioMetrics | null> {
    try {
      const mfAndDematHoldings = await db.select().from(comprehensiveHoldings).where(eq(comprehensiveHoldings.userId, userId));

      const stockSymbols = mfAndDematHoldings
        .filter(h => h.symbol && (h.assetClass === 'equity' || h.assetClass === 'Equity'))
        .map(h => h.symbol as string)
        .filter(Boolean);

      if (stockSymbols.length === 0) {
        return null;
      }

      const uniqueSymbols = [...new Set(stockSymbols)];
      const snapshots = await getEnrichedStockSnapshots(uniqueSymbols);

      if (snapshots.size === 0) {
        return null;
      }

      const holdingEnrichments: Record<string, EnrichedHoldingMetrics> = {};
      const peValues: number[] = [];
      const roeValues: number[] = [];
      const roicValues: number[] = [];
      const dcfUpsideValues: number[] = [];

      for (const symbol of uniqueSymbols) {
        const snapshot = snapshots.get(symbol.toUpperCase());
        if (!snapshot) continue;

        const fundamentalHealth = snapshot.derivedMetrics?.qualityScore ?? null;
        const valuationGap = snapshot.dcf?.upsidePercent ?? null;
        const growthOutlook = snapshot.derivedMetrics?.growthScore ?? null;

        holdingEnrichments[symbol] = { fundamentalHealth, valuationGap, growthOutlook };

        if (snapshot.fundamentals?.peRatio != null) peValues.push(snapshot.fundamentals.peRatio);
        if (snapshot.fundamentals?.roe != null) roeValues.push(snapshot.fundamentals.roe);
        if (snapshot.fundamentals?.roic != null) roicValues.push(snapshot.fundamentals.roic);
        if (snapshot.dcf?.upsidePercent != null) dcfUpsideValues.push(snapshot.dcf.upsidePercent);
      }

      const avg = (arr: number[]) => arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

      return {
        avgPE: avg(peValues),
        avgROE: avg(roeValues),
        avgROIC: avg(roicValues),
        avgDCFUpside: avg(dcfUpsideValues),
        holdingEnrichments,
      };
    } catch (error: any) {
      console.error(`[PortfolioAnalytics] Failed to fetch enriched metrics for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Map asset class from holdings to allocation categories
   */
  private static mapAssetClass(assetClass: string | null): keyof typeof allocation {
    const mapping: { [key: string]: keyof typeof allocation } = {
      'equity': 'equity',
      'debt': 'debt',
      'hybrid': 'debt', // Hybrid treated as debt for simplification
      'gold': 'gold',
      'real_estate': 'realEstate',
      'commodity': 'gold'
    };

    return mapping[assetClass?.toLowerCase() || ''] || 'equity';
  }

  /**
   * Calculate performance by category
   */
  private static calculateCategoryPerformance(
    mfAndDemat: any[],
    epf: any[],
    nps: any[],
    apy: any[]
  ): CategoryPerformance[] {
    const categories: { [key: string]: { invested: number; current: number; holdings: any[] } } = {};

    // Group MF and Demat by asset class
    for (const holding of mfAndDemat) {
      const category = holding.assetClass || 'Other';
      if (!categories[category]) {
        categories[category] = { invested: 0, current: 0, holdings: [] };
      }
      categories[category].invested += parseFloat(holding.investedValue || '0');
      categories[category].current += parseFloat(holding.marketValue || '0');
      categories[category].holdings.push(holding);
    }

    // Add retirement categories
    if (epf.length > 0) {
      categories['EPF'] = {
        invested: epf.reduce((sum, e) => sum + parseFloat(e.employeeContribution || '0'), 0),
        current: epf.reduce((sum, e) => sum + parseFloat(e.totalBalance || '0'), 0),
        holdings: epf
      };
    }

    if (nps.length > 0) {
      categories['NPS'] = {
        invested: nps.reduce((sum, n) => sum + parseFloat(n.totalContributions || '0'), 0),
        current: nps.reduce((sum, n) => sum + parseFloat(n.totalBalance || '0'), 0),
        holdings: nps
      };
    }

    if (apy.length > 0) {
      categories['APY'] = {
        invested: apy.reduce((sum, a) => sum + parseFloat(a.totalContribution || '0'), 0),
        current: apy.reduce((sum, a) => sum + parseFloat(a.totalBalance || '0'), 0),
        holdings: apy
      };
    }

    // Convert to performance array
    return Object.entries(categories).map(([category, data]) => {
      const returns = data.current - data.invested;
      const returnsPercentage = data.invested > 0 ? (returns / data.invested) * 100 : 0;

      return {
        category,
        invested: data.invested,
        currentValue: data.current,
        returns,
        returnsPercentage: parseFloat(returnsPercentage.toFixed(2))
      };
    });
  }

  /**
   * Calculate risk profile based on asset allocation
   */
  private static calculateRiskProfile(allocation: AssetAllocation): RiskProfile {
    // Total equity includes both domestic and international equity
    const equityPercentage = allocation.equity.percentage + allocation.internationalEquity.percentage;
    const debtPercentage = allocation.debt.percentage + allocation.cash.percentage;
    
    // Risk score: 0-100 based on total equity exposure
    const score = Math.round(equityPercentage);

    let classification: RiskProfile['classification'];
    let recommendation: string;

    if (score < 25) {
      classification = 'Conservative';
      recommendation = 'Your portfolio is heavily weighted towards debt and cash. Consider adding equity exposure for higher long-term growth potential.';
    } else if (score < 50) {
      classification = 'Moderate';
      recommendation = 'Balanced portfolio with moderate risk. Good mix of equity and debt for steady growth with managed volatility.';
    } else if (score < 75) {
      classification = 'Aggressive';
      recommendation = 'High equity exposure indicates aggressive growth strategy. Ensure you have adequate emergency funds and insurance coverage.';
    } else {
      classification = 'Very Aggressive';
      recommendation = 'Very high equity concentration. Consider rebalancing to reduce portfolio volatility and protect against market downturns.';
    }

    return {
      score,
      classification,
      equityExposure: equityPercentage,
      debtExposure: debtPercentage,
      recommendation
    };
  }
}

export type { 
  PortfolioSummary, 
  AssetAllocation, 
  AllocationItem, 
  CategoryPerformance, 
  RiskProfile,
  EnrichedHoldingMetrics,
  EnrichedPortfolioMetrics
};

// Fix for allocation type error
const allocation = {
  equity: 0,
  debt: 0,
  gold: 0,
  realEstate: 0,
  retirement: 0,
  cash: 0,
  insurance: 0
};
