import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
		execute: vi.fn().mockResolvedValue({ rows: [] }),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
	},
	pool: { end: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../logger", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	logAuditEvent: vi.fn(),
}));

vi.mock("../email-service", () => ({
	emailService: {
		sendEmail: vi.fn(),
	},
}));

vi.mock("../clients/python-client", () => ({
	callPython: vi.fn().mockResolvedValue(null),
	proxyToPython: vi.fn(),
}));
import {
	sebiCategoryEngine,
	SEBI_MF_REGS_2026,
} from "../services/mf-sebi-category-engine";
import { isFundInvestable } from "../services/regulatory-investability-service";
import {
	validateIAFeeCompliance,
	IA_FEE_CAPS_2026,
	FEE_CALCULATOR_ENGINE_VERSION,
} from "../services/fee-calculator-service";
import {
	validateWeeklyExpiryEligibility,
	SEBI_FNO_FRAMEWORK_2026,
} from "../services/derivatives-service";
import {
	classifyETFPriceCategory,
	resolveETFBasePrice,
	ETF_PRICE_BANDS,
} from "../services/etf-trading-framework";
import {
	getPreOpenPhase,
	describePreOpenPhase,
} from "../services/market-session-service";

describe("SEBI MF Regulations 2026 & Category Engine", () => {
	it("exposes the authoritative SEBI 2026 circular reference and constants", () => {
		expect(SEBI_MF_REGS_2026.CIRCULAR_REF).toBe("SEBI-MF-REGS-2026-v1");
		expect(SEBI_MF_REGS_2026.SIF_MIN_INVESTMENT_INR).toBe(1000000);
		expect(SEBI_MF_REGS_2026.MAX_ALTERNATIVE_ASSET_PCT).toBe(35);
		expect(SEBI_MF_REGS_2026.SECTORAL_THEMATIC_MAX_OVERLAP_PCT).toBe(50);
	});

	it("detects Specialised Investment Fund (SIF) correctly", () => {
		expect(
			sebiCategoryEngine.isSIFFund({
				schemeName: "Edelweiss SIF Long-Short Equity Strategy",
			}),
		).toBe(true);
		expect(
			sebiCategoryEngine.isSIFFund({
				category: "SIF",
				schemeSubCategory: "Specialised Investment Fund",
			}),
		).toBe(true);
		expect(
			sebiCategoryEngine.isSIFFund({
				schemeName: "HDFC Top 100 Large Cap Fund",
			}),
		).toBe(false);
	});

	it("detects Life Cycle Fund correctly", () => {
		expect(
			sebiCategoryEngine.isLifecycleFund({
				category: "Lifecycle",
				schemeSubCategory: "Life Cycle Fund 2045",
			}),
		).toBe(true);
		expect(
			sebiCategoryEngine.isLifecycleFund({
				schemeName: "Kotak Target Maturity 2035 Fund",
			}),
		).toBe(true);
		expect(
			sebiCategoryEngine.isLifecycleFund({
				schemeName: "ICICI Prudential Bluechip Fund",
			}),
		).toBe(false);
	});

	it("enforces SEBI 50% overlap cap on Sectoral/Thematic funds", () => {
		const compliant = sebiCategoryEngine.validatePortfolioOverlap(
			42,
			"Sectoral/Thematic",
		);
		expect(compliant.compliant).toBe(true);
		expect(compliant.maxAllowedPct).toBe(50);

		const breach = sebiCategoryEngine.validatePortfolioOverlap(
			58,
			"Sectoral/Thematic",
		);
		expect(breach.compliant).toBe(false);
		expect(breach.maxAllowedPct).toBe(50);
		expect(breach.message).toContain("Portfolio overlap breach");
	});
});

describe("Regulatory Investability Service (2026 Updates)", () => {
	it("enforces minimum ₹10 Lakh ticket on SIF investments", () => {
		const underMin = isFundInvestable({
			schemeName: "ICICI SIF Inverse Strategy",
			amount: 400000,
		});
		expect(underMin.investable).toBe(false);
		expect(underMin.restrictionType).toBe("sif");
		expect(underMin.minInvestmentRequired).toBe(1000000);
		expect(underMin.reason).toContain("₹10,00,000");

		const meetsMin = isFundInvestable({
			schemeName: "ICICI SIF Inverse Strategy",
			amount: 1200000,
		});
		expect(meetsMin.investable).toBe(true);
		expect(meetsMin.minInvestmentRequired).toBe(1000000);
	});

	it("attaches BER note and Life Cycle guidance to investability results", () => {
		const lcResult = isFundInvestable({
			schemeName: "Axis Life Cycle 2050 Retirement Fund",
		});
		expect(lcResult.investable).toBe(true);
		expect(lcResult.lifecycleNote).toContain("5-year minimum holding horizon");
		expect(lcResult.berNote).toContain("Base Expense Ratio (BER)");
	});
});

describe("Fee Calculator Service — SEBI IA Master Circular 2026", () => {
	it("has updated engine version to SEBI 2026 circular", () => {
		expect(FEE_CALCULATOR_ENGINE_VERSION).toContain(
			"2.0.0-SEBI-MASTER-CIRCULAR-2026",
		);
	});

	it("enforces fixed fee statutory cap of ₹1,51,000 per annum per family", () => {
		expect(IA_FEE_CAPS_2026.FIXED_FEE_MAX_PER_ANNUM_INR).toBe(151000);

		const valid = validateIAFeeCompliance({
			feeMode: "fixed",
			proposedFeePerAnnum: 150000,
		});
		expect(valid.compliant).toBe(true);

		const invalid = validateIAFeeCompliance({
			feeMode: "fixed",
			proposedFeePerAnnum: 151500,
		});
		expect(invalid.compliant).toBe(false);
		expect(invalid.message).toContain("exceeds SEBI statutory ceiling");
	});

	it("enforces AUA-based fee cap of 2.5% per annum per family", () => {
		expect(IA_FEE_CAPS_2026.AUA_FEE_MAX_PERCENT).toBe(2.5);

		const valid = validateIAFeeCompliance({
			feeMode: "aua",
			proposedFeePerAnnum: 20000,
			aua: 1000000, // 2%
		});
		expect(valid.compliant).toBe(true);

		const invalid = validateIAFeeCompliance({
			feeMode: "aua",
			proposedFeePerAnnum: 35000,
			aua: 1000000, // 3.5%
		});
		expect(invalid.compliant).toBe(false);
		expect(invalid.message).toContain("exceeds SEBI statutory ceiling");
	});

	it("prohibits advance fees beyond 12 months", () => {
		const invalidAdvance = validateIAFeeCompliance({
			feeMode: "fixed",
			proposedFeePerAnnum: 50000,
			advanceMonths: 18,
		});
		expect(invalidAdvance.compliant).toBe(false);
		expect(invalidAdvance.message).toContain("Prohibited advance fee duration");
	});
});

describe("SEBI Index Derivatives Framework & Derivatives Service", () => {
	it("has updated contract lot sizes per circular", () => {
		expect(SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.NIFTY).toBe(65);
		expect(SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.BANKNIFTY).toBe(30);
		expect(SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.SENSEX).toBe(20);
		expect(SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.FINNIFTY).toBe(65);
		expect(SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.MIDCPNIFTY).toBe(120);
	});

	it("permits weekly expiry ONLY on NIFTY (NSE) and SENSEX (BSE)", () => {
		const niftyWeekly = validateWeeklyExpiryEligibility("NIFTY", true);
		expect(niftyWeekly.allowed).toBe(true);

		const sensexWeekly = validateWeeklyExpiryEligibility("SENSEX", true);
		expect(sensexWeekly.allowed).toBe(true);

		const bankNiftyWeekly = validateWeeklyExpiryEligibility("BANKNIFTY", true);
		expect(bankNiftyWeekly.allowed).toBe(false);
		expect(bankNiftyWeekly.error).toBe("WEEKLY_EXPIRY_DISCONTINUED");

		const finNiftyWeekly = validateWeeklyExpiryEligibility("FINNIFTY", true);
		expect(finNiftyWeekly.allowed).toBe(false);
		expect(finNiftyWeekly.error).toBe("WEEKLY_EXPIRY_DISCONTINUED");
	});

	it("permits monthly contracts for all eligible indices", () => {
		const bankNiftyMonthly = validateWeeklyExpiryEligibility("BANKNIFTY", false);
		expect(bankNiftyMonthly.allowed).toBe(true);
	});
});

describe("SEBI ETF Revised Trading Framework (Sep 7, 2026)", () => {
	it("classifies ETF categories with corresponding dynamic price bands", () => {
		expect(classifyETFPriceCategory("Nippon India ETF Gold BeES")).toBe("commodity");
		expect(ETF_PRICE_BANDS.commodity.initialBandPct).toBe(6);
		expect(ETF_PRICE_BANDS.commodity.expansionStepPct).toBe(3);

		expect(classifyETFPriceCategory("Nifty BeES")).toBe("equity_debt");
		expect(ETF_PRICE_BANDS.equity_debt.initialBandPct).toBe(10);
		expect(ETF_PRICE_BANDS.equity_debt.maxBandPct).toBe(20);

		expect(classifyETFPriceCategory("DSP Liquid ETF")).toBe("liquid");
		expect(ETF_PRICE_BANDS.liquid.initialBandPct).toBe(5);
		expect(ETF_PRICE_BANDS.liquid.isFixed).toBe(true);
	});

	it("resolves ETF base price prioritizing previous-day last-30-min VWAP", () => {
		const basePrice = resolveETFBasePrice(250.25, 251.0, 249.5, "2026-09-08");
		expect(basePrice.price).toBe(250.25);
		expect(basePrice.source).toBe("vwap_30min");
	});
});

describe("NSE/BSE Pre-Open Two-Phase Restructure (Sep 7, 2026)", () => {
	it("identifies phase 1 (09:00-09:05 IST: market + limit orders)", () => {
		const testTime = new Date("2026-09-09T09:02:00+05:30");
		expect(getPreOpenPhase(testTime)).toBe("phase1");
		expect(describePreOpenPhase("phase1")).toContain("Market & limit orders accepted");
	});

	it("identifies phase 2 (09:05-09:10 IST: limit orders only)", () => {
		const testTime = new Date("2026-09-09T09:06:30+05:30");
		expect(getPreOpenPhase(testTime)).toBe("phase2");
		expect(describePreOpenPhase("phase2")).toContain("Limit orders only");
	});

	it("identifies matching phase (09:10-09:15 IST)", () => {
		const testTime = new Date("2026-09-09T09:13:00+05:30");
		expect(getPreOpenPhase(testTime)).toBe("matching");
		expect(describePreOpenPhase("matching")).toContain("Price determination");
	});

	it("returns null outside pre-open session", () => {
		const testTime = new Date("2026-09-09T09:30:00+05:30");
		expect(getPreOpenPhase(testTime)).toBe(null);
	});
});
