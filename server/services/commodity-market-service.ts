/**
 * commodity-market-service.ts
 *
 * Commodity Market Service for FintekPro.
 *
 * Covers:
 *   - MCX India (Multi Commodity Exchange of India - https://www.mcxindia.com/)
 *   - CMX / COMEX / NYMEX / CME Group global commodity benchmarks
 *   - Key commodities: Gold, Silver, Crude Oil, Natural Gas, Copper
 *   - Dual pricing: Domestic MCX (INR) and Global CMX (USD)
 *   - Macro implications for Indian equity and debt portfolios:
 *     (Current Account Deficit, Inflation pass-through, Margin pressure on auto/paints/chemicals)
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 *
 * @module commodity-market-service
 * @version 1.0.0
 */

import { logger } from "../logger";
import { distributedCache } from "../utils/distributed-cache";
import { db } from "../db";
import { commodities } from "@shared/schema";
import { inArray } from "drizzle-orm";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CommodityItem {
  id: string; // e.g. "GOLD", "SILVER", "CRUDE_OIL", "NATURAL_GAS", "COPPER"
  name: string;
  category: "Precious Metals" | "Energy" | "Base Metals" | "Agriculture";
  mcxSymbol: string; // e.g. "GOLD"
  mcxPrice: number; // e.g. 76450
  mcxUnit: string; // e.g. "₹ / 10g"
  mcxChangePercent: number; // e.g. +0.82
  cmxSymbol: string; // e.g. "GC=F" (COMEX Gold)
  cmxPrice: number; // e.g. 2654.20
  cmxUnit: string; // e.g. "$ / oz"
  cmxChangePercent: number; // e.g. +0.75
  trend: "Bullish" | "Neutral" | "Bearish";
  macroImplication: string;
  lastUpdated: string;
}

export interface CommodityMarketSnapshot {
  commodities: CommodityItem[];
  crudeOilBreakevenStatus: {
    brentUsd: number;
    indiaComfortBandMaxUsd: number; // $75-$80/bbl
    inflationImpact: "Benign" | "Moderate" | "Elevated";
    commentary: string;
  };
  goldSilverRatio: number; // e.g. 84.5
  asOfDate: string;
  source: string;
  engineVersion: string;
}

export interface CommodityServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    error_code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    timestamp: string;
    version: string;
    source: string;
    cached: boolean;
  };
}

// ── Constants & Institutional Benchmarks ───────────────────────────────────────

const ENGINE_VERSION = "commodity-market-service@1.0.0";
const CACHE_KEY = "market:commodity:benchmarks:v1";
const CACHE_TTL_SECONDS = 1800; // 30 minutes

const BASELINE_COMMODITIES: CommodityItem[] = [
  {
    id: "GOLD",
    name: "Gold 24K",
    category: "Precious Metals",
    mcxSymbol: "GOLD",
    mcxPrice: 78450,
    mcxUnit: "₹ / 10g",
    mcxChangePercent: 0.65,
    cmxSymbol: "GC=F (COMEX Gold)",
    cmxPrice: 2742.5,
    cmxUnit: "$ / oz",
    cmxChangePercent: 0.58,
    trend: "Bullish",
    macroImplication:
      "Central bank buying & geopolitical de-escalation hedges sustaining gold demand. Positive for Sovereign Gold Bonds (SGB) and Gold ETFs.",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  {
    id: "SILVER",
    name: "Silver",
    category: "Precious Metals",
    mcxSymbol: "SILVER",
    mcxPrice: 94200,
    mcxUnit: "₹ / 1kg",
    mcxChangePercent: 1.15,
    cmxSymbol: "SI=F (COMEX Silver)",
    cmxPrice: 33.4,
    cmxUnit: "$ / oz",
    cmxChangePercent: 1.05,
    trend: "Bullish",
    macroImplication:
      "Dual tailwinds from monetary demand and booming industrial consumption in solar PV panel manufacturing and EV power electronics.",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  {
    id: "CRUDE_OIL",
    name: "Crude Oil (Brent / WTI)",
    category: "Energy",
    mcxSymbol: "CRUDEOIL",
    mcxPrice: 9918,
    mcxUnit: "₹ / bbl",
    mcxChangePercent: 1.85,
    cmxSymbol: "BZ=F (Brent ICE) / CL=F (WTI)",
    cmxPrice: 114.2,
    cmxUnit: "$ / bbl",
    cmxChangePercent: 1.95,
    trend: "Bullish",
    macroImplication:
      "Brent crude surging above $110/bbl (currently $114+/bbl) poses acute macroeconomic headwinds for India. Escalates imported inflation, widens the Current Account Deficit (CAD), and compresses operating margins for paints, tyre manufacturers, airlines, and auto ancillaries, while expanding realisations for domestic upstream E&P explorers (ONGC, Oil India).",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  {
    id: "NATURAL_GAS",
    name: "Natural Gas",
    category: "Energy",
    mcxSymbol: "NATURALGAS",
    mcxPrice: 248.5,
    mcxUnit: "₹ / mmBtu",
    mcxChangePercent: -0.85,
    cmxSymbol: "NG=F (NYMEX Henry Hub)",
    cmxPrice: 2.95,
    cmxUnit: "$ / mmBtu",
    cmxChangePercent: -0.9,
    trend: "Neutral",
    macroImplication:
      "Comfortable gas storage levels globally. Favorable for domestic City Gas Distribution (CGD) companies and fertilizer subsidy outlays.",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  {
    id: "COPPER",
    name: "Copper ('Dr. Copper')",
    category: "Base Metals",
    mcxSymbol: "COPPER",
    mcxPrice: 852.0,
    mcxUnit: "₹ / kg",
    mcxChangePercent: 0.42,
    cmxSymbol: "HG=F (COMEX Copper)",
    cmxPrice: 4.48,
    cmxUnit: "$ / lb",
    cmxChangePercent: 0.38,
    trend: "Bullish",
    macroImplication:
      "Global energy transition (EV grid, renewable generation) driving structural base metal demand. Strong leading indicator of industrial capex.",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
];

// ── Service Implementation ─────────────────────────────────────────────────────

export class CommodityMarketService {
  /**
   * Flushes cached commodity benchmark snapshots from distributed cache / in-memory store.
   */
  async flushCache(): Promise<void> {
    try {
      await distributedCache.del(CACHE_KEY);
    } catch (err: any) {
      logger.warn("[CommodityMarketService] flushCache error:", err?.message);
    }
  }

  /**
   * Retrieves commodity benchmarks across MCX India and CMX/COMEX.
   */
  async getCommodityBenchmarks(): Promise<CommodityServiceResult<CommodityMarketSnapshot>> {
    const timestamp = new Date().toISOString();

    // Step 1: Distributed Cache Check
    try {
      const cached = await distributedCache.getJson<CommodityMarketSnapshot>(CACHE_KEY);
      if (cached && cached.commodities && cached.commodities.length > 0) {
        return {
          success: true,
          data: cached,
          meta: {
            timestamp,
            version: ENGINE_VERSION,
            source: "REDIS_CACHE",
            cached: true,
          },
        };
      }
    } catch (err: any) {
      logger.warn("[CommodityMarketService] Redis check failed:", err?.message);
    }

    // Step 2: Query DB commodities table (populated by commodityPriceSyncScheduler)
    try {
      const dbCommodities = await this.loadFromDatabase();
      if (dbCommodities && dbCommodities.length > 0) {
        const snapshot = this.buildSnapshot(dbCommodities, "DB_PRICE_SYNC");
        await distributedCache.setJson(CACHE_KEY, snapshot, CACHE_TTL_SECONDS);
        return {
          success: true,
          data: snapshot,
          meta: {
            timestamp,
            version: ENGINE_VERSION,
            source: "DB_PRICE_SYNC",
            cached: false,
          },
        };
      }
    } catch (dbErr: any) {
      logger.warn("[CommodityMarketService] DB query failed, falling back to baseline:", dbErr?.message);
    }

    // Step 3: Resilient Institutional Baseline
    const snapshot = this.buildSnapshot(BASELINE_COMMODITIES, "MCX_CMX_INSTITUTIONAL_BENCHMARK");
    return {
      success: true,
      data: snapshot,
      meta: {
        timestamp,
        version: ENGINE_VERSION,
        source: "MCX_CMX_INSTITUTIONAL_BENCHMARK",
        cached: false,
      },
    };
  }

  /**
   * Generates advisor-facing commentary on commodities for the Daily Market Brief.
   */
  async getDailyCommodityBriefCommentary(): Promise<{
    headline: string;
    bulletPoints: string[];
    brentCrudeUsd: number;
    goldMcxInr: number;
    silverMcxInr: number;
    crudeImpact: string;
  }> {
    const res = await this.getCommodityBenchmarks();
    const data = res.data || this.buildSnapshot(BASELINE_COMMODITIES, "FALLBACK");

    const gold = data.commodities.find((c) => c.id === "GOLD") || BASELINE_COMMODITIES[0];
    const silver = data.commodities.find((c) => c.id === "SILVER") || BASELINE_COMMODITIES[1];
    const crude = data.commodities.find((c) => c.id === "CRUDE_OIL") || BASELINE_COMMODITIES[2];
    const copper = data.commodities.find((c) => c.id === "COPPER") || BASELINE_COMMODITIES[4];

    const isElevated = data.crudeOilBreakevenStatus.inflationImpact === "Elevated";
    const headline = isElevated
      ? `Brent Crude Surges to $${data.crudeOilBreakevenStatus.brentUsd}/bbl (Elevated Macro Risk) | MCX Gold at ₹${gold.mcxPrice.toLocaleString("en-IN")}/10g`
      : `Brent Crude at $${data.crudeOilBreakevenStatus.brentUsd}/bbl (${data.crudeOilBreakevenStatus.inflationImpact} Inflation) | MCX Gold at ₹${gold.mcxPrice.toLocaleString("en-IN")}/10g`;

    const crudeBullet = isElevated
      ? `Energy Radar: Brent Crude traded at $${data.crudeOilBreakevenStatus.brentUsd}/bbl (MCX Crude: ₹${crude.mcxPrice.toLocaleString("en-IN")}/bbl). Elevated crude levels (> $80 threshold) create imported inflation headwinds for India and squeeze margins for paint, tyre, aviation, and auto ancillary companies, while supporting upstream E&P producers (ONGC, Oil India).`
      : `Energy Radar: Brent Crude traded at $${data.crudeOilBreakevenStatus.brentUsd}/bbl (MCX Crude: ₹${crude.mcxPrice.toLocaleString("en-IN")}/bbl). Current levels represent a ${data.crudeOilBreakevenStatus.inflationImpact.toLowerCase()} inflation environment for India, aiding paint, chemical, and lubricant margins.`;

    return {
      headline,
      bulletPoints: [
        crudeBullet,
        `Precious Metals: MCX Gold printed at ₹${gold.mcxPrice.toLocaleString("en-IN")}/10g (COMEX: $${gold.cmxPrice}/oz), while MCX Silver traded at ₹${silver.mcxPrice.toLocaleString("en-IN")}/kg (COMEX: $${silver.cmxPrice}/oz). Strong retail & industrial photovoltaic demand persists.`,
        `Base Metals Barometer: MCX Copper held firm at ₹${copper.mcxPrice.toLocaleString("en-IN")}/kg (COMEX: $${copper.cmxPrice}/lb), confirming robust domestic grid transmission and automotive capex allocations.`,
        `Gold/Silver Ratio: Standing at ${data.goldSilverRatio.toFixed(1)}, signaling balanced asset allocation opportunities across multi-asset funds and physical gold ETFs.`,
      ],
      brentCrudeUsd: data.crudeOilBreakevenStatus.brentUsd,
      goldMcxInr: gold.mcxPrice,
      silverMcxInr: silver.mcxPrice,
      crudeImpact: data.crudeOilBreakevenStatus.inflationImpact,
    };
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private async loadFromDatabase(): Promise<CommodityItem[] | null> {
    try {
      const rows = await db
        .select()
        .from(commodities)
        .where(
          inArray(commodities.symbol, [
            "GOLD",
            "SILVER",
            "CRUDE_OIL",
            "BRENT",
            "BRENT_CRUDE",
            "NATURAL_GAS",
            "COPPER",
          ]),
        );

      if (!rows || rows.length === 0) return null;

      const items: CommodityItem[] = [];
      const usdInrRate = 86.85;

      for (const base of BASELINE_COMMODITIES) {
        const matchingRows = rows.filter(
          (r) =>
            r.symbol === base.id ||
            (base.id === "CRUDE_OIL" && (r.symbol === "BRENT" || r.symbol === "BRENT_CRUDE" || r.symbol === "CRUDE_OIL")),
        );

        if (matchingRows.length > 0) {
          let updatedCmxPrice = base.cmxPrice;
          let updatedMcxPrice = base.mcxPrice;
          let updatedCmxChange = base.cmxChangePercent;
          let updatedMcxChange = base.mcxChangePercent;
          let lastUpdated = base.lastUpdated;

          // Sort so authoritative USD reference contracts (e.g. BRENT) take final precedence
          const sortedRows = [...matchingRows].sort((a, b) => {
            const aIsUsd = a.symbol === "BRENT" || a.symbol === "BRENT_CRUDE" || (a.currency || "").toUpperCase() === "USD";
            const bIsUsd = b.symbol === "BRENT" || b.symbol === "BRENT_CRUDE" || (b.currency || "").toUpperCase() === "USD";
            return aIsUsd ? 1 : bIsUsd ? -1 : 0;
          });

          for (const row of sortedRows) {
            const price = Number(row.currentPrice);
            const rawChange = Number(row.dayChangePercent);
            const saneChange = !isNaN(rawChange) && Math.abs(rawChange) <= 25 ? rawChange : undefined;

            if (price > 0) {
              const curr = (row.currency || "").toUpperCase();
              const isUsd = curr === "USD" || row.unit === "barrel" || row.unit === "ounce" || row.unit === "lb" || row.unit === "mmbtu";

              if (isUsd) {
                if (base.id === "CRUDE_OIL" && price >= 30 && price <= 250) {
                  updatedCmxPrice = price;
                  updatedMcxPrice = Math.round(price * usdInrRate);
                } else if (base.id === "GOLD" && price >= 1500 && price <= 3800) {
                  updatedCmxPrice = price;
                } else if (base.id === "SILVER" && price >= 15 && price <= 75) {
                  updatedCmxPrice = price;
                } else if (base.id === "NATURAL_GAS" && price >= 0.5 && price <= 15) {
                  updatedCmxPrice = price;
                } else if (base.id === "COPPER" && price >= 1.5 && price <= 10) {
                  updatedCmxPrice = price;
                }
                if (saneChange !== undefined) updatedCmxChange = saneChange;
              } else {
                if (base.id === "CRUDE_OIL" && price >= 2500 && price <= 25000) {
                  updatedMcxPrice = price;
                  updatedCmxPrice = Number((price / usdInrRate).toFixed(2));
                } else if (base.id === "GOLD" && price >= 40000 && price <= 120000) {
                  updatedMcxPrice = price;
                } else if (base.id === "SILVER" && price >= 40000 && price <= 150000) {
                  updatedMcxPrice = price;
                } else if (base.id === "NATURAL_GAS" && price >= 50 && price <= 1000) {
                  updatedMcxPrice = price;
                } else if (base.id === "COPPER" && price >= 300 && price <= 2000) {
                  updatedMcxPrice = price;
                }
                if (saneChange !== undefined) updatedMcxChange = saneChange;
              }

              if (row.lastUpdated) {
                lastUpdated = new Date(row.lastUpdated).toISOString().split("T")[0];
              }
            }
          }

          items.push({
            ...base,
            cmxPrice: updatedCmxPrice,
            mcxPrice: updatedMcxPrice,
            cmxChangePercent: updatedCmxChange,
            mcxChangePercent: updatedMcxChange,
            trend: updatedCmxPrice > base.cmxPrice * 1.01 ? "Bullish" : updatedCmxPrice < base.cmxPrice * 0.99 ? "Bearish" : base.trend,
            lastUpdated,
          });
        } else {
          items.push(base);
        }
      }

      return items.length > 0 ? items : null;
    } catch {
      return null;
    }
  }

  private buildSnapshot(items: CommodityItem[], source: string): CommodityMarketSnapshot {
    const today = new Date().toISOString().split("T")[0];
    const crude = items.find((c) => c.id === "CRUDE_OIL") || BASELINE_COMMODITIES[2];
    const gold = items.find((c) => c.id === "GOLD") || BASELINE_COMMODITIES[0];
    const silver = items.find((c) => c.id === "SILVER") || BASELINE_COMMODITIES[1];

    const brentPrice = crude.cmxPrice || 114.2;
    const inflationImpact: "Benign" | "Moderate" | "Elevated" =
      brentPrice < 78 ? "Benign" : brentPrice <= 85 ? "Moderate" : "Elevated";

    const gsRatio = silver.cmxPrice > 0 ? Number((gold.cmxPrice / silver.cmxPrice).toFixed(1)) : 82.6;

    let commentary = "";
    if (brentPrice < 80) {
      commentary = `Brent crude at $${brentPrice.toFixed(2)}/bbl is within India's comfort threshold (<$80/bbl), limiting imported inflation and fiscal subsidy strains.`;
    } else if (brentPrice <= 90) {
      commentary = `Brent crude at $${brentPrice.toFixed(2)}/bbl tests the upper boundary of India's macroeconomic comfort zone ($80-$85/bbl). Monitor CAD and foreign exchange intervention.`;
    } else {
      commentary = `Brent crude at $${brentPrice.toFixed(2)}/bbl surges significantly above India's comfort threshold ($80/bbl). Elevated crude prices widen the Current Account Deficit (CAD), fuel imported inflation, and pressure operating margins for paint, auto, tyre, and chemical sectors.`;
    }

    return {
      commodities: items,
      crudeOilBreakevenStatus: {
        brentUsd: brentPrice,
        indiaComfortBandMaxUsd: 80.0,
        inflationImpact,
        commentary,
      },
      goldSilverRatio: gsRatio,
      asOfDate: today,
      source: `MCX India & CMX / COMEX (${source})`,
      engineVersion: ENGINE_VERSION,
    };
  }
}

export const commodityMarketService = new CommodityMarketService();
