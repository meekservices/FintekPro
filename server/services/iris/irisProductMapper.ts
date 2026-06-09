export class IrisProductMapper {
	/**
	 * Normalizes an IRIS Mutual Fund response to FintekPro standard product schema
	 */
	static normalizeMutualFund(irisProduct: any) {
		return {
			providerId: irisProduct.schemeCode || irisProduct.isin,
			provider: "KFINTECH",
			assetClass: "MUTUAL_FUND",
			name: irisProduct.schemeName || irisProduct.name,
			category: irisProduct.category,
			subCategory: irisProduct.subCategory,
			riskLevel: IrisProductMapper.mapRiskLevel(irisProduct.riskometer),
			nav: irisProduct.nav || 0,
			minInvestment: irisProduct.minPurchaseAmount || 500,
			isSipEnabled:
				irisProduct.sipAllowed === "Y" || irisProduct.sipAllowed === true,
			metadata: {
				isin: irisProduct.isin,
				amcCode: irisProduct.amcCode,
				dividendYield: irisProduct.dividendYield,
				expenseRatio: irisProduct.expenseRatio,
			},
		};
	}

	/**
	 * Normalizes an IRIS Fixed Deposit response
	 */
	static normalizeFixedDeposit(irisFd: any) {
		return {
			providerId: irisFd.productId,
			provider: "KFINTECH",
			assetClass: "FIXED_DEPOSIT",
			name: irisFd.productName || `${irisFd.issuerName} FD`,
			issuerName: irisFd.issuerName,
			interestRate: irisFd.interestRate || irisFd.yield,
			tenure: irisFd.tenureMonths, // In months
			minInvestment: irisFd.minInvestment || 10000,
			riskLevel: "LOW",
			metadata: {
				lockInPeriod: irisFd.lockInMonths,
				payoutFrequency: irisFd.payoutOptions,
				rating: irisFd.creditRating,
			},
		};
	}

	private static mapRiskLevel(
		riskometer?: string,
	): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
		if (!riskometer) return "MEDIUM";
		const lower = riskometer.toLowerCase();
		if (lower.includes("low")) return "LOW";
		if (lower.includes("high") || lower.includes("very high")) return "HIGH";
		return "MEDIUM";
	}
}
