/**
 * Helper function to calculate FintekPro Smart Rating based on fund metrics
 * Rating: 1 = Exceptional, 2 = Good, 3 = Average, 4 = Below Average, 5 = Poor
 */
export const calculateFintekProRating = (fund: any): number => {
	let score = 0;
	let factors = 0;

	// Factor 1: 1-year returns (40% weight)
	const returns1y = Number.parseFloat(fund.returns1y || "0");
	if (returns1y > 25) score += 40 * 1;
	else if (returns1y > 15) score += 40 * 0.8;
	else if (returns1y > 10) score += 40 * 0.6;
	else if (returns1y > 5) score += 40 * 0.4;
	else if (returns1y > 0) score += 40 * 0.2;
	factors += 40;

	// Factor 2: Risk level (30% weight) - lower risk = higher score for conservative investors
	const riskLevel = (fund.riskLevel || "").toLowerCase();
	if (riskLevel.includes("low")) score += 30 * 0.6;
	else if (riskLevel.includes("moderate")) score += 30 * 0.8;
	else if (riskLevel.includes("high")) score += 30 * 0.5;
	else score += 30 * 0.5; // Default moderate
	factors += 30;

	// Factor 3: Category bonus (15% weight)
	const category = (fund.category || "").toLowerCase();
	if (category.includes("equity")) score += 15 * 0.7;
	else if (category.includes("debt") || category.includes("bond"))
		score += 15 * 0.6;
	else if (category.includes("hybrid")) score += 15 * 0.8;
	else if (category.includes("index")) score += 15 * 0.65;
	else score += 15 * 0.5;
	factors += 15;

	// Factor 4: AUM presence (15% weight)
	const aum = Number.parseFloat(fund.aum || "0");
	if (aum > 10000) score += 15 * 1;
	else if (aum > 5000) score += 15 * 0.8;
	else if (aum > 1000) score += 15 * 0.6;
	else score += 15 * 0.4;
	factors += 15;

	// Calculate final rating (1-5 scale)
	const normalizedScore = score / factors;
	if (normalizedScore >= 0.8) return 1;
	if (normalizedScore >= 0.6) return 2;
	if (normalizedScore >= 0.4) return 3;
	if (normalizedScore >= 0.2) return 4;
	return 5;
};
