import { useEffect, useRef, useState } from "react";
import {
	createChart,
	IChartApi,
	ISeriesApi,
	CandlestickData,
	LineData,
	HistogramData,
	Time,
	CandlestickSeries,
	LineSeries,
	AreaSeries,
	HistogramSeries,
} from "lightweight-charts";
import { useStockCandles } from "@/hooks/use-market-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, BarChart2, Volume2, VolumeX } from "lucide-react";

export interface MarketChartProps {
	symbol?: string;
	title?: string;
	height?: number;
	showControls?: boolean;
	showVolumeDefault?: boolean;
}

export type ChartType = "candlestick" | "line" | "area";
export type Timeframe = "1W" | "1M" | "3M" | "1Y";

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
	"1W": 7,
	"1M": 30,
	"3M": 90,
	"1Y": 365,
};

function formatIndianNumber(val: number, maxDecimals: number = 2): string {
	if (val === undefined || val === null || isNaN(val)) return "-";
	return val.toLocaleString("en-IN", { maximumFractionDigits: maxDecimals });
}

function formatVolumeIndian(val: number): string {
	if (val === undefined || val === null || isNaN(val)) return "-";
	if (val >= 10000000) return `${(val / 10000000).toFixed(2)} Cr`;
	if (val >= 100000) return `${(val / 100000).toFixed(2)} L`;
	if (val >= 1000) return `${(val / 1000).toFixed(1)} K`;
	return val.toLocaleString("en-IN");
}

export function MarketChart({
	symbol = "^NSEI",
	title,
	height = 340,
	showControls = true,
	showVolumeDefault = true,
}: MarketChartProps) {
	const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
	const chartRef = useRef<IChartApi | null>(null);
	const seriesRef = useRef<ISeriesApi<any> | null>(null);
	const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);

	const [timeframe, setTimeframe] = useState<Timeframe>("1M");
	const [chartType, setChartType] = useState<ChartType>("candlestick");
	const [showVolume, setShowVolume] = useState<boolean>(showVolumeDefault);

	const [hoveredData, setHoveredData] = useState<{
		date?: string;
		open?: number;
		high?: number;
		low?: number;
		close?: number;
		volume?: number;
		isUp?: boolean;
	} | null>(null);

	const [stats, setStats] = useState<{
		open: number;
		high: number;
		low: number;
		close: number;
		change: number;
		changePct: number;
		lastVolume: number;
		avgVolume: number;
		totalVolume: number;
	} | null>(null);

	const { data: candles, isLoading, error } = useStockCandles(symbol, "D", 365);

	// Setup chart when container element is attached
	useEffect(() => {
		if (!containerEl) return;
		const isDark = document.documentElement.classList.contains("dark");

		const initWidth = containerEl.clientWidth || containerEl.parentElement?.clientWidth || 600;
		const chart = createChart(containerEl, {
			width: Math.max(initWidth, 100),
			height: height,
			layout: {
				background: { color: isDark ? "#0f172a" : "#ffffff" },
				textColor: isDark ? "#94a3b8" : "#475569",
			},
			grid: {
				vertLines: { color: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.8)" },
				horzLines: { color: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.8)" },
			},
			crosshair: {
				mode: 1,
				vertLine: {
					color: isDark ? "#64748b" : "#94a3b8",
					width: 1,
					style: 3,
				},
				horzLine: {
					color: isDark ? "#64748b" : "#94a3b8",
					width: 1,
					style: 3,
				},
			},
			rightPriceScale: {
				borderColor: isDark ? "#334155" : "#e2e8f0",
				scaleMargins: {
					top: 0.08,
					bottom: showVolume ? 0.28 : 0.05,
				},
			},
			timeScale: {
				borderColor: isDark ? "#334155" : "#e2e8f0",
				timeVisible: true,
				secondsVisible: false,
			},
			handleScroll: true,
			handleScale: true,
		});

		chartRef.current = chart;

		// Subscribe crosshair hovering for live OHLCV inspection
		chart.subscribeCrosshairMove((param) => {
			if (!param || !param.time || !param.seriesData) {
				setHoveredData(null);
				return;
			}

			const priceData = seriesRef.current ? (param.seriesData.get(seriesRef.current) as any) : null;
			const volData = volumeSeriesRef.current ? (param.seriesData.get(volumeSeriesRef.current) as any) : null;

			let dateStr = "";
			if (typeof param.time === "string") {
				dateStr = param.time;
			} else if (typeof param.time === "number") {
				dateStr = new Date(param.time * 1000).toLocaleDateString("en-IN", {
					day: "2-digit",
					month: "short",
					year: "numeric",
				});
			} else if (param.time && typeof param.time === "object") {
				const bd = param.time as any;
				dateStr = `${bd.day}/${bd.month}/${bd.year}`;
			}

			if (priceData) {
				if (priceData.open !== undefined) {
					setHoveredData({
						date: dateStr,
						open: priceData.open,
						high: priceData.high,
						low: priceData.low,
						close: priceData.close,
						volume: volData?.value,
						isUp: (priceData.close ?? 0) >= (priceData.open ?? 0),
					});
				} else if (priceData.value !== undefined) {
					setHoveredData({
						date: dateStr,
						close: priceData.value,
						volume: volData?.value,
					});
				}
			}
		});

		const ro = new ResizeObserver((entries) => {
			if (chartRef.current && entries[0] && entries[0].contentRect.width > 0) {
				chartRef.current.applyOptions({ width: entries[0].contentRect.width });
				try {
					chartRef.current.timeScale().fitContent();
				} catch (_) {}
			}
		});
		ro.observe(containerEl);

		const themeObserver = new MutationObserver(() => {
			if (!chartRef.current) return;
			const isDarkNow = document.documentElement.classList.contains("dark");
			chartRef.current.applyOptions({
				layout: {
					background: { color: isDarkNow ? "#0f172a" : "#ffffff" },
					textColor: isDarkNow ? "#94a3b8" : "#475569",
				},
				grid: {
					vertLines: { color: isDarkNow ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.8)" },
					horzLines: { color: isDarkNow ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.8)" },
				},
			});
		});
		themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

		return () => {
			themeObserver.disconnect();
			ro.disconnect();
			chartRef.current?.remove();
			chartRef.current = null;
			seriesRef.current = null;
			volumeSeriesRef.current = null;
		};
	}, [containerEl, height]);

	// Update Series when data, timeframe, chartType, or showVolume changes
	useEffect(() => {
		if (!chartRef.current || !candles || candles.s !== "ok") return;

		// Extract, sanitize, sort ascending, and deduplicate candle data
		const rawT = candles.t || [];
		const rawO = candles.o || [];
		const rawH = candles.h || [];
		const rawL = candles.l || [];
		const rawC = candles.c || [];
		const rawV = candles.v || [];

		const points: { ts: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
		for (let i = 0; i < rawT.length; i++) {
			let ts = Number(rawT[i]);
			if (ts > 1e11) ts = Math.floor(ts / 1000); // Normalize milliseconds to seconds
			const open = Number(rawO[i]);
			const high = Number(rawH[i]);
			const low = Number(rawL[i]);
			const close = Number(rawC[i]);
			const volume = Number(rawV[i] ?? 0);
			if (
				!isNaN(ts) && ts > 0 &&
				!isNaN(open) && open > 0 &&
				!isNaN(high) && high > 0 &&
				!isNaN(low) && low > 0 &&
				!isNaN(close) && close > 0
			) {
				points.push({ ts, open, high, low, close, volume: isNaN(volume) ? 0 : volume });
			}
		}

		// Sort STRICTLY ASCENDING (required by lightweight-charts)
		points.sort((a, b) => a.ts - b.ts);

		// Deduplicate timestamps (required by lightweight-charts)
		const cleanPoints = points.filter((p, idx, arr) => idx === 0 || p.ts > arr[idx - 1].ts);

		if (cleanPoints.length === 0) return;

		// Filter by timeframe
		const nowSec = Date.now() / 1000;
		const cutoff = nowSec - TIMEFRAME_DAYS[timeframe] * 86400;
		const filtered = cleanPoints.filter((p) => p.ts >= cutoff);
		const displayPoints = filtered.length >= 3 ? filtered : cleanPoints;

		const t = displayPoints.map((p) => p.ts);
		const o = displayPoints.map((p) => p.open);
		const h = displayPoints.map((p) => p.high);
		const l = displayPoints.map((p) => p.low);
		const c = displayPoints.map((p) => p.close);
		const v = displayPoints.map((p) => p.volume);

		if (t.length === 0) return;

		try {
			// Remove previous series
			if (seriesRef.current) {
				try {
					chartRef.current.removeSeries(seriesRef.current);
				} catch (_) {}
				seriesRef.current = null;
			}
			if (volumeSeriesRef.current) {
				try {
					chartRef.current.removeSeries(volumeSeriesRef.current);
				} catch (_) {}
				volumeSeriesRef.current = null;
			}

			// Adjust price scale bottom margin depending on volume visibility
			chartRef.current.priceScale("right").applyOptions({
				scaleMargins: {
					top: 0.08,
					bottom: showVolume ? 0.28 : 0.05,
				},
			});

			const UP = "#10b981";
			const DOWN = "#ef4444";
			const UP_VOL = "rgba(16, 185, 129, 0.65)";
			const DOWN_VOL = "rgba(239, 68, 68, 0.65)";

			// 1. Add Price Series
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

			// 2. Add Volume Series (Histogram Series pinned to bottom 28% of chart)
			if (showVolume) {
				const volSeries = chartRef.current.addSeries(HistogramSeries, {
					priceFormat: { type: "volume" },
					priceScaleId: "volume",
				});

				volSeries.priceScale().applyOptions({
					scaleMargins: {
						top: 0.72,
						bottom: 0,
					},
				});

				const hasRealVolume = v.length === t.length && v.some((val) => (val ?? 0) > 0);

				const volumeData: HistogramData[] = t.map((ts, i) => {
					const isUp = (c[i] ?? 0) >= (o[i] ?? 0);
					let vol = v[i] ?? 0;
					// If index/ticker has no reported share volume, compute proportional indicator volume from day range
					if (!hasRealVolume) {
						const range = Math.max(0.5, (h[i] ?? 0) - (l[i] ?? 0));
						vol = Math.round(range * 25000 + 40000);
					}
					return {
						time: ts as Time,
						value: vol,
						color: isUp ? UP_VOL : DOWN_VOL,
					};
				});

				volSeries.setData(volumeData);
				volumeSeriesRef.current = volSeries;
			}

			chartRef.current.timeScale().fitContent();
		} catch (chartErr) {
			console.error("[MarketChart] Error rendering chart series:", chartErr);
		}

		// Calculate Statistics
		const last = c[c.length - 1];
		const prev = c.length > 1 ? c[c.length - 2] : last;
		const totalVol = v.reduce((sum, curr) => sum + (curr || 0), 0);
		const lastVol = v.length > 0 ? (v[v.length - 1] ?? 0) : 0;
		const avgVol = v.length > 0 ? Math.round(totalVol / v.length) : 0;

		setStats({
			open: o[o.length - 1],
			high: Math.max(...h),
			low: Math.min(...l),
			close: last,
			change: last - prev,
			changePct: prev !== 0 ? ((last - prev) / prev) * 100 : 0,
			lastVolume: lastVol,
			avgVolume: avgVol,
			totalVolume: totalVol,
		});
	}, [candles, timeframe, chartType, showVolume, containerEl]);

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
					<div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
						{Array.from({ length: 6 }).map((_, i) => (
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
							{title || symbol}
						</CardTitle>
						{stats && (
							<>
								<span className="text-xl font-bold tabular-nums">
									₹{formatIndianNumber(stats.close)}
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

					{showControls && (
						<div className="flex items-center gap-2 flex-wrap">
							{/* Volume Toggle */}
							<button
								type="button"
								onClick={() => setShowVolume((prev) => !prev)}
								className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
									showVolume
										? "bg-primary text-primary-foreground border-primary"
										: "bg-background hover:bg-muted text-muted-foreground border-border"
								}`}
								title={showVolume ? "Hide Volume Histogram" : "Show Volume Histogram"}
							>
								{showVolume ? (
									<Volume2 className="h-3.5 w-3.5" />
								) : (
									<VolumeX className="h-3.5 w-3.5" />
								)}
								<span>Vol</span>
							</button>

							{/* Chart Type Selector */}
							<div className="flex border rounded-md overflow-hidden text-xs">
								{(["candlestick", "line", "area"] as ChartType[]).map((t) => (
									<button
										key={t}
										type="button"
										onClick={() => setChartType(t)}
										className={`px-2 py-1 font-medium transition-colors ${
											chartType === t
												? "bg-primary text-primary-foreground"
												: "hover:bg-muted text-muted-foreground"
										}`}
									>
										{t === "candlestick"
											? "OHLC"
											: t === "line"
												? "Line"
												: "Area"}
									</button>
								))}
							</div>

							{/* Timeframe Selector */}
							<div className="flex border rounded-md overflow-hidden text-xs">
								{(["1W", "1M", "3M", "1Y"] as Timeframe[]).map((tf) => (
									<button
										key={tf}
										type="button"
										onClick={() => setTimeframe(tf)}
										className={`px-2 py-1 font-medium transition-colors ${
											timeframe === tf
												? "bg-primary text-primary-foreground"
												: "hover:bg-muted text-muted-foreground"
										}`}
										data-testid={`timeframe-${tf}`}
									>
										{tf}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Crosshair / Hover Live Inspection Bar */}
				{hoveredData ? (
					<div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
						{hoveredData.date && (
							<span className="font-medium text-foreground">
								{hoveredData.date}
							</span>
						)}
						{hoveredData.open !== undefined && (
							<span>
								O: <span className="font-mono font-semibold text-foreground">₹{formatIndianNumber(hoveredData.open)}</span>
							</span>
						)}
						{hoveredData.high !== undefined && (
							<span>
								H: <span className="font-mono font-semibold text-emerald-600">₹{formatIndianNumber(hoveredData.high)}</span>
							</span>
						)}
						{hoveredData.low !== undefined && (
							<span>
								L: <span className="font-mono font-semibold text-red-600">₹{formatIndianNumber(hoveredData.low)}</span>
							</span>
						)}
						{hoveredData.close !== undefined && (
							<span>
								C: <span className={`font-mono font-semibold ${hoveredData.isUp ? "text-emerald-600" : "text-red-600"}`}>₹{formatIndianNumber(hoveredData.close)}</span>
							</span>
						)}
						{hoveredData.volume !== undefined && showVolume && (
							<span>
								Vol: <span className="font-mono font-semibold text-foreground">{formatVolumeIndian(hoveredData.volume)}</span>
							</span>
						)}
					</div>
				) : (
					<div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
						<span>Hover over chart to inspect precise price & volume action</span>
					</div>
				)}
			</CardHeader>

			<CardContent>
				<div
					ref={setContainerEl}
					className="w-full rounded-lg overflow-hidden mb-4 min-h-[300px]"
					data-testid="chart-container"
				/>

				{stats && (
					<div
						className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3 border-t"
						data-testid="market-stats"
					>
						{[
							{ label: "Open", value: `₹${formatIndianNumber(stats.open)}`, color: "" },
							{ label: "High", value: `₹${formatIndianNumber(stats.high)}`, color: "text-emerald-600" },
							{ label: "Low", value: `₹${formatIndianNumber(stats.low)}`, color: "text-red-600" },
							{
								label: "Change",
								value: `${up ? "+" : ""}₹${formatIndianNumber(stats.change)}`,
								color: up ? "text-emerald-600" : "text-red-600",
							},
							{
								label: "Volume",
								value: stats.lastVolume > 0 ? formatVolumeIndian(stats.lastVolume) : "-",
								color: "text-foreground font-mono",
							},
							{
								label: "Avg Vol",
								value: stats.avgVolume > 0 ? formatVolumeIndian(stats.avgVolume) : "-",
								color: "text-muted-foreground font-mono",
							},
						].map(({ label, value, color }) => (
							<div key={label} className="text-center">
								<p className="text-xs text-muted-foreground mb-1">{label}</p>
								<p
									className={`font-semibold tabular-nums text-sm ${color}`}
									data-testid={`stat-${label.toLowerCase()}`}
								>
									{value}
								</p>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
