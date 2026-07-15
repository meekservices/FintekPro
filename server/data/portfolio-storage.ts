/**
 * Portfolio Storage Facade
 *
 * Domain-scoped facade over DatabaseStorage for portfolio, holdings,
 * watchlists, asset allocation, and rebalancing operations.
 *
 * @module data/portfolio-storage
 */

import { storage } from "../storage";
import type { IStorage } from "../storage-types";

type S = IStorage;

export const portfolioStorage = {
	/** Portfolios */
	getPortfolio: (...a: Parameters<S["getPortfolio"]>) => storage.getPortfolio(...a),
	getPortfoliosByUserId: (...a: Parameters<S["getPortfoliosByUserId"]>) =>
		storage.getPortfoliosByUserId(...a),
	getPortfoliosByUserPan: (...a: Parameters<S["getPortfoliosByUserPan"]>) =>
		storage.getPortfoliosByUserPan(...a),
	createPortfolio: (...a: Parameters<S["createPortfolio"]>) => storage.createPortfolio(...a),
	updatePortfolio: (...a: Parameters<S["updatePortfolio"]>) => storage.updatePortfolio(...a),
	getPortfolioPerformance: (...a: Parameters<S["getPortfolioPerformance"]>) =>
		storage.getPortfolioPerformance(...a),

	/** Holdings */
	getPortfolioHoldings: (...a: Parameters<S["getPortfolioHoldings"]>) =>
		storage.getPortfolioHoldings(...a),
	createPortfolioHolding: (...a: Parameters<S["createPortfolioHolding"]>) =>
		storage.createPortfolioHolding(...a),
	updatePortfolioHolding: (...a: Parameters<S["updatePortfolioHolding"]>) =>
		storage.updatePortfolioHolding(...a),
	deletePortfolioHolding: (...a: Parameters<S["deletePortfolioHolding"]>) =>
		storage.deletePortfolioHolding(...a),

	/** External holdings */
	getExternalHoldings: (...a: Parameters<S["getExternalHoldings"]>) =>
		storage.getExternalHoldings(...a),
	getExternalHoldingsBySource: (...a: Parameters<S["getExternalHoldingsBySource"]>) =>
		storage.getExternalHoldingsBySource(...a),
	createExternalHolding: (...a: Parameters<S["createExternalHolding"]>) =>
		storage.createExternalHolding(...a),
	deleteExternalHoldingsBySource: (...a: Parameters<S["deleteExternalHoldingsBySource"]>) =>
		storage.deleteExternalHoldingsBySource(...a),

	/** Watchlists */
	getWatchlistsByUserId: (...a: Parameters<S["getWatchlistsByUserId"]>) =>
		storage.getWatchlistsByUserId(...a),
	createWatchlist: (...a: Parameters<S["createWatchlist"]>) => storage.createWatchlist(...a),

	/** Asset allocation & rebalancing */
	getAssetAllocation: (...a: Parameters<S["getAssetAllocation"]>) =>
		storage.getAssetAllocation(...a),
	upsertAssetAllocation: (...a: Parameters<S["upsertAssetAllocation"]>) =>
		storage.upsertAssetAllocation(...a),
	getRebalancingSuggestions: (...a: Parameters<S["getRebalancingSuggestions"]>) =>
		storage.getRebalancingSuggestions(...a),

	/** Market data */
	getMarketData: (...a: Parameters<S["getMarketData"]>) => storage.getMarketData(...a),
	getMultipleMarketData: (...a: Parameters<S["getMultipleMarketData"]>) =>
		storage.getMultipleMarketData(...a),
	upsertMarketData: (...a: Parameters<S["upsertMarketData"]>) => storage.upsertMarketData(...a),
} as const;
