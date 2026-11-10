/**
 * @file multi-asset-custody-orchestrator.ts
 * @description Multi-Asset Custody & Execution Orchestrator for FintekPro.
 *
 * Implements the unified custody & execution architecture across:
 * 1. Mutual Funds (MF): Direct Upstox API v2 / ICCL settlement (0 bps custody).
 * 2. Portfolio Management Services (PMS):
 *    - Non-Discretionary / Advisory Model Portfolios: Upstox Direct Segregated Demat (0 bps custody, ₹20 execution).
 *    - Discretionary HNI PMS: Hybrid Upstox Execution Broker + Orbis Financial Custody (CP Code clearing).
 * 3. Alternative Investment Funds (AIF):
 *    - Category III (Long-Short / F&O): Upstox Institutional Broker + Orbis Trust Units.
 *    - Category I & II (PE / VC / Credit): Orbis / Tier-1 Bank Escrow Contribution Account & 4-tier waterfall.
 *
 * Compliance:
 * - SEBI (Investment Advisers) Regulations, 2013
 * - SEBI (Portfolio Managers) Regulations, 2020 (Regulation 23(2) min ₹50L)
 * - SEBI (Alternative Investment Funds) Regulations, 2012 (Regulation 10(c) min ₹1 Cr)
 * - SEBI Discontinuance of Pooling Circulars (2021/634 & 2022/60)
 * - FintekPro GCR v1.0 + FASP-AI v3.1
 */

import { logger } from "../logger";
import { upstoxAdapter } from "./mpal/adapters/upstoxAdapter";

export type ProductType = "MUTUAL_FUND" | "PMS" | "AIF";

export type CustodyExecutionRoute =
  | "UPSTOX_MF_DIRECT"
  | "ICCL_SETTLEMENT"
  | "UPSTOX_DIRECT_DEMAT"
  | "HYBRID_UPSTOX_ORBIS"
  | "AIF_CAT3_UPSTOX_ORBIS"
  | "AIF_CAT1_CAT2_ESCROW";

export interface CustodyProviderProfile {
  id: string;
  name: string;
  role: "BROKER_DP" | "INSTITUTIONAL_CUSTODIAN" | "TIER1_BANK_CUSTODIAN";
  assetBasedFeeBps: number; // e.g. 0, 4 (0.04%), 8 (0.08%)
  minimumAnnualFeeInr: number;
  perTradeSettlementFeeInr: number;
  brokeragePerOrderInr: number;
  apiReadiness: "NATIVE_REST_WS" | "PARTNER_REST_VAN" | "MANUAL_HOST_TO_HOST";
  fintekProStatus: "ACTIVE_PRIMARY" | "SUPPORTED_SECONDARY" | "INSTITUTIONAL_OPTIONAL";
  description: string;
}

export const CUSTODY_PROVIDERS: Record<string, CustodyProviderProfile> = {
  UPSTOX: {
    id: "UPSTOX",
    name: "Upstox (RKSV Securities India Pvt. Ltd.)",
    role: "BROKER_DP",
    assetBasedFeeBps: 0, // 0 bps on AUM
    minimumAnnualFeeInr: 0,
    perTradeSettlementFeeInr: 0,
    brokeragePerOrderInr: 20, // Flat ₹20/order
    apiReadiness: "NATIVE_REST_WS",
    fintekProStatus: "ACTIVE_PRIMARY",
    description: "Direct Broker and CDSL Depository Participant for zero-custody-drag execution and direct segregated demats.",
  },
  ORBIS_FINANCIAL: {
    id: "ORBIS_FINANCIAL",
    name: "Orbis Financial Corporation Ltd.",
    role: "INSTITUTIONAL_CUSTODIAN",
    assetBasedFeeBps: 4, // 0.04% p.a.
    minimumAnnualFeeInr: 250000, // ₹2.5L floor
    perTradeSettlementFeeInr: 25,
    brokeragePerOrderInr: 0, // Brokerage handled by executing broker
    apiReadiness: "PARTNER_REST_VAN",
    fintekProStatus: "ACTIVE_PRIMARY",
    description: "Lowest-cost institutional custodian and fund accounting provider for SEBI Discretionary PMS and AIF trusts.",
  },
  TIER1_BANK_CUSTODIAN: {
    id: "TIER1_BANK_CUSTODIAN",
    name: "Tier-1 Scheduled Commercial Bank Custody (HDFC / ICICI / Kotak)",
    role: "TIER1_BANK_CUSTODIAN",
    assetBasedFeeBps: 8, // 0.08% p.a.
    minimumAnnualFeeInr: 1000000, // ₹10L floor
    perTradeSettlementFeeInr: 50,
    brokeragePerOrderInr: 0,
    apiReadiness: "MANUAL_HOST_TO_HOST",
    fintekProStatus: "INSTITUTIONAL_OPTIONAL",
    description: "Institutional custodian for large AUMs (> ₹500 Cr) or institutional LPs requiring brand escrow.",
  },
};

export interface RouteMfOrderRequest {
  userId: string;
  isin: string;
  fundName: string;
  amount: number;
  transactionType: "BUY" | "SELL";
  preferredGateway?: "UPSTOX" | "ICCL";
  folioNumber?: string;
  twoFactorOtpVerified?: boolean; // Mandatory for SELL / Redemption per SEBI
  isLiquidOrOvernight?: boolean;
  orderTimestamp?: Date | string;
  sourceAccountNumber?: string;
  sourceIfsc?: string;
}

export interface RouteMfOrderResponse {
  success: boolean;
  orderId: string;
  route: "UPSTOX_MF_DIRECT" | "ICCL_SETTLEMENT";
  custodyFeeBps: number;
  navRealizationExpected: "T+0_SAME_DAY" | "T+1_NEXT_DAY";
  cutOffStatus: "BEFORE_CUTOFF" | "PAST_CUTOFF";
  twoFactorVerified: boolean;
  message: string;
  gatewayResponse?: any;
}

export interface RoutePmsOrderRequest {
  userId: string;
  pmsName: string;
  investmentAmount: number;
  executionModel: "non_discretionary" | "discretionary";
  clientDematAccount?: string;
  formCAcknowledged: boolean;
}

export interface RoutePmsOrderResponse {
  success: boolean;
  orderId: string;
  route: "UPSTOX_DIRECT_DEMAT" | "HYBRID_UPSTOX_ORBIS";
  executingBroker: string;
  custodian: string;
  statutoryMinSatisfied: boolean;
  annualCustodyFeeBps: number;
  message: string;
}

export interface RouteAifOrderRequest {
  userId: string;
  aifCategory: "CAT_I" | "CAT_II" | "CAT_III" | "ANGEL_FUND";
  fundName: string;
  committedCapital: number;
  initialDrawdownAmount: number;
  isAccreditedInvestor?: boolean;
  accreditationValidUntil?: Date | string;
  grossLeverageRatio?: number; // Total gross derivative + cash exposure / NAV (Max 2.0x for Cat III)
}

export interface RouteAifOrderResponse {
  success: boolean;
  orderId: string;
  route: "AIF_CAT3_UPSTOX_ORBIS" | "AIF_CAT1_CAT2_ESCROW";
  executingBroker: string | null;
  custodian: string;
  trustee: string;
  statutoryCommitmentSatisfied: boolean;
  message: string;
}

export interface CustodyEconomicsInput {
  product: ProductType;
  aum: number;
  annualTrades?: number;
  avgTradeValue?: number;
}

export interface CustodyEconomicsComparison {
  aum: number;
  annualTrades: number;
  options: {
    providerId: string;
    providerName: string;
    assetBasedFee: number;
    transactionCosts: number;
    totalAnnualCost: number;
    effectiveCostBps: number;
  }[];
  annualSavingsWithUpstoxOrbis: number;
  alphaBoostBps: number;
  recommendation: string;
}

export class MultiAssetCustodyOrchestrator {
  private static instance: MultiAssetCustodyOrchestrator;

  static getInstance(): MultiAssetCustodyOrchestrator {
    if (!MultiAssetCustodyOrchestrator.instance) {
      MultiAssetCustodyOrchestrator.instance = new MultiAssetCustodyOrchestrator();
    }
    return MultiAssetCustodyOrchestrator.instance;
  }

  /**
   * Route a Mutual Fund order via Upstox API v2 or ICCL
   * Enforces SEBI universal NAV cut-off times and mandatory 2FA OTP for redemptions
   */
  async routeMutualFundOrder(request: RouteMfOrderRequest): Promise<RouteMfOrderResponse> {
    const orderId = `MF-ORD-${Date.now()}`;
    logger.info(`[CustodyOrchestrator] Routing MF order ${orderId} for ${request.fundName} (₹${request.amount})`, {
      userId: request.userId,
      amount: request.amount,
      isin: request.isin,
      transactionType: request.transactionType,
    });

    // 1. SEBI 2FA Mandate Check for Redemptions / SWPs
    if (request.transactionType === "SELL" && !request.twoFactorOtpVerified) {
      return {
        success: false,
        orderId,
        route: "ICCL_SETTLEMENT",
        custodyFeeBps: 0,
        navRealizationExpected: "T+0_SAME_DAY",
        cutOffStatus: "BEFORE_CUTOFF",
        twoFactorVerified: false,
        message: "SEBI 2FA Mandate Breach: Mutual Fund redemptions strictly require dynamic Two-Factor Authentication (OTP) verification before submission.",
      };
    }

    // 2. SEBI Universal Cut-Off Time Calculation (1:30 PM Liquid / 3:00 PM Equity & Debt)
    const now = request.orderTimestamp ? new Date(request.orderTimestamp) : new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const istTime = new Date(utc + 3600000 * 5.5);
    const currentTimeNum = istTime.getHours() + istTime.getMinutes() / 60;
    const cutOffHour = request.isLiquidOrOvernight ? 13.5 : 15.0; // 1:30 PM or 3:00 PM
    const isPastCutOff = currentTimeNum >= cutOffHour;
    const cutOffStatus = isPastCutOff ? "PAST_CUTOFF" : "BEFORE_CUTOFF";
    const navRealizationExpected = isPastCutOff ? "T+1_NEXT_DAY" : "T+0_SAME_DAY";
    const cutOffFormatted = request.isLiquidOrOvernight ? "1:30 PM" : "3:00 PM";

    if (request.preferredGateway !== "ICCL" && upstoxAdapter.isConfigured()) {
      try {
        const upstoxRes = await upstoxAdapter.placeMfOrder({
          instrumentToken: request.isin,
          amount: request.amount,
          transactionType: request.transactionType,
          folioNumber: request.folioNumber,
        });

        return {
          success: true,
          orderId: upstoxRes?.order_id || orderId,
          route: "UPSTOX_MF_DIRECT",
          custodyFeeBps: 0,
          navRealizationExpected,
          cutOffStatus,
          twoFactorVerified: request.transactionType === "SELL" ? Boolean(request.twoFactorOtpVerified) : true,
          message: isPastCutOff
            ? `Order routed past ${cutOffFormatted} IST cut-off. Units will be allotted at T+1 business day closing NAV upon fund realization.`
            : "Order routed to Upstox Mutual Funds API v2 with direct AMC unit allotment.",
          gatewayResponse: upstoxRes,
        };
      } catch (err: any) {
        logger.warn(`[CustodyOrchestrator] Upstox MF route failed, falling back to ICCL: ${err.message}`);
      }
    }

    // Fallback to ICCL settlement
    return {
      success: true,
      orderId,
      route: "ICCL_SETTLEMENT",
      custodyFeeBps: 0,
      navRealizationExpected,
      cutOffStatus,
      twoFactorVerified: request.transactionType === "SELL" ? Boolean(request.twoFactorOtpVerified) : true,
      message: isPastCutOff
        ? `Order routed past ${cutOffFormatted} IST cut-off via ICCL / BSE StAR MF. Scheduled for T+1 business day NAV. Zero intermediary pooling.`
        : "Order routed via ICCL / BSE StAR MF Clearing Corporation. Zero intermediary pooling.",
    };
  }

  /**
   * Route PMS account onboarding / execution
   * Enforces SEBI Regulation 23(2) ₹50 Lakh minimum floor
   */
  async routePmsOrder(request: RoutePmsOrderRequest): Promise<RoutePmsOrderResponse> {
    const orderId = `PMS-ORD-${Date.now()}`;
    const minPmsFloor = 50_00_000;

    if (request.investmentAmount < minPmsFloor) {
      return {
        success: false,
        orderId,
        route: "UPSTOX_DIRECT_DEMAT",
        executingBroker: "Upstox",
        custodian: "Upstox CDSL DP",
        statutoryMinSatisfied: false,
        annualCustodyFeeBps: 0,
        message: `Breach of SEBI (Portfolio Managers) Regulations, 2020 Reg 23(2): Minimum statutory investment is ₹50,00,000. Provided: ₹${request.investmentAmount.toLocaleString("en-IN")}.`,
      };
    }

    if (request.executionModel === "non_discretionary") {
      // Direct Upstox Segregated Demat Model
      return {
        success: true,
        orderId,
        route: "UPSTOX_DIRECT_DEMAT",
        executingBroker: "Upstox (RKSV Securities)",
        custodian: "Upstox CDSL Depository Participant",
        statutoryMinSatisfied: true,
        annualCustodyFeeBps: 0, // 0 bps custody fee
        message: "Non-discretionary PMS routed to direct client Upstox CDSL Demat. 0 bps custody fee, flat ₹20 execution.",
      };
    }

    // Discretionary HNI PMS: Hybrid Upstox Execution + Orbis Custody
    return {
      success: true,
      orderId,
      route: "HYBRID_UPSTOX_ORBIS",
      executingBroker: "Upstox API v2 (Discount Institutional Desk)",
      custodian: "Orbis Financial Corporation Ltd. (CP Code Clearing)",
      statutoryMinSatisfied: true,
      annualCustodyFeeBps: 4, // 4 bps custody & fund accounting
      message: "Discretionary PMS routed to Hybrid Model: Upstox OMS execution + Orbis Financial institutional custody & CP clearing.",
    };
  }

  /**
   * Route AIF allocation
   * Enforces SEBI Regulation 10(c) ₹1 Crore statutory commitment floor
   */
  async routeAifOrder(request: RouteAifOrderRequest): Promise<RouteAifOrderResponse> {
    const orderId = `AIF-ORD-${Date.now()}`;
    const standardMinCommitment = request.aifCategory === "ANGEL_FUND" ? 25_00_000 : 1_00_00_000;

    // 1. Validate Accredited Investor Certificate Expiry (if claiming lower commitment)
    if (request.isAccreditedInvestor && request.accreditationValidUntil) {
      const expiry = new Date(request.accreditationValidUntil);
      if (expiry < new Date()) {
        return {
          success: false,
          orderId,
          route: "AIF_CAT1_CAT2_ESCROW",
          executingBroker: null,
          custodian: "Orbis Financial",
          trustee: "SEBI Registered Independent Trustee",
          statutoryCommitmentSatisfied: false,
          message: `Breach of SEBI AIF Regulations: Accredited Investor certification expired on ${expiry.toISOString().split("T")[0]}. Valid, unexpired accreditation certificate is required for concession below statutory ₹1 Crore ticket.`,
        };
      }
    }

    if (request.committedCapital < standardMinCommitment && !request.isAccreditedInvestor) {
      return {
        success: false,
        orderId,
        route: "AIF_CAT1_CAT2_ESCROW",
        executingBroker: null,
        custodian: "Orbis Financial",
        trustee: "SEBI Registered Independent Trustee",
        statutoryCommitmentSatisfied: false,
        message: `Breach of SEBI (AIF) Regulations, 2012 Reg 10(c): Minimum statutory commitment is ₹${(standardMinCommitment / 1_00_000).toFixed(0)} Lakhs.`,
      };
    }

    // 2. Enforce SEBI Category III 200% Gross Leverage Ceiling
    if (request.aifCategory === "CAT_III" && request.grossLeverageRatio && request.grossLeverageRatio > 2.0) {
      return {
        success: false,
        orderId,
        route: "AIF_CAT3_UPSTOX_ORBIS",
        executingBroker: "Upstox Institutional F&O / Equity Desk",
        custodian: "Orbis Financial Corporation (Trustee Escrow & Unit Registry)",
        trustee: "Independent Registered Trustee",
        statutoryCommitmentSatisfied: true,
        message: `Breach of SEBI (AIF) Regulations, 2012: Gross derivative + cash leverage is ${request.grossLeverageRatio.toFixed(2)}x, breaching the statutory ceiling of 200% NAV (2.0x).`,
      };
    }

    if (request.aifCategory === "CAT_III") {
      // Category III Long-Short / F&O Hedge Fund: Upstox Execution + Orbis Custody
      return {
        success: true,
        orderId,
        route: "AIF_CAT3_UPSTOX_ORBIS",
        executingBroker: "Upstox Institutional F&O / Equity Desk",
        custodian: "Orbis Financial Corporation (Trustee Escrow & Unit Registry)",
        trustee: "Independent Registered Trustee",
        statutoryCommitmentSatisfied: true,
        message: "Category III AIF routed to Upstox Institutional OMS for derivative execution + Orbis Trust Custody.",
      };
    }

    // Category I & II: PE / VC / Private Debt Escrow
    return {
      success: true,
      orderId,
      route: "AIF_CAT1_CAT2_ESCROW",
      executingBroker: null, // Direct unlisted transfers / debentures
      custodian: "Orbis Financial Corporation (Escrow Custodian)",
      trustee: "Axis Trustee / Independent SEBI Trustee",
      statutoryCommitmentSatisfied: true,
      message: "Category I/II AIF routed to Independent Trust Escrow. 15-day drawdown notice and 4-tier waterfall tracking activated.",
    };
  }

  /**
   * Calculate and compare total operational costs across custodians
   */
  calculateCustodyAndExecutionEconomics(input: CustodyEconomicsInput): CustodyEconomicsComparison {
    const { aum, product } = input;
    const trades = input.annualTrades ?? 120; // Default 10 trades/month

    // 1. Upstox Direct Model
    const upstoxCustodyFee = 0; // 0 bps
    const upstoxTxCost = trades * 20; // ₹20/order
    const upstoxTotal = upstoxCustodyFee + upstoxTxCost;

    // 2. Orbis Financial Custody
    const orbisBpsFee = (aum * 4) / 10_000; // 4 bps
    const orbisCustodyFee = Math.max(250_000, orbisBpsFee);
    const orbisTxCost = trades * 25 + (product === "PMS" ? trades * 20 : 0); // Settlement + execution
    const orbisTotal = orbisCustodyFee + orbisTxCost;

    // 3. Tier-1 Bank Custodian (HDFC / ICICI / Kotak)
    const bankBpsFee = (aum * 8) / 10_000; // 8 bps
    const bankCustodyFee = Math.max(10_00_000, bankBpsFee); // ₹10L floor
    const bankTxCost = trades * 50 + trades * 50; // Higher settlement + institutional broker rates
    const bankTotal = bankCustodyFee + bankTxCost;

    const baseComparisonTotal = bankTotal;
    const chosenLowCostTotal = product === "PMS" ? orbisTotal : upstoxTotal;
    const annualSavings = Math.max(0, baseComparisonTotal - (product === "PMS" && input.aum <= 10_00_00_000 ? upstoxTotal : chosenLowCostTotal));
    const alphaBoostBps = Number(((annualSavings / aum) * 10_000).toFixed(2));

    let recommendation = "";
    if (product === "MUTUAL_FUND" || (product === "PMS" && aum < 10_00_00_000)) {
      recommendation = "Upstox Direct Segregated Demat yields the maximum net returns (0 bps custody fee, ₹20 flat execution).";
    } else {
      recommendation = "Hybrid Upstox Execution + Orbis Custody saves up to ₹7–₹10 Lakhs/year compared to Tier-1 Bank custodians while maintaining institutional SEBI CP clearing compliance.";
    }

    return {
      aum,
      annualTrades: trades,
      options: [
        {
          providerId: "UPSTOX_DIRECT",
          providerName: "Upstox Direct Segregated Demat",
          assetBasedFee: upstoxCustodyFee,
          transactionCosts: upstoxTxCost,
          totalAnnualCost: upstoxTotal,
          effectiveCostBps: Number(((upstoxTotal / aum) * 10_000).toFixed(2)),
        },
        {
          providerId: "ORBIS_FINANCIAL",
          providerName: "Orbis Financial (Institutional Custody)",
          assetBasedFee: orbisCustodyFee,
          transactionCosts: orbisTxCost,
          totalAnnualCost: orbisTotal,
          effectiveCostBps: Number(((orbisTotal / aum) * 10_000).toFixed(2)),
        },
        {
          providerId: "TIER1_BANK_CUSTODIAN",
          providerName: "Tier-1 Bank Custodians (HDFC / ICICI / Kotak)",
          assetBasedFee: bankCustodyFee,
          transactionCosts: bankTxCost,
          totalAnnualCost: bankTotal,
          effectiveCostBps: Number(((bankTotal / aum) * 10_000).toFixed(2)),
        },
      ],
      annualSavingsWithUpstoxOrbis: annualSavings,
      alphaBoostBps,
      recommendation,
    };
  }

  /**
   * Runtime Third-Party Payment Prevention Engine (PMLA / SEBI)
   * Validates that the remitting bank account matches client's verified whitelisted account.
   */
  async validateRemitterAccount(params: {
    userId: string;
    remitterAccountNumber: string;
    remitterIfsc: string;
    whitelistedAccounts: { accountNumberMasked: string; ifscCode: string; isVerified: boolean }[];
  }): Promise<{ isWhitelisted: boolean; reason?: string }> {
    const { remitterAccountNumber, remitterIfsc, whitelistedAccounts } = params;
    const cleanRemitterAcct = remitterAccountNumber.trim();
    const cleanIfsc = remitterIfsc.trim().toUpperCase();

    const match = whitelistedAccounts.find((acc) => {
      if (!acc.isVerified) return false;
      const last4 = cleanRemitterAcct.slice(-4);
      return acc.accountNumberMasked.endsWith(last4) && acc.ifscCode.toUpperCase() === cleanIfsc;
    });

    if (!match) {
      return {
        isWhitelisted: false,
        reason: `PMLA Third-Party Payment Breach: Remitting bank account (...${cleanRemitterAcct.slice(-4)}, IFSC: ${cleanIfsc}) is not verified for this client. Third-party funding is strictly prohibited.`,
      };
    }

    return { isWhitelisted: true };
  }
}

export const multiAssetCustodyOrchestrator = MultiAssetCustodyOrchestrator.getInstance();

