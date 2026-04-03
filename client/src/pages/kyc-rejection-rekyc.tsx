import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertCircle,
  RefreshCcw,
  FileWarning,
  MessageSquareWarning,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileText,
  ArrowRight,
  Ban,
  Info,
} from "lucide-react";

interface Rejection {
  id: number;
  sessionId: string;
  userId: number;
  reasonCode: string;
  reasonDescription: string;
  rejectedBy: string;
  rejectedByRole: string;
  rekycRequired: boolean;
  newSessionId: string | null;
  disputeNotes: string | null;
  disputeStatus: string | null;
  rejectedAt: string;
}

const REASON_CODE_COLORS: Record<string, string> = {
  DOCUMENT_MISMATCH: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  IDENTITY_VERIFICATION_FAILED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  INCOMPLETE_DOCUMENTS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  SUSPICIOUS_ACTIVITY: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-100",
  ADDRESS_MISMATCH: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  EXPIRED_DOCUMENTS: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  PAN_MISMATCH: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  PHOTO_MISMATCH: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
};

const DISPUTE_STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  FILED: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: FileText },
  UNDER_REVIEW: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
  RESOLVED: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle2 },
  DISMISSED: { color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: XCircle },
};

function getReasonBadgeClass(code: string) {
  return REASON_CODE_COLORS[code] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
}

export default function KycRejectionRekyc() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeRejectionId, setDisputeRejectionId] = useState<number | null>(null);
  const [disputeNotes, setDisputeNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [agentRejectReasonCode, setAgentRejectReasonCode] = useState("");
  const [agentRejectNotes, setAgentRejectNotes] = useState("");
  const [agentRequireReKyc, setAgentRequireReKyc] = useState(true);

  const isAgent = user?.role === "agent";

  const params = new URLSearchParams(window.location.search);
  const clientUserId = isAgent ? (params.get("userId") || undefined) : undefined;

  const userId = clientUserId || user?.id;

  const { data: rejectionsData, isLoading: rejectionsLoading } = useQuery<{
    success: boolean;
    rejections: Rejection[];
  }>({
    queryKey: ["/api/kyc/rejections/user", userId],
    enabled: !!userId,
  });

  const { data: reasonsData } = useQuery<{
    success: boolean;
    reasons: Record<string, string>;
  }>({
    queryKey: ["/api/kyc/rejection-reasons"],
    enabled: !!userId,
  });

  const { data: activeSessionData, isLoading: activeSessionLoading } = useQuery<{
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
    queryKey: ["/api/kyc/active-session", clientUserId],
    enabled: isAgent && !!clientUserId,
  });

  const agentRejectMutation = useMutation({
    mutationFn: async (params: { sessionId: string; userId: string; reasonCode: string; notes: string; requireReKyc: boolean }) => {
      return await apiRequest("/api/kyc/reject", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      toast({ title: "KYC rejected", description: "The client's KYC session has been deactivated." });
      setRejectDialogOpen(false);
      setAgentRejectReasonCode("");
      setAgentRejectNotes("");
      setAgentRequireReKyc(true);
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/rejections/user", userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/active-session", clientUserId] });
    },
    onError: (error: any) => {
      toast({ title: "Rejection failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleAgentReject = () => {
    const session = activeSessionData?.session;
    if (!session || !clientUserId) return;
    if (!agentRejectReasonCode) {
      toast({ title: "Reason required", description: "Please select a rejection reason.", variant: "destructive" });
      return;
    }
    if (agentRejectNotes.trim().length < 10) {
      toast({ title: "Notes too short", description: "Notes must be at least 10 characters.", variant: "destructive" });
      return;
    }
    agentRejectMutation.mutate({
      sessionId: session.sessionId,
      userId: clientUserId,
      reasonCode: agentRejectReasonCode,
      notes: agentRejectNotes.trim(),
      requireReKyc: agentRequireReKyc,
    });
  };

  const resubmitMutation = useMutation({
    mutationFn: async (oldSessionId: string) => {
      return await apiRequest("/api/kyc/resubmit", {
        method: "POST",
        body: JSON.stringify({ oldSessionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/rejections/user", userId] });
      toast({ title: "New KYC session created", description: "Redirecting to onboarding..." });
      setLocation("/onboarding");
    },
    onError: (error: any) => {
      toast({ title: "Re-submit failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ rejectionId, disputeNotes }: { rejectionId: number; disputeNotes: string }) => {
      return await apiRequest("/api/kyc/dispute", {
        method: "POST",
        body: JSON.stringify({ rejectionId, disputeNotes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc/rejections/user", userId] });
      toast({ title: "Dispute filed", description: "Your dispute has been submitted for review." });
      setDisputeDialogOpen(false);
      setDisputeNotes("");
      setDisputeRejectionId(null);
    },
    onError: (error: any) => {
      toast({ title: "Dispute failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  const rejections = rejectionsData?.rejections || [];
  const reasons = reasonsData?.reasons || {};

  const sessionGroups = rejections.reduce<Record<string, Rejection[]>>((acc, r) => {
    if (!acc[r.sessionId]) acc[r.sessionId] = [];
    acc[r.sessionId].push(r);
    return acc;
  }, {});

  const sortedSessionIds = Object.keys(sessionGroups).sort((a, b) => {
    const aDate = new Date(sessionGroups[a][0].rejectedAt).getTime();
    const bDate = new Date(sessionGroups[b][0].rejectedAt).getTime();
    return bDate - aDate;
  });

  if (rejectionsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">KYC Rejections</h1>
          <p className="text-muted-foreground">
            {isAgent
              ? "View KYC rejection history for this client."
              : "Review your KYC rejection reasons and take action."}
          </p>
        </div>
      </div>

      {isAgent && clientUserId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Client's Active KYC Session
            </CardTitle>
            <CardDescription>
              You can reject the client's active session if verification cannot proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSessionLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : !activeSessionData?.session ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>No active session</AlertTitle>
                <AlertDescription>This client has no KYC session currently in progress.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Session</span>
                    <span className="font-mono">{activeSessionData.session.sessionId.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Step</span>
                    <span>{activeSessionData.session.currentStep}</span>
                  </div>
                  {activeSessionData.session.entityType && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entity Type</span>
                      <span>{activeSessionData.session.entityType}</span>
                    </div>
                  )}
                  {activeSessionData.session.panMasked && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PAN</span>
                      <span className="font-mono">{activeSessionData.session.panMasked}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span>{new Date(activeSessionData.session.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setAgentRejectReasonCode("");
                    setAgentRejectNotes("");
                    setAgentRequireReKyc(true);
                    setRejectDialogOpen(true);
                  }}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Reject This KYC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAgent && !clientUserId && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Agent View</AlertTitle>
          <AlertDescription>
            To view or reject a client's KYC, navigate here with a <code>?userId=</code> parameter. You can reject an active session; only the client can file disputes or re-submit KYC.
          </AlertDescription>
        </Alert>
      )}

      {rejections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Rejections Found</h2>
            <p className="text-muted-foreground max-w-md">
              Your KYC verification has no rejection records. If you have a pending verification, please check your onboarding status.
            </p>
            {!isAgent && (
              <Button variant="outline" className="mt-4" onClick={() => setLocation("/onboarding")}>
                Go to Onboarding <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedSessionIds.map((sessionId, sessionIndex) => {
            const sessionRejections = sessionGroups[sessionId].sort(
              (a, b) => new Date(b.rejectedAt).getTime() - new Date(a.rejectedAt).getTime()
            );
            const latestRejection = sessionRejections[0];
            const canResubmit = latestRejection.rekycRequired && !latestRejection.newSessionId;

            return (
              <Card key={sessionId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileWarning className="h-5 w-5 text-destructive" />
                        Session {sessionId.slice(0, 8)}...
                      </CardTitle>
                      <CardDescription>
                        {sessionRejections.length} rejection{sessionRejections.length > 1 ? "s" : ""} recorded
                      </CardDescription>
                    </div>
                    {!isAgent && canResubmit && (
                      <Button
                        onClick={() => resubmitMutation.mutate(sessionId)}
                        disabled={resubmitMutation.isPending}
                      >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {resubmitMutation.isPending ? "Creating..." : "Re-submit KYC"}
                      </Button>
                    )}
                    {latestRejection.newSessionId && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Re-submitted
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative border-l-2 border-muted-foreground/20 ml-4 space-y-6">
                    {sessionRejections.map((rejection) => {
                      const reasonDesc =
                        rejection.reasonDescription ||
                        reasons[rejection.reasonCode] ||
                        "No description available.";
                      const disputeConfig = rejection.disputeStatus
                        ? DISPUTE_STATUS_CONFIG[rejection.disputeStatus]
                        : null;
                      const DisputeIcon = disputeConfig?.icon || FileText;

                      return (
                        <div key={rejection.id} className="relative pl-8">
                          <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-destructive border-2 border-background" />

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={getReasonBadgeClass(rejection.reasonCode)}>
                                {rejection.reasonCode.replace(/_/g, " ")}
                              </Badge>
                              {rejection.disputeStatus && disputeConfig && (
                                <Badge className={disputeConfig.color}>
                                  <DisputeIcon className="mr-1 h-3 w-3" />
                                  Dispute: {rejection.disputeStatus.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm">{reasonDesc}</p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(rejection.rejectedAt).toLocaleString()}
                              </span>
                              <span>
                                Rejected by: <strong>{rejection.rejectedBy || "System"}</strong>{" "}
                                ({rejection.rejectedByRole || "auto"})
                              </span>
                            </div>

                            {rejection.disputeNotes && (
                              <Alert variant="default" className="mt-2">
                                <MessageSquareWarning className="h-4 w-4" />
                                <AlertTitle className="text-sm">Dispute Notes</AlertTitle>
                                <AlertDescription className="text-xs">
                                  {rejection.disputeNotes}
                                </AlertDescription>
                              </Alert>
                            )}

                            {!isAgent && !rejection.disputeStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1"
                                onClick={() => {
                                  setDisputeRejectionId(rejection.id);
                                  setDisputeNotes("");
                                  setDisputeDialogOpen(true);
                                }}
                              >
                                <Ban className="mr-1 h-3 w-3" />
                                File Dispute
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Reject Client KYC
            </DialogTitle>
            <DialogDescription>
              This will immediately deactivate the client's active session. The client will need to restart verification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                This action is irreversible. The rejection will be logged in the audit trail.
              </AlertDescription>
            </Alert>

            <div className="space-y-1">
              <label className="text-sm font-medium">Rejection Reason <span className="text-destructive">*</span></label>
              <select
                value={agentRejectReasonCode}
                onChange={e => setAgentRejectReasonCode(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select a reason...</option>
                {Object.entries(reasonsData?.reasons || {}).map(([code, desc]) => (
                  <option key={code} value={code}>{code} — {String(desc)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Notes <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="Enter reviewer notes (min 10 characters)..."
                value={agentRejectNotes}
                onChange={e => setAgentRejectNotes(e.target.value)}
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
                aria-checked={agentRequireReKyc}
                onClick={() => setAgentRequireReKyc(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${agentRequireReKyc ? "bg-destructive" : "bg-muted"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${agentRequireReKyc ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleAgentReject}
              disabled={agentRejectMutation.isPending}
            >
              {agentRejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              File a Dispute
            </DialogTitle>
            <DialogDescription>
              Provide details explaining why you believe this rejection was incorrect. Our compliance team will review your dispute.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe your reason for disputing this rejection..."
            value={disputeNotes}
            onChange={(e) => setDisputeNotes(e.target.value)}
            rows={5}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (disputeRejectionId && disputeNotes.trim()) {
                  disputeMutation.mutate({ rejectionId: disputeRejectionId, disputeNotes: disputeNotes.trim() });
                }
              }}
              disabled={!disputeNotes.trim() || disputeMutation.isPending}
            >
              {disputeMutation.isPending ? "Submitting..." : "Submit Dispute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
