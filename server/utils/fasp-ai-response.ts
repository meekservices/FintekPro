/**
 * FASP-AI v1.0 Advisory Response Wrapper
 *
 * Every AI/advisory output MUST include:
 *   recommendation, confidence_score, factors_considered,
 *   model_version, timestamp, and a mandatory risk disclaimer.
 *
 * Purpose: Centralises FASP-AI compliance envelope so no advisory
 *          route returns bare recommendation objects.
 * Inputs:  data (any), options (WrapOptions)
 * Outputs: FaspAiEnvelope<T>
 * Edge cases:
 *   - If data is already wrapped (has .fasp_ai_compliant), return as-is
 *   - confidence_score defaults to 0.75 if omitted
 *   - Disclaimer is always appended regardless of caller input
 */

export const SEBI_AI_DISCLAIMER =
  "IMPORTANT: This is an AI-generated advisory output for decision support only. " +
  "It does NOT constitute financial advice, investment recommendation, or a solicitation " +
  "to buy or sell any security. Past performance is not indicative of future results. " +
  "All investments are subject to market risk. Please consult a SEBI-registered investment " +
  "advisor before making any investment decision. Confidence scores are indicative only.";

export interface WrapOptions {
  /** Short label of factors that drove this recommendation */
  factors_considered?: string[];
  /** Model/engine identifier string */
  model_version?: string;
  /** Confidence 0–1; default 0.75 */
  confidence_score?: number;
  /** Risk profile segment: conservative | moderate | aggressive | ultra_aggressive */
  risk_profile?: string;
  /** Investment horizon label */
  investment_horizon?: string;
  /** User segment: retail | hni | ultra_hni | institutional */
  user_segment?: string;
}

export interface FaspAiEnvelope<T = unknown> {
  fasp_ai_compliant: true;
  data: T;
  meta: {
    timestamp: string;
    model_version: string;
    confidence_score: number;
    factors_considered: string[];
    risk_profile: string | null;
    investment_horizon: string | null;
    user_segment: string | null;
    disclaimer: string;
  };
}

/**
 * Wrap any advisory/AI data in a FASP-AI v1.0 compliant envelope.
 * Use before every res.json() on advisory/recommendation endpoints.
 */
export function wrapAdvisoryResponse<T>(
  data: T,
  options: WrapOptions = {},
): FaspAiEnvelope<T> {
  // Idempotency: already wrapped
  if (
    data !== null &&
    typeof data === "object" &&
    (data as Record<string, unknown>).fasp_ai_compliant === true
  ) {
    return data as unknown as FaspAiEnvelope<T>;
  }

  return {
    fasp_ai_compliant: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      model_version: options.model_version ?? "fasp-ai-v1.0",
      confidence_score: options.confidence_score ?? 0.75,
      factors_considered: options.factors_considered ?? [
        "risk_profile",
        "investment_horizon",
        "market_regime",
        "historical_returns",
      ],
      risk_profile: options.risk_profile ?? null,
      investment_horizon: options.investment_horizon ?? null,
      user_segment: options.user_segment ?? null,
      disclaimer: SEBI_AI_DISCLAIMER,
    },
  };
}
