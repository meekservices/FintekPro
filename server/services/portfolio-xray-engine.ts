/**
 * FintekPro Portfolio X-Ray & Financial Diagnostic Engine (v1.0)
 * Adheres to FintekPro Financial Logic Integrity (GCR v1.0 + FASP-AI v1.0)
 * Deterministic calculation of Asset Allocation, Expense Drag, and Risk Metrics.
 */

export interface PortfolioBreakdownInput {
	equityMutualFunds: number; // in ₹
	directStocks: number;      // in ₹
	debtAndFD: number;         // in ₹
	goldAndCommodities: number;// in ₹
	cashAndLiquid: number;     // in ₹
	riskProfile?: "conservative" | "balanced" | "aggressive";
	primaryGoal?: "wealth_growth" | "tax_saving" | "retirement" | "regular_income";
}

export interface PortfolioXRayResult {
	engine_version: string;
	calculation_timestamp: string;
	inputs_used: PortfolioBreakdownInput;
	summary: {
		totalPortfolioValue: number;
		formattedTotal: string;
		healthScore: number; // 0 - 100
		healthCategory: "Excellent" | "Good" | "Needs Attention" | "High Risk";
		primaryRiskProfile: "conservative" | "balanced" | "aggressive";
	};
	assetAllocation: {
		equityPct: number;
		debtPct: number;
		goldPct: number;
		cashPct: number;
		idealEquityPct: number;
		idealDebtPct: number;
		idealGoldPct: number;
		idealCashPct: number;
		imbalancePct: number;
	};
	feeDragAnalysis: {
		estimatedRegularExpenseRatioPct: number; // typically 1.75%
		estimatedDirectExpenseRatioPct: number;  // typically 0.65%
		annualExpenseLeakage: number;            // ₹ lost to distributor commissions / yr
		fiveYearCompoundedLeakage: number;       // ₹ compounded at 12%
		tenYearCompoundedLeakage: number;        // ₹ compounded at 12%
	};
	diagnostics: {
		strengths: string[];
		redFlags: string[];
		recommendedActions: string[];
	};
	disclaimer: string;
}

export function computePortfolioXRay(input: PortfolioBreakdownInput): PortfolioXRayResult {
	const equityMF = Math.max(0, Number(input.equityMutualFunds) || 0);
	const stocks = Math.max(0, Number(input.directStocks) || 0);
	const debt = Math.max(0, Number(input.debtAndFD) || 0);
	const gold = Math.max(0, Number(input.goldAndCommodities) || 0);
	const cash = Math.max(0, Number(input.cashAndLiquid) || 0);

	const totalValue = equityMF + stocks + debt + gold + cash;
	const safeTotal = totalValue > 0 ? totalValue : 1; // avoid divide by zero

	const totalEquity = equityMF + stocks;
	const equityPct = Math.round((totalEquity / safeTotal) * 100);
	const debtPct = Math.round((debt / safeTotal) * 100);
	const goldPct = Math.round((gold / safeTotal) * 100);
	const cashPct = Math.max(0, 100 - (equityPct + debtPct + goldPct));

	const riskProfile = input.riskProfile || "balanced";

	// Benchmark ideal allocations based on risk profile
	let idealEquityPct = 60;
	let idealDebtPct = 30;
	let idealGoldPct = 10;
	let idealCashPct = 0;

	if (riskProfile === "conservative") {
		idealEquityPct = 30;
		idealDebtPct = 55;
		idealGoldPct = 10;
		idealCashPct = 5;
	} else if (riskProfile === "aggressive") {
		idealEquityPct = 80;
		idealDebtPct = 15;
		idealGoldPct = 5;
		idealCashPct = 0;
	}

	// Calculate absolute allocation imbalance
	const imbalancePct = Math.round(
		(Math.abs(equityPct - idealEquityPct) +
			Math.abs(debtPct - idealDebtPct) +
			Math.abs(goldPct - idealGoldPct)) /
			2,
	);

	// Fee Drag calculation:
	// Mutual fund regular plans have ~1.00% to 1.25% commission leakage vs direct/advisory
	const regularExpenseRatio = 1.75;
	const directExpenseRatio = 0.65;
	const commissionDiff = (regularExpenseRatio - directExpenseRatio) / 100; // 1.10%

	const annualExpenseLeakage = Math.round(equityMF * commissionDiff);

	// Compound interest formula: FV = P * [((1 + r)^n - 1) / r]
	const growthRate = 0.12; // 12% equity expected long term
	const fiveYearMultiplier = (Math.pow(1 + growthRate, 5) - 1) / growthRate;
	const tenYearMultiplier = (Math.pow(1 + growthRate, 10) - 1) / growthRate;

	const fiveYearCompoundedLeakage = Math.round(annualExpenseLeakage * fiveYearMultiplier);
	const tenYearCompoundedLeakage = Math.round(annualExpenseLeakage * tenYearMultiplier);

	// Compute holistic health score (0 - 100)
	let score = 100;

	// Penalty for severe asset allocation imbalance
	if (imbalancePct > 30) score -= 25;
	else if (imbalancePct > 15) score -= 15;
	else if (imbalancePct > 8) score -= 5;

	// Penalty for high regular expense drag
	if (annualExpenseLeakage > 50000) score -= 20;
	else if (annualExpenseLeakage > 15000) score -= 10;
	else if (annualExpenseLeakage > 5000) score -= 5;

	// Penalty for extreme concentration (100% in one asset)
	if (equityPct >= 95 || debtPct >= 95) score -= 15;

	// Penalty for zero gold/hedge
	if (goldPct === 0 && totalValue >= 500000) score -= 5;

	score = Math.max(25, Math.min(98, score));

	let healthCategory: "Excellent" | "Good" | "Needs Attention" | "High Risk" = "Good";
	if (score >= 85) healthCategory = "Excellent";
	else if (score >= 70) healthCategory = "Good";
	else if (score >= 50) healthCategory = "Needs Attention";
	else healthCategory = "High Risk";

	// Formulate strengths and red flags
	const strengths: string[] = [];
	const redFlags: string[] = [];
	const recommendedActions: string[] = [];

	if (totalEquity > 0) {
		strengths.push(`Equity exposure of ${equityPct}% provides a strong growth engine against inflation.`);
	}
	if (debtPct >= 15 && debtPct <= 40) {
		strengths.push(`Solid fixed income cushion (${debtPct}%) provides drawdown protection during market corrections.`);
	}
	if (goldPct >= 5 && goldPct <= 15) {
		strengths.push(`Optimal sovereign gold/precious metal hedge (${goldPct}%) against geopolitical volatility.`);
	}

	if (annualExpenseLeakage >= 10000) {
		redFlags.push(
			`Estimated ₹${annualExpenseLeakage.toLocaleString("en-IN")}/year lost to Regular Mutual Fund commissions (~₹${(tenYearCompoundedLeakage / 100000).toFixed(1)} Lakhs over 10 years).`,
		);
		recommendedActions.push("Transition Regular Mutual Fund schemes to Direct plans with a SEBI-registered fee-only advisor.");
	}

	if (imbalancePct > 15) {
		redFlags.push(
			`Asset allocation is deviated by ${imbalancePct}% from your ideal ${riskProfile} risk profile target.`,
		);
		recommendedActions.push("Rebalance portfolio to align equity-to-debt ratio with your planned investment horizon.");
	}

	if (goldPct === 0 && totalValue >= 300000) {
		redFlags.push("Zero allocation to Gold/Sovereign hedges leaves portfolio vulnerable to systemic shocks.");
		recommendedActions.push("Consider deploying 5–10% into Sovereign Gold Bonds (SGB) or Multi-Asset Allocation funds.");
	}

	if (cashPct > 20 && totalValue >= 200000) {
		redFlags.push(`High cash drag (${cashPct}% in savings/cash) earning sub-inflation returns.`);
		recommendedActions.push("Deploy idle bank balance into high-yield Arbitrage or Liquid funds with instant liquidity.");
	}

	if (recommendedActions.length === 0) {
		recommendedActions.push("Review tax-loss harvesting opportunities under the revised 12.5% LTCG slab.");
		recommendedActions.push("Schedule an annual portfolio checkup with your FintekPro advisor.");
	}

	// Format total value
	let formattedTotal = `₹${totalValue.toLocaleString("en-IN")}`;
	if (totalValue >= 10000000) {
		formattedTotal = `₹${(totalValue / 10000000).toFixed(2)} Cr`;
	} else if (totalValue >= 100000) {
		formattedTotal = `₹${(totalValue / 100000).toFixed(2)} Lakhs`;
	}

	return {
		engine_version: "FASP-XRAY-1.0",
		calculation_timestamp: new Date().toISOString(),
		inputs_used: input,
		summary: {
			totalPortfolioValue: totalValue,
			formattedTotal,
			healthScore: score,
			healthCategory,
			primaryRiskProfile: riskProfile,
		},
		assetAllocation: {
			equityPct,
			debtPct,
			goldPct,
			cashPct,
			idealEquityPct,
			idealDebtPct,
			idealGoldPct,
			idealCashPct,
			imbalancePct,
		},
		feeDragAnalysis: {
			estimatedRegularExpenseRatioPct: regularExpenseRatio,
			estimatedDirectExpenseRatioPct: directExpenseRatio,
			annualExpenseLeakage,
			fiveYearCompoundedLeakage,
			tenYearCompoundedLeakage,
		},
		diagnostics: {
			strengths,
			redFlags,
			recommendedActions,
		},
		disclaimer:
			"This Financial Diagnostic Report is generated as an informational decision support tool by FintekPro. Investments in securities market are subject to market risks. Read all scheme related documents carefully. Consult a SEBI-registered Investment Advisor (RIA) before executing investment decisions.",
	};
}
