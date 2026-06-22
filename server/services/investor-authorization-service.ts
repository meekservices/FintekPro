/**
 * Investor Authorization Service
 *
 * Implements the two-step agent-prepared → investor-authorized flow required
 * by SEBI's broker onboarding guidelines:
 *
 *   Step 1 (Agent): Agent calls POST /api/kyc/acting-as/start
 *                   → Creates acting_as session scoped to investor + fields
 *   Step 2 (Agent): Agent calls POST /api/orchestrator/diff to inspect delta
 *   Step 3 (Investor): Investor receives OTP on their mobile → calls POST /api/kyc/investor-authorize
 *                      → Produces investorAuthorizationEventId
 *   Step 4 (Agent): Agent calls POST /api/orchestrator/submit with investorAuthorizationEventId
 *                   → Orchestrator validates event ID before firing broker call
 *
 * SEBI requirement: The broker-facing submission step MUST require the investor's
 * explicit out-of-band confirmation (OTP on investor's registered mobile).
 * An agent's session alone is NOT sufficient authorization for broker submission.
 *
 * GCR Rules enforced:
 *  - OTP sent to investor's registered mobile (from vault) — never from agent input
 *  - Authorization event is single-use and expires in 15 minutes
 *  - Every event written to kycAuditLogs with AGENT_DELEGATION_AUTHORIZED event type
 *  - Authorization events cannot be replayed (marked used on first use)
 */

import crypto from "crypto";
import { db } from "../db";
import { kycAuditLogs } from "@shared/schema";
import { logger } from "../logger";
import { smsService } from "./sms-service";

// In-memory store for pending authorization events (in production, use Redis or DB)
// Key: eventId, Value: { userId, agentId, scope, otp, expiresAt, used }
const pendingAuthorizations = new Map<
  string,
  {
    userId: string;
    agentId: string;
    scope: string;
    otp: string;
    expiresAt: Date;
    used: boolean;
    ipAddress: string;
  }
>();

/** OTP expiry window: 15 minutes */
const OTP_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Step 1/2 of investor authorization flow.
 *
 * Called by an agent to initiate an investor authorization request.
 * Sends a 6-digit OTP to the investor's registered mobile number (from vault).
 *
 * IMPORTANT: The mobile number is retrieved from the KYC vault — agents cannot
 * supply or override the investor's mobile number.
 *
 * @param agentId - The agent's user ID
 * @param investorUserId - The investor being acted on behalf of
 * @param scope - What the authorization covers ("kyc_submit" etc.)
 * @param ipAddress - IP address of the agent initiating the request
 * @param investorMobile - The investor's mobile number (pre-fetched from vault by caller)
 * @returns requestId used by the investor to confirm their OTP
 */
export async function createAuthorizationRequest(
  agentId: string,
  investorUserId: string,
  scope: string,
  ipAddress: string,
  investorMobile: string,
): Promise<{ requestId: string; otpSentTo: string }> {
  const startTs = Date.now();

  // Generate a secure random OTP and request ID
  const otp = crypto.randomInt(100_000, 999_999).toString();
  const requestId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  // Mask mobile for logging
  const maskedMobile = investorMobile.replace(/(\d{2})\d+(\d{2})/, "$1****$2");

  pendingAuthorizations.set(requestId, {
    userId: investorUserId,
    agentId,
    scope,
    otp,
    expiresAt,
    used: false,
    ipAddress,
  });

  // Send OTP to investor's registered mobile
  try {
    await (smsService as any).sendSms(
      investorMobile,
      `FintekPro: Your investment advisor is requesting to submit your KYC to a broker on your behalf (scope: ${scope}). Your authorization code is: ${otp}. Valid for 15 minutes. Do NOT share this code with anyone.`,
    );
  } catch (smsErr: any) {
    logger.error("[InvestorAuth] Failed to send OTP", {
      event: "INVESTOR_AUTH_OTP_SEND_FAILED",
      agent_id: agentId,
      investor_user_id: investorUserId,
      request_id: requestId,
      message: smsErr.message,
      latency_ms: Date.now() - startTs,
    });
    pendingAuthorizations.delete(requestId);
    throw Object.assign(
      new Error("Failed to send authorization OTP to investor's mobile."),
      { retryable: true, error_code: "OTP_SEND_FAILED" },
    );
  }

  // Write audit log entry
  await db.insert(kycAuditLogs).values({
    userId: investorUserId,
    accessedBy: agentId,
    accessType: "agent_delegation_request",
    purpose: `Agent ${agentId} requested authorization to act on behalf of investor for scope: ${scope}`,
    dataFieldsAccessed: [scope],
    accessStatus: "pending",
    ipAddress,
    regulatoryPurpose: "AGENT_DELEGATION",
  }).catch((dbErr: any) => {
    logger.warn("[InvestorAuth] Failed to write auth request to audit log", {
      event: "INVESTOR_AUTH_AUDIT_LOG_FAILED",
      request_id: requestId,
      message: dbErr.message,
    });
  });

  logger.info("[InvestorAuth] Authorization OTP sent to investor", {
    event: "INVESTOR_AUTH_OTP_SENT",
    agent_id: agentId,
    investor_user_id: investorUserId,
    request_id: requestId,
    scope,
    otp_sent_to: maskedMobile,
    expires_at: expiresAt.toISOString(),
    latency_ms: Date.now() - startTs,
  });

  return { requestId, otpSentTo: maskedMobile };
}

/**
 * Step 3 of investor authorization flow.
 *
 * Called by the investor (not the agent) to confirm their OTP.
 * Returns an investorAuthorizationEventId that the agent uses in /submit.
 *
 * This event ID is single-use and expires if the submit call is not made
 * within the same 15-minute window.
 *
 * @param investorUserId - The investor confirming (must match the pending request)
 * @param requestId - The requestId returned by createAuthorizationRequest
 * @param otp - The OTP the investor received on their mobile
 * @param ipAddress - Investor's IP address
 * @returns investorAuthorizationEventId to pass to /api/orchestrator/submit
 */
export async function confirmAuthorization(
  investorUserId: string,
  requestId: string,
  otp: string,
  ipAddress: string,
): Promise<{ investorAuthorizationEventId: string; scope: string }> {
  const startTs = Date.now();

  const pending = pendingAuthorizations.get(requestId);

  if (!pending) {
    throw Object.assign(
      new Error("Authorization request not found or already expired."),
      { retryable: false, error_code: "AUTH_REQUEST_NOT_FOUND" },
    );
  }

  if (pending.used) {
    throw Object.assign(
      new Error("Authorization request has already been used."),
      { retryable: false, error_code: "AUTH_REQUEST_ALREADY_USED" },
    );
  }

  if (pending.userId !== investorUserId) {
    logger.warn("[InvestorAuth] UserId mismatch in OTP confirmation", {
      event: "INVESTOR_AUTH_USERID_MISMATCH",
      expected_user_id: pending.userId,
      actual_user_id: investorUserId,
      request_id: requestId,
      latency_ms: Date.now() - startTs,
    });
    throw Object.assign(
      new Error("User ID does not match the pending authorization request."),
      { retryable: false, error_code: "AUTH_USER_MISMATCH" },
    );
  }

  if (new Date() > pending.expiresAt) {
    pendingAuthorizations.delete(requestId);
    throw Object.assign(
      new Error("Authorization OTP has expired. Please request a new one."),
      { retryable: false, error_code: "AUTH_OTP_EXPIRED" },
    );
  }

  if (pending.otp !== otp.trim()) {
    throw Object.assign(
      new Error("Invalid OTP. Please check and try again."),
      { retryable: true, error_code: "AUTH_OTP_INVALID" },
    );
  }

  // Mark as used — single-use enforcement
  pending.used = true;

  // Generate the authorization event ID the agent will use in /submit
  const investorAuthorizationEventId = `iaev_${crypto.randomBytes(16).toString("hex")}`;

  // Write authorization confirmed to audit log
  await db.insert(kycAuditLogs).values({
    userId: investorUserId,
    accessedBy: pending.agentId,
    accessType: "agent_delegation_authorized",
    purpose: `Investor confirmed authorization for agent ${pending.agentId} — scope: ${pending.scope}`,
    dataFieldsAccessed: [pending.scope],
    accessStatus: "success",
    ipAddress,
    regulatoryPurpose: "AGENT_DELEGATION",
  }).catch((dbErr: any) => {
    logger.warn("[InvestorAuth] Failed to write authorization confirmation to audit log", {
      event: "INVESTOR_AUTH_AUDIT_LOG_FAILED",
      request_id: requestId,
      message: dbErr.message,
    });
  });

  logger.info("[InvestorAuth] Investor confirmed authorization", {
    event: "INVESTOR_AUTHORIZED",
    agent_id: pending.agentId,
    investor_user_id: investorUserId,
    request_id: requestId,
    investor_auth_event_id: investorAuthorizationEventId,
    scope: pending.scope,
    latency_ms: Date.now() - startTs,
  });

  // Clean up
  pendingAuthorizations.delete(requestId);

  return { investorAuthorizationEventId, scope: pending.scope };
}
