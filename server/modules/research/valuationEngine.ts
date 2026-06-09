export function pegRating(pe: number | null, growth: number | null): string {
	if (!pe || !growth || growth <= 0) return "Insufficient Data";
	const peg = pe / (growth * 100);
	if (peg < 1) return "Undervalued";
	if (peg < 2) return "Fair Value";
	return "Overvalued";
}

export function priceToTargetUpside(
	price: number | null,
	target: number | null,
): number | null {
	if (!price || !target) return null;
	return ((target - price) / price) * 100;
}

export function valuationSummary(
	pe: number | null,
	roe: number | null,
	debtToEquity: number | null,
	revenueGrowth: number | null,
	pbRatio: number | null = null,
): string {
	const checks: string[] = [];

	if (pe !== null) {
		if (pe < 15) checks.push("Low PE (attractive)");
		else if (pe < 30) checks.push("Moderate PE");
		else checks.push("High PE (premium valuation)");
	}

	if (roe !== null) {
		if (roe > 0.2) checks.push("High ROE (>20%)");
		else if (roe > 0.1) checks.push("Moderate ROE");
		else checks.push("Low ROE (<10%)");
	}

	if (pbRatio !== null) {
		if (pbRatio < 1) checks.push("Trading Below Book (deep value)");
		else if (pbRatio < 3) checks.push("Reasonable P/B");
		else if (pbRatio < 6) checks.push("Premium P/B");
		else checks.push("High P/B (growth premium)");
	}

	if (debtToEquity !== null) {
		if (debtToEquity < 0.5) checks.push("Low Debt");
		else if (debtToEquity < 1.5) checks.push("Moderate Debt");
		else checks.push("High Debt");
	}

	if (revenueGrowth !== null) {
		if (revenueGrowth > 0.15) checks.push("Strong Revenue Growth");
		else if (revenueGrowth > 0) checks.push("Positive Revenue Growth");
		else checks.push("Declining Revenue");
	}

	return checks.join(" | ") || "Limited Data Available";
}
