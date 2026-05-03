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
import { logger } from '../logger';

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

  logger.info('[IRISSync] Created default portfolio', { userId });
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
      logger.error('[IRISSync] Deferred refresh failed', { pan, error: err?.message });
    }
  }, 5_000);
}

/**
 * Fetch the full portfolio summary from IRIS for a PAN and upsert into
 * comprehensiveHoldings with dataSource='kfintech'.
 * Idempotent — running multiple times is safe.
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
    logger.warn('[IRISSync] No user found for PAN. Aborting sync.', { pan });
    return { synced: 0, errors: [`No user found with PAN ${pan}`] };
  }

  console.log(`[IRISSync] Starting sync for PAN ${pan} (User: ${resolvedUserId})`);

  let portfolioData: any;
  try {
    portfolioData = await irisKfintechService.getPortfolioSummary(pan);
  } catch (err: any) {
    logger.error('[IRISSync] IRIS portfolio fetch failed', { pan, error: err?.message });
    return { synced: 0, errors: [`IRIS fetch failed: ${err?.message}`] };
  }

  const holdings: any[] = portfolioData?.holdings ?? portfolioData?.data?.holdings ?? [];
  if (!holdings.length) {
    logger.info('[IRISSync] IRIS returned 0 holdings', { pan });
    return { synced: 0, errors: [] };
  }

  // Look up (or create) the user's default portfolio
  let portfolioId: string;
  try {
    portfolioId = await getOrCreateDefaultPortfolio(resolvedUserId);
  } catch (e: any) {
    logger.error('[IRISSync] Portfolio lookup failed', { userId: resolvedUserId, error: e?.message });
    return { synced: 0, errors: [`Portfolio link failed: ${e?.message}`] };
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let synced = 0;

  for (const h of holdings) {
    try {
      const isin        = h.isin ?? h.ISIN ?? null;
      const folioNo     = h.folioNumber ?? h.folio ?? h.folioNo ?? 'N/A';
      const schemeName  = h.schemeName ?? h.scheme_name ?? h.name ?? h.fundName ?? 'Mutual Fund';
      const symbol      = h.schemeCode ?? h.scheme_code ?? isin ?? schemeName.slice(0, 20);
      
      const units       = parseFloat(h.units ?? h.qty ?? h.balance ?? '0');
      const nav         = parseFloat(h.nav ?? h.currentNav ?? h.navValue ?? '0');
      const mktValue    = parseFloat(h.marketValue ?? h.currentValue ?? (units * nav).toString());
      const invested    = parseFloat(h.investedValue ?? h.costBasis ?? h.purchaseValue ?? '0');

      await db
        .insert(comprehensiveHoldings)
        .values({
          id:             nanoid(),
          portfolioId,
          userId:         resolvedUserId,
          holdingDate:    today,
          symbol,
          isin,
          assetName:      schemeName,
          assetType:      'mutual_fund',
          assetClass:     h.category ?? h.assetClass ?? null,
          units:          String(units),
          avgPrice:       units > 0 ? String(invested / units) : '0',
          currentPrice:   String(nav),
          marketValue:    String(mktValue),
          investedValue:  String(invested),
          currency:       'INR',
          isAdr:          false,
          exchangeMic:    h.exchange === 'BSE' ? 'XBOM' : 'XNSE',
          dataSource:     'kfintech',
          enrichmentSource: 'kfintech',
          lastEnrichedAt: new Date(),
          folio:          folioNo,
          lastUpdated:    new Date(),
          metadata: {
            amcName:      h.amcName || h.amc || null,
            registrar:    'kfintech',
            syncedAt:     new Date().toISOString(),
            kfintechId:   h.kfintechId || null,
            folioNature:  h.folioNature || null,
          },
        })
        .onConflictDoUpdate({
          target: [comprehensiveHoldings.userId, comprehensiveHoldings.isin, comprehensiveHoldings.folio],
          set: {
            units:          String(units),
            marketValue:    String(mktValue),
            currentPrice:   String(nav),
            lastEnrichedAt: new Date(),
            lastUpdated:    new Date(),
            updatedAt:      new Date(),
          }
        });

      synced++;
    } catch (e: any) {
      logger.error('[IRISSync] Holding record failed', { isin: h.isin, error: e.message });
      errors.push(`Holding record failed (${h.isin ?? '?'}): ${e?.message}`);
    }
  }

  logger.info('[IRISSync] Sync complete', { pan, synced, errorCount: errors.length });
  return { synced, errors };
}

// ─── Nightly CAS sync ────────────────────────────────────────────────────────

/**
 * Nightly job: sync IRIS portfolio for all active investors.
 */
export async function runNightlyIrisCasSync(): Promise<void> {
  logger.info('[IRISSync] Starting nightly CAS sync…');
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
  logger.info('[IRISSync] Nightly CAS sync complete', { total, success, failed });
}

// ─── LRS Remittance Logging ───────────────────────────────────────────────────

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

    logger.info('[LRS] Recorded remittance', { userId, amountUsd, financialYear });
  } catch (err: any) {
    logger.error('[LRS] Remittance log failed', { error: err?.message });
  }
}
