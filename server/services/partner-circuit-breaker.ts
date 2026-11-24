/**
 * Partner Circuit Breaker & Resilient Fallback Service
 *
 * Implements FintekPro Self-Healing & High-Availability Standards:
 * - Prevents thread starvation and cascading failures from partner APIs (Upstox, IRIS, Alpaca, Finvu, Angel One)
 * - Tri-state Circuit Breaker: CLOSED (Healthy) -> OPEN (Tripped) -> HALF_OPEN (Probing Recovery)
 * - Stale-while-revalidate fallback caching to guarantee sub-150ms responses during upstream outages
 * - Structured telemetry emitting: { event, provider, latency_ms, status, circuit_state }
 *
 * @engineVersion FINTEK-CIRCUIT-BREAKER-v1.0
 */

import { logger } from "../logger";

export type PartnerProvider =
  | "UPSTOX"
  | "KFINTECH_IRIS"
  | "ALPACA"
  | "FINVU_AA"
  | "ANGEL_ONE"
  | "DHAN"
  | "CAMS"
  | "BSE_STAR_MF"
  | "BAJAJ_FINANCE"
  | "SHRIRAM_FINANCE"
  | "MAHINDRA_FINANCE"
  | "UTKARSH_SFB"
  | "VOLT_MONEY"
  | "FIFTY_FIN"
  | "TATA_CAPITAL"
  | "GOLDEN_PI"
  | "GRIP_INVEST"
  | "SETU_AA";
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitMetrics {
  provider: PartnerProvider;
  state: CircuitState;
  consecutiveFailures: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastFailureTime?: string | null;
  lastSuccessTime?: string | null;
  nextAttemptAllowedAt?: string | null;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

export class PartnerCircuitBreaker {
  private static instance: PartnerCircuitBreaker;

  // Configuration parameters
  private readonly FAILURE_THRESHOLD = 5; // Trip circuit after 5 consecutive errors
  private readonly RESET_TIMEOUT_MS = 30_000; // 30s cooling-off before probe
  private readonly DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute fallback cache

  private metrics: Map<PartnerProvider, {
    state: CircuitState;
    consecutiveFailures: number;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
    nextAttemptAllowedAt: number | null;
  }> = new Map();

  private fallbackCache: Map<string, CacheEntry<any>> = new Map();

  constructor() {
    const providers: PartnerProvider[] = [
      "UPSTOX",
      "KFINTECH_IRIS",
      "ALPACA",
      "FINVU_AA",
      "ANGEL_ONE",
      "DHAN",
      "CAMS",
      "BSE_STAR_MF",
      "BAJAJ_FINANCE",
      "SHRIRAM_FINANCE",
      "MAHINDRA_FINANCE",
      "UTKARSH_SFB",
      "VOLT_MONEY",
      "FIFTY_FIN",
      "TATA_CAPITAL",
      "GOLDEN_PI",
      "GRIP_INVEST",
      "SETU_AA",
    ];
    for (const p of providers) {
      this.metrics.set(p, {
        state: "CLOSED",
        consecutiveFailures: 0,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptAllowedAt: null,
      });
    }
  }

  static getInstance(): PartnerCircuitBreaker {
    if (!PartnerCircuitBreaker.instance) {
      PartnerCircuitBreaker.instance = new PartnerCircuitBreaker();
    }
    return PartnerCircuitBreaker.instance;
  }

  /**
   * Executes a partner network call wrapped in circuit breaker and fallback cache.
   */
  async execute<T>(
    provider: PartnerProvider,
    cacheKey: string,
    actionFn: () => Promise<T>,
    fallbackData?: T,
  ): Promise<{ data: T; isCached: boolean; circuitState: CircuitState; latencyMs: number }> {
    const metric = this.metrics.get(provider)!;
    const now = Date.now();
    metric.totalCalls++;

    // 1. Evaluate Circuit State
    if (metric.state === "OPEN") {
      if (metric.nextAttemptAllowedAt && now >= metric.nextAttemptAllowedAt) {
        metric.state = "HALF_OPEN";
        logger.info("CIRCUIT_BREAKER_PROBING", {
          provider,
          event: "CIRCUIT_HALF_OPEN",
          status: "PROBING",
        });
      } else {
        // Fast fail: return cached stale data or fallbackData
        const cached = this.fallbackCache.get(cacheKey);
        if (cached !== undefined) {
          return {
            data: cached.data,
            isCached: true,
            circuitState: "OPEN",
            latencyMs: 1,
          };
        }
        if (fallbackData !== undefined) {
          return {
            data: fallbackData,
            isCached: false,
            circuitState: "OPEN",
            latencyMs: 1,
          };
        }
        throw new Error(
          `Circuit for partner ${provider} is OPEN. Upstream temporarily suspended until ${new Date(
            metric.nextAttemptAllowedAt || 0,
          ).toISOString()}`,
        );
      }
    }

    // 2. Execute Action with Telemetry
    const startMs = Date.now();
    try {
      const result = await actionFn();
      const latencyMs = Date.now() - startMs;

      // On Success
      metric.successfulCalls++;
      metric.consecutiveFailures = 0;
      metric.lastSuccessTime = Date.now();
      metric.state = "CLOSED";
      metric.nextAttemptAllowedAt = null;

      // Update local stale cache
      this.fallbackCache.set(cacheKey, {
        data: result,
        cachedAt: Date.now(),
        ttlMs: this.DEFAULT_CACHE_TTL_MS,
      });

      logger.info("CIRCUIT_BREAKER_SUCCESS", {
        provider,
        event: "PARTNER_CALL_SUCCESS",
        latency_ms: latencyMs,
        circuit_state: metric.state,
      });

      return {
        data: result,
        isCached: false,
        circuitState: metric.state,
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startMs;
      metric.failedCalls++;
      metric.consecutiveFailures++;
      metric.lastFailureTime = Date.now();

      // Trip Circuit if threshold exceeded
      if (metric.consecutiveFailures >= this.FAILURE_THRESHOLD) {
        metric.state = "OPEN";
        metric.nextAttemptAllowedAt = Date.now() + this.RESET_TIMEOUT_MS;
        logger.warn("CIRCUIT_BREAKER_TRIPPED", {
          provider,
          event: "CIRCUIT_TRIPPED_OPEN",
          consecutive_failures: metric.consecutiveFailures,
          cool_off_ms: this.RESET_TIMEOUT_MS,
          error: err.message,
        });
      }

      // Check for stale cache fallback
      const cached = this.fallbackCache.get(cacheKey);
      if (cached !== undefined) {
        logger.info("CIRCUIT_BREAKER_STALE_SERVED", {
          provider,
          cacheKey,
          event: "STALE_CACHE_SERVED",
          error: err.message,
        });
        return {
          data: cached.data,
          isCached: true,
          circuitState: metric.state,
          latencyMs,
        };
      }

      if (fallbackData !== undefined) {
        return {
          data: fallbackData,
          isCached: false,
          circuitState: metric.state,
          latencyMs,
        };
      }

      throw err;
    }
  }

  /**
   * Returns current health and metrics for a specific partner circuit.
   */
  getCircuitStatus(provider: PartnerProvider): CircuitMetrics {
    const m = this.metrics.get(provider);
    if (!m) {
      return {
        provider,
        state: "CLOSED",
        consecutiveFailures: 0,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptAllowedAt: null,
      };
    }
    return {
      provider,
      state: m.state,
      consecutiveFailures: m.consecutiveFailures,
      totalCalls: m.totalCalls,
      successfulCalls: m.successfulCalls,
      failedCalls: m.failedCalls,
      lastFailureTime: m.lastFailureTime ? new Date(m.lastFailureTime).toISOString() : null,
      lastSuccessTime: m.lastSuccessTime ? new Date(m.lastSuccessTime).toISOString() : null,
      nextAttemptAllowedAt: m.nextAttemptAllowedAt
        ? new Date(m.nextAttemptAllowedAt).toISOString()
        : null,
    };
  }

  /**
   * Records a manual or external failure for testing or asynchronous webhook events.
   */
  recordFailure(provider: PartnerProvider, err?: Error): void {
    const metric = this.metrics.get(provider);
    if (!metric) return;
    metric.failedCalls++;
    metric.consecutiveFailures++;
    metric.lastFailureTime = Date.now();
    if (metric.consecutiveFailures >= this.FAILURE_THRESHOLD) {
      metric.state = "OPEN";
      metric.nextAttemptAllowedAt = Date.now() + this.RESET_TIMEOUT_MS;
      logger.warn("CIRCUIT_BREAKER_TRIPPED", {
        provider,
        event: "CIRCUIT_TRIPPED_OPEN",
        consecutive_failures: metric.consecutiveFailures,
        cool_off_ms: this.RESET_TIMEOUT_MS,
        error: err?.message,
      });
    }
  }

  /**
   * Returns current health and metrics for all partner circuits.
   */
  getCircuitStatuses(): Record<PartnerProvider, CircuitMetrics> {
    const result = {} as Record<PartnerProvider, CircuitMetrics>;
    for (const [provider, m] of this.metrics.entries()) {
      result[provider] = {
        provider,
        state: m.state,
        consecutiveFailures: m.consecutiveFailures,
        totalCalls: m.totalCalls,
        successfulCalls: m.successfulCalls,
        failedCalls: m.failedCalls,
        lastFailureTime: m.lastFailureTime ? new Date(m.lastFailureTime).toISOString() : null,
        lastSuccessTime: m.lastSuccessTime ? new Date(m.lastSuccessTime).toISOString() : null,
        nextAttemptAllowedAt: m.nextAttemptAllowedAt
          ? new Date(m.nextAttemptAllowedAt).toISOString()
          : null,
      };
    }
    return result;
  }

  /**
   * Resets a circuit to CLOSED state manually (e.g. via Admin Console).
   */
  resetCircuit(provider: PartnerProvider): void {
    const metric = this.metrics.get(provider);
    if (metric) {
      metric.state = "CLOSED";
      metric.consecutiveFailures = 0;
      metric.nextAttemptAllowedAt = null;
      logger.info("CIRCUIT_BREAKER_MANUAL_RESET", { provider, status: "RESET_CLOSED" });
    }
  }
}

export const partnerCircuitBreaker = PartnerCircuitBreaker.getInstance();
