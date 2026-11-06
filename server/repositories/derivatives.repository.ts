/**
 * @file derivatives.repository.ts
 * @description Domain Repository for Derivative Contracts, Hedged Positions, and Algo Executions.
 *
 * Adheres to FintekPro GCR v1.0:
 * - Idempotency key lookup
 * - Telemetry & execution tracing
 */

import { eq, and, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
	derivativePositions,
	type DerivativePosition,
	type InsertDerivativePosition,
} from "@shared/schema/derivatives";

export class DerivativesRepository extends BaseRepository {
	/**
	 * Get open positions for a user
	 */
	async getOpenPositions(userId: string): Promise<DerivativePosition[]> {
		return this.withTelemetry("getOpenPositions", async () => {
			return this.db
				.select()
				.from(derivativePositions)
				.where(
					and(
						eq(derivativePositions.userId, userId),
						eq(derivativePositions.status, "OPEN"),
					),
				)
				.orderBy(desc(derivativePositions.createdAt));
		});
	}

	/**
	 * Find position by idempotency key (prevents duplicate trade executions)
	 */
	async findByIdempotencyKey(
		idempotencyKey: string,
	): Promise<DerivativePosition | null> {
		return this.withTelemetry("findByIdempotencyKey", async () => {
			const rows = await this.db
				.select()
				.from(derivativePositions)
				.where(eq(derivativePositions.idempotencyKey, idempotencyKey))
				.limit(1);
			return rows[0] || null;
		});
	}

	/**
	 * Create a new derivative position
	 */
	async createPosition(data: InsertDerivativePosition): Promise<DerivativePosition> {
		return this.withTelemetry("createPosition", async () => {
			const rows = await this.db
				.insert(derivativePositions)
				.values(data as any)
				.returning();
			return rows[0];
		});
	}

	/**
	 * Update position status and PnL
	 */
	async updatePositionStatus(
		id: string,
		status: "OPEN" | "CLOSED" | "EXPIRED",
		realizedPnl?: string,
	) {
		return this.withTelemetry("updatePositionStatus", async () => {
			const updateData: any = {
				status,
				updatedAt: new Date(),
			};
			if (realizedPnl !== undefined) {
				updateData.realizedPnl = realizedPnl;
			}

			const rows = await this.db
				.update(derivativePositions)
				.set(updateData)
				.where(eq(derivativePositions.id, id))
				.returning();
			return rows[0] || null;
		});
	}
}

export const derivativesRepository = new DerivativesRepository();
