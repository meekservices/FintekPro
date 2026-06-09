import { formatDistanceToNow } from "date-fns";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface StaleDataIndicatorProps {
	lastUpdated: Date | string | null | undefined;
	staleThresholdMinutes?: number;
	warningThresholdMinutes?: number;
	showLabel?: boolean;
	className?: string;
}

export function StaleDataIndicator({
	lastUpdated,
	staleThresholdMinutes = 60,
	warningThresholdMinutes = 30,
	showLabel = false,
	className,
}: StaleDataIndicatorProps) {
	const parseDate = (date: Date | string | null | undefined): Date | null => {
		if (!date) return null;
		const parsed = typeof date === "string" ? new Date(date) : date;
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed;
	};

	const updateDate = parseDate(lastUpdated);

	if (!updateDate) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"flex items-center gap-1 text-xs text-muted-foreground",
								className,
							)}
							data-testid="stale-indicator-unknown"
						>
							<Clock className="h-3 w-3" />
							{showLabel && <span>Unknown</span>}
						</div>
					</TooltipTrigger>
					<TooltipContent>
						<p>Last update time unknown</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	const minutesSinceUpdate = (Date.now() - updateDate.getTime()) / (1000 * 60);

	const isStale = minutesSinceUpdate >= staleThresholdMinutes;
	const isWarning = minutesSinceUpdate >= warningThresholdMinutes && !isStale;
	const isFresh = !isStale && !isWarning;

	const timeAgo = formatDistanceToNow(updateDate, { addSuffix: true });

	const getStatusConfig = () => {
		if (isStale) {
			return {
				icon: AlertTriangle,
				color: "text-orange-600 dark:text-orange-400",
				bgColor: "bg-orange-100 dark:bg-orange-900/20",
				label: "Data may be outdated",
				testId: "stale-indicator-stale",
			};
		}
		if (isWarning) {
			return {
				icon: Clock,
				color: "text-yellow-600 dark:text-yellow-400",
				bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
				label: "Updated recently",
				testId: "stale-indicator-warning",
			};
		}
		return {
			icon: CheckCircle,
			color: "text-green-600 dark:text-green-400",
			bgColor: "bg-green-100 dark:bg-green-900/20",
			label: "Fresh data",
			testId: "stale-indicator-fresh",
		};
	};

	const config = getStatusConfig();
	const Icon = config.icon;

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"flex items-center gap-1.5 text-xs",
							config.color,
							className,
						)}
						data-testid={config.testId}
					>
						<div
							className={cn(
								"p-0.5 rounded-full",
								isFresh ? "" : config.bgColor,
							)}
						>
							<Icon className="h-3 w-3" />
						</div>
						{showLabel && <span className="font-medium">{timeAgo}</span>}
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<div className="text-xs">
						<p className="font-medium">{config.label}</p>
						<p className="text-muted-foreground">Updated {timeAgo}</p>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function DataFreshnessBar({
	lastUpdated,
	className,
}: {
	lastUpdated: Date | string | null | undefined;
	className?: string;
}) {
	if (!lastUpdated) return null;

	const updateDate =
		typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;
	if (Number.isNaN(updateDate.getTime())) return null;

	const minutesSinceUpdate = Math.min(
		(Date.now() - updateDate.getTime()) / (1000 * 60),
		60,
	);
	const freshnessPercent = Math.max(0, 100 - (minutesSinceUpdate / 60) * 100);

	return (
		<div className={cn("w-full", className)} data-testid="data-freshness-bar">
			<div className="h-1 bg-muted rounded-full overflow-hidden">
				<div
					className={cn(
						"h-full transition-all duration-300",
						freshnessPercent > 66
							? "bg-green-500"
							: freshnessPercent > 33
								? "bg-yellow-500"
								: "bg-orange-500",
					)}
					style={{ width: `${freshnessPercent}%` }}
				/>
			</div>
		</div>
	);
}
