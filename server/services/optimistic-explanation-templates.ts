import {
	UnifiedProductType,
	InvestmentProduct,
} from "@shared/unified-investment-product";
import {
	ScoredProduct,
	RecommendationMode,
	RECOMMENDATION_MODE,
	RISK_DISCLOSURE_FOOTER,
} from "@shared/profit-optimized-scoring";

interface ExplanationParams {
	productName: string;
	productType: UnifiedProductType;
	suitabilityScore: number;
	upsideScore: number;
	finalScore: number;
	mode: RecommendationMode;
	upsideBreakdown: Record<string, number>;
	sector?: string;
	expectedReturnMax?: number;
	rating?: string;
	yieldOrReturn?: number;
}

interface GeneratedExplanation {
	headline: string;
	body: string;
	keyPoints: string[];
	riskBalance: string;
	footer?: string;
}

const OPTIMISTIC_PHRASES = {
	momentum: [
		"showing strong upward momentum",
		"demonstrating positive price trajectory",
		"exhibiting favorable market sentiment",
	],
	valuation: [
		"attractively valued relative to peers",
		"trading at compelling valuations",
		"offering value opportunity in current market",
	],
	growth: [
		"positioned for growth within your risk tolerance",
		"offering relative upside potential",
		"demonstrating growth characteristics aligned with your profile",
	],
	sector: [
		"benefiting from favorable sector dynamics",
		"in a sector showing positive momentum",
		"within an industry experiencing tailwinds",
	],
	yield: [
		"offering attractive yield characteristics",
		"providing competitive income potential",
		"delivering yield above comparable investments",
	],
	quality: [
		"backed by strong fundamentals",
		"demonstrating operational excellence",
		"supported by solid financial metrics",
	],
};

const RISK_BALANCE_STATEMENTS: Record<UnifiedProductType, string[]> = {
	STOCK: [
		"While equities carry market volatility, this stock's fundamentals support a disciplined allocation within your risk profile.",
		"Stock investments fluctuate with market conditions. Position sizing reflects your risk tolerance.",
	],
	MF: [
		"Mutual fund performance varies with market cycles. This fund's track record supports inclusion within allocation guidelines.",
		"Fund returns depend on market conditions and manager decisions. Diversification helps manage volatility.",
	],
	BOND: [
		"Bond prices move inversely to interest rates. This bond's credit quality and duration align with your income objectives.",
		"Fixed income provides stability, though returns may lag during rate increases. Quality selection is prioritized.",
	],
	REIT: [
		"REITs provide real estate exposure with income potential. Property values and distributions can fluctuate with economic conditions.",
		"Real estate investments offer diversification benefits. Occupancy and rental rates affect distributions.",
	],
	INVIT: [
		"InvITs offer infrastructure exposure with regular distributions. Asset performance depends on operational efficiency.",
		"Infrastructure investments provide stable cash flows. Regulatory and operational factors can impact returns.",
	],
	IPO: [
		"IPOs can experience significant price volatility post-listing. This recommendation is based on fundamentals and sector outlook.",
		"New listings carry listing-day and short-term volatility risks. Position sizing accounts for this uncertainty.",
	],
	UNLISTED: [
		"Unlisted securities have limited liquidity. Potential upside must be weighed against exit timing uncertainty.",
		"Pre-IPO investments require longer holding periods. Returns depend on eventual listing performance.",
	],
	AIF: [
		"Alternative investments carry strategy-specific risks. Manager selection and portfolio construction are key factors.",
		"AIF returns depend on manager skill and market conditions. Lock-in periods require commitment.",
	],
	PMS: [
		"PMS performance depends on manager decisions and market conditions. Customized strategies may have concentrated positions.",
		"Portfolio management services offer personalized approaches. Returns vary based on strategy execution.",
	],
	MLD: [
		"Market-linked debentures have principal protection features but returns depend on underlying market performance.",
		"MLD returns are tied to market indices. Understand the payoff structure before investing.",
	],
};

class OptimisticExplanationTemplates {
	private getRandomPhrase(category: keyof typeof OPTIMISTIC_PHRASES): string {
		const phrases = OPTIMISTIC_PHRASES[category];
		return phrases[Math.floor(Math.random() * phrases.length)];
	}

	private getRiskBalanceStatement(productType: UnifiedProductType): string {
		const statements = RISK_BALANCE_STATEMENTS[productType];
		return statements[Math.floor(Math.random() * statements.length)];
	}

	generateExplanation(
		product: ScoredProduct,
		mode: RecommendationMode,
	): GeneratedExplanation {
		const params: ExplanationParams = {
			productName: product.name,
			productType: product.product_type,
			suitabilityScore: product.suitability.total,
			upsideScore: product.upside.total,
			finalScore: product.finalScore.total,
			mode,
			upsideBreakdown: product.upside.breakdown,
			sector: product.sector,
			expectedReturnMax: product.expected_return_band.max,
			rating: product.rating,
			yieldOrReturn: product.yield_or_return,
		};

		if (mode === RECOMMENDATION_MODE.GROWTH_OPTIMIZED) {
			return this.generateOptimisticExplanation(params);
		}
		if (mode === RECOMMENDATION_MODE.CONSERVATIVE) {
			return this.generateConservativeExplanation(params);
		}
		return this.generateBalancedExplanation(params);
	}

	private generateOptimisticExplanation(
		params: ExplanationParams,
	): GeneratedExplanation {
		const { productName, productType, upsideScore, upsideBreakdown, sector } =
			params;

		const headline = this.generateOptimisticHeadline(productType, upsideScore);

		const keyPoints = this.generateOptimisticKeyPoints(params);

		const body = this.generateOptimisticBody(params);

		const riskBalance = this.getRiskBalanceStatement(productType);

		return {
			headline,
			body,
			keyPoints,
			riskBalance,
			footer: RISK_DISCLOSURE_FOOTER,
		};
	}

	private generateOptimisticHeadline(
		productType: UnifiedProductType,
		upsideScore: number,
	): string {
		const strength =
			upsideScore >= 80
				? "Strong"
				: upsideScore >= 60
					? "Favorable"
					: "Moderate";

		const headlineTemplates: Record<UnifiedProductType, string[]> = {
			STOCK: [
				`${strength} Growth Opportunity with Disciplined Risk Management`,
				`Equity Position ${this.getRandomPhrase("momentum")}`,
			],
			MF: [
				`${strength} Fund Selection for Risk-Adjusted Growth`,
				`Mutual Fund ${this.getRandomPhrase("quality")}`,
			],
			BOND: [
				`${strength} Income Opportunity with Quality Focus`,
				`Fixed Income ${this.getRandomPhrase("yield")}`,
			],
			REIT: [
				`Real Estate Exposure with ${strength} Income Potential`,
				`REIT ${this.getRandomPhrase("yield")}`,
			],
			INVIT: [
				`Infrastructure Investment with ${strength} Distribution Profile`,
				`InvIT ${this.getRandomPhrase("quality")}`,
			],
			IPO: [
				`${strength} Listing Opportunity in ${this.getRandomPhrase("sector")}`,
				`IPO ${this.getRandomPhrase("growth")}`,
			],
			UNLISTED: [
				`Pre-IPO Opportunity with ${strength} Upside Potential`,
				`Unlisted Equity ${this.getRandomPhrase("growth")}`,
			],
			AIF: [
				`Alternative Strategy with ${strength} Return Profile`,
				`AIF ${this.getRandomPhrase("quality")}`,
			],
			PMS: [
				`Managed Portfolio with ${strength} Performance Track Record`,
				`PMS ${this.getRandomPhrase("growth")}`,
			],
			MLD: [
				`Structured Product with ${strength} Payoff Potential`,
				`MLD ${this.getRandomPhrase("yield")}`,
			],
		};

		const templates = headlineTemplates[productType];
		return templates[0];
	}

	private generateOptimisticKeyPoints(params: ExplanationParams): string[] {
		const {
			productType,
			upsideBreakdown,
			expectedReturnMax,
			rating,
			yieldOrReturn,
			sector,
		} = params;
		const keyPoints: string[] = [];

		const topFactors = Object.entries(upsideBreakdown)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 3);

		for (const [factor, score] of topFactors) {
			if (score >= 70) {
				keyPoints.push(this.getFactorDescription(factor, score, productType));
			}
		}

		if (expectedReturnMax && expectedReturnMax > 12) {
			keyPoints.push(
				`Return potential of up to ${expectedReturnMax.toFixed(1)}% aligns with growth objectives`,
			);
		}

		if (yieldOrReturn && yieldOrReturn > 7) {
			keyPoints.push(
				`Yield of ${yieldOrReturn.toFixed(2)}% provides attractive income opportunity`,
			);
		}

		if (
			rating &&
			(rating.includes("AAA") ||
				rating.includes("5") ||
				rating.toLowerCase().includes("gold"))
		) {
			keyPoints.push(`Top-tier rating reflects quality characteristics`);
		}

		if (sector) {
			const highGrowthSectors = [
				"technology",
				"fintech",
				"healthcare",
				"renewable",
				"ev",
				"ai",
			];
			if (highGrowthSectors.some((s) => sector.toLowerCase().includes(s))) {
				keyPoints.push(`Positioned in high-growth ${sector} sector`);
			}
		}

		keyPoints.push("Allocation discipline maintained within risk parameters");

		return keyPoints.slice(0, 4);
	}

	private getFactorDescription(
		factor: string,
		score: number,
		productType: UnifiedProductType,
	): string {
		const factorDescriptions: Record<string, string> = {
			returnPotential: `Strong return potential score of ${score} indicates favorable upside`,
			momentumScore: `Positive momentum (${score}/100) suggests continued strength`,
			valuationScore: `Attractive valuation score of ${score} offers value opportunity`,
			sectorScore: `Sector positioning (${score}/100) benefits from favorable dynamics`,
			yieldScore: `Yield characteristics score of ${score} provides income opportunity`,
			creditScore: `Credit quality score of ${score} indicates solid fundamentals`,
			alphaScore: `Alpha generation potential of ${score} suggests skilled management`,
			consistencyScore: `Consistency score of ${score} reflects reliable performance`,
			ratingScore: `Quality rating score of ${score} supports inclusion`,
			navScore: `NAV discount score of ${score} suggests value opportunity`,
			occupancyScore: `Strong occupancy (${score}/100) supports distribution stability`,
			growthScore: `Growth trajectory score of ${score} aligns with objectives`,
			subscriptionScore: `Strong subscription interest (${score}/100) indicates demand`,
			ipoProximityScore: `Near-term IPO potential (${score}/100) offers liquidity path`,
			trackRecordScore: `Proven track record (${score}/100) demonstrates capability`,
			strategyScore: `Strategy alignment score of ${score} matches objectives`,
			riskAdjustedScore: `Risk-adjusted return score of ${score} balances reward and risk`,
			durationScore: `Duration positioning (${score}/100) manages rate sensitivity`,
			spreadScore: `Spread opportunity (${score}/100) offers yield pickup`,
			qualityScore: `Quality characteristics (${score}/100) support recommendation`,
			liquidityDiscount: `Illiquidity premium reflected in upside potential`,
		};

		return (
			factorDescriptions[factor] ||
			`Strong ${factor.replace(/([A-Z])/g, " $1").toLowerCase()} of ${score}`
		);
	}

	private generateOptimisticBody(params: ExplanationParams): string {
		const {
			productName,
			productType,
			suitabilityScore,
			upsideScore,
			finalScore,
			sector,
		} = params;

		const suitabilityDesc =
			suitabilityScore >= 80
				? "strongly aligns with"
				: suitabilityScore >= 60
					? "appropriately matches"
					: "is compatible with";

		const upsideDesc =
			upsideScore >= 80
				? "demonstrates compelling"
				: upsideScore >= 60
					? "offers favorable"
					: "provides moderate";

		const productTypeLabel = this.getProductTypeLabel(productType);

		let body = `${productName} ${suitabilityDesc} your risk profile and investment objectives. `;
		body += `This ${productTypeLabel} ${upsideDesc} upside potential `;

		if (sector) {
			body += `within the ${sector} sector, `;
		}

		body += `while maintaining disciplined position sizing within your allocation framework. `;
		body += `The overall score of ${finalScore} reflects both suitability and growth potential in the current market environment.`;

		return body;
	}

	private generateBalancedExplanation(
		params: ExplanationParams,
	): GeneratedExplanation {
		const {
			productName,
			productType,
			suitabilityScore,
			upsideScore,
			finalScore,
		} = params;

		const headline = `${productName} - Balanced Selection for Your Portfolio`;

		const body =
			`This ${this.getProductTypeLabel(productType)} has been selected based on a balanced evaluation of ` +
			`suitability (${suitabilityScore}/100) and opportunity (${upsideScore}/100), ` +
			`resulting in an overall score of ${finalScore}. ` +
			`The recommendation prioritizes alignment with your risk profile while capturing available opportunities.`;

		const keyPoints = [
			`Suitability score of ${suitabilityScore} indicates good fit with your profile`,
			`Opportunity score of ${upsideScore} reflects current market potential`,
			"Balanced weighting ensures alignment with your investment objectives",
		];

		const riskBalance = this.getRiskBalanceStatement(productType);

		return {
			headline,
			body,
			keyPoints,
			riskBalance,
		};
	}

	private generateConservativeExplanation(
		params: ExplanationParams,
	): GeneratedExplanation {
		const { productName, productType, suitabilityScore, finalScore } = params;

		const headline = `${productName} - Conservative Selection Prioritizing Safety`;

		const body =
			`This ${this.getProductTypeLabel(productType)} has been selected with emphasis on ` +
			`suitability and risk management. The suitability score of ${suitabilityScore}/100 ` +
			`indicates strong alignment with your conservative investment approach. ` +
			`Overall score of ${finalScore} reflects prioritization of capital preservation.`;

		const keyPoints = [
			`High suitability score of ${suitabilityScore} prioritizes profile alignment`,
			"Conservative weighting emphasizes risk management",
			"Selection focuses on capital preservation within return objectives",
		];

		const riskBalance = this.getRiskBalanceStatement(productType);

		return {
			headline,
			body,
			keyPoints,
			riskBalance,
		};
	}

	private getProductTypeLabel(productType: UnifiedProductType): string {
		const labels: Record<UnifiedProductType, string> = {
			STOCK: "equity",
			MF: "mutual fund",
			BOND: "fixed income instrument",
			REIT: "real estate investment trust",
			INVIT: "infrastructure investment trust",
			IPO: "initial public offering",
			UNLISTED: "unlisted equity",
			AIF: "alternative investment fund",
			PMS: "portfolio management service",
			MLD: "market-linked debenture",
		};
		return labels[productType] || "investment product";
	}

	generateBatchExplanations(
		products: ScoredProduct[],
		mode: RecommendationMode,
	): Map<string, GeneratedExplanation> {
		const explanations = new Map<string, GeneratedExplanation>();

		for (const product of products) {
			explanations.set(
				product.product_id,
				this.generateExplanation(product, mode),
			);
		}

		return explanations;
	}
}

export const optimisticExplanationTemplates =
	new OptimisticExplanationTemplates();
