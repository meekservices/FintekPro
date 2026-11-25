/**
 * @file cloud-scheduler-routes.test.ts
 * @description Unit tests for the Cloud Scheduler & Webhook Trigger Router (/api/cron).
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import cloudSchedulerRouter from "../routes/cloud-scheduler-routes";

describe("Cloud Scheduler & Webhook Trigger Router (/api/cron)", () => {
	it("registers all required scheduler endpoints in the router stack", () => {
		const routes = cloudSchedulerRouter.stack
			.filter((layer) => layer.route)
			.map((layer) => ({
				path: layer.route?.path,
				methods: Object.keys(layer.route?.methods || {}),
			}));

		const paths = routes.map((r) => r.path);
		expect(paths).toContain("/market-brief-eod");
		expect(paths).toContain("/sentinel-sweep");
		expect(paths).toContain("/fii-flow-sync");
		expect(paths).toContain("/mospi-cpi-sync");
		expect(paths).toContain("/status");
	});

	it("executes the /status route handler successfully", async () => {
		const statusLayer = cloudSchedulerRouter.stack.find(
			(layer) => layer.route?.path === "/status" && layer.route?.methods?.get,
		);
		expect(statusLayer).toBeDefined();

		const handler = statusLayer?.route?.stack[0]?.handle;
		expect(typeof handler).toBe("function");

		const mockReq = {} as Request;
		let responseData: any = null;
		let statusCode = 200;

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

		await handler(mockReq, mockRes);

		expect(statusCode).toBe(200);
		expect(responseData).toBeDefined();
		expect(responseData.success).toBe(true);
		expect(responseData.data.schedulerActive).toBe(true);
		expect(responseData.data.timestamp).toBeDefined();
	});

	it("authenticates scheduler requests using secret headers and blocks unauthenticated requests outside test mode", async () => {
		const authLayer = cloudSchedulerRouter.stack.find(
			(layer) => layer.handle && layer.handle.name === "authenticateScheduler",
		);
		expect(authLayer).toBeDefined();
		const authenticate = authLayer?.handle;

		const originalEnv = process.env.NODE_ENV;
		const originalSecret = process.env.CRON_SECRET;

		try {
			// Temporarily simulate non-test mode with a configured secret
			process.env.NODE_ENV = "development";
			process.env.CRON_SECRET = "test-cron-secret-123";

			let nextCalled = false;
			const nextFn = () => {
				nextCalled = true;
			};

			// Case 1: Unauthorized request with no headers
			let statusCode = 0;
			let errorResponse: any = null;
			const unauthReq = {
				headers: {},
				query: {},
				ip: "127.0.0.1",
			} as unknown as Request;
			const mockRes = {
				status: (code: number) => {
					statusCode = code;
					return mockRes;
				},
				json: (data: any) => {
					errorResponse = data;
					return mockRes;
				},
			} as unknown as Response;

			authenticate(unauthReq, mockRes, nextFn);
			expect(nextCalled).toBe(false);
			expect(statusCode).toBe(401);
			expect(errorResponse.error_code).toBe("UNAUTHORIZED_SCHEDULER_REQUEST");

			// Case 2: Spoofed header "x-cloudscheduler: true" without secret should FAIL
			const spoofedReq = {
				headers: { "x-cloudscheduler": "true" },
				query: {},
				ip: "127.0.0.1",
			} as unknown as Request;
			statusCode = 0;
			errorResponse = null;
			nextCalled = false;

			authenticate(spoofedReq, mockRes, nextFn);
			expect(nextCalled).toBe(false);
			expect(statusCode).toBe(401);

			// Case 3: Valid secret via X-Cron-Secret header succeeds
			const validReq = {
				headers: { "x-cron-secret": "test-cron-secret-123" },
				query: {},
				ip: "127.0.0.1",
			} as unknown as Request;
			nextCalled = false;

			authenticate(validReq, mockRes, nextFn);
			expect(nextCalled).toBe(true);

			// Case 4: Valid secret via Bearer authorization token succeeds
			const bearerReq = {
				headers: { authorization: "Bearer test-cron-secret-123" },
				query: {},
				ip: "127.0.0.1",
			} as unknown as Request;
			nextCalled = false;

			authenticate(bearerReq, mockRes, nextFn);
			expect(nextCalled).toBe(true);
		} finally {
			process.env.NODE_ENV = originalEnv;
			process.env.CRON_SECRET = originalSecret;
		}
	});
});
