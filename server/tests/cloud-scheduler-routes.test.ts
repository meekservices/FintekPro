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
});
