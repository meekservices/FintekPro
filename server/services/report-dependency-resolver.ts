import { db } from "../db";
import {
	proposalReportSections,
	proposalVerdicts,
	proposalSipRecommendations,
	investmentProposals,
	InsertProposalReportSection,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface ReportSectionDef {
	code: string;
	name: string;
	order: number;
	dependencies: string[];
	checkFn: (
		proposalId: string,
	) => Promise<{ met: boolean; reason?: string; missing?: string[] }>;
}

export interface ReportSectionStatus {
	code: string;
	name: string;
	order: number;
	dependencyMet: boolean;
	reason?: string;
	missingDependencies: string[];
	isEnabled: boolean;
	enabledByAgent: boolean;
	enabledByAi: boolean;
}

const SECTION_DEFINITIONS: ReportSectionDef[] = [
	{
		code: "executive_summary",
		name: "Executive Summary",
		order: 1,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
	{
		code: "client_profile",
		name: "Client Profile",
		order: 2,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
	{
		code: "risk_assessment",
		name: "Risk Assessment",
		order: 3,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
	{
		code: "current_portfolio",
		name: "Current Portfolio Analysis",
		order: 4,
		dependencies: ["portfolio_holdings"],
		checkFn: async (proposalId) => {
			const [proposal] = await db
				.select()
				.from(investmentProposals)
				.where(eq(investmentProposals.id, proposalId))
				.limit(1);

			const hasHoldings = proposal?.currentAllocation !== null;
			return {
				met: hasHoldings,
				reason: hasHoldings
					? undefined
					: "No current portfolio holdings available",
				missing: hasHoldings ? [] : ["portfolio_holdings"],
			};
		},
	},
	{
		code: "recommended_allocation",
		name: "Recommended Asset Allocation",
		order: 5,
		dependencies: ["target_allocation"],
		checkFn: async (proposalId) => {
			const [proposal] = await db
				.select()
				.from(investmentProposals)
				.where(eq(investmentProposals.id, proposalId))
				.limit(1);

			const hasTarget = proposal?.targetAllocation !== null;
			return {
				met: hasTarget,
				reason: hasTarget ? undefined : "No target allocation defined",
				missing: hasTarget ? [] : ["target_allocation"],
			};
		},
	},
	{
		code: "exit_load",
		name: "Exit Load Analysis",
		order: 6,
		dependencies: ["sell_verdicts"],
		checkFn: async (proposalId) => {
			const verdicts = await db
				.select()
				.from(proposalVerdicts)
				.where(
					and(
						eq(proposalVerdicts.proposalId, proposalId),
						eq(proposalVerdicts.verdict, "SELL"),
					),
				);

			const hasSells = verdicts.length > 0;
			return {
				met: hasSells,
				reason: hasSells ? undefined : "No SELL verdicts in proposal",
				missing: hasSells ? [] : ["sell_verdicts"],
			};
		},
	},
	{
		code: "capital_gains",
		name: "Capital Gains Summary",
		order: 7,
		dependencies: ["sell_verdicts", "holding_dates"],
		checkFn: async (proposalId) => {
			const verdicts = await db
				.select()
				.from(proposalVerdicts)
				.where(
					and(
						eq(proposalVerdicts.proposalId, proposalId),
						eq(proposalVerdicts.verdict, "SELL"),
					),
				);

			const hasSells = verdicts.length > 0;
			const hasGainsType = verdicts.some((v) => v.capitalGainsType !== null);

			return {
				met: hasSells && hasGainsType,
				reason: !hasSells
					? "No SELL verdicts"
					: !hasGainsType
						? "Holding dates not available for tax calculation"
						: undefined,
				missing: [
					...(!hasSells ? ["sell_verdicts"] : []),
					...(!hasGainsType ? ["holding_dates"] : []),
				],
			};
		},
	},
	{
		code: "tax_impact",
		name: "Tax Impact Analysis",
		order: 8,
		dependencies: ["exit_load_or_capital_gains"],
		checkFn: async (proposalId) => {
			const verdicts = await db
				.select()
				.from(proposalVerdicts)
				.where(eq(proposalVerdicts.proposalId, proposalId));

			const hasExitLoad = verdicts.some((v) => v.exitLoadApplicable);
			const hasCG = verdicts.some((v) => v.capitalGainsType !== null);
			const hasTaxData = hasExitLoad || hasCG;

			return {
				met: hasTaxData,
				reason: hasTaxData
					? undefined
					: "No exit load or capital gains data available",
				missing: hasTaxData ? [] : ["exit_load_or_capital_gains"],
			};
		},
	},
	{
		code: "sip_projection",
		name: "SIP Projection",
		order: 9,
		dependencies: ["sip_recommendations"],
		checkFn: async (proposalId) => {
			const sips = await db
				.select()
				.from(proposalSipRecommendations)
				.where(eq(proposalSipRecommendations.proposalId, proposalId));

			const hasSips = sips.length > 0;
			return {
				met: hasSips,
				reason: hasSips ? undefined : "No SIP recommendations in proposal",
				missing: hasSips ? [] : ["sip_recommendations"],
			};
		},
	},
	{
		code: "what_if_scenarios",
		name: "What-If Scenarios",
		order: 10,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
	{
		code: "fee_disclosure",
		name: "Fee Disclosure",
		order: 11,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
	{
		code: "terms_conditions",
		name: "Terms & Conditions",
		order: 12,
		dependencies: [],
		checkFn: async () => ({ met: true }),
	},
];

export class ReportDependencyResolver {
	static async resolveAllSections(
		proposalId: string,
	): Promise<ReportSectionStatus[]> {
		const results: ReportSectionStatus[] = [];

		for (const section of SECTION_DEFINITIONS) {
			const checkResult = await section.checkFn(proposalId);

			const existing = await db
				.select()
				.from(proposalReportSections)
				.where(
					and(
						eq(proposalReportSections.proposalId, proposalId),
						eq(proposalReportSections.sectionCode, section.code),
					),
				)
				.limit(1);

			const status: ReportSectionStatus = {
				code: section.code,
				name: section.name,
				order: section.order,
				dependencyMet: checkResult.met,
				reason: checkResult.reason,
				missingDependencies: checkResult.missing || [],
				isEnabled:
					existing.length > 0
						? existing[0].isEnabled ?? false
						: checkResult.met,
				enabledByAgent:
					existing.length > 0 ? existing[0].enabledByAgent ?? false : false,
				enabledByAi:
					existing.length > 0
						? existing[0].enabledByAi ?? false
						: checkResult.met,
			};

			if (existing.length > 0) {
				await db
					.update(proposalReportSections)
					.set({
						dependencyMet: checkResult.met,
						dependencyReason: checkResult.reason,
						missingDependencies: checkResult.missing || [],
						updatedAt: new Date(),
					})
					.where(eq(proposalReportSections.id, existing[0].id));
			} else {
				await db.insert(proposalReportSections).values({
					proposalId,
					sectionCode: section.code,
					sectionName: section.name,
					sectionOrder: section.order,
					dependencyMet: checkResult.met,
					dependencyReason: checkResult.reason,
					missingDependencies: checkResult.missing || [],
					isEnabled: checkResult.met,
					enabledByAgent: false,
					enabledByAi: checkResult.met,
				});
			}

			results.push(status);
		}

		return results.sort((a, b) => a.order - b.order);
	}

	static async toggleSection(
		proposalId: string,
		sectionCode: string,
		enabled: boolean,
		byAgent: boolean = true,
	): Promise<{ success: boolean; error?: string }> {
		const section = SECTION_DEFINITIONS.find((s) => s.code === sectionCode);
		if (!section) {
			return { success: false, error: `Unknown section: ${sectionCode}` };
		}

		if (enabled) {
			const checkResult = await section.checkFn(proposalId);
			if (!checkResult.met) {
				return {
					success: false,
					error: `Cannot enable section: ${checkResult.reason}. Missing: ${checkResult.missing?.join(", ")}`,
				};
			}
		}

		const existing = await db
			.select()
			.from(proposalReportSections)
			.where(
				and(
					eq(proposalReportSections.proposalId, proposalId),
					eq(proposalReportSections.sectionCode, sectionCode),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			await db
				.update(proposalReportSections)
				.set({
					isEnabled: enabled,
					enabledByAgent: byAgent,
					enabledByAi: !byAgent,
					updatedAt: new Date(),
				})
				.where(eq(proposalReportSections.id, existing[0].id));
		} else {
			await db.insert(proposalReportSections).values({
				proposalId,
				sectionCode: section.code,
				sectionName: section.name,
				sectionOrder: section.order,
				dependencyMet: true,
				isEnabled: enabled,
				enabledByAgent: byAgent,
				enabledByAi: !byAgent,
			});
		}

		return { success: true };
	}

	static async getEnabledSections(proposalId: string): Promise<string[]> {
		const sections = await db
			.select()
			.from(proposalReportSections)
			.where(
				and(
					eq(proposalReportSections.proposalId, proposalId),
					eq(proposalReportSections.isEnabled, true),
				),
			);

		return sections
			.sort((a, b) => (a.sectionOrder || 0) - (b.sectionOrder || 0))
			.map((s) => s.sectionCode);
	}

	static async autoSelectSections(proposalId: string): Promise<string[]> {
		const allSections =
			await ReportDependencyResolver.resolveAllSections(proposalId);
		const enabledSections: string[] = [];

		for (const section of allSections) {
			if (section.dependencyMet) {
				await ReportDependencyResolver.toggleSection(
					proposalId,
					section.code,
					true,
					false,
				);
				enabledSections.push(section.code);
			}
		}

		return enabledSections;
	}
}

console.log("✅ Report Dependency Resolver initialized");
