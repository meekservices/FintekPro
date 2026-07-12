/**
 * instrument-screener-routes.ts
 * Universal multi-asset screener: Mutual Funds, Bonds, ETFs, Stocks.
 *
 * Routes:
 *   GET  /api/screener/instruments            — paginated screener list (type-switched)
 *   GET  /api/screener/instruments/filters    — available filter fields per type
 *   GET  /api/screener/instruments/:id        — unified detail (MF/Bond/ETF)
 *
 * FASP-AI v3.0 compliance:
 *   - All responses include engine_version, timestamp, disclaimer
 *   - AI is advisory only — no autonomous buy/sell execution
 *   - MF & Bond results include SEBI-mandated risk disclosure
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import {
  mutualFunds,
  governmentSecurities,
  corporateBonds,
  listedStocks,
} from "@shared/schema";
import { and, eq, gte, lte, ilike, sql, desc, asc, or } from "drizzle-orm";
// Structured logging via console (PII-scrubbed by logger.ts interceptor)

export const instrumentScreenerRouter = Router();

const ENGINE_VERSION = "FASP-AI-v3.0";
const DISCLAIMERS: Record<string, string> = {
  mutual_fund:
    "Mutual Fund investments are subject to market risks. Read all scheme-related documents carefully before investing. Past performance is not indicative of future returns.",
  bond:
    "Bond investments carry credit risk and interest rate risk. Credit ratings are indicative and may change. SEBI-registered Investment Advisors must disclose conflicts of interest. Not a solicitation to invest.",
  etf:
    "ETFs are subject to market risk. NAV may fluctuate. Past performance is not indicative of future returns.",
  stock:
    "Equity investments are subject to market risk. Past performance is not indicative of future returns.",
};

// ─── Bond rating hierarchy (for minRating filter) ────────────────────────────
const BOND_RATING_HIERARCHY = [
  "D", "C", "CC", "CCC", "B-", "B", "B+",
  "BB-", "BB", "BB+", "BBB-", "BBB", "BBB+",
  "A-", "A", "A+", "AA-", "AA", "AA+", "AAA",
];

/**
 * GET /api/screener/instruments
 *
 * Universal screener. Query params:
 *   type          "mutual_fund" | "bond" | "etf" | "stock"  (default: "mutual_fund")
 *   page          number (default: 1)
 *   limit         number (default: 25, max: 100)
 *   sortBy        field name
 *   sortOrder     "asc" | "desc"
 *
 *   — MF filters —
 *   category      e.g. "Equity", "Debt", "Hybrid", "ELSS", "Index", "Liquid"
 *   fundHouse     AMC name substring
 *   riskLevel     "Low" | "Moderate" | "High" | "Very High"
 *   minReturn1y   number (%)
 *   minReturn3y   number (%)
 *   minReturn5y   number (%)
 *   maxExpenseRatio number (%)
 *   minAum        number (Cr)
 *   minRating     1-5 (FintekPro Smart Rating)
 *
 *   — Bond filters —
 *   bondType      "govt" | "corporate" | "all" (default: "all")
 *   minYield      number (%)
 *   maxYield      number (%)
 *   minCoupon     number (%)
 *   minRating     credit rating floor e.g. "AA" (inclusive upward)
 *   maxMaturityYears number
 *   taxStatus     "taxfree" | "taxable" | "all"
 *
 *   — ETF filters —
 *   etfCategory   "nifty" | "sectoral" | "gold" | "international" | "all"
 *   minAum        number (Cr)
 */
instrumentScreenerRouter.get("/instruments", async (req: Request, res: Response) => {
  const start = Date.now();
  const {
    type = "mutual_fund",
    page = "1",
    limit = "25",
    sortBy,
    sortOrder = "desc",
    // MF
    category,
    fundHouse,
    riskLevel,
    minReturn1y,
    minReturn3y,
    minReturn5y,
    maxExpenseRatio,
    minAum,
    minRating,
    // Bond
    bondType = "all",
    minYield,
    maxYield,
    minCoupon,
    maxMaturityYears,
    taxStatus,
    // ETF
    etfCategory,
    // Search
    q,
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * limitNum;

  try {
    // ── Mutual Funds ──────────────────────────────────────────────────────────
    if (type === "mutual_fund") {
      const conditions: ReturnType<typeof eq>[] = [];

      // ── MF Category filter — handles AMFI's varied naming conventions ─────
      if (category) {
        if (category.toLowerCase() === "international") {
          // AMFI stores international funds under multiple sub-categories:
          // "Overseas Fund of Fund", "International Fund", "Global", "Overseas",
          // "Thematic - International", "Equity Savings - International", etc.
          conditions.push(
            or(
              ilike(mutualFunds.category, "%International%"),
              ilike(mutualFunds.category, "%Overseas%"),
              ilike(mutualFunds.category, "%Global%"),
              ilike(mutualFunds.schemeName, "%Nasdaq%"),
              ilike(mutualFunds.schemeName, "%S&P%"),
              ilike(mutualFunds.schemeName, "%US Bluechip%"),
              ilike(mutualFunds.schemeName, "%World%"),
              ilike(mutualFunds.schemeName, "%Hang Seng%"),
              ilike(mutualFunds.schemeName, "%FTSE%"),
              ilike(mutualFunds.schemeSubCategory, "%International%"),
              ilike(mutualFunds.schemeSubCategory, "%Overseas%"),
            ) as ReturnType<typeof eq>
          );
        } else {
          conditions.push(ilike(mutualFunds.category, `%${category}%`));
        }
      }

      if (fundHouse) conditions.push(ilike(mutualFunds.fundHouse, `%${fundHouse}%`));
      if (riskLevel) conditions.push(ilike(mutualFunds.riskLevel, `%${riskLevel}%`));
      if (q) conditions.push(ilike(mutualFunds.schemeName, `%${q}%`));
      if (minReturn1y) conditions.push(gte(mutualFunds.returns1y, minReturn1y));
      if (minReturn3y) conditions.push(gte(mutualFunds.returns3y, minReturn3y));
      if (minReturn5y) conditions.push(gte(mutualFunds.returns5y, minReturn5y));
      if (maxExpenseRatio) conditions.push(lte(mutualFunds.expenseRatio, maxExpenseRatio));
      if (minAum) conditions.push(gte(mutualFunds.aum, minAum));
      if (minRating) conditions.push(lte(mutualFunds.crisilRating, parseInt(minRating, 10)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Default sort: by 1Y returns desc
      const mfSortCol =
        sortBy === "returns3y" ? mutualFunds.returns3y :
        sortBy === "returns5y" ? mutualFunds.returns5y :
        sortBy === "aum"       ? mutualFunds.aum :
        sortBy === "nav"       ? mutualFunds.nav :
        sortBy === "expenseRatio" ? mutualFunds.expenseRatio :
        sortBy === "rating"    ? mutualFunds.crisilRating :
        mutualFunds.returns1y;

      const orderFn = sortOrder === "asc" ? asc : desc;

      const [funds, countResult] = await Promise.all([
        db.select({
          id:            mutualFunds.id,
          schemeCode:    mutualFunds.schemeCode,
          schemeName:    mutualFunds.schemeName,
          category:      mutualFunds.category,
          fundHouse:     mutualFunds.fundHouse,
          nav:           mutualFunds.nav,
          change:        mutualFunds.change,
          changePercent: mutualFunds.changePercent,
          expenseRatio:  mutualFunds.expenseRatio,
          aum:           mutualFunds.aum,
          riskLevel:     mutualFunds.riskLevel,
          returns1y:     mutualFunds.returns1y,
          returns3y:     mutualFunds.returns3y,
          returns5y:     mutualFunds.returns5y,
          rating:        mutualFunds.crisilRating,
          ratingPercentile: mutualFunds.crisilPercentile,
          // Transactability fields
          isin:          mutualFunds.isin,
          isinGrowth:    mutualFunds.isinGrowth,
          amfiCode:      mutualFunds.amfiCode,
          planType:      mutualFunds.planType,
        })
          .from(mutualFunds)
          .where(whereClause)
          .orderBy(orderFn(mfSortCol))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(mutualFunds)
          .where(whereClause),
      ]);

      // Build transact block for IRIS MF order placement
      const fundsWithTransact = funds.map((f) => ({
        ...f,
        transact: {
          // IRIS MF order identifiers
          exchange: "BSE",                              // MF orders via BSE StarMF platform
          isin: f.isinGrowth ?? f.isin ?? null,         // Prefer growth ISIN (regular plan)
          schemeCode: f.schemeCode,                     // AMFI scheme code for IRIS / RTA
          amfiCode: f.amfiCode ?? f.schemeCode,         // AMFI identifier (same as schemeCode for most)
          planType: f.planType ?? "regular",            // FintekPro is a distributor — always regular
          // Execution routing hint
          executionApi: "iris",
          orderType: "mf_purchase",
        },
      }));

      // eslint-disable-next-line no-console
      console.info(JSON.stringify({
        event: "SCREENER_MF_QUERY",
        user_id: (req as any).user?.id ?? null,
        latency_ms: Date.now() - start,
        status: "success",
        count: funds.length,
      }));

      return res.json({
        success: true,
        type: "mutual_fund",
        data: fundsWithTransact,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total: Number(countResult[0]?.count ?? 0),
          disclaimer: DISCLAIMERS.mutual_fund,
        },
      });
    }

    // ── Bonds (G-Secs + Corporate) ─────────────────────────────────────────
    if (type === "bond") {
      const minRatingIdx = minRating
        ? BOND_RATING_HIERARCHY.indexOf(minRating.toUpperCase())
        : -1;
      const ratingWhitelist =
        minRatingIdx >= 0 ? BOND_RATING_HIERARCHY.slice(minRatingIdx) : null;

      const maxMaturityDate = maxMaturityYears
        ? new Date(Date.now() + parseInt(maxMaturityYears, 10) * 365 * 24 * 3600 * 1000)
            .toISOString()
            .slice(0, 10)
        : null;

      // G-Secs query
      const govtQuery = db
        .select({
          id:              governmentSecurities.id,
          isin:            governmentSecurities.isin,
          name:            governmentSecurities.securityName,
          issuer:          governmentSecurities.issuer,
          bondType:        sql<string>`'govt'`,
          couponRate:      governmentSecurities.couponRate,
          yieldToMaturity: governmentSecurities.yieldToMaturity,
          maturityDate:    governmentSecurities.maturityDate,
          tenorYears:      governmentSecurities.tenorYears,
          currentPrice:    governmentSecurities.currentPrice,
          faceValue:       governmentSecurities.faceValue,
          creditRating:    governmentSecurities.creditRating,
          taxStatus:       governmentSecurities.taxStatus,
          minimumInvestment: governmentSecurities.minimumInvestment,
          securityType:    governmentSecurities.securityType,
          tradingStatus:   governmentSecurities.tradingStatus,
          // Transactability
          dataSource:      governmentSecurities.dataSource,
        })
        .from(governmentSecurities)
        .where(
          and(
            ...[
              eq(governmentSecurities.tradingStatus, "active"),
              minYield  ? gte(governmentSecurities.yieldToMaturity, minYield)  : undefined,
              maxYield  ? lte(governmentSecurities.yieldToMaturity, maxYield)  : undefined,
              minCoupon ? gte(governmentSecurities.couponRate, minCoupon)      : undefined,
              maxMaturityDate ? lte(governmentSecurities.maturityDate, maxMaturityDate) : undefined,
              taxStatus === "taxfree" ? eq(governmentSecurities.taxStatus, "taxfree") : undefined,
              q ? ilike(governmentSecurities.securityName, `%${q}%`) : undefined,
            ].filter(Boolean) as ReturnType<typeof eq>[]
          )
        );

      // Corporate Bonds query
      const corpQuery = db
        .select({
          id:              corporateBonds.id,
          isin:            corporateBonds.isin,
          name:            corporateBonds.bondName,
          issuer:          corporateBonds.issuer,
          bondType:        sql<string>`'corporate'`,
          couponRate:      corporateBonds.couponRate,
          yieldToMaturity: corporateBonds.yieldToMaturity,
          maturityDate:    corporateBonds.maturityDate,
          tenorYears:      corporateBonds.tenorYears,
          currentPrice:    corporateBonds.currentPrice,
          faceValue:       corporateBonds.faceValue,
          creditRating:    corporateBonds.creditRating,
          taxStatus:       corporateBonds.taxStatus,
          minimumInvestment: corporateBonds.minimumInvestment,
          securityType:    corporateBonds.bondType,
          tradingStatus:   corporateBonds.tradingStatus,
          // Transactability
          dataSource:      corporateBonds.dataSource,
        })
        .from(corporateBonds)
        .where(
          and(
            ...[
              eq(corporateBonds.tradingStatus, "active"),
              minYield  ? gte(corporateBonds.yieldToMaturity, minYield)  : undefined,
              maxYield  ? lte(corporateBonds.yieldToMaturity, maxYield)  : undefined,
              minCoupon ? gte(corporateBonds.couponRate, minCoupon)      : undefined,
              maxMaturityDate ? lte(corporateBonds.maturityDate, maxMaturityDate) : undefined,
              taxStatus === "taxfree" ? eq(corporateBonds.taxStatus, "taxfree") : undefined,
              q ? ilike(corporateBonds.bondName, `%${q}%`) : undefined,
            ].filter(Boolean) as ReturnType<typeof eq>[]
          )
        );

      let bonds: unknown[] = [];
      if (bondType === "govt") {
        bonds = await govtQuery.limit(limitNum).offset(offset);
      } else if (bondType === "corporate") {
        bonds = await corpQuery.limit(limitNum).offset(offset);
      } else {
        const [govt, corp] = await Promise.all([govtQuery, corpQuery]);
        bonds = [...govt, ...corp];
        // Filter by rating if provided
        if (ratingWhitelist) {
          bonds = (bonds as { creditRating: string | null }[]).filter(
            (b) => b.creditRating && ratingWhitelist.includes(b.creditRating.toUpperCase())
          );
        }
        // Sort by YTM desc by default
        bonds.sort((a: any, b: any) =>
          sortOrder === "asc"
            ? parseFloat(a.yieldToMaturity ?? "0") - parseFloat(b.yieldToMaturity ?? "0")
            : parseFloat(b.yieldToMaturity ?? "0") - parseFloat(a.yieldToMaturity ?? "0")
        );
        const total = bonds.length;
        bonds = bonds.slice(offset, offset + limitNum);

        // Build transact block for IRIS bond desk order placement
        bonds = (bonds as any[]).map((b) => ({
          ...b,
          transact: {
            isin: b.isin,
            // Derive exchange from data source
            exchange: b.dataSource?.includes("bse") ? "BSE" : "NSE",
            executionApi: "iris",
            orderType: "bond_purchase",
          },
        }));

        // eslint-disable-next-line no-console
        console.info(JSON.stringify({
          event: "SCREENER_BOND_QUERY",
          user_id: (req as any).user?.id ?? null,
          latency_ms: Date.now() - start,
          status: "success",
          count: bonds.length,
        }));

        return res.json({
          success: true,
          type: "bond",
          data: bonds,
          meta: {
            timestamp: new Date().toISOString(),
            engine_version: ENGINE_VERSION,
            page: pageNum,
            limit: limitNum,
            total,
            disclaimer: DISCLAIMERS.bond,
          },
        });
      }

      return res.json({
        success: true,
        type: "bond",
        data: (bonds as any[]).map((b) => ({
          ...b,
          transact: {
            isin: b.isin,
            exchange: b.dataSource?.includes("bse") ? "BSE" : "NSE",
            executionApi: "iris",
            orderType: "bond_purchase",
          },
        })),
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total: bonds.length,
          disclaimer: DISCLAIMERS.bond,
        },
      });
    }

    // ── ETFs ─────────────────────────────────────────────────────────────────
    if (type === "etf") {
      const etfConditions: ReturnType<typeof eq>[] = [
        eq(listedStocks.isActive, true),
        or(
          ilike(listedStocks.companyName, "%ETF%"),
          ilike(listedStocks.companyName, "%Exchange Traded Fund%"),
          ilike(listedStocks.companyName, "%BeES%"),
          ilike(listedStocks.companyName, "%Index Fund%"),
          ilike(listedStocks.companyName, "%NIFTY%"),
          ilike(listedStocks.companyName, "%Sensex%"),
          ilike(listedStocks.sector, "%ETF%"),
        ) as ReturnType<typeof eq>,
      ];

      if (q) etfConditions.push(or(
        ilike(listedStocks.companyName, `%${q}%`),
        ilike(listedStocks.symbol, `%${q}%`),
      ) as ReturnType<typeof eq>);

      if (etfCategory === "gold") etfConditions.push(
        or(
          ilike(listedStocks.companyName, "%Gold%"),
          ilike(listedStocks.companyName, "%SGB%"),
        ) as ReturnType<typeof eq>
      );
      if (etfCategory === "international") etfConditions.push(
        or(
          ilike(listedStocks.companyName, "%Nasdaq%"),
          ilike(listedStocks.companyName, "%S&P%"),
          ilike(listedStocks.companyName, "%US%"),
          ilike(listedStocks.companyName, "%World%"),
          ilike(listedStocks.companyName, "%Global%"),
          ilike(listedStocks.companyName, "%Hang Seng%"),
          ilike(listedStocks.companyName, "%N100%"),
          ilike(listedStocks.companyName, "%MON100%"),
          ilike(listedStocks.companyName, "%FTSE%"),
          ilike(listedStocks.companyName, "%Nifty 50 USD%"),
        ) as ReturnType<typeof eq>
      );
      if (etfCategory === "sectoral") etfConditions.push(
        or(
          ilike(listedStocks.companyName, "%Bank%"),
          ilike(listedStocks.companyName, "%IT%"),
          ilike(listedStocks.companyName, "%Pharma%"),
          ilike(listedStocks.companyName, "%Auto%"),
          ilike(listedStocks.companyName, "%Infra%"),
          ilike(listedStocks.companyName, "%PSU%"),
          ilike(listedStocks.companyName, "%Consumption%"),
          ilike(listedStocks.companyName, "%Healthcare%"),
          ilike(listedStocks.companyName, "%Energy%"),
        ) as ReturnType<typeof eq>
      );
      if (etfCategory === "nifty") etfConditions.push(
        or(
          ilike(listedStocks.companyName, "%Nifty%"),
          ilike(listedStocks.companyName, "%N50%"),
          ilike(listedStocks.companyName, "%Nifty 50%"),
          ilike(listedStocks.companyName, "%Nifty100%"),
          ilike(listedStocks.companyName, "%Nifty 100%"),
          ilike(listedStocks.companyName, "%Nifty Midcap%"),
          ilike(listedStocks.companyName, "%Nifty Smallcap%"),
        ) as ReturnType<typeof eq>
      );

      const etfSortCol =
        sortBy === "currentPrice" ? listedStocks.currentPrice :
        sortBy === "marketCap"    ? listedStocks.marketCap :
        listedStocks.symbol;

      const [etfs, etfCount] = await Promise.all([
        db.select({
          id:           listedStocks.id,
          symbol:       listedStocks.symbol,
          companyName:  listedStocks.companyName,
          isin:         listedStocks.isin,
          sector:       listedStocks.sector,
          currentPrice: listedStocks.currentPrice,
          marketCap:    listedStocks.marketCap,
          exchange:     listedStocks.exchange,
          bseCode:      listedStocks.bseCode,
          // Transactability fields
          nseCode:      listedStocks.nseCode,
          country:      listedStocks.country,
          currency:     listedStocks.currency,
          exchangeInfo: listedStocks.exchangeInfo,
        })
          .from(listedStocks)
          .where(and(...etfConditions))
          .orderBy(sortOrder === "asc" ? asc(etfSortCol) : desc(etfSortCol))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(listedStocks)
          .where(and(...etfConditions)),
      ]);

      // Build transact block for IRIS equity order placement
      const etfsWithTransact = etfs.map((e) => {
        const isIndian = !e.country || e.country === "IN";
        return {
          ...e,
          transact: {
            isin: e.isin,
            exchange: e.exchange ?? "NSE",
            // NSE symbol for IRIS (NSE is primary for Indian ETFs)
            nseSymbol: e.symbol,
            bseCode: e.bseCode ?? null,
            nseCode: e.nseCode ?? "EQ",
            currency: e.currency ?? "INR",
            country: e.country ?? "IN",
            // Execution routing: IRIS for Indian ETFs, Alpaca for US/international
            executionApi: isIndian ? "iris" : "alpaca",
            orderType: "etf_purchase",
          },
        };
      });

      return res.json({
        success: true,
        type: "etf",
        data: etfsWithTransact,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total: Number(etfCount[0]?.count ?? 0),
          disclaimer: DISCLAIMERS.etf,
        },
      });
    }

    // ── Unknown type ──────────────────────────────────────────────────────────
    return res.status(400).json({
      success: false,
      error_code: "INVALID_INSTRUMENT_TYPE",
      message: `Invalid type '${type}'. Valid: mutual_fund | bond | etf | stock`,
      retryable: false,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });

  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.detail ?? "";
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({
      event: "SCREENER_INSTRUMENT_ERROR",
      user_id: (req as any).user?.id ?? null,
      latency_ms: Date.now() - start,
      status: "error",
      message: err.message,
      cause,
      instrument_type: type,
    }));
    return res.status(500).json({
      success: false,
      error_code: "INSTRUMENT_SCREENER_ERROR",
      message: `Failed to screen ${type} instruments`,
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});

// ─── GET /api/screener/instruments/filters ────────────────────────────────────
/** Returns the available filter field definitions for each instrument type. */
instrumentScreenerRouter.get("/instruments/filters", async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      mutual_fund: {
        sortFields: ["returns1y", "returns3y", "returns5y", "aum", "nav", "expenseRatio", "rating"],
        filters: [
          { key: "category",         label: "Category",          type: "select", options: ["Equity", "Debt", "Hybrid", "ELSS", "Index", "Liquid", "Arbitrage", "Thematic", "International", "Gold", "FOF"] },
          { key: "riskLevel",        label: "Risk Level",        type: "select", options: ["Low", "Moderately Low", "Moderate", "Moderately High", "High", "Very High"] },
          { key: "fundHouse",        label: "Fund House",        type: "text" },
          { key: "minReturn1y",      label: "Min 1Y Return (%)", type: "number" },
          { key: "minReturn3y",      label: "Min 3Y Return (%)", type: "number" },
          { key: "minReturn5y",      label: "Min 5Y Return (%)", type: "number" },
          { key: "maxExpenseRatio",  label: "Max Expense Ratio (%)", type: "number" },
          { key: "minAum",           label: "Min AUM (Cr)",      type: "number" },
          { key: "minRating",        label: "Min FintekPro Rating (1-5)", type: "number" },
        ],
      },
      bond: {
        sortFields: ["yieldToMaturity", "couponRate", "maturityDate", "creditRating"],
        filters: [
          { key: "bondType",         label: "Bond Type",         type: "select", options: ["all", "govt", "corporate"] },
          { key: "minYield",         label: "Min YTM (%)",       type: "number" },
          { key: "maxYield",         label: "Max YTM (%)",       type: "number" },
          { key: "minCoupon",        label: "Min Coupon (%)",    type: "number" },
          { key: "minRating",        label: "Min Rating",        type: "select", options: ["BBB", "A", "AA", "AA+", "AAA"] },
          { key: "maxMaturityYears", label: "Matures Within (years)", type: "number" },
          { key: "taxStatus",        label: "Tax Status",        type: "select", options: ["all", "taxfree", "taxable"] },
        ],
      },
      etf: {
        sortFields: ["currentPrice", "marketCap", "symbol"],
        filters: [
          { key: "etfCategory", label: "ETF Category", type: "select", options: ["all", "nifty", "gold", "international", "sectoral"] },
          { key: "q",           label: "Search",       type: "text" },
        ],
      },
    },
    meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
  });
});

// ─── GET /api/screener/instruments/:id ───────────────────────────────────────
/** Unified instrument detail — resolves by scheme code (MF), ISIN (Bond), or symbol (ETF). */
instrumentScreenerRouter.get("/instruments/:id", async (req: Request, res: Response) => {
  const start = Date.now();
  const { id } = req.params;
  const { type = "mutual_fund" } = req.query as { type?: string };

  try {
    if (type === "mutual_fund") {
      const [fund] = await db
        .select()
        .from(mutualFunds)
        .where(or(eq(mutualFunds.schemeCode, id), eq(mutualFunds.id, id)))
        .limit(1);

      if (!fund) return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `MF '${id}' not found`, retryable: false });
      return res.json({ success: true, type: "mutual_fund", data: fund, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.mutual_fund } });
    }

    if (type === "bond") {
      const [govt] = await db.select().from(governmentSecurities).where(eq(governmentSecurities.isin, id)).limit(1);
      if (govt) return res.json({ success: true, type: "bond", bondType: "govt", data: govt, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.bond } });

      const [corp] = await db.select().from(corporateBonds).where(eq(corporateBonds.isin, id)).limit(1);
      if (corp) return res.json({ success: true, type: "bond", bondType: "corporate", data: corp, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.bond } });

      return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `Bond '${id}' not found`, retryable: false });
    }

    if (type === "etf") {
      const [etf] = await db.select().from(listedStocks).where(eq(listedStocks.symbol, id.toUpperCase())).limit(1);
      if (!etf) return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `ETF '${id}' not found`, retryable: false });
      return res.json({ success: true, type: "etf", data: etf, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.etf } });
    }

    return res.status(400).json({ success: false, error_code: "INVALID_TYPE", message: "Valid types: mutual_fund | bond | etf" });

  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify({ event: "INSTRUMENT_DETAIL_ERROR", id, type, message: err.message, latency_ms: Date.now() - start }));
    return res.status(500).json({ success: false, error_code: "INSTRUMENT_DETAIL_ERROR", message: `Failed to fetch ${type} detail`, retryable: true, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION } });
  }
});
