import type { PortfolioData } from "../report-orchestrator";

export interface RiskRewardData {
	period: {
		years: number;
		startDate: string;
		endDate: string;
	};
	returns: {
		annualized: number;
		cumulative: number;
		bestYear: number;
		worstYear: number;
		averageAnnual: number;
	};
	risk: {
		standardDeviation: number;
		sharpeRatio: number;
		maxDrawdown: number;
		volatility: number;
	};
	benchmarkComparison?: {
		benchmarkName: string;
		benchmarkReturn: number;
		alpha: number;
		beta: number;
		correlation: number;
	};
	yearlyReturns: {
		year: number;
		return: number;
		benchmarkReturn?: number;
	}[];
}

export function computeRiskReward(
	portfolioData: PortfolioData,
	config: { years: number; riskFreeRate?: number; benchmark?: string },
): RiskRewardData {
	const { snapshots } = portfolioData;
	const riskFreeRate = config.riskFreeRate || 6.5;

	const endDate = new Date();
	const startDate = new Date();
	startDate.setFullYear(startDate.getFullYear() - config.years);

	const filteredSnapshots = snapshots
		.filter((s) => {
			const date = new Date(s.snapshotDate!);
			return date >= startDate && date <= endDate;
		})
		.sort(
			(a, b) =>
				new Date(a.snapshotDate!).getTime() -
				new Date(b.snapshotDate!).getTime(),
		);

	if (filteredSnapshots.length < 2) {
		return getDefaultRiskReward(config.years, startDate, endDate);
	}

	const monthlyReturns: number[] = [];
	for (let i = 1; i < filteredSnapshots.length; i++) {
		const prevValue = Number(filteredSnapshots[i - 1].totalValue) || 1;
		const currValue = Number(filteredSnapshots[i].totalValue) || 1;
		const monthlyReturn = ((currValue - prevValue) / prevValue) * 100;
		monthlyReturns.push(monthlyReturn);
	}

	const cumulativeReturn =
		monthlyReturns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
	const annualizedReturn =
		((1 + cumulativeReturn) ** (12 / monthlyReturns.length) - 1) * 100;

	const avgMonthlyReturn =
		monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
	const variance =
		monthlyReturns.reduce((sum, r) => sum + (r - avgMonthlyReturn) ** 2, 0) /
		monthlyReturns.length;
	const stdDev = Math.sqrt(variance);
	const annualizedStdDev = stdDev * Math.sqrt(12);

	const sharpeRatio =
		annualizedStdDev > 0
			? (annualizedReturn - riskFreeRate) / annualizedStdDev
			: 0;

	let maxDrawdown = 0;
	let peak = Number(filteredSnapshots[0].totalValue);
	for (const snapshot of filteredSnapshots) {
		const value = Number(snapshot.totalValue);
		if (value > peak) peak = value;
		const drawdown = ((peak - value) / peak) * 100;
		if (drawdown > maxDrawdown) maxDrawdown = drawdown;
	}

	const yearlyMap = new Map<number, number[]>();
	filteredSnapshots.forEach((s, idx) => {
		if (idx === 0) return;
		const year = new Date(s.snapshotDate!).getFullYear();
		const prevValue = Number(filteredSnapshots[idx - 1].totalValue) || 1;
		const currValue = Number(s.totalValue) || 1;
		const ret = ((currValue - prevValue) / prevValue) * 100;

		if (!yearlyMap.has(year)) yearlyMap.set(year, []);
		yearlyMap.get(year)!.push(ret);
	});

	const yearlyReturns = Array.from(yearlyMap.entries())
		.map(([year, returns]) => ({
			year,
			return:
				returns.reduce((a, b) => (1 + a / 100) * (1 + b / 100) - 1, 0) * 100,
		}))
		.sort((a, b) => a.year - b.year);

	const yearReturnsOnly = yearlyReturns.map((y) => y.return);
	const bestYear =
		yearReturnsOnly.length > 0 ? Math.max(...yearReturnsOnly) : 0;
	const worstYear =
		yearReturnsOnly.length > 0 ? Math.min(...yearReturnsOnly) : 0;
	const averageAnnual =
		yearReturnsOnly.length > 0
			? yearReturnsOnly.reduce((a, b) => a + b, 0) / yearReturnsOnly.length
			: 0;

	return {
		period: {
			years: config.years,
			startDate: startDate.toISOString().split("T")[0],
			endDate: endDate.toISOString().split("T")[0],
		},
		returns: {
			annualized: annualizedReturn,
			cumulative: cumulativeReturn * 100,
			bestYear,
			worstYear,
			averageAnnual,
		},
		risk: {
			standardDeviation: annualizedStdDev,
			sharpeRatio,
			maxDrawdown,
			volatility: annualizedStdDev,
		},
		yearlyReturns,
	};
}

function getDefaultRiskReward(
	years: number,
	startDate: Date,
	endDate: Date,
): RiskRewardData {
	return {
		period: {
			years,
			startDate: startDate.toISOString().split("T")[0],
			endDate: endDate.toISOString().split("T")[0],
		},
		returns: {
			annualized: 0,
			cumulative: 0,
			bestYear: 0,
			worstYear: 0,
			averageAnnual: 0,
		},
		risk: {
			standardDeviation: 0,
			sharpeRatio: 0,
			maxDrawdown: 0,
			volatility: 0,
		},
		yearlyReturns: [],
	};
}

export default computeRiskReward;
