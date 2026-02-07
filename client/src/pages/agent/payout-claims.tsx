import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Send,
  RefreshCw,
  CalendarDays,
  Building2,
  User
} from "lucide-react";
import { format } from "date-fns";

interface PayoutClaim {
  id: string;
  claimNumber: string;
  applicationId: string;
  applicationNumber: string;
  agentId: string;
  applicantName: string;
  loanType: string;
  disbursedAmount?: string;
  claimAmount: string;
  status: string;
  invoiceNumber?: string;
  remarks?: string;
  adminRemarks?: string;
  zohoInvoiceId?: string;
  paymentDate?: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
}

interface DisbursedLoan {
  id: string;
  applicationNumber: string;
  applicantName: string;
  loanType: string;
  disbursedAmount?: string;
  bankCode: string;
  bankName: string;
  disbursedAt: string;
  hasClaim: boolean;
  claimStatus?: string;
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

export default function AgentPayoutClaimsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("disbursed");
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<DisbursedLoan | null>(null);
  const [claimRemarks, setClaimRemarks] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const { data: disbursedLoansData, isLoading: loadingDisbursed, refetch: refetchDisbursed } = useQuery<{ success: boolean; data: DisbursedLoan[] }>({
    queryKey: ["/api/agent/loans/disbursed"],
  });

  const { data: myClaimsData, isLoading: loadingClaims, refetch: refetchClaims } = useQuery<{ success: boolean; data: PayoutClaim[] }>({
    queryKey: ["/api/agent/loans/my-payout-claims"],
  });

  const disbursedLoans = disbursedLoansData?.data || [];
  const myClaims = myClaimsData?.data || [];

  const pendingClaims = myClaims.filter(c => c.status === "pending" || c.status === "under_review");
  const approvedClaims = myClaims.filter(c => c.status === "approved" || c.status === "paid");
  const rejectedClaims = myClaims.filter(c => c.status === "rejected");

  const totalPending = pendingClaims.reduce((sum, c) => sum + parseFloat(c.claimAmount), 0);
  const totalApproved = approvedClaims.reduce((sum, c) => sum + parseFloat(c.claimAmount), 0);
  const totalPaid = myClaims.filter(c => c.status === "paid").reduce((sum, c) => sum + parseFloat(c.claimAmount), 0);

  const claimMutation = useMutation({
    mutationFn: async ({ applicationId, invoiceNumber, remarks }: { applicationId: string; invoiceNumber?: string; remarks?: string }) => {
      return apiRequest(`/api/agent/loans/applications/${applicationId}/claim-payout`, {
        method: "POST",
        body: JSON.stringify({ invoiceNumber, remarks }),
      });
    },
    onSuccess: () => {
      toast({ title: "Payout Claimed", description: "Your payout claim has been submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/disbursed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/loans/my-payout-claims"] });
      setClaimDialogOpen(false);
      setSelectedLoan(null);
      setClaimRemarks("");
      setInvoiceNumber("");
      setActiveTab("claims");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit claim", variant: "destructive" });
    },
  });

  const handleClaimPayout = (loan: DisbursedLoan) => {
    setSelectedLoan(loan);
    setClaimDialogOpen(true);
  };

  const submitClaim = () => {
    if (!selectedLoan) return;
    claimMutation.mutate({
      applicationId: selectedLoan.id,
      invoiceNumber: invoiceNumber || undefined,
      remarks: claimRemarks || undefined,
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
          <h1 className="text-2xl font-bold">Payout Claims</h1>
          <p className="text-muted-foreground">Track your commission payouts for disbursed loans</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { refetchDisbursed(); refetchClaims(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Claims
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground">{pendingClaims.length} claims awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalApproved)}</div>
            <p className="text-xs text-muted-foreground">{approvedClaims.length} claims approved</p>
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
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">Total amount received</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Claimable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{disbursedLoans.filter(l => !l.hasClaim).length}</div>
            <p className="text-xs text-muted-foreground">Disbursed loans pending claim</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="disbursed">Disbursed Loans</TabsTrigger>
          <TabsTrigger value="claims">My Claims</TabsTrigger>
        </TabsList>

        <TabsContent value="disbursed">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Disbursed Loans - Ready for Payout
              </CardTitle>
              <CardDescription>Loans that have been disbursed and are eligible for commission claims</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDisbursed ? (
                <LoadingState variant="list" count={3} />
              ) : disbursedLoans.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No disbursed loans yet</p>
                  <p className="text-sm">Loans will appear here once they are disbursed</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {disbursedLoans.map((loan) => (
                    <div key={loan.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{loan.applicantName}</span>
                            <Badge variant="outline" className="text-xs">
                              {loan.applicationNumber}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {loanTypeLabels[loan.loanType] || loan.loanType}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {loan.bankName || loan.bankCode}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(loan.disbursedAt), "dd MMM yyyy")}
                            </span>
                          </div>
                          <div className="font-semibold text-lg">
                            Disbursed: {formatCurrency(loan.disbursedAmount || '0')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {loan.hasClaim ? (
                            <Badge className={statusColors[loan.claimStatus || "pending"]}>
                              {statusLabels[loan.claimStatus || "pending"]}
                            </Badge>
                          ) : (
                            <Button size="sm" onClick={() => handleClaimPayout(loan)}>
                              <Send className="h-4 w-4 mr-2" />
                              Claim Payout
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
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                My Payout Claims
              </CardTitle>
              <CardDescription>Track the status of your commission claims</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClaims ? (
                <LoadingState variant="list" count={3} />
              ) : myClaims.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payout claims yet</p>
                  <Button variant="link" onClick={() => setActiveTab("disbursed")}>
                    View disbursed loans to claim payouts
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myClaims.map((claim) => (
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
                              {claim.applicantName}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {loanTypeLabels[claim.loanType] || claim.loanType}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(new Date(claim.createdAt), "dd MMM yyyy")}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-sm text-muted-foreground">Disbursed:</span>
                              <span className="font-medium ml-1">{formatCurrency(claim.disbursedAmount || '0')}</span>
                            </div>
                            <div>
                              <span className="text-sm text-muted-foreground">Claim Amount:</span>
                              <span className="font-semibold text-green-600 ml-1">{formatCurrency(claim.claimAmount)}</span>
                            </div>
                          </div>
                          {claim.invoiceNumber && (
                            <p className="text-sm text-muted-foreground">Invoice: {claim.invoiceNumber}</p>
                          )}
                          {claim.adminRemarks && (
                            <p className="text-sm bg-muted p-2 rounded mt-2">
                              <span className="font-medium">Admin Notes:</span> {claim.adminRemarks}
                            </p>
                          )}
                          {claim.paymentDate && (
                            <p className="text-sm text-emerald-600 font-medium">
                              Paid on {format(new Date(claim.paymentDate), "dd MMM yyyy")}
                              {claim.paymentReference && ` (Ref: ${claim.paymentReference})`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Claim Payout</DialogTitle>
            <DialogDescription>Submit a payout claim for the disbursed loan</DialogDescription>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Application</span>
                  <span className="font-medium">{selectedLoan.applicationNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applicant</span>
                  <span className="font-medium">{selectedLoan.applicantName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Type</span>
                  <span className="font-medium">{loanTypeLabels[selectedLoan.loanType] || selectedLoan.loanType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedLoan.disbursedAmount || '0')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Invoice Number (Optional)</Label>
                <input
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Enter your invoice number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Textarea
                  placeholder="Any additional notes for this claim..."
                  value={claimRemarks}
                  onChange={(e) => setClaimRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitClaim} disabled={claimMutation.isPending}>
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Claim
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
