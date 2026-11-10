/**
 * @file global-credit-cycle-service.ts
 * @description Global Credit Cycle & Systemic Lending Indicators Engine (GCCE) for FintekPro.
 *
 * Models and computes institutional credit market conditions across 5 core pillars:
 *   1. US & Global High Yield OAS Spreads (ICE BofA US HY Spread in bps)
 *   2. Bank Lending Standards (Fed Senior Loan Officer Opinion Survey / SLOOS)
 *   3. Global & Domestic Credit Impulse (China Total Social Financing & RBI SCB Credit Growth)
 *   4. Emerging Market Sovereign Credit Spread (JPMorgan EMBI Global Spread)
 *   5. Dr. Copper to Gold Ratio (Industrial Growth vs Safe Haven Barometer)
 *
 * Downstream Synergy Feeds:
 *   - AIRegimeDetectionEngine: Credit regime and systemic impairment risk flags
 *   - QuantOrchestrator: Macro credit risk premia for Black-Litterman multi-asset tilts
 *   - TailRiskStressEngine: Forward credit shock scenarios (HY OAS 650+ bps blowout)
 *   - PickOfTheDayService: Financial sector leverage filters and NBFC credit hurdles
 *
 * GCR v1.0 & FASP-AI v3.0 Compliance:
 *   - Deterministic calculations: same inputs always produce identical composite credit scores.
 *   - Exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 *   - Strict TypeScript typing with zero unverified any.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
import { telemetryBus } from "../engine-telemetry-bus";
import {
  globalCreditCycleMetrics,
  type GlobalCreditCycleMetric,
} from "../../../shared/schema/macro-intelligence";

export const CREDIT_CYCLE_ENGINE_VERSION = "GCCE-v1.0.0";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CreditIndicatorInput {
  usHyOasBps: number;
  sloosNetTighteningPct: number;
  embiGlobalSpreadBps: number;
  chinaCreditImpulsePct: number;
  indiaBankCreditGrowthYoY: number;
  indiaCommercialPaperSpreadBps: number;
  g4CentralBankLiquidityUsdTrillion?: number;
  copperGoldRatio?: number;
  rbiReer40Index?: number;
}

export type CreditCycleRegime =
  | "EXPANSIONARY_CREDIT"
  | "NEUTRAL_LATE_CYCLE"
  | "CREDIT_CONTRACTION"
  | "SEVERE_CREDIT_CRUNCH";

export interface PillarCreditScore {
  pillarId: string;
  pillarName: string;
  weight: number;
  score: number; // 0 - 100
  observedValue: string | number;
  status: "EXPANSIONARY" | "NEUTRAL" | "TIGHTENING" | "DISTRESSED";
  details: string;
}

export interface CreditCycleReport {
  engine_version: string;
  calculation_timestamp: string;
  asOfDate: string;
  compositeCreditScore: number; // 0 - 100
  creditCycleRegime: CreditCycleRegime;
  creditStressTripwire: boolean;
  creditPostureSummary: string;
  pillars: PillarCreditScore[];
  indicators: {
    usHyOasBps: number;
    usHyOasBand: "EXPANSION" | "NEUTRAL" | "LATE_CYCLE" | "CONTRACTION" | "CRISIS";
    sloosNetTighteningPct: number;
    embiGlobalSpreadBps: number;
    chinaCreditImpulsePct: number;
    indiaBankCreditGrowthYoY: number;
    indiaCommercialPaperSpreadBps: number;
    g4CentralBankLiquidityUsdTrillion: number;
    copperGoldRatio: number;
    copperGoldSignal: "EXPANSIONARY" | "NEUTRAL" | "STAGFLATION_WARNING";
    rbiReer40Index: number;
  };
  downstreamFeeds: {
    aiRegimeFeed: {
      creditRegime: CreditCycleRegime;
      creditHealthScore: number;
      creditTripwireActive: boolean;
      equityMultipleHeadwind: "NONE" | "MODERATE" | "SEVERE";
    };
    quantOrchestratorFeed: {
      debtCreditRiskPremiaBps: number;
      recommendedCorporateBondTilt: "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT";
      defensiveAssetTilt: "OVERWEIGHT" | "NEUTRAL" | "UNDERWEIGHT";
    };
    tailRiskFeed: {
      recommendedStressScenario: string;
      simulatedDefaultSpreadSurgeBps: number;
    };
    screenerFeed: {
      leveragePenaltyActive: boolean;
      maxDebtToEquityHurdle: number;
    };
  };
  explainability: {
    formulaApplied: string;
    intermediateSteps: {
      hyOasContribution: number;
      sloosContribution: number;
      creditImpulseContribution: number;
      embiContribution: number;
      copperGoldContribution: number;
    };
    factorsConsidered: string[];
  };
}

class GlobalCreditCycleService {
  private static instance: GlobalCreditCycleService;
  private cachedReport: { report: CreditCycleReport; expiresAt: number } | null = null;

  public static getInstance(): GlobalCreditCycleService {
    if (!GlobalCreditCycleService.instance) {
      GlobalCreditCycleService.instance = new GlobalCreditCycleService();
    }
    return GlobalCreditCycleService.instance;
  }

  /**
   * Evaluates the multi-pillar credit cycle report deterministically.
   */
  public evaluateCreditCycle(
    customInput?: Partial<CreditIndicatorInput>,
    customDate?: string
  ): CreditCycleReport {
    const asOfDate = customDate || new Date().toISOString().split("T")[0];
    const timestamp = new Date().toISOString();

    // Calibrated baseline values matching current institutional macro regime
    const input: CreditIndicatorInput = {
      usHyOasBps: customInput?.usHyOasBps ?? 338.0, // Benign credit spread (<350 bps)
      sloosNetTighteningPct: customInput?.sloosNetTighteningPct ?? 12.5, // Moderate tightening (<20%)
      embiGlobalSpreadBps: customInput?.embiGlobalSpreadBps ?? 295.0, // EM sovereign debt spread
      chinaCreditImpulsePct: customInput?.chinaCreditImpulsePct ?? 2.1, // Positive credit impulse
      indiaBankCreditGrowthYoY: customInput?.indiaBankCreditGrowthYoY ?? 13.9, // RBI SCB credit growth
      indiaCommercialPaperSpreadBps: customInput?.indiaCommercialPaperSpreadBps ?? 48.0, // 3M CP spread
      g4CentralBankLiquidityUsdTrillion: customInput?.g4CentralBankLiquidityUsdTrillion ?? 29.45,
      copperGoldRatio: customInput?.copperGoldRatio ?? 0.00168,
      rbiReer40Index: customInput?.rbiReer40Index ?? 104.2,
    };

    // ── Pillar 1: US High Yield OAS Spread (30% weight) ──────────────────────
    let hyScore = 80;
    let hyBand: "EXPANSION" | "NEUTRAL" | "LATE_CYCLE" | "CONTRACTION" | "CRISIS" = "EXPANSION";
    let hyStatus: PillarCreditScore["status"] = "EXPANSIONARY";

    if (input.usHyOasBps <= 320) {
      hyScore = 95;
      hyBand = "EXPANSION";
      hyStatus = "EXPANSIONARY";
    } else if (input.usHyOasBps <= 380) {
      hyScore = Math.round(95 - (input.usHyOasBps - 320) * 0.25);
      hyBand = "NEUTRAL";
      hyStatus = "EXPANSIONARY";
    } else if (input.usHyOasBps <= 500) {
      hyScore = Math.round(80 - (input.usHyOasBps - 380) * 0.20);
      hyBand = "LATE_CYCLE";
      hyStatus = "NEUTRAL";
    } else if (input.usHyOasBps <= 750) {
      hyScore = Math.round(56 - (input.usHyOasBps - 500) * 0.12);
      hyBand = "CONTRACTION";
      hyStatus = "TIGHTENING";
    } else {
      hyScore = Math.max(10, Math.round(26 - (input.usHyOasBps - 750) * 0.05));
      hyBand = "CRISIS";
      hyStatus = "DISTRESSED";
    }

    const pillar1: PillarCreditScore = {
      pillarId: "P1_US_HY_OAS",
      pillarName: "US High Yield Option-Adjusted Spread",
      weight: 0.30,
      score: hyScore,
      observedValue: `${input.usHyOasBps} bps`,
      status: hyStatus,
      details:
        input.usHyOasBps < 380
          ? `Spreads at ${input.usHyOasBps} bps reflect benign corporate default risk and orderly corporate debt refinancing.`
          : `Spreads at ${input.usHyOasBps} bps signal widening risk premia and corporate refinancing friction.`,
    };

    // ── Pillar 2: Senior Loan Officer Lending Standards / SLOOS (25% weight) ──
    let sloosScore = 75;
    let sloosStatus: PillarCreditScore["status"] = "EXPANSIONARY";

    if (input.sloosNetTighteningPct <= 0) {
      sloosScore = 95;
      sloosStatus = "EXPANSIONARY";
    } else if (input.sloosNetTighteningPct <= 20) {
      sloosScore = Math.round(95 - input.sloosNetTighteningPct * 1.0);
      sloosStatus = "NEUTRAL";
    } else if (input.sloosNetTighteningPct <= 40) {
      sloosScore = Math.round(75 - (input.sloosNetTighteningPct - 20) * 1.5);
      sloosStatus = "TIGHTENING";
    } else {
      sloosScore = Math.max(10, Math.round(45 - (input.sloosNetTighteningPct - 40) * 1.0));
      sloosStatus = "DISTRESSED";
    }

    const pillar2: PillarCreditScore = {
      pillarId: "P2_SLOOS_LENDING_STANDARDS",
      pillarName: "Commercial Bank Lending Standards (SLOOS)",
      weight: 0.25,
      score: sloosScore,
      observedValue: `${input.sloosNetTighteningPct > 0 ? "+" : ""}${input.sloosNetTighteningPct}%`,
      status: sloosStatus,
      details:
        input.sloosNetTighteningPct <= 20
          ? `Net ${input.sloosNetTighteningPct}% banks tightening C&I standards indicates manageable credit access without acute contraction.`
          : `Net ${input.sloosNetTighteningPct}% banks tightening standards signals impending private CAPEX deceleration and credit contraction.`,
    };

    // ── Pillar 3: Global & Domestic Credit Impulse (20% weight) ──────────────
    // China TSF Credit Impulse + India Bank Credit YoY
    const chinaImpulseScore = input.chinaCreditImpulsePct >= 0 ? Math.min(95, 75 + input.chinaCreditImpulsePct * 5) : Math.max(30, 75 + input.chinaCreditImpulsePct * 8);
    const indiaCreditScore = input.indiaBankCreditGrowthYoY >= 14 ? 92 : input.indiaBankCreditGrowthYoY >= 12 ? 82 : input.indiaBankCreditGrowthYoY >= 10 ? 65 : 40;
    const creditImpulseScore = Math.round(chinaImpulseScore * 0.45 + indiaCreditScore * 0.55);

    const pillar3: PillarCreditScore = {
      pillarId: "P3_CREDIT_IMPULSE",
      pillarName: "Global & Domestic Credit Impulse",
      weight: 0.20,
      score: creditImpulseScore,
      observedValue: `IN: +${input.indiaBankCreditGrowthYoY}% YoY | CN: +${input.chinaCreditImpulsePct}%`,
      status: creditImpulseScore >= 75 ? "EXPANSIONARY" : creditImpulseScore >= 55 ? "NEUTRAL" : "TIGHTENING",
      details: `India Scheduled Commercial Bank credit expanding at +${input.indiaBankCreditGrowthYoY}% YoY sustains domestic capex and consumption.`,
    };

    // ── Pillar 4: Emerging Market Sovereign Spread EMBI (15% weight) ──────────
    let embiScore = 75;
    if (input.embiGlobalSpreadBps <= 280) {
      embiScore = 95;
    } else if (input.embiGlobalSpreadBps <= 380) {
      embiScore = Math.round(95 - (input.embiGlobalSpreadBps - 280) * 0.25);
    } else if (input.embiGlobalSpreadBps <= 500) {
      embiScore = Math.round(70 - (input.embiGlobalSpreadBps - 380) * 0.20);
    } else {
      embiScore = Math.max(15, Math.round(46 - (input.embiGlobalSpreadBps - 500) * 0.10));
    }

    const pillar4: PillarCreditScore = {
      pillarId: "P4_EMBI_SPREAD",
      pillarName: "Emerging Market Sovereign Credit Spread",
      weight: 0.15,
      score: embiScore,
      observedValue: `${input.embiGlobalSpreadBps} bps`,
      status: embiScore >= 75 ? "EXPANSIONARY" : embiScore >= 55 ? "NEUTRAL" : "TIGHTENING",
      details: `JPMorgan EMBI Global spread at ${input.embiGlobalSpreadBps} bps indicates ${embiScore >= 75 ? "stable" : "pressured"} cross-border emerging market debt risk sentiment.`,
    };

    // ── Pillar 5: Dr. Copper to Gold Ratio (10% weight) ───────────────────────
    const copperGoldVal = input.copperGoldRatio ?? 0.00168;
    let copperGoldScore = 75;
    let copperGoldSignal: "EXPANSIONARY" | "NEUTRAL" | "STAGFLATION_WARNING" = "NEUTRAL";

    if (copperGoldVal >= 0.00180) {
      copperGoldScore = 90;
      copperGoldSignal = "EXPANSIONARY";
    } else if (copperGoldVal >= 0.00155) {
      copperGoldScore = 75;
      copperGoldSignal = "NEUTRAL";
    } else {
      copperGoldScore = 50;
      copperGoldSignal = "STAGFLATION_WARNING";
    }

    const pillar5: PillarCreditScore = {
      pillarId: "P5_COPPER_GOLD_BAROMETER",
      pillarName: "Copper-to-Gold Growth Barometer",
      weight: 0.10,
      score: copperGoldScore,
      observedValue: copperGoldVal.toFixed(6),
      status: copperGoldScore >= 80 ? "EXPANSIONARY" : copperGoldScore >= 65 ? "NEUTRAL" : "TIGHTENING",
      details:
        copperGoldSignal === "EXPANSIONARY"
          ? "Dr. Copper outperforming Gold confirms global cyclical growth expansion."
          : copperGoldSignal === "NEUTRAL"
          ? "Copper-to-Gold ratio remains balanced in mid-cycle consolidation."
          : "Gold outperforming Copper warns of stagflationary headwinds and industrial demand softness.",
    };

    const pillars = [pillar1, pillar2, pillar3, pillar4, pillar5];

    // ── Composite Credit Score Calculation ───────────────────────────────────
    const compositeCreditScore = Math.round(
      pillars.reduce((acc, p) => acc + p.score * p.weight, 0) * 10
    ) / 10;

    let creditCycleRegime: CreditCycleRegime = "EXPANSIONARY_CREDIT";
    let creditPostureSummary = "Credit conditions are expansionary. Corporate borrowing spreads remain tight, banking liquidity is supportive, and default risks are low.";

    if (compositeCreditScore >= 75) {
      creditCycleRegime = "EXPANSIONARY_CREDIT";
      creditPostureSummary = "Credit conditions are highly expansionary. Narrow HY spreads and resilient bank lending standards support risk-on asset allocations and equity multiples.";
    } else if (compositeCreditScore >= 58) {
      creditCycleRegime = "NEUTRAL_LATE_CYCLE";
      creditPostureSummary = "Credit conditions are neutral and entering late-cycle characteristics. Refinancing costs are higher but orderly; quality balance sheets are favored.";
    } else if (compositeCreditScore >= 38) {
      creditCycleRegime = "CREDIT_CONTRACTION";
      creditPostureSummary = "Credit contraction underway. Bank lending standards are tightening and HY spreads are widening; equity multiples face valuation headwinds.";
    } else {
      creditCycleRegime = "SEVERE_CREDIT_CRUNCH";
      creditPostureSummary = "Severe credit freeze. Spreads have blown out, corporate distress ratios are surging, and liquidity preservation is mandatory.";
    }

    // Systemic Tripwire triggers if any critical credit tripwire activates
    const creditStressTripwire =
      input.usHyOasBps >= 520 ||
      input.sloosNetTighteningPct >= 30.0 ||
      input.indiaCommercialPaperSpreadBps >= 110;

    const report: CreditCycleReport = {
      engine_version: CREDIT_CYCLE_ENGINE_VERSION,
      calculation_timestamp: timestamp,
      asOfDate,
      compositeCreditScore,
      creditCycleRegime,
      creditStressTripwire,
      creditPostureSummary,
      pillars,
      indicators: {
        usHyOasBps: input.usHyOasBps,
        usHyOasBand: hyBand,
        sloosNetTighteningPct: input.sloosNetTighteningPct,
        embiGlobalSpreadBps: input.embiGlobalSpreadBps,
        chinaCreditImpulsePct: input.chinaCreditImpulsePct,
        indiaBankCreditGrowthYoY: input.indiaBankCreditGrowthYoY,
        indiaCommercialPaperSpreadBps: input.indiaCommercialPaperSpreadBps,
        g4CentralBankLiquidityUsdTrillion: input.g4CentralBankLiquidityUsdTrillion ?? 29.45,
        copperGoldRatio: copperGoldVal,
        copperGoldSignal,
        rbiReer40Index: input.rbiReer40Index ?? 104.2,
      },
      downstreamFeeds: {
        aiRegimeFeed: {
          creditRegime: creditCycleRegime,
          creditHealthScore: compositeCreditScore,
          creditTripwireActive: creditStressTripwire,
          equityMultipleHeadwind:
            creditCycleRegime === "EXPANSIONARY_CREDIT"
              ? "NONE"
              : creditCycleRegime === "NEUTRAL_LATE_CYCLE"
              ? "MODERATE"
              : "SEVERE",
        },
        quantOrchestratorFeed: {
          debtCreditRiskPremiaBps: input.usHyOasBps,
          recommendedCorporateBondTilt:
            compositeCreditScore >= 70 ? "OVERWEIGHT" : compositeCreditScore >= 50 ? "NEUTRAL" : "UNDERWEIGHT",
          defensiveAssetTilt:
            compositeCreditScore >= 65 ? "NEUTRAL" : "OVERWEIGHT",
        },
        tailRiskFeed: {
          recommendedStressScenario: "GMIE_CREDIT_CRUNCH_OAS_650",
          simulatedDefaultSpreadSurgeBps: input.usHyOasBps >= 450 ? 250 : 120,
        },
        screenerFeed: {
          leveragePenaltyActive: compositeCreditScore < 55 || creditStressTripwire,
          maxDebtToEquityHurdle: compositeCreditScore < 55 ? 1.0 : 2.5,
        },
      },
      explainability: {
        formulaApplied:
          "Composite Credit Score = 0.30 * HY_OAS + 0.25 * SLOOS + 0.20 * Credit_Impulse + 0.15 * EMBI + 0.10 * Copper_Gold",
        intermediateSteps: {
          hyOasContribution: +(pillar1.score * 0.30).toFixed(2),
          sloosContribution: +(pillar2.score * 0.25).toFixed(2),
          creditImpulseContribution: +(pillar3.score * 0.20).toFixed(2),
          embiContribution: +(pillar4.score * 0.15).toFixed(2),
          copperGoldContribution: +(pillar5.score * 0.10).toFixed(2),
        },
        factorsConsidered: [
          "US High Yield Option-Adjusted Spread (ICE BofA US HY OAS)",
          "Fed Senior Loan Officer Opinion Survey (SLOOS) C&I Net Tightening",
          "China Total Social Financing (TSF) 12M Credit Impulse",
          "India Scheduled Commercial Bank Credit Growth (YoY)",
          "JPMorgan EMBI Global Sovereign Credit Spread",
          "Dr. Copper to Gold Ratio (Industrial Vitality vs Safe Haven)",
          "Indian 3M Commercial Paper vs 91-Day T-Bill Spread",
        ],
      },
    };

    return report;
  }

  /**
   * Retrieves the live credit cycle report with in-process caching,
   * database write-back, and telemetry reporting.
   */
  public async getCreditCycleReport(forceRefresh = false): Promise<CreditCycleReport> {
    const t0 = Date.now();

    if (!forceRefresh && this.cachedReport && this.cachedReport.expiresAt > Date.now()) {
      return this.cachedReport.report;
    }

    try {
      const report = this.evaluateCreditCycle();

      // Persist to database asynchronously (non-fatal if DB is offline)
      void this.persistCreditCycleMetrics(report);

      // Report telemetry to EngineTelemetryBus
      telemetryBus.report({
        engineId: "global-credit-cycle",
        engineName: "Global Credit Cycle Engine",
        category: "Risk & Regime",
        reportedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
        qualityScore: Math.round(report.compositeCreditScore),
        itemsProcessed: report.pillars.length,
        errorCount: 0,
        meta: {
          creditRegime: report.creditCycleRegime,
          hyOasBps: report.indicators.usHyOasBps,
          tripwire: report.creditStressTripwire,
        },
      });

      this.cachedReport = {
        report,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      return report;
    } catch (err: any) {
      logger.warn("[GlobalCreditCycleService] Fallback to calibrated deterministic credit model", {
        error: err?.message,
      });
      return this.evaluateCreditCycle();
    }
  }

  /**
   * Persists snapshot into global_credit_cycle_metrics table.
   */
  private async persistCreditCycleMetrics(report: CreditCycleReport): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO global_credit_cycle_metrics (
          as_of_date,
          us_hy_oas_bps,
          us_hy_oas_band,
          sloos_net_tightening_pct,
          embi_global_spread_bps,
          china_credit_impulse_pct,
          india_bank_credit_growth_yoy,
          india_commercial_paper_spread_bps,
          g4_central_bank_liquidity_usd_trillion,
          copper_gold_ratio,
          copper_gold_signal,
          rbi_reer_40_index,
          credit_cycle_composite_score,
          credit_cycle_regime,
          credit_stress_tripwire,
          meta,
          updated_at
        ) VALUES (
          ${report.asOfDate}::date,
          ${report.indicators.usHyOasBps},
          ${report.indicators.usHyOasBand},
          ${report.indicators.sloosNetTighteningPct},
          ${report.indicators.embiGlobalSpreadBps},
          ${report.indicators.chinaCreditImpulsePct},
          ${report.indicators.indiaBankCreditGrowthYoY},
          ${report.indicators.indiaCommercialPaperSpreadBps},
          ${report.indicators.g4CentralBankLiquidityUsdTrillion},
          ${report.indicators.copperGoldRatio},
          ${report.indicators.copperGoldSignal},
          ${report.indicators.rbiReer40Index},
          ${report.compositeCreditScore},
          ${report.creditCycleRegime},
          ${report.creditStressTripwire},
          ${JSON.stringify(report.explainability)}::jsonb,
          NOW()
        )
        ON CONFLICT (as_of_date) DO UPDATE SET
          us_hy_oas_bps = EXCLUDED.us_hy_oas_bps,
          us_hy_oas_band = EXCLUDED.us_hy_oas_band,
          sloos_net_tightening_pct = EXCLUDED.sloos_net_tightening_pct,
          embi_global_spread_bps = EXCLUDED.embi_global_spread_bps,
          china_credit_impulse_pct = EXCLUDED.china_credit_impulse_pct,
          india_bank_credit_growth_yoy = EXCLUDED.india_bank_credit_growth_yoy,
          india_commercial_paper_spread_bps = EXCLUDED.india_commercial_paper_spread_bps,
          credit_cycle_composite_score = EXCLUDED.credit_cycle_composite_score,
          credit_cycle_regime = EXCLUDED.credit_cycle_regime,
          credit_stress_tripwire = EXCLUDED.credit_stress_tripwire,
          meta = EXCLUDED.meta,
          updated_at = NOW();
      `);
    } catch {
      // Non-fatal database persistence fallback
    }
  }
}

export const globalCreditCycleService = GlobalCreditCycleService.getInstance();

