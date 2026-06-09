import { useMemo } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Activity, Eye, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiversificationDialClientProps {
	score: number;
	grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
	isClientMode?: boolean;
	onModeChange?: (isClient: boolean) => void;
	showToggle?: boolean;
}

const dialLabels = {
	poor: { range: [0, 40], label: "Poorly Diversified", color: "text-red-600" },
	moderate: {
		range: [40, 70],
		label: "Moderately Diversified",
		color: "text-amber-600",
	},
	well: {
		range: [70, 100],
		label: "Well Diversified",
		color: "text-green-600",
	},
};

export function DiversificationDialClient({
	score,
	grade,
	isClientMode = true,
	onModeChange,
	showToggle = true,
}: DiversificationDialClientProps) {
	const dialPosition = useMemo(() => {
		// Convert score (0-100) to angle (180 degrees sweep from -90 to 90)
		return (score / 100) * 180 - 90;
	}, [score]);

	const currentLabel = useMemo(() => {
		if (score < 40) return dialLabels.poor;
		if (score < 70) return dialLabels.moderate;
		return dialLabels.well;
	}, [score]);

	const arcColor = useMemo(() => {
		if (score >= 70) return "#22c55e"; // green-500
		if (score >= 40) return "#f59e0b"; // amber-500
		return "#ef4444"; // red-500
	}, [score]);

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<Activity className="h-5 w-5 text-primary" />
							{isClientMode ? "Portfolio Health" : "Diversification Score"}
						</CardTitle>
						<CardDescription>
							{isClientMode
								? "How spread out your investments are"
								: "Numeric score with penalty breakdown"}
						</CardDescription>
					</div>
					{showToggle && (
						<div className="flex items-center gap-2">
							<Label
								htmlFor="view-mode"
								className="text-xs text-muted-foreground"
							>
								<Eye className="h-3 w-3 inline mr-1" />
								View
							</Label>
							<Switch
								id="view-mode"
								checked={isClientMode}
								onCheckedChange={onModeChange}
							/>
							<Label htmlFor="view-mode" className="text-xs">
								<User className="h-3 w-3 inline mr-1" />
								Client
							</Label>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{isClientMode ? (
					<div className="flex flex-col items-center py-4">
						{/* Large dial visualization */}
						<div className="relative w-48 h-28 mb-6">
							{/* Background arc */}
							<svg viewBox="0 0 200 110" className="w-full h-full">
								{/* Gray background arc */}
								<path
									d="M 20 100 A 80 80 0 0 1 180 100"
									fill="none"
									stroke="#e5e7eb"
									strokeWidth="16"
									strokeLinecap="round"
								/>
								{/* Colored segments */}
								<path
									d="M 20 100 A 80 80 0 0 1 60 35"
									fill="none"
									stroke="#fecaca"
									strokeWidth="16"
									strokeLinecap="round"
								/>
								<path
									d="M 60 35 A 80 80 0 0 1 140 35"
									fill="none"
									stroke="#fde68a"
									strokeWidth="16"
								/>
								<path
									d="M 140 35 A 80 80 0 0 1 180 100"
									fill="none"
									stroke="#bbf7d0"
									strokeWidth="16"
									strokeLinecap="round"
								/>
								{/* Needle */}
								<g transform={`rotate(${dialPosition}, 100, 100)`}>
									<line
										x1="100"
										y1="100"
										x2="100"
										y2="30"
										stroke={arcColor}
										strokeWidth="4"
										strokeLinecap="round"
									/>
									<circle cx="100" cy="100" r="8" fill={arcColor} />
								</g>
							</svg>
						</div>

						{/* Labels */}
						<div className="flex justify-between w-full px-4 mb-4">
							<span className="text-xs text-red-500 font-medium">Poor</span>
							<span className="text-xs text-amber-500 font-medium">
								Moderate
							</span>
							<span className="text-xs text-green-500 font-medium">Good</span>
						</div>

						{/* Current status */}
						<div className="text-center">
							<p className={cn("text-xl font-bold", currentLabel.color)}>
								{currentLabel.label}
							</p>
							<p className="text-sm text-muted-foreground mt-1">
								Your investments are spread across different stocks and sectors
							</p>
						</div>
					</div>
				) : (
					/* Advisor view with numeric score */
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<div className="relative w-20 h-20">
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
											stroke={arcColor}
											strokeWidth="10"
											strokeLinecap="round"
											strokeDasharray={`${score * 2.51} 251`}
										/>
									</svg>
									<div className="absolute inset-0 flex items-center justify-center">
										<span className="text-2xl font-bold">{score}</span>
									</div>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Diversification Score
									</p>
									<Badge
										variant="outline"
										className={cn(
											"mt-1",
											grade === "EXCELLENT"
												? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
												: grade === "GOOD"
													? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
													: grade === "FAIR"
														? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
														: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
										)}
									>
										{grade}
									</Badge>
								</div>
							</div>
						</div>
						<div className="p-3 bg-muted/50 rounded-lg">
							<p className="text-xs text-muted-foreground">
								Score based on stock overlap penalties ({">"}10% = -15pts),
								sector concentration ({">"}30% = -10pts), and fund crowding (
								{">"}3 funds = -5pts each).
							</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export default DiversificationDialClient;
