/**
 * @file mf-compliance-service.ts
 * @description Dedicated Statutory SEBI Compliance Engine for Mutual Funds (MF).
 *
 * Statutory Framework Enforced:
 * SEBI (Mutual Funds) Regulations, 1996 & Master Circular (July 2023):
 * - Regulation 29 / SEBI Categorization Circular 2017: Scheme categorization and portfolio mandate adherence.
 * - SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2020/197: Risk-o-meter calibrated across 6 tiers; suitability warning enforcement.
 * - SEBI Circular SEBI/HO/IMD/DF2/CIR/P/2020/175: NAV applicability linked to fund realization before cut-off timings.
 * - Cut-off Timing Norms: 13:00 IST for Liquid/Overnight schemes; 15:00 IST for all other Debt/Equity schemes.
 * - AMFI Guidelines & SEBI Circular CIR/IMD/DF/13/2012: Mandatory EUIN verification on distributor transactions.
 * - SEBI Circular SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2022/98: Mandatory CKYC / KRA sufficiency before purchase.
 * - SEBI Circular SEBI/HO/IMD/IMD-II/DOF10/P/CIR/2021/681: Two-tier TRI benchmarking requirement.
 * - SEBI Nominee Mandate: Mandatory nomination declaration or signed opt-out.
 *
 * @engineVersion SEBI-MF-COMPLIANCE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.0 audit trail logging.
 */

import { db } from "../db";
import { userProfiles, users, complianceAuditTrail } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export type ComplianceCheckStatus = "PASS" | "WARNING" | "BREACH";

export interface MfRuleCheck {
	ruleId: string;
	ruleName: string;
	regulationRef: string;
	status: ComplianceCheckStatus;
	statutoryThreshold: string;
	observedValue: string;
	details: string;
	remediationSteps?: string;
}

export interface MfComplianceRequest {
	userId: string;
	investmentAmount: number;
	actionType: "lumpsum" | "sip" | "stp" | "swp" | "redemption";
	schemeCode: string;
	schemeName: string;
	category?: string; // liquid, overnight, equity, debt, hybrid
	schemeRiskLevel?: "Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High";
	euin?: string;
	isExecutionOnly?: boolean;
	hasNominee?: boolean;
	nomineeOptOut?: boolean;
	suitabilityWarningAcknowledged?: boolean;
	orderPlacementTime?: string; // ISO string
}

export interface MfComplianceReport {
	vehicleType: "MUTUAL_FUND";
	isCompliant: boolean;
	overallStatus: "COMPLIANT" | "WARNING" | "NON_COMPLIANT";
	complianceScore: number; // 0 - 100
	summary: string;
	checks: MfRuleCheck[];
	breaches: string[];
	warnings: string[];
	remedialActions: string[];
	statutoryDisclaimer: string;
	meta: {
		engineVersion: string;
		calculationTimestamp: string;
		userId: string;
		schemeCode: string;
	};
}

export class MfComplianceService {
	private static instance: MfComplianceService;

	static readonly ENGINE_VERSION = "SEBI-MF-COMPLIANCE-v1.0";
	static readonly STATUTORY_SIP_MIN_INR = 500;
	static readonly STATUTORY_LUMPSUM_MIN_INR = 100;

	static getInstance(): MfComplianceService {
		if (!MfComplianceService.instance) {
			MfComplianceService.instance = new MfComplianceService();
		}
		return MfComplianceService.instance;
	}

	/**
	 * Audits a proposed Mutual Fund transaction against SEBI (Mutual Funds) Regulations, 1996 and AMFI standards.
	 */
	async auditMfCompliance(
		request: MfComplianceRequest,
	): Promise<MfComplianceReport> {
		const checks: MfRuleCheck[] = [];
		const breaches: string[] = [];
		const warnings: string[] = [];
		const remedialActions: string[] = [];
		const timestamp = new Date().toISOString();

		// Fetch profile for KYC, Risk, and Nominee checks
		const profile = await db.query.userProfiles.findFirst({
			where: eq(userProfiles.userId, request.userId),
		});

		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, request.userId))
			.limit(1);

		// 1. Rule: Statutory Minimum Investment Amount
		const isSip = request.actionType === "sip";
		const minAmount = isSip
			? MfComplianceService.STATUTORY_SIP_MIN_INR
			: MfComplianceService.STATUTORY_LUMPSUM_MIN_INR;

		if (request.actionType !== "redemption") {
			if (request.investmentAmount < minAmount) {
				breaches.push(
					`Investment amount of ₹${request.investmentAmount.toLocaleString("en-IN")} is below the statutory threshold of ₹${minAmount.toLocaleString("en-IN")}.`,
				);
				remedialActions.push(
					`Increase ${isSip ? "SIP" : "lump-sum"} commitment to at least ₹${minAmount.toLocaleString("en-IN")}.`,
				);
				checks.push({
					ruleId: "SEBI-MF-MIN-TICKET",
					ruleName: "Statutory Minimum Investment Ticket",
					regulationRef: "SEBI Master Circular on Mutual Funds (July 2023) §3",
					status: "BREACH",
					statutoryThreshold: `≥ ₹${minAmount.toLocaleString("en-IN")}`,
					observedValue: `₹${request.investmentAmount.toLocaleString("en-IN")}`,
					details: `SEBI and AMC rules mandate minimum ${isSip ? "SIP installment of ₹500" : "purchase of ₹100"}.`,
					remediationSteps: `Commit at least ₹${minAmount.toLocaleString("en-IN")}.`,
				});
			} else {
				checks.push({
					ruleId: "SEBI-MF-MIN-TICKET",
					ruleName: "Statutory Minimum Investment Ticket",
					regulationRef: "SEBI Master Circular on Mutual Funds (July 2023) §3",
					status: "PASS",
					statutoryThreshold: `≥ ₹${minAmount.toLocaleString("en-IN")}`,
					observedValue: `₹${request.investmentAmount.toLocaleString("en-IN")}`,
					details: "Investment amount meets statutory scheme minimum threshold.",
				});
			}
		}

		// 2. Rule: SEBI Risk-o-meter Alignment & Suitability
		const userRisk = ((user as any)?.riskProfile || (profile as any)?.riskProfile || "moderate").toLowerCase();
		const schemeRisk = request.schemeRiskLevel || "Moderate";
		const highRiskSchemes = ["Very High", "High", "Moderately High"];
		const isHighRiskScheme = highRiskSchemes.includes(schemeRisk);
		const isConservativeUser = userRisk.includes("conservative") || userRisk.includes("low");

		if (isConservativeUser && isHighRiskScheme) {
			if (!request.suitabilityWarningAcknowledged) {
				breaches.push(
					`Risk Mismatch: Client risk capacity is "${userRisk}", but scheme Risk-o-meter indicates "${schemeRisk}". Suitability acknowledgement required.`,
				);
				remedialActions.push(
					"Client must review and sign the SEBI High Risk Investment Suitability Warning before order submission.",
				);
				checks.push({
					ruleId: "SEBI-MF-RISK-O-METER",
					ruleName: "SEBI Risk-o-meter & Suitability Mandate",
					regulationRef: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2020/197 & SEBI IA Reg 17",
					status: "BREACH",
					statutoryThreshold: "Risk alignment or documented suitability acknowledgement",
					observedValue: `Client: ${userRisk} vs Scheme: ${schemeRisk}`,
					details: "High-risk product recommendation to conservative investor without explicit acknowledgment.",
					remediationSteps: "Obtain client confirmation of suitability warning.",
				});
			} else {
				warnings.push(
					`Suitability Warning: Client risk capacity is "${userRisk}" for "${schemeRisk}" scheme (suitability warning acknowledged).`,
				);
				checks.push({
					ruleId: "SEBI-MF-RISK-O-METER",
					ruleName: "SEBI Risk-o-meter & Suitability Mandate",
					regulationRef: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2020/197 & SEBI IA Reg 17",
					status: "WARNING",
					statutoryThreshold: "Documented Suitability Acknowledgement",
					observedValue: `Client: ${userRisk} vs Scheme: ${schemeRisk} (Acknowledged)`,
					details: "High-risk scheme permitted following explicit client risk waiver.",
				});
			}
		} else {
			checks.push({
				ruleId: "SEBI-MF-RISK-O-METER",
				ruleName: "SEBI Risk-o-meter & Suitability Mandate",
				regulationRef: "SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2020/197 & SEBI IA Reg 17",
				status: "PASS",
				statutoryThreshold: "Risk profile capacity aligns with scheme risk tier",
				observedValue: `Client: ${userRisk} vs Scheme: ${schemeRisk}`,
				details: "Investment aligns with client's documented risk tolerance.",
			});
		}

		// 3. Rule: Cut-off Timing & Fund Realization Rule
		const orderDate = request.orderPlacementTime ? new Date(request.orderPlacementTime) : new Date();
		const currentHour = orderDate.getHours();
		const currentMinute = orderDate.getMinutes();
		const totalMinutes = currentHour * 60 + currentMinute;

		const isLiquidOrOvernight = (request.category || "").toLowerCase().includes("liquid") ||
			(request.category || "").toLowerCase().includes("overnight") ||
			request.schemeName.toLowerCase().includes("liquid") ||
			request.schemeName.toLowerCase().includes("overnight");

		// Cut-offs: 13:00 (780 mins) for liquid/overnight, 15:00 (900 mins) for others
		const cutoffMinutes = isLiquidOrOvernight ? 13 * 60 : 15 * 60;
		const cutoffFormatted = isLiquidOrOvernight ? "13:00 IST (Liquid/Overnight)" : "15:00 IST (Debt/Equity)";

		if (totalMinutes >= cutoffMinutes) {
			warnings.push(
				`Order submitted after ${cutoffFormatted} cut-off. Next business day's NAV applies subject to fund realization.`,
			);
			checks.push({
				ruleId: "SEBI-MF-CUTOFF-TIMING",
				ruleName: "NAV Allocation Cut-Off Timing & Realization",
				regulationRef: "SEBI Circular SEBI/HO/IMD/DF2/CIR/P/2020/175",
				status: "WARNING",
				statutoryThreshold: `Before ${cutoffFormatted}`,
				observedValue: `Submitted at ${orderDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`,
				details: "Post cut-off submission. Transaction queued for T+1 business day processing.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-MF-CUTOFF-TIMING",
				ruleName: "NAV Allocation Cut-Off Timing & Realization",
				regulationRef: "SEBI Circular SEBI/HO/IMD/DF2/CIR/P/2020/175",
				status: "PASS",
				statutoryThreshold: `Before ${cutoffFormatted}`,
				observedValue: `Submitted at ${orderDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`,
				details: "Order placed before statutory cut-off; eligible for same-day NAV subject to fund realization.",
			});
		}

		// 4. Rule: EUIN (Employee Unique Identification Number) Check
		if (request.isExecutionOnly) {
			checks.push({
				ruleId: "SEBI-MF-EUIN-VERIFICATION",
				ruleName: "EUIN & Intermediation Disclosure",
				regulationRef: "AMFI Guidelines / SEBI Circular CIR/IMD/DF/13/2012",
				status: "PASS",
				statutoryThreshold: "Valid EUIN or Direct / Execution-Only Declaration",
				observedValue: "Execution-Only / Direct Mode",
				details: "Direct client execution; EUIN exemption applies per AMFI guidelines.",
			});
		} else if (request.euin && request.euin.trim().length >= 6) {
			checks.push({
				ruleId: "SEBI-MF-EUIN-VERIFICATION",
				ruleName: "EUIN & Intermediation Disclosure",
				regulationRef: "AMFI Guidelines / SEBI Circular CIR/IMD/DF/13/2012",
				status: "PASS",
				statutoryThreshold: "Valid EUIN Required for Intermediated Advice",
				observedValue: `EUIN: ${request.euin}`,
				details: "Valid EUIN recorded for advisor interaction audit trail.",
			});
		} else {
			warnings.push(
				"Missing EUIN on intermediated transaction. Transaction will be tagged with execution-only disclaimer.",
			);
			remedialActions.push(
				"Provide advisor EUIN or declare execution-only transaction.",
			);
			checks.push({
				ruleId: "SEBI-MF-EUIN-VERIFICATION",
				ruleName: "EUIN & Intermediation Disclosure",
				regulationRef: "AMFI Guidelines / SEBI Circular CIR/IMD/DF/13/2012",
				status: "WARNING",
				statutoryThreshold: "EUIN or Execution-Only declaration",
				observedValue: "No EUIN Provided",
				details: "Advice given without tagged EUIN. Requires execution-only tagging.",
				remediationSteps: "Tag partner EUIN to ensure distributor attribution.",
			});
		}

		// 5. Rule: CKYC / KRA Verified Status
		const kycStatus = (user?.kycStatus || (profile as any)?.kycStatus || "pending").toLowerCase();
		const isKycVerified = kycStatus === "verified" || kycStatus === "completed" || kycStatus === "approved";

		if (!isKycVerified) {
			breaches.push(
				`Client KYC status is "${kycStatus}". Under SEBI regulations, mutual fund orders cannot be executed without verified CKYC/KRA.`,
			);
			remedialActions.push(
				"Complete CKYC/KRA verification via Aadhaar OTP or Video KYC.",
			);
			checks.push({
				ruleId: "SEBI-MF-CKYC-VERIFICATION",
				ruleName: "Mandatory CKYC / KRA Verification",
				regulationRef: "SEBI Circular SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2022/98 & PMLA 2002",
				status: "BREACH",
				statutoryThreshold: "KYC Status: VERIFIED",
				observedValue: `KYC Status: ${kycStatus.toUpperCase()}`,
				details: "Order blocked: Unverified client cannot transact in Indian mutual funds.",
				remediationSteps: "Complete KYC verification before submitting purchase order.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-MF-CKYC-VERIFICATION",
				ruleName: "Mandatory CKYC / KRA Verification",
				regulationRef: "SEBI Circular SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2022/98 & PMLA 2002",
				status: "PASS",
				statutoryThreshold: "KYC Status: VERIFIED",
				observedValue: "VERIFIED",
				details: "Client KYC is fully verified and compliant with PMLA requirements.",
			});
		}

		// 6. Rule: Nominee Mandate
		const hasNominee = request.hasNominee ?? ((profile as any)?.hasNominee || false);
		const optedOut = request.nomineeOptOut ?? ((profile as any)?.nomineeOptOut || false);

		if (!hasNominee && !optedOut) {
			warnings.push(
				"Nominee not declared. SEBI mandates nomination details or an explicit signed opt-out declaration.",
			);
			remedialActions.push(
				"Add a nominee or sign the SEBI nomination opt-out form.",
			);
			checks.push({
				ruleId: "SEBI-MF-NOMINEE-MANDATE",
				ruleName: "Mandatory Nomination Declaration",
				regulationRef: "SEBI Master Circular on Mutual Funds §17.15",
				status: "WARNING",
				statutoryThreshold: "Nominee Declared OR Signed Opt-Out",
				observedValue: "Not Provided",
				details: "Nominee details missing. Folio will require regularisation.",
				remediationSteps: "Submit nominee details or opt-out declaration.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-MF-NOMINEE-MANDATE",
				ruleName: "Mandatory Nomination Declaration",
				regulationRef: "SEBI Master Circular on Mutual Funds §17.15",
				status: "PASS",
				statutoryThreshold: "Nominee Declared OR Signed Opt-Out",
				observedValue: hasNominee ? "Nominee Registered" : "Signed Opt-Out Provided",
				details: "Nomination mandate satisfied per SEBI guidelines.",
			});
		}

		// Score computation: Pass = 100, Warning = 70, Breach = 0
		const checkScores: number[] = checks.map((c) => (c.status === "PASS" ? 100 : c.status === "WARNING" ? 70 : 0));
		const complianceScore = checkScores.length > 0
			? Math.round(checkScores.reduce((a: number, b: number) => a + b, 0) / checkScores.length)
			: 0;

		const isCompliant = breaches.length === 0;

		const report: MfComplianceReport = {
			vehicleType: "MUTUAL_FUND",
			isCompliant,
			overallStatus: isCompliant
				? warnings.length > 0
					? "WARNING"
					: "COMPLIANT"
				: "NON_COMPLIANT",
			complianceScore,
			summary: isCompliant
				? "Mutual Fund transaction complies with SEBI (Mutual Funds) Regulations, 1996."
				: `Mutual Fund transaction blocked due to ${breaches.length} statutory breach(es).`,
			checks,
			breaches,
			warnings,
			remedialActions,
			statutoryDisclaimer:
				"Statutory Notice: Mutual Fund investments are subject to market risks, read all scheme related documents carefully. Past performance is not indicative of future returns. FintekPro acts as a SEBI-registered distributor/adviser.",
			meta: {
				engineVersion: MfComplianceService.ENGINE_VERSION,
				calculationTimestamp: timestamp,
				userId: request.userId,
				schemeCode: request.schemeCode,
			},
		};

		// Audit logging
		await this.logMfAudit(report, request.userId);

		return report;
	}

	private async logMfAudit(
		report: MfComplianceReport,
		userId: string,
	): Promise<void> {
		try {
			logger.info("[MF Compliance Audit]", {
				event: "MF_COMPLIANCE_AUDITED",
				user_id: userId,
				status: report.overallStatus,
				score: report.complianceScore,
				breaches: report.breaches.length,
				engine_version: MfComplianceService.ENGINE_VERSION,
			});

			await db.insert(complianceAuditTrail).values({
				userId,
				action: "MF_STATUTORY_COMPLIANCE_CHECK",
				entityType: "MUTUAL_FUND",
				complianceImpact: report.isCompliant ? "COMPLIANT" : "BREACH",
				metadata: {
					overallStatus: report.overallStatus,
					complianceScore: report.complianceScore,
					breaches: report.breaches,
					warnings: report.warnings,
					schemeCode: report.meta.schemeCode,
					engineVersion: report.meta.engineVersion,
					timestamp: report.meta.calculationTimestamp,
				},
			});
		} catch (err: any) {
			logger.error("[MfCompliance] Failed to write compliance audit trail:", {
				err: err.message,
			});
		}
	}
}

export const mfComplianceService = MfComplianceService.getInstance();
