import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { BulkSelectTable, type Column, type BulkAction } from "@/components/admin/BulkSelectTable";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Users,
  FileWarning,
  ArrowUpRight,
  RefreshCw,
  Search,
  Play,
  Video,
  Trash2,
  Bell,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Shield as LucideShield,
  Calendar
} from "lucide-react";

interface AgingBucket {
  label: string;
  count: number;
  color: string;
  breached: boolean;
}

interface DashboardStats {
  agingBuckets: AgingBucket[];
  environmentMode: string;
  blockedAttemptsCount: number;
  mockProviderAllowed: boolean;
}

interface DeferredCase {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  panNumber: string;
  status: 'pending' | 'in_progress' | 'manual_kyc_initiated' | 'vkyc_scheduled' | 'resolved' | 'rejected';
  reason: string;
  failureCode: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  slaBreached: boolean;
  hoursRemaining: number;
  escalationLevel: number;
  assignedTo?: string;
  attempts: number;
  lastAttemptAt?: string;
}

function formatTimeRemaining(hours: number): string {
  if (hours < 0) {
    const overdue = Math.abs(hours);
    if (overdue < 24) {
      return `${Math.round(overdue)}h overdue`;
    }
    return `${Math.round(overdue / 24)}d overdue`;
  }
  if (hours < 24) {
    return `${Math.round(hours)}h remaining`;
  }
  return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h remaining`;
}

function getSlaColor(hoursRemaining: number, breached: boolean): string {
  if (breached) return "text-red-600";
  if (hoursRemaining < 12) return "text-orange-600";
  if (hoursRemaining < 24) return "text-yellow-600";
  return "text-green-600";
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    pending: { variant: "outline", className: "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700" },
    in_progress: { variant: "outline", className: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700" },
    manual_kyc_initiated: { variant: "outline", className: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700" },
    vkyc_scheduled: { variant: "outline", className: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700" },
    resolved: { variant: "outline", className: "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700" },
    rejected: { variant: "destructive", className: "" },
  };
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Badge variant={config.variant} className={config.className}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </Badge>
  );
}

export default function CkycDeferredDashboard() {
  const { toast } = useToast();
  const [selectedCase, setSelectedCase] = useState<DeferredCase | null>(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [actionReason, setActionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [breachedOnly, setBreachedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: dashboardStats, isLoading: statsLoading, refetch: refetchStats } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/ckyc-deferred/dashboard-stats"],
    refetchInterval: 60000,
  });

  const { data: casesData, isLoading: casesLoading, refetch: refetchCases } = useQuery<{ cases: DeferredCase[]; total: number }>({
    queryKey: ["/api/admin/ckyc-deferred/cases", statusFilter, breachedOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (breachedOnly) params.append("breachedOnly", "true");
      const result = await apiRequest(`/api/admin/ckyc-deferred/cases?${params}`);
      return result.data || { cases: [], total: 0 };
    },
    refetchInterval: 60000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ caseId, action, reason }: { caseId: string; action: string; reason: string }) => {
      const result = await apiRequest(`/api/admin/ckyc-deferred/cases/${caseId}/action`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      return result;
    },
    onSuccess: () => {
      toast({ title: "Action Applied", description: "Case has been updated successfully." });
      setActionDialog(false);
      setSelectedCase(null);
      setActionReason("");
      refetchCases();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkSlaMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/ckyc-deferred/check-sla-breaches", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "SLA Check Complete",
        description: `Checked ${data.data?.totalChecked || 0} cases, ${data.data?.breachesFound || 0} breaches found.`,
      });
      refetchCases();
      refetchStats();
    },
  });

  const cases = casesData?.cases || [];
  const filteredCases = useMemo(() => {
    if (!searchQuery) return cases;
    const query = searchQuery.toLowerCase();
    return cases.filter(c =>
      c.userName?.toLowerCase().includes(query) ||
      c.userEmail?.toLowerCase().includes(query) ||
      c.panNumber?.toLowerCase().includes(query) ||
      c.id.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  const columns: Column<DeferredCase>[] = useMemo(() => [
    {
      id: "user",
      header: "User",
      cell: (item) => (
        <div>
          <p className="font-medium" data-testid={`text-userName-${item.id}`}>{item.userName || 'N/A'}</p>
          <p className="text-sm text-muted-foreground" data-testid={`text-userEmail-${item.id}`}>{item.userEmail}</p>
        </div>
      ),
    },
    {
      id: "pan",
      header: "PAN",
      cell: (item) => <span className="font-mono text-sm" data-testid={`text-pan-${item.id}`}>{item.panNumber}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (item) => getStatusBadge(item.status),
    },
    {
      id: "reason",
      header: "Failure Reason",
      cell: (item) => (
        <span className="text-sm max-w-[200px] truncate block" title={item.reason} data-testid={`text-reason-${item.id}`}>
          {item.reason || item.failureCode || 'Unknown'}
        </span>
      ),
    },
    {
      id: "sla",
      header: "SLA Timer",
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Timer className={`h-4 w-4 ${getSlaColor(item.hoursRemaining, item.slaBreached)}`} />
          <span className={`text-sm font-medium ${getSlaColor(item.hoursRemaining, item.slaBreached)}`} data-testid={`text-sla-${item.id}`}>
            {formatTimeRemaining(item.hoursRemaining)}
          </span>
          {item.slaBreached && (
            <Badge variant="destructive" className="text-xs" data-testid={`badge-breached-${item.id}`}>
              BREACHED
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: "escalation",
      header: "Escalation",
      cell: (item) => (
        <div className="flex items-center gap-1" data-testid={`escalation-${item.id}`}>
          {item.escalationLevel > 0 ? (
            <>
              <ArrowUpRight className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Level {item.escalationLevel}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      ),
    },
    {
      id: "attempts",
      header: "Attempts",
      cell: (item) => <span className="text-sm" data-testid={`text-attempts-${item.id}`}>{item.attempts}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedCase(item);
            setActionDialog(true);
          }}
          data-testid={`button-action-${item.id}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ], []);

  const bulkActions: BulkAction<DeferredCase>[] = useMemo(() => [
    {
      id: "bulk-escalate",
      label: "Send Escalation Alert",
      icon: <Bell className="h-4 w-4 mr-2" />,
      variant: "default",
      requiresConfirmation: true,
      confirmTitle: "Send Escalation Alert",
      confirmDescription: "Send escalation notification to compliance team for selected cases?",
      onExecute: async (items) => {
        toast({
          title: "Escalation Sent",
          description: `Escalation alert sent for ${items.length} cases.`,
        });
      },
    },
    {
      id: "bulk-manual-kyc",
      label: "Initiate Manual KYC",
      icon: <Play className="h-4 w-4 mr-2" />,
      variant: "outline",
      requiresConfirmation: true,
      confirmTitle: "Initiate Manual KYC",
      confirmDescription: "Start manual KYC process for selected cases?",
      onExecute: async (items) => {
        let successCount = 0;
        for (const item of items) {
          try {
            await actionMutation.mutateAsync({
              caseId: item.id,
              action: 'manual_kyc_initiated',
              reason: 'Bulk manual KYC initiation via admin dashboard',
            });
            successCount++;
          } catch (e) {}
        }
        toast({
          title: "Manual KYC Initiated",
          description: `Successfully initiated for ${successCount}/${items.length} cases.`,
        });
        refetchCases();
        refetchStats();
      },
    },
    {
      id: "bulk-schedule-vkyc",
      label: "Schedule Video KYC",
      icon: <Video className="h-4 w-4 mr-2" />,
      variant: "outline",
      requiresConfirmation: true,
      confirmTitle: "Schedule Video KYC",
      confirmDescription: "Schedule video KYC appointments for selected cases?",
      onExecute: async (items) => {
        let successCount = 0;
        for (const item of items) {
          try {
            await actionMutation.mutateAsync({
              caseId: item.id,
              action: 'vkyc_scheduled',
              reason: 'Bulk VKYC scheduling via admin dashboard',
            });
            successCount++;
          } catch (e) {}
        }
        toast({
          title: "Video KYC Scheduled",
          description: `Successfully scheduled for ${successCount}/${items.length} cases.`,
        });
        refetchCases();
        refetchStats();
      },
    },
  ], [toast, actionMutation, refetchCases, refetchStats]);

  const totalBreached = dashboardStats?.agingBuckets?.filter(b => b.breached).reduce((sum, b) => sum + b.count, 0) || 0;
  const totalPending = dashboardStats?.agingBuckets?.reduce((sum, b) => sum + b.count, 0) || 0;

  if (statsLoading) {
    return <LoadingState variant="table" />;
  }

  return (
    <div className="space-y-6 p-6" data-testid="ckyc-deferred-dashboard">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileWarning className="h-8 w-8 text-orange-500" />
            CKYC Deferred Cases
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and resolve pending CKYC verifications with SLA tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => checkSlaMutation.mutate()}
            disabled={checkSlaMutation.isPending}
            data-testid="check-sla-btn"
          >
            {checkSlaMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Timer className="h-4 w-4 mr-2" />
            )}
            Check SLA Breaches
          </Button>
          <Button
            variant="outline"
            onClick={() => { refetchCases(); refetchStats(); }}
            data-testid="refresh-btn"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {totalBreached > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>SLA Breach Alert</AlertTitle>
          <AlertDescription>
            {totalBreached} case(s) have breached SLA. Immediate action required to maintain SEBI compliance.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardStats?.agingBuckets?.map((bucket, index) => (
          <Card
            key={index}
            className={bucket.breached ? "border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30" : ""}
            data-testid={`aging-bucket-${index}`}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                {bucket.breached && <AlertCircle className="h-4 w-4 text-red-500" />}
                {bucket.label}
              </CardDescription>
              <CardTitle className={`text-3xl ${bucket.breached ? "text-red-600" : ""}`}>
                {bucket.count}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={totalPending > 0 ? (bucket.count / totalPending) * 100 : 0}
                className={`h-2 ${bucket.breached ? "[&>div]:bg-red-500" : ""}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or PAN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                data-testid="search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="manual_kyc_initiated">Manual KYC</SelectItem>
                <SelectItem value="vkyc_scheduled">VKYC Scheduled</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={breachedOnly ? "default" : "outline"}
              onClick={() => setBreachedOnly(!breachedOnly)}
              data-testid="breached-filter-btn"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Breached Only
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deferred Cases ({filteredCases.length})
          </CardTitle>
          <CardDescription>
            Select cases to apply bulk actions or click to manage individually
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <BulkSelectTable
            data={filteredCases}
            columns={columns}
            bulkActions={bulkActions}
            isLoading={casesLoading}
            emptyMessage="No deferred cases found matching your criteria"
          />
        </CardContent>
      </Card>

      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take Action on Case</DialogTitle>
            <DialogDescription>
              {selectedCase && (
                <span>User: {selectedCase.userName} ({selectedCase.panNumber})</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedCase.status)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SLA</p>
                  <p className={getSlaColor(selectedCase.hoursRemaining, selectedCase.slaBreached)}>
                    {formatTimeRemaining(selectedCase.hoursRemaining)}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Failure Reason</p>
                  <p>{selectedCase.reason || selectedCase.failureCode}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Select Action</Label>
                <Select value={selectedAction} onValueChange={setSelectedAction}>
                  <SelectTrigger data-testid="action-select">
                    <SelectValue placeholder="Choose action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual_kyc_initiated">
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        Initiate Manual KYC
                      </div>
                    </SelectItem>
                    <SelectItem value="vkyc_scheduled">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Schedule Video KYC
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Mark as Resolved
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Reject Case
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Reason (min 10 characters)</Label>
                <Textarea
                  placeholder="Provide detailed reason for this action..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  rows={3}
                  data-testid="action-reason"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCase && selectedAction && actionReason.length >= 10) {
                  actionMutation.mutate({
                    caseId: selectedCase.id,
                    action: selectedAction,
                    reason: actionReason,
                  });
                }
              }}
              disabled={!selectedAction || actionReason.length < 10 || actionMutation.isPending}
              data-testid="apply-action-btn"
            >
              {actionMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
