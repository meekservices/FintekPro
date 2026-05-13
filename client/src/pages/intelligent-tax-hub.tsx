import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Brain,
  TrendingUp,
  FileText,
  Database,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  Calendar,
  DollarSign,
  Receipt,
  Building2,
  Banknote,
  Target,
  Sparkles,
  Eye,
  LucideShield as LucideShield,
  ArrowUpDown,
  PieChart,
  BarChart3,
  Activity,
  Zap,
  Info,
  ChevronRight,
  Settings,
  Calculator,
  Plus,
  Upload,
  X,
  File,
  Trash2,
  AlertCircle
} from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar
} from "recharts";
import TaxReminderDashboard from "@/components/tax-reminder-dashboard";
import { Link } from "wouter";

// TypeScript Interfaces
interface TaxHealthScore {
  score: number;
  category: "Excellent" | "Good" | "Fair" | "Needs Attention";
  factors: {
    dataCompletion: number;
    complianceStatus: number;
    optimizationLevel: number;
    timelinessScore: number;
  };
}

interface IncomeSource {
  id: string;
  type: string;
  name: string;
  amount: number;
  verified: boolean;
  source: string;
  status: "verified" | "pending" | "missing";
}

interface TaxTimeline {
  date: string;
  title: string;
  description: string;
  status: "upcoming" | "completed" | "overdue";
  type: "deadline" | "payment" | "filing";
}

interface QuickStats {
  totalIncome: number;
  totalTDS: number;
  estimatedLiability: number;
  potentialSavings: number;
  refundExpected: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: string;
  savings: number;
}

interface ITRFormOption {
  formType: string;
  name: string;
  description: string;
  applicability: number;
  recommended: boolean;
  complexity: "Simple" | "Moderate" | "Complex";
}

interface DeductionSuggestion {
  section: string;
  title: string;
  current: number;
  maximum: number;
  potential: number;
  description: string;
}

interface RegimeComparison {
  oldRegime: {
    taxLiability: number;
    deductions: number;
    effectiveRate: number;
    breakdown: { slab: string; amount: number }[];
  };
  newRegime: {
    taxLiability: number;
    deductions: number;
    effectiveRate: number;
    breakdown: { slab: string; amount: number }[];
  };
  recommendation: "old" | "new";
  savings: number;
}

interface DataSourceStatus {
  id: string;
  name: string;
  status: "connected" | "pending" | "error" | "not_connected";
  lastSync?: string;
  recordCount: number;
  dataTypes: string[];
  icon: any;
}

interface TaxService {
  id: string;
  title: string;
  description: string;
  status: "available" | "in_progress" | "completed";
  lastUpdated?: string;
  action: string;
}

interface ITRFilingStatus {
  currentStep: number;
  totalSteps: number;
  steps: {
    id: string;
    title: string;
    status: "completed" | "in_progress" | "pending";
    description: string;
    completedAt?: string;
  }[];
  overallProgress: number;
  estimatedCompletion?: string;
  lastActivity?: string;
}

interface PreFillDataSource {
  id: string;
  name: string;
  type: "salary" | "investments" | "bank" | "government" | "insurance" | "property";
  connected: boolean;
  dataCount: number;
  lastSync?: string;
  autoImported: boolean;
}

interface TaxSavingSuggestion {
  id: string;
  title: string;
  section: string;
  currentAmount: number;
  suggestedAmount: number;
  potentialSaving: number;
  priority: "urgent" | "recommended" | "optional";
  deadline?: string;
  actionRequired: string;
  category: "80C" | "80D" | "HRA" | "80G" | "80E" | "24" | "other";
}

interface DashboardData {
  healthScore: TaxHealthScore;
  incomeSources: IncomeSource[];
  timeline: TaxTimeline[];
  quickStats: QuickStats;
  recommendations: AIRecommendation[];
  filingStatus?: ITRFilingStatus;
  prefillSources?: PreFillDataSource[];
  taxSavings?: TaxSavingSuggestion[];
}

interface FilingData {
  formOptions: ITRFormOption[];
  autoFillStatus: {
    overall: number;
    sources: { name: string; status: number }[];
  };
  calculator: {
    totalIncome: number;
    deductions: number;
    taxableIncome: number;
    liability: number;
  };
  deductions: DeductionSuggestion[];
}

export default function IntelligentTaxHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedYear, setSelectedYear] = useState("2024-25");
  const [scenarioIncome, setScenarioIncome] = useState<number>(1000000);

  // Refund Status State
  const [refundQuery, setRefundQuery] = useState({ pan: user?.panNumber || "", ay: "2025-26" });

  // Refund Status Query
  const { data: refundData, isFetching: isFetchingRefund, refetch: refetchRefund } = useQuery<{ success: boolean; data: any }>({
    queryKey: ['/api/tax/refund/status', refundQuery.pan, refundQuery.ay],
    enabled: false // Only run on manual click
  });

  // Dashboard Data Query
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ['/api/tax-hub/dashboard', selectedYear],
    enabled: !!user
  });

  // Filing Data Query
  const { data: filingData, isLoading: filingLoading } = useQuery<FilingData>({
    queryKey: ['/api/tax-hub/filing', selectedYear],
    enabled: !!user && activeTab === "filing"
  });

  // Regime Comparison Query
  const { data: regimeData, isLoading: regimeLoading } = useQuery<RegimeComparison>({
    queryKey: ['/api/tax-hub/regime-comparison', selectedYear, scenarioIncome],
    enabled: !!user && activeTab === "regime"
  });

  // Data Sources Query
  const { data: dataSources, isLoading: sourcesLoading } = useQuery<DataSourceStatus[]>({
    queryKey: ['/api/tax-hub/data-sources', selectedYear],
    enabled: !!user && activeTab === "sources"
  });

  // Services Query
  const { data: services, isLoading: servicesLoading } = useQuery<TaxService[]>({
    queryKey: ['/api/tax-hub/services', selectedYear],
    enabled: !!user && activeTab === "services"
  });

  // Sync Data Mutation
  const syncMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiRequest(`/api/tax-hub/sync/${sourceId}`, {
        method: 'POST',
        body: JSON.stringify({ year: selectedYear }),
        headers: { "Content-Type": "application/json" }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub'] });
      toast({
        title: "Sync Completed",
        description: "Data has been successfully synced"
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync data. Please try again.",
        variant: "destructive"
      });
    }
  });

  // File ITR Mutation
  const fileMutation = useMutation({
    mutationFn: (formData: any) =>
      apiRequest('/api/tax-hub/file-itr', {
        method: 'POST',
        body: JSON.stringify({ ...formData, year: selectedYear }),
        headers: { "Content-Type": "application/json" }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub'] });
      toast({
        title: "ITR Filed Successfully",
        description: "Your income tax return has been filed successfully"
      });
    }
  });

  // Helper Functions
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-500 to-emerald-600";
    if (score >= 60) return "from-blue-500 to-cyan-600";
    if (score >= 40) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-rose-600";
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Dashboard Tab Component
  const DashboardTab = () => {
    if (dashboardLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      );
    }

    const healthScore = dashboardData?.healthScore || {
      score: 75,
      category: "Good" as const,
      factors: { dataCompletion: 80, complianceStatus: 85, optimizationLevel: 70, timelinessScore: 65 }
    };

    const quickStats = dashboardData?.quickStats || {
      totalIncome: 1200000,
      totalTDS: 120000,
      estimatedLiability: 95000,
      potentialSavings: 25000,
      refundExpected: 0
    };

    const incomeSources = dashboardData?.incomeSources || [];
    const timeline = dashboardData?.timeline || [];
    const recommendations = dashboardData?.recommendations || [];

    const healthFactorsData = [
      { name: 'Data Completion', value: healthScore.factors.dataCompletion },
      { name: 'Compliance', value: healthScore.factors.complianceStatus },
      { name: 'Optimization', value: healthScore.factors.optimizationLevel },
      { name: 'Timeliness', value: healthScore.factors.timelinessScore }
    ];

    return (
      <div className="space-y-6" data-testid="dashboard-tab">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-total-income">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Income</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-total-income">
                    ₹{quickStats.totalIncome.toLocaleString()}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400">FY {selectedYear}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800" data-testid="card-total-tds">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">TDS Deducted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="text-total-tds">
                    ₹{quickStats.totalTDS.toLocaleString()}
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400">Already paid</p>
                </div>
                <Receipt className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800" data-testid="card-estimated-liability">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Estimated Liability</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-900 dark:text-orange-100" data-testid="text-estimated-liability">
                    ₹{quickStats.estimatedLiability.toLocaleString()}
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400">To be paid</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800" data-testid="card-potential-savings">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Potential Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-900 dark:text-purple-100" data-testid="text-potential-savings">
                    ₹{quickStats.potentialSavings.toLocaleString()}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">AI identified</p>
                </div>
                <Sparkles className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Refund Status Tracker Card */}
        <Card data-testid="card-refund-status">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              ITR Refund Status Tracker
            </CardTitle>
            <CardDescription>Check real-time refund status from Income Tax Portal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="refund-pan">PAN Number</Label>
                <Input
                  id="refund-pan"
                  placeholder="ABCDE1234F"
                  value={refundQuery.pan}
                  onChange={(e) => setRefundQuery(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refund-ay">Assessment Year</Label>
                <Select
                  value={refundQuery.ay}
                  onValueChange={(v) => setRefundQuery(prev => ({ ...prev, ay: v }))}
                >
                  <SelectTrigger id="refund-ay">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025-26">2025-26</SelectItem>
                    <SelectItem value="2024-25">2024-25</SelectItem>
                    <SelectItem value="2023-24">2023-24</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="w-full gap-2"
                  onClick={() => refetchRefund()}
                  disabled={isFetchingRefund}
                >
                  {isFetchingRefund ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Check Status
                </Button>
              </div>
            </div>

            {refundData?.success && refundData.data && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      {refundData.data.status === "NO_FILING_FOUND" ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {refundData.data.status.replace(/_/g, " ")}
                    </h3>
                  </div>
                  {refundData.data.refundAmount && (
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Refund Amount</p>
                      <p className="text-lg font-bold text-green-600">₹{refundData.data.refundAmount.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted"></div>
                  <div className="space-y-6 relative">
                    {refundData.data.stages.map((stage: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-4 ml-2">
                        <div className={`z-10 w-5 h-5 rounded-full flex items-center justify-center ${
                          stage.status === "completed" ? "bg-green-500 text-white" :
                          stage.status === "in_progress" ? "bg-blue-500 text-white animate-pulse" :
                          "bg-muted-foreground text-white"
                        }`}>
                          {stage.status === "completed" ? <CheckCircle className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${stage.status === "completed" ? "text-foreground" : "text-muted-foreground"}`}>
                            {stage.stage}
                          </p>
                          {stage.date && <p className="text-xs text-muted-foreground">{stage.date}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ITR Filing Status Tracker */}
        <Card data-testid="card-filing-status-tracker">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              ITR Filing Progress
            </CardTitle>
            <CardDescription>Track your income tax return filing journey</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const filingStatus: ITRFilingStatus = dashboardData?.filingStatus || {
                currentStep: 2,
                totalSteps: 6,
                overallProgress: 33,
                steps: [
                  { id: "1", title: "Data Collection", status: "completed", description: "Income sources verified", completedAt: "Dec 10, 2024" },
                  { id: "2", title: "Document Upload", status: "in_progress", description: "Upload supporting documents" },
                  { id: "3", title: "Form Selection", status: "pending", description: "Choose appropriate ITR form" },
                  { id: "4", title: "Review & Verify", status: "pending", description: "Review pre-filled data" },
                  { id: "5", title: "Tax Calculation", status: "pending", description: "Calculate tax liability" },
                  { id: "6", title: "E-File & Submit", status: "pending", description: "Submit to IT Department" }
                ],
                lastActivity: "2 hours ago"
              };
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Overall Progress:</span>
                      <span className="font-semibold text-blue-600" data-testid="text-filing-progress">{filingStatus.overallProgress}%</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Last activity: {filingStatus.lastActivity}
                    </Badge>
                  </div>
                  
                  <Progress value={filingStatus.overallProgress} className="h-2 mb-6" />
                  
                  <div className="flex flex-wrap justify-between gap-2">
                    {filingStatus.steps.map((step, idx) => (
                      <div 
                        key={step.id} 
                        className="flex flex-col items-center flex-1 min-w-[100px]"
                        data-testid={`filing-step-${step.id}`}
                      >
                        <div className={`relative w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                          step.status === "completed" ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300" :
                          step.status === "in_progress" ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 ring-2 ring-blue-400 ring-offset-2" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {step.status === "completed" ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : step.status === "in_progress" ? (
                            <Clock className="h-5 w-5 animate-pulse" />
                          ) : (
                            <span className="text-sm font-medium">{idx + 1}</span>
                          )}
                        </div>
                        <span className={`text-xs font-medium text-center ${
                          step.status === "completed" ? "text-green-600" :
                          step.status === "in_progress" ? "text-blue-600" :
                          "text-muted-foreground"
                        }`}>
                          {step.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground text-center mt-1 hidden sm:block">
                          {step.status === "completed" && step.completedAt ? step.completedAt : step.description}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-center pt-4">
                    <Button className="gap-2" data-testid="button-continue-filing">
                      Continue Filing <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Pre-fill Data Hub & Tax Savings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pre-fill Data Hub Summary */}
          <Card data-testid="card-prefill-data-hub">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                Pre-fill Data Hub
              </CardTitle>
              <CardDescription>Connected sources for auto-import</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const prefillSources: PreFillDataSource[] = dashboardData?.prefillSources || [
                  { id: "1", name: "Form 16", type: "salary", connected: true, dataCount: 1, lastSync: "Dec 15, 2024", autoImported: true },
                  { id: "2", name: "Form 26AS", type: "government", connected: true, dataCount: 12, lastSync: "Dec 14, 2024", autoImported: true },
                  { id: "3", name: "AIS (Annual Info)", type: "government", connected: true, dataCount: 45, lastSync: "Dec 14, 2024", autoImported: true },
                  { id: "4", name: "Bank Statements", type: "bank", connected: false, dataCount: 0, autoImported: false },
                  { id: "5", name: "Investment Proofs", type: "investments", connected: true, dataCount: 8, lastSync: "Dec 12, 2024", autoImported: false },
                  { id: "6", name: "Insurance Policies", type: "insurance", connected: false, dataCount: 0, autoImported: false }
                ];
                
                const connectedCount = prefillSources.filter(s => s.connected).length;
                const totalRecords = prefillSources.reduce((acc, s) => acc + s.dataCount, 0);
                
                const getTypeIcon = (type: string) => {
                  switch (type) {
                    case "salary": return <Building2 className="h-4 w-4" />;
                    case "government": return <LucideShield className="h-4 w-4" />;
                    case "bank": return <Banknote className="h-4 w-4" />;
                    case "investments": return <TrendingUp className="h-4 w-4" />;
                    case "insurance": return <LucideShield className="h-4 w-4" />;
                    default: return <Database className="h-4 w-4" />;
                  }
                };
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          {connectedCount}/{prefillSources.length} Sources Connected
                        </p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400">
                          {totalRecords} records auto-imported
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1" data-testid="button-connect-more">
                        <Plus className="h-3 w-3" /> Connect
                      </Button>
                    </div>
                    
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {prefillSources.map((source) => (
                        <div 
                          key={source.id}
                          className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted"
                          data-testid={`prefill-source-${source.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${source.connected ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                              {getTypeIcon(source.type)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{source.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {source.connected ? `${source.dataCount} records • ${source.lastSync}` : "Not connected"}
                              </p>
                            </div>
                          </div>
                          {source.connected ? (
                            <div className="flex items-center gap-1">
                              {source.autoImported && (
                                <Badge variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Auto</Badge>
                              )}
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-xs h-7">
                              Connect
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Tax Savings Suggestions */}
          <Card data-testid="card-tax-savings-suggestions">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Tax Savings Opportunities
              </CardTitle>
              <CardDescription>AI-identified savings before deadline</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const taxSavings: TaxSavingSuggestion[] = dashboardData?.taxSavings || [
                  { id: "1", title: "80C Investment Gap", section: "80C", currentAmount: 120000, suggestedAmount: 150000, potentialSaving: 9360, priority: "urgent", deadline: "Mar 31, 2025", actionRequired: "Invest ₹30,000 more in ELSS/PPF", category: "80C" },
                  { id: "2", title: "Health Insurance Premium", section: "80D", currentAmount: 15000, suggestedAmount: 25000, potentialSaving: 3120, priority: "recommended", actionRequired: "Add parents' health cover", category: "80D" },
                  { id: "3", title: "NPS Contribution", section: "80CCD(1B)", currentAmount: 0, suggestedAmount: 50000, potentialSaving: 15600, priority: "recommended", actionRequired: "Open NPS account for extra ₹50K deduction", category: "other" },
                  { id: "4", title: "Home Loan Interest", section: "24(b)", currentAmount: 180000, suggestedAmount: 200000, potentialSaving: 6240, priority: "optional", actionRequired: "Ensure full interest claim", category: "24" }
                ];
                
                const totalPotentialSavings = taxSavings.reduce((acc, s) => acc + s.potentialSaving, 0);
                
                const getPriorityColor = (priority: string) => {
                  switch (priority) {
                    case "urgent": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
                    case "recommended": return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                    default: return "bg-muted text-muted-foreground border-border";
                  }
                };
                
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                          Total Potential Savings
                        </p>
                        <p className="text-2xl font-bold text-amber-600" data-testid="text-total-potential-savings">
                          ₹{totalPotentialSavings.toLocaleString()}
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-amber-500" />
                    </div>
                    
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {taxSavings.map((saving) => (
                        <div 
                          key={saving.id}
                          className="p-3 border rounded-lg hover:shadow-sm transition-shadow"
                          data-testid={`tax-saving-${saving.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] ${getPriorityColor(saving.priority)}`}>
                                {saving.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Section {saving.section}</span>
                            </div>
                            <span className="text-sm font-semibold text-green-600">
                              Save ₹{saving.potentialSaving.toLocaleString()}
                            </span>
                          </div>
                          <h4 className="text-sm font-medium mb-1">{saving.title}</h4>
                          <p className="text-xs text-muted-foreground">{saving.actionRequired}</p>
                          {saving.deadline && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                              <Clock className="h-3 w-3" />
                              Deadline: {saving.deadline}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <Button className="w-full gap-2" variant="outline" data-testid="button-view-all-savings">
                      View All Savings Options <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tax Health Score */}
          <Card className="lg:col-span-1" data-testid="card-health-score">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Tax Health Score
              </CardTitle>
              <CardDescription>Your overall tax compliance and optimization score</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center">
                <div className={`relative w-40 h-40 mb-4`}>
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-foreground"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 70}`}
                      strokeDashoffset={`${2 * Math.PI * 70 * (1 - healthScore.score / 100)}`}
                      className={`${getScoreColor(healthScore.score)} transition-all duration-1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${getScoreColor(healthScore.score)}`} data-testid="text-health-score">
                      {healthScore.score}
                    </span>
                    <span className="text-sm text-muted-foreground">out of 100</span>
                  </div>
                </div>
                <Badge
                  variant={healthScore.category === "Excellent" ? "default" : "secondary"}
                  className="text-sm px-4 py-1"
                  data-testid="badge-health-category"
                >
                  {healthScore.category}
                </Badge>
              </div>

              <div className="space-y-3">
                {healthFactorsData.map((factor, idx) => (
                  <div key={idx} className="space-y-1" data-testid={`factor-${factor.name.toLowerCase().replace(' ', '-')}`}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{factor.name}</span>
                      <span className="font-medium">{factor.value}%</span>
                    </div>
                    <Progress value={factor.value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Income Sources & Timeline */}
          <Card className="lg:col-span-2" data-testid="card-income-timeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Income Sources & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="income" className="w-full">
                <ScrollableTabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="income" data-testid="tab-income-sources">Income Sources</TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">Tax Timeline</TabsTrigger>
                </ScrollableTabsList>

                <TabsContent value="income" className="space-y-3 mt-4" data-testid="content-income-sources">
                  {incomeSources.length > 0 ? (
                    incomeSources.map((source) => (
                      <div
                        key={source.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        data-testid={`income-source-${source.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${source.verified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <div>
                            <p className="font-medium text-sm">{source.name}</p>
                            <p className="text-xs text-muted-foreground">{source.type} • {source.source}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">₹{source.amount.toLocaleString()}</span>
                          {source.verified ? (
                            <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No income sources detected yet</p>
                      <p className="text-sm">Connect your data sources to auto-detect income</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="timeline" className="space-y-3 mt-4" data-testid="content-timeline">
                  {timeline.length > 0 ? (
                    timeline.map((event, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                        data-testid={`timeline-event-${idx}`}
                      >
                        <div className={`mt-1 p-2 rounded-full ${
                          event.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                          event.status === 'upcoming' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {event.type === 'deadline' ? <Calendar className="h-4 w-4" /> :
                           event.type === 'payment' ? <Banknote className="h-4 w-4" /> :
                           <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{event.title}</p>
                            <span className="text-xs text-muted-foreground">{event.date}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No upcoming tax events</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* AI Recommendations */}
        <Card data-testid="card-ai-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription>Personalized suggestions to optimize your tax filing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.length > 0 ? (
                recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    data-testid={`recommendation-${rec.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={rec.impact === "high" ? "default" : "secondary"}>
                        {rec.impact} impact
                      </Badge>
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                    </div>
                    <h4 className="font-semibold text-sm mb-1">{rec.title}</h4>
                    <p className="text-xs text-muted-foreground mb-2">{rec.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-600">
                        Save ₹{rec.savings.toLocaleString()}
                      </span>
                      <Button size="sm" variant="ghost" data-testid={`button-apply-${rec.id}`}>
                        Apply <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recommendations available yet</p>
                  <p className="text-sm">Complete your profile to get personalized suggestions</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Smart Filing Tab Component
  const SmartFilingTab = () => {
    if (filingLoading) {
      return <Skeleton className="h-96" />;
    }

    const formOptions = filingData?.formOptions || [];
    const autoFillStatus = filingData?.autoFillStatus || { overall: 0, sources: [] };
    const calculator = filingData?.calculator || {
      totalIncome: 0,
      deductions: 0,
      taxableIncome: 0,
      liability: 0
    };
    const deductions = filingData?.deductions || [];

    return (
      <div className="space-y-6" data-testid="filing-tab">
        {/* AI Form Selector */}
        <Card data-testid="card-form-selector">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI-Powered ITR Form Selector
            </CardTitle>
            <CardDescription>Based on your income profile, we recommend the best form</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {formOptions.length > 0 ? (
                formOptions.map((form) => (
                  <div
                    key={form.formType}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      form.recommended
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-border hover:border-border'
                    }`}
                    data-testid={`form-option-${form.formType}`}
                  >
                    {form.recommended && (
                      <Badge className="mb-2 bg-blue-600">Recommended</Badge>
                    )}
                    <h4 className="font-bold text-lg">{form.formType}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{form.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">{form.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{form.complexity}</Badge>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Applicability</div>
                        <div className="font-semibold">{form.applicability}%</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Connect your data sources to get form recommendations</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Auto-fill Status */}
        <Card data-testid="card-autofill-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Auto-fill Status
            </CardTitle>
            <CardDescription>Data automatically populated from connected sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Completion</span>
                <span className="font-medium" data-testid="text-autofill-overall">{autoFillStatus.overall}%</span>
              </div>
              <Progress value={autoFillStatus.overall} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {autoFillStatus.sources.map((source, idx) => (
                <div key={idx} className="p-3 bg-muted rounded-lg" data-testid={`autofill-source-${idx}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">{source.name}</span>
                    <Badge variant={source.status === 100 ? "default" : "secondary"}>
                      {source.status}%
                    </Badge>
                  </div>
                  <Progress value={source.status} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Document Upload with Progress */}
        <Card data-testid="card-document-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Document Upload Center
            </CardTitle>
            <CardDescription>Upload supporting documents for your ITR filing</CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const documentTypes = [
                { id: "form16", name: "Form 16", required: true, uploaded: true, fileName: "Form16_2024.pdf", size: "245 KB", uploadProgress: 100, uploadedAt: "Dec 10, 2024" },
                { id: "form26as", name: "Form 26AS", required: true, uploaded: true, fileName: "Form26AS_2024.pdf", size: "128 KB", uploadProgress: 100, uploadedAt: "Dec 10, 2024" },
                { id: "ais", name: "Annual Information Statement (AIS)", required: true, uploaded: false, fileName: null, size: null, uploadProgress: 0, uploadedAt: null },
                { id: "bank_statement", name: "Bank Statements", required: false, uploaded: true, fileName: "HDFC_Statement.pdf", size: "512 KB", uploadProgress: 100, uploadedAt: "Dec 8, 2024" },
                { id: "investment_proof", name: "Investment Proofs (80C, 80D)", required: false, uploaded: false, fileName: null, size: null, uploadProgress: 45, uploadedAt: null },
                { id: "rent_receipt", name: "Rent Receipts (HRA)", required: false, uploaded: false, fileName: null, size: null, uploadProgress: 0, uploadedAt: null },
                { id: "home_loan", name: "Home Loan Certificate", required: false, uploaded: false, fileName: null, size: null, uploadProgress: 0, uploadedAt: null },
              ];
              
              const uploadedCount = documentTypes.filter(d => d.uploaded).length;
              const requiredPending = documentTypes.filter(d => d.required && !d.uploaded).length;
              
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <span className="text-2xl font-bold text-blue-600" data-testid="text-uploaded-count">{uploadedCount}</span>
                        <p className="text-xs text-blue-600">Uploaded</p>
                      </div>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-orange-600" data-testid="text-pending-count">{requiredPending}</span>
                        <p className="text-xs text-orange-600">Required Pending</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1" data-testid="button-bulk-upload">
                        <Upload className="h-3 w-3" /> Bulk Upload
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[350px] overflow-y-auto">
                    {documentTypes.map((doc) => (
                      <div 
                        key={doc.id}
                        className={`p-4 border rounded-lg transition-all ${
                          doc.uploaded ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : 
                          doc.uploadProgress > 0 ? 'border-blue-200 bg-blue-50/50 dark:bg-blue-950/20' :
                          'border-border hover:border-border'
                        }`}
                        data-testid={`document-${doc.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              doc.uploaded ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                              doc.uploadProgress > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              <File className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{doc.name}</span>
                                {doc.required && (
                                  <Badge variant="secondary" className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Required</Badge>
                                )}
                              </div>
                              {doc.uploaded ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <span>{doc.fileName}</span>
                                  <span>•</span>
                                  <span>{doc.size}</span>
                                  <span>•</span>
                                  <span>{doc.uploadedAt}</span>
                                </div>
                              ) : doc.uploadProgress > 0 ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={doc.uploadProgress} className="h-1.5 w-24" />
                                  <span className="text-xs text-blue-600">{doc.uploadProgress}%</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground mt-1">Not uploaded yet</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {doc.uploaded ? (
                              <>
                                <CheckCircle className="h-5 w-5 text-green-500" />
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" data-testid={`button-remove-${doc.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : doc.uploadProgress > 0 ? (
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500" data-testid={`button-cancel-${doc.id}`}>
                                <X className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="gap-1" data-testid={`button-upload-${doc.id}`}>
                                <Upload className="h-3 w-3" /> Upload
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                      Ensure all required documents are uploaded before filing. Missing documents may delay processing or result in notices from the IT Department.
                    </AlertDescription>
                  </Alert>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Real-time Tax Calculator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="card-tax-calculator">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Real-time Tax Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-sm">Total Income</span>
                  <span className="font-bold" data-testid="text-calc-income">₹{calculator.totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-sm">Total Deductions</span>
                  <span className="font-bold text-green-600" data-testid="text-calc-deductions">
                    -₹{calculator.deductions.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900 rounded">
                  <span className="text-sm font-medium">Taxable Income</span>
                  <span className="font-bold" data-testid="text-calc-taxable">₹{calculator.taxableIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900 rounded">
                  <span className="text-sm font-medium">Tax Liability</span>
                  <span className="font-bold text-orange-600" data-testid="text-calc-liability">
                    ₹{calculator.liability.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deduction Maximizer */}
          <Card data-testid="card-deduction-maximizer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Deduction Maximizer
              </CardTitle>
              <CardDescription>Suggestions to maximize your tax savings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deductions.length > 0 ? (
                  deductions.map((deduction, idx) => (
                    <div
                      key={idx}
                      className="p-3 border rounded-lg"
                      data-testid={`deduction-${deduction.section}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-semibold text-sm">{deduction.section}</h5>
                          <p className="text-xs text-muted-foreground">{deduction.title}</p>
                        </div>
                        <Badge variant="outline">₹{deduction.potential.toLocaleString()} more</Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Current: ₹{deduction.current.toLocaleString()}</span>
                          <span>Max: ₹{deduction.maximum.toLocaleString()}</span>
                        </div>
                        <Progress value={(deduction.current / deduction.maximum) * 100} className="h-2" />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">No deduction suggestions available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filing Action */}
        <Card data-testid="card-filing-action">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Ready to File Your ITR?</h3>
                <p className="text-sm text-muted-foreground">Complete all sections and review before filing</p>
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600"
                disabled={autoFillStatus.overall < 100 || fileMutation.isPending}
                onClick={() => fileMutation.mutate({})}
                data-testid="button-file-itr"
              >
                {fileMutation.isPending ? "Filing..." : "File ITR Now"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Tax Regime Comparison Tab
  const RegimeComparisonTab = () => {
    if (regimeLoading) {
      return <Skeleton className="h-96" />;
    }

    const regime = regimeData || {
      oldRegime: {
        taxLiability: 95000,
        deductions: 150000,
        effectiveRate: 7.9,
        breakdown: []
      },
      newRegime: {
        taxLiability: 110000,
        deductions: 0,
        effectiveRate: 9.2,
        breakdown: []
      },
      recommendation: "old" as const,
      savings: 15000
    };

    const comparisonData = [
      {
        name: 'Tax Liability',
        old: regime.oldRegime.taxLiability,
        new: regime.newRegime.taxLiability
      },
      {
        name: 'Deductions',
        old: regime.oldRegime.deductions,
        new: regime.newRegime.deductions
      }
    ];

    return (
      <div className="space-y-6" data-testid="regime-tab">
        {/* Recommendation Banner */}
        <Alert className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-950" data-testid="alert-recommendation">
          <Brain className="h-5 w-5" />
          <AlertDescription className="ml-2">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <strong>AI Recommendation:</strong> Based on your income and deductions,
                the <strong>{regime.recommendation === 'old' ? 'Old' : 'New'} Tax Regime</strong> is better for you.
              </div>
              <Badge className="bg-green-600 text-white w-fit">
                Save ₹{regime.savings.toLocaleString()}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Side-by-side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Old Regime */}
          <Card
            className={`${regime.recommendation === 'old' ? 'border-2 border-green-500 shadow-lg' : ''}`}
            data-testid="card-old-regime"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Old Tax Regime</CardTitle>
                {regime.recommendation === 'old' && (
                  <Badge className="bg-green-600">Recommended</Badge>
                )}
              </div>
              <CardDescription>With deductions and exemptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg">
                  <div className="text-sm text-muted-foreground">Tax Liability</div>
                  <div className="text-3xl font-bold" data-testid="text-old-liability">
                    ₹{regime.oldRegime.taxLiability.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Deductions</div>
                    <div className="font-semibold">₹{regime.oldRegime.deductions.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Effective Rate</div>
                    <div className="font-semibold">{regime.oldRegime.effectiveRate}%</div>
                  </div>
                </div>
              </div>

              {regime.oldRegime.breakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Tax Breakdown</h4>
                  {regime.oldRegime.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>{item.slab}</span>
                      <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* New Regime */}
          <Card
            className={`${regime.recommendation === 'new' ? 'border-2 border-green-500 shadow-lg' : ''}`}
            data-testid="card-new-regime"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>New Tax Regime</CardTitle>
                {regime.recommendation === 'new' && (
                  <Badge className="bg-green-600">Recommended</Badge>
                )}
              </div>
              <CardDescription>Lower rates, no deductions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg">
                  <div className="text-sm text-muted-foreground">Tax Liability</div>
                  <div className="text-3xl font-bold" data-testid="text-new-liability">
                    ₹{regime.newRegime.taxLiability.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Deductions</div>
                    <div className="font-semibold">₹{regime.newRegime.deductions.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-muted rounded">
                    <div className="text-xs text-muted-foreground">Effective Rate</div>
                    <div className="font-semibold">{regime.newRegime.effectiveRate}%</div>
                  </div>
                </div>
              </div>

              {regime.newRegime.breakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Tax Breakdown</h4>
                  {regime.newRegime.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>{item.slab}</span>
                      <span className="font-medium">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison Chart */}
        <Card data-testid="card-comparison-chart">
          <CardHeader>
            <CardTitle>Visual Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="old" fill="#3b82f6" name="Old Regime" />
                <Bar dataKey="new" fill="#8b5cf6" name="New Regime" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* What-if Scenario Calculator */}
        <Card data-testid="card-scenario-calculator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              What-if Scenario Calculator
            </CardTitle>
            <CardDescription>See how different income levels affect your tax liability</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="scenario-income">Annual Income:</Label>
                <Input
                  id="scenario-income"
                  type="number"
                  value={scenarioIncome}
                  onChange={(e) => setScenarioIncome(Number(e.target.value))}
                  className="max-w-xs"
                  data-testid="input-scenario-income"
                />
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/regime-comparison'] })}
                  data-testid="button-recalculate"
                >
                  Recalculate
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Adjust the income to see real-time changes in tax liability under both regimes
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Data Sources Tab
  const DataSourcesTab = () => {
    if (sourcesLoading) {
      return <Skeleton className="h-96" />;
    }

    const sources: DataSourceStatus[] = dataSources || [
      {
        id: 'ais',
        name: 'Annual Information Statement (AIS)',
        status: 'connected',
        lastSync: '2024-10-01',
        recordCount: 15,
        dataTypes: ['Salary', 'Interest', 'Dividends'],
        icon: Receipt
      },
      {
        id: 'form26as',
        name: 'Form 26AS',
        status: 'connected',
        lastSync: '2024-10-01',
        recordCount: 8,
        dataTypes: ['TDS', 'TCS'],
        icon: FileText
      },
      {
        id: 'cams',
        name: 'CAMS (Mutual Funds)',
        status: 'pending',
        recordCount: 0,
        dataTypes: ['Mutual Funds', 'Capital Gains'],
        icon: TrendingUp
      },
      {
        id: 'kfintech',
        name: 'KFintech (Mutual Funds)',
        status: 'not_connected',
        recordCount: 0,
        dataTypes: ['Mutual Funds', 'Capital Gains'],
        icon: Building2
      },
      {
        id: 'nsdl',
        name: 'NSDL (Securities)',
        status: 'connected',
        lastSync: '2024-09-28',
        recordCount: 22,
        dataTypes: ['Stocks', 'Dividends'],
        icon: Database
      },
      {
        id: 'cdsl',
        name: 'CDSL (Securities)',
        status: 'not_connected',
        recordCount: 0,
        dataTypes: ['Stocks', 'Dividends'],
        icon: Database
      },
      {
        id: 'banks',
        name: 'Bank Statements',
        status: 'error',
        lastSync: '2024-09-15',
        recordCount: 5,
        dataTypes: ['Interest Income', 'FD Interest'],
        icon: Banknote
      }
    ];

    const connectedSources = sources.filter(s => s.status === 'connected');
    const totalRecords = sources.reduce((sum, s) => sum + s.recordCount, 0);

    const incomeBreakdown = [
      { name: 'Salary', value: 800000, color: COLORS[0] },
      { name: 'Interest', value: 150000, color: COLORS[1] },
      { name: 'Dividends', value: 80000, color: COLORS[2] },
      { name: 'Capital Gains', value: 120000, color: COLORS[3] },
      { name: 'Other', value: 50000, color: COLORS[4] }
    ];

    return (
      <div className="space-y-6" data-testid="sources-tab">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-sources-connected">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Connected Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{connectedSources.length}/{sources.length}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-records">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-total-records">{totalRecords}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-last-sync">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Last Full Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {connectedSources[0]?.lastSync || 'Never'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Sources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => {
            const Icon = source.icon;
            return (
              <Card
                key={source.id}
                className={`${
                  source.status === 'connected' ? 'border-green-500' :
                  source.status === 'error' ? 'border-red-500' :
                  source.status === 'pending' ? 'border-yellow-500' : ''
                }`}
                data-testid={`source-card-${source.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <CardTitle className="text-sm">{source.name}</CardTitle>
                    </div>
                    <Badge
                      variant={
                        source.status === 'connected' ? 'default' :
                        source.status === 'error' ? 'destructive' : 'secondary'
                      }
                      data-testid={`badge-status-${source.id}`}
                    >
                      {source.status === 'connected' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Connected</>
                      ) : source.status === 'error' ? (
                        <><AlertTriangle className="h-3 w-3 mr-1" /> Error</>
                      ) : source.status === 'pending' ? (
                        <><Clock className="h-3 w-3 mr-1" /> Pending</>
                      ) : (
                        'Not Connected'
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Records</span>
                    <span className="font-semibold" data-testid={`text-records-${source.id}`}>
                      {source.recordCount}
                    </span>
                  </div>

                  {source.lastSync && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="text-xs">{source.lastSync}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    {source.dataTypes.map((type, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    variant={source.status === 'connected' ? 'outline' : 'default'}
                    size="sm"
                    disabled={syncMutation.isPending}
                    onClick={() => syncMutation.mutate(source.id)}
                    data-testid={`button-sync-${source.id}`}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    {source.status === 'connected' ? 'Re-sync' : 'Connect & Sync'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Income Breakdown Chart */}
        <Card data-testid="card-income-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Aggregate Income Breakdown
            </CardTitle>
            <CardDescription>Income distribution from all connected sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={incomeBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {incomeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>

              <div className="space-y-3">
                {incomeBreakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted rounded"
                    data-testid={`income-item-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <style>{`.swatch-${idx}{background-color:${item.color}}`}</style>
                      <div className={`w-4 h-4 rounded swatch-${idx}`} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold">₹{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Services Tab
  const ServicesTab = () => {
    if (servicesLoading) {
      return <Skeleton className="h-96" />;
    }

    const servicesList: TaxService[] = services || [
      {
        id: 'notices',
        title: 'Tax Notices',
        description: 'View and respond to income tax notices',
        status: 'available',
        action: 'View Notices'
      },
      {
        id: 'refunds',
        title: 'Refund Status',
        description: 'Track your income tax refund status',
        status: 'available',
        action: 'Check Status'
      },
      {
        id: 'past-returns',
        title: 'Past Returns',
        description: 'Access previously filed ITRs',
        status: 'available',
        action: 'View Returns'
      },
      {
        id: 'tds-certificates',
        title: 'TDS Certificates',
        description: 'Download Form 16/16A certificates',
        status: 'available',
        action: 'Download'
      },
      {
        id: 'advance-tax',
        title: 'Advance Tax',
        description: 'Pay advance tax installments',
        status: 'available',
        action: 'Pay Now'
      },
      {
        id: 'e-verify',
        title: 'E-Verification',
        description: 'Verify your filed returns',
        status: 'available',
        action: 'Verify'
      }
    ];

    return (
      <div className="space-y-6" data-testid="services-tab">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicesList.map((service) => (
            <Card
              key={service.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              data-testid={`service-card-${service.id}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{service.title}</span>
                  {service.status === 'in_progress' && (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      In Progress
                    </Badge>
                  )}
                  {service.status === 'completed' && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {service.lastUpdated && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Last updated: {service.lastUpdated}
                  </p>
                )}
                <Button className="w-full" variant="outline" data-testid={`button-${service.id}`}>
                  {service.action}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button variant="outline" className="justify-start" data-testid="button-download-form16">
                <Download className="mr-2 h-4 w-4" />
                Download Form 16
              </Button>
              <Button variant="outline" className="justify-start" data-testid="button-view-26as">
                <Eye className="mr-2 h-4 w-4" />
                View Form 26AS
              </Button>
              <Button variant="outline" className="justify-start" data-testid="button-check-refund">
                <Receipt className="mr-2 h-4 w-4" />
                Check Refund
              </Button>
              <Button variant="outline" className="justify-start" data-testid="button-pay-tax">
                <Banknote className="mr-2 h-4 w-4" />
                Pay Tax Online
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="intelligent-tax-hub">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Intelligent Tax Hub
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered unified platform for all your tax needs
          </p>
        </div>
        <div className="flex items-center gap-4 mt-4 lg:mt-0">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-40" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-25">FY 2024-25</SelectItem>
              <SelectItem value="2023-24">FY 2023-24</SelectItem>
              <SelectItem value="2022-23">FY 2022-23</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2">
          <ScrollableTabsList className="inline-flex w-auto min-w-full" data-testid="tabs-main">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-dashboard">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="filing" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-filing">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Smart Filing</span>
            </TabsTrigger>
            <TabsTrigger value="regime" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-regime">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">Regime Comparison</span>
            </TabsTrigger>
            <TabsTrigger value="reminders" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-reminders">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Tax Reminders</span>
            </TabsTrigger>
            <TabsTrigger value="sources" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-sources">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Data Sources</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2 flex-shrink-0" data-testid="tab-services">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
          </ScrollableTabsList>
        </div>

        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>

        <TabsContent value="filing" className="mt-6">
          <SmartFilingTab />
        </TabsContent>

        <TabsContent value="regime" className="mt-6">
          <RegimeComparisonTab />
        </TabsContent>

        <TabsContent value="reminders" className="mt-6" data-testid="content-reminders">
          <TaxReminderDashboard />
        </TabsContent>

        <TabsContent value="sources" className="mt-6">
          <DataSourcesTab />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <ServicesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
