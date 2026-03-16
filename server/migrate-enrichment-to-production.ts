import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

interface MigrationResult {
  table: string;
  devCount: number;
  prodCountBefore: number;
  migrated: number;
  errors: number;
  prodCountAfter: number;
}

async function migrateTable(
  devDb: any,
  prodDb: any,
  tableName: string,
  columns: string[],
  idColumn: string = 'id',
  batchSize: number = 200
): Promise<MigrationResult> {
  console.log(`\n📋 Migrating: ${tableName}`);

  const devCountRes = await devDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const devCount = parseInt(String((devCountRes.rows[0] as any)?.cnt || '0'));

  const prodCountRes = await prodDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const prodCountBefore = parseInt(String((prodCountRes.rows[0] as any)?.cnt || '0'));

  console.log(`   Dev: ${devCount} | Prod: ${prodCountBefore}`);

  if (devCount <= prodCountBefore) {
    console.log(`   ✅ Production already has equal or more rows. Skipping.`);
    return { table: tableName, devCount, prodCountBefore, migrated: 0, errors: 0, prodCountAfter: prodCountBefore };
  }

  const prodIdsRes = await prodDb.execute(sql.raw(`SELECT ${idColumn} FROM ${tableName}`));
  const existingIds = new Set((prodIdsRes.rows as any[]).map(r => r[idColumn]));

  const colList = columns.join(', ');
  const allRows = await devDb.execute(sql.raw(`SELECT ${colList} FROM ${tableName} ORDER BY ${idColumn}`));
  const newRows = (allRows.rows as any[]).filter(r => !existingIds.has(r[idColumn]));

  console.log(`   New rows to migrate: ${newRows.length}`);

  if (newRows.length === 0) {
    return { table: tableName, devCount, prodCountBefore, migrated: 0, errors: 0, prodCountAfter: prodCountBefore };
  }

  let migrated = 0;
  let errors = 0;

  for (let i = 0; i < newRows.length; i += batchSize) {
    const batch = newRows.slice(i, i + batchSize);

    for (const row of batch) {
      try {
        const values = columns.map(col => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'number') return String(val);
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') {
            const jsonStr = JSON.stringify(val).replace(/'/g, "''");
            return `'${jsonStr}'::jsonb`;
          }
          const escaped = String(val).replace(/'/g, "''").replace(/\\/g, '\\\\');
          return `'${escaped}'`;
        }).join(', ');

        await prodDb.execute(
          sql`INSERT INTO ${sql.identifier(tableName)} (${sql.raw(colList)}) VALUES (${sql.raw(values)}) ON CONFLICT (${sql.identifier(idColumn)}) DO NOTHING`
        );
        migrated++;
      } catch (err: any) {
        errors++;
        if (errors <= 3) {
          console.error(`   ⚠️ Error: ${err.message.substring(0, 120)}`);
        }
      }
    }

    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(newRows.length / batchSize);
    if (batchNum % 5 === 0 || batchNum === totalBatches) {
      console.log(`   Batch ${batchNum}/${totalBatches}: ${migrated} migrated, ${errors} errors`);
    }
  }

  const prodCountAfterRes = await prodDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const prodCountAfter = parseInt(String((prodCountAfterRes.rows[0] as any)?.cnt || '0'));

  console.log(`   ✅ Done: ${migrated} migrated, ${errors} errors. Prod now: ${prodCountAfter}`);
  return { table: tableName, devCount, prodCountBefore, migrated, errors, prodCountAfter };
}

async function migrateHistoricalNav(devDb: any, prodDb: any): Promise<MigrationResult> {
  const tableName = 'historical_nav_data';
  console.log(`\n📋 Migrating: ${tableName} (large table - by scheme)`);

  const devCountRes = await devDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const devCount = parseInt(String((devCountRes.rows[0] as any)?.cnt || '0'));
  const prodCountRes = await prodDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const prodCountBefore = parseInt(String((prodCountRes.rows[0] as any)?.cnt || '0'));
  console.log(`   Dev: ${devCount} | Prod: ${prodCountBefore} | Gap: ${devCount - prodCountBefore}`);

  const devSchemes = await devDb.execute(sql.raw(
    `SELECT DISTINCT scheme_code FROM ${tableName}`
  ));
  const prodSchemes = await prodDb.execute(sql.raw(
    `SELECT DISTINCT scheme_code FROM ${tableName}`
  ));

  const devSchemeSet = new Set((devSchemes.rows as any[]).map(r => r.scheme_code));
  const prodSchemeSet = new Set((prodSchemes.rows as any[]).map(r => r.scheme_code));

  const missingSchemes = [...devSchemeSet].filter(s => !prodSchemeSet.has(s));
  console.log(`   Missing schemes in prod: ${missingSchemes.length} (of ${devSchemeSet.size} total)`);

  let migrated = 0;
  let errors = 0;

  for (let si = 0; si < missingSchemes.length; si++) {
    const scheme = missingSchemes[si];
    try {
      const rows = await devDb.execute(
        sql`SELECT id, scheme_code, nav_date, nav_value, created_at FROM ${sql.raw(tableName)} WHERE scheme_code = ${scheme}`
      );

      for (const row of rows.rows as any[]) {
        try {
          const navDate = row.nav_date instanceof Date ? row.nav_date.toISOString().split('T')[0] : row.nav_date;
          const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : (row.created_at ?? null);

          await prodDb.execute(
            sql`INSERT INTO ${sql.raw(tableName)} (id, scheme_code, nav_date, nav_value, created_at) VALUES (${row.id}, ${row.scheme_code}, ${navDate}, ${row.nav_value}, ${createdAt ?? sql`NOW()`}) ON CONFLICT (id) DO NOTHING`
          );
          migrated++;
        } catch {
          errors++;
        }
      }

      if ((si + 1) % 5 === 0 || si === missingSchemes.length - 1) {
        console.log(`   Scheme ${si + 1}/${missingSchemes.length}: ${migrated} rows migrated`);
      }
    } catch (err: any) {
      console.error(`   ⚠️ Scheme ${scheme} failed: ${err.message.substring(0, 100)}`);
      errors++;
    }
  }

  const schemesWithGaps = [...prodSchemeSet].slice(0, 20);
  let gapRows = 0;
  for (const scheme of schemesWithGaps) {
    try {
      const devDates = await devDb.execute(
        sql`SELECT COUNT(*) as cnt FROM ${sql.raw(tableName)} WHERE scheme_code = ${scheme}`
      );
      const prodDates = await prodDb.execute(
        sql`SELECT COUNT(*) as cnt FROM ${sql.raw(tableName)} WHERE scheme_code = ${scheme}`
      );
      const devN = parseInt(String((devDates.rows[0] as any)?.cnt || '0'));
      const prodN = parseInt(String((prodDates.rows[0] as any)?.cnt || '0'));
      if (devN > prodN) {
        gapRows += (devN - prodN);
      }
    } catch {}
  }
  if (gapRows > 0) {
    console.log(`   ℹ️ Also found ${gapRows} missing date rows in existing schemes (sampling 20 schemes)`);
  }

  const prodCountAfterRes = await prodDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${tableName}`));
  const prodCountAfter = parseInt(String((prodCountAfterRes.rows[0] as any)?.cnt || '0'));
  console.log(`   ✅ Done: ${migrated} migrated, ${errors} errors. Prod now: ${prodCountAfter}`);

  return { table: tableName, devCount, prodCountBefore, migrated, errors, prodCountAfter };
}

async function main(): Promise<void> {
  const devDbUrl = process.env.DATABASE_URL;
  const prodDbUrl = process.env.PRODUCTION_DATABASE_URL;

  if (!devDbUrl || !prodDbUrl) {
    console.error("ERROR: DATABASE_URL and PRODUCTION_DATABASE_URL must be set");
    process.exit(1);
  }

  console.log("🔧 Connecting to databases...");
  const devPool = new Pool({ connectionString: devDbUrl });
  const devDb = drizzle(devPool);
  const prodPool = new Pool({ connectionString: prodDbUrl });
  const prodDb = drizzle(prodPool);

  const results: MigrationResult[] = [];

  try {
    results.push(await migrateTable(devDb, prodDb, 'instrument_master', [
      'id', 'isin', 'symbol', 'name', 'short_name', 'asset_class', 'sub_type', 'category',
      'issuer', 'sector', 'last_price', 'currency', 'price_source', 'price_updated_at',
      'face_value', 'maturity_date', 'credit_rating', 'risk_level', 'source_table', 'source_id',
      'is_active', 'metadata', 'created_at', 'updated_at', 'region', 'country', 'exchange', 'market_type'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'screener_derived_metrics', [
      'id', 'symbol', 'growth_score', 'quality_score', 'value_score', 'risk_score',
      'composite_score', 'fintek_rating', 'momentum_score', 'revenue_growth_3y',
      'earnings_growth_3y', 'scoring_metadata', 'last_calculated', 'created_at'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'screener_financials', [
      'id', 'symbol', 'period', 'fiscal_year', 'fiscal_date', 'pe_ratio', 'pb_ratio',
      'ev_to_ebitda', 'price_to_sales', 'roe', 'roce', 'roa', 'net_profit_margin',
      'operating_margin', 'gross_margin', 'debt_to_equity', 'current_ratio', 'quick_ratio',
      'interest_coverage', 'eps', 'book_value', 'dividend_yield', 'dividend_payout',
      'revenue_growth', 'earnings_growth', 'free_cash_flow_per_share', 'revenue', 'net_income',
      'total_debt', 'total_equity', 'total_assets', 'operating_cash_flow', 'free_cash_flow',
      'capital_expenditure', 'last_updated', 'created_at', 'return_1y', 'return_2y',
      'return_3y', 'return_5y'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'mf_scheme_exit_loads', [
      'id', 'scheme_code', 'isin', 'tier', 'min_days', 'max_days', 'exit_load_percent',
      'description', 'source_url', 'last_verified', 'created_at', 'updated_at'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'global_instruments', [
      'id', 'symbol', 'name', 'asset_class', 'exchange', 'market', 'currency', 'isin',
      'cusip', 'sedol', 'sector', 'industry', 'market_cap', 'market_cap_category',
      'dividend_yield', 'expense_ratio', 'aum', 'maturity_date', 'coupon_rate',
      'credit_rating', 'yield_to_maturity', 'domicile', 'is_active', 'lrs_eligible',
      'fatca_compliant', 'last_price', 'last_price_inr', 'price_change_percent',
      'week_52_high', 'week_52_low', 'avg_volume', 'beta', 'pe_ratio', 'pb_ratio',
      'eps_growth', 'returns_1m', 'returns_3m', 'returns_1y', 'returns_3y', 'returns_5y',
      'data_source', 'last_updated', 'created_at', 'api_symbol', 'is_tradeable',
      'lot_size', 'trading_api_provider', 'bid_price', 'ask_price', 'trading_hours', 'api_config'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'sgb_primary_issues', [
      'id', 'series_code', 'series_name', 'issue_open_date', 'issue_close_date',
      'issue_price_per_gram', 'gold_weight_grams', 'minimum_investment_grams',
      'maximum_investment_grams', 'interest_rate', 'tenor_years', 'premature_exit_year',
      'listing_date', 'issue_status', 'subscription_type', 'discount_on_digital',
      'created_at', 'last_updated', 'tranche_number', 'fiscal_year', 'issue_name',
      'issue_year', 'minimum_grams', 'maximum_grams', 'gold_purity',
      'redemption_period_years', 'early_redemption_year', 'subscription_modes',
      'discount_digital', 'application_link', 'settlement_date', 'date_of_issuance',
      'discount_online_payment', 'effective_price', 'gold_reference_price',
      'gold_reference_period_start', 'gold_reference_period_end',
      'maximum_individual_limit', 'maximum_huf_limit', 'maximum_trust_limit',
      'early_redemption_allowed', 'early_redemption_from_year', 'capital_gains_tax_exempt',
      'interest_taxable', 'application_channels', 'rbi_notification_number',
      'rbi_notification_date', 'data_source', 'maturity_date', 'issue_price',
      'interest_payment_frequency', 'minimum_investment'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'corporate_bonds', [
      'id', 'isin', 'security_code', 'bond_name', 'issuer', 'bond_type', 'face_value',
      'coupon_type', 'coupon_rate', 'coupon_frequency', 'issue_date', 'maturity_date',
      'tenor_years', 'issue_price', 'current_price', 'yield_to_maturity', 'yield_to_call',
      'listing_date', 'trading_status', 'minimum_lot_size', 'minimum_investment',
      'is_callable', 'call_date', 'call_price', 'is_puttable', 'put_date', 'put_price',
      'secured', 'security_type', 'collateral_type', 'credit_rating', 'rating_agency',
      'rating_date', 'outlook_status', 'duration', 'modified_duration', 'convexity',
      'last_traded_price', 'last_traded_date', 'volume', 'turnover', 'issuer_sector',
      'issuer_industry', 'issuer_credit_rating', 'tax_status', 'tax_benefit_section',
      'tax_benefit_details', 'indexation_benefit', 'infrastructure_sector', 'project_name',
      'utilization_purpose', 'sebi_approved', 'special_features', 'lockin_period',
      'data_source', 'last_updated', 'created_at', 'markup', 'markup_type', 'final_price',
      'is_perpetual', 'instrument_status', 'is_listed', 'liquidity_score', 'rating_current',
      'rating_trend', 'structure_complexity', 'regulatory_eligibility', 'bid_ask_spread',
      'status_reason', 'status_last_updated'
    ]));

    results.push(await migrateTable(devDb, prodDb, 'bond_calendar_events', [
      'id', 'event_type', 'event_title', 'event_description', 'event_date', 'event_time',
      'end_date', 'isin', 'instrument_name', 'instrument_type', 'issuer_name', 'issuer_type',
      'face_value', 'issue_size', 'coupon_rate', 'yield_indicative', 'credit_rating',
      'min_investment', 'max_investment', 'lot_size', 'retail_quota', 'source', 'source_url',
      'external_id', 'status', 'is_highlighted', 'tags', 'additional_info', 'created_at',
      'updated_at', 'last_synced_at'
    ]));

    results.push(await migrateHistoricalNav(devDb, prodDb));

    console.log('\n' + '='.repeat(70));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(70));
    console.log(`${'Table'.padEnd(30)} ${'Dev'.padStart(10)} ${'Prod Before'.padStart(12)} ${'Migrated'.padStart(10)} ${'Errors'.padStart(8)} ${'Prod After'.padStart(12)}`);
    console.log('-'.repeat(82));
    for (const r of results) {
      console.log(`${r.table.padEnd(30)} ${String(r.devCount).padStart(10)} ${String(r.prodCountBefore).padStart(12)} ${String(r.migrated).padStart(10)} ${String(r.errors).padStart(8)} ${String(r.prodCountAfter).padStart(12)}`);
    }
    console.log('='.repeat(70));

  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main();
