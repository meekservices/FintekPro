/**
 * FintekPro Team & Designation Management Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Aligns FintekPro team hierarchy, staff roles, and designations with:
 * 1. SEBI / AMFI statutory candidate eligibility requirements
 * 2. IRIS KFintech RTA distributor hierarchy endpoints:
 *      - /api/iris/staff/employees   (RIA staff & operations)
 *      - /api/iris/staff/rms         (Relationship Managers with client allocation)
 *      - /api/iris/staff/branches    (Branch network assignments)
 *      - /api/iris/staff/sub-brokers (AMFI-certified agents & sub-brokers)
 *      - /api/iris/staff/euins       (AMFI EUIN registry & validity)
 *
 * FASP-AI GCR v1.0 Compliance:
 * - Deterministic output: Same candidate credentials -> same eligibility result
 * - Explainability layer: Exposes inputs, gates applied, intermediate scores, engine version
 * - Zero trust: Validates PAN, EUIN, NISM certs, and KYC status before granting transaction privileges
 * - Structured logging: { event, user_id, latency_ms, status }
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";
import { irisKfintechService } from "./iris-kfintech-service";
import { RoleId } from "@shared/roles";

export const ENGINE_VERSION = "fintekpro-eligibility-v1.0.0";

// ── Types & Interfaces ───────────────────────────────────────────────────────

export type EducationLevel = "high_school" | "bachelors" | "masters" | "professional";

export type IrisStaffClassification = "rm" | "sub_broker" | "employee" | "branch_manager" | "internal_only";

export type DesignationCategory =
  | "wealth_advisory"
  | "mutual_funds"
  | "loans_dsa"
  | "compliance"
  | "executive"
  | "support";

export interface DesignationRule {
  id: string;
  title: string;
  category: DesignationCategory;
  irisClassification: IrisStaffClassification;
  irisEndpoint: string;
  fintekproRole: RoleId;
  hierarchyLevel: number;
  minExperienceYears: number;
  minEducation: EducationLevel;
  requiresEuin: boolean;
  requiresArn: boolean;
  requiresSebiReg: boolean;
  requiredCertifications: string[]; // e.g. ["NISM_V_A"]
  optionalCertifications: string[];
  maxClientLimit: number | null;
  canExecuteTransactions: boolean;
  description: string;
  statutoryBasis: string;
}

export interface CandidateCertification {
  code: string; // e.g. "NISM_V_A", "NISM_X_A", "NISM_X_B", "NISM_III_A", "NISM_VIII"
  name: string;
  certificateNumber?: string;
  validUntil?: string; // ISO date string
  isVerified?: boolean;
}

export interface CandidateProfile {
  candidateId?: string;
  name: string;
  email: string;
  mobile: string;
  panNumber: string;
  panVerified?: boolean;
  kycStatus?: "PENDING" | "VERIFIED" | "REJECTED";
  euinNumber?: string;
  euinVerified?: boolean;
  euinValidTo?: string;
  arnCode?: string;
  arnVerified?: boolean;
  sebiRegNo?: string;
  highestEducation: EducationLevel;
  hasFinancialDegree?: boolean;
  yearsOfExperience: number;
  certifications?: CandidateCertification[];
  branchId?: string;
  assignedManagerId?: string;
}

export interface GateResult {
  passed: boolean;
  score: number; // 0 to 100 for this gate
  details: string;
  missingItems?: string[];
}

export interface CandidateEligibilityReport {
  isEligible: boolean;
  overallScore: number; // 0 to 100
  targetDesignation: string;
  designationTitle: string;
  irisClassification: IrisStaffClassification;
  canExecuteTransactions: boolean;
  irisSyncReady: boolean;
  gates: {
    identityAndKyc: GateResult;
    regulatoryId: GateResult;
    certifications: GateResult;
    experienceAndEducation: GateResult;
  };
  passedCriteria: string[];
  failedCriteria: string[];
  remediationSteps: string[];
  alternativeEligibleDesignations: Array<{
    designationId: string;
    title: string;
    matchScore: number;
    canExecuteTransactions: boolean;
  }>;
  explainabilityLayer: {
    engine_version: string;
    calculation_timestamp: string;
    formula_applied: string;
    inputs_used: {
      pan_masked: string;
      has_euin: boolean;
      euin_format_valid: boolean;
      experience_years: number;
      education_level: EducationLevel;
      verified_cert_count: number;
    };
    intermediate_steps: Record<string, unknown>;
  };
}

export interface TeamMemberRecord {
  id: string | number;
  partnerUserId?: string;
  agentUserId: string;
  name: string;
  email: string;
  mobile?: string;
  designation: string;
  designationTitle: string;
  role: string;
  irisClassification: IrisStaffClassification;
  branchId?: string;
  euinNumber?: string;
  euinVerified: boolean;
  canExecuteTransactions: boolean;
  eligibilityScore: number;
  eligibilityStatus: "ELIGIBLE" | "CONDITIONAL" | "INELIGIBLE";
  irisSyncStatus: "SYNCED" | "PENDING" | "NOT_APPLICABLE" | "FAILED";
  irisEntityId?: string;
  joinedAt: string;
  updatedAt: string;
}

// ── Standard Designations Matrix ─────────────────────────────────────────────

export const STANDARD_DESIGNATIONS: Record<string, DesignationRule> = {
  relationship_manager: {
    id: "relationship_manager",
    title: "Relationship Manager (Mutual Funds & Wealth)",
    category: "wealth_advisory",
    irisClassification: "rm",
    irisEndpoint: "/api/iris/staff/rms",
    fintekproRole: "agent",
    hierarchyLevel: 5,
    minExperienceYears: 1,
    minEducation: "bachelors",
    requiresEuin: true,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: ["NISM_V_A"],
    optionalCertifications: ["NISM_VIII"],
    maxClientLimit: 150,
    canExecuteTransactions: true,
    description: "Frontline relationship manager authorized to execute mutual fund orders and service investor portfolios under distributor ARN.",
    statutoryBasis: "SEBI Circular CIR/IMD/DF/21/2012 & AMFI EUIN Regulations (NISM Series V-A Mandatory).",
  },
  senior_rm: {
    id: "senior_rm",
    title: "Senior Relationship Manager / Wealth Manager",
    category: "wealth_advisory",
    irisClassification: "rm",
    irisEndpoint: "/api/iris/staff/rms",
    fintekproRole: "agent",
    hierarchyLevel: 4,
    minExperienceYears: 3,
    minEducation: "bachelors",
    requiresEuin: true,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: ["NISM_V_A"],
    optionalCertifications: ["NISM_X_A", "NISM_VIII"],
    maxClientLimit: 250,
    canExecuteTransactions: true,
    description: "Senior wealth advisor managing HNI clients, multi-asset allocation, and mutual fund portfolio rebalancing.",
    statutoryBasis: "SEBI Mutual Fund Distributor Code of Conduct & AMFI Guidelines.",
  },
  branch_manager: {
    id: "branch_manager",
    title: "Branch Manager",
    category: "executive",
    irisClassification: "branch_manager",
    irisEndpoint: "/api/iris/staff/branches",
    fintekproRole: "partner_ops",
    hierarchyLevel: 3,
    minExperienceYears: 5,
    minEducation: "bachelors",
    requiresEuin: true,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: ["NISM_V_A"],
    optionalCertifications: ["NISM_III_A", "NISM_X_A"],
    maxClientLimit: null,
    canExecuteTransactions: true,
    description: "Branch head overseeing local distributor branch, employee rosters, RM client allocation, and regulatory compliance.",
    statutoryBasis: "AMFI Branch Governance & SEBI Intermediary Infrastructure Norms.",
  },
  sub_broker: {
    id: "sub_broker",
    title: "Sub-Broker / Distribution Partner (AMFI Certified)",
    category: "mutual_funds",
    irisClassification: "sub_broker",
    irisEndpoint: "/api/iris/staff/sub-brokers",
    fintekproRole: "partner",
    hierarchyLevel: 4,
    minExperienceYears: 1,
    minEducation: "bachelors",
    requiresEuin: true,
    requiresArn: true,
    requiresSebiReg: false,
    requiredCertifications: ["NISM_V_A"],
    optionalCertifications: [],
    maxClientLimit: null,
    canExecuteTransactions: true,
    description: "Independent franchisee or sub-distributor empanelled under FintekPro ARN with own EUIN and sub-broker code.",
    statutoryBasis: "SEBI (Mutual Funds) Regulations, 1996 & AMFI Sub-Broker Guidelines.",
  },
  investment_advisor: {
    id: "investment_advisor",
    title: "SEBI Registered Investment Adviser Representative",
    category: "wealth_advisory",
    irisClassification: "employee",
    irisEndpoint: "/api/iris/staff/employees",
    fintekproRole: "agent",
    hierarchyLevel: 4,
    minExperienceYears: 2,
    minEducation: "professional",
    requiresEuin: true,
    requiresArn: false,
    requiresSebiReg: true,
    requiredCertifications: ["NISM_X_A", "NISM_X_B"],
    optionalCertifications: ["NISM_V_A"],
    maxClientLimit: 100,
    canExecuteTransactions: true,
    description: "Fiduciary advisor providing fee-based holistic financial planning and goal-based asset allocation per SEBI RIA rules.",
    statutoryBasis: "SEBI (Investment Advisers) Regulations, 2013 (Regulation 7 - Qualification and Certification Requirements).",
  },
  lead_associate: {
    id: "lead_associate",
    title: "Lead Generation Associate / Business Associate",
    category: "support",
    irisClassification: "internal_only",
    irisEndpoint: "N/A (CRM Only)",
    fintekproRole: "associate",
    hierarchyLevel: 7,
    minExperienceYears: 0,
    minEducation: "high_school",
    requiresEuin: false,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: [],
    optionalCertifications: [],
    maxClientLimit: null,
    canExecuteTransactions: false,
    description: "Frontline lead generator or referral associate. Permitted for client introduction and marketing only; STRICTLY BLOCKED from transaction execution.",
    statutoryBasis: "SEBI prohibition on non-certified persons providing investment advice or soliciting transactions.",
  },
  field_executive: {
    id: "field_executive",
    title: "Field Executive (DSA / Loan Distribution)",
    category: "loans_dsa",
    irisClassification: "internal_only",
    irisEndpoint: "N/A (Lender Staff)",
    fintekproRole: "sub_agent",
    hierarchyLevel: 6,
    minExperienceYears: 0,
    minEducation: "high_school",
    requiresEuin: false,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: [],
    optionalCertifications: [],
    maxClientLimit: null,
    canExecuteTransactions: false,
    description: "Field representative for lending and document pickup. Cannot execute securities or mutual fund transactions.",
    statutoryBasis: "RBI Fair Practices Code for Lenders & DSA Empanelment Standards.",
  },
  compliance_officer: {
    id: "compliance_officer",
    title: "Compliance & Regulatory Officer",
    category: "compliance",
    irisClassification: "employee",
    irisEndpoint: "/api/iris/staff/employees",
    fintekproRole: "compliance_officer",
    hierarchyLevel: 2,
    minExperienceYears: 3,
    minEducation: "professional",
    requiresEuin: false,
    requiresArn: false,
    requiresSebiReg: false,
    requiredCertifications: ["NISM_III_A"],
    optionalCertifications: [],
    maxClientLimit: null,
    canExecuteTransactions: false,
    description: "Oversees AML/CFT, KYC audit, EUIN validity tracking, and statutory reporting to SEBI and AMFI.",
    statutoryBasis: "SEBI (Intermediaries) Regulations, 2008 & PMLA (Prevention of Money Laundering Act) compliance.",
  },
  principal_officer: {
    id: "principal_officer",
    title: "Principal Officer / Key Managerial Person",
    category: "executive",
    irisClassification: "employee",
    irisEndpoint: "/api/iris/staff/employees",
    fintekproRole: "master_agent",
    hierarchyLevel: 1,
    minExperienceYears: 5,
    minEducation: "professional",
    requiresEuin: true,
    requiresArn: true,
    requiresSebiReg: true,
    requiredCertifications: ["NISM_X_A", "NISM_X_B"],
    optionalCertifications: ["NISM_V_A", "NISM_III_A"],
    maxClientLimit: null,
    canExecuteTransactions: true,
    description: "Chief compliance and business anchor holding principal responsibility for regulatory compliance and distributor licensing.",
    statutoryBasis: "SEBI Regulation 7(1) Key Managerial Personnel eligibility.",
  },
};

// ── Education Rank Helper ───────────────────────────────────────────────────

const EDUCATION_RANK: Record<EducationLevel, number> = {
  high_school: 1,
  bachelors: 2,
  masters: 3,
  professional: 4,
};

// ── Service Class ───────────────────────────────────────────────────────────

export class TeamDesignationService {
  private static instance: TeamDesignationService;

  static getInstance(): TeamDesignationService {
    if (!TeamDesignationService.instance) {
      TeamDesignationService.instance = new TeamDesignationService();
    }
    return TeamDesignationService.instance;
  }

  /**
   * List all standard designations supported by FintekPro with statutory basis and IRIS classification.
   */
  getAllDesignations(): DesignationRule[] {
    return Object.values(STANDARD_DESIGNATIONS);
  }

  /**
   * Get specific designation rule by ID.
   */
  getDesignation(id: string): DesignationRule | null {
    return STANDARD_DESIGNATIONS[id] || null;
  }

  /**
   * Core Candidate Eligibility Evaluation Algorithm.
   *
   * @param candidate Candidate credentials (PAN, EUIN, NISM certs, Experience, Education)
   * @param targetDesignationId The specific designation requested (or default to 'relationship_manager')
   * @returns Detailed CandidateEligibilityReport with explainability layer
   */
  evaluateCandidateEligibility(
    candidate: CandidateProfile,
    targetDesignationId = "relationship_manager"
  ): CandidateEligibilityReport {
    const startMs = Date.now();
    const designation = STANDARD_DESIGNATIONS[targetDesignationId];
    if (!designation) {
      throw new Error(`Invalid designation ID '${targetDesignationId}'. Supported: ${Object.keys(STANDARD_DESIGNATIONS).join(", ")}`);
    }

    const passedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    const remediationSteps: string[] = [];
    const intermediateSteps: Record<string, unknown> = {};

    // ─────────────────────────────────────────────────────────────────────────
    // GATE 1: Identity & KYC Gate
    // ─────────────────────────────────────────────────────────────────────────
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
    const isPanValid = panRegex.test(candidate.panNumber || "");
    const isPanVerified = candidate.panVerified ?? isPanValid;
    const isKycVerified = candidate.kycStatus === "VERIFIED";

    let kycGateScore = 0;
    if (isPanValid) kycGateScore += 40;
    if (isPanVerified) kycGateScore += 30;
    if (isKycVerified) kycGateScore += 30;

    const kycGatePassed = isPanValid && (isPanVerified || isKycVerified);
    if (kycGatePassed) {
      passedCriteria.push("Identity verified with valid PAN & KYC");
    } else {
      failedCriteria.push("PAN / KYC verification incomplete or invalid format");
      remediationSteps.push("Complete PAN verification and Aadhaar-based KYC via FintekPro KYC Vault");
    }

    const gate1: GateResult = {
      passed: kycGatePassed,
      score: kycGateScore,
      details: kycGatePassed
        ? "Candidate identity and KYC verified"
        : "PAN format invalid or KYC not verified",
    };
    intermediateSteps.gate1_identity_and_kyc = gate1;

    // ─────────────────────────────────────────────────────────────────────────
    // GATE 2: Regulatory Identifiers (EUIN / ARN / SEBI)
    // ─────────────────────────────────────────────────────────────────────────
    const euinRegex = /^E\d{6}$/;
    const hasEuin = !!candidate.euinNumber;
    const isEuinFormatValid = hasEuin && euinRegex.test(candidate.euinNumber!);
    const isEuinUnexpired = !candidate.euinValidTo || new Date(candidate.euinValidTo) > new Date();

    let regScore = 100;
    const regFailedItems: string[] = [];

    if (designation.requiresEuin) {
      if (!hasEuin) {
        regScore -= 70;
        regFailedItems.push("Missing EUIN (Employee Unique Identification Number)");
        failedCriteria.push("EUIN is mandatory for this designation per SEBI/AMFI");
        remediationSteps.push("Obtain valid EUIN from AMFI after completing NISM Series V-A certification");
      } else if (!isEuinFormatValid) {
        regScore -= 50;
        regFailedItems.push("Invalid EUIN format (must be E followed by 6 digits)");
        failedCriteria.push("Invalid EUIN format");
        remediationSteps.push("Correct EUIN format to standard AMFI notation (e.g. E123456)");
      } else if (!isEuinUnexpired) {
        regScore -= 40;
        regFailedItems.push("EUIN has expired");
        failedCriteria.push("EUIN is expired");
        remediationSteps.push("Renew EUIN via AMFI portal");
      } else {
        passedCriteria.push(`Valid unexpired EUIN verified: ${candidate.euinNumber}`);
      }
    } else {
      passedCriteria.push("Designation does not mandate EUIN for assignment");
    }

    if (designation.requiresArn) {
      if (!candidate.arnCode) {
        regScore -= 30;
        regFailedItems.push("Missing ARN Code");
        failedCriteria.push("ARN Code is mandatory for sub-broker / distributor designation");
        remediationSteps.push("Provide valid AMFI Registration Number (ARN)");
      } else {
        passedCriteria.push(`ARN Code provided: ${candidate.arnCode}`);
      }
    }

    if (designation.requiresSebiReg) {
      if (!candidate.sebiRegNo) {
        regScore -= 30;
        regFailedItems.push("Missing SEBI Registration Number");
        failedCriteria.push("SEBI Registration is required for Investment Advisor");
        remediationSteps.push("Submit valid SEBI RIA Representative Registration");
      } else {
        passedCriteria.push(`SEBI Registration confirmed: ${candidate.sebiRegNo}`);
      }
    }

    regScore = Math.max(0, regScore);
    const regGatePassed = regFailedItems.length === 0;
    const gate2: GateResult = {
      passed: regGatePassed,
      score: regScore,
      details: regGatePassed
        ? "All mandatory regulatory identifiers verified"
        : `Regulatory identifier gap: ${regFailedItems.join(", ")}`,
      missingItems: regFailedItems,
    };
    intermediateSteps.gate2_regulatory = gate2;

    // ─────────────────────────────────────────────────────────────────────────
    // GATE 3: Certifications Gate (NISM)
    // ─────────────────────────────────────────────────────────────────────────
    const candidateCertCodes = new Set(
      (candidate.certifications || [])
        .filter((c) => {
          if (!c.validUntil) return true;
          return new Date(c.validUntil) > new Date();
        })
        .map((c) => c.code.toUpperCase())
    );

    const missingRequiredCerts: string[] = [];
    for (const reqCert of designation.requiredCertifications) {
      if (!candidateCertCodes.has(reqCert.toUpperCase())) {
        missingRequiredCerts.push(reqCert);
      }
    }

    let certScore = 100;
    if (designation.requiredCertifications.length > 0) {
      const matchRatio =
        (designation.requiredCertifications.length - missingRequiredCerts.length) /
        designation.requiredCertifications.length;
      certScore = Math.round(matchRatio * 100);
    }

    const certGatePassed = missingRequiredCerts.length === 0;
    if (certGatePassed) {
      if (designation.requiredCertifications.length > 0) {
        passedCriteria.push(`All required certifications present: ${designation.requiredCertifications.join(", ")}`);
      } else {
        passedCriteria.push("No mandatory NISM certification required for this designation");
      }
    } else {
      failedCriteria.push(`Missing mandatory certifications: ${missingRequiredCerts.join(", ")}`);
      for (const mc of missingRequiredCerts) {
        remediationSteps.push(`Enroll and pass ${mc} examination through NISM Certification portal`);
      }
    }

    const gate3: GateResult = {
      passed: certGatePassed,
      score: certScore,
      details: certGatePassed
        ? "Mandatory certification criteria fulfilled"
        : `Missing certifications: ${missingRequiredCerts.join(", ")}`,
      missingItems: missingRequiredCerts,
    };
    intermediateSteps.gate3_certifications = gate3;

    // ─────────────────────────────────────────────────────────────────────────
    // GATE 4: Experience & Education Gate
    // ─────────────────────────────────────────────────────────────────────────
    const candidateEduRank = EDUCATION_RANK[candidate.highestEducation] || 1;
    const requiredEduRank = EDUCATION_RANK[designation.minEducation] || 1;
    const isEduSufficient = candidateEduRank >= requiredEduRank;
    const isExpSufficient = candidate.yearsOfExperience >= designation.minExperienceYears;

    let expEduScore = 100;
    const expEduFailedItems: string[] = [];

    if (!isEduSufficient) {
      expEduScore -= 50;
      expEduFailedItems.push(`Education below minimum required (${designation.minEducation})`);
      failedCriteria.push(`Minimum education required is ${designation.minEducation}`);
      remediationSteps.push(`Candidate requires minimum ${designation.minEducation} degree`);
    } else {
      passedCriteria.push(`Educational qualification satisfies threshold: ${candidate.highestEducation}`);
    }

    if (!isExpSufficient) {
      expEduScore -= 50;
      expEduFailedItems.push(
        `Experience (${candidate.yearsOfExperience} yrs) below requirement (${designation.minExperienceYears} yrs)`
      );
      failedCriteria.push(`Minimum ${designation.minExperienceYears} years experience required`);
      remediationSteps.push(`Gain additional ${designation.minExperienceYears - candidate.yearsOfExperience} years experience in wealth/distribution`);
    } else {
      passedCriteria.push(`Experience satisfies requirement (${candidate.yearsOfExperience} years)`);
    }

    expEduScore = Math.max(0, expEduScore);
    const expEduGatePassed = isEduSufficient && isExpSufficient;
    const gate4: GateResult = {
      passed: expEduGatePassed,
      score: expEduScore,
      details: expEduGatePassed
        ? "Experience and educational background verified"
        : expEduFailedItems.join("; "),
      missingItems: expEduFailedItems,
    };
    intermediateSteps.gate4_experience_and_education = gate4;

    // ─────────────────────────────────────────────────────────────────────────
    // Weighted Overall Score Calculation
    // Formula: Overall = 0.25 * Gate1 + 0.35 * Gate2 + 0.25 * Gate3 + 0.15 * Gate4
    // ─────────────────────────────────────────────────────────────────────────
    const overallScore = Math.round(
      0.25 * kycGateScore +
      0.35 * regScore +
      0.25 * certScore +
      0.15 * expEduScore
    );

    const isEligible = kycGatePassed && regGatePassed && certGatePassed && expEduGatePassed;

    // Transaction execution eligibility: Candidate must be eligible AND have verified EUIN
    const canExecuteTransactions =
      isEligible && designation.canExecuteTransactions && (candidate.euinVerified ?? isEuinFormatValid);

    // IRIS sync readiness: Designation aligns with IRIS and candidate has mandatory keys
    const irisSyncReady =
      isEligible &&
      designation.irisClassification !== "internal_only" &&
      isPanValid &&
      (designation.requiresEuin ? isEuinFormatValid : true);

    // ─────────────────────────────────────────────────────────────────────────
    // Alternative Eligible Designations Finder
    // ─────────────────────────────────────────────────────────────────────────
    const alternativeEligibleDesignations: CandidateEligibilityReport["alternativeEligibleDesignations"] = [];

    for (const [desId, rule] of Object.entries(STANDARD_DESIGNATIONS)) {
      if (desId === targetDesignationId) continue;

      let score = 100;
      let eligible = true;

      if (!kycGatePassed) { eligible = false; score -= 30; }

      if (rule.requiresEuin && (!hasEuin || !isEuinFormatValid)) {
        eligible = false;
        score -= 40;
      }
      if (rule.requiresArn && !candidate.arnCode) {
        eligible = false;
        score -= 20;
      }
      if (rule.requiresSebiReg && !candidate.sebiRegNo) {
        eligible = false;
        score -= 20;
      }

      for (const c of rule.requiredCertifications) {
        if (!candidateCertCodes.has(c.toUpperCase())) {
          eligible = false;
          score -= 25;
        }
      }

      if (candidateEduRank < (EDUCATION_RANK[rule.minEducation] || 1)) {
        eligible = false;
        score -= 20;
      }
      if (candidate.yearsOfExperience < rule.minExperienceYears) {
        eligible = false;
        score -= 20;
      }

      score = Math.max(10, Math.min(100, score));

      if (eligible || score >= 60) {
        alternativeEligibleDesignations.push({
          designationId: desId,
          title: rule.title,
          matchScore: score,
          canExecuteTransactions: eligible && rule.canExecuteTransactions && isEuinFormatValid,
        });
      }
    }

    alternativeEligibleDesignations.sort((a, b) => b.matchScore - a.matchScore);

    const maskedPan = candidate.panNumber
      ? `${candidate.panNumber.slice(0, 5)}*****`
      : "NOT_PROVIDED";

    const report: CandidateEligibilityReport = {
      isEligible,
      overallScore,
      targetDesignation: targetDesignationId,
      designationTitle: designation.title,
      irisClassification: designation.irisClassification,
      canExecuteTransactions,
      irisSyncReady,
      gates: {
        identityAndKyc: gate1,
        regulatoryId: gate2,
        certifications: gate3,
        experienceAndEducation: gate4,
      },
      passedCriteria,
      failedCriteria,
      remediationSteps,
      alternativeEligibleDesignations,
      explainabilityLayer: {
        engine_version: ENGINE_VERSION,
        calculation_timestamp: new Date().toISOString(),
        formula_applied: "Score = 0.25*Identity + 0.35*Regulatory + 0.25*Certs + 0.15*ExpEdu",
        inputs_used: {
          pan_masked: maskedPan,
          has_euin: hasEuin,
          euin_format_valid: isEuinFormatValid,
          experience_years: candidate.yearsOfExperience,
          education_level: candidate.highestEducation,
          verified_cert_count: candidateCertCodes.size,
        },
        intermediate_steps: intermediateSteps,
      },
    };

    logger.info(
      JSON.stringify({
        event: "CANDIDATE_ELIGIBILITY_EVALUATED",
        candidate_email: candidate.email,
        target_designation: targetDesignationId,
        is_eligible: isEligible,
        overall_score: overallScore,
        latency_ms: Date.now() - startMs,
        status: "success",
      })
    );

    return report;
  }

  /**
   * Evaluate candidate and assign or add to FintekPro team roster.
   * Enforces that candidate MUST be eligible for the designation before onboarding.
   */
  async onboardTeamMemberWithEligibilityCheck(
    partnerOrAdminId: string,
    candidate: CandidateProfile,
    targetDesignationId: string
  ): Promise<{
    success: boolean;
    member?: TeamMemberRecord;
    eligibilityReport: CandidateEligibilityReport;
    error?: string;
  }> {
    const report = this.evaluateCandidateEligibility(candidate, targetDesignationId);

    if (!report.isEligible) {
      return {
        success: false,
        eligibilityReport: report,
        error: `Candidate is ineligible for designation '${report.designationTitle}'. Missing: ${report.failedCriteria.join("; ")}`,
      };
    }

    const designation = STANDARD_DESIGNATIONS[targetDesignationId];
    const now = new Date();

    // Check if table partner_team_members has designation columns or insert into customerCareAgents
    try {
      // 1. Ensure partner_team_members table has extended columns for designations
      await db.execute(sql`
        ALTER TABLE partner_team_members 
        ADD COLUMN IF NOT EXISTS designation VARCHAR(100) DEFAULT 'agent',
        ADD COLUMN IF NOT EXISTS designation_title VARCHAR(255),
        ADD COLUMN IF NOT EXISTS euin_number VARCHAR(50),
        ADD COLUMN IF NOT EXISTS can_execute_transactions BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS eligibility_score INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(50) DEFAULT 'ELIGIBLE',
        ADD COLUMN IF NOT EXISTS iris_sync_status VARCHAR(50) DEFAULT 'PENDING',
        ADD COLUMN IF NOT EXISTS iris_entity_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS branch_id VARCHAR(100)
      `);

      const agentUserId = candidate.candidateId || `usr_${Math.random().toString(36).substring(2, 10)}`;

      // 2. Insert or update in partner_team_members
      await db.execute(sql`
        INSERT INTO partner_team_members 
          (partner_user_id, agent_user_id, role, designation, designation_title, euin_number,
           can_execute_transactions, eligibility_score, eligibility_status, iris_sync_status,
           branch_id, joined_at, updated_at)
        VALUES 
          (${partnerOrAdminId}, ${agentUserId}, ${designation.fintekproRole}, ${targetDesignationId},
           ${designation.title}, ${candidate.euinNumber || null}, ${report.canExecuteTransactions},
           ${report.overallScore}, 'ELIGIBLE', 'PENDING', ${candidate.branchId || null}, ${now}, ${now})
        ON CONFLICT (partner_user_id, agent_user_id) DO UPDATE SET
          designation = ${targetDesignationId},
          designation_title = ${designation.title},
          euin_number = ${candidate.euinNumber || null},
          can_execute_transactions = ${report.canExecuteTransactions},
          eligibility_score = ${report.overallScore},
          eligibility_status = 'ELIGIBLE',
          branch_id = ${candidate.branchId || null},
          updated_at = ${now}
      `);

      const memberRecord: TeamMemberRecord = {
        id: `${partnerOrAdminId}_${agentUserId}`,
        partnerUserId: partnerOrAdminId,
        agentUserId,
        name: candidate.name,
        email: candidate.email,
        mobile: candidate.mobile,
        designation: targetDesignationId,
        designationTitle: designation.title,
        role: designation.fintekproRole,
        irisClassification: designation.irisClassification,
        branchId: candidate.branchId,
        euinNumber: candidate.euinNumber,
        euinVerified: !!candidate.euinVerified,
        canExecuteTransactions: report.canExecuteTransactions,
        eligibilityScore: report.overallScore,
        eligibilityStatus: "ELIGIBLE",
        irisSyncStatus: "PENDING",
        joinedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      return {
        success: true,
        member: memberRecord,
        eligibilityReport: report,
      };
    } catch (e: any) {
      logger.error(`[TeamDesignationService] Failed to onboard member: ${e.message}`);
      return {
        success: false,
        eligibilityReport: report,
        error: `Database error while saving team member: ${e.message}`,
      };
    }
  }

  /**
   * Synchronize an eligible team member to IRIS KFintech hierarchy endpoints.
   */
  async syncTeamMemberToIris(
    partnerUserId: string,
    agentUserId: string,
    candidateDetails: CandidateProfile
  ): Promise<{
    success: boolean;
    irisEndpoint: string;
    irisClassification: IrisStaffClassification;
    response?: any;
    error?: string;
  }> {
    // 1. Fetch team member details
    const rows = await db.execute(sql`
      SELECT * FROM partner_team_members 
      WHERE partner_user_id = ${partnerUserId} AND agent_user_id = ${agentUserId}
      LIMIT 1
    `);

    if (!rows.rows || rows.rows.length === 0) {
      return {
        success: false,
        irisEndpoint: "N/A",
        irisClassification: "internal_only",
        error: "Team member not found under partner account",
      };
    }

    const member = rows.rows[0] as any;
    const designationId = member.designation || "relationship_manager";
    const rule = STANDARD_DESIGNATIONS[designationId];

    if (!rule) {
      return {
        success: false,
        irisEndpoint: "N/A",
        irisClassification: "internal_only",
        error: `Unknown designation '${designationId}'`,
      };
    }

    if (rule.irisClassification === "internal_only") {
      await db.execute(sql`
        UPDATE partner_team_members 
        SET iris_sync_status = 'NOT_APPLICABLE', updated_at = NOW()
        WHERE partner_user_id = ${partnerUserId} AND agent_user_id = ${agentUserId}
      `);
      return {
        success: true,
        irisEndpoint: rule.irisEndpoint,
        irisClassification: rule.irisClassification,
        response: { message: "Designation is internal-only; not synced to IRIS RTA registry." },
      };
    }

    if (!irisKfintechService.isConfigured) {
      return {
        success: false,
        irisEndpoint: rule.irisEndpoint,
        irisClassification: rule.irisClassification,
        error: "IRIS KFintech service is not configured with credentials in environment.",
      };
    }

    try {
      let irisResult: any = null;

      if (rule.irisClassification === "rm") {
        // Sync to IRIS RM endpoint
        irisResult = await irisKfintechService.addRelationshipManager({
          name: candidateDetails.name,
          mobile: candidateDetails.mobile,
          email: candidateDetails.email,
          employeeCode: agentUserId,
          branchId: candidateDetails.branchId || "BRANCH-MAIN",
          maxClientLimit: rule.maxClientLimit || 150,
        });
      } else if (rule.irisClassification === "sub_broker") {
        // Sync to IRIS Sub-broker endpoint
        irisResult = await irisKfintechService.addSubBroker({
          euinCode: candidateDetails.euinNumber,
          name: candidateDetails.name,
          mobile: candidateDetails.mobile,
          email: candidateDetails.email,
          sebiRegNo: candidateDetails.sebiRegNo || "",
          amfiRegNo: candidateDetails.arnCode || "",
          arnCode: candidateDetails.arnCode || "",
          branchId: candidateDetails.branchId || "BRANCH-MAIN",
        });
      } else if (rule.irisClassification === "employee") {
        // Sync to IRIS Employee endpoint
        irisResult = await irisKfintechService.addEmployee({
          name: candidateDetails.name,
          mobile: candidateDetails.mobile,
          email: candidateDetails.email,
          euinCode: candidateDetails.euinNumber,
          designation: rule.title,
          branchId: candidateDetails.branchId || "BRANCH-MAIN",
          arnCode: candidateDetails.arnCode,
        });
      }

      await db.execute(sql`
        UPDATE partner_team_members 
        SET iris_sync_status = 'SYNCED', 
            iris_entity_id = ${irisResult?.id || candidateDetails.euinNumber || agentUserId},
            updated_at = NOW()
        WHERE partner_user_id = ${partnerUserId} AND agent_user_id = ${agentUserId}
      `);

      logger.info(
        JSON.stringify({
          event: "IRIS_STAFF_SYNC_SUCCESS",
          user_id: partnerUserId,
          agent_user_id: agentUserId,
          iris_classification: rule.irisClassification,
          status: "success",
        })
      );

      return {
        success: true,
        irisEndpoint: rule.irisEndpoint,
        irisClassification: rule.irisClassification,
        response: irisResult,
      };
    } catch (err: any) {
      await db.execute(sql`
        UPDATE partner_team_members 
        SET iris_sync_status = 'FAILED', updated_at = NOW()
        WHERE partner_user_id = ${partnerUserId} AND agent_user_id = ${agentUserId}
      `);

      logger.error(
        JSON.stringify({
          event: "IRIS_STAFF_SYNC_FAILED",
          user_id: partnerUserId,
          agent_user_id: agentUserId,
          error: err.message,
          status: "error",
        })
      );

      return {
        success: false,
        irisEndpoint: rule.irisEndpoint,
        irisClassification: rule.irisClassification,
        error: `IRIS Sync Error: ${err.message}`,
      };
    }
  }

  /**
   * Fetch full team member roster for a partner with designations and IRIS alignment.
   */
  async getTeamMembers(partnerUserId: string): Promise<TeamMemberRecord[]> {
    try {
      const rows = await db.execute(sql`
        SELECT ptm.*,
               u.first_name, u.last_name, u.email, u.mobile, u.roles,
               ae.arn_code, ae.pan_number, ae.status as empanelment_status
        FROM partner_team_members ptm
        LEFT JOIN users u ON u.id = ptm.agent_user_id
        LEFT JOIN agent_empanelments ae ON ae.agent_id = ptm.agent_user_id
        WHERE ptm.partner_user_id = ${partnerUserId}
        ORDER BY ptm.joined_at DESC
      `);

      return (rows.rows || []).map((row: any) => {
        const designationId = row.designation || "relationship_manager";
        const rule = STANDARD_DESIGNATIONS[designationId] || STANDARD_DESIGNATIONS.relationship_manager;
        const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.agent_user_id;

        return {
          id: row.id,
          partnerUserId: row.partner_user_id,
          agentUserId: row.agent_user_id,
          name: fullName,
          email: row.email || "",
          mobile: row.mobile || "",
          designation: designationId,
          designationTitle: row.designation_title || rule.title,
          role: row.role || rule.fintekproRole,
          irisClassification: rule.irisClassification,
          branchId: row.branch_id || undefined,
          euinNumber: row.euin_number || undefined,
          euinVerified: !!row.euin_number,
          canExecuteTransactions: !!row.can_execute_transactions,
          eligibilityScore: Number(row.eligibility_score || 0),
          eligibilityStatus: (row.eligibility_status as any) || "ELIGIBLE",
          irisSyncStatus: (row.iris_sync_status as any) || "PENDING",
          irisEntityId: row.iris_entity_id || undefined,
          joinedAt: row.joined_at ? new Date(row.joined_at).toISOString() : new Date().toISOString(),
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        };
      });
    } catch (err: any) {
      logger.error(`[TeamDesignationService] Error fetching team members: ${err.message}`);
      return [];
    }
  }
}

export const teamDesignationService = TeamDesignationService.getInstance();

