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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Calendar,
	IndianRupee,
	TrendingUp,
	RefreshCw,
	Clock,
	AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioFund {
	mfIsin: string;
	name: string;
	portfolioWeight: number;
	currentValue?: number;
}

interface MonthlySnapshot {
	month: number;
	totalInvested: number;
	diversificationScore: number;
	overlapReduction: number;
}

interface SIPSimulationResult {
	horizonMonths: number;
	totalInvested: number;
	diversificationScoreStart: number;
	diversificationScoreEnd: number;
	scoreImprovement: number;
	overlapReductionSummary: string;
	monthlySnapshots: MonthlySnapshot[];
	sipRouting: Array<{ fund: string; fundIsin: string; amount: number }>;
	riskDisclosure: string;
}

interface SIPSimulatorUIProps {
	existingPortfolio: PortfolioFund[];
	candidateFunds: string[];
	onSimulationComplete?: (result: SIPSimulationResult) => void;
}

export function SIPSimulatorUI({
	existingPortfolio,
	candidateFunds,
	onSimulationComplete,
}: SIPSimulatorUIProps) {
	const [sipAmount, setSipAmount] = useState<number>(25000);
	const [horizonMonths, setHorizonMonths] = useState<"6" | "12" | "24">("12");

	const {
		data: simulation,
		isLoading,
		isFetching,
		refetch,
		error,
	} = useQuery<SIPSimulationResult>({
		queryKey: [
			"/api/sip/simulate",
			sipAmount,
			horizonMonths,
			candidateFunds.join(","),
		],
		queryFn: async () => {
			const response = await fetch("/api/sip/simulate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sipAmount,
					candidateFunds,
					existingPortfolio,
					horizonMonths,
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
		if (simulation && onSimulationComplete) {
			onSimulationComplete(simulation);
		}
	}, [simulation, onSimulationComplete]);

	const getScoreColor = (score: number) => {
		if (score >= 75) return "text-green-600";
		if (score >= 60) return "text-blue-600";
		if (score >= 40) return "text-amber-600";
		return "text-red-600";
	};

	if (!candidateFunds.length) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base flex items-center gap-2">
						<Calendar className="h-5 w-5 text-primary" />
						SIP Impact Simulator
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="p-4 bg-muted/50 rounded-lg text-center">
						<p className="text-sm text-muted-foreground">
							Select SIP candidate funds to simulate impact over time.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<Calendar className="h-5 w-5 text-primary" />
					SIP Impact Simulator
				</CardTitle>
				<CardDescription>
					Project diversification improvement over time
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<Label htmlFor="sip-sim-amount" className="text-sm">
							Monthly SIP
						</Label>
						<div className="relative mt-1">
							<IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								id="sip-sim-amount"
								type="number"
								value={sipAmount}
								onChange={(e) => setSipAmount(Number(e.target.value))}
								className="pl-9"
								min={500}
								step={500}
							/>
						</div>
					</div>
					<div>
						<Label className="text-sm">Time Horizon</Label>
						<Tabs
							value={horizonMonths}
							onValueChange={(v) => setHorizonMonths(v as "6" | "12" | "24")}
							className="mt-1"
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger value="6" className="text-xs">
									6 mo
								</TabsTrigger>
								<TabsTrigger value="12" className="text-xs">
									12 mo
								</TabsTrigger>
								<TabsTrigger value="24" className="text-xs">
									24 mo
								</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>
				</div>

				<Button
					onClick={() => refetch()}
					disabled={isLoading || isFetching}
					className="w-full"
				>
					<RefreshCw
						className={cn(
							"h-4 w-4 mr-2",
							(isLoading || isFetching) && "animate-spin",
						)}
					/>
					Simulate SIP Impact
				</Button>

				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-20 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				) : error ? (
					<div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-red-500" />
							<p className="text-sm text-red-600 dark:text-red-400">
								Failed to run simulation. Please try again.
							</p>
						</div>
					</div>
				) : simulation ? (
					<div className="space-y-4">
						{/* Score comparison */}
						<div className="grid grid-cols-3 gap-3">
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
								<div className="text-lg font-bold">
									{simulation.horizonMonths}mo
								</div>
								<div className="text-xs text-muted-foreground">Horizon</div>
							</div>
							<div className="p-3 bg-muted/50 rounded-lg text-center">
								<IndianRupee className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
								<div className="text-lg font-bold">
									₹{(simulation.totalInvested / 100000).toFixed(1)}L
								</div>
								<div className="text-xs text-muted-foreground">Total SIP</div>
							</div>
							<div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
								<TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-600" />
								<div className="text-lg font-bold text-green-600">
									+{simulation.scoreImprovement}
								</div>
								<div className="text-xs text-green-600/80">Score Gain</div>
							</div>
						</div>

						{/* Before vs After */}
						<div className="p-4 border rounded-lg space-y-3">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-muted-foreground">
										Starting Score
									</p>
									<p
										className={cn(
											"text-2xl font-bold",
											getScoreColor(simulation.diversificationScoreStart),
										)}
									>
										{simulation.diversificationScoreStart}
									</p>
								</div>
								<TrendingUp className="h-6 w-6 text-green-500" />
								<div className="text-right">
									<p className="text-sm text-muted-foreground">
										Projected Score
									</p>
									<p
										className={cn(
											"text-2xl font-bold",
											getScoreColor(simulation.diversificationScoreEnd),
										)}
									>
										{simulation.diversificationScoreEnd}
									</p>
								</div>
							</div>
							<Progress
								value={simulation.diversificationScoreEnd}
								className="h-2"
							/>
						</div>

						{/* Monthly progress chart */}
						<div>
							<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
								Monthly Progress
							</h4>
							<div className="flex items-end gap-1 h-20">
								{simulation.monthlySnapshots.map((snapshot, idx) => {
									const height =
										((snapshot.diversificationScore -
											simulation.diversificationScoreStart) /
											Math.max(simulation.scoreImprovement, 1)) *
										100;
									return (
										<div
											key={idx}
											className="flex-1 bg-primary/20 rounded-t relative group cursor-pointer"
											style={{ height: `${Math.max(height, 5)}%` }}
										>
											<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover border rounded px-2 py-1 text-xs shadow-lg whitespace-nowrap z-10">
												Month {snapshot.month}: {snapshot.diversificationScore}
											</div>
										</div>
									);
								})}
							</div>
							<div className="flex justify-between text-xs text-muted-foreground mt-1">
								<span>Month 1</span>
								<span>Month {simulation.horizonMonths}</span>
							</div>
						</div>

						{/* Summary */}
						<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
							<p className="text-sm text-blue-700 dark:text-blue-300">
								{simulation.overlapReductionSummary}
							</p>
						</div>

						{/* Risk disclosure */}
						<div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200">
							<div className="flex items-start gap-2">
								<AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
								<p className="text-xs text-amber-600">
									{simulation.riskDisclosure}
								</p>
							</div>
						</div>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

export default SIPSimulatorUI;
