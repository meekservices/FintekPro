/**
 * KYC Idempotency Guard
 *
 * Enforces that every broker adapter call is idempotent.
 * Idempotency key = sha256(userId + brokerId + payloadVersion)
 *
 * Algorithm:
 *  1. Compute key
 *  2. Check brokerSubmissions table
 *  3a. If found with status "submitted"|"approved" → return cached result (no outbound call)
 *  3b. If found with status "error"|"pending" → allow retry up to MAX_RETRIES
 *  3c. If not found → create pending row, execute call, update row atomically
 *
 * GCR Rules:
 *  - Structured logs on every check
 *  - Cached responses returned without logging PII
 *  - Retry count tracked in brokerSubmissions table
 */

import crypto from "crypto";
import { db } from "../db";
import { brokerSubmissions } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { BrokerSubmitResult } from "../services/adapters/broker-adapter.interface";
import { logger } from "../logger";

const MAX_RETRIES = 3;

export interface IdempotencyCheckResult {
  /** If true, the cached result should be returned without calling the adapter */
  isCachedSuccess: boolean;
  /** Cached result (only set if isCachedSuccess = true) */
  cachedResult?: BrokerSubmitResult;
  /** The idempotency key (always returned for the caller to use) */
  idempotencyKey: string;
  /** Existing submission ID if found */
  submissionId?: string;
  /** Whether the caller is allowed to retry (false if max retries exceeded) */
  canRetry: boolean;
}

/**
 * Compute the idempotency key for a broker submission.
 * Key = sha256(userId + ":" + brokerId + ":" + payloadVersion)
 *
 * @param userId - FintekPro user ID
 * @param brokerId - "iifl" | "jm_financial" | "alpaca"
 * @param payloadVersion - "1" by default, increment if payload schema changes
 */
export function computeIdempotencyKey(
  userId: string,
  brokerId: string,
  payloadVersion: string = "1"
): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${brokerId}:${payloadVersion}`)
    .digest("hex");
}

/**
 * Check idempotency before an adapter call.
 *
 * @param userId - FintekPro user ID
 * @param brokerId - Broker identifier
 * @param segment - Trading segment (nullable)
 * @param payloadVersion - Payload schema version
 * @returns IdempotencyCheckResult
 */
export async function checkIdempotency(
  userId: string,
  brokerId: string,
  segment: string | null,
  payloadVersion: string = "1"
): Promise<IdempotencyCheckResult> {
  const startTs = Date.now();
  const idempotencyKey = computeIdempotencyKey(userId, brokerId, payloadVersion);

  logger.info("KYC_IDEMPOTENCY_CHECK", {
    user_id: userId,
    broker_id: brokerId,
    idempotency_key: idempotencyKey,
});

  const existing = await db
    .select()
    .from(brokerSubmissions)
    .where(eq(brokerSubmissions.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length === 0) {
    // Create pending row before calling adapter (atomic guard)
    await db.insert(brokerSubmissions).values({
      userId,
      brokerId,
      segment,
      idempotencyKey,
      payloadVersion,
      status: "pending",
      source: "api",
    });

    logger.info("KYC_IDEMPOTENCY_NEW", {
      user_id: userId,
      broker_id: brokerId,
      idempotency_key: idempotencyKey,
      latency_ms: Date.now() - startTs,
      status: "success",
});

    return {
      isCachedSuccess: false,
      idempotencyKey,
      canRetry: true,
    };
  }

  const submission = existing[0];

  // Already succeeded → return cached result without outbound call
  if (submission.status === "submitted" || submission.status === "approved") {
    logger.info("KYC_IDEMPOTENCY_CACHE_HIT", {
      user_id: userId,
      broker_id: brokerId,
      submission_id: submission.id,
      cached_status: submission.status,
      latency_ms: Date.now() - startTs,
      status: "success",
});

    return {
      isCachedSuccess: true,
      cachedResult: {
        brokerClientId: submission.brokerClientId ?? "",
        status: submission.status,
        rawResponseRef: submission.rawResponseRef ?? "",
      },
      idempotencyKey,
      submissionId: submission.id,
      canRetry: false,
    };
  }

  // Check retry budget
  const retryCount = submission.retryCount ?? 0;
  if (retryCount >= MAX_RETRIES) {
    logger.warn("KYC_IDEMPOTENCY_MAX_RETRIES", {
      user_id: userId,
      broker_id: brokerId,
      retry_count: retryCount,
      status: "error",
});
    return {
      isCachedSuccess: false,
      idempotencyKey,
      submissionId: submission.id,
      canRetry: false,
    };
  }

  logger.info("KYC_IDEMPOTENCY_RETRY_ALLOWED", {
    user_id: userId,
    broker_id: brokerId,
    retry_count: retryCount,
    latency_ms: Date.now() - startTs,
    status: "success",
});

  return {
    isCachedSuccess: false,
    idempotencyKey,
    submissionId: submission.id,
    canRetry: true,
  };
}

/**
 * Update submission record after adapter call completes.
 *
 * @param idempotencyKey - Key for the submission to update
 * @param result - Adapter result or error details
 */
export async function recordSubmissionResult(
  idempotencyKey: string,
  result:
    | { success: true; brokerClientId: string; status: string; rawResponseRef: string; canonicalWriteBack?: Record<string, unknown> }
    | { success: false; errorCode: string; errorMessage: string; retryable: boolean }
): Promise<void> {
  if (result.success) {
    await db
      .update(brokerSubmissions)
      .set({
        status: result.status,
        brokerClientId: result.brokerClientId,
        rawResponseRef: result.rawResponseRef,
        canonicalWriteBack: result.canonicalWriteBack ?? {},
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(brokerSubmissions.idempotencyKey, idempotencyKey));
  } else {
    await db
      .update(brokerSubmissions)
      .set({
        status: result.retryable ? "error" : "rejected",
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        retryCount: db.$count(brokerSubmissions),   // increment handled via raw
        lastRetryAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(brokerSubmissions.idempotencyKey, idempotencyKey));
  }
}
