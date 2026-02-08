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

  const userId = user?.id;
  const isAgent = user?.role === "agent";

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

      {isAgent && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Agent View</AlertTitle>
          <AlertDescription>
            You are viewing this in read-only mode. Only the customer can re-submit KYC or file disputes.
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
