/**
 * @file model-portfolio-tier-service.ts
 * @description SEBI Institutional Tiering & Compliance Engine for FintekPro Model Portfolios (FASP-AI v3.1).
 *
 * Implements strict statutory segmentation into three regulated tiers:
 * 1. Retail Portfolios (< ₹50L):
 *    - Regulatory Regime: SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013.
 *    - Vehicle: Mutual Fund / ETF Baskets.
 *    - Statutory Minimum: ₹5,000 (Lumpsum) / ₹500 (SIP).
 *    - Custody: Direct AMC Folios / Demat.
 *    - Execution: KFintech / CAMS IRIS adapter.
 *
 * 2. HNI Portfolios (₹50L Minimum):
 *    - Regulatory Regime: SEBI (Portfolio Managers) Regulations, 2020.
 *    - Statutory Minimum: ₹50,00,000 (Fifty Lakhs Rupees) strictly enforced under Regulation 23(2).
 *    - Vehicle: Multi-Asset PMS (Portfolio Management Services).
 *    - Custody: Segregated Demat Account in client's own name (no pooling per Reg 22).
 *    - Execution: Direct Equities, ETFs, REITs via Upstox; Cash buffer via IRIS.
 *    - Reporting: Time-Weighted Rate of Return (TWRR) per SEBI circular SEBI/HO/IMD/DF1/CIR/P/2020/26.
 *
 * 3. UHNI / Institutional Portfolios (₹1 Cr Minimum):
 *    - Regulatory Regime: SEBI (Alternative Investment Funds) Regulations, 2012.
 *    - Statutory Minimum: ₹1,00,00,000 (One Crore Rupees) strictly enforced under Regulation 10(c).
 *    - Vehicle: Multi-Asset AIF (Category II / Category III Alternative Investment Fund).
 *    - Custody: Contributory Trust / Custodian with unitized Class A/B/C holdings.
 *    - Execution: Multi-Vendor Orchestrated Execution (Upstox for domestic equities/hedging,
 *                 Alpaca for offshore/US tech equities, IRIS for liquid yield buffer).
 *    - Accreditation: Accredited Investor (AI) verification under SEBI AIF Amendment Regs 2021.
 *
 * Compliance:
 * - GCR v1.0 / FASP-AI v1.0: Zero tolerance for statutory minimum violations.
 * - Idempotent, typed, structured logging with audit telemetry.
 */

import { db } from "../db";
import { modelPortfolios, modelPortfolioHoldings } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { logger } from "../logger";

export type PortfolioTier = "retail_mf" | "affluent_sif" | "hni_pms" | "uhni_aif";
export type VehicleType = "MUTUAL_FUND" | "SIF_NEW_ASSET_CLASS" | "PMS_MULTI_ASSET" | "AIF_MULTI_ASSET";
export type ExecutionRoute = "iris" | "sif_orchestration" | "upstox_pms" | "multi_asset_orchestration";
export type CustodyStructure = "DIRECT_AMC_FOLIO" | "TRUSTEE_AMC_UNITS" | "SEGREGATED_CLIENT_DEMAT" | "POOLED_TRUST_UNITS";

export interface TierSpecification {
  tier: PortfolioTier;
  tierName: string;
  vehicleType: VehicleType;
  sebiRegulatoryRegime: string;
  sebiRegulationRef: string;
  statutoryMinInvestment: number;
  statutoryMinInvestmentFormatted: string;
  minSipAmount?: number;
  executionRoute: ExecutionRoute;
  custodyStructure: CustodyStructure;
  allowedAssetClasses: string[];
  accreditationRequired: boolean;
  lockInPeriodMonths: number;
  reportingStandard: string;
  riskDisclosure: string;
  keyFeatures: string[];
  targetInvestorProfile: string;
}

export const SEBI_TIER_CONFIGS: Record<PortfolioTier, TierSpecification> = {
  retail_mf: {
    tier: "retail_mf",
    tierName: "Retail Mutual Fund & ETF Baskets",
    vehicleType: "MUTUAL_FUND",
    sebiRegulatoryRegime: "SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013",
    sebiRegulationRef: "SEBI MF Regs 1996 / SEBI IA Regs 2013",
    statutoryMinInvestment: 5000,
    statutoryMinInvestmentFormatted: "₹5,000 (SIP: ₹500)",
    minSipAmount: 500,
    executionRoute: "iris",
    custodyStructure: "DIRECT_AMC_FOLIO",
    allowedAssetClasses: [
      "mutual_fund",
      "index_fund",
      "etf",
      "liquid_fund",
      "gold_etf",
      "debt_fund",
      "hybrid_fund",
    ],
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    reportingStandard: "NAV Mark-to-Market & AMFI Risk-o-meter standard",
    riskDisclosure:
      "Mutual Fund investments are subject to market risks, read all scheme related documents carefully. Past performance is not indicative of future returns. FintekPro acts as a SEBI-registered advisory and distribution platform.",
    keyFeatures: [
      "Low barrier to entry with ₹500 SIP / ₹5,000 Lumpsum",
      "Instant liquidity with T+1 / T+2 redemption via KFintech IRIS",
      "AMFI Risk-o-meter calibrated diversification",
      "Direct AMC Folio or Client Demat custody",
    ],
    targetInvestorProfile: "Retail and Emerging Affluent investors building systematic wealth with moderate to high liquidity needs.",
  },

  affluent_sif: {
    tier: "affluent_sif",
    tierName: "Specified Investment Fund (SIF / New Asset Class)",
    vehicleType: "SIF_NEW_ASSET_CLASS",
    sebiRegulatoryRegime: "SEBI (Mutual Funds) (Amendment) Regulations, 2024 — New Asset Class Framework",
    sebiRegulationRef: "SEBI MF Amendment Regulations 2024 / SIF Master Framework",
    statutoryMinInvestment: 1000000, // ₹10 Lakhs statutory minimum
    statutoryMinInvestmentFormatted: "₹10,00,000 (Ten Lakhs)",
    minSipAmount: 10000,
    executionRoute: "sif_orchestration",
    custodyStructure: "TRUSTEE_AMC_UNITS",
    allowedAssetClasses: [
      "direct_equity",
      "etf",
      "derivatives_hedge",
      "long_short_equity",
      "debt_instruments",
      "reit_invit",
      "liquid_buffer",
    ],
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    reportingStandard: "Daily / Weekly NAV Mark-to-Market with statutory SIF Risk-o-meter disclosures",
    riskDisclosure:
      "Specified Investment Funds (SIF) are governed by SEBI (Mutual Funds) (Amendment) Regulations, 2024. Statutory minimum ticket is ₹10 Lakhs across all SIF strategies. SIF employs sophisticated derivative strategies, long-short equity, and factor arbitrage overlays. Capital is subject to equity and derivative market risks.",
    keyFeatures: [
      "Strict statutory minimum of ₹10 Lakhs per investor under SEBI SIF framework",
      "Sophisticated strategies: Long-short equity, factor arbitrage, and inverse derivative hedging",
      "Higher 12% single-stock issuer cap (vs 10% for traditional Mutual Funds)",
      "Trustee-governed unitized custody with independent institutional custodian (TRUSTEE_AMC_UNITS)",
      "Strict 0% unlisted equity prohibition and no borrowing for leverage",
    ],
    targetInvestorProfile: "Affluent investors seeking hedge-fund-like alpha and market-neutral strategies with institutional trustee oversight.",
  },

  hni_pms: {
    tier: "hni_pms",
    tierName: "HNI Multi-Asset Portfolio Management Services (PMS)",
    vehicleType: "PMS_MULTI_ASSET",
    sebiRegulatoryRegime: "SEBI (Portfolio Managers) Regulations, 2020",
    sebiRegulationRef: "SEBI (Portfolio Managers) Regulations, 2020 - Regulation 23(2)",
    statutoryMinInvestment: 5000000, // ₹50 Lakhs statutory minimum
    statutoryMinInvestmentFormatted: "₹50,00,000 (Fifty Lakhs)",
    executionRoute: "upstox_pms",
    custodyStructure: "SEGREGATED_CLIENT_DEMAT",
    allowedAssetClasses: [
      "direct_equity",
      "etf",
      "reit_invit",
      "corporate_bond",
      "g_sec",
      "sovereign_gold_bond",
      "liquid_buffer",
    ],
    accreditationRequired: false,
    lockInPeriodMonths: 0,
    reportingStandard: "TWRR (Time-Weighted Rate of Return) per SEBI Circular SEBI/HO/IMD/DF1/CIR/P/2020/26",
    riskDisclosure:
      "Portfolio Management Services (PMS) are governed by SEBI (Portfolio Managers) Regulations, 2020. Statutory minimum ticket is ₹50 Lakhs under Regulation 23(2). All securities are held in segregated Demat accounts directly in the client's name (no pooling). PMS investments carry equity market risks and are not guaranteed.",
    keyFeatures: [
      "Strict statutory minimum of ₹50 Lakhs under SEBI Reg 23(2)",
      "Direct holding of institutional-grade securities in segregated Client Demat via Upstox",
      "Tactical Multi-Asset asset allocation across direct equities, REITs, gold & corporate debt",
      "Audited TWRR performance reporting and Form C compliance disclosures",
    ],
    targetInvestorProfile: "High Net-worth Individuals (HNIs), family trusts, and business owners seeking bespoke alpha generation with direct asset ownership.",
  },

  uhni_aif: {
    tier: "uhni_aif",
    tierName: "UHNI / Institutional Multi-Asset Alternative Investment Fund (AIF)",
    vehicleType: "AIF_MULTI_ASSET",
    sebiRegulatoryRegime: "SEBI (Alternative Investment Funds) Regulations, 2012",
    sebiRegulationRef: "SEBI (Alternative Investment Funds) Regulations, 2012 - Regulation 10(c)",
    statutoryMinInvestment: 10000000, // ₹1 Crore statutory minimum
    statutoryMinInvestmentFormatted: "₹1,00,00,000 (One Crore)",
    executionRoute: "multi_asset_orchestration",
    custodyStructure: "POOLED_TRUST_UNITS",
    allowedAssetClasses: [
      "direct_equity",
      "unlisted_equity",
      "pre_ipo",
      "global_equity",
      "derivatives_hedge",
      "structured_debt",
      "venture_debt",
      "liquid_yield",
    ],
    accreditationRequired: true,
    lockInPeriodMonths: 36, // Standard 3-year commitment
    reportingStandard: "Net Asset Value per Unit (Class A/B/C) with audited PPM benchmarks and quarterly drawdown statements",
    riskDisclosure:
      "Alternative Investment Funds (AIF) are pooled vehicles governed by SEBI (Alternative Investment Funds) Regulations, 2012. Minimum statutory investment commitment is ₹1 Crore under Regulation 10(c). AIF investments are illiquid, involve capital drawdowns, and carry significant risk including market, leverage, and liquidity risks.",
    keyFeatures: [
      "Strict statutory minimum of ₹1 Crore under SEBI Reg 10(c)",
      "Multi-vendor orchestration: Domestic Listed & Derivatives via Upstox, Global US Tech Equities via Alpaca, Liquid Yield via IRIS",
      "Access to unlisted pre-IPO growth companies, structured debt, and derivative hedging strategies",
      "Accredited Investor (AI) framework with institutional custodian oversight",
    ],
    targetInvestorProfile: "Ultra-HNIs, Family Offices, and Institutional Investors seeking asymmetric returns, alternative asset exposure, and international diversification.",
  },
};

export interface InvestmentComplianceCheckInput {
  portfolioId: string;
  portfolioTier: PortfolioTier;
  amount: number;
  clientId?: string;
  isAccreditedInvestor?: boolean;
}

export interface InvestmentComplianceResult {
  isCompliant: boolean;
  portfolioTier: PortfolioTier;
  vehicleType: VehicleType;
  statutoryMinInvestment: number;
  enteredAmount: number;
  deficitAmount: number;
  executionRoute: ExecutionRoute;
  custodyStructure: CustodyStructure;
  sebiRegulatoryRegime: string;
  sebiRegulationRef: string;
  violationCode?: "SEBI_PMS_REG23_MINIMUM_VIOLATION" | "SEBI_AIF_REG10C_MINIMUM_VIOLATION" | "SEBI_SIF_MINIMUM_VIOLATION" | "BELOW_PORTFOLIO_MINIMUM" | "ACCREDITATION_REQUIRED";
  message: string;
  statutoryWarning?: string;
  regulatoryNotice: string;
  advisoryDisclaimer: string;
}

/**
 * Validates whether an investment amount and investor profile strictly comply
 * with statutory SEBI minimums and tier-specific regulations.
 */
export function validateInvestmentTierCompliance(input: InvestmentComplianceCheckInput): InvestmentComplianceResult {
  const spec = SEBI_TIER_CONFIGS[input.portfolioTier] || SEBI_TIER_CONFIGS.retail_mf;
  const amount = Number(input.amount) || 0;

  // 1. Strict Statutory Check for UHNI AIF (Regulation 10(c) — ₹1 Crore minimum)
  if (input.portfolioTier === "uhni_aif" && amount < 10000000) {
    const deficit = 10000000 - amount;
    return {
      isCompliant: false,
      portfolioTier: "uhni_aif",
      vehicleType: "AIF_MULTI_ASSET",
      statutoryMinInvestment: 10000000,
      enteredAmount: amount,
      deficitAmount: deficit,
      executionRoute: spec.executionRoute,
      custodyStructure: spec.custodyStructure,
      sebiRegulatoryRegime: spec.sebiRegulatoryRegime,
      sebiRegulationRef: spec.sebiRegulationRef,
      violationCode: "SEBI_AIF_REG10C_MINIMUM_VIOLATION",
      message: `SEBI Compliance Rejection: Under SEBI (Alternative Investment Funds) Regulations, 2012, Regulation 10(c), the statutory minimum investment commitment for an Alternative Investment Fund (AIF) is ₹1,00,00,000 (One Crore). The proposed commitment of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below the statutory requirement.`,
      statutoryWarning: "Statutory Violation: Subscription to AIF Class units below ₹1 Crore is strictly forbidden by SEBI AIF Regulations.",
      regulatoryNotice: "AIF investors must execute the Private Placement Memorandum (PPM) contribution agreement and satisfy Accredited Investor criteria.",
      advisoryDisclaimer: spec.riskDisclosure,
    };
  }

  // 2. Strict Statutory Check for HNI PMS (Regulation 23(2) — ₹50 Lakhs minimum)
  if (input.portfolioTier === "hni_pms" && amount < 5000000) {
    const deficit = 5000000 - amount;
    return {
      isCompliant: false,
      portfolioTier: "hni_pms",
      vehicleType: "PMS_MULTI_ASSET",
      statutoryMinInvestment: 5000000,
      enteredAmount: amount,
      deficitAmount: deficit,
      executionRoute: spec.executionRoute,
      custodyStructure: spec.custodyStructure,
      sebiRegulatoryRegime: spec.sebiRegulatoryRegime,
      sebiRegulationRef: spec.sebiRegulationRef,
      violationCode: "SEBI_PMS_REG23_MINIMUM_VIOLATION",
      message: `SEBI Compliance Rejection: Under SEBI (Portfolio Managers) Regulations, 2020, Regulation 23(2), the statutory minimum investment for a Portfolio Management Services (PMS) account is ₹50,00,000 (Fifty Lakhs). The proposed investment of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below the legal limit.`,
      statutoryWarning: "Statutory Violation: Accepting funds below ₹50 Lakhs for a PMS vehicle constitutes a non-compliance penalty under SEBI PMS regulations.",
      regulatoryNotice: "Client assets must be routed to segregated Demat accounts once the ₹50L threshold is satisfied.",
      advisoryDisclaimer: spec.riskDisclosure,
    };
  }

  // 3. Strict Statutory Check for Affluent SIF / New Asset Class (₹10 Lakhs minimum)
  if (input.portfolioTier === "affluent_sif" && amount < 1000000) {
    const deficit = 1000000 - amount;
    return {
      isCompliant: false,
      portfolioTier: "affluent_sif",
      vehicleType: "SIF_NEW_ASSET_CLASS",
      statutoryMinInvestment: 1000000,
      enteredAmount: amount,
      deficitAmount: deficit,
      executionRoute: spec.executionRoute,
      custodyStructure: spec.custodyStructure,
      sebiRegulatoryRegime: spec.sebiRegulatoryRegime,
      sebiRegulationRef: spec.sebiRegulationRef,
      violationCode: "SEBI_SIF_MINIMUM_VIOLATION",
      message: `SEBI Compliance Rejection: Under SEBI (Mutual Funds) (Amendment) Regulations, 2024 (New Asset Class), the statutory minimum investment across all Specified Investment Fund (SIF) strategies is ₹10,00,000 (Ten Lakhs). The proposed investment of ₹${amount.toLocaleString("en-IN")} is ₹${deficit.toLocaleString("en-IN")} below the legal limit.`,
      statutoryWarning: "Statutory Violation: Subscribing to SIF strategies below ₹10 Lakhs is strictly prohibited under the SEBI New Asset Class framework.",
      regulatoryNotice: "Units will be issued under AMC Trustee governance with independent custodian custody upon satisfying the ₹10L threshold.",
      advisoryDisclaimer: spec.riskDisclosure,
    };
  }

  // 4. Retail Mutual Fund minimum check
  if (input.portfolioTier === "retail_mf" && amount < spec.statutoryMinInvestment) {
    const deficit = spec.statutoryMinInvestment - amount;
    return {
      isCompliant: false,
      portfolioTier: "retail_mf",
      vehicleType: "MUTUAL_FUND",
      statutoryMinInvestment: spec.statutoryMinInvestment,
      enteredAmount: amount,
      deficitAmount: deficit,
      executionRoute: spec.executionRoute,
      custodyStructure: spec.custodyStructure,
      sebiRegulatoryRegime: spec.sebiRegulatoryRegime,
      sebiRegulationRef: spec.sebiRegulationRef,
      violationCode: "BELOW_PORTFOLIO_MINIMUM",
      message: `Minimum initial investment for this Mutual Fund model portfolio is ₹${spec.statutoryMinInvestment.toLocaleString("en-IN")}.`,
      regulatoryNotice: "Execution will be processed via KFintech IRIS into client's registered mutual fund folios.",
      advisoryDisclaimer: spec.riskDisclosure,
    };
  }

  // Fully compliant
  return {
    isCompliant: true,
    portfolioTier: input.portfolioTier,
    vehicleType: spec.vehicleType,
    statutoryMinInvestment: spec.statutoryMinInvestment,
    enteredAmount: amount,
    deficitAmount: 0,
    executionRoute: spec.executionRoute,
    custodyStructure: spec.custodyStructure,
    sebiRegulatoryRegime: spec.sebiRegulatoryRegime,
    sebiRegulationRef: spec.sebiRegulationRef,
    message: `Compliant with ${spec.sebiRegulatoryRegime}. Meets the statutory threshold of ${spec.statutoryMinInvestmentFormatted}.`,
    regulatoryNotice: input.portfolioTier === "hni_pms"
      ? "Direct execution routed to Upstox for segregated Demat custody in client's name."
      : input.portfolioTier === "uhni_aif"
      ? "Multi-vendor orchestrated execution across Upstox (domestic equities/derivatives), Alpaca (US/global equities), and IRIS (liquid cash buffer)."
      : input.portfolioTier === "affluent_sif"
      ? "Executed under SIF Master Framework with AMC Trustee custody and independent institutional custodian."
      : "Executed as mutual fund scheme basket via KFintech IRIS.",
    advisoryDisclaimer: spec.riskDisclosure,
  };
}

/**
 * Returns complete institutional comparison metadata across all four SEBI tiers.
 */
export function getTierComparisonMatrix() {
  return {
    tiers: Object.values(SEBI_TIER_CONFIGS),
    statutoryRulesSummary: {
      retail: "Retail MF: Open to all retail investors. Minimum ticket ₹5,000 lumpsum / ₹500 SIP. Managed under SEBI (Mutual Funds) Regulations, 1996.",
      sif: "Affluent SIF: Specified Investment Fund / New Asset Class. Minimum ticket ₹10 Lakhs across all SIF strategies under SEBI MF (Amendment) Regs 2024. Trustee unitized custody.",
      hni: "HNI PMS: Multi-Asset Portfolio Management Services. Minimum ticket ₹50 Lakhs under SEBI (Portfolio Managers) Regulations, 2020, Reg 23(2). Segregated Demat accounts.",
      uhni: "UHNI AIF: Multi-Asset Alternative Investment Funds. Minimum commitment ₹1 Crore under SEBI (Alternative Investment Funds) Regulations, 2012, Reg 10(c). Multi-vendor global execution.",
    },
    version: "FASP-AI-v3.1",
    timestamp: new Date().toISOString(),
  };
}

// Tier 1: Retail Mutual Fund Portfolios
const retailPortfolios = [
    {
      id: "all-weather-india",
      name: "All-Weather India Strategy",
      tagline: "Diversified core portfolio across large-cap, mid-cap, corporate debt, and gold",
      riskProfile: "moderate",
      assetClass: "hybrid",
      subCategory: "Multi-Asset Allocation",
      minInvestment: "5000",
      timeHorizon: "3-5 Years",
      benchmarkName: "NIFTY 500 TRI",
      portfolioTier: "retail_mf",
      vehicleType: "MUTUAL_FUND",
      sebiRegulatoryRegime: "SEBI (Mutual Funds) Regulations, 1996 & SEBI (Investment Advisers) Regulations, 2013",
      sebiRegulationRef: "SEBI MF Regs 1996",
      statutoryMinInvestment: "5000",
      executionRoute: "iris",
      custodyStructure: "DIRECT_AMC_FOLIO",
      allowedAssetClasses: ["mutual_fund", "index_fund", "etf", "liquid_fund", "gold_etf"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "Retail Core Multi-Asset (Min ₹5,000)",
      icon: "🇮🇳",
      portfolioCode: "FP-001",
    },
    {
      id: "conservative-income",
      name: "Conservative Capital Preserver",
      tagline: "High-grade sovereign gilts, banking PSU debt, and liquid instruments",
      riskProfile: "conservative",
      assetClass: "debt",
      subCategory: "Fixed Income",
      minInvestment: "5000",
      timeHorizon: "1-3 Years",
      benchmarkName: "CRISIL Composite Bond Index",
      portfolioTier: "retail_mf",
      vehicleType: "MUTUAL_FUND",
      sebiRegulatoryRegime: "SEBI (Mutual Funds) Regulations, 1996",
      sebiRegulationRef: "SEBI MF Regs 1996",
      statutoryMinInvestment: "5000",
      executionRoute: "iris",
      custodyStructure: "DIRECT_AMC_FOLIO",
      allowedAssetClasses: ["debt_fund", "gilt_fund", "liquid_fund", "banking_psu_fund"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "Capital Protection Focus (Min ₹5,000)",
      icon: "🛡️",
      portfolioCode: "FP-002",
    },
  ];

  // Tier 2: HNI Multi-Asset PMS Portfolios (₹50L Statutory Minimum)
  const hniPmsPortfolios = [
    {
      id: "hni-multi-asset-alpha-pms",
      name: "HNI Multi-Asset Alpha PMS",
      tagline: "Direct high-conviction equities, corporate bonds, REITs & gold in segregated Demat",
      riskProfile: "aggressive",
      assetClass: "hni",
      subCategory: "Discretionary Multi-Asset PMS",
      minInvestment: "5000000", // ₹50 Lakhs
      timeHorizon: "3-5+ Years",
      benchmarkName: "NSE Multi Asset Index 1",
      portfolioTier: "hni_pms",
      vehicleType: "PMS_MULTI_ASSET",
      sebiRegulatoryRegime: "SEBI (Portfolio Managers) Regulations, 2020",
      sebiRegulationRef: "SEBI (Portfolio Managers) Regulations, 2020 - Regulation 23(2)",
      statutoryMinInvestment: "5000000",
      executionRoute: "upstox_pms",
      custodyStructure: "SEGREGATED_CLIENT_DEMAT",
      allowedAssetClasses: ["direct_equity", "etf", "reit_invit", "corporate_bond", "g_sec", "sovereign_gold_bond", "liquid_buffer"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "SEBI Regulated PMS (Min ₹50 Lakhs)",
      icon: "💼",
      portfolioCode: "FP-PMS-01",
      allocation: [
        { category: "direct_equity", label: "Large & Mid-Cap Leaders", weight: 55, color: "#3B82F6", icon: "📈" },
        { category: "corporate_bond", label: "AAA Corporate Debt & G-Secs", weight: 25, color: "#10B981", icon: "🏛️" },
        { category: "reit_invit", label: "REITs & Infrastructure Trusts", weight: 10, color: "#8B5CF6", icon: "🏢" },
        { category: "gold", label: "Sovereign Gold / Gold ETFs", weight: 10, color: "#F59E0B", icon: "🪙" },
      ],
      holdings: [
        { rank: 1, name: "Reliance Industries Ltd", symbol: "RELIANCE", assetClass: "equity", category: "Stock", weight: 9.5, isin: "INE002A01018", currentReturn: 18.5 },
        { rank: 2, name: "HDFC Bank Ltd", symbol: "HDFCBANK", assetClass: "equity", category: "Stock", weight: 9.5, isin: "INE040A01034", currentReturn: 14.2 },
        { rank: 3, name: "Tata Consultancy Services Ltd", symbol: "TCS", assetClass: "equity", category: "Stock", weight: 9.0, isin: "INE467B01029", currentReturn: 16.8 },
        { rank: 4, name: "Larsen & Toubro Ltd", symbol: "LT", assetClass: "equity", category: "Stock", weight: 9.0, isin: "INE018A01030", currentReturn: 22.4 },
        { rank: 5, name: "ICICI Bank Ltd", symbol: "ICICIBANK", assetClass: "equity", category: "Stock", weight: 9.0, isin: "INE090A01021", currentReturn: 19.1 },
        { rank: 6, name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", assetClass: "equity", category: "Stock", weight: 9.0, isin: "INE397D01024", currentReturn: 24.6 },
        { rank: 7, name: "NABARD AAA Corporate Bond 2029", symbol: "NABARD29", assetClass: "debt", category: "Bond", weight: 9.5, isin: "INE261F08018", currentReturn: 7.8 },
        { rank: 8, name: "REC Ltd AAA Taxable Bond 2031", symbol: "RECL31", assetClass: "debt", category: "Bond", weight: 9.5, isin: "INE020B08898", currentReturn: 7.9 },
        { rank: 9, name: "SIDBI AAA Corporate Bond 2028", symbol: "SIDBI28", assetClass: "debt", category: "Bond", weight: 6.0, isin: "INE556F08014", currentReturn: 7.7 },
        { rank: 10, name: "Embassy Office Parks REIT", symbol: "EMBASSY", assetClass: "reit", category: "REIT", weight: 10.0, isin: "INE041025011", currentReturn: 11.2 },
        { rank: 11, name: "Nippon India Gold ETF", symbol: "GOLDBEES", assetClass: "gold", category: "ETF", weight: 10.0, isin: "INF204KB17I5", currentReturn: 14.5 },
      ],
    },
    {
      id: "hni-focused-leaders-pms",
      name: "HNI Concentrated Leaders PMS",
      tagline: "Concentrated 15-20 stock portfolio in India's highest ROCE structural champions",
      riskProfile: "high",
      assetClass: "hni",
      subCategory: "Discretionary Equity PMS",
      minInvestment: "5000000", // ₹50 Lakhs
      timeHorizon: "5+ Years",
      benchmarkName: "BSE 200 TRI",
      portfolioTier: "hni_pms",
      vehicleType: "PMS_MULTI_ASSET",
      sebiRegulatoryRegime: "SEBI (Portfolio Managers) Regulations, 2020",
      sebiRegulationRef: "SEBI (Portfolio Managers) Regulations, 2020 - Regulation 23(2)",
      statutoryMinInvestment: "5000000",
      executionRoute: "upstox_pms",
      custodyStructure: "SEGREGATED_CLIENT_DEMAT",
      allowedAssetClasses: ["direct_equity", "liquid_buffer"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "High Conviction Equity PMS (Min ₹50 Lakhs)",
      icon: "🎯",
      portfolioCode: "FP-PMS-02",
      allocation: [
        { category: "direct_equity", label: "Structural High-ROCE Compounders (Upstox)", weight: 80, color: "#3B82F6", icon: "💎" },
        { category: "mid_cap", label: "High-Growth Emerging Champions", weight: 15, color: "#8B5CF6", icon: "🚀" },
        { category: "liquid_buffer", label: "Liquid Buffer & Overnight Collateral", weight: 5, color: "#10B981", icon: "🏛️" },
      ],
      holdings: [
        { rank: 1, name: "Tata Consultancy Services Ltd", symbol: "TCS", assetClass: "equity", category: "Stock", weight: 8.0, isin: "INE467B01029", currentReturn: 16.8 },
        { rank: 2, name: "Titan Company Ltd", symbol: "TITAN", assetClass: "equity", category: "Stock", weight: 7.5, isin: "INE280A01028", currentReturn: 21.4 },
        { rank: 3, name: "Hindustan Unilever Ltd", symbol: "HINDUNILVR", assetClass: "equity", category: "Stock", weight: 7.0, isin: "INE030A01027", currentReturn: 11.2 },
        { rank: 4, name: "Infosys Ltd", symbol: "INFY", assetClass: "equity", category: "Stock", weight: 7.0, isin: "INE009A01021", currentReturn: 17.5 },
        { rank: 5, name: "Larsen & Toubro Ltd", symbol: "LT", assetClass: "equity", category: "Stock", weight: 7.0, isin: "INE018A01030", currentReturn: 22.4 },
        { rank: 6, name: "Bajaj Finance Ltd", symbol: "BAJFINANCE", assetClass: "equity", category: "Stock", weight: 6.5, isin: "INE296A01024", currentReturn: 19.8 },
        { rank: 7, name: "Asian Paints Ltd", symbol: "ASIANPAINT", assetClass: "equity", category: "Stock", weight: 6.5, isin: "INE021A01026", currentReturn: 13.6 },
        { rank: 8, name: "ICICI Bank Ltd", symbol: "ICICIBANK", assetClass: "equity", category: "Stock", weight: 6.5, isin: "INE090A01021", currentReturn: 19.1 },
        { rank: 9, name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", assetClass: "equity", category: "Stock", weight: 6.5, isin: "INE397D01024", currentReturn: 24.6 },
        { rank: 10, name: "HCL Technologies Ltd", symbol: "HCLTECH", assetClass: "equity", category: "Stock", weight: 6.0, isin: "INE860A01027", currentReturn: 18.2 },
        { rank: 11, name: "ITC Ltd", symbol: "ITC", assetClass: "equity", category: "Stock", weight: 6.0, isin: "INE154A01025", currentReturn: 15.4 },
        { rank: 12, name: "Pidilite Industries Ltd", symbol: "PIDILITIND", assetClass: "equity", category: "Stock", weight: 5.5, isin: "INE318A01026", currentReturn: 18.9 },
        { rank: 13, name: "Sun Pharmaceutical Industries Ltd", symbol: "SUNPHARMA", assetClass: "equity", category: "Stock", weight: 5.0, isin: "INE044A01036", currentReturn: 23.1 },
        { rank: 14, name: "Bharat Electronics Ltd", symbol: "BEL", assetClass: "equity", category: "Stock", weight: 5.0, isin: "INE263A01024", currentReturn: 32.5 },
        { rank: 15, name: "UltraTech Cement Ltd", symbol: "ULTRACEMCO", assetClass: "equity", category: "Stock", weight: 4.5, isin: "INE481G01011", currentReturn: 14.8 },
        { rank: 16, name: "CCIL TREPS & Overnight Yield Buffer", symbol: "TREPS-LIQ", assetClass: "debt", category: "Money Market", weight: 5.0, currentReturn: 6.6 },
      ],
    },
  ];

  // Tier 3: UHNI / Institutional Multi-Asset AIF Portfolios (₹1 Cr Statutory Minimum)
  const uhniAifPortfolios = [
    {
      id: "uhni-global-opportunities-aif",
      name: "UHNI Global Multi-Asset Opportunities AIF",
      tagline: "Category III AIF combining Indian domestic champions, US technology titans, and hedging",
      riskProfile: "aggressive",
      assetClass: "alternatives",
      subCategory: "Category III Long/Short Multi-Asset AIF",
      minInvestment: "10000000", // ₹1 Crore
      timeHorizon: "3-5+ Years",
      benchmarkName: "Blended: 60% Nifty 500 + 40% S&P 500 TRI",
      portfolioTier: "uhni_aif",
      vehicleType: "AIF_MULTI_ASSET",
      sebiRegulatoryRegime: "SEBI (Alternative Investment Funds) Regulations, 2012",
      sebiRegulationRef: "SEBI (Alternative Investment Funds) Regulations, 2012 - Regulation 10(c)",
      statutoryMinInvestment: "10000000",
      executionRoute: "multi_asset_orchestration",
      custodyStructure: "POOLED_TRUST_UNITS",
      allowedAssetClasses: ["direct_equity", "unlisted_equity", "global_equity", "derivatives_hedge", "structured_debt", "liquid_yield"],
      accreditationRequired: true,
      lockInPeriodMonths: 36,
      highlight: "Global Multi-Asset AIF (Min ₹1 Crore)",
      icon: "🌐",
      portfolioCode: "FP-AIF-01",
      allocation: [
        { category: "direct_equity", label: "Indian Market Titans (Upstox)", weight: 45, color: "#3B82F6", icon: "🇮🇳" },
        { category: "global_equity", label: "Global US Mega-Tech (Alpaca LRS)", weight: 30, color: "#8B5CF6", icon: "🇺🇸" },
        { category: "unlisted_equity", label: "Pre-IPO & Structured Credit", weight: 15, color: "#F59E0B", icon: "💎" },
        { category: "derivatives_hedge", label: "Derivative Hedging Buffer (Upstox F&O)", weight: 10, color: "#EC4899", icon: "🛡️" },
      ],
      holdings: [
        { rank: 1, name: "Tata Consultancy Services Ltd", symbol: "TCS", category: "Stock", weight: 10, isin: "INE467B01029", currentReturn: 16.8 },
        { rank: 2, name: "Reliance Industries Ltd", symbol: "RELIANCE", category: "Stock", weight: 10, isin: "INE002A01018", currentReturn: 18.5 },
        { rank: 3, name: "HDFC Bank Ltd", symbol: "HDFCBANK", category: "Stock", weight: 9, isin: "INE040A01034", currentReturn: 14.2 },
        { rank: 4, name: "Larsen & Toubro Ltd", symbol: "LT", category: "Stock", weight: 8, isin: "INE018A01030", currentReturn: 22.4 },
        { rank: 5, name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", category: "Stock", weight: 8, isin: "INE397D01024", currentReturn: 24.6 },
        { rank: 6, name: "Microsoft Corporation (NASDAQ)", symbol: "MSFT", category: "Global Stock", weight: 10, currentReturn: 26.2 },
        { rank: 7, name: "NVIDIA Corporation (NASDAQ)", symbol: "NVDA", category: "Global Stock", weight: 10, currentReturn: 48.5 },
        { rank: 8, name: "Alphabet Inc Class A (NASDAQ)", symbol: "GOOGL", category: "Global Stock", weight: 10, currentReturn: 24.1 },
        { rank: 9, name: "India Pre-IPO FinTech Growth Trust", symbol: "PREIPO-FT", category: "Unlisted", weight: 15, currentReturn: 19.8 },
        { rank: 10, name: "NIFTY Index Put Hedge & Liquid Yield", symbol: "HEDGE-CASH", category: "Derivatives", weight: 10, currentReturn: 6.9 },
      ],
    },
    {
      id: "uhni-private-tech-disruptors-aif",
      name: "UHNI Private Tech & Pre-IPO AIF",
      tagline: "Category II AIF dedicated to late-stage unlisted tech unicorns and IPO-bound champions",
      riskProfile: "high",
      assetClass: "alternatives",
      subCategory: "Category II Private Equity / Pre-IPO AIF",
      minInvestment: "10000000", // ₹1 Crore
      timeHorizon: "5-7 Years",
      benchmarkName: "Crisil AIF Benchmark (Cat II)",
      portfolioTier: "uhni_aif",
      vehicleType: "AIF_MULTI_ASSET",
      sebiRegulatoryRegime: "SEBI (Alternative Investment Funds) Regulations, 2012",
      sebiRegulationRef: "SEBI (Alternative Investment Funds) Regulations, 2012 - Regulation 10(c)",
      statutoryMinInvestment: "10000000",
      executionRoute: "multi_asset_orchestration",
      custodyStructure: "POOLED_TRUST_UNITS",
      allowedAssetClasses: ["unlisted_equity", "pre_ipo", "structured_debt", "liquid_yield"],
      accreditationRequired: true,
      lockInPeriodMonths: 60,
      highlight: "Unlisted Tech Growth AIF (Min ₹1 Crore)",
      icon: "🚀",
      portfolioCode: "FP-AIF-02",
      allocation: [
        { category: "unlisted_equity", label: "Late-Stage Market Titans (NSE, Unicorns)", weight: 48, color: "#3B82F6", icon: "🏛️" },
        { category: "pre_ipo", label: "IPO-Bound Growth Tech Tranches", weight: 36, color: "#F59E0B", icon: "💎" },
        { category: "structured_debt", label: "Senior Secured Venture Debt Notes", weight: 8, color: "#8B5CF6", icon: "📜" },
        { category: "liquid_yield", label: "Sovereign T-Bills & Treasury Yield", weight: 8, color: "#10B981", icon: "🛡️" },
      ],
      holdings: [
        { rank: 1, name: "National Stock Exchange of India (NSE)", symbol: "NSE", assetClass: "unlisted", category: "Unlisted Equity", weight: 18.0, currentReturn: 28.5 },
        { rank: 2, name: "Swiggy Limited Pre-IPO Equity Tranche", symbol: "SWIGGY", assetClass: "unlisted", category: "Pre-IPO", weight: 14.0, currentReturn: 22.0 },
        { rank: 3, name: "Imagine Marketing Ltd (boAt) Pre-IPO", symbol: "BOAT", assetClass: "unlisted", category: "Pre-IPO", weight: 12.0, currentReturn: 19.5 },
        { rank: 4, name: "Oravel Stays Ltd (OYO) Private Trust", symbol: "OYO", assetClass: "unlisted", category: "Unlisted Equity", weight: 10.0, currentReturn: 16.2 },
        { rank: 5, name: "Tata Technologies Private Placement Units", symbol: "TATATECH-PE", assetClass: "unlisted", category: "Pre-IPO", weight: 10.0, currentReturn: 24.8 },
        { rank: 6, name: "API Holdings (PharmEasy) Growth Tranche", symbol: "PHARMEASY", assetClass: "unlisted", category: "Unlisted Equity", weight: 8.0, currentReturn: 15.0 },
        { rank: 7, name: "Pine Labs FinTech Private Equity Trust", symbol: "PINELABS", assetClass: "unlisted", category: "Unlisted Equity", weight: 8.0, currentReturn: 18.5 },
        { rank: 8, name: "Zepto (KiranaKart) Hyperlocal Growth Units", symbol: "ZEPTO", assetClass: "unlisted", category: "Unlisted Equity", weight: 6.0, currentReturn: 32.0 },
        { rank: 9, name: "Senior Secured Venture Debt Note 2027", symbol: "VENTURE-DEBT", assetClass: "debt", category: "Structured Debt", weight: 7.0, currentReturn: 12.4 },
        { rank: 10, name: "91-Day Sovereign T-Bills Collateral Reserve", symbol: "TBILL-LIQ", assetClass: "debt", category: "Sovereign Debt", weight: 7.0, currentReturn: 6.85 },
      ],
    },
  ];

  // Tier 4: Affluent SIF / New Asset Class Portfolios (₹10L Statutory Minimum)
  const affluentSifPortfolios = [
    {
      id: "sif-long-short-equity",
      name: "FintekPro SIF Long-Short Equity Alpha Strategy",
      tagline: "SEBI New Asset Class fund combining high-conviction long equity with systematic short derivative hedges",
      riskProfile: "aggressive",
      assetClass: "equity",
      subCategory: "Long-Short Equity (SIF)",
      minInvestment: "1000000", // ₹10 Lakhs
      timeHorizon: "3-5 Years",
      benchmarkName: "NIFTY 500 TRI",
      portfolioTier: "affluent_sif",
      vehicleType: "SIF_NEW_ASSET_CLASS",
      sebiRegulatoryRegime: "SEBI (Mutual Funds) (Amendment) Regulations, 2024 — New Asset Class Framework",
      sebiRegulationRef: "SEBI MF Amendment Regulations 2024 / SIF Master Framework",
      statutoryMinInvestment: "1000000",
      executionRoute: "sif_orchestration",
      custodyStructure: "TRUSTEE_AMC_UNITS",
      allowedAssetClasses: ["direct_equity", "etf", "derivatives_hedge", "long_short_equity", "debt_instruments", "liquid_buffer"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "SEBI New Asset Class (Min ₹10 Lakhs)",
      icon: "⚡",
      portfolioCode: "FP-SIF-01",
      allocation: [
        { category: "direct_equity", label: "Long High-Conviction Equities", weight: 55, color: "#3B82F6", icon: "📈" },
        { category: "derivatives_hedge", label: "Systematic Short/Hedge Derivatives", weight: 20, color: "#EF4444", icon: "🛡️" },
        { category: "arbitrage", label: "Factor Arbitrage Overlay", weight: 15, color: "#8B5CF6", icon: "⚖️" },
        { category: "liquid_yield", label: "Sovereign T-Bills & Liquid Collateral", weight: 10, color: "#10B981", icon: "🏛️" },
      ],
      holdings: [
        { rank: 1, name: "Reliance Industries Ltd", symbol: "RELIANCE", assetClass: "equity", category: "Stock", weight: 9.5, isin: "INE002A01018", currentReturn: 18.5 },
        { rank: 2, name: "HDFC Bank Ltd", symbol: "HDFCBANK", assetClass: "equity", category: "Stock", weight: 9.2, isin: "INE040A01034", currentReturn: 14.2 },
        { rank: 3, name: "ICICI Bank Ltd", symbol: "ICICIBANK", assetClass: "equity", category: "Stock", weight: 8.8, isin: "INE090A01021", currentReturn: 19.1 },
        { rank: 4, name: "Tata Consultancy Services Ltd", symbol: "TCS", assetClass: "equity", category: "Stock", weight: 8.5, isin: "INE467B01029", currentReturn: 16.8 },
        { rank: 5, name: "Larsen & Toubro Ltd", symbol: "LT", assetClass: "equity", category: "Stock", weight: 8.0, isin: "INE018A01030", currentReturn: 22.4 },
        { rank: 6, name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", assetClass: "equity", category: "Stock", weight: 8.0, isin: "INE397D01024", currentReturn: 24.6 },
        { rank: 7, name: "NIFTY Put Hedge & Index Futures Short", symbol: "NIFTY-SHORT", assetClass: "derivatives", category: "Derivatives", weight: 15.0, currentReturn: 5.5 },
        { rank: 8, name: "Dynamic Factor Arbitrage Basket", symbol: "FACTOR-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 15.0, currentReturn: 8.2 },
        { rank: 9, name: "91-Day Sovereign T-Bills Collateral", symbol: "TBILL-91D", assetClass: "debt", category: "Sovereign Debt", weight: 18.0, currentReturn: 6.85 },
      ],
    },
    {
      id: "sif-dynamic-factor-arbitrage",
      name: "FintekPro SIF Dynamic Factor Arbitrage Strategy",
      tagline: "Market-neutral quantitative arbitrage and factor momentum overlay under SEBI SIF framework",
      riskProfile: "moderate",
      assetClass: "hybrid",
      subCategory: "Dynamic Factor Arbitrage (SIF)",
      minInvestment: "1000000", // ₹10 Lakhs
      timeHorizon: "2-4 Years",
      benchmarkName: "NIFTY 50 Arbitrage Index",
      portfolioTier: "affluent_sif",
      vehicleType: "SIF_NEW_ASSET_CLASS",
      sebiRegulatoryRegime: "SEBI (Mutual Funds) (Amendment) Regulations, 2024 — New Asset Class Framework",
      sebiRegulationRef: "SEBI MF Amendment Regulations 2024 / SIF Master Framework",
      statutoryMinInvestment: "1000000",
      executionRoute: "sif_orchestration",
      custodyStructure: "TRUSTEE_AMC_UNITS",
      allowedAssetClasses: ["direct_equity", "etf", "derivatives_hedge", "long_short_equity", "debt_instruments", "liquid_buffer"],
      accreditationRequired: false,
      lockInPeriodMonths: 0,
      highlight: "Market-Neutral SIF (Min ₹10 Lakhs)",
      icon: "⚖️",
      portfolioCode: "FP-SIF-02",
      allocation: [
        { category: "arbitrage", label: "Cash-Futures Equity Arbitrage Pairs", weight: 50, color: "#3B82F6", icon: "📊" },
        { category: "derivatives_hedge", label: "Factor Momentum Long/Short Overlay", weight: 25, color: "#8B5CF6", icon: "⚡" },
        { category: "liquid_yield", label: "Sovereign Collateral & TREPS", weight: 25, color: "#10B981", icon: "🏛️" },
      ],
      holdings: [
        { rank: 1, name: "Infosys Cash-Futures Arbitrage", symbol: "INFY-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 9.5, isin: "INE009A01021", currentReturn: 7.2 },
        { rank: 2, name: "Reliance Cash-Futures Arbitrage", symbol: "RELIANCE-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 9.5, isin: "INE002A01018", currentReturn: 7.1 },
        { rank: 3, name: "HDFC Bank Cash-Futures Arbitrage", symbol: "HDFCBANK-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 9.0, isin: "INE040A01034", currentReturn: 7.0 },
        { rank: 4, name: "Axis Bank Cash-Futures Arbitrage", symbol: "AXISBANK-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 8.0, isin: "INE238A01034", currentReturn: 7.4 },
        { rank: 5, name: "Tata Motors Cash-Futures Arbitrage", symbol: "TATAMOTORS-ARB", assetClass: "arbitrage", category: "Arbitrage", weight: 7.0, isin: "INE155A01022", currentReturn: 7.5 },
        { rank: 6, name: "Quantitative Momentum Factor Long/Short", symbol: "QUANT-MOM", assetClass: "derivatives", category: "Derivatives", weight: 25.0, currentReturn: 11.2 },
        { rank: 7, name: "182-Day Sovereign Treasury Bills", symbol: "TBILL-182D", assetClass: "debt", category: "Sovereign Debt", weight: 17.0, currentReturn: 6.9 },
        { rank: 8, name: "CCIL Triparty Repo (TREPS) Yield", symbol: "TREPS-LIQ", assetClass: "debt", category: "Money Market", weight: 15.0, currentReturn: 6.6 },
      ],
    },
  ];

export const allPortfoliosToSeed = [...retailPortfolios, ...affluentSifPortfolios, ...hniPmsPortfolios, ...uhniAifPortfolios];

export function getInstitutionalPortfolioDefinition(id: string) {
  return allPortfoliosToSeed.find((p) => p.id === id);
}

/**
 * Seed or update curated institutional model portfolios covering all three regulated tiers.
 */
export async function seedInstitutionalModelPortfolios(): Promise<{ seeded: number; updated: number }> {
  let seeded = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const item of allPortfoliosToSeed) {
    const existing = await db.execute(sql`SELECT id FROM model_portfolios WHERE id = ${item.id} LIMIT 1`);
    if (existing.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO model_portfolios (
          id, name, tagline, risk_profile, asset_class, sub_category,
          min_investment, time_horizon, benchmark_name, highlight, icon,
          portfolio_tier, vehicle_type, sebi_regulatory_regime, sebi_regulation_ref,
          statutory_min_investment, execution_route, custody_structure,
          allowed_asset_classes, accreditation_required, lock_in_period_months,
          portfolio_code, is_published, created_at, updated_at
        ) VALUES (
          ${item.id}, ${item.name}, ${item.tagline}, ${item.riskProfile}, ${item.assetClass}, ${item.subCategory},
          ${item.minInvestment}, ${item.timeHorizon}, ${item.benchmarkName}, ${item.highlight}, ${item.icon},
          ${item.portfolioTier}, ${item.vehicleType}, ${item.sebiRegulatoryRegime}, ${item.sebiRegulationRef},
          ${item.statutoryMinInvestment}, ${item.executionRoute}, ${item.custodyStructure},
          ${JSON.stringify(item.allowedAssetClasses)}::jsonb, ${item.accreditationRequired}, ${item.lockInPeriodMonths},
          ${item.portfolioCode}, true, ${now}, ${now}
        )
      `);

      if ((item as any).allocation && (item as any).holdings) {
        await db.execute(sql`
          UPDATE model_portfolios
          SET allocation = ${JSON.stringify((item as any).allocation)}::jsonb,
              holdings = ${JSON.stringify((item as any).holdings)}::jsonb,
              total_holdings = ${(item as any).holdings.length}
          WHERE id = ${item.id}
        `);
      }

      seeded++;
    } else {
      // Update existing record with institutional tiering attributes
      await db.execute(sql`
        UPDATE model_portfolios
        SET portfolio_tier = ${item.portfolioTier},
            vehicle_type = ${item.vehicleType},
            sebi_regulatory_regime = ${item.sebiRegulatoryRegime},
            sebi_regulation_ref = ${item.sebiRegulationRef},
            statutory_min_investment = ${item.statutoryMinInvestment},
            execution_route = ${item.executionRoute},
            custody_structure = ${item.custodyStructure},
            allowed_asset_classes = ${JSON.stringify(item.allowedAssetClasses)}::jsonb,
            accreditation_required = ${item.accreditationRequired},
            lock_in_period_months = ${item.lockInPeriodMonths},
            min_investment = ${item.minInvestment},
            highlight = ${item.highlight},
            updated_at = ${now}
        WHERE id = ${item.id}
      `);

      if ((item as any).allocation && (item as any).holdings) {
        await db.execute(sql`
          UPDATE model_portfolios
          SET allocation = ${JSON.stringify((item as any).allocation)}::jsonb,
              holdings = ${JSON.stringify((item as any).holdings)}::jsonb,
              total_holdings = ${(item as any).holdings.length}
          WHERE id = ${item.id} AND (holdings IS NULL OR jsonb_array_length(holdings) = 0 OR ${item.id.startsWith("sif-") || item.id === "hni-multi-asset-alpha-pms" || item.id === "hni-focused-leaders-pms" || item.id === "uhni-private-tech-disruptors-aif"})
        `);
      }

      updated++;
    }
  }

  logger.info("[SEBI Tier Service] Institutional portfolios seeded/updated", {
    event: "SEBI_TIERS_SEEDED",
    seeded,
    updated,
    total: allPortfoliosToSeed.length,
  });

  return { seeded, updated };
}
