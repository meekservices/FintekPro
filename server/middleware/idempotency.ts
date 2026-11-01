/**
 * Idempotency Middleware — FintekPro GCR v1.0
 *
 * Purpose:  Prevent duplicate write operations on payment and bond order
 *           endpoints by checking the X-Idempotency-Key header against
 *           the payment_idempotency_keys table.
 *
 * Usage:    Apply to POST routes that should be idempotent:
 *           app.post("/api/payments/...", requireIdempotencyKey, handler)
 *
 * Flow:
 *   1. Read X-Idempotency-Key header — reject 400 if missing
 *   2. Lookup in DB for (userId, idempotencyKey) — if found & not expired,
 *      short-circuit with 200 + cached response
 *   3. Continue to handler; handler is responsible for storing the key
 *      after successful write (via storeIdempotencyResult)
 *
 * Inputs:   Express Request with header X-Idempotency-Key
 * Outputs:  Continues to next() or returns 400 / 200 (cached)
 * Edge cases:
 *   - Expired keys are ignored (treated as new request)
 *   - Unauthenticated requests pass through (guard applied at auth layer)
 *   - Key must be 8–128 chars; UUID v4 format recommended
 *
 * @module server/middleware/idempotency
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { paymentIdempotencyKeys } from "@shared/schema";
import { and, eq, gt } from "drizzle-orm";
import { logger } from "../logger";

const MAX_KEY_LENGTH = 128;
const MIN_KEY_LENGTH = 8;

/**
 * Middleware: Require a valid X-Idempotency-Key header.
 * Returns 400 if the header is missing or malformed.
 * Returns 200 with the cached response if the key has been seen before.
 * Otherwise continues to the route handler.
 */
export async function requireIdempotencyKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const key = req.headers["x-idempotency-key"];

  if (!key || typeof key !== "string") {
    res.status(400).json({
      success:    false,
      error_code: "MISSING_IDEMPOTENCY_KEY",
      message:    "X-Idempotency-Key header is required for this operation.",
      retryable:  false,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
    return;
  }

  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    res.status(400).json({
      success:    false,
      error_code: "INVALID_IDEMPOTENCY_KEY",
      message:    `X-Idempotency-Key must be ${MIN_KEY_LENGTH}–${MAX_KEY_LENGTH} characters.`,
      retryable:  false,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
    return;
  }

  // Attach key to request for downstream use
  req.idempotencyKey = key;

  const userId = (req as Request & { user?: { id: string } }).user?.id;
  if (!userId) {
    // No authenticated user — let auth middleware handle rejection
    next();
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(paymentIdempotencyKeys)
      .where(and(
        eq(paymentIdempotencyKeys.idempotencyKey, key),
        eq(paymentIdempotencyKeys.userId, userId),
        gt(paymentIdempotencyKeys.expiresAt, new Date()),  // not expired
      ))
      .limit(1);

    if (existing) {
      logger.info("IDEMPOTENCY_KEY_HIT", {
        event:           "IDEMPOTENCY_KEY_HIT",
        user_id:         userId,
        idempotency_key: key,
        order_id:        existing.orderId,
        latency_ms:      0,
        status:          "cached",
      });

      // Return cached response
      res.status(200).json({
        success: true,
        data:    existing.responsePayload,
        meta: {
          idempotent:      true,
          idempotency_key: key,
          timestamp:       new Date().toISOString(),
          version:         "1.0",
        },
      });
      return;
    }
  } catch (err: unknown) {
    // Non-fatal — allow request through if DB check fails
    logger.error("IDEMPOTENCY_CHECK_FAILED", {
      event:      "IDEMPOTENCY_CHECK_FAILED",
      user_id:    userId,
      error_code: "DB_ERROR",
      retryable:  true,
      error:      err instanceof Error ? err.message : String(err),
    });
  }

  next();
}

/**
 * Store an idempotency key result after a successful write.
 * Call this from route handlers after completing the operation.
 *
 * @param userId          - Authenticated user ID
 * @param key             - The X-Idempotency-Key value
 * @param orderId         - Created order / transaction ID
 * @param gateway         - Payment gateway or service name (e.g. "bond", "mf", "cashfree")
 * @param responsePayload - The response body to cache
 * @param ttlHours        - How long to cache the result (default: 24h)
 */
export async function storeIdempotencyResult(
  userId: string,
  key: string,
  orderId: string,
  gateway: string,
  responsePayload: Record<string, unknown>,
  ttlHours = 24,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);

  try {
    await db.insert(paymentIdempotencyKeys).values({
      idempotencyKey:  key,
      userId,
      orderId,
      gateway,
      responsePayload,
      expiresAt,
    }).onConflictDoNothing();
  } catch (err: unknown) {
    logger.error("IDEMPOTENCY_STORE_FAILED", {
      event:      "IDEMPOTENCY_STORE_FAILED",
      user_id:    userId,
      error_code: "DB_WRITE_ERROR",
      retryable:  false,
      error:      err instanceof Error ? err.message : String(err),
    });
  }
}

// Extend Express Request to carry the idempotency key
declare global {
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

