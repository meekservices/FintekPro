/**
 * @module core/types
 * @description Canonical core domain types shared across core engines and services.
 * Maintains strict layered architecture (/api -> /services -> /core -> /data -> /utils)
 * so core engines never import upward from /services.
 */

export type TriggerReason =
  | "THRESHOLD_BREACH"
  | "CALENDAR"
  | "RISK_PROFILE_CHANGE"
  | "MARKET_REGIME_CHANGE"
  | "BLACK_SWAN"
  | "MANUAL";

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
  volatility_context?: {
    sigma_level: number;
    regime: string;
    auto_suspend: boolean;
  };
}

export interface TaxEstimationContext {
  action: "BUY" | "SELL";
  asset: string;
  quantity: number;
  estimated_gain_val: number;
  is_long_term: boolean;
}

export type ModelType = "LLM" | "Quant" | "RuleEngine" | "ExternalAPI";
export type ModelStatus = "active" | "degraded" | "inactive";

export interface ModelCapabilities {
  advisory?: boolean;
  reasoning?: boolean;
  pricing?: boolean;
  compliance?: boolean;
  tax?: boolean;
  statistical?: boolean;
}

export interface ModelSpecializationWeights {
  investment?: number;
  tax?: number;
  compliance?: number;
}

export interface ModelRegistryEntry {
  model_id: string;
  type: ModelType;
  capabilities: string[];
  avg_score: number;
  latency_ms: number;
  cost_per_call: number;
  compliance_score: number;
  specialization_weights: ModelSpecializationWeights;
  status: ModelStatus;
  last_updated: string;
}

export interface ModelRegistryManager {
  getEligibleModels(
    requiredCapabilities: string[],
  ): Promise<ModelRegistryEntry[]>;
  updateModelScore(
    modelId: string,
    metricType: "accuracy" | "compliance" | "latency",
    value: number,
  ): Promise<void>;
  deactivateModel(modelId: string, reason: string): Promise<void>;
}

export interface SelectionContext {
  query_id: string;
  query_type: "investment" | "tax" | "compliance" | "general";
  user_id?: string;
  risk_level?: "low" | "medium" | "high";
  latency_requirement?: "low" | "high";
  confidence_required?: number;
  capabilities_required?: string[];
}

export interface SelectionResult {
  selected_model: string;
  confidence_target: number;
  selection_score: number;
  reason: string;
  fallback_triggered: boolean;
  alternative_models?: string[];
}
