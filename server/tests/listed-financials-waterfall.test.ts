/**
 * Unit tests for listed company financials fallback waterfall:
 * Screener (primary) -> CredHive (fallback 1) -> Probe42 (fallback 2) -> Python/yfinance (fallback 3)
 */

import { describe, it, expect } from "vitest";
import {
	mapStatementsToScreenerData,
	type ScreenerData,
} from "../modules/research/dataService";
import type { CredhiveFinancialStatement } from "../services/credhive-service";

describe("Listed Company Financials - CredHive / Probe42 Mapping & Fallback", () => {
	const sampleStatements: CredhiveFinancialStatement[] = [
		{
			financial_year: "FY2023-24",
			revenue: 12500000000, // ₹1,250 Cr in raw rupees
			ebitda: 7800000000, // ₹780 Cr
			ebit: 6500000000, // ₹650 Cr
			pat: 5600000000, // ₹560 Cr
			networth: 30000000000, // ₹3,000 Cr
			total_debt: 2100000000, // ₹210 Cr
			total_assets: 35000000000,
			operating_cash_flow: 4500000000,
			free_cash_flow: 3800000000,
		},
		{
			financial_year: "FY2022-23",
			revenue: 10500000000, // ₹1,050 Cr
			ebitda: 6200000000, // ₹620 Cr
			ebit: 5100000000, // ₹510 Cr
			pat: 4200000000, // ₹420 Cr
			networth: 25000000000, // ₹2,500 Cr
			total_debt: 1800000000, // ₹180 Cr
			total_assets: 29000000000,
			operating_cash_flow: 3600000000,
			free_cash_flow: 2900000000,
		},
	];

	it("maps CredHive statements to ScreenerData with correct ₹ Crore values", () => {
		const mapped = mapStatementsToScreenerData(
			sampleStatements,
			"TATAPOWER",
			"CREDHIVE",
		);

		// Single-period summary values in Crores
		expect(mapped.revenue).toBe(1250);
		expect(mapped.netIncome).toBe(560);
		expect(mapped.operatingCashFlow).toBe(450);
		expect(mapped.freeCashFlow).toBe(380);
		expect(mapped.debtToEquity).toBeCloseTo(0.07, 2);

		// Decimal ratios for ScreenerData interface
		expect(mapped.roe).toBeCloseTo(0.1867, 3); // 560 / 3000 ≈ 18.67%
		expect(mapped.operatingMargin).toBeCloseTo(0.624, 3); // 780 / 1250 = 62.4%
	});

	it("strictly does NOT include 'Metric' in historical table headers", () => {
		const mapped = mapStatementsToScreenerData(
			sampleStatements,
			"TATAPOWER",
			"CREDHIVE",
		);

		expect(mapped.plHistory).not.toBeNull();
		expect(mapped.plHistory?.headers).toEqual(["FY2023-24", "FY2022-23"]);
		expect(mapped.plHistory?.headers).not.toContain("Metric");

		expect(mapped.bsHistory?.headers).toEqual(["FY2023-24", "FY2022-23"]);
		expect(mapped.bsHistory?.headers).not.toContain("Metric");

		expect(mapped.cfHistory?.headers).toEqual(["FY2023-24", "FY2022-23"]);
		expect(mapped.cfHistory?.headers).not.toContain("Metric");

		expect(mapped.ratiosHistory?.headers).toEqual(["FY2023-24", "FY2022-23"]);
		expect(mapped.ratiosHistory?.headers).not.toContain("Metric");
	});

	it("scales margins and ROE/ROCE rows as percentage numbers (0-100)", () => {
		const mapped = mapStatementsToScreenerData(
			sampleStatements,
			"TATAPOWER",
			"CREDHIVE",
		);

		const pl = mapped.plHistory!;
		const ebitdaMarginRow = pl.rows.find((r) => r.label === "EBITDA Margin (%)");
		expect(ebitdaMarginRow).toBeDefined();
		expect(ebitdaMarginRow?.values[0]).toBeCloseTo(62.4, 1); // 780 / 1250 * 100

		const netMarginRow = pl.rows.find((r) => r.label === "Net Margin (%)");
		expect(netMarginRow).toBeDefined();
		expect(netMarginRow?.values[0]).toBeCloseTo(44.8, 1); // 560 / 1250 * 100

		const ratios = mapped.ratiosHistory!;
		const roeRow = ratios.rows.find((r) => r.label === "ROE (%)");
		expect(roeRow).toBeDefined();
		expect(roeRow?.values[0]).toBeCloseTo(18.7, 1); // 560 / 3000 * 100

		const deRow = ratios.rows.find((r) => r.label === "D/E Ratio");
		expect(deRow).toBeDefined();
		expect(deRow?.values[0]).toBeCloseTo(0.07, 2); // 210 / 3000 = 0.07
	});

	it("calculates revenue and profit growth correctly", () => {
		const mapped = mapStatementsToScreenerData(
			sampleStatements,
			"TATAPOWER",
			"PROBE42",
		);

		// Revenue growth: (1250 - 1050) / 1050 ≈ 19.05%
		expect(mapped.revenueGrowth).toBeCloseTo(0.1905, 3);
		// Profit growth: (560 - 420) / 420 ≈ 33.33%
		expect(mapped.earningsGrowth).toBeCloseTo(0.3333, 3);
	});
});
