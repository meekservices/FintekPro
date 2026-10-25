/**
 * Multi-Vendor Instrument Master Service (FASP-AI v3.0)
 *
 * Provides a unified abstraction layer over heterogeneous market & financial execution vendors:
 *   - IRIS (KFintech): Mutual funds, corporate FDs, NPS, Bonds, and folio-level LAS (TPIN/OTP)
 *   - Upstox: NSE/BSE listed equities, derivatives (F&O), live quotes, and order execution
 *   - Smallcase: Thematic baskets, model portfolios, and demat equity LAS (SDK Gateway)
 *   - Alpaca: US equities, fractional shares, dollar-denominated assets
 *   - AMFI / MFAPI: Canonical Mutual Fund NAVs and scheme categorization
 *   - BSE StAR MF: Order routing gateway for mutual fund primary market transactions
 *
 * Architecture Principles:
 *   - Single Canonical Identity (ISIN / Symbol / SchemeCode) → Multi-Vendor Routing
 *   - Deterministic Vendor Routing & Failover
 *   - Full Explainability: Input parameters, vendor resolution rules, intermediate mappings
 *   - Safe Caching with Invalidation Support
 *
 * Adheres strictly to FintekPro GCR v1.0 & FASP-AI v1.0.
 *
 * @module multi-vendor-instrument-master-service
 */

import { db } from "../db";
import { isinRegistry, financialInstrumentsCache } from "@shared/schema";
import type { ISINRegistryRecord, FinancialInstrumentsCache } from "@shared/schema";
import { eq, or, and, ilike } from "drizzle-orm";
import { logger } from "../logger";

export type VendorType = "IRIS" | "UPSTOX" | "SMALLCASE" | "ALPACA" | "AMFI" | "BSE_STAR_MF" | "DIRECT";

export interface VendorCapabilityDetail {
  supported: boolean;
  vendorIdentifier?: string;
  exchange?: string;
  tradingEnabled: boolean;
  pricingEnabled: boolean;
  collateralLendingEnabled: boolean;
  metadata?: Record<string, any>;
}

export interface MultiVendorInstrumentProfile {
  isin?: string;
  symbol: string;
  canonicalName: string;
  instrumentType: "stock" | "mutual_fund" | "etf" | "bond" | "index" | "smallcase" | "us_stock" | "fd" | "nps" | "other";
  country: string;
  currency: string;
  primaryVendor: VendorType;
  secondaryVendor?: VendorType;
  supportedVendors: VendorType[];
  vendors: {
    iris: VendorCapabilityDetail;
    upstox: VendorCapabilityDetail;
    smallcase: VendorCapabilityDetail;
    alpaca: VendorCapabilityDetail;
    amfi: VendorCapabilityDetail;
    bseStar: VendorCapabilityDetail;
  };
  pricingRouting: {
    primaryQuoteVendor: VendorType;
    feedType: "REAL_TIME_STREAM" | "DAILY_NAV" | "DELAYED_TICK" | "VALUATION_YIELD";
    fallbackVendor?: VendorType;
  };
  executionRouting: {
    primaryExecutionVendor: VendorType;
    supportsFractional: boolean;
    supportsSip: boolean;
    orderType: "EXCHANGE_DMA" | "RTA_ORDER" | "BASKET_ORDER" | "BROKER_API";
    requiresAdvisorApproval: boolean;
  };
  collateralLending: {
    isEligible: boolean;
    recommendedVendor: "IRIS" | "SMALLCASE" | "BOTH" | "NONE";
    maxLtvPercent: number; // e.g. 50% for equity, 80% for debt
    lienMechanism: "TPIN_OTP" | "GATEWAY_SDK" | "NONE";
  };
  regulatoryDisclosures: {
    advisoryOnly: boolean;
    riskDisclaimer: string;
  };
  engine_version: string;
  calculation_timestamp: string;
}

// In-memory LRU Cache (60 min TTL)
interface CacheEntry {
  profile: MultiVendorInstrumentProfile | null;
  expiresAt: number;
}
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 2_000;

function cacheGet(key: string): MultiVendorInstrumentProfile | null | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return undefined;
  }
  return entry.profile;
}

function cacheSet(key: string, profile: MultiVendorInstrumentProfile | null): void {
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(key, { profile, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class MultiVendorInstrumentMasterService {
  private readonly ENGINE_VERSION = "FASP-AI-v3.0";

  /**
   * Invalidate local memory cache.
   */
  clearCache(): void {
    _cache.clear();
  }

  /**
   * Resolves an instrument's full multi-vendor profile using ISIN, Symbol, or AMFI Code.
   */
  async resolveInstrument(params: {
    isin?: string;
    symbol?: string;
    amfiCode?: number;
    instrumentType?: string;
  }): Promise<MultiVendorInstrumentProfile | null> {
    const isinClean = params.isin?.trim().toUpperCase();
    const symbolClean = params.symbol?.trim().toUpperCase();
    const amfiCode = params.amfiCode ? Number(params.amfiCode) : undefined;

    if (!isinClean && !symbolClean && !amfiCode) {
      return null;
    }

    const cacheKey = `mv:${isinClean || ""}:${symbolClean || ""}:${amfiCode || ""}`;
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
      // 1. Query isin_registry first (canonical source)
      let isinRow: ISINRegistryRecord | undefined;
      if (isinClean && isinClean.length >= 12) {
        const rows = await db
          .select()
          .from(isinRegistry)
          .where(and(eq(isinRegistry.isin, isinClean), eq(isinRegistry.isActive, true)))
          .limit(1);
        isinRow = rows[0];
      } else if (amfiCode) {
        const rows = await db
          .select()
          .from(isinRegistry)
          .where(and(eq(isinRegistry.amfiCode, amfiCode), eq(isinRegistry.isActive, true)))
          .limit(1);
        isinRow = rows[0];
      } else if (symbolClean) {
        const rows = await db
          .select()
          .from(isinRegistry)
          .where(and(eq(isinRegistry.nseSymbol, symbolClean), eq(isinRegistry.isActive, true)))
          .limit(1);
        isinRow = rows[0];
      }

      // 2. Query financial_instruments_cache if not in isin_registry or to get live prices
      let cacheRow: FinancialInstrumentsCache | undefined;
      if (!isinRow && (symbolClean || isinClean)) {
        const rows = await db
          .select()
          .from(financialInstrumentsCache)
          .where(
            or(
              symbolClean ? eq(financialInstrumentsCache.symbol, symbolClean) : undefined,
              isinClean ? eq(financialInstrumentsCache.isin, isinClean) : undefined,
            ),
          )
          .limit(1);
        cacheRow = rows[0];
      }

      if (!isinRow && !cacheRow) {
        // Fallback: Synthesize deterministic profile if symbol exists
        if (symbolClean) {
          const profile = this.synthesizeDefaultProfile(symbolClean, params.instrumentType);
          cacheSet(cacheKey, profile);
          return profile;
        }
        cacheSet(cacheKey, null);
        return null;
      }

      // Build composite profile
      const profile = this.buildProfile(isinRow, cacheRow, params);
      cacheSet(cacheKey, profile);
      return profile;
    } catch (err) {
      logger.warn("[MultiVendorInstrumentMaster] resolveInstrument failed", {
        event: "INSTRUMENT_RESOLVE_ERROR",
        user_id: "SYSTEM",
        latency_ms: 0,
        status: "warn",
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Returns vendor capabilities directory for a given asset class.
   */
  getVendorsForAssetClass(assetClass: string): {
    assetClass: string;
    executionVendors: VendorType[];
    pricingVendors: VendorType[];
    lendingVendors: VendorType[];
  } {
    const normalized = assetClass.toLowerCase();
    switch (normalized) {
      case "stock":
      case "equity":
      case "etf":
        return {
          assetClass: "stock",
          executionVendors: ["UPSTOX", "SMALLCASE"],
          pricingVendors: ["UPSTOX"],
          lendingVendors: ["SMALLCASE"],
        };
      case "mutual_fund":
      case "mf":
        return {
          assetClass: "mutual_fund",
          executionVendors: ["IRIS", "BSE_STAR_MF"],
          pricingVendors: ["AMFI", "IRIS"],
          lendingVendors: ["IRIS"],
        };
      case "bond":
      case "gsec":
      case "sgb":
        return {
          assetClass: "bond",
          executionVendors: ["IRIS", "UPSTOX"],
          pricingVendors: ["UPSTOX", "IRIS"],
          lendingVendors: ["IRIS"],
        };
      case "smallcase":
        return {
          assetClass: "smallcase",
          executionVendors: ["SMALLCASE"],
          pricingVendors: ["UPSTOX"],
          lendingVendors: ["SMALLCASE"],
        };
      case "us_stock":
        return {
          assetClass: "us_stock",
          executionVendors: ["ALPACA"],
          pricingVendors: ["ALPACA"],
          lendingVendors: ["NONE" as any],
        };
      case "fd":
      case "nps":
        return {
          assetClass: normalized,
          executionVendors: ["IRIS"],
          pricingVendors: ["IRIS"],
          lendingVendors: ["NONE" as any],
        };
      default:
        return {
          assetClass: normalized,
          executionVendors: ["DIRECT"],
          pricingVendors: ["DIRECT"],
          lendingVendors: ["NONE" as any],
        };
    }
  }

  /**
   * Upsert or link vendor identifiers for an ISIN.
   */
  async linkVendorMappings(
    isin: string,
    mappings: {
      irisProductCode?: string;
      upstoxInstrumentKey?: string;
      smallcaseId?: string;
      alpacaSymbol?: string;
      bseStarSchemeCode?: string;
      primaryVendor?: VendorType;
      lasEligible?: boolean;
      lasVendor?: "IRIS" | "SMALLCASE" | "BOTH" | "NONE";
      lasLtvPercent?: number;
      customMetadata?: Record<string, any>;
    },
  ): Promise<boolean> {
    const isinClean = isin.trim().toUpperCase();
    if (!isinClean || isinClean.length < 12) return false;

    try {
      const existing = await db
        .select()
        .from(isinRegistry)
        .where(eq(isinRegistry.isin, isinClean))
        .limit(1);

      if (existing.length === 0) return false;

      const current = existing[0];
      const supportedSet = new Set<string>((current.supportedVendors as string[]) || []);
      if (mappings.irisProductCode) supportedSet.add("IRIS");
      if (mappings.upstoxInstrumentKey) supportedSet.add("UPSTOX");
      if (mappings.smallcaseId) supportedSet.add("SMALLCASE");
      if (mappings.alpacaSymbol) supportedSet.add("ALPACA");
      if (mappings.bseStarSchemeCode) supportedSet.add("BSE_STAR_MF");
      if (current.amfiCode) supportedSet.add("AMFI");

      const vendorMapping = {
        ...((current.vendorMapping as Record<string, any>) || {}),
        ...(mappings.customMetadata || {}),
      };

      await db
        .update(isinRegistry)
        .set({
          irisProductCode: mappings.irisProductCode ?? current.irisProductCode,
          upstoxInstrumentKey: mappings.upstoxInstrumentKey ?? current.upstoxInstrumentKey,
          smallcaseId: mappings.smallcaseId ?? current.smallcaseId,
          alpacaSymbol: mappings.alpacaSymbol ?? current.alpacaSymbol,
          bseStarSchemeCode: mappings.bseStarSchemeCode ?? current.bseStarSchemeCode,
          primaryVendor: mappings.primaryVendor ?? current.primaryVendor,
          supportedVendors: Array.from(supportedSet),
          vendorMapping,
          lasEligible: mappings.lasEligible ?? current.lasEligible,
          lasVendor: mappings.lasVendor ?? current.lasVendor,
          lasLtvPercent: mappings.lasLtvPercent != null ? String(mappings.lasLtvPercent) : current.lasLtvPercent,
          updatedAt: new Date(),
        })
        .where(eq(isinRegistry.isin, isinClean));

      this.clearCache();
      return true;
    } catch (err) {
      logger.error("[MultiVendorInstrumentMaster] linkVendorMappings error", {
        event: "VENDOR_LINK_ERROR",
        user_id: "SYSTEM",
        latency_ms: 0,
        status: "error",
        isin: isinClean,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // ── Internal Helpers ────────────────────────────────────────────────────────

  private buildProfile(
    isinRow?: ISINRegistryRecord,
    cacheRow?: FinancialInstrumentsCache,
    requestParams?: { instrumentType?: string; symbol?: string },
  ): MultiVendorInstrumentProfile {
    const isin = isinRow?.isin || cacheRow?.isin || undefined;
    const symbol = isinRow?.nseSymbol || cacheRow?.symbol || requestParams?.symbol || "UNKNOWN";
    const canonicalName = isinRow?.canonicalName || cacheRow?.name || symbol;
    const rawType = (isinRow?.instrumentType || cacheRow?.instrumentType || requestParams?.instrumentType || "stock").toLowerCase();

    let instrumentType: MultiVendorInstrumentProfile["instrumentType"] = "stock";
    if (rawType.includes("mutual_fund") || rawType === "mf") instrumentType = "mutual_fund";
    else if (rawType.includes("bond") || rawType.includes("gsec") || rawType.includes("debenture")) instrumentType = "bond";
    else if (rawType.includes("etf")) instrumentType = "etf";
    else if (rawType.includes("index")) instrumentType = "index";
    else if (rawType.includes("smallcase")) instrumentType = "smallcase";
    else if (rawType.includes("us_") || rawType.includes("alpaca")) instrumentType = "us_stock";
    else if (rawType.includes("fd")) instrumentType = "fd";
    else if (rawType.includes("nps")) instrumentType = "nps";

    const country = isinRow?.country || cacheRow?.country || "IN";
    const currency = isinRow?.currency || cacheRow?.currency || "INR";

    // Supported Vendors List
    const supportedList: VendorType[] = [];
    const isinVendors = (isinRow?.supportedVendors as VendorType[]) || [];
    const cacheVendors = (cacheRow?.supportedVendors as VendorType[]) || [];
    const vendorSet = new Set<VendorType>([...isinVendors, ...cacheVendors]);

    // Check IRIS
    const irisProductCode = isinRow?.irisProductCode || (isinRow?.amc ? `IRIS_${isinRow.amc.toUpperCase()}` : undefined);
    const isIrisSupported = instrumentType === "mutual_fund" || instrumentType === "bond" || instrumentType === "fd" || instrumentType === "nps" || !!irisProductCode;
    if (isIrisSupported) vendorSet.add("IRIS");

    // Check Upstox
    const upstoxKey = isinRow?.upstoxInstrumentKey || (country === "IN" && (instrumentType === "stock" || instrumentType === "etf") ? `NSE_EQ|${isin || symbol}` : undefined);
    const isUpstoxSupported = country === "IN" && (instrumentType === "stock" || instrumentType === "etf" || instrumentType === "index" || !!upstoxKey);
    if (isUpstoxSupported) vendorSet.add("UPSTOX");

    // Check Smallcase
    const smallcaseId = isinRow?.smallcaseId || (instrumentType === "smallcase" ? symbol : undefined);
    const isSmallcaseSupported = instrumentType === "smallcase" || (country === "IN" && (instrumentType === "stock" || instrumentType === "etf"));
    if (isSmallcaseSupported) vendorSet.add("SMALLCASE");

    // Check Alpaca
    const alpacaSymbol = isinRow?.alpacaSymbol || (country === "US" || instrumentType === "us_stock" ? symbol : undefined);
    const isAlpacaSupported = !!alpacaSymbol || country === "US" || instrumentType === "us_stock";
    if (isAlpacaSupported) vendorSet.add("ALPACA");

    // Check AMFI
    const amfiCode = isinRow?.amfiCode;
    const isAmfiSupported = instrumentType === "mutual_fund" || !!amfiCode;
    if (isAmfiSupported) vendorSet.add("AMFI");

    // Check BSE StAR
    const bseStarCode = isinRow?.bseStarSchemeCode || (instrumentType === "mutual_fund" ? isin : undefined);
    const isBseStarSupported = instrumentType === "mutual_fund" || !!bseStarCode;
    if (isBseStarSupported) vendorSet.add("BSE_STAR_MF");

    for (const v of vendorSet) supportedList.push(v);

    // Primary Execution & Pricing Vendor
    let primaryVendor: VendorType = (isinRow?.primaryVendor as VendorType) || (cacheRow?.primaryVendor as VendorType) || "DIRECT";
    if (primaryVendor === "DIRECT") {
      if (instrumentType === "mutual_fund") primaryVendor = "IRIS";
      else if (instrumentType === "stock" || instrumentType === "etf") primaryVendor = "UPSTOX";
      else if (instrumentType === "smallcase") primaryVendor = "SMALLCASE";
      else if (instrumentType === "us_stock") primaryVendor = "ALPACA";
      else if (instrumentType === "bond") primaryVendor = "IRIS";
    }

    let primaryQuoteVendor: VendorType = "DIRECT";
    let feedType: MultiVendorInstrumentProfile["pricingRouting"]["feedType"] = "DAILY_NAV";
    if (instrumentType === "mutual_fund") {
      primaryQuoteVendor = "AMFI";
      feedType = "DAILY_NAV";
    } else if (instrumentType === "stock" || instrumentType === "etf" || instrumentType === "index") {
      primaryQuoteVendor = "UPSTOX";
      feedType = "REAL_TIME_STREAM";
    } else if (instrumentType === "us_stock") {
      primaryQuoteVendor = "ALPACA";
      feedType = "REAL_TIME_STREAM";
    } else if (instrumentType === "bond") {
      primaryQuoteVendor = "UPSTOX";
      feedType = "VALUATION_YIELD";
    }

    // LAS Lending capabilities
    const lasEligible = Boolean(isinRow?.lasEligible ?? cacheRow?.lasEligible ?? (instrumentType === "mutual_fund" || instrumentType === "stock"));
    let lasVendor: "IRIS" | "SMALLCASE" | "BOTH" | "NONE" = "NONE";
    let maxLtv = 50.0;
    let lienMech: "TPIN_OTP" | "GATEWAY_SDK" | "NONE" = "NONE";

    if (lasEligible) {
      if (instrumentType === "mutual_fund") {
        lasVendor = "IRIS";
        maxLtv = rawType.includes("debt") ? 80.0 : 50.0;
        lienMech = "TPIN_OTP";
      } else if (instrumentType === "stock") {
        lasVendor = "SMALLCASE";
        maxLtv = 50.0;
        lienMech = "GATEWAY_SDK";
      }
    }

    return {
      isin,
      symbol,
      canonicalName,
      instrumentType,
      country,
      currency,
      primaryVendor,
      supportedVendors: supportedList,
      vendors: {
        iris: {
          supported: isIrisSupported,
          vendorIdentifier: irisProductCode,
          tradingEnabled: isIrisSupported,
          pricingEnabled: instrumentType === "mutual_fund" || instrumentType === "bond",
          collateralLendingEnabled: instrumentType === "mutual_fund",
          metadata: { rta: isinRow?.amc?.toLowerCase().includes("hdfc") ? "CAMS" : "KFINTECH" },
        },
        upstox: {
          supported: isUpstoxSupported,
          vendorIdentifier: upstoxKey,
          exchange: cacheRow?.exchange || (country === "IN" ? "NSE" : undefined),
          tradingEnabled: country === "IN" && (instrumentType === "stock" || instrumentType === "etf"),
          pricingEnabled: isUpstoxSupported,
          collateralLendingEnabled: false,
        },
        smallcase: {
          supported: isSmallcaseSupported,
          vendorIdentifier: smallcaseId,
          tradingEnabled: isSmallcaseSupported,
          pricingEnabled: false,
          collateralLendingEnabled: instrumentType === "stock" || instrumentType === "etf",
        },
        alpaca: {
          supported: isAlpacaSupported,
          vendorIdentifier: alpacaSymbol,
          tradingEnabled: isAlpacaSupported,
          pricingEnabled: isAlpacaSupported,
          collateralLendingEnabled: false,
        },
        amfi: {
          supported: isAmfiSupported,
          vendorIdentifier: amfiCode ? String(amfiCode) : undefined,
          tradingEnabled: false,
          pricingEnabled: isAmfiSupported,
          collateralLendingEnabled: false,
          metadata: { amfiCodeDirect: isinRow?.amfiCodeDirect },
        },
        bseStar: {
          supported: isBseStarSupported,
          vendorIdentifier: bseStarCode,
          tradingEnabled: isBseStarSupported,
          pricingEnabled: false,
          collateralLendingEnabled: false,
        },
      },
      pricingRouting: {
        primaryQuoteVendor,
        feedType,
        fallbackVendor: primaryQuoteVendor === "UPSTOX" ? "DIRECT" : "IRIS",
      },
      executionRouting: {
        primaryExecutionVendor: primaryVendor,
        supportsFractional: instrumentType === "us_stock",
        supportsSip: instrumentType === "mutual_fund" || instrumentType === "smallcase",
        orderType:
          instrumentType === "stock" || instrumentType === "etf"
            ? "EXCHANGE_DMA"
            : instrumentType === "mutual_fund"
            ? "RTA_ORDER"
            : instrumentType === "smallcase"
            ? "BASKET_ORDER"
            : "BROKER_API",
        requiresAdvisorApproval: true, // FASP-AI Decision Support rule
      },
      collateralLending: {
        isEligible: lasEligible,
        recommendedVendor: lasVendor,
        maxLtvPercent: maxLtv,
        lienMechanism: lienMech,
      },
      regulatoryDisclosures: {
        advisoryOnly: true,
        riskDisclaimer:
          "AI advisory operates strictly as a Decision Support System. Order placement and collateral pledging require explicit investor authorization or advisor approval.",
      },
      engine_version: this.ENGINE_VERSION,
      calculation_timestamp: new Date().toISOString(),
    };
  }

  private synthesizeDefaultProfile(
    symbol: string,
    instrumentType: string = "stock",
  ): MultiVendorInstrumentProfile {
    const isStock = !instrumentType.toLowerCase().includes("fund");
    return {
      symbol,
      canonicalName: symbol,
      instrumentType: isStock ? "stock" : "mutual_fund",
      country: "IN",
      currency: "INR",
      primaryVendor: isStock ? "UPSTOX" : "IRIS",
      supportedVendors: isStock ? ["UPSTOX", "SMALLCASE"] : ["IRIS", "AMFI", "BSE_STAR_MF"],
      vendors: {
        iris: {
          supported: !isStock,
          tradingEnabled: !isStock,
          pricingEnabled: !isStock,
          collateralLendingEnabled: !isStock,
        },
        upstox: {
          supported: isStock,
          vendorIdentifier: `NSE_EQ|${symbol}`,
          exchange: "NSE",
          tradingEnabled: isStock,
          pricingEnabled: isStock,
          collateralLendingEnabled: false,
        },
        smallcase: {
          supported: isStock,
          tradingEnabled: isStock,
          pricingEnabled: false,
          collateralLendingEnabled: isStock,
        },
        alpaca: {
          supported: false,
          tradingEnabled: false,
          pricingEnabled: false,
          collateralLendingEnabled: false,
        },
        amfi: {
          supported: !isStock,
          tradingEnabled: false,
          pricingEnabled: !isStock,
          collateralLendingEnabled: false,
        },
        bseStar: {
          supported: !isStock,
          tradingEnabled: !isStock,
          pricingEnabled: false,
          collateralLendingEnabled: false,
        },
      },
      pricingRouting: {
        primaryQuoteVendor: isStock ? "UPSTOX" : "AMFI",
        feedType: isStock ? "REAL_TIME_STREAM" : "DAILY_NAV",
      },
      executionRouting: {
        primaryExecutionVendor: isStock ? "UPSTOX" : "IRIS",
        supportsFractional: false,
        supportsSip: !isStock,
        orderType: isStock ? "EXCHANGE_DMA" : "RTA_ORDER",
        requiresAdvisorApproval: true,
      },
      collateralLending: {
        isEligible: true,
        recommendedVendor: isStock ? "SMALLCASE" : "IRIS",
        maxLtvPercent: 50.0,
        lienMechanism: isStock ? "GATEWAY_SDK" : "TPIN_OTP",
      },
      regulatoryDisclosures: {
        advisoryOnly: true,
        riskDisclaimer: "Market investments are subject to market risks. Advisor approval is mandatory.",
      },
      engine_version: this.ENGINE_VERSION,
      calculation_timestamp: new Date().toISOString(),
    };
  }
}

export const multiVendorInstrumentMasterService = new MultiVendorInstrumentMasterService();
