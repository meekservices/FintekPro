import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAssetAllocation } from "@/hooks/use-portfolio";
import { ASSET_TYPE_LABELS, ASSET_COLORS, RISK_PROFILES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { RebalanceDashboard } from "./rebalance-dashboard";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

interface AssetAllocationProps {
  portfolioId: string;
}

export function AssetAllocation({ portfolioId }: AssetAllocationProps) {
  const { data: allocation, isLoading, error } = useAssetAllocation(portfolioId);
  const [isRebalanceOpen, setIsRebalanceOpen] = useState(false);
  const [selectedRiskProfile, setSelectedRiskProfile] = useState<string | null>(null);

  const { data: riskProfilesData } = useQuery<any>({
    queryKey: ['/api/allocation/risk-profiles'],
  });

  const optimizeMutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await fetch('/api/allocation/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return res.json();
    },
  });

  const riskProfiles = riskProfilesData?.success ? riskProfilesData.data : Object.entries(RISK_PROFILES).map(([key, p]) => ({ name: key, label: p.name, ...p }));

  // Use real allocation data only - no mock data
  const hasAllocation = allocation && allocation.length > 0;

  // Process data for charts from real allocation data
  const chartData = hasAllocation ? allocation.map(item => ({
    name: ASSET_TYPE_LABELS[item.assetType as keyof typeof ASSET_TYPE_LABELS] || item.assetType,
    current: parseFloat(item.currentPercentage || "0"),
    target: parseFloat(item.targetPercentage || "0"),
    currentValue: parseFloat(item.currentValue || "0"),
    targetValue: parseFloat(item.targetValue || "0"),
    rebalanceAmount: parseFloat(item.rebalanceAmount || "0"),
    color: ASSET_COLORS[item.assetType as keyof typeof ASSET_COLORS] || '#8b5cf6'
  })) : [];

  const pieData = chartData.map(item => ({
    name: item.name,
    value: item.current,
    color: item.color
  }));

  if (isLoading) {
    return (
      <Card className="mb-8" data-testid="asset-allocation-loading">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex items-center space-x-4">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-2 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-8" data-testid="asset-allocation-error">
        <CardHeader>
          <CardTitle>Asset Allocation Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">Error loading asset allocation</p>
            <p className="text-muted-foreground text-sm">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state when no allocation data exists
  if (!hasAllocation) {
    return (
      <Card className="mb-8" data-testid="asset-allocation-empty">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Asset Allocation Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No Asset Allocation Data</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Add investments to your portfolio to see your asset allocation breakdown and receive rebalancing suggestions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8" data-testid="asset-allocation">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-bold text-foreground" data-testid="allocation-title">
            Asset Allocation Dashboard
          </CardTitle>
          <Dialog open={isRebalanceOpen} onOpenChange={setIsRebalanceOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-finance-blue text-white hover:bg-blue-700"
                data-testid="rebalance-portfolio-button"
              >
                Rebalance Portfolio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Portfolio Rebalancing</DialogTitle>
              </DialogHeader>
              <RebalanceDashboard portfolioId={portfolioId} totalValue={chartData.reduce((sum, item) => sum + (item.currentValue || 0), 0)} />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Current vs Target Allocation */}
          <div>
            <h3 className="font-bold text-foreground mb-4" data-testid="current-target-title">
              Current vs Target Allocation
            </h3>
            <div className="space-y-4" data-testid="allocation-breakdown">
              {chartData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                      data-testid={`color-indicator-${item.name.toLowerCase()}`}
                    ></div>
                    <span className="font-medium" data-testid={`asset-name-${item.name.toLowerCase()}`}>
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground" data-testid={`current-percent-${item.name.toLowerCase()}`}>
                        Current: {item.current}%
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid={`target-percent-${item.name.toLowerCase()}`}>
                        Target: {item.target}%
                      </p>
                    </div>
                    <div className="w-24 bg-muted rounded-full h-2">
                      <div 
                        className="h-2 rounded-full" 
                        style={{ 
                          width: `${Math.min(item.current, 100)}%`,
                          backgroundColor: item.color 
                        }}
                        data-testid={`progress-bar-${item.name.toLowerCase()}`}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Rebalance Suggestions */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="rebalance-suggestions">
              <h4 className="font-semibold text-foreground mb-2">Rebalance Suggestions</h4>
              <div className="space-y-2 text-sm">
                {chartData.map((item) => {
                  const deviation = item.current - item.target;
                  if (Math.abs(deviation) < 1) return null; // Skip small deviations
                  
                  return (
                    <p key={item.name} className="text-muted-foreground" data-testid={`suggestion-${item.name.toLowerCase()}`}>
                      • {deviation > 0 ? 'Reduce' : 'Increase'} {item.name} by {Math.abs(deviation).toFixed(1)}%
                      {item.rebalanceAmount !== 0 && (
                        <span className="ml-2 font-medium">
                          (₹{Math.abs(item.rebalanceAmount).toLocaleString()})
                        </span>
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Asset Performance Chart */}
          <div>
            <h3 className="font-bold text-foreground mb-4" data-testid="performance-chart-title">
              Current Allocation
            </h3>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center" data-testid="pie-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend 
                    formatter={(value, entry: any) => `${value} (${entry.payload.value}%)`}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-6" data-testid="risk-profiles">
              <h4 className="font-semibold text-foreground mb-3">Recommended Allocation by Risk Profile</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {riskProfiles.map((profile: any) => (
                  <div 
                    key={profile.name}
                    className={`text-center p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      selectedRiskProfile === profile.name ? 'border-primary ring-1 ring-primary' : 'border-transparent hover:border-border'
                    }`}
                    style={{ backgroundColor: `${(profile.color || '#3b82f6')}15` }}
                    onClick={() => {
                      setSelectedRiskProfile(profile.name);
                      optimizeMutation.mutate({
                        riskScore: profile.scoreRange ? (profile.scoreRange[0] + profile.scoreRange[1]) / 2 : 50,
                        segment: 'retail',
                        investmentHorizon: 5,
                        existingAllocations: Object.fromEntries(chartData.map(d => [d.name.toLowerCase(), d.current]))
                      });
                    }}
                    data-testid={`risk-profile-${profile.name.toLowerCase()}`}
                  >
                    <p className="font-bold text-xs mb-1" style={{ color: profile.color || '#3b82f6' }}>
                      {profile.label || profile.name.replace(/_/g, ' ')}
                    </p>
                    <div className="text-[10px] space-y-0.5 text-muted-foreground">
                      {profile.equity !== undefined && <p>Equity: {profile.equity}%</p>}
                      {profile.debt !== undefined && <p>Debt: {profile.debt}%</p>}
                      {profile.description && <p className="line-clamp-2 mt-1 italic">{profile.description}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {optimizeMutation.isPending && (
                <div className="mt-4 p-4 border rounded-lg animate-pulse bg-muted/50">
                  <p className="text-sm text-center">Optimizing portfolio for {selectedRiskProfile} profile...</p>
                </div>
              )}

              {optimizeMutation.data?.success && (
                <div className="mt-4 p-4 border border-green-200 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-300 text-sm mb-2">Optimized Allocation Suggestion</h4>
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(optimizeMutation.data.data.targetAllocation).map(([asset, weight]: [string, any]) => (
                      <div key={asset} className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{asset}: {weight}%</Badge>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                    {optimizeMutation.data.data.rationale || "AI-optimized based on mean-variance analysis and historical risk-adjusted returns."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
