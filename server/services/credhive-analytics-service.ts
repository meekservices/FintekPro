/**
 * CredHive Analytics Service
 *
 * Provides lead prospecting intelligence and smart lead scoring
 * powered entirely by CredHive company data.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { and, gte, isNotNull, desc } from "drizzle-orm";
import { credhiveService } from "./credhive-service";

export interface ProspectingAlert {
	id: string;
	cin: string | null;
	companyName: string;
	leadScore: number;
	leadQuality: string | null;
	annualRevenue: number | null;
	netProfit: number | null;
	priority: "high" | "medium" | "low";
	reason: string;
}

export interface SmartLeadScore {
	cin: string;
	totalScore: number;
	leadGrade: "hot" | "warm" | "cold";
	breakdown: {
		financialStrength: number;
		complianceHealth: number;
		directorProfile: number;
	};
}

export interface ProspectingThresholds {
	minRevenue?: number;
	minProfit?: number;
	minLeadScore?: number;
}

export class CredhiveAnalyticsService {
	/**
	 * Check prospect leads against financial thresholds and return alerts
	 * for leads that qualify as high-value prospects.
	 */
	async checkProspectingThresholds(
		thresholds: ProspectingThresholds,
	): Promise<ProspectingAlert[]> {
		try {
			const leads = await db
				.select()
				.from(prospectLeads)
				.where(isNotNull(prospectLeads.cin))
				.orderBy(desc(prospectLeads.leadScore))
				.limit(200);

			const alerts: ProspectingAlert[] = [];

			for (const lead of leads) {
				const revenue = lead.annualRevenue
					? Number.parseFloat(String(lead.annualRevenue))
					: null;
				const profit = lead.netProfit
					? Number.parseFloat(String(lead.netProfit))
					: null;
				const score = lead.leadScore ?? 0;

				const meetsRevenue =
					!thresholds.minRevenue ||
					(revenue && revenue >= thresholds.minRevenue);
				const meetsProfit =
					!thresholds.minProfit || (profit && profit >= thresholds.minProfit);
				const meetsScore =
					!thresholds.minLeadScore || score >= thresholds.minLeadScore;

				if (meetsRevenue && meetsProfit && meetsScore) {
					const priority: "high" | "medium" | "low" =
						lead.leadQuality === "hot"
							? "high"
							: lead.leadQuality === "warm"
								? "medium"
								: "low";

					alerts.push({
						id: lead.id,
						cin: lead.cin,
						companyName: lead.companyName,
						leadScore: score,
						leadQuality: lead.leadQuality,
						annualRevenue: revenue,
						netProfit: profit,
						priority,
						reason: `Score: ${score} | Quality: ${lead.leadQuality} | Revenue: ₹${revenue ? (revenue / 1_00_00_000).toFixed(1) + "Cr" : "N/A"}`,
					});
				}
			}

			return alerts;
		} catch (error: any) {
			console.error(
				"[CredhiveAnalytics] checkProspectingThresholds error:",
				error.message,
			);
			return [];
		}
	}

	/**
	 * Calculate a smart lead score for a company by CIN using CredHive data.
	 * Returns null if insufficient data is available.
	 */
	async calculateSmartLeadScore(cin: string): Promise<SmartLeadScore | null> {
		try {
			const profileResult = await credhiveService.getCompanyDetails(cin);
			if (!profileResult.success || !profileResult.data) return null;

			const company = profileResult.data as any;

			const financialStrength = this.scoreFinancialStrength(company);
			const complianceHealth = this.scoreComplianceHealth(company);
			const directorProfile = this.scoreDirectorProfile(company);

			const totalScore = Math.round(
				financialStrength * 0.4 +
					complianceHealth * 0.35 +
					directorProfile * 0.25,
			);

			const leadGrade: "hot" | "warm" | "cold" =
				totalScore >= 65 ? "hot" : totalScore >= 35 ? "warm" : "cold";

			return {
				cin,
				totalScore,
				leadGrade,
				breakdown: { financialStrength, complianceHealth, directorProfile },
			};
		} catch (error: any) {
			console.error(
				`[CredhiveAnalytics] calculateSmartLeadScore error for ${cin}:`,
				error.message,
			);
			return null;
		}
	}

	private scoreFinancialStrength(company: any): number {
		let score = 50;
		const financials = company.financials?.[0];
		if (!financials) return score;
		if (financials.revenue > 10_00_00_000) score += 20;
		else if (financials.revenue > 1_00_00_000) score += 10;
		if (financials.netProfit > 0) score += 15;
		if (
			financials.debtToEquityRatio != null &&
			financials.debtToEquityRatio < 1
		)
			score += 15;
		return Math.min(100, score);
	}

	private scoreComplianceHealth(company: any): number {
		let score = 70;
		if (company.status !== "Active") score -= 30;
		if (company.openChargesCount > 5) score -= 15;
		if (company.activeLegalCases > 0) score -= 20;
		return Math.max(0, score);
	}

	private scoreDirectorProfile(company: any): number {
		const directorCount = Array.isArray(company.directors)
			? company.directors.length
			: 0;
		if (directorCount === 0) return 40;
		if (directorCount >= 3) return 80;
		return 60;
	}
}

let instance: CredhiveAnalyticsService | null = null;

export function getCredhiveAnalyticsService(): CredhiveAnalyticsService {
	if (!instance) instance = new CredhiveAnalyticsService();
	return instance;
}
