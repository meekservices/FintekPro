import { Router, Request, Response } from "express";
import { resolveCompany } from "../modules/research/resolver";
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

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);

    const pattern = `%${q.toUpperCase()}%`;
    const cinPattern = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i.test(q.trim());

    // Listed stocks query
    const listedRows = await db.execute(sql`
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
    `);

    // Unlisted companies query
    const unlistedRows = await db.execute(sql`
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
    `);

    const listed   = (listedRows.rows || listedRows) as any[];
    const unlisted = (unlistedRows.rows || unlistedRows) as any[];

    // Merge: listed first, then unlisted, deduplicate by company_name
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const r of [...listed, ...unlisted]) {
      const key = (r.company_name || '').toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
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
    SELECT symbol, company_name, isin, 'NSE' as exchange, sector, industry, broad_sector
    FROM listed_stocks
    WHERE is_active = true
      AND (UPPER(isin) = ${upper} OR UPPER(symbol) = ${upper})
    LIMIT 1
  `);
  const r = (rows.rows || rows)[0] as any;
  if (!r) return null;
  return {
    symbol: r.symbol + ".NS",
    name: r.company_name,
    exchange: "NSE",
    isin: r.isin,
    sector: r.sector ?? null,
    industry: r.industry ?? null,
    broadSector: r.broad_sector ?? null,
  };
}

async function buildReportData(symbol: string): Promise<ReportData & { dataQuality: any }> {
  const dbResult = await resolveFromDB(symbol);
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
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Report.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate PDF" });
  }
});

router.post("/generate/onepager", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol?.trim()) return res.status(400).json({ error: "Symbol is required" });
    const data = await buildReportData(symbol.trim());
    const buffer = await generateOnePager(data);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Summary.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate one pager" });
  }
});

// ─── Unlisted Company Preview ─────────────────────────────────────────────────

/**
 * Build research data for an unlisted company identified by CIN or DB id.
 * Priority order:
 *   1. DB cache (companyFinancials + unlistedCompanies)
 *   2. Credhive API (if key is configured)
 */
async function buildUnlistedReportData(cin: string): Promise<any> {
  // ── 1. Look up company in DB ──────────────────────────────────────────────
  let dbCompany: any = null;
  if (cin) {
    const rows = await db.execute(sql`
      SELECT * FROM unlisted_companies
      WHERE cin = ${cin} OR id = ${cin}
      LIMIT 1
    `);
    dbCompany = ((rows.rows || rows) as any[])[0] ?? null;
  }

  // ── 2. Fetch financial statements from DB ─────────────────────────────────
  let dbFinancials: any[] = [];
  if (dbCompany?.id) {
    const fRows = await db.execute(sql`
      SELECT * FROM company_financials
      WHERE company_id = ${dbCompany.id}
      ORDER BY financial_year DESC
      LIMIT 5
    `);
    dbFinancials = ((fRows.rows || fRows) as any[]);
  }

  // ── 3. Try Credhive for live data if key is present ───────────────────────
  let credhiveProfile: any = null;
  let credhiveFinancials: CredhiveFinancialStatement[] = [];
  let credhiveDirectors: any[] = [];
  let credhiveCompliance: any = null;

  const lookupCin = dbCompany?.cin || cin;

  if (lookupCin && credhiveService.isAvailable()) {
    const [profileRes, finRes, dirRes, compRes] = await Promise.allSettled([
      credhiveService.getCompanyProfile(lookupCin),
      credhiveService.getFinancials(lookupCin),
      credhiveService.getDirectors(lookupCin),
      credhiveService.getCompliance(lookupCin),
    ]);
    if (profileRes.status === 'fulfilled' && profileRes.value.success) credhiveProfile = profileRes.value.data;
    if (finRes.status === 'fulfilled' && finRes.value.success) credhiveFinancials = finRes.value.data ?? [];
    if (dirRes.status === 'fulfilled' && dirRes.value.success) credhiveDirectors = dirRes.value.data ?? [];
    if (compRes.status === 'fulfilled' && compRes.value.success) credhiveCompliance = compRes.value.data;
  }

  // ── 4. Merge DB financials into Credhive format ───────────────────────────
  // Use Credhive if available, else convert DB rows
  const statements: CredhiveFinancialStatement[] = credhiveFinancials.length > 0
    ? credhiveFinancials
    : dbFinancials.map((f: any) => ({
        financial_year: f.financial_year,
        period_end: f.period_end,
        revenue: f.revenue ? parseFloat(f.revenue) : undefined,
        ebitda: f.ebitda ? parseFloat(f.ebitda) : undefined,
        ebit: f.ebit ? parseFloat(f.ebit) : undefined,
        pbt: f.pbt ? parseFloat(f.pbt) : undefined,
        pat: f.pat ? parseFloat(f.pat) : undefined,
        net_profit: f.net_profit ? parseFloat(f.net_profit) : undefined,
        total_assets: f.total_assets ? parseFloat(f.total_assets) : undefined,
        total_liabilities: f.total_liabilities ? parseFloat(f.total_liabilities) : undefined,
        networth: f.networth ? parseFloat(f.networth) : undefined,
        share_capital: f.share_capital ? parseFloat(f.share_capital) : undefined,
        reserves: f.reserves ? parseFloat(f.reserves) : undefined,
        total_debt: f.total_debt ? parseFloat(f.total_debt) : undefined,
        long_term_debt: f.long_term_debt ? parseFloat(f.long_term_debt) : undefined,
        short_term_debt: f.short_term_debt ? parseFloat(f.short_term_debt) : undefined,
        operating_cash_flow: f.operating_cash_flow ? parseFloat(f.operating_cash_flow) : undefined,
        investing_cash_flow: f.investing_cash_flow ? parseFloat(f.investing_cash_flow) : undefined,
        financing_cash_flow: f.financing_cash_flow ? parseFloat(f.financing_cash_flow) : undefined,
        free_cash_flow: f.free_cash_flow ? parseFloat(f.free_cash_flow) : undefined,
      }));

  // ── 5. Company metadata ───────────────────────────────────────────────────
  const companyName = credhiveProfile?.company_name || dbCompany?.name || 'Unknown Company';
  const sector      = credhiveProfile?.sector || dbCompany?.sector || null;
  const industry    = credhiveProfile?.industry || dbCompany?.industry || null;
  const compCin     = lookupCin || credhiveProfile?.cin;
  const description = credhiveProfile?.description || dbCompany?.description || null;
  const totalShares = credhiveProfile?.total_shares
    ? Number(credhiveProfile.total_shares)
    : dbCompany?.total_shares
      ? Number(dbCompany.total_shares)
      : null;

  // Last transaction price = admin published price or Credhive data
  const transactionPrice = dbCompany?.published_buy_price
    ? parseFloat(dbCompany.published_buy_price)
    : null;

  // ── 6. Run analytics ──────────────────────────────────────────────────────
  const analytics = runUnlistedAnalytics(
    companyName,
    statements,
    totalShares,
    transactionPrice,
    sector,
    credhiveCompliance,
  );

  // ── 7. Build historical tables ────────────────────────────────────────────
  const sortedStmts = [...statements].sort((a, b) => (b.financial_year || '').localeCompare(a.financial_year || ''));
  const fyLabels = sortedStmts.map(s => s.financial_year || '');

  const plHistory = fyLabels.length > 0 ? {
    headers: ['Metric', ...fyLabels],
    rows: [
      { label: 'Revenue (₹ Cr)', values: sortedStmts.map(s => s.revenue ? s.revenue / 1e7 : null) },
      { label: 'EBITDA (₹ Cr)',  values: sortedStmts.map(s => s.ebitda ? s.ebitda / 1e7 : null) },
      { label: 'EBIT (₹ Cr)',    values: sortedStmts.map(s => s.ebit ? s.ebit / 1e7 : null) },
      { label: 'PAT (₹ Cr)',     values: sortedStmts.map(s => s.pat ? s.pat / 1e7 : null) },
      { label: 'EBITDA Margin',  values: sortedStmts.map(s => s.revenue && s.ebitda ? s.ebitda / s.revenue : null) },
      { label: 'Net Margin',     values: sortedStmts.map(s => s.revenue && s.pat ? s.pat / s.revenue : null) },
    ],
  } : null;

  const bsHistory = fyLabels.length > 0 ? {
    headers: ['Metric', ...fyLabels],
    rows: [
      { label: 'Total Assets (₹ Cr)',  values: sortedStmts.map(s => s.total_assets ? s.total_assets / 1e7 : null) },
      { label: 'Networth (₹ Cr)',      values: sortedStmts.map(s => s.networth ? s.networth / 1e7 : null) },
      { label: 'Total Debt (₹ Cr)',    values: sortedStmts.map(s => s.total_debt ? s.total_debt / 1e7 : null) },
      { label: 'Share Capital (₹ Cr)', values: sortedStmts.map(s => s.share_capital ? s.share_capital / 1e7 : null) },
    ],
  } : null;

  const cfHistory = fyLabels.length > 0 ? {
    headers: ['Metric', ...fyLabels],
    rows: [
      { label: 'Operating CF (₹ Cr)', values: sortedStmts.map(s => s.operating_cash_flow ? s.operating_cash_flow / 1e7 : null) },
      { label: 'Investing CF (₹ Cr)', values: sortedStmts.map(s => s.investing_cash_flow ? s.investing_cash_flow / 1e7 : null) },
      { label: 'Free CF (₹ Cr)',      values: sortedStmts.map(s => s.free_cash_flow ? s.free_cash_flow / 1e7 : null) },
    ],
  } : null;

  const ratiosHistory = fyLabels.length > 0 ? {
    headers: ['Metric', ...fyLabels],
    rows: [
      { label: 'ROE (%)',        values: sortedStmts.map((s, i) => {
        if (!s.networth || !s.pat) return null;
        const v = s.pat / s.networth;
        return isFinite(v) ? v : null;
      })},
      { label: 'D/E Ratio',     values: sortedStmts.map(s => {
        if (!s.networth || !s.total_debt) return null;
        const v = s.total_debt / s.networth;
        return isFinite(v) ? v : null;
      })},
      { label: 'EBITDA Margin', values: sortedStmts.map(s => {
        if (!s.revenue || !s.ebitda) return null;
        return s.ebitda / s.revenue;
      })},
    ],
  } : null;

  // ── 8. Build directors list ───────────────────────────────────────────────
  const directors = credhiveDirectors.length > 0
    ? credhiveDirectors
    : (dbCompany?.directors || []);

  // ── 9. Build response (compatible with listed PreviewData + unlisted extras) ──
  const { ratios, valuation, thesis, risks, ratingScore, ratingLabel, fhs } = analytics;

  return {
    // Core identity
    symbol: compCin || companyName,
    companyName,
    exchange: 'UNLISTED',
    sector,
    industry,
    broadSector: sector,
    isUnlisted: true,
    cin: compCin,
    incorporationDate: credhiveProfile?.date_of_incorporation || dbCompany?.incorporation_date || null,
    listingStage: dbCompany?.listing_stage || null,
    companyDescription: description,

    // Financials stub (null for unlisted — no live market data)
    financials: {
      price: transactionPrice,
      previousClose: null,
      marketCap: totalShares && transactionPrice ? totalShares * transactionPrice : null,
      pe: null,
      eps: null,
      roe: ratios.roe,
      roce: ratios.roce,
      pbRatio: null,
      bookValue: null,
      faceValue: dbCompany?.face_value ? parseFloat(dbCompany.face_value) : null,
      vwap: null,
      debtToEquity: ratios.debtToEquity,
      revenueGrowth: ratios.revenueGrowth,
      earningsGrowth: ratios.patGrowth,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      dividendYield: null,
      beta: null,
      targetMeanPrice: valuation.mid,
      currency: 'INR',
      returns1M: null,
      returns6M: null,
      returns1Y: null,
    },

    // Rating
    rating: {
      rating: ratingLabel,
      score: ratingScore,
      breakdown: { fundamentals: Math.round(fhs * 0.5), valuation: Math.round(ratingScore * 0.3), momentum: Math.round(ratingScore * 0.2) },
      rationale: `Unlisted equity rated based on Financial Health Score (${fhs}/100), valuation models (${valuation.method}), and compliance signals.`,
    },

    // Technical levels — not applicable for unlisted
    levels: { support: 0, resistance: 0, stopLoss: 0, target1: 0, target2: 0 },
    weekRange52Position: 'N/A (Unlisted)',
    valuationSummary: valuation.method !== 'Insufficient Data'
      ? `Blended intrinsic value range ₹${(valuation.low || 0).toFixed(0)}–₹${(valuation.high || 0).toFixed(0)} per share via ${valuation.method}`
      : 'Insufficient financial data for valuation',

    generatedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),

    // Price targets
    priceTarget: valuation.mid ? {
      peBased: null,
      pbBased: null,
      blended: valuation.mid,
      upside: valuation.upside ? valuation.upside * 100 : null,
      bear: valuation.low,
      base: valuation.mid,
      bull: valuation.high,
      method: valuation.method,
    } : null,
    peg: null,

    // Analysis
    thesis,
    risks,
    shareholding: null,
    peers: [],
    sectorAvg: null,
    commentary: null,
    managementNote: directors.length > 0
      ? `${companyName} is led by ${directors.slice(0, 3).map((d: any) => d.name || d.din).join(', ')}${directors.length > 3 ? ` and ${directors.length - 3} others` : ''}.`
      : `Director details for ${companyName} are available via MCA filings.`,

    // Historical tables
    plHistory,
    bsHistory,
    cfHistory,
    ratiosHistory,
    quarterlyHistory: null,
    salesCagr3Y: ratios.revenueCagr3Y,
    salesCagr5Y: null,
    profitCagr3Y: ratios.patCagr3Y,
    profitCagr5Y: null,
    keyPoints: { pros: thesis.slice(0, 3), cons: risks.slice(0, 3) },

    // Unlisted-specific extras
    unlistedExtras: {
      fhs,
      totalShares,
      transactionPrice,
      valuationRange: valuation,
      evEbitda: valuation.evEbitda,
      dcf: valuation.dcf,
      revenueMultiple: valuation.revenueMultiple,
      directors: directors.slice(0, 10),
      compliance: credhiveCompliance,
      ratios,
      dataSource: credhiveFinancials.length > 0 ? 'credhive' : dbFinancials.length > 0 ? 'db_cache' : 'unavailable',
      credhiveAvailable: credhiveService.isAvailable(),
    },

    dataQuality: {
      price: { source: transactionPrice ? 'ADMIN_PUBLISHED' : 'UNAVAILABLE', fetchedAt: new Date().toISOString() },
      fundamentals: { source: credhiveFinancials.length > 0 ? 'CREDHIVE' : dbFinancials.length > 0 ? 'DB_CACHE' : 'UNAVAILABLE', scrapedAt: null, ageHours: null },
      peers: { source: 'UNLISTED_NA', enrichedAt: new Date().toISOString(), count: 0 },
      shareholding: { source: 'UNLISTED_NA' },
      sectorAvg: { source: 'UNLISTED_NA', stockCount: 0 },
    },
  };
}

// POST /api/research-note/preview-unlisted
router.post("/preview-unlisted", async (req: Request, res: Response) => {
  try {
    const { cin } = req.body;
    if (!cin?.trim()) return res.status(400).json({ error: "CIN is required" });
    const data = await buildUnlistedReportData(cin.trim());
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate unlisted research data" });
  }
});

// POST /api/research-note/generate/pdf-unlisted
router.post("/generate/pdf-unlisted", async (req: Request, res: Response) => {
  try {
    const { cin } = req.body;
    if (!cin?.trim()) return res.status(400).json({ error: "CIN is required" });
    const data = await buildUnlistedReportData(cin.trim());
    // Build ReportData-compatible shape for the PDF generator
    const reportData: ReportData = {
      symbol: data.symbol,
      companyName: data.companyName,
      exchange: data.exchange,
      sector: data.sector,
      industry: data.industry,
      broadSector: data.broadSector,
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
    };
    const buffer = await generatePDF(reportData);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Unlisted_Report.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate unlisted PDF" });
  }
});

// POST /api/research-note/generate/ppt-unlisted
router.post("/generate/ppt-unlisted", async (req: Request, res: Response) => {
  try {
    const { cin } = req.body;
    if (!cin?.trim()) return res.status(400).json({ error: "CIN is required" });
    const data = await buildUnlistedReportData(cin.trim());
    const reportData: ReportData = {
      symbol: data.symbol,
      companyName: data.companyName,
      exchange: data.exchange,
      sector: data.sector,
      industry: data.industry,
      broadSector: data.broadSector,
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
    };
    const buffer = await generatePPT(reportData);
    const safeName = data.companyName.replace(/[^a-zA-Z0-9]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_Unlisted_Research.pptx"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to generate unlisted PPT" });
  }
});

export default router;
