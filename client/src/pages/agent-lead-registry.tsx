import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, FileText, Shield, IndianRupee, Upload, Eye, ChevronRight, Clock, CheckCircle, AlertTriangle, Search } from "lucide-react";

interface Lead {
  id: string;
  pan: string;
  mobile: string;
  customerName: string;
  loanType: string;
  approximateAmount?: number;
  processingMode?: string;
  status: string;
  firstTouchTimestamp: string;
  financierName?: string;
  bankerName?: string;
  bankerMobile?: string;
  bankerEmail?: string;
}

interface PayoutClaim {
  id: string;
  leadId: string;
  customerName?: string;
  financierName?: string;
  disbursementAmount: number;
  disbursementDate: string;
  loanAccountNumber?: string;
  pddStatus: string;
  pddExceptionAllowed?: boolean;
  subventionFlag?: boolean;
  teamCase?: boolean;
  teamMembers?: string;
  claimStatus: string;
  createdAt: string;
}

const LOAN_TYPES = [
  "Home Loan",
  "Personal Loan",
  "Business Loan",
  "LAP",
  "Car Loan",
  "Gold Loan",
  "Education Loan",
  "Working Capital",
];

const STATUS_FLOW = ["REGISTERED", "LOGGED_IN", "APPROVED", "DISBURSED"];

const STATUS_COLORS: Record<string, string> = {
  REGISTERED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  LOGGED_IN: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  APPROVED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  DISBURSED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const PROCESSING_MODE_COLORS: Record<string, string> = {
  PLATFORM: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  EXTERNAL_FINANCIER: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const CLAIM_STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  CONFIRMED_BY_FINANCIER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  APPROVED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ON_HOLD_PDD: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  CLAWED_BACK: "bg-red-500/20 text-red-400 border-red-500/30",
};

function maskPan(pan: string): string {
  if (!pan || pan.length < 4) return pan || "";
  return "XXXXXX" + pan.slice(-4);
}

function formatINR(amount: number | undefined): string {
  if (!amount && amount !== 0) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getValidTransitions(currentStatus: string): string[] {
  const idx = STATUS_FLOW.indexOf(currentStatus);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return [];
  return STATUS_FLOW.slice(idx + 1);
}

export default function AgentLeadRegistry() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("leads");

  const [regForm, setRegForm] = useState({
    pan: "",
    mobile: "",
    customerName: "",
    loanType: "",
    approximateAmount: "",
  });
  const [registeredLead, setRegisteredLead] = useState<Lead | null>(null);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [financierDetails, setFinancierDetails] = useState({
    financierName: "",
    bankerName: "",
    bankerMobile: "",
    bankerEmail: "",
  });

  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimLead, setClaimLead] = useState<Lead | null>(null);
  const [claimForm, setClaimForm] = useState({
    disbursementAmount: "",
    disbursementDate: "",
    loanAccountNumber: "",
    pddStatus: "NOT_APPLICABLE",
    pddExceptionAllowed: false,
    subventionFlag: false,
    teamCase: false,
    teamMembers: "",
  });

  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditLead, setAuditLead] = useState<Lead | null>(null);

  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [proofClaim, setProofClaim] = useState<PayoutClaim | null>(null);
  const [proofForm, setProofForm] = useState({
    fileName: "",
    fileType: "",
    fileSize: "",
    fileHash: "",
    storagePath: "",
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<PayoutClaim[]>({
    queryKey: ["/api/payout-claims"],
  });

  const registerMutation = useMutation({
    mutationFn: (data: typeof regForm) =>
      apiRequest("/api/leads/register", {
        method: "POST",
        body: JSON.stringify({
          pan: data.pan.toUpperCase(),
          mobile: data.mobile,
          customerName: data.customerName,
          loanType: data.loanType,
          approximateAmount: data.approximateAmount ? Number(data.approximateAmount) : undefined,
        }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead registered successfully" });
      setRegisteredLead(data);
    },
    onError: (err: any) => {
      toast({ title: "Registration failed", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  const processingModeMutation = useMutation({
    mutationFn: ({ leadId, mode, details }: { leadId: string; mode: string; details?: typeof financierDetails }) =>
      apiRequest(`/api/leads/${leadId}/processing-mode`, {
        method: "POST",
        body: JSON.stringify({ mode, ...details }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Processing mode set successfully" });
      setRegisteredLead(null);
      setShowExternalForm(false);
      setFinancierDetails({ financierName: "", bankerName: "", bankerMobile: "", bankerEmail: "" });
      setRegForm({ pan: "", mobile: "", customerName: "", loanType: "", approximateAmount: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to set processing mode", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
      apiRequest(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Lead status updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const submitClaimMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/payout-claims", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-claims"] });
      toast({ title: "Payout claim submitted" });
      setClaimDialogOpen(false);
      setClaimLead(null);
      setClaimForm({
        disbursementAmount: "",
        disbursementDate: "",
        loanAccountNumber: "",
        pddStatus: "NOT_APPLICABLE",
        pddExceptionAllowed: false,
        subventionFlag: false,
        teamCase: false,
        teamMembers: "",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit claim", description: err.message, variant: "destructive" });
    },
  });

  const uploadProofMutation = useMutation({
    mutationFn: ({ claimId, proof }: { claimId: string; proof: typeof proofForm }) =>
      apiRequest(`/api/payout-claims/${claimId}/proof`, {
        method: "POST",
        body: JSON.stringify(proof),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-claims"] });
      toast({ title: "Proof uploaded successfully" });
      setProofDialogOpen(false);
      setProofClaim(null);
      setProofForm({ fileName: "", fileType: "", fileSize: "", fileHash: "", storagePath: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to upload proof", description: err.message, variant: "destructive" });
    },
  });

  const handleRegister = () => {
    if (!regForm.pan || !regForm.mobile || !regForm.customerName || !regForm.loanType) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    registerMutation.mutate(regForm);
  };

  const handleSubmitClaim = () => {
    if (!claimLead || !claimForm.disbursementAmount || !claimForm.disbursementDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    submitClaimMutation.mutate({
      leadId: claimLead.id,
      disbursementAmount: Number(claimForm.disbursementAmount),
      disbursementDate: claimForm.disbursementDate,
      loanAccountNumber: claimForm.loanAccountNumber || undefined,
      financierName: claimLead.financierName || undefined,
      pddStatus: claimForm.pddStatus,
      pddExceptionAllowed: claimForm.pddExceptionAllowed,
      subventionFlag: claimForm.subventionFlag,
      teamCase: claimForm.teamCase,
      teamMembers: claimForm.teamCase ? claimForm.teamMembers : undefined,
    });
  };

  const openClaimDialog = (lead: Lead) => {
    setClaimLead(lead);
    setClaimDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-emerald-500" />
            Lead Registry & Payout Claims
          </h1>
          <p className="text-muted-foreground mt-1">Register leads, track status, and manage payout claims</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
            <TabsTrigger value="register" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <Plus className="h-4 w-4 mr-2" />
              Register Lead
            </TabsTrigger>
            <TabsTrigger value="leads" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4 mr-2" />
              My Leads
            </TabsTrigger>
            <TabsTrigger value="claims" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <IndianRupee className="h-4 w-4 mr-2" />
              Payout Claims
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Register Lead - Redirects to Loan Apply */}
          <TabsContent value="register" className="mt-6">
            <Card className="bg-card border-border max-w-2xl">
              <CardContent className="p-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-foreground font-semibold text-lg">Leads are Auto-Registered</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Leads are now automatically registered when you create a loan application. 
                  Go to the Loan Apply page to create a new lead with full loan details and choose 
                  whether you or the bank processes it.
                </p>
                <Button
                  onClick={() => navigate("/agent/loan-apply")}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Loan Lead
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: My Leads */}
          <TabsContent value="leads" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">My Leads</CardTitle>
                <CardDescription>All registered leads and their current status</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Clock className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
                    <span className="text-muted-foreground">Loading leads...</span>
                  </div>
                ) : leads.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No leads registered yet</p>
                    <Button
                      variant="outline"
                      className="mt-4 border-border"
                      onClick={() => setActiveTab("register")}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Register Your First Lead
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Customer Name</TableHead>
                          <TableHead className="text-muted-foreground">PAN</TableHead>
                          <TableHead className="text-muted-foreground">Mobile</TableHead>
                          <TableHead className="text-muted-foreground">Loan Type</TableHead>
                          <TableHead className="text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-muted-foreground">Processing Mode</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">First Touch</TableHead>
                          <TableHead className="text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => {
                          const transitions = getValidTransitions(lead.status);
                          return (
                            <TableRow key={lead.id} className="border-border">
                              <TableCell className="text-foreground font-medium">{lead.customerName}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-sm">{maskPan(lead.pan)}</TableCell>
                              <TableCell className="text-muted-foreground">{lead.mobile}</TableCell>
                              <TableCell className="text-muted-foreground">{lead.loanType}</TableCell>
                              <TableCell className="text-foreground">{formatINR(lead.approximateAmount)}</TableCell>
                              <TableCell>
                                {lead.processingMode ? (
                                  <Badge variant="outline" className={PROCESSING_MODE_COLORS[lead.processingMode] || ""}>
                                    {lead.processingMode === "EXTERNAL_FINANCIER" ? "External" : lead.processingMode}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={STATUS_COLORS[lead.status] || ""}>
                                  {lead.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {lead.firstTouchTimestamp
                                  ? new Date(lead.firstTouchTimestamp).toLocaleDateString("en-IN")
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {transitions.length > 0 && (
                                    <Select
                                      onValueChange={(newStatus) =>
                                        updateStatusMutation.mutate({ leadId: lead.id, status: newStatus })
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-[140px] bg-background border-border text-sm">
                                        <SelectValue placeholder="Update Status" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-card border-border">
                                        {transitions.map((s) => (
                                          <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  {lead.status === "DISBURSED" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                                      onClick={() => {
                                        openClaimDialog(lead);
                                        setActiveTab("claims");
                                      }}
                                    >
                                      <IndianRupee className="h-3 w-3 mr-1" />
                                      Payout Claim
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      setAuditLead(lead);
                                      setAuditDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Audit Trail
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Payout Claims */}
          <TabsContent value="claims" className="mt-6 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">My Payout Claims</CardTitle>
                    <CardDescription>Track submitted payout claims and their status</CardDescription>
                  </div>
                  <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          if (!claimLead) {
                            const disbursedLeads = leads.filter((l) => l.status === "DISBURSED");
                            if (disbursedLeads.length > 0) {
                              setClaimLead(disbursedLeads[0]);
                            }
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Claim
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-background border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Submit Payout Claim</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                          Submit a payout claim for a disbursed lead
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label className="text-muted-foreground">Lead ID</Label>
                          <Input
                            value={claimLead?.id || ""}
                            readOnly
                            className="mt-1 bg-muted border-border"
                          />
                        </div>
                        {!claimLead && (
                          <div>
                            <Label className="text-muted-foreground">Select Lead</Label>
                            <Select
                              onValueChange={(id) => {
                                const found = leads.find((l) => l.id === id);
                                if (found) setClaimLead(found);
                              }}
                            >
                              <SelectTrigger className="mt-1 bg-background border-border">
                                <SelectValue placeholder="Choose a disbursed lead" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {leads
                                  .filter((l) => l.status === "DISBURSED")
                                  .map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                      {l.customerName} — {l.id.slice(0, 8)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Disbursement Amount (₹) *</Label>
                            <Input
                              type="number"
                              value={claimForm.disbursementAmount}
                              onChange={(e) => setClaimForm({ ...claimForm, disbursementAmount: e.target.value })}
                              className="mt-1 bg-background border-border"
                              placeholder="1000000"
                            />
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Disbursement Date *</Label>
                            <Input
                              type="date"
                              value={claimForm.disbursementDate}
                              onChange={(e) => setClaimForm({ ...claimForm, disbursementDate: e.target.value })}
                              className="mt-1 bg-background border-border"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Loan Account Number</Label>
                          <Input
                            value={claimForm.loanAccountNumber}
                            onChange={(e) => setClaimForm({ ...claimForm, loanAccountNumber: e.target.value })}
                            className="mt-1 bg-background border-border"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Financier Name</Label>
                          <Input
                            value={claimLead?.financierName || ""}
                            readOnly
                            className="mt-1 bg-muted border-border"
                          />
                        </div>
                        <div>
                          <Label className="text-muted-foreground">PDD Status</Label>
                          <Select
                            value={claimForm.pddStatus}
                            onValueChange={(v) => setClaimForm({ ...claimForm, pddStatus: v, pddExceptionAllowed: false })}
                          >
                            <SelectTrigger className="mt-1 bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="NOT_APPLICABLE">Not Applicable</SelectItem>
                              <SelectItem value="PENDING">Pending</SelectItem>
                              <SelectItem value="CLEARED">Cleared</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {claimForm.pddStatus === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="pddException"
                              checked={claimForm.pddExceptionAllowed}
                              onCheckedChange={(v) => setClaimForm({ ...claimForm, pddExceptionAllowed: !!v })}
                            />
                            <Label htmlFor="pddException" className="text-muted-foreground text-sm">
                              PDD Exception Allowed
                            </Label>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="subvention"
                            checked={claimForm.subventionFlag}
                            onCheckedChange={(v) => setClaimForm({ ...claimForm, subventionFlag: !!v })}
                          />
                          <Label htmlFor="subvention" className="text-muted-foreground text-sm">
                            Subvention Flag
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="teamCase"
                            checked={claimForm.teamCase}
                            onCheckedChange={(v) => setClaimForm({ ...claimForm, teamCase: !!v })}
                          />
                          <Label htmlFor="teamCase" className="text-muted-foreground text-sm">
                            Team Case
                          </Label>
                        </div>
                        {claimForm.teamCase && (
                          <div>
                            <Label className="text-muted-foreground">Team Members (JSON)</Label>
                            <Input
                              value={claimForm.teamMembers}
                              onChange={(e) => setClaimForm({ ...claimForm, teamMembers: e.target.value })}
                              className="mt-1 bg-background border-border"
                              placeholder='[{"name":"Agent B","share":50}]'
                            />
                          </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4">
                          <Button variant="outline" onClick={() => setClaimDialogOpen(false)} className="border-border">
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSubmitClaim}
                            disabled={submitClaimMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {submitClaimMutation.isPending && <Clock className="h-4 w-4 mr-2 animate-spin" />}
                            Submit Claim
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {claimsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Clock className="h-6 w-6 animate-spin text-emerald-500 mr-2" />
                    <span className="text-muted-foreground">Loading claims...</span>
                  </div>
                ) : claims.length === 0 ? (
                  <div className="text-center py-12">
                    <IndianRupee className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No payout claims submitted yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-muted-foreground">Claim ID</TableHead>
                          <TableHead className="text-muted-foreground">Lead / Customer</TableHead>
                          <TableHead className="text-muted-foreground">Financier</TableHead>
                          <TableHead className="text-muted-foreground">Amount</TableHead>
                          <TableHead className="text-muted-foreground">Disbursement Date</TableHead>
                          <TableHead className="text-muted-foreground">PDD Status</TableHead>
                          <TableHead className="text-muted-foreground">Claim Status</TableHead>
                          <TableHead className="text-muted-foreground">Created At</TableHead>
                          <TableHead className="text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claims.map((claim) => (
                          <TableRow key={claim.id} className="border-border">
                            <TableCell className="text-foreground font-mono text-sm">
                              {claim.id.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-foreground">
                              {claim.customerName || claim.leadId?.slice(0, 8) || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{claim.financierName || "—"}</TableCell>
                            <TableCell className="text-foreground">{formatINR(claim.disbursementAmount)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {claim.disbursementDate
                                ? new Date(claim.disbursementDate).toLocaleDateString("en-IN")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {claim.pddStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={CLAIM_STATUS_COLORS[claim.claimStatus] || ""}
                              >
                                {claim.claimStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {claim.createdAt
                                ? new Date(claim.createdAt).toLocaleDateString("en-IN")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-border text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setProofClaim(claim);
                                  setProofDialogOpen(true);
                                }}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Upload Proof
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Audit Trail Dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Audit Trail</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Activity log for {auditLead?.customerName || "this lead"}
            </DialogDescription>
          </DialogHeader>
          {auditLead && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-foreground text-sm font-medium">Lead Registered</p>
                  <p className="text-muted-foreground text-xs">
                    {auditLead.firstTouchTimestamp
                      ? new Date(auditLead.firstTouchTimestamp).toLocaleString("en-IN")
                      : "—"}
                  </p>
                </div>
              </div>
              {auditLead.processingMode && (
                <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                  <Shield className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      Processing Mode: {auditLead.processingMode}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="text-foreground text-sm font-medium">Current Status: {auditLead.status}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Proof Dialog */}
      <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Proof</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Provide file metadata for claim {proofClaim?.id?.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="text-muted-foreground">File Name</Label>
              <Input
                value={proofForm.fileName}
                onChange={(e) => setProofForm({ ...proofForm, fileName: e.target.value })}
                className="mt-1 bg-background border-border"
                placeholder="disbursement_letter.pdf"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">File Type</Label>
                <Input
                  value={proofForm.fileType}
                  onChange={(e) => setProofForm({ ...proofForm, fileType: e.target.value })}
                  className="mt-1 bg-background border-border"
                  placeholder="application/pdf"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">File Size</Label>
                <Input
                  value={proofForm.fileSize}
                  onChange={(e) => setProofForm({ ...proofForm, fileSize: e.target.value })}
                  className="mt-1 bg-background border-border"
                  placeholder="2048000"
                />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">File Hash</Label>
              <Input
                value={proofForm.fileHash}
                onChange={(e) => setProofForm({ ...proofForm, fileHash: e.target.value })}
                className="mt-1 bg-background border-border"
                placeholder="sha256:abc123..."
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Storage Path</Label>
              <Input
                value={proofForm.storagePath}
                onChange={(e) => setProofForm({ ...proofForm, storagePath: e.target.value })}
                className="mt-1 bg-background border-border"
                placeholder="/proofs/claim-xyz/file.pdf"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setProofDialogOpen(false)} className="border-border">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (proofClaim) {
                    uploadProofMutation.mutate({ claimId: proofClaim.id, proof: proofForm });
                  }
                }}
                disabled={!proofForm.fileName || uploadProofMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {uploadProofMutation.isPending && <Clock className="h-4 w-4 mr-2 animate-spin" />}
                Upload Proof
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
