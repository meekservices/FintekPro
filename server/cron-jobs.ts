import cron from 'node-cron';
import { storage } from './storage';
import { DealMatcherService } from './services/deal-matcher';
import { probe42Service } from './services/probe42-service';
import { stockSyncScheduler } from './services/stock-sync-scheduler';

/**
 * Initialize scheduled cron jobs
 */
export function initializeCronJobs(): void {
  console.log('Initializing cron jobs...');

  // Probe42 Sync Job - Run every 6 hours
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

  // Order Cleanup Job - Run every 24 hours
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting order cleanup job...');
    try {
      const dealMatcher = new DealMatcherService(storage);
      const { expiredListings, expiredRequests } =
        await dealMatcher.cleanupExpiredOrders();

      console.log(
        `[CRON] Cleanup completed: ${expiredListings} expired listings, ${expiredRequests} expired requests`
      );
    } catch (error: any) {
      console.error('[CRON] Order cleanup job failed:', error);
    }
  });

  // Price Suggestion Refresh - Run every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    console.log('[CRON] Starting price suggestion refresh...');
    try {
      const companies = await storage.getAllUnlistedCompanies({});
      let refreshed = 0;

      for (const company of companies) {
        try {
          // Force refresh by calling the price suggestion service
          const { PriceSuggestionService } = require('./services/price-suggestion');
          const service = new PriceSuggestionService(storage);
          await service.calculateSuggestedPrice(company.id);
          refreshed++;
        } catch (error: any) {
          // Silently fail for individual companies
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

  // Live MF NAV Refresh - Run every day at 10:30 PM IST (5:00 PM UTC) after market close
  cron.schedule('0 17 * * *', async () => {
    console.log('[CRON] Starting live MF NAV refresh...');
    try {
      const { liveMFDataService } = await import('./services/live-mf-data-service');
      const success = await liveMFDataService.refreshCache();
      
      if (success) {
        const stats = liveMFDataService.getCacheStats();
        console.log(`[CRON] Live MF NAV refreshed: ${stats.size} funds loaded from AMFI`);
        
        // Optionally sync to database for top funds
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

  stockSyncScheduler.initialize();
  console.log('✓ Cron jobs initialized successfully');
}
