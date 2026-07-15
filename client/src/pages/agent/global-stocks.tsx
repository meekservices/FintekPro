/**
 * GlobalStocksPage — /agent/global-stocks
 * ─────────────────────────────────────────
 * Shows NASDAQ-100 + S&P 500 constituent stocks with live Alpaca prices.
 * Agent read-only view: no order placement here (use /agent/alpaca-hub for trading).
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	TrendingUp,
	TrendingDown,
	Search,
	RefreshCw,
	Globe,
	ChevronLeft,
	ChevronRight,
	BarChart3,
	DollarSign,
	Filter,
	Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockRow {
	symbol: string;
	exchange: string;
	indices: string[];
	price: number | null;
	priceINR: number | null;
	change: number;
	changePercent: number;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
	vwap: number | null;
	dataSource: string;
}

interface ScreenerData {
	stocks: StockRow[];
	pagination: { page: number; limit: number; total: number; pages: number };
	exchangeRate: { rate: number; currency: string };
	universe: string;
	lastUpdated: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null, decimals = 2) =>
	n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtINR = (n: number | null) =>
	n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtVol = (n: number | null) => {
	if (n == null) return "—";
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
	return String(n);
};

const EXCHANGE_TABS = [
	{ key: "ALL",    label: "All Stocks",   color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
	{ key: "NASDAQ", label: "NASDAQ-100",   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
	{ key: "SP500",  label: "S&P 500",      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalStocksPage() {
	const [exchange, setExchange] = useState<"ALL" | "NASDAQ" | "SP500">("ALL");
	const [search, setSearch]     = useState("");
	const [page, setPage]         = useState(1);
	const LIMIT = 20;

	// Debounce search — only fire query after user pauses
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const debounceTimeout = useMemo(() => ({ id: 0 }), []);
	const handleSearch = (val: string) => {
		setSearch(val);
		clearTimeout(debounceTimeout.id);
		debounceTimeout.id = window.setTimeout(() => {
			setDebouncedSearch(val.toUpperCase().trim());
			setPage(1);
		}, 350);
	};

	const qKey = ["/api/us-trading/market/screener", exchange, debouncedSearch, page, LIMIT];
	const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery<{ success: boolean; data: ScreenerData }>({
		queryKey: qKey,
		queryFn: async () => {
			const params = new URLSearchParams({
				exchange,
				search: debouncedSearch,
				page:   String(page),
				limit:  String(LIMIT),
			});
			const res = await fetch(`/api/us-trading/market/screener?${params}`);
			if (!res.ok) throw new Error(await res.text());
			return res.json();
		},
		refetchInterval: 60_000, // refresh every 60s
		staleTime:       30_000,
	});

	const screener   = data?.data;
	const stocks     = screener?.stocks ?? [];
	const pagination = screener?.pagination;
	const fxRate     = screener?.exchangeRate?.rate ?? 84.5;
	const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN") : "—";

	return (
		<div className="min-h-screen bg-background p-4 md:p-6 space-y-5">
			{/* ── Header ── */}
			<div className="flex items-start justify-between gap-4 flex-wrap">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Globe className="h-5 w-5 text-violet-500" />
						<h1 className="text-xl font-bold tracking-tight">Global Stocks</h1>
						<Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0.5 border-violet-500/30 text-violet-600 dark:text-violet-400">
							NASDAQ · S&amp;P 500
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">
						Live prices via Alpaca IEX · USD/INR {fxRate.toFixed(2)} · Updated {lastUpdate}
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={() => refetch()}
					disabled={isFetching}
					className="h-8 gap-1.5 text-xs"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			{/* ── Filters ── */}
			<div className="flex flex-col sm:flex-row gap-3">
				{/* Exchange tabs */}
				<div className="flex gap-1 p-1 bg-muted/50 rounded-lg border border-border/50 w-fit">
					{EXCHANGE_TABS.map((t) => (
						<button
							key={t.key}
							onClick={() => { setExchange(t.key as "ALL" | "NASDAQ" | "SP500"); setPage(1); }}
							className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
								exchange === t.key
									? `${t.color} shadow-sm ring-1 ring-border`
									: "text-muted-foreground hover:text-foreground hover:bg-muted/60"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>

				{/* Search */}
				<div className="relative flex-1 max-w-xs">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => handleSearch(e.target.value)}
						placeholder="Search symbol…"
						className="pl-8 h-9 text-xs bg-background"
					/>
				</div>

				{pagination && (
					<div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
						<Filter className="h-3.5 w-3.5" />
						{pagination.total} stocks
					</div>
				)}
			</div>

			{/* ── Table ── */}
			<div className="rounded-xl border border-border/50 overflow-hidden bg-card/60 backdrop-blur-sm">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border/50 bg-muted/30">
								<th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-32">Symbol</th>
								<th className="text-left px-3 py-3 text-xs font-semibold text-muted-foreground">Listed On</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Price (USD)</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Price (INR)</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Change</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">High</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">Low</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Volume</th>
								<th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">VWAP</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/30">
							{isLoading
								? Array.from({ length: LIMIT }).map((_, i) => (
									<tr key={i}>
										{Array.from({ length: 9 }).map((__, j) => (
											<td key={j} className="px-3 py-3">
												<Skeleton className="h-4 w-full rounded" />
											</td>
										))}
									</tr>
								))
								: stocks.map((s) => {
									const up = s.changePercent >= 0;
									return (
										<tr
											key={s.symbol}
											className="hover:bg-muted/20 transition-colors group"
										>
											{/* Symbol */}
											<td className="px-4 py-3">
												<div className="flex items-center gap-2">
													<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-border/50 text-[10px] font-bold text-foreground">
														{s.symbol.slice(0, 2)}
													</div>
													<div>
														<div className="font-semibold text-xs tracking-wide">{s.symbol}</div>
														<div className="text-[10px] text-muted-foreground">{s.exchange}</div>
													</div>
												</div>
											</td>

											{/* Index badges */}
											<td className="px-3 py-3">
												<div className="flex gap-1 flex-wrap">
													{s.indices.map((idx) => (
														<span
															key={idx}
															className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
																idx === "NASDAQ-100"
																	? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
																	: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
															}`}
														>
															{idx}
														</span>
													))}
												</div>
											</td>

											{/* Price USD */}
											<td className="px-3 py-3 text-right">
												<span className="font-mono font-semibold text-xs">
													{s.price ? `$${fmt(s.price)}` : "—"}
												</span>
											</td>

											{/* Price INR */}
											<td className="px-3 py-3 text-right">
												<span className="font-mono text-xs text-muted-foreground">
													{fmtINR(s.priceINR)}
												</span>
											</td>

											{/* Change */}
											<td className="px-3 py-3 text-right">
												<div className={`flex flex-col items-end ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
													<div className="flex items-center gap-0.5 text-xs font-semibold">
														{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
														{up ? "+" : ""}{fmt(s.changePercent)}%
													</div>
													<span className="text-[10px] font-mono opacity-80">
														{up ? "+" : ""}{fmt(s.change)}
													</span>
												</div>
											</td>

											{/* High */}
											<td className="px-3 py-3 text-right hidden md:table-cell">
												<span className="font-mono text-xs text-muted-foreground">{s.high ? `$${fmt(s.high)}` : "—"}</span>
											</td>

											{/* Low */}
											<td className="px-3 py-3 text-right hidden md:table-cell">
												<span className="font-mono text-xs text-muted-foreground">{s.low ? `$${fmt(s.low)}` : "—"}</span>
											</td>

											{/* Volume */}
											<td className="px-3 py-3 text-right hidden lg:table-cell">
												<span className="font-mono text-xs text-muted-foreground">{fmtVol(s.volume)}</span>
											</td>

											{/* VWAP */}
											<td className="px-3 py-3 text-right hidden lg:table-cell">
												<span className="font-mono text-xs text-muted-foreground">{s.vwap ? `$${fmt(s.vwap)}` : "—"}</span>
											</td>
										</tr>
									);
								})}
						</tbody>
					</table>
				</div>

				{/* Empty state */}
				{!isLoading && stocks.length === 0 && (
					<div className="py-16 text-center">
						<BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
						<p className="text-sm text-muted-foreground">No stocks found for "{search}"</p>
					</div>
				)}
			</div>

			{/* ── Pagination ── */}
			{pagination && pagination.pages > 1 && (
				<div className="flex items-center justify-between text-xs text-muted-foreground">
					<span>
						Showing {(pagination.page - 1) * pagination.limit + 1}–
						{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
					</span>
					<div className="flex items-center gap-2">
						<Button
							size="icon"
							variant="outline"
							className="h-7 w-7"
							disabled={page <= 1 || isFetching}
							onClick={() => setPage((p) => p - 1)}
						>
							<ChevronLeft className="h-3.5 w-3.5" />
						</Button>
						<span className="min-w-[60px] text-center">
							{pagination.page} / {pagination.pages}
						</span>
						<Button
							size="icon"
							variant="outline"
							className="h-7 w-7"
							disabled={page >= pagination.pages || isFetching}
							onClick={() => setPage((p) => p + 1)}
						>
							<ChevronRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* ── Disclaimer ── */}
			<div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/40 px-4 py-3 text-[11px] text-muted-foreground">
				<Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
				<span>
					Prices sourced from Alpaca IEX feed (15-min delayed during market hours). INR conversion at live USD/INR rate.
					Constituent lists reflect NASDAQ-100 and S&amp;P 500 top 50 holdings. Not investment advice.
					Market data subject to availability.
				</span>
			</div>
		</div>
	);
}
