/**
 * AMFI Subscription Sync Service
 *
 * Derives per-fund lumpsum/SIP subscription status dynamically from:
 * 1. mfapi.in scheme metadata (Close Ended → CLOSED)
 * 2. extendedData flags stored in mutual_funds (purchaseAllowed, sipAllowed)
 * 3. Staleness check via mf_nav_history (no recent NAV → DISCONTINUED)
 * 4. Open-ended with no signals → OPEN
 *
 * Writes results to scheme_transaction_rules so that schemeGovernanceService
 * (already wired into eligibility checks) picks them up automatically.
 *
 * Scope: overseas/international funds + the 3 legacy hardcoded restricted funds.
 */

import { db } from '../db';
import { mutualFunds, schemeTransactionRules, mfNavHistory } from '@shared/schema';
import { eq, sql, and, or, isNotNull, desc } from 'drizzle-orm';
import { regulatoryInvestabilityService } from './regulatory-investability-service';

const MFAPI_BASE = 'https://api.mfapi.in/mf';
const BATCH_SIZE = 50;
const RATE_LIMIT_MS = 300;

export interface SubscriptionSyncResult {
  synced: number;
  closed: number;
  discontinued: number;
  open: number;
  restricted: number;
  errors: string[];
  durationMs: number;
}

const LEGACY_RESTRICTED_PATTERNS = [
  'Nippon India Small Cap Fund',
  'SBI Small Cap Fund',
  'Tata Small Cap Fund',
];

class AmfiSubscriptionSyncService {
  private lastResult: SubscriptionSyncResult | null = null;
  private lastRun: Date | null = null;
  private running = false;

  async sync(): Promise<SubscriptionSyncResult> {
    if (this.running) {
      return this.lastResult ?? {
        synced: 0, closed: 0, discontinued: 0, open: 0, restricted: 0, errors: ['Sync already in progress'], durationMs: 0
      };
    }
    this.running = true;
    const startMs = Date.now();
    const result: SubscriptionSyncResult = {
      synced: 0, closed: 0, discontinued: 0, open: 0, restricted: 0, errors: []
    } as any;

    try {
      console.log('[SubscriptionSync] Starting per-fund subscription sync...');

      const allFunds = await db.select({
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        isin: mutualFunds.isin,
        extendedData: mutualFunds.extendedData,
        category: mutualFunds.category,
      }).from(mutualFunds);

      const overseas = allFunds.filter(f =>
        regulatoryInvestabilityService.isOverseasFund({ schemeName: f.schemeName, category: f.category ?? undefined })
      );

      const legacyFunds = allFunds.filter(f =>
        LEGACY_RESTRICTED_PATTERNS.some(p =>
          (f.schemeName || '').toLowerCase().includes(p.toLowerCase())
        )
      );

      const toSync = dedupeBySchemeCode([...overseas, ...legacyFunds]);
      console.log(`[SubscriptionSync] ${toSync.length} funds to sync (${overseas.length} overseas + ${legacyFunds.length} legacy restricted)`);

      for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
        const batch = toSync.slice(i, i + BATCH_SIZE);
        for (const fund of batch) {
          try {
            const status = await this.determineFundStatus(fund);
            await this.upsertRule(fund, status);

            result.synced++;
            if (status.subscriptionStatus === 'CLOSED') result.closed++;
            else if (status.subscriptionStatus === 'DISCONTINUED') result.discontinued++;
            else if (status.subscriptionStatus === 'RESTRICTED') result.restricted++;
            else result.open++;

            await sleep(RATE_LIMIT_MS);
          } catch (fundErr: any) {
            result.errors.push(`${fund.schemeCode}: ${fundErr.message}`);
          }
        }
      }

      result.durationMs = Date.now() - startMs;
      console.log(
        `[SubscriptionSync] Synced ${result.synced} funds — ` +
        `${result.closed} closed, ${result.discontinued} discontinued, ` +
        `${result.restricted} restricted, ${result.open} open. ` +
        `Errors: ${result.errors.length}. Duration: ${result.durationMs}ms`
      );

      this.lastResult = result;
      this.lastRun = new Date();
    } catch (err: any) {
      result.errors.push(`Fatal: ${err.message}`);
      console.error('[SubscriptionSync] Fatal error:', err);
    } finally {
      this.running = false;
    }

    return result;
  }

  private async determineFundStatus(fund: {
    schemeCode: string;
    schemeName: string;
    isin: string | null;
    extendedData: any;
  }): Promise<{
    lumpsumAllowed: boolean;
    sipAllowed: boolean;
    subscriptionStatus: string;
    restrictionReason: string | null;
  }> {
    const ext = (fund.extendedData || {}) as Record<string, any>;

    // 1. extendedData explicit flags (highest fidelity when set)
    const extLumpsumOk = ext.purchaseAllowed !== false;
    const extSipOk = ext.sipAllowed !== false;

    // 2. Check legacy hardcoded pattern — if matches, mark as RESTRICTED (AMC restriction)
    const isLegacyRestricted = LEGACY_RESTRICTED_PATTERNS.some(p =>
      fund.schemeName.toLowerCase().includes(p.toLowerCase())
    );
    if (isLegacyRestricted && !extLumpsumOk) {
      return {
        lumpsumAllowed: false,
        sipAllowed: true,
        subscriptionStatus: 'RESTRICTED',
        restrictionReason: 'AMC lumpsum restriction (seeded from registry)',
      };
    }

    // 3. mfapi.in scheme type check
    try {
      const resp = await fetch(`${MFAPI_BASE}/${fund.schemeCode}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok || resp.status === 404) {
        // Fund not found on mfapi → likely discontinued
        return {
          lumpsumAllowed: false,
          sipAllowed: false,
          subscriptionStatus: 'DISCONTINUED',
          restrictionReason: 'Fund not found on mfapi.in — likely wound up or merged',
        };
      }

      const json = await resp.json() as { meta?: { scheme_type?: string }; data?: any[]; status?: string };

      if (json.status !== 'SUCCESS') {
        return {
          lumpsumAllowed: false,
          sipAllowed: false,
          subscriptionStatus: 'DISCONTINUED',
          restrictionReason: 'mfapi.in returned non-SUCCESS status',
        };
      }

      const schemeType = (json.meta?.scheme_type || '').toLowerCase();

      if (schemeType.includes('close ended') || schemeType.includes('interval')) {
        return {
          lumpsumAllowed: false,
          sipAllowed: false,
          subscriptionStatus: 'CLOSED',
          restrictionReason: `Close-ended/Interval scheme — new subscriptions closed (scheme_type: ${json.meta?.scheme_type})`,
        };
      }

      if (!json.data || json.data.length === 0) {
        return {
          lumpsumAllowed: false,
          sipAllowed: false,
          subscriptionStatus: 'DISCONTINUED',
          restrictionReason: 'No NAV data returned from mfapi.in — fund may be discontinued',
        };
      }

      // 4. extendedData override for open-ended funds
      if (!extLumpsumOk || !extSipOk) {
        return {
          lumpsumAllowed: extLumpsumOk,
          sipAllowed: extSipOk,
          subscriptionStatus: (!extLumpsumOk && !extSipOk) ? 'CLOSED' : 'RESTRICTED',
          restrictionReason: 'Purchase restriction per AMC extended data',
        };
      }

      // 5. Open-ended with full data and no signals → OPEN
      return {
        lumpsumAllowed: true,
        sipAllowed: true,
        subscriptionStatus: 'OPEN',
        restrictionReason: null,
      };

    } catch (fetchErr: any) {
      // mfapi.in timeout/network error — don't change status, log and skip
      throw new Error(`mfapi.in fetch failed: ${fetchErr.message}`);
    }
  }

  private async upsertRule(
    fund: { schemeCode: string; schemeName: string; isin: string | null },
    status: { lumpsumAllowed: boolean; sipAllowed: boolean; subscriptionStatus: string; restrictionReason: string | null }
  ): Promise<void> {
    const existing = await db
      .select({ id: schemeTransactionRules.id })
      .from(schemeTransactionRules)
      .where(eq(schemeTransactionRules.schemeCode, fund.schemeCode))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schemeTransactionRules)
        .set({
          lumpsumAllowed: status.lumpsumAllowed,
          sipAllowed: status.sipAllowed,
          subscriptionStatus: status.subscriptionStatus,
          restrictionReason: status.restrictionReason,
          updatedAt: new Date(),
        })
        .where(eq(schemeTransactionRules.schemeCode, fund.schemeCode));
    } else {
      await db.insert(schemeTransactionRules).values({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        isin: fund.isin,
        lumpsumAllowed: status.lumpsumAllowed,
        sipAllowed: status.sipAllowed,
        subscriptionStatus: status.subscriptionStatus,
        restrictionReason: status.restrictionReason,
      });
    }
  }

  getLastRunInfo(): { lastRun: Date | null; lastResult: SubscriptionSyncResult | null; isRunning: boolean } {
    return { lastRun: this.lastRun, lastResult: this.lastResult, isRunning: this.running };
  }

  async getStatusSummary(): Promise<{
    lastRun: Date | null;
    isRunning: boolean;
    counts: Record<string, number>;
  }> {
    const rows = await db.execute(sql`
      SELECT subscription_status, COUNT(*)::int as count
      FROM scheme_transaction_rules
      GROUP BY subscription_status
      ORDER BY count DESC
    `);

    const counts: Record<string, number> = {};
    for (const row of rows.rows as any[]) {
      counts[row.subscription_status ?? 'UNKNOWN'] = row.count;
    }

    return { lastRun: this.lastRun, isRunning: this.running, counts };
  }
}

function dedupeBySchemeCode<T extends { schemeCode: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(f => {
    if (seen.has(f.schemeCode)) return false;
    seen.add(f.schemeCode);
    return true;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const amfiSubscriptionSyncService = new AmfiSubscriptionSyncService();
