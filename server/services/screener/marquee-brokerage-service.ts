/**
 * @file marquee-brokerage-service.ts
 * @description Curates, parses, and provides marquee institutional brokerage views, targets,
 *              and commentary for reference and quoting within FintekPro's engines.
 *
 * Compliance: GCR v1.0 & FASP-AI v1.0
 * - Reference & Quoting Layer: Provides institutional perspective to enrich FintekPro
 *   proprietary models without altering deterministic core scoring.
 * - Full audit trail with source, headline, published timestamp, and disclaimer.
 */

import { indianApiService } from "../indian-api-service";
import { logger } from "../../logger";

export interface MarqueeBrokerageDefinition {
  name: string;
  aliases: string[];
  tier: "GLOBAL_BULGE_BRACKET" | "DOMESTIC_TIER_1";
  country: "GLOBAL" | "INDIA";
}

export const MARQUEE_BROKERAGES: MarqueeBrokerageDefinition[] = [
  // ── Global Bulge Bracket ──────────────────────────────────────────────────
  { name: "Goldman Sachs", aliases: ["goldman sachs", "goldman"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Morgan Stanley", aliases: ["morgan stanley"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Jefferies", aliases: ["jefferies"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "JPMorgan", aliases: ["jpmorgan", "jp morgan"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "CLSA", aliases: ["clsa"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Nomura", aliases: ["nomura"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "UBS", aliases: ["ubs"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Bernstein", aliases: ["bernstein", "alliancebernstein"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Macquarie", aliases: ["macquarie"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "Citi", aliases: ["citi", "citigroup"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "HSBC", aliases: ["hsbc"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },
  { name: "BofA Securities", aliases: ["bofa", "bank of america", "merrill lynch"], tier: "GLOBAL_BULGE_BRACKET", country: "GLOBAL" },

  // ── Domestic Tier 1 Institutional Desks ───────────────────────────────────
  { name: "Kotak Institutional Equities", aliases: ["kotak institutional", "kotak securities", "kotak"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Motilal Oswal", aliases: ["motilal oswal", "mosl"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "ICICI Securities", aliases: ["icici securities", "icici direct"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Axis Capital", aliases: ["axis capital", "axis securities"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "HDFC Securities", aliases: ["hdfc securities", "hdfc sec"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Nuvama Institutional Equities", aliases: ["nuvama", "edelweiss"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Emkay Global", aliases: ["emkay"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Anand Rathi", aliases: ["anand rathi"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
  { name: "Sharekhan", aliases: ["sharekhan", "bnp paribas"], tier: "DOMESTIC_TIER_1", country: "INDIA" },
];

export interface MarqueeBrokerageView {
  firm: string;
  tier: "GLOBAL_BULGE_BRACKET" | "DOMESTIC_TIER_1";
  rating: "BUY" | "ACCUMULATE" | "HOLD" | "REDUCE" | "SELL" | "NEUTRAL" | "OVERWEIGHT" | "UNDERWEIGHT" | "UNKNOWN";
  targetPrice: number | null;
  upsidePercent: number | null;
  headline: string;
  quoteSnippet: string;
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
  quotingSummary: string;
  disclaimer: string;
  updatedAt: string;
}

const _cache = new Map<string, { data: MarqueeConsensusReference; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes in-memory cache

export class MarqueeBrokerageService {
  /**
   * Retrieves marquee brokerage consensus & individual quoted calls for a given stock symbol.
   */
  async getMarqueeReference(symbol: string, currentPrice?: number): Promise<MarqueeConsensusReference | null> {
    const symUpper = symbol.toUpperCase().trim();
    if (!symUpper) return null;

    const cached = _cache.get(symUpper);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
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

      // 2. Parse marquee brokerage views from news headlines and summaries
      const marqueeViews = this.parseMarqueeViewsFromNews(newsItems, currentPrice);

      // 3. Assemble consensus numbers
      const mean = targetData?.mean && targetData.mean > 0 ? targetData.mean : null;
      const median = targetData?.median && targetData.median > 0 ? targetData.median : null;
      const high = targetData?.high && targetData.high > 0 ? targetData.high : null;
      const low = targetData?.low && targetData.low > 0 ? targetData.low : null;
      const totalAnalysts = targetData?.num_estimates || marqueeViews.length;

      const effectivePrice = currentPrice && currentPrice > 0 ? currentPrice : null;
      const consensusUpside = mean && effectivePrice
        ? Math.round(((mean - effectivePrice) / effectivePrice) * 1000) / 10
        : null;

      let consensusRating = "HOLD";
      if (consensusUpside != null) {
        if (consensusUpside >= 18) consensusRating = "STRONG BUY";
        else if (consensusUpside >= 8) consensusRating = "BUY";
        else if (consensusUpside <= -10) consensusRating = "SELL";
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

      // 4. Generate structured quote summary for FintekPro engines
      const quotingSummary = this.generateQuotingSummary(
        symUpper,
        mean,
        consensusUpside,
        totalAnalysts,
        marqueeViews
      );

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
        quotingSummary,
        disclaimer: "Brokerage views and price targets are curated from public disclosures and media research notes for analytical reference and quotation only. They do not constitute investment advice or solicitation by FintekPro.",
        updatedAt: new Date().toISOString(),
      };

      _cache.set(symUpper, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    } catch (err: any) {
      logger.warn(`[MarqueeBrokerageService] Failed to fetch marquee reference for ${symUpper}`, {
        error: err?.message,
      });
      return null;
    }
  }

  /**
   * Scans news articles for mentions of recognized marquee houses and extracts target/rating details.
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

        // Extract target price: e.g. "target ₹1,840", "₹1,840 target", "target of Rs 1,840"
        let targetPrice: number | null = null;
        const targetRegexA = /(?:target|tp|price target)(?:\s+(?:price|of|at|to|is|set to|sets))?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)/i;
        const targetRegexB = /(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:target|tp|price target)/i;
        const targetRegexC = /(?:sets|sees|projects|estimates)\s*(?:₹|rs\.?|inr)\s*([0-9,]+(?:\.[0-9]+)?)/i;
        const matchA = fullText.match(targetRegexA);
        const matchB = fullText.match(targetRegexB);
        const matchC = fullText.match(targetRegexC);
        const rawTarget = matchB ? matchB[1] : matchC ? matchC[1] : matchA ? matchA[1] : null;
        if (rawTarget) {
          const parsed = parseFloat(rawTarget.replace(/,/g, ""));
          if (!isNaN(parsed) && parsed > 10 && parsed < 200000) {
            targetPrice = parsed;
          }
        }

        // Extract upside % if mentioned explicitly (e.g. "sees 58% upside", "47% upside")
        let upsidePercent: number | null = null;
        const upsideRegex = /([0-9]+(?:\.[0-9]+)?)\s*%\s*upside/i;
        const upsideMatch = fullText.match(upsideRegex);
        if (upsideMatch && upsideMatch[1]) {
          upsidePercent = parseFloat(upsideMatch[1]);
        } else if (targetPrice && currentPrice && currentPrice > 0) {
          upsidePercent = Math.round(((targetPrice - currentPrice) / currentPrice) * 1000) / 10;
        }

        // Extract rating / stance
        let rating: MarqueeBrokerageView["rating"] = "UNKNOWN";
        if (/(?:retains|maintains|reiterates|gives|sees)\s+['"]?buy['"]?|\bbuy\b|\boutperform\b|\boverweight\b/i.test(fullText)) {
          rating = "BUY";
        } else if (/accumulate|add/i.test(fullText)) {
          rating = "ACCUMULATE";
        } else if (/hold|neutral|market perform/i.test(fullText)) {
          rating = "HOLD";
        } else if (/sell|underperform|underweight/i.test(fullText)) {
          rating = "SELL";
        }

        views.push({
          firm: brokerage.name,
          tier: brokerage.tier,
          rating,
          targetPrice,
          upsidePercent,
          headline: title,
          quoteSnippet: summary ? summary.slice(0, 180) : title,
          publishedDate: item.published_at || new Date().toISOString().split("T")[0],
          source: item.source || "Financial Media",
          url: item.url || undefined,
        });

        // Max 10 marquee calls per symbol
        if (views.length >= 10) break;
      }
      if (views.length >= 10) break;
    }

    return views;
  }

  /**
   * Generates a clean, quotation-ready summary sentence for research engines and AI advisories.
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
      // Pick unique firms, favoring those with explicit target prices
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
}

export const marqueeBrokerageService = new MarqueeBrokerageService();
