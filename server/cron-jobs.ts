import cron from 'node-cron';
import { storage } from './storage';
import { DealMatcherService } from './services/deal-matcher';
import { probe42Service } from './services/probe42-service';

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

  console.log('✓ Cron jobs initialized successfully');
}
