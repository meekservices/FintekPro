import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import { 
  IndianRupee, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  TrendingUp,
  Receipt,
  RefreshCw,
  CalendarDays,
  Building2,
  User,
  Eye,
  Check,
  X,
  CreditCard,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";

interface PayoutClaim {
  id: string;
  claimNumber: string;
  applicationId: string;
  applicationNumber: string;
  agentId: string;
  agentName?: string;
  agentEmail?: string;
  applicantName: string;
  loanType: string;
  disbursedAmount?: string;
  claimAmount: string;
  status: string;
  invoiceNumber?: string;
  remarks?: string;
  adminRemarks?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  zohoInvoiceId?: string;
  paymentDate?: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
}

interface PayoutStats {
  totalPending: number;
  pendingAmount: string;
  totalApproved: number;
  approvedAmount: string;
  totalPaid: number;
  paidAmount: string;
  totalRejected: number;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-emerald-100 text-emerald-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending Review",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const loanTypeLabels: Record<string, string> = {
  personal: "Personal Loan",
  home: "Home Loan",
  car: "Car Loan",
  business: "Business Loan",
  education: "Education Loan",
  gold: "Gold Loan",
  lap: "Loan Against Property",
};

export default function AdminAgentPayoutsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<PayoutClaim | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: claimsData, isLoading: loadingClaims, refetch: refetchClaims } = useQuery<{ success: boolean; data: PayoutClaim[] }>({
    queryKey: ["/api/admin/agent-payouts/payout-claims", statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/agent-payouts/payout-claims?status=${statusFilter}`);
      if (!response.ok) throw new Error("Failed to fetch claims");
      return response.json();
    },
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<{ success: boolean; data: PayoutStats }>({
    queryKey: ["/api/admin/agent-payouts/stats"],
  });

  const claims = claimsData?.data || [];
  const stats = statsData?.data;

  const reviewMutation = useMutation({
    mutationFn: async ({ claimId, action, remarks }: { claimId: string; action: "approve" | "reject"; remarks?: string }) => {
      return apiRequest(`/api/admin/agent-payouts/payout-claims/${claimId}/review`, {
        method: "POST",
        body: JSON.stringify({ 
          action, 
          reviewRemarks: action === "approve" ? remarks : undefined,
          rejectionReason: action === "reject" ? remarks : undefined,
        }),
      });
    },
    onSuccess: () => {
      toast({ 
        title: actionType === "approve" ? "Claim Approved" : "Claim Rejected", 
        description: actionType === "approve" 
          ? "The payout claim has been approved." 
          : "The payout claim has been rejected."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-payouts/payout-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-payouts/stats"] });
      setActionDialogOpen(false);
      setSelectedClaim(null);
      setAdminRemarks("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to process claim", variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ claimId, paymentReference }: { claimId: string; paymentReference?: string }) => {
      return apiRequest(`/api/admin/agent-payouts/payout-claims/${claimId}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({ 
          paymentReference: paymentReference || `PAY-${Date.now()}`,
          paymentDate: new Date().toISOString(),
          paymentMode: "bank_transfer",
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Payment Recorded", description: "The payout has been marked as paid." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-payouts/payout-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agent-payouts/stats"] });
      setPayDialogOpen(false);
      setSelectedClaim(null);
      setPaymentReference("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to mark as paid", variant: "destructive" });
    },
  });

  const handleAction = (claim: PayoutClaim, action: "approve" | "reject") => {
    setSelectedClaim(claim);
    setActionType(action);
    setActionDialogOpen(true);
  };

  const handleMarkPaid = (claim: PayoutClaim) => {
    setSelectedClaim(claim);
    setPayDialogOpen(true);
  };

  const submitAction = () => {
    if (!selectedClaim) return;
    reviewMutation.mutate({
      claimId: selectedClaim.id,
      action: actionType,
      remarks: adminRemarks || undefined,
    });
  };

  const submitPayment = () => {
    if (!selectedClaim) return;
    markPaidMutation.mutate({
      claimId: selectedClaim.id,
      paymentReference: paymentReference || undefined,
    });
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Agent Payout Management</h1>
          <p className="text-muted-foreground">Review and process agent commission payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Claims</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetchClaims()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</div>
              <p className="text-xs text-muted-foreground">{stats.totalPending} claims pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Approved (Pending Payment)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.approvedAmount)}</div>
              <p className="text-xs text-muted-foreground">{stats.totalApproved} claims approved</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.paidAmount)}</div>
              <p className="text-xs text-muted-foreground">{stats.totalPaid} claims paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.totalRejected}</div>
              <p className="text-xs text-muted-foreground">Claims rejected</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payout Claims
          </CardTitle>
          <CardDescription>Review and process agent commission claims</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingClaims ? (
            <LoadingState variant="list" count={3} />
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No claims found</p>
              <p className="text-sm">No payout claims match the selected filter</p>
            </div>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => (
                <div key={claim.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{claim.claimNumber}</span>
                        <Badge className={statusColors[claim.status]}>
                          {statusLabels[claim.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {claim.agentName || claim.agentEmail || "Agent"}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {claim.applicationNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {format(new Date(claim.createdAt), "dd MMM yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>{claim.applicantName}</span>
                        <span className="text-muted-foreground">|</span>
                        <span>{loanTypeLabels[claim.loanType] || claim.loanType}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Disbursed:</span>
                          <span className="font-medium ml-1">{formatCurrency(claim.disbursedAmount || '0')}</span>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Claim:</span>
                          <span className="font-semibold text-green-600 ml-1">{formatCurrency(claim.claimAmount)}</span>
                        </div>
                      </div>
                      {claim.invoiceNumber && (
                        <p className="text-sm text-muted-foreground">Invoice: {claim.invoiceNumber}</p>
                      )}
                      {claim.remarks && (
                        <p className="text-sm text-muted-foreground">Agent Notes: {claim.remarks}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => { setSelectedClaim(claim); setDetailsDialogOpen(true); }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {claim.status === "pending" && (
                        <>
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => handleAction(claim, "approve")}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleAction(claim, "reject")}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      {claim.status === "approved" && (
                        <Button 
                          size="sm"
                          onClick={() => handleMarkPaid(claim)}
                        >
                          <CreditCard className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Claim Number</Label>
                  <p className="font-medium">{selectedClaim.claimNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge className={statusColors[selectedClaim.status]}>
                    {statusLabels[selectedClaim.status]}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Agent</Label>
                  <p className="font-medium">{selectedClaim.agentName || selectedClaim.agentEmail}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Application</Label>
                  <p className="font-medium">{selectedClaim.applicationNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Applicant</Label>
                  <p className="font-medium">{selectedClaim.applicantName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Loan Type</Label>
                  <p className="font-medium">{loanTypeLabels[selectedClaim.loanType] || selectedClaim.loanType}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Disbursed Amount</Label>
                  <p className="font-medium">{formatCurrency(selectedClaim.disbursedAmount || '0')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Claim Amount</Label>
                  <p className="font-bold text-green-600">{formatCurrency(selectedClaim.claimAmount)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p className="font-medium">{format(new Date(selectedClaim.createdAt), "dd MMM yyyy HH:mm")}</p>
                </div>
                {selectedClaim.invoiceNumber && (
                  <div>
                    <Label className="text-muted-foreground">Invoice Number</Label>
                    <p className="font-medium">{selectedClaim.invoiceNumber}</p>
                  </div>
                )}
              </div>
              {selectedClaim.remarks && (
                <div>
                  <Label className="text-muted-foreground">Agent Remarks</Label>
                  <p className="bg-muted p-2 rounded mt-1">{selectedClaim.remarks}</p>
                </div>
              )}
              {selectedClaim.adminRemarks && (
                <div>
                  <Label className="text-muted-foreground">Admin Remarks</Label>
                  <p className="bg-muted p-2 rounded mt-1">{selectedClaim.adminRemarks}</p>
                </div>
              )}
              {selectedClaim.paymentDate && (
                <div>
                  <Label className="text-muted-foreground">Payment Details</Label>
                  <p className="font-medium text-emerald-600">
                    Paid on {format(new Date(selectedClaim.paymentDate), "dd MMM yyyy")}
                    {selectedClaim.paymentReference && ` (Ref: ${selectedClaim.paymentReference})`}
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Payout Claim" : "Reject Payout Claim"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" 
                ? "Confirm approval of this payout claim"
                : "Provide a reason for rejecting this claim"
              }
            </DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim</span>
                  <span className="font-medium">{selectedClaim.claimNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium">{selectedClaim.agentName || selectedClaim.agentEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedClaim.claimAmount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks {actionType === "reject" && "*"}</Label>
                <Textarea
                  placeholder={actionType === "approve" ? "Optional notes..." : "Please provide a reason for rejection..."}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={submitAction} 
              disabled={reviewMutation.isPending || (actionType === "reject" && !adminRemarks.trim())}
            >
              {reviewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === "approve" ? <Check className="h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                  {actionType === "approve" ? "Approve" : "Reject"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>Record the payment for this payout claim</DialogDescription>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim</span>
                  <span className="font-medium">{selectedClaim.claimNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium">{selectedClaim.agentName || selectedClaim.agentEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-lg text-green-600">{formatCurrency(selectedClaim.claimAmount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Reference (Optional)</Label>
                <Input
                  placeholder="e.g., UTR number, transaction ID..."
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Mark as Paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
