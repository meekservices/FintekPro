import { ScrollArea } from "@/components/ui/scroll-area";
import {
	MessageCircle,
	Lightbulb,
	TrendingUp,
	TrendingDown,
	RefreshCw,
	AlertTriangle,
} from "lucide-react";
import { PiChatSummary } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PiChatInsights = {
	allocation?: string;
	totalValue?: number;
	expectedReturn?: string;
	riskLevel?: string;
	opportunities?: string[];
};

type PiChatSummariesProps = {
	portfolioId: string;
};

export function PiChatSummaries({ portfolioId }: PiChatSummariesProps) {
	const {
		data: summaries,
		isLoading,
		refetch,
	} = useQuery<PiChatSummary[]>({
		queryKey: [`/api/portfolio/${portfolioId}/summaries`],
		enabled: !!portfolioId,
	});

	const getAssetClassIcon = (assetClass: string) => {
		switch (assetClass.toLowerCase()) {
			case "equity":
				return "📈";
			case "debt":
				return "🏦";
			case "gold":
				return "🟡";
			case "cash":
				return "💵";
			default:
				return "📊";
		}
	};

	const getAssetClassColor = (assetClass: string) => {
		switch (assetClass.toLowerCase()) {
			case "equity":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
			case "debt":
				return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
			case "gold":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
			case "cash":
				return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>AI Asset Insights</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="space-y-3">
								<Skeleton className="h-6 w-32" />
								<Skeleton className="h-20 w-full" />
								<div className="flex gap-2">
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-4 w-20" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!summaries || summaries.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>AI Asset Insights</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center py-12 text-center">
						<div className="bg-muted p-4 rounded-full mb-4">
							<Lightbulb className="h-8 w-8 text-muted-foreground" />
						</div>
						<p className="text-muted-foreground font-medium">
							No insights generated yet
						</p>
						<p className="text-sm text-muted-foreground max-w-xs mt-1">
							AI analysis will appear here once your portfolio is processed.
						</p>
						<Button
							variant="outline"
							className="mt-6"
							onClick={() => refetch()}
						>
							Check Again
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-yellow-500" />
						AI Asset Insights
					</CardTitle>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => refetch()}
						data-testid="refresh-pi-chat"
					>
						<RefreshCw className="h-3 w-3 mr-1" />
						Refresh
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					AI-generated insights and recommendations for each asset class in your
					portfolio
				</p>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[450px]">
					<div className="space-y-6">
						{summaries.map((summary) => {
							const insights = summary.insights as PiChatInsights;
							return (
								<div
									key={summary.id}
									className="border rounded-lg p-4 space-y-3"
									data-testid={`pi-chat-summary-${summary.assetClass}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center space-x-2">
											<span className="text-lg">
												{getAssetClassIcon(summary.assetClass)}
											</span>
											<Badge className={getAssetClassColor(summary.assetClass)}>
												{summary.assetClass.charAt(0).toUpperCase() +
													summary.assetClass.slice(1)}
											</Badge>
											{insights?.allocation && (
												<Badge variant="outline" className="text-xs">
													{insights.allocation} of portfolio
												</Badge>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											Updated{" "}
											{summary.lastAnalyzed
												? new Date(summary.lastAnalyzed).toLocaleDateString()
												: "Recently"}
										</div>
									</div>

									<div className="bg-muted p-3 rounded-lg">
										<div className="flex items-start space-x-2">
											<MessageCircle className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
											<p className="text-sm text-muted-foreground leading-relaxed">
												{String(summary.summary)}
											</p>
										</div>
									</div>

									{insights && (
										<div className="grid grid-cols-2 gap-3 text-xs">
											{insights.totalValue && (
												<div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
													<div className="font-medium text-blue-900 dark:text-blue-100">
														Total Value
													</div>
													<div className="text-blue-700 dark:text-blue-300">
														₹{insights.totalValue.toLocaleString()}
													</div>
												</div>
											)}
											{insights.expectedReturn && (
												<div className="bg-green-50 dark:bg-green-950/30 p-2 rounded">
													<div className="font-medium text-green-900 dark:text-green-100">
														Expected Return
													</div>
													<div className="text-green-700 dark:text-green-300">
														{insights.expectedReturn}
													</div>
												</div>
											)}
										</div>
									)}

									{summary.recommendations &&
										summary.recommendations.length > 0 && (
											<div className="space-y-2">
												<div className="flex items-center text-xs font-semibold text-primary">
													<TrendingUp className="h-3 w-3 mr-1" />
													Recommendations
												</div>
												<ul className="space-y-1">
													{summary.recommendations.map((rec, idx) => (
														<li
															key={idx}
															className="text-xs text-muted-foreground flex items-start"
														>
															<span className="mr-2 mt-1 h-1 w-1 rounded-full bg-primary flex-shrink-0" />
															{String(rec)}
														</li>
													))}
												</ul>
											</div>
										)}
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
