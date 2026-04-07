/**
 * AIF/PMS → Prospect Matching Engine  v1.0
 *
 * Revenue Loop core:
 *   Deal (AIF/PMS) → Score each prospect → Rank → Return top N with match explanation
 *
 * Scoring model (0–100):
 *   40pts  Wealth fit   — how well investable surplus covers the minimum ticket
 *   25pts  Lead quality — hot=25, warm=15, cold=5
 *   25pts  Composite    — normalised from existing composite score
 *   10pts  City bonus   — if deal has a focus city that matches prospect city
 */

import { db } from "../db";
import { prospectLeads, aifMaster, pmsMaster } from "@shared/schema";
import { isNotNull, gte, or, sql, desc, eq } from "drizzle-orm";

export type DealType = "aif" | "pms";

export interface DealInfo {
  id: string;
  name: string;
  dealType: DealType;
  minInvestment: number;
  category?: string | null;
  strategy?: string | null;
  riskScore?: number | null;
  return1Y?: number | null;
  description?: string | null;
}

export interface ProspectMatchResult {
  prospectId: string;
  companyName: string | null;
  city: string | null;
  state: string | null;
  industrySegment: string | null;
  leadQuality: string | null;
  estimatedNetworth: number;
  investableSurplus: number;
  compositeScore: number;
  wealthScore: number;
  matchScore: number;
  matchTier: "excellent" | "strong" | "good" | "possible";
  matchReasons: string[];
  surplus_cover: number;
}

export interface MatchResult {
  deal: DealInfo;
  matches: ProspectMatchResult[];
  totalEligible: number;
  totalInvestable: number;
  topCities: { city: string; count: number; avgScore: number }[];
  generatedAt: string;
}

async function fetchDeal(dealId: string, dealType: DealType): Promise<DealInfo | null> {
  if (dealType === "aif") {
    const [row] = await db
      .select({
        id: aifMaster.id,
        name: aifMaster.name,
        minInvestment: aifMaster.minInvestment,
        category: aifMaster.category,
        riskScore: aifMaster.riskScore,
        return1Y: aifMaster.return1Y,
        description: aifMaster.description,
      })
      .from(aifMaster)
      .where(eq(aifMaster.id, dealId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      dealType: "aif",
      minInvestment: parseFloat(String(row.minInvestment || "10000000")),
      category: row.category,
      riskScore: row.riskScore,
      return1Y: parseFloat(String(row.return1Y || "0")) || null,
      description: row.description,
    };
  } else {
    const [row] = await db
      .select({
        id: pmsMaster.id,
        name: pmsMaster.name,
        minInvestment: pmsMaster.minInvestment,
        strategy: pmsMaster.strategy,
        riskScore: pmsMaster.riskScore,
        return1Y: pmsMaster.return1Y,
        description: pmsMaster.description,
      })
      .from(pmsMaster)
      .where(eq(pmsMaster.id, dealId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      dealType: "pms",
      minInvestment: parseFloat(String(row.minInvestment || "5000000")),
      strategy: row.strategy,
      riskScore: row.riskScore,
      return1Y: parseFloat(String(row.return1Y || "0")) || null,
      description: row.description,
    };
  }
}

function computeMatchScore(
  prospect: {
    investableSurplus: number;
    estimatedNetworth: number;
    compositeScore: number;
    wealthScore: number;
    leadQuality: string | null;
    city: string | null;
  },
  deal: DealInfo
): { score: number; reasons: string[]; surplusCover: number } {
  const reasons: string[] = [];
  let score = 0;

  const minT = deal.minInvestment;
  const surplus = prospect.investableSurplus || prospect.estimatedNetworth * 0.15;
  const surplusCover = minT > 0 ? surplus / minT : 0;

  // Wealth fit (40 pts)
  let wealthPts = 0;
  if (surplusCover >= 3) { wealthPts = 40; reasons.push("3× surplus cover — highly liquid"); }
  else if (surplusCover >= 1.5) { wealthPts = 32; reasons.push("1.5× surplus cover — comfortable"); }
  else if (surplusCover >= 1.0) { wealthPts = 24; reasons.push("Meets minimum ticket"); }
  else if (surplusCover >= 0.7) { wealthPts = 14; reasons.push("Near minimum — possible stretch"); }
  score += wealthPts;

  // Lead quality (25 pts)
  const qualityPts: Record<string, number> = { hot: 25, warm: 15, cold: 5 };
  const qPts = qualityPts[prospect.leadQuality || "cold"] || 5;
  score += qPts;
  if (prospect.leadQuality === "hot") reasons.push("Hot lead — high engagement");
  else if (prospect.leadQuality === "warm") reasons.push("Warm lead — moderate engagement");

  // Composite score (25 pts normalised from 0–100)
  const compPts = Math.round((prospect.compositeScore / 100) * 25);
  score += compPts;
  if (prospect.compositeScore >= 70) reasons.push(`High composite score (${prospect.compositeScore.toFixed(0)})`);

  // City bonus — favour Mumbai / Delhi NCR / Bengaluru for AIF (10 pts max)
  const hniCities = ["mumbai", "delhi", "bengaluru", "bangalore", "hyderabad", "pune", "ahmedabad", "chennai"];
  const prospectCity = (prospect.city || "").toLowerCase();
  if (hniCities.some((c) => prospectCity.includes(c))) {
    score += 10;
    reasons.push(`HNI city — ${prospect.city}`);
  }

  return { score: Math.min(score, 100), reasons, surplusCover };
}

function toTier(score: number): ProspectMatchResult["matchTier"] {
  if (score >= 80) return "excellent";
  if (score >= 60) return "strong";
  if (score >= 40) return "good";
  return "possible";
}

export async function matchDealToProspects(
  dealId: string,
  dealType: DealType,
  limit = 50
): Promise<MatchResult> {
  const deal = await fetchDeal(dealId, dealType);
  if (!deal) throw new Error(`${dealType.toUpperCase()} deal not found: ${dealId}`);

  const minT = deal.minInvestment;

  const rows = await db
    .select({
      id: prospectLeads.id,
      companyName: prospectLeads.companyName,
      city: prospectLeads.city,
      state: prospectLeads.state,
      industrySegment: prospectLeads.industrySegment,
      leadQuality: prospectLeads.leadQuality,
      estimatedNetworth: prospectLeads.estimatedNetworth,
      investableSurplus: prospectLeads.investableSurplus,
      compositeScore: prospectLeads.compositeScore,
      wealthScore: prospectLeads.wealthScore,
    })
    .from(prospectLeads)
    .where(
      or(
        gte(prospectLeads.investableSurplus, String(minT * 0.7)),
        gte(prospectLeads.estimatedNetworth, String(minT * 4.5))
      )
    )
    .orderBy(desc(prospectLeads.compositeScore))
    .limit(500);

  const scored: ProspectMatchResult[] = rows
    .map((r) => {
      const surplus = parseFloat(String(r.investableSurplus || "0"));
      const networth = parseFloat(String(r.estimatedNetworth || "0"));
      const cs = parseFloat(String(r.compositeScore || "0"));
      const ws = parseFloat(String(r.wealthScore || "0"));
      const { score, reasons, surplusCover } = computeMatchScore(
        { investableSurplus: surplus, estimatedNetworth: networth, compositeScore: cs, wealthScore: ws, leadQuality: r.leadQuality, city: r.city },
        deal
      );
      return {
        prospectId: r.id,
        companyName: r.companyName,
        city: r.city,
        state: r.state,
        industrySegment: r.industrySegment,
        leadQuality: r.leadQuality,
        estimatedNetworth: networth,
        investableSurplus: surplus,
        compositeScore: cs,
        wealthScore: ws,
        matchScore: score,
        matchTier: toTier(score),
        matchReasons: reasons,
        surplus_cover: parseFloat(surplusCover.toFixed(2)),
      } as ProspectMatchResult;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

  const totalInvestable = scored.reduce((s, p) => s + p.investableSurplus, 0);

  const cityMap: Record<string, { count: number; scoreSum: number }> = {};
  for (const p of scored) {
    const c = p.city || "Unknown";
    if (!cityMap[c]) cityMap[c] = { count: 0, scoreSum: 0 };
    cityMap[c].count++;
    cityMap[c].scoreSum += p.matchScore;
  }
  const topCities = Object.entries(cityMap)
    .map(([city, { count, scoreSum }]) => ({ city, count, avgScore: Math.round(scoreSum / count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    deal,
    matches: scored,
    totalEligible: rows.length,
    totalInvestable,
    topCities,
    generatedAt: new Date().toISOString(),
  };
}

export async function getGeoIntelligence(): Promise<{
  cities: { city: string; state: string | null; count: number; avgComposite: number; avgNetworth: number; hotCount: number; totalInvestable: number }[];
  states: { state: string; count: number; avgComposite: number; totalInvestable: number }[];
}> {
  const rows = await db
    .select({
      city: prospectLeads.city,
      state: prospectLeads.state,
      compositeScore: prospectLeads.compositeScore,
      estimatedNetworth: prospectLeads.estimatedNetworth,
      investableSurplus: prospectLeads.investableSurplus,
      leadQuality: prospectLeads.leadQuality,
    })
    .from(prospectLeads)
    .where(isNotNull(prospectLeads.city));

  const cityMap: Record<string, { state: string | null; scores: number[]; networthSum: number; hotCount: number; investableSum: number }> = {};
  const stateMap: Record<string, { scores: number[]; investableSum: number }> = {};

  for (const r of rows) {
    const city = r.city || "Unknown";
    const state = r.state || null;
    const cs = parseFloat(String(r.compositeScore || "0"));
    const nw = parseFloat(String(r.estimatedNetworth || "0"));
    const inv = parseFloat(String(r.investableSurplus || "0"));

    if (!cityMap[city]) cityMap[city] = { state, scores: [], networthSum: 0, hotCount: 0, investableSum: 0 };
    cityMap[city].scores.push(cs);
    cityMap[city].networthSum += nw;
    cityMap[city].investableSum += inv;
    if (r.leadQuality === "hot") cityMap[city].hotCount++;

    if (state) {
      if (!stateMap[state]) stateMap[state] = { scores: [], investableSum: 0 };
      stateMap[state].scores.push(cs);
      stateMap[state].investableSum += inv;
    }
  }

  const cities = Object.entries(cityMap)
    .map(([city, d]) => ({
      city,
      state: d.state,
      count: d.scores.length,
      avgComposite: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      avgNetworth: d.scores.length ? Math.round(d.networthSum / d.scores.length) : 0,
      hotCount: d.hotCount,
      totalInvestable: Math.round(d.investableSum),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const states = Object.entries(stateMap)
    .map(([state, d]) => ({
      state,
      count: d.scores.length,
      avgComposite: d.scores.length ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
      totalInvestable: Math.round(d.investableSum),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return { cities, states };
}
