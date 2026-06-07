/**
 * Unlisted Marketplace & Company Intelligence Cron Domain
 *
 * Credhive sync · Unlisted listing / buy-request expiry & cleanup
 * Price suggestions · MoneyControl scrape · Bond calendar
 * MF NAV pre-warm · Monthly MF returns
 * Credhive prospecting alerts · Lead scoring
 * Company data refresh · Proactive cache warming
 * MCA enrichment sweep · Valuation governance
 */

import cron from 'node-cron';
import { storage } from './storage';
import { DealMatcherService } from './services/deal-matcher';
import { credhiveService } from './services/credhive-service';
import { unlistedFinancialEnrichmentService } from './services/unlisted-financial-enrichment-service';
import { getCredhiveAnalyticsService } from './services/credhive-analytics-service';
import { companyDataRefreshScheduler } from './services/company-data-refresh-scheduler';
import { proactiveCacheWarmingService } from './services/proactive-cache-warming-service';
import { unlistedListingTracker } from './services/unlisted-listing-tracker';
import { db } from './db';
import { users, unlistedCompanies } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { isProductionEnvironment } from './utils/enrichment-guard';

export function initializeUnlistedCrons(): void {

  // ── STEP 0: Force-expire daily_picks for CONFIRMED-LISTED companies ──────────
  // These companies were previously tracked as unlisted but have since completed
  // their IPO and listed on NSE/BSE. The tracker may miss them if:
  //  a) lastSyncedAt is within 20 h (throttle gate), or
  //  b) the unlistedCompanies record has no ISIN/CIN (name-only), or
  //  c) their record was never in the unlistedCompanies table.
  // This runs every startup as a safety net — no admin action required.
  //
  // How to add entries: { nameFragment: 'first word of company name', symbol: 'NSE_SYMBOL', listedOn: 'YYYY-MM-DD' }
  const CONFIRMED_LISTED_COMPANIES: Array<{ nameFragment: string; symbol: string; exchange: string; listedOn: string }> = [
    { nameFragment: 'Swiggy',   symbol: 'SWIGGY',  exchange: 'NSE', listedOn: '2024-11-13' },
    { nameFragment: 'Hyundai',  symbol: 'HYUNDAI', exchange: 'NSE', listedOn: '2024-10-22' },
  ];

  (async () => {
    try {
      const { sql: sqlRaw } = await import('drizzle-orm');
      let totalExpired = 0;
      for (const co of CONFIRMED_LISTED_COMPANIES) {
        // 1. Mark unlistedCompanies record as listed (if it exists)
        await db.execute(sqlRaw`
          UPDATE unlisted_companies
          SET status = 'inactive', listing_stage = 'listed', updated_at = NOW()
          WHERE LOWER(name) LIKE LOWER(${'%' + co.nameFragment + '%'})
            AND (listing_stage IS NULL OR listing_stage != 'listed')
        `);

        // 2. Expire live unlisted picks for this company
        const result = await db.execute(sqlRaw`
          UPDATE daily_picks
          SET status = 'expired', updated_at = NOW()
          WHERE category = 'unlisted'
            AND status = 'live'
            AND LOWER(instrument_name) LIKE LOWER(${'%' + co.nameFragment + '%'})
        `);
        const count = (result as any).rowCount ?? 0;
        if (count > 0) {
          totalExpired += count;
          console.log(JSON.stringify({
            event: 'KNOWN_LISTED_COMPANY_PICK_EXPIRED',
            user_id: 'system',
            latency_ms: 0,
            status: 'success',
            company: co.nameFragment,
            symbol: co.symbol,
            exchange: co.exchange,
            listedOn: co.listedOn,
            picksExpired: count,
            timestamp: new Date().toISOString(),
          }));
        }
      }
      if (totalExpired > 0) {
        console.log(`[ListingTracker] Known-listed cleanup: expired ${totalExpired} stale unlisted pick(s) on startup`);
      } else {
        console.log('[ListingTracker] Known-listed cleanup: no stale picks found');
      }
    } catch (err: any) {
      console.error('[ListingTracker] Known-listed startup cleanup failed:', err?.message);
    }
  })();

  // ── Listing transition sweep — run immediately on startup, then daily at 7 AM IST ──
  // This detects unlisted companies that have since completed their IPO (e.g. Swiggy)
  // and marks them correctly so they stop appearing in unlisted picks.
  (async () => {
    try {
      const results = await unlistedListingTracker.runTransitionSweep();
      if (results.length > 0) {
        console.log(`[ListingTracker] Startup sweep: ${results.length} company(ies) transitioned to listed:`, results.map(r => r.companyName).join(', '));
      } else {
        console.log('[ListingTracker] Startup sweep: no new listing transitions found');
      }
    } catch (err) {
      console.error('[ListingTracker] Startup sweep failed:', err);
    }
  })();

  if (!isProductionEnvironment()) {
    console.log('⏭️ [Credhive Sync] Skipped (development mode - production only)');
    console.log('⏭️ [OrderCleanup] Skipped (development mode - production only)');
    console.log('⏭️ [ExpiryWarning] Skipped (development mode - production only)');
    console.log('⏭️ [Price/MoneyControl/BondCalendar] Skipped (development mode - production only)');
    console.log('⏭️ [MF Cron Jobs] Monthly Returns, NAV Pre-warm SKIPPED (development mode)');
    console.log('⏭️ [Credhive Alerts/Lead Scoring] Skipped (development mode - production only)');
    console.log('⏭️ [ProspectAutoScoring] Nightly scoring skipped (development mode - production only)');
    console.log('⏭️ [CompanyRefresh] Skipped (development mode - production only)');
    console.log('⏭️ [CacheWarming] Skipped (development mode - production only)');
    return;
  }

  // ── Daily listing transition sweep — 7 AM IST (1:30 AM UTC) ─────────────────
  cron.schedule('30 1 * * *', async () => {
    console.log('[CRON][ListingTracker] Running daily listing transition sweep...');
    try {
      const results = await unlistedListingTracker.runTransitionSweep();
      console.log(`[CRON][ListingTracker] Sweep complete: ${results.length} transitioned`);
      results.forEach(r =>
        console.log(`  ✅ ${r.companyName} → ${r.exchange}:${r.nseSymbol} (${r.listedOn}), ${r.picksExpired} pick(s) expired`)
      );
    } catch (err) {
      console.error('[CRON][ListingTracker] Daily sweep failed:', err);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('📋 [ListingTracker] Daily listing transition sweep scheduled at 7:00 AM IST');

  // ── Expired unlisted listings / buy-requests — every 12 hours ─────────────
  cron.schedule('0 */12 * * *', async () => {
    console.log('[CRON] Starting order cleanup job...');
    try {
      const dealMatcher = new DealMatcherService(storage);
      const { expiredListings, expiredRequests } = await dealMatcher.cleanupExpiredOrders();
      if (expiredListings > 0 || expiredRequests > 0) {
        console.log(`[CRON] Cleanup: ${expiredListings} expired listings, ${expiredRequests} expired requests`);
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

  // ── Expiry warning — daily at 9 AM IST (3:30 AM UTC) ──────────────────────
  cron.schedule('30 3 * * *', async () => {
    console.log('[CRON] Checking for listings expiring soon...');
    try {
      const { sellListings, buyRequests } = await import('@shared/schema');
      const { and, gte, lte } = await import('drizzle-orm');
      const { emailService } = await import('./email-service');

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const expiringListings = await db.select({
        id: sellListings.id,
        userId: sellListings.sellerUserId,
        companyId: sellListings.companyId,
        quantity: sellListings.quantity,
        pricePerShare: sellListings.askPrice,
        validUntil: sellListings.validUntil,
      }).from(sellListings).where(
        and(eq(sellListings.status, 'active'), gte(sellListings.validUntil, now), lte(sellListings.validUntil, tomorrow))
      ).limit(100);

      const expiringRequests = await db.select({
        id: buyRequests.id,
        userId: buyRequests.buyerUserId,
        companyId: buyRequests.companyId,
        quantity: buyRequests.quantity,
        maxPricePerShare: buyRequests.maxPrice,
        validUntil: buyRequests.validUntil,
      }).from(buyRequests).where(
        and(eq(buyRequests.status, 'active'), gte(buyRequests.validUntil, now), lte(buyRequests.validUntil, tomorrow))
      ).limit(100);

      if (expiringListings.length > 0 || expiringRequests.length > 0) {
        console.log(`[CRON] ${expiringListings.length} listings + ${expiringRequests.length} requests expiring in 24 h`);

        for (const listing of expiringListings) {
          try {
            const user = await db.select().from(users).where(eq(users.id, listing.userId)).limit(1);
            if (user[0]?.email) {
              const company = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, listing.companyId)).limit(1);
              const companyName = company[0]?.name || 'Unlisted Stock';
              await emailService.sendEmail({
                to: user[0].email,
                subject: `⏰ Your sell listing expires in 24 hours - ${companyName}`,
                html: `<h2>Listing Expiry Reminder</h2><p>Your sell listing for <strong>${companyName}</strong> expires soon. Quantity: ${listing.quantity || 0} shares @ ₹${listing.pricePerShare ? parseFloat(String(listing.pricePerShare)).toLocaleString('en-IN') : 'N/A'}/share.</p><p>Log in to FintekPro to extend or modify your listing.</p>`,
                text: `Your sell listing for ${companyName} expires in 24 hours.`,
              });
            }
          } catch (err) {
            console.error(`[CRON] Failed to send notification for listing ${listing.id}:`, err);
          }
        }

        for (const request of expiringRequests) {
          try {
            const user = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
            if (user[0]?.email) {
              const company = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.id, request.companyId)).limit(1);
              const reqCompanyName = company[0]?.name || 'Unlisted Stock';
              const { emailService: es } = await import('./email-service');
              await es.sendEmail({
                to: user[0].email,
                subject: `⏰ Your buy request expires in 24 hours - ${reqCompanyName}`,
                html: `<h2>Buy Request Expiry Reminder</h2><p>Your buy request for <strong>${reqCompanyName}</strong> expires soon. Quantity: ${request.quantity || 0} @ max ₹${request.maxPricePerShare ? parseFloat(String(request.maxPricePerShare)).toLocaleString('en-IN') : 'N/A'}/share.</p><p>Log in to FintekPro to extend or modify your request.</p>`,
                text: `Your buy request for ${reqCompanyName} expires in 24 hours.`,
              });
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

  // ── Price suggestions — every 12 hours ────────────────────────────────────
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
        } catch {}
      }
      console.log(`[CRON] Price suggestions refreshed for ${refreshed} companies`);
    } catch (error: any) {
      console.error('[CRON] Price suggestion refresh failed:', error);
    }
  });

  // ── MoneyControl price sync — daily at 9 PM IST (3:30 PM UTC) ─────────────
  cron.schedule('30 15 * * *', async () => {
    console.log('[CRON] Starting MoneyControl price sync...');
    try {
      const { moneyControlScraper } = await import('./services/moneycontrol-scraper');
      const result = await moneyControlScraper.executeImport();
      console.log(`[CRON] MoneyControl sync: ${result.imported} imported, ${result.matched} matched, ${result.unmatchedCompanies.length} unmatched`);
    } catch (error: any) {
      console.error('[CRON] MoneyControl price sync failed:', error.message);
    }
  });

  // ── Bond financial calendar — daily at 6 AM IST (12:30 AM UTC) ────────────
  cron.schedule('30 0 * * *', async () => {
    console.log('[CRON] Starting bond calendar refresh...');
    try {
      const { financialCalendarService } = await import('./services/financial-calendar-service');
      const result = await financialCalendarService.refreshCalendar();
      console.log(`[CRON] Bond calendar refreshed: ${result.synced} events synced`);
      if (result.errors.length > 0) console.warn('[CRON] Bond calendar errors:', result.errors);
    } catch (error: any) {
      console.error('[CRON] Bond calendar refresh failed:', error.message);
    }
  });

  // ── MF NAV pre-warm — daily at 9:05 AM IST (3:35 AM UTC) ──────────────────
  cron.schedule('35 3 * * *', async () => {
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

  // ── Monthly returns — 1st of month at 6 AM IST (12:30 AM UTC) ─────────────
  cron.schedule('30 0 1 * *', async () => {
    const { isEnrichmentWindow } = await import('./utils/enrichment-guard');
    if (!isEnrichmentWindow()) { console.log('⏭️ [Monthly Returns] Outside 8PM-8AM IST window, skipping'); return; }
    console.log('[CRON] Starting monthly returns calculation...');
    try {
      const { mfDataSyncService } = await import('./services/mf-data-sync-service');
      const { mutualFunds } = await import('@shared/schema');
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

  // ── Credhive prospecting alerts — daily at 8 AM IST (2:30 AM UTC) ──────────
  cron.schedule('30 2 * * *', async () => {
    console.log('[CRON] Starting Credhive prospecting alerts check...');
    try {
      const analyticsService = getCredhiveAnalyticsService();
      const alerts = await analyticsService.checkProspectingThresholds({
        minRevenue: 100_000_000,
        minProfit: 10_000_000,
        minLeadScore: 70,
      });
      console.log(`[CRON] Prospecting alerts: ${alerts.length} new high-value prospects`);
      const hotAlerts = alerts.filter(a => a.priority === 'high').length;
      if (hotAlerts > 0) console.log(`[CRON] 🔥 ${hotAlerts} HOT leads require immediate attention`);
    } catch (error: any) {
      console.error('[CRON] Prospecting alerts check failed:', error.message);
    }
  });

  // ── Lead scoring — weekly Sunday at 6 AM IST (12:30 AM UTC) ───────────────
  cron.schedule('30 0 * * 0', async () => {
    console.log('[CRON] Starting weekly lead scoring refresh...');
    try {
      const { prospectLeads } = await import('@shared/schema');
      const { isNotNull, eq: eqDrizzle } = await import('drizzle-orm');
      const analyticsService = getCredhiveAnalyticsService();
      const leads = await db.select({ id: prospectLeads.id, cin: prospectLeads.cin })
        .from(prospectLeads).where(isNotNull(prospectLeads.cin)).limit(100);
      let scored = 0;
      for (const lead of leads) {
        if (lead.cin) {
          const score = await analyticsService.calculateSmartLeadScore(lead.cin);
          if (score) {
            await db.update(prospectLeads).set({ leadScore: score.totalScore, leadQuality: score.leadGrade, updatedAt: new Date() })
              .where(eqDrizzle(prospectLeads.id, lead.id));
            scored++;
          }
        }
      }
      console.log(`[CRON] Lead scoring completed: ${scored} leads updated`);
    } catch (error: any) {
      console.error('[CRON] Lead scoring refresh failed:', error.message);
    }
  });

  // ── Prospect Wealth + Scoring Engine — nightly at 3 AM IST (9:30 PM UTC) ───
  // Upgrade 5: Auto-score unscored and stale prospect leads every night
  cron.schedule('30 21 * * *', async () => {
    console.log('[CRON][ProspectAutoScoring] Starting nightly prospect scoring...');
    try {
      const { bulkScoreProspects } = await import('./services/prospect-scoring-engine');
      const result = await bulkScoreProspects({ limit: 200, staleAfterDays: 7, triggeredBy: 'nightly_cron' });
      console.log(`[CRON][ProspectAutoScoring] Done: ${result.succeeded} scored, ${result.failed} failed (of ${result.processed} checked)`);
      if (result.errors.length > 0) {
        console.warn('[CRON][ProspectAutoScoring] Errors:', result.errors.slice(0, 5).join('; '));
      }
    } catch (error: any) {
      console.error('[CRON][ProspectAutoScoring] Nightly scoring failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('⚡ [ProspectAutoScoring] Nightly scoring cron scheduled (3:00 AM IST)');


  // ── Proactive cache warming ─────────────────────────────────────────────────
  try {
    proactiveCacheWarmingService.start();
    console.log('[CRON] Proactive Cache Warming Service started');
  } catch (error: any) {
    console.error('[CRON] Failed to start Proactive Cache Warming Service:', error.message);
  }
}


// ── Valuation Governance — quarterly, 1st of Jan/Apr/Jul/Oct at 3 AM IST ───
if (isProductionEnvironment()) {
  cron.schedule('0 21 1 */3 *', async () => {
    console.log('[CRON][ValuationGovernance] Starting quarterly staleness sweep...');
    try {
      const { unlistedValuationGovernanceService } = await import('./services/unlisted-valuation-governance-service');
      const report = await unlistedValuationGovernanceService.runStalenessSweep();
      console.log(`[CRON][ValuationGovernance] Sweep complete: ${report.markedStale} newly stale, ${report.alreadyStale} already stale, ${report.neverValued} never valued (of ${report.totalChecked} checked)`);
    } catch (error: any) {
      console.error('[CRON][ValuationGovernance] Quarterly sweep failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });
  console.log('📊 [ValuationGovernance] Quarterly staleness cron scheduled (3:00 AM IST, 1st of Jan/Apr/Jul/Oct)');
} else {
  console.log('⏭️ [ValuationGovernance] Quarterly staleness cron skipped (development mode - production only)');
}
