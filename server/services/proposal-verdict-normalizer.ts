// @ts-nocheck
import { db } from "../db";
import {
	proposalVerdicts,
	investmentProposals,
	InsertProposalVerdict,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export type Verdict = "BUY" | "HOLD" | "SELL";

export interface VerdictAssignment {
	instrumentType: string;
	instrumentIsin?: string;
	instrumentCode?: string;
	instrumentName: string;
	verdict: Verdict;
	rationale: string;
	currentValue?: number;
	targetValue?: number;
	exitLoadApplicable?: boolean;
	exitLoadPercent?: number;
	capitalGainsType?: "STCG" | "LTCG" | "nil";
	estimatedTax?: number;
}

export interface VerdictValidation {
	valid: boolean;
	totalInstruments: number;
	withVerdict: number;
	withoutVerdict: number;
	instrumentsMissing: string[];
	errors: string[];
}

export interface VerdictSummary {
	proposalId: string;
	buyCount: number;
	holdCount: number;
	sellCount: number;
	buyTotal: number;
	holdTotal: number;
	sellTotal: number;
	exitLoadImpact: number;
	taxImpact: number;
	verdicts: VerdictAssignment[];
}

const VALID_VERDICTS: Verdict[] = ["BUY", "HOLD", "SELL"];

export class ProposalVerdictNormalizer {
	static validateVerdict(verdict: string): verdict is Verdict {
		return VALID_VERDICTS.includes(verdict as Verdict);
	}

	static async assignVerdict(
		proposalId: string,
		assignment: VerdictAssignment,
	): Promise<{ success: boolean; error?: string }> {
		if (!ProposalVerdictNormalizer.validateVerdict(assignment.verdict)) {
			return {
				success: false,
				error: `Invalid verdict: ${assignment.verdict}. Must be BUY, HOLD, or SELL.`,
			};
		}

		const existing = await db
			.select()
			.from(proposalVerdicts)
			.where(
				and(
					eq(proposalVerdicts.proposalId, proposalId),
					eq(proposalVerdicts.instrumentName, assignment.instrumentName),
				),
			)
			.limit(1);

		const changeAmount =
			assignment.targetValue && assignment.currentValue
				? assignment.targetValue - assignment.currentValue
				: null;
		const changePercent =
			changeAmount && assignment.currentValue
				? (changeAmount / assignment.currentValue) * 100
				: null;

		const values: Partial<InsertProposalVerdict> = {
			proposalId,
			instrumentType: assignment.instrumentType,
			instrumentIsin: assignment.instrumentIsin,
			instrumentCode: assignment.instrumentCode,
			instrumentName: assignment.instrumentName,
			verdict: assignment.verdict,
			verdictRationale: assignment.rationale,
			aiGenerated: false,
			agentOverridden: existing.length > 0,
			currentValue: assignment.currentValue
				? String(assignment.currentValue)
				: null,
			targetValue: assignment.targetValue
				? String(assignment.targetValue)
				: null,
			changeAmount: changeAmount ? String(changeAmount) : null,
			changePercent: changePercent ? String(changePercent) : null,
			exitLoadApplicable: assignment.exitLoadApplicable || false,
			exitLoadPercent: assignment.exitLoadPercent
				? String(assignment.exitLoadPercent)
				: null,
			capitalGainsType: assignment.capitalGainsType,
			estimatedTax: assignment.estimatedTax
				? String(assignment.estimatedTax)
				: null,
			updatedAt: new Date(),
		};

		if (existing.length > 0) {
			await db
				.update(proposalVerdicts)
				.set(values)
				.where(eq(proposalVerdicts.id, existing[0].id));
		} else {
			await db.insert(proposalVerdicts).values(values as InsertProposalVerdict);
		}

		return { success: true };
	}

	static async bulkAssignVerdicts(
		proposalId: string,
		assignments: VerdictAssignment[],
	): Promise<{ success: boolean; assigned: number; errors: string[] }> {
		const errors: string[] = [];
		let assigned = 0;

		for (const assignment of assignments) {
			const result = await ProposalVerdictNormalizer.assignVerdict(
				proposalId,
				assignment,
			);
			if (result.success) {
				assigned++;
			} else {
				errors.push(`${assignment.instrumentName}: ${result.error}`);
			}
		}

		return { success: errors.length === 0, assigned, errors };
	}

	static async validateProposalVerdicts(
		proposalId: string,
	): Promise<VerdictValidation> {
		const [proposal] = await db
			.select()
			.from(investmentProposals)
			.where(eq(investmentProposals.id, proposalId))
			.limit(1);

		if (!proposal) {
			return {
				valid: false,
				totalInstruments: 0,
				withVerdict: 0,
				withoutVerdict: 0,
				instrumentsMissing: [],
				errors: ["Proposal not found"],
			};
		}

		const recommendations = (proposal.recommendations as any[]) || [];
		const verdicts = await db
			.select()
			.from(proposalVerdicts)
			.where(eq(proposalVerdicts.proposalId, proposalId));

		const instrumentNames = recommendations.map(
			(r: any) => r.instrumentName || r.productName,
		);
		const verdictNames = verdicts.map((v) => v.instrumentName);

		const instrumentsMissing = instrumentNames.filter(
			(name) => !verdictNames.includes(name),
		);

		const invalidVerdicts = verdicts.filter(
			(v) => !ProposalVerdictNormalizer.validateVerdict(v.verdict!),
		);
		const errors: string[] = invalidVerdicts.map(
			(v) => `Invalid verdict '${v.verdict}' for ${v.instrumentName}`,
		);

		if (instrumentsMissing.length > 0) {
			errors.push(`${instrumentsMissing.length} instruments missing verdicts`);
		}

		return {
			valid: instrumentsMissing.length === 0 && invalidVerdicts.length === 0,
			totalInstruments: instrumentNames.length,
			withVerdict: verdicts.length,
			withoutVerdict: instrumentsMissing.length,
			instrumentsMissing,
			errors,
		};
	}

	static async getVerdictSummary(proposalId: string): Promise<VerdictSummary> {
		const verdicts = await db
			.select()
			.from(proposalVerdicts)
			.where(eq(proposalVerdicts.proposalId, proposalId));

		const buyVerdicts = verdicts.filter((v) => v.verdict === "BUY");
		const holdVerdicts = verdicts.filter((v) => v.verdict === "HOLD");
		const sellVerdicts = verdicts.filter((v) => v.verdict === "SELL");

		const sumTargetValue = (items: any[]) =>
			items.reduce(
				(sum, v) => sum + Number.parseFloat(v.targetValue || "0"),
				0,
			);

		const exitLoadImpact = sellVerdicts.reduce((sum, v) => {
			if (v.exitLoadApplicable) {
				const value = Number.parseFloat(v.currentValue?.toString() || "0");
				const percent = Number.parseFloat(v.exitLoadPercent?.toString() || "0");
				return sum + (value * percent) / 100;
			}
			return sum;
		}, 0);

		const taxImpact = sellVerdicts.reduce(
			(sum, v) => sum + Number.parseFloat(v.estimatedTax?.toString() || "0"),
			0,
		);

		return {
			proposalId,
			buyCount: buyVerdicts.length,
			holdCount: holdVerdicts.length,
			sellCount: sellVerdicts.length,
			buyTotal: sumTargetValue(buyVerdicts),
			holdTotal: sumTargetValue(holdVerdicts),
			sellTotal: sumTargetValue(sellVerdicts),
			exitLoadImpact,
			taxImpact,
			verdicts: verdicts.map((v) => ({
				instrumentType: v.instrumentType,
				instrumentIsin: v.instrumentIsin || undefined,
				instrumentCode: v.instrumentCode || undefined,
				instrumentName: v.instrumentName,
				verdict: v.verdict as Verdict,
				rationale: v.verdictRationale || "",
				currentValue: Number.parseFloat(v.currentValue?.toString() || "0"),
				targetValue: Number.parseFloat(v.targetValue?.toString() || "0"),
				exitLoadApplicable: v.exitLoadApplicable || false,
				exitLoadPercent: Number.parseFloat(
					v.exitLoadPercent?.toString() || "0",
				),
				capitalGainsType: v.capitalGainsType as
					| "STCG"
					| "LTCG"
					| "nil"
					| undefined,
				estimatedTax: Number.parseFloat(v.estimatedTax?.toString() || "0"),
			})),
		};
	}

	static async blockIfIncomplete(
		proposalId: string,
	): Promise<{ blocked: boolean; reason?: string }> {
		const validation =
			await ProposalVerdictNormalizer.validateProposalVerdicts(proposalId);

		if (!validation.valid) {
			return {
				blocked: true,
				reason:
					validation.instrumentsMissing.length > 0
						? `Assign verdicts to: ${validation.instrumentsMissing.join(", ")}`
						: validation.issues.join(", "),
			};
		}

		return { blocked: false };
	}

	// ============================================================================
	// AI ALLOCATION OVERRIDE PREVENTION (Epic 6)
	// ============================================================================

	static async validateAllocationOverride(
		proposalId: string,
		proposedAllocation: { assetClass: string; weight: number }[],
		agentId: string,
	): Promise<{ allowed: boolean; reason?: string; blocked: boolean }> {
		const { proposalVersions } = await import("@shared/schema");
		const { desc, and, eq } = await import("drizzle-orm");

		const [lockedVersion] = await db
			.select()
			.from(proposalVersions)
			.where(
				and(
					eq(proposalVersions.proposalId, proposalId),
					eq(proposalVersions.strategyLocked, true),
				),
			)
			.orderBy(desc(proposalVersions.versionNumber))
			.limit(1);

		if (!lockedVersion || !lockedVersion.strategyLocked) {
			return { allowed: true, blocked: false };
		}

		const lockedSnapshot = lockedVersion.strategySnapshot as any;
		if (!lockedSnapshot?.assetAllocation) {
			return { allowed: true, blocked: false };
		}

		const lockedAllocation: { assetClass: string; weight: number }[] =
			lockedSnapshot.assetAllocation;
		const drifts: string[] = [];

		for (const proposed of proposedAllocation) {
			const locked = lockedAllocation.find(
				(a) => a.assetClass === proposed.assetClass,
			);
			if (!locked) {
				drifts.push(
					`New asset class '${proposed.assetClass}' not in locked strategy`,
				);
				continue;
			}
			if (Math.abs(proposed.weight - locked.weight) > 0.01) {
				drifts.push(
					`${proposed.assetClass}: locked=${locked.weight}%, proposed=${proposed.weight}%`,
				);
			}
		}

		for (const locked of lockedAllocation) {
			if (!proposedAllocation.find((p) => p.assetClass === locked.assetClass)) {
				drifts.push(
					`Missing locked asset class '${locked.assetClass}' (${locked.weight}%)`,
				);
			}
		}

		if (drifts.length > 0) {
			await db.insert(agentComplianceAuditLogs).values({
				agentId,
				actionCategory: "proposal",
				actionType: "ai_allocation_override_blocked",
				actionDescription: `Blocked AI allocation override attempt on locked strategy v${lockedVersion.versionNumber}`,
				previousState: { lockedAllocation },
				newState: { proposedAllocation, drifts },
				complianceRelevant: true,
			});

			return {
				allowed: false,
				blocked: true,
				reason: `Strategy is locked (v${lockedVersion.versionNumber}). Cannot override allocation. Drifts detected: ${drifts.join("; ")}. Create a new version to change allocation.`,
			};
		}

		return { allowed: true, blocked: false };
	}
}

console.log("✅ Proposal Verdict Normalizer initialized");
