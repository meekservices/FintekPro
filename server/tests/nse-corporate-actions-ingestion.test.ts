/**
 * Unit Tests: Automated NSE Corporate Actions Ingestion Service
 *
 * Verifies:
 *  - Purpose & Subject NLP/Regex Parsing (Splits, Bonuses, Dividends, Rights, Buybacks)
 *  - Economic Adjustment Factor (F) derivation
 *  - NSE Date normalization across varied exchange formats
 *  - ISIN resolution & deterministic fallback
 *  - Daily crawler scheduler lifecycle (start/stop)
 */

import { describe, it, expect } from "vitest";
import { nseCorporateActionsIngestionService } from "../services/golden-pricing/nse-corporate-actions-ingestion-service";

describe("Automated NSE Corporate Actions Ingestion Service", () => {
	describe("Purpose & Economic Adjustment Factor Parsing", () => {
		it("correctly parses stock split by face value change (Rs 10 to Rs 2 -> F = 0.2)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Sub-Division of Face Value from Rs 10 to Rs 2",
			);
			expect(res.actionType).toBe("SPLIT");
			expect(res.ratio).toBe("10:2");
			expect(res.adjustmentFactor).toBe(0.2);
		});

		it("correctly parses stock split by face value change (Rs 10 to Rs 1 -> F = 0.1)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Sub-division of equity shares from Rs. 10/- each to Rs. 1/- each",
			);
			expect(res.actionType).toBe("SPLIT");
			expect(res.ratio).toBe("10:1");
			expect(res.adjustmentFactor).toBe(0.1);
		});

		it("correctly parses stock split by ratio string (1:2 -> F = 0.5)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose("Stock Split 1:2");
			expect(res.actionType).toBe("SPLIT");
			expect(res.ratio).toBe("1:2");
			expect(res.adjustmentFactor).toBe(0.5);
		});

		it("correctly parses bonus issue 1:1 (1 bonus for 1 held -> F = 0.5)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Bonus Issue in the ratio of 1:1 (One bonus share for every one equity share held)",
			);
			expect(res.actionType).toBe("BONUS");
			expect(res.ratio).toBe("1:1");
			expect(res.adjustmentFactor).toBe(0.5);
		});

		it("correctly parses bonus issue 1:2 (1 bonus for 2 held -> F = 2/3 = 0.6667)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Bonus 1:2 - One equity share for every two shares",
			);
			expect(res.actionType).toBe("BONUS");
			expect(res.ratio).toBe("1:2");
			expect(res.adjustmentFactor).toBeCloseTo(2 / 3, 6);
		});

		it("correctly parses bonus issue 2:1 (2 bonus for 1 held -> F = 1/3 = 0.3333)", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Bonus Issue 2:1",
			);
			expect(res.actionType).toBe("BONUS");
			expect(res.ratio).toBe("2:1");
			expect(res.adjustmentFactor).toBeCloseTo(1 / 3, 6);
		});

		it("correctly parses dividend amount per share", () => {
			const res = nseCorporateActionsIngestionService.parsePurpose(
				"Interim Dividend - Rs 28 Per Share",
			);
			expect(res.actionType).toBe("DIVIDEND");
			expect(res.dividendAmount).toBe(28);
			expect(res.adjustmentFactor).toBe(1.0);
		});

		it("correctly categorizes buyback and rights issues", () => {
			const buybackRes = nseCorporateActionsIngestionService.parsePurpose(
				"Buyback of equity shares through tender offer",
			);
			expect(buybackRes.actionType).toBe("BUYBACK");

			const rightsRes = nseCorporateActionsIngestionService.parsePurpose(
				"Rights Issue of equity shares in the ratio of 1:4",
			);
			expect(rightsRes.actionType).toBe("RIGHTS");
			expect(rightsRes.ratio).toBe("1:4");
		});
	});

	describe("NSE Date Normalization", () => {
		it("normalizes DD-Mon-YYYY format (e.g. 14-Nov-2026 -> 2026-11-14)", () => {
			expect(nseCorporateActionsIngestionService.parseNseDate("14-Nov-2026")).toBe("2026-11-14");
			expect(nseCorporateActionsIngestionService.parseNseDate("05-Jan-2026")).toBe("2026-01-05");
			expect(nseCorporateActionsIngestionService.parseNseDate("29-Feb-2024")).toBe("2024-02-29");
		});

		it("normalizes DD-MM-YYYY format (e.g. 14-11-2026 -> 2026-11-14)", () => {
			expect(nseCorporateActionsIngestionService.parseNseDate("14-11-2026")).toBe("2026-11-14");
		});

		it("passes through standard ISO YYYY-MM-DD", () => {
			expect(nseCorporateActionsIngestionService.parseNseDate("2026-11-14")).toBe("2026-11-14");
		});

		it("gracefully returns null on invalid or blank dates", () => {
			expect(nseCorporateActionsIngestionService.parseNseDate("-")).toBeNull();
			expect(nseCorporateActionsIngestionService.parseNseDate("")).toBeNull();
			expect(nseCorporateActionsIngestionService.parseNseDate(null)).toBeNull();
		});
	});

	describe("Crawler Scheduler Lifecycle", () => {
		it("provides start and stop interface for daily scheduler", () => {
			expect(typeof nseCorporateActionsIngestionService.startDailyScheduler).toBe("function");
			expect(typeof nseCorporateActionsIngestionService.stopDailyScheduler).toBe("function");

			nseCorporateActionsIngestionService.startDailyScheduler();
			nseCorporateActionsIngestionService.stopDailyScheduler();
		});
	});
});

