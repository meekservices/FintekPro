import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AlertTriangle,
	ArrowRight,
	HelpCircle,
	IndianRupee,
	PieChart,
	RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PortfolioFund {
	mfIsin: string;
	name: string;
	portfolioWeight: number;
}

interface SIPRouting {
	fund: string;
	fundIsin: string;
	amount: number;
	overlapScore: number;
}

interface SIPRoutingResult {
	sipRouting: SIPRouting[];
	explanation: string;
	totalAllocated: number;
}

interface SIPRoutingVisualizationProps {
	existingPortfolio: PortfolioFund[];
	candidateFunds: string[];
	onRoutingChange?: (routing: SIPRouting[]) => void;
}

export function SIPRoutingVisualization({
	existingPortfolio,
	candidateFunds,
	onRoutingChange,
}: SIPRoutingVisualizationProps) {
	const [sipAmount, setSipAmount] = useState<number>(25000);
	const [isOptimizing, setIsOptimizing] = useState(false);

	const {
		data: routingResult,
		refetch,
		isFetching,
		error,
		isLoading,
	} = useQuery<SIPRoutingResult>({
		queryKey: [
			"/api/portfolio/optimize-sip",
			sipAmount,
			candidateFunds.join(","),
		],
		queryFn: async () => {
			const response = await fetch("/api/portfolio/optimize-sip", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sipAmount,
					candidateFunds,
					existingPortfolio,
				}),
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		enabled: candidateFunds.length > 0 && sipAmount > 0,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		if (routingResult && onRoutingChange) {
			onRoutingChange(routingResult.sipRouting);
		}
	}, [routingResult, onRoutingChange]);

	const handleOptimize = () => {
		setIsOptimizing(true);
		refetch().finally(() => setIsOptimizing(false));
	};

	const getOverlapColor = (score: number) => {
		if (score < 4) return "bg-green-500";
		if (score < 8) return "bg-amber-500";
		return "bg-red-500";
	};

	const getOverlapLabel = (score: number) => {
		if (score < 4) return "Low Overlap";
		if (score < 8) return "Moderate";
		return "High Overlap";
	};

	if (!candidateFunds.length) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<PieChart className="h-5 w-5 text-primary" />
						SIP Allocation Optimizer
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="p-4 bg-muted/50 rounded-lg text-center">
						<p className="text-sm text-muted-foreground">
							Select candidate funds to optimize SIP allocation.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-primary/20">
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<PieChart className="h-5 w-5 text-primary" />
					SIP Allocation Optimizer
				</CardTitle>
				<CardDescription>
					Smart allocation to minimize portfolio overlap
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-end gap-4">
					<div className="flex-1">
						<Label htmlFor="sip-amount" className="text-sm">
							Monthly SIP Amount
						</Label>
						<div className="relative mt-1">
							<IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="sip-amount"
								type="number"
								value={sipAmount}
								onChange={(e) => setSipAmount(Number(e.target.value))}
								className="pl-9"
								min={500}
								step={500}
							/>
						</div>
					</div>
					<Button
						onClick={handleOptimize}
						disabled={isFetching || isOptimizing}
					>
						<RefreshCw
							className={cn(
								"h-4 w-4 mr-2",
								(isFetching || isOptimizing) && "animate-spin",
							)}
						/>
						Optimize
					</Button>
				</div>

				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				) : error ? (
					<div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-red-500" />
							<p className="text-sm text-red-600 dark:text-red-400">
								Failed to optimize SIP allocation.
							</p>
						</div>
					</div>
				) : (
					routingResult &&
					routingResult.sipRouting.length > 0 && (
						<>
							<div className="space-y-3">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Recommended Allocation
								</h4>
								{routingResult.sipRouting.map((routing, idx) => {
									const percentage =
										(routing.amount / routingResult.totalAllocated) * 100;
									return (
										<div key={idx} className="space-y-2">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2 flex-1">
													<span className="text-sm font-medium truncate max-w-[200px]">
														{routing.fund}
													</span>
													<Badge
														variant="outline"
														className={cn(
															"text-xs",
															routing.overlapScore < 4
																? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
																: routing.overlapScore < 8
																	? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
																	: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
														)}
													>
														{getOverlapLabel(routing.overlapScore)}
													</Badge>
												</div>
												<div className="text-right">
													<span className="text-sm font-bold">
														₹{routing.amount.toLocaleString()}
													</span>
													<span className="text-xs text-muted-foreground ml-1">
														({percentage.toFixed(0)}%)
													</span>
												</div>
											</div>
											<div className="relative h-2 bg-muted rounded-full overflow-hidden">
												<div
													className={cn(
														"h-full transition-all",
														getOverlapColor(routing.overlapScore),
													)}
													style={{ width: `${percentage}%` }}
												/>
											</div>
										</div>
									);
								})}
							</div>

							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg cursor-help">
											<HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
											<p className="text-xs text-blue-700 dark:text-blue-300">
												<strong>Why this split?</strong>{" "}
												{routingResult.explanation}
											</p>
										</div>
									</TooltipTrigger>
									<TooltipContent side="bottom" className="max-w-sm">
										<p className="text-xs">
											Allocation is calculated to minimize incremental stock
											overlap with your existing holdings. Lower overlap funds
											receive proportionally higher SIP amounts.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>

							<div className="flex items-center justify-between pt-2 border-t">
								<span className="text-sm font-medium">Total Monthly SIP</span>
								<span className="text-lg font-bold text-primary">
									₹{routingResult.totalAllocated.toLocaleString()}
								</span>
							</div>
						</>
					)
				)}
			</CardContent>
		</Card>
	);
}

export default SIPRoutingVisualization;
