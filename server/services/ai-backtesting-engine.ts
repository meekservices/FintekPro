import { db } from "../db";
import {
	dailyPicks,
	aiPriceHistory,
	aiFeatureSnapshots,
	aiModelRegistry,
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, asc } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";

export interface BacktestConfig {
	assetClass?: string;
	windowMonths: number;
	startDate?: string;
	endDate?: string;
	initialCapital?: number;
	maxPositions?: number;
	rebalanceFrequency?: "daily" | "weekly" | "monthly";
	includeTransactionCosts?: boolean;
	slippagePct?: number;
}

export interface BacktestTrade {
	assetId: string;
	assetName: string;
	assetClass: string;
	entryDate: string;
	entryPrice: number;
	exitDate: string;
	exitPrice: number;
	returnPct: number;
	daysHeld: number;
	transactionCosts: number;
	netReturnPct: number;
	regime?: string;
}

export interface EquityCurvePoint {
	date: string;
	portfolioValue: number;
	benchmark: number;
	dailyReturn: number;
	cumulativeReturn: number;
	drawdown: number;
}

export interface BacktestResult {
	config: BacktestConfig;
	summary: {
		totalTrades: number;
		winningTrades: number;
		losingTrades: number;
		winRate: number;
		avgReturn: number;
		avgWinReturn: number;
		avgLossReturn: number;
		expectancy: number;
		totalReturn: number;
		cagr: number;
		sharpeRatio: number;
		sortinoRatio: number;
		maxDrawdown: number;
		maxDrawdownPct: number;
		calmarRatio: number;
		avgDaysHeld: number;
		totalTransactionCosts: number;
		profitFactor: number;
		bestTrade: BacktestTrade | null;
		worstTrade: BacktestTrade | null;
	};
	byAssetClass: Record<
		string,
		{
			totalTrades: number;
			winRate: number;
			avgReturn: number;
			sharpeRatio: number;
		}
	>;
	byRegime: Record<
		string,
		{
			totalTrades: number;
			winRate: number;
			avgReturn: number;
		}
	>;
	equityCurve: EquityCurvePoint[];
	trades: BacktestTrade[];
	monthlyReturns: { month: string; return: number }[];
}

export class AIBacktestingEngine {
	async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
		const initialCapital = config.initialCapital ?? 1000000;
		const maxPositions = config.maxPositions ?? 10;
		const includeTransactionCosts = config.includeTransactionCosts ?? true;
		const slippagePct = config.slippagePct ?? 0.001;
		const endDate = config.endDate ?? new Date().toISOString().split("T")[0];

		const conditions: any[] = [
			sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`,
		];

		if (config.startDate) {
			conditions.push(gte(dailyPicks.recoDate, config.startDate));
		}
		conditions.push(lte(dailyPicks.recoDate, endDate));

		if (config.assetClass) {
			conditions.push(eq(dailyPicks.category, config.assetClass as any));
		}

		const completedPicks = await db
			.select()
			.from(dailyPicks)
			.where(and(...conditions))
			.orderBy(asc(dailyPicks.recoDate));

		const trades: BacktestTrade[] = completedPicks.map((pick) => {
			const entryPrice = Number.parseFloat(pick.recoPrice || "0");
			let exitPrice = Number.parseFloat(pick.currentPrice || "0");

			if (pick.status === "target_hit") {
				exitPrice = Number.parseFloat(pick.targetPrice || "0") || exitPrice;
			} else if (pick.status === "stoploss_hit") {
				exitPrice = Number.parseFloat(pick.stoplossPrice || "0") || exitPrice;
			}

			if (exitPrice === 0) exitPrice = entryPrice;

			const rawReturnPct = pick.returnPct
				? Number.parseFloat(pick.returnPct)
				: entryPrice > 0
					? ((exitPrice - entryPrice) / entryPrice) * 100
					: 0;

			const recoDate = pick.recoDate;
			const statusDate = pick.statusUpdatedAt
				? new Date(pick.statusUpdatedAt).toISOString().split("T")[0]
				: pick.expiryDate;

			const daysHeld = pick.daysHeld
				? pick.daysHeld
				: Math.max(
						1,
						Math.round(
							(new Date(statusDate).getTime() - new Date(recoDate).getTime()) /
								(1000 * 60 * 60 * 24),
						),
					);

			let transactionCosts = 0;
			if (includeTransactionCosts && entryPrice > 0) {
				const tradeValue = entryPrice;
				const costs = aiAnalyticsEngine.computeTransactionCosts(tradeValue, {
					slippagePct,
				});
				transactionCosts = costs.totalCostPct * 100 * 2;
			}

			const netReturnPct = rawReturnPct - transactionCosts;

			return {
				assetId: pick.instrumentId || pick.id?.toString() || "",
				assetName: pick.instrumentName,
				assetClass: pick.category,
				entryDate: recoDate,
				entryPrice,
				exitDate: statusDate,
				exitPrice,
				returnPct: Math.round(rawReturnPct * 100) / 100,
				daysHeld,
				transactionCosts: Math.round(transactionCosts * 100) / 100,
				netReturnPct: Math.round(netReturnPct * 100) / 100,
				regime: undefined,
			};
		});

		const equityCurve = this.computeEquityCurve(trades, initialCapital);

		const winningTrades = trades.filter((t) => t.netReturnPct > 0);
		const losingTrades = trades.filter((t) => t.netReturnPct <= 0);
		const totalTrades = trades.length;

		const winRate = aiAnalyticsEngine.computeWinRate(
			trades.map((t) => ({ returnPct: t.netReturnPct })),
		);

		const avgReturn =
			totalTrades > 0
				? trades.reduce((sum, t) => sum + t.netReturnPct, 0) / totalTrades
				: 0;

		const avgWinReturn =
			winningTrades.length > 0
				? winningTrades.reduce((sum, t) => sum + t.netReturnPct, 0) /
					winningTrades.length
				: 0;

		const avgLossReturn =
			losingTrades.length > 0
				? losingTrades.reduce((sum, t) => sum + t.netReturnPct, 0) /
					losingTrades.length
				: 0;

		const expectancy = aiAnalyticsEngine.computeExpectancy(
			trades.map((t) => ({ returnPct: t.netReturnPct })),
		);

		const portfolioValues = equityCurve.map((p) => p.portfolioValue);
		const dailyReturns = equityCurve.map((p) => p.dailyReturn);

		const finalValue =
			portfolioValues.length > 0
				? portfolioValues[portfolioValues.length - 1]
				: initialCapital;
		const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;

		let years = 1;
		if (equityCurve.length >= 2) {
			const firstDate = new Date(equityCurve[0].date);
			const lastDate = new Date(equityCurve[equityCurve.length - 1].date);
			years = Math.max(
				(lastDate.getTime() - firstDate.getTime()) /
					(1000 * 60 * 60 * 24 * 365.25),
				0.01,
			);
		}

		const cagr = aiAnalyticsEngine.computeCAGR(
			initialCapital,
			finalValue,
			years,
		);
		const sharpeRatio = aiAnalyticsEngine.computeSharpeRatio(dailyReturns);
		const sortinoRatio = aiAnalyticsEngine.computeSortinoRatio(dailyReturns);

		const ddResult = aiAnalyticsEngine.computeMaxDrawdown(portfolioValues);
		const maxDrawdown = ddResult.maxDrawdown;
		const maxDrawdownPct = maxDrawdown * 100;

		const calmarRatio = aiAnalyticsEngine.computeCalmarRatio(cagr, maxDrawdown);

		const avgDaysHeld =
			totalTrades > 0
				? trades.reduce((sum, t) => sum + t.daysHeld, 0) / totalTrades
				: 0;

		const totalTransactionCosts = trades.reduce(
			(sum, t) => sum + t.transactionCosts,
			0,
		);
		const profitFactor = this.computeProfitFactor(trades);

		let bestTrade: BacktestTrade | null = null;
		let worstTrade: BacktestTrade | null = null;
		if (trades.length > 0) {
			bestTrade = trades.reduce(
				(best, t) => (t.netReturnPct > best.netReturnPct ? t : best),
				trades[0],
			);
			worstTrade = trades.reduce(
				(worst, t) => (t.netReturnPct < worst.netReturnPct ? t : worst),
				trades[0],
			);
		}

		const byAssetClass: Record<
			string,
			{
				totalTrades: number;
				winRate: number;
				avgReturn: number;
				sharpeRatio: number;
			}
		> = {};
		const assetClassGroups = new Map<string, BacktestTrade[]>();
		for (const trade of trades) {
			const cls = trade.assetClass;
			if (!assetClassGroups.has(cls)) assetClassGroups.set(cls, []);
			assetClassGroups.get(cls)!.push(trade);
		}
		for (const [cls, clsTrades] of assetClassGroups) {
			const clsWins = clsTrades.filter((t) => t.netReturnPct > 0).length;
			const clsAvg =
				clsTrades.reduce((s, t) => s + t.netReturnPct, 0) / clsTrades.length;
			const clsReturns = clsTrades.map((t) => t.netReturnPct / 100);
			byAssetClass[cls] = {
				totalTrades: clsTrades.length,
				winRate: clsTrades.length > 0 ? clsWins / clsTrades.length : 0,
				avgReturn: Math.round(clsAvg * 100) / 100,
				sharpeRatio: aiAnalyticsEngine.computeSharpeRatio(clsReturns),
			};
		}

		const byRegime: Record<
			string,
			{ totalTrades: number; winRate: number; avgReturn: number }
		> = {};
		const regimeGroups = new Map<string, BacktestTrade[]>();
		for (const trade of trades) {
			const regime = trade.regime || "unknown";
			if (!regimeGroups.has(regime)) regimeGroups.set(regime, []);
			regimeGroups.get(regime)!.push(trade);
		}
		for (const [regime, regimeTrades] of regimeGroups) {
			const regimeWins = regimeTrades.filter((t) => t.netReturnPct > 0).length;
			const regimeAvg =
				regimeTrades.reduce((s, t) => s + t.netReturnPct, 0) /
				regimeTrades.length;
			byRegime[regime] = {
				totalTrades: regimeTrades.length,
				winRate: regimeTrades.length > 0 ? regimeWins / regimeTrades.length : 0,
				avgReturn: Math.round(regimeAvg * 100) / 100,
			};
		}

		const monthlyReturns = this.computeMonthlyReturns(equityCurve);

		return {
			config,
			summary: {
				totalTrades,
				winningTrades: winningTrades.length,
				losingTrades: losingTrades.length,
				winRate: Math.round(winRate * 10000) / 100,
				avgReturn: Math.round(avgReturn * 100) / 100,
				avgWinReturn: Math.round(avgWinReturn * 100) / 100,
				avgLossReturn: Math.round(avgLossReturn * 100) / 100,
				expectancy: Math.round(expectancy * 100) / 100,
				totalReturn: Math.round(totalReturn * 100) / 100,
				cagr: Math.round(cagr * 10000) / 100,
				sharpeRatio: Math.round(sharpeRatio * 100) / 100,
				sortinoRatio: Math.round(sortinoRatio * 100) / 100,
				maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
				maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
				calmarRatio: Math.round(calmarRatio * 100) / 100,
				avgDaysHeld: Math.round(avgDaysHeld),
				totalTransactionCosts: Math.round(totalTransactionCosts * 100) / 100,
				profitFactor: Math.round(profitFactor * 100) / 100,
				bestTrade,
				worstTrade,
			},
			byAssetClass,
			byRegime,
			equityCurve,
			trades,
			monthlyReturns,
		};
	}

	async runWalkForwardBacktest(
		config: BacktestConfig,
	): Promise<BacktestResult[]> {
		const endDate = config.endDate ? new Date(config.endDate) : new Date();
		let startDate: Date;

		if (config.startDate) {
			startDate = new Date(config.startDate);
		} else {
			const earliest = await db
				.select({ minDate: sql<string>`MIN(${dailyPicks.recoDate})` })
				.from(dailyPicks);
			const minDateStr = earliest[0]?.minDate;
			startDate = minDateStr
				? new Date(minDateStr)
				: new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
		}

		const windowMs = config.windowMonths * 30 * 24 * 60 * 60 * 1000;
		const stepMs = 30 * 24 * 60 * 60 * 1000;
		const results: BacktestResult[] = [];

		let windowStart = new Date(startDate);

		while (windowStart.getTime() + windowMs <= endDate.getTime()) {
			const windowEnd = new Date(windowStart.getTime() + windowMs);

			const windowConfig: BacktestConfig = {
				...config,
				startDate: windowStart.toISOString().split("T")[0],
				endDate: windowEnd.toISOString().split("T")[0],
			};

			const result = await this.runBacktest(windowConfig);
			results.push(result);

			windowStart = new Date(windowStart.getTime() + stepMs);
		}

		return results;
	}

	async snapshotFeatures(
		assetId: string,
		assetClass: string,
		features: Record<string, any>,
		regimeLabel?: string,
		score?: number,
	): Promise<void> {
		const today = new Date().toISOString().split("T")[0];

		// Guard: skip insert if a snapshot for this asset/date already exists
		const existing = await db
			.select({ id: aiFeatureSnapshots.id })
			.from(aiFeatureSnapshots)
			.where(
				and(
					eq(aiFeatureSnapshots.assetId, assetId),
					eq(aiFeatureSnapshots.snapshotDate, today),
				),
			)
			.limit(1);

		if (existing.length > 0) return;

		await db.insert(aiFeatureSnapshots).values({
			assetId,
			assetClass,
			snapshotDate: today,
			featureJson: features,
			regimeLabel: regimeLabel || null,
			compositeScore: score?.toString() || null,
		});
	}

	async getBacktestHistory(
		assetClass?: string,
		limit: number = 20,
	): Promise<any[]> {
		const conditions: any[] = [eq(aiModelRegistry.modelType, "backtest")];

		if (assetClass) {
			conditions.push(eq(aiModelRegistry.assetClass, assetClass));
		}

		const results = await db
			.select()
			.from(aiModelRegistry)
			.where(and(...conditions))
			.orderBy(desc(aiModelRegistry.createdAt))
			.limit(limit);

		return results;
	}

	private computeEquityCurve(
		trades: BacktestTrade[],
		initialCapital: number,
	): EquityCurvePoint[] {
		if (trades.length === 0) {
			return [
				{
					date: new Date().toISOString().split("T")[0],
					portfolioValue: initialCapital,
					benchmark: initialCapital,
					dailyReturn: 0,
					cumulativeReturn: 0,
					drawdown: 0,
				},
			];
		}

		const sortedTrades = [...trades].sort(
			(a, b) =>
				new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime(),
		);

		const allDates = new Set<string>();
		for (const trade of sortedTrades) {
			allDates.add(trade.entryDate);
			allDates.add(trade.exitDate);
		}
		const dateList = Array.from(allDates).sort();

		if (dateList.length === 0) {
			return [
				{
					date: new Date().toISOString().split("T")[0],
					portfolioValue: initialCapital,
					benchmark: initialCapital,
					dailyReturn: 0,
					cumulativeReturn: 0,
					drawdown: 0,
				},
			];
		}

		const curve: EquityCurvePoint[] = [];
		let portfolioValue = initialCapital;
		let peakValue = initialCapital;
		let prevValue = initialCapital;

		for (const date of dateList) {
			const closingTrades = sortedTrades.filter((t) => t.exitDate === date);

			for (const trade of closingTrades) {
				const positionSize = portfolioValue / Math.max(sortedTrades.length, 1);
				const tradeReturn = trade.netReturnPct / 100;
				const pnl = positionSize * tradeReturn;
				portfolioValue += pnl;
			}

			if (portfolioValue > peakValue) peakValue = portfolioValue;
			const drawdown =
				peakValue > 0 ? (peakValue - portfolioValue) / peakValue : 0;
			const dailyReturn =
				prevValue > 0 ? (portfolioValue - prevValue) / prevValue : 0;
			const cumulativeReturn =
				initialCapital > 0
					? (portfolioValue - initialCapital) / initialCapital
					: 0;

			curve.push({
				date,
				portfolioValue: Math.round(portfolioValue * 100) / 100,
				benchmark: initialCapital * (1 + cumulativeReturn * 0.7),
				dailyReturn: Math.round(dailyReturn * 10000) / 10000,
				cumulativeReturn: Math.round(cumulativeReturn * 10000) / 10000,
				drawdown: Math.round(drawdown * 10000) / 10000,
			});

			prevValue = portfolioValue;
		}

		return curve;
	}

	private computeMonthlyReturns(
		equityCurve: EquityCurvePoint[],
	): { month: string; return: number }[] {
		if (equityCurve.length === 0) return [];

		const monthlyMap = new Map<string, { first: number; last: number }>();

		for (const point of equityCurve) {
			const month = point.date.substring(0, 7);
			if (!monthlyMap.has(month)) {
				monthlyMap.set(month, {
					first: point.portfolioValue,
					last: point.portfolioValue,
				});
			} else {
				monthlyMap.get(month)!.last = point.portfolioValue;
			}
		}

		const months = Array.from(monthlyMap.keys()).sort();
		const results: { month: string; return: number }[] = [];

		for (let i = 0; i < months.length; i++) {
			const month = months[i];
			const data = monthlyMap.get(month)!;
			const prevValue =
				i > 0 ? monthlyMap.get(months[i - 1])!.last : data.first;
			const monthReturn =
				prevValue > 0 ? ((data.last - prevValue) / prevValue) * 100 : 0;
			results.push({
				month,
				return: Math.round(monthReturn * 100) / 100,
			});
		}

		return results;
	}

	private computeProfitFactor(trades: BacktestTrade[]): number {
		const grossProfit = trades
			.filter((t) => t.netReturnPct > 0)
			.reduce((sum, t) => sum + t.netReturnPct, 0);

		const grossLoss = Math.abs(
			trades
				.filter((t) => t.netReturnPct <= 0)
				.reduce((sum, t) => sum + t.netReturnPct, 0),
		);

		if (grossLoss === 0) return grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
		return grossProfit / grossLoss;
	}
}

export const aiBacktestingEngine = new AIBacktestingEngine();
