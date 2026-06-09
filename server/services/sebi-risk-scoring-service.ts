// @ts-nocheck
/**
 * SEBI-Aligned Risk Scoring Service
 * Implements regulatory-compliant risk profiling with:
 * - 5-tier risk taxonomy (RP1-RP5)
 * - Weighted category scoring
 * - Mandatory SEBI overrides
 * - Product suitability hard gates
 * - AI dynamic re-scoring integration
 */

import { db } from "../db";
import {
	sebiRiskProfilesMaster,
	sebiQuestionnaireVersions,
	sebiQuestionnaireCategories,
	sebiQuestionnaireQuestions,
	sebiQuestionnaireOptions,
	sebiClientRiskAssessments,
	sebiProductSuitabilityMatrix,
	sebiAiRiskRecommendations,
	sebiRiskAuditLogs,
	sebiGoalRiskProfiles,
	users,
	userProfiles,
} from "@shared/schema";
import type {
	SebiRiskProfileMaster,
	SebiClientRiskAssessment,
	SebiProductSuitabilityMatrix,
	SebiAiRiskRecommendation,
	InsertSebiClientRiskAssessment,
	InsertSebiRiskAuditLog,
} from "@shared/schema";
import { eq, and, desc, gte, lte, isNull, sql } from "drizzle-orm";

// Risk Profile Code to Score Range Mapping
const PROFILE_SCORE_RANGES: Record<
	string,
	{ min: number; max: number; name: string; band: string }
> = {
	RP1: { min: 0, max: 30, name: "Conservative", band: "very_low" },
	RP2: {
		min: 31,
		max: 45,
		name: "Moderately Conservative",
		band: "low_moderate",
	},
	RP3: { min: 46, max: 60, name: "Moderate", band: "moderate" },
	RP4: {
		min: 61,
		max: 75,
		name: "Moderately Aggressive",
		band: "moderate_high",
	},
	RP5: { min: 76, max: 100, name: "Aggressive", band: "high" },
};

// Default Questionnaire Categories with SEBI-mandated weights
const DEFAULT_CATEGORIES = [
	{ code: "age", name: "Age & Life Stage", weight: 15 },
	{ code: "income_stability", name: "Income Stability", weight: 20 },
	{ code: "net_worth", name: "Net Worth & Surplus", weight: 20 },
	{ code: "horizon", name: "Investment Horizon", weight: 20 },
	{ code: "risk_tolerance", name: "Risk Tolerance (Behavioral)", weight: 15 },
	{ code: "experience", name: "Market Experience", weight: 10 },
];

// Default Questions (SEBI-aligned sample)
const DEFAULT_QUESTIONS = [
	// Age Category
	{
		categoryCode: "age",
		questionCode: "Q_AGE_01",
		questionText: "What is your age?",
		type: "single_choice",
		options: [
			{ code: "A", text: "Below 30 years", score: 5 },
			{ code: "B", text: "30-45 years", score: 4 },
			{ code: "C", text: "45-60 years", score: 2 },
			{ code: "D", text: "Above 60 years", score: 1 },
		],
	},
	// Income Stability Category
	{
		categoryCode: "income_stability",
		questionCode: "Q_INCOME_01",
		questionText: "How would you describe your income source?",
		type: "single_choice",
		options: [
			{
				code: "A",
				text: "Fixed salary with emergency fund (6+ months)",
				score: 5,
			},
			{ code: "B", text: "Fixed salary without emergency fund", score: 3 },
			{ code: "C", text: "Variable income (business/freelance)", score: 3 },
			{ code: "D", text: "Unstable/dependent on others", score: 1 },
		],
	},
	// Net Worth Category
	{
		categoryCode: "net_worth",
		questionCode: "Q_NETWORTH_01",
		questionText:
			"What is your approximate net worth (assets minus liabilities)?",
		type: "single_choice",
		options: [
			{ code: "A", text: "Above ₹5 Crore", score: 5 },
			{ code: "B", text: "₹1-5 Crore", score: 4 },
			{ code: "C", text: "₹25 Lakh - 1 Crore", score: 3 },
			{ code: "D", text: "₹5-25 Lakh", score: 2 },
			{ code: "E", text: "Below ₹5 Lakh", score: 1 },
		],
	},
	// Investment Horizon Category
	{
		categoryCode: "horizon",
		questionCode: "Q_HORIZON_01",
		questionText: "What is your investment time horizon?",
		type: "single_choice",
		options: [
			{ code: "A", text: "More than 10 years", score: 5 },
			{ code: "B", text: "7-10 years", score: 5 },
			{ code: "C", text: "5-7 years", score: 4 },
			{ code: "D", text: "3-5 years", score: 3 },
			{ code: "E", text: "1-3 years", score: 2 },
			{ code: "F", text: "Less than 1 year", score: 1 },
		],
	},
	// Risk Tolerance (Behavioral) Category
	{
		categoryCode: "risk_tolerance",
		questionCode: "Q_RISK_01",
		questionText: "If your portfolio falls 20% in 6 months, you would:",
		type: "single_choice",
		options: [
			{ code: "A", text: "Invest more to average down", score: 5 },
			{ code: "B", text: "Hold and wait for recovery", score: 3 },
			{ code: "C", text: "Exit immediately to avoid further losses", score: 1 },
		],
	},
	{
		categoryCode: "risk_tolerance",
		questionCode: "Q_RISK_02",
		questionText: "Which best describes your attitude towards investment risk?",
		type: "single_choice",
		options: [
			{
				code: "A",
				text: "I can tolerate high fluctuations for potentially higher returns",
				score: 5,
			},
			{
				code: "B",
				text: "I prefer moderate risk with balanced returns",
				score: 3,
			},
			{ code: "C", text: "I want safety even if returns are lower", score: 1 },
		],
	},
	// Market Experience Category
	{
		categoryCode: "experience",
		questionCode: "Q_EXP_01",
		questionText: "How many years of investment experience do you have?",
		type: "single_choice",
		options: [
			{ code: "A", text: "More than 10 years", score: 5 },
			{ code: "B", text: "5-10 years", score: 4 },
			{ code: "C", text: "Less than 3 years", score: 2 },
			{ code: "D", text: "No experience", score: 1 },
		],
	},
];

interface CategoryScore {
	categoryCode: string;
	categoryName: string;
	weight: number;
	rawScore: number;
	maxPossibleScore: number;
	weightedScore: number;
}

interface AnswerInput {
	questionId: string;
	questionCode: string;
	optionId: string;
	optionCode: string;
	score: number;
}

interface ScoreCalculationResult {
	rawScore: number;
	adjustedScore: number;
	profileCode: string;
	profileName: string;
	hasOverride: boolean;
	overrideType?: string;
	overrideReason?: string;
	originalProfileCode?: string;
	categoryScores: CategoryScore[];
}

interface ProductEligibility {
	productType: string;
	productLabel: string;
	isEligible: boolean;
	reason?: string;
}

interface SEBIOverrideCheck {
	shouldOverride: boolean;
	overrideType?: string;
	overrideReason?: string;
	targetProfileCode?: string;
}

class SEBIRiskScoringService {
	/**
	 * Calculate risk score from questionnaire answers
	 * Implements weighted scoring with SEBI-mandated overrides
	 */
	async calculateRiskScore(
		answers: AnswerInput[],
		clientInfo: {
			age?: number;
			hasEmergencyFund?: boolean;
			liabilitiesToIncomeRatio?: number;
			investmentHorizonYears?: number;
		},
	): Promise<ScoreCalculationResult> {
		// Get active questionnaire version
		const version = await this.getActiveQuestionnaireVersion();
		if (!version) {
			throw new Error("No active questionnaire version found");
		}

		// Get categories with weights
		const categories = await db
			.select()
			.from(sebiQuestionnaireCategories)
			.where(
				and(
					eq(sebiQuestionnaireCategories.versionId, version.id),
					eq(sebiQuestionnaireCategories.isActive, true),
				),
			);

		// If no database categories, use defaults
		const categoryWeights =
			categories.length > 0
				? categories.reduce(
						(acc, cat) => {
							acc[cat.categoryCode] = {
								name: cat.categoryName,
								weight: Number.parseFloat(cat.weightPercentage || "0"),
							};
							return acc;
						},
						{} as Record<string, { name: string; weight: number }>,
					)
				: DEFAULT_CATEGORIES.reduce(
						(acc, cat) => {
							acc[cat.code] = { name: cat.name, weight: cat.weight };
							return acc;
						},
						{} as Record<string, { name: string; weight: number }>,
					);

		// Group answers by category and calculate scores
		const categoryScores: CategoryScore[] = [];
		let totalWeightedScore = 0;
		let totalWeight = 0;

		for (const [catCode, catInfo] of Object.entries(categoryWeights)) {
			const categoryAnswers = answers.filter((a) => {
				// Match answer's question to category
				const question = DEFAULT_QUESTIONS.find(
					(q) => q.questionCode === a.questionCode,
				);
				return question?.categoryCode === catCode;
			});

			if (categoryAnswers.length === 0) continue;

			const rawScore = categoryAnswers.reduce((sum, a) => sum + a.score, 0);
			const maxPossible = categoryAnswers.length * 5; // Max score per question is 5
			const normalizedScore = (rawScore / maxPossible) * 100;
			const weightedScore = (normalizedScore * catInfo.weight) / 100;

			categoryScores.push({
				categoryCode: catCode,
				categoryName: catInfo.name,
				weight: catInfo.weight,
				rawScore,
				maxPossibleScore: maxPossible,
				weightedScore,
			});

			totalWeightedScore += weightedScore;
			totalWeight += catInfo.weight;
		}

		// Normalize if weights don't sum to 100
		const rawScore =
			totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;

		// Map score to profile
		let profileCode = this.scoreToProfileCode(rawScore);
		let adjustedScore = rawScore;
		let hasOverride = false;
		let overrideType: string | undefined;
		let overrideReason: string | undefined;
		let originalProfileCode: string | undefined;

		// Apply SEBI mandatory overrides
		const overrideCheck = this.checkSEBIOverrides(clientInfo, profileCode);
		if (overrideCheck.shouldOverride) {
			originalProfileCode = profileCode;
			profileCode = overrideCheck.targetProfileCode!;
			hasOverride = true;
			overrideType = overrideCheck.overrideType;
			overrideReason = overrideCheck.overrideReason;
			adjustedScore = PROFILE_SCORE_RANGES[profileCode].max;
		}

		return {
			rawScore: Math.round(rawScore * 100) / 100,
			adjustedScore: Math.round(adjustedScore * 100) / 100,
			profileCode,
			profileName: PROFILE_SCORE_RANGES[profileCode]?.name || "Unknown",
			hasOverride,
			overrideType,
			overrideReason,
			originalProfileCode,
			categoryScores,
		};
	}

	/**
	 * Map numerical score to risk profile code
	 */
	private scoreToProfileCode(score: number): string {
		if (score <= 30) return "RP1";
		if (score <= 45) return "RP2";
		if (score <= 60) return "RP3";
		if (score <= 75) return "RP4";
		return "RP5";
	}

	/**
	 * Check SEBI mandatory override rules
	 */
	private checkSEBIOverrides(
		clientInfo: {
			age?: number;
			hasEmergencyFund?: boolean;
			liabilitiesToIncomeRatio?: number;
			investmentHorizonYears?: number;
		},
		currentProfileCode: string,
	): SEBIOverrideCheck {
		// Rule 1: Age > 60 AND horizon < 3 years → Force Conservative
		if (
			clientInfo.age &&
			clientInfo.age > 60 &&
			clientInfo.investmentHorizonYears &&
			clientInfo.investmentHorizonYears < 3
		) {
			if (["RP3", "RP4", "RP5"].includes(currentProfileCode)) {
				return {
					shouldOverride: true,
					overrideType: "age_horizon",
					overrideReason:
						"SEBI Mandate: Clients above 60 years with investment horizon less than 3 years must be classified as Conservative or Moderately Conservative for capital protection.",
					targetProfileCode: "RP1",
				};
			}
		}

		// Rule 2: No emergency fund AND aggressive answers → Force downgrade
		if (clientInfo.hasEmergencyFund === false) {
			if (["RP4", "RP5"].includes(currentProfileCode)) {
				return {
					shouldOverride: true,
					overrideType: "no_emergency_fund",
					overrideReason:
						"SEBI Mandate: Clients without an emergency fund cannot be classified as Moderately Aggressive or Aggressive due to liquidity risk.",
					targetProfileCode: "RP3",
				};
			}
		}

		// Rule 3: High liabilities to income ratio → Force downgrade
		if (
			clientInfo.liabilitiesToIncomeRatio &&
			clientInfo.liabilitiesToIncomeRatio > 0.5
		) {
			if (["RP4", "RP5"].includes(currentProfileCode)) {
				return {
					shouldOverride: true,
					overrideType: "high_liabilities",
					overrideReason:
						"SEBI Mandate: Clients with liabilities exceeding 50% of income must have reduced risk exposure for financial stability.",
					targetProfileCode: "RP2",
				};
			}
		}

		return { shouldOverride: false };
	}

	/**
	 * Save client risk assessment to database
	 */
	async saveAssessment(
		userId: string,
		pan: string,
		scoreResult: ScoreCalculationResult,
		answers: AnswerInput[],
		context: {
			assessmentType?: string;
			triggerEvent?: string;
			assessedBy?: string;
			assessorRole?: string;
			clientIp?: string;
		} = {},
	): Promise<SebiClientRiskAssessment> {
		const version = await this.getActiveQuestionnaireVersion();
		if (!version) {
			throw new Error("No active questionnaire version found");
		}

		// Get profile ID from master table
		const [profile] = await db
			.select()
			.from(sebiRiskProfilesMaster)
			.where(eq(sebiRiskProfilesMaster.profileCode, scoreResult.profileCode))
			.limit(1);

		// Calculate expiry date (1 year from now)
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + 1);

		// Mark any existing active assessments as superseded
		await db
			.update(sebiClientRiskAssessments)
			.set({ status: "superseded", updatedAt: new Date() })
			.where(
				and(
					eq(sebiClientRiskAssessments.userId, userId),
					eq(sebiClientRiskAssessments.status, "active"),
				),
			);

		// Insert new assessment
		const [assessment] = await db
			.insert(sebiClientRiskAssessments)
			.values({
				userId,
				pan,
				questionnaireVersionId: version.id,
				rawScore: String(scoreResult.rawScore),
				adjustedScore: String(scoreResult.adjustedScore),
				profileId: profile?.id || "default",
				profileCode: scoreResult.profileCode,
				hasOverride: scoreResult.hasOverride,
				overrideReason: scoreResult.overrideReason,
				overrideType: scoreResult.overrideType,
				originalProfileCode: scoreResult.originalProfileCode,
				categoryScores: scoreResult.categoryScores,
				answers,
				assessmentType: context.assessmentType || "initial",
				triggerEvent: context.triggerEvent,
				status: "active",
				expiresAt,
				nextReviewDate: expiresAt,
				clientConsentAt: new Date(),
				clientConsentIp: context.clientIp,
				assessedBy: context.assessedBy,
				assessorRole: context.assessorRole,
			})
			.returning();

		// Log audit trail
		await this.logAuditEvent({
			userId,
			assessmentId: assessment.id,
			action: "assessment_completed",
			actionCategory: "assessment",
			actorId: context.assessedBy || userId,
			actorRole: context.assessorRole || "client",
			newValue: {
				profileCode: scoreResult.profileCode,
				rawScore: scoreResult.rawScore,
				adjustedScore: scoreResult.adjustedScore,
				hasOverride: scoreResult.hasOverride,
			},
			questionnaireVersion: version.versionNumber,
		});

		return assessment;
	}

	/**
	 * Get client's current active risk assessment
	 */
	async getActiveAssessment(
		userId: string,
	): Promise<SebiClientRiskAssessment | null> {
		const [assessment] = await db
			.select()
			.from(sebiClientRiskAssessments)
			.where(
				and(
					eq(sebiClientRiskAssessments.userId, userId),
					eq(sebiClientRiskAssessments.status, "active"),
				),
			)
			.orderBy(desc(sebiClientRiskAssessments.createdAt))
			.limit(1);

		return assessment || null;
	}

	/**
	 * Get client's risk assessment by PAN
	 */
	async getAssessmentByPAN(
		pan: string,
	): Promise<SebiClientRiskAssessment | null> {
		const [assessment] = await db
			.select()
			.from(sebiClientRiskAssessments)
			.where(
				and(
					eq(sebiClientRiskAssessments.pan, pan),
					eq(sebiClientRiskAssessments.status, "active"),
				),
			)
			.orderBy(desc(sebiClientRiskAssessments.createdAt))
			.limit(1);

		return assessment || null;
	}

	/**
	 * Check product eligibility based on risk profile (HARD GATE)
	 */
	async checkProductEligibility(
		profileCode: string,
		productType: string,
	): Promise<ProductEligibility> {
		const [matrix] = await db
			.select()
			.from(sebiProductSuitabilityMatrix)
			.where(
				and(
					eq(sebiProductSuitabilityMatrix.productType, productType),
					eq(sebiProductSuitabilityMatrix.isActive, true),
				),
			)
			.limit(1);

		if (!matrix) {
			// No matrix entry means no restrictions (default allow)
			return {
				productType,
				productLabel: productType,
				isEligible: true,
			};
		}

		// Check eligibility based on profile code
		let isEligible = false;
		switch (profileCode) {
			case "RP1":
				isEligible = matrix.allowedRP1 || false;
				break;
			case "RP2":
				isEligible = matrix.allowedRP2 || false;
				break;
			case "RP3":
				isEligible = matrix.allowedRP3 || false;
				break;
			case "RP4":
				isEligible = matrix.allowedRP4 || false;
				break;
			case "RP5":
				isEligible = matrix.allowedRP5 || false;
				break;
		}

		return {
			productType,
			productLabel: matrix.productTypeLabel,
			isEligible,
			reason: isEligible
				? undefined
				: `${matrix.productTypeLabel} is not suitable for ${PROFILE_SCORE_RANGES[profileCode]?.name || profileCode} risk profile as per SEBI suitability guidelines.`,
		};
	}

	/**
	 * Get all product eligibility for a profile (for product pages)
	 */
	async getProductEligibilityMatrix(
		profileCode: string,
	): Promise<ProductEligibility[]> {
		const matrix = await db
			.select()
			.from(sebiProductSuitabilityMatrix)
			.where(eq(sebiProductSuitabilityMatrix.isActive, true))
			.orderBy(sebiProductSuitabilityMatrix.sortOrder);

		return matrix.map((m) => {
			let isEligible = false;
			switch (profileCode) {
				case "RP1":
					isEligible = m.allowedRP1 || false;
					break;
				case "RP2":
					isEligible = m.allowedRP2 || false;
					break;
				case "RP3":
					isEligible = m.allowedRP3 || false;
					break;
				case "RP4":
					isEligible = m.allowedRP4 || false;
					break;
				case "RP5":
					isEligible = m.allowedRP5 || false;
					break;
			}

			return {
				productType: m.productType,
				productLabel: m.productTypeLabel,
				isEligible,
				reason: isEligible
					? undefined
					: `Not suitable for ${PROFILE_SCORE_RANGES[profileCode]?.name} profile`,
			};
		});
	}

	/**
	 * Check if client needs annual revalidation
	 */
	async needsRevalidation(userId: string): Promise<boolean> {
		const assessment = await this.getActiveAssessment(userId);
		if (!assessment) return true;

		const now = new Date();
		return assessment.expiresAt ? new Date(assessment.expiresAt) <= now : false;
	}

	/**
	 * Get active questionnaire version
	 */
	async getActiveQuestionnaireVersion() {
		const [version] = await db
			.select()
			.from(sebiQuestionnaireVersions)
			.where(
				and(
					eq(sebiQuestionnaireVersions.isActive, true),
					isNull(sebiQuestionnaireVersions.effectiveTo),
				),
			)
			.orderBy(desc(sebiQuestionnaireVersions.effectiveFrom))
			.limit(1);

		return version || null;
	}

	/**
	 * Get questionnaire with questions for assessment
	 */
	async getQuestionnaire() {
		const version = await this.getActiveQuestionnaireVersion();

		// If no version in DB, return default questions
		if (!version) {
			return {
				version: {
					versionNumber: "v1.0",
					versionName: "Default SEBI Questionnaire",
				},
				categories: DEFAULT_CATEGORIES.map((cat) => ({
					...cat,
					questions: DEFAULT_QUESTIONS.filter(
						(q) => q.categoryCode === cat.code,
					).map((q) => ({
						...q,
						options: q.options,
					})),
				})),
			};
		}

		// Get categories
		const categories = await db
			.select()
			.from(sebiQuestionnaireCategories)
			.where(
				and(
					eq(sebiQuestionnaireCategories.versionId, version.id),
					eq(sebiQuestionnaireCategories.isActive, true),
				),
			)
			.orderBy(sebiQuestionnaireCategories.sortOrder);

		// Get questions for each category
		const result = await Promise.all(
			categories.map(async (cat) => {
				const questions = await db
					.select()
					.from(sebiQuestionnaireQuestions)
					.where(
						and(
							eq(sebiQuestionnaireQuestions.categoryId, cat.id),
							eq(sebiQuestionnaireQuestions.isActive, true),
						),
					)
					.orderBy(sebiQuestionnaireQuestions.sortOrder);

				const questionsWithOptions = await Promise.all(
					questions.map(async (q) => {
						const options = await db
							.select()
							.from(sebiQuestionnaireOptions)
							.where(
								and(
									eq(sebiQuestionnaireOptions.questionId, q.id),
									eq(sebiQuestionnaireOptions.isActive, true),
								),
							)
							.orderBy(sebiQuestionnaireOptions.sortOrder);

						return { ...q, options };
					}),
				);

				return {
					code: cat.categoryCode,
					name: cat.categoryName,
					weight: Number.parseFloat(cat.weightPercentage || "0"),
					questions: questionsWithOptions,
				};
			}),
		);

		return {
			version,
			categories: result,
		};
	}

	/**
	 * Get all risk profiles master data
	 */
	async getRiskProfilesMaster(): Promise<SebiRiskProfileMaster[]> {
		const profiles = await db
			.select()
			.from(sebiRiskProfilesMaster)
			.where(eq(sebiRiskProfilesMaster.isActive, true))
			.orderBy(sebiRiskProfilesMaster.sortOrder);

		// Return defaults if no data
		if (profiles.length === 0) {
			return Object.entries(PROFILE_SCORE_RANGES).map(([code, data], idx) => ({
				id: code,
				profileCode: code,
				profileName: data.name,
				riskBand: data.band,
				description: null,
				scoreRangeMin: data.min,
				scoreRangeMax: data.max,
				colorCode: null,
				sortOrder: idx + 1,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			}));
		}

		return profiles;
	}

	/**
	 * Log audit event
	 */
	async logAuditEvent(event: Partial<InsertSebiRiskAuditLog>) {
		const retentionDate = new Date();
		retentionDate.setFullYear(retentionDate.getFullYear() + 8); // 8-year retention

		await db.insert(sebiRiskAuditLogs).values({
			...event,
			retentionExpiresAt: retentionDate,
			isRegulatorAuditable: true,
		} as InsertSebiRiskAuditLog);
	}

	/**
	 * Get assessment history for a user
	 */
	async getAssessmentHistory(
		userId: string,
	): Promise<SebiClientRiskAssessment[]> {
		return db
			.select()
			.from(sebiClientRiskAssessments)
			.where(eq(sebiClientRiskAssessments.userId, userId))
			.orderBy(desc(sebiClientRiskAssessments.createdAt));
	}

	/**
	 * Get audit logs for compliance export
	 */
	async getAuditLogs(filters: {
		userId?: string;
		fromDate?: Date;
		toDate?: Date;
		actionCategory?: string;
	}) {
		let query = db.select().from(sebiRiskAuditLogs);

		const conditions = [];
		if (filters.userId) {
			conditions.push(eq(sebiRiskAuditLogs.userId, filters.userId));
		}
		if (filters.fromDate) {
			conditions.push(gte(sebiRiskAuditLogs.timestamp, filters.fromDate));
		}
		if (filters.toDate) {
			conditions.push(lte(sebiRiskAuditLogs.timestamp, filters.toDate));
		}
		if (filters.actionCategory) {
			conditions.push(
				eq(sebiRiskAuditLogs.actionCategory, filters.actionCategory),
			);
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		return query.orderBy(desc(sebiRiskAuditLogs.timestamp));
	}

	/**
	 * Initialize default data (for first-time setup)
	 */
	async initializeDefaultData() {
		// Check if profiles already exist
		const existingProfiles = await db
			.select()
			.from(sebiRiskProfilesMaster)
			.limit(1);
		if (existingProfiles.length > 0) {
			console.log("SEBI Risk Profiles already initialized");
			return;
		}

		// Insert risk profiles
		for (const [code, data] of Object.entries(PROFILE_SCORE_RANGES)) {
			await db.insert(sebiRiskProfilesMaster).values({
				profileCode: code,
				profileName: data.name,
				riskBand: data.band,
				description: `${data.name} risk profile with score range ${data.min}-${data.max}`,
				scoreRangeMin: data.min,
				scoreRangeMax: data.max,
				colorCode: this.getProfileColor(code),
				sortOrder: Number.parseInt(code.replace("RP", "")),
				isActive: true,
			});
		}

		// Insert product suitability matrix (as per SEBI guidelines)
		const products = [
			{
				type: "liquid_mf",
				label: "Liquid / Debt MF",
				rp1: true,
				rp2: true,
				rp3: true,
				rp4: true,
				rp5: true,
			},
			{
				type: "hybrid_mf",
				label: "Hybrid MF",
				rp1: false,
				rp2: true,
				rp3: true,
				rp4: true,
				rp5: true,
			},
			{
				type: "equity_mf",
				label: "Equity MF",
				rp1: false,
				rp2: false,
				rp3: true,
				rp4: true,
				rp5: true,
			},
			{
				type: "pms",
				label: "Portfolio Management Services",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: true,
				rp5: true,
				minInvestment: "5000000",
			},
			{
				type: "aif_cat1",
				label: "AIF Category I",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: true,
				rp5: true,
				minInvestment: "10000000",
			},
			{
				type: "aif_cat2",
				label: "AIF Category II",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: true,
				rp5: true,
				minInvestment: "10000000",
			},
			{
				type: "aif_cat3",
				label: "AIF Category III",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: false,
				rp5: true,
				minInvestment: "10000000",
			},
			{
				type: "reit",
				label: "REIT",
				rp1: false,
				rp2: true,
				rp3: true,
				rp4: true,
				rp5: true,
			},
			{
				type: "invit",
				label: "InvIT",
				rp1: false,
				rp2: true,
				rp3: true,
				rp4: true,
				rp5: true,
			},
			{
				type: "mld",
				label: "Market Linked Debentures",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: true,
				rp5: true,
				minInvestment: "1000000",
			},
			{
				type: "unlisted_equity",
				label: "Unlisted Equity",
				rp1: false,
				rp2: false,
				rp3: false,
				rp4: false,
				rp5: true,
			},
		];

		for (let i = 0; i < products.length; i++) {
			const p = products[i];
			await db.insert(sebiProductSuitabilityMatrix).values({
				productType: p.type,
				productTypeLabel: p.label,
				allowedRP1: p.rp1,
				allowedRP2: p.rp2,
				allowedRP3: p.rp3,
				allowedRP4: p.rp4,
				allowedRP5: p.rp5,
				minInvestmentAmount: p.minInvestment,
				sortOrder: i + 1,
				isActive: true,
			});
		}

		console.log(
			"✅ SEBI Risk Profiles and Product Suitability Matrix initialized",
		);
	}

	private getProfileColor(code: string): string {
		const colors: Record<string, string> = {
			RP1: "#22c55e", // Green - Conservative
			RP2: "#84cc16", // Lime - Moderately Conservative
			RP3: "#eab308", // Yellow - Moderate
			RP4: "#f97316", // Orange - Moderately Aggressive
			RP5: "#ef4444", // Red - Aggressive
		};
		return colors[code] || "#6b7280";
	}

	// ============================================
	// AI DYNAMIC RISK ENGINE
	// ============================================

	/**
	 * Analyze user behavior and create AI recommendation if risk profile adjustment needed
	 */
	async analyzeAndRecommend(
		userId: string,
		triggerType: string,
		triggerDetails: Record<string, any>,
	): Promise<SebiAiRiskRecommendation | null> {
		const currentAssessment = await this.getActiveAssessment(userId);
		if (!currentAssessment) return null;

		// Analyze based on trigger type
		let suggestedProfileCode = currentAssessment.profileCode;
		let recommendationType: "upgrade" | "downgrade" | "maintain" = "maintain";
		let confidenceScore = 0.5;
		let explanation = "";

		switch (triggerType) {
			case "large_inflow":
				// Large inflow might indicate improved financial capacity
				if (currentAssessment.profileCode !== "RP5") {
					suggestedProfileCode = this.upgradeProfile(
						currentAssessment.profileCode,
					);
					recommendationType = "upgrade";
					confidenceScore = 0.7;
					explanation = `Significant capital inflow of ₹${triggerDetails.amount?.toLocaleString()} detected. This may indicate improved financial capacity and ability to take higher risk.`;
				}
				break;

			case "large_outflow":
				// Large outflow might indicate reduced capacity
				suggestedProfileCode = this.downgradeProfile(
					currentAssessment.profileCode,
				);
				recommendationType = "downgrade";
				confidenceScore = 0.75;
				explanation = `Significant capital outflow of ₹${triggerDetails.amount?.toLocaleString()} detected. This may indicate reduced financial capacity, suggesting a more conservative approach.`;
				break;

			case "panic_selling":
				// Panic selling indicates lower risk tolerance
				suggestedProfileCode = this.downgradeProfile(
					currentAssessment.profileCode,
				);
				recommendationType = "downgrade";
				confidenceScore = 0.85;
				explanation =
					"Pattern of panic selling detected during market volatility. Behavioral analysis suggests lower actual risk tolerance than stated.";
				break;

			case "over_trading":
				// Over-trading indicates speculative behavior - recommend downgrade for review
				suggestedProfileCode = this.downgradeProfile(
					currentAssessment.profileCode,
				);
				recommendationType = "downgrade";
				confidenceScore = 0.65;
				explanation =
					"High frequency trading pattern detected. Behavioral analysis suggests speculative tendencies that may not align with stated risk tolerance. Consider reviewing investment goals and risk understanding.";
				break;

			case "age_band_crossing":
				// Age milestone crossed
				if (triggerDetails.newAge >= 60) {
					suggestedProfileCode = "RP1";
					recommendationType = "downgrade";
					confidenceScore = 0.9;
					explanation =
						"Client has crossed 60 years of age. Per SEBI guidelines, conservative risk profile is recommended.";
				}
				break;

			default:
				return null;
		}

		if (recommendationType === "maintain") return null;

		// Create AI recommendation record
		const [recommendation] = await db
			.insert(sebiAiRiskRecommendations)
			.values({
				userId,
				currentAssessmentId: currentAssessment.id,
				triggerType,
				triggerDetails,
				currentProfileCode: currentAssessment.profileCode,
				suggestedProfileCode,
				recommendationType,
				confidenceScore: confidenceScore.toString(),
				aiExplanation: explanation,
				supportingData: triggerDetails,
				aiModelUsed: "rule_based_v1",
				aiEngineVersion: "1.0.0",
				status: "pending",
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
			})
			.returning();

		// Log audit event
		await this.logAuditEvent({
			userId,
			assessmentId: currentAssessment.id,
			recommendationId: recommendation.id,
			action: "ai_recommendation_created",
			actionCategory: "ai",
			actorRole: "system",
			newValue: { triggerType, suggestedProfileCode, confidenceScore },
			reason: explanation,
		});

		return recommendation;
	}

	private upgradeProfile(current: string): string {
		const order = ["RP1", "RP2", "RP3", "RP4", "RP5"];
		const idx = order.indexOf(current);
		return idx < order.length - 1 ? order[idx + 1] : current;
	}

	private downgradeProfile(current: string): string {
		const order = ["RP1", "RP2", "RP3", "RP4", "RP5"];
		const idx = order.indexOf(current);
		return idx > 0 ? order[idx - 1] : current;
	}

	/**
	 * Resolve AI recommendation (accept/reject)
	 */
	async resolveAiRecommendation(
		recommendationId: string,
		resolution: "accepted" | "rejected",
		resolvedBy: string,
		notes?: string,
	) {
		const [recommendation] = await db
			.select()
			.from(sebiAiRiskRecommendations)
			.where(eq(sebiAiRiskRecommendations.id, recommendationId));

		if (!recommendation) throw new Error("Recommendation not found");

		await db
			.update(sebiAiRiskRecommendations)
			.set({
				status: resolution,
				resolutionType:
					resolution === "accepted" ? "client_reconfirmed" : "auto_rejected",
				resolvedBy,
				resolvedAt: new Date(),
				resolutionNotes: notes,
			})
			.where(eq(sebiAiRiskRecommendations.id, recommendationId));

		// Log audit event
		await this.logAuditEvent({
			userId: recommendation.userId,
			recommendationId,
			action: "ai_recommendation_resolved",
			actionCategory: "ai",
			actorId: resolvedBy,
			newValue: { resolution, notes },
		});

		return { success: true };
	}

	/**
	 * Get pending AI recommendations for a user
	 */
	async getPendingRecommendations(userId: string) {
		return db
			.select()
			.from(sebiAiRiskRecommendations)
			.where(
				and(
					eq(sebiAiRiskRecommendations.userId, userId),
					eq(sebiAiRiskRecommendations.status, "pending"),
				),
			)
			.orderBy(desc(sebiAiRiskRecommendations.createdAt));
	}

	// ============================================
	// ADMIN ENDPOINTS
	// ============================================

	/**
	 * Get all categories (admin)
	 */
	async getCategories() {
		const categories = await db
			.select()
			.from(sebiQuestionnaireCategories)
			.orderBy(sebiQuestionnaireCategories.sortOrder);

		if (categories.length === 0) {
			return DEFAULT_CATEGORIES.map((cat, idx) => ({
				id: `default_${cat.code}`,
				categoryCode: cat.code,
				categoryName: cat.name,
				weightPercentage: cat.weight,
				sortOrder: idx + 1,
				isActive: true,
			}));
		}

		return categories;
	}

	/**
	 * Get all questions (admin)
	 */
	async getQuestions() {
		const questions = await db
			.select()
			.from(sebiQuestionnaireQuestions)
			.orderBy(sebiQuestionnaireQuestions.sortOrder);

		// Get options for each question
		const questionsWithOptions = await Promise.all(
			questions.map(async (q) => {
				const options = await db
					.select()
					.from(sebiQuestionnaireOptions)
					.where(eq(sebiQuestionnaireOptions.questionId, q.id))
					.orderBy(sebiQuestionnaireOptions.sortOrder);
				return { ...q, options };
			}),
		);

		return questionsWithOptions;
	}

	/**
	 * Get product suitability matrix (admin)
	 */
	async getProductMatrix() {
		const matrix = await db
			.select()
			.from(sebiProductSuitabilityMatrix)
			.orderBy(sebiProductSuitabilityMatrix.sortOrder);

		return matrix;
	}

	/**
	 * Update category weights (admin)
	 */
	async updateCategoryWeights(weights: Record<string, number>) {
		for (const [code, weight] of Object.entries(weights)) {
			await db
				.update(sebiQuestionnaireCategories)
				.set({ weightPercentage: weight.toString() })
				.where(eq(sebiQuestionnaireCategories.categoryCode, code));
		}
		return { success: true };
	}

	/**
	 * Update product suitability (admin)
	 */
	async updateProductSuitability(
		id: string,
		updates: Partial<SebiProductSuitabilityMatrix>,
	) {
		await db
			.update(sebiProductSuitabilityMatrix)
			.set({ ...updates, updatedAt: new Date() })
			.where(eq(sebiProductSuitabilityMatrix.id, id));
		return { success: true };
	}

	/**
	 * Create a new category (admin)
	 */
	async createCategory(data: {
		categoryCode: string;
		categoryName: string;
		weightPercentage: number;
		sortOrder?: number;
	}) {
		const existingVersion = await db
			.select()
			.from(sebiQuestionnaireVersions)
			.where(eq(sebiQuestionnaireVersions.status, "active"))
			.limit(1);

		let versionId: string;
		if (existingVersion.length === 0) {
			const [newVersion] = await db
				.insert(sebiQuestionnaireVersions)
				.values({
					versionNumber: "1.0",
					status: "active",
					effectiveFrom: new Date(),
				})
				.returning();
			versionId = newVersion.id;
		} else {
			versionId = existingVersion[0].id;
		}

		const [category] = await db
			.insert(sebiQuestionnaireCategories)
			.values({
				versionId,
				categoryCode: data.categoryCode,
				categoryName: data.categoryName,
				weightPercentage: data.weightPercentage.toString(),
				sortOrder: data.sortOrder || 1,
				isActive: true,
			})
			.returning();

		return category;
	}

	/**
	 * Update a category (admin)
	 */
	async updateCategory(
		id: string,
		updates: Partial<{
			categoryName: string;
			weightPercentage: number;
			sortOrder: number;
			isActive: boolean;
		}>,
	) {
		const updateData: any = { ...updates };
		if (updates.weightPercentage !== undefined) {
			updateData.weightPercentage = updates.weightPercentage.toString();
		}
		await db
			.update(sebiQuestionnaireCategories)
			.set(updateData)
			.where(eq(sebiQuestionnaireCategories.id, id));
		return { success: true };
	}

	/**
	 * Create a new question (admin)
	 */
	async createQuestion(data: {
		categoryId: string;
		questionCode: string;
		questionText: string;
		questionType?: string;
		helpText?: string;
		isMandatory?: boolean;
		sortOrder?: number;
		options?: Array<{
			optionCode: string;
			optionText: string;
			score: number;
			sortOrder?: number;
		}>;
	}) {
		const [question] = await db
			.insert(sebiQuestionnaireQuestions)
			.values({
				categoryId: data.categoryId,
				questionCode: data.questionCode,
				questionText: data.questionText,
				questionType: data.questionType || "single_choice",
				helpText: data.helpText,
				isMandatory: data.isMandatory ?? true,
				sortOrder: data.sortOrder || 1,
				isActive: true,
			})
			.returning();

		// Create options if provided
		if (data.options && data.options.length > 0) {
			for (const opt of data.options) {
				await db.insert(sebiQuestionnaireOptions).values({
					questionId: question.id,
					optionCode: opt.optionCode,
					optionText: opt.optionText,
					score: opt.score,
					sortOrder: opt.sortOrder || 1,
					isActive: true,
				});
			}
		}

		return question;
	}

	/**
	 * Update a question (admin)
	 */
	async updateQuestion(
		id: string,
		updates: Partial<{
			questionText: string;
			helpText: string;
			isMandatory: boolean;
			sortOrder: number;
			isActive: boolean;
		}>,
	) {
		await db
			.update(sebiQuestionnaireQuestions)
			.set(updates)
			.where(eq(sebiQuestionnaireQuestions.id, id));
		return { success: true };
	}

	/**
	 * Soft delete a question (admin)
	 */
	async deleteQuestion(id: string) {
		await db
			.update(sebiQuestionnaireQuestions)
			.set({ isActive: false })
			.where(eq(sebiQuestionnaireQuestions.id, id));
		return { success: true };
	}

	/**
	 * Create a new product suitability entry (admin)
	 */
	async createProductSuitability(data: {
		productType: string;
		productTypeLabel: string;
		allowedRP1?: boolean;
		allowedRP2?: boolean;
		allowedRP3?: boolean;
		allowedRP4?: boolean;
		allowedRP5?: boolean;
		minInvestmentAmount?: string;
		requiresAccreditedInvestor?: boolean;
		requiresEnhancedKyc?: boolean;
		sortOrder?: number;
	}) {
		const [product] = await db
			.insert(sebiProductSuitabilityMatrix)
			.values({
				productType: data.productType,
				productTypeLabel: data.productTypeLabel,
				allowedRP1: data.allowedRP1 ?? false,
				allowedRP2: data.allowedRP2 ?? false,
				allowedRP3: data.allowedRP3 ?? false,
				allowedRP4: data.allowedRP4 ?? false,
				allowedRP5: data.allowedRP5 ?? false,
				minInvestmentAmount: data.minInvestmentAmount,
				requiresAccreditedInvestor: data.requiresAccreditedInvestor ?? false,
				requiresEnhancedKyc: data.requiresEnhancedKyc ?? false,
				sortOrder: data.sortOrder || 99,
				isActive: true,
			})
			.returning();

		return product;
	}

	// ============================================
	// COMPLIANCE EXPORT
	// ============================================

	/**
	 * Generate SEBI compliance report
	 */
	async generateComplianceReport(options: {
		fromDate: Date;
		toDate: Date;
		reportType: "summary" | "detailed" | "audit";
	}) {
		const { fromDate, toDate, reportType } = options;

		// Get all assessments in date range
		const assessments = await db
			.select()
			.from(sebiClientRiskAssessments)
			.where(
				and(
					gte(sebiClientRiskAssessments.createdAt, fromDate),
					lte(sebiClientRiskAssessments.createdAt, toDate),
				),
			)
			.orderBy(sebiClientRiskAssessments.createdAt);

		// Get audit logs
		const auditLogs = await db
			.select()
			.from(sebiRiskAuditLogs)
			.where(
				and(
					gte(sebiRiskAuditLogs.timestamp, fromDate),
					lte(sebiRiskAuditLogs.timestamp, toDate),
				),
			)
			.orderBy(sebiRiskAuditLogs.timestamp);

		// Calculate summary statistics
		const summary = {
			reportGeneratedAt: new Date().toISOString(),
			reportPeriod: {
				fromDate: fromDate.toISOString(),
				toDate: toDate.toISOString(),
			},
			totalAssessments: assessments.length,
			assessmentsByProfile: {} as Record<string, number>,
			overridesApplied: assessments.filter((a) => a.hasOverride).length,
			overridesByType: {} as Record<string, number>,
			auditLogCount: auditLogs.length,
			auditLogsByCategory: {} as Record<string, number>,
		};

		// Count by profile
		for (const a of assessments) {
			summary.assessmentsByProfile[a.profileCode] =
				(summary.assessmentsByProfile[a.profileCode] || 0) + 1;
			if (a.hasOverride && a.overrideType) {
				summary.overridesByType[a.overrideType] =
					(summary.overridesByType[a.overrideType] || 0) + 1;
			}
		}

		// Count audit logs by category
		for (const log of auditLogs) {
			if (log.actionCategory) {
				summary.auditLogsByCategory[log.actionCategory] =
					(summary.auditLogsByCategory[log.actionCategory] || 0) + 1;
			}
		}

		if (reportType === "summary") {
			return { summary };
		}

		if (reportType === "detailed") {
			return {
				summary,
				assessments: assessments.map((a) => ({
					id: a.id,
					pan: a.pan,
					profileCode: a.profileCode,
					rawScore: a.rawScore,
					adjustedScore: a.adjustedScore,
					hasOverride: a.hasOverride,
					overrideType: a.overrideType,
					overrideReason: a.overrideReason,
					createdAt: a.createdAt,
				})),
			};
		}

		// Full audit report
		return {
			summary,
			assessments,
			auditLogs,
		};
	}

	/**
	 * Export compliance data as CSV
	 */
	async exportComplianceCSV(options: { fromDate: Date; toDate: Date }) {
		const { assessments, auditLogs } = (await this.generateComplianceReport({
			...options,
			reportType: "audit",
		})) as any;

		// Generate CSV content
		const assessmentHeaders = [
			"Assessment ID",
			"PAN",
			"Profile Code",
			"Raw Score",
			"Adjusted Score",
			"Override Applied",
			"Override Type",
			"Override Reason",
			"Assessment Date",
		];
		const assessmentRows = assessments.map((a: any) => [
			a.id,
			a.pan,
			a.profileCode,
			a.rawScore,
			a.adjustedScore,
			a.hasOverride ? "Yes" : "No",
			a.overrideType || "",
			a.overrideReason || "",
			new Date(a.createdAt).toISOString(),
		]);

		const auditHeaders = [
			"Timestamp",
			"User ID",
			"Action",
			"Category",
			"Actor Role",
			"Reason",
		];
		const auditRows = auditLogs.map((l: any) => [
			new Date(l.timestamp).toISOString(),
			l.userId || "",
			l.action,
			l.actionCategory,
			l.actorRole || "",
			l.reason || "",
		]);

		return {
			assessmentsCSV: [assessmentHeaders, ...assessmentRows]
				.map((row) => row.join(","))
				.join("\n"),
			auditLogsCSV: [auditHeaders, ...auditRows]
				.map((row) => row.join(","))
				.join("\n"),
		};
	}
}

export const sebiRiskScoringService = new SEBIRiskScoringService();
