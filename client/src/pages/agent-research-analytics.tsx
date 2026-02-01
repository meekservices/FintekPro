import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, PieChart, Activity, Target, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function AgentResearchAnalytics() {
  const { data: listsData } = useQuery({
    queryKey: ["/api/research-lists"],
  });

  const lists = (listsData as any)?.lists || [];

  return (
    <AgentLayout title="Research Analytics" description="Performance analysis of your research lists">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{lists.length}</div>
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
                  <div className="text-2xl font-bold">+12.4%</div>
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
                  <div className="text-2xl font-bold">78%</div>
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
                  <div className="text-2xl font-bold">0.85</div>
                  <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="w-full">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
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
                {lists.length > 0 ? (
                  <div className="space-y-4">
                    {lists.map((list: any) => (
                      <div key={list.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="font-medium">{list.name}</div>
                          <Badge variant="outline">{list.itemCount || 0} items</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">1M Return</div>
                            <div className="font-medium text-green-600">+2.3%</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">3M Return</div>
                            <div className="font-medium text-green-600">+8.7%</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">1Y Return</div>
                            <div className="font-medium text-green-600">+15.2%</div>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Risk Metrics</CardTitle>
                  <CardDescription>Key risk indicators for your lists</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Volatility (Annualized)</span>
                      <span className="font-medium">18.5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Max Drawdown</span>
                      <span className="font-medium text-red-600">-12.3%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Beta (vs Nifty)</span>
                      <span className="font-medium">1.15</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Sortino Ratio</span>
                      <span className="font-medium">1.23</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Information Ratio</span>
                      <span className="font-medium">0.45</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk Alerts</CardTitle>
                  <CardDescription>Items requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">High Concentration</div>
                        <div className="text-sm text-muted-foreground">
                          2 lists have &gt;30% allocation to single sector
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Stop Loss Triggered</div>
                        <div className="text-sm text-muted-foreground">
                          1 instrument hit stop loss target
                        </div>
                      </div>
                    </div>
                  </div>
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
                    <span className="font-medium text-green-600">+8.2%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Sector Selection</span>
                    <span className="font-medium text-green-600">+3.1%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Stock Selection (Alpha)</span>
                    <span className="font-medium text-green-600">+2.4%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 border rounded-lg">
                    <span>Timing</span>
                    <span className="font-medium text-red-600">-1.3%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg font-medium">
                    <span>Total Return</span>
                    <span className="text-green-600">+12.4%</span>
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
