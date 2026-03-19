import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Users, 
  MapPin, 
  Building2, 
  Star, 
  DollarSign,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Search,
  Network,
  Target,
  Flame,
  Snowflake,
  ThermometerSun
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface AnalyticsSummary {
  totalProspects: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  avgLeadScore: number;
  topSectors: Array<{ sector: string; count: number }>;
  topStates: Array<{ state: string; count: number }>;
  recentAlerts: Array<{
    id: string;
    type: string;
    companyName?: string;
    message: string;
    priority: string;
    createdAt: string;
  }>;
  surplusCompaniesCount: number;
}

interface SectorData {
  sector: string;
  count: number;
  avgLeadScore: number;
}

interface GeoRegion {
  state: string;
  prospectCount: number;
  totalRevenue: number;
  avgLeadScore: number;
  hotLeadsCount: number;
  penetrationRate: number;
  growthPotential: 'high' | 'medium' | 'low';
}

interface LeadScore {
  companyId: string;
  companyName: string;
  cin: string;
  totalScore: number;
  leadGrade: string;
  priority: string;
  strengths: string[];
  concerns: string[];
  outreachStrategy: string;
}

interface InvestableSurplus {
  companyId: string;
  companyName: string;
  cin: string;
  investableSurplus: number;
  surplusCategory: string;
  investmentReadiness: number;
  recommendations: string[];
}

export default function ProspectAnalytics() {
  const { toast } = useToast();
  const [searchCIN, setSearchCIN] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['/api/admin/analytics/summary']
  });

  const { data: sectors } = useQuery<SectorData[]>({
    queryKey: ['/api/admin/analytics/sectors']
  });

  const { data: geoData } = useQuery<{ regions: GeoRegion[]; topStates: string[]; underservedRegions: string[] }>({
    queryKey: ['/api/admin/analytics/geo/heatmap']
  });

  const { data: surplusCompanies } = useQuery<{ companies: InvestableSurplus[] }>({
    queryKey: ['/api/admin/analytics/surplus']
  });

  const scoreLeadMutation = useMutation({
    mutationFn: async (cin: string) => {
      return apiRequest(`/api/admin/analytics/score/${cin}`);
    },
    onSuccess: (data: LeadScore) => {
      toast({ 
        title: `Lead Score: ${data.totalScore} (${data.leadGrade})`,
        description: `Priority: ${data.priority}`
      });
    },
    onError: () => {
      toast({ 
        title: 'Failed to score lead',
        variant: 'destructive'
      });
    }
  });

  const checkAlertsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/analytics/alerts/check', {
        method: 'POST',
        body: JSON.stringify({ minLeadScore: 70 })
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics/summary'] });
      toast({ title: `Found ${data.count} new prospects` });
    }
  });

  if (summaryLoading) {
    return <LoadingState variant="list" />;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'hot': return 'bg-red-500';
      case 'warm': return 'bg-orange-500';
      case 'cold': return 'bg-blue-500';
      default: return 'bg-muted';
    }
  };

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-green-600';
    if (grade.startsWith('B')) return 'text-blue-600';
    if (grade === 'C') return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)} L`;
    return `₹${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="title-prospect-analytics">
            Prospect Analytics
          </h1>
          <p className="text-muted-foreground">
            Advanced client scouting with Credhive intelligence
          </p>
        </div>
        <Button 
          onClick={() => checkAlertsMutation.mutate()}
          disabled={checkAlertsMutation.isPending}
          data-testid="button-check-alerts"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${checkAlertsMutation.isPending ? 'animate-spin' : ''}`} />
          Check for New Prospects
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-prospects">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalProspects || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg Score: {summary?.avgLeadScore || 0}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-hot-leads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot Leads</CardTitle>
            <Flame className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary?.hotLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Score 70+</p>
          </CardContent>
        </Card>

        <Card data-testid="card-warm-leads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warm Leads</CardTitle>
            <ThermometerSun className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary?.warmLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Score 50-69</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cold-leads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cold Leads</CardTitle>
            <Snowflake className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.coldLeads || 0}</div>
            <p className="text-xs text-muted-foreground">Score &lt;50</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="surplus" data-testid="tab-surplus">Investable Surplus</TabsTrigger>
          <TabsTrigger value="scoring" data-testid="tab-scoring">Lead Scoring</TabsTrigger>
          <TabsTrigger value="sectors" data-testid="tab-sectors">Sectors</TabsTrigger>
          <TabsTrigger value="geography" data-testid="tab-geography">Geography</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Top Sectors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.topSectors?.map((sector, i) => (
                    <div key={sector.sector} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{i + 1}.</span>
                        <span className="text-sm">{sector.sector}</span>
                      </div>
                      <Badge variant="secondary">{sector.count}</Badge>
                    </div>
                  ))}
                  {(!summary?.topSectors || summary.topSectors.length === 0) && (
                    <p className="text-sm text-muted-foreground">No sector data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Top States
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.topStates?.map((state, i) => (
                    <div key={state.state} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{i + 1}.</span>
                        <span className="text-sm">{state.state}</span>
                      </div>
                      <Badge variant="secondary">{state.count}</Badge>
                    </div>
                  ))}
                  {(!summary?.topStates || summary.topStates.length === 0) && (
                    <p className="text-sm text-muted-foreground">No geographic data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Recent Alerts
              </CardTitle>
              <CardDescription>
                High-value prospects identified automatically
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary?.recentAlerts?.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getPriorityColor(alert.priority)}>{alert.priority}</Badge>
                      <div>
                        <p className="text-sm font-medium">{alert.companyName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{alert.message}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
                {(!summary?.recentAlerts || summary.recentAlerts.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent alerts. Click "Check for New Prospects" to scan.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surplus" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Companies with Investable Surplus
              </CardTitle>
              <CardDescription>
                Companies identified with excess cash for potential investments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {surplusCompanies?.companies?.map((company) => (
                  <div key={company.companyId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{company.companyName}</h4>
                        <p className="text-xs text-muted-foreground">{company.cin}</p>
                      </div>
                      <Badge className={
                        company.surplusCategory === 'high' ? 'bg-green-500' :
                        company.surplusCategory === 'medium' ? 'bg-yellow-500' :
                        'bg-muted'
                      }>
                        {company.surplusCategory.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Investable Surplus</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(company.investableSurplus)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Investment Readiness</p>
                        <div className="flex items-center gap-2">
                          <Progress value={company.investmentReadiness} className="h-2" />
                          <span className="text-sm">{company.investmentReadiness}%</span>
                        </div>
                      </div>
                    </div>
                    {company.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Recommendations:</p>
                        <div className="flex flex-wrap gap-1">
                          {company.recommendations.map((rec, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{rec}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {(!surplusCompanies?.companies || surplusCompanies.companies.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No companies with significant investable surplus found.
                    Add more leads with financial data to analyze.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Smart Lead Scoring
              </CardTitle>
              <CardDescription>
                Multi-factor scoring algorithm for prioritizing outreach
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter CIN to score (e.g., U74999MH2022PTC123456)"
                  value={searchCIN}
                  onChange={(e) => setSearchCIN(e.target.value)}
                  data-testid="input-cin-score"
                />
                <Button 
                  onClick={() => searchCIN && scoreLeadMutation.mutate(searchCIN)}
                  disabled={!searchCIN || scoreLeadMutation.isPending}
                  data-testid="button-score-lead"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Score
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-semibold mb-3">Scoring Components</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span>Financial Health</span>
                    <span className="text-muted-foreground">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Growth Trajectory</span>
                    <span className="text-muted-foreground">20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profitability</span>
                    <span className="text-muted-foreground">25%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Liquidity Position</span>
                    <span className="text-muted-foreground">15%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Governance Quality</span>
                    <span className="text-muted-foreground">10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sector Premium</span>
                    <span className="text-muted-foreground">10%</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-3">Lead Grades</h4>
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-green-600">A+ (85+)</Badge>
                  <Badge className="bg-green-500">A (75-84)</Badge>
                  <Badge className="bg-blue-500">B+ (65-74)</Badge>
                  <Badge className="bg-blue-400">B (55-64)</Badge>
                  <Badge className="bg-yellow-500">C (40-54)</Badge>
                  <Badge className="bg-red-500">D (&lt;40)</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Sector Analysis
              </CardTitle>
              <CardDescription>
                Industry-wise prospect distribution and benchmarks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sectors?.map((sector) => (
                  <div key={sector.sector} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">{sector.sector}</h4>
                      <Badge variant="secondary">{sector.count} companies</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Avg Lead Score</p>
                        <div className="flex items-center gap-2">
                          <Progress value={sector.avgLeadScore} className="h-2" />
                          <span className="text-sm font-medium">{sector.avgLeadScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!sectors || sectors.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No sector data available. Import leads with sector information.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Geographic Distribution
              </CardTitle>
              <CardDescription>
                Prospect density and growth potential by region
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {geoData?.underservedRegions && geoData.underservedRegions.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      🎯 High Growth Potential Regions
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {geoData.underservedRegions.map((region) => (
                        <Badge key={region} className="bg-green-500">{region}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {geoData?.regions?.map((region) => (
                  <div key={region.state} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{region.state}</h4>
                        <p className="text-xs text-muted-foreground">
                          {region.prospectCount} prospects | {region.hotLeadsCount} hot leads
                        </p>
                      </div>
                      <Badge className={
                        region.growthPotential === 'high' ? 'bg-green-500' :
                        region.growthPotential === 'medium' ? 'bg-yellow-500' :
                        'bg-muted'
                      }>
                        {region.growthPotential} potential
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                        <p className="font-semibold">{formatCurrency(region.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Lead Score</p>
                        <div className="flex items-center gap-2">
                          <Progress value={region.avgLeadScore} className="h-2" />
                          <span className="text-sm">{region.avgLeadScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!geoData?.regions || geoData.regions.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No geographic data available. Import leads with location information.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Prospecting Alerts
              </CardTitle>
              <CardDescription>
                Automated notifications for high-value prospects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Alert Thresholds</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Min Revenue</p>
                      <p className="font-medium">₹10 Cr+</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Profit</p>
                      <p className="font-medium">₹1 Cr+</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Score</p>
                      <p className="font-medium">70+</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {summary?.recentAlerts?.map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          alert.priority === 'high' ? 'bg-red-500' :
                          alert.priority === 'medium' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        <div>
                          <p className="font-medium">{alert.companyName || 'Unknown Company'}</p>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-view-alert-${alert.id}`}>
                        View
                      </Button>
                    </div>
                  ))}
                  {(!summary?.recentAlerts || summary.recentAlerts.length === 0) && (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No alerts at this time</p>
                      <Button 
                        className="mt-4"
                        onClick={() => checkAlertsMutation.mutate()}
                        disabled={checkAlertsMutation.isPending}
                      >
                        Check Now
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
