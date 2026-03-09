import { Router, Request, Response } from "express";
import { resolveCompany } from "../modules/research/resolver";
import { getFinancialData } from "../modules/research/dataService";
import { momentumSignal, priceLevels, weekRange52Position } from "../modules/research/technicalEngine";
import { valuationSummary, pegRating, priceToTargetUpside } from "../modules/research/valuationEngine";
import { computeRating } from "../modules/research/recommendationEngine";
import { generatePPT, generatePDF, generateOnePager, ReportData } from "../modules/research/reportService";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (!q || q.length < 2) return res.json([]);

    const pattern = `%${q.toUpperCase()}%`;
    const rows = await db.execute(sql`
      SELECT symbol, isin, company_name, sector, nse_code, bse_code
      FROM listed_stocks
      WHERE is_active = true
        AND (
          UPPER(company_name) LIKE ${pattern}
          OR UPPER(symbol) LIKE ${pattern}
          OR UPPER(isin) LIKE ${pattern}
          OR UPPER(COALESCE(nse_code, '')) LIKE ${pattern}
        )
      ORDER BY
        CASE WHEN UPPER(symbol) = ${q.toUpperCase()} THEN 0
             WHEN UPPER(symbol) LIKE ${q.toUpperCase() + "%"} THEN 1
             ELSE 2 END,
        company_name
      LIMIT 10
    `);

    res.json(rows.rows || rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function resolveFromDB(input: string): Promise<{ symbol: string; name: string; exchange: string; isin?: string } | null> {
  const upper = input.toUpperCase().trim();
  const rows = await db.execute(sql`
    SELECT symbol, company_name, isin, 'NSE' as exchange
    FROM listed_stocks
    WHERE is_active = true
      AND (UPPER(isin) = ${upper} OR UPPER(symbol) = ${upper})
    LIMIT 1
  `);
  const r = (rows.rows || rows)[0] as any;
  if (!r) return null;
  return { symbol: r.symbol + ".NS", name: r.company_name, exchange: "NSE", isin: r.isin };
}

async function buildReportData(symbol: string): Promise<ReportData> {
  const dbResult = await resolveFromDB(symbol);
  const company = dbResult ?? await resolveCompany(symbol);
  const financials = await getFinancialData(company.symbol);

  const momentum = momentumSignal(
    financials.price,
    financials.fiftyTwoWeekHigh,
    financials.fiftyTwoWeekLow
  );
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
    support: 0, resistance: 0, stopLoss: 0, target1: 0, target2: 0
  };

  const rangePos = weekRange52Position(
    financials.price,
    financials.fiftyTwoWeekLow,
    financials.fiftyTwoWeekHigh
  );

  const valSummary = valuationSummary(
    financials.pe,
    financials.roe,
    financials.debtToEquity,
    financials.revenueGrowth,
    (financials as any).pbRatio ?? null
  );

  return {
    symbol: company.symbol,
    companyName: company.name,
    exchange: company.exchange,
    financials,
    rating,
    levels,
    weekRange52Position: rangePos,
    valuationSummary: valSummary,
    generatedAt: new Date().toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric"
    }),
  };
}

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { symbol } = req.body;
    if (!symbol?.trim()) {
      return res.status(400).json({ error: "Symbol is required" });
    }
    const data = await buildReportData(symbol.trim());
    res.json({
      symbol: data.symbol,
      companyName: data.companyName,
      exchange: data.exchange,
      financials: data.financials,
      rating: data.rating,
      levels: data.levels,
      weekRange52Position: data.weekRange52Position,
      valuationSummary: data.valuationSummary,
      generatedAt: data.generatedAt,
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

export default router;
