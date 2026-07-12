import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
	Filter,
	Search,
	Save,
	Play,
	TrendingUp,
	TrendingDown,
	Percent,
	IndianRupee,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	Star,
	BarChart3,
	RefreshCw,
	ChevronLeft,
	ChevronRight,
	Database,
	Loader2,
	Activity,
	PieChart,
	Target,
	Shield as LucideShield,
	Zap,
	Eye,
	X,
	SlidersHorizontal,
	Download,
	LayoutGrid,
	List,
	Info,
	Building2,
	Sparkles,
	Settings,
	Clock,
	AlertTriangle,
	CheckCircle2,
	Calculator,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { SectorDistributionPanel } from "@/components/screener/SectorDistributionPanel";

type ScreenerType = "mutual_fund" | "stock" | "bond" | "etf";
type ViewMode = "table" | "cards";

interface ScreenerCriteria {
	field: string;
	operator: string;
	value: string;
}

type SortDirection = "asc" | "desc" | null;
interface SortConfig {
	key: string;
	direction: SortDirection;
}

function formatNum(
	val: string | number | null | undefined,
	decimals = 2,
): string {
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
	if (Number.isNaN(n)) return "-";
	if (n >= 1000000) return `₹${(n / 100000).toFixed(1)}L Cr`;
	if (n >= 10000) return `₹${(n / 1000).toFixed(1)}K Cr`;
	if (n >= 100) return `₹${n.toFixed(0)} Cr`;
	return `₹${n.toFixed(2)} Cr`;
}

function formatPercent(
	val: string | number | null | undefined,
	multiplier = 1,
): string {
	if (val == null || val === "") return "-";
	const n = typeof val === "string" ? Number.parseFloat(val) : val;
	if (Number.isNaN(n)) return "-";
	return `${(n * multiplier).toFixed(1)}%`;
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
	if (Number.isNaN(n))
		return <span className="text-muted-foreground text-xs">-</span>;
	const color =
		n >= 70
			? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
			: n >= 45
				? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
				: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${color}`}
					>
						{n.toFixed(0)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="top">
					<p className="text-xs">
						{label}: {n.toFixed(1)}/100
					</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function ScoreBreakdownTooltip({ stock }: { stock: any }) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="cursor-help">
						<ScoreBadge score={stock.compositeScore} label="Composite" />
					</div>
				</TooltipTrigger>
				<TooltipContent side="left" className="w-56 p-3">
					<div className="space-y-2">
						<p className="font-semibold text-xs border-b pb-1">
							Score Breakdown
						</p>
						<div className="space-y-1.5">
							{[
								{
									label: "Growth",
									score: stock.growthScore,
									icon: TrendingUp,
									weight: "25%",
									color: "text-blue-500",
								},
								{
									label: "Quality",
									score: stock.qualityScore,
									icon: Sparkles,
									weight: "30%",
									color: "text-purple-500",
								},
								{
									label: "Value",
									score: stock.valueScore,
									icon: Target,
									weight: "25%",
									color: "text-emerald-500",
								},
								{
									label: "Risk",
									score: stock.riskScore,
									icon: LucideShield,
									weight: "20%",
									color: "text-orange-500",
								},
							].map(({ label, score, icon: Icon, weight, color }) => {
								const s = Number.parseFloat(score || "0");
								return (
									<div key={label} className="flex items-center gap-2 text-xs">
										<Icon className={`h-3 w-3 ${color}`} />
										<span className="flex-1">{label}</span>
										<span className="text-muted-foreground">{weight}</span>
										<div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
											<div
												className={`h-full rounded-full ${s >= 70 ? "bg-emerald-500" : s >= 45 ? "bg-amber-500" : "bg-red-500"}`}
												style={{ width: `${s}%` }}
											/>
										</div>
										<span className="w-8 text-right font-mono">
											{s.toFixed(0)}
										</span>
									</div>
								);
							})}
						</div>
						<Separator />
						<div className="flex items-center justify-between text-xs font-semibold">
							<span>Composite</span>
							<span>
								{Number.parseFloat(stock.compositeScore || "0").toFixed(1)}
							</span>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function MarketCapBadge({ category }: { category: string | null }) {
	if (!category) return null;
	const colors: Record<string, string> = {
		mega: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
		"Mega Cap":
			"bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
		large: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		"Large Cap":
			"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
		mid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
		"Mid Cap":
			"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
		small:
			"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
		"Small Cap":
			"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
		micro: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
		"Micro Cap": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
	};
	const displayName = category.includes("Cap")
		? category
		: `${category.charAt(0).toUpperCase() + category.slice(1)} Cap`;
	return (
		<Badge
			className={`text-[10px] font-medium border-0 ${colors[category] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
		>
			{displayName}
		</Badge>
	);
}

function DistributionBar({
	data,
	colorMap,
}: {
	data: {
		category?: string;
		sector?: string;
		rating?: number;
		range?: string;
		count: number | string;
	}[];
	colorMap: Record<string, string>;
}) {
	const total = data.reduce((sum, d) => sum + Number(d.count), 0);
	if (total === 0) return null;
	return (
		<div className="flex h-3 rounded-full overflow-hidden gap-0.5">
			{data.map((d, i) => {
				const key =
					d.category || d.sector || String(d.rating) || d.range || String(i);
				const pct = (Number(d.count) / total) * 100;
				if (pct < 1) return null;
				return (
					<TooltipProvider key={key}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={`${colorMap[key] || "bg-gray-400"} rounded-sm transition-all hover:opacity-80`}
									style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : 0 }}
								/>
							</TooltipTrigger>
							<TooltipContent>
								<p className="text-xs">
									{key}: {Number(d.count).toLocaleString()} ({pct.toFixed(1)}%)
								</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				);
			})}
		</div>
	);
}

const MARKET_CAP_COLORS: Record<string, string> = {
	"Large Cap": "bg-blue-500",
	"Mid Cap": "bg-emerald-500",
	"Small Cap": "bg-amber-500",
	Unknown: "bg-gray-400",
	large: "bg-blue-500",
	mid: "bg-emerald-500",
	small: "bg-amber-500",
};

const RATING_COLORS: Record<string, string> = {
	"5": "bg-emerald-500",
	"4": "bg-blue-500",
	"3": "bg-amber-500",
	"2": "bg-orange-500",
	"1": "bg-red-500",
};

const SCORE_COLORS: Record<string, string> = {
	"75-100": "bg-emerald-500",
	"60-75":  "bg-blue-500",
	"40-60":  "bg-amber-500",
	"20-40":  "bg-orange-500",
	"0-20":   "bg-red-500",
};

export default function AgentScreener() {
	const { toast } = useToast();
	const [screenerType, setScreenerType] = useState<ScreenerType>("stock");
	const [criteria, setCriteria] = useState<ScreenerCriteria[]>([
		{ field: "", operator: ">=", value: "" },
	]);
	const [screenerName, setScreenerName] = useState("");
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		key: "",
		direction: null,
	});
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	const [showFilters, setShowFilters] = useState(true);
	const [expandedStock, setExpandedStock] = useState<string | null>(null);

	const [dbSearch, setDbSearch] = useState(() => {
		const params = new URLSearchParams(window.location.search);
		return (
			params.get("symbol") || params.get("isin") || params.get("search") || ""
		);
	});
	const [dbSector, setDbSector] = useState("");
	const [dbMarketCap, setDbMarketCap] = useState("");
	const [dbMinPE, setDbMinPE] = useState("");
	const [dbMaxPE, setDbMaxPE] = useState("");
	const [dbMinROE, setDbMinROE] = useState("");
	const [dbMaxDE, setDbMaxDE] = useState("");
	const [dbMinRating, setDbMinRating] = useState("");
	const [dbMinScore, setDbMinScore] = useState("");
	const [dbSortBy, setDbSortBy] = useState("compositeScore");
	const [dbSortOrder, setDbSortOrder] = useState<"asc" | "desc">("desc");
	const [dbPage, setDbPage] = useState(1);
	const dbLimit = 25;

	// ── MF filter state ───────────────────────────────────────────────────────
	const [mfCategory, setMfCategory] = useState("");
	const [mfFundHouse, setMfFundHouse] = useState("");
	const [mfRiskLevel, setMfRiskLevel] = useState("");
	const [mfMinReturn1y, setMfMinReturn1y] = useState("");
	const [mfMinReturn3y, setMfMinReturn3y] = useState("");
	const [mfMaxExpenseRatio, setMfMaxExpenseRatio] = useState("");
	const [mfMinAum, setMfMinAum] = useState("");
	const [mfSearch, setMfSearch] = useState("");
	const [mfPage, setMfPage] = useState(1);
	const [mfSortBy, setMfSortBy] = useState("returns1y");
	const [mfSortOrder, setMfSortOrder] = useState<"asc" | "desc">("desc");

	// ── Bond filter state ─────────────────────────────────────────────────────
	const [bondType, setBondType] = useState("all");
	const [bondMinYield, setBondMinYield] = useState("");
	const [bondMaxMaturityYears, setBondMaxMaturityYears] = useState("");
	const [bondMinRating, setBondMinRating] = useState("");
	const [bondTaxStatus, setBondTaxStatus] = useState("all");
	const [bondPage, setBondPage] = useState(1);

	// ── ETF filter state ──────────────────────────────────────────────────────
	const [etfCategory, setEtfCategory] = useState("all");
	const [etfSearch, setEtfSearch] = useState("");
	const [etfPage, setEtfPage] = useState(1);

	const buildQueryParams = () => {
		const params = new URLSearchParams();
		params.set("page", String(dbPage));
		params.set("limit", String(dbLimit));
		if (dbSearch) params.set("search", dbSearch);
		if (dbSector) params.set("sector", dbSector);
		if (dbMarketCap) params.set("marketCapCategory", dbMarketCap);
		if (dbMinPE) params.set("minPE", dbMinPE);
		if (dbMaxPE) params.set("maxPE", dbMaxPE);
		if (dbMinROE) params.set("minROE", dbMinROE);
		if (dbMaxDE) params.set("maxDebtToEquity", dbMaxDE);
		if (dbMinRating) params.set("minFintekRating", dbMinRating);
		if (dbMinScore) params.set("minCompositeScore", dbMinScore);
		if (dbSortBy) params.set("sortBy", dbSortBy);
		params.set("sortOrder", dbSortOrder);
		return params.toString();
	};

	const isNonStockType = screenerType !== "stock";

	const { data: dbScreenerData, isLoading: dbLoading } = useQuery<any>({
		queryKey: [
			"/api/screener/stocks",
			dbPage,
			dbSearch,
			dbSector,
			dbMarketCap,
			dbMinPE,
			dbMaxPE,
			dbMinROE,
			dbMaxDE,
			dbMinRating,
			dbMinScore,
			dbSortBy,
			dbSortOrder,
		],
		enabled: !isNonStockType,
		queryFn: () =>
			fetch(`/api/screener/stocks?${buildQueryParams()}`, {
				credentials: "include",
			}).then((r) => {
				if (!r.ok) throw new Error("Failed to fetch screener data");
				return r.json();
			}),
	});

	// ── Instrument screener query (MF / Bond / ETF) ───────────────────────────
	const buildInstrumentParams = () => {
		const p = new URLSearchParams();
		p.set("type", screenerType);
		p.set("limit", "25");
		if (screenerType === "mutual_fund") {
			p.set("page", String(mfPage));
			p.set("sortBy", mfSortBy);
			p.set("sortOrder", mfSortOrder);
			if (mfSearch)           p.set("q", mfSearch);
			if (mfCategory)         p.set("category", mfCategory);
			if (mfFundHouse)        p.set("fundHouse", mfFundHouse);
			if (mfRiskLevel)        p.set("riskLevel", mfRiskLevel);
			if (mfMinReturn1y)      p.set("minReturn1y", mfMinReturn1y);
			if (mfMinReturn3y)      p.set("minReturn3y", mfMinReturn3y);
			if (mfMaxExpenseRatio)  p.set("maxExpenseRatio", mfMaxExpenseRatio);
			if (mfMinAum)           p.set("minAum", mfMinAum);
		} else if (screenerType === "bond") {
			p.set("page", String(bondPage));
			p.set("bondType", bondType);
			if (bondMinYield)           p.set("minYield", bondMinYield);
			if (bondMaxMaturityYears)   p.set("maxMaturityYears", bondMaxMaturityYears);
			if (bondMinRating)          p.set("minRating", bondMinRating);
			if (bondTaxStatus !== "all") p.set("taxStatus", bondTaxStatus);
		} else if (screenerType === "etf") {
			p.set("page", String(etfPage));
			if (etfSearch)                 p.set("q", etfSearch);
			if (etfCategory !== "all")     p.set("etfCategory", etfCategory);
		}
		return p.toString();
	};

	const { data: instrumentData, isLoading: instrumentLoading } = useQuery<any>({
		queryKey: [
			"/api/screener/instruments",
			screenerType, mfPage, mfCategory, mfFundHouse, mfRiskLevel, mfSearch,
			mfMinReturn1y, mfMinReturn3y, mfMaxExpenseRatio, mfMinAum, mfSortBy, mfSortOrder,
			bondPage, bondType, bondMinYield, bondMaxMaturityYears, bondMinRating, bondTaxStatus,
			etfPage, etfCategory, etfSearch,
		],
		enabled: isNonStockType,
		queryFn: () =>
			fetch(`/api/screener/instruments?${buildInstrumentParams()}`, {
				credentials: "include",
			}).then((r) => {
				if (!r.ok) throw new Error(`Failed to fetch ${screenerType} screener`);
				return r.json();
			}),
	});


	const { data: screenerStats } = useQuery<any>({
		queryKey: ["/api/screener/stats"],
	});

	const { data: distribution } = useQuery<any>({
		queryKey: ["/api/screener/distribution"],
		staleTime: 5 * 60 * 1000,
	});

	const { data: stockDetail, isLoading: detailLoading } = useQuery<any>({
		queryKey: ["/api/screener/stocks", expandedStock],
		enabled: !!expandedStock,
	});

	const { data: enrichmentProgress, refetch: refetchProgress } = useQuery<any>({
		queryKey: ["/api/screener/admin/extended-progress"],
		staleTime: 30000,
	});

	const seedFromDbMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/seed-from-db", {
				method: "POST",
				body: JSON.stringify({ limit: 500 }),
			}),
		onSuccess: (data: any) => {
			toast({
				title: "Seeding complete",
				description: `Seeded ${data.processed} stocks from listed stocks database`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stocks"] });
			refetchProgress();
		},
		onError: () => toast({ title: "Seed failed", variant: "destructive" }),
	});

	const seedUnlistedMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/seed-unlisted", {
				method: "POST",
				body: JSON.stringify({ limit: 200 }),
			}),
		onSuccess: (data: any) => {
			toast({
				title: "Unlisted seeding complete",
				description: `Seeded ${data.processed} unlisted/private companies`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			refetchProgress();
		},
		onError: () =>
			toast({ title: "Unlisted seed failed", variant: "destructive" }),
	});

	const enrichRatiosMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/enrich/ratios", {
				method: "POST",
				body: JSON.stringify({ batchSize: 10, force: true }),
			}),
		onSuccess: (data: any) => {
			toast({
				title: "Ratios enrichment complete",
				description: `${data.processed} stocks enriched, ${data.remaining} API calls remaining`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stocks"] });
			refetchProgress();
		},
		onError: () =>
			toast({ title: "Enrichment failed", variant: "destructive" }),
	});

	const enrichPricesMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/enrich/prices", {
				method: "POST",
				body: JSON.stringify({ batchSize: 5, force: true }),
			}),
		onSuccess: (data: any) => {
			toast({
				title: "Price history enrichment complete",
				description: `${data.processed} stocks enriched with price history & returns`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			refetchProgress();
		},
		onError: () =>
			toast({ title: "Price enrichment failed", variant: "destructive" }),
	});

	const dailyBatchMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/enrich/daily-batch", {
				method: "POST",
				body: JSON.stringify({ force: true }),
			}),
		onSuccess: (data: any) => {
			toast({
				title: "Daily batch complete",
				description: `${data.totalApiCalls} API calls used. Ratios: ${data.ratios?.processed}, Prices: ${data.prices?.processed}`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stocks"] });
			refetchProgress();
		},
		onError: () =>
			toast({ title: "Daily batch failed", variant: "destructive" }),
	});

	const recalcMetricsMutation = useMutation({
		mutationFn: async () =>
			apiRequest("/api/screener/admin/recalculate-metrics", { method: "POST" }),
		onSuccess: (data: any) => {
			toast({
				title: "Metrics recalculated",
				description: `${data.processed} stocks rescored with latest financial data`,
			});
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stats"] });
			queryClient.invalidateQueries({ queryKey: ["/api/screener/stocks"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/screener/distribution"],
			});
			refetchProgress();
		},
		onError: () =>
			toast({ title: "Recalculation failed", variant: "destructive" }),
	});

	const enrichTier1Mutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/screener/admin/enrich/tier/1", {
				force: true,
				budget: 20,
			}),
		onSuccess: () => {
			toast({ title: "Tier 1 enrichment started" });
			refetchProgress();
		},
	});
	const enrichTier2Mutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/screener/admin/enrich/tier/2", {
				force: true,
				budget: 15,
			}),
		onSuccess: () => {
			toast({ title: "Tier 2 enrichment started" });
			refetchProgress();
		},
	});
	const enrichTier3Mutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/screener/admin/enrich/tier/3", {
				force: true,
				budget: 10,
			}),
		onSuccess: () => {
			toast({ title: "Tier 3 enrichment started" });
			refetchProgress();
		},
	});
	const enrichTier4Mutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/screener/admin/enrich/tier/4", {
				force: true,
				budget: 10,
			}),
		onSuccess: () => {
			toast({ title: "Tier 4 enrichment started" });
			refetchProgress();
		},
	});
	const priorityBatchMutation = useMutation({
		mutationFn: () =>
			apiRequest("POST", "/api/screener/admin/enrich/priority-batch", {
				force: true,
				maxApiCalls: 240,
			}),
		onSuccess: () => {
			toast({ title: "Priority batch enrichment complete" });
			refetchProgress();
		},
	});

	const isAnyMutationPending =
		seedFromDbMutation.isPending ||
		seedUnlistedMutation.isPending ||
		enrichRatiosMutation.isPending ||
		enrichPricesMutation.isPending ||
		dailyBatchMutation.isPending ||
		recalcMetricsMutation.isPending ||
		enrichTier1Mutation.isPending ||
		enrichTier2Mutation.isPending ||
		enrichTier3Mutation.isPending ||
		enrichTier4Mutation.isPending ||
		priorityBatchMutation.isPending;

	const mfFields = [
		{ value: "returns_1y", label: "1Y Returns (%)" },
		{ value: "returns_3y", label: "3Y Returns (%)" },
		{ value: "returns_5y", label: "5Y Returns (%)" },
		{ value: "expense_ratio", label: "Expense Ratio (%)" },
		{ value: "aum", label: "AUM (Cr)" },
		{ value: "nav", label: "NAV" },
	];

	const stockFields = [
		{ value: "market_cap", label: "Market Cap (Cr)" },
		{ value: "pe_ratio", label: "P/E Ratio" },
		{ value: "pb_ratio", label: "P/B Ratio" },
		{ value: "dividend_yield", label: "Dividend Yield (%)" },
		{ value: "roe", label: "ROE (%)" },
		{ value: "debt_equity", label: "Debt/Equity" },
	];

	const operators = [
		{ value: ">=", label: ">=" },
		{ value: "<=", label: "<=" },
		{ value: ">", label: ">" },
		{ value: "<", label: "<" },
		{ value: "=", label: "=" },
	];

	const fields = screenerType === "mutual_fund" ? mfFields : stockFields;

	const addCriteria = () => {
		setCriteria([...criteria, { field: "", operator: ">=", value: "" }]);
	};

	const removeCriteria = (index: number) => {
		setCriteria(criteria.filter((_, i) => i !== index));
	};

	const updateCriteria = (
		index: number,
		key: keyof ScreenerCriteria,
		value: string,
	) => {
		const updated = [...criteria];
		updated[index][key] = value;
		setCriteria(updated);
	};

	const runScreenerMutation = useMutation({
		mutationFn: async () => {
			const filters: Record<string, Record<string, number>> = {};
			criteria.forEach((c) => {
				if (c.field && c.value) {
					filters[c.field] = { [c.operator]: Number.parseFloat(c.value) };
				}
			});
			const universe =
				screenerType === "mutual_fund"
					? "MF"
					: screenerType === "stock"
						? "STOCK"
						: screenerType.toUpperCase();
			return apiRequest("/api/research-lists/screener/run", {
				method: "POST",
				body: JSON.stringify({ universe, filters }),
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Screener executed",
				description: `Found ${data.results?.length || 0} matching instruments`,
			});
		},
		onError: () => {
			toast({
				title: "Screener failed",
				description: "Could not execute screener",
				variant: "destructive",
			});
		},
	});

	const saveScreenerMutation = useMutation({
		mutationFn: async () => {
			const dslCriteria: Record<string, Record<string, number>> = {};
			criteria.forEach((c) => {
				if (c.field && c.value) {
					dslCriteria[c.field] = { [c.operator]: Number.parseFloat(c.value) };
				}
			});
			return apiRequest("/api/research-lists/screeners", {
				method: "POST",
				body: JSON.stringify({
					name: screenerName,
					screenerType,
					criteria: dslCriteria,
				}),
			});
		},
		onSuccess: () => {
			toast({
				title: "Screener saved",
				description: "Your screener has been saved",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists/screeners"],
			});
		},
	});

	const { data: savedScreeners } = useQuery({
		queryKey: ["/api/research-lists/screeners"],
	});

	const handleSort = (key: string) => {
		setSortConfig((prev) => {
			if (prev.key === key) {
				if (prev.direction === "asc") return { key, direction: "desc" };
				if (prev.direction === "desc") return { key: "", direction: null };
				return { key, direction: "asc" };
			}
			return { key, direction: "asc" };
		});
	};

	const sortedResults = useMemo(() => {
		const results = runScreenerMutation.data?.results || [];
		if (!sortConfig.key || !sortConfig.direction) return results;
		return [...results].sort((a: any, b: any) => {
			const aVal = a[sortConfig.key];
			const bVal = b[sortConfig.key];
			const aNull = aVal === null || aVal === undefined || aVal === "";
			const bNull = bVal === null || bVal === undefined || bVal === "";
			if (aNull && bNull) return 0;
			if (aNull) return 1;
			if (bNull) return -1;
			const aNum = Number.parseFloat(aVal);
			const bNum = Number.parseFloat(bVal);
			if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
				return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
			}
			const aStr = String(aVal).toLowerCase();
			const bStr = String(bVal).toLowerCase();
			return sortConfig.direction === "asc"
				? aStr.localeCompare(bStr)
				: bStr.localeCompare(aStr);
		});
	}, [runScreenerMutation.data?.results, sortConfig]);

	const SortableHeader = ({
		label,
		sortKey,
		align = "left",
	}: {
		label: string;
		sortKey: string;
		align?: "left" | "right" | "center";
	}) => {
		const alignClass =
			align === "right"
				? "text-right"
				: align === "center"
					? "text-center"
					: "text-left";
		const justifyClass =
			align === "right"
				? "justify-end"
				: align === "center"
					? "justify-center"
					: "";
		return (
			<th
				className={`${alignClass} py-2.5 px-3 font-medium whitespace-nowrap cursor-pointer hover:bg-muted/70 select-none transition-colors text-xs`}
				onClick={() => handleSort(sortKey)}
			>
				<div className={`flex items-center gap-1 ${justifyClass}`}>
					{label}
					{sortConfig.key === sortKey ? (
						sortConfig.direction === "asc" ? (
							<ArrowUp className="h-3 w-3" />
						) : (
							<ArrowDown className="h-3 w-3" />
						)
					) : (
						<ArrowUpDown className="h-3 w-3 opacity-30" />
					)}
				</div>
			</th>
		);
	};

	const handleDbSort = (col: string) => {
		if (dbSortBy === col) {
			setDbSortOrder(dbSortOrder === "asc" ? "desc" : "asc");
		} else {
			setDbSortBy(col);
			setDbSortOrder("desc");
		}
		setDbPage(1);
	};

	const DbSortableHeader = ({
		label,
		sortKey,
		align = "left",
	}: {
		label: string;
		sortKey: string;
		align?: "left" | "right" | "center";
	}) => {
		const alignClass =
			align === "right"
				? "text-right"
				: align === "center"
					? "text-center"
					: "text-left";
		const justifyClass =
			align === "right"
				? "justify-end"
				: align === "center"
					? "justify-center"
					: "";
		return (
			<th
				className={`${alignClass} py-2.5 px-3 font-medium whitespace-nowrap cursor-pointer hover:bg-muted/70 select-none transition-colors text-xs uppercase tracking-wider`}
				onClick={() => handleDbSort(sortKey)}
			>
				<div className={`flex items-center gap-1 ${justifyClass}`}>
					{label}
					{dbSortBy === sortKey ? (
						dbSortOrder === "asc" ? (
							<ArrowUp className="h-3 w-3" />
						) : (
							<ArrowDown className="h-3 w-3" />
						)
					) : (
						<ArrowUpDown className="h-3 w-3 opacity-30" />
					)}
				</div>
			</th>
		);
	};

	const resetDbFilters = () => {
		setDbSearch("");
		setDbSector("");
		setDbMarketCap("");
		setDbMinPE("");
		setDbMaxPE("");
		setDbMinROE("");
		setDbMaxDE("");
		setDbMinRating("");
		setDbMinScore("");
		setDbPage(1);
	};

	const activeFilterCount = [
		dbSearch,
		dbSector,
		dbMarketCap,
		dbMinPE,
		dbMaxPE,
		dbMinROE,
		dbMaxDE,
		dbMinRating,
		dbMinScore,
	].filter(Boolean).length;

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
				<Card className="border-l-4 border-l-blue-500">
					<CardContent className="pt-4 pb-3 px-4">
						<div className="flex items-center gap-2.5">
							<div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
								<Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
							</div>
							<div>
								<div className="text-xl font-bold leading-none">
									{screenerStats?.database?.totalStocks?.toLocaleString() ?? 0}
								</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									Total Stocks
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="border-l-4 border-l-emerald-500">
					<CardContent className="pt-4 pb-3 px-4">
						<div className="flex items-center gap-2.5">
							<div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
								<BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							</div>
							<div>
								<div className="text-xl font-bold leading-none">
									{screenerStats?.database?.withFinancials?.toLocaleString() ??
										0}
								</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									With Financials
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="border-l-4 border-l-amber-500">
					<CardContent className="pt-4 pb-3 px-4">
						<div className="flex items-center gap-2.5">
							<div className="p-1.5 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
								<Star className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							</div>
							<div>
								<div className="text-xl font-bold leading-none">
									{screenerStats?.database?.withDerivedMetrics?.toLocaleString() ??
										0}
								</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									Scored & Rated
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="border-l-4 border-l-purple-500">
					<CardContent className="pt-4 pb-3 px-4">
						<div className="flex items-center gap-2.5">
							<div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
								<Activity className="h-4 w-4 text-purple-600 dark:text-purple-400" />
							</div>
							<div>
								<div className="text-xl font-bold leading-none">
									{screenerStats?.apiUsage?.remaining ?? 220}
								</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									API Calls Left
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
				<Card className="border-l-4 border-l-indigo-500 hidden lg:block">
					<CardContent className="pt-4 pb-3 px-4">
						<div className="space-y-1.5">
							<div className="text-[11px] text-muted-foreground font-medium">
								Market Cap Distribution
							</div>
							{distribution?.marketCap && (
								<DistributionBar
									data={distribution.marketCap}
									colorMap={MARKET_CAP_COLORS}
								/>
							)}
							<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
								{distribution?.marketCap?.slice(0, 3).map((d: any) => (
									<span key={d.category} className="flex items-center gap-1">
										<span
											className={`w-1.5 h-1.5 rounded-full ${MARKET_CAP_COLORS[d.category] || "bg-gray-400"}`}
										/>
										{d.category}: {Number(d.count).toLocaleString()}
									</span>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="db-screener" className="w-full">
				<Card>
					<CardHeader className="pb-3 border-b">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 rounded-lg">
									<Filter className="h-5 w-5 text-primary" />
								</div>
								<div>
									<CardTitle className="text-lg">
									{screenerType === "mutual_fund" ? "Mutual Fund Screener" :
									 screenerType === "bond" ? "Bond & Fixed Income Screener" :
									 screenerType === "etf" ? "ETF Screener" :
									 "Stock Screener"}
								</CardTitle>
									<CardDescription className="text-xs mt-0.5">
										Screen{" "}
										{screenerStats?.database?.totalStocks?.toLocaleString() ||
											0}{" "}
										stocks with{" "}
										{screenerStats?.database?.withDerivedMetrics?.toLocaleString() ||
											0}{" "}
										scored
									</CardDescription>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<TabsList className="h-8">
									<TabsTrigger value="db-screener" className="text-xs px-3 h-7">
										<Database className="h-3.5 w-3.5 mr-1" />
										Screener
									</TabsTrigger>
									<TabsTrigger value="builder" className="text-xs px-3 h-7">
										<SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
										Custom
									</TabsTrigger>
									<TabsTrigger value="saved" className="text-xs px-3 h-7">
										<Save className="h-3.5 w-3.5 mr-1" />
										Saved
									</TabsTrigger>
									<TabsTrigger value="admin" className="text-xs px-3 h-7">
										<Settings className="h-3.5 w-3.5 mr-1" />
										Admin
									</TabsTrigger>
								</TabsList>
							</div>
						</div>
					</CardHeader>

					<TabsContent value="db-screener" className="m-0">
						<CardContent className="pt-4 px-4">
							<div className="space-y-3">

								{/* ── Instrument Type Switcher ─────────────────────────────────── */}
								<div className="flex items-center gap-3 border-b pb-3">
									<span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Instrument:</span>
									{(["stock","mutual_fund","bond","etf"] as ScreenerType[]).map((t) => (
										<button
											key={t}
											type="button"
											onClick={() => setScreenerType(t)}
											className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
												screenerType === t
													? "bg-primary text-primary-foreground"
													: "bg-muted text-muted-foreground hover:bg-muted/70"
											}`}
										>
											{t === "mutual_fund" ? "Mutual Funds" : t === "bond" ? "Bonds" : t === "etf" ? "ETFs" : "Stocks"}
										</button>
									))}
								</div>

								{/* ── MF Screener ──────────────────────────────────────────────── */}
								{screenerType === "mutual_fund" && (
									<div className="space-y-3">
										<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
											<Input placeholder="Search fund..." className="h-7 text-xs" value={mfSearch}
												onChange={(e) => { setMfSearch(e.target.value); setMfPage(1); }} />
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={mfCategory}
												onChange={(e) => { setMfCategory(e.target.value); setMfPage(1); }}>
												<option value="">All Categories</option>
												{["Equity","Debt","Hybrid","ELSS","Index","Liquid","Arbitrage","Thematic","International","Gold","FOF"].map(c => (
													<option key={c} value={c}>{c}</option>
												))}
											</select>
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={mfRiskLevel}
												onChange={(e) => { setMfRiskLevel(e.target.value); setMfPage(1); }}>
												<option value="">All Risk</option>
												{["Low","Moderately Low","Moderate","Moderately High","High","Very High"].map(r => (
													<option key={r} value={r}>{r}</option>
												))}
											</select>
											<Input placeholder="Min 1Y Return %" type="number" className="h-7 text-xs" value={mfMinReturn1y}
												onChange={(e) => { setMfMinReturn1y(e.target.value); setMfPage(1); }} />
											<Input placeholder="Min 3Y Return %" type="number" className="h-7 text-xs" value={mfMinReturn3y}
												onChange={(e) => { setMfMinReturn3y(e.target.value); setMfPage(1); }} />
											<Input placeholder="Max Expense Ratio %" type="number" className="h-7 text-xs" value={mfMaxExpenseRatio}
												onChange={(e) => { setMfMaxExpenseRatio(e.target.value); setMfPage(1); }} />
										</div>
										<div className="flex items-center justify-between text-xs text-muted-foreground">
											<span>{instrumentData?.meta?.total?.toLocaleString() ?? 0} funds</span>
											<div className="flex gap-2">
												<Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={mfPage <= 1} onClick={() => setMfPage(p => Math.max(1,p-1))}><ChevronLeft className="h-3 w-3" />Prev</Button>
												<Button variant="outline" size="sm" className="h-6 text-[10px]" disabled={(instrumentData?.data?.length ?? 0) < 25} onClick={() => setMfPage(p => p+1)}>Next<ChevronRight className="h-3 w-3" /></Button>
											</div>
										</div>
										{instrumentLoading ? (
											<div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Loading funds...</span></div>
										) : (
										<div className="border rounded-lg overflow-hidden">
											<div className="overflow-x-auto">
												<table className="w-full text-sm">
													<thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
														<tr>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider w-8">#</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider min-w-[220px]">Scheme Name</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">Category</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">Risk</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">NAV ₹</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider cursor-pointer" onClick={() => { setMfSortBy("returns1y"); setMfSortOrder(o => o==="desc"?"asc":"desc"); }}>1Y Ret %</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider cursor-pointer" onClick={() => { setMfSortBy("returns3y"); setMfSortOrder(o => o==="desc"?"asc":"desc"); }}>3Y Ret %</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider cursor-pointer" onClick={() => { setMfSortBy("returns5y"); setMfSortOrder(o => o==="desc"?"asc":"desc"); }}>5Y Ret %</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider cursor-pointer" onClick={() => { setMfSortBy("aum"); setMfSortOrder(o => o==="desc"?"asc":"desc"); }}>AUM Cr</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider cursor-pointer" onClick={() => { setMfSortBy("expenseRatio"); setMfSortOrder(o => o==="desc"?"asc":"desc"); }}>Exp Ratio</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Rating</th>
														</tr>
													</thead>
													<tbody className="divide-y">
														{(instrumentData?.data ?? []).map((f: any, i: number) => (
															<tr key={f.id ?? f.schemeCode} className="hover:bg-muted/30 transition-colors">
																<td className="py-2 px-3 text-xs text-muted-foreground">{(mfPage-1)*25+i+1}</td>
																<td className="py-2 px-3 text-xs font-medium max-w-[240px] truncate" title={f.schemeName}>{f.schemeName}</td>
																<td className="py-2 px-3 text-xs"><span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px]">{f.category ?? "—"}</span></td>
																<td className="py-2 px-3 text-xs"><span className={`px-1.5 py-0.5 rounded text-[10px] ${
																	f.riskLevel?.includes("High") ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" :
																	f.riskLevel?.includes("Low") ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" :
																	"bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
																}`}>{f.riskLevel ?? "—"}</span></td>
																<td className="py-2 px-3 text-right font-mono text-xs">{f.nav ? `₹${Number(f.nav).toFixed(2)}` : "—"}</td>
																<td className={`py-2 px-3 text-right font-mono text-xs ${Number(f.returns1y) > 0 ? "text-emerald-600 dark:text-emerald-400" : Number(f.returns1y) < 0 ? "text-red-500" : ""}`}>{f.returns1y ? `${Number(f.returns1y).toFixed(2)}%` : "—"}</td>
																<td className={`py-2 px-3 text-right font-mono text-xs ${Number(f.returns3y) > 0 ? "text-emerald-600 dark:text-emerald-400" : Number(f.returns3y) < 0 ? "text-red-500" : ""}`}>{f.returns3y ? `${Number(f.returns3y).toFixed(2)}%` : "—"}</td>
																<td className={`py-2 px-3 text-right font-mono text-xs ${Number(f.returns5y) > 0 ? "text-emerald-600 dark:text-emerald-400" : Number(f.returns5y) < 0 ? "text-red-500" : ""}`}>{f.returns5y ? `${Number(f.returns5y).toFixed(2)}%` : "—"}</td>
																<td className="py-2 px-3 text-right font-mono text-xs">{f.aum ? `₹${Number(f.aum/100).toFixed(0)}Cr` : "—"}</td>
																<td className="py-2 px-3 text-right font-mono text-xs">{f.expenseRatio ? `${Number(f.expenseRatio).toFixed(2)}%` : "—"}</td>
																<td className="py-2 px-3 text-right font-mono text-xs">{f.rating ? `★${f.rating}` : "—"}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
										)}
										<p className="text-[10px] text-muted-foreground text-center py-1">⚠️ {instrumentData?.meta?.disclaimer}</p>
									</div>
								)}

								{/* ── Bond Screener ─────────────────────────────────────────────── */}
								{screenerType === "bond" && (
									<div className="space-y-3">
										<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={bondType} onChange={(e) => { setBondType(e.target.value); setBondPage(1); }}>
												<option value="all">All Bonds</option><option value="govt">G-Sec / SDL</option><option value="corporate">Corporate</option>
											</select>
											<Input placeholder="Min YTM %" type="number" className="h-7 text-xs" value={bondMinYield} onChange={(e) => { setBondMinYield(e.target.value); setBondPage(1); }} />
											<Input placeholder="Matures within (yrs)" type="number" className="h-7 text-xs" value={bondMaxMaturityYears} onChange={(e) => { setBondMaxMaturityYears(e.target.value); setBondPage(1); }} />
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={bondMinRating} onChange={(e) => { setBondMinRating(e.target.value); setBondPage(1); }}>
												<option value="">All Ratings</option>{["BBB","A","AA","AA+","AAA"].map(r => <option key={r} value={r}>{r}+</option>)}
											</select>
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={bondTaxStatus} onChange={(e) => { setBondTaxStatus(e.target.value); setBondPage(1); }}>
												<option value="all">Any Tax Status</option><option value="taxfree">Tax-Free</option><option value="taxable">Taxable</option>
											</select>
										</div>
										{instrumentLoading ? (
											<div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Loading bonds...</span></div>
										) : (
										<div className="border rounded-lg overflow-hidden">
											<div className="overflow-x-auto">
												<table className="w-full text-sm">
													<thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
														<tr>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider w-8">#</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider min-w-[200px]">Issuer / Name</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">Type</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">YTM %</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Coupon %</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Maturity</th>
															<th className="py-2.5 px-3 text-center font-medium text-xs uppercase tracking-wider">Rating</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Min Invest</th>
															<th className="py-2.5 px-3 text-center font-medium text-xs uppercase tracking-wider">Tax</th>
														</tr>
													</thead>
													<tbody className="divide-y">
														{(instrumentData?.data ?? []).length === 0 && !instrumentLoading && (
															<tr><td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">No bonds match the current filters. The bond catalog is currently seeded with sample data.</td></tr>
														)}
														{(instrumentData?.data ?? []).map((b: any, i: number) => (
															<tr key={b.id ?? b.isin} className="hover:bg-muted/30 transition-colors">
																<td className="py-2 px-3 text-xs text-muted-foreground">{(bondPage-1)*25+i+1}</td>
																<td className="py-2 px-3 text-xs font-medium max-w-[220px]"><div className="truncate" title={b.name}>{b.name}</div><div className="text-[10px] text-muted-foreground">{b.issuer}</div></td>
																<td className="py-2 px-3 text-xs"><span className={`px-1.5 py-0.5 rounded text-[10px] ${b.bondType === "govt" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" : "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"}`}>{b.bondType === "govt" ? "G-Sec" : "Corporate"}</span></td>
																<td className="py-2 px-3 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">{b.yieldToMaturity ? `${Number(b.yieldToMaturity).toFixed(2)}%` : "—"}</td>
																<td className="py-2 px-3 text-right font-mono text-xs">{b.couponRate ? `${Number(b.couponRate).toFixed(2)}%` : "—"}</td>
																<td className="py-2 px-3 text-right text-xs">{b.maturityDate ?? "—"}</td>
																<td className="py-2 px-3 text-center text-xs"><span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded font-bold text-[10px]">{b.creditRating ?? "—"}</span></td>
																<td className="py-2 px-3 text-right text-xs">{b.minimumInvestment ? `₹${Number(b.minimumInvestment).toLocaleString()}` : "—"}</td>
																<td className="py-2 px-3 text-center text-[10px]">{b.taxStatus === "taxfree" ? <span className="text-emerald-600 font-medium">Tax-Free</span> : "Taxable"}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
										)}
										<p className="text-[10px] text-muted-foreground text-center py-1">⚠️ {instrumentData?.meta?.disclaimer ?? "Bond investments carry credit risk. Not a solicitation to invest."}</p>
									</div>
								)}

								{/* ── ETF Screener ──────────────────────────────────────────────── */}
								{screenerType === "etf" && (
									<div className="space-y-3">
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
											<Input placeholder="Search ETF..." className="h-7 text-xs" value={etfSearch} onChange={(e) => { setEtfSearch(e.target.value); setEtfPage(1); }} />
											<select className="h-7 text-xs border rounded-md px-2 bg-background" value={etfCategory} onChange={(e) => { setEtfCategory(e.target.value); setEtfPage(1); }}>
												<option value="all">All ETFs</option><option value="nifty">Nifty ETFs</option><option value="gold">Gold ETFs</option><option value="international">International</option>
											</select>
										</div>
										<span className="text-xs text-muted-foreground">{instrumentData?.meta?.total ?? 0} ETFs found</span>
										{instrumentLoading ? (
											<div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm text-muted-foreground">Loading ETFs...</span></div>
										) : (
										<div className="border rounded-lg overflow-hidden">
											<div className="overflow-x-auto">
												<table className="w-full text-sm">
													<thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
														<tr>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">Symbol</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider min-w-[220px]">Name</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">Exchange</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Price ₹</th>
															<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">Market Cap</th>
															<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">ISIN</th>
														</tr>
													</thead>
													<tbody className="divide-y">
														{(instrumentData?.data ?? []).length === 0 && !instrumentLoading && (
															<tr><td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">No ETFs found with current filters.</td></tr>
														)}
														{(instrumentData?.data ?? []).map((e: any) => (
															<tr key={e.id ?? e.symbol} className="hover:bg-muted/30 transition-colors">
																<td className="py-2 px-3 text-xs font-mono font-semibold">{e.symbol}</td>
																<td className="py-2 px-3 text-xs max-w-[240px] truncate" title={e.companyName}>{e.companyName}</td>
																<td className="py-2 px-3 text-xs text-muted-foreground">{e.exchange ?? "NSE"}</td>
																<td className="py-2 px-3 text-right font-mono text-xs">{e.currentPrice ? `₹${Number(e.currentPrice).toFixed(2)}` : "—"}</td>
																<td className="py-2 px-3 text-right text-xs">{e.marketCap ? `₹${(Number(e.marketCap)/10000000).toFixed(0)}Cr` : "—"}</td>
																<td className="py-2 px-3 text-xs text-muted-foreground font-mono text-[10px]">{e.isin ?? "—"}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
										)}
										<p className="text-[10px] text-muted-foreground text-center py-1">⚠️ ETFs are subject to market risk. Past performance is not indicative of future returns.</p>
									</div>
								)}

								{/* ── Stock Screener (existing) ─────────────────────────────────── */}
								{screenerType === "stock" && (
								<div className="space-y-3">
								<div className="flex items-center justify-between">
									<Button
										variant={showFilters ? "secondary" : "outline"}
										size="sm"
										className="h-7 text-xs"
										onClick={() => setShowFilters(!showFilters)}
									>
										<SlidersHorizontal className="h-3 w-3 mr-1" />
										Filters
										{activeFilterCount > 0 && (
											<Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[9px] bg-primary">
												{activeFilterCount}
											</Badge>
										)}
									</Button>
									<div className="flex items-center gap-2">
										<div className="relative w-60">
											<Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
											<Input
												placeholder="Search symbol or company..."
												className="pl-7 h-7 text-xs"
												value={dbSearch}
												onChange={(e) => {
													setDbSearch(e.target.value);
													setDbPage(1);
												}}
											/>
											{dbSearch && (
												<Button
													variant="ghost"
													size="sm"
													className="absolute right-0 top-0 h-7 w-7 p-0"
													onClick={() => setDbSearch("")}
												>
													<X className="h-3 w-3" />
												</Button>
											)}
										</div>
										<div className="flex items-center border rounded-md">
											<Button
												variant={viewMode === "table" ? "secondary" : "ghost"}
												size="sm"
												className="h-7 w-7 p-0 rounded-r-none"
												onClick={() => setViewMode("table")}
											>
												<List className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant={viewMode === "cards" ? "secondary" : "ghost"}
												size="sm"
												className="h-7 w-7 p-0 rounded-l-none"
												onClick={() => setViewMode("cards")}
											>
												<LayoutGrid className="h-3.5 w-3.5" />
											</Button>
										</div>
									</div>
								</div>

								{showFilters && (
									<div className="bg-muted/30 rounded-lg p-3 border space-y-2.5">
										<div className="flex flex-wrap items-end gap-2">
											<div className="w-36">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Sector
												</Label>
												<Select
													value={dbSector}
													onValueChange={(v) => {
														setDbSector(v === "all" ? "" : v);
														setDbPage(1);
													}}
												>
													<SelectTrigger className="h-7 text-xs">
														<SelectValue placeholder="All Sectors" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">All Sectors</SelectItem>
														{(dbScreenerData?.filters?.sectors || [])
															.sort()
															.map((s: string) => (
																<SelectItem key={s} value={s}>
																	{s}
																</SelectItem>
															))}
													</SelectContent>
												</Select>
											</div>
											<div className="w-28">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Market Cap
												</Label>
												<Select
													value={dbMarketCap}
													onValueChange={(v) => {
														setDbMarketCap(v === "all" ? "" : v);
														setDbPage(1);
													}}
												>
													<SelectTrigger className="h-7 text-xs">
														<SelectValue placeholder="All" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">All</SelectItem>
														<SelectItem value="Large Cap">Large Cap</SelectItem>
														<SelectItem value="Mid Cap">Mid Cap</SelectItem>
														<SelectItem value="Small Cap">Small Cap</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="w-20">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Min P/E
												</Label>
												<Input
													type="number"
													placeholder="0"
													className="h-7 text-xs"
													value={dbMinPE}
													onChange={(e) => {
														setDbMinPE(e.target.value);
														setDbPage(1);
													}}
												/>
											</div>
											<div className="w-20">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Max P/E
												</Label>
												<Input
													type="number"
													placeholder="100"
													className="h-7 text-xs"
													value={dbMaxPE}
													onChange={(e) => {
														setDbMaxPE(e.target.value);
														setDbPage(1);
													}}
												/>
											</div>
											<div className="w-20">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Min ROE%
												</Label>
												<Input
													type="number"
													placeholder="0"
													className="h-7 text-xs"
													value={dbMinROE}
													onChange={(e) => {
														setDbMinROE(e.target.value);
														setDbPage(1);
													}}
												/>
											</div>
											<div className="w-20">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Max D/E
												</Label>
												<Input
													type="number"
													placeholder="2"
													className="h-7 text-xs"
													value={dbMaxDE}
													onChange={(e) => {
														setDbMaxDE(e.target.value);
														setDbPage(1);
													}}
												/>
											</div>
											<div className="w-24">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Min Rating
												</Label>
												<Select
													value={dbMinRating}
													onValueChange={(v) => {
														setDbMinRating(v === "any" ? "" : v);
														setDbPage(1);
													}}
												>
													<SelectTrigger className="h-7 text-xs">
														<SelectValue placeholder="Any" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="any">Any</SelectItem>
														<SelectItem value="5">5 Stars</SelectItem>
														<SelectItem value="4">4+ Stars</SelectItem>
														<SelectItem value="3">3+ Stars</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className="w-24">
												<Label className="text-[10px] text-muted-foreground mb-0.5 block">
													Min Score
												</Label>
												<Input
													type="number"
													placeholder="0"
													className="h-7 text-xs"
													value={dbMinScore}
													onChange={(e) => {
														setDbMinScore(e.target.value);
														setDbPage(1);
													}}
												/>
											</div>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 text-xs"
												onClick={resetDbFilters}
											>
												<RefreshCw className="h-3 w-3 mr-1" />
												Reset
											</Button>
										</div>
									</div>
								)}

								<div className="flex items-center justify-between text-xs">
									<div className="flex items-center gap-3 text-muted-foreground">
										<span className="font-medium text-foreground">
											{dbScreenerData?.total?.toLocaleString() ?? 0} stocks
										</span>
										<span>
											Page {dbScreenerData?.page || 1} of{" "}
											{dbScreenerData?.totalPages || 1}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											className="h-6 text-[10px]"
											disabled={dbPage <= 1}
											onClick={() => setDbPage((p) => Math.max(1, p - 1))}
										>
											<ChevronLeft className="h-3 w-3" />
											Prev
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="h-6 text-[10px]"
											disabled={dbPage >= (dbScreenerData?.totalPages || 1)}
											onClick={() => setDbPage((p) => p + 1)}
										>
											Next
											<ChevronRight className="h-3 w-3" />
										</Button>
									</div>
								</div>

								{dbLoading ? (
									<div className="flex items-center justify-center py-16">
										<Loader2 className="h-5 w-5 animate-spin text-primary" />
										<span className="ml-2 text-sm text-muted-foreground">
											Loading screener data...
										</span>
									</div>
								) : dbScreenerData?.stocks?.length > 0 ? (
									viewMode === "table" ? (
										<>
											<div className="border rounded-lg overflow-hidden">
												<div className="overflow-x-auto">
													<table className="w-full text-sm">
														<thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
															<tr>
																<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider w-8">
																	#
																</th>
																<th className="py-2.5 px-3 text-left font-medium text-xs uppercase tracking-wider">
																	Company
																</th>
																<DbSortableHeader
																	label="Price"
																	sortKey="currentPrice"
																	align="right"
																/>
																<DbSortableHeader
																	label="Mkt Cap"
																	sortKey="marketCap"
																	align="right"
																/>
																<th className="py-2.5 px-3 text-center font-medium text-xs uppercase tracking-wider">
																	Cap
																</th>
																<DbSortableHeader
																	label="P/E"
																	sortKey="peRatio"
																	align="right"
																/>
																<DbSortableHeader
																	label="Fwd PE"
																	sortKey="forwardPe"
																	align="right"
																/>
																<DbSortableHeader
																	label="PEG"
																	sortKey="pegRatio"
																	align="right"
																/>
																<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">
																	Div %
																</th>
																<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">
																	EPS
																</th>
																<DbSortableHeader
																	label="ROE"
																	sortKey="roe"
																	align="right"
																/>
																<th className="py-2.5 px-3 text-right font-medium text-xs uppercase tracking-wider">
																	D/E
																</th>
																<DbSortableHeader
																	label="α Nifty"
																	sortKey="returnVsNifty1Y"
																	align="right"
																/>
																<DbSortableHeader
																	label="Analyst↑%"
																	sortKey="analystUpside"
																	align="right"
																/>
																<DbSortableHeader
																	label="DCF↑%"
																	sortKey="dcfUpside"
																	align="right"
																/>
																<DbSortableHeader
																	label="Score"
																	sortKey="compositeScore"
																	align="center"
																/>
																<DbSortableHeader
																	label="Rating"
																	sortKey="fintekRating"
																	align="center"
																/>
																<th className="py-2.5 px-3 text-center font-medium text-xs uppercase tracking-wider">
																	Detail
																</th>
															</tr>
														</thead>
														<tbody>
															{dbScreenerData.stocks.map(
																(stock: any, index: number) => (
																	<>
																		<tr
																			key={stock.symbol}
																			className={`border-b hover:bg-muted/30 transition-colors ${expandedStock === stock.symbol ? "bg-muted/20" : ""}`}
																		>
																			<td className="py-2.5 px-3 text-xs text-muted-foreground">
																				{(dbPage - 1) * dbLimit + index + 1}
																			</td>
																			<td className="py-2.5 px-3">
																				<div
																					className="font-medium text-sm truncate max-w-[220px]"
																					title={stock.companyName}
																				>
																					{stock.companyName}
																				</div>
																				<div className="flex items-center gap-1.5 mt-0.5">
																					<Badge
																						variant="outline"
																						className="font-mono text-[10px] py-0 px-1 h-4"
																					>
																						{stock.symbol}
																					</Badge>
																					{stock.sector && (
																						<span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
																							{stock.sector}
																						</span>
																					)}
																				</div>
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{formatCurrency(stock.currentPrice)}
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{formatMarketCap(stock.marketCapValue)}
																			</td>
																			<td className="py-2.5 px-3 text-center">
																				<MarketCapBadge
																					category={stock.marketCapCategory}
																				/>
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{formatNum(stock.peRatio)}
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{formatNum(stock.forwardPe)}
																			</td>
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${
																					stock.pegRatio
																						? Number.parseFloat(stock.pegRatio) < 1
																							? "text-emerald-600 dark:text-emerald-400 font-semibold" // undervalued
																							: Number.parseFloat(stock.pegRatio) > 2
																							? "text-red-600 dark:text-red-400" // expensive
																							: ""
																						: ""
																				}`}
																			>
																				{formatNum(stock.pegRatio)}
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{stock.dividendYield
																					? `${(Number.parseFloat(stock.dividendYield) * 100).toFixed(2)}%`
																					: "-"}
																			</td>
																			<td className="py-2.5 px-3 text-right font-mono text-xs">
																				{formatNum(stock.eps)}
																			</td>
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${Number.parseFloat(stock.roe || "0") >= 0.15 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}`}
																			>
																				{stock.roe
																					? formatPercent(stock.roe, 100)
																					: "-"}
																			</td>
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${Number.parseFloat(stock.debtToEquity || "0") > 1.5 ? "text-red-600 dark:text-red-400" : ""}`}
																			>
																				{formatNum(stock.debtToEquity)}
																			</td>
																			{/* Phase 4a: Alpha vs NIFTY 50 — green=outperformed, red=underperformed */}
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${
																					stock.returnVsNifty1Y
																						? Number.parseFloat(stock.returnVsNifty1Y) > 0
																							? "text-emerald-600 dark:text-emerald-400 font-semibold"
																							: "text-red-500 dark:text-red-400"
																						: "text-muted-foreground"
																				}`}
																			>
																				{stock.returnVsNifty1Y
																					? `${Number.parseFloat(stock.returnVsNifty1Y) > 0 ? "+" : ""}${(Number.parseFloat(stock.returnVsNifty1Y) * 100).toFixed(1)}%`
																					: "-"}
																			</td>
																			{/* Phase 4b: Analyst consensus upside % */}
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${
																					stock.analystUpsidePct
																						? Number.parseFloat(stock.analystUpsidePct) > 10
																							? "text-emerald-600 dark:text-emerald-400 font-semibold"
																							: Number.parseFloat(stock.analystUpsidePct) < -5
																							? "text-red-500 dark:text-red-400"
																							: ""
																						: "text-muted-foreground"
																				}`}
																			>
																				{stock.analystUpsidePct
																					? `${Number.parseFloat(stock.analystUpsidePct) > 0 ? "+" : ""}${Number.parseFloat(stock.analystUpsidePct).toFixed(1)}%`
																					: "-"}
																			</td>
																			{/* Phase 4c: DCF intrinsic value upside % */}
																			<td
																				className={`py-2.5 px-3 text-right font-mono text-xs ${
																					stock.dcfUpsidePercent
																						? Number.parseFloat(stock.dcfUpsidePercent) > 15
																							? "text-emerald-600 dark:text-emerald-400 font-semibold"
																							: Number.parseFloat(stock.dcfUpsidePercent) < -15
																							? "text-red-500 dark:text-red-400"
																							: ""
																						: "text-muted-foreground"
																				}`}
																			>
																				{stock.dcfUpsidePercent
																					? `${Number.parseFloat(stock.dcfUpsidePercent) > 0 ? "+" : ""}${Number.parseFloat(stock.dcfUpsidePercent).toFixed(1)}%`
																					: "-"}
																			</td>
																			<td className="py-2.5 px-3 text-center">
																				<ScoreBreakdownTooltip stock={stock} />
																			</td>
																			<td className="py-2.5 px-3 text-center">
																				<RatingStars
																					rating={stock.fintekRating}
																				/>
																			</td>
																			<td className="py-2.5 px-3 text-center">
																				<Button
																					variant="ghost"
																					size="sm"
																					className="h-6 w-6 p-0"
																					onClick={() =>
																						setExpandedStock(
																							expandedStock === stock.symbol
																								? null
																								: stock.symbol,
																						)
																					}
																				>
																					<Eye
																						className={`h-3.5 w-3.5 ${expandedStock === stock.symbol ? "text-primary" : "text-muted-foreground"}`}
																					/>
																				</Button>
																			</td>
																		</tr>
																		{expandedStock === stock.symbol && (
																			<tr key={`${stock.symbol}-detail`}>
																				<td
																					colSpan={15}
																					className="bg-muted/10 border-b"
																				>
																					<div className="p-4">
																						{detailLoading ? (
																							<div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
																								<Loader2 className="h-4 w-4 animate-spin" />
																								Loading details...
																							</div>
																						) : stockDetail ? (
																								<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
																								<div className="space-y-3">
																									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
																										<Building2 className="h-3.5 w-3.5" />
																										Company Info
																									</h4>
																									<div className="space-y-1.5 text-xs">
																										<div className="flex justify-between">
																											<span className="text-muted-foreground">
																												Exchange
																											</span>
																											<span className="font-medium">
																												{stockDetail.stock
																													?.exchange || "-"}
																											</span>
																										</div>
																										<div className="flex justify-between">
																											<span className="text-muted-foreground">
																												ISIN
																											</span>
																											<span className="font-mono">
																												{stockDetail.stock
																													?.isin || "-"}
																											</span>
																										</div>
																										<div className="flex justify-between">
																											<span className="text-muted-foreground">
																												Sector
																											</span>
																											<span className="font-medium">
																												{stockDetail.stock
																													?.sector || "-"}
																											</span>
																										</div>
																										<div className="flex justify-between">
																											<span className="text-muted-foreground">
																												Industry
																											</span>
																											<span className="font-medium">
																												{stockDetail.stock
																													?.industry || "-"}
																											</span>
																										</div>
																										<div className="flex justify-between">
																											<span className="text-muted-foreground">
																												Data Source
																											</span>
																											<Badge
																												variant="outline"
																												className="text-[9px] h-4"
																											>
																												{stockDetail.stock
																													?.dataSource || "-"}
																											</Badge>
																										</div>
																									</div>
																								</div>
																								<div className="space-y-3">
																									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
																										<BarChart3 className="h-3.5 w-3.5" />
																										Financial Metrics
																									</h4>
																									{stockDetail
																										.financials?.[0] ? (
																										<div className="space-y-1.5 text-xs">
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													P/E Ratio
																												</span>
																												<span className="font-mono">
																													{formatNum(
																														stockDetail
																															.financials[0]
																															.peRatio,
																													)}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													P/B Ratio
																												</span>
																												<span className="font-mono">
																													{formatNum(
																														stockDetail
																															.financials[0]
																															.pbRatio,
																													)}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													ROE
																												</span>
																												<span className="font-mono">
																													{stockDetail
																														.financials[0].roe
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.roe,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													ROA
																												</span>
																												<span className="font-mono">
																													{stockDetail
																														.financials[0].roa
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.roa,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													EPS
																												</span>
																												<span className="font-mono">
																													{formatNum(
																														stockDetail
																															.financials[0]
																															.eps,
																													)}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													Book Value
																												</span>
																												<span className="font-mono">
																													{formatNum(
																														stockDetail
																															.financials[0]
																															.bookValue,
																													)}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													D/E
																												</span>
																												<span className="font-mono">
																													{formatNum(
																														stockDetail
																															.financials[0]
																															.debtToEquity,
																													)}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													Dividend Yield
																												</span>
																												<span className="font-mono">
																													{stockDetail
																														.financials[0]
																														.dividendYield
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.dividendYield,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<Separator className="my-1" />
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													1Y Return
																												</span>
																												<span
																													className={`font-mono ${Number.parseFloat(stockDetail.financials[0].return1y || "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}
																												>
																													{stockDetail
																														.financials[0]
																														.return1y
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.return1y,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													2Y Return
																												</span>
																												<span
																													className={`font-mono ${Number.parseFloat(stockDetail.financials[0].return2y || "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}
																												>
																													{stockDetail
																														.financials[0]
																														.return2y
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.return2y,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													3Y Return
																												</span>
																												<span
																													className={`font-mono ${Number.parseFloat(stockDetail.financials[0].return3y || "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}
																												>
																													{stockDetail
																														.financials[0]
																														.return3y
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.return3y,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																											<div className="flex justify-between">
																												<span className="text-muted-foreground">
																													5Y Return
																												</span>
																												<span
																													className={`font-mono ${Number.parseFloat(stockDetail.financials[0].return5y || "0") >= 0 ? "text-emerald-600" : "text-red-600"}`}
																												>
																													{stockDetail
																														.financials[0]
																														.return5y
																														? formatPercent(
																																stockDetail
																																	.financials[0]
																																	.return5y,
																																100,
																															)
																														: "-"}
																												</span>
																											</div>
																										</div>
																									) : (
																										<p className="text-xs text-muted-foreground">
																											No financial data
																											available
																										</p>
																									)}
																								</div>
																								{/* Phase 4b: Valuation Signals — Analyst Consensus + DCF + Alpha */}
																								<div className="space-y-3">
																									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
																										<TrendingUp className="h-3.5 w-3.5" />
																									Valuation Signals
																									</h4>
																									<div className="space-y-1.5 text-xs">
																										{stock.analystAvgTarget ? (
																											<>
																												<div className="flex justify-between items-center"><span className="text-muted-foreground">Analyst Rating</span>{stock.analystConsensusRating && (<Badge variant="outline" className={`text-[9px] h-4 ${stock.analystConsensusRating === 'Strong Buy' || stock.analystConsensusRating === 'Buy' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : stock.analystConsensusRating === 'Sell' ? 'border-red-500 text-red-600 dark:text-red-400' : ''}`}>{stock.analystConsensusRating}</Badge>)}</div>
																												<div className="flex justify-between"><span className="text-muted-foreground">Avg Target</span><span className="font-mono font-semibold">₹{Number.parseFloat(stock.analystAvgTarget).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span></div>
																												<div className="flex justify-between"><span className="text-muted-foreground">Analyst Upside</span><span className={`font-mono font-semibold ${stock.analystUpsidePct && Number.parseFloat(stock.analystUpsidePct) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{stock.analystUpsidePct ? `${Number.parseFloat(stock.analystUpsidePct) > 0 ? "+" : ""}${Number.parseFloat(stock.analystUpsidePct).toFixed(1)}%` : "-"}</span></div>
																												<div className="flex justify-between"><span className="text-muted-foreground">Analysts</span><span className="font-mono">{stock.analystCount ?? "-"}</span></div>
																											</>
																										) : (<p className="text-muted-foreground text-xs">No analyst targets yet</p>)}
																										{stock.dcfUpsidePercent && (
																											<div className="mt-2 pt-2 border-t space-y-1.5">
																												<div className="flex justify-between items-center"><span className="text-muted-foreground">DCF vs CMP</span><span className={`font-mono font-semibold ${Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'text-emerald-600 dark:text-emerald-400' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'text-red-500 dark:text-red-400' : ''}`}>{`${Number.parseFloat(stock.dcfUpsidePercent) > 0 ? "+" : ""}${Number.parseFloat(stock.dcfUpsidePercent).toFixed(1)}%`}</span></div>
																												<div className="flex justify-between"><span className="text-muted-foreground">Signal</span><Badge variant="outline" className={`text-[9px] h-4 ${Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'border-emerald-500 text-emerald-600' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'border-red-500 text-red-600' : ''}`}>{Number.parseFloat(stock.dcfUpsidePercent) > 15 ? 'Undervalued' : Number.parseFloat(stock.dcfUpsidePercent) < -15 ? 'Overvalued' : 'Fair Value'}</Badge></div>
																											</div>
																										)}
																										{stock.returnVsNifty1Y && (<div className="mt-2 pt-2 border-t"><div className="flex justify-between"><span className="text-muted-foreground">α vs NIFTY (1Y)</span><span className={`font-mono font-semibold ${Number.parseFloat(stock.returnVsNifty1Y) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{`${Number.parseFloat(stock.returnVsNifty1Y) > 0 ? "+" : ""}${(Number.parseFloat(stock.returnVsNifty1Y) * 100).toFixed(1)}%`}</span></div></div>)}
																									</div>
																								</div>
																								<div className="space-y-3">
																									<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
																										<Target className="h-3.5 w-3.5" />
																										Score Breakdown
																									</h4>
																									{stockDetail.derivedMetrics ? (
																										<div className="space-y-2">
																											{[
																												{
																													label: "Growth",
																													score:
																														stockDetail
																															.derivedMetrics
																															.growthScore,
																													icon: TrendingUp,
																													color: "bg-blue-500",
																													weight: "25%",
																												},
																												{
																													label: "Quality",
																													score:
																														stockDetail
																															.derivedMetrics
																															.qualityScore,
																													icon: Sparkles,
																													color:
																														"bg-purple-500",
																													weight: "30%",
																												},
																												{
																													label: "Value",
																													score:
																														stockDetail
																															.derivedMetrics
																															.valueScore,
																													icon: Target,
																													color:
																														"bg-emerald-500",
																													weight: "25%",
																												},
																												{
																													label: "Risk",
																													score:
																														stockDetail
																															.derivedMetrics
																															.riskScore,
																													icon: LucideShield,
																													color:
																														"bg-orange-500",
																													weight: "20%",
																												},
																											].map(
																												({
																													label,
																													score,
																													icon: Icon,
																													color,
																													weight,
																												}) => {
																													const s =
																														Number.parseFloat(
																															score || "0",
																														);
																													return (
																														<div
																															key={label}
																															className="space-y-0.5"
																														>
																															<div className="flex items-center justify-between text-xs">
																																<span className="flex items-center gap-1.5">
																																	<Icon className="h-3 w-3 text-muted-foreground" />
																																	{label}{" "}
																																	<span className="text-muted-foreground">
																																		({weight})
																																	</span>
																																</span>
																																<span className="font-mono font-medium">
																																	{s.toFixed(1)}
																																</span>
																															</div>
																															<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
																																<div
																																	className={`h-full rounded-full ${color}`}
																																	style={{
																																		width: `${s}%`,
																																	}}
																																/>
																															</div>
																														</div>
																													);
																												},
																											)}
																											<Separator className="my-2" />
																											<div className="flex items-center justify-between">
																												<span className="text-xs font-semibold">
																													Composite Score
																												</span>
																												<div className="flex items-center gap-2">
																													<ScoreBadge
																														score={
																															stockDetail
																																.derivedMetrics
																																.compositeScore
																														}
																														label="Composite"
																													/>
																													<RatingStars
																														rating={
																															stockDetail
																																.derivedMetrics
																																.fintekRating
																														}
																													/>
																												</div>
																											</div>
																										</div>
																									) : (
																										<p className="text-xs text-muted-foreground">
																											No scoring data available
																										</p>
																									)}
																								</div>
																							</div>
																						) : (
																							<p className="text-sm text-muted-foreground">
																								Could not load details
																							</p>
																						)}
																					</div>
																				</td>
																			</tr>
																		)}
																	</>
																),
															)}
														</tbody>
													</table>
												</div>
											</div>

											<div className="flex items-center justify-between pt-1">
												<div className="text-xs text-muted-foreground">
													Showing {(dbPage - 1) * dbLimit + 1}-
													{Math.min(
														dbPage * dbLimit,
														dbScreenerData?.total || 0,
													)}{" "}
													of {dbScreenerData?.total?.toLocaleString()} stocks
												</div>
												<div className="flex items-center gap-1">
													<Button
														variant="outline"
														size="sm"
														className="h-7 text-xs"
														disabled={dbPage <= 1}
														onClick={() => setDbPage(1)}
													>
														First
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="h-7 w-7 p-0"
														disabled={dbPage <= 1}
														onClick={() => setDbPage((p) => Math.max(1, p - 1))}
													>
														<ChevronLeft className="h-3.5 w-3.5" />
													</Button>
													{Array.from(
														{
															length: Math.min(
																5,
																dbScreenerData?.totalPages || 1,
															),
														},
														(_, i) => {
															const startPage = Math.max(
																1,
																Math.min(
																	dbPage - 2,
																	(dbScreenerData?.totalPages || 1) - 4,
																),
															);
															const pageNum = startPage + i;
															if (pageNum > (dbScreenerData?.totalPages || 1))
																return null;
															return (
																<Button
																	key={pageNum}
																	variant={
																		pageNum === dbPage ? "default" : "outline"
																	}
																	size="sm"
																	className="h-7 w-7 p-0 text-xs"
																	onClick={() => setDbPage(pageNum)}
																>
																	{pageNum}
																</Button>
															);
														},
													)}
													<Button
														variant="outline"
														size="sm"
														className="h-7 w-7 p-0"
														disabled={
															dbPage >= (dbScreenerData?.totalPages || 1)
														}
														onClick={() => setDbPage((p) => p + 1)}
													>
														<ChevronRight className="h-3.5 w-3.5" />
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="h-7 text-xs"
														disabled={
															dbPage >= (dbScreenerData?.totalPages || 1)
														}
														onClick={() =>
															setDbPage(dbScreenerData?.totalPages || 1)
														}
													>
														Last
													</Button>
												</div>
											</div>
										</>
									) : (
										<>
											<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
												{dbScreenerData.stocks.map(
													(stock: any, index: number) => (
														<Card
															key={stock.symbol}
															className="hover:shadow-md transition-shadow cursor-pointer"
															onClick={() =>
																setExpandedStock(
																	expandedStock === stock.symbol
																		? null
																		: stock.symbol,
																)
															}
														>
															<CardContent className="p-4">
																<div className="flex items-start justify-between mb-2">
																	<div className="flex-1 min-w-0">
																		<div
																			className="font-semibold text-sm truncate"
																			title={stock.companyName}
																		>
																			{stock.companyName}
																		</div>
																		<div className="flex items-center gap-1.5 mt-0.5">
																			<Badge
																				variant="outline"
																				className="font-mono text-[10px] py-0 px-1 h-4"
																			>
																				{stock.symbol}
																			</Badge>
																			<MarketCapBadge
																				category={stock.marketCapCategory}
																			/>
																		</div>
																	</div>
																	<RatingStars rating={stock.fintekRating} />
																</div>
																<div className="text-xs text-muted-foreground mb-3 truncate">
																	{stock.sector || "N/A"}
																</div>
																<div className="grid grid-cols-3 gap-2 text-center">
																	<div className="bg-muted/50 rounded p-1.5">
																		<div className="text-[10px] text-muted-foreground">
																			Price
																		</div>
																		<div className="text-xs font-mono font-medium">
																			{formatCurrency(stock.currentPrice)}
																		</div>
																	</div>
																	<div className="bg-muted/50 rounded p-1.5">
																		<div className="text-[10px] text-muted-foreground">
																			P/E
																		</div>
																		<div className="text-xs font-mono font-medium">
																			{formatNum(stock.peRatio)}
																		</div>
																	</div>
																	<div className="bg-muted/50 rounded p-1.5">
																		<div className="text-[10px] text-muted-foreground">
																			Score
																		</div>
																		<div className="flex justify-center">
																			<ScoreBadge
																				score={stock.compositeScore}
																				label="Composite"
																			/>
																		</div>
																	</div>
																</div>
																<div className="flex items-center justify-between mt-2 pt-2 border-t">
																	<div className="text-[10px] text-muted-foreground">
																		Mkt Cap:{" "}
																		{formatMarketCap(stock.marketCapValue)}
																	</div>
																	<div className="flex gap-1">
																		<ScoreBadge
																			score={stock.growthScore}
																			label="Growth"
																		/>
																		<ScoreBadge
																			score={stock.qualityScore}
																			label="Quality"
																		/>
																		<ScoreBadge
																			score={stock.valueScore}
																			label="Value"
																		/>
																		<ScoreBadge
																			score={stock.riskScore}
																			label="Risk"
																		/>
																	</div>
																</div>
															</CardContent>
														</Card>
													),
												)}
											</div>
											<div className="flex items-center justify-between pt-2">
												<div className="text-xs text-muted-foreground">
													Page {dbScreenerData.page} of{" "}
													{dbScreenerData.totalPages}
												</div>
												<div className="flex items-center gap-1">
													<Button
														variant="outline"
														size="sm"
														className="h-7"
														disabled={dbPage <= 1}
														onClick={() => setDbPage((p) => Math.max(1, p - 1))}
													>
														<ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
													</Button>
													<Button
														variant="outline"
														size="sm"
														className="h-7"
														disabled={
															dbPage >= (dbScreenerData?.totalPages || 1)
														}
														onClick={() => setDbPage((p) => p + 1)}
													>
														Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
													</Button>
												</div>
											</div>
										</>
									)
								) : (
									<div className="text-center py-16">
										<Database className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
										<p className="text-muted-foreground font-medium">
											No stocks match your filters
										</p>
										<p className="text-sm text-muted-foreground mt-1">
											{dbScreenerData?.total === 0 && !dbSearch && !dbSector
												? "The screener database is being populated. Use Admin tools to seed stock data."
												: "Try adjusting your filters or search criteria."}
										</p>
										{activeFilterCount > 0 && (
											<Button
												variant="outline"
												size="sm"
												className="mt-3"
												onClick={resetDbFilters}
											>
												<RefreshCw className="h-3.5 w-3.5 mr-1" />
												Clear All Filters
											</Button>
										)}
									</div>
								)}
							</div>
							)}
						</div>
					</CardContent>
				</TabsContent>

					<TabsContent value="builder" className="m-0">
						<CardContent className="pt-6">
							<div className="space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label className="text-sm font-medium">
											Instrument Type
										</Label>
										<Select
											value={screenerType}
											onValueChange={(v) => setScreenerType(v as ScreenerType)}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="mutual_fund">
													Mutual Funds
												</SelectItem>
												<SelectItem value="stock">Stocks</SelectItem>
												<SelectItem value="etf">ETFs</SelectItem>
												<SelectItem value="bond">Bonds</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-2">
										<Label className="text-sm font-medium">
											Screener Name (for saving)
										</Label>
										<Input
											placeholder="e.g., High Return Low Cost MFs"
											value={screenerName}
											onChange={(e) => setScreenerName(e.target.value)}
										/>
									</div>
								</div>

								<div className="space-y-3">
									<Label>Filter Criteria</Label>
									{criteria.map((c, index) => (
										<div key={index} className="flex gap-2 items-center">
											<Select
												value={c.field}
												onValueChange={(v) => updateCriteria(index, "field", v)}
											>
												<SelectTrigger className="w-48">
													<SelectValue placeholder="Select field" />
												</SelectTrigger>
												<SelectContent>
													{fields.map((f) => (
														<SelectItem key={f.value} value={f.value}>
															{f.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<Select
												value={c.operator}
												onValueChange={(v) =>
													updateCriteria(index, "operator", v)
												}
											>
												<SelectTrigger className="w-20">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{operators.map((o) => (
														<SelectItem key={o.value} value={o.value}>
															{o.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<Input
												type="number"
												placeholder="Value"
												className="w-32"
												value={c.value}
												onChange={(e) =>
													updateCriteria(index, "value", e.target.value)
												}
											/>
											{criteria.length > 1 && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => removeCriteria(index)}
												>
													Remove
												</Button>
											)}
										</div>
									))}
									<Button variant="outline" size="sm" onClick={addCriteria}>
										+ Add Criteria
									</Button>
								</div>

								<div className="flex gap-2 pt-4 border-t">
									<Button
										onClick={() => runScreenerMutation.mutate()}
										disabled={runScreenerMutation.isPending}
									>
										<Play className="h-4 w-4 mr-2" />
										Run Screener
									</Button>
									<Button
										variant="outline"
										onClick={() => saveScreenerMutation.mutate()}
										disabled={!screenerName || saveScreenerMutation.isPending}
									>
										<Save className="h-4 w-4 mr-2" />
										Save Screener
									</Button>
								</div>

								{runScreenerMutation.isPending ? (
									<div className="text-center py-8 text-muted-foreground">
										<Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
										Running screener...
									</div>
								) : runScreenerMutation.data?.results?.length > 0 ? (
									<div className="border rounded-lg overflow-hidden">
										<div className="overflow-x-auto max-h-[500px]">
											<table className="w-full text-sm">
												<thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 border-b">
													<tr>
														<SortableHeader label="Name" sortKey="name" />
														<SortableHeader label="Symbol" sortKey="symbol" />
														<SortableHeader label="Sector" sortKey="sector" />
														<SortableHeader
															label="Price"
															sortKey="currentPrice"
															align="right"
														/>
														<SortableHeader
															label="Mkt Cap"
															sortKey="marketCapValue"
															align="right"
														/>
														<SortableHeader
															label="P/E"
															sortKey="peRatio"
															align="right"
														/>
														<SortableHeader
															label="ROE %"
															sortKey="roe"
															align="right"
														/>
													</tr>
												</thead>
												<tbody>
													{sortedResults.map((item: any) => (
														<tr
															key={item.id || item.symbol}
															className="border-b hover:bg-muted/30"
														>
															<td
																className="py-2.5 px-3 font-medium truncate max-w-[200px]"
																title={item.name}
															>
																{item.name}
															</td>
															<td className="py-2.5 px-3">
																<Badge
																	variant="outline"
																	className="font-mono text-[10px]"
																>
																	{item.symbol}
																</Badge>
															</td>
															<td className="py-2.5 px-3 text-xs text-muted-foreground truncate max-w-[130px]">
																{item.sector || "-"}
															</td>
															<td className="py-2.5 px-3 text-right font-mono text-xs">
																{formatCurrency(item.currentPrice)}
															</td>
															<td className="py-2.5 px-3 text-right font-mono text-xs">
																{formatMarketCap(item.marketCapValue)}
															</td>
															<td className="py-2.5 px-3 text-right font-mono text-xs">
																{formatNum(item.peRatio)}
															</td>
															<td className="py-2.5 px-3 text-right font-mono text-xs">
																{item.roe
																	? `${Number.parseFloat(item.roe).toFixed(2)}%`
																	: "-"}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										{runScreenerMutation.data?.results?.length === 0
											? "No instruments match your criteria. Try adjusting your filters."
											: "Click 'Run Screener' to search for matching instruments"}
									</div>
								)}
							</div>
						</CardContent>
					</TabsContent>

					<TabsContent value="saved" className="m-0">
						<CardContent className="pt-6">
							<div className="space-y-4">
								<div>
									<h3 className="text-lg font-semibold mb-2">
										Saved Screeners
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Your saved screeners for quick access
									</p>
								</div>
								{(savedScreeners as any)?.screeners?.length > 0 ? (
									<div className="space-y-2">
										{(savedScreeners as any).screeners.map((s: any) => (
											<div
												key={s.id}
												className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
											>
												<div>
													<div className="font-medium">{s.name}</div>
													<div className="text-sm text-muted-foreground">
														{s.screenerType} • {s.runCount || 0} runs
													</div>
												</div>
												<Button variant="outline" size="sm">
													<Play className="h-4 w-4 mr-1" />
													Run
												</Button>
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-8 text-muted-foreground">
										No saved screeners yet. Create and save a screener to see it
										here.
									</div>
								)}
							</div>
						</CardContent>
					</TabsContent>

					<TabsContent value="admin" className="m-0">
						<CardContent className="pt-4 px-4">
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-4 gap-3">
									<Card className="border-l-4 border-l-blue-500">
										<CardContent className="pt-4 pb-3 px-4">
											<div className="flex items-center justify-between mb-2">
												<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
													Overall Progress
												</span>
												<Button
													variant="ghost"
													size="sm"
													className="h-6 w-6 p-0"
													onClick={() => refetchProgress()}
												>
													<RefreshCw className="h-3 w-3" />
												</Button>
											</div>
											<div className="text-2xl font-bold">
												{enrichmentProgress?.progress?.enrichmentPercent ?? 0}%
											</div>
											<Progress
												value={
													enrichmentProgress?.progress?.enrichmentPercent ?? 0
												}
												className="h-2 mt-2"
											/>
											<div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
												<Clock className="h-3 w-3" />~
												{enrichmentProgress?.progress?.estimatedDaysRemaining ??
													"?"}{" "}
												days remaining
											</div>
										</CardContent>
									</Card>

									<Card className="border-l-4 border-l-purple-500">
										<CardContent className="pt-4 pb-3 px-4">
											<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
												FMP API Usage
											</div>
											<div className="flex items-center justify-between">
												<span className="text-2xl font-bold">
													{enrichmentProgress?.apiUsage?.count ?? 0}
												</span>
												<span className="text-xs text-muted-foreground">
													/ {enrichmentProgress?.apiUsage?.limit ?? 249}
												</span>
											</div>
											<Progress
												value={enrichmentProgress?.apiUsage?.percentUsed ?? 0}
												className={`h-2 mt-2 ${(enrichmentProgress?.apiUsage?.percentUsed ?? 0) > 80 ? "[&>div]:bg-red-500" : ""}`}
											/>
											<div className="flex items-center justify-between text-[11px] mt-2">
												<span className="text-muted-foreground">
													{enrichmentProgress?.apiUsage?.remaining ?? 245}{" "}
													remaining
												</span>
												{enrichmentProgress?.apiUsage?.alertLevel ===
												"LIMIT_REACHED" ? (
													<Badge
														variant="destructive"
														className="text-[9px] h-4"
													>
														Limit
													</Badge>
												) : enrichmentProgress?.apiUsage?.alertLevel ===
													"WARNING_80PCT" ? (
													<Badge className="text-[9px] h-4 bg-amber-500">
														80%
													</Badge>
												) : (
													<Badge variant="secondary" className="text-[9px] h-4">
														OK
													</Badge>
												)}
											</div>
										</CardContent>
									</Card>

									<Card className="border-l-4 border-l-emerald-500">
										<CardContent className="pt-4 pb-3 px-4">
											<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
												Tier Progress
											</div>
											<div className="space-y-1.5 text-xs">
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">
														T1: Fundamentals
													</span>
													<span className="font-bold">
														{enrichmentProgress?.tiers?.tier1Percent ?? 0}%
													</span>
												</div>
												<Progress
													value={enrichmentProgress?.tiers?.tier1Percent ?? 0}
													className="h-1.5"
												/>
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">
														T2: Analyst/Events
													</span>
													<span className="font-bold">
														{enrichmentProgress?.tiers?.tier2Percent ?? 0}%
													</span>
												</div>
												<Progress
													value={enrichmentProgress?.tiers?.tier2Percent ?? 0}
													className="h-1.5"
												/>
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">
														T3: Intelligence
													</span>
													<span className="font-bold">
														{enrichmentProgress?.tiers?.tier3Percent ?? 0}%
													</span>
												</div>
												<Progress
													value={enrichmentProgress?.tiers?.tier3Percent ?? 0}
													className="h-1.5"
												/>
												<div className="flex justify-between items-center">
													<span className="text-muted-foreground">
														T4: Prices/Market
													</span>
													<span className="font-bold">
														{enrichmentProgress?.tiers?.tier4Percent ?? 0}%
													</span>
												</div>
												<Progress
													value={enrichmentProgress?.tiers?.tier4Percent ?? 0}
													className="h-1.5"
												/>
											</div>
										</CardContent>
									</Card>

									{/* Phase 4d: Data Freshness Panel */}
									<Card className="border-l-4 border-l-teal-500">
										<CardContent className="pt-4 pb-3 px-4">
											<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
												<Database className="h-3 w-3" />
												Data Freshness (30-day)
											</div>
											<div className="space-y-2.5 text-xs">
												{([
													{ label: "Financials",   key: "financials"   },
													{ label: "Key Metrics",  key: "keyMetrics"   },
													{ label: "Technicals",   key: "technicals"   },
													{ label: "Shareholding", key: "shareholding" },
												] as const).map(({ label, key }) => {
													const stat = enrichmentProgress?.freshness?.[key];
													const pct = stat?.coveragePct ?? 0;
													const barColor = pct >= 80 ? "[&>div]:bg-emerald-500" : pct >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";
													return (
														<div key={key}>
															<div className="flex justify-between mb-0.5">
																<span className="text-muted-foreground">{label}</span>
																<span className={`font-mono font-semibold ${pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : pct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
																	{pct}% <span className="text-muted-foreground font-normal">({stat?.synced ?? "—"}/{(stat?.synced ?? 0) + (stat?.stale ?? 0)})</span>
																</span>
															</div>
															<Progress value={pct} className={`h-1.5 ${barColor}`} />
														</div>
													);
												})}
											</div>
										</CardContent>
									</Card>

									<Card className="border-l-4 border-l-amber-500">
										<CardContent className="pt-4 pb-3 px-4">
											<div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
												Calendars & Events
											</div>
											<div className="space-y-1.5 text-xs">
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														Earnings
													</span>
													<span className="font-bold">
														{enrichmentProgress?.calendars?.earningsCount ?? 0}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														Dividends
													</span>
													<span className="font-bold">
														{enrichmentProgress?.calendars?.dividendCount ?? 0}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Splits</span>
													<span className="font-bold">
														{enrichmentProgress?.calendars?.splitCount ?? 0}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">IPOs</span>
													<span className="font-bold">
														{enrichmentProgress?.calendars?.ipoCount ?? 0}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">
														Economic
													</span>
													<span className="font-bold">
														{enrichmentProgress?.calendars?.economicCount ?? 0}
													</span>
												</div>
											</div>
										</CardContent>
									</Card>
								</div>

								<Card>
									<CardHeader className="pb-2 pt-4 px-4">
										<CardTitle className="text-sm font-semibold flex items-center gap-2">
											<Database className="h-4 w-4 text-emerald-500" />
											Data Coverage (
											{enrichmentProgress?.progress?.total?.toLocaleString() ??
												0}{" "}
											stocks)
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4 pb-4">
										<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withRatios?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Ratios</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withReturns?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Returns</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withGrowth?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Growth</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withKeyMetrics?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Key Metrics</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withDCF?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">DCF</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withRatings?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Ratings</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withAnalystTargets?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Targets</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withAnalystGrades?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Grades</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withInstitutionalHolders?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">
													Institutional
												</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withInsiderTrades?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Insider</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withNews?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">News</div>
											</div>
											<div className="border rounded p-2 text-center">
												<div className="font-bold text-lg">
													{enrichmentProgress?.progress?.withTechnicals?.toLocaleString() ??
														0}
												</div>
												<div className="text-muted-foreground">Technicals</div>
											</div>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2 pt-4 px-4">
										<CardTitle className="text-sm font-semibold flex items-center gap-2">
											<Zap className="h-4 w-4 text-primary" />
											Enrichment Controls
										</CardTitle>
										<CardDescription className="text-xs">
											Budget: 249 calls/day | Auto-stop: 245 | Priority: Tier 1
											(40%) → Tier 2 (30%) → Tier 3 (20%) → Tier 4 (10%)
										</CardDescription>
									</CardHeader>
									<CardContent className="px-4 pb-4">
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
											<div className="border rounded-lg p-3 space-y-2">
												<div className="flex items-center gap-2">
													<Database className="h-4 w-4 text-blue-500" />
													<span className="text-sm font-medium">
														Seed Listed Stocks
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Import from listed_stocks DB (no API calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs"
													disabled={isAnyMutationPending}
													onClick={() => seedFromDbMutation.mutate()}
												>
													{seedFromDbMutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<Play className="h-3 w-3 mr-1" />
													)}
													Seed from DB
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2">
												<div className="flex items-center gap-2">
													<Building2 className="h-4 w-4 text-purple-500" />
													<span className="text-sm font-medium">
														Seed Private Companies
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Import unlisted companies (no API calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs"
													disabled={isAnyMutationPending}
													onClick={() => seedUnlistedMutation.mutate()}
												>
													{seedUnlistedMutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<Play className="h-3 w-3 mr-1" />
													)}
													Seed Unlisted
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2">
												<div className="flex items-center gap-2">
													<Calculator className="h-4 w-4 text-amber-500" />
													<span className="text-sm font-medium">
														Recalculate Scores
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Recompute all derived metrics and FintekRating
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs"
													disabled={isAnyMutationPending}
													onClick={() => recalcMetricsMutation.mutate()}
												>
													{recalcMetricsMutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<RefreshCw className="h-3 w-3 mr-1" />
													)}
													Recalculate All
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2 border-blue-500/30 bg-blue-500/5">
												<div className="flex items-center gap-2">
													<BarChart3 className="h-4 w-4 text-blue-600" />
													<span className="text-sm font-medium">
														Tier 1: Fundamentals
													</span>
													<Badge
														variant="secondary"
														className="text-[9px] h-4 ml-auto"
													>
														{enrichmentProgress?.tiers?.tier1Percent ?? 0}%
													</Badge>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Ratios, Growth, Key Metrics, DCF, Ratings (20 calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs border-blue-500/30"
													disabled={isAnyMutationPending}
													onClick={() => enrichTier1Mutation.mutate()}
												>
													{enrichTier1Mutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<TrendingUp className="h-3 w-3 mr-1" />
													)}
													Enrich Tier 1
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2 border-emerald-500/30 bg-emerald-500/5">
												<div className="flex items-center gap-2">
													<Target className="h-4 w-4 text-emerald-600" />
													<span className="text-sm font-medium">
														Tier 2: Analyst & Events
													</span>
													<Badge
														variant="secondary"
														className="text-[9px] h-4 ml-auto"
													>
														{enrichmentProgress?.tiers?.tier2Percent ?? 0}%
													</Badge>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Targets, Grades, Earnings/Dividend/Split/IPO Calendar
													(15 calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs border-emerald-500/30"
													disabled={isAnyMutationPending}
													onClick={() => enrichTier2Mutation.mutate()}
												>
													{enrichTier2Mutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<TrendingUp className="h-3 w-3 mr-1" />
													)}
													Enrich Tier 2
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2 border-orange-500/30 bg-orange-500/5">
												<div className="flex items-center gap-2">
													<Eye className="h-4 w-4 text-orange-600" />
													<span className="text-sm font-medium">
														Tier 3: Intelligence
													</span>
													<Badge
														variant="secondary"
														className="text-[9px] h-4 ml-auto"
													>
														{enrichmentProgress?.tiers?.tier3Percent ?? 0}%
													</Badge>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Institutional, Insider, News, Sector, Technicals (10
													calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs border-orange-500/30"
													disabled={isAnyMutationPending}
													onClick={() => enrichTier3Mutation.mutate()}
												>
													{enrichTier3Mutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<TrendingUp className="h-3 w-3 mr-1" />
													)}
													Enrich Tier 3
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2 border-purple-500/30 bg-purple-500/5">
												<div className="flex items-center gap-2">
													<Activity className="h-4 w-4 text-purple-600" />
													<span className="text-sm font-medium">
														Tier 4: Prices & Market
													</span>
													<Badge
														variant="secondary"
														className="text-[9px] h-4 ml-auto"
													>
														{enrichmentProgress?.tiers?.tier4Percent ?? 0}%
													</Badge>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Price history, returns, market data (10 calls)
												</p>
												<Button
													size="sm"
													variant="outline"
													className="w-full h-7 text-xs border-purple-500/30"
													disabled={isAnyMutationPending}
													onClick={() => enrichTier4Mutation.mutate()}
												>
													{enrichTier4Mutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<TrendingUp className="h-3 w-3 mr-1" />
													)}
													Enrich Tier 4
												</Button>
											</div>

											<div className="border rounded-lg p-3 space-y-2 border-primary/30 bg-primary/5 md:col-span-2">
												<div className="flex items-center gap-2">
													<Zap className="h-4 w-4 text-primary" />
													<span className="text-sm font-medium">
														Priority Batch (All Tiers)
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground">
													Runs all 4 tiers with budget split: T1=40%, T2=30%,
													T3=20%, T4=10% (~240 API calls)
												</p>
												<Button
													size="sm"
													className="w-full h-7 text-xs"
													disabled={isAnyMutationPending}
													onClick={() => priorityBatchMutation.mutate()}
												>
													{priorityBatchMutation.isPending ? (
														<Loader2 className="h-3 w-3 animate-spin mr-1" />
													) : (
														<Play className="h-3 w-3 mr-1" />
													)}
													Run Priority Batch
												</Button>
											</div>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-2 pt-4 px-4">
										<CardTitle className="text-sm font-semibold flex items-center gap-2">
											<Info className="h-4 w-4" />
											FMP Endpoint Coverage
										</CardTitle>
									</CardHeader>
									<CardContent className="px-4 pb-4">
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
											<div className="space-y-2">
												<h4 className="font-semibold text-sm">
													Tier 1: Fundamentals (40% budget)
												</h4>
												<div className="space-y-1 text-muted-foreground">
													<p>/ratios — PE, PB, ROE, D/E, margins, EPS</p>
													<p>
														/financial-growth — Revenue, earnings, FCF growth
													</p>
													<p>/key-metrics — ROIC, Graham Number, EV ratios</p>
													<p>/discounted-cash-flow — Intrinsic value DCF</p>
													<p>/rating — FMP company rating (S&P style)</p>
													<p>/income-statement, /balance-sheet, /cash-flow</p>
												</div>
												<h4 className="font-semibold text-sm mt-3">
													Tier 2: Analyst & Events (30% budget)
												</h4>
												<div className="space-y-1 text-muted-foreground">
													<p>/price-target — Analyst consensus price targets</p>
													<p>/upgrades-downgrades — Rating changes</p>
													<p>/earning_calendar — Upcoming earnings</p>
													<p>/stock_dividend_calendar — Dividend dates</p>
													<p>/stock_split_calendar — Split events</p>
													<p>/ipo_calendar — Upcoming IPOs</p>
													<p>/economic_calendar — Economic events</p>
												</div>
											</div>
											<div className="space-y-2">
												<h4 className="font-semibold text-sm">
													Tier 3: Intelligence (20% budget)
												</h4>
												<div className="space-y-1 text-muted-foreground">
													<p>/institutional-holder — FII/DII ownership</p>
													<p>/insider-trading — Insider buy/sell activity</p>
													<p>/stock_news — Stock-specific news</p>
													<p>/sector-performance — Sector returns</p>
													<p>/technical_indicator — RSI, SMA, EMA, MACD</p>
												</div>
												<h4 className="font-semibold text-sm mt-3">
													Tier 4: Prices & Market (10% budget)
												</h4>
												<div className="space-y-1 text-muted-foreground">
													<p>/historical-price-full — 5Y price history</p>
													<p>/quote (batch) — Multi-symbol quotes</p>
													<p>/sector-performance — Market overview</p>
													<p>/market-risk-premium — Equity risk premium</p>
													<p>/treasury — Risk-free rates</p>
												</div>
												<h4 className="font-semibold text-sm mt-3">
													Scoring Engine
												</h4>
												<div className="space-y-1 text-muted-foreground">
													<p className="font-medium text-foreground">
														FintekRating: 1-5 stars (composite score)
													</p>
													<p>Growth 25% | Quality 30% | Value 25% | Risk 20%</p>
													<p>
														Growth blends fundamentals + price returns 50/50
													</p>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</CardContent>
					</TabsContent>
				</Card>
			</Tabs>

			{/* Distribution cards — skeleton while loading, real data when ready */}
			{!distribution ? (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardHeader className="pb-2 pt-4 px-4">
								<Skeleton className="h-3 w-36" />
							</CardHeader>
							<CardContent className="px-4 pb-4 space-y-2">
								{[1, 2, 3, 4, 5].map((j) => (
									<div key={j} className="flex items-center gap-2">
										<Skeleton className="w-2 h-2 rounded-full shrink-0" />
										<Skeleton className="flex-1 h-3" />
										<Skeleton className="w-12 h-3" />
									</div>
								))}
							</CardContent>
						</Card>
					))}
				</div>
			) : (
			<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
					<Card>
						<CardHeader className="pb-2 pt-4 px-4">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<PieChart className="h-3.5 w-3.5" />
								Market Cap Distribution
							</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="space-y-2">
								{distribution.marketCap?.map((d: any) => {
									const total = distribution.marketCap.reduce(
										(s: number, x: any) => s + Number(x.count),
										0,
									);
									const pct = total > 0 ? (Number(d.count) / total) * 100 : 0;
									return (
										<div
											key={d.category}
											className="flex items-center gap-2 text-xs"
										>
											<span
												className={`w-2 h-2 rounded-full ${MARKET_CAP_COLORS[d.category] || "bg-gray-400"}`}
											/>
											<span className="flex-1">{d.category}</span>
											<span className="font-mono text-muted-foreground">
												{Number(d.count).toLocaleString()}
											</span>
											<span className="font-mono w-12 text-right">
												{pct.toFixed(1)}%
											</span>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2 pt-4 px-4">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Star className="h-3.5 w-3.5" />
								Rating Distribution
							</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="space-y-2">
								{distribution.ratings?.map((d: any) => {
									const total = distribution.ratings.reduce(
										(s: number, x: any) => s + Number(x.count),
										0,
									);
									const pct = total > 0 ? (Number(d.count) / total) * 100 : 0;
									return (
										<div
											key={d.rating}
											className="flex items-center gap-2 text-xs"
										>
											<span
												className={`w-2 h-2 rounded-full ${RATING_COLORS[String(d.rating)] || "bg-gray-400"}`}
											/>
											<span className="flex-1 flex items-center gap-1">
												{d.rating} Star{d.rating !== 1 ? "s" : ""}
												<RatingStars rating={d.rating} />
											</span>
											<span className="font-mono text-muted-foreground">
												{Number(d.count).toLocaleString()}
											</span>
											<span className="font-mono w-12 text-right">
												{pct.toFixed(1)}%
											</span>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2 pt-4 px-4">
							<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
								<Target className="h-3.5 w-3.5" />
								Score Distribution
							</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="space-y-2">
								{distribution.scoreRanges?.map((d: any) => {
									const total = distribution.scoreRanges.reduce(
										(s: number, x: any) => s + Number(x.count),
										0,
									);
									const pct = total > 0 ? (Number(d.count) / total) * 100 : 0;
									return (
										<div
											key={d.range}
											className="flex items-center gap-2 text-xs"
										>
											<span
												className={`w-2 h-2 rounded-full ${SCORE_COLORS[d.range] || "bg-gray-400"}`}
											/>
											<span className="flex-1">Score {d.range}</span>
											<span className="font-mono text-muted-foreground">
												{Number(d.count).toLocaleString()}
											</span>
											<div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
												<div
													className={`h-full rounded-full ${SCORE_COLORS[d.range] || "bg-gray-400"}`}
													style={{ width: `${pct}%` }}
												/>
											</div>
											<span className="font-mono w-12 text-right">
												{pct.toFixed(1)}%
											</span>
										</div>
									);
								})}
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{distribution?.sectors && (
				<Card>
					<CardHeader className="pb-2 pt-4 px-4">
						<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
							<Building2 className="h-3.5 w-3.5" />
							Top {distribution.sectors.filter((d: any) => !d.pinned).length} Sectors · REIT · InvIT
						</CardTitle>
					</CardHeader>
					<CardContent className="px-4 pb-4">
						<SectorDistributionPanel
							sectors={distribution.sectors}
							onSectorClick={(sector) => {
								setDbSector(sector);
								setDbPage(1);
							}}
						/>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
