/**
 * External API Circuit Breaker Registry
 * P1 — Circuit breakers on all external API integrations.
 *
 * Centralises all external service endpoints under circuit-breaker protection.
 * Each service gets its own breaker instance. Health status is exposed via
 * GET /api/admin/system/external-api-health.
 *
 * How to use:
 *   const result = await externalApiRegistry.call('sandbox_pan', () => fetch(...));
 */

import {
	CircuitBreaker,
	CircuitBreakerOptions,
	circuitBreakerRegistry,
	CircuitState,
} from "./circuitBreaker";
import { logger } from "../logger";

export interface ExternalServiceConfig {
	name: string;
	baseUrl?: string;
	category:
		| "kyc"
		| "payment"
		| "market_data"
		| "communication"
		| "analytics"
		| "compliance";
	options: CircuitBreakerOptions;
}

const EXTERNAL_SERVICES: ExternalServiceConfig[] = [
	// ── KYC Providers ──────────────────────────────────────────────────────────
	{
		name: "sandbox_co_in",
		baseUrl: "https://api.sandbox.co.in",
		category: "kyc",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	{
		name: "truthscreen",
		baseUrl: "https://www.truthscreen.com",
		category: "kyc",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	{
		name: "authbridge",
		baseUrl: "https://api.authbridge.com",
		category: "kyc",
		options: {
			failureThreshold: 3,
			timeout: 90_000,
			monitoringWindow: 120_000,
		},
	},
	{
		name: "ckyc_registry",
		baseUrl: "https://uatkyc.ckycreg.in",
		category: "kyc",
		options: {
			failureThreshold: 3,
			timeout: 90_000,
			monitoringWindow: 120_000,
		},
	},
	{
		name: "digilocker",
		baseUrl: "https://api.digitallocker.gov.in",
		category: "kyc",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	// ── Payment Gateways ───────────────────────────────────────────────────────
	{
		name: "cashfree",
		baseUrl: "https://api.cashfree.com",
		category: "payment",
		options: { failureThreshold: 3, timeout: 30_000, monitoringWindow: 60_000 },
	},
	{
		name: "phonepe",
		baseUrl: "https://api.phonepe.com",
		category: "payment",
		options: { failureThreshold: 3, timeout: 30_000, monitoringWindow: 60_000 },
	},
	// ── Market Data ────────────────────────────────────────────────────────────
	{
		name: "nse_india",
		baseUrl: "https://www.nseindia.com",
		category: "market_data",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	{
		name: "bse_india",
		baseUrl: "https://api.bseindia.com",
		category: "market_data",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	{
		name: "alphavantage",
		baseUrl: "https://www.alphavantage.co",
		category: "market_data",
		options: { failureThreshold: 5, timeout: 30_000, monitoringWindow: 60_000 },
	},
	{
		name: "finnhub",
		baseUrl: "https://finnhub.io",
		category: "market_data",
		options: { failureThreshold: 5, timeout: 30_000, monitoringWindow: 60_000 },
	},
	{
		name: "amfi",
		baseUrl: "https://www.amfiindia.com",
		category: "market_data",
		options: {
			failureThreshold: 5,
			timeout: 60_000,
			monitoringWindow: 120_000,
		},
	},
	// ── Communication ─────────────────────────────────────────────────────────
	{
		name: "twilio",
		baseUrl: "https://api.twilio.com",
		category: "communication",
		options: { failureThreshold: 5, timeout: 30_000, monitoringWindow: 60_000 },
	},
	// ── Analytics / AI ────────────────────────────────────────────────────────
	{
		name: "openai",
		baseUrl: "https://api.openai.com",
		category: "analytics",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
	{
		name: "google_gemini",
		baseUrl: "https://generativelanguage.googleapis.com",
		category: "analytics",
		options: { failureThreshold: 5, timeout: 60_000, monitoringWindow: 60_000 },
	},
];

class ExternalApiRegistry {
	private configs = new Map<string, ExternalServiceConfig>();

	constructor() {
		for (const svc of EXTERNAL_SERVICES) {
			this.configs.set(svc.name, svc);
			// Pre-register circuit breakers
			circuitBreakerRegistry.get(svc.name, {
				...svc.options,
				onStateChange: (state, name) => {
					if (state === CircuitState.OPEN) {
						logger.warn(
							`[ExternalAPI] Circuit OPEN for ${name} — blocking requests`,
							{ service: name },
						);
					} else if (state === CircuitState.CLOSED) {
						logger.info(
							`[ExternalAPI] Circuit CLOSED for ${name} — service recovered`,
							{ service: name },
						);
					}
				},
				onFailure: (err, name) => {
					logger.warn(`[ExternalAPI] Failure recorded for ${name}`, {
						service: name,
						error: err.message,
					});
				},
			});
		}
		logger.info(
			`[ExternalAPI] Registry initialized with ${EXTERNAL_SERVICES.length} services`,
		);
	}

	/**
	 * Execute a function through the named service's circuit breaker.
	 */
	async call<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
		const breaker = circuitBreakerRegistry.get(serviceName);
		return breaker.execute(fn);
	}

	/**
	 * Get health snapshot for all registered services.
	 */
	getHealth(): Record<
		string,
		{ state: string; failures: number; category: string }
	> {
		const result: Record<
			string,
			{ state: string; failures: number; category: string }
		> = {};
		for (const [name, cfg] of this.configs) {
			const breaker = circuitBreakerRegistry.get(name);
			result[name] = {
				state: breaker.getState(),
				failures: breaker.getStats().failures,
				category: cfg.category,
			};
		}
		return result;
	}

	/**
	 * Get breaker for a specific service.
	 */
	getBreaker(serviceName: string): CircuitBreaker {
		return circuitBreakerRegistry.get(serviceName);
	}

	listServices(): ExternalServiceConfig[] {
		return EXTERNAL_SERVICES;
	}
}

export const externalApiRegistry = new ExternalApiRegistry();
