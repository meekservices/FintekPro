import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, Building2, TrendingUp, Shield, 
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
    aumManaged: string | null;
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
  if (!value) return "text-gray-500";
  const num = parseFloat(value);
  if (isNaN(num)) return "text-gray-500";
  return num >= 0 ? "text-green-600" : "text-red-600";
}

function getRiskBadge(score: number | null) {
  if (!score) return <Badge variant="outline">N/A</Badge>;
  if (score <= 3) return <Badge className="bg-green-100 text-green-800">Low Risk</Badge>;
  if (score <= 6) return <Badge className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
  return <Badge className="bg-red-100 text-red-800">High Risk</Badge>;
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
          <p className="text-gray-600 mb-4">The requested scheme could not be found.</p>
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
          <div className="flex items-center gap-3 text-gray-600">
            <Building2 className="w-5 h-5" />
            <span>{scheme.fundHouseName || "Unknown Provider"}</span>
            {scheme.registrationNo && (
              <span className="text-sm text-gray-500">| Reg: {scheme.registrationNo}</span>
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
            <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> 1Y Return</p>
            <p className={`text-2xl font-bold ${getReturnColor(scheme.return1Y)}`} data-testid="return-1y">
              {formatPercent(scheme.return1Y)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> 3Y Return</p>
            <p className={`text-2xl font-bold ${getReturnColor(scheme.return3Y)}`} data-testid="return-3y">
              {formatPercent(scheme.return3Y)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1"><PieChart className="w-4 h-4" /> AUM</p>
            <p className="text-2xl font-bold text-indigo-600" data-testid="aum">{formatCurrency(scheme.aum)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500 flex items-center gap-1"><Shield className="w-4 h-4" /> Risk</p>
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
                  <span className="text-gray-600">Minimum Investment</span>
                  <span className="font-medium">{formatCurrency(scheme.minInvestment)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Minimum SIP</span>
                  <span className="font-medium">{formatCurrency(scheme.minSIPInvestment)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Lock-in Period</span>
                  <span className="font-medium">{scheme.lockIn || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Benchmark</span>
                  <span className="font-medium">{scheme.benchmark || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Inception Date</span>
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
                  <span className="text-gray-600">1 Month</span>
                  <span className={`font-medium ${getReturnColor(scheme.return1M)}`}>{formatPercent(scheme.return1M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">3 Months</span>
                  <span className={`font-medium ${getReturnColor(scheme.return3M)}`}>{formatPercent(scheme.return3M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">6 Months</span>
                  <span className={`font-medium ${getReturnColor(scheme.return6M)}`}>{formatPercent(scheme.return6M)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">1 Year</span>
                  <span className={`font-medium ${getReturnColor(scheme.return1Y)}`}>{formatPercent(scheme.return1Y)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">3 Years</span>
                  <span className={`font-medium ${getReturnColor(scheme.return3Y)}`}>{formatPercent(scheme.return3Y)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Since Inception</span>
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
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
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
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">1Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll1Y)}`}>{formatPercent(rolling.roll1Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">3Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll3Y)}`}>{formatPercent(rolling.roll3Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">5Y Rolling</p>
                    <p className={`text-xl font-bold ${getReturnColor(rolling.roll5Y)}`}>{formatPercent(rolling.roll5Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-gray-500">Best 1Y</p>
                    <p className="text-xl font-bold text-green-600">{formatPercent(rolling.bestRoll1Y)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-gray-500">Worst 1Y</p>
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
                    <p className="text-gray-600 mb-4">{scheme.manager.designation || "Portfolio Manager"}</p>
                    {scheme.manager.bio && (
                      <p className="text-gray-700 mb-6">{scheme.manager.bio}</p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Experience</p>
                        <p className="font-semibold">{scheme.manager.experienceYears ? `${scheme.manager.experienceYears}+ years` : "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Strategies Managed</p>
                        <p className="font-semibold">{scheme.manager.fundsManaged || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Total AUM</p>
                        <p className="font-semibold">{formatCurrency(scheme.manager.aumManaged)}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Avg Alpha</p>
                        <p className={`font-semibold ${scheme.manager.avgAlpha && parseFloat(scheme.manager.avgAlpha) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(scheme.manager.avgAlpha)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800">Portfolio Manager Information Not Available</h3>
              <p className="text-gray-600">Contact the PMS provider for manager details.</p>
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
