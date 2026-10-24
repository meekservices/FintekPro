import type { PortfolioData } from "../report-orchestrator";

export interface PortfolioXrayData {
	totalValue: number;
	totalHoldings: number;
	assetAllocation: {
		assetType: string;
		value: number;
		percentage: number;
		holdings: number;
	}[];
	sectorBreakdown: {
		sector: string;
		value: number;
		percentage: number;
	}[];
	topHoldings: {
		symbol: string;
		name?: string;
		value: number;
		percentage: number;
		assetType: string;
	}[];
	riskMetrics: {
		overallRisk: "low" | "moderate" | "high";
		diversificationScore: number;
		concentrationRisk: number;
	};
}

export function computePortfolioXray(
	portfolioData: PortfolioData,
): PortfolioXrayData {
	const { holdings } = portfolioData;

	const holdingsWithValue = holdings.map((h) => ({
		...h,
		currentValue: Number(h.quantity) * Number(h.avgPrice),
	}));

	const totalValue = holdingsWithValue.reduce(
		(sum, h) => sum + h.currentValue,
		0,
	);

	const assetTypeMap = new Map<string, { value: number; count: number }>();
	const sectorMap = new Map<string, number>();

	holdingsWithValue.forEach((h) => {
		const assetType = h.assetType || "other";
		const existing = assetTypeMap.get(assetType) || { value: 0, count: 0 };
		assetTypeMap.set(assetType, {
			value: existing.value + h.currentValue,
			count: existing.count + 1,
		});

		if (h.sector) {
			const sectorValue = sectorMap.get(h.sector) || 0;
			sectorMap.set(h.sector, sectorValue + h.currentValue);
		}
	});

	const assetAllocation = Array.from(assetTypeMap.entries())
		.map(([assetType, data]) => ({
			assetType,
			value: data.value,
			percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
			holdings: data.count,
		}))
		.sort((a, b) => b.value - a.value);

	const sectorBreakdown = Array.from(sectorMap.entries())
		.map(([sector, value]) => ({
			sector,
			value,
			percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
		}))
		.sort((a, b) => b.value - a.value);

	const topHoldings = holdingsWithValue
		.map((h) => ({
			symbol: h.symbol,
			value: h.currentValue,
			percentage: totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0,
			assetType: h.assetType,
		}))
		.sort((a, b) => b.value - a.value)
		.slice(0, 10);

	const maxConcentration =
		topHoldings.length > 0 ? topHoldings[0].percentage : 0;
	
	// Institutional HHI-based diversification score
	const hhi = Math.round(
		topHoldings.reduce((sum, h) => sum + Math.pow(h.percentage, 2), 0)
	);
	const diversificationScore = Math.max(
		10,
		Math.min(
			100,
			Math.round(100 - Math.max(0, hhi - 400) / 30 - Math.max(0, maxConcentration - 20) * 0.8)
		)
	);
	const concentrationRisk = Math.round(maxConcentration * 10) / 10;

	let overallRisk: "low" | "moderate" | "high" = "moderate";
	if (hhi <= 1000 && maxConcentration < 15) {
		overallRisk = "low";
	} else if (hhi > 1800 || maxConcentration > 30) {
		overallRisk = "high";
	}

	return {
		totalValue,
		totalHoldings: holdings.length,
		assetAllocation,
		sectorBreakdown,
		topHoldings,
		riskMetrics: {
			overallRisk,
			diversificationScore,
			concentrationRisk,
		},
	};
}

export default computePortfolioXray;
