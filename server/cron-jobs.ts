import cron from 'node-cron';
import { storage } from './storage';
import { DealMatcherService } from './services/deal-matcher';
import { probe42Service } from './services/probe42-service';
import { stockSyncScheduler } from './services/stock-sync-scheduler';
import { getProbe42AnalyticsService } from './services/probe42-analytics-service';

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

  // Order Cleanup Job - Run every 12 hours (more frequent for better user experience)
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
        
        // Log for audit trail
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

  // Expiry Warning Job - Run daily at 9 AM IST (3:30 AM UTC)
  // Alerts users when their listings will expire within 24 hours
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
        
        // TODO: Send notifications to users about expiring listings
        // This can be integrated with the notification service
        
        // Log for audit
        for (const listing of expiringListings) {
          console.log(`[CRON][WARN] Sell listing ${listing.id} expires at ${listing.validUntil}`);
        }
        for (const request of expiringRequests) {
          console.log(`[CRON][WARN] Buy request ${request.id} expires at ${request.validUntil}`);
        }
      } else {
        console.log('[CRON] No listings expiring within 24 hours');
      }
    } catch (error: any) {
      console.error('[CRON] Expiry warning job failed:', error.message);
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

  // Probe42 Prospecting Alerts - Run daily at 8 AM IST (2:30 AM UTC)
  cron.schedule('30 2 * * *', async () => {
    console.log('[CRON] Starting Probe42 prospecting alerts check...');
    try {
      const analyticsService = getProbe42AnalyticsService();
      
      // Check for high-value prospects
      const alerts = await analyticsService.checkProspectingThresholds({
        minRevenue: 100000000, // 10 Cr+
        minProfit: 10000000,   // 1 Cr+
        minLeadScore: 70,
      });
      
      console.log(`[CRON] Prospecting alerts: ${alerts.length} new high-value prospects identified`);
      
      // Log summary for monitoring
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
      
      // Get all leads with CINs
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
            // Update lead score in database
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
          
          // TODO: Send notification to user about expired order
          // This can be integrated with the notification service
          
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

  stockSyncScheduler.initialize();
  console.log('✓ Cron jobs initialized successfully');
}
