import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Lightbulb, 
  Brain, 
  Key, 
  Shield, 
  Zap,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Filter,
  RefreshCw,
  FileText,
  Bug,
  Server,
  Database,
  Globe,
  Smartphone,
  Bell,
  Languages,
  FileDown,
  Lock,
  Activity,
  TrendingUp,
  Settings
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SuggestionStatus = "pending" | "in_progress" | "completed" | "deferred";
type SuggestionPriority = "critical" | "high" | "medium" | "low";
type SuggestionCategory = "ai_enablement" | "production_apis" | "features" | "security" | "performance";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  status: SuggestionStatus;
  actionRequired: string;
  impact: string;
  estimatedEffort: string;
  configKey?: string;
  documentationUrl?: string;
  notes?: string;
  updatedAt?: string;
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: "critical" | "high" | "medium" | "low";
  category: "api" | "database" | "auth" | "ui" | "payment" | "integration";
  message: string;
  source: string;
  count: number;
  lastOccurrence: string;
  suggestedFix?: string;
  resolved: boolean;
}

const initialSuggestions: Suggestion[] = [
  {
    id: "ai-gemini",
    title: "Enable Google Gemini AI",
    description: "Unlock AI-powered investment advisory, portfolio analysis, and natural language insights",
    category: "ai_enablement",
    priority: "high",
    status: "pending",
    actionRequired: "Add GEMINI_API_KEY to environment secrets",
    impact: "Enables intelligent recommendations across 8 product categories",
    estimatedEffort: "5 minutes",
    configKey: "GEMINI_API_KEY",
    documentationUrl: "https://ai.google.dev/gemini-api/docs/api-key"
  },
  {
    id: "ai-openai",
    title: "Configure OpenAI Fallback",
    description: "Add OpenAI as fallback AI provider for enhanced reliability",
    category: "ai_enablement",
    priority: "medium",
    status: "pending",
    actionRequired: "Add OPENAI_API_KEY to environment secrets",
    impact: "Provides AI redundancy and advanced language models",
    estimatedEffort: "5 minutes",
    configKey: "OPENAI_API_KEY",
    documentationUrl: "https://platform.openai.com/api-keys"
  },
  {
    id: "ckyc-api",
    title: "Enable CKYC Verification",
    description: "Connect to AuthBridge CKYC API for real KYC verification",
    category: "production_apis",
    priority: "critical",
    status: "pending",
    actionRequired: "Configure CKYC_API_KEY and CKYC_API_SECRET",
    impact: "Enables real-time KYC verification instead of mock data",
    estimatedEffort: "15 minutes",
    configKey: "CKYC_API_KEY"
  },
  {
    id: "cashfree-prod",
    title: "Switch Cashfree to Production",
    description: "Move payment gateway from sandbox to production mode",
    category: "production_apis",
    priority: "critical",
    status: "pending",
    actionRequired: "Update CASHFREE_APP_ID and CASHFREE_SECRET_KEY with production credentials",
    impact: "Enables real payment processing",
    estimatedEffort: "10 minutes",
    configKey: "CASHFREE_APP_ID"
  },
  {
    id: "phonepe-prod",
    title: "Switch PhonePe to Production",
    description: "Move PhonePe payment gateway from sandbox to production",
    category: "production_apis",
    priority: "high",
    status: "pending",
    actionRequired: "Update PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY",
    impact: "Enables UPI and PhonePe payments",
    estimatedEffort: "10 minutes",
    configKey: "PHONEPE_MERCHANT_ID"
  },
  {
    id: "smtp-notifications",
    title: "Configure Email Notifications",
    description: "Set up SMTP for bond order notifications and alerts",
    category: "production_apis",
    priority: "medium",
    status: "pending",
    actionRequired: "Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD",
    impact: "Enables email notifications for orders and alerts",
    estimatedEffort: "10 minutes",
    configKey: "SMTP_HOST"
  },
  {
    id: "sandbox-api",
    title: "Configure Sandbox.co.in API",
    description: "Enable MCA data fallback for unlisted company verification",
    category: "production_apis",
    priority: "medium",
    status: "pending",
    actionRequired: "Verify SANDBOX_API_KEY and SANDBOX_API_SECRET",
    impact: "Enables company data verification from MCA registry",
    estimatedEffort: "5 minutes",
    configKey: "SANDBOX_API_KEY"
  },
  {
    id: "pwa-support",
    title: "Add PWA Support",
    description: "Enable Progressive Web App for mobile app-like experience",
    category: "features",
    priority: "medium",
    status: "pending",
    actionRequired: "Implement service worker and manifest.json",
    impact: "Users can install app on mobile devices",
    estimatedEffort: "2-3 hours"
  },
  {
    id: "push-notifications",
    title: "Push Notifications",
    description: "Implement browser push notifications for alerts, IPO opens, SIP dates",
    category: "features",
    priority: "medium",
    status: "pending",
    actionRequired: "Integrate Web Push API with service worker",
    impact: "Real-time alerts even when app is closed",
    estimatedEffort: "4-6 hours"
  },
  {
    id: "document-vault",
    title: "Secure Document Vault",
    description: "Add encrypted storage for KYC documents and statements",
    category: "features",
    priority: "low",
    status: "pending",
    actionRequired: "Implement encrypted file storage with access controls",
    impact: "Secure document management for compliance",
    estimatedEffort: "1-2 days"
  },
  {
    id: "multi-language",
    title: "Multi-language Support",
    description: "Add Hindi and regional language support",
    category: "features",
    priority: "low",
    status: "pending",
    actionRequired: "Implement i18n framework with translation files",
    impact: "Wider user reach across India",
    estimatedEffort: "2-3 days"
  },
  {
    id: "pdf-reports",
    title: "PDF Portfolio Statements",
    description: "Generate downloadable PDF reports with charts",
    category: "features",
    priority: "medium",
    status: "pending",
    actionRequired: "Integrate PDF generation library (jsPDF)",
    impact: "Professional portfolio statements for users",
    estimatedEffort: "1 day"
  },
  {
    id: "2fa-transactions",
    title: "Two-Factor for Transactions",
    description: "Add OTP verification for high-value transactions",
    category: "security",
    priority: "high",
    status: "pending",
    actionRequired: "Implement transaction-level OTP verification",
    impact: "Enhanced security for financial transactions",
    estimatedEffort: "4-6 hours"
  },
  {
    id: "cdn-assets",
    title: "CDN for Static Assets",
    description: "Configure CDN for faster asset delivery in production",
    category: "performance",
    priority: "low",
    status: "pending",
    actionRequired: "Configure Cloudflare or similar CDN",
    impact: "Faster page loads globally",
    estimatedEffort: "2-3 hours"
  },
  {
    id: "market-data-live",
    title: "Live Market Data Feed",
    description: "Integrate real-time stock price feeds",
    category: "features",
    priority: "high",
    status: "pending",
    actionRequired: "Connect to NSE/BSE data provider API",
    impact: "Real-time portfolio valuation and alerts",
    estimatedEffort: "1-2 days"
  }
];

const sampleErrorLogs: ErrorLogEntry[] = [
  {
    id: "err-1",
    timestamp: new Date().toISOString(),
    level: "medium",
    category: "api",
    message: "CKYC API credentials not configured - using mock mode",
    source: "server/services/ckyc-service.ts",
    count: 1,
    lastOccurrence: new Date().toISOString(),
    suggestedFix: "Configure CKYC_API_KEY and CKYC_API_SECRET environment variables",
    resolved: false
  },
  {
    id: "err-2",
    timestamp: new Date().toISOString(),
    level: "low",
    category: "integration",
    message: "AuthBridge CKYC API credentials not configured - using mock mode",
    source: "server/services/authbridge-ckyc-service.ts",
    count: 1,
    lastOccurrence: new Date().toISOString(),
    suggestedFix: "Add AuthBridge API credentials for production CKYC verification",
    resolved: false
  },
  {
    id: "err-3",
    timestamp: new Date().toISOString(),
    level: "low",
    category: "integration",
    message: "AI Investment Service running without Gemini - using rule-based analysis",
    source: "server/services/ai-investment-service.ts",
    count: 1,
    lastOccurrence: new Date().toISOString(),
    suggestedFix: "Add GEMINI_API_KEY to enable AI-powered investment advisory",
    resolved: false
  },
  {
    id: "err-4",
    timestamp: new Date().toISOString(),
    level: "low",
    category: "integration",
    message: "Bond Order Notification email not configured - missing SMTP credentials",
    source: "server/services/bond-notification-service.ts",
    count: 1,
    lastOccurrence: new Date().toISOString(),
    suggestedFix: "Configure SMTP settings for email notifications",
    resolved: false
  }
];

const STORAGE_KEY = "fintekpro_suggestions_state";

function loadSuggestionsFromStorage(): Record<string, { status: SuggestionStatus; notes?: string; updatedAt?: string }> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveSuggestionsToStorage(suggestions: Suggestion[]) {
  const stateMap: Record<string, { status: SuggestionStatus; notes?: string; updatedAt?: string }> = {};
  suggestions.forEach(s => {
    stateMap[s.id] = { status: s.status, notes: s.notes, updatedAt: s.updatedAt };
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap));
}

function mergeWithStoredState(initial: Suggestion[]): Suggestion[] {
  const stored = loadSuggestionsFromStorage();
  return initial.map(s => ({
    ...s,
    status: stored[s.id]?.status || s.status,
    notes: stored[s.id]?.notes || s.notes,
    updatedAt: stored[s.id]?.updatedAt || s.updatedAt,
  }));
}

export default function ReplitSuggestions() {
  const [activeTab, setActiveTab] = useState("suggestions");
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => mergeWithStoredState(initialSuggestions));
  const [resolvedErrors, setResolvedErrors] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("fintekpro_resolved_errors");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [errorLevelFilter, setErrorLevelFilter] = useState<string>("all");
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const { data: serverErrors, isLoading: loadingErrors, refetch: refetchErrors } = useQuery<{
    errorLogs: ErrorLogEntry[];
    summary: { total: number; critical: number; high: number; medium: number; low: number };
    lastUpdated: string;
  }>({
    queryKey: ['/api/admin/error-logs'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    saveSuggestionsToStorage(suggestions);
  }, [suggestions]);

  useEffect(() => {
    localStorage.setItem("fintekpro_resolved_errors", JSON.stringify(Array.from(resolvedErrors)));
  }, [resolvedErrors]);

  const errorLogs: ErrorLogEntry[] = (serverErrors?.errorLogs || sampleErrorLogs).map(e => ({
    ...e,
    resolved: resolvedErrors.has(e.id)
  }));

  const updateSuggestionStatus = (id: string, newStatus: SuggestionStatus) => {
    setSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, status: newStatus, updatedAt: new Date().toISOString() } : s
    ));
    toast({
      title: "Status Updated",
      description: `Suggestion marked as ${newStatus.replace('_', ' ')}`,
    });
  };

  const addNoteToSuggestion = (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (suggestion) {
      setSelectedSuggestion(suggestion);
      setNotes(suggestion.notes || "");
      setNotesDialogOpen(true);
    }
  };

  const saveNotes = () => {
    if (selectedSuggestion) {
      setSuggestions(prev => prev.map(s =>
        s.id === selectedSuggestion.id ? { ...s, notes, updatedAt: new Date().toISOString() } : s
      ));
      setNotesDialogOpen(false);
      toast({ title: "Notes Saved", description: "Your notes have been saved" });
    }
  };

  const markErrorResolved = (id: string) => {
    setResolvedErrors(prev => new Set([...Array.from(prev), id]));
    toast({ title: "Error Resolved", description: "Error marked as resolved" });
  };

  const getCategoryIcon = (category: SuggestionCategory) => {
    switch (category) {
      case "ai_enablement": return <Brain className="h-5 w-5" />;
      case "production_apis": return <Key className="h-5 w-5" />;
      case "features": return <Zap className="h-5 w-5" />;
      case "security": return <Shield className="h-5 w-5" />;
      case "performance": return <Activity className="h-5 w-5" />;
    }
  };

  const getCategoryColor = (category: SuggestionCategory) => {
    switch (category) {
      case "ai_enablement": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "production_apis": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "features": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "security": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "performance": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    }
  };

  const getPriorityColor = (priority: SuggestionPriority) => {
    switch (priority) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black dark:text-black";
      case "low": return "bg-muted text-foreground";
    }
  };

  const getStatusColor = (status: SuggestionStatus) => {
    switch (status) {
      case "pending": return "bg-muted text-foreground";
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "deferred": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    }
  };

  const getErrorLevelColor = (level: ErrorLogEntry["level"]) => {
    switch (level) {
      case "critical": return "bg-red-500 text-white";
      case "high": return "bg-orange-500 text-white";
      case "medium": return "bg-yellow-500 text-black dark:text-black";
      case "low": return "bg-blue-500 text-white";
    }
  };

  const getErrorCategoryIcon = (category: ErrorLogEntry["category"]) => {
    switch (category) {
      case "api": return <Globe className="h-4 w-4" />;
      case "database": return <Database className="h-4 w-4" />;
      case "auth": return <Lock className="h-4 w-4" />;
      case "ui": return <Smartphone className="h-4 w-4" />;
      case "payment": return <TrendingUp className="h-4 w-4" />;
      case "integration": return <Settings className="h-4 w-4" />;
    }
  };

  const filteredSuggestions = suggestions.filter(s => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && s.priority !== priorityFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const filteredErrors = errorLogs.filter(e => {
    if (errorLevelFilter !== "all" && e.level !== errorLevelFilter) return false;
    return true;
  });

  const suggestionsByCategory = {
    ai_enablement: filteredSuggestions.filter(s => s.category === "ai_enablement"),
    production_apis: filteredSuggestions.filter(s => s.category === "production_apis"),
    features: filteredSuggestions.filter(s => s.category === "features"),
    security: filteredSuggestions.filter(s => s.category === "security"),
    performance: filteredSuggestions.filter(s => s.category === "performance"),
  };

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter(s => s.status === "pending").length,
    inProgress: suggestions.filter(s => s.status === "in_progress").length,
    completed: suggestions.filter(s => s.status === "completed").length,
    critical: suggestions.filter(s => s.priority === "critical").length,
  };

  const errorStats = {
    total: errorLogs.length,
    critical: errorLogs.filter(e => e.level === "critical" && !e.resolved).length,
    high: errorLogs.filter(e => e.level === "high" && !e.resolved).length,
    medium: errorLogs.filter(e => e.level === "medium" && !e.resolved).length,
    low: errorLogs.filter(e => e.level === "low" && !e.resolved).length,
    resolved: errorLogs.filter(e => e.resolved).length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
              Replit Suggestions
            </h1>
            <p className="text-muted-foreground mt-1">
              Track improvement initiatives and error analysis for FintekPro
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Suggestion status is saved locally. Error logs are fetched from server.
            </p>
          </div>
          <Button 
            onClick={() => refetchErrors()} 
            variant="outline"
            className="gap-2"
            data-testid="button-refresh-suggestions"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Suggestions</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <Lightbulb className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Critical Priority</p>
                  <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Pending</p>
                  <p className="text-2xl font-bold text-muted-foreground">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">In Progress</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
                </div>
                <Play className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Completed</p>
                  <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <ScrollableTabsList>
            <TabsTrigger value="suggestions" className="gap-2" data-testid="tab-suggestions">
              <Lightbulb className="h-4 w-4" />
              Improvement Suggestions
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2" data-testid="tab-errors">
              <Bug className="h-4 w-4" />
              Error Log Analysis
              {errorStats.critical + errorStats.high > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {errorStats.critical + errorStats.high}
                </Badge>
              )}
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="suggestions" className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] bg-muted border-border" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="ai_enablement">AI Enablement</SelectItem>
                  <SelectItem value="production_apis">Production APIs</SelectItem>
                  <SelectItem value="features">Features</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[150px] bg-muted border-border" data-testid="select-priority-filter">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-muted border-border" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {Object.entries(suggestionsByCategory).map(([category, items]) => {
              if (items.length === 0) return null;
              const categoryLabel = category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
              
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${getCategoryColor(category as SuggestionCategory)}`}>
                      {getCategoryIcon(category as SuggestionCategory)}
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">{categoryLabel}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  
                  <div className="grid gap-4">
                    {items.map((suggestion) => (
                      <Card key={suggestion.id} className="bg-muted border-border hover:border-border transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-medium text-foreground">{suggestion.title}</h3>
                                <Badge className={getPriorityColor(suggestion.priority)}>
                                  {suggestion.priority}
                                </Badge>
                                <Badge className={getStatusColor(suggestion.status)}>
                                  {suggestion.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground">{suggestion.description}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Action Required</p>
                                  <p className="text-muted-foreground">{suggestion.actionRequired}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Impact</p>
                                  <p className="text-muted-foreground">{suggestion.impact}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Estimated Effort</p>
                                  <p className="text-muted-foreground">{suggestion.estimatedEffort}</p>
                                </div>
                              </div>

                              {suggestion.notes && (
                                <div className="mt-2 p-2 bg-muted rounded text-sm">
                                  <p className="text-muted-foreground">Notes: {suggestion.notes}</p>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2">
                              {suggestion.status === "pending" && (
                                <Button
                                  size="sm"
                                  onClick={() => updateSuggestionStatus(suggestion.id, "in_progress")}
                                  className="gap-1"
                                  data-testid={`button-start-${suggestion.id}`}
                                >
                                  <Play className="h-3 w-3" />
                                  Start
                                </Button>
                              )}
                              {suggestion.status === "in_progress" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateSuggestionStatus(suggestion.id, "completed")}
                                    className="gap-1 bg-green-600 hover:bg-green-700"
                                    data-testid={`button-complete-${suggestion.id}`}
                                  >
                                    <CheckCircle className="h-3 w-3" />
                                    Complete
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateSuggestionStatus(suggestion.id, "pending")}
                                    className="gap-1"
                                    data-testid={`button-pause-${suggestion.id}`}
                                  >
                                    <Pause className="h-3 w-3" />
                                    Pause
                                  </Button>
                                </>
                              )}
                              {suggestion.status === "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateSuggestionStatus(suggestion.id, "pending")}
                                  className="gap-1"
                                  data-testid={`button-reopen-${suggestion.id}`}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Reopen
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => addNoteToSuggestion(suggestion.id)}
                                className="gap-1"
                                data-testid={`button-notes-${suggestion.id}`}
                              >
                                <FileText className="h-3 w-3" />
                                Notes
                              </Button>
                              {suggestion.documentationUrl && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(suggestion.documentationUrl, '_blank')}
                                  className="gap-1"
                                  data-testid={`button-docs-${suggestion.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Docs
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="errors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="bg-red-900/30 border-red-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-300 text-sm">Critical</p>
                      <p className="text-2xl font-bold text-red-400">{errorStats.critical}</p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-orange-900/30 border-orange-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-300 text-sm">High</p>
                      <p className="text-2xl font-bold text-orange-400">{errorStats.high}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-900/30 border-yellow-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-300 text-sm">Medium</p>
                      <p className="text-2xl font-bold text-yellow-400">{errorStats.medium}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-900/30 border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-300 text-sm">Low</p>
                      <p className="text-2xl font-bold text-blue-400">{errorStats.low}</p>
                    </div>
                    <Bug className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-900/30 border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-300 text-sm">Resolved</p>
                      <p className="text-2xl font-bold text-green-400">{errorStats.resolved}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-4">
              <Select value={errorLevelFilter} onValueChange={setErrorLevelFilter}>
                <SelectTrigger className="w-[150px] bg-muted border-border" data-testid="select-error-level-filter">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-muted border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Error Log Priority Matrix
                </CardTitle>
                <CardDescription>
                  Errors detected from application logs with suggested fixes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredErrors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <p>No errors found matching the filter criteria</p>
                    </div>
                  ) : (
                    filteredErrors.map((error) => (
                      <div
                        key={error.id}
                        className={`p-4 rounded-lg border ${
                          error.resolved 
                            ? 'bg-muted/50 border-border opacity-60' 
                            : 'bg-muted border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getErrorLevelColor(error.level)}>
                                {error.level.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="gap-1">
                                {getErrorCategoryIcon(error.category)}
                                {error.category}
                              </Badge>
                              {error.resolved && (
                                <Badge className="bg-green-600">Resolved</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(error.lastOccurrence), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                            <p className="text-foreground font-medium">{error.message}</p>
                            <p className="text-sm text-muted-foreground">Source: {error.source}</p>
                            {error.suggestedFix && (
                              <div className="mt-2 p-2 bg-blue-900/30 border border-blue-800 rounded">
                                <p className="text-sm text-blue-300">
                                  <span className="font-medium">Suggested Fix:</span> {error.suggestedFix}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2">
                            {!error.resolved && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markErrorResolved(error.id)}
                                className="gap-1"
                                data-testid={`button-resolve-${error.id}`}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
          <DialogContent className="bg-muted border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add Notes</DialogTitle>
              <DialogDescription>
                Add notes or comments for: {selectedSuggestion?.title}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your notes here..."
              className="min-h-[100px] bg-muted border-border"
              data-testid="input-notes"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveNotes} data-testid="button-save-notes">
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
