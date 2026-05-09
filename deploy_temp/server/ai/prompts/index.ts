export type RegulatoryCategory =
  | 'investment_advice'
  | 'portfolio_analysis'
  | 'general_chat'
  | 'kyc_guidance'
  | 'compliance';

export interface Prompt {
  name: string;
  version: string;
  lastReviewedAt: string;
  reviewedBy: string;
  regulatoryCategory: RegulatoryCategory;
  systemPrompt: string;
}
