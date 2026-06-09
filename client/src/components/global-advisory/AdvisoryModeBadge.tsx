import { Shield as LucideShield, BarChart3, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAdvisoryBadgeConfig } from "@/hooks/use-global-advisory";

interface AdvisoryModeBadgeProps {
	advisoryLevel: string;
	showIcon?: boolean;
	showTooltip?: boolean;
	size?: "sm" | "default" | "lg";
}

export function AdvisoryModeBadge({
	advisoryLevel,
	showIcon = true,
	showTooltip = true,
	size = "default",
}: AdvisoryModeBadgeProps) {
	const config = getAdvisoryBadgeConfig(advisoryLevel);

	const Icon =
		advisoryLevel === "FULL"
			? LucideShield
			: advisoryLevel === "ANALYTICS_ONLY"
				? BarChart3
				: AlertTriangle;

	const sizeClasses = {
		sm: "text-xs px-2 py-0.5",
		default: "text-sm px-2.5 py-0.5",
		lg: "text-base px-3 py-1",
	};

	const iconSizes = {
		sm: "h-3 w-3",
		default: "h-4 w-4",
		lg: "h-5 w-5",
	};

	const badge = (
		<Badge
			variant={config.variant}
			className={`${sizeClasses[size]} flex items-center gap-1`}
			data-testid={`advisory-badge-${advisoryLevel.toLowerCase()}`}
		>
			{showIcon && <Icon className={iconSizes[size]} />}
			{config.label}
		</Badge>
	);

	if (!showTooltip) {
		return badge;
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{badge}</TooltipTrigger>
				<TooltipContent className="max-w-xs">
					<p>{config.description}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

interface MarketHeaderBadgeProps {
	marketName: string;
	marketCode: string;
	advisoryLevel: string;
	flagEmoji?: string | null;
}

export function MarketHeaderBadge({
	marketName,
	marketCode,
	advisoryLevel,
	flagEmoji,
}: MarketHeaderBadgeProps) {
	return (
		<div
			className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
			data-testid="market-header-badge"
		>
			<span className="text-2xl">{flagEmoji || "🌐"}</span>
			<div className="flex-1">
				<div className="font-semibold">{marketName}</div>
				<div className="text-sm text-muted-foreground">{marketCode}</div>
			</div>
			<AdvisoryModeBadge advisoryLevel={advisoryLevel} size="lg" />
		</div>
	);
}
