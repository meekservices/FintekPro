import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Sparkles,
	TrendingUp,
	Shield as LucideShield,
	AlertTriangle,
	Info,
	ShoppingCart,
	ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EvaluatedProduct {
	product_id: string;
	product_type: string;
	name: string;
	issuer: string;
	risk_level: string;
	liquidity: string;
	investment_horizon: string;
	expected_return_band: { min: number; max: number };
	min_investment: number;
	current_price: number;
	yield_or_return: number;
	sector: string | null;
	suitability_score: number;
	risk_adjusted_score: number;
	rationale_inputs: {
		score_breakdown: {
			risk_alignment: number;
			horizon_alignment: number;
			return_potential: number;
			liquidity_match: number;
			quality_rating: number;
			sector_momentum: number;
		};
		key_factors: string[];
		risk_factors: string[];
		opportunity_factors: string[];
	};
}

interface AIRecommendationsProps {
	riskLevel?: string;
	productTypes?: string[];
	limit?: number;
	onAddToCart?: (product: EvaluatedProduct) => void;
	onViewDetails?: (product: EvaluatedProduct) => void;
	className?: string;
}

function ScoreIndicator({ score, label }: { score: number; label: string }) {
	const getScoreColor = (s: number) => {
		if (s >= 90)
			return "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30";
		if (s >= 75)
			return "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30";
		if (s >= 60)
			return "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30";
		return "text-muted-foreground bg-muted/30";
	};

	return (
		<div
			className={cn(
				"px-2 py-1 rounded-md text-sm font-medium",
				getScoreColor(score),
			)}
		>
			{label}: {score}
		</div>
	);
}

function ProductTypeIcon({ type }: { type: string }) {
	const icons: Record<string, string> = {
		STOCK: "📈",
		MF: "📊",
		BOND: "📑",
		REIT: "🏢",
		INVIT: "🏗️",
		IPO: "🚀",
		UNLISTED: "🔒",
		AIF: "💎",
		PMS: "👔",
		MLD: "💰",
	};
	return <span className="text-lg">{icons[type] || "📦"}</span>;
}

function AIRecommendationCard({
	product,
	onAddToCart,
	onViewDetails,
}: {
	product: EvaluatedProduct;
	onAddToCart?: (product: EvaluatedProduct) => void;
	onViewDetails?: (product: EvaluatedProduct) => void;
}) {
	const { score_breakdown, key_factors, risk_factors } =
		product.rationale_inputs;

	const getRiskBadgeVariant = (risk: string) => {
		switch (risk.toLowerCase()) {
			case "conservative":
				return "default";
			case "moderate":
				return "secondary";
			case "aggressive":
				return "destructive";
			default:
				return "outline";
		}
	};

	return (
		<Card className="hover:shadow-md transition-shadow">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-2">
						<ProductTypeIcon type={product.product_type} />
						<div>
							<CardTitle className="text-base line-clamp-1">
								{product.name}
							</CardTitle>
							<CardDescription className="text-xs">
								{product.issuer}
							</CardDescription>
						</div>
					</div>
					<div className="flex items-center gap-1">
						<Sparkles className="h-4 w-4 text-amber-500" />
						<span className="text-sm font-bold text-amber-600">
							{product.suitability_score}
						</span>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-wrap gap-1">
					<Badge
						variant={getRiskBadgeVariant(product.risk_level)}
						className="text-xs"
					>
						{product.risk_level}
					</Badge>
					<Badge variant="outline" className="text-xs">
						{product.product_type}
					</Badge>
					{product.sector && (
						<Badge variant="secondary" className="text-xs">
							{product.sector}
						</Badge>
					)}
				</div>

				<div className="grid grid-cols-2 gap-2 text-sm">
					<div>
						<span className="text-muted-foreground">Min Investment</span>
						<p className="font-medium">
							₹{product.min_investment.toLocaleString()}
						</p>
					</div>
					<div>
						<span className="text-muted-foreground">Expected Return</span>
						<p className="font-medium text-green-600">
							{product.expected_return_band.min}% -{" "}
							{product.expected_return_band.max}%
						</p>
					</div>
				</div>

				{key_factors.length > 0 && (
					<div className="flex items-start gap-1 text-xs text-green-600">
						<TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />
						<span className="line-clamp-1">{key_factors.join(", ")}</span>
					</div>
				)}

				{risk_factors.length > 0 && (
					<div className="flex items-start gap-1 text-xs text-amber-600">
						<AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
						<span className="line-clamp-1">{risk_factors.join(", ")}</span>
					</div>
				)}

				<div className="flex gap-2 pt-2">
					<Button
						size="sm"
						variant="outline"
						className="flex-1"
						onClick={() => onViewDetails?.(product)}
						data-testid={`btn-view-details-${product.product_id}`}
					>
						<Info className="h-3 w-3 mr-1" />
						Details
					</Button>
					<Button
						size="sm"
						className="flex-1"
						onClick={() => onAddToCart?.(product)}
						data-testid={`btn-add-cart-${product.product_id}`}
					>
						<ShoppingCart className="h-3 w-3 mr-1" />
						Add
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function LoadingSkeleton() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{[1, 2, 3].map((i) => (
				<Card key={i}>
					<CardHeader className="pb-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-6 w-6 rounded" />
							<div className="flex-1">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-1/2 mt-1" />
							</div>
							<Skeleton className="h-5 w-10" />
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex gap-1">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-12" />
						</div>
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-8 w-full" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export function AIRecommendations({
	riskLevel = "moderate",
	productTypes,
	limit = 6,
	onAddToCart,
	onViewDetails,
	className,
}: AIRecommendationsProps) {
	const queryParams = new URLSearchParams({
		riskLevel,
		limit: limit.toString(),
	});

	if (productTypes && productTypes.length > 0) {
		queryParams.set("productTypes", productTypes.join(","));
	}

	const { data, isLoading, error, refetch } = useQuery<{
		success: boolean;
		recommendations: EvaluatedProduct[];
		meta: { risk_level: string; count: number };
	}>({
		queryKey: ["/api/ai-recommendations/quick", riskLevel, productTypes, limit],
		queryFn: async () => {
			const params = new URLSearchParams({
				riskLevel,
				limit: limit.toString(),
			});
			if (productTypes && productTypes.length > 0) {
				params.set("productTypes", productTypes.join(","));
			}
			const response = await fetch(`/api/ai-recommendations/quick?${params}`);
			if (!response.ok) throw new Error("Failed to fetch recommendations");
			return response.json();
		},
		staleTime: 5 * 60 * 1000,
		refetchInterval: 10 * 60 * 1000,
	});

	if (isLoading) {
		return (
			<div className={className}>
				<div className="flex items-center gap-2 mb-4">
					<Sparkles className="h-5 w-5 text-amber-500" />
					<h2 className="text-lg font-semibold">AI-Powered Recommendations</h2>
				</div>
				<LoadingSkeleton />
			</div>
		);
	}

	if (error || !data?.success) {
		return (
			<div className={cn("p-4 border rounded-lg bg-muted/50", className)}>
				<div className="flex items-center gap-2 text-muted-foreground">
					<AlertTriangle className="h-5 w-5" />
					<span>
						Unable to load AI recommendations. Please try again later.
					</span>
				</div>
			</div>
		);
	}

	const recommendations = data.recommendations || [];

	if (recommendations.length === 0) {
		return (
			<div className={cn("p-4 border rounded-lg bg-muted/50", className)}>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Info className="h-5 w-5" />
					<span>
						No recommendations available for your profile at this time.
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className={className}>
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<Sparkles className="h-5 w-5 text-amber-500" />
					<h2 className="text-lg font-semibold">AI-Powered Recommendations</h2>
					<Badge variant="secondary" className="text-xs">
						{recommendations.length} products
					</Badge>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => refetch()}
					data-testid="btn-refresh-recommendations"
				>
					<ChevronRight className="h-4 w-4" />
					View All
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{recommendations.map((product) => (
					<AIRecommendationCard
						key={product.product_id}
						product={product}
						onAddToCart={onAddToCart}
						onViewDetails={onViewDetails}
					/>
				))}
			</div>
		</div>
	);
}
