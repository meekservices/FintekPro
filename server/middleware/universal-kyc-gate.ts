/**
 * Universal KYC Compliance Gate
 *
 * Regulatory Basis:
 * - PMLA 2002, Section 12: Reporting entities must maintain KYC records for ALL
 *   persons associated with the entity, including staff and agents.
 * - RBI Master Direction on KYC 2016 (amended 2023), Part B: All employees of
 *   regulated entities handling financial transactions must be KYC-verified.
 * - SEBI KYC Registration (KRA) Regulations: All intermediaries and their staff
 *   must complete KYC before conducting any regulated activity.
 * - AMFI Circular on ARN Holders: All ARN/EUIN holders must be KYC-compliant
 *   through a KYC Registration Agency before distributing mutual funds.
 * - IRDAI Regulations: All insurance agents must complete KYC before soliciting.
 *
 * This middleware applies to EVERY authenticated API request regardless of role.
 * Internal operations (webhooks, health checks, KYC completion routes) are exempt.
 */

import { Request, Response, NextFunction } from 'express';
import { getUserKYCLevel } from './kyc-level-gate';
import type { RoleId } from '@shared/roles';
import { logger } from '../logger';

// Per-user KYC compliance cache — avoids DB hit on every API call
// TTL: 5 minutes; invalidated on any KYC write event
const COMPLIANCE_CACHE = new Map<string, {
  compliant: boolean;
  currentLevel: '0' | '1' | '2';
  requiredLevel: '0' | '1' | '2';
  missingRequirements: string[];
  cachedAt: number;
}>();

const COMPLIANCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Minimum KYC level required per role.
 *
 * Level 0 = no KYC required (browse only / internal testing)
 * Level 1 = PAN + Address OVD + Photograph  (Standard KYC — RBI / PMLA)
 * Level 2 = Level 1 + CKYC/KRA + Video KYC + Bank verification  (Full KYC — SEBI)
 *
 * Regulatory mapping:
 *  superadmin      → L1  PMLA §12 — all reporting-entity personnel
 *  master_agent    → L2  SEBI/AMFI — ARN/EUIN/POSP compliance anchor
 *  admin           → L1  PMLA — internal admin staff
 *  bd_head/team    → L1  PMLA — business development staff
 *  compliance_*    → L2  SEBI/PMLA — compliance function personnel
 *  finance_*       → L1  PMLA — finance staff
 *  ops_*           → L1  PMLA — operations staff
 *  hr_*            → L1  PMLA — HR staff
 *  tech_*          → L1  PMLA — technology staff
 *  regulatory_*    → L2  SEBI — regulatory audit function
 *  partner         → L2  SEBI LODR + AMFI — distribution partner
 *  partner_ops     → L1  PMLA — partner support staff
 *  agent           → L1  AMFI/IRDAI — individual agent
 *  sub_agent       → L1  AMFI — field executive
 *  associate       → L1  AMFI — business associate
 *  client          → L1  RBI — retail client minimum
 *  business_client → L1  RBI/PMLA — business client
 *  user            → L1  RBI — default user
 *  tester          → L0  Internal — exempt for platform testing
 */
export const ROLE_KYC_MINIMUM: Record<string, '0' | '1' | '2'> = {
  // Top level
  superadmin: '1',
  master_agent: '2',

  // Admin department heads
  admin: '1',
  bd_head: '1',
  compliance_officer: '2',
  finance_head: '1',
  ops_head: '1',
  hr_head: '1',
  tech_head: '1',
  regulatory_auditor: '2',

  // Admin team members
  bd_team: '1',
  compliance_team: '1',
  finance_team: '1',
  ops_team: '1',
  hr_team: '1',
  tech_backend: '1',
  tech_frontend: '1',
  tech_devops: '1',

  // External distribution
  partner: '2',
  partner_ops: '1',
  agent: '1',
  sub_agent: '1',
  associate: '1',

  // Client types — Level 0 so they can explore freely.
  // Transaction endpoints enforce Level 1 separately via isClientTransactionPath().
  client: '0',
  business_client: '0',
  user: '0',

  // Internal testing — exempt
  tester: '0',
};

/**
 * Roles that are pure end-clients — they can explore freely but need KYC to transact.
 */
const CLIENT_EXPLORE_ROLES = new Set(['client', 'user', 'business_client']);

/**
 * Transaction paths that require KYC Level 1 even for explore-mode client roles.
 * Anything not in this list is considered "explore" and allowed without KYC.
 */
const CLIENT_TRANSACTION_PATHS = [
  '/api/orders',
  '/api/mf/purchase',
  '/api/mf/redeem',
  '/api/mf/switch',
  '/api/mf/lumpsum',
  '/api/mf/folio',
  '/api/sip',
  '/api/us-trading/accounts',
  '/api/us-trading/orders',
  '/api/us-trading/activate',
  '/api/bonds/orders',
  '/api/bonds/purchase',
  '/api/unlisted/orders',
  '/api/unlisted/purchase',
  '/api/investments',
  '/api/withdrawal',
  '/api/transfer',
  '/api/payments/cashfree/create-order',
  '/api/payments/create',
  '/api/payments/initiate',
  '/api/ipo/apply',
  '/api/nps/invest',
  '/api/portfolio/rebalance',
  '/api/portfolio/buy',
  '/api/portfolio/sell',
  '/api/fixed-deposits/book',
  '/api/insurance/purchase',
  '/api/loan/apply',
  '/api/loan/apply-now',
  '/api/gold/buy',
  '/api/gold/sell',
];

function isClientTransactionPath(path: string): boolean {
  return CLIENT_TRANSACTION_PATHS.some(prefix => path.startsWith(prefix));
}

/**
 * Paths that are exempt from KYC enforcement.
 * These are required to allow users to log in and complete their KYC.
 */
const EXEMPT_PREFIXES = [
  '/api/auth',        // Login / register / OAuth
  '/api/kyc',         // All KYC completion routes (cannot block these!)
  '/api/user',        // Own profile reads (needed for UI to load)
  '/api/health',      // Infrastructure
  '/api/admin/kyc',   // Admin KYC management — admin must be able to approve KYC even before their own is done
  '/api/agent/kyc',   // Agent KYC empanelment flow
  '/api/ready',
  '/api/live',
  '/api/webhooks',    // External webhooks
  '/api/twilio',      // Twilio webhooks
  '/api/zoho/webhooks',
  '/api/payments/cashfree/webhook',
  '/api/payments/phonepe/callback',
  '/api/webhooks/sandbox',
  '/api/onboarding',  // Profile setup (prerequisite to KYC)
  '/api/uploads',     // Document uploads for KYC
  '/api/bbps',        // DigiLocker / BBPS (used during Aadhaar OTP)
  '/api/digilocker',
  '/api/agent-empanelment', // Agent KYC empanelment flow
  '/api/admin/kyc',   // Admin KYC management
];

const EXEMPT_EXACT = new Set([
  '/api/version',
  '/api/user',
  '/api/login',
  '/api/register',
  '/api/logout',
]);

function isExempt(path: string): boolean {
  if (EXEMPT_EXACT.has(path)) return true;
  return EXEMPT_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Derive the highest-priority role from the user's roles array.
 * Uses the ROLE_KYC_MINIMUM map — highest required level wins.
 */
function getRequiredKycLevel(roles: string[]): '0' | '1' | '2' {
  let required: '0' | '1' | '2' = '0';
  for (const role of roles) {
    const min = ROLE_KYC_MINIMUM[role] ?? '1'; // default Level 1 for unknown roles
    if (min === '2') return '2';               // short-circuit — can't go higher
    if (min === '1' && required === '0') required = '1';
  }
  return required;
}

function hasRequiredLevel(current: '0' | '1' | '2', required: '0' | '1' | '2'): boolean {
  return parseInt(current) >= parseInt(required);
}

/**
 * Invalidate the cached compliance status for a user.
 * Call this after any KYC write event.
 */
export function invalidateComplianceCache(userId: string): void {
  COMPLIANCE_CACHE.delete(userId);
}

/**
 * Get the compliance status for a user (with caching).
 */
export async function getComplianceStatus(user: any): Promise<{
  compliant: boolean;
  currentLevel: '0' | '1' | '2';
  requiredLevel: '0' | '1' | '2';
  missingRequirements: string[];
  regulatoryBasis: string[];
}> {
  const userId: string = user.id;
  const userRoles: string[] = user.roles || (user.role ? [user.role] : ['user']);
  const requiredLevel = getRequiredKycLevel(userRoles);

  // Tester role or required level 0 — always compliant
  if (requiredLevel === '0') {
    return {
      compliant: true,
      currentLevel: '0',
      requiredLevel: '0',
      missingRequirements: [],
      regulatoryBasis: ['Internal testing role — KYC not required'],
    };
  }

  // Check cache
  const cached = COMPLIANCE_CACHE.get(userId);
  if (cached && Date.now() - cached.cachedAt < COMPLIANCE_CACHE_TTL_MS) {
    const regulatoryBasis = buildRegulatoryBasis(userRoles, requiredLevel);
    return {
      compliant: cached.compliant,
      currentLevel: cached.currentLevel,
      requiredLevel: cached.requiredLevel,
      missingRequirements: cached.missingRequirements,
      regulatoryBasis,
    };
  }

  // Compute from DB
  const { level: currentLevel, complianceDetails } = await getUserKYCLevel(userId);
  const compliant = hasRequiredLevel(currentLevel, requiredLevel);

  const entry = {
    compliant,
    currentLevel,
    requiredLevel,
    missingRequirements: complianceDetails.missingRequirements,
    cachedAt: Date.now(),
  };
  COMPLIANCE_CACHE.set(userId, entry);

  return {
    ...entry,
    regulatoryBasis: buildRegulatoryBasis(userRoles, requiredLevel),
  };
}

function buildRegulatoryBasis(roles: string[], requiredLevel: '0' | '1' | '2'): string[] {
  const basis: string[] = ['PMLA 2002, Section 12 — KYC for all persons in Reporting Entity'];

  if (roles.some(r => ['master_agent', 'partner'].includes(r))) {
    basis.push('SEBI KRA Regulations — ARN/EUIN holders must complete Full KYC');
    basis.push('AMFI Circular — Distributors must be KYC-compliant before soliciting');
  }
  if (roles.some(r => ['agent', 'sub_agent', 'associate'].includes(r))) {
    basis.push('AMFI/IRDAI Circular — Agents must complete KYC before distributing products');
  }
  if (roles.some(r => ['compliance_officer', 'regulatory_auditor'].includes(r))) {
    basis.push('SEBI LODR — Compliance function personnel require Full KYC');
  }
  if (roles.some(r => ['client', 'user', 'business_client'].includes(r))) {
    basis.push('RBI Master Direction on KYC 2016 — Minimum Standard KYC for all account holders');
  }

  return basis;
}

/**
 * Express middleware: blocks any authenticated user whose KYC level is below
 * the minimum required for their role.
 *
 * Returns HTTP 403 with:
 *   { code: 'KYC_REQUIRED', requiredLevel, currentLevel, missingRequirements, redirectTo }
 */
export async function universalKycGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Not authenticated — auth middleware handles this separately
  if (!req.user) return next();

  // Exempt paths — KYC completion flows, webhooks, health checks
  if (isExempt(req.path)) return next();

  // ── Client / user / business_client explore-mode logic ──────────────────────
  // These roles can browse the platform freely. KYC is only enforced when they
  // attempt an actual financial transaction (order, investment, payment, etc.).
  const userRolesEarly: string[] = (req.user as any).roles
    || ((req.user as any).role ? [(req.user as any).role] : ['user']);
  const isPureClientRole = userRolesEarly.every(r => CLIENT_EXPLORE_ROLES.has(r));

  if (isPureClientRole) {
    if (!isClientTransactionPath(req.path)) {
      return next(); // Exploration allowed without KYC
    }
    // Transaction path — enforce Level 1 KYC
    try {
      const { level: currentLevel } = await getUserKYCLevel((req.user as any).id);
      if (parseInt(currentLevel) >= 1) return next();
      res.status(403).json({
        code: 'KYC_REQUIRED',
        message: 'Please complete your KYC verification before placing orders or investing.',
        requiredLevel: '1',
        currentLevel,
        redirectTo: '/onboarding',
        transactionBlocked: true,
      });
      return;
    } catch {
      return next(); // fail-open
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  try {
    const user = req.user as any;
    const status = await getComplianceStatus(user);

    if (status.compliant) return next();

    res.status(403).json({
      code: 'KYC_REQUIRED',
      message: `KYC verification required before accessing this platform. Complete your ${status.requiredLevel === '2' ? 'Full KYC (Level 2)' : 'Standard KYC (Level 1)'} to continue.`,
      requiredLevel: status.requiredLevel,
      currentLevel: status.currentLevel,
      missingRequirements: status.missingRequirements,
      regulatoryBasis: status.regulatoryBasis,
      redirectTo: '/profile?tab=kyc-dashboard',
    });
  } catch (err) {
    // Never crash the request — if KYC check fails, allow through and log
    logger.error('[UniversalKycGate] Error checking compliance, allowing through', { error: err instanceof Error ? err.message : String(err) });
    next();
  }
}
