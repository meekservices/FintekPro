import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	AlertTriangle,
	TrendingUp,
	Building2,
	ChevronDown,
	ChevronRight,
	RefreshCw,
	Info,
	ShieldAlert,
	PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioFund {
	mfIsin?: string;
	isin?: string;
	name?: string;
	schemeName?: string;
	portfolioWeight?: number;
	weight?: number;
	currentValue?: number;
	value?: number;
}

interface StockOverlap {
	stock: string;
	stockIsin?: string;
	sector?: string;
	fundCount: number;
	totalExposure: number;
	riskFlag: "HIGH" | "MEDIUM" | "LOW";
	funds: Array<{
		isin: string;
		name: string;
		contribution: number;
		portfolioWeight: number;
	}>;
}

interface SectorConcentration {
	sector: string;
	exposure: number;
	stockCount: number;
	topStocks: string[];
	riskFlag: "HIGH" | "MEDIUM" | "LOW";
}

interface IntersectionAnalysisResult {
	totalFundsAnalyzed: number;
	totalStocksFound: number;
	overlappingStocksCount: number;
	highRiskStocksCount: number;
	mediumRiskStocksCount: number;
	stockOverlaps: StockOverlap[];
	sectorConcentration: SectorConcentration[];
	diversificationScore: number;
	topOverlappingStocks: StockOverlap[];
	warnings: string[];
}

interface StockOverlapAnalysisProps {
	holdings: PortfolioFund[];
	prospectId?: string;
	userId?: string;
	onAnalysisComplete?: (result: IntersectionAnalysisResult) => void;
}

const RiskBadge = ({ risk }: { risk: "HIGH" | "MEDIUM" | "LOW" }) => {
	const config = {
		HIGH: {
			color:
				"bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
			icon: AlertTriangle,
		},
		MEDIUM: {
			color:
				"bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
			icon: ShieldAlert,
		},
		LOW: {
			color:
				"bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
			icon: TrendingUp,
		},
	};
	const { color, icon: Icon } = config[risk];
	return (
		<Badge variant="outline" className={cn("gap-1", color)}>
			<Icon className="h-3 w-3" />
			{risk}
		</Badge>
	);
};

const StockOverlapRow = ({ overlap }: { overlap: StockOverlap }) => {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
			<CollapsibleTrigger asChild>
				<div className="flex items-center justify-between py-3 px-4 hover:bg-muted/50 cursor-pointer border-b border-border/50 transition-colors">
					<div className="flex items-center gap-3 flex-1">
						<Button variant="ghost" size="icon" className="h-6 w-6 p-0">
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</Button>
						<div className="flex-1">
							<div className="font-medium text-sm">{overlap.stock}</div>
							{overlap.sector && (
								<div className="text-xs text-muted-foreground">
									{overlap.sector}
								</div>
							)}
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="text-right">
							<div className="font-semibold text-sm">
								{overlap.totalExposure.toFixed(2)}%
							</div>
							<div className="text-xs text-muted-foreground">
								{overlap.fundCount} funds
							</div>
						</div>
						<RiskBadge risk={overlap.riskFlag} />
					</div>
				</div>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="bg-muted/30 px-12 py-3 border-b border-border/50">
					<div className="text-xs font-medium text-muted-foreground mb-2">
						Fund Contribution Breakdown
					</div>
					<div className="space-y-2">
						{overlap.funds.map((fund, idx) => (
							<div
								key={idx}
								className="flex items-center justify-between text-sm"
							>
								<span className="text-muted-foreground truncate max-w-[60%]">
									{fund.name}
								</span>
								<div className="flex items-center gap-3">
									<span className="text-xs text-muted-foreground">
										({fund.portfolioWeight.toFixed(1)}% weight)
									</span>
									<span className="font-medium">
										{fund.contribution.toFixed(2)}%
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
};

const SectorChart = ({ sectors }: { sectors: SectorConcentration[] }) => {
	const colors = [
		"bg-blue-500",
		"bg-emerald-500",
		"bg-amber-500",
		"bg-purple-500",
		"bg-rose-500",
		"bg-cyan-500",
		"bg-orange-500",
		"bg-indigo-500",
	];

	const totalExposure = sectors.reduce((sum, s) => sum + s.exposure, 0);

	return (
		<div className="space-y-3">
			<div className="flex h-4 rounded-full overflow-hidden bg-muted">
				{sectors.slice(0, 8).map((sector, idx) => (
					<div
						key={sector.sector}
						className={cn(colors[idx % colors.length], "transition-all")}
						style={{
							width: `${(sector.exposure / Math.max(totalExposure, 100)) * 100}%`,
						}}
						title={`${sector.sector}: ${sector.exposure.toFixed(1)}%`}
					/>
				))}
			</div>
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
				{sectors.slice(0, 8).map((sector, idx) => (
					<div key={sector.sector} className="flex items-center gap-2 text-xs">
						<div
							className={cn(
								"w-2.5 h-2.5 rounded-full",
								colors[idx % colors.length],
							)}
						/>
						<span className="truncate">{sector.sector}</span>
						<span className="font-medium ml-auto">
							{sector.exposure.toFixed(1)}%
						</span>
					</div>
				))}
			</div>
		</div>
	);
};

export function StockOverlapAnalysis({
	holdings,
	prospectId,
	userId,
	onAnalysisComplete,
}: StockOverlapAnalysisProps) {
	const funds = useMemo(() => {
		return holdings.map((h) => ({
			mfIsin: h.mfIsin || h.isin || "",
			name: h.name || h.schemeName || "Unknown Fund",
			portfolioWeight: h.portfolioWeight || h.weight || 0,
			currentValue: h.currentValue || h.value,
		}));
	}, [holdings]);

	const {
		data: analysis,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery<IntersectionAnalysisResult>({
		queryKey: [
			"/api/stock-intersection/analyze",
			funds.map((f) => f.mfIsin).join(","),
		],
		queryFn: async () => {
			const response = await fetch("/api/stock-intersection/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					funds,
					prospectId,
					userId,
					saveResult: true,
				}),
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.error);
			if (onAnalysisComplete) onAnalysisComplete(result.data);
			return result.data;
		},
		enabled: funds.length > 0 && funds.some((f) => f.mfIsin),
		staleTime: 5 * 60 * 1000,
	});

	if (funds.length === 0 || !funds.some((f) => f.mfIsin)) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5 text-primary" />
						Stock Overlap Analysis
					</CardTitle>
					<CardDescription>
						Import portfolio holdings to analyze stock overlap across mutual
						funds
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
						<Info className="h-5 w-5 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							No mutual fund holdings found with ISIN data. Import holdings to
							enable overlap analysis.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5 text-primary" />
						Stock Overlap Analysis
					</CardTitle>
					<CardDescription>
						Analyzing stock holdings across {funds.length} mutual funds...
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-40 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (error || !analysis) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<PieChart className="h-5 w-5 text-primary" />
						Stock Overlap Analysis
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
						<div className="flex items-center gap-3">
							<AlertTriangle className="h-5 w-5 text-red-500" />
							<p className="text-sm text-red-600 dark:text-red-400">
								Failed to analyze stock overlap. Holdings data may be
								unavailable.
							</p>
						</div>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	const scoreColor =
		analysis.diversificationScore >= 70
			? "text-green-600"
			: analysis.diversificationScore >= 40
				? "text-amber-600"
				: "text-red-600";

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<PieChart className="h-5 w-5 text-primary" />
							Stock Overlap Analysis
						</CardTitle>
						<CardDescription>
							Analyzing {analysis.totalFundsAnalyzed} funds with{" "}
							{analysis.totalStocksFound} unique stocks
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")}
						/>
						Refresh
					</Button>
				</div>
			</CardHeader>

			<CardContent className="space-y-6">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div className="bg-muted/50 rounded-lg p-4 text-center">
						<div className={cn("text-3xl font-bold", scoreColor)}>
							{analysis.diversificationScore}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							Diversification Score
						</div>
					</div>
					<div className="bg-muted/50 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold">
							{analysis.overlappingStocksCount}
						</div>
						<div className="text-xs text-muted-foreground mt-1">
							Overlapping Stocks
						</div>
					</div>
					<div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-red-600">
							{analysis.highRiskStocksCount}
						</div>
						<div className="text-xs text-red-600/80 mt-1">High Risk Stocks</div>
					</div>
					<div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 text-center">
						<div className="text-3xl font-bold text-amber-600">
							{analysis.mediumRiskStocksCount}
						</div>
						<div className="text-xs text-amber-600/80 mt-1">
							Medium Risk Stocks
						</div>
					</div>
				</div>

				{analysis.warnings.length > 0 && (
					<div className="space-y-2">
						{analysis.warnings.map((warning, idx) => (
							<div
								key={idx}
								className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg"
							>
								<AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
								<p className="text-sm text-amber-700 dark:text-amber-300">
									{warning}
								</p>
							</div>
						))}
					</div>
				)}

				{analysis.sectorConcentration.length > 0 && (
					<div>
						<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
							<Building2 className="h-4 w-4" />
							Sector Concentration (Overlapping Stocks Only)
						</h4>
						<SectorChart sectors={analysis.sectorConcentration} />
					</div>
				)}

				{analysis.stockOverlaps.length > 0 && (
					<div>
						<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
							<TrendingUp className="h-4 w-4" />
							Top Overlapping Stocks ({analysis.stockOverlaps.length} total)
						</h4>
						<div className="border rounded-lg overflow-hidden">
							<div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground flex items-center justify-between border-b">
								<span>Stock / Sector</span>
								<span>Exposure / Risk</span>
							</div>
							{analysis.topOverlappingStocks.slice(0, 10).map((overlap) => (
								<StockOverlapRow key={overlap.stock} overlap={overlap} />
							))}
							{analysis.stockOverlaps.length > 10 && (
								<div className="px-4 py-2 text-xs text-center text-muted-foreground bg-muted/30">
									+{analysis.stockOverlaps.length - 10} more overlapping stocks
								</div>
							)}
						</div>
					</div>
				)}

				{analysis.overlappingStocksCount === 0 && (
					<div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
						<TrendingUp className="h-5 w-5 text-green-500" />
						<p className="text-sm text-green-700 dark:text-green-300">
							Excellent! No significant stock overlap detected across your
							mutual funds.
						</p>
					</div>
				)}

				{(analysis.highRiskStocksCount > 0 ||
					analysis.mediumRiskStocksCount > 0) && (
					<div className="mt-4 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
						<div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
							<h4 className="text-sm font-medium flex items-center gap-2 text-amber-800 dark:text-amber-200">
								<ShieldAlert className="h-4 w-4" />
								Rebalancing Insights
							</h4>
						</div>
						<div className="p-4 space-y-3 bg-card">
							{analysis.highRiskStocksCount > 0 && (
								<div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
									<AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-medium text-red-700 dark:text-red-300">
											High Concentration Alert
										</p>
										<p className="text-xs text-red-600 dark:text-red-400 mt-1">
											{analysis.highRiskStocksCount} stock(s) have &gt;10%
											exposure across your funds. Consider reducing positions in
											overlapping funds to lower concentration risk.
										</p>
										<div className="flex flex-wrap gap-1 mt-2">
											{analysis.stockOverlaps
												.filter((s) => s.riskFlag === "HIGH")
												.slice(0, 5)
												.map((s) => (
													<Badge
														key={s.stock}
														variant="outline"
														className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
													>
														{s.stock}: {s.totalExposure.toFixed(1)}%
													</Badge>
												))}
										</div>
									</div>
								</div>
							)}
							{analysis.mediumRiskStocksCount > 0 && (
								<div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
									<ShieldAlert className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-medium text-amber-700 dark:text-amber-300">
											Moderate Concentration Notice
										</p>
										<p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
											{analysis.mediumRiskStocksCount} stock(s) have 5-10%
											exposure. Monitor these positions during portfolio
											rebalancing.
										</p>
										<div className="flex flex-wrap gap-1 mt-2">
											{analysis.stockOverlaps
												.filter((s) => s.riskFlag === "MEDIUM")
												.slice(0, 5)
												.map((s) => (
													<Badge
														key={s.stock}
														variant="outline"
														className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
													>
														{s.stock}: {s.totalExposure.toFixed(1)}%
													</Badge>
												))}
										</div>
									</div>
								</div>
							)}
							{analysis.sectorConcentration.filter((s) => s.riskFlag === "HIGH")
								.length > 0 && (
								<div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
									<Building2 className="h-5 w-5 text-purple-500 flex-shrink-0 mt-0.5" />
									<div>
										<p className="text-sm font-medium text-purple-700 dark:text-purple-300">
											Sector Concentration Alert
										</p>
										<p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
											Consider diversifying into underweight sectors to reduce
											sector-specific risk.
										</p>
										<div className="flex flex-wrap gap-1 mt-2">
											{analysis.sectorConcentration
												.filter((s) => s.riskFlag === "HIGH")
												.map((s) => (
													<Badge
														key={s.sector}
														variant="outline"
														className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
													>
														{s.sector}: {s.exposure.toFixed(1)}%
													</Badge>
												))}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default StockOverlapAnalysis;
