import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Globe,
	Search,
	Loader2,
	ArrowLeft,
	Plus,
	Upload,
	Trash2,
	Edit,
	TrendingUp,
	Building2,
	RefreshCw,
	Database,
	BarChart3,
	Check,
	X,
	Plug,
} from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { AdminLayout } from "@/components/layout/admin-layout";

interface GlobalInstrument {
	id: string;
	symbol: string;
	name: string;
	assetClass: string;
	exchange: string;
	market: string;
	currency: string;
	isin?: string;
	sector?: string;
	industry?: string;
	marketCapCategory?: string;
	lastPrice?: string;
	priceChangePercent?: string;
	isActive: boolean;
	createdAt: string;
}

interface Stats {
	total: number;
	active: number;
	byAssetClass: Record<string, number>;
	byMarket: Record<string, number>;
}

const assetClasses = [
	{ value: "stock", label: "Stocks" },
	{ value: "etf", label: "ETFs" },
	{ value: "mutual_fund", label: "Mutual Funds" },
	{ value: "bond", label: "Bonds" },
];

const markets = [
	{ value: "US", label: "United States" },
	{ value: "UK", label: "United Kingdom" },
	{ value: "EU", label: "UK & Europe" },
	{ value: "JP", label: "Japan" },
	{ value: "HK", label: "Hong Kong" },
	{ value: "CN", label: "China & Hong Kong" },
	{ value: "SG", label: "Singapore" },
	{ value: "IN", label: "India" },
];

const exchanges = [
	{ value: "NYSE", label: "NYSE", market: "US" },
	{ value: "NASDAQ", label: "NASDAQ", market: "US" },
	{ value: "LSE", label: "London Stock Exchange", market: "UK" },
	{ value: "XETRA", label: "XETRA", market: "EU" },
	{ value: "AMS", label: "Euronext Amsterdam", market: "EU" },
	{ value: "TSE", label: "Tokyo Stock Exchange", market: "JP" },
	{ value: "HKEX", label: "Hong Kong Exchange", market: "HK" },
	{ value: "SSE", label: "Shanghai Stock Exchange", market: "CN" },
	{ value: "SZSE", label: "Shenzhen Stock Exchange", market: "CN" },
	{ value: "SGX", label: "Singapore Exchange", market: "SG" },
	{ value: "NSE", label: "NSE India", market: "IN" },
	{ value: "BSE", label: "BSE India", market: "IN" },
];

const currencies = ["USD", "EUR", "GBP", "JPY", "HKD", "CNY", "SGD", "INR"];

const sectors = [
	"Technology",
	"Healthcare",
	"Financials",
	"Consumer Discretionary",
	"Consumer Staples",
	"Industrials",
	"Energy",
	"Materials",
	"Real Estate",
	"Utilities",
	"Communication Services",
	"Index",
];

const marketCapCategories = [
	{ value: "mega", label: "Mega Cap (>$200B)" },
	{ value: "large", label: "Large Cap ($10B-$200B)" },
	{ value: "mid", label: "Mid Cap ($2B-$10B)" },
	{ value: "small", label: "Small Cap ($300M-$2B)" },
	{ value: "micro", label: "Micro Cap (<$300M)" },
];

const tradingApiProviders: Record<
	string,
	{ name: string; description: string; markets: string[] }
> = {
	alpaca: {
		name: "Alpaca",
		description: "Commission-free US stock trading API",
		markets: ["US"],
	},
	alpha_vantage: {
		name: "Alpha Vantage",
		description: "Real-time and historical market data (replaces IEX Cloud)",
		markets: ["US"],
	},
	polygon: {
		name: "Massive (Polygon)",
		description:
			"Real-time and historical stock data via REST, WebSocket & Flat Files",
		markets: ["US"],
	},
	ibkr: {
		name: "Interactive Brokers",
		description: "Global multi-asset trading platform",
		markets: ["US", "UK", "EU", "JP", "HK", "CN", "SG"],
	},
	saxo: {
		name: "Saxo Bank",
		description: "European multi-asset trading",
		markets: ["UK", "EU"],
	},
	futu: {
		name: "Futu/Moomoo",
		description: "Hong Kong and China stock trading",
		markets: ["HK", "CN"],
	},
	tiger: {
		name: "Tiger Brokers",
		description: "Asia-Pacific trading platform",
		markets: ["HK", "CN", "SG"],
	},
};

export default function GlobalSeedAdmin() {
	const { toast } = useToast();
	const searchParams = useSearch();
	const [activeTab, setActiveTab] = useState("stock");
	const [marketFilter, setMarketFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [addDialogOpen, setAddDialogOpen] = useState(false);

	useEffect(() => {
		const params = new URLSearchParams(searchParams);
		const marketParam = params.get("market");
		const assetClassParam = params.get("assetClass");

		if (marketParam && markets.some((m) => m.value === marketParam)) {
			setMarketFilter(marketParam);
		}
		if (
			assetClassParam &&
			assetClasses.some((a) => a.value === assetClassParam)
		) {
			setActiveTab(assetClassParam);
		}
	}, [searchParams]);
	const [editingInstrument, setEditingInstrument] =
		useState<GlobalInstrument | null>(null);
	const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
	const [bulkData, setBulkData] = useState("");

	const [formData, setFormData] = useState({
		symbol: "",
		name: "",
		assetClass: "stock",
		exchange: "NYSE",
		market: "US",
		currency: "USD",
		isin: "",
		sector: "",
		industry: "",
		marketCapCategory: "",
	});

	const { data: statsData } = useQuery<{ success: boolean; stats: Stats }>({
		queryKey: ["/api/admin/global-instruments/stats"],
	});

	const { data: instrumentsData, isLoading } = useQuery<{
		success: boolean;
		data: GlobalInstrument[];
		pagination: { total: number; page: number; totalPages: number };
	}>({
		queryKey: [
			"/api/admin/global-instruments",
			activeTab,
			marketFilter,
			search,
		],
		queryFn: async () => {
			const params = new URLSearchParams();
			params.set("assetClass", activeTab);
			if (marketFilter !== "all") params.set("market", marketFilter);
			if (search) params.set("search", search);
			params.set("limit", "100");
			const response = await fetch(`/api/admin/global-instruments?${params}`, {
				credentials: "include",
			});
			return response.json();
		},
	});

	const stats = statsData?.stats;
	const instruments = instrumentsData?.data || [];

	const createMutation = useMutation({
		mutationFn: async (data: typeof formData) => {
			return apiRequest("/api/admin/global-instruments", {
				method: "POST",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({ title: "Instrument created successfully" });
			setAddDialogOpen(false);
			resetForm();
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const updateMutation = useMutation({
		mutationFn: async ({
			id,
			data,
		}: { id: string; data: Partial<typeof formData> }) => {
			return apiRequest(`/api/admin/global-instruments/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			toast({ title: "Instrument updated successfully" });
			setEditingInstrument(null);
			resetForm();
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => {
			return apiRequest(`/api/admin/global-instruments/${id}`, {
				method: "DELETE",
			});
		},
		onSuccess: () => {
			toast({ title: "Instrument deleted" });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const toggleMutation = useMutation({
		mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
			return apiRequest(`/api/admin/global-instruments/toggle/${id}`, {
				method: "POST",
				body: JSON.stringify({ isActive }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
	});

	const seedSampleMutation = useMutation({
		mutationFn: async () => {
			return apiRequest("/api/admin/global-instruments/seed-sample", {
				method: "POST",
			});
		},
		onSuccess: (data: any) => {
			toast({ title: "Sample Data Seeded", description: data.message });
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const bulkImportMutation = useMutation({
		mutationFn: async (instruments: any[]) => {
			return apiRequest("/api/admin/global-instruments/bulk-import", {
				method: "POST",
				body: JSON.stringify({ instruments }),
				headers: { "Content-Type": "application/json" },
			});
		},
		onSuccess: (data: any) => {
			toast({
				title: "Bulk Import Complete",
				description: `Imported: ${data.result.imported}, Skipped: ${data.result.skipped}`,
			});
			setBulkDialogOpen(false);
			setBulkData("");
			queryClient.invalidateQueries({
				queryKey: ["/api/admin/global-instruments"],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const resetForm = () => {
		setFormData({
			symbol: "",
			name: "",
			assetClass: activeTab,
			exchange: "NYSE",
			market: "US",
			currency: "USD",
			isin: "",
			sector: "",
			industry: "",
			marketCapCategory: "",
		});
	};

	const handleEdit = (instrument: GlobalInstrument) => {
		setEditingInstrument(instrument);
		setFormData({
			symbol: instrument.symbol,
			name: instrument.name,
			assetClass: instrument.assetClass,
			exchange: instrument.exchange,
			market: instrument.market,
			currency: instrument.currency,
			isin: instrument.isin || "",
			sector: instrument.sector || "",
			industry: instrument.industry || "",
			marketCapCategory: instrument.marketCapCategory || "",
		});
	};

	const handleSubmit = () => {
		if (editingInstrument) {
			updateMutation.mutate({ id: editingInstrument.id, data: formData });
		} else {
			createMutation.mutate(formData);
		}
	};

	const handleBulkImport = () => {
		try {
			const lines = bulkData
				.trim()
				.split("\n")
				.filter((l) => l.trim());
			const instruments = lines.map((line) => {
				const [
					symbol,
					name,
					assetClass,
					exchange,
					market,
					currency,
					isin,
					sector,
				] = line.split(",").map((s) => s.trim());
				return {
					symbol,
					name,
					assetClass,
					exchange,
					market,
					currency,
					isin,
					sector,
				};
			});
			bulkImportMutation.mutate(instruments);
		} catch (error) {
			toast({
				title: "Invalid Format",
				description: "Please use CSV format",
				variant: "destructive",
			});
		}
	};

	return (
		<AdminLayout>
			<div className="p-6">
				<div className="max-w-7xl mx-auto space-y-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<Link href="/admin/store-management">
								<Button variant="ghost" size="icon">
									<ArrowLeft className="h-5 w-5" />
								</Button>
							</Link>
							<div>
								<h1 className="text-2xl font-bold flex items-center gap-2">
									<Globe className="h-6 w-6 text-blue-500" />
									Global Instruments Seeding
								</h1>
								<p className="text-muted-foreground">
									Manage global stocks, ETFs, mutual funds, and bonds
								</p>
							</div>
						</div>
						<div className="flex gap-2">
							<Button
								variant="outline"
								onClick={() => seedSampleMutation.mutate()}
								disabled={seedSampleMutation.isPending}
							>
								{seedSampleMutation.isPending ? (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								) : (
									<Database className="h-4 w-4 mr-2" />
								)}
								Seed Sample Data
							</Button>
							<Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
								<Upload className="h-4 w-4 mr-2" />
								Bulk Import
							</Button>
							<Button
								onClick={() => {
									resetForm();
									setAddDialogOpen(true);
								}}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Instrument
							</Button>
						</div>
					</div>

					{stats && (
						<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
							<Card>
								<CardContent className="pt-4">
									<div className="text-2xl font-bold">{stats.total}</div>
									<div className="text-sm text-muted-foreground">
										Total Instruments
									</div>
								</CardContent>
							</Card>
							<Card>
								<CardContent className="pt-4">
									<div className="text-2xl font-bold text-green-500">
										{stats.active}
									</div>
									<div className="text-sm text-muted-foreground">Active</div>
								</CardContent>
							</Card>
							{Object.entries(stats.byAssetClass)
								.slice(0, 4)
								.map(([cls, count]) => (
									<Card key={cls}>
										<CardContent className="pt-4">
											<div className="text-2xl font-bold">{count}</div>
											<div className="text-sm text-muted-foreground capitalize">
												{cls.replace("_", " ")}s
											</div>
										</CardContent>
									</Card>
								))}
						</div>
					)}

					{/* Trading API Configuration - Shows when a market is selected */}
					{marketFilter !== "all" && (
						<Card className="border-blue-500/30 bg-blue-500/5">
							<CardHeader className="pb-3">
								<CardTitle className="text-base flex items-center gap-2">
									<Plug className="h-4 w-4 text-blue-500" />
									Trading API Configuration -{" "}
									{markets.find((m) => m.value === marketFilter)?.label}
								</CardTitle>
								<CardDescription>
									Available trading APIs for this market. Configure API
									credentials in Settings to enable live trading.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
									{Object.entries(tradingApiProviders)
										.filter(([_, provider]) =>
											provider.markets.includes(marketFilter),
										)
										.map(([key, provider]) => (
											<div
												key={key}
												className="flex items-center gap-3 p-3 rounded-lg border bg-card"
											>
												<div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
													<TrendingUp className="h-5 w-5 text-blue-500" />
												</div>
												<div className="flex-1">
													<p className="font-medium text-sm">{provider.name}</p>
													<p className="text-xs text-muted-foreground">
														{provider.description}
													</p>
												</div>
												<Badge variant="outline" className="text-xs">
													Not Configured
												</Badge>
											</div>
										))}
									{Object.entries(tradingApiProviders).filter(([_, provider]) =>
										provider.markets.includes(marketFilter),
									).length === 0 && (
										<p className="text-muted-foreground col-span-full">
											No trading APIs available for this market yet.
										</p>
									)}
								</div>
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle>Instruments</CardTitle>
								<div className="flex gap-2">
									<Select value={marketFilter} onValueChange={setMarketFilter}>
										<SelectTrigger className="w-40">
											<SelectValue placeholder="Market" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All Markets</SelectItem>
											{markets.map((m) => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<div className="relative">
										<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
										<Input
											placeholder="Search symbol or name..."
											value={search}
											onChange={(e) => setSearch(e.target.value)}
											className="pl-9 w-64"
										/>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<Tabs value={activeTab} onValueChange={setActiveTab}>
								<TabsList>
									{assetClasses.map((ac) => (
										<TabsTrigger key={ac.value} value={ac.value}>
											{ac.label}
											{stats?.byAssetClass[ac.value] && (
												<Badge variant="secondary" className="ml-2">
													{stats.byAssetClass[ac.value]}
												</Badge>
											)}
										</TabsTrigger>
									))}
								</TabsList>

								{assetClasses.map((ac) => (
									<TabsContent key={ac.value} value={ac.value}>
										{isLoading ? (
											<div className="flex justify-center p-8">
												<Loader2 className="h-8 w-8 animate-spin" />
											</div>
										) : instruments.length === 0 ? (
											<div className="text-center p-8 text-muted-foreground">
												No {ac.label.toLowerCase()} found. Click "Seed Sample
												Data" or "Add Instrument" to get started.
											</div>
										) : (
											<ScrollArea className="h-[500px]">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Symbol</TableHead>
															<TableHead>Name</TableHead>
															<TableHead>Exchange</TableHead>
															<TableHead>Market</TableHead>
															<TableHead>Sector</TableHead>
															<TableHead>ISIN</TableHead>
															<TableHead>Status</TableHead>
															<TableHead>Actions</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{instruments.map((inst) => (
															<TableRow key={inst.id}>
																<TableCell className="font-mono font-bold">
																	{inst.symbol}
																</TableCell>
																<TableCell className="max-w-[200px] truncate">
																	{inst.name}
																</TableCell>
																<TableCell>
																	<Badge variant="outline">
																		{inst.exchange}
																	</Badge>
																</TableCell>
																<TableCell>
																	<Badge variant="secondary">
																		{inst.market}
																	</Badge>
																</TableCell>
																<TableCell className="text-sm text-muted-foreground">
																	{inst.sector || "-"}
																</TableCell>
																<TableCell className="font-mono text-xs">
																	{inst.isin || "-"}
																</TableCell>
																<TableCell>
																	<Switch
																		checked={inst.isActive}
																		onCheckedChange={(checked) =>
																			toggleMutation.mutate({
																				id: inst.id,
																				isActive: checked,
																			})
																		}
																	/>
																</TableCell>
																<TableCell>
																	<div className="flex gap-1">
																		<Button
																			variant="ghost"
																			size="icon"
																			onClick={() => handleEdit(inst)}
																		>
																			<Edit className="h-4 w-4" />
																		</Button>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="text-destructive"
																			onClick={() =>
																				deleteMutation.mutate(inst.id)
																			}
																		>
																			<Trash2 className="h-4 w-4" />
																		</Button>
																	</div>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</ScrollArea>
										)}
									</TabsContent>
								))}
							</Tabs>
						</CardContent>
					</Card>

					<Dialog
						open={addDialogOpen || !!editingInstrument}
						onOpenChange={(open) => {
							if (!open) {
								setAddDialogOpen(false);
								setEditingInstrument(null);
								resetForm();
							}
						}}
					>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>
									{editingInstrument ? "Edit Instrument" : "Add New Instrument"}
								</DialogTitle>
								<DialogDescription>
									{editingInstrument
										? "Update instrument details"
										: "Add a new global instrument to the catalog"}
								</DialogDescription>
							</DialogHeader>
							<div className="grid grid-cols-2 gap-4 py-4">
								<div className="space-y-2">
									<Label>Symbol *</Label>
									<Input
										value={formData.symbol}
										onChange={(e) =>
											setFormData({
												...formData,
												symbol: e.target.value.toUpperCase(),
											})
										}
										placeholder="AAPL"
									/>
								</div>
								<div className="space-y-2">
									<Label>Name *</Label>
									<Input
										value={formData.name}
										onChange={(e) =>
											setFormData({ ...formData, name: e.target.value })
										}
										placeholder="Apple Inc."
									/>
								</div>
								<div className="space-y-2">
									<Label>Asset Class *</Label>
									<Select
										value={formData.assetClass}
										onValueChange={(v) =>
											setFormData({ ...formData, assetClass: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{assetClasses.map((ac) => (
												<SelectItem key={ac.value} value={ac.value}>
													{ac.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Market *</Label>
									<Select
										value={formData.market}
										onValueChange={(v) =>
											setFormData({ ...formData, market: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{markets.map((m) => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Exchange *</Label>
									<Select
										value={formData.exchange}
										onValueChange={(v) =>
											setFormData({ ...formData, exchange: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{exchanges.map((ex) => (
												<SelectItem key={ex.value} value={ex.value}>
													{ex.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Currency *</Label>
									<Select
										value={formData.currency}
										onValueChange={(v) =>
											setFormData({ ...formData, currency: v })
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{currencies.map((c) => (
												<SelectItem key={c} value={c}>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>ISIN</Label>
									<Input
										value={formData.isin}
										onChange={(e) =>
											setFormData({
												...formData,
												isin: e.target.value.toUpperCase(),
											})
										}
										placeholder="US0378331005"
									/>
								</div>
								<div className="space-y-2">
									<Label>Sector</Label>
									<Select
										value={formData.sector}
										onValueChange={(v) =>
											setFormData({ ...formData, sector: v })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select sector" />
										</SelectTrigger>
										<SelectContent>
											{sectors.map((s) => (
												<SelectItem key={s} value={s}>
													{s}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Industry</Label>
									<Input
										value={formData.industry}
										onChange={(e) =>
											setFormData({ ...formData, industry: e.target.value })
										}
										placeholder="Consumer Electronics"
									/>
								</div>
								<div className="space-y-2">
									<Label>Market Cap Category</Label>
									<Select
										value={formData.marketCapCategory}
										onValueChange={(v) =>
											setFormData({ ...formData, marketCapCategory: v })
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											{marketCapCategories.map((mc) => (
												<SelectItem key={mc.value} value={mc.value}>
													{mc.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => {
										setAddDialogOpen(false);
										setEditingInstrument(null);
										resetForm();
									}}
								>
									Cancel
								</Button>
								<Button
									onClick={handleSubmit}
									disabled={
										createMutation.isPending || updateMutation.isPending
									}
								>
									{(createMutation.isPending || updateMutation.isPending) && (
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
									)}
									{editingInstrument ? "Update" : "Create"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					<Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
						<DialogContent className="max-w-2xl">
							<DialogHeader>
								<DialogTitle>Bulk Import Instruments</DialogTitle>
								<DialogDescription>
									Paste CSV data with format: symbol, name, assetClass,
									exchange, market, currency, isin, sector
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4 py-4">
								<textarea
									className="w-full h-64 p-3 border rounded-md font-mono text-sm"
									placeholder="AAPL,Apple Inc.,stock,NASDAQ,US,USD,US0378331005,Technology
MSFT,Microsoft Corporation,stock,NASDAQ,US,USD,US5949181045,Technology
SPY,SPDR S&P 500 ETF Trust,etf,NYSE,US,USD,,Index"
									value={bulkData}
									onChange={(e) => setBulkData(e.target.value)}
								/>
								<p className="text-sm text-muted-foreground">
									Each line represents one instrument. Fields: symbol, name,
									assetClass (stock/etf/mutual_fund/bond), exchange, market,
									currency, isin (optional), sector (optional)
								</p>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setBulkDialogOpen(false)}
								>
									Cancel
								</Button>
								<Button
									onClick={handleBulkImport}
									disabled={bulkImportMutation.isPending}
								>
									{bulkImportMutation.isPending && (
										<Loader2 className="h-4 w-4 animate-spin mr-2" />
									)}
									Import
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</div>
		</AdminLayout>
	);
}
