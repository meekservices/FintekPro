/**
 * Finvu Account Aggregator (AA) Credential & Configuration Resolver
 * Conforms to FintekPro Global Coding Rules (GCR v1.0) and Zero-Trust Secret Standards
 */

export function getFinvuClientId(): string {
  return process.env.FINVU_CLIENT_ID || "";
}

export function getFinvuClientSecret(): string {
  return process.env.FINVU_CLIENT_SECRET || "";
}

export function getFinvuFiuEntityId(): string {
  return process.env.FINVU_FIU_ENTITY_ID || "fintekpro-fiu";
}

export function getFinvuBaseUrl(): string {
  if (process.env.FINVU_BASE_URL) {
    return process.env.FINVU_BASE_URL.replace(/\/$/, "");
  }
  // Production vs UAT/Sandbox endpoint
  return process.env.NODE_ENV === "production"
    ? "https://api.finvu.in"
    : "https://finvubox.finvu.in";
}

export function getFinvuWebhookSecret(): string {
  return process.env.FINVU_WEBHOOK_SECRET || "";
}

export function getFinvuPrivateKey(): string {
  return process.env.FINVU_PRIVATE_KEY || "";
}

export function getFinvuCertificate(): string {
  return process.env.FINVU_PUBLIC_CERTIFICATE || "";
}

export function getFinvuRedirectUrl(): string {
  return process.env.FINVU_REDIRECT_URL || "https://app.fintekpro.com/dashboard/net-worth?status=aa_callback";
}

export function getFinvuMasterKey(): string {
  // Master key for AES encryption of ephemeral private keys at rest (must be 32 bytes)
  const key = process.env.FINVU_LOCAL_MASTER_KEY || process.env.SESSION_SECRET || "fintekpro-finvu-ephemeral-key-32";
  return key.padEnd(32, "0").slice(0, 32);
}

export function isFinvuConfigured(): boolean {
  return !!(getFinvuClientId() && getFinvuClientSecret());
}
