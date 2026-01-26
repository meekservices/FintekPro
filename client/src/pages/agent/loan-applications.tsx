import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState";
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
  Building2
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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-800", icon: FileText },
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
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.map(app => {
                const status = statusConfig[app.status] || statusConfig.draft;
                const StatusIcon = status.icon;
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
                              {selectedApplication.routedBanks.length > 0 && (
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
    </div>
  );
}
