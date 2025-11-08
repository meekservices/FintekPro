import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  EyeOff,
  Shield,
  ArrowUpDown,
  PieChart,
  BarChart3,
  Activity,
  Zap,
  Info,
  ChevronRight,
  ChevronDown,
  Settings,
  Calculator,
  Lightbulb,
  X
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

interface DashboardData {
  healthScore: TaxHealthScore;
  incomeSources: IncomeSource[];
  timeline: TaxTimeline[];
  quickStats: QuickStats;
  recommendations: AIRecommendation[];
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

// Wizard-specific interfaces
interface TaxSession {
  id: string;
  status: string;
  currentStep: number;
  completionPercentage: number;
  suggestedItrForm?: string;
  suggestedTaxRegime?: string;
}

interface SessionData {
  session?: TaxSession;
  dataSources?: WizardDataSource[];
  validation?: {
    issues: ValidationIssue[];
    summary: { totalIssues: number; errors: number; warnings: number; suggestions: number };
  };
  suggestions?: OptimizationSuggestion[];
  filingRecord?: FilingRecord;
}

interface WizardDataSource {
  id: string;
  name: string;
  status: string;
  recordsCount: number;
  lastSync?: string;
}

interface ValidationIssue {
  id: string;
  section: string;
  severity: "error" | "warning" | "suggestion";
  message: string;
  fixHint?: string;
  autoFixable: boolean;
}

interface OptimizationSuggestion {
  id: string;
  title: string;
  description: string;
  potentialSaving: string;
  confidence: string;
  automatable: boolean;
  category: string;
}

interface FilingRecord {
  acknowledgmentNumber: string;
  filingDate: string;
  itrForm: string;
  status: string;
}

// Wizard validation schema
const sessionSchema = z.object({
  panNumber: z.string()
    .min(10, "PAN must be 10 characters")
    .max(10, "PAN must be 10 characters")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  assessmentYear: z.string().min(1, "Assessment year is required"),
  consent: z.boolean().refine(val => val === true, "Consent is required to proceed")
});

type SessionForm = z.infer<typeof sessionSchema>;

export default function IntelligentTaxHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedYear, setSelectedYear] = useState("2024-25");
  const [scenarioIncome, setScenarioIncome] = useState<number>(1000000);
  
  // Wizard state
  const [wizardMode, setWizardMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, string>>({});
  const [panMasked, setPanMasked] = useState(true);
  
  // Read tab parameter from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchString]);
  
  // Wizard form setup
  const sessionForm = useForm<SessionForm>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      panNumber: "",
      assessmentYear: selectedYear,
      consent: false
    }
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
      apiRequest('POST', `/api/tax-hub/sync/${sourceId}`, {
        body: { year: selectedYear }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/dashboard', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/filing', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/data-sources', selectedYear] });
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
      apiRequest('POST', '/api/tax-hub/file-itr', {
        body: { ...formData, year: selectedYear }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/dashboard', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/filing', selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['/api/tax-hub/services', selectedYear] });
      toast({
        title: "ITR Filed Successfully",
        description: "Your income tax return has been filed successfully"
      });
    }
  });

  // Wizard Mutations
  const createSessionMutation = useMutation({
    mutationFn: async (data: SessionForm) => {
      const response = await fetch("/api/tax/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panNumber: data.panNumber,
          assessmentYear: data.assessmentYear
        })
      });
      if (!response.ok) throw new Error("Failed to create session");
      return response.json();
    },
    onSuccess: (session: TaxSession) => {
      setSessionId(session.id);
      setCurrentStep(2);
      toast({
        title: "Session Created",
        description: "Tax filing session started successfully"
      });
    }
  });

  const initializeDataSourcesMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/initialize`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to initialize data sources");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Data Sources Ready",
        description: "All tax data sources have been initialized"
      });
    }
  });

  const syncAllMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/sync-all`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to sync data");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(3);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Data Synced",
        description: `Processed ${result.totalRecords} records from ${result.sourcesProcessed} sources`
      });
    }
  });

  const validateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/validate`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to validate data");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(4);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Validation Complete",
        description: `Found ${result.summary.totalIssues} items to review`
      });
    }
  });

  const optimizeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/optimize`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to generate suggestions");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(5);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "Optimization Complete",
        description: `Generated ${result.suggestions.length} smart suggestions`
      });
    }
  });

  const generateMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/tax/session/${sessionId}/generate`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Failed to generate ITR");
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "ITR Generated",
        description: `Estimated refund: ₹${result.estimatedRefund.toLocaleString()}`
      });
    }
  });

  const fileWizardMutation = useMutation({
    mutationFn: async ({ sessionId, itrJson }: { sessionId: string; itrJson: string }) => {
      const response = await fetch(`/api/tax/session/${sessionId}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itrJson, verificationMethod: "aadhaar" })
      });
      if (!response.ok) throw new Error("Failed to file ITR");
      return response.json();
    },
    onSuccess: (result) => {
      setCurrentStep(6);
      queryClient.invalidateQueries({ queryKey: ["/api/tax/session", sessionId] });
      toast({
        title: "ITR Filed Successfully",
        description: `Acknowledgment: ${result.acknowledgmentNumber}`
      });
    }
  });

  // Wizard Session Data Query
  const { data: sessionData, refetch: refetchSession } = useQuery<SessionData>({
    queryKey: ["/api/tax/session", sessionId],
    enabled: !!sessionId
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

  // Wizard Helper Functions
  const formatPAN = (pan: string) => {
    if (panMasked && pan.length === 10) {
      return `${pan.slice(0, 3)}XXXXXX${pan.slice(-1)}`;
    }
    return pan;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error": return "destructive";
      case "warning": return "secondary";
      case "suggestion": return "default";
      default: return "default";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error": return <AlertTriangle className="h-4 w-4" />;
      case "warning": return <Clock className="h-4 w-4" />;
      case "suggestion": return <Lightbulb className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Wizard Step Configuration
  const steps = [
    { id: 1, title: "Consent & Setup", description: "PAN verification and consent" },
    { id: 2, title: "Auto-Aggregate", description: "Connect and sync data sources" },
    { id: 3, title: "Review & Validate", description: "Review data and fix issues" },
    { id: 4, title: "AI Optimization", description: "Smart tax-saving suggestions" },
    { id: 5, title: "Generate & File", description: "Create and submit ITR" },
    { id: 6, title: "Receipt & Track", description: "Track filing status" }
  ];

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
                      className="text-gray-200 dark:text-gray-700"
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">out of 100</span>
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
                      <span className="text-gray-600 dark:text-gray-400">{factor.name}</span>
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
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        data-testid={`income-source-${source.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${source.verified ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          <div>
                            <p className="font-medium text-sm">{source.name}</p>
                            <p className="text-xs text-gray-500">{source.type} • {source.source}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">₹{source.amount.toLocaleString()}</span>
                          {source.verified ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
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
                        className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        data-testid={`timeline-event-${idx}`}
                      >
                        <div className={`mt-1 p-2 rounded-full ${
                          event.status === 'completed' ? 'bg-green-100' :
                          event.status === 'upcoming' ? 'bg-blue-100' : 'bg-red-100'
                        }`}>
                          {event.type === 'deadline' ? <Calendar className="h-4 w-4" /> :
                           event.type === 'payment' ? <Banknote className="h-4 w-4" /> :
                           <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{event.title}</p>
                            <span className="text-xs text-gray-500">{event.date}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
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
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{rec.description}</p>
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
                <div className="col-span-full text-center py-8 text-gray-500">
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

  // Wizard Step Render Functions
  const renderConsentStep = () => (
    <Card data-testid="card-consent-step">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Tax Filing Consent & Setup
        </CardTitle>
        <CardDescription>
          Provide your PAN and consent to start the intelligent tax filing process
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...sessionForm}>
          <form onSubmit={sessionForm.handleSubmit((data) => createSessionMutation.mutate(data))} className="space-y-6">
            <FormField
              control={sessionForm.control}
              name="panNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN Number</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="ABCDE1234F"
                        className="font-mono"
                        value={field.value}
                        data-testid="input-pan-number"
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPanMasked(!panMasked)}
                      data-testid="button-toggle-pan-visibility"
                    >
                      {panMasked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={sessionForm.control}
              name="assessmentYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Year</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-assessment-year">
                        <SelectValue placeholder="Select assessment year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2024-25">2024-25</SelectItem>
                      <SelectItem value="2023-24">2023-24</SelectItem>
                      <SelectItem value="2022-23">2022-23</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your data is encrypted and secure. We only access tax-related information with your explicit consent.
              </AlertDescription>
            </Alert>

            <FormField
              control={sessionForm.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-consent"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      I consent to data aggregation and AI-powered tax optimization
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={createSessionMutation.isPending}
              data-testid="button-start-filing"
            >
              {createSessionMutation.isPending ? "Starting..." : "Start Smart Filing"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );

  const renderAggregateStep = () => {
    const dataSources = (sessionData as SessionData)?.dataSources || [];
    
    return (
      <Card data-testid="card-aggregate-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Auto-Aggregate Tax Data
          </CardTitle>
          <CardDescription>
            Connecting to tax data sources and syncing your information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!initializeDataSourcesMutation.isSuccess && (
            <Button
              onClick={() => sessionId && initializeDataSourcesMutation.mutate(sessionId)}
              disabled={initializeDataSourcesMutation.isPending}
              className="w-full"
              data-testid="button-initialize-sources"
            >
              {initializeDataSourcesMutation.isPending ? "Initializing..." : "Initialize Data Sources"}
            </Button>
          )}

          {initializeDataSourcesMutation.isSuccess && (
            <>
              <div className="grid gap-3">
                {dataSources.map((source: WizardDataSource) => (
                  <div key={source.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`source-${source.id}`}>
                    <div className="flex items-center gap-3">
                      <Database className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{source.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {source.recordsCount} records
                        </div>
                      </div>
                    </div>
                    <Badge variant={source.status === 'connected' ? 'default' : 'secondary'}>
                      {source.status}
                    </Badge>
                  </div>
                ))}
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" data-testid="button-toggle-advanced">
                    Advanced Options
                    {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  <Alert>
                    <AlertDescription>
                      Advanced users can manually select specific data sources or configure sync parameters.
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={() => sessionId && syncAllMutation.mutate(sessionId)}
                disabled={syncAllMutation.isPending}
                className="w-full"
                data-testid="button-sync-all"
              >
                {syncAllMutation.isPending ? "Syncing..." : "Sync All Sources"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderReviewStep = () => {
    const validationData = (sessionData as SessionData)?.validation || { 
      issues: [], 
      summary: { totalIssues: 0, errors: 0, warnings: 0, suggestions: 0 } 
    };
    
    return (
      <Card data-testid="card-review-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Review & Fix Issues
          </CardTitle>
          <CardDescription>
            AI-powered validation found {validationData.summary.totalIssues} items to review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!validateMutation.isSuccess && (
            <Button
              onClick={() => sessionId && validateMutation.mutate(sessionId)}
              disabled={validateMutation.isPending}
              className="w-full"
              data-testid="button-validate-data"
            >
              {validateMutation.isPending ? "Validating..." : "Validate Tax Data"}
            </Button>
          )}

          {validateMutation.isSuccess && (
            <Tabs defaultValue="errors" className="w-full">
              <ScrollableTabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="errors" data-testid="tab-errors">Errors</TabsTrigger>
                <TabsTrigger value="warnings" data-testid="tab-warnings">Warnings</TabsTrigger>
                <TabsTrigger value="suggestions" data-testid="tab-suggestions">Suggestions</TabsTrigger>
              </ScrollableTabsList>
              
              {["errors", "warnings", "suggestions"].map((severity) => (
                <TabsContent key={severity} value={severity} className="space-y-3">
                  {validationData.issues
                    ?.filter((issue: ValidationIssue) => issue.severity === severity.slice(0, -1))
                    .map((issue: ValidationIssue) => (
                      <Alert key={issue.id} data-testid={`issue-${issue.id}`}>
                        {getSeverityIcon(issue.severity)}
                        <AlertDescription>
                          <div className="space-y-2">
                            <div className="font-medium">{issue.message}</div>
                            {issue.fixHint && (
                              <div className="text-sm text-muted-foreground">
                                💡 {issue.fixHint}
                              </div>
                            )}
                            {issue.autoFixable && (
                              <Button size="sm" variant="outline" data-testid={`button-autofix-${issue.id}`}>
                                Auto Fix
                              </Button>
                            )}
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {validateMutation.isSuccess && (
            <Button
              onClick={() => setCurrentStep(4)}
              className="w-full"
              data-testid="button-continue-to-optimize"
            >
              Continue to Optimization
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderOptimizeStep = () => {
    const suggestions = (sessionData as SessionData)?.suggestions || [];
    
    return (
      <Card data-testid="card-optimize-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Tax Optimization
          </CardTitle>
          <CardDescription>
            Smart suggestions to maximize your tax savings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!optimizeMutation.isSuccess && (
            <Button
              onClick={() => sessionId && optimizeMutation.mutate(sessionId)}
              disabled={optimizeMutation.isPending}
              className="w-full"
              data-testid="button-generate-suggestions"
            >
              {optimizeMutation.isPending ? "Analyzing..." : "Generate AI Suggestions"}
            </Button>
          )}

          {optimizeMutation.isSuccess && (
            <>
              <div className="space-y-3">
                {suggestions.map((suggestion: OptimizationSuggestion) => (
                  <Card key={suggestion.id} className="p-4" data-testid={`suggestion-${suggestion.id}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            {suggestion.title}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {suggestion.description}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-green-600">
                          ₹{parseInt(suggestion.potentialSaving).toLocaleString()} savings
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`suggestion-${suggestion.id}`}>Apply this suggestion</Label>
                          <Switch
                            id={`suggestion-${suggestion.id}`}
                            checked={selectedSuggestions[suggestion.id] === 'accepted'}
                            onCheckedChange={(checked) => 
                              setSelectedSuggestions(prev => ({
                                ...prev,
                                [suggestion.id]: checked ? 'accepted' : 'rejected'
                              }))
                            }
                            data-testid={`switch-suggestion-${suggestion.id}`}
                          />
                        </div>
                        <Badge variant="secondary">
                          {Math.round(parseFloat(suggestion.confidence) * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                onClick={() => setCurrentStep(5)}
                className="w-full"
                data-testid="button-continue-to-generate"
              >
                Apply Selected & Continue
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGenerateStep = () => {
    return (
      <Card data-testid="card-generate-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate & File ITR
          </CardTitle>
          <CardDescription>
            Create your ITR and submit to Income Tax Department
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generateMutation.isSuccess && (
            <Button
              onClick={() => sessionId && generateMutation.mutate(sessionId)}
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-itr"
            >
              {generateMutation.isPending ? "Generating ITR..." : "Generate ITR JSON"}
            </Button>
          )}

          {generateMutation.isSuccess && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ITR generated successfully! Review before filing.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <Button variant="outline" className="justify-start" data-testid="button-download-json">
                  <Download className="h-4 w-4 mr-2" />
                  Download ITR JSON
                </Button>
                <Button variant="outline" className="justify-start" data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download ITR PDF
                </Button>
              </div>

              <Button
                onClick={() => sessionId && fileWizardMutation.mutate({ 
                  sessionId, 
                  itrJson: JSON.stringify({}) 
                })}
                disabled={fileWizardMutation.isPending}
                className="w-full"
                data-testid="button-file-itr"
              >
                {fileWizardMutation.isPending ? "Filing..." : "File ITR with Income Tax Department"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderReceiptStep = () => {
    const filingRecord = (sessionData as SessionData)?.filingRecord;
    
    return (
      <Card data-testid="card-receipt-step">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Filing Receipt & Tracking
          </CardTitle>
          <CardDescription>
            Your ITR has been successfully filed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {filingRecord && (
            <>
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ITR filed successfully! Your acknowledgment number is {filingRecord.acknowledgmentNumber}
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                <div className="flex justify-between">
                  <span>Acknowledgment Number:</span>
                  <span className="font-mono">{filingRecord.acknowledgmentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Filing Date:</span>
                  <span>{new Date(filingRecord.filingDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>ITR Form:</span>
                  <span>{filingRecord.itrForm}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="default">{filingRecord.status}</Badge>
                </div>
              </div>

              <Button className="w-full" data-testid="button-download-acknowledgment">
                <Download className="h-4 w-4 mr-2" />
                Download Acknowledgment Receipt
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  // Smart Filing Tab Component with Wizard Mode Support
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

    // Wizard Mode: Show progress bar and current wizard step
    if (wizardMode) {
      return (
        <div className="space-y-6" data-testid="filing-tab-wizard">
          {/* Mode Toggle Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                  <div>
                    <h3 className="font-bold text-lg">Smart Filing Wizard</h3>
                    <p className="text-sm text-gray-600">AI-powered step-by-step filing assistance</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setWizardMode(false);
                    setCurrentStep(1);
                    setSessionId(null);
                  }}
                  data-testid="button-exit-wizard"
                >
                  <X className="h-4 w-4 mr-2" />
                  Exit Wizard
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Wizard Progress Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">
                    Step {currentStep} of {steps.length}
                  </span>
                </div>
                <Progress 
                  value={(currentStep / steps.length) * 100} 
                  className="w-full"
                  data-testid="progress-wizard"
                />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={`text-center p-2 rounded ${
                        currentStep >= step.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}
                      data-testid={`step-indicator-${step.id}`}
                    >
                      <div className="font-medium">{step.title}</div>
                      <div className="text-xs opacity-75 hidden md:block">{step.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Wizard Step Content */}
          <div data-testid={`wizard-step-content-${currentStep}`}>
            {currentStep === 1 && renderConsentStep()}
            {currentStep === 2 && renderAggregateStep()}
            {currentStep === 3 && renderReviewStep()}
            {currentStep === 4 && renderOptimizeStep()}
            {currentStep === 5 && renderGenerateStep()}
            {currentStep === 6 && renderReceiptStep()}
          </div>
        </div>
      );
    }

    // Overview Mode: Show current content with wizard launch button
    return (
      <div className="space-y-6" data-testid="filing-tab">
        {/* Wizard Launch Card - Prominent CTA */}
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2 border-blue-300 dark:border-blue-700" data-testid="card-wizard-launch">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">AI-Powered Smart Filing Wizard</h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Step-by-step guidance with intelligent data aggregation, validation, and optimization
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Secure
                    </Badge>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <Brain className="h-3 w-3 mr-1" />
                      AI-Powered
                    </Badge>
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                      <Zap className="h-3 w-3 mr-1" />
                      Auto-fill
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
                onClick={() => setWizardMode(true)}
                data-testid="button-launch-wizard"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Start Filing Wizard
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

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
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`form-option-${form.formType}`}
                  >
                    {form.recommended && (
                      <Badge className="mb-2 bg-blue-600">Recommended</Badge>
                    )}
                    <h4 className="font-bold text-lg">{form.formType}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{form.name}</p>
                    <p className="text-xs text-gray-500 mb-3">{form.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{form.complexity}</Badge>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Applicability</div>
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
                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg" data-testid={`autofill-source-${idx}`}>
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
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <span className="text-sm">Total Income</span>
                  <span className="font-bold" data-testid="text-calc-income">₹{calculator.totalIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
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
                          <p className="text-xs text-gray-600">{deduction.title}</p>
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
                  <p className="text-center text-gray-500 py-4">No deduction suggestions available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Filing Action */}
        <Card data-testid="card-filing-action">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Ready for Quick Filing?</h3>
                <p className="text-sm text-gray-600">File directly or use the wizard for guided assistance</p>
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-green-600 to-teal-600"
                disabled={autoFillStatus.overall < 100 || fileMutation.isPending}
                onClick={() => fileMutation.mutate({})}
                data-testid="button-file-itr-quick"
              >
                {fileMutation.isPending ? "Filing..." : "Quick File ITR"}
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
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tax Liability</div>
                  <div className="text-3xl font-bold" data-testid="text-old-liability">
                    ₹{regime.oldRegime.taxLiability.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-600">Deductions</div>
                    <div className="font-semibold">₹{regime.oldRegime.deductions.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-600">Effective Rate</div>
                    <div className="font-semibold">{regime.oldRegime.effectiveRate}%</div>
                  </div>
                </div>
              </div>

              {regime.oldRegime.breakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Tax Breakdown</h4>
                  {regime.oldRegime.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
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
                  <div className="text-sm text-gray-600 dark:text-gray-400">Tax Liability</div>
                  <div className="text-3xl font-bold" data-testid="text-new-liability">
                    ₹{regime.newRegime.taxLiability.toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-600">Deductions</div>
                    <div className="font-semibold">₹{regime.newRegime.deductions.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <div className="text-xs text-gray-600">Effective Rate</div>
                    <div className="font-semibold">{regime.newRegime.effectiveRate}%</div>
                  </div>
                </div>
              </div>

              {regime.newRegime.breakdown.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Tax Breakdown</h4>
                  {regime.newRegime.breakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
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
              <p className="text-sm text-gray-600">
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
                    <span className="text-gray-600">Records</span>
                    <span className="font-semibold" data-testid={`text-records-${source.id}`}>
                      {source.recordCount}
                    </span>
                  </div>

                  {source.lastSync && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last Sync</span>
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
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded"
                    data-testid={`income-item-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.color }}
                      />
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
                  <p className="text-xs text-gray-500 mb-3">
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
          <p className="text-gray-600 dark:text-gray-300 mt-2">
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
