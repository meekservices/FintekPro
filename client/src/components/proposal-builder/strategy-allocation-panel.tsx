import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
	Lock,
	Unlock,
	Brain,
	Pencil,
	CheckCircle2,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	BarChart3,
	Shield as LucideShield,
	ArrowRight,
	Loader2,
	PieChart,
	Scale,
	Sparkles,
	RefreshCw,
} from "lucide-react";

type AllocationMode = "AI_DRIVEN" | "MANUAL";

interface AssetAllocation {
	assetClass: string;
	weight: number;
}

interface StrategySnapshot {
	allocationMode: AllocationMode;
	assetAllocation: AssetAllocation[];
	lockedAt: string;
	lockedBy: string;
	totalWeight: number;
}

interface BacktestDelta {
	cagrDifference: number;
	volatilityDifference: number;
	maxDrawdownDifference: number;
	sharpeImprovement: number;
}

interface PortfolioDifferenceSummary {
	allocationDelta: {
		assetClass: string;
		oldWeight: number;
		proposedWeight: number;
		change: number;
	}[];
	riskMetricDelta: {
		metric: string;
		oldValue: number;
		proposedValue: number;
		impact: string;
	}[];
	costDelta: {
		category: string;
		oldCost: number;
		proposedCost: number;
		savings: number;
	}[];
	concentrationDelta: {
		assetClass: string;
		oldConcentration: number;
		proposedConcentration: number;
	}[];
}

interface StrategyAllocationPanelProps {
	proposalId: string;
	currentHoldings?: {
		assetClass: string;
		weight: number;
		startDate?: string;
	}[];
}

const ASSET_CLASS_LABELS: Record<string, string> = {
	equity: "Equity",
	debt: "Debt / Fixed Income",
	gold: "Gold",
	international: "International",
	cash: "Cash",
	reit: "REITs",
	invit: "InvITs",
};

const ASSET_CLASS_COLORS: Record<string, string> = {
	equity: "bg-blue-500",
	debt: "bg-green-500",
	gold: "bg-yellow-500",
	international: "bg-purple-500",
	cash: "bg-gray-400",
	reit: "bg-orange-500",
	invit: "bg-teal-500",
};

export default function StrategyAllocationPanel({
	proposalId,
	currentHoldings = [],
}: StrategyAllocationPanelProps) {
	const { toast } = useToast();
	const [mode, setMode] = useState<AllocationMode>("AI_DRIVEN");
	const [allocation, setAllocation] = useState<AssetAllocation[]>([
		{ assetClass: "equity", weight: 55 },
		{ assetClass: "debt", weight: 30 },
		{ assetClass: "gold", weight: 10 },
		{ assetClass: "international", weight: 5 },
	]);
	const [activeTab, setActiveTab] = useState("allocation");

	const { data: lockedStrategy, isLoading: loadingStrategy } = useQuery<{
		locked: boolean;
		snapshot: StrategySnapshot | null;
		versionNumber: number;
	}>({
		queryKey: ["/api/proposals", proposalId, "locked-strategy"],
		enabled: !!proposalId,
	});

	const { data: aiAllocation, isLoading: loadingAi } = useQuery<{
		allocation: AssetAllocation[];
		requiresApproval: boolean;
	}>({
		queryKey: ["/api/proposals", proposalId, "ai-allocation"],
		enabled: !!proposalId && mode === "AI_DRIVEN" && !lockedStrategy?.locked,
	});

	const { data: integrityCheck } = useQuery<{
		valid: boolean;
		errors: string[];
		strategyLocked: boolean;
		versionNumber: number;
		integrityChecks: { check: string; passed: boolean; detail?: string }[];
	}>({
		queryKey: ["/api/proposals", proposalId, "strategy-integrity"],
		enabled: !!proposalId && !!lockedStrategy?.locked,
	});

	const [backtestResult, setBacktestResult] = useState<{
		delta: BacktestDelta;
		oldMetrics: any;
		proposedMetrics: any;
		commonPeriod: { start: string; end: string };
	} | null>(null);

	const [differenceSummary, setDifferenceSummary] =
		useState<PortfolioDifferenceSummary | null>(null);

	useEffect(() => {
		if (
			aiAllocation?.allocation &&
			mode === "AI_DRIVEN" &&
			!lockedStrategy?.locked
		) {
			setAllocation(aiAllocation.allocation);
		}
	}, [aiAllocation, mode, lockedStrategy]);

	const lockMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest(
				"POST",
				`/api/proposals/${proposalId}/lock-strategy`,
				{
					allocationMode: mode,
					allocation,
					agentId: "advisor",
				},
			);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/proposals", proposalId, "locked-strategy"],
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/proposals", proposalId, "strategy-integrity"],
			});
			toast({
				title: "Strategy Locked",
				description:
					"Allocation has been locked. Product selection will follow this strategy.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Lock Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const backtestMutation = useMutation({
		mutationFn: async () => {
			const oldHoldings =
				currentHoldings.length > 0
					? currentHoldings
					: [
							{ assetClass: "equity", weight: 70, startDate: "2022-01-01" },
							{ assetClass: "debt", weight: 20, startDate: "2022-01-01" },
							{ assetClass: "gold", weight: 10, startDate: "2022-01-01" },
						];
			const res = await apiRequest(
				"POST",
				`/api/proposals/${proposalId}/fair-backtest`,
				{
					oldHoldings,
					agentId: "advisor",
				},
			);
			return res.json();
		},
		onSuccess: (data) => {
			setBacktestResult(data);
			toast({
				title: "Backtest Complete",
				description: "Fair comparison generated with common-period alignment.",
			});
		},
		onError: (err: any) => {
			toast({
				title: "Backtest Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const differenceMutation = useMutation({
		mutationFn: async () => {
			const oldAllocation =
				currentHoldings.length > 0
					? currentHoldings
					: [
							{ assetClass: "equity", weight: 70 },
							{ assetClass: "debt", weight: 20 },
							{ assetClass: "gold", weight: 10 },
						];
			const res = await apiRequest(
				"POST",
				`/api/proposals/${proposalId}/portfolio-difference`,
				{
					oldAllocation,
					agentId: "advisor",
				},
			);
			return res.json();
		},
		onSuccess: (data) => {
			setDifferenceSummary(data);
		},
		onError: (err: any) => {
			toast({
				title: "Difference Summary Failed",
				description: err.message,
				variant: "destructive",
			});
		},
	});

	const totalWeight = allocation.reduce((sum, a) => sum + a.weight, 0);
	const isValidAllocation = Math.abs(totalWeight - 100) < 0.01;
	const isLocked = lockedStrategy?.locked || false;

	const updateWeight = (index: number, newWeight: number) => {
		if (isLocked) return;
		const updated = [...allocation];
		updated[index] = {
			...updated[index],
			weight: Math.max(0, Math.min(100, newWeight)),
		};
		setAllocation(updated);
	};

	const addAssetClass = () => {
		if (isLocked) return;
		const available = Object.keys(ASSET_CLASS_LABELS).filter(
			(ac) => !allocation.find((a) => a.assetClass === ac),
		);
		if (available.length > 0) {
			setAllocation([...allocation, { assetClass: available[0], weight: 0 }]);
		}
	};

	const removeAssetClass = (index: number) => {
		if (isLocked) return;
		setAllocation(allocation.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-6">
			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="allocation" className="flex items-center gap-2">
						<PieChart className="h-4 w-4" />
						Strategy Allocation
					</TabsTrigger>
					<TabsTrigger
						value="backtest"
						className="flex items-center gap-2"
						disabled={!isLocked}
					>
						<BarChart3 className="h-4 w-4" />
						Fair Backtest
					</TabsTrigger>
					<TabsTrigger
						value="comparison"
						className="flex items-center gap-2"
						disabled={!isLocked}
					>
						<Scale className="h-4 w-4" />
						Portfolio Comparison
					</TabsTrigger>
				</TabsList>

				{/* TAB 1: Strategy Allocation */}
				<TabsContent value="allocation" className="space-y-4 mt-4">
					{/* Mode Selector */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base flex items-center gap-2">
								{mode === "AI_DRIVEN" ? (
									<Brain className="h-5 w-5 text-primary" />
								) : (
									<Pencil className="h-5 w-5 text-orange-500" />
								)}
								Allocation Mode
							</CardTitle>
							<CardDescription>
								Choose how asset allocation weights are determined
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-3">
								<button
									onClick={() => !isLocked && setMode("AI_DRIVEN")}
									disabled={isLocked}
									className={`p-4 rounded-lg border-2 text-left transition-all ${
										mode === "AI_DRIVEN"
											? "border-primary bg-primary/5"
											: "border-border hover:border-primary/50"
									} ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
								>
									<div className="flex items-center gap-2 mb-1">
										<Sparkles className="h-4 w-4 text-primary" />
										<span className="font-medium text-sm">AI-Driven</span>
									</div>
									<p className="text-xs text-muted-foreground">
										AI suggests allocation based on risk profile. Advisor must
										approve before locking.
									</p>
								</button>
								<button
									onClick={() => !isLocked && setMode("MANUAL")}
									disabled={isLocked}
									className={`p-4 rounded-lg border-2 text-left transition-all ${
										mode === "MANUAL"
											? "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
											: "border-border hover:border-orange-500/50"
									} ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
								>
									<div className="flex items-center gap-2 mb-1">
										<Pencil className="h-4 w-4 text-orange-500" />
										<span className="font-medium text-sm">Manual</span>
									</div>
									<p className="text-xs text-muted-foreground">
										Advisor sets allocation weights directly. Full control over
										strategy.
									</p>
								</button>
							</div>
						</CardContent>
					</Card>

					{/* Allocation Editor */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base flex items-center gap-2">
									{isLocked ? (
										<Lock className="h-5 w-5 text-green-600" />
									) : (
										<Unlock className="h-5 w-5 text-amber-500" />
									)}
									Asset Allocation
									{isLocked && (
										<Badge
											variant="outline"
											className="ml-2 text-green-600 border-green-600"
										>
											Locked v{lockedStrategy?.versionNumber}
										</Badge>
									)}
								</CardTitle>
								<div className="flex items-center gap-2">
									<span
										className={`text-sm font-medium ${isValidAllocation ? "text-green-600" : "text-red-500"}`}
									>
										{totalWeight.toFixed(1)}%
									</span>
									{isValidAllocation && (
										<CheckCircle2 className="h-4 w-4 text-green-600" />
									)}
								</div>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							{loadingAi && mode === "AI_DRIVEN" ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
									<span className="text-sm text-muted-foreground">
										AI is analyzing risk profile...
									</span>
								</div>
							) : (
								<>
									{/* Visual allocation bar */}
									<div className="h-6 rounded-full overflow-hidden flex bg-muted">
										{allocation
											.filter((a) => a.weight > 0)
											.map((a, i) => (
												<div
													key={a.assetClass}
													className={`${ASSET_CLASS_COLORS[a.assetClass] || "bg-gray-500"} transition-all duration-300`}
													style={{ width: `${a.weight}%` }}
													title={`${ASSET_CLASS_LABELS[a.assetClass] || a.assetClass}: ${a.weight}%`}
												/>
											))}
									</div>

									{/* Allocation rows */}
									{allocation.map((a, index) => (
										<div key={a.assetClass} className="flex items-center gap-3">
											<div
												className={`w-3 h-3 rounded-full ${ASSET_CLASS_COLORS[a.assetClass] || "bg-gray-500"}`}
											/>
											<span className="text-sm font-medium w-36">
												{ASSET_CLASS_LABELS[a.assetClass] || a.assetClass}
											</span>
											<div className="flex-1">
												<Progress value={a.weight} className="h-2" />
											</div>
											<Input
												type="number"
												value={a.weight}
												onChange={(e) =>
													updateWeight(
														index,
														Number.parseFloat(e.target.value) || 0,
													)
												}
												disabled={isLocked}
												className="w-20 text-right"
												min={0}
												max={100}
												step={1}
											/>
											<span className="text-sm text-muted-foreground w-4">
												%
											</span>
											{!isLocked && allocation.length > 2 && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => removeAssetClass(index)}
													className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
												>
													&times;
												</Button>
											)}
										</div>
									))}

									{!isLocked && (
										<Button
											variant="outline"
											size="sm"
											onClick={addAssetClass}
											className="w-full mt-2"
										>
											+ Add Asset Class
										</Button>
									)}
								</>
							)}
						</CardContent>
						<CardFooter className="pt-0">
							{!isLocked ? (
								<div className="w-full space-y-2">
									{!isValidAllocation && (
										<Alert variant="destructive">
											<AlertTriangle className="h-4 w-4" />
											<AlertDescription>
												Weights must total 100%. Current total:{" "}
												{totalWeight.toFixed(1)}%
											</AlertDescription>
										</Alert>
									)}
									<Button
										className="w-full"
										onClick={() => lockMutation.mutate()}
										disabled={!isValidAllocation || lockMutation.isPending}
									>
										{lockMutation.isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
												Locking Strategy...
											</>
										) : (
											<>
												<Lock className="h-4 w-4 mr-2" /> Lock Strategy &
												Proceed
											</>
										)}
									</Button>
									<p className="text-xs text-muted-foreground text-center">
										Once locked, allocation cannot be modified without creating
										a new version.
									</p>
								</div>
							) : (
								<div className="w-full">
									{integrityCheck && (
										<div className="space-y-2">
											<div className="flex items-center gap-2">
												{integrityCheck.valid ? (
													<Badge className="bg-green-100 text-green-700 dark:bg-green-900/30">
														<CheckCircle2 className="h-3 w-3 mr-1" /> Integrity
														Verified
													</Badge>
												) : (
													<Badge variant="destructive">
														<AlertTriangle className="h-3 w-3 mr-1" /> Integrity
														Issues
													</Badge>
												)}
											</div>
											<div className="grid grid-cols-2 gap-1">
												{integrityCheck.integrityChecks?.map((check, i) => (
													<div
														key={i}
														className="flex items-center gap-1 text-xs"
													>
														{check.passed ? (
															<CheckCircle2 className="h-3 w-3 text-green-500" />
														) : (
															<AlertTriangle className="h-3 w-3 text-red-500" />
														)}
														<span
															className={
																check.passed
																	? "text-muted-foreground"
																	: "text-red-600"
															}
														>
															{check.check.replace(/_/g, " ")}
														</span>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							)}
						</CardFooter>
					</Card>

					{/* Locked Strategy Display */}
					{isLocked && lockedStrategy?.snapshot && (
						<Card className="border-green-200 dark:border-green-800">
							<CardHeader className="pb-2">
								<CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
									<LucideShield className="h-4 w-4" />
									Locked Strategy Snapshot (v{lockedStrategy.versionNumber})
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-3 text-sm">
									<div>
										<Label className="text-xs text-muted-foreground">
											Mode
										</Label>
										<div className="font-medium">
											{lockedStrategy.snapshot.allocationMode === "AI_DRIVEN"
												? "AI-Driven"
												: "Manual"}
										</div>
									</div>
									<div>
										<Label className="text-xs text-muted-foreground">
											Locked At
										</Label>
										<div className="font-medium">
											{new Date(
												lockedStrategy.snapshot.lockedAt,
											).toLocaleDateString("en-IN")}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* TAB 2: Fair Backtest */}
				<TabsContent value="backtest" className="space-y-4 mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<BarChart3 className="h-5 w-5 text-primary" />
								Fair Historical Comparison
							</CardTitle>
							<CardDescription>
								Compare old vs proposed portfolio using common-period alignment.
								No tactical reallocation or AI reweighting.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!backtestResult ? (
								<div className="text-center py-6">
									<p className="text-sm text-muted-foreground mb-4">
										Run a fair backtest to compare your current holdings against
										the proposed allocation over the same time period.
									</p>
									<Button
										onClick={() => backtestMutation.mutate()}
										disabled={backtestMutation.isPending}
									>
										{backtestMutation.isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
												Running Backtest...
											</>
										) : (
											<>
												<BarChart3 className="h-4 w-4 mr-2" /> Run Fair Backtest
											</>
										)}
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									<div className="p-3 bg-muted/50 rounded-lg">
										<div className="text-xs text-muted-foreground mb-1">
											Common Period
										</div>
										<div className="font-medium text-sm">
											{backtestResult.commonPeriod.start} to{" "}
											{backtestResult.commonPeriod.end}
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										{/* Old Portfolio */}
										<div className="p-4 border rounded-lg">
											<div className="text-xs text-muted-foreground mb-2 uppercase font-medium">
												Current Portfolio
											</div>
											<div className="space-y-2">
												<div>
													<div className="text-xs text-muted-foreground">
														CAGR
													</div>
													<div className="text-lg font-bold">
														{backtestResult.oldMetrics.cagr}%
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Volatility
													</div>
													<div className="text-sm font-medium">
														{backtestResult.oldMetrics.volatility}%
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Max Drawdown
													</div>
													<div className="text-sm font-medium">
														{backtestResult.oldMetrics.maxDrawdown}%
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Sharpe Ratio
													</div>
													<div className="text-sm font-medium">
														{backtestResult.oldMetrics.sharpeRatio}
													</div>
												</div>
												<Separator />
												<div>
													<div className="text-xs text-muted-foreground">
														Growth of 10L
													</div>
													<div className="text-sm font-bold">
														₹
														{(
															backtestResult.oldMetrics.growthOf10L / 100000
														).toFixed(1)}
														L
													</div>
												</div>
											</div>
										</div>

										{/* Proposed Portfolio */}
										<div className="p-4 border rounded-lg border-primary/30 bg-primary/5">
											<div className="text-xs text-primary mb-2 uppercase font-medium">
												Proposed Portfolio
											</div>
											<div className="space-y-2">
												<div>
													<div className="text-xs text-muted-foreground">
														CAGR
													</div>
													<div className="text-lg font-bold flex items-center gap-1">
														{backtestResult.proposedMetrics.cagr}%
														<DeltaIndicator
															value={backtestResult.delta.cagrDifference}
															suffix="%"
															positive
														/>
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Volatility
													</div>
													<div className="text-sm font-medium flex items-center gap-1">
														{backtestResult.proposedMetrics.volatility}%
														<DeltaIndicator
															value={backtestResult.delta.volatilityDifference}
															suffix="%"
															positive={false}
														/>
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Max Drawdown
													</div>
													<div className="text-sm font-medium flex items-center gap-1">
														{backtestResult.proposedMetrics.maxDrawdown}%
														<DeltaIndicator
															value={backtestResult.delta.maxDrawdownDifference}
															suffix="%"
															positive={false}
														/>
													</div>
												</div>
												<div>
													<div className="text-xs text-muted-foreground">
														Sharpe Ratio
													</div>
													<div className="text-sm font-medium flex items-center gap-1">
														{backtestResult.proposedMetrics.sharpeRatio}
														<DeltaIndicator
															value={backtestResult.delta.sharpeImprovement}
															positive
														/>
													</div>
												</div>
												<Separator />
												<div>
													<div className="text-xs text-muted-foreground">
														Growth of 10L
													</div>
													<div className="text-sm font-bold text-primary">
														₹
														{(
															backtestResult.proposedMetrics.growthOf10L /
															100000
														).toFixed(1)}
														L
													</div>
												</div>
											</div>
										</div>
									</div>

									<Alert>
										<LucideShield className="h-4 w-4" />
										<AlertDescription className="text-xs">
											This comparison uses static allocation enforcement with no
											tactical reallocation, AI reweighting, or period
											optimization. Both portfolios are measured over the same
											common time window.
										</AlertDescription>
									</Alert>

									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setBacktestResult(null);
											backtestMutation.mutate();
										}}
									>
										<RefreshCw className="h-4 w-4 mr-2" /> Re-run Backtest
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* TAB 3: Portfolio Comparison */}
				<TabsContent value="comparison" className="space-y-4 mt-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base flex items-center gap-2">
								<Scale className="h-5 w-5 text-primary" />
								Portfolio Difference Summary
							</CardTitle>
							<CardDescription>
								Side-by-side allocation, risk, cost, and concentration
								comparison
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!differenceSummary ? (
								<div className="text-center py-6">
									<p className="text-sm text-muted-foreground mb-4">
										Generate a comprehensive comparison between current and
										proposed portfolios.
									</p>
									<Button
										onClick={() => differenceMutation.mutate()}
										disabled={differenceMutation.isPending}
									>
										{differenceMutation.isPending ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin mr-2" />{" "}
												Generating...
											</>
										) : (
											<>
												<Scale className="h-4 w-4 mr-2" /> Generate Comparison
											</>
										)}
									</Button>
								</div>
							) : (
								<div className="space-y-6">
									{/* Allocation Delta */}
									<div>
										<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
											<PieChart className="h-4 w-4" /> Allocation Changes
										</h4>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Asset Class</TableHead>
													<TableHead className="text-right">Current</TableHead>
													<TableHead className="text-right">Proposed</TableHead>
													<TableHead className="text-right">Change</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{differenceSummary.allocationDelta.map((d) => (
													<TableRow key={d.assetClass}>
														<TableCell className="font-medium">
															<div className="flex items-center gap-2">
																<div
																	className={`w-2 h-2 rounded-full ${ASSET_CLASS_COLORS[d.assetClass] || "bg-gray-500"}`}
																/>
																{ASSET_CLASS_LABELS[d.assetClass] ||
																	d.assetClass}
															</div>
														</TableCell>
														<TableCell className="text-right">
															{d.oldWeight.toFixed(1)}%
														</TableCell>
														<TableCell className="text-right">
															{d.proposedWeight.toFixed(1)}%
														</TableCell>
														<TableCell className="text-right">
															<span
																className={
																	d.change > 0
																		? "text-green-600"
																		: d.change < 0
																			? "text-red-600"
																			: "text-muted-foreground"
																}
															>
																{d.change > 0 ? "+" : ""}
																{d.change.toFixed(1)}%
															</span>
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>

									{/* Risk Metric Delta */}
									<div>
										<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
											<LucideShield className="h-4 w-4" /> Risk Metrics Impact
										</h4>
										<div className="grid grid-cols-1 gap-2">
											{differenceSummary.riskMetricDelta.map((r) => (
												<div
													key={r.metric}
													className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
												>
													<span className="text-sm font-medium">
														{r.metric}
													</span>
													<div className="flex items-center gap-4 text-sm">
														<span className="text-muted-foreground">
															{r.oldValue.toFixed(2)}
														</span>
														<ArrowRight className="h-3 w-3 text-muted-foreground" />
														<span className="font-medium">
															{r.proposedValue.toFixed(2)}
														</span>
														<Badge
															variant={
																r.impact === "Improved"
																	? "default"
																	: r.impact === "Worsened"
																		? "destructive"
																		: "secondary"
															}
															className="text-xs"
														>
															{r.impact}
														</Badge>
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Cost Delta */}
									<div>
										<h4 className="text-sm font-medium mb-2 flex items-center gap-2">
											<TrendingDown className="h-4 w-4" /> Cost Impact
										</h4>
										{differenceSummary.costDelta.map((c) => (
											<div
												key={c.category}
												className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
											>
												<span className="text-sm">{c.category}</span>
												<div className="flex items-center gap-3 text-sm">
													<span>{c.oldCost}%</span>
													<ArrowRight className="h-3 w-3" />
													<span className="font-medium">{c.proposedCost}%</span>
													{c.savings > 0 && (
														<Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 text-xs">
															Save {c.savings}%
														</Badge>
													)}
												</div>
											</div>
										))}
									</div>

									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setDifferenceSummary(null);
											differenceMutation.mutate();
										}}
									>
										<RefreshCw className="h-4 w-4 mr-2" /> Refresh Comparison
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

function DeltaIndicator({
	value,
	suffix = "",
	positive = true,
}: { value: number; suffix?: string; positive?: boolean }) {
	const isGood = positive ? value > 0 : value < 0;
	const isBad = positive ? value < 0 : value > 0;

	if (Math.abs(value) < 0.001) return null;

	return (
		<span
			className={`text-xs font-medium ${isGood ? "text-green-600" : isBad ? "text-red-500" : "text-muted-foreground"}`}
		>
			{value > 0 ? "+" : ""}
			{value.toFixed(2)}
			{suffix}
		</span>
	);
}
