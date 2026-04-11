/**
 * IRIS Portfolio Sync Service (Gap 4: Bidirectional Reconciliation)
 *
 * After every IRIS transaction (purchase, redemption, SIP), this service
 * schedules a deferred portfolio refresh that upserts comprehensiveHoldings
 * with the latest KFintech MF data for the investor.
 *
 * Nightly CAS sync is also managed here.
 */

import { db } from '../db';
import {
  comprehensiveHoldings,
  portfolios,
  users,
  usBrokerAccounts,
  lrsRemittanceLogs,
} from '@shared/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { irisKfintechService } from './iris-kfintech-service';
import { currencyExchangeService } from './currency-exchange-service';

// ─── Portfolio helpers ────────────────────────────────────────────────────────

async function getOrCreateDefaultPortfolio(userId: string): Promise<string> {
  const existing = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.userId, userId), eq(portfolios.isDefault, true)))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const [created] = await db
    .insert(portfolios)
    .values({ userId, name: 'Default Portfolio', isDefault: true, totalValue: '0', cash: '0' })
    .returning({ id: portfolios.id });

  console.log(`[IRISSync] Created default portfolio for user ${userId}`);
  return created.id;
}

// ─── Post-transaction write-back ─────────────────────────────────────────────

/**
 * Triggered after a successful IRIS purchase, redemption, or SIP registration.
 * Schedules a non-blocking portfolio refresh so comprehensiveHoldings stays in sync.
 * Uses a 5-second delay to give KFintech time to process the transaction.
 */
export function scheduleIrisPortfolioRefresh(pan: string, userId?: string): void {
  if (!pan) return;
  setTimeout(async () => {
    try {
      await syncIrisHoldingsForPan(pan, userId);
    } catch (err: any) {
      console.warn(`[IRISSync] Deferred refresh failed for PAN ${pan}:`, err?.message);
    }
  }, 5_000);
}

/**
 * Fetch the full portfolio summary from IRIS for a PAN and upsert into
 * comprehensiveHoldings with dataSource='kfintech'.
 * Idempotent — running multiple times is safe (delete-then-insert per user).
 */
export async function syncIrisHoldingsForPan(pan: string, userId?: string): Promise<{
  synced: number;
  errors: string[];
}> {
  const errors: string[] = [];

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.panNumber, pan))
      .limit(1);
    resolvedUserId = u?.id;
  }

  if (!resolvedUserId) {
    errors.push(`No user found for PAN ${pan}`);
    return { synced: 0, errors };
  }

  let portfolioData: any;
  try {
    portfolioData = await irisKfintechService.getPortfolioSummary(pan);
  } catch (err: any) {
    errors.push(`IRIS portfolio fetch failed: ${err?.message}`);
    return { synced: 0, errors };
  }

  const holdings: any[] = portfolioData?.holdings ?? portfolioData?.data?.holdings ?? [];
  if (!holdings.length) return { synced: 0, errors };

  // Look up (or create) the user's default portfolio
  let portfolioId: string;
  try {
    portfolioId = await getOrCreateDefaultPortfolio(resolvedUserId);
  } catch (e: any) {
    errors.push(`Portfolio lookup failed: ${e?.message}`);
    return { synced: 0, errors };
  }

  // Full-sync strategy: delete stale kfintech holdings then re-insert fresh ones
  await db
    .delete(comprehensiveHoldings)
    .where(and(
      eq(comprehensiveHoldings.userId, resolvedUserId),
      eq(comprehensiveHoldings.dataSource, 'kfintech'),
    ));

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  let synced = 0;
  for (const h of holdings) {
    try {
      const isin        = h.isin ?? h.ISIN ?? null;
      const folioNo     = h.folioNumber ?? h.folio ?? h.folioNo ?? null;
      const schemeName  = h.schemeName ?? h.scheme_name ?? h.name ?? 'Unknown';
      const schemeCode  = h.schemeCode ?? h.scheme_code ?? isin ?? schemeName.slice(0, 20);
      const units       = parseFloat(h.units ?? h.qty ?? h.balance ?? '0');
      const nav         = parseFloat(h.nav ?? h.currentNav ?? h.navValue ?? '0');
      const mktValue    = parseFloat(h.marketValue ?? h.currentValue ?? (units * nav).toString());
      const invested    = parseFloat(h.investedValue ?? h.costBasis ?? h.purchaseValue ?? '0');
      const gainLoss    = mktValue - invested;
      const gainLossPct = invested > 0 ? (gainLoss / invested) * 100 : 0;
      const avgPrice    = units > 0 ? invested / units : 0;

      await db.insert(comprehensiveHoldings).values({
        portfolioId,
        userId: resolvedUserId,
        holdingDate: today,
        symbol:     schemeCode,
        isin,
        assetName:  schemeName,
        assetType:  'mutual_fund',
        assetClass: h.category ?? h.assetClass ?? null,
        units:          String(units),
        avgPrice:       String(avgPrice),
        currentPrice:   String(nav),
        marketValue:    String(mktValue),
        investedValue:  String(invested),
        gainLoss:       String(gainLoss),
        gainLossPercent: String(gainLossPct),
        dataSource:     'kfintech',
        folio:          folioNo,
        lastUpdated:    new Date(),
        metadata: {
          amcName:    h.amcName ?? h.amc ?? null,
          registrar:  'kfintech',
          syncedAt:   new Date().toISOString(),
        },
      });
      synced++;
    } catch (e: any) {
      errors.push(`Holding insert failed (${h.isin ?? '?'}): ${e?.message}`);
    }
  }

  console.log(`[IRISSync] Synced ${synced} holdings for PAN ${pan} (userId ${resolvedUserId})`);
  return { synced, errors };
}

// ─── Nightly CAS sync (Gap 4: scheduled reconciliation) ──────────────────────

/**
 * Nightly job: iterate all registered users whose panNumber is set and who have
 * a usBrokerAccount (indicating they are active on the platform), then sync
 * their IRIS portfolio into comprehensiveHoldings.
 *
 * Runs in production only (called from server/index.ts cron scheduler).
 * Staggers each call by 2 seconds to avoid IRIS rate limits.
 */
export async function runNightlyIrisCasSync(): Promise<void> {
  console.log('[IRISSync] Starting nightly CAS sync…');
  let total = 0, success = 0, failed = 0;

  const usersWithPan = await db
    .selectDistinct({ id: users.id, pan: users.panNumber })
    .from(users)
    .innerJoin(usBrokerAccounts, eq(usBrokerAccounts.clientId, users.id))
    .where(isNotNull(users.panNumber));

  for (const u of usersWithPan) {
    if (!u.pan) continue;
    total++;
    await new Promise(r => setTimeout(r, 2_000));
    try {
      const result = await syncIrisHoldingsForPan(u.pan, u.id);
      if (result.errors.length === 0) success++;
      else failed++;
    } catch {
      failed++;
    }
  }
  console.log(`[IRISSync] Nightly CAS sync complete: ${total} users, ${success} ok, ${failed} errors`);
}

// ─── LRS Remittance Logging ───────────────────────────────────────────────────

/**
 * Record a new ACH transfer in lrs_remittance_logs and update usBrokerAccounts.lrsUsedUsd.
 * Called from the ACH transfer confirmation webhook / status update handler.
 * Uses the transferId as a unique key to prevent double-counting.
 */
export async function recordLrsRemittance(params: {
  userId: string;
  alpacaAccountId: string;
  transferId: string;
  amountUsd: number;
  financialYear: string;
}): Promise<void> {
  const { userId, alpacaAccountId, transferId, amountUsd, financialYear } = params;
  try {
    let usdInrRate = 84;
    try {
      usdInrRate = await currencyExchangeService.getExchangeRate('USD', 'INR');
    } catch { /* fallback */ }

    await db
      .insert(lrsRemittanceLogs)
      .values({
        id: nanoid(),
        userId,
        alpacaAccountId,
        transferId,
        amountUsd: String(amountUsd),
        amountInr: String(amountUsd * usdInrRate),
        usdInrRate: String(usdInrRate),
        financialYear,
        transferDate: new Date(),
      })
      .onConflictDoNothing();

    await db
      .update(usBrokerAccounts)
      .set({
        lrsUsedUsd: String(amountUsd),
        lrsFinancialYear: financialYear,
        updatedAt: new Date(),
      })
      .where(eq(usBrokerAccounts.clientId, userId));

    console.log(`[LRS] Recorded remittance $${amountUsd} for user ${userId} (FY ${financialYear})`);
  } catch (err: any) {
    console.error('[LRS] Remittance log failed:', err?.message);
  }
}
