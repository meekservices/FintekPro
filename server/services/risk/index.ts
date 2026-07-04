export type MarketRegimeState = "bull" | "bear" | "neutral" | "volatile";

// ── Fix I: Rolling realized-volatility cache for dynamic Black Swan threshold ──
// We compute the 30-day realized vol of Nifty from daily returns.
// Data source: Yahoo Finance ^NSEI daily OHLCV (free, no API key).
// Threshold: Black Swan fires when realized vol > 3× its own 90-day average
// (meaning today is EXTREMELY high vol relative to recent history).
// Falls back to static simulation flag if fetch fails.
let _niftyRealizedVolCache: {
	vol30d: number | null;
	vol90dAvg: number | null;
	ts: number;
} = { vol30d: null, vol90dAvg: null, ts: 0 };
const NIFTY_VOL_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // refresh every 4 hours

async function refreshNiftyRealizedVol(): Promise<void> {
	try {
		// Fetch 120 days of Nifty daily close to compute 30d and 90d-avg realized vol
		const url =
			"https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=6mo&interval=1d";
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return;
		const json = await res.json() as any;
		const closes: number[] =
			json?.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose ?? [];
		if (closes.length < 35) return;

		// Compute daily log-returns
		const returns: number[] = [];
		for (let i = 1; i < closes.length; i++) {
			if (closes[i] > 0 && closes[i - 1] > 0) {
				returns.push(Math.log(closes[i] / closes[i - 1]));
			}
		}
		if (returns.length < 30) return;

		// 30-day realized volatility (annualised %)
		const last30 = returns.slice(-30);
		const mean30 = last30.reduce((s, r) => s + r, 0) / last30.length;
		const variance30 = last30.reduce((s, r) => s + Math.pow(r - mean30, 2), 0) / last30.length;
		const vol30d = Math.sqrt(variance30 * 252) * 100; // annualised %

		// 90-day rolling average of 30d realized vol (rolling window proxy)
		const allVols: number[] = [];
		for (let end = 30; end <= returns.length; end++) {
			const chunk = returns.slice(end - 30, end);
			const m = chunk.reduce((s, r) => s + r, 0) / chunk.length;
			const v = chunk.reduce((s, r) => s + Math.pow(r - m, 2), 0) / chunk.length;
			allVols.push(Math.sqrt(v * 252) * 100);
		}
		const vol90dAvg = allVols.reduce((s, v) => s + v, 0) / allVols.length;

		_niftyRealizedVolCache = { vol30d, vol90dAvg, ts: Date.now() };
	} catch {
		// Non-fatal — retain stale values
	}
}

export class MarketRegimeDetector {
	private internalBlackSwanFlag = false; // Simulation toggle for Phase 1 Testing

	/**
	 * Fix I: Dynamic Black Swan detection using rolling Nifty 30-day realized vol.
	 * Triggers when:
	 *   (a) Manual simulation flag is set, OR
	 *   (b) 30d realized vol > 3× its own 90-day average (extreme volatility regime)
	 *       AND 30d vol > 45% annualised (absolute floor — avoids false triggers).
	 *
	 * Falls back to static flag if market data is unavailable.
	 */
	public detectBlackSwanEvent(): boolean {
		if (this.internalBlackSwanFlag) return true;

		// Refresh in background if stale (non-blocking)
		if (Date.now() - _niftyRealizedVolCache.ts > NIFTY_VOL_CACHE_TTL_MS) {
			void refreshNiftyRealizedVol();
		}

		const { vol30d, vol90dAvg } = _niftyRealizedVolCache;
		if (vol30d !== null && vol90dAvg !== null && vol90dAvg > 0) {
			const volRatio = vol30d / vol90dAvg;
			const isExtreme = volRatio > 3.0 && vol30d > 45;
			if (isExtreme) {
				import("../../logger").then(({ logger }) => logger.warn(
					`[MarketRegime] Dynamic Black Swan: 30d vol=${vol30d.toFixed(1)}%, ` +
					`90d-avg=${vol90dAvg.toFixed(1)}%, ratio=${volRatio.toFixed(2)}x — ` +
					`EXTREME VOLATILITY REGIME DETECTED`,
				)).catch(() => {});
			}
			return isExtreme;
		}

		// Data unavailable — conservative default: no false Black Swan
		return false;
	}

	/**
	 * Manual override for system testing Black Swan Resilience
	 */
	public setBlackSwanSimulation(active: boolean): void {
		this.internalBlackSwanFlag = active;
		if (active)
			import("../../logger").then(({ logger }) => logger.warn(
				"\n[SYSTEM ALERT]: 10σ Black Swan Trigger ENGAGED. Global Safety Protocols Actuated.\n",
			)).catch(() => {});
	}

	/**
	 * Fix I: Returns current volatility metrics for dashboards/logging.
	 */
	public getVolatilityMetrics(): {
		vol30d: number | null;
		vol90dAvg: number | null;
		volRatio: number | null;
		isSimulationActive: boolean;
	} {
		const { vol30d, vol90dAvg } = _niftyRealizedVolCache;
		return {
			vol30d: vol30d !== null ? Math.round(vol30d * 100) / 100 : null,
			vol90dAvg: vol90dAvg !== null ? Math.round(vol90dAvg * 100) / 100 : null,
			volRatio: vol30d !== null && vol90dAvg !== null && vol90dAvg > 0
				? Math.round((vol30d / vol90dAvg) * 100) / 100
				: null,
			isSimulationActive: this.internalBlackSwanFlag,
		};
	}

	/**
	 * Simulated Market Environment tracker abstracting Alpaca/Polygon market variance loops.
	 * Modifies tactical allocation guidelines dynamically mapped from input flags.
	 */
	public getMarketRegimeConstraints(regimeFlag: MarketRegimeState): {
		targetEquityShift: number;
		targetDebtShift: number;
	} {
		switch (regimeFlag) {
			case "bull":
				// Lower risk parity bounds, push equity ceiling
				return { targetEquityShift: 1.2, targetDebtShift: 0.8 };
			case "bear":
				// Violently slash equity caps, mandate heavy debt/cash rotation
				return { targetEquityShift: 0.6, targetDebtShift: 1.5 };
			case "volatile":
				// Flatten into highly defensive structural balancing
				return { targetEquityShift: 0.8, targetDebtShift: 1.2 };
			default:
				return { targetEquityShift: 1.0, targetDebtShift: 1.0 };
		}
	}

	/** Legacy stub — use getVolatilityMetrics() for structured data */
	public getMarketRegimeDetails(): { volatilityLevel: string } | null {
		const { vol30d } = _niftyRealizedVolCache;
		if (vol30d === null) return null;
		return {
			volatilityLevel: vol30d > 45 ? "Extreme" : vol30d > 30 ? "High" : vol30d > 20 ? "Medium" : "Low",
		};
	}
}

export const marketRegimeDetector = new MarketRegimeDetector();
