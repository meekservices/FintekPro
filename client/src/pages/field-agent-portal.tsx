import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Zap
} from "lucide-react";

export default function FieldAgentPortal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");

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

  const isLoading = profileLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
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
                     agentLevel === 'sub_agent' ? 'Sub-Agent' : 'Associate';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" data-testid="field-agent-portal">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Dashboard</h1>
            </div>
            <p className="text-muted-foreground dark:text-muted-foreground">
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

          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white/90">Total Earnings</CardTitle>
              <DollarSign className="h-5 w-5 text-white/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{(stats.totalCommissions / 1000).toFixed(2)} K</div>
              <p className="text-sm text-white/70 mt-1">
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
                            item.type === 'meeting' ? 'bg-blue-100 text-blue-600' :
                            item.type === 'kyc' ? 'bg-green-100 text-green-600' :
                            item.type === 'presentation' ? 'bg-purple-100 text-purple-600' :
                            'bg-amber-100 text-amber-600'
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
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md" data-testid="button-add-client" onClick={() => navigate("/agent/onboard-client")}>
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
                          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white" data-testid="button-add-first-client" onClick={() => navigate("/agent/onboard-client")}>
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
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md" data-testid="button-add-lead" onClick={() => navigate("/agent/leads")}>
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
                          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white" data-testid="button-add-first-lead" onClick={() => navigate("/agent/leads")}>
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
                  <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md" data-testid="button-add-task" onClick={() => navigate("/agent-tasks")}>
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
                      <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white" data-testid="button-create-first-task" onClick={() => navigate("/agent-tasks")}>
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
