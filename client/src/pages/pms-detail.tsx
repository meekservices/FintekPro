import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Building2, TrendingUp, Shield as LucideShield, 
  BarChart3, PieChart, Award, Briefcase, LineChart, DollarSign, AlertTriangle
} from "lucide-react";
import { useLocation } from "wouter";
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from "recharts";

interface PmsScheme {
  id: string;
  name: string;
  registrationNo: string | null;
  strategy: string | null;
  style: string | null;
  fundHouseName: string | null;
  minInvestment: string | null;
  minSIPInvestment: string | null;
  lockIn: string | null;
  benchmark: string | null;
  fundStatus: string | null;
  aum: string | null;
  return1M: string | null;
  return3M: string | null;
  return6M: string | null;
  return1Y: string | null;
  return3Y: string | null;
  return5Y: string | null;
  returnSI: string | null;
  volatility: string | null;
  maxDrawdown: string | null;
  sharpeRatio: string | null;
  sortinoRatio: string | null;
  informationRatio: string | null;
  beta: string | null;
  alpha: string | null;
  riskScore: number | null;
  inceptionDate: string | null;
  manager?: {
    id: string;
    name: string;
    designation: string | null;
    experienceYears: number | null;
    bio: string | null;
    fundsManaged: number | null;
    totalAumManaged: string | null;
    avgAlpha: string | null;
  } | null;
}

interface MonthlyPerformance {
  year: number;
  month: number;
  returnPercent: string;
  benchmarkReturn: string | null;
}

interface RollingReturns {
  roll1Y: string | null;
  roll3Y: string | null;
  roll5Y: string | null;
  bestRoll1Y: string | null;
  worstRoll1Y: string | null;
  asOfDate: string | null;
}

function formatCurrency(value: string | number | null): string {
  if (!value) return "N/A";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "N/A";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function formatPercent(value: string | null): string {
  if (!value) return "N/A";
  const num = parseFloat(value);
  if (isNaN(num)) return "N/A";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "N/A";
  }
}

function getReturnColor(value: string | null): string {
  if (!value) return "text-muted-foreground";
  const num = parseFloat(value);
  if (isNaN(num)) return "text-muted-foreground";
  return num >= 0 ? "text-green-600" : "text-red-600";
}

function getRiskBadge(score: number | null) {
  if (!score) return <Badge variant="outline">N/A</Badge>;
  if (score <= 3) return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Low Risk</Badge>;
  if (score <= 6) return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">Medium Risk</Badge>;
  return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">High Risk</Badge>;
}

function getStatusBadge(status: string | null) {
  switch (status) {
    case "active": return <Badge className="bg-green-500 text-white">Active</Badge>;
    case "soft_close": return <Badge className="bg-yellow-500 text-white">Soft Close</Badge>;
    case "hard_close": return <Badge className="bg-red-500 text-white">Hard Close</Badge>;
    case "existing_only": return <Badge className="bg-blue-500 text-white">Existing Investors</Badge>;
    default: return <Badge variant="outline">{status || "Unknown"}</Badge>;
  }
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface OtherFund {
  id: string;
  name: string;
  strategy?: string | null;
  category?: string | null;
  fundHouse: string | null;
  aum: string | null;
  return1Y: string | null;
  return3Y: string | null;
  fundType: 'pms' | 'aif';
}

function OtherFundsByManager({ 
  managerId, 
  currentFundId, 
  fundType, 
  navigate 
}: { 
  managerId: string; 
  currentFundId: string; 
  fundType: 'pms' | 'aif';
  navigate: (path: string) => void;
}) {
  const { data, isLoading } = useQuery<{ otherFunds: OtherFund[] }>({
    queryKey: ["/api/store/fund-managers", managerId, "other-funds", { excludeFundId: currentFundId, fundType }],
    enabled: !!managerId,
  });

  const otherFunds = data?.otherFunds || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Other Funds by This Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (otherFunds.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-purple-500" />
          Other Funds by This Manager
        </CardTitle>
        <CardDescription>Explore other investment strategies managed by the same portfolio manager</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {otherFunds.map((fund) => (
            <div
              key={fund.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer bg-muted hover:bg-card"
              onClick={() => navigate(`/${fund.fundType}/${fund.id}`)}
              data-testid={`other-fund-${fund.id}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-sm line-clamp-2">{fund.name}</h4>
                <span className={`text-xs px-2 py-0.5 rounded ${fund.fundType === 'pms' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                  {fund.fundType.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{fund.strategy || fund.category || 'N/A'}</p>
              <div className="flex justify-between text-xs">
                <div>
                  <span className="text-muted-foreground">1Y Return</span>
                  <p className={`font-semibold ${fund.return1Y && parseFloat(fund.return1Y) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercent(fund.return1Y)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">AUM</span>
                  <p className="font-semibold">{formatCurrency(fund.aum)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PMSDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/pms/:id");
  const id = params?.id;

  const { data: scheme, isLoading: schemeLoading } = useQuery<PmsScheme>({
    queryKey: ["/api/store/pms", id],
    enabled: !!id,
  });

  const { data: monthlyData } = useQuery<{ performance: MonthlyPerformance[] }>({
    queryKey: ["/api/store/performance/fund", id, "monthwise", { fundType: "pms" }],
    enabled: !!id,
  });

  const { data: rollingData } = useQuery<{ rolling: RollingReturns | null }>({
    queryKey: ["/api/store/performance/fund", id, "rolling", { fundType: "pms" }],
    enabled: !!id,
  });

  const monthlyPerformance = monthlyData?.performance || [];
  const rolling = rollingData?.rolling;

  const chartData = monthlyPerformance.map(p => ({
    period: `${monthNames[p.month - 1]} ${p.year}`,
    return: parseFloat(p.returnPercent) || 0,
    benchmark: p.benchmarkReturn ? parseFloat(p.benchmarkReturn) : null
  })).reverse();

  if (schemeLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-6 w-96 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">PMS Scheme Not Found</h3>
          <p className="text-muted-foreground mb-4">The requested scheme could not be found.</p>
          <Button onClick={() => navigate("/pms")}>Back to PMS List</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" onClick={() => navigate("/pms")} className="mb-4" data-testid="back-to-list">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to PMS List
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="scheme-name">{scheme.name}</h1>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Building2 className="w-5 h-5" />
            <span>{scheme.fundHouseName || "Unknown Provider"}</span>
            {scheme.registrationNo && (
              <span className="text-sm text-muted-foreground">| Reg: {scheme.registrationNo}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {getStatusBadge(scheme.fundStatus)}
          <Badge variant="outline">{scheme.strategy || "PMS"}</Badge>
          {scheme.style && <Badge variant="outline">{scheme.style}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="w-4 h-4" /> 1Y Return</p>
            <p className={`text-2xl font-bold ${getReturnColor(scheme.return1Y)}`} data-testid="return-1y">
              {formatPercent(scheme.return1Y)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><TrendingUp className="w-4 h-4" /> 3Y Return</p>
            <p className={`text-2xl font-bold ${getReturnColor(scheme.return3Y)}`} data-testid="return-3y">
              {formatPercent(scheme.return3Y)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><PieChart className="w-4 h-4" /> AUM</p>
            <p className="text-2xl font-bold text-indigo-600" data-testid="aum">{formatCurrency(scheme.aum)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground flex items-center gap-1"><LucideShield className="w-4 h-4" /> Risk</p>
            <div className="mt-1">{getRiskBadge(scheme.riskScore)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full md:w-auto grid-cols-4 md:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="manager">Fund Manager</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Scheme Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Minimum Investment</span>
                  <span className="font-medium">{formatCurrency(scheme.minInvestment)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Minimum SIP</span>
                  <span className="font-medium">{formatCurrency(scheme.minSIPInvestment)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Lock-in Period</span>
                  <span className="font-medium">{scheme.lockIn || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Benchmark</span>
                  <span className="font-medium">{scheme.benchmark || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Inception Date</span>
                  <span className="font-medium">{formatDate(scheme.inceptionDate)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Return Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">1 Month</span>
                  <span className={`font-medium ${getReturnColor(scheme.return1M)}`}>{formatPercent(scheme.return1M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">3 Months</span>
                  <span className={`font-medium ${getReturnColor(scheme.return3M)}`}>{formatPercent(scheme.return3M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">6 Months</span>
                  <span className={`font-medium ${getReturnColor(scheme.return6M)}`}>{formatPercent(scheme.return6M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">1 Year</span>
                  <span className={`font-medium ${getReturnColor(scheme.return1Y)}`}>{formatPercent(scheme.return1Y)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">3 Years</span>
                  <span className={`font-medium ${getReturnColor(scheme.return3Y)}`}>{formatPercent(scheme.return3Y)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Since Inception</span>
                  <span className={`font-medium ${getReturnColor(scheme.returnSI)}`}>{formatPercent(scheme.returnSI)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Monthly Performance Trend
              </CardTitle>
              <CardDescription>Monthly returns vs benchmark over the past 3 years</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(val: number) => `${val.toFixed(2)}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="return" name="Fund Return" stroke="#6366f1" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#9ca3af" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p>No monthly performance data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {rolling && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rolling Returns</CardTitle>
                <CardDescription>As of {formatDate(rolling.asOfDate)}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">1Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll1Y)}`}>{formatPercent(rolling.roll1Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">3Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll3Y)}`}>{formatPercent(rolling.roll3Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">5Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll5Y)}`}>{formatPercent(rolling.roll5Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Best 1Y</p>
                    <p className="text-xl font-bold text-green-600">{formatPercent(rolling.bestRoll1Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Worst 1Y</p>
                    <p className="text-xl font-bold text-red-600">{formatPercent(rolling.worstRoll1Y)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Risk Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Volatility</span>
                  <span className="font-bold text-lg">{scheme.volatility ? `${parseFloat(scheme.volatility).toFixed(2)}%` : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Max Drawdown</span>
                  <span className="font-bold text-lg text-red-600">{scheme.maxDrawdown ? `${parseFloat(scheme.maxDrawdown).toFixed(2)}%` : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Sharpe Ratio</span>
                  <span className="font-bold text-lg">{scheme.sharpeRatio ? parseFloat(scheme.sharpeRatio).toFixed(2) : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Sortino Ratio</span>
                  <span className="font-bold text-lg">{scheme.sortinoRatio ? parseFloat(scheme.sortinoRatio).toFixed(2) : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium">Risk Score</span>
                  <span className="font-bold text-lg">{scheme.riskScore || "N/A"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance vs Benchmark</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Alpha</span>
                  <span className={`font-bold text-lg ${scheme.alpha && parseFloat(scheme.alpha) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {scheme.alpha ? formatPercent(scheme.alpha) : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Beta</span>
                  <span className="font-bold text-lg">{scheme.beta ? parseFloat(scheme.beta).toFixed(2) : "N/A"}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium">Information Ratio</span>
                  <span className="font-bold text-lg">{scheme.informationRatio ? parseFloat(scheme.informationRatio).toFixed(2) : "N/A"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manager" className="space-y-6">
          {scheme.manager ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-500" />
                    Portfolio Manager Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{scheme.manager.name}</h3>
                      <p className="text-muted-foreground mb-4">{scheme.manager.designation || "Portfolio Manager"}</p>
                      {scheme.manager.bio && (
                        <p className="text-muted-foreground mb-6">{scheme.manager.bio}</p>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Experience</p>
                          <p className="font-semibold">{scheme.manager.experienceYears ? `${scheme.manager.experienceYears}+ years` : "N/A"}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Strategies Managed</p>
                          <p className="font-semibold">{scheme.manager.fundsManaged || "N/A"}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Total AUM</p>
                          <p className="font-semibold">{formatCurrency(scheme.manager.totalAumManaged)}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Avg Alpha</p>
                          <p className={`font-semibold ${scheme.manager.avgAlpha && parseFloat(scheme.manager.avgAlpha) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(scheme.manager.avgAlpha)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <OtherFundsByManager managerId={scheme.manager.id} currentFundId={id || ""} fundType="pms" navigate={navigate} />
            </>
          ) : (
            <Card className="p-8 text-center">
              <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Portfolio Manager Information Not Available</h3>
              <p className="text-muted-foreground">Contact the PMS provider for manager details.</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-6 right-6">
        <Button size="lg" className="shadow-lg bg-indigo-600 hover:bg-indigo-700" data-testid="invest-now">
          <DollarSign className="w-5 h-5 mr-2" />
          Express Interest
        </Button>
      </div>
    </div>
  );
}
