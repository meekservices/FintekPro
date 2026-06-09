/**
 * Rebalancing Panel
 * Alpaca Portfolio Rebalancing — create portfolios, run rebalancing, manage subscriptions.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
	Scale,
	Plus,
	RefreshCw,
	Play,
	Trash2,
	Info,
	CheckCircle2,
	Clock,
	AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface RebalancingPortfolio {
	id: string;
	name: string;
	description?: string;
	status: string;
	weights: Array<{ symbol: string; percent: number }>;
	created_at: string;
	updated_at: string;
}

interface RebalancingSubscription {
	id: string;
	account_id: string;
	portfolio_id: string;
	status: string;
	created_at: string;
}

interface RebalancingRun {
	id: string;
	status: string;
	created_at: string;
	completed_at?: string;
}

interface RebalancingPanelProps {
	accountId?: string;
}

export default function RebalancingPanel({ accountId }: RebalancingPanelProps) {
	const { toast } = useToast();
	const [newPortfolioOpen, setNewPortfolioOpen] = useState(false);
	const [portfolioName, setPortfolioName] = useState("");
	const [portfolioDesc, setPortfolioDesc] = useState("");
	const [weightsText, setWeightsText] = useState(
		"AAPL:25\nMSFT:25\nGOOGL:25\nAMZN:25",
	);
	const [runningPortfolioId, setRunningPortfolioId] = useState<string | null>(
		null,
	);

	const {
		data: portfolioData,
		isLoading,
		refetch,
	} = useQuery<{ success: boolean; portfolios: RebalancingPortfolio[] }>({
		queryKey: ["/api/us-trading/broker/rebalancing/portfolios"],
		queryFn: () =>
			fetch("/api/us-trading/broker/rebalancing/portfolios").then((r) =>
				r.json(),
			),
		staleTime: 60_000,
	});

	const portfolios = portfolioData?.portfolios ?? [];

	const createMutation = useMutation({
		mutationFn: () => {
			const weights = weightsText
				.split("\n")
				.filter(Boolean)
				.map((line) => {
					const [symbol, percent] = line.trim().split(":");
					return {
						symbol: symbol.trim().toUpperCase(),
						percent: Number.parseFloat(percent ?? "0"),
					};
				});
			const totalPct = weights.reduce((s, w) => s + w.percent, 0);
			if (Math.abs(totalPct - 100) > 0.01)
				throw new Error(
					`Weights must sum to 100% (currently ${totalPct.toFixed(2)}%)`,
				);
			return apiRequest("/api/us-trading/broker/rebalancing/portfolios", {
				method: "POST",
				body: JSON.stringify({
					name: portfolioName,
					description: portfolioDesc,
					weights,
				}),
			});
		},
		onSuccess: () => {
			toast({
				title: "Portfolio created",
				description: "Your rebalancing portfolio has been created.",
			});
			setNewPortfolioOpen(false);
			setPortfolioName("");
			queryClient.invalidateQueries({
				queryKey: ["/api/us-trading/broker/rebalancing/portfolios"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Create failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const subscribeMutation = useMutation({
		mutationFn: (portfolioId: string) => {
			if (!accountId) throw new Error("No account ID");
			return apiRequest(
				`/api/us-trading/broker/rebalancing/portfolios/${portfolioId}/subscriptions`,
				{
					method: "POST",
					body: JSON.stringify({ account_id: accountId }),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Subscribed",
				description:
					"Account subscribed to portfolio. Rebalancing will run as scheduled.",
			});
			refetch();
		},
		onError: (e: any) =>
			toast({
				title: "Subscribe failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const runMutation = useMutation({
		mutationFn: (portfolioId: string) => {
			setRunningPortfolioId(portfolioId);
			return apiRequest(
				`/api/us-trading/broker/rebalancing/portfolios/${portfolioId}/runs`,
				{
					method: "POST",
					body: JSON.stringify({ type: "full_rebalance" }),
				},
			);
		},
		onSuccess: () => {
			toast({
				title: "Rebalancing triggered",
				description:
					"Rebalancing run initiated. Orders will be placed shortly.",
			});
			setRunningPortfolioId(null);
		},
		onError: (e: any) => {
			toast({
				title: "Run failed",
				description: e.message,
				variant: "destructive",
			});
			setRunningPortfolioId(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (portfolioId: string) =>
			apiRequest(
				`/api/us-trading/broker/rebalancing/portfolios/${portfolioId}`,
				"DELETE",
				{},
			),
		onSuccess: () => {
			toast({ title: "Portfolio deleted" });
			queryClient.invalidateQueries({
				queryKey: ["/api/us-trading/broker/rebalancing/portfolios"],
			});
		},
		onError: (e: any) =>
			toast({
				title: "Delete failed",
				description: e.message,
				variant: "destructive",
			}),
	});

	const totalPercent = weightsText
		.split("\n")
		.filter(Boolean)
		.reduce((s, line) => {
			const pct = Number.parseFloat(line.split(":")[1] ?? "0");
			return s + (Number.isNaN(pct) ? 0 : pct);
		}, 0);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<div>
							<CardTitle className="text-base flex items-center gap-2">
								<Scale className="h-4 w-4" />
								Portfolio Rebalancing
							</CardTitle>
							<CardDescription className="text-xs mt-0.5">
								Define target allocations. Alpaca automatically places orders to
								match your target weights.
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								onClick={() => refetch()}
								className="h-8 gap-1 text-xs"
							>
								<RefreshCw className="h-3 w-3" />
							</Button>
							<Button
								size="sm"
								onClick={() => setNewPortfolioOpen(true)}
								className="h-8 gap-1 text-xs"
							>
								<Plus className="h-3 w-3" />
								New Portfolio
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					{isLoading ? (
						<div className="p-4 space-y-2">
							{[...Array(3)].map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					) : portfolios.length === 0 ? (
						<div className="py-10 text-center text-sm text-muted-foreground">
							<Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
							<p>No rebalancing portfolios yet.</p>
							<p className="text-xs mt-1">
								Create a portfolio to define target allocations.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Portfolio</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Weights</TableHead>
									<TableHead className="w-28" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{portfolios.map((p) => (
									<TableRow key={p.id}>
										<TableCell>
											<div className="font-medium text-sm">{p.name}</div>
											{p.description && (
												<div className="text-xs text-muted-foreground">
													{p.description}
												</div>
											)}
										</TableCell>
										<TableCell>
											<Badge
												className={
													p.status === "active"
														? "bg-green-100 text-green-700"
														: p.status === "inactive"
															? "bg-gray-100 text-gray-600"
															: "bg-amber-100 text-amber-700"
												}
											>
												{p.status}
											</Badge>
										</TableCell>
										<TableCell className="text-xs text-muted-foreground max-w-[160px]">
											{p.weights
												?.slice(0, 4)
												.map((w) => `${w.symbol} ${w.percent}%`)
												.join(", ")}
											{p.weights?.length > 4 &&
												` +${p.weights.length - 4} more`}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-1">
												{accountId && (
													<Button
														variant="outline"
														size="sm"
														className="h-7 text-xs"
														onClick={() => subscribeMutation.mutate(p.id)}
														disabled={subscribeMutation.isPending}
													>
														Subscribe
													</Button>
												)}
												<Button
													variant="default"
													size="sm"
													className="h-7 text-xs gap-1"
													onClick={() => runMutation.mutate(p.id)}
													disabled={
														runMutation.isPending && runningPortfolioId === p.id
													}
												>
													{runMutation.isPending &&
													runningPortfolioId === p.id ? (
														<RefreshCw className="h-3 w-3 animate-spin" />
													) : (
														<Play className="h-3 w-3" />
													)}
													Run
												</Button>
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
															disabled={deleteMutation.isPending}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Delete portfolio?
															</AlertDialogTitle>
															<AlertDialogDescription>
																Permanently delete <strong>{p.name}</strong>?
																All subscriptions to this portfolio will also be
																removed. This cannot be undone.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Keep</AlertDialogCancel>
															<AlertDialogAction
																className="bg-red-600 hover:bg-red-700"
																onClick={() => deleteMutation.mutate(p.id)}
															>
																Delete Portfolio
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Alert className="border-blue-200 bg-blue-50/50 py-2">
				<Info className="h-3.5 w-3.5 text-blue-600" />
				<AlertDescription className="text-xs text-blue-700">
					<strong>How it works:</strong> Alpaca's rebalancing engine places
					buy/sell orders to bring your portfolio in line with target weights.
					Orders are market orders placed during regular hours. Fractional
					shares are used when needed. Tax implications (capital gains) apply —
					consult your CA before running rebalances frequently.
				</AlertDescription>
			</Alert>

			<Dialog open={newPortfolioOpen} onOpenChange={setNewPortfolioOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Create Rebalancing Portfolio</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div>
							<Label className="text-xs">Portfolio Name</Label>
							<Input
								className="mt-1 h-9 text-sm"
								placeholder="e.g. US Tech Core"
								value={portfolioName}
								onChange={(e) => setPortfolioName(e.target.value)}
							/>
						</div>
						<div>
							<Label className="text-xs">Description (optional)</Label>
							<Input
								className="mt-1 h-9 text-sm"
								placeholder="e.g. FAANG + blue chips at 25% each"
								value={portfolioDesc}
								onChange={(e) => setPortfolioDesc(e.target.value)}
							/>
						</div>
						<div>
							<Label className="text-xs flex items-center justify-between">
								<span>Target Weights (SYMBOL:PERCENT per line)</span>
								<span
									className={
										totalPercent > 100.01
											? "text-red-500"
											: totalPercent < 99.99
												? "text-amber-500"
												: "text-green-600"
									}
								>
									Total: {totalPercent.toFixed(1)}%
								</span>
							</Label>
							<textarea
								className="mt-1 w-full h-28 text-sm border rounded-md p-2 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring bg-background"
								placeholder={"AAPL:25\nMSFT:25\nGOOGL:25\nAMZN:25"}
								value={weightsText}
								onChange={(e) => setWeightsText(e.target.value)}
							/>
							{Math.abs(totalPercent - 100) > 0.01 && (
								<p className="text-xs text-amber-600 mt-1">
									Weights must sum to exactly 100%
								</p>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setNewPortfolioOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => createMutation.mutate()}
							disabled={
								!portfolioName ||
								Math.abs(totalPercent - 100) > 0.01 ||
								createMutation.isPending
							}
						>
							{createMutation.isPending ? (
								<RefreshCw className="h-4 w-4 animate-spin mr-2" />
							) : null}
							Create Portfolio
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
