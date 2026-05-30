import { Express } from 'express';
import { db } from '../db';
import { sql, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { insertCreditRatingSchema, mutualFunds, listedStocks } from '@shared/schema';
import { creditRatingsService } from '../services/credit-ratings-service';
import { alpacaSseService } from '../services/alpaca-sse-service';
import { symbolMappingService } from '../services/symbol-mapping-service';
import { storage } from '../storage';

const insertSymbolMappingSchema = z.record(z.string(), z.any());

export function registerSecurityMasterCreditRatingRoutes(app: Express): void {
// GET /api/marketdata/security/search?q= — MUST come before /:isin to prevent route shadowing
app.get("/api/marketdata/security/search", async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Search query must be at least 2 characters" });
    }
    
    const searchTerm = `%${query}%`;
    const results = await db.execute(sql`
      SELECT * FROM security_master 
      WHERE instrument_name ILIKE ${searchTerm} 
         OR symbol ILIKE ${searchTerm} 
         OR isin ILIKE ${searchTerm}
      LIMIT 50
    `);
    
    res.json(results.rows);
  } catch (error: any) {
    console.error("[SecurityMaster] Search error:", error.message);
    res.status(500).json({ message: "Internal server error searching securities" });
  }
});

// GET /api/marketdata/security/:isin — queries the view and returns the matching row
app.get("/api/marketdata/security/:isin", async (req, res) => {
  try {
    const { isin } = req.params;
    const results = await db.execute(sql`
      SELECT * FROM security_master WHERE isin = ${isin}
    `);
    
    if (!results.rows || results.rows.length === 0) {
      return res.status(404).json({ message: `Security with ISIN ${isin} not found` });
    }
    
    res.json(results.rows[0]);
  } catch (error: any) {
    console.error("[SecurityMaster] Fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching security data" });
  }
});

// GET /api/marketdata/symbol-map/:isin — returns all providers for that ISIN
app.get("/api/marketdata/symbol-map/:isin", async (req, res) => {
  try {
    const { isin } = req.params;
    const mappings = await symbolMappingService.lookupProviders(isin);
    res.json(mappings);
  } catch (error: any) {
    console.error("[SymbolMapping] Fetch error:", error.message);
    res.status(500).json({ message: "Internal server error fetching symbol mappings" });
  }
});

// GET /api/marketdata/resolve-symbol?provider=NSE&symbol=RELIANCE — returns ISIN
app.get("/api/marketdata/resolve-symbol", async (req, res) => {
  try {
    const { provider, symbol } = req.query;
    if (!provider || !symbol) {
      return res.status(400).json({ message: "Provider and symbol are required" });
    }
    const isin = await symbolMappingService.resolveSymbol(provider as string, symbol as string);
    if (!isin) {
      return res.status(404).json({ message: "Symbol not found" });
    }
    res.json({ isin });
  } catch (error: any) {
    console.error("[SymbolMapping] Resolve error:", error.message);
    res.status(500).json({ message: "Internal server error resolving symbol" });
  }
});

// POST /api/marketdata/symbol-map — add a new symbol mapping (for admin)
app.post("/api/marketdata/symbol-map", async (req, res) => {
  try {
    const validatedData = insertSymbolMappingSchema.parse(req.body);
    const newMapping = await symbolMappingService.addMapping(validatedData);
    res.status(201).json(newMapping);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", errors: error.issues });
    }
    console.error("[SymbolMapping] Add error:", error.message);
    res.status(500).json({ message: "Internal server error adding symbol mapping" });
  }
});
// Credit Ratings Routes
app.get("/api/marketdata/credit-rating/:isin", async (req, res) => {
  try {
    const { isin } = req.params;

    // ── Step 1: Corporate bond credit rating (CRISIL / ICRA / CARE / Fitch) ──
    const bondRating = await creditRatingsService.getCurrentRating(isin);
    if (bondRating) {
      return res.json({
        ...bondRating,
        assetType: "corporate_bond",
        ratingSystem: "bond_credit_rating",
      });
    }

    // ── Step 2: Government / sovereign securities ──
    const gSecResult = await db.execute(
      sql`SELECT isin, security_name, security_type, issuer, credit_rating, maturity_date, coupon_rate
          FROM government_securities WHERE isin = ${isin} LIMIT 1`
    );
    const gSec = gSecResult.rows[0] as {
      isin: string; security_name: string; security_type: string;
      issuer: string; credit_rating: string; maturity_date: string; coupon_rate: string;
    } | undefined;

    if (gSec) {
      return res.json({
        isin,
        instrumentName: gSec.security_name,
        rating: "SOV",
        ratingOutlook: "Stable",
        agency: gSec.issuer === "Government of India" ? "GOI / RBI" : "State Government",
        ratingDate: null,
        ratingAction: "Affirmed",
        isCurrent: true,
        source: "sovereign",
        assetType: "government_security",
        ratingSystem: "sovereign_rating",
        securityType: gSec.security_type,
        issuer: gSec.issuer,
        maturityDate: gSec.maturity_date,
        couponRate: gSec.coupon_rate,
        ratingNote: "Government securities carry sovereign (SOV) credit rating — the highest possible rating, backed by the Government of India's full faith and credit.",
      });
    }

    // ── Step 3: Listed equity stocks ──
    const [stock] = await db
      .select({
        isin: listedStocks.isin,
        symbol: listedStocks.symbol,
        companyName: listedStocks.companyName,
        sector: listedStocks.sector,
        marketCap: listedStocks.marketCap,
        peRatio: listedStocks.peRatio,
        roe: listedStocks.roe,
      })
      .from(listedStocks)
      .where(eq(listedStocks.isin, isin))
      .limit(1);

    if (stock) {
      return res.json({
        isin,
        instrumentName: stock.companyName,
        symbol: stock.symbol,
        assetType: "equity",
        ratingSystem: "fintekpro_smart_rating",
        ratingNote: "Traditional credit ratings (CRISIL/ICRA) are not issued for equity shares. Use the FintekPro Smart Rating for a proprietary multi-factor quality assessment.",
        fintekProRatingEndpoint: `/api/ratings/stock/${stock.symbol}`,
        fundamentals: {
          sector: stock.sector,
          marketCap: stock.marketCap,
          peRatio: stock.peRatio ? Number(stock.peRatio) : null,
          roe: stock.roe ? Number(stock.roe) : null,
        },
      });
    }

    // ── Step 4: Mutual funds (looked up by ISIN via extended_data) ──
    const [mf] = await db
      .select({
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        category: mutualFunds.category,
        fundHouse: mutualFunds.fundHouse,
        crisilRating: mutualFunds.crisilRating,
        crisilCategory: mutualFunds.crisilCategory,
        crisilPercentile: mutualFunds.crisilPercentile,
        crisilOverallScore: mutualFunds.crisilOverallScore,
        crisilEvaluationDate: mutualFunds.crisilEvaluationDate,
      })
      .from(mutualFunds)
      .where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
      .limit(1);

    if (mf) {
      return res.json({
        isin,
        instrumentName: mf.schemeName,
        schemeCode: mf.schemeCode,
        assetType: "mutual_fund",
        ratingSystem: "fintekpro_smart_rating",
        ratingNote: "Mutual funds are evaluated using the FintekPro Smart Rating — a proprietary 1–5 star system based on risk-adjusted returns, quality, liquidity, momentum, and valuation.",
        fintekProRating: mf.crisilRating,
        fintekProStars: mf.crisilRating,
        fintekProCategory: mf.crisilCategory,
        fintekProPercentile: mf.crisilPercentile ? Number(mf.crisilPercentile) : null,
        fintekProOverallScore: mf.crisilOverallScore ? Number(mf.crisilOverallScore) : null,
        evaluationDate: mf.crisilEvaluationDate,
        fundHouse: mf.fundHouse,
        category: mf.category,
        disclaimer: "FintekPro Smart Ratings are proprietary and not affiliated with CRISIL, ICRA, or any third-party agency.",
      });
    }

    // ── Nothing matched ──
    return res.status(404).json({
      message: "Rating not found",
      isin,
      hint: "No corporate bond, government security, listed equity, or mutual fund matches this ISIN in the FintekPro database.",
    });
  } catch (error) {
    console.error("Error fetching credit rating:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/marketdata/credit-rating/:isin/history", async (req, res) => {
  try {
    const history = await creditRatingsService.getRatingHistory(req.params.isin);
    res.json(history);
  } catch (error) {
    console.error("Error fetching rating history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/api/marketdata/credit-rating", async (req, res) => {
  try {
    const validatedData = insertCreditRatingSchema.parse(req.body);
    const newRating = await creditRatingsService.upsertRating(validatedData);
    res.status(201).json(newRating);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", errors: error.issues });
    }
    console.error("Error upserting credit rating:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

}
