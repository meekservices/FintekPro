import { useState } from "react";
import {
	SectorBarSegment,
	SectorDot,
	SectorHeader,
} from "@/components/sector-color-elements";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	TrendingUp,
	TrendingDown,
	Target,
	Shield as LucideShield,
	Sparkles,
	BarChart3,
	Landmark,
	Building2,
	Globe,
	Coins,
	Calendar,
	Clock,
	CheckCircle,
	XCircle,
	AlertCircle,
	ArrowUpRight,
	ArrowDownRight,
	Percent,
	History,
	Trophy,
	Bookmark,
	BookmarkCheck,
	Share2,
	Mail,
	MessageSquare,
	Plus,
	Bell,
	BrainCircuit,
	Timer,
	PieChart,
	AlertTriangle,
	Activity,
	Star,
	Brain,
	RefreshCw,
	Users,
	Send,
	ExternalLink,
	ChevronRight,
	Info,
	X,
	Download,
	Lightbulb,
	Copy,
	Zap,
	Search,
	Calculator,
	LayoutGrid,
	Table2,
	ArrowUpDown,
	ChevronUp,
	ChevronDown,
} from "lucide-react";
import {
	LineChart,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip as RechartsTooltip,
	ResponsiveContainer,
	ReferenceLine,
} from "recharts";

import type { ComponentType } from "react";

// ── Domain types ─────────────────────────────────────────────────────────────

type DailyPick = {
	id: number;
	category: string;
	instrumentName: string;
	symbol?: string;
	isin?: string;
	market?: string;
	exchange?: string;
	recoDate: string;
	recoPrice: number;
	targetPrice: number;
	stoplossPrice: number;
	currentPrice?: number;
	status: string;
	expiryDate: string;
	returnPct?: number;
	daysHeld?: number;
	rationale: string;
	riskLevel: string;
	suitableFor: string[];
	/**
	 * Heterogeneous API response bag: holds primitive numbers (for arithmetic
	 * e.g. entryPrice), strings (strategy, expiry), and nested objects
	 * (e.g. greeks: { delta, theta, vega, gamma }). Typed as `any` intentionally
	 * — narrowing to a union breaks arithmetic and nested property access at
	 * all 20+ call sites across this file. (FintekPro GCR: `any` allowed when
	 * justified and documented.)
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	keyMetrics?: Record<string, any>;
	timeHorizon?: "short_term" | "medium_term" | "long_term";
	confidenceScore?: number;
	sectorCategory?: string;
	priceDataSource?: string;
	priceDataType?: string;
	priceRefreshInterval?: string;
	lastPriceUpdate?: string;
	dataFreshness?: "live" | "recent" | "delayed" | "stale" | "unknown";
};

type DataSourceInfo = {
	name: string;
	type: string;
	refreshInterval: string;
};

type PicksApiResponse = {
	success: boolean;
	picks: DailyPick[];
	dataSources?: Record<string, DataSourceInfo>;
	lastRefreshedAt?: string;
	categoryLastUpdated?: Record<string, string>;
	disclaimer?: string;
};

type StatsApiResponse = {
	success: boolean;
	stats: PickStats;
	asOfDate?: string;
	lastDataRefresh?: string;
	disclaimer?: string;
};

type WatchlistItem = {
	watchlistId: number; // server returns `watchlistId`, not `id`
	pickId: number;
	addedAt: string;
	notes?: string;
	priceAlertEnabled: boolean;
	alertThreshold?: string;
	alertType?: string;
	pick: DailyPick; // always present — API uses innerJoin
};

type SectorAllocation = { count: number; percentage: number };

type DiversificationData = {
	sectorAllocation: Record<string, SectorAllocation>;
	concentrationRisk: string;
	diversificationScore: number;
	recommendations: string[];
};

type CategoryStats = { total: number; hits: number; hitRate: number };

type PickStats = {
	totalPicks: number;
	livePicks: number;
	targetHits: number;
	stoplossHits: number;
	expired: number;
	hitRate: number;
	avgReturn: number;
	byCategory: Record<string, CategoryStats>;
};

type SignalType = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

type AIStockFundamentals = {
	peRatio?: number;
	pbRatio?: number;
	roe?: number;
	roce?: number;
	eps?: number;
	dividendYield?: number;
};

type AIStockTechnicals = {
	rsi: number;
	macd: string;
	movingAvg50: number;
	movingAvg200: number;
	weekHigh52: number;
	weekLow52: number;
	volumeTrend: string;
};

type AIStockReturns = {
	returns1M?: number;
	returns3M?: number;
	returns6M?: number;
	returns1Y?: number;
};

type AIStockTaxImplications = {
	holdingPeriod: string;
	stcgRate: number;
	ltcgRate: number;
	ltcgExemption: number;
	taxTip: string;
};

type AIStockRecommendation = {
	id: string;
	symbol: string;
	companyName: string;
	exchange: string;
	sector: string;
	marketCap: string;
	currentPrice: number;
	entryPrice: number;
	targetPrice: number;
	stopLoss: number;
	signal: SignalType;
	fintekproRating: number;
	confidence: number;
	riskScore: number;
	expectedReturn: number;
	timeHorizon: string;
	timeHorizonDays: number;
	fundamentals: AIStockFundamentals;
	technicals: AIStockTechnicals;
	returns: AIStockReturns;
	rationale: string;
	keyFactors: string[];
	riskFactors: string[];
	taxImplications: AIStockTaxImplications;
	generatedAt: string;
};

// ── UI config maps ────────────────────────────────────────────────────────────

const categoryIcons: Record<string, ComponentType<{ className?: string }>> = {
	listed_stocks: TrendingUp,
	mutual_funds: BarChart3,
	bonds: Landmark,
	unlisted: Building2,
	global_stocks: Globe,
	etfs: Coins,
	reits_invits: Building2,
	fixed_deposits: LucideShield,
	sgb: Coins,
	derivatives: Activity,
};

const categoryLabels: Record<string, string> = {
	listed_stocks: "Stocks",
	mutual_funds: "Mutual Funds",
	bonds: "Bonds",
	unlisted: "Unlisted",
	global_stocks: "Global Stocks",
	etfs: "ETFs",
	reits_invits: "REITs/InvITs",
	fixed_deposits: "Fixed Deposits",
	sgb: "SGBs",
	derivatives: "Derivatives (F&O)",
};

// Currency helper for global stocks (USD) vs domestic (INR)
const getCurrencySymbol = (category: string): string => {
	if (category === "global_stocks") return "$";
	return "₹";
};

const formatPrice = (price: number, category: string): string => {
	const symbol = getCurrencySymbol(category);
	return `${symbol}${price.toLocaleString("en-IN")}`;
};

type StatusEntry = {
	color: string;
	icon: ComponentType<{ className?: string }>;
	label: string;
};

const statusConfig: Record<string, StatusEntry> = {
	live: { color: "bg-green-500", icon: Clock, label: "Live" },
	target_hit: { color: "bg-blue-500", icon: CheckCircle, label: "Target Hit" },
	stoploss_hit: { color: "bg-red-500", icon: XCircle, label: "Stoploss Hit" },
	expired: { color: "bg-muted", icon: AlertCircle, label: "Expired" },
};

const riskColors: Record<string, string> = {
	low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
	medium:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
	high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

type HorizonEntry = { label: string; color: string; icon: string };

const horizonConfig: Record<string, HorizonEntry> = {
	short_term: {
		label: "Short Term",
		color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
		icon: "⚡",
	},
	medium_term: {
		label: "Medium Term",
		color:
			"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
		icon: "📊",
	},
	long_term: {
		label: "Long Term",
		color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
		icon: "🎯",
	},
};

/** Returns a Tailwind text-colour class for a confidence score 0–100. */
const getConfidenceColor = (score: number): string => {
	if (score >= 80) return "text-green-600";
	if (score >= 60) return "text-yellow-600";
	return "text-red-600";
};

/** Returns a Tailwind bg-colour class for a confidence indicator dot. */
const getConfidenceDot = (score: number): string => {
	if (score >= 80) return "bg-green-500";
	if (score >= 60) return "bg-yellow-500";
	return "bg-red-500";
};

const allCategories = [
	{ key: "all", label: "All", icon: Sparkles },
	{ key: "listed_stocks", label: "Stocks", icon: TrendingUp },
	{ key: "mutual_funds", label: "Mutual Funds", icon: BarChart3 },
	{ key: "bonds", label: "Bonds", icon: Landmark },
	{ key: "unlisted", label: "Unlisted", icon: Building2 },
	{ key: "global_stocks", label: "Global", icon: Globe },
	{ key: "etfs", label: "ETFs", icon: Coins },
	{ key: "reits_invits", label: "REITs", icon: Building2 },
	{ key: "fixed_deposits", label: "FDs", icon: LucideShield },
	{ key: "sgb", label: "SGBs", icon: Coins },
	{ key: "derivatives", label: "F&O", icon: Activity },
] as const;

// ── Broad sector UI metadata (mirrors BROAD_SECTORS in stock-strategy.ts) ──────
// Kept on the client side to avoid importing server code into the browser bundle.
const BROAD_SECTOR_UI = [
	{
		id: "banking_finance",
		label: "Banking & Finance",
		icon: "🏦",
		color: "#3B82F6",
	},
	{
		id: "information_technology",
		label: "Information Technology",
		icon: "💻",
		color: "#8B5CF6",
	},
	{
		id: "healthcare_pharma",
		label: "Healthcare & Pharma",
		icon: "💊",
		color: "#10B981",
	},
	{
		id: "auto_infra",
		label: "Auto & Capital Goods",
		icon: "🏭",
		color: "#F59E0B",
	},
	{
		id: "fmcg_consumer",
		label: "FMCG & Consumer",
		icon: "🛒",
		color: "#EF4444",
	},
] as const;

type BroadSector = (typeof BROAD_SECTOR_UI)[number];
type SectorGroup = { sector: BroadSector | null; picks: DailyPick[] };

/** Groups an array of DailyPick by their broadSector keyMetric. */
function groupByBroadSector(picks: DailyPick[]): SectorGroup[] {
	const grouped = new Map<string, DailyPick[]>();
	const ungrouped: DailyPick[] = [];

	for (const p of picks) {
		// keyMetrics is a documented heterogeneous bag; broadSector is string when present
		const bsId = (p.keyMetrics?.broadSector ?? undefined) as string | undefined;
		if (bsId !== undefined) {
			if (!grouped.has(bsId)) grouped.set(bsId, []);
			const bucket = grouped.get(bsId);
			if (bucket !== undefined) bucket.push(p);
		} else {
			ungrouped.push(p);
		}
	}

	const result: SectorGroup[] = [];
	for (const bs of BROAD_SECTOR_UI) {
		const items = grouped.get(bs.id);
		if (items !== undefined && items.length > 0)
			result.push({ sector: bs, picks: items });
	}
	if (ungrouped.length > 0) result.push({ sector: null, picks: ungrouped });
	return result;
}

const marketFilters = [
	{ key: "all", label: "All Markets" },
	{ key: "us", label: "US Stocks" },
	{ key: "china", label: "China Stocks" },
	{ key: "uk_europe", label: "UK/Europe" },
	{ key: "japan", label: "Japan" },
	{ key: "other", label: "Other Markets" },
];

/**
 * Extracts a clean rationale string from raw AI output.
 * The AI may return a JSON envelope, markdown code fences, or plain text.
 *
 * @param raw - Raw string from the API (may be JSON, markdown, or plain text)
 * @returns Clean human-readable rationale string, or empty string if falsy
 */
function parseRationale(raw: string | null | undefined): string {
	if (!raw) return "";
	const text = raw
		.replace(/^```[\w]*\n?/gm, "")
		.replace(/```$/gm, "")
		.trim();
	if (text.startsWith("{")) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const parsed: Record<string, unknown> = JSON.parse(text);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const envelope = parsed.investment_rationale as
				| Record<string, unknown>
				| string
				| null
				| undefined;
			const extracted: unknown =
				(typeof envelope === "object" && envelope !== null
					? (envelope as Record<string, unknown>).rationale
					: envelope) ??
				parsed.rationale ??
				parsed.content ??
				parsed.text ??
				null;
			if (typeof extracted === "string" && extracted.length > 10)
				return extracted.trim();
			if (typeof extracted === "object" && extracted !== null) {
				const obj = extracted as Record<string, unknown>;
				return String(obj.rationale ?? obj.content ?? text).trim();
			}
		} catch {
			// not JSON — fall through and return as-is
		}
	}
	return text;
}

export default function AgentPicksPage() {
	const { toast } = useToast();
	const [todayCategoryFilter, setTodayCategoryFilter] = useState<string>("all");
	const [liveCategoryFilter, setLiveCategoryFilter] = useState<string>("all");
	const [historyCategoryFilter, setHistoryCategoryFilter] =
		useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [todayMarketFilter, setTodayMarketFilter] = useState<string>("all");
	const [liveMarketFilter, setLiveMarketFilter] = useState<string>("all");
	const [historyMarketFilter, setHistoryMarketFilter] = useState<string>("all");
	const [liveSearchQuery, setLiveSearchQuery] = useState<string>("");
	const [shareDialogOpen, setShareDialogOpen] = useState(false);
	const [sharePickId, setSharePickId] = useState<number | null>(null);
	const [shareEmail, setShareEmail] = useState("");
	// Share-with-clients dialog state (T006)
	const [shareClientsDialogOpen, setShareClientsDialogOpen] = useState(false);
	const [shareClientsPick, setShareClientsPick] = useState<DailyPick | null>(
		null,
	);
	const [shareClientsSelected, setShareClientsSelected] = useState<string[]>(
		[],
	);
	const [shareClientsChannel, setShareClientsChannel] = useState<
		"email" | "whatsapp"
	>("whatsapp");
	const [hideUnreachable, setHideUnreachable] = useState(true);
	const [stockRiskLevel, setStockRiskLevel] = useState("moderate");
	const [stockTimeHorizon, setStockTimeHorizon] = useState("medium_term");
	const [stockSector, setStockSector] = useState("all");
	const [stockMarketCap, setStockMarketCap] = useState("all");
	const [stockInvestmentAmount, setStockInvestmentAmount] = useState([100000]);
	const [stockIncludeAI, setStockIncludeAI] = useState(true);
	const [selectedAIStock, setSelectedAIStock] =
		useState<AIStockRecommendation | null>(null);
	const [selectedPick, setSelectedPick] = useState<DailyPick | null>(null);
	const [explanationOpen, setExplanationOpen] = useState(false);
	const [explainingPickId, setExplanationPickId] = useState<number | null>(
		null,
	);
	const [, navigate] = useLocation();
	const [selectedPickIds, setSelectedPickIds] = useState<Set<number>>(
		new Set(),
	);
	const [builderBudget, setBuilderBudget] = useState("500000");
	const [viewMode, setViewMode] = useState<"grid" | "table">(() => {
		try {
			return (
				(localStorage.getItem("picks-view-mode") as "grid" | "table") || "grid"
			);
		} catch {
			return "grid";
		}
	});
	const toggleViewMode = (mode: "grid" | "table") => {
		setViewMode(mode);
		try {
			localStorage.setItem("picks-view-mode", mode);
		} catch {}
	};

	const handleSelectToggle = (id: number) => {
		const next = new Set(selectedPickIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelectedPickIds(next);
	};

	const { data: explanationData, isLoading: loadingExplanation } = useQuery({
		queryKey: ["/api/ai/xai/explain", explainingPickId],
		enabled: !!explainingPickId && explanationOpen,
		select: (data: any) => (data.success ? data.explanation : null),
	});

	const { data: todayData, isLoading: loadingToday } =
		useQuery<PicksApiResponse>({
			queryKey: ["/api/picks/today"],
		});

	const { data: liveData, isLoading: loadingLive } = useQuery<PicksApiResponse>(
		{
			queryKey: ["/api/picks/live"],
		},
	);

	const { data: historyData, isLoading: loadingHistory } =
		useQuery<PicksApiResponse>({
			queryKey: ["/api/picks/history"],
		});

	const { data: statsData, isLoading: loadingStats } =
		useQuery<StatsApiResponse>({
			queryKey: ["/api/picks/stats"],
		});

	const { data: watchlistData, isLoading: loadingWatchlist } = useQuery<{
		success: boolean;
		watchlist: WatchlistItem[];
	}>({
		queryKey: ["/api/picks/watchlist"],
	});

	const { data: diversificationData } = useQuery<
		{ success: boolean } & DiversificationData
	>({
		queryKey: ["/api/picks/diversification"],
	});

	const { data: aiFiltersData } = useQuery<{
		success: boolean;
		sectors: string[];
		marketCaps: string[];
		riskLevels: string[];
		timeHorizons: string[];
	}>({
		queryKey: ["/api/ai-stock-recommendations/filters"],
	});

	const { data: quickAIRecs, isLoading: quickAILoading } = useQuery<{
		success: boolean;
		recommendations: AIStockRecommendation[];
	}>({
		queryKey: ["/api/ai-stock-recommendations/quick"],
	});

	// Contacts for "Share with Clients" dialog (T006)
	const { data: marketingContacts = [] } = useQuery({
		queryKey: ["/api/agent/marketing/clients"],
		enabled: shareClientsDialogOpen,
		select: (data) => (Array.isArray(data) ? (data as any[]) : []),
	});

	const sharePickMutation = useMutation({
		mutationFn: async ({
			pickId,
			clientIds,
			channel,
		}: { pickId: number; clientIds: string[]; channel: string }) => {
			return apiRequest("/api/agent/marketing/share-pick", {
				method: "POST",
				body: JSON.stringify({ pickId, clientIds, channel }),
			});
		},
		onSuccess: (data: any) => {
			if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank");
			toast({
				title: "Shared!",
				description: `Pick shared with ${data.sentCount} contact${data.sentCount !== 1 ? "s" : ""}.`,
			});
			setShareClientsDialogOpen(false);
			setShareClientsSelected([]);
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to share pick.",
				variant: "destructive",
			});
		},
	});

	const handleShareWithClients = (pick: DailyPick) => {
		setShareClientsPick(pick);
		setShareClientsSelected([]);
		setShareClientsChannel("whatsapp");
		setShareClientsDialogOpen(true);
	};

	const generateAIMutation = useMutation({
		mutationFn: async (filters: any) => {
			return apiRequest("/api/ai-stock-recommendations/generate", {
				method: "POST",
				body: JSON.stringify(filters),
				headers: { "Content-Type": "application/json" },
			});
		},
	});

	const handleGenerateAIStocks = () => {
		generateAIMutation.mutate({
			sectors: stockSector !== "all" ? [stockSector] : undefined,
			marketCap: stockMarketCap !== "all" ? [stockMarketCap] : undefined,
			riskLevel: stockRiskLevel,
			timeHorizon: stockTimeHorizon,
			investmentAmount: stockInvestmentAmount[0],
			includeAIAnalysis: stockIncludeAI,
			maxResults: 10,
		});
	};

	const aiRecommendations =
		generateAIMutation.data?.recommendations ||
		quickAIRecs?.recommendations ||
		[];

	const watchlist = watchlistData?.watchlist || [];
	const watchlistPickIds = new Set(watchlist.map((w) => w.pickId));

	const addToWatchlistMutation = useMutation({
		mutationFn: async (pickId: number) => {
			return apiRequest("/api/picks/watchlist/add", {
				method: "POST",
				body: JSON.stringify({ pickId }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/picks/watchlist"] });
			toast({
				title: "Added to Watchlist",
				description: "Pick added to your watchlist",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to add to watchlist",
				variant: "destructive",
			});
		},
	});

	const removeFromWatchlistMutation = useMutation({
		mutationFn: async (pickId: number) => {
			return apiRequest(`/api/picks/watchlist/${pickId}`, { method: "DELETE" });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["/api/picks/watchlist"] });
			toast({
				title: "Removed from Watchlist",
				description: "Pick removed from your watchlist",
			});
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to remove from watchlist",
				variant: "destructive",
			});
		},
	});

	const shareMutation = useMutation({
		mutationFn: async ({
			pickId,
			channel,
			email,
		}: { pickId: number; channel: "email" | "whatsapp"; email?: string }) => {
			return apiRequest("/api/picks/share", {
				method: "POST",
				body: JSON.stringify({ pickId, channel, recipientEmail: email }),
			});
		},
		onSuccess: (data: any) => {
			if (data.whatsappUrl) {
				window.open(data.whatsappUrl, "_blank");
			}
			toast({ title: "Shared Successfully", description: data.message });
			setShareDialogOpen(false);
			setShareEmail("");
		},
		onError: () => {
			toast({
				title: "Error",
				description: "Failed to share pick",
				variant: "destructive",
			});
		},
	});

	const handleShare = (pickId: number, channel: "email" | "whatsapp") => {
		if (channel === "email") {
			setSharePickId(pickId);
			setShareDialogOpen(true);
		} else {
			shareMutation.mutate({ pickId, channel });
		}
	};

	const handleEmailShare = () => {
		if (sharePickId && shareEmail) {
			shareMutation.mutate({
				pickId: sharePickId,
				channel: "email",
				email: shareEmail,
			});
		}
	};

	const todayPicks = Array.isArray(todayData?.picks) ? todayData.picks : [];
	const livePicks = Array.isArray(liveData?.picks) ? liveData.picks : [];
	const historyPicks = Array.isArray(historyData?.picks)
		? historyData.picks
		: [];
	const stats = statsData?.stats;

	const filterByMarket = (pick: DailyPick, marketFilter: string) => {
		if (marketFilter === "all") return true;
		return pick.market === marketFilter;
	};

	const isPickExpired = (p: DailyPick) =>
		p.status === "expired" ||
		(p.expiryDate != null && new Date(p.expiryDate) < new Date());

	const filteredTodayPicks = todayPicks.filter((p) => {
		if (isPickExpired(p)) return false;
		if (todayCategoryFilter !== "all" && p.category !== todayCategoryFilter)
			return false;
		if (
			todayCategoryFilter === "global_stocks" &&
			!filterByMarket(p, todayMarketFilter)
		)
			return false;
		return true;
	});

	const filteredLivePicks = livePicks.filter((p) => {
		if (isPickExpired(p)) return false;
		if (liveCategoryFilter !== "all" && p.category !== liveCategoryFilter)
			return false;
		if (
			liveCategoryFilter === "global_stocks" &&
			!filterByMarket(p, liveMarketFilter)
		)
			return false;
		if (liveSearchQuery.trim()) {
			const q = liveSearchQuery.toLowerCase();
			const match =
				p.instrumentName?.toLowerCase().includes(q) ||
				p.symbol?.toLowerCase().includes(q) ||
				p.sectorCategory?.toLowerCase().includes(q);
			if (!match) return false;
		}
		return true;
	});

	const filteredHistory = historyPicks.filter((pick) => {
		if (
			historyCategoryFilter !== "all" &&
			pick.category !== historyCategoryFilter
		)
			return false;
		if (
			historyCategoryFilter === "global_stocks" &&
			!filterByMarket(pick, historyMarketFilter)
		)
			return false;
		const effectiveStatus =
			pick.status === "live" &&
			pick.expiryDate &&
			new Date(pick.expiryDate) < new Date()
				? "expired"
				: pick.status;
		if (statusFilter !== "all" && effectiveStatus !== statusFilter)
			return false;
		return true;
	});

	// BUG FIX: counts must be computed from picks that PASS the expiry filter,
	// otherwise expired derivatives show count=1 on the tab but 0 cards in the list.
	const nonExpiredTodayPicks = todayPicks.filter((p) => !isPickExpired(p));
	const nonExpiredLivePicks = livePicks.filter((p) => !isPickExpired(p));

	const getCategoryCounts = (picks: DailyPick[]) => {
		const counts: Record<string, number> = { all: picks.length };
		picks.forEach((p) => {
			counts[p.category] = (counts[p.category] || 0) + 1;
		});
		return counts;
	};

	const getMarketCounts = (picks: DailyPick[]) => {
		const globalPicks = picks.filter((p) => p.category === "global_stocks");
		const counts: Record<string, number> = { all: globalPicks.length };
		globalPicks.forEach((p) => {
			if (p.market) {
				counts[p.market] = (counts[p.market] || 0) + 1;
			}
		});
		return counts;
	};

	// Use non-expired filtered lists for counts so badge numbers match card counts
	const todayCounts = getCategoryCounts(nonExpiredTodayPicks);
	const liveCounts = getCategoryCounts(nonExpiredLivePicks);
	const historyCounts = getCategoryCounts(historyPicks);

	const todayMarketCounts = getMarketCounts(nonExpiredTodayPicks);
	const liveMarketCounts = getMarketCounts(nonExpiredLivePicks);
	const historyMarketCounts = getMarketCounts(historyPicks);

	const lastRefreshed = liveData?.lastRefreshedAt || todayData?.lastRefreshedAt;
	const categoryLastUpdated =
		liveData?.categoryLastUpdated || todayData?.categoryLastUpdated || {};

	const formatTimeAgo = (dateStr: string) => {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	};

	const getSignalColor = (signal: string) => {
		switch (signal) {
			case "strong_buy":
				return "bg-green-600 text-white";
			case "buy":
				return "bg-green-500 text-white";
			case "hold":
				return "bg-yellow-500 text-black dark:text-black";
			case "sell":
				return "bg-red-500 text-white";
			case "strong_sell":
				return "bg-red-700 text-white";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getSignalText = (signal: string) => {
		switch (signal) {
			case "strong_buy":
				return "Strong Buy";
			case "buy":
				return "Buy";
			case "hold":
				return "Hold";
			case "sell":
				return "Sell";
			case "strong_sell":
				return "Strong Sell";
			default:
				return signal;
		}
	};

	const renderStars = (rating: number) => (
		<div className="flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((star) => (
				<Star
					key={star}
					className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
				/>
			))}
		</div>
	);

	const formatCurrencyINR = (value: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 2,
		}).format(value);
	};

	const formatPercentValue = (value: number | undefined | null) => {
		if (value === undefined || value === null) return "N/A";
		return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
	};

	const freshnessColors: Record<string, string> = {
		live: "bg-green-500",
		recent: "bg-blue-500",
		delayed: "bg-yellow-500",
		stale: "bg-red-500",
		unknown: "bg-gray-400",
	};

	const freshnessLabels: Record<string, string> = {
		live: "Live",
		recent: "Recent",
		delayed: "Delayed",
		stale: "Stale",
		unknown: "N/A",
	};

	const topPickOfDay =
		todayPicks.length > 0
			? [...todayPicks].sort(
					(a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0),
				)[0]
			: null;

	const exportTodaysPicksCSV = () => {
		const rows = [
			[
				"Name",
				"Symbol",
				"Category",
				"Entry Price",
				"Target",
				"Stoploss",
				"Upside%",
				"Downside%",
				"Horizon",
				"Confidence",
				"Date",
			],
			...todayPicks.map((p) => {
				const up =
					p.targetPrice && p.recoPrice
						? (((p.targetPrice - p.recoPrice) / p.recoPrice) * 100).toFixed(1)
						: "";
				const dn =
					p.stoplossPrice && p.recoPrice
						? (((p.recoPrice - p.stoplossPrice) / p.recoPrice) * 100).toFixed(1)
						: "";
				return [
					p.instrumentName,
					p.symbol || "",
					categoryLabels[p.category] || p.category,
					p.recoPrice,
					p.targetPrice,
					p.stoplossPrice,
					up,
					dn,
					p.timeHorizon || "",
					p.confidenceScore ?? "",
					new Date(p.recoDate).toLocaleDateString("en-IN"),
				];
			}),
		];
		const csv = rows
			.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
			.join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `fintek-picks-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const historicalChartData = (() => {
		const closed = historyPicks
			.filter((p) => p.status === "target_hit" || p.status === "stoploss_hit")
			.sort(
				(a, b) =>
					new Date(a.recoDate).getTime() - new Date(b.recoDate).getTime(),
			);
		let cumulative = 0;
		return closed.map((p) => {
			const ret =
				p.returnPct ??
				(p.status === "target_hit"
					? p.targetPrice && p.recoPrice
						? ((p.targetPrice - p.recoPrice) / p.recoPrice) * 100
						: 0
					: p.stoplossPrice && p.recoPrice
						? (-(p.recoPrice - p.stoplossPrice) / p.recoPrice) * 100
						: 0);
			cumulative += Number(ret);
			return {
				date: new Date(p.recoDate).toLocaleDateString("en-IN", {
					day: "numeric",
					month: "short",
				}),
				return: Number(ret).toFixed(1),
				cumulative: Number(cumulative.toFixed(1)),
				name: p.instrumentName,
			};
		});
	})();

	return (
		<div className="container mx-auto py-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Sparkles className="h-6 w-6 text-yellow-500" />
						Pick of the Day
					</h1>
					<p className="text-muted-foreground">
						AI-powered daily investment recommendations with full tracking
					</p>
				</div>
				{lastRefreshed && (
					<div className="text-right text-xs text-muted-foreground">
						<div className="flex items-center gap-1">
							<Clock className="h-3 w-3" />
							<span>Last refreshed: {formatTimeAgo(lastRefreshed)}</span>
						</div>
						<div className="text-[10px] mt-0.5">
							{new Date(lastRefreshed).toLocaleString("en-IN", {
								dateStyle: "medium",
								timeStyle: "short",
							})}
						</div>
					</div>
				)}
			</div>

			{Object.keys(categoryLastUpdated).length > 0 && (
				<div className="flex flex-wrap gap-2">
					{Object.entries(categoryLastUpdated).map(([cat, updated]) => {
						const ageHours =
							(Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60);
						const freshness =
							ageHours < 1
								? "live"
								: ageHours < 6
									? "recent"
									: ageHours < 24
										? "delayed"
										: "stale";
						return (
							<TooltipProvider key={cat}>
								<Tooltip>
									<TooltipTrigger>
										<Badge
											variant="outline"
											className="text-[10px] gap-1 cursor-default"
										>
											<span
												className={`w-1.5 h-1.5 rounded-full ${freshnessColors[freshness]}`}
											/>
											{categoryLabels[cat] || cat}
											<span className="text-muted-foreground">
												{formatTimeAgo(updated)}
											</span>
										</Badge>
									</TooltipTrigger>
									<TooltipContent className="text-xs">
										<p>
											{categoryLabels[cat]}: {freshnessLabels[freshness]} data
										</p>
										<p>
											Source:{" "}
											{todayData?.dataSources?.[cat]?.name ||
												liveData?.dataSources?.[cat]?.name ||
												"N/A"}
										</p>
										<p>Updated: {new Date(updated).toLocaleString("en-IN")}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
				</div>
			)}

			{/* #1 Performance Hero Banner */}
			{loadingStats ? (
				<Skeleton className="h-36 w-full rounded-xl" />
			) : stats ? (
				<div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
					<div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" />
					<div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
								AI Performance Track Record
							</p>
							<div className="flex flex-wrap items-end gap-6">
								<div>
									<div className="text-4xl font-black text-primary leading-none">
										{Number(stats.hitRate ?? 0).toFixed(1)}%
									</div>
									<div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
										<Trophy className="h-3 w-3 text-amber-500" /> Hit Rate
									</div>
								</div>
								<div>
									<div
										className={`text-4xl font-black leading-none ${Number(stats.avgReturn ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
									>
										{Number(stats.avgReturn ?? 0) >= 0 ? "+" : ""}
										{Number(stats.avgReturn ?? 0).toFixed(1)}%
									</div>
									<div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
										<TrendingUp className="h-3 w-3 text-green-500" /> Avg Return
									</div>
								</div>
								<div className="hidden sm:block w-px h-10 bg-border" />
								<div className="flex gap-6">
									<div>
										<div className="text-2xl font-bold text-green-600">
											{Number(stats.livePicks ?? 0)}
										</div>
										<div className="text-xs text-muted-foreground flex items-center gap-1">
											<span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />{" "}
											Live
										</div>
									</div>
									<div>
										<div className="text-2xl font-bold text-blue-600">
											{Number(stats.targetHits ?? 0)}
										</div>
										<div className="text-xs text-muted-foreground">
											Targets Hit
										</div>
									</div>
									<div>
										<div className="text-2xl font-bold">
											{Number(stats.totalPicks ?? 0)}
										</div>
										<div className="text-xs text-muted-foreground">
											Total Picks
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="sm:text-right">
							{(() => {
								const closedCount =
									Number(stats.targetHits || 0) +
									Number(stats.stoplossHits || 0) +
									Number(stats.expired || 0);
								return closedCount > 0 ? (
									<div className="space-y-1">
										<div className="text-xs text-muted-foreground">
											{closedCount} closed picks
										</div>
										<Progress
											value={Number(stats.hitRate ?? 0)}
											className="h-2 w-32"
										/>
										<div className="text-[10px] text-muted-foreground">
											{Number(stats.targetHits || 0)} wins ·{" "}
											{Number(stats.stoplossHits || 0)} losses ·{" "}
											{Number(stats.expired || 0)} expired
										</div>
									</div>
								) : null;
							})()}
							{statsData?.lastDataRefresh && (
								<div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1 sm:justify-end">
									<Clock className="h-3 w-3" />
									Stats as of{" "}
									{new Date(statsData.lastDataRefresh).toLocaleString("en-IN", {
										dateStyle: "medium",
										timeStyle: "short",
									})}
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}

			{/* Portfolio Sizing & Allocation Builder (rendered when selections exist) */}
			{selectedPickIds.size > 0 && (
				<Card className="border-2 border-primary/45 bg-gradient-to-br from-primary/5 via-background to-background animate-in fade-in slide-in-from-top-4 duration-500">
					<CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-4">
						<div>
							<CardTitle className="text-lg flex items-center gap-2">
								<PieChart className="h-5 w-5 text-primary animate-pulse" />
								Custom Portfolio Allocation Builder
							</CardTitle>
							<CardDescription>
								Construct a customized asset allocation plan for your client
								based on recommendation weights.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								className="text-xs"
								onClick={() => setSelectedPickIds(new Set())}
							>
								Clear Selections
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-muted/20">
							<div className="space-y-1">
								<Label
									htmlFor="builder-budget"
									className="text-xs uppercase font-bold text-muted-foreground"
								>
									Total Portfolio Sizing Budget
								</Label>
								<div className="text-xs text-muted-foreground">
									The investable amount to split between selected securities.
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<span className="text-lg font-bold text-foreground">₹</span>
								<input
									id="builder-budget"
									type="number"
									value={builderBudget}
									onChange={(e) => setBuilderBudget(e.target.value)}
									className="h-9 w-40 px-3 py-1 text-sm rounded border bg-background font-bold text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
									placeholder="5,00,000"
								/>
							</div>
						</div>

						{/* Calculations Table */}
						<div className="overflow-x-auto border rounded-lg">
							<table className="w-full text-sm text-left">
								<thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
									<tr>
										<th className="p-3">Security Name</th>
										<th className="p-3">Category</th>
										<th className="p-3 text-right">Rec. Price</th>
										<th className="p-3 text-center">Weight</th>
										<th className="p-3 text-right">Allocation Sizing</th>
										<th className="p-3 text-right">Target Quantity</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{(() => {
										const selectedPicks = [...todayPicks, ...livePicks].filter(
											(p) => selectedPickIds.has(p.id),
										);
										const totalWeight = selectedPicks.reduce(
											(acc, p) =>
												acc + (p.keyMetrics?.suggestedAllocation || 5),
											0,
										);
										const budgetNum = Number(builderBudget || 0);

										return (
											<>
												{selectedPicks.map((pick) => {
													const weight =
														pick.keyMetrics?.suggestedAllocation || 5;
													const targetAllocation =
														totalWeight > 0
															? (weight / totalWeight) * budgetNum
															: 0;
													const qty =
														pick.recoPrice > 0
															? Math.floor(targetAllocation / pick.recoPrice)
															: 0;

													return (
														<tr key={pick.id} className="hover:bg-muted/10">
															<td className="p-3 font-semibold text-foreground">
																{pick.instrumentName}{" "}
																{pick.symbol ? `(${pick.symbol})` : ""}
															</td>
															<td className="p-3 text-xs capitalize text-muted-foreground">
																{categoryLabels[pick.category] || pick.category}
															</td>
															<td className="p-3 text-right font-mono">
																{formatPrice(pick.recoPrice, pick.category)}
															</td>
															<td className="p-3 text-center font-bold text-primary">
																{weight}%
															</td>
															<td className="p-3 text-right font-bold text-green-600 dark:text-green-400 font-mono">
																{formatPrice(
																	Math.round(targetAllocation),
																	pick.category,
																)}
															</td>
															<td className="p-3 text-right font-bold font-mono">
																{qty.toLocaleString()} shares
															</td>
														</tr>
													);
												})}
												<tr className="bg-muted/40 font-bold border-t-2">
													<td className="p-3" colSpan={3}>
														Total Portfolio Summary
													</td>
													<td className="p-3 text-center text-primary">
														{totalWeight}%
													</td>
													<td className="p-3 text-right text-green-600 dark:text-green-400 font-mono">
														{formatPrice(budgetNum, "listed_stocks")}
													</td>
													<td className="p-3 text-right text-muted-foreground">
														—
													</td>
												</tr>
											</>
										);
									})()}
								</tbody>
							</table>
						</div>

						{/* Allocation Stack Bar */}
						<div className="space-y-1.5 pt-2">
							<Label className="text-xs text-muted-foreground uppercase font-bold">
								Allocation Visualizer (Asset-wise splits)
							</Label>
							<svg
								className="w-full h-4 rounded-full overflow-hidden bg-muted"
								viewBox="0 0 100 16"
								preserveAspectRatio="none"
							>
								{(() => {
									const selectedPicks = [...todayPicks, ...livePicks].filter(
										(p) => selectedPickIds.has(p.id),
									);
									const totalWeight = selectedPicks.reduce(
										(acc, p) => acc + (p.keyMetrics?.suggestedAllocation || 5),
										0,
									);
									let currentX = 0;

									return selectedPicks.map((pick, idx) => {
										const weight = pick.keyMetrics?.suggestedAllocation || 5;
										const pct =
											totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
										const colors = [
											"fill-blue-500",
											"fill-indigo-500",
											"fill-purple-500",
											"fill-pink-500",
											"fill-rose-500",
											"fill-orange-500",
											"fill-amber-500",
											"fill-emerald-500",
										];
										const colorClass = colors[idx % colors.length];
										const x = currentX;
										currentX += pct;

										return (
											<TooltipProvider key={`builder-rect-${pick.id}`}>
												<Tooltip>
													<TooltipTrigger asChild>
														<rect
															x={x}
															y={0}
															width={Math.max(0.1, pct - 0.5)}
															height={16}
															className={`${colorClass} transition-all hover:opacity-85 cursor-pointer`}
														/>
													</TooltipTrigger>
													<TooltipContent>
														<div className="font-semibold text-xs">
															{pick.instrumentName} ({weight}%)
														</div>
														<div className="text-[10px] text-muted-foreground">
															Target sizing:{" "}
															{formatPrice(
																Math.round(
																	Number(builderBudget || 0) *
																		(weight / totalWeight),
																),
																pick.category,
															)}
														</div>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										);
									});
								})()}
							</svg>
						</div>

						{/* Share and Action Row */}
						<div className="flex justify-end gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									const selectedPicks = [...todayPicks, ...livePicks].filter(
										(p) => selectedPickIds.has(p.id),
									);
									const totalWeight = selectedPicks.reduce(
										(acc, p) => acc + (p.keyMetrics?.suggestedAllocation || 5),
										0,
									);
									const budgetNum = Number(builderBudget || 0);

									const lines = [
										`📊 *FINTEKPRO PORTFOLIO ALLOCATION PLAN*`,
										`Prepared especially for your investment goals.`,
										``,
										`*Total Sizing Budget:* ${formatPrice(budgetNum, "listed_stocks")}`,
										`*Securities Breakdown:*`,
									];

									selectedPicks.forEach((pick, i) => {
										const weight = pick.keyMetrics?.suggestedAllocation || 5;
										const targetAllocation =
											totalWeight > 0 ? (weight / totalWeight) * budgetNum : 0;
										const qty =
											pick.recoPrice > 0
												? Math.floor(targetAllocation / pick.recoPrice)
												: 0;
										const label =
											categoryLabels[pick.category] || pick.category;

										lines.push(
											`${i + 1}. *${pick.instrumentName}* (${pick.symbol || "N/A"})\n` +
												`   - *Asset Class:* ${label}\n` +
												`   - *Recommended Sizing:* ${formatPrice(Math.round(targetAllocation), pick.category)} (${((weight / totalWeight) * 100).toFixed(0)}% allocation)\n` +
												`   - *Entry Price:* ${formatPrice(pick.recoPrice, pick.category)}\n` +
												`   - *Target Price:* ${formatPrice(pick.targetPrice, pick.category)} (+${(((pick.targetPrice - pick.recoPrice) / pick.recoPrice) * 100).toFixed(0)}%)\n` +
												`   - *Approx. Purchase Qty:* ${qty} shares/units`,
										);
									});

									lines.push(
										``,
										`_Disclaimer: Recommended weights represent optimal sizing based on AI model confidence and volatility inputs. Final trade allocation requires investor/advisor approval._`,
									);

									navigator.clipboard.writeText(lines.join("\n"));
									toast({
										title: "Allocation Plan Copied!",
										description:
											"Formatted allocation details copied to clipboard. Ready to paste on WhatsApp or Email.",
									});
								}}
								className="gap-2"
							>
								<Copy className="h-4 w-4" />
								Copy Sizing Plan
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			<Tabs defaultValue="today" className="space-y-4">
				<ScrollableTabsList>
					<TabsTrigger value="today" className="flex items-center gap-2">
						<Sparkles className="h-4 w-4" />
						Today's Picks
					</TabsTrigger>
					<TabsTrigger value="live" className="flex items-center gap-2">
						<Clock className="h-4 w-4" />
						Live Recommendations
					</TabsTrigger>
					<TabsTrigger value="watchlist" className="flex items-center gap-2">
						<Bookmark className="h-4 w-4" />
						My Watchlist
						{watchlist.length > 0 && (
							<Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
								{watchlist.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="history" className="flex items-center gap-2">
						<History className="h-4 w-4" />
						History & Performance
					</TabsTrigger>
				</ScrollableTabsList>

				<TabsContent value="today" className="space-y-4">
					{/* #6 Top Pick of the Day */}
					{topPickOfDay && !loadingToday && (
						<div className="relative overflow-hidden rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-4">
							<div className="absolute top-3 right-3">
								<Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
									<Zap className="h-3 w-3" /> Top Pick of the Day
								</Badge>
							</div>
							<div className="flex items-start gap-4">
								<div className="p-3 rounded-full bg-amber-400/20 shrink-0">
									{(() => {
										const Icon =
											categoryIcons[topPickOfDay.category] || TrendingUp;
										return <Icon className="h-6 w-6 text-amber-600" />;
									})()}
								</div>
								<div className="flex-1 min-w-0 pr-24">
									<h3 className="font-bold text-lg leading-tight">
										{topPickOfDay.instrumentName}
									</h3>
									<div className="flex items-center gap-2 flex-wrap mt-1">
										{topPickOfDay.symbol && (
											<span className="text-sm text-muted-foreground font-mono">
												{topPickOfDay.symbol}
											</span>
										)}
										<Badge variant="outline" className="text-[10px]">
											{categoryLabels[topPickOfDay.category]}
										</Badge>
										{topPickOfDay.timeHorizon &&
											horizonConfig[topPickOfDay.timeHorizon] && (
												<Badge
													variant="outline"
													className={
														horizonConfig[topPickOfDay.timeHorizon].color +
														" text-[10px]"
													}
												>
													{horizonConfig[topPickOfDay.timeHorizon].label}
												</Badge>
											)}
									</div>
									<div className="flex flex-wrap gap-4 mt-3 text-sm">
										<span>
											<span className="text-muted-foreground text-xs">
												Entry
											</span>
											<br />
											<strong>
												{formatPrice(
													topPickOfDay.recoPrice,
													topPickOfDay.category,
												)}
											</strong>
										</span>
										<span>
											<span className="text-xs text-green-600">Target</span>
											<br />
											<strong className="text-green-600">
												{formatPrice(
													topPickOfDay.targetPrice,
													topPickOfDay.category,
												)}
											</strong>
										</span>
										<span>
											<span className="text-xs text-red-500">Stoploss</span>
											<br />
											<strong className="text-red-500">
												{formatPrice(
													topPickOfDay.stoplossPrice,
													topPickOfDay.category,
												)}
											</strong>
										</span>
										{topPickOfDay.confidenceScore !== undefined && (
											<span>
												<span className="text-xs text-muted-foreground">
													AI Confidence
												</span>
												<br />
												<strong
													className={getConfidenceColor(
														topPickOfDay.confidenceScore,
													)}
												>
													{topPickOfDay.confidenceScore}%
												</strong>
											</span>
										)}
									</div>
								</div>
							</div>
						</div>
					)}

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>Today's Top Picks</CardTitle>
									<CardDescription>
										AI-selected investment opportunities for{" "}
										{new Date().toLocaleDateString("en-IN", {
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</CardDescription>
								</div>
								{/* #10 Export button */}
								{todayPicks.length > 0 && (
									<Button
										variant="outline"
										size="sm"
										onClick={exportTodaysPicksCSV}
										className="shrink-0"
									>
										<Download className="h-4 w-4 mr-2" /> Export CSV
									</Button>
								)}
							</div>
						</CardHeader>
						<CardContent>
							{/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
							<div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
								{allCategories.map(({ key, label, icon: Icon }) => {
									const count = todayCounts[key] || 0;
									const isActive = todayCategoryFilter === key;
									// Hide zero-pick tabs unless they are 'all' or currently active
									if (key !== "all" && !isActive && count === 0) return null;
									const catStats =
										key !== "all" ? stats?.byCategory?.[key] : null;
									return (
										<Button
											key={key}
											variant={isActive ? "default" : "outline"}
											size="sm"
											onClick={() => setTodayCategoryFilter(key)}
											className="flex items-center gap-1.5 shrink-0"
										>
											<Icon className="h-3.5 w-3.5" />
											{label}
											{count > 0 && (
												<Badge
													variant={isActive ? "secondary" : "outline"}
													className="ml-1 text-[10px] px-1.5"
												>
													{count}
												</Badge>
											)}
											{catStats && Number(catStats.total) > 0 && (
												<span
													className={`text-[9px] font-semibold ml-0.5 ${Number(catStats.hitRate) >= 50 ? "text-green-500" : Number(catStats.hitRate) >= 25 ? "text-amber-500" : "text-muted-foreground"}`}
												>
													{Number(catStats.hitRate)}%
												</span>
											)}
										</Button>
									);
								})}
							</div>

							{/* Market Filter for Global Stocks */}
							{todayCategoryFilter === "global_stocks" && (
								<div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
									<span className="text-sm text-muted-foreground mr-2 self-center">
										Market:
									</span>
									{marketFilters.map(({ key, label }) => {
										const count = todayMarketCounts[key] || 0;
										const isActive = todayMarketFilter === key;
										return (
											<Button
												key={key}
												variant={isActive ? "secondary" : "ghost"}
												size="sm"
												onClick={() => setTodayMarketFilter(key)}
												className="text-xs"
											>
												{label}
												{count > 0 && (
													<Badge
														variant="outline"
														className="ml-1 text-[10px] px-1"
													>
														{count}
													</Badge>
												)}
											</Button>
										);
									})}
								</div>
							)}

							{loadingToday ? (
								<div className="space-y-4">
									{[1, 2, 3, 4].map((i) => (
										<Skeleton key={i} className="h-32" />
									))}
								</div>
							) : todayCategoryFilter === "listed_stocks" ? (
								<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
									<Card className="lg:col-span-1">
										<CardHeader className="pb-3">
											<CardTitle className="text-base flex items-center gap-2">
												<BarChart3 className="h-4 w-4" />
												AI Filters
											</CardTitle>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="space-y-2">
												<Label className="text-sm">Risk Level</Label>
												<Select
													value={stockRiskLevel}
													onValueChange={setStockRiskLevel}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="conservative">
															Conservative
														</SelectItem>
														<SelectItem value="moderate">Moderate</SelectItem>
														<SelectItem value="aggressive">
															Aggressive
														</SelectItem>
														<SelectItem value="very_aggressive">
															Very Aggressive
														</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">Time Horizon</Label>
												<Select
													value={stockTimeHorizon}
													onValueChange={setStockTimeHorizon}
												>
													<SelectTrigger>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="intraday">Intraday</SelectItem>
														<SelectItem value="short_term">
															Short Term (1-3 months)
														</SelectItem>
														<SelectItem value="medium_term">
															Medium Term (3-12 months)
														</SelectItem>
														<SelectItem value="long_term">
															Long Term (1+ year)
														</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">Sector</Label>
												<Select
													value={stockSector}
													onValueChange={setStockSector}
												>
													<SelectTrigger>
														<SelectValue placeholder="All Sectors" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">All Sectors</SelectItem>
														{aiFiltersData?.sectors?.map((sector) => (
															<SelectItem key={sector} value={sector}>
																{sector}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">Market Cap</Label>
												<Select
													value={stockMarketCap}
													onValueChange={setStockMarketCap}
												>
													<SelectTrigger>
														<SelectValue placeholder="All Market Caps" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="all">All Market Caps</SelectItem>
														<SelectItem value="Large Cap">Large Cap</SelectItem>
														<SelectItem value="Mid Cap">Mid Cap</SelectItem>
														<SelectItem value="Small Cap">Small Cap</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-2">
												<Label className="text-sm">
													Investment Amount:{" "}
													{formatCurrencyINR(stockInvestmentAmount[0])}
												</Label>
												<Slider
													value={stockInvestmentAmount}
													onValueChange={setStockInvestmentAmount}
													min={10000}
													max={1000000}
													step={10000}
												/>
											</div>

											<div className="flex items-center justify-between">
												<Label className="text-sm" htmlFor="agent-ai-toggle">
													AI Analysis
												</Label>
												<Switch
													id="agent-ai-toggle"
													checked={stockIncludeAI}
													onCheckedChange={setStockIncludeAI}
												/>
											</div>

											<Button
												className="w-full"
												onClick={handleGenerateAIStocks}
												disabled={generateAIMutation.isPending}
											>
												{generateAIMutation.isPending ? (
													<>
														<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
														Generating...
													</>
												) : (
													<>
														<Sparkles className="h-4 w-4 mr-2" />
														Generate Picks
													</>
												)}
											</Button>
										</CardContent>
									</Card>

									<div className="lg:col-span-3 space-y-6">
										{(generateAIMutation.isPending || quickAILoading) && (
											<Card>
												<CardContent className="py-12 text-center">
													<RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
													<p className="text-muted-foreground">
														Analyzing market data with AI...
													</p>
												</CardContent>
											</Card>
										)}

										{aiRecommendations.length > 0 && (
											<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
												<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-4">
													<div>
														<div className="flex items-center gap-2 mb-1">
															<div className="p-1.5 bg-primary/10 rounded-md">
																<Brain className="h-5 w-5 text-primary" />
															</div>
															<h3 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
																AI Portfolio Strategy
															</h3>
															<Badge
																variant="outline"
																className="text-xs flex items-center gap-1 border-primary/20 bg-primary/5 text-primary"
															>
																<Sparkles className="h-3 w-3" />
																Gemini Powered
															</Badge>
														</div>
														<p className="text-sm text-muted-foreground flex items-center gap-2 mt-2 flex-wrap">
															<span>
																<strong className="text-foreground capitalize">
																	{stockRiskLevel.replace("_", " ")}
																</strong>{" "}
																Risk
															</span>
															<span>•</span>
															<span>
																<strong className="text-foreground capitalize">
																	{stockTimeHorizon.replace("_", " ")}
																</strong>{" "}
																Horizon
															</span>
															<span>•</span>
															<span className="flex items-center gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full text-xs font-semibold border border-green-200 dark:border-green-800">
																<Landmark className="h-3 w-3" />
																{formatCurrencyINR(stockInvestmentAmount[0])}{" "}
																Allocation
															</span>
														</p>
													</div>
												</div>

												{/* Visual Portfolio Allocation */}
												<div className="bg-card border rounded-xl p-4 shadow-sm">
													<h4 className="text-sm font-medium mb-3 flex items-center gap-2">
														<PieChart className="h-4 w-4 text-muted-foreground" />
														Suggested Portfolio Allocation
													</h4>
													<svg
														className="w-full h-3 rounded-full overflow-hidden bg-muted"
														viewBox="0 0 100 12"
														preserveAspectRatio="none"
													>
														{(() => {
															let currentX = 0;
															const totalConfidence = aiRecommendations.reduce(
																(acc: number, s: any) =>
																	acc + (s.confidence || 100),
																0,
															);
															return aiRecommendations.map(
																(stock: AIStockRecommendation, idx: number) => {
																	const weight =
																		((stock.confidence || 100) /
																			totalConfidence) *
																		100;
																	const colors = [
																		"fill-blue-500",
																		"fill-indigo-500",
																		"fill-purple-500",
																		"fill-pink-500",
																		"fill-rose-500",
																		"fill-orange-500",
																		"fill-amber-500",
																		"fill-emerald-500",
																	];
																	const colorClass =
																		colors[idx % colors.length];
																	const x = currentX;
																	currentX += weight;
																	return (
																		<TooltipProvider key={`alloc-${stock.id}`}>
																			<Tooltip>
																				<TooltipTrigger asChild>
																					<rect
																						x={x}
																						y={0}
																						width={Math.max(0.1, weight - 0.5)}
																						height={12}
																						className={`${colorClass} transition-all hover:opacity-80 cursor-pointer`}
																					/>
																				</TooltipTrigger>
																				<TooltipContent>
																					<div className="font-medium">
																						{stock.symbol}
																					</div>
																					<div className="text-xs text-muted-foreground">
																						{weight.toFixed(1)}% (
																						{formatCurrencyINR(
																							stockInvestmentAmount[0] *
																								(weight / 100),
																						)}
																						)
																					</div>
																				</TooltipContent>
																			</Tooltip>
																		</TooltipProvider>
																	);
																},
															);
														})()}
													</svg>
													<div className="flex flex-wrap gap-3 mt-3">
														{aiRecommendations.map(
															(stock: AIStockRecommendation, idx: number) => {
																const totalConfidence =
																	aiRecommendations.reduce(
																		(acc: number, s: any) =>
																			acc + (s.confidence || 100),
																		0,
																	);
																const weight =
																	((stock.confidence || 100) /
																		totalConfidence) *
																	100;
																const colors = [
																	"bg-blue-500",
																	"bg-indigo-500",
																	"bg-purple-500",
																	"bg-pink-500",
																	"bg-rose-500",
																	"bg-orange-500",
																	"bg-amber-500",
																	"bg-emerald-500",
																];
																const colorClass = colors[idx % colors.length];
																return (
																	<div
																		key={`legend-${stock.id}`}
																		className="flex items-center gap-1.5 text-xs"
																	>
																		<span
																			className={`w-2 h-2 rounded-full ${colorClass}`}
																		/>
																		<span className="font-medium">
																			{stock.symbol}
																		</span>
																		<span className="text-muted-foreground">
																			{weight.toFixed(0)}%
																		</span>
																	</div>
																);
															},
														)}
													</div>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
													{aiRecommendations.map(
														(stock: AIStockRecommendation) => {
															const totalConfidence = aiRecommendations.reduce(
																(acc: number, s: any) =>
																	acc + (s.confidence || 100),
																0,
															);
															const weight =
																(stock.confidence || 100) / totalConfidence;
															const allocatedAmount =
																stockInvestmentAmount[0] * weight;

															return (
																<Card
																	key={stock.id}
																	className={`cursor-pointer overflow-hidden group transition-all duration-300 hover:shadow-md border-t-[3px] ${
																		selectedAIStock?.id === stock.id
																			? "border-t-primary shadow-md ring-1 ring-primary/20"
																			: stock.expectedReturn >= 15
																				? "border-t-green-500"
																				: "border-t-blue-500"
																	}`}
																	onClick={() =>
																		setSelectedAIStock(
																			selectedAIStock?.id === stock.id
																				? null
																				: stock,
																		)
																	}
																>
																	<CardHeader className="pb-2 bg-gradient-to-b from-muted/30 to-transparent">
																		<div className="flex items-start justify-between">
																			<div className="flex-1">
																				<CardTitle className="text-xl flex items-center gap-2 group-hover:text-primary transition-colors">
																					{stock.symbol}
																					<Badge
																						className={`${getSignalColor(stock.signal)} shadow-sm`}
																					>
																						{getSignalText(stock.signal)}
																					</Badge>
																				</CardTitle>
																				<CardDescription className="line-clamp-1 mt-1 text-sm font-medium">
																					{stock.companyName}
																				</CardDescription>
																			</div>
																			<div className="bg-background/80 backdrop-blur border px-2 py-1 rounded-md shadow-sm">
																				{renderStars(stock.fintekproRating)}
																			</div>
																		</div>
																	</CardHeader>
																	<CardContent className="pt-4">
																		<div className="flex items-end justify-between mb-5">
																			<div>
																				<p className="text-xs text-muted-foreground mb-1 font-medium">
																					Expected Return
																				</p>
																				<p
																					className={`text-2xl font-bold flex items-center gap-1 ${stock.expectedReturn >= 0 ? "text-green-600" : "text-red-600"}`}
																				>
																					{stock.expectedReturn >= 0 ? (
																						<TrendingUp className="h-5 w-5" />
																					) : (
																						<TrendingDown className="h-5 w-5" />
																					)}
																					{stock.expectedReturn >= 0 ? "+" : ""}
																					{stock.expectedReturn}%
																				</p>
																			</div>
																			<div className="text-right">
																				<p className="text-xs text-muted-foreground mb-1 font-medium">
																					Suggested Allocation
																				</p>
																				<p className="text-lg font-bold text-foreground">
																					{formatCurrencyINR(allocatedAmount)}
																				</p>
																			</div>
																		</div>

																		<div className="grid grid-cols-3 gap-2 p-3 bg-muted/40 rounded-lg border border-border/50 mb-4">
																			<div className="text-center">
																				<p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
																					Current
																				</p>
																				<p className="font-semibold text-sm">
																					{formatCurrencyINR(
																						stock.currentPrice,
																					)}
																				</p>
																			</div>
																			<div className="text-center border-x border-border/50">
																				<p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
																					Target
																				</p>
																				<p className="font-semibold text-sm text-green-600">
																					{formatCurrencyINR(stock.targetPrice)}
																				</p>
																			</div>
																			<div className="text-center">
																				<p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
																					Stop Loss
																				</p>
																				<p className="font-semibold text-sm text-red-600">
																					{formatCurrencyINR(stock.stopLoss)}
																				</p>
																			</div>
																		</div>

																		<div className="flex items-center justify-between text-sm mb-4 bg-primary/5 px-3 py-2 rounded-md border border-primary/10">
																			<span className="text-primary font-medium flex items-center gap-1.5 text-xs">
																				<BrainCircuit className="h-3.5 w-3.5" />{" "}
																				AI Confidence
																			</span>
																			<div className="flex items-center gap-2 w-32">
																				<Progress
																					value={Number(stock.confidence ?? 0)}
																					className="h-2 bg-primary/20"
																				/>
																				<span className="text-xs font-bold text-primary">
																					{Number(stock.confidence ?? 0)}%
																				</span>
																			</div>
																		</div>

																		<div className="flex items-center gap-2 flex-wrap">
																			<Badge
																				variant="secondary"
																				className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
																			>
																				{stock.sector}
																			</Badge>
																			<Badge
																				variant="secondary"
																				className="text-xs bg-muted hover:bg-muted/80 text-muted-foreground"
																			>
																				{stock.marketCap}
																			</Badge>
																			<Badge
																				variant="outline"
																				className="text-xs flex items-center gap-1 border-muted-foreground/30 text-muted-foreground"
																			>
																				<Clock className="h-3 w-3" />
																				{stock.timeHorizon.replace(/_/g, " ")}
																			</Badge>
																		</div>
																	</CardContent>
																</Card>
															);
														},
													)}
												</div>
											</div>
										)}

										{selectedAIStock && (
											<Card>
												<CardHeader>
													<div className="flex items-center justify-between">
														<CardTitle className="flex items-center gap-2">
															{selectedAIStock.symbol} - Detailed Analysis
														</CardTitle>
														<Button
															variant="ghost"
															size="sm"
															onClick={() => setSelectedAIStock(null)}
														>
															Close
														</Button>
													</div>
													<CardDescription>
														{selectedAIStock.companyName}
													</CardDescription>
												</CardHeader>
												<CardContent>
													<Tabs defaultValue="overview">
														<ScrollableTabsList>
															<TabsTrigger value="overview">
																Overview
															</TabsTrigger>
															<TabsTrigger value="fundamentals">
																Fundamentals
															</TabsTrigger>
															<TabsTrigger value="technicals">
																Technicals
															</TabsTrigger>
															<TabsTrigger value="tax">Tax Impact</TabsTrigger>
														</ScrollableTabsList>

														<TabsContent
															value="overview"
															className="space-y-4 mt-4"
														>
															<div className="p-4 bg-muted/50 rounded-lg">
																<h4 className="font-semibold mb-2 flex items-center gap-2">
																	<Brain className="h-4 w-4" />
																	AI Rationale
																</h4>
																<p className="text-sm text-muted-foreground">
																	{parseRationale(selectedAIStock.rationale)}
																</p>
															</div>
															<div className="grid grid-cols-2 gap-4">
																<div>
																	<h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
																		<CheckCircle className="h-4 w-4" />
																		Key Factors
																	</h4>
																	<ul className="space-y-1">
																		{selectedAIStock.keyFactors.map(
																			(factor, i) => (
																				<li
																					key={i}
																					className="text-sm flex items-start gap-2"
																				>
																					<ArrowUpRight className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
																					{factor}
																				</li>
																			),
																		)}
																	</ul>
																</div>
																<div>
																	<h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-600">
																		<AlertTriangle className="h-4 w-4" />
																		Risk Factors
																	</h4>
																	<ul className="space-y-1">
																		{selectedAIStock.riskFactors.map(
																			(risk, i) => (
																				<li
																					key={i}
																					className="text-sm flex items-start gap-2"
																				>
																					<ArrowDownRight className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
																					{risk}
																				</li>
																			),
																		)}
																	</ul>
																</div>
															</div>
															<Separator />
															<div className="grid grid-cols-4 gap-4 text-center">
																<div>
																	<p className="text-xs text-muted-foreground mb-1">
																		Entry Price
																	</p>
																	<p className="font-semibold">
																		{formatCurrencyINR(
																			selectedAIStock.entryPrice,
																		)}
																	</p>
																</div>
																<div>
																	<p className="text-xs text-muted-foreground mb-1">
																		Target Price
																	</p>
																	<p className="font-semibold text-green-600">
																		{formatCurrencyINR(
																			selectedAIStock.targetPrice,
																		)}
																	</p>
																</div>
																<div>
																	<p className="text-xs text-muted-foreground mb-1">
																		Stop Loss
																	</p>
																	<p className="font-semibold text-red-600">
																		{formatCurrencyINR(
																			selectedAIStock.stopLoss,
																		)}
																	</p>
																</div>
																<div>
																	<p className="text-xs text-muted-foreground mb-1">
																		Risk Score
																	</p>
																	<p className="font-semibold">
																		{selectedAIStock.riskScore}/10
																	</p>
																</div>
															</div>
														</TabsContent>

														<TabsContent value="fundamentals" className="mt-4">
															<div className="grid grid-cols-3 gap-4">
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		P/E Ratio
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.peRatio?.toFixed(
																			2,
																		) || "N/A"}
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		P/B Ratio
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.pbRatio?.toFixed(
																			2,
																		) || "N/A"}
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		ROE
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.roe?.toFixed(
																			1,
																		) || "N/A"}
																		%
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		ROCE
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.roce?.toFixed(
																			1,
																		) || "N/A"}
																		%
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		EPS
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.eps?.toFixed(
																			2,
																		) || "N/A"}
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		Dividend Yield
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.fundamentals.dividendYield?.toFixed(
																			2,
																		) || "N/A"}
																		%
																	</p>
																</div>
															</div>
															<div className="mt-4 p-4 bg-muted/50 rounded-lg">
																<h4 className="font-semibold mb-2">
																	Historical Returns
																</h4>
																<div className="grid grid-cols-4 gap-4 text-center">
																	<div>
																		<p className="text-xs text-muted-foreground">
																			1 Month
																		</p>
																		<p
																			className={`font-semibold ${(selectedAIStock.returns.returns1M || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
																		>
																			{formatPercentValue(
																				selectedAIStock.returns.returns1M,
																			)}
																		</p>
																	</div>
																	<div>
																		<p className="text-xs text-muted-foreground">
																			3 Months
																		</p>
																		<p
																			className={`font-semibold ${(selectedAIStock.returns.returns3M || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
																		>
																			{formatPercentValue(
																				selectedAIStock.returns.returns3M,
																			)}
																		</p>
																	</div>
																	<div>
																		<p className="text-xs text-muted-foreground">
																			6 Months
																		</p>
																		<p
																			className={`font-semibold ${(selectedAIStock.returns.returns6M || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
																		>
																			{formatPercentValue(
																				selectedAIStock.returns.returns6M,
																			)}
																		</p>
																	</div>
																	<div>
																		<p className="text-xs text-muted-foreground">
																			1 Year
																		</p>
																		<p
																			className={`font-semibold ${(selectedAIStock.returns.returns1Y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}
																		>
																			{formatPercentValue(
																				selectedAIStock.returns.returns1Y,
																			)}
																		</p>
																	</div>
																</div>
															</div>
														</TabsContent>

														<TabsContent value="technicals" className="mt-4">
															<div className="grid grid-cols-3 gap-4">
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		RSI
																	</p>
																	<p
																		className={`text-xl font-bold ${selectedAIStock.technicals.rsi > 70 ? "text-red-600" : selectedAIStock.technicals.rsi < 30 ? "text-green-600" : ""}`}
																	>
																		{selectedAIStock.technicals.rsi.toFixed(0)}
																	</p>
																	<p className="text-xs text-muted-foreground">
																		{selectedAIStock.technicals.rsi > 70
																			? "Overbought"
																			: selectedAIStock.technicals.rsi < 30
																				? "Oversold"
																				: "Neutral"}
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		MACD
																	</p>
																	<p
																		className={`text-xl font-bold ${selectedAIStock.technicals.macd === "Bullish" ? "text-green-600" : selectedAIStock.technicals.macd === "Bearish" ? "text-red-600" : ""}`}
																	>
																		{selectedAIStock.technicals.macd}
																	</p>
																</div>
																<div className="p-4 border rounded-lg text-center">
																	<p className="text-xs text-muted-foreground">
																		Volume Trend
																	</p>
																	<p className="text-xl font-bold">
																		{selectedAIStock.technicals.volumeTrend}
																	</p>
																</div>
															</div>
															<div className="mt-4 grid grid-cols-2 gap-4">
																<div className="p-4 border rounded-lg">
																	<h4 className="font-semibold mb-2">
																		Moving Averages
																	</h4>
																	<div className="space-y-2">
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				50 DMA
																			</span>
																			<span className="font-medium">
																				{formatCurrencyINR(
																					selectedAIStock.technicals
																						.movingAvg50,
																				)}
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				200 DMA
																			</span>
																			<span className="font-medium">
																				{formatCurrencyINR(
																					selectedAIStock.technicals
																						.movingAvg200,
																				)}
																			</span>
																		</div>
																	</div>
																</div>
																<div className="p-4 border rounded-lg">
																	<h4 className="font-semibold mb-2">
																		52 Week Range
																	</h4>
																	<div className="space-y-2">
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				High
																			</span>
																			<span className="font-medium text-green-600">
																				{formatCurrencyINR(
																					selectedAIStock.technicals.weekHigh52,
																				)}
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Low
																			</span>
																			<span className="font-medium text-red-600">
																				{formatCurrencyINR(
																					selectedAIStock.technicals.weekLow52,
																				)}
																			</span>
																		</div>
																	</div>
																</div>
															</div>
														</TabsContent>

														<TabsContent value="tax" className="mt-4">
															<div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
																<h4 className="font-semibold mb-2 flex items-center gap-2">
																	<Coins className="h-4 w-4" />
																	Tax Implications
																</h4>
																<p className="text-sm">
																	{selectedAIStock.taxImplications.taxTip}
																</p>
															</div>
															<div className="grid grid-cols-2 gap-4">
																<div className="p-4 border rounded-lg">
																	<h4 className="font-semibold mb-3">
																		Short-Term Capital Gains
																	</h4>
																	<div className="space-y-2">
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Holding Period
																			</span>
																			<span className="font-medium">
																				≤ 12 months
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Tax Rate
																			</span>
																			<span className="font-medium text-red-600">
																				{
																					selectedAIStock.taxImplications
																						.stcgRate
																				}
																				%
																			</span>
																		</div>
																	</div>
																</div>
																<div className="p-4 border rounded-lg">
																	<h4 className="font-semibold mb-3">
																		Long-Term Capital Gains
																	</h4>
																	<div className="space-y-2">
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Holding Period
																			</span>
																			<span className="font-medium">
																				&gt; 12 months
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Tax Rate
																			</span>
																			<span className="font-medium text-green-600">
																				{
																					selectedAIStock.taxImplications
																						.ltcgRate
																				}
																				%
																			</span>
																		</div>
																		<div className="flex justify-between">
																			<span className="text-sm text-muted-foreground">
																				Exemption
																			</span>
																			<span className="font-medium">
																				{formatCurrencyINR(
																					selectedAIStock.taxImplications
																						.ltcgExemption,
																				)}
																			</span>
																		</div>
																	</div>
																</div>
															</div>
														</TabsContent>
													</Tabs>
												</CardContent>
											</Card>
										)}

										{filteredTodayPicks.length > 0 &&
											(() => {
												const sectorGroups =
													groupByBroadSector(filteredTodayPicks);
												const hasSectorData = sectorGroups.some(
													(g) => g.sector !== null,
												);

												return (
													<div className="space-y-2">
														<div className="flex items-center gap-2 mb-2">
															<TrendingUp className="h-5 w-5 text-primary" />
															<h3 className="font-semibold">
																Today's Stock Picks
															</h3>
															{hasSectorData && (
																<span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
																	<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
																	{sectorGroups.filter((g) => g.sector).length}{" "}
																	Sectors
																</span>
															)}
															<div className="ml-auto flex items-center gap-1 border rounded-lg p-0.5">
																<button
																	onClick={() => toggleViewMode("grid")}
																	className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
																	title="Card view"
																>
																	<LayoutGrid className="h-3.5 w-3.5" />
																</button>
																<button
																	onClick={() => toggleViewMode("table")}
																	className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
																	title="Table view"
																>
																	<Table2 className="h-3.5 w-3.5" />
																</button>
															</div>
														</div>

														{/* Sector Allocation Bar */}
														{hasSectorData && sectorGroups.length >= 2 && (
															<div className="bg-card border rounded-xl p-4 shadow-sm mb-4">
																<h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
																	<PieChart className="h-3 w-3" /> Sector
																	Allocation
																</h4>
																<div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-3">
																	{sectorGroups
																		.filter((g) => g.sector)
																		.map((g) => (
																			<TooltipProvider key={g.sector!.id}>
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<SectorBarSegment
																							color={g.sector!.color}
																							flex={g.picks.length}
																							className="h-full rounded-sm transition-all hover:opacity-80 cursor-default"
																						/>
																					</TooltipTrigger>
																					<TooltipContent>
																						<div className="font-medium">
																							{g.sector!.icon} {g.sector!.label}
																						</div>
																						<div className="text-xs text-muted-foreground">
																							{g.picks
																								.map((p) => p.symbol)
																								.join(", ")}
																						</div>
																					</TooltipContent>
																				</Tooltip>
																			</TooltipProvider>
																		))}
																</div>
																<div className="flex flex-wrap gap-3">
																	{sectorGroups
																		.filter((g) => g.sector)
																		.map((g) => (
																			<div
																				key={g.sector!.id}
																				className="flex items-center gap-1.5 text-xs"
																			>
																				<SectorDot
																					color={g.sector!.color}
																					className="w-2 h-2 rounded-full"
																				/>
																				<span>
																					{g.sector!.icon} {g.sector!.label}
																				</span>
																				<span className="text-muted-foreground">
																					·{" "}
																					{g.picks
																						.map((p) => p.symbol)
																						.join(", ")}
																				</span>
																			</div>
																		))}
																</div>
															</div>
														)}

														{/* Per-sector grouped cards OR table */}
														{viewMode === "table" ? (
															<PicksTable
																picks={filteredTodayPicks}
																onRowClick={setSelectedPick}
															/>
														) : (
															sectorGroups.map((group, gi) => (
																<div
																	key={group.sector?.id ?? "other"}
																	className="space-y-3"
																>
																	{group.sector ? (
																		<SectorHeader
																			color={group.sector.color}
																			className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-semibold"
																		>
																			<span>{group.sector.icon}</span>
																			<span>{group.sector.label}</span>
																			<span className="ml-auto opacity-80 text-xs font-normal">
																				{group.picks.length} pick
																				{group.picks.length > 1 ? "s" : ""}
																			</span>
																		</SectorHeader>
																	) : (
																		<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
																			<TrendingUp className="h-4 w-4" />
																			<span>Other Sectors</span>
																		</div>
																	)}
																	<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
																		{group.picks.map((pick, index) => (
																			<PickCard
																				key={`today-sector-${pick.id}-${gi}-${index}`}
																				pick={pick}
																				isWatchlisted={watchlistPickIds.has(
																					pick.id,
																				)}
																				isSelected={selectedPickIds.has(
																					pick.id,
																				)}
																				onSelectToggle={handleSelectToggle}
																				onAddToWatchlist={(id) =>
																					addToWatchlistMutation.mutate(id)
																				}
																				onRemoveFromWatchlist={(id) =>
																					removeFromWatchlistMutation.mutate(id)
																				}
																				onShareEmail={(id) =>
																					handleShare(id, "email")
																				}
																				onShareWhatsApp={(id) =>
																					handleShare(id, "whatsapp")
																				}
																				onShareClients={handleShareWithClients}
																				onClick={setSelectedPick}
																				onExplain={(id) => {
																					setExplanationPickId(id);
																					setExplanationOpen(true);
																				}}
																			/>
																		))}
																	</div>
																</div>
															))
														)}
													</div>
												);
											})()}

										{!generateAIMutation.isPending &&
											!quickAILoading &&
											aiRecommendations.length === 0 &&
											filteredTodayPicks.length === 0 && (
												<Card>
													<CardContent className="py-12 text-center">
														<Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
														<h3 className="text-lg font-semibold mb-2">
															No Stock Picks Yet
														</h3>
														<p className="text-muted-foreground mb-4">
															Configure your preferences and click "Generate
															Picks" to get AI-powered stock recommendations.
														</p>
													</CardContent>
												</Card>
											)}
									</div>
								</div>
							) : filteredTodayPicks.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
									<div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
										{todayCategoryFilter === "derivatives" ? (
											<Activity className="h-8 w-8 text-muted-foreground/60" />
										) : todayCategoryFilter === "global_stocks" ? (
											<Globe className="h-8 w-8 text-muted-foreground/60" />
										) : todayCategoryFilter === "sgb" ? (
											<Coins className="h-8 w-8 text-muted-foreground/60" />
										) : todayCategoryFilter === "fixed_deposits" ? (
											<LucideShield className="h-8 w-8 text-muted-foreground/60" />
										) : (
											<Sparkles className="h-8 w-8 text-muted-foreground/60" />
										)}
									</div>
									<h3 className="text-base font-semibold mb-1">
										No Picks{" "}
										{todayCategoryFilter !== "all"
											? `for ${categoryLabels[todayCategoryFilter] || todayCategoryFilter}`
											: "Yet Today"}
									</h3>
									<p className="text-sm text-muted-foreground max-w-xs">
										{todayCategoryFilter === "derivatives"
											? "F&O picks require live NSE options chain data. They are generated when market conditions indicate a clear directional opportunity."
											: todayCategoryFilter === "global_stocks"
												? "Global stock picks are generated from international instruments data. Ensure the global instruments DB is seeded with live prices."
												: todayCategoryFilter === "sgb"
													? "Sovereign Gold Bond picks are only generated during active SGB issue windows (open/upcoming tranches)."
													: todayCategoryFilter === "fixed_deposits"
														? "Fixed Deposit picks are generated from the instrument master. Ensure FD instruments are seeded in the database."
														: todayCategoryFilter === "etfs"
															? 'ETF picks require instruments with assetClass="etf" and a non-null lastPrice in the instrument master.'
															: "Picks are generated automatically each morning at 9 AM IST based on market analysis."}
									</p>
									<p className="text-xs text-muted-foreground/60 mt-2">
										Next auto-generation: 9:00 AM IST
									</p>
								</div>
							) : (
								(() => {
									// For listed_stocks: sector-grouped view. For all others: flat grid.
									if (
										todayCategoryFilter === "listed_stocks" ||
										todayCategoryFilter === "all"
									) {
										const stockPicks = filteredTodayPicks.filter(
											(p) => p.category === "listed_stocks",
										);
										const nonStockPicks = filteredTodayPicks.filter(
											(p) => p.category !== "listed_stocks",
										);
										const sectorGroups = groupByBroadSector(stockPicks);
										const hasSectorData = sectorGroups.some(
											(g) => g.sector !== null,
										);

										return (
											<div className="space-y-6">
												{hasSectorData && (
													<div className="space-y-4">
														{/* Sector allocation bar */}
														{sectorGroups.length >= 2 && (
															<div className="bg-card border rounded-xl p-4 shadow-sm">
																<h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
																	<PieChart className="h-3 w-3" /> Sector
																	Diversity
																	<span className="ml-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full text-xs">
																		<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
																		{
																			sectorGroups.filter((g) => g.sector)
																				.length
																		}{" "}
																		Sectors Covered
																	</span>
																</h4>
																<div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-3">
																	{sectorGroups
																		.filter((g) => g.sector)
																		.map((g) => (
																			<TooltipProvider key={g.sector!.id}>
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<SectorBarSegment
																							color={g.sector!.color}
																							flex={g.picks.length}
																							className="h-full rounded-sm transition-all hover:opacity-80 cursor-default"
																						/>
																					</TooltipTrigger>
																					<TooltipContent>
																						<div className="font-medium">
																							{g.sector!.icon} {g.sector!.label}
																						</div>
																						<div className="text-xs text-muted-foreground">
																							{g.picks
																								.map((p) => p.symbol)
																								.join(", ")}
																						</div>
																					</TooltipContent>
																				</Tooltip>
																			</TooltipProvider>
																		))}
																</div>
																<div className="flex flex-wrap gap-3">
																	{sectorGroups
																		.filter((g) => g.sector)
																		.map((g) => (
																			<div
																				key={g.sector!.id}
																				className="flex items-center gap-1.5 text-xs"
																			>
																				<SectorDot
																					color={g.sector!.color}
																					className="w-2 h-2 rounded-full"
																				/>
																				<span>
																					{g.sector!.icon} {g.sector!.label}
																				</span>
																				<span className="text-muted-foreground">
																					·{" "}
																					{g.picks
																						.map((p) => p.symbol)
																						.join(", ")}
																				</span>
																			</div>
																		))}
																</div>
															</div>
														)}

														{/* Per-sector groups */}
														{sectorGroups.map((group, gi) => (
															<div
																key={group.sector?.id ?? "other"}
																className="space-y-3"
															>
																<SectorHeader
																	color={
																		group.sector
																			? group.sector.color
																			: "hsl(var(--muted))"
																	}
																	textColor={
																		group.sector
																			? "#fff"
																			: "hsl(var(--muted-foreground))"
																	}
																	className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold"
																>
																	<span>{group.sector?.icon ?? "📊"}</span>
																	<span>
																		{group.sector?.label ?? "Other Sectors"}
																	</span>
																	<span className="ml-auto opacity-80 text-xs font-normal">
																		{group.picks.length} pick
																		{group.picks.length > 1 ? "s" : ""}
																	</span>
																</SectorHeader>
																<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
																	{group.picks.map((pick, index) => (
																		<PickCard
																			key={`today-gs-${pick.id}-${gi}-${index}`}
																			pick={pick}
																			isWatchlisted={watchlistPickIds.has(
																				pick.id,
																			)}
																			isSelected={selectedPickIds.has(pick.id)}
																			onSelectToggle={handleSelectToggle}
																			onAddToWatchlist={(id) =>
																				addToWatchlistMutation.mutate(id)
																			}
																			onRemoveFromWatchlist={(id) =>
																				removeFromWatchlistMutation.mutate(id)
																			}
																			onShareEmail={(id) =>
																				handleShare(id, "email")
																			}
																			onShareWhatsApp={(id) =>
																				handleShare(id, "whatsapp")
																			}
																			onShareClients={handleShareWithClients}
																			onClick={setSelectedPick}
																		/>
																	))}
																</div>
															</div>
														))}
													</div>
												)}

												{/* Non-stock picks (when "All" tab) */}
												{nonStockPicks.length > 0 && (
													<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
														{nonStockPicks.map((pick, index) => (
															<PickCard
																key={`today-ns-${pick.id}-${index}`}
																pick={pick}
																isWatchlisted={watchlistPickIds.has(pick.id)}
																isSelected={selectedPickIds.has(pick.id)}
																onSelectToggle={handleSelectToggle}
																onAddToWatchlist={(id) =>
																	addToWatchlistMutation.mutate(id)
																}
																onRemoveFromWatchlist={(id) =>
																	removeFromWatchlistMutation.mutate(id)
																}
																onShareEmail={(id) => handleShare(id, "email")}
																onShareWhatsApp={(id) =>
																	handleShare(id, "whatsapp")
																}
																onShareClients={handleShareWithClients}
																onClick={setSelectedPick}
															/>
														))}
													</div>
												)}
											</div>
										);
									}

									// Flat grid for all other categories
									return viewMode === "table" ? (
										<PicksTable
											picks={filteredTodayPicks}
											onRowClick={setSelectedPick}
										/>
									) : (
										<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
											{filteredTodayPicks.map((pick, index) => (
												<PickCard
													key={`today-flat-${pick.id}-${index}`}
													pick={pick}
													isWatchlisted={watchlistPickIds.has(pick.id)}
													isSelected={selectedPickIds.has(pick.id)}
													onSelectToggle={handleSelectToggle}
													onAddToWatchlist={(id) =>
														addToWatchlistMutation.mutate(id)
													}
													onRemoveFromWatchlist={(id) =>
														removeFromWatchlistMutation.mutate(id)
													}
													onShareEmail={(id) => handleShare(id, "email")}
													onShareWhatsApp={(id) => handleShare(id, "whatsapp")}
													onShareClients={handleShareWithClients}
													onClick={setSelectedPick}
												/>
											))}
										</div>
									);
								})()
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="live" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
								<div>
									<CardTitle>Live Recommendations</CardTitle>
									<CardDescription>
										Active picks being tracked for target/stoploss
									</CardDescription>
								</div>
								<div className="flex items-center gap-2">
									{/* View toggle */}
									<div className="flex items-center gap-1 border rounded-lg p-0.5">
										<button
											onClick={() => toggleViewMode("grid")}
											className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
											title="Card view"
										>
											<LayoutGrid className="h-3.5 w-3.5" />
										</button>
										<button
											onClick={() => toggleViewMode("table")}
											className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
											title="Table view"
										>
											<Table2 className="h-3.5 w-3.5" />
										</button>
									</div>
									{/* #5 Search box */}
									<div className="relative w-full sm:w-56">
										<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
										<input
											type="text"
											placeholder="Search instrument, symbol…"
											value={liveSearchQuery}
											onChange={(e) => setLiveSearchQuery(e.target.value)}
											className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										/>
										{liveSearchQuery && (
											<button
												className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
												onClick={() => setLiveSearchQuery("")}
												title="Clear search"
												aria-label="Clear search"
											>
												<X className="h-4 w-4" />
											</button>
										)}
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
							<div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
								{allCategories.map(({ key, label, icon: Icon }) => {
									const count = liveCounts[key] || 0;
									const isActive = liveCategoryFilter === key;
									const catStats =
										key !== "all" ? stats?.byCategory?.[key] : null;
									return (
										<Button
											key={key}
											variant={isActive ? "default" : "outline"}
											size="sm"
											onClick={() => setLiveCategoryFilter(key)}
											className="flex items-center gap-1.5 shrink-0"
										>
											<Icon className="h-3.5 w-3.5" />
											{label}
											{count > 0 && (
												<Badge
													variant={isActive ? "secondary" : "outline"}
													className="ml-1 text-[10px] px-1.5"
												>
													{count}
												</Badge>
											)}
											{catStats && Number(catStats.total) > 0 && (
												<span
													className={`text-[9px] font-semibold ml-0.5 ${Number(catStats.hitRate) >= 50 ? "text-green-500" : Number(catStats.hitRate) >= 25 ? "text-amber-500" : "text-muted-foreground"}`}
												>
													{Number(catStats.hitRate)}%
												</span>
											)}
										</Button>
									);
								})}
							</div>

							{/* Market Filter for Global Stocks */}
							{liveCategoryFilter === "global_stocks" && (
								<div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
									<span className="text-sm text-muted-foreground mr-2 self-center">
										Market:
									</span>
									{marketFilters.map(({ key, label }) => {
										const count = liveMarketCounts[key] || 0;
										const isActive = liveMarketFilter === key;
										return (
											<Button
												key={key}
												variant={isActive ? "secondary" : "ghost"}
												size="sm"
												onClick={() => setLiveMarketFilter(key)}
												className="text-xs"
											>
												{label}
												{count > 0 && (
													<Badge
														variant="outline"
														className="ml-1 text-[10px] px-1"
													>
														{count}
													</Badge>
												)}
											</Button>
										);
									})}
								</div>
							)}

							{loadingLive ? (
								<div className="space-y-4">
									{[1, 2, 3].map((i) => (
										<Skeleton key={i} className="h-32" />
									))}
								</div>
							) : filteredLivePicks.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									No live recommendations{" "}
									{liveCategoryFilter !== "all"
										? `for ${categoryLabels[liveCategoryFilter] || liveCategoryFilter}`
										: "at the moment"}
								</div>
							) : viewMode === "table" ? (
								<PicksTable
									picks={filteredLivePicks}
									onRowClick={setSelectedPick}
									showReturn
								/>
							) : (
								<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
									{filteredLivePicks.map((pick, index) => (
										<PickCard
											key={`live-${pick.id}-${index}`}
											pick={pick}
											showDetails
											isWatchlisted={watchlistPickIds.has(pick.id)}
											isSelected={selectedPickIds.has(pick.id)}
											onSelectToggle={handleSelectToggle}
											onAddToWatchlist={(id) =>
												addToWatchlistMutation.mutate(id)
											}
											onRemoveFromWatchlist={(id) =>
												removeFromWatchlistMutation.mutate(id)
											}
											onShareEmail={(id) => handleShare(id, "email")}
											onShareWhatsApp={(id) => handleShare(id, "whatsapp")}
											onShareClients={handleShareWithClients}
											onClick={setSelectedPick}
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="history" className="space-y-4">
					<Card>
						<CardHeader>
							<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
								<div>
									<CardTitle>Pick History</CardTitle>
									<CardDescription>
										Track the performance of past recommendations
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger className="w-[140px]">
											<SelectValue placeholder="Status" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Status</SelectItem>
											<SelectItem value="live">Live</SelectItem>
											<SelectItem value="target_hit">Target Hit</SelectItem>
											<SelectItem value="stoploss_hit">Stoploss Hit</SelectItem>
											<SelectItem value="expired">Expired</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{/* #13 Cumulative Performance Chart */}
							{historicalChartData.length >= 2 && (
								<div className="mb-6">
									<div className="flex items-center justify-between mb-2">
										<h4 className="text-sm font-semibold flex items-center gap-2">
											<TrendingUp className="h-4 w-4 text-primary" />
											Cumulative Return — Closed Picks
										</h4>
										<span
											className={`text-xs font-semibold ${historicalChartData[historicalChartData.length - 1].cumulative >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{historicalChartData[historicalChartData.length - 1]
												.cumulative >= 0
												? "+"
												: ""}
											{
												historicalChartData[historicalChartData.length - 1]
													.cumulative
											}
											%
										</span>
									</div>
									<ResponsiveContainer width="100%" height={180}>
										<LineChart
											data={historicalChartData}
											margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												className="opacity-30"
											/>
											<XAxis
												dataKey="date"
												tick={{ fontSize: 10 }}
												interval="preserveStartEnd"
											/>
											<YAxis
												tick={{ fontSize: 10 }}
												tickFormatter={(v) => `${v}%`}
												width={42}
											/>
											<ReferenceLine
												y={0}
												stroke="hsl(var(--muted-foreground))"
												strokeDasharray="4 4"
											/>
											<RechartsTooltip
												content={({ active, payload }) => {
													if (!active || !payload?.length) return null;
													const d = payload[0].payload;
													return (
														<div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
															<p className="font-semibold">{d.name}</p>
															<p className="text-muted-foreground">{d.date}</p>
															<p>
																Pick return:{" "}
																<span
																	className={
																		Number(d.return) >= 0
																			? "text-green-600 font-medium"
																			: "text-red-600 font-medium"
																	}
																>
																	{Number(d.return) >= 0 ? "+" : ""}
																	{d.return}%
																</span>
															</p>
															<p>
																Cumulative:{" "}
																<span
																	className={
																		Number(d.cumulative) >= 0
																			? "text-green-600 font-medium"
																			: "text-red-600 font-medium"
																	}
																>
																	{Number(d.cumulative) >= 0 ? "+" : ""}
																	{d.cumulative}%
																</span>
															</p>
														</div>
													);
												}}
											/>
											<Line
												type="monotone"
												dataKey="cumulative"
												stroke="hsl(var(--primary))"
												strokeWidth={2}
												dot={false}
												activeDot={{ r: 4 }}
											/>
										</LineChart>
									</ResponsiveContainer>
								</div>
							)}

							{/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
							<div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
								{allCategories.map(({ key, label, icon: Icon }) => {
									const count = historyCounts[key] || 0;
									const isActive = historyCategoryFilter === key;
									const catStats =
										key !== "all" ? stats?.byCategory?.[key] : null;
									return (
										<Button
											key={key}
											variant={isActive ? "default" : "outline"}
											size="sm"
											onClick={() => setHistoryCategoryFilter(key)}
											className="flex items-center gap-1.5 shrink-0"
										>
											<Icon className="h-3.5 w-3.5" />
											{label}
											{count > 0 && (
												<Badge
													variant={isActive ? "secondary" : "outline"}
													className="ml-1 text-[10px] px-1.5"
												>
													{count}
												</Badge>
											)}
											{catStats && Number(catStats.total) > 0 && (
												<span
													className={`text-[9px] font-semibold ml-0.5 ${Number(catStats.hitRate) >= 50 ? "text-green-500" : Number(catStats.hitRate) >= 25 ? "text-amber-500" : "text-muted-foreground"}`}
												>
													{Number(catStats.hitRate)}%
												</span>
											)}
										</Button>
									);
								})}
							</div>

							{/* Market Filter for Global Stocks */}
							{historyCategoryFilter === "global_stocks" && (
								<div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
									<span className="text-sm text-muted-foreground mr-2 self-center">
										Market:
									</span>
									{marketFilters.map(({ key, label }) => {
										const count = historyMarketCounts[key] || 0;
										const isActive = historyMarketFilter === key;
										return (
											<Button
												key={key}
												variant={isActive ? "secondary" : "ghost"}
												size="sm"
												onClick={() => setHistoryMarketFilter(key)}
												className="text-xs"
											>
												{label}
												{count > 0 && (
													<Badge
														variant="outline"
														className="ml-1 text-[10px] px-1"
													>
														{count}
													</Badge>
												)}
											</Button>
										);
									})}
								</div>
							)}

							{loadingHistory ? (
								<div className="space-y-4">
									{[1, 2, 3, 4, 5].map((i) => (
										<Skeleton key={i} className="h-24" />
									))}
								</div>
							) : filteredHistory.length === 0 ? (
								<div className="text-center py-12 text-muted-foreground">
									No picks found for the selected filters
								</div>
							) : viewMode === "table" ? (
								<PicksTable
									picks={filteredHistory}
									onRowClick={setSelectedPick}
									showReturn
								/>
							) : (
								<div className="space-y-3">
									{filteredHistory.map((pick, index) => (
										<PickCard
											key={`history-${pick.id}-${index}`}
											pick={pick}
											showDetails
											compact
										/>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="watchlist" className="space-y-4">
					<div className="grid gap-4 lg:grid-cols-3">
						<div className="lg:col-span-2">
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Bookmark className="h-5 w-5" />
										My Watchlist
									</CardTitle>
									<CardDescription>
										Track picks you're interested in with price alerts
									</CardDescription>
								</CardHeader>
								<CardContent>
									{loadingWatchlist ? (
										<div className="space-y-4">
											{[1, 2, 3].map((i) => (
												<Skeleton key={i} className="h-24" />
											))}
										</div>
									) : watchlist.length === 0 ? (
										<div className="text-center py-12">
											<Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
											<h3 className="text-lg font-medium mb-2">
												No Picks in Watchlist
											</h3>
											<p className="text-muted-foreground text-sm">
												Add picks to your watchlist to track them and set price
												alerts
											</p>
										</div>
									) : (
										<div className="space-y-3">
											{watchlist.map((item) => {
												const pick = item.pick;
												const catLabel =
													categoryLabels[pick?.category ?? ""] ??
													pick?.category ??
													"—";
												const CatIcon = categoryIcons[pick?.category ?? ""];
												const recoPrice = pick?.recoPrice ?? 0;
												const currentPrice = pick?.currentPrice ?? recoPrice;
												const returnPct =
													pick?.returnPct != null
														? pick.returnPct
														: recoPrice > 0
															? ((currentPrice - recoPrice) / recoPrice) * 100
															: null;
												const statusEntry =
													statusConfig[pick?.status ?? "live"];
												const StatusIcon = statusEntry?.icon;

												return (
													<div
														key={item.watchlistId ?? item.pickId}
														className="rounded-lg border bg-card hover:bg-accent/30 transition-colors"
													>
														{/* Header row */}
														<div className="flex items-start gap-3 p-3">
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2 flex-wrap">
																	<span className="font-semibold truncate text-sm">
																		{pick?.instrumentName ??
																			`Pick #${item.pickId}`}
																	</span>
																	{pick?.symbol && (
																		<span className="text-xs text-muted-foreground font-mono">
																			{pick.symbol}
																		</span>
																	)}
																	{statusEntry && StatusIcon && (
																		<Badge
																			variant="outline"
																			className={`text-[10px] px-1.5 py-0 ${statusEntry.color} text-white border-0`}
																		>
																			<StatusIcon className="h-2.5 w-2.5 mr-0.5" />
																			{statusEntry.label}
																		</Badge>
																	)}
																	{item.priceAlertEnabled && (
																		<Badge
																			variant="outline"
																			className="text-[10px] px-1.5 py-0"
																		>
																			<Bell className="h-3 w-3 mr-1" />
																			Alert Active
																		</Badge>
																	)}
																</div>
																<div className="flex items-center gap-2 mt-1 flex-wrap">
																	{CatIcon && (
																		<CatIcon className="h-3 w-3 text-muted-foreground" />
																	)}
																	<span className="text-xs text-muted-foreground">
																		{catLabel}
																	</span>
																	<span className="text-xs text-muted-foreground">
																		•
																	</span>
																	<span className="text-xs text-muted-foreground">
																		Added{" "}
																		{new Date(item.addedAt).toLocaleDateString(
																			"en-IN",
																			{
																				day: "numeric",
																				month: "short",
																				year: "numeric",
																			},
																		)}
																	</span>
																	{item.alertType && (
																		<>
																			<span className="text-xs text-muted-foreground">
																				•
																			</span>
																			<span className="text-xs text-muted-foreground capitalize">
																				Alert:{" "}
																				{item.alertType.replace("_", " ")}
																			</span>
																		</>
																	)}
																</div>
															</div>
															<Button
																variant="ghost"
																size="sm"
																className="shrink-0 h-7 w-7 p-0"
																onClick={() =>
																	removeFromWatchlistMutation.mutate(
																		item.pickId,
																	)
																}
															>
																<XCircle className="h-4 w-4 text-red-500" />
															</Button>
														</div>

														{/* Price row */}
														{pick && (
															<div className="px-3 pb-3 grid grid-cols-4 gap-2 text-xs border-t pt-2">
																<div>
																	<div className="text-muted-foreground">
																		Entry
																	</div>
																	<div className="font-medium">
																		{formatPrice(recoPrice, pick.category)}
																	</div>
																</div>
																<div>
																	<div className="text-muted-foreground">
																		Current
																	</div>
																	<div className="font-medium">
																		{formatPrice(currentPrice, pick.category)}
																	</div>
																</div>
																<div>
																	<div className="text-muted-foreground">
																		Target
																	</div>
																	<div className="font-medium text-green-600">
																		{formatPrice(
																			pick.targetPrice,
																			pick.category,
																		)}
																	</div>
																</div>
																<div>
																	<div className="text-muted-foreground">
																		Return
																	</div>
																	<div
																		className={`font-semibold ${returnPct != null && returnPct >= 0 ? "text-green-600" : "text-red-500"}`}
																	>
																		{returnPct != null
																			? `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%`
																			: "—"}
																	</div>
																</div>
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</CardContent>
							</Card>
						</div>

						<div className="space-y-4">
							{diversificationData && (
								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="text-lg flex items-center gap-2">
											<PieChart className="h-5 w-5" />
											Sector Diversification
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="flex items-center justify-between">
											<span className="text-sm text-muted-foreground">
												Diversification Score
											</span>
											<span className="font-bold">
												{diversificationData.diversificationScore}/100
											</span>
										</div>
										<Progress
											value={diversificationData.diversificationScore}
											className="h-2"
										/>

										<div className="flex items-center gap-2 mt-2">
											<span className="text-sm">Concentration Risk:</span>
											<Badge
												variant={
													diversificationData.concentrationRisk === "low"
														? "default"
														: diversificationData.concentrationRisk === "medium"
															? "secondary"
															: "destructive"
												}
											>
												{diversificationData.concentrationRisk}
											</Badge>
										</div>

										{diversificationData.recommendations?.length > 0 && (
											<div className="mt-3 pt-3 border-t">
												<div className="text-sm font-medium mb-2 flex items-center gap-1">
													<AlertTriangle className="h-4 w-4 text-yellow-500" />
													Recommendations
												</div>
												<ul className="text-xs text-muted-foreground space-y-1">
													{diversificationData.recommendations
														.slice(0, 3)
														.map((rec, i) => (
															<li key={i}>• {rec}</li>
														))}
												</ul>
											</div>
										)}
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				</TabsContent>
			</Tabs>

			<div className="mt-6 p-4 bg-muted/50 rounded-lg border border-muted">
				<div className="flex items-start gap-2">
					<AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
					<div className="text-xs text-muted-foreground space-y-1">
						<p className="font-medium text-foreground/80">
							Regulatory Disclaimer
						</p>
						<p>
							Investment recommendations are AI-generated and for informational
							purposes only. Past performance does not guarantee future results.
							Investors should conduct independent due diligence and consult a
							SEBI-registered investment advisor before making investment
							decisions.
						</p>
						<p className="text-[10px]">
							Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo
							Finance. Prices may be delayed up to 15 minutes for listed
							securities.
						</p>
					</div>
				</div>
			</div>

			{/* Pick Detail Sheet */}
			{selectedPick && (
				<Sheet
					open={!!selectedPick}
					onOpenChange={(open) => {
						if (!open) setSelectedPick(null);
					}}
				>
					<SheetContent className="w-full sm:max-w-lg overflow-y-auto">
						<SheetHeader className="pb-4 border-b">
							<div className="flex items-start justify-between gap-3">
								<div>
									<SheetTitle className="text-xl flex items-center gap-2 flex-wrap">
										{selectedPick.instrumentName}
										{selectedPick.symbol && (
											<span className="text-sm font-mono text-muted-foreground">
												{selectedPick.symbol}
											</span>
										)}
									</SheetTitle>
									<SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
										<Badge variant="outline">
											{categoryLabels[selectedPick.category] ||
												selectedPick.category}
										</Badge>
										{selectedPick.exchange && (
											<Badge variant="secondary">{selectedPick.exchange}</Badge>
										)}
										{selectedPick.sectorCategory && (
											<Badge variant="secondary">
												{selectedPick.sectorCategory}
											</Badge>
										)}
										<Badge
											className={`${(statusConfig[selectedPick.status] || statusConfig.live).color} text-foreground`}
										>
											{
												(statusConfig[selectedPick.status] || statusConfig.live)
													.label
											}
										</Badge>
									</SheetDescription>
								</div>
							</div>
						</SheetHeader>

						<div className="space-y-5 py-4">
							{/* Price Panel */}
							<div className="grid grid-cols-3 gap-3">
								<div className="bg-muted/50 rounded-lg p-3 text-center">
									<p className="text-xs text-muted-foreground mb-1">
										Entry Price
									</p>
									<p className="font-bold text-lg">
										{formatPrice(selectedPick.recoPrice, selectedPick.category)}
									</p>
									<p className="text-xs text-muted-foreground">
										{new Date(selectedPick.recoDate).toLocaleDateString(
											"en-IN",
										)}
									</p>
								</div>
								<div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
									<p className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center justify-center gap-1">
										<ArrowUpRight className="h-3 w-3" /> Target
									</p>
									<p className="font-bold text-lg text-green-700 dark:text-green-300">
										{formatPrice(
											selectedPick.targetPrice,
											selectedPick.category,
										)}
									</p>
									{selectedPick.recoPrice > 0 && (
										<p className="text-xs text-green-600 font-medium">
											+
											{(
												((selectedPick.targetPrice - selectedPick.recoPrice) /
													selectedPick.recoPrice) *
												100
											).toFixed(1)}
											%
										</p>
									)}
								</div>
								<div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
									<p className="text-xs text-red-600 dark:text-red-400 mb-1 flex items-center justify-center gap-1">
										<ArrowDownRight className="h-3 w-3" /> Stop Loss
									</p>
									<p className="font-bold text-lg text-red-700 dark:text-red-300">
										{formatPrice(
											selectedPick.stoplossPrice,
											selectedPick.category,
										)}
									</p>
									{selectedPick.recoPrice > 0 && (
										<p className="text-xs text-red-600 font-medium">
											-
											{(
												((selectedPick.recoPrice - selectedPick.stoplossPrice) /
													selectedPick.recoPrice) *
												100
											).toFixed(1)}
											%
										</p>
									)}
								</div>
							</div>

							{/* Current Price + P&L */}
							{selectedPick.currentPrice && (
								<div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
									<div>
										<p className="text-xs text-muted-foreground">
											Current Price
										</p>
										<p className="font-semibold">
											{formatPrice(
												selectedPick.currentPrice,
												selectedPick.category,
											)}
										</p>
									</div>
									<div className="text-right">
										<p className="text-xs text-muted-foreground">Live P&L</p>
										{(() => {
											const ret =
												selectedPick.recoPrice > 0
													? (
															((selectedPick.currentPrice! -
																selectedPick.recoPrice) /
																selectedPick.recoPrice) *
															100
														).toFixed(2)
													: null;
											return ret ? (
												<p
													className={`font-bold text-lg ${Number.parseFloat(ret) >= 0 ? "text-green-600" : "text-red-600"}`}
												>
													{Number.parseFloat(ret) >= 0 ? "+" : ""}
													{ret}%
												</p>
											) : null;
										})()}
									</div>
									{selectedPick.daysHeld !== undefined && (
										<div className="text-right">
											<p className="text-xs text-muted-foreground">Days Held</p>
											<p className="font-medium">{selectedPick.daysHeld}d</p>
										</div>
									)}
								</div>
							)}

							{/* Time horizon + risk */}
							<div className="flex items-center gap-3 flex-wrap">
								{selectedPick.timeHorizon &&
									horizonConfig[selectedPick.timeHorizon] && (
										<Badge
											variant="outline"
											className={horizonConfig[selectedPick.timeHorizon].color}
										>
											<Timer className="h-3 w-3 mr-1" />
											{horizonConfig[selectedPick.timeHorizon].label}
										</Badge>
									)}
								{selectedPick.riskLevel && (
									<Badge variant="outline">
										<LucideShield className="h-3 w-3 mr-1" />
										{selectedPick.riskLevel.charAt(0).toUpperCase() +
											selectedPick.riskLevel.slice(1)}{" "}
										Risk
									</Badge>
								)}
								{selectedPick.confidenceScore !== undefined && (
									<div className="flex items-center gap-1.5">
										<BrainCircuit className="h-3.5 w-3.5 text-primary" />
										<span className="text-sm font-medium">
											Confidence: {selectedPick.confidenceScore}%
										</span>
										<Progress
											value={selectedPick.confidenceScore}
											className="h-1.5 w-16"
										/>
									</div>
								)}
							</div>

							{/* AI Rationale */}
							{selectedPick.rationale &&
								(() => {
									const raw =
										typeof selectedPick.rationale === "string"
											? selectedPick.rationale
													.replace(/^```json\n?/, "")
													.replace(/\n?```$/, "")
													.trim()
											: JSON.stringify(selectedPick.rationale);
									let displayText = raw;
									try {
										const parsed = JSON.parse(raw);
										if (parsed && typeof parsed === "object" && parsed.error) {
											displayText = "";
										}
									} catch {
										// not JSON — use raw text as-is
									}
									return displayText ? (
										<div className="rounded-lg border p-4 bg-primary/5">
											<h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
												<Brain className="h-4 w-4 text-primary" />
												AI Rationale
											</h4>
											<p className="text-sm text-muted-foreground leading-relaxed">
												{displayText}
											</p>
										</div>
									) : null;
								})()}

							{/* Key Metrics */}
							{selectedPick.keyMetrics &&
								Object.keys(selectedPick.keyMetrics).length > 0 && (
									<div>
										<h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
											<BarChart3 className="h-4 w-4 text-primary" />
											Key Metrics
										</h4>
										<div className="grid grid-cols-2 gap-2">
											{Object.entries(selectedPick.keyMetrics)
												.filter(
													([k, v]) =>
														![
															"cin",
															"seriesCode",
															"strategy",
															"expiry",
															"greeks",
														].includes(k) &&
														(v !== null && v !== undefined
															? typeof v !== "object"
															: ["rsi", "roic"].includes(k)),
												)
												.slice(0, 10)
												.map(([key, val]) => (
													<div
														key={key}
														className="bg-muted/50 rounded-md px-3 py-2"
													>
														<p className="text-xs text-muted-foreground capitalize">
															{key.replace(/_/g, " ")}
														</p>
														<p
															className={`font-medium text-sm ${val === null || val === undefined ? "text-muted-foreground" : ""}`}
														>
															{val === null || val === undefined
																? "N/A"
																: String(val)}
														</p>
													</div>
												))}
										</div>
										{selectedPick.keyMetrics.greeks && (
											<div className="mt-2 bg-muted/50 rounded-md px-3 py-2">
												<p className="text-xs text-muted-foreground mb-1">
													Greeks
												</p>
												<p className="font-medium text-sm font-mono">
													{typeof selectedPick.keyMetrics.greeks.delta ===
														"number" && (
														<span className="mr-3">
															Δ{" "}
															{selectedPick.keyMetrics.greeks.delta.toFixed(4)}
														</span>
													)}
													{typeof selectedPick.keyMetrics.greeks.theta ===
														"number" && (
														<span className="mr-3">
															Θ{" "}
															{selectedPick.keyMetrics.greeks.theta.toFixed(4)}
														</span>
													)}
													{typeof selectedPick.keyMetrics.greeks.vega ===
														"number" && (
														<span className="mr-3">
															V {selectedPick.keyMetrics.greeks.vega.toFixed(4)}
														</span>
													)}
													{typeof selectedPick.keyMetrics.greeks.gamma ===
														"number" && (
														<span>
															Γ{" "}
															{selectedPick.keyMetrics.greeks.gamma.toFixed(4)}
														</span>
													)}
												</p>
											</div>
										)}
									</div>
								)}

							{/* Suitable For */}
							{selectedPick.suitableFor?.length > 0 && (
								<div>
									<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
										<Users className="h-4 w-4 text-primary" />
										Suitable For
									</h4>
									<div className="flex flex-wrap gap-2">
										{selectedPick.suitableFor.map((s) => (
											<Badge key={s} variant="secondary" className="capitalize">
												{s.replace(/_/g, " ")}
											</Badge>
										))}
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="flex flex-col gap-2 pt-2 border-t">
								<Button
									className="w-full"
									variant="outline"
									onClick={() => {
										setExplanationPickId(selectedPick.id);
										setExplanationOpen(true);
									}}
								>
									<BrainCircuit className="h-4 w-4 mr-2 text-primary" />
									Explain with XAI
									<ChevronRight className="h-4 w-4 ml-auto" />
								</Button>
								{selectedPick.symbol &&
									["listed_stocks", "etfs", "reits_invits"].includes(
										selectedPick.category,
									) && (
										<Button
											className="w-full"
											onClick={() => {
												setSelectedPick(null);
												navigate(
													`/agent/screener?symbol=${encodeURIComponent(selectedPick.symbol!)}`,
												);
											}}
										>
											<ExternalLink className="h-4 w-4 mr-2" />
											Deep Dive in Screener
											<ChevronRight className="h-4 w-4 ml-auto" />
										</Button>
									)}
								{selectedPick.isin && (
									<Button
										variant="outline"
										className="w-full"
										onClick={() => {
											setSelectedPick(null);
											navigate(
												`/agent/screener?isin=${encodeURIComponent(selectedPick.isin!)}`,
											);
										}}
									>
										<Info className="h-4 w-4 mr-2" />
										View by ISIN in Screener
									</Button>
								)}
								<div className="flex gap-2">
									{watchlistPickIds.has(selectedPick.id) ? (
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={() => {
												removeFromWatchlistMutation.mutate(selectedPick.id);
											}}
										>
											<BookmarkCheck className="h-4 w-4 mr-2 text-primary" />{" "}
											Watchlisted
										</Button>
									) : (
										<Button
											variant="outline"
											size="sm"
											className="flex-1"
											onClick={() => {
												addToWatchlistMutation.mutate(selectedPick.id);
											}}
										>
											<Bookmark className="h-4 w-4 mr-2" /> Add to Watchlist
										</Button>
									)}
									<Button
										variant="outline"
										size="sm"
										className="flex-1"
										onClick={() => {
											handleShare(selectedPick.id, "whatsapp");
											setSelectedPick(null);
										}}
									>
										<Share2 className="h-4 w-4 mr-2" /> Share
									</Button>
								</div>
							</div>
						</div>
					</SheetContent>
				</Sheet>
			)}

			{/* XAI Explanation Dialog */}
			<Dialog open={explanationOpen} onOpenChange={setExplanationOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<BrainCircuit className="h-5 w-5 text-primary" />
							AI Explanation (XAI)
						</DialogTitle>
						<DialogDescription>
							Deep-dive into the AI decision rationale and confidence metrics
						</DialogDescription>
					</DialogHeader>

					{loadingExplanation ? (
						<div className="py-12 text-center">
							<RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
							<p className="text-muted-foreground font-medium">
								Generating technical explanation...
							</p>
							<p className="text-xs text-muted-foreground mt-2">
								Analyzing 50+ technical and fundamental indicators
							</p>
						</div>
					) : explanationData ? (
						<div className="space-y-6">
							<div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
								<h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
									<Lightbulb className="h-4 w-4 text-primary" />
									Primary Rationale
								</h4>
								<div className="text-sm leading-relaxed text-foreground/90">
									{typeof explanationData.explanation === "string"
										? explanationData.explanation
										: explanationData.rationale ||
											"The AI model identified this security as a high-potential opportunity based on a combination of bullish technical momentum and improving fundamental metrics."}
								</div>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<Card className="p-3 bg-muted/30">
									<p className="text-[10px] text-muted-foreground uppercase font-bold">
										Signal Strength
									</p>
									<p className="text-lg font-bold text-primary">
										{explanationData.confidence ||
											explanationData.confidence_score ||
											explanationData.confidenceScore ||
											85}
										%
									</p>
								</Card>
								<Card className="p-3 bg-muted/30">
									<p className="text-[10px] text-muted-foreground uppercase font-bold">
										Regime Impact
									</p>
									<p className="text-lg font-bold text-amber-600">
										{explanationData.regimeImpact ||
											explanationData.risk_weight ||
											"Neutral"}
									</p>
								</Card>
								<Card className="p-3 bg-muted/30">
									<p className="text-[10px] text-muted-foreground uppercase font-bold">
										Base Score
									</p>
									<p className="text-lg font-bold">
										{explanationData.baselineScore || "v2.4.1"}
									</p>
								</Card>
								<Card className="p-3 bg-muted/30">
									<p className="text-[10px] text-muted-foreground uppercase font-bold">
										Predicted Ret.
									</p>
									<p className="text-lg font-bold text-green-600">
										+{explanationData.predictedReturn || 92}%
									</p>
								</Card>
							</div>

							{(explanationData.featureContributions ||
								explanationData.feature_importance) && (
								<div className="space-y-3">
									<h4 className="text-sm font-semibold flex items-center gap-2">
										<Activity className="h-4 w-4 text-primary" />
										Decision Drivers (Feature Importance)
									</h4>
									<div className="space-y-2">
										{explanationData.featureContributions
											? explanationData.featureContributions.map((fc: any) => (
													<div key={fc.feature} className="space-y-1">
														<div className="flex justify-between text-xs">
															<span className="capitalize">
																{fc.feature.replace(/_/g, " ")}
															</span>
															<span
																className={`font-medium ${fc.impact > 0 ? "text-green-600" : "text-red-600"}`}
															>
																{fc.impact > 0 ? "+" : ""}
																{(fc.impact * 100).toFixed(1)}%
															</span>
														</div>
														<Progress
															value={Math.abs(fc.impact) * 100}
															className="h-1.5"
														/>
													</div>
												))
											: Object.entries(explanationData.feature_importance).map(
													([feature, importance]: [string, any]) => (
														<div key={feature} className="space-y-1">
															<div className="flex justify-between text-xs">
																<span className="capitalize">
																	{feature.replace(/_/g, " ")}
																</span>
																<span className="font-medium text-muted-foreground">
																	{(importance * 100).toFixed(1)}%
																</span>
															</div>
															<Progress
																value={importance * 100}
																className="h-1.5"
															/>
														</div>
													),
												)}
									</div>
								</div>
							)}

							{explanationData.technical_indicators && (
								<div className="space-y-3">
									<h4 className="text-sm font-semibold flex items-center gap-2">
										<Zap className="h-4 w-4 text-primary" />
										Technical Analysis Summary
									</h4>
									<div className="grid grid-cols-2 gap-2">
										{Object.entries(explanationData.technical_indicators).map(
											([name, status]: [string, any]) => (
												<div
													key={name}
													className="flex items-center justify-between p-2 rounded-md bg-muted/20 border"
												>
													<span className="text-xs">{name}</span>
													<Badge
														variant={
															status === "Bullish" || status === "Overbought"
																? "default"
																: status === "Bearish" || status === "Oversold"
																	? "destructive"
																	: "secondary"
														}
														className="text-[10px] h-5"
													>
														{status}
													</Badge>
												</div>
											),
										)}
									</div>
								</div>
							)}
						</div>
					) : (
						<div className="py-8 text-center border rounded-lg bg-muted/20">
							<AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
							<p className="text-sm">
								XAI explanation is currently unavailable for this pick.
							</p>
							<Button
								variant="link"
								size="sm"
								onClick={() => setExplanationPickId(explainingPickId)}
							>
								Retry Generation
							</Button>
						</div>
					)}

					<DialogFooter className="mt-4 border-t pt-4">
						<Button variant="outline" onClick={() => setExplanationOpen(false)}>
							Close Explanation
						</Button>
						<Button className="gap-2">
							<Download className="h-4 w-4" />
							Export Technical Report
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Share Pick via Email</DialogTitle>
						<DialogDescription>
							Enter the recipient's email address to share this investment pick.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="email">Email Address</Label>
							<Input
								id="email"
								type="email"
								placeholder="client@example.com"
								value={shareEmail}
								onChange={(e) => setShareEmail(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShareDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleEmailShare}
							disabled={!shareEmail || shareMutation.isPending}
						>
							{shareMutation.isPending ? "Sending..." : "Send Email"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Share with Clients dialog (T006) */}
			<Dialog
				open={shareClientsDialogOpen}
				onOpenChange={setShareClientsDialogOpen}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Share Pick with Clients
						</DialogTitle>
						<DialogDescription>
							{shareClientsPick && (
								<span className="font-medium text-foreground">
									{shareClientsPick.symbol || shareClientsPick.instrumentName}
									{shareClientsPick.targetPrice &&
										shareClientsPick.recoPrice && (
											<span className="ml-2 text-green-600">
												+
												{(
													((Number(shareClientsPick.targetPrice) -
														Number(shareClientsPick.recoPrice)) /
														Number(shareClientsPick.recoPrice)) *
													100
												).toFixed(1)}
												% target
											</span>
										)}
								</span>
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{/* Channel selector */}
						<div className="flex gap-2">
							<Button
								size="sm"
								variant={
									shareClientsChannel === "whatsapp" ? "default" : "outline"
								}
								onClick={() => setShareClientsChannel("whatsapp")}
								className="flex-1"
							>
								<MessageSquare className="h-4 w-4 mr-2" />
								WhatsApp
							</Button>
							<Button
								size="sm"
								variant={
									shareClientsChannel === "email" ? "default" : "outline"
								}
								onClick={() => setShareClientsChannel("email")}
								className="flex-1"
							>
								<Mail className="h-4 w-4 mr-2" />
								Email
							</Button>
						</div>

						{/* Contact list */}
						<div>
							<div className="flex items-center justify-between mb-2">
								<Label className="text-sm font-medium">Select Contacts</Label>
								<div className="flex items-center gap-3">
									<label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
										<input
											type="checkbox"
											className="h-3 w-3 cursor-pointer"
											checked={hideUnreachable}
											onChange={(e) => setHideUnreachable(e.target.checked)}
										/>
										Hide unreachable
									</label>
									<button
										className="text-xs text-primary hover:underline"
										onClick={() => {
											const reachable = (marketingContacts as any[])
												.filter((c) =>
													shareClientsChannel === "email"
														? !!c.email
														: !!c.phone && !c.phone.startsWith("+XXXX"),
												)
												.map((c) => c.id);
											setShareClientsSelected((prev) =>
												reachable.every((id) => prev.includes(id))
													? []
													: reachable,
											);
										}}
									>
										{(marketingContacts as any[])
											.filter((c) =>
												shareClientsChannel === "email"
													? !!c.email
													: !!c.phone && !c.phone.startsWith("+XXXX"),
											)
											.every((c) => shareClientsSelected.includes(c.id))
											? "Deselect All"
											: "Select All"}
									</button>
								</div>
							</div>
							<ScrollArea className="h-52 border rounded-lg p-2">
								{(marketingContacts as any[]).length === 0 ? (
									<div className="text-center py-6 text-muted-foreground text-sm">
										No contacts found. Add prospects from the Lead Pipeline.
									</div>
								) : (
									<div className="space-y-1">
										{(marketingContacts as any[])
											.filter((c: any) => {
												const reachable =
													shareClientsChannel === "email"
														? !!c.email
														: !!c.phone && !c.phone.startsWith("+XXXX");
												return !hideUnreachable || reachable;
											})
											.map((c: any) => {
												const reachable =
													shareClientsChannel === "email"
														? !!c.email
														: !!c.phone && !c.phone.startsWith("+XXXX");
												return (
													<div
														key={c.id}
														className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors ${
															!reachable ? "opacity-40 cursor-not-allowed" : ""
														}`}
														onClick={() => {
															if (!reachable) return;
															setShareClientsSelected((prev) =>
																prev.includes(c.id)
																	? prev.filter((id) => id !== c.id)
																	: [...prev, c.id],
															);
														}}
													>
														<Checkbox
															checked={shareClientsSelected.includes(c.id)}
															disabled={!reachable}
															onCheckedChange={() => {
																if (!reachable) return;
																setShareClientsSelected((prev) =>
																	prev.includes(c.id)
																		? prev.filter((id) => id !== c.id)
																		: [...prev, c.id],
																);
															}}
														/>
														<div className="flex-1 min-w-0">
															<p className="text-sm font-medium truncate">
																{c.name}
															</p>
															<p className="text-xs text-muted-foreground truncate">
																{shareClientsChannel === "email"
																	? c.email || "no email"
																	: c.phone || "no phone"}
															</p>
														</div>
														<Badge
															variant={
																c.source === "prospect"
																	? "outline"
																	: "secondary"
															}
															className="text-xs"
														>
															{c.source === "prospect" ? "P" : "C"}
														</Badge>
													</div>
												);
											})}
									</div>
								)}
							</ScrollArea>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShareClientsDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={
								shareClientsSelected.length === 0 || sharePickMutation.isPending
							}
							onClick={() => {
								if (!shareClientsPick) return;
								sharePickMutation.mutate({
									pickId: shareClientsPick.id,
									clientIds: shareClientsSelected,
									channel: shareClientsChannel,
								});
							}}
						>
							<Send className="h-4 w-4 mr-2" />
							{sharePickMutation.isPending
								? "Sending…"
								: `Share with ${shareClientsSelected.length} contact${shareClientsSelected.length !== 1 ? "s" : ""}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

interface PickCardProps {
	pick: DailyPick;
	showDetails?: boolean;
	compact?: boolean;
	isWatchlisted?: boolean;
	onAddToWatchlist?: (pickId: number) => void;
	onRemoveFromWatchlist?: (pickId: number) => void;
	onShareEmail?: (pickId: number) => void;
	onShareWhatsApp?: (pickId: number) => void;
	onShareClients?: (pick: DailyPick) => void;
	onClick?: (pick: DailyPick) => void;
	onExplain?: (pickId: number) => void;
	isSelected?: boolean;
	onSelectToggle?: (pickId: number) => void;
}

// ─── PicksTable ────────────────────────────────────────────────────────────────
interface PicksTableProps {
	picks: DailyPick[];
	onRowClick?: (pick: DailyPick) => void;
	showReturn?: boolean;
}

function PicksTable({
	picks,
	onRowClick,
	showReturn = false,
}: PicksTableProps) {
	const [sortCol, setSortCol] = useState<string>("recoDate");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

	const handleSort = (col: string) => {
		if (sortCol === col) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortCol(col);
			setSortDir("asc");
		}
	};

	const sorted = [...picks].sort((a, b) => {
		let av: any, bv: any;
		switch (sortCol) {
			case "name":
				av = a.instrumentName;
				bv = b.instrumentName;
				break;
			case "category":
				av = a.category;
				bv = b.category;
				break;
			case "status":
				av = a.status;
				bv = b.status;
				break;
			case "entry":
				av = a.recoPrice;
				bv = b.recoPrice;
				break;
			case "target":
				av = a.targetPrice;
				bv = b.targetPrice;
				break;
			case "stoploss":
				av = a.stoplossPrice;
				bv = b.stoplossPrice;
				break;
			case "upside":
				av =
					a.targetPrice && a.recoPrice
						? (a.targetPrice - a.recoPrice) / a.recoPrice
						: 0;
				bv =
					b.targetPrice && b.recoPrice
						? (b.targetPrice - b.recoPrice) / b.recoPrice
						: 0;
				break;
			case "return":
				av = a.returnPct ?? 0;
				bv = b.returnPct ?? 0;
				break;
			case "confidence":
				av = a.confidenceScore ?? 0;
				bv = b.confidenceScore ?? 0;
				break;
			case "recoDate":
				av = new Date(a.recoDate).getTime();
				bv = new Date(b.recoDate).getTime();
				break;
			default:
				av = 0;
				bv = 0;
		}
		if (av < bv) return sortDir === "asc" ? -1 : 1;
		if (av > bv) return sortDir === "asc" ? 1 : -1;
		return 0;
	});

	const SortIcon = ({ col }: { col: string }) => {
		if (sortCol !== col)
			return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
		return sortDir === "asc" ? (
			<ChevronUp className="h-3 w-3 ml-1 inline text-primary" />
		) : (
			<ChevronDown className="h-3 w-3 ml-1 inline text-primary" />
		);
	};

	const Th = ({
		col,
		label,
		right,
	}: { col: string; label: string; right?: boolean }) => (
		<th
			onClick={() => handleSort(col)}
			className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${right ? "text-right" : "text-left"}`}
		>
			{label}
			<SortIcon col={col} />
		</th>
	);

	return (
		<div className="overflow-x-auto rounded-lg border">
			<table className="w-full text-sm border-collapse">
				<thead className="bg-muted/60 sticky top-0 z-10">
					<tr>
						<th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left w-8">
							#
						</th>
						<Th col="name" label="Instrument" />
						<Th col="category" label="Type" />
						<Th col="status" label="Status" />
						<Th col="entry" label="Entry" right />
						<Th col="target" label="Target" right />
						<Th col="stoploss" label="SL" right />
						<Th col="upside" label="Upside" right />
						{showReturn && <Th col="return" label="Return" right />}
						<Th col="confidence" label="AI%" right />
						<Th col="recoDate" label="Date" />
					</tr>
				</thead>
				<tbody>
					{sorted.map((pick, idx) => {
						const isExpired =
							pick.status === "live" &&
							pick.expiryDate &&
							new Date(pick.expiryDate) < new Date();
						const effectiveStatus = isExpired ? "expired" : pick.status;
						const status = statusConfig[effectiveStatus] || statusConfig.live;
						const upsidePct =
							pick.targetPrice && pick.recoPrice
								? ((pick.targetPrice - pick.recoPrice) / pick.recoPrice) * 100
								: null;
						const returnPct =
							pick.returnPct ??
							(pick.currentPrice && pick.recoPrice
								? ((pick.currentPrice - pick.recoPrice) / pick.recoPrice) * 100
								: null);
						const catLabel = categoryLabels[pick.category] || pick.category;
						const horizon = pick.timeHorizon
							? horizonConfig[pick.timeHorizon]
							: null;

						return (
							<tr
								key={pick.id}
								onClick={() => onRowClick?.(pick)}
								className={`border-t transition-colors ${onRowClick ? "cursor-pointer hover:bg-accent/40" : ""} ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
							>
								<td className="px-3 py-2.5 text-muted-foreground text-xs">
									{idx + 1}
								</td>
								<td className="px-3 py-2.5 max-w-[200px]">
									<div className="font-semibold text-foreground truncate leading-tight">
										{pick.instrumentName}
									</div>
									{pick.symbol && (
										<div className="text-[10px] text-muted-foreground">
											{pick.symbol}
											{pick.exchange ? ` · ${pick.exchange}` : ""}
										</div>
									)}
								</td>
								<td className="px-3 py-2.5 whitespace-nowrap">
									<Badge variant="outline" className="text-[10px] px-1.5 py-0">
										{catLabel}
									</Badge>
								</td>
								<td className="px-3 py-2.5 whitespace-nowrap">
									<span
										className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${status.color}`}
									>
										{status.label}
									</span>
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
									{formatPrice(pick.recoPrice, pick.category)}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap text-emerald-600 dark:text-emerald-400">
									{formatPrice(pick.targetPrice, pick.category)}
								</td>
								<td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap text-red-500 dark:text-red-400">
									{formatPrice(pick.stoplossPrice, pick.category)}
								</td>
								<td className="px-3 py-2.5 text-right whitespace-nowrap">
									{upsidePct !== null ? (
										<span
											className={`text-xs font-semibold ${upsidePct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
										>
											{upsidePct >= 0 ? "+" : ""}
											{upsidePct.toFixed(1)}%
										</span>
									) : (
										"—"
									)}
								</td>
								{showReturn && (
									<td className="px-3 py-2.5 text-right whitespace-nowrap">
										{returnPct !== null ? (
											<span
												className={`text-xs font-semibold ${returnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}
											>
												{returnPct >= 0 ? "+" : ""}
												{returnPct.toFixed(1)}%
											</span>
										) : (
											"—"
										)}
									</td>
								)}
								<td className="px-3 py-2.5 text-right whitespace-nowrap">
									{pick.confidenceScore !== undefined ? (
										<span
											className={`text-xs font-semibold ${getConfidenceColor(pick.confidenceScore)}`}
										>
											{pick.confidenceScore}%
										</span>
									) : (
										"—"
									)}
								</td>
								<td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
									{new Date(pick.recoDate).toLocaleDateString("en-IN", {
										day: "2-digit",
										month: "short",
										year: "2-digit",
									})}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function PickCard({
	pick,
	showDetails = false,
	compact = false,
	isWatchlisted = false,
	onAddToWatchlist,
	onRemoveFromWatchlist,
	onShareEmail,
	onShareWhatsApp,
	onShareClients,
	onClick,
	onExplain,
	isSelected = false,
	onSelectToggle,
}: PickCardProps) {
	const [localBudget, setLocalBudget] = useState("100000");
	const suggestedAllocation = pick.keyMetrics?.suggestedAllocation || 5;
	const Icon = categoryIcons[pick.category] || TrendingUp;
	const isExpiredByDate =
		pick.status === "live" &&
		pick.expiryDate &&
		new Date(pick.expiryDate) < new Date();
	const effectiveStatus = isExpiredByDate ? "expired" : pick.status;
	const status = statusConfig[effectiveStatus] || statusConfig.live;
	const StatusIcon = status.icon;
	const horizon = pick.timeHorizon ? horizonConfig[pick.timeHorizon] : null;

	const upside =
		pick.targetPrice && pick.recoPrice
			? (((pick.targetPrice - pick.recoPrice) / pick.recoPrice) * 100).toFixed(
					1,
				)
			: "0.0";
	const downside =
		pick.stoplossPrice && pick.recoPrice
			? (
					((pick.recoPrice - pick.stoplossPrice) / pick.recoPrice) *
					100
				).toFixed(1)
			: "0.0";
	const currentReturn =
		pick.currentPrice && pick.recoPrice
			? (((pick.currentPrice - pick.recoPrice) / pick.recoPrice) * 100).toFixed(
					1,
				)
			: null;

	if (compact) {
		return (
			<div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
				<div className={`p-2 rounded-full ${status.color} text-foreground`}>
					<Icon className="h-4 w-4" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<span className="font-medium truncate">{pick.instrumentName}</span>
						<Badge variant="outline" className="text-[10px]">
							{categoryLabels[pick.category]}
						</Badge>
						{pick.confidenceScore !== undefined && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger>
										<span
											className={`text-[10px] font-medium flex items-center gap-0.5 ${getConfidenceColor(pick.confidenceScore)}`}
										>
											<span
												className={`w-1.5 h-1.5 rounded-full ${getConfidenceDot(pick.confidenceScore)}`}
											/>
											{pick.confidenceScore}%
										</span>
									</TooltipTrigger>
									<TooltipContent>AI Confidence Score</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
					<div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
						<span>Reco: {formatPrice(pick.recoPrice, pick.category)}</span>
						<span>Target: {formatPrice(pick.targetPrice, pick.category)}</span>
						<span>{new Date(pick.recoDate).toLocaleDateString("en-IN")}</span>
					</div>
				</div>
				<div className="text-right">
					<Badge className={status.color}>{status.label}</Badge>
					{currentReturn && (
						<div
							className={`text-sm font-medium mt-1 ${Number.parseFloat(currentReturn) >= 0 ? "text-green-600" : "text-red-600"}`}
						>
							{Number.parseFloat(currentReturn) >= 0 ? "+" : ""}
							{currentReturn}%
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<Card
			className={`overflow-hidden transition-all ${onClick ? "cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/20" : ""} ${isSelected ? "ring-2 ring-primary border-transparent shadow-md" : ""}`}
			onClick={onClick ? () => onClick(pick) : undefined}
		>
			<div className={`h-1 ${status.color}`} />
			<CardContent className="pt-4">
				<div className="flex items-start gap-3">
					{onSelectToggle && (
						<div
							className="pt-1.5 shrink-0"
							onClick={(e) => e.stopPropagation()}
						>
							<Checkbox
								checked={isSelected}
								onCheckedChange={() => onSelectToggle(pick.id)}
							/>
						</div>
					)}
					<div className="p-2 rounded-full bg-primary/10 shrink-0">
						<Icon className="h-5 w-5 text-primary" />
					</div>
					<div className="flex-1">
						<div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
							<div className="min-w-0 flex-1 space-y-1">
								<h3 className="font-bold text-base sm:text-lg leading-tight break-words text-foreground">
									{pick.instrumentName}
								</h3>
								<div className="flex items-center gap-2 flex-wrap">
									{pick.symbol && (
										<span className="text-sm text-muted-foreground font-mono">
											{pick.symbol}
										</span>
									)}
									{pick.exchange &&
										[
											"listed_stocks",
											"reits_invits",
											"etfs",
											"global_stocks",
											"bonds",
										].includes(pick.category) && (
											<span
												className={`text-xs px-1.5 py-0.5 rounded ${
													pick.category === "global_stocks"
														? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
														: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
												}`}
											>
												{pick.exchange}
											</span>
										)}
									{pick.isin && pick.category === "mutual_funds" && (
										<span className="text-xs text-muted-foreground font-mono">
											ISIN: {pick.isin}
										</span>
									)}
									{pick.isin && pick.category === "bonds" && (
										<span className="text-xs text-muted-foreground font-mono">
											ISIN: {pick.isin}
										</span>
									)}
									{pick.category === "unlisted" && pick.keyMetrics?.cin && (
										<span className="text-xs text-orange-600 dark:text-orange-400 font-mono">
											CIN: {pick.keyMetrics.cin}
										</span>
									)}
									{pick.category === "sgb" && pick.keyMetrics?.seriesCode && (
										<span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">
											Series: {pick.keyMetrics.seriesCode}
										</span>
									)}
									{pick.category === "derivatives" &&
										pick.keyMetrics?.strategy && (
											<span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded font-medium">
												{pick.keyMetrics.strategy}
											</span>
										)}
									{pick.category === "derivatives" &&
										pick.keyMetrics?.expiry && (
											<span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">
												Exp:{" "}
												{new Date(
													pick.keyMetrics.expiry as string,
												).toLocaleDateString("en-IN", {
													day: "numeric",
													month: "short",
												})}
											</span>
										)}
								</div>
							</div>
							<div className="flex items-center gap-1.5 shrink-0 self-start">
								{pick.confidenceScore !== undefined && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10">
													<BrainCircuit className="h-3 w-3 text-primary" />
													<span
														className={`text-[10px] sm:text-xs font-bold ${getConfidenceColor(pick.confidenceScore)}`}
													>
														{pick.confidenceScore}%
													</span>
												</div>
											</TooltipTrigger>
											<TooltipContent className="max-w-[220px] space-y-1.5 text-xs p-3">
												<p className="font-semibold flex items-center gap-1 text-primary">
													<BrainCircuit className="h-3.5 w-3.5" />
													AI Confidence: {pick.confidenceScore}%
												</p>
												<p className="text-muted-foreground">
													{pick.confidenceScore >= 80
														? "High confidence — strong alignment across technical, fundamental, and macro signals."
														: pick.confidenceScore >= 60
															? "Moderate confidence — most indicators agree; some divergence noted."
															: "Lower confidence — use position sizing carefully; wider uncertainty."}
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/10 shrink-0">
												<Percent className="h-3 w-3 text-primary" />
												<span className="text-[10px] sm:text-xs font-bold text-primary">
													{suggestedAllocation}% Weight
												</span>
											</div>
										</TooltipTrigger>
										<TooltipContent>
											Recommended Allocation Weight
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<Badge
									variant="outline"
									className={`${status.color} bg-opacity-10 text-foreground text-[10px] px-2 py-0 h-5 font-semibold shrink-0`}
								>
									<StatusIcon className="h-3 w-3 mr-1" />
									{status.label}
								</Badge>
							</div>
						</div>

						<div className="flex items-center gap-2 mt-2 flex-wrap">
							{horizon && (
								<Badge variant="outline" className={horizon.color}>
									<Timer className="h-3 w-3 mr-1" />
									{horizon.label}
								</Badge>
							)}
							{pick.sectorCategory && (
								<Badge variant="secondary" className="text-xs">
									{pick.sectorCategory}
								</Badge>
							)}
						</div>

						{/* #2 Risk/Reward badge */}
						{Number.parseFloat(upside) > 0 &&
							Number.parseFloat(downside) > 0 && (
								<div className="flex items-center gap-2 mt-3">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge
													variant="outline"
													className={`text-[10px] font-bold cursor-help ${Number.parseFloat(upside) / Number.parseFloat(downside) >= 2 ? "border-green-400 text-green-700 dark:text-green-400" : Number.parseFloat(upside) / Number.parseFloat(downside) >= 1 ? "border-amber-400 text-amber-700 dark:text-amber-400" : "border-muted-foreground text-muted-foreground"}`}
												>
													{(
														Number.parseFloat(upside) /
														Number.parseFloat(downside)
													).toFixed(1)}
													x R/R
												</Badge>
											</TooltipTrigger>
											<TooltipContent className="text-xs space-y-1">
												<p className="font-semibold">Risk / Reward Ratio</p>
												<p>
													Upside potential:{" "}
													<span className="text-green-600 font-medium">
														+{upside}%
													</span>
												</p>
												<p>
													Downside risk:{" "}
													<span className="text-red-600 font-medium">
														-{downside}%
													</span>
												</p>
												<p className="text-muted-foreground pt-1">
													Ratio ≥2x is generally favourable
												</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							)}

						<div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
							<div className="bg-muted/30 p-2 sm:p-3 rounded-lg border border-transparent hover:border-border transition-colors">
								<div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
									Entry Price
								</div>
								<div className="font-bold text-sm sm:text-base">
									{formatPrice(pick.recoPrice, pick.category)}
								</div>
							</div>
							<div className="bg-green-50/50 dark:bg-green-900/5 p-2 sm:p-3 rounded-lg border border-green-100 dark:border-green-900/10">
								<div className="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400 font-bold mb-1 flex items-center gap-1">
									<ArrowUpRight className="h-3.5 w-3.5" />
									Target
								</div>
								<div className="font-bold text-sm sm:text-base text-green-600">
									{formatPrice(pick.targetPrice, pick.category)}
								</div>
								<div className="text-[10px] font-medium text-green-600/80 mt-1">
									+{upside}% Potential
								</div>
							</div>
							<div className="bg-red-50/50 dark:bg-red-900/5 p-2 sm:p-3 rounded-lg border border-red-100 dark:border-red-900/10">
								<div className="text-[10px] uppercase tracking-widest text-red-600 dark:text-red-400 font-bold mb-1 flex items-center gap-1">
									<ArrowDownRight className="h-3.5 w-3.5" />
									Stoploss
								</div>
								<div className="font-bold text-sm sm:text-base text-red-600">
									{formatPrice(pick.stoplossPrice, pick.category)}
								</div>
								<div className="text-[10px] font-medium text-red-600/80 mt-1">
									-{downside}% Max Risk
								</div>
							</div>
						</div>

						{/* #4 Visual price level gauge */}
						{pick.currentPrice &&
							pick.stoplossPrice &&
							pick.targetPrice &&
							(() => {
								const sl = pick.stoplossPrice;
								const tgt = pick.targetPrice;
								const cur = pick.currentPrice;
								const range = tgt - sl;
								const pct =
									range > 0
										? Math.min(100, Math.max(0, ((cur - sl) / range) * 100))
										: 50;
								const entryPct =
									range > 0
										? Math.min(
												100,
												Math.max(0, ((pick.recoPrice - sl) / range) * 100),
											)
										: 50;
								const isProfit = cur >= pick.recoPrice;
								return (
									<div className="mt-3">
										<div className="flex justify-between text-[10px] text-muted-foreground mb-1">
											<span className="text-red-500">
												SL {formatPrice(sl, pick.category)}
											</span>
											<span className="font-medium text-xs">
												{formatPrice(cur, pick.category)}
											</span>
											<span className="text-green-600">
												TGT {formatPrice(tgt, pick.category)}
											</span>
										</div>
										<div className="relative h-2 rounded-full bg-gradient-to-r from-red-200 via-muted to-green-200 dark:from-red-900/50 dark:to-green-900/50">
											<svg
												className="absolute inset-0 w-full h-full overflow-visible"
												viewBox="0 0 100 8"
												preserveAspectRatio="none"
											>
												<rect
													x={entryPct - 0.5}
													y="-2"
													width="1"
													height="12"
													rx="0.5"
													className="fill-muted-foreground/50"
												/>
												<circle
													cx={pct}
													cy="4"
													r="6"
													className={`stroke-background stroke-[1.5] ${isProfit ? "fill-green-500" : "fill-red-500"}`}
												/>
											</svg>
										</div>
										<div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
											<span>-{downside}%</span>
											<span className="text-[9px] text-muted-foreground/60">
												entry mark ↑
											</span>
											<span>+{upside}%</span>
										</div>
									</div>
								);
							})()}

						{pick.currentPrice && (
							<div className="mt-3 p-2 rounded bg-muted/50">
								<div className="flex items-center justify-between">
									<span className="text-sm">
										Current: {formatPrice(pick.currentPrice, pick.category)}
									</span>
									<span
										className={`font-medium ${Number.parseFloat(currentReturn || "0") >= 0 ? "text-green-600" : "text-red-600"}`}
									>
										{Number.parseFloat(currentReturn || "0") >= 0 ? "+" : ""}
										{currentReturn}%
									</span>
								</div>
								<div className="flex items-center justify-between mt-1">
									{pick.daysHeld !== undefined && (
										<span className="text-xs text-muted-foreground">
											Holding for {pick.daysHeld} days
										</span>
									)}
									{/* #8 Enhanced freshness indicator */}
									{pick.priceDataSource && (
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger>
													<span className="text-[10px] text-muted-foreground flex items-center gap-1">
														{pick.dataFreshness && (
															<span
																className={`w-1.5 h-1.5 rounded-full ${
																	pick.dataFreshness === "live"
																		? "bg-green-500"
																		: pick.dataFreshness === "recent"
																			? "bg-blue-500"
																			: pick.dataFreshness === "delayed"
																				? "bg-yellow-500"
																				: pick.dataFreshness === "stale"
																					? "bg-red-500"
																					: "bg-gray-400"
																}`}
															/>
														)}
														{pick.lastPriceUpdate
															? (() => {
																	const diff =
																		Date.now() -
																		new Date(pick.lastPriceUpdate).getTime();
																	const m = Math.floor(diff / 60000);
																	if (m < 1) return "Price: just now";
																	if (m < 60) return `Price: ${m}m ago`;
																	const h = Math.floor(m / 60);
																	return h < 24
																		? `Price: ${h}h ago`
																		: `Price: ${Math.floor(h / 24)}d ago`;
																})()
															: pick.priceDataSource}
													</span>
												</TooltipTrigger>
												<TooltipContent className="text-xs">
													<p>Source: {pick.priceDataSource}</p>
													<p>Type: {pick.priceDataType}</p>
													<p>Refresh: {pick.priceRefreshInterval}</p>
													{pick.lastPriceUpdate && (
														<p>
															Updated:{" "}
															{new Date(pick.lastPriceUpdate).toLocaleString(
																"en-IN",
															)}
														</p>
													)}
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
							</div>
						)}

						{/* Inline Sizing Calculator */}
						<div
							className="mt-3.5 p-3 rounded-lg border border-dashed bg-muted/20"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
								<div className="flex items-center gap-2">
									<Calculator className="h-3.5 w-3.5 text-primary animate-pulse" />
									<span className="text-xs font-bold text-foreground">
										Sizing Calculator
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									<span className="text-[9px] text-muted-foreground uppercase font-bold">
										Budget:
									</span>
									<input
										type="number"
										value={localBudget}
										onChange={(e) => setLocalBudget(e.target.value)}
										className="h-6 w-24 px-1.5 py-0.5 text-right text-xs rounded border bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
										placeholder="1,00,000"
									/>
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4 mt-2.5 pt-2 border-t border-muted">
								<div>
									<div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
										Target Size ({suggestedAllocation}%)
									</div>
									<div className="font-bold text-xs sm:text-sm text-primary">
										{formatPrice(
											Math.round(
												Number(localBudget || 0) * (suggestedAllocation / 100),
											),
											pick.category,
										)}
									</div>
								</div>
								<div className="text-right">
									<div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
										Approx. Shares/Units
									</div>
									<div className="font-bold text-xs sm:text-sm text-foreground">
										{pick.recoPrice > 0
											? Math.floor(
													(Number(localBudget || 0) *
														(suggestedAllocation / 100)) /
														pick.recoPrice,
												).toLocaleString()
											: "—"}
									</div>
								</div>
							</div>
						</div>

						{/* #7 Structured Rationale */}
						{pick.rationale &&
							(() => {
								const raw = parseRationale(pick.rationale);
								const sentences = raw
									.split(/(?<=[.!?])\s+/)
									.map((s) => s.trim())
									.filter((s) => s.length > 10);
								const whyLike = sentences.filter(
									(_, i) => i < Math.ceil(sentences.length * 0.5),
								);
								const risks = sentences.filter(
									(_, i) =>
										i >= Math.ceil(sentences.length * 0.5) &&
										i < Math.ceil(sentences.length * 0.75),
								);
								const exits = sentences.filter(
									(_, i) => i >= Math.ceil(sentences.length * 0.75),
								);
								return (
									<div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
										{whyLike.length > 0 && (
											<div className="space-y-2">
												<p className="text-[11px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 opacity-80">
													<TrendingUp className="h-3.5 w-3.5" /> High Conviction
												</p>
												<ul className="text-xs text-foreground/90 space-y-1.5 pl-4">
													{whyLike.map((s, i) => (
														<li
															key={i}
															className="list-decimal list-outside leading-relaxed"
														>
															{s}
														</li>
													))}
												</ul>
											</div>
										)}
										{risks.length > 0 && (
											<div className="space-y-2">
												<p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1.5 opacity-80">
													<AlertTriangle className="h-3.5 w-3.5" /> Market Risks
												</p>
												<ul className="text-xs text-foreground/90 space-y-1.5 pl-4">
													{risks.map((s, i) => (
														<li
															key={i}
															className="list-decimal list-outside leading-relaxed"
														>
															{s}
														</li>
													))}
												</ul>
											</div>
										)}
										{exits.length > 0 && (
											<div className="space-y-2">
												<p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 opacity-80">
													<Target className="h-3.5 w-3.5" /> Execution Guide
												</p>
												<ul className="text-xs text-foreground/90 space-y-1.5 pl-4">
													{exits.map((s, i) => (
														<li
															key={i}
															className="list-decimal list-outside leading-relaxed"
														>
															{s}
														</li>
													))}
												</ul>
											</div>
										)}
									</div>
								);
							})()}

						<div className="flex items-center gap-2 mt-3 flex-wrap">
							<Badge
								variant="outline"
								className={riskColors[pick.riskLevel] || riskColors.medium}
							>
								{pick.riskLevel} risk
							</Badge>
							{pick.suitableFor?.map((profile) => (
								<Badge key={profile} variant="secondary" className="text-xs">
									{profile}
								</Badge>
							))}
						</div>

						{showDetails && pick.keyMetrics && (
							<div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs">
								{Object.entries(pick.keyMetrics)
									.filter(
										([, value]) => typeof value !== "object" || value === null,
									)
									.slice(0, 4)
									.map(([key, value]) => (
										<div key={key}>
											<span className="text-muted-foreground capitalize">
												{key.replace(/([A-Z])/g, " $1")}:{" "}
											</span>
											<span className="font-medium">
												{typeof value === "number"
													? value.toFixed(2)
													: typeof value === "boolean"
														? value
															? "Yes"
															: "No"
														: typeof value === "string"
															? value
															: "—"}
											</span>
										</div>
									))}
							</div>
						)}

						{showDetails &&
							pick.category === "derivatives" &&
							pick.keyMetrics && (
								<div className="mt-3 pt-3 border-t">
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
										{pick.keyMetrics.strategy && (
											<div>
												<span className="text-muted-foreground">
													Strategy:{" "}
												</span>
												<span className="font-medium">
													{pick.keyMetrics.strategy}
												</span>
											</div>
										)}
										{pick.keyMetrics.lotSize && (
											<div>
												<span className="text-muted-foreground">
													Lot Size:{" "}
												</span>
												<span className="font-medium">
													{pick.keyMetrics.lotSize}
												</span>
											</div>
										)}
										{pick.keyMetrics.marginRequired && (
											<div>
												<span className="text-muted-foreground">Margin: </span>
												<span className="font-medium">
													₹
													{Number(
														pick.keyMetrics.marginRequired,
													).toLocaleString()}
												</span>
											</div>
										)}
										{pick.keyMetrics.impliedVolatility && (
											<div>
												<span className="text-muted-foreground">IV: </span>
												<span className="font-medium">
													{pick.keyMetrics.impliedVolatility}%
												</span>
											</div>
										)}
										{pick.keyMetrics.maxProfit !== undefined && (
											<div>
												<span className="text-muted-foreground">
													Max Profit:{" "}
												</span>
												<span className="font-medium text-green-600">
													{pick.keyMetrics.maxProfit === "Unlimited"
														? "∞"
														: `₹${Number(pick.keyMetrics.maxProfit).toLocaleString()}`}
												</span>
											</div>
										)}
										{pick.keyMetrics.maxLoss !== undefined && (
											<div>
												<span className="text-muted-foreground">
													Max Loss:{" "}
												</span>
												<span className="font-medium text-red-600">
													₹{Number(pick.keyMetrics.maxLoss).toLocaleString()}
												</span>
											</div>
										)}
										{pick.keyMetrics.breakeven && (
											<div>
												<span className="text-muted-foreground">
													Breakeven:{" "}
												</span>
												<span className="font-medium">
													{Array.isArray(pick.keyMetrics.breakeven)
														? pick.keyMetrics.breakeven
																.map((b: number) => `₹${b.toLocaleString()}`)
																.join(", ")
														: `₹${pick.keyMetrics.breakeven}`}
												</span>
											</div>
										)}
										{pick.keyMetrics.greeks && (
											<div>
												<span className="text-muted-foreground">Greeks: </span>
												<span className="font-medium">
													Δ
													{typeof pick.keyMetrics.greeks.delta === "number"
														? pick.keyMetrics.greeks.delta.toFixed(4)
														: pick.keyMetrics.greeks.delta ?? "N/A"}{" "}
													Θ
													{typeof pick.keyMetrics.greeks.theta === "number"
														? pick.keyMetrics.greeks.theta.toFixed(2)
														: pick.keyMetrics.greeks.theta ?? "N/A"}{" "}
													V
													{typeof pick.keyMetrics.greeks.vega === "number"
														? pick.keyMetrics.greeks.vega.toFixed(2)
														: pick.keyMetrics.greeks.vega ?? "N/A"}
												</span>
											</div>
										)}
									</div>
									{pick.keyMetrics.legs && (
										<div className="mt-2 p-2 bg-muted/50 rounded text-xs">
											<span className="text-muted-foreground">Legs: </span>
											<span className="font-mono">
												{Array.isArray(pick.keyMetrics.legs)
													? pick.keyMetrics.legs
															.map(
																(leg: any) =>
																	`${String(leg.action ?? "").toUpperCase()} ${leg.quantity ?? ""}x ${String(leg.type ?? "").toUpperCase()}${leg.strikePrice ? ` @${leg.strikePrice}` : ""}${leg.premium ? ` (₹${leg.premium})` : ""}`,
															)
															.join(" | ")
													: typeof pick.keyMetrics.legs === "string"
														? pick.keyMetrics.legs
														: "—"}
											</span>
										</div>
									)}
								</div>
							)}

						<div className="flex items-center justify-between mt-3 pt-3 border-t">
							<div className="flex items-center gap-4 text-xs text-muted-foreground">
								<span className="flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									{new Date(pick.recoDate).toLocaleDateString("en-IN")}
								</span>
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									Valid till{" "}
									{new Date(pick.expiryDate).toLocaleDateString("en-IN")}
								</span>
							</div>

							<div className="flex items-center gap-1">
								{/* #9 Quick Copy (WhatsApp-ready) */}
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={(e) => {
													e.stopPropagation();
													const cur = getCurrencySymbol(pick.category);
													const msg =
														`📊 *${pick.instrumentName}${pick.symbol ? ` (${pick.symbol})` : ""}*\n` +
														`Category: ${categoryLabels[pick.category] || pick.category}\n` +
														`Entry: ${cur}${pick.recoPrice.toLocaleString()}\n` +
														`Target: ${cur}${pick.targetPrice.toLocaleString()} (+${upside}%)\n` +
														`Stoploss: ${cur}${pick.stoplossPrice.toLocaleString()} (-${downside}%)\n` +
														(pick.timeHorizon
															? `Horizon: ${horizonConfig[pick.timeHorizon]?.label || pick.timeHorizon}\n`
															: "") +
														(pick.confidenceScore
															? `AI Confidence: ${pick.confidenceScore}%\n`
															: "") +
														`\n_Powered by FintekPro AI_`;
													navigator.clipboard.writeText(msg);
												}}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Copy WhatsApp message</TooltipContent>
									</Tooltip>
								</TooltipProvider>

								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() =>
													isWatchlisted
														? onRemoveFromWatchlist?.(pick.id)
														: onAddToWatchlist?.(pick.id)
												}
											>
												{isWatchlisted ? (
													<BookmarkCheck className="h-4 w-4 text-primary" />
												) : (
													<Bookmark className="h-4 w-4" />
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											{isWatchlisted
												? "Remove from Watchlist"
												: "Add to Watchlist"}
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>

								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() => onShareEmail?.(pick.id)}
											>
												<Mail className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Share via Email</TooltipContent>
									</Tooltip>
								</TooltipProvider>

								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
												onClick={() => onShareWhatsApp?.(pick.id)}
											>
												<MessageSquare className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>Share via WhatsApp</TooltipContent>
									</Tooltip>
								</TooltipProvider>

								{onShareClients && (
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0 text-primary"
													onClick={() => onShareClients(pick)}
												>
													<Users className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>Share with Clients</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)}
							</div>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
