import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronRight, Search, Loader2, Database, FileText,
  ArrowRight, Activity, BarChart3, GitBranch, BookOpen, Layers
} from "lucide-react";

type ComplianceStatus =
  | "PENDING" | "VALIDATED" | "BLOCKED" | "OVERLAP_BREACH"
  | "GLIDE_PATH_INVALID" | "REQUIRES_REVIEW" | "APPROVED";

type NamingStatus = "PENDING" | "PASSED" | "FAILED";

function StatusBadge({ status }: { status: ComplianceStatus | string }) {
  const map: Record<string, string> = {
    VALIDATED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    OVERLAP_BREACH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    GLIDE_PATH_INVALID: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    REQUIRES_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <Badge className={`text-xs font-medium ${map[status] || map.PENDING}`}>
      {status?.replace(/_/g, " ")}
    </Badge>
  );
}

function NamingBadge({ status }: { status: NamingStatus | string }) {
  const map: Record<string, string> = {
    PASSED: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    PENDING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return <Badge className={`text-xs ${map[status] || map.PENDING}`}>{status}</Badge>;
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</div>
        <div className="text-sm font-medium text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ── Tab 1: Overview ──────────────────────────────────────────────────────────
function OverviewTab() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/sebi/compliance-dashboard"],
  });

  if (isLoading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;

  const s = data?.summary || {};
  const statusMap: Record<string, number> = {};
  (s.statusBreakdown || []).forEach((r: any) => { statusMap[r.compliance_status] = parseInt(r.count); });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">SEBI 2026 Compliance Overview</h2>
          <p className="text-sm text-muted-foreground">Circular: SEBI/HO/IMD/CIR/P/2026/26 — effective Feb 26, 2026</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending Review" value={s.pendingReview ?? 0} color="text-gray-600 dark:text-gray-300" />
        <StatCard label="Validated" value={statusMap["VALIDATED"] ?? 0} color="text-green-600" />
        <StatCard label="Approved" value={statusMap["APPROVED"] ?? 0} color="text-blue-600" />
        <StatCard label="Requires Review" value={statusMap["REQUIRES_REVIEW"] ?? 0} color="text-yellow-600" />
        <StatCard label="Blocked" value={statusMap["BLOCKED"] ?? 0} color="text-red-600" />
        <StatCard label="Overlap Breaches" value={statusMap["OVERLAP_BREACH"] ?? 0} sub={`${s.overlapBreachPairs ?? 0} breach pairs`} color="text-orange-600" />
        <StatCard label="Glide Path Invalid" value={s.glidePathInvalid ?? 0} color="text-orange-600" />
        <StatCard label="Lifecycle Funds" value={s.lifecycleFunds ?? 0} sub="with lifecycleMetadata" />
        <StatCard label="Naming Failures" value={s.namingFailures ?? 0} color={s.namingFailures > 0 ? "text-red-600" : "text-foreground"} />
        <StatCard label="Overlap Pairs Computed" value={s.overlapPairsComputed ?? 0} />
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Recent State Changes</h3>
        {(data?.recentStateChanges || []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No state changes recorded yet.</p>
        ) : (
          <ScrollArea className="h-[320px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.recentStateChanges || []).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      <div className="font-medium">{log.scheme_name || log.scheme_code}</div>
                      <div className="text-muted-foreground">{log.scheme_code}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <StatusBadge status={log.from_status || "PENDING"} />
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <StatusBadge status={log.to_status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.triggered_by}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate" title={log.reason}>{log.reason || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.triggered_at ? new Date(log.triggered_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Taxonomy Browser ──────────────────────────────────────────────────
function TaxonomyTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/sebi/taxonomy"] });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/taxonomy/seed", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/taxonomy"] });
      toast({ title: "Taxonomy re-seeded", description: "SEBI 2026 taxonomy seeded successfully." });
    },
    onError: (e: any) => toast({ title: "Seed failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const versions: any[] = data?.versions || [];
  const categories: any[] = data?.categories || [];
  const subcategories: any[] = data?.subcategories || [];

  const toggle = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">SEBI Taxonomy — Version Registry</h2>
        <Button size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
          {seedMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
          Re-seed Taxonomy
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {versions.map((v: any) => (
          <Card key={v.version} className={`border-l-4 ${v.version === "SEBI_2026" ? "border-l-blue-500" : "border-l-gray-400"}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{v.version}</CardTitle>
                <Badge variant={v.is_active ? "default" : "secondary"}>{v.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              <CardDescription className="text-xs">{v.sebi_circular_ref}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div className="text-muted-foreground">Effective: {v.effective_date}</div>
              <div className="flex gap-4">
                <span><strong>{v.category_count}</strong> categories</span>
                <span><strong>{v.subcategory_count}</strong> subcategories</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{v.description}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">SEBI 2026 Category Groups</h3>
        {["EQUITY", "DEBT", "HYBRID", "LIFECYCLE", "OTHER"].map(group => {
          const groupCat = categories.find((c: any) => c.group_code === group && c.taxonomy_version === "SEBI_2026");
          const subs = subcategories.filter((s: any) => s.group_code === group && s.taxonomy_version === "SEBI_2026");
          const isOpen = expanded[group];
          return (
            <div key={group} className="border rounded-lg mb-2 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggle(group)}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>{groupCat?.group_name || group}</span>
                  <Badge variant="outline" className="text-xs">{subs.length} subcategories</Badge>
                  {group === "LIFECYCLE" && (
                    <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">New in 2026</Badge>
                  )}
                </div>
              </button>
              {isOpen && subs.length > 0 && (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subcategory</TableHead>
                        <TableHead className="text-center">Equity %</TableHead>
                        <TableHead className="text-center">Debt %</TableHead>
                        <TableHead className="text-center">Max Stocks</TableHead>
                        <TableHead className="text-center">Lock-in Days</TableHead>
                        <TableHead className="text-center">Overlap Threshold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subs.map((s: any) => (
                        <TableRow key={s.subcategory_code}>
                          <TableCell>
                            <div className="font-medium text-sm">{s.subcategory_name}</div>
                            <div className="text-xs text-muted-foreground">{s.subcategory_code}</div>
                            {s.notes && <div className="text-xs text-muted-foreground mt-0.5 max-w-[300px] line-clamp-2">{s.notes}</div>}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {s.min_equity_pct != null ? `${s.min_equity_pct}${s.max_equity_pct ? `–${s.max_equity_pct}` : "+"}%` : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {s.min_debt_pct != null ? `${s.min_debt_pct}${s.max_debt_pct ? `–${s.max_debt_pct}` : "+"}%` : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">{s.max_stocks ?? "—"}</TableCell>
                          <TableCell className="text-center text-sm">{s.lock_in_days ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`text-xs ${parseFloat(s.overlap_threshold_pct) <= 50 ? "border-orange-400 text-orange-700 dark:text-orange-300" : ""}`}
                            >
                              {s.overlap_threshold_pct}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab 3: Overlap Breaches ──────────────────────────────────────────────────
function OverlapTab() {
  const { data, isLoading, refetch } = useQuery<any>({ queryKey: ["/api/admin/sebi/overlap-breaches"] });
  const { toast } = useToast();

  const recomputeMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/overlap/recompute", { method: "POST" }),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/overlap-breaches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance-dashboard"] });
      toast({
        title: "Overlap recomputed",
        description: `${d.pairsComputed ?? 0} pairs computed, ${d.breachesFound ?? 0} breaches found across ${d.schemesCovered ?? 0} schemes.`,
      });
    },
    onError: (e: any) => toast({ title: "Recompute failed", description: e.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/holdings/import", { method: "POST" }),
    onSuccess: (d: any) => toast({ title: "Holdings imported", description: `${d.imported ?? 0} holdings across ${d.schemes ?? 0} schemes.` }),
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  const breaches: any[] = data?.breaches || [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">SEBI Scheme-to-Scheme Overlap Breaches</h2>
          <p className="text-sm text-muted-foreground">
            Thematic/Sectoral threshold: 50% &nbsp;|&nbsp; All others: 60%
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
            Import Holdings
          </Button>
          <Button size="sm" onClick={() => recomputeMutation.mutate()} disabled={recomputeMutation.isPending}>
            {recomputeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Recompute All Overlaps
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : breaches.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium text-foreground">No overlap breaches detected</p>
            <p className="text-sm mt-1">Run "Import Holdings" then "Recompute All Overlaps" to generate the matrix.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheme A</TableHead>
                <TableHead>Scheme B</TableHead>
                <TableHead className="text-center">Overlap %</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead>Category A</TableHead>
                <TableHead>Category B</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breaches.map((b: any, i: number) => {
                const isThematic = (b.categoryA || "").toLowerCase().includes("thematic") ||
                  (b.categoryA || "").toLowerCase().includes("sectoral") ||
                  (b.categoryB || "").toLowerCase().includes("thematic") ||
                  (b.categoryB || "").toLowerCase().includes("sectoral");
                const threshold = isThematic ? 50 : 60;
                return (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="font-medium text-sm">{b.schemeNameA || b.schemeCodeA}</div>
                      <div className="text-xs text-muted-foreground">{b.schemeCodeA}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{b.schemeNameB || b.schemeCodeB}</div>
                      <div className="text-xs text-muted-foreground">{b.schemeCodeB}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-orange-600 dark:text-orange-400">
                        {parseFloat(b.overlapPercent).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={isThematic ? "border-orange-400 text-orange-700" : ""}>
                        {threshold}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{b.categoryA || "—"}</TableCell>
                    <TableCell className="text-xs">{b.categoryB || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </div>
  );
}

// ── Tab 4: Scheme Lookup ─────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["VALIDATED", "REQUIRES_REVIEW", "BLOCKED", "OVERLAP_BREACH", "GLIDE_PATH_INVALID"],
  REQUIRES_REVIEW: ["VALIDATED", "BLOCKED", "APPROVED"],
  VALIDATED: ["OVERLAP_BREACH", "GLIDE_PATH_INVALID", "BLOCKED", "APPROVED"],
  APPROVED: ["OVERLAP_BREACH", "GLIDE_PATH_INVALID", "BLOCKED"],
  BLOCKED: ["REQUIRES_REVIEW"],
  OVERLAP_BREACH: ["REQUIRES_REVIEW"],
  GLIDE_PATH_INVALID: ["REQUIRES_REVIEW"],
};

function SchemeLookupTab() {
  const [search, setSearch] = useState("");
  const [queried, setQueried] = useState("");
  const [toStatus, setToStatus] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const { data, isLoading, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/sebi/compliance", queried],
    enabled: !!queried,
  });

  const transitionMutation = useMutation({
    mutationFn: () => apiRequest(`/api/admin/sebi/compliance/${queried}/transition`, {
      method: "POST",
      body: JSON.stringify({ toStatus, reason }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance", queried] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance-dashboard"] });
      toast({ title: "Transition applied", description: `${queried} → ${toStatus}` });
      setToStatus("");
      setReason("");
    },
    onError: (e: any) => toast({ title: "Transition failed", description: e.message, variant: "destructive" }),
  });

  const fund = data?.fund;
  const currentStatus: string = fund?.compliance_status || "PENDING";
  const availableTransitions = VALID_TRANSITIONS[currentStatus] || [];

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Input
          placeholder="Enter scheme code (e.g. 100033)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && setQueried(search.trim())}
          className="max-w-xs"
        />
        <Button onClick={() => setQueried(search.trim())} disabled={!search.trim() || isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {isLoading && <Skeleton className="h-48 w-full" />}

      {data && !fund && (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Scheme not found.</CardContent></Card>
      )}

      {fund && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{fund.scheme_name}</CardTitle>
              <CardDescription>{fund.scheme_code}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Compliance Status</div>
                  <StatusBadge status={fund.compliance_status || "PENDING"} />
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Naming Status</div>
                  <NamingBadge status={fund.naming_validation_status || "PENDING"} />
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Taxonomy Version</div>
                  <span className="font-medium">{fund.taxonomy_version || "SEBI_2017"}</span>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Category</div>
                  <span className="font-medium">{fund.category || "—"}</span>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs mb-1">Published</div>
                  <span>{fund.is_published ? "Yes" : "No"}</span>
                </div>
              </div>
              {fund.compliance_blocked_reason && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3 text-sm text-red-700 dark:text-red-300">
                  <div className="font-medium mb-1">Blocked Reason</div>
                  {fund.compliance_blocked_reason}
                </div>
              )}
              {fund.lifecycle_metadata && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm">
                  <div className="font-medium text-blue-700 dark:text-blue-300 mb-1">Lifecycle Metadata</div>
                  <pre className="text-xs overflow-auto whitespace-pre-wrap">{JSON.stringify(fund.lifecycle_metadata, null, 2)}</pre>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Manual State Transition</CardTitle>
                <CardDescription className="text-xs">Admin-only. Transitions from BLOCKED/OVERLAP_BREACH/GLIDE_PATH_INVALID require justification.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={toStatus} onValueChange={setToStatus}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select target state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTransitions.map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Reason (required)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => transitionMutation.mutate()}
                  disabled={!toStatus || !reason.trim() || transitionMutation.isPending}
                  className="w-full"
                >
                  {transitionMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
                  Apply Transition
                </Button>
              </CardContent>
            </Card>

            {(data?.stateLog || []).length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">State History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.stateLog.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <StatusBadge status={log.from_status || "PENDING"} />
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <StatusBadge status={log.to_status} />
                          </div>
                          <div className="text-muted-foreground mt-0.5">{log.triggered_by} — {log.reason}</div>
                        </div>
                        <div className="text-muted-foreground whitespace-nowrap">
                          {log.triggered_at ? new Date(log.triggered_at).toLocaleDateString("en-IN") : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {(data?.overlapEntries || []).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Overlap Matrix Entries for this Scheme</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Counterpart Scheme</TableHead>
                  <TableHead className="text-center">Overlap %</TableHead>
                  <TableHead className="text-center">Breach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overlapEntries.slice(0, 20).map((e: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{e.other_scheme_name || (e.scheme_code_a === queried ? e.scheme_code_b : e.scheme_code_a)}</TableCell>
                    <TableCell className="text-center text-sm">{parseFloat(e.overlap_percent).toFixed(1)}%</TableCell>
                    <TableCell className="text-center">
                      {e.breach_flag ? <Badge className="bg-orange-100 text-orange-800 text-xs">Breach</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab 5: Bulk Actions ──────────────────────────────────────────────────────
function BulkActionsTab() {
  const { toast } = useToast();
  const [namingResult, setNamingResult] = useState<any>(null);
  const [lifecycleResult, setLifecycleResult] = useState<any>(null);
  const [overlapResult, setOverlapResult] = useState<any>(null);

  const namingMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/validate/naming/all", { method: "POST" }),
    onSuccess: (d: any) => {
      setNamingResult(d);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance-dashboard"] });
      toast({ title: "Naming validation complete", description: `${d.passed} passed, ${d.failed} failed of ${d.total} schemes.` });
    },
    onError: (e: any) => toast({ title: "Naming validation failed", description: e.message, variant: "destructive" }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/validate/lifecycle/all", { method: "POST" }),
    onSuccess: (d: any) => {
      setLifecycleResult(d);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance-dashboard"] });
      toast({ title: "Lifecycle validation complete", description: `${d.valid} valid, ${d.invalid} invalid of ${d.total} lifecycle funds.` });
    },
    onError: (e: any) => toast({ title: "Lifecycle validation failed", description: e.message, variant: "destructive" }),
  });

  const overlapMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/sebi/overlap/recompute", { method: "POST" }),
    onSuccess: (d: any) => {
      setOverlapResult(d);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/overlap-breaches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sebi/compliance-dashboard"] });
      toast({ title: "Overlap recomputed", description: `${d.pairsComputed} pairs, ${d.breachesFound} breaches.` });
    },
    onError: (e: any) => toast({ title: "Overlap recompute failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Bulk Compliance Actions</h2>
        <p className="text-sm text-muted-foreground">These operations run against all published schemes. They may take a few minutes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Naming Validation</CardTitle>
            <CardDescription className="text-xs">Validates all published schemes against SEBI 2026 True-to-Label naming norms. Blocks schemes with prohibited terms or missing category keywords.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="sm" onClick={() => namingMutation.mutate()} disabled={namingMutation.isPending}>
              {namingMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {namingMutation.isPending ? "Validating..." : "Validate Naming (All Published)"}
            </Button>
            {namingResult && (
              <div className="text-xs space-y-2">
                <div className="flex gap-3">
                  <span className="text-green-600 font-medium">✓ {namingResult.passed} passed</span>
                  <span className="text-red-600 font-medium">✗ {namingResult.failed} failed</span>
                  <span className="text-muted-foreground">{namingResult.total} total</span>
                </div>
                {(namingResult.failureSamples || []).length > 0 && (
                  <ScrollArea className="h-32 border rounded p-2">
                    {namingResult.failureSamples.map((f: any, i: number) => (
                      <div key={i} className="mb-2">
                        <div className="font-medium text-foreground">{f.schemeName}</div>
                        <div className="text-muted-foreground line-clamp-2">{f.reason}</div>
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Lifecycle Glide Path</CardTitle>
            <CardDescription className="text-xs">Validates glide path monotonicity, year gaps, and allocation sums for all schemes with lifecycleMetadata set.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="sm" onClick={() => lifecycleMutation.mutate()} disabled={lifecycleMutation.isPending}>
              {lifecycleMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {lifecycleMutation.isPending ? "Validating..." : "Validate Glide Paths"}
            </Button>
            {lifecycleResult && (
              <div className="text-xs space-y-2">
                <div className="flex gap-3">
                  <span className="text-green-600 font-medium">✓ {lifecycleResult.valid} valid</span>
                  <span className="text-red-600 font-medium">✗ {lifecycleResult.invalid} invalid</span>
                  <span className="text-muted-foreground">{lifecycleResult.total} total</span>
                </div>
                {lifecycleResult.invalid > 0 && (lifecycleResult.results || []).filter((r: any) => !r.valid).length > 0 && (
                  <ScrollArea className="h-32 border rounded p-2">
                    {lifecycleResult.results.filter((r: any) => !r.valid).map((r: any, i: number) => (
                      <div key={i} className="mb-2">
                        <div className="font-medium text-foreground">{r.schemeName}</div>
                        {(r.violations || []).map((v: string, j: number) => (
                          <div key={j} className="text-muted-foreground">{v}</div>
                        ))}
                      </div>
                    ))}
                  </ScrollArea>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Overlap Recomputation</CardTitle>
            <CardDescription className="text-xs">Recomputes all pairwise overlap percentages and applies breach rules. Import holdings first if not done yet.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" size="sm" onClick={() => overlapMutation.mutate()} disabled={overlapMutation.isPending}>
              {overlapMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {overlapMutation.isPending ? "Computing..." : "Recompute + Apply Breach Rules"}
            </Button>
            {overlapResult && (
              <div className="text-xs space-y-1">
                <div className="flex gap-3">
                  <span className="font-medium">{overlapResult.pairsComputed} pairs</span>
                  <span className="text-orange-600 font-medium">{overlapResult.breachesFound} breaches</span>
                </div>
                <div className="text-muted-foreground">{overlapResult.schemesCovered} schemes covered</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Tab 6: Categorization Audit Log ─────────────────────────────────────────
function AuditLogTab() {
  const [page, setPage] = useState(1);
  const [schemeFilter, setSchemeFilter] = useState("");
  const [filterApplied, setFilterApplied] = useState("");
  const limit = 50;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/sebi/categorization-audit", { page, limit, schemeCode: filterApplied }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterApplied) params.append("schemeCode", filterApplied);
      return fetch(`/api/admin/sebi/categorization-audit?${params}`).then(r => r.json());
    },
  });

  const logs: any[] = data?.logs || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Categorization Audit Log</h2>
          <p className="text-sm text-muted-foreground">{total} total records</p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Filter by scheme code"
            value={schemeFilter}
            onChange={e => setSchemeFilter(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setFilterApplied(schemeFilter.trim()); setPage(1); } }}
            className="w-48 text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => { setFilterApplied(schemeFilter.trim()); setPage(1); }}>
            <Search className="h-4 w-4" />
          </Button>
          {filterApplied && (
            <Button variant="ghost" size="sm" onClick={() => { setSchemeFilter(""); setFilterApplied(""); setPage(1); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="pt-8 pb-8 text-center text-muted-foreground">No categorization changes recorded yet.</CardContent></Card>
      ) : (
        <>
          <ScrollArea className="h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Category Change</TableHead>
                  <TableHead>Subcategory Change</TableHead>
                  <TableHead>Taxonomy</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{log.scheme_name || log.scheme_code}</div>
                      <div className="text-xs text-muted-foreground">{log.scheme_code}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.old_category !== log.new_category ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">{log.old_category || "—"}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-medium">{log.new_category}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{log.new_category}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.old_subcategory !== log.new_subcategory ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">{log.old_subcategory || "—"}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="font-medium">{log.new_subcategory}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{log.new_subcategory || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{log.taxonomy_version}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.triggered_by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.changed_at ? new Date(log.changed_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page} of {totalPages} ({total} records)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SEBIMFCompliance() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">SEBI 2026 MF Compliance Centre</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Mutual Fund Categorisation &amp; Rationalisation — Circular SEBI/HO/IMD/CIR/P/2026/26 (Feb 26, 2026)
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Overview</TabsTrigger>
          <TabsTrigger value="taxonomy" className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />Taxonomy</TabsTrigger>
          <TabsTrigger value="overlap" className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Overlap Breaches</TabsTrigger>
          <TabsTrigger value="scheme" className="flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />Scheme Lookup</TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Bulk Actions</TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Audit Log</TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="taxonomy"><TaxonomyTab /></TabsContent>
          <TabsContent value="overlap"><OverlapTab /></TabsContent>
          <TabsContent value="scheme"><SchemeLookupTab /></TabsContent>
          <TabsContent value="bulk"><BulkActionsTab /></TabsContent>
          <TabsContent value="audit"><AuditLogTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
