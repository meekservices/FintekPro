/**
 * Test Error Handling Routes
 * Used to validate retry, circuit breaker, and error response behavior
 * ONLY AVAILABLE IN DEVELOPMENT
 */

import { Router } from "express";
import {
	ValidationError,
	AuthError,
	RateLimitError,
	ExternalServiceError,
	TimeoutError,
	CircuitOpenError,
} from "./utils/errors";
import { apiResponse } from "./utils/responses";
import { executeWithRetry } from "./utils/retry";
import { circuitBreakerRegistry } from "./utils/circuitBreaker";

const router = Router();

// Only enable in development
if (process.env.NODE_ENV === "development") {
	// Test validation error
	router.get("/test-errors/validation", (req, res, next) => {
		try {
			throw new ValidationError("Invalid email format", {
				field: "email",
				value: req.query.email,
			});
		} catch (error) {
			next(error);
		}
	});

	// Test auth error
	router.get("/test-errors/auth", (req, res, next) => {
		try {
			throw new AuthError("Session expired");
		} catch (error) {
			next(error);
		}
	});

	// Test rate limit error
	router.get("/test-errors/rate-limit", (req, res, next) => {
		try {
			throw new RateLimitError("Too many requests", 60);
		} catch (error) {
			next(error);
		}
	});

	// Test external service error
	router.get("/test-errors/external-service", (req, res, next) => {
		try {
			throw new ExternalServiceError(
				"Payment Gateway",
				"Failed to process payment",
				new Error("Connection timeout"),
				true,
			);
		} catch (error) {
			next(error);
		}
	});

	// Test timeout error
	router.get("/test-errors/timeout", (req, res, next) => {
		try {
			throw new TimeoutError("Operation timed out", 30000);
		} catch (error) {
			next(error);
		}
	});

	// Test circuit breaker
	router.get("/test-errors/circuit-breaker", (req, res, next) => {
		try {
			// Get or create the test service breaker
			const breaker = circuitBreakerRegistry.get("test-service", {
				failureThreshold: 3,
				successThreshold: 2,
				timeout: 30000,
			});
			breaker.open(); // Manually open the circuit
			throw new CircuitOpenError("test-service", new Date(Date.now() + 60000));
		} catch (error) {
			next(error);
		}
	});

	// Test retry logic
	let retryAttempts = 0;
	router.get("/test-errors/retry", async (req, res, next) => {
		try {
			const result = await executeWithRetry(
				async () => {
					retryAttempts++;
					console.log(`[Test Retry] Attempt ${retryAttempts}`);

					if (retryAttempts < 3) {
						throw new ExternalServiceError(
							"Test Service",
							"Temporary failure",
							undefined,
							true, // isRetryable
						);
					}

					return { success: true, attempts: retryAttempts };
				},
				{
					maxAttempts: 3,
					baseDelay: 500,
					onRetry: (error, attempt) => {
						console.log(
							`[Test Retry] Retrying after attempt ${attempt}: ${error.message}`,
						);
					},
				},
			);

			retryAttempts = 0; // Reset for next test
			return apiResponse.success(res, result.result);
		} catch (error) {
			retryAttempts = 0; // Reset on failure
			next(error);
		}
	});

	// Test success response
	router.get("/test-errors/success", (req, res) => {
		return apiResponse.success(res, {
			message: "Everything is working correctly!",
			timestamp: new Date().toISOString(),
		});
	});

	// Get circuit breaker status
	router.get("/test-errors/circuit-status", (req, res) => {
		const breakers = circuitBreakerRegistry.getAll();
		const status: any = {};

		breakers.forEach((breaker, name) => {
			status[name] = {
				state: breaker.getState(),
				stats: breaker.getStats(),
			};
		});

		return apiResponse.success(res, status);
	});

	// Reset all circuit breakers
	router.post("/test-errors/reset-circuits", (req, res) => {
		const breakers = circuitBreakerRegistry.getAll();
		breakers.forEach((breaker) => breaker.close());

		return apiResponse.success(res, {
			message: "All circuit breakers reset",
			count: breakers.size,
		});
	});

	console.log("✅ Error testing routes enabled (development mode)");
}

export default router;
