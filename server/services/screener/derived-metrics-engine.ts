import { db } from '../../db';
import { screenerFinancials, screenerDerivedMetrics, screenerStocks } from '@shared/schema';
import { eq, desc, isNotNull, sql } from 'drizzle-orm';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalize(val: number | null | undefined, min: number, max: number): number {
  if (val == null || isNaN(val)) return 50;
  return clamp(((val - min) / (max - min || 1)) * 100, 0, 100);
}

function safeNum(val: any): number | null {
  if (val == null) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export async function calculateDerivedMetrics(symbol: string): Promise<void> {
  const [financials] = await db
    .select()
    .from(screenerFinancials)
    .where(eq(screenerFinancials.symbol, symbol))
    .orderBy(desc(screenerFinancials.fiscalYear))
    .limit(1);

  if (!financials) return;

  const revGrowth = safeNum(financials.revenueGrowth);
  const earnGrowth = safeNum(financials.earningsGrowth);
  const roe = safeNum(financials.roe);
  const roa = safeNum(financials.roa);
  const npm = safeNum(financials.netProfitMargin);
  const opm = safeNum(financials.operatingMargin);
  const pe = safeNum(financials.peRatio);
  const pb = safeNum(financials.pbRatio);
  const de = safeNum(financials.debtToEquity);
  const cr = safeNum(financials.currentRatio);
  const divYield = safeNum(financials.dividendYield);

  const growthScore = clamp(
    (normalize(revGrowth, -0.2, 0.5) * 0.5 + normalize(earnGrowth, -0.3, 0.6) * 0.5),
    0, 100
  );

  const qualityScore = clamp(
    (normalize(roe, 0, 0.35) * 0.3 +
     normalize(roa, 0, 0.2) * 0.2 +
     normalize(npm, 0, 0.3) * 0.25 +
     normalize(opm, 0, 0.35) * 0.25),
    0, 100
  );

  const peScore = pe != null ? normalize(50 - pe, -50, 50) : 50;
  const pbScore = pb != null ? normalize(5 - pb, -5, 5) : 50;
  const dyScore = divYield != null ? normalize(divYield, 0, 0.08) : 50;
  const valueScore = clamp(peScore * 0.4 + pbScore * 0.3 + dyScore * 0.3, 0, 100);

  const deScore = de != null ? normalize(2 - de, -3, 3) : 50;
  const crScore = cr != null ? normalize(cr, 0, 3) : 50;
  const riskScore = clamp(deScore * 0.5 + crScore * 0.5, 0, 100);

  const compositeScore = clamp(
    growthScore * 0.25 + qualityScore * 0.30 + valueScore * 0.25 + riskScore * 0.20,
    0, 100
  );

  let fintekRating = 3;
  if (compositeScore >= 80) fintekRating = 5;
  else if (compositeScore >= 65) fintekRating = 4;
  else if (compositeScore >= 45) fintekRating = 3;
  else if (compositeScore >= 25) fintekRating = 2;
  else fintekRating = 1;

  const values = {
    symbol,
    growthScore: growthScore.toFixed(2),
    qualityScore: qualityScore.toFixed(2),
    valueScore: valueScore.toFixed(2),
    riskScore: riskScore.toFixed(2),
    compositeScore: compositeScore.toFixed(2),
    fintekRating,
    revenueGrowth3Y: revGrowth != null ? revGrowth.toFixed(4) : null,
    earningsGrowth3Y: earnGrowth != null ? earnGrowth.toFixed(4) : null,
    scoringMetadata: {
      peScore: Math.round(peScore),
      pbScore: Math.round(pbScore),
      dyScore: Math.round(dyScore),
      deScore: Math.round(deScore),
      crScore: Math.round(crScore),
      calculatedAt: new Date().toISOString(),
    },
    lastCalculated: new Date(),
  };

  const [existing] = await db
    .select({ id: screenerDerivedMetrics.id })
    .from(screenerDerivedMetrics)
    .where(eq(screenerDerivedMetrics.symbol, symbol))
    .limit(1);

  if (existing) {
    await db.update(screenerDerivedMetrics).set(values).where(eq(screenerDerivedMetrics.id, existing.id));
  } else {
    await db.insert(screenerDerivedMetrics).values(values);
  }
}

export async function recalculateAllMetrics(): Promise<{ processed: number; errors: number }> {
  const stocks = await db
    .select({ symbol: screenerStocks.symbol })
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true));

  let processed = 0;
  let errors = 0;

  for (const stock of stocks) {
    try {
      await calculateDerivedMetrics(stock.symbol);
      processed++;
    } catch (err: any) {
      errors++;
      if (errors <= 3) {
        console.warn(`[DerivedMetrics] Error for ${stock.symbol}: ${err.message}`);
      }
    }
  }

  console.log(`[DerivedMetrics] Recalculation complete: ${processed} processed, ${errors} errors`);
  return { processed, errors };
}
