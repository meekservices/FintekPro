/**
 * crmAgent.ts — Zoho CRM Intelligence Agent (Phase 2 stub)
 * Phase 2: Sync leads from Zoho CRM, generate AI lead intelligence, route leads.
 * GUARDRAIL: Stage updates require Admin approval before writing back to Zoho CRM.
 */
export const CRM_AGENT_PHASE = 2;
export async function syncCrmLeads(_connectionId: string, _adminUserId: string): Promise<void> {
  throw new Error('CRM Agent is scheduled for Phase 2. Please connect your Zoho CRM and re-deploy.');
}
