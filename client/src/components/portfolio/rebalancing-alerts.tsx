import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  Bell, 
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  PieChart
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface AllocationTarget {
  assetClass: string;
  target: number;
  current: number;
  drift: number;
  color: string;
}

interface RebalancingAlertProps {
  portfolioId?: string;
}

export function RebalancingAlerts({ portfolioId }: RebalancingAlertProps) {
  const { user, isAuthenticated } = useAuth();
  const [driftThreshold, setDriftThreshold] = useState(5);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const { data: portfolioData } = useQuery({
    queryKey: ['/api/portfolios', portfolioId],
    enabled: isAuthenticated && !!portfolioId,
  });

  const mockAllocations: AllocationTarget[] = [
    { assetClass: 'Large Cap', target: 40, current: 45, drift: 5, color: 'bg-blue-500' },
    { assetClass: 'Mid Cap', target: 20, current: 18, drift: -2, color: 'bg-green-500' },
    { assetClass: 'Small Cap', target: 15, current: 12, drift: -3, color: 'bg-purple-500' },
    { assetClass: 'Debt', target: 15, current: 17, drift: 2, color: 'bg-orange-500' },
    { assetClass: 'Gold', target: 7, current: 5, drift: -2, color: 'bg-yellow-500' },
    { assetClass: 'Cash', target: 3, current: 3, drift: 0, color: 'bg-muted' },
  ];

  const driftingAssets = useMemo(() => {
    return mockAllocations.filter(a => Math.abs(a.drift) >= driftThreshold);
  }, [driftThreshold]);

  const needsRebalancing = driftingAssets.length > 0;
  const maxDrift = Math.max(...mockAllocations.map(a => Math.abs(a.drift)));

  if (!isAuthenticated) {
    return (
      <Card className="border-dashed" data-testid="rebalancing-alerts-widget">
        <CardContent className="pt-6 text-center">
          <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Login to view rebalancing alerts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="rebalancing-alerts-widget" className={needsRebalancing ? 'border-orange-300 dark:border-orange-700' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${needsRebalancing ? 'bg-orange-100 dark:bg-orange-900' : 'bg-green-100 dark:bg-green-900'}`}>
              {needsRebalancing ? (
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">Rebalancing Alerts</CardTitle>
              <CardDescription>
                {needsRebalancing 
                  ? `${driftingAssets.length} allocation(s) need attention`
                  : 'Portfolio is balanced'
                }
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            data-testid="rebalancing-settings-btn"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {showSettings && (
          <div className="p-4 bg-muted rounded-lg space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable Alerts</p>
                <p className="text-sm text-muted-foreground">Notify when allocation drifts</p>
              </div>
              <Switch 
                checked={alertsEnabled} 
                onCheckedChange={setAlertsEnabled}
                data-testid="alerts-enabled-switch"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">Drift Threshold</p>
                <Badge variant="secondary">{driftThreshold}%</Badge>
              </div>
              <Slider
                value={[driftThreshold]}
                onValueChange={([v]) => setDriftThreshold(v)}
                min={1}
                max={15}
                step={1}
                data-testid="drift-threshold-slider"
              />
              <p className="text-xs text-muted-foreground">
                Alert when any asset class drifts more than {driftThreshold}% from target
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {mockAllocations.map((allocation, idx) => {
            const isDrifting = Math.abs(allocation.drift) >= driftThreshold;
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${allocation.color}`} />
                    {allocation.assetClass}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {allocation.current}% / {allocation.target}%
                    </span>
                    {allocation.drift !== 0 && (
                      <span className={`flex items-center ${
                        isDrifting 
                          ? allocation.drift > 0 ? 'text-orange-600' : 'text-red-600'
                          : 'text-muted-foreground'
                      }`}>
                        {allocation.drift > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {allocation.drift > 0 ? '+' : ''}{allocation.drift}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`absolute h-full ${allocation.color} opacity-30`}
                    style={{ width: `${allocation.target}%` }}
                  />
                  <div 
                    className={`absolute h-full ${allocation.color} ${isDrifting ? 'animate-pulse' : ''}`}
                    style={{ width: `${allocation.current}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {needsRebalancing && (
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              data-testid="view-suggestions-btn"
            >
              View Suggestions
            </Button>
            <Button 
              className="flex-1"
              data-testid="auto-rebalance-btn"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Auto-Rebalance
            </Button>
          </div>
        )}

        {!needsRebalancing && (
          <div className="text-center py-2">
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All allocations within {driftThreshold}% of targets
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
