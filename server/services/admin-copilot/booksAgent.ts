/**
 * booksAgent.ts — Zoho Books Finance Agent (Phase 2 stub)
 * Phase 2: Sync invoices/payments/expenses, draft invoices, payout calc, GST summary.
 * GUARDRAIL: AI never issues invoices, marks payments received, or releases payouts.
 * Requires env var ZOHO_BOOKS_ORG_ID.
 */
export const BOOKS_AGENT_PHASE = 2;
export async function syncBooksData(_connectionId: string, _adminUserId: string): Promise<void> {
  throw new Error('Books Agent is scheduled for Phase 2. Ensure ZOHO_BOOKS_ORG_ID is set.');
}
