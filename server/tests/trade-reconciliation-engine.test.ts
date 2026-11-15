import { describe, it, expect } from "vitest";
import {
	TradeReconciliationEngine,
	tradeReconciliationEngine,
} from "../services/trade-reconciliation-engine";

describe("TradeReconciliationEngine (GCR v1.0 & SEBI System Audit Norms)", () => {
	it("initializes as singleton instance", () => {
		expect(tradeReconciliationEngine).toBeInstanceOf(TradeReconciliationEngine);
	});

	it("executes an on-demand reconciliation run and produces compliant structured output", async () => {
		const report = await tradeReconciliationEngine.runReconciliation("test_admin_suite");

		expect(report).toBeDefined();
		expect(report.id).toMatch(/^recon_/);
		expect(report.status).toMatch(/^(MATCHED|DISCREPANCIES_DETECTED|CRITICAL_DRIFT)$/);

		// Must include summary with match rate
		expect(report.summary).toBeDefined();
		expect(typeof report.summary.matchRatePercent).toBe("number");
		expect(report.summary.matchRatePercent).toBeGreaterThanOrEqual(0);
		expect(report.summary.matchRatePercent).toBeLessThanOrEqual(100);

		// Must include 5 core venues
		expect(report.venueBreakdown).toHaveProperty("UPSTOX_NSE");
		expect(report.venueBreakdown).toHaveProperty("ALPACA_US");
		expect(report.venueBreakdown).toHaveProperty("KFINTECH_IRIS");
		expect(report.venueBreakdown).toHaveProperty("CASHFREE_PG");
		expect(report.venueBreakdown).toHaveProperty("UNLISTED_DESK");

		// Must have SHA-256 cryptographic proof
		expect(report.checksum).toBeDefined();
		expect(report.checksum).toHaveLength(64);
		expect(report.generatedBy).toBe("test_admin_suite");
	});

	it("retrieves the latest report and historical reports", async () => {
		const latest = await tradeReconciliationEngine.getLatestReport();
		expect(latest).toBeDefined();

		const history = tradeReconciliationEngine.getReportsHistory(5);
		expect(Array.isArray(history)).toBe(true);
		expect(history.length).toBeGreaterThan(0);
	});

	it("resolves an active discrepancy with audit trail note", async () => {
		// Mock a run or get latest report
		const report = await tradeReconciliationEngine.runReconciliation("test_runner");

		if (report.discrepancies.length > 0) {
			const disc = report.discrepancies[0];
			const resolved = tradeReconciliationEngine.resolveDiscrepancy(
				disc.id,
				"compliance_officer_1",
				"Verified contract note manually against Upstox trade book",
			);

			expect(resolved).toBeDefined();
			expect(resolved?.status).toBe("resolved");
			expect(resolved?.resolvedBy).toBe("compliance_officer_1");
			expect(resolved?.resolutionNote).toContain("Verified contract note manually");
		} else {
			// If zero discrepancies on clean DB, resolution on nonexistent returns null
			const result = tradeReconciliationEngine.resolveDiscrepancy(
				"nonexistent_disc_id",
				"officer",
				"note",
			);
			expect(result).toBeNull();
		}
	});
});
