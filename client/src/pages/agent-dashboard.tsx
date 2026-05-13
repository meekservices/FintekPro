import { useState, useEffect, FormEvent, Suspense } from "react";
import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import AINextActions from "@/components/agent/ai-next-actions";
import PickOfTheDayWidget from "@/components/agent/pick-of-the-day-widget";
import { 
  LucideShield, 
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
  Trash2,
  Briefcase,
  Receipt,
  Building2,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  DollarSign,
  Video,
  ExternalLink,
  Brain,
  UserPlus
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";

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

interface TDSSummary {
  quarter: string;
  totalTDS: number;
  clientsCount: number;
  filed: boolean;
  dueDate: string;
  status: "filed" | "pending" | "overdue";
}

interface ITRCase {
  id: string;
  clientId: string;
  clientName: string;
  panNumber: string;
  assessmentYear: string;
  itrForm: string;
  status: "draft" | "pending_documents" | "under_review" | "assigned_to_ca" | "ca_review" | "filed" | "rejected";
  assignedCA?: string;
  caName?: string;
  createdAt: string;
  lastUpdated: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  totalIncome?: number;
  taxLiability?: number;
}

interface ClientOverview {
  totalClients: number;
  activeClients: number;
  newThisMonth: number;
  kycPending: number;
  itrPending: number;
  totalAUM: number;
  revenueThisMonth: number;
  complianceScore: number;
}

interface MeetingBooking {
  id: string;
  topic: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: string;
  startLink?: string;
  joinLink?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientNotes?: string;
  createdAt: string;
}

interface MeetingClient {
  id: string;
  fullName: string;
  email: string;
  username: string;
}

function AgentQuickStatsSection() {
  const { data: ckycClients } = useSuspenseQuery<CkycClient[]>({
    queryKey: ["/api/agent/ckyc-clients"],
    queryFn: async () => apiRequest("/api/agent/ckyc-clients"),
  });
  const { data: notificationTriggers } = useSuspenseQuery<NotificationTrigger[]>({
    queryKey: ["/api/agent/notifications"],
    queryFn: async () => apiRequest("/api/agent/notifications"),
  });
  const pending = notificationTriggers?.filter(t => t.status === "pending").length ?? 0;
  const sent = notificationTriggers?.filter(t => t.status === "sent").length ?? 0;
  const failed = notificationTriggers?.filter(t => t.status === "failed").length ?? 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Total Clients</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold">{ckycClients?.length ?? 0}</div>
          <p className="text-xs text-muted-foreground">Active CKYC records</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold">{pending}</div>
          <p className="text-xs text-muted-foreground">Awaiting delivery</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Sent Today</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold">{sent}</div>
          <p className="text-xs text-muted-foreground">Successfully delivered</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-xs sm:text-sm font-medium">Failed</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
          <div className="text-xl sm:text-2xl font-bold">{failed}</div>
          <p className="text-xs text-muted-foreground">Need attention</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentKeyMetricsSection() {
  const { data: overviewData } = useSuspenseQuery<ClientOverview>({
    queryKey: ["/api/agent/dashboard/overview"],
  });
  const { data: ckycClients } = useSuspenseQuery<CkycClient[]>({
    queryKey: ["/api/agent/ckyc-clients"],
    queryFn: async () => apiRequest("/api/agent/ckyc-clients"),
  });
  const overview: ClientOverview = overviewData ?? {
    totalClients: ckycClients?.length ?? 0,
    activeClients: 0,
    newThisMonth: 0,
    kycPending: 0,
    itrPending: 0,
    totalAUM: 0,
    revenueThisMonth: 0,
    complianceScore: 0,
  };
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900" data-testid="card-total-clients">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-total-clients">{overview.totalClients}</div>
              <p className="text-xs text-blue-600 dark:text-blue-400">+{overview.newThisMonth} this month</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900" data-testid="card-total-aum">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Total AUM</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100" data-testid="text-total-aum">
                ₹{(overview.totalAUM / 10000000).toFixed(1)}Cr
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">Assets under mgmt</p>
            </div>
            <IndianRupee className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900" data-testid="card-revenue">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">Revenue (MTD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100" data-testid="text-revenue">
                ₹{(overview.revenueThisMonth / 1000).toFixed(0)}K
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">This month</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900" data-testid="card-compliance">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">Compliance Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100" data-testid="text-compliance-score">
                {overview.complianceScore}%
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">Excellent</p>
            </div>
            <LucideShield className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentRecentActivitySection() {
  const { data: recentActivityData } = useSuspenseQuery<Array<{ id: number; type: string; client: string; message: string; time: string }>>({
    queryKey: ["/api/agent/dashboard/recent-activity"],
  });
  const recentActivity = recentActivityData ?? [];
  return (
    <Card data-testid="card-recent-activity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center gap-4 p-3 bg-muted rounded-lg" data-testid={`activity-${activity.id}`}>
              <div className={`p-2 rounded-full ${
                activity.type === 'itr_filed' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                activity.type === 'kyc_completed' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                activity.type === 'ca_assigned' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                activity.type === 'payment_received' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {activity.type === 'itr_filed' ? <FileText className="h-4 w-4" /> :
                 activity.type === 'kyc_completed' ? <CheckCircle className="h-4 w-4" /> :
                 activity.type === 'ca_assigned' ? <UserCheck className="h-4 w-4" /> :
                 activity.type === 'payment_received' ? <IndianRupee className="h-4 w-4" /> :
                 <FileText className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{activity.client}</p>
                <p className="text-xs text-muted-foreground">{activity.message}</p>
              </div>
              <span className="text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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

  // Meeting states
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [meetingClientId, setMeetingClientId] = useState("");
  const [meetingTopic, setMeetingTopic] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(30);

  // Add Prospect dialog states
  const [addProspectDialog, setAddProspectDialog] = useState(false);
  const [prospectName, setProspectName] = useState("");
  const [prospectMobile, setProspectMobile] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectPan, setProspectPan] = useState("");
  const [prospectNotes, setProspectNotes] = useState("");
  const [createdProspectId, setCreatedProspectId] = useState<string | null>(null);

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

  // Fetch agent's meeting bookings
  const { data: meetingsData, isLoading: meetingsLoading } = useQuery<{ bookings: MeetingBooking[] }>({
    queryKey: ["/api/meetings/agent-bookings"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/agent-bookings");
      return response;
    }
  });

  // Fetch clients for meetings
  const { data: meetingClientsData, isLoading: meetingClientsLoading } = useQuery<{ clients: MeetingClient[] }>({
    queryKey: ["/api/meetings/agent-clients"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/agent-clients");
      return response;
    }
  });

  // Fetch pending meeting requests from clients
  const { data: pendingRequestsData, isLoading: pendingRequestsLoading } = useQuery<{ requests: MeetingBooking[] }>({
    queryKey: ["/api/meetings/pending-requests"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/pending-requests");
      return response;
    }
  });

  // Fetch dashboard overview data
  const { data: overviewData } = useQuery<ClientOverview>({
    queryKey: ["/api/agent/dashboard/overview"]
  });


  // Fetch ITR cases
  const { data: itrCasesData, isLoading: itrCasesLoading } = useQuery<ITRCase[]>({
    queryKey: ["/api/agent/itr-cases"]
  });

  // Fetch CA list
  const { data: caListData, isLoading: caListLoading } = useQuery<Array<{ id: string; name: string; specialization: string; activeCase: number }>>({
    queryKey: ["/api/agent/ca-list"]
  });

  // Fetch TDS summary
  const { data: tdsSummaryData, isLoading: tdsSummaryLoading } = useQuery<TDSSummary[]>({
    queryKey: ["/api/agent/tds-summary"]
  });

  // Approve meeting request mutation
  const approveMeetingMutation = useMutation({
    mutationFn: async ({ id, scheduledAt, agentNotes }: { id: string; scheduledAt?: string; agentNotes?: string }) => {
      const response = await apiRequest(`/api/meetings/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt, agentNotes }),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Meeting request approved and scheduled" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/pending-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/agent-bookings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Decline meeting request mutation
  const declineMeetingMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await apiRequest(`/api/meetings/${id}/decline`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Request Declined", description: "The meeting request has been declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/pending-requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  // Schedule meeting mutation
  const scheduleMeetingMutation = useMutation({
    mutationFn: async (data: { clientId: string; topic: string; description?: string; scheduledAt: string; duration: number }) => {
      const response = await apiRequest("/api/meetings/agent-book", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Meeting scheduled successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/agent-bookings"] });
      setMeetingDialog(false);
      resetMeetingForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Cancel meeting mutation
  const cancelMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const response = await apiRequest(`/api/meetings/${meetingId}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: "Cancelled by agent" }),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Meeting cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/agent-bookings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Create prospect mutation
  const createProspectMutation = useMutation({
    mutationFn: async (data: { name: string; mobile?: string; email?: string; pan?: string; notes?: string }) => {
      const response = await apiRequest("/api/agent-wizard/prospects", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: (data: { success: boolean; prospectId: string }) => {
      toast({ title: "Success", description: "Prospect added successfully" });
      setCreatedProspectId(data.prospectId);
      queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/prospects"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const resetProspectForm = () => {
    setProspectName("");
    setProspectMobile("");
    setProspectEmail("");
    setProspectPan("");
    setProspectNotes("");
    setCreatedProspectId(null);
  };

  const handleAddProspect = () => {
    if (!prospectName.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    createProspectMutation.mutate({
      name: prospectName.trim(),
      mobile: prospectMobile.trim() || undefined,
      email: prospectEmail.trim() || undefined,
      pan: prospectPan.trim().toUpperCase() || undefined,
      notes: prospectNotes.trim() || undefined
    });
  };

  const handleCloseProspectDialog = () => {
    setAddProspectDialog(false);
    resetProspectForm();
  };

  const handleContinueToWizard = () => {
    if (createdProspectId) {
      window.location.href = `/agent-prospect-wizard?prospectId=${createdProspectId}&step=2`;
    }
  };

  const resetMeetingForm = () => {
    setMeetingClientId("");
    setMeetingTopic("");
    setMeetingDescription("");
    setMeetingDate("");
    setMeetingTime("");
    setMeetingDuration(30);
  };

  const handleScheduleMeeting = () => {
    if (!meetingClientId || !meetingTopic || !meetingDate || !meetingTime) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(`${meetingDate}T${meetingTime}`).toISOString();
    scheduleMeetingMutation.mutate({
      clientId: meetingClientId,
      topic: meetingTopic,
      description: meetingDescription,
      scheduledAt,
      duration: meetingDuration
    });
  };

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
        {(status || 'pending').replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getNotificationStatusBadge = (status: string | undefined) => {
    const safeStatus = status || 'pending';
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      sent: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle }
    };

    const config = statusConfig[safeStatus] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {safeStatus.toUpperCase()}
      </Badge>
    );
  };

  const getProposalStatusBadge = (status: string | undefined) => {
    const safeStatus = status || 'draft';
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      draft: { variant: "outline", icon: FileText },
      sent: { variant: "secondary", icon: Send },
      approved: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      partially_approved: { variant: "outline", icon: AlertCircle }
    };

    const config = statusConfig[safeStatus] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {safeStatus.replace("_", " ").toUpperCase()}
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
            <LucideShield className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            Care Agent Dashboard
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">Manage CKYC client communications and support</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setAddProspectDialog(true)} data-testid="button-add-prospect">
            <UserPlus size={16} className="mr-1" />
            Add Prospect
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => window.location.href = '/proposal-builder'} data-testid="button-quick-proposal">
            <Plus size={16} className="mr-1" />
            New Proposal
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/clients'} data-testid="button-quick-clients">
            <Users size={16} className="mr-1" />
            View Clients
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.href = '/tasks'} data-testid="button-quick-tasks">
            <Target size={16} className="mr-1" />
            Tasks
          </Button>
          <Badge variant="secondary" className="flex items-center gap-2 ml-2">
            <User size={16} />
            Agent Portal
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingState variant="section-stats-row" />}>
        <AgentQuickStatsSection />
      </Suspense>

      <Tabs defaultValue="overview" className="space-y-4">
        <ScrollableTabsList className="w-full">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <BarChart3 size={16} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="itr-cases" className="flex items-center gap-2" data-testid="tab-itr-cases">
            <ClipboardList size={16} />
            ITR Cases
          </TabsTrigger>
          <TabsTrigger value="tds-summary" className="flex items-center gap-2" data-testid="tab-tds-summary">
            <Receipt size={16} />
            TDS Summary
          </TabsTrigger>
          <TabsTrigger value="proposals" className="flex items-center gap-2">
            <TrendingUp size={16} />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users size={16} />
            Clients
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <LucideShield size={16} />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell size={16} />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="meetings" className="flex items-center gap-2" data-testid="tab-meetings">
            <Video size={16} />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="ai-actions" className="flex items-center gap-2" data-testid="tab-ai-actions">
            <Brain size={16} />
            AI Actions
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Client Overview At-a-Glance Tab */}
        <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
          {(() => {
            const overview: ClientOverview = overviewData || {
              totalClients: ckycClients?.length || 0,
              activeClients: 0,
              newThisMonth: 0,
              kycPending: 0,
              itrPending: 0,
              totalAUM: 0,
              revenueThisMonth: 0,
              complianceScore: 0
            };
            
            const clientsByStatus = ckycClients ? [
              { status: "KYC Complete", count: ckycClients.filter(c => c.verificationStatus === 'verified').length, color: "bg-green-500" },
              { status: "KYC Pending", count: ckycClients.filter(c => c.verificationStatus === 'pending').length, color: "bg-yellow-500" },
              { status: "Documents Required", count: ckycClients.filter(c => c.verificationStatus === 'documents_required').length, color: "bg-orange-500" },
              { status: "Inactive", count: ckycClients.filter(c => c.verificationStatus === 'inactive').length, color: "bg-muted-foreground" }
            ] : [];
            
            return (
              <>
                {/* Key Metrics Grid */}
                <Suspense fallback={<LoadingState variant="section-stats-row" />}>
                  <AgentKeyMetricsSection />
                </Suspense>

                {/* Pick of the Day Widget */}
                <Suspense fallback={<LoadingState variant="section-chart" />}>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <PickOfTheDayWidget />
                    </div>
                  </div>
                </Suspense>

                {/* Action Items & Client Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pending Actions */}
                  <Card data-testid="card-pending-actions">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Pending Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-3">
                          <ClipboardList className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="font-medium text-sm">ITR Filings Pending</p>
                            <p className="text-xs text-muted-foreground">{overview.itrPending} clients awaiting filing</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950" data-testid="button-view-itr-pending">
                          View <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center gap-3">
                          <UserCheck className="h-5 w-5 text-yellow-600" />
                          <div>
                            <p className="font-medium text-sm">KYC Pending</p>
                            <p className="text-xs text-muted-foreground">{overview.kycPending} clients need verification</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="border-yellow-200 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-800 dark:text-yellow-300 dark:hover:bg-yellow-950" data-testid="button-view-kyc-pending">
                          View <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3">
                          <Receipt className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-sm">TDS Returns Due</p>
                            <p className="text-xs text-muted-foreground">Q3 filing due in 15 days</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950" data-testid="button-view-tds-due">
                          View <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Client Distribution */}
                  <Card data-testid="card-client-distribution">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Client Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {clientsByStatus.map((item, idx) => (
                        <div key={idx} className="space-y-2" data-testid={`distribution-${(item.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${item.color}`} />
                              {item.status}
                            </span>
                            <span className="font-medium">{item.count}</span>
                          </div>
                          <Progress value={(item.count / (overview.totalClients || 1)) * 100} className="h-2" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Suspense fallback={<LoadingState variant="section-table" count={5} />}>
                  <AgentRecentActivitySection />
                </Suspense>
              </>
            );
          })()}
        </TabsContent>

        {/* ITR Case Management Tab */}
        <TabsContent value="itr-cases" className="space-y-4" data-testid="content-itr-cases">
          {(() => {
            const itrCases: ITRCase[] = itrCasesData || [];
            
            const caList = caListData || [];
            
            const getStatusBadgeColor = (status: string) => {
              switch (status) {
                case "filed": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
                case "ca_review": return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
                case "assigned_to_ca": return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                case "pending_documents": return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800";
                case "draft": return "bg-muted text-muted-foreground border-border";
                default: return "bg-muted text-muted-foreground border-border";
              }
            };
            
            const getPriorityBadge = (priority: string) => {
              switch (priority) {
                case "high": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
                case "medium": return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
                default: return "bg-muted text-muted-foreground";
              }
            };
            
            return (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5" />
                          ITR Case Management
                        </CardTitle>
                        <CardDescription>Manage client ITR filings with CA assignment workflow</CardDescription>
                      </div>
                      <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" data-testid="button-new-itr-case">
                        <Plus className="h-4 w-4 mr-2" /> New Case
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <div className="text-2xl font-bold">{itrCases.length}</div>
                        <p className="text-xs text-muted-foreground">Total Cases</p>
                      </div>
                      <div className="p-3 bg-orange-50 dark:bg-orange-900 rounded-lg text-center">
                        <div className="text-2xl font-bold text-orange-600">{itrCases.filter(c => c.status === "pending_documents").length}</div>
                        <p className="text-xs text-muted-foreground">Pending Docs</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{itrCases.filter(c => c.status === "assigned_to_ca").length}</div>
                        <p className="text-xs text-muted-foreground">With CA</p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-900 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">{itrCases.filter(c => c.status === "ca_review").length}</div>
                        <p className="text-xs text-muted-foreground">CA Review</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{itrCases.filter(c => c.status === "filed").length}</div>
                        <p className="text-xs text-muted-foreground">Filed</p>
                      </div>
                    </div>
                    
                    {/* Cases List */}
                    <div className="space-y-3">
                      {itrCases.map((itrCase) => (
                        <div key={itrCase.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow" data-testid={`itr-case-${itrCase.id}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <div className="p-2 bg-muted rounded-lg">
                                <FileText className="h-6 w-6" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{itrCase.clientName}</h4>
                                  <Badge className={`text-xs ${getPriorityBadge(itrCase.priority)}`}>
                                    {itrCase.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>PAN: {itrCase.panNumber}</span>
                                  <span>•</span>
                                  <span>{itrCase.itrForm}</span>
                                  <span>•</span>
                                  <span>AY {itrCase.assessmentYear}</span>
                                </div>
                                {itrCase.caName && (
                                  <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" /> Assigned to {itrCase.caName}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={`${getStatusBadgeColor(itrCase.status)}`}>
                                {(itrCase.status || 'pending').replace(/_/g, " ").toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Due: {itrCase.dueDate}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-4 pt-3 border-t">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-muted-foreground">Income: ₹{(itrCase.totalIncome || 0).toLocaleString()}</span>
                              <span className="text-orange-600">Tax: ₹{(itrCase.taxLiability || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2">
                              {!itrCase.assignedCA && itrCase.status !== "filed" && (
                                <Select>
                                  <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`select-ca-${itrCase.id}`}>
                                    <SelectValue placeholder="Assign CA" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {caList.map(ca => (
                                      <SelectItem key={ca.id} value={ca.id}>
                                        {ca.name} ({ca.activeCase} cases)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button size="sm" variant="outline" data-testid={`button-view-case-${itrCase.id}`}>
                                <Eye className="h-3 w-3 mr-1" /> View
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* TDS Summary Tab */}
        <TabsContent value="tds-summary" className="space-y-4" data-testid="content-tds-summary">
          {(() => {
            const tdsSummary: TDSSummary[] = Array.isArray(tdsSummaryData) ? tdsSummaryData : [];
            
            const totalTDSCollected = tdsSummary.reduce((acc, q) => acc + (q.totalTDS || 0), 0);
            const filedQuarters = tdsSummary.filter(q => q.filed).length;
            
            const nextDue = tdsSummary.find(q => !q.filed);
            
            const tdsBreakdown: Array<{ category: string; amount: number; percentage: number }> = [];
            
            return (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900" data-testid="card-total-tds">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">Total TDS Collected</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-total-tds-collected">
                        ₹{(totalTDSCollected / 100000).toFixed(1)}L
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400">FY 2024-25</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900" data-testid="card-filed-returns">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Returns Filed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-900 dark:text-green-100" data-testid="text-filed-returns">
                        {filedQuarters}/4
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400">Quarters completed</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900" data-testid="card-next-due">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">Next Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-900 dark:text-orange-100" data-testid="text-next-due">
                        {nextDue ? new Date(nextDue.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'N/A'}
                      </div>
                      <p className="text-xs text-orange-600 dark:text-orange-400">{nextDue?.quarter || 'No pending'}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quarterly Summary */}
                  <Card data-testid="card-quarterly-summary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Quarterly TDS Summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {tdsSummary.map((quarter, idx) => (
                          <div key={idx} className="p-4 border rounded-lg" data-testid={`tds-quarter-${idx}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                  quarter.status === "filed" ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                                  quarter.status === "overdue" ? "bg-red-100 dark:bg-red-900/30 text-red-600" :
                                  "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                                }`}>
                                  <Receipt className="h-5 w-5" />
                                </div>
                                <div>
                                  <h4 className="font-semibold">{quarter.quarter}</h4>
                                  <p className="text-xs text-muted-foreground">{quarter.clientsCount} clients • Due: {quarter.dueDate}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">₹{(quarter.totalTDS ?? 0).toLocaleString()}</div>
                                <Badge className={`text-xs ${
                                  quarter.status === "filed" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                                  quarter.status === "overdue" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" :
                                  "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                                }`}>
                                  {(quarter.status || 'pending').toUpperCase()}
                                </Badge>
                              </div>
                            </div>
                            {!quarter.filed && quarter.totalTDS > 0 && (
                              <Button size="sm" className="w-full mt-2" data-testid={`button-file-tds-${idx}`}>
                                File TDS Return
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* TDS Breakdown by Category */}
                  <Card data-testid="card-tds-breakdown">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        TDS by Category
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {tdsBreakdown.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No TDS breakdown data available</p>
                            <p className="text-xs">TDS categories will appear here once data is available</p>
                          </div>
                        ) : (
                          tdsBreakdown.map((item, idx) => (
                            <div key={idx} className="space-y-2" data-testid={`tds-category-${idx}`}>
                              <div className="flex items-center justify-between text-sm">
                                <span>{item.category}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">₹{(item.amount / 1000).toFixed(0)}K</span>
                                  <Badge variant="secondary" className="text-xs">{item.percentage}%</Badge>
                                </div>
                              </div>
                              <Progress value={item.percentage} className="h-2" />
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Compliance Status</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">All filings on track</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            );
          })()}
        </TabsContent>

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
                        <p className="text-2xl font-bold">₹{(totalProposalValue ?? 0).toLocaleString()}</p>
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
                <div className="text-center py-8 text-muted-foreground">
                  No investment proposals found. Create your first proposal to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProposals.map((proposal) => (
                    <div 
                      key={proposal.id} 
                      className="border rounded-lg p-4 hover:bg-muted transition-colors"
                      data-testid={`card-proposal-${proposal.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{proposal.title}</h3>
                            {getProposalStatusBadge(proposal.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{proposal.description}</p>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <User size={14} />
                                {proposal.client ? `${proposal.client.firstName} ${proposal.client.lastName}` : 'Client ID: ' + proposal.clientId}
                              </span>
                              <span className="flex items-center gap-1">
                                <IndianRupee size={14} />
                                ₹{(proposal.totalAmount ?? 0).toLocaleString()}
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
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
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
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
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
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
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
                    <div className="p-2 bg-muted rounded-full">
                      <PieChart className="h-4 w-4 text-muted-foreground" />
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
                <div className="text-center py-8 text-muted-foreground">
                  No CKYC clients found matching your criteria
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClients.map((client) => (
                    <div 
                      key={client.id} 
                      className={`border rounded-lg p-4 hover:bg-muted cursor-pointer transition-colors ${
                        selectedClient?.id === client.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''
                      }`}
                      onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{client.firstName} {client.lastName}</h3>
                            {getStatusBadge(client.verificationStatus)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
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
                <div className="text-center py-8 text-muted-foreground">No notifications sent yet</div>
              ) : (
                <div className="space-y-4">
                  {notificationTriggers?.map((trigger) => (
                    <div key={trigger.id} className="border rounded-lg p-4 hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{trigger.subject}</h4>
                            {getNotificationStatusBadge(trigger.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>Type: {(trigger.triggerType || 'notification').replace("_", " ")}</div>
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
                
                <div className="text-center py-8 text-muted-foreground">
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
                        <LucideShield className="h-4 w-4 text-green-600" />
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

                <div className="text-center py-8 text-muted-foreground">
                  AML screening tools, CKYC verification, and compliance monitoring features 
                  are now secured under agent access for enhanced regulatory compliance.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-4" data-testid="content-meetings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="h-5 w-5 text-blue-600" />
                    Client Meetings
                  </CardTitle>
                  <CardDescription>Schedule and manage video meetings with your clients via Zoho Meetings</CardDescription>
                </div>
                <Dialog open={meetingDialog} onOpenChange={setMeetingDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2" data-testid="button-schedule-meeting">
                      <Plus size={16} />
                      Schedule Meeting
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Schedule New Meeting</DialogTitle>
                      <DialogDescription>Book a video call with your client</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="meeting-client">Select Client *</Label>
                        <Select value={meetingClientId} onValueChange={setMeetingClientId}>
                          <SelectTrigger id="meeting-client" data-testid="select-meeting-client">
                            <SelectValue placeholder="Choose a client" />
                          </SelectTrigger>
                          <SelectContent>
                            {meetingClientsData?.clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.fullName} ({client.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meeting-topic">Topic *</Label>
                        <Input
                          id="meeting-topic"
                          placeholder="e.g., Portfolio Review, Investment Discussion"
                          value={meetingTopic}
                          onChange={(e) => setMeetingTopic(e.target.value)}
                          data-testid="input-meeting-topic"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meeting-description">Description</Label>
                        <Textarea
                          id="meeting-description"
                          placeholder="Meeting agenda or notes..."
                          value={meetingDescription}
                          onChange={(e) => setMeetingDescription(e.target.value)}
                          data-testid="input-meeting-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="meeting-date">Date *</Label>
                          <Input
                            id="meeting-date"
                            type="date"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            data-testid="input-meeting-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="meeting-time">Time *</Label>
                          <Input
                            id="meeting-time"
                            type="time"
                            value={meetingTime}
                            onChange={(e) => setMeetingTime(e.target.value)}
                            data-testid="input-meeting-time"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="meeting-duration">Duration (minutes)</Label>
                        <Select value={meetingDuration.toString()} onValueChange={(v) => setMeetingDuration(parseInt(v))}>
                          <SelectTrigger id="meeting-duration" data-testid="select-meeting-duration">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="45">45 minutes</SelectItem>
                            <SelectItem value="60">1 hour</SelectItem>
                            <SelectItem value="90">1.5 hours</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleScheduleMeeting}
                        disabled={scheduleMeetingMutation.isPending}
                        data-testid="button-confirm-schedule"
                      >
                        {scheduleMeetingMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scheduling...
                          </>
                        ) : (
                          <>
                            <Video className="mr-2 h-4 w-4" />
                            Schedule Meeting
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Pending Meeting Requests Section */}
              {pendingRequestsData?.requests && pendingRequestsData.requests.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3 text-orange-700 dark:text-orange-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Meeting Requests ({pendingRequestsData.requests.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingRequestsData.requests.map((request) => (
                      <div key={request.id} className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 dark:bg-orange-950" data-testid={`request-card-${request.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <h4 className="font-medium">{request.topic}</h4>
                            <p className="text-sm text-muted-foreground">
                              From: {request.clientName || "Client"} {request.clientEmail && `(${request.clientEmail})`}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Preferred: {new Date(request.scheduledAt).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(request.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span>{request.duration} min</span>
                            </div>
                            {request.clientNotes && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                Notes: {request.clientNotes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => approveMeetingMutation.mutate({ id: request.id })}
                              disabled={approveMeetingMutation.isPending}
                              data-testid={`button-approve-${request.id}`}
                            >
                              {approveMeetingMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50 dark:bg-red-950/30"
                              onClick={() => declineMeetingMutation.mutate({ id: request.id })}
                              disabled={declineMeetingMutation.isPending}
                              data-testid={`button-decline-${request.id}`}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {meetingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : meetingsData?.bookings && meetingsData.bookings.length > 0 ? (
                <div className="space-y-4">
                  {/* Upcoming Meetings */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-green-700 dark:text-green-300 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Upcoming Meetings
                    </h3>
                    <div className="space-y-3">
                      {meetingsData.bookings
                        .filter((m) => new Date(m.scheduledAt) >= new Date() && m.status === "confirmed")
                        .map((meeting) => (
                          <div key={meeting.id} className="border rounded-lg p-4 bg-green-50 dark:bg-green-950" data-testid={`meeting-card-${meeting.id}`}>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h4 className="font-medium">{meeting.topic}</h4>
                                <p className="text-sm text-muted-foreground">
                                  Client: {meeting.clientName || "Unknown"}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(meeting.scheduledAt).toLocaleDateString()}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span>{meeting.duration} min</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {meeting.startLink && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => window.open(meeting.startLink, '_blank')}
                                    data-testid={`button-start-meeting-${meeting.id}`}
                                  >
                                    <ExternalLink className="mr-1 h-3 w-3" />
                                    Start
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50 dark:bg-red-950/30"
                                  onClick={() => cancelMeetingMutation.mutate(meeting.id)}
                                  disabled={cancelMeetingMutation.isPending}
                                  data-testid={`button-cancel-meeting-${meeting.id}`}
                                >
                                  <XCircle className="mr-1 h-3 w-3" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      {meetingsData.bookings.filter((m) => new Date(m.scheduledAt) >= new Date() && m.status === "confirmed").length === 0 && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No upcoming meetings scheduled</p>
                      )}
                    </div>
                  </div>

                  {/* Past Meetings */}
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Past Meetings
                    </h3>
                    <div className="space-y-2">
                      {meetingsData.bookings
                        .filter((m) => new Date(m.scheduledAt) < new Date() || m.status !== "confirmed")
                        .slice(0, 5)
                        .map((meeting) => (
                          <div key={meeting.id} className="border rounded-lg p-3 bg-muted opacity-75">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-sm">{meeting.topic}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {meeting.clientName} • {new Date(meeting.scheduledAt).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge variant={meeting.status === "cancelled" ? "destructive" : "secondary"}>
                                {meeting.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Meetings Scheduled</h3>
                  <p className="text-muted-foreground mb-4">
                    Schedule your first video meeting with a client using Zoho Meetings
                  </p>
                  <Button onClick={() => setMeetingDialog(true)} data-testid="button-schedule-first-meeting">
                    <Plus className="mr-2 h-4 w-4" />
                    Schedule Meeting
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Next-Best-Actions Tab */}
        <TabsContent value="ai-actions" className="space-y-4" data-testid="content-ai-actions">
          <AINextActions />
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

      {/* Add Prospect Dialog */}
      <Dialog open={addProspectDialog} onOpenChange={(open) => !open && handleCloseProspectDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Add New Prospect
            </DialogTitle>
            <DialogDescription>
              Quickly add a new prospect to your list. You can continue to the full wizard after saving.
            </DialogDescription>
          </DialogHeader>

          {createdProspectId ? (
            <div className="space-y-4">
              <div className="text-center py-6">
                <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Prospect Added Successfully!</h3>
                <p className="text-sm text-muted-foreground">
                  {prospectName} has been added to your prospects list.
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleContinueToWizard} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-continue-wizard"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Continue to Portfolio Wizard
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCloseProspectDialog}
                  className="w-full"
                  data-testid="button-add-another"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Prospect
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleCloseProspectDialog}
                  className="w-full"
                  data-testid="button-close-prospect-dialog"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prospect-name">Full Name *</Label>
                <Input
                  id="prospect-name"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  placeholder="Enter prospect's full name"
                  required
                  data-testid="input-prospect-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-mobile">Mobile Number</Label>
                <Input
                  id="prospect-mobile"
                  value={prospectMobile}
                  onChange={(e) => setProspectMobile(e.target.value)}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  data-testid="input-prospect-mobile"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-email">Email Address</Label>
                <Input
                  id="prospect-email"
                  type="email"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  placeholder="email@example.com"
                  data-testid="input-prospect-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-pan">PAN Number</Label>
                <Input
                  id="prospect-pan"
                  value={prospectPan}
                  onChange={(e) => setProspectPan(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="uppercase"
                  data-testid="input-prospect-pan"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-notes">Notes (Optional)</Label>
                <Textarea
                  id="prospect-notes"
                  value={prospectNotes}
                  onChange={(e) => setProspectNotes(e.target.value)}
                  placeholder="Any additional notes about this prospect..."
                  rows={3}
                  data-testid="textarea-prospect-notes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseProspectDialog}
                  data-testid="button-cancel-prospect"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddProspect}
                  disabled={createProspectMutation.isPending || !prospectName.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-save-prospect"
                >
                  {createProspectMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Save Prospect
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    const totalAmount = formData.items.reduce((sum, item) => sum + parseFloat(item.recommendedAmount || "0"), 0);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expiresInDays));

    onSubmit({
      agentId: "central-test-user",
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
                  {Array.isArray(clients) && clients.map((client) => (
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
                          <SelectItem value="conservative">Conservative - Capital preservation</SelectItem>
                          <SelectItem value="moderately_conservative">Moderately Conservative - Stability focused</SelectItem>
                          <SelectItem value="moderate">Moderate - Balanced growth</SelectItem>
                          <SelectItem value="moderately_aggressive">Moderately Aggressive - Growth oriented</SelectItem>
                          <SelectItem value="aggressive">Aggressive - Maximum growth</SelectItem>
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
                  <p className="text-lg font-semibold">₹{(proposal.totalAmount ?? 0).toLocaleString()}</p>
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
                <p className="text-sm text-muted-foreground">{proposal.description}</p>
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
                  <Card key={index} className="p-4 bg-muted">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Product Type</Label>
                        <p className="text-sm font-medium">{(item.productType || 'investment').replace("_", " ").toUpperCase()}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Product Name</Label>
                        <p className="text-sm font-medium">{item.productName}</p>
                      </div>
                      {item.symbol && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Symbol</Label>
                          <p className="text-sm">{item.symbol}</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Recommended Amount</Label>
                        <p className="text-sm font-semibold">₹{(item.recommendedAmount ?? 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Risk Level</Label>
                        <Badge variant={item.riskLevel === 'high' ? 'destructive' : item.riskLevel === 'moderate' ? 'secondary' : 'outline'}>
                          {(item.riskLevel || 'moderate').toUpperCase()}
                        </Badge>
                      </div>
                      {item.expectedReturn && (
                        <div>
                          <Label className="text-xs font-medium text-muted-foreground">Expected Return</Label>
                          <p className="text-sm">{item.expectedReturn}% p.a.</p>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">Time Horizon</Label>
                        <p className="text-sm">{item.timeHorizon}</p>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <Label className="text-xs font-medium text-muted-foreground">Investment Rationale</Label>
                        <p className="text-sm text-muted-foreground">{item.rationale}</p>
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
const getProposalStatusBadge = (status: string | undefined) => {
  const safeStatus = status || 'draft';
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
    draft: { variant: "outline", icon: FileText },
    sent: { variant: "secondary", icon: Send },
    approved: { variant: "default", icon: CheckCircle },
    rejected: { variant: "destructive", icon: XCircle },
    partially_approved: { variant: "outline", icon: AlertCircle }
  };

  const config = statusConfig[safeStatus] || { variant: "outline", icon: AlertCircle };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon size={12} />
      {safeStatus.replace("_", " ").toUpperCase()}
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

  const handleSubmit = (e: FormEvent) => {
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
  useEffect(() => {
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
          <div className="text-center py-4 text-muted-foreground">
            Please select a client from the list to send notifications
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}