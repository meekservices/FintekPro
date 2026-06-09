import { db } from "../../db";
import { amseModelRegistry } from "../../../shared/schema/ai";
import { eq, inArray } from "drizzle-orm";
import { ModelRegistryEntry, ModelRegistryManager } from "./types";

export class AIModelRegistry implements ModelRegistryManager {
	// High-performance caching layer to ensure AMSE Selection occurs < 50ms without DB bottleneck
	private registryCache: Map<string, ModelRegistryEntry> = new Map();
	private cacheLastUpdated: number = 0;
	private readonly CACHE_TTL_MS = 60000; // 1 min

	async getEligibleModels(
		requiredCapabilities: string[] = [],
	): Promise<ModelRegistryEntry[]> {
		await this.refreshCacheIfNeeded();

		// Convert cached iterables to active array list
		const activeModels = Array.from(this.registryCache.values()).filter(
			(m) => m.status === "active",
		);

		if (requiredCapabilities.length === 0) return activeModels;

		// Filter implicitly by capabilities if requested
		return activeModels.filter((m) =>
			requiredCapabilities.every((cap) => m.capabilities.includes(cap)),
		);
	}

	async updateModelScore(
		modelId: string,
		metricType: "accuracy" | "compliance" | "latency",
		value: number,
	): Promise<void> {
		try {
			const records = await db
				.select()
				.from(amseModelRegistry)
				.where(eq(amseModelRegistry.modelId, modelId));
			if (!records.length) return;
			const record = records[0];

			const updates: any = { lastUpdated: new Date() };

			if (metricType === "accuracy") {
				// Simple rolling simulated average
				const oldScore = Number.parseFloat((record.avgScore as string) || "0");
				updates.avgScore = (oldScore * 9 + value) / 10;
			} else if (metricType === "compliance") {
				const oldScore = Number.parseFloat(
					(record.complianceScore as string) || "100",
				);
				updates.complianceScore = (oldScore * 9 + value) / 10;
			} else if (metricType === "latency") {
				const oldLat = record.latencyMs || 0;
				updates.latencyMs = Math.round((oldLat * 9 + value) / 10);
			}

			await db
				.update(amseModelRegistry)
				.set(updates)
				.where(eq(amseModelRegistry.modelId, modelId));
			this.invalidateCache();
		} catch (e) {
			console.error(`[AMSE] Failed to update metrics for ${modelId}`, e);
		}
	}

	async deactivateModel(modelId: string, reason: string): Promise<void> {
		try {
			await db
				.update(amseModelRegistry)
				.set({ status: "inactive", lastUpdated: new Date() })
				.where(eq(amseModelRegistry.modelId, modelId));

			this.invalidateCache();
			console.warn(
				`[AMSE FAILSAFE] Model ${modelId} deactivated by Registry Manager. Reason: ${reason}`,
			);
		} catch (e) {
			console.error(`[AMSE] Failed to deactivate model ${modelId}`, e);
		}
	}

	private async refreshCacheIfNeeded(): Promise<void> {
		const now = Date.now();
		if (
			this.registryCache.size === 0 ||
			now - this.cacheLastUpdated > this.CACHE_TTL_MS
		) {
			const records = await db.select().from(amseModelRegistry);
			this.registryCache.clear();

			for (const r of records) {
				this.registryCache.set(r.modelId, {
					model_id: r.modelId,
					type: r.type as any,
					capabilities: r.capabilities as string[],
					avg_score: Number.parseFloat((r.avgScore as string) || "0"),
					latency_ms: r.latencyMs || 0,
					cost_per_call: Number.parseFloat((r.costPerCall as string) || "0"),
					compliance_score: Number.parseFloat(
						(r.complianceScore as string) || "100",
					),
					specialization_weights: r.specializationWeights as any,
					status: r.status as any,
					last_updated:
						r.lastUpdated?.toISOString() || new Date().toISOString(),
				});
			}
			this.cacheLastUpdated = now;
		}
	}

	private invalidateCache(): void {
		this.cacheLastUpdated = 0;
	}
}

export const modelRegistry = new AIModelRegistry();
