import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Shield,
  Calculator,
  TrendingUp,
  PieChart,
  Target,
  Banknote,
  Scale,
  BarChart3,
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

const CATEGORY_ICONS: Record<string, any> = {
  "Valuation Ratios": Calculator,
  "Portfolio Intelligence": PieChart,
  "Proposal Builder": Target,
  "Tax & Compliance": Scale,
  "Transaction Processing": Banknote,
  "Financial Planning": TrendingUp,
  "Return Metrics": BarChart3,
  "Valuation Models": Cpu,
  "Compliance": Shield,
  "AI Services": Brain,
};

export default function EngineHealthCheck() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calculation Engine Health Check</h1>
          <p className="text-muted-foreground">Gemini-verified validation of all financial calculation engines</p>
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
                  <p className="text-sm text-muted-foreground">Testing 20 calculation engines with Gemini AI verification</p>
                </div>
              </div>
              <Progress value={65} className="h-2" />
            </CardContent>
          </Card>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {healthData && (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Engine Details</TabsTrigger>
            <TabsTrigger value="ai-verification">AI Verification</TabsTrigger>
            {auditData && <TabsTrigger value="deep-audit">Deep Audit</TabsTrigger>}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="details" className="space-y-2">
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
                  <Badge variant="outline" className="text-xs">
                    {result.latencyMs}ms
                  </Badge>
                  <Badge className={getStatusColor(result.status)}>
                    {result.status.toUpperCase()}
                  </Badge>
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

          <TabsContent value="ai-verification" className="space-y-4">
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

          {auditData && (
            <TabsContent value="deep-audit" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
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
      )}
    </div>
  );
}
