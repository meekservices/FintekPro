import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useParams } from "wouter";
import {
	ArrowLeft,
	Plus,
	Search,
	Trash2,
	FileText,
	TrendingUp,
	Shield as LucideShield,
	Star,
	Sparkles,
	Briefcase,
	FilePlus2,
	PieChart as PieIcon,
	SlidersHorizontal,
	CheckCircle2,
	AlertTriangle,
	Copy,
	Check,
	Info,
	RefreshCw,
	Pencil,
} from "lucide-react";
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	AreaChart,
	Area,
} from "recharts";

interface ResearchListItem {
	id: string;
	researchListId: string;
	instrumentId: string;
	instrumentType: string;
	instrumentName: string | null;
	instrumentSymbol: string | null;
	instrumentIsin: string | null;
	addedSource: string;
	notes: string | null;
	rating: number | null;
	snapshotMetrics: any;
	addedAt: string;
}

interface ResearchList {
	id: string;
	name: string;
	description: string | null;
	universeType: string;
	visibility: string;
	isEditable: boolean;
	cachedMetrics: any;
	createdAt: string;
	updatedAt: string;
}

const SECTOR_COLORS = [
	"#3B82F6",
	"#10B981",
	"#F59E0B",
	"#8B5CF6",
	"#EC4899",
	"#06B6D4",
	"#F97316",
	"#6366F1",
	"#14B8A6",
	"#84CC16",
];

function formatNumber(val: any, decimals = 2): string {
	if (
		val === undefined ||
		val === null ||
		val === "" ||
		Number.isNaN(Number(val))
	)
		return "—";
	return Number(val).toFixed(decimals);
}

function getUniverseBadgeClass(universe: string): string {
	const u = universe?.toUpperCase() || "";
	if (u.includes("STOCK") || u.includes("EQUITY"))
		return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
	if (u.includes("MF") || u.includes("MUTUAL"))
		return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
	if (u.includes("ETF"))
		return "bg-purple-500/20 text-purple-400 border border-purple-500/30";
	if (u.includes("BOND"))
		return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
	return "bg-muted text-muted-foreground";
}

export default function AgentResearchListDetail() {
	const { id } = useParams<{ id: string }>();
	const { toast } = useToast();

	// Dialog states
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [isModelPortfolioDialogOpen, setIsModelPortfolioDialogOpen] =
		useState(false);
	const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
	const [isAiMemoDialogOpen, setIsAiMemoDialogOpen] = useState(false);
	const [isCopiedMemo, setIsCopiedMemo] = useState(false);
	const [editingNoteItem, setEditingNoteItem] = useState<{
		id: string;
		name: string;
		notes: string;
	} | null>(null);

	// Table & Search states
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("basics");
	const [instrumentSearch, setInstrumentSearch] = useState("");

	// Local target weights
	const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
	const [isWeightModified, setIsWeightModified] = useState(false);

	// AI Memo content
	const [aiMemo, setAiMemo] = useState<any>(null);

	// Forms
	const [portfolioForm, setPortfolioForm] = useState({
		name: "",
		riskProfile: "moderate",
		minInvestment: 10000,
		timeHorizon: "3-5 years",
		benchmarkName: "NIFTY 50",
	});

	const [proposalForm, setProposalForm] = useState({
		prospectName: "",
		prospectEmail: "",
		investmentAmount: 500000,
		proposalTitle: "",
	});

	// Fetch List & Items
	const { data, isLoading } = useQuery<{
		success: boolean;
		list: ResearchList;
		items: ResearchListItem[];
	}>({
		queryKey: ["/api/research-lists", id],
	});

	const list = data?.list;
	const items = data?.items || [];
	const universe = list?.universeType || "MF";
	const isStockUniverse =
		universe === "STOCK" || universe === "STOCKS" || universe === "EQUITY";

	// Fetch X-Ray Analytics
	const { data: analyticsData } = useQuery<{
		success: boolean;
		analytics: any;
	}>({
		queryKey: ["/api/research-lists", id, "analytics"],
		queryFn: async () => apiRequest(`/api/research-lists/${id}/analytics`),
		enabled: !!id,
	});

	// Catalog Search Query
	const { data: searchResults, isLoading: isSearching } = useQuery<{
		success: boolean;
		instruments: any[];
	}>({
		queryKey: [
			"/api/research-lists/instruments/search",
			universe,
			instrumentSearch.trim(),
		],
		queryFn: async () => {
			const params = new URLSearchParams({
				universe,
				query: instrumentSearch.trim(),
			});
			return apiRequest(
				`/api/research-lists/instruments/search?${params.toString()}`,
			);
		},
		enabled: isAddDialogOpen && !!list,
	});

	const openAddDialog = (initialQuery?: string) => {
		const q = initialQuery !== undefined ? initialQuery : searchQuery;
		if (q?.trim()) {
			setInstrumentSearch(q.trim());
		}
		setIsAddDialogOpen(true);
	};

	// Mutations
	const addItemMutation = useMutation({
		mutationFn: async (instrument: any) => {
			const instId = String(
				instrument.id || instrument.symbol || instrument.isin || "",
			);
			const instType =
				instrument.type || (isStockUniverse ? "stock" : "mutual_fund");
			return apiRequest(`/api/research-lists/${id}/items`, {
				method: "POST",
				body: JSON.stringify({
					instrumentId: instId,
					instrumentType: instType,
					instrumentName:
						instrument.name ||
						instrument.companyName ||
						instrument.schemeName ||
						"Unknown",
					instrumentSymbol: instrument.symbol || instrument.schemeCode || null,
					instrumentIsin: instrument.isin || null,
					addedSource: "manual",
					snapshotMetrics: {
						nav: instrument.nav ? Number(instrument.nav) : undefined,
						returns1y: instrument.returns1y
							? Number(instrument.returns1y)
							: undefined,
						returns3y: instrument.returns3y
							? Number(instrument.returns3y)
							: undefined,
						returns5y: instrument.returns5y
							? Number(instrument.returns5y)
							: undefined,
						expenseRatio: instrument.expenseRatio
							? Number(instrument.expenseRatio)
							: undefined,
						currentPrice: instrument.currentPrice
							? Number(instrument.currentPrice)
							: undefined,
						marketCap: instrument.marketCap,
						sector:
							instrument.sector ||
							instrument.industry ||
							instrument.category ||
							(isStockUniverse ? "Equity" : "Diversified"),
						industry: instrument.industry || instrument.category,
						dayChangePercent: instrument.dayChangePercent,
						dayChange: instrument.dayChange,
						weekHigh52: instrument.weekHigh52,
						weekLow52: instrument.weekLow52,
					},
				}),
			});
		},
		onSuccess: () => {
			toast({ title: "Added", description: "Instrument added to list" });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists", id, "analytics"],
			});
			setIsAddDialogOpen(false);
			setInstrumentSearch("");
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to add instrument",
				variant: "destructive",
			});
		},
	});

	const removeItemMutation = useMutation({
		mutationFn: async (itemId: string) => {
			return apiRequest(`/api/research-lists/${id}/items/${itemId}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			toast({ title: "Removed", description: "Instrument removed from list" });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists", id, "analytics"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to remove instrument",
				variant: "destructive",
			});
		},
	});

	// Single Item Update (Rating, Notes, Target Weight)
	const updateItemMutation = useMutation({
		mutationFn: async ({
			itemId,
			rating,
			notes,
			targetWeight,
		}: {
			itemId: string;
			rating?: number;
			notes?: string;
			targetWeight?: number;
		}) => {
			return apiRequest(`/api/research-lists/${id}/items/${itemId}`, {
				method: "PUT",
				body: JSON.stringify({ rating, notes, targetWeight }),
			});
		},
		onSuccess: () => {
			toast({ title: "Updated", description: "Instrument details saved" });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists", id, "analytics"],
			});
			setEditingNoteItem(null);
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to update item",
				variant: "destructive",
			});
		},
	});

	// Refresh Quotes
	const refreshQuotesMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/research-lists/${id}/refresh-quotes`, {
				method: "POST",
			});
		},
		onSuccess: () => {
			toast({
				title: "Quotes Refreshed",
				description: "Latest market prices and day changes updated",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists", id, "analytics"],
			});
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to refresh quotes",
				variant: "destructive",
			});
		},
	});

	// Batch Save Weights
	const saveWeightsMutation = useMutation({
		mutationFn: async (weights: Record<string, number>) => {
			return apiRequest(`/api/research-lists/${id}/weights`, {
				method: "PUT",
				body: JSON.stringify({ weights }),
			});
		},
		onSuccess: () => {
			toast({
				title: "Weights Saved",
				description: "Target weights updated successfully",
			});
			setIsWeightModified(false);
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({
				queryKey: ["/api/research-lists", id, "analytics"],
			});
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to save weights",
				variant: "destructive",
			});
		},
	});

	// Convert to Model Portfolio
	const convertToPortfolioMutation = useMutation({
		mutationFn: async (payload: any) => {
			return apiRequest(`/api/research-lists/${id}/convert-to-model-portfolio`, {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: (res: any) => {
			toast({
				title: "Model Portfolio Created",
				description: "Research list successfully converted to Model Portfolio",
			});
			setIsModelPortfolioDialogOpen(false);
			queryClient.invalidateQueries({ queryKey: ["/api/model-portfolios"] });
			if (res?.redirectUrl) {
				window.location.href = res.redirectUrl;
			}
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to create model portfolio",
				variant: "destructive",
			});
		},
	});

	// Create Proposal
	const createProposalMutation = useMutation({
		mutationFn: async (payload: any) => {
			return apiRequest(`/api/research-lists/${id}/create-proposal`, {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: (res: any) => {
			toast({
				title: "Proposal Created",
				description: "Client proposal successfully generated from research list",
			});
			setIsProposalDialogOpen(false);
			queryClient.invalidateQueries({ queryKey: ["/api/agent/proposals"] });
			if (res?.redirectUrl) {
				window.location.href = res.redirectUrl;
			}
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to create proposal",
				variant: "destructive",
			});
		},
	});

	// AI Research Memo Generation
	const generateMemoMutation = useMutation({
		mutationFn: async () => {
			return apiRequest(`/api/research-lists/${id}/generate-memo`, {
				method: "POST",
			});
		},
		onSuccess: (res: any) => {
			setAiMemo(res?.memo);
			setIsAiMemoDialogOpen(true);
			toast({
				title: "Memo Generated",
				description: "FASP-AI research memo synthesized successfully",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Error",
				description: err?.message || "Failed to generate AI research memo",
				variant: "destructive",
			});
		},
	});

	// Weight helpers
	const getItemWeight = (item: ResearchListItem): number => {
		if (localWeights[item.id] !== undefined) return localWeights[item.id];
		const sm = item.snapshotMetrics as Record<string, any> | undefined;
		if (sm?.targetWeight !== undefined && sm?.targetWeight !== null) {
			return Number(sm.targetWeight);
		}
		return items.length > 0 ? Number((100 / items.length).toFixed(1)) : 0;
	};

	const totalWeight = items.reduce(
		(sum, item) => sum + getItemWeight(item),
		0,
	);

	const handleWeightChange = (itemId: string, value: string) => {
		const num = Number.parseFloat(value) || 0;
		setLocalWeights((prev) => ({ ...prev, [itemId]: num }));
		setIsWeightModified(true);
	};

	const handleEqualizeWeights = () => {
		if (items.length === 0) return;
		const equal = Number((100 / items.length).toFixed(1));
		const newWeights: Record<string, number> = {};
		items.forEach((it, idx) => {
			if (idx === items.length - 1) {
				const sumOthers = equal * (items.length - 1);
				newWeights[it.id] = Number((100 - sumOthers).toFixed(1));
			} else {
				newWeights[it.id] = equal;
			}
		});
		setLocalWeights(newWeights);
		setIsWeightModified(true);
		saveWeightsMutation.mutate(newWeights);
	};

	const handleSaveWeights = () => {
		const weightsToSave: Record<string, number> = {};
		items.forEach((it) => {
			weightsToSave[it.id] = getItemWeight(it);
		});
		saveWeightsMutation.mutate(weightsToSave);
	};

	const filteredItems = items.filter(
		(item) =>
			(item.instrumentName || "")
				.toLowerCase()
				.includes(searchQuery.toLowerCase()) ||
			(item.instrumentSymbol || "")
				.toLowerCase()
				.includes(searchQuery.toLowerCase()) ||
			(item.instrumentIsin || "")
				.toLowerCase()
				.includes(searchQuery.toLowerCase()),
	);

	if (isLoading) {
		return (
			<div className="p-6 text-center text-muted-foreground">Loading...</div>
		);
	}

	if (!list) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				Research list not found
			</div>
		);
	}

	const analytics = analyticsData?.analytics;

	return (
		<div className="p-4 md:p-6 space-y-6">
			{/* Top Header */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div className="flex items-center gap-4">
					<Link href="/agent/research-lists">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div>
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-bold text-foreground">
								{list.name}
							</h1>
							<Badge
								variant="outline"
								className={`${getUniverseBadgeClass(list.universeType)} font-medium text-xs`}
							>
								{list.universeType}
							</Badge>
							<Badge
								variant="outline"
								className="border-border text-muted-foreground"
							>
								{list.visibility}
							</Badge>
						</div>
						{list.description && (
							<p className="text-muted-foreground mt-1">{list.description}</p>
						)}
					</div>
				</div>

				{/* 1-Click Action Buttons */}
				<div className="flex items-center gap-2 flex-wrap">
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5 border-border bg-card/60 hover:bg-muted text-xs h-9"
						disabled={refreshQuotesMutation.isPending || items.length === 0}
						onClick={() => refreshQuotesMutation.mutate()}
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${
								refreshQuotesMutation.isPending
									? "animate-spin text-primary"
									: "text-muted-foreground"
							}`}
						/>
						{refreshQuotesMutation.isPending ? "Refreshing..." : "Refresh Quotes"}
					</Button>

					<Button
						variant="outline"
						size="sm"
						className="gap-2 border-border bg-card/60 hover:bg-muted text-xs h-9"
						disabled={generateMemoMutation.isPending || items.length === 0}
						onClick={() => generateMemoMutation.mutate()}
					>
						<Sparkles className="h-3.5 w-3.5 text-purple-400" />
						{generateMemoMutation.isPending ? "Analyzing..." : "AI Research Memo"}
					</Button>

					<Button
						variant="outline"
						size="sm"
						className="gap-2 border-border bg-card/60 hover:bg-muted text-xs h-9"
						disabled={items.length === 0}
						onClick={() => {
							setPortfolioForm({
								name: `${list.name} (Model Portfolio)`,
								riskProfile:
									analytics?.compositeRiskTier?.toLowerCase() || "moderate",
								minInvestment: 10000,
								timeHorizon: "3-5 years",
								benchmarkName: isStockUniverse ? "NIFTY 50" : "NIFTY 50 TRI",
							});
							setIsModelPortfolioDialogOpen(true);
						}}
					>
						<Briefcase className="h-3.5 w-3.5 text-blue-400" />
						Convert to Portfolio
					</Button>

					<Button
						variant="outline"
						size="sm"
						className="gap-2 border-border bg-card/60 hover:bg-muted text-xs h-9"
						disabled={items.length === 0}
						onClick={() => {
							setProposalForm({
								prospectName: "",
								prospectEmail: "",
								investmentAmount: 500000,
								proposalTitle: `Investment Portfolio Strategy: ${list.name}`,
							});
							setIsProposalDialogOpen(true);
						}}
					>
						<FilePlus2 className="h-3.5 w-3.5 text-emerald-400" />
						Create Proposal
					</Button>
				</div>
			</div>

			{/* Adaptive KPI Cards (Tailored for Stocks vs Mutual Funds) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						<div className="text-2xl font-bold text-foreground">
							{items.length}
						</div>
						<p className="text-sm text-muted-foreground">
							{isStockUniverse ? "Total Stocks" : "Total Instruments"}
						</p>
					</CardContent>
				</Card>

				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						<div className="text-2xl font-bold text-green-400">
							{formatNumber(list.cachedMetrics?.avgReturn3y, 1)}%
						</div>
						<p className="text-sm text-muted-foreground">Avg 3Y Return</p>
					</CardContent>
				</Card>

				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						{isStockUniverse ? (
							<>
								<div
									className={`text-2xl font-bold ${
										Math.abs(totalWeight - 100) < 0.5
											? "text-emerald-400"
											: "text-amber-400"
									}`}
								>
									{totalWeight.toFixed(1)}%
								</div>
								<p className="text-sm text-muted-foreground">Target Allocated</p>
							</>
						) : (
							<>
								<div className="text-2xl font-bold text-amber-400">
									{formatNumber(list.cachedMetrics?.avgExpenseRatio, 2)}%
								</div>
								<p className="text-sm text-muted-foreground">Avg Expense Ratio</p>
							</>
						)}
					</CardContent>
				</Card>

				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						<div className="text-2xl font-bold text-blue-400">
							{formatNumber(list.cachedMetrics?.avgRating, 1)} / 5
						</div>
						<p className="text-sm text-muted-foreground">Avg Advisor Rating</p>
					</CardContent>
				</Card>
			</div>

			{/* Phase 1: Allocation Bar & Weights Controller */}
			{items.length > 0 && (
				<Card className="bg-card/40 border-border">
					<CardContent className="py-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
						<div className="flex items-center gap-3 w-full sm:w-auto">
							<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
							<span className="text-sm font-medium text-foreground">
								Target Allocation:
							</span>
							<Badge
								className={`text-xs px-2.5 py-0.5 ${
									Math.abs(totalWeight - 100) < 0.5
										? "bg-green-500/20 text-green-400 border border-green-500/40"
										: "bg-amber-500/20 text-amber-400 border border-amber-500/40"
								}`}
							>
								{Math.abs(totalWeight - 100) < 0.5 ? (
									<span className="flex items-center gap-1">
										<CheckCircle2 className="h-3 w-3" /> 100% Balanced
									</span>
								) : (
									<span className="flex items-center gap-1">
										<AlertTriangle className="h-3 w-3" />{" "}
										{totalWeight.toFixed(1)}% / 100%
									</span>
								)}
							</Badge>
						</div>

						<div className="flex items-center gap-2 w-full sm:w-auto justify-end">
							<Button
								size="sm"
								variant="outline"
								onClick={handleEqualizeWeights}
								disabled={saveWeightsMutation.isPending}
								className="text-xs h-8 gap-1 border-border"
							>
								Equal Weight ({(100 / items.length).toFixed(1)}% ea)
							</Button>
							{isWeightModified && (
								<Button
									size="sm"
									onClick={handleSaveWeights}
									disabled={saveWeightsMutation.isPending}
									className="text-xs h-8 gap-1 bg-primary text-primary-foreground"
								>
									Save Allocation
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Main Content Tabs */}
			<Card className="bg-card/50 border-border">
				<CardHeader className="pb-4">
					<div className="flex flex-col sm:flex-row justify-between gap-4">
						<Tabs value={activeTab} onValueChange={setActiveTab}>
							<TabsList className="bg-background">
								<TabsTrigger value="basics" className="gap-2">
									<FileText className="h-4 w-4" />
									Basics
								</TabsTrigger>
								<TabsTrigger value="performance" className="gap-2">
									<TrendingUp className="h-4 w-4" />
									Performance
								</TabsTrigger>
								<TabsTrigger value="risk" className="gap-2">
									<LucideShield className="h-4 w-4" />
									Risk & Ratings
								</TabsTrigger>
								<TabsTrigger value="xray" className="gap-2">
									<PieIcon className="h-4 w-4 text-purple-400" />
									Analytics & X-Ray
								</TabsTrigger>
							</TabsList>
						</Tabs>
						<div className="flex items-center gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Filter list (e.g. name, symbol)..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" &&
											filteredItems.length === 0 &&
											searchQuery.trim().length >= 2
										) {
											openAddDialog(searchQuery.trim());
										}
									}}
									className="pl-10 w-[280px] bg-background border-border"
								/>
							</div>
							{list.isEditable && (
								<Button
									onClick={() => openAddDialog()}
									className="gap-2 shrink-0"
								>
									<Plus className="h-4 w-4" />
									Add Instrument
								</Button>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{/* Analytics & X-Ray Tab View */}
					{activeTab === "xray" ? (
						<div className="space-y-6 py-2">
							{/* Concentration Alert Banner */}
							{analytics?.concentrationRisk?.isExceeded && (
								<div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
									<AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
									<div>
										<h4 className="text-sm font-semibold text-amber-300">
											SEBI Portfolio Concentration Warning
										</h4>
										<p className="text-xs text-amber-200/80 mt-0.5">
											{analytics.concentrationRisk.warning}
										</p>
									</div>
								</div>
							)}

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								{/* Sector Breakdown Donut Chart */}
								<Card className="bg-card/40 border-border">
									<CardHeader className="pb-2">
										<CardTitle className="text-base font-semibold">
											Sector Breakdown
										</CardTitle>
										<CardDescription className="text-xs">
											Asset allocation across economic sectors
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="h-[240px] w-full">
											{analytics?.sectorDistribution &&
											analytics.sectorDistribution.length > 0 ? (
												<ResponsiveContainer width="100%" height="100%">
													<PieChart>
														<Pie
															data={analytics.sectorDistribution}
															dataKey="weight"
															nameKey="sector"
															cx="50%"
															cy="50%"
															innerRadius={50}
															outerRadius={80}
															paddingAngle={3}
														>
															{analytics.sectorDistribution.map(
																(entry: any, index: number) => (
																	<Cell
																		key={`cell-${entry.sector || index}`}
																		fill={
																			SECTOR_COLORS[
																				index % SECTOR_COLORS.length
																			]
																		}
																	/>
																),
															)}
														</Pie>
														<Tooltip
															formatter={(value: any) => [`${value}%`, "Weight"]}
															contentStyle={{
																backgroundColor: "#1F2937",
																borderColor: "#374151",
																borderRadius: "8px",
																fontSize: "12px",
															}}
														/>
													</PieChart>
												</ResponsiveContainer>
											) : (
												<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
													No sector data available
												</div>
											)}
										</div>
										<div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
											{analytics?.sectorDistribution?.map(
												(s: any, idx: number) => (
													<div
														key={s.sector}
														className="flex items-center justify-between text-xs"
													>
														<div className="flex items-center gap-2 truncate">
															<span
																className="w-2.5 h-2.5 rounded-full shrink-0"
																style={{
																	backgroundColor:
																		SECTOR_COLORS[idx % SECTOR_COLORS.length],
																}}
															/>
															<span className="truncate text-muted-foreground">
																{s.sector}
															</span>
														</div>
														<span className="font-medium text-foreground">
															{s.weight}%
														</span>
													</div>
												),
											)}
										</div>
									</CardContent>
								</Card>

								{/* Market Cap Breakdown */}
								<Card className="bg-card/40 border-border">
									<CardHeader className="pb-2">
										<CardTitle className="text-base font-semibold">
											Market Cap Exposure
										</CardTitle>
										<CardDescription className="text-xs">
											Cap-tier capitalization distribution
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="h-[240px] w-full">
											{analytics?.marketCapDistribution ? (
												<ResponsiveContainer width="100%" height="100%">
													<BarChart
														data={analytics.marketCapDistribution}
														layout="vertical"
														margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
													>
														<XAxis type="number" domain={[0, 100]} unit="%" />
														<YAxis
															type="category"
															dataKey="name"
															tick={{ fontSize: 12 }}
														/>
														<Tooltip
															formatter={(val: any) => [`${val}%`, "Allocation"]}
															contentStyle={{
																backgroundColor: "#1F2937",
																borderColor: "#374151",
																borderRadius: "8px",
																fontSize: "12px",
															}}
														/>
														<Bar
															dataKey="weight"
															radius={[0, 4, 4, 0]}
															fill="#3B82F6"
														>
															{analytics.marketCapDistribution.map(
																(entry: any) => (
																	<Cell
																		key={`cell-${entry.name}`}
																		fill={entry.color}
																	/>
																),
															)}
														</Bar>
													</BarChart>
												</ResponsiveContainer>
											) : (
												<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
													Loading market cap data...
												</div>
											)}
										</div>
										<div className="mt-2 p-3 bg-background/50 rounded-lg flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												Composite Risk Tier:
											</span>
											<Badge
												variant="outline"
												className="font-semibold text-xs border-primary/40 text-primary"
											>
												{analytics?.compositeRiskTier || "Moderate"}
											</Badge>
										</div>
									</CardContent>
								</Card>

								{/* Benchmark Comparison Curve */}
								<Card className="bg-card/40 border-border">
									<CardHeader className="pb-2">
										<CardTitle className="text-base font-semibold">
											Performance vs Benchmark
										</CardTitle>
										<CardDescription className="text-xs">
											Cumulative historical return vs Nifty 50
										</CardDescription>
									</CardHeader>
									<CardContent>
										<div className="h-[240px] w-full">
											{analytics?.benchmarkComparison ? (
												<ResponsiveContainer width="100%" height="100%">
													<AreaChart
														data={analytics.benchmarkComparison}
														margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
													>
														<defs>
															<linearGradient
																id="basketGrad"
																x1="0"
																y1="0"
																x2="0"
																y2="1"
															>
																<stop
																	offset="5%"
																	stopColor="#10B981"
																	stopOpacity={0.4}
																/>
																<stop
																	offset="95%"
																	stopColor="#10B981"
																	stopOpacity={0}
																/>
															</linearGradient>
															<linearGradient
																id="benchGrad"
																x1="0"
																y1="0"
																x2="0"
																y2="1"
															>
																<stop
																	offset="5%"
																	stopColor="#3B82F6"
																	stopOpacity={0.2}
																/>
																<stop
																	offset="95%"
																	stopColor="#3B82F6"
																	stopOpacity={0}
																/>
															</linearGradient>
														</defs>
														<XAxis dataKey="period" tick={{ fontSize: 11 }} />
														<YAxis tick={{ fontSize: 11 }} unit="%" />
														<Tooltip
															formatter={(val: any) => [`${val}%`]}
															contentStyle={{
																backgroundColor: "#1F2937",
																borderColor: "#374151",
																borderRadius: "8px",
																fontSize: "12px",
															}}
														/>
														<Area
															type="monotone"
															dataKey="basket"
															name="Research Basket"
															stroke="#10B981"
															strokeWidth={2}
															fillOpacity={1}
															fill="url(#basketGrad)"
														/>
														<Area
															type="monotone"
															dataKey="benchmark"
															name="Nifty 50"
															stroke="#3B82F6"
															strokeWidth={2}
															fillOpacity={1}
															fill="url(#benchGrad)"
														/>
													</AreaChart>
												</ResponsiveContainer>
											) : (
												<div className="h-full flex items-center justify-center text-sm text-muted-foreground">
													Loading comparison data...
												</div>
											)}
										</div>
										<div className="mt-2 flex items-center justify-center gap-6 text-xs">
											<div className="flex items-center gap-2">
												<span className="w-3 h-0.5 bg-green-500" />
												<span className="text-muted-foreground">
													Research Basket
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="w-3 h-0.5 bg-blue-500" />
												<span className="text-muted-foreground">Nifty 50</span>
											</div>
										</div>
									</CardContent>
								</Card>
							</div>
						</div>
					) : filteredItems.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							{items.length === 0 ? (
								<>
									<p className="text-base font-medium text-foreground">
										No instruments in this list yet.
									</p>
									<p className="text-sm text-muted-foreground mt-1">
										Start building your research list by adding{" "}
										{isStockUniverse ? "stocks" : "mutual funds"}.
									</p>
									{list.isEditable && (
										<Button
											onClick={() => openAddDialog()}
											className="mt-4 gap-2"
										>
											<Plus className="h-4 w-4" />
											Add Your First Instrument
										</Button>
									)}
								</>
							) : (
								<>
									<p className="text-base font-medium text-foreground">
										No instruments in this list matching "{searchQuery}"
									</p>
									<p className="text-sm text-muted-foreground mt-1">
										Would you like to search the catalog to add it?
									</p>
									{list.isEditable && (
										<Button
											onClick={() => openAddDialog(searchQuery)}
											className="mt-4 gap-2"
										>
											<Plus className="h-4 w-4" />
											Search Catalog for "{searchQuery}" & Add
										</Button>
									)}
								</>
							)}
						</div>
					) : (
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="border-border">
										<TableHead className="text-muted-foreground">
											Instrument
										</TableHead>
										<TableHead className="text-muted-foreground">
											Symbol
										</TableHead>
										<TableHead className="text-muted-foreground text-center w-[110px]">
											Weight (%)
										</TableHead>
										{activeTab === "basics" && (
											<>
												<TableHead className="text-muted-foreground text-right">
													Price/NAV
												</TableHead>
												<TableHead className="text-muted-foreground">
													Sector / Category
												</TableHead>
											</>
										)}
										{activeTab === "performance" && (
											<>
												<TableHead className="text-muted-foreground text-right">
													Day Change
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													1Y Return
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													3Y Return
												</TableHead>
												<TableHead className="text-muted-foreground text-center">
													52W Range
												</TableHead>
											</>
										)}
										{activeTab === "risk" && (
											<>
												<TableHead className="text-muted-foreground">
													Risk Level
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													Expense Ratio
												</TableHead>
												<TableHead className="text-muted-foreground">
													Advisor Notes
												</TableHead>
											</>
										)}
										<TableHead className="text-muted-foreground text-center">
											Rating
										</TableHead>
										<TableHead className="text-muted-foreground text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredItems.map((item) => {
										const metrics = item.snapshotMetrics || {};
										const curWeight = getItemWeight(item);
										const dayChg =
											metrics.dayChangePercent !== undefined &&
											metrics.dayChangePercent !== null
												? Number(metrics.dayChangePercent)
												: metrics.dayChange
													? Number(metrics.dayChange)
													: null;
										const low52 = metrics.weekLow52
											? Number(metrics.weekLow52)
											: null;
										const high52 = metrics.weekHigh52
											? Number(metrics.weekHigh52)
											: null;
										const price = Number(metrics.currentPrice || metrics.nav);

										let rangePct = 50;
										if (
											low52 !== null &&
											high52 !== null &&
											high52 > low52 &&
											!Number.isNaN(price)
										) {
											rangePct = Math.max(
												0,
												Math.min(
													100,
													((price - low52) / (high52 - low52)) * 100,
												),
											);
										}

										return (
											<TableRow
												key={item.id}
												className="border-border hover:bg-muted/50"
											>
												<TableCell>
													<div className="font-medium text-foreground">
														{item.instrumentName || "Unknown"}
													</div>
													{item.instrumentIsin && (
														<div className="text-xs text-muted-foreground">
															{item.instrumentIsin}
														</div>
													)}
												</TableCell>
												<TableCell className="text-muted-foreground">
													{item.instrumentSymbol || "—"}
												</TableCell>
												{/* Phase 1: Target Weight Input */}
												<TableCell className="text-center">
													<Input
														type="number"
														min="0"
														max="100"
														step="0.5"
														value={curWeight}
														onChange={(e) =>
															handleWeightChange(item.id, e.target.value)
														}
														disabled={!list.isEditable}
														className="w-16 h-8 text-center text-xs font-semibold mx-auto bg-background/80 border-border"
													/>
												</TableCell>
												{activeTab === "basics" && (
													<>
														<TableCell className="text-right text-muted-foreground font-medium">
															₹
															{formatNumber(
																metrics.nav || metrics.currentPrice,
																2,
															)}
														</TableCell>
														<TableCell>
															<span className="text-xs text-muted-foreground">
																{metrics.sector || metrics.category || "—"}
															</span>
														</TableCell>
													</>
												)}
												{activeTab === "performance" && (
													<>
														<TableCell className="text-right">
															{dayChg !== null ? (
																<Badge
																	variant="outline"
																	className={`text-xs ${
																		dayChg >= 0
																			? "text-green-400 border-green-500/30 bg-green-500/10"
																			: "text-red-400 border-red-500/30 bg-red-500/10"
																	}`}
																>
																	{dayChg >= 0 ? "+" : ""}
																	{dayChg.toFixed(2)}%
																</Badge>
															) : (
																"—"
															)}
														</TableCell>
														<TableCell className="text-right text-green-400 font-medium">
															{formatNumber(metrics.returns1y, 1)}%
														</TableCell>
														<TableCell className="text-right text-green-400 font-medium">
															{formatNumber(metrics.returns3y, 1)}%
														</TableCell>
														<TableCell className="text-center">
															{low52 !== null && high52 !== null ? (
																<div className="w-24 mx-auto space-y-1">
																	<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
																		<div
																			className="h-full bg-primary rounded-full"
																			style={{ width: `${rangePct}%` }}
																		/>
																	</div>
																	<div className="flex justify-between text-[10px] text-muted-foreground">
																		<span>₹{low52.toFixed(0)}</span>
																		<span>₹{high52.toFixed(0)}</span>
																	</div>
																</div>
															) : (
																"—"
															)}
														</TableCell>
													</>
												)}
												{activeTab === "risk" && (
													<>
														<TableCell>
															<Badge
																className={
																	metrics.riskLevel === "Low"
																		? "bg-green-500 text-white"
																		: metrics.riskLevel === "High"
																			? "bg-red-500 text-white"
																			: "bg-amber-500 text-white"
																}
															>
																{metrics.riskLevel || "Moderate"}
															</Badge>
														</TableCell>
														<TableCell className="text-right text-muted-foreground font-medium">
															{formatNumber(metrics.expenseRatio, 2)}%
														</TableCell>
														<TableCell className="text-xs text-muted-foreground max-w-[180px]">
															<button
																type="button"
																onClick={() =>
																	setEditingNoteItem({
																		id: item.id,
																		name:
																			item.instrumentName ||
																			item.instrumentSymbol ||
																			"Instrument",
																		notes: item.notes || "",
																	})
																}
																className="flex items-center gap-1.5 hover:text-foreground text-left group w-full"
															>
																<span className="truncate">
																	{item.notes || (
																		<span className="italic text-muted-foreground/50">
																			Add notes...
																		</span>
																	)}
																</span>
																<Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary shrink-0" />
															</button>
														</TableCell>
													</>
												)}
												{/* Interactive In-Line Star Rating */}
												<TableCell className="text-center">
													<div
														className="flex items-center justify-center gap-0.5 cursor-pointer"
														title="Click star to update rating"
													>
														{[1, 2, 3, 4, 5].map((star) => (
															<button
																type="button"
																key={star}
																disabled={
																	!list.isEditable ||
																	updateItemMutation.isPending
																}
																onClick={() =>
																	updateItemMutation.mutate({
																		itemId: item.id,
																		rating: star,
																	})
																}
																className="p-0.5 hover:scale-125 transition-transform"
															>
																<Star
																	className={`h-3.5 w-3.5 ${
																		star <= (item.rating || 0)
																			? "text-amber-400 fill-amber-400"
																			: "text-muted-foreground/30 hover:text-amber-300"
																	}`}
																/>
															</button>
														))}
													</div>
												</TableCell>
												<TableCell className="text-right">
													{list.isEditable && (
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 text-red-400 hover:text-red-300"
															onClick={() => {
																if (confirm("Remove this instrument?")) {
																	removeItemMutation.mutate(item.id);
																}
															}}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Modal: Edit Notes Dialog */}
			<Dialog
				open={!!editingNoteItem}
				onOpenChange={(open) => !open && setEditingNoteItem(null)}
			>
				<DialogContent className="sm:max-w-[450px]">
					<DialogHeader>
						<DialogTitle>Advisor Rationale</DialogTitle>
						<DialogDescription>
							Investment thesis & notes for {editingNoteItem?.name}
						</DialogDescription>
					</DialogHeader>
					<div className="py-3">
						<Textarea
							rows={4}
							placeholder="e.g. Robust balance sheet, strong ROCE expansion, attractive entry valuation..."
							value={editingNoteItem?.notes || ""}
							onChange={(e) =>
								setEditingNoteItem((prev) =>
									prev ? { ...prev, notes: e.target.value } : null,
								)
							}
							className="text-sm"
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingNoteItem(null)}>
							Cancel
						</Button>
						<Button
							disabled={updateItemMutation.isPending}
							onClick={() => {
								if (editingNoteItem) {
									updateItemMutation.mutate({
										itemId: editingNoteItem.id,
										notes: editingNoteItem.notes,
									});
								}
							}}
						>
							{updateItemMutation.isPending ? "Saving..." : "Save Note"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal: Add Instrument Dialog */}
			<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
				<DialogContent className="sm:max-w-[650px]">
					<DialogHeader>
						<DialogTitle>Add Instrument to {list.name}</DialogTitle>
						<DialogDescription>
							Search and add{" "}
							{isStockUniverse ? "stocks" : "mutual funds"} to your
							research list.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder={`Search ${
									isStockUniverse
										? "stocks by name or symbol (e.g. PERSISTENT, RELIANCE)"
										: "mutual funds by name or AMC"
								}...`}
								value={instrumentSearch}
								onChange={(e) => setInstrumentSearch(e.target.value)}
								autoFocus
								className="pl-10"
							/>
						</div>

						{isSearching && (
							<div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
								<div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
								Searching{" "}
								{isStockUniverse ? "stocks" : "mutual funds"}...
							</div>
						)}

						{!isSearching &&
							searchResults?.instruments &&
							searchResults.instruments.length > 0 && (
								<div className="max-h-[350px] overflow-y-auto border border-border rounded-lg divide-y divide-border">
									{searchResults.instruments.map((inst) => {
										const isAlreadyAdded = items.some(
											(item) =>
												(item.instrumentId &&
													item.instrumentId === String(inst.id)) ||
												(item.instrumentSymbol &&
													inst.symbol &&
													item.instrumentSymbol.toUpperCase() ===
														inst.symbol.toUpperCase()) ||
												(item.instrumentIsin &&
													inst.isin &&
													item.instrumentIsin === inst.isin),
										);
										return (
											<div
												key={inst.id || inst.symbol || inst.isin}
												className="p-3 hover:bg-muted/50 flex items-center justify-between gap-3"
											>
												<div className="min-w-0 flex-1">
													<div className="font-medium text-foreground truncate flex items-center gap-2">
														<span>
															{inst.name ||
																inst.companyName ||
																inst.schemeName}
														</span>
														{inst.symbol && (
															<Badge
																variant="outline"
																className="text-xs shrink-0"
															>
																{inst.symbol}
															</Badge>
														)}
													</div>
													<div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
														{inst.sector && <span>{inst.sector}</span>}
														{inst.category && <span>{inst.category}</span>}
														{inst.marketCap && <span>• {inst.marketCap}</span>}
														{inst.isin && <span>• {inst.isin}</span>}
													</div>
												</div>
												<div className="flex items-center gap-3 shrink-0">
													{(inst.currentPrice || inst.nav) && (
														<div className="text-right">
															<div className="text-sm font-semibold text-foreground">
																₹
																{Number(
																	inst.currentPrice || inst.nav,
																).toLocaleString("en-IN", {
																	maximumFractionDigits: 2,
																})}
															</div>
															{inst.dayChangePercent !== undefined &&
																inst.dayChangePercent !== null && (
																	<div
																		className={`text-xs ${
																			Number(inst.dayChangePercent) >= 0
																				? "text-green-500"
																				: "text-red-500"
																		}`}
																	>
																		{Number(inst.dayChangePercent) >= 0
																			? "+"
																			: ""}
																		{Number(inst.dayChangePercent).toFixed(2)}%
																	</div>
																)}
														</div>
													)}
													{isAlreadyAdded ? (
														<Badge variant="secondary" className="text-xs">
															Added
														</Badge>
													) : (
														<Button
															size="sm"
															disabled={addItemMutation.isPending}
															onClick={() => addItemMutation.mutate(inst)}
															className="gap-1"
														>
															<Plus className="h-4 w-4" />
															Add
														</Button>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}

						{!isSearching &&
							instrumentSearch.trim().length >= 2 &&
							searchResults?.instruments?.length === 0 && (
								<div className="text-center py-6 text-muted-foreground">
									No {isStockUniverse ? "stocks" : "mutual funds"}{" "}
									found matching "{instrumentSearch}"
								</div>
							)}

						{!isSearching &&
							instrumentSearch.trim().length < 2 &&
							(!searchResults?.instruments ||
								searchResults.instruments.length === 0) && (
								<div className="text-center py-6 text-xs text-muted-foreground">
									Type at least 2 characters to search catalog
								</div>
							)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
							Close
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal: Convert to Model Portfolio Dialog */}
			<Dialog
				open={isModelPortfolioDialogOpen}
				onOpenChange={setIsModelPortfolioDialogOpen}
			>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Convert to Model Portfolio</DialogTitle>
						<DialogDescription>
							Publish this research basket as a live strategy with target
							weights.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="mp-name">Portfolio Name</Label>
							<Input
								id="mp-name"
								value={portfolioForm.name}
								onChange={(e) =>
									setPortfolioForm((p) => ({ ...p, name: e.target.value }))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="mp-risk">Risk Profile</Label>
								<Select
									value={portfolioForm.riskProfile}
									onValueChange={(val) =>
										setPortfolioForm((p) => ({ ...p, riskProfile: val }))
									}
								>
									<SelectTrigger id="mp-risk">
										<SelectValue placeholder="Select risk profile" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="conservative">Conservative</SelectItem>
										<SelectItem value="moderate">Moderate</SelectItem>
										<SelectItem value="aggressive">Aggressive</SelectItem>
										<SelectItem value="all_weather">All Weather</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mp-horizon">Time Horizon</Label>
								<Input
									id="mp-horizon"
									value={portfolioForm.timeHorizon}
									onChange={(e) =>
										setPortfolioForm((p) => ({
											...p,
											timeHorizon: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="mp-min">Min Investment (₹)</Label>
								<Input
									id="mp-min"
									type="number"
									value={portfolioForm.minInvestment}
									onChange={(e) =>
										setPortfolioForm((p) => ({
											...p,
											minInvestment: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="mp-benchmark">Benchmark</Label>
								<Input
									id="mp-benchmark"
									value={portfolioForm.benchmarkName}
									onChange={(e) =>
										setPortfolioForm((p) => ({
											...p,
											benchmarkName: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-1">
							<div className="flex justify-between">
								<span>Constituents to transfer:</span>
								<span className="font-semibold text-foreground">
									{items.length} instruments
								</span>
							</div>
							<div className="flex justify-between">
								<span>Target weights sum:</span>
								<span className="font-semibold text-foreground">
									{totalWeight.toFixed(1)}%
								</span>
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsModelPortfolioDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={convertToPortfolioMutation.isPending}
							onClick={() =>
								convertToPortfolioMutation.mutate({
									name: portfolioForm.name,
									riskProfile: portfolioForm.riskProfile,
									minInvestment: portfolioForm.minInvestment,
									timeHorizon: portfolioForm.timeHorizon,
									benchmarkName: portfolioForm.benchmarkName,
								})
							}
						>
							{convertToPortfolioMutation.isPending
								? "Creating..."
								: "Publish Strategy"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal: Create Client Proposal Dialog */}
			<Dialog
				open={isProposalDialogOpen}
				onOpenChange={setIsProposalDialogOpen}
			>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle>Generate Client Proposal</DialogTitle>
						<DialogDescription>
							Draft a client proposal from this research list with allocations.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="prop-title">Proposal Title</Label>
							<Input
								id="prop-title"
								value={proposalForm.proposalTitle}
								onChange={(e) =>
									setProposalForm((p) => ({
										...p,
										proposalTitle: e.target.value,
									}))
								}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-2">
								<Label htmlFor="prop-client">Client / Prospect Name</Label>
								<Input
									id="prop-client"
									placeholder="e.g. Ramesh Verma"
									value={proposalForm.prospectName}
									onChange={(e) =>
										setProposalForm((p) => ({
											...p,
											prospectName: e.target.value,
										}))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="prop-email">Client Email (optional)</Label>
								<Input
									id="prop-email"
									type="email"
									placeholder="client@example.com"
									value={proposalForm.prospectEmail}
									onChange={(e) =>
										setProposalForm((p) => ({
											...p,
											prospectEmail: e.target.value,
										}))
									}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="prop-amt">Proposed Lumpsum Capital (₹)</Label>
							<Input
								id="prop-amt"
								type="number"
								step="50000"
								value={proposalForm.investmentAmount}
								onChange={(e) =>
									setProposalForm((p) => ({
										...p,
										investmentAmount: Number(e.target.value),
									}))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsProposalDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={createProposalMutation.isPending}
							onClick={() =>
								createProposalMutation.mutate({
									proposalTitle: proposalForm.proposalTitle,
									prospectName: proposalForm.prospectName || "Valued Client",
									prospectEmail: proposalForm.prospectEmail,
									investmentAmount: proposalForm.investmentAmount,
								})
							}
						>
							{createProposalMutation.isPending
								? "Creating..."
								: "Generate Proposal"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modal: AI Research Memo Dialog */}
			<Dialog open={isAiMemoDialogOpen} onOpenChange={setIsAiMemoDialogOpen}>
				<DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
					<DialogHeader>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Sparkles className="h-5 w-5 text-purple-400" />
								<DialogTitle>
									{aiMemo?.title || "Institutional Research Memo"}
								</DialogTitle>
							</div>
							<Badge
								variant="outline"
								className="text-xs border-purple-500/40 text-purple-400"
							>
								FASP-AI v1.0
							</Badge>
						</div>
						<DialogDescription className="text-xs">
							SEBI-compliant decision support analysis & portfolio thesis
						</DialogDescription>
					</DialogHeader>

					{aiMemo && (
						<div className="space-y-4 py-3 text-sm">
							{/* Badges Bar */}
							<div className="flex items-center gap-2 flex-wrap">
								<Badge className="bg-primary/20 text-primary border border-primary/30">
									Suitability: {aiMemo.riskTier}
								</Badge>
								<Badge variant="outline">
									Horizon: {aiMemo.recommendedHorizon}
								</Badge>
								<Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
									Confidence: {aiMemo.confidenceScore}%
								</Badge>
							</div>

							{/* Investment Thesis */}
							<div className="p-3.5 bg-muted/40 rounded-lg border border-border">
								<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
									<Info className="h-3.5 w-3.5 text-blue-400" /> Investment
									Thesis
								</h4>
								<p className="text-muted-foreground text-xs leading-relaxed">
									{aiMemo.investmentThesis}
								</p>
							</div>

							{/* Tailwinds & Catalysts */}
							{aiMemo.catalysts && aiMemo.catalysts.length > 0 && (
								<div className="space-y-1.5">
									<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-green-400">
										Key Catalysts & Tailwinds
									</h4>
									<ul className="space-y-1 text-xs text-muted-foreground">
										{aiMemo.catalysts.map((cat: string, i: number) => (
											<li
												key={`cat-${cat.slice(0, 10)}-${i}`}
												className="flex items-start gap-2"
											>
												<span className="text-green-400 mt-0.5">•</span>
												<span>{cat}</span>
											</li>
										))}
									</ul>
								</div>
							)}

							{/* Risks & Headwinds */}
							{aiMemo.risksAndHeadwinds &&
								aiMemo.risksAndHeadwinds.length > 0 && (
									<div className="space-y-1.5">
										<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-amber-400">
											Risk Factors & Headwinds
										</h4>
										<ul className="space-y-1 text-xs text-muted-foreground">
											{aiMemo.risksAndHeadwinds.map(
												(risk: string, i: number) => (
													<li
														key={`risk-${risk.slice(0, 10)}-${i}`}
														className="flex items-start gap-2"
													>
														<span className="text-amber-400 mt-0.5">•</span>
														<span>{risk}</span>
													</li>
												),
											)}
										</ul>
									</div>
								)}

							{/* Mandatory SEBI Disclaimer */}
							<div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300/80 leading-normal">
								{aiMemo.disclaimer}
							</div>
						</div>
					)}

					<DialogFooter className="flex sm:justify-between items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 text-xs"
							onClick={() => {
								if (!aiMemo) return;
								const text = `# ${aiMemo.title}\n\n**Suitability:** ${aiMemo.riskTier} | **Horizon:** ${aiMemo.recommendedHorizon}\n\n## Investment Thesis\n${aiMemo.investmentThesis}\n\n## Key Catalysts\n${aiMemo.catalysts?.map((c: string) => `- ${c}`).join("\n")}\n\n## Risks & Headwinds\n${aiMemo.risksAndHeadwinds?.map((r: string) => `- ${r}`).join("\n")}\n\n---\n*${aiMemo.disclaimer}*`;
								navigator.clipboard.writeText(text);
								setIsCopiedMemo(true);
								setTimeout(() => setIsCopiedMemo(false), 2500);
								toast({
									title: "Copied",
									description: "Markdown copied to clipboard",
								});
							}}
						>
							{isCopiedMemo ? (
								<Check className="h-3.5 w-3.5 text-green-400" />
							) : (
								<Copy className="h-3.5 w-3.5" />
							)}
							{isCopiedMemo ? "Copied" : "Copy Markdown"}
						</Button>

						<Button
							variant="default"
							size="sm"
							onClick={() => setIsAiMemoDialogOpen(false)}
						>
							Done
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
