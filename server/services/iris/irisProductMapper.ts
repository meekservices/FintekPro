/**
 * irisProductMapper.ts
 *
 * Normalizes raw IRIS API responses to FintekPro's standard product schema.
 * Covers: MF, FD, NPS, PMS, AIF, Bond, ETF.
 */

export class IrisProductMapper {

  /** Mutual Fund */
  static normalizeMutualFund(irisProduct: Record<string, unknown>) {
    return {
      providerId: irisProduct.schemeCode || irisProduct.isin,
      provider: "KFINTECH",
      assetClass: "MUTUAL_FUND",
      name: irisProduct.schemeName || irisProduct.name,
      category: irisProduct.category,
      subCategory: irisProduct.subCategory,
      riskLevel: IrisProductMapper.mapRiskLevel(irisProduct.riskometer as string | undefined),
      nav: irisProduct.nav || 0,
      minInvestment: irisProduct.minPurchaseAmount || 500,
      isSipEnabled: irisProduct.sipAllowed === "Y" || irisProduct.sipAllowed === true,
      metadata: {
        isin: irisProduct.isin,
        isinGrowth: irisProduct.isinGrowth,
        amcCode: irisProduct.amcCode,
        schemeCode: irisProduct.schemeCode,
        amfiCode: irisProduct.amfiCode,
        planType: irisProduct.planType ?? "regular",
        dividendYield: irisProduct.dividendYield,
        expenseRatio: irisProduct.expenseRatio,
        exchange: "BSE",                       // MF orders via BSE StarMF
        executionApi: "iris",
        orderType: "mf_purchase",
        fintekproRoute: "/api/iris/transactions/place-order",
      },
    };
  }

  /** Fixed Deposit */
  static normalizeFixedDeposit(irisFd: Record<string, unknown>) {
    return {
      providerId: irisFd.productId,
      provider: "KFINTECH",
      assetClass: "FIXED_DEPOSIT",
      name: irisFd.productName || `${irisFd.issuerName} FD`,
      issuerName: irisFd.issuerName,
      interestRate: irisFd.interestRate || irisFd.yield,
      tenure: irisFd.tenureMonths,
      minInvestment: irisFd.minInvestment || 10000,
      riskLevel: "LOW",
      metadata: {
        lockInPeriod: irisFd.lockInMonths,
        payoutFrequency: irisFd.payoutOptions,
        rating: irisFd.creditRating,
        executionApi: "iris",
        orderType: "fd_purchase",
        fintekproRoute: "/api/iris/products/fixed-deposits/orders",
      },
    };
  }

  /** NPS Subscriber */
  static normalizeNps(irisNps: Record<string, unknown>) {
    return {
      providerId: irisNps.pran,
      provider: "KFINTECH",
      assetClass: "NPS",
      name: `NPS — ${irisNps.subscriberName ?? irisNps.pran}`,
      pran: irisNps.pran,
      fundValue: irisNps.totalFundValue,
      tier1Balance: irisNps.tier1Balance,
      tier2Balance: irisNps.tier2Balance,
      metadata: {
        pran: irisNps.pran,
        executionApi: "iris",
        orderType: "nps_contribution",
        fintekproRoute: "/api/iris/nps/subscriber/:pran/contribution",
      },
    };
  }

  /** PMS */
  static normalizePms(irisPms: Record<string, unknown>) {
    return {
      providerId: irisPms.strategyCode || irisPms.productId,
      provider: "KFINTECH",
      assetClass: "PMS",
      name: irisPms.strategyName || irisPms.productName,
      fundHouse: irisPms.pmsFundHouse,
      minInvestment: irisPms.minInvestment || 5000000,
      riskLevel: IrisProductMapper.mapRiskLevel(irisPms.riskLevel as string | undefined),
      returns: {
        returns1y: irisPms.returns1y,
        returns3y: irisPms.returns3y,
        returns5y: irisPms.returns5y,
      },
      metadata: {
        strategyCode: irisPms.strategyCode,
        executionApi: "iris",
        orderType: "pms_onboarding",
        fintekproRoute: "/api/iris/products/pms-links",
      },
    };
  }

  /** AIF */
  static normalizeAif(irisAif: Record<string, unknown>) {
    return {
      providerId: irisAif.schemeCode || irisAif.productId,
      provider: "KFINTECH",
      assetClass: "AIF",
      name: irisAif.schemeName || irisAif.productName,
      fundHouse: irisAif.aifFundHouse,
      category: irisAif.aifCategory,   // Cat I, II, III
      minCommitment: irisAif.minCommitment || 10000000,
      riskLevel: "HIGH",
      metadata: {
        schemeCode: irisAif.schemeCode,
        aifCategory: irisAif.aifCategory,
        sebiRegNo: irisAif.sebiRegNo,
        executionApi: "iris",
        orderType: "aif_subscription",
        fintekproRoute: "/api/iris/products/aif-links",
      },
    };
  }

  /** Bond (G-Sec / Corporate) */
  static normalizeBond(irisBond: Record<string, unknown>, bondType: "govt" | "corporate") {
    return {
      providerId: irisBond.isin,
      provider: "IRIS",
      assetClass: "BOND",
      name: irisBond.securityName || irisBond.bondName,
      isin: irisBond.isin,
      issuer: irisBond.issuer,
      bondType,
      couponRate: irisBond.couponRate,
      yieldToMaturity: irisBond.yieldToMaturity,
      maturityDate: irisBond.maturityDate,
      creditRating: irisBond.creditRating,
      riskLevel: bondType === "govt" ? "LOW" : IrisProductMapper.mapRiskLevel(irisBond.creditRating as string | undefined),
      metadata: {
        exchange: bondType === "govt" ? "NSE" : "BSE",
        executionApi: "iris",
        orderType: "bond_purchase",
        fintekproRoute: "/api/iris/transactions/place-order",
      },
    };
  }

  /** ETF */
  static normalizeEtf(irisEtf: Record<string, unknown>) {
    const isIndian = !irisEtf.country || irisEtf.country === "IN";
    return {
      providerId: irisEtf.symbol || irisEtf.isin,
      provider: "IRIS",
      assetClass: "ETF",
      name: irisEtf.companyName || irisEtf.name,
      isin: irisEtf.isin,
      symbol: irisEtf.symbol,
      exchange: irisEtf.exchange ?? "NSE",
      currentPrice: irisEtf.currentPrice,
      riskLevel: IrisProductMapper.mapRiskLevel(irisEtf.riskLevel as string | undefined),
      metadata: {
        nseSymbol: irisEtf.symbol,
        bseCode: irisEtf.bseCode,
        nseCode: irisEtf.nseCode ?? "EQ",
        country: irisEtf.country ?? "IN",
        currency: irisEtf.currency ?? "INR",
        executionApi: isIndian ? "iris" : "alpaca",
        orderType: "etf_purchase",
        fintekproRoute: "/api/iris/transactions/place-order",
      },
    };
  }

  private static mapRiskLevel(
    riskometer?: string,
  ): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (!riskometer) return "MEDIUM";
    const lower = riskometer.toLowerCase();
    if (lower.includes("low")) return "LOW";
    if (lower.includes("very high") || lower.includes("critical")) return "CRITICAL";
    if (lower.includes("high")) return "HIGH";
    return "MEDIUM";
  }
}
