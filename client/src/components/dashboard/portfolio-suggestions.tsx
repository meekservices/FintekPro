import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePortfolioRebalancingSuggestions } from "@/hooks/use-portfolio";
import {
	AlertTriangle,
	TrendingUp,
	TrendingDown,
	Shield as LucideShield,
	Target,
	ChevronRight,
} from "lucide-react";

interface PortfolioSuggestionsProps {
	portfolioId: string;
}

export function PortfolioSuggestions({
	portfolioId,
}: PortfolioSuggestionsProps) {
	const {
		data: suggestions,
		isLoading,
		error,
	} = usePortfolioRebalancingSuggestions(portfolioId);

	const getPriorityIcon = (priority: string) => {
		switch (priority) {
			case "high":
				return <AlertTriangle className="h-4 w-4 text-red-500" />;
			case "medium":
				return <Target className="h-4 w-4 text-yellow-500" />;
			case "low":
				return <LucideShield className="h-4 w-4 text-green-500" />;
			default:
				return <TrendingUp className="h-4 w-4 text-blue-500" />;
		}
	};

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
			case "medium":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
			case "low":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
			default:
				return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
		}
	};

	const getTypeIcon = (type: string) => {
		switch (type) {
			case "risk_reduction":
				return <LucideShield className="h-4 w-4" />;
			case "diversification":
				return <TrendingUp className="h-4 w-4" />;
			case "yield_optimization":
				return <Target className="h-4 w-4" />;
			default:
				return <TrendingUp className="h-4 w-4" />;
		}
	};

	if (isLoading) {
		return (
			<Card data-testid="portfolio-suggestions-loading">
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{Array.from({ length: 2 }).map((_, i) => (
							<div key={i} className="border border-border rounded-lg p-4">
								<div className="flex items-start justify-between mb-3">
									<div className="flex items-center space-x-2">
										<Skeleton className="h-4 w-4 rounded-full" />
										<Skeleton className="h-5 w-40" />
									</div>
									<Skeleton className="h-5 w-16" />
								</div>
								<Skeleton className="h-4 w-full mb-2" />
								<Skeleton className="h-4 w-3/4 mb-3" />
								<div className="flex justify-between items-center">
									<Skeleton className="h-3 w-24" />
									<Skeleton className="h-8 w-24" />
								</div>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card data-testid="portfolio-suggestions-error">
				<CardHeader>
					<CardTitle className="text-xl font-bold text-foreground">
						Portfolio Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<p className="text-red-500 mb-2">Error loading suggestions</p>
						<p className="text-muted-foreground text-sm">
							Please check your connection and try again
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!suggestions || suggestions.length === 0) {
		return (
			<Card data-testid="portfolio-suggestions-empty">
				<CardHeader>
					<CardTitle className="text-xl font-bold text-foreground">
						Portfolio Suggestions
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8">
						<p className="text-muted-foreground mb-2">
							No suggestions available
						</p>
						<p className="text-muted-foreground text-sm">
							Add holdings to get personalized recommendations
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card data-testid="portfolio-suggestions">
			<CardHeader>
				<CardTitle className="text-xl font-bold text-foreground">
					Portfolio Suggestions
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						Personalized for your holdings
					</span>
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{suggestions.map((suggestion) => (
						<div
							key={suggestion.id}
							className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
							data-testid={`suggestion-${suggestion.type}`}
						>
							<div className="flex items-start justify-between mb-3">
								<div className="flex items-center space-x-2">
									{getPriorityIcon(suggestion.priority)}
									<h3 className="font-semibold text-foreground">
										{suggestion.title}
									</h3>
								</div>
								<div className="flex items-center space-x-2">
									<Badge
										className={`text-xs ${getPriorityColor(suggestion.priority)}`}
										data-testid={`priority-${suggestion.priority}`}
									>
										{suggestion.priority.toUpperCase()}
									</Badge>
									<Badge
										variant="outline"
										className="text-xs"
										data-testid={`type-${suggestion.type}`}
									>
										{getTypeIcon(suggestion.type)}
										<span className="ml-1">
											{suggestion.type.replace("_", " ")}
										</span>
									</Badge>
								</div>
							</div>

							<p className="text-sm text-muted-foreground mb-3">
								{suggestion.description}
							</p>

							{suggestion.expectedImpact && (
								<div className="mb-3 p-3 bg-muted rounded-md">
									<h4 className="text-xs font-semibold text-foreground mb-2">
										Expected Impact:
									</h4>
									<div className="grid grid-cols-2 gap-2 text-xs">
										{Object.entries(suggestion.expectedImpact).map(
											([key, value]) => (
												<div key={key} className="flex justify-between">
													<span className="text-muted-foreground capitalize">
														{key.replace("_", " ")}:
													</span>
													<span className="font-medium text-foreground">
														{String(value)}
													</span>
												</div>
											),
										)}
									</div>
								</div>
							)}

							{suggestion.actions && suggestion.actions.length > 0 && (
								<div className="mb-3">
									<h4 className="text-xs font-semibold text-foreground mb-2">
										Recommended Actions:
									</h4>
									<div className="space-y-1">
										{suggestion.actions.map((action: any, index: number) => (
											<div
												key={index}
												className="flex items-center text-xs text-muted-foreground"
												data-testid={`action-${action.action}`}
											>
												<ChevronRight className="h-3 w-3 mr-1" />
												<span className="capitalize font-medium">
													{action.action}
												</span>
												{action.assetType && (
													<span className="ml-1">
														{action.percentage &&
															`${action.percentage.toFixed(1)}%`}{" "}
														in {action.assetType}
													</span>
												)}
												{action.target && (
													<span className="ml-1">: {action.target}</span>
												)}
												{action.frequency && (
													<span className="ml-1">({action.frequency})</span>
												)}
											</div>
										))}
									</div>
								</div>
							)}

							<div className="flex items-center justify-between">
								<div className="flex items-center text-xs text-muted-foreground">
									<span>Confidence Score:</span>
									<span className="ml-1 font-semibold">
										{suggestion.confidenceScore}%
									</span>
									<div className="ml-2 w-16 bg-muted rounded-full h-1.5">
										<div
											className="bg-blue-600 h-1.5 rounded-full"
											style={{ width: `${suggestion.confidenceScore}%` }}
										/>
									</div>
								</div>

								{suggestion.priority === "high" && (
									<Button
										size="sm"
										variant="outline"
										className="text-xs"
										data-testid={`implement-suggestion-${suggestion.id}`}
									>
										Implement
									</Button>
								)}
							</div>
						</div>
					))}
				</div>

				{suggestions.length > 0 && (
					<div className="mt-4 pt-4 border-t border-border">
						<p className="text-xs text-muted-foreground text-center">
							Suggestions are generated based on your portfolio composition and
							risk profile
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
