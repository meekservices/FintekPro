import { db } from "../db";
import {
	stockIntersectionAnalysis,
	portfolios,
	portfolioHoldings,
	modelPortfolios,
	modelPortfolioHoldings,
} from "../../shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { mfSchemeHoldingsService } from "./mf-scheme-holdings-service";
import { twoTierCacheService } from "./two-tier-cache-service";

export interface PortfolioFund {
	mfIsin: string;
	name: string;
	portfolioWeight: number;
	currentValue?: number;
}

export interface SimulationImpact {
	scoreDelta: number;
	newOverlappingStocks: StockOverlap[];
	elevatedRiskStocks: StockOverlap[];
	recommendation:
		| "DIVERSIFICATION_SAFE"
		| "MODERATE_OVERLAP_PENALTY"
		| "HIGH_CONCENTRATION_RISK";
	summary: string;
}

export interface SchemeComparisonResult {
	schemeA: string;
	schemeB: string;
	overlapPercentage: number;
	commonStocksCount: number;
	commonStocks: Array<{
		stock: string;
		stockIsin?: string;
		sector?: string;
		weightInA: number;
		weightInB: number;
		minWeight: number;
	}>;
	isBreach: boolean;
	maxAllowedThreshold: number;
	engineVersion: string;
	timestamp: string;
}

interface StockOverlap {
	stock: string;
	stockIsin?: string;
	sector?: string;
	fundCount: number;
	totalExposure: number;
	riskFlag: "HIGH" | "MEDIUM" | "LOW";
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
	riskFlag: "HIGH" | "MEDIUM" | "LOW";
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
	private cache = new Map<
		string,
		{ data: IntersectionAnalysisResult; timestamp: number }
	>();
	private CACHE_TTL = 5 * 60 * 1000;

	static getInstance(): StockIntersectionAnalysisService {
		if (!StockIntersectionAnalysisService.instance) {
			StockIntersectionAnalysisService.instance =
				new StockIntersectionAnalysisService();
		}
		return StockIntersectionAnalysisService.instance;
	}

	private getRiskFlag(exposure: number): "HIGH" | "MEDIUM" | "LOW" {
		if (exposure > 10) return "HIGH";
		if (exposure >= 5) return "MEDIUM";
		return "LOW";
	}

	private calculateDiversificationScore(
		overlaps: StockOverlap[],
		totalStocks: number,
	): number {
		if (totalStocks === 0) return 100;

		const highRiskCount = overlaps.filter((o) => o.riskFlag === "HIGH").length;
		const mediumRiskCount = overlaps.filter(
			(o) => o.riskFlag === "MEDIUM",
		).length;
		const overlapRatio = overlaps.length / totalStocks;

		let score = 100;
		score -= highRiskCount * 10;
		score -= mediumRiskCount * 5;
		score -= overlapRatio * 20;

		return Math.max(0, Math.min(100, Math.round(score)));
	}

	async analyzePortfolio(
		funds: PortfolioFund[],
	): Promise<IntersectionAnalysisResult> {
		const cacheKey = `mf_overlap:${funds
			.map((f) => `${f.mfIsin}:${f.portfolioWeight}`)
			.sort()
			.join("|")}`;
		const cached = await twoTierCacheService.get<IntersectionAnalysisResult>(cacheKey);

		if (cached) {
			return cached;
		}

		const mfIsins = funds.map((f) => f.mfIsin);
		const holdingsMap =
			await mfSchemeHoldingsService.getHoldingsForMultipleSchemes(mfIsins);

		const stockExposures = new Map<
			string,
			{
				sector?: string;
				stockIsin?: string;
				funds: Array<{
					isin: string;
					name: string;
					contribution: number;
					portfolioWeight: number;
				}>;
				totalExposure: number;
			}
		>();

		const allStocks = new Set<string>();
		const fundsWithHoldings: string[] = [];

		for (const fund of funds) {
			const holdings = holdingsMap.get(fund.mfIsin);
			if (!holdings || holdings.length === 0) continue;

			fundsWithHoldings.push(fund.mfIsin);

			for (const holding of holdings) {
				allStocks.add(holding.stockSymbol);

				const contribution =
					(fund.portfolioWeight / 100) *
					(holding.holdingPercentage / 100) *
					100;

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

		stockExposures.forEach((data, stock) => {
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
		});

		overlappingStocks.sort((a, b) => b.totalExposure - a.totalExposure);

		const sectorExposures = new Map<
			string,
			{ exposure: number; stocks: Set<string> }
		>();

		for (const overlap of overlappingStocks) {
			const sector = overlap.sector || "Unknown";
			const existing = sectorExposures.get(sector) || {
				exposure: 0,
				stocks: new Set(),
			};
			existing.exposure += overlap.totalExposure;
			existing.stocks.add(overlap.stock);
			sectorExposures.set(sector, existing);
		}

		const sectorConcentration: SectorConcentration[] = [];

		sectorExposures.forEach((data, sector) => {
			const stocks = Array.from(data.stocks);
			const topStocksForSector = overlappingStocks
				.filter((o) => (o.sector || "Unknown") === sector)
				.sort((a, b) => b.totalExposure - a.totalExposure)
				.slice(0, 5)
				.map((o) => o.stock);

			sectorConcentration.push({
				sector,
				exposure: Math.round(data.exposure * 100) / 100,
				stockCount: stocks.length,
				topStocks: topStocksForSector,
				riskFlag: this.getRiskFlag(data.exposure),
			});
		});

		sectorConcentration.sort((a, b) => b.exposure - a.exposure);

		const highRiskStocks = overlappingStocks.filter(
			(o) => o.riskFlag === "HIGH",
		);
		const mediumRiskStocks = overlappingStocks.filter(
			(o) => o.riskFlag === "MEDIUM",
		);

		const diversificationScore = this.calculateDiversificationScore(
			overlappingStocks,
			allStocks.size,
		);

		const warnings: string[] = [];

		if (highRiskStocks.length > 0) {
			warnings.push(
				`Portfolio shows high concentration in ${highRiskStocks.length} stock(s) across multiple funds. Top: ${highRiskStocks
					.slice(0, 3)
					.map((s) => s.stock)
					.join(", ")}`,
			);
		}

		const highRiskSectors = sectorConcentration.filter(
			(s) => s.riskFlag === "HIGH",
		);
		if (highRiskSectors.length > 0) {
			warnings.push(
				`Sector concentration warning: ${highRiskSectors.map((s) => s.sector).join(", ")}`,
			);
		}

		if (fundsWithHoldings.length < funds.length) {
			const missingCount = funds.length - fundsWithHoldings.length;
			warnings.push(
				`Holdings data unavailable for ${missingCount} fund(s). Analysis may be incomplete.`,
			);
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
		twoTierCacheService.set(cacheKey, result, 1800).catch(() => {});

		return result;
	}

	async saveAnalysis(
		result: IntersectionAnalysisResult,
		options: { portfolioId?: string; prospectId?: string; userId?: string },
	): Promise<string> {
		const [inserted] = await db
			.insert(stockIntersectionAnalysis)
			.values({
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
			})
			.returning({ id: stockIntersectionAnalysis.id });

		return inserted.id;
	}

	async getLatestAnalysis(options: {
		portfolioId?: string;
		prospectId?: string;
		userId?: string;
	}): Promise<IntersectionAnalysisResult | null> {
		let query = db.select().from(stockIntersectionAnalysis);

		if (options.prospectId) {
			query = query.where(
				eq(stockIntersectionAnalysis.prospectId, options.prospectId),
			) as any;
		} else if (options.portfolioId) {
			query = query.where(
				eq(stockIntersectionAnalysis.portfolioId, options.portfolioId),
			) as any;
		} else if (options.userId) {
			query = query.where(
				eq(stockIntersectionAnalysis.userId, options.userId),
			) as any;
		}

		const results = await (query as any)
			.orderBy(desc(stockIntersectionAnalysis.analysisDate))
			.limit(1);

		if (results.length === 0) return null;

		const row = results[0];

		return {
			totalFundsAnalyzed: row.totalFundsAnalyzed || 0,
			totalStocksFound: row.totalStocksFound || 0,
			overlappingStocksCount: row.overlappingStocksCount || 0,
			highRiskStocksCount: row.highRiskStocksCount || 0,
			mediumRiskStocksCount: row.mediumRiskStocksCount || 0,
			stockOverlaps: (row.stockOverlaps as StockOverlap[]) || [],
			sectorConcentration:
				(row.sectorConcentration as SectorConcentration[]) || [],
			diversificationScore:
				Number.parseFloat(String(row.diversificationScore)) || 0,
			topOverlappingStocks: ((row.stockOverlaps as StockOverlap[]) || []).slice(
				0,
				10,
			),
			warnings: [],
		};
	}

	clearCache(): void {
		this.cache.clear();
		twoTierCacheService.clear().catch(() => {});
		console.log("[StockIntersection] Local and Two-Tier cache cleared");
	}

	/**
	 * Analyzes an existing user portfolio by portfolioId
	 */
	async analyzeExistingPortfolio(
		portfolioId: string,
	): Promise<IntersectionAnalysisResult> {
		const [portfolio] = await db
			.select()
			.from(portfolios)
			.where(eq(portfolios.id, portfolioId))
			.limit(1);

		if (!portfolio) {
			throw new Error(`Portfolio not found with ID: ${portfolioId}`);
		}

		const holdings = await db
			.select()
			.from(portfolioHoldings)
			.where(eq(portfolioHoldings.portfolioId, portfolioId));

		const mfHoldingsList = holdings.filter((h) => {
			const assetType = (h.assetType || "").toLowerCase();
			const isin = (h.isin || "").toUpperCase();
			return (
				assetType.includes("mutual_fund") ||
				assetType.includes("mf") ||
				assetType.includes("fund") ||
				isin.startsWith("INF")
			);
		});

		if (mfHoldingsList.length === 0) {
			return {
				totalFundsAnalyzed: 0,
				totalStocksFound: 0,
				overlappingStocksCount: 0,
				highRiskStocksCount: 0,
				mediumRiskStocksCount: 0,
				stockOverlaps: [],
				sectorConcentration: [],
				diversificationScore: 100,
				topOverlappingStocks: [],
				warnings: ["No mutual fund holdings found in this portfolio."],
			};
		}

		const totalMfValue = mfHoldingsList.reduce(
			(sum, h) =>
				sum +
				Number.parseFloat(String(h.currentValue || h.investedValue || 0)),
			0,
		);

		const funds: PortfolioFund[] = mfHoldingsList.map((h) => {
			const val = Number.parseFloat(
				String(h.currentValue || h.investedValue || 0),
			);
			const weight =
				totalMfValue > 0
					? (val / totalMfValue) * 100
					: 100 / mfHoldingsList.length;
			return {
				mfIsin: h.isin || h.symbol || "",
				name: h.name || h.symbol || "Mutual Fund",
				portfolioWeight: Math.round(weight * 100) / 100,
				currentValue: val,
			};
		});

		return this.analyzePortfolio(funds);
	}

	/**
	 * Analyzes a curated or advisor Model Portfolio by ID
	 */
	async analyzeModelPortfolio(
		modelPortfolioId: string,
	): Promise<IntersectionAnalysisResult> {
		const cacheKey = `model_portfolio_overlap:${modelPortfolioId}`;
		const cached = await twoTierCacheService.get<IntersectionAnalysisResult>(cacheKey);
		if (cached) return cached;

		const [mp] = await db
			.select()
			.from(modelPortfolios)
			.where(eq(modelPortfolios.id, modelPortfolioId))
			.limit(1);

		if (!mp) {
			throw new Error(`Model portfolio not found with ID: ${modelPortfolioId}`);
		}

		const holdings = await db
			.select()
			.from(modelPortfolioHoldings)
			.where(eq(modelPortfolioHoldings.portfolioId, modelPortfolioId));

		let funds: PortfolioFund[] = [];

		if (holdings.length > 0) {
			funds = holdings.map((h) => ({
				mfIsin: h.isin || h.schemeCode || h.symbol || "",
				name: h.instrumentName || h.symbol || "Model Fund",
				portfolioWeight: Number.parseFloat(String(h.weight || 0)),
			}));
		} else if (Array.isArray(mp.holdings)) {
			funds = (mp.holdings as any[]).map((h) => ({
				mfIsin: h.isin || h.schemeCode || h.symbol || "",
				name: h.name || h.instrumentName || h.symbol || "Model Fund",
				portfolioWeight: Number.parseFloat(String(h.weight || 0)),
			}));
		}

		if (funds.length === 0) {
			return {
				totalFundsAnalyzed: 0,
				totalStocksFound: 0,
				overlappingStocksCount: 0,
				highRiskStocksCount: 0,
				mediumRiskStocksCount: 0,
				stockOverlaps: [],
				sectorConcentration: [],
				diversificationScore: 100,
				topOverlappingStocks: [],
				warnings: ["No fund holdings configured in this model portfolio."],
			};
		}

		// Normalize weights if not summing to 100
		const totalWeight = funds.reduce((sum, f) => sum + f.portfolioWeight, 0);
		if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.5) {
			funds.forEach((f) => {
				f.portfolioWeight = Math.round((f.portfolioWeight / totalWeight) * 10000) / 100;
			});
		}

		const result = await this.analyzePortfolio(funds);
		twoTierCacheService.set(cacheKey, result, 86400).catch(() => {});
		return result;
	}

	/**
	 * Simulates adding candidate funds to an existing or new portfolio basket
	 */
	async simulateAddition(
		currentFunds: PortfolioFund[],
		candidateFunds: PortfolioFund[],
	): Promise<{
		baseline: IntersectionAnalysisResult;
		simulated: IntersectionAnalysisResult;
		impact: SimulationImpact;
	}> {
		const baseline = await this.analyzePortfolio(currentFunds);

		// Combine and rebalance weights equally or proportionally
		const combined = [...currentFunds, ...candidateFunds];
		const totalWeight = combined.reduce((sum, f) => sum + f.portfolioWeight, 0);
		const normalizedCombined = combined.map((f) => ({
			...f,
			portfolioWeight:
				totalWeight > 0
					? Math.round((f.portfolioWeight / totalWeight) * 10000) / 100
					: 100 / combined.length,
		}));

		const simulated = await this.analyzePortfolio(normalizedCombined);

		const baselineStockSet = new Set(
			baseline.stockOverlaps.map((o) => o.stock.toUpperCase()),
		);
		const newOverlappingStocks = simulated.stockOverlaps.filter(
			(o) => !baselineStockSet.has(o.stock.toUpperCase()),
		);

		const elevatedRiskStocks = simulated.stockOverlaps.filter(
			(o) => o.riskFlag === "HIGH" || o.riskFlag === "MEDIUM",
		);

		const scoreDelta =
			simulated.diversificationScore - baseline.diversificationScore;

		let recommendation:
			| "DIVERSIFICATION_SAFE"
			| "MODERATE_OVERLAP_PENALTY"
			| "HIGH_CONCENTRATION_RISK" = "DIVERSIFICATION_SAFE";

		let summary = "Candidate addition maintains healthy portfolio diversification.";

		if (elevatedRiskStocks.some((s) => s.riskFlag === "HIGH") || scoreDelta < -15) {
			recommendation = "HIGH_CONCENTRATION_RISK";
			summary = `Adding candidate fund(s) increases concentration risk. Diversification score drops by ${Math.abs(scoreDelta)} points with high stock exposure.`;
		} else if (scoreDelta < -5 || newOverlappingStocks.length >= 3) {
			recommendation = "MODERATE_OVERLAP_PENALTY";
			summary = `Adding candidate fund(s) introduces ${newOverlappingStocks.length} newly overlapping stocks and reduces diversification score by ${Math.abs(scoreDelta)} points.`;
		}

		return {
			baseline,
			simulated,
			impact: {
				scoreDelta,
				newOverlappingStocks,
				elevatedRiskStocks,
				recommendation,
				summary,
			},
		};
	}

	/**
	 * Pairwise comparison between two mutual funds
	 */
	async compareSchemes(
		schemeA: string,
		schemeB: string,
	): Promise<SchemeComparisonResult> {
		const holdingsMap =
			await mfSchemeHoldingsService.getHoldingsForMultipleSchemes([
				schemeA,
				schemeB,
			]);

		const holdingsA = holdingsMap.get(schemeA) || [];
		const holdingsB = holdingsMap.get(schemeB) || [];

		const mapA = new Map<string, { weight: number; name: string; isin?: string; sector?: string }>();
		for (const h of holdingsA) {
			mapA.set(h.stockSymbol.toUpperCase(), {
				weight: h.holdingPercentage,
				name: h.stockName,
				isin: h.stockIsin,
				sector: h.sector,
			});
		}

		let overlapTotal = 0;
		const commonStocks: Array<{
			stock: string;
			stockIsin?: string;
			sector?: string;
			weightInA: number;
			weightInB: number;
			minWeight: number;
		}> = [];

		for (const h of holdingsB) {
			const sym = h.stockSymbol.toUpperCase();
			if (mapA.has(sym)) {
				const a = mapA.get(sym)!;
				const minWeight = Math.min(a.weight, h.holdingPercentage);
				overlapTotal += minWeight;
				commonStocks.push({
					stock: a.name || sym,
					stockIsin: a.isin || h.stockIsin,
					sector: a.sector || h.sector,
					weightInA: Math.round(a.weight * 100) / 100,
					weightInB: Math.round(h.holdingPercentage * 100) / 100,
					minWeight: Math.round(minWeight * 100) / 100,
				});
			}
		}

		commonStocks.sort((a, b) => b.minWeight - a.minWeight);

		const maxAllowedThreshold = 60; // Standard SEBI threshold
		const isBreach = overlapTotal > maxAllowedThreshold;

		return {
			schemeA,
			schemeB,
			overlapPercentage: Math.round(overlapTotal * 100) / 100,
			commonStocksCount: commonStocks.length,
			commonStocks,
			isBreach,
			maxAllowedThreshold,
			engineVersion: "FASP-AI-v1.0",
			timestamp: new Date().toISOString(),
		};
	}
}

export const stockIntersectionAnalysisService =
	StockIntersectionAnalysisService.getInstance();
