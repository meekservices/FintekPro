/**
 * FintekPro Knowledge Hub Auto-Heal Sentinel Unit Tests
 * Adheres strictly to FintekPro GCR v1.0 + SEBI FASP-AI v1.0
 */

import { describe, it, expect, vi } from "vitest";
import { knowledgeHubAutoHealSentinel } from "../services/knowledge-hub-auto-heal-sentinel";

describe("Knowledge Hub Auto-Heal & Quality Sentinel", () => {
	const validPristineBrief = {
		id: "brief-test-1",
		date: new Date().toISOString().split("T")[0],
		region: "india",
		version: 1,
		marketSnapshot:
			"Indian equity benchmarks traded with constructive momentum today as Nifty 50 and Sensex advanced steadily. Bank Nifty outperformed led by frontline lenders. CCIL 10-Year Benchmark G-Sec yield traded near 6.79% with healthy TREPS volume.",
		whatChanged:
			"1. Sovereign Debt: Benchmark G-Sec yield at 6.79% with healthy repo volume.\n2. Commodity Radar: MCX Gold traded firm on sustained institutional demand.\n3. Institutional Flows: DII mutual fund SIPs provide steady domestic liquidity.",
		keyRisks:
			"Crude oil volatility, US Dollar Index movements, and shifting foreign institutional derivative positions.",
		opportunityAreas:
			"1. Target Maturity Debt Funds & Banking PSU Debt.\n2. Multi-Asset Allocation Funds.\n3. Large-Cap Systematic Equity SIPs.",
		portfolioImpact:
			"Maintain balanced multi-asset allocation to smooth volatility while participating in economic expansion.",
		complianceNote:
			"SEBI FASP-AI v1.0 Regulatory Notice: Strictly for Registered Investment Advisors (RIA) & Mutual Fund Distributors (MFD) decision support. Not deterministic investment advice or guaranteed return solicitation.",
		topMovers: [
			{ name: "ICICI Bank", symbol: "ICICIBANK", price: 1287.0, change: 1.8, direction: "up" },
			{ name: "HDFC Bank", symbol: "HDFCBANK", price: 1771.25, change: 1.48, direction: "up" },
			{ name: "Bharti Airtel", symbol: "BHARTIARTL", price: 2084.0, change: 1.32, direction: "up" },
			{ name: "Tata Motors", symbol: "TATAMOTORS", price: 810.0, change: -1.28, direction: "down" },
		],
		multiExchangeData: {
			institutionalFlows: {
				fiiNetCr: -1420.5,
				diiNetCr: 2840.2,
				monthlySipCr: 26425,
				absorptionRatio: 2.0,
				asOfDate: new Date().toISOString().split("T")[0],
			},
		},
		commodityRadar: {
			goldPrice: 78250,
			commodities: [
				{ id: "GOLD", name: "Gold 24K (MCX Standard)", mcxPrice: 78250 },
				{ id: "SILVER", name: "Silver", mcxPrice: 91500 },
				{ id: "CRUDE_OIL", name: "Crude Oil", mcxPrice: 6325 },
			],
			crudeOilBreakevenStatus: {
				brentUsd: 74.50,
			},
		},
		ccilFixedIncome: {
			fbilMiborOvernight: 6.5,
			sovereignYields: [{ tenor: "10Y", yieldPercent: 6.79 }],
			treps: { weightedAverageRate: 6.42 },
			yieldCurveAnalysis: { realYield10Y: 0.58 },
		},
		macroIndicators: {
			indiaCpiInflation: { value: 6.21 },
		},
		globalMacroDesk: {
			usdInr: 84.45,
			dxyIndex: 104.25,
		},
	};

	it("audits a pristine brief and awards high quality score (>= 95%) with PRISTINE status", () => {
		const report = knowledgeHubAutoHealSentinel.auditBrief(validPristineBrief, "india");
		expect(report.qualityScore).toBeGreaterThanOrEqual(95);
		expect(report.status).toBe("PRISTINE");
		expect(report.violations.filter((v) => v.severity === "critical")).toHaveLength(0);
		expect(report.dimensions.institutionalFinancials).toBe(25);
		expect(report.dimensions.commodityMacroPricing).toBe(20);
		expect(report.dimensions.sebiCompliance).toBe(15);
	});

	it("detects micro-contract gold price corruption (e.g. 1g GOLDPETAL at ₹13,800) and marks critical violation", () => {
		const corruptedBrief = {
			...validPristineBrief,
			commodityRadar: {
				...validPristineBrief.commodityRadar,
				goldPrice: 13807, // 1g micro-contract error!
				commodities: [{ id: "GOLD", mcxPrice: 13807 }],
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(corruptedBrief, "india");
		const microViolation = report.violations.find((v) => v.code === "GOLD_MICRO_CONTRACT_CORRUPTION");
		expect(microViolation).toBeDefined();
		expect(microViolation?.severity).toBe("critical");
		expect(report.status).not.toBe("PRISTINE");
		expect(report.dimensions.commodityMacroPricing).toBeLessThan(20);
	});

	it("detects NaN or non-numeric FII/DII institutional cash flows", () => {
		const corruptedBrief = {
			...validPristineBrief,
			multiExchangeData: {
				institutionalFlows: {
					fiiNetCr: Number.NaN,
					diiNetCr: -2253.58,
					monthlySipCr: 26425,
				},
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(corruptedBrief, "india");
		const fiiViolation = report.violations.find((v) => v.code === "INVALID_FII_NET");
		expect(fiiViolation).toBeDefined();
		expect(fiiViolation?.severity).toBe("critical");
		expect(report.dimensions.institutionalFinancials).toBeLessThan(25);
	});

	it("detects missing SEBI FASP-AI compliance disclaimer", () => {
		const nonCompliantBrief = {
			...validPristineBrief,
			complianceNote: "Generic investment tips without regulatory citations.",
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(nonCompliantBrief, "india");
		const sebiViolation = report.violations.find((v) => v.code === "MISSING_SEBI_COMPLIANCE_NOTE");
		expect(sebiViolation).toBeDefined();
		expect(sebiViolation?.severity).toBe("critical");
	});

	it("detects prohibited deterministic profit claims", () => {
		const illegalBrief = {
			...validPristineBrief,
			marketSnapshot:
				validPristineBrief.marketSnapshot + " This portfolio strategy guarantees 100% gain with zero risk.",
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(illegalBrief, "india");
		const claimViolation = report.violations.find((v) => v.code === "PROHIBITED_DETERMINISTIC_LANGUAGE");
		expect(claimViolation).toBeDefined();
		expect(claimViolation?.severity).toBe("critical");
	});

	it("detects stale institutional flow trade date and flags STALE_INSTITUTIONAL_FLOW_DATE violation", () => {
		const staleBrief = {
			...validPristineBrief,
			multiExchangeData: {
				institutionalFlows: {
					...validPristineBrief.multiExchangeData.institutionalFlows,
					asOfDate: "2026-11-13",
				},
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(staleBrief, "india");
		const staleViolation = report.violations.find((v) => v.code === "STALE_INSTITUTIONAL_FLOW_DATE");
		expect(staleViolation).toBeDefined();
		expect(staleViolation?.severity).toBe("warning");
		expect(report.dimensions.institutionalFinancials).toBeLessThan(25);
	});

	it("reports sentinel status summary correctly", () => {
		knowledgeHubAutoHealSentinel.auditBrief(validPristineBrief, "india");
		const status = knowledgeHubAutoHealSentinel.getSentinelStatus();
		expect(status.autoHealActive).toBe(true);
		expect(status.overallQualityScore).toBeGreaterThanOrEqual(90);
		expect(status.engineVersion).toContain("FASP-AI");
		expect(status.regions.india).toBeDefined();
	});

	// ── US Fixed Income & Sovereign Desk Sentinel Tests ─────────────────────────

	const validUsBrief = {
		id: "brief-us-test-1",
		date: new Date().toISOString().split("T")[0],
		region: "us",
		version: 1,
		marketSnapshot:
			"US equity benchmarks traded with positive momentum today led by megacap technology. S&P 500 and Nasdaq 100 consolidated near record highs. The benchmark 10-Year US Treasury yield stood at 4.42%, maintaining a normal upward slope over 2-year notes (4.30%).",
		whatChanged:
			"1. Megacap Tech Momentum: Hyperscaler AI capex supporting S&P 500.\n2. Treasury Yields & FOMC Stance: US 10-Year Treasury at 4.42%, 2-Year at 4.30% (+12 bps spread).\n3. Currency: DXY at 104.25.",
		keyRisks:
			"FOMC interest rate guidance path, US Dollar Index movements, and trade tariff negotiations.",
		opportunityAreas: "1. Core index ETFs (SPY, QQQ).\n2. Cash-generative tech titans.",
		portfolioImpact: "Encourage 10-15% global asset diversification under RBI LRS.",
		complianceNote:
			"SEBI FASP-AI v1.0 Regulatory Notice: Strictly for RIA decision support. Not deterministic investment advice or guaranteed return solicitation.",
		topMovers: [
			{ name: "Apple Inc.", symbol: "AAPL", price: 228.0, change: 1.2, direction: "up" },
			{ name: "Microsoft Corp.", symbol: "MSFT", price: 425.0, change: 0.8, direction: "up" },
			{ name: "Nvidia Corp.", symbol: "NVDA", price: 145.0, change: 2.1, direction: "up" },
		],
		usFixedIncome: {
			tenYearTreasury: 4.42,
			twoYearTreasury: 4.30,
			tenYearMinusTwoYearBps: 12,
			fedFundsTargetRate: "4.50% – 4.75%",
			thirtyYearMortgageAvg: 6.78,
			yieldCurveSlope: "Normal Upward (+12 bps)",
			commentary: "US 10-Year Treasury at 4.42% as markets price in orderly FOMC rate path adjustments within 4.50% - 4.75% band.",
		},
	};

	it("audits a pristine US brief and awards high quality score (>= 95%) with zero critical violations", () => {
		const report = knowledgeHubAutoHealSentinel.auditBrief(validUsBrief, "us");
		expect(report.qualityScore).toBeGreaterThanOrEqual(95);
		expect(report.status).toBe("PRISTINE");
		expect(report.violations.filter((v) => v.severity === "critical")).toHaveLength(0);
	});

	it("detects outdated or prematurely cut Fed Funds target range (e.g. 4.25% – 4.50%)", () => {
		const outdatedBrief = {
			...validUsBrief,
			usFixedIncome: {
				...validUsBrief.usFixedIncome,
				fedFundsTargetRate: "4.25% – 4.50%",
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(outdatedBrief, "us");
		const fomcViolation = report.violations.find((v) => v.code === "OUTDATED_FED_FUNDS_TARGET");
		expect(fomcViolation).toBeDefined();
		expect(fomcViolation?.severity).toBe("critical");
	});

	it("detects term spread arithmetic mismatch (e.g. 10Y: 4.42, 2Y: 4.30, spread: 23 bps)", () => {
		const mismatchedBrief = {
			...validUsBrief,
			usFixedIncome: {
				...validUsBrief.usFixedIncome,
				tenYearTreasury: 4.42,
				twoYearTreasury: 4.30,
				tenYearMinusTwoYearBps: 23, // 4.42 - 4.30 = 12 bps, not 23!
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(mismatchedBrief, "us");
		const spreadViolation = report.violations.find((v) => v.code === "TERM_SPREAD_MATH_MISMATCH");
		expect(spreadViolation).toBeDefined();
	});

	it("detects yield curve slope classification error (labeled Inverted when spread is positive)", () => {
		const slopeErrorBrief = {
			...validUsBrief,
			usFixedIncome: {
				...validUsBrief.usFixedIncome,
				tenYearMinusTwoYearBps: 12,
				yieldCurveSlope: "Inverted (-12 bps)",
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(slopeErrorBrief, "us");
		const slopeViolation = report.violations.find((v) => v.code === "YIELD_CURVE_SLOPE_MISMATCH");
		expect(slopeViolation).toBeDefined();
	});

	it("detects stale Freddie Mac 30Y mortgage fallback (6.55%)", () => {
		const staleMortgageBrief = {
			...validUsBrief,
			usFixedIncome: {
				...validUsBrief.usFixedIncome,
				thirtyYearMortgageAvg: 6.55, // Stale September fallback
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(staleMortgageBrief, "us");
		const mortgageViolation = report.violations.find((v) => v.code === "STALE_MORTGAGE_FALLBACK_DETECTED");
		expect(mortgageViolation).toBeDefined();
	});

	it("detects US 10Y Treasury yield outlier (e.g. 7.50%)", () => {
		const outlierBrief = {
			...validUsBrief,
			usFixedIncome: {
				...validUsBrief.usFixedIncome,
				tenYearTreasury: 7.50, // Outlier
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(outlierBrief, "us");
		const yieldViolation = report.violations.find((v) => v.code === "UNREALISTIC_US_10Y_YIELD");
		expect(yieldViolation).toBeDefined();
		expect(yieldViolation?.severity).toBe("critical");
	});

	// ── Global Macro Transmission Sentinel Tests ───────────────────────────────

	const validGlobalBrief = {
		id: "brief-global-test-1",
		date: new Date().toISOString().split("T")[0],
		region: "global",
		version: 1,
		marketSnapshot:
			"Global equity benchmarks traded with constructive risk sentiment across Asian and European sessions. The US Dollar Index (DXY) traded at 104.25, anchoring cross-border capital flows.",
		whatChanged:
			"1. Cross-Asset Transmission: US Dollar Index (DXY) at 104.25.\n2. European Momentum: DAX and FTSE holding gains.\n3. Sovereign Bond Spreads: 10Y Bund at 2.35%, UK Gilt at 4.25%, JGB at 1.15%.",
		keyRisks:
			"Global geopolitical developments, shifting trade tariff policies, and currency volatility.",
		opportunityAreas: "1. Global multi-asset diversification.\n2. Developed market sovereign debt.",
		portfolioImpact: "Maintain core portfolio allocation with diversified foreign currency exposure.",
		complianceNote:
			"SEBI FASP-AI v1.0 Regulatory Notice: Strictly for RIA decision support. Not deterministic investment advice or guaranteed return solicitation.",
		topMovers: [
			{ name: "DAX 40", symbol: "DAX", price: 19480.0, change: 0.45, direction: "up" },
			{ name: "Nikkei 225", symbol: "N225", price: 38950.0, change: 0.95, direction: "up" },
			{ name: "FTSE 100", symbol: "UKX", price: 8245.0, change: -0.32, direction: "down" },
		],
		globalMacroDesk: {
			dxyIndex: 104.25,
			dxyChangePercent: 0.08,
			bund10YYield: 2.35,
			gilt10YYield: 4.25,
			jgb10YYield: 1.15,
			usdInr: 84.45,
		},
	};

	it("detects unanchored gold price anomaly (e.g. legacy ₹141,255/10g) as critical violation", () => {
		const corruptedBrief = {
			...validPristineBrief,
			commodityRadar: {
				...validPristineBrief.commodityRadar,
				goldPrice: 141255, // legacy corrupt mock!
				commodities: [{ id: "GOLD", mcxPrice: 141255 }],
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(corruptedBrief, "india");
		const goldAnomaly = report.violations.find((v) => v.code === "GOLD_PRICE_ANOMALY");
		expect(goldAnomaly).toBeDefined();
		expect(goldAnomaly?.severity).toBe("critical");
	});

	it("detects out-of-corridor USD/INR rate (e.g. legacy ₹94.86) as critical violation", () => {
		const corruptedBrief = {
			...validPristineBrief,
			globalMacroDesk: {
				...validPristineBrief.globalMacroDesk,
				usdInr: 94.86, // legacy corrupt mock!
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(corruptedBrief, "india");
		const fxViolation = report.violations.find((v) => v.code === "UNREALISTIC_USD_INR");
		expect(fxViolation).toBeDefined();
		expect(fxViolation?.severity).toBe("critical");
	});

	it("audits a pristine Global brief with zero critical violations", () => {
		const report = knowledgeHubAutoHealSentinel.auditBrief(validGlobalBrief, "global");
		expect(report.qualityScore).toBeGreaterThanOrEqual(95);
		expect(report.status).toBe("PRISTINE");
	});

	it("detects US Dollar Index (DXY) outlier (e.g. 135.0)", () => {
		const dxyOutlierBrief = {
			...validGlobalBrief,
			globalMacroDesk: {
				...validGlobalBrief.globalMacroDesk,
				dxyIndex: 135.0,
			},
		};

		const report = knowledgeHubAutoHealSentinel.auditBrief(dxyOutlierBrief, "global");
		const dxyViolation = report.violations.find((v) => v.code === "DXY_OUTLIER_DETECTED");
		expect(dxyViolation).toBeDefined();
		expect(dxyViolation?.severity).toBe("critical");
	});
});
