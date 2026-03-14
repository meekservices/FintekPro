import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { navigate } from "wouter/use-browser-location";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Building2, 
  TrendingUp, 
  FileText, 
  Settings,
  DollarSign,
  UserPlus,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Phone,
  Mail,
  Target,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  ClipboardList,
  MessageSquare,
  Star,
  Zap,
  Video,
  Plus,
  ExternalLink,
  XCircle,
  Loader2,
  Send,
  Sparkles
} from "lucide-react";

interface MeetingBooking {
  id: string;
  topic: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: string;
  clientName?: string;
  clientEmail?: string;
  clientNotes?: string;
  startLink?: string;
  joinLink?: string;
}

interface MeetingClient {
  id: string;
  fullName: string;
  email: string;
}

export default function FieldAgentPortal() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

  // Meeting states
  const [meetingDialog, setMeetingDialog] = useState(false);
  const [meetingClientId, setMeetingClientId] = useState("");
  const [meetingTopic, setMeetingTopic] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(30);

  const { data: agentProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/agent/profile'],
  });

  const { data: agentStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/agent/stats'],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/agent/clients'],
  });

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['/api/agent/leads'],
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/agent/tasks'],
  });

  const { data: recentActivity } = useQuery<Array<{ id: string; type: string; title: string; description: string; timestamp: string }>>({
    queryKey: ['/api/agent/activity'],
  });

  // Meeting queries
  const { data: meetingsData, isLoading: meetingsLoading } = useQuery<{ bookings: MeetingBooking[] }>({
    queryKey: ["/api/meetings/agent-bookings"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/agent-bookings");
      return response;
    }
  });

  const { data: meetingClientsData } = useQuery<{ clients: MeetingClient[] }>({
    queryKey: ["/api/meetings/agent-clients"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/agent-clients");
      return response;
    }
  });

  const { data: pendingRequestsData } = useQuery<{ requests: MeetingBooking[] }>({
    queryKey: ["/api/meetings/pending-requests"],
    queryFn: async () => {
      const response = await apiRequest("/api/meetings/pending-requests");
      return response;
    }
  });

  // Meeting mutations
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

  const cancelMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/meetings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: "Meeting Cancelled", description: "The meeting has been cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings/agent-bookings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

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
      toast({ title: "Missing Fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(`${meetingDate}T${meetingTime}`).toISOString();
    scheduleMeetingMutation.mutate({
      clientId: meetingClientId,
      topic: meetingTopic,
      description: meetingDescription || undefined,
      scheduledAt,
      duration: meetingDuration
    });
  };

  const isLoading = profileLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <div className="text-lg">Loading agent portal...</div>
          </div>
        </div>
      </div>
    );
  }

  interface AgentStats {
    totalClients: number;
    activeClients: number;
    totalLeads: number;
    convertedLeads: number;
    totalAUM: number;
    thisMonthBusiness: number;
    lastMonthBusiness: number;
    totalCommissions: number;
    pendingCommissions: number;
    targetProgress: number;
    monthlyTarget: number;
  }

  const stats: AgentStats = (agentStats as AgentStats) || {
    totalClients: 0,
    activeClients: 0,
    totalLeads: 0,
    convertedLeads: 0,
    totalAUM: 0,
    thisMonthBusiness: 0,
    lastMonthBusiness: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    targetProgress: 0,
    monthlyTarget: 500000
  };

  const growthRate = stats.lastMonthBusiness > 0 
    ? ((stats.thisMonthBusiness - stats.lastMonthBusiness) / stats.lastMonthBusiness * 100).toFixed(1)
    : 0;

  const conversionRate = stats.totalLeads > 0 
    ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(1)
    : 0;

  const targetProgress = stats.monthlyTarget > 0
    ? (stats.thisMonthBusiness / stats.monthlyTarget) * 100
    : 0;

  const agentLevel = (agentProfile as any)?.agentLevel || 'agent';
  const levelLabel = agentLevel === 'master' ? 'Agent' : 
                     agentLevel === 'sub_agent' ? 'Field Executive' : 'Business Associate';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30" data-testid="field-agent-portal">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Agent Dashboard</h1>
            </div>
            <p className="text-muted-foreground">
              Welcome back, {(agentProfile as any)?.fullName || 'Agent'}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              <Award className="h-3 w-3 mr-1" />
              {levelLabel}
            </Badge>
            {(agentProfile as any)?.euinNumber && (
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                EUIN: {(agentProfile as any).euinNumber}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{stats.activeClients}</span> active
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Leads</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLeads}</div>
              <p className="text-xs text-muted-foreground">
                {conversionRate}% conversion rate
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(stats.totalAUM / 100000).toFixed(2)} L</div>
              <p className="text-xs text-muted-foreground">
                Assets under management
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(stats.thisMonthBusiness / 100000).toFixed(2)} L</div>
              <p className={`text-xs flex items-center ${Number(growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(growthRate) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {growthRate}% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Monthly Target Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>₹{(stats.thisMonthBusiness / 100000).toFixed(2)} L achieved</span>
                  <span>Target: ₹{(stats.monthlyTarget / 100000).toFixed(2)} L</span>
                </div>
                <Progress value={Math.min(targetProgress, 100)} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{targetProgress.toFixed(0)}% complete</span>
                  <span>₹{((stats.monthlyTarget - stats.thisMonthBusiness) / 100000).toFixed(2)} L remaining</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/90">Total Earnings</CardTitle>
              <DollarSign className="h-5 w-5 text-foreground/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{(stats.totalCommissions / 1000).toFixed(2)} K</div>
              <p className="text-sm text-foreground/70 mt-1">
                ₹{(stats.pendingCommissions / 1000).toFixed(2)} K pending
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollableTabsList>
            <TabsTrigger value="dashboard" data-testid="tab-agent-dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-agent-clients">
              <Users className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-agent-leads">
              <Target className="h-4 w-4 mr-2" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-agent-tasks">
              <ClipboardList className="h-4 w-4 mr-2" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="commissions" data-testid="tab-agent-commissions">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
            <TabsTrigger value="meetings" data-testid="tab-agent-meetings">
              <Video className="h-4 w-4 mr-2" />
              Meetings
            </TabsTrigger>
            <TabsTrigger value="profile" data-testid="tab-agent-profile">
              <Settings className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="dashboard" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Today's Tasks</CardTitle>
                  <CardDescription>Your scheduled activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : (tasks as any)?.todayTasks?.length > 0 ? (
                      (tasks as any).todayTasks.slice(0, 4).map((item: any, index: number) => (
                        <div key={item.id || index} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-shrink-0 w-16 text-xs text-muted-foreground">{item.time}</div>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            item.type === 'meeting' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                            item.type === 'kyc' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                            item.type === 'presentation' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                            'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                          }`}>
                            {item.type === 'meeting' ? <Users className="h-4 w-4" /> :
                             item.type === 'kyc' ? <FileText className="h-4 w-4" /> :
                             item.type === 'presentation' ? <BarChart3 className="h-4 w-4" /> :
                             <Phone className="h-4 w-4" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.task}</p>
                          </div>
                          <Badge variant={item.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                            {item.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No tasks scheduled for today</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity && recentActivity.length > 0 ? (
                      recentActivity.slice(0, 4).map((activity) => {
                        const iconConfig: Record<string, { icon: typeof CheckCircle2; bgClass: string; iconClass: string }> = {
                          sip: { icon: CheckCircle2, bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900', iconClass: 'text-green-600' },
                          commission: { icon: DollarSign, bgClass: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900', iconClass: 'text-blue-600' },
                          conversion: { icon: Star, bgClass: 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900', iconClass: 'text-purple-600' },
                          kyc: { icon: AlertTriangle, bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900', iconClass: 'text-amber-600' }
                        };
                        const config = iconConfig[activity.type] || iconConfig.sip;
                        const Icon = config.icon;
                        return (
                          <div key={activity.id} className={`flex items-center gap-4 p-3 rounded-lg border ${config.bgClass}`}>
                            <Icon className={`h-5 w-5 flex-shrink-0 ${config.iconClass}`} />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{activity.title}</p>
                              <p className="text-xs text-muted-foreground">{activity.description}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No recent activity</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Quick Actions</CardTitle>
                      <CardDescription>Common tasks at your fingertips</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button variant="outline" className="h-24 flex flex-col gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:hover:bg-blue-950" data-testid="button-add-lead" onClick={() => navigate("/agent/leads")}>
                      <UserPlus className="h-6 w-6 text-blue-600" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">Add Lead</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2 border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-950" data-testid="button-new-client" onClick={() => navigate("/agent/onboard-client")}>
                      <Users className="h-6 w-6 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-300">New Client</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300 dark:border-purple-800 dark:hover:bg-purple-950" data-testid="button-start-kyc" onClick={() => navigate("/agent/kyc")}>
                      <FileText className="h-6 w-6 text-purple-600" />
                      <span className="text-sm text-purple-700 dark:text-purple-300">Start KYC</span>
                    </Button>
                    <Button variant="outline" className="h-24 flex flex-col gap-2 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950" data-testid="button-place-order" onClick={() => navigate("/agent/orders")}>
                      <Zap className="h-6 w-6 text-amber-600" />
                      <span className="text-sm text-amber-700 dark:text-amber-300">Place Order</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>My Clients</CardTitle>
                    <CardDescription>Clients you are servicing</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search clients..." 
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-clients"
                      />
                    </div>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" data-testid="button-add-client" onClick={() => navigate("/agent/onboard-client")}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Client
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Portfolio</TableHead>
                      <TableHead>KYC Status</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                          Loading clients...
                        </TableCell>
                      </TableRow>
                    ) : (clients as any)?.length > 0 ? (
                      (clients as any).map((client: any, index: number) => (
                        <TableRow key={client.id || index}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {client.mobile || '-'}
                              </span>
                              <span className="text-xs flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" /> {client.email || '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>₹{((client.portfolioValue || 0) / 100000).toFixed(2)} L</TableCell>
                          <TableCell>
                            <Badge variant={client.kycStatus === 'verified' ? 'default' : 'secondary'}>
                              {client.kycStatus || 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{client.lastActivity || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950" data-testid={`button-call-client-${index}`} onClick={() => { if (client.mobile) window.open(`tel:${client.mobile}`); else toast({ title: "No phone number", description: "This client has no phone number on file." }); }}>
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950" data-testid={`button-view-client-${index}`} onClick={() => navigate(`/agent-client-profile/${client.id || index}`)}>
                                View
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-lg font-medium mb-1">No clients yet</p>
                          <p className="text-muted-foreground mb-4">Start by adding your first client</p>
                          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" data-testid="button-add-first-client" onClick={() => navigate("/agent/onboard-client")}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Client
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Lead Management</CardTitle>
                    <CardDescription>Track and convert your leads</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search leads..." 
                        className="pl-9 w-64"
                        data-testid="input-search-leads"
                      />
                    </div>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" data-testid="button-add-lead" onClick={() => navigate("/agent/leads")}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Lead
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">Loading leads...</TableCell>
                      </TableRow>
                    ) : (leads as any)?.length > 0 ? (
                      (leads as any).map((lead: any, index: number) => (
                        <TableRow key={lead.id || index}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>
                            <span className="text-xs">{lead.mobile || lead.email || '-'}</span>
                          </TableCell>
                          <TableCell>{lead.interest || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={
                              lead.status === 'hot' ? 'destructive' :
                              lead.status === 'warm' ? 'default' : 'secondary'
                            }>
                              {lead.status || 'New'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lead.lastContact || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950" data-testid={`button-call-lead-${index}`} onClick={() => { if (lead.mobile) window.open(`tel:${lead.mobile}`); else toast({ title: "No phone number", description: "This lead has no phone number on file." }); }}>
                                <Phone className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950" data-testid={`button-convert-lead-${index}`} onClick={() => { toast({ title: "Converting Lead", description: `Starting client onboarding for ${lead.name}` }); navigate("/agent/onboard-client"); }}>
                                Convert
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-lg font-medium mb-1">No leads yet</p>
                          <p className="text-muted-foreground mb-4">Start prospecting to add leads</p>
                          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" data-testid="button-add-first-lead" onClick={() => navigate("/agent/leads")}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Lead
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Tasks</CardTitle>
                    <CardDescription>Manage your daily activities</CardDescription>
                  </div>
                  <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" data-testid="button-add-task" onClick={() => navigate("/agent-tasks")}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tasksLoading ? (
                    <div className="text-center py-8">Loading tasks...</div>
                  ) : (tasks as any)?.length > 0 ? (
                    (tasks as any).map((task: any, index: number) => (
                      <div key={task.id || index} className="flex items-center gap-4 p-4 border rounded-lg">
                        <input type="checkbox" className="h-5 w-5 rounded" data-testid={`checkbox-task-${index}`} />
                        <div className="flex-1">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        </div>
                        <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'}>
                          {task.priority}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{task.dueDate}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-lg font-medium mb-1">No tasks scheduled</p>
                      <p className="text-muted-foreground mb-4">Create tasks to stay organized</p>
                      <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" data-testid="button-create-first-task" onClick={() => navigate("/agent-tasks")}>
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Create Task
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{((stats.thisMonthBusiness * 0.01) / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Estimated commission</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(stats.pendingCommissions / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Awaiting payout</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(stats.totalCommissions / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Lifetime earnings</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <CardDescription>Your earnings record</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-lg font-medium mb-1">No commission history yet</p>
                  <p className="text-muted-foreground">Commissions will appear here as you generate business</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Meetings Section */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Video className="h-5 w-5 text-blue-600" />
                          Video Meetings
                        </CardTitle>
                        <CardDescription>Schedule and manage video meetings with clients via Zoho Meetings</CardDescription>
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
                    {/* Pending Meeting Requests */}
                    {pendingRequestsData?.requests && pendingRequestsData.requests.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold mb-3 text-orange-700 dark:text-orange-300 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Pending Requests ({pendingRequestsData.requests.length})
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
                                      {new Date(request.scheduledAt).toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(request.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span>{request.duration} min</span>
                                  </div>
                                  {request.clientNotes && (
                                    <p className="text-sm text-muted-foreground mt-2 italic">Notes: {request.clientNotes}</p>
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
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
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

                    {/* Meetings List */}
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
                                      <p className="text-sm text-muted-foreground">Client: {meeting.clientName || "Unknown"}</p>
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
              </div>

              {/* Sidebar - Broadcasts & Quick Actions */}
              <div className="space-y-6">
                {/* Broadcasts Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5 text-purple-600" />
                      Client Broadcasts
                    </CardTitle>
                    <CardDescription>Send greetings and campaigns to your clients</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950"
                      onClick={() => navigate("/agent/festival-greetings")}
                      data-testid="button-festival-greetings"
                    >
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Festival Greetings
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950"
                      onClick={() => navigate("/agent/bulk-communication")}
                      data-testid="button-bulk-communication"
                    >
                      <Mail className="h-4 w-4 text-blue-600" />
                      Bulk Email/SMS
                    </Button>
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        Use Zoho Campaigns to send personalized greetings to your clients on festivals and special occasions.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Meeting Stats Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Meeting Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Upcoming</span>
                        <Badge variant="secondary">
                          {meetingsData?.bookings?.filter((m) => new Date(m.scheduledAt) >= new Date() && m.status === "confirmed").length || 0}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pending Requests</span>
                        <Badge variant="outline" className="text-orange-600">
                          {pendingRequestsData?.requests?.length || 0}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Completed</span>
                        <Badge variant="outline">
                          {meetingsData?.bookings?.filter((m) => m.status === "completed").length || 0}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Profile</CardTitle>
                  <CardDescription>Your professional details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="font-medium">{(agentProfile as any)?.fullName || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Agent Level</label>
                      <p className="font-medium">{levelLabel}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="font-medium">{(agentProfile as any)?.email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="font-medium">{(agentProfile as any)?.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">EUIN Number</label>
                      <p className="font-medium">{(agentProfile as any)?.euinNumber || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ARN Code</label>
                      <p className="font-medium">{(agentProfile as any)?.arnCode || '-'}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" data-testid="button-edit-profile" onClick={() => navigate("/profile")}>
                    Edit Profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Your achievements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.totalClients}</p>
                      <p className="text-sm text-muted-foreground">Total Clients</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.convertedLeads}</p>
                      <p className="text-sm text-muted-foreground">Leads Converted</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">₹{(stats.totalAUM / 100000).toFixed(0)} L</p>
                      <p className="text-sm text-muted-foreground">Total AUM</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-600">{conversionRate}%</p>
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
