/**
 * CAMS Holdings Sync Service
 *
 * Purpose : Bridge between CamsApiService.getInvestorPortfolio() and
 *           comprehensiveHoldings — same pattern as syncIrisHoldingsForPan().
 *
 * Flow:
 *   1. Call CAMS API → getInvestorPortfolio(pan) → FolioDetails[]
 *   2. Map each folio to a comprehensiveHoldings row (dataSource: "cams")
 *   3. Upsert by (userId, isin, folio) — no duplicates
 *   4. Return { synced, errors }
 *
 * GCR:
 *   - Drizzle ORM only — no raw SQL mutations
 *   - All writes include updatedAt + dataSource: "cams" (source: "kfintech" pattern)
 *   - Retries: 3 attempts with exponential backoff on transient CAMS API failures
 *   - PAN masked in all logs
 */

import { db } from "../db";
import {
  comprehensiveHoldings,
  portfolios,
  users,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { camsApi } from "../cams-api";
import { logger } from "../logger";
import { nanoid } from "nanoid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateDefaultPortfolio(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .limit(1);
  if (existing) return existing.id;

  const newId = nanoid(12);
  await db.insert(portfolios).values({
    id: newId,
    userId,
    name: "My Portfolio",
    isDefault: true,
    source: "cams",
  });
  return newId;
}

function retryableError(msg: string): boolean {
  return /timeout|ECONNRESET|ETIMEDOUT|503|502|429/i.test(msg);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!retryableError(msg) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 1000));
    }
  }
  throw lastErr;
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Fetches CAMS portfolio for a PAN and upserts all folios into comprehensiveHoldings.
 *
 * @param pan    - Investor PAN
 * @param userId - (optional) pre-resolved user ID; resolved from PAN if absent
 * @returns      - { synced, errors }
 *
 * GCR: All writes use Drizzle ORM. PAN masked in logs.
 */
export async function syncCamsHoldingsForPan(
  pan: string,
  userId?: string,
): Promise<{ synced: number; errors: string[] }> {
  const logCtx = { event: "CAMS_SYNC", pan_masked: pan.slice(0, 3) + "**" };
  const errors: string[] = [];

  // Resolve userId from PAN if not provided
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const [userRow] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.panNumber, pan))
      .limit(1);
    if (!userRow) {
      logger.warn("[CAMSSync] No user found for PAN — aborting", logCtx);
      return { synced: 0, errors: [`No user found for PAN ${pan.slice(0, 3)}**`] };
    }
    resolvedUserId = userRow.id;
  }

  // Fetch CAMS portfolio
  let folios: Awaited<ReturnType<typeof camsApi.getInvestorPortfolio>>;
  try {
    folios = await withRetry(() => camsApi.getInvestorPortfolio(pan));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[CAMSSync] CAMS API fetch failed", { ...logCtx, error: msg });
    return { synced: 0, errors: [`CAMS API error: ${msg}`] };
  }

  if (!folios?.length) {
    logger.info("[CAMSSync] CAMS returned 0 folios", logCtx);
    return { synced: 0, errors: [] };
  }

  logger.info("[CAMSSync] Fetched CAMS folios", { ...logCtx, count: folios.length });

  const portfolioId = await getOrCreateDefaultPortfolio(resolvedUserId);
  let synced = 0;

  for (const folio of folios) {
    try {
      const symbol = (folio as any).schemeCode || (folio as any).isin || `CAMS_${nanoid(6)}`;
      const isin: string | undefined = (folio as any).isin;
      const folioNo: string = (folio as any).folioNumber || (folio as any).Folio || "";
      const schemeName: string = (folio as any).schemeName || (folio as any).SchemeName || symbol;
      const units: number = Number((folio as any).currentUnits ?? (folio as any).Units ?? 0);
      const nav: number = Number((folio as any).nav ?? (folio as any).NAV ?? 0);
      const marketValue: number = units * nav;
      const investedValue: number = Number((folio as any).investedValue ?? (folio as any).PurchaseCost ?? 0);
      const gainLoss: number = marketValue - investedValue;
      const gainLossPercent: number = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

      // Upsert by (userId, isin, folio) — unique index in schema
      const [existing] = await db
        .select({ id: comprehensiveHoldings.id })
        .from(comprehensiveHoldings)
        .where(
          and(
            eq(comprehensiveHoldings.userId, resolvedUserId!),
            isin ? eq(comprehensiveHoldings.isin, isin) : eq(comprehensiveHoldings.folio, folioNo),
            eq(comprehensiveHoldings.folio, folioNo),
          ),
        )
        .limit(1);

      const holdingData = {
        portfolioId,
        userId: resolvedUserId!,
        holdingDate: new Date().toISOString().split("T")[0],
        symbol,
        isin,
        assetName: schemeName,
        assetType: "mutual_fund",
        units: String(units),
        avgPrice: nav > 0 ? String(investedValue / (units || 1)) : null,
        currentPrice: String(nav),
        marketValue: String(marketValue),
        investedValue: String(investedValue),
        gainLoss: String(gainLoss),
        gainLossPercent: String(gainLossPercent.toFixed(4)),
        dataSource: "cams",
        folio: folioNo,
        registrarType: "CAMS",
        updatedAt: new Date(),
        metadata: {
          syncedAt: new Date().toISOString(),
          source: "cams_api",
          schemeCode: (folio as any).schemeCode,
        },
      };

      if (existing) {
        await db
          .update(comprehensiveHoldings)
          .set(holdingData)
          .where(eq(comprehensiveHoldings.id, existing.id));
      } else {
        await db.insert(comprehensiveHoldings).values({
          id: nanoid(12),
          ...holdingData,
        });
      }

      synced++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Folio ${(folio as any).folioNumber}: ${msg}`);
      logger.error("[CAMSSync] Folio upsert failed", { ...logCtx, error: msg });
    }
  }

  logger.info("[CAMSSync] Sync complete", { ...logCtx, synced, errors: errors.length });
  return { synced, errors };
}

/**
 * Nightly CAMS sync: iterates all users with PAN and syncs CAMS holdings.
 * Called by cron-iris-sync.ts at 02:30 AM IST alongside KFintech sync.
 * 2s delay between PANs to avoid CAMS rate limits.
 *
 * GCR: Self-healing — individual PAN failures don't stop the batch.
 */
export async function runNightlyCAMSSync(): Promise<void> {
  logger.info("[CAMSSync] Starting nightly CAMS sync", {
    event: "CAMS_NIGHTLY_SYNC_START",
    timestamp: new Date().toISOString(),
  });

  const usersWithPan = await db
    .select({ id: users.id, pan: users.panNumber })
    .from(users)
    .where(eq(users.isActive, true));

  let total = 0, success = 0, failed = 0;

  for (const u of usersWithPan) {
    if (!u.pan) continue;
    total++;
    await new Promise((r) => setTimeout(r, 2_000));
    try {
      const result = await syncCamsHoldingsForPan(u.pan, u.id);
      if (result.errors.length === 0) success++;
      else failed++;
    } catch {
      failed++;
    }
  }

  logger.info("[CAMSSync] Nightly CAMS sync complete", {
    event: "CAMS_NIGHTLY_SYNC_COMPLETE",
    total, success, failed,
    timestamp: new Date().toISOString(),
  });
}
