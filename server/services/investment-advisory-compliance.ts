/**
 * Investment Advisory Compliance Engine
 *
 * SEBI (Investment Advisers) Regulations, 2013 compliance implementation:
 * - Full audit trail of all investment recommendations
 * - Client consent and acknowledgment tracking
 * - Suitability documentation and evidence preservation
 * - Regulatory disclosure generation
 * - Periodic compliance reporting
 */

import { nanoid } from "nanoid";

// ==================== TYPES ====================

export interface RecommendationAuditLog {
	auditId: string;
	clientId: string;
	advisorId: string;
	timestamp: Date;
	recommendationType: "product" | "portfolio" | "rebalance" | "proposal";
	recommendation: {
		action: "buy" | "sell" | "hold" | "avoid" | "rebalance";
		productCode?: string;
		productName?: string;
		amount?: number;
		rationale: string;
		riskWarnings: string[];
		suitabilityScore: number;
	};
	suitabilityEvidence: {
		riskProfile: string;
		investmentHorizon: number;
		clientSegment: string;
		kycTier: string;
		financialCapacity: boolean;
		productEligibility: boolean;
	};
	disclosures: {
		conflictOfInterest: string;
		commissionDisclosure: string;
		riskDisclosure: string;
		pastPerformanceDisclaimer: string;
	};
	explanationReasons: Array<{
		category: string;
		description: string;
		impact: "positive" | "negative" | "neutral";
	}>;
	regulatoryCompliance: {
		sebiRegulation17Compliant: boolean;
		kycVerified: boolean;
		riskProfileAssessed: boolean;
		suitabilityAssessed: boolean;
		disclosuresProvided: boolean;
	};
	clientAcknowledgment?: {
		acknowledged: boolean;
		acknowledgedAt?: Date;
		ipAddress?: string;
		deviceFingerprint?: string;
	};
	retentionExpiry: Date;
}

export interface ConsentRecord {
	consentId: string;
	clientId: string;
	consentType:
		| "risk_disclosure"
		| "investment_advice"
		| "data_processing"
		| "commission_disclosure"
		| "suitability_waiver";
	consentText: string;
	grantedAt: Date;
	expiresAt?: Date;
	ipAddress: string;
	deviceInfo: string;
	revoked: boolean;
	revokedAt?: Date;
	regulatoryReference: string;
}

export interface ComplianceReport {
	reportId: string;
	reportType: "monthly" | "quarterly" | "annual" | "ad_hoc";
	periodStart: Date;
	periodEnd: Date;
	generatedAt: Date;
	summary: {
		totalRecommendations: number;
		suitableRecommendations: number;
		unsuitableOverrides: number;
		clientAcknowledgmentRate: number;
		averageSuitabilityScore: number;
		complianceRate: number;
	};
	violations: Array<{
		violationType: string;
		description: string;
		severity: "low" | "medium" | "high" | "critical";
		clientId: string;
		recommendationId: string;
		dateOccurred: Date;
		resolved: boolean;
		resolution?: string;
	}>;
	regulatoryStatus: {
		sebiCompliant: boolean;
		pendingItems: string[];
		upcomingDeadlines: Array<{
			deadline: Date;
			requirement: string;
		}>;
	};
}

export interface SuitabilityDeclaration {
	declarationId: string;
	clientId: string;
	advisorId: string;
	proposalId: string;
	timestamp: Date;
	declaration: {
		riskProfileMatch: boolean;
		horizonMatch: boolean;
		financialCapacityMatch: boolean;
		objectivesMatch: boolean;
		kycComplete: boolean;
	};
	overrideReason?: string;
	regulatoryReference: string;
	signatureRequired: boolean;
	signatureObtained: boolean;
}

// ==================== STORAGE ====================

const auditLogs: Map<string, RecommendationAuditLog> = new Map();
const consentRecords: Map<string, ConsentRecord> = new Map();
const complianceReports: Map<string, ComplianceReport> = new Map();
const suitabilityDeclarations: Map<string, SuitabilityDeclaration> = new Map();

// ==================== COMPLIANCE ENGINE ====================

export class InvestmentAdvisoryComplianceEngine {
	/**
	 * Log an investment recommendation with full audit trail
	 */
	logRecommendation(params: {
		clientId: string;
		advisorId: string;
		recommendationType: RecommendationAuditLog["recommendationType"];
		action: "buy" | "sell" | "hold" | "avoid" | "rebalance";
		productCode?: string;
		productName?: string;
		amount?: number;
		rationale: string;
		suitabilityScore: number;
		riskWarnings: string[];
		explanationReasons: RecommendationAuditLog["explanationReasons"];
		suitabilityEvidence: RecommendationAuditLog["suitabilityEvidence"];
	}): RecommendationAuditLog {
		const auditId = nanoid();
		const now = new Date();
		const retentionYears = 5;

		const auditLog: RecommendationAuditLog = {
			auditId,
			clientId: params.clientId,
			advisorId: params.advisorId,
			timestamp: now,
			recommendationType: params.recommendationType,
			recommendation: {
				action: params.action,
				productCode: params.productCode,
				productName: params.productName,
				amount: params.amount,
				rationale: params.rationale,
				riskWarnings: params.riskWarnings,
				suitabilityScore: params.suitabilityScore,
			},
			suitabilityEvidence: params.suitabilityEvidence,
			disclosures: this.generateMandatoryDisclosures(),
			explanationReasons: params.explanationReasons,
			regulatoryCompliance: {
				sebiRegulation17Compliant: params.suitabilityScore >= 50,
				kycVerified: params.suitabilityEvidence.kycTier !== "none",
				riskProfileAssessed: true,
				suitabilityAssessed: true,
				disclosuresProvided: true,
			},
			retentionExpiry: new Date(
				now.getTime() + retentionYears * 365 * 24 * 60 * 60 * 1000,
			),
		};

		auditLogs.set(auditId, auditLog);
		return auditLog;
	}

	/**
	 * Generate mandatory regulatory disclosures
	 */
	private generateMandatoryDisclosures(): RecommendationAuditLog["disclosures"] {
		return {
			conflictOfInterest:
				"FintekPro may receive commissions from product providers. This potential conflict has been disclosed as per SEBI (Investment Advisers) Regulations, 2013.",
			commissionDisclosure:
				"Commission structure: Trail commission of 0.5-1% p.a. on assets under advice. Upfront commissions disclosed in product-specific documentation.",
			riskDisclosure:
				"Investment in securities market is subject to market risks. Past performance is not indicative of future returns. Read all scheme related documents carefully before investing.",
			pastPerformanceDisclaimer:
				"Past performance is not necessarily indicative of future results and no representation is being made that any investment will or is likely to achieve profits or losses similar to those achieved in the past.",
		};
	}

	/**
	 * Record client consent for regulatory compliance
	 */
	recordConsent(params: {
		clientId: string;
		consentType: ConsentRecord["consentType"];
		consentText: string;
		ipAddress: string;
		deviceInfo: string;
		expiresAt?: Date;
	}): ConsentRecord {
		const consentId = nanoid();
		const now = new Date();

		const regulatoryRefs: Record<ConsentRecord["consentType"], string> = {
			risk_disclosure: "SEBI Circular CIR/OIAE/1/2015 dated 23-Mar-2015",
			investment_advice:
				"SEBI (Investment Advisers) Regulations, 2013 - Regulation 17",
			data_processing: "IT Act 2000, SPDI Rules 2011, DPDP Act 2023",
			commission_disclosure: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2021/024",
			suitability_waiver:
				"SEBI (Investment Advisers) Regulations, 2013 - Regulation 17(2)",
		};

		const consent: ConsentRecord = {
			consentId,
			clientId: params.clientId,
			consentType: params.consentType,
			consentText: params.consentText,
			grantedAt: now,
			expiresAt: params.expiresAt,
			ipAddress: params.ipAddress,
			deviceInfo: params.deviceInfo,
			revoked: false,
			regulatoryReference: regulatoryRefs[params.consentType],
		};

		consentRecords.set(consentId, consent);
		return consent;
	}

	/**
	 * Record client acknowledgment of recommendation
	 */
	acknowledgeRecommendation(params: {
		auditId: string;
		ipAddress: string;
		deviceFingerprint: string;
	}): RecommendationAuditLog | null {
		const auditLog = auditLogs.get(params.auditId);
		if (!auditLog) return null;

		auditLog.clientAcknowledgment = {
			acknowledged: true,
			acknowledgedAt: new Date(),
			ipAddress: params.ipAddress,
			deviceFingerprint: params.deviceFingerprint,
		};

		auditLogs.set(params.auditId, auditLog);
		return auditLog;
	}

	/**
	 * Create suitability declaration for a proposal
	 */
	createSuitabilityDeclaration(params: {
		clientId: string;
		advisorId: string;
		proposalId: string;
		riskProfileMatch: boolean;
		horizonMatch: boolean;
		financialCapacityMatch: boolean;
		objectivesMatch: boolean;
		kycComplete: boolean;
		overrideReason?: string;
	}): SuitabilityDeclaration {
		const declarationId = nanoid();

		const allMatch =
			params.riskProfileMatch &&
			params.horizonMatch &&
			params.financialCapacityMatch &&
			params.objectivesMatch &&
			params.kycComplete;

		const declaration: SuitabilityDeclaration = {
			declarationId,
			clientId: params.clientId,
			advisorId: params.advisorId,
			proposalId: params.proposalId,
			timestamp: new Date(),
			declaration: {
				riskProfileMatch: params.riskProfileMatch,
				horizonMatch: params.horizonMatch,
				financialCapacityMatch: params.financialCapacityMatch,
				objectivesMatch: params.objectivesMatch,
				kycComplete: params.kycComplete,
			},
			overrideReason: params.overrideReason,
			regulatoryReference:
				"SEBI (Investment Advisers) Regulations, 2013 - Regulation 17(2)",
			signatureRequired: !allMatch,
			signatureObtained: false,
		};

		suitabilityDeclarations.set(declarationId, declaration);
		return declaration;
	}

	/**
	 * Generate compliance report for a period
	 */
	generateComplianceReport(params: {
		reportType: ComplianceReport["reportType"];
		periodStart: Date;
		periodEnd: Date;
	}): ComplianceReport {
		const reportId = nanoid();

		const periodLogs = Array.from(auditLogs.values()).filter(
			(log) =>
				log.timestamp >= params.periodStart &&
				log.timestamp <= params.periodEnd,
		);

		const totalRecommendations = periodLogs.length;
		const suitableRecommendations = periodLogs.filter(
			(l) => l.recommendation.suitabilityScore >= 70,
		).length;
		const unsuitableOverrides = periodLogs.filter(
			(l) =>
				l.recommendation.suitabilityScore < 50 &&
				l.recommendation.action === "buy",
		).length;
		const acknowledgedLogs = periodLogs.filter(
			(l) => l.clientAcknowledgment?.acknowledged,
		).length;
		const avgSuitability =
			totalRecommendations > 0
				? periodLogs.reduce(
						(sum, l) => sum + l.recommendation.suitabilityScore,
						0,
					) / totalRecommendations
				: 0;
		const compliantLogs = periodLogs.filter(
			(l) => l.regulatoryCompliance.sebiRegulation17Compliant,
		).length;

		const violations: ComplianceReport["violations"] = [];

		periodLogs.forEach((log) => {
			if (
				log.recommendation.suitabilityScore < 50 &&
				log.recommendation.action === "buy"
			) {
				violations.push({
					violationType: "UNSUITABLE_RECOMMENDATION",
					description: `Buy recommendation made with suitability score below 50 (${log.recommendation.suitabilityScore})`,
					severity: "high",
					clientId: log.clientId,
					recommendationId: log.auditId,
					dateOccurred: log.timestamp,
					resolved: false,
				});
			}

			if (
				!log.clientAcknowledgment?.acknowledged &&
				log.recommendation.action === "buy"
			) {
				violations.push({
					violationType: "MISSING_ACKNOWLEDGMENT",
					description:
						"Client acknowledgment not obtained for investment recommendation",
					severity: "medium",
					clientId: log.clientId,
					recommendationId: log.auditId,
					dateOccurred: log.timestamp,
					resolved: false,
				});
			}
		});

		const report: ComplianceReport = {
			reportId,
			reportType: params.reportType,
			periodStart: params.periodStart,
			periodEnd: params.periodEnd,
			generatedAt: new Date(),
			summary: {
				totalRecommendations,
				suitableRecommendations,
				unsuitableOverrides,
				clientAcknowledgmentRate:
					totalRecommendations > 0
						? (acknowledgedLogs / totalRecommendations) * 100
						: 100,
				averageSuitabilityScore: Math.round(avgSuitability * 100) / 100,
				complianceRate:
					totalRecommendations > 0
						? (compliantLogs / totalRecommendations) * 100
						: 100,
			},
			violations,
			regulatoryStatus: {
				sebiCompliant:
					violations.filter(
						(v) => v.severity === "high" || v.severity === "critical",
					).length === 0,
				pendingItems: violations
					.filter((v) => !v.resolved)
					.map((v) => v.description),
				upcomingDeadlines: [
					{
						deadline: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000),
						requirement: "Monthly compliance return filing with SEBI",
					},
					{
						deadline: new Date(new Date().getFullYear(), 11, 31),
						requirement: "Annual audit of investment advisory records",
					},
				],
			},
		};

		complianceReports.set(reportId, report);
		return report;
	}

	/**
	 * Get all audit logs for a client
	 */
	getClientAuditTrail(clientId: string): RecommendationAuditLog[] {
		return Array.from(auditLogs.values())
			.filter((log) => log.clientId === clientId)
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
	}

	/**
	 * Get all consents for a client
	 */
	getClientConsents(clientId: string): ConsentRecord[] {
		return Array.from(consentRecords.values()).filter(
			(record) => record.clientId === clientId && !record.revoked,
		);
	}

	/**
	 * Check if client has required consents for investment advice
	 */
	checkRequiredConsents(clientId: string): {
		allConsentsPresent: boolean;
		missingConsents: ConsentRecord["consentType"][];
		existingConsents: ConsentRecord["consentType"][];
	} {
		const requiredConsents: ConsentRecord["consentType"][] = [
			"risk_disclosure",
			"investment_advice",
			"commission_disclosure",
		];

		const clientConsents = this.getClientConsents(clientId);
		const existingTypes = clientConsents.map((c) => c.consentType);

		const missing = requiredConsents.filter((r) => !existingTypes.includes(r));

		return {
			allConsentsPresent: missing.length === 0,
			missingConsents: missing,
			existingConsents: existingTypes,
		};
	}

	/**
	 * Generate regulatory disclosure document
	 */
	generateDisclosureDocument(params: {
		clientId: string;
		proposalId: string;
		products: Array<{
			productCode: string;
			productName: string;
			amount: number;
			riskLevel: number;
		}>;
	}): {
		documentId: string;
		generatedAt: Date;
		sections: Array<{
			title: string;
			content: string;
			regulatoryReference: string;
		}>;
		acknowledgmentRequired: boolean;
	} {
		const totalAmount = params.products.reduce((sum, p) => sum + p.amount, 0);
		const maxRisk = Math.max(...params.products.map((p) => p.riskLevel));

		return {
			documentId: nanoid(),
			generatedAt: new Date(),
			sections: [
				{
					title: "Risk Disclosure",
					content: `This investment proposal involves products with risk levels up to ${maxRisk}/5. Your capital is at risk and you may lose some or all of your investment. Past performance is not indicative of future results.`,
					regulatoryReference: "SEBI Circular CIR/OIAE/1/2015",
				},
				{
					title: "Investment Advice Disclosure",
					content:
						"FintekPro is a SEBI Registered Investment Adviser (Registration No: XXXXXXXXX). The advice provided is based on your stated investment objectives, risk tolerance, and financial situation as assessed through our KYC process.",
					regulatoryReference: "SEBI (Investment Advisers) Regulations, 2013",
				},
				{
					title: "Conflict of Interest Statement",
					content:
						"FintekPro may receive trail commissions from product manufacturers. We endeavor to recommend products that are suitable for your profile regardless of commission structure.",
					regulatoryReference: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2021/024",
				},
				{
					title: "Suitability Statement",
					content: `Based on your risk profile and investment objectives, the recommended products have been assessed for suitability. Total proposed investment: ₹${totalAmount.toLocaleString("en-IN")}.`,
					regulatoryReference:
						"SEBI (Investment Advisers) Regulations, 2013 - Regulation 17(2)",
				},
				{
					title: "Complaint Redressal",
					content:
						"For any grievances, please contact our compliance officer at compliance@fintekpro.com. You may also file complaints at SEBI SCORES portal (https://scores.gov.in).",
					regulatoryReference: "SEBI Circular SEBI/HO/OIAE/2/P/CIR/2021/62",
				},
			],
			acknowledgmentRequired: maxRisk >= 4 || totalAmount >= 500000,
		};
	}

	/**
	 * Archive old audit logs beyond retention period
	 */
	archiveExpiredLogs(): {
		archivedCount: number;
		archivedIds: string[];
	} {
		const now = new Date();
		const expiredIds: string[] = [];

		auditLogs.forEach((log, id) => {
			if (log.retentionExpiry < now) {
				expiredIds.push(id);
			}
		});

		expiredIds.forEach((id) => auditLogs.delete(id));

		return {
			archivedCount: expiredIds.length,
			archivedIds: expiredIds,
		};
	}

	/**
	 * Get compliance statistics
	 */
	getComplianceStats(): {
		totalAuditLogs: number;
		totalConsents: number;
		totalReports: number;
		averageSuitabilityScore: number;
		acknowledgedRecommendations: number;
		complianceRate: number;
	} {
		const logs = Array.from(auditLogs.values());
		const totalLogs = logs.length;
		const avgSuitability =
			totalLogs > 0
				? logs.reduce((sum, l) => sum + l.recommendation.suitabilityScore, 0) /
					totalLogs
				: 0;
		const acknowledged = logs.filter(
			(l) => l.clientAcknowledgment?.acknowledged,
		).length;
		const compliant = logs.filter(
			(l) => l.regulatoryCompliance.sebiRegulation17Compliant,
		).length;

		return {
			totalAuditLogs: totalLogs,
			totalConsents: consentRecords.size,
			totalReports: complianceReports.size,
			averageSuitabilityScore: Math.round(avgSuitability * 100) / 100,
			acknowledgedRecommendations: acknowledged,
			complianceRate:
				totalLogs > 0 ? Math.round((compliant / totalLogs) * 100) : 100,
		};
	}
}

export const investmentAdvisoryCompliance =
	new InvestmentAdvisoryComplianceEngine();
