/**
 * deskAgent.ts — Zoho Desk Intelligence Agent (Phase 2 stub)
 * Phase 2: Sync tickets, classify, SLA breach risk, draft responses.
 * GUARDRAIL: Never closes tickets without Admin approval.
 */
export const DESK_AGENT_PHASE = 2;
export async function syncDeskTickets(_connectionId: string, _adminUserId: string): Promise<void> {
  throw new Error('Desk Agent is scheduled for Phase 2.');
}
