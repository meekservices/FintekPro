/**
 * Multi-Vendor Infrastructure Service
 *
 * Provides a unified control plane and diagnostics engine across FintekPro's
 * three core infrastructure vendors:
 *   1. IRIS (KFintech)     — Mutual Funds, SIP/STP/SWP, NFOs, Corporate FDs, CAS & NPS
 *   2. Upstox              — Domestic Equities (NSE/BSE), F&O, Real-time Market Feeds & Golden Pricing
 *   3. Alpaca              — US Equities (NYSE/NASDAQ), Fractional Shares, S&P 500 & LRS Remittance
 *
 * FASP-AI & GCR v1.0 Compliance:
 *   - Structured telemetry: { event, status, latency_ms }
 *   - Zero trust: secrets/tokens never leaked in diagnostics output
 *   - Resilient: Promise.allSettled probes, partial success fallback
 */

import { irisKfintechService } from "./iris-kfintech-service";
import { upstoxMarketDataService } from "./upstox-market-data-service";
import { alpacaBrokerService } from "./alpaca-broker-service";
import { db } from "../db";
import { irisSessions } from "../../shared/schema";
import { desc } from "drizzle-orm";
import { logger } from "../logger";

export interface VendorDiagnostic {
  vendorId: "iris" | "upstox" | "alpaca";
  name: string;
  regime: string;
  environment: "live" | "sandbox" | "paper" | "unconfigured";
  isConfigured: boolean;
  isHealthy: boolean;
  latencyMs?: number;
  message: string;
  capabilities: string[];
  activeFeatures: string[];
  lastCheckedAt: string;
}

export interface MultiVendorInfraReport {
  overallStatus: "ALL_OPERATIONAL" | "PARTIAL_DEGRADATION" | "OFFLINE";
  summary: {
    total: number;
    configured: number;
    healthy: number;
  };
  vendors: {
    iris: VendorDiagnostic;
    upstox: VendorDiagnostic;
    alpaca: VendorDiagnostic;
  };
  supportedAssetClasses: {
    mutualFunds: string;
    indianEquities: string;
    usEquities: string;
    derivatives: string;
    fixedDeposits: string;
  };
  engineVersion: string;
  timestamp: string;
}

export class MultiVendorInfraService {
  readonly engineVersion = "2.0.0-multivendor";

  /**
   * Probe IRIS (KFintech) Infrastructure
   */
  async probeIris(): Promise<VendorDiagnostic> {
    const start = Date.now();
    const isConfigured = irisKfintechService.isConfigured;
    const now = new Date().toISOString();

    if (!isConfigured) {
      return {
        vendorId: "iris",
        name: "KFintech IRIS",
        regime: "SEBI / AMFI",
        environment: "unconfigured",
        isConfigured: false,
        isHealthy: false,
        latencyMs: 0,
        message: "IRIS credentials (IRIS_USERNAME / IRIS_PASSWORD) not configured",
        capabilities: ["MUTUAL_FUNDS", "NFO", "SIP", "SWP", "STP", "CORPORATE_FD", "NPS", "CAS_INGESTION"],
        activeFeatures: ["MOCK_FALLBACK"],
        lastCheckedAt: now,
      };
    }

    try {
      // Check if active session exists in DB
      const [session] = await db
        .select()
        .from(irisSessions)
        .orderBy(desc(irisSessions.refreshedAt))
        .limit(1);

      const hasActiveSession = session && new Date(session.expiresAt) > new Date();

      return {
        vendorId: "iris",
        name: "KFintech IRIS",
        regime: "SEBI / AMFI",
        environment: "live",
        isConfigured: true,
        isHealthy: true,
        latencyMs: Date.now() - start,
        message: hasActiveSession ? "Connected (active session token)" : "Configured (on-demand auth ready)",
        capabilities: ["MUTUAL_FUNDS", "NFO", "SIP", "SWP", "STP", "CORPORATE_FD", "NPS", "CAS_INGESTION"],
        activeFeatures: ["PORTFOLIO_SYNC", "FOLIO_LOOKUP", "ORDER_ROUTING"],
        lastCheckedAt: now,
      };
    } catch (err: any) {
      return {
        vendorId: "iris",
        name: "KFintech IRIS",
        regime: "SEBI / AMFI",
        environment: "live",
        isConfigured: true,
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: err.message || "Failed to probe IRIS session",
        capabilities: ["MUTUAL_FUNDS", "NFO", "SIP", "SWP", "STP", "CORPORATE_FD", "NPS"],
        activeFeatures: [],
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Probe Upstox Infrastructure
   */
  async probeUpstox(): Promise<VendorDiagnostic> {
    const start = Date.now();
    const isSandbox = process.env.UPSTOX_SANDBOX === "true";
    const hasToken = !!(
      process.env.UPSTOX_TRADING_ACCESS_TOKEN ||
      process.env.UPSTOX_SANDBOX_ACCESS_TOKEN ||
      process.env.UPSTOX_ACCESS_TOKEN
    );
    const now = new Date().toISOString();

    if (!hasToken) {
      return {
        vendorId: "upstox",
        name: "Upstox Securities",
        regime: "SEBI",
        environment: isSandbox ? "sandbox" : "unconfigured",
        isConfigured: false,
        isHealthy: false,
        latencyMs: 0,
        message: "UPSTOX_ACCESS_TOKEN not configured in environment",
        capabilities: ["EQUITY_NSE", "EQUITY_BSE", "FNO", "OPTIONS_CHAIN", "LIVE_FEED", "GOLDEN_PRICING"],
        activeFeatures: ["CACHED_PRICING"],
        lastCheckedAt: now,
      };
    }

    try {
      const probeResult = await upstoxMarketDataService.probeToken();
      const isHealthy = probeResult === "ok";

      return {
        vendorId: "upstox",
        name: "Upstox Securities",
        regime: "SEBI",
        environment: isSandbox ? "sandbox" : "live",
        isConfigured: true,
        isHealthy,
        latencyMs: Date.now() - start,
        message: isHealthy
          ? `Upstox ${isSandbox ? "Sandbox" : "Live"} API verified`
          : "Token probe returned unconfirmed status",
        capabilities: ["EQUITY_NSE", "EQUITY_BSE", "FNO", "OPTIONS_CHAIN", "LIVE_FEED", "GOLDEN_PRICING"],
        activeFeatures: ["REALTIME_QUOTES", "BROKER_ORDER_ROUTING", "POSTBACK_WEBHOOKS"],
        lastCheckedAt: now,
      };
    } catch (err: any) {
      return {
        vendorId: "upstox",
        name: "Upstox Securities",
        regime: "SEBI",
        environment: isSandbox ? "sandbox" : "live",
        isConfigured: true,
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: err.message || "Upstox token probe failed",
        capabilities: ["EQUITY_NSE", "EQUITY_BSE", "FNO"],
        activeFeatures: [],
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Probe Alpaca Infrastructure
   */
  async probeAlpaca(): Promise<VendorDiagnostic> {
    const start = Date.now();
    const isConfigured = alpacaBrokerService.isConfigured();
    const envMode = process.env.ALPACA_ENV === "production" ? "live" : "paper";
    const now = new Date().toISOString();

    if (!isConfigured) {
      return {
        vendorId: "alpaca",
        name: "Alpaca Broker API",
        regime: "US FINRA / SIPC",
        environment: "unconfigured",
        isConfigured: false,
        isHealthy: false,
        latencyMs: 0,
        message: "ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY not set",
        capabilities: ["EQUITY_US", "FRACTIONAL_SHARES", "NOTIONAL_ORDERS", "LRS_REMITTANCE", "SP500_BASKETS"],
        activeFeatures: ["SIMULATED_PORTFOLIO"],
        lastCheckedAt: now,
      };
    }

    try {
      // Lightweight call — fetch 1 account or clock
      await alpacaBrokerService.listAccounts({ limit: 1 });
      return {
        vendorId: "alpaca",
        name: "Alpaca Broker API",
        regime: "US FINRA / SIPC",
        environment: envMode,
        isConfigured: true,
        isHealthy: true,
        latencyMs: Date.now() - start,
        message: `Connected to Alpaca (${envMode} trading environment)`,
        capabilities: ["EQUITY_US", "FRACTIONAL_SHARES", "NOTIONAL_ORDERS", "LRS_REMITTANCE", "SP500_BASKETS"],
        activeFeatures: ["US_EQUITY_ROUTING", "SUB_ACCOUNT_PROVISIONING", "EVENT_WEBHOOKS"],
        lastCheckedAt: now,
      };
    } catch (err: any) {
      return {
        vendorId: "alpaca",
        name: "Alpaca Broker API",
        regime: "US FINRA / SIPC",
        environment: envMode,
        isConfigured: true,
        isHealthy: false,
        latencyMs: Date.now() - start,
        message: err.message || "Failed to reach Alpaca Broker API",
        capabilities: ["EQUITY_US", "FRACTIONAL_SHARES"],
        activeFeatures: [],
        lastCheckedAt: now,
      };
    }
  }

  /**
   * Run full multi-vendor diagnostic audit
   */
  async getDiagnostics(): Promise<MultiVendorInfraReport> {
    const t0 = Date.now();
    const [irisRes, upstoxRes, alpacaRes] = await Promise.allSettled([
      this.probeIris(),
      this.probeUpstox(),
      this.probeAlpaca(),
    ]);

    const iris: VendorDiagnostic =
      irisRes.status === "fulfilled"
        ? irisRes.value
        : {
            vendorId: "iris",
            name: "KFintech IRIS",
            regime: "SEBI / AMFI",
            environment: "unconfigured",
            isConfigured: false,
            isHealthy: false,
            message: "Probe failed unexpectedly",
            capabilities: [],
            activeFeatures: [],
            lastCheckedAt: new Date().toISOString(),
          };

    const upstox: VendorDiagnostic =
      upstoxRes.status === "fulfilled"
        ? upstoxRes.value
        : {
            vendorId: "upstox",
            name: "Upstox Securities",
            regime: "SEBI",
            environment: "unconfigured",
            isConfigured: false,
            isHealthy: false,
            message: "Probe failed unexpectedly",
            capabilities: [],
            activeFeatures: [],
            lastCheckedAt: new Date().toISOString(),
          };

    const alpaca: VendorDiagnostic =
      alpacaRes.status === "fulfilled"
        ? alpacaRes.value
        : {
            vendorId: "alpaca",
            name: "Alpaca Broker API",
            regime: "US FINRA / SIPC",
            environment: "unconfigured",
            isConfigured: false,
            isHealthy: false,
            message: "Probe failed unexpectedly",
            capabilities: [],
            activeFeatures: [],
            lastCheckedAt: new Date().toISOString(),
          };

    const allVendors = [iris, upstox, alpaca];
    const configuredCount = allVendors.filter((v) => v.isConfigured).length;
    const healthyCount = allVendors.filter((v) => v.isHealthy).length;

    let overallStatus: MultiVendorInfraReport["overallStatus"] = "OFFLINE";
    if (healthyCount === allVendors.length) {
      overallStatus = "ALL_OPERATIONAL";
    } else if (healthyCount > 0 || configuredCount > 0) {
      overallStatus = "PARTIAL_DEGRADATION";
    }

    logger.info("MULTI_VENDOR_INFRA_DIAGNOSTICS", {
      event: "MULTI_VENDOR_INFRA_DIAGNOSTICS",
      configured_count: configuredCount,
      healthy_count: healthyCount,
      overall_status: overallStatus,
      latency_ms: Date.now() - t0,
    });

    return {
      overallStatus,
      summary: {
        total: allVendors.length,
        configured: configuredCount,
        healthy: healthyCount,
      },
      vendors: {
        iris,
        upstox,
        alpaca,
      },
      supportedAssetClasses: {
        mutualFunds: "IRIS (KFintech)",
        indianEquities: "Upstox (NSE / BSE)",
        usEquities: "Alpaca Markets (NYSE / NASDAQ)",
        derivatives: "Upstox (NSE F&O)",
        fixedDeposits: "IRIS (Corporate FDs)",
      },
      engineVersion: this.engineVersion,
      timestamp: new Date().toISOString(),
    };
  }
}

export const multiVendorInfraService = new MultiVendorInfraService();
