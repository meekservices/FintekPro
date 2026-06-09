/**
 * Error Handling Validation Tests
 * Run with: npx tsx server/test-error-validation.ts
 */

import { executeWithRetry } from "./utils/retry";
import { CircuitBreaker, circuitBreakerRegistry } from "./utils/circuitBreaker";
import {
	AppError,
	ValidationError,
	ExternalServiceError,
	RateLimitError,
	TimeoutError,
} from "./utils/errors";

console.log("🧪 Starting Error Handling Validation Tests\n");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
	if (condition) {
		console.log(`✅ ${message}`);
		testsPassed++;
	} else {
		console.error(`❌ ${message}`);
		testsFailed++;
	}
}

async function testRetryLogic() {
	console.log("\n📝 Test 1: Retry Logic with Exponential Backoff");

	let attempts = 0;
	const startTime = Date.now();

	try {
		await executeWithRetry(
			async () => {
				attempts++;
				if (attempts < 3) {
					throw new ExternalServiceError(
						"TestService",
						"Temporary failure",
						undefined,
						true,
					);
				}
				return { success: true };
			},
			{
				maxAttempts: 3,
				baseDelay: 100,
				jitter: false, // Disable jitter for predictable timing
			},
		);

		const duration = Date.now() - startTime;
		assert(
			attempts === 3,
			`Retry attempted exactly 3 times (actual: ${attempts})`,
		);
		assert(
			duration >= 300,
			`Exponential backoff applied (duration: ${duration}ms)`,
		);
	} catch (error) {
		assert(false, "Retry should eventually succeed");
	}
}

async function testRetryNonRetryableError() {
	console.log("\n📝 Test 2: Non-Retryable Errors");

	let attempts = 0;

	try {
		await executeWithRetry(
			async () => {
				attempts++;
				throw new ValidationError("Invalid input", { field: "email" });
			},
			{
				maxAttempts: 3,
				baseDelay: 100,
			},
		);
		assert(false, "Should have thrown ValidationError");
	} catch (error) {
		assert(
			attempts === 1,
			`Non-retryable error attempted only once (actual: ${attempts})`,
		);
		assert(error instanceof ValidationError, "ValidationError thrown");
	}
}

async function testCircuitBreaker() {
	console.log("\n📝 Test 3: Circuit Breaker State Transitions");

	const breaker = circuitBreakerRegistry.get("validation-test-service", {
		failureThreshold: 3,
		successThreshold: 2,
		timeout: 1000,
	});

	// Start in CLOSED state
	assert(breaker.getState() === "CLOSED", "Circuit starts CLOSED");

	// Trigger failures to open the circuit
	for (let i = 0; i < 3; i++) {
		try {
			await breaker.execute(async () => {
				throw new Error("Simulated failure");
			});
		} catch (e) {
			// Expected
		}
	}

	assert(
		breaker.getState() === "OPEN",
		"Circuit OPEN after threshold failures",
	);

	// Circuit should reject calls while OPEN
	try {
		await breaker.execute(async () => "should not execute");
		assert(false, "Circuit should reject calls while OPEN");
	} catch (error: any) {
		assert(
			error.name === "CircuitOpenError",
			"CircuitOpenError thrown while OPEN",
		);
	}

	// Wait for timeout to transition to HALF_OPEN
	await new Promise((resolve) => setTimeout(resolve, 1100));

	// Next attempt should transition to HALF_OPEN
	try {
		await breaker.execute(async () => {
			throw new Error("Still failing");
		});
	} catch (e) {
		// Expected
	}

	// Should reopen after failure in HALF_OPEN
	assert(
		breaker.getState() === "OPEN",
		"Circuit reopens after HALF_OPEN failure",
	);

	// Clean up
	breaker.close();
}

async function testErrorNormalization() {
	console.log("\n📝 Test 4: Error Normalization");

	const errors = [
		new ValidationError("Test validation", { field: "email" }),
		new RateLimitError("Test rate limit", 60),
		new TimeoutError("Test timeout", 30000),
		new ExternalServiceError("TestAPI", "Test external", undefined, true),
	];

	for (const error of errors) {
		assert(error instanceof AppError, `${error.name} is an AppError`);
		assert(typeof error.status === "number", `${error.name} has status code`);
		assert(
			typeof error.userMessage === "string",
			`${error.name} has userMessage`,
		);
		assert(
			typeof error.isRetryable === "boolean",
			`${error.name} has isRetryable flag`,
		);
	}
}

async function testRateLimitRetry() {
	console.log("\n📝 Test 5: Rate Limit Error Retry Behavior");

	let attempts = 0;

	try {
		await executeWithRetry(
			async () => {
				attempts++;
				if (attempts < 2) {
					throw new RateLimitError("Rate limit exceeded", 30);
				}
				return { success: true };
			},
			{
				maxAttempts: 3,
				baseDelay: 100,
			},
		);

		assert(attempts === 2, `Rate limit error retried (attempts: ${attempts})`);
	} catch (error) {
		assert(false, "Rate limit retry should eventually succeed");
	}
}

async function runAllTests() {
	try {
		await testRetryLogic();
		await testRetryNonRetryableError();
		await testCircuitBreaker();
		await testErrorNormalization();
		await testRateLimitRetry();

		console.log("\n" + "=".repeat(50));
		console.log(`✅ Passed: ${testsPassed}`);
		console.log(`❌ Failed: ${testsFailed}`);
		console.log("=".repeat(50));

		if (testsFailed === 0) {
			console.log("\n🎉 All error handling tests passed!");
			process.exit(0);
		} else {
			console.error("\n⚠️  Some tests failed. Please review the errors above.");
			process.exit(1);
		}
	} catch (error) {
		console.error("\n💥 Test suite crashed:", error);
		process.exit(1);
	}
}

// Run tests if executed directly
runAllTests();

export { runAllTests };
