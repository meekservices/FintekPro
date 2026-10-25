/**
 * IrisInstrumentBridge
 * Bridges KFintech IRIS mutual funds and fixed deposit products with
 * the FintekPro Unified Multi-Vendor Instrument Master & Performance Engine.
 *
 * Complies with GCR v1.0 & FASP-AI v1.0:
 * - Structured logging
 * - Idempotency & safe retries
 * - Schema contract adherence with /infra/broker-schemas/iris.json
 */

import { db } from "../../db";
import {
  instrumentMaster,
  instrumentVendorMappings,
  type InsertInstrumentVendorMapping,
  type InsertHistoricalMarketPrice,
} from "@shared/schema";
import { irisKfintechService } from "../iris-kfintech-service";
import { multiVendorInstrumentResolver } from "./multi-vendor-resolver";
import { historicalPerformanceService } from "./historical-performance-service";
import { logger } from "../../logger";

export interface IrisSchemeRecord {
  fundCode: string;
  schemeCode: string;
  schemeName: string;
  isin: string;
  category?: string;
  nav?: number;
  navDate?: string;
  minPurchaseAmount?: number;
  sipAllowed?: boolean;
}

export class IrisInstrumentBridge {
  private static instance: IrisInstrumentBridge;

  private constructor() {}

  public static getInstance(): IrisInstrumentBridge {
    if (!IrisInstrumentBridge.instance) {
      IrisInstrumentBridge.instance = new IrisInstrumentBridge();
    }
    return IrisInstrumentBridge.instance;
  }

  /**
   * Sync an IRIS mutual fund scheme into FintekPro's canonical Instrument Master & Vendor Mappings
   */
  public async syncScheme(scheme: IrisSchemeRecord): Promise<{ isin: string; vendorMapped: boolean }> {
    const startTime = Date.now();
    if (!scheme.isin) {
      throw new Error(`Cannot sync IRIS scheme ${scheme.schemeCode}: Missing ISIN`);
    }

    try {
      // 1. Ensure canonical instrument exists in instrumentMaster
      await db
        .insert(instrumentMaster)
        .values({
          isin: scheme.isin,
          name: scheme.schemeName,
          shortName: scheme.schemeName.slice(0, 50),
          assetClass: "mutual_fund",
          subType: scheme.category || "Equity",
          category: scheme.category || "Mutual Fund",
          issuer: scheme.fundCode,
          lastPrice: scheme.nav ? String(scheme.nav) : null,
          currency: "INR",
          priceSource: "iris",
          priceUpdatedAt: scheme.navDate ? new Date(scheme.navDate) : new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [instrumentMaster.isin],
          set: {
            name: scheme.schemeName,
            lastPrice: scheme.nav ? String(scheme.nav) : undefined,
            priceUpdatedAt: scheme.navDate ? new Date(scheme.navDate) : new Date(),
            updatedAt: new Date(),
          },
        });

      // 2. Register multi-vendor mapping in instrumentVendorMappings
      const mapping: InsertInstrumentVendorMapping = {
        isin: scheme.isin,
        vendor: "iris",
        vendorSymbol: scheme.fundCode,
        vendorInstrumentToken: scheme.schemeCode,
        feedRole: "PRIMARY_QUOTE",
        isActive: true,
        syncStatus: "synced",
        vendorMetadata: {
          scheme_name: scheme.schemeName,
          min_purchase_amount: scheme.minPurchaseAmount,
          sip_allowed: scheme.sipAllowed,
          nav: scheme.nav,
          nav_date: scheme.navDate,
        },
        source: "iris_sync",
      };

      await multiVendorInstrumentResolver.registerVendorMapping(mapping);

      // 3. Ingest current NAV as today's historical price point if available
      if (scheme.nav && scheme.navDate) {
        const histPoint: InsertHistoricalMarketPrice = {
          isin: scheme.isin,
          symbol: scheme.schemeCode,
          assetClass: "mutual_fund",
          priceDate: scheme.navDate.slice(0, 10),
          close: String(scheme.nav),
          dataSource: "iris",
        };
        await historicalPerformanceService.ingestHistoricalPrices([histPoint]);
      }

      logger.info("IRIS scheme synced to instrument master", {
        event: "IRIS_SCHEME_SYNCED",
        isin: scheme.isin,
        schemeCode: scheme.schemeCode,
        latency_ms: Date.now() - startTime,
        status: "success",
      });

      return { isin: scheme.isin, vendorMapped: true };
    } catch (error: any) {
      logger.error("Error syncing IRIS scheme to instrument master", {
        event: "IRIS_SCHEME_SYNC_ERROR",
        isin: scheme.isin,
        schemeCode: scheme.schemeCode,
        error: error?.message,
        latency_ms: Date.now() - startTime,
        status: "error",
      });
      throw error;
    }
  }

  /**
   * Validate and build order payload for IRIS according to /infra/broker-schemas/iris.json
   */
  public buildOrderPayload(params: {
    pan: string;
    schemeCode: string;
    amount: number;
    folioNumber?: string;
    orderType: "LUMPSUM" | "SIP";
    bankAccountNo: string;
    ifsc: string;
  }) {
    // Zero-trust input validation per GCR Security rules
    if (!params.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(params.pan)) {
      throw new Error("Invalid PAN format for IRIS order submission");
    }
    if (!params.schemeCode) {
      throw new Error("Scheme code is required for IRIS order");
    }
    if (!params.amount || params.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    return {
      pan: params.pan,
      schemeCode: params.schemeCode,
      investmentAmount: params.amount,
      folioNo: params.folioNumber || "",
      transactionType: params.orderType === "SIP" ? "NEW_SIP" : "PURCHASE",
      bankDetails: {
        accountNo: params.bankAccountNo,
        ifscCode: params.ifsc,
      },
      clientCallbackUrl: "https://fintekpro.com/api/webhooks/iris/order",
      timestamp: new Date().toISOString(),
    };
  }
}

export const irisInstrumentBridge = IrisInstrumentBridge.getInstance();
