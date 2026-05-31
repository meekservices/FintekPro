// @ts-nocheck
import { Router, Request, Response } from "express";
import { resolveCompany, searchExternal } from "../modules/research/resolver";
import { getFinancialData } from "../modules/research/dataService";
import { momentumSignal, priceLevels, weekRange52Position } from "../modules/research/technicalEngine";
import { valuationSummary, priceToTargetUpside } from "../modules/research/valuationEngine";
import { computeRating } from "../modules/research/recommendationEngine";
import { generatePPT, generatePDF, generateOnePager, ReportData } from "../modules/research/reportService";
import { computePriceTarget, computePEG } from "../modules/research/pricingEngine";
import { generateThesis, generateRisks, generateManagementNote } from "../modules/research/thesisEngine";
import { fetchShareholding, fetchPeersAndAverage } from "../modules/research/ownershipService";
import { generateCommentary } from "../modules/research/aiCommentaryService";
import { runUnlistedAnalytics } from "../modules/research/unlistedAnalyticsEngine";
import type { CredhiveFinancialStatement } from "../services/credhive-service";
import { credhiveService } from "../services/credhive-service";
import { db } from "../db";
import { sql, eq, desc } from "drizzle-orm";
import { unlistedCompanies, companyFinancials } from "@shared/schema";
import { objectStorageClient } from "../objectStorage";

const REPORT_BUCKET = process.env.PRIVATE_OBJECT_DIR?.split("/")[1] || "replit-objstore-7b306d6a-5cfa-4282-bce0-65a5f8cd4c06";
const REPORT_PREFIX = ".private/research-reports/";

async function storeReportInObjectStorage(safeName: string, buffer: Buffer, label: string): Promise<string | null> {
  try {
    const key = `${REPORT_PREFIX}${safeName}_${Date.now()}.pdf`;
    const bucket = objectStorageClient.bucket(REPORT_BUCKET);
    const file = bucket.file(key);
    await file.save(buffer, {
      metadata: {
        contentType: "application/pdf",
        metadata: { label, generatedAt: new Date().toISOString() },
      },
    });
    return key;
  } catch (_) {
    return null;
  }
}

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);

    const pattern = `%${q.toUpperCase()}%`;

    // Run local DB queries + external search in parallel
    const [listedRows, unlistedRows, externalResults] = await Promise.all([
      db.execute(sql`
        SELECT
          symbol,
          isin,
          company_name,
          sector,
          nse_code,
          bse_code,
          cin,
          'listed' AS type
        FROM listed_stocks
        WHERE is_active = true
          AND (
            UPPER(company_name) LIKE ${pattern}
            OR UPPER(symbol) LIKE ${pattern}
            OR UPPER(isin) LIKE ${pattern}
            OR UPPER(COALESCE(nse_code, '')) LIKE ${pattern}
            OR UPPER(COALESCE(cin, '')) LIKE ${pattern}
          )
        ORDER BY
          CASE WHEN UPPER(symbol) = ${q.toUpperCase()} THEN 0
               WHEN UPPER(symbol) LIKE ${q.toUpperCase() + "%"} THEN 1
               ELSE 2 END,
          company_name
        LIMIT 8
      `),
      db.execute(sql`
        SELECT
          COALESCE(cin, id) AS symbol,
          isin,
          name AS company_name,
          sector,
          NULL AS nse_code,
          NULL AS bse_code,
          cin,
          'unlisted' AS type,
          id AS unlisted_id,
          listing_stage
        FROM unlisted_companies
        WHERE status = 'active'
          AND (
            UPPER(name) LIKE ${pattern}
            OR UPPER(COALESCE(cin, '')) LIKE ${pattern}
            OR UPPER(COALESCE(isin, '')) LIKE ${pattern}
          )
        ORDER BY
          CASE WHEN UPPER(COALESCE(cin,'')) = ${q.toUpperCase()} THEN 0
               WHEN UPPER(name) LIKE ${q.toUpperCase() + "%"} THEN 1
               ELSE 2 END,
          name
        LIMIT 7
      `),
      // External search runs in parallel — never blocks local results
      searchExternal(q).catch(() => [] as any[]),
    ]);

    const listed   = (listedRows.rows   || listedRows)   as any[];
    const unlisted = (unlistedRows.rows || unlistedRows) as any[];
    const external = externalResults as any[];

    // Merge: local listed → local unlisted → external, dedup by both symbol and company_name
    const seenSym  = new Set<string>();
    const seenName = new Set<string>();
    const merged: any[] = [];

    for (const r of [...listed, ...unlisted]) {
      const symKey  = (r.symbol       || '').toUpperCase();
      const nameKey = (r.company_name || '').toUpperCase();
      if (!seenSym.has(symKey) && !seenName.has(nameKey)) {
        seenSym.add(symKey);
        seenName.add(nameKey);
        merged.push(r);
      }
    }

    // Append external results only for symbols not already covered locally
    for (const r of external) {
      const symKey  = (r.symbol       || '').toUpperCase();
      const nameKey = (r.company_name || '').toUpperCase();
      if (!seenSym.has(symKey) && !seenName.has(nameKey)) {
        seenSym.add(symKey);
        seenName.add(nameKey);
        merged.push(r);
      }
    }

    res.json(merged.slice(0, 15));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

interface CompanyInfo {
  symbol: string;
  name: string;
  exchange: string;
  isin?: string;
  sector?: string | null;
  industry?: string | null;
  broadSector?: string | null;
}

async function resolveFromDB(input: string): Promise<CompanyInfo | null> {
  const upper = input.toUpperCase().trim();
  const rows = await db.execute(sql`
    SELECT symbol, company_name, isin, sector, industry, broad_sector, nse_code, bse_code
    FROM listed_stocks
    WHERE is_active = true
      AND (UPPER(isin) = ${upper} OR UPPER(symbol) = ${upper})
    LIMIT 1
  `);
  const r = (rows.rows || rows)[0] as any;
  if (!r) return null;
  // BSE-only stocks have no nse_code but have a bse_code
  const isBseOnly = !r.nse_code && !!r.bse_code;
  const exchange = isBseOnly ? "BSE" : "NSE";
  const suffix   = isBseOnly ? ".BO" : ".NS";
  return {
    symbol: r.symbol + suffix,
    name: r.company_name,
    exchange,
    isin: r.isin,
    sector: r.sector ?? null,
    industry: r.industry ?? null,
    broadSector: r.broad_sector ?? null,
  };
}

/**
 * Silently persists a newly-discovered listed company into listed_stocks so that
 * future searches and reports are served from the local DB (faster, no external calls).
 * Fire-and-forget — never throws.
 */
async function persistNewListing(opts: {
  symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  price: number | null;
}): Promise<void> {
  try {
    const isBse = opts.exchange?.toUpperCase() === "BSE";
    await db.execute(sql`
      INSERT INTO listed_stocks (
        symbol, company_name, sector, industry,
        nse_code, bse_code,
        current_price, previous_close,
        is_active, data_source, last_updated, created_at
      ) VALUES (
        ${opts.symbol},
        ${opts.name},
        ${opts.sector},
        ${opts.sector},
        ${isBse ? null : "EQ"},
        ${isBse ? opts.symbol : null},
        ${opts.price},
        ${opts.price},
        true,
        'auto_discovered',
        NOW(),
        NOW()
      )
      ON CONFLICT (symbol) DO UPDATE SET
        company_name  = EXCLUDED.company_name,
        sector        = COALESCE(listed_stocks.sector, EXCLUDED.sector),
        current_price = COALESCE(EXCLUDED.current_price, listed_stocks.current_price),
        data_source   = CASE WHEN listed_stocks.data_source = 'auto_discovered'
                             THEN 'auto_discovered' ELSE listed_stocks.data_source END,
        last_updated  = NOW()
    `);
    console.log(`[ResearchNote] Auto-persisted new listing: ${opts.symbol} (${opts.name})`);
  } catch (e: any) {
    console.warn(`[ResearchNote] Auto-persist skipped for ${opts.symbol}:`, e?.message?.slice(0, 80));
  }
}

async function buildReportData(symbol: string): Promise<ReportData & { dataQuality: any }> {
  const dbResult = await resolveFromDB(symbol);
  const resolvedExternally = !dbResult;
  const company = dbResult ?? await resolveCompany(symbol);

  const nseSymbol = (company as CompanyInfo).symbol ?? symbol;
  const sector = (company as CompanyInfo).sector ?? null;
  const industry = (company as CompanyInfo).industry ?? null;
  const broadSector = (company as CompanyInfo).broadSector ?? null;
  const cleanSym = nseSymbol.replace(/\.(NS|BO)$/i, "").toUpperCase();

  // Step 1: Fetch financial data first (needed for live sector average computation)
  const financialsResult = await getFinancialData(nseSymbol).catch((e: any) => { throw e; });
  const financials = financialsResult;
  const fundamentalsSource = (financialsResult as any)._fundamentalsSource ?? { source: "UNKNOWN", scrapedAt: null, ageHours: null };

  // Auto-persist: if this company wasn't in our DB, save it now so future queries are fast
  if (resolvedExternally && financials.price !== null) {
    persistNewListing({
      symbol: cleanSym,
      name: company.name,
      exchange: company.exchange ?? "NSE",
      sector: sector,
      price: financials.price,
    }).catch(() => {});
  }

  // Step 2: Fetch peers (with live sector average), shareholding and commentary in parallel
  // Pass target stock's own ROE/PE/PB so sector average includes it
  const [
    peersAndAvgResult,
    shareholdingResult,
  ] = await Promise.allSettled([
    fetchPeersAndAverage(sector, nseSymbol, financials.roe, financials.pe, (financials as any).pbRatio ?? null),
    fetchShareholding(nseSymbol),
  ]);

  const peersAndAvg = peersAndAvgResult.status === "fulfilled" ? peersAndAvgResult.value : { peers: [], sectorAvg: null };
  const peers = peersAndAvg.peers;
  const sectorAvg = peersAndAvg.sectorAvg;
  const shareholding = shareholdingResult.status === "fulfilled" ? shareholdingResult.value : null;

  // AI commentary (non-blocking)
  let commentary = null;
  try {
    commentary = await generateCommentary(company.name, sector, industry, financials);
  } catch { }

  const momentum = momentumSignal(financials.price, financials.fiftyTwoWeekHigh, financials.fiftyTwoWeekLow);
  const upside = priceToTargetUpside(financials.price, financials.targetMeanPrice);
  const rating = computeRating({
    pe: financials.pe,
    roe: financials.roe,
    debtToEquity: financials.debtToEquity,
    revenueGrowth: financials.revenueGrowth,
    earningsGrowth: financials.earningsGrowth,
    momentumScore: momentum,
    upsidePotential: upside,
  });

  const levels = financials.price ? priceLevels(financials.price) : {
    support: 0, resistance: 0, stopLoss: 0, target1: 0, target2: 0,
  };

  const rangePos = weekRange52Position(financials.price, financials.fiftyTwoWeekLow, financials.fiftyTwoWeekHigh);

  const valSummary = valuationSummary(
    financials.pe, financials.roe, financials.debtToEquity,
    financials.revenueGrowth, (financials as any).pbRatio ?? null
  );

  const priceTarget = computePriceTarget(financials);
  const peg = computePEG(financials.pe, financials.earningsGrowth);
  const thesis = generateThesis(financials, rating.rating, priceTarget);
  const risks = generateRisks(financials);
  const managementNote = generateManagementNote(
    company.name,
    shareholding?.promoterChange ?? null,
    shareholding?.pledgedPct ?? null
  );

  // Data quality metadata for audit trail
  const dataQuality = {
    price: {
      source: "NSE_LIVE",
      fetchedAt: new Date().toISOString(),
    },
    fundamentals: {
      source: fundamentalsSource.source,
      scrapedAt: fundamentalsSource.scrapedAt,
      ageHours: fundamentalsSource.ageHours,
    },
    peers: {
      source: peers.length > 0 ? "SCREENER_LIVE" : "DB_ONLY",
      enrichedAt: new Date().toISOString(),
      count: peers.length,
    },
    shareholding: {
      source: shareholding ? "NSE_LIVE" : "UNAVAILABLE",
    },
    sectorAvg: {
      source: "LIVE_COMPUTED",
      stockCount: sectorAvg?.stockCount ?? 0,
    },
  };

  // Extract historical data from screener result (stored on the financials source object)
  const screenerData = (financialsResult as any)._screenerData ?? null;

  return {
    symbol: nseSymbol,
    companyName: company.name,
    exchange: company.exchange,
    sector,
    industry,
    broadSector,
    financials,
    rating,
    levels,
    weekRange52Position: rangePos,
    valuationSummary: valSummary,
    generatedAt: new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric"
    }),
    priceTarget: priceTarget.blended ? priceTarget : null,
    peg,
    thesis,
    risks,
    shareholding,
    peers,
    sectorAvg,
    commentary,
    managementNote,
    dataQuality,
    companyDescription: screenerData?.companyDescription ?? null,
    plHistory: screenerData?.plHistory ?? null,
    bsHistory: screenerData?.bsHistory ?? null,
    cfHistory: screenerData?.cfHistory ?? null,
    ratiosHistory: screenerData?.ratiosHistory ?? null,
    quarterlyHistory: screenerData?.quarterlyHistory ?? null,
    salesCagr3Y: screenerData?.salesCagr3Y ?? null,
    salesCagr5Y: screenerData?.salesCagr5Y ?? null,
    profitCagr3Y: screenerData?.profitCagr3Y ?? null,
    profitCagr5Y: screenerData?.profitCagr5Y ?? null,
    keyPoints: {
      pros: screenerData?.pros ?? [],
      cons: screenerData?.cons ?? [],
    },
  };
}

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol?.trim()) return res.status(400).json({ error: "Symbol is required" });
    const data = await buildReportData(symbol.trim());
    res.json({
      symbol: data.symbol,
      companyName: data.companyName,
      exchange: data.exchange,
      sector: data.sector,
      industry: data.industry,
      financials: data.financials,
      rating: data.rating,
      levels: data.levels,
      weekRange52Position: data.weekRange52Position,
      valuationSummary: data.valuationSummary,
      generatedAt: data.generatedAt,
      priceTarget: data.priceTarget,
      peg: data.peg,
      thesis: data.thesis,
      risks: data.risks,
      shareholding: data.shareholding,
      peers: data.peers,
      sectorAvg: data.sectorAvg,
      commentary: data.commentary,
      managementNote: data.managementNote,
      dataQuality: data.dataQuality,
      companyDescription: data.companyDescription,
      plHistory: data.plHistory,
      bsHistory: data.bsHistory,
      cfHistory: data.cfHistory,
      ratiosHistory: data.ratiosHistory,
      quarterlyHistory: data.quarterlyHistory,
      salesCagr3Y: data.salesCagr3Y,
      salesCagr5Y: data.salesCagr5Y,
      profitCagr3Y: data.profitCagr3Y,
      profitCagr5Y: data.profitCagr5Y,
      keyPoints: (data as any).keyPoints ?? { pros: [], cons: [] },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate research data" });
  }
});

router.post("/generate/ppt", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol?.trim()) return res.status(400).json({ error: "Symbol is required" });
    const data = await buildReportData(symbol.trim());
    const buffer = await generatePPT(data);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Research.pptx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PPT" });
  }
});

router.post("/generate/pdf", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol?.trim()) return res.status(400).json({ error: "Symbol is required" });
    const data = await buildReportData(symbol.trim());
    const buffer = await generatePDF(data);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_");
    storeReportInObjectStorage(safeName, buffer, `${data.companyName} Research Report`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Report.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

router.get("/stored", async (_req: Request, res: Response) => {
  try {
    const bucket = objectStorageClient.bucket(REPORT_BUCKET);
    const [files] = await bucket.getFiles({ prefix: REPORT_PREFIX, maxResults: 50 });
    const reports = await Promise.all(
      files
        .filter((f) => f.name.endsWith(".pdf"))
        .sort((a, b) => (b.metadata.updated || "").localeCompare(a.metadata.updated || ""))
        .slice(0, 30)
        .map(async (f) => {
          const meta = f.metadata?.metadata as Record<string, string> | undefined;
          const namePart = f.name.replace(REPORT_PREFIX, "").replace(/\.pdf$/, "");
          const [cleanName] = namePart.split("_").slice(0, -1);
          return {
            key: f.name,
            label: meta?.label || cleanName || namePart,
            generatedAt: meta?.generatedAt || f.metadata.updated || null,
            sizeKb: f.metadata.size ? Math.round(Number(f.metadata.size) / 1024) : null,
          };
        })
    );
    res.json(reports);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list stored reports" });
  }
});

router.get("/stored/download", async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key || !key.startsWith(REPORT_PREFIX)) return res.status(400).json({ error: "Invalid key" });
    const bucket = objectStorageClient.bucket(REPORT_BUCKET);
    const file = bucket.file(key);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: "Report not found" });
    const [contents] = await file.download();
    const fileName = key.split("/").pop() || "report.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(contents);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to download report" });
  }
});

export default router;
