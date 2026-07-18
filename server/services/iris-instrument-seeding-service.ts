/**
 * IRIS Instrument Seeding Service
 * ─────────────────────────────────
 * Seeds financial product catalogs from KFintech IRIS API into FintekPro DB.
 *
 * Four seeding jobs (run as Phase D of the daily enrichment job):
 *  1. seedFdProducts()         — Fixed Deposit catalog
 *  2. seedNpsFunds()           — NPS Pension Fund manager options
 *  3. seedPmsAifProducts()     — PMS + AIF strategy catalog
 *  4. enrichMfHoldings()       — MF portfolio-holdings (replaces FMP)
 *  5. enrichMfFactsheets()     — MF factsheet: kfintechId, expenseRatio, fundManager
 *
 * Architecture rules (FASP-AI v1.0 / GCR v1.0):
 *  - All writes are idempotent (ON CONFLICT DO UPDATE)
 *  - Every result exposes: inputs used, records seeded, records failed
 *  - AI is decision-support only — seeding never executes trades
 *
 * @module server/services/iris-instrument-seeding-service
 */

import { db } from "../db";
import { logger } from "../logger";
import { irisKfintechService } from "./iris-kfintech-service";
import {
  irisFdProducts,
  irisNpsFunds,
  irisPmsAifProducts,
  mutualFunds,
  mfSchemeStockHoldings,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEEDING_VERSION = "1.0.0";

function seedLog(
  event: string,
  data: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
) {
  logger[level](`[IRISSeed] ${event}`, {
    ...data,
    engine_version: SEEDING_VERSION,
    calculation_timestamp: new Date().toISOString(),
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse a numeric field from an IRIS response (handles string/number) */
function toNum(val: unknown): number | null {
  if (val == null) return null;
  const n = typeof val === "string" ? parseFloat(val) : Number(val);
  return isNaN(n) ? null : n;
}

/**
 * Convert number|null to string|null for Drizzle decimal() columns.
 * Drizzle's decimal type requires string inputs, not number.
 */
function toDecStr(val: unknown): string | null {
  const n = toNum(val);
  return n == null ? null : String(n);
}

function resolveProductId(raw: Record<string, any>, prefix: string): string {
  return String(
    raw.productId     ??
    raw.fundCode      ??
    raw.schemeCode    ??
    raw.code          ??
    raw.id            ??
    `${prefix}-${raw.productName ?? raw.strategyName ?? raw.fundManagerName ?? Math.random()}`
  ).slice(0, 100);
}

// ─── Job 1: Fixed Deposit Catalog ────────────────────────────────────────────

export async function seedFdProducts(): Promise<{
  seeded: number; failed: number; skipped: number;
}> {
  const startMs = Date.now();
  let seeded = 0, failed = 0, skipped = 0;
  seedLog("FD_SEED_START", { job: "seedFdProducts" });

  if (!irisKfintechService.isConfigured) {
    seedLog("FD_SEED_SKIP", { reason: "IRIS not configured" }, "warn");
    return { seeded: 0, failed: 0, skipped: -1 };
  }

  let products: any[] = [];
  try {
    const resp = await irisKfintechService.getFixedDepositProducts();
    products = Array.isArray(resp) ? resp : (resp?.products ?? resp?.data ?? []);
  } catch (err: any) {
    seedLog("FD_SEED_FETCH_FAILED", { error: err.message }, "error");
    return { seeded: 0, failed: 0, skipped: 0 };
  }

  seedLog("FD_SEED_FETCHED", { count: products.length });

  for (const raw of products) {
    try {
      const irisProductId = resolveProductId(raw, "fd");

      let brochureUrl: string | null = null;
      try {
        const brochure = await irisKfintechService.getFdBrochure(irisProductId);
        brochureUrl = brochure?.brochureUrl ?? brochure?.url ?? null;
      } catch { /* non-fatal */ }

      await db
        .insert(irisFdProducts)
        .values({
          irisProductId,
          issuerName:     String(raw.issuerName ?? raw.companyName ?? "Unknown"),
          productName:    String(raw.productName ?? raw.name ?? irisProductId),
          productCode:    raw.productCode ?? raw.code ?? null,
          category:       raw.category ?? raw.productCategory ?? null,
          interestRate:   raw.interestRate ?? raw.yield ?? null,
          tenureMonths:   raw.tenureMonths ?? raw.tenure ?? null,
          minInvestment:  raw.minInvestment ?? raw.minimumInvestment ?? null,
          maxInvestment:  raw.maxInvestment ?? raw.maximumInvestment ?? null,
          lockInMonths:   raw.lockInMonths ?? raw.lockinMonths ?? 0,
          isCumulative:   raw.isCumulative ?? raw.cumulative ?? true,
          payoutFrequency: raw.payoutFrequency ?? raw.payoutOption ?? null,
          creditRating:   raw.creditRating ?? raw.rating ?? null,
          ratingAgency:   raw.ratingAgency ?? null,
          seniorCitizenRateExtra: raw.seniorCitizenRate ?? raw.srCitizenRateExtra ?? null,
          brochureUrl,
          rawData:        raw,
          source:         "iris_kfintech",
        })
        .onConflictDoUpdate({
          target: irisFdProducts.irisProductId,
          set: {
            issuerName:      sql`excluded.issuer_name`,
            productName:     sql`excluded.product_name`,
            interestRate:    sql`excluded.interest_rate`,
            tenureMonths:    sql`excluded.tenure_months`,
            minInvestment:   sql`excluded.min_investment`,
            maxInvestment:   sql`excluded.max_investment`,
            lockInMonths:    sql`excluded.lock_in_months`,
            isCumulative:    sql`excluded.is_cumulative`,
            payoutFrequency: sql`excluded.payout_frequency`,
            creditRating:    sql`excluded.credit_rating`,
            ratingAgency:    sql`excluded.rating_agency`,
            seniorCitizenRateExtra: sql`excluded.senior_citizen_rate_extra`,
            brochureUrl:     sql`excluded.brochure_url`,
            rawData:         sql`excluded.raw_data`,
            updatedAt:       sql`now()`,
          },
        });
      seeded++;
    } catch (err: any) {
      failed++;
      seedLog("FD_SEED_ROW_FAILED", { error: err.message }, "warn");
    }
    await sleep(50);
  }

  seedLog("FD_SEED_DONE", { seeded, failed, skipped, latency_ms: Date.now() - startMs });
  return { seeded, failed, skipped };
}

// ─── Job 2: NPS Fund Catalog ──────────────────────────────────────────────────

export async function seedNpsFunds(): Promise<{
  seeded: number; failed: number; skipped: number;
}> {
  const startMs = Date.now();
  let seeded = 0, failed = 0, skipped = 0;
  seedLog("NPS_SEED_START", { job: "seedNpsFunds" });

  if (!irisKfintechService.isConfigured) {
    seedLog("NPS_SEED_SKIP", { reason: "IRIS not configured" }, "warn");
    return { seeded: 0, failed: 0, skipped: -1 };
  }

  let funds: any[] = [];
  try {
    const resp = await irisKfintechService.getNpsInvestmentLinks();
    funds = Array.isArray(resp) ? resp : (resp?.funds ?? resp?.data ?? resp?.links ?? []);
  } catch (err: any) {
    seedLog("NPS_SEED_FETCH_FAILED", { error: err.message }, "error");
    return { seeded: 0, failed: 0, skipped: 0 };
  }

  seedLog("NPS_SEED_FETCHED", { count: funds.length });

  for (const raw of funds) {
    try {
      const irisFundCode = resolveProductId(raw, "nps");

      await db
        .insert(irisNpsFunds)
        .values({
          irisFundCode,
          fundManagerName: String(raw.fundManagerName ?? raw.name ?? raw.pfmName ?? irisFundCode),
          shortName:       raw.shortName ?? raw.code ?? null,
          tier:            raw.tier ?? raw.tierType ?? "both",
          schemeType:      raw.schemeType ?? "NPS",
          equityPct:       toDecStr(raw.equityPct ?? raw.equityAllocation),
          corporateBondPct: toDecStr(raw.corporateBondPct ?? raw.corporateDebtAllocation),
          govtSecPct:      toDecStr(raw.govtSecPct ?? raw.governmentSecuritiesAllocation),
          alternatePct:    toDecStr(raw.alternatePct ?? raw.alternateAllocation),
          return1y:        toDecStr(raw.return1y ?? raw.returns?.oneYear),
          return3y:        toDecStr(raw.return3y ?? raw.returns?.threeYear),
          return5y:        toDecStr(raw.return5y ?? raw.returns?.fiveYear),
          pfmCode:         raw.pfmCode ?? raw.fundCode ?? null,
          rawData:         raw,
          source:          "iris_kfintech",
        })
        .onConflictDoUpdate({
          target: irisNpsFunds.irisFundCode,
          set: {
            fundManagerName:  sql`excluded.fund_manager_name`,
            tier:             sql`excluded.tier`,
            equityPct:        sql`excluded.equity_pct`,
            corporateBondPct: sql`excluded.corporate_bond_pct`,
            govtSecPct:       sql`excluded.govt_sec_pct`,
            alternatePct:     sql`excluded.alternate_pct`,
            return1y:         sql`excluded.return_1y`,
            return3y:         sql`excluded.return_3y`,
            return5y:         sql`excluded.return_5y`,
            rawData:          sql`excluded.raw_data`,
            updatedAt:        sql`now()`,
          },
        });
      seeded++;
    } catch (err: any) {
      failed++;
      seedLog("NPS_SEED_ROW_FAILED", { error: err.message }, "warn");
    }
    await sleep(50);
  }

  seedLog("NPS_SEED_DONE", { seeded, failed, skipped, latency_ms: Date.now() - startMs });
  return { seeded, failed, skipped };
}

// ─── Job 3: PMS + AIF Catalog ─────────────────────────────────────────────────

export async function seedPmsAifProducts(): Promise<{
  pmsSeeded: number; aifSeeded: number; failed: number;
}> {
  const startMs = Date.now();
  let pmsSeeded = 0, aifSeeded = 0, failed = 0;
  seedLog("PMS_AIF_SEED_START", { job: "seedPmsAifProducts" });

  if (!irisKfintechService.isConfigured) {
    seedLog("PMS_AIF_SEED_SKIP", { reason: "IRIS not configured" }, "warn");
    return { pmsSeeded: 0, aifSeeded: 0, failed: 0 };
  }

  const batches: Array<{ type: "pms" | "aif"; items: any[] }> = [];

  try {
    const pmsResp = await irisKfintechService.getPmsLinks();
    const pmsItems = Array.isArray(pmsResp) ? pmsResp : (pmsResp?.products ?? pmsResp?.data ?? pmsResp?.links ?? []);
    batches.push({ type: "pms", items: pmsItems });
    seedLog("PMS_AIF_PMS_FETCHED", { count: pmsItems.length });
  } catch (err: any) {
    seedLog("PMS_AIF_PMS_FETCH_FAILED", { error: err.message }, "warn");
  }

  try {
    const aifResp = await irisKfintechService.getAifLinks();
    const aifItems = Array.isArray(aifResp) ? aifResp : (aifResp?.products ?? aifResp?.data ?? aifResp?.links ?? []);
    batches.push({ type: "aif", items: aifItems });
    seedLog("PMS_AIF_AIF_FETCHED", { count: aifItems.length });
  } catch (err: any) {
    seedLog("PMS_AIF_AIF_FETCH_FAILED", { error: err.message }, "warn");
  }

  for (const { type, items } of batches) {
    for (const raw of items) {
      try {
        const irisProductId = resolveProductId(raw, type);

        await db
          .insert(irisPmsAifProducts)
          .values({
            irisProductId,
            productType:    type,
            strategyName:   String(raw.strategyName ?? raw.name ?? raw.productName ?? irisProductId),
            fundHouse:      raw.fundHouse ?? raw.amcName ?? raw.issuer ?? null,
            sebiCategory:   raw.sebiCategory ?? raw.category ?? null,
            strategyType:   raw.strategyType ?? raw.type ?? null,
            minInvestment:  toDecStr(raw.minimumInvestment ?? raw.minInvestment),
            aum:            toDecStr(raw.aum ?? raw.aumCrores),
            lockInMonths:   raw.lockInMonths ?? raw.lockinMonths ?? null,
            managementFee:  toDecStr(raw.managementFee ?? raw.managementFees),
            performanceFee: toDecStr(raw.performanceFee ?? raw.profitSharingFee),
            return1y:       toDecStr(raw.return1y ?? raw.returns?.oneYear),
            return3y:       toDecStr(raw.return3y ?? raw.returns?.threeYear),
            returnSinceInception: toDecStr(raw.returnSinceInception ?? raw.returns?.sinceInception),
            sharpeRatio:    toDecStr(raw.sharpeRatio),
            riskLevel:      raw.riskLevel ?? raw.riskCategory ?? null,
            sebiRegNo:      raw.sebiRegNo ?? raw.registrationNumber ?? null,
            rawData:        raw,
            source:         "iris_kfintech",
          })
          .onConflictDoUpdate({
            target: irisPmsAifProducts.irisProductId,
            set: {
              strategyName:   sql`excluded.strategy_name`,
              fundHouse:      sql`excluded.fund_house`,
              sebiCategory:   sql`excluded.sebi_category`,
              aum:            sql`excluded.aum`,
              minInvestment:  sql`excluded.min_investment`,
              return1y:       sql`excluded.return_1y`,
              return3y:       sql`excluded.return_3y`,
              returnSinceInception: sql`excluded.return_since_inception`,
              sharpeRatio:    sql`excluded.sharpe_ratio`,
              rawData:        sql`excluded.raw_data`,
              updatedAt:      sql`now()`,
            },
          });

        if (type === "pms") pmsSeeded++; else aifSeeded++;
      } catch (err: any) {
        failed++;
        seedLog("PMS_AIF_SEED_ROW_FAILED", { type, error: err.message }, "warn");
      }
      await sleep(50);
    }
  }

  seedLog("PMS_AIF_SEED_DONE", { pmsSeeded, aifSeeded, failed, latency_ms: Date.now() - startMs });
  return { pmsSeeded, aifSeeded, failed };
}

// ─── Job 4a: MF Portfolio Holdings ───────────────────────────────────────────

export async function enrichMfHoldings(batchSize = 200): Promise<{
  processed: number; holdingsWritten: number; failed: number;
}> {
  const startMs = Date.now();
  let processed = 0, holdingsWritten = 0, failed = 0;
  seedLog("MF_HOLDINGS_START", { batchSize });

  if (!irisKfintechService.isConfigured) {
    seedLog("MF_HOLDINGS_SKIP", { reason: "IRIS not configured" }, "warn");
    return { processed: 0, holdingsWritten: 0, failed: 0 };
  }

  const schemes = await db
    .select({ schemeCode: mutualFunds.schemeCode, isin: mutualFunds.isin })
    .from(mutualFunds)
    .where(sql`scheme_code IS NOT NULL AND scheme_status = 'active'`)
    .orderBy(sql`last_updated ASC NULLS FIRST`)
    .limit(batchSize);

  seedLog("MF_HOLDINGS_SCHEMES", { count: schemes.length });

  for (const { schemeCode, isin } of schemes) {
    if (!schemeCode) continue;
    try {
      const resp = await irisKfintechService.getSchemeHoldings(schemeCode);
      const holdings: any[] = Array.isArray(resp) ? resp : (resp?.holdings ?? resp?.data ?? []);
      const holdingDate = new Date().toISOString().split("T")[0];

      for (const h of holdings) {
        if (!h.symbol && !h.isin && !h.stockName) continue;
        const mfIsinValue = (isin ?? schemeCode)!; // schemeCode already guarded above
        try {
          await db
            .insert(mfSchemeStockHoldings)
            .values({
              mfIsin:            mfIsinValue,
              stockSymbol:       h.symbol ?? h.stockSymbol ?? h.isin ?? "",
              stockName:         h.name ?? h.stockName ?? null,
              stockIsin:         h.isin ?? h.stockIsin ?? null,
              sector:            h.sector ?? h.sectorName ?? null,
              holdingPercentage: String(h.percentage ?? h.holdingPercentage ?? h.weight ?? 0),
              holdingDate,
              marketValue:       toDecStr(h.marketValue ?? h.value),
              quantity:          toDecStr(h.quantity ?? h.units),
              source:            "iris",
            })
            .onConflictDoUpdate({
              target: [
                mfSchemeStockHoldings.mfIsin,
                mfSchemeStockHoldings.stockSymbol,
                mfSchemeStockHoldings.holdingDate,
              ],
              set: {
                holdingPercentage: sql`excluded.holding_percentage`,
                marketValue:       sql`excluded.market_value`,
                quantity:          sql`excluded.quantity`,
                sector:            sql`excluded.sector`,
                source:            sql`excluded.source`,
                updatedAt:         sql`now()`,
              },
            });
          holdingsWritten++;
        } catch (rowErr: any) {
          seedLog("MF_HOLDINGS_ROW_ERR", { schemeCode, error: rowErr.message }, "warn");
        }
      }
      processed++;
    } catch (err: any) {
      failed++;
      seedLog("MF_HOLDINGS_SCHEME_FAILED", { schemeCode, error: err.message }, "warn");
    }
    await sleep(100);
  }

  seedLog("MF_HOLDINGS_DONE", { processed, holdingsWritten, failed, latency_ms: Date.now() - startMs });
  return { processed, holdingsWritten, failed };
}

// ─── Job 4b: MF Factsheet Enrichment ─────────────────────────────────────────

export async function enrichMfFactsheets(batchSize = 200): Promise<{
  processed: number; updated: number; failed: number;
}> {
  const startMs = Date.now();
  let processed = 0, updated = 0, failed = 0;
  seedLog("MF_FACTSHEET_START", { batchSize });

  if (!irisKfintechService.isConfigured) {
    seedLog("MF_FACTSHEET_SKIP", { reason: "IRIS not configured" }, "warn");
    return { processed: 0, updated: 0, failed: 0 };
  }

  const schemes = await db
    .select({ schemeCode: mutualFunds.schemeCode, isin: mutualFunds.isin })
    .from(mutualFunds)
    .where(sql`scheme_code IS NOT NULL AND scheme_status = 'active' AND kfintech_id IS NULL`)
    .orderBy(sql`last_updated ASC NULLS FIRST`)
    .limit(batchSize);

  seedLog("MF_FACTSHEET_SCHEMES", { count: schemes.length });

  for (const { schemeCode } of schemes) {
    if (!schemeCode) continue;
    try {
      const fs = await irisKfintechService.getSchemeFactSheet(schemeCode);
      if (!fs) { processed++; continue; }

      const updateData: Record<string, any> = {};

      const kfintechId = fs.kfintechId ?? fs.schemeId ?? fs.fundId ?? null;
      if (kfintechId)  updateData.kfintechId  = String(kfintechId).slice(0, 100);

      const er = toNum(fs.expenseRatio ?? fs.ter ?? fs.totalExpenseRatio);
      if (er != null)  updateData.expenseRatio = String(er);

      const fm = fs.fundManager ?? fs.fundManagerName ?? null;
      if (fm)          updateData.fundManager  = String(fm).slice(0, 200);

      const folio = fs.folioNature ?? fs.accountType ?? null;
      if (folio)       updateData.folioNature  = String(folio).slice(0, 50);

      if (Object.keys(updateData).length > 0) {
        await db.update(mutualFunds)
          .set({ ...updateData, lastUpdated: new Date() })
          .where(eq(mutualFunds.schemeCode, schemeCode));
        updated++;
      }
      processed++;
    } catch (err: any) {
      failed++;
      seedLog("MF_FACTSHEET_FAILED", { schemeCode, error: err.message }, "warn");
    }
    await sleep(120);
  }

  seedLog("MF_FACTSHEET_DONE", { processed, updated, failed, latency_ms: Date.now() - startMs });
  return { processed, updated, failed };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Master orchestrator — called from jobs/enrichment.ts Phase D.
 * Runs all 5 seeding sub-jobs; each is independently non-fatal.
 */
export async function runAllSeedingJobs(): Promise<void> {
  const startMs = Date.now();
  seedLog("ALL_SEED_START", { jobs: 5, event: "IRIS_SEED_START", user_id: "system", status: "running", latency_ms: 0 });

  try { await seedFdProducts();          } catch (e: any) { seedLog("FD_FATAL",       { error: e.message }, "error"); }
  try { await seedNpsFunds();            } catch (e: any) { seedLog("NPS_FATAL",      { error: e.message }, "error"); }
  try { await seedPmsAifProducts();      } catch (e: any) { seedLog("PMS_AIF_FATAL",  { error: e.message }, "error"); }
  try { await enrichMfHoldings(200);    } catch (e: any) { seedLog("MF_HOLD_FATAL",  { error: e.message }, "error"); }
  try { await enrichMfFactsheets(200);  } catch (e: any) { seedLog("MF_FACT_FATAL",  { error: e.message }, "error"); }

  seedLog("ALL_SEED_DONE", { latency_ms: Date.now() - startMs, event: "IRIS_SEED_DONE", user_id: "system", status: "success" });
}
