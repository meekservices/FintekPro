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

const router = Router();

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

  // ── 9a. Compute price-derived metrics from MCA fundamentals ─────────────────
  // Raw financial statement values are stored/returned in absolute rupees.
  // totalShares is the actual share count (not in lakhs/crores).
  const latestStmt = sortedStmts[0] ?? null;

  // EPS = PAT (₹) / total shares  → ₹ per share
  const computedEps: number | null = (() => {
    if (!latestStmt?.pat || !totalShares || totalShares <= 0) return null;
    const v = latestStmt.pat / totalShares;
    return isFinite(v) && v > 0 ? parseFloat(v.toFixed(2)) : null;
  })();

  // Book Value per share = Networth (₹) / total shares  → ₹ per share
  const computedBookValue: number | null = (() => {
    if (!latestStmt?.networth || !totalShares || totalShares <= 0) return null;
    const v = latestStmt.networth / totalShares;
    return isFinite(v) && v > 0 ? parseFloat(v.toFixed(2)) : null;
  })();

  // Implied PE = transaction price / EPS  (only meaningful when admin price exists)
  const computedPE: number | null = (() => {
    if (!transactionPrice || !computedEps || computedEps <= 0) return null;
    const v = transactionPrice / computedEps;
    return isFinite(v) && v > 0 ? parseFloat(v.toFixed(1)) : null;
  })();

  // Price-to-Book = transaction price / book value per share
  const computedPB: number | null = (() => {
    if (!transactionPrice || !computedBookValue || computedBookValue <= 0) return null;
    const v = transactionPrice / computedBookValue;
    return isFinite(v) && v > 0 ? parseFloat(v.toFixed(2)) : null;
  })();

  // Implied Market Cap = total shares × transaction price
  const computedMarketCap: number | null =
    totalShares && transactionPrice ? totalShares * transactionPrice : null;

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

    // Financials — price-based metrics computed from MCA fundamentals where possible
    financials: {
      price: transactionPrice,
      previousClose: null,
      marketCap: computedMarketCap,
      pe: computedPE,
      eps: computedEps,
      roe: ratios.roe,
      roce: ratios.roce,
      pbRatio: computedPB,
      bookValue: computedBookValue,
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

// GET /api/research-note/sector-picks
// Returns top buy-rated stocks from the same sector using financial scoring
router.get("/sector-picks", async (req: Request, res: Response) => {
  try {
    const { sector, industry, exclude, limit = "5" } = req.query as Record<string, string>;
    if (!sector && !industry) {
      return res.status(400).json({ error: "sector or industry is required" });
    }

    const maxResults = Math.min(parseInt(limit) || 5, 10);

    // Fetch stocks in the same sector with financial data
    const rows = await db.execute(sql`
      SELECT
        ls.symbol,
        ls.company_name,
        ls.sector,
        ls.industry,
        ls.current_price,
        ls.pe_ratio,
        ls.market_cap_value,
        COALESCE(sf.roe, ls.roe) AS roe,
        sf.revenue_growth,
        sf.debt_to_equity,
        sf.earnings_growth,
        sf.roce
      FROM listed_stocks ls
      LEFT JOIN screener_financials sf ON sf.symbol = ls.symbol
      WHERE ls.is_published = true
        AND ls.symbol != ${exclude || ""}
        AND (
          ${sector ? sql`ls.sector = ${sector}` : sql`TRUE`}
        )
        AND ls.company_name IS NOT NULL
      ORDER BY ls.market_cap_value DESC NULLS LAST
      LIMIT 80
    `);

    const rawRows = ((rows as any).rows || rows) as any[];
    const stocks = rawRows.filter((r: any) => r.symbol && r.company_name);

    // Score each stock using FintekPro financial heuristics
    const scored = stocks.map((s: any) => {
      let score = 0;
      const roe = s.roe ? parseFloat(s.roe) : null;
      const pe = s.pe_ratio ? parseFloat(s.pe_ratio) : null;
      const revGrowth = s.revenue_growth ? parseFloat(s.revenue_growth) : null;
      const de = s.debt_to_equity ? parseFloat(s.debt_to_equity) : null;
      const epsGrowth = s.earnings_growth ? parseFloat(s.earnings_growth) : null;
      const roce = s.roce ? parseFloat(s.roce) : null;

      // ROE scoring (0-5) — sf.roe stored as decimal (e.g. 0.179 = 17.9%)
      if (roe !== null) {
        const roePct = roe > 1 ? roe : roe * 100; // normalise to percentage
        if (roePct >= 20) score += 5;
        else if (roePct >= 15) score += 4;
        else if (roePct >= 10) score += 3;
        else if (roePct >= 0) score += 1;
        else score -= 1;
      }

      // PE scoring (0-4)
      if (pe !== null && pe > 0) {
        if (pe <= 15) score += 4;
        else if (pe <= 25) score += 3;
        else if (pe <= 40) score += 2;
        else if (pe <= 60) score += 1;
      }

      // Revenue growth scoring (0-4)
      if (revGrowth !== null) {
        const rg = revGrowth > 1 ? revGrowth / 100 : revGrowth;
        if (rg >= 0.20) score += 4;
        else if (rg >= 0.10) score += 3;
        else if (rg >= 0.0) score += 2;
        else score -= 1;
      }

      // D/E scoring (0-3)
      if (de !== null) {
        if (de <= 0.5) score += 3;
        else if (de <= 1.0) score += 2;
        else if (de <= 2.0) score += 1;
      }

      // Earnings growth (0-3)
      if (epsGrowth !== null) {
        const eg = epsGrowth > 1 ? epsGrowth / 100 : epsGrowth;
        if (eg >= 0.20) score += 3;
        else if (eg >= 0.10) score += 2;
        else if (eg >= 0.0) score += 1;
      }

      // ROCE bonus — also stored as decimal
      if (roce !== null) {
        const rocePct = roce > 1 ? roce : roce * 100;
        if (rocePct >= 15) score += 1;
      }

      let recommendation: "STRONG BUY" | "BUY" | "HOLD" | "AVOID" = "HOLD";
      if (score >= 13) recommendation = "STRONG BUY";
      else if (score >= 8) recommendation = "BUY";
      else if (score < 3) recommendation = "AVOID";

      return {
        symbol: s.symbol,
        companyName: s.company_name,
        sector: s.sector,
        industry: s.industry,
        currentPrice: s.current_price ? parseFloat(s.current_price) : null,
        pe: pe,
        roe: roe,
        revenueGrowth: revGrowth,
        debtToEquity: de,
        earningsGrowth: epsGrowth,
        score,
        recommendation,
      };
    });

    // Return only BUY and STRONG BUY, sorted by score
    const buys = scored
      .filter((s) => s.recommendation === "STRONG BUY" || s.recommendation === "BUY")
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    res.json({
      success: true,
      sector,
      industry,
      count: buys.length,
      picks: buys,
    });
  } catch (err: any) {
    console.error("Error fetching sector picks:", err);
    res.status(500).json({ error: err.message || "Failed to fetch sector picks" });
  }
});


export default router;
