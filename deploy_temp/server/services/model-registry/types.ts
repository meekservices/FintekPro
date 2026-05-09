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
  getEligibleModels(requiredCapabilities: string[]): Promise<ModelRegistryEntry[]>;
  updateModelScore(modelId: string, metricType: "accuracy" | "compliance" | "latency", value: number): Promise<void>;
  deactivateModel(modelId: string, reason: string): Promise<void>;
}
