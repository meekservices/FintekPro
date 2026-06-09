import { db } from "../db";
import { sql } from "drizzle-orm";

interface PlatformStats {
	activeUsers: string;
	activeUsersRaw: number;
	portfolioValue: string;
	portfolioValueRaw: number;
	avgPortfolioValue: string;
	avgPortfolioValueRaw: number;
	portfoliosCount: string;
	portfoliosCountRaw: number;
	dailyTrades: string;
	dailyTradesRaw: number;
	monthlyTrades: string;
	monthlyTradesRaw: number;
	mutualFundsCount: string;
	mutualFundsCountRaw: number;
	bondsCount: string;
	bondsCountRaw: number;
	stocksCount: string;
	stocksCountRaw: number;
	activeIpos: string;
	activeIposRaw: number;
	investmentOptions: string;
	investmentOptionsRaw: number;
	lastUpdated: string;
}

interface CacheEntry {
	data: PlatformStats;
	timestamp: number;
	isRefreshing: boolean;
}

interface CacheMetrics {
	hits: number;
	misses: number;
	refreshes: number;
	errors: number;
	lastRefreshTime: number;
	lastRefreshDuration: number;
}

const DEFAULT_TTL_MS = 60 * 1000;
const STALE_TTL_MS = 5 * 60 * 1000;

const FALLBACK_STATS: PlatformStats = {
	activeUsers: "0",
	activeUsersRaw: 0,
	portfolioValue: "₹0",
	portfolioValueRaw: 0,
	avgPortfolioValue: "₹0",
	avgPortfolioValueRaw: 0,
	portfoliosCount: "0",
	portfoliosCountRaw: 0,
	dailyTrades: "0",
	dailyTradesRaw: 0,
	monthlyTrades: "0",
	monthlyTradesRaw: 0,
	mutualFundsCount: "0",
	mutualFundsCountRaw: 0,
	bondsCount: "0",
	bondsCountRaw: 0,
	stocksCount: "0",
	stocksCountRaw: 0,
	activeIpos: "0",
	activeIposRaw: 0,
	investmentOptions: "0+",
	investmentOptionsRaw: 0,
	lastUpdated: new Date().toISOString(),
};

class PlatformStatsCache {
	private cache: CacheEntry | null = null;
	private metrics: CacheMetrics = {
		hits: 0,
		misses: 0,
		refreshes: 0,
		errors: 0,
		lastRefreshTime: 0,
		lastRefreshDuration: 0,
	};
	private refreshLock = false;
	private ttlMs: number;

	constructor(ttlMs: number = DEFAULT_TTL_MS) {
		this.ttlMs = ttlMs;
	}

	setTTL(ttlMs: number): void {
		this.ttlMs = ttlMs;
		console.log(`📊 [PlatformStatsCache] TTL updated to ${ttlMs}ms`);
	}

	getTTL(): number {
		return this.ttlMs;
	}

	invalidate(): void {
		this.cache = null;
		console.log("🔄 [PlatformStatsCache] Cache invalidated");
	}

	async initialize(): Promise<void> {
		console.log("📊 [PlatformStatsCache] Starting initialization...");
		await this.refreshCache();
		console.log("✅ [PlatformStatsCache] Initialization completed");
	}

	private formatNumber(num: number): string {
		if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
		if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	}

	private formatCurrency(num: number): string {
		if (num >= 10000000) return `₹${(num / 10000000).toFixed(0)} Cr`;
		if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
		if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
		return `₹${num.toFixed(0)}`;
	}

	private async fetchStats(): Promise<PlatformStats> {
		const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
        (SELECT COALESCE(SUM(CAST(total_value AS numeric)), 0) FROM portfolios) as total_portfolio_value,
        (SELECT COALESCE(AVG(CAST(total_value AS numeric)), 0) FROM portfolios WHERE total_value IS NOT NULL AND CAST(total_value AS numeric) > 0) as avg_portfolio_value,
        (SELECT COUNT(*) FROM portfolios) as portfolios_count,
        (SELECT COUNT(*) FROM unified_orders WHERE created_at >= CURRENT_DATE) as daily_orders,
        (SELECT COUNT(*) FROM unified_orders WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as monthly_orders,
        (SELECT COUNT(*) FROM mutual_funds) as mutual_funds_count,
        (SELECT COUNT(*) FROM bond_catalog) as bonds_count,
        (SELECT COUNT(*) FROM unlisted_companies) as unlisted_count,
        (SELECT COUNT(*) FROM listed_stocks) as stocks_count,
        (SELECT COUNT(*) FROM ipo_companies WHERE status = 'open' OR status = 'upcoming') as active_ipos_count
    `);

		const stats = result.rows[0] as any;
		const totalInvestmentOptions =
			Number(stats.mutual_funds_count || 0) +
			Number(stats.bonds_count || 0) +
			Number(stats.unlisted_count || 0);

		return {
			activeUsers: this.formatNumber(Number(stats.active_users) || 0),
			activeUsersRaw: Number(stats.active_users) || 0,
			portfolioValue: this.formatCurrency(
				Number(stats.total_portfolio_value) || 0,
			),
			portfolioValueRaw: Number(stats.total_portfolio_value) || 0,
			avgPortfolioValue: this.formatCurrency(
				Number(stats.avg_portfolio_value) || 0,
			),
			avgPortfolioValueRaw: Number(stats.avg_portfolio_value) || 0,
			portfoliosCount: this.formatNumber(Number(stats.portfolios_count) || 0),
			portfoliosCountRaw: Number(stats.portfolios_count) || 0,
			dailyTrades: this.formatNumber(Number(stats.daily_orders) || 0),
			dailyTradesRaw: Number(stats.daily_orders) || 0,
			monthlyTrades: this.formatNumber(Number(stats.monthly_orders) || 0),
			monthlyTradesRaw: Number(stats.monthly_orders) || 0,
			mutualFundsCount: this.formatNumber(
				Number(stats.mutual_funds_count) || 0,
			),
			mutualFundsCountRaw: Number(stats.mutual_funds_count) || 0,
			bondsCount: this.formatNumber(Number(stats.bonds_count) || 0),
			bondsCountRaw: Number(stats.bonds_count) || 0,
			stocksCount: this.formatNumber(Number(stats.stocks_count) || 0),
			stocksCountRaw: Number(stats.stocks_count) || 0,
			activeIpos: this.formatNumber(Number(stats.active_ipos_count) || 0),
			activeIposRaw: Number(stats.active_ipos_count) || 0,
			investmentOptions: this.formatNumber(totalInvestmentOptions) + "+",
			investmentOptionsRaw: totalInvestmentOptions,
			lastUpdated: new Date().toISOString(),
		};
	}

	private async refreshCache(): Promise<void> {
		if (this.refreshLock) {
			console.log(
				"⏳ [PlatformStatsCache] Refresh already in progress, skipping",
			);
			return;
		}

		this.refreshLock = true;
		const startTime = Date.now();

		try {
			console.log("📊 [PlatformStatsCache] Fetching fresh stats...");
			const stats = await this.fetchStats();

			this.cache = {
				data: stats,
				timestamp: Date.now(),
				isRefreshing: false,
			};

			this.metrics.refreshes++;
			this.metrics.lastRefreshTime = Date.now();
			this.metrics.lastRefreshDuration = Date.now() - startTime;

			console.log(
				`✅ [PlatformStatsCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms`,
			);
		} catch (error) {
			this.metrics.errors++;
			console.error("❌ [PlatformStatsCache] Refresh failed:", error);

			if (!this.cache) {
				this.cache = {
					data: FALLBACK_STATS,
					timestamp: Date.now(),
					isRefreshing: false,
				};
				console.log("📌 [PlatformStatsCache] Using fallback data");
			}
		} finally {
			this.refreshLock = false;
		}
	}

	async getStats(): Promise<{
		data: PlatformStats;
		cached: boolean;
		cacheAge: number;
	}> {
		const now = Date.now();

		if (this.cache) {
			const cacheAge = now - this.cache.timestamp;

			if (cacheAge < this.ttlMs) {
				this.metrics.hits++;
				return {
					data: this.cache.data,
					cached: true,
					cacheAge,
				};
			}

			if (cacheAge < STALE_TTL_MS) {
				this.metrics.hits++;
				console.log(
					`📦 [PlatformStatsCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s), refreshing in background`,
				);

				if (!this.refreshLock) {
					this.refreshCache().catch(console.error);
				}

				return {
					data: this.cache.data,
					cached: true,
					cacheAge,
				};
			}
		}

		this.metrics.misses++;
		await this.refreshCache();

		return {
			data: this.cache?.data || FALLBACK_STATS,
			cached: false,
			cacheAge: 0,
		};
	}

	getMetrics(): CacheMetrics & { ttlMs: number; cacheAge: number | null } {
		return {
			...this.metrics,
			ttlMs: this.ttlMs,
			cacheAge: this.cache ? Date.now() - this.cache.timestamp : null,
		};
	}
}

export const platformStatsCache = new PlatformStatsCache();
