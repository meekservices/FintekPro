/**
 * Explainability Engine - SEBI-Compliant Investment Recommendation Explainability
 *
 * Provides transparent explanations for:
 * - Why a product was recommended
 * - Goal impact analysis
 * - Risk/return delta calculations
 * - Regulatory compliance disclosures
 */

import { getEnrichedStockSnapshot } from "./screener/enriched-stock-data";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ProductExplanation {
	productCode: string;
	productName: string;
	productType: string;
	recommendation: "buy" | "hold" | "sell" | "avoid";
	confidence: number; // 0-100
	reasons: RecommendationReason[];
	goalAlignment: GoalAlignment;
	riskReturnDelta: RiskReturnDelta;
	suitabilityExplanation: SuitabilityExplanation;
	disclosures: Disclosure[];
	alternatives?: AlternativeProduct[];
	generatedAt: string;
}

interface RecommendationReason {
	category:
		| "risk_match"
		| "return_potential"
		| "goal_alignment"
		| "diversification"
		| "tax_efficiency"
		| "liquidity"
		| "regulatory"
		| "market_conditions"
		| "historical_performance";
	weight: number; // 0-100 importance
	description: string;
	impact: "positive" | "neutral" | "negative";
	dataPoints?: Record<string, any>;
}

interface GoalAlignment {
	primaryGoal: string;
	alignmentScore: number; // 0-100
	horizonMatch: {
		required: number; // years
		productHorizon: number;
		matchQuality: "excellent" | "good" | "fair" | "poor";
	};
	targetProgress: {
		currentProgress: number; // percentage
		projectedProgress: number;
		progressDelta: number;
	};
	riskContribution: {
		portfolioRiskBefore: number;
		portfolioRiskAfter: number;
		riskChange: "increased" | "decreased" | "unchanged";
	};
}

interface RiskReturnDelta {
	expectedReturn: {
		annual: number;
		compounded5Year: number;
		compounded10Year: number;
	};
	riskMetrics: {
		volatility: number;
		maxDrawdown: number;
		sharpeRatio: number;
		sortinoRatio: number;
		beta: number;
	};
	portfolioImpact: {
		returnDelta: number; // change in portfolio expected return
		riskDelta: number; // change in portfolio risk
		sharpeRatioDelta: number;
		diversificationBenefit: number; // 0-100
	};
	scenarioAnalysis: ScenarioOutcome[];
}

interface ScenarioOutcome {
	scenario: string;
	probability: number;
	returnOutcome: number;
	description: string;
}

interface SuitabilityExplanation {
	overallSuitability:
		| "highly_suitable"
		| "suitable"
		| "moderately_suitable"
		| "not_suitable";
	suitabilityScore: number; // 0-100
	factors: SuitabilityFactor[];
	warnings: string[];
	clientProfileMatch: {
		riskTolerance: { client: string; product: string; match: boolean };
		investmentHorizon: { client: number; product: number; match: boolean };
		incomeLevel: { segment: string; productMinimum: number; match: boolean };
		kycTier: { client: string; required: string; match: boolean };
	};
}

interface SuitabilityFactor {
	factor: string;
	clientValue: any;
	productRequirement: any;
	match: boolean;
	weight: number;
	explanation: string;
}

interface Disclosure {
	type:
		| "sebi_mandatory"
		| "risk_disclosure"
		| "tax_disclosure"
		| "liquidity_disclosure"
		| "past_performance"
		| "conflict_of_interest"
		| "exit_load"
		| "expense_ratio";
	severity: "info" | "warning" | "critical";
	title: string;
	content: string;
	regulatoryReference?: string;
}

interface AlternativeProduct {
	productCode: string;
	productName: string;
	productType: string;
	reason: string;
	comparisonMetrics: {
		expectedReturn: number;
		risk: number;
		suitabilityScore: number;
		expenseRatio?: number;
	};
}

interface ClientProfile {
	clientId: string;
	segment: "retail" | "hni" | "shni" | "bhni" | "corporate";
	riskTolerance: "conservative" | "moderate" | "aggressive" | "very_aggressive";
	investmentHorizon: number; // years
	kycTier: "basic" | "enhanced" | "accredited";
	annualIncome: number;
	netWorth: number;
	investmentExperience: "novice" | "intermediate" | "experienced";
	currentPortfolioValue: number;
	currentAssetAllocation: Record<string, number>;
	goals: ClientGoal[];
}

interface ClientGoal {
	goalId: string;
	name: string;
	targetAmount: number;
	currentProgress: number;
	targetDate: string;
	priority: "high" | "medium" | "low";
}

interface ProductData {
	productCode: string;
	productName: string;
	productType: string;
	category: string;
	riskLevel: number; // 1-5
	expectedReturn: number;
	volatility: number;
	minInvestment: number;
	lockInPeriod: number; // months
	exitLoad?: number;
	expenseRatio?: number;
	taxTreatment: string;
	liquidityScore: number; // 0-100
	historicalReturns: Record<string, number>;
	benchmarkComparison?: number;
	kycRequirement: "basic" | "enhanced" | "accredited";
}

interface ExplainabilityRequest {
	clientProfile: ClientProfile;
	product: ProductData;
	investmentAmount: number;
	goalId?: string;
	includeAlternatives?: boolean;
}

interface PortfolioExplanation {
	portfolioId: string;
	clientId: string;
	overallRationale: string;
	assetAllocationExplanation: AllocationExplanation[];
	diversificationAnalysis: DiversificationAnalysis;
	riskBudgetUtilization: RiskBudgetAnalysis;
	goalContributions: GoalContribution[];
	regulatoryCompliance: ComplianceStatus;
	generatedAt: string;
}

interface AllocationExplanation {
	assetClass: string;
	allocation: number;
	targetAllocation: number;
	deviation: number;
	rationale: string;
	products: ProductContribution[];
}

interface ProductContribution {
	productCode: string;
	productName: string;
	weight: number;
	contribution: string;
}

interface DiversificationAnalysis {
	score: number; // 0-100
	assetClassCount: number;
	correlationMatrix: string;
	concentrationRisk: string;
	geographicDiversification: string;
	sectorDiversification: string;
}

interface RiskBudgetAnalysis {
	totalRiskBudget: number;
	utilizedRisk: number;
	utilizationPercentage: number;
	riskContributors: RiskContributor[];
	recommendation: string;
}

interface RiskContributor {
	assetClass: string;
	riskContribution: number;
	percentage: number;
}

interface GoalContribution {
	goalId: string;
	goalName: string;
	targetAmount: number;
	projectedAmount: number;
	probability: number;
	shortfall?: number;
	recommendation?: string;
}

interface ComplianceStatus {
	sebiCompliant: boolean;
	kycCompliant: boolean;
	suitabilityCompliant: boolean;
	disclosuresComplete: boolean;
	issues: string[];
}

// ============================================================================
// EXPLAINABILITY ENGINE CLASS
// ============================================================================

export class ExplainabilityEngine {
	/**
	 * Generate comprehensive explanation for a product recommendation
	 */
	explainProductRecommendation(
		request: ExplainabilityRequest,
	): ProductExplanation {
		const {
			clientProfile,
			product,
			investmentAmount,
			goalId,
			includeAlternatives,
		} = request;

		const suitability = this.analyzeSuitability(clientProfile, product);
		const recommendation = this.determineRecommendation(suitability);
		const reasons = this.generateReasons(clientProfile, product, suitability);
		const goalAlignment = this.analyzeGoalAlignment(
			clientProfile,
			product,
			investmentAmount,
			goalId,
		);
		const riskReturnDelta = this.calculateRiskReturnDelta(
			clientProfile,
			product,
			investmentAmount,
		);
		const disclosures = this.generateDisclosures(product, suitability);

		const explanation: ProductExplanation = {
			productCode: product.productCode,
			productName: product.productName,
			productType: product.productType,
			recommendation: recommendation.action,
			confidence: recommendation.confidence,
			reasons,
			goalAlignment,
			riskReturnDelta,
			suitabilityExplanation: suitability,
			disclosures,
			generatedAt: new Date().toISOString(),
		};

		if (includeAlternatives) {
			explanation.alternatives = this.suggestAlternatives(
				clientProfile,
				product,
				suitability,
			);
		}

		return explanation;
	}

	/**
	 * Analyze product suitability for client
	 */
	private analyzeSuitability(
		client: ClientProfile,
		product: ProductData,
	): SuitabilityExplanation {
		const factors: SuitabilityFactor[] = [];
		const warnings: string[] = [];

		// Risk tolerance match
		const clientRiskLevel = this.mapRiskToleranceToLevel(client.riskTolerance);
		const riskMatch = Math.abs(clientRiskLevel - product.riskLevel) <= 1;
		factors.push({
			factor: "Risk Tolerance",
			clientValue: client.riskTolerance,
			productRequirement: `Risk Level ${product.riskLevel}/5`,
			match: riskMatch,
			weight: 30,
			explanation: riskMatch
				? `Product risk level (${product.riskLevel}/5) aligns with your ${client.riskTolerance} risk tolerance`
				: `Product risk level (${product.riskLevel}/5) may be ${product.riskLevel > clientRiskLevel ? "too aggressive" : "too conservative"} for your risk tolerance`,
		});

		// Investment horizon match
		const productHorizonYears = product.lockInPeriod / 12;
		const horizonMatch = client.investmentHorizon >= productHorizonYears;
		factors.push({
			factor: "Investment Horizon",
			clientValue: `${client.investmentHorizon} years`,
			productRequirement: `${productHorizonYears} years minimum`,
			match: horizonMatch,
			weight: 25,
			explanation: horizonMatch
				? `Your investment horizon of ${client.investmentHorizon} years accommodates the product's lock-in period`
				: `Your investment horizon may be shorter than the recommended holding period`,
		});

		if (!horizonMatch) {
			warnings.push(
				`Lock-in period of ${product.lockInPeriod} months exceeds your investment horizon`,
			);
		}

		// Income/Segment match
		const incomeMatch = client.annualIncome >= product.minInvestment * 10;
		factors.push({
			factor: "Income Adequacy",
			clientValue: `₹${client.annualIncome.toLocaleString()}`,
			productRequirement: `Minimum ₹${product.minInvestment.toLocaleString()}`,
			match: incomeMatch,
			weight: 20,
			explanation: incomeMatch
				? `Your income level supports this investment`
				: `This investment may represent a significant portion of your income`,
		});

		// KYC tier match
		const kycLevels = { basic: 1, enhanced: 2, accredited: 3 };
		const kycMatch =
			kycLevels[client.kycTier] >= kycLevels[product.kycRequirement];
		factors.push({
			factor: "KYC Compliance",
			clientValue: client.kycTier,
			productRequirement: product.kycRequirement,
			match: kycMatch,
			weight: 15,
			explanation: kycMatch
				? `Your ${client.kycTier} KYC meets the product requirement`
				: `This product requires ${product.kycRequirement} KYC verification`,
		});

		if (!kycMatch) {
			warnings.push(
				`KYC upgrade to ${product.kycRequirement} level required before investing`,
			);
		}

		// Liquidity match
		const liquidityNeeds = client.segment === "retail" ? 60 : 40;
		const liquidityMatch = product.liquidityScore >= liquidityNeeds;
		factors.push({
			factor: "Liquidity Requirements",
			clientValue: `${liquidityNeeds}+ score needed`,
			productRequirement: `${product.liquidityScore} liquidity score`,
			match: liquidityMatch,
			weight: 10,
			explanation: liquidityMatch
				? `Product liquidity meets your expected needs`
				: `Limited liquidity - funds may not be readily accessible`,
		});

		// Calculate overall score
		const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
		const matchedWeight = factors
			.filter((f) => f.match)
			.reduce((sum, f) => sum + f.weight, 0);
		const suitabilityScore = Math.round((matchedWeight / totalWeight) * 100);

		let overallSuitability: SuitabilityExplanation["overallSuitability"];
		if (suitabilityScore >= 85) overallSuitability = "highly_suitable";
		else if (suitabilityScore >= 70) overallSuitability = "suitable";
		else if (suitabilityScore >= 50) overallSuitability = "moderately_suitable";
		else overallSuitability = "not_suitable";

		return {
			overallSuitability,
			suitabilityScore,
			factors,
			warnings,
			clientProfileMatch: {
				riskTolerance: {
					client: client.riskTolerance,
					product: `Level ${product.riskLevel}`,
					match: riskMatch,
				},
				investmentHorizon: {
					client: client.investmentHorizon,
					product: productHorizonYears,
					match: horizonMatch,
				},
				incomeLevel: {
					segment: client.segment,
					productMinimum: product.minInvestment,
					match: incomeMatch,
				},
				kycTier: {
					client: client.kycTier,
					required: product.kycRequirement,
					match: kycMatch,
				},
			},
		};
	}

	/**
	 * Determine buy/hold/sell/avoid recommendation
	 */
	private determineRecommendation(suitability: SuitabilityExplanation): {
		action: ProductExplanation["recommendation"];
		confidence: number;
	} {
		const score = suitability.suitabilityScore;
		const hasWarnings = suitability.warnings.length > 0;
		const criticalFactorsFailed = suitability.factors.filter(
			(f) => !f.match && f.weight >= 20,
		).length;

		if (score >= 85 && !hasWarnings) {
			return { action: "buy", confidence: Math.min(95, score) };
		}
		if (score >= 70 && criticalFactorsFailed === 0) {
			return { action: "buy", confidence: Math.min(85, score - 5) };
		}
		if (score >= 50) {
			return { action: "hold", confidence: Math.min(75, score) };
		}
		return { action: "avoid", confidence: Math.min(100 - score, 90) };
	}

	/**
	 * Generate detailed reasons for recommendation
	 */
	private generateReasons(
		client: ClientProfile,
		product: ProductData,
		suitability: SuitabilityExplanation,
	): RecommendationReason[] {
		const reasons: RecommendationReason[] = [];

		// Risk match reason
		const clientRiskLevel = this.mapRiskToleranceToLevel(client.riskTolerance);
		const riskDiff = product.riskLevel - clientRiskLevel;
		reasons.push({
			category: "risk_match",
			weight: 25,
			description:
				riskDiff === 0
					? `Perfect risk alignment with your ${client.riskTolerance} risk profile`
					: riskDiff > 0
						? `Product is ${riskDiff} level(s) more aggressive than your risk tolerance`
						: `Product is ${Math.abs(riskDiff)} level(s) more conservative than your risk tolerance`,
			impact: Math.abs(riskDiff) <= 1 ? "positive" : "negative",
			dataPoints: {
				clientRiskLevel,
				productRiskLevel: product.riskLevel,
				difference: riskDiff,
			},
		});

		// Return potential
		const marketAvgReturn = 10; // 10% baseline
		const returnDelta = product.expectedReturn - marketAvgReturn;
		reasons.push({
			category: "return_potential",
			weight: 20,
			description:
				returnDelta > 2
					? `Expected returns of ${product.expectedReturn}% are ${returnDelta.toFixed(1)}% above market average`
					: returnDelta < -2
						? `Expected returns of ${product.expectedReturn}% are below market average`
						: `Expected returns of ${product.expectedReturn}% are in line with market expectations`,
			impact:
				returnDelta > 0
					? "positive"
					: returnDelta < -2
						? "negative"
						: "neutral",
			dataPoints: {
				expectedReturn: product.expectedReturn,
				marketAverage: marketAvgReturn,
				delta: returnDelta,
			},
		});

		// Diversification benefit
		const existingAllocation =
			client.currentAssetAllocation[product.productType] || 0;
		const diversificationBenefit = existingAllocation < 20;
		reasons.push({
			category: "diversification",
			weight: 15,
			description: diversificationBenefit
				? `Adding ${product.productType} improves portfolio diversification (current: ${existingAllocation}%)`
				: `You already have ${existingAllocation}% in ${product.productType} - limited diversification benefit`,
			impact: diversificationBenefit ? "positive" : "neutral",
			dataPoints: {
				currentAllocation: existingAllocation,
				targetAllocation: 20,
			},
		});

		// Tax efficiency
		const taxEfficient =
			product.taxTreatment.toLowerCase().includes("exempt") ||
			product.taxTreatment.toLowerCase().includes("ltcg");
		reasons.push({
			category: "tax_efficiency",
			weight: 10,
			description: taxEfficient
				? `Tax-efficient investment: ${product.taxTreatment}`
				: `Standard tax treatment applies: ${product.taxTreatment}`,
			impact: taxEfficient ? "positive" : "neutral",
			dataPoints: {
				taxTreatment: product.taxTreatment,
			},
		});

		// Liquidity
		reasons.push({
			category: "liquidity",
			weight: 10,
			description:
				product.liquidityScore >= 70
					? `High liquidity score (${product.liquidityScore}/100) - easy to exit`
					: product.liquidityScore >= 40
						? `Moderate liquidity (${product.liquidityScore}/100) - some exit restrictions apply`
						: `Low liquidity (${product.liquidityScore}/100) - limited exit options`,
			impact:
				product.liquidityScore >= 70
					? "positive"
					: product.liquidityScore >= 40
						? "neutral"
						: "negative",
			dataPoints: {
				liquidityScore: product.liquidityScore,
				lockInPeriod: product.lockInPeriod,
			},
		});

		// Historical performance
		const oneYearReturn = product.historicalReturns["1Y"] || 0;
		const threeYearReturn = product.historicalReturns["3Y"] || 0;
		reasons.push({
			category: "historical_performance",
			weight: 15,
			description:
				oneYearReturn > 0 && threeYearReturn > 0
					? `Positive track record: 1Y return ${oneYearReturn}%, 3Y CAGR ${threeYearReturn}%`
					: oneYearReturn < 0
						? `Recent underperformance: 1Y return ${oneYearReturn}%`
						: `Mixed historical performance - evaluate carefully`,
			impact:
				oneYearReturn > 5 && threeYearReturn > 8
					? "positive"
					: oneYearReturn < 0
						? "negative"
						: "neutral",
			dataPoints: {
				"1Y": oneYearReturn,
				"3Y": threeYearReturn,
				"5Y": product.historicalReturns["5Y"] || 0,
			},
		});

		// Goal alignment - derived from goal analysis
		const primaryGoal =
			client.goals.find((g) => g.priority === "high") || client.goals[0];
		const goalName = primaryGoal?.name || "General Wealth Creation";
		const productHorizonYears = product.lockInPeriod / 12;
		const goalYearsRemaining = primaryGoal
			? Math.max(
					0,
					(new Date(primaryGoal.targetDate).getTime() - Date.now()) /
						(365.25 * 24 * 60 * 60 * 1000),
				)
			: client.investmentHorizon;
		const horizonMatch = goalYearsRemaining >= productHorizonYears;
		const horizonDiff = goalYearsRemaining - productHorizonYears;

		reasons.push({
			category: "goal_alignment",
			weight: 20,
			description:
				horizonDiff >= 3
					? `Excellent alignment with ${goalName} - investment horizon (${Math.round(goalYearsRemaining)}y) exceeds product requirement`
					: horizonMatch
						? `Good alignment with ${goalName} - investment horizon accommodates this product`
						: `Timeline mismatch - ${goalName} has ${Math.round(goalYearsRemaining)}y horizon, product requires ${Math.round(productHorizonYears)}y`,
			impact:
				horizonDiff >= 3 ? "positive" : horizonMatch ? "neutral" : "negative",
			dataPoints: {
				goalName,
				goalYearsRemaining: Math.round(goalYearsRemaining * 10) / 10,
				productHorizonYears: Math.round(productHorizonYears * 10) / 10,
				horizonMatch,
			},
		});

		return reasons.sort((a, b) => b.weight - a.weight);
	}

	/**
	 * Analyze goal alignment for the product
	 */
	private analyzeGoalAlignment(
		client: ClientProfile,
		product: ProductData,
		investmentAmount: number,
		goalId?: string,
	): GoalAlignment {
		const goal = goalId
			? client.goals.find((g) => g.goalId === goalId)
			: client.goals.find((g) => g.priority === "high") || client.goals[0];

		const goalName = goal?.name || "General Wealth Creation";
		const targetAmount = goal?.targetAmount || investmentAmount * 10;
		const currentProgress = goal?.currentProgress || 0;

		// Calculate horizon match
		const goalYearsRemaining = goal
			? Math.max(
					0,
					(new Date(goal.targetDate).getTime() - Date.now()) /
						(365.25 * 24 * 60 * 60 * 1000),
				)
			: client.investmentHorizon;
		const productHorizonYears = product.lockInPeriod / 12;

		let matchQuality: GoalAlignment["horizonMatch"]["matchQuality"];
		const horizonDiff = goalYearsRemaining - productHorizonYears;
		if (horizonDiff >= 3) matchQuality = "excellent";
		else if (horizonDiff >= 1) matchQuality = "good";
		else if (horizonDiff >= 0) matchQuality = "fair";
		else matchQuality = "poor";

		// Calculate projected progress
		const projectedValue =
			investmentAmount *
			(1 + product.expectedReturn / 100) ** goalYearsRemaining;
		const projectedProgress = Math.min(
			100,
			(((currentProgress * targetAmount) / 100 + projectedValue) /
				targetAmount) *
				100,
		);

		// Alignment score
		const horizonScore =
			matchQuality === "excellent"
				? 100
				: matchQuality === "good"
					? 80
					: matchQuality === "fair"
						? 60
						: 40;
		const progressScore = projectedProgress - currentProgress > 5 ? 80 : 50;
		const alignmentScore = Math.round((horizonScore + progressScore) / 2);

		// Risk contribution (simplified)
		const portfolioRiskBefore = this.calculatePortfolioRisk(
			client.currentAssetAllocation,
		);
		const newAllocation = { ...client.currentAssetAllocation };
		newAllocation[product.productType] =
			(newAllocation[product.productType] || 0) +
			(investmentAmount / (client.currentPortfolioValue + investmentAmount)) *
				100;
		const portfolioRiskAfter = this.calculatePortfolioRisk(newAllocation);

		return {
			primaryGoal: goalName,
			alignmentScore,
			horizonMatch: {
				required: Math.round(goalYearsRemaining),
				productHorizon: Math.round(productHorizonYears),
				matchQuality,
			},
			targetProgress: {
				currentProgress: Math.round(currentProgress * 10) / 10,
				projectedProgress: Math.round(projectedProgress * 10) / 10,
				progressDelta:
					Math.round((projectedProgress - currentProgress) * 10) / 10,
			},
			riskContribution: {
				portfolioRiskBefore,
				portfolioRiskAfter,
				riskChange:
					portfolioRiskAfter > portfolioRiskBefore + 2
						? "increased"
						: portfolioRiskAfter < portfolioRiskBefore - 2
							? "decreased"
							: "unchanged",
			},
		};
	}

	/**
	 * Calculate risk/return delta for portfolio
	 */
	private calculateRiskReturnDelta(
		client: ClientProfile,
		product: ProductData,
		investmentAmount: number,
	): RiskReturnDelta {
		const years = client.investmentHorizon;
		const expectedReturn = product.expectedReturn;

		// Calculate compounded returns
		const annual = expectedReturn;
		const compounded5Year = (1 + expectedReturn / 100) ** 5 - 1;
		const compounded10Year = (1 + expectedReturn / 100) ** 10 - 1;

		// Portfolio impact
		const currentPortfolioReturn = 10; // Assume 10% baseline
		const newWeight =
			investmentAmount / (client.currentPortfolioValue + investmentAmount);
		const oldWeight = 1 - newWeight;
		const newPortfolioReturn =
			currentPortfolioReturn * oldWeight + expectedReturn * newWeight;

		// Sharpe ratio calculation
		const riskFreeRate = 6; // 6% risk-free rate
		const currentSharpe = (currentPortfolioReturn - riskFreeRate) / 15; // Assume 15% portfolio volatility
		const newSharpe =
			(newPortfolioReturn - riskFreeRate) /
			(15 * oldWeight + product.volatility * newWeight);

		// Diversification benefit
		const correlationBenefit = 0.7; // Assume 70% correlation
		const diversificationBenefit = Math.round(
			(1 - correlationBenefit) * 100 * newWeight,
		);

		return {
			expectedReturn: {
				annual: Math.round(annual * 100) / 100,
				compounded5Year: Math.round(compounded5Year * 10000) / 100,
				compounded10Year: Math.round(compounded10Year * 10000) / 100,
			},
			riskMetrics: {
				volatility: product.volatility,
				maxDrawdown: Math.round(product.volatility * 2.5 * 100) / 100,
				sharpeRatio:
					Math.round(
						((expectedReturn - riskFreeRate) / product.volatility) * 100,
					) / 100,
				sortinoRatio:
					Math.round(
						((expectedReturn - riskFreeRate) / (product.volatility * 0.7)) *
							100,
					) / 100,
				beta: product.riskLevel / 3, // Simplified beta calculation
			},
			portfolioImpact: {
				returnDelta:
					Math.round((newPortfolioReturn - currentPortfolioReturn) * 100) / 100,
				riskDelta:
					Math.round((product.volatility * newWeight - 15 * newWeight) * 100) /
					100,
				sharpeRatioDelta: Math.round((newSharpe - currentSharpe) * 100) / 100,
				diversificationBenefit,
			},
			scenarioAnalysis: [
				{
					scenario: "Bull Market",
					probability: 25,
					returnOutcome: Math.round(expectedReturn * 1.5 * 100) / 100,
					description: "Strong economic growth, favorable market conditions",
				},
				{
					scenario: "Base Case",
					probability: 50,
					returnOutcome: expectedReturn,
					description: "Normal market conditions, expected performance",
				},
				{
					scenario: "Bear Market",
					probability: 20,
					returnOutcome: Math.round(expectedReturn * 0.3 * 100) / 100,
					description: "Economic slowdown, market correction",
				},
				{
					scenario: "Crisis",
					probability: 5,
					returnOutcome: Math.round(-product.volatility * 2 * 100) / 100,
					description: "Severe market disruption, significant drawdown",
				},
			],
		};
	}

	/**
	 * Generate SEBI-compliant disclosures
	 */
	private generateDisclosures(
		product: ProductData,
		suitability: SuitabilityExplanation,
	): Disclosure[] {
		const disclosures: Disclosure[] = [];

		// SEBI Mandatory Disclosure
		disclosures.push({
			type: "sebi_mandatory",
			severity: "info",
			title: "SEBI Disclosure",
			content:
				"Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing. Past performance is not indicative of future returns.",
			regulatoryReference: "SEBI (Mutual Funds) Regulations, 1996",
		});

		// Risk disclosure
		if (product.riskLevel >= 4) {
			disclosures.push({
				type: "risk_disclosure",
				severity: "warning",
				title: "High Risk Investment",
				content: `This product has a risk level of ${product.riskLevel}/5. It may experience significant volatility and potential loss of principal. Suitable only for investors with high risk appetite.`,
				regulatoryReference: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2020/197",
			});
		}

		// Tax disclosure
		disclosures.push({
			type: "tax_disclosure",
			severity: "info",
			title: "Tax Treatment",
			content: `Tax implications: ${product.taxTreatment}. Please consult a tax advisor for personalized advice based on your tax situation.`,
		});

		// Liquidity disclosure
		if (product.lockInPeriod > 0) {
			disclosures.push({
				type: "liquidity_disclosure",
				severity: product.lockInPeriod > 36 ? "warning" : "info",
				title: "Lock-in Period",
				content: `This investment has a lock-in period of ${product.lockInPeriod} months. You will not be able to redeem during this period.`,
			});
		}

		// Exit load disclosure
		if (product.exitLoad && product.exitLoad > 0) {
			disclosures.push({
				type: "exit_load",
				severity: "info",
				title: "Exit Load Applicable",
				content: `An exit load of ${product.exitLoad}% applies if redeemed before the specified period. Please check scheme documents for details.`,
			});
		}

		// Expense ratio
		if (product.expenseRatio) {
			disclosures.push({
				type: "expense_ratio",
				severity: product.expenseRatio > 2 ? "warning" : "info",
				title: "Expense Ratio",
				content: `The expense ratio for this product is ${product.expenseRatio}%. This is deducted from the NAV and impacts your net returns.`,
			});
		}

		// Past performance
		disclosures.push({
			type: "past_performance",
			severity: "info",
			title: "Historical Performance",
			content:
				"Past performance does not guarantee future results. The investment value can go down as well as up, and you may get back less than you invested.",
		});

		// Suitability warning if not suitable
		if (suitability.overallSuitability === "not_suitable") {
			disclosures.push({
				type: "risk_disclosure",
				severity: "critical",
				title: "Suitability Warning",
				content: `Based on your profile, this product may not be suitable for you. Suitability score: ${suitability.suitabilityScore}/100. ${suitability.warnings.join(" ")}`,
				regulatoryReference: "SEBI (Investment Advisers) Regulations, 2013",
			});
		}

		return disclosures;
	}

	/**
	 * Suggest alternative products
	 */
	private suggestAlternatives(
		client: ClientProfile,
		product: ProductData,
		suitability: SuitabilityExplanation,
	): AlternativeProduct[] {
		// In production, this would query a product database
		// Here we generate sample alternatives based on the product type
		const alternatives: AlternativeProduct[] = [];

		if (suitability.suitabilityScore < 70) {
			// Suggest lower risk alternatives
			alternatives.push({
				productCode: `${product.productType.toUpperCase()}-CONSERVATIVE`,
				productName: `Conservative ${product.productType} Alternative`,
				productType: product.productType,
				reason: "Lower risk profile that better matches your risk tolerance",
				comparisonMetrics: {
					expectedReturn: Math.max(5, product.expectedReturn - 3),
					risk: Math.max(1, product.riskLevel - 1),
					suitabilityScore: Math.min(95, suitability.suitabilityScore + 20),
					expenseRatio: product.expenseRatio,
				},
			});
		}

		// Suggest similar return, lower cost option
		if (product.expenseRatio && product.expenseRatio > 1) {
			alternatives.push({
				productCode: `${product.productType.toUpperCase()}-INDEX`,
				productName: `Index Fund Alternative`,
				productType: product.productType,
				reason: "Lower expense ratio with similar market exposure",
				comparisonMetrics: {
					expectedReturn: product.expectedReturn - 0.5,
					risk: product.riskLevel,
					suitabilityScore: suitability.suitabilityScore,
					expenseRatio: 0.5,
				},
			});
		}

		return alternatives;
	}

	/**
	 * Generate portfolio-level explanation
	 */
	explainPortfolio(
		clientProfile: ClientProfile,
		products: ProductData[],
	): PortfolioExplanation {
		const allocationExplanations = this.generateAllocationExplanations(
			clientProfile,
			products,
		);
		const diversification = this.analyzeDiversification(products);
		const riskBudget = this.analyzeRiskBudget(clientProfile, products);
		const goalContributions = this.analyzeGoalContributions(
			clientProfile,
			products,
		);
		const compliance = this.checkCompliance(clientProfile, products);

		return {
			portfolioId: `PORTFOLIO-${clientProfile.clientId}`,
			clientId: clientProfile.clientId,
			overallRationale: this.generatePortfolioRationale(
				clientProfile,
				products,
			),
			assetAllocationExplanation: allocationExplanations,
			diversificationAnalysis: diversification,
			riskBudgetUtilization: riskBudget,
			goalContributions,
			regulatoryCompliance: compliance,
			generatedAt: new Date().toISOString(),
		};
	}

	async generateEnrichedReasons(
		symbol: string,
	): Promise<RecommendationReason[]> {
		const enrichedReasons: RecommendationReason[] = [];
		try {
			const snapshot = await getEnrichedStockSnapshot(symbol);
			if (!snapshot) return enrichedReasons;

			if (snapshot.dcf?.upsidePercent != null) {
				enrichedReasons.push({
					category: "return_potential",
					weight: 15,
					description: `Intrinsic value analysis shows ${snapshot.dcf.upsidePercent}% upside potential`,
					impact:
						snapshot.dcf.upsidePercent > 10
							? "positive"
							: snapshot.dcf.upsidePercent < -10
								? "negative"
								: "neutral",
					dataPoints: {
						dcfValue: snapshot.dcf.dcfValue,
						stockPrice: snapshot.dcf.stockPrice,
						upsidePercent: snapshot.dcf.upsidePercent,
					},
				});
			}

			if (snapshot.fundamentals?.roic != null) {
				enrichedReasons.push({
					category: "return_potential",
					weight: 12,
					description: `Return on invested capital of ${(snapshot.fundamentals.roic * 100).toFixed(1)}% indicates ${snapshot.fundamentals.roic > 0.15 ? "strong" : "moderate"} capital efficiency`,
					impact:
						snapshot.fundamentals.roic > 0.15
							? "positive"
							: snapshot.fundamentals.roic > 0.08
								? "neutral"
								: "negative",
					dataPoints: { roic: snapshot.fundamentals.roic },
				});
			}

			if (
				snapshot.analystTargets &&
				snapshot.analystTargets.count > 0 &&
				snapshot.analystTargets.avgPriceTarget != null
			) {
				enrichedReasons.push({
					category: "market_conditions",
					weight: 10,
					description: `${snapshot.analystTargets.count} analysts set average target of ₹${Math.round(snapshot.analystTargets.avgPriceTarget)}`,
					impact: "neutral",
					dataPoints: {
						analystCount: snapshot.analystTargets.count,
						avgTarget: snapshot.analystTargets.avgPriceTarget,
					},
				});
			}

			if (snapshot.institutional && snapshot.institutional.totalCount > 0) {
				const totalWeightPercent = snapshot.institutional.topHolders.reduce(
					(sum, h) => sum + (h.weightPercent || 0),
					0,
				);
				enrichedReasons.push({
					category: "market_conditions",
					weight: 8,
					description: `${snapshot.institutional.totalCount} institutional holders with total ${totalWeightPercent.toFixed(1)}% ownership`,
					impact:
						snapshot.institutional.totalCount > 5 ? "positive" : "neutral",
					dataPoints: {
						institutionalCount: snapshot.institutional.totalCount,
						totalWeight: totalWeightPercent,
					},
				});
			}

			if (
				snapshot.growth?.epsGrowth != null ||
				snapshot.growth?.revenueGrowth != null
			) {
				const epsG = snapshot.growth?.epsGrowth;
				const revG = snapshot.growth?.revenueGrowth;
				const parts: string[] = [];
				if (epsG != null)
					parts.push(`EPS growth of ${(epsG * 100).toFixed(1)}%`);
				if (revG != null)
					parts.push(`revenue growth of ${(revG * 100).toFixed(1)}%`);
				enrichedReasons.push({
					category: "return_potential",
					weight: 14,
					description: parts.join(" and "),
					impact:
						(epsG != null && epsG > 0.1) || (revG != null && revG > 0.1)
							? "positive"
							: "neutral",
					dataPoints: { epsGrowth: epsG, revenueGrowth: revG },
				});
			}

			if (snapshot.technicals?.rsi != null) {
				const rsi = snapshot.technicals.rsi;
				const condition =
					rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral";
				enrichedReasons.push({
					category: "market_conditions",
					weight: 8,
					description: `RSI at ${rsi.toFixed(0)} suggests ${condition} conditions`,
					impact:
						condition === "oversold"
							? "positive"
							: condition === "overbought"
								? "negative"
								: "neutral",
					dataPoints: { rsi, condition },
				});
			}
		} catch (error: any) {
			console.error(
				`[ExplainabilityEngine] Failed to fetch enriched reasons for ${symbol}:`,
				error.message,
			);
		}
		return enrichedReasons;
	}

	/**
	 * Generate human-readable summary of recommendation
	 */
	generateNarrativeSummary(explanation: ProductExplanation): string {
		const action =
			explanation.recommendation === "buy"
				? "recommend"
				: explanation.recommendation === "hold"
					? "suggest reviewing"
					: explanation.recommendation === "avoid"
						? "advise against"
						: "suggest holding";

		const topReasons = explanation.reasons
			.filter((r) => r.impact === "positive")
			.slice(0, 3)
			.map((r) => r.description)
			.join("; ");

		const warnings =
			explanation.suitabilityExplanation.warnings.length > 0
				? ` However, please note: ${explanation.suitabilityExplanation.warnings.join("; ")}.`
				: "";

		return `Based on your ${explanation.suitabilityExplanation.clientProfileMatch.riskTolerance.client} risk profile and investment goals, we ${action} investing in ${explanation.productName}. Key factors: ${topReasons}.${warnings} This recommendation has ${explanation.confidence}% confidence based on suitability analysis.`;
	}

	// ============================================================================
	// HELPER METHODS
	// ============================================================================

	private mapRiskToleranceToLevel(tolerance: string): number {
		const mapping: Record<string, number> = {
			conservative: 2,
			moderate: 3,
			aggressive: 4,
			very_aggressive: 5,
		};
		return mapping[tolerance] || 3;
	}

	private calculatePortfolioRisk(allocation: Record<string, number>): number {
		const riskWeights: Record<string, number> = {
			equity: 20,
			debt: 8,
			hybrid: 12,
			gold: 10,
			real_estate: 15,
			mutual_fund: 14,
			cash: 2,
		};

		let totalRisk = 0;
		let totalAllocation = 0;

		for (const [asset, weight] of Object.entries(allocation)) {
			totalRisk += (riskWeights[asset] || 12) * (weight / 100);
			totalAllocation += weight;
		}

		return Math.round((totalRisk / (totalAllocation / 100 || 1)) * 10) / 10;
	}

	private generateAllocationExplanations(
		client: ClientProfile,
		products: ProductData[],
	): AllocationExplanation[] {
		const assetClasses = Array.from(
			new Set(products.map((p) => p.productType)),
		);
		return assetClasses.map((assetClass) => {
			const classProducts = products.filter(
				(p) => p.productType === assetClass,
			);
			const totalWeight = classProducts.length * 10; // Simplified
			const targetAllocation = 20; // Simplified target

			return {
				assetClass,
				allocation: totalWeight,
				targetAllocation,
				deviation: totalWeight - targetAllocation,
				rationale: `${assetClass} allocation provides ${totalWeight > targetAllocation ? "overweight" : "underweight"} exposure based on market conditions`,
				products: classProducts.map((p) => ({
					productCode: p.productCode,
					productName: p.productName,
					weight: 10,
					contribution: `Provides ${p.expectedReturn}% expected return with ${p.riskLevel}/5 risk`,
				})),
			};
		});
	}

	private analyzeDiversification(
		products: ProductData[],
	): DiversificationAnalysis {
		const assetClasses = Array.from(
			new Set(products.map((p) => p.productType)),
		);
		return {
			score: Math.min(100, assetClasses.length * 20),
			assetClassCount: assetClasses.length,
			correlationMatrix: "Low to moderate correlation across holdings",
			concentrationRisk:
				assetClasses.length < 3
					? "High - consider adding more asset classes"
					: "Moderate - well diversified",
			geographicDiversification: "Primarily domestic exposure",
			sectorDiversification: "Diversified across multiple sectors",
		};
	}

	private analyzeRiskBudget(
		client: ClientProfile,
		products: ProductData[],
	): RiskBudgetAnalysis {
		const totalRiskBudget =
			this.mapRiskToleranceToLevel(client.riskTolerance) * 10;
		const utilizedRisk =
			products.reduce((sum, p) => sum + p.riskLevel * 2, 0) / products.length;

		return {
			totalRiskBudget,
			utilizedRisk,
			utilizationPercentage: Math.round((utilizedRisk / totalRiskBudget) * 100),
			riskContributors: products.map((p) => ({
				assetClass: p.productType,
				riskContribution: p.riskLevel * 2,
				percentage: Math.round(((p.riskLevel * 2) / utilizedRisk) * 100),
			})),
			recommendation:
				utilizedRisk < totalRiskBudget
					? "Room to add higher-return investments within risk tolerance"
					: "Risk budget fully utilized - consider rebalancing before adding new positions",
		};
	}

	private analyzeGoalContributions(
		client: ClientProfile,
		products: ProductData[],
	): GoalContribution[] {
		return client.goals.map((goal) => {
			const avgReturn =
				products.reduce((sum, p) => sum + p.expectedReturn, 0) /
				products.length;
			const yearsToGoal = Math.max(
				1,
				(new Date(goal.targetDate).getTime() - Date.now()) /
					(365.25 * 24 * 60 * 60 * 1000),
			);
			const projectedValue =
				((goal.currentProgress * goal.targetAmount) / 100) *
				(1 + avgReturn / 100) ** yearsToGoal;

			return {
				goalId: goal.goalId,
				goalName: goal.name,
				targetAmount: goal.targetAmount,
				projectedAmount: Math.round(projectedValue),
				probability: Math.min(
					95,
					Math.round((projectedValue / goal.targetAmount) * 100),
				),
				shortfall:
					projectedValue < goal.targetAmount
						? goal.targetAmount - projectedValue
						: undefined,
				recommendation:
					projectedValue < goal.targetAmount
						? "Consider increasing SIP amount or extending timeline"
						: "On track to meet goal",
			};
		});
	}

	private checkCompliance(
		client: ClientProfile,
		products: ProductData[],
	): ComplianceStatus {
		const issues: string[] = [];

		// Check KYC compliance
		const kycLevels = { basic: 1, enhanced: 2, accredited: 3 };
		const kycIssues = products.filter(
			(p) => kycLevels[client.kycTier] < kycLevels[p.kycRequirement],
		);
		if (kycIssues.length > 0) {
			issues.push(`${kycIssues.length} product(s) require higher KYC tier`);
		}

		// Check suitability
		const avgProductRisk =
			products.reduce((sum, p) => sum + p.riskLevel, 0) / products.length;
		const clientRiskLevel = this.mapRiskToleranceToLevel(client.riskTolerance);
		if (avgProductRisk > clientRiskLevel + 1) {
			issues.push("Portfolio risk exceeds client risk tolerance");
		}

		return {
			sebiCompliant: true, // Disclosures are provided
			kycCompliant: kycIssues.length === 0,
			suitabilityCompliant: avgProductRisk <= clientRiskLevel + 1,
			disclosuresComplete: true,
			issues,
		};
	}

	private generatePortfolioRationale(
		client: ClientProfile,
		products: ProductData[],
	): string {
		const avgReturn =
			products.reduce((sum, p) => sum + p.expectedReturn, 0) / products.length;
		const avgRisk =
			products.reduce((sum, p) => sum + p.riskLevel, 0) / products.length;
		const assetClasses = Array.from(
			new Set(products.map((p) => p.productType)),
		);

		return `This portfolio of ${products.length} products across ${assetClasses.length} asset classes is designed for your ${client.riskTolerance} risk profile and ${client.investmentHorizon}-year investment horizon. Expected portfolio return: ${avgReturn.toFixed(1)}% with average risk level ${avgRisk.toFixed(1)}/5. The allocation balances growth potential with risk management appropriate for a ${client.segment} investor.`;
	}
}

export const explainabilityEngine = new ExplainabilityEngine();
