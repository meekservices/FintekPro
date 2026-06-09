import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	Shield as LucideShield,
	AlertTriangle,
	CheckCircle,
	Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskProfile {
	id: number;
	userId: number;
	panNumber: string;
	riskScore: number;
	riskTier: string;
	tierLabel: string;
	assessmentDate: string;
	validUntil: string;
	sebiOverrideApplied: boolean;
}

interface ProductEligibility {
	productType: string;
	isEligible: boolean;
	reason: string;
}

const RISK_TIER_COLORS: Record<string, string> = {
	RP1: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
	RP2: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
	RP3: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
	RP4: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
	RP5: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};

const RISK_TIER_LABELS: Record<string, string> = {
	RP1: "Conservative",
	RP2: "Moderately Conservative",
	RP3: "Moderate",
	RP4: "Moderately Aggressive",
	RP5: "Aggressive",
};

export function RiskProfileBadge({
	size = "default",
	showScore = false,
	className,
}: {
	size?: "small" | "default" | "large";
	showScore?: boolean;
	className?: string;
}) {
	const [, setLocation] = useLocation();
	const {
		data: profile,
		isLoading,
		error,
	} = useQuery<RiskProfile>({
		queryKey: ["/api/sebi-risk-profiling/my-profile"],
		retry: false,
	});

	if (isLoading) {
		return (
			<Badge variant="outline" className={cn("animate-pulse", className)}>
				<LucideShield className="h-3 w-3 mr-1" />
				Loading...
			</Badge>
		);
	}

	if (error || !profile) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className={cn("cursor-pointer hover:bg-muted", className)}
							onClick={() => setLocation("/risk-profiling")}
							data-testid="badge-no-risk-profile"
						>
							<AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
							Complete Risk Profile
						</Badge>
					</TooltipTrigger>
					<TooltipContent>
						<p>
							Complete your SEBI risk profiling to access all investment
							products
						</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	const isExpired = new Date(profile.validUntil) < new Date();
	const tierColor =
		RISK_TIER_COLORS[profile.riskTier] || "bg-muted text-foreground";

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						className={cn(
							tierColor,
							"cursor-pointer hover:opacity-80 transition-opacity",
							size === "small" && "text-xs py-0.5 px-1.5",
							size === "large" && "text-sm py-1.5 px-3",
							className,
						)}
						onClick={() => setLocation("/risk-profiling")}
						data-testid="badge-risk-profile"
					>
						<LucideShield
							className={cn(
								"mr-1",
								size === "small" && "h-3 w-3",
								size === "default" && "h-3.5 w-3.5",
								size === "large" && "h-4 w-4",
							)}
						/>
						{profile.riskTier}
						{showScore && ` (${profile.riskScore})`}
						{isExpired && (
							<AlertTriangle className="h-3 w-3 ml-1 text-amber-500" />
						)}
					</Badge>
				</TooltipTrigger>
				<TooltipContent>
					<div className="space-y-1">
						<p className="font-semibold">
							{profile.riskTier} - {RISK_TIER_LABELS[profile.riskTier]}
						</p>
						<p className="text-xs">Score: {profile.riskScore}/100</p>
						{isExpired ? (
							<p className="text-xs text-amber-500">
								Expired - Please reassess
							</p>
						) : (
							<p className="text-xs text-muted-foreground">
								Valid until {new Date(profile.validUntil).toLocaleDateString()}
							</p>
						)}
						{profile.sebiOverrideApplied && (
							<p className="text-xs text-orange-500">SEBI override applied</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function ProductSuitabilityIndicator({
	productType,
	className,
	showReason = true,
}: {
	productType: string;
	className?: string;
	showReason?: boolean;
}) {
	const { data: eligibility, isLoading } = useQuery<ProductEligibility[]>({
		queryKey: ["/api/sebi-risk-profiling/product-eligibility"],
		retry: false,
	});

	if (isLoading) {
		return (
			<Badge variant="outline" className={cn("animate-pulse", className)}>
				Checking...
			</Badge>
		);
	}

	const productEligibility = eligibility?.find(
		(e) => e.productType.toLowerCase() === productType.toLowerCase(),
	);

	if (!productEligibility) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className={cn(
								"text-amber-600 border-amber-200 dark:border-amber-800",
								className,
							)}
						>
							<AlertTriangle className="h-3 w-3 mr-1" />
							Profile Required
						</Badge>
					</TooltipTrigger>
					<TooltipContent>
						<p>Complete risk profiling to see eligibility</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	if (productEligibility.isEligible) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge
							variant="outline"
							className={cn(
								"text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20",
								className,
							)}
							data-testid={`suitability-eligible-${productType}`}
						>
							<CheckCircle className="h-3 w-3 mr-1" />
							Suitable
						</Badge>
					</TooltipTrigger>
					{showReason && (
						<TooltipContent>
							<p>{productEligibility.reason}</p>
						</TooltipContent>
					)}
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Badge
						variant="outline"
						className={cn(
							"text-red-600 border-red-200 bg-red-50 dark:bg-red-900/20",
							className,
						)}
						data-testid={`suitability-not-eligible-${productType}`}
					>
						<Lock className="h-3 w-3 mr-1" />
						Not Suitable
					</Badge>
				</TooltipTrigger>
				{showReason && (
					<TooltipContent>
						<p>{productEligibility.reason}</p>
					</TooltipContent>
				)}
			</Tooltip>
		</TooltipProvider>
	);
}

export function RiskGatedContent({
	productType,
	children,
	fallback,
}: {
	productType: string;
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const { data: eligibility, isLoading } = useQuery<ProductEligibility[]>({
		queryKey: ["/api/sebi-risk-profiling/product-eligibility"],
		retry: false,
	});

	if (isLoading) {
		return <div className="animate-pulse h-full bg-muted/30 rounded-lg" />;
	}

	const productEligibility = eligibility?.find(
		(e) => e.productType.toLowerCase() === productType.toLowerCase(),
	);

	if (!productEligibility || productEligibility.isEligible) {
		return <>{children}</>;
	}

	if (fallback) {
		return <>{fallback}</>;
	}

	return (
		<div className="relative">
			<div className="opacity-50 pointer-events-none">{children}</div>
			<div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
				<div className="text-center p-4">
					<Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
					<p className="font-medium">Not Suitable for Your Risk Profile</p>
					<p className="text-sm text-muted-foreground mt-1">
						{productEligibility.reason}
					</p>
				</div>
			</div>
		</div>
	);
}
