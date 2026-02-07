import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Briefcase,
  PieChart,
  BarChart3,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  Settings,
  UserPlus,
  Wallet,
  Receipt,
  Calculator,
  Building2,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface AgentMetrics {
  id: string;
  name: string;
  email: string;
  mobile: string;
  status: 'active' | 'inactive' | 'pending';
  joinDate: string;
  totalRevenue: number;
  totalExpenses: number;
  netPL: number;
  clientsAcquired: number;
  dealsConverted: number;
  commissionEarned: number;
  commissionPaid: number;
  pendingPayout: number;
  performanceScore: number;
  targetAchievement: number;
  lastActivityDate: string;
}

interface ExpenseItem {
  id: string;
  agentId: string;
  agentName: string;
  category: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatCompact = (amount: number) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toString();
};


export default function PartnerAgentDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAgent, setSelectedAgent] = useState<AgentMetrics | null>(null);
  const [showAgentDetail, setShowAgentDetail] = useState(false);
  const [dateRange, setDateRange] = useState("this_month");

  const { data: agentsData, isLoading: isLoadingAgents } = useQuery<AgentMetrics[]>({
    queryKey: ['/api/partner/agents', { period: dateRange }],
    queryFn: () => fetch(`/api/partner/agents?period=${dateRange}`).then(res => res.json()),
  });

  const { data: expensesData, isLoading: isLoadingExpenses } = useQuery<ExpenseItem[]>({
    queryKey: ['/api/partner/expenses'],
  });

  const agents = agentsData || [];
  const expenses = expensesData || [];
  const isLoading = isLoadingAgents || isLoadingExpenses;

  const aggregateMetrics = useMemo(() => {
    const totalRevenue = agents.reduce((sum, a) => sum + a.totalRevenue, 0);
    const totalExpenses = agents.reduce((sum, a) => sum + a.totalExpenses, 0);
    const totalCommission = agents.reduce((sum, a) => sum + a.commissionEarned, 0);
    const pendingPayouts = agents.reduce((sum, a) => sum + a.pendingPayout, 0);
    const activeAgents = agents.filter(a => a.status === 'active').length;
    const totalClients = agents.reduce((sum, a) => sum + a.clientsAcquired, 0);
    
    return {
      totalRevenue,
      totalExpenses,
      netPL: totalRevenue - totalExpenses - totalCommission,
      totalCommission,
      pendingPayouts,
      activeAgents,
      totalAgents: agents.length,
      totalClients,
      avgPerformance: agents.length > 0 ? Math.round(agents.reduce((sum, a) => sum + a.performanceScore, 0) / agents.length) : 0
    };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           agent.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [agents, searchQuery, statusFilter]);

  const pendingExpenses = expenses.filter(e => e.status === 'pending');

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-muted text-muted-foreground',
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
    };
    return colors[status] || colors.pending;
  };

  const handleApproveExpense = (expenseId: string) => {
    toast({ title: "Expense Approved", description: "The expense has been approved for reimbursement" });
  };

  const handleRejectExpense = (expenseId: string) => {
    toast({ title: "Expense Rejected", description: "The expense claim has been rejected" });
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600">
              <Building2 className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Agent Cost Center Dashboard</h1>
              <p className="text-muted-foreground">Manage your agents as cost centers with P&L tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCompact(aggregateMetrics.totalRevenue)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-xs text-green-600 mt-1">+18% vs last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">{formatCompact(aggregateMetrics.totalExpenses)}</p>
              </div>
              <Receipt className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-xs text-red-600 mt-1">+5% vs last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net P&L</p>
                <p className="text-xl font-bold text-blue-600">{formatCompact(aggregateMetrics.netPL)}</p>
              </div>
              <Calculator className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-xs text-blue-600 mt-1">After commission payouts</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Payouts</p>
                <p className="text-xl font-bold text-amber-600">{formatCompact(aggregateMetrics.pendingPayouts)}</p>
              </div>
              <Wallet className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-xs text-amber-600 mt-1">{aggregateMetrics.activeAgents} agents awaiting</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Agents</p>
                <p className="text-xl font-bold">{aggregateMetrics.activeAgents}/{aggregateMetrics.totalAgents}</p>
              </div>
              <Users className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-xs text-purple-600 mt-1">{aggregateMetrics.totalClients} clients acquired</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2" data-testid="tab-agents">
            <Users className="w-4 h-4" /> Agent P&L
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2" data-testid="tab-expenses">
            <Receipt className="w-4 h-4" /> Expense Claims
            {pendingExpenses.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingExpenses.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2" data-testid="tab-payouts">
            <Wallet className="w-4 h-4" /> Payouts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-blue-600" />
                  Revenue Distribution by Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {agents.slice(0, 5).map((agent, index) => {
                    const percentage = Math.round((agent.totalRevenue / aggregateMetrics.totalRevenue) * 100);
                    return (
                      <div key={agent.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{agent.name}</span>
                          <span>{formatCompact(agent.totalRevenue)} ({percentage}%)</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-600" />
                  Performance Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agents
                    .sort((a, b) => b.performanceScore - a.performanceScore)
                    .slice(0, 5)
                    .map((agent, index) => (
                      <div key={agent.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-muted text-muted-foreground' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.dealsConverted} deals converted</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{agent.performanceScore}%</p>
                          <Badge className={agent.targetAchievement >= 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                            {agent.targetAchievement}% of target
                          </Badge>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Monthly Trend Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Revenue Growth</p>
                    <p className="text-2xl font-bold text-green-600">+18%</p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Client Growth</p>
                    <p className="text-2xl font-bold text-blue-600">+12%</p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Avg Performance</p>
                    <p className="text-2xl font-bold text-purple-600">{aggregateMetrics.avgPerformance}%</p>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Commission Rate</p>
                    <p className="text-2xl font-bold text-amber-600">30%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Agent Profit & Loss</CardTitle>
                  <CardDescription>View each agent as a cost center with detailed P&L</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search agents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-[200px]"
                      data-testid="input-search-agents"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net P&L</TableHead>
                    <TableHead className="text-right">Performance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((agent) => (
                    <TableRow key={agent.id} data-testid={`agent-row-${agent.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(agent.status)}>{agent.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(agent.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(agent.totalExpenses)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatCurrency(agent.commissionEarned)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={agent.netPL >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                          {formatCurrency(agent.netPL)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={agent.performanceScore} className="w-16 h-2" />
                          <span className="text-sm font-medium">{agent.performanceScore}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowAgentDetail(true);
                          }}
                          data-testid={`button-view-${agent.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Expense Claims
                  </CardTitle>
                  <CardDescription>Review and approve agent expense claims</CardDescription>
                </div>
                <Badge variant="destructive">{pendingExpenses.length} pending approval</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id} data-testid={`expense-row-${expense.id}`}>
                      <TableCell>{format(new Date(expense.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium">{expense.agentName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>
                        <Badge className={
                          expense.status === 'approved' ? 'bg-green-100 text-green-700' :
                          expense.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {expense.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {expense.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleApproveExpense(expense.id)}
                              data-testid={`button-approve-${expense.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRejectExpense(expense.id)}
                              data-testid={`button-reject-${expense.id}`}
                            >
                              <AlertCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Commission Payouts
              </CardTitle>
              <CardDescription>Manage pending commission payouts to agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agents.filter(a => a.pendingPayout > 0).map((agent) => (
                  <div 
                    key={agent.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`payout-row-${agent.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center text-foreground font-bold">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Commission Earned</p>
                      <p className="font-medium">{formatCurrency(agent.commissionEarned)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Already Paid</p>
                      <p className="font-medium text-green-600">{formatCurrency(agent.commissionPaid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="font-bold text-amber-600">{formatCurrency(agent.pendingPayout)}</p>
                    </div>
                    <Button data-testid={`button-process-payout-${agent.id}`}>
                      Process Payout
                    </Button>
                  </div>
                ))}
                
                {agents.filter(a => a.pendingPayout > 0).length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                    <p className="text-muted-foreground">All payouts are up to date</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="flex justify-between items-center w-full">
                <p className="text-muted-foreground">
                  Total pending: <span className="font-bold text-amber-600">{formatCurrency(aggregateMetrics.pendingPayouts)}</span>
                </p>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600" data-testid="button-bulk-payout">
                  <Wallet className="w-4 h-4 mr-2" /> Process All Payouts
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAgentDetail} onOpenChange={setShowAgentDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agent Details - {selectedAgent?.name}</DialogTitle>
            <DialogDescription>Complete P&L and performance metrics</DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Join Date</p>
                  <p className="font-medium">{format(new Date(selectedAgent.joinDate), 'dd MMM yyyy')}</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Last Activity</p>
                  <p className="font-medium">{format(new Date(selectedAgent.lastActivityDate), 'dd MMM yyyy')}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedAgent.totalRevenue)}</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(selectedAgent.totalExpenses)}</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">Net P&L</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(selectedAgent.netPL)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Clients Acquired</span>
                    <span className="font-bold">{selectedAgent.clientsAcquired}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Deals Converted</span>
                    <span className="font-bold">{selectedAgent.dealsConverted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Conversion Rate</span>
                    <span className="font-bold">{Math.round((selectedAgent.dealsConverted / selectedAgent.clientsAcquired) * 100)}%</span>
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Commission Earned</span>
                    <span className="font-bold text-amber-600">{formatCurrency(selectedAgent.commissionEarned)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Paid Out</span>
                    <span className="font-bold text-green-600">{formatCurrency(selectedAgent.commissionPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Pending</span>
                    <span className="font-bold text-red-600">{formatCurrency(selectedAgent.pendingPayout)}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Performance Score</span>
                  <span className="font-bold text-purple-600">{selectedAgent.performanceScore}%</span>
                </div>
                <Progress value={selectedAgent.performanceScore} className="h-3" />
                <p className="text-sm text-muted-foreground mt-2">
                  Target Achievement: {selectedAgent.targetAchievement}%
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentDetail(false)}>Close</Button>
            <Button>View Full History</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
