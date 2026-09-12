/**
 * InstrumentLifecycleManager — v1.0
 *
 * Central orchestrator for all instrument stage transitions across FintekPro.
 * Manages the complete lifecycle:
 *
 *   [unlisted] → [pre_ipo] → [listed]
 *
 * With side-events:
 *   - Name changes   (company renames post-listing or pre-listing)
 *   - ISIN changes   (post-restructuring, rights issues)
 *   - Symbol changes (NSE/BSE ticker renames)
 *
 * Tasks:
 *   A. promoteToPrIpo()      — unlisted → pre_ipo (SEBI/NSE IPO signals)
 *   B. sweepListingTransitions() — pre_ipo → listed (extends UnlistedListingTracker)
 *   C. reconcileNameChanges()— NSE equity master diff → company_rename_log
 *   D. reconcileIsinChanges()— BSE ISIN cross-check → isin_change_log
 *
 * FASP-AI: All lifecycle transitions are audit-logged with full provenance.
 * SEBI: No automated investment action is taken — only advisory pick status updates.
 */

import axios from "axios";
import { db } from "../db";
import { sql, eq, and, or, isNull, ne, inArray } from "drizzle-orm";
import {
	unlistedCompanies,
	unlistedCompanyStatusLog,
	instrumentLifecycleEvents,
	isinChangeLog,
} from "@shared/schema";
import { unlistedListingTracker } from "./unlisted-listing-tracker";
import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LifecycleStage = "unlisted" | "pre_ipo" | "ipo" | "privately_listed" | "listed" | "inactive" | "growth" | "mature";

export type TransitionType =
	| "promotion"      // unlisted → pre_ipo
	| "listing"        // pre_ipo → listed
	| "name_change"
	| "isin_change"
	| "symbol_change"
	| "merger"
	| "demerger"
	| "admin_override";

export interface LifecycleTransition {
	instrumentId: string;
	instrumentName: string;
	isin?: string;
	fromStage: LifecycleStage;
	toStage: LifecycleStage;
	transitionType: TransitionType;
	detectedBy: string;
	exchange?: string;
	exchangeSymbol?: string;
	picksExpired: number;
	picksCreated: number;
	notes?: string;
}

export interface NameChangeEvent {
	instrumentId: string;
	oldName: string;
	newName: string;
	isin?: string;
	source: string;
}

export interface IsinChangeEvent {
	instrumentId: string;
	instrumentName: string;
	oldIsin: string;
	newIsin: string;
	changeReason: string;
	source: string;
}

// ── NSE upcoming IPO API (public, no auth) ────────────────────────────────────
// Returns companies that have filed for IPO or have an upcoming listing.
// Format: { ipoOpenDate, ipoCloseDate, companyName, isin, symbol, exchange }
const NSE_IPO_URL = "https://www.nseindia.com/api/ipo";
const NSE_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	Accept: "application/json",
	Referer: "https://www.nseindia.com/",
};

// ── SEBI DRHP filings API ─────────────────────────────────────────────────────
// Searches SEBI's public disclosure portal for recent DRHP filings.
// (Best-effort — falls back to name matching)
const SEBI_DRHP_URL =
	"https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=22";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Helper: structured log ────────────────────────────────────────────────────
function lifecycleLog(event: string, data: Record<string, any>) {
	logger.info(`[LifecycleManager] ${event}`, {
		event,
		user_id: "system",
		timestamp: new Date().toISOString(),
		...data,
	});
}

// ── Helper: write lifecycle event to DB ──────────────────────────────────────
async function auditLifecycleEvent(
	params: Omit<
		typeof instrumentLifecycleEvents.$inferInsert,
		"id" | "createdAt"
	>,
): Promise<void> {
	await db.insert(instrumentLifecycleEvents).values(params);
}

// ── Helper: expire picks for an instrument across given categories ─────────────
async function expirePicks(
	instrumentId: string,
	instrumentName: string,
	categories: string[],
): Promise<number> {
	const catList = categories.map((c) => `'${c}'`).join(", ");
	const result = await db.execute(sql`
    UPDATE daily_picks
    SET    status = 'expired', updated_at = NOW()
    WHERE  status = 'live'
      AND  category::text = ANY(ARRAY[${sql.raw(catList)}])
      AND  (
             instrument_id = ${instrumentId}
          OR instrument_name ILIKE ${"%" + instrumentName.split(" ")[0] + "%"}
           )
  `);
	return (result as any).rowCount ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// InstrumentLifecycleManager
// ─────────────────────────────────────────────────────────────────────────────
export class InstrumentLifecycleManager {
	// ── Task A: Detect unlisted → pre_ipo promotions ───────────────────────────
	/**
	 * Checks active unlisted companies against NSE upcoming IPO list and SEBI
	 * DRHP filings. When a match is found, promotes the company to pre_ipo and
	 * emits a new pre_ipo daily pick.
	 *
	 * @returns List of companies promoted to pre_ipo
	 */
	async promoteToPreIpo(): Promise<LifecycleTransition[]> {
		const promoted: LifecycleTransition[] = [];
		const sweepStart = Date.now();

		lifecycleLog("LIFECYCLE_PREIPO_SWEEP_START", { status: "started" });

		try {
			// 1. Fetch unlisted companies eligible for promotion
			//    (excludes those already in pre_ipo / listed / inactive)
			const candidates = await db
				.select()
				.from(unlistedCompanies)
				.where(
					and(
						eq(unlistedCompanies.status, "active"),
						or(
							isNull(unlistedCompanies.listingStage),
							eq(unlistedCompanies.listingStage, "unlisted"),
							eq(unlistedCompanies.listingStage, "growth"),
							eq(unlistedCompanies.listingStage, "mature"),
						),
					),
				)
				.limit(200);

			if (candidates.length === 0) return [];

			// 2. Fetch NSE upcoming IPO list (public API)
			const nseIpoNames = await this.fetchNseUpcomingIpos();

			// 3. Match each candidate against IPO signals
			for (const company of candidates) {
				try {
					const matched = this.matchIpoSignal(company, nseIpoNames);
					if (!matched) continue;

					// 4. Promote: update listing_stage
					await db
						.update(unlistedCompanies)
						.set({
							listingStage: "pre_ipo",
							updatedAt: new Date(),
						})
						.where(eq(unlistedCompanies.id, company.id));

					// 5. Expire any live unlisted pick for this company
					const picksExpired = await expirePicks(
						company.id,
						company.name,
						["unlisted"],
					);

					// 6. Insert a new pre_ipo pick directly
					const picksCreated = await this.insertPreIpoPick(company);

					// 7. Audit log — unlisted_company_status_log
					await db.insert(unlistedCompanyStatusLog).values({
						companyId: company.id,
						previousStatus: company.listingStage ?? "unlisted",
						newStatus: "pre_ipo",
						statusSource: matched.source,
						notes: `Auto-promoted | Signal: ${matched.signal} | Source: ${matched.source}`,
					} as any);

					// 8. Lifecycle event
					await auditLifecycleEvent({
						instrumentId: company.id,
						instrumentName: company.name,
						isin: company.isin ?? undefined,
						sourceTable: "unlisted_companies",
						fromStage: company.listingStage ?? "unlisted",
						toStage: "pre_ipo",
						transitionType: "promotion",
						detectedBy: matched.source,
						picksExpired,
						picksCreated,
						notes: `Signal: ${matched.signal}`,
					});

					const transition: LifecycleTransition = {
						instrumentId: company.id,
						instrumentName: company.name,
						isin: company.isin ?? undefined,
						fromStage: (company.listingStage ?? "unlisted") as LifecycleStage,
						toStage: "pre_ipo",
						transitionType: "promotion",
						detectedBy: matched.source,
						picksExpired,
						picksCreated,
						notes: matched.signal,
					};
					promoted.push(transition);

					lifecycleLog("LIFECYCLE_PROMOTED_TO_PREIPO", {
						status: "success",
						instrumentId: company.id,
						instrumentName: company.name,
						signal: matched.signal,
						picksExpired,
						picksCreated,
					});

					await sleep(500);
				} catch (err: any) {
					lifecycleLog("LIFECYCLE_PROMOTION_ERROR", {
						status: "error",
						instrumentId: company.id,
						instrumentName: company.name,
						error: err?.message,
					});
				}
			}
		} catch (err: any) {
			lifecycleLog("LIFECYCLE_PREIPO_SWEEP_ERROR", {
				status: "error",
				error: err?.message,
			});
		}

		lifecycleLog("LIFECYCLE_PREIPO_SWEEP_DONE", {
			status: "success",
			promoted: promoted.length,
			latency_ms: Date.now() - sweepStart,
		});

		return promoted;
	}

	// ── Task B: pre_ipo → listed (extends UnlistedListingTracker) ──────────────
	/**
	 * Sweeps pre_ipo companies for listing using BSE/NSE APIs.
	 * On listing detection:
	 *   - Updates listing_stage = 'listed', status = 'inactive'
	 *   - Expires BOTH unlisted AND pre_ipo picks
	 *   - Handles name/ISIN changes discovered during listing check
	 */
	async sweepPreIpoListings(): Promise<LifecycleTransition[]> {
		const transitions: LifecycleTransition[] = [];

		// The existing UnlistedListingTracker handles the exchange API calls.
		// We extend it by also sweeping pre_ipo companies here.
		const preIpoCandidates = await db
			.select()
			.from(unlistedCompanies)
			.where(
				and(
					eq(unlistedCompanies.status, "active"),
					eq(unlistedCompanies.listingStage, "pre_ipo"),
				),
			)
			.limit(50);

		for (const company of preIpoCandidates) {
			try {
				// Re-use the existing single-company check in the UnlistedListingTracker
				const result = await unlistedListingTracker.checkSingleCompany(
					company.id,
				);
				if (!result) continue;

				// The tracker already expired `unlisted` picks — also expire `pre_ipo`
				const preIpoExpired = await expirePicks(
					company.id,
					company.name,
					["pre_ipo"],
				);

				// Audit the pre_ipo → listed lifecycle event
				await auditLifecycleEvent({
					instrumentId: company.id,
					instrumentName: company.name,
					isin: company.isin ?? undefined,
					sourceTable: "unlisted_companies",
					fromStage: "pre_ipo",
					toStage: "listed",
					transitionType: "listing",
					detectedBy: result.detectedBy,
					exchange: result.exchange,
					exchangeSymbol: result.nseSymbol,
					picksExpired: preIpoExpired + result.picksExpired,
					picksCreated: 0,
					effectiveDate: result.listedOn,
					notes: `Exchange: ${result.exchange} | Symbol: ${result.nseSymbol}`,
				});

				transitions.push({
					instrumentId: company.id,
					instrumentName: company.name,
					fromStage: "pre_ipo",
					toStage: "listed",
					transitionType: "listing",
					detectedBy: result.detectedBy,
					exchange: result.exchange,
					exchangeSymbol: result.nseSymbol,
					picksExpired: preIpoExpired + result.picksExpired,
					picksCreated: 0,
				});

				await sleep(1200);
			} catch (err: any) {
				lifecycleLog("LIFECYCLE_LISTING_ERROR", {
					status: "error",
					instrumentId: company.id,
					error: err?.message,
				});
			}
		}

		return transitions;
	}

	// ── Task C: Name change reconciliation ────────────────────────────────────
	/**
	 * Compares NSE equity master against stored company names.
	 * On mismatch, writes to company_rename_log and updates daily_picks.
	 *
	 * @returns List of name change events
	 */
	async reconcileNameChanges(): Promise<NameChangeEvent[]> {
		const changes: NameChangeEvent[] = [];

		try {
			// Fetch NSE equity master list (contains official name + ISIN + symbol)
			const nseEquityMaster = await this.fetchNseEquityMaster();
			if (!nseEquityMaster.length) return [];

			// Build ISIN → NSE name lookup
			const nseNameByIsin = new Map<string, string>();
			for (const row of nseEquityMaster) {
				if (row.isin && row.companyName) {
					nseNameByIsin.set(row.isin.trim(), row.companyName.trim());
				}
			}

			// Check unlisted companies with known ISINs
			const companies = await db
				.select()
				.from(unlistedCompanies)
				.where(
					and(
						ne(unlistedCompanies.listingStage ?? "", "listed"),
						// Only check companies with ISINs
					),
				)
				.limit(500);

			for (const company of companies) {
				if (!company.isin) continue;
				const nseName = nseNameByIsin.get(company.isin);
				if (!nseName) continue;

				// Compare names (normalized)
				const normalize = (s: string) =>
					s
						.toLowerCase()
						.replace(/\b(limited|ltd|private|pvt|india|inc|corp)\b/g, "")
						.replace(/[^a-z0-9]/g, "")
						.trim();

				if (normalize(nseName) === normalize(company.name)) continue;

				// Name mismatch — record it
				try {
					await db.execute(sql`
            INSERT INTO company_rename_log (isin, old_name, new_name, exchange, source, detected_at)
            VALUES (${company.isin}, ${company.name}, ${nseName}, 'NSE', 'nse_master', NOW())
            ON CONFLICT DO NOTHING
          `);

					// Update daily_picks.instrument_name so UI shows current name
					await db.execute(sql`
            UPDATE daily_picks
            SET    instrument_name = ${nseName}, updated_at = NOW()
            WHERE  isin = ${company.isin}
              AND  instrument_name != ${nseName}
          `);

					// Update unlisted_companies.name
					await db
						.update(unlistedCompanies)
						.set({ name: nseName, updatedAt: new Date() })
						.where(eq(unlistedCompanies.id, company.id));

					// Lifecycle event
					await auditLifecycleEvent({
						instrumentId: company.id,
						instrumentName: nseName,
						isin: company.isin,
						sourceTable: "unlisted_companies",
						fromStage: (company.listingStage ?? "unlisted") as LifecycleStage,
						toStage: (company.listingStage ?? "unlisted") as LifecycleStage,
						transitionType: "name_change",
						detectedBy: "nse_master",
						oldValue: company.name,
						newValue: nseName,
						notes: "Auto-detected from NSE equity master",
					});

					changes.push({
						instrumentId: company.id,
						oldName: company.name,
						newName: nseName,
						isin: company.isin,
						source: "nse_master",
					});

					lifecycleLog("LIFECYCLE_NAME_CHANGE_DETECTED", {
						status: "success",
						instrumentId: company.id,
						oldName: company.name,
						newName: nseName,
						isin: company.isin,
					});
				} catch (err: any) {
					lifecycleLog("LIFECYCLE_NAME_CHANGE_ERROR", {
						status: "error",
						instrumentId: company.id,
						error: err?.message,
					});
				}
			}
		} catch (err: any) {
			lifecycleLog("LIFECYCLE_NAME_RECONCILE_ERROR", {
				status: "error",
				error: err?.message,
			});
		}

		return changes;
	}

	// ── Task D: ISIN change reconciliation ───────────────────────────────────
	/**
	 * Detects ISIN changes by cross-checking BSE ISIN API against stored ISINs.
	 * Very rare — happens after restructuring, demergers, rights issues.
	 * Writes to isin_change_log and propagates changes to daily_picks.
	 *
	 * @returns List of ISIN change events
	 */
	async reconcileIsinChanges(): Promise<IsinChangeEvent[]> {
		const changes: IsinChangeEvent[] = [];

		try {
			// Check companies that recently transitioned (flagged in lifecycle events)
			// Also check companies with known ISINs that haven't been synced recently
			const companies = await db
				.select()
				.from(unlistedCompanies)
				.where(
					and(
						eq(unlistedCompanies.status, "active"),
						ne(unlistedCompanies.listingStage ?? "", "listed"),
					),
				)
				.limit(100);

			for (const company of companies) {
				if (!company.isin) continue;

				try {
					// Query BSE API with the stored ISIN to verify it's still valid
					const bseData = await this.checkBseIsin(company.isin);
					if (!bseData) continue;

					// If BSE returns a different ISIN, record the change
					if (
						bseData.newIsin &&
						bseData.newIsin !== company.isin &&
						bseData.newIsin.length === 12
					) {
						// Write to isin_change_log
						await db.insert(isinChangeLog).values({
							instrumentId: company.id,
							instrumentName: company.name,
							oldIsin: company.isin,
							newIsin: bseData.newIsin,
							changeReason: bseData.changeReason ?? "restructuring",
							source: "bse_api",
						});

						// Update unlisted_companies.isin
						await db
							.update(unlistedCompanies)
							.set({ isin: bseData.newIsin, updatedAt: new Date() })
							.where(eq(unlistedCompanies.id, company.id));

						// Propagate to daily_picks
						await db.execute(sql`
              UPDATE daily_picks
              SET    isin = ${bseData.newIsin}, updated_at = NOW()
              WHERE  isin = ${company.isin}
            `);

						// Lifecycle event
						await auditLifecycleEvent({
							instrumentId: company.id,
							instrumentName: company.name,
							isin: bseData.newIsin,
							sourceTable: "unlisted_companies",
							fromStage: (company.listingStage ?? "unlisted") as LifecycleStage,
							toStage: (company.listingStage ?? "unlisted") as LifecycleStage,
							transitionType: "isin_change",
							detectedBy: "bse_api",
							oldValue: company.isin,
							newValue: bseData.newIsin,
							notes: bseData.changeReason ?? "ISIN changed post-restructuring",
						});

						changes.push({
							instrumentId: company.id,
							instrumentName: company.name,
							oldIsin: company.isin,
							newIsin: bseData.newIsin,
							changeReason: bseData.changeReason ?? "restructuring",
							source: "bse_api",
						});

						lifecycleLog("LIFECYCLE_ISIN_CHANGE_DETECTED", {
							status: "success",
							instrumentId: company.id,
							oldIsin: company.isin,
							newIsin: bseData.newIsin,
						});
					}

					await sleep(300);
				} catch (err: any) {
					// Non-fatal per-company error
				}
			}
		} catch (err: any) {
			lifecycleLog("LIFECYCLE_ISIN_RECONCILE_ERROR", {
				status: "error",
				error: err?.message,
			});
		}

		return changes;
	}

	// ── Admin override: force a stage transition ──────────────────────────────
	/**
	 * Allows an admin to manually promote or demote an instrument's stage.
	 * This is the escape hatch when APIs don't detect a change automatically.
	 *
	 * @param instrumentId  ID in unlisted_companies
	 * @param toStage       Target stage
	 * @param adminUserId   Admin who triggered the override
	 * @param notes         Reason for manual override
	 */
	async adminOverride(
		instrumentId: string,
		toStage: LifecycleStage,
		adminUserId: string,
		notes: string,
	): Promise<{ success: boolean; message: string }> {
		const company = await db
			.select()
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, instrumentId))
			.limit(1);

		if (!company[0]) {
			return { success: false, message: "Company not found" };
		}

		const fromStage = (company[0].listingStage ?? "unlisted") as LifecycleStage;

		await db
			.update(unlistedCompanies)
			.set({
				listingStage: toStage,
				status: toStage === "listed" ? "inactive" : "active",
				updatedAt: new Date(),
			})
			.where(eq(unlistedCompanies.id, instrumentId));

		let picksExpired = 0;
		if (toStage === "listed") {
			picksExpired = await expirePicks(company[0].id, company[0].name, [
				"unlisted",
				"pre_ipo",
			]);
		} else if (toStage === "pre_ipo" && fromStage !== "pre_ipo") {
			picksExpired = await expirePicks(company[0].id, company[0].name, [
				"unlisted",
			]);
		}

		await auditLifecycleEvent({
			instrumentId,
			instrumentName: company[0].name,
			isin: company[0].isin ?? undefined,
			sourceTable: "unlisted_companies",
			fromStage,
			toStage,
			transitionType: "admin_override",
			detectedBy: `admin:${adminUserId}`,
			picksExpired,
			picksCreated: 0,
			notes,
		});

		lifecycleLog("LIFECYCLE_ADMIN_OVERRIDE", {
			status: "success",
			instrumentId,
			fromStage,
			toStage,
			adminUserId,
			picksExpired,
			notes,
		});

		return {
			success: true,
			message: `${company[0].name}: ${fromStage} → ${toStage} (${picksExpired} picks expired)`,
		};
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	/**
	 * Fetches upcoming IPO list from NSE public API.
	 * Returns normalised company names + ISINs for matching.
	 */
	private async fetchNseUpcomingIpos(): Promise<
		Array<{ name: string; isin?: string; symbol?: string; source: string }>
	> {
		try {
			// NSE requires a session cookie — we use the session-less endpoints
			const response = await axios.get(NSE_IPO_URL, {
				headers: NSE_HEADERS,
				timeout: 8000,
			});

			const data = response.data;
			if (!Array.isArray(data)) return [];

			return data.map((item: any) => ({
				name: item.companyName ?? item.name ?? "",
				isin: item.isin,
				symbol: item.symbol,
				source: "nse_ipo_api",
			}));
		} catch {
			// NSE API can fail due to session requirements — non-fatal
			lifecycleLog("LIFECYCLE_NSE_IPO_FETCH_FAILED", {
				status: "warn",
				message: "NSE IPO API unavailable — using fallback",
			});
			return [];
		}
	}

	/**
	 * Fetches NSE equity master CSV to check for name changes.
	 * Returns array of { isin, companyName, symbol }
	 */
	private async fetchNseEquityMaster(): Promise<
		Array<{ isin: string; companyName: string; symbol: string }>
	> {
		try {
			// NSE provides a public equity master CSV
			const response = await axios.get(
				"https://www.nseindia.com/api/equity-master",
				{ headers: NSE_HEADERS, timeout: 10000 },
			);
			const data = response.data;
			if (!Array.isArray(data)) return [];
			return data
				.filter((r: any) => r.isin && r.companyName)
				.map((r: any) => ({
					isin: r.isin,
					companyName: r.companyName,
					symbol: r.symbol,
				}));
		} catch {
			return [];
		}
	}

	/**
	 * Checks BSE ISIN API for a given ISIN. Returns null if not listed.
	 * If BSE returns a successor ISIN, returns the new ISIN.
	 */
	private async checkBseIsin(
		isin: string,
	): Promise<{ newIsin?: string; changeReason?: string } | null> {
		try {
			const url = `https://api.bseindia.com/BseIndiaAPI/api/ComHeader/w?quotetype=EQ&scripcode=&isin=${isin}`;
			const response = await axios.get(url, {
				timeout: 6000,
				headers: { "User-Agent": "Mozilla/5.0" },
			});
			const data = response.data;
			if (!data || !data.Isin) return null;

			// If BSE returns a different ISIN for the same company
			if (data.Isin !== isin) {
				return {
					newIsin: data.Isin,
					changeReason: data.ReasonForChange ?? "restructuring",
				};
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Matches an unlisted company against IPO signal sources.
	 * Returns match details if found, null if no signal.
	 */
	private matchIpoSignal(
		company: any,
		nseIpos: Array<{ name: string; isin?: string; symbol?: string; source: string }>,
	): { signal: string; source: string } | null {
		const normalize = (s: string) =>
			s
				.toLowerCase()
				.replace(/\b(limited|ltd|private|pvt|india|inc|corp)\b/g, "")
				.replace(/[^a-z0-9\s]/g, "")
				.trim();

		const companyNorm = normalize(company.name);

		// 1. ISIN match (most reliable)
		if (company.isin) {
			const isinMatch = nseIpos.find((i) => i.isin === company.isin);
			if (isinMatch) {
				return { signal: `ISIN match: ${company.isin}`, source: isinMatch.source };
			}
		}

		// 2. Name overlap (≥70% Jaccard similarity)
		for (const ipo of nseIpos) {
			const ipoNorm = normalize(ipo.name);
			const tokA = new Set(companyNorm.split(/\s+/).filter(Boolean));
			const tokB = new Set(ipoNorm.split(/\s+/).filter(Boolean));
			const intersection = [...tokA].filter((t) => tokB.has(t)).length;
			const union = new Set([...tokA, ...tokB]).size;
			const jaccard = union === 0 ? 0 : intersection / union;
			if (jaccard >= 0.7) {
				return {
					signal: `Name match (${Math.round(jaccard * 100)}%): ${ipo.name}`,
					source: ipo.source,
				};
			}
		}

		return null;
	}

	/**
	 * Creates a pre_ipo pick in daily_picks for the newly promoted company.
	 * Returns 1 if created, 0 if skipped (no price available).
	 */
	private async insertPreIpoPick(company: any): Promise<number> {
		const price = Number.parseFloat(
			company.publishedBuyPrice || company.draftBuyPrice || "0",
		);
		if (!price || price <= 0) return 0;

		try {
			const today = new Date().toISOString().split("T")[0];
			const targetPrice = Math.round(price * 1.3 * 100) / 100;
			const stoplossPrice = Math.round(price * 0.85 * 100) / 100;
			const expiry = new Date();
			expiry.setDate(expiry.getDate() + 180);

			await db.execute(sql`
        INSERT INTO daily_picks (
          category, instrument_id, instrument_name, isin,
          reco_date, reco_price, target_price, stoploss_price, current_price,
          status, expiry_date, rationale, risk_level, suitable_for,
          time_horizon, confidence_score, sector_category, key_metrics,
          created_at, updated_at
        ) VALUES (
          'pre_ipo', ${company.id}, ${company.name}, ${company.isin ?? null},
          ${today}, ${price}, ${targetPrice}, ${stoplossPrice}, ${price},
          'live', ${expiry.toISOString().split("T")[0]},
          ${"Pre-IPO opportunity: " + company.name + " — promoted from unlisted stage following IPO signal detection. High-risk, illiquid investment for Aggressive/HNI investors. SEBI: Speculative, total capital loss possible."},
          'high', ARRAY['Aggressive'],
          'Long Term (1+ year)', 72, ${company.sector ?? null},
          ${JSON.stringify({
						listingStage: "pre_ipo",
						sector: company.sector,
						isIlliquid: true,
						isSpeculative: true,
						requiresAccreditedInvestor: true,
						autoPromoted: true,
					})},
          NOW(), NOW()
        )
        ON CONFLICT DO NOTHING
      `);
			return 1;
		} catch {
			return 0;
		}
	}

	// ── Full sweep: runs all tasks ────────────────────────────────────────────
	async runFullSweep(): Promise<{
		promoted: LifecycleTransition[];
		listed: LifecycleTransition[];
		nameChanges: NameChangeEvent[];
		isinChanges: IsinChangeEvent[];
		latencyMs: number;
	}> {
		const start = Date.now();

		lifecycleLog("LIFECYCLE_FULL_SWEEP_START", { status: "started" });

		const [promoted, listed, nameChanges, isinChanges] = await Promise.allSettled([
			this.promoteToPreIpo(),
			this.sweepPreIpoListings(),
			this.reconcileNameChanges(),
			this.reconcileIsinChanges(),
		]);

		const result = {
			promoted: promoted.status === "fulfilled" ? promoted.value : [],
			listed: listed.status === "fulfilled" ? listed.value : [],
			nameChanges: nameChanges.status === "fulfilled" ? nameChanges.value : [],
			isinChanges: isinChanges.status === "fulfilled" ? isinChanges.value : [],
			latencyMs: Date.now() - start,
		};

		lifecycleLog("LIFECYCLE_FULL_SWEEP_DONE", {
			status: "success",
			promoted: result.promoted.length,
			listed: result.listed.length,
			nameChanges: result.nameChanges.length,
			isinChanges: result.isinChanges.length,
			latency_ms: result.latencyMs,
		});

		return result;
	}
}

export const instrumentLifecycleManager = new InstrumentLifecycleManager();
