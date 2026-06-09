import { db } from "../db";
import { mfTaxRules, mfSchemeExitLoads } from "@shared/schema";
import { eq, and, isNull, lte, gte, or } from "drizzle-orm";
import { exitLoadService } from "./exit-load-service";

interface TaxCalculation {
	fundType: string;
	holdingPeriod: "short_term" | "long_term";
	holdingDays: number;
	taxRate: number;
	taxableGain: number;
	taxAmount: number;
	cessAmount: number;
	totalTax: number;
	netGain: number;
	exemptionUsed: number;
	description: string;
}

interface ExitLoadCalculation {
	schemeCode: string;
	holdingDays: number;
	exitLoadPercent: number;
	exitLoadAmount: number;
	netRedemption: number;
	exitLoadDescription: string;
	daysToZeroExitLoad: number | null;
}

interface WithdrawalSummary {
	investmentAmount: number;
	currentValue: number;
	absoluteGain: number;
	exitLoad: ExitLoadCalculation;
	tax: TaxCalculation;
	netProceeds: number;
	effectiveReturn: number;
}

class MFTaxService {
	private detectFundType(category: string, schemeName: string): string {
		const lowerCategory = (category || "").toLowerCase();
		const lowerName = (schemeName || "").toLowerCase();

		if (lowerName.includes("elss") || lowerCategory.includes("elss")) {
			return "elss";
		}
		if (
			lowerName.includes("gold") ||
			lowerName.includes("silver") ||
			lowerCategory.includes("gold")
		) {
			return "gold_etf";
		}
		if (
			lowerCategory.includes("equity") ||
			lowerCategory.includes("large cap") ||
			lowerCategory.includes("mid cap") ||
			lowerCategory.includes("small cap") ||
			lowerCategory.includes("flexi") ||
			lowerCategory.includes("multi cap")
		) {
			return "equity";
		}
		if (
			lowerCategory.includes("debt") ||
			lowerCategory.includes("liquid") ||
			lowerCategory.includes("money market") ||
			lowerCategory.includes("gilt") ||
			lowerCategory.includes("corporate bond") ||
			lowerCategory.includes("banking")
		) {
			return "debt";
		}
		if (
			lowerCategory.includes("hybrid") ||
			lowerCategory.includes("balanced")
		) {
			return lowerName.includes("conservative") ? "debt" : "hybrid_equity";
		}

		return "equity";
	}

	async getTaxRules(fundType: string): Promise<
		Array<{
			holdingPeriodType: string;
			minHoldingDays: number;
			maxHoldingDays: number | null;
			taxRate: number;
			exemptionLimit: number | null;
			cessRate: number;
			description: string;
		}>
	> {
		const rules = await db
			.select()
			.from(mfTaxRules)
			.where(
				and(eq(mfTaxRules.fundType, fundType), isNull(mfTaxRules.effectiveTo)),
			);

		return rules.map((r) => ({
			holdingPeriodType: r.holdingPeriodType,
			minHoldingDays: r.minHoldingDays,
			maxHoldingDays: r.maxHoldingDays,
			taxRate: Number.parseFloat(r.taxRate),
			exemptionLimit: r.exemptionLimit
				? Number.parseFloat(r.exemptionLimit)
				: null,
			cessRate: Number.parseFloat(r.cessRate || "4"),
			description: r.description || "",
		}));
	}

	async calculateTax(
		gain: number,
		holdingDays: number,
		category: string,
		schemeName: string,
		slabRate: number = 30,
	): Promise<TaxCalculation> {
		const fundType = this.detectFundType(category, schemeName);
		const rules = await this.getTaxRules(fundType);

		let applicableRule = rules.find(
			(r) =>
				holdingDays >= r.minHoldingDays &&
				(r.maxHoldingDays === null || holdingDays <= r.maxHoldingDays),
		);

		if (!applicableRule && fundType === "debt") {
			return {
				fundType,
				holdingPeriod: "short_term",
				holdingDays,
				taxRate: slabRate,
				taxableGain: gain,
				taxAmount: (gain * slabRate) / 100,
				cessAmount: ((gain * slabRate) / 100) * 0.04,
				totalTax: ((gain * slabRate) / 100) * 1.04,
				netGain: gain - ((gain * slabRate) / 100) * 1.04,
				exemptionUsed: 0,
				description: `Debt fund gains taxed at your slab rate (${slabRate}%)`,
			};
		}

		if (!applicableRule) {
			applicableRule = {
				holdingPeriodType: holdingDays > 365 ? "long_term" : "short_term",
				minHoldingDays: 0,
				maxHoldingDays: null,
				taxRate: holdingDays > 365 ? 12.5 : 20,
				exemptionLimit: holdingDays > 365 ? 125000 : null,
				cessRate: 4,
				description: "Default equity tax rates",
			};
		}

		const holdingPeriod = applicableRule.holdingPeriodType as
			| "short_term"
			| "long_term";
		const exemptionUsed = applicableRule.exemptionLimit
			? Math.min(gain, applicableRule.exemptionLimit)
			: 0;
		const taxableGain = Math.max(0, gain - exemptionUsed);
		const taxAmount = (taxableGain * applicableRule.taxRate) / 100;
		const cessAmount = (taxAmount * applicableRule.cessRate) / 100;
		const totalTax = taxAmount + cessAmount;

		return {
			fundType,
			holdingPeriod,
			holdingDays,
			taxRate: applicableRule.taxRate,
			taxableGain,
			taxAmount: Math.round(taxAmount * 100) / 100,
			cessAmount: Math.round(cessAmount * 100) / 100,
			totalTax: Math.round(totalTax * 100) / 100,
			netGain: Math.round((gain - totalTax) * 100) / 100,
			exemptionUsed,
			description: applicableRule.description,
		};
	}

	async getExitLoadForScheme(
		schemeCode: string,
		holdingDays: number,
	): Promise<{
		exitLoadPercent: number;
		description: string;
		daysToZeroExitLoad: number | null;
		source: "database" | "generic";
	}> {
		// Use centralized ExitLoadService for ISIN/schemeCode lookup with caching
		try {
			const result = await exitLoadService.getExitLoad({
				schemeCode,
				holdingDays,
				redemptionAmount: 0, // Just need the percent, not the amount
			});

			return {
				exitLoadPercent: result.exitLoadPercent,
				description: result.description,
				daysToZeroExitLoad: result.daysToZeroExitLoad,
				source: result.source,
			};
		} catch (error) {
			console.error("[MFTaxService] Exit load lookup failed:", error);
			return {
				exitLoadPercent: 0,
				description: "Exit load information not available",
				daysToZeroExitLoad: null,
				source: "generic",
			};
		}
	}

	/**
	 * Get exit load for a fund by ISIN (uses centralized service)
	 */
	async getExitLoadByIsin(
		isin: string,
		holdingDays: number,
	): Promise<{
		exitLoadPercent: number;
		description: string;
		daysToZeroExitLoad: number | null;
		source: "database" | "generic";
	}> {
		try {
			const result = await exitLoadService.getExitLoad({
				isin,
				holdingDays,
				redemptionAmount: 0,
			});

			return {
				exitLoadPercent: result.exitLoadPercent,
				description: result.description,
				daysToZeroExitLoad: result.daysToZeroExitLoad,
				source: result.source,
			};
		} catch (error) {
			console.error("[MFTaxService] Exit load lookup by ISIN failed:", error);
			return {
				exitLoadPercent: 0,
				description: "Exit load information not available",
				daysToZeroExitLoad: null,
				source: "generic",
			};
		}
	}

	async calculateExitLoad(
		schemeCode: string,
		redemptionAmount: number,
		holdingDays: number,
	): Promise<ExitLoadCalculation> {
		const exitLoadInfo = await this.getExitLoadForScheme(
			schemeCode,
			holdingDays,
		);
		const exitLoadAmount =
			(redemptionAmount * exitLoadInfo.exitLoadPercent) / 100;

		return {
			schemeCode,
			holdingDays,
			exitLoadPercent: exitLoadInfo.exitLoadPercent,
			exitLoadAmount: Math.round(exitLoadAmount * 100) / 100,
			netRedemption:
				Math.round((redemptionAmount - exitLoadAmount) * 100) / 100,
			exitLoadDescription: exitLoadInfo.description,
			daysToZeroExitLoad: exitLoadInfo.daysToZeroExitLoad,
		};
	}

	async calculateWithdrawalSummary(
		schemeCode: string,
		investmentAmount: number,
		currentValue: number,
		holdingDays: number,
		category: string,
		schemeName: string,
		slabRate: number = 30,
	): Promise<WithdrawalSummary> {
		const absoluteGain = currentValue - investmentAmount;

		const exitLoad = await this.calculateExitLoad(
			schemeCode,
			currentValue,
			holdingDays,
		);

		const taxableGain = absoluteGain > 0 ? absoluteGain : 0;
		const tax = await this.calculateTax(
			taxableGain,
			holdingDays,
			category,
			schemeName,
			slabRate,
		);

		const netProceeds = exitLoad.netRedemption - tax.totalTax;
		const effectiveReturn =
			((netProceeds - investmentAmount) / investmentAmount) * 100;

		return {
			investmentAmount,
			currentValue,
			absoluteGain: Math.round(absoluteGain * 100) / 100,
			exitLoad,
			tax,
			netProceeds: Math.round(netProceeds * 100) / 100,
			effectiveReturn: Math.round(effectiveReturn * 100) / 100,
		};
	}

	getExitLoadTimeline(schemeCode: string): Promise<
		Array<{
			tier: number;
			minDays: number;
			maxDays: number | null;
			exitLoadPercent: number;
			description: string;
		}>
	> {
		return db
			.select({
				tier: mfSchemeExitLoads.tier,
				minDays: mfSchemeExitLoads.minDays,
				maxDays: mfSchemeExitLoads.maxDays,
				exitLoadPercent: mfSchemeExitLoads.exitLoadPercent,
				description: mfSchemeExitLoads.description,
			})
			.from(mfSchemeExitLoads)
			.where(eq(mfSchemeExitLoads.schemeCode, schemeCode))
			.orderBy(mfSchemeExitLoads.tier)
			.then((rows) =>
				rows.map((r) => ({
					tier: r.tier,
					minDays: r.minDays,
					maxDays: r.maxDays,
					exitLoadPercent: Number.parseFloat(r.exitLoadPercent),
					description: r.description || "",
				})),
			);
	}

	getTaxSummary(fundType: string): {
		stcgRate: number;
		ltcgRate: number;
		ltcgExemption: number;
		holdingPeriodForLTCG: number;
		notes: string[];
	} {
		const taxRates: Record<string, any> = {
			equity: {
				stcgRate: 20,
				ltcgRate: 12.5,
				ltcgExemption: 125000,
				holdingPeriodForLTCG: 365,
				notes: [
					"STCG (≤12 months): 20% + 4% cess",
					"LTCG (>12 months): 12.5% above ₹1.25 lakh + 4% cess",
					"Effective from July 23, 2024",
				],
			},
			debt: {
				stcgRate: 0,
				ltcgRate: 0,
				ltcgExemption: 0,
				holdingPeriodForLTCG: 0,
				notes: [
					"All gains taxed at your income tax slab rate",
					"No LTCG benefit for debt funds (post Apr 2023)",
					"No indexation benefit available",
				],
			},
			elss: {
				stcgRate: 0,
				ltcgRate: 12.5,
				ltcgExemption: 125000,
				holdingPeriodForLTCG: 1095,
				notes: [
					"3-year mandatory lock-in period",
					"LTCG: 12.5% above ₹1.25 lakh after lock-in",
					"Investment eligible for 80C deduction (up to ₹1.5 lakh)",
				],
			},
			gold_etf: {
				stcgRate: 20,
				ltcgRate: 12.5,
				ltcgExemption: 125000,
				holdingPeriodForLTCG: 365,
				notes: [
					"Treated as equity for tax purposes (post Budget 2024)",
					"STCG (≤12 months): 20%",
					"LTCG (>12 months): 12.5% above ₹1.25 lakh",
				],
			},
			hybrid_equity: {
				stcgRate: 20,
				ltcgRate: 12.5,
				ltcgExemption: 125000,
				holdingPeriodForLTCG: 365,
				notes: [
					"Hybrid funds with ≥65% equity exposure",
					"Same tax treatment as equity funds",
					"STCG: 20%, LTCG: 12.5%",
				],
			},
		};

		return taxRates[fundType] || taxRates.equity;
	}
}

export const mfTaxService = new MFTaxService();
