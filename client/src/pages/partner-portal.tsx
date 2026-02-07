import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { 
  MessageCircle, 
  BarChart3, 
  Users,
  IndianRupee,
  Target,
  Wallet,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export default function PartnerPortal() {
  const [location] = useLocation();
  
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'dashboard';
    }
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [location]);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/partner/dashboard'],
  });

  const { data: agentsData } = useQuery({
    queryKey: ['/api/partner/agents'],
  });

  const { data: commissionData } = useQuery({
    queryKey: ['/api/partner/commissions'],
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/partner/support/tickets'],
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution?: string }) => {
      const response = await fetch(`/api/partner/support/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution })
      });
      if (!response.ok) throw new Error('Failed to update ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/support/tickets'] });
    }
  });

  const handleUpdateTicketStatus = (ticketId: string, status: string, resolution?: string) => {
    updateTicketMutation.mutate({ id: ticketId, status, resolution });
  };

  const getTicketStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-muted text-foreground'
    };
    return colors[status] || colors.open;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority] || colors.medium;
  };

  const agents = Array.isArray(agentsData) ? agentsData : (agentsData as any)?.agents || [];
  const activeAgents = agents.filter((a: any) => a.status === 'active' || a.isActive);
  const totalCommission = (commissionData as any)?.totalCommission || dashboardData?.stats?.commission || 0;
  const ticketsList = Array.isArray(tickets) ? tickets : [];

  if (dashboardLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading partner portal...</div>;
  }

  return (
    <div className="min-h-screen bg-muted">
      <div className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="partner-portal-title">
                Partner Portal
              </h1>
              <p className="text-sm text-muted-foreground">
                Agent Recruitment, Payouts & CA Services
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Active Partner
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="support" data-testid="tab-support">Support</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="dashboard-agents-card">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Agents</p>
                      <p className="text-2xl font-bold text-foreground">
                        {agents.length}
                      </p>
                      <p className="text-xs text-green-600">
                        {activeAgents.length} active
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="dashboard-commission-card">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Wallet className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Total Commission</p>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{Number(totalCommission).toLocaleString()}
                      </p>
                      <p className="text-xs text-green-600 flex items-center">
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        Agent payouts
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="dashboard-ca-card">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <UserCheck className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">CA Services</p>
                      <p className="text-2xl font-bold text-foreground">
                        {ticketsList.length}
                      </p>
                      <p className="text-xs text-purple-600">
                        Active cases
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="dashboard-tickets-card">
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <MessageCircle className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-muted-foreground">Support Tickets</p>
                      <p className="text-2xl font-bold text-foreground">
                        {dashboardData?.stats?.totalTickets || ticketsList.length}
                      </p>
                      <p className="text-xs text-orange-600">
                        {dashboardData?.stats?.openTickets || ticketsList.filter((t: any) => t.status === 'open').length} open
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Recent Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {agents.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No agents recruited yet</p>
                      <a href="/partner/agents">
                        <Button variant="outline" size="sm" className="mt-2">
                          Recruit Agents
                        </Button>
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {agents.slice(0, 5).map((agent: any) => (
                        <div key={agent.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-sm">{agent.name || agent.fullName || `Agent #${agent.id}`}</p>
                            <p className="text-xs text-muted-foreground">{agent.email || agent.mobile || ''}</p>
                          </div>
                          <Badge variant={agent.status === 'active' || agent.isActive ? 'default' : 'secondary'} className="text-xs">
                            {agent.status || (agent.isActive ? 'Active' : 'Inactive')}
                          </Badge>
                        </div>
                      ))}
                      {agents.length > 5 && (
                        <a href="/partner/agents" className="block text-center pt-2">
                          <Button variant="ghost" size="sm" className="text-blue-600">
                            View all {agents.length} agents →
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-orange-600" />
                    Recent Support Tickets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsList.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No support tickets</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {ticketsList.slice(0, 5).map((ticket: any) => (
                        <div key={ticket.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="font-medium text-sm">{ticket.subject}</p>
                            <p className="text-xs text-muted-foreground">{ticket.clientName}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getPriorityColor(ticket.priority) + " text-xs"}>
                              {ticket.priority}
                            </Badge>
                            <Badge className={getTicketStatusColor(ticket.status) + " text-xs"}>
                              {ticket.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a href="/partner/agents" className="block">
                <Card className="hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Agent Recruitment</p>
                      <p className="text-xs text-muted-foreground">Recruit & manage your agent network</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </CardContent>
                </Card>
              </a>
              <a href="/partner/payouts" className="block">
                <Card className="hover:border-green-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <Wallet className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Agent Payouts</p>
                      <p className="text-xs text-muted-foreground">Commission payouts & settlements</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </CardContent>
                </Card>
              </a>
              <a href="/partner/ca-management" className="block">
                <Card className="hover:border-purple-300 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <UserCheck className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">CA Services</p>
                      <p className="text-xs text-muted-foreground">Onboard CAs & assign cases</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </CardContent>
                </Card>
              </a>
            </div>
          </TabsContent>

          <TabsContent value="support" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Support Tickets</h2>
                <p className="text-sm text-muted-foreground">Manage support requests</p>
              </div>
              <a href="/partner/ca-support">
                <Button className="gap-2" data-testid="button-open-ca-dashboard">
                  <MessageCircle className="h-4 w-4" />
                  Open CA Support Dashboard
                </Button>
              </a>
            </div>

            <div className="grid gap-6">
              {ticketsLoading ? (
                <div>Loading support tickets...</div>
              ) : ticketsList.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                    <h3 className="text-lg font-medium text-foreground mb-1">No Support Tickets</h3>
                    <p className="text-muted-foreground">No active support requests at this time</p>
                  </CardContent>
                </Card>
              ) : (
                ticketsList.map((ticket: any) => (
                  <Card key={ticket.id} data-testid={`ticket-card-${ticket.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {ticket.ticketNumber} • {ticket.clientName} • {ticket.clientEmail}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge className={getTicketStatusColor(ticket.status)}>
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{ticket.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {ticket.category} • Created: {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          {ticket.status === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')}
                              data-testid={`button-start-ticket-${ticket.id}`}
                            >
                              Start Work
                            </Button>
                          )}
                          {ticket.status === 'in_progress' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved', 'Issue resolved by partner')}
                              data-testid={`button-resolve-ticket-${ticket.id}`}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}