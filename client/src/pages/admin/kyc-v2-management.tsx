import { useState, Suspense } from "react";
import { useQuery, useSuspenseQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Video,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield as LucideShield,
  Search,
  RefreshCw,
  Clock,
  Eye,
  Download,
  FileText,
  Users,
  Activity,
  Package,
  Webhook,
  Server,
  Play,
  ChevronDown,
  Loader2,
  Inbox,
  Ban,
  ThumbsUp,
  ThumbsDown,
  Hash,
  Info,
  RotateCcw,
  Zap,
  BookOpen,
  UserX,
  CalendarClock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState } from "@/components/LoadingState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

function EnvironmentBanner() {
  const { data, isLoading } = useQuery<{
    success: boolean;
    environment: string;
    fixedOtpEnabled: boolean;
    providers: Record<string, { provider: string; status: string; environment: string }>;
  }>({
    queryKey: ["/api/kyc/environment/status"],
  });

  if (isLoading) {
    return <Skeleton className="h-12 w-full mb-4" />;
  }

  if (!data?.success) return null;

  const isSandbox = data.environment === "sandbox";

  return (
    <Alert
      className={
        isSandbox
          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950 mb-4"
          : "border-green-500 bg-green-50 dark:bg-green-950 mb-4"
      }
    >
      <Server className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Environment:{" "}
        <Badge variant={isSandbox ? "secondary" : "default"}>
          {data.environment?.toUpperCase()}
        </Badge>
        {data.fixedOtpEnabled && (
          <Badge variant="outline" className="text-yellow-600">
            Fixed OTP Enabled
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap gap-3 mt-1">
          {Object.entries(data.providers || {}).map(([key, info]) => {
            const statusStr = typeof info === 'object' ? info.status : String(info);
            const providerStr = typeof info === 'object' ? info.provider : String(info);
            return (
              <span key={key} className="flex items-center gap-1 text-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    statusStr === "active" || statusStr === "connected"
                      ? "bg-green-500"
                      : statusStr === "sandbox" || statusStr === "mock"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                />
                {key.toUpperCase()}: {providerStr}
              </span>
            );
          })}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

function VideoKycTab() {
  const { toast } = useToast();
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [officerNotes, setOfficerNotes] = useState("");
  const [recordingHash, setRecordingHash] = useState("");
  const [completeStatus, setCompleteStatus] = useState<"approved" | "rejected">("approved");

  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    sessions: Array<{
      id: string;
      userId: string;
      reason: string;
      status: string;
      scheduledAt: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/kyc/video/admin/pending"],
  });

  const completeMutation = useMutation({
    mutationFn: (body: { videoKycId: string; status: string; recordingHash: string; officerNotes: string }) =>
      apiRequest("/api/kyc/video/complete", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Success", description: "Video KYC session completed." });
      setCompleteDialogOpen(false);
      setSelectedSession(null);
      setOfficerNotes("");
      setRecordingHash("");
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/video/admin/pending"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete video KYC session.", variant: "destructive" });
    },
  });

  const handleComplete = () => {
    if (!selectedSession) return;
    completeMutation.mutate({
      videoKycId: selectedSession.id,
      status: completeStatus,
      recordingHash,
      officerNotes,
    });
  };

  const sessions = data?.sessions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pending Video KYC Sessions</h3>
          <p className="text-sm text-muted-foreground">Review and manage video KYC verification requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingTable />
      ) : sessions.length === 0 ? (
        <EmptyState icon={Video} title="No pending sessions" description="All video KYC sessions have been processed." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-sm">{session.id.slice(0, 8)}...</TableCell>
                  <TableCell>{session.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.reason}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        session.status === "completed"
                          ? "default"
                          : session.status === "pending"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {session.scheduledAt ? format(new Date(session.scheduledAt), "dd MMM yyyy, HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSession(session);
                          setCompleteStatus("approved");
                          setCompleteDialogOpen(true);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSession(session);
                          setCompleteStatus("rejected");
                          setCompleteDialogOpen(true);
                        }}
                      >
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {completeStatus === "approved" ? "Approve" : "Reject"} Video KYC
            </DialogTitle>
            <DialogDescription>
              Session: {selectedSession?.id?.slice(0, 12)}... | User: {selectedSession?.userId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recording Hash</label>
              <Input
                placeholder="Enter recording hash..."
                value={recordingHash}
                onChange={(e) => setRecordingHash(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Officer Notes</label>
              <Textarea
                placeholder="Add notes about this session..."
                value={officerNotes}
                onChange={(e) => setOfficerNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={completeStatus === "approved" ? "default" : "destructive"}
              onClick={handleComplete}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {completeStatus === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MakerCheckerTab() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"pending" | "history">("pending");
  const [actionDialog, setActionDialog] = useState<{ open: boolean; type: "approve" | "reject"; approval: any }>({
    open: false,
    type: "approve",
    approval: null,
  });
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: pendingData, isLoading: pendingLoading } = useQuery<{
    success: boolean;
    approvals: Array<{
      id: string;
      sessionId: string;
      userId: string;
      entityType: string;
      makerId: string;
      status: string;
      makerNotes: string;
      submittedAt: string;
    }>;
  }>({
    queryKey: ["/api/kyc/approval/pending"],
    enabled: activeView === "pending",
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{
    success: boolean;
    approvals: any[];
  }>({
    queryKey: ["/api/kyc/approval/history?limit=50"],
    enabled: activeView === "history",
  });

  const approveMutation = useMutation({
    mutationFn: (body: { approvalId: string; notes: string }) =>
      apiRequest("/api/kyc/approval/approve", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Approved", description: "Approval has been granted." });
      setActionDialog({ open: false, type: "approve", approval: null });
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/approval/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/approval/history"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (body: { approvalId: string; notes: string; rejectionReason: string }) =>
      apiRequest("/api/kyc/approval/reject", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "Rejected", description: "Approval has been rejected." });
      setActionDialog({ open: false, type: "reject", approval: null });
      setNotes("");
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/approval/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/approval/history"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject.", variant: "destructive" });
    },
  });

  const handleAction = () => {
    if (!actionDialog.approval) return;
    if (actionDialog.type === "approve") {
      approveMutation.mutate({ approvalId: actionDialog.approval.id, notes });
    } else {
      rejectMutation.mutate({ approvalId: actionDialog.approval.id, notes, rejectionReason });
    }
  };

  const pendingApprovals = pendingData?.approvals || [];
  const historyApprovals = historyData?.approvals || [];
  const isLoading = activeView === "pending" ? pendingLoading : historyLoading;
  const approvals = activeView === "pending" ? pendingApprovals : historyApprovals;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Maker-Checker Approvals</h3>
          <p className="text-sm text-muted-foreground">Review pending approvals or view history</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeView === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("pending")}
          >
            <Clock className="h-4 w-4 mr-1" />
            Pending
          </Button>
          <Button
            variant={activeView === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("history")}
          >
            <FileText className="h-4 w-4 mr-1" />
            History
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingTable />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={activeView === "pending" ? "No pending approvals" : "No approval history"}
          description={
            activeView === "pending"
              ? "All maker-checker items have been processed."
              : "No approval records found."
          }
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Maker</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Maker Notes</TableHead>
                <TableHead>Submitted</TableHead>
                {activeView === "pending" && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval: any) => (
                <TableRow key={approval.id}>
                  <TableCell className="font-mono text-sm">{approval.id?.slice(0, 8)}...</TableCell>
                  <TableCell>{approval.userId}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{approval.entityType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{approval.makerId}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        approval.status === "approved"
                          ? "default"
                          : approval.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {approval.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {approval.makerNotes || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {approval.submittedAt
                      ? formatDistanceToNow(new Date(approval.submittedAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  {activeView === "pending" && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActionDialog({ open: true, type: "approve", approval })
                          }
                        >
                          <ThumbsUp className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setActionDialog({ open: true, type: "reject", approval })
                          }
                        >
                          <ThumbsDown className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === "approve" ? "Approve" : "Reject"} Request
            </DialogTitle>
            <DialogDescription>
              Approval ID: {actionDialog.approval?.id?.slice(0, 12)}... | Entity: {actionDialog.approval?.entityType}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Add reviewer notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {actionDialog.type === "reject" && (
              <div>
                <label className="text-sm font-medium">Rejection Reason</label>
                <Textarea
                  placeholder="Provide reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, type: "approve", approval: null })}>
              Cancel
            </Button>
            <Button
              variant={actionDialog.type === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {actionDialog.type === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RejectionsDisputesTab() {
  const { data: disputesData, isLoading: disputesLoading } = useQuery<{
    success: boolean;
    disputes: any[];
  }>({
    queryKey: ["/api/kyc/disputes"],
  });

  const { data: reasonsData, isLoading: reasonsLoading } = useQuery<{
    success: boolean;
    reasons: Record<string, string>;
  }>({
    queryKey: ["/api/kyc/rejection-reasons"],
  });

  const disputes = disputesData?.disputes || [];
  const reasons = reasonsData?.reasons || {};
  const isLoading = disputesLoading || reasonsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">KYC Rejections & Disputes</h3>
        <p className="text-sm text-muted-foreground">View rejection reasons and manage disputes</p>
      </div>

      {Object.keys(reasons).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Rejection Reasons Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(reasons).map(([code, description]) => (
                <div key={code} className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <Badge variant="outline" className="shrink-0 font-mono text-xs">
                    {code}
                  </Badge>
                  <span className="text-sm">{String(description)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingTable />
      ) : disputes.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No disputes" description="No KYC disputes have been filed." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Disputes</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispute ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disputes.map((dispute: any) => (
                <TableRow key={dispute.id}>
                  <TableCell className="font-mono text-sm">{dispute.id?.slice?.(0, 8) ?? dispute.id}...</TableCell>
                  <TableCell>{dispute.userId || dispute.user}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{dispute.type || dispute.entityType || "KYC"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        dispute.status === "resolved"
                          ? "default"
                          : dispute.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {dispute.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[250px] truncate text-sm">
                    {dispute.reason || dispute.description || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dispute.createdAt
                      ? formatDistanceToNow(new Date(dispute.createdAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function AuditPackTab() {
  const { toast } = useToast();
  const [searchUserId, setSearchUserId] = useState("");
  const [activeUserId, setActiveUserId] = useState("");

  const { data: packData, isLoading: packLoading } = useQuery<{
    success: boolean;
    packId: string;
    sections: any[];
    checksum: string;
  }>({
    queryKey: ["/api/kyc/audit-pack", activeUserId],
    enabled: !!activeUserId,
  });

  const { data: packsData, isLoading: packsLoading } = useQuery<{
    success: boolean;
    packs: any[];
  }>({
    queryKey: ["/api/kyc/audit-packs", activeUserId],
    enabled: !!activeUserId,
  });

  const handleSearch = () => {
    if (!searchUserId.trim()) {
      toast({ title: "Enter a User ID", description: "Please provide a user ID to search.", variant: "destructive" });
      return;
    }
    setActiveUserId(searchUserId.trim());
  };

  const sections = packData?.sections || [];
  const packs = packsData?.packs || [];
  const isLoading = packLoading || packsLoading;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Audit Pack Generator</h3>
        <p className="text-sm text-muted-foreground">Search for a user and generate or download audit packs</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter User ID..."
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeUserId && isLoading && <LoadingTable rows={3} />}

      {activeUserId && !isLoading && (
        <>
          {packData?.success && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Current Audit Pack
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      <Hash className="h-3 w-3 mr-1" />
                      {packData.checksum?.slice(0, 12)}...
                    </Badge>
                  </div>
                </div>
                <CardDescription>Pack ID: {packData.packId}</CardDescription>
              </CardHeader>
              <CardContent>
                {sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sections in this audit pack.</p>
                ) : (
                  <div className="space-y-2">
                    {sections.map((section: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{section.title || section.name || `Section ${idx + 1}`}</span>
                        </div>
                        <Badge variant={section.status === "complete" ? "default" : "secondary"}>
                          {section.status || "pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {packs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Previous Audit Packs</CardTitle>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pack ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Sections</TableHead>
                    <TableHead>Checksum</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packs.map((pack: any) => (
                    <TableRow key={pack.id || pack.packId}>
                      <TableCell className="font-mono text-sm">{(pack.id || pack.packId)?.slice(0, 10)}...</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pack.createdAt ? format(new Date(pack.createdAt), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>{pack.sectionsCount || pack.sections?.length || 0}</TableCell>
                      <TableCell className="font-mono text-xs">{pack.checksum?.slice(0, 10)}...</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {!packData?.success && packs.length === 0 && !isLoading && (
            <EmptyState icon={Package} title="No audit packs found" description={`No audit packs found for user ${activeUserId}.`} />
          )}
        </>
      )}
    </div>
  );
}

function WebhookDlqTab() {
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{
    success: boolean;
    stats: { pending: number; processing: number; completed: number; failed: number; dlq: number };
  }>({
    queryKey: ["/api/kyc/webhook/stats"],
  });

  const { data: dlqData, isLoading: dlqLoading, refetch: refetchDlq } = useQuery<{
    success: boolean;
    events: any[];
  }>({
    queryKey: ["/api/kyc/webhook/dlq"],
  });

  const replayMutation = useMutation({
    mutationFn: (eventId: string) =>
      apiRequest(`/api/kyc/webhook/replay/${eventId}`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Replayed", description: "Event has been queued for replay." });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/webhook/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/webhook/dlq"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to replay event.", variant: "destructive" });
    },
  });

  const stats = statsData?.stats;
  const events = dlqData?.events || [];

  const statCards = stats
    ? [
        { label: "Pending", value: stats.pending, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" },
        { label: "Processing", value: stats.processing, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
        { label: "Completed", value: stats.completed, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
        { label: "Failed", value: stats.failed, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
        { label: "DLQ", value: stats.dlq, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Webhook & DLQ Monitor</h3>
          <p className="text-sm text-muted-foreground">Monitor webhook processing and dead letter queue</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchStats();
            refetchDlq();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statCards.map((s) => (
            <Card key={s.label} className={s.bg}>
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Dead Letter Queue Events
          </CardTitle>
        </CardHeader>
        {dlqLoading ? (
          <CardContent>
            <LoadingTable rows={3} />
          </CardContent>
        ) : events.length === 0 ? (
          <CardContent>
            <EmptyState icon={Inbox} title="DLQ is empty" description="No failed events in the dead letter queue." />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Failed At</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event: any) => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-sm">{event.id?.slice?.(0, 8) ?? event.id}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{event.type || event.eventType || "webhook"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">{event.status || "failed"}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {event.error || event.lastError || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.failedAt || event.lastAttemptAt
                      ? formatDistanceToNow(new Date(event.failedAt || event.lastAttemptAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{event.retryCount ?? event.attempts ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => replayMutation.mutate(event.id)}
                      disabled={replayMutation.isPending}
                    >
                      <Play className="h-4 w-4 text-blue-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function EnvironmentStatusTab() {
  const { data, isLoading, refetch } = useQuery<{
    success: boolean;
    environment: string;
    fixedOtpEnabled: boolean;
    providers: Record<string, { provider: string; status: string; environment: string }>;
  }>({
    queryKey: ["/api/kyc/environment/status"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <EmptyState
        icon={Server}
        title="Unable to fetch environment status"
        description="Could not retrieve environment configuration."
      />
    );
  }

  const isSandbox = data.environment === "sandbox";
  const providers = data.providers || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Environment Status</h3>
          <p className="text-sm text-muted-foreground">Current KYC environment and provider configuration</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full ${isSandbox ? "bg-yellow-500" : "bg-green-500"}`}
              />
              <span className="text-2xl font-bold">{data.environment?.toUpperCase()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LucideShield className="h-4 w-4" />
              Fixed OTP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={data.fixedOtpEnabled ? "secondary" : "default"}>
                {data.fixedOtpEnabled ? "Enabled" : "Disabled"}
              </Badge>
              {data.fixedOtpEnabled && (
                <span className="text-sm text-yellow-600">Test mode active</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provider Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(providers).map(([name, info]) => {
              const statusStr = typeof info === 'object' ? info.status : String(info);
              const providerStr = typeof info === 'object' ? info.provider : String(info);
              const isActive = statusStr === "active" || statusStr === "connected";
              const isSandboxMode = statusStr === "sandbox" || statusStr === "mock";
              return (
                <div
                  key={name}
                  className="flex items-center gap-3 p-4 rounded-lg border"
                >
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isActive ? "bg-green-500" : isSandboxMode ? "bg-yellow-500" : "bg-red-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium">{name.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground">{providerStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepResetTab() {
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState("");
  const [searchSessionId, setSearchSessionId] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<{step: string; downstreamSteps: string[]} | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [resetReasonCode, setResetReasonCode] = useState("");

  const { data: reasonsData } = useQuery<{success: boolean; reasons: Record<string, string>}>({
    queryKey: ["/api/kyc/agent/step-reset/reasons"],
  });

  const { data: availableData, isLoading: availableLoading } = useQuery<{
    success: boolean;
    resettableSteps: Array<{step: string; currentStatus: any; downstreamSteps: string[]}>;
    sessionId: string;
  }>({
    queryKey: ["/api/kyc/agent/step-reset/available", searchSessionId],
    enabled: !!searchSessionId,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{
    success: boolean;
    resets: Array<{
      id: string;
      step: string;
      reason: string;
      reasonCode: string;
      resetBy: string;
      resetByRole: string;
      dependentStepsReset: string[];
      resetAt: string;
    }>;
  }>({
    queryKey: ["/api/kyc/agent/step-reset/history", searchSessionId],
    enabled: !!searchSessionId,
  });

  const resetMutation = useMutation({
    mutationFn: async (params: {sessionId: string; step: string; reason: string; reasonCode: string}) => {
      return await apiRequest("/api/kyc/agent/step-reset", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/agent/step-reset/available", searchSessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/agent/step-reset/history", searchSessionId] });
      toast({ title: "Step Reset Successful", description: data.message || "The KYC step has been reset." });
      setResetDialogOpen(false);
      setSelectedStep(null);
      setResetReason("");
      setResetReasonCode("");
    },
    onError: (error: any) => {
      toast({ title: "Reset Failed", description: error.message || "Failed to reset step.", variant: "destructive" });
    },
  });

  const reasons = reasonsData?.reasons || {};
  const resettableSteps = availableData?.resettableSteps || [];
  const resetHistory = historyData?.resets || [];

  const STEP_LABELS: Record<string, string> = {
    pan_verification: "PAN Verification",
    kra_status_check: "KRA Status Check",
    aadhaar_otp: "Aadhaar OTP",
    aadhaar_verification: "Aadhaar Verification",
    ckyc_upload: "CKYC Upload",
    ckyc_status: "CKYC Status",
    ucc_creation: "UCC Creation",
    bank_verification: "Bank Verification",
    emandate_registration: "eMandate Registration",
    risk_profiling: "Risk Profiling",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Agent KYC Step Reset
          </CardTitle>
          <CardDescription>
            Reset individual KYC steps to allow users to redo them. Downstream dependent steps will be automatically cascade-reset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter KYC Session ID..."
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => setSearchSessionId(sessionId)} disabled={!sessionId.trim()}>
              <Search className="h-4 w-4 mr-1" />
              Search
            </Button>
          </div>

          {availableLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {searchSessionId && !availableLoading && resettableSteps.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Resettable Steps</AlertTitle>
              <AlertDescription>
                No completed steps found for this session, or the session does not exist.
              </AlertDescription>
            </Alert>
          )}

          {resettableSteps.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Downstream Impact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resettableSteps.map((item) => (
                  <TableRow key={item.step}>
                    <TableCell className="font-medium">{STEP_LABELS[item.step] || item.step}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" /> Completed
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.downstreamSteps.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.downstreamSteps.map(ds => (
                            <Badge key={ds} variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                              {STEP_LABELS[ds] || ds}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                        onClick={() => {
                          setSelectedStep(item);
                          setResetDialogOpen(true);
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {searchSessionId && resetHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Reset History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Cascade</TableHead>
                  <TableHead>Reset By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resetHistory.map((reset) => (
                  <TableRow key={reset.id}>
                    <TableCell className="font-medium">{STEP_LABELS[reset.step] || reset.step}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="text-xs">{reset.reasonCode}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{reset.reason}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reset.dependentStepsReset && reset.dependentStepsReset.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {reset.dependentStepsReset.map(ds => (
                            <Badge key={ds} variant="secondary" className="text-xs">{STEP_LABELS[ds] || ds}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{reset.resetByRole || "agent"}</TableCell>
                    <TableCell className="text-xs">{format(new Date(reset.resetAt), "dd MMM yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Reset KYC Step
            </DialogTitle>
            <DialogDescription>
              This will reset <strong>{STEP_LABELS[selectedStep?.step || ""] || selectedStep?.step}</strong> and require the user to complete it again.
              {selectedStep?.downstreamSteps && selectedStep.downstreamSteps.length > 0 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  {selectedStep.downstreamSteps.length} dependent step(s) will also be reset: {selectedStep.downstreamSteps.map(ds => STEP_LABELS[ds] || ds).join(", ")}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason Code</Label>
              <Select value={resetReasonCode} onValueChange={setResetReasonCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasons).map(([code, description]) => (
                    <SelectItem key={code} value={code}>{code}: {description}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Detailed Reason</Label>
              <Textarea
                placeholder="Explain why this step needs to be reset..."
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!resetReasonCode || !resetReason.trim() || resetMutation.isPending}
              onClick={() => {
                if (selectedStep && searchSessionId) {
                  resetMutation.mutate({
                    sessionId: searchSessionId,
                    step: selectedStep.step,
                    reason: resetReason,
                    reasonCode: resetReasonCode,
                  });
                }
              }}
            >
              {resetMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Confirm Reset
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DirectRejectTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string; email: string } | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");
  const [requireReKyc, setRequireReKyc] = useState(true);

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery<{
    success: boolean;
    submissions: Array<{ id: string; userId: string; firstName: string; lastName: string; userEmail: string; status: string; submittedAt: string }>;
  }>({
    queryKey: ["/api/admin/kyc/submissions", debouncedSearch],
    queryFn: () => {
      const url = debouncedSearch
        ? `/api/admin/kyc/submissions?search=${encodeURIComponent(debouncedSearch)}&limit=30`
        : `/api/admin/kyc/submissions?limit=30`;
      return fetch(url).then(r => r.json());
    },
  });

  const { data: activeSessionData, isLoading: sessionLoading } = useQuery<{
    success: boolean;
    session: {
      sessionId: string;
      currentStep: string;
      entityType: string | null;
      createdAt: string;
      initiatedBy: string | null;
      panMasked: string | null;
      userName: string | null;
      userEmail: string | null;
    } | null;
  }>({
    queryKey: ["/api/kyc/active-session", selectedUser?.userId],
    enabled: !!selectedUser?.userId && rejectDialogOpen,
  });

  const { data: reasonsData } = useQuery<{ success: boolean; reasons: Record<string, string> }>({
    queryKey: ["/api/kyc/rejection-reasons"],
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { sessionId: string; userId: string; reasonCode: string; notes: string; requireReKyc: boolean }) => {
      return await apiRequest("/api/kyc/reject", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      toast({ title: "KYC rejected", description: "The client's KYC session has been deactivated and logged." });
      setRejectDialogOpen(false);
      setSelectedUser(null);
      setReasonCode("");
      setNotes("");
      setRequireReKyc(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/submissions"] });
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__kycSearchTimer);
    (window as any).__kycSearchTimer = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const openRejectDialog = (user: { userId: string; name: string; email: string }) => {
    setSelectedUser(user);
    setReasonCode("");
    setNotes("");
    setRequireReKyc(true);
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    const session = activeSessionData?.session;
    if (!session || !selectedUser) return;
    if (!reasonCode) {
      toast({ title: "Reason required", description: "Please select a rejection reason.", variant: "destructive" });
      return;
    }
    if (notes.trim().length < 10) {
      toast({ title: "Notes too short", description: "Notes must be at least 10 characters.", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({
      sessionId: session.sessionId,
      userId: selectedUser.userId,
      reasonCode,
      notes: notes.trim(),
      requireReKyc,
    });
  };

  const submissions = submissionsData?.submissions || [];
  const reasons = reasonsData?.reasons || {};
  const activeSession = activeSessionData?.session;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Direct KYC Rejection</h3>
        <p className="text-sm text-muted-foreground">Search for a user and reject their active KYC session with a reason and audit log.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or PAN..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {submissionsLoading ? (
        <LoadingTable />
      ) : submissions.length === 0 ? (
        <EmptyState icon={Users} title="No submissions found" description="Try a different search term." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.firstName} {sub.lastName}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{sub.userEmail}</TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "approved" ? "default" : sub.status === "rejected" ? "destructive" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openRejectDialog({
                        userId: sub.userId,
                        name: `${sub.firstName} ${sub.lastName}`.trim(),
                        email: sub.userEmail,
                      })}
                    >
                      <Ban className="h-4 w-4 mr-1" />
                      Reject KYC
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Reject KYC — {selectedUser?.name || selectedUser?.email || "User"}
            </DialogTitle>
            <DialogDescription>
              This will immediately deactivate the client's active KYC session and create an audit log entry.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {sessionLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !activeSession ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No active session</AlertTitle>
                <AlertDescription>This user has no active KYC session to reject.</AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session ID</span>
                  <span className="font-mono">{activeSession.sessionId.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Step</span>
                  <span>{activeSession.currentStep}</span>
                </div>
                {activeSession.entityType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entity Type</span>
                    <span>{activeSession.entityType}</span>
                  </div>
                )}
                {activeSession.panMasked && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PAN</span>
                    <span className="font-mono">{activeSession.panMasked}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span>{activeSession.createdAt ? new Date(activeSession.createdAt).toLocaleString() : "—"}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Select value={reasonCode} onValueChange={setReasonCode} disabled={!activeSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasons).map(([code, desc]) => (
                    <SelectItem key={code} value={code}>{code} — {String(desc)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Notes <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Enter reviewer notes (min 10 characters)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={!activeSession}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Require Re-KYC</p>
                <p className="text-xs text-muted-foreground">Client must restart the KYC process</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={requireReKyc}
                onClick={() => setRequireReKyc(v => !v)}
                disabled={!activeSession}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${requireReKyc ? "bg-destructive" : "bg-muted"} disabled:opacity-50`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${requireReKyc ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!activeSession || rejectMutation.isPending || sessionLoading}
            >
              {rejectMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Rejecting...</>
              ) : (
                <><Ban className="h-4 w-4 mr-2" /> Confirm Reject</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Provider Health Strip ───────────────────────────────────────────────────

function ProviderHealthStrip() {
  const { data, refetch, isFetching } = useSuspenseQuery<{
    success: boolean;
    checkedAt: string;
    providers: Record<string, { status: 'live' | 'degraded' | 'down'; latencyMs: number; error?: string }>;
  }>({
    queryKey: ["/api/admin/kyc/provider-health"],
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const statusColor = (s: string) =>
    s === 'live' ? 'bg-green-500' : s === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

  const statusLabel = (s: string) =>
    s === 'live' ? 'Live' : s === 'degraded' ? 'Degraded' : 'Down';

  const providerNames: Record<string, string> = {
    sandbox_pan: 'Sandbox PAN',
    truthscreen_aadhaar: 'TruthScreen Aadhaar',
    truthscreen_ckyc: 'TruthScreen CKYC',
    ckyc_registry: 'CKYC Registry',
  };

  const providers = data?.providers ?? {};
  const anyDown = Object.values(providers).some(p => p.status === 'down');
  const anyDegraded = Object.values(providers).some(p => p.status === 'degraded');

  return (
    <div className={`rounded-lg border px-4 py-2 flex flex-wrap items-center gap-4 mb-2 text-sm
      ${anyDown ? 'border-red-400 bg-red-50 dark:bg-red-950' : anyDegraded ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950' : 'border-green-400 bg-green-50 dark:bg-green-950'}`}>
      <span className="font-semibold flex items-center gap-1.5">
        <Zap className="h-4 w-4" /> Provider Health
      </span>
      {Object.entries(providers).map(([key, info]) => (
        <span key={key} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusColor(info.status)}`} />
          <span className="font-medium">{providerNames[key] ?? key}:</span>
          <span className={info.status === 'live' ? 'text-green-700 dark:text-green-300' : info.status === 'degraded' ? 'text-yellow-700' : 'text-red-700'}>
            {statusLabel(info.status)}
          </span>
          <span className="text-muted-foreground text-xs">({info.latencyMs}ms)</span>
          {info.error && <span className="text-xs text-muted-foreground truncate max-w-[120px]" title={info.error}>⚠ {info.error.slice(0, 40)}</span>}
        </span>
      ))}
      {Object.keys(providers).length === 0 && <span className="text-muted-foreground">No data</span>}
      <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs" onClick={() => refetch()} disabled={isFetching}>
        <RefreshCw className={`h-3 w-3 mr-1 ${isFetching ? 'animate-spin' : ''}`} />Refresh
      </Button>
    </div>
  );
}

// ─── Admin Self-Reset Card ────────────────────────────────────────────────────

function SelfResetCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const selfReset = useMutation({
    mutationFn: () => apiRequest("/api/admin/kyc/reset-self", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast({ title: "KYC Reset Complete", description: "Your KYC has been cleared. Navigate to the onboarding wizard to restart." });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/sessions"] });
    },
    onError: (e: any) => toast({ title: "Reset Failed", description: e?.message ?? "Unknown error", variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950">
        <UserX className="h-4 w-4" />
        Reset My KYC
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <UserX className="h-5 w-5" /> Reset Your Own KYC
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>This will fully reset <strong>your own</strong> KYC status:</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>All verification flags cleared (PAN, Aadhaar, CKYC, Video KYC)</li>
                <li>Your KYC level drops to 0 — you must restart the wizard</li>
                <li>Bank account verification is reset (penny-drop required again)</li>
                <li>Your active KYC sessions are closed</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                You will still have full admin portal access. Use this to re-verify your identity with fresh credentials.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selfReset.mutate()} disabled={selfReset.isPending}>
              {selfReset.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />}
              Yes, Reset My KYC
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Regulatory Compliance Matrix Tab ────────────────────────────────────────

const REGULATORY_MATRIX = [
  {
    category: 'Internal Staff',
    roles: ['superadmin', 'admin', 'bd_head', 'compliance_officer', 'finance_head', 'ops_head', 'hr_head', 'tech_head', 'regulatory_auditor', 'bd_team', 'compliance_team', 'finance_team', 'ops_team', 'hr_team', 'tech_backend', 'tech_frontend', 'tech_devops'],
    portalAccess: 'Level 0 — Always unrestricted',
    transactionAccess: 'N/A (admin portal)',
    regulatoryBasis: 'Platform operators — portal access is not a regulated activity. Personal KYC is required by PMLA §12 before handling client money personally.',
    complianceNote: 'FintekPro employees should complete personal KYC (recommended Level 1 minimum) for internal compliance, but this is NOT enforced as a portal gate.',
    statusColor: 'green',
  },
  {
    category: 'External Agents',
    roles: ['agent', 'sub_agent', 'associate', 'partner_ops'],
    portalAccess: 'Level 1 required for portal access',
    transactionAccess: 'Level 1 minimum before advisory activity',
    regulatoryBasis: 'AMFI Circular CIR/ARN/002/2025 — All AMFI-registered agents and sub-agents must complete Standard KYC (PAN + Address OVD + Photograph) before distributing mutual funds or advising clients.',
    complianceNote: 'Agent portal access is gated at Level 1. Agents without KYC cannot view client portfolios or place orders on behalf of clients.',
    statusColor: 'blue',
  },
  {
    category: 'Distribution Partners',
    roles: ['partner'],
    portalAccess: 'Level 1 required for portal access',
    transactionAccess: 'Level 1 for standard activities; Level 2 recommended for ARN anchor',
    regulatoryBasis: 'SEBI (KYC Registration Agency) Regulations 2011 — Distribution partners and ARN holders must be KYC-registered. AMFI Circular mandates Full KYC (Level 2) for ARN master holders.',
    complianceNote: 'Partners are gated at Level 1 for portal access. Level 2 (Video KYC + Bank verification) is recommended for full compliance as an ARN anchor.',
    statusColor: 'purple',
  },
  {
    category: 'Retail Clients & Users',
    roles: ['client', 'user'],
    portalAccess: 'Level 0 — Can explore platform freely',
    transactionAccess: 'Level 1 required before placing any order, investment, or payment',
    regulatoryBasis: 'RBI Master Direction on KYC 2016, Part B, Chapter II — Minimum Standard KYC (PAN + Address + Photograph) mandatory before conducting any financial transaction. PMLA §12 — Reporting entities must obtain KYC before allowing financial activity.',
    complianceNote: 'Transaction-only gate: clients can browse all products, research, and view market data without KYC. The moment they attempt to invest or pay, Level 1 KYC is enforced automatically.',
    statusColor: 'yellow',
  },
  {
    category: 'Business Clients',
    roles: ['business_client'],
    portalAccess: 'Level 0 — Can explore platform freely',
    transactionAccess: 'Level 1 required; Level 2 recommended for high-value transactions',
    regulatoryBasis: 'RBI Master Direction on KYC 2016 — Business entities require entity KYC (PAN + CIN/LLPIN + authorized signatory KYC). PMLA §11A — Enhanced Due Diligence for business clients.',
    complianceNote: 'Business clients follow the same explore-then-transact gate as retail clients. Full KYC (Level 2) is recommended before allowing large-value transactions.',
    statusColor: 'orange',
  },
];

function RegulatoryMatrixTab() {
  const colorMap: Record<string, string> = {
    green: 'border-green-400 bg-green-50 dark:bg-green-950 dark:border-green-700',
    blue: 'border-blue-400 bg-blue-50 dark:bg-blue-950 dark:border-blue-700',
    purple: 'border-purple-400 bg-purple-50 dark:bg-purple-950 dark:border-purple-700',
    yellow: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700',
    orange: 'border-orange-400 bg-orange-50 dark:bg-orange-950 dark:border-orange-700',
  };
  const badgeMap: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5" />Regulatory KYC Requirements by Role</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Per PMLA 2002, RBI Master Direction on KYC 2016, SEBI KRA Regulations, and AMFI Circulars.
          FintekPro enforces KYC at the transaction level for clients and at the portal-access level for distribution partners and agents.
        </p>
      </div>

      <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950">
        <LucideShield className="h-4 w-4" />
        <AlertTitle>Compliance Architecture</AlertTitle>
        <AlertDescription className="text-sm mt-1">
          <strong>Two-tier gate:</strong> Admin portal is always fully accessible to internal staff (no KYC gate).
          External agents and partners are gated at portal login (Level 1).
          Clients are gated only at transaction time (Level 1) — they can browse freely without KYC.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {REGULATORY_MATRIX.map((row) => (
          <Card key={row.category} className={`border-l-4 ${colorMap[row.statusColor]}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <CardTitle className="text-base">{row.category}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  {row.roles.map(r => (
                    <Badge key={r} className={`text-xs font-mono ${badgeMap[row.statusColor]}`}>{r}</Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Portal Access Gate</p>
                  <p>{row.portalAccess}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Transaction Gate</p>
                  <p>{row.transactionAccess}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Regulatory Basis</p>
                <p className="text-muted-foreground text-xs">{row.regulatoryBasis}</p>
              </div>
              <div className="rounded-md bg-background/60 border px-3 py-2">
                <p className="text-xs font-semibold mb-0.5">FintekPro Implementation</p>
                <p className="text-xs text-muted-foreground">{row.complianceNote}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Level Definitions</AlertTitle>
        <AlertDescription className="text-sm mt-1">
          <ul className="space-y-1">
            <li><strong>Level 0:</strong> Registered user — no verification required</li>
            <li><strong>Level 1 (Standard KYC):</strong> PAN verified (Sandbox.co.in) + Address OVD via CKYC/KRA + Profile completed — satisfies RBI/PMLA minimum</li>
            <li><strong>Level 2 (Full KYC):</strong> Level 1 + CKYC/KRA registration + Video KYC (V-CIP) or In-Person Verification + Bank penny-drop verified — satisfies SEBI/AMFI requirements for investment products</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ─── V-CIP Expiry Tab ─────────────────────────────────────────────────────────

type VcipRecord = {
  userId: string;
  videoKycExpiryDate: string;
  videoKycCompletedDate: string | null;
  videoKycStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  expiryStatus: 'expired' | 'critical' | 'warning' | 'ok';
};

function expiryStatusBadge(status: VcipRecord['expiryStatus']) {
  if (status === 'expired') return <Badge variant="destructive">Expired</Badge>;
  if (status === 'critical') return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Critical (&lt;30d)</Badge>;
  if (status === 'warning') return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Expiring Soon</Badge>;
  return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OK</Badge>;
}

function VcipExpiryTab() {
  const { data, refetch } = useSuspenseQuery<{ success: boolean; records: VcipRecord[]; total: number }>({
    queryKey: ["/api/admin/kyc/vcip-expiry"],
    queryFn: async () => {
      const r = await fetch("/api/admin/kyc/vcip-expiry");
      if (!r.ok) throw new Error("Failed to load V-CIP expiry data");
      return r.json();
    },
  });

  const records = data?.records ?? [];
  const expired = records.filter(r => r.expiryStatus === 'expired').length;
  const critical = records.filter(r => r.expiryStatus === 'critical').length;
  const warning = records.filter(r => r.expiryStatus === 'warning').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              V-CIP Expiry Overview
            </CardTitle>
            <CardDescription>
              Video KYC expiry status for all users — per RBI 2023 V-CIP guidelines
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />Refresh
          </Button>
        </div>
        <div className="flex gap-3 flex-wrap mt-2">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block" />
            <span className="text-muted-foreground">Expired:</span>
            <span className="font-semibold">{expired}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" />
            <span className="text-muted-foreground">Critical (&lt;30d):</span>
            <span className="font-semibold">{critical}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="text-muted-foreground">Warning (&lt;6mo):</span>
            <span className="font-semibold">{warning}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-green-400 inline-block" />
            <span className="text-muted-foreground">Valid:</span>
            <span className="font-semibold">{records.length - expired - critical - warning}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {records.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No V-CIP records found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email / Mobile</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.userId} className={r.expiryStatus === 'expired' ? 'bg-red-50 dark:bg-red-950/30' : r.expiryStatus === 'critical' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                  <TableCell className="font-medium">
                    {[r.firstName, r.lastName].filter(Boolean).join(' ') || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{r.email || '—'}</div>
                    <div className="text-xs text-muted-foreground">{r.mobile || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.videoKycCompletedDate ? format(new Date(r.videoKycCompletedDate), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {format(new Date(r.videoKycExpiryDate), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>{expiryStatusBadge(r.expiryStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── All KYC Sessions Tab ─────────────────────────────────────────────────────

function AllKycSessionsTab() {
  const { toast } = useToast();
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const { data, refetch } = useSuspenseQuery<{ success: boolean; sessions: any[]; total: number }>({
    queryKey: ["/api/admin/kyc/sessions", outcomeFilter],
    queryFn: async () => {
      const param = outcomeFilter !== "all" ? `?outcome=${outcomeFilter}` : "";
      const r = await fetch(`/api/admin/kyc/sessions${param}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const resetAll = useMutation({
    mutationFn: () => apiRequest("/api/admin/kyc/reset", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast({ title: "KYC Reset Complete", description: "All user KYC has been reset. Users must redo KYC." });
      setConfirmResetAll(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/sessions"] });
    },
    onError: (e: any) => toast({ title: "Reset Failed", description: e.message, variant: "destructive" }),
  });

  const resetOne = useMutation({
    mutationFn: (userId: string) => apiRequest("/api/admin/kyc/reset", { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: () => {
      toast({ title: "KYC Reset", description: "User KYC has been reset." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc/sessions"] });
    },
  });

  const sessions = data?.sessions ?? [];

  function stepBadge(step: string | null) {
    if (!step) return <Badge variant="secondary">—</Badge>;
    const color =
      step === "completed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
      step === "pan_verification" ? "bg-blue-100 text-blue-800" :
      step === "aadhaar_otp" ? "bg-purple-100 text-purple-800" :
      "bg-gray-100 text-gray-700";
    return <Badge className={color}>{step.replace(/_/g, " ")}</Badge>;
  }

  function outcomeBadge(outcome: string | null) {
    if (!outcome) return <Badge variant="outline" className="text-yellow-700 border-yellow-400">In Progress</Badge>;
    if (outcome === "reset_by_admin") return <Badge variant="outline" className="text-orange-700 border-orange-400">Reset</Badge>;
    if (outcome === "completed") return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    if (outcome === "failed") return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    return <Badge variant="secondary">{outcome}</Badge>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />All KYC Sessions</CardTitle>
            <CardDescription>Every KYC verification session across all users — {sessions.length} sessions</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sessions</SelectItem>
                <SelectItem value="null">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reset_by_admin">Admin Reset</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmResetAll(true)}>
              <RotateCcw className="h-4 w-4 mr-1" />Reset All KYC
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sessions.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No KYC sessions found</p>
            <p className="text-sm mt-1">Users will appear here once they start the KYC process</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Current Step</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>PAN</TableHead>
                <TableHead>Aadhaar OTP</TableHead>
                <TableHead>AML Risk</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s: any) => (
                <TableRow key={s.sessionId}>
                  <TableCell>
                    <div className="font-medium text-sm">{s.email || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.firstName || s.lastName ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : s.userId?.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell>{stepBadge(s.currentStep)}</TableCell>
                  <TableCell>{outcomeBadge(s.sessionOutcome)}</TableCell>
                  <TableCell>
                    {s.panVerified
                      ? <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    {s.aadhaarOtpVerified
                      ? <Badge className="bg-green-100 text-green-800 text-xs">Verified</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    {s.amlRiskLevel
                      ? <Badge className={s.amlRiskLevel === "HIGH" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"} >{s.amlRiskLevel}</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.startedAt ? new Date(s.startedAt).toLocaleDateString("en-IN") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resetOne.mutate(s.userId)}
                      disabled={resetOne.isPending}
                      title="Reset this user's KYC"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Reset
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={confirmResetAll} onOpenChange={setConfirmResetAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset KYC for All Users?</DialogTitle>
            <DialogDescription>
              This will clear KYC status and expire all KYC sessions for every non-admin user. All users will have to redo their KYC. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResetAll(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => resetAll.mutate()} disabled={resetAll.isPending}>
              {resetAll.isPending ? "Resetting…" : "Yes, Reset All KYC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function KycV2ManagementPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LucideShield className="h-6 w-6" />
            KYC Admin Management
          </h1>
          <p className="text-muted-foreground">Comprehensive KYC operations, approvals, and monitoring</p>
        </div>
        <SelfResetCard />
      </div>

      <EnvironmentBanner />
      <Suspense fallback={<Skeleton className="h-10 w-full mb-2" />}>
        <ProviderHealthStrip />
      </Suspense>

      <Tabs defaultValue="all-sessions" className="space-y-4">
        <TabsList className="grid grid-cols-6 md:grid-cols-11 w-full">
          <TabsTrigger value="all-sessions" className="text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 hidden sm:inline" />
            All Sessions
          </TabsTrigger>
          <TabsTrigger value="video-kyc" className="text-xs sm:text-sm">
            <Video className="h-4 w-4 mr-1 hidden sm:inline" />
            Video KYC
          </TabsTrigger>
          <TabsTrigger value="vcip-expiry" className="text-xs sm:text-sm">
            <CalendarClock className="h-4 w-4 mr-1 hidden sm:inline" />
            V-CIP Expiry
          </TabsTrigger>
          <TabsTrigger value="maker-checker" className="text-xs sm:text-sm">
            <Users className="h-4 w-4 mr-1 hidden sm:inline" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="direct-reject" className="text-xs sm:text-sm">
            <Ban className="h-4 w-4 mr-1 hidden sm:inline" />
            Reject
          </TabsTrigger>
          <TabsTrigger value="rejections" className="text-xs sm:text-sm">
            <AlertTriangle className="h-4 w-4 mr-1 hidden sm:inline" />
            Disputes
          </TabsTrigger>
          <TabsTrigger value="audit-pack" className="text-xs sm:text-sm">
            <Package className="h-4 w-4 mr-1 hidden sm:inline" />
            Audit Pack
          </TabsTrigger>
          <TabsTrigger value="webhook-dlq" className="text-xs sm:text-sm">
            <Activity className="h-4 w-4 mr-1 hidden sm:inline" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="environment" className="text-xs sm:text-sm">
            <Server className="h-4 w-4 mr-1 hidden sm:inline" />
            Environment
          </TabsTrigger>
          <TabsTrigger value="step-resets" className="text-xs sm:text-sm">
            <RotateCcw className="h-4 w-4 mr-1 hidden sm:inline" />
            Step Resets
          </TabsTrigger>
          <TabsTrigger value="compliance-matrix" className="text-xs sm:text-sm">
            <BookOpen className="h-4 w-4 mr-1 hidden sm:inline" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all-sessions">
          <Suspense fallback={<LoadingState variant="section-table" count={6} />}>
            <AllKycSessionsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="video-kyc">
          <VideoKycTab />
        </TabsContent>

        <TabsContent value="vcip-expiry">
          <Suspense fallback={<LoadingState variant="section-table" count={5} />}>
            <VcipExpiryTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="maker-checker">
          <MakerCheckerTab />
        </TabsContent>

        <TabsContent value="direct-reject">
          <DirectRejectTab />
        </TabsContent>

        <TabsContent value="rejections">
          <RejectionsDisputesTab />
        </TabsContent>

        <TabsContent value="audit-pack">
          <AuditPackTab />
        </TabsContent>

        <TabsContent value="webhook-dlq">
          <WebhookDlqTab />
        </TabsContent>

        <TabsContent value="environment">
          <EnvironmentStatusTab />
        </TabsContent>

        <TabsContent value="step-resets">
          <StepResetTab />
        </TabsContent>

        <TabsContent value="compliance-matrix">
          <Suspense fallback={<LoadingState variant="section-table" count={5} />}>
            <RegulatoryMatrixTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
