import { z } from "zod";

// Base AI Advisory Outputs
export const aiRecommendationSchema = z.object({
  recommendation: z.string(),
  confidence_score: z.number().min(0).max(1),
  factors_considered: z.array(z.string()),
  model_version: z.string(),
  timestamp: z.string().optional(),
});

export type AIRecommendation = z.infer<typeof aiRecommendationSchema>;

// User Profile Context for AAGE
export const userProfileGovernanceSchema = z.object({
  risk_profile: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  investment_horizon: z.enum(["short", "medium", "long", "unknown"]).default("unknown"),
  kyc_status: z.enum(["verified", "pending", "rejected", "none"]).default("none"),
  user_segment: z.enum(["retail", "hni", "corporate", "unknown"]).default("unknown"),
});

export type UserProfileGovernance = z.infer<typeof userProfileGovernanceSchema>;

// Internal Engine Inputs
export interface GovernanceInput {
  user_id: string;
  query: string;
  ai_output: Partial<AIRecommendation>; // Could be malformed from LLM
  user_profile: UserProfileGovernance;
  trace_id?: string;
  b2b_context?: {
    is_partner_override?: boolean;
    partner_ria_id?: string;
    delegated_governance_mode?: "STRICT" | "DELEGATED";
  };
}

// Validation Engines
export type DecisionType = "APPROVE" | "MODIFY" | "BLOCK";

export interface ValidationViolation {
  module: string;
  severity: "MINOR" | "CRITICAL";
  message: string;
  code: string;
}

export interface ValidationResult {
  passed: boolean;
  violations: ValidationViolation[];
  suggested_modifications?: {
    add_disclaimers?: string[];
    enforce_language?: {
      search: string;
      replace: string;
    }[];
    risk_notes?: string;
  };
  risk_metrics?: {
    risk_level: "low" | "medium" | "high";
    downside_probability: number;
    volatility_score: number;
    liquidity_profile: "low" | "medium" | "high";
  };
}

export interface GovernanceValidator {
  validate(input: GovernanceInput): Promise<ValidationResult>;
}

// Final Engine Output
export interface GovernanceOutput {
  decision: DecisionType;
  final_output: AIRecommendation | { message: string; reason: string; fallback?: boolean };
  violations: ValidationViolation[];
  risk_flags: string[];
  compliance_status: "PASS" | "FAIL";
  audit_id?: string;
}
