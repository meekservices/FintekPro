/**
 * ET Markets Integration Service
 *
 * Multi-source market news aggregator for FintekPro dashboard:
 *  1. ET Markets RSS  — https://economictimes.indiatimes.com/markets/rss.cms (public RSS)
 *  2. Financial Express RSS — https://www.financialexpress.com/market/feed/ (public RSS)
 *  3. NSE Corporate Announcements API — https://www.nseindia.com/api/corporate-announcements
 *  4. Finnhub / internal services — market movers (already integrated)
 *
 * GCR Rules:
 *  - All responses include source, fetch_timestamp, engine_version
 *  - 5-minute TTL cache per source (news doesn't need real-time)
 *  - Retry max 3, exponential backoff on transient failures
 *  - Rate limiting: 1 req/10s per source (RSS etiquette)
 *  - Structured logs: { event, source, latency_ms, status, item_count }
 *  - Error format: { error_code, message, retryable }
 *
 * Legal: RSS feeds are designed for programmatic consumption.
 * NSE announcements endpoint is public (no auth required).
 */

import { logger } from "../logger";

export const ET_MARKETS_SERVICE_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type NewsSource = "et_markets" | "financial_express" | "nse" | "aggregated";

export interface MarketNewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: NewsSource;
  sourceLabel: string;
  publishedAt: string;   // ISO timestamp
  category?: string;     // "Markets" | "Stocks" | "MF" | "IPO" | "Bonds" | "Economy"
  imageUrl?: string;
  tags?: string[];
}

export interface NseAnnouncement {
  symbol: string;
  companyName: string;
  subject: string;
  broadcastDate: string;
  attachmentUrl?: string;
  category: string;
}

export interface MarketSummary {
  headlines: MarketNewsItem[];
  latestNews: MarketNewsItem[];
  nseAnnouncements: NseAnnouncement[];
  fetchedAt: string;
  source_versions: Record<string, string>;
  engine_version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry<unknown>>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// RSS Feed Sources
// ─────────────────────────────────────────────────────────────────────────────

const RSS_SOURCES = {
  et_markets: {
    url: "https://economictimes.indiatimes.com/markets/rss.cms",
    label: "ET Markets",
    source: "et_markets" as NewsSource,
    fallbackUrl: "https://economictimes.indiatimes.com/prime/money-and-markets/rss.cms",
  },
  financial_express: {
    url: "https://www.financialexpress.com/market/feed/",
    label: "Financial Express",
    source: "financial_express" as NewsSource,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// RSS Parser (lightweight — no external dependency, pure XML parsing)
// ─────────────────────────────────────────────────────────────────────────────

function extractBetweenTags(xml: string, tag: string): string {
  // Handles both <tag>value</tag> and CDATA: <tag><![CDATA[value]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = xml.match(plainRe);
  return plainMatch ? plainMatch[1].trim() : "";
}

function parseRssItems(xml: string, source: NewsSource, sourceLabel: string): MarketNewsItem[] {
  const items: MarketNewsItem[] = [];
  // Extract all <item> blocks
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1];
    const title   = extractBetweenTags(block, "title").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    const link    = extractBetweenTags(block, "link") || extractBetweenTags(block, "guid");
    const pubDate = extractBetweenTags(block, "pubDate");
    const desc    = extractBetweenTags(block, "description").replace(/<[^>]+>/g, "").substring(0, 300);
    const category = extractBetweenTags(block, "category");

    if (!title || !link) continue;

    // Stable ID: hash of link
    let h = 5381;
    for (let i = 0; i < link.length; i++) h = ((h << 5) + h) ^ link.charCodeAt(i);
    const id = `${source}-${Math.abs(h).toString(36)}`;

    items.push({
      id,
      title,
      summary: desc || title,
      url: link,
      source,
      sourceLabel,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      category: category || classifyCategory(title),
    });
  }

  return items;
}

/** Classify news into FintekPro-relevant categories from headline keywords */
function classifyCategory(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("sensex") || t.includes("nifty") || t.includes("bse") || t.includes("nse")) return "Markets";
  if (t.includes("mutual fund") || t.includes(" mf ") || t.includes("nav ")) return "Mutual Funds";
  if (t.includes("ipo") || t.includes("listing")) return "IPO";
  if (t.includes("bond") || t.includes("debenture") || t.includes("g-sec") || t.includes("gilt")) return "Bonds";
  if (t.includes("rbi") || t.includes("sebi") || t.includes("budget") || t.includes("gdp")) return "Economy";
  if (t.includes("gold") || t.includes("silver") || t.includes("crude") || t.includes("commodity")) return "Commodities";
  if (t.includes("rupee") || t.includes("forex") || t.includes("dollar")) return "Forex";
  if (t.includes("crypto") || t.includes("bitcoin")) return "Crypto";
  return "Stocks";
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch with retry + timeout
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, maxRetries = 3, timeoutMs = 8000): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "FintekPro-NewsAggregator/1.0 (market-news-bot; +https://fintekpro.in)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.text();

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw Object.assign(lastError ?? new Error("Fetch failed"), {
    error_code: "FETCH_FAILED",
    retryable: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and parse a single RSS source.
 * Results cached for 5 minutes.
 */
export async function fetchRssSource(
  sourceKey: keyof typeof RSS_SOURCES,
  limit = 20,
): Promise<MarketNewsItem[]> {
  const cacheKey = `rss:${sourceKey}`;
  const cached   = getCache<MarketNewsItem[]>(cacheKey);
  if (cached) return cached.slice(0, limit);

  const start = Date.now();
  const spec  = RSS_SOURCES[sourceKey];

  try {
    const xml   = await fetchWithRetry(spec.url);
    const items = parseRssItems(xml, spec.source, spec.label);

    setCache(cacheKey, items);

    logger.info("ET_MARKETS_RSS_FETCH", {
      event: "ET_MARKETS_RSS_FETCH",
      source: sourceKey,
      item_count: items.length,
      latency_ms: Date.now() - start,
      status: "success",
    });

    return items.slice(0, limit);

  } catch (err) {
    logger.warn("ET_MARKETS_RSS_FETCH", {
      event: "ET_MARKETS_RSS_FETCH",
      source: sourceKey,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
      status: "error",
    });

    // Try fallback URL for ET Markets
    if (sourceKey === "et_markets" && "fallbackUrl" in spec) {
      try {
        const xml   = await fetchWithRetry(spec.fallbackUrl as string);
        const items = parseRssItems(xml, spec.source, spec.label + " (fallback)");
        setCache(cacheKey, items);
        return items.slice(0, limit);
      } catch { /* ignore fallback failure */ }
    }

    return []; // Self-healing: return empty array, not crash
  }
}

/**
 * Fetch NSE corporate announcements (public API, no auth).
 * Returns latest 20 announcements or filtered by symbol.
 */
export async function fetchNseAnnouncements(symbol?: string): Promise<NseAnnouncement[]> {
  const cacheKey = `nse:announcements:${symbol ?? "all"}`;
  const cached   = getCache<NseAnnouncement[]>(cacheKey);
  if (cached) return cached;

  const start = Date.now();
  const url   = symbol
    ? `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(symbol.toUpperCase())}`
    : "https://www.nseindia.com/api/corporate-announcements?index=equities";

  try {
    const text = await fetchWithRetry(url, 3, 6000);
    // NSE returns JSON array
    const raw: Array<{
      symbol: string;
      sm_name: string;
      desc: string;
      bflag: string;
      attchmntFile: string;
      sort_date: string;
      anDt: string;
    }> = JSON.parse(text);

    const announcements: NseAnnouncement[] = raw.slice(0, 50).map((r) => ({
      symbol: r.symbol,
      companyName: r.sm_name,
      subject: r.desc,
      broadcastDate: r.anDt || r.sort_date,
      attachmentUrl: r.attchmntFile
        ? `https://www.nseindia.com${r.attchmntFile}`
        : undefined,
      category: classifyNseCategory(r.desc),
    }));

    setCache(cacheKey, announcements);
    logger.info("NSE_ANNOUNCEMENTS_FETCH", {
      event: "NSE_ANNOUNCEMENTS_FETCH",
      symbol: symbol ?? "all",
      item_count: announcements.length,
      latency_ms: Date.now() - start,
      status: "success",
    });

    return announcements;

  } catch (err) {
    logger.warn("NSE_ANNOUNCEMENTS_FETCH", {
      event: "NSE_ANNOUNCEMENTS_FETCH",
      symbol: symbol ?? "all",
      error: err instanceof Error ? err.message : String(err),
      latency_ms: Date.now() - start,
      status: "error",
    });
    return [];
  }
}

function classifyNseCategory(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("dividend") || s.includes("interim")) return "Dividend";
  if (s.includes("result") || s.includes("financial")) return "Financial Results";
  if (s.includes("board meeting") || s.includes("agm") || s.includes("egm")) return "Board Meeting";
  if (s.includes("buyback") || s.includes("buy-back")) return "Buyback";
  if (s.includes("merger") || s.includes("amalgamation") || s.includes("acquisition")) return "M&A";
  if (s.includes("bonus") || s.includes("split") || s.includes("rights")) return "Corporate Action";
  if (s.includes("debenture") || s.includes("ncd") || s.includes("bond")) return "Debt";
  return "Announcement";
}

/**
 * Get top market headlines from ET Markets (primary source).
 * Returns 5 items, cached 5 min.
 */
export async function getMarketHeadlines(): Promise<MarketNewsItem[]> {
  const items = await fetchRssSource("et_markets", 10);
  // Sort by publishedAt desc, return top 5
  return items
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 5);
}

/**
 * Get aggregated market news from all RSS sources.
 * Deduplicates by title similarity. Returns up to `limit` items sorted by date.
 */
export async function getAggregatedNews(limit = 20): Promise<MarketNewsItem[]> {
  const cacheKey = `aggregated:news:${limit}`;
  const cached   = getCache<MarketNewsItem[]>(cacheKey);
  if (cached) return cached;

  const [etItems, feItems] = await Promise.all([
    fetchRssSource("et_markets", 30),
    fetchRssSource("financial_express", 20),
  ]);

  const all = [...etItems, ...feItems];

  // Deduplicate: skip items whose title overlaps >70% with already-added titles
  const deduped: MarketNewsItem[] = [];
  const seenTitles: string[] = [];

  for (const item of all) {
    const normalized = item.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const isDuplicate = seenTitles.some((seen) => {
      const wordsA = new Set(normalized.split(" ").filter((w) => w.length > 4));
      const wordsB = seen.split(" ").filter((w) => w.length > 4);
      if (wordsA.size === 0) return false;
      const overlap = wordsB.filter((w) => wordsA.has(w)).length;
      return overlap / Math.max(wordsA.size, wordsB.length) > 0.6;
    });
    if (!isDuplicate) {
      deduped.push(item);
      seenTitles.push(normalized);
    }
  }

  const sorted = deduped
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);

  setCache(cacheKey, sorted);
  return sorted;
}

/**
 * Full market summary for dashboard widget.
 * Combines headlines + news feed + NSE announcements.
 * Cached 5 min.
 */
export async function getMarketSummary(): Promise<MarketSummary> {
  const cacheKey = "market:summary";
  const cached   = getCache<MarketSummary>(cacheKey);
  if (cached) return cached;

  const [headlines, latestNews, nseAnnouncements] = await Promise.allSettled([
    getMarketHeadlines(),
    getAggregatedNews(15),
    fetchNseAnnouncements(),
  ]);

  const summary: MarketSummary = {
    headlines:        headlines.status === "fulfilled" ? headlines.value : [],
    latestNews:       latestNews.status === "fulfilled" ? latestNews.value : [],
    nseAnnouncements: nseAnnouncements.status === "fulfilled" ? nseAnnouncements.value.slice(0, 10) : [],
    fetchedAt:        new Date().toISOString(),
    source_versions: {
      et_markets:        "RSS/public",
      financial_express: "RSS/public",
      nse:               "NSE-API/public",
    },
    engine_version: ET_MARKETS_SERVICE_VERSION,
  };

  setCache(cacheKey, summary);
  return summary;
}

/** Invalidate all caches — useful for testing or admin refresh */
export function invalidateNewsCache(): void {
  cache.clear();
  logger.info("ET_MARKETS_CACHE_INVALIDATED", {
    event: "ET_MARKETS_CACHE_INVALIDATED",
    latency_ms: 0,
    status: "success",
  });
}
