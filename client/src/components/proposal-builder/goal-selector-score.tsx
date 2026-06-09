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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	AlertTriangle,
	Target,
	TrendingUp,
	Briefcase,
	GraduationCap,
	Wallet,
	RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioFund {
	mfIsin: string;
	name: string;
	portfolioWeight: number;
}

type InvestmentGoal =
	| "WEALTH_CREATION"
	| "RETIREMENT"
	| "CHILD_EDUCATION"
	| "INCOME";

interface GoalBasedScore {
	score: number;
	grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	goal: string;
	riskAlignment: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	penalties: any[];
	goalAdjustments: {
		stockOverlapMultiplier: number;
		sectorPenaltyMultiplier: number;
	};
}

interface GoalSelectorScoreProps {
	funds: PortfolioFund[];
	initialGoal?: InvestmentGoal;
	onGoalChange?: (goal: InvestmentGoal) => void;
	onScoreChange?: (score: GoalBasedScore) => void;
}

const goalConfig: Record<
	InvestmentGoal,
	{ label: string; icon: typeof Target; description: string }
> = {
	WEALTH_CREATION: {
		label: "Wealth Creation",
		icon: TrendingUp,
		description: "Long-term growth with moderate risk tolerance",
	},
	RETIREMENT: {
		label: "Retirement",
		icon: Briefcase,
		description: "Capital preservation with stable returns",
	},
	CHILD_EDUCATION: {
		label: "Child Education",
		icon: GraduationCap,
		description: "Goal-dated savings with risk reduction over time",
	},
	INCOME: {
		label: "Regular Income",
		icon: Wallet,
		description: "Steady cash flow from investments",
	},
};

const gradeColors = {
	EXCELLENT:
		"text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
	GOOD: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
	FAIR: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
	POOR: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
};

export function GoalSelectorScore({
	funds,
	initialGoal = "WEALTH_CREATION",
	onGoalChange,
	onScoreChange,
}: GoalSelectorScoreProps) {
	const [selectedGoal, setSelectedGoal] = useState<InvestmentGoal>(initialGoal);

	const {
		data: scoreData,
		isLoading,
		isFetching,
		error,
	} = useQuery<GoalBasedScore>({
		queryKey: [
			"/api/portfolio/goal-based-score",
			selectedGoal,
			funds.map((f) => f.mfIsin).join(","),
		],
		queryFn: async () => {
			const response = await fetch("/api/portfolio/goal-based-score", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ funds, goal: selectedGoal }),
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.error);
			return result.data;
		},
		enabled: funds.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		if (scoreData && onScoreChange) {
			onScoreChange(scoreData);
		}
	}, [scoreData, onScoreChange]);

	const handleGoalChange = (goal: InvestmentGoal) => {
		setSelectedGoal(goal);
		if (onGoalChange) {
			onGoalChange(goal);
		}
	};

	const GoalIcon = goalConfig[selectedGoal].icon;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<Target className="h-5 w-5 text-primary" />
					Goal-Based Diversification
				</CardTitle>
				<CardDescription>
					Score adjusted for your investment objective
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div>
					<label className="text-sm font-medium mb-2 block">
						Investment Goal
					</label>
					<Select
						value={selectedGoal}
						onValueChange={(v) => handleGoalChange(v as InvestmentGoal)}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select goal" />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(goalConfig).map(([key, config]) => {
								const Icon = config.icon;
								return (
									<SelectItem key={key} value={key}>
										<div className="flex items-center gap-2">
											<Icon className="h-4 w-4" />
											<span>{config.label}</span>
										</div>
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground mt-1">
						{goalConfig[selectedGoal].description}
					</p>
				</div>

				{isLoading ? (
					<div className="flex items-center justify-center p-6">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : error ? (
					<div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
						<div className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-red-500" />
							<p className="text-sm text-red-600 dark:text-red-400">
								Failed to calculate goal-based score.
							</p>
						</div>
					</div>
				) : scoreData ? (
					<div className="space-y-4">
						<div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
							<div className="flex items-center gap-3">
								<div className="relative w-16 h-16">
									<svg
										className="w-full h-full transform -rotate-90"
										viewBox="0 0 100 100"
									>
										<circle
											cx="50"
											cy="50"
											r="40"
											fill="none"
											stroke="currentColor"
											strokeWidth="10"
											className="text-muted/30"
										/>
										<circle
											cx="50"
											cy="50"
											r="40"
											fill="none"
											stroke="currentColor"
											strokeWidth="10"
											strokeLinecap="round"
											strokeDasharray={`${scoreData.score * 2.51} 251`}
											className={cn(
												scoreData.score >= 75
													? "text-green-500"
													: scoreData.score >= 60
														? "text-blue-500"
														: scoreData.score >= 40
															? "text-amber-500"
															: "text-red-500",
											)}
										/>
									</svg>
									<div className="absolute inset-0 flex items-center justify-center">
										<span className="text-xl font-bold">{scoreData.score}</span>
									</div>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Diversification Score
									</p>
									<Badge
										variant="outline"
										className={cn("mt-1", gradeColors[scoreData.grade])}
									>
										{scoreData.grade}
									</Badge>
								</div>
							</div>
							<div className="text-right">
								<p className="text-sm text-muted-foreground">Risk Alignment</p>
								<Badge
									variant="outline"
									className={cn("mt-1", gradeColors[scoreData.riskAlignment])}
								>
									{scoreData.riskAlignment}
								</Badge>
							</div>
						</div>

						<div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
							<p className="text-xs text-blue-700 dark:text-blue-300">
								<strong>Score adjusted for {scoreData.goal} goal:</strong> Stock
								overlap penalties are multiplied by{" "}
								{scoreData.goalAdjustments.stockOverlapMultiplier}x, and sector
								concentration penalties by{" "}
								{scoreData.goalAdjustments.sectorPenaltyMultiplier}x.
							</p>
						</div>

						{scoreData.penalties.length > 0 && (
							<div className="space-y-2">
								<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
									Goal-Adjusted Penalties ({scoreData.penalties.length})
								</h4>
								<div className="max-h-24 overflow-y-auto space-y-1">
									{scoreData.penalties.slice(0, 3).map((penalty, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded"
										>
											<span className="truncate">{penalty.entity}</span>
											<span className="text-red-600 font-medium">
												{penalty.impact}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				) : (
					<div className="p-4 bg-muted/50 rounded-lg text-center">
						<p className="text-sm text-muted-foreground">
							Add portfolio holdings to calculate goal-based score.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default GoalSelectorScore;
