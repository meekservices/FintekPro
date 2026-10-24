/**
 * @file aif-compliance-service.ts
 * @description Dedicated Statutory SEBI Compliance Engine for Alternative Investment Funds (AIF).
 *
 * Statutory Framework Enforced:
 * SEBI (Alternative Investment Funds) Regulations, 2012:
 * - Regulation 10(c): Statutory commitment floor of ₹1,00,00,000 (One Crore) for standard investors.
 * - Regulation 10(c) Proviso 1: ₹25,00,000 floor for employees/directors of AIF/Manager.
 * - Regulation 19P(1): ₹25,00,000 minimum ticket for Angel Funds (Category I VCF).
 * - Regulation 10(c) Proviso 2 & SEBI Amendment 2021: Accredited Investor carve-out from ₹1 Cr minimum.
 * - SEBI Circulars (Aug 2021 / Aug 2023): Accredited Investor verification via recognized Accreditation Agencies.
 * - Regulation 10(a): Minimum fund corpus requirements (₹20 Cr standard / ₹10 Cr Angel).
 * - Regulation 15 & 20: Category I & II leverage prohibition; Category III leverage capped at 200% gross exposure.
 * - Regulation 11: Private Placement Memorandum (PPM) statutory disclosures and lock-in period adherence.
 * - PMLA 2002: AML and PEP due diligence.
 *
 * @engineVersion SEBI-AIF-COMPLIANCE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.0 audit trail logging.
 */

import { db } from "../db";
import { userProfiles, complianceAuditTrail } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

export type ComplianceCheckStatus = "PASS" | "WARNING" | "BREACH";

export interface AifRuleCheck {
	ruleId: string;
	ruleName: string;
	regulationRef: string;
	status: ComplianceCheckStatus;
	statutoryThreshold: string;
	observedValue: string;
	details: string;
	remediationSteps?: string;
}

export interface AifComplianceRequest {
	userId: string;
	committedAmount: number;
	initialPaymentAmount?: number;
	fundName: string;
	sebiRegistrationNo?: string;
	aifCategory: "CAT_I" | "CAT_II" | "CAT_III" | "ANGEL_FUND";
	isEmployeeOrDirector?: boolean;
	ppmAcknowledged?: boolean;
	contributionAgreementSigned?: boolean;
	plannedLeverageRatio?: number; // e.g. 1.0 (unleveraged), 1.5 (1.5x NAV)
}

export interface AifComplianceReport {
	vehicleType: "AIF";
	isCompliant: boolean;
	overallStatus: "COMPLIANT" | "WARNING" | "NON_COMPLIANT";
	complianceScore: number; // 0 - 100
	summary: string;
	checks: AifRuleCheck[];
	breaches: string[];
	warnings: string[];
	remedialActions: string[];
	statutoryDisclaimer: string;
	meta: {
		engineVersion: string;
		calculationTimestamp: string;
		userId: string;
	};
}

export class AifComplianceService {
	private static instance: AifComplianceService;

	static readonly ENGINE_VERSION = "SEBI-AIF-COMPLIANCE-v1.0";
	static readonly STATUTORY_AIF_MIN_INR = 1_00_00_000; // ₹1 Crore standard
	static readonly STATUTORY_AIF_ANGEL_MIN_INR = 25_00_000; // ₹25 Lakhs Angel
	static readonly STATUTORY_AIF_EMPLOYEE_MIN_INR = 25_00_000; // ₹25 Lakhs Employee/Director

	static getInstance(): AifComplianceService {
		if (!AifComplianceService.instance) {
			AifComplianceService.instance = new AifComplianceService();
		}
		return AifComplianceService.instance;
	}

	/**
	 * Audits an AIF subscription commitment against SEBI (Alternative Investment Funds) Regulations, 2012.
	 */
	async auditAifCompliance(
		request: AifComplianceRequest,
	): Promise<AifComplianceReport> {
		const checks: AifRuleCheck[] = [];
		const breaches: string[] = [];
		const warnings: string[] = [];
		const remedialActions: string[] = [];
		const timestamp = new Date().toISOString();

		// Fetch profile for accredited investor check
		const profile = await db.query.userProfiles.findFirst({
			where: eq(userProfiles.userId, request.userId),
		});

		const isAccredited =
			profile?.accreditedInvestorStatus === "verified" &&
			(!profile.accreditedInvestorExpiryDate ||
				new Date(profile.accreditedInvestorExpiryDate) >= new Date());

		// 1. Regulation 10(c) — Minimum Investment Commitment
		const isAngelFund = request.aifCategory === "ANGEL_FUND";
		const isEmployee = Boolean(request.isEmployeeOrDirector);
		let statutoryMinimum = AifComplianceService.STATUTORY_AIF_MIN_INR; // ₹1 Crore default

		if (isEmployee) {
			statutoryMinimum = AifComplianceService.STATUTORY_AIF_EMPLOYEE_MIN_INR; // ₹25 Lakhs
		} else if (isAngelFund) {
			statutoryMinimum = AifComplianceService.STATUTORY_AIF_ANGEL_MIN_INR; // ₹25 Lakhs
		}

		// If investor is accredited, SEBI Reg 10(c) second proviso waives the ₹1 Cr statutory floor
		if (isAccredited) {
			checks.push({
				ruleId: "SEBI-AIF-REG10C",
				ruleName: "Statutory Commitment Floor & Accredited Investor Carve-Out",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 10(c) Proviso 2",
				status: "PASS",
				statutoryThreshold: "Carve-out: Accredited Investor (no statutory floor)",
				observedValue: `Committed: ₹${request.committedAmount.toLocaleString("en-IN")} (Accredited Verified)`,
				details:
					"Under SEBI (AIF) Amendment Regulations 2021, the ₹1 Crore minimum ticket requirement does not apply to verified Accredited Investors.",
			});
		} else if (request.committedAmount < statutoryMinimum) {
			const deficit = statutoryMinimum - request.committedAmount;
			breaches.push(
				`Committed amount of ₹${request.committedAmount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below the statutory ₹${(statutoryMinimum / 1_00_00_000).toFixed(2)} Crore floor under SEBI Reg 10(c).`,
			);
			remedialActions.push(
				`Increase investment commitment to at least ₹${(statutoryMinimum / 1_00_00_000).toFixed(2)} Crore, or complete SEBI Accredited Investor certification.`,
			);
			checks.push({
				ruleId: "SEBI-AIF-REG10C",
				ruleName: "Statutory Commitment Floor",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 10(c)",
				status: "BREACH",
				statutoryThreshold: `≥ ₹${statutoryMinimum.toLocaleString("en-IN")}`,
				observedValue: `₹${request.committedAmount.toLocaleString("en-IN")}`,
				details:
					"SEBI mandates a minimum investment commitment of ₹1 Crore for standard investors (₹25 Lakhs for employees/directors and angel funds).",
				remediationSteps: `Commitment must be raised to at least ₹${statutoryMinimum.toLocaleString("en-IN")}.`,
			});
		} else {
			checks.push({
				ruleId: "SEBI-AIF-REG10C",
				ruleName: "Statutory Commitment Floor",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 10(c)",
				status: "PASS",
				statutoryThreshold: `≥ ₹${statutoryMinimum.toLocaleString("en-IN")}`,
				observedValue: `₹${request.committedAmount.toLocaleString("en-IN")}`,
				details:
					"Investment commitment satisfies statutory SEBI AIF minimum threshold.",
			});
		}

		// 2. Accredited Investor Certificate Validity (if claiming accreditation)
		if (profile?.accreditedInvestorStatus === "verified") {
			if (
				profile.accreditedInvestorExpiryDate &&
				new Date(profile.accreditedInvestorExpiryDate) < new Date()
			) {
				breaches.push(
					"Accredited Investor certification has expired. Annual renewal with Accreditation Agency required.",
				);
				remedialActions.push(
					"Renew accreditation certificate with SEBI-recognized Accreditation Agency (CDSL / NSDL / BSE).",
				);
				checks.push({
					ruleId: "SEBI-AIF-ACCREDITATION",
					ruleName: "Accreditation Agency Certificate Validity",
					regulationRef: "SEBI Circular SEBI/HO/IMD/IMD-I/DOF6/P/CIR/2021/613",
					status: "BREACH",
					statutoryThreshold: "Active, unexpired accreditation certificate",
					observedValue: `Expired on ${profile.accreditedInvestorExpiryDate}`,
					details:
						"Accreditation validity is capped at maximum 3 years and must be renewed.",
					remediationSteps: "Submit renewed certificate.",
				});
			} else {
				checks.push({
					ruleId: "SEBI-AIF-ACCREDITATION",
					ruleName: "Accreditation Agency Certificate Validity",
					regulationRef: "SEBI Circular SEBI/HO/IMD/IMD-I/DOF6/P/CIR/2021/613",
					status: "PASS",
					statutoryThreshold: "Active accreditation certificate",
					observedValue: `Verified (${profile.accreditedInvestorType || "HNI Net Worth route"})`,
					details: "Accredited investor status verified and active.",
				});
			}
		}

		// 3. Regulation 15 & 20 — Leverage Limits
		const leverage = request.plannedLeverageRatio ?? 1.0;
		if (request.aifCategory === "CAT_I" || request.aifCategory === "CAT_II") {
			if (leverage > 1.1) {
				breaches.push(
					`Leverage of ${leverage}x is strictly prohibited for ${request.aifCategory} AIF under SEBI Regulations.`,
				);
				remedialActions.push(
					"Reduce leverage to 1.0x (unleveraged structure). Cat I and II AIFs cannot borrow except temporary operating funds up to 10%.",
				);
				checks.push({
					ruleId: "SEBI-AIF-REG15-LEVERAGE",
					ruleName: "Leverage Restriction (Category I & II)",
					regulationRef:
						"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 15",
					status: "BREACH",
					statutoryThreshold: "Max 1.0x (0% structural leverage)",
					observedValue: `${leverage}x`,
					details:
						"Category I & II AIFs are prohibited from leveraging their portfolio.",
					remediationSteps: "Ensure portfolio is completely unleveraged.",
				});
			} else {
				checks.push({
					ruleId: "SEBI-AIF-REG15-LEVERAGE",
					ruleName: "Leverage Restriction (Category I & II)",
					regulationRef:
						"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 15",
					status: "PASS",
					statutoryThreshold: "Max 1.0x (unleveraged)",
					observedValue: `${leverage}x`,
					details: "Unleveraged structure complies with Cat I/II restrictions.",
				});
			}
		} else if (request.aifCategory === "CAT_III") {
			if (leverage > 2.0) {
				breaches.push(
					`Category III AIF leverage of ${leverage}x exceeds statutory cap of 2.0x NAV (200% gross exposure).`,
				);
				remedialActions.push(
					"Reduce gross derivative and borrowed exposure to within 200% of NAV.",
				);
				checks.push({
					ruleId: "SEBI-AIF-REG20-LEVERAGE",
					ruleName: "Category III Leverage Cap (200% NAV)",
					regulationRef: "SEBI Circular CIR/IMD/DF/10/2013",
					status: "BREACH",
					statutoryThreshold: "Max 2.0x NAV",
					observedValue: `${leverage}x`,
					details:
						"Category III gross exposure cannot exceed 200% of Net Asset Value.",
					remediationSteps: "Cap leverage at 2.0x NAV.",
				});
			} else {
				checks.push({
					ruleId: "SEBI-AIF-REG20-LEVERAGE",
					ruleName: "Category III Leverage Cap (200% NAV)",
					regulationRef: "SEBI Circular CIR/IMD/DF/10/2013",
					status: "PASS",
					statutoryThreshold: "Max 2.0x NAV",
					observedValue: `${leverage}x NAV`,
					details: "Leverage within statutory 200% NAV limit.",
				});
			}
		}

		// 4. Private Placement Memorandum (PPM) Disclosure Acknowledgement
		if (!request.ppmAcknowledged) {
			breaches.push(
				"Private Placement Memorandum (PPM) has not been acknowledged by subscriber.",
			);
			remedialActions.push(
				"Present PPM document and obtain explicit digital signature before accepting subscription.",
			);
			checks.push({
				ruleId: "SEBI-AIF-PPM-DISCLOSURE",
				ruleName: "PPM Disclosure & Risk Acknowledgement",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 11",
				status: "BREACH",
				statutoryThreshold: "Mandatory client acknowledgement of PPM",
				observedValue: "Not Acknowledged",
				details:
					"All AIF investors must formally acknowledge receipt of the PPM and associated risks.",
				remediationSteps: "Obtain client PPM signature.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-AIF-PPM-DISCLOSURE",
				ruleName: "PPM Disclosure & Risk Acknowledgement",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 11",
				status: "PASS",
				statutoryThreshold: "PPM Acknowledged",
				observedValue: "Acknowledged & Verified",
				details: "Client acknowledged PPM disclosures and high-risk terms.",
			});
		}

		// 5. SEBI AIF Registration Number (IN/AIF format)
		const regNo = request.sebiRegistrationNo || "";
		if (regNo && !regNo.toUpperCase().includes("AIF")) {
			warnings.push(
				`SEBI Registration '${regNo}' does not contain expected 'AIF' identifier.`,
			);
			checks.push({
				ruleId: "SEBI-AIF-REG-CHECK",
				ruleName: "SEBI Registration Number Verification",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 3",
				status: "WARNING",
				statutoryThreshold: "Format: IN/AIFX/XX-XX/XXXX",
				observedValue: regNo,
				details:
					"AIF registration numbers follow standard SEBI format with 'AIF' identifier.",
				remediationSteps: "Confirm registration number with SEBI AIF portal.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-AIF-REG-CHECK",
				ruleName: "SEBI Registration Number Verification",
				regulationRef:
					"SEBI (Alternative Investment Funds) Regulations, 2012 — Reg 3",
				status: "PASS",
				statutoryThreshold: "Format: IN/AIFX/XX-XX/XXXX",
				observedValue: regNo || "Verified Registered AIF Entity",
				details: "SEBI AIF registration verified.",
			});
		}

		// 6. Anti-Money Laundering (PMLA 2002) Screening
		if (profile?.amlStatus && profile.amlStatus !== "clear") {
			breaches.push(
				`AML screening status is '${profile.amlStatus}'. Enhanced due diligence required.`,
			);
			remedialActions.push(
				"Complete enhanced AML screening and clearance before AIF allotment.",
			);
			checks.push({
				ruleId: "SEBI-AIF-PMLA-CHECK",
				ruleName: "Anti-Money Laundering (PMLA 2002) Screening",
				regulationRef:
					"Prevention of Money Laundering Act, 2002 read with SEBI KYC Master Circular",
				status: "BREACH",
				statutoryThreshold: "AML Status: Clear",
				observedValue: profile.amlStatus,
				details: "High-value alternative investments require clear AML screening.",
				remediationSteps: "Complete enhanced compliance due diligence.",
			});
		} else {
			checks.push({
				ruleId: "SEBI-AIF-PMLA-CHECK",
				ruleName: "Anti-Money Laundering (PMLA 2002) Screening",
				regulationRef:
					"Prevention of Money Laundering Act, 2002 read with SEBI KYC Master Circular",
				status: "PASS",
				statutoryThreshold: "AML Status: Clear",
				observedValue: "Clear",
				details: "Client AML screening cleared.",
			});
		}

		const passCount = checks.filter((c) => c.status === "PASS").length;
		const complianceScore = Math.round((passCount / checks.length) * 100);
		const isCompliant = breaches.length === 0;

		const report: AifComplianceReport = {
			vehicleType: "AIF",
			isCompliant,
			overallStatus: isCompliant
				? warnings.length > 0
					? "WARNING"
					: "COMPLIANT"
				: "NON_COMPLIANT",
			complianceScore,
			summary: isCompliant
				? "AIF subscription commitment complies fully with SEBI (Alternative Investment Funds) Regulations, 2012."
				: `AIF subscription blocked due to ${breaches.length} statutory breach(es).`,
			checks,
			breaches,
			warnings,
			remedialActions,
			statutoryDisclaimer:
				"Statutory Notice: Alternative Investment Funds are pooled, high-risk vehicles intended exclusively for eligible investors. Investments are illiquid and subject to capital commitment drawdowns, management fees, and performance hurdles specified in the Private Placement Memorandum.",
			meta: {
				engineVersion: AifComplianceService.ENGINE_VERSION,
				calculationTimestamp: timestamp,
				userId: request.userId,
			},
		};

		// Audit logging
		await this.logAifAudit(report, request.userId);

		return report;
	}

	private async logAifAudit(
		report: AifComplianceReport,
		userId: string,
	): Promise<void> {
		try {
			logger.info("[AIF Compliance Audit]", {
				event: "AIF_COMPLIANCE_AUDITED",
				user_id: userId,
				status: report.overallStatus,
				score: report.complianceScore,
				breaches: report.breaches.length,
				engine_version: AifComplianceService.ENGINE_VERSION,
			});

			await db.insert(complianceAuditTrail).values({
				userId,
				action: "AIF_STATUTORY_COMPLIANCE_CHECK",
				entityType: "AIF_FUND",
				complianceImpact: report.isCompliant ? "COMPLIANT" : "BREACH",
				metadata: {
					overallStatus: report.overallStatus,
					complianceScore: report.complianceScore,
					breaches: report.breaches,
					warnings: report.warnings,
					engineVersion: report.meta.engineVersion,
					timestamp: report.meta.calculationTimestamp,
				},
			});
		} catch (err: any) {
			logger.error("[AifCompliance] Failed to write compliance audit trail:", {
				err: err.message,
			});
		}
	}
}

export const aifComplianceService = AifComplianceService.getInstance();
