/**
 * @file mcx-ncdex-bhavcopy-service.test.ts
 * @description Unit tests for official MCX and NCDEX Bhavcopy & Spot Ingestion Services.
 */

import { describe, it, expect } from "vitest";
import { mcxBhavcopyService, MCX_POLLED_SPOT_BENCHMARKS } from "../services/mcx-bhavcopy-service";
import { ncdexBhavcopyService, NCDEX_MANDI_POLLED_SPOT_BENCHMARKS } from "../services/ncdex-bhavcopy-service";
import { FRED_SERIES } from "../services/fred-commodity-service";
import { SEBI_AUDIT_GRADE_SOURCES, SOURCE_CONFIDENCE } from "../services/golden-pricing/GoldenPricingEngine";

describe("MCX Bhavcopy & Polled Spot Ingestion Service", () => {
	it("resolves valid candidate settlement trade date", () => {
		const dateStr = mcxBhavcopyService.getSettlementDate();
		expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns valid canonical polled spot benchmarks with official delivery centers", async () => {
		const records = await mcxBhavcopyService.fetchPolledSpotRecords("2026-11-20");
		expect(records.length).toBeGreaterThanOrEqual(5);

		const gold = records.find((r) => r.commoditySymbol === "GOLD");
		expect(gold).toBeDefined();
		expect(gold?.deliveryCenter).toBe("Ahmedabad");
		expect(gold?.price).toBe(78250);
		expect(gold?.unit).toBe("₹ / 10g");
		expect(gold?.isSpot).toBe(true);

		const silver = records.find((r) => r.commoditySymbol === "SILVER");
		expect(silver).toBeDefined();
		expect(silver?.deliveryCenter).toBe("Ahmedabad");
		expect(silver?.price).toBe(91500);

		const copper = records.find((r) => r.commoditySymbol === "COPPER");
		expect(copper).toBeDefined();
		expect(copper?.deliveryCenter).toBe("Thane");
	});

	it("executes syncLatestBhavcopy without throwing fatal errors", async () => {
		const result = await mcxBhavcopyService.syncLatestBhavcopy("2026-11-20");
		expect(result.success).toBe(true);
		expect(result.totalRecords).toBeGreaterThanOrEqual(5);
	});
});

describe("NCDEX Bhavcopy & Mandi Spot Ingestion Service", () => {
	it("resolves candidate settlement trade date", () => {
		const dateStr = ncdexBhavcopyService.getSettlementDate();
		expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns valid Mandi polled spot records for agri commodities", () => {
		const records = ncdexBhavcopyService.fetchMandiSpotRecords("2026-11-20");
		expect(records.length).toBe(6);

		const jeera = records.find((r) => r.id === "JEERA");
		expect(jeera).toBeDefined();
		expect(jeera?.deliveryCenter).toBe("Unjha (Gujarat)");
		expect(jeera?.price).toBe(28450);

		const turmeric = records.find((r) => r.id === "TURMERIC");
		expect(turmeric).toBeDefined();
		expect(turmeric?.deliveryCenter).toBe("Nizamabad (Telangana)");

		const cocudakl = records.find((r) => r.id === "COCUDAKL");
		expect(cocudakl).toBeDefined();
		expect(cocudakl?.deliveryCenter).toBe("Akola (Maharashtra)");
	});

	it("executes syncLatestBhavcopy and records golden prices", async () => {
		const result = await ncdexBhavcopyService.syncLatestBhavcopy("2026-11-20");
		expect(result.success).toBe(true);
		expect(result.totalRecords).toBeGreaterThanOrEqual(6);
	});
});

describe("Golden Pricing Engine & FRED Commodity Sourcing Enhancements", () => {
	it("recognizes MCX and NCDEX bhavcopy as SEBI audit-grade sources", () => {
		expect(SEBI_AUDIT_GRADE_SOURCES.has("MCX_BHAVCOPY")).toBe(true);
		expect(SEBI_AUDIT_GRADE_SOURCES.has("MCX_SPOT")).toBe(true);
		expect(SEBI_AUDIT_GRADE_SOURCES.has("NCDEX_BHAVCOPY")).toBe(true);
		expect(SEBI_AUDIT_GRADE_SOURCES.has("NCDEX_SPOT")).toBe(true);
	});

	it("defines high confidence scores (>= 95%) for MCX and NCDEX", () => {
		expect(SOURCE_CONFIDENCE.MCX_BHAVCOPY).toBeGreaterThanOrEqual(95);
		expect(SOURCE_CONFIDENCE.MCX_SPOT).toBeGreaterThanOrEqual(95);
		expect(SOURCE_CONFIDENCE.NCDEX_BHAVCOPY).toBeGreaterThanOrEqual(95);
		expect(SOURCE_CONFIDENCE.NCDEX_SPOT).toBeGreaterThanOrEqual(95);
	});

	it("includes official FRED LBMA series for Gold and Silver", () => {
		expect(FRED_SERIES.GOLD).toBeDefined();
		expect(FRED_SERIES.GOLD.id).toBe("GOLDAMGBD228NLBM");
		expect(FRED_SERIES.GOLD.unit).toBe("USD / oz");

		expect(FRED_SERIES.SILVER).toBeDefined();
		expect(FRED_SERIES.SILVER.id).toBe("SLVPRUSD");
		expect(FRED_SERIES.SILVER.unit).toBe("USD / oz");
	});
});
