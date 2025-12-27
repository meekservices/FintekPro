import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  AlertCircle, 
  Info, 
  Droplet, 
  PiggyBank,
  Users,
  Download,
  RefreshCw,
  LogIn
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NetWorthData {
  summary: {
    netWorth: number;
    totalAssets: number;
    totalLiabilities: number;
    currency: string;
    isFamily: boolean;
    memberCount: number;
    lastUpdated: string;
  };
  assets: {
    breakdown: {
      liquid: { value: number; percentage: number; items: any[] };
      semiLiquid: { value: number; percentage: number; items: any[] };
      illiquid: { value: number; percentage: number; items: any[] };
      pending: { value: number; items: any[] };
    };
    portfolioCount: number;
    bankAccountsCount: number;
    declaredAssets: number;
  };
  liabilities: {
    breakdown: {
      shortTerm: { value: number; items: any[] };
      longTerm: { value: number; items: any[] };
    };
    count: number;
  };
  metrics: {
    liquidityRatio: number;
    debtToAssetRatio: number;
    emergencyFundGap: number;
    recommendedEmergencyFund: number;
  };
}

export default function NetWorthPage() {
  const [includeFamilyWealth, setIncludeFamilyWealth] = useState(false);
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery<{ success: boolean; data: NetWorthData }>({
    queryKey: includeFamilyWealth ? ["/api/net-worth?includeFamily=true"] : ["/api/net-worth"],
    enabled: !!user, // Only fetch when user is authenticated
    retry: 2,
  });

  const netWorthData = data?.data;

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <LogIn className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-login-required">Login Required</h3>
              <p className="text-muted-foreground mb-6">Please log in to view your net worth dashboard.</p>
              <Link href="/auth">
                <Button data-testid="button-login">
                  <LogIn className="h-4 w-4 mr-2" />
                  Log In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Chart colors
  const ASSET_COLORS = ['#10b981', '#3b82f6', '#f59e0b'];
  const LIABILITY_COLORS = ['#ef4444', '#dc2626'];

  // Prepare data for assets pie chart
  const assetsPieData = netWorthData ? [
    { name: 'Liquid Assets', value: netWorthData.assets.breakdown.liquid.value, color: ASSET_COLORS[0] },
    { name: 'Semi-Liquid Assets', value: netWorthData.assets.breakdown.semiLiquid.value, color: ASSET_COLORS[1] },
    { name: 'Illiquid Assets', value: netWorthData.assets.breakdown.illiquid.value, color: ASSET_COLORS[2] },
  ].filter(item => item.value > 0) : [];

  // Prepare data for liabilities pie chart
  const liabilitiesPieData = netWorthData ? [
    { name: 'Short-term (<1 year)', value: netWorthData.liabilities.breakdown.shortTerm.value, color: LIABILITY_COLORS[0] },
    { name: 'Long-term (>1 year)', value: netWorthData.liabilities.breakdown.longTerm.value, color: LIABILITY_COLORS[1] },
  ].filter(item => item.value > 0) : [];

  // Prepare comparison bar chart data
  const comparisonData = netWorthData ? [
    { category: 'Assets', value: netWorthData.summary.totalAssets },
    { category: 'Liabilities', value: netWorthData.summary.totalLiabilities },
    { category: 'Net Worth', value: netWorthData.summary.netWorth }
  ] : [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading your net worth...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (isError) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-error-title">Failed to Load Net Worth</h3>
              <p className="text-muted-foreground mb-4" data-testid="text-error-message">
                {errorMessage.includes("401") || errorMessage.includes("Unauthorized") 
                  ? "Your session may have expired. Please log in again."
                  : "We couldn't load your net worth data. Please try again."}
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => refetch()} data-testid="button-retry">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Link href="/">
                  <Button variant="ghost" data-testid="button-go-home">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!netWorthData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-data">No Net Worth Data Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start by adding your investments, bank accounts, and liabilities to see your complete financial picture.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/wealth-management">
                  <Button data-testid="button-add-investments">
                    <PiggyBank className="h-4 w-4 mr-2" />
                    Add Investments
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-data">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const netWorthChange = netWorthData.summary.netWorth - netWorthData.summary.totalLiabilities;
  const isPositiveChange = netWorthChange >= 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-page-title">My Net Worth</h1>
          <p className="text-muted-foreground">
            Complete wealth tracking with intelligent asset categorization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="family-wealth"
              checked={includeFamilyWealth}
              onCheckedChange={(checked) => {
                setIncludeFamilyWealth(checked);
                setTimeout(() => refetch(), 100);
              }}
              data-testid="switch-family-wealth"
            />
            <Label htmlFor="family-wealth" className="flex items-center gap-2 cursor-pointer">
              <Users className="h-4 w-4" />
              <span className="text-sm">Family Wealth</span>
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Net Worth Card */}
      <Card className="mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">
                  {netWorthData.summary.isFamily ? `Family Net Worth (${netWorthData.summary.memberCount} members)` : 'Total Net Worth'}
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <h2 className="text-5xl font-bold" data-testid="text-net-worth">
                  {formatCurrency(netWorthData.summary.netWorth)}
                </h2>
                {isPositiveChange ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {new Date(netWorthData.summary.lastUpdated).toLocaleString('en-IN')}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Assets</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-total-assets">
                  {formatCurrency(netWorthData.summary.totalAssets)}
                </p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Liabilities</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-total-liabilities">
                  {formatCurrency(netWorthData.summary.totalLiabilities)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="h-5 w-5" />
              Liquidity Ratio
            </CardTitle>
            <CardDescription>How quickly you can access cash</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2" data-testid="text-liquidity-ratio">
              {netWorthData.metrics.liquidityRatio.toFixed(1)}%
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  netWorthData.metrics.liquidityRatio >= 50 ? 'bg-green-600' :
                  netWorthData.metrics.liquidityRatio >= 30 ? 'bg-yellow-600' : 'bg-red-600'
                }`}
                style={{ width: `${Math.min(netWorthData.metrics.liquidityRatio, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {netWorthData.metrics.liquidityRatio >= 50 ? '✓ Excellent liquidity' :
               netWorthData.metrics.liquidityRatio >= 30 ? '⚠ Moderate liquidity' : '⚠ Low liquidity'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Debt-to-Asset Ratio
            </CardTitle>
            <CardDescription>Your leverage level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2" data-testid="text-debt-ratio">
              {netWorthData.metrics.debtToAssetRatio.toFixed(1)}%
            </div>
            <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  netWorthData.metrics.debtToAssetRatio <= 20 ? 'bg-green-600' :
                  netWorthData.metrics.debtToAssetRatio <= 40 ? 'bg-yellow-600' : 'bg-red-600'
                }`}
                style={{ width: `${Math.min(netWorthData.metrics.debtToAssetRatio, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {netWorthData.metrics.debtToAssetRatio <= 20 ? '✓ Healthy debt level' :
               netWorthData.metrics.debtToAssetRatio <= 40 ? '⚠ Moderate debt' : '⚠ High debt'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5" />
              Emergency Fund
            </CardTitle>
            <CardDescription>6 months expenses recommended</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {formatCurrency(netWorthData.metrics.recommendedEmergencyFund - netWorthData.metrics.emergencyFundGap)}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Target: {formatCurrency(netWorthData.metrics.recommendedEmergencyFund)}
            </p>
            {netWorthData.metrics.emergencyFundGap > 0 ? (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Short by {formatCurrency(netWorthData.metrics.emergencyFundGap)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-600">
                ✓ Fully funded
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assets and Liabilities Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Assets Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Assets Breakdown</CardTitle>
            <CardDescription>
              {netWorthData.assets.portfolioCount} portfolios, {netWorthData.assets.bankAccountsCount} bank accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assetsPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assetsPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {assetsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-600" />
                      <span className="text-sm">Liquid (24h)</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(netWorthData.assets.breakdown.liquid.value)}</div>
                      <div className="text-xs text-muted-foreground">{netWorthData.assets.breakdown.liquid.percentage.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-600" />
                      <span className="text-sm">Semi-Liquid (1-7 days)</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(netWorthData.assets.breakdown.semiLiquid.value)}</div>
                      <div className="text-xs text-muted-foreground">{netWorthData.assets.breakdown.semiLiquid.percentage.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-600" />
                      <span className="text-sm">Illiquid (90+ days)</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(netWorthData.assets.breakdown.illiquid.value)}</div>
                      <div className="text-xs text-muted-foreground">{netWorthData.assets.breakdown.illiquid.percentage.toFixed(1)}%</div>
                    </div>
                  </div>

                  {netWorthData.assets.breakdown.pending.value > 0 && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">Pending Orders</span>
                        </div>
                        <div className="font-semibold">{formatCurrency(netWorthData.assets.breakdown.pending.value)}</div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No assets to display
              </div>
            )}
          </CardContent>
        </Card>

        {/* Liabilities Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Liabilities Breakdown</CardTitle>
            <CardDescription>
              {netWorthData.liabilities.count} active loans
            </CardDescription>
          </CardHeader>
          <CardContent>
            {netWorthData.summary.totalLiabilities > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={liabilitiesPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {liabilitiesPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>

                <Separator className="my-4" />

                <div className="space-y-3">
                  {netWorthData.liabilities.breakdown.shortTerm.value > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-600" />
                        <span className="text-sm">Short-term (&lt;1 year)</span>
                      </div>
                      <div className="font-semibold">{formatCurrency(netWorthData.liabilities.breakdown.shortTerm.value)}</div>
                    </div>
                  )}

                  {netWorthData.liabilities.breakdown.longTerm.value > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-700" />
                        <span className="text-sm">Long-term (&gt;1 year)</span>
                      </div>
                      <div className="font-semibold">{formatCurrency(netWorthData.liabilities.breakdown.longTerm.value)}</div>
                    </div>
                  )}
                </div>

                {netWorthData.liabilities.breakdown.shortTerm.items.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Active Loans</h4>
                      {netWorthData.liabilities.breakdown.shortTerm.items.map((loan: any, idx: number) => (
                        <div key={idx} className="text-xs p-2 bg-secondary rounded-md">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{loan.type}</span>
                            <span>{formatCurrency(loan.outstandingAmount)}</span>
                          </div>
                          <div className="text-muted-foreground">
                            Interest: {loan.interestRate}% | Tenure: {loan.tenure} months
                          </div>
                        </div>
                      ))}
                      {netWorthData.liabilities.breakdown.longTerm.items.map((loan: any, idx: number) => (
                        <div key={idx} className="text-xs p-2 bg-secondary rounded-md">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium">{loan.type}</span>
                            <span>{formatCurrency(loan.outstandingAmount)}</span>
                          </div>
                          <div className="text-muted-foreground">
                            Interest: {loan.interestRate}% | Tenure: {loan.tenure} months
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-green-600 text-5xl mb-2">✓</div>
                <p className="font-semibold">Debt Free!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have no outstanding liabilities
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Financial Comparison</CardTitle>
          <CardDescription>Assets vs Liabilities vs Net Worth</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis tickFormatter={(value) => `₹${(value / 100000).toFixed(1)}L`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                {comparisonData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.category === 'Assets' ? '#10b981' :
                      entry.category === 'Liabilities' ? '#ef4444' :
                      '#3b82f6'
                    } 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="outline" className="flex-1" data-testid="button-export-report">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" className="flex-1" data-testid="button-view-details">
              <Info className="h-4 w-4 mr-2" />
              View Detailed Breakdown
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
