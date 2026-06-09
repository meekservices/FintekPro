import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Eye, Users, Flame, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface TrendingItem {
	id: string;
	assetType: string;
	symbol: string;
	name: string;
	trendScore: number;
	viewCount?: number;
	investorCount?: number;
	category: string;
}

export function TrendingInvestments() {
	const { data, isLoading } = useQuery<{
		success: boolean;
		investments: TrendingItem[];
	}>({
		queryKey: ["/api/features/trending"],
		refetchInterval: 60000,
	});

	const trending = data?.investments || [];

	if (isLoading) {
		return (
			<Card data-testid="trending-investments-loading">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Flame className="h-5 w-5 text-orange-500" />
						Trending Now
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card data-testid="trending-investments">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Flame className="h-5 w-5 text-orange-500" />
						Trending Now
					</CardTitle>
					<Badge variant="secondary" className="text-xs">
						Live
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					{trending.slice(0, 5).map((item, index) => (
						<div
							key={item.id}
							className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
							data-testid={`trending-item-${item.symbol}`}
						>
							<div className="flex items-center gap-3">
								<div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
									{index + 1}
								</div>
								<div>
									<p className="font-medium">{item.symbol}</p>
									<p className="text-xs text-muted-foreground truncate max-w-[150px]">
										{item.name}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-3">
								<div className="text-right">
									{item.viewCount && (
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<Eye className="h-3 w-3" />
											{(item.viewCount / 1000).toFixed(1)}k
										</div>
									)}
									{item.investorCount && (
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<Users className="h-3 w-3" />
											{(item.investorCount / 1000).toFixed(1)}k
										</div>
									)}
								</div>
								<Badge
									variant={
										item.category === "top_gainers" ? "default" : "secondary"
									}
									className="text-xs"
								>
									{item.category === "top_gainers"
										? "Top Gainer"
										: item.category === "most_traded"
											? "Most Traded"
											: "Popular"}
								</Badge>
							</div>
						</div>
					))}
				</div>

				<Link href="/domestic-trading">
					<Button
						variant="ghost"
						className="w-full mt-4"
						data-testid="view-all-trending"
					>
						View All Trending
						<ArrowRight className="h-4 w-4 ml-2" />
					</Button>
				</Link>
			</CardContent>
		</Card>
	);
}
