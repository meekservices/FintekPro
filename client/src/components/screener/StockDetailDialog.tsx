import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Loader2,
	Building2,
	BarChart3,
	Target,
	Shield as LucideShield,
	TrendingUp,
	Bot,
	Info,
	FileText,
	Sparkles,
	Zap,
	BarChart2,
	Users,
	Landmark,
	Star,
} from "lucide-react";
import { MarketChart } from "@/components/dashboard/market-chart";
import { ScreenerProsConsBox } from "./ScreenerProsConsBox";

function formatNum(val: string | number | null | undefined, decimals = 2): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n)) return "-";
	return n.toFixed(decimals);
}

function formatCurrency(val: string | number | null | undefined): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n)) return "-";
	return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMarketCap(val: string | number | null | undefined): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n) || n === 0) return "-";
	const cr = n >= 1_000_000 ? n / 10_000_000 : n;
	if (cr >= 100_000) return `₹${(cr / 100_000).toFixed(2)}L Cr`;
	if (cr >= 1_000) return `₹${Math.round(cr).toLocaleString("en-IN")} Cr`;
	if (cr >= 1) return `₹${cr.toFixed(1)} Cr`;
	return `₹${(cr * 100).toFixed(1)} L`;
}

function formatRoe(val: string | number | null | undefined): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n) || n === 0) return "-";
	const pct = Math.abs(n) <= 5 ? n * 100 : n;
	return `${pct.toFixed(1)}%`;
}

function formatPercent(val: string | number | null | undefined, multiplier?: number): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n)) return "-";
	const pct = multiplier !== undefined
		? (Math.abs(n) <= 1 && multiplier === 1 ? n * 100 : n * multiplier)
		: (Math.abs(n) <= 1 ? n * 100 : n);
	return `${pct.toFixed(1)}%`;
}

function formatMetricPercent(val: string | number | null | undefined, decimals = 1): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n)) return "-";
	const pct = Math.abs(n) <= 1 && n !== 0 ? n * 100 : n;
	return `${pct.toFixed(decimals)}%`;
}

function MarketCapBadge({ category }: { category: string | null }) {
	if (!category) return null;
	const colors: Record<string, string> = {
		mega: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
		"Mega Cap": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
		large: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		"Large Cap": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		mid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
		"Mid Cap": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
		small: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
		"Small Cap": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
		micro: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		"Micro Cap": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	};
	const displayName = category.includes("Cap")
		? category
		: `${category.charAt(0).toUpperCase() + category.slice(1)} Cap`;
	return (
		<Badge className={`text-[10px] font-medium border-0 ${colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
			{displayName}
		</Badge>
	);
}

function RatingStars({ rating }: { rating: number | null }) {
	if (!rating) return <span className="text-muted-foreground text-xs">-</span>;
	return (
		<div className="flex items-center gap-0.5">
			{Array.from({ length: 5 }, (_, i) => (
				<Star
					key={i}
					className={`h-3 w-3 ${i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`}
				/>
			))}
		</div>
	);
}

function ScoreBadge({ score, label }: { score: string | null; label: string }) {
	if (!score) return <span className="text-muted-foreground text-xs">-</span>;
	const n = Number.parseFloat(score);
	if (Number.isNaN(n)) return <span className="text-muted-foreground text-xs">-</span>;
	const color =
		n >= 70
			? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
			: n >= 45
				? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
				: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
	return (
		<span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${color}`} title={`${label}: ${n.toFixed(1)}/100`}>
			{n.toFixed(0)}
		</span>
	);
}

export interface StockDetailDialogProps {
	stock: any | null;
	stockDetail: any | null;
	detailLoading: boolean;
	isOpen: boolean;
	onClose: () => void;
	handleOpenChat: (instrument: any) => void;
}

export function StockDetailDialog({
	stock,
	stockDetail,
	detailLoading,
	isOpen,
	onClose,
	handleOpenChat,
}: StockDetailDialogProps) {
	if (!stock) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4">
				<DialogHeader className="pb-3 border-b">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<DialogTitle className="text-lg font-bold flex items-center gap-2 flex-wrap">
								<span>{stock.companyName}</span>
								<Badge variant="outline" className="font-mono text-xs font-semibold">
									{stock.symbol}
								</Badge>
								<MarketCapBadge category={stock.marketCapCategory} />
								{Array.isArray(stock.modelPortfolios) && stock.modelPortfolios.length > 0 && (
									<Badge
										variant="outline"
										className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
									>
										⭐ Core Portfolio
									</Badge>
								)}
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
								<span>
									Sector: {stock.sector || stockDetail?.stock?.sector || "Diversified"}
								</span>
								{stock.industry && <span>• Industry: {stock.industry}</span>}
								{stock.stockRegime && (
									<span>• Regime: {stock.stockRegime.replace(/_/g, " ")}</span>
								)}
								<span className="font-mono font-semibold text-foreground">
									• CMP: {formatCurrency(stock.currentPrice)}
								</span>
								<span className="font-mono text-muted-foreground">
									• Mkt Cap: {formatMarketCap(stock.marketCapValue)}
								</span>
							</DialogDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs font-medium"
								onClick={() => {
									window.open(`/agent/research/generate?symbol=${stock.symbol}`, "_blank");
								}}
								title="Open full institutional research note for this stock"
							>
								<FileText className="h-3.5 w-3.5 mr-1 text-primary" />
								Full Research Report
							</Button>
							<Button
								variant="secondary"
								size="sm"
								className="h-8 text-xs font-medium"
								onClick={() => {
									handleOpenChat({
										id: stock.symbol,
										name: stock.companyName,
										symbol: stock.symbol,
										assetType: "stock",
										sector: stock.sector,
										currentPrice: stock.currentPrice,
										pe: stock.peRatio,
										rating: stock.fintekRating,
									});
								}}
							>
								<Bot className="h-3.5 w-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />
								Chat with AI
							</Button>
						</div>
					</div>
				</DialogHeader>

				<div className="space-y-4">
					{/* Interactive Price & Volume Chart */}
					<div className="border rounded-lg bg-card/70 p-2 shadow-xs">
						<MarketChart
							symbol={stock.symbol}
							title={`${stock.companyName} (${stock.symbol})`}
							height={320}
						/>
					</div>

					{detailLoading ? (
						<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
							<Loader2 className="h-5 w-5 animate-spin text-primary" />
							Loading comprehensive financials & deep metrics from FintekPro DB...
						</div>
					) : stockDetail ? (
						<>
							{/* Fundamental Strengths & Risks Box */}
							<ScreenerProsConsBox
								pros={stockDetail.financials?.[0]?.pros}
								cons={stockDetail.financials?.[0]?.cons}
								companyName={stock.companyName}
							/>

							<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
								<div className="space-y-3">
									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
										<Building2 className="h-3.5 w-3.5" />
										Company Info
									</h4>
									<div className="space-y-1.5 text-xs">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Exchange</span>
											<span className="font-medium">{stockDetail.stock?.exchange || stock.exchange || "NSE"}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">ISIN</span>
											<span className="font-mono">{stockDetail.stock?.isin || stock.isin || "-"}</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Sector</span>
											<span className="font-medium">
												{stockDetail.stock?.sector && stockDetail.stock.sector !== "Diversified"
													? stockDetail.stock.sector
													: stock.sector || "Energy & Utilities"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Industry</span>
											<span className="font-medium">
												{stockDetail.stock?.industry && stockDetail.stock.industry !== "Diversified"
													? stockDetail.stock.industry
													: stock.industry || "Mining & Minerals"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Data Source</span>
											<Badge variant="outline" className="text-[9px] h-4">
												{stockDetail.stock?.dataSource || "FintekPro Core DB"}
											</Badge>
										</div>
									</div>
								</div>

								<div className="space-y-3">
									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
										<BarChart3 className="h-3.5 w-3.5" />
										Financial Metrics
									</h4>
									{stockDetail.financials?.[0] ? (
										<div className="space-y-1.5 text-xs">
											<div className="flex justify-between">
												<span className="text-muted-foreground">P/E Ratio</span>
												<span className="font-mono">{formatNum(stockDetail.financials[0].peRatio)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">P/B Ratio</span>
												<span className="font-mono">{formatNum(stockDetail.financials[0].pbRatio)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">ROE</span>
												<span className="font-mono">
													{stockDetail.financials[0].roe ? formatPercent(stockDetail.financials[0].roe, 100) : "-"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">ROA</span>
												<span className="font-mono">
													{(() => {
														const roa = stockDetail.financials?.[0]?.roa ?? (() => {
															const fin = stockDetail.financials?.[0];
															if (!fin) return null;
															if (fin.netIncome != null && fin.totalAssets != null && Number(fin.totalAssets) > 0) {
																return Number(fin.netIncome) / Number(fin.totalAssets);
															}
															if (fin.roe != null && fin.debtToEquity != null) {
																const r = Number(fin.roe);
																const d = Number(fin.debtToEquity);
																if (!Number.isNaN(r) && !Number.isNaN(d) && d >= 0) return r / (1 + d);
															}
															return null;
														})();
														return roa != null ? formatMetricPercent(roa, 2) : "-";
													})()}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">PEG Ratio</span>
												<span className="font-mono">
													{(() => {
														const peg = stockDetail.financials?.[0]?.pegRatio ?? stock.pegRatio ?? (() => {
															const pe = Number(stockDetail.financials?.[0]?.peRatio ?? stock.peRatio);
															const g = Number(stockDetail.financials?.[0]?.earningsGrowth ?? stock.earningsGrowth3Y ?? stock.revenueGrowth3Y);
															if (pe > 0 && g > 0) {
																const gPct = g <= 1 ? g * 100 : g;
																if (gPct >= 1) return (pe / gPct).toFixed(2);
															}
															return null;
														})();
														return peg != null ? `${Number(peg).toFixed(2)}` : "-";
													})()}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">EPS</span>
												<span className="font-mono">{formatNum(stockDetail.financials[0].eps)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Book Value</span>
												<span className="font-mono">{formatNum(stockDetail.financials[0].bookValue)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">D/E</span>
												<span className="font-mono">{formatNum(stockDetail.financials[0].debtToEquity)}</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">Dividend Yield</span>
												<span className="font-mono">
													{stockDetail.financials[0].dividendYield ? formatPercent(stockDetail.financials[0].dividendYield, 100) : "-"}
												</span>
											</div>
											<Separator className="my-1" />
											<div className="flex justify-between">
												<span className="text-muted-foreground">1Y Return</span>
												<span className={`font-mono ${Number.parseFloat(stockDetail.derivedMetrics?.return1Y ?? stock.return1Y ?? "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}>
													{(stockDetail.derivedMetrics?.return1Y ?? stock.return1Y)
														? `${Number.parseFloat(stockDetail.derivedMetrics?.return1Y ?? stock.return1Y) >= 0 ? "+" : ""}${formatMetricPercent(stockDetail.derivedMetrics?.return1Y ?? stock.return1Y, 1)}`
														: "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">2Y Return</span>
												<span className={`font-mono ${Number.parseFloat(stockDetail.derivedMetrics?.return2Y ?? stock.return2Y ?? "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}>
													{(stockDetail.derivedMetrics?.return2Y ?? stock.return2Y)
														? `${Number.parseFloat(stockDetail.derivedMetrics?.return2Y ?? stock.return2Y) >= 0 ? "+" : ""}${formatMetricPercent(stockDetail.derivedMetrics?.return2Y ?? stock.return2Y, 1)}`
														: "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">3Y Return</span>
												<span className={`font-mono ${Number.parseFloat(stockDetail.derivedMetrics?.return3Y ?? stock.return3Y ?? "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}>
													{(stockDetail.derivedMetrics?.return3Y ?? stock.return3Y)
														? `${Number.parseFloat(stockDetail.derivedMetrics?.return3Y ?? stock.return3Y) >= 0 ? "+" : ""}${formatMetricPercent(stockDetail.derivedMetrics?.return3Y ?? stock.return3Y, 1)}`
														: "N/A"}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-muted-foreground">5Y Return</span>
												<span className={`font-mono ${Number.parseFloat(stockDetail.derivedMetrics?.return5Y ?? stock.return5Y ?? "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}>
													{(stockDetail.derivedMetrics?.return5Y ?? stock.return5Y)
														? `${Number.parseFloat(stockDetail.derivedMetrics?.return5Y ?? stock.return5Y) >= 0 ? "+" : ""}${formatMetricPercent(stockDetail.derivedMetrics?.return5Y ?? stock.return5Y, 1)}`
														: "N/A"}
												</span>
											</div>
										</div>
									) : (
										<p className="text-xs text-muted-foreground">No financial data available</p>
									)}
								</div>

								{/* Valuation Signals — Analyst Consensus + DCF + Alpha */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<TrendingUp className="h-3.5 w-3.5 text-cyan-600" />
											Valuation Signals
										</h4>
										<Badge variant="outline" className="text-[9px] h-4 bg-cyan-50/50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-300">
											FintekPro Native
										</Badge>
									</div>
									<div className="space-y-1.5 text-xs">
										{stock.analystAvgTarget ? (
											<>
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">Analyst Rating</span>
													{stock.analystConsensusRating && (
														<Badge variant="outline" className={`text-[9px] h-4 font-semibold ${stock.analystConsensusRating === 'Strong Buy' || stock.analystConsensusRating === 'Buy' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40' : stock.analystConsensusRating === 'Sell' || stock.analystConsensusRating === 'Strong Sell' ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/40' : 'border-slate-400 text-slate-600 dark:text-slate-400'}`}>
															{stock.analystConsensusRating}
														</Badge>
													)}
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Avg Target (12M)</span>
													<span className="font-mono font-semibold">₹{Number.parseFloat(stock.analystAvgTarget).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Analyst Upside</span>
													<span className={`font-mono font-semibold ${stock.analystUpsidePct && Number.parseFloat(stock.analystUpsidePct) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
														{stock.analystUpsidePct ? `${Number.parseFloat(stock.analystUpsidePct) > 0 ? "+" : ""}${Number.parseFloat(stock.analystUpsidePct).toFixed(1)}%` : "-"}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Coverage Basket</span>
													<span className="font-mono">{stock.analystCount ?? "8"} inst.</span>
												</div>
											</>
										) : (
											<p className="text-muted-foreground text-xs">Awaiting consensus run</p>
										)}
										{stock.dcfUpsidePercent && (
											<div className="mt-2 pt-2 border-t space-y-1.5">
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">DCF Intrinsic vs CMP</span>
													<span className={`font-mono font-semibold ${Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'text-emerald-600 dark:text-emerald-400' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'text-red-500 dark:text-red-400' : ''}`}>
														{`${Number.parseFloat(stock.dcfUpsidePercent) > 0 ? "+" : ""}${Number.parseFloat(stock.dcfUpsidePercent).toFixed(1)}%`}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">Valuation Signal</span>
													<Badge variant="outline" className={`text-[9px] h-4 ${Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'border-red-500 text-red-600 bg-red-50/50 dark:bg-red-950/40' : 'border-blue-400 text-blue-600 bg-blue-50/40'}`}>
														{Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'Undervalued' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'Overvalued' : 'Fair Value'}
													</Badge>
												</div>
											</div>
										)}
										{stock.forwardPe && (
											<div className="mt-2 pt-2 border-t">
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">Forward P/E (1Y)</span>
													<span className="font-mono font-semibold">{Number.parseFloat(stock.forwardPe).toFixed(1)}×</span>
												</div>
											</div>
										)}
										{stock.returnVsNifty1Y && (
											<div className="mt-2 pt-2 border-t">
												<div className="flex justify-between">
													<span className="text-muted-foreground">α vs NIFTY (1Y)</span>
													<span className={`font-mono font-semibold ${Number.parseFloat(stock.returnVsNifty1Y) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
														{`${Number.parseFloat(stock.returnVsNifty1Y) > 0 ? "+" : ""}${(Number.parseFloat(stock.returnVsNifty1Y) * 100).toFixed(1)}%`}
													</span>
												</div>
											</div>
										)}
									</div>
								</div>

								{/* Risk & Volatility Ratios */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<LucideShield className="h-3.5 w-3.5 text-primary" />
											Risk & Volatility Ratios
										</h4>
										<Badge variant="outline" className="text-[9px] h-4 bg-primary/5 text-primary border-primary/30">
											Risk-Adjusted
										</Badge>
									</div>
									<div className="space-y-1.5 text-xs">
										<div className="flex justify-between">
											<span className="text-muted-foreground">Beta (vs NIFTY 50)</span>
											<span className="font-mono font-semibold">
												{(stock.beta ?? stockDetail.derivedMetrics?.beta) ? Number.parseFloat(stock.beta ?? stockDetail.derivedMetrics?.beta).toFixed(2) : "-"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Sharpe Ratio (1Y)</span>
											<span className={`font-mono font-semibold ${(stock.sharpeRatio1Y ?? stockDetail.derivedMetrics?.sharpeRatio1Y) && Number.parseFloat(stock.sharpeRatio1Y ?? stockDetail.derivedMetrics?.sharpeRatio1Y) > 1 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
												{(stock.sharpeRatio1Y ?? stockDetail.derivedMetrics?.sharpeRatio1Y) ? Number.parseFloat(stock.sharpeRatio1Y ?? stockDetail.derivedMetrics?.sharpeRatio1Y).toFixed(2) : "-"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Sortino Ratio (1Y)</span>
											<span className={`font-mono font-semibold ${(stock.sortinoRatio1Y ?? stockDetail.derivedMetrics?.sortinoRatio1Y) && Number.parseFloat(stock.sortinoRatio1Y ?? stockDetail.derivedMetrics?.sortinoRatio1Y) > 1 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
												{(stock.sortinoRatio1Y ?? stockDetail.derivedMetrics?.sortinoRatio1Y) ? Number.parseFloat(stock.sortinoRatio1Y ?? stockDetail.derivedMetrics?.sortinoRatio1Y).toFixed(2) : "-"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Volatility (30D Ann.)</span>
											<span className="font-mono">
												{(stock.volatility30D ?? stockDetail.derivedMetrics?.volatility30D) ? `${(Number.parseFloat(stock.volatility30D ?? stockDetail.derivedMetrics?.volatility30D) * 100).toFixed(1)}%` : "-"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-muted-foreground">Max Drawdown (1Y)</span>
											<span className="font-mono text-red-500">
												{(stock.maxDrawdown1Y ?? stockDetail.derivedMetrics?.maxDrawdown1Y) ? `${(Number.parseFloat(stock.maxDrawdown1Y ?? stockDetail.derivedMetrics?.maxDrawdown1Y) * 100).toFixed(1)}%` : "-"}
											</span>
										</div>
										{(stock.piotroskiScore != null || stock.altmanZScore != null) && (
											<div className="mt-2 pt-2 border-t space-y-1.5">
												{stock.piotroskiScore != null && (
													<div className="flex justify-between items-center">
														<span className="text-muted-foreground">Piotroski F-Score</span>
														<Badge variant="outline" className={`text-[9px] h-4 font-mono font-semibold ${stock.piotroskiScore >= 7 ? "border-emerald-500 text-emerald-600 bg-emerald-50/50" : stock.piotroskiScore <= 3 ? "border-red-500 text-red-600 bg-red-50/50" : "border-amber-500 text-amber-600"}`}>
															{stock.piotroskiScore}/9 {stock.piotroskiScore >= 7 ? "(Strong)" : stock.piotroskiScore <= 3 ? "(Weak)" : ""}
														</Badge>
													</div>
												)}
												{stock.altmanZScore != null && (
													<div className="flex justify-between items-center">
														<span className="text-muted-foreground">Altman Z-Score</span>
														<Badge variant="outline" className={`text-[9px] h-4 font-mono font-semibold ${Number.parseFloat(stock.altmanZScore) > 2.99 ? "border-emerald-500 text-emerald-600 bg-emerald-50/50" : Number.parseFloat(stock.altmanZScore) < 1.81 ? "border-red-500 text-red-600 bg-red-50/50" : "border-blue-400 text-blue-600 bg-blue-50/50"}`}>
															{Number.parseFloat(stock.altmanZScore).toFixed(2)} {Number.parseFloat(stock.altmanZScore) > 2.99 ? "(Safe)" : Number.parseFloat(stock.altmanZScore) < 1.81 ? "(Distress)" : "(Grey)"}
														</Badge>
													</div>
												)}
											</div>
										)}
									</div>
								</div>

								{/* Advanced Valuation */}
								{Boolean(stock.roic || stock.evToEbitda || stock.evToRevenue || stock.pfcfRatio || stock.earningsYield || stock.freeCashFlowYield || stock.grahamNumber || stock.magicFormulaRank != null) && (
									<div className="space-y-3">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<Target className="h-3.5 w-3.5" />
											Advanced Valuation
										</h4>
										<div className="space-y-1.5 text-xs">
											{stock.roic && <div className="flex justify-between"><span className="text-muted-foreground">ROIC</span><span className={`font-mono font-semibold ${Number.parseFloat(stock.roic) > 0.15 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatMetricPercent(stock.roic, 1)}</span></div>}
											{stock.evToEbitda && <div className="flex justify-between"><span className="text-muted-foreground">EV/EBITDA</span><span className="font-mono">{Number.parseFloat(stock.evToEbitda).toFixed(1)}×</span></div>}
											{stock.evToRevenue && <div className="flex justify-between"><span className="text-muted-foreground">EV/Revenue</span><span className="font-mono">{Number.parseFloat(stock.evToRevenue).toFixed(2)}×</span></div>}
											{stock.pfcfRatio && <div className="flex justify-between"><span className="text-muted-foreground">P/FCF</span><span className="font-mono">{Number.parseFloat(stock.pfcfRatio).toFixed(1)}×</span></div>}
											{stock.earningsYield && <div className="flex justify-between"><span className="text-muted-foreground">Earnings Yield</span><span className="font-mono">{formatMetricPercent(stock.earningsYield, 2)}</span></div>}
											{stock.freeCashFlowYield && <div className="flex justify-between"><span className="text-muted-foreground">FCF Yield</span><span className="font-mono">{formatMetricPercent(stock.freeCashFlowYield, 2)}</span></div>}
											{stock.grahamNumber && (
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">Graham Number</span>
													<div className="text-right">
														<span className="font-mono">₹{Number.parseFloat(stock.grahamNumber).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
														{stock.grahamUpside && (
															<Badge variant="outline" className={`ml-1 text-[9px] h-4 ${Number.parseFloat(stock.grahamUpside) > 0 ? 'border-emerald-500 text-emerald-600' : 'border-red-400 text-red-500'}`}>
																{Number.parseFloat(stock.grahamUpside) > 0 ? "+" : ""}{Number.parseFloat(stock.grahamUpside).toFixed(1)}%
															</Badge>
														)}
													</div>
												</div>
											)}
											{stock.magicFormulaRank != null && (
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">Magic Formula Rank</span>
													<Badge variant="outline" className={`text-[9px] h-4 ${stock.magicFormulaRank <= 100 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : stock.magicFormulaRank <= 300 ? 'border-amber-500 text-amber-600' : 'border-muted-foreground text-muted-foreground'}`}>
														#{stock.magicFormulaRank}
													</Badge>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Efficiency */}
								{Boolean(stock.fcfMargin || stock.operatingMargin || stock.assetTurnover || stock.incomeQuality || stock.daysSalesOutstanding || stock.daysInventoryOnHand || stock.daysPayablesOutstanding || stock.cashConversionCycle) && (
									<div className="space-y-3">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<BarChart2 className="h-3.5 w-3.5" />
											Efficiency
										</h4>
										<div className="space-y-1.5 text-xs">
											{stock.fcfMargin && <div className="flex justify-between"><span className="text-muted-foreground">FCF Margin</span><span className={`font-mono font-semibold ${Number.parseFloat(stock.fcfMargin) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{formatMetricPercent(stock.fcfMargin, 1)}</span></div>}
											{stock.operatingMargin && <div className="flex justify-between"><span className="text-muted-foreground">Op. Margin</span><span className="font-mono">{formatMetricPercent(stock.operatingMargin, 1)}</span></div>}
											{stock.assetTurnover && <div className="flex justify-between"><span className="text-muted-foreground">Asset Turnover</span><span className="font-mono">{Number.parseFloat(stock.assetTurnover).toFixed(2)}×</span></div>}
											{stock.incomeQuality && <div className="flex justify-between items-center"><span className="text-muted-foreground">Income Quality</span><span className={`font-mono ${Number.parseFloat(stock.incomeQuality) >= 0.8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>{Number.parseFloat(stock.incomeQuality).toFixed(2)}</span></div>}
											{stock.daysSalesOutstanding && <div className="flex justify-between"><span className="text-muted-foreground">DSO (days)</span><span className="font-mono">{Number.parseFloat(stock.daysSalesOutstanding).toFixed(0)}</span></div>}
											{stock.daysInventoryOnHand && <div className="flex justify-between"><span className="text-muted-foreground">DIO (days)</span><span className="font-mono">{Number.parseFloat(stock.daysInventoryOnHand).toFixed(0)}</span></div>}
											{stock.daysPayablesOutstanding && <div className="flex justify-between"><span className="text-muted-foreground">DPO (days)</span><span className="font-mono">{Number.parseFloat(stock.daysPayablesOutstanding).toFixed(0)}</span></div>}
											{stock.cashConversionCycle && <div className="flex justify-between items-center border-t pt-1.5 mt-1"><span className="text-muted-foreground font-medium">Cash Conv. Cycle</span><span className={`font-mono font-semibold ${Number.parseFloat(stock.cashConversionCycle) < 0 ? 'text-emerald-600 dark:text-emerald-400' : Number.parseFloat(stock.cashConversionCycle) < 30 ? 'text-blue-600' : ''}`}>{Number.parseFloat(stock.cashConversionCycle).toFixed(0)} days</span></div>}
										</div>
									</div>
								)}

								{/* Ownership */}
								{Boolean(stock.promoterHolding != null || stock.fiiHolding != null || stock.diiHolding != null || stock.pledgedShares != null || (stockDetail?.shareholding && stockDetail.shareholding.length > 0)) && (
									<div className="space-y-3 min-w-[150px]">
										<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
											<Users className="h-3.5 w-3.5" />
											Ownership
										</h4>
										<div className="space-y-1.5 text-xs">
											{(stock.promoterHolding != null || stockDetail?.shareholding?.[0]?.promoterHolding != null) && (
												<div className="flex justify-between items-center gap-2">
													<span className="text-muted-foreground truncate">Promoter</span>
													<div className="flex items-center gap-1.5 shrink-0">
														<span className="font-mono font-semibold">{Number.parseFloat(stock.promoterHolding ?? stockDetail?.shareholding?.[0]?.promoterHolding ?? "0").toFixed(1)}%</span>
														{(stock.promoterHoldingChange || stockDetail?.shareholding?.[0]?.promoterHoldingChange) && (
															<span className={`text-[10px] ${Number.parseFloat(stock.promoterHoldingChange ?? stockDetail?.shareholding?.[0]?.promoterHoldingChange) > 0 ? 'text-emerald-600' : Number.parseFloat(stock.promoterHoldingChange ?? stockDetail?.shareholding?.[0]?.promoterHoldingChange) < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
																{Number.parseFloat(stock.promoterHoldingChange ?? stockDetail?.shareholding?.[0]?.promoterHoldingChange) > 0 ? "▲" : Number.parseFloat(stock.promoterHoldingChange ?? stockDetail?.shareholding?.[0]?.promoterHoldingChange) < 0 ? "▼" : ""}
																{Math.abs(Number.parseFloat(stock.promoterHoldingChange ?? stockDetail?.shareholding?.[0]?.promoterHoldingChange)).toFixed(2)}%
															</span>
														)}
													</div>
												</div>
											)}
											{(stock.fiiHolding != null || stockDetail?.shareholding?.[0]?.fiiHolding != null) && (
												<div className="flex justify-between items-center gap-2">
													<span className="text-muted-foreground truncate">FII</span>
													<div className="flex items-center gap-1.5 shrink-0">
														<span className="font-mono">{Number.parseFloat(stock.fiiHolding ?? stockDetail?.shareholding?.[0]?.fiiHolding ?? "0").toFixed(1)}%</span>
														{(stock.fiiHoldingChange || stockDetail?.shareholding?.[0]?.fiiHoldingChange) && (
															<span className={`text-[10px] ${Number.parseFloat(stock.fiiHoldingChange ?? stockDetail?.shareholding?.[0]?.fiiHoldingChange) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
																{Number.parseFloat(stock.fiiHoldingChange ?? stockDetail?.shareholding?.[0]?.fiiHoldingChange) > 0 ? "▲" : "▼"}{Math.abs(Number.parseFloat(stock.fiiHoldingChange ?? stockDetail?.shareholding?.[0]?.fiiHoldingChange)).toFixed(2)}%
															</span>
														)}
													</div>
												</div>
											)}
											{(stock.diiHolding != null || stockDetail?.shareholding?.[0]?.diiHolding != null) && (
												<div className="flex justify-between items-center gap-2">
													<span className="text-muted-foreground truncate">DII</span>
													<span className="font-mono shrink-0">{Number.parseFloat(stock.diiHolding ?? stockDetail?.shareholding?.[0]?.diiHolding ?? "0").toFixed(1)}%</span>
												</div>
											)}
											<div className="flex justify-between items-center gap-2 border-t pt-1.5 mt-1">
												<span className="text-muted-foreground truncate">Pledged Shares</span>
												<span className={`font-mono font-semibold shrink-0 ${Number.parseFloat(stock.pledgedShares ?? stockDetail?.shareholding?.[0]?.pledgedShares ?? "0") > 20 ? 'text-red-600 dark:text-red-400' : Number.parseFloat(stock.pledgedShares ?? stockDetail?.shareholding?.[0]?.pledgedShares ?? "0") > 5 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
													{Number.parseFloat(stock.pledgedShares ?? stockDetail?.shareholding?.[0]?.pledgedShares ?? "0").toFixed(1)}%
												</span>
											</div>
										</div>
									</div>
								)}

								<div className="space-y-3">
									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
										<Target className="h-3.5 w-3.5" />
										Score Breakdown
									</h4>
									{stockDetail.derivedMetrics ? (
										<div className="space-y-2">
											{[
												{ label: "Quality", score: stockDetail.derivedMetrics?.qualityScore, icon: Sparkles, color: "bg-purple-500", weight: "25%" },
												{ label: "Growth", score: stockDetail.derivedMetrics?.growthScore, icon: TrendingUp, color: "bg-blue-500", weight: "20%" },
												{ label: "Value", score: stockDetail.derivedMetrics?.valueScore, icon: Target, color: "bg-emerald-500", weight: "20%" },
												{ label: "Momentum", score: stockDetail.derivedMetrics?.momentumScore ?? stock.momentumScore, icon: Zap, color: "bg-amber-500", weight: "20%" },
												{ label: "Risk / Safety", score: stockDetail.derivedMetrics?.riskScore, icon: LucideShield, color: "bg-orange-500", weight: "15%" },
											].map(({ label, score, icon: Icon, color, weight }) => {
												const s = Number.parseFloat(score || "0");
												return (
													<div key={label} className="space-y-0.5">
														<div className="flex items-center justify-between text-xs">
															<span className="flex items-center gap-1.5">
																<Icon className="h-3 w-3 text-muted-foreground" />
																{label} <span className="text-muted-foreground">({weight})</span>
															</span>
															<span className="font-mono font-medium">{s.toFixed(1)}</span>
														</div>
														<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
															<div className={`h-full rounded-full ${color}`} style={{ width: `${s}%` }} />
														</div>
													</div>
												);
											})}
											<Separator className="my-2" />
											<div className="flex items-center justify-between">
												<span className="text-xs font-semibold">Composite Score</span>
												<div className="flex items-center gap-2">
													<ScoreBadge score={stockDetail.derivedMetrics.compositeScore} label="Composite" />
													<RatingStars rating={stockDetail.derivedMetrics.fintekRating} />
												</div>
											</div>
										</div>
									) : (
										<p className="text-xs text-muted-foreground">No scoring data available</p>
									)}
								</div>
							</div>

							{stockDetail.marqueeBrokerageViews && (
								<div className="mt-4 border rounded-lg bg-card/70 p-3.5 space-y-3 shadow-xs">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
										<div className="flex items-center gap-2 flex-wrap">
											<Landmark className="h-4 w-4 text-primary" />
											<span className="font-semibold text-xs tracking-tight text-foreground">
												Marquee Institutional Desk Views & Quoting Reference
											</span>
											<Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
												Reference Only
											</Badge>
											{stockDetail.marqueeBrokerageViews.consensusRating && (
												<Badge
													variant="outline"
													className={`text-[9px] px-1.5 py-0 font-semibold ${
														stockDetail.marqueeBrokerageViews.consensusRating.includes("BUY")
															? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
															: stockDetail.marqueeBrokerageViews.consensusRating.includes("SELL")
															? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
															: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
													}`}
												>
													Consensus: {stockDetail.marqueeBrokerageViews.consensusRating}
												</Badge>
											)}
											{stockDetail.stockRegime && (
												<Badge
													variant="outline"
													className={`text-[9px] px-1.5 py-0 font-medium ${
														stockDetail.stockRegime === "BULLISH_TRENDING"
															? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
															: stockDetail.stockRegime === "EARLY_STAGE_BREAKOUT"
															? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
															: stockDetail.stockRegime === "BEARISH_DOWNTREND"
															? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"
															: stockDetail.stockRegime === "HIGH_VOLATILITY_CHOP"
															? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
															: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
													}`}
												>
													Micro-Regime: {stockDetail.stockRegime.replace(/_/g, " ")}
												</Badge>
											)}
										</div>
										{stockDetail.marqueeBrokerageViews.totalAnalysts ? (
											<div className="flex items-center gap-2 text-xs flex-wrap">
												<span className="text-muted-foreground">
													Street Consensus ({stockDetail.marqueeBrokerageViews.totalAnalysts} Analysts):
												</span>
												<span className="font-mono font-bold text-foreground">
													Mean ₹{Number(stockDetail.marqueeBrokerageViews.targetMean || 0).toLocaleString()}
												</span>
												{stockDetail.marqueeBrokerageViews.consensusUpsidePercent != null && (
													<Badge
														variant="outline"
														className={`text-[10px] font-mono px-1.5 py-0 ${
															stockDetail.marqueeBrokerageViews.consensusUpsidePercent >= 0
																? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
																: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
														}`}
													>
														{stockDetail.marqueeBrokerageViews.consensusUpsidePercent >= 0 ? "+" : ""}
														{stockDetail.marqueeBrokerageViews.consensusUpsidePercent}%
													</Badge>
												)}
												{stockDetail.marqueeBrokerageViews.targetHigh && stockDetail.marqueeBrokerageViews.targetLow && (
													<span className="text-muted-foreground font-mono text-[11px]">
														[Low ₹{Number(stockDetail.marqueeBrokerageViews.targetLow || 0).toLocaleString()} – High ₹{Number(stockDetail.marqueeBrokerageViews.targetHigh || 0).toLocaleString()}]
													</span>
												)}
											</div>
										) : null}
									</div>

									{/* Target Range Visual Meter */}
									{stockDetail.marqueeBrokerageViews.targetLow && stockDetail.marqueeBrokerageViews.targetHigh && stockDetail.marqueeBrokerageViews.targetMean && (
										<div className="bg-muted/20 border rounded-md p-2.5 space-y-1.5 text-xs">
											<div className="flex justify-between items-center text-[10px] text-muted-foreground">
												<span>Street Range</span>
												<span className="font-mono">
													Low: ₹{Number(stockDetail.marqueeBrokerageViews.targetLow).toLocaleString()} | Mean: ₹{Number(stockDetail.marqueeBrokerageViews.targetMean).toLocaleString()} | High: ₹{Number(stockDetail.marqueeBrokerageViews.targetHigh).toLocaleString()}
												</span>
											</div>
											<div className="w-full bg-muted/60 h-2 rounded-full relative overflow-hidden flex items-center">
												<div className="absolute inset-y-0 bg-primary/20 rounded-full w-full" />
												{(() => {
													const curPrice = Number(stockDetail.stock?.currentPrice || stock.currentPrice || 0);
													const targetLow = Number(stockDetail.marqueeBrokerageViews.targetLow || 0);
													const targetHigh = Number(stockDetail.marqueeBrokerageViews.targetHigh || 0);
													if (curPrice > 0 && targetHigh > targetLow) {
														const leftPct = Math.max(0, Math.min(100, ((curPrice - targetLow) / (targetHigh - targetLow)) * 100));
														return (
															<div
																className="absolute top-0 bottom-0 bg-primary rounded-full shadow-xs"
																style={{ left: `${leftPct}%`, width: "4px" }}
																title={`Current Price: ₹${curPrice}`}
															/>
														);
													}
													return null;
												})()}
											</div>
										</div>
									)}

									{stockDetail.marqueeBrokerageViews.quotingSummary && (
										<div className="bg-muted/40 rounded-md p-2.5 text-xs text-muted-foreground italic border-l-2 border-primary">
											"{stockDetail.marqueeBrokerageViews.quotingSummary}"
										</div>
									)}

									{Array.isArray(stockDetail.marqueeBrokerageViews.marqueeViews) && stockDetail.marqueeBrokerageViews.marqueeViews.length > 0 && (
										<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
											{stockDetail.marqueeBrokerageViews.marqueeViews.slice(0, 6).map((mv: any, idx: number) => (
												<div key={idx} className="p-2.5 rounded-md border bg-background/50 hover:bg-muted/20 transition-colors text-xs space-y-1.5">
													<div className="flex items-center justify-between">
														<span className="font-semibold text-foreground">{mv.firm}</span>
														<div className="flex items-center gap-1">
															{mv.action && mv.action !== "MAINTAIN" && (
																<Badge
																	variant="outline"
																	className={`text-[8px] px-1 py-0 ${
																		mv.action === "UPGRADE"
																			? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
																			: mv.action === "DOWNGRADE"
																			? "bg-red-500/10 text-red-600 border-red-500/30"
																			: "bg-blue-500/10 text-blue-600 border-blue-500/30"
																	}`}
																>
																	{mv.action}
																</Badge>
															)}
															<Badge variant="outline" className={`text-[9px] px-1 py-0 ${mv.tier === "GLOBAL_BULGE_BRACKET" ? "border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10" : "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10"}`}>
																{mv.tier === "GLOBAL_BULGE_BRACKET" ? "Bulge Bracket" : "Domestic Tier-1"}
															</Badge>
														</div>
													</div>
													<div className="flex items-center justify-between text-[11px]">
														{mv.targetPrice ? (
															<span className="font-mono font-medium text-foreground">
																Target: ₹{Number(mv.targetPrice).toLocaleString()}
															</span>
														) : (
															<span className="text-muted-foreground">Rating: {mv.rating || "Covered"}</span>
														)}
														{mv.upsidePercent !== null && mv.upsidePercent !== undefined && (
															<span className={`font-mono font-semibold ${mv.upsidePercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
																{mv.upsidePercent >= 0 ? "+" : ""}{mv.upsidePercent}%
															</span>
														)}
													</div>
													<p className="text-[10px] text-muted-foreground line-clamp-2" title={mv.headline}>
														{mv.headline}
													</p>
													<div className="flex items-center justify-between text-[9px] text-muted-foreground/70 pt-0.5">
														<span>{mv.source || "Research Note"}</span>
														<span>{mv.publishedDate}</span>
													</div>
												</div>
											))}
										</div>
									)}

									<div className="text-[10px] text-muted-foreground/70 flex items-center gap-1.5 pt-1">
										<Info className="h-3 w-3 shrink-0" />
										<span>
											{stockDetail.marqueeBrokerageViews.disclaimer ||
												"Institutional brokerage views are curated from public research notes for reference, benchmarking, and quotation only. FintekPro engines independently evaluate intrinsic value."}
										</span>
									</div>
								</div>
							)}
						</>
					) : (
						<p className="text-sm text-muted-foreground text-center py-6">Could not load details</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

