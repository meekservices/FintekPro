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
  const ret1y = safeNum(financials.return1y);
  const ret3y = safeNum(financials.return3y);
  const ret5y = safeNum(financials.return5y);
  const roe = safeNum(financials.roe);
  const roa = safeNum(financials.roa);
  const npm = safeNum(financials.netProfitMargin);
  const opm = safeNum(financials.operatingMargin);
  const pe = safeNum(financials.peRatio);
  const pb = safeNum(financials.pbRatio);
  const de = safeNum(financials.debtToEquity);
  const cr = safeNum(financials.currentRatio);
  const divYield = safeNum(financials.dividendYield);

  const hasReturns = ret1y != null || ret3y != null || ret5y != null;
  const hasFundamentals = revGrowth != null || earnGrowth != null;

  let growthScore: number;
  if (hasReturns && hasFundamentals) {
    const retScore = clamp(
      (normalize(ret1y, -0.3, 0.5) * 0.4 +
       normalize(ret3y, -0.2, 1.5) * 0.3 +
       normalize(ret5y, -0.1, 3.0) * 0.3),
      0, 100
    );
    const fundScore = clamp(
      (normalize(revGrowth, -0.2, 0.5) * 0.5 + normalize(earnGrowth, -0.3, 0.6) * 0.5),
      0, 100
    );
    growthScore = clamp(fundScore * 0.5 + retScore * 0.5, 0, 100);
  } else if (hasReturns) {
    growthScore = clamp(
      (normalize(ret1y, -0.3, 0.5) * 0.4 +
       normalize(ret3y, -0.2, 1.5) * 0.3 +
       normalize(ret5y, -0.1, 3.0) * 0.3),
      0, 100
    );
  } else {
    growthScore = clamp(
      (normalize(revGrowth, -0.2, 0.5) * 0.5 + normalize(earnGrowth, -0.3, 0.6) * 0.5),
      0, 100
    );
  }

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
      ret1yScore: ret1y != null ? Math.round(normalize(ret1y, -0.3, 0.5)) : null,
      ret3yScore: ret3y != null ? Math.round(normalize(ret3y, -0.2, 1.5)) : null,
      ret5yScore: ret5y != null ? Math.round(normalize(ret5y, -0.1, 3.0)) : null,
      hasReturnData: hasReturns,
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
  let processed = 0;
  let errors = 0;

  try {
    const result = await db.execute(sql`
      INSERT INTO screener_derived_metrics (symbol, growth_score, quality_score, value_score, risk_score, composite_score, fintek_rating, last_calculated)
      SELECT
        sf.symbol,
        ROUND(LEAST(100, GREATEST(0,
          CASE 
            WHEN sf.return_1y IS NOT NULL OR sf.return_3y IS NOT NULL THEN
              CASE 
                WHEN sf.revenue_growth IS NOT NULL THEN
                  (LEAST(100, GREATEST(0, ((COALESCE(sf.revenue_growth::numeric, 0) + 0.2) / 0.7) * 100)) * 0.5 +
                   LEAST(100, GREATEST(0, ((COALESCE(sf.earnings_growth::numeric, 0) + 0.3) / 0.9) * 100)) * 0.5) * 0.5 +
                  (LEAST(100, GREATEST(0, ((COALESCE(sf.return_1y::numeric, 0) + 0.3) / 0.8) * 100)) * 0.4 +
                   LEAST(100, GREATEST(0, ((COALESCE(sf.return_3y::numeric, 0) + 0.2) / 1.7) * 100)) * 0.3 +
                   LEAST(100, GREATEST(0, ((COALESCE(sf.return_5y::numeric, 0) + 0.1) / 3.1) * 100)) * 0.3) * 0.5
                ELSE
                  LEAST(100, GREATEST(0, ((COALESCE(sf.return_1y::numeric, 0) + 0.3) / 0.8) * 100)) * 0.4 +
                  LEAST(100, GREATEST(0, ((COALESCE(sf.return_3y::numeric, 0) + 0.2) / 1.7) * 100)) * 0.3 +
                  LEAST(100, GREATEST(0, ((COALESCE(sf.return_5y::numeric, 0) + 0.1) / 3.1) * 100)) * 0.3
              END
            ELSE
              (CASE WHEN sf.revenue_growth IS NOT NULL THEN LEAST(100, GREATEST(0, ((sf.revenue_growth::numeric + 0.2) / 0.7) * 100)) ELSE 50 END) * 0.5 +
              (CASE WHEN sf.earnings_growth IS NOT NULL THEN LEAST(100, GREATEST(0, ((sf.earnings_growth::numeric + 0.3) / 0.9) * 100)) ELSE 50 END) * 0.5
          END
        )), 2) as growth_score,
        ROUND(LEAST(100, GREATEST(0,
          (CASE WHEN sf.roe IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.roe::numeric / 0.35) * 100)) ELSE 50 END) * 0.3 +
          (CASE WHEN sf.roa IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.roa::numeric / 0.2) * 100)) ELSE 50 END) * 0.2 +
          (CASE WHEN sf.net_profit_margin IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.net_profit_margin::numeric / 0.3) * 100)) ELSE 50 END) * 0.25 +
          (CASE WHEN sf.operating_margin IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.operating_margin::numeric / 0.35) * 100)) ELSE 50 END) * 0.25
        )), 2) as quality_score,
        ROUND(LEAST(100, GREATEST(0,
          (CASE WHEN sf.pe_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, ((50 - sf.pe_ratio::numeric + 50) / 100) * 100)) ELSE 50 END) * 0.4 +
          (CASE WHEN sf.pb_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, ((5 - sf.pb_ratio::numeric + 5) / 10) * 100)) ELSE 50 END) * 0.3 +
          (CASE WHEN sf.dividend_yield IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.dividend_yield::numeric / 0.08) * 100)) ELSE 50 END) * 0.3
        )), 2) as value_score,
        ROUND(LEAST(100, GREATEST(0,
          (CASE WHEN sf.debt_to_equity IS NOT NULL THEN LEAST(100, GREATEST(0, ((2 - sf.debt_to_equity::numeric + 3) / 6) * 100)) ELSE 50 END) * 0.5 +
          (CASE WHEN sf.current_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.current_ratio::numeric / 3) * 100)) ELSE 50 END) * 0.5
        )), 2) as risk_score,
        0 as composite_score,
        3 as fintek_rating,
        NOW() as last_calculated
      FROM screener_financials sf
      INNER JOIN screener_stocks ss ON ss.symbol = sf.symbol AND ss.is_active = true
      WHERE NOT EXISTS (SELECT 1 FROM screener_derived_metrics dm WHERE dm.symbol = sf.symbol)
      ON CONFLICT (symbol) DO NOTHING
    `);
    const inserted = (result as any)?.rowCount || 0;

    const updateResult = await db.execute(sql`
      UPDATE screener_derived_metrics dm SET
        growth_score = sub.growth_score,
        quality_score = sub.quality_score,
        value_score = sub.value_score,
        risk_score = sub.risk_score,
        composite_score = ROUND(sub.growth_score * 0.25 + sub.quality_score * 0.30 + sub.value_score * 0.25 + sub.risk_score * 0.20, 2),
        fintek_rating = CASE
          WHEN (sub.growth_score * 0.25 + sub.quality_score * 0.30 + sub.value_score * 0.25 + sub.risk_score * 0.20) >= 80 THEN 5
          WHEN (sub.growth_score * 0.25 + sub.quality_score * 0.30 + sub.value_score * 0.25 + sub.risk_score * 0.20) >= 65 THEN 4
          WHEN (sub.growth_score * 0.25 + sub.quality_score * 0.30 + sub.value_score * 0.25 + sub.risk_score * 0.20) >= 45 THEN 3
          WHEN (sub.growth_score * 0.25 + sub.quality_score * 0.30 + sub.value_score * 0.25 + sub.risk_score * 0.20) >= 25 THEN 2
          ELSE 1
        END,
        last_calculated = NOW()
      FROM (
        SELECT
          sf.symbol,
          ROUND(LEAST(100, GREATEST(0,
            CASE 
              WHEN sf.return_1y IS NOT NULL OR sf.return_3y IS NOT NULL THEN
                CASE 
                  WHEN sf.revenue_growth IS NOT NULL THEN
                    (LEAST(100, GREATEST(0, ((COALESCE(sf.revenue_growth::numeric, 0) + 0.2) / 0.7) * 100)) * 0.5 +
                     LEAST(100, GREATEST(0, ((COALESCE(sf.earnings_growth::numeric, 0) + 0.3) / 0.9) * 100)) * 0.5) * 0.5 +
                    (LEAST(100, GREATEST(0, ((COALESCE(sf.return_1y::numeric, 0) + 0.3) / 0.8) * 100)) * 0.4 +
                     LEAST(100, GREATEST(0, ((COALESCE(sf.return_3y::numeric, 0) + 0.2) / 1.7) * 100)) * 0.3 +
                     LEAST(100, GREATEST(0, ((COALESCE(sf.return_5y::numeric, 0) + 0.1) / 3.1) * 100)) * 0.3) * 0.5
                  ELSE
                    LEAST(100, GREATEST(0, ((COALESCE(sf.return_1y::numeric, 0) + 0.3) / 0.8) * 100)) * 0.4 +
                    LEAST(100, GREATEST(0, ((COALESCE(sf.return_3y::numeric, 0) + 0.2) / 1.7) * 100)) * 0.3 +
                    LEAST(100, GREATEST(0, ((COALESCE(sf.return_5y::numeric, 0) + 0.1) / 3.1) * 100)) * 0.3
                END
              ELSE
                (CASE WHEN sf.revenue_growth IS NOT NULL THEN LEAST(100, GREATEST(0, ((sf.revenue_growth::numeric + 0.2) / 0.7) * 100)) ELSE 50 END) * 0.5 +
                (CASE WHEN sf.earnings_growth IS NOT NULL THEN LEAST(100, GREATEST(0, ((sf.earnings_growth::numeric + 0.3) / 0.9) * 100)) ELSE 50 END) * 0.5
            END
          )), 2) as growth_score,
          ROUND(LEAST(100, GREATEST(0,
            (CASE WHEN sf.roe IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.roe::numeric / 0.35) * 100)) ELSE 50 END) * 0.3 +
            (CASE WHEN sf.roa IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.roa::numeric / 0.2) * 100)) ELSE 50 END) * 0.2 +
            (CASE WHEN sf.net_profit_margin IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.net_profit_margin::numeric / 0.3) * 100)) ELSE 50 END) * 0.25 +
            (CASE WHEN sf.operating_margin IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.operating_margin::numeric / 0.35) * 100)) ELSE 50 END) * 0.25
          )), 2) as quality_score,
          ROUND(LEAST(100, GREATEST(0,
            (CASE WHEN sf.pe_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, ((50 - sf.pe_ratio::numeric + 50) / 100) * 100)) ELSE 50 END) * 0.4 +
            (CASE WHEN sf.pb_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, ((5 - sf.pb_ratio::numeric + 5) / 10) * 100)) ELSE 50 END) * 0.3 +
            (CASE WHEN sf.dividend_yield IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.dividend_yield::numeric / 0.08) * 100)) ELSE 50 END) * 0.3
          )), 2) as value_score,
          ROUND(LEAST(100, GREATEST(0,
            (CASE WHEN sf.debt_to_equity IS NOT NULL THEN LEAST(100, GREATEST(0, ((2 - sf.debt_to_equity::numeric + 3) / 6) * 100)) ELSE 50 END) * 0.5 +
            (CASE WHEN sf.current_ratio IS NOT NULL THEN LEAST(100, GREATEST(0, (sf.current_ratio::numeric / 3) * 100)) ELSE 50 END) * 0.5
          )), 2) as risk_score
        FROM screener_financials sf
        INNER JOIN screener_stocks ss ON ss.symbol = sf.symbol AND ss.is_active = true
      ) sub
      WHERE dm.symbol = sub.symbol
    `);
    processed = (updateResult as any)?.rowCount || 0;

    console.log(`[DerivedMetrics] Bulk recalculation: ${inserted} inserted, ${processed} updated`);
  } catch (err: any) {
    console.error(`[DerivedMetrics] Bulk recalculation error: ${err.message}`);
    errors++;
  }

  return { processed, errors };
}
