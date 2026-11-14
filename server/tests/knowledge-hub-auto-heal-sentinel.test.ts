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
			{ name: "ICICI Bank", symbol: "ICICIBANK", price: 1527.0, change: 1.8, direction: "up" },
			{ name: "HDFC Bank", symbol: "HDFCBANK", price: 771.25, change: 1.48, direction: "up" },
			{ name: "Bharti Airtel", symbol: "BHARTIARTL", price: 2084.0, change: 1.32, direction: "up" },
			{ name: "Tata Motors", symbol: "TATAMOTORS", price: 287.0, change: -2.28, direction: "down" },
		],
		multiExchangeData: {
			institutionalFlows: {
				fiiNetCr: 5736.55,
				diiNetCr: -2253.58,
				monthlySipCr: 26425,
				asOfDate: "2026-11-13",
			},
		},
		commodityRadar: {
			goldPrice: 141255,
			commodities: [
				{ id: "GOLD", name: "Gold 24K (MCX Standard)", mcxPrice: 141255 },
				{ id: "CRUDE_OIL", name: "Crude Oil", mcxPrice: 9115 },
			],
			crudeOilBreakevenStatus: {
				brentUsd: 96.09,
			},
		},
		ccilFixedIncome: {
			fbilMiborOvernight: 6.5,
			sovereignYields: [{ tenor: "10Y", yieldPercent: 6.79 }],
			treps: { weightedAverageRate: 6.42 },
		},
		globalMacroDesk: {
			usdInr: 94.86,
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

	it("reports sentinel status summary correctly", () => {
		knowledgeHubAutoHealSentinel.auditBrief(validPristineBrief, "india");
		const status = knowledgeHubAutoHealSentinel.getSentinelStatus();
		expect(status.autoHealActive).toBe(true);
		expect(status.overallQualityScore).toBeGreaterThanOrEqual(90);
		expect(status.engineVersion).toContain("FASP-AI");
		expect(status.regions.india).toBeDefined();
	});
});
