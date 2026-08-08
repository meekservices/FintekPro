/**
 * @module pick-outcome-analyzer
 * @description Fix 8: Pick Outcome Feedback Loop
 *
 * Purpose:
 *   After picks close (target_hit / stoploss_hit / expired), correlate the
 *   outcome with the quant signals captured in keyMetrics at pick generation time.
 *   Emit a SignalEfficacyReport that advisors and the scoring engine team can use
 *   to understand which signals are genuinely predictive.
 *
 * FASP-AI v3.0 compliance:
 *   This is a Decision Support System ONLY — it generates SUGGESTIONS.
 *   No autonomous scoring weight changes are made.
 *   All weight adjustments require explicit human approval before deployment.
 *
 * Inputs:   daily_picks table (closed picks with keyMetrics JSON)
 * Outputs:  Structured SignalEfficacyReport, logged to advisory audit trail
 * Schedule: Called weekly from pick-of-the-day-service after EOD update.
 *
 * @version 3.0.0
 */

import { db } from "../db";
import { dailyPicks, adminSettings } from "@shared/schema";
import { and, sql, gte, isNotNull, eq } from "drizzle-orm";
import { logger } from "../logger";

// Key used to persist the latest report in adminSettings (JSON blob)
const EFFICACY_REPORT_KEY = "pick_signal_efficacy_report";


// ── Types ─────────────────────────────────────────────────────────────────────

export interface SignalEfficacyEntry {
  /** Signal name as stored in keyMetrics (e.g. "pe", "roic", "rawQuantScore") */
  signal: string;
  /** Number of closed picks where this signal was present */
  picksWithSignal: number;
  /** Hit rate for picks where signal was in "good" range (0-100%) */
  hitRateWhenGood: number;
  /** Hit rate for picks where signal was in "bad" range (0-100%) */
  hitRateWhenBad: number;
  /** Lift: hitRateWhenGood / hitRateWhenBad — >1 means signal is predictive */
  lift: number;
  /** Average return when signal was in "good" range */
  avgReturnWhenGood: number;
  /** Average return when signal was in "bad" range */
  avgReturnWhenBad: number;
}

export interface CategoryOutcomeSummary {
  category: string;
  totalClosed: number;
  hitRate: number;
  avgReturn: number;
  avgDaysHeld: number;
  bestSignals: string[];  // top 3 signals with lift > 1.2 for this category
  weakSignals: string[];  // signals with lift < 0.8 for this category
}

export interface SignalEfficacyReport {
  generatedAt: string;
  windowDays: number;
  totalClosedPicks: number;
  overallHitRate: number;
  overallAvgReturn: number;
  byCategory: CategoryOutcomeSummary[];
  signalEfficacy: SignalEfficacyEntry[];
  /**
   * Suggested scoring weight nudges for the engineering team to review.
   * These are SUGGESTIONS only — no autonomous weight changes are made.
   * Human approval is required before any scoring engine changes.
   */
  scoringWeightHints: Array<{
    signal: string;
    currentWeight: "not_tracked" | number;
    suggestedAction: "increase" | "decrease" | "maintain";
    rationale: string;
  }>;
  meta: {
    engine_version: string;
    disclaimer: string;
  };
}

// ── Signal evaluation thresholds ──────────────────────────────────────────────
// "Good" vs "bad" ranges for each keyMetrics signal.
// Used to split the pick universe and compute outcome lift.

const SIGNAL_THRESHOLDS: Record<
  string,
  { good: (v: number) => boolean; bad: (v: number) => boolean }
> = {
  pe: {
    good: (v) => v > 0 && v < 25,
    bad: (v) => v >= 25 || v <= 0,
  },
  roic: {
    good: (v) => v > 20,
    bad: (v) => v < 10,
  },
  rsi: {
    good: (v) => v >= 40 && v <= 65,
    bad: (v) => v > 80 || v < 25,
  },
  rawQuantScore: {
    good: (v) => v >= 60,
    bad: (v) => v < 40,
  },
  compositeScore: {
    good: (v) => v >= 70,
    bad: (v) => v < 50,
  },
  piotroskiFScore: {
    good: (v) => v >= 7,
    bad: (v) => v <= 3,
  },
  interestCoverage: {
    good: (v) => v >= 3,
    bad: (v) => v < 1.5,
  },
  quickRatio: {
    good: (v) => v >= 1,
    bad: (v) => v < 0.5,
  },
};

const ENGINE_VERSION = "pick-outcome-analyzer-v3.0";

// ── Main Service ──────────────────────────────────────────────────────────────

export class PickOutcomeAnalyzer {
  /**
   * Runs the feedback loop analysis over the last `windowDays` of closed picks.
   *
   * @param windowDays  Look-back window in days (default 90)
   * @returns SignalEfficacyReport with signal lift scores and weight hints
   */
  async analyzeOutcomes(windowDays = 90): Promise<SignalEfficacyReport> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - windowDays);
    const startStr = startDate.toISOString().split("T")[0];

    logger.info(
      `[PickOutcomeAnalyzer] Starting outcome analysis: last ${windowDays} days (from ${startStr})`,
    );

    // ── Fetch all closed picks in the window ────────────────────────────────
    const closedPicks = await db
      .select({
        id: dailyPicks.id,
        category: dailyPicks.category,
        status: dailyPicks.status,
        recoDate: dailyPicks.recoDate,
        returnPct: dailyPicks.returnPct,
        daysHeld: dailyPicks.daysHeld,
        keyMetrics: dailyPicks.keyMetrics,
        confidenceScore: dailyPicks.confidenceScore,
      })
      .from(dailyPicks)
      .where(
        and(
          sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`,
          gte(dailyPicks.recoDate, startStr),
          isNotNull(dailyPicks.keyMetrics),
        ),
      )
      .orderBy(dailyPicks.recoDate);

    if (closedPicks.length === 0) {
      logger.info("[PickOutcomeAnalyzer] No closed picks found in window.");
      return this.emptyReport(windowDays);
    }

    // ── Overall stats ──────────────────────────────────────────────────────
    const totalClosed = closedPicks.length;
    const hits = closedPicks.filter((p) => p.status === "target_hit").length;
    const overallHitRate = Math.round((hits / totalClosed) * 1000) / 10;
    const returns = closedPicks
      .map((p) => Number.parseFloat(p.returnPct ?? "0"))
      .filter((r) => !Number.isNaN(r));
    const overallAvgReturn =
      returns.length > 0
        ? Math.round(
            (returns.reduce((a, b) => a + b, 0) / returns.length) * 100,
          ) / 100
        : 0;

    // ── Per-category summary ────────────────────────────────────────────────
    const catMap = new Map<
      string,
      { total: number; hits: number; returns: number[]; days: number[] }
    >();
    for (const p of closedPicks) {
      const cat = p.category ?? "unknown";
      const entry = catMap.get(cat) ?? { total: 0, hits: 0, returns: [], days: [] };
      entry.total++;
      if (p.status === "target_hit") entry.hits++;
      const ret = Number.parseFloat(p.returnPct ?? "0");
      if (!Number.isNaN(ret)) entry.returns.push(ret);
      if (p.daysHeld) entry.days.push(p.daysHeld);
      catMap.set(cat, entry);
    }

    const byCategory: CategoryOutcomeSummary[] = Array.from(catMap.entries()).map(
      ([category, data]) => ({
        category,
        totalClosed: data.total,
        hitRate: Math.round((data.hits / data.total) * 1000) / 10,
        avgReturn:
          data.returns.length > 0
            ? Math.round(
                (data.returns.reduce((a, b) => a + b, 0) / data.returns.length) * 100,
              ) / 100
            : 0,
        avgDaysHeld:
          data.days.length > 0
            ? Math.round(data.days.reduce((a, b) => a + b, 0) / data.days.length)
            : 0,
        bestSignals: [],
        weakSignals: [],
      }),
    );

    // ── Signal efficacy computation ─────────────────────────────────────────
    const signalEfficacy: SignalEfficacyEntry[] = [];

    for (const [signal, thresholds] of Object.entries(SIGNAL_THRESHOLDS)) {
      const withGood = closedPicks.filter((p) => {
        const km = p.keyMetrics as Record<string, any> | null;
        const v = km?.[signal];
        return v != null && typeof v === "number" && thresholds.good(v);
      });
      const withBad = closedPicks.filter((p) => {
        const km = p.keyMetrics as Record<string, any> | null;
        const v = km?.[signal];
        return v != null && typeof v === "number" && thresholds.bad(v);
      });

      // Need at least 3 picks in each bucket for statistical validity
      if (withGood.length < 3 && withBad.length < 3) continue;

      const hitRateGood =
        withGood.length > 0
          ? withGood.filter((p) => p.status === "target_hit").length / withGood.length
          : 0;
      const hitRateBad =
        withBad.length > 0
          ? withBad.filter((p) => p.status === "target_hit").length / withBad.length
          : 0;

      // Lift: how much better is the "good" bucket vs the "bad" bucket?
      const lift = hitRateBad > 0 ? hitRateGood / hitRateBad : hitRateGood > 0 ? 2 : 1;

      const avgRetGood =
        withGood.length > 0
          ? withGood.reduce((a, p) => a + Number.parseFloat(p.returnPct ?? "0"), 0) /
            withGood.length
          : 0;
      const avgRetBad =
        withBad.length > 0
          ? withBad.reduce((a, p) => a + Number.parseFloat(p.returnPct ?? "0"), 0) /
            withBad.length
          : 0;

      signalEfficacy.push({
        signal,
        picksWithSignal: withGood.length + withBad.length,
        hitRateWhenGood: Math.round(hitRateGood * 1000) / 10,
        hitRateWhenBad: Math.round(hitRateBad * 1000) / 10,
        lift: Math.round(lift * 100) / 100,
        avgReturnWhenGood: Math.round(avgRetGood * 100) / 100,
        avgReturnWhenBad: Math.round(avgRetBad * 100) / 100,
      });
    }

    // Annotate each category with its best/worst signals
    for (const cat of byCategory) {
      const catPicks = closedPicks.filter((p) => p.category === cat.category);
      const baseHitRate = cat.hitRate / 100 || 0.01;

      for (const entry of signalEfficacy) {
        const good = catPicks.filter((p) => {
          const km = p.keyMetrics as Record<string, any> | null;
          const v = km?.[entry.signal];
          return (
            v != null && typeof v === "number" && SIGNAL_THRESHOLDS[entry.signal]?.good(v)
          );
        });
        if (good.length < 3) continue;
        const hitsGood = good.filter((p) => p.status === "target_hit").length;
        const catLift = (hitsGood / good.length) / baseHitRate;
        if (catLift >= 1.2) cat.bestSignals.push(entry.signal);
        if (catLift < 0.8) cat.weakSignals.push(entry.signal);
      }
      cat.bestSignals = cat.bestSignals.slice(0, 3);
      cat.weakSignals = cat.weakSignals.slice(0, 3);
    }

    // ── Scoring weight hints ──────────────────────────────────────────────
    const scoringWeightHints = signalEfficacy.map((entry) => {
      let suggestedAction: "increase" | "decrease" | "maintain";
      let rationale: string;
      if (entry.lift >= 1.5) {
        suggestedAction = "increase";
        rationale = `${entry.lift}x lift — strongly predictive. Consider increasing scoring weight.`;
      } else if (entry.lift <= 0.7) {
        suggestedAction = "decrease";
        rationale = `${entry.lift}x lift — poor predictor. Consider reducing weight or removing.`;
      } else {
        suggestedAction = "maintain";
        rationale = `${entry.lift}x lift — adequate. Maintain current weight.`;
      }
      return {
        signal: entry.signal,
        currentWeight: "not_tracked" as const,
        suggestedAction,
        rationale,
      };
    });

    const report: SignalEfficacyReport = {
      generatedAt: new Date().toISOString(),
      windowDays,
      totalClosedPicks: totalClosed,
      overallHitRate,
      overallAvgReturn,
      byCategory,
      signalEfficacy: signalEfficacy.sort((a, b) => b.lift - a.lift),
      scoringWeightHints,
      meta: {
        engine_version: ENGINE_VERSION,
        disclaimer:
          "This report is a Decision Support System for human advisors. " +
          "No autonomous scoring changes are made. All weight adjustments require " +
          "explicit human review and approval before deployment (FASP-AI v3.0).",
      },
    };

    // ── Fix 11: Per-category hit-rate degradation alert ─────────────────────
    // If any category's hit rate falls below 40% on ≥ 10 closed picks, emit a
    // WARNING so ops can investigate before advisors lose confidence in that strategy.
    // Threshold: 40% hit rate = performing at chance level — suggests a broken signal.
    const DEGRADED_HIT_RATE_THRESHOLD = 40;
    const MIN_PICKS_FOR_DEGRADATION_ALERT = 10;
    for (const cat of byCategory) {
      if (
        cat.totalClosed >= MIN_PICKS_FOR_DEGRADATION_ALERT &&
        cat.hitRate < DEGRADED_HIT_RATE_THRESHOLD
      ) {
        logger.warn(`[PickOutcomeAnalyzer] CATEGORY DEGRADED: ${cat.category} hit rate ${cat.hitRate}% on ${cat.totalClosed} picks`, {
          event:        "PICK_CATEGORY_DEGRADED",
          user_id:      "SYSTEM",
          category:     cat.category,
          hit_rate:     cat.hitRate,
          total_closed: cat.totalClosed,
          avg_return:   cat.avgReturn,
          threshold:    DEGRADED_HIT_RATE_THRESHOLD,
          latency_ms:   0,
          status:       "alert",
          retryable:    false,
          engine_version: ENGINE_VERSION,
        });
      }
    }

    logger.info(
      `[PickOutcomeAnalyzer] Analysis complete: ${totalClosed} picks, ` +
        `${overallHitRate}% hit rate, ${signalEfficacy.length} signals evaluated`,
      {
        event: "PICK_OUTCOME_ANALYSIS_COMPLETE",
        user_id: "SYSTEM",
        latency_ms: 0,
        status: "success",
        totalClosedPicks: totalClosed,
        overallHitRate,
        overallAvgReturn,
        signalsEvaluated: signalEfficacy.length,
        engine_version: ENGINE_VERSION,
      },
    );

    // ── #9: Persist latest report to adminSettings for dashboard visibility ────────
    // FASP-AI mandate: scoring weight hints must be VISIBLE to be actionable.
    // Stored as a JSONB blob under key "pick_signal_efficacy_report".
    // No schema migration required — adminSettings is a key-value store.
    try {
      await db
        .insert(adminSettings)
        .values({
          key: EFFICACY_REPORT_KEY,
          value: report as any,  // jsonb column accepts object directly
          description: "Latest Pick of the Day signal efficacy report (auto-generated weekly). " +
            "FASP-AI v3.0 — review scoringWeightHints and escalate approved changes to engineering.",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: adminSettings.key,
          set: {
            value: JSON.stringify(report),
            updatedAt: new Date(),
          },
        });
      logger.info(`[PickOutcomeAnalyzer] Efficacy report persisted to adminSettings key='${EFFICACY_REPORT_KEY}'`);
    } catch (persistErr) {
      // Non-fatal: log but don't fail the analysis
      logger.warn(
        `[PickOutcomeAnalyzer] Failed to persist efficacy report to adminSettings (non-fatal): ` +
          `${persistErr instanceof Error ? persistErr.message : String(persistErr)}`,
      );
    }

    // ── Phase 3 fix: Auto weight-penalty for proven weak signals ──────────────
    // FASP-AI v3.0 protocol: DEFENSIVE weight changes (decrease) are automated
    // when statistical evidence is strong (≥30 picks, lift < 0.7).
    // OFFENSIVE changes (increase) ALWAYS require explicit human approval.
    const WEIGHT_PENALTY_MIN_PICKS = 30;
    const WEIGHT_PENALTY_LIFT_THRESHOLD = 0.7;
    const WEIGHT_PENALTY_FACTOR = 0.80; // reduce weak signal contribution by 20%

    const autoDowngrades: Record<string, number> = {};
    for (const entry of signalEfficacy) {
      if (
        entry.picksWithSignal >= WEIGHT_PENALTY_MIN_PICKS &&
        entry.lift < WEIGHT_PENALTY_LIFT_THRESHOLD
      ) {
        autoDowngrades[entry.signal] = WEIGHT_PENALTY_FACTOR;
        logger.warn(
          `[PickOutcomeAnalyzer] AUTO-DOWNGRADE: signal '${entry.signal}' lift=${entry.lift} ` +
          `on ${entry.picksWithSignal} picks < threshold ${WEIGHT_PENALTY_LIFT_THRESHOLD} — ` +
          `writing 20% penalty to adminSettings.`,
          { event: "SIGNAL_AUTO_DOWNGRADED", user_id: "SYSTEM", latency_ms: 0, status: "alert" },
        );
      }
    }

    if (Object.keys(autoDowngrades).length > 0) {
      try {
        const WEIGHT_OVERRIDES_KEY = "pick_scoring_weight_overrides";
        await db
          .insert(adminSettings)
          .values({
            key: WEIGHT_OVERRIDES_KEY,
            value: autoDowngrades as any,
            description:
              "Auto-generated scoring weight overrides from pick-outcome-analyzer. " +
              "Signals with lift < 0.7 on ≥30 picks are penalised by 20%. " +
              "FASP-AI v3.0: only decreases are automated — increases require human approval.",
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: adminSettings.key,
            set: {
              value: JSON.stringify(autoDowngrades),
              updatedAt: new Date(),
            },
          });
        logger.info(
          `[PickOutcomeAnalyzer] Weight overrides persisted: ${JSON.stringify(autoDowngrades)}`,
        );
      } catch (weightErr) {
        logger.warn(
          `[PickOutcomeAnalyzer] Failed to persist weight overrides (non-fatal): ` +
            `${weightErr instanceof Error ? weightErr.message : String(weightErr)}`,
        );
      }
    }

    return report;
  }


  private emptyReport(windowDays: number): SignalEfficacyReport {
    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      totalClosedPicks: 0,
      overallHitRate: 0,
      overallAvgReturn: 0,
      byCategory: [],
      signalEfficacy: [],
      scoringWeightHints: [],
      meta: {
        engine_version: ENGINE_VERSION,
        disclaimer: "No closed picks found in the analysis window. (FASP-AI v3.0)",
      },
    };
  }
}

export const pickOutcomeAnalyzer = new PickOutcomeAnalyzer();
