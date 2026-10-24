/**
 * @file statutory-investment-policy-service.ts
 * @description SEBI 4-Tier Statutory Investment Policy Engine (GCR v1.0 & FASP-AI v3.1).
 *
 * Implements strict, immutable statutory investment policies across the entire Indian investment spectrum:
 * 1. Tier 1: Retail Mutual Funds (retail_mf)
 *    - Regulatory Regime: SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013.
 *    - Circular Reference: SEBI Master Circular SEBI/HO/IMD/IMD-PoD-1/P/CIR/2023/74 & Circular Oct 6, 2017.
 *    - Ticket Size: Min ₹5,000 Lumpsum / ₹500 SIP.
 *    - Custody: Direct AMC Folio / Client Demat (DIRECT_AMC_FOLIO).
 *    - Single Stock Cap: 10% hard cap (8% warning) per Seventh Schedule Clause 1.
 *    - Unlisted Equity: Strictly 0% (Prohibited in open-ended schemes).
 *
 * 2. Tier 2: Specified Investment Funds / SIF (affluent_sif)
 *    - Regulatory Regime: SEBI (Mutual Funds) (Amendment) Regulations, 2024 — New Asset Class Framework.
 *    - Circular Reference: SEBI Master Framework for New Asset Class / SIF 2024.
 *    - Ticket Size: Statutory Minimum ₹10,00,000 (Ten Lakhs) across all investment strategies.
 *    - Custody: AMC Trustee Unitized Holding (TRUSTEE_AMC_UNITS).
 *    - Single Stock Cap: 12% max per issuer (Enhanced flexibility for high-conviction alpha).
 *    - Unlisted Equity: Strictly 0% (Prohibited in SIF open-ended strategies).
 *    - Derivative Flexibility: Permitted up to 100% of NAV for hedging, synthetic long-short, and alpha overlay.
 *    - Net Equity Delta Corridor: 25% to 100%.
 *    - Borrowing: Prohibited (0%), except temporary liquidity borrowing capped at 20% for max 6 months.
 *
 * 3. Tier 3: High Net-worth Portfolio Management Services (hni_pms)
 *    - Regulatory Regime: SEBI (Portfolio Managers) Regulations, 2020.
 *    - Regulation Reference: SEBI (Portfolio Managers) Regulations, 2020 — Regulation 23(2).
 *    - Ticket Size: Statutory Minimum ₹50,00,000 (Fifty Lakhs).
 *    - Custody: Segregated Demat Account in client's individual PAN (SEGREGATED_CLIENT_DEMAT, no pooling).
 *    - Single Stock Cap: 10% recommended (discretionary mandate).
 *    - Reporting Standard: Time-Weighted Rate of Return (TWRR) per SEBI circular SEBI/HO/IMD/DF1/CIR/P/2020/26.
 *
 * 4. Tier 4: Ultra HNI Alternative Investment Funds (uhni_aif)
 *    - Regulatory Regime: SEBI (Alternative Investment Funds) Regulations, 2012.
 *    - Regulation Reference: SEBI (Alternative Investment Funds) Regulations, 2012 — Regulation 10(c).
 *    - Ticket Size: Statutory Minimum ₹1,00,00,000 (One Crore) [₹25L for Angel Funds].
 *    - Custody: Contributory Trust with Class A/B/C Unitized Holdings (POOLED_TRUST_UNITS).
 *    - Unlisted Equity: Permitted (up to 100% for Cat I/II venture capital and private equity).
 *    - Derivatives & Leverage: Category III permitted up to 200% of NAV (2x gross leverage).
 *    - Accreditation: Accredited Investor (AI) framework verification required.
 */

import { logger } from "../logger";

export type SebiTierId = "retail_mf" | "affluent_sif" | "hni_pms" | "uhni_aif";

export interface StatutoryInvestmentPolicy {
  tierId: SebiTierId;
  tierName: string;
  shortLabel: string;
  governingBody: "SEBI";
  regulatoryRegime: string;
  statutoryReference: string;
  vehicleType: "MUTUAL_FUND" | "SIF_NEW_ASSET_CLASS" | "PMS_MULTI_ASSET" | "AIF_MULTI_ASSET";
  
  // Ticket Size & Eligibility
  statutoryMinTicket: number;
  statutoryMinTicketFormatted: string;
  minSipAmount?: number;
  investorTargetSegment: string;
  accreditationRequired: boolean;
  lockInPeriodMonths: number;

  // Custody & Execution Architecture
  custodyStructure: "DIRECT_AMC_FOLIO" | "TRUSTEE_AMC_UNITS" | "SEGREGATED_CLIENT_DEMAT" | "POOLED_TRUST_UNITS";
  custodyDescription: string;
  executionRoute: "iris" | "sif_orchestration" | "upstox_pms" | "multi_asset_orchestration";
  poolingAllowed: boolean;

  // Investment Restrictions & Portfolio Construction Limits
  singleStockCapPct: number;
  singleStockWarnPct: number;
  singleSectorCapPct: number;
  groupExposureCapPct: number;
  unlistedSecuritiesAllowed: boolean;
  unlistedSecuritiesMaxPct: number;

  // Derivative & Leverage Guidelines
  derivativesPermitted: boolean;
  derivativePurposes: string[];
  maxGrossDerivativeExposurePct: number;
  netEquityDeltaMinPct?: number;
  netEquityDeltaMaxPct?: number;
  borrowingLeverageAllowed: boolean;
  borrowingLimitPct: number;

  // Liquidity & Reporting
  liquidityBufferMinPct: number;
  redemptionCycle: string;
  reportingStandard: string;
  mandatoryDisclaimers: string[];
  statutoryWarnings: string[];
}

export const STATUTORY_INVESTMENT_POLICIES: Record<SebiTierId, StatutoryInvestmentPolicy> = {
  // ── Tier 1: Retail Mutual Funds ──────────────────────────────────────────────
  retail_mf: {
    tierId: "retail_mf",
    tierName: "Retail Mutual Fund & ETF Baskets",
    shortLabel: "Mutual Fund",
    governingBody: "SEBI",
    regulatoryRegime: "SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013",
    statutoryReference: "SEBI MF Regulations 1996 (Seventh Schedule) / Master Circular 2023",
    vehicleType: "MUTUAL_FUND",
    statutoryMinTicket: 5000,
    statutoryMinTicketFormatted: "₹5,000 (SIP: ₹500)",
    minSipAmount: 500,
    investorTargetSegment: "Retail and mass affluent investors building long-term systematic wealth.",
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    custodyStructure: "DIRECT_AMC_FOLIO",
    custodyDescription: "Units held directly in client's individual AMC folio or client Demat account.",
    executionRoute: "iris",
    poolingAllowed: true,
    singleStockCapPct: 10.0,
    singleStockWarnPct: 8.0,
    singleSectorCapPct: 20.0,
    groupExposureCapPct: 20.0,
    unlistedSecuritiesAllowed: false,
    unlistedSecuritiesMaxPct: 0.0,
    derivativesPermitted: true,
    derivativePurposes: ["Hedging existing portfolio positions", "Rebalancing asset allocation corridors"],
    maxGrossDerivativeExposurePct: 50.0,
    borrowingLeverageAllowed: false,
    borrowingLimitPct: 20.0, // Temporary liquidity only, max 6 months
    liquidityBufferMinPct: 3.0,
    redemptionCycle: "Daily mark-to-market with T+1 / T+2 bank settlement via KFintech IRIS.",
    reportingStandard: "Daily NAV publication & AMFI Risk-o-meter classification.",
    mandatoryDisclaimers: [
      "Mutual Fund investments are subject to market risks, read all scheme related documents carefully.",
      "Past performance is not indicative of future returns.",
      "FintekPro acts strictly as a SEBI-registered distributor and investment decision-support platform.",
    ],
    statutoryWarnings: [
      "Seventh Schedule Clause 1: No open-ended equity scheme shall hold >10% of NAV in a single issuer.",
      "Unlisted equities and commercial papers are strictly prohibited in open-ended schemes.",
    ],
  },

  // ── Tier 2: Specified Investment Funds (SIF / New Asset Class) ────────────────
  affluent_sif: {
    tierId: "affluent_sif",
    tierName: "Specified Investment Fund (SIF / New Asset Class)",
    shortLabel: "SIF (New Asset Class)",
    governingBody: "SEBI",
    regulatoryRegime: "SEBI (Mutual Funds) (Amendment) Regulations, 2024 — New Asset Class Framework",
    statutoryReference: "SEBI MF Amendment Regulations 2024 / SIF Master Framework",
    vehicleType: "SIF_NEW_ASSET_CLASS",
    statutoryMinTicket: 1000000, // ₹10 Lakhs statutory floor
    statutoryMinTicketFormatted: "₹10,00,000 (Ten Lakhs)",
    minSipAmount: 10000,
    investorTargetSegment: "Affluent investors bridging the gap between Mutual Funds and ₹50L PMS.",
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    custodyStructure: "TRUSTEE_AMC_UNITS",
    custodyDescription: "Units issued under AMC Trustee governance with independent custodian custody.",
    executionRoute: "sif_orchestration",
    poolingAllowed: true,
    singleStockCapPct: 12.0, // Enhanced 12% cap for SIF vs 10% for MF
    singleStockWarnPct: 10.0,
    singleSectorCapPct: 25.0,
    groupExposureCapPct: 25.0,
    unlistedSecuritiesAllowed: false, // Strictly 0% unlisted
    unlistedSecuritiesMaxPct: 0.0,
    derivativesPermitted: true,
    derivativePurposes: [
      "Systematic long-short equity strategies",
      "Inverse hedging and beta protection",
      "Quantitative factor arbitrage overlays",
      "Covered call and cash-secured derivative options",
    ],
    maxGrossDerivativeExposurePct: 100.0, // Capped at 100% of Net Assets
    netEquityDeltaMinPct: 25.0, // Net long exposure corridor
    netEquityDeltaMaxPct: 100.0,
    borrowingLeverageAllowed: false, // No borrowing for leverage
    borrowingLimitPct: 20.0, // Max 20% for temporary liquidity only
    liquidityBufferMinPct: 5.0,
    redemptionCycle: "Weekly or Fortnightly redemption windows with structured settlement.",
    reportingStandard: "Daily/Weekly NAV Mark-to-Market with statutory SIF Risk-o-meter disclosures.",
    mandatoryDisclaimers: [
      "Specified Investment Funds (SIF) are governed by SEBI (Mutual Funds) (Amendment) Regulations, 2024.",
      "The statutory minimum investment across all SIF investment strategies is ₹10,00,000 (Ten Lakhs).",
      "SIF strategies may employ complex derivative strategies including long-short equity and arbitrage overlays.",
      "Capital is not guaranteed; investments are subject to equity, derivative, and counterparty risks.",
    ],
    statutoryWarnings: [
      "Statutory Ticket Floor: Subscription below ₹10 Lakhs per investor is illegal under SEBI SIF framework.",
      "Unlisted equities are strictly forbidden (0.00% permissible allocation).",
      "Gross derivative exposure must not exceed 100% of scheme Net Assets.",
    ],
  },

  // ── Tier 3: High Net-worth PMS ───────────────────────────────────────────────
  hni_pms: {
    tierId: "hni_pms",
    tierName: "HNI Multi-Asset Portfolio Management Services (PMS)",
    shortLabel: "PMS",
    governingBody: "SEBI",
    regulatoryRegime: "SEBI (Portfolio Managers) Regulations, 2020",
    statutoryReference: "SEBI (Portfolio Managers) Regulations, 2020 — Regulation 23(2)",
    vehicleType: "PMS_MULTI_ASSET",
    statutoryMinTicket: 5000000, // ₹50 Lakhs statutory floor
    statutoryMinTicketFormatted: "₹50,00,000 (Fifty Lakhs)",
    investorTargetSegment: "High Net-worth Individuals (HNIs), family trusts, and business promoters.",
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    custodyStructure: "SEGREGATED_CLIENT_DEMAT",
    custodyDescription: "Individual segregated Demat account directly in client's own PAN. Zero pooling.",
    executionRoute: "upstox_pms",
    poolingAllowed: false, // Pooling strictly prohibited under Reg 22
    singleStockCapPct: 10.0,
    singleStockWarnPct: 8.5,
    singleSectorCapPct: 25.0,
    groupExposureCapPct: 25.0,
    unlistedSecuritiesAllowed: false, // Discretionary standard
    unlistedSecuritiesMaxPct: 0.0,
    derivativesPermitted: true,
    derivativePurposes: ["Hedging portfolio risk", "Portfolio balancing on exchange-traded derivatives"],
    maxGrossDerivativeExposurePct: 50.0,
    borrowingLeverageAllowed: false, // Portfolio managers cannot borrow on behalf of clients
    borrowingLimitPct: 0.0,
    liquidityBufferMinPct: 5.0,
    redemptionCycle: "T+2 settlement directly into client's registered bank account upon order execution.",
    reportingStandard: "TWRR (Time-Weighted Rate of Return) per SEBI Circular SEBI/HO/IMD/DF1/CIR/P/2020/26.",
    mandatoryDisclaimers: [
      "Portfolio Management Services are governed by SEBI (Portfolio Managers) Regulations, 2020.",
      "Statutory minimum investment is ₹50 Lakhs under Regulation 23(2).",
      "All securities are held in a segregated Demat account directly in the client's name with no pooling.",
      "PMS investments carry equity market volatility and are not guaranteed.",
    ],
    statutoryWarnings: [
      "SEBI Reg 23(2) Violation: Accepting funds below ₹50,00,000 constitutes a severe statutory offense.",
      "SEBI Reg 22 Prohibition: Client funds or securities cannot be pooled with other clients.",
    ],
  },

  // ── Tier 4: Ultra HNI Alternative Investment Funds ───────────────────────────
  uhni_aif: {
    tierId: "uhni_aif",
    tierName: "UHNI / Institutional Alternative Investment Fund (AIF)",
    shortLabel: "AIF",
    governingBody: "SEBI",
    regulatoryRegime: "SEBI (Alternative Investment Funds) Regulations, 2012",
    statutoryReference: "SEBI (Alternative Investment Funds) Regulations, 2012 — Regulation 10(c)",
    vehicleType: "AIF_MULTI_ASSET",
    statutoryMinTicket: 10000000, // ₹1 Crore statutory floor
    statutoryMinTicketFormatted: "₹1,00,00,000 (One Crore)",
    investorTargetSegment: "Ultra-HNIs, Family Offices, Corporate Treasuries, and Institutional Investors.",
    accreditationRequired: true,
    lockInPeriodMonths: 36, // Standard 3-year commitment
    custodyStructure: "POOLED_TRUST_UNITS",
    custodyDescription: "Units issued by SEBI-registered contributory trust under designated institutional custodian.",
    executionRoute: "multi_asset_orchestration",
    poolingAllowed: true,
    singleStockCapPct: 15.0, // Up to 15% permitted under PPM
    singleStockWarnPct: 12.0,
    singleSectorCapPct: 30.0,
    groupExposureCapPct: 30.0,
    unlistedSecuritiesAllowed: true, // Permitted for Cat I & Cat II
    unlistedSecuritiesMaxPct: 100.0,
    derivativesPermitted: true,
    derivativePurposes: [
      "Complex long-short directional bets",
      "Global equity hedging via Alpaca/LRS",
      "Systematic volatility arbitrage",
      "Synthetic pre-IPO derivative overlays",
    ],
    maxGrossDerivativeExposurePct: 200.0, // Up to 2x leverage for Category III
    borrowingLeverageAllowed: true, // Category III permitted to borrow for leverage
    borrowingLimitPct: 100.0, // 2x NAV limit
    liquidityBufferMinPct: 5.0,
    redemptionCycle: "Quarterly or semi-annual capital drawdown / redemption per PPM terms.",
    reportingStandard: "Audited NAV per unit (Class A/B/C) with quarterly drawdown & PPM benchmark reports.",
    mandatoryDisclaimers: [
      "Alternative Investment Funds are pooled vehicles governed by SEBI (AIF) Regulations, 2012.",
      "Statutory minimum investment commitment is ₹1 Crore under Regulation 10(c).",
      "AIF investments are illiquid, subject to multi-year capital commitment, drawdowns, and high risk.",
    ],
    statutoryWarnings: [
      "SEBI Reg 10(c) Violation: Minimum commitment below ₹1 Crore is prohibited by law.",
      "Accreditation Verification: Accredited Investor (AI) certificate must be on record.",
    ],
  },
};

export class StatutoryInvestmentPolicyService {
  private static instance: StatutoryInvestmentPolicyService;

  static getInstance(): StatutoryInvestmentPolicyService {
    if (!StatutoryInvestmentPolicyService.instance) {
      StatutoryInvestmentPolicyService.instance = new StatutoryInvestmentPolicyService();
    }
    return StatutoryInvestmentPolicyService.instance;
  }

  /**
   * Returns the statutory policy for a specified SEBI tier.
   */
  getPolicy(tierId: SebiTierId): StatutoryInvestmentPolicy {
    const policy = STATUTORY_INVESTMENT_POLICIES[tierId];
    if (!policy) {
      logger.warn(`[StatutoryPolicy] Unknown tier requested: ${tierId}, defaulting to retail_mf`);
      return STATUTORY_INVESTMENT_POLICIES.retail_mf;
    }
    return policy;
  }

  /**
   * Returns all 4 statutory investment policies.
   */
  getAllPolicies(): StatutoryInvestmentPolicy[] {
    return Object.values(STATUTORY_INVESTMENT_POLICIES);
  }

  /**
   * Returns comparative matrix across all 4 tiers for UI comparison and institutional diligence.
   */
  getComparativePolicyMatrix() {
    return {
      version: "SEBI-POLICY-ENGINE-v3.1",
      updatedAt: new Date().toISOString(),
      governingAuthority: "Securities and Exchange Board of India (SEBI)",
      tiers: this.getAllPolicies().map((p) => ({
        tierId: p.tierId,
        tierName: p.tierName,
        shortLabel: p.shortLabel,
        regulatoryRegime: p.regulatoryRegime,
        statutoryReference: p.statutoryReference,
        statutoryMinTicket: p.statutoryMinTicket,
        statutoryMinTicketFormatted: p.statutoryMinTicketFormatted,
        custodyStructure: p.custodyStructure,
        executionRoute: p.executionRoute,
        singleStockCapPct: p.singleStockCapPct,
        unlistedSecuritiesAllowed: p.unlistedSecuritiesAllowed,
        derivativesPermitted: p.derivativesPermitted,
        maxGrossDerivativeExposurePct: p.maxGrossDerivativeExposurePct,
        accreditationRequired: p.accreditationRequired,
        lockInPeriodMonths: p.lockInPeriodMonths,
        reportingStandard: p.reportingStandard,
      })),
      regulatoryHierarchySummary: {
        retail_mf: "Min ₹5,000 lumpsum / ₹500 SIP | SEBI MF Regs 1996 | 10% stock cap | 0% unlisted",
        affluent_sif: "Min ₹10,00,000 (10 Lakhs) | SEBI MF Amendment Regs 2024 | 12% stock cap | 100% gross derivatives | 0% unlisted",
        hni_pms: "Min ₹50,00,000 (50 Lakhs) | SEBI PMS Regs 2020 Reg 23(2) | Segregated Demat | TWRR reporting",
        uhni_aif: "Min ₹1,00,00,000 (1 Crore) | SEBI AIF Regs 2012 Reg 10(c) | Pooled Trust | Unlisted permitted",
      },
    };
  }

  /**
   * Validates proposed investment amount and client parameters against the tier statutory policy.
   */
  validateInvestmentProposal(input: {
    tierId: SebiTierId;
    amount: number;
    clientId?: string;
    isAccreditedInvestor?: boolean;
  }) {
    const policy = this.getPolicy(input.tierId);
    const amount = Number(input.amount) || 0;
    const isBelowMinimum = amount < policy.statutoryMinTicket;
    const deficit = isBelowMinimum ? policy.statutoryMinTicket - amount : 0;

    let isCompliant = !isBelowMinimum;
    let violationCode: string | undefined;
    let violationMessage: string | undefined;

    if (input.tierId === "uhni_aif") {
      if (isBelowMinimum) {
        violationCode = "SEBI_AIF_REG10C_MINIMUM_VIOLATION";
        violationMessage = `Under SEBI (Alternative Investment Funds) Regulations, 2012, Regulation 10(c), the statutory minimum investment commitment for an AIF is ₹1,00,00,000 (One Crore). Current proposal of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below statutory limit.`;
      } else if (policy.accreditationRequired && !input.isAccreditedInvestor) {
        // Warning / caveat for AIF accreditation
        violationCode = "ACCREDITATION_VERIFICATION_REQUIRED";
        violationMessage = "Accredited Investor (AI) certification must be validated prior to unit subscription.";
      }
    } else if (input.tierId === "hni_pms" && isBelowMinimum) {
      violationCode = "SEBI_PMS_REG23_MINIMUM_VIOLATION";
      violationMessage = `Under SEBI (Portfolio Managers) Regulations, 2020, Regulation 23(2), the statutory minimum investment for a PMS account is ₹50,00,000 (Fifty Lakhs). Current proposal of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below statutory limit.`;
    } else if (input.tierId === "affluent_sif" && isBelowMinimum) {
      violationCode = "SEBI_SIF_MINIMUM_VIOLATION";
      violationMessage = `Under SEBI (Mutual Funds) (Amendment) Regulations, 2024, the statutory minimum investment across all Specified Investment Fund (SIF) strategies is ₹10,00,000 (Ten Lakhs). Current proposal of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below statutory limit.`;
    } else if (input.tierId === "retail_mf" && isBelowMinimum) {
      violationCode = "BELOW_PORTFOLIO_MINIMUM";
      violationMessage = `Minimum investment for this Mutual Fund model portfolio is ₹${policy.statutoryMinTicket.toLocaleString("en-IN")}.`;
    }

    return {
      isCompliant: isCompliant && !violationCode?.endsWith("VIOLATION"),
      tierId: input.tierId,
      tierName: policy.tierName,
      statutoryMinTicket: policy.statutoryMinTicket,
      statutoryMinTicketFormatted: policy.statutoryMinTicketFormatted,
      enteredAmount: amount,
      deficitAmount: deficit,
      violationCode,
      message: violationMessage || `Compliant with ${policy.regulatoryRegime}. Meets the statutory threshold of ${policy.statutoryMinTicketFormatted}.`,
      custodyStructure: policy.custodyStructure,
      executionRoute: policy.executionRoute,
      disclaimers: policy.mandatoryDisclaimers,
      statutoryWarnings: policy.statutoryWarnings,
    };
  }
}

export const statutoryInvestmentPolicyService = StatutoryInvestmentPolicyService.getInstance();
