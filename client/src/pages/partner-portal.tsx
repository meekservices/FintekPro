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
  ArrowDownRight,
  FileText,
  BookOpen,
  Shield,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ComplianceStatusBadge } from '@/components/regulatory/ComplianceStatusBadge';

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

  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [statementGroupBy, setStatementGroupBy] = useState('transaction');

  const partnerId = (dashboardData as any)?.partnerId || 'central-test-user';

  const { data: statementData, isLoading: statementLoading, refetch: refetchStatement } = useQuery({
    queryKey: ['/api/partners', partnerId, 'payout-statement', statementFromDate, statementToDate, statementGroupBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statementFromDate) params.set('from_date', statementFromDate);
      if (statementToDate) params.set('to_date', statementToDate);
      params.set('group_by', statementGroupBy);
      const res = await fetch(`/api/partner-hierarchy/payout-statement/${partnerId}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch statement');
      return res.json();
    },
    enabled: activeTab === 'statement',
  });

  const { data: disputesData, isLoading: disputesLoading } = useQuery({
    queryKey: ['/api/commission/disputes'],
    enabled: activeTab === 'statement',
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
      open: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      in_progress: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      pending: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
      resolved: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      closed: 'bg-muted text-foreground'
    };
    return colors[status] || colors.open;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
      urgent: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
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
              <ComplianceStatusBadge />
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                Active Partner
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="statement" data-testid="tab-statement">Payout Statement</TabsTrigger>
            <TabsTrigger value="earnings" data-testid="tab-earnings">How Earnings Work</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
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
                <Card className="hover:border-blue-300 dark:border-blue-700 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
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
                <Card className="hover:border-green-300 dark:border-green-700 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
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
                <Card className="hover:border-purple-300 dark:border-purple-700 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
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

          {/* PAYOUT STATEMENT TAB */}
          <TabsContent value="statement" className="space-y-6" data-testid="statement-tab-content">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Payout Statement</h2>
                <p className="text-sm text-muted-foreground">Transaction-level, auditable payout records</p>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">From Date</label>
                    <Input type="date" value={statementFromDate} onChange={(e) => setStatementFromDate(e.target.value)} className="w-40" data-testid="statement-from-date" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">To Date</label>
                    <Input type="date" value={statementToDate} onChange={(e) => setStatementToDate(e.target.value)} className="w-40" data-testid="statement-to-date" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Group By</label>
                    <Select value={statementGroupBy} onValueChange={setStatementGroupBy}>
                      <SelectTrigger className="w-40" data-testid="statement-group-by">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transaction">Transaction</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => refetchStatement()} variant="outline" size="sm" data-testid="statement-refresh">
                    <Calendar className="h-4 w-4 mr-1" /> Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            {statementLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading statement...</div>
            ) : statementData ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Total Earned</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-300" data-testid="statement-total-earned">
                        {'\u20B9'}{Number(statementData.summary?.total_earned || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Agent Income</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300" data-testid="statement-agent-income">
                        {'\u20B9'}{Number(statementData.summary?.agent_income || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Upline Incentives</p>
                      <p className="text-xl font-bold text-purple-700 dark:text-purple-300" data-testid="statement-upline-income">
                        {'\u20B9'}{Number(statementData.summary?.upline_income || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground">Wallet Balance</p>
                      <p className="text-xl font-bold text-orange-700 dark:text-orange-300" data-testid="statement-pending">
                        {'\u20B9'}{Number(statementData.summary?.pending_amount || 0).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Ledger Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Array.isArray(statementData.entries) && statementData.entries.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 text-muted-foreground">Transaction</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Role</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Type</th>
                              <th className="text-right py-2 px-2 text-muted-foreground">Amount</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Status</th>
                              <th className="text-left py-2 px-2 text-muted-foreground">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statementData.entries.map((entry: any, idx: number) => (
                              <tr key={entry.ledger_id || idx} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="py-2 px-2 font-mono text-xs">{entry.transaction_id?.slice(0, 12)}...</td>
                                <td className="py-2 px-2">
                                  <Badge variant={entry.role === 'AGENT' ? 'default' : 'secondary'} className="text-xs">
                                    {entry.role}
                                  </Badge>
                                </td>
                                <td className="py-2 px-2 text-xs">{entry.payout_type}</td>
                                <td className="py-2 px-2 text-right font-medium">{'\u20B9'}{Number(entry.net_amount || entry.payout_amount).toLocaleString()}</td>
                                <td className="py-2 px-2">
                                  {entry.payout_status === 'CREDITED' && <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Credited</Badge>}
                                  {entry.payout_status === 'REVERSED' && <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Reversed</Badge>}
                                  {entry.payout_status === 'PARTIALLY_REVERSED' && <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Partial</Badge>}
                                </td>
                                <td className="py-2 px-2 text-xs text-muted-foreground">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No payout entries found for the selected period</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h3 className="text-lg font-medium text-foreground mb-1">Payout Statement</h3>
                  <p className="text-muted-foreground">Select a date range and click Refresh to view your statement</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* HOW EARNINGS WORK TAB */}
          <TabsContent value="earnings" className="space-y-6" data-testid="earnings-tab-content">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">How Your Earnings Are Calculated</h2>
                <p className="text-sm text-muted-foreground">Transparent, performance-linked incentive model</p>
              </div>
              <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                <Shield className="h-3 w-3 mr-1" /> Regulator Compliant
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <IndianRupee className="h-5 w-5" />
                    1. Direct Earnings (Agent Income)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    When you sell a financial product, you receive a <strong>fixed percentage</strong> of the commission earned from that transaction.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This is your <strong>primary income</strong>. The percentage is pre-configured per product type and is clearly visible in your payout statement.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <TrendingUp className="h-5 w-5" />
                    2. Upline Incentives (Team Income)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    If partners are working under you, you may receive incentives based on their successful transactions.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Incentives are calculated as a percentage of the <strong>remaining distributable amount</strong></li>
                    <li>Earlier incentives reduce the base for deeper levels</li>
                    <li>This ensures <strong>fairness and long-term sustainability</strong></li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <XCircle className="h-5 w-5" />
                    3. No Income for Recruitment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    You do <strong>not</strong> earn anything simply for adding partners.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Income is generated <strong>only when real financial products are sold to real clients</strong>. This is strictly enforced by our anti-MLM compliance engine.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="h-5 w-5" />
                    4. Full Transparency
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    For every transaction, you can see:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Who sold the product</li>
                    <li>Your role in the transaction (Agent or Upline)</li>
                    <li>How your payout was calculated</li>
                    <li>Final credited amount</li>
                  </ul>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mt-2">
                    No hidden deductions. No manual overrides.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6 bg-muted/50">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Dispute Resolution</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      If you believe a payout is incorrect, you can raise a dispute directly from the Payout Statement tab. All disputes are tracked, reviewed, and resolved with full audit trail. Reversals, if applicable, are processed as mirror entries — no ledger records are ever deleted.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPLIANCE & DISCLOSURES TAB */}
          <TabsContent value="compliance" className="space-y-6" data-testid="compliance-tab-content">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Compliance & Regulatory Disclosures</h2>
                <p className="text-sm text-muted-foreground">SEBI / RBI compliant commission and incentive disclosure</p>
              </div>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                <Shield className="h-3 w-3 mr-1" /> SEBI / RBI Aligned
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Commission & Incentive Disclosure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Nature of Platform</h4>
                  <p className="text-sm text-muted-foreground">
                    FintekPro is a financial distribution platform facilitating the sale of regulated financial products through registered partners.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Nature of Earnings</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>All partner earnings are derived only from completed financial transactions</li>
                    <li>No partner is paid for recruitment, onboarding, or hierarchy creation</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Incentive Structure</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Incentives are calculated from actual commission received</li>
                    <li>Distribution follows a progressive remaining-based incentive mechanism</li>
                    <li>Incentive amounts decrease at higher hierarchy levels naturally</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Risk & Sustainability Controls</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Platform fees are deducted upfront</li>
                    <li>Residual amounts are retained for operational stability</li>
                    <li>Incentive eligibility is subject to KYC and compliance status</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Transparency & Auditability</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Every payout is recorded in an immutable ledger</li>
                    <li>Full transaction-to-payout traceability exists</li>
                    <li>Dispute and reversal mechanisms are in place</li>
                  </ul>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Regulatory Alignment</h4>
                  <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-2">
                    <p className="text-sm text-green-800 dark:text-green-200">This model:</p>
                    <ul className="text-sm text-green-800 dark:text-green-200 space-y-1 mt-2">
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Does not constitute a money circulation scheme</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Does not promise fixed or assured returns</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Rewards only real economic activity</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Is a controlled incentive waterfall</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Technically auditable end-to-end</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Regulator defensible</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
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