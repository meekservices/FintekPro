/**
 * @file drift/index.ts
 * @description APRE v1.0 — Portfolio drift detection engine.
 *
 * Purpose:
 *   Calculates allocation drift (w_current - w_target) per asset class.
 *   Supports threshold-based, calendar, risk-profile change, market-regime,
 *   and Black Swan triggers as mandated by APRE v1.0 §3.
 *
 * Inputs:
 *   - PortfolioTargetModel: target allocation + rebalance policy
 *   - currentAllocation: live asset weights from portfolio valuation
 *   - Optional: volatilityContext for Black Swan / regime triggers
 *
 * Outputs:
 *   - DriftReport: drift per asset, trigger reason, volatility context
 *
 * Edge cases:
 *   - Missing assets in current allocation are treated as 0% weight
 *   - Black Swan (10σ) trigger always returns has_drifted=true regardless of weights
 *   - Risk-profile change always triggers, even if allocation drift < threshold
 *
 * GCR v1.0: same input → same output (deterministic). No randomness.
 * APRE v1.0: §3.2 trigger conditions fully implemented.
 */

/** Individual asset weight in a portfolio. */
export interface AssetWeight {
  asset: string;
  weight: number;
}

/**
 * APRE v1.0 §3.2 — Supported drift trigger reasons.
 * Each trigger reason determines downstream urgency and approval requirements.
 */
export type TriggerReason =
  | "THRESHOLD_BREACH"       // absolute drift > drift_threshold
  | "CALENDAR"               // periodic rebalance schedule (monthly/quarterly)
  | "RISK_PROFILE_CHANGE"    // user's risk profile changed → re-check suitability
  | "MARKET_REGIME_CHANGE"   // APSE market regime signal changed (e.g. BULL→BEAR)
  | "BLACK_SWAN"             // market volatility > 10σ → auto-suspend (FASP-AI §24.1)
  | "MANUAL";                // advisor-initiated review

/** Target allocation + rebalance policy for a portfolio. */
export interface PortfolioTargetModel {
  portfolio_id: string;
  target_allocation: AssetWeight[];
  rebalance_policy: {
    /** "monthly" | "quarterly" | "semi_annual" | "annual" */
    frequency: string;
    /** Absolute drift threshold (e.g. 0.05 = 5%) above which rebalancing triggers. */
    drift_threshold: number;
    /** If true, capital gains impact must be minimised before executing. */
    tax_aware: boolean;
  };
}

/**
 * APRE v1.0 §3 — Extended drift report.
 * Adds trigger_reason and volatility_context to the original drift data.
 */
export interface DriftReport {
  has_drifted: boolean;
  largest_drift: number;
  trigger_reason: TriggerReason;
  drifting_assets: {
    asset: string;
    current: number;
    target: number;
    delta: number;
  }[];
  /**
   * Volatility context from the market regime / Black Swan detector.
   * Populated when trigger_reason is MARKET_REGIME_CHANGE or BLACK_SWAN.
   */
  volatility_context?: {
    sigma_level: number;         // current volatility in σ units
    regime: string;              // e.g. "BULL" | "BEAR" | "SIDEWAYS"
    auto_suspend: boolean;       // true if >= 10σ → block all execution
  };
}

export class DriftDetectionEngine {
  /**
   * Evaluates the absolute discrepancy between current market valuations and target weights.
   * Drift_i = w_current - w_target  (APRE §3.1)
   *
   * @param targetModel - target allocation + rebalance policy
   * @param currentAllocation - live asset weights
   * @param options - optional override for trigger reason and volatility context
   */
  public calculateDrift(
    targetModel: PortfolioTargetModel,
    currentAllocation: AssetWeight[],
    options?: {
      overrideTrigger?: TriggerReason;
      volatilityContext?: DriftReport["volatility_context"];
    },
  ): DriftReport {
    const { overrideTrigger, volatilityContext } = options ?? {};

    // ── APRE §3.2: Black Swan — auto-suspend, skip weight analysis ─────────────
    // If volatility is >= 10σ, the report always signals drift so the upstream
    // rebalance scheduler can immediately suspend all plans (FASP-AI §24.1).
    if (
      volatilityContext?.auto_suspend ||
      (volatilityContext?.sigma_level != null && volatilityContext.sigma_level >= 10)
    ) {
      return {
        has_drifted: true,
        largest_drift: 1.0, // sentinel: max drift to force upstream attention
        trigger_reason: "BLACK_SWAN",
        drifting_assets: [],
        volatility_context: volatilityContext,
      };
    }

    const analysisMap: DriftReport["drifting_assets"] = [];
    let hasDrifted = false;
    let maxDrift = 0;

    for (const target of targetModel.target_allocation) {
      const current = currentAllocation.find((c) => c.asset === target.asset);
      const currentWeight = current ? current.weight : 0.0;

      const delta = currentWeight - target.weight;
      const absoluteDrift = Math.abs(delta);

      if (absoluteDrift > maxDrift) {
        maxDrift = absoluteDrift;
      }

      if (absoluteDrift > targetModel.rebalance_policy.drift_threshold) {
        hasDrifted = true;
      }

      analysisMap.push({
        asset: target.asset,
        current: currentWeight,
        target: target.weight,
        // Positive = overweight (need to SELL); Negative = underweight (need to BUY)
        delta,
      });
    }

    // ── APRE §3.2: Determine trigger reason ────────────────────────────────────
    // Priority: explicit override > regime > threshold > calendar (caller decides)
    let triggerReason: TriggerReason;
    if (overrideTrigger) {
      triggerReason = overrideTrigger;
      // Risk-profile or regime changes always count as drifted regardless of weights
      if (
        overrideTrigger === "RISK_PROFILE_CHANGE" ||
        overrideTrigger === "MARKET_REGIME_CHANGE"
      ) {
        hasDrifted = true;
      }
    } else {
      triggerReason = hasDrifted ? "THRESHOLD_BREACH" : "CALENDAR";
    }

    return {
      has_drifted: hasDrifted,
      largest_drift: maxDrift,
      trigger_reason: triggerReason,
      drifting_assets: analysisMap,
      ...(volatilityContext ? { volatility_context: volatilityContext } : {}),
    };
  }

  /**
   * Convenience helper: check if a risk-profile change should trigger rebalancing.
   * Returns a DriftReport with trigger_reason = RISK_PROFILE_CHANGE and has_drifted = true.
   *
   * @param targetModel - portfolio target model
   * @param currentAllocation - current live weights
   */
  public riskProfileChangedDrift(
    targetModel: PortfolioTargetModel,
    currentAllocation: AssetWeight[],
  ): DriftReport {
    return this.calculateDrift(targetModel, currentAllocation, {
      overrideTrigger: "RISK_PROFILE_CHANGE",
    });
  }

  /**
   * Convenience helper: signal a market-regime change trigger.
   * Always returns has_drifted = true so the scheduler routes to advisor queue.
   *
   * @param targetModel - portfolio target model
   * @param currentAllocation - current live weights
   * @param regime - current market regime string (e.g. "BEAR")
   * @param sigmaLevel - volatility in σ units (use >= 10 to trigger BLACK_SWAN)
   */
  public marketRegimeChangeDrift(
    targetModel: PortfolioTargetModel,
    currentAllocation: AssetWeight[],
    regime: string,
    sigmaLevel: number,
  ): DriftReport {
    const auto_suspend = sigmaLevel >= 10;
    return this.calculateDrift(targetModel, currentAllocation, {
      overrideTrigger: auto_suspend ? "BLACK_SWAN" : "MARKET_REGIME_CHANGE",
      volatilityContext: { sigma_level: sigmaLevel, regime, auto_suspend },
    });
  }
}

export const driftEngine = new DriftDetectionEngine();
