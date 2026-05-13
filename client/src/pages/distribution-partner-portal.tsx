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
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  Target,
  Shield as LucideShield,
  UserCheck,
  Briefcase
} from "lucide-react";

export default function DistributionPartnerPortal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: partnerProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/partner/profile'],
  });

  const { data: partnerStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/partner/stats'],
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/partner/agents'],
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery({
    queryKey: ['/api/partner/commissions'],
  });

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['/api/partner/clients'],
  });

  const { data: recentActivity } = useQuery<Array<{ id: string; type: string; title: string; description: string; timestamp: string }>>({
    queryKey: ['/api/partner/activity'],
  });

  const { data: topAgents } = useQuery<Array<{ id: string; name: string; clients: number; business: number; growth: number; rank: number }>>({
    queryKey: ['/api/partner/top-agents'],
  });

  const isLoading = profileLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <div className="text-lg">Loading partner portal...</div>
          </div>
        </div>
      </div>
    );
  }

  interface PartnerStats {
    totalAgents: number;
    activeAgents: number;
    totalClients: number;
    totalAUM: number;
    totalCommissions: number;
    pendingCommissions: number;
    thisMonthBusiness: number;
    lastMonthBusiness: number;
  }

  const stats: PartnerStats = (partnerStats as PartnerStats) || {
    totalAgents: 0,
    activeAgents: 0,
    totalClients: 0,
    totalAUM: 0,
    totalCommissions: 0,
    pendingCommissions: 0,
    thisMonthBusiness: 0,
    lastMonthBusiness: 0
  };

  const growthRate = stats.lastMonthBusiness > 0 
    ? ((stats.thisMonthBusiness - stats.lastMonthBusiness) / stats.lastMonthBusiness * 100).toFixed(1)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30" data-testid="distribution-partner-portal">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Partner Portal</h1>
            </div>
            <p className="text-muted-foreground">
              Welcome back, {(partnerProfile as any)?.companyName || 'Partner'}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <LucideShield className="h-3 w-3 mr-1" />
              {(partnerProfile as any)?.commissionTier || 'Standard'} Tier
            </Badge>
            {(partnerProfile as any)?.arnCode && (
              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                ARN: {(partnerProfile as any).arnCode}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgents}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">{stats.activeAgents}</span> active agents
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Building2 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                Across all agents
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total AUM</CardTitle>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(stats.totalAUM / 10000000).toFixed(2)} Cr</div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/90">Total Commissions Earned</CardTitle>
              <DollarSign className="h-5 w-5 text-foreground/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{(stats.totalCommissions / 1000).toFixed(2)} K</div>
              <p className="text-sm text-foreground/70 mt-1">
                Lifetime earnings
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/90">Pending Commissions</CardTitle>
              <Clock className="h-5 w-5 text-foreground/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{(stats.pendingCommissions / 1000).toFixed(2)} K</div>
              <p className="text-sm text-foreground/70 mt-1">
                Awaiting settlement
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground/90">Commission Rate</CardTitle>
              <Target className="h-5 w-5 text-foreground/80" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{(partnerProfile as any)?.commissionRate || '1.00'}%</div>
              <p className="text-sm text-foreground/70 mt-1">
                Current rate
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollableTabsList>
            <TabsTrigger value="overview" data-testid="tab-partner-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-partner-agents">
              <Users className="h-4 w-4 mr-2" />
              Agent Network
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-partner-clients">
              <Building2 className="h-4 w-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="commissions" data-testid="tab-partner-commissions">
              <DollarSign className="h-4 w-4 mr-2" />
              Commissions
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-partner-reports">
              <FileText className="h-4 w-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-partner-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest transactions and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity && recentActivity.length > 0 ? (
                      recentActivity.slice(0, 4).map((activity) => {
                        const iconConfig: Record<string, { icon: typeof CheckCircle2; bgClass: string; iconClass: string }> = {
                          onboarding: { icon: CheckCircle2, bgClass: 'bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900', iconClass: 'text-green-600' },
                          commission: { icon: DollarSign, bgClass: 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900', iconClass: 'text-blue-600' },
                          kyc: { icon: AlertTriangle, bgClass: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900', iconClass: 'text-amber-600' },
                          agent: { icon: UserCheck, bgClass: 'bg-purple-50 dark:bg-purple-950/30 border-purple-100 dark:border-purple-900', iconClass: 'text-purple-600' }
                        };
                        const config = iconConfig[activity.type] || iconConfig.onboarding;
                        const Icon = config.icon;
                        return (
                          <div key={activity.id} className={`flex items-center gap-4 p-3 rounded-lg border ${config.bgClass}`}>
                            <Icon className={`h-5 w-5 ${config.iconClass}`} />
                            <div className="flex-1">
                              <p className="font-medium">{activity.title}</p>
                              <p className="text-sm text-muted-foreground">{activity.description}</p>
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

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Agents</CardTitle>
                  <CardDescription>Based on this month's business</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topAgents && topAgents.length > 0 ? (
                      topAgents.slice(0, 3).map((agent) => (
                        <div key={agent.id || agent.rank} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              agent.rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                              agent.rank === 2 ? 'bg-muted text-muted-foreground' :
                              'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            }`}>
                              #{agent.rank}
                            </div>
                            <div>
                              <p className="font-medium">{agent.name}</p>
                              <p className="text-sm text-muted-foreground">{agent.clients} clients</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">₹{agent.business} L</p>
                            <p className="text-xs text-green-600">+{agent.growth}%</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No agent data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Agent Network Summary</CardTitle>
                  <CardDescription>Distribution of your agent network</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                      <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{stats.activeAgents || 0}</p>
                      <p className="text-sm text-muted-foreground">Active Agents</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                      <UserCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Field Executives</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                      <Briefcase className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Business Associates</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                      <Clock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold">0</p>
                      <p className="text-sm text-muted-foreground">Pending Approval</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Agent Network Management</CardTitle>
                    <CardDescription>Manage your agents, field executives, and business associates</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search agents..." 
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-agents"
                      />
                    </div>
                    <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" data-testid="button-add-agent" onClick={() => navigate("/partner-application")}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Agent
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>EUIN/ARN</TableHead>
                      <TableHead>Clients</TableHead>
                      <TableHead>AUM</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                          Loading agents...
                        </TableCell>
                      </TableRow>
                    ) : (agents as any)?.length > 0 ? (
                      (agents as any).map((agent: any, index: number) => (
                        <TableRow key={agent.id || index}>
                          <TableCell className="font-medium">{agent.fullName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              agent.agentLevel === 'master' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                              agent.agentLevel === 'sub_agent' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                              'bg-muted text-foreground'
                            }>
                              {agent.agentLevel === 'master' ? 'Agent' : 
                               agent.agentLevel === 'sub_agent' ? 'Field Executive' :
                               agent.agentLevel === 'district_associate' ? 'District Associate' :
                               agent.agentLevel === 'field_associate' ? 'Field Associate' : 'Business Associate'}
                            </Badge>
                          </TableCell>
                          <TableCell>{agent.euinNumber || agent.arnCode || '-'}</TableCell>
                          <TableCell>{agent.clientCount || 0}</TableCell>
                          <TableCell>₹{((agent.totalAum || 0) / 100000).toFixed(2)} L</TableCell>
                          <TableCell>₹{((agent.totalCommissions || 0) / 1000).toFixed(2)} K</TableCell>
                          <TableCell>
                            <Badge variant={agent.isActive ? 'default' : 'secondary'}>
                              {agent.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950" data-testid={`button-view-agent-${index}`} onClick={() => navigate(`/agent-portal`)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-lg font-medium mb-1">No agents in your network</p>
                          <p className="text-muted-foreground mb-4">Start building your distribution network</p>
                          <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" data-testid="button-onboard-first-agent" onClick={() => navigate("/partner-application")}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Onboard First Agent
                          </Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Client Overview</CardTitle>
                    <CardDescription>All clients across your agent network</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search clients..." 
                        className="pl-9 w-64"
                        data-testid="input-search-clients"
                      />
                    </div>
                    <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950" data-testid="button-export-clients" onClick={() => toast({ title: "Export Started", description: "Preparing client data for export..." })}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client Name</TableHead>
                      <TableHead>PAN</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Portfolio Value</TableHead>
                      <TableHead>KYC Status</TableHead>
                      <TableHead>Last Activity</TableHead>
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
                          <TableCell>{client.panNumber || '-'}</TableCell>
                          <TableCell>{client.agentName || '-'}</TableCell>
                          <TableCell>₹{((client.portfolioValue || 0) / 100000).toFixed(2)} L</TableCell>
                          <TableCell>
                            <Badge variant={client.kycStatus === 'verified' ? 'default' : 'secondary'}>
                              {client.kycStatus || 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>{client.lastActivity || '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12">
                          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-lg font-medium mb-1">No clients yet</p>
                          <p className="text-muted-foreground">Clients will appear here once agents onboard them</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{((stats.thisMonthBusiness * 0.01) / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Estimated commission</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payout</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(stats.pendingCommissions / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Next payout: 15th</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">YTD Earnings</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{(stats.totalCommissions / 1000).toFixed(2)} K</div>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Commission History</CardTitle>
                    <CardDescription>Track your earnings and payouts</CardDescription>
                  </div>
                  <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950" data-testid="button-download-statement" onClick={() => toast({ title: "Generating Statement", description: "Your commission statement will be ready for download shortly." })}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Statement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionsLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">Loading commissions...</TableCell>
                      </TableRow>
                    ) : (commissions as any)?.length > 0 ? (
                      (commissions as any).map((comm: any, index: number) => (
                        <TableRow key={comm.id || index}>
                          <TableCell>{comm.date}</TableCell>
                          <TableCell>{comm.type}</TableCell>
                          <TableCell>{comm.description}</TableCell>
                          <TableCell className="font-medium text-green-600">₹{comm.amount}</TableCell>
                          <TableCell>
                            <Badge variant={comm.status === 'paid' ? 'default' : 'secondary'}>
                              {comm.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12">
                          <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <p className="text-lg font-medium mb-1">No commission history yet</p>
                          <p className="text-muted-foreground">Commissions will appear here as business is generated</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: "AUM Report", desc: "Assets under management breakdown", icon: Wallet, testId: "aum" },
                { title: "Commission Report", desc: "Detailed commission breakdown", icon: DollarSign, testId: "commission" },
                { title: "Client Report", desc: "Client portfolio summaries", icon: Building2, testId: "client" },
                { title: "Agent Performance", desc: "Agent-wise business analysis", icon: Users, testId: "agent" },
                { title: "Transaction Report", desc: "All transactions history", icon: FileText, testId: "transaction" },
                { title: "Compliance Report", desc: "KYC and regulatory status", icon: LucideShield, testId: "compliance" },
              ].map((report) => (
                <Card key={report.testId} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`card-report-${report.testId}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <report.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{report.title}</CardTitle>
                        <CardDescription>{report.desc}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" data-testid={`button-generate-${report.testId}-report`} onClick={() => toast({ title: "Generating Report", description: `Preparing ${report.title}...` })}>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Partner Profile</CardTitle>
                  <CardDescription>Your business information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                      <p className="font-medium">{(partnerProfile as any)?.companyName || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Partner Type</label>
                      <p className="font-medium">{(partnerProfile as any)?.partnerType || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email</label>
                      <p className="font-medium">{(partnerProfile as any)?.contactEmail || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="font-medium">{(partnerProfile as any)?.contactPhone || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">ARN Code</label>
                      <p className="font-medium">{(partnerProfile as any)?.arnCode || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">EUIN Number</label>
                      <p className="font-medium">{(partnerProfile as any)?.euinNumber || '-'}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" data-testid="button-edit-profile" onClick={() => navigate("/profile")}>
                    Edit Profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bank Details</CardTitle>
                  <CardDescription>For commission payouts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Holder</label>
                      <p className="font-medium">{(partnerProfile as any)?.bankAccountHolderName || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Account Number</label>
                      <p className="font-medium">
                        {(partnerProfile as any)?.bankAccountNumber 
                          ? '****' + (partnerProfile as any).bankAccountNumber.slice(-4) 
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">IFSC Code</label>
                      <p className="font-medium">{(partnerProfile as any)?.ifscCode || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">UPI ID</label>
                      <p className="font-medium">{(partnerProfile as any)?.upiId || '-'}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950" data-testid="button-update-bank" onClick={() => navigate("/profile")}>
                    Update Bank Details
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
