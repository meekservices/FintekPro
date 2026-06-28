/**
 * @file shareholding-service.ts
 * @description Fetches quarterly shareholding pattern data from BSE/NSE (free, public).
 *
 * Sources (priority order):
 *  1. BSE Shareholding Pattern API — JSON endpoint, primary source
 *  2. NSE Shareholding Pattern CSV — fallback
 *
 * Schedule: Quarterly, triggered after SEBI LODR filing deadlines:
 *  Q1 (Apr-Jun): Aug 21 | Q2 (Jul-Sep): Nov 21 | Q3 (Oct-Dec): Feb 21 | Q4 (Jan-Mar): May 30
 *
 * Data written to: screener_shareholding table (unique per symbol + quarterDate)
 *
 * @outputs Promoter%, FII%, DII%, MF%, Public%, Pledged%, QoQ changes
 */

import { db } from "../../db";
import { screenerShareholding } from "@shared/schema/screener";
import { screenerStocks } from "@shared/schema/screener";
import { eq, desc } from "drizzle-orm";

const BSE_SHAREHOLDING_URL = "https://api.bseindia.com/BseIndiaAPI/api/ShareHoldingPatterns/w";
const NSE_SHAREHOLDING_URL = "https://www.nseindia.com/api/shareholding-patterns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareholdingData {
  symbol: string;
  quarterDate: string;  // 'YYYY-MM-DD'
  quarterLabel: string; // 'Mar 2025'
  promoterHolding: number | null;
  promoterGroupHolding: number | null;
  fiiHolding: number | null;
  diiHolding: number | null;
  mutualFundHolding: number | null;
  publicHolding: number | null;
  otherHolding: number | null;
  pledgedShares: number | null;
  totalShares: number | null;
  dataSource: string;
}

// ─── Quarter label helpers ────────────────────────────────────────────────────

function getQuarterLabel(quarterDate: string): string {
  const d = new Date(quarterDate);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getCurrentExpectedQuarter(): { date: string; label: string } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  // Q4 results (Jan-Mar) filed by May 30 → expect 'Mar YYYY'
  if (month >= 6) return { date: `${year}-03-31`, label: `Mar ${year}` };
  // Q3 results (Oct-Dec) filed by Feb 21 → expect 'Dec YYYY-1'
  if (month >= 3) return { date: `${year - 1}-12-31`, label: `Dec ${year - 1}` };
  // Q2 results (Jul-Sep) filed by Nov 21 → expect 'Sep YYYY-1'
  return { date: `${year - 1}-09-30`, label: `Sep ${year - 1}` };
}

// ─── BSE Shareholding Fetch ───────────────────────────────────────────────────

async function fetchFromBSE(bseCode: string, symbol: string): Promise<ShareholdingData | null> {
  try {
    const url = `${BSE_SHAREHOLDING_URL}?scripcode=${bseCode}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://www.bseindia.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();

    // BSE API returns array of quarterly records
    if (!Array.isArray(data) || !data.length) return null;
    const latest = data[0]; // Most recent quarter

    // Parse BSE shareholding format
    // Field names vary — normalize common patterns
    const promoter = parseFloat(latest.Promoter_Grp || latest.promoterAndPromoterGroupPercentage || '0');
    const fii = parseFloat(latest.FII || latest.foreignPortfolioInvestors || '0');
    const dii = parseFloat(latest.DII || latest.domesticInstitutionalInvestors || '0');
    const mf = parseFloat(latest.MutualFunds || latest.mutualFunds || '0');
    const publicH = parseFloat(latest.Public || latest.publicShareholders || '0');
    const pledged = parseFloat(latest.Pledged || latest.percentageOfSharesPledged || '0');
    const total = parseFloat(latest.TotalShares || latest.totalNumberOfSharesHeldByPromoters || '0');

    const quarterDate = latest.QUARTER_END || latest.quarterEndDate || getCurrentExpectedQuarter().date;
    const normalizedDate = quarterDate.split('T')[0]; // Ensure YYYY-MM-DD

    return {
      symbol,
      quarterDate: normalizedDate,
      quarterLabel: getQuarterLabel(normalizedDate),
      promoterHolding: isNaN(promoter) ? null : promoter,
      promoterGroupHolding: isNaN(promoter) ? null : promoter,
      fiiHolding: isNaN(fii) ? null : fii,
      diiHolding: isNaN(dii) ? null : dii,
      mutualFundHolding: isNaN(mf) ? null : mf,
      publicHolding: isNaN(publicH) ? null : publicH,
      otherHolding: null,
      pledgedShares: isNaN(pledged) ? null : pledged,
      totalShares: isNaN(total) ? null : total,
      dataSource: 'bse',
    };
  } catch (err) {
    console.warn(`[Shareholding] BSE fetch failed for ${symbol}:`, (err as Error).message);
    return null;
  }
}

// ─── NSE Shareholding Fetch (fallback) ───────────────────────────────────────

async function fetchFromNSE(nseSymbol: string): Promise<ShareholdingData | null> {
  try {
    const url = `${NSE_SHAREHOLDING_URL}?symbol=${encodeURIComponent(nseSymbol)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FintekPro/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.data?.length) return null;
    const latest = data.data[0];

    // NSE format normalization
    const promoter = parseFloat(latest.promoterAndPromoterGroupShareholding || '0');
    const fii = parseFloat(latest.fiiShareholding || '0');
    const dii = parseFloat(latest.diiShareholding || '0');
    const mf = parseFloat(latest.mutualFundShareholding || '0');
    const publicH = parseFloat(latest.publicShareholding || '0');
    const pledged = parseFloat(latest.promoterAndPromoterGroupSharesPledgedPercent || '0');

    const quarterDate = latest.shareholdingDate || getCurrentExpectedQuarter().date;
    const normalizedDate = quarterDate.split('T')[0];

    return {
      symbol: nseSymbol,
      quarterDate: normalizedDate,
      quarterLabel: getQuarterLabel(normalizedDate),
      promoterHolding: isNaN(promoter) ? null : promoter,
      promoterGroupHolding: isNaN(promoter) ? null : promoter,
      fiiHolding: isNaN(fii) ? null : fii,
      diiHolding: isNaN(dii) ? null : dii,
      mutualFundHolding: isNaN(mf) ? null : mf,
      publicHolding: isNaN(publicH) ? null : publicH,
      otherHolding: null,
      pledgedShares: isNaN(pledged) ? null : pledged,
      totalShares: null,
      dataSource: 'nse',
    };
  } catch (err) {
    console.warn(`[Shareholding] NSE fetch failed for ${nseSymbol}:`, (err as Error).message);
    return null;
  }
}

// ─── Compute QoQ Changes ─────────────────────────────────────────────────────

async function computeQoQChanges(symbol: string, current: ShareholdingData): Promise<{
  promoterHoldingChange: number | null;
  fiiHoldingChange: number | null;
  diiHoldingChange: number | null;
  pledgedSharesChange: number | null;
}> {
  try {
    // Fetch the previous quarter's record
    const prev = await db
      .select()
      .from(screenerShareholding)
      .where(eq(screenerShareholding.symbol, symbol))
      .orderBy(desc(screenerShareholding.quarterDate))
      .limit(1);

    if (!prev.length) {
      return { promoterHoldingChange: null, fiiHoldingChange: null, diiHoldingChange: null, pledgedSharesChange: null };
    }

    const p = prev[0];
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      promoterHoldingChange: current.promoterHolding !== null && p.promoterHolding !== null
        ? round2(current.promoterHolding - Number(p.promoterHolding)) : null,
      fiiHoldingChange: current.fiiHolding !== null && p.fiiHolding !== null
        ? round2(current.fiiHolding - Number(p.fiiHolding)) : null,
      diiHoldingChange: current.diiHolding !== null && p.diiHolding !== null
        ? round2(current.diiHolding - Number(p.diiHolding)) : null,
      pledgedSharesChange: current.pledgedShares !== null && p.pledgedShares !== null
        ? round2(current.pledgedShares - Number(p.pledgedShares)) : null,
    };
  } catch {
    return { promoterHoldingChange: null, fiiHoldingChange: null, diiHoldingChange: null, pledgedSharesChange: null };
  }
}

// ─── Upsert to DB ─────────────────────────────────────────────────────────────

async function upsertShareholding(data: ShareholdingData, qoq: {
  promoterHoldingChange: number | null;
  fiiHoldingChange: number | null;
  diiHoldingChange: number | null;
  pledgedSharesChange: number | null;
}): Promise<void> {
  await db
    .insert(screenerShareholding)
    .values({
      symbol: data.symbol,
      quarterDate: data.quarterDate,
      quarterLabel: data.quarterLabel,
      promoterHolding: data.promoterHolding?.toString(),
      promoterGroupHolding: data.promoterGroupHolding?.toString(),
      fiiHolding: data.fiiHolding?.toString(),
      diiHolding: data.diiHolding?.toString(),
      mutualFundHolding: data.mutualFundHolding?.toString(),
      publicHolding: data.publicHolding?.toString(),
      otherHolding: data.otherHolding?.toString(),
      pledgedShares: data.pledgedShares?.toString(),
      totalShares: data.totalShares?.toString(),
      promoterHoldingChange: qoq.promoterHoldingChange?.toString(),
      fiiHoldingChange: qoq.fiiHoldingChange?.toString(),
      diiHoldingChange: qoq.diiHoldingChange?.toString(),
      pledgedSharesChange: qoq.pledgedSharesChange?.toString(),
      dataSource: data.dataSource,
    })
    .onConflictDoUpdate({
      target: [screenerShareholding.symbol, screenerShareholding.quarterDate],
      set: {
        promoterHolding: data.promoterHolding?.toString(),
        fiiHolding: data.fiiHolding?.toString(),
        diiHolding: data.diiHolding?.toString(),
        mutualFundHolding: data.mutualFundHolding?.toString(),
        publicHolding: data.publicHolding?.toString(),
        pledgedShares: data.pledgedShares?.toString(),
        promoterHoldingChange: qoq.promoterHoldingChange?.toString(),
        fiiHoldingChange: qoq.fiiHoldingChange?.toString(),
        diiHoldingChange: qoq.diiHoldingChange?.toString(),
        pledgedSharesChange: qoq.pledgedSharesChange?.toString(),
        lastUpdated: new Date(),
      },
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches and stores shareholding pattern for a single stock.
 * Tries BSE first, NSE as fallback.
 *
 * @param symbol NSE symbol (e.g. 'RELIANCE')
 * @param bseCode BSE scrip code (e.g. '500325')
 */
export async function fetchShareholdingForSymbol(symbol: string, bseCode?: string): Promise<boolean> {
  let data: ShareholdingData | null = null;

  if (bseCode) {
    data = await fetchFromBSE(bseCode, symbol);
  }
  if (!data) {
    data = await fetchFromNSE(symbol);
  }
  if (!data) {
    console.warn(`[Shareholding] No data found for ${symbol}`);
    return false;
  }

  const qoq = await computeQoQChanges(symbol, data);
  await upsertShareholding(data, qoq);
  console.log(`[Shareholding] ✓ ${symbol} | Q: ${data.quarterLabel} | Promoter: ${data.promoterHolding}% | FII: ${data.fiiHolding}%`);
  return true;
}

/**
 * Batch job: fetch shareholding for all active stocks in screener_stocks.
 * Runs quarterly. Respects rate limits (500ms between calls).
 *
 * @param limit  Max stocks to process per run (default: all)
 */
export async function runShareholdingBatchJob(limit?: number): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const startTime = Date.now();
  console.log(`[Shareholding] Starting batch job${limit ? ` (limit: ${limit})` : ''}`);

  const stocks = await db
    .select({ symbol: screenerStocks.symbol })
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true))
    .limit(limit ?? 10000);

  let succeeded = 0, failed = 0;
  for (const stock of stocks) {
    try {
      const ok = await fetchShareholdingForSymbol(stock.symbol);
      if (ok) succeeded++; else failed++;
    } catch (err) {
      console.error(`[Shareholding] Error for ${stock.symbol}:`, (err as Error).message);
      failed++;
    }
    // Rate limit: 500ms between calls to respect BSE/NSE limits
    await new Promise(r => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Shareholding] Batch complete in ${elapsed}s — OK: ${succeeded} | Failed: ${failed}`);
  return { processed: stocks.length, succeeded, failed };
}

/**
 * Get the latest shareholding data for a stock (for API response).
 */
export async function getShareholdingForSymbol(symbol: string): Promise<typeof screenerShareholding.$inferSelect | null> {
  const result = await db
    .select()
    .from(screenerShareholding)
    .where(eq(screenerShareholding.symbol, symbol))
    .orderBy(desc(screenerShareholding.quarterDate))
    .limit(1);

  return result[0] ?? null;
}
