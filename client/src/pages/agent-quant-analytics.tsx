import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import PythonServiceUnavailable from "@/components/PythonServiceUnavailable";
import {
  BarChart3,
  TrendingUp,
  Calculator,
  Brain,
  Layers,
  PieChart,
  AlertTriangle,
  Loader2,
  RefreshCw,
  TrendingDown,
  Info
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Cell,
  AreaChart,
  Area
} from "recharts";

export default function AgentQuantAnalytics() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("portfolio-xirr");

  // Health Check Query
  const { data: healthData, isLoading: healthLoading } = useQuery<any>({
    queryKey: ["/api/python/health"],
    retry: false
  });

  const serviceOffline = !healthLoading && healthData && (
    healthData.status === "not_configured" || healthData.status === "unreachable"
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Quant Analytics Hub</h1>
        <p className="text-muted-foreground">
          Advanced portfolio analytics and forecasting powered by the Python Quant Engine.
        </p>
      </div>

      {serviceOffline && (
        <PythonServiceUnavailable
          feature="analytics"
          reason={
            healthData?.status === "not_configured"
              ? "Python analytics service not configured. Set PYTHON_SERVICE_URL to enable all quant features."
              : "Python analytics service is currently unreachable. Features will show basic-mode fallbacks."
          }
          onRetry={() => window.location.reload()}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ScrollableTabsList>
          <TabsTrigger value="portfolio-xirr" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Portfolio XIRR
          </TabsTrigger>
          <TabsTrigger value="rolling-returns" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Rolling Returns
          </TabsTrigger>
          <TabsTrigger value="sip-simulator" className="gap-2">
            <Calculator className="h-4 w-4" /> SIP Simulator
          </TabsTrigger>
          <TabsTrigger value="return-forecast" className="gap-2">
            <Brain className="h-4 w-4" /> Return Forecast
          </TabsTrigger>
          <TabsTrigger value="fund-overlap" className="gap-2">
            <Layers className="h-4 w-4" /> Fund Overlap
          </TabsTrigger>
          <TabsTrigger value="mvo-optimizer" className="gap-2">
            <PieChart className="h-4 w-4" /> MVO Optimizer
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="portfolio-xirr">
          <PortfolioXIRR />
        </TabsContent>
        <TabsContent value="rolling-returns">
          <RollingReturns />
        </TabsContent>
        <TabsContent value="sip-simulator">
          <SIPSimulator />
        </TabsContent>
        <TabsContent value="return-forecast">
          <ReturnForecast />
        </TabsContent>
        <TabsContent value="fund-overlap">
          <FundOverlap />
        </TabsContent>
        <TabsContent value="mvo-optimizer">
          <MVOTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PortfolioXIRR() {
  const [userId, setUserId] = useState("");
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/quant/portfolio-xirr", { user_id: userId }],
    enabled: false,
  });

  const handleCalculate = () => {
    if (!userId) return;
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio XIRR Analysis</CardTitle>
        <CardDescription>Calculate Internal Rate of Return for a specific client portfolio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4 items-end max-w-sm">
          <div className="flex-1 space-y-2">
            <Label htmlFor="user-id">Client User ID</Label>
            <Input 
              id="user-id" 
              placeholder="Enter User ID" 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <Button onClick={handleCalculate} disabled={isLoading || !userId}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Calculate
          </Button>
        </div>

        {data?.degraded && (
          <PythonServiceUnavailable
            feature={data.feature ?? "portfolio-xirr"}
            reason={data.reason}
            onRetry={() => refetch()}
            fallback={data.fallback?.label ? (
              <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
            ) : undefined}
          />
        )}

        {data && !data.degraded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Annualized Return (XIRR)</p>
                <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-300">{(data.xirr * 100).toFixed(2)}%</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">Invested Amount</p>
                  <p className="text-lg font-semibold">₹{data.invested?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-card border rounded-lg">
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="text-lg font-semibold">₹{data.currentValue?.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="h-[250px] bg-card border rounded-lg p-4">
              <p className="text-sm font-medium mb-4">Investment Timeline</p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, "Value"]}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.1} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RollingReturns() {
  const [schemeCode, setSchemeCode] = useState("");
  const [periods, setPeriods] = useState<string[]>(["1Y", "3Y", "5Y"]);
  
  const periodOptions = ["1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y"];

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/quant/rolling-returns", { scheme_code: schemeCode, periods: periods.join(",") }],
    enabled: false,
  });

  const togglePeriod = (p: string) => {
    setPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rolling Returns Heatmap</CardTitle>
        <CardDescription>Analyze consistency of performance across different holding periods.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Scheme Code</Label>
              <Input 
                placeholder="e.g. INF209K01157" 
                value={schemeCode} 
                onChange={(e) => setSchemeCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Analysis Periods</Label>
              <div className="flex flex-wrap gap-2">
                {periodOptions.map(p => (
                  <Button
                    key={p}
                    variant={periods.includes(p) ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePeriod(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={() => refetch()} disabled={isLoading || !schemeCode || periods.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate Analysis
          </Button>
        </div>

        {data?.degraded && (
          <PythonServiceUnavailable
            feature={data.feature ?? "rolling-returns"}
            reason={data.reason}
            onRetry={() => refetch()}
            fallback={data.fallback?.label ? (
              <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
            ) : undefined}
          />
        )}

        {data && !data.degraded && (
          <div className="pt-4 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.rollingStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis unit="%" />
                <Tooltip 
                   formatter={(value: number) => [`${value.toFixed(2)}%`, "Return"]}
                   contentStyle={{ borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="average" name="Average Return" fill="#3b82f6" />
                <Bar dataKey="minimum" name="Minimum Return" fill="#ef4444" />
                <Bar dataKey="maximum" name="Maximum Return" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SIPSimulator() {
  const [params, setParams] = useState({
    sipAmount: "10000",
    horizonMonths: "120",
    expectedReturn: "12",
    stepUpRate: "10"
  });

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/forecasting/sip-simulate", params],
    enabled: false,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/python/forecasting/sip-simulate", {
        sipAmount: parseFloat(params.sipAmount),
        horizonMonths: parseInt(params.horizonMonths),
        expectedReturn: parseFloat(params.expectedReturn),
        stepUpRate: parseFloat(params.stepUpRate)
      });
      return res.json();
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>SIP Simulator</CardTitle>
          <CardDescription>Simulate wealth creation with step-up SIPs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Monthly SIP Amount (₹)</Label>
            <Input type="number" value={params.sipAmount} onChange={(e) => setParams({...params, sipAmount: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Investment Horizon (Months)</Label>
            <Input type="number" value={params.horizonMonths} onChange={(e) => setParams({...params, horizonMonths: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Expected Annual Return (%)</Label>
            <Input type="number" value={params.expectedReturn} onChange={(e) => setParams({...params, expectedReturn: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Annual Step-up Rate (%)</Label>
            <Input type="number" value={params.stepUpRate} onChange={(e) => setParams({...params, stepUpRate: e.target.value})} />
          </div>
          <Button className="w-full" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Simulate Wealth
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Wealth Projection</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.degraded ? (
            <PythonServiceUnavailable
              feature={data.feature ?? "sip-simulate"}
              reason={data.reason}
              onRetry={() => refetch()}
              fallback={data.fallback?.label ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
              ) : undefined}
            />
          ) : data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Total Invested</p>
                  <p className="text-xl font-bold">₹{data.totalInvested?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-emerald-500/10 text-emerald-600 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Nominal Value</p>
                  <p className="text-xl font-bold">₹{data.finalValue?.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-blue-500/10 text-blue-600 rounded-lg">
                  <p className="text-xs text-muted-foreground uppercase">Inflation Adj.</p>
                  <p className="text-xl font-bold">₹{data.inflationAdjustedValue?.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.projection}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" label={{ value: 'Months', position: 'insideBottom', offset: -5 }} />
                    <YAxis tickFormatter={(val) => `₹${(val/100000).toFixed(0)}L`} />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, "Value"]}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Area type="monotone" dataKey="value" name="Nominal Value" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="inflationAdjusted" name="Inflation Adjusted" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              Run simulation to see projection
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnForecast() {
  const [params, setParams] = useState({
    assetType: "Equity",
    currentValue: "1000000",
    annualReturn: "12",
    years: "5"
  });

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/forecasting/return-forecast", params],
    enabled: false,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/python/forecasting/return-forecast", {
        assetType: params.assetType,
        currentValue: parseFloat(params.currentValue),
        annualReturn: parseFloat(params.annualReturn),
        years: parseInt(params.years)
      });
      return res.json();
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Forecast Parameters</CardTitle>
          <CardDescription>Probabilistic return forecasting with confidence bands.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Asset Class</Label>
            <Select value={params.assetType} onValueChange={(v) => setParams({...params, assetType: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Equity">Equity</SelectItem>
                <SelectItem value="Debt">Debt</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Current Value (₹)</Label>
            <Input type="number" value={params.currentValue} onChange={(e) => setParams({...params, currentValue: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Mean Annual Return (%)</Label>
            <Input type="number" value={params.annualReturn} onChange={(e) => setParams({...params, annualReturn: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Forecast Period (Years)</Label>
            <Input type="number" value={params.years} onChange={(e) => setParams({...params, years: e.target.value})} />
          </div>
          <Button className="w-full" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Run Monte Carlo Forecast
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Confidence Intervals (95%)</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.degraded ? (
            <PythonServiceUnavailable
              feature={data.feature ?? "return-forecast"}
              reason={data.reason}
              onRetry={() => refetch()}
              fallback={data.fallback?.label ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
              ) : undefined}
            />
          ) : data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground uppercase">Bear Case (5%)</p>
                  <p className="text-lg font-bold text-red-500">₹{data.bearCase?.toLocaleString()}</p>
                </div>
                <div className="p-3 border rounded bg-muted/30">
                  <p className="text-xs text-muted-foreground uppercase">Base Case</p>
                  <p className="text-lg font-bold">₹{data.baseCase?.toLocaleString()}</p>
                </div>
                <div className="p-3 border rounded">
                  <p className="text-xs text-muted-foreground uppercase">Bull Case (95%)</p>
                  <p className="text-lg font-bold text-emerald-500">₹{data.bullCase?.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(val) => `₹${(val/100000).toFixed(0)}L`} />
                    <Tooltip 
                      formatter={(value: number) => [`₹${value.toLocaleString()}`, "Value"]}
                      contentStyle={{ borderRadius: '8px' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="upper" name="Bull Case" stroke="#10b981" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="mean" name="Expected Value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="lower" name="Bear Case" stroke="#ef4444" strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              Click run to generate forecasting bands
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FundOverlap() {
  const [funds, setFunds] = useState([
    { isin: "", weight: 50 },
    { isin: "", weight: 50 }
  ]);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/portfolio/overlap-analysis", funds],
    enabled: false,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/python/portfolio/overlap-analysis", {
        funds: funds.filter(f => f.isin)
      });
      return res.json();
    }
  });

  const addFund = () => setFunds([...funds, { isin: "", weight: 0 }]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Fund Overlap Analysis</CardTitle>
          <CardDescription>Detect common holdings across different mutual funds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {funds.map((fund, idx) => (
            <div key={idx} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label>Fund ISIN {idx + 1}</Label>
                <Input 
                  placeholder="INE..." 
                  value={fund.isin} 
                  onChange={(e) => {
                    const next = [...funds];
                    next[idx].isin = e.target.value;
                    setFunds(next);
                  }}
                />
              </div>
              <div className="w-24 space-y-2">
                <Label>Weight %</Label>
                <Input 
                  type="number" 
                  value={fund.weight} 
                  onChange={(e) => {
                    const next = [...funds];
                    next[idx].weight = parseFloat(e.target.value);
                    setFunds(next);
                  }}
                />
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={addFund}>Add Fund</Button>
          <Button className="w-full" onClick={() => refetch()} disabled={isLoading || funds.every(f => !f.isin)}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Calculate Overlap
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overlap Results</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.degraded ? (
            <PythonServiceUnavailable
              feature={data.feature ?? "portfolio-overlap"}
              reason={data.reason}
              onRetry={() => refetch()}
              fallback={data.fallback?.label ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
              ) : undefined}
            />
          ) : data ? (
            <div className="space-y-6">
              <div className="p-6 bg-amber-500/10 text-center rounded-xl">
                <p className="text-sm text-amber-600 font-medium mb-1">Portfolio Overlap Score</p>
                <p className="text-5xl font-bold text-amber-700">{data.overlapScore}%</p>
              </div>
              <div className="space-y-4">
                <p className="text-sm font-medium">Common Holdings Impact</p>
                {data.commonHoldings?.map((h: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2 border-b">
                    <span className="text-sm truncate mr-4">{h.name}</span>
                    <span className="text-sm font-mono text-muted-foreground">{h.combinedWeight}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              Analyze funds to see overlap data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MVOTab() {
  const [assets, setAssets] = useState([
    { name: "Large Cap", weight: 40, expectedReturn: 12, risk: 15 },
    { name: "Mid Cap", weight: 30, expectedReturn: 15, risk: 20 },
    { name: "Debt", weight: 20, expectedReturn: 7, risk: 5 },
    { name: "Gold", weight: 10, expectedReturn: 9, risk: 12 }
  ]);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/python/quant/mvo", assets],
    enabled: false,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/python/quant/mvo", { assets });
      return res.json();
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Mean-Variance Optimizer</CardTitle>
          <CardDescription>Find the optimal asset allocation on the Efficient Frontier.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {assets.map((asset, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">Asset Class</Label>
                  <Input value={asset.name} readOnly size={1} className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Return %</Label>
                  <Input type="number" value={asset.expectedReturn} className="h-8" onChange={(e) => {
                    const next = [...assets];
                    next[idx].expectedReturn = parseFloat(e.target.value);
                    setAssets(next);
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Risk %</Label>
                  <Input type="number" value={asset.risk} className="h-8" onChange={(e) => {
                    const next = [...assets];
                    next[idx].risk = parseFloat(e.target.value);
                    setAssets(next);
                  }} />
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full mt-4" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Optimize Portfolio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Efficient Frontier</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.degraded ? (
            <PythonServiceUnavailable
              feature={data.feature ?? "mvo"}
              reason={data.reason}
              onRetry={() => refetch()}
              fallback={data.fallback?.label ? (
                <p className="text-sm text-amber-800 dark:text-amber-300">{String(data.fallback.label)}</p>
              ) : undefined}
            />
          ) : data ? (
            <div className="space-y-6">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.frontier}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="risk" type="number" label={{ value: 'Risk (Std Dev)', position: 'insideBottom', offset: -5 }} />
                    <YAxis dataKey="return" type="number" label={{ value: 'Return %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="return" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Suggested Optimal Allocation</p>
                <div className="grid grid-cols-2 gap-4">
                  {data.optimalWeights?.map((w: any, i: number) => (
                    <div key={i} className="flex justify-between p-2 bg-muted/50 rounded text-xs">
                      <span>{w.name}</span>
                      <span className="font-bold">{w.weight}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
              Click optimize to compute efficient frontier
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
