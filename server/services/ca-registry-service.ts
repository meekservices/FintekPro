/**
 * FintekPro CA Registry Service
 *
 * Maintains a local cache of verified ICAI membership records to:
 *  1. Eliminate repeat API calls for known members (Layer 1 lookup)
 *  2. Power the CA discovery marketplace (find CA by city/specialization)
 *  3. Support the CA tier system (Bronze → Silver → Gold → Elite)
 *  4. Manage annual revalidation scheduling
 *
 * Verification chain: Registry (free) → Surepass → Karza → ICAI scraper
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, lt, and, sql } from "drizzle-orm";
import { logger } from "../logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CaRegistryEntry {
	icaiMembershipNumber: string;
	nameAtIcai?: string;
	membershipType?: string; // ACA | FCA
	membershipStatus?: string; // ACTIVE | INACTIVE
	copStatus?: string;
	verifiedBy: string; // surepass | karza | icai_scraper | admin
	confidenceScore?: number; // 0–1
	rawResponse?: Record<string, any>; // sanitised API response for audit
	// Optional profile extras (from partner onboarding)
	city?: string;
	state?: string;
	specializations?: string[];
	experienceYears?: number;
	firmName?: string;
	userId?: string;
	partnersTableId?: string;
}

export type CaTier = "bronze" | "silver" | "gold" | "elite";

// ─── Tier Computation ─────────────────────────────────────────────────────────

function computeTier(entry: {
	membershipType?: string | null;
	experienceYears?: number | null;
	totalCasesCompleted?: number | null;
	averageRating?: string | null;
	firmName?: string | null;
}): CaTier {
	const years = entry.experienceYears ?? 0;
	const cases = entry.totalCasesCompleted ?? 0;
	const rating = Number.parseFloat(entry.averageRating ?? "0");
	const isFca = entry.membershipType === "FCA";
	const hasFirm = !!entry.firmName;

	if (isFca && years >= 10 && hasFirm && cases >= 100) return "elite";
	if (isFca && years >= 5 && rating >= 4.5 && cases >= 50) return "gold";
	if (years >= 2 && cases >= 20) return "silver";
	return "bronze";
}

// ─── Referral Code Generator ──────────────────────────────────────────────────

function generateReferralCode(icaiNumber: string): string {
	// Format: CA-XXXXXX-YYYY (ICAI digits + 4 random chars)
	const digits = icaiNumber.replace(/\D/g, "").slice(-6).padStart(6, "0");
	const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
	return `CA-${digits}-${suffix}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const caRegistryService = {
	/**
	 * Layer 1: Look up an ICAI number in the local registry.
	 * Returns the entry if found AND last revalidated within 12 months.
	 * Returns null if not found or stale (let caller hit Surepass/Karza).
	 */
	async lookupFromRegistry(
		icaiNumber: string,
	): Promise<schema.FintekproCaRegistry | null> {
		const normalized = icaiNumber.trim().toUpperCase();
		try {
			const [entry] = await db
				.select()
				.from(schema.fintekproCaRegistry)
				.where(eq(schema.fintekproCaRegistry.icaiMembershipNumber, normalized))
				.limit(1);

			if (!entry) return null;

			// Treat as stale if nextRevalidationDue is past
			if (entry.nextRevalidationDue && new Date() > entry.nextRevalidationDue) {
				logger.info(
					"[CARegistry] Entry found but revalidation due — treating as stale",
					{ icaiNumber: normalized },
				);
				return null;
			}

			logger.info("[CARegistry] Cache hit", {
				icaiNumber: normalized,
				status: entry.membershipStatus,
				tier: entry.tier,
				isFintekProPartner: entry.isFintekProPartner,
			});
			return entry;
		} catch (err) {
			logger.warn("[CARegistry] Lookup failed (non-fatal)", {
				icaiNumber: normalized,
				err,
			});
			return null;
		}
	},

	/**
	 * Upsert an ICAI verification result into the local registry.
	 * Called after every successful Surepass/Karza/scraper verification.
	 * If the record already exists, only updates ICAI fields — does NOT overwrite
	 * partner profile data (city, specializations, etc.) set during onboarding.
	 */
	async upsertToRegistry(entry: CaRegistryEntry): Promise<void> {
		const {
			icaiMembershipNumber,
			nameAtIcai,
			membershipType,
			membershipStatus,
			copStatus,
			verifiedBy,
			confidenceScore,
			rawResponse,
			city,
			state,
			specializations,
			experienceYears,
			firmName,
			userId,
			partnersTableId,
		} = entry;

		const normalized = icaiMembershipNumber.trim().toUpperCase();
		const now = new Date();
		const nextRevalidation = new Date(
			now.getTime() + 365 * 24 * 60 * 60 * 1000,
		); // +12 months
		const referralCode = generateReferralCode(normalized);

		// Compute tier from available fields
		const tier = computeTier({ membershipType, experienceYears, firmName });

		// Sanitise rawResponse — strip any full Aadhaar / passwords before storing
		const safeResponse = rawResponse
			? (({ password, aadhaar, ...rest }) => rest)(rawResponse as any)
			: undefined;

		try {
			await db
				.insert(schema.fintekproCaRegistry)
				.values({
					icaiMembershipNumber: normalized,
					nameAtIcai,
					membershipType,
					membershipStatus,
					copStatus,
					isFintekProPartner: !!(userId || partnersTableId),
					partnersTableId: partnersTableId ?? null,
					userId: userId ?? null,
					firmName: firmName ?? null,
					city: city ?? null,
					state: state ?? null,
					specializations: specializations ?? null,
					experienceYears: experienceYears ?? null,
					tier,
					referralCode,
					verifiedAt: now,
					verifiedBy,
					confidenceScore:
						confidenceScore !== undefined ? String(confidenceScore) : null,
					verificationSource: verifiedBy,
					rawVerificationResponse: safeResponse ?? null,
					lastRevalidatedAt: now,
					nextRevalidationDue: nextRevalidation,
					revalidationStatus: "ok",
					source: userId ? "self_registered" : "auto_cache",
					isPubliclyListed: !!(userId || partnersTableId),
				})
				.onConflictDoUpdate({
					target: schema.fintekproCaRegistry.icaiMembershipNumber,
					set: {
						// ICAI data fields — always refresh from API
						nameAtIcai,
						membershipType,
						membershipStatus,
						copStatus,
						// Verification audit
						verifiedAt: now,
						verifiedBy,
						confidenceScore:
							confidenceScore !== undefined
								? String(confidenceScore)
								: sql`confidence_score`,
						verificationSource: verifiedBy,
						rawVerificationResponse:
							safeResponse ?? sql`raw_verification_response`,
						// Revalidation scheduling
						lastRevalidatedAt: now,
						nextRevalidationDue: nextRevalidation,
						revalidationStatus: "ok",
						revalidationFailureCount: 0,
						// Update tier (recomputed on every upsert)
						tier,
						// Link to partner/user if now available (don't overwrite with null)
						...(userId && { userId, isFintekProPartner: true }),
						...(partnersTableId && {
							partnersTableId,
							isFintekProPartner: true,
						}),
						...(city && { city }),
						...(state && { state }),
						...(specializations && { specializations }),
						...(experienceYears && { experienceYears }),
						...(firmName && { firmName }),
						updatedAt: now,
					},
				});

			logger.info("[CARegistry] Upserted", {
				icaiNumber: normalized,
				status: membershipStatus,
				tier,
				verifiedBy,
			});
		} catch (err) {
			// Non-fatal — don't block the main verification response
			logger.warn("[CARegistry] Upsert failed (non-fatal)", {
				icaiNumber: normalized,
				err,
			});
		}
	},

	/**
	 * Annual revalidation cron batch.
	 * Returns all registry entries where nextRevalidationDue < now.
	 * Caller (cron-compliance.ts) triggers re-verification via Surepass.
	 */
	async getExpiredRegistryEntries(
		limit = 50,
	): Promise<schema.FintekproCaRegistry[]> {
		try {
			return await db
				.select()
				.from(schema.fintekproCaRegistry)
				.where(lt(schema.fintekproCaRegistry.nextRevalidationDue, new Date()))
				.limit(limit);
		} catch (err) {
			logger.warn("[CARegistry] getExpiredRegistryEntries failed", { err });
			return [];
		}
	},

	/**
	 * Mark a registry entry as revalidation-failed (e.g. Surepass returned error).
	 * After 3 failures, suspends the entry.
	 */
	async markRevalidationFailed(icaiNumber: string): Promise<void> {
		const normalized = icaiNumber.trim().toUpperCase();
		try {
			// Increment failure count; suspend after 3
			await db.execute(sql`
        UPDATE fintekpro_ca_registry
        SET revalidation_failure_count = revalidation_failure_count + 1,
            revalidation_status = CASE
              WHEN revalidation_failure_count + 1 >= 3 THEN 'suspended'
              ELSE 'failed'
            END,
            updated_at = NOW()
        WHERE icai_membership_number = ${normalized}
      `);
		} catch (err) {
			logger.warn("[CARegistry] markRevalidationFailed error", {
				icaiNumber: normalized,
				err,
			});
		}
	},

	/**
	 * Link a registry entry to a user/partner after they complete full onboarding.
	 * Also marks isPubliclyListed = true for discovery marketplace.
	 */
	async linkPartner(
		icaiNumber: string,
		params: {
			userId: string;
			partnersTableId: string;
			city?: string;
			state?: string;
			specializations?: string[];
			experienceYears?: number;
			firmName?: string;
			maxCasesPerMonth?: number;
			responseTimeHours?: number;
		},
	): Promise<void> {
		const normalized = icaiNumber.trim().toUpperCase();
		const tier = computeTier({
			membershipType: undefined, // will be fetched from registry if needed
			experienceYears: params.experienceYears,
			firmName: params.firmName,
		});
		try {
			await db
				.update(schema.fintekproCaRegistry)
				.set({
					userId: params.userId,
					partnersTableId: params.partnersTableId,
					isFintekProPartner: true,
					isPubliclyListed: true,
					listedAt: new Date(),
					city: params.city ?? undefined,
					state: params.state ?? undefined,
					specializations: params.specializations ?? undefined,
					experienceYears: params.experienceYears ?? undefined,
					firmName: params.firmName ?? undefined,
					maxCasesPerMonth: params.maxCasesPerMonth ?? undefined,
					responseTimeHours: params.responseTimeHours ?? undefined,
					tier,
					source: "self_registered",
					updatedAt: new Date(),
				})
				.where(eq(schema.fintekproCaRegistry.icaiMembershipNumber, normalized));

			logger.info("[CARegistry] Linked to partner", {
				icaiNumber: normalized,
				userId: params.userId,
			});
		} catch (err) {
			logger.warn("[CARegistry] linkPartner failed", {
				icaiNumber: normalized,
				err,
			});
		}
	},

	/**
	 * Redeem a referral code — increments the referrer's count.
	 * Call when a new CA joins using a referral link.
	 */
	async redeemReferralCode(
		code: string,
	): Promise<{ referrerId: string } | null> {
		try {
			const [referrer] = await db
				.select({
					id: schema.fintekproCaRegistry.id,
					userId: schema.fintekproCaRegistry.userId,
				})
				.from(schema.fintekproCaRegistry)
				.where(
					eq(
						schema.fintekproCaRegistry.referralCode,
						code.trim().toUpperCase(),
					),
				)
				.limit(1);

			if (!referrer) return null;

			await db.execute(sql`
        UPDATE fintekpro_ca_registry
        SET referral_count = referral_count + 1, updated_at = NOW()
        WHERE id = ${referrer.id}
      `);

			return { referrerId: referrer.userId ?? referrer.id };
		} catch (err) {
			logger.warn("[CARegistry] redeemReferralCode failed", { code, err });
			return null;
		}
	},

	/**
	 * Discovery: Find CAs available for assignment (for marketplace + auto-assign).
	 */
	async findAvailableCAs(params: {
		city?: string;
		state?: string;
		specialization?: string;
		tier?: CaTier;
		limit?: number;
	}): Promise<schema.FintekproCaRegistry[]> {
		try {
			const results = await db
				.select()
				.from(schema.fintekproCaRegistry)
				.where(
					and(
						eq(schema.fintekproCaRegistry.isFintekProPartner, true),
						eq(schema.fintekproCaRegistry.isPubliclyListed, true),
						eq(schema.fintekproCaRegistry.membershipStatus, "ACTIVE"),
						eq(schema.fintekproCaRegistry.availability, "available"),
					),
				)
				.limit(params.limit ?? 20);

			// Post-filter for city/state/specialization (jsonb contains check is complex in drizzle ORM)
			return results.filter((ca) => {
				if (params.city && ca.city?.toLowerCase() !== params.city.toLowerCase())
					return false;
				if (
					params.state &&
					ca.state?.toLowerCase() !== params.state.toLowerCase()
				)
					return false;
				if (params.tier && ca.tier !== params.tier) return false;
				if (params.specialization) {
					const specs = (ca.specializations as string[]) ?? [];
					if (
						!specs.some((s) =>
							s.toLowerCase().includes(params.specialization!.toLowerCase()),
						)
					)
						return false;
				}
				return true;
			});
		} catch (err) {
			logger.warn("[CARegistry] findAvailableCAs failed", { err });
			return [];
		}
	},
};
