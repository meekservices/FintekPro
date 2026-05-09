import { v4 as uuidv4 } from "uuid";
import { db } from "../../db";
import { urcaeAllocationLogs } from "../../../shared/schema/ai";
import { URCAEInputContext, URCAEOutputContext } from "./types";
import { optimizerEngine, AssetInput, AllocationOutput } from "../../core/optimizer";
import { constraintEngine } from "../../core/constraints";
import { marketRegimeDetector } from "../risk";
import { aiGovernanceEngine } from "../ai-governance";

export class URCAEPlanner {

  /**
   * Translates the generic Risk/Context matrices strictly into mathematical target arrays using purely deterministic formulas bounded by systemic constraints.
   */
  public async generateTargetAllocation(context: URCAEInputContext): Promise<URCAEOutputContext> {
    const allocationId = uuidv4();
    let selectedModel = context.optimization_model || "mean_variance";

    try {
      // 24.1 Systemic Resilience: Intercept for extreme volatility events
      if (marketRegimeDetector.detectBlackSwanEvent()) {
        const safetyWeights: AllocationOutput[] = [{ asset_class: "cash", weight: 1.0 }];
        return {
          allocation_id: allocationId, 
          target_allocation: safetyWeights, 
          strategy_overlay: ["capital_preservation_black_swan"],
          risk_budget: { "cash": 0.01 }, 
          expected_metrics: { return: 0.03, volatility: 0.01 }, 
          system_trace: { model_used: "BLACK_SWAN_AUTO_FALLBACK", active_constraints: ["10_SIGMA_VOLATILITY_INTERCEPT"] }
        };
      }

      // 1. Ingest Market Assets and Regime states
      // In production, these variables array from Alpaca / Market APIs natively. Stubbed for pure math extraction.
      let availableAssets: AssetInput[] = [
        { id: "equity_largecap", expectedReturn: 0.12, volatility: 0.18 },
        { id: "equity_midcap", expectedReturn: 0.18, volatility: 0.25 },
        { id: "bonds", expectedReturn: 0.06, volatility: 0.05 },
        { id: "cash", expectedReturn: 0.03, volatility: 0.01 },
        { id: "unlisted", expectedReturn: 0.22, volatility: 0.35 }
      ];

      // Mutate Volatility parameters natively based on Market Regime flags
      const regimeShift = marketRegimeDetector.getMarketRegimeConstraints(context.market_state.macro_regime);
      availableAssets = availableAssets.map(a => {
         if (a.id.includes("equity")) a.volatility = a.volatility * regimeShift.targetEquityShift;
         if (a.id.includes("bonds")) a.volatility = a.volatility * regimeShift.targetDebtShift;
         return a;
      });

      // 2. Execute Quantitative Math Array
      let rawAllocation: AllocationOutput[] = [];
      const targetReturnRequest = context.user_profile.risk_profile === "high" ? 0.15 : context.user_profile.risk_profile === "medium" ? 0.10 : 0.07;
      
      let fallbackTriggered = false;

      if (selectedModel === "risk_parity") {
         rawAllocation = optimizerEngine.generateRiskParityAllocation(availableAssets);
      } else if (selectedModel === "black_litterman") {
         rawAllocation = optimizerEngine.attemptBlackLittermanOptimization(availableAssets, targetReturnRequest);
         fallbackTriggered = true; // Flag for audit DB
      } else {
         rawAllocation = optimizerEngine.generateMeanVarianceAllocation(availableAssets, targetReturnRequest);
      }

      // 3. System Constraints Layer mapping
      // Map limits directly to underlying systemic limits based dynamically on user contexts
      const globalMaxClass = context.user_profile.risk_profile === "high" ? 0.40 : 0.20; // Generic ceiling for massive capital sinks
      const constraints = { max_single_asset: globalMaxClass, min_cash: context.user_profile.liquidity_needs === "high" ? 0.15 : 0.05 };
      
      const enforcedAllocation = constraintEngine.applyConstraints(rawAllocation, constraints);

      // 4. Governance Approval Gate
      const aageCheck = await aiGovernanceEngine.validateAndResolve({
        user_id: context.user_profile.user_id,
        query: `Generate target capital allocation using ${selectedModel}`,
        ai_output: { recommendation: JSON.stringify(enforcedAllocation) },
        user_profile: { risk_profile: context.user_profile.risk_profile, investment_horizon: context.user_profile.investment_horizon, kyc_status: "verified", user_segment: "retail"},
        trace_id: allocationId,
        b2b_context: context.b2b_context
      });

      if (aageCheck.decision === "BLOCK") {
         throw new Error(`AAGE Compliance Intercept: ${aageCheck.risk_flags.join(", ")}`);
      }

      // 5. Build output and calculate metrics securely
      let expectedReturnFinal = 0;
      let approxVolatilityFinal = 0;
      let riskBudgetMap: { [key: string]: number } = {};

      enforcedAllocation.forEach(alloc => {
         const assetTrace = availableAssets.find(a => a.id === alloc.asset_class);
         if (assetTrace) {
           expectedReturnFinal += (alloc.weight * assetTrace.expectedReturn);
           approxVolatilityFinal += (alloc.weight * assetTrace.volatility);
           riskBudgetMap[alloc.asset_class] = alloc.weight * assetTrace.volatility; // Simplified Risk Contribution (RCi) = wi * σi
         }
      });

      const outputPayload: URCAEOutputContext = {
        allocation_id: allocationId,
        target_allocation: enforcedAllocation,
        strategy_overlay: [context.user_profile.risk_profile === "low" ? "income" : "growth"],
        risk_budget: riskBudgetMap,
        expected_metrics: { return: expectedReturnFinal, volatility: approxVolatilityFinal },
        system_trace: { model_used: selectedModel, active_constraints: [`max_asset_${globalMaxClass}`, `min_cash_${constraints.min_cash}`] }
      };

      // 6. DB Verification Insert
      db.insert(urcaeAllocationLogs).values({
        id: allocationId,
        userId: context.user_profile.user_id,
        modelUsed: selectedModel,
        inputsDetected: context,
        activeConstraints: constraints,
        finalWeightsVector: enforcedAllocation,
        optimisticFallbackTriggered: fallbackTriggered,
        partnerRiaId: context.b2b_context?.partner_ria_id // Log the Authorizing RIA ID for audit
      }).execute().catch(e => console.error("URCAE DB Audit Fault:", e));

      return outputPayload;

    } catch (e: any) {
      console.error("[URCAE FATAL FAULT]", e);
      // Failsafe Layer: Default to generalized defensive rule-based states
      const defensiveWeights: AllocationOutput[] = [{ asset_class: "cash", weight: 1.0 }]; // Entire portfolio shifted to safety buffer
      return {
        allocation_id: allocationId, target_allocation: defensiveWeights, strategy_overlay: ["capital_preservation"],
        risk_budget: { "cash": 0.01 }, expected_metrics: { return: 0.03, volatility: 0.01 }, system_trace: { model_used: "SEBI_FAILSAFE_DEFAULT", active_constraints: ["ALL_CASH_FALLBACK"] }
      };
    }
  }
}

export const urcaeEngine = new URCAEPlanner();
