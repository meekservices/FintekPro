/**
 * Data Enrichment Cron Domain
 *
 * All market-data and instrument enrichment jobs:
 * REIT · MF/AIF/PMS/Commodity/ExitLoad/AMFI NAV syncs
 * Benchmark sync · Stock financial enrichment
 * Data Lake archival · Corporate Actions
 * Golden Source Pricing Engine · Fixed Income Status
 * NSE/BSE stock sync · Startup stock enrichment
 */

import cron from 'node-cron';
import { reitInvitDataService } from './services/reit-invit-data-service';
import { mfSyncScheduler } from './services/mf-sync-scheduler';
import { aifNavSyncScheduler } from './services/aif-nav-sync-scheduler';
import { pmsNavSyncScheduler } from './services/pms-nav-sync-scheduler';
import { commodityPriceSyncScheduler } from './services/commodity-price-sync-scheduler';
import { exitLoadSyncScheduler } from './services/exit-load-sync-scheduler';
import { amfiNavScheduler } from './services/amfi-nav-scheduler';
import { callPython } from './clients/python-client';
import { dataEnrichmentScheduler } from './services/data-enrichment-scheduler';
import { financialMetricsRefreshScheduler } from './services/financial-metrics-refresh-scheduler';
import { startZohoSyncScheduler } from './zoho/sync-scheduler';
import { initializeDataLakeCron } from './cron/data-lake-cron';
import { stockSyncScheduler } from './services/stock-sync-scheduler';
import { isProductionEnvironment, isEnrichmentWindow } from './utils/enrichment-guard';
import { runDailyFixedIncomeRefresh } from './cron/fixed-income-daily-refresh';
import type { StaggerFn } from './cron/utils';

const STAGGER = 120_000; // 2 min between each staggered service start

/**
 * Initialize all enrichment crons.
 * @param staggeredStart  - shared stagger helper from coordinator
 * @param delay           - current delay offset (ms); returned incremented
 */
export function initializeEnrichmentCrons(staggeredStart: StaggerFn, delay: number): number {
  if (!isProductionEnvironment()) {
    console.log('⏭️ [Enrichment] All MF/NAV/Benchmark enrichment schedulers SKIPPED (development mode)');
    console.log('   ℹ️ These will only run on production server between 8 PM - 8 AM IST');
    return delay;
  }

  // ── NAV / fund data syncs ───────────────────────────────────────────────────
  staggeredStart('REIT/InvIT refresh', () => {
    reitInvitDataService.startScheduledRefresh(6);
    console.log('🏢 [REIT/InvIT] Data refresh scheduler started (every 6 hours)');
  }, delay);
  delay += STAGGER;

  staggeredStart('MF NAV sync', () => {
    mfSyncScheduler.start();
    console.log('📊 [MF Sync] NAV sync scheduler started');
  }, delay);
  delay += STAGGER;

  staggeredStart('AIF NAV sync', () => {
    aifNavSyncScheduler.start();
    console.log('📊 [AIF Sync] NAV sync scheduler started (daily 7 AM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('PMS NAV sync', () => {
    pmsNavSyncScheduler.start();
    console.log('📊 [PMS Sync] NAV sync scheduler started (daily 7:30 AM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Commodity sync', () => {
    commodityPriceSyncScheduler.start();
    console.log('📊 [Commodity Sync] Price sync scheduler started (daily 8 AM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Exit Load sync', () => {
    exitLoadSyncScheduler.start();
    console.log('📊 [ExitLoad Sync] Exit load sync started (monthly on 1st at 3 AM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Zoho bidirectional sync', () => {
    startZohoSyncScheduler();
  }, delay);
  delay += STAGGER;

  staggeredStart('AMFI Official NAV sync', () => {
    amfiNavScheduler.initialize();
    console.log('📊 [AMFI NAV] Official NAV sync started (daily 11:30 PM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Data Enrichment Scheduler', () => {
    dataEnrichmentScheduler.initialize();
    console.log('📊 [DataEnrichment] Master enrichment scheduler started (daily 5 AM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Financial Metrics Refresh', () => {
    financialMetricsRefreshScheduler.start();
    console.log('📊 [MetricsRefresh] MF returns + stock metrics scheduler started');
  }, delay);
  delay += STAGGER;

  console.log('⏭️ [HistoricalNAV] Historical NAV refresh job disabled — MFAPI dependency removed');
  delay += STAGGER;

  // ── Benchmark jobs ──────────────────────────────────────────────────────────
  staggeredStart('Benchmark Sync', () => {
    import('./services/benchmark-sync-service').then(({ benchmarkSyncService }) => {
      cron.schedule('0 1 * * 0', async () => {
        if (!isEnrichmentWindow()) { console.log('⏭️ [BenchmarkSync] Outside 8PM-8AM IST window, skipping'); return; }
        console.log('[CRON] Starting weekly benchmark index sync...');
        try {
          const result = await benchmarkSyncService.syncAllBenchmarks();
          console.log(`[CRON] Benchmark sync: ${result.synced} synced, ${result.failed.length} failed`);
        } catch (error: any) {
          console.error('[CRON] Benchmark sync failed:', error.message);
        }
      });
      console.log('📊 [BenchmarkSync] Weekly benchmark sync scheduled (Sunday 1 AM UTC)');
    }).catch(err => console.error('❌ Failed to load benchmark sync service:', err));
  }, delay);
  delay += STAGGER;

  staggeredStart('AMFI Benchmark Ingestion', () => {
    import('./services/amfi-benchmark-ingestion-service').then(({ amfiBenchmarkIngestionService }) => {
      cron.schedule('0 2 * * 1', async () => {
        if (!isEnrichmentWindow()) { console.log('⏭️ [AMFIBenchmark] Outside 8PM-8AM IST window, skipping'); return; }
        console.log('[CRON] Starting weekly AMFI benchmark ingestion...');
        try {
          const result = await amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks();
          console.log(`[CRON] AMFI benchmark ingestion: ${result.parsed} parsed, ${result.normalized} normalized, ${result.failed} failed`);
        } catch (error: any) {
          console.error('[CRON] AMFI benchmark ingestion failed:', error.message);
        }
      });
      console.log('📊 [AMFIBenchmark] Weekly AMFI benchmark ingestion scheduled (Monday 2 AM UTC)');
    }).catch(err => console.error('❌ Failed to load AMFI benchmark service:', err));
  }, delay);
  delay += STAGGER;

  staggeredStart('BSE Benchmark Seed', () => {
    import('./services/bse-benchmark-service').then(({ bseBenchmarkService }) => {
      bseBenchmarkService.seedBseIndices().then(result => {
        console.log(`📊 [BSEBenchmark] BSE indices seeded: ${result.seeded} new, ${result.existing} existing`);
      }).catch(err => console.error('❌ BSE index seeding failed:', err));
    }).catch(err => console.error('❌ Failed to load BSE benchmark service:', err));
  }, delay);
  delay += STAGGER;

  staggeredStart('Benchmark Auto-Mapping', () => {
    import('./services/mf-benchmark-mapping-service').then(({ mfBenchmarkMappingService }) => {
      mfBenchmarkMappingService.autoMapUnmappedFunds(5000).then(result => {
        console.log(`📊 [BenchmarkAutoMap] Auto-mapped ${result.mapped} funds, ${result.skipped} skipped`);
      }).catch(err => console.error('❌ Benchmark auto-mapping failed:', err));
    }).catch(err => console.error('❌ Failed to load benchmark mapping service:', err));
  }, delay);
  delay += STAGGER;

  // ── Stock and MF enrichment ─────────────────────────────────────────────────
  staggeredStart('Stock Financial Enrichment', () => {
    cron.schedule('30 12 * * 1-5', async () => {
      if (!isEnrichmentWindow()) { console.log('⏭️ [StockEnrichment] Outside 8PM-8AM IST window, skipping'); return; }
      console.log('[CRON] Starting daily stock financial enrichment (6 PM IST)...');
      try {
        const { stockFinancialEnrichmentService } = await import('./services/stock-financial-enrichment-service');
        await stockFinancialEnrichmentService.enrichAllStocks({ useFmp: true, maxFmpStocks: 40, includeReturns: true, batchSize: 50 });
        console.log('[CRON] Stock financial enrichment completed');
      } catch (error: any) {
        console.error('[CRON] Stock financial enrichment failed:', error.message);
      }
    });
    console.log('📊 [StockEnrichment] Daily stock PE/EPS enrichment scheduled (6 PM IST weekdays)');
  }, delay);
  delay += STAGGER;

  staggeredStart('MF Extended Enrichment', () => {
    cron.schedule('0 18 * * *', async () => {
      if (!isEnrichmentWindow()) { console.log('⏭️ [MFExtended] Outside 8PM-8AM IST window, skipping'); return; }
      console.log('[CRON] Starting daily MF extended enrichment (TER/AUM)...');
      try {
        const { mfExtendedEnrichmentService } = await import('./services/mf-extended-enrichment-service');
        await mfExtendedEnrichmentService.enrichAllFunds({ batchSize: 200, onlyNulls: true });
        console.log('[CRON] MF extended enrichment completed');
      } catch (error: any) {
        console.error('[CRON] MF extended enrichment failed:', error.message);
      }
    });
    console.log('📊 [MFExtended] Daily MF TER/AUM enrichment scheduled (11:30 PM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Data Lake Archival', () => {
    initializeDataLakeCron();
  }, delay);
  delay += STAGGER;

  // ── Corporate Actions ───────────────────────────────────────────────────────
  staggeredStart('Corporate Actions Sync', () => {
    cron.schedule('40 13 * * *', async () => {
      console.log('[CRON] Starting daily corporate actions sync (7:10 PM IST)...');
      try {
        await callPython('/api/corporate-actions/sync', 'POST');
        console.log('[CRON] Corporate actions sync completed');
      } catch (error: any) {
        console.error('[CRON] Corporate actions sync failed:', error.message);
      }
    });
    console.log('📊 [CorpActions] Daily corporate actions sync scheduled (7:10 PM IST)');
  }, delay);
  delay += STAGGER;

  staggeredStart('Corporate Actions Apply', () => {
    cron.schedule('50 13 * * *', async () => {
      console.log('[CRON] Starting daily corporate actions apply (7:20 PM IST)...');
      try {
        await callPython('/api/corporate-actions/apply-adjustments', 'POST');
        console.log('[CRON] Corporate actions apply completed');
      } catch (error: any) {
        console.error('[CRON] Corporate actions apply failed:', error.message);
      }
    });
    console.log('📊 [CorpActions] Daily corporate actions apply scheduled (7:20 PM IST)');
  }, delay);
  delay += STAGGER;

  // ── NSE/BSE stock sync ──────────────────────────────────────────────────────
  stockSyncScheduler.initialize();
  console.log('📊 [StockSync] NSE/BSE sync scheduler initialized');

  // ── Golden Source Pricing Engine ────────────────────────────────────────────
  // Runs at 9 PM IST (15:30 UTC) weekdays — after market close.
  staggeredStart('Golden Source Pricing Engine', () => {
    cron.schedule('30 15 * * 1-5', async () => {
      console.log('[GoldenPricing] Starting daily golden price computation (all asset classes)...');
      try {
        const { runDailyGoldenPricing } = await import('./services/golden-pricing/GoldenPricingEngine');
        const result = await runDailyGoldenPricing();
        console.log(
          `[GoldenPricing] Run complete: ${result.succeeded}/${result.processed} priced, ` +
          `${result.flagged} flagged, ${result.failed} failed in ${result.durationMs}ms`
        );
        try {
          const { callPython: cp } = await import('./clients/python-client');
          const triggerResult = await cp('/api/price-returns/daily-run', 'POST', {});
          if (triggerResult) console.log('[GoldenPricing] Python returns computation started in background');
        } catch (retErr: any) {
          console.warn('[GoldenPricing] Python returns trigger failed (non-critical):', retErr?.message);
        }
      } catch (error: any) {
        console.error('[GoldenPricing] Daily run failed:', error.message);
      }
    }, { timezone: 'Asia/Kolkata' });
  }, delay);
  delay += STAGGER;

  // Weekly stale-price cleanup (Sunday 8 PM IST)
  staggeredStart('Golden Price Stale Marker', () => {
    cron.schedule('0 20 * * 0', async () => {
      console.log('[GoldenPricing] Marking stale prices...');
      try {
        const { db } = await import('./db');
        const { sql } = await import('drizzle-orm');
        const res = await db.execute(sql`
          UPDATE golden_prices SET is_stale = true, updated_at = NOW()
          WHERE price_date < CURRENT_DATE - INTERVAL '5 days' AND is_stale = false
        `);
        console.log(`[GoldenPricing] Stale marker complete: ${res.rowCount} rows updated`);
      } catch (error: any) {
        console.error('[GoldenPricing] Stale marker failed:', error.message);
      }
    }, { timezone: 'Asia/Kolkata' });
    console.log('💰 [GoldenPricing] Daily run (9 PM IST Mon-Fri) + Weekly stale marker (8 PM IST Sun) scheduled');
  }, delay);
  delay += STAGGER;

  return delay;
}

// ── Fixed Income Status — runs at module load (production only) ─────────────
// Daily at 6:05 AM IST (12:35 AM UTC)
if (isProductionEnvironment()) {
  cron.schedule('35 0 * * *', async () => {
    console.log('[CRON] Starting Fixed Income status refresh...');
    try {
      const result = await runDailyFixedIncomeRefresh();
      if (result.success) {
        console.log(`[CRON] Fixed Income refresh: ${result.message}`);
        if (result.stats) {
          console.log(`[CRON] Status distribution: ${result.stats.sellable} SELLABLE, ${result.stats.visible} VISIBLE, ${result.stats.hidden} HIDDEN`);
        }
      } else {
        console.error(`[CRON] Fixed Income refresh failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error('[CRON] Fixed Income refresh job failed:', error.message);
    }
  });
  console.log('📈 [FixedIncomeStatus] Daily status refresh scheduled (6:00 AM IST)');
} else {
  console.log('⏭️ [FixedIncomeStatus] Skipped (development mode - production only)');
}

// ── Startup stock enrichment (production only) ───────────────────────────────
// Delayed 5 min after boot so staggered production jobs settle first.
// Skipped in development — production DB already has enriched data.
if (isProductionEnvironment()) {
  setTimeout(async () => {
    try {
      const { db: dbConn } = await import('./db');
      const { sql: sqlTag } = await import('drizzle-orm');
      const staleRows = await dbConn.execute(sqlTag`
        SELECT symbol FROM listed_stocks
        WHERE is_active = true
          AND (
            enrichment_status IS NULL
            OR enrichment_status != 'complete'
            OR last_enriched_at IS NULL
            OR last_enriched_at < NOW() - INTERVAL '24 hours'
          )
        ORDER BY market_cap_value DESC NULLS LAST
        LIMIT 20
      `);
      const staleSymbols: string[] = ((staleRows as any).rows ?? staleRows).map((r: any) => r.symbol);
      if (staleSymbols.length === 0) {
        console.log('[Startup] All top stocks already enriched — no action needed');
        return;
      }
      console.log(`[Startup] Enriching ${staleSymbols.length} stale stocks via Screener.in (1 at a time, 1.5s delay)...`);
      const { fetchFromScreener } = await import('./modules/research/dataService');
      for (const sym of staleSymbols) {
        try {
          const screenerData = await fetchFromScreener(sym);
          if (screenerData.roe !== null || screenerData.debtToEquity !== null) {
            const updRes = await dbConn.execute(sqlTag`
              UPDATE screener_financials SET
                roe = COALESCE(${screenerData.roe}, roe),
                roce = COALESCE(${screenerData.roce}, roce),
                dividend_yield = COALESCE(${screenerData.dividendYield}, dividend_yield),
                book_value = COALESCE(${screenerData.bookValue}, book_value),
                revenue_growth = COALESCE(${screenerData.revenueGrowth}, revenue_growth),
                earnings_growth = COALESCE(${screenerData.earningsGrowth}, earnings_growth),
                debt_to_equity = COALESCE(${screenerData.debtToEquity}, debt_to_equity),
                last_updated = NOW()
              WHERE id = (
                SELECT id FROM screener_financials
                WHERE symbol = ${sym}
                ORDER BY fiscal_year DESC NULLS LAST, last_updated DESC NULLS LAST
                LIMIT 1
              )
            `);
            const rowsUpdated = (updRes as any).rowCount ?? 0;
            if (!rowsUpdated) {
              const curYear = new Date().getFullYear();
              await dbConn.execute(sqlTag`
                INSERT INTO screener_financials (symbol, period, fiscal_year, roe, roce, dividend_yield, book_value, revenue_growth, earnings_growth, debt_to_equity, last_updated)
                VALUES (${sym}, 'annual', ${curYear}, ${screenerData.roe}, ${screenerData.roce}, ${screenerData.dividendYield}, ${screenerData.bookValue}, ${screenerData.revenueGrowth}, ${screenerData.earningsGrowth}, ${screenerData.debtToEquity}, NOW())
              `).catch(() => {});
            }
            await dbConn.execute(sqlTag`
              UPDATE listed_stocks SET enrichment_status = 'complete', last_enriched_at = NOW()
              WHERE symbol = ${sym}
            `);
          } else {
            await dbConn.execute(sqlTag`
              UPDATE listed_stocks SET enrichment_status = 'failed', last_enriched_at = NOW()
              WHERE symbol = ${sym}
            `);
          }
        } catch (e: any) {
          console.warn(`[Startup] Enrichment failed for ${sym}:`, e?.message?.slice(0, 60));
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      console.log(`[Startup] Enrichment pass complete for ${staleSymbols.length} stocks`);
    } catch (e: any) {
      console.warn('[Startup] Stock enrichment startup pass failed:', e?.message?.slice(0, 80));
    }
  }, 300_000); // 5 min after boot
} else {
  console.log('⏭️ [StartupEnrich] Stock enrichment skipped (development mode - production only)');
}
