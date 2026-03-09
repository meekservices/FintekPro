export type RecommendationRating = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

export interface RatingResult {
  rating: RecommendationRating;
  score: number;
  breakdown: {
    fundamentals: number;
    valuation: number;
    momentum: number;
  };
  rationale: string;
}

export function computeRating(params: {
  pe: number | null;
  roe: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  momentumScore: number;
  upsidePotential: number | null;
}): RatingResult {
  const { pe, roe, debtToEquity, revenueGrowth, earningsGrowth, momentumScore, upsidePotential } = params;

  let fundamentalsScore = 50;
  if (roe !== null) fundamentalsScore += roe > 0.2 ? 20 : roe > 0.1 ? 10 : -10;
  if (debtToEquity !== null) fundamentalsScore += debtToEquity < 0.5 ? 15 : debtToEquity < 1.5 ? 5 : -10;
  if (revenueGrowth !== null) fundamentalsScore += revenueGrowth > 0.2 ? 15 : revenueGrowth > 0.05 ? 8 : -5;
  if (earningsGrowth !== null) fundamentalsScore += earningsGrowth > 0.2 ? 10 : earningsGrowth > 0 ? 5 : -10;
  fundamentalsScore = Math.min(100, Math.max(0, fundamentalsScore));

  let valuationScore = 50;
  if (pe !== null) valuationScore += pe < 15 ? 25 : pe < 25 ? 10 : pe < 40 ? -5 : -20;
  if (upsidePotential !== null) valuationScore += upsidePotential > 20 ? 25 : upsidePotential > 10 ? 15 : upsidePotential > 0 ? 5 : -15;
  valuationScore = Math.min(100, Math.max(0, valuationScore));

  const combinedScore =
    fundamentalsScore * 0.4 + valuationScore * 0.3 + momentumScore * 0.3;

  let rating: RecommendationRating;
  if (combinedScore >= 80) rating = "STRONG BUY";
  else if (combinedScore >= 65) rating = "BUY";
  else if (combinedScore >= 45) rating = "HOLD";
  else if (combinedScore >= 30) rating = "SELL";
  else rating = "STRONG SELL";

  const rationale = buildRationale(rating, fundamentalsScore, valuationScore, momentumScore);

  return {
    rating,
    score: Math.round(combinedScore),
    breakdown: {
      fundamentals: Math.round(fundamentalsScore),
      valuation: Math.round(valuationScore),
      momentum: Math.round(momentumScore),
    },
    rationale,
  };
}

function buildRationale(
  rating: RecommendationRating,
  f: number,
  v: number,
  m: number
): string {
  const parts: string[] = [];
  if (f >= 65) parts.push("strong fundamentals");
  else if (f >= 45) parts.push("moderate fundamentals");
  else parts.push("weak fundamentals");

  if (v >= 65) parts.push("attractive valuation");
  else if (v >= 45) parts.push("fair valuation");
  else parts.push("stretched valuation");

  if (m >= 65) parts.push("positive price momentum");
  else if (m >= 35) parts.push("neutral momentum");
  else parts.push("negative momentum");

  return `${rating} — Based on ${parts.join(", ")}.`;
}
