import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  UserX
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
  id: number;
  name: string;
  aum: number;
  revenueMTD: number;
  clients: number;
  conversionRate: number;
  trend: "up" | "down" | "stable";
  status: "active" | "inactive" | "warning";
  lastActive: string;
}

const sampleAgents: AgentData[] = [
  { id: 1, name: "Rajesh Kumar", aum: 45000000, revenueMTD: 425000, clients: 48, conversionRate: 72.5, trend: "up", status: "active", lastActive: "2 hours ago" },
  { id: 2, name: "Priya Sharma", aum: 38000000, revenueMTD: 380000, clients: 42, conversionRate: 68.3, trend: "up", status: "active", lastActive: "1 hour ago" },
  { id: 3, name: "Amit Patel", aum: 32000000, revenueMTD: 295000, clients: 35, conversionRate: 65.0, trend: "stable", status: "active", lastActive: "30 mins ago" },
  { id: 4, name: "Sneha Reddy", aum: 28500000, revenueMTD: 265000, clients: 31, conversionRate: 61.2, trend: "up", status: "active", lastActive: "4 hours ago" },
  { id: 5, name: "Vikram Singh", aum: 25000000, revenueMTD: 220000, clients: 28, conversionRate: 58.7, trend: "down", status: "active", lastActive: "1 day ago" },
  { id: 6, name: "Anita Desai", aum: 22000000, revenueMTD: 185000, clients: 25, conversionRate: 55.4, trend: "stable", status: "active", lastActive: "3 hours ago" },
  { id: 7, name: "Kiran Mehta", aum: 18500000, revenueMTD: 145000, clients: 20, conversionRate: 48.2, trend: "down", status: "warning", lastActive: "3 days ago" },
  { id: 8, name: "Suresh Nair", aum: 12000000, revenueMTD: 95000, clients: 15, conversionRate: 42.5, trend: "down", status: "warning", lastActive: "5 days ago" },
  { id: 9, name: "Deepak Joshi", aum: 8500000, revenueMTD: 62000, clients: 10, conversionRate: 35.0, trend: "down", status: "inactive", lastActive: "2 weeks ago" },
  { id: 10, name: "Meena Iyer", aum: 5000000, revenueMTD: 38000, clients: 8, conversionRate: 28.5, trend: "down", status: "inactive", lastActive: "3 weeks ago" },
];

const revenueByAgentData = sampleAgents.slice(0, 8).map(agent => ({
  name: agent.name.split(" ")[0],
  revenue: agent.revenueMTD / 1000,
  aum: agent.aum / 1000000
}));

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

  const totalAgents = sampleAgents.length;
  const totalAUM = sampleAgents.reduce((sum, agent) => sum + agent.aum, 0);
  const totalRevenue = sampleAgents.reduce((sum, agent) => sum + agent.revenueMTD, 0);
  const avgConversionRate = sampleAgents.reduce((sum, agent) => sum + agent.conversionRate, 0) / totalAgents;

  const filteredAgents = sampleAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    const matchesPerformance = performanceFilter === "all" ||
      (performanceFilter === "high" && agent.conversionRate >= 60) ||
      (performanceFilter === "medium" && agent.conversionRate >= 40 && agent.conversionRate < 60) ||
      (performanceFilter === "low" && agent.conversionRate < 40);
    return matchesSearch && matchesStatus && matchesPerformance;
  });

  const agentsNeedingAttention = sampleAgents.filter(
    agent => agent.status === "warning" || agent.status === "inactive" || agent.conversionRate < 45
  );

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-green-400" />;
    if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-400" />;
    return <TrendingUp className="h-4 w-4 text-gray-400" />;
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
          <h1 className="text-3xl font-bold text-white" data-testid="text-page-title">Agent Performance Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor and analyze all agents' performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-total-agents">{totalAgents}</div>
            <p className="text-xs text-green-400 mt-1">+2 this month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total AUM</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-total-aum">{formatCurrency(totalAUM)}</div>
            <p className="text-xs text-green-400 mt-1">+8.5% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Revenue MTD</CardTitle>
            <IndianRupee className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-green-400 mt-1">+12.3% from last month</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-avg-conversion">{avgConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-amber-400 mt-1">Target: 60%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Revenue by Agent (₹K)</CardTitle>
            <CardDescription className="text-gray-400">
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

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Agents Needing Attention
            </CardTitle>
            <CardDescription className="text-gray-400">
              Low performers, inactive agents, or those with declining metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentsNeedingAttention.length === 0 ? (
                <p className="text-gray-500 text-center py-8">All agents are performing well!</p>
              ) : (
                agentsNeedingAttention.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
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
                        <p className="font-medium text-white">{agent.name}</p>
                        <p className="text-sm text-gray-400">Last active: {agent.lastActive}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(agent.status)}
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
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

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-white">Top Performing Agents</CardTitle>
              <CardDescription className="text-gray-400">
                Detailed performance metrics for all agents
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search agents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white w-48"
                  data-testid="input-search-agents"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 bg-gray-800 border-gray-700 text-white" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={performanceFilter} onValueChange={setPerformanceFilter}>
                <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-performance-filter">
                  <SelectValue placeholder="Performance" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
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
          <div className="rounded-md border border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 bg-gray-800/50">
                  <TableHead className="text-gray-300">Agent Name</TableHead>
                  <TableHead className="text-gray-300 text-right">AUM</TableHead>
                  <TableHead className="text-gray-300 text-right">Revenue MTD</TableHead>
                  <TableHead className="text-gray-300 text-right">Clients</TableHead>
                  <TableHead className="text-gray-300 text-right">Conversion Rate</TableHead>
                  <TableHead className="text-gray-300 text-center">Trend</TableHead>
                  <TableHead className="text-gray-300 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="border-gray-700 hover:bg-gray-800/50"
                    data-testid={`row-agent-${agent.id}`}
                  >
                    <TableCell className="font-medium text-white">{agent.name}</TableCell>
                    <TableCell className="text-right text-gray-300">{formatCurrency(agent.aum)}</TableCell>
                    <TableCell className="text-right text-gray-300">{formatCurrency(agent.revenueMTD)}</TableCell>
                    <TableCell className="text-right text-gray-300">{agent.clients}</TableCell>
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
            <div className="text-center py-8 text-gray-500">
              No agents found matching the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
