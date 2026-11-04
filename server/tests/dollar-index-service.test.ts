import { describe, it, expect } from "vitest";
import { dollarIndexService } from "../services/macro/dollar-index-service";
import { FRED_SERIES } from "../services/fred-commodity-service";

describe("US Dollar Index (DXY) Infrastructure Service", () => {
	it("calculates synthetic DXY accurately using the official ICE geometric formula", () => {
		// Standard market test rates
		const testRates = {
			eurUsd: 1.085,
			usdJpy: 153.5,
			gbpUsd: 1.295,
			usdCad: 1.392,
			usdSek: 10.65,
			usdChf: 0.885,
		};

		const { syntheticDxy, constituents, intermediateSteps } =
			dollarIndexService.calculateSyntheticDxy(testRates);

		// DXY should evaluate to ~104.2 under these inputs
		expect(syntheticDxy).toBeGreaterThan(100);
		expect(syntheticDxy).toBeLessThan(110);
		expect(intermediateSteps).toContain("50.14348112");

		// Validate all 6 constituents are present with official ICE weights
		expect(constituents.eur.weightPercent).toBe(57.6);
		expect(constituents.jpy.weightPercent).toBe(13.6);
		expect(constituents.gbp.weightPercent).toBe(11.9);
		expect(constituents.cad.weightPercent).toBe(9.1);
		expect(constituents.sek.weightPercent).toBe(4.2);
		expect(constituents.chf.weightPercent).toBe(3.6);

		// Check geometric exponents
		expect(constituents.eur.geometricExponent).toBe(-0.576);
		expect(constituents.jpy.geometricExponent).toBe(0.136);
		expect(constituents.gbp.geometricExponent).toBe(-0.119);
		expect(constituents.cad.geometricExponent).toBe(0.091);
		expect(constituents.sek.geometricExponent).toBe(0.042);
		expect(constituents.chf.geometricExponent).toBe(0.036);
	});

	it("classifies macro regimes accurately across all four threshold bands", () => {
		const weakRegime = dollarIndexService.classifyRegime(96.5);
		expect(weakRegime.band).toBe("weak");
		expect(weakRegime.bias).toBe("EM_FAVORABLE");
		expect(weakRegime.macroTransmission.usdInrPressure).toBe("LOW");

		const neutralRegime = dollarIndexService.classifyRegime(102.5);
		expect(neutralRegime.band).toBe("neutral");
		expect(neutralRegime.bias).toBe("EM_NEUTRAL");
		expect(neutralRegime.macroTransmission.usdInrPressure).toBe("MODERATE");

		const strongRegime = dollarIndexService.classifyRegime(105.2);
		expect(strongRegime.band).toBe("strong");
		expect(strongRegime.bias).toBe("EM_CAUTION");
		expect(strongRegime.macroTransmission.usdInrPressure).toBe("HIGH");

		const surgingRegime = dollarIndexService.classifyRegime(107.8);
		expect(surgingRegime.band).toBe("surging");
		expect(surgingRegime.bias).toBe("EM_HEADWIND");
		expect(surgingRegime.macroTransmission.usdInrPressure).toBe("SEVERE");
	});

	it("returns a comprehensive real-time DollarIndexSnapshot conforming to FintekPro GCR v1.0", async () => {
		const snapshot = await dollarIndexService.getDollarIndexSnapshot();

		expect(snapshot).toBeDefined();
		expect(snapshot.price).toBeGreaterThan(80);
		expect(snapshot.price).toBeLessThan(130);
		expect(snapshot.syntheticDxy).toBeGreaterThan(80);
		expect(snapshot.confidence).toBeGreaterThanOrEqual(90);

		// Constituents validation
		expect(snapshot.constituents.eur.rate).toBeGreaterThan(0.5);
		expect(snapshot.constituents.jpy.rate).toBeGreaterThan(50);
		expect(snapshot.constituents.gbp.rate).toBeGreaterThan(0.5);

		// Macro transmission validation
		expect(snapshot.macroTransmission.sectorTailwinds.length).toBeGreaterThan(0);
		expect(snapshot.macroTransmission.sectorHeadwinds.length).toBeGreaterThan(0);
		expect(snapshot.macroTransmission.rbiInterventionBias).toBeDefined();

		// Compliance meta
		expect(snapshot.meta.engine_version).toBe("dollar-index-service@1.0.0");
		expect(snapshot.meta.calculation_timestamp).toBeDefined();
		expect(snapshot.meta.formula).toContain("ICE USDX");
		expect(snapshot.meta.intermediate_steps).toBeDefined();
	});

	it("integrates official FRED Dollar Index series configuration", () => {
		expect(FRED_SERIES.DOLLAR_INDEX).toBeDefined();
		expect(FRED_SERIES.DOLLAR_INDEX.id).toBe("DTWEXBGS");
		expect(FRED_SERIES.DOLLAR_INDEX.fallback).toBe(104.25);
	});
});

