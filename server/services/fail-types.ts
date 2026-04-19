export interface ExplainabilitySchema {
  recommendation: string;
  confidence_score: number; // 0.0 to 1.0
  reasoning: string[]; // Specific deterministic logical hops
  quant_validation: {
    valuation_method?: string; // e.g. "DCF", "Comps"
    intrinsic_value?: number;
    market_price?: number;
    margin_of_safety?: string;
    correlation_coefficient?: number;
  };
  risk_summary: {
    volatility: number;
    drawdown_risk: number;
    liquidity_risk: "low" | "medium" | "high";
    warnings: string[];
  };
  model_version: string;
  timestamp: string;
}

export interface AdvisoryTrustProfile {
  trust_score: number; // 0-100 Aggregate
  based_on: string[]; // Context flags
  requires_human_override: boolean;
}

// Top level context proxy passed from upstream UI/Controllers down into the FAIL layer
export interface FailRequestContext {
  user_id: string;
  query_id: string;
  query_type: "investment" | "tax" | "compliance" | "general";
  input_query: string;
  user_segment: "retail" | "hni" | "corporate";
  risk_profile: "low" | "medium" | "high";
  investment_horizon: "short" | "medium" | "long";
  requires_quant: boolean; // Forces fallback blocks if pure LLMs can't fulfill
}

export interface FailResponsePayload {
  status: "SUCCESS" | "BLOCKED" | "DEGRADED_FALLBACK";
  explainable_payload?: ExplainabilitySchema;
  trust_profile?: AdvisoryTrustProfile;
  audit_id?: string; // Pulled from AAGE
  internal_routing_trace?: string[]; 
}
