import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  IndianRupee,
  Eye,
  Send,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Loader2,
  Paperclip,
  CreditCard,
  BarChart3,
} from "lucide-react";

interface MasterDsaClaim {
  id: string;
  payoutClaimId: string;
  masterDsaEmail: string;
  masterDsaName: string;
  claimedAmount: number;
  paidAmount?: number;
  status: string;
  reason?: string;
  createdAt: string;
  updatedAt?: string;
  submittedAt?: string;
  customerName?: string;
  financierName?: string;
}

interface ClaimAttachment {
  id: string;
  dsaClaimId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  storagePath: string;
  attachmentType: string;
  createdAt: string;
}

interface ClaimPayment {
  id: string;
  dsaClaimId: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string;
  paymentMode?: string;
  notes?: string;
  createdAt: string;
}

interface ClaimDetail extends MasterDsaClaim {
  attachments: ClaimAttachment[];
  payments: ClaimPayment[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  SUBMITTED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ACKNOWLEDGED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PAID: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  PARTIALLY_PAID: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  DISPUTED: "bg-red-500/20 text-red-400 border-red-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ATTACHMENT_TYPES = [
  "CONFIRMATION_EMAIL",
  "INVOICE",
  "PAYOUT_SHEET",
  "BANK_STATEMENT",
  "OTHER",
];

function formatINR(amount: number | undefined): string {
  if (!amount && amount !== 0) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminMasterDsaClaims() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("claims");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [attachmentForm, setAttachmentForm] = useState({
    fileName: "",
    fileType: "",
    fileSize: "",
    fileHash: "",
    storagePath: "",
    attachmentType: "",
  });
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: "", reason: "" });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: "",
    referenceNumber: "",
    paymentMode: "",
    notes: "",
  });

  const [createForm, setCreateForm] = useState({
    payoutClaimId: "",
    masterDsaEmail: "",
    masterDsaName: "",
    claimedAmount: "",
  });

  const queryUrl = statusFilter && statusFilter !== "all"
    ? `/api/admin/master-dsa-claims?status=${statusFilter}`
    : "/api/admin/master-dsa-claims";

  const { data: claimsData, isLoading: claimsLoading } = useQuery<{ claims: MasterDsaClaim[] } | MasterDsaClaim[]>({
    queryKey: ["/api/admin/master-dsa-claims", statusFilter !== "all" ? statusFilter : ""],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
  });

  const claims: MasterDsaClaim[] = Array.isArray(claimsData)
    ? claimsData
    : (claimsData as any)?.claims || [];

  const filteredClaims = claims.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.masterDsaName?.toLowerCase().includes(q) ||
      c.masterDsaEmail?.toLowerCase().includes(q) ||
      c.payoutClaimId?.toLowerCase().includes(q) ||
      c.id?.toLowerCase().includes(q)
    );
  });

  const { data: claimDetail, isLoading: detailLoading } = useQuery<ClaimDetail>({
    queryKey: ["/api/admin/master-dsa-claims", selectedClaimId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/master-dsa-claims/${selectedClaimId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch claim detail");
      return res.json();
    },
    enabled: !!selectedClaimId && detailOpen,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) =>
      apiRequest(`/api/admin/master-dsa-claims/${data.payoutClaimId}/create`, {
        method: "POST",
        body: JSON.stringify({
          masterDsaEmail: data.masterDsaEmail,
          masterDsaName: data.masterDsaName,
          claimedAmount: Number(data.claimedAmount),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims"] });
      toast({ title: "Claim created successfully" });
      setCreateForm({ payoutClaimId: "", masterDsaEmail: "", masterDsaName: "", claimedAmount: "" });
      setActiveTab("claims");
    },
    onError: (err: any) => {
      toast({ title: "Failed to create claim", description: err.message, variant: "destructive" });
    },
  });

  const attachmentMutation = useMutation({
    mutationFn: (data: typeof attachmentForm) =>
      apiRequest(`/api/admin/master-dsa-claims/${selectedClaimId}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          fileSize: Number(data.fileSize),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims", selectedClaimId] });
      toast({ title: "Attachment added" });
      setAttachmentDialogOpen(false);
      setAttachmentForm({ fileName: "", fileType: "", fileSize: "", fileHash: "", storagePath: "", attachmentType: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add attachment", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/master-dsa-claims/${selectedClaimId}/submit`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims", selectedClaimId] });
      toast({ title: "Claim submitted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to submit claim", description: err.message, variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/admin/master-dsa-claims/${selectedClaimId}/send-email`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims", selectedClaimId] });
      toast({ title: "Email sent successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (data: typeof statusForm) =>
      apiRequest(`/api/admin/master-dsa-claims/${selectedClaimId}/status`, {
        method: "POST",
        body: JSON.stringify({
          status: data.status,
          reason: data.reason || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims", selectedClaimId] });
      toast({ title: "Status updated" });
      setStatusDialogOpen(false);
      setStatusForm({ status: "", reason: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: (data: typeof paymentForm) =>
      apiRequest(`/api/admin/master-dsa-claims/${selectedClaimId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(data.amount),
          paymentDate: data.paymentDate,
          referenceNumber: data.referenceNumber || undefined,
          paymentMode: data.paymentMode || undefined,
          notes: data.notes || undefined,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims", selectedClaimId] });
      toast({ title: "Payment recorded" });
      setPaymentDialogOpen(false);
      setPaymentForm({ amount: "", paymentDate: "", referenceNumber: "", paymentMode: "", notes: "" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to record payment", description: err.message, variant: "destructive" });
    },
  });

  const openDetail = (claimId: string) => {
    setSelectedClaimId(claimId);
    setDetailOpen(true);
  };

  const hasConfirmationEmail = claimDetail?.attachments?.some(
    (a) => a.attachmentType === "CONFIRMATION_EMAIL"
  );

  const totalPaid = claimDetail?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const outstanding = (claimDetail?.claimedAmount || 0) - totalPaid;

  const reconciliationStats = {
    totalClaims: claims.length,
    totalClaimed: claims.reduce((s, c) => s + (c.claimedAmount || 0), 0),
    totalPaid: claims.reduce((s, c) => s + (c.paidAmount || 0), 0),
    byStatus: claims.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-500" />
            Master DSA Claims
          </h1>
          <p className="text-muted-foreground mt-1">Manage master DSA claims, attachments, and payments</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card border border-border">
            <TabsTrigger value="claims" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="h-4 w-4 mr-2" />
              All Claims
            </TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Plus className="h-4 w-4 mr-2" />
              Create Claim
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Reconciliation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="claims" className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/master-dsa-claims"] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="p-0">
                {claimsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClaims.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No claims found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Master DSA</TableHead>
                          <TableHead>Payout Claim</TableHead>
                          <TableHead className="text-right">Claimed</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredClaims.map((claim) => (
                          <TableRow key={claim.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <div className="font-medium text-sm">{claim.masterDsaName}</div>
                              <div className="text-xs text-muted-foreground">{claim.masterDsaEmail}</div>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{claim.payoutClaimId}</TableCell>
                            <TableCell className="text-right font-medium">{formatINR(claim.claimedAmount)}</TableCell>
                            <TableCell className="text-right">{formatINR(claim.paidAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={STATUS_COLORS[claim.status] || ""}>
                                {claim.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(claim.createdAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openDetail(claim.id)}>
                                <Eye className="h-4 w-4" />
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

          <TabsContent value="create" className="mt-6">
            <Card className="bg-card border-border max-w-2xl">
              <CardHeader>
                <CardTitle className="text-foreground">Create Master DSA Claim</CardTitle>
                <CardDescription>Create a new claim from an existing payout claim</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Payout Claim ID *</Label>
                  <Input
                    value={createForm.payoutClaimId}
                    onChange={(e) => setCreateForm({ ...createForm, payoutClaimId: e.target.value })}
                    placeholder="Enter payout claim ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Master DSA Name *</Label>
                  <Input
                    value={createForm.masterDsaName}
                    onChange={(e) => setCreateForm({ ...createForm, masterDsaName: e.target.value })}
                    placeholder="Enter master DSA name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Master DSA Email *</Label>
                  <Input
                    type="email"
                    value={createForm.masterDsaEmail}
                    onChange={(e) => setCreateForm({ ...createForm, masterDsaEmail: e.target.value })}
                    placeholder="Enter master DSA email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Claimed Amount (₹) *</Label>
                  <Input
                    type="number"
                    value={createForm.claimedAmount}
                    onChange={(e) => setCreateForm({ ...createForm, claimedAmount: e.target.value })}
                    placeholder="Enter claimed amount"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!createForm.payoutClaimId || !createForm.masterDsaName || !createForm.masterDsaEmail || !createForm.claimedAmount) {
                      toast({ title: "Please fill all required fields", variant: "destructive" });
                      return;
                    }
                    createMutation.mutate(createForm);
                  }}
                  disabled={createMutation.isPending}
                  className="w-full"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Claim
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reconciliation" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reconciliationStats.totalClaims}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
                  <IndianRupee className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatINR(reconciliationStats.totalClaimed)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{formatINR(reconciliationStats.totalPaid)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatINR(reconciliationStats.totalClaimed - reconciliationStats.totalPaid)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
                <CardDescription>Claims distribution by current status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(reconciliationStats.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between p-3 rounded-lg border">
                      <Badge variant="outline" className={STATUS_COLORS[status] || ""}>
                        {status.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-lg font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Summary by Claim</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Master DSA</TableHead>
                        <TableHead className="text-right">Claimed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Outstanding</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map((claim) => (
                        <TableRow key={claim.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{claim.masterDsaName}</div>
                            <div className="text-xs text-muted-foreground">{claim.masterDsaEmail}</div>
                          </TableCell>
                          <TableCell className="text-right">{formatINR(claim.claimedAmount)}</TableCell>
                          <TableCell className="text-right text-emerald-600">{formatINR(claim.paidAmount)}</TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatINR((claim.claimedAmount || 0) - (claim.paidAmount || 0))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[claim.status] || ""}>
                              {claim.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>
              {claimDetail ? `${claimDetail.masterDsaName} — ${claimDetail.payoutClaimId}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : claimDetail ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    <Badge variant="outline" className={STATUS_COLORS[claimDetail.status] || ""}>
                      {claimDetail.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Claimed Amount</Label>
                  <div className="text-lg font-bold mt-1">{formatINR(claimDetail.claimedAmount)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Paid Amount</Label>
                  <div className="text-lg font-bold text-emerald-600 mt-1">{formatINR(totalPaid)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Outstanding</Label>
                  <div className="text-lg font-bold text-orange-600 mt-1">{formatINR(outstanding)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <div className="text-sm mt-1">{formatDate(claimDetail.createdAt)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Submitted</Label>
                  <div className="text-sm mt-1">{formatDate(claimDetail.submittedAt)}</div>
                </div>
              </div>

              {claimDetail.reason && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <Label className="text-xs text-red-400">Reason</Label>
                  <p className="text-sm mt-1">{claimDetail.reason}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {claimDetail.status === "DRAFT" && (
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending || !hasConfirmationEmail}
                    title={!hasConfirmationEmail ? "Add a CONFIRMATION_EMAIL attachment first" : ""}
                  >
                    {submitMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Submit Claim
                  </Button>
                )}
                {!hasConfirmationEmail && claimDetail.status === "DRAFT" && (
                  <span className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    CONFIRMATION_EMAIL attachment required
                  </span>
                )}
                {claimDetail.status === "SUBMITTED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendEmailMutation.mutate()}
                    disabled={sendEmailMutation.isPending}
                  >
                    {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                    Send Email
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setAttachmentDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Add Attachment
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatusDialogOpen(true)}>
                  <Clock className="h-4 w-4 mr-1" />
                  Update Status
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Record Payment
                </Button>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <Paperclip className="h-4 w-4" /> Attachments ({claimDetail.attachments?.length || 0})
                </h4>
                {claimDetail.attachments?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Attachment Type</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead>Added</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claimDetail.attachments.map((att) => (
                        <TableRow key={att.id}>
                          <TableCell className="text-sm font-medium">{att.fileName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{att.fileType}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={att.attachmentType === "CONFIRMATION_EMAIL" ? "bg-blue-500/20 text-blue-400" : ""}>
                              {att.attachmentType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">{att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(att.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No attachments yet</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                  <IndianRupee className="h-4 w-4" /> Payment History ({claimDetail.payments?.length || 0})
                </h4>
                {claimDetail.payments?.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Mode</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {claimDetail.payments.map((pmt) => (
                          <TableRow key={pmt.id}>
                            <TableCell className="text-sm">{formatDate(pmt.paymentDate)}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">{formatINR(pmt.amount)}</TableCell>
                            <TableCell className="text-xs font-mono">{pmt.referenceNumber || "—"}</TableCell>
                            <TableCell className="text-xs">{pmt.paymentMode || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{pmt.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-3 p-3 rounded-lg border bg-muted/50 flex flex-wrap gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Paid:</span>{" "}
                        <span className="font-bold text-emerald-600">{formatINR(totalPaid)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Claimed:</span>{" "}
                        <span className="font-bold">{formatINR(claimDetail.claimedAmount)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outstanding:</span>{" "}
                        <span className="font-bold text-orange-600">{formatINR(outstanding)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No payments recorded yet</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Attachment</DialogTitle>
            <DialogDescription>Add a document attachment to this claim</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File Name *</Label>
              <Input
                value={attachmentForm.fileName}
                onChange={(e) => setAttachmentForm({ ...attachmentForm, fileName: e.target.value })}
                placeholder="e.g. confirmation-email.pdf"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>File Type *</Label>
                <Input
                  value={attachmentForm.fileType}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, fileType: e.target.value })}
                  placeholder="e.g. application/pdf"
                />
              </div>
              <div className="space-y-2">
                <Label>File Size (bytes) *</Label>
                <Input
                  type="number"
                  value={attachmentForm.fileSize}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, fileSize: e.target.value })}
                  placeholder="e.g. 102400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>File Hash *</Label>
              <Input
                value={attachmentForm.fileHash}
                onChange={(e) => setAttachmentForm({ ...attachmentForm, fileHash: e.target.value })}
                placeholder="SHA-256 hash"
              />
            </div>
            <div className="space-y-2">
              <Label>Storage Path *</Label>
              <Input
                value={attachmentForm.storagePath}
                onChange={(e) => setAttachmentForm({ ...attachmentForm, storagePath: e.target.value })}
                placeholder="e.g. /uploads/claims/file.pdf"
              />
            </div>
            <div className="space-y-2">
              <Label>Attachment Type *</Label>
              <Select
                value={attachmentForm.attachmentType}
                onValueChange={(v) => setAttachmentForm({ ...attachmentForm, attachmentType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!attachmentForm.fileName || !attachmentForm.fileType || !attachmentForm.fileSize || !attachmentForm.fileHash || !attachmentForm.storagePath || !attachmentForm.attachmentType) {
                  toast({ title: "Please fill all fields", variant: "destructive" });
                  return;
                }
                attachmentMutation.mutate(attachmentForm);
              }}
              disabled={attachmentMutation.isPending}
            >
              {attachmentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Add Attachment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>Change the claim status</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status *</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm({ ...statusForm, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(statusForm.status === "DISPUTED" || statusForm.status === "REJECTED") && (
              <div className="space-y-2">
                <Label>Reason {statusForm.status === "REJECTED" ? "*" : ""}</Label>
                <Textarea
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="Enter reason..."
                  rows={3}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!statusForm.status) {
                  toast({ title: "Please select a status", variant: "destructive" });
                  return;
                }
                if (statusForm.status === "REJECTED" && !statusForm.reason) {
                  toast({ title: "Reason is required for rejection", variant: "destructive" });
                  return;
                }
                statusMutation.mutate(statusForm);
              }}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment against this claim</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  placeholder="e.g. UTR number"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select
                  value={paymentForm.paymentMode}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMode: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEFT">NEFT</SelectItem>
                    <SelectItem value="RTGS">RTGS</SelectItem>
                    <SelectItem value="IMPS">IMPS</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!paymentForm.amount || !paymentForm.paymentDate) {
                  toast({ title: "Amount and date are required", variant: "destructive" });
                  return;
                }
                paymentMutation.mutate(paymentForm);
              }}
              disabled={paymentMutation.isPending}
            >
              {paymentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
