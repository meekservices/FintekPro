/**
 * FintekPro Loan Origination Constants
 * 
 * This file defines the core domain concepts for loan origination modes.
 * It is a mandatory import for all loan services.
 * 
 * FintekPro operates as a Sub-DSA platform supporting multiple origination modes
 * with a single loan lifecycle, commission engine, and reporting spine.
 * 
 * Origination determines who controls the workflow, not how the loan is processed financially.
 */

/**
 * OriginationMode - Determines how the loan application was initiated
 * 
 * SELF_SERVICE: Customer directly applies through the platform (marketplace flow)
 * AGENT_ASSISTED: Agent assists the customer with the application (Sub-DSA flow)
 */
export enum OriginationMode {
  SELF_SERVICE = "SELF_SERVICE",
  AGENT_ASSISTED = "AGENT_ASSISTED"
}

/**
 * RoutingIntent - Determines how the loan should be routed to lenders
 * 
 * MARKETPLACE: System auto-routes to eligible banks based on eligibility rules
 * SPECIFIC_BANKS: Agent manually selects target banks (no auto-routing)
 */
export enum RoutingIntent {
  MARKETPLACE = "MARKETPLACE",
  SPECIFIC_BANKS = "SPECIFIC_BANKS"
}

/**
 * WorkflowOwner - Determines who owns the loan workflow and SLA
 * 
 * SYSTEM: Platform-owned workflow with system SLA tracking
 * AGENT: Agent-owned workflow with agent accountability
 */
export enum WorkflowOwner {
  SYSTEM = "SYSTEM",
  AGENT = "AGENT"
}

/**
 * BankInteractionEventType - Types of bank interaction events for audit trail
 */
export enum BankInteractionEventType {
  RECEIVED = "RECEIVED",
  QUERY = "QUERY",
  APPROVED = "APPROVED",
  DISBURSED = "DISBURSED"
}

/**
 * BankInteractionReporter - Who reported the bank interaction event
 */
export enum BankInteractionReporter {
  AGENT = "AGENT",
  WEBHOOK = "WEBHOOK",
  ADMIN = "ADMIN"
}

/**
 * Sub-DSA Lender Disclaimer - Required before first bank submission
 * This disclaimer must be accepted and timestamped for regulatory compliance.
 */
export const LENDER_DISCLAIMER_TEXT = `FintekPro acts as a Sub-DSA / facilitation platform. Final credit decision rests with the lender.`;

/**
 * Default origination settings for different flows
 */
export const SELF_SERVICE_DEFAULTS = {
  originationMode: OriginationMode.SELF_SERVICE,
  routingIntent: RoutingIntent.MARKETPLACE,
  workflowOwner: WorkflowOwner.SYSTEM,
} as const;

export const AGENT_ASSISTED_DEFAULTS = {
  originationMode: OriginationMode.AGENT_ASSISTED,
  routingIntent: RoutingIntent.SPECIFIC_BANKS,
  workflowOwner: WorkflowOwner.AGENT,
} as const;

/**
 * Validation helpers
 */
export function isValidOriginationMode(mode: string): mode is OriginationMode {
  return Object.values(OriginationMode).includes(mode as OriginationMode);
}

export function isValidRoutingIntent(intent: string): intent is RoutingIntent {
  return Object.values(RoutingIntent).includes(intent as RoutingIntent);
}

export function isValidWorkflowOwner(owner: string): owner is WorkflowOwner {
  return Object.values(WorkflowOwner).includes(owner as WorkflowOwner);
}

/**
 * Routing discipline enforcement
 * SELF_SERVICE → cannot use manual routing (SPECIFIC_BANKS)
 * AGENT_ASSISTED → cannot trigger auto-routing (MARKETPLACE)
 */
export function validateRoutingDiscipline(
  originationMode: OriginationMode,
  routingIntent: RoutingIntent
): { valid: boolean; error?: string } {
  if (originationMode === OriginationMode.SELF_SERVICE && routingIntent === RoutingIntent.SPECIFIC_BANKS) {
    return {
      valid: false,
      error: "Self-service applications cannot use manual bank routing. Use marketplace routing instead."
    };
  }
  
  if (originationMode === OriginationMode.AGENT_ASSISTED && routingIntent === RoutingIntent.MARKETPLACE) {
    return {
      valid: false,
      error: "Agent-assisted applications cannot use marketplace auto-routing. Use specific bank routing instead."
    };
  }
  
  return { valid: true };
}

/**
 * Commission policy version - allows negotiated agent deals and future changes
 */
export const CURRENT_COMMISSION_POLICY_VERSION = "v1";
