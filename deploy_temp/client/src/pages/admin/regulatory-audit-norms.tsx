import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, BookOpen, FileText, Scale,
  Building2, Banknote, Server, Zap, Info,
  ChevronRight, AlertCircle
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────

type Regulator = "SEBI" | "AMFI" | "PMLA" | "RBI" | "SYSTEM";
type NormSeverity = "critical" | "high" | "medium" | "low";
type CheckStatus = "pass" | "fail" | "warn" | "skip";

interface RegulatoryNorm {
  id: string;
  title: string;
  description: string;
  regulator: Regulator;
  regulation: string;
  severity: NormSeverity;
  retentionYears?: number;
  remediation: string;
  autoCheckable: boolean;
}

interface NormCheckResult {
  normId: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  count?: number;
  checkedAt: string;
}

interface ActionItem {
  normId: string;
  priority: "immediate" | "high" | "medium" | "low";
  title: string;
  description: string;
  regulator: Regulator;
  dueDate?: string;
}

interface RetentionSummary {
  category: string;
  retentionYears: number;
  regulation: string;
  status: "compliant" | "at_risk" | "unknown";
  oldestRecordAge?: number;
}

interface AuditReadinessReport {
  generatedAt: string;
  overallScore: number;
  totalNorms: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  criticalFailures: number;
  norms: RegulatoryNorm[];
  results: NormCheckResult[];
  actionItems: ActionItem[];
  retentionSummary: RetentionSummary[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const REGULATOR_COLORS: Record<Regulator, string> = {
  SEBI: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  AMFI: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PMLA: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  RBI: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SYSTEM: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const REGULATOR_ICONS: Record<Regulator, JSX.Element> = {
  SEBI: <Scale className="h-3.5 w-3.5" />,
  AMFI: <Banknote className="h-3.5 w-3.5" />,
  PMLA: <Shield className="h-3.5 w-3.5" />,
  RBI: <Building2 className="h-3.5 w-3.5" />,
  SYSTEM: <Server className="h-3.5 w-3.5" />,
};

const SEVERITY_COLORS: Record<NormSeverity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_CONFIG: Record<CheckStatus, { icon: JSX.Element; label: string; color: string }> = {
  pass: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, label: "Pass", color: "text-green-600 dark:text-green-400" },
  fail: { icon: <XCircle className="h-4 w-4 text-red-500" />, label: "Fail", color: "text-red-600 dark:text-red-400" },
  warn: { icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, label: "Warning", color: "text-yellow-600 dark:text-yellow-400" },
  skip: { icon: <Clock className="h-4 w-4 text-gray-400" />, label: "Manual", color: "text-gray-500 dark:text-gray-400" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  immediate: { label: "Immediate", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", border: "border-l-red-500" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", border: "border-l-orange-500" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", border: "border-l-yellow-500" },
  low: { label: "Low", color: "bg-gray-100 text-gray-700", border: "border-l-gray-400" },
};

function scoreToLabel(score: number): { label: string; color: string; icon: JSX.Element } {
  if (score >= 90) return { label: "Audit Ready", color: "text-green-600 dark:text-green-400", icon: <ShieldCheck className="h-8 w-8 text-green-500" /> };
  if (score >= 70) return { label: "Mostly Compliant", color: "text-yellow-600 dark:text-yellow-400", icon: <ShieldAlert className="h-8 w-8 text-yellow-500" /> };
  if (score >= 50) return { label: "Needs Attention", color: "text-orange-600 dark:text-orange-400", icon: <AlertTriangle className="h-8 w-8 text-orange-500" /> };
  return { label: "Non-Compliant", color: "text-red-600 dark:text-red-400", icon: <ShieldX className="h-8 w-8 text-red-500" /> };
}

function scoreBarColor(score: number) {
  if (score >= 90) return "bg-green-500";
  if (score >= 70) return "bg-yellow-500";
  if (score >= 50) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Component ────────────────────────────────────────────────────────────

export default function RegulatoryAuditNorms() {
  const [runningCheck, setRunningCheck] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: reportData, isLoading, isFetching, refetch } = useQuery<{ success: boolean; data: AuditReadinessReport }>({
    queryKey: ["/api/admin/regulatory-audit/readiness"],
    staleTime: 4 * 60 * 1000,
  });

  const forceRefetch = useMutation({
    mutationFn: () => apiRequest("/api/admin/regulatory-audit/readiness?force=1"),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/regulatory-audit/readiness"], data);
    },
  });

  const singleCheck = useMutation({
    mutationFn: (normId: string) => apiRequest(`/api/admin/regulatory-audit/check/${normId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/regulatory-audit/readiness"] });
    },
  });

  const report = reportData?.data;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const score = report?.overallScore ?? 0;
  const scoreInfo = scoreToLabel(score);

  // Group norms by regulator
  const normsByRegulator: Record<string, RegulatoryNorm[]> = {};
  for (const norm of report?.norms ?? []) {
    if (!normsByRegulator[norm.regulator]) normsByRegulator[norm.regulator] = [];
    normsByRegulator[norm.regulator].push(norm);
  }

  const resultMap: Record<string, NormCheckResult> = {};
  for (const r of report?.results ?? []) resultMap[r.normId] = r;

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Regulatory Audit Norms
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              SEBI · AMFI · PMLA · RBI compliance status and audit readiness
              {report && (
                <span className="ml-2 text-xs">
                  — last checked {format(new Date(report.generatedAt), "dd MMM yyyy, hh:mm a")}
                </span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => forceRefetch.mutate()}
            disabled={forceRefetch.isPending || isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${(forceRefetch.isPending || isFetching) ? "animate-spin" : ""}`} />
            Refresh Checks
          </Button>
        </div>

        {/* Critical Failure Banner */}
        {(report?.criticalFailures ?? 0) > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">
                {report!.criticalFailures} Critical Regulatory Failure{report!.criticalFailures > 1 ? "s" : ""} Detected
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                These must be resolved immediately to avoid regulatory penalties. Review the Action Items tab.
              </p>
            </div>
          </div>
        )}

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Readiness Score */}
          <Card className="md:col-span-2 border-2">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                {scoreInfo.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Audit Readiness</p>
                  <p className={`text-3xl font-bold mt-0.5 ${scoreInfo.color}`}>{score}%</p>
                  <p className={`text-sm font-medium ${scoreInfo.color}`}>{scoreInfo.label}</p>
                  <Progress value={score} className={`mt-2 h-2 ${scoreBarColor(score)}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Passed</p>
              <p className="text-2xl font-bold text-green-600">{report?.passed ?? "—"}</p>
              <p className="text-xs text-gray-400">/ {report?.totalNorms ?? "—"} norms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Failed</p>
              <p className="text-2xl font-bold text-red-600">{report?.failed ?? "—"}</p>
              <p className="text-xs text-gray-400">{report?.criticalFailures ?? 0} critical</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Warnings</p>
              <p className="text-2xl font-bold text-yellow-600">{report?.warned ?? "—"}</p>
              <p className="text-xs text-gray-400">{report?.skipped ?? 0} manual review</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="norms">All Norms</TabsTrigger>
            <TabsTrigger value="actions" className="relative">
              Action Items
              {(report?.actionItems?.length ?? 0) > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold h-4 px-1 min-w-[16px]">
                  {report!.actionItems.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="retention">Retention</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ────────────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {Object.entries(normsByRegulator).map(([regulator, norms]) => {
              const reg = regulator as Regulator;
              const regulatorResults = norms.map(n => resultMap[n.id]).filter(Boolean);
              const passed = regulatorResults.filter(r => r.status === "pass").length;
              const failed = regulatorResults.filter(r => r.status === "fail").length;
              const warned = regulatorResults.filter(r => r.status === "warn").length;

              return (
                <Card key={regulator}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={`${REGULATOR_COLORS[reg]} gap-1 font-medium`}>
                          {REGULATOR_ICONS[reg]} {regulator}
                        </Badge>
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {norms.length} norm{norms.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600 font-medium">{passed} pass</span>
                        {failed > 0 && <span className="text-red-600 font-medium">{failed} fail</span>}
                        {warned > 0 && <span className="text-yellow-600 font-medium">{warned} warn</span>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {norms.map(norm => {
                      const result = resultMap[norm.id];
                      const statusConfig = result ? STATUS_CONFIG[result.status] : STATUS_CONFIG.skip;
                      return (
                        <div key={norm.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-900/60 transition-colors">
                          <div className="mt-0.5 flex-shrink-0">{statusConfig.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{norm.title}</span>
                              <Badge variant="outline" className="text-[10px] font-mono py-0">{norm.id}</Badge>
                              <Badge className={`${SEVERITY_COLORS[norm.severity]} text-[10px] py-0`}>{norm.severity}</Badge>
                              {!norm.autoCheckable && (
                                <Tooltip>
                                  <TooltipTrigger><Badge variant="outline" className="text-[10px] py-0 gap-1"><Info className="h-2.5 w-2.5" />Manual</Badge></TooltipTrigger>
                                  <TooltipContent><p className="text-xs max-w-xs">This norm requires manual verification — no automated check is possible.</p></TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className={`text-xs mt-1 ${statusConfig.color}`}>{result?.message ?? "Not yet checked"}</p>
                            {result?.detail && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{result.detail}</p>
                            )}
                          </div>
                          {norm.autoCheckable && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-shrink-0 h-7 text-xs"
                              disabled={runningCheck === norm.id || singleCheck.isPending}
                              onClick={async () => {
                                setRunningCheck(norm.id);
                                try { await singleCheck.mutateAsync(norm.id); } finally { setRunningCheck(null); }
                              }}
                            >
                              <RefreshCw className={`h-3 w-3 mr-1 ${runningCheck === norm.id ? "animate-spin" : ""}`} />
                              Re-check
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── ALL NORMS TAB ────────────────────────────────────── */}
          <TabsContent value="norms" className="mt-4 space-y-3">
            {report?.norms.map(norm => {
              const result = resultMap[norm.id];
              const statusConfig = result ? STATUS_CONFIG[result.status] : STATUS_CONFIG.skip;
              return (
                <Card key={norm.id} className={`border-l-4 ${result?.status === "fail" ? "border-l-red-500" : result?.status === "warn" ? "border-l-yellow-500" : result?.status === "pass" ? "border-l-green-500" : "border-l-gray-300"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${REGULATOR_COLORS[norm.regulator]} gap-1 text-xs`}>
                            {REGULATOR_ICONS[norm.regulator]} {norm.regulator}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-xs">{norm.id}</Badge>
                          <Badge className={`${SEVERITY_COLORS[norm.severity]} text-xs`}>{norm.severity}</Badge>
                        </div>
                        <CardTitle className="text-base mt-2">{norm.title}</CardTitle>
                        <CardDescription className="text-xs mt-0.5 italic">{norm.regulation}</CardDescription>
                      </div>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          {statusConfig.icon}
                          <span className={`text-sm font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                        </div>
                        {result?.checkedAt && (
                          <span className="text-[10px] text-gray-400">
                            {format(new Date(result.checkedAt), "HH:mm:ss")}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">{norm.description}</p>

                    {result && result.status !== "skip" && (
                      <div className={`p-2.5 rounded text-sm ${result.status === "fail" ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" : result.status === "warn" ? "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300" : "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"}`}>
                        <p className="font-medium">{result.message}</p>
                        {result.detail && <p className="text-xs mt-1 opacity-80">{result.detail}</p>}
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-start gap-2">
                      <BookOpen className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Remediation</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{norm.remediation}</p>
                      </div>
                    </div>

                    {norm.retentionYears && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" />
                        Minimum retention: <strong>{norm.retentionYears} years</strong>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ── ACTION ITEMS TAB ─────────────────────────────────── */}
          <TabsContent value="actions" className="mt-4 space-y-3">
            {(report?.actionItems?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-gray-700 dark:text-gray-300">No action items</p>
                  <p className="text-sm text-gray-500 mt-1">All automated checks are passing. Review manual norms separately.</p>
                </CardContent>
              </Card>
            ) : (
              report!.actionItems.map(item => {
                const pc = PRIORITY_CONFIG[item.priority];
                return (
                  <div key={item.normId} className={`border-l-4 ${pc.border} bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge className={`${pc.color} text-xs`}>{pc.label}</Badge>
                          <Badge className={`${REGULATOR_COLORS[item.regulator]} gap-1 text-xs`}>
                            {REGULATOR_ICONS[item.regulator]} {item.regulator}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-[10px]">{item.normId}</Badge>
                        </div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{item.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ── RETENTION TAB ────────────────────────────────────── */}
          <TabsContent value="retention" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Record Retention Policy
                </CardTitle>
                <CardDescription>
                  Regulatory mandated retention periods. FintekPro must not delete or archive records before these dates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {report?.retentionSummary.map(r => (
                  <div key={r.category} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.category}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-0.5">{r.regulation}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{r.retentionYears} years</p>
                        <p className="text-[10px] text-gray-400">minimum</p>
                      </div>
                      <Badge className={
                        r.status === "compliant" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                        r.status === "at_risk" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" :
                        "bg-gray-100 text-gray-700"
                      }>
                        {r.status === "compliant" ? "Compliant" : r.status === "at_risk" ? "At Risk" : "Unknown"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Data Archival Policy Reminder</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      The data retention cleanup scheduler (production-only) must never purge records within the mandatory retention window.
                      Verify the archival configuration sets cutoff dates beyond the longest applicable retention period (10 years for PMLA records).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>
    </TooltipProvider>
  );
}
