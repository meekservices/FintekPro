import cron from 'node-cron';
import { storage } from './storage';
import { DealMatcherService } from './services/deal-matcher';
import { probe42Service } from './services/probe42-service';
import { stockSyncScheduler } from './services/stock-sync-scheduler';
import { getProbe42AnalyticsService } from './services/probe42-analytics-service';
import { ckycSlaEscalationService } from './services/ckyc-sla-escalation-service';
import { auditIntegrityChecker } from './services/audit-integrity-checker';
import { errorDigestService } from './services/error-digest-service';
import { companyDataRefreshScheduler } from './services/company-data-refresh-scheduler';
import { proactiveCacheWarmingService } from './services/proactive-cache-warming-service';
import { dailyReconciliationService } from './services/daily-reconciliation-service';
import { db } from './db';
import { users, unlistedCompanies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { reitInvitDataService } from './services/reit-invit-data-service';
import { giftCityMaintenanceService } from './services/gift-city-maintenance-service';
import { runDailyFixedIncomeRefresh } from "./cron/fixed-income-daily-refresh";
import { mfSyncScheduler } from './services/mf-sync-scheduler';
import { aifNavSyncScheduler } from './services/aif-nav-sync-scheduler';
import { pmsNavSyncScheduler } from './services/pms-nav-sync-scheduler';
import { commodityPriceSyncScheduler } from './services/commodity-price-sync-scheduler';
import { exitLoadSyncScheduler } from './services/exit-load-sync-scheduler';
import { amfiNavScheduler } from './services/amfi-nav-scheduler';
import { dataEnrichmentScheduler } from './services/data-enrichment-scheduler';
import { financialMetricsRefreshScheduler } from './services/financial-metrics-refresh-scheduler';
import { historicalNavRefreshJob } from './services/historical-nav-refresh-job';
import { isProductionEnvironment, isEnrichmentWindow, logEnrichmentSkip } from './utils/enrichment-guard';
import { startZohoSyncScheduler } from './zoho/sync-scheduler';

const STAGGER_DELAY_MS = 120000;

const activeTimers: NodeJS.Timeout[] = [];

function staggeredStart(name: string, startFn: () => void, delayMs: number): void {
  const timer = setTimeout(() => {
    console.log(`🚀 [StaggeredStart] Starting ${name}...`);
    startFn();
  }, delayMs);
  activeTimers.push(timer);
}

export function initializeCronJobs(): void {
  console.log('Initializing cron jobs (staggered startup enabled, 120s intervals)...');

  let delay = 60000;

  if (isProductionEnvironment()) {
    staggeredStart('REIT/InvIT refresh', () => {
      reitInvitDataService.startScheduledRefresh(6);
      console.log('🏢 [REIT/InvIT] Data refresh scheduler started (every 6 hours)');
    }, delay);
    delay += STAGGER_DELAY_MS;
  } else {
    console.log('⏭️ [REIT/InvIT] Data refresh skipped (development mode - production only)');
  }

  if (isProductionEnvironment()) {
    staggeredStart('MF NAV sync', () => {
      mfSyncScheduler.start();
      console.log('📊 [MF Sync] NAV sync scheduler started (daily refresh + startup catch-up)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('AIF NAV sync', () => {
      aifNavSyncScheduler.start();
      console.log('📊 [AIF Sync] NAV sync scheduler started (daily refresh at 7 AM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('PMS NAV sync', () => {
      pmsNavSyncScheduler.start();
      console.log('📊 [PMS Sync] NAV sync scheduler started (daily refresh at 7:30 AM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Commodity sync', () => {
      commodityPriceSyncScheduler.start();
      console.log('📊 [Commodity Sync] Price sync scheduler started (daily refresh at 8 AM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Exit Load sync', () => {
      exitLoadSyncScheduler.start();
      console.log('📊 [ExitLoad Sync] Exit load sync scheduler started (monthly refresh on 1st at 3 AM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;

    staggeredStart('Zoho bidirectional sync', () => {
      startZohoSyncScheduler();
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('AMFI Official NAV sync', () => {
      amfiNavScheduler.initialize();
      console.log('📊 [AMFI NAV] Official NAV sync scheduler started (daily at 11:30 PM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Data Enrichment Scheduler', () => {
      dataEnrichmentScheduler.initialize();
      console.log('📊 [DataEnrichment] Master enrichment scheduler started (daily at 5 AM IST)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Financial Metrics Refresh', () => {
      financialMetricsRefreshScheduler.start();
      console.log('📊 [MetricsRefresh] MF returns + stock metrics scheduler started (daily after market close)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Historical NAV Refresh', () => {
      historicalNavRefreshJob.initialize();
      console.log('📊 [HistoricalNAV] Historical NAV data refresh job started (daily incremental updates)');
    }, delay);
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('Benchmark Sync', () => {
      import('./services/benchmark-sync-service').then(({ benchmarkSyncService }) => {
        cron.schedule('0 1 * * 0', async () => {
          if (!isEnrichmentWindow()) { console.log('⏭️ [BenchmarkSync] Outside 8PM-8AM IST window, skipping'); return; }
          console.log('[CRON] Starting weekly benchmark index sync...');
          try {
            const result = await benchmarkSyncService.syncAllBenchmarks();
            console.log(`[CRON] Benchmark sync completed: ${result.synced} synced, ${result.failed.length} failed`);
          } catch (error: any) {
            console.error('[CRON] Benchmark sync failed:', error.message);
          }
        });
        console.log('📊 [BenchmarkSync] Weekly benchmark index sync scheduled (Sunday 1 AM UTC)');
      }).catch(err => console.error('❌ Failed to load benchmark sync service:', err));
    }, delay);
    delay += STAGGER_DELAY_MS;
    
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
    delay += STAGGER_DELAY_MS;
    
    staggeredStart('BSE Benchmark Seed', () => {
      import('./services/bse-benchmark-service').then(({ bseBenchmarkService }) => {
        bseBenchmarkService.seedBseIndices().then(result => {
          console.log(`📊 [BSEBenchmark] BSE indices seeded: ${result.seeded} new, ${result.existing} existing`);
        }).catch(err => console.error('❌ BSE index seeding failed:', err));
      }).catch(err => console.error('❌ Failed to load BSE benchmark service:', err));
    }, delay);
    delay += STAGGER_DELAY_MS;

    staggeredStart('Benchmark Auto-Mapping', () => {
      import('./services/mf-benchmark-mapping-service').then(({ mfBenchmarkMappingService }) => {
        mfBenchmarkMappingService.autoMapUnmappedFunds(5000).then(result => {
          console.log(`📊 [BenchmarkAutoMap] Auto-mapped ${result.mapped} funds, ${result.skipped} skipped`);
        }).catch(err => console.error('❌ Benchmark auto-mapping failed:', err));
      }).catch(err => console.error('❌ Failed to load benchmark mapping service:', err));
    }, delay);
    delay += STAGGER_DELAY_MS;
    
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
    delay += STAGGER_DELAY_MS;
    
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
    delay += STAGGER_DELAY_MS;
  } else {
    console.log('⏭️ [Enrichment] All MF/NAV/Benchmark enrichment schedulers SKIPPED (development mode)');
    console.log('   ℹ️ These will only run on production server between 8 PM - 8 AM IST');
  }
  
  // Probe42 Sync Job - Run every 6 hours (production only - writes to DB)
  if (isProductionEnvironment()) {
    cron.schedule('0 */6 * * *', async () => {
      console.log('[CRON] Starting Probe42 sync job...');
      try {
        const companies = await storage.getAllUnlistedCompanies({});
        let synced = 0;
        let failed = 0;

        for (const company of companies) {
          if (!company.probe42CompanyId) continue;

          try {
            await probe42Service.syncCompanyFromProbe42(company.id);
            synced++;
          } catch (error: any) {
            console.error(`Failed to sync company ${company.id}:`, error);
            failed++;
          }
        }

        console.log(
          `[CRON] Probe42 sync completed: ${synced} succeeded, ${failed} failed`
        );
      } catch (error: any) {
        console.error('[CRON] Probe42 sync job failed:', error);
      }
    });
  } else {
    console.log('⏭️ [Probe42 Sync] Skipped (development mode - production only)');
  }

  // Order Cleanup Job - Run every 12 hours (production only - writes to DB)
  if (isProductionEnvironment()) {
    cron.schedule('0 */12 * * *', async () => {
      console.log('[CRON] Starting order cleanup job...');
      try {
        const dealMatcher = new DealMatcherService(storage);
        const { expiredListings, expiredRequests } =
          await dealMatcher.cleanupExpiredOrders();

        if (expiredListings > 0 || expiredRequests > 0) {
          console.log(
            `[CRON] Cleanup completed: ${expiredListings} expired listings, ${expiredRequests} expired requests`
          );
          
          console.log(`[CRON][AUDIT] Unlisted marketplace cleanup: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            expiredListings,
            expiredRequests,
            action: 'auto_expire'
          })}`);
        } else {
          console.log('[CRON] Order cleanup: No expired listings or requests found');
        }
      } catch (error: any) {
        console.error('[CRON] Order cleanup job failed:', error);
      }
    });
  } else {
    console.log('⏭️ [OrderCleanup] Skipped (development mode - production only)');
  }

  // Expiry Warning, Stale Order Cleanup, Processing Order Timeout (production only)
  if (isProductionEnvironment()) {
  // Expiry Warning Job - Run daily at 9 AM IST (3:30 AM UTC)
  cron.schedule('30 3 * * *', async () => {
    console.log('[CRON] Checking for listings expiring soon...');
    try {
      const { db } = await import('./db');
      const { sellListings, buyRequests } = await import('@shared/schema');
      const { eq, and, gte, lte, sql } = await import('drizzle-orm');
      
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Find listings expiring within 24 hours
      const expiringListings = await db
        .select({
          id: sellListings.id,
          userId: sellListings.userId,
          companyId: sellListings.companyId,
          quantity: sellListings.quantity,
          pricePerShare: sellListings.pricePerShare,
          validUntil: sellListings.validUntil
        })
        .from(sellListings)
        .where(
          and(
            eq(sellListings.status, 'active'),
            gte(sellListings.validUntil, now),
            lte(sellListings.validUntil, tomorrow)
          )
        )
        .limit(100);

      const expiringRequests = await db
        .select({
          id: buyRequests.id,
          userId: buyRequests.userId,
          companyId: buyRequests.companyId,
          quantity: buyRequests.quantity,
          maxPricePerShare: buyRequests.maxPricePerShare,
          validUntil: buyRequests.validUntil
        })
        .from(buyRequests)
        .where(
          and(
            eq(buyRequests.status, 'active'),
            gte(buyRequests.validUntil, now),
            lte(buyRequests.validUntil, tomorrow)
          )
        )
        .limit(100);

      if (expiringListings.length > 0 || expiringRequests.length > 0) {
        console.log(`[CRON] Found ${expiringListings.length} listings and ${expiringRequests.length} requests expiring within 24 hours`);
        
        // Send notifications to users about expiring listings
        const { emailService } = await import('./email-service');
        
        // Notify sellers about expiring listings
        for (const listing of expiringListings) {
          try {
            const user = await db.select().from(users).where(eq(users.id, listing.userId)).limit(1);
            if (user[0]?.email) {
              const company = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, listing.companyId)).limit(1);
              const companyName = company[0]?.name || 'Unlisted Stock';
              const price = listing.pricePerShare?.toLocaleString('en-IN') || 'N/A';
              await emailService.sendEmail({
                to: user[0].email,
                subject: `⏰ Your sell listing expires in 24 hours - ${companyName}`,
                html: `
                  <h2>Listing Expiry Reminder</h2>
                  <p>Your sell listing for <strong>${companyName}</strong> will expire soon.</p>
                  <ul>
                    <li>Quantity: ${listing.quantity || 0} shares</li>
                    <li>Price: ₹${price}/share</li>
                    <li>Expires: ${listing.validUntil ? new Date(listing.validUntil).toLocaleString('en-IN') : 'Soon'}</li>
                  </ul>
                  <p>Log in to FintekPro to extend or modify your listing.</p>
                `,
                text: `Your sell listing for ${companyName} expires in 24 hours. Quantity: ${listing.quantity || 0}, Price: ₹${price}/share`
              });
              console.log(`[CRON] Sent expiry notification to ${user[0].email} for listing ${listing.id}`);
            }
          } catch (err) {
            console.error(`[CRON] Failed to send notification for listing ${listing.id}:`, err);
          }
        }
        
        // Notify buyers about expiring requests
        for (const request of expiringRequests) {
          try {
            const user = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
            if (user[0]?.email) {
              const company = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, request.companyId)).limit(1);
              const reqCompanyName = company[0]?.name || 'Unlisted Stock';
              const maxPrice = request.maxPricePerShare?.toLocaleString('en-IN') || 'N/A';
              await emailService.sendEmail({
                to: user[0].email,
                subject: `⏰ Your buy request expires in 24 hours - ${reqCompanyName}`,
                html: `
                  <h2>Buy Request Expiry Reminder</h2>
                  <p>Your buy request for <strong>${reqCompanyName}</strong> will expire soon.</p>
                  <ul>
                    <li>Quantity: ${request.quantity || 0} shares</li>
                    <li>Max Price: ₹${maxPrice}/share</li>
                    <li>Expires: ${request.validUntil ? new Date(request.validUntil).toLocaleString('en-IN') : 'Soon'}</li>
                  </ul>
                  <p>Log in to FintekPro to extend or modify your request.</p>
                `,
                text: `Your buy request for ${reqCompanyName} expires in 24 hours. Quantity: ${request.quantity || 0}, Max Price: ₹${maxPrice}/share`
              });
              console.log(`[CRON] Sent expiry notification to ${user[0].email} for request ${request.id}`);
            }
          } catch (err) {
            console.error(`[CRON] Failed to send notification for request ${request.id}:`, err);
          }
        }
      } else {
        console.log('[CRON] No listings expiring within 24 hours');
      }
    } catch (error: any) {
      console.error('[CRON] Expiry warning job failed:', error.message);
    }
  });

  // Price Suggestion Refresh - Run every 12 hours (production only - writes to DB)
  if (isProductionEnvironment()) {
    cron.schedule('0 */12 * * *', async () => {
      console.log('[CRON] Starting price suggestion refresh...');
      try {
        const companies = await storage.getAllUnlistedCompanies({});
        let refreshed = 0;

        for (const company of companies) {
          try {
            const { PriceSuggestionService } = require('./services/price-suggestion');
            const service = new PriceSuggestionService(storage);
            await service.calculateSuggestedPrice(company.id);
            refreshed++;
          } catch (error: any) {
          }
        }

        console.log(`[CRON] Price suggestions refreshed for ${refreshed} companies`);
      } catch (error: any) {
        console.error('[CRON] Price suggestion refresh failed:', error);
      }
    });

    // MoneyControl Price Sync - Run daily at 9 PM IST (3:30 PM UTC)
    cron.schedule('30 15 * * *', async () => {
      console.log('[CRON] Starting MoneyControl price sync...');
      try {
        const { moneyControlScraper } = await import('./services/moneycontrol-scraper');
        const result = await moneyControlScraper.executeImport();
        
        console.log(
          `[CRON] MoneyControl sync completed: ${result.imported} prices imported, ${result.matched} matched, ${result.unmatchedCompanies.length} unmatched`
        );
      } catch (error: any) {
        console.error('[CRON] MoneyControl price sync failed:', error.message);
      }
    });

    // Bond Financial Calendar Refresh - Run daily at 6 AM IST (12:30 AM UTC)
    cron.schedule('30 0 * * *', async () => {
      console.log('[CRON] Starting bond calendar refresh...');
      try {
        const { financialCalendarService } = await import('./services/financial-calendar-service');
        const result = await financialCalendarService.refreshCalendar();
        
        console.log(
          `[CRON] Bond calendar refreshed: ${result.synced} events synced`
        );
        if (result.errors.length > 0) {
          console.warn('[CRON] Bond calendar errors:', result.errors);
        }
      } catch (error: any) {
        console.error('[CRON] Bond calendar refresh failed:', error.message);
      }
    });
  } else {
    console.log('⏭️ [Price/MoneyControl/BondCalendar] Skipped (development mode - production only)');
  }

  // Live MF NAV Refresh - Run every day at 10:30 PM IST (5:00 PM UTC) after market close
  if (isProductionEnvironment()) {
    cron.schedule('0 17 * * *', async () => {
      if (!isEnrichmentWindow()) { console.log('⏭️ [Live MF NAV] Outside 8PM-8AM IST window, skipping'); return; }
      console.log('[CRON] Starting live MF NAV refresh...');
      try {
        const { liveMFDataService } = await import('./services/live-mf-data-service');
        const success = await liveMFDataService.refreshCache();
        
        if (success) {
          const stats = liveMFDataService.getCacheStats();
          console.log(`[CRON] Live MF NAV refreshed: ${stats.size} funds loaded from AMFI`);
          
          const result = await liveMFDataService.updateDatabaseWithLiveData();
          console.log(`[CRON] Database sync: ${result.updated} funds updated`);
        } else {
          console.warn('[CRON] Live MF NAV refresh failed');
        }
      } catch (error: any) {
        console.error('[CRON] Live MF NAV refresh failed:', error.message);
      }
    });

    // Morning MF NAV Pre-warm - Run at 9 AM IST (3:30 AM UTC)
    cron.schedule('30 3 * * *', async () => {
      if (!isProductionEnvironment()) return;
      console.log('[CRON] Pre-warming MF NAV cache...');
      try {
        const { liveMFDataService } = await import('./services/live-mf-data-service');
        await liveMFDataService.refreshCache();
        const stats = liveMFDataService.getCacheStats();
        console.log(`[CRON] MF NAV cache pre-warmed: ${stats.size} funds`);
      } catch (error: any) {
        console.error('[CRON] MF NAV pre-warm failed:', error.message);
      }
    });

    // MF NAV History Sync - Run daily at 11 PM IST (5:30 PM UTC) to store historical NAV data
    cron.schedule('30 17 * * *', async () => {
      if (!isEnrichmentWindow()) { console.log('⏭️ [MF NAV History] Outside 8PM-8AM IST window, skipping'); return; }
      console.log('[CRON] Starting MF NAV history sync...');
      try {
        const { mfDataSyncService } = await import('./services/mf-data-sync-service');
        await mfDataSyncService.runDailySync();
        console.log('[CRON] MF NAV history sync completed');
      } catch (error: any) {
        console.error('[CRON] MF NAV history sync failed:', error.message);
      }
    });

    // Monthly Returns Calculation - Run on 1st of each month at 6 AM IST (12:30 AM UTC)
    cron.schedule('30 0 1 * *', async () => {
      if (!isEnrichmentWindow()) { console.log('⏭️ [Monthly Returns] Outside 8PM-8AM IST window, skipping'); return; }
      console.log('[CRON] Starting monthly returns calculation...');
      try {
        const { mfDataSyncService } = await import('./services/mf-data-sync-service');
        const { mutualFunds } = await import('@shared/schema');
        const { db } = await import('./db');
        
        const funds = await db.select({ schemeCode: mutualFunds.schemeCode }).from(mutualFunds).limit(200);
        let calculated = 0;
        
        for (const fund of funds) {
          const count = await mfDataSyncService.calculateMonthlyReturnsForScheme(fund.schemeCode);
          if (count > 0) calculated++;
        }
        
        console.log(`[CRON] Monthly returns calculated for ${calculated} funds`);
      } catch (error: any) {
        console.error('[CRON] Monthly returns calculation failed:', error.message);
      }
    });
  } else {
    console.log('⏭️ [MF Cron Jobs] Live MF NAV, NAV History, Monthly Returns, NAV Pre-warm SKIPPED (development mode)');
  }

  // Probe42 Prospecting Alerts & Lead Scoring (production only - writes to DB)
  if (isProductionEnvironment()) {
    // Probe42 Prospecting Alerts - Run daily at 8 AM IST (2:30 AM UTC)
    cron.schedule('30 2 * * *', async () => {
      console.log('[CRON] Starting Probe42 prospecting alerts check...');
      try {
        const analyticsService = getProbe42AnalyticsService();
        
        const alerts = await analyticsService.checkProspectingThresholds({
          minRevenue: 100000000,
          minProfit: 10000000,
          minLeadScore: 70,
        });
        
        console.log(`[CRON] Prospecting alerts: ${alerts.length} new high-value prospects identified`);
        
        const hotAlerts = alerts.filter(a => a.priority === 'high').length;
        if (hotAlerts > 0) {
          console.log(`[CRON] 🔥 ${hotAlerts} HOT leads require immediate attention`);
        }
      } catch (error: any) {
        console.error('[CRON] Prospecting alerts check failed:', error.message);
      }
    });

    // Lead Scoring Refresh - Run weekly on Sunday at 6 AM IST (12:30 AM UTC)
    cron.schedule('30 0 * * 0', async () => {
      console.log('[CRON] Starting weekly lead scoring refresh...');
      try {
        const { db } = await import('./db');
        const { prospectLeads } = await import('@shared/schema');
        const { isNotNull } = await import('drizzle-orm');
        
        const analyticsService = getProbe42AnalyticsService();
        
        const leads = await db
          .select({ id: prospectLeads.id, cin: prospectLeads.cin })
          .from(prospectLeads)
          .where(isNotNull(prospectLeads.cin))
          .limit(100);
        
        let scored = 0;
        for (const lead of leads) {
          if (lead.cin) {
            const score = await analyticsService.calculateSmartLeadScore(lead.cin);
            if (score) {
              await db
                .update(prospectLeads)
                .set({ 
                  leadScore: score.totalScore,
                  leadQuality: score.leadGrade,
                  updatedAt: new Date()
                })
                .where(require('drizzle-orm').eq(prospectLeads.id, lead.id));
              scored++;
            }
          }
        }
        
        console.log(`[CRON] Lead scoring completed: ${scored} leads updated`);
      } catch (error: any) {
        console.error('[CRON] Lead scoring refresh failed:', error.message);
      }
    });
  } else {
    console.log('⏭️ [Probe42 Alerts/Lead Scoring] Skipped (development mode - production only)');
  }

  // Stale Order Cleanup - Run every 6 hours
  // Auto-cancel orders stuck in 'initiated' or 'payment_pending' for >24 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[CRON] Starting stale order cleanup...');
    try {
      const { db } = await import('./db');
      const { unifiedOrders, users } = await import('@shared/schema');
      const { eq, and, lt, inArray, sql } = await import('drizzle-orm');
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Find stale orders - stuck in initial states for >24 hours
      const staleOrders = await db
        .select({
          id: unifiedOrders.id,
          orderNumber: unifiedOrders.orderNumber,
          userId: unifiedOrders.userId,
          productName: unifiedOrders.productName,
          amount: unifiedOrders.amount,
          status: unifiedOrders.status,
          createdAt: unifiedOrders.createdAt
        })
        .from(unifiedOrders)
        .where(
          and(
            inArray(unifiedOrders.status, ['initiated', 'payment_pending']),
            lt(unifiedOrders.createdAt, twentyFourHoursAgo)
          )
        )
        .limit(100);
      
      if (staleOrders.length === 0) {
        console.log('[CRON] No stale orders found');
        return;
      }
      
      let cancelled = 0;
      let failed = 0;
      
      for (const order of staleOrders) {
        try {
          // Update order status to expired
          await db
            .update(unifiedOrders)
            .set({
              status: 'expired',
              paymentStatus: 'expired',
              executionStatus: 'cancelled',
              failureReason: 'Order expired - no payment received within 24 hours',
              updatedAt: new Date()
            })
            .where(eq(unifiedOrders.id, order.id));
          
          // Log the expiry for audit
          console.log(`[CRON] Order ${order.orderNumber} expired (created: ${order.createdAt})`);
          cancelled++;
          
          // Send notification to user about expired order
          try {
            const { emailService } = await import('./email-service');
            const user = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
            if (user[0]?.email) {
              const productName = order.productName || 'Product';
              const orderAmount = order.amount?.toLocaleString('en-IN') || 'N/A';
              await emailService.sendEmail({
                to: user[0].email,
                subject: `❌ Order Expired - ${order.orderNumber}`,
                html: `
                  <h2>Order Expired</h2>
                  <p>Your order <strong>${order.orderNumber}</strong> for <strong>${productName}</strong> has expired due to incomplete payment.</p>
                  <ul>
                    <li>Order Number: ${order.orderNumber}</li>
                    <li>Product: ${productName}</li>
                    <li>Amount: ₹${orderAmount}</li>
                    <li>Created: ${order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : 'N/A'}</li>
                  </ul>
                  <p>If you still wish to make this purchase, please place a new order on FintekPro.</p>
                `,
                text: `Your order ${order.orderNumber} for ${productName} has expired. Amount: ₹${orderAmount}. Please place a new order if you still wish to proceed.`
              });
              console.log(`[CRON] Sent expiry notification to ${user[0].email} for order ${order.orderNumber}`);
            }
          } catch (notifyErr) {
            console.error(`[CRON] Failed to send expiry notification for order ${order.orderNumber}:`, notifyErr);
          }
          
        } catch (orderError: any) {
          console.error(`[CRON] Failed to expire order ${order.orderNumber}:`, orderError.message);
          failed++;
        }
      }
      
      console.log(`[CRON] Stale order cleanup completed: ${cancelled} expired, ${failed} failed`);
      
    } catch (error: any) {
      console.error('[CRON] Stale order cleanup failed:', error.message);
    }
  });

  // Processing Order Timeout - Run every hour
  // Auto-fail orders stuck in 'processing' for >4 hours (indicates execution failure)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking for stuck processing orders...');
    try {
      const { db } = await import('./db');
      const { unifiedOrders } = await import('@shared/schema');
      const { eq, and, lt, sql } = await import('drizzle-orm');
      
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      
      // Find orders stuck in processing
      const stuckOrders = await db
        .select({
          id: unifiedOrders.id,
          orderNumber: unifiedOrders.orderNumber,
          userId: unifiedOrders.userId,
          status: unifiedOrders.status,
          updatedAt: unifiedOrders.updatedAt
        })
        .from(unifiedOrders)
        .where(
          and(
            eq(unifiedOrders.status, 'processing'),
            lt(unifiedOrders.updatedAt, fourHoursAgo)
          )
        )
        .limit(50);
      
      if (stuckOrders.length === 0) {
        console.log('[CRON] No stuck processing orders found');
        return;
      }
      
      let flagged = 0;
      for (const order of stuckOrders) {
        try {
          // Mark as execution_failed - requires manual review
          await db
            .update(unifiedOrders)
            .set({
              status: 'execution_failed',
              executionStatus: 'failed',
              failureReason: 'Order processing timed out - requires manual review',
              updatedAt: new Date()
            })
            .where(eq(unifiedOrders.id, order.id));
          
          console.warn(`[CRON] Order ${order.orderNumber} marked as execution_failed (stuck since: ${order.updatedAt})`);
          flagged++;
          
        } catch (orderError: any) {
          console.error(`[CRON] Failed to flag stuck order ${order.orderNumber}:`, orderError.message);
        }
      }
      
      console.log(`[CRON] Stuck order check completed: ${flagged} orders flagged for review`);
      
    } catch (error: any) {
      console.error('[CRON] Stuck order check failed:', error.message);
    }
  });

  // KYC Upgrade Reminder Job - Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('[CRON] Processing KYC upgrade reminders...');
    try {
      const { kycUpgradeNotificationService } = await import('./services/kyc-upgrade-notification-service');
      const stats = await kycUpgradeNotificationService.processScheduledReminders();
      
      console.log(`[CRON] KYC reminders: processed ${stats.processed}, sent ${stats.sent}`);
    } catch (error: any) {
      console.error('[CRON] KYC reminder job failed:', error.message);
    }
  });
  } else {
    console.log('⏭️ [ExpiryWarning/StaleOrders/ProcessingTimeout/KYCReminders] Skipped (development mode - production only)');
  }

  // Error Digest Job - Run daily at 8 AM IST (2:30 AM UTC)
  // Sends AI-powered daily error summary to admin users
  cron.schedule('30 2 * * *', async () => {
    console.log('[CRON] Starting daily error digest...');
    try {
      await errorDigestService.runDailyDigest();
      console.log('[CRON] Daily error digest completed');
    } catch (error: any) {
      console.error('[CRON] Error digest job failed:', error.message);
    }
  });
  console.log('📊 [ErrorDigest] Daily error digest scheduled (8:00 AM IST)');

  if (isProductionEnvironment()) {
    stockSyncScheduler.initialize();
  } else {
    console.log('⏭️ [StockSync] NSE/BSE sync skipped (development mode - production only)');
  }

  // Initialize CKYC SLA Escalation Service - Runs hourly
  try {
    ckycSlaEscalationService.initialize();
  } catch (error: any) {
    console.error('[CRON] Failed to initialize CKYC SLA Escalation Service:', error.message);
  }

  // Initialize Audit Trail Integrity Checker - Runs every hour by default
  // Verifies SHA-256 hash chain integrity and alerts on tampering
  try {
    const auditCheckIntervalMinutes = parseInt(process.env.AUDIT_INTEGRITY_CHECK_INTERVAL_MINUTES || '60', 10);
    auditIntegrityChecker.initialize(auditCheckIntervalMinutes);
    console.log(`[CRON] Audit Integrity Checker initialized (every ${auditCheckIntervalMinutes} minutes)`);
  } catch (error: any) {
    console.error('[CRON] Failed to initialize Audit Integrity Checker:', error.message);
  }

  // Company Data Refresh, Reconciliation, GIFT City Maintenance (production only - writes to DB)
  if (isProductionEnvironment()) {
    try {
      companyDataRefreshScheduler.start();
      console.log('[CRON] Company Data Refresh Scheduler started (checks daily, refreshes every 90 days)');
    } catch (error: any) {
      console.error('[CRON] Failed to start Company Data Refresh Scheduler:', error.message);
    }

    // Daily Reconciliation Job - Run daily at 1:00 AM IST (7:30 PM UTC previous day)
    cron.schedule('30 19 * * *', async () => {
      console.log('[CRON] Starting daily reconciliation...');
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const report = await dailyReconciliationService.runDailyReconciliation(yesterday, 'system_cron');
        
        console.log(`[CRON] Daily reconciliation completed: ${report.id}`);
        console.log(`[CRON] Summary: ${report.summary.totalTransactions} transactions, ${report.summary.discrepancyCount} discrepancies`);
        
        if (report.summary.discrepancyCount > 0) {
          console.warn(`[CRON] ATTENTION: ${report.summary.discrepancyCount} discrepancies detected in daily reconciliation`);
        }
      } catch (error: any) {
        console.error('[CRON] Daily reconciliation job failed:', error.message);
      }
    });
    console.log('📊 [DailyReconciliation] Daily reconciliation scheduled (1:00 AM IST)');
    
    // GIFT City Product Maintenance - Run daily at 2:00 AM IST (8:30 PM UTC previous day)
    cron.schedule('30 20 * * *', async () => {
      console.log('[CRON] Starting GIFT City product maintenance...');
      try {
        const result = await giftCityMaintenanceService.runMaintenance();
        console.log(`[CRON] GIFT City maintenance completed:`);
        console.log(`  - Total products: ${result.totalProducts}`);
        console.log(`  - Validated: ${result.validatedProducts}`);
        console.log(`  - Updated: ${result.updatedProducts}`);
        if (result.issues.length > 0) {
          console.warn(`  - Issues found: ${result.issues.length}`);
        }
      } catch (error: any) {
        console.error('[CRON] GIFT City maintenance job failed:', error.message);
      }
    });
    console.log('🏙️ [GiftCityMaintenance] Daily maintenance scheduled (2:00 AM IST)');
  } else {
    console.log('⏭️ [CompanyRefresh/Reconciliation/GIFTCity] Skipped (development mode - production only)');
  }

  // Proactive Cache Warming Service - Warms popular data every 30 minutes (read-only, OK in dev)
  try {
    proactiveCacheWarmingService.start();
    console.log('[CRON] Proactive Cache Warming Service started');
  } catch (error: any) {
    console.error('[CRON] Failed to start Proactive Cache Warming Service:', error.message);
  }
  
  console.log('✓ Cron jobs initialized successfully');
}

// Fixed Income Status Engine - Run daily at 6:00 AM IST (12:30 AM UTC) (production only)
if (isProductionEnvironment()) {
  cron.schedule('30 0 * * *', async () => {
    console.log('[CRON] Starting Fixed Income status refresh...');
    try {
      const result = await runDailyFixedIncomeRefresh();
      if (result.success) {
        console.log(`[CRON] Fixed Income refresh completed: ${result.message}`);
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
