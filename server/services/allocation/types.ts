import { AllocationOutput } from "../../core/optimizer";

export interface URCAEInputContext {
  user_profile: {
    user_id: string;
    risk_profile: "low" | "medium" | "high";
    investment_horizon: "short" | "medium" | "long";
    liquidity_needs: "low" | "medium" | "high";
  };
  market_state: {
    volatility: number;
    interest_rates: number;
    macro_regime: "bull" | "bear" | "neutral" | "volatile";
  };
  optimization_model?: "mean_variance" | "risk_parity" | "black_litterman";
  b2b_context?: {
    is_partner_override?: boolean;
    partner_ria_id?: string;
    delegated_governance_mode?: "STRICT" | "DELEGATED";
  };
}

export interface URCAEOutputContext {
  allocation_id: string;
  target_allocation: AllocationOutput[];
  strategy_overlay: string[];
  risk_budget: { [asset_class: string]: number }; // Risk Contribution Mapping (RC_i)
  expected_metrics: {
    return: number;
    volatility: number;
  };
  system_trace: {
    model_used: string;
    active_constraints: string[];
  };
}
