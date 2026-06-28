/**
 * Indian Bond & Fixed Income Benchmark Service
 *
 * Provides yield curves, policy rates, and G-Sec benchmarks for pricing
 * Indian fixed-income instruments (G-Sec, T-Bills, SDL, Corporate Bonds, SGB).
 *
 * Data Sources (all confirmed reachable from Cloud Run / GCP datacenter):
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Source              │ Data                    │ Status           │
 * ├─────────────────────┼─────────────────────────┼──────────────────│
 * │ FMP treasury-rates  │ Full term yield curve   │ ✅ HTTP 200      │
 * │ AlphaVantage        │ 10Y daily yield (16K+)  │ ✅ HTTP 200      │
 * │ RBI website scrape  │ Repo/CRR policy rates   │ ✅ HTTP 200      │
 * │ FBIL (fbil.org.in)  │ MIBOR, T-Bill rates     │ ❌ GCP IP block  │
 * │ CCIL (ccilindia.com)│ NDS-OM G-Sec yields     │ ❌ GCP IP block  │
 * │ NSE Debt segment    │ Listed G-Sec prices     │ ❌ Session cookie │
 * └─────────────────────┴─────────────────────────┴──────────────────┘
 *
 * Usage:
 *   const rates = await indianBondService.getYieldCurve();
 *   const policy = await indianBondService.getRBIPolicyRates();
 *   const ytm = await indianBondService.getIndiaYTM(tenorYears);
 *
 * @module indian-bond-service
 */

import fetch from "node-fetch";
import { logger } from "../logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YieldCurvePoint {
	tenor: string; // e.g. "1m", "3m", "6m", "1y", "2y", "5y", "10y", "30y"
	tenorYears: number; // numeric years
	yield: number; // annualized yield in % (e.g. 6.85 = 6.85%)
	source: string;
	asOf: string; // ISO date
}

export interface YieldCurve {
	points: YieldCurvePoint[];
	asOf: string;
	source: string;
	indiaRepoRate?: number; // RBI repo rate (risk-free floor for India)
	indiaCRR?: number; // CRR %
}

export interface RBIPolicyRates {
	repoRate: number; // % e.g. 6.5
	reversRepoRate: number; // %
	crr: number; // %
	slr: number; // %
	msfRate: number; // Marginal Standing Facility %
	bankRate: number; // %
	asOf: string; // ISO date
	source: "rbi_scrape" | "fallback_hardcoded";
}

export interface BondYTMResult {
	tenorYears: number;
	ytm: number; // yield to maturity %
	source: string;
	asOf: string;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1_000; // 6 hours — bond data changes infrequently

const cache: {
	yieldCurve?: { data: YieldCurve; ts: number };
	policyRates?: { data: RBIPolicyRates; ts: number };
} = {};

// ─── Hardcoded fallback rates (RBI June 2026 actuals) ─────────────────────────
// Updated manually when RBI changes rates. Acts as last-resort fallback.
const RBI_FALLBACK_RATES: RBIPolicyRates = {
	repoRate: 6.25,
	reversRepoRate: 3.35,
	crr: 4.0,
	slr: 18.0,
	msfRate: 6.5,
	bankRate: 6.5,
	asOf: "2026-06-07", // last RBI MPC meeting
	source: "fallback_hardcoded",
};

// India sovereign spread over US 10Y (approximate, updated periodically)
// India 10Y G-Sec typically trades 200-250bps above US 10Y
const INDIA_SOVEREIGN_SPREAD_BPS = 230;

// ─── Source Adapters ──────────────────────────────────────────────────────────

/**
 * FMP /stable/treasury-rates — US Treasury full term yield curve.
 * Used to calibrate the DCF model. India G-Sec yields = US yield + sovereign spread.
 * Returns most recent business day data (updated daily by FMP).
 *
 * Response: [{ date, month1, month2, month3, month6, year1, year2, year3, year5, year7, year10, year20, year30 }]
 */
async function fetchFMPYieldCurve(): Promise<YieldCurve | null> {
	const apiKey = process.env.FMP_API_KEY ?? process.env.FINANCIAL_MODELING_PREP_API_KEY;
	if (!apiKey) return null;

	try {
		const resp = await fetch(
			`https://financialmodelingprep.com/stable/treasury-rates?apikey=${apiKey}`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		if (!resp.ok) return null;

		const data = (await resp.json()) as any[];
		if (!Array.isArray(data) || !data[0]) return null;

		const latest = data[0];
		const asOf = latest.date as string;

		const TENOR_MAP: Record<string, number> = {
			month1: 1 / 12,
			month2: 2 / 12,
			month3: 3 / 12,
			month6: 0.5,
			year1: 1,
			year2: 2,
			year3: 3,
			year5: 5,
			year7: 7,
			year10: 10,
			year20: 20,
			year30: 30,
		};

		const TENOR_LABELS: Record<string, string> = {
			month1: "1m", month2: "2m", month3: "3m", month6: "6m",
			year1: "1y", year2: "2y", year3: "3y", year5: "5y",
			year7: "7y", year10: "10y", year20: "20y", year30: "30y",
		};

		const points: YieldCurvePoint[] = Object.entries(TENOR_MAP)
			.filter(([key]) => latest[key] !== undefined && latest[key] !== null)
			.map(([key, tenorYears]) => ({
				tenor: TENOR_LABELS[key],
				tenorYears,
				// Add India sovereign spread to convert US yield → India G-Sec proxy
				yield: Number.parseFloat(
					(Number(latest[key]) + INDIA_SOVEREIGN_SPREAD_BPS / 100).toFixed(3),
				),
				source: "FMP_TREASURY+INDIA_SPREAD",
				asOf,
			}));

		return { points, asOf, source: "FMP_TREASURY+INDIA_SPREAD" };
	} catch (err: any) {
		logger.warn(`[IndianBondService] FMP yield curve fetch failed: ${err?.message}`);
		return null;
	}
}

/**
 * AlphaVantage TREASURY_YIELD — US 10Y daily yield series (16,823 records).
 * Used to derive India 10Y G-Sec yield proxy = US10Y + sovereign spread.
 * Falls back to FMP if AV is rate-limited.
 */
async function fetchAVYield10Y(): Promise<number | null> {
	const apiKey = process.env.ALPHA_VANTAGE_API_KEY ?? process.env.ALPHAVANTAGE_API_KEY;
	if (!apiKey) return null;

	try {
		const resp = await fetch(
			`https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`,
			{ signal: AbortSignal.timeout(10_000) },
		);
		if (!resp.ok) return null;

		const data = (await resp.json()) as any;
		const latest = data?.data?.[0];
		if (!latest?.value || latest.value === ".") return null;

		// Convert US 10Y → India G-Sec proxy by adding sovereign spread
		const indiaYield = Number.parseFloat(latest.value) + INDIA_SOVEREIGN_SPREAD_BPS / 100;
		return Math.round(indiaYield * 1000) / 1000;
	} catch (err: any) {
		logger.warn(`[IndianBondService] AlphaVantage 10Y fetch failed: ${err?.message}`);
		return null;
	}
}

/**
 * RBI website scrape — extracts Repo Rate, CRR, SLR, Bank Rate from rbi.org.in.
 * The RBI updates rates post-MPC meetings (~every 2 months).
 * Falls back to hardcoded actuals if scrape fails.
 *
 * Note: FBIL (fbil.org.in) and CCIL (ccilindia.com) both block GCP IPs.
 * RBI website (rbi.org.in) returns HTTP 200 from Cloud Run.
 */
async function fetchRBIPolicyRates(): Promise<RBIPolicyRates> {
	try {
		// RBI publishes key rates prominently on their home page
		const resp = await fetch("https://www.rbi.org.in/home.aspx", {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				"Accept": "text/html",
			},
			signal: AbortSignal.timeout(12_000),
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

		const html = await resp.text();

		// Parse key rate values from RBI home page HTML
		// Pattern: rate name followed by percentage value in table cells
		const extractRate = (pattern: RegExp): number | null => {
			const match = html.match(pattern);
			return match ? Number.parseFloat(match[1]) : null;
		};

		const repoRate =
			extractRate(/Repo\s+Rate[^%\d]*(\d+\.?\d*)\s*%/i) ??
			extractRate(/Repo[^%\d]*?(\d+\.\d+)\s*%/i);

		const reverseRepo =
			extractRate(/Reverse\s+Repo[^%\d]*(\d+\.?\d*)\s*%/i) ??
			extractRate(/SDF[^%\d]*?(\d+\.\d+)\s*%/i); // Standing Deposit Facility

		const crr = extractRate(/CRR[^%\d]*(\d+\.?\d*)\s*%/i);
		const slr = extractRate(/SLR[^%\d]*(\d+\.?\d*)\s*%/i);
		const bankRate =
			extractRate(/Bank\s+Rate[^%\d]*(\d+\.?\d*)\s*%/i) ??
			extractRate(/MSF[^%\d]*?(\d+\.\d+)\s*%/i);

		// If we got at least the repo rate, use scraped values
		if (repoRate && repoRate > 3 && repoRate < 15) {
			logger.info(`[IndianBondService] RBI scrape: Repo=${repoRate}%, CRR=${crr}%, SLR=${slr}%`);
			return {
				repoRate,
				reversRepoRate: reverseRepo ?? repoRate - 0.25,
				crr: crr ?? RBI_FALLBACK_RATES.crr,
				slr: slr ?? RBI_FALLBACK_RATES.slr,
				msfRate: (bankRate ?? repoRate) + 0.25,
				bankRate: bankRate ?? repoRate + 0.25,
				asOf: new Date().toISOString().split("T")[0],
				source: "rbi_scrape",
			};
		}
		throw new Error("Could not parse repo rate from RBI page");
	} catch (err: any) {
		logger.warn(
			`[IndianBondService] RBI scrape failed (${err?.message}), using hardcoded fallback`,
		);
		return RBI_FALLBACK_RATES;
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

class IndianBondService {
	/**
	 * Returns the India G-Sec yield curve (proxy = US Treasury + sovereign spread).
	 * Cached for 6 hours. Falls back to AlphaVantage 10Y if FMP is unavailable.
	 *
	 * @returns YieldCurve with points for 1m → 30y tenors
	 */
	async getYieldCurve(): Promise<YieldCurve> {
		if (cache.yieldCurve && Date.now() - cache.yieldCurve.ts < CACHE_TTL_MS) {
			return cache.yieldCurve.data;
		}

		// 1. Try FMP full yield curve
		const fmpCurve = await fetchFMPYieldCurve();
		if (fmpCurve) {
			cache.yieldCurve = { data: fmpCurve, ts: Date.now() };
			return fmpCurve;
		}

		// 2. Fallback: AlphaVantage 10Y only → construct simplified curve
		const yield10Y = await fetchAVYield10Y();
		const policyRates = await this.getRBIPolicyRates();
		const repoYield = policyRates.repoRate;

		// Build simple 5-point yield curve from repo rate + 10Y proxy
		const asOf = new Date().toISOString().split("T")[0];
		const baseCurve: YieldCurve = {
			asOf,
			source: "AlphaVantage+RBI_FALLBACK",
			indiaRepoRate: repoYield,
			points: [
				{ tenor: "1d",  tenorYears: 1/365, yield: repoYield,                         source: "RBI_REPO",    asOf },
				{ tenor: "3m",  tenorYears: 0.25,  yield: repoYield + 0.2,                   source: "ESTIMATED",   asOf },
				{ tenor: "6m",  tenorYears: 0.5,   yield: repoYield + 0.4,                   source: "ESTIMATED",   asOf },
				{ tenor: "1y",  tenorYears: 1,     yield: repoYield + 0.6,                   source: "ESTIMATED",   asOf },
				{ tenor: "5y",  tenorYears: 5,     yield: repoYield + 1.1,                   source: "ESTIMATED",   asOf },
				{ tenor: "10y", tenorYears: 10,    yield: yield10Y ?? (repoYield + 1.5),      source: yield10Y ? "AlphaVantage" : "ESTIMATED", asOf },
				{ tenor: "20y", tenorYears: 20,    yield: (yield10Y ?? repoYield + 1.5) + 0.3, source: "ESTIMATED", asOf },
				{ tenor: "30y", tenorYears: 30,    yield: (yield10Y ?? repoYield + 1.5) + 0.5, source: "ESTIMATED", asOf },
			],
		};

		cache.yieldCurve = { data: baseCurve, ts: Date.now() };
		return baseCurve;
	}

	/**
	 * Returns RBI monetary policy rates: Repo, Reverse Repo, CRR, SLR.
	 * Scraped from rbi.org.in. Cached 6h. Falls back to hardcoded actuals.
	 */
	async getRBIPolicyRates(): Promise<RBIPolicyRates> {
		if (cache.policyRates && Date.now() - cache.policyRates.ts < CACHE_TTL_MS) {
			return cache.policyRates.data;
		}

		const rates = await fetchRBIPolicyRates();
		cache.policyRates = { data: rates, ts: Date.now() };
		return rates;
	}

	/**
	 * Interpolates the yield to maturity for a given tenor from the curve.
	 * Uses linear interpolation between available curve points.
	 *
	 * @param tenorYears  Bond residual maturity in years (e.g. 7.5)
	 * @returns  { ytm, source, asOf }
	 */
	async getIndiaYTM(tenorYears: number): Promise<BondYTMResult> {
		const curve = await this.getYieldCurve();
		const points = curve.points.sort((a, b) => a.tenorYears - b.tenorYears);
		const asOf = curve.asOf;

		if (points.length === 0) {
			const policyRates = await this.getRBIPolicyRates();
			return {
				tenorYears,
				ytm: policyRates.repoRate + 1.5, // rough proxy
				source: "RBI_REPO_PROXY",
				asOf,
			};
		}

		// Exact match
		const exact = points.find((p) => Math.abs(p.tenorYears - tenorYears) < 0.01);
		if (exact) {
			return { tenorYears, ytm: exact.yield, source: exact.source, asOf };
		}

		// Extrapolate below minimum
		if (tenorYears <= points[0].tenorYears) {
			return { tenorYears, ytm: points[0].yield, source: points[0].source, asOf };
		}

		// Extrapolate above maximum
		if (tenorYears >= points[points.length - 1].tenorYears) {
			return { tenorYears, ytm: points[points.length - 1].yield, source: points[points.length - 1].source, asOf };
		}

		// Linear interpolation between two surrounding points
		let lower = points[0];
		let upper = points[points.length - 1];
		for (let i = 0; i < points.length - 1; i++) {
			if (points[i].tenorYears <= tenorYears && points[i + 1].tenorYears >= tenorYears) {
				lower = points[i];
				upper = points[i + 1];
				break;
			}
		}

		const t = (tenorYears - lower.tenorYears) / (upper.tenorYears - lower.tenorYears);
		const ytm = lower.yield + t * (upper.yield - lower.yield);

		return {
			tenorYears,
			ytm: Math.round(ytm * 1000) / 1000,
			source: `INTERPOLATED(${lower.tenor}–${upper.tenor})`,
			asOf,
		};
	}

	/**
	 * Returns the India risk-free rate — defined as the RBI Repo Rate.
	 * Used as the floor discount rate for bond DCF pricing.
	 */
	async getRiskFreeRate(): Promise<number> {
		const rates = await this.getRBIPolicyRates();
		return rates.repoRate;
	}

	/**
	 * Refreshes both caches immediately. Called by the midnight EOD cron.
	 */
	async refreshAll(): Promise<void> {
		cache.yieldCurve = undefined;
		cache.policyRates = undefined;
		await Promise.all([this.getYieldCurve(), this.getRBIPolicyRates()]);
		logger.info("[IndianBondService] Yield curve and policy rates refreshed");
	}
}

export const indianBondService = new IndianBondService();
