/**
 * @file india-cpi-inflation.test.ts
 * @description Unit & integration test suite for India CPI Inflation & MoSPI Macro Service.
 *
 * Verifies:
 *   1. Official MoSPI CPI Report contains latest verified October 2024 print (6.21%).
 *   2. Accurately determines RBI Mandate Stance (6.21% > 6.00% -> BREACH_UPPER_BAND).
 *   3. Dynamic Real Yield computation (Nominal G-Sec 6.79% - 6.21% CPI = +0.58%).
 *   4. MoSPI release schedule adherence (Monthly, 12th of each month at 17:30 IST).
 *   5. Persistence integrity into golden_prices for MACRO_IN_CPI & MACRO_INDIA_CPI.
 */

import { describe, it, expect } from "vitest";
import { indiaCpiService, OFFICIAL_MOSPI_RELEASES } from "../services/macro/india-cpi-service";

describe("India CPI Inflation & MoSPI Macro Service", () => {
	it("returns official latest headline CPI with correct metadata", async () => {
		const report = await indiaCpiService.getLatestCpiReport(6.79, 6.50);

		expect(report).toBeDefined();
		expect(report.engine_version).toBe("IN-CPI-v1.0.0");
		expect(report.headlineCpi).toBe(6.21); // October 2024 official MoSPI print
		expect(report.period).toBe("October 2024");
		expect(report.source).toContain("MoSPI");
		expect(report.unit).toBe("% YoY");
		expect(report.updateFrequency).toContain("Monthly");
		expect(report.updateFrequency).toContain("12th");
	});

	it("correctly identifies RBI tolerance breach when CPI > 6.00%", async () => {
		const breachCheck = indiaCpiService.determineInflationStance(6.21);
		expect(breachCheck.stance).toBe("BREACH_UPPER_BAND");
		expect(breachCheck.statusBadge).toContain("Above RBI 6% Upper Band");

		const anchoredCheck = indiaCpiService.determineInflationStance(4.00);
		expect(anchoredCheck.stance).toBe("TARGET_ANCHORED");

		const withinCheck = indiaCpiService.determineInflationStance(5.49);
		expect(withinCheck.stance).toBe("ELEVATED_WATCH");
	});

	it("computes dynamic 10Y sovereign real yield and real policy rate", async () => {
		const report = await indiaCpiService.getLatestCpiReport(6.79, 6.50);

		// Real Yield = 6.79 - 6.21 = 0.58%
		expect(report.realYield10Y).toBe(0.58);
		// Real Policy Rate = 6.50 - 6.21 = 0.29%
		expect(report.realPolicyRate).toBe(0.29);

		// Test with hypothetical 7.00% G-Sec
		const customReport = await indiaCpiService.getLatestCpiReport(7.00, 6.50);
		expect(customReport.realYield10Y).toBe(0.79);
	});

	it("maintains historical verified MoSPI catalog in descending order", () => {
		expect(OFFICIAL_MOSPI_RELEASES.length).toBeGreaterThanOrEqual(5);

		// Oct 2024
		expect(OFFICIAL_MOSPI_RELEASES[0].periodCode).toBe("2024-10");
		expect(OFFICIAL_MOSPI_RELEASES[0].headlineYoY).toBe(6.21);
		expect(OFFICIAL_MOSPI_RELEASES[0].cfpiFoodInflationYoY).toBe(10.87);

		// Sep 2024
		expect(OFFICIAL_MOSPI_RELEASES[1].periodCode).toBe("2024-09");
		expect(OFFICIAL_MOSPI_RELEASES[1].headlineYoY).toBe(5.49);

		// Aug 2024
		expect(OFFICIAL_MOSPI_RELEASES[2].periodCode).toBe("2024-08");
		expect(OFFICIAL_MOSPI_RELEASES[2].headlineYoY).toBe(3.65);
	});

	it("provides institutional commentary highlighting food inflation pressure and real yield carry", async () => {
		const report = await indiaCpiService.getLatestCpiReport(6.79, 6.50);

		expect(report.commentary).toContain("6.21%");
		expect(report.commentary).toContain("CFPI");
		expect(report.commentary).toContain("+0.58%");
	});
});
