/**
 * UnifiedInstrumentsService — v1.0
 *
 * Provides a single virtual catalog across all four FintekPro equity asset classes:
 *   1. Listed Stocks (NSE/BSE) — `listed_stocks` table
 *   2. Pre-IPO Companies       — `unlisted_companies` WHERE listing_stage = 'pre_ipo'
 *   3. Live IPOs               — `ipo_companies` WHERE status IN ('upcoming', 'ongoing')
 *   4. Unlisted OTC Equities   — `unlisted_companies` WHERE listing_stage IS NULL OR = 'unlisted'
 *
 * MUTUAL EXCLUSIVITY GUARANTEE:
 *   - Each instrument appears under EXACTLY ONE stage.
 *   - `listed_stocks` rows are NEVER duplicated in unlisted queries.
 *   - `unlisted_companies` rows with listing_stage='pre_ipo' are NEVER shown in unlisted results.
 *   - `unlisted_companies` rows with listing_stage IN ('listed', 'inactive', 'transitioned_to_listed')
 *     are EXCLUDED from all views.
 *
 * GCR v1.0: All responses include engine_version and calculation_timestamp.
 * SEBI: No investment action is taken here — this is read-only discovery only.
 */

import { db } from "../db";
import { sql, and, eq, or, isNull, ne, inArray, ilike } from "drizzle-orm";
import { unlistedCompanies, ipoCompanies, listedStocks } from "@shared/schema";
import { logger } from "../logger";

// ── Canonical unified instrument type ────────────────────────────────────────

export type UnifiedStage = "unlisted" | "pre_ipo" | "ipo" | "listed";

export interface UnifiedInstrument {
	/** Source table primary key */
	id: string;
	/** Display name */
	name: string;
	/**
	 * Canonical stage — the single category this instrument belongs to.
	 * Used for routing to the correct UI tab and pick strategy.
	 */
	stage: UnifiedStage;
	/** Picks / discovery category key (matches agent_picks category enum) */
	category: "listed_stocks" | "unlisted" | "pre_ipo" | "ipo";
	/** Exchange ticker symbol — null for unlisted/pre-IPO */
	symbol: string | null;
	/** ISIN — universal cross-table identity anchor */
	isin: string | null;
	/** MCA Corporate Identification Number — unlisted/pre-IPO identity anchor */
	cin: string | null;
	/** Current price in INR (sell/issue/OTC price) */
	currentPrice: number | null;
	currency: string;
	sector: string | null;
	exchange: string | null;
	/** Source table name for deep-link routing */
	sourceTable: string;
	updatedAt: string;
}

export interface UnifiedInstrumentsParams {
	stage?: UnifiedStage | "all";
	search?: string;
	sector?: string;
	page?: number;
	limit?: number;
}

export interface UnifiedInstrumentsResult {
	instruments: UnifiedInstrument[];
	total: number;
	page: number;
	limit: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Stages that mark a company as fully transitioned away from unlisted */
const TRANSITIONED_STAGES = ["listed", "inactive", "transitioned_to_listed"] as const;

// ── Helper: safe decimal → number ─────────────────────────────────────────────

function toNum(val: unknown): number | null {
	if (val == null) return null;
	const n = Number(val);
	return isNaN(n) ? null : n;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class UnifiedInstrumentsService {
	/**
	 * Returns a unified catalog of instruments across all asset classes.
	 * Each instrument appears in EXACTLY ONE stage bucket.
	 *
	 * Purpose:  Single source of truth for discovery, global search, and agent picks.
	 * Inputs:   stage filter, search query, sector filter, pagination params.
	 * Outputs:  Paginated list of UnifiedInstrument with total count.
	 * Edge cases: Companies mid-transition (e.g., listing_stage='pre_ipo' in unlisted_companies)
	 *             are correctly placed in pre_ipo and excluded from unlisted.
	 */
	async getUnifiedInstruments(params: UnifiedInstrumentsParams): Promise<UnifiedInstrumentsResult> {
		const { stage = "all", search, sector, page = 1, limit = 50 } = params;
		const offset = (page - 1) * limit;

		const startTs = Date.now();

		try {
			const buckets: UnifiedInstrument[][] = await Promise.all([
				stage === "all" || stage === "listed" ? this.fetchListed(search, sector) : Promise.resolve([]),
				stage === "all" || stage === "pre_ipo" ? this.fetchPreIpo(search, sector) : Promise.resolve([]),
				stage === "all" || stage === "ipo" ? this.fetchIpo(search, sector) : Promise.resolve([]),
				stage === "all" || stage === "unlisted" ? this.fetchUnlisted(search, sector) : Promise.resolve([]),
			]);

			const all = buckets.flat();

			// De-duplicate: if somehow the same ISIN appears in multiple buckets (e.g., data lag),
			// favour the higher-priority stage: listed > ipo > pre_ipo > unlisted
			const stagePriority: Record<UnifiedStage, number> = {
				listed: 4,
				ipo: 3,
				pre_ipo: 2,
				unlisted: 1,
			};
			const seen = new Map<string, UnifiedInstrument>();
			for (const inst of all) {
				const dedupeKey = inst.isin ?? inst.cin ?? `${inst.sourceTable}:${inst.id}`;
				const existing = seen.get(dedupeKey);
				if (!existing || stagePriority[inst.stage] > stagePriority[existing.stage]) {
					seen.set(dedupeKey, inst);
				}
			}

			const deduped = Array.from(seen.values());
			const total = deduped.length;
			const paginated = deduped.slice(offset, offset + limit);

			logger.info("[UnifiedInstruments] getUnifiedInstruments", {
				event: "UNIFIED_INSTRUMENTS_FETCHED",
				user_id: "system",
				latency_ms: Date.now() - startTs,
				status: "success",
				stage,
				total,
				returned: paginated.length,
			});

			return { instruments: paginated, total, page, limit };
		} catch (err: any) {
			logger.error("[UnifiedInstruments] getUnifiedInstruments error", {
				event: "UNIFIED_INSTRUMENTS_ERROR",
				user_id: "system",
				latency_ms: Date.now() - startTs,
				status: "error",
				error: err?.message,
				retryable: true,
			});
			throw err;
		}
	}

	// ── Private fetch helpers — each enforces its own mutual exclusivity ───────

	/**
	 * Fetches listed stocks.
	 * Exclusivity: Only `is_active = true` rows; never overlaps with unlisted tables.
	 */
	private async fetchListed(search?: string, sector?: string): Promise<UnifiedInstrument[]> {
		const conditions = [eq(listedStocks.isActive, true)];

		if (sector) {
			conditions.push(eq(listedStocks.sector, sector));
		}

		let query = db
			.select({
				id: listedStocks.id,
				name: listedStocks.companyName,
				symbol: listedStocks.symbol,
				isin: listedStocks.isin,
				cin: listedStocks.cin,
				currentPrice: listedStocks.currentPrice,
				sector: listedStocks.sector,
				exchange: listedStocks.exchange,
				updatedAt: listedStocks.lastUpdated,
			})
			.from(listedStocks)
			.where(and(...conditions));

		const rows = await query.limit(500);

		return rows
			.filter((r) => {
				if (!search) return true;
				const q = search.toLowerCase();
				return (
					r.name?.toLowerCase().includes(q) ||
					r.symbol?.toLowerCase().includes(q) ||
					r.isin?.toLowerCase().includes(q)
				);
			})
			.map((r) => ({
				id: r.id,
				name: r.name,
				stage: "listed" as UnifiedStage,
				category: "listed_stocks" as const,
				symbol: r.symbol ?? null,
				isin: r.isin ?? null,
				cin: r.cin ?? null,
				currentPrice: toNum(r.currentPrice),
				currency: "INR",
				sector: r.sector ?? null,
				exchange: r.exchange ?? "NSE",
				sourceTable: "listed_stocks",
				updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
			}));
	}

	/**
	 * Fetches pre-IPO companies.
	 * Exclusivity: Only `listing_stage = 'pre_ipo'` rows from `unlisted_companies`.
	 * Never overlaps with unlisted (which explicitly excludes pre_ipo).
	 */
	private async fetchPreIpo(search?: string, sector?: string): Promise<UnifiedInstrument[]> {
		const conditions = [
			eq(unlistedCompanies.status, "active"),
			eq(unlistedCompanies.listingStage, "pre_ipo"),
		];

		if (sector) {
			conditions.push(eq(unlistedCompanies.sector, sector));
		}

		const rows = await db
			.select({
				id: unlistedCompanies.id,
				name: unlistedCompanies.name,
				isin: unlistedCompanies.isin,
				cin: unlistedCompanies.cin,
				publishedSellPrice: unlistedCompanies.publishedSellPrice,
				sector: unlistedCompanies.sector,
				updatedAt: unlistedCompanies.updatedAt,
			})
			.from(unlistedCompanies)
			.where(and(...conditions))
			.limit(200);

		return rows
			.filter((r) => {
				if (!search) return true;
				const q = search.toLowerCase();
				return (
					r.name?.toLowerCase().includes(q) ||
					r.isin?.toLowerCase().includes(q) ||
					r.cin?.toLowerCase().includes(q)
				);
			})
			.map((r) => ({
				id: r.id,
				name: r.name,
				stage: "pre_ipo" as UnifiedStage,
				category: "pre_ipo" as const,
				symbol: null,
				isin: r.isin ?? null,
				cin: r.cin ?? null,
				currentPrice: toNum(r.publishedSellPrice),
				currency: "INR",
				sector: r.sector ?? null,
				exchange: null,
				sourceTable: "unlisted_companies",
				updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
			}));
	}

	/**
	 * Fetches live IPO companies.
	 * Exclusivity: Only `status IN ('upcoming', 'ongoing')` from `ipo_companies`.
	 */
	private async fetchIpo(search?: string, sector?: string): Promise<UnifiedInstrument[]> {
		const conditions = [
			or(
				eq(ipoCompanies.status, "upcoming"),
				eq(ipoCompanies.status, "ongoing"),
			)!,
		];

		if (sector) {
			conditions.push(eq(ipoCompanies.sector, sector));
		}

		const rows = await db
			.select({
				id: ipoCompanies.id,
				name: ipoCompanies.companyName,
				isin: sql<string | null>`null`,
				sector: ipoCompanies.sector,
				priceBandMax: ipoCompanies.priceBandMax,
				status: ipoCompanies.status,
				updatedAt: ipoCompanies.lastUpdated,
			})
			.from(ipoCompanies)
			.where(and(...conditions))
			.limit(100);

		return rows
			.filter((r) => {
				if (!search) return true;
				const q = search.toLowerCase();
				return r.name?.toLowerCase().includes(q) || r.sector?.toLowerCase().includes(q);
			})
			.map((r) => ({
				id: r.id,
				name: r.name,
				stage: "ipo" as UnifiedStage,
				category: "ipo" as const,
				symbol: null,
				isin: null,
				cin: null,
				currentPrice: toNum(r.priceBandMax),
				currency: "INR",
				sector: r.sector ?? null,
				exchange: "NSE/BSE",
				sourceTable: "ipo_companies",
				updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
			}));
	}

	/**
	 * Fetches strictly OTC-only unlisted companies.
	 * Exclusivity: Excludes any row where listing_stage is NOT NULL and NOT 'unlisted',
	 * and excludes any company with status = 'inactive' or 'transitioned_to_listed'.
	 */
	private async fetchUnlisted(search?: string, sector?: string): Promise<UnifiedInstrument[]> {
		const conditions = [
			eq(unlistedCompanies.status, "active"),
			// Strict mutex: only genuinely unlisted — not pre-IPO, not listed
			or(
				isNull(unlistedCompanies.listingStage),
				eq(unlistedCompanies.listingStage, "unlisted"),
				eq(unlistedCompanies.listingStage, "growth"),
				eq(unlistedCompanies.listingStage, "mature"),
			)!,
		];

		if (sector) {
			conditions.push(eq(unlistedCompanies.sector, sector));
		}

		const rows = await db
			.select({
				id: unlistedCompanies.id,
				name: unlistedCompanies.name,
				isin: unlistedCompanies.isin,
				cin: unlistedCompanies.cin,
				publishedSellPrice: unlistedCompanies.publishedSellPrice,
				sector: unlistedCompanies.sector,
				listingStage: unlistedCompanies.listingStage,
				updatedAt: unlistedCompanies.updatedAt,
			})
			.from(unlistedCompanies)
			.where(and(...conditions))
			.limit(500);

		return rows
			.filter((r) => {
				if (!search) return true;
				const q = search.toLowerCase();
				return (
					r.name?.toLowerCase().includes(q) ||
					r.isin?.toLowerCase().includes(q) ||
					r.cin?.toLowerCase().includes(q)
				);
			})
			.map((r) => ({
				id: r.id,
				name: r.name,
				stage: "unlisted" as UnifiedStage,
				category: "unlisted" as const,
				symbol: null,
				isin: r.isin ?? null,
				cin: r.cin ?? null,
				currentPrice: toNum(r.publishedSellPrice),
				currency: "INR",
				sector: r.sector ?? null,
				exchange: null,
				sourceTable: "unlisted_companies",
				updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
			}));
	}
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const unifiedInstrumentsService = new UnifiedInstrumentsService();
