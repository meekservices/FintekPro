/**
 * Unlisted Price Aggregation Service
 * Aggregates price suggestions from multiple sources:
 * 1. MoneyControl.com - External indicative prices
 * 2. Internal Calculation - PriceSuggestionService using CredHive fundamentals
 * 3. Marketplace - Seller/Buyer offers from the platform
 */

import { storage } from "../storage";
import {
	PriceSuggestionService,
	type PriceSuggestion,
} from "./price-suggestion";
import { moneyControlScraper } from "./moneycontrol-scraper";
import type {
	UnlistedCompany,
	SellListing,
	BuyRequest,
	UnlistedDeal,
	UnlistedPriceHistory,
} from "@shared/schema";

export interface MoneyControlPrice {
	price: number | null;
	change: number | null;
	changePercent: number | null;
	lastUpdated: Date | null;
	source: "moneycontrol";
	matchedName?: string;
	matchScore?: number;
	available: boolean;
	error?: string;
}

export interface InternalCalculation {
	suggestedPrice: number | null;
	minPrice: number | null;
	maxPrice: number | null;
	confidence: "high" | "medium" | "low" | null;
	methodology: string | null;
	factors: {
		fundamentalValue?: number;
		marketValue?: number;
		dealHistoryValue?: number;
		sellerFeedValue?: number;
	} | null;
	rationale: string[];
	lastUpdated: Date | null;
	available: boolean;
	error?: string;
}

export interface MarketplacePrice {
	bestBid: number | null; // Highest active buy request
	bestAsk: number | null; // Lowest active sell listing
	bidVolume: number; // Total quantity at best bid
	askVolume: number; // Total quantity at best ask
	recentClearingPrice: number | null; // Weighted avg of recent deals (90 days)
	recentDealCount: number;
	activeBuyRequests: number;
	activeSellListings: number;
	lastDealDate: Date | null;
	lastUpdated: Date;
	available: boolean;
}

export interface AggregatedPriceSuggestion {
	companyId: string;
	companyName: string;
	moneyControl: MoneyControlPrice;
	internalCalculation: InternalCalculation;
	marketplace: MarketplacePrice;
	recommendedBuyPrice: number | null;
	recommendedSellPrice: number | null;
	priceConfidence: "high" | "medium" | "low";
	lastUpdated: Date;
}

class UnlistedPriceAggregationService {
	private priceSuggestionService: PriceSuggestionService;

	constructor() {
		this.priceSuggestionService = new PriceSuggestionService(storage as any);
	}

	/**
	 * Get aggregated price suggestions from all sources for a company
	 */
	async getAggregatedPriceSuggestion(
		companyId: string,
	): Promise<AggregatedPriceSuggestion> {
		const company = await storage.getUnlistedCompanyById(companyId);
		if (!company) {
			throw new Error("Company not found");
		}

		// Fetch all price sources in parallel
		const [moneyControl, internalCalc, marketplace] = await Promise.all([
			this.getMoneyControlPrice(company),
			this.getInternalCalculation(companyId),
			this.getMarketplacePrice(companyId),
		]);

		// Calculate recommended prices based on available data
		const { buyPrice, sellPrice, confidence } = this.calculateRecommendedPrices(
			moneyControl,
			internalCalc,
			marketplace,
		);

		return {
			companyId,
			companyName: company.name,
			moneyControl,
			internalCalculation: internalCalc,
			marketplace,
			recommendedBuyPrice: buyPrice,
			recommendedSellPrice: sellPrice,
			priceConfidence: confidence,
			lastUpdated: new Date(),
		};
	}

	/**
	 * Get MoneyControl indicative price for a company
	 */
	private async getMoneyControlPrice(
		company: UnlistedCompany,
	): Promise<MoneyControlPrice> {
		try {
			// First check if we have recent price history from MoneyControl
			const priceHistory = await storage.getPriceHistory(company.id, 5);
			const moneyControlPrices = priceHistory.filter(
				(p: UnlistedPriceHistory) => p.sourceType === "MONEYCONTROL",
			);

			if (moneyControlPrices.length > 0) {
				const latestPrice = moneyControlPrices[0];
				const previousPrice = moneyControlPrices[1];

				const price = Number.parseFloat(latestPrice.price);
				const change = previousPrice
					? price - Number.parseFloat(previousPrice.price)
					: null;
				const changePercent =
					previousPrice && Number.parseFloat(previousPrice.price) > 0
						? ((price - Number.parseFloat(previousPrice.price)) /
								Number.parseFloat(previousPrice.price)) *
							100
						: null;

				return {
					price,
					change,
					changePercent,
					lastUpdated: new Date(latestPrice.date),
					source: "moneycontrol",
					available: true,
				};
			}

			// If no cached price, try to search by company name
			const searchResult = await moneyControlScraper.searchISINByCompanyName(
				company.name,
			);

			if (searchResult.price !== null) {
				return {
					price: searchResult.price,
					change: null,
					changePercent: null,
					lastUpdated: new Date(),
					source: "moneycontrol",
					matchedName: searchResult.matchedName || undefined,
					matchScore: searchResult.matchScore,
					available: true,
				};
			}

			return {
				price: null,
				change: null,
				changePercent: null,
				lastUpdated: null,
				source: "moneycontrol",
				available: false,
				error: "No price data available from MoneyControl",
			};
		} catch (error: any) {
			console.error("[PriceAggregation] MoneyControl error:", error.message);
			return {
				price: null,
				change: null,
				changePercent: null,
				lastUpdated: null,
				source: "moneycontrol",
				available: false,
				error: error.message,
			};
		}
	}

	/**
	 * Get internal price calculation using CredHive fundamentals
	 */
	private async getInternalCalculation(
		companyId: string,
	): Promise<InternalCalculation> {
		try {
			const suggestion =
				await this.priceSuggestionService.calculateSuggestedPrice(companyId);

			return {
				suggestedPrice: suggestion.suggestedPrice,
				minPrice: suggestion.minPrice,
				maxPrice: suggestion.maxPrice,
				confidence: suggestion.confidence,
				methodology: suggestion.methodology,
				factors: suggestion.factors,
				rationale: suggestion.rationale,
				lastUpdated: suggestion.lastUpdated,
				available: true,
			};
		} catch (error: any) {
			console.error(
				"[PriceAggregation] Internal calculation error:",
				error.message,
			);
			return {
				suggestedPrice: null,
				minPrice: null,
				maxPrice: null,
				confidence: null,
				methodology: null,
				factors: null,
				rationale: [],
				lastUpdated: null,
				available: false,
				error: error.message,
			};
		}
	}

	/**
	 * Get marketplace price data from seller/buyer offers
	 */
	private async getMarketplacePrice(
		companyId: string,
	): Promise<MarketplacePrice> {
		try {
			const [sellListings, buyRequests, deals] = await Promise.all([
				storage.getSellListingsByCompany(companyId),
				storage.getBuyRequestsByCompany(companyId),
				storage.getUnlistedDealsByCompany(companyId),
			]);

			const now = new Date();

			// Filter active sell listings
			const activeListings = sellListings.filter((l: SellListing) => {
				return l.status === "active" && new Date(l.validUntil || now) > now;
			});

			// Filter active buy requests
			const activeRequests = buyRequests.filter((r: BuyRequest) => {
				return r.status === "active" && new Date(r.validUntil || now) > now;
			});

			// Find best bid (highest buy request - using maxPrice field)
			let bestBid: number | null = null;
			let bidVolume = 0;
			if (activeRequests.length > 0) {
				const sortedBids = activeRequests.sort(
					(a: BuyRequest, b: BuyRequest) =>
						Number.parseFloat(b.maxPrice) - Number.parseFloat(a.maxPrice),
				);
				bestBid = Number.parseFloat(sortedBids[0].maxPrice);
				// Sum volume at or near best bid (within 2%)
				bidVolume = sortedBids
					.filter(
						(r: BuyRequest) => Number.parseFloat(r.maxPrice) >= bestBid! * 0.98,
					)
					.reduce((sum: number, r: BuyRequest) => sum + r.quantity, 0);
			}

			// Find best ask (lowest sell listing)
			let bestAsk: number | null = null;
			let askVolume = 0;
			if (activeListings.length > 0) {
				const sortedAsks = activeListings.sort(
					(a: SellListing, b: SellListing) =>
						Number.parseFloat(a.landingPrice || a.askPrice) -
						Number.parseFloat(b.landingPrice || b.askPrice),
				);
				bestAsk = Number.parseFloat(
					sortedAsks[0].landingPrice || sortedAsks[0].askPrice,
				);
				// Sum volume at or near best ask (within 2%)
				askVolume = sortedAsks
					.filter(
						(l: SellListing) =>
							Number.parseFloat(l.landingPrice || l.askPrice) <=
							bestAsk! * 1.02,
					)
					.reduce((sum: number, l: SellListing) => sum + l.quantity, 0);
			}

			// Calculate recent clearing price from deals (last 90 days)
			const ninetyDaysAgo = new Date();
			ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

			const recentDeals = deals.filter((d: UnlistedDeal) => {
				return (
					d.status === "completed" &&
					new Date(d.createdAt || now) >= ninetyDaysAgo
				);
			});

			let recentClearingPrice: number | null = null;
			let lastDealDate: Date | null = null;

			if (recentDeals.length > 0) {
				// Weighted average by quantity
				const totalValue = recentDeals.reduce(
					(sum: number, d: UnlistedDeal) =>
						sum + Number.parseFloat(d.agreedPrice) * d.quantity,
					0,
				);
				const totalQuantity = recentDeals.reduce(
					(sum: number, d: UnlistedDeal) => sum + d.quantity,
					0,
				);
				recentClearingPrice = Math.round(totalValue / totalQuantity);

				// Get most recent deal date
				const sortedDeals = recentDeals.sort(
					(a: UnlistedDeal, b: UnlistedDeal) =>
						new Date(b.createdAt || 0).getTime() -
						new Date(a.createdAt || 0).getTime(),
				);
				lastDealDate = new Date(sortedDeals[0].createdAt || now);
			}

			return {
				bestBid,
				bestAsk,
				bidVolume,
				askVolume,
				recentClearingPrice,
				recentDealCount: recentDeals.length,
				activeBuyRequests: activeRequests.length,
				activeSellListings: activeListings.length,
				lastDealDate,
				lastUpdated: new Date(),
				available:
					bestBid !== null || bestAsk !== null || recentClearingPrice !== null,
			};
		} catch (error: any) {
			console.error("[PriceAggregation] Marketplace error:", error.message);
			return {
				bestBid: null,
				bestAsk: null,
				bidVolume: 0,
				askVolume: 0,
				recentClearingPrice: null,
				recentDealCount: 0,
				activeBuyRequests: 0,
				activeSellListings: 0,
				lastDealDate: null,
				lastUpdated: new Date(),
				available: false,
			};
		}
	}

	/**
	 * Calculate recommended buy/sell prices based on all available data
	 */
	private calculateRecommendedPrices(
		moneyControl: MoneyControlPrice,
		internalCalc: InternalCalculation,
		marketplace: MarketplacePrice,
	): {
		buyPrice: number | null;
		sellPrice: number | null;
		confidence: "high" | "medium" | "low";
	} {
		const availablePrices: number[] = [];

		// Collect all available price signals
		if (moneyControl.available && moneyControl.price) {
			availablePrices.push(moneyControl.price);
		}
		if (internalCalc.available && internalCalc.suggestedPrice) {
			availablePrices.push(internalCalc.suggestedPrice);
		}
		if (marketplace.recentClearingPrice) {
			availablePrices.push(marketplace.recentClearingPrice);
		}
		if (marketplace.bestBid && marketplace.bestAsk) {
			// Midpoint of bid-ask spread
			availablePrices.push((marketplace.bestBid + marketplace.bestAsk) / 2);
		}

		if (availablePrices.length === 0) {
			return { buyPrice: null, sellPrice: null, confidence: "low" };
		}

		// Calculate weighted average for base price
		const avgPrice =
			availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length;

		// Calculate spread based on data quality
		let spread = 0.05; // Default 5% spread
		let confidence: "high" | "medium" | "low" = "low";

		if (availablePrices.length >= 3) {
			// High confidence with multiple data sources
			spread = 0.03; // 3% spread
			confidence = "high";
		} else if (availablePrices.length >= 2) {
			// Medium confidence
			spread = 0.05; // 5% spread
			confidence = "medium";
		} else {
			// Low confidence with single source
			spread = 0.1; // 10% spread
			confidence = "low";
		}

		// Buy price is lower (more favorable to admin/platform)
		// Sell price is higher (more favorable to admin/platform)
		const buyPrice = Math.round(avgPrice * (1 - spread));
		const sellPrice = Math.round(avgPrice * (1 + spread));

		return { buyPrice, sellPrice, confidence };
	}

	/**
	 * Batch get price suggestions for multiple companies
	 */
	async getBatchPriceSuggestions(
		companyIds: string[],
	): Promise<AggregatedPriceSuggestion[]> {
		const results = await Promise.all(
			companyIds.map(async (id) => {
				try {
					return await this.getAggregatedPriceSuggestion(id);
				} catch (error: any) {
					console.error(
						`[PriceAggregation] Failed for company ${id}:`,
						error.message,
					);
					return null;
				}
			}),
		);

		return results.filter((r): r is AggregatedPriceSuggestion => r !== null);
	}

	/**
	 * Refresh MoneyControl prices for a specific company
	 */
	async refreshMoneyControlPrice(
		companyId: string,
	): Promise<MoneyControlPrice> {
		const company = await storage.getUnlistedCompanyById(companyId);
		if (!company) {
			throw new Error("Company not found");
		}

		try {
			const searchResult = await moneyControlScraper.searchISINByCompanyName(
				company.name,
			);

			if (searchResult.price !== null && searchResult.isin) {
				// Save to price history
				await storage.upsertPriceHistory({
					companyId,
					date: new Date(),
					price: searchResult.price.toString(),
					sourceType: "MONEYCONTROL",
					notes: `Refreshed from MoneyControl. ISIN: ${searchResult.isin}`,
				});

				return {
					price: searchResult.price,
					change: null,
					changePercent: null,
					lastUpdated: new Date(),
					source: "moneycontrol",
					matchedName: searchResult.matchedName || undefined,
					matchScore: searchResult.matchScore,
					available: true,
				};
			}

			return {
				price: null,
				change: null,
				changePercent: null,
				lastUpdated: null,
				source: "moneycontrol",
				available: false,
				error: "No price data found on MoneyControl",
			};
		} catch (error: any) {
			return {
				price: null,
				change: null,
				changePercent: null,
				lastUpdated: null,
				source: "moneycontrol",
				available: false,
				error: error.message,
			};
		}
	}
}

export const priceAggregationService = new UnlistedPriceAggregationService();
