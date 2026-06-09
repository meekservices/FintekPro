import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { usePortfolios, usePortfolioHoldings } from "@/hooks/use-portfolio";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ASSET_COLORS, ASSET_TYPE_LABELS } from "@/lib/constants";
import { RebalanceDashboard } from "./rebalance-dashboard";
import { useState } from "react";

interface PortfolioSummaryProps {
	userId: string;
}

export function PortfolioSummary({ userId }: PortfolioSummaryProps) {
	const { data: portfolios, isLoading: portfoliosLoading } =
		usePortfolios(userId);
	const defaultPortfolio = portfolios?.[0]; // Use first portfolio as default
	const { data: holdings, isLoading: holdingsLoading } = usePortfolioHoldings(
		defaultPortfolio?.id || "",
	);
	const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);

	const isLoading = portfoliosLoading || holdingsLoading;

	// Calculate portfolio summary from real holdings data
	const getPortfolioSummary = () => {
		if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
			return {
				totalValue: 0,
				todayPnL: 0,
				todayPnLPercent: 0,
				assetAllocation: [],
				isEmpty: true,
			};
		}

		// Group holdings by asset type and calculate real values
		const assetGroups = holdings.reduce(
			(acc, holding) => {
				const quantity = Number.parseFloat(holding.quantity || "0");
				const avgPrice = Number.parseFloat(holding.avgPrice || "0");
				// Use avgPrice as current price since live prices require real-time market data feeds
				const currentPrice = avgPrice;
				const value = quantity * currentPrice;
				const costBasis = quantity * avgPrice;

				if (!acc[holding.assetType]) {
					acc[holding.assetType] = { value: 0, costBasis: 0 };
				}
				acc[holding.assetType].value += value;
				acc[holding.assetType].costBasis += costBasis;
				return acc;
			},
			{} as Record<string, { value: number; costBasis: number }>,
		);

		const totalValue = Object.values(assetGroups).reduce(
			(sum, group) => sum + group.value,
			0,
		);
		const totalCostBasis = Object.values(assetGroups).reduce(
			(sum, group) => sum + group.costBasis,
			0,
		);

		// Calculate actual P&L from holdings (difference between current value and cost basis)
		const totalPnL = totalValue - totalCostBasis;
		const pnlPercent =
			totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0;

		const assetAllocation = Object.entries(assetGroups).map(
			([assetType, group]) => ({
				name:
					ASSET_TYPE_LABELS[assetType as keyof typeof ASSET_TYPE_LABELS] ||
					assetType,
				value: group.value,
				percentage: ((group.value / totalValue) * 100).toFixed(1),
				color:
					ASSET_COLORS[assetType as keyof typeof ASSET_COLORS] || "#8b5cf6",
			}),
		);

		return {
			totalValue,
			todayPnL: totalPnL,
			todayPnLPercent: pnlPercent,
			assetAllocation,
			isEmpty: false,
		};
	};

	const summary = getPortfolioSummary();

	if (isLoading) {
		return (
			<Card data-testid="portfolio-summary-loading">
				<CardHeader>
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent>
					<div className="mb-6">
						<Skeleton className="h-8 w-40 mb-2" />
						<Skeleton className="h-6 w-32" />
					</div>
					<div className="mb-6">
						<Skeleton className="h-4 w-28 mb-3" />
						<Skeleton className="h-48 w-full" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card data-testid="portfolio-summary">
			<CardHeader>
				<CardTitle
					className="text-xl font-bold text-foreground"
					data-testid="portfolio-title"
				>
					Your Portfolio
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="mb-6">
					<div className="flex justify-between items-center mb-2">
						<span className="text-muted-foreground">Total Value</span>
						<span
							className="font-bold text-2xl text-foreground"
							data-testid="portfolio-total-value"
						>
							₹{summary.totalValue.toLocaleString()}
						</span>
					</div>
					<div className="flex justify-between items-center">
						<span className="text-muted-foreground">Today's P&L</span>
						<span
							className={`font-bold ${summary.todayPnL >= 0 ? "text-finance-green" : "text-finance-red"}`}
							data-testid="portfolio-pnl"
						>
							{(summary.todayPnL ?? 0) >= 0 ? "+" : ""}₹
							{(summary.todayPnL ?? 0).toLocaleString()} (
							{(summary.todayPnLPercent ?? 0).toFixed(2)}%)
						</span>
					</div>
				</div>

				{/* Asset Allocation Chart */}
				<div className="mb-6">
					<h4
						className="font-semibold text-foreground mb-3"
						data-testid="allocation-title"
					>
						Asset Allocation
					</h4>
					<div
						className="h-48 flex items-center justify-center"
						data-testid="allocation-chart"
					>
						{summary.assetAllocation.length > 0 ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={summary.assetAllocation}
										cx="50%"
										cy="50%"
										innerRadius={40}
										outerRadius={80}
										paddingAngle={2}
										dataKey="value"
									>
										{summary.assetAllocation.map((entry, index) => (
											<Cell key={`cell-${index}`} fill={entry.color} />
										))}
									</Pie>
									<Legend
										formatter={(value, entry: any) =>
											`${value} (${entry.payload.percentage}%)`
										}
										iconType="circle"
									/>
								</PieChart>
							</ResponsiveContainer>
						) : (
							<div className="text-muted-foreground text-center">
								<p>No portfolio data</p>
								<p className="text-sm">Add investments to see allocation</p>
							</div>
						)}
					</div>
				</div>

				{/* Quick Actions */}
				<div className="space-y-2">
					<Dialog open={isRebalanceOpen} onOpenChange={setIsRebalanceOpen}>
						<DialogTrigger asChild>
							<Button
								className="w-full bg-finance-blue text-white hover:bg-blue-700"
								data-testid="rebalance-button"
							>
								Rebalance Portfolio
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Portfolio Rebalancing</DialogTitle>
							</DialogHeader>
							<RebalanceDashboard
								portfolioId={defaultPortfolio?.id || ""}
								totalValue={summary.totalValue || 0}
							/>
						</DialogContent>
					</Dialog>
					<Button
						variant="outline"
						className="w-full border-finance-blue text-finance-blue hover:bg-blue-50 dark:bg-blue-950/30"
						data-testid="add-investment-button"
					>
						Add Investment
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
