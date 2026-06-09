import { useEffect, useRef, useState } from "react";
import {
	createChart,
	IChartApi,
	ISeriesApi,
	CandlestickData,
	LineData,
	Time,
	CandlestickSeries,
	LineSeries,
	AreaSeries,
} from "lightweight-charts";
import { useStockCandles } from "@/hooks/use-market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MarketChartProps {
	symbol?: string;
}

type ChartType = "candlestick" | "line" | "area";
type Timeframe = "1W" | "1M" | "3M" | "1Y";

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
	"1W": 7,
	"1M": 30,
	"3M": 90,
	"1Y": 365,
};

export function MarketChart({ symbol = "^NSEI" }: MarketChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<any> | null>(null);
	const [timeframe, setTimeframe] = useState<Timeframe>("1M");
	const [chartType, setChartType] = useState<ChartType>("candlestick");
	const [stats, setStats] = useState<{
		open: number;
		high: number;
		low: number;
		close: number;
		change: number;
		changePct: number;
	} | null>(null);

	const { data: candles, isLoading, error } = useStockCandles(symbol, "D");

	useEffect(() => {
		if (!containerRef.current) return;
		const isDark = document.documentElement.classList.contains("dark");

		const chart = createChart(containerRef.current, {
			width: containerRef.current.clientWidth,
			height: 300,
			layout: {
				background: { color: isDark ? "#0f172a" : "#ffffff" },
				textColor: isDark ? "#94a3b8" : "#475569",
			},
			grid: {
				vertLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
				horzLines: { color: isDark ? "#1e293b" : "#f1f5f9" },
			},
			crosshair: { mode: 1 },
			rightPriceScale: { borderColor: isDark ? "#334155" : "#e2e8f0" },
			timeScale: {
				borderColor: isDark ? "#334155" : "#e2e8f0",
				timeVisible: true,
				secondsVisible: false,
			},
			handleScroll: true,
			handleScale: true,
		});

		chartRef.current = chart;

		const ro = new ResizeObserver((entries) => {
			if (chartRef.current && entries[0]) {
				chartRef.current.applyOptions({ width: entries[0].contentRect.width });
			}
		});
		ro.observe(containerRef.current);

		return () => {
			ro.disconnect();
			chartRef.current?.remove();
			chartRef.current = null;
			seriesRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!chartRef.current || !candles || candles.s !== "ok") return;

		if (seriesRef.current) {
			try {
				chartRef.current.removeSeries(seriesRef.current);
			} catch (_) {}
			seriesRef.current = null;
		}

		const nowSec = Date.now() / 1000;
		const cutoff = nowSec - TIMEFRAME_DAYS[timeframe] * 86400;
		const startIdx = Math.max(
			0,
			candles.t.findIndex((t: number) => t >= cutoff),
		);

		const t = candles.t.slice(startIdx) as number[];
		const o = candles.o.slice(startIdx) as number[];
		const h = candles.h.slice(startIdx) as number[];
		const l = candles.l.slice(startIdx) as number[];
		const c = candles.c.slice(startIdx) as number[];

		if (t.length === 0) return;

		const UP = "#10b981";
		const DOWN = "#ef4444";

		if (chartType === "candlestick") {
			const s = chartRef.current.addSeries(CandlestickSeries, {
				upColor: UP,
				downColor: DOWN,
				borderUpColor: UP,
				borderDownColor: DOWN,
				wickUpColor: UP,
				wickDownColor: DOWN,
			});
			s.setData(
				t.map(
					(ts, i) =>
						({
							time: ts as Time,
							open: o[i],
							high: h[i],
							low: l[i],
							close: c[i],
						}) as CandlestickData,
				),
			);
			seriesRef.current = s;
		} else if (chartType === "line") {
			const s = chartRef.current.addSeries(LineSeries, {
				color: "#3b82f6",
				lineWidth: 2,
			});
			s.setData(
				t.map((ts, i) => ({ time: ts as Time, value: c[i] }) as LineData),
			);
			seriesRef.current = s;
		} else {
			const s = chartRef.current.addSeries(AreaSeries, {
				topColor: "rgba(59,130,246,0.35)",
				bottomColor: "rgba(59,130,246,0.0)",
				lineColor: "#3b82f6",
				lineWidth: 2,
			});
			s.setData(
				t.map((ts, i) => ({ time: ts as Time, value: c[i] }) as LineData),
			);
			seriesRef.current = s;
		}

		chartRef.current.timeScale().fitContent();

		const last = c[c.length - 1];
		const prev = c.length > 1 ? c[c.length - 2] : last;
		setStats({
			open: o[o.length - 1],
			high: Math.max(...h),
			low: Math.min(...l),
			close: last,
			change: last - prev,
			changePct: prev !== 0 ? ((last - prev) / prev) * 100 : 0,
		});
	}, [candles, timeframe, chartType]);

	if (isLoading) {
		return (
			<Card className="lg:col-span-2">
				<CardHeader>
					<div className="flex justify-between items-center">
						<Skeleton className="h-7 w-40" />
						<Skeleton className="h-8 w-48" />
					</div>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-72 w-full mb-4" />
					<div className="grid grid-cols-4 gap-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="text-center">
								<Skeleton className="h-3 w-10 mx-auto mb-1" />
								<Skeleton className="h-5 w-16 mx-auto" />
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error || (candles && candles.s !== "ok")) {
		return (
			<Card className="lg:col-span-2">
				<CardContent className="flex items-center justify-center h-80">
					<div className="text-center">
						<p className="text-red-500 mb-1 font-medium">Chart unavailable</p>
						<p className="text-muted-foreground text-sm">
							Try a different symbol
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	const up = (stats?.change ?? 0) >= 0;

	return (
		<Card className="lg:col-span-2" data-testid="market-chart">
			<CardHeader className="pb-2">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
					<div className="flex items-center gap-3 flex-wrap">
						<CardTitle className="text-lg font-bold" data-testid="chart-title">
							{symbol}
						</CardTitle>
						{stats && (
							<>
								<span className="text-xl font-bold tabular-nums">
									{stats.close.toLocaleString("en-IN", {
										maximumFractionDigits: 2,
									})}
								</span>
								<Badge
									className={
										up
											? "bg-emerald-500 hover:bg-emerald-600 text-white"
											: "bg-red-500 hover:bg-red-600 text-white"
									}
								>
									{up ? (
										<TrendingUp className="h-3 w-3 mr-1" />
									) : (
										<TrendingDown className="h-3 w-3 mr-1" />
									)}
									{up ? "+" : ""}
									{stats.changePct.toFixed(2)}%
								</Badge>
							</>
						)}
					</div>
					<div className="flex items-center gap-2">
						<div className="flex border rounded-md overflow-hidden text-xs">
							{(["candlestick", "line", "area"] as ChartType[]).map((t) => (
								<button
									key={t}
									onClick={() => setChartType(t)}
									className={`px-2 py-1 font-medium transition-colors ${chartType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
								>
									{t === "candlestick"
										? "OHLC"
										: t === "line"
											? "Line"
											: "Area"}
								</button>
							))}
						</div>
						<div className="flex border rounded-md overflow-hidden text-xs">
							{(["1W", "1M", "3M", "1Y"] as Timeframe[]).map((tf) => (
								<button
									key={tf}
									onClick={() => setTimeframe(tf)}
									className={`px-2 py-1 font-medium transition-colors ${timeframe === tf ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
									data-testid={`timeframe-${tf}`}
								>
									{tf}
								</button>
							))}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div
					ref={containerRef}
					className="w-full rounded-lg overflow-hidden mb-4 min-h-[300px]"
					data-testid="chart-container"
				/>
				{stats && (
					<div
						className="grid grid-cols-4 gap-3 pt-3 border-t"
						data-testid="market-stats"
					>
						{[
							{ label: "Open", value: stats.open, color: "" },
							{ label: "High", value: stats.high, color: "text-emerald-600" },
							{ label: "Low", value: stats.low, color: "text-red-600" },
							{
								label: "Change",
								value: stats.change,
								color: up ? "text-emerald-600" : "text-red-600",
								prefix: up ? "+" : "",
							},
						].map(({ label, value, color, prefix }) => (
							<div key={label} className="text-center">
								<p className="text-xs text-muted-foreground mb-1">{label}</p>
								<p
									className={`font-semibold tabular-nums text-sm ${color}`}
									data-testid={`stat-${label.toLowerCase()}`}
								>
									{prefix}
									{value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
								</p>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
