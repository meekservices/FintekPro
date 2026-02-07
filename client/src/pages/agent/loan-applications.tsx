import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { 
  Search,
  Filter,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  IndianRupee,
  Calendar,
  User,
  Phone,
  FileText,
  ArrowRight,
  Building2,
  Trash2,
  Send,
  Edit
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface LoanApplication {
  id: string;
  applicationNumber: string;
  applicantName: string;
  applicantPhone: string;
  loanType: string;
  requestedAmount: string;
  requestedTenure: number;
  status: string;
  creditScore: number | null;
  routedBanks: string[];
  createdAt: string;
}

interface Bank {
  id: string;
  bankCode: string;
  bankName: string;
  supportedLoanTypes: string[];
  isActive: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-muted text-foreground", icon: FileText },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800", icon: Clock },
  eligibility_check: { label: "Eligibility Check", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
  routed: { label: "Routed to Banks", color: "bg-purple-100 text-purple-800", icon: Building2 },
  pending_with_banks: { label: "Pending with Banks", color: "bg-orange-100 text-orange-800", icon: Clock },
  in_review: { label: "In Review", color: "bg-cyan-100 text-cyan-800", icon: Eye },
  approved: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  disbursed: { label: "Disbursed", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
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

export default function AgentLoanApplications() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<LoanApplication | null>(null);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [applicationToRoute, setApplicationToRoute] = useState<LoanApplication | null>(null);
  const [applicationToDelete, setApplicationToDelete] = useState<LoanApplication | null>(null);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const { toast } = useToast();

  const queryUrl = statusFilter !== "all" 
    ? `/api/dsa-loans/applications?status=${statusFilter}` 
    : "/api/dsa-loans/applications";

  const { data: response, isLoading, refetch } = useQuery<{ 
    success: boolean; 
    data: LoanApplication[];
    meta: { total: number; limit: number; offset: number };
  }>({
    queryKey: ["/api/dsa-loans/applications", statusFilter],
    queryFn: async () => {
      const res = await fetch(queryUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
  });

  const { data: banksData } = useQuery<{ success: boolean; data: Bank[] }>({
    queryKey: ["/api/dsa-loans/banks"],
  });

  const banks = banksData?.data || [];

  const routeMutation = useMutation({
    mutationFn: async ({ applicationId, bankCodes }: { applicationId: string; bankCodes: string[] }) => {
      return apiRequest(`/api/dsa-loans/applications/${applicationId}/route`, {
        method: "POST",
        body: JSON.stringify({ bankCodes, strategy: "parallel" }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Banks Assigned",
        description: "Application has been routed to selected banks.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dsa-loans/applications"] });
      setRouteDialogOpen(false);
      setApplicationToRoute(null);
      setSelectedBanks([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to route application",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest(`/api/dsa-loans/applications/${applicationId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Application Deleted",
        description: "The loan application has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dsa-loans/applications"] });
      setDeleteDialogOpen(false);
      setApplicationToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete application",
        variant: "destructive",
      });
    },
  });

  const applications = response?.data || [];
  
  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicantPhone.includes(searchQuery);
    return matchesSearch;
  });

  const stats = {
    total: applications.length,
    pending: applications.filter(a => ["submitted", "eligibility_check", "routed", "pending_with_banks", "in_review"].includes(a.status)).length,
    approved: applications.filter(a => a.status === "approved").length,
    disbursed: applications.filter(a => a.status === "disbursed").length,
  };

  const openRouteDialog = (app: LoanApplication) => {
    setApplicationToRoute(app);
    setSelectedBanks(app.routedBanks || []);
    setRouteDialogOpen(true);
  };

  const openDeleteDialog = (app: LoanApplication) => {
    setApplicationToDelete(app);
    setDeleteDialogOpen(true);
  };

  const handleBankToggle = (bankCode: string) => {
    setSelectedBanks(prev => 
      prev.includes(bankCode)
        ? prev.filter(b => b !== bankCode)
        : [...prev, bankCode]
    );
  };

  const handleRouteSubmit = () => {
    if (applicationToRoute && selectedBanks.length > 0) {
      routeMutation.mutate({
        applicationId: applicationToRoute.id,
        bankCodes: selectedBanks,
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (applicationToDelete) {
      deleteMutation.mutate(applicationToDelete.id);
    }
  };

  const getEligibleBanks = (loanType: string) => {
    return banks.filter(b => 
      b.isActive && (b.supportedLoanTypes || []).includes(loanType)
    );
  };

  if (isLoading) {
    return <LoadingState variant="agent-dashboard" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Loan Applications</h1>
          <p className="text-muted-foreground">Track all loan leads you've submitted</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/agent/loan-apply">
            <Button>
              <ArrowRight className="h-4 w-4 mr-2" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{stats.disbursed}</div>
            <p className="text-sm text-muted-foreground">Disbursed</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, phone, or application number..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="eligibility_check">Eligibility Check</SelectItem>
            <SelectItem value="routed">Routed</SelectItem>
            <SelectItem value="pending_with_banks">Pending with Banks</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="disbursed">Disbursed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Loan Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Banks Routed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map(app => {
                const status = statusConfig[app.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                const routedCount = (app.routedBanks || []).length;
                const canEdit = ['draft', 'submitted', 'eligibility_check'].includes(app.status);
                const canDelete = ['draft', 'submitted'].includes(app.status);
                
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.applicationNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{app.applicantName}</p>
                          <p className="text-xs text-muted-foreground">{app.applicantPhone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{loanTypeLabels[app.loanType] || app.loanType}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <IndianRupee className="h-4 w-4" />
                        {(parseFloat(app.requestedAmount) / 100000).toFixed(2)}L
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={routedCount > 0 ? "default" : "secondary"}>
                        <Building2 className="h-3 w-3 mr-1" />
                        {routedCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(app.createdAt), "dd MMM yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedApplication(app)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Application Details</DialogTitle>
                            </DialogHeader>
                            {selectedApplication && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Application Number</p>
                                    <p className="font-medium">{selectedApplication.applicationNumber}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Status</p>
                                    <Badge className={statusConfig[selectedApplication.status]?.color}>
                                      {statusConfig[selectedApplication.status]?.label}
                                    </Badge>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Applicant Name</p>
                                    <p className="font-medium">{selectedApplication.applicantName}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Phone</p>
                                    <p className="font-medium">{selectedApplication.applicantPhone}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Loan Type</p>
                                    <p className="font-medium">{loanTypeLabels[selectedApplication.loanType]}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Amount</p>
                                    <p className="font-medium">₹{(parseFloat(selectedApplication.requestedAmount) / 100000).toFixed(2)} Lakhs</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Tenure</p>
                                    <p className="font-medium">{selectedApplication.requestedTenure} months</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Credit Score</p>
                                    <p className="font-medium">{selectedApplication.creditScore || "Not available"}</p>
                                  </div>
                                </div>
                                {(selectedApplication.routedBanks || []).length > 0 && (
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Routed to Banks</p>
                                    <div className="flex flex-wrap gap-2">
                                      {selectedApplication.routedBanks.map(bank => (
                                        <Badge key={bank} variant="outline">{bank}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        {canEdit && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openRouteDialog(app)}
                            title="Assign Banks"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {canDelete && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openDeleteDialog(app)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete Application"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {filteredApplications.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No applications found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try a different search term" : "Submit your first loan lead to get started"}
              </p>
              <Link href="/agent/loan-apply">
                <Button className="mt-4">Submit New Lead</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Banks</DialogTitle>
            <DialogDescription>
              Select banks to route this loan application to
            </DialogDescription>
          </DialogHeader>
          {applicationToRoute && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{applicationToRoute.applicantName}</p>
                <p className="text-sm text-muted-foreground">
                  {loanTypeLabels[applicationToRoute.loanType]} - ₹{(parseFloat(applicationToRoute.requestedAmount) / 100000).toFixed(2)}L
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Select Banks ({selectedBanks.length} selected)</p>
                <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
                  {getEligibleBanks(applicationToRoute.loanType).map(bank => (
                    <div 
                      key={bank.bankCode}
                      className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                      onClick={() => handleBankToggle(bank.bankCode)}
                    >
                      <Checkbox 
                        checked={selectedBanks.includes(bank.bankCode)}
                        onCheckedChange={() => handleBankToggle(bank.bankCode)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{bank.bankName}</p>
                        <p className="text-xs text-muted-foreground">{bank.bankCode}</p>
                      </div>
                    </div>
                  ))}
                  {getEligibleBanks(applicationToRoute.loanType).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No banks available for this loan type
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRouteSubmit}
              disabled={selectedBanks.length === 0 || routeMutation.isPending}
            >
              {routeMutation.isPending ? "Routing..." : `Route to ${selectedBanks.length} Bank(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this loan application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {applicationToDelete && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{applicationToDelete.applicantName}</p>
              <p className="text-sm text-muted-foreground">
                {applicationToDelete.applicationNumber} - {loanTypeLabels[applicationToDelete.loanType]}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
