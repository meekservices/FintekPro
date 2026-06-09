import {
	ckycProviderResolutionService,
	ProviderResolutionResult,
} from "./ckyc-provider-resolution-service";
import { ckycDeferredService } from "./ckyc-deferred-service";
import {
	ckycEnvironmentService,
	CkycComplianceError,
} from "./ckyc-environment-service";
import { db } from "../db";
import { ckycDeferredCases } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface CkycOrchestratorContext {
	userId: string;
	panNumber: string;
	userFullName?: string;
	email?: string;
	phone?: string;
}

export interface CkycProviderResult {
	status: "success" | "deferred" | "error";
	providerId?: string;
	providerName?: string;
	ckycNumber?: string;
	deferralCode?: string;
	deferralMessage?: string;
	slaDeadline?: Date;
	fallbackAttempts?: Array<{
		provider: string;
		failedAt: string;
		reason: string;
	}>;
}

class CkycOrchestratorService {
	/**
	 * Main entry point for CKYC verification
	 * Resolves provider, handles fallbacks, creates deferred cases when exhausted
	 */
	async initiateVerification(
		context: CkycOrchestratorContext,
	): Promise<CkycProviderResult> {
		console.log(
			`[CKYC Orchestrator] Initiating verification for PAN: ${context.panNumber.slice(0, 4)}***`,
		);

		// Check if user already has an active deferred case
		const existingDeferred = await this.checkExistingDeferredCase(
			context.userId,
		);
		if (existingDeferred) {
			console.log(
				`[CKYC Orchestrator] User has existing deferred case: ${existingDeferred.id}`,
			);
			return {
				status: "deferred",
				deferralCode: existingDeferred.deferralCode,
				deferralMessage:
					existingDeferred.deferralMessage ||
					"CKYC verification is pending admin review",
				slaDeadline: new Date(existingDeferred.slaDeadline),
				fallbackAttempts: existingDeferred.fallbackAttempts as any,
			};
		}

		// Resolve provider using fallback chain
		const resolution = await ckycProviderResolutionService.resolveProvider(
			context.panNumber,
			context.userId,
		);

		// Handle deferred status - all providers exhausted
		if (
			resolution.status === "deferred" ||
			resolution.selectedProvider === "none"
		) {
			return await this.handleProviderExhaustion(context, resolution);
		}

		// Provider available - return for caller to execute
		return {
			status: "success",
			providerId: resolution.selectedProvider,
			providerName: this.getProviderDisplayName(resolution.selectedProvider),
			fallbackAttempts: resolution.fallbackAttempts,
		};
	}

	/**
	 * Handle case when all CKYC providers are exhausted
	 */
	private async handleProviderExhaustion(
		context: CkycOrchestratorContext,
		resolution: ProviderResolutionResult,
	): Promise<CkycProviderResult> {
		console.log(
			`[CKYC Orchestrator] All providers exhausted for user ${context.userId}`,
		);

		const slaDeadline = ckycEnvironmentService.calculateSlaDeadline();
		const deferralCode = resolution.deferralCode || "ALL_PROVIDERS_EXHAUSTED";
		const deferralMessage =
			resolution.deferralReason ||
			"All automated CKYC verification methods have been exhausted. Your case has been escalated to our compliance team for manual review.";

		try {
			// Create deferred case in database
			const [deferredCase] = await db
				.insert(ckycDeferredCases)
				.values({
					userId: context.userId,
					panNumber: context.panNumber,
					status: "ckyc_deferred",
					deferralCode,
					deferralMessage,
					lastProviderAttempted:
						resolution.fallbackAttempts?.slice(-1)[0]?.provider || "unknown",
					fallbackAttempts: resolution.fallbackAttempts || [],
					slaStartedAt: new Date(),
					slaDeadline,
					slaBreach: false,
					agingBucket: "<24h",
					escalationLevel: 0,
				})
				.returning();

			console.log(
				`[CKYC Orchestrator] Created deferred case: ${deferredCase.id}`,
			);

			// Log compliance event
			console.log(
				`[CKYC COMPLIANCE] DEFERRED: User ${context.userId}, Case ${deferredCase.id}, Code: ${deferralCode}`,
			);

			return {
				status: "deferred",
				deferralCode,
				deferralMessage,
				slaDeadline,
				fallbackAttempts: resolution.fallbackAttempts,
			};
		} catch (error) {
			console.error(
				`[CKYC Orchestrator] Failed to create deferred case:`,
				error,
			);
			throw new CkycComplianceError(
				"DEFERRED_CASE_CREATION_FAILED",
				"Failed to escalate CKYC case. Please try again or contact support.",
			);
		}
	}

	/**
	 * Check if user already has an active deferred case
	 */
	private async checkExistingDeferredCase(userId: string): Promise<any | null> {
		try {
			const [existingCase] = await db
				.select()
				.from(ckycDeferredCases)
				.where(eq(ckycDeferredCases.userId, userId))
				.limit(1);

			// Only return if case is still pending/in-review
			if (
				existingCase &&
				["ckyc_deferred", "manual_review_in_progress"].includes(
					existingCase.status,
				)
			) {
				return existingCase;
			}
			return null;
		} catch (error) {
			console.error(
				`[CKYC Orchestrator] Error checking existing deferred case:`,
				error,
			);
			return null;
		}
	}

	/**
	 * Check if user has a blocking deferred case (for transaction blocking)
	 */
	async hasBlockingDeferredCase(userId: string): Promise<boolean> {
		const existingCase = await this.checkExistingDeferredCase(userId);
		return existingCase !== null;
	}

	/**
	 * Get user-friendly provider name
	 */
	private getProviderDisplayName(providerId: string): string {
		const names: Record<string, string> = {
			truthscreen: "TruthScreen CKYC",
			cersai: "CERSAI Registry",
			authbridge: "TruthScreen CKYC",
			offline_aadhaar: "Offline Aadhaar Verification",
			vkyc: "Video KYC",
			manual: "Manual Document Upload",
		};
		return names[providerId] || providerId;
	}

	/**
	 * Record a successful CKYC completion and close any deferred case
	 */
	async recordVerificationSuccess(
		userId: string,
		ckycNumber: string,
		providerId: string,
	): Promise<void> {
		console.log(
			`[CKYC Orchestrator] Recording success for user ${userId}, CKYC: ${ckycNumber}`,
		);

		// Close any existing deferred case
		await db
			.update(ckycDeferredCases)
			.set({
				status: "resolved",
				resolvedAt: new Date(),
				resolutionMethod: `auto_${providerId}`,
				resolutionNotes: `CKYC completed via ${providerId}. CKYC Number: ${ckycNumber}`,
			})
			.where(eq(ckycDeferredCases.userId, userId));
	}

	/**
	 * Record a provider failure for fallback tracking
	 */
	async recordProviderFailure(
		userId: string,
		providerId: string,
		reason: string,
	): Promise<void> {
		console.log(
			`[CKYC Orchestrator] Provider ${providerId} failed for user ${userId}: ${reason}`,
		);
		// Provider resolution service tracks these internally
		// This method allows external callers to record failures
	}
}

export const ckycOrchestratorService = new CkycOrchestratorService();
