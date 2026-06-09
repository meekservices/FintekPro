import { db } from "../db";
import {
	usHoldings,
	riskProfiles,
	rebalancingSuggestions,
	users,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { alpacaMarketDataService as polygonMarketService } from "./alpaca-market-data-service";
import { usOrderNotificationService } from "./us-order-notification-service";

interface AllocationTarget {
	conservative: { equity: number; debt: number; gold: number; cash: number };
	moderate: { equity: number; debt: number; gold: number; cash: number };
	aggressive: { equity: number; debt: number; gold: number; cash: number };
	very_aggressive: { equity: number; debt: number; gold: number; cash: number };
}

interface SuggestedTrade {
	symbol: string;
	name: string;
	side: "buy" | "sell";
	quantity: number;
	estimatedValue: number;
	reason: string;
	priority: "high" | "medium" | "low";
}

interface RebalancingAnalysis {
	currentAllocation: {
		usEquity: number;
		domesticEquity: number;
		debt: number;
		gold: number;
		cash: number;
		other: number;
	};
	targetAllocation: {
		usEquity: number;
		domesticEquity: number;
		debt: number;
		gold: number;
		cash: number;
	};
	deviations: {
		usEquity: number;
		domesticEquity: number;
		debt: number;
		gold: number;
		cash: number;
	};
	suggestedTrades: SuggestedTrade[];
	riskScore: number;
	rationale: string;
	expectedImpact: string;
}

const TARGET_ALLOCATIONS: AllocationTarget = {
	conservative: { equity: 30, debt: 50, gold: 10, cash: 10 },
	moderate: { equity: 50, debt: 30, gold: 10, cash: 10 },
	aggressive: { equity: 70, debt: 20, gold: 5, cash: 5 },
	very_aggressive: { equity: 85, debt: 10, gold: 3, cash: 2 },
};

const US_EQUITY_TARGET_WITHIN_EQUITY = 0.2;

class UsRebalancingEngine {
	async analyzePortfolio(userId: string): Promise<RebalancingAnalysis | null> {
		const [riskProfile] = await db
			.select()
			.from(riskProfiles)
			.where(eq(riskProfiles.userId, userId));
		const usHoldingsData = await db
			.select()
			.from(usHoldings)
			.where(eq(usHoldings.clientId, userId));

		if (!riskProfile) {
			return null;
		}

		const riskTolerance =
			(riskProfile.riskTolerance as keyof AllocationTarget) || "moderate";
		const targets =
			TARGET_ALLOCATIONS[riskTolerance] || TARGET_ALLOCATIONS.moderate;

		let usEquityValue = 0;
		const holdingsBySymbol = new Map<
			string,
			{ quantity: number; value: number; avgPrice: number }
		>();

		for (const holding of usHoldingsData) {
			const value = Number.parseFloat(holding.marketValueInr || "0");
			usEquityValue += value;
			holdingsBySymbol.set(holding.symbol, {
				quantity: Number.parseFloat(holding.quantity || "0"),
				value,
				avgPrice: Number.parseFloat(holding.avgPriceUsd || "0"),
			});
		}

		const estimatedTotalPortfolio =
			usEquityValue /
				(US_EQUITY_TARGET_WITHIN_EQUITY * (targets.equity / 100)) ||
			usEquityValue * 5;

		const currentAllocation = {
			usEquity:
				estimatedTotalPortfolio > 0
					? (usEquityValue / estimatedTotalPortfolio) * 100
					: 0,
			domesticEquity:
				estimatedTotalPortfolio > 0
					? targets.equity - (usEquityValue / estimatedTotalPortfolio) * 100
					: targets.equity * 0.8,
			debt: targets.debt,
			gold: targets.gold,
			cash: targets.cash,
			other: 0,
		};

		const targetUsEquity = targets.equity * US_EQUITY_TARGET_WITHIN_EQUITY;
		const targetDomesticEquity =
			targets.equity * (1 - US_EQUITY_TARGET_WITHIN_EQUITY);

		const targetAllocation = {
			usEquity: targetUsEquity,
			domesticEquity: targetDomesticEquity,
			debt: targets.debt,
			gold: targets.gold,
			cash: targets.cash,
		};

		const deviations = {
			usEquity: currentAllocation.usEquity - targetUsEquity,
			domesticEquity: currentAllocation.domesticEquity - targetDomesticEquity,
			debt: currentAllocation.debt - targets.debt,
			gold: currentAllocation.gold - targets.gold,
			cash: currentAllocation.cash - targets.cash,
		};

		const suggestedTrades = await this.generateTradesuggestions(
			deviations,
			holdingsBySymbol,
			estimatedTotalPortfolio,
			riskTolerance,
		);

		const maxDeviation = Math.max(
			Math.abs(deviations.usEquity),
			Math.abs(deviations.domesticEquity),
			Math.abs(deviations.debt),
		);
		const riskScore = Math.min(100, Math.round(maxDeviation * 5));

		const rationale = this.generateRationale(
			deviations,
			riskTolerance,
			suggestedTrades.length,
		);
		const expectedImpact = this.generateExpectedImpact(
			deviations,
			suggestedTrades,
		);

		return {
			currentAllocation,
			targetAllocation,
			deviations,
			suggestedTrades,
			riskScore,
			rationale,
			expectedImpact,
		};
	}

	private async generateTradesuggestions(
		deviations: Record<string, number>,
		holdings: Map<
			string,
			{ quantity: number; value: number; avgPrice: number }
		>,
		totalPortfolio: number,
		riskTolerance: string,
	): Promise<SuggestedTrade[]> {
		const trades: SuggestedTrade[] = [];

		const coreStocks = [
			{ symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
			{ symbol: "MSFT", name: "Microsoft Corp.", sector: "Technology" },
			{ symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
			{ symbol: "JPM", name: "JPMorgan Chase", sector: "Financial" },
			{ symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
			{ symbol: "V", name: "Visa Inc.", sector: "Financial" },
		];

		const growthStocks = [
			{ symbol: "NVDA", name: "NVIDIA Corp.", sector: "Technology" },
			{ symbol: "AMZN", name: "Amazon.com", sector: "Consumer" },
			{ symbol: "META", name: "Meta Platforms", sector: "Technology" },
			{ symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
		];

		try {
			const fxRate = await polygonMarketService.getUsdInrRate();

			if (deviations.usEquity < -3) {
				const targetIncrease =
					(Math.abs(deviations.usEquity) / 100) * totalPortfolio;
				const stocksToConsider =
					riskTolerance === "conservative"
						? coreStocks
						: [...coreStocks, ...growthStocks];

				const symbols = stocksToConsider.slice(0, 4).map((s) => s.symbol);
				const quotes = await polygonMarketService.getMultipleQuotes(symbols);

				for (const stock of stocksToConsider.slice(0, 3)) {
					const quote = quotes.get(stock.symbol);
					const currentHolding = holdings.get(stock.symbol);

					if (quote && quote.price > 0) {
						const allocationPerStock = targetIncrease / 3;
						const priceInr = quote.price * fxRate;
						const quantity = Math.floor(allocationPerStock / priceInr);

						if (
							quantity > 0 &&
							(!currentHolding || currentHolding.quantity < 10)
						) {
							trades.push({
								symbol: stock.symbol,
								name: stock.name,
								side: "buy",
								quantity,
								estimatedValue: quantity * priceInr,
								reason: `Increase US equity exposure. ${stock.sector} sector provides diversification.`,
								priority: Math.abs(deviations.usEquity) > 5 ? "high" : "medium",
							});
						}
					}
				}
			}

			if (deviations.usEquity > 5) {
				const targetDecrease = (deviations.usEquity / 100) * totalPortfolio;
				let remainingToSell = targetDecrease;

				const sortedHoldings = Array.from(holdings.entries()).sort(
					(a, b) => b[1].value - a[1].value,
				);

				for (const [symbol, holding] of sortedHoldings) {
					if (remainingToSell <= 0) break;

					const sellValue = Math.min(holding.value * 0.3, remainingToSell);
					const quote = (
						await polygonMarketService.getMultipleQuotes([symbol])
					).get(symbol);

					if (quote && quote.price > 0) {
						const priceInr = quote.price * fxRate;
						const quantity = Math.floor(sellValue / priceInr);

						if (quantity > 0) {
							trades.push({
								symbol,
								name: this.getStockName(symbol),
								side: "sell",
								quantity,
								estimatedValue: quantity * priceInr,
								reason:
									"Reduce overweight position to achieve target allocation.",
								priority: deviations.usEquity > 10 ? "high" : "medium",
							});
							remainingToSell -= quantity * priceInr;
						}
					}
				}
			}

			const uniqueHoldings = new Set(holdings.keys());
			if (uniqueHoldings.size < 4 && holdings.size > 0) {
				const missingStocks = coreStocks.filter(
					(s) => !uniqueHoldings.has(s.symbol),
				);

				for (const stock of missingStocks.slice(0, 2)) {
					const quote = (
						await polygonMarketService.getMultipleQuotes([stock.symbol])
					).get(stock.symbol);
					if (quote && quote.price > 0) {
						const priceInr = quote.price * fxRate;
						const quantity = Math.ceil(50000 / priceInr);

						if (quantity > 0) {
							trades.push({
								symbol: stock.symbol,
								name: stock.name,
								side: "buy",
								quantity,
								estimatedValue: quantity * priceInr,
								reason: `Improve portfolio diversification with ${stock.sector} exposure.`,
								priority: "low",
							});
						}
					}
				}
			}
		} catch (error) {
			console.error("Error generating trade suggestions:", error);
		}

		return trades;
	}

	private getStockName(symbol: string): string {
		const names: Record<string, string> = {
			AAPL: "Apple Inc.",
			MSFT: "Microsoft Corporation",
			GOOGL: "Alphabet Inc.",
			AMZN: "Amazon.com Inc.",
			NVDA: "NVIDIA Corporation",
			META: "Meta Platforms Inc.",
			TSLA: "Tesla Inc.",
			JPM: "JPMorgan Chase & Co.",
			V: "Visa Inc.",
			JNJ: "Johnson & Johnson",
		};
		return names[symbol] || symbol;
	}

	private generateRationale(
		deviations: Record<string, number>,
		riskTolerance: string,
		tradeCount: number,
	): string {
		const issues: string[] = [];

		if (Math.abs(deviations.usEquity) > 5) {
			issues.push(
				deviations.usEquity > 0
					? "US equity allocation is above target"
					: "US equity allocation is below target",
			);
		}

		if (issues.length === 0 && tradeCount === 0) {
			return `Your portfolio is well-balanced for a ${riskTolerance} risk profile. No immediate rebalancing needed.`;
		}

		if (issues.length === 0 && tradeCount > 0) {
			return `Minor optimization opportunities identified to better align with your ${riskTolerance} risk profile.`;
		}

		return `Based on your ${riskTolerance} risk profile: ${issues.join(". ")}. Consider the suggested trades to optimize your allocation.`;
	}

	private generateExpectedImpact(
		deviations: Record<string, number>,
		trades: SuggestedTrade[],
	): string {
		if (trades.length === 0) {
			return "Portfolio is currently optimized. No changes needed.";
		}

		const buyTrades = trades.filter((t) => t.side === "buy");
		const sellTrades = trades.filter((t) => t.side === "sell");

		const impacts: string[] = [];

		if (buyTrades.length > 0) {
			const totalBuy = buyTrades.reduce((sum, t) => sum + t.estimatedValue, 0);
			impacts.push(`Increase US equity by ₹${(totalBuy / 100000).toFixed(2)}L`);
		}

		if (sellTrades.length > 0) {
			const totalSell = sellTrades.reduce(
				(sum, t) => sum + t.estimatedValue,
				0,
			);
			impacts.push(
				`Free up ₹${(totalSell / 100000).toFixed(2)}L for reallocation`,
			);
		}

		if (Math.abs(deviations.usEquity) > 5) {
			impacts.push("Move closer to target asset allocation");
		}

		return impacts.join(". ") + ".";
	}

	async saveSuggestion(
		userId: string,
		analysis: RebalancingAnalysis,
	): Promise<string | null> {
		try {
			const [existing] = await db
				.select()
				.from(rebalancingSuggestions)
				.where(eq(rebalancingSuggestions.portfolioId, userId))
				.limit(1);

			const suggestionData = {
				portfolioId: userId,
				suggestionType: "rebalancing",
				priority:
					analysis.riskScore > 50
						? "high"
						: analysis.riskScore > 25
							? "medium"
							: "low",
				title: "Portfolio Rebalancing Recommendation",
				description: analysis.rationale,
				actions: analysis.suggestedTrades,
				expectedImpact: {
					summary: analysis.expectedImpact,
					riskScore: analysis.riskScore,
				},
				confidenceScore: String(
					Math.min(95, 60 + analysis.suggestedTrades.length * 5),
				),
				implementationSteps: analysis.suggestedTrades.map(
					(t) => `${t.side.toUpperCase()} ${t.quantity} shares of ${t.symbol}`,
				),
			};

			if (existing) {
				await db
					.update(rebalancingSuggestions)
					.set(suggestionData)
					.where(eq(rebalancingSuggestions.id, existing.id));
				return existing.id;
			}
			const [inserted] = await db
				.insert(rebalancingSuggestions)
				.values(suggestionData)
				.returning({ id: rebalancingSuggestions.id });

			if (analysis.suggestedTrades.length > 0) {
				await usOrderNotificationService.notifyRebalancingSuggestion({
					userId,
					suggestionId: inserted.id,
					summary: analysis.rationale,
					potentialImpact: analysis.expectedImpact,
				});
			}

			return inserted.id;
		} catch (error) {
			console.error("Error saving rebalancing suggestion:", error);
			return null;
		}
	}

	async getSuggestion(userId: string): Promise<any | null> {
		try {
			const [suggestion] = await db
				.select()
				.from(rebalancingSuggestions)
				.where(eq(rebalancingSuggestions.portfolioId, userId))
				.limit(1);
			return suggestion || null;
		} catch {
			return null;
		}
	}
}

export const usRebalancingEngine = new UsRebalancingEngine();
