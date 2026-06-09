import { useState, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
	RefreshCw,
	Sparkles,
	ArrowRight,
	CheckCircle,
	Loader2,
	Scale,
	ExternalLink,
	Info,
	Building2,
	Globe,
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	ArrowRightLeft,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
	usePortfoliosByPan,
	useEnhancedPortfolioHoldings,
} from "@/hooks/use-portfolio";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface UnifiedHolding {
	id: string;
	symbol: string;
	name: string;
	assetType: string;
	quantity: number;
	currentValue: number;
	source: "FINTEKPRO" | "CDSL" | "NSDL" | "UPLOADED";
	isin?: string;
}

interface RebalanceSuggestion {
	assetType: string;
	action: "buy" | "sell" | "hold";
	amount: number;
	holdings: {
		symbol: string;
		source: "FINTEKPRO" | "CDSL" | "NSDL" | "UPLOADED";
		currentValue: number;
		suggestedChange: number;
		actionType: "executable" | "transfer_suggested" | "advisory_only";
	}[];
}

export default function PortfolioRebalancing() {
	const { toast } = useToast();
	const { user } = useAuth();
	const [isGenerating, setIsGenerating] = useState(false);
	const [includeExternal, setIncludeExternal] = useState(true);

	const { data: portfolios, isLoading: portfoliosLoading } =
		usePortfoliosByPan();
	const portfolioId = portfolios?.[0]?.id || "";

	const { data: internalHoldingsRaw, isLoading: holdingsLoading } =
		useEnhancedPortfolioHoldings(portfolioId);

	const { data: externalHoldingsRaw } = useQuery({
		queryKey: ["/api/portfolio/external-holdings"],
		enabled: !!user?.id && includeExternal,
	});

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-IN", {
			style: "currency",
			currency: "INR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	};

	const unifiedHoldings = useMemo((): UnifiedHolding[] => {
		const holdings: UnifiedHolding[] = [];

		if (internalHoldingsRaw && Array.isArray(internalHoldingsRaw)) {
			internalHoldingsRaw.forEach((h: any) => {
				holdings.push({
					id: h.id || `internal-${h.symbol}`,
					symbol: h.symbol || h.name,
					name: h.name || h.symbol,
					assetType: h.assetType || "Other",
					quantity: Number.parseFloat(h.quantity || "0"),
					currentValue: Number.parseFloat(h.currentValue || "0"),
					source: "FINTEKPRO",
					isin: h.isin,
				});
			});
		}

		if (includeExternal && externalHoldingsRaw) {
			const extHoldings = (externalHoldingsRaw as any)?.holdings || [];
			extHoldings.forEach((h: any) => {
				holdings.push({
					id: h.id || `external-${h.symbol}`,
					symbol: h.symbol || h.name,
					name: h.name || h.symbol,
					assetType: h.assetType || "Other",
					quantity: h.quantity || 0,
					currentValue: h.currentValue || 0,
					source: h.source || "CDSL",
					isin: h.isin,
				});
			});
		}

		return holdings;
	}, [internalHoldingsRaw, externalHoldingsRaw, includeExternal]);

	const {
		internalCount,
		externalCount,
		totalInternalValue,
		totalExternalValue,
		totalPortfolioValue,
	} = useMemo(() => {
		const internal = unifiedHoldings.filter((h) => h.source === "FINTEKPRO");
		const external = unifiedHoldings.filter((h) => h.source !== "FINTEKPRO");

		const internalValue = internal.reduce((sum, h) => sum + h.currentValue, 0);
		const externalValue = external.reduce((sum, h) => sum + h.currentValue, 0);

		return {
			internalCount: internal.length,
			externalCount: external.length,
			totalInternalValue: internalValue,
			totalExternalValue: externalValue,
			totalPortfolioValue: internalValue + externalValue,
		};
	}, [unifiedHoldings]);

	const targetAllocation: Record<string, number> = {
		Equity: 60,
		Debt: 25,
		Gold: 10,
		Other: 5,
	};

	const { allocationByAssetType, rebalanceSuggestions } = useMemo(() => {
		const allocation: Record<
			string,
			{
				internal: number;
				external: number;
				total: number;
				holdings: UnifiedHolding[];
			}
		> = {};

		unifiedHoldings.forEach((h) => {
			const type = h.assetType || "Other";
			if (!allocation[type]) {
				allocation[type] = { internal: 0, external: 0, total: 0, holdings: [] };
			}

			if (h.source === "FINTEKPRO") {
				allocation[type].internal += h.currentValue;
			} else {
				allocation[type].external += h.currentValue;
			}
			allocation[type].total += h.currentValue;
			allocation[type].holdings.push(h);
		});

		const suggestions: RebalanceSuggestion[] = [];

		Object.entries(allocation).forEach(([assetType, data]) => {
			const currentPercent =
				totalPortfolioValue > 0 ? (data.total / totalPortfolioValue) * 100 : 0;
			const target = targetAllocation[assetType] || 0;
			const drift = currentPercent - target;
			const amountChange = (drift / 100) * totalPortfolioValue;

			if (Math.abs(drift) >= 2) {
				const holdingSuggestions = data.holdings.map((h) => {
					const proportion = data.total > 0 ? h.currentValue / data.total : 0;
					const suggestedChange = proportion * amountChange;

					let actionType: "executable" | "transfer_suggested" | "advisory_only";
					if (h.source === "FINTEKPRO") {
						actionType = "executable";
					} else if (drift > 0) {
						actionType = "transfer_suggested";
					} else {
						actionType = "advisory_only";
					}

					return {
						symbol: h.symbol,
						source: h.source,
						currentValue: h.currentValue,
						suggestedChange,
						actionType,
					};
				});

				suggestions.push({
					assetType,
					action: drift > 0 ? "sell" : "buy",
					amount: Math.abs(amountChange),
					holdings: holdingSuggestions,
				});
			}
		});

		return {
			allocationByAssetType: allocation,
			rebalanceSuggestions: suggestions,
		};
	}, [unifiedHoldings, totalPortfolioValue, targetAllocation]);

	const generateRebalanceMutation = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("/api/ai/generate-rebalance-proposal", {
				method: "POST",
				body: JSON.stringify({
					type: "rebalancing",
					includeExternal,
					portfolioId,
					unifiedHoldings: unifiedHoldings.map((h) => ({
						symbol: h.symbol,
						assetType: h.assetType,
						currentValue: h.currentValue,
						source: h.source,
					})),
					requestedAt: new Date().toISOString(),
				}),
			});
			return response;
		},
		onSuccess: () => {
			toast({
				title: "Rebalance Proposal Generated",
				description: includeExternal
					? "AI has created a unified rebalancing proposal. Check My Proposals to review."
					: "AI has created a rebalancing proposal. Check My Proposals to review.",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
			setIsGenerating(false);
		},
		onError: () => {
			toast({
				title: "Generation Failed",
				description:
					"Unable to generate rebalancing proposal. Please try again.",
				variant: "destructive",
			});
			setIsGenerating(false);
		},
	});

	const handleExecute = () => {
		setIsGenerating(true);
		generateRebalanceMutation.mutate();
	};

	const getSourceBadge = (source: string) => {
		switch (source) {
			case "FINTEKPRO":
				return (
					<Badge
						variant="outline"
						className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 text-xs"
					>
						<Building2 className="w-3 h-3 mr-1" />
						FintekPro
					</Badge>
				);
			case "CDSL":
				return (
					<Badge
						variant="outline"
						className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 text-xs"
					>
						CDSL
					</Badge>
				);
			case "NSDL":
				return (
					<Badge
						variant="outline"
						className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-xs"
					>
						NSDL
					</Badge>
				);
			case "UPLOADED":
				return (
					<Badge
						variant="outline"
						className="bg-muted text-muted-foreground border-border text-xs"
					>
						Uploaded
					</Badge>
				);
			default:
				return (
					<Badge variant="outline" className="text-xs">
						{source}
					</Badge>
				);
		}
	};

	const getActionBadge = (actionType: string) => {
		switch (actionType) {
			case "executable":
				return (
					<Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
						<CheckCircle className="w-3 h-3 mr-1" />
						Execute
					</Badge>
				);
			case "transfer_suggested":
				return (
					<Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
						<ArrowRightLeft className="w-3 h-3 mr-1" />
						Transfer First
					</Badge>
				);
			case "advisory_only":
				return (
					<Badge className="bg-muted text-muted-foreground text-xs">
						<Info className="w-3 h-3 mr-1" />
						Advisory
					</Badge>
				);
			default:
				return null;
		}
	};

	const isLoading = portfoliosLoading || holdingsLoading;

	if (isLoading) {
		return (
			<div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-32 w-full" />
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
						<Scale className="w-6 h-6 text-purple-600" />
						AI Rebalancing
					</h1>
					<p className="text-muted-foreground">
						Optimize your unified portfolio allocation with AI recommendations
					</p>
				</div>
				<Button
					size="lg"
					onClick={handleExecute}
					disabled={isGenerating}
					className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
					data-testid="button-execute-rebalance"
				>
					{isGenerating ? (
						<>
							<Loader2 className="w-5 h-5 mr-2 animate-spin" />
							Analyzing...
						</>
					) : (
						<>
							<Sparkles className="w-5 h-5 mr-2" />
							Generate Rebalance Plan
						</>
					)}
				</Button>
			</div>

			<Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
				<CardContent className="p-4">
					<div className="flex flex-col lg:flex-row lg:items-center gap-4">
						<div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full shrink-0">
							<RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />
						</div>
						<div className="flex-1">
							<h3 className="font-semibold text-purple-900 dark:text-purple-100">
								Smart Unified Rebalancing
							</h3>
							<p className="text-sm text-purple-700 dark:text-purple-300">
								AI analyzes your complete portfolio including external holdings
								and suggests optimal rebalancing
							</p>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<CheckCircle className="w-4 h-4 text-green-500" />
							<span>Review Trades</span>
							<ArrowRight className="w-4 h-4" />
							<span>Approve</span>
							<ArrowRight className="w-4 h-4" />
							<span>Execute</span>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Globe className="w-5 h-5" />
						Portfolio Scope
					</CardTitle>
					<CardDescription>
						Select which holdings to include in rebalancing analysis
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div className="flex items-center space-x-3">
							<Switch
								id="include-external"
								checked={includeExternal}
								onCheckedChange={setIncludeExternal}
								data-testid="switch-include-external"
							/>
							<Label
								htmlFor="include-external"
								className="flex items-center gap-2 cursor-pointer"
							>
								<ExternalLink className="w-4 h-4" />
								Include External Holdings
								<Tooltip>
									<TooltipTrigger>
										<Info className="w-4 h-4 text-muted-foreground" />
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p>
											Include holdings from CDSL, NSDL, or uploaded statements.
											External holdings require transfer to FintekPro for
											execution.
										</p>
									</TooltipContent>
								</Tooltip>
							</Label>
						</div>

						<div className="flex items-center gap-4">
							<Badge
								variant="outline"
								className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
							>
								<Building2 className="w-3 h-3 mr-1" />
								FintekPro: {internalCount} ({formatCurrency(totalInternalValue)}
								)
							</Badge>
							{includeExternal && externalCount > 0 && (
								<Badge
									variant="outline"
									className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
								>
									<ExternalLink className="w-3 h-3 mr-1" />
									External: {externalCount} (
									{formatCurrency(totalExternalValue)})
								</Badge>
							)}
						</div>
					</div>

					{includeExternal && externalCount > 0 && (
						<>
							<Separator className="my-4" />
							<div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
								<div className="flex items-start gap-3">
									<AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
									<div>
										<h4 className="font-medium text-amber-900 dark:text-amber-100">
											External Holdings Notice
										</h4>
										<p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
											External holdings (CDSL/NSDL) cannot be traded directly
											through FintekPro. Recommendations will be tagged as:
										</p>
										<div className="flex flex-wrap gap-2 mt-2">
											<Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
												<CheckCircle className="w-3 h-3 mr-1" />
												Execute
											</Badge>
											<span className="text-xs text-amber-700 dark:text-amber-300">
												- FintekPro holdings, can execute directly
											</span>
										</div>
										<div className="flex flex-wrap gap-2 mt-1">
											<Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
												<ArrowRightLeft className="w-3 h-3 mr-1" />
												Transfer First
											</Badge>
											<span className="text-xs text-amber-700 dark:text-amber-300">
												- Transfer to FintekPro before selling
											</span>
										</div>
										<div className="flex flex-wrap gap-2 mt-1">
											<Badge className="bg-muted text-muted-foreground text-xs">
												<Info className="w-3 h-3 mr-1" />
												Advisory
											</Badge>
											<span className="text-xs text-amber-700 dark:text-amber-300">
												- Information only, execute at your broker
											</span>
										</div>
									</div>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Current vs Target Allocation</CardTitle>
						<CardDescription>
							{includeExternal
								? "Unified portfolio"
								: "FintekPro holdings only"}{" "}
							compared to optimal allocation
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{Object.entries(allocationByAssetType).map(
								([assetType, data]) => {
									const currentPercent =
										totalPortfolioValue > 0
											? (data.total / totalPortfolioValue) * 100
											: 0;
									const target = targetAllocation[assetType] || 0;
									const drift = currentPercent - target;

									return (
										<div key={assetType} className="space-y-2">
											<div className="flex justify-between items-center">
												<div className="flex items-center gap-2">
													<span className="font-medium">{assetType}</span>
													{data.external > 0 && includeExternal && (
														<Badge
															variant="outline"
															className="text-xs bg-blue-50 dark:bg-blue-950/30"
														>
															+External
														</Badge>
													)}
												</div>
												<div className="flex items-center gap-2">
													<span className="text-sm">
														{currentPercent.toFixed(1)}%
													</span>
													<span className="text-xs text-muted-foreground">
														/ {target}%
													</span>
													{Math.abs(drift) > 5 && (
														<Badge
															variant={drift > 0 ? "destructive" : "secondary"}
															className="text-xs"
														>
															{drift > 0 ? (
																<TrendingUp className="w-3 h-3 mr-1" />
															) : (
																<TrendingDown className="w-3 h-3 mr-1" />
															)}
															{drift > 0 ? "+" : ""}
															{drift.toFixed(1)}%
														</Badge>
													)}
												</div>
											</div>
											<div className="relative h-3 bg-secondary rounded-full overflow-hidden">
												{data.internal > 0 && (
													<div
														className="absolute h-full bg-green-500"
														style={{
															width: `${(data.internal / totalPortfolioValue) * 100}%`,
														}}
													/>
												)}
												{data.external > 0 && includeExternal && (
													<div
														className="absolute h-full bg-blue-500"
														style={{
															left: `${(data.internal / totalPortfolioValue) * 100}%`,
															width: `${(data.external / totalPortfolioValue) * 100}%`,
														}}
													/>
												)}
												<div
													className="absolute h-full w-0.5 bg-foreground z-10"
													style={{ left: `${target}%` }}
												/>
											</div>
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>{formatCurrency(data.total)}</span>
												<div className="flex gap-2">
													<span className="text-green-600">
														Internal: {formatCurrency(data.internal)}
													</span>
													{data.external > 0 && includeExternal && (
														<span className="text-blue-600">
															External: {formatCurrency(data.external)}
														</span>
													)}
												</div>
											</div>
										</div>
									);
								},
							)}

							{Object.keys(allocationByAssetType).length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									<Scale className="w-12 h-12 mx-auto mb-4 opacity-50" />
									<p>No holdings to analyze</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Rebalancing Suggestions</CardTitle>
						<CardDescription>
							Holding-level recommendations with action types
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{rebalanceSuggestions.map((suggestion) => (
								<div
									key={suggestion.assetType}
									className="border rounded-lg p-4"
								>
									<div className="flex items-center justify-between mb-3">
										<div className="flex items-center gap-2">
											<span className="font-semibold">
												{suggestion.assetType}
											</span>
											<Badge
												variant={
													suggestion.action === "sell"
														? "destructive"
														: "default"
												}
											>
												{suggestion.action === "sell" ? "Reduce" : "Increase"}
											</Badge>
										</div>
										<span className="font-medium">
											{formatCurrency(suggestion.amount)}
										</span>
									</div>

									<div className="space-y-2">
										{suggestion.holdings.map((holding, idx) => (
											<div
												key={idx}
												className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
											>
												<div className="flex items-center gap-2">
													<span className="font-medium">{holding.symbol}</span>
													{getSourceBadge(holding.source)}
												</div>
												<div className="flex items-center gap-2">
													<span
														className={
															holding.suggestedChange > 0
																? "text-red-600"
																: "text-green-600"
														}
													>
														{holding.suggestedChange > 0 ? "-" : "+"}
														{formatCurrency(Math.abs(holding.suggestedChange))}
													</span>
													{getActionBadge(holding.actionType)}
												</div>
											</div>
										))}
									</div>
								</div>
							))}

							{rebalanceSuggestions.length === 0 && (
								<div className="text-center py-8">
									<CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
									<h3 className="font-semibold">Portfolio is Well-Balanced</h3>
									<p className="text-sm text-muted-foreground">
										All allocations are within target range
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
