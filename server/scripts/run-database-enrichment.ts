/**
 * Database Enrichment Script (PRODUCTION ONLY)
 * 
 * Run with: npx tsx server/scripts/run-database-enrichment.ts
 * 
 * All enrichment commands (mf, stocks, unlisted, all) target PRODUCTION database.
 * The 'report' command uses production DB when available, dev DB as fallback.
 * 
 * Enrichment jobs:
 * 1. Mutual Fund returns from MFAPI historical NAV data
 * 2. Stock PE/Dividend from FMP (primary), Yahoo Finance, Finnhub
 * 3. Unlisted company pricing from price suggestion engine
 */

import { db } from '../db';
import { getProductionDb, hasProductionDb } from '../db-production';
import { sql } from 'drizzle-orm';

async function runEnrichmentReport() {
  const reportDb = hasProductionDb() ? getProductionDb() : db;
  const dbTarget = hasProductionDb() ? 'PRODUCTION' : 'DEVELOPMENT';
  
  console.log('='.repeat(60));
  console.log(`FintekPro Database Enrichment Report (${dbTarget})`);
  console.log('='.repeat(60));
  console.log(`Generated at: ${new Date().toISOString()}\n`);

  // 1. Mutual Funds Status
  console.log('📊 MUTUAL FUNDS STATUS');
  console.log('-'.repeat(40));
  
  const mfStats = await reportDb.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN returns_1y IS NULL THEN 1 ELSE 0 END) as missing_1y,
      SUM(CASE WHEN returns_3y IS NULL THEN 1 ELSE 0 END) as missing_3y,
      SUM(CASE WHEN returns_5y IS NULL THEN 1 ELSE 0 END) as missing_5y,
      SUM(CASE WHEN sharpe_ratio IS NULL THEN 1 ELSE 0 END) as missing_sharpe,
      SUM(CASE WHEN expense_ratio IS NULL THEN 1 ELSE 0 END) as missing_expense,
      SUM(CASE WHEN category IS NULL OR category = '' THEN 1 ELSE 0 END) as missing_category,
      SUM(CASE WHEN isin IS NULL THEN 1 ELSE 0 END) as missing_isin,
      SUM(CASE WHEN returns_1y IS NOT NULL THEN 1 ELSE 0 END) as has_returns
    FROM mutual_funds
  `);
  
  const mf = mfStats.rows[0] as any;
  console.log(`Total Funds: ${mf.total}`);
  console.log(`With Returns: ${mf.has_returns} (${((mf.has_returns / mf.total) * 100).toFixed(1)}%)`);
  console.log(`Missing 1Y Returns: ${mf.missing_1y} (${((mf.missing_1y / mf.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Sharpe Ratio: ${mf.missing_sharpe} (${((mf.missing_sharpe / mf.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Expense Ratio: ${mf.missing_expense} (${((mf.missing_expense / mf.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Category: ${mf.missing_category} (${((mf.missing_category / mf.total) * 100).toFixed(1)}%)`);
  console.log(`Missing ISIN: ${mf.missing_isin} (${((mf.missing_isin / mf.total) * 100).toFixed(1)}%)`);
  
  // 2. Listed Stocks Status
  console.log('\n📈 LISTED STOCKS STATUS');
  console.log('-'.repeat(40));
  
  const stockStats = await reportDb.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN pe_ratio IS NULL THEN 1 ELSE 0 END) as missing_pe,
      SUM(CASE WHEN dividend_yield IS NULL THEN 1 ELSE 0 END) as missing_dividend,
      SUM(CASE WHEN market_cap IS NULL THEN 1 ELSE 0 END) as missing_market_cap,
      SUM(CASE WHEN current_price IS NULL THEN 1 ELSE 0 END) as missing_price,
      SUM(CASE WHEN sector IS NULL OR sector = '' THEN 1 ELSE 0 END) as missing_sector
    FROM listed_stocks
  `);
  
  const stocks = stockStats.rows[0] as any;
  console.log(`Total Stocks: ${stocks.total}`);
  console.log(`Missing PE Ratio: ${stocks.missing_pe} (${((stocks.missing_pe / stocks.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Dividend Yield: ${stocks.missing_dividend} (${((stocks.missing_dividend / stocks.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Market Cap: ${stocks.missing_market_cap} (${((stocks.missing_market_cap / stocks.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Sector: ${stocks.missing_sector} (${((stocks.missing_sector / stocks.total) * 100).toFixed(1)}%)`);

  // 3. Unlisted Companies Status
  console.log('\n🏢 UNLISTED COMPANIES STATUS');
  console.log('-'.repeat(40));
  
  const unlistedStats = await reportDb.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN cin IS NULL OR cin = '' THEN 1 ELSE 0 END) as missing_cin,
      SUM(CASE WHEN sector IS NULL OR sector = '' THEN 1 ELSE 0 END) as missing_sector,
      SUM(CASE WHEN published_buy_price IS NULL THEN 1 ELSE 0 END) as missing_buy_price,
      SUM(CASE WHEN published_sell_price IS NULL THEN 1 ELSE 0 END) as missing_sell_price,
      SUM(CASE WHEN paid_up_capital IS NULL THEN 1 ELSE 0 END) as missing_capital
    FROM unlisted_companies
  `);
  
  const unlisted = unlistedStats.rows[0] as any;
  console.log(`Total Companies: ${unlisted.total}`);
  console.log(`Missing CIN: ${unlisted.missing_cin} (${((unlisted.missing_cin / unlisted.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Sector: ${unlisted.missing_sector} (${((unlisted.missing_sector / unlisted.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Buy Price: ${unlisted.missing_buy_price} (${((unlisted.missing_buy_price / unlisted.total) * 100).toFixed(1)}%)`);
  console.log(`Missing Sell Price: ${unlisted.missing_sell_price} (${((unlisted.missing_sell_price / unlisted.total) * 100).toFixed(1)}%)`);

  // 4. Historical NAV Data Status
  console.log('\n📉 HISTORICAL NAV DATA STATUS');
  console.log('-'.repeat(40));
  
  const navStats = await reportDb.execute(sql`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT identifier) as unique_schemes,
      MIN(date) as earliest,
      MAX(date) as latest
    FROM historical_nav_data
  `);
  
  const nav = navStats.rows[0] as any;
  console.log(`Total Records: ${nav.total_records}`);
  console.log(`Unique Schemes: ${nav.unique_schemes}`);
  console.log(`Date Range: ${nav.earliest} to ${nav.latest}`);

  // 5. Alternative Investments Status
  console.log('\n🏛️ ALTERNATIVE INVESTMENTS STATUS');
  console.log('-'.repeat(40));
  
  const altStats = await reportDb.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM reits) as reits,
      (SELECT COUNT(*) FROM invits) as invits,
      (SELECT COUNT(*) FROM aif_master) as aif,
      (SELECT COUNT(*) FROM pms_master) as pms,
      (SELECT COUNT(*) FROM government_securities) as gsec,
      (SELECT COUNT(*) FROM ncd_public_issues) as ncd,
      (SELECT COUNT(*) FROM sgb_primary_issues) as sgb
  `);
  
  const alt = altStats.rows[0] as any;
  console.log(`REITs: ${alt.reits}`);
  console.log(`InvITs: ${alt.invits}`);
  console.log(`AIFs: ${alt.aif}`);
  console.log(`PMS: ${alt.pms}`);
  console.log(`G-Secs: ${alt.gsec}`);
  console.log(`NCDs: ${alt.ncd}`);
  console.log(`SGBs: ${alt.sgb}`);

  // 6. Operational Tables Status
  console.log('\n⚙️ OPERATIONAL TABLES STATUS');
  console.log('-'.repeat(40));
  
  const opStats = await reportDb.execute(sql`
    SELECT 
      (SELECT COUNT(*) FROM portfolio_holdings) as portfolio_holdings,
      (SELECT COUNT(*) FROM comprehensive_holdings) as comprehensive_holdings,
      (SELECT COUNT(*) FROM transactions) as transactions,
      (SELECT COUNT(*) FROM unified_orders) as unified_orders,
      (SELECT COUNT(*) FROM investment_proposals) as investment_proposals,
      (SELECT COUNT(*) FROM prospect_clients) as prospect_clients,
      (SELECT COUNT(*) FROM prospect_proposals) as prospect_proposals
  `);
  
  const op = opStats.rows[0] as any;
  console.log(`Portfolio Holdings: ${op.portfolio_holdings}`);
  console.log(`Comprehensive Holdings: ${op.comprehensive_holdings}`);
  console.log(`Transactions: ${op.transactions}`);
  console.log(`Unified Orders: ${op.unified_orders}`);
  console.log(`Investment Proposals: ${op.investment_proposals}`);
  console.log(`Prospect Clients: ${op.prospect_clients}`);
  console.log(`Prospect Proposals: ${op.prospect_proposals}`);

  console.log('\n' + '='.repeat(60));
  console.log('Enrichment Priority Recommendations:');
  console.log('='.repeat(60));
  
  const recommendations = [];
  
  if (Number(mf.missing_1y) > 100) {
    recommendations.push(`1. MF Returns: ${mf.missing_1y} funds need returns calculation from MFAPI`);
  }
  if (Number(stocks.missing_pe) > 100) {
    recommendations.push(`2. Stock Metrics: ${stocks.missing_pe} stocks need PE/dividend from Yahoo Finance`);
  }
  if (Number(unlisted.missing_buy_price) > 0) {
    recommendations.push(`3. Unlisted Pricing: ${unlisted.missing_buy_price} companies need price suggestions`);
  }
  if (Number(alt.reits) < 10) {
    recommendations.push(`4. REITs: Only ${alt.reits} REITs - need to expand from NSE/BSE feeds`);
  }
  if (Number(op.transactions) === 0) {
    recommendations.push(`5. Demo Data: Operational tables empty - need seed data for development`);
  }
  
  recommendations.forEach(r => console.log(r));
  
  console.log('\n✅ Report complete\n');
  
  process.exit(0);
}

async function runMutualFundEnrichment(maxFunds: number = 100) {
  console.log(`\n🔄 Starting Mutual Fund Returns Enrichment (max ${maxFunds} funds)...`);
  
  const { mfReturnsSyncService } = await import('../services/mf-returns-sync-service');
  
  const status = mfReturnsSyncService.getStatus();
  if (status.isRunning) {
    console.log('⚠️ Sync already in progress. Waiting...');
    return;
  }
  
  const result = await mfReturnsSyncService.runBatchSync(maxFunds);
  console.log(`✅ MF Enrichment Complete: ${result.successful}/${result.processed} successful, ${result.failed} failed`);
  
  return result;
}

async function runMFExtendedEnrichment(forceRefresh: boolean = false) {
  console.log(`\n🔄 Starting MF Extended Enrichment (TER/AUM/Category)...`);
  
  const { mfExtendedEnrichmentService } = await import('../services/mf-extended-enrichment-service');
  
  const result = await mfExtendedEnrichmentService.enrichAllFunds({ forceRefresh });
  console.log(`✅ MF Extended Enrichment Complete: ${result.terUpdated} TER, ${result.aumUpdated} AUM updated`);
  
  return result;
}

async function runStockEnrichment() {
  console.log('\n🔄 Starting Stock Financial Enrichment...');
  
  const { stockFinancialEnrichmentService } = await import('../services/stock-financial-enrichment-service');
  
  const result = await stockFinancialEnrichmentService.enrichAllStocks({ useFmp: true, maxFmpStocks: 40, includeReturns: true });
  console.log(`✅ Stock Enrichment Complete:`, result);
  
  return result;
}

async function runUnlistedPricingEnrichment() {
  if (!hasProductionDb()) {
    console.error('❌ PRODUCTION_DATABASE_URL not set. Enrichment runs on production only.');
    return { enriched: 0, total: 0 };
  }
  const targetDb = getProductionDb();
  console.log('[Unlisted Enrichment] ✅ Connected to PRODUCTION database');
  
  const results = await targetDb.execute(sql`
    SELECT 
      uc.id,
      uc.name,
      uc.sector,
      cf.networth,
      cf.revenue,
      cr.pe_ratio,
      cr.pb_ratio
    FROM unlisted_companies uc
    LEFT JOIN LATERAL (
      SELECT networth, revenue 
      FROM company_financials 
      WHERE company_id = uc.id 
      ORDER BY financial_year DESC 
      LIMIT 1
    ) cf ON true
    LEFT JOIN LATERAL (
      SELECT pe_ratio, pb_ratio 
      FROM company_ratios 
      WHERE company_id = uc.id 
      ORDER BY financial_year DESC 
      LIMIT 1
    ) cr ON true
    WHERE uc.published_buy_price IS NULL OR uc.published_buy_price = '0'
  `);
  
  console.log(`Found ${results.rows.length} companies needing pricing`);
  
  let enriched = 0;
  
  for (const company of results.rows as any[]) {
    let buyPrice = 0;
    let sellPrice = 0;
    
    // Calculate price based on available data
    if (company.networth && parseFloat(company.networth) > 0) {
      buyPrice = Math.round(parseFloat(company.networth) / 10000000); // 1 share ~ net worth / 10M
    } else if (company.pe_ratio && company.revenue) {
      const earnings = parseFloat(company.revenue) * 0.1; // Assume 10% margin
      buyPrice = Math.round((earnings / 10000000) * parseFloat(company.pe_ratio));
    } else {
      // Default sector-based pricing
      const sectorPrices: Record<string, number> = {
        'Technology': 500,
        'Financial Services': 400,
        'Real Estate': 300,
        'Infrastructure': 350,
        'Healthcare': 450,
        'FMCG': 380,
        'Industrial': 280,
        'Unknown': 200,
      };
      
      const sector = company.sector || 'Unknown';
      buyPrice = sectorPrices[sector] || 200;
    }
    
    // Sell price is 5% higher than buy price (typical spread)
    sellPrice = Math.round(buyPrice * 1.05);
    
    if (buyPrice > 0) {
      await targetDb.execute(sql`
        UPDATE unlisted_companies 
        SET 
          published_buy_price = ${buyPrice.toString()},
          published_sell_price = ${sellPrice.toString()},
          pricing_status = 'active',
          updated_at = NOW()
        WHERE id = ${company.id}
      `);
      enriched++;
      console.log(`  Updated ${company.name}: Buy ₹${buyPrice}, Sell ₹${sellPrice}`);
    }
  }
  
  console.log(`✅ Unlisted Pricing Complete: ${enriched} companies enriched`);
  return { enriched, total: results.rows.length };
}

// Main execution
const args = process.argv.slice(2);
const command = args[0] || 'report';
const maxFunds = parseInt(args[1]) || 100;

console.log(`\nRunning command: ${command}`);

switch (command) {
  case 'report':
    runEnrichmentReport();
    break;
  case 'mf':
    runMutualFundEnrichment(maxFunds).then(() => process.exit(0));
    break;
  case 'mf-extended':
    runMFExtendedEnrichment(args.includes('--force')).then(() => process.exit(0));
    break;
  case 'stocks':
    runStockEnrichment().then(() => process.exit(0));
    break;
  case 'unlisted':
    runUnlistedPricingEnrichment().then(() => process.exit(0));
    break;
  case 'all':
    Promise.all([
      runMutualFundEnrichment(maxFunds),
      runMFExtendedEnrichment(false),
      runStockEnrichment(),
      runUnlistedPricingEnrichment()
    ]).then(() => {
      console.log('\n✅ All enrichment jobs complete');
      process.exit(0);
    });
    break;
  default:
    console.log(`
Usage: npx tsx server/scripts/run-database-enrichment.ts <command> [options]

Commands:
  report                - Show database enrichment status report
  mf [maxFunds]         - Run mutual fund returns enrichment (default: 100 funds)
  mf-extended [--force] - Run MF extended enrichment (TER/AUM/Category)
  stocks                - Run stock financial metrics enrichment
  unlisted              - Run unlisted company pricing enrichment
  all [maxFunds]        - Run all enrichment jobs
    `);
    process.exit(0);
}
