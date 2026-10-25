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
  mutualFundMetrics,
  fundFinancialRatios,
  governmentSecurities,
  corporateBonds,
  listedStocks,
  unlistedCompanies,
  reits,
  invits,
  marketIndices,
  agentBaskets,
} from "@shared/schema";
import { and, eq, gte, lte, ilike, sql, desc, asc, or, getTableColumns } from "drizzle-orm";
import { logger } from "../logger";
import { instrumentAiChatService } from "../services/instrument-ai-chat-service";
import { MACRO_SECTORS, getMacroSectorsWithSubsectors } from "@shared/sector-taxonomy";
import { CURATED_SMALLCASES, CURATED_INDICES } from "../services/screener-curated-data";
import { IRIS_PRODUCT_REGISTRY } from "../services/iris/irisProductRegistry";
import { multiAssetPerformanceService } from "../services/multi-asset-performance-service";
import { multiVendorInstrumentMasterService } from "../services/multi-vendor-instrument-master-service";

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
  unlisted:
    "Unlisted and Pre-IPO securities are illiquid and carry high investment risk including loss of capital. Fair values are indicative based on audited DRHP/financial filings. Not a public offer. Regulatory disclosures apply.",
  reit_invit:
    "REIT & InvIT investments are subject to market and real estate asset yield fluctuations. Past distributions are not guaranteed. Review offer documents before investing.",
  smallcase:
    "Smallcase thematic baskets are model equity portfolios and do not guarantee returns. Equity holdings are subject to market volatility. Rebalance suggestions require investor approval.",
  index:
    "Index levels and performance reflect underlying benchmark components. Index investing involves market risk and tracking errors. Past trends do not ensure future direction.",
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
    minSharpe,
    minAlpha,
    maxBeta,
    minSortino,
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
      if (minReturn1y) conditions.push(gte(sql`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})::numeric`, minReturn1y as any));
      if (minReturn3y) conditions.push(gte(sql`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})::numeric`, minReturn3y as any));
      if (minReturn5y) conditions.push(gte(sql`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})::numeric`, minReturn5y as any));
      if (maxExpenseRatio) conditions.push(lte(sql`COALESCE(${mutualFunds.expenseRatio}, ${mutualFundMetrics.expenseRatio})::numeric`, maxExpenseRatio as any));
      if (minAum) conditions.push(gte(sql`COALESCE(${mutualFunds.aum}, ${mutualFundMetrics.aum})::numeric`, minAum as any));
      if (minRating) conditions.push(lte(mutualFunds.crisilRating, parseInt(minRating, 10)));
      if (minSharpe) conditions.push(gte(sql`COALESCE(${fundFinancialRatios.sharpeRatio}, ${mutualFundMetrics.sharpeRatio})::numeric`, minSharpe as any));
      if (minAlpha) conditions.push(gte(sql`COALESCE(${fundFinancialRatios.alpha}, ${mutualFundMetrics.alpha})::numeric`, minAlpha as any));
      if (maxBeta) conditions.push(lte(sql`COALESCE(${fundFinancialRatios.beta}, ${mutualFundMetrics.beta})::numeric`, maxBeta as any));
      if (minSortino) conditions.push(gte(sql`COALESCE(${fundFinancialRatios.sortinoRatio}, ${mutualFundMetrics.sortinoRatio})::numeric`, minSortino as any));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Sort expression — ALWAYS NULLS LAST so funds with data appear first
      const orderDir = sortOrder === "asc" ? "ASC" : "DESC";
      let mfSortExpr: any;

      if (sortBy === "returns3y") {
        mfSortExpr = sql`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "returns5y") {
        mfSortExpr = sql`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "aum") {
        mfSortExpr = sql`COALESCE(${mutualFunds.aum}, ${mutualFundMetrics.aum})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "nav") {
        mfSortExpr = sql`${mutualFunds.nav}::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "expenseRatio") {
        mfSortExpr = sql`COALESCE(${mutualFunds.expenseRatio}, ${mutualFundMetrics.expenseRatio})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "rating") {
        mfSortExpr = sql`${mutualFunds.crisilRating} ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "alpha") {
        mfSortExpr = sql`COALESCE(${fundFinancialRatios.alpha}, ${mutualFundMetrics.alpha})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "beta") {
        mfSortExpr = sql`COALESCE(${fundFinancialRatios.beta}, ${mutualFundMetrics.beta})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "sharpeRatio" || sortBy === "sharpe") {
        mfSortExpr = sql`COALESCE(${fundFinancialRatios.sharpeRatio}, ${mutualFundMetrics.sharpeRatio})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "sortinoRatio" || sortBy === "sortino") {
        mfSortExpr = sql`COALESCE(${fundFinancialRatios.sortinoRatio}, ${mutualFundMetrics.sortinoRatio})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else if (sortBy === "standardDeviation" || sortBy === "volatility") {
        mfSortExpr = sql`COALESCE(${fundFinancialRatios.standardDeviation}, ${mutualFundMetrics.standardDeviation})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      } else {
        // Default: 1Y returns DESC, NULLS LAST
        mfSortExpr = sql`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})::numeric ${sql.raw(orderDir)} NULLS LAST`;
      }

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
          expenseRatio:  sql<string | null>`COALESCE(${mutualFunds.expenseRatio}, ${mutualFundMetrics.expenseRatio})`,
          aum:           sql<string | null>`COALESCE(${mutualFunds.aum}, ${mutualFundMetrics.aum})`,
          riskLevel:     mutualFunds.riskLevel,
          returns1y:     sql<string | null>`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})`,
          returns3y:     sql<string | null>`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})`,
          returns5y:     sql<string | null>`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})`,
          rating:        mutualFunds.crisilRating,
          ratingPercentile: mutualFunds.crisilPercentile,
          // Ratios available at GCP Cloud SQL
          alpha:             sql<string | null>`COALESCE(${fundFinancialRatios.alpha}, ${mutualFundMetrics.alpha})`,
          beta:              sql<string | null>`COALESCE(${fundFinancialRatios.beta}, ${mutualFundMetrics.beta})`,
          sharpeRatio:       sql<string | null>`COALESCE(${fundFinancialRatios.sharpeRatio}, ${mutualFundMetrics.sharpeRatio})`,
          sortinoRatio:      sql<string | null>`COALESCE(${fundFinancialRatios.sortinoRatio}, ${mutualFundMetrics.sortinoRatio})`,
          standardDeviation: sql<string | null>`COALESCE(${fundFinancialRatios.standardDeviation}, ${mutualFundMetrics.standardDeviation})`,
          treynorRatio:      sql<string | null>`COALESCE(${fundFinancialRatios.treynorRatio}, ${mutualFundMetrics.treynorRatio})`,
          maxDrawdown:       sql<string | null>`COALESCE(${fundFinancialRatios.maxDrawdown}, ${mutualFundMetrics.maxDrawdown})`,
          peRatio:           sql<string | null>`COALESCE(${fundFinancialRatios.peRatio}, ${mutualFundMetrics.portfolioPeRatio})`,
          pbRatio:           sql<string | null>`COALESCE(${fundFinancialRatios.pbRatio}, ${mutualFundMetrics.portfolioPbRatio})`,
          portfolioTurnover: sql<string | null>`COALESCE(${fundFinancialRatios.portfolioTurnover}, ${mutualFundMetrics.portfolioTurnover})`,
          // Transactability fields
          isin:          mutualFunds.isin,
          isinGrowth:    mutualFunds.isinGrowth,
          amfiCode:      mutualFunds.amfiCode,
          planType:      mutualFunds.planType,
        })
          .from(mutualFunds)
          .leftJoin(
            fundFinancialRatios,
            eq(mutualFunds.schemeCode, fundFinancialRatios.schemeCode)
          )
          .leftJoin(
            mutualFundMetrics,
            and(
              eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
              eq(
                mutualFundMetrics.fiscalYear,
                sql`(SELECT fiscal_year FROM mutual_fund_metrics m2 WHERE m2.scheme_code = ${mutualFunds.schemeCode} ORDER BY m2.fiscal_year DESC LIMIT 1)`
              )
            )
          )
          .where(whereClause)
          .orderBy(mfSortExpr)
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(mutualFunds)
          .leftJoin(
            fundFinancialRatios,
            eq(mutualFunds.schemeCode, fundFinancialRatios.schemeCode)
          )
          .leftJoin(
            mutualFundMetrics,
            and(
              eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
              eq(
                mutualFundMetrics.fiscalYear,
                sql`(SELECT fiscal_year FROM mutual_fund_metrics m2 WHERE m2.scheme_code = ${mutualFunds.schemeCode} ORDER BY m2.fiscal_year DESC LIMIT 1)`
              )
            )
          )
          .where(whereClause),
      ]);

      // Build transact block for IRIS MF order placement
      const mfRegistry = IRIS_PRODUCT_REGISTRY.MUTUAL_FUND;
      const sipRegistry = IRIS_PRODUCT_REGISTRY.SIP;
      const fundsWithTransact = funds.map((f) => ({
        ...f,
        transact: {
          // IRIS MF order identifiers
          exchange: "BSE",                              // MF orders via BSE StarMF platform
          isin: f.isinGrowth ?? f.isin ?? null,         // Prefer growth ISIN (regular plan)
          schemeCode: f.schemeCode,                     // AMFI scheme code for IRIS / RTA
          amfiCode: f.amfiCode ?? f.schemeCode,         // AMFI identifier (same as schemeCode for most)
          planType: f.planType ?? "regular",            // FintekPro is a distributor — always regular
          // Execution routing
          executionApi: "iris",
          orderType: "mf_purchase",
          fintekproRoute: mfRegistry.fintekproRoute,
          requiredFields: mfRegistry.requiredFields,
          requiresAdvisorApproval: mfRegistry.requiresAdvisorApproval,
          requiresDisclaimer: mfRegistry.requiresDisclaimer,
          // SIP-specific route for recurring investments
          sipRoute: sipRegistry.fintekproRoute,
          sipRequiredFields: sipRegistry.requiredFields,
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
        const bondRegistry = IRIS_PRODUCT_REGISTRY.BOND;
        bonds = (bonds as any[]).map((b) => ({
          ...b,
          transact: {
            isin: b.isin,
            exchange: b.dataSource?.includes("bse") ? "BSE" : "NSE",
            executionApi: "iris",
            orderType: "bond_purchase",
            fintekproRoute: bondRegistry.fintekproRoute,
            requiredFields: bondRegistry.requiredFields,
            requiresAdvisorApproval: bondRegistry.requiresAdvisorApproval,
            requiresDisclaimer: bondRegistry.requiresDisclaimer,
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
            fintekproRoute: IRIS_PRODUCT_REGISTRY.BOND.fintekproRoute,
            requiredFields: IRIS_PRODUCT_REGISTRY.BOND.requiredFields,
            requiresAdvisorApproval: IRIS_PRODUCT_REGISTRY.BOND.requiresAdvisorApproval,
            requiresDisclaimer: IRIS_PRODUCT_REGISTRY.BOND.requiresDisclaimer,
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
      const etfRegistry = IRIS_PRODUCT_REGISTRY.ETF;
      const etfsWithTransact = etfs.map((e) => {
        const isIndian = !e.country || e.country === "IN";
        return {
          ...e,
          transact: {
            isin: e.isin,
            exchange: e.exchange ?? "NSE",
            nseSymbol: e.symbol,
            bseCode: e.bseCode ?? null,
            nseCode: e.nseCode ?? "EQ",
            currency: e.currency ?? "INR",
            country: e.country ?? "IN",
            executionApi: isIndian ? "iris" : "alpaca",
            orderType: "etf_purchase",
            fintekproRoute: etfRegistry.fintekproRoute,
            requiredFields: etfRegistry.requiredFields,
            requiresAdvisorApproval: etfRegistry.requiresAdvisorApproval,
            requiresDisclaimer: etfRegistry.requiresDisclaimer,
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

    // ══════════════════════════════════════════════════════════════════════════
    // UNLISTED & PRE-IPO SHARES
    // ══════════════════════════════════════════════════════════════════════════
    if (type === "unlisted") {
      const {
        stage,       // 'pre_ipo' | 'growth' | 'mature' | 'all'
        sector: unlistedSector,
        q: unlistedSearch,
      } = req.query as Record<string, string | undefined>;

      const unlistedConditions = [
        eq(unlistedCompanies.status, "active"),
      ];

      if (stage && stage !== "all") {
        unlistedConditions.push(eq(unlistedCompanies.listingStage, stage));
      }
      if (unlistedSector && unlistedSector !== "all") {
        unlistedConditions.push(ilike(unlistedCompanies.sector, `%${unlistedSector}%`));
      }
      if (unlistedSearch) {
        unlistedConditions.push(or(
          ilike(unlistedCompanies.name, `%${unlistedSearch}%`),
          ilike(unlistedCompanies.sector, `%${unlistedSearch}%`),
          ilike(unlistedCompanies.cin, `%${unlistedSearch}%`)
        )!);
      }

      const sortCol =
        sortBy === "publishedBuyPrice" ? unlistedCompanies.publishedBuyPrice :
        sortBy === "paidUpCapital"     ? unlistedCompanies.paidUpCapital :
        unlistedCompanies.name;

      const [companies, totalCount] = await Promise.all([
        db.select({
          id: unlistedCompanies.id,
          name: unlistedCompanies.name,
          cin: unlistedCompanies.cin,
          isin: unlistedCompanies.isin,
          sector: unlistedCompanies.sector,
          industry: unlistedCompanies.industry,
          listingStage: unlistedCompanies.listingStage,
          publishedBuyPrice: unlistedCompanies.publishedBuyPrice,
          publishedSellPrice: unlistedCompanies.publishedSellPrice,
          paidUpCapital: unlistedCompanies.paidUpCapital,
          authorizedCapital: unlistedCompanies.authorizedCapital,
          faceValue: unlistedCompanies.faceValue,
          complianceStatus: unlistedCompanies.complianceStatus,
          riskCategory: unlistedCompanies.riskCategory,
          valuationStatus: unlistedCompanies.valuationStatus,
          lastValuationDate: unlistedCompanies.lastValuationDate,
          website: unlistedCompanies.website,
        })
          .from(unlistedCompanies)
          .where(and(...unlistedConditions))
          .orderBy(sortOrder === "asc" ? asc(sortCol) : desc(sortCol))
          .limit(limitNum)
          .offset(offset),
        db.select({ count: sql<number>`COUNT(*)` })
          .from(unlistedCompanies)
          .where(and(...unlistedConditions)),
      ]);

      return res.json({
        success: true,
        type: "unlisted",
        data: companies,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total: Number(totalCount[0]?.count ?? 0),
          disclaimer: DISCLAIMERS.unlisted,
        },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REITs & InvITs
    // ══════════════════════════════════════════════════════════════════════════
    if (type === "reit_invit") {
      const {
        category: trustCategory = "all", // "all" | "reit" | "invit"
        minYield,
        q: trustSearch,
      } = req.query as Record<string, string | undefined>;

      const items: any[] = [];

      if (trustCategory === "all" || trustCategory === "reit") {
        const reitConditions = [];
        if (minYield) reitConditions.push(gte(reits.distributionYield, sql`${minYield}::numeric`));
        if (trustSearch) {
          reitConditions.push(or(
            ilike(reits.name, `%${trustSearch}%`),
            ilike(reits.symbol, `%${trustSearch}%`),
            ilike(reits.sector, `%${trustSearch}%`)
          )!);
        }

        const reitList = await db.select({
          id: reits.id,
          symbol: reits.symbol,
          name: reits.name,
          sponsor: reits.sponsor,
          sector: reits.sector,
          propertyType: reits.propertyType,
          exchange: reits.exchange,
          currentPrice: reits.currentPrice,
          nav: reits.nav,
          premiumToNav: reits.premiumToNav,
          marketCap: reits.marketCap,
          distributionYield: reits.distributionYield,
          lastDividend: reits.lastDividend,
          returns1Y: reits.returns1Y,
          occupancyRate: reits.occupancyRate,
          debtToEquity: reits.debtToEquity,
          riskLevel: reits.riskLevel,
          aiSignal: reits.aiSignal,
          aiConfidence: reits.aiConfidence,
          amfiCapCategory: reits.amfiCapCategory,
        })
        .from(reits)
        .where(reitConditions.length > 0 ? and(...reitConditions) : undefined);

        items.push(...reitList.map(r => ({ ...r, trustType: "REIT" })));
      }

      if (trustCategory === "all" || trustCategory === "invit") {
        const invitConditions = [];
        if (minYield) invitConditions.push(gte(invits.distributionYield, sql`${minYield}::numeric`));
        if (trustSearch) {
          invitConditions.push(or(
            ilike(invits.name, `%${trustSearch}%`),
            ilike(invits.symbol, `%${trustSearch}%`),
            ilike(invits.sector, `%${trustSearch}%`)
          )!);
        }

        const invitList = await db.select({
          id: invits.id,
          symbol: invits.symbol,
          name: invits.name,
          sponsor: invits.sponsor,
          sector: invits.sector,
          infrastructureType: invits.infrastructureType,
          exchange: invits.exchange,
          currentPrice: invits.currentPrice,
          nav: invits.nav,
          premiumToNav: invits.premiumToNav,
          marketCap: invits.marketCap,
          distributionYield: invits.distributionYield,
          lastDividend: invits.lastDividend,
          returns1Y: invits.returns1Y,
          debtToEquity: invits.debtToEquity,
          riskLevel: invits.riskLevel,
          aiSignal: invits.aiSignal,
          aiConfidence: invits.aiConfidence,
        })
        .from(invits)
        .where(invitConditions.length > 0 ? and(...invitConditions) : undefined);

        items.push(...invitList.map(i => ({ ...i, trustType: "InvIT" })));
      }

      // Sort
      if (sortBy === "distributionYield") {
        items.sort((a, b) => sortOrder === "asc"
          ? (Number(a.distributionYield) || 0) - (Number(b.distributionYield) || 0)
          : (Number(b.distributionYield) || 0) - (Number(a.distributionYield) || 0)
        );
      } else if (sortBy === "currentPrice") {
        items.sort((a, b) => sortOrder === "asc"
          ? (Number(a.currentPrice) || 0) - (Number(b.currentPrice) || 0)
          : (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0)
        );
      } else {
        items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      }

      const total = items.length;
      const paginatedData = items.slice(offset, offset + limitNum);

      return res.json({
        success: true,
        type: "reit_invit",
        data: paginatedData,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total,
          disclaimer: DISCLAIMERS.reit_invit,
        },
      });
    }

    // ── Smallcase Thematic Baskets ───────────────────────────────────────────
    if (type === "smallcase") {
      let items = [...CURATED_SMALLCASES];

      const { theme, riskLevel, minCagr, macroSector } = req.query as Record<string, string>;

      if (theme && theme !== "all") {
        items = items.filter((s) => s.theme.toLowerCase().includes(theme.toLowerCase()));
      }
      if (macroSector && macroSector !== "all") {
        items = items.filter((s) => s.macroSector.toLowerCase().includes(macroSector.toLowerCase()));
      }
      if (riskLevel && riskLevel !== "all") {
        items = items.filter((s) => s.riskLevel.toLowerCase() === riskLevel.toLowerCase());
      }
      if (minCagr) {
        const minCagrVal = Number(minCagr) || 0;
        items = items.filter((s) => s.cagr3y >= minCagrVal);
      }
      if (q) {
        const query = q.toLowerCase();
        items = items.filter(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.theme.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            s.topHoldings.some((h) => h.symbol.toLowerCase().includes(query) || h.name.toLowerCase().includes(query))
        );
      }

      // Sort
      if (sortBy === "cagr3y") {
        items.sort((a, b) => sortOrder === "asc" ? a.cagr3y - b.cagr3y : b.cagr3y - a.cagr3y);
      } else if (sortBy === "returns1y") {
        items.sort((a, b) => sortOrder === "asc" ? a.returns1y - b.returns1y : b.returns1y - a.returns1y);
      } else if (sortBy === "minInvestment") {
        items.sort((a, b) => sortOrder === "asc" ? a.minInvestment - b.minInvestment : b.minInvestment - a.minInvestment);
      } else {
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      const total = items.length;
      const paginatedData = items.slice(offset, offset + limitNum);

      return res.json({
        success: true,
        type: "smallcase",
        data: paginatedData,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total,
          disclaimer: DISCLAIMERS.smallcase,
        },
      });
    }

    // ── Market & Sectoral Indices ────────────────────────────────────────────
    if (type === "index") {
      let items = [...CURATED_INDICES];

      const { category, provider } = req.query as Record<string, string>;

      if (category && category !== "all") {
        items = items.filter((i) => i.category.toLowerCase() === category.toLowerCase());
      }
      if (provider && provider !== "all") {
        items = items.filter((i) => i.provider.toLowerCase() === provider.toLowerCase());
      }
      if (q) {
        const query = q.toLowerCase();
        items = items.filter(
          (i) =>
            i.name.toLowerCase().includes(query) ||
            i.indexCode.toLowerCase().includes(query) ||
            i.description.toLowerCase().includes(query)
        );
      }

      // Sort
      if (sortBy === "returns1y") {
        items.sort((a, b) => sortOrder === "asc" ? a.returns1y - b.returns1y : b.returns1y - a.returns1y);
      } else if (sortBy === "returns3y") {
        items.sort((a, b) => sortOrder === "asc" ? a.returns3y - b.returns3y : b.returns3y - a.returns3y);
      } else if (sortBy === "changePercent") {
        items.sort((a, b) => sortOrder === "asc" ? a.changePercent - b.changePercent : b.changePercent - a.changePercent);
      } else if (sortBy === "currentLevel") {
        items.sort((a, b) => sortOrder === "asc" ? a.currentLevel - b.currentLevel : b.currentLevel - a.currentLevel);
      } else {
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      const total = items.length;
      const paginatedData = items.slice(offset, offset + limitNum);

      return res.json({
        success: true,
        type: "index",
        data: paginatedData,
        meta: {
          timestamp: new Date().toISOString(),
          engine_version: ENGINE_VERSION,
          page: pageNum,
          limit: limitNum,
          total,
          disclaimer: DISCLAIMERS.index,
        },
      });
    }

    // ── Unknown type ──────────────────────────────────────────────────────────
    return res.status(400).json({
      success: false,
      error_code: "INVALID_INSTRUMENT_TYPE",
      message: `Invalid type '${type}'. Valid: mutual_fund | bond | etf | stock | unlisted | reit_invit | smallcase | index`,
      retryable: false,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });

  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.detail ?? "";
    logger.error("Screener instrument error", {
      event: "SCREENER_INSTRUMENT_ERROR",
      user_id: (req as any).user?.id ?? null,
      latency_ms: Date.now() - start,
      status: "error",
      message: err.message,
      cause,
      instrument_type: type,
    });
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
        sortFields: ["returns1y", "returns3y", "returns5y", "aum", "nav", "expenseRatio", "rating", "alpha", "beta", "sharpeRatio", "sortinoRatio", "standardDeviation", "peRatio"],
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
          { key: "minSharpe",        label: "Min Sharpe Ratio",  type: "number" },
          { key: "minAlpha",         label: "Min Alpha",         type: "number" },
          { key: "maxBeta",          label: "Max Beta",          type: "number" },
          { key: "minSortino",       label: "Min Sortino Ratio", type: "number" },
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
      unlisted: {
        sortFields: ["publishedBuyPrice", "paidUpCapital", "name"],
        filters: [
          { key: "stage",  label: "Stage",  type: "select", options: ["all", "pre_ipo", "growth", "mature"] },
          { key: "sector", label: "Sector", type: "text" },
          { key: "q",      label: "Search", type: "text" },
        ],
      },
      reit_invit: {
        sortFields: ["distributionYield", "currentPrice", "name"],
        filters: [
          { key: "category", label: "Trust Type", type: "select", options: ["all", "reit", "invit"] },
          { key: "minYield", label: "Min Distribution Yield (%)", type: "number" },
          { key: "q",        label: "Search", type: "text" },
        ],
      },
      stock: {
        macroSectors: [...MACRO_SECTORS],
        taxonomy: getMacroSectorsWithSubsectors(),
      },
      smallcase: {
        sortFields: ["cagr3y", "returns1y", "minInvestment", "name"],
        filters: [
          { key: "theme", label: "Theme", type: "select", options: ["all", "Asset Allocation", "Market Leaders", "Information Technology", "Green Transition", "Healthcare & Life Sciences", "Credit Growth & Financialization", "National Infrastructure", "Consumer Staples", "Cash Flow & Yield", "Rural Consumption"] },
          { key: "riskLevel", label: "Risk Level", type: "select", options: ["all", "Low", "Moderate", "High"] },
          { key: "q", label: "Search", type: "text" },
        ],
      },
      index: {
        sortFields: ["returns1y", "returns3y", "changePercent", "currentLevel", "name"],
        filters: [
          { key: "category", label: "Category", type: "select", options: ["all", "Broad Market", "Sectoral"] },
          { key: "provider", label: "Provider", type: "select", options: ["all", "NSE", "BSE"] },
          { key: "q", label: "Search", type: "text" },
        ],
      },
    },
    meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
  });
});

// ─── GET /api/screener/instruments/:id ───────────────────────────────────────
/** Unified instrument detail — resolves by scheme code (MF), ISIN (Bond), symbol (ETF/REIT), or id (Unlisted). */
instrumentScreenerRouter.get("/instruments/:id", async (req: Request, res: Response) => {
  const start = Date.now();
  const { id } = req.params;
  const { type = "mutual_fund" } = req.query as { type?: string };

  try {
    if (type === "mutual_fund") {
      const [fund] = await db
        .select({
          ...getTableColumns(mutualFunds),
          returns1y:         sql<string | null>`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})`,
          returns3y:         sql<string | null>`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})`,
          returns5y:         sql<string | null>`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})`,
          expenseRatio:      sql<string | null>`COALESCE(${mutualFunds.expenseRatio}, ${mutualFundMetrics.expenseRatio})`,
          aum:               sql<string | null>`COALESCE(${mutualFunds.aum}, ${mutualFundMetrics.aum})`,
          alpha:             sql<string | null>`COALESCE(${fundFinancialRatios.alpha}, ${mutualFundMetrics.alpha})`,
          beta:              sql<string | null>`COALESCE(${fundFinancialRatios.beta}, ${mutualFundMetrics.beta})`,
          sharpeRatio:       sql<string | null>`COALESCE(${fundFinancialRatios.sharpeRatio}, ${mutualFundMetrics.sharpeRatio})`,
          sortinoRatio:      sql<string | null>`COALESCE(${fundFinancialRatios.sortinoRatio}, ${mutualFundMetrics.sortinoRatio})`,
          standardDeviation: sql<string | null>`COALESCE(${fundFinancialRatios.standardDeviation}, ${mutualFundMetrics.standardDeviation})`,
          treynorRatio:      sql<string | null>`COALESCE(${fundFinancialRatios.treynorRatio}, ${mutualFundMetrics.treynorRatio})`,
          maxDrawdown:       sql<string | null>`COALESCE(${fundFinancialRatios.maxDrawdown}, ${mutualFundMetrics.maxDrawdown})`,
          peRatio:           sql<string | null>`COALESCE(${fundFinancialRatios.peRatio}, ${mutualFundMetrics.portfolioPeRatio})`,
          pbRatio:           sql<string | null>`COALESCE(${fundFinancialRatios.pbRatio}, ${mutualFundMetrics.portfolioPbRatio})`,
          portfolioTurnover: sql<string | null>`COALESCE(${fundFinancialRatios.portfolioTurnover}, ${mutualFundMetrics.portfolioTurnover})`,
        })
        .from(mutualFunds)
        .leftJoin(
          fundFinancialRatios,
          eq(mutualFunds.schemeCode, fundFinancialRatios.schemeCode)
        )
        .leftJoin(
          mutualFundMetrics,
          and(
            eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
            eq(
              mutualFundMetrics.fiscalYear,
              sql`(SELECT fiscal_year FROM mutual_fund_metrics m2 WHERE m2.scheme_code = ${mutualFunds.schemeCode} ORDER BY m2.fiscal_year DESC LIMIT 1)`
            )
          )
        )
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

    if (type === "unlisted") {
      const [comp] = await db
        .select()
        .from(unlistedCompanies)
        .where(or(eq(unlistedCompanies.id, id), eq(unlistedCompanies.cin, id)))
        .limit(1);

      if (!comp) return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `Unlisted company '${id}' not found`, retryable: false });
      return res.json({ success: true, type: "unlisted", data: comp, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.unlisted } });
    }

    if (type === "reit_invit") {
      const [reit] = await db.select().from(reits).where(or(eq(reits.id, id), eq(reits.symbol, id.toUpperCase()))).limit(1);
      if (reit) return res.json({ success: true, type: "reit_invit", trustType: "REIT", data: reit, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.reit_invit } });

      const [invit] = await db.select().from(invits).where(or(eq(invits.id, id), eq(invits.symbol, id.toUpperCase()))).limit(1);
      if (invit) return res.json({ success: true, type: "reit_invit", trustType: "InvIT", data: invit, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.reit_invit } });

      return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `REIT/InvIT '${id}' not found`, retryable: false });
    }

    if (type === "smallcase") {
      const basket = CURATED_SMALLCASES.find((b) => b.id === id || b.name.toLowerCase() === id.toLowerCase());
      if (!basket) return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `Smallcase '${id}' not found`, retryable: false });
      return res.json({ success: true, type: "smallcase", data: basket, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.smallcase } });
    }

    if (type === "index") {
      const idx = CURATED_INDICES.find((i) => i.indexCode.toUpperCase() === id.toUpperCase() || i.name.toLowerCase() === id.toLowerCase());
      if (!idx) return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: `Index '${id}' not found`, retryable: false });
      return res.json({ success: true, type: "index", data: idx, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION, disclaimer: DISCLAIMERS.index } });
    }

    return res.status(400).json({ success: false, error_code: "INVALID_TYPE", message: "Valid types: mutual_fund | bond | etf | unlisted | reit_invit | smallcase | index" });

  } catch (err: any) {
    logger.error("Instrument detail error", { event: "INSTRUMENT_DETAIL_ERROR", id, type, message: err.message, latency_ms: Date.now() - start });
    return res.status(500).json({ success: false, error_code: "INSTRUMENT_DETAIL_ERROR", message: `Failed to fetch ${type} detail`, retryable: true, meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION } });
  }
});

/**
 * POST /api/screener/instruments/chat
 * FASP-AI Universal Contextual Advisory Copilot across all instrument asset classes
 */
instrumentScreenerRouter.post("/instruments/chat", async (req: Request, res: Response) => {
  const start = Date.now();
  const {
    instrumentType = "stock",
    symbolOrId,
    name,
    context = {},
    message,
    history = [],
    userSegment = "retail",
  } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      success: false,
      error_code: "INVALID_MESSAGE",
      message: "Chat message content is required",
      retryable: false,
    });
  }

  if (!symbolOrId) {
    return res.status(400).json({
      success: false,
      error_code: "INVALID_INSTRUMENT",
      message: "Instrument symbolOrId is required",
      retryable: false,
    });
  }

  try {
    const result = await instrumentAiChatService.processChat({
      instrumentType,
      symbolOrId,
      name: name || symbolOrId,
      context,
      message,
      history,
      userSegment,
    });

    return res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
      },
    });
  } catch (err: any) {
    logger.error("Instrument chat error", {
      event: "INSTRUMENT_CHAT_ERROR",
      message: err.message,
      instrumentType,
      symbolOrId,
      latency_ms: Date.now() - start,
    });

    return res.status(500).json({
      success: false,
      error_code: "INSTRUMENT_CHAT_ERROR",
      message: "Failed to generate instrument analysis",
      retryable: true,
    });
  }
});

/**
 * POST /api/screener/performance/chart
 * Returns aligned normalized (base-100) or raw time-series across multi-asset instruments
 * (Stocks, Mutual Funds, Indices, Smallcases, ETFs).
 */
instrumentScreenerRouter.post("/instruments/performance/chart", async (req: Request, res: Response) => {
  const start = Date.now();
  const { instruments, period = "1Y", startDate, endDate, rebaseTo100 = true } = req.body;

  if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
    return res.status(400).json({
      success: false,
      error_code: "INVALID_INSTRUMENTS",
      message: "Must provide a non-empty array of instruments: [{ symbol, type, name? }]",
    });
  }

  try {
    const result = await multiAssetPerformanceService.getComparativeChart({
      instruments,
      period,
      startDate,
      endDate,
      rebaseTo100,
    });

    return res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
      },
    });
  } catch (err: any) {
    logger.error("Performance chart error", {
      event: "PERFORMANCE_CHART_ERROR",
      message: err.message,
      latency_ms: Date.now() - start,
    });

    return res.status(500).json({
      success: false,
      error_code: "PERFORMANCE_CHART_ERROR",
      message: err.message || "Failed to generate performance chart series",
      retryable: true,
    });
  }
});

/**
 * POST /api/screener/performance/backtest
 * Simulates portfolio performance with Lump-Sum or SIP, periodic rebalancing,
 * and quant metrics (CAGR, Sharpe, Sortino, Max Drawdown, Beta, Alpha vs Benchmark).
 */
instrumentScreenerRouter.post("/instruments/performance/backtest", async (req: Request, res: Response) => {
  const start = Date.now();
  const {
    strategyName = "Custom Multi-Asset Strategy",
    mode = "lumpsum",
    initialAmount = 100000,
    monthlySipAmount = 10000,
    startDate,
    endDate,
    rebalanceFrequency = "quarterly",
    benchmarkCode = "NIFTY50",
    constituents,
  } = req.body;

  if (!constituents || !Array.isArray(constituents) || constituents.length === 0) {
    return res.status(400).json({
      success: false,
      error_code: "INVALID_CONSTITUENTS",
      message: "Must provide non-empty constituents array: [{ symbol, type, weight }]",
    });
  }

  try {
    const result = await multiAssetPerformanceService.runBacktest({
      strategyName,
      mode,
      initialAmount: Number(initialAmount) || 100000,
      monthlySipAmount: Number(monthlySipAmount) || 10000,
      startDate,
      endDate,
      rebalanceFrequency,
      benchmarkCode,
      constituents,
      userId: (req as any).user?.id,
    });

    return res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
      },
    });
  } catch (err: any) {
    logger.error("Strategy backtest error", {
      event: "STRATEGY_BACKTEST_ERROR",
      message: err.message,
      latency_ms: Date.now() - start,
    });

    return res.status(500).json({
      success: false,
      error_code: "STRATEGY_BACKTEST_ERROR",
      message: err.message || "Failed to run strategy backtest",
      retryable: true,
    });
  }
});

/**
 * GET /api/screener/performance/backtest/history
 * Retrieves saved backtest runs
 */
instrumentScreenerRouter.get("/instruments/performance/backtest/history", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const history = await multiAssetPerformanceService.getBacktestHistory((req as any).user?.id);
    return res.json({
      success: true,
      data: history,
      meta: {
        timestamp: new Date().toISOString(),
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "BACKTEST_HISTORY_ERROR",
      message: err.message || "Failed to retrieve backtest history",
    });
  }
});

/**
 * GET /api/screener/instruments/vendors/directory
 * Directory of supported financial vendors, capabilities, and execution matrices.
 */
instrumentScreenerRouter.get("/instruments/vendors/directory", async (req: Request, res: Response) => {
  const start = Date.now();
  const assetClasses = ["stock", "mutual_fund", "bond", "smallcase", "us_stock", "fd", "nps"];
  const matrix = assetClasses.map(ac => multiVendorInstrumentMasterService.getVendorsForAssetClass(ac));

  return res.json({
    success: true,
    data: {
      vendors: [
        { id: "IRIS", name: "IRIS (KFintech)", type: "RTA_AND_LENDING", description: "Mutual Funds, Corporate FDs, NPS, Bonds, and TPIN-based folio LAS" },
        { id: "UPSTOX", name: "Upstox Pro", type: "BROKER_EXCHANGE", description: "NSE/BSE Listed Equities, Derivatives, Real-time Market Feeds, and DMA Execution" },
        { id: "SMALLCASE", name: "Smallcase Gateway", type: "BASKET_AND_LENDING", description: "Thematic Equity Baskets, Model Portfolios, and Demat Equity LAS" },
        { id: "ALPACA", name: "Alpaca Securities", type: "US_BROKER", description: "US Equities, Dollar-denominated assets, and Fractional Share Trading" },
        { id: "AMFI", name: "AMFI / MFAPI", type: "NAV_AGGREGATOR", description: "Official Mutual Fund NAVs and Scheme Taxonomy" },
        { id: "BSE_STAR_MF", name: "BSE StAR MF", type: "EXCHANGE_MF_GATEWAY", description: "Exchange-traded Mutual Fund Order Routing Gateway" },
      ],
      assetClassMatrix: matrix,
    },
    meta: {
      timestamp: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      latency_ms: Date.now() - start,
    },
  });
});

/**
 * GET /api/screener/instruments/:identifier/vendors
 * Multi-vendor profile, routing, capabilities, and collateral lending for a specific instrument.
 */
instrumentScreenerRouter.get("/instruments/:identifier/vendors", async (req: Request, res: Response) => {
  const start = Date.now();
  const { identifier } = req.params;
  const isin = identifier.length >= 12 && /^[A-Z]{2}[A-Z0-9]{10}$/.test(identifier.toUpperCase()) ? identifier.toUpperCase() : undefined;
  const amfiCode = /^\d{5,7}$/.test(identifier) ? Number(identifier) : undefined;
  const symbol = !isin && !amfiCode ? identifier.toUpperCase() : undefined;

  const profile = await multiVendorInstrumentMasterService.resolveInstrument({
    isin,
    symbol,
    amfiCode,
    instrumentType: req.query.type as string | undefined,
  });

  if (!profile) {
    return res.status(404).json({
      success: false,
      error_code: "INSTRUMENT_NOT_FOUND",
      message: `Instrument '${identifier}' not found in multi-vendor registry`,
    });
  }

  return res.json({
    success: true,
    data: profile,
    meta: {
      timestamp: new Date().toISOString(),
      engine_version: ENGINE_VERSION,
      latency_ms: Date.now() - start,
    },
  });
});



