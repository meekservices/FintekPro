import { Router } from "express";

const router = Router();

interface YieldDataPoint {
	maturity: string;
	maturityYears: number;
	currentYield: number;
	historicalYield: number;
	change: number;
	benchmark: string;
}

interface YieldCurveData {
	currentDate: string;
	historicalDate: string;
	data: YieldDataPoint[];
	summary: {
		shortTermAvg: number;
		longTermAvg: number;
		spread: number;
		curveShape: "normal" | "inverted" | "flat";
	};
}

function getHistoricalDate(range: string): Date {
	const now = new Date();
	switch (range) {
		case "1W":
			return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		case "1M":
			return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
		case "3M":
			return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
		case "6M":
			return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
		case "1Y":
			return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
		default:
			return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	}
}

function generateYieldCurveData(historicalDate: Date): YieldCurveData {
	const now = new Date();
	const daysSinceHistorical = Math.floor(
		(now.getTime() - historicalDate.getTime()) / (24 * 60 * 60 * 1000),
	);

	const baseYields: {
		maturity: string;
		maturityYears: number;
		baseYield: number;
		benchmark: string;
	}[] = [
		{
			maturity: "91D",
			maturityYears: 0.25,
			baseYield: 6.45,
			benchmark: "T-Bill 91D",
		},
		{
			maturity: "182D",
			maturityYears: 0.5,
			baseYield: 6.72,
			benchmark: "T-Bill 182D",
		},
		{
			maturity: "364D",
			maturityYears: 1,
			baseYield: 6.95,
			benchmark: "T-Bill 364D",
		},
		{ maturity: "2Y", maturityYears: 2, baseYield: 7.05, benchmark: "GS 2Y" },
		{ maturity: "3Y", maturityYears: 3, baseYield: 7.12, benchmark: "GS 3Y" },
		{ maturity: "5Y", maturityYears: 5, baseYield: 7.18, benchmark: "GS 5Y" },
		{ maturity: "7Y", maturityYears: 7, baseYield: 7.22, benchmark: "GS 7Y" },
		{
			maturity: "10Y",
			maturityYears: 10,
			baseYield: 7.25,
			benchmark: "GS 10Y",
		},
		{
			maturity: "15Y",
			maturityYears: 15,
			baseYield: 7.32,
			benchmark: "GS 15Y",
		},
		{
			maturity: "20Y",
			maturityYears: 20,
			baseYield: 7.38,
			benchmark: "GS 20Y",
		},
		{
			maturity: "30Y",
			maturityYears: 30,
			baseYield: 7.42,
			benchmark: "GS 30Y",
		},
	];

	const trendFactor =
		Math.sin(now.getTime() / (1000 * 60 * 60 * 24 * 30)) * 0.15;
	const volatilityFactor = daysSinceHistorical / 100;

	const data: YieldDataPoint[] = baseYields.map((item, index) => {
		const maturityVolatility = (1 - index / baseYields.length) * 0.1;

		const currentYield =
			item.baseYield + trendFactor + (Math.random() - 0.5) * 0.1;
		const historicalYield =
			item.baseYield -
			volatilityFactor * maturityVolatility +
			(Math.random() - 0.5) * 0.05;
		const change = currentYield - historicalYield;

		return {
			maturity: item.maturity,
			maturityYears: item.maturityYears,
			currentYield: Math.round(currentYield * 100) / 100,
			historicalYield: Math.round(historicalYield * 100) / 100,
			change: Math.round(change * 100) / 100,
			benchmark: item.benchmark,
		};
	});

	const shortTermYields = data.slice(0, 3).map((d) => d.currentYield);
	const longTermYields = data.slice(-3).map((d) => d.currentYield);

	const shortTermAvg =
		shortTermYields.reduce((a, b) => a + b, 0) / shortTermYields.length;
	const longTermAvg =
		longTermYields.reduce((a, b) => a + b, 0) / longTermYields.length;
	const spread = data[data.length - 1].currentYield - data[0].currentYield;

	let curveShape: "normal" | "inverted" | "flat";
	if (spread > 0.3) {
		curveShape = "normal";
	} else if (spread < -0.1) {
		curveShape = "inverted";
	} else {
		curveShape = "flat";
	}

	return {
		currentDate: now.toISOString().split("T")[0],
		historicalDate: historicalDate.toISOString().split("T")[0],
		data,
		summary: {
			shortTermAvg: Math.round(shortTermAvg * 100) / 100,
			longTermAvg: Math.round(longTermAvg * 100) / 100,
			spread: Math.round(spread * 100) / 100,
			curveShape,
		},
	};
}

router.get("/yield-curve", (req, res) => {
	try {
		const timeRange = (req.query.timeRange as string) || "1M";
		const historicalDate = getHistoricalDate(timeRange);
		const yieldCurveData = generateYieldCurveData(historicalDate);

		res.json(yieldCurveData);
	} catch (error) {
		console.error("Error generating yield curve data:", error);
		res.status(500).json({ error: "Failed to generate yield curve data" });
	}
});

router.get("/yield-curve/historical", (req, res) => {
	try {
		const periods = ["1W", "1M", "3M", "6M", "1Y"];
		const historicalData: Record<string, YieldCurveData> = {};

		for (const period of periods) {
			const historicalDate = getHistoricalDate(period);
			historicalData[period] = generateYieldCurveData(historicalDate);
		}

		res.json({
			success: true,
			data: historicalData,
		});
	} catch (error) {
		console.error("Error generating historical yield curve data:", error);
		res.status(500).json({ error: "Failed to generate historical data" });
	}
});

export default router;
