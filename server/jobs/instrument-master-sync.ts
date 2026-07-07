/**
 * instrument-master-sync.ts
 *
 * Nightly job: upserts from all authoritative asset tables into instrument_master.
 * instrument_master is the single read point for /api/instruments/search.
 *
 * Schedule: nightly at 02:00 IST, or on-boot if instrument_master is empty.
 */

import { db } from "../db";
import { logger } from "../logger";
import { sql } from "drizzle-orm";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function runUpsert(label: string, query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  return (result as any).rowCount ?? 0;
}

async function syncMutualFunds(): Promise<number> {
  return runUpsert("mutual_funds", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      COALESCE(mf.isin, 'MF' || mf.scheme_code)  AS isin,
      mf.scheme_code::text, mf.scheme_name, 'mutual_fund',
      mf.plan_type, mf.category, mf.fund_house,
      mf.nav::text, mf.updated_at,
      COALESCE(mf.is_active, true), 'amfi', NOW(), NOW()
    FROM mutual_funds mf WHERE mf.scheme_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      updated_at=NOW()
  `);
}

async function syncListedStocks(): Promise<number> {
  return runUpsert("listed_stocks", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category,
       last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      ls.isin, ls.symbol, ls.company_name, 'equity',
      ls.market_cap, ls.sector, ls.current_price::text, ls.last_updated,
      ls.is_active, COALESCE(ls.data_source,'nse'), NOW(), NOW()
    FROM listed_stocks ls WHERE ls.isin IS NOT NULL AND ls.company_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type, category=EXCLUDED.category,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      updated_at=NOW()
  `);
}

async function syncBonds(): Promise<number> {
  return runUpsert("bond_catalog", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      bc.isin, COALESCE(bc.security_code, bc.isin), bc.bond_name, 'bond',
      bc.instrument_type, bc.instrument_type, bc.issuer_name,
      COALESCE(bc.current_price, bc.clean_price)::text, bc.updated_at,
      (bc.status='published'), COALESCE(bc.source,'nse'), NOW(), NOW()
    FROM bond_catalog bc WHERE bc.isin IS NOT NULL AND bc.bond_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type, issuer=EXCLUDED.issuer,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      is_active=EXCLUDED.is_active, updated_at=NOW()
  `);
}

async function syncReits(): Promise<number> {
  return runUpsert("reits", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       is_active, source, created_at, updated_at)
    SELECT
      r.isin_code, r.symbol, r.name, 'reit',
      r.type, COALESCE(r.property_type, r.sector), r.manager,
      true, 'bse', NOW(), NOW()
    FROM reits r WHERE r.isin_code IS NOT NULL AND r.name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, issuer=EXCLUDED.issuer,
      sub_type=EXCLUDED.sub_type, category=EXCLUDED.category, updated_at=NOW()
  `);
}

async function syncAif(): Promise<number> {
  return runUpsert("aif_master", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       is_active, source, created_at, updated_at)
    SELECT
      COALESCE(am.isin, 'AIF-' || am.id::text), am.registration_no,
      am.name, 'aif', am.category, am.subcategory, am.fund_house_name,
      true, 'iris', NOW(), NOW()
    FROM aif_master am WHERE am.name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer, updated_at=NOW()
  `);
}

async function syncMld(): Promise<number> {
  return runUpsert("mld_master", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       is_active, source, created_at, updated_at)
    SELECT
      mm.isin, mm.isin, mm.name, 'mld',
      mm.payoff_type, mm.underlying, mm.issuer,
      true, 'manual', NOW(), NOW()
    FROM mld_master mm WHERE mm.isin IS NOT NULL AND mm.name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type,
      issuer=EXCLUDED.issuer, updated_at=NOW()
  `);
}

/** Orchestrates all 6 asset-class syncs and returns row counts. */
export async function syncInstrumentMaster() {
  const start = Date.now();
  logger.info("instrument_master sync started", { event: "INSTRUMENT_MASTER_SYNC_START" });

  // Ensure unique index exists (idempotent)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instrument_master_isin ON instrument_master (isin)
  `).catch(() => {/* already exists */});

  const r = { mutualFunds: 0, stocks: 0, bonds: 0, reits: 0, aif: 0, mld: 0, total: 0, durationMs: 0 };

  const run = async (key: keyof Omit<typeof r, "total"|"durationMs">, fn: () => Promise<number>) => {
    try { r[key] = await fn(); }
    catch (e: any) {
      logger.warn(`instrument_master ${key} sync failed`, { event: `IM_SYNC_${key.toUpperCase()}_ERROR`, error: String(e.message) });
    }
  };

  await run("mutualFunds", syncMutualFunds);
  await run("stocks", syncListedStocks);
  await run("bonds", syncBonds);
  await run("reits", syncReits);
  await run("aif", syncAif);
  await run("mld", syncMld);

  r.total = r.mutualFunds + r.stocks + r.bonds + r.reits + r.aif + r.mld;
  r.durationMs = Date.now() - start;

  logger.info(
    `instrument_master sync complete: ${r.total} rows in ${r.durationMs}ms`,
    { event: "INSTRUMENT_MASTER_SYNC_COMPLETE", ...r }
  );
  return r;
}

/** Schedules the nightly sync; also seeds on boot if table is empty. */
export async function scheduleInstrumentMasterSync(): Promise<void> {
  try {
    const res = await db.execute(sql`SELECT COUNT(*)::int AS cnt FROM instrument_master`);
    const count = Number((res as any).rows?.[0]?.cnt ?? 0);

    if (count === 0) {
      logger.info("instrument_master empty — running boot sync", { event: "IM_EMPTY_BOOT_SYNC" });
      syncInstrumentMaster().catch((e: Error) =>
        logger.error("instrument_master boot sync failed", { event: "IM_BOOT_SYNC_ERROR", error: String(e.message) })
      );
    } else {
      logger.info(`instrument_master has ${count} rows — boot sync skipped`, { event: "IM_ALREADY_SEEDED", count });
    }

    // Nightly at 02:00 IST = 20:30 UTC
    const now = new Date();
    const next = new Date();
    next.setUTCHours(20, 30, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);

    setTimeout(() => {
      syncInstrumentMaster().catch(() => {/* errors logged internally */});
      setInterval(() => syncInstrumentMaster().catch(() => {}), ONE_DAY_MS);
    }, next.getTime() - now.getTime());

    logger.info(`instrument_master nightly sync scheduled at ${next.toISOString()}`, { event: "IM_SYNC_SCHEDULED" });
  } catch (e: any) {
    logger.error("Failed to schedule instrument_master sync", { event: "IM_SCHEDULE_ERROR", error: String(e.message) });
  }
}
