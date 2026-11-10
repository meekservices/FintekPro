import { describe, it, expect } from "vitest";
import { marketHolidayService } from "../services/market-holiday-service";

describe("Market Holiday Service - Special Sessions & Weekend Precedence", () => {
	it("correctly recognizes special sessions (Muhurat Trading) on partial holidays even if on a weekend", () => {
		// 2026-11-08 is Diwali Laxmi Pujan (Sunday) with Muhurat Trading 18:15 to 19:15
		expect(marketHolidayService.hasSpecialSession("2026-11-08", "NSE")).toBe(true);
		expect(marketHolidayService.isMarketSessionDay("2026-11-08", "NSE")).toBe(true);

		const special = marketHolidayService.getSpecialSession("2026-11-08", "NSE");
		expect(special).toBeDefined();
		expect(special?.name).toBe("Muhurat Trading");
		expect(special?.startTime).toBe("18:15");
		expect(special?.endTime).toBe("19:15");
	});

	it("prioritizes partial holiday special session metadata over default weekend closure in getMarketStatus", () => {
		// Mock date during Muhurat Trading session: 2026-11-08 18:30 IST
		const status = marketHolidayService.getMarketStatus("NSE", "2026-11-08T13:00:00Z"); // 18:30 IST
		expect(status.isHoliday).toBe(true);
		expect(status.holidayName).toBe("Diwali (Laxmi Pujan)");
		expect(status.specialSession).toBeDefined();
		expect(status.specialSession?.name).toBe("Muhurat Trading");
		expect(status.tradingHours?.open).toBe("18:15");
		expect(status.tradingHours?.close).toBe("19:15");
		expect(status.reason).toContain("Muhurat Trading");
	});

	it("correctly identifies 2026-11-10 as Diwali Balipratipada full trading holiday (NSE & BSE closed)", () => {
		const holiday = marketHolidayService.getHoliday("2026-11-10", "NSE");
		expect(holiday).toBeDefined();
		expect(holiday?.name).toBe("Diwali Balipratipada");
		expect(holiday?.type).toBe("full");

		expect(marketHolidayService.isTradingDay("2026-11-10", "NSE")).toBe(false);
		expect(marketHolidayService.isTradingDay("2026-11-10", "BSE")).toBe(false);
		expect(marketHolidayService.hasSpecialSession("2026-11-10", "NSE")).toBe(false);
		expect(marketHolidayService.isMarketSessionDay("2026-11-10", "NSE")).toBe(false);

		const status = marketHolidayService.getMarketStatus("NSE", "2026-11-10T04:30:00Z"); // 10:00 AM IST
		expect(status.isOpen).toBe(false);
		expect(status.isHoliday).toBe(true);
		expect(status.holidayName).toBe("Diwali Balipratipada");
		expect(status.reason).toBe("Holiday - Diwali Balipratipada");
	});

	it("enforces all official NSE 2026 trading holidays per Circular Ref 172/2025", () => {
		const officialHolidays2026 = [
			{ date: "2026-01-26", name: "Republic Day" },
			{ date: "2026-03-03", name: "Holi" },
			{ date: "2026-03-26", name: "Shri Ram Navami" },
			{ date: "2026-03-31", name: "Shri Mahavir Jayanti" },
			{ date: "2026-04-03", name: "Good Friday" },
			{ date: "2026-04-14", name: "Dr. Baba Saheb Ambedkar Jayanti" },
			{ date: "2026-05-01", name: "Maharashtra Day" },
			{ date: "2026-05-28", name: "Bakri Id" },
			{ date: "2026-06-26", name: "Muharram" },
			{ date: "2026-09-14", name: "Ganesh Chaturthi" },
			{ date: "2026-10-02", name: "Mahatma Gandhi Jayanti" },
			{ date: "2026-10-20", name: "Dussehra" },
			{ date: "2026-11-10", name: "Diwali Balipratipada" },
			{ date: "2026-11-24", name: "Prakash Gurpurb Sri Guru Nanak Dev" },
			{ date: "2026-12-25", name: "Christmas" },
		];

		for (const h of officialHolidays2026) {
			const hol = marketHolidayService.getHoliday(h.date, "NSE");
			expect(hol, `Holiday for ${h.date} should exist`).toBeDefined();
			expect(hol?.type).toBe("full");
			expect(marketHolidayService.isTradingDay(h.date, "NSE")).toBe(false);
		}
	});

	it("correctly marks normal non-holiday weekends as closed", () => {
		// 2026-11-15 is a regular Sunday without any holiday or special session
		expect(marketHolidayService.isWeekendDay("2026-11-15")).toBe(true);
		expect(marketHolidayService.isTradingDay("2026-11-15", "NSE")).toBe(false);
		expect(marketHolidayService.hasSpecialSession("2026-11-15", "NSE")).toBe(false);
		expect(marketHolidayService.isMarketSessionDay("2026-11-15", "NSE")).toBe(false);
	});

	it("correctly marks full holidays as non-trading days without special sessions", () => {
		// 2026-01-26 is Republic Day (full holiday)
		const holiday = marketHolidayService.getHoliday("2026-01-26", "NSE");
		expect(holiday).toBeDefined();
		expect(holiday?.type).toBe("full");
		expect(marketHolidayService.isTradingDay("2026-01-26", "NSE")).toBe(false);
		expect(marketHolidayService.hasSpecialSession("2026-01-26", "NSE")).toBe(false);
	});
});

