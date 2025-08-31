import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePortfolios, usePortfolioHoldings } from "@/hooks/use-portfolio";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { ASSET_COLORS, ASSET_TYPE_LABELS } from "@/lib/constants";
import { RebalanceDashboard } from "./rebalance-dashboard";
import { useState } from "react";

interface PortfolioSummaryProps {
  userId: string;
}

export function PortfolioSummary({ userId }: PortfolioSummaryProps) {
  const { data: portfolios, isLoading: portfoliosLoading } = usePortfolios(userId);
  const defaultPortfolio = portfolios?.[0]; // Use first portfolio as default
  const { data: holdings, isLoading: holdingsLoading } = usePortfolioHoldings(defaultPortfolio?.id || "");
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);

  const isLoading = portfoliosLoading || holdingsLoading;

  // Calculate portfolio summary
  const getPortfolioSummary = () => {
    if (!holdings || holdings.length === 0) {
      return {
        totalValue: 0,
        todayPnL: 0,
        todayPnLPercent: 0,
        assetAllocation: []
      };
    }

    // Group holdings by asset type
    const assetGroups = holdings.reduce((acc, holding) => {
      const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      if (!acc[holding.assetType]) {
        acc[holding.assetType] = 0;
      }
      acc[holding.assetType] += value;
      return acc;
    }, {} as Record<string, number>);

    const totalValue = Object.values(assetGroups).reduce((sum, value) => sum + value, 0);

    const assetAllocation = Object.entries(assetGroups).map(([assetType, value]) => ({
      name: ASSET_TYPE_LABELS[assetType as keyof typeof ASSET_TYPE_LABELS] || assetType,
      value,
      percentage: ((value / totalValue) * 100).toFixed(1),
      color: ASSET_COLORS[assetType as keyof typeof ASSET_COLORS] || '#8b5cf6'
    }));

    return {
      totalValue,
      todayPnL: totalValue * 0.0044, // Mock 0.44% gain
      todayPnLPercent: 0.44,
      assetAllocation
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
        <CardTitle className="text-xl font-bold text-gray-900" data-testid="portfolio-title">
          Your Portfolio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Total Value</span>
            <span className="font-bold text-2xl text-gray-900" data-testid="portfolio-total-value">
              ₹{summary.totalValue.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Today's P&L</span>
            <span 
              className={`font-bold ${summary.todayPnL >= 0 ? 'text-finance-green' : 'text-finance-red'}`}
              data-testid="portfolio-pnl"
            >
              {summary.todayPnL >= 0 ? '+' : ''}₹{summary.todayPnL.toLocaleString()} ({summary.todayPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Asset Allocation Chart */}
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3" data-testid="allocation-title">
            Asset Allocation
          </h4>
          <div className="h-48 flex items-center justify-center" data-testid="allocation-chart">
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
                    formatter={(value, entry: any) => `${value} (${entry.payload.percentage}%)`}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-500 text-center">
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
              <RebalanceDashboard portfolioId={defaultPortfolio?.id || ""} totalValue={summary.totalValue || 0} />
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            className="w-full border-finance-blue text-finance-blue hover:bg-blue-50"
            data-testid="add-investment-button"
          >
            Add Investment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
