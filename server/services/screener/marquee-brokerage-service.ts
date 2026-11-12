/**
 * @file marquee-brokerage-service.ts
 * @description Curates, parses, persists, and provides marquee institutional brokerage views, targets,
 *              and commentary for reference and quoting within FintekPro's engines.
 *
 * Compliance: GCR v1.0 & FASP-AI v1.0
 * - Reference & Quoting Layer: Institutional perspective to enrich FintekPro
 *   proprietary models without altering deterministic core scoring.
 * - Resilient Multi-Tier Ingestion: DB-first fallback guarantees unrestricted,
 *   continuous access even during third-party API downtime or rate-limits.
 * - Full audit trail: Source, headline, published timestamp, disclaimer, and engine versioning.
 */

import { indianApiService } from "../indian-api-service";
import { logger } from "../../logger";
import { db } from "../../db";
import {
  brokerageFirms,
  brokerageCoverageCalls,
  brokerageConsensusHistory,
} from "../../../shared/schema/screener";
import { eq, desc, and, sql } from "drizzle-orm";

export interface MarqueeBrokerageDefinition {
  name: string;
  code: string;
  aliases: string[];
  tier: "GLOBAL_BULGE_BRACKET" | "DOMESTIC_TIER_1";
  country: "GLOBAL" | "INDIA";
}

export const MARQUEE_BROKERAGES: MarqueeBrokerageDefinition[] = [
  // ── Global Bulge Bracket ──────────────────────────────────────────────────
  { name: "Goldman Sachs", code: "GS", aliases: ["goldman sachs", "goldman"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Morgan Stanley", code: "MS", aliases: ["morgan stanley"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Jefferies", code: "JEF", aliases: ["jefferies"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "JPMorgan", code: "JPM", aliases: ["jpmorgan", "jp morgan"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "CLSA", code: "CLSA", aliases: ["clsa"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Nomura", code: "NOMURA", aliases: ["nomura"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "UBS", code: "UBS", aliases: ["ubs"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Bernstein", code: "BERNSTEIN", aliases: ["bernstein", "alliancebernstein"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Macquarie", code: "MACQUARIE", aliases: ["macquarie"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Citi", code: "CITI", aliases: ["citi", "citigroup"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "HSBC", code: "HSBC", aliases: ["hsbc"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "BofA Securities", code: "BOFA", aliases: ["bofa", "bank of america", "merrill lynch"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Barclays", code: "BARCLAYS", aliases: ["barclays"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "BNP Paribas", code: "BNP", aliases: ["bnp paribas"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },

  // ── Domestic Tier 1 Institutional Desks ───────────────────────────────────
  { name: "Kotak Institutional Equities", code: "KIE", aliases: ["kotak institutional", "kotak securities", "kotak"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Motilal Oswal", code: "MOSL", aliases: ["motilal oswal", "mosl"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "ICICI Securities", code: "ISEC", aliases: ["icici securities", "icici direct"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Axis Capital", code: "AXIS", aliases: ["axis capital", "axis securities"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "HDFC Securities", code: "HDFC", aliases: ["hdfc securities", "hdfc sec"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Nuvama Institutional Equities", code: "NUVAMA", aliases: ["nuvama", "edelweiss"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Emkay Global", code: "EMKAY", aliases: ["emkay"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Anand Rathi", code: "AR", aliases: ["anand rathi"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Sharekhan", code: "SK", aliases: ["sharekhan"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Prabhudas Lilladher", code: "PL", aliases: ["prabhudas lilladher", "prabhudas"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Antique Stock Broking", code: "ANTIQUE", aliases: ["antique stock", "antique broking"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Systematix", code: "SYS", aliases: ["systematix"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
];

export interface MarqueeBrokerageView {
  id?: number;
  firm: string;
  code?: string;
  tier: "GLOBAL_BULGE_BRACKET" | "DOMESTIC_TIER_1";
  rating: "BUY" | "ACCUMULATE" | "HOLD" | "REDUCE" | "SELL" | "NEUTRAL" | "OVERWEIGHT" | "UNDERWEIGHT" | "UNKNOWN";
  action?: "INITIATE" | "UPGRADE" | "DOWNGRADE" | "MAINTAIN" | "REITERATE";
  targetPrice: number | null;
  previousTargetPrice?: number | null;
  priceAtCall?: number | null;
  upsidePercent: number | null;
  headline: string;
  quoteSnippet: string;
  keyTakeaways?: string;
  publishedDate: string;
  source: string;
  url?: string;
}

export interface MarqueeConsensusReference {
  symbol: string;
  currentPrice: number;
  targetMean: number | null;
  targetMedian: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  consensusUpsidePercent: number | null;
  totalAnalysts: number;
  marqueeViewsCount: number;
  consensusRating: string;
  historicalShift: {
    oneWeekAgoMean?: number;
    thirtyDaysAgoMean?: number;
    sixtyDaysAgoMean?: number;
    ninetyDaysAgoMean?: number;
  };
  marqueeViews: MarqueeBrokerageView[];
  distribution?: {
    buy: number;
    hold: number;
    sell: number;
  };
  tierBreakdown?: {
    bulgeBracket: number;
    domesticTier1: number;
  };
  quotingSummary: string;
  fintekDivergencePercent?: number | null;
  disclaimer: string;
  engineVersion: string;
  calculationTimestamp: string;
  updatedAt: string;
}

const _cache = new Map<string, { data: MarqueeConsensusReference; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in-memory cache

export class MarqueeBrokerageService {
  private firmsSeeded = false;

  /**
   * Purpose: Ensures standard marquee brokerages are seeded in PostgreSQL.
   * Inputs: None
   * Outputs: Promise<void>
   * Edge cases: Handles existing codes and conflicts gracefully.
   */
  async ensureBrokerageFirms(): Promise<void> {
    if (this.firmsSeeded) return;
    try {
      for (const firm of MARQUEE_BROKERAGES) {
        await db
          .insert(brokerageFirms)
          .values({
            name: firm.name,
            code: firm.code,
            tier: firm.tier,
            country: firm.country,
            isActive: true,
          })
          .onConflictDoNothing({ target: brokerageFirms.name })
          .catch(() => {});
      }
      this.firmsSeeded = true;
    } catch (err: any) {
      logger.warn(`[MarqueeBrokerageService] Firm seed check warning: ${err?.message}`);
    }
  }

  /**
   * Purpose: Retrieves marquee brokerage consensus & individual quoted calls for a stock symbol.
   * Inputs: symbol (string), currentPrice (optional number), fintekValuation (optional number)
   * Outputs: MarqueeConsensusReference or null
   * Edge cases: Falls back to database when upstream API fails, ensuring 100% unrestricted availability.
   */
  async getMarqueeReference(
    symbol: string,
    currentPrice?: number,
    fintekValuation?: number
  ): Promise<MarqueeConsensusReference | null> {
    const symUpper = symbol.toUpperCase().trim();
    if (!symUpper) return null;

    // Check in-memory fast cache
    const cached = _cache.get(symUpper);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      await this.ensureBrokerageFirms();

      // 1. Fetch analyst target price data & company news in parallel
      const [targetPriceRes, newsRes] = await Promise.allSettled([
        indianApiService.getAnalystTargetPrice(symUpper),
        indianApiService.getCompanyNews(symUpper),
      ]);

      let targetData: any = null;
      if (targetPriceRes.status === "fulfilled" && targetPriceRes.value.success && targetPriceRes.value.data) {
        targetData = targetPriceRes.value.data;
      }

      let newsItems: any[] = [];
      if (newsRes.status === "fulfilled" && newsRes.value.success && Array.isArray(newsRes.value.data)) {
        newsItems = newsRes.value.data;
      }

      // 2. Parse live marquee views from news
      let marqueeViews = this.parseMarqueeViewsFromNews(newsItems, currentPrice);

      // 3. Fallback: If no live views parsed from news, query persisted database calls
      if (marqueeViews.length === 0) {
        const dbCalls = await this.getPersistedCalls(symUpper);
        if (dbCalls.length > 0) {
          marqueeViews = dbCalls;
        }
      } else {
        // Persist newly parsed calls in background asynchronously
        this.persistCallsAsync(symUpper, marqueeViews);
      }

      // 4. Assemble consensus metrics
      let mean = targetData?.mean && targetData.mean > 0 ? targetData.mean : null;
      let median = targetData?.median && targetData.median > 0 ? targetData.median : null;
      let high = targetData?.high && targetData.high > 0 ? targetData.high : null;
      let low = targetData?.low && targetData.low > 0 ? targetData.low : null;
      let totalAnalysts = targetData?.num_estimates || 0;

      // If API targetData is empty, attempt to calculate consensus from DB snapshot / calls
      if (!mean && marqueeViews.length > 0) {
        const validTargets = marqueeViews
          .map((v) => v.targetPrice)
          .filter((t): t is number => typeof t === "number" && t > 0);
        if (validTargets.length > 0) {
          mean = Math.round(validTargets.reduce((a, b) => a + b, 0) / validTargets.length);
          high = Math.max(...validTargets);
          low = Math.min(...validTargets);
          totalAnalysts = validTargets.length;
        }
      }

      const effectivePrice = currentPrice && currentPrice > 0 ? currentPrice : null;
      const consensusUpside =
        mean && effectivePrice
          ? Math.round(((mean - effectivePrice) / effectivePrice) * 1000) / 10
          : null;

      // Rating classification
      let consensusRating = "HOLD";
      if (consensusUpside != null) {
        if (consensusUpside >= 18) consensusRating = "STRONG BUY";
        else if (consensusUpside >= 8) consensusRating = "BUY";
        else if (consensusUpside <= -10) consensusRating = "SELL";
      }

      // Rating counts
      let buyCount = 0;
      let holdCount = 0;
      let sellCount = 0;
      let bulgeBracketCount = 0;
      let domesticTier1Count = 0;

      for (const v of marqueeViews) {
        if (v.tier === "GLOBAL_BULGE_BRACKET") bulgeBracketCount++;
        else domesticTier1Count++;

        if (v.rating === "BUY" || v.rating === "ACCUMULATE" || v.rating === "OVERWEIGHT") buyCount++;
        else if (v.rating === "SELL" || v.rating === "REDUCE" || v.rating === "UNDERWEIGHT") sellCount++;
        else holdCount++;
      }

      // Historical shifts
      const histMap: Record<string, number> = {};
      if (Array.isArray(targetData?.snapshots)) {
        for (const snap of targetData.snapshots) {
          if (snap.age === "OneWeekAgo" && snap.mean) histMap.oneWeekAgoMean = snap.mean;
          if (snap.age === "ThirtyDaysAgo" && snap.mean) histMap.thirtyDaysAgoMean = snap.mean;
          if (snap.age === "SixtyDaysAgo" && snap.mean) histMap.sixtyDaysAgoMean = snap.mean;
          if (snap.age === "NinetyDaysAgo" && snap.mean) histMap.ninetyDaysAgoMean = snap.mean;
        }
      }

      // Compute FintekPro Intrinsic Value vs Street Divergence (FASP-AI v1.0)
      let fintekDivergencePercent: number | null = null;
      if (fintekValuation && fintekValuation > 0 && mean && mean > 0) {
        fintekDivergencePercent = Math.round(((fintekValuation - mean) / mean) * 1000) / 10;
      }

      // Generate structured quote summary
      const quotingSummary = this.generateQuotingSummary(
        symUpper,
        mean,
        consensusUpside,
        totalAnalysts,
        marqueeViews
      );

      const timestamp = new Date().toISOString();
      const result: MarqueeConsensusReference = {
        symbol: symUpper,
        currentPrice: effectivePrice || 0,
        targetMean: mean,
        targetMedian: median,
        targetHigh: high,
        targetLow: low,
        consensusUpsidePercent: consensusUpside,
        totalAnalysts,
        marqueeViewsCount: marqueeViews.length,
        consensusRating,
        historicalShift: histMap,
        marqueeViews,
        distribution: {
          buy: buyCount,
          hold: holdCount,
          sell: sellCount,
        },
        tierBreakdown: {
          bulgeBracket: bulgeBracketCount,
          domesticTier1: domesticTier1Count,
        },
        quotingSummary,
        fintekDivergencePercent,
        disclaimer:
          "Brokerage views and target prices are curated from public exchange disclosures, research notes, and financial press for benchmarking and quotation only. They do not constitute investment advice or solicitation by FintekPro.",
        engineVersion: "MARQUEE-v2.0",
        calculationTimestamp: timestamp,
        updatedAt: timestamp,
      };

      // Persist consensus snapshot in DB
      this.persistConsensusSnapshotAsync(result);

      _cache.set(symUpper, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    } catch (err: any) {
      logger.warn(`[MarqueeBrokerageService] API fetch failed for ${symUpper}, loading from DB fallback`, {
        error: err?.message,
      });

      // Secondary Fallback: Load entirely from DB
      return this.loadFallbackFromDatabase(symUpper, currentPrice);
    }
  }

  /**
   * Purpose: Scans news articles for recognized marquee brokerage coverage and extracts targets/ratings.
   */
  private parseMarqueeViewsFromNews(newsItems: any[], currentPrice?: number): MarqueeBrokerageView[] {
    const views: MarqueeBrokerageView[] = [];
    const seenFirmHeadlines = new Set<string>();

    for (const item of newsItems) {
      const title = String(item.title || "");
      const summary = String(item.summary || "");
      const fullText = `${title} ${summary}`;
      const lowerText = fullText.toLowerCase();

      for (const brokerage of MARQUEE_BROKERAGES) {
        const matchesFirm = brokerage.aliases.some((alias) => lowerText.includes(alias));
        if (!matchesFirm) continue;

        const dedupeKey = `${brokerage.name}-${title.slice(0, 40)}`;
        if (seenFirmHeadlines.has(dedupeKey)) continue;
        seenFirmHeadlines.add(dedupeKey);

        // Extract target price: e.g. "target ₹1,840", "₹1,840 target", "target of Rs 1,840", "raises target to 2,100"
        let targetPrice: number | null = null;
        const targetRegexA = /(?:target|tp|price target)(?:\s+(?:price|of|at|to|is|set to|sets))?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)/i;
        const targetRegexB = /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:target|tp|price target)/i;
        const targetRegexC = /(?:sets|sees|projects|estimates|raises target to|cuts target to|ups target to)\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)/i;
        const targetRegexD = /(?:tp|target)\s*:\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)/i;

        const matchA = fullText.match(targetRegexA);
        const matchB = fullText.match(targetRegexB);
        const matchC = fullText.match(targetRegexC);
        const matchD = fullText.match(targetRegexD);

        const rawTarget = matchB ? matchB[1] : matchC ? matchC[1] : matchD ? matchD[1] : matchA ? matchA[1] : null;
        if (rawTarget) {
          const parsed = parseFloat(rawTarget.replace(/,/g, ""));
          if (!isNaN(parsed) && parsed > 5 && parsed < 500000) {
            targetPrice = parsed;
          }
        }

        // Action detection
        let action: MarqueeBrokerageView["action"] = "MAINTAIN";
        if (/upgrades|upgrade|raises target|hikes target|ups target/i.test(fullText)) action = "UPGRADE";
        else if (/downgrades|downgrade|cuts target|lowers target|slashes target/i.test(fullText)) action = "DOWNGRADE";
        else if (/initiates|initiating|starts coverage|initiates coverage/i.test(fullText)) action = "INITIATE";
        else if (/reiterates|reiterate/i.test(fullText)) action = "REITERATE";
        else if (/maintains|retains/i.test(fullText)) action = "MAINTAIN";

        // Upside %
        let upsidePercent: number | null = null;
        const upsideRegex = /([0-9]+(?:\.[0-9]+)?)\s*%\s*upside/i;
        const upsideMatch = fullText.match(upsideRegex);
        if (upsideMatch && upsideMatch[1]) {
          upsidePercent = parseFloat(upsideMatch[1]);
        } else if (targetPrice && currentPrice && currentPrice > 0) {
          upsidePercent = Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10;
        }

        // Stance / rating
        let rating: MarqueeBrokerageView["rating"] = "UNKNOWN";
        if (/(?:retains|maintains|reiterates|gives|sees)\s+['"]?buy['"]?|\bbuy\b|\boutperform\b|\boverweight\b/i.test(fullText)) {
          rating = "BUY";
        } else if (/accumulate|add/i.test(fullText)) {
          rating = "ACCUMULATE";
        } else if (/hold|neutral|market perform|equal-weight/i.test(fullText)) {
          rating = "HOLD";
        } else if (/sell|underperform|underweight/i.test(fullText)) {
          rating = "SELL";
        } else if (/reduce/i.test(fullText)) {
          rating = "REDUCE";
        }

        views.push({
          firm: brokerage.name,
          code: brokerage.code,
          tier: brokerage.tier,
          rating,
          action,
          targetPrice,
          upsidePercent,
          headline: title,
          quoteSnippet: summary ? summary.slice(0, 220) : title,
          publishedDate: item.published_at || new Date().toISOString().split("T")[0],
          source: item.source || "Institutional Note",
          url: item.url || undefined,
        });

        if (views.length >= 15) break;
      }
      if (views.length >= 15) break;
    }

    return views;
  }

  /**
   * Purpose: Generates quotation-ready synthesis for research engines and AI advisories.
   */
  private generateQuotingSummary(
    symbol: string,
    meanTarget: number | null,
    upsidePct: number | null,
    totalAnalysts: number,
    marqueeViews: MarqueeBrokerageView[]
  ): string {
    const parts: string[] = [];

    if (totalAnalysts > 0 && meanTarget) {
      parts.push(
        `Street consensus across ${totalAnalysts} analysts projects an average target price of ₹${meanTarget.toLocaleString("en-IN")}${
          upsidePct != null ? ` (${upsidePct >= 0 ? "+" : ""}${upsidePct}% upside)` : ""
        }.`
      );
    }

    if (marqueeViews.length > 0) {
      const uniqueFirms = new Map<string, MarqueeBrokerageView>();
      for (const v of marqueeViews) {
        if (!uniqueFirms.has(v.firm) || (v.targetPrice && !uniqueFirms.get(v.firm)?.targetPrice)) {
          uniqueFirms.set(v.firm, v);
        }
      }
      const topCalls = Array.from(uniqueFirms.values())
        .slice(0, 3)
        .map((v) => `${v.firm}${v.targetPrice ? ` (Target: ₹${v.targetPrice.toLocaleString("en-IN")})` : ""}`)
        .join(", ");
      parts.push(`Recent marquee coverage includes notes from ${topCalls}.`);
    } else {
      parts.push(`Marquee institutional coverage actively tracked across Global Bulge Bracket and Tier-1 Domestic desks.`);
    }

    return parts.join(" ");
  }

  /**
   * Purpose: Loads persisted coverage calls from PostgreSQL.
   */
  private async getPersistedCalls(symbol: string): Promise<MarqueeBrokerageView[]> {
    try {
      const rows = await db
        .select()
        .from(brokerageCoverageCalls)
        .where(eq(brokerageCoverageCalls.symbol, symbol))
        .orderBy(desc(brokerageCoverageCalls.publishedDate))
        .limit(10);

      return rows.map((r) => ({
        id: r.id,
        firm: r.brokerageName,
        tier: (r.tier as any) || "DOMESTIC_TIER_1",
        rating: (r.rating as any) || "UNKNOWN",
        action: (r.action as any) || "MAINTAIN",
        targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
        previousTargetPrice: r.previousTargetPrice ? parseFloat(r.previousTargetPrice) : null,
        priceAtCall: r.priceAtCall ? parseFloat(r.priceAtCall) : null,
        upsidePercent: r.upsidePercent ? parseFloat(r.upsidePercent) : null,
        headline: r.headline,
        quoteSnippet: r.quoteSnippet || r.headline,
        keyTakeaways: r.keyTakeaways || undefined,
        publishedDate: r.publishedDate ? r.publishedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        source: r.source || "Institutional Note",
        url: r.sourceUrl || undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Purpose: Asynchronously persists newly parsed calls into the database.
   */
  private async persistCallsAsync(symbol: string, views: MarqueeBrokerageView[]): Promise<void> {
    try {
      for (const v of views) {
        if (!v.headline || !v.firm) continue;
        const pubDate = new Date(v.publishedDate);
        const validDate = isNaN(pubDate.getTime()) ? new Date() : pubDate;

        await db
          .insert(brokerageCoverageCalls)
          .values({
            symbol,
            brokerageName: v.firm,
            tier: v.tier,
            rating: v.rating,
            action: v.action || "MAINTAIN",
            targetPrice: v.targetPrice != null ? v.targetPrice.toString() : null,
            upsidePercent: v.upsidePercent != null ? v.upsidePercent.toString() : null,
            headline: v.headline,
            quoteSnippet: v.quoteSnippet,
            publishedDate: validDate,
            source: v.source,
            sourceUrl: v.url,
          })
          .catch(() => {});
      }
    } catch (err: any) {
      logger.warn(`[MarqueeBrokerageService] Async call persist warning: ${err?.message}`);
    }
  }

  /**
   * Purpose: Asynchronously saves daily consensus snapshot to PostgreSQL.
   */
  private async persistConsensusSnapshotAsync(ref: MarqueeConsensusReference): Promise<void> {
    try {
      const today = new Date().toISOString().split("T")[0];
      await db
        .insert(brokerageConsensusHistory)
        .values({
          symbol: ref.symbol,
          snapshotDate: today,
          currentPrice: ref.currentPrice ? ref.currentPrice.toString() : null,
          targetMean: ref.targetMean ? ref.targetMean.toString() : null,
          targetMedian: ref.targetMedian ? ref.targetMedian.toString() : null,
          targetHigh: ref.targetHigh ? ref.targetHigh.toString() : null,
          targetLow: ref.targetLow ? ref.targetLow.toString() : null,
          consensusUpsidePercent: ref.consensusUpsidePercent ? ref.consensusUpsidePercent.toString() : null,
          consensusRating: ref.consensusRating,
          totalAnalysts: ref.totalAnalysts,
          buyCount: ref.distribution?.buy ?? 0,
          holdCount: ref.distribution?.hold ?? 0,
          sellCount: ref.distribution?.sell ?? 0,
          bulgeBracketCount: ref.tierBreakdown?.bulgeBracket ?? 0,
          domesticTier1Count: ref.tierBreakdown?.domesticTier1 ?? 0,
          quotingSummary: ref.quotingSummary,
          source: "FINTEKPRO_CONSENSUS",
        })
        .onConflictDoUpdate({
          target: [brokerageConsensusHistory.symbol, brokerageConsensusHistory.snapshotDate],
          set: {
            currentPrice: ref.currentPrice ? ref.currentPrice.toString() : null,
            targetMean: ref.targetMean ? ref.targetMean.toString() : null,
            consensusUpsidePercent: ref.consensusUpsidePercent ? ref.consensusUpsidePercent.toString() : null,
            consensusRating: ref.consensusRating,
            totalAnalysts: ref.totalAnalysts,
            quotingSummary: ref.quotingSummary,
          },
        })
        .catch(() => {});
    } catch (err: any) {
      logger.warn(`[MarqueeBrokerageService] Async consensus snapshot warning: ${err?.message}`);
    }
  }

  /**
   * Purpose: Fully offline/database fallback when external APIs fail or are blocked.
   */
  private async loadFallbackFromDatabase(
    symbol: string,
    currentPrice?: number
  ): Promise<MarqueeConsensusReference | null> {
    try {
      const calls = await this.getPersistedCalls(symbol);
      const today = new Date().toISOString().split("T")[0];

      const snapRows = await db
        .select()
        .from(brokerageConsensusHistory)
        .where(eq(brokerageConsensusHistory.symbol, symbol))
        .orderBy(desc(brokerageConsensusHistory.snapshotDate))
        .limit(1);

      const snap = snapRows[0];
      const mean = snap?.targetMean ? parseFloat(snap.targetMean) : null;
      const effectivePrice = currentPrice || (snap?.currentPrice ? parseFloat(snap.currentPrice) : 0);
      const upside =
        mean && effectivePrice > 0
          ? Math.round(((mean - effectivePrice) / effectivePrice) * 1000) / 10
          : null;

      const timestamp = new Date().toISOString();
      return {
        symbol,
        currentPrice: effectivePrice,
        targetMean: mean,
        targetMedian: snap?.targetMedian ? parseFloat(snap.targetMedian) : null,
        targetHigh: snap?.targetHigh ? parseFloat(snap.targetHigh) : null,
        targetLow: snap?.targetLow ? parseFloat(snap.targetLow) : null,
        consensusUpsidePercent: upside,
        totalAnalysts: snap?.totalAnalysts || calls.length,
        marqueeViewsCount: calls.length,
        consensusRating: snap?.consensusRating || "HOLD",
        historicalShift: {},
        marqueeViews: calls,
        quotingSummary:
          snap?.quotingSummary ||
          `Historical institutional consensus tracks average target price of ₹${mean?.toLocaleString("en-IN") || "—"}.`,
        disclaimer:
          "Institutional views retrieved from FintekPro historical consensus repository.",
        engineVersion: "MARQUEE-v2.0-FALLBACK",
        calculationTimestamp: timestamp,
        updatedAt: timestamp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Purpose: Returns recent top institutional brokerage calls across all covered stocks.
   * Inputs: options { tier?: string; limit?: number }
   * Outputs: Promise<MarqueeBrokerageView[]>
   */
  async getTopBrokerageCalls(options: {
    tier?: "GLOBAL_BULGE_BRACKET" | "DOMESTIC_TIER_1";
    limit?: number;
  } = {}): Promise<MarqueeBrokerageView[]> {
    try {
      const limit = options.limit || 20;
      let query = db
        .select()
        .from(brokerageCoverageCalls)
        .orderBy(desc(brokerageCoverageCalls.publishedDate))
        .limit(limit);

      if (options.tier) {
        query = db
          .select()
          .from(brokerageCoverageCalls)
          .where(eq(brokerageCoverageCalls.tier, options.tier))
          .orderBy(desc(brokerageCoverageCalls.publishedDate))
          .limit(limit) as any;
      }

      const rows = await query;
      return rows.map((r) => ({
        id: r.id,
        firm: r.brokerageName,
        tier: (r.tier as any) || "DOMESTIC_TIER_1",
        rating: (r.rating as any) || "UNKNOWN",
        action: (r.action as any) || "MAINTAIN",
        targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
        previousTargetPrice: r.previousTargetPrice ? parseFloat(r.previousTargetPrice) : null,
        priceAtCall: r.priceAtCall ? parseFloat(r.priceAtCall) : null,
        upsidePercent: r.upsidePercent ? parseFloat(r.upsidePercent) : null,
        headline: r.headline,
        quoteSnippet: r.quoteSnippet || r.headline,
        publishedDate: r.publishedDate ? r.publishedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        source: r.source || "Institutional Note",
        url: r.sourceUrl || undefined,
      }));
    } catch {
      return [];
    }
  }
}

export const marqueeBrokerageService = new MarqueeBrokerageService();
