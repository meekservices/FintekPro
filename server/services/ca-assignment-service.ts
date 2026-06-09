import { db } from "../db";
import { eq, and, sql, gte, lte, inArray, desc, asc } from "drizzle-orm";
import { partners, agentItrCases, caProfiles } from "@shared/schema";

interface CAAssignmentCriteria {
	caseType: "itr" | "gst" | "audit" | "form15" | "tax_notice" | "company_law";
	itrFormType?: string;
	clientCity?: string;
	clientState?: string;
	priority?: "low" | "normal" | "high" | "urgent";
	estimatedComplexity?: "simple" | "moderate" | "complex";
}

interface CACandidate {
	id: string;
	name: string;
	icaiNumber: string;
	membershipType: string;
	specializations: string[];
	city: string;
	state: string;
	currentCases: number;
	maxCases: number;
	availabilityScore: number;
	matchScore: number;
	rating: number;
	responseTime: string;
	baseFee: number;
}

const SPECIALIZATION_MAPPING: Record<string, string[]> = {
	itr: ["itr_filing", "income_tax"],
	gst: ["gst", "indirect_tax"],
	audit: ["audit", "statutory_audit", "tax_audit"],
	form15: ["form15", "international_tax", "nri_taxation"],
	tax_notice: ["tax_notices", "assessment", "appeals"],
	company_law: ["company_law", "roc_compliance", "corporate"],
};

export class CAAssignmentService {
	async findBestCA(criteria: CAAssignmentCriteria): Promise<CACandidate[]> {
		const requiredSpecs = SPECIALIZATION_MAPPING[criteria.caseType] || [];

		const availableCAs = await db
			.select()
			.from(partners)
			.where(
				and(
					eq(partners.partnerType, "chartered_accountant"),
					eq(partners.isActive, true),
					eq(partners.isVerified, true),
					eq(partners.caVerificationStatus, "verified"),
					eq(partners.caAvailability, "available"),
				),
			);

		const candidates: CACandidate[] = [];

		for (const ca of availableCAs) {
			const specializations = ca.caSpecializations || [];
			const currentCases = ca.caCurrentActiveCases || 0;
			const maxCases = ca.caMaxCasesPerMonth || 50;

			if (currentCases >= maxCases) continue;

			const hasRequiredSpec = requiredSpecs.some((spec) =>
				specializations.includes(spec),
			);
			if (!hasRequiredSpec && requiredSpecs.length > 0) continue;

			let matchScore = 0;

			const specMatchCount = requiredSpecs.filter((spec) =>
				specializations.includes(spec),
			).length;
			matchScore += specMatchCount * 20;

			if (criteria.clientState && ca.caState === criteria.clientState) {
				matchScore += 15;
				if (criteria.clientCity && ca.caCity === criteria.clientCity) {
					matchScore += 10;
				}
			}

			const availabilityRatio = (maxCases - currentCases) / maxCases;
			const availabilityScore = Math.round(availabilityRatio * 100);
			matchScore += availabilityScore * 0.3;

			const rating = Number.parseFloat(ca.caAverageRating || "4.0");
			matchScore += rating * 5;

			if (ca.icaiMembershipType === "FCA") {
				matchScore += 10;
			}

			const responseTimeBonus: Record<string, number> = {
				"4h": 15,
				"12h": 10,
				"24h": 5,
				"48h": 0,
			};
			matchScore += responseTimeBonus[ca.caResponseTime || "24h"] || 0;

			let baseFee = 0;
			if (criteria.caseType === "itr" && criteria.itrFormType) {
				const feeField =
					`baseFeeItr${criteria.itrFormType.replace("ITR-", "")}` as keyof typeof ca;
				baseFee = 0;
			}

			candidates.push({
				id: ca.id,
				name: ca.companyName,
				icaiNumber: ca.icaiMembershipNumber || "",
				membershipType: ca.icaiMembershipType || "ACA",
				specializations,
				city: ca.caCity || "",
				state: ca.caState || "",
				currentCases,
				maxCases,
				availabilityScore,
				matchScore: Math.round(matchScore),
				rating,
				responseTime: ca.caResponseTime || "24h",
				baseFee,
			});
		}

		candidates.sort((a, b) => b.matchScore - a.matchScore);

		return candidates.slice(0, 5);
	}

	async assignCAToCaseFromPartners(
		caseId: string,
		caPartnerId: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			const [ca] = await db
				.select()
				.from(partners)
				.where(
					and(
						eq(partners.id, caPartnerId),
						eq(partners.partnerType, "chartered_accountant"),
						eq(partners.caVerificationStatus, "verified"),
					),
				)
				.limit(1);

			if (!ca) {
				return { success: false, message: "CA not found or not verified" };
			}

			const currentCases = ca.caCurrentActiveCases || 0;
			const maxCases = ca.caMaxCasesPerMonth || 50;

			if (currentCases >= maxCases) {
				return {
					success: false,
					message: "CA has reached maximum case capacity",
				};
			}

			await db.transaction(async (tx) => {
				await tx
					.update(agentItrCases)
					.set({
						status: "ca_assigned",
						updatedAt: new Date(),
					})
					.where(eq(agentItrCases.id, caseId));

				await tx
					.update(partners)
					.set({
						caCurrentActiveCases: currentCases + 1,
						updatedAt: new Date(),
					})
					.where(eq(partners.id, caPartnerId));
			});

			return { success: true, message: "CA assigned successfully" };
		} catch (error) {
			console.error("Error assigning CA:", error);
			return { success: false, message: "Failed to assign CA" };
		}
	}

	async autoAssignCA(
		caseId: string,
		criteria: CAAssignmentCriteria,
	): Promise<{ success: boolean; assignedCA?: CACandidate; message: string }> {
		const candidates = await this.findBestCA(criteria);

		if (candidates.length === 0) {
			return {
				success: false,
				message: "No available CA found matching the criteria",
			};
		}

		const bestCA = candidates[0];
		const result = await this.assignCAToCaseFromPartners(caseId, bestCA.id);

		if (result.success) {
			return {
				success: true,
				assignedCA: bestCA,
				message: "CA auto-assigned successfully",
			};
		}

		for (let i = 1; i < candidates.length; i++) {
			const fallbackResult = await this.assignCAToCaseFromPartners(
				caseId,
				candidates[i].id,
			);
			if (fallbackResult.success) {
				return {
					success: true,
					assignedCA: candidates[i],
					message: "CA auto-assigned successfully (fallback)",
				};
			}
		}

		return { success: false, message: "Failed to assign any available CA" };
	}

	async getCACaseload(caPartnerId: string): Promise<{
		activeCases: number;
		completedThisMonth: number;
		pendingReview: number;
		avgCompletionTime: number;
	}> {
		const [ca] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, caPartnerId))
			.limit(1);

		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);

		return {
			activeCases: ca?.caCurrentActiveCases || 0,
			completedThisMonth: ca?.caCompletedCases || 0,
			pendingReview: 0,
			avgCompletionTime: 3,
		};
	}

	async markCaseCompleted(
		caseId: string,
		caPartnerId: string,
	): Promise<{ success: boolean }> {
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(agentItrCases)
					.set({
						status: "completed",
						completedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(agentItrCases.id, caseId));

				const [ca] = await tx
					.select()
					.from(partners)
					.where(eq(partners.id, caPartnerId))
					.limit(1);

				if (ca) {
					await tx
						.update(partners)
						.set({
							caCurrentActiveCases: Math.max(
								0,
								(ca.caCurrentActiveCases || 0) - 1,
							),
							caCompletedCases: (ca.caCompletedCases || 0) + 1,
							updatedAt: new Date(),
						})
						.where(eq(partners.id, caPartnerId));
				}
			});

			return { success: true };
		} catch (error) {
			console.error("Error marking case completed:", error);
			return { success: false };
		}
	}

	async updateCARating(caPartnerId: string, rating: number): Promise<void> {
		const [ca] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, caPartnerId))
			.limit(1);

		if (!ca) return;

		const currentRating = Number.parseFloat(ca.caAverageRating || "5.0");
		const totalRatings = ca.caTotalRatings || 0;

		const newTotalRatings = totalRatings + 1;
		const newAverageRating =
			(currentRating * totalRatings + rating) / newTotalRatings;

		await db
			.update(partners)
			.set({
				caAverageRating: newAverageRating.toFixed(2),
				caTotalRatings: newTotalRatings,
				updatedAt: new Date(),
			})
			.where(eq(partners.id, caPartnerId));
	}

	async getCADashboardStats(caPartnerId: string): Promise<{
		activeCases: number;
		completedCases: number;
		pendingCases: number;
		avgRating: number;
		totalEarnings: number;
		thisMonthEarnings: number;
		casesByType: Record<string, number>;
	}> {
		const [ca] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, caPartnerId))
			.limit(1);

		return {
			activeCases: ca?.caCurrentActiveCases || 0,
			completedCases: ca?.caCompletedCases || 0,
			pendingCases: 0,
			avgRating: Number.parseFloat(ca?.caAverageRating || "5.0"),
			totalEarnings: Number.parseFloat(ca?.totalCommissionsEarned || "0"),
			thisMonthEarnings: 0,
			casesByType: {
				itr: 0,
				gst: 0,
				audit: 0,
				form15: 0,
			},
		};
	}
}

export const caAssignmentService = new CAAssignmentService();
