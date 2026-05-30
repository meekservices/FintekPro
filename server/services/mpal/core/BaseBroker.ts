/**
 * MPAL — BaseBroker
 *
 * Purpose: Abstract base class that every broker adapter should extend.
 *          Provides:
 *            1. Default `not-implemented` guard for optional methods
 *            2. Structured logging with { event, brokerId, latency_ms, status }
 *            3. Retry wrapper with exponential backoff (max 3, per GCR)
 *
 * Edge cases:
 *   - Subclasses MUST implement: brokerId, capabilities, isConfigured(), healthCheck(),
 *     createAccount(), getPositions(), placeOrder(), placeNotionalOrder()
 *   - cancelOrder() and getOrderStatus() default to BrokerCapabilityError — override
 *     when the provider's API supports them.
 */

import {
  IBroker,
  BrokerCapability,
  BrokerOrder,
  BrokerOrderResult,
  BrokerHealthStatus,
  NormalizedPosition,
  BrokerCapabilityError,
} from '../interfaces/IBroker';
import { logger } from '../../../logger';

/** Exponential backoff helper — max 3 retries, delays: 200ms, 400ms, 800ms */
async function withRetry<T>(
  fn: () => Promise<T>,
  brokerId: string,
  operation: string,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const retryable = err?.retryable !== false; // defaults to true unless explicitly false
      if (!retryable || attempt === maxAttempts) throw err;
      const delayMs = 200 * Math.pow(2, attempt - 1);
      logger.warn(`[${brokerId}] ${operation} attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error_code: err?.error_code ?? 'UNKNOWN',
        message: err?.message,
      });
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export abstract class BaseBroker implements IBroker {
  abstract readonly brokerId: string;
  abstract readonly capabilities: readonly BrokerCapability[];

  abstract isConfigured(): boolean;
  abstract healthCheck(timeoutMs?: number): Promise<BrokerHealthStatus>;
  abstract createAccount(user: { id: string; [key: string]: unknown }): Promise<any>;
  abstract getPositions(accountId: string): Promise<NormalizedPosition[]>;
  abstract placeOrder(order: BrokerOrder): Promise<BrokerOrderResult>;
  abstract placeNotionalOrder(
    userId: string,
    symbol: string,
    notional: number,
    side: 'buy' | 'sell',
    currency?: 'INR' | 'USD',
  ): Promise<BrokerOrderResult>;

  /**
   * Default: throws BrokerCapabilityError.
   * Override in adapters where the provider supports order cancellation.
   */
  async cancelOrder(orderId: string): Promise<void> {
    throw new BrokerCapabilityError(this.brokerId, 'EQUITY_IN'); // capability is illustrative
  }

  /**
   * Default: throws BrokerCapabilityError.
   * Override in adapters where the provider supports order status polling.
   */
  async getOrderStatus(_orderId: string): Promise<BrokerOrderResult> {
    throw new BrokerCapabilityError(this.brokerId, 'EQUITY_IN');
  }

  /**
   * Wraps a broker call with structured logging + retry.
   * Use this inside placeOrder / getPositions implementations.
   *
   * @example
   * return this.callWithRetry(() => this.client.get('/positions'), 'getPositions');
   */
  protected async callWithRetry<T>(fn: () => Promise<T>, operation: string, maxAttempts = 3): Promise<T> {
    const start = Date.now();
    try {
      const result = await withRetry(fn, this.brokerId, operation, maxAttempts);
      logger.info(`[${this.brokerId}] ${operation}`, {
        event: `BROKER_CALL_SUCCESS`,
        brokerId: this.brokerId,
        operation,
        latency_ms: Date.now() - start,
        status: 'success',
      });
      return result;
    } catch (err: any) {
      logger.error(`[${this.brokerId}] ${operation} failed`, {
        event: `BROKER_CALL_FAILED`,
        brokerId: this.brokerId,
        operation,
        latency_ms: Date.now() - start,
        status: 'error',
        error_code: err?.error_code ?? 'UNKNOWN',
        message: err?.message,
        retryable: err?.retryable ?? true,
      });
      throw err;
    }
  }
}
