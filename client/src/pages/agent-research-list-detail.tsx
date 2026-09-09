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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link, useParams } from "wouter";
import {
	ArrowLeft,
	Plus,
	Search,
	Trash2,
	Download,
	FileText,
	TrendingUp,
	Shield as LucideShield,
	Star,
} from "lucide-react";

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

export default function AgentResearchListDetail() {
	const { id } = useParams<{ id: string }>();
	const { toast } = useToast();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState("basics");

	const [instrumentSearch, setInstrumentSearch] = useState("");

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

	const addItemMutation = useMutation({
		mutationFn: async (instrument: any) => {
			const instId = String(
				instrument.id || instrument.symbol || instrument.isin || "",
			);
			const instType =
				instrument.type || (universe === "STOCK" ? "stock" : "mutual_fund");
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
						returns3y: instrument.returns3y
							? Number(instrument.returns3y)
							: undefined,
						expenseRatio: instrument.expenseRatio
							? Number(instrument.expenseRatio)
							: undefined,
						currentPrice: instrument.currentPrice
							? Number(instrument.currentPrice)
							: undefined,
						marketCap: instrument.marketCap,
						sector: instrument.sector,
					},
				}),
			});
		},
		onSuccess: () => {
			toast({ title: "Added", description: "Instrument added to list" });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists", id] });
			queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
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
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to remove instrument",
				variant: "destructive",
			});
		},
	});

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

	return (
		<div className="p-4 md:p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/agent/research-lists">
					<Button variant="ghost" size="icon">
						<ArrowLeft className="h-5 w-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h1 className="text-2xl font-bold text-foreground">{list.name}</h1>
					{list.description && (
						<p className="text-muted-foreground mt-1">{list.description}</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<Badge className="bg-blue-500 text-white">{list.universeType}</Badge>
					<Badge
						variant="outline"
						className="border-border text-muted-foreground"
					>
						{list.visibility}
					</Badge>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						<div className="text-2xl font-bold text-foreground">
							{items.length}
						</div>
						<p className="text-sm text-muted-foreground">Total Instruments</p>
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
						<div className="text-2xl font-bold text-amber-400">
							{formatNumber(list.cachedMetrics?.avgExpenseRatio, 2)}%
						</div>
						<p className="text-sm text-muted-foreground">Avg Expense Ratio</p>
					</CardContent>
				</Card>
				<Card className="bg-card/50 border-border">
					<CardContent className="pt-6">
						<div className="text-2xl font-bold text-blue-400">
							{formatNumber(list.cachedMetrics?.avgRating, 1)}
						</div>
						<p className="text-sm text-muted-foreground">Avg Rating</p>
					</CardContent>
				</Card>
			</div>

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
									Risk
								</TabsTrigger>
							</TabsList>
						</Tabs>
						<div className="flex items-center gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Filter list or search catalog..."
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
									className="pl-10 w-[240px] bg-background border-border"
								/>
							</div>
							{list.isEditable && (
								<Button
									onClick={() => openAddDialog()}
									className="gap-2"
								>
									<Plus className="h-4 w-4" />
									Add Instrument
								</Button>
							)}
							<Button variant="outline" className="gap-2 border-border">
								<Download className="h-4 w-4" />
								Export
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{filteredItems.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							{items.length === 0 ? (
								<>
									<p className="text-base font-medium text-foreground">
										No instruments in this list yet.
									</p>
									<p className="text-sm text-muted-foreground mt-1">
										Start building your research list by adding{" "}
										{list.universeType === "MF" ? "mutual funds" : "stocks"}.
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
										{activeTab === "basics" && (
											<>
												<TableHead className="text-muted-foreground text-right">
													NAV/Price
												</TableHead>
												<TableHead className="text-muted-foreground">
													Source
												</TableHead>
											</>
										)}
										{activeTab === "performance" && (
											<>
												<TableHead className="text-muted-foreground text-right">
													1Y Return
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													3Y Return
												</TableHead>
												<TableHead className="text-muted-foreground text-right">
													5Y Return
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
												<TableHead className="text-muted-foreground text-right">
													AUM (Cr)
												</TableHead>
											</>
										)}
										<TableHead className="text-muted-foreground">
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
												{activeTab === "basics" && (
													<>
														<TableCell className="text-right text-muted-foreground">
															₹
															{formatNumber(
																metrics.nav || metrics.currentPrice,
																2,
															)}
														</TableCell>
														<TableCell>
															<Badge
																variant="outline"
																className="border-border text-muted-foreground text-xs"
															>
																{item.addedSource}
															</Badge>
														</TableCell>
													</>
												)}
												{activeTab === "performance" && (
													<>
														<TableCell className="text-right text-green-400">
															{formatNumber(metrics.returns1y, 1)}%
														</TableCell>
														<TableCell className="text-right text-green-400">
															{formatNumber(metrics.returns3y, 1)}%
														</TableCell>
														<TableCell className="text-right text-green-400">
															{formatNumber(metrics.returns5y, 1)}%
														</TableCell>
													</>
												)}
												{activeTab === "risk" && (
													<>
														<TableCell>
															<Badge
																className={
																	metrics.riskLevel === "Low"
																		? "bg-green-500"
																		: metrics.riskLevel === "High"
																			? "bg-red-500"
																			: "bg-amber-500"
																}
															>
																{metrics.riskLevel || "—"}
															</Badge>
														</TableCell>
														<TableCell className="text-right text-muted-foreground">
															{formatNumber(metrics.expenseRatio, 2)}%
														</TableCell>
														<TableCell className="text-right text-muted-foreground">
															{metrics.aum && !Number.isNaN(Number(metrics.aum))
																? (Number(metrics.aum) / 10000000).toFixed(0)
																: "—"}
														</TableCell>
													</>
												)}
												<TableCell>
													<div className="flex items-center gap-1">
														{[1, 2, 3, 4, 5].map((star) => (
															<Star
																key={star}
																className={`h-3 w-3 ${
																	star <= (item.rating || 0)
																		? "text-amber-400 fill-amber-400"
																		: "text-muted-foreground"
																}`}
															/>
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

			<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
				<DialogContent className="sm:max-w-[650px]">
					<DialogHeader>
						<DialogTitle>Add Instrument to {list.name}</DialogTitle>
						<DialogDescription>
							Search and add{" "}
							{list.universeType === "MF" ? "mutual funds" : "stocks"} to your
							research list.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder={`Search ${
									list.universeType === "MF"
										? "mutual funds by name or AMC"
										: "stocks by name or symbol (e.g. PERSISTENT, RELIANCE)"
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
								{list.universeType === "MF" ? "mutual funds" : "stocks"}...
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
														{inst.marketCap && (
															<span>• {inst.marketCap}</span>
														)}
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
									No {list.universeType === "MF" ? "mutual funds" : "stocks"}{" "}
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
		</div>
	);
}
