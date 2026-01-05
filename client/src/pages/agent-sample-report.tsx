import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, RadialBarChart, RadialBar
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, Target, AlertTriangle, CheckCircle, Lightbulb, Download, Share2, FileText, Briefcase, PiggyBank, Shield, Star, Clock, User, Building2, Wallet, BarChart3, Activity
} from "lucide-react";
import { useLocation } from "wouter";

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
};

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#6B7280', '#EF4444', '#8B5CF6'];

export default function AgentSampleReport() {
  const [, navigate] = useLocation();
  const [selectedSections, setSelectedSections] = useState({
    portfolioSnapshot: true,
    assetAllocation: true,
    sectorExposure: true,
    topHoldings: true,
    riskMetrics: true,
    goals: true,
    freshInvestments: true,
    aiInsights: true,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/portfolio-reports/sample'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data?.report) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">Failed to load sample report</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const report = data.report;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Portfolio Analysis Report</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Sample Report - {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-share">
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
            <Button size="sm" data-testid="button-download">
              <Download className="h-4 w-4 mr-2" /> Download PDF
            </Button>
          </div>
        </div>

        <Card className="border-l-4 border-l-primary" data-testid="card-client-summary">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg" data-testid="text-client-name">{report.client.name}</h3>
                <p className="text-sm text-gray-500" data-testid="text-client-pan">PAN: {report.client.pan} | Risk Profile: {report.client.riskProfile}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Prepared by</p>
              <p className="font-medium" data-testid="text-agent-name">{report.agent.name}</p>
              <p className="text-sm text-gray-500" data-testid="text-agent-code">{report.agent.code}</p>
            </div>
          </CardContent>
        </Card>

        {selectedSections.portfolioSnapshot && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="section-portfolio-snapshot">
            <Card data-testid="card-total-value">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Value</span>
                  <Wallet className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold mt-2" data-testid="text-total-value">{formatCurrency(report.portfolio.totalValue)}</p>
                <div className={`flex items-center text-sm mt-1 ${report.portfolio.dayChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-day-change">
                  {report.portfolio.dayChangePercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {formatCurrency(Math.abs(report.portfolio.dayChange))} ({report.portfolio.dayChangePercent}%)
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-overall-gain">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Overall Gain</span>
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold mt-2 text-green-600" data-testid="text-overall-gain">+{formatCurrency(report.portfolio.overallGain)}</p>
                <p className="text-sm text-green-600">+{report.portfolio.overallGainPercent}%</p>
              </CardContent>
            </Card>
            <Card data-testid="card-xirr">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">XIRR</span>
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold mt-2" data-testid="text-xirr">{report.portfolio.xirr}%</p>
                <p className="text-sm text-gray-500">Annualized return</p>
              </CardContent>
            </Card>
            <Card data-testid="card-risk-score">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Risk Score</span>
                  <Activity className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold mt-2" data-testid="text-risk-score">{report.riskMetrics.riskScore}/100</p>
                <Badge variant="secondary" data-testid="badge-risk-category">{report.riskMetrics.riskCategory}</Badge>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="allocation" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="allocation" data-testid="tab-allocation">Asset Allocation</TabsTrigger>
            <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
            <TabsTrigger value="investments" data-testid="tab-investments">Fresh Investments</TabsTrigger>
          </TabsList>

          <TabsContent value="allocation" className="space-y-6" data-testid="tabcontent-allocation">
            {selectedSections.assetAllocation && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-asset-allocation">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" /> Asset Allocation
                    </CardTitle>
                    <CardDescription>Current portfolio distribution</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.assetAllocation.current}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            paddingAngle={2}
                            dataKey="percentage"
                            nameKey="asset"
                            label={({ asset, percentage }) => `${asset}: ${percentage}%`}
                          >
                            {report.assetAllocation.current.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => `${value}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2" data-testid="list-asset-allocation">
                      {report.assetAllocation.current.map((item: any, index: number) => (
                        <div key={item.asset} className="flex items-center justify-between" data-testid={`row-allocation-${item.asset.toLowerCase().replace(/\s+/g, '-')}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || COLORS[index] }}></div>
                            <span data-testid={`text-allocation-asset-${index}`}>{item.asset}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium" data-testid={`text-allocation-percentage-${index}`}>{item.percentage}%</span>
                            <span className="text-gray-500 ml-2" data-testid={`text-allocation-value-${index}`}>({formatCurrency(item.value)})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" /> Target vs Actual
                    </CardTitle>
                    <CardDescription>
                      {report.assetAllocation.rebalancingNeeded && (
                        <Badge variant="destructive" className="mt-1">Rebalancing Needed ({report.assetAllocation.driftPercentage}% drift)</Badge>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.assetAllocation.current.map((item: any) => ({
                          asset: item.asset,
                          current: item.percentage,
                          target: report.assetAllocation.target.find((t: any) => t.asset === item.asset)?.percentage || 0
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="asset" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="current" name="Current" fill="#4F46E5" />
                          <Bar dataKey="target" name="Target" fill="#10B981" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedSections.sectorExposure && (
              <Card>
                <CardHeader>
                  <CardTitle>Sector Exposure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={report.sectorExposure} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" unit="%" />
                        <YAxis type="category" dataKey="sector" width={120} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Bar dataKey="percentage" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="holdings" data-testid="tabcontent-holdings">
            {selectedSections.topHoldings && (
              <Card data-testid="card-top-holdings">
                <CardHeader>
                  <CardTitle>Top Holdings</CardTitle>
                  <CardDescription>Your major investments by value</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="list-holdings">
                    {report.topHoldings.map((holding: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-holding-${index}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`text-holding-name-${index}`}>{holding.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" data-testid={`badge-holding-type-${index}`}>{holding.type}</Badge>
                              {holding.rating && (
                                <div className="flex items-center" data-testid={`stars-holding-rating-${index}`}>
                                  {[...Array(holding.rating)].map((_, i) => (
                                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" data-testid={`text-holding-value-${index}`}>{formatCurrency(holding.value)}</p>
                          <p className="text-sm text-gray-500" data-testid={`text-holding-percentage-${index}`}>{holding.percentage}% of portfolio</p>
                          <p className={`text-sm ${holding.returns1Y >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`text-holding-returns-${index}`}>
                            1Y: {holding.returns1Y >= 0 ? '+' : ''}{holding.returns1Y}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance vs Benchmark</CardTitle>
                <CardDescription>
                  Compared with {report.comparisonWithBenchmark.benchmarkName} | 
                  <Badge className="ml-2" variant={report.comparisonWithBenchmark.tracking === 'Outperforming' ? 'default' : 'destructive'}>
                    Alpha: +{report.comparisonWithBenchmark.alpha}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={report.performanceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis unit="%" />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Legend />
                      <Bar dataKey="portfolioReturn" name="Portfolio" fill="#4F46E5" />
                      <Bar dataKey="benchmarkReturn" name="Benchmark" fill="#9CA3AF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {selectedSections.riskMetrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Beta</p>
                    <p className="text-2xl font-bold">{report.riskMetrics.beta}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Sharpe Ratio</p>
                    <p className="text-2xl font-bold">{report.riskMetrics.sharpeRatio}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Std Deviation</p>
                    <p className="text-2xl font-bold">{report.riskMetrics.standardDeviation}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-gray-500">Max Drawdown</p>
                    <p className="text-2xl font-bold text-red-600">{report.riskMetrics.maxDrawdown}%</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="goals" data-testid="tabcontent-goals">
            {selectedSections.goals && (
              <Card data-testid="card-financial-goals">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" /> Financial Goals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6" data-testid="list-goals">
                    {report.goals.map((goal: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4" data-testid={`row-goal-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-semibold" data-testid={`text-goal-name-${index}`}>{goal.name}</h4>
                            <p className="text-sm text-gray-500" data-testid={`text-goal-date-${index}`}>Target: {new Date(goal.targetDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                          </div>
                          <Badge variant={goal.onTrack ? 'default' : 'destructive'} data-testid={`badge-goal-status-${index}`}>
                            {goal.onTrack ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                            {goal.onTrack ? 'On Track' : 'Off Track'}
                          </Badge>
                        </div>
                        <Progress value={goal.progress} className="h-2 mb-2" data-testid={`progress-goal-${index}`} />
                        <div className="flex justify-between text-sm">
                          <span data-testid={`text-goal-current-${index}`}>Current: {formatCurrency(goal.currentValue)}</span>
                          <span className="font-medium" data-testid={`text-goal-progress-${index}`}>{goal.progress}% complete</span>
                          <span data-testid={`text-goal-target-${index}`}>Target: {formatCurrency(goal.targetAmount)}</span>
                        </div>
                        {goal.shortfall && (
                          <p className="text-sm text-red-600 mt-2" data-testid={`text-goal-shortfall-${index}`}>Shortfall: {formatCurrency(goal.shortfall)} - Increase SIP recommended</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="investments" className="space-y-6" data-testid="tabcontent-investments">
            {selectedSections.freshInvestments && (
              <>
                <Card className="border-l-4 border-l-green-500" data-testid="card-investable-surplus">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Investable Surplus Detected</h3>
                        <p className="text-gray-500">Based on income and expense analysis</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600" data-testid="text-investable-surplus">{formatCurrency(report.freshInvestments.investableSurplus)}</p>
                        <p className="text-sm text-gray-500" data-testid="text-suggested-allocation">Suggested: {formatCurrency(report.freshInvestments.suggestedAllocation.lumpsum)} Lumpsum + {formatCurrency(report.freshInvestments.suggestedAllocation.sipMonthly)}/mo SIP</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-lumpsum-recommendations">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" /> Lumpsum Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4" data-testid="list-lumpsum-recommendations">
                        {report.freshInvestments.lumpsumRecommendations.map((fund: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4" data-testid={`row-lumpsum-${index}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium" data-testid={`text-lumpsum-name-${index}`}>{fund.name}</p>
                                <Badge variant="outline" data-testid={`badge-lumpsum-category-${index}`}>{fund.category}</Badge>
                              </div>
                              <Badge className="bg-green-100 text-green-800" data-testid={`badge-lumpsum-match-${index}`}>{fund.matchScore}% Match</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                              <div>
                                <p className="text-gray-500">Expected Return</p>
                                <p className="font-medium text-green-600" data-testid={`text-lumpsum-return-${index}`}>{fund.expectedReturn}%</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Risk</p>
                                <p className="font-medium" data-testid={`text-lumpsum-risk-${index}`}>{fund.riskLevel}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Rating</p>
                                <div className="flex" data-testid={`stars-lumpsum-rating-${index}`}>
                                  {[...Array(fund.rating)].map((_, i) => (
                                    <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 italic" data-testid={`text-lumpsum-reason-${index}`}>"{fund.reason}"</p>
                            <Button size="sm" className="mt-2 w-full" data-testid={`button-invest-lumpsum-${index}`}>
                              Invest Now
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-sip-recommendations">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PiggyBank className="h-5 w-5" /> SIP Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4" data-testid="list-sip-recommendations">
                        {report.freshInvestments.sipRecommendations.map((fund: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4" data-testid={`row-sip-${index}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium" data-testid={`text-sip-name-${index}`}>{fund.name}</p>
                                <Badge variant="outline" data-testid={`badge-sip-category-${index}`}>{fund.category}</Badge>
                              </div>
                              <Badge className="bg-blue-100 text-blue-800" data-testid={`badge-sip-match-${index}`}>{fund.matchScore}% Match</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                              <div>
                                <p className="text-gray-500">Suggested SIP</p>
                                <p className="font-medium" data-testid={`text-sip-suggested-${index}`}>{formatCurrency(fund.suggestedSIP)}/mo</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Expected</p>
                                <p className="font-medium text-green-600" data-testid={`text-sip-return-${index}`}>{fund.expectedReturn}%</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Min SIP</p>
                                <p className="font-medium" data-testid={`text-sip-min-${index}`}>{formatCurrency(fund.minSIP)}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-2 italic" data-testid={`text-sip-reason-${index}`}>"{fund.reason}"</p>
                            <Button size="sm" variant="outline" className="mt-2 w-full" data-testid={`button-start-sip-${index}`}>
                              Start SIP
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        {selectedSections.aiInsights && (
          <Card data-testid="card-ai-insights">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" /> AI-Powered Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="list-ai-insights">
                {report.aiInsights.map((insight: any, index: number) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    insight.priority === 'high' ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10' :
                    insight.priority === 'medium' ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' :
                    'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10'
                  }`} data-testid={`row-insight-${index}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {insight.type === 'opportunity' && <TrendingUp className="h-4 w-4 text-green-600" />}
                          {insight.type === 'rebalancing' && <Target className="h-4 w-4 text-blue-600" />}
                          {insight.type === 'risk' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                          {insight.type === 'goal' && <Target className="h-4 w-4 text-purple-600" />}
                          <h4 className="font-semibold" data-testid={`text-insight-title-${index}`}>{insight.title}</h4>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1" data-testid={`text-insight-description-${index}`}>{insight.description}</p>
                      </div>
                      {insight.actionable && (
                        <Button size="sm" variant="outline" data-testid={`button-action-${index}`}>Take Action</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-100 dark:bg-gray-800" data-testid="card-disclaimers">
          <CardContent className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Disclaimers
            </h4>
            <ul className="text-xs text-gray-500 space-y-1" data-testid="list-disclaimers">
              {report.disclaimers.map((disclaimer: string, index: number) => (
                <li key={index} data-testid={`text-disclaimer-${index}`}>• {disclaimer}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
