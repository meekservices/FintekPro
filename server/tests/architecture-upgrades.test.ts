/**
 * @file architecture-upgrades.test.ts
 * @description Comprehensive Unit Test Suite for FintekPro Architectural Upgrades:
 * 1. Distributed Lock (Redlock Pattern with Fallback)
 * 2. Domain-Driven Repositories (Distribution, Derivatives, User)
 * 3. Asynchronous Quant Task Queue (Idempotency, Status, Handlers)
 */

import { describe, it, expect } from "vitest";
import {
	acquireDistributedLock,
	withDistributedLock,
} from "../utils/distributed-lock";
import { taskQueueEngine } from "../services/queue/task-queue";
import { distributionRepository } from "../repositories/distribution.repository";
import { derivativesRepository } from "../repositories/derivatives.repository";
import { userRepository } from "../repositories/user.repository";

describe("Architecture Upgrade — Distributed Lock Engine", () => {
	it("should acquire lock and release successfully", async () => {
		const lockKey = "test-job-unique-1";
		const handle = await acquireDistributedLock(lockKey, 5);

		expect(handle.acquired).toBe(true);
		expect(handle.lockKey).toBe(lockKey);
		expect(typeof handle.token).toBe("string");

		// Second acquisition while locked should fail/contest
		const secondHandle = await acquireDistributedLock(lockKey, 5);
		expect(secondHandle.acquired).toBe(false);

		// Release first lock
		const released = await handle.release();
		expect(released).toBe(true);

		// Now second acquisition can succeed
		const thirdHandle = await acquireDistributedLock(lockKey, 5);
		expect(thirdHandle.acquired).toBe(true);
		await thirdHandle.release();
	});

	it("should execute task wrapped in withDistributedLock", async () => {
		let executedCount = 0;
		const lockKey = "test-wrapped-job";

		const res1 = await withDistributedLock(lockKey, 5, async () => {
			executedCount++;
			return "task-result-1";
		});

		expect(res1.executed).toBe(true);
		expect(res1.result).toBe("task-result-1");
		expect(executedCount).toBe(1);
	});
});

describe("Architecture Upgrade — Domain Repositories", () => {
	it("distributionRepository should expose methods adhering to BaseRepository telemetry", () => {
		expect(distributionRepository).toBeDefined();
		expect(typeof distributionRepository.getActiveStoreProducts).toBe("function");
		expect(typeof distributionRepository.getStoreProductById).toBe("function");
		expect(typeof distributionRepository.getProposalsByAgent).toBe("function");
	});

	it("derivativesRepository should support idempotency key lookup and status updates", () => {
		expect(derivativesRepository).toBeDefined();
		expect(typeof derivativesRepository.findByIdempotencyKey).toBe("function");
		expect(typeof derivativesRepository.createPosition).toBe("function");
		expect(typeof derivativesRepository.updatePositionStatus).toBe("function");
	});

	it("userRepository should provide user lookup methods", () => {
		expect(userRepository).toBeDefined();
		expect(typeof userRepository.findById).toBe("function");
		expect(typeof userRepository.findByUsernameOrEmail).toBe("function");
	});
});

describe("Architecture Upgrade — Asynchronous Task Queue", () => {
	it("should register handler, enqueue job, and process asynchronously", async () => {
		const taskType = "test-quant-sim";
		let handlerExecuted = false;

		taskQueueEngine.registerHandler(taskType, async (job, updateProgress) => {
			await updateProgress(50);
			handlerExecuted = true;
			return {
				computedCagr: 14.5,
				iterations: job.payload.iterations,
			};
		});

		const job = await taskQueueEngine.enqueue(
			taskType,
			{ iterations: 1000 },
			{ idempotencyKey: "idem-quant-001" },
		);

		expect(job.id).toBeDefined();
		expect(job.status).toBe("pending");
		expect(job.idempotencyKey).toBe("idem-quant-001");

		// Wait briefly for setImmediate to execute
		await new Promise((resolve) => setTimeout(resolve, 50));

		const updatedJob = await taskQueueEngine.getJob(job.id);
		expect(updatedJob).toBeDefined();
		expect(updatedJob?.status).toBe("completed");
		expect(updatedJob?.progress).toBe(100);
		expect(updatedJob?.result?.computedCagr).toBe(14.5);
		expect(handlerExecuted).toBe(true);
	});

	it("should support idempotent replay of enqueued jobs", async () => {
		const idempotencyKey = "idem-repeat-check";
		const taskType = "test-quant-repeat";

		taskQueueEngine.registerHandler(taskType, async () => {
			return { success: true };
		});

		const job1 = await taskQueueEngine.enqueue(taskType, { a: 1 }, { idempotencyKey });
		const job2 = await taskQueueEngine.enqueue(taskType, { a: 1 }, { idempotencyKey });

		expect(job2.id).toBe(job1.id);
	});
});
