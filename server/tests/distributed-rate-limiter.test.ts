import { describe, expect, it } from "vitest";
import { consumeRateLimitToken } from "../middleware/distributed-rate-limiter";

describe("Distributed Rate Limiter (Institutional Grade)", () => {
	it("allows requests within capacity and tracks remaining tokens", async () => {
		const testId = `test-client-${Date.now()}`;
		const config = {
			keyPrefix: "test",
			maxCapacity: 5,
			refillRateMs: 1000,
		};

		// 1st request
		const res1 = await consumeRateLimitToken(testId, config);
		expect(res1.allowed).toBe(true);
		expect(res1.remaining).toBe(4);

		// 2nd request
		const res2 = await consumeRateLimitToken(testId, config);
		expect(res2.allowed).toBe(true);
		expect(res2.remaining).toBe(3);
	});

	it("throttles and enforces 429 when capacity is exhausted", async () => {
		const testId = `burst-client-${Date.now()}`;
		const config = {
			keyPrefix: "burst",
			maxCapacity: 2,
			refillRateMs: 1000,
		};

		// Consume 2 tokens
		const res1 = await consumeRateLimitToken(testId, config);
		expect(res1.allowed).toBe(true);

		const res2 = await consumeRateLimitToken(testId, config);
		expect(res2.allowed).toBe(true);

		// 3rd token must be rejected
		const res3 = await consumeRateLimitToken(testId, config);
		expect(res3.allowed).toBe(false);
		expect(res3.remaining).toBe(0);
		expect(res3.retryAfterMs).toBeGreaterThan(0);
	});
});
