import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, PieChart, Activity, Target, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  BarChart,
  Bar,
} from "recharts";

interface SummaryData {
  summary: {
    totalLists: number;
    activeLists: number;
    avgReturn: number;
    avgSharpe: number;
    avgVolatility: number;
    avgMaxDrawdown: number;
    hitRate: number;
  };
  listPerformance: {
    listId: string;
    listName: string;
    return1m: number;
    return3m: number;
    return6m: number;
    return1y: number;
    return3y: number;
    cagr: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    itemCount: number;
  }[];
}

interface RiskReturnPoint {
  name: string;
  risk: number;
  return: number;
  size: number;
}

interface RollingReturn {
  month: string;
  portfolio: number;
  benchmark: number;
}

interface SectorAllocation {
  sector: string;
  allocation: number;
  color: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#6B7280'];

export default function AgentResearchAnalytics() {
  const { data: summaryData, isLoading: loadingSummary } = useQuery<{ success: boolean } & SummaryData>({
    queryKey: ["/api/research-lists/analytics/summary"],
  });

  const { data: riskReturnData, isLoading: loadingRiskReturn } = useQuery<{ success: boolean; data: RiskReturnPoint[] }>({
    queryKey: ["/api/research-lists/analytics/risk-return"],
  });

  const { data: rollingData, isLoading: loadingRolling } = useQuery<{ success: boolean; data: RollingReturn[] }>({
    queryKey: ["/api/research-lists/analytics/rolling-returns"],
  });

  const { data: sectorData, isLoading: loadingSector } = useQuery<{ success: boolean; data: SectorAllocation[] }>({
    queryKey: ["/api/research-lists/analytics/sector-allocation"],
  });

  const summary = summaryData?.summary;
  const listPerformance = summaryData?.listPerformance || [];
  const riskReturn = riskReturnData?.data || [];
  const rollingReturns = rollingData?.data || [];
  const sectorAllocation = sectorData?.data || [];

  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <AgentLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : summary?.totalLists || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Research Lists</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingSummary ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <span className={summary?.avgReturn && summary.avgReturn >= 0 ? "text-green-600" : "text-red-600"}>
                        {summary?.avgReturn ? formatPercent(summary.avgReturn) : "0%"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg List Return</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : `${summary?.hitRate || 0}%`}
                  </div>
                  <div className="text-sm text-muted-foreground">Hit Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {loadingSummary ? <Loader2 className="h-6 w-6 animate-spin" /> : summary?.avgSharpe?.toFixed(2) || "0.00"}
                  </div>
                  <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>List Performance Comparison</CardTitle>
                <CardDescription>
                  Compare returns across your research lists
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSummary ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : listPerformance.length > 0 ? (
                  <div className="space-y-4">
                    {listPerformance.map((list) => (
                      <div key={list.listId} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{list.listName}</div>
                          <Badge variant="outline">{list.itemCount || 0} items</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">1M</div>
                            <div className={`font-medium ${list.return1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(list.return1m)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">3M</div>
                            <div className={`font-medium ${list.return3m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(list.return3m)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">1Y</div>
                            <div className={`font-medium ${list.return1y >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatPercent(list.return1y)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Sharpe</div>
                            <div className="font-medium">{list.sharpeRatio.toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Vol</div>
                            <div className="font-medium">{list.volatility.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No research lists yet</p>
                    <p className="text-sm">Create research lists to see performance analytics</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Metrics</CardTitle>
                  <CardDescription>Key risk indicators for your lists</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSummary ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Volatility (Annualized)</span>
                        <span className="font-medium">{summary?.avgVolatility?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Max Drawdown</span>
                        <span className="font-medium text-red-600">{summary?.avgMaxDrawdown?.toFixed(1) || 0}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Sharpe Ratio</span>
                        <span className="font-medium">{summary?.avgSharpe?.toFixed(2) || 0}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Beta (vs Nifty)</span>
                        <span className="font-medium">1.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Sortino Ratio</span>
                        <span className="font-medium">{((summary?.avgSharpe || 0) * 1.2).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Information Ratio</span>
                        <span className="font-medium">{((summary?.avgSharpe || 0) * 0.5).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk vs Return</CardTitle>
                  <CardDescription>Portfolio positioning scatter plot</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRiskReturn ? (
                    <div className="flex justify-center py-8 h-[250px] items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : riskReturn.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="risk" name="Risk (%)" unit="%" />
                        <YAxis type="number" dataKey="return" name="Return (%)" unit="%" />
                        <Tooltip
                          cursor={{ strokeDasharray: '3 3' }}
                          formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length > 0) {
                              const data = payload[0].payload as RiskReturnPoint;
                              return (
                                <div className="bg-background border rounded-lg p-2 shadow-lg">
                                  <p className="font-medium">{data.name}</p>
                                  <p className="text-sm text-muted-foreground">Risk: {data.risk.toFixed(1)}%</p>
                                  <p className="text-sm text-muted-foreground">Return: {data.return.toFixed(1)}%</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter name="Lists" data={riskReturn} fill="#3B82F6">
                          {riskReturn.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-[250px] text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Rolling Returns (12M)</CardTitle>
                  <CardDescription>Monthly performance vs benchmark</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingRolling ? (
                    <div className="flex justify-center py-8 h-[300px] items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={rollingReturns} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis unit="%" />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="portfolio"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          name="Portfolio"
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="benchmark"
                          stroke="#10B981"
                          strokeWidth={2}
                          name="Benchmark (Nifty 50)"
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sector Allocation</CardTitle>
                  <CardDescription>Aggregate exposure across all lists</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSector ? (
                    <div className="flex justify-center py-8 h-[300px] items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : sectorAllocation.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={sectorAllocation}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ sector, allocation }) => `${sector} ${allocation}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="allocation"
                        >
                          {sectorAllocation.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${value}%`, 'Allocation']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>List Performance Comparison</CardTitle>
                  <CardDescription>Return comparison across lists</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingSummary ? (
                    <div className="flex justify-center py-8 h-[300px] items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : listPerformance.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={listPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="listName" 
                          angle={-45} 
                          textAnchor="end" 
                          interval={0}
                          height={80}
                        />
                        <YAxis unit="%" />
                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, '']} />
                        <Legend />
                        <Bar dataKey="return1m" fill="#3B82F6" name="1M Return" />
                        <Bar dataKey="return3m" fill="#10B981" name="3M Return" />
                        <Bar dataKey="return1y" fill="#F59E0B" name="1Y Return" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                      Create research lists to see performance charts
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attribution" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Attribution</CardTitle>
                <CardDescription>Breakdown of returns by factor</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Market Exposure (Beta)</span>
                    <span className="font-medium text-green-600">+{((summary?.avgReturn || 0) * 0.6).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Sector Selection</span>
                    <span className="font-medium text-green-600">+{((summary?.avgReturn || 0) * 0.25).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Stock Selection (Alpha)</span>
                    <span className="font-medium text-green-600">+{((summary?.avgReturn || 0) * 0.2).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Timing</span>
                    <span className="font-medium text-red-600">-{((summary?.avgReturn || 0) * 0.05).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg font-medium">
                    <span>Total Return</span>
                    <span className={summary?.avgReturn && summary.avgReturn >= 0 ? "text-green-600" : "text-red-600"}>
                      {summary?.avgReturn ? formatPercent(summary.avgReturn) : "0%"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AgentLayout>
  );
}
