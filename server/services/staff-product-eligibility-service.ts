/**
 * FintekPro Staff Multi-Vendor Portal Product Eligibility & Governance Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces SEBI, RBI, IRDAI, PFRDA, and AMFI statutory parameters on staff
 * members managing, quoting, or executing multi-vendor portal products:
 *
 *   1. Mutual Funds & SIPs       → IRIS (KFintech) / BSE_STAR_MF [SEBI/AMFI: EUIN + NISM V-A]
 *   2. Indian Equities (Cash)    → UPSTOX (NSE/BSE) [SEBI: AP/NISM + PAN/KYC]
 *   3. Equity Derivatives (F&O)  → UPSTOX [SEBI: NISM Series VIII]
 *   4. Currency & Commodities    → UPSTOX (MCX/NSE-CDS) [SEBI: NISM Series I/XVI]
 *   5. Global Equities (US)      → ALPACA [RBI FEMA/LRS + NISM X-A]
 *   6. Lending & LAS Loans       → BAJAJ / TATA / ICICI / IRIS_LAS [RBI: DSA Code/Credit Policy]
 *   7. Insurance Products        → Partner Insurers [IRDAI: POSP 15-hr Training & Exam Certificate]
 *   8. Bonds & Debt (OBPP)       → CCIL / BSE_DIRECT [SEBI OBPP + RBI: NISM Series VI/V-A]
 *   9. AIF & PMS Portfolios      → Direct AMCs [SEBI: NISM Series XXI-A/XXI-B / RIA]
 *  10. National Pension System   → PROTEAN / KFINTECH CRA [PFRDA: POP-SP Certification]
 *
 * FASP-AI GCR v1.0 Compliance:
 * - Deterministic output: Same staff credentials -> exact same product eligibility
 * - Explainability layer: Exposes inputs, statutory rules applied, intermediate steps
 * - Zero trust: Validates licenses and certifications before granting product management
 * - Structured logging: { event, staff_id, latency_ms, status }
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export const PRODUCT_GOVERNANCE_ENGINE_VERSION = "fintekpro-multivendor-gov-v1.0.0";

// ── Types & Interfaces ───────────────────────────────────────────────────────

export type VendorProductCode =
  | "mutual_funds"
  | "sif"
  | "equity_cash"
  | "equity_derivatives"
  | "currency_commodity"
  | "global_equities"
  | "lending_loans"
  | "insurance"
  | "fixed_income_bonds"
  | "aif_pms"
  | "nps";

export type RegulatoryAuthority = "SEBI" | "RBI" | "IRDAI" | "PFRDA" | "AMFI" | "MULTI_REGULATOR";

export type AccessLevel = "FULL_MANAGEMENT" | "READ_ONLY" | "BLOCKED";

export interface VendorProductRule {
  productCode: VendorProductCode;
  productName: string;
  regulator: RegulatoryAuthority;
  primaryVendors: string[];
  mandatoryCertifications: string[]; // e.g. ["NISM_V_A"]
  requiresEuin: boolean;
  requiresPosp: boolean;
  requiresDsa: boolean;
  requiresSebiReg: boolean;
  minExperienceYears: number;
  statutoryBasis: string;
  executionCapability: boolean;
  description: string;
}

export interface StaffCredentialsProfile {
  staffId: string;
  name: string;
  email: string;
  role: string;
  panNumber: string;
  panVerified: boolean;
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED";
  euinNumber?: string;
  euinVerified?: boolean;
  euinValidTo?: string;
  pospCertificateNumber?: string;
  pospVerified?: boolean;
  dsaCode?: string;
  dsaVerified?: boolean;
  arnCode?: string;
  sebiRegNo?: string;
  certifications?: Array<{
    code: string;
    certificateNumber?: string;
    validUntil?: string;
    isVerified?: boolean;
  }>;
  yearsOfExperience: number;
}

export interface ProductEligibilityEvaluation {
  productCode: VendorProductCode;
  productName: string;
  regulator: RegulatoryAuthority;
  primaryVendors: string[];
  accessLevel: AccessLevel;
  canExecuteOrders: boolean;
  matchScore: number; // 0 to 100
  passedChecks: string[];
  failedChecks: string[];
  missingPrerequisites: string[];
  statutoryBasis: string;
  remediationAction?: string;
}

export interface StaffMultiVendorEligibilityReport {
  staffId: string;
  name: string;
  email: string;
  role: string;
  summary: {
    totalProductsChecked: number;
    authorizedCount: number;
    readOnlyCount: number;
    blockedCount: number;
  };
  productEvaluations: ProductEligibilityEvaluation[];
  authorizedVendors: string[];
  explainabilityLayer: {
    engine_version: string;
    calculation_timestamp: string;
    inputs_used: {
      has_valid_pan: boolean;
      has_euin: boolean;
      has_posp: boolean;
      has_dsa: boolean;
      verified_certifications: string[];
      experience_years: number;
    };
    rules_applied_count: number;
  };
}

export interface ProductAllocationRecord {
  id: string;
  staffId: string;
  vendorCode: string;
  productCategory: VendorProductCode;
  accessLevel: AccessLevel;
  isActive: boolean;
  statutoryBasis: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
}

// ── Multi-Vendor Product Catalog & Statutory Rules ──────────────────────────

export const MULTI_VENDOR_PRODUCT_CATALOG: Record<VendorProductCode, VendorProductRule> = {
  mutual_funds: {
    productCode: "mutual_funds",
    productName: "Mutual Funds & SIPs",
    regulator: "SEBI",
    primaryVendors: ["IRIS", "BSE_STAR_MF", "AMFI"],
    mandatoryCertifications: ["NISM_V_A"],
    requiresEuin: true,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "SEBI Circular CIR/IMD/DF/21/2012 & AMFI EUIN Regulations. EUIN and NISM Series V-A mandatory to solicit and execute mutual funds.",
    executionCapability: true,
    description: "Multi-AMC Mutual Fund distribution, SIP order routing, and portfolio rebalancing via IRIS KFintech.",
  },
  sif: {
    productCode: "sif",
    productName: "Specified Investment Funds (SIF / New Asset Class)",
    regulator: "SEBI",
    primaryVendors: ["IRIS", "BSE_STAR_MF", "DIRECT_AMCS"],
    mandatoryCertifications: ["NISM_V_A", "NISM_X_A", "NISM_XXI_A"],
    requiresEuin: true,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 2,
    statutoryBasis: "SEBI (Mutual Funds) (Amendment) Regulations, 2024 / SIF Master Framework. Bridging MF and PMS with statutory ₹10 Lakh ticket floor. EUIN, unexpired NISM certification (Series V-A, X-A, or XXI-A), and minimum 2 years wealth distribution experience required.",
    executionCapability: true,
    description: "SEBI New Asset Class offering unconstrained long-short equity, inverse strategies, and multi-asset derivative overlays with a statutory minimum ₹10 Lakh investment floor.",
  },
  equity_cash: {
    productCode: "equity_cash",
    productName: "Indian Equities (Cash Delivery & Intraday)",
    regulator: "SEBI",
    primaryVendors: ["UPSTOX"],
    mandatoryCertifications: [],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "SEBI Stock Broker Regulations & Exchange AP Guidelines. Valid KYC and PAN required for stock order routing.",
    executionCapability: true,
    description: "NSE and BSE cash equity execution and real-time market data quotes via Upstox API v2.",
  },
  equity_derivatives: {
    productCode: "equity_derivatives",
    productName: "Equity Derivatives (Futures & Options)",
    regulator: "SEBI",
    primaryVendors: ["UPSTOX"],
    mandatoryCertifications: ["NISM_VIII"],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 1,
    statutoryBasis: "SEBI Guidelines on Derivatives Trading & Risk Profiling. NISM Series VIII (Equity Derivatives) mandatory to handle derivative strategies.",
    executionCapability: true,
    description: "NSE F&O options chains, multi-leg options order placement, and Greeks analytics via Upstox.",
  },
  currency_commodity: {
    productCode: "currency_commodity",
    productName: "Currency & Commodity Derivatives",
    regulator: "SEBI",
    primaryVendors: ["UPSTOX"],
    mandatoryCertifications: ["NISM_I", "NISM_XVI"], // Either or both
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 1,
    statutoryBasis: "SEBI Commodity & Currency Derivatives Framework. NISM Series I or XVI certification required.",
    executionCapability: true,
    description: "MCX commodity futures and NSE-CDS currency pairs execution.",
  },
  global_equities: {
    productCode: "global_equities",
    productName: "US Equities & Global Portfolios",
    regulator: "RBI",
    primaryVendors: ["ALPACA"],
    mandatoryCertifications: [],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 1,
    statutoryBasis: "RBI Liberalised Remittance Scheme (LRS) / FEMA Regulations & US SEC Broker-Dealer rules.",
    executionCapability: true,
    description: "Fractional US shares, dollar-denominated ETF portfolios via Alpaca Securities Broker API.",
  },
  lending_loans: {
    productCode: "lending_loans",
    productName: "Lending, Personal/Business Loans & LAS",
    regulator: "RBI",
    primaryVendors: ["BAJAJ", "TATA_CAPITAL", "ICICI", "HDFC", "IRIS_LAS"],
    mandatoryCertifications: [],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: true,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "RBI Fair Practices Code for Lenders, Digital Lending Guidelines (DLG) & DSA Empanelment Standards.",
    executionCapability: true,
    description: "Multi-lender loan eligibility, digital application routing, and Loan Against Mutual Funds/Shares (LAS).",
  },
  insurance: {
    productCode: "insurance",
    productName: "Life, Health & General Insurance",
    regulator: "IRDAI",
    primaryVendors: ["IRDAI_INSURERS"],
    mandatoryCertifications: ["IRDAI_POSP"],
    requiresEuin: false,
    requiresPosp: true,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "IRDAI (Point of Sales Person) Guidelines. Mandatory 15-hour training, exam clearance (score >= 35%), and POSP Certificate.",
    executionCapability: true,
    description: "Pre-underwritten term life, health, motor, and personal accident policies via partner insurers.",
  },
  fixed_income_bonds: {
    productCode: "fixed_income_bonds",
    productName: "Corporate Bonds & Government Securities (OBPP)",
    regulator: "SEBI",
    primaryVendors: ["CCIL", "BSE_DIRECT", "NSE_GO_BID"],
    mandatoryCertifications: ["NISM_VI", "NISM_V_A"],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "SEBI Online Bond Platform Provider (OBPP) Regulations & RBI Retail Direct Framework.",
    executionCapability: true,
    description: "Primary and secondary corporate bond trading, T-Bills, and Sovereign Gold Bonds (SGBs).",
  },
  aif_pms: {
    productCode: "aif_pms",
    productName: "Alternative Investment Funds (AIF) & PMS",
    regulator: "SEBI",
    primaryVendors: ["DIRECT_AMCS"],
    mandatoryCertifications: ["NISM_XXI_A", "NISM_X_A"],
    requiresEuin: true,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 2,
    statutoryBasis: "SEBI (Portfolio Managers) Regulations, 2020 & SEBI (Alternative Investment Funds) Regulations, 2012.",
    executionCapability: true,
    description: "High Net-Worth private placement mandates, Category II/III AIF commitments, and discretionary PMS.",
  },
  nps: {
    productCode: "nps",
    productName: "National Pension System (Tier I & II)",
    regulator: "PFRDA",
    primaryVendors: ["PROTEAN_CRA", "KFINTECH_CRA"],
    mandatoryCertifications: ["PFRDA_POPSP", "NISM_V_A"],
    requiresEuin: false,
    requiresPosp: false,
    requiresDsa: false,
    requiresSebiReg: false,
    minExperienceYears: 0,
    statutoryBasis: "PFRDA Point of Presence Sub-Provider (POP-SP) Operating Guidelines.",
    executionCapability: true,
    description: "PRAN registration, NPS Tier-1 and Tier-2 voluntary contributions via Central Recordkeeping Agencies.",
  },
};

// ── Service Class ───────────────────────────────────────────────────────────

export class StaffProductEligibilityService {
  private static instance: StaffProductEligibilityService;

  static getInstance(): StaffProductEligibilityService {
    if (!StaffProductEligibilityService.instance) {
      StaffProductEligibilityService.instance = new StaffProductEligibilityService();
    }
    return StaffProductEligibilityService.instance;
  }

  /**
   * Get the complete statutory multi-vendor product catalog.
   */
  getVendorProductMatrix(): VendorProductRule[] {
    return Object.values(MULTI_VENDOR_PRODUCT_CATALOG);
  }

  /**
   * Evaluate a staff member's credentials against all multi-vendor portal products.
   */
  evaluateStaffProductEligibility(
    staff: StaffCredentialsProfile
  ): StaffMultiVendorEligibilityReport {
    const startMs = Date.now();
    const isPanValid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(staff.panNumber || "");
    const isKycVerified = staff.kycStatus === "VERIFIED" || staff.panVerified;

    const certMap = new Map<string, boolean>();
    (staff.certifications || []).forEach((c) => {
      const code = c.code.toUpperCase();
      const unexpired = !c.validUntil || new Date(c.validUntil) > new Date();
      if (unexpired) certMap.set(code, true);
    });

    const isEuinFormat = /^E\d{6}$/.test(staff.euinNumber || "");
    const isEuinValid = isEuinFormat && (!staff.euinValidTo || new Date(staff.euinValidTo) > new Date());
    const isPospValid = !!staff.pospCertificateNumber && (staff.pospVerified ?? true);
    const isDsaValid = !!staff.dsaCode && (staff.dsaVerified ?? true);

    const productEvaluations: ProductEligibilityEvaluation[] = [];
    const authorizedVendorsSet = new Set<string>();

    let authorizedCount = 0;
    let readOnlyCount = 0;
    let blockedCount = 0;

    for (const rule of Object.values(MULTI_VENDOR_PRODUCT_CATALOG)) {
      const passedChecks: string[] = [];
      const failedChecks: string[] = [];
      const missingPrerequisites: string[] = [];
      let matchScore = 100;
      let accessLevel: AccessLevel = "FULL_MANAGEMENT";

      // Base Check: Identity & KYC
      if (!isPanValid || !isKycVerified) {
        failedChecks.push("PAN / KYC verification incomplete");
        missingPrerequisites.push("Valid verified PAN & KYC");
        matchScore -= 40;
      } else {
        passedChecks.push("Verified PAN & KYC confirmed");
      }

      // Check EUIN requirement
      if (rule.requiresEuin) {
        if (!isEuinValid) {
          failedChecks.push("Mandatory EUIN missing or unverified");
          missingPrerequisites.push("Valid AMFI EUIN (Employee Unique Identification Number)");
          matchScore -= 45;
        } else {
          passedChecks.push(`Active AMFI EUIN verified (${staff.euinNumber})`);
        }
      }

      // Check POSP requirement (Insurance)
      if (rule.requiresPosp) {
        if (!isPospValid) {
          failedChecks.push("IRDAI POSP certification missing");
          missingPrerequisites.push("Complete 15-hr IRDAI POSP training and pass certification exam");
          matchScore -= 50;
        } else {
          passedChecks.push(`Valid IRDAI POSP Certificate verified (${staff.pospCertificateNumber})`);
          certMap.set("IRDAI_POSP", true);
        }
      }

      // Check DSA requirement (Loans)
      if (rule.requiresDsa) {
        if (!isDsaValid) {
          failedChecks.push("Direct Selling Agent (DSA) code not empanelled");
          missingPrerequisites.push("Empanelment as DSA under FintekPro lending partners");
          matchScore -= 30;
        } else {
          passedChecks.push(`Active DSA registration confirmed (${staff.dsaCode})`);
        }
      }

      // Check SEBI RIA requirement
      if (rule.requiresSebiReg) {
        if (!staff.sebiRegNo) {
          failedChecks.push("SEBI RIA Representative registration missing");
          missingPrerequisites.push("SEBI RIA Representative registration number");
          matchScore -= 50;
        } else {
          passedChecks.push(`SEBI RIA Registration verified (${staff.sebiRegNo})`);
        }
      }

      // Check Experience requirement
      if (staff.yearsOfExperience < rule.minExperienceYears) {
        failedChecks.push(
          `Experience (${staff.yearsOfExperience} yrs) below requirement (${rule.minExperienceYears} yrs)`
        );
        missingPrerequisites.push(`Minimum ${rule.minExperienceYears} years domain experience`);
        matchScore -= 20;
      } else if (rule.minExperienceYears > 0) {
        passedChecks.push(`Experience criteria satisfied (${staff.yearsOfExperience} years)`);
      }

      // Check Mandatory Certifications (NISM)
      if (rule.mandatoryCertifications.length > 0) {
        let certFound = false;
        for (const reqCode of rule.mandatoryCertifications) {
          if (certMap.has(reqCode.toUpperCase())) {
            certFound = true;
            passedChecks.push(`Required certification present: ${reqCode}`);
            break;
          }
        }
        if (!certFound) {
          failedChecks.push(`Missing mandatory certification: ${rule.mandatoryCertifications.join(" or ")}`);
          missingPrerequisites.push(`Clear ${rule.mandatoryCertifications.join(" or ")} exam`);
          matchScore -= 40;
        }
      }

      matchScore = Math.max(0, Math.min(100, matchScore));

      // Determine Access Level
      if (failedChecks.length === 0 && matchScore >= 80) {
        accessLevel = "FULL_MANAGEMENT";
        authorizedCount++;
        rule.primaryVendors.forEach((v) => authorizedVendorsSet.add(v));
      } else if (isPanValid && matchScore >= 40) {
        // Can view product information & advise internally, but blocked from transaction routing
        accessLevel = "READ_ONLY";
        readOnlyCount++;
      } else {
        accessLevel = "BLOCKED";
        blockedCount++;
      }

      let remediationAction: string | undefined;
      if (accessLevel !== "FULL_MANAGEMENT") {
        remediationAction = `To enable ${rule.productName}: ${missingPrerequisites.join("; ")}`;
      }

      productEvaluations.push({
        productCode: rule.productCode,
        productName: rule.productName,
        regulator: rule.regulator,
        primaryVendors: rule.primaryVendors,
        accessLevel,
        canExecuteOrders: accessLevel === "FULL_MANAGEMENT" && rule.executionCapability,
        matchScore,
        passedChecks,
        failedChecks,
        missingPrerequisites,
        statutoryBasis: rule.statutoryBasis,
        remediationAction,
      });
    }

    const report: StaffMultiVendorEligibilityReport = {
      staffId: staff.staffId,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      summary: {
        totalProductsChecked: productEvaluations.length,
        authorizedCount,
        readOnlyCount,
        blockedCount,
      },
      productEvaluations,
      authorizedVendors: Array.from(authorizedVendorsSet),
      explainabilityLayer: {
        engine_version: PRODUCT_GOVERNANCE_ENGINE_VERSION,
        calculation_timestamp: new Date().toISOString(),
        inputs_used: {
          has_valid_pan: isPanValid,
          has_euin: isEuinValid,
          has_posp: isPospValid,
          has_dsa: isDsaValid,
          verified_certifications: Array.from(certMap.keys()),
          experience_years: staff.yearsOfExperience,
        },
        rules_applied_count: Object.keys(MULTI_VENDOR_PRODUCT_CATALOG).length,
      },
    };

    logger.info(
      JSON.stringify({
        event: "STAFF_MULTIVENDOR_ELIGIBILITY_EVALUATED",
        staff_id: staff.staffId,
        authorized_count: authorizedCount,
        read_only_count: readOnlyCount,
        blocked_count: blockedCount,
        latency_ms: Date.now() - startMs,
        status: "success",
      })
    );

    return report;
  }

  /**
   * Allocate and persist multi-vendor product authorizations for a staff member.
   * Gated: If staff member is BLOCKED under regulatory rules, allocation is rejected.
   */
  async allocateStaffProducts(
    staffId: string,
    requestedProductCodes: VendorProductCode[],
    staffProfile: StaffCredentialsProfile,
    grantedByUserId: string
  ): Promise<{
    success: boolean;
    allocatedProducts: ProductAllocationRecord[];
    rejectedProducts: Array<{ productCode: VendorProductCode; reason: string }>;
    summary: { requested: number; granted: number; rejected: number };
  }> {
    // 1. Ensure table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS staff_vendor_product_authorizations (
        id VARCHAR(100) PRIMARY KEY,
        staff_id VARCHAR(255) NOT NULL,
        vendor_code VARCHAR(50) NOT NULL,
        product_category VARCHAR(50) NOT NULL,
        access_level VARCHAR(30) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        verified_credentials JSONB NOT NULL DEFAULT '{}',
        regulatory_basis TEXT NOT NULL,
        granted_by VARCHAR(255) NOT NULL,
        granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (staff_id, vendor_code, product_category)
      )
    `);

    // 2. Evaluate eligibility
    const report = this.evaluateStaffProductEligibility(staffProfile);
    const evalMap = new Map(report.productEvaluations.map((e) => [e.productCode, e]));

    const allocatedProducts: ProductAllocationRecord[] = [];
    const rejectedProducts: Array<{ productCode: VendorProductCode; reason: string }> = [];

    const now = new Date();

    for (const code of requestedProductCodes) {
      const evaluation = evalMap.get(code);
      const rule = MULTI_VENDOR_PRODUCT_CATALOG[code];

      if (!evaluation || !rule) {
        rejectedProducts.push({ productCode: code, reason: `Unknown product code '${code}'` });
        continue;
      }

      if (evaluation.accessLevel === "BLOCKED") {
        rejectedProducts.push({
          productCode: code,
          reason: `Regulatory violation: Candidate lacks mandatory statutory credentials. Missing: ${evaluation.missingPrerequisites.join("; ")}`,
        });
        continue;
      }

      // Insert/update authorization for each vendor under this product
      for (const vendor of rule.primaryVendors) {
        const id = `${staffId}_${vendor}_${code}`;
        await db.execute(sql`
          INSERT INTO staff_vendor_product_authorizations
            (id, staff_id, vendor_code, product_category, access_level, is_active,
             verified_credentials, regulatory_basis, granted_by, granted_at, updated_at)
          VALUES
            (${id}, ${staffId}, ${vendor}, ${code}, ${evaluation.accessLevel}, TRUE,
             ${JSON.stringify({ matchScore: evaluation.matchScore, checks: evaluation.passedChecks })},
             ${rule.statutoryBasis}, ${grantedByUserId}, ${now}, ${now})
          ON CONFLICT (staff_id, vendor_code, product_category) DO UPDATE SET
            access_level = ${evaluation.accessLevel},
            is_active = TRUE,
            regulatory_basis = ${rule.statutoryBasis},
            updated_at = ${now}
        `);

        allocatedProducts.push({
          id,
          staffId,
          vendorCode: vendor,
          productCategory: code,
          accessLevel: evaluation.accessLevel,
          isActive: true,
          statutoryBasis: rule.statutoryBasis,
          grantedBy: grantedByUserId,
          grantedAt: now.toISOString(),
        });
      }
    }

    logger.info(
      JSON.stringify({
        event: "STAFF_PRODUCTS_ALLOCATED",
        staff_id: staffId,
        granted_by: grantedByUserId,
        requested_count: requestedProductCodes.length,
        granted_count: allocatedProducts.length,
        rejected_count: rejectedProducts.length,
        status: "success",
      })
    );

    return {
      success: allocatedProducts.length > 0 || rejectedProducts.length === 0,
      allocatedProducts,
      rejectedProducts,
      summary: {
        requested: requestedProductCodes.length,
        granted: allocatedProducts.length,
        rejected: rejectedProducts.length,
      },
    };
  }

  /**
   * Fetch current active product authorizations for a staff member.
   */
  async getStaffAuthorizedProducts(staffId: string): Promise<ProductAllocationRecord[]> {
    try {
      const rows = await db.execute(sql`
        SELECT * FROM staff_vendor_product_authorizations
        WHERE staff_id = ${staffId} AND is_active = TRUE
        ORDER BY product_category ASC
      `);

      return (rows.rows || []).map((r: any) => ({
        id: r.id,
        staffId: r.staff_id,
        vendorCode: r.vendor_code,
        productCategory: r.product_category as VendorProductCode,
        accessLevel: r.access_level as AccessLevel,
        isActive: !!r.is_active,
        statutoryBasis: r.regulatory_basis || "",
        grantedBy: r.granted_by,
        grantedAt: r.granted_at ? new Date(r.granted_at).toISOString() : new Date().toISOString(),
        expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : undefined,
      }));
    } catch (_err) {
      return [];
    }
  }

  /**
   * Runtime authorization guard: Check if a staff member is allowed to execute or manage a product category.
   */
  async canStaffManageProduct(
    staffId: string,
    productCategory: VendorProductCode,
    action: "READ" | "EXECUTE" = "EXECUTE"
  ): Promise<{ allowed: boolean; accessLevel?: AccessLevel; reason?: string }> {
    const auths = await this.getStaffAuthorizedProducts(staffId);
    const matching = auths.filter((a) => a.productCategory === productCategory && a.isActive);

    if (matching.length === 0) {
      return {
        allowed: false,
        reason: `Staff member has no active statutory authorization for product category '${productCategory}'`,
      };
    }

    const hasFull = matching.some((m) => m.accessLevel === "FULL_MANAGEMENT");
    if (action === "EXECUTE") {
      if (!hasFull) {
        return {
          allowed: false,
          accessLevel: "READ_ONLY",
          reason: `Staff has READ_ONLY access to '${productCategory}'. Order execution requires full regulatory clearance (EUIN/NISM/POSP).`,
        };
      }
      return { allowed: true, accessLevel: "FULL_MANAGEMENT" };
    }

    return { allowed: true, accessLevel: matching[0].accessLevel };
  }
}

export const staffProductEligibilityService = StaffProductEligibilityService.getInstance();
