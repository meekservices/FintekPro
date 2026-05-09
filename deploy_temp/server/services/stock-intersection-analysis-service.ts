import { db } from "../db";
import { stockIntersectionAnalysis } from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { mfSchemeHoldingsService } from "./mf-scheme-holdings-service";

interface PortfolioFund {
  mfIsin: string;
  name: string;
  portfolioWeight: number;
  currentValue?: number;
}

interface StockOverlap {
  stock: string;
  stockIsin?: string;
  sector?: string;
  fundCount: number;
  totalExposure: number;
  riskFlag: 'HIGH' | 'MEDIUM' | 'LOW';
  funds: Array<{
    isin: string;
    name: string;
    contribution: number;
    portfolioWeight: number;
  }>;
}

interface SectorConcentration {
  sector: string;
  exposure: number;
  stockCount: number;
  topStocks: string[];
  riskFlag: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface IntersectionAnalysisResult {
  totalFundsAnalyzed: number;
  totalStocksFound: number;
  overlappingStocksCount: number;
  highRiskStocksCount: number;
  mediumRiskStocksCount: number;
  stockOverlaps: StockOverlap[];
  sectorConcentration: SectorConcentration[];
  diversificationScore: number;
  topOverlappingStocks: StockOverlap[];
  warnings: string[];
}

class StockIntersectionAnalysisService {
  private static instance: StockIntersectionAnalysisService;
  private cache = new Map<string, { data: IntersectionAnalysisResult; timestamp: number }>();
  private CACHE_TTL = 5 * 60 * 1000;

  static getInstance(): StockIntersectionAnalysisService {
    if (!StockIntersectionAnalysisService.instance) {
      StockIntersectionAnalysisService.instance = new StockIntersectionAnalysisService();
    }
    return StockIntersectionAnalysisService.instance;
  }

  private getRiskFlag(exposure: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (exposure > 10) return 'HIGH';
    if (exposure >= 5) return 'MEDIUM';
    return 'LOW';
  }

  private calculateDiversificationScore(overlaps: StockOverlap[], totalStocks: number): number {
    if (totalStocks === 0) return 100;

    const highRiskCount = overlaps.filter(o => o.riskFlag === 'HIGH').length;
    const mediumRiskCount = overlaps.filter(o => o.riskFlag === 'MEDIUM').length;
    const overlapRatio = overlaps.length / totalStocks;

    let score = 100;
    score -= highRiskCount * 10;
    score -= mediumRiskCount * 5;
    score -= overlapRatio * 20;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async analyzePortfolio(funds: PortfolioFund[]): Promise<IntersectionAnalysisResult> {
    const cacheKey = funds.map(f => `${f.mfIsin}:${f.portfolioWeight}`).sort().join('|');
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const mfIsins = funds.map(f => f.mfIsin);
    const holdingsMap = await mfSchemeHoldingsService.getHoldingsForMultipleSchemes(mfIsins);

    const stockExposures = new Map<string, {
      sector?: string;
      stockIsin?: string;
      funds: Array<{ isin: string; name: string; contribution: number; portfolioWeight: number }>;
      totalExposure: number;
    }>();

    const allStocks = new Set<string>();
    const fundsWithHoldings: string[] = [];

    for (const fund of funds) {
      const holdings = holdingsMap.get(fund.mfIsin);
      if (!holdings || holdings.length === 0) continue;

      fundsWithHoldings.push(fund.mfIsin);

      for (const holding of holdings) {
        allStocks.add(holding.stockSymbol);

        const contribution = (fund.portfolioWeight / 100) * (holding.holdingPercentage / 100) * 100;

        const existing = stockExposures.get(holding.stockSymbol) || {
          sector: holding.sector,
          stockIsin: holding.stockIsin,
          funds: [],
          totalExposure: 0,
        };

        existing.funds.push({
          isin: fund.mfIsin,
          name: fund.name,
          contribution: Math.round(contribution * 100) / 100,
          portfolioWeight: fund.portfolioWeight,
        });
        existing.totalExposure += contribution;

        if (holding.sector && !existing.sector) {
          existing.sector = holding.sector;
        }
        if (holding.stockIsin && !existing.stockIsin) {
          existing.stockIsin = holding.stockIsin;
        }

        stockExposures.set(holding.stockSymbol, existing);
      }
    }

    const overlappingStocks: StockOverlap[] = [];

    for (const [stock, data] of stockExposures.entries()) {
      if (data.funds.length >= 2) {
        overlappingStocks.push({
          stock,
          stockIsin: data.stockIsin,
          sector: data.sector,
          fundCount: data.funds.length,
          totalExposure: Math.round(data.totalExposure * 100) / 100,
          riskFlag: this.getRiskFlag(data.totalExposure),
          funds: data.funds.sort((a, b) => b.contribution - a.contribution),
        });
      }
    }

    overlappingStocks.sort((a, b) => b.totalExposure - a.totalExposure);

    const sectorExposures = new Map<string, { exposure: number; stocks: Set<string> }>();

    for (const overlap of overlappingStocks) {
      const sector = overlap.sector || 'Unknown';
      const existing = sectorExposures.get(sector) || { exposure: 0, stocks: new Set() };
      existing.exposure += overlap.totalExposure;
      existing.stocks.add(overlap.stock);
      sectorExposures.set(sector, existing);
    }

    const sectorConcentration: SectorConcentration[] = [];

    for (const [sector, data] of sectorExposures.entries()) {
      const stocks = Array.from(data.stocks);
      const topStocksForSector = overlappingStocks
        .filter(o => (o.sector || 'Unknown') === sector)
        .sort((a, b) => b.totalExposure - a.totalExposure)
        .slice(0, 5)
        .map(o => o.stock);

      sectorConcentration.push({
        sector,
        exposure: Math.round(data.exposure * 100) / 100,
        stockCount: stocks.length,
        topStocks: topStocksForSector,
        riskFlag: this.getRiskFlag(data.exposure),
      });
    }

    sectorConcentration.sort((a, b) => b.exposure - a.exposure);

    const highRiskStocks = overlappingStocks.filter(o => o.riskFlag === 'HIGH');
    const mediumRiskStocks = overlappingStocks.filter(o => o.riskFlag === 'MEDIUM');

    const diversificationScore = this.calculateDiversificationScore(overlappingStocks, allStocks.size);

    const warnings: string[] = [];

    if (highRiskStocks.length > 0) {
      warnings.push(`Portfolio shows high concentration in ${highRiskStocks.length} stock(s) across multiple funds. Top: ${highRiskStocks.slice(0, 3).map(s => s.stock).join(', ')}`);
    }

    const highRiskSectors = sectorConcentration.filter(s => s.riskFlag === 'HIGH');
    if (highRiskSectors.length > 0) {
      warnings.push(`Sector concentration warning: ${highRiskSectors.map(s => s.sector).join(', ')}`);
    }

    if (fundsWithHoldings.length < funds.length) {
      const missingCount = funds.length - fundsWithHoldings.length;
      warnings.push(`Holdings data unavailable for ${missingCount} fund(s). Analysis may be incomplete.`);
    }

    const result: IntersectionAnalysisResult = {
      totalFundsAnalyzed: fundsWithHoldings.length,
      totalStocksFound: allStocks.size,
      overlappingStocksCount: overlappingStocks.length,
      highRiskStocksCount: highRiskStocks.length,
      mediumRiskStocksCount: mediumRiskStocks.length,
      stockOverlaps: overlappingStocks,
      sectorConcentration,
      diversificationScore,
      topOverlappingStocks: overlappingStocks.slice(0, 10),
      warnings,
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  }

  async saveAnalysis(
    result: IntersectionAnalysisResult,
    options: { portfolioId?: string; prospectId?: string; userId?: string }
  ): Promise<string> {
    const [inserted] = await db.insert(stockIntersectionAnalysis).values({
      portfolioId: options.portfolioId,
      prospectId: options.prospectId,
      userId: options.userId,
      totalFundsAnalyzed: result.totalFundsAnalyzed,
      totalStocksFound: result.totalStocksFound,
      overlappingStocksCount: result.overlappingStocksCount,
      highRiskStocksCount: result.highRiskStocksCount,
      mediumRiskStocksCount: result.mediumRiskStocksCount,
      stockOverlaps: result.stockOverlaps as any,
      sectorConcentration: result.sectorConcentration as any,
      diversificationScore: String(result.diversificationScore),
    }).returning({ id: stockIntersectionAnalysis.id });

    return inserted.id;
  }

  async getLatestAnalysis(options: { portfolioId?: string; prospectId?: string; userId?: string }): Promise<IntersectionAnalysisResult | null> {
    let query = db.select().from(stockIntersectionAnalysis);

    if (options.prospectId) {
      query = query.where(eq(stockIntersectionAnalysis.prospectId, options.prospectId)) as any;
    } else if (options.portfolioId) {
      query = query.where(eq(stockIntersectionAnalysis.portfolioId, options.portfolioId)) as any;
    } else if (options.userId) {
      query = query.where(eq(stockIntersectionAnalysis.userId, options.userId)) as any;
    }

    const results = await (query as any).orderBy(desc(stockIntersectionAnalysis.analysisDate)).limit(1);

    if (results.length === 0) return null;

    const row = results[0];

    return {
      totalFundsAnalyzed: row.totalFundsAnalyzed || 0,
      totalStocksFound: row.totalStocksFound || 0,
      overlappingStocksCount: row.overlappingStocksCount || 0,
      highRiskStocksCount: row.highRiskStocksCount || 0,
      mediumRiskStocksCount: row.mediumRiskStocksCount || 0,
      stockOverlaps: (row.stockOverlaps as StockOverlap[]) || [],
      sectorConcentration: (row.sectorConcentration as SectorConcentration[]) || [],
      diversificationScore: parseFloat(String(row.diversificationScore)) || 0,
      topOverlappingStocks: ((row.stockOverlaps as StockOverlap[]) || []).slice(0, 10),
      warnings: [],
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[StockIntersection] Cache cleared');
  }
}

export const stockIntersectionAnalysisService = StockIntersectionAnalysisService.getInstance();
