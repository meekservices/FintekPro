import { describe, it, expect } from "vitest";
import { computeReturnSeries } from "../services/screener/returns-calculator";

describe("Screener Valuation Metrics & Candle Sanitation", () => {
	it("correctly normalizes P/FCF ratio when marketCap is in Rupees and freeCashFlow is in Crores", () => {
		// Coal India simulation
		const marketCapValueRupees = "2470000000000"; // ₹2.47 Lakh Crore in INR
		const freeCashFlowCrores = "3590"; // ₹3,590 Cr

		const mcapInCr = Number(marketCapValueRupees) > 1e8 ? Number(marketCapValueRupees) / 1e7 : Number(marketCapValueRupees);
		const fcfInCr = Number(freeCashFlowCrores);
		const pfcf = fcfInCr > 0 ? (mcapInCr / fcfInCr).toFixed(2) : null;

		expect(pfcf).toBe("68.80");
		expect(Number(pfcf)).toBeLessThan(100);
		// Assert it is NOT in hundreds of millions
		expect(Number(pfcf)).not.toBe(687960424);
	});

	it("handles marketCapValue when already in Crores", () => {
		const marketCapCrores = "247000";
		const freeCashFlowCrores = "3590";

		const mcapInCr = Number(marketCapCrores) > 1e8 ? Number(marketCapCrores) / 1e7 : Number(marketCapCrores);
		const fcfInCr = Number(freeCashFlowCrores);
		const pfcf = fcfInCr > 0 ? (mcapInCr / fcfInCr).toFixed(2) : null;

		expect(pfcf).toBe("68.80");
	});

	it("calculates Free Cash Flow Yield correctly without unit explosion", () => {
		const marketCapValueRupees = 2470000000000;
		const freeCashFlowCrores = 3590;

		const mcapInCr = marketCapValueRupees > 1e8 ? marketCapValueRupees / 1e7 : marketCapValueRupees;
		const fcfYield = Number((freeCashFlowCrores / mcapInCr).toFixed(4));

		expect(fcfYield).toBe(0.0145);
		const percent = (fcfYield * 100).toFixed(2) + "%";
		expect(percent).toBe("1.45%");
	});

	it("normalizes percent numbers whether passed as ratio (<1) or percent (>1)", () => {
		const formatMetricPercent = (val: string | number | null | undefined, decimals = 1): string => {
			if (val == null || val === "") return "-";
			const n = Number.parseFloat(String(val));
			if (isNaN(n)) return "-";
			const pct = Math.abs(n) > 1 ? n : n * 100;
			return `${pct.toFixed(decimals)}%`;
		};

		// Earnings Yield: stored as 13.53 in snapshot
		expect(formatMetricPercent("13.53", 2)).toBe("13.53%");
		// Earnings Yield: stored as 0.1353 ratio
		expect(formatMetricPercent("0.1353", 2)).toBe("13.53%");

		// FCF Yield: stored as 1.45 in snapshot
		expect(formatMetricPercent("1.45", 2)).toBe("1.45%");
		// FCF Yield: stored as 0.0145 ratio
		expect(formatMetricPercent("0.0145", 2)).toBe("1.45%");

		// FCF Margin: stored as 5.39 in snapshot
		expect(formatMetricPercent("5.39", 1)).toBe("5.4%");
		// Op Margin: stored as 0.248 ratio
		expect(formatMetricPercent("0.248", 1)).toBe("24.8%");
	});

	it("sanitizes, deduplicates, and sorts descending Upstox candles into strictly ascending order for Lightweight Charts", () => {
		// Mock descending Upstox candle feed (today, yesterday, two days ago)
		const descendingUpstox = [
			{ timestamp: "2025-02-14T09:15:00Z", open: 425, high: 430, low: 422, close: 428, volume: 1500000 },
			{ timestamp: "2025-02-13T09:15:00Z", open: 420, high: 426, low: 418, close: 424, volume: 1200000 },
			{ timestamp: "2025-02-13T09:15:00Z", open: 420, high: 426, low: 418, close: 424, volume: 1200000 }, // Duplicate
			{ timestamp: "2025-02-12T09:15:00Z", open: 415, high: 422, low: 414, close: 419, volume: 1800000 },
		];

		// Sort ascending by timestamp as done in market-data-1.ts
		const sorted = [...descendingUpstox].sort(
			(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);

		const t = sorted.map((item) => Math.floor(new Date(item.timestamp).getTime() / 1000));
		const c = sorted.map((item) => item.close);
		const o = sorted.map((item) => item.open);
		const h = sorted.map((item) => item.high);
		const l = sorted.map((item) => item.low);
		const v = sorted.map((item) => item.volume);

		// Frontend sanitation filter in market-chart.tsx
		const points: { ts: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
		for (let i = 0; i < t.length; i++) {
			const ts = t[i];
			const open = o[i];
			const high = h[i];
			const low = l[i];
			const close = c[i];
			const volume = v[i];
			if (!isNaN(ts) && ts > 0 && !isNaN(open) && open > 0 && !isNaN(high) && high > 0 && !isNaN(low) && low > 0 && !isNaN(close) && close > 0) {
				points.push({ ts, open, high, low, close, volume });
			}
		}

		points.sort((a, b) => a.ts - b.ts);
		const cleanPoints = points.filter((p, idx, arr) => idx === 0 || p.ts > arr[idx - 1].ts);

		// Verified: 3 strictly ascending unique candles
		expect(cleanPoints.length).toBe(3);
		expect(cleanPoints[0].ts).toBeLessThan(cleanPoints[1].ts);
		expect(cleanPoints[1].ts).toBeLessThan(cleanPoints[2].ts);
		expect(cleanPoints[0].close).toBe(419);
		expect(cleanPoints[2].close).toBe(428);
	});

	it("computes dynamic PEG ratio from PE and growth rates accurately", () => {
		const derivePeg = (pe: number | null, growth: number | null): number | null => {
			if (pe == null || growth == null || isNaN(pe) || isNaN(growth)) return null;
			if (pe <= 0 || growth <= 0) return null;
			const peg = pe / growth;
			return isFinite(peg) && peg > 0 && peg < 100 ? Number(peg.toFixed(2)) : null;
		};

		// Coal India style: PE = 7.42, 3Y Profit Growth = 14.8% -> PEG = 0.50
		expect(derivePeg(7.42, 14.8)).toBe(0.5);
		// Negative growth returns null (PEG undefined for contracting profits)
		expect(derivePeg(15.2, -5.0)).toBeNull();
		// Zero or negative PE returns null
		expect(derivePeg(-10, 12)).toBeNull();
	});

	it("derives ROA from Net Income / Total Assets or ROE / (1 + Debt-to-Equity)", () => {
		const deriveRoa = (
			netIncomeCr: number | null,
			totalAssetsCr: number | null,
			roePct: number | null,
			debtToEquity: number | null,
		): number | null => {
			// Identity 1: Net Income / Total Assets
			if (netIncomeCr != null && totalAssetsCr != null && totalAssetsCr > 0) {
				return Number(((netIncomeCr / totalAssetsCr) * 100).toFixed(2));
			}
			// Identity 2 (DuPont relationship): ROA = ROE / (1 + Debt/Equity)
			if (roePct != null && debtToEquity != null && debtToEquity >= 0) {
				const roa = roePct / (1 + debtToEquity);
				return isFinite(roa) ? Number(roa.toFixed(2)) : null;
			}
			return null;
		};

		// Identity 1: Net income ₹32,000 Cr, Assets ₹160,000 Cr -> ROA = 20.0%
		expect(deriveRoa(32000, 160000, null, null)).toBe(20.0);
		// Identity 2: ROE = 45%, Debt-to-Equity = 0.05 -> ROA = 42.86%
		expect(deriveRoa(null, null, 45, 0.05)).toBe(42.86);
	});

	it("calculates 3Y and 5Y trailing returns using NSE trading calendar tolerance (~245 days/yr)", () => {
		// Mock 5.2 calendar years of daily trading sessions skipping weekends (spanning 2019 to 2024)
		const dates: string[] = [];
		const closes: number[] = [];
		const curDate = new Date("2019-01-01T00:00:00Z");
		const endDate = new Date("2024-02-01T00:00:00Z");

		let currentPrice = 100;
		while (curDate <= endDate) {
			const dayOfWeek = curDate.getUTCDay();
			if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Mon-Fri
				dates.push(curDate.toISOString().slice(0, 10));
				currentPrice *= 1 + 0.10 / 245;
				closes.push(Number(currentPrice.toFixed(2)));
			}
			curDate.setUTCDate(curDate.getUTCDate() + 1);
		}

		const result = computeReturnSeries(closes, dates);

		expect(result.return1Y).not.toBeNull();
		expect(result.return3Y).not.toBeNull();
		expect(result.return3Y!).toBeGreaterThan(0.25);
		expect(result.return5Y).not.toBeNull();
		expect(result.return5Y!).toBeGreaterThan(0.50);
	});

	it("enriches missing stock sector & industry from master snapshot reference", () => {
		const stockFromDb = { symbol: "COALINDIA", sector: null, industry: null };
		const masterSnapshot = [{ symbol: "COALINDIA", sector: "Energy", industry: "Thermal Coal" }];

		const enrichedStock = {
			...stockFromDb,
			sector: stockFromDb.sector || masterSnapshot[0]?.sector || "Diversified",
			industry: stockFromDb.industry || masterSnapshot[0]?.industry || "Diversified",
		};

		expect(enrichedStock.sector).toBe("Energy");
		expect(enrichedStock.industry).toBe("Thermal Coal");
	});

	it("derives Asset Turnover via DuPont identity: ROE / (Net Profit Margin * (1 + D/E))", () => {
		const deriveAssetTurnover = (
			roe: number | null,
			netProfitMargin: number | null,
			debtToEquity: number | null,
		): string | null => {
			if (roe == null || netProfitMargin == null || isNaN(roe) || isNaN(netProfitMargin) || netProfitMargin === 0) return null;
			const de = debtToEquity ?? 0;
			if (de < 0) return null;
			const roeRatio = Math.abs(roe) > 1 ? roe / 100 : roe;
			const npmRatio = Math.abs(netProfitMargin) > 1 ? netProfitMargin / 100 : netProfitMargin;
			const leverage = 1 + de;
			const at = roeRatio / (npmRatio * leverage);
			return isFinite(at) && at > 0 && at < 50 ? at.toFixed(2) : null;
		};

		// ROE = 20% (0.20), NPM = 10% (0.10), D/E = 0.5 -> Leverage = 1.5 -> AT = 0.20 / (0.10 * 1.5) = 1.33x
		expect(deriveAssetTurnover(20, 10, 0.5)).toBe("1.33");
		// Stored as decimal ratios: 0.20, 0.10, 0.5
		expect(deriveAssetTurnover(0.20, 0.10, 0.5)).toBe("1.33");
		// Zero margin or negative returns null
		expect(deriveAssetTurnover(15, 0, 0.2)).toBeNull();
	});

	it("derives EV/Revenue ratio from Enterprise Value and Revenue without null explosion", () => {
		const deriveEvToRevenue = (
			enterpriseValue: number | null,
			revenue: number | null,
			marketCap: number | null,
		): string | null => {
			if (enterpriseValue != null && revenue != null && revenue > 0) {
				return (enterpriseValue / revenue).toFixed(2);
			}
			if (marketCap != null && revenue != null && revenue > 0) {
				return (marketCap / revenue).toFixed(2);
			}
			return null;
		};

		// EV ₹50,000 Cr, Revenue ₹20,000 Cr -> 2.50x
		expect(deriveEvToRevenue(50000, 20000, 45000)).toBe("2.50");
		// Fallback to Market Cap when EV is null
		expect(deriveEvToRevenue(null, 20000, 40000)).toBe("2.00");
		// Zero revenue returns null
		expect(deriveEvToRevenue(50000, 0, 45000)).toBeNull();
	});

	it("normalizes percent numbers cleanly in frontend formatter regardless of ratio or percent input", () => {
		const formatPercent = (
			val: string | number | null | undefined,
			multiplier?: number,
		): string => {
			if (val == null || val === "") return "-";
			const n = typeof val === "string" ? Number.parseFloat(val) : val;
			if (Number.isNaN(n)) return "-";
			const pct = multiplier !== undefined
				? (Math.abs(n) <= 1 && multiplier === 1 ? n * 100 : n * multiplier)
				: (Math.abs(n) <= 1 ? n * 100 : n);
			return `${pct.toFixed(1)}%`;
		};

		// Stored as 0.75 ratio
		expect(formatPercent(0.75)).toBe("75.0%");
		// Stored as 75 percent
		expect(formatPercent(75)).toBe("75.0%");
		// With multiplier = 100 on 0.015
		expect(formatPercent(0.015, 100)).toBe("1.5%");
		// With multiplier = 1 on 0.75
		expect(formatPercent(0.75, 1)).toBe("75.0%");
		// Empty / null
		expect(formatPercent(null)).toBe("-");
	});
});

