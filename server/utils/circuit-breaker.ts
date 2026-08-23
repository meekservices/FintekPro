/**
 * Circuit Breaker Utility
 *
 * Implements the standard 3-state circuit breaker pattern:
 *   CLOSED  → Normal operation. Requests pass through.
 *   OPEN    → Failure threshold exceeded. Requests fail immediately (fast-fail).
 *   HALF-OPEN → Trial period after cooldown. One probe request allowed.
 *
 * Config:
 *   failureThreshold  — consecutive failures before tripping OPEN (default 5)
 *   cooldownMs        — time in OPEN state before moving to HALF-OPEN (default 30s)
 *   successThreshold  — consecutive successes in HALF-OPEN to close (default 2)
 *   resetAfterMs      — time before a permanently open circuit resets (default 24h)
 *
 * Usage:
 *   const cb = new CircuitBreaker({ name: "IndianAPI", failureThreshold: 5 });
 *   const result = await cb.execute(() => apiClient.get("/stock"));
 *
 * @module circuit-breaker
 */

import { logger } from "../logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
	/** Identifier for logging */
	name: string;
	/** Consecutive failures before opening the circuit (default: 5) */
	failureThreshold?: number;
	/** Milliseconds to wait before attempting recovery (default: 30_000) */
	cooldownMs?: number;
	/** Consecutive successes in HALF_OPEN state to close the circuit (default: 2) */
	successThreshold?: number;
	/** Reset time for permanently open circuit (default: 24h) */
	resetAfterMs?: number;
}

export class CircuitBreaker {
	private readonly name: string;
	private readonly failureThreshold: number;
	private readonly initialCooldownMs: number;
	private readonly successThreshold: number;
	private readonly resetAfterMs: number;

	private state: CircuitState = "CLOSED";
	private consecutiveFailures = 0;
	private consecutiveSuccesses = 0;
	private openedAt: number | null = null;
	private backoffAttempts = 0;

	constructor(opts: CircuitBreakerOptions) {
		this.name = opts.name;
		this.failureThreshold = opts.failureThreshold ?? 5;
		this.initialCooldownMs = opts.cooldownMs ?? 30_000;
		this.successThreshold = opts.successThreshold ?? 2;
		this.resetAfterMs = opts.resetAfterMs ?? 86_400_000;
	}

	getState(): CircuitState {
		return this.state;
	}

	getStatus() {
		return {
			name: this.name,
			state: this.state,
			consecutiveFailures: this.consecutiveFailures,
			consecutiveSuccesses: this.consecutiveSuccesses,
			openedAt: this.openedAt ? new Date(this.openedAt).toISOString() : null,
			cooldownRemainingMs:
				this.state === "OPEN" && this.openedAt
					? Math.max(0, this.getEffectiveCooldown() - (Date.now() - this.openedAt))
					: 0,
		};
	}

	/**
	 * Execute a function through the circuit breaker.
	 * - CLOSED: executes normally, counts failures.
	 * - OPEN: throws immediately without calling fn.
	 * - HALF_OPEN: allows one probe; resets or re-opens based on result.
	 *
	 * @throws {CircuitOpenError} when the circuit is OPEN
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		this.transitionIfNeeded();

		if (this.state === "OPEN") {
			const remaining = this.openedAt
				? Math.ceil((this.getEffectiveCooldown() - (Date.now() - this.openedAt)) / 1000)
				: 0;
			throw new CircuitOpenError(
				`[CircuitBreaker:${this.name}] Circuit OPEN — cooldown ${remaining}s remaining`,
				this.name,
			);
		}

		try {
			const result = await fn();
			this.onSuccess();
			return result;
		} catch (err) {
			this.onFailure(err);
			throw err;
		}
	}

	private getEffectiveCooldown(): number {
		if (this.backoffAttempts === 0) return this.initialCooldownMs;
		// Exponential: 30s → 60s → 2m → 5m → 15m → 60m (capped)
		const caps = [30_000, 60_000, 120_000, 300_000, 900_000, 3_600_000];
		return caps[Math.min(this.backoffAttempts - 1, caps.length - 1)];
	}

	private transitionIfNeeded(): void {
		if (this.state === "OPEN" && this.openedAt !== null) {
			const now = Date.now();
			if (now - this.openedAt >= this.resetAfterMs) {
				this.state = "CLOSED";
				this.consecutiveFailures = 0;
				this.backoffAttempts = 0;
				this.openedAt = null;
				logger.info(`[CircuitBreaker:${this.name}] → CLOSED (forced reset after long period)`);
			} else if (now - this.openedAt >= this.getEffectiveCooldown()) {
				this.state = "HALF_OPEN";
				this.consecutiveSuccesses = 0;
				logger.info(`[CircuitBreaker:${this.name}] → HALF_OPEN (probe allowed)`);
			}
		}
	}

	private onSuccess(): void {
		if (this.state === "HALF_OPEN") {
			this.consecutiveSuccesses++;
			if (this.consecutiveSuccesses >= this.successThreshold) {
				this.state = "CLOSED";
				this.consecutiveFailures = 0;
				this.backoffAttempts = 0;
				this.openedAt = null;
				logger.info(`[CircuitBreaker:${this.name}] → CLOSED (recovered)`);
			}
		} else {
			// CLOSED state: reset failure counter on success
			this.consecutiveFailures = 0;
		}
	}

	private onFailure(err: unknown): void {
		this.consecutiveFailures++;
		logger.warn(`[CircuitBreaker:${this.name}] Failure #${this.consecutiveFailures}`, {
			error: String(err),
		});

		if (
			this.state === "HALF_OPEN" ||
			(this.state === "CLOSED" && this.consecutiveFailures >= this.failureThreshold)
		) {
			if (this.state === "HALF_OPEN") this.backoffAttempts++;
			this.state = "OPEN";
			this.openedAt = Date.now();
			logger.error(
				`[CircuitBreaker:${this.name}] → OPEN after ${this.consecutiveFailures} failures. Cooldown: ${this.getEffectiveCooldown() / 1000}s`,
				{ error_code: "CIRCUIT_OPEN", retryable: false },
			);
		}
	}
}

export class CircuitOpenError extends Error {
	readonly serviceName: string;
	readonly retryable = false;
	readonly error_code = "CIRCUIT_OPEN";

	constructor(message: string, serviceName: string) {
		super(message);
		this.name = "CircuitOpenError";
		this.serviceName = serviceName;
	}
}
