/**
 * FASP-AI v2.0 — FintekPro AI Advisory System Protocol, Version 2.0
 *
 * @purpose  Central governance engine for all AI advisory outputs on the FintekPro platform.
 *           Replaces the FASP-AI v1.0 heuristic confidence scorer with a structured,
 *           multi-factor, per-segment system compliant with SEBI advisory guidelines.
 *
 * @capabilities
 *   - Multi-factor weighted confidence scoring (replaces text-length heuristic)
 *   - Per-segment confidence thresholds: retail=60, hni=72, institutional=80
 *   - Full chain-of-thought factor scoring with evidence strings
 *   - Advisor feedback loop: accept / reject / modify tracking
 *   - Portfolio drift detection using IndianAPI live prices
 *   - SEBI circular reference tagging per advisory type
 *   - Immutable advisory output persistence to fasp_advisory_outputs table
 *
 * @version  FASP-AI-v2.0
 * @sebi     SEBI/HO/IMD/2023/P/CIR/0188 (Investment Adviser Regulations)
 *           SEBI/HO/MRD/MRD-PoD-1/P/CIR/2023/107 (AI in Financial Services)
 */

import { db } from "../db";
import { faspAdvisoryOutputs, portfolioDriftAlerts } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserSegment = "retail" | "hni" | "institutional";

export type AdvisoryType =
  | "model_portfolio"
  | "stock_pick"
  | "copilot"
  | "proposal"
  | "portfolio_review"
  | "tax_advisory"
  | "mutual_fund";

export type AdvisorAction = "accepted" | "rejected" | "modified" | "pending";

export interface FactorScore {
  factor: string;
  weight: number;       // 0–1, sum to 1.0
  rawScore: number;     // 0–100
  contribution: number; // weight × rawScore
  evidence: string;     // what drove this score
}

export interface ConfidenceFactors {
  responseLength: number;
  hasStructuredData: boolean;
  factorCount: number;
  userSegment: UserSegment;
  marketVolatility?: "low" | "normal" | "high";
  advisoryType?: AdvisoryType;
  historicalAccuracy?: number; // 0-100, from feedback loop
}

export interface ConfidenceResult {
  score: number;               // 0–100 final score
  breakdown: FactorScore[];    // per-factor scores
  threshold: number;           // segment-specific threshold
  meetsThreshold: boolean;
  humanReviewRequired: boolean;
  downgradedReason?: string;
}

export interface FaspV2Meta {
  model_version: "FASP-AI-v2.0";
  base_model: string;
  engine_version: "fasp-engine-v2.0";
  data_cutoff: string;
  confidence_score: number;
  confidence_breakdown: FactorScore[];
  confidence_threshold: number;
  meets_threshold: boolean;
  human_review_required: boolean;
  downgraded_reason?: string;
  sebi_circular_ref: string;
  calculation_timestamp: string;
}

export interface AdvisoryOutputPayload {
  userId?: string;
  advisorId?: string;
  advisoryType: AdvisoryType;
  inputContext: Record<string, unknown>;
  userSegment: UserSegment;
  recommendation: string;
  outputSnapshot: Record<string, unknown>;
  meta: FaspV2Meta;
}

export interface HoldingForDrift {
  symbol: string;
  targetWeight: number;  // e.g. 12.5 (percent)
  currentPrice?: number; // from IndianAPI if available
  currentUnits?: number; // number of units held
  portfolioValue?: number; // total portfolio value for weight computation
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FASP_V2_VERSION = "FASP-AI-v2.0";
export const FASP_V2_ENGINE = "fasp-engine-v2.0";
export const BASE_MODEL = "gemini-2.5-flash";
export const DATA_CUTOFF = "2025-01";

/** SEBI circular references by advisory type */
const SEBI_CIRCULAR_MAP: Record<AdvisoryType, string> = {
  model_portfolio: "SEBI/HO/IMD/2023/P/CIR/0188",
  stock_pick:      "SEBI/HO/MRD/MRD-PoD-1/P/CIR/2023/107",
  copilot:         "SEBI/HO/IMD/2023/P/CIR/0188",
  proposal:        "SEBI/HO/IMD/2023/P/CIR/0188",
  portfolio_review:"SEBI/HO/IMD/2023/P/CIR/0188",
  tax_advisory:    "SEBI/HO/MRD/MRD-PoD-1/P/CIR/2023/107",
  mutual_fund:     "SEBI/HO/IMD/2023/P/CIR/0188",
};

/** Per-segment confidence thresholds (0–100) */
const SEGMENT_THRESHOLDS: Record<UserSegment, number> = {
  retail:        60,
  hni:           72,
  institutional: 80,
};

/** Factor weights — must sum to 1.0 */
const FACTOR_WEIGHTS = {
  responseCompleteness: 0.20,
  structuredOutput:     0.25,
  factorCoverage:       0.25,
  marketContext:        0.15,
  historicalAccuracy:   0.15,
};

// ─── Core Engine ──────────────────────────────────────────────────────────────

export class FaspAIv2Service {
  /**
   * Derive user segment from investment amount thresholds.
   * >₹50L = HNI; institutional via role.
   *
   * @param investmentAmount Total portfolio / AUM in INR
   * @param roles User's role array
   */
  static deriveSegment(investmentAmount?: number, roles?: string[]): UserSegment {
    if (roles?.some(r => ["institutional", "corporate", "admin", "superadmin"].includes(r))) {
      return "institutional";
    }
    if (investmentAmount && investmentAmount >= 5_000_000) return "hni"; // ₹50L+
    return "retail";
  }

  /**
   * Compute multi-factor weighted confidence score.
   *
   * @param factors Input signals from the AI inference
   * @returns ConfidenceResult with score, breakdown, threshold, and gate decision
   */
  static computeConfidence(factors: ConfidenceFactors): ConfidenceResult {
    const threshold = SEGMENT_THRESHOLDS[factors.userSegment];

    // ── Factor 1: Response Completeness (proxy: length) ──
    const completenessRaw =
      factors.responseLength > 3000 ? 95 :
      factors.responseLength > 1500 ? 85 :
      factors.responseLength > 600  ? 72 :
      factors.responseLength > 200  ? 58 : 40;

    // ── Factor 2: Structured Output ──
    const structureRaw = factors.hasStructuredData ? 90 : 55;

    // ── Factor 3: Factor Coverage ──
    const factorRaw =
      factors.factorCount >= 5 ? 92 :
      factors.factorCount >= 3 ? 78 :
      factors.factorCount >= 1 ? 62 : 40;

    // ── Factor 4: Market Context ──
    const marketRaw =
      factors.marketVolatility === "high"   ? 55 :
      factors.marketVolatility === "normal" ? 80 :
      factors.marketVolatility === "low"    ? 92 : 75; // default: normal

    // ── Factor 5: Historical Accuracy (from feedback loop) ──
    const historyRaw = factors.historicalAccuracy ?? 70; // default 70 until data builds up

    const breakdown: FactorScore[] = [
      {
        factor: "Response Completeness",
        weight: FACTOR_WEIGHTS.responseCompleteness,
        rawScore: completenessRaw,
        contribution: Math.round(FACTOR_WEIGHTS.responseCompleteness * completenessRaw),
        evidence: `Response length: ${factors.responseLength} chars`,
      },
      {
        factor: "Structured Output",
        weight: FACTOR_WEIGHTS.structuredOutput,
        rawScore: structureRaw,
        contribution: Math.round(FACTOR_WEIGHTS.structuredOutput * structureRaw),
        evidence: factors.hasStructuredData ? "JSON structure validated" : "Unstructured text response",
      },
      {
        factor: "Factor Coverage",
        weight: FACTOR_WEIGHTS.factorCoverage,
        rawScore: factorRaw,
        contribution: Math.round(FACTOR_WEIGHTS.factorCoverage * factorRaw),
        evidence: `${factors.factorCount} investment factors analyzed`,
      },
      {
        factor: "Market Context",
        weight: FACTOR_WEIGHTS.marketContext,
        rawScore: marketRaw,
        contribution: Math.round(FACTOR_WEIGHTS.marketContext * marketRaw),
        evidence: `Market volatility: ${factors.marketVolatility ?? "normal"}`,
      },
      {
        factor: "Historical Accuracy",
        weight: FACTOR_WEIGHTS.historicalAccuracy,
        rawScore: historyRaw,
        contribution: Math.round(FACTOR_WEIGHTS.historicalAccuracy * historyRaw),
        evidence: `Feedback-derived accuracy: ${historyRaw}% (${historyRaw === 70 ? "default — no feedback yet" : "from advisor feedback loop"})`,
      },
    ];

    const score = Math.round(breakdown.reduce((sum, f) => sum + f.contribution, 0));
    const meetsThreshold = score >= threshold;
    const humanReviewRequired = !meetsThreshold;
    const downgradedReason = humanReviewRequired
      ? `Confidence ${score}% is below the ${factors.userSegment} segment threshold of ${threshold}%. Human advisor review is required before presenting this recommendation.`
      : undefined;

    return { score, breakdown, threshold, meetsThreshold, humanReviewRequired, downgradedReason };
  }

  /**
   * Apply confidence gate — downgrade recommendation text if below threshold.
   *
   * @param confidence ConfidenceResult from computeConfidence
   * @param recommendation Original AI recommendation text
   */
  static applyConfidenceGate(
    confidence: ConfidenceResult,
    recommendation: string,
  ): { recommendation: string; downgraded: boolean } {
    if (confidence.meetsThreshold) {
      return { recommendation, downgraded: false };
    }
    return {
      recommendation:
        `⚠️ Low Confidence Advisory (${confidence.score}% < ${confidence.threshold}% threshold): ` +
        `This recommendation requires review by a registered investment advisor before acting. ` +
        `Original suggestion: ${recommendation}`,
      downgraded: true,
    };
  }

  /**
   * Build the full FASP-AI v2.0 metadata object for an advisory output.
   *
   * @param confidence  Result from computeConfidence
   * @param advisoryType Type of advisory
   * @param baseModel   Underlying LLM used
   */
  static buildMeta(
    confidence: ConfidenceResult,
    advisoryType: AdvisoryType,
    baseModel: string = BASE_MODEL,
  ): FaspV2Meta {
    return {
      model_version: FASP_V2_VERSION,
      base_model: baseModel,
      engine_version: FASP_V2_ENGINE,
      data_cutoff: DATA_CUTOFF,
      confidence_score: confidence.score,
      confidence_breakdown: confidence.breakdown,
      confidence_threshold: confidence.threshold,
      meets_threshold: confidence.meetsThreshold,
      human_review_required: confidence.humanReviewRequired,
      downgraded_reason: confidence.downgradedReason,
      sebi_circular_ref: SEBI_CIRCULAR_MAP[advisoryType],
      calculation_timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the SEBI circular reference string for an advisory type.
   */
  static getSebiRef(advisoryType: AdvisoryType): string {
    return SEBI_CIRCULAR_MAP[advisoryType];
  }

  /**
   * Get the confidence threshold for a user segment.
   */
  static getThreshold(segment: UserSegment): number {
    return SEGMENT_THRESHOLDS[segment];
  }

  /**
   * Persist an AI advisory output to the fasp_advisory_outputs table.
   * Returns the generated output ID for feedback tracking.
   *
   * @param payload Full advisory output with meta
   */
  static async logAdvisoryOutput(payload: AdvisoryOutputPayload): Promise<string> {
    try {
      const [record] = await db
        .insert(faspAdvisoryOutputs)
        .values({
          userId: payload.userId,
          advisorId: payload.advisorId,
          advisoryType: payload.advisoryType,
          inputContext: payload.inputContext,
          userSegment: payload.userSegment,
          recommendation: payload.recommendation,
          outputSnapshot: payload.outputSnapshot,
          modelVersion: payload.meta.model_version,
          baseModel: payload.meta.base_model,
          confidenceScore: payload.meta.confidence_score,
          confidenceBreakdown: payload.meta.confidence_breakdown as any,
          confidenceThreshold: payload.meta.confidence_threshold,
          meetsThreshold: payload.meta.meets_threshold,
          factorsScored: payload.meta.confidence_breakdown as any,
          sebiCircularRef: payload.meta.sebi_circular_ref,
          humanReviewRequired: payload.meta.human_review_required,
          advisorAction: "pending",
          source: "api",
        })
        .returning({ id: faspAdvisoryOutputs.id });

      logger.info("AI_ADVICE_GENERATED", {user_id: payload.userId,
        advisory_type: payload.advisoryType,
        confidence_score: payload.meta.confidence_score,
        meets_threshold: payload.meta.meets_threshold,
        model_version: payload.meta.model_version,
        sebi_ref: payload.meta.sebi_circular_ref,
        timestamp: payload.meta.calculation_timestamp});

      return record.id;
    } catch (err) {
      logger.error("FASP_LOG_FAILED", {error: (err as Error).message });
      // Non-fatal — don't block the advisory response
      return "log-failed";
    }
  }

  /**
   * Record advisor feedback on an advisory output (accept / reject / modify).
   * This feeds into the Historical Accuracy factor for future outputs.
   *
   * @param outputId ID from logAdvisoryOutput
   * @param action   Advisor's decision
   * @param modification Optional: what the advisor changed (if "modified")
   * @param notes    Optional advisor notes
   */
  static async recordFeedback(
    outputId: string,
    action: AdvisorAction,
    modification?: string,
    notes?: string,
  ): Promise<void> {
    try {
      await db
        .update(faspAdvisoryOutputs)
        .set({
          advisorAction: action,
          advisorActionAt: new Date(),
          advisorModification: modification,
          advisorNotes: notes,
        })
        .where(eq(faspAdvisoryOutputs.id, outputId));

      logger.info("AI_ADVICE_FEEDBACK", {output_id: outputId,
        action,
        has_modification: !!modification,
        timestamp: new Date().toISOString()});
    } catch (err) {
      logger.error("FASP_FEEDBACK_FAILED", {output_id: outputId, error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Compute portfolio drift for a set of holdings vs their target weights.
   * Uses current weight from live prices if available, else marks as stale.
   *
   * @param portfolioId Identifier of the model portfolio
   * @param holdings    Array of holdings with target weights and current data
   * @param driftThreshold Alert threshold in percentage points (default 5%)
   */
  static async computeDrift(
    portfolioId: string,
    holdings: HoldingForDrift[],
    driftThreshold = 5.0,
  ): Promise<{
    hasAlerts: boolean;
    drifts: Array<{
      symbol: string;
      targetWeight: number;
      currentWeight: number | null;
      driftPercent: number | null;
      exceedsThreshold: boolean;
      status: "ok" | "alert" | "unknown";
    }>;
  }> {
    const drifts = holdings.map((h) => {
      if (h.currentPrice == null || h.currentUnits == null || h.portfolioValue == null) {
        return {
          symbol: h.symbol,
          targetWeight: h.targetWeight,
          currentWeight: null,
          driftPercent: null,
          exceedsThreshold: false,
          status: "unknown" as const,
        };
      }
      const currentWeight = (h.currentPrice * h.currentUnits / h.portfolioValue) * 100;
      const driftPercent = currentWeight - h.targetWeight;
      const exceedsThreshold = Math.abs(driftPercent) >= driftThreshold;

      return {
        symbol: h.symbol,
        targetWeight: h.targetWeight,
        currentWeight: Math.round(currentWeight * 100) / 100,
        driftPercent: Math.round(driftPercent * 100) / 100,
        exceedsThreshold,
        status: (exceedsThreshold ? "alert" : "ok") as "ok" | "alert",
      };
    });

    // Persist alerts to DB
    const alerts = drifts.filter(d => d.exceedsThreshold && d.driftPercent != null);
    if (alerts.length > 0) {
      try {
        await db.insert(portfolioDriftAlerts).values(
          alerts.map(a => ({
            portfolioId,
            holdingSymbol: a.symbol,
            targetWeight: String(a.targetWeight),
            currentWeight: String(a.currentWeight),
            driftPercent: String(a.driftPercent),
            driftThreshold: String(driftThreshold),
            alertStatus: "open",
          }))
        ).onConflictDoNothing();
      } catch (err) {
        logger.error("DRIFT_ALERT_PERSIST_FAILED", {portfolio_id: portfolioId, error: (err as Error).message });
      }
    }

    return {
      hasAlerts: alerts.length > 0,
      drifts,
    };
  }

  /**
   * Get the full audit trail for a user's AI advisory outputs.
   *
   * @param userId The user ID to query
   * @param limit  Max results (default 50)
   */
  static async getAuditTrail(
    userId: string,
    limit = 50,
  ): Promise<typeof faspAdvisoryOutputs.$inferSelect[]> {
    return db
      .select()
      .from(faspAdvisoryOutputs)
      .where(eq(faspAdvisoryOutputs.userId, userId))
      .orderBy(desc(faspAdvisoryOutputs.createdAt))
      .limit(limit);
  }
}
