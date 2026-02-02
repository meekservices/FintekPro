import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Play, 
  FileText,
  Loader2,
  RefreshCw
} from "lucide-react";

interface WhatIfProjection {
  scenarioName: string;
  projectedValue1Y: number;
  projectedValue3Y: number;
  projectedValue5Y: number;
  projectedValue10Y: number;
  maxDrawdown: number;
  probabilityOfLoss: number;
  valueAtRisk95: number;
}

interface WhatIfResult {
  proposalId: string;
  mode: 'static' | 'interactive';
  baseScenario: WhatIfProjection;
  scenarios: WhatIfProjection[];
  generatedAt: string;
}

interface WhatIfSimulatorProps {
  proposalId: string;
}

const SCENARIO_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  base: { label: 'Base Case', color: 'bg-blue-100 text-blue-700', icon: <Minus className="h-3 w-3" /> },
  bull_10: { label: 'Bull (+10%)', color: 'bg-green-100 text-green-700', icon: <TrendingUp className="h-3 w-3" /> },
  bear_10: { label: 'Bear (-10%)', color: 'bg-orange-100 text-orange-700', icon: <TrendingDown className="h-3 w-3" /> },
  bear_20: { label: 'Bear (-20%)', color: 'bg-red-100 text-red-700', icon: <TrendingDown className="h-3 w-3" /> },
  custom: { label: 'Custom', color: 'bg-purple-100 text-purple-700', icon: <RefreshCw className="h-3 w-3" /> }
};

export function WhatIfSimulator({ proposalId }: WhatIfSimulatorProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'static' | 'interactive'>('static');
  const [returnDelta, setReturnDelta] = useState(0);
  const [volatility, setVolatility] = useState(1);

  const { data: scenarios, isLoading } = useQuery<{ proposalId: string; scenarios: WhatIfProjection[] }>({
    queryKey: ['/api/proposal-builder/what-if', proposalId, 'scenarios'],
    queryFn: async () => {
      const response = await fetch(`/api/proposal-builder/what-if/${proposalId}/scenarios`);
      if (!response.ok) throw new Error('Failed to fetch scenarios');
      return response.json();
    },
    enabled: !!proposalId
  });

  const runSimulation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/proposal-builder/what-if/${proposalId}`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          assumptions: mode === 'interactive' ? { returnDelta, volatility } : undefined
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposal-builder/what-if', proposalId] });
      toast({
        title: 'Simulation Complete',
        description: `${mode === 'static' ? 'Static scenarios' : 'Custom scenario'} generated successfully`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Simulation Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const toggleReportInclusion = useMutation({
    mutationFn: async ({ scenarioName, include }: { scenarioName: string; include: boolean }) => {
      return apiRequest(`/api/proposal-builder/what-if/${proposalId}/toggle-report`, {
        method: 'POST',
        body: JSON.stringify({ scenarioName, include })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposal-builder/what-if', proposalId] });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          What-If Simulator
        </CardTitle>
        <CardDescription>
          Analyze portfolio performance under different market scenarios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'static' | 'interactive')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="static">Static Scenarios</TabsTrigger>
            <TabsTrigger value="interactive">Interactive</TabsTrigger>
          </TabsList>

          <TabsContent value="static" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Generate standard market scenarios: Base Case, Bull (+10%), Bear (-10%), and Bear (-20%).
            </p>
            <Button 
              onClick={() => runSimulation.mutate()} 
              disabled={runSimulation.isPending}
              className="w-full"
            >
              {runSimulation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Generate Static Scenarios
            </Button>
          </TabsContent>

          <TabsContent value="interactive" className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Return Adjustment</Label>
                  <span className={`font-mono text-sm ${returnDelta > 0 ? 'text-green-600' : returnDelta < 0 ? 'text-red-600' : ''}`}>
                    {returnDelta > 0 ? '+' : ''}{returnDelta}%
                  </span>
                </div>
                <Slider
                  value={[returnDelta]}
                  onValueChange={([v]) => setReturnDelta(v)}
                  min={-30}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>-30%</span>
                  <span>0%</span>
                  <span>+30%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Volatility Multiplier</Label>
                  <span className="font-mono text-sm">{volatility.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[volatility]}
                  onValueChange={([v]) => setVolatility(v)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Low (0.5x)</span>
                  <span>Normal (1x)</span>
                  <span>High (2x)</span>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => runSimulation.mutate()} 
              disabled={runSimulation.isPending}
              className="w-full"
            >
              {runSimulation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Custom Simulation
            </Button>
          </TabsContent>
        </Tabs>

        {scenarios?.scenarios && scenarios.scenarios.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Scenario Results</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead className="text-right">1 Year</TableHead>
                  <TableHead className="text-right">3 Years</TableHead>
                  <TableHead className="text-right">5 Years</TableHead>
                  <TableHead className="text-right">Max Drawdown</TableHead>
                  <TableHead className="text-center">Include in Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.scenarios.map((scenario) => {
                  const config = SCENARIO_LABELS[scenario.scenarioName] || SCENARIO_LABELS.custom;
                  return (
                    <TableRow key={scenario.scenarioName}>
                      <TableCell>
                        <Badge className={config.color}>
                          {config.icon}
                          <span className="ml-1">{config.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(scenario.projectedValue1Y)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(scenario.projectedValue3Y)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(scenario.projectedValue5Y)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">
                        -{scenario.maxDrawdown}%
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          onCheckedChange={(checked) => 
                            toggleReportInclusion.mutate({ 
                              scenarioName: scenario.scenarioName, 
                              include: checked 
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
