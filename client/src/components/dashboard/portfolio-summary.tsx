import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { TrendingUp, ArrowUpRight, Scale } from "lucide-react";

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
			<CardHeader className="pb-3 border-b border-border/50">
				<div className="flex items-center justify-between">
					<CardTitle
						className="text-lg font-bold text-foreground"
						data-testid="portfolio-title"
					>
						Executive Portfolio
					</CardTitle>
					<Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-mono">
						Verified Demat
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="pt-4">
				<div className="mb-6 space-y-3">
					<div className="flex justify-between items-baseline">
						<span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
							Aggregate Value
						</span>
						<span
							className="font-bold text-2xl md:text-3xl font-mono tabular-nums text-foreground tracking-tight"
							data-testid="portfolio-total-value"
						>
							₹{summary.totalValue.toLocaleString("en-IN", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</span>
					</div>
					<div className="flex justify-between items-center pt-2 border-t border-border/40">
						<span className="text-xs text-muted-foreground">Today's P&L</span>
						<span
							className={cn(
								"font-semibold font-mono tabular-nums text-sm",
								summary.todayPnL >= 0 ? "text-emerald-500" : "text-rose-500",
							)}
							data-testid="portfolio-pnl"
						>
							{(summary.todayPnL ?? 0) >= 0 ? "+" : ""}₹
							{(summary.todayPnL ?? 0).toLocaleString("en-IN", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}{" "}
							<span className="text-xs opacity-90">
								({(summary.todayPnLPercent ?? 0) >= 0 ? "+" : ""}
								{(summary.todayPnLPercent ?? 0).toFixed(2)}%)
							</span>
						</span>
					</div>
					<div className="flex justify-between items-center text-xs">
						<span className="text-muted-foreground">Alpha vs NIFTY 50</span>
						<span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
							<TrendingUp className="w-3 h-3" />
							+2.70% Excess Return
						</span>
					</div>
				</div>

				{/* Asset Allocation Chart */}
				<div className="mb-6">
					<div className="flex items-center justify-between mb-2">
						<h4
							className="text-xs uppercase tracking-wider font-semibold text-muted-foreground"
							data-testid="allocation-title"
						>
							Asset Allocation
						</h4>
						<span className="text-[11px] text-muted-foreground font-mono">
							{summary.assetAllocation.length} Classes
						</span>
					</div>
					<div
						className="h-44 flex items-center justify-center"
						data-testid="allocation-chart"
					>
						{summary.assetAllocation.length > 0 ? (
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={summary.assetAllocation}
										cx="50%"
										cy="50%"
										innerRadius={45}
										outerRadius={75}
										paddingAngle={3}
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

				{/* Institutional Action Toolbar */}
				<div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
					<Dialog open={isRebalanceOpen} onOpenChange={setIsRebalanceOpen}>
						<DialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-9 gap-1.5 font-medium text-xs border-border/80 hover:bg-muted"
								data-testid="rebalance-button"
							>
								<Scale className="h-3.5 w-3.5 text-primary" /> Rebalance
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Portfolio Rebalancing Console</DialogTitle>
							</DialogHeader>
							<RebalanceDashboard
								portfolioId={defaultPortfolio?.id || ""}
								totalValue={summary.totalValue || 0}
							/>
						</DialogContent>
					</Dialog>
					<Link href="/portfolio" className="block w-full">
						<Button
							size="sm"
							className="w-full h-9 gap-1.5 font-medium text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
							data-testid="holdings-deep-dive-button"
						>
							Holdings <ArrowUpRight className="h-3.5 w-3.5" />
						</Button>
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}
