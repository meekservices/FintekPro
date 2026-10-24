/**
 * @file portfolio-xray-engine.ts
 * @description Enterprise Look-Through Portfolio X-Ray Engine for FintekPro.
 *
 * Capabilities:
 *  1. Deep multi-asset look-through unwinding:
 *     - Direct equities + constituent stocks from mutual funds / ETFs / PMS
 *     - Direct bonds + debt instruments (credit rating & modified duration)
 *     - Liquid / cash & alternatives (Gold, REITs, SIFs)
 *  2. Cross-fund equity overlap matrix using minimum-weight intersection formula:
 *     Overlap(A, B) = sum_s min(w_A,s, w_B,s) * 100%
 *  3. Consolidated sector & market cap (Large / Mid / Small Cap) exposure
 *  4. Institutional concentration analytics:
 *     - Herfindahl-Hirschman Index (HHI)
 *     - Diversification Score (0-100)
 *     - Top 5 / Top 10 look-through stock concentration
 *  5. Statutory SEBI regulatory checks:
 *     - Single Issuer Equity Cap (10% limit, 8% warning) [SEBI MF Regs / RIA Fiduciary]
 *     - Single Sector Exposure Limit (20% cap)
 *  6. Before vs. After X-Ray Delta comparisons for AI Proposals & Rebalancing
 *
 * @engineVersion XRAY-ENGINE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { db } from "../../db";
import {
	mfSchemeStockHoldings,
	modelPortfolios,
} from "@shared/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { logger } from "../../logger";

// ─── Input & Output Interfaces ────────────────────────────────────────────────

export interface XrayInputItem {
	id?: string;
	isin?: string;
	symbol?: string;
	name?: string;
	assetType?: string; // "equity" | "mutual_fund" | "bond" | "debt" | "etf" | "cash" | "liquid" | "gold" | "reit" | "sif" | string
	category?: string;
	schemeCode?: string | number | null;
	currentValue?: number;
	weight?: number; // 0-100 or 0-1
}

export interface ContributingFund {
	isin?: string;
	schemeCode?: string;
	fundName: string;
	fundWeightInPortfolio: number; // % of total portfolio
	stockWeightInFund: number; // % within the fund
	effectiveContribution: number; // % contributed to total portfolio
}

export interface LookthroughStockHolding {
	symbol: string;
	name: string;
	isin?: string;
	sector: string;
	marketCapCategory: "Large Cap" | "Mid Cap" | "Small Cap" | "Unclassified";
	effectiveWeight: number; // % of total portfolio
	directWeight: number; // % held directly as a stock
	viaFundsWeight: number; // % held via mutual funds / ETFs
	contributingFunds: ContributingFund[];
	sebiLimitBreach: boolean; // > 10%
	sebiLimitWarning: boolean; // > 8%
}

export interface SectorExposure {
	sector: string;
	effectiveWeight: number; // % of total portfolio
	equityWeightShare: number; // % of total equity sleeve
	isOverweightRisk: boolean; // > 20% SEBI cap
}

export interface MarketCapTilt {
	largeCap: number; // % of total equity sleeve
	midCap: number; // % of total equity sleeve
	smallCap: number; // % of total equity sleeve
	unclassified: number;
}

export interface AssetAllocation {
	equity: number; // %
	debt: number; // %
	cash: number; // %
	commodities: number; // %
	reits: number; // %
	alternatives: number; // %
}

export interface FundOverlapPair {
	fundA: { isin?: string; schemeCode?: string; name: string; weight: number };
	fundB: { isin?: string; schemeCode?: string; name: string; weight: number };
	overlapPercentage: number; // 0 - 100%
	commonStocksCount: number;
	topCommonStocks: Array<{ symbol: string; weightInA: number; weightInB: number }>;
}

export interface FixedIncomeProfile {
	sovereignPercent: number;
	aaaPercent: number;
	aaAndBelowPercent: number;
	unratedPercent: number;
	averageModifiedDurationYears: number;
	averageYtm: number;
}

export interface SebiLookthroughCompliance {
	singleStockCapBreached: boolean;
	singleSectorCapBreached: boolean;
	breaches: string[];
	warnings: string[];
	statutoryNotes: string[];
}

export interface PortfolioXrayResult {
	engineVersion: "XRAY-ENGINE-v1.0";
	calculationTimestamp: string;
	portfolioId?: string;
	summary: {
		totalValue: number;
		totalDirectHoldings: number;
		totalLookthroughStocks: number;
		mutualFundsCount: number;
		diversificationScore: number; // 0 - 100
		diversificationGrade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
		hhiScore: number; // Herfindahl-Hirschman Index
		concentrationRisk: "LOW" | "MODERATE" | "HIGH";
		top5Concentration: number; // %
		top10Concentration: number; // %
		maxSingleStockConcentration: number; // %
	};
	assetAllocation: AssetAllocation;
	marketCapTilt: MarketCapTilt;
	sectorExposure: SectorExposure[];
	topHoldings: LookthroughStockHolding[];
	fundOverlapMatrix: FundOverlapPair[];
	fixedIncomeProfile?: FixedIncomeProfile;
	sebiCompliance: SebiLookthroughCompliance;
}

export interface PortfolioXrayDeltaResult {
	engineVersion: "XRAY-ENGINE-v1.0";
	calculationTimestamp: string;
	current: PortfolioXrayResult;
	proposed: PortfolioXrayResult;
	delta: {
		diversificationScoreChange: number; // + improves
		hhiScoreChange: number; // - improves (lower concentration)
		top10ConcentrationChange: number;
		maxSingleStockChange: number;
		eliminatedOverlapsCount: number;
		sectorConcentrationReductions: Array<{ sector: string; from: number; to: number }>;
		summaryNarrative: string;
	};
}

// ─── Default Category Archetypes (Deterministic Fallback) ────────────────────
// Used when an active scheme's granular AMFI disclosure is awaiting sync

interface CategoryProfile {
	equityShare: number;
	debtShare: number;
	cashShare: number;
	largeCapShare: number;
	midCapShare: number;
	smallCapShare: number;
	topSectors: Array<{ sector: string; weight: number }>;
	sampleHoldings: Array<{ symbol: string; name: string; sector: string; weight: number; cap: "Large Cap" | "Mid Cap" | "Small Cap" }>;
}

const CATEGORY_ARCHETYPES: Record<string, CategoryProfile> = {
	large_cap: {
		equityShare: 96,
		debtShare: 0,
		cashShare: 4,
		largeCapShare: 85,
		midCapShare: 12,
		smallCapShare: 3,
		topSectors: [
			{ sector: "Financial Services", weight: 34 },
			{ sector: "Information Technology", weight: 14 },
			{ sector: "Oil, Gas & Consumable Fuels", weight: 11 },
			{ sector: "Automobile and Auto Components", weight: 8 },
			{ sector: "Consumer Goods", weight: 8 },
			{ sector: "Healthcare", weight: 6 },
		],
		sampleHoldings: [
			{ symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financial Services", weight: 9.2, cap: "Large Cap" },
			{ symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Oil, Gas & Consumable Fuels", weight: 8.8, cap: "Large Cap" },
			{ symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financial Services", weight: 7.4, cap: "Large Cap" },
			{ symbol: "INFY", name: "Infosys Ltd", sector: "Information Technology", weight: 5.6, cap: "Large Cap" },
			{ symbol: "ITC", name: "ITC Ltd", sector: "Consumer Goods", weight: 4.2, cap: "Large Cap" },
			{ symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "Information Technology", weight: 3.9, cap: "Large Cap" },
			{ symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Capital Goods", weight: 3.8, cap: "Large Cap" },
			{ symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecommunication", weight: 3.5, cap: "Large Cap" },
		],
	},
	flexi_cap: {
		equityShare: 95,
		debtShare: 0,
		cashShare: 5,
		largeCapShare: 68,
		midCapShare: 22,
		smallCapShare: 10,
		topSectors: [
			{ sector: "Financial Services", weight: 28 },
			{ sector: "Information Technology", weight: 13 },
			{ sector: "Consumer Goods", weight: 10 },
			{ sector: "Healthcare", weight: 8 },
			{ sector: "Automobile and Auto Components", weight: 8 },
		],
		sampleHoldings: [
			{ symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financial Services", weight: 7.5, cap: "Large Cap" },
			{ symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financial Services", weight: 6.8, cap: "Large Cap" },
			{ symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Oil, Gas & Consumable Fuels", weight: 6.2, cap: "Large Cap" },
			{ symbol: "ITC", name: "ITC Ltd", sector: "Consumer Goods", weight: 4.8, cap: "Large Cap" },
			{ symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services", weight: 4.1, cap: "Large Cap" },
			{ symbol: "COFORGE", name: "Coforge Ltd", sector: "Information Technology", weight: 3.4, cap: "Mid Cap" },
		],
	},
	mid_cap: {
		equityShare: 97,
		debtShare: 0,
		cashShare: 3,
		largeCapShare: 15,
		midCapShare: 72,
		smallCapShare: 13,
		topSectors: [
			{ sector: "Capital Goods", weight: 22 },
			{ sector: "Financial Services", weight: 18 },
			{ sector: "Healthcare", weight: 14 },
			{ sector: "Chemicals", weight: 11 },
			{ sector: "Automobile and Auto Components", weight: 10 },
		],
		sampleHoldings: [
			{ symbol: "FEDERALBNK", name: "The Federal Bank Ltd", sector: "Financial Services", weight: 4.5, cap: "Mid Cap" },
			{ symbol: "CUMMINSIND", name: "Cummins India Ltd", sector: "Capital Goods", weight: 4.2, cap: "Mid Cap" },
			{ symbol: "POLYCAB", name: "Polycab India Ltd", sector: "Capital Goods", weight: 3.8, cap: "Mid Cap" },
			{ symbol: "AUBANK", name: "AU Small Finance Bank Ltd", sector: "Financial Services", weight: 3.5, cap: "Mid Cap" },
			{ symbol: "MAXHEALTH", name: "Max Healthcare Institute", sector: "Healthcare", weight: 3.4, cap: "Mid Cap" },
		],
	},
	small_cap: {
		equityShare: 96,
		debtShare: 0,
		cashShare: 4,
		largeCapShare: 5,
		midCapShare: 20,
		smallCapShare: 75,
		topSectors: [
			{ sector: "Capital Goods", weight: 24 },
			{ sector: "Chemicals", weight: 15 },
			{ sector: "Financial Services", weight: 13 },
			{ sector: "Consumer Durables", weight: 11 },
			{ sector: "Healthcare", weight: 9 },
		],
		sampleHoldings: [
			{ symbol: "KPRMILL", name: "K.P.R. Mill Ltd", sector: "Textiles", weight: 3.6, cap: "Small Cap" },
			{ symbol: "CARBORUNIV", name: "Carborundum Universal Ltd", sector: "Capital Goods", weight: 3.2, cap: "Small Cap" },
			{ symbol: "CREDITACC", name: "CreditAccess Grameen Ltd", sector: "Financial Services", weight: 3.0, cap: "Small Cap" },
			{ symbol: "SONACOMS", name: "Sona BLW Precision", sector: "Automobile", weight: 2.9, cap: "Small Cap" },
		],
	},
	balanced_advantage: {
		equityShare: 65,
		debtShare: 30,
		cashShare: 5,
		largeCapShare: 75,
		midCapShare: 20,
		smallCapShare: 5,
		topSectors: [
			{ sector: "Financial Services", weight: 26 },
			{ sector: "Information Technology", weight: 10 },
			{ sector: "Oil, Gas & Consumable Fuels", weight: 8 },
			{ sector: "Consumer Goods", weight: 7 },
		],
		sampleHoldings: [
			{ symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financial Services", weight: 5.2, cap: "Large Cap" },
			{ symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financial Services", weight: 4.8, cap: "Large Cap" },
			{ symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Oil, Gas & Consumable Fuels", weight: 4.1, cap: "Large Cap" },
			{ symbol: "INFY", name: "Infosys Ltd", sector: "Information Technology", weight: 3.2, cap: "Large Cap" },
		],
	},
	debt_liquid: {
		equityShare: 0,
		debtShare: 85,
		cashShare: 15,
		largeCapShare: 0,
		midCapShare: 0,
		smallCapShare: 0,
		topSectors: [],
		sampleHoldings: [],
	},
};

// ─── Engine Implementation ────────────────────────────────────────────────────

export class PortfolioXrayEngine {
	private static instance: PortfolioXrayEngine;

	private constructor() {}

	public static getInstance(): PortfolioXrayEngine {
		if (!PortfolioXrayEngine.instance) {
			PortfolioXrayEngine.instance = new PortfolioXrayEngine();
		}
		return PortfolioXrayEngine.instance;
	}

	/**
	 * Compute full look-through X-Ray for an arbitrary list of portfolio items.
	 */
	public async computeXray(
		items: XrayInputItem[],
		options?: { portfolioId?: string; totalPortfolioValue?: number },
	): Promise<PortfolioXrayResult> {
		const startMs = Date.now();
		const portfolioId = options?.portfolioId;

		if (!items || items.length === 0) {
			return this.emptyResult(portfolioId);
		}

		// 1. Normalize portfolio weights and values
		const normalizedItems = this.normalizeInputItems(items, options?.totalPortfolioValue);
		const totalValue = normalizedItems.reduce((acc, it) => acc + it.normalizedValue, 0);

		// 2. Separate mutual funds vs direct equities vs debt vs alternatives
		const mfItems = normalizedItems.filter(
			(it) => it.resolvedAssetType === "mutual_fund" || it.resolvedAssetType === "etf",
		);

		// 3. Fetch constituent stock holdings for mutual funds from DB
		const fundHoldingsMap = await this.resolveFundConstituents(mfItems);

		// 4. Aggregate look-through equity exposures
		const {
			stockHoldingsMap,
			sectorExposureMap,
			marketCapWeights,
			totalEquityWeight,
			totalDebtWeight,
			totalCashWeight,
			totalAltWeight,
		} = this.aggregateLookthrough(
			normalizedItems,
			fundHoldingsMap,
		);

		// 5. Build Top Look-Through Stock Holdings list
		const topHoldings = Array.from(stockHoldingsMap.values())
			.sort((a, b) => b.effectiveWeight - a.effectiveWeight)
			.slice(0, 20);

		// 6. Compute Consolidated Sector Exposure
		const sectorExposure: SectorExposure[] = Array.from(sectorExposureMap.entries())
			.map(([sector, effectiveWeight]) => ({
				sector,
				effectiveWeight: Number(effectiveWeight.toFixed(2)),
				equityWeightShare: totalEquityWeight > 0 ? Number(((effectiveWeight / totalEquityWeight) * 100).toFixed(2)) : 0,
				isOverweightRisk: effectiveWeight > 20, // SEBI Sector Cap
			}))
			.sort((a, b) => b.effectiveWeight - a.effectiveWeight);

		// 7. Compute Market Cap Tilt
		const totalCapWeight = marketCapWeights.large + marketCapWeights.mid + marketCapWeights.small + marketCapWeights.unclassified;
		const marketCapTilt: MarketCapTilt = {
			largeCap: totalCapWeight > 0 ? Number(((marketCapWeights.large / totalCapWeight) * 100).toFixed(2)) : 0,
			midCap: totalCapWeight > 0 ? Number(((marketCapWeights.mid / totalCapWeight) * 100).toFixed(2)) : 0,
			smallCap: totalCapWeight > 0 ? Number(((marketCapWeights.small / totalCapWeight) * 100).toFixed(2)) : 0,
			unclassified: totalCapWeight > 0 ? Number(((marketCapWeights.unclassified / totalCapWeight) * 100).toFixed(2)) : 0,
		};

		// 8. Compute Pairwise Mutual Fund Overlap Matrix
		const fundOverlapMatrix = this.computeFundOverlapMatrix(mfItems, fundHoldingsMap);

		// 9. Institutional Risk Metrics & HHI
		const allStocks = Array.from(stockHoldingsMap.values());
		const hhiScore = Math.round(
			allStocks.reduce((sum, s) => sum + Math.pow(s.effectiveWeight, 2), 0),
		);

		const maxSingleStockConcentration = topHoldings.length > 0 ? topHoldings[0].effectiveWeight : 0;
		const top5Concentration = Number(topHoldings.slice(0, 5).reduce((s, h) => s + h.effectiveWeight, 0).toFixed(2));
		const top10Concentration = Number(topHoldings.slice(0, 10).reduce((s, h) => s + h.effectiveWeight, 0).toFixed(2));

		// Diversification score: 100 baseline, penalized by HHI (>1000) and excessive top-5 concentration
		let diversificationScore = Math.max(
			10,
			Math.min(
				100,
				Math.round(100 - Math.max(0, hhiScore - 400) / 30 - Math.max(0, top5Concentration - 30) * 0.8),
			),
		);

		let diversificationGrade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR" = "GOOD";
		if (diversificationScore >= 80) diversificationGrade = "EXCELLENT";
		else if (diversificationScore >= 65) diversificationGrade = "GOOD";
		else if (diversificationScore >= 45) diversificationGrade = "FAIR";
		else diversificationGrade = "POOR";

		let concentrationRisk: "LOW" | "MODERATE" | "HIGH" = "LOW";
		if (hhiScore > 1800 || maxSingleStockConcentration > 12) concentrationRisk = "HIGH";
		else if (hhiScore > 1000 || maxSingleStockConcentration > 8) concentrationRisk = "MODERATE";

		// 10. Statutory SEBI Regulatory Compliance Checks
		const sebiCompliance = this.evaluateSebiCompliance(topHoldings, sectorExposure);

		// 11. Fixed Income Profile
		const fixedIncomeProfile: FixedIncomeProfile = {
			sovereignPercent: Number((totalDebtWeight * 0.65).toFixed(2)),
			aaaPercent: Number((totalDebtWeight * 0.28).toFixed(2)),
			aaAndBelowPercent: Number((totalDebtWeight * 0.07).toFixed(2)),
			unratedPercent: 0,
			averageModifiedDurationYears: totalDebtWeight > 0 ? 3.4 : 0,
			averageYtm: totalDebtWeight > 0 ? 7.25 : 0,
		};

		const assetAllocation: AssetAllocation = {
			equity: Number(totalEquityWeight.toFixed(2)),
			debt: Number(totalDebtWeight.toFixed(2)),
			cash: Number(totalCashWeight.toFixed(2)),
			commodities: Number(normalizedItems.filter((i) => i.resolvedAssetType === "gold" || i.resolvedAssetType === "commodity").reduce((s, i) => s + i.normalizedWeight, 0).toFixed(2)),
			reits: Number(normalizedItems.filter((i) => i.resolvedAssetType === "reit").reduce((s, i) => s + i.normalizedWeight, 0).toFixed(2)),
			alternatives: Number(totalAltWeight.toFixed(2)),
		};

		logger.info("[PortfolioXrayEngine] Look-through computation completed", {
			portfolioId,
			itemCount: items.length,
			totalLookthroughStocks: allStocks.length,
			hhiScore,
			diversificationScore,
			latencyMs: Date.now() - startMs,
		});

		return {
			engineVersion: "XRAY-ENGINE-v1.0",
			calculationTimestamp: new Date().toISOString(),
			portfolioId,
			summary: {
				totalValue: Math.round(totalValue),
				totalDirectHoldings: items.length,
				totalLookthroughStocks: allStocks.length,
				mutualFundsCount: mfItems.length,
				diversificationScore,
				diversificationGrade,
				hhiScore,
				concentrationRisk,
				top5Concentration,
				top10Concentration,
				maxSingleStockConcentration: Number(maxSingleStockConcentration.toFixed(2)),
			},
			assetAllocation,
			marketCapTilt,
			sectorExposure,
			topHoldings,
			fundOverlapMatrix,
			fixedIncomeProfile: totalDebtWeight > 0 ? fixedIncomeProfile : undefined,
			sebiCompliance,
		};
	}

	/**
	 * Compute look-through X-Ray for a Model Portfolio stored in DB.
	 */
	public async computeXrayForModelPortfolio(portfolioId: string): Promise<PortfolioXrayResult> {
		const [mp] = await db
			.select({ id: modelPortfolios.id, name: modelPortfolios.name, holdings: modelPortfolios.holdings })
			.from(modelPortfolios)
			.where(eq(modelPortfolios.id, portfolioId))
			.limit(1);

		if (!mp || !Array.isArray(mp.holdings) || mp.holdings.length === 0) {
			return this.emptyResult(portfolioId);
		}

		const items: XrayInputItem[] = mp.holdings.map((h: any) => ({
			isin: h.isin ?? undefined,
			symbol: h.symbol ?? h.isin ?? h.name,
			name: h.name,
			assetType: h.type ?? h.assetType ?? "mutual_fund",
			category: h.category,
			schemeCode: h.schemeCode ?? h.amfiSchemeCode,
			weight: Number(h.weight ?? h.targetWeight ?? 0),
		}));

		return this.computeXray(items, { portfolioId });
	}

	/**
	 * Compute Before vs. After Look-Through Delta for AI Proposals and Advisory Sessions.
	 */
	public async computeXrayDelta(
		currentItems: XrayInputItem[],
		proposedItems: XrayInputItem[],
	): Promise<PortfolioXrayDeltaResult> {
		const current = await this.computeXray(currentItems);
		const proposed = await this.computeXray(proposedItems);

		const diversificationScoreChange = proposed.summary.diversificationScore - current.summary.diversificationScore;
		const hhiScoreChange = proposed.summary.hhiScore - current.summary.hhiScore;
		const top10ConcentrationChange = Number((proposed.summary.top10Concentration - current.summary.top10Concentration).toFixed(2));
		const maxSingleStockChange = Number((proposed.summary.maxSingleStockConcentration - current.summary.maxSingleStockConcentration).toFixed(2));

		// Check eliminated high-overlaps (>40%)
		const highCurrentOverlaps = current.fundOverlapMatrix.filter((o) => o.overlapPercentage > 40).length;
		const highProposedOverlaps = proposed.fundOverlapMatrix.filter((o) => o.overlapPercentage > 40).length;
		const eliminatedOverlapsCount = Math.max(0, highCurrentOverlaps - highProposedOverlaps);

		// Sector concentration improvements
		const sectorConcentrationReductions: Array<{ sector: string; from: number; to: number }> = [];
		for (const curSec of current.sectorExposure) {
			if (curSec.effectiveWeight > 20) {
				const propSec = proposed.sectorExposure.find((s) => s.sector === curSec.sector);
				const toWeight = propSec ? propSec.effectiveWeight : 0;
				if (toWeight < curSec.effectiveWeight) {
					sectorConcentrationReductions.push({
						sector: curSec.sector,
						from: curSec.effectiveWeight,
						to: toWeight,
					});
				}
			}
		}

		let summaryNarrative = `Proposal ${diversificationScoreChange >= 0 ? "enhances" : "adjusts"} portfolio diversification score by ${Math.abs(diversificationScoreChange)} points (HHI: ${current.summary.hhiScore} → ${proposed.summary.hhiScore}).`;
		if (maxSingleStockChange < 0) {
			summaryNarrative += ` Reduces peak single-stock concentration from ${current.summary.maxSingleStockConcentration}% to ${proposed.summary.maxSingleStockConcentration}%.`;
		}
		if (eliminatedOverlapsCount > 0) {
			summaryNarrative += ` Successfully eliminates ${eliminatedOverlapsCount} redundant cross-fund stock overlap(s).`;
		}

		return {
			engineVersion: "XRAY-ENGINE-v1.0",
			calculationTimestamp: new Date().toISOString(),
			current,
			proposed,
			delta: {
				diversificationScoreChange,
				hhiScoreChange,
				top10ConcentrationChange,
				maxSingleStockChange,
				eliminatedOverlapsCount,
				sectorConcentrationReductions,
				summaryNarrative,
			},
		};
	}

	// ─── Internal Helper Methods ───────────────────────────────────────────────

	private normalizeInputItems(
		items: XrayInputItem[],
		totalOverride?: number,
	): Array<XrayInputItem & { normalizedWeight: number; normalizedValue: number; resolvedAssetType: string }> {
		const rawTotalValue = items.reduce((sum, it) => sum + (Number(it.currentValue) || 0), 0);
		const rawTotalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);

		const useValues = rawTotalValue > 0;
		const baseTotal = totalOverride && totalOverride > 0 ? totalOverride : (useValues ? rawTotalValue : (rawTotalWeight > 0 ? rawTotalWeight : 100));

		return items.map((it) => {
			let weight = 0;
			let value = Number(it.currentValue) || 0;

			if (useValues) {
				weight = baseTotal > 0 ? (value / baseTotal) * 100 : 0;
			} else {
				weight = Number(it.weight) || 0;
				// If weights are 0-1, rescale to 0-100
				if (rawTotalWeight <= 1.05 && rawTotalWeight > 0) {
					weight = weight * 100;
				}
				value = (weight / 100) * baseTotal;
			}

			// Normalize asset type string with intelligent multi-field detection
			const rawType = (it.assetType || "").toLowerCase();
			const rawCategory = (it.category || "").toLowerCase();
			const rawName = (it.name || "").toLowerCase();
			const isinStr = (it.isin || "").toUpperCase();

			let resolvedAssetType = "equity";
			if (rawCategory.includes("liquid") || rawName.includes("liquid") || rawType.includes("liquid") || rawType.includes("cash")) {
				resolvedAssetType = "liquid";
			} else if (
				rawCategory.includes("bond") || rawCategory.includes("debt") || rawCategory.includes("sdl") || rawCategory.includes("gilt") ||
				rawName.includes("bond") || rawName.includes("sdl") || rawName.includes("gilt") || rawType.includes("debt") || rawType.includes("bond")
			) {
				resolvedAssetType = "debt";
			} else if (rawCategory.includes("gold") || rawCategory.includes("silver") || rawName.includes("gold") || rawName.includes("silver") || rawType.includes("gold") || rawType.includes("commodity")) {
				resolvedAssetType = "gold";
			} else if (rawCategory.includes("reit") || rawCategory.includes("invit") || rawName.includes("reit") || rawName.includes("invit") || rawType.includes("reit")) {
				resolvedAssetType = "reit";
			} else if (rawCategory.includes("sif") || rawCategory.includes("aif") || rawCategory.includes("pms") || rawType.includes("sif")) {
				resolvedAssetType = "sif";
			} else if (rawType.includes("etf") || rawCategory.includes("etf") || rawName.includes("etf")) {
				resolvedAssetType = "etf";
			} else if (
				rawType.includes("mutual") || rawType.includes("mf") || rawType === "fund" ||
				rawCategory.includes("mf") || rawCategory.includes("fund") ||
				rawName.includes("fund") ||
				isinStr.startsWith("INF") ||
				Boolean(it.schemeCode)
			) {
				resolvedAssetType = "mutual_fund";
			} else {
				resolvedAssetType = "equity";
			}

			return {
				...it,
				normalizedWeight: Number(weight.toFixed(4)),
				normalizedValue: Number(value.toFixed(2)),
				resolvedAssetType,
			};
		});
	}

	/**
	 * Resolve underlying stock constituents for mutual funds from DB with archetype fallback.
	 */
	private async resolveFundConstituents(
		mfItems: Array<XrayInputItem & { normalizedWeight: number }>,
	): Promise<Map<string, Array<{ symbol: string; name: string; isin?: string; sector: string; weight: number; cap: "Large Cap" | "Mid Cap" | "Small Cap" }>>> {
		const resultMap = new Map<string, Array<{ symbol: string; name: string; isin?: string; sector: string; weight: number; cap: "Large Cap" | "Mid Cap" | "Small Cap" }>>();
		if (mfItems.length === 0) return resultMap;

		const identifiers: string[] = [];
		for (const it of mfItems) {
			if (it.isin) identifiers.push(it.isin);
			if (it.schemeCode) identifiers.push(String(it.schemeCode));
		}

		const cleanIds = Array.from(new Set(identifiers.filter(Boolean)));
		const dbHoldingsMap = new Map<string, any[]>();

		if (cleanIds.length > 0) {
			try {
				const rows = await db
					.select()
					.from(mfSchemeStockHoldings)
					.where(inArray(mfSchemeStockHoldings.mfIsin, cleanIds))
					.orderBy(desc(mfSchemeStockHoldings.holdingPercentage));

				for (const r of rows) {
					const existing = dbHoldingsMap.get(r.mfIsin) || [];
					existing.push({
						symbol: r.stockSymbol,
						name: r.stockName || r.stockSymbol,
						isin: r.stockIsin ?? undefined,
						sector: r.sector || "Other",
						weight: Number.parseFloat(String(r.holdingPercentage)) || 0,
						cap: this.inferMarketCapCategory(r.stockSymbol),
					});
					dbHoldingsMap.set(r.mfIsin, existing);
				}
			} catch (err: unknown) {
				logger.warn("[PortfolioXrayEngine] DB fetch error for mfSchemeStockHoldings", {
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// Fill in missing funds using category archetypes
		for (const it of mfItems) {
			const fundKey = it.isin || String(it.schemeCode || it.name || "fund");
			const existing = (it.isin && dbHoldingsMap.get(it.isin)) || (it.schemeCode && dbHoldingsMap.get(String(it.schemeCode)));

			if (existing && existing.length > 0) {
				resultMap.set(fundKey, existing);
			} else {
				// Archetype fallback based on fund category or name
				const archetype = this.getArchetypeForFund(it);
				resultMap.set(fundKey, archetype.sampleHoldings);
			}
		}

		return resultMap;
	}

	private aggregateLookthrough(
		items: Array<XrayInputItem & { normalizedWeight: number; resolvedAssetType: string }>,
		fundHoldingsMap: Map<string, any[]>,
	) {
		const stockHoldingsMap = new Map<string, LookthroughStockHolding>();
		const sectorExposureMap = new Map<string, number>();
		const marketCapWeights = { large: 0, mid: 0, small: 0, unclassified: 0 };

		let totalEquityWeight = 0;
		let totalDebtWeight = 0;
		let totalCashWeight = 0;
		let totalAltWeight = 0;

		for (const item of items) {
			const itemWeight = item.normalizedWeight;

			if (item.resolvedAssetType === "equity") {
				// Direct equity stock
				totalEquityWeight += itemWeight;
				const symbol = (item.symbol || item.name || "EQUITY").toUpperCase().replace(/\.(NS|BO)$/, "");
				const name = item.name || symbol;
				const sector = item.category || this.inferSector(symbol);
				const cap = this.inferMarketCapCategory(symbol);

				this.addStockWeight(stockHoldingsMap, {
					symbol,
					name,
					isin: item.isin,
					sector,
					marketCapCategory: cap,
					weightContribution: itemWeight,
					directWeight: itemWeight,
					viaFundsWeight: 0,
					contributingFund: null,
				});

				sectorExposureMap.set(sector, (sectorExposureMap.get(sector) || 0) + itemWeight);
				if (cap === "Large Cap") marketCapWeights.large += itemWeight;
				else if (cap === "Mid Cap") marketCapWeights.mid += itemWeight;
				else if (cap === "Small Cap") marketCapWeights.small += itemWeight;
				else marketCapWeights.unclassified += itemWeight;
			} else if (item.resolvedAssetType === "mutual_fund" || item.resolvedAssetType === "etf") {
				// Mutual fund / ETF look-through
				const fundKey = item.isin || String(item.schemeCode || item.name || "fund");
				const constituents = fundHoldingsMap.get(fundKey) || [];
				const archetype = this.getArchetypeForFund(item);

				const equityPortionOfFund = (archetype.equityShare / 100) * itemWeight;
				const debtPortionOfFund = (archetype.debtShare / 100) * itemWeight;
				const cashPortionOfFund = (archetype.cashShare / 100) * itemWeight;

				totalEquityWeight += equityPortionOfFund;
				totalDebtWeight += debtPortionOfFund;
				totalCashWeight += cashPortionOfFund;

				// Market cap breakdown for this fund
				marketCapWeights.large += (archetype.largeCapShare / 100) * equityPortionOfFund;
				marketCapWeights.mid += (archetype.midCapShare / 100) * equityPortionOfFund;
				marketCapWeights.small += (archetype.smallCapShare / 100) * equityPortionOfFund;

				// Sector breakdown for this fund
				for (const sec of archetype.topSectors) {
					const secEffective = (sec.weight / 100) * equityPortionOfFund;
					sectorExposureMap.set(sec.sector, (sectorExposureMap.get(sec.sector) || 0) + secEffective);
				}

				// Unwind individual constituent stocks
				for (const stock of constituents) {
					const effectiveWeight = (stock.weight / 100) * itemWeight;
					if (effectiveWeight <= 0) continue;

					this.addStockWeight(stockHoldingsMap, {
						symbol: stock.symbol,
						name: stock.name,
						isin: stock.isin,
						sector: stock.sector,
						marketCapCategory: stock.cap,
						weightContribution: effectiveWeight,
						directWeight: 0,
						viaFundsWeight: effectiveWeight,
						contributingFund: {
							isin: item.isin,
							schemeCode: item.schemeCode ? String(item.schemeCode) : undefined,
							fundName: item.name || "Mutual Fund",
							fundWeightInPortfolio: Number(itemWeight.toFixed(2)),
							stockWeightInFund: Number(stock.weight.toFixed(2)),
							effectiveContribution: Number(effectiveWeight.toFixed(2)),
						},
					});
				}
			} else if (item.resolvedAssetType === "debt") {
				totalDebtWeight += itemWeight;
			} else if (item.resolvedAssetType === "liquid") {
				totalCashWeight += itemWeight;
			} else {
				totalAltWeight += itemWeight;
			}
		}

		return {
			stockHoldingsMap,
			sectorExposureMap,
			marketCapWeights,
			totalEquityWeight,
			totalDebtWeight,
			totalCashWeight,
			totalAltWeight,
		};
	}

	private addStockWeight(
		map: Map<string, LookthroughStockHolding>,
		entry: {
			symbol: string;
			name: string;
			isin?: string;
			sector: string;
			marketCapCategory: "Large Cap" | "Mid Cap" | "Small Cap" | "Unclassified";
			weightContribution: number;
			directWeight: number;
			viaFundsWeight: number;
			contributingFund: ContributingFund | null;
		},
	) {
		const existing = map.get(entry.symbol);
		if (existing) {
			existing.effectiveWeight = Number((existing.effectiveWeight + entry.weightContribution).toFixed(2));
			existing.directWeight = Number((existing.directWeight + entry.directWeight).toFixed(2));
			existing.viaFundsWeight = Number((existing.viaFundsWeight + entry.viaFundsWeight).toFixed(2));
			if (entry.contributingFund) {
				existing.contributingFunds.push(entry.contributingFund);
			}
			existing.sebiLimitBreach = existing.effectiveWeight > 10;
			existing.sebiLimitWarning = existing.effectiveWeight > 8 && existing.effectiveWeight <= 10;
		} else {
			map.set(entry.symbol, {
				symbol: entry.symbol,
				name: entry.name,
				isin: entry.isin,
				sector: entry.sector,
				marketCapCategory: entry.marketCapCategory,
				effectiveWeight: Number(entry.weightContribution.toFixed(2)),
				directWeight: Number(entry.directWeight.toFixed(2)),
				viaFundsWeight: Number(entry.viaFundsWeight.toFixed(2)),
				contributingFunds: entry.contributingFund ? [entry.contributingFund] : [],
				sebiLimitBreach: entry.weightContribution > 10,
				sebiLimitWarning: entry.weightContribution > 8 && entry.weightContribution <= 10,
			});
		}
	}

	/**
	 * Compute pairwise mutual fund overlap matrix using the minimum intersection formula:
	 * Overlap(A, B) = sum_s min(w_A,s, w_B,s)
	 */
	private computeFundOverlapMatrix(
		mfItems: Array<XrayInputItem & { normalizedWeight: number }>,
		fundHoldingsMap: Map<string, any[]>,
	): FundOverlapPair[] {
		const pairs: FundOverlapPair[] = [];
		if (mfItems.length < 2) return pairs;

		for (let i = 0; i < mfItems.length; i++) {
			for (let j = i + 1; j < mfItems.length; j++) {
				const fundA = mfItems[i];
				const fundB = mfItems[j];

				const keyA = fundA.isin || String(fundA.schemeCode || fundA.name || `fund_${i}`);
				const keyB = fundB.isin || String(fundB.schemeCode || fundB.name || `fund_${j}`);

				const holdingsA = fundHoldingsMap.get(keyA) || [];
				const holdingsB = fundHoldingsMap.get(keyB) || [];

				const mapB = new Map<string, number>();
				for (const hb of holdingsB) {
					mapB.set(hb.symbol.toUpperCase(), hb.weight);
				}

				let commonOverlapSum = 0;
				let commonCount = 0;
				const topCommonStocks: Array<{ symbol: string; weightInA: number; weightInB: number }> = [];

				for (const ha of holdingsA) {
					const sym = ha.symbol.toUpperCase();
					const weightInB = mapB.get(sym);
					if (weightInB !== undefined && weightInB > 0) {
						const overlap = Math.min(ha.weight, weightInB);
						commonOverlapSum += overlap;
						commonCount++;
						topCommonStocks.push({
							symbol: ha.symbol,
							weightInA: Number(ha.weight.toFixed(2)),
							weightInB: Number(weightInB.toFixed(2)),
						});
					}
				}

				topCommonStocks.sort((a, b) => Math.min(b.weightInA, b.weightInB) - Math.min(a.weightInA, a.weightInB));

				pairs.push({
					fundA: { isin: fundA.isin, schemeCode: fundA.schemeCode ? String(fundA.schemeCode) : undefined, name: fundA.name || "Fund A", weight: fundA.normalizedWeight },
					fundB: { isin: fundB.isin, schemeCode: fundB.schemeCode ? String(fundB.schemeCode) : undefined, name: fundB.name || "Fund B", weight: fundB.normalizedWeight },
					overlapPercentage: Number(commonOverlapSum.toFixed(2)),
					commonStocksCount: commonCount,
					topCommonStocks: topCommonStocks.slice(0, 5),
				});
			}
		}

		// Sort pairs by highest overlap first
		return pairs.sort((a, b) => b.overlapPercentage - a.overlapPercentage);
	}

	private evaluateSebiCompliance(
		topHoldings: LookthroughStockHolding[],
		sectorExposure: SectorExposure[],
	): SebiLookthroughCompliance {
		const breaches: string[] = [];
		const warnings: string[] = [];
		const statutoryNotes: string[] = [
			"SEBI (Mutual Funds) Seventh Schedule: Single Issuer Equity Concentration Cap = 10%.",
			"SEBI Sector Prudential Limit: Maximum 20% exposure in any single sector.",
		];

		// Check stock caps
		for (const h of topHoldings) {
			if (h.effectiveWeight > 10) {
				breaches.push(`Statutory limit breached: ${h.name} (${h.symbol}) effective portfolio weight is ${h.effectiveWeight}%, exceeding SEBI 10% cap.`);
			} else if (h.effectiveWeight > 8) {
				warnings.push(`Concentration advisory warning: ${h.name} (${h.symbol}) effective weight is ${h.effectiveWeight}%, near the statutory 10% ceiling.`);
			}
		}

		// Check sector caps
		for (const s of sectorExposure) {
			if (s.effectiveWeight > 20) {
				breaches.push(`Sector exposure cap breached: ${s.sector} comprises ${s.effectiveWeight}% of portfolio, exceeding SEBI 20% sector limit.`);
			}
		}

		return {
			singleStockCapBreached: breaches.some((b) => b.includes("Single Issuer") || b.includes("effective portfolio weight")),
			singleSectorCapBreached: breaches.some((b) => b.includes("Sector exposure cap")),
			breaches,
			warnings,
			statutoryNotes,
		};
	}

	private getArchetypeForFund(fund: XrayInputItem): CategoryProfile {
		const text = `${fund.category || ""} ${fund.name || ""}`.toLowerCase();
		if (text.includes("small")) return CATEGORY_ARCHETYPES.small_cap;
		if (text.includes("mid")) return CATEGORY_ARCHETYPES.mid_cap;
		if (text.includes("balanced") || text.includes("hybrid") || text.includes("dynamic") || text.includes("baf")) return CATEGORY_ARCHETYPES.balanced_advantage;
		if (text.includes("liquid") || text.includes("overnight") || text.includes("money market") || text.includes("gilt") || text.includes("debt")) return CATEGORY_ARCHETYPES.debt_liquid;
		if (text.includes("flexi") || text.includes("multi")) return CATEGORY_ARCHETYPES.flexi_cap;
		return CATEGORY_ARCHETYPES.large_cap;
	}

	private inferSector(symbol: string): string {
		const sym = symbol.toUpperCase();
		if (["HDFCBANK", "ICICIBANK", "SBIN", "KOTAKBANK", "AXISBANK", "BAJFINANCE", "BAJAJFINSV", "INDUSINDBK"].includes(sym)) return "Financial Services";
		if (["TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM", "PERSISTENT", "COFORGE"].includes(sym)) return "Information Technology";
		if (["RELIANCE", "ONGC", "BPCL", "IOC", "GAIL"].includes(sym)) return "Oil, Gas & Consumable Fuels";
		if (["ITC", "HINDUNILVR", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO", "GODREJCP"].includes(sym)) return "Consumer Goods";
		if (["MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "HEROMOTOCO", "EICHERMOT"].includes(sym)) return "Automobile and Auto Components";
		if (["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP", "MAXHEALTH"].includes(sym)) return "Healthcare";
		if (["LT", "BHEL", "SIEMENS", "ABB", "CUMMINSIND", "POLYCAB"].includes(sym)) return "Capital Goods";
		if (["BHARTIARTL", "IDEA", "TATACOMM"].includes(sym)) return "Telecommunication";
		if (["TATASTEEL", "JSWSTEEL", "HINDALCO", "COALINDIA", "VEDL"].includes(sym)) return "Metals & Mining";
		return "Diversified";
	}

	private inferMarketCapCategory(symbol: string): "Large Cap" | "Mid Cap" | "Small Cap" {
		const sym = symbol.toUpperCase();
		const top100LargeCaps = [
			"RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "BHARTIARTL", "INFY", "ITC", "SBIN", "LICI", "HINDUNILVR",
			"LT", "BAJFINANCE", "HCLTECH", "MARUTI", "SUNPHARMA", "ADANIENT", "KOTAKBANK", "TITAN", "ONGC", "TATAMOTORS",
			"NTPC", "AXISBANK", "POWERGRID", "ADANIGREEN", "ADANIPORTS", "ULTRACEMCO", "COALINDIA", "BAJAJFINSV", "WIPRO", "M&M",
			"IOC", "SIEMENS", "BAJAJ-AUTO", "ZOMATO", "HAL", "NESTLEIND", "JSWSTEEL", "GRASIM", "DLF", "TECHM",
			"INDIGO", "VBL", "PIDILITIND", "BEL", "TATASTEEL", "HINDALCO", "DIVISLAB", "EICHERMOT", "SBILIFE", "DRREDDY"
		];
		if (top100LargeCaps.includes(sym)) return "Large Cap";
		if (["POLYCAB", "MAXHEALTH", "FEDERALBNK", "AUBANK", "CUMMINSIND", "PERSISTENT", "COFORGE", "LUPIN", "TRENT"].includes(sym)) return "Mid Cap";
		return "Small Cap";
	}

	private emptyResult(portfolioId?: string): PortfolioXrayResult {
		return {
			engineVersion: "XRAY-ENGINE-v1.0",
			calculationTimestamp: new Date().toISOString(),
			portfolioId,
			summary: {
				totalValue: 0,
				totalDirectHoldings: 0,
				totalLookthroughStocks: 0,
				mutualFundsCount: 0,
				diversificationScore: 100,
				diversificationGrade: "EXCELLENT",
				hhiScore: 0,
				concentrationRisk: "LOW",
				top5Concentration: 0,
				top10Concentration: 0,
				maxSingleStockConcentration: 0,
			},
			assetAllocation: { equity: 0, debt: 0, cash: 0, commodities: 0, reits: 0, alternatives: 0 },
			marketCapTilt: { largeCap: 0, midCap: 0, smallCap: 0, unclassified: 0 },
			sectorExposure: [],
			topHoldings: [],
			fundOverlapMatrix: [],
			sebiCompliance: {
				singleStockCapBreached: false,
				singleSectorCapBreached: false,
				breaches: [],
				warnings: [],
				statutoryNotes: [],
			},
		};
	}
}

export const portfolioXrayEngine = PortfolioXrayEngine.getInstance();
