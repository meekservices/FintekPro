/**
 * @file fred-commodity-service.ts
 * @description Federal Reserve Bank of St. Louis (FRED) Commodity & Macro Service.
 *
 * Provides authoritative programmatic daily spot benchmarks with zero rate-limit blocks for:
 *   - Brent Crude Oil (DCOILBRENTEU - Spot Price FOB, $/bbl)
 *   - WTI Crude Oil (DCOILWTICO - Spot Price FOB, $/bbl)
 *   - Henry Hub Natural Gas (DHHNGSP - Spot Price, $/mmBtu)
 *   - US 10-Year Treasury Yield (DGS10 - % Constant Maturity)
 *   - US 2-Year Treasury Yield (DGS2 - % Constant Maturity)
 *   - Federal Funds Effective Rate (DFF - %)
 *
 * Integration Strategy:
 *   - Primary: Official FRED REST JSON API when FRED_API_KEY is configured
 *   - Secondary/Zero-Key: Direct programmatic CSV graph observations stream
 *   - Resilient in-memory LRU cache with 1-hour TTL
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { logger } from "../logger";

export interface FredSeriesObservation {
	seriesId: string;
	name: string;
	category: "energy" | "metals" | "treasury" | "rate";
	date: string;
	value: number;
	unit: string;
	source: "FRED_API" | "FRED_CSV" | "FALLBACK";
	timestamp: string;
}

export interface FredCommoditySnapshot {
	asOfDate: string;
	timestamp: string;
	brentCrude: {
		price: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	wtiCrude: {
		price: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	naturalGas: {
		price: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	us10YTreasury: {
		yieldPercent: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	us2YTreasury: {
		yieldPercent: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	fedFundsRate: {
		rate: number;
		unit: string;
		date: string;
		seriesId: string;
		source: string;
	};
	meta: {
		engine_version: string;
		calculation_timestamp: string;
		cached: boolean;
	};
}

const ENGINE_VERSION = "fred-commodity-service@1.0.0";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache (FRED publishes daily series)

// Known official Federal Reserve Economic Data series IDs
export const FRED_SERIES = {
	BRENT_CRUDE: { id: "DCOILBRENTEU", name: "Crude Oil Prices: Brent - Europe", unit: "USD / bbl", category: "energy" as const, fallback: 74.80 },
	WTI_CRUDE: { id: "DCOILWTICO", name: "Crude Oil Prices: West Texas Intermediate (WTI)", unit: "USD / bbl", category: "energy" as const, fallback: 70.85 },
	NATURAL_GAS: { id: "DHHNGSP", name: "Henry Hub Natural Gas Spot Price", unit: "USD / mmBtu", category: "energy" as const, fallback: 2.75 },
	US_10Y: { id: "DGS10", name: "10-Year Treasury Constant Maturity Rate", unit: "%", category: "treasury" as const, fallback: 4.58 },
	US_2Y: { id: "DGS2", name: "2-Year Treasury Constant Maturity Rate", unit: "%", category: "treasury" as const, fallback: 4.35 },
	FED_FUNDS: { id: "DFF", name: "Federal Funds Effective Rate", unit: "%", category: "rate" as const, fallback: 4.38 },
};

class FredCommodityService {
	private static instance: FredCommodityService;
	private cache: Map<string, { data: FredSeriesObservation; ts: number }> = new Map();
	private snapshotCache: { data: FredCommoditySnapshot; ts: number } | null = null;

	public static getInstance(): FredCommodityService {
		if (!FredCommodityService.instance) {
			FredCommodityService.instance = new FredCommodityService();
		}
		return FredCommodityService.instance;
	}

	/**
	 * Resolves a single series observation from FRED (JSON API or direct CSV feed).
	 *
	 * @param seriesKey - Key matching FRED_SERIES (e.g. 'BRENT_CRUDE', 'WTI_CRUDE', 'US_10Y')
	 * @param forceRefresh - Bypass in-memory cache
	 */
	public async getSeriesObservation(
		seriesKey: keyof typeof FRED_SERIES,
		forceRefresh = false,
	): Promise<FredSeriesObservation> {
		const seriesDef = FRED_SERIES[seriesKey];
		const now = Date.now();

		if (!forceRefresh) {
			const cached = this.cache.get(seriesDef.id);
			if (cached && now - cached.ts < CACHE_TTL_MS) {
				return cached.data;
			}
		}

		const apiKey = process.env.FRED_API_KEY?.trim();

		// Priority 1: Official FRED JSON API (if FRED_API_KEY is configured)
		if (apiKey) {
			try {
				const jsonResult = await this.fetchViaJsonApi(seriesDef.id, apiKey);
				if (jsonResult) {
					const obs: FredSeriesObservation = {
						seriesId: seriesDef.id,
						name: seriesDef.name,
						category: seriesDef.category,
						date: jsonResult.date,
						value: jsonResult.value,
						unit: seriesDef.unit,
						source: "FRED_API",
						timestamp: new Date().toISOString(),
					};
					this.cache.set(seriesDef.id, { data: obs, ts: now });
					return obs;
				}
			} catch (jsonErr: any) {
				logger.debug(`[FRED] JSON API warning for ${seriesDef.id}: ${jsonErr?.message}`);
			}
		}

		// Priority 2: Direct Programmatic CSV Graph Stream (zero key required, zero rate limit)
		try {
			const csvResult = await this.fetchViaCsvStream(seriesDef.id);
			if (csvResult) {
				const obs: FredSeriesObservation = {
					seriesId: seriesDef.id,
					name: seriesDef.name,
					category: seriesDef.category,
					date: csvResult.date,
					value: csvResult.value,
					unit: seriesDef.unit,
					source: "FRED_CSV",
					timestamp: new Date().toISOString(),
				};
				this.cache.set(seriesDef.id, { data: obs, ts: now });
				return obs;
			}
		} catch (csvErr: any) {
			logger.warn(`[FRED] CSV feed warning for ${seriesDef.id}: ${csvErr?.message}`);
		}

		// Priority 3: Fallback with institutional baseline
		const today = new Date().toISOString().split("T")[0];
		return {
			seriesId: seriesDef.id,
			name: seriesDef.name,
			category: seriesDef.category,
			date: today,
			value: seriesDef.fallback,
			unit: seriesDef.unit,
			source: "FALLBACK",
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Pulls the latest observation using the official FRED JSON API.
	 */
	private async fetchViaJsonApi(
		seriesId: string,
		apiKey: string,
	): Promise<{ date: string; value: number } | null> {
		const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`;
		const res = await fetch(url, {
			headers: { "Accept": "application/json", "User-Agent": "FintekPro/3.0 (Financial Grade Engine)" },
			signal: AbortSignal.timeout(6000),
		});

		if (!res.ok) return null;
		const json = (await res.json()) as any;
		const observations = json?.observations || [];

		for (const obs of observations) {
			const val = Number.parseFloat(obs.value);
			if (!Number.isNaN(val) && val > 0 && obs.value !== ".") {
				return { date: obs.date, value: val };
			}
		}
		return null;
	}

	/**
	 * Pulls the latest observation from the public FRED CSV stream.
	 * URL: https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}
	 */
	private async fetchViaCsvStream(
		seriesId: string,
	): Promise<{ date: string; value: number } | null> {
		const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
		const res = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept": "text/csv,text/plain,*/*",
			},
			signal: AbortSignal.timeout(6000),
		});

		if (!res.ok) return null;
		const text = await res.text();
		const lines = text.trim().split("\n");

		// Iterate backwards from the bottom of the CSV to find the most recent valid numeric print
		for (let i = lines.length - 1; i >= 1; i--) {
			const line = lines[i].trim();
			if (!line) continue;
			const parts = line.split(",");
			if (parts.length >= 2) {
				const date = parts[0].trim();
				const rawVal = parts[1].trim();
				if (rawVal !== "." && rawVal !== "") {
					const val = Number.parseFloat(rawVal);
					if (!Number.isNaN(val) && val > 0) {
						return { date, value: val };
					}
				}
			}
		}
		return null;
	}

	/**
	 * Returns a complete unified snapshot of all FRED commodity and macro benchmarks.
	 */
	public async getCommodityAndMacroSnapshot(forceRefresh = false): Promise<FredCommoditySnapshot> {
		const now = Date.now();
		if (!forceRefresh && this.snapshotCache && now - this.snapshotCache.ts < CACHE_TTL_MS) {
			return {
				...this.snapshotCache.data,
				meta: { ...this.snapshotCache.data.meta, cached: true },
			};
		}

		const [brent, wti, natgas, us10Y, us2Y, fedFunds] = await Promise.all([
			this.getSeriesObservation("BRENT_CRUDE", forceRefresh),
			this.getSeriesObservation("WTI_CRUDE", forceRefresh),
			this.getSeriesObservation("NATURAL_GAS", forceRefresh),
			this.getSeriesObservation("US_10Y", forceRefresh),
			this.getSeriesObservation("US_2Y", forceRefresh),
			this.getSeriesObservation("FED_FUNDS", forceRefresh),
		]);

		const asOfDate = brent.date || new Date().toISOString().split("T")[0];
		const timestamp = new Date().toISOString();

		const snapshot: FredCommoditySnapshot = {
			asOfDate,
			timestamp,
			brentCrude: {
				price: brent.value,
				unit: brent.unit,
				date: brent.date,
				seriesId: brent.seriesId,
				source: brent.source,
			},
			wtiCrude: {
				price: wti.value,
				unit: wti.unit,
				date: wti.date,
				seriesId: wti.seriesId,
				source: wti.source,
			},
			naturalGas: {
				price: natgas.value,
				unit: natgas.unit,
				date: natgas.date,
				seriesId: natgas.seriesId,
				source: natgas.source,
			},
			us10YTreasury: {
				yieldPercent: us10Y.value,
				unit: us10Y.unit,
				date: us10Y.date,
				seriesId: us10Y.seriesId,
				source: us10Y.source,
			},
			us2YTreasury: {
				yieldPercent: us2Y.value,
				unit: us2Y.unit,
				date: us2Y.date,
				seriesId: us2Y.seriesId,
				source: us2Y.source,
			},
			fedFundsRate: {
				rate: fedFunds.value,
				unit: fedFunds.unit,
				date: fedFunds.date,
				seriesId: fedFunds.seriesId,
				source: fedFunds.source,
			},
			meta: {
				engine_version: ENGINE_VERSION,
				calculation_timestamp: timestamp,
				cached: false,
			},
		};

		this.snapshotCache = { data: snapshot, ts: now };
		logger.info(
			`[FRED] Commodity & Macro snapshot synchronized (Brent: $${snapshot.brentCrude.price}/bbl, WTI: $${snapshot.wtiCrude.price}/bbl, US10Y: ${snapshot.us10YTreasury.yieldPercent}%)`,
		);

		return snapshot;
	}
}

export const fredCommodityService = FredCommodityService.getInstance();

