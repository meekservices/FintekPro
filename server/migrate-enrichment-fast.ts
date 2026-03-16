import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const TABLE_NAME = process.argv[2] || '';

function escapeVal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

const TABLE_CONFIGS: Record<string, { columns: string[], id: string }> = {
  instrument_master: {
    id: 'id',
    columns: ['id','isin','symbol','name','short_name','asset_class','sub_type','category','issuer','sector','last_price','currency','price_source','price_updated_at','face_value','maturity_date','credit_rating','risk_level','source_table','source_id','is_active','metadata','created_at','updated_at','region','country','exchange','market_type']
  },
  screener_derived_metrics: {
    id: 'id',
    columns: ['id','symbol','growth_score','quality_score','value_score','risk_score','composite_score','fintek_rating','momentum_score','revenue_growth_3y','earnings_growth_3y','scoring_metadata','last_calculated','created_at']
  },
  screener_financials: {
    id: 'id',
    columns: ['id','symbol','period','fiscal_year','fiscal_date','pe_ratio','pb_ratio','ev_to_ebitda','price_to_sales','roe','roce','roa','net_profit_margin','operating_margin','gross_margin','debt_to_equity','current_ratio','quick_ratio','interest_coverage','eps','book_value','dividend_yield','dividend_payout','revenue_growth','earnings_growth','free_cash_flow_per_share','revenue','net_income','total_debt','total_equity','total_assets','operating_cash_flow','free_cash_flow','capital_expenditure','last_updated','created_at','return_1y','return_2y','return_3y','return_5y']
  },
  mf_scheme_exit_loads: {
    id: 'id',
    columns: ['id','scheme_code','isin','tier','min_days','max_days','exit_load_percent','description','source_url','last_verified','created_at','updated_at']
  },
  global_instruments: {
    id: 'id',
    columns: ['id','symbol','name','asset_class','exchange','market','currency','isin','cusip','sedol','sector','industry','market_cap','market_cap_category','dividend_yield','expense_ratio','aum','maturity_date','coupon_rate','credit_rating','yield_to_maturity','domicile','is_active','lrs_eligible','fatca_compliant','last_price','last_price_inr','price_change_percent','week_52_high','week_52_low','avg_volume','beta','pe_ratio','pb_ratio','eps_growth','returns_1m','returns_3m','returns_1y','returns_3y','returns_5y','data_source','last_updated','created_at','api_symbol','is_tradeable','lot_size','trading_api_provider','bid_price','ask_price','trading_hours','api_config']
  },
  sgb_primary_issues: {
    id: 'id',
    columns: ['id','series_code','series_name','issue_open_date','issue_close_date','issue_price_per_gram','gold_weight_grams','minimum_investment_grams','maximum_investment_grams','interest_rate','tenor_years','premature_exit_year','listing_date','issue_status','subscription_type','discount_on_digital','created_at','last_updated','tranche_number','fiscal_year','issue_name','issue_year','minimum_grams','maximum_grams','gold_purity','redemption_period_years','early_redemption_year','subscription_modes','discount_digital','application_link','settlement_date','date_of_issuance','discount_online_payment','effective_price','gold_reference_price','gold_reference_period_start','gold_reference_period_end','maximum_individual_limit','maximum_huf_limit','maximum_trust_limit','early_redemption_allowed','early_redemption_from_year','capital_gains_tax_exempt','interest_taxable','application_channels','rbi_notification_number','rbi_notification_date','data_source','maturity_date','issue_price','interest_payment_frequency','minimum_investment']
  },
  corporate_bonds: {
    id: 'id',
    columns: ['id','isin','security_code','bond_name','issuer','bond_type','face_value','coupon_type','coupon_rate','coupon_frequency','issue_date','maturity_date','tenor_years','issue_price','current_price','yield_to_maturity','yield_to_call','listing_date','trading_status','minimum_lot_size','minimum_investment','is_callable','call_date','call_price','is_puttable','put_date','put_price','secured','security_type','collateral_type','credit_rating','rating_agency','rating_date','outlook_status','duration','modified_duration','convexity','last_traded_price','last_traded_date','volume','turnover','issuer_sector','issuer_industry','issuer_credit_rating','tax_status','tax_benefit_section','tax_benefit_details','indexation_benefit','infrastructure_sector','project_name','utilization_purpose','sebi_approved','special_features','lockin_period','data_source','last_updated','created_at','markup','markup_type','final_price','is_perpetual','instrument_status','is_listed','liquidity_score','rating_current','rating_trend','structure_complexity','regulatory_eligibility','bid_ask_spread','status_reason','status_last_updated']
  },
  bond_calendar_events: {
    id: 'id',
    columns: ['id','event_type','event_title','event_description','event_date','event_time','end_date','isin','instrument_name','instrument_type','issuer_name','issuer_type','face_value','issue_size','coupon_rate','yield_indicative','credit_rating','min_investment','max_investment','lot_size','retail_quota','source','source_url','external_id','status','is_highlighted','tags','additional_info','created_at','updated_at','last_synced_at']
  },
};

async function main() {
  if (!TABLE_NAME || !TABLE_CONFIGS[TABLE_NAME]) {
    console.log('Usage: npx tsx server/migrate-enrichment-fast.ts <table_name>');
    console.log('Available tables:', Object.keys(TABLE_CONFIGS).join(', '));
    process.exit(1);
  }

  const config = TABLE_CONFIGS[TABLE_NAME];
  const devPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prodPool = new Pool({ connectionString: process.env.PRODUCTION_DATABASE_URL });
  const devDb = drizzle(devPool);
  const prodDb = drizzle(prodPool);

  try {
    const devRes = await devDb.execute(sql`SELECT COUNT(*) as cnt FROM ${sql.identifier(TABLE_NAME)}`);
    const prodRes = await prodDb.execute(sql`SELECT COUNT(*) as cnt FROM ${sql.identifier(TABLE_NAME)}`);
    const devCount = parseInt(String((devRes.rows[0] as any).cnt));
    const prodCount = parseInt(String((prodRes.rows[0] as any).cnt));
    console.log(`📋 ${TABLE_NAME}: Dev=${devCount}, Prod=${prodCount}`);

    if (devCount <= prodCount) {
      console.log('✅ Production already up to date');
      return;
    }

    const prodIds = await prodDb.execute(sql.raw(`SELECT ${config.id} FROM ${TABLE_NAME}`));
    const existing = new Set((prodIds.rows as any[]).map(r => r[config.id]));

    const colList = config.columns.join(', ');
    const allRows = await devDb.execute(sql.raw(`SELECT ${colList} FROM ${TABLE_NAME} ORDER BY ${config.id}`));
    const newRows = (allRows.rows as any[]).filter(r => !existing.has(r[config.id]));
    console.log(`📤 ${newRows.length} new rows to migrate`);

    let migrated = 0, errors = 0;
    const BATCH = 50;

    for (let i = 0; i < newRows.length; i += BATCH) {
      const batch = newRows.slice(i, i + BATCH);
      const valuesList = batch.map(row =>
        `(${config.columns.map(col => escapeVal(row[col])).join(', ')})`
      ).join(',\n');

      try {
        await prodDb.execute(sql.raw(
          `INSERT INTO ${TABLE_NAME} (${colList}) VALUES ${valuesList} ON CONFLICT (${config.id}) DO NOTHING`
        ));
        migrated += batch.length;
      } catch (err: any) {
        for (const row of batch) {
          try {
            const vals = config.columns.map(col => escapeVal(row[col])).join(', ');
            await prodDb.execute(sql.raw(
              `INSERT INTO ${TABLE_NAME} (${colList}) VALUES (${vals}) ON CONFLICT (${config.id}) DO NOTHING`
            ));
            migrated++;
          } catch {
            errors++;
          }
        }
      }

      if ((i + BATCH) % 500 === 0 || i + BATCH >= newRows.length) {
        console.log(`   Progress: ${migrated}/${newRows.length} migrated, ${errors} errors`);
      }
    }

    const finalRes = await prodDb.execute(sql.raw(`SELECT COUNT(*) as cnt FROM ${TABLE_NAME}`));
    console.log(`✅ Done! Prod now: ${(finalRes.rows[0] as any).cnt} (migrated: ${migrated}, errors: ${errors})`);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main();
