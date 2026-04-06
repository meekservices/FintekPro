/**
 * Cashfree Product-Wise Credential Configuration
 *
 * Cashfree has 6 separate products, each with their own App ID + Secret Key:
 *
 *  CASHFREE_PG_APP_ID / CASHFREE_PG_SECRET_KEY          — Payment Gateway
 *  CASHFREE_SECUREID_APP_ID / CASHFREE_SECUREID_SECRET_KEY — Secure ID (KYC: PAN, Aadhaar, Bank)
 *  CASHFREE_PAYOUTS_APP_ID / CASHFREE_PAYOUTS_SECRET_KEY  — Payouts
 *  CASHFREE_SUBSCRIPTIONS_APP_ID / CASHFREE_SUBSCRIPTIONS_SECRET_KEY — Subscriptions
 *  CASHFREE_CROSSBORDER_APP_ID / CASHFREE_CROSSBORDER_SECRET_KEY    — Cross Border
 *  CASHFREE_AUTOCOLLECT_APP_ID / CASHFREE_AUTOCOLLECT_SECRET_KEY    — Auto Collect
 *
 * Environment override (optional — auto-detects from NODE_ENV if not set):
 *  CASHFREE_PG_ENVIRONMENT       — PRODUCTION | SANDBOX  (Payment Gateway)
 *  CASHFREE_SECUREID_ENVIRONMENT — PRODUCTION | SANDBOX  (Secure ID)
 *
 * Legacy backward-compatibility fallbacks (still supported but deprecated):
 *  CASHFREE_APP_ID / CASHFREE_SECRET_KEY → fallback for PG
 *  CASHFREE_VERIFICATION_APP_ID / CASHFREE_VERIFICATION_SECRET_KEY → fallback for Secure ID
 *  CASHFREE_ENVIRONMENT → fallback environment for both PG and Secure ID
 */

function isProductionNode(): boolean {
  return process.env.NODE_ENV === 'production';
}

function resolveEnvironment(productEnvKey: string): 'PRODUCTION' | 'SANDBOX' {
  const explicit =
    process.env[productEnvKey] ||
    process.env.CASHFREE_ENVIRONMENT;
  if (explicit) return explicit.toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
  return isProductionNode() ? 'PRODUCTION' : 'SANDBOX';
}

// ─── Payment Gateway ───────────────────────────────────────────────────────

export function getCashfreePGAppId(): string {
  return process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID || '';
}

export function getCashfreePGSecretKey(): string {
  return process.env.CASHFREE_PG_SECRET_KEY || process.env.CASHFREE_SECRET_KEY || '';
}

export function hasCashfreePGCredentials(): boolean {
  return !!(getCashfreePGAppId() && getCashfreePGSecretKey());
}

export function getCashfreePGEnvironment(): 'PRODUCTION' | 'SANDBOX' {
  return resolveEnvironment('CASHFREE_PG_ENVIRONMENT');
}

export function getCashfreePGBaseUrl(): string {
  return getCashfreePGEnvironment() === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

// ─── Secure ID (KYC Verification: PAN, Aadhaar, Bank) ─────────────────────

export function getCashfreeSecureIDAppId(): string {
  return (
    process.env.CASHFREE_SECUREID_APP_ID ||
    process.env.CASHFREE_VERIFICATION_APP_ID ||
    process.env.CASHFREE_PG_APP_ID ||
    process.env.CASHFREE_APP_ID ||
    ''
  );
}

export function getCashfreeSecureIDSecretKey(): string {
  return (
    process.env.CASHFREE_SECUREID_SECRET_KEY ||
    process.env.CASHFREE_VERIFICATION_SECRET_KEY ||
    process.env.CASHFREE_PG_SECRET_KEY ||
    process.env.CASHFREE_SECRET_KEY ||
    ''
  );
}

export function hasCashfreeSecureIDCredentials(): boolean {
  return !!(getCashfreeSecureIDAppId() && getCashfreeSecureIDSecretKey());
}

export function getCashfreeSecureIDEnvironment(): 'PRODUCTION' | 'SANDBOX' {
  return resolveEnvironment('CASHFREE_SECUREID_ENVIRONMENT');
}

export function getCashfreeSecureIDBaseUrl(): string {
  return getCashfreeSecureIDEnvironment() === 'PRODUCTION'
    ? 'https://api.cashfree.com/verification'
    : 'https://sandbox.cashfree.com/verification';
}

// ─── Payouts ───────────────────────────────────────────────────────────────

export function getCashfreePayoutsAppId(): string {
  return process.env.CASHFREE_PAYOUTS_APP_ID || '';
}

export function getCashfreePayoutsSecretKey(): string {
  return process.env.CASHFREE_PAYOUTS_SECRET_KEY || '';
}

export function hasCashfreePayoutsCredentials(): boolean {
  return !!(getCashfreePayoutsAppId() && getCashfreePayoutsSecretKey());
}

// ─── Subscriptions ─────────────────────────────────────────────────────────

export function getCashfreeSubscriptionsAppId(): string {
  return process.env.CASHFREE_SUBSCRIPTIONS_APP_ID || '';
}

export function getCashfreeSubscriptionsSecretKey(): string {
  return process.env.CASHFREE_SUBSCRIPTIONS_SECRET_KEY || '';
}

export function hasCashfreeSubscriptionsCredentials(): boolean {
  return !!(getCashfreeSubscriptionsAppId() && getCashfreeSubscriptionsSecretKey());
}

// ─── Cross Border ──────────────────────────────────────────────────────────

export function getCashfreeCrossBorderAppId(): string {
  return process.env.CASHFREE_CROSSBORDER_APP_ID || '';
}

export function getCashfreeCrossBorderSecretKey(): string {
  return process.env.CASHFREE_CROSSBORDER_SECRET_KEY || '';
}

export function hasCashfreeCrossBorderCredentials(): boolean {
  return !!(getCashfreeCrossBorderAppId() && getCashfreeCrossBorderSecretKey());
}

// ─── Auto Collect ──────────────────────────────────────────────────────────

export function getCashfreeAutoCollectAppId(): string {
  return process.env.CASHFREE_AUTOCOLLECT_APP_ID || '';
}

export function getCashfreeAutoCollectSecretKey(): string {
  return process.env.CASHFREE_AUTOCOLLECT_SECRET_KEY || '';
}

export function hasCashfreeAutoCollectCredentials(): boolean {
  return !!(getCashfreeAutoCollectAppId() && getCashfreeAutoCollectSecretKey());
}

// ─── Summary (for health checks / admin dashboards) ───────────────────────

export interface CashfreeProductStatus {
  product: string;
  configured: boolean;
  environment: string;
}

export function getCashfreeAllProductStatus(): CashfreeProductStatus[] {
  const pgEnv = getCashfreePGEnvironment();
  const sidEnv = getCashfreeSecureIDEnvironment();
  return [
    { product: 'Payment Gateway', configured: hasCashfreePGCredentials(), environment: pgEnv },
    { product: 'Secure ID', configured: hasCashfreeSecureIDCredentials(), environment: sidEnv },
    { product: 'Payouts', configured: hasCashfreePayoutsCredentials(), environment: pgEnv },
    { product: 'Subscriptions', configured: hasCashfreeSubscriptionsCredentials(), environment: pgEnv },
    { product: 'Cross Border', configured: hasCashfreeCrossBorderCredentials(), environment: pgEnv },
    { product: 'Auto Collect', configured: hasCashfreeAutoCollectCredentials(), environment: pgEnv },
  ];
}
