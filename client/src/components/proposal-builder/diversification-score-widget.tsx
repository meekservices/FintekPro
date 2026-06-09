import { useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AlertTriangle,
	CheckCircle2,
	Info,
	TrendingDown,
	Shield as LucideShield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DiversificationPenalty {
	type: "STOCK_OVERLAP" | "SECTOR_CONCENTRATION" | "FUND_CROWDING";
	entity: string;
	exposure?: number;
	fundCount?: number;
	impact: number;
	description: string;
}

interface DiversificationScoreData {
	score: number;
	grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	penalties: DiversificationPenalty[];
}

interface DiversificationScoreWidgetProps {
	data: DiversificationScoreData;
	compact?: boolean;
}

const gradeConfig = {
	EXCELLENT: {
		color: "text-green-600",
		bg: "bg-green-50 dark:bg-green-950/30",
		border: "border-green-200 dark:border-green-800",
		icon: CheckCircle2,
	},
	GOOD: {
		color: "text-blue-600",
		bg: "bg-blue-50 dark:bg-blue-950/30",
		border: "border-blue-200 dark:border-blue-800",
		icon: LucideShield,
	},
	FAIR: {
		color: "text-amber-600",
		bg: "bg-amber-50 dark:bg-amber-950/30",
		border: "border-amber-200 dark:border-amber-800",
		icon: AlertTriangle,
	},
	POOR: {
		color: "text-red-600",
		bg: "bg-red-50 dark:bg-red-950/30",
		border: "border-red-200 dark:border-red-800",
		icon: TrendingDown,
	},
};

export function DiversificationScoreWidget({
	data,
	compact = false,
}: DiversificationScoreWidgetProps) {
	const { score, grade, penalties } = data;
	const config = gradeConfig[grade];
	const GradeIcon = config.icon;

	const gaugeColor = useMemo(() => {
		if (score >= 75) return "bg-green-500";
		if (score >= 60) return "bg-blue-500";
		if (score >= 40) return "bg-amber-500";
		return "bg-red-500";
	}, [score]);

	const penaltySummary = useMemo(() => {
		const totalPenalty = penalties.reduce(
			(sum, p) => sum + Math.abs(p.impact),
			0,
		);
		const stockPenalties = penalties.filter(
			(p) => p.type === "STOCK_OVERLAP",
		).length;
		const sectorPenalties = penalties.filter(
			(p) => p.type === "SECTOR_CONCENTRATION",
		).length;
		const crowdingPenalties = penalties.filter(
			(p) => p.type === "FUND_CROWDING",
		).length;
		return { totalPenalty, stockPenalties, sectorPenalties, crowdingPenalties };
	}, [penalties]);

	if (compact) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"inline-flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-help",
								config.bg,
								config.border,
							)}
						>
							<GradeIcon className={cn("h-4 w-4", config.color)} />
							<span className={cn("font-bold text-sm", config.color)}>
								{score}
							</span>
							<span className="text-xs text-muted-foreground">/ 100</span>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-xs">
						<p className="font-medium mb-1">Diversification Score: {grade}</p>
						<p className="text-xs text-muted-foreground">
							Score reflects diversification after accounting for overlapping
							stocks and sectors.
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<Card className={cn("border-2", config.border)}>
			<CardHeader className={cn("pb-3", config.bg)}>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<LucideShield className={cn("h-5 w-5", config.color)} />
							Diversification Score
						</CardTitle>
						<CardDescription className="flex items-center gap-1">
							Portfolio concentration risk assessment
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
									</TooltipTrigger>
									<TooltipContent className="max-w-xs">
										<p className="text-xs">
											Score reflects diversification after accounting for
											overlapping stocks and sectors. Higher score = better
											diversification.
										</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</CardDescription>
					</div>
					<Badge
						variant="outline"
						className={cn(
							"text-lg font-bold px-3 py-1",
							config.color,
							config.bg,
							config.border,
						)}
					>
						{grade}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pt-4 space-y-4">
				<div className="flex items-center gap-4">
					<div className="relative w-24 h-24">
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
								strokeWidth="12"
								className="text-muted/30"
							/>
							<circle
								cx="50"
								cy="50"
								r="40"
								fill="none"
								stroke="currentColor"
								strokeWidth="12"
								strokeLinecap="round"
								strokeDasharray={`${score * 2.51} 251`}
								className={cn(
									score >= 75
										? "text-green-500"
										: score >= 60
											? "text-blue-500"
											: score >= 40
												? "text-amber-500"
												: "text-red-500",
								)}
							/>
						</svg>
						<div className="absolute inset-0 flex items-center justify-center">
							<span className={cn("text-2xl font-bold", config.color)}>
								{score}
							</span>
						</div>
					</div>
					<div className="flex-1 space-y-2">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">Base Score</span>
							<span className="font-medium">100</span>
						</div>
						{penaltySummary.totalPenalty > 0 && (
							<div className="flex justify-between text-sm">
								<span className="text-red-600">Total Penalties</span>
								<span className="font-medium text-red-600">
									-{penaltySummary.totalPenalty}
								</span>
							</div>
						)}
						<div className="h-px bg-border my-2" />
						<div className="flex justify-between text-sm font-medium">
							<span>Final Score</span>
							<span className={config.color}>{score}</span>
						</div>
					</div>
				</div>

				{penalties.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
							Penalty Breakdown
						</h4>
						<div className="space-y-1.5 max-h-32 overflow-y-auto">
							{penalties.slice(0, 5).map((penalty, idx) => (
								<div
									key={idx}
									className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
								>
									<div className="flex items-center gap-2 flex-1">
										<Badge
											variant="outline"
											className={cn(
												"text-xs px-1.5",
												penalty.type === "STOCK_OVERLAP"
													? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
													: penalty.type === "SECTOR_CONCENTRATION"
														? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800"
														: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
											)}
										>
											{penalty.type === "STOCK_OVERLAP"
												? "Stock"
												: penalty.type === "SECTOR_CONCENTRATION"
													? "Sector"
													: "Crowding"}
										</Badge>
										<span className="truncate">{penalty.entity}</span>
										{penalty.exposure && (
											<span className="text-muted-foreground">
												({penalty.exposure.toFixed(1)}%)
											</span>
										)}
									</div>
									<span className="font-medium text-red-600 ml-2">
										{penalty.impact}
									</span>
								</div>
							))}
							{penalties.length > 5 && (
								<p className="text-xs text-center text-muted-foreground">
									+{penalties.length - 5} more penalties
								</p>
							)}
						</div>
					</div>
				)}

				<div className="grid grid-cols-3 gap-2 pt-2">
					<div className="text-center p-2 bg-red-50 dark:bg-red-950/30 rounded">
						<div className="text-lg font-bold text-red-600">
							{penaltySummary.stockPenalties}
						</div>
						<div className="text-xs text-red-600/80">Stock Overlaps</div>
					</div>
					<div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
						<div className="text-lg font-bold text-purple-600">
							{penaltySummary.sectorPenalties}
						</div>
						<div className="text-xs text-purple-600/80">Sector Conc.</div>
					</div>
					<div className="text-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
						<div className="text-lg font-bold text-amber-600">
							{penaltySummary.crowdingPenalties}
						</div>
						<div className="text-xs text-amber-600/80">Fund Crowding</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default DiversificationScoreWidget;
