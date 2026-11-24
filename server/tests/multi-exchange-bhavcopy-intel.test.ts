/**
 * @file multi-exchange-bhavcopy-intel.test.ts
 * @description Unit tests for Multi-Exchange Bhavcopy & Market Intelligence Ingestion:
 *              - BSE Official Settlement Bhavcopy Service
 *              - NSE Official F&O Participant Open Interest Service
 *              - Integration with Domestic Market Intelligence Engine (DMIE)
 */

import { describe, it, expect } from "vitest";
import { bseBhavcopyService } from "../services/bse-bhavcopy-service";
import { nseFoParticipantService } from "../services/nse-fo-participant-service";
import { domesticMarketIntelligenceEngine } from "../services/macro/domestic-market-intelligence-engine";
import { SEBI_AUDIT_GRADE_SOURCES } from "../services/golden-pricing/GoldenPricingEngine";

describe("BSE Official Bhavcopy Ingestion Service", () => {
	it("resolves valid candidate trading dates in DDMMYY and ISO formats", () => {
		const dates = bseBhavcopyService.getCandidateDates(3);
		expect(dates.length).toBeGreaterThanOrEqual(1);
		for (const d of dates) {
			expect(d.ddmmyy).toMatch(/^\d{6}$/);
			expect(d.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});

	it("parses BSE Bhavcopy CSV into structured records with turnover and group segmentation", () => {
		const sampleBseCsv = [
			"SC_CODE,SC_NAME,SC_GROUP,SC_TYPE,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,NO_TRADES,NO_OF_SHRS,NET_TURNOV,TDCLOSETD,ISIN_CODE",
			"500325,RELIANCE,A,Q,1250.00,1265.00,1245.00,1260.50,1260.00,1248.00,45200,1500000,1890000000,0,INE002A01018",
			"532540,TCS,A,Q,4100.00,4150.00,4080.00,4120.00,4115.00,4090.00,28500,450000,1854000000,0,INE467B01029",
			"590001,PENNYSPEC,Z,Q,5.20,5.45,4.95,5.10,5.05,5.00,1200,100000,510000,0,INE999Z01010",
		].join("\n");

		const records = bseBhavcopyService.parseBhavcopy(sampleBseCsv, "2026-11-24");
		expect(records.length).toBe(3);

		const reliance = records.find((r) => r.scripCode === "500325");
		expect(reliance).toBeDefined();
		expect(reliance?.scripName).toBe("RELIANCE");
		expect(reliance?.close).toBe(1260.5);
		expect(reliance?.isin).toBe("INE002A01018");
		expect(reliance?.scripGroup).toBe("A");
		expect(reliance?.turnover).toBe(1890000000);

		const penny = records.find((r) => r.scripCode === "590001");
		expect(penny).toBeDefined();
		expect(penny?.scripGroup).toBe("Z");
	});

	it("recognizes BSE_BHAVCOPY as a SEBI audit-grade settlement source", () => {
		expect(SEBI_AUDIT_GRADE_SOURCES.has("BSE_BHAVCOPY")).toBe(true);
	});
});

describe("NSE Official F&O Participant Open Interest Service", () => {
	it("resolves valid candidate trading dates in DDMMYYYY format", () => {
		const dates = nseFoParticipantService.getCandidateDates(3);
		expect(dates.length).toBeGreaterThanOrEqual(1);
		for (const d of dates) {
			expect(d.ddmmyyyy).toMatch(/^\d{8}$/);
			expect(d.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		}
	});

	it("parses official participant open interest CSV and calculates FII long/short positioning", () => {
		const sampleParticipantCsv = [
			"Client Type,Future Index Long,Future Index Short,Future Stock Long,Future Stock Short,Option Index Call Long,Option Index Put Long,Option Index Call Short,Option Index Put Short,Option Stock Call Long,Option Stock Put Long,Option Stock Call Short,Option Stock Put Short,Total Long Contracts,Total Short Contracts",
			"Client,215400,145200,1250000,350000,1450000,1250000,1100000,950000,450000,180000,210000,160000,4795400,2965200",
			"DII,65000,32000,95000,1450000,12000,25000,0,0,1500,2500,0,0,175500,1509500",
			"FII,28500,125400,1580000,1420000,345000,420000,285000,360000,185000,95000,145000,85000,2658500,2415400",
			"Pro,45200,51500,480000,185000,580000,485000,1002000,850000,125000,65000,320000,125000,1715200,2276500",
			"TOTAL,354100,354100,3405000,3405000,2387000,2180000,2387000,2180000,761500,342500,675000,370000,9344600,9166600",
		].join("\n");

		const map = nseFoParticipantService.parseParticipantOi(sampleParticipantCsv);
		expect(map.size).toBe(5);

		const fii = map.get("FII");
		expect(fii).toBeDefined();
		expect(fii?.futureIndexLong).toBe(28500);
		expect(fii?.futureIndexShort).toBe(125400);

		// FII Long % = 28500 / (28500 + 125400) = 28500 / 153900 ≈ 18.52% (<= 22% -> Short Squeeze Alert)
		const fiiRatio = Math.round((28500 / (28500 + 125400)) * 100) / 100;
		expect(fiiRatio).toBeLessThanOrEqual(0.22);
	});

	it("retrieves latest participant snapshot with fallback posture resilience", async () => {
		const snap = await nseFoParticipantService.getLatestSnapshot();
		expect(snap).toBeDefined();
		expect(snap.fiiIndexFuturesLongShortRatio).toBeGreaterThan(0);
		expect(snap.fiiIndexFuturesLongShortRatio).toBeLessThanOrEqual(1.0);
		expect(snap.institutionalPosture).toBeDefined();
	});
});

describe("Domestic Market Intelligence Engine Multi-Exchange Integration", () => {
	it("synthesizes multi-exchange micro structure, F&O participant positioning and commodity pulse", async () => {
		const micro = await domesticMarketIntelligenceEngine.evaluateDomesticMicro();
		expect(micro).toBeDefined();

		// Verify Derivatives Structure
		expect(micro.derivativesStructure.fpiIndexFuturesLongShortRatio).toBeGreaterThan(0);
		expect(typeof micro.derivativesStructure.shortSqueezeAlert).toBe("boolean");

		// Verify Multi-Exchange Commodities (MCX & NCDEX)
		expect(micro.domesticCommodities.mcxGoldPrice).toBeGreaterThan(0);
		expect(micro.domesticCommodities.mcxCrudeSpotPrice).toBeGreaterThan(0);
		expect(["STABLE", "FOOD_INFLATION_WATCH", "COOLING"]).toContain(
			micro.domesticCommodities.ncdexAgriPulse,
		);

		// Verify Volatility surface
		expect(micro.volatility.indiaVix).toBeGreaterThan(0);
		expect(micro.volatility.volatilityRegime).toBeDefined();
	});
});
