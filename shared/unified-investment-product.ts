import { z } from "zod";

export type UnifiedProductType = 
  | 'STOCK'
  | 'MF'
  | 'BOND'
  | 'REIT'
  | 'INVIT'
  | 'IPO'
  | 'UNLISTED'
  | 'AIF'
  | 'PMS'
  | 'MLD';

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
export type LiquidityLevel = 'high' | 'medium' | 'low' | 'very_low';
export type InvestmentHorizon = 'ultra_short' | 'short' | 'medium' | 'long' | 'very_long';
export type TaxTreatment = 'equity' | 'debt' | 'hybrid' | 'indexed' | 'tax_free' | 'special' | 'elss' | 'reit' | 'invit' | 'aif';

export interface InvestmentProduct {
  product_id: string;
  product_type: UnifiedProductType;
  name: string;
  issuer: string;
  
  risk_level: RiskLevel;
  liquidity: LiquidityLevel;
  investment_horizon: InvestmentHorizon;
  
  expected_return_band: {
    min: number;
    max: number;
    benchmark?: string;
  };
  
  volatility_proxy: number;
  
  tax_treatment: TaxTreatment;
  lock_in_period: number | null;
  min_investment: number;
  
  regulatory_tags: string[];
  source: 'store' | 'issuer' | 'admin' | 'exchange';
  
  current_price?: number;
  yield_or_return?: number;
  rating?: string;
  sector?: string;
  
  score?: number;
  rationale_inputs?: Record<string, any>;
  
  raw_data?: any;
  last_updated: Date;
}

export const investmentProductSchema = z.object({
  product_id: z.string(),
  product_type: z.enum(['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO', 'UNLISTED', 'AIF', 'PMS', 'MLD']),
  name: z.string(),
  issuer: z.string(),
  risk_level: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
  liquidity: z.enum(['high', 'medium', 'low', 'very_low']),
  investment_horizon: z.enum(['ultra_short', 'short', 'medium', 'long', 'very_long']),
  expected_return_band: z.object({
    min: z.number(),
    max: z.number(),
    benchmark: z.string().optional(),
  }),
  volatility_proxy: z.number(),
  tax_treatment: z.enum(['equity', 'debt', 'hybrid', 'indexed', 'tax_free', 'special']),
  lock_in_period: z.number().nullable(),
  min_investment: z.number(),
  regulatory_tags: z.array(z.string()),
  source: z.enum(['store', 'issuer', 'admin', 'exchange']),
  current_price: z.number().optional(),
  yield_or_return: z.number().optional(),
  rating: z.string().optional(),
  sector: z.string().optional(),
  score: z.number().optional(),
  rationale_inputs: z.record(z.any()).optional(),
  raw_data: z.any().optional(),
  last_updated: z.date(),
});

export interface ClientProfile {
  client_id: string;
  risk_category: RiskLevel;
  client_category: 'retail' | 'HNI' | 'sHNI' | 'bHNI' | 'institutional';
  investment_horizon: InvestmentHorizon;
  liquidity_needs: LiquidityLevel;
  tax_bracket: number;
  age?: number;
  investment_experience: 'beginner' | 'intermediate' | 'experienced';
  existing_holdings?: ExistingHolding[];
  goals?: InvestmentGoal[];
}

export interface ExistingHolding {
  product_type: UnifiedProductType;
  product_id: string;
  current_value: number;
  allocation_percent: number;
  purchase_date: Date;
  unrealized_gain_percent?: number;
}

export interface InvestmentGoal {
  goal_id: string;
  goal_type: 'retirement' | 'education' | 'house' | 'wealth_creation' | 'income' | 'tax_saving' | 'emergency';
  target_amount: number;
  target_date: Date;
  current_progress: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MarketContext {
  market_regime: 'bull' | 'bear' | 'sideways' | 'volatile';
  interest_rate_outlook: 'rising' | 'stable' | 'falling';
  inflation_outlook: 'high' | 'moderate' | 'low';
  sector_momentum: Record<string, number>;
  timestamp: Date;
}

export interface EvaluatedProduct extends InvestmentProduct {
  suitability_score: number;
  risk_adjusted_score: number;
  rationale_inputs: {
    score_breakdown: Record<string, number>;
    key_factors: string[];
    risk_factors: string[];
    opportunity_factors: string[];
  };
}

export interface RecommendationBasket {
  basket_id: string;
  client_id: string;
  generated_at: Date;
  
  products: BasketItem[];
  
  portfolio_summary: {
    total_investment: number;
    weighted_expected_return: number;
    weighted_risk_score: number;
    diversification_score: number;
    asset_allocation: Record<UnifiedProductType, number>;
  };
  
  portfolio_rationale: string;
  
  risk_analysis: {
    concentration_risk: 'low' | 'medium' | 'high';
    liquidity_risk: 'low' | 'medium' | 'high';
    market_risk: 'low' | 'medium' | 'high';
    credit_risk: 'low' | 'medium' | 'high';
  };
  
  compliance_flags: string[];
  
  expires_at: Date;
}

export interface BasketItem {
  product: InvestmentProduct;
  allocation_percent: number;
  suggested_amount: number;
  rationale: string;
  ai_explanation?: string;
  pros: string[];
  cons: string[];
  action: 'buy' | 'hold' | 'switch' | 'reduce';
  priority: 'must_have' | 'recommended' | 'optional';
}

export interface ProductAdapter<T> {
  productType: UnifiedProductType;
  normalize(raw: T): InvestmentProduct;
  getRiskLevel(raw: T): RiskLevel;
  getLiquidity(raw: T): LiquidityLevel;
  getHorizon(raw: T): InvestmentHorizon;
  getExpectedReturn(raw: T): { min: number; max: number };
  getVolatility(raw: T): number;
}

export interface ProductEvaluator {
  productType: UnifiedProductType;
  evaluate(
    product: InvestmentProduct,
    clientProfile: ClientProfile,
    marketContext: MarketContext
  ): { score: number; rationale_inputs: Record<string, any> };
}
