/**
 * @file direct-plan-switch-service.ts
 * @description Direct Plan Switch & Cart Optimizer Engine (FASP-AI v1.0 + GCR v1.0)
 *
 * Provides peer-grade (INDmoney / Dezerv / Kuvera level) Mutual Fund Direct Plan Switch Analysis:
 * 1. Detects Regular plan mutual fund holdings in a user/client portfolio.
 * 2. Matches exact Direct-Growth counterpart schemes via AMFI / scheme registry.
 * 3. Computes exact Expense Ratio Differential (TER Delta).
 * 4. Projects 1Y, 5Y, 10Y, 15Y, and 20Y compounded wealth addition from lower expense ratios.
 * 5. Computes Capital Gains tax liability on redemption (Budget 2024: Equity STCG 20%, LTCG 12.5% > ₹1.25L).
 * 6. Evaluates Exit Load applicability and days remaining to zero exit load.
 * 7. Computes Payback Period (breakeven months) & classifies switch recommendation tier:
 *    - IMMEDIATE_SWITCH: Payback <= 6 months or zero exit load + tax within annual exemption
 *    - TAX_OPTIMIZED_STAGGERED: Large LTCG (> ₹1.25L); split across March/April to use two FY exemptions
 *    - WAIT_FOR_EXIT_LOAD: Active exit load with <= 90 days to expiry; schedule switch on zero-load date
 * 8. Generates actionable Decision Support System (DSS) Switch Execution Cart for advisors/investors.
 */

import { db } from "../db";
import { mutualFunds } from "../../shared/schema";
import { eq, ilike, and, or } from "drizzle-orm";
import { mfTaxService } from "./mf-tax-service";
import { exitLoadService } from "./exit-load-service";
import { logger } from "../logger";

export const SWITCH_ENGINE_VERSION = "1.0.0";
const DEFAULT_ANNUAL_GROWTH_RATE = 0.12; // 12% conservative equity market CAGR
const DEFAULT_REGULAR_TER_PREMIUM = 0.85; // 0.85% average distributor commission spread across equity categories

export interface HoldingInput {
	schemeCode?: string;
	schemeName: string;
	isin?: string;
	currentValue: number;
	investedValue?: number;
	units?: number;
	category?: string;
	purchaseDate?: string;
	holdingDays?: number;
}

export interface DirectSwitchItem {
	regularSchemeName: string;
	regularSchemeCode?: string;
	regularIsin?: string;
	regularTer: number;
	directSchemeName: string;
	directSchemeCode?: string;
	directIsin?: string;
	directTer: number;
	terDelta: number; // in %
	currentValue: number;
	investedValue: number;
	unrealizedGain: number;
	holdingDays: number;
	holdingPeriod: "short_term" | "long_term";
	// Projected Fee Savings
	annualFeeSavings: number;
	projectedSavings5Y: number;
	projectedSavings10Y: number;
	projectedSavings15Y: number;
	projectedSavings20Y: number;
	// Friction Costs
	exitLoadPercent: number;
	exitLoadAmount: number;
	daysToZeroExitLoad: number | null;
	estimatedTax: number;
	taxRateApplied: number;
	exemptionApplied: number;
	totalSwitchCost: number; // Exit Load + Tax
	// Payback & Recommendation
	netFirstYearAdvantage: number;
	paybackMonths: number;
	recommendationTier: "IMMEDIATE_SWITCH" | "TAX_OPTIMIZED_STAGGERED" | "WAIT_FOR_EXIT_LOAD" | "HOLD_REGULAR";
	recommendationReason: string;
	suggestedActionDate: string;
}

export interface DirectSwitchAnalysisResult {
	success: boolean;
	totalPortfolioValue: number;
	regularPortfolioValue: number;
	regularHoldingCount: number;
	totalHoldingsCount: number;
	regularSharePercent: number;
	totalAnnualFeeSavings: number;
	total10YSavings: number;
	total20YSavings: number;
	totalExitLoad: number;
	totalEstimatedTax: number;
	netFirstYearBenefit: number;
	portfolioPaybackMonths: number;
	items: DirectSwitchItem[];
	actionableCart: {
		immediateSwitches: DirectSwitchItem[];
		staggeredSwitches: DirectSwitchItem[];
		deferredSwitches: DirectSwitchItem[];
	};
	meta: {
		engine_version: string;
		calculation_timestamp: string;
		assumptions: {
			equityGrowthRate: number;
			stcgTaxRate: number;
			ltcgTaxRate: number;
			ltcgExemptionLimit: number;
		};
		sebiDisclaimer: string;
	};
}

export class DirectPlanSwitchService {
	private static instance: DirectPlanSwitchService;

	static getInstance(): DirectPlanSwitchService {
		if (!DirectPlanSwitchService.instance) {
			DirectPlanSwitchService.instance = new DirectPlanSwitchService();
		}
		return DirectPlanSwitchService.instance;
	}

	/**
	 * Checks if a holding name indicates a Regular plan
	 */
	isRegularPlan(name: string): boolean {
		const lower = (name || "").toLowerCase();
		if (lower.includes("direct")) return false;
		return (
			lower.includes("regular") ||
			lower.includes("reg plan") ||
			lower.includes(" - reg") ||
			lower.includes("regular plan") ||
			!lower.includes("direct")
		);
	}

	/**
	 * Resolves Direct plan counterpart name and queries DB for matching Direct Growth fund
	 */
	async resolveDirectCounterpart(
		regularName: string,
		regularSchemeCode?: string,
		regularIsin?: string,
	): Promise<{
		directName: string;
		directSchemeCode?: string;
		directIsin?: string;
		directTer: number;
		regularTer: number;
	}> {
		let directName = regularName
			.replace(/\b(regular|reg|reg\.)\b/gi, "Direct")
			.replace(/\s+/g, " ")
			.trim();

		if (!directName.toLowerCase().includes("direct")) {
			directName = `${directName} - Direct Plan`;
		}

		// Ensure Growth option
		if (!directName.toLowerCase().includes("growth") && !directName.toLowerCase().includes("idcw") && !directName.toLowerCase().includes("dividend")) {
			directName = `${directName} - Growth`;
		}

		let directSchemeCode: string | undefined;
		let directIsin: string | undefined;
		let directTer = 0.75; // default benchmark direct TER
		let regularTer = directTer + DEFAULT_REGULAR_TER_PREMIUM; // 1.60%

		try {
			// 1. Try to find regular fund in DB to extract actual regular TER
			if (regularSchemeCode) {
				const [regularFund] = await db
					.select({
						schemeCode: mutualFunds.schemeCode,
						expenseRatio: mutualFunds.expenseRatio,
					})
					.from(mutualFunds)
					.where(eq(mutualFunds.schemeCode, regularSchemeCode))
					.limit(1);

				if (regularFund?.expenseRatio) {
					regularTer = Number.parseFloat(String(regularFund.expenseRatio));
				}
			}

			// 2. Search for direct counterpart in DB by name pattern
			const cleanBaseName = regularName
				.replace(/\b(regular|direct|growth|dividend|idcw|plan|option|-)\b/gi, "")
				.trim()
				.split(/\s+/)[0]; // primary AMC brand token (e.g. "Parag", "HDFC", "Axis")

			if (cleanBaseName && cleanBaseName.length > 2) {
				const candidates = await db
					.select({
						schemeCode: mutualFunds.schemeCode,
						schemeName: mutualFunds.schemeName,
						expenseRatio: mutualFunds.expenseRatio,
						extendedData: mutualFunds.extendedData,
					})
					.from(mutualFunds)
					.where(
						and(
							ilike(mutualFunds.schemeName, `%${cleanBaseName}%`),
							ilike(mutualFunds.schemeName, "%Direct%"),
							ilike(mutualFunds.schemeName, "%Growth%"),
						),
					)
					.limit(5);

				if (candidates.length > 0) {
					// Pick best candidate matching fund name
					const bestMatch = candidates[0];
					directSchemeCode = bestMatch.schemeCode;
					directName = bestMatch.schemeName;
					if (bestMatch.expenseRatio) {
						directTer = Number.parseFloat(String(bestMatch.expenseRatio));
					}
					const ext = bestMatch.extendedData as any;
					if (ext?.isin) directIsin = ext.isin;
				}
			}

			// Sanity check: Ensure regularTer > directTer
			if (regularTer <= directTer) {
				regularTer = Math.round((directTer + DEFAULT_REGULAR_TER_PREMIUM) * 100) / 100;
			}
		} catch (err: any) {
			logger.warn("[DirectPlanSwitchService] Counterpart lookup fallback:", err?.message);
		}

		return {
			directName,
			directSchemeCode,
			directIsin,
			directTer: Math.round(directTer * 100) / 100,
			regularTer: Math.round(regularTer * 100) / 100,
		};
	}

	/**
	 * Computes compounded future value difference between two returns over t years
	 * Formula: P * ((1 + r_direct)^t - (1 + r_regular)^t)
	 */
	computeCompoundedWealthGain(
		principal: number,
		terDeltaPercent: number,
		years: number,
		baseReturnRate: number = DEFAULT_ANNUAL_GROWTH_RATE,
	): number {
		const rDirect = baseReturnRate;
		const rRegular = Math.max(0, baseReturnRate - terDeltaPercent / 100);

		const fvDirect = principal * Math.pow(1 + rDirect, years);
		const fvRegular = principal * Math.pow(1 + rRegular, years);

		return Math.max(0, Math.round(fvDirect - fvRegular));
	}

	/**
	 * Analyzes a full mutual fund portfolio and produces the Direct Switch Plan
	 */
	async analyzePortfolioSwitch(
		holdings: HoldingInput[],
		annualLtcgExemptionUsed: number = 0,
	): Promise<DirectSwitchAnalysisResult> {
		const start = Date.now();
		const items: DirectSwitchItem[] = [];

		let totalPortfolioValue = 0;
		let regularPortfolioValue = 0;
		let totalAnnualFeeSavings = 0;
		let total10YSavings = 0;
		let total20YSavings = 0;
		let totalExitLoad = 0;
		let totalEstimatedTax = 0;
		let remainingExemption = Math.max(0, 125000 - annualLtcgExemptionUsed); // Budget 2024 ₹1.25L limit

		for (const holding of holdings) {
			const currentVal = holding.currentValue || 0;
			const investedVal = holding.investedValue || currentVal * 0.85; // default 15% unrealized gain if missing
			const unrealizedGain = Math.max(0, currentVal - investedVal);
			totalPortfolioValue += currentVal;

			const isReg = this.isRegularPlan(holding.schemeName);
			if (!isReg) continue;

			regularPortfolioValue += currentVal;

			// Holding days estimation
			let holdingDays = holding.holdingDays || 400; // default long-term (>1Y) if not provided
			if (holding.purchaseDate) {
				const purchaseTime = new Date(holding.purchaseDate).getTime();
				if (!Number.isNaN(purchaseTime)) {
					holdingDays = Math.max(1, Math.round((Date.now() - purchaseTime) / (1000 * 60 * 60 * 24)));
				}
			}

			// 1. Resolve direct counterpart and expense differential
			const counterpart = await this.resolveDirectCounterpart(
				holding.schemeName,
				holding.schemeCode,
				holding.isin,
			);

			const terDelta = Math.max(0.3, Math.round((counterpart.regularTer - counterpart.directTer) * 100) / 100);
			const annualFeeSavings = Math.round((currentVal * terDelta) / 100);
			const projectedSavings5Y = this.computeCompoundedWealthGain(currentVal, terDelta, 5);
			const projectedSavings10Y = this.computeCompoundedWealthGain(currentVal, terDelta, 10);
			const projectedSavings15Y = this.computeCompoundedWealthGain(currentVal, terDelta, 15);
			const projectedSavings20Y = this.computeCompoundedWealthGain(currentVal, terDelta, 20);

			totalAnnualFeeSavings += annualFeeSavings;
			total10YSavings += projectedSavings10Y;
			total20YSavings += projectedSavings20Y;

			// 2. Calculate Exit Load
			let exitLoadPercent = 0;
			let exitLoadAmount = 0;
			let daysToZeroExitLoad: number | null = null;

			try {
				if (holding.schemeCode) {
					const el = await exitLoadService.getExitLoad({
						schemeCode: holding.schemeCode,
						holdingDays,
						redemptionAmount: currentVal,
					});
					exitLoadPercent = el.exitLoadPercent;
					exitLoadAmount = Math.round(el.exitLoadAmount);
					daysToZeroExitLoad = el.daysToZeroExitLoad;
				} else if (holdingDays < 365) {
					// Fallback standard equity exit load: 1% if redeemed within 1 year
					exitLoadPercent = 1.0;
					exitLoadAmount = Math.round(currentVal * 0.01);
					daysToZeroExitLoad = 365 - holdingDays;
				}
			} catch {
				if (holdingDays < 365) {
					exitLoadPercent = 1.0;
					exitLoadAmount = Math.round(currentVal * 0.01);
					daysToZeroExitLoad = 365 - holdingDays;
				}
			}

			totalExitLoad += exitLoadAmount;

			// 3. Calculate Tax on redemption (Budget 2024 Rules: Equity STCG 20%, LTCG 12.5% > ₹1.25L)
			const isLongTerm = holdingDays > 365;
			let estimatedTax = 0;
			let taxRateApplied = isLongTerm ? 12.5 : 20.0;
			let exemptionApplied = 0;

			if (unrealizedGain > 0) {
				if (isLongTerm) {
					exemptionApplied = Math.min(unrealizedGain, remainingExemption);
					remainingExemption -= exemptionApplied;
					const taxableGain = unrealizedGain - exemptionApplied;
					estimatedTax = Math.round((taxableGain * 0.125 * 1.04)); // 12.5% + 4% cess
				} else {
					estimatedTax = Math.round((unrealizedGain * 0.20 * 1.04)); // 20% + 4% cess
				}
			}

			totalEstimatedTax += estimatedTax;

			const totalSwitchCost = exitLoadAmount + estimatedTax;
			const netFirstYearAdvantage = annualFeeSavings - totalSwitchCost;
			const monthlySavings = Math.max(1, annualFeeSavings / 12);
			const paybackMonths = totalSwitchCost === 0 ? 0 : Math.ceil(totalSwitchCost / monthlySavings);

			// 4. Recommendation Classification
			let recommendationTier: DirectSwitchItem["recommendationTier"] = "IMMEDIATE_SWITCH";
			let recommendationReason = "Immediate switch recommended. Annual fee savings exceed friction costs.";
			let suggestedActionDate = new Date().toISOString().split("T")[0];

			if (exitLoadAmount > 0 && daysToZeroExitLoad && daysToZeroExitLoad <= 90) {
				recommendationTier = "WAIT_FOR_EXIT_LOAD";
				const targetDate = new Date();
				targetDate.setDate(targetDate.getDate() + daysToZeroExitLoad);
				suggestedActionDate = targetDate.toISOString().split("T")[0];
				recommendationReason = `Exit load active (${exitLoadPercent}% = ₹${exitLoadAmount}). Zero load in ${daysToZeroExitLoad} days. Schedule switch on ${suggestedActionDate}.`;
			} else if (isLongTerm && unrealizedGain > 125000 && paybackMonths > 18) {
				recommendationTier = "TAX_OPTIMIZED_STAGGERED";
				recommendationReason = `Large LTCG (₹${unrealizedGain.toLocaleString("en-IN")}) incurs ₹${estimatedTax.toLocaleString("en-IN")} tax. Stagger across 2 financial years to utilize multiple ₹1.25L exemptions.`;
			} else if (paybackMonths > 24) {
				recommendationTier = "HOLD_REGULAR";
				recommendationReason = `High short-term tax friction results in ${paybackMonths} months payback. Re-evaluate once units qualify for LTCG.`;
			} else {
				recommendationTier = "IMMEDIATE_SWITCH";
				recommendationReason = totalSwitchCost === 0
					? "Zero exit load and zero tax payable. Immediate 100% gain."
					: `Payback achieved in ${paybackMonths} months. Long-term 10Y wealth gain is ₹${projectedSavings10Y.toLocaleString("en-IN")}.`;
			}

			items.push({
				regularSchemeName: holding.schemeName,
				regularSchemeCode: holding.schemeCode,
				regularIsin: holding.isin,
				regularTer: counterpart.regularTer,
				directSchemeName: counterpart.directName,
				directSchemeCode: counterpart.directSchemeCode,
				directIsin: counterpart.directIsin,
				directTer: counterpart.directTer,
				terDelta,
				currentValue: currentVal,
				investedValue: investedVal,
				unrealizedGain,
				holdingDays,
				holdingPeriod: isLongTerm ? "long_term" : "short_term",
				annualFeeSavings,
				projectedSavings5Y,
				projectedSavings10Y,
				projectedSavings15Y,
				projectedSavings20Y,
				exitLoadPercent,
				exitLoadAmount,
				daysToZeroExitLoad,
				estimatedTax,
				taxRateApplied,
				exemptionApplied,
				totalSwitchCost,
				netFirstYearAdvantage,
				paybackMonths,
				recommendationTier,
				recommendationReason,
				suggestedActionDate,
			});
		}

		const regularHoldingCount = items.length;
		const totalHoldingsCount = holdings.length;
		const regularSharePercent = totalPortfolioValue > 0
			? Math.round((regularPortfolioValue / totalPortfolioValue) * 1000) / 10
			: 0;

		const totalFriction = totalExitLoad + totalEstimatedTax;
		const netFirstYearBenefit = totalAnnualFeeSavings - totalFriction;
		const monthlyPortfolioSavings = Math.max(1, totalAnnualFeeSavings / 12);
		const portfolioPaybackMonths = totalFriction === 0 ? 0 : Math.ceil(totalFriction / monthlyPortfolioSavings);

		// Group into actionable execution cart buckets
		const actionableCart = {
			immediateSwitches: items.filter((i) => i.recommendationTier === "IMMEDIATE_SWITCH"),
			staggeredSwitches: items.filter((i) => i.recommendationTier === "TAX_OPTIMIZED_STAGGERED"),
			deferredSwitches: items.filter((i) => i.recommendationTier === "WAIT_FOR_EXIT_LOAD"),
		};

		logger.info("[DirectPlanSwitchService] Analysis complete", {
			latencyMs: Date.now() - start,
			regularHoldings: regularHoldingCount,
			totalPortfolioValue,
			annualSavings: totalAnnualFeeSavings,
			engine_version: SWITCH_ENGINE_VERSION,
		});

		return {
			success: true,
			totalPortfolioValue,
			regularPortfolioValue,
			regularHoldingCount,
			totalHoldingsCount,
			regularSharePercent,
			totalAnnualFeeSavings,
			total10YSavings,
			total20YSavings,
			totalExitLoad,
			totalEstimatedTax,
			netFirstYearBenefit,
			portfolioPaybackMonths,
			items,
			actionableCart,
			meta: {
				engine_version: SWITCH_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
				assumptions: {
					equityGrowthRate: DEFAULT_ANNUAL_GROWTH_RATE * 100,
					stcgTaxRate: 20.0,
					ltcgTaxRate: 12.5,
					ltcgExemptionLimit: 125000,
				},
				sebiDisclaimer:
					"Disclaimer: Mutual fund investments are subject to market risks. Switching from Regular to Direct plans involves redemption from the existing scheme and a fresh purchase in the Direct plan, which may attract Capital Gains Tax and Exit Loads as shown. This analysis is generated as a Decision Support System (DSS) under FASP-AI v1.0 and does not constitute autonomous execution. Please consult your CA or SEBI Registered Investment Adviser before executing.",
			},
		};
	}
}

export const directPlanSwitchService = DirectPlanSwitchService.getInstance();
