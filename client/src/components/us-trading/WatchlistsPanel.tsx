import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Bookmark,
	Plus,
	Trash2,
	X,
	RefreshCw,
	Star,
	TrendingUp,
	ChevronRight,
	ArrowLeft,
	AlertTriangle,
	Search,
} from "lucide-react";

interface WatchlistAsset {
	id: string;
	symbol: string;
	name: string;
	exchange: string;
	class: string;
	status: string;
	tradable: boolean;
}

interface Watchlist {
	id: string;
	account_id: string;
	name: string;
	created_at: string;
	updated_at: string;
	assets: WatchlistAsset[];
}

interface WatchlistsPanelProps {
	accountId: string;
}

export default function WatchlistsPanel({ accountId }: WatchlistsPanelProps) {
	const { toast } = useToast();
	const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(
		null,
	);
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [newWatchlistName, setNewWatchlistName] = useState("");
	const [newWatchlistSymbols, setNewWatchlistSymbols] = useState("");
	const [addSymbolInput, setAddSymbolInput] = useState("");
	const [symbolFilter, setSymbolFilter] = useState("");

	const qKey = ["/api/broker/accounts", accountId, "watchlists"];

	const { data, isLoading, error, refetch } = useQuery<{
		success: boolean;
		watchlists: Watchlist[];
	}>({
		queryKey: qKey,
		queryFn: () =>
			fetch(`/api/broker/accounts/${accountId}/watchlists`).then((r) =>
				r.json(),
			),
		enabled: !!accountId,
		staleTime: 30_000,
	});

	const watchlists: Watchlist[] = data?.watchlists ?? [];

	const createMutation = useMutation({
		mutationFn: (body: { name: string; symbols: string[] }) =>
			apiRequest(`/api/broker/accounts/${accountId}/watchlists`, "POST", body),
		onSuccess: (res: any) => {
			toast({
				title: "Watchlist created",
				description: `"${res.watchlist?.name}" is ready.`,
			});
			queryClient.invalidateQueries({ queryKey: qKey });
			setShowCreateDialog(false);
			setNewWatchlistName("");
			setNewWatchlistSymbols("");
		},
		onError: (err: any) => {
			toast({
				title: "Create failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (watchlistId: string) =>
			apiRequest(
				`/api/broker/accounts/${accountId}/watchlists/${watchlistId}`,
				"DELETE",
				{},
			),
		onSuccess: () => {
			toast({ title: "Watchlist deleted" });
			queryClient.invalidateQueries({ queryKey: qKey });
			setSelectedWatchlist(null);
		},
		onError: (err: any) => {
			toast({
				title: "Delete failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const addSymbolMutation = useMutation({
		mutationFn: ({
			watchlistId,
			symbol,
		}: { watchlistId: string; symbol: string }) =>
			apiRequest(
				`/api/broker/accounts/${accountId}/watchlists/${watchlistId}/symbols`,
				"POST",
				{ symbol },
			),
		onSuccess: (res: any) => {
			toast({
				title: "Symbol added",
				description: `${addSymbolInput.toUpperCase()} added to watchlist.`,
			});
			queryClient.invalidateQueries({ queryKey: qKey });
			if (res.watchlist) setSelectedWatchlist(res.watchlist);
			setAddSymbolInput("");
		},
		onError: (err: any) => {
			toast({
				title: "Add symbol failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const removeSymbolMutation = useMutation({
		mutationFn: ({
			watchlistId,
			symbol,
		}: { watchlistId: string; symbol: string }) =>
			apiRequest(
				`/api/broker/accounts/${accountId}/watchlists/${watchlistId}/symbols/${symbol}`,
				"DELETE",
				{},
			),
		onSuccess: (_, vars) => {
			toast({
				title: "Symbol removed",
				description: `${vars.symbol} removed from watchlist.`,
			});
			queryClient.invalidateQueries({ queryKey: qKey });
			setSelectedWatchlist((prev) =>
				prev
					? {
							...prev,
							assets: prev.assets.filter((a) => a.symbol !== vars.symbol),
						}
					: null,
			);
		},
		onError: (err: any) => {
			toast({
				title: "Remove failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	function handleCreate() {
		const name = newWatchlistName.trim();
		if (!name) return;
		const symbols = newWatchlistSymbols
			.split(/[\s,]+/)
			.map((s) => s.trim().toUpperCase())
			.filter(Boolean);
		createMutation.mutate({ name, symbols });
	}

	function handleAddSymbol() {
		const sym = addSymbolInput.trim().toUpperCase();
		if (!sym || !selectedWatchlist) return;
		addSymbolMutation.mutate({
			watchlistId: selectedWatchlist.id,
			symbol: sym,
		});
	}

	const filteredAssets = selectedWatchlist
		? selectedWatchlist.assets.filter((a) =>
				symbolFilter
					? a.symbol.includes(symbolFilter.toUpperCase()) ||
						a.name.toLowerCase().includes(symbolFilter.toLowerCase())
					: true,
			)
		: [];

	if (isLoading) {
		return (
			<div className="space-y-3">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-16 w-full" />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertDescription>
					Failed to load watchlists. {(error as any).message}
				</AlertDescription>
			</Alert>
		);
	}

	if (selectedWatchlist) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setSelectedWatchlist(null);
							setSymbolFilter("");
						}}
					>
						<ArrowLeft className="h-4 w-4 mr-1" /> Back
					</Button>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-base truncate">
							{selectedWatchlist.name}
						</h3>
						<p className="text-xs text-muted-foreground">
							{selectedWatchlist.assets.length} symbol
							{selectedWatchlist.assets.length !== 1 ? "s" : ""}
						</p>
					</div>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
							>
								<Trash2 className="h-4 w-4 mr-1" /> Delete List
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete watchlist?</AlertDialogTitle>
								<AlertDialogDescription>
									"{selectedWatchlist.name}" and all its symbols will be
									permanently deleted.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									className="bg-red-600 hover:bg-red-700"
									onClick={() => deleteMutation.mutate(selectedWatchlist.id)}
								>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Add Symbol</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex gap-2">
							<Input
								placeholder="e.g. AAPL, TSLA"
								value={addSymbolInput}
								onChange={(e) =>
									setAddSymbolInput(e.target.value.toUpperCase())
								}
								onKeyDown={(e) => e.key === "Enter" && handleAddSymbol()}
								className="font-mono uppercase text-sm"
								maxLength={10}
							/>
							<Button
								onClick={handleAddSymbol}
								disabled={!addSymbolInput.trim() || addSymbolMutation.isPending}
								size="sm"
							>
								{addSymbolMutation.isPending ? (
									<RefreshCw className="h-4 w-4 animate-spin" />
								) : (
									<Plus className="h-4 w-4" />
								)}
								<span className="ml-1">Add</span>
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<div className="flex items-center gap-2">
							<div className="flex-1">
								<CardTitle className="text-sm font-medium">Symbols</CardTitle>
							</div>
							{selectedWatchlist.assets.length > 5 && (
								<div className="relative">
									<Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
									<Input
										className="h-7 pl-7 text-xs w-36"
										placeholder="Filter..."
										value={symbolFilter}
										onChange={(e) => setSymbolFilter(e.target.value)}
									/>
								</div>
							)}
						</div>
					</CardHeader>
					<CardContent className="p-0">
						{filteredAssets.length === 0 ? (
							<div className="text-center py-10 text-muted-foreground text-sm">
								{selectedWatchlist.assets.length === 0
									? "No symbols yet — add some above."
									: "No symbols match your filter."}
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Symbol</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Exchange</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right" />
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredAssets.map((asset) => (
										<TableRow key={asset.id}>
											<TableCell className="font-mono font-semibold text-blue-600 dark:text-blue-400">
												{asset.symbol}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
												{asset.name || "—"}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="text-xs">
													{asset.exchange}
												</Badge>
											</TableCell>
											<TableCell>
												<Badge
													className={`text-xs ${asset.tradable ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-gray-100 text-gray-500"}`}
												>
													{asset.tradable ? "Tradable" : "Non-tradable"}
												</Badge>
											</TableCell>
											<TableCell className="text-right">
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
													disabled={removeSymbolMutation.isPending}
													onClick={() =>
														removeSymbolMutation.mutate({
															watchlistId: selectedWatchlist.id,
															symbol: asset.symbol,
														})
													}
												>
													<X className="h-4 w-4" />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-base">Watchlists</h3>
					<p className="text-xs text-muted-foreground mt-0.5">
						Track US stocks & ETFs — up to 30 symbols per list
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="sm" onClick={() => refetch()}>
						<RefreshCw className="h-4 w-4 mr-1" /> Refresh
					</Button>
					<Button size="sm" onClick={() => setShowCreateDialog(true)}>
						<Plus className="h-4 w-4 mr-1" /> New List
					</Button>
				</div>
			</div>

			{watchlists.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-14 gap-3">
						<Bookmark className="h-10 w-10 text-muted-foreground opacity-40" />
						<div className="text-center">
							<p className="font-medium text-muted-foreground">
								No watchlists yet
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								Create a watchlist to track US stocks and ETFs for this account.
							</p>
						</div>
						<Button size="sm" onClick={() => setShowCreateDialog(true)}>
							<Plus className="h-4 w-4 mr-1" /> Create First Watchlist
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{watchlists.map((wl) => (
						<Card
							key={wl.id}
							className="cursor-pointer hover:shadow-md transition-shadow border hover:border-blue-300 dark:hover:border-blue-700"
							onClick={() => setSelectedWatchlist(wl)}
						>
							<CardContent className="p-4">
								<div className="flex items-start gap-3">
									<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
										<Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="font-semibold text-sm truncate">{wl.name}</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{wl.assets.length} symbol
											{wl.assets.length !== 1 ? "s" : ""}
										</p>
										{wl.assets.length > 0 && (
											<div className="flex flex-wrap gap-1 mt-2">
												{wl.assets.slice(0, 5).map((a) => (
													<Badge
														key={a.id}
														variant="secondary"
														className="text-xs font-mono px-1.5 py-0"
													>
														{a.symbol}
													</Badge>
												))}
												{wl.assets.length > 5 && (
													<Badge
														variant="outline"
														className="text-xs px-1.5 py-0"
													>
														+{wl.assets.length - 5} more
													</Badge>
												)}
											</div>
										)}
									</div>
									<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Bookmark className="h-5 w-5" /> Create Watchlist
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<label className="text-sm font-medium">Watchlist Name</label>
							<Input
								placeholder="e.g. My Tech Picks"
								value={newWatchlistName}
								onChange={(e) => setNewWatchlistName(e.target.value)}
								maxLength={64}
							/>
						</div>
						<div className="space-y-1.5">
							<label className="text-sm font-medium">
								Initial Symbols{" "}
								<span className="text-muted-foreground font-normal">
									(optional)
								</span>
							</label>
							<Input
								placeholder="AAPL, MSFT, NVDA"
								value={newWatchlistSymbols}
								onChange={(e) =>
									setNewWatchlistSymbols(e.target.value.toUpperCase())
								}
							/>
							<p className="text-xs text-muted-foreground">
								Comma or space separated. Max 30 symbols.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowCreateDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							disabled={!newWatchlistName.trim() || createMutation.isPending}
						>
							{createMutation.isPending ? (
								<>
									<RefreshCw className="h-4 w-4 mr-1 animate-spin" />{" "}
									Creating...
								</>
							) : (
								<>
									<Plus className="h-4 w-4 mr-1" /> Create
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
