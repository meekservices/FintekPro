/**
 * @file base.repository.ts
 * @description Foundation Repository Class adhering to FintekPro GCR v1.0.
 *
 * Rules:
 * - Layered architecture: Repositories encapsulate all direct ORM calls.
 * - Structured logging: { event, latency_ms, status }
 * - Never crash full system; deterministic errors.
 */

import { db } from "../db";
import { logger } from "../logger";

export abstract class BaseRepository {
	protected readonly db = db;

	/**
	 * Executes a query with telemetry tracking and error encapsulation.
	 */
	protected async withTelemetry<T>(
		operationName: string,
		queryFn: () => Promise<T>,
	): Promise<T> {
		const start = Date.now();
		try {
			const result = await queryFn();
			const latencyMs = Date.now() - start;

			// Optional trace for slow queries (>200ms)
			if (latencyMs > 200) {
				logger.warn("[Repository] Slow query detected", {
					event: "REPO_SLOW_QUERY",
					operation: operationName,
					latency_ms: latencyMs,
					status: "SLOW",
				});
			}

			return result;
		} catch (error: any) {
			const latencyMs = Date.now() - start;
			logger.error(`[Repository] ${operationName} failed`, {
				event: "REPO_QUERY_ERROR",
				operation: operationName,
				error: error.message,
				latency_ms: latencyMs,
				status: "FAILED",
			});
			throw error;
		}
	}
}

