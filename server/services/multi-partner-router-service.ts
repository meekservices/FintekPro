/**
 * Multi-Partner Dynamic Routing Service — FintekPro Financial Services LLP
 *
 * Implements Multi-Partner per Product Architecture with:
 * - Accredited partner registry for all products (Equities, MF, Corp FDs, LAMF, Bonds, US Equities, SDI, AA)
 * - Priority-ordered routing (Primary -> Secondary -> Fallback)
 * - Health-aware circuit breaker failover: automatically routes to healthy partner if primary is tripped
 * - Commercials & commission splits per partner
 * - Self-healing in-memory fallback for high availability
 *
 * @engineVersion FINTEK-MULTI-PARTNER-ROUTER-v1.0
 */

import { logger } from "../logger";
import { partnerCircuitBreaker, type PartnerProvider } from "./partner-circuit-breaker";
import {
  type ProductType,
  type PartnerProviderStatus,
  PRODUCT_TYPES,
  PARTNER_PROVIDER_STATUSES,
} from "@shared/schema";

export interface ProductPartnerConfig {
  id: string;
  productType: ProductType;
  providerKey: PartnerProvider;
  providerDisplayName: string;
  status: PartnerProviderStatus;
  priorityOrder: number; // 1 = Primary, 2 = Secondary, 3 = Fallback
  distributorCommissionBps: number; // e.g. 175 = 1.75%
  partnerRevenueSharePercent: number; // e.g. 80.00%
  apiEndpointRef: string;
  isSandboxMock: boolean;
  metadata: Record<string, unknown>;
}

export interface RouteResolutionResult {
  productType: ProductType;
  selectedProviderKey: PartnerProvider;
  selectedProviderDisplayName: string;
  priorityOrder: number;
  circuitState: string;
  isFailover: boolean;
  failoverReason?: string;
  configuredPartnersCount: number;
  alternativePartners: Array<{
    providerKey: PartnerProvider;
    providerDisplayName: string;
    status: PartnerProviderStatus;
    priorityOrder: number;
    circuitState: string;
  }>;
  commissionBps: number;
  partnerRevenueSharePercent: number;
  meta: {
    engineVersion: string;
    resolvedAt: string;
  };
}

export class MultiPartnerRouterService {
  private static instance: MultiPartnerRouterService;
  static readonly ENGINE_VERSION = "FINTEK-MULTI-PARTNER-ROUTER-v1.0";

  // In-Memory Partner Catalog indexed by productType
  private partnerStore: Map<ProductType, ProductPartnerConfig[]> = new Map();

  constructor() {
    this.seedDefaultPartners();
  }

  static getInstance(): MultiPartnerRouterService {
    if (!MultiPartnerRouterService.instance) {
      MultiPartnerRouterService.instance = new MultiPartnerRouterService();
    }
    return MultiPartnerRouterService.instance;
  }

  /**
   * Seeds default multi-partner registry across all product verticals
   */
  private seedDefaultPartners(): void {
    const defaultMappings: ProductPartnerConfig[] = [
      // 1. EQUITY_BROKERAGE (Direct Equities, F&O)
      {
        id: "PP_EQ_UPSTOX",
        productType: "EQUITY_BROKERAGE",
        providerKey: "UPSTOX",
        providerDisplayName: "Upstox (RKSV Securities)",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 150,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.upstox.com/v2",
        isSandboxMock: true,
        metadata: { exchangeSegment: ["NSE_EQ", "BSE_EQ", "NSE_FO"], apModel: "CORPORATE_AP" },
      },
      {
        id: "PP_EQ_ANGEL_ONE",
        productType: "EQUITY_BROKERAGE",
        providerKey: "ANGEL_ONE",
        providerDisplayName: "Angel One SmartAPI",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 150,
        partnerRevenueSharePercent: 75.0,
        apiEndpointRef: "https://apiconnect.angelone.in",
        isSandboxMock: true,
        metadata: { exchangeSegment: ["NSE_EQ", "BSE_EQ"], apModel: "SUB_BROKER" },
      },
      {
        id: "PP_EQ_DHAN",
        productType: "EQUITY_BROKERAGE",
        providerKey: "DHAN",
        providerDisplayName: "DhanHQ Broker Partner",
        status: "STANDBY_FALLBACK",
        priorityOrder: 3,
        distributorCommissionBps: 125,
        partnerRevenueSharePercent: 70.0,
        apiEndpointRef: "https://api.dhan.co/v2",
        isSandboxMock: true,
        metadata: { exchangeSegment: ["NSE_EQ"], apModel: "API_INTEGRATION" },
      },

      // 2. MUTUAL_FUNDS_DISTRIBUTION (Regular MFs, SIPs)
      {
        id: "PP_MF_KFINTECH",
        productType: "MUTUAL_FUNDS_DISTRIBUTION",
        providerKey: "KFINTECH_IRIS",
        providerDisplayName: "KFintech IRIS Gateway",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 100,
        partnerRevenueSharePercent: 85.0,
        apiEndpointRef: "https://iris.kfintech.com/api",
        isSandboxMock: true,
        metadata: { feedTypes: ["WBR2", "WBR9", "WBR6"], rtaType: "RTA_DIRECT" },
      },
      {
        id: "PP_MF_CAMS",
        productType: "MUTUAL_FUNDS_DISTRIBUTION",
        providerKey: "CAMS",
        providerDisplayName: "CAMS Finnet Gateway",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 100,
        partnerRevenueSharePercent: 85.0,
        apiEndpointRef: "https://finnet.camsonline.com/api",
        isSandboxMock: true,
        metadata: { feedTypes: ["WBR2", "WBR9"], rtaType: "RTA_DIRECT" },
      },
      {
        id: "PP_MF_BSE_STAR",
        productType: "MUTUAL_FUNDS_DISTRIBUTION",
        providerKey: "BSE_STAR_MF",
        providerDisplayName: "BSE StAR MF Platform",
        status: "STANDBY_FALLBACK",
        priorityOrder: 3,
        distributorCommissionBps: 100,
        partnerRevenueSharePercent: 90.0,
        apiEndpointRef: "https://bsestarmf.in/api",
        isSandboxMock: true,
        metadata: { exchangeTrading: true, mandateSupport: ["eNACH", "UPI_AUTOPAY"] },
      },

      // 3. CORPORATE_FIXED_DEPOSITS (High-Yield FDs)
      {
        id: "PP_FD_BAJAJ",
        productType: "CORPORATE_FIXED_DEPOSITS",
        providerKey: "BAJAJ_FINANCE",
        providerDisplayName: "Bajaj Finance Digital FD",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 175,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.bajajfinserv.in/fixed-deposit",
        isSandboxMock: true,
        metadata: { creditRating: "CRISIL AAA", maxTenureMonths: 60, srCitizenBonus: 0.25 },
      },
      {
        id: "PP_FD_SHRIRAM",
        productType: "CORPORATE_FIXED_DEPOSITS",
        providerKey: "SHRIRAM_FINANCE",
        providerDisplayName: "Shriram Finance High-Yield FD",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 220,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.shriramfinance.in/fd-digital",
        isSandboxMock: true,
        metadata: { creditRating: "CRISIL AA+", maxTenureMonths: 60, srCitizenBonus: 0.50 },
      },
      {
        id: "PP_FD_MAHINDRA",
        productType: "CORPORATE_FIXED_DEPOSITS",
        providerKey: "MAHINDRA_FINANCE",
        providerDisplayName: "Mahindra Finance FD",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 3,
        distributorCommissionBps: 160,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.mahindrafinance.com/fd",
        isSandboxMock: true,
        metadata: { creditRating: "CRISIL AAA", maxTenureMonths: 60, srCitizenBonus: 0.35 },
      },
      {
        id: "PP_FD_UTKARSH",
        productType: "CORPORATE_FIXED_DEPOSITS",
        providerKey: "UTKARSH_SFB",
        providerDisplayName: "Utkarsh Small Finance Bank FD",
        status: "STANDBY_FALLBACK",
        priorityOrder: 4,
        distributorCommissionBps: 125,
        partnerRevenueSharePercent: 75.0,
        apiEndpointRef: "https://api.utkarsh.bank/fd",
        isSandboxMock: true,
        metadata: { dicgcProtected: true, maxTenureMonths: 60, srCitizenBonus: 0.60 },
      },

      // 4. LOAN_AGAINST_SECURITIES_LAMF (Digital Overdraft)
      {
        id: "PP_LAMF_VOLT",
        productType: "LOAN_AGAINST_SECURITIES_LAMF",
        providerKey: "VOLT_MONEY",
        providerDisplayName: "Volt Money Digital LAMF",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 125,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.voltmoney.in/partner/v1",
        isSandboxMock: true,
        metadata: { rtaSupport: ["CAMS", "KFINTECH"], interestRate: 10.25, turnAroundMinutes: 15 },
      },
      {
        id: "PP_LAMF_50FIN",
        productType: "LOAN_AGAINST_SECURITIES_LAMF",
        providerKey: "FIFTY_FIN",
        providerDisplayName: "50Fin Demat LAS Gateway",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 125,
        partnerRevenueSharePercent: 75.0,
        apiEndpointRef: "https://api.50fin.in/v1",
        isSandboxMock: true,
        metadata: { depositorySupport: ["CDSL", "NSDL"], interestRate: 10.50 },
      },
      {
        id: "PP_LAMF_TATA",
        productType: "LOAN_AGAINST_SECURITIES_LAMF",
        providerKey: "TATA_CAPITAL",
        providerDisplayName: "Tata Capital Financial Services",
        status: "STANDBY_FALLBACK",
        priorityOrder: 3,
        distributorCommissionBps: 100,
        partnerRevenueSharePercent: 70.0,
        apiEndpointRef: "https://api.tatacapital.com/las",
        isSandboxMock: true,
        metadata: { institutionalNbfc: true, maxLoanAmount: 20000000 },
      },

      // 5. BONDS_NCDS_DEBT (Corporate Bonds, NCDs)
      {
        id: "PP_BOND_UPSTOX",
        productType: "BONDS_NCDS_DEBT",
        providerKey: "UPSTOX",
        providerDisplayName: "Upstox Debt Gateway",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 50,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.upstox.com/v2/debt",
        isSandboxMock: true,
        metadata: { settlement: "ICCL", segments: ["CORP_BOND", "SGB", "T_BILLS"] },
      },
      {
        id: "PP_BOND_GOLDENPI",
        productType: "BONDS_NCDS_DEBT",
        providerKey: "GOLDEN_PI",
        providerDisplayName: "GoldenPi Retail Debt API",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 75,
        partnerRevenueSharePercent: 75.0,
        apiEndpointRef: "https://api.goldenpi.com/partner",
        isSandboxMock: true,
        metadata: { curatedBonds: true, minimumTicket: 10000 },
      },

      // 6. US_GLOBAL_EQUITIES (LRS US Stocks)
      {
        id: "PP_US_ALPACA",
        productType: "US_GLOBAL_EQUITIES",
        providerKey: "ALPACA",
        providerDisplayName: "Alpaca Securities LLC (US)",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 25,
        partnerRevenueSharePercent: 85.0,
        apiEndpointRef: "https://broker-api.alpaca.markets/v1",
        isSandboxMock: true,
        metadata: { clearingBroker: "ALPACA_FINRA_SIPC", lrsFormA2: true },
      },

      // 7. SECURITIZED_DEBT_SDI (Alternative High-Yield Debt)
      {
        id: "PP_SDI_GRIP",
        productType: "SECURITIZED_DEBT_SDI",
        providerKey: "GRIP_INVEST",
        providerDisplayName: "Grip Invest SDI Syndicate",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 200,
        partnerRevenueSharePercent: 80.0,
        apiEndpointRef: "https://api.gripinvest.in/sdi",
        isSandboxMock: true,
        metadata: { poolTypes: ["VEHICLE_LEASE", "GOLD_LOAN_PTC"], yieldRange: "10.5%-12.5%" },
      },

      // 8. ACCOUNT_AGGREGATOR_AA (RBI AA Consent Feeds)
      {
        id: "PP_AA_FINVU",
        productType: "ACCOUNT_AGGREGATOR_AA",
        providerKey: "FINVU_AA",
        providerDisplayName: "Finvu Account Aggregator (Cookiejar)",
        status: "ACTIVE_PRIMARY",
        priorityOrder: 1,
        distributorCommissionBps: 0,
        partnerRevenueSharePercent: 100.0,
        apiEndpointRef: "https://api.finvu.in/aa/v2",
        isSandboxMock: true,
        metadata: { rbiLicensed: true, fipSupport: ["BANKS", "DEPOSITORIES", "INSURERS"] },
      },
      {
        id: "PP_AA_SETU",
        productType: "ACCOUNT_AGGREGATOR_AA",
        providerKey: "SETU_AA",
        providerDisplayName: "Setu AA (Pine Labs)",
        status: "ACTIVE_SECONDARY",
        priorityOrder: 2,
        distributorCommissionBps: 0,
        partnerRevenueSharePercent: 100.0,
        apiEndpointRef: "https://fiu.setu.co/v1",
        isSandboxMock: true,
        metadata: { rbiLicensed: true, consentModes: ["ONE_TIME", "PERIODIC"] },
      },
    ];

    // Clear and group by productType
    this.partnerStore.clear();
    for (const p of defaultMappings) {
      const list = this.partnerStore.get(p.productType) || [];
      list.push(p);
      this.partnerStore.set(p.productType, list);
    }
  }

  /**
   * Returns all products and their multi-partner configurations
   */
  getAllProductPartners(): Record<ProductType, ProductPartnerConfig[]> {
    const result = {} as Record<ProductType, ProductPartnerConfig[]>;
    for (const pt of PRODUCT_TYPES) {
      result[pt] = [...(this.partnerStore.get(pt) || [])].sort((a, b) => a.priorityOrder - b.priorityOrder);
    }
    return result;
  }

  /**
   * Returns partners configured for a specific product vertical
   */
  getPartnersForProduct(productType: ProductType): ProductPartnerConfig[] {
    const list = this.partnerStore.get(productType) || [];
    return [...list].sort((a, b) => a.priorityOrder - b.priorityOrder);
  }

  /**
   * Dynamically resolves the best active partner for a product.
   * Auto-fails over to secondary partner if primary circuit breaker is OPEN!
   */
  resolveActivePartner(
    productType: ProductType,
    preferredProviderKey?: PartnerProvider
  ): RouteResolutionResult {
    const partners = this.getPartnersForProduct(productType);
    if (!partners || partners.length === 0) {
      throw new Error(`No partner providers registered for product ${productType}`);
    }

    // Inspect live circuit states for all partners of this product
    const partnerHealthList = partners.map((p) => {
      const circuitStatus = partnerCircuitBreaker.getCircuitStatus(p.providerKey);
      return {
        ...p,
        circuitState: circuitStatus.state,
      };
    });

    let selected: (typeof partnerHealthList)[0] | null = null;
    let isFailover = false;
    let failoverReason: string | undefined;

    // Check if preferred partner is specified and healthy
    if (preferredProviderKey) {
      const preferred = partnerHealthList.find((p) => p.providerKey === preferredProviderKey);
      if (preferred && preferred.status !== "DISABLED" && preferred.status !== "MAINTENANCE") {
        if (preferred.circuitState === "CLOSED" || preferred.circuitState === "HALF_OPEN") {
          selected = preferred;
        } else {
          isFailover = true;
          failoverReason = `Preferred partner ${preferred.providerDisplayName} circuit is ${preferred.circuitState}. Auto-routing to secondary.`;
        }
      }
    }

    // If no preferred partner or preferred is down, iterate by priority order
    if (!selected) {
      // Find highest priority healthy partner (status ACTIVE and circuit != OPEN)
      const eligible = partnerHealthList
        .filter((p) => p.status.startsWith("ACTIVE") || p.status === "STANDBY_FALLBACK")
        .sort((a, b) => a.priorityOrder - b.priorityOrder);

      const healthy = eligible.find((p) => p.circuitState === "CLOSED" || p.circuitState === "HALF_OPEN");

      if (healthy) {
        selected = healthy;
        if (healthy.priorityOrder > 1 && !isFailover) {
          isFailover = true;
          failoverReason = `Primary partner unavailable or degraded. Routed to Priority ${healthy.priorityOrder} partner (${healthy.providerDisplayName}).`;
        }
      } else {
        // Fallback: take first available even if degraded (graceful partial result)
        selected = eligible[0] || partnerHealthList[0];
        isFailover = true;
        failoverReason = `All upstream partner circuits degraded. Routed to ${selected.providerDisplayName} with fallback cache active.`;
      }
    }

    if (isFailover) {
      logger.warn("MULTI_PARTNER_AUTO_FAILOVER", {
        event: "PARTNER_FAILOVER_TRIGGERED",
        productType,
        selectedProvider: selected.providerKey,
        priority: selected.priorityOrder,
        reason: failoverReason,
      });
    } else {
      logger.info("MULTI_PARTNER_ROUTE_RESOLVED", {
        event: "PARTNER_ROUTE_RESOLVED",
        productType,
        selectedProvider: selected.providerKey,
        priority: selected.priorityOrder,
      });
    }

    return {
      productType,
      selectedProviderKey: selected.providerKey,
      selectedProviderDisplayName: selected.providerDisplayName,
      priorityOrder: selected.priorityOrder,
      circuitState: selected.circuitState,
      isFailover,
      failoverReason,
      configuredPartnersCount: partners.length,
      alternativePartners: partnerHealthList.map((p) => ({
        providerKey: p.providerKey,
        providerDisplayName: p.providerDisplayName,
        status: p.status,
        priorityOrder: p.priorityOrder,
        circuitState: p.circuitState,
      })),
      commissionBps: selected.distributorCommissionBps,
      partnerRevenueSharePercent: selected.partnerRevenueSharePercent,
      meta: {
        engineVersion: MultiPartnerRouterService.ENGINE_VERSION,
        resolvedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Updates partner status (e.g. promote Angel One to primary, or mark Upstox in maintenance)
   */
  updatePartnerStatus(
    productType: ProductType,
    providerKey: PartnerProvider,
    newStatus: PartnerProviderStatus,
    newPriorityOrder?: number
  ): ProductPartnerConfig {
    const list = this.partnerStore.get(productType) || [];
    const target = list.find((p) => p.providerKey === providerKey);
    if (!target) {
      throw new Error(`Partner ${providerKey} not found for product ${productType}`);
    }

    target.status = newStatus;
    if (newPriorityOrder !== undefined) {
      target.priorityOrder = newPriorityOrder;
    }

    // Sort list by priority order
    list.sort((a, b) => a.priorityOrder - b.priorityOrder);
    this.partnerStore.set(productType, list);

    logger.info("PARTNER_STATUS_UPDATED", {
      event: "PARTNER_STATUS_MODIFIED",
      productType,
      providerKey,
      newStatus,
      newPriorityOrder,
    });

    return target;
  }

  /**
   * Registers a new partner for a product vertical
   */
  registerPartner(config: ProductPartnerConfig): ProductPartnerConfig {
    const list = this.partnerStore.get(config.productType) || [];
    const existingIndex = list.findIndex((p) => p.providerKey === config.providerKey);

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...config };
    } else {
      list.push(config);
    }

    list.sort((a, b) => a.priorityOrder - b.priorityOrder);
    this.partnerStore.set(config.productType, list);
    return config;
  }
}

export const multiPartnerRouterService = MultiPartnerRouterService.getInstance();
