import { logger } from "../../logger";
import { irisClient } from "../iris/irisClient";
import { IrisProductMapper } from "../iris/irisProductMapper";

// In a real implementation, this would use Redis
const cache = new Map<string, any>();
const CACHE_TTL = 3600000; // 1 hour

export class ProductCatalogService {
	async getMutualFunds(forceRefresh = false) {
		return this.getCachedProducts(
			"MUTUAL_FUND",
			async () => {
				const rawProducts = await irisClient.fetchProducts("mf");
				// Assume rawProducts is an array of schemes
				return (rawProducts?.schemes || []).map((p: any) =>
					IrisProductMapper.normalizeMutualFund(p),
				);
			},
			forceRefresh,
		);
	}

	async getFixedDeposits(forceRefresh = false) {
		return this.getCachedProducts(
			"FIXED_DEPOSIT",
			async () => {
				const rawProducts = await irisClient.fetchProducts("fd");
				// Assume rawProducts is an array of FDs
				return (rawProducts?.products || []).map((p: any) =>
					IrisProductMapper.normalizeFixedDeposit(p),
				);
			},
			forceRefresh,
		);
	}

	async getPmsProducts(forceRefresh = false) {
		return this.getCachedProducts(
			"PMS",
			async () => {
				const rawProducts = await irisClient.fetchProducts("pms");
				// Simple passthrough for now, requires specific PMS mapper
				return rawProducts?.products || [];
			},
			forceRefresh,
		);
	}

	async getAifProducts(forceRefresh = false) {
		return this.getCachedProducts(
			"AIF",
			async () => {
				const rawProducts = await irisClient.fetchProducts("aif");
				// Simple passthrough for now, requires specific AIF mapper
				return rawProducts?.products || [];
			},
			forceRefresh,
		);
	}

	private async getCachedProducts(
		key: string,
		fetchFn: () => Promise<any>,
		forceRefresh: boolean,
	) {
		if (!forceRefresh && cache.has(key)) {
			const cached = cache.get(key);
			if (Date.now() - cached.timestamp < CACHE_TTL) {
				return cached.data;
			}
		}

		try {
			logger.info(`[ProductCatalog] Fetching fresh data for ${key}`);
			const data = await fetchFn();

			cache.set(key, {
				timestamp: Date.now(),
				data,
			});

			return data;
		} catch (error: any) {
			logger.error(`[ProductCatalog] Failed to fetch products for ${key}`, {
				error: error.message,
			});
			// If we have stale cache, return it as fallback
			if (cache.has(key)) {
				logger.warn(
					`[ProductCatalog] Returning stale cache for ${key} due to fetch error`,
				);
				return cache.get(key).data;
			}
			throw error;
		}
	}
}

export const productCatalogService = new ProductCatalogService();
