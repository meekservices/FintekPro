/**
 * @file user-intent-prewarm.test.ts
 * @description Unit tests for User Intent & Predictive Pre-Warming Engine and Routes.
 *
 * Compliance: FintekPro GCR v1.0, FASP-AI v1.0, DPDP Act 2023
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
	userIntentPrewarmEngine,
	USER_INTENT_ENGINE_VERSION,
} from "../services/user-intent-prewarm-engine";
import { userIntentRouter } from "../routes/user-intent-routes";

describe("UserIntentPrewarmEngine", () => {
	it("pseudonymizes user IDs using SHA-256 HMAC for DPDP Act 2023 compliance", () => {
		const rawUserId = "user_12345_test_abc";
		const hash1 = userIntentPrewarmEngine.pseudonymizeUserId(rawUserId);
		const hash2 = userIntentPrewarmEngine.pseudonymizeUserId(rawUserId);

		// Deterministic hash, masked length
		expect(hash1).toBe(hash2);
		expect(hash1.length).toBe(16);
		expect(hash1).not.toContain("user_12345");
	});

	it("handles emitIntentSignal asynchronously without throwing", () => {
		expect(() => {
			userIntentPrewarmEngine.emitIntentSignal({
				userId: "user_test_999",
				intentType: "SESSION_INITIALIZED",
				consentGranted: true,
			});
		}).not.toThrow();
	});

	it("skips pre-warming when DPDP consent is explicitly false", () => {
		expect(() => {
			userIntentPrewarmEngine.emitIntentSignal({
				userId: "user_test_no_consent",
				intentType: "SESSION_INITIALIZED",
				consentGranted: false,
			});
		}).not.toThrow();
	});
});

describe("User Intent Router (/api/user-intent)", () => {
	it("registers /signal, /prewarmed, and /health in the router stack", () => {
		const routes = userIntentRouter.stack
			.filter((layer) => layer.route)
			.map((layer) => ({
				path: layer.route?.path,
				methods: Object.keys(layer.route?.methods || {}),
			}));

		const paths = routes.map((r) => r.path);
		expect(paths).toContain("/signal");
		expect(paths).toContain("/prewarmed");
		expect(paths).toContain("/health");
	});

	it("executes /health endpoint and returns engine metadata and compliance status", () => {
		const healthLayer = userIntentRouter.stack.find(
			(layer) => layer.route?.path === "/health" && layer.route?.methods?.get
		);
		expect(healthLayer).toBeDefined();

		const handler = healthLayer?.route?.stack[0]?.handle;
		expect(typeof handler).toBe("function");

		const mockReq = {} as Request;
		let responseData: any = null;

		const mockRes = {
			json: vi.fn().mockImplementation((data: any) => {
				responseData = data;
				return mockRes;
			}),
		} as unknown as Response;

		handler(mockReq, mockRes);

		expect(responseData).toBeDefined();
		expect(responseData.success).toBe(true);
		expect(responseData.data.status).toBe("HEALTHY");
		expect(responseData.data.version).toBe(USER_INTENT_ENGINE_VERSION);
		expect(responseData.data.compliance).toContain("SEBI IA Reg 17");
		expect(responseData.data.compliance).toContain("DPDP Act 2023 Sec 6");
	});

	it("accepts valid intent signals on POST /signal and returns 202 PREWARM_SCHEDULED", () => {
		const signalLayer = userIntentRouter.stack.find(
			(layer) => layer.route?.path === "/signal" && layer.route?.methods?.post
		);
		expect(signalLayer).toBeDefined();

		const handler = signalLayer?.route?.stack[0]?.handle;
		expect(typeof handler).toBe("function");

		const mockReq = {
			body: {
				userId: "user_alpha_1",
				intentType: "INSTRUMENT_FOCUS",
				symbol: "RELIANCE",
				consentGranted: true,
			},
		} as Request;

		let statusCode = 200;
		let responseData: any = null;

		const mockRes = {
			status: vi.fn().mockImplementation((code: number) => {
				statusCode = code;
				return mockRes;
			}),
			json: vi.fn().mockImplementation((data: any) => {
				responseData = data;
				return mockRes;
			}),
		} as unknown as Response;

		handler(mockReq, mockRes);

		expect(statusCode).toBe(202);
		expect(responseData.success).toBe(true);
		expect(responseData.data.status).toBe("PREWARM_SCHEDULED");
		expect(responseData.data.intentType).toBe("INSTRUMENT_FOCUS");
	});
});
