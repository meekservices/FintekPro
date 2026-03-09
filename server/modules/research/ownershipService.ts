import { db } from "../../db";
import { sql } from "drizzle-orm";
import { formatMarketCap } from "./financialEngine";
import { fetchFromScreener } from "./dataService";

const BROWSER_HEADERS_GF = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const peerEnrichCache = new Map<string, { roe: number | null; pe: number | null; pb: number | null; de: number | null; expiresAt: number }>();

/** Scrape P/E and P/B from Google Finance static HTML for Indian stocks */
async function fetchFromGoogleFinance(symbol: string): Promise<{ pe: number | null; pb: number | null }> {
  const fallback = { pe: null, pb: null };
  try {
    const url = `https://www.google.com/finance/quote/${symbol.toUpperCase()}:NSE`;
    const res = await fetch(url, {
      headers: BROWSER_HEADERS_GF,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return fallback;
    const html = await res.text();

    const parseNum = (s: string) => { const n = parseFloat(s.replace(/,/g, "")); return isNaN(n) ? null : n; };

    let pe: number | null = null;
    let pb: number | null = null;

    const peMatch = html.match(/[Pp]\s*\/\s*[Ee]\s+[Rr]atio[\s\S]{0,300}?>\s*([\d,\.]+)\s*</);
    if (peMatch) pe = parseNum(peMatch[1]);

    const pbMatch = html.match(/[Pp]rice\s+\/\s+[Bb]ook[\s\S]{0,300}?>\s*([\d,\.]+)\s*</);
    if (pbMatch) pb = parseNum(pbMatch[1]);

    const jsonMatches = [...html.matchAll(/\[["']P\/E ratio["'],["']([\d\.]+)["']\]/g)];
    if (jsonMatches.length && pe === null) pe = parseNum(jsonMatches[0][1]);

    if (pe !== null || pb !== null) {
      console.log(`[ResearchNote][Peer] Google Finance ${symbol}: PE=${pe ?? "N/A"}, PB=${pb ?? "N/A"}`);
    }
    return { pe, pb };
  } catch {
    return fallback;
  }
}

/** Enrich a peer stock using Screener.in (primary) + Google Finance (secondary for PE/PB) */
async function enrichPeer(symbol: string): Promise<{ roe: number | null; pe: number | null; pb: number | null; de: number | null; bookValue: number | null }> {
  const cached = peerEnrichCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return { roe: cached.roe, pe: cached.pe, pb: cached.pb, de: cached.de, bookValue: null };

  const fallback = { roe: null, pe: null, pb: null, de: null, bookValue: null };
  try {
    const screener = await fetchFromScreener(symbol);
    const result = {
      roe:       screener.roe,
      pe:        screener.pe,
      pb:        screener.pb,
      de:        screener.debtToEquity,
      bookValue: screener.bookValue,
    };

    if (result.pe === null || result.pb === null) {
      const gf = await fetchFromGoogleFinance(symbol);
      if (result.pe === null && gf.pe !== null) result.pe = gf.pe;
      if (result.pb === null && gf.pb !== null) result.pb = gf.pb;
    }

    peerEnrichCache.set(symbol, { roe: result.roe, pe: result.pe, pb: result.pb, de: result.de, expiresAt: Date.now() + 30 * 60 * 1000 });

    // Write back to DB
    const sym = symbol.toUpperCase();
    if (result.roe !== null || result.de !== null) {
      (async () => {
        try {
          const upd = await db.execute(sql`
            UPDATE screener_financials
            SET
              roe            = COALESCE(${result.roe}, roe),
              debt_to_equity = COALESCE(${result.de}, debt_to_equity),
              last_updated   = NOW()
            WHERE symbol = ${sym}
          `);
          const rowsUpdated = (upd as any).rowCount ?? (upd as any).count ?? 0;
          if (!rowsUpdated) {
            await db.execute(sql`
              INSERT INTO screener_financials (symbol, roe, debt_to_equity, last_updated)
              VALUES (${sym}, ${result.roe}, ${result.de}, NOW())
            `);
          }
        } catch (e: any) {
          console.warn(`[ResearchNote][Peer] DB write-back failed for ${sym}:`, e?.message?.slice(0, 60));
        }
      })();
    }
    if (result.pe !== null) {
      db.execute(sql`
        UPDATE listed_stocks SET pe_ratio = ${result.pe}, enrichment_status = 'complete', last_enriched_at = NOW()
        WHERE symbol = ${sym} AND (pe_ratio IS NULL OR pe_ratio::numeric = 20)
      `).catch(() => {});
    }

    console.log(`[ResearchNote][Peer] ${symbol}: ROE=${result.roe !== null ? (result.roe * 100).toFixed(1) + "%" : "N/A"}, PE=${result.pe ?? "N/A"}, PB=${result.pb ?? "N/A"}, BV=${result.bookValue ?? "N/A"}`);
    return result;
  } catch (e: any) {
    console.warn(`[ResearchNote][Peer] Enrichment failed for ${symbol}:`, e?.message?.slice(0, 80));
    peerEnrichCache.set(symbol, { ...fallback, expiresAt: Date.now() + 5 * 60 * 1000 });
    return fallback;
  }
}

export interface ShareholdingData {
  promoterPct: number | null;
  promoterPrevPct: number | null;
  promoterChange: number | null;
  fiiPct: number | null;
  diiPct: number | null;
  mutualFundPct: number | null;
  publicPct: number | null;
  pledgedPct: number | null;
  quarter: string | null;
  prevQuarter: string | null;
}

export interface PeerData {
  symbol: string;
  name: string;
  price: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  marketCap: number | null;
  marketCapFormatted: string;
}

export interface SectorAverages {
  avgPE: number | null;
  avgPB: number | null;
  avgROE: number | null;
  avgROCE: number | null;
  avgDE: number | null;
  stockCount: number;
}

const shareholdingCache = new Map<string, { data: ShareholdingData; expiresAt: number }>();
const peersCache = new Map<string, { data: PeerData[]; sectorAvg: SectorAverages; expiresAt: number }>();
const CACHE_TTL = 15 * 60 * 1000;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

let nseCookies = "";
let nseCookieExpiry = 0;

async function ensureNseCookies(): Promise<void> {
  if (Date.now() < nseCookieExpiry) return;
  try {
    const res = await fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS });
    const setCookie = res.headers.get("set-cookie") ?? "";
    if (setCookie) {
      nseCookies = setCookie.split(",").map(c => c.split(";")[0]).join("; ");
      nseCookieExpiry = Date.now() + 5 * 60 * 1000;
    }
  } catch { }
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export async function fetchShareholding(nseSymbol: string): Promise<ShareholdingData | null> {
  const sym = nseSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
  const cached = shareholdingCache.get(sym);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    await ensureNseCookies();
    const today = new Date();
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const url = `https://www.nseindia.com/api/corporate-shareholding-patterns?symbol=${encodeURIComponent(sym)}&from=${formatDate(sixMonthsAgo)}&to=${formatDate(today)}`;

    const res = await fetch(url, {
      headers: { ...BROWSER_HEADERS, Cookie: nseCookies, Referer: "https://www.nseindia.com" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`NSE shareholding HTTP ${res.status}`);
    const raw = await res.json() as any;

    const records: any[] = Array.isArray(raw) ? raw : (raw?.data ?? raw?.shareholdingPatterns ?? []);
    if (records.length < 1) throw new Error("No shareholding records");

    const sorted = records.sort((a: any, b: any) => {
      const da = new Date(a.date ?? a.shareholdingDate ?? 0).getTime();
      const db_ = new Date(b.date ?? b.shareholdingDate ?? 0).getTime();
      return db_ - da;
    });

    const latest = sorted[0];
    const prev = sorted[1] ?? null;

    const pf = (v: any) => {
      const n = parseFloat(String(v ?? ""));
      return isNaN(n) ? null : n;
    };

    const promoterPct = pf(latest.promoterAndPromoterGroupShareHolding ?? latest.promoter ?? latest.promoterTotal);
    const promoterPrevPct = prev ? pf(prev.promoterAndPromoterGroupShareHolding ?? prev.promoter ?? prev.promoterTotal) : null;

    const data: ShareholdingData = {
      promoterPct,
      promoterPrevPct,
      promoterChange: (promoterPct !== null && promoterPrevPct !== null) ? Math.round((promoterPct - promoterPrevPct) * 100) / 100 : null,
      fiiPct: pf(latest.foreignInstitutionalInvestors ?? latest.fii ?? latest.fiiTotal),
      diiPct: pf(latest.domesticInstitutionalInvestors ?? latest.dii ?? latest.diiTotal),
      mutualFundPct: pf(latest.mutualFunds ?? latest.mutualFund),
      publicPct: pf(latest.public ?? latest.publicShareholding ?? latest.publicTotal),
      pledgedPct: pf(latest.pledgedSharePercentage ?? latest.pledged),
      quarter: latest.quarter ?? latest.shareholdingDate ?? null,
      prevQuarter: prev?.quarter ?? prev?.shareholdingDate ?? null,
    };

    shareholdingCache.set(sym, { data, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[ResearchNote] Shareholding ${sym}: Promoter ${data.promoterPct}% (Δ${data.promoterChange}%), FII ${data.fiiPct}%`);
    return data;
  } catch (e: any) {
    console.warn(`[ResearchNote] Shareholding fetch failed for ${sym}:`, e?.message);
    shareholdingCache.set(sym, { data: null as any, expiresAt: Date.now() + 5 * 60 * 1000 });
    return null;
  }
}

function mcapFmt(crores: number | null): string {
  if (!crores) return "N/A";
  if (crores >= 100000) return `₹${(crores / 100000).toFixed(2)} L Cr`;
  if (crores >= 1000) return `₹${(crores / 1000).toFixed(2)} K Cr`;
  return `₹${crores.toFixed(0)} Cr`;
}

/**
 * Compute sector averages from an array of already-enriched peer stocks + the target stock itself.
 * This gives accurate live averages instead of relying solely on potentially-stale DB data.
 */
function computeLiveSectorAverages(
  peers: PeerData[],
  targetSymbol: string,
  targetROE: number | null,
  targetPE: number | null,
  targetPB: number | null
): SectorAverages {
  // Build full set: target stock + all enriched peers
  const all = [
    { roe: targetROE, pe: targetPE, pb: targetPB },
    ...peers.map(p => ({ roe: p.roe, pe: p.pe, pb: p.pb })),
  ];

  const validROE = all.map(s => s.roe).filter((v): v is number => v !== null && v > 0.001 && v < 1.5);
  const validPE  = all.map(s => s.pe).filter((v): v is number => v !== null && v > 1 && v < 200);
  const validPB  = all.map(s => s.pb).filter((v): v is number => v !== null && v > 0.1 && v < 50);

  const avg = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10000) / 10000 : null;

  return {
    avgPE: validPE.length ? Math.round((validPE.reduce((a, b) => a + b, 0) / validPE.length) * 10) / 10 : null,
    avgPB: validPB.length ? Math.round((validPB.reduce((a, b) => a + b, 0) / validPB.length) * 100) / 100 : null,
    avgROE: avg(validROE),
    avgROCE: null,  // filled by DB-level average below
    avgDE: null,
    stockCount: all.length,
  };
}

export interface PeersAndAverage {
  peers: PeerData[];
  sectorAvg: SectorAverages;
}

/**
 * Fetch peers AND compute sector averages together, using live-enriched data for accuracy.
 * The sector average is computed from the enriched peer array + target stock's own metrics,
 * so it reflects real ROE/PE values rather than placeholder DB values.
 */
export async function fetchPeersAndAverage(
  sector: string | null,
  excludeSymbol: string,
  targetROE: number | null,
  targetPE: number | null,
  targetPB: number | null
): Promise<PeersAndAverage> {
  const empty: PeersAndAverage = {
    peers: [],
    sectorAvg: { avgPE: null, avgPB: null, avgROE: null, avgROCE: null, avgDE: null, stockCount: 0 },
  };
  if (!sector) return empty;

  const cacheKey = `${sector}__${excludeSymbol}`;
  const cached = peersCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { peers: cached.data, sectorAvg: cached.sectorAvg };
  }

  try {
    const cleanSym = excludeSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();

    const rows = await db.execute(sql`
      SELECT
        ls.symbol, ls.company_name, ls.current_price, ls.pe_ratio, ls.pb_ratio,
        ls.market_cap_value,
        COALESCE(sf.roe, NULLIF(ls.roe::numeric, 0) / 100) AS roe,
        sf.roce, sf.debt_to_equity
      FROM listed_stocks ls
      LEFT JOIN screener_financials sf ON sf.symbol = ls.symbol
      WHERE ls.sector = ${sector}
        AND UPPER(ls.symbol) != ${cleanSym}
        AND ls.is_active = true
      ORDER BY ls.market_cap_value DESC NULLS LAST
      LIMIT 4
    `);

    const rawRows = (rows as any).rows ?? rows;
    const pf = (v: any) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    interface MutablePeer extends PeerData { _needsEnrich: boolean; }

    const peers: MutablePeer[] = rawRows.map((r: any) => {
      const mcap = r.market_cap_value ? pf(r.market_cap_value) : null;
      const peFromDb = r.pe_ratio ? pf(r.pe_ratio) : null;
      const isPlaceholderPE = peFromDb !== null && peFromDb === 20;
      return {
        symbol: r.symbol,
        name: r.company_name,
        price: r.current_price ? pf(r.current_price) : null,
        pe: isPlaceholderPE ? null : peFromDb,
        pb: r.pb_ratio ? pf(r.pb_ratio) : null,
        roe: r.roe !== null && r.roe !== undefined ? pf(r.roe) : null,
        marketCap: mcap ? mcap * 1e7 : null,
        marketCapFormatted: mcapFmt(mcap),
        _needsEnrich: !r.roe || isPlaceholderPE,
      };
    });

    // Enrich peers missing ROE/PE via Screener.in + Google Finance (sequential to avoid rate limits)
    const needsEnrich = peers.filter(p => p._needsEnrich || p.roe === null || p.pe === null);
    if (needsEnrich.length > 0) {
      console.log(`[ResearchNote] Enriching ${needsEnrich.length} peers via Screener.in: ${needsEnrich.map(p => p.symbol).join(", ")}`);
      for (let i = 0; i < needsEnrich.length; i++) {
        const peer = needsEnrich[i];
        if (i > 0) await new Promise(r => setTimeout(r, 1200)); // stagger to avoid rate limiting
        try {
          const enriched = await enrichPeer(peer.symbol);
          if (enriched.roe !== null && peer.roe === null) peer.roe = enriched.roe;
          if (enriched.pe  !== null && peer.pe  === null) peer.pe  = enriched.pe;
          if (enriched.pb  !== null && peer.pb  === null) peer.pb  = enriched.pb;
          if (peer.pb === null && peer.price !== null && enriched.bookValue && enriched.bookValue > 0) {
            peer.pb = Math.round((peer.price / enriched.bookValue) * 100) / 100;
          }
        } catch { /* already logged inside enrichPeer */ }
      }
    }

    const finalPeers: PeerData[] = peers.map(({ _needsEnrich: _, ...p }) => p);

    // Compute live sector averages from enriched peer set + target stock
    const liveSectorAvg = computeLiveSectorAverages(finalPeers, cleanSym, targetROE, targetPE, targetPB);

    // Fetch ROCE and D/E averages from DB (not live-enriched, but acceptable for those fields)
    try {
      const res2 = await db.execute(sql`
        SELECT
          ROUND(AVG(CASE WHEN sf.roce BETWEEN 0.01 AND 0.8 THEN sf.roce END)::numeric, 4) AS avg_roce,
          ROUND(AVG(CASE WHEN sf.debt_to_equity BETWEEN 0 AND 5 THEN sf.debt_to_equity END)::numeric, 2) AS avg_de
        FROM screener_financials sf
        INNER JOIN listed_stocks ls ON ls.symbol = sf.symbol
        WHERE ls.sector = ${sector}
      `);
      const r1 = ((res2 as any).rows ?? res2)[0] as any;
      if (r1) {
        if (r1.avg_roce) liveSectorAvg.avgROCE = parseFloat(r1.avg_roce);
        if (r1.avg_de) liveSectorAvg.avgDE = parseFloat(r1.avg_de);
      }
    } catch { /* non-critical */ }

    peersCache.set(cacheKey, { data: finalPeers, sectorAvg: liveSectorAvg, expiresAt: Date.now() + CACHE_TTL });

    const avgRoeStr = liveSectorAvg.avgROE !== null ? (liveSectorAvg.avgROE * 100).toFixed(1) + "%" : "N/A";
    console.log(`[ResearchNote] Peers for ${sector}: ${finalPeers.map(p => `${p.symbol}(ROE:${p.roe !== null ? (p.roe * 100).toFixed(1) + "%" : "N/A"},PE:${p.pe ?? "N/A"})`).join(", ")} | SectorAvg ROE:${avgRoeStr} PE:${liveSectorAvg.avgPE ?? "N/A"}`);

    return { peers: finalPeers, sectorAvg: liveSectorAvg };
  } catch (e: any) {
    console.warn(`[ResearchNote] fetchPeersAndAverage failed:`, e?.message);
    return empty;
  }
}

// Keep old exports as thin wrappers for backward compatibility
export async function fetchPeers(sector: string | null, excludeSymbol: string): Promise<PeerData[]> {
  const result = await fetchPeersAndAverage(sector, excludeSymbol, null, null, null);
  return result.peers;
}

export async function fetchSectorAverages(sector: string | null): Promise<SectorAverages> {
  const empty: SectorAverages = { avgPE: null, avgPB: null, avgROE: null, avgROCE: null, avgDE: null, stockCount: 0 };
  if (!sector) return empty;
  try {
    const res = await db.execute(sql`
      SELECT
        ROUND(AVG(CASE WHEN pe_ratio BETWEEN 2 AND 150 THEN pe_ratio END)::numeric, 1) AS avg_pe,
        ROUND(AVG(CASE WHEN pb_ratio BETWEEN 0.2 AND 30 THEN pb_ratio END)::numeric, 2) AS avg_pb,
        COUNT(*) AS stock_count
      FROM listed_stocks
      WHERE sector = ${sector} AND is_active = true
    `);
    const r0 = ((res as any).rows ?? res)[0] as any;
    const res2 = await db.execute(sql`
      SELECT
        ROUND(AVG(CASE WHEN sf.roe BETWEEN 0.01 AND 0.8 THEN sf.roe END)::numeric, 4) AS avg_roe,
        ROUND(AVG(CASE WHEN sf.roce BETWEEN 0.01 AND 0.8 THEN sf.roce END)::numeric, 4) AS avg_roce,
        ROUND(AVG(CASE WHEN sf.debt_to_equity BETWEEN 0 AND 5 THEN sf.debt_to_equity END)::numeric, 2) AS avg_de
      FROM screener_financials sf
      INNER JOIN listed_stocks ls ON ls.symbol = sf.symbol
      WHERE ls.sector = ${sector}
    `);
    const r1 = ((res2 as any).rows ?? res2)[0] as any;
    const pf = (v: any) => v !== null && v !== undefined ? parseFloat(v) : null;
    return {
      avgPE: pf(r0?.avg_pe),
      avgPB: pf(r0?.avg_pb),
      avgROE: pf(r1?.avg_roe),
      avgROCE: pf(r1?.avg_roce),
      avgDE: pf(r1?.avg_de),
      stockCount: parseInt(r0?.stock_count ?? "0"),
    };
  } catch (e: any) {
    console.warn(`[ResearchNote] fetchSectorAverages failed:`, e?.message);
    return empty;
  }
}
