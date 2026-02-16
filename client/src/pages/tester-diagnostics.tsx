import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity, Server, Database, AlertTriangle, AlertCircle, CheckCircle,
  Download, Bug, Shield, Clock, ChevronDown, ChevronRight, RefreshCw,
  Cpu, HardDrive, Globe, FileText, Send, Loader2, XCircle, Info
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SEVERITY_BADGE_VARIANT: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
  critical: "destructive",
  error: "destructive",
  warning: "secondary",
  info: "outline",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white",
  error: "bg-orange-500 text-white",
  warning: "bg-yellow-500 text-black dark:text-black",
  info: "bg-blue-500 text-white",
};

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function HealthBadge({ status }: { status: string }) {
  if (status === "healthy") {
    return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
  }
  if (status === "available") {
    return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Available</Badge>;
  }
  return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Unhealthy</Badge>;
}

function SystemHealthTab() {
  const { data: diagnostics, isLoading: diagLoading } = useQuery({
    queryKey: ["/api/tester"],
    refetchInterval: 30000,
  });

  const { data: healthCheck, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/tester/health-check"],
    refetchInterval: 30000,
  });

  if (diagLoading || healthLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />Server Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{diagnostics?.uptime?.formatted || "N/A"}</p>
            <p className="text-xs text-muted-foreground">v{diagnostics?.serverVersion}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{diagnostics?.memory?.heapUsedMB || 0} MB</p>
            <p className="text-xs text-muted-foreground">
              of {diagnostics?.memory ? formatBytes(diagnostics.memory.heapTotal) : "N/A"} heap
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{diagnostics?.system?.cpuCount || 0} CPUs</p>
            <p className="text-xs text-muted-foreground">
              {diagnostics?.system?.freeMemoryMB || 0} MB free / {diagnostics?.system?.totalMemoryMB || 0} MB total
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">NODE_ENV</p>
              <Badge variant="outline">{diagnostics?.environment?.nodeEnv || "N/A"}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Platform</p>
              <p className="font-medium">{diagnostics?.system?.platform} / {diagnostics?.system?.arch}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Deployment URL</p>
              <p className="font-medium text-xs truncate">{diagnostics?.environment?.deploymentUrl || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">DB Connections</p>
              <p className="font-medium">{diagnostics?.dbPool?.activeConnections ?? "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Health Checks</CardTitle>
          <CardDescription>Auto-refreshes every 30 seconds</CardDescription>
        </CardHeader>
        <CardContent>
          {healthCheck?.checks ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(healthCheck.checks as Record<string, any>).map(([name, check]: [string, any]) => (
                <div key={name} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium capitalize">{name.replace(/([A-Z])/g, " $1").trim()}</p>
                    {check.latencyMs !== undefined && (
                      <p className="text-xs text-muted-foreground">{check.latencyMs}ms</p>
                    )}
                    {check.details && typeof check.details === "object" && (
                      <p className="text-xs text-muted-foreground">
                        {Object.entries(check.details).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </p>
                    )}
                    {check.details && typeof check.details === "string" && (
                      <p className="text-xs text-red-500 truncate max-w-[200px]">{check.details}</p>
                    )}
                  </div>
                  <HealthBadge status={check.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No health check data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorLogTab() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/tester/errors"],
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const allErrors: any[] = [];
  if (data?.byModule) {
    Object.values(data.byModule as Record<string, any>).forEach((group: any) => {
      allErrors.push(...group.errors);
    });
  }
  allErrors.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = severityFilter === "all"
    ? allErrors
    : allErrors.filter((e) => e.severity === severityFilter);

  const severityCounts: Record<string, number> = {};
  allErrors.forEach((e) => {
    severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{data?.totalFetched || 0} errors</Badge>
          {Object.entries(severityCounts).map(([sev, cnt]) => (
            <Badge key={sev} className={SEVERITY_COLORS[sev] || ""}>{sev}: {cnt}</Badge>
          ))}
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data?.moduleSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Module Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(data.moduleSummary as any[]).map((m: any) => (
                <Badge key={m.module} variant="outline">{m.module}: {m.errorCount}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No errors found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((error: any) => (
                  <>
                    <TableRow
                      key={error.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === error.id ? null : error.id)}
                    >
                      <TableCell>
                        {expandedId === error.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {error.createdAt ? format(new Date(error.createdAt), "yyyy-MM-dd HH:mm:ss") : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SEVERITY_BADGE_VARIANT[error.severity] || "outline"}>
                          {error.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{error.module || "unknown"}</TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">{error.message}</TableCell>
                      <TableCell className="text-xs font-mono">{error.errorCode}</TableCell>
                    </TableRow>
                    {expandedId === error.id && (
                      <TableRow key={`${error.id}-stack`}>
                        <TableCell colSpan={6} className="bg-muted/30 p-4">
                          <p className="text-xs font-medium mb-1">Stack Trace</p>
                          <pre className="text-xs whitespace-pre-wrap font-mono bg-background p-3 rounded border max-h-[200px] overflow-auto">
                            {error.stackTrace || "No stack trace available"}
                          </pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ExportDataTab() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const { data } = useQuery({
    queryKey: ["/api/tester/errors"],
  });

  const allErrors: any[] = [];
  if (data?.byModule) {
    Object.values(data.byModule as Record<string, any>).forEach((group: any) => {
      allErrors.push(...group.errors);
    });
  }

  const severityCounts: Record<string, number> = {};
  const moduleCounts: Record<string, number> = {};
  let minDate = "", maxDate = "";
  allErrors.forEach((e) => {
    severityCounts[e.severity] = (severityCounts[e.severity] || 0) + 1;
    moduleCounts[e.module || "unknown"] = (moduleCounts[e.module || "unknown"] || 0) + 1;
    const d = e.createdAt || "";
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  });

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/tester/errors/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `errors_export_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: "Error data exported successfully." });
    } catch {
      toast({ title: "Export failed", description: "Could not download error data.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Export Summary</CardTitle>
          <CardDescription>Overview of current error data available for export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Errors</p>
              <p className="text-2xl font-bold">{allErrors.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Range</p>
              <p className="text-sm font-medium">
                {minDate ? format(new Date(minDate), "yyyy-MM-dd") : "N/A"} — {maxDate ? format(new Date(maxDate), "yyyy-MM-dd") : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Environment</p>
              <Badge variant="outline">{typeof window !== "undefined" ? "browser" : "server"}</Badge>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">By Severity</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(severityCounts).map(([sev, cnt]) => (
                <Badge key={sev} className={SEVERITY_COLORS[sev] || ""}>{sev}: {cnt}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">By Module</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(moduleCounts).map(([mod, cnt]) => (
                <Badge key={mod} variant="outline">{mod}: {cnt}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-8 flex flex-col items-center gap-4">
          <Download className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Download Full Error Export</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Downloads all errors as a JSON file including metadata, timestamps, stack traces, and environment info.
          </p>
          <Button size="lg" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {isExporting ? "Exporting..." : "Download JSON Export"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportBugTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [module, setModule] = useState("");
  const [environment, setEnvironment] = useState("dev");

  const browserInfo = typeof navigator !== "undefined"
    ? `${navigator.userAgent.substring(0, 120)}`
    : "Unknown";

  const reportMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/tester/report", { method: "POST", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } });
    },
    onSuccess: () => {
      toast({ title: "Bug report submitted", description: "Your report has been logged successfully." });
      setTitle("");
      setDescription("");
      setStepsToReproduce("");
      setSeverity("medium");
      setModule("");
      setEnvironment("dev");
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Could not submit bug report.", variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast({ title: "Validation Error", description: "Title and description are required.", variant: "destructive" });
      return;
    }
    reportMutation.mutate({
      title,
      description,
      stepsToReproduce,
      severity,
      module: module || "general",
      environment: environment === "prod" ? "production" : "development",
      browserInfo,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bug className="h-5 w-5" />Submit Bug Report</CardTitle>
        <CardDescription>Report issues for the development team to investigate</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief summary of the issue" />
          </div>

          <div>
            <label className="text-sm font-medium">Description *</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description of the bug" rows={4} />
          </div>

          <div>
            <label className="text-sm font-medium">Steps to Reproduce</label>
            <Textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} placeholder="1. Go to ...&#10;2. Click on ...&#10;3. Observe ..." rows={4} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Severity</label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Module</label>
              <Input value={module} onChange={(e) => setModule(e.target.value)} placeholder="e.g., auth, portfolio" />
            </div>
            <div>
              <label className="text-sm font-medium">Environment</label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Browser Info (auto-detected)</label>
            <Input value={browserInfo} readOnly className="bg-muted text-xs" />
          </div>

          <Button type="submit" disabled={reportMutation.isPending} className="w-full md:w-auto">
            {reportMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {reportMutation.isPending ? "Submitting..." : "Submit Bug Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function TesterDiagnostics() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user"],
  });

  const { data: diagnostics, error: diagError } = useQuery({
    queryKey: ["/api/tester"],
    retry: false,
    enabled: !!user,
  });

  if (userLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please sign in with a tester account to access diagnostics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (diagError && (diagError as any)?.status === 403) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-xl font-semibold mb-2">Tester Access Required</h2>
            <p className="text-muted-foreground">Your account does not have the tester role. Contact an administrator for access.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Tester Diagnostics
          </h1>
          <p className="text-muted-foreground">System diagnostics, error tracking, and bug reporting</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/tester"] });
            queryClient.invalidateQueries({ queryKey: ["/api/tester/health-check"] });
            queryClient.invalidateQueries({ queryKey: ["/api/tester/errors"] });
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />Refresh All
        </Button>
      </div>

      <Tabs defaultValue="health">
        <ScrollableTabsList>
          <TabsTrigger value="health" className="flex items-center gap-1">
            <Server className="h-4 w-4" />System Health
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />Error Log
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-1">
            <Download className="h-4 w-4" />Export Data
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-1">
            <Bug className="h-4 w-4" />Report Bug
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="health"><SystemHealthTab /></TabsContent>
        <TabsContent value="errors"><ErrorLogTab /></TabsContent>
        <TabsContent value="export"><ExportDataTab /></TabsContent>
        <TabsContent value="report"><ReportBugTab /></TabsContent>
      </Tabs>
    </div>
  );
}
