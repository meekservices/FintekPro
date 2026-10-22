import { db } from "../db";
import { modelPortfolios, mutualFunds } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { stockIntersectionAnalysisService } from "./stock-intersection-analysis-service";
import { mfSebiOverlapService } from "./mf-sebi-overlap-service";
import { twoTierCacheService } from "./two-tier-cache-service";
import { logger } from "../logger";

export interface MaterializationSummary {
	modelPortfoliosWarmed: number;
	mfPairsComputed: number;
	durationMs: number;
	timestamp: string;
	status: "SUCCESS" | "PARTIAL_FAILURE";
}

export class NightlyCacheMaterializer {
	private static instance: NightlyCacheMaterializer;
	private isRunning = false;

	static getInstance(): NightlyCacheMaterializer {
		if (!NightlyCacheMaterializer.instance) {
			NightlyCacheMaterializer.instance = new NightlyCacheMaterializer();
		}
		return NightlyCacheMaterializer.instance;
	}

	/**
	 * Pre-materializes model portfolio overlaps and mutual fund overlap matrix.
	 * Scheduled to run nightly after AMFI NAV updates (e.g. 23:30 IST).
	 */
	async runNightlyMaterialization(): Promise<MaterializationSummary> {
		if (this.isRunning) {
			logger.warn("[NightlyMaterializer] Job already in progress, skipping concurrent run");
			return {
				modelPortfoliosWarmed: 0,
				mfPairsComputed: 0,
				durationMs: 0,
				timestamp: new Date().toISOString(),
				status: "SUCCESS",
			};
		}

		this.isRunning = true;
		const t0 = Date.now();
		logger.info("[NightlyMaterializer] Starting nightly cache pre-computation & materialization...");

		let modelPortfoliosWarmed = 0;
		let mfPairsComputed = 0;

		try {
			// 1. Pre-warm Model Portfolio Overlaps
			const portfolios = await db
				.select({ id: modelPortfolios.id, name: modelPortfolios.name })
				.from(modelPortfolios)
				.where(eq(modelPortfolios.isPublished, true))
				.limit(50);

			for (const p of portfolios) {
				try {
					const result = await stockIntersectionAnalysisService.analyzeModelPortfolio(p.id);
					// Store with 24-hour TTL in L1 + L2
					await twoTierCacheService.set(`model_portfolio_overlap:${p.id}`, result, 86400);
					modelPortfoliosWarmed++;
				} catch (err: any) {
					logger.warn(`[NightlyMaterializer] Model portfolio ${p.id} warm notice:`, err?.message);
				}
			}

			// 2. Pre-compute Top SEBI Thematic/Sectoral Pairwise Overlaps
			try {
				const overlapRes = await mfSebiOverlapService.computeAllOverlaps("sectoral");
				mfPairsComputed = overlapRes.pairsComputed;
			} catch (overlapErr: any) {
				logger.warn("[NightlyMaterializer] Pairwise overlap computation notice:", overlapErr?.message);
			}

			// 3. Purge expired entries in PostgreSQL L2 store
			const purged = await twoTierCacheService.purgeExpiredL2Entries();
			logger.info(`[NightlyMaterializer] Purged ${purged} expired L2 cache records`);

			const durationMs = Date.now() - t0;
			logger.info(
				JSON.stringify({
					event: "NIGHTLY_CACHE_MATERIALIZATION_COMPLETED",
					portfolios_warmed: modelPortfoliosWarmed,
					mf_pairs_computed: mfPairsComputed,
					duration_ms: durationMs,
					status: "SUCCESS",
				}),
			);

			return {
				modelPortfoliosWarmed,
				mfPairsComputed,
				durationMs,
				timestamp: new Date().toISOString(),
				status: "SUCCESS",
			};
		} catch (error: any) {
			logger.error("[NightlyMaterializer] Fatal failure during materialization:", error);
			return {
				modelPortfoliosWarmed,
				mfPairsComputed,
				durationMs: Date.now() - t0,
				timestamp: new Date().toISOString(),
				status: "PARTIAL_FAILURE",
			};
		} finally {
			this.isRunning = false;
		}
	}
}

export const nightlyCacheMaterializer = NightlyCacheMaterializer.getInstance();
