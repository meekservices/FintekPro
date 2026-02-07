import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Wallet,
  IndianRupee,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  UserX,
  Loader2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

interface AgentData {
  id: string;
  name: string;
  aum: number;
  revenueMTD: number;
  clients: number;
  conversionRate: number;
  trend: "up" | "down" | "stable";
  status: "active" | "inactive" | "warning";
  lastActive: string;
}

interface ApiAgent {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  agentType: string;
  status: string;
  isActive: boolean;
  activeClients: number;
  totalRevenue: string;
  createdAt: string;
}

function getLastActiveText(createdAt: string): string {
  const now = new Date();
  const updated = new Date(createdAt);
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

function transformApiAgentToAgentData(agent: ApiAgent): AgentData {
  const totalRevenue = parseFloat(agent.totalRevenue || "0");
  const activeClients = agent.activeClients || 0;
  
  const conversionRate = activeClients > 0 ? Math.min(100, 50 + activeClients * 5) : 50;
  
  let trend: "up" | "down" | "stable" = "stable";
  if (totalRevenue > 100000) trend = "up";
  else if (activeClients === 0) trend = "down";
  
  let status: "active" | "inactive" | "warning" = "active";
  if (!agent.isActive || agent.status === "inactive") status = "inactive";
  else if (agent.status === "on_leave" || agent.status === "warning") status = "warning";
  
  return {
    id: agent.id,
    name: agent.fullName || "Unknown Agent",
    aum: totalRevenue * 10,
    revenueMTD: totalRevenue,
    clients: activeClients,
    conversionRate: Math.min(100, Math.max(0, conversionRate)),
    trend,
    status,
    lastActive: getLastActiveText(agent.createdAt)
  };
}

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"];

const formatCurrency = (value: number) => {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  } else if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  } else if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)} K`;
  }
  return `₹${value.toFixed(0)}`;
};

export default function AgentPerformanceDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [performanceFilter, setPerformanceFilter] = useState("all");

  const { data: agentsResponse, isLoading, refetch } = useQuery<{ success: boolean; data: { data: ApiAgent[]; total: number } }>({
    queryKey: ["/api/admin/agents"],
    queryFn: async () => {
      const response = await apiRequest("/api/admin/agents");
      return response;
    }
  });

  const agents: AgentData[] = (agentsResponse?.data?.data || []).map(transformApiAgentToAgentData);
  
  const revenueByAgentData = agents.slice(0, 8).map(agent => ({
    name: agent.name.split(" ")[0],
    revenue: agent.revenueMTD / 1000,
    aum: agent.aum / 1000000
  }));

  const totalAgents = agents.length;
  const totalAUM = agents.reduce((sum, agent) => sum + agent.aum, 0);
  const totalRevenue = agents.reduce((sum, agent) => sum + agent.revenueMTD, 0);
  const avgConversionRate = totalAgents > 0 ? agents.reduce((sum, agent) => sum + agent.conversionRate, 0) / totalAgents : 0;

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    const matchesPerformance = performanceFilter === "all" ||
      (performanceFilter === "high" && agent.conversionRate >= 60) ||
      (performanceFilter === "medium" && agent.conversionRate >= 40 && agent.conversionRate < 60) ||
      (performanceFilter === "low" && agent.conversionRate < 40);
    return matchesSearch && matchesStatus && matchesPerformance;
  });

  const agentsNeedingAttention = agents.filter(
    agent => agent.status === "warning" || agent.status === "inactive" || agent.conversionRate < 45
  );
  
  const handleRefresh = () => {
    refetch();
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-green-400" />;
    if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-400" />;
    return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === "active") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
    if (status === "warning") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Warning</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Agent Performance Dashboard</h1>
          <p className="text-muted-foreground mt-1">Monitor and analyze all agents' performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-border text-muted-foreground hover:bg-muted" 
            data-testid="button-refresh"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-agents">{totalAgents}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Real-time count</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total AUM</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-aum">{formatCurrency(totalAUM)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Based on commissions</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue MTD</CardTitle>
            <IndianRupee className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total commissions</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16 bg-muted" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-avg-conversion">{avgConversionRate.toFixed(1)}%</div>
            )}
            <p className="text-xs text-amber-400 mt-1">Target: 60%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Revenue by Agent (₹K)</CardTitle>
            <CardDescription className="text-muted-foreground">
              Monthly revenue contribution by top agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByAgentData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#9ca3af" tickFormatter={(value) => `₹${value}K`} />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: number) => [`₹${value.toFixed(0)}K`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {revenueByAgentData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Agents Needing Attention
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Low performers, inactive agents, or those with declining metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentsNeedingAttention.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">All agents are performing well!</p>
              ) : (
                agentsNeedingAttention.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
                    data-testid={`card-agent-attention-${agent.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        agent.status === "inactive" ? "bg-red-500/20" : "bg-amber-500/20"
                      }`}>
                        {agent.status === "inactive" ? (
                          <UserX className="h-5 w-5 text-red-400" />
                        ) : (
                          <Clock className="h-5 w-5 text-amber-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">Last active: {agent.lastActive}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(agent.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Conv: {agent.conversionRate}%
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-foreground">Top Performing Agents</CardTitle>
              <CardDescription className="text-muted-foreground">
                Detailed performance metrics for all agents
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-muted border-border text-foreground w-48"
                  data-testid="input-search-agents"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-muted border-border text-foreground" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-performance-filter">
                  <SelectValue placeholder="Performance" />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border">
                  <SelectItem value="all">All Performance</SelectItem>
                  <SelectItem value="high">High (&gt;60%)</SelectItem>
                  <SelectItem value="medium">Medium (40-60%)</SelectItem>
                  <SelectItem value="low">Low (&lt;40%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50">
                  <TableHead className="text-muted-foreground">Agent Name</TableHead>
                  <TableHead className="text-muted-foreground text-right">AUM</TableHead>
                  <TableHead className="text-muted-foreground text-right">Revenue MTD</TableHead>
                  <TableHead className="text-muted-foreground text-right">Clients</TableHead>
                  <TableHead className="text-muted-foreground text-right">Conversion Rate</TableHead>
                  <TableHead className="text-muted-foreground text-center">Trend</TableHead>
                  <TableHead className="text-muted-foreground text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="border-border hover:bg-muted/50"
                    data-testid={`row-agent-${agent.id}`}
                  >
                    <TableCell className="font-medium text-foreground">{agent.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(agent.aum)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(agent.revenueMTD)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{agent.clients}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        agent.conversionRate >= 60 ? "text-green-400" :
                        agent.conversionRate >= 40 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {agent.conversionRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {getTrendIcon(agent.trend)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(agent.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredAgents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No agents found matching the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
