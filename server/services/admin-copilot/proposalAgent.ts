/**
 * proposalAgent.ts — Investor Proposal Draft Generator
 * GUARDRAIL: All proposals are DRAFT until Admin explicitly approves.
 * AI never sends proposals to clients, promises returns, or executes investments.
 *
 * Purpose : Generate SEBI/CFP-compliant investment proposal drafts for Admin review.
 * Inputs  : ProposalInputs (investor info + product universe)
 * Outputs : AiProposalDraft stored in DB + audit logged
 * Edge    : Confidence < 0.6 → stored as 'low_confidence_draft'; Admin MUST route to
 *           human RIA before sharing with client (FASP-AI v1.0 §4.3).
 */

import { db } from '../../db';
import { aiProposalDrafts } from '@shared/schema/admin-copilot';
import { callGemini } from '../../gemini-service';
import { auditLog, logCopilotEvent } from '../../logger';
import { randomUUID } from 'crypto';

export type ProductType =
  | 'mutual_fund' | 'bonds_ncd' | 'pms' | 'aif'
  | 'reit_invit' | 'unlisted' | 'us_stocks' | 'loans' | 'corporate_treasury';

export type RiskProfile  = 'conservative' | 'moderate' | 'aggressive';
export type TaxStatus    = 'resident' | 'nri' | 'huf' | 'corporate';
export type LiquidityNeed = 'high' | 'medium' | 'low';

export interface ProposalInputs {
  investorName:      string;
  investorEmail?:    string;
  investorUserId?:   string;
  amount:            number;
  riskProfile:       RiskProfile;
  investmentHorizon: string;     // e.g. "3y" | "5y" | "10y+"
  taxStatus:         TaxStatus;
  liquidityNeed:     LiquidityNeed;
  existingHoldings?: Array<{ asset: string; value: number }>;
  productUniverse?:  ProductType[];
  productType:       ProductType;
  linkedCrmLeadId?:  string;
}

interface ProposalOutput {
  executiveSummary:      string;
  assetAllocation:       Record<string, number>;  // {"equity": 60, "debt": 30, "alt": 10}
  productRecommendation: Array<{ name: string; allocation: number; rationale: string }>;
  expectedReturnRange:   string;   // "8–11% p.a." — RANGE only, never a promise
  riskAssessment:        string;
  liquidityAnalysis:     string;
  taxationNote:          string;
  suitabilityNote:       string;
  disclaimer:            string;
}

const MANDATORY_DISCLAIMER = `
IMPORTANT DISCLAIMER: This is an AI-generated draft investment proposal for ADVISOR REVIEW ONLY.
It has NOT been reviewed or approved by a SEBI-registered investment advisor. This proposal:
• Does NOT constitute personalized investment advice
• Does NOT guarantee any returns — expected ranges are indicative only
• Is subject to market risks; past performance is not indicative of future results
• Must be reviewed and approved by an authorized SEBI RIA/CFP before being shared with the client
• Requires risk profiling and KYC verification to be complete before execution
• All investment decisions are the sole responsibility of the client and their advisor
Mutual Fund investments are subject to market risks. Read all scheme-related documents carefully.
`.trim();

function buildProposalSystemPrompt(inputs: ProposalInputs): string {
  return `
You are an expert financial advisor AI for FintekPro, a SEBI-regulated investment advisory platform.
Generate a comprehensive, structured investment proposal DRAFT for advisor review.

Client profile:
- Risk: ${inputs.riskProfile}
- Horizon: ${inputs.investmentHorizon}
- Amount: ₹${inputs.amount.toLocaleString('en-IN')}
- Tax status: ${inputs.taxStatus}
- Liquidity need: ${inputs.liquidityNeed}
- Product focus: ${inputs.productType}
- Existing holdings: ${JSON.stringify(inputs.existingHoldings ?? [])}

Return strict JSON with these exact fields:
{
  "executiveSummary": "2-3 paragraph executive summary",
  "assetAllocation": {"equity": 0-100, "debt": 0-100, "alt": 0-100, "cash": 0-100},
  "productRecommendation": [{"name":"...", "allocation": 0-100, "rationale": "..."}],
  "expectedReturnRange": "X-Y% p.a. (indicative, not guaranteed)",
  "riskAssessment": "Detailed risk analysis",
  "liquidityAnalysis": "Liquidity profile analysis",
  "taxationNote": "Tax implications (LTCG, STCG, indexation, etc.)",
  "suitabilityNote": "Why this product suits this investor profile",
  "disclaimer": "SEBI/CFP standard disclaimer"
}

CRITICAL RULES:
- NEVER promise specific returns — use ranges with "indicative, not guaranteed"
- NEVER recommend execution — this is advisory only
- Include relevant SEBI risk disclosures
- Mention relevant tax implications (LTCG, STCG, DDT, surcharge for HNI/NRI)
- All recommendations must align with stated risk profile
`.trim();
}

export async function generateProposalDraft(
  inputs:      ProposalInputs,
  requestedBy: string,
): Promise<{ id: string; approvalStatus: string; confidenceScore: number }> {
  const startMs = Date.now();
  const systemPrompt = buildProposalSystemPrompt(inputs);
  const userPrompt   = `Generate proposal for: ${inputs.investorName}, ₹${inputs.amount.toLocaleString('en-IN')}, ${inputs.productType}`;

  const { data, meta } = await callGemini<ProposalOutput>(systemPrompt, userPrompt, {
    temperature:     0.2,
    maxOutputTokens: 6000,
  });

  // ── FASP-AI v1.0 §4.3 — Confidence Threshold Guard ──────────────────────────
  // If the AI's confidence is below 0.60, the proposal MUST be flagged for
  // mandatory human RIA review BEFORE any admin can approve it for client delivery.
  const CONFIDENCE_THRESHOLD = 0.60;
  const isLowConfidence = (meta.confidence_score ?? 1) < CONFIDENCE_THRESHOLD;
  const initialApprovalStatus = isLowConfidence ? 'low_confidence_draft' : 'draft';

  // Always append mandatory SEBI disclaimer
  const finalDisclaimer = MANDATORY_DISCLAIMER + '\n\n' + (data.disclaimer ?? '');

  const auditId = randomUUID();

  const [proposal] = await db.insert(aiProposalDrafts).values({
    investorName:      inputs.investorName,
    investorEmail:     inputs.investorEmail,
    investorUserId:    inputs.investorUserId,
    amount:            String(inputs.amount),
    riskProfile:       inputs.riskProfile,
    investmentHorizon: inputs.investmentHorizon,
    taxStatus:         inputs.taxStatus,
    liquidityNeed:     inputs.liquidityNeed,
    existingHoldings:  inputs.existingHoldings ?? [],
    productUniverse:   inputs.productUniverse ?? [inputs.productType],
    productType:       inputs.productType,

    executiveSummary:      data.executiveSummary,
    assetAllocation:       data.assetAllocation,
    productRecommendation: data.productRecommendation,
    expectedReturnRange:   data.expectedReturnRange,
    riskAssessment:        data.riskAssessment,
    liquidityAnalysis:     data.liquidityAnalysis,
    taxationNote:          data.taxationNote,
    suitabilityNote:       data.suitabilityNote,
    disclaimer:            finalDisclaimer,

    confidenceScore: meta.confidence_score,
    modelVersion:    meta.model_version,
    auditId,
    approvalStatus:  initialApprovalStatus,
    sentToClient:    false,

    linkedCrmLeadId: inputs.linkedCrmLeadId,
    requestedBy,
    source: 'ai',
  }).returning({
    id:              aiProposalDrafts.id,
    approvalStatus:  aiProposalDrafts.approvalStatus,
    confidenceScore: aiProposalDrafts.confidenceScore,
  });

  await auditLog({
    userId: requestedBy, agentType: 'proposal', agentAction: 'proposal_draft_generated',
    entityId: proposal.id, entityType: 'ai_proposal_drafts',
    inputContext: {
      investor: inputs.investorName,
      amount:   inputs.amount,
      product:  inputs.productType,
      risk:     inputs.riskProfile,
    },
    outputSummary: isLowConfidence
      ? `[LOW CONFIDENCE ⚠️] ${inputs.productType} proposal for ₹${inputs.amount.toLocaleString('en-IN')} — ${inputs.riskProfile} risk. Human RIA review required before approval.`
      : `${inputs.productType} proposal for ₹${inputs.amount.toLocaleString('en-IN')} — ${inputs.riskProfile} risk`,
    confidenceScore: meta.confidence_score,
    approvalStatus: initialApprovalStatus,
    latencyMs: Date.now() - startMs,
    status: 'success',
    ...(isLowConfidence ? { human_review_required: true, review_reason: `Confidence ${(meta.confidence_score * 100).toFixed(1)}% < ${CONFIDENCE_THRESHOLD * 100}% threshold` } : {}),
  });

  logCopilotEvent('PROPOSAL_AGENT_GENERATE', requestedBy, Date.now() - startMs, 'success', {
    proposalId:      proposal.id,
    product:         inputs.productType,
    confidence:      meta.confidence_score,
    lowConfidence:   isLowConfidence,
    approvalStatus:  initialApprovalStatus,
  });

  return {
    id:              proposal.id,
    approvalStatus:  proposal.approvalStatus ?? 'draft',
    confidenceScore: proposal.confidenceScore ?? meta.confidence_score,
  };
}
