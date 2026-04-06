import { cashfreeService, type CashfreeOrderResponse } from '../cashfree-service';
import { phonePeService } from '../phonepe-service';
import { db } from '../db';
import { kycAuditLogs, paymentIdempotencyKeys, type InsertKycAuditLog } from '@shared/schema';
import { eq, and, gt, lt } from 'drizzle-orm';

export interface UnifiedOrderRequest {
  amount: number;
  userId: string;
  phone?: string;
  name?: string;
  email?: string;
  returnUrl?: string;
}

export interface UnifiedOrderResponse {
  success: boolean;
  orderId?: string;
  paymentSessionId?: string;
  paymentUrl?: string;
  gateway: 'cashfree' | 'phonepe';
  message?: string;
  fallbackUsed?: boolean;
}

export interface GatewayHealthStatus {
  status: 'live' | 'degraded' | 'down';
  latencyMs: number;
  error?: string;
}

export interface PaymentGatewayHealth {
  cashfree: GatewayHealthStatus;
  phonepe: GatewayHealthStatus;
  checkedAt: string;
}

async function pingUrl(url: string, options: RequestInit): Promise<GatewayHealthStatus> {
  const start = Date.now();
  try {
    const r = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - start;
    if (r.status >= 200 && r.status < 500) {
      return { status: 'live', latencyMs };
    }
    if (r.status >= 500) {
      return { status: 'down', latencyMs, error: `HTTP ${r.status}` };
    }
    return { status: 'degraded', latencyMs, error: `HTTP ${r.status}` };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const msg = String(err instanceof Error ? err.message : err).slice(0, 120);
    return { status: latencyMs >= 6000 ? 'degraded' : 'down', latencyMs, error: msg };
  }
}

class UnifiedPaymentGateway {

  /**
   * Create an order through Cashfree (primary) with PhonePe fallback.
   * Fallback is triggered ONLY when Cashfree throws an exception
   * (network failure, timeout, or service unavailability).
   * A Cashfree `success: false` response (business/validation rejection) is
   * returned directly without fallback, since retrying another gateway would
   * fail for the same business reason.
   */
  async createOrder(request: UnifiedOrderRequest): Promise<UnifiedOrderResponse> {
    let cashfreeResult: CashfreeOrderResponse | null = null;
    let cashfreeUnexpectedException: Error | null = null;

    try {
      cashfreeResult = await cashfreeService.createOrder({
        amount: request.amount,
        userId: request.userId,
        phone: request.phone,
        name: request.name,
        email: request.email,
        returnUrl: request.returnUrl,
      });
    } catch (err) {
      // cashfreeService already catches internally; this guards against unexpected throws
      cashfreeUnexpectedException = err instanceof Error ? err : new Error(String(err));
    }

    if (cashfreeResult?.success) {
      return {
        success: true,
        orderId: cashfreeResult.orderId,
        paymentSessionId: cashfreeResult.paymentSessionId,
        paymentUrl: cashfreeResult.paymentUrl,
        gateway: 'cashfree',
        message: cashfreeResult.message,
        fallbackUsed: false,
      };
    }

    // Determine whether to fallback:
    // - Business errors (4xx): Cashfree validated and rejected the request — no fallback
    //   (PhonePe would reject for the same business reason)
    // - Network/5xx errors: Cashfree is unreachable or degraded — fallback to PhonePe
    // - Unexpected exception: treat as network failure — fallback
    const shouldFallback =
      cashfreeUnexpectedException !== null ||
      cashfreeResult?.errorType === 'network';

    if (!shouldFallback) {
      return {
        success: false,
        gateway: 'cashfree',
        message: cashfreeResult?.message || 'Payment rejected by Cashfree',
        fallbackUsed: false,
      };
    }

    const failureReason = cashfreeUnexpectedException?.message || cashfreeResult?.message || 'Cashfree service unavailable';
    console.warn('[UnifiedPaymentGateway] Cashfree unreachable or returned 5xx, falling back to PhonePe. Reason:', failureReason);

    await this.logFallbackEvent(request.userId, failureReason);

    const phonePeResult = await phonePeService.createOrder({
      amount: request.amount,
      userId: request.userId,
      phone: request.phone,
      name: request.name,
      email: request.email,
    });

    if (phonePeResult.success) {
      return {
        success: true,
        orderId: phonePeResult.orderId,
        paymentUrl: phonePeResult.paymentUrl,
        gateway: 'phonepe',
        message: phonePeResult.message,
        fallbackUsed: true,
      };
    }

    return {
      success: false,
      gateway: 'phonepe',
      message: phonePeResult.message || 'Both payment gateways unavailable',
      fallbackUsed: true,
    };
  }

  private async logFallbackEvent(userId: string, reason: string): Promise<void> {
    try {
      const entry: InsertKycAuditLog = {
        userId,
        accessedBy: 'system',
        accessType: 'payment_fallback',
        dataFieldsAccessed: ['payment_gateway'],
        purpose: `Cashfree gateway unreachable; fell back to PhonePe. Reason: ${reason}`,
        apiEndpoint: '/api/payments/create-order',
        accessStatus: 'success',
        regulatoryPurpose: 'payment',
        complianceCheckPassed: true,
      };
      await db.insert(kycAuditLogs).values(entry);
    } catch (err) {
      console.error('[UnifiedPaymentGateway] Failed to log fallback event:', err);
    }
  }

  /**
   * Atomically acquire an idempotency lock before calling the gateway.
   * Uses INSERT ... ON CONFLICT DO NOTHING on the composite unique index (userId, idempotencyKey).
   *
   * Returns { locked: true } if we obtained the lock (caller should proceed with gateway).
   * Returns { locked: false, cached } if the key already exists (either in-progress or completed).
   */
  async acquireIdempotencyLock(
    idempotencyKey: string,
    userId: string,
  ): Promise<{ locked: boolean; cached: UnifiedOrderResponse | null }> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const now = new Date();

    const pendingPayload: UnifiedOrderResponse = { success: false, gateway: 'cashfree', message: 'pending' };

    // Insert a new pending lock, OR overwrite an expired lock.
    // The WHERE clause on the conflict target ensures we only overwrite when the
    // existing record is already past its TTL (expiresAt < now).
    // If a non-expired record exists, neither INSERT nor UPDATE fires → inserted.length === 0.
    const inserted = await db
      .insert(paymentIdempotencyKeys)
      .values({
        idempotencyKey,
        userId,
        orderId: 'pending',
        gateway: 'cashfree',
        responsePayload: pendingPayload as unknown as Record<string, unknown>,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [paymentIdempotencyKeys.userId, paymentIdempotencyKeys.idempotencyKey],
        set: {
          orderId: 'pending',
          gateway: 'cashfree',
          responsePayload: pendingPayload as unknown as Record<string, unknown>,
          expiresAt,
        },
        where: lt(paymentIdempotencyKeys.expiresAt, now),
      })
      .returning({ id: paymentIdempotencyKeys.id });

    if (inserted.length > 0) {
      // We acquired the lock (either fresh insert or expired row overwritten)
      return { locked: true, cached: null };
    }

    // A non-expired record exists — return its cached response
    const cached = await this.checkIdempotency(idempotencyKey, userId);
    return { locked: false, cached };
  }

  async checkIdempotency(
    idempotencyKey: string,
    userId: string,
  ): Promise<UnifiedOrderResponse | null> {
    const now = new Date();
    const [existing] = await db
      .select()
      .from(paymentIdempotencyKeys)
      .where(
        and(
          eq(paymentIdempotencyKeys.idempotencyKey, idempotencyKey),
          eq(paymentIdempotencyKeys.userId, userId),
          gt(paymentIdempotencyKeys.expiresAt, now),
        ),
      )
      .limit(1);

    if (existing) {
      const payload = existing.responsePayload as Record<string, unknown>;
      if (payload?.message === 'pending' && existing.orderId === 'pending') {
        return null; // in-progress request
      }
      return payload as UnifiedOrderResponse;
    }
    return null;
  }

  /**
   * Store the final gateway response in the idempotency record.
   * Called after a successful gateway order creation.
   */
  async finaliseIdempotencyKey(
    idempotencyKey: string,
    userId: string,
    orderId: string,
    gateway: 'cashfree' | 'phonepe',
    response: UnifiedOrderResponse,
  ): Promise<void> {
    await db
      .update(paymentIdempotencyKeys)
      .set({
        orderId,
        gateway,
        responsePayload: response as unknown as Record<string, unknown>,
      })
      .where(
        and(
          eq(paymentIdempotencyKeys.idempotencyKey, idempotencyKey),
          eq(paymentIdempotencyKeys.userId, userId),
        ),
      );
  }

  /**
   * Remove the idempotency lock on failure so the user can retry.
   * Called when the gateway call fails, so the pending record doesn't strand retries.
   */
  async releaseIdempotencyLock(idempotencyKey: string, userId: string): Promise<void> {
    await db
      .delete(paymentIdempotencyKeys)
      .where(
        and(
          eq(paymentIdempotencyKeys.idempotencyKey, idempotencyKey),
          eq(paymentIdempotencyKeys.userId, userId),
        ),
      );
  }

  async storeIdempotencyKey(
    idempotencyKey: string,
    userId: string,
    orderId: string,
    gateway: 'cashfree' | 'phonepe',
    response: UnifiedOrderResponse,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(paymentIdempotencyKeys).values({
      idempotencyKey,
      userId,
      orderId,
      gateway,
      responsePayload: response as unknown as Record<string, unknown>,
      expiresAt,
    }).onConflictDoNothing();
  }

  async getGatewayHealth(): Promise<PaymentGatewayHealth> {
    const cashfreeEnv = process.env.CASHFREE_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX');
    const cashfreeBaseUrl = cashfreeEnv === 'PRODUCTION'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

    const phonePeEnv = process.env.PHONEPE_ENVIRONMENT || 'SANDBOX';
    const phonePeBaseUrl = phonePeEnv === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const cashfreeAppId = process.env.CASHFREE_APP_ID;
    const cashfreeSecret = process.env.CASHFREE_SECRET_KEY;
    const phonePeMerchantId = process.env.PHONEPE_MERCHANT_ID;
    const phonePeSaltKey = process.env.PHONEPE_SALT_KEY;

    const [cashfreeHealth, phonePeHealth] = await Promise.all([
      !cashfreeAppId || !cashfreeSecret
        ? Promise.resolve<GatewayHealthStatus>({
            status: 'degraded',
            latencyMs: 0,
            error: 'Not configured — set CASHFREE_APP_ID, CASHFREE_SECRET_KEY',
          })
        : pingUrl(`${cashfreeBaseUrl}/orders/session`, {
            method: 'POST',
            headers: {
              'x-client-id': cashfreeAppId,
              'x-client-secret': cashfreeSecret,
              'x-api-version': '2023-08-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }),
      !phonePeMerchantId || !phonePeSaltKey
        ? Promise.resolve<GatewayHealthStatus>({
            status: 'degraded',
            latencyMs: 0,
            error: 'Not configured — set PHONEPE_MERCHANT_ID, PHONEPE_SALT_KEY',
          })
        : pingUrl(`${phonePeBaseUrl}/pg/v1/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
    ]);

    return {
      cashfree: cashfreeHealth,
      phonepe: phonePeHealth,
      checkedAt: new Date().toISOString(),
    };
  }
}

export const unifiedPaymentGateway = new UnifiedPaymentGateway();
