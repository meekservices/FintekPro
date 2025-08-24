import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { RebalanceDashboard } from "@/components/dashboard/rebalance-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePortfolioHoldings } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

export default function Portfolio() {
  const userId = "demo-user-1";
  const portfolioId = "demo-portfolio-1";
  const totalValue = 1250000;

  const { data: holdings, isLoading } = usePortfolioHoldings(portfolioId);

  return (
    <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8" data-testid="portfolio-header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Management</h1>
            <p className="text-gray-600 mt-2">Track, analyze, and rebalance your investments</p>
          </div>
          <Button className="bg-finance-blue text-white hover:bg-blue-700" data-testid="add-investment-button">
            <Plus className="h-4 w-4 mr-2" />
            Add Investment
          </Button>
        </div>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" data-testid="portfolio-overview">
          <div className="lg:col-span-2">
            {/* Holdings Table */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Holdings</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center p-4 border-b">
                        <div>
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-20 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : holdings && holdings.length > 0 ? (
                  <div className="space-y-4" data-testid="holdings-list">
                    {holdings.map((holding) => {
                      const currentValue = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
                      const mockCurrentPrice = parseFloat(holding.avgPrice) * (1 + (Math.random() - 0.5) * 0.1); // Mock price change
                      const mockGainLoss = (mockCurrentPrice - parseFloat(holding.avgPrice)) * parseFloat(holding.quantity);
                      const mockGainLossPercent = ((mockCurrentPrice - parseFloat(holding.avgPrice)) / parseFloat(holding.avgPrice)) * 100;

                      return (
                        <div 
                          key={holding.id} 
                          className="flex justify-between items-center p-4 border-b hover:bg-gray-50 transition-colors"
                          data-testid={`holding-${holding.symbol}`}
                        >
                          <div>
                            <h4 className="font-semibold text-gray-900">{holding.symbol}</h4>
                            <p className="text-sm text-gray-600">Qty: {holding.quantity} | Avg: ₹{holding.avgPrice}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">₹{currentValue.toLocaleString()}</p>
                            <div className={`text-sm flex items-center ${mockGainLoss >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                              {mockGainLoss >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {mockGainLoss >= 0 ? '+' : ''}₹{mockGainLoss.toFixed(2)} ({mockGainLossPercent.toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8" data-testid="empty-holdings">
                    <p className="text-gray-500 mb-4">No holdings found</p>
                    <Button variant="outline">Add Your First Investment</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <PortfolioSummary userId={userId} />
        </div>

        {/* Asset Allocation */}
        <AssetAllocation portfolioId={portfolioId} />

        {/* Rebalance Dashboard */}
        <RebalanceDashboard portfolioId={portfolioId} totalValue={totalValue} />

      </main>

      <Footer />
    </div>
  );
}
