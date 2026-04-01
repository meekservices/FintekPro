import { db } from '../db';
import { commodities } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { callPython } from '../clients/python-client';

interface CommodityPriceData {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  source: string;
}

/**
 * Commodity Price Sync Scheduler — 3-tier market-segregated routing
 *
 * Tier 1 – Alpha Vantage (GLOBAL_QUOTE for futures symbols)
 *   Precious metals: Gold (GC=F), Silver (SI=F), Platinum (PL=F), Palladium (PA=F)
 *   Energy:          Crude WTI (CL=F), Natural Gas (NG=F), Copper (HG=F)
 *   → Completely separate infra from Yahoo. No rate-limit competition.
 *
 * Tier 2 – Python / yfinance batch (/market/quotes)
 *   Agricultural: Wheat (ZW=F), Corn (ZC=F), Cotton (CT=F), Coffee (KC=F)
 *   + fallback for any Tier 1 misses
 *   → Python service already has Google Finance JSONP concurrent fallback built in.
 *
 * Tier 3 – Yahoo Finance direct HTTP (last resort only)
 *   Only for symbols both Tier 1 and Tier 2 failed to price.
 */
class CommodityPriceSyncScheduler {
  private syncIntervalMs = 6 * 60 * 60 * 1000; // every 6 hours (commodities move intraday)
  private isRunning = false;
  private syncTimer: NodeJS.Timeout | null = null;

  // Internal symbol → Yahoo futures ticker (used for all API calls)
  private readonly FUTURES_SYMBOLS: Record<string, string> = {
    'GOLD':        'GC=F',
    'SILVER':      'SI=F',
    'PLATINUM':    'PL=F',
    'PALLADIUM':   'PA=F',
    'CRUDE_OIL':   'CL=F',
    'NATURAL_GAS': 'NG=F',
    'COPPER':      'HG=F',
    'WHEAT':       'ZW=F',
    'CORN':        'ZC=F',
    'COTTON':      'CT=F',
    'COFFEE':      'KC=F',
    'BRENT':       'BZ=F',
  };

  // Tier 1: Alpha Vantage (precious metals + energy — separate infra from Yahoo)
  private readonly AV_SYMBOLS = new Set([
    'GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM',
    'CRUDE_OIL', 'NATURAL_GAS', 'COPPER', 'BRENT',
  ]);

  // Tier 2: Python/yfinance primary (agricultural); AV misses also fall here
  private readonly PYTHON_PRIMARY_SYMBOLS = new Set([
    'WHEAT', 'CORN', 'COTTON', 'COFFEE',
  ]);

  constructor() {
    console.log('✅ Commodity Price Sync Scheduler initialized (3-tier: AV → Python/yfinance → Yahoo)');
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[CommoditySync] Starting — refreshes every 6 hours, first run at T+9 min');

    setTimeout(async () => {
      try { await this.runPriceRefresh(); }
      catch (err) { console.error('[CommoditySync] Startup refresh failed:', err); }
    }, 9 * 60 * 1000);

    this.scheduleNextSync();
  }

  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    console.log('[CommoditySync] Scheduler stopped');
  }

  private scheduleNextSync(): void {
    this.syncTimer = setTimeout(async () => {
      try { await this.runPriceRefresh(); }
      catch (err) { console.error('[CommoditySync] Scheduled refresh failed:', err); }
      if (this.isRunning) this.scheduleNextSync();
    }, this.syncIntervalMs);
    console.log(`[CommoditySync] Next sync in ${this.syncIntervalMs / 60000} minutes`);
  }

  // ── Tier 1: Alpha Vantage GLOBAL_QUOTE ────────────────────────────────────
  private async fetchAlphaVantagePrice(internalSymbol: string): Promise<CommodityPriceData | null> {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return null;

    const futuresSym = this.FUTURES_SYMBOLS[internalSymbol.toUpperCase()];
    if (!futuresSym) return null;

    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(futuresSym)}&apikey=${apiKey}`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'Accept': 'application/json', 'User-Agent': 'FintekPro/2.5' },
      });
      if (!resp.ok) return null;

      const json = await resp.json();
      if (json['Note'] || json['Information'] || json['Error Message']) return null;

      const q = json['Global Quote'];
      if (!q || !q['05. price']) return null;

      const price     = parseFloat(q['05. price']);
      const prevClose = parseFloat(q['08. previous close']) || undefined;
      const change    = parseFloat(q['09. change']) || undefined;
      const changePct = parseFloat((q['10. change percent'] || '0').replace('%', '')) || undefined;

      return {
        symbol: internalSymbol,
        price,
        previousClose: prevClose,
        change,
        changePercent: changePct,
        high: parseFloat(q['03. high']) || undefined,
        low:  parseFloat(q['04. low'])  || undefined,
        source: 'alpha_vantage',
      };
    } catch {
      return null;
    }
  }

  // ── Tier 2: Python / yfinance batch (/market/quotes) ─────────────────────
  private async fetchPythonBatchPrices(internalSymbols: string[]): Promise<Map<string, CommodityPriceData>> {
    const results = new Map<string, CommodityPriceData>();
    if (!internalSymbols.length) return results;

    const futuresSymbols = internalSymbols
      .map(s => ({ internal: s, futures: this.FUTURES_SYMBOLS[s.toUpperCase()] }))
      .filter(x => x.futures);

    if (!futuresSymbols.length) return results;

    try {
      const resp = await callPython<{ results: Record<string, any>; count: number }>(
        '/market/quotes', 'POST',
        { symbols: futuresSymbols.map(x => x.futures) },
      );
      if (!resp?.results) return results;

      for (const { internal, futures } of futuresSymbols) {
        const q = resp.results[futures];
        if (!q?.price) continue;
        results.set(internal, {
          symbol:       internal,
          price:        parseFloat(q.price),
          previousClose: q.previousClose != null ? parseFloat(q.previousClose) : undefined,
          change:        q.change        != null ? parseFloat(q.change)        : undefined,
          changePercent: q.changePercent != null ? parseFloat(q.changePercent) : undefined,
          high:          q.dayHigh       != null ? parseFloat(q.dayHigh)       : undefined,
          low:           q.dayLow        != null ? parseFloat(q.dayLow)        : undefined,
          source: 'python-yfinance',
        });
      }
    } catch (err: any) {
      console.warn(`[CommoditySync] Python batch failed: ${err.message}`);
    }

    return results;
  }

  // ── Tier 3: Yahoo Finance direct HTTP (last resort) ───────────────────────
  private async fetchYahooPrice(internalSymbol: string): Promise<CommodityPriceData | null> {
    const futuresSym = this.FUTURES_SYMBOLS[internalSymbol.toUpperCase()];
    if (!futuresSym) return null;

    try {
      const resp = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(futuresSym)}?interval=1d&range=5d`,
        {
          signal: AbortSignal.timeout(10000),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        },
      );
      if (!resp.ok) return null;

      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      if (!result) return null;

      const meta     = result.meta;
      const price    = meta.regularMarketPrice || 0;
      const prevClose = (meta.previousClose && meta.previousClose > 0) ? meta.previousClose : null;
      const change   = prevClose != null ? price - prevClose : undefined;
      const changePct = prevClose != null && prevClose > 0
        ? ((price - prevClose) / prevClose) * 100
        : undefined;
      const indicators = result.indicators?.quote?.[0];

      return {
        symbol:        internalSymbol,
        price,
        previousClose: prevClose ?? undefined,
        change,
        changePercent: changePct,
        high: indicators?.high?.[indicators.high.length - 1],
        low:  indicators?.low?.[indicators.low.length - 1],
        source: 'yahoo_finance',
      };
    } catch {
      return null;
    }
  }

  // ── Persist one commodity price update to DB ───────────────────────────────
  private async persistPrice(commodityId: string, currentPrice: string, priceData: CommodityPriceData): Promise<void> {
    await db.update(commodities).set({
      previousClose:    currentPrice,
      currentPrice:     priceData.price.toString(),
      dayChange:        priceData.change?.toString(),
      dayChangePercent: priceData.changePercent?.toString(),
      weekHigh:         priceData.high?.toString(),
      weekLow:          priceData.low?.toString(),
      dataSource:       priceData.source,
      lastUpdated:      new Date(),
    }).where(eq(commodities.id, commodityId));
  }

  // ── Main refresh — runs the full 3-tier waterfall ─────────────────────────
  async runPriceRefresh(): Promise<{ updated: number; errors: number }> {
    console.log('[CommoditySync] Starting 3-tier price refresh...');
    let updated = 0;
    let errors  = 0;

    const staleThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const staleCommodities = await db.select({
      id:           commodities.id,
      symbol:       commodities.symbol,
      currentPrice: commodities.currentPrice,
    })
      .from(commodities)
      .where(sql`${commodities.lastUpdated} IS NULL OR ${commodities.lastUpdated} < ${staleThreshold}`)
      .orderBy(sql`${commodities.lastUpdated} ASC NULLS FIRST`)
      .limit(50);

    if (!staleCommodities.length) {
      console.log('[CommoditySync] All commodity prices are fresh');
      return { updated, errors };
    }

    console.log(`[CommoditySync] ${staleCommodities.length} stale commodities → starting tiered refresh`);

    const priced  = new Map<string, CommodityPriceData>(); // internal symbol → data
    const byId    = new Map<string, { id: string; currentPrice: string }>(); // internal symbol → db row
    for (const c of staleCommodities) {
      if (c.symbol) byId.set(c.symbol.toUpperCase(), { id: c.id, currentPrice: c.currentPrice?.toString() || '0' });
    }

    const allSymbols = staleCommodities.map(c => c.symbol?.toUpperCase()).filter(Boolean) as string[];

    // ── Tier 1: Alpha Vantage for precious metals + energy ─────────────────
    const avSymbols = allSymbols.filter(s => this.AV_SYMBOLS.has(s));
    if (avSymbols.length && process.env.ALPHA_VANTAGE_API_KEY) {
      console.log(`[CommoditySync] Tier 1 — Alpha Vantage for ${avSymbols.length} metals/energy`);
      const settled = await Promise.allSettled(avSymbols.map(s => this.fetchAlphaVantagePrice(s)));
      let avHit = 0;
      for (let i = 0; i < avSymbols.length; i++) {
        const r = settled[i];
        if (r.status === 'fulfilled' && r.value && r.value.price > 0) {
          priced.set(avSymbols[i], r.value);
          avHit++;
        }
      }
      console.log(`[CommoditySync] AV fetched ${avHit}/${avSymbols.length}`);
    }

    // ── Tier 2: Python/yfinance batch ──────────────────────────────────────
    // Primary for agricultural; also picks up any Tier 1 misses
    const pythonNeeded = allSymbols.filter(s => !priced.has(s));
    if (pythonNeeded.length) {
      console.log(`[CommoditySync] Tier 2 — Python/yfinance batch for ${pythonNeeded.length} symbols`);
      const pythonResults = await this.fetchPythonBatchPrices(pythonNeeded);
      for (const [sym, data] of pythonResults) {
        priced.set(sym, data);
      }
      console.log(`[CommoditySync] Python filled ${pythonResults.size}/${pythonNeeded.length}`);
    }

    // ── Tier 3: Yahoo Finance — last resort, sequential ────────────────────
    const yahooNeeded = allSymbols.filter(s => !priced.has(s));
    if (yahooNeeded.length) {
      console.log(`[CommoditySync] Tier 3 — Yahoo last-resort for ${yahooNeeded.length} symbols`);
      for (const sym of yahooNeeded) {
        try {
          const data = await this.fetchYahooPrice(sym);
          if (data && data.price > 0) priced.set(sym, data);
          await new Promise(r => setTimeout(r, 800)); // respect Yahoo rate limits
        } catch { /* skip */ }
      }
    }

    // ── Persist all priced results to DB ──────────────────────────────────
    for (const [sym, data] of priced) {
      const row = byId.get(sym);
      if (!row) continue;
      try {
        await this.persistPrice(row.id, row.currentPrice, data);
        updated++;
      } catch (err: any) {
        errors++;
        console.error(`[CommoditySync] DB save failed for ${sym}: ${err.message}`);
      }
    }

    const missed = allSymbols.filter(s => !priced.has(s));
    if (missed.length) {
      errors += missed.length;
      console.warn(`[CommoditySync] ${missed.length} symbols had no price from any tier: ${missed.join(', ')}`);
    }

    console.log(`[CommoditySync] Refresh complete — updated: ${updated}, errors: ${errors}`);
    return { updated, errors };
  }

  async runStartupCatchUp(): Promise<{ updated: number; errors: number }> {
    console.log('[CommoditySync] Running startup catch-up...');
    const result = await this.runPriceRefresh();
    console.log(`[CommoditySync] Startup catch-up done: ${result.updated} updated, ${result.errors} errors`);
    return result;
  }

  async getStatus(): Promise<{
    totalCommodities: number;
    staleCommodities: number;
    recentlyUpdated:  number;
    isRunning: boolean;
  }> {
    const staleThreshold  = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentThreshold = new Date(Date.now() - 60 * 60 * 1000);

    const [total]  = await db.select({ count: sql<number>`count(*)` }).from(commodities);
    const [stale]  = await db.select({ count: sql<number>`count(*)` }).from(commodities)
      .where(sql`${commodities.lastUpdated} IS NULL OR ${commodities.lastUpdated} < ${staleThreshold}`);
    const [recent] = await db.select({ count: sql<number>`count(*)` }).from(commodities)
      .where(sql`${commodities.lastUpdated} > ${recentThreshold}`);

    return {
      totalCommodities: Number(total?.count  || 0),
      staleCommodities: Number(stale?.count  || 0),
      recentlyUpdated:  Number(recent?.count || 0),
      isRunning: this.isRunning,
    };
  }
}

export const commodityPriceSyncScheduler = new CommodityPriceSyncScheduler();
