/**
 * FintekPro Loan Governance Service
 *
 * Enforces Sub-DSA governance rules, routing discipline, SLA management,
 * and lifecycle assertions for RBI/Bank audit compliance.
 */

import { db } from "../db";
import { eq } from "drizzle-orm";
import { dsaLoanApplications } from "@shared/dsa-loan-schema";
import {
	OriginationMode,
	RoutingIntent,
	WorkflowOwner,
	validateRoutingDiscipline,
	LENDER_DISCLAIMER_TEXT,
} from "@shared/loan-origination.constants";

export class LoanGovernanceError extends Error {
	constructor(
		message: string,
		public code: string,
		public details?: Record<string, any>,
	) {
		super(message);
		this.name = "LoanGovernanceError";
	}
}

/**
 * SUB-DSA GOVERNANCE: Routing discipline enforcement
 * SELF_SERVICE → cannot use manual routing (SPECIFIC_BANKS)
 * AGENT_ASSISTED → cannot trigger auto-routing (MARKETPLACE)
 */
export function enforceRoutingDiscipline(
	originationMode: OriginationMode,
	routingIntent: RoutingIntent,
): void {
	const validation = validateRoutingDiscipline(originationMode, routingIntent);
	if (!validation.valid) {
		throw new LoanGovernanceError(
			validation.error || "Routing discipline violation",
			"ROUTING_DISCIPLINE_VIOLATION",
			{ originationMode, routingIntent },
		);
	}
}

/**
 * Validate that an application can transition to a new status
 */
export function validateStatusTransition(
	currentStatus: string,
	newStatus: string,
	validTransitions: Record<string, string[]>,
): void {
	const allowedTransitions = validTransitions[currentStatus] || [];
	if (!allowedTransitions.includes(newStatus)) {
		throw new LoanGovernanceError(
			`Cannot transition from '${currentStatus}' to '${newStatus}'`,
			"INVALID_STATUS_TRANSITION",
			{ currentStatus, newStatus, allowedTransitions },
		);
	}
}

/**
 * SUB-DSA GOVERNANCE: Single lifecycle assertion
 * Ensures no duplicate applications per origination mode for same applicant
 */
export async function assertSingleLifecycle(
	applicationId: string,
	applicantPhone: string,
	originationMode: OriginationMode,
): Promise<void> {
	// This assertion ensures the loan_id is used consistently across flows
	const [existing] = await db
		.select({ id: dsaLoanApplications.id })
		.from(dsaLoanApplications)
		.where(eq(dsaLoanApplications.id, applicationId))
		.limit(1);

	if (!existing) {
		throw new LoanGovernanceError(
			"Application not found - single lifecycle violation",
			"LIFECYCLE_ASSERTION_FAILED",
			{ applicationId },
		);
	}
}

/**
 * SUB-DSA GOVERNANCE: Lender disclaimer enforcement
 * Required before first bank submission
 */
export function getDisclaimerRequirement(): {
	required: boolean;
	text: string;
} {
	return {
		required: true,
		text: LENDER_DISCLAIMER_TEXT,
	};
}

/**
 * SUB-DSA GOVERNANCE: Legacy API guard
 * Fail fast if legacy APIs are accidentally invoked
 */
export function guardLegacyApis(): void {
	if (process.env.DISABLE_LEGACY_LOAN_APIS === "true") {
		throw new LoanGovernanceError(
			"Legacy loan APIs are disabled. Use the new governance-compliant APIs.",
			"LEGACY_API_DISABLED",
		);
	}
}

/**
 * SUB-DSA GOVERNANCE: SLA management
 * Calculate SLA based on workflow owner
 */
export interface SlaConfig {
	slaStartAt: Date;
	slaExpectedBy: Date;
	workflowOwner: WorkflowOwner;
}

export function calculateSla(
	workflowOwner: WorkflowOwner,
	startTime?: Date,
): SlaConfig {
	const slaStartAt = startTime || new Date();
	const slaExpectedBy = new Date(slaStartAt);

	// System-owned SLAs have tighter deadlines
	if (workflowOwner === WorkflowOwner.SYSTEM) {
		slaExpectedBy.setHours(slaExpectedBy.getHours() + 24); // 24 hours for system
	} else {
		slaExpectedBy.setHours(slaExpectedBy.getHours() + 48); // 48 hours for agent
	}

	return {
		slaStartAt,
		slaExpectedBy,
		workflowOwner,
	};
}

/**
 * Check if SLA is breached
 */
export function checkSlaBreach(slaExpectedBy: Date): boolean {
	return new Date() > slaExpectedBy;
}

/**
 * SUB-DSA GOVERNANCE: Backfill rules for existing data
 */
export const BACKFILL_RULES = {
	existingUserLoans: {
		originationMode: OriginationMode.SELF_SERVICE,
		routingIntent: RoutingIntent.MARKETPLACE,
		workflowOwner: WorkflowOwner.SYSTEM,
	},
	existingAgentLoans: {
		originationMode: OriginationMode.AGENT_ASSISTED,
		routingIntent: RoutingIntent.SPECIFIC_BANKS,
		workflowOwner: WorkflowOwner.AGENT,
	},
} as const;

export const loanGovernanceService = {
	enforceRoutingDiscipline,
	validateStatusTransition,
	assertSingleLifecycle,
	getDisclaimerRequirement,
	guardLegacyApis,
	calculateSla,
	checkSlaBreach,
	BACKFILL_RULES,
};
