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
      mf.scheme_code::text, mf.scheme_name,
      CASE 
        WHEN (mf.category ILIKE '%ETF%' OR mf.scheme_name ILIKE '%ETF%') AND mf.scheme_name NOT ILIKE '%FOF%' THEN 'etf'
        WHEN mf.category ILIKE '%SIF%' OR mf.scheme_name ILIKE '%SIF%' OR mf.scheme_name ILIKE '%Specialised Investment%' OR mf.scheme_name ILIKE '%Specialized Investment%' THEN 'sif'
        ELSE 'mutual_fund'
      END AS asset_class,
      mf.plan_type,
      CASE 
        WHEN (mf.category ILIKE '%ETF%' OR mf.scheme_name ILIKE '%ETF%') AND mf.scheme_name NOT ILIKE '%FOF%' THEN 'ETF'
        ELSE mf.category
      END AS category,
      mf.fund_house,
      mf.nav::text, mf.updated_at,
      COALESCE(mf.is_active, true), 'amfi', NOW(), NOW()
    FROM mutual_funds mf WHERE mf.scheme_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type,
      asset_class=EXCLUDED.asset_class,
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

async function syncDerivatives(): Promise<number> {
  return runUpsert("derivative_contracts", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      dc.instrument_key AS isin,
      dc.tradingsymbol AS symbol,
      dc.tradingsymbol || ' (' || dc.instrument_type || ')' AS name,
      'derivative' AS asset_class,
      dc.instrument_type AS sub_type,
      'Expiry: ' || dc.expiry_date::text || ' | Lot: ' || dc.lot_size::text AS category,
      dc.name AS issuer,
      dc.strike_price::text AS last_price,
      dc.updated_at AS price_updated_at,
      dc.is_active,
      COALESCE(dc.source, 'upstox') AS source,
      NOW(), NOW()
    FROM derivative_contracts dc WHERE dc.instrument_key IS NOT NULL AND dc.tradingsymbol IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      name=EXCLUDED.name, sub_type=EXCLUDED.sub_type, category=EXCLUDED.category,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      is_active=EXCLUDED.is_active, updated_at=NOW()
  `);
}

/** Syncs US Equities & ETFs from global_instruments (Alpaca Data/Broker source) */
async function syncGlobalInstruments(): Promise<number> {
  return runUpsert("global_instruments", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       country, currency, last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      COALESCE(gi.isin, 'US-' || gi.symbol) AS isin,
      gi.symbol,
      gi.name,
      CASE WHEN LOWER(gi.asset_class) = 'etf' THEN 'etf' ELSE 'us_equity' END AS asset_class,
      gi.market_cap_category AS sub_type,
      COALESCE(gi.sector, 'US Equity') AS category,
      COALESCE(gi.exchange, 'NASDAQ') AS issuer,
      COALESCE(gi.market, 'US') AS country,
      COALESCE(gi.currency, 'USD') AS currency,
      gi.last_price::text,
      COALESCE(gi.last_updated, NOW()),
      COALESCE(gi.is_active, true),
      COALESCE(gi.trading_api_provider, gi.data_source, 'alpaca') AS source,
      NOW(), NOW()
    FROM global_instruments gi WHERE gi.symbol IS NOT NULL AND gi.name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      symbol=EXCLUDED.symbol, name=EXCLUDED.name,
      asset_class=EXCLUDED.asset_class, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer,
      country=EXCLUDED.country, currency=EXCLUDED.currency,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      is_active=EXCLUDED.is_active, source=EXCLUDED.source, updated_at=NOW()
  `);
}

/** Syncs Corporate & Bank Fixed Deposits from KFintech IRIS */
async function syncIrisFixedDeposits(): Promise<number> {
  return runUpsert("iris_fd_products", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       country, currency, last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      'FD-' || ifd.iris_product_id AS isin,
      COALESCE(ifd.product_code, ifd.iris_product_id) AS symbol,
      ifd.product_name AS name,
      'fixed_deposit' AS asset_class,
      ifd.category AS sub_type,
      'Fixed Deposit' AS category,
      ifd.issuer_name AS issuer,
      'IN' AS country,
      'INR' AS currency,
      ifd.interest_rate::text AS last_price,
      ifd.updated_at AS price_updated_at,
      true AS is_active,
      'iris' AS source,
      NOW(), NOW()
    FROM iris_fd_products ifd WHERE ifd.iris_product_id IS NOT NULL AND ifd.product_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      symbol=EXCLUDED.symbol, name=EXCLUDED.name,
      asset_class=EXCLUDED.asset_class, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      is_active=EXCLUDED.is_active, source=EXCLUDED.source, updated_at=NOW()
  `);
}

/** Syncs NPS (National Pension System) Funds from KFintech IRIS */
async function syncIrisNps(): Promise<number> {
  return runUpsert("iris_nps_funds", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       country, currency, last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      'NPS-' || inf.iris_fund_code AS isin,
      inf.iris_fund_code AS symbol,
      inf.fund_manager_name || ' (Tier ' || inf.tier || ')' AS name,
      'nps' AS asset_class,
      inf.tier AS sub_type,
      COALESCE(inf.scheme_type, 'NPS') AS category,
      inf.fund_manager_name AS issuer,
      'IN' AS country,
      'INR' AS currency,
      inf.return_1y::text AS last_price,
      inf.updated_at AS price_updated_at,
      true AS is_active,
      'iris' AS source,
      NOW(), NOW()
    FROM iris_nps_funds inf WHERE inf.iris_fund_code IS NOT NULL AND inf.fund_manager_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      symbol=EXCLUDED.symbol, name=EXCLUDED.name,
      asset_class=EXCLUDED.asset_class, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer,
      last_price=EXCLUDED.last_price, price_updated_at=EXCLUDED.price_updated_at,
      is_active=EXCLUDED.is_active, source=EXCLUDED.source, updated_at=NOW()
  `);
}

/** Syncs PMS & AIF products from KFintech IRIS */
async function syncIrisPmsAif(): Promise<number> {
  return runUpsert("iris_pms_aif_products", sql`
    INSERT INTO instrument_master
      (isin, symbol, name, asset_class, sub_type, category, issuer,
       country, currency, last_price, price_updated_at, is_active, source, created_at, updated_at)
    SELECT
      'PMS-' || ipa.iris_product_id AS isin,
      ipa.iris_product_id AS symbol,
      ipa.strategy_name AS name,
      CASE 
        WHEN LOWER(ipa.product_type) = 'sif' OR ipa.sebi_category ILIKE '%SIF%' OR ipa.strategy_name ILIKE '%SIF%' THEN 'sif'
        WHEN LOWER(ipa.product_type) = 'aif' THEN 'aif' 
        ELSE 'pms' 
      END AS asset_class,
      ipa.sebi_category AS sub_type,
      ipa.strategy_type AS category,
      ipa.fund_house AS issuer,
      'IN' AS country,
      'INR' AS currency,
      ipa.min_investment::text AS last_price,
      NOW() AS price_updated_at,
      true AS is_active,
      'iris' AS source,
      NOW(), NOW()
    FROM iris_pms_aif_products ipa WHERE ipa.iris_product_id IS NOT NULL AND ipa.strategy_name IS NOT NULL
    ON CONFLICT (isin) DO UPDATE SET
      symbol=EXCLUDED.symbol, name=EXCLUDED.name,
      asset_class=EXCLUDED.asset_class, sub_type=EXCLUDED.sub_type,
      category=EXCLUDED.category, issuer=EXCLUDED.issuer,
      last_price=EXCLUDED.last_price, is_active=EXCLUDED.is_active,
      source=EXCLUDED.source, updated_at=NOW()
  `);
}

/** Auto-populates instrument_vendor_mappings for Upstox, IRIS, and Alpaca */
async function syncVendorMappings(): Promise<number> {
  let mapped = 0;

  // 1. Upstox Listed Stocks Mapping (from listed_stocks with upstox_instrument_key)
  mapped += await runUpsert("ivm_upstox_stocks", sql`
    INSERT INTO instrument_vendor_mappings
      (isin, vendor, vendor_symbol, vendor_instrument_token, feed_role, is_active, sync_status, source, created_at, updated_at)
    SELECT
      ls.isin, 'upstox', ls.symbol, ls.upstox_instrument_key, 'PRIMARY_QUOTE', true, 'synced', 'upstox_sync', NOW(), NOW()
    FROM listed_stocks ls
    WHERE ls.isin IS NOT NULL AND ls.upstox_instrument_key IS NOT NULL
    ON CONFLICT (vendor, vendor_instrument_token) DO UPDATE SET
      isin=EXCLUDED.isin, vendor_symbol=EXCLUDED.vendor_symbol, updated_at=NOW()
  `);

  // 2. Upstox Derivatives Mapping
  mapped += await runUpsert("ivm_upstox_derivatives", sql`
    INSERT INTO instrument_vendor_mappings
      (isin, vendor, vendor_symbol, vendor_instrument_token, feed_role, is_active, sync_status, source, created_at, updated_at)
    SELECT
      dc.instrument_key, 'upstox', dc.tradingsymbol, dc.instrument_key, 'PRIMARY_QUOTE', true, 'synced', 'upstox_sync', NOW(), NOW()
    FROM derivative_contracts dc
    WHERE dc.instrument_key IS NOT NULL
    ON CONFLICT (vendor, vendor_instrument_token) DO UPDATE SET
      isin=EXCLUDED.isin, vendor_symbol=EXCLUDED.vendor_symbol, updated_at=NOW()
  `);

  // 3. Alpaca US Stocks Mapping
  mapped += await runUpsert("ivm_alpaca_stocks", sql`
    INSERT INTO instrument_vendor_mappings
      (isin, vendor, vendor_symbol, vendor_instrument_token, feed_role, is_active, sync_status, source, created_at, updated_at)
    SELECT
      COALESCE(gi.isin, 'US-' || gi.symbol), 'alpaca', gi.symbol, gi.symbol, 'PRIMARY_QUOTE', true, 'synced', 'alpaca_sync', NOW(), NOW()
    FROM global_instruments gi
    WHERE gi.symbol IS NOT NULL
    ON CONFLICT (vendor, vendor_instrument_token) DO UPDATE SET
      isin=EXCLUDED.isin, vendor_symbol=EXCLUDED.vendor_symbol, updated_at=NOW()
  `);

  // 4. IRIS Fixed Deposit Mapping
  mapped += await runUpsert("ivm_iris_fd", sql`
    INSERT INTO instrument_vendor_mappings
      (isin, vendor, vendor_symbol, vendor_instrument_token, feed_role, is_active, sync_status, source, created_at, updated_at)
    SELECT
      'FD-' || ifd.iris_product_id, 'iris', ifd.product_code, ifd.iris_product_id, 'PRIMARY_QUOTE', true, 'synced', 'iris_sync', NOW(), NOW()
    FROM iris_fd_products ifd
    WHERE ifd.iris_product_id IS NOT NULL
    ON CONFLICT (vendor, vendor_instrument_token) DO UPDATE SET
      isin=EXCLUDED.isin, vendor_symbol=EXCLUDED.vendor_symbol, updated_at=NOW()
  `);

  // 5. IRIS NPS Mapping
  mapped += await runUpsert("ivm_iris_nps", sql`
    INSERT INTO instrument_vendor_mappings
      (isin, vendor, vendor_symbol, vendor_instrument_token, feed_role, is_active, sync_status, source, created_at, updated_at)
    SELECT
      'NPS-' || inf.iris_fund_code, 'iris', inf.pfm_code, inf.iris_fund_code, 'PRIMARY_QUOTE', true, 'synced', 'iris_sync', NOW(), NOW()
    FROM iris_nps_funds inf
    WHERE inf.iris_fund_code IS NOT NULL
    ON CONFLICT (vendor, vendor_instrument_token) DO UPDATE SET
      isin=EXCLUDED.isin, vendor_symbol=EXCLUDED.vendor_symbol, updated_at=NOW()
  `);

  return mapped;
}

/** Orchestrates all asset-class syncs and returns row counts. */
export async function syncInstrumentMaster() {
  const start = Date.now();
  logger.info("instrument_master sync started", { event: "INSTRUMENT_MASTER_SYNC_START" });

  // Ensure unique index exists (idempotent)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instrument_master_isin ON instrument_master (isin)
  `).catch(() => {/* already exists */});

  const r = {
    mutualFunds: 0,
    stocks: 0,
    bonds: 0,
    reits: 0,
    aif: 0,
    mld: 0,
    derivatives: 0,
    globalStocks: 0,
    irisFd: 0,
    irisNps: 0,
    irisPmsAif: 0,
    vendorMappings: 0,
    total: 0,
    durationMs: 0,
  };

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
  await run("derivatives", syncDerivatives);
  await run("globalStocks", syncGlobalInstruments);
  await run("irisFd", syncIrisFixedDeposits);
  await run("irisNps", syncIrisNps);
  await run("irisPmsAif", syncIrisPmsAif);
  await run("vendorMappings", syncVendorMappings);

  r.total =
    r.mutualFunds +
    r.stocks +
    r.bonds +
    r.reits +
    r.aif +
    r.mld +
    r.derivatives +
    r.globalStocks +
    r.irisFd +
    r.irisNps +
    r.irisPmsAif;
  r.durationMs = Date.now() - start;

  logger.info(
    `instrument_master sync complete: ${r.total} rows (${r.vendorMappings} vendor mappings) in ${r.durationMs}ms`,
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
