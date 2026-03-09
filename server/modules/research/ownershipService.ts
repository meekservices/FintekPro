import { db } from "../../db";
import { sql } from "drizzle-orm";
import { formatMarketCap } from "./financialEngine";

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
const peersCache = new Map<string, { data: PeerData[]; expiresAt: number }>();
const sectorCache = new Map<string, { data: SectorAverages; expiresAt: number }>();
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

export async function fetchPeers(sector: string | null, excludeSymbol: string): Promise<PeerData[]> {
  if (!sector) return [];
  const cacheKey = `${sector}__${excludeSymbol}`;
  const cached = peersCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  try {
    const cleanSym = excludeSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();
    const rows = await db.execute(sql`
      SELECT symbol, company_name, current_price, pe_ratio, pb_ratio, roe, market_cap_value
      FROM listed_stocks
      WHERE sector = ${sector}
        AND UPPER(symbol) != ${cleanSym}
        AND is_active = true
      ORDER BY market_cap_value DESC NULLS LAST
      LIMIT 4
    `);

    const rawRows = (rows as any).rows ?? rows;
    const peers: PeerData[] = rawRows.map((r: any) => {
      const mcap = r.market_cap_value ? parseFloat(r.market_cap_value) : null;
      return {
        symbol: r.symbol,
        name: r.company_name,
        price: r.current_price ? parseFloat(r.current_price) : null,
        pe: r.pe_ratio ? parseFloat(r.pe_ratio) : null,
        pb: r.pb_ratio ? parseFloat(r.pb_ratio) : null,
        roe: r.roe ? parseFloat(r.roe) / 100 : null,
        marketCap: mcap ? mcap * 1e7 : null,
        marketCapFormatted: mcap ? (mcap >= 100000 ? `₹${(mcap / 100000).toFixed(2)} L Cr` : mcap >= 1000 ? `₹${(mcap / 1000).toFixed(2)} K Cr` : `₹${mcap.toFixed(0)} Cr`) : "N/A",
      };
    });

    peersCache.set(cacheKey, { data: peers, expiresAt: Date.now() + CACHE_TTL });
    console.log(`[ResearchNote] Peers for ${sector}: ${peers.map(p => p.symbol).join(", ")}`);
    return peers;
  } catch (e: any) {
    console.warn(`[ResearchNote] fetchPeers failed:`, e?.message);
    return [];
  }
}

export async function fetchSectorAverages(sector: string | null): Promise<SectorAverages> {
  const empty: SectorAverages = { avgPE: null, avgPB: null, avgROE: null, avgROCE: null, avgDE: null, stockCount: 0 };
  if (!sector) return empty;

  const cached = sectorCache.get(sector);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

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

    const data: SectorAverages = {
      avgPE: pf(r0?.avg_pe),
      avgPB: pf(r0?.avg_pb),
      avgROE: pf(r1?.avg_roe),
      avgROCE: pf(r1?.avg_roce),
      avgDE: pf(r1?.avg_de),
      stockCount: parseInt(r0?.stock_count ?? "0"),
    };

    sectorCache.set(sector, { data, expiresAt: Date.now() + CACHE_TTL });
    return data;
  } catch (e: any) {
    console.warn(`[ResearchNote] fetchSectorAverages failed:`, e?.message);
    return empty;
  }
}
