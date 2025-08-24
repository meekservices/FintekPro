import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssetAllocation } from "@/hooks/use-portfolio";
import { ASSET_TYPE_LABELS, ASSET_COLORS, RISK_PROFILES } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface AssetAllocationProps {
  portfolioId: string;
}

export function AssetAllocation({ portfolioId }: AssetAllocationProps) {
  const { data: allocation, isLoading, error } = useAssetAllocation(portfolioId);

  // Mock data for demonstration - would come from real allocation API
  const mockAllocationData = [
    { assetType: "equity", current: 68, target: 65, currentValue: 847000, targetValue: 812500 },
    { assetType: "debt", current: 22, target: 25, currentValue: 275000, targetValue: 312500 },
    { assetType: "gold", current: 7, target: 5, currentValue: 87500, targetValue: 62500 },
    { assetType: "alternative", current: 3, target: 5, currentValue: 37500, targetValue: 62500 },
  ];

  const allocationData = allocation?.length ? allocation : mockAllocationData;

  // Process data for charts
  const chartData = allocationData.map(item => ({
    name: ASSET_TYPE_LABELS[item.assetType as keyof typeof ASSET_TYPE_LABELS] || item.assetType,
    current: item.current || parseFloat(item.currentPercentage || "0"),
    target: item.target || parseFloat(item.targetPercentage || "0"),
    currentValue: item.currentValue || parseFloat(item.currentValue || "0"),
    targetValue: item.targetValue || parseFloat(item.targetValue || "0"),
    rebalanceAmount: item.currentValue && item.targetValue ? 
      parseFloat(item.targetValue.toString()) - parseFloat(item.currentValue.toString()) : 0,
    color: ASSET_COLORS[item.assetType as keyof typeof ASSET_COLORS] || '#8b5cf6'
  }));

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
            <p className="text-gray-500 text-sm">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8" data-testid="asset-allocation">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-2xl font-bold text-gray-900" data-testid="allocation-title">
            Asset Allocation Dashboard
          </CardTitle>
          <Button 
            className="bg-finance-blue text-white hover:bg-blue-700"
            data-testid="rebalance-portfolio-button"
          >
            Rebalance Portfolio
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Current vs Target Allocation */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4" data-testid="current-target-title">
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
                      <p className="text-sm text-gray-600" data-testid={`current-percent-${item.name.toLowerCase()}`}>
                        Current: {item.current}%
                      </p>
                      <p className="text-sm text-gray-600" data-testid={`target-percent-${item.name.toLowerCase()}`}>
                        Target: {item.target}%
                      </p>
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
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
            <div className="mt-6 p-4 bg-blue-50 rounded-lg" data-testid="rebalance-suggestions">
              <h4 className="font-semibold text-gray-900 mb-2">Rebalance Suggestions</h4>
              <div className="space-y-2 text-sm">
                {chartData.map((item) => {
                  const deviation = item.current - item.target;
                  if (Math.abs(deviation) < 1) return null; // Skip small deviations
                  
                  return (
                    <p key={item.name} className="text-gray-700" data-testid={`suggestion-${item.name.toLowerCase()}`}>
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
            <h3 className="font-bold text-gray-900 mb-4" data-testid="performance-chart-title">
              Current Allocation
            </h3>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center" data-testid="pie-chart-container">
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
            
            {/* Risk Profile */}
            <div className="mt-6" data-testid="risk-profiles">
              <h4 className="font-semibold text-gray-900 mb-3">Recommended Allocation by Risk Profile</h4>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(RISK_PROFILES).map(([key, profile]) => (
                  <div 
                    key={key}
                    className="text-center p-3 rounded-lg border-2 border-transparent hover:border-gray-200 transition-colors cursor-pointer"
                    style={{ backgroundColor: `${profile.color}15` }}
                    data-testid={`risk-profile-${key.toLowerCase()}`}
                  >
                    <p className="font-medium mb-1" style={{ color: profile.color }}>
                      {profile.name}
                    </p>
                    <div className="text-xs space-y-1">
                      <p>Equity: {profile.equity}%</p>
                      <p>Debt: {profile.debt}%</p>
                      <p>Others: {profile.gold + profile.alternative}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
