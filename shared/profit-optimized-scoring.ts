import { z } from "zod";
import { 
  InvestmentProduct, 
  UnifiedProductType, 
  ClientProfile, 
  RiskLevel,
  LiquidityLevel,
  InvestmentHorizon
} from "./unified-investment-product";

export type RecommendationMode = 'conservative' | 'balanced' | 'growth_optimized';

export const RECOMMENDATION_MODE = {
  CONSERVATIVE: 'conservative' as RecommendationMode,
  BALANCED: 'balanced' as RecommendationMode,
  GROWTH_OPTIMIZED: 'growth_optimized' as RecommendationMode,
} as const;

export const SUITABILITY_THRESHOLD = 60;

export interface SuitabilityScore {
  total: number;
  breakdown: {
    riskMatch: number;
    timeHorizonMatch: number;
    liquidityMatch: number;
    regulatoryEligibility: number;
  };
  isEligible: boolean;
  exclusionReason?: string;
}

export interface UpsideScore {
  total: number;
  breakdown: Record<string, number>;
  methodology: string;
  inputs: Record<string, any>;
}

export interface FinalScore {
  total: number;
  suitabilityScore: number;
  upsideScore: number;
  mode: RecommendationMode;
  weightings: {
    suitability: number;
    upside: number;
  };
}

export interface ScoredProduct extends InvestmentProduct {
  suitability: SuitabilityScore;
  upside: UpsideScore;
  finalScore: FinalScore;
  ranking: number;
}

export interface AgentOverride {
  overrideId: string;
  agentId: string;
  clientId: string;
  overrideType: 'mode_downgrade' | 'asset_class_lock' | 'allocation_cap';
  value: any;
  reason: string;
  timestamp: Date;
}

export interface ExperimentAssignment {
  clientId: string;
  group: 'A' | 'B';
  mode: RecommendationMode;
  assignedAt: Date;
  experimentId: string;
}

export interface RecommendationAuditLog {
  logId: string;
  clientId: string;
  agentId: string;
  mode: RecommendationMode;
  timestamp: Date;
  productsEvaluated: number;
  productsRecommended: number;
  overrides: AgentOverride[];
  balancedComparison?: {
    rankingDifference: number;
    allocationDifference: Record<UnifiedProductType, number>;
  };
}

export const suitabilityScoreSchema = z.object({
  total: z.number().min(0).max(100),
  breakdown: z.object({
    riskMatch: z.number().min(0).max(100),
    timeHorizonMatch: z.number().min(0).max(100),
    liquidityMatch: z.number().min(0).max(100),
    regulatoryEligibility: z.number().min(0).max(100),
  }),
  isEligible: z.boolean(),
  exclusionReason: z.string().optional(),
});

export const upsideScoreSchema = z.object({
  total: z.number().min(0).max(100),
  breakdown: z.record(z.string(), z.number()),
  methodology: z.string(),
  inputs: z.record(z.string(), z.any()),
});

export const finalScoreSchema = z.object({
  total: z.number().min(0).max(100),
  suitabilityScore: z.number(),
  upsideScore: z.number(),
  mode: z.enum(['conservative', 'balanced', 'growth_optimized']),
  weightings: z.object({
    suitability: z.number(),
    upside: z.number(),
  }),
});

export const agentOverrideSchema = z.object({
  overrideId: z.string(),
  agentId: z.string(),
  clientId: z.string(),
  overrideType: z.enum(['mode_downgrade', 'asset_class_lock', 'allocation_cap']),
  value: z.any(),
  reason: z.string().min(10, "Override reason must be at least 10 characters"),
  timestamp: z.date(),
});

export const experimentAssignmentSchema = z.object({
  clientId: z.string(),
  group: z.enum(['A', 'B']),
  mode: z.enum(['conservative', 'balanced', 'growth_optimized']),
  assignedAt: z.date(),
  experimentId: z.string(),
});

export const MODE_WEIGHTINGS: Record<RecommendationMode, { suitability: number; upside: number }> = {
  conservative: { suitability: 0.85, upside: 0.15 },
  balanced: { suitability: 0.70, upside: 0.30 },
  growth_optimized: { suitability: 0.55, upside: 0.45 },
};

export const SUITABILITY_WEIGHTS = {
  riskMatch: 0.35,
  timeHorizonMatch: 0.25,
  liquidityMatch: 0.20,
  regulatoryEligibility: 0.20,
} as const;

export const RISK_DISCLOSURE_FOOTER = 
  "This recommendation emphasizes growth opportunities within your risk profile. " +
  "Returns may vary. Past performance is not indicative of future results. " +
  "Please consult your financial advisor before making investment decisions.";

export const GROWTH_OPTIMIZED_BANNER = 
  "This recommendation emphasizes growth opportunities within your risk profile. Returns may vary.";
