// @ts-nocheck
/**
 * Nominee Enforcement Service (H-4)
 *
 * SEBI Circular SEBI/HO/IMD/IMD-II-DOF3/P/CIR/2022/0093 (June 2022) and
 * AMFI clarification (Oct 2022) require:
 *  - 100% of existing MF folios must have nominee OR explicit opt-out by March 2023
 *  - All new MF investments must collect nominee BEFORE transaction
 *
 * This service checks nominee status before allowing any MF/SIP order.
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";

export interface NomineeStatus {
	compliant: boolean;
	nomineeCount: number;
	hasOptedOut: boolean;
	blockingReason?: string;
}

class NomineeEnforcementService {
	/**
	 * Check if user is nominee-compliant before placing a MF/SIP/Bond order.
	 *
	 * Returns compliant=true if:
	 *  - User has at least 1 nominee declared, OR
	 *  - User has explicitly opted out of nominee (nomineeOptOut = true in userProfiles)
	 */
	async checkNomineeCompliance(userId: string): Promise<NomineeStatus> {
		try {
			// Check userProfiles for nominee opt-out flag
			const [profile] = await db
				.select({
					nomineeOptOut: schema.userProfiles.nomineeOptOut,
					nomineeCount: schema.userProfiles.nomineeCount,
				})
				.from(schema.userProfiles)
				.where(eq(schema.userProfiles.userId, userId))
				.limit(1);

			if (!profile) {
				return {
					compliant: false,
					nomineeCount: 0,
					hasOptedOut: false,
					blockingReason:
						"User profile not found. Please complete your profile before investing.",
				};
			}

			const count = profile.nomineeCount ?? 0;
			const optedOut = profile.nomineeOptOut ?? false;

			if (count > 0 || optedOut) {
				return { compliant: true, nomineeCount: count, hasOptedOut: optedOut };
			}

			return {
				compliant: false,
				nomineeCount: 0,
				hasOptedOut: false,
				blockingReason:
					"Please add a nominee or explicitly opt out of nomination before investing. Required under SEBI Circular SEBI/HO/IMD/IMD-II-DOF3/P/CIR/2022/0093.",
			};
		} catch (err) {
			logger.error("[NomineeEnforcement] Failed to check nominee status", {
				userId,
				err,
			});
			// Fail open — log but don't block (prevent system error from blocking genuine orders)
			return { compliant: true, nomineeCount: 0, hasOptedOut: false };
		}
	}

	/**
	 * Record nominee opt-out decision (user explicitly chose to not add nominee).
	 * Records timestamp and sets nomineeOptOut = true in userProfiles.
	 */
	async recordNomineeOptOut(userId: string, reason?: string): Promise<void> {
		await db
			.update(schema.userProfiles)
			.set({
				nomineeOptOut: true,
				nomineeOptOutAt: new Date(),
				nomineeOptOutReason: reason ?? "User chose to opt out",
				updatedAt: new Date(),
			})
			.where(eq(schema.userProfiles.userId, userId));
		logger.info("[NomineeEnforcement] Nominee opt-out recorded", { userId });
	}
}

export const nomineeEnforcementService = new NomineeEnforcementService();

// ── SCORES Grievance Service (H-3) ────────────────────────────────────────────

/**
 * SEBI SCORES (https://scores.sebi.gov.in) linkage + SmartODR (ODR portal)
 *
 * SEBI mandates all registered intermediaries to:
 *  1. Display SCORES link prominently
 *  2. Provide a structured internal grievance redressal with T+30 resolution
 *  3. Register on SmartODR for online dispute resolution
 *
 * Ref: SEBI Circular SEBI/HO/OIAE/IGRD/CIR/P/2023/156 (Sep 2023)
 */

export interface GrievanceSubmission {
	userId: string;
	category:
		| "kyc"
		| "transaction"
		| "payment"
		| "account"
		| "commission"
		| "other";
	subject: string;
	description: string;
	relatedOrderId?: string;
	relatedTransactionId?: string;
}

export interface GrievanceResult {
	ticketId: string;
	status: "submitted";
	expectedResolutionDate: Date;
	scoresLink: string;
	smartOdrLink: string;
}

class GrievanceService {
	private readonly SCORES_URL = "https://scores.sebi.gov.in";
	private readonly SMART_ODR_URL = "https://smartodr.in";
	private readonly RESOLUTION_DAYS = 30; // SEBI mandate: T+30

	async submitGrievance(
		submission: GrievanceSubmission,
	): Promise<GrievanceResult> {
		// Create support ticket in DB
		const ticketId = `GRV-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
		const expectedResolutionDate = new Date();
		expectedResolutionDate.setDate(
			expectedResolutionDate.getDate() + this.RESOLUTION_DAYS,
		);

		try {
			await db.insert(schema.supportTickets).values({
				id: ticketId,
				userId: submission.userId,
				category: submission.category,
				subject: submission.subject,
				description: submission.description,
				relatedOrderId: submission.relatedOrderId ?? null,
				status: "open",
				priority: "medium",
				expectedResolutionAt: expectedResolutionDate,
				source: "portal",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		} catch (err) {
			logger.error("[Grievance] Failed to create support ticket", {
				submission,
				err,
			});
			throw err;
		}

		// Notify compliance team via admin parallel notifier
		try {
			const { notifyGrievanceSubmitted } = await import(
				"./admin-parallel-notifier"
			);
			notifyGrievanceSubmitted({
				ticketId,
				userId: submission.userId,
				category: submission.category,
				subject: submission.subject,
				expectedResolutionDate,
			});
		} catch {
			/* non-fatal */
		}

		logger.info("[Grievance] Grievance submitted", {
			ticketId,
			userId: submission.userId,
			category: submission.category,
		});

		return {
			ticketId,
			status: "submitted",
			expectedResolutionDate,
			scoresLink: this.SCORES_URL,
			smartOdrLink: this.SMART_ODR_URL,
		};
	}

	/**
	 * Get SCORES and SmartODR links for display in UI.
	 * Required by SEBI to be prominently displayed on all intermediary platforms.
	 */
	getRegulatorLinks() {
		return {
			scores: {
				url: this.SCORES_URL,
				name: "SEBI SCORES",
				description:
					"SEBI Complaints Redress System — file complaints directly with SEBI",
			},
			smartOdr: {
				url: this.SMART_ODR_URL,
				name: "SmartODR",
				description:
					"SEBI Online Dispute Resolution platform for investment disputes",
			},
			amfi: {
				url: "https://www.amfiindia.com/investor-relations/complaint-registration",
				name: "AMFI Complaint Portal",
				description: "AMFI-registered distributor complaints",
			},
			sebi: {
				url: "https://www.sebi.gov.in",
				name: "SEBI",
				description: "Securities and Exchange Board of India",
			},
		};
	}
}

export const grievanceService = new GrievanceService();
