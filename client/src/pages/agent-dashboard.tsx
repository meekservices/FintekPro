import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Bell, 
  Users, 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Plus,
  Send,
  Eye,
  FileText,
  Filter,
  User,
  Loader2,
  TrendingUp,
  IndianRupee,
  PieChart,
  Target,
  ArrowRight,
  Calendar,
  Edit,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CkycClient {
  id: string;
  userId: string;
  ckycNumber?: string;
  verificationStatus: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  mobileNumber: string;
  panNumber: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationTrigger {
  id: string;
  ckycRecordId: string;
  triggerType: string;
  notificationMethod: string;
  recipientEmail?: string;
  recipientMobile?: string;
  subject: string;
  message: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  failureReason?: string;
  triggerredBy: string;
  metadata?: any;
  createdAt: string;
}

interface InvestmentProposal {
  id: string;
  agentId: string;
  clientId: string;
  title: string;
  description: string;
  totalAmount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'partially_approved';
  submittedAt?: string;
  reviewedAt?: string;
  expiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: ProposalItem[];
  client?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

interface ProposalItem {
  id: string;
  proposalId: string;
  productType: string;
  productName: string;
  symbol?: string;
  recommendedAmount: number;
  currentPrice?: number;
  targetPrice?: number;
  rationale: string;
  riskLevel: string;
  expectedReturn?: number;
  timeHorizon?: string;
  priority: number;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  riskProfile?: string;
  investmentGoals?: string;
}

export default function AgentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<CkycClient | null>(null);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Investment proposal states
  const [proposalDialog, setProposalDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<InvestmentProposal | null>(null);
  const [proposalFilter, setProposalFilter] = useState<string>("all");

  // Fetch CKYC clients for care agents
  const { data: ckycClients, isLoading: clientsLoading } = useQuery<CkycClient[]>({
    queryKey: ["/api/agent/ckyc-clients"],
    queryFn: async () => {
      const response = await apiRequest("/api/agent/ckyc-clients");
      return response;
    }
  });

  // Fetch agent's notification triggers
  const { data: notificationTriggers, isLoading: triggersLoading } = useQuery<NotificationTrigger[]>({
    queryKey: ["/api/agent/notifications"],
    queryFn: async () => {
      const response = await apiRequest("/api/agent/notifications");
      return response;
    }
  });

  // Fetch investment proposals
  const { data: proposals, isLoading: proposalsLoading } = useQuery<InvestmentProposal[]>({
    queryKey: ["/api/proposals"],
    queryFn: async () => {
      const response = await apiRequest("/api/proposals");
      return response;
    }
  });

  // Fetch available clients for proposals
  const { data: clients, isLoading: clientsForProposalsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await apiRequest("/api/clients");
      return response;
    }
  });

  // Create notification trigger mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/agent/ckyc/notifications", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/notifications"] });
      setNotificationDialog(false);
      setSelectedClient(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Create investment proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/proposals", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Investment proposal created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setProposalDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Update proposal status mutation
  const updateProposalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest(`/api/proposals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Proposal updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      verified: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      under_review: { variant: "secondary", icon: AlertCircle }
    };

    const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getNotificationStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      sent: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle }
    };

    const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getProposalStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      draft: { variant: "outline", icon: FileText },
      sent: { variant: "secondary", icon: Send },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      partially_approved: { variant: "outline", icon: AlertCircle }
    };

    const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const filteredClients = ckycClients?.filter(client => {
    const matchesStatus = statusFilter === "all" || client.verificationStatus === statusFilter;
    const matchesSearch = !searchTerm || 
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.emailAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.mobileNumber.includes(searchTerm) ||
      client.panNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  }) || [];

  const filteredProposals = proposals?.filter(proposal => {
    const matchesStatus = proposalFilter === "all" || proposal.status === proposalFilter;
    return matchesStatus;
  }) || [];

  const pendingNotifications = notificationTriggers?.filter(trigger => trigger.status === "pending").length || 0;
  const sentNotifications = notificationTriggers?.filter(trigger => trigger.status === "sent").length || 0;
  const failedNotifications = notificationTriggers?.filter(trigger => trigger.status === "failed").length || 0;
  
  const draftProposals = proposals?.filter(p => p.status === "draft").length || 0;
  const sentProposals = proposals?.filter(p => p.status === "sent").length || 0;
  const approvedProposals = proposals?.filter(p => p.status === "approved").length || 0;
  const totalProposalValue = proposals?.reduce((sum, p) => sum + p.totalAmount, 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Care Agent Dashboard
          </h1>
          <p className="text-gray-600">Manage CKYC client communications and support</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <User size={16} />
          Partner Portal
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ckycClients?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active CKYC records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Notifications</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingNotifications}</div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentNotifications}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Notifications</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedNotifications}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="proposals" className="space-y-4">
        <ScrollableTabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <TrendingUp size={16} />
            Investment Proposals
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText size={16} />
            Client Reports
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users size={16} />
            CKYC Clients
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User size={16} />
            Profile Management
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <Shield size={16} />
            AML Compliance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell size={16} />
            Notifications History
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="proposals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Investment Proposals</CardTitle>
                  <CardDescription>Create and manage portfolio improvement proposals for clients</CardDescription>
                </div>
                <Button 
                  onClick={() => setProposalDialog(true)}
                  className="flex items-center gap-2"
                  data-testid="button-create-proposal"
                >
                  <Plus size={16} />
                  Create Proposal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Proposal Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{draftProposals}</p>
                        <p className="text-xs text-muted-foreground">Draft Proposals</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{sentProposals}</p>
                        <p className="text-xs text-muted-foreground">Sent Proposals</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{approvedProposals}</p>
                        <p className="text-xs text-muted-foreground">Approved</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-2">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">₹{totalProposalValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Proposal Filters */}
              <div className="flex items-center gap-4">
                <div className="w-40">
                  <Label htmlFor="proposal-filter">Filter by Status</Label>
                  <Select value={proposalFilter} onValueChange={setProposalFilter}>
                    <SelectTrigger data-testid="select-proposal-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="partially_approved">Partially Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Proposal List */}
              {proposalsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredProposals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No investment proposals found. Create your first proposal to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProposals.map((proposal) => (
                    <div 
                      key={proposal.id} 
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      data-testid={`card-proposal-${proposal.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{proposal.title}</h3>
                            {getProposalStatusBadge(proposal.status)}
                          </div>
                          <p className="text-sm text-gray-600">{proposal.description}</p>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <User size={14} />
                                {proposal.client ? `${proposal.client.firstName} ${proposal.client.lastName}` : 'Client ID: ' + proposal.clientId}
                              </span>
                              <span className="flex items-center gap-1">
                                <IndianRupee size={14} />
                                ₹{proposal.totalAmount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <PieChart size={14} />
                                {proposal.items.length} investment{proposal.items.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span>Created: {new Date(proposal.createdAt).toLocaleDateString()}</span>
                              {proposal.submittedAt && (
                                <span>Submitted: {new Date(proposal.submittedAt).toLocaleDateString()}</span>
                              )}
                              {proposal.expiresAt && (
                                <span className="text-orange-600">
                                  Expires: {new Date(proposal.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedProposal(proposal)}
                            data-testid={`button-view-proposal-${proposal.id}`}
                          >
                            <Eye size={16} className="mr-1" />
                            View
                          </Button>
                          {proposal.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updateProposalMutation.mutate({
                                  id: proposal.id,
                                  data: { status: 'sent', submittedAt: new Date().toISOString() }
                                });
                              }}
                              disabled={updateProposalMutation.isPending}
                              data-testid={`button-send-proposal-${proposal.id}`}
                            >
                              <Send size={16} className="mr-1" />
                              Send
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

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Transaction Reports
                </CardTitle>
                <CardDescription>
                  Request and download client transaction reports from registries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Portfolio Statements</p>
                      <p className="text-sm text-muted-foreground">Complete portfolio holdings</p>
                    </div>
                    <Button size="sm" data-testid="button-request-portfolio">
                      Request Report
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Transaction History</p>
                      <p className="text-sm text-muted-foreground">Buy/sell transaction details</p>
                    </div>
                    <Button size="sm" data-testid="button-request-transactions">
                      Request Report
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Dividend Summary</p>
                      <p className="text-sm text-muted-foreground">Dividend payments received</p>
                    </div>
                    <Button size="sm" data-testid="button-request-dividends">
                      Request Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Capital Gains Reports
                </CardTitle>
                <CardDescription>
                  Generate tax-ready capital gains statements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">FY 2023-24</p>
                      <p className="text-sm text-muted-foreground">Ready for ITR filing</p>
                    </div>
                    <Button size="sm" data-testid="button-request-fy2024">
                      Generate Report
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">FY 2024-25</p>
                      <p className="text-sm text-muted-foreground">Current financial year</p>
                    </div>
                    <Button size="sm" data-testid="button-request-fy2025">
                      Generate Report
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Custom Period</p>
                      <p className="text-sm text-muted-foreground">Select date range</p>
                    </div>
                    <Button size="sm" variant="outline" data-testid="button-request-custom">
                      Custom Range
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Report Requests</CardTitle>
              <CardDescription>Track status of requested client reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">John Doe - Portfolio Statement</p>
                      <p className="text-sm text-muted-foreground">Requested via CAMS • FY 2024-25</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Processing</Badge>
                    <Button size="sm" variant="outline" disabled>
                      Download
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <PieChart className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Jane Smith - Capital Gains Report</p>
                      <p className="text-sm text-muted-foreground">Generated via KFintech • FY 2023-24</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Ready</Badge>
                    <Button size="sm" data-testid="button-download-report">
                      Download
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-share-report">
                      Share
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <FileText className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Mike Johnson - Transaction History</p>
                      <p className="text-sm text-muted-foreground">Requested via MF Central • Q3 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Payment Required</Badge>
                    <Button size="sm" variant="outline" data-testid="button-pay-fee">
                      Pay ₹5
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <PieChart className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">Sarah Wilson - Capital Gains Report</p>
                      <p className="text-sm text-muted-foreground">Shared with client • Expires in 15 days</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Shared</Badge>
                    <Button size="sm" variant="outline" data-testid="button-extend-access">
                      Extend Access
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CKYC Client Management</CardTitle>
                  <CardDescription>Monitor and communicate with CKYC clients</CardDescription>
                </div>
                <Button 
                  onClick={() => setNotificationDialog(true)}
                  className="flex items-center gap-2"
                  disabled={!selectedClient}
                >
                  <Send size={16} />
                  Send Notification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Clients</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, email, mobile, or PAN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-40">
                  <Label htmlFor="status-filter">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Client List */}
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No CKYC clients found matching your criteria
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClients.map((client) => (
                    <div 
                      key={client.id} 
                      className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedClient?.id === client.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{client.firstName} {client.lastName}</h3>
                            {getStatusBadge(client.verificationStatus)}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Mail size={14} />
                                {client.emailAddress}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone size={14} />
                                {client.mobileNumber}
                              </span>
                            </div>
                            <div>PAN: {client.panNumber}</div>
                            {client.ckycNumber && <div>CKYC: {client.ckycNumber}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
                              setNotificationDialog(true);
                            }}
                          >
                            <MessageSquare size={16} className="mr-1" />
                            Notify
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>Track all sent notifications and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {triggersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : notificationTriggers?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No notifications sent yet</div>
              ) : (
                <div className="space-y-4">
                  {notificationTriggers?.map((trigger) => (
                    <div key={trigger.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{trigger.subject}</h4>
                            {getNotificationStatusBadge(trigger.status)}
                          </div>
                          <div className="text-sm text-gray-600">
                            <div>Type: {trigger.triggerType.replace("_", " ")}</div>
                            <div>Method: {trigger.notificationMethod}</div>
                            <div>Recipient: {trigger.recipientEmail || trigger.recipientMobile}</div>
                            <div>Created: {new Date(trigger.createdAt).toLocaleString()}</div>
                            {trigger.sentAt && (
                              <div>Sent: {new Date(trigger.sentAt).toLocaleString()}</div>
                            )}
                            {trigger.failureReason && (
                              <div className="text-red-600">Failure: {trigger.failureReason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Management Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Profile Management</CardTitle>
              <CardDescription>Manage client profiles, KYC details, and compliance information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input placeholder="Search by name, PAN, email..." className="flex-1" />
                  <Button variant="outline">
                    <Search size={16} className="mr-2" />
                    Search
                  </Button>
                </div>
                
                <div className="text-center py-8 text-gray-500">
                  Profile management features will be accessible here for agents to view and update client profiles, 
                  KYC documentation, and compliance status.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AML Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AML Compliance & Screening</CardTitle>
              <CardDescription>Perform AML screening, monitor compliance, and manage verification processes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold">0</p>
                          <p className="text-xs text-muted-foreground">Pending AML Screenings</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-2xl font-bold">0</p>
                          <p className="text-xs text-muted-foreground">High Risk Alerts</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-2xl font-bold">0</p>
                          <p className="text-xs text-muted-foreground">CKYC Registrations</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="text-center py-8 text-gray-500">
                  AML screening tools, CKYC verification, and compliance monitoring features 
                  are now secured under agent access for enhanced regulatory compliance.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Investment Proposal Dialogs */}
      <CreateProposalDialog 
        open={proposalDialog}
        onOpenChange={setProposalDialog}
        clients={clients || []}
        onSubmit={(data) => createProposalMutation.mutate(data)}
        isLoading={createProposalMutation.isPending}
      />

      <ViewProposalDialog 
        proposal={selectedProposal}
        open={!!selectedProposal}
        onOpenChange={(open) => !open && setSelectedProposal(null)}
      />

      {/* Notification Dialog */}
      <NotificationDialog 
        open={notificationDialog}
        onOpenChange={setNotificationDialog}
        selectedClient={selectedClient}
        onSubmit={(data) => createNotificationMutation.mutate(data)}
        isLoading={createNotificationMutation.isPending}
      />
    </div>
  );
}

// Investment Proposal Dialog Components
interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

interface ViewProposalDialogProps {
  proposal: InvestmentProposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateProposalDialog({ open, onOpenChange, clients, onSubmit, isLoading }: CreateProposalDialogProps) {
  const [formData, setFormData] = useState({
    clientId: "",
    title: "",
    description: "",
    expiresInDays: "30",
    items: [
      {
        productType: "mutual_fund",
        productName: "",
        symbol: "",
        recommendedAmount: "",
        rationale: "",
        riskLevel: "moderate",
        expectedReturn: "",
        timeHorizon: "1-3 years",
        priority: 1
      }
    ]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalAmount = formData.items.reduce((sum, item) => sum + parseFloat(item.recommendedAmount || "0"), 0);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expiresInDays));

    onSubmit({
      agentId: "demo-agent-1",
      clientId: formData.clientId,
      title: formData.title,
      description: formData.description,
      totalAmount,
      status: "draft",
      expiresAt: expiresAt.toISOString(),
      items: formData.items.map((item, index) => ({
        productType: item.productType,
        productName: item.productName,
        symbol: item.symbol || undefined,
        recommendedAmount: parseFloat(item.recommendedAmount || "0"),
        rationale: item.rationale,
        riskLevel: item.riskLevel,
        expectedReturn: item.expectedReturn ? parseFloat(item.expectedReturn) : undefined,
        timeHorizon: item.timeHorizon,
        priority: index + 1
      }))
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        productType: "mutual_fund",
        productName: "",
        symbol: "",
        recommendedAmount: "",
        rationale: "",
        riskLevel: "moderate",
        expectedReturn: "",
        timeHorizon: "1-3 years",
        priority: prev.items.length + 1
      }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Investment Proposal</DialogTitle>
          <DialogDescription>
            Create a new portfolio improvement proposal for your client
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId">Select Client</Label>
              <Select 
                value={formData.clientId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}
                required
              >
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.firstName} {client.lastName} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="expiresInDays">Expires In (Days)</Label>
              <Input 
                id="expiresInDays"
                type="number"
                value={formData.expiresInDays}
                onChange={(e) => setFormData(prev => ({ ...prev, expiresInDays: e.target.value }))}
                min="1"
                max="365"
                data-testid="input-expires-days"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Proposal Title</Label>
            <Input 
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              placeholder="e.g., Portfolio Diversification Strategy"
              data-testid="input-proposal-title"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
              placeholder="Describe the investment strategy and rationale..."
              rows={3}
              data-testid="textarea-proposal-description"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Investment Recommendations</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addItem}
                data-testid="button-add-investment"
              >
                <Plus size={16} className="mr-1" />
                Add Investment
              </Button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Investment #{index + 1}</h4>
                    {formData.items.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeItem(index)}
                        data-testid={`button-remove-investment-${index}`}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label>Product Type</Label>
                      <Select 
                        value={item.productType} 
                        onValueChange={(value) => updateItem(index, "productType", value)}
                      >
                        <SelectTrigger data-testid={`select-product-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                          <SelectItem value="equity">Equity</SelectItem>
                          <SelectItem value="bond">Bond</SelectItem>
                          <SelectItem value="etf">ETF</SelectItem>
                          <SelectItem value="sip">SIP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Product Name</Label>
                      <Input 
                        value={item.productName}
                        onChange={(e) => updateItem(index, "productName", e.target.value)}
                        required
                        placeholder="e.g., Axis Bluechip Fund"
                        data-testid={`input-product-name-${index}`}
                      />
                    </div>

                    <div>
                      <Label>Symbol (Optional)</Label>
                      <Input 
                        value={item.symbol}
                        onChange={(e) => updateItem(index, "symbol", e.target.value)}
                        placeholder="e.g., RELIANCE"
                        data-testid={`input-symbol-${index}`}
                      />
                    </div>

                    <div>
                      <Label>Recommended Amount (₹)</Label>
                      <Input 
                        type="number"
                        value={item.recommendedAmount}
                        onChange={(e) => updateItem(index, "recommendedAmount", e.target.value)}
                        required
                        min="100"
                        placeholder="50000"
                        data-testid={`input-amount-${index}`}
                      />
                    </div>

                    <div>
                      <Label>Risk Level</Label>
                      <Select 
                        value={item.riskLevel} 
                        onValueChange={(value) => updateItem(index, "riskLevel", value)}
                      >
                        <SelectTrigger data-testid={`select-risk-level-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Expected Return (%)</Label>
                      <Input 
                        type="number"
                        value={item.expectedReturn}
                        onChange={(e) => updateItem(index, "expectedReturn", e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="12.5"
                        data-testid={`input-expected-return-${index}`}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Time Horizon</Label>
                      <Select 
                        value={item.timeHorizon} 
                        onValueChange={(value) => updateItem(index, "timeHorizon", value)}
                      >
                        <SelectTrigger data-testid={`select-time-horizon-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="< 1 year">Less than 1 year</SelectItem>
                          <SelectItem value="1-3 years">1-3 years</SelectItem>
                          <SelectItem value="3-5 years">3-5 years</SelectItem>
                          <SelectItem value="> 5 years">More than 5 years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-3">
                      <Label>Investment Rationale</Label>
                      <Textarea 
                        value={item.rationale}
                        onChange={(e) => updateItem(index, "rationale", e.target.value)}
                        required
                        placeholder="Explain why this investment is recommended..."
                        rows={2}
                        data-testid={`textarea-rationale-${index}`}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-proposal">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="button-save-proposal">
              {isLoading ? "Creating..." : "Save as Draft"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewProposalDialog({ proposal, open, onOpenChange }: ViewProposalDialogProps) {
  if (!proposal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {proposal.title}
            {getProposalStatusBadge(proposal.status)}
          </DialogTitle>
          <DialogDescription>
            Investment proposal details and recommendations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Proposal Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proposal Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Client</Label>
                  <p className="text-sm">
                    {proposal.client ? 
                      `${proposal.client.firstName} ${proposal.client.lastName}` : 
                      `Client ID: ${proposal.clientId}`
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Total Investment Amount</Label>
                  <p className="text-lg font-semibold">₹{proposal.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created Date</Label>
                  <p className="text-sm">{new Date(proposal.createdAt).toLocaleDateString()}</p>
                </div>
                {proposal.expiresAt && (
                  <div>
                    <Label className="text-sm font-medium">Expires On</Label>
                    <p className="text-sm text-orange-600">{new Date(proposal.expiresAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-gray-600">{proposal.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Investment Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investment Recommendations ({proposal.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposal.items.map((item, index) => (
                  <Card key={index} className="p-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Product Type</Label>
                        <p className="text-sm font-medium">{item.productType.replace("_", " ").toUpperCase()}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Product Name</Label>
                        <p className="text-sm font-medium">{item.productName}</p>
                      </div>
                      {item.symbol && (
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Symbol</Label>
                          <p className="text-sm">{item.symbol}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Recommended Amount</Label>
                        <p className="text-sm font-semibold">₹{item.recommendedAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Risk Level</Label>
                        <Badge variant={item.riskLevel === 'high' ? 'destructive' : item.riskLevel === 'moderate' ? 'secondary' : 'outline'}>
                          {item.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      {item.expectedReturn && (
                        <div>
                          <Label className="text-xs font-medium text-gray-500">Expected Return</Label>
                          <p className="text-sm">{item.expectedReturn}% p.a.</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-gray-500">Time Horizon</Label>
                        <p className="text-sm">{item.timeHorizon}</p>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <Label className="text-xs font-medium text-gray-500">Investment Rationale</Label>
                        <p className="text-sm text-gray-600">{item.rationale}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} data-testid="button-close-proposal">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function for proposal status badges
const getProposalStatusBadge = (status: string) => {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
    draft: { variant: "outline", icon: FileText },
    sent: { variant: "secondary", icon: Send },
    approved: { variant: "default", icon: CheckCircle },
    rejected: { variant: "destructive", icon: XCircle },
    partially_approved: { variant: "outline", icon: AlertCircle }
  };

  const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon size={12} />
      {status.replace("_", " ").toUpperCase()}
    </Badge>
  );
};

// Notification Dialog Component
interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClient: CkycClient | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function NotificationDialog({ open, onOpenChange, selectedClient, onSubmit, isLoading }: NotificationDialogProps) {
  const [formData, setFormData] = useState({
    triggerType: "care_agent_followup",
    notificationMethod: "email",
    recipientEmail: "",
    recipientMobile: "",
    subject: "",
    message: "",
    triggerredBy: "care_agent"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    onSubmit({
      ...formData,
      ckycRecordId: selectedClient.id,
      recipientEmail: formData.notificationMethod === "email" || formData.notificationMethod === "both" 
        ? (formData.recipientEmail || selectedClient.emailAddress) : undefined,
      recipientMobile: formData.notificationMethod === "sms" || formData.notificationMethod === "both"
        ? (formData.recipientMobile || selectedClient.mobileNumber) : undefined
    });
  };

  // Reset form when client changes
  React.useEffect(() => {
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        recipientEmail: selectedClient.emailAddress,
        recipientMobile: selectedClient.mobileNumber
      }));
    }
  }, [selectedClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Client Notification</DialogTitle>
          <DialogDescription>
            {selectedClient ? 
              `Send a notification to ${selectedClient.firstName} ${selectedClient.lastName}` :
              "Select a client to send notifications"
            }
          </DialogDescription>
        </DialogHeader>
        
        {selectedClient ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="triggerType">Notification Type</Label>
              <Select 
                value={formData.triggerType} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="care_agent_followup">Follow-up</SelectItem>
                  <SelectItem value="document_reminder">Document Reminder</SelectItem>
                  <SelectItem value="status_update">Status Update</SelectItem>
                  <SelectItem value="verification_required">Verification Required</SelectItem>
                  <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notificationMethod">Notification Method</Label>
              <Select 
                value={formData.notificationMethod} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, notificationMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="sms">SMS Only</SelectItem>
                  <SelectItem value="both">Both Email & SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input 
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                required
                placeholder="Notification subject"
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea 
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                required
                placeholder="Your message to the client..."
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Notification"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 text-gray-500">
            Please select a client from the list to send notifications
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}