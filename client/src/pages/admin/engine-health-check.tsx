import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Brain,
  Clock,
  ChevronDown,
  ChevronRight,
  Cpu,
  Shield as LucideShield,
  Calculator,
  TrendingUp,
  PieChart,
  Target,
  Banknote,
  Scale,
  BarChart3,
  Zap,
  ArrowUpCircle,
  CircleDot,
  MinusCircle,
  Search,
  Filter,
  FlaskConical,
  Layers,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EngineTestResult {
  engine: string;
  category: string;
  status: "pass" | "fail" | "warn";
  latencyMs: number;
  details: string;
  sampleOutput?: any;
  error?: string;
}

interface CategoryBreakdown {
  category: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  avgLatencyMs: number;
}

interface HealthCheckResponse {
  success: boolean;
  summary: {
    totalEngines: number;
    passed: number;
    failed: number;
    warned: number;
    overallStatus: string;
    totalLatencyMs: number;
    timestamp: string;
  };
  categoryBreakdown: CategoryBreakdown[];
  results: EngineTestResult[];
}

interface AuditResponse {
  success: boolean;
  auditType: string;
  model: string;
  tokensUsed: number;
  timestamp: string;
  audit: any;
}

interface EngineRegistryEntry {
  name: string;
  category: string;
  subcategory: string;
  currentImpl: string;
  upgradeStatus: "completed" | "available" | "in_progress" | "not_required";
  upgradeTypes: string[];
  pythonMigrated: boolean;
  currentVersion: string;
  targetVersion?: string;
  upgradeNote: string;
  priority: "critical" | "high" | "medium" | "low";
}

interface RegistryResponse {
  success: boolean;
  summary: {
    total: number;
    completed: number;
    available: number;
    inProgress: number;
    notRequired: number;
    pythonMigrated: number;
    upgradeCompletionPct: number;
  };
  byCategory: Record<string, number>;
  engines: EngineRegistryEntry[];
  generatedAt: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  "Valuation Ratios": Calculator,
  "Portfolio Intelligence": PieChart,
  "Proposal Builder": Target,
  "Tax & Compliance": Scale,
  "Transaction Processing": Banknote,
  "Financial Planning": TrendingUp,
  "Return Metrics": BarChart3,
  "Valuation Models": Cpu,
  "Compliance": LucideShield,
  "AI Services": Brain,
  "Quant": Zap,
  "Financial": Calculator,
  "Portfolio": PieChart,
  "Classification": Layers,
  "Proposal": Target,
  "Python Sidecar": FlaskConical,
};

const UPGRADE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  python_migration: { label: "Python Migration", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  formula_fix: { label: "Formula Fix", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  algorithm_upgrade: { label: "Algorithm Upgrade", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  architecture: { label: "Architecture", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  regulatory: { label: "Regulatory", color: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-muted text-muted-foreground",
};

const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle,
    color: "text-green-500",
    badge: "bg-green-500/10 text-green-600 border-green-500/20",
    label: "Completed",
  },
  available: {
    icon: ArrowUpCircle,
    color: "text-blue-500",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    label: "Available for Upgrade",
  },
  in_progress: {
    icon: CircleDot,
    color: "text-yellow-500",
    badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    label: "In Progress",
  },
  not_required: {
    icon: MinusCircle,
    color: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
    label: "Not Required",
  },
};

export default function EngineHealthCheck() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [registryFilter, setRegistryFilter] = useState<"all" | "available" | "completed" | "not_required">("all");
  const [registryCategoryFilter, setRegistryCategoryFilter] = useState<string>("all");
  const [registrySearch, setRegistrySearch] = useState("");

  const { data: registryData, isLoading: registryLoading } = useQuery<RegistryResponse>({
    queryKey: ["/api/engine-health/registry"],
  });

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/engine-health/run");
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const runGeminiAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await apiRequest("/api/engine-health/gemini-deep-audit");
      const data = await res.json();
      setAuditData(data);
    } catch (err) {
      console.error("Gemini audit failed:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  const toggleExpanded = (engine: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(engine)) next.delete(engine);
      else next.add(engine);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
      case "HEALTHY":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "fail":
      case "CRITICAL":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "warn":
      case "DEGRADED":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
      case "HEALTHY":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "fail":
      case "CRITICAL":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warn":
      case "DEGRADED":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const filteredEngines = registryData?.engines.filter((e) => {
    if (registryFilter !== "all" && e.upgradeStatus !== registryFilter) return false;
    if (registryCategoryFilter !== "all" && e.category !== registryCategoryFilter) return false;
    if (registrySearch) {
      const q = registrySearch.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.subcategory.toLowerCase().includes(q) ||
        e.upgradeNote.toLowerCase().includes(q)
      );
    }
    return true;
  }) ?? [];

  const categories = registryData ? Object.keys(registryData.byCategory) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Engine Health & Upgrade Registry</h1>
          <p className="text-muted-foreground">
            Complete catalogue of all FintekPro calculation engines — health validation, upgrade tracking, and Python migration status
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runHealthCheck} disabled={loading} variant="default">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Cpu className="h-4 w-4 mr-2" />}
            {loading ? "Running..." : "Run Health Check"}
          </Button>
          <Button onClick={runGeminiAudit} disabled={auditLoading} variant="outline">
            {auditLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
            {auditLoading ? "Auditing..." : "Gemini Deep Audit"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="registry">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="registry">Upgrade Registry</TabsTrigger>
          <TabsTrigger value="health">Formula Health Check</TabsTrigger>
          {healthData && <TabsTrigger value="details">Engine Details</TabsTrigger>}
          {healthData && <TabsTrigger value="ai-verification">AI Verification</TabsTrigger>}
          {auditData && <TabsTrigger value="deep-audit">Deep Audit</TabsTrigger>}
        </TabsList>

        {/* ── Upgrade Registry Tab ─────────────────────────────────────── */}
        <TabsContent value="registry" className="space-y-4 mt-4">
          {registryLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : registryData ? (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <Card className="col-span-2 md:col-span-1">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{registryData.summary.total}</div>
                    <div className="text-xs text-muted-foreground mt-1">Total Engines</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-500">{registryData.summary.completed}</div>
                    <div className="text-xs text-muted-foreground mt-1">Upgraded</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-500">{registryData.summary.available}</div>
                    <div className="text-xs text-muted-foreground mt-1">Available</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-500">{registryData.summary.inProgress}</div>
                    <div className="text-xs text-muted-foreground mt-1">In Progress</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-muted-foreground">{registryData.summary.notRequired}</div>
                    <div className="text-xs text-muted-foreground mt-1">Not Required</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-500">{registryData.summary.pythonMigrated}</div>
                    <div className="text-xs text-muted-foreground mt-1">Python Live</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">{registryData.summary.upgradeCompletionPct}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Completion</div>
                    <Progress value={registryData.summary.upgradeCompletionPct} className="h-1 mt-2" />
                  </CardContent>
                </Card>
              </div>

              {/* Category quick-view */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(registryData.byCategory).map(([cat, count]) => {
                      const Icon = CATEGORY_ICONS[cat] || Activity;
                      return (
                        <button
                          key={cat}
                          onClick={() => setRegistryCategoryFilter(registryCategoryFilter === cat ? "all" : cat)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                            registryCategoryFilter === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {cat}
                          <span className="opacity-70">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search engines..."
                    value={registrySearch}
                    onChange={(e) => setRegistrySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["all", "available", "completed", "not_required"] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={registryFilter === f ? "default" : "outline"}
                      onClick={() => setRegistryFilter(f)}
                      className="text-xs"
                    >
                      {f === "all" ? "All" : f === "available" ? "Available" : f === "completed" ? "Completed" : "Not Required"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Engine cards */}
              <div className="text-sm text-muted-foreground mb-1">
                Showing {filteredEngines.length} of {registryData.summary.total} engines
              </div>
              <div className="space-y-2">
                {filteredEngines.map((engine) => {
                  const sc = STATUS_CONFIG[engine.upgradeStatus];
                  const StatusIcon = sc.icon;
                  const CatIcon = CATEGORY_ICONS[engine.category] || Activity;
                  return (
                    <Card key={engine.name} className="overflow-hidden border-l-4" style={{
                      borderLeftColor: engine.upgradeStatus === "completed" ? "#22c55e"
                        : engine.upgradeStatus === "available" ? "#3b82f6"
                        : engine.upgradeStatus === "in_progress" ? "#eab308"
                        : "#94a3b8"
                    }}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          {/* Left: Status icon */}
                          <StatusIcon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${sc.color}`} />

                          {/* Middle: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="font-semibold text-foreground text-sm">{engine.name}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <CatIcon className="h-3 w-3 mr-1 inline" />
                                {engine.subcategory}
                              </Badge>
                              {engine.pythonMigrated && (
                                <Badge className="text-xs px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20">
                                  Python Live
                                </Badge>
                              )}
                              <Badge className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[engine.priority]}`}>
                                {engine.priority.toUpperCase()}
                              </Badge>
                            </div>

                            <p className="text-xs text-muted-foreground mb-2">{engine.currentImpl}</p>

                            <p className="text-xs text-foreground/80 leading-relaxed">{engine.upgradeNote}</p>

                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {engine.upgradeTypes.map((t) => {
                                const ut = UPGRADE_TYPE_LABELS[t];
                                return ut ? (
                                  <Badge key={t} variant="outline" className={`text-xs px-1.5 py-0 ${ut.color}`}>
                                    {ut.label}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>

                          {/* Right: Status + versions */}
                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <Badge className={`text-xs ${sc.badge}`}>{sc.label}</Badge>
                            <span className="text-xs text-muted-foreground font-mono">{engine.currentVersion}</span>
                            {engine.targetVersion && (
                              <span className="text-xs text-blue-500 font-mono">→ {engine.targetVersion}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredEngines.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No engines match your filter criteria</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ── Health Check Tab ─────────────────────────────────────────── */}
        <TabsContent value="health" className="space-y-4 mt-4">
          {!healthData && !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Cpu className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Health Check Data</h3>
                <p className="text-muted-foreground mb-4">Click "Run Health Check" to validate all calculation engines</p>
                <Button onClick={runHealthCheck}>
                  <Activity className="h-4 w-4 mr-2" />
                  Start Validation
                </Button>
              </CardContent>
            </Card>
          )}

          {loading && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold">Running engine validations...</h3>
                      <p className="text-sm text-muted-foreground">Testing calculation engines with Gemini AI verification</p>
                    </div>
                  </div>
                  <Progress value={65} className="h-2" />
                </CardContent>
              </Card>
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}

          {healthData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-foreground">{healthData.summary.totalEngines}</div>
                    <div className="text-sm text-muted-foreground">Total Engines</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-500">{healthData.summary.passed}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-500">{healthData.summary.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Badge className={`text-lg px-3 py-1 ${getStatusColor(healthData.summary.overallStatus)}`}>
                      {healthData.summary.overallStatus}
                    </Badge>
                    <div className="text-sm text-muted-foreground mt-1">Overall Status</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Category Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {healthData.categoryBreakdown.map((cat) => {
                      const Icon = CATEGORY_ICONS[cat.category] || Activity;
                      const passRate = cat.total > 0 ? (cat.passed / cat.total) * 100 : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm text-foreground">{cat.category}</span>
                              <span className="text-xs text-muted-foreground">
                                {cat.passed}/{cat.total} passed · {cat.avgLatencyMs}ms avg
                              </span>
                            </div>
                            <Progress value={passRate} className="h-1.5" />
                          </div>
                          {cat.failed === 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Last checked: {new Date(healthData.summary.timestamp).toLocaleString()} ·
                Total latency: {healthData.summary.totalLatencyMs}ms
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Engine Details Tab ─────────────────────────────────────────── */}
        {healthData && (
          <TabsContent value="details" className="space-y-2 mt-4">
            {healthData.results.map((result) => (
              <Card key={result.engine} className="overflow-hidden">
                <button
                  onClick={() => toggleExpanded(result.engine)}
                  className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                >
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground">{result.engine}</div>
                    <div className="text-xs text-muted-foreground">{result.category}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">{result.latencyMs}ms</Badge>
                  <Badge className={getStatusColor(result.status)}>{result.status.toUpperCase()}</Badge>
                  {expandedResults.has(result.engine) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {expandedResults.has(result.engine) && result.sampleOutput && (
                  <div className="px-4 pb-4 border-t border-border">
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 mt-3 text-foreground">
                      {JSON.stringify(result.sampleOutput, null, 2)}
                    </pre>
                    {result.error && (
                      <div className="mt-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
                        Error: {result.error}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>
        )}

        {/* ── AI Verification Tab ───────────────────────────────────────── */}
        {healthData && (
          <TabsContent value="ai-verification" className="space-y-4 mt-4">
            {(() => {
              const aiResult = healthData.results.find((r) => r.engine === "Gemini AI Service");
              if (!aiResult) return <p className="text-muted-foreground">No AI verification data found</p>;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Gemini AI Calculation Verification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                      {getStatusIcon(aiResult.status)}
                      <span className="font-medium text-foreground">
                        {aiResult.status === "pass" ? "All calculations verified by Gemini" : "Verification issues found"}
                      </span>
                      <Badge variant="outline" className="ml-auto">{aiResult.latencyMs}ms</Badge>
                    </div>
                    {aiResult.sampleOutput && (
                      <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 text-foreground">
                        {JSON.stringify(aiResult.sampleOutput, null, 2)}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </TabsContent>
        )}

        {/* ── Gemini Deep Audit Tab ──────────────────────────────────────── */}
        {auditData && (
          <TabsContent value="deep-audit" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideShield className="h-5 w-5 text-primary" />
                  Gemini Deep Audit Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Badge variant="outline">Model: {auditData.model}</Badge>
                  <Badge variant="outline">Tokens: {auditData.tokensUsed}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(auditData.timestamp).toLocaleString()}
                  </span>
                </div>

                {auditData.audit?.overallAssessment && (
                  <div className="bg-muted/50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-foreground mb-1">Overall Assessment</h4>
                    <p className="text-sm text-muted-foreground">{auditData.audit.overallAssessment}</p>
                    {auditData.audit.riskLevel && (
                      <Badge className={`mt-2 ${getStatusColor(auditData.audit.riskLevel === "LOW" ? "pass" : auditData.audit.riskLevel === "HIGH" ? "fail" : "warn")}`}>
                        Risk: {auditData.audit.riskLevel}
                      </Badge>
                    )}
                  </div>
                )}

                {auditData.audit?.engines && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">Engine-Level Analysis</h4>
                    {auditData.audit.engines.map((eng: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm text-foreground">{eng.name}</span>
                          <Badge className={getStatusColor(eng.riskLevel === "LOW" ? "pass" : eng.riskLevel === "HIGH" ? "fail" : "warn")}>
                            {eng.riskLevel}
                          </Badge>
                        </div>
                        {eng.mathematicalRisks && (
                          <p className="text-xs text-muted-foreground mb-1"><strong>Math Risks:</strong> {eng.mathematicalRisks}</p>
                        )}
                        {eng.regulatoryNotes && (
                          <p className="text-xs text-muted-foreground mb-1"><strong>Regulatory:</strong> {eng.regulatoryNotes}</p>
                        )}
                        {eng.edgeCases?.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            <strong>Edge Cases:</strong>
                            <ul className="list-disc list-inside ml-2">
                              {eng.edgeCases.map((ec: string, j: number) => (
                                <li key={j}>{ec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {auditData.audit?.priorityActions?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-foreground mb-2">Priority Actions</h4>
                    <ul className="space-y-1">
                      {auditData.audit.priorityActions.map((action: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <AlertTriangle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditData.audit?.parseError && (
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 text-foreground">
                    {typeof auditData.audit.rawResponse === "string" ? auditData.audit.rawResponse : JSON.stringify(auditData.audit, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
