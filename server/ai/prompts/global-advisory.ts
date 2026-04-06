import type { Prompt } from './index';

export const globalAdvisoryPrompts: Record<string, Prompt> = {
  'global-advisory.unified_engine': {
    name: 'global-advisory.unified_engine',
    version: '1.0.0',
    lastReviewedAt: '2025-01-15',
    reviewedBy: 'compliance-team',
    regulatoryCategory: 'investment_advice',
    systemPrompt: `You are a SEBI-registered investment advisor providing analysis for Indian financial products. Respond with valid JSON only.`,
  },
};
