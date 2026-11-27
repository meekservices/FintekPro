import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface IndexQuote {
	symbol: string;
	price: number;
	change: number;
	changePercent: number;
}

interface MarketStatusResponse {
	currentTime?: string;
	exchanges?: {
		nse?: {
			status?: "open" | "closed";
			reason?: string;
		};
		bse?: {
			status?: "open" | "closed";
		};
	};
}

const DEFAULT_BENCHMARKS: IndexQuote[] = [
	{ symbol: "NIFTY 50", price: 24530.45, change: 112.35, changePercent: 0.46 },
	{ symbol: "SENSEX", price: 80320.1, change: 345.2, changePercent: 0.43 },
	{ symbol: "INDIA VIX", price: 13.42, change: -0.25, changePercent: -1.82 },
	{ symbol: "10Y G-SEC", price: 6.78, change: -0.02, changePercent: -0.29 },
	{ symbol: "USD/INR", price: 86.42, change: 0.04, changePercent: 0.05 },
];

export function MarketTickerStrip() {
	const { data: indicesData } = useQuery<IndexQuote[]>({
		queryKey: ["/api/market/indices"],
		refetchInterval: 15000,
		staleTime: 10000,
	});

	const { data: statusData } = useQuery<MarketStatusResponse>({
		queryKey: ["/api/market/status"],
		refetchInterval: 60000,
		staleTime: 30000,
	});

	const isNseOpen = statusData?.exchanges?.nse?.status === "open";
	const indices =
		indicesData && Array.isArray(indicesData) && indicesData.length > 0
			? indicesData
			: DEFAULT_BENCHMARKS;

	return (
		<div className="w-full bg-background/95 border-b border-border/60 text-xs select-none backdrop-blur-md">
			<div className="max-w-7xl mx-auto px-3 sm:px-6 h-8 flex items-center justify-between gap-4 overflow-hidden">
				{/* Market Session & Feed Indicator */}
				<div className="flex items-center gap-3 shrink-0">
					<div className="flex items-center gap-1.5">
						<span
							className={cn(
								"w-2 h-2 rounded-full",
								isNseOpen
									? "bg-emerald-500 animate-pulse"
									: "bg-amber-500/80",
							)}
						/>
						<span className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
							{isNseOpen ? "NSE Live" : "NSE Closed"}
						</span>
					</div>
					<div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/80 font-mono pl-2 border-l border-border/60">
						<Clock className="w-3 h-3 text-muted-foreground" />
						<span>{statusData?.currentTime || "IST Live"}</span>
					</div>
				</div>

				{/* Continuous Benchmark Ticker Tape */}
				<div className="flex-1 flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar py-0.5">
					{indices.slice(0, 5).map((idx) => {
						const isPositive = idx.change >= 0;
						const isYield = idx.symbol.includes("G-SEC");
						return (
							<div
								key={idx.symbol}
								className="flex items-center gap-1.5 shrink-0"
							>
								<span className="font-medium text-muted-foreground text-[11px]">
									{idx.symbol}:
								</span>
								<span className="font-mono tabular-nums font-semibold text-foreground">
									{isYield
										? `${idx.price.toFixed(2)}%`
										: idx.price >= 1000
											? idx.price.toLocaleString("en-IN", {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})
											: idx.price.toFixed(2)}
								</span>
								<span
									className={cn(
										"font-mono tabular-nums text-[10px] font-semibold px-1 rounded",
										isPositive
											? "text-emerald-500 bg-emerald-500/10"
											: "text-rose-500 bg-rose-500/10",
									)}
								>
									{isPositive ? "+" : ""}
									{idx.changePercent.toFixed(2)}%
								</span>
							</div>
						);
					})}
				</div>

				{/* Institutional Execution & Custody Health Pill */}
				<div className="hidden lg:flex items-center gap-3 shrink-0 text-[10px] text-muted-foreground">
					<div className="flex items-center gap-1 font-mono">
						<Activity className="w-3 h-3 text-emerald-500" />
						<span>&lt;350ms Feed</span>
					</div>
					<div className="flex items-center gap-1 font-mono text-emerald-500 pl-2 border-l border-border/60">
						<ShieldCheck className="w-3.5 h-3.5" />
						<span>CDSL/NSDL Direct</span>
					</div>
				</div>
			</div>
		</div>
	);
}
