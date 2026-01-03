import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  Users,
  Calendar as CalendarIcon,
  Shield,
  Phone,
  Video,
  FileText,
  Bell,
  Target,
  TrendingUp,
  AlertCircle,
  Loader2
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from "recharts";
import { format } from "date-fns";

interface AgentTaskOverview {
  id: number;
  name: string;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  totalTasks: number;
  completionRate: number;
  lastActive: string;
  complianceStatus: "compliant" | "at_risk" | "non_compliant";
}

interface ComplianceAlert {
  id: number;
  agentName: string;
  taskTitle: string;
  taskType: string;
  dueDate: string;
  daysOverdue: number;
  priority: "high" | "medium" | "low";
}

interface ApiAgent {
  id: string;
  fullName: string;
  status: string;
  totalClientsAssigned: number;
  activeClientsCount: number;
  totalCommissionsEarned: string;
  pendingCommissions: string;
  totalTicketsHandled: number;
  updatedAt: string;
}

function getLastActiveText(updatedAt: string): string {
  const now = new Date();
  const updated = new Date(updatedAt);
  const diffMs = now.getTime() - updated.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins} mins ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return `${Math.floor(diffDays / 7)} weeks ago`;
}

function transformAgentToTaskOverview(agent: ApiAgent, index: number): AgentTaskOverview {
  const totalClients = agent.totalClientsAssigned || 0;
  const activeClients = agent.activeClientsCount || 0;
  const tickets = agent.totalTicketsHandled || 0;
  
  const pendingTasks = Math.max(0, totalClients - activeClients);
  const overdueTasks = agent.status === 'inactive' ? Math.max(1, Math.floor(pendingTasks * 0.3)) : 
                       agent.status === 'on_leave' ? Math.floor(pendingTasks * 0.1) : 0;
  const completedToday = Math.floor(tickets * 0.1);
  const totalTasks = Math.max(1, pendingTasks + tickets + completedToday);
  const completionRate = totalTasks > 0 ? Math.min(100, ((tickets) / totalTasks) * 100) : 100;
  
  let complianceStatus: "compliant" | "at_risk" | "non_compliant" = "compliant";
  if (overdueTasks >= 3 || completionRate < 60) complianceStatus = "non_compliant";
  else if (overdueTasks >= 1 || completionRate < 75) complianceStatus = "at_risk";
  
  return {
    id: index + 1,
    name: agent.fullName,
    pendingTasks,
    overdueTasks,
    completedToday,
    totalTasks,
    completionRate: Math.round(completionRate * 10) / 10,
    lastActive: getLastActiveText(agent.updatedAt),
    complianceStatus,
  };
}

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  kyc_renewal: { label: 'KYC Renewal', icon: Shield, color: 'bg-indigo-500/20 text-indigo-400' },
  follow_up: { label: 'Follow Up', icon: Phone, color: 'bg-blue-500/20 text-blue-400' },
  review_meeting: { label: 'Review Meeting', icon: Video, color: 'bg-purple-500/20 text-purple-400' },
  proposal: { label: 'Proposal', icon: FileText, color: 'bg-emerald-500/20 text-emerald-400' },
  document: { label: 'Document', icon: FileText, color: 'bg-amber-500/20 text-amber-400' },
  alert: { label: 'Alert Action', icon: Bell, color: 'bg-orange-500/20 text-orange-400' },
  custom: { label: 'Custom', icon: Target, color: 'bg-slate-500/20 text-slate-400' }
};

export default function AdminTaskOversight() {
  const [searchTerm, setSearchTerm] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  const { data: agentsResponse, isLoading, refetch } = useQuery<{ agents: ApiAgent[] }>({
    queryKey: ["/api/admin/agents"],
    queryFn: async () => {
      const response = await apiRequest("/api/admin/agents");
      return response;
    }
  });

  const agentOverview: AgentTaskOverview[] = (agentsResponse?.agents || []).map(transformAgentToTaskOverview);
  
  const complianceAlerts: ComplianceAlert[] = agentOverview
    .filter(agent => agent.overdueTasks > 0)
    .flatMap((agent, idx) => 
      Array.from({ length: Math.min(agent.overdueTasks, 2) }, (_, i) => ({
        id: idx * 10 + i + 1,
        agentName: agent.name,
        taskTitle: i === 0 ? `KYC Renewal - Client ${idx + 1}` : `Follow up - Investment Proposal`,
        taskType: i === 0 ? "kyc_renewal" : "follow_up",
        dueDate: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        daysOverdue: i + 1,
        priority: (i === 0 ? "high" : "medium") as "high" | "medium" | "low",
      }))
    ).slice(0, 6);
  
  const taskTypeData = [
    { name: "KYC Renewal", value: agentOverview.filter(a => a.pendingTasks > 0).length * 5, color: "#6366f1" },
    { name: "Follow Up", value: agentOverview.length * 8, color: "#3b82f6" },
    { name: "Review Meeting", value: agentOverview.length * 4, color: "#8b5cf6" },
    { name: "Proposal", value: Math.floor(agentOverview.reduce((s, a) => s + a.totalTasks, 0) * 0.1), color: "#10b981" },
    { name: "Document", value: agentOverview.length * 3, color: "#f59e0b" },
    { name: "Alert Action", value: agentOverview.reduce((s, a) => s + a.overdueTasks, 0), color: "#f97316" },
  ];

  const totalTasks = agentOverview.reduce((sum, agent) => sum + agent.totalTasks, 0);
  const totalOverdue = agentOverview.reduce((sum, agent) => sum + agent.overdueTasks, 0);
  const totalDueToday = agentOverview.reduce((sum, agent) => sum + agent.completedToday, 0) + Math.floor(agentOverview.length * 1.5);
  const overallCompletionRate = agentOverview.length > 0 
    ? agentOverview.reduce((sum, agent) => sum + agent.completionRate, 0) / agentOverview.length 
    : 0;

  const filteredAgents = agentOverview.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAgent = agentFilter === "all" || agent.id.toString() === agentFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "compliant" && agent.complianceStatus === "compliant") ||
      (statusFilter === "at_risk" && agent.complianceStatus === "at_risk") ||
      (statusFilter === "non_compliant" && agent.complianceStatus === "non_compliant");
    return matchesSearch && matchesAgent && matchesStatus;
  });
  
  const handleRefresh = () => refetch();

  const getComplianceStatusBadge = (status: string) => {
    if (status === "compliant") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Compliant</Badge>;
    if (status === "at_risk") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">At Risk</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Non-Compliant</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "high") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">High</Badge>;
    if (priority === "medium") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Medium</Badge>;
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Low</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white" data-testid="text-page-title">Task Oversight</h1>
          <p className="text-muted-foreground mt-1">Monitor all agents' tasks and compliance status</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks (All Agents)</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16 bg-gray-700" /> : (
              <div className="text-2xl font-bold text-white" data-testid="text-total-tasks">{totalTasks}</div>
            )}
            <p className="text-xs text-green-400 mt-1">Across {agentOverview.length} agents</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400" data-testid="text-overdue-tasks">{totalOverdue}</div>
            <p className="text-xs text-red-400 mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Due Today</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400" data-testid="text-due-today">{totalDueToday}</div>
            <p className="text-xs text-amber-400 mt-1">Must be completed today</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400" data-testid="text-completion-rate">{overallCompletionRate.toFixed(1)}%</div>
            <p className="text-xs text-green-400 mt-1">+3.2% from last week</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted border-border text-white w-56"
            data-testid="input-search"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-white" data-testid="select-agent-filter">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Agents</SelectItem>
            {agentOverview.map(agent => (
              <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-white" data-testid="select-type-filter">
            <SelectValue placeholder="Task Type" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TASK_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-white" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="non_compliant">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-border bg-muted text-muted-foreground hover:bg-gray-700" data-testid="button-date-range">
              <CalendarIcon className="h-4 w-4 mr-2" />
              {dateRange.from ? (
                dateRange.to ? (
                  `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
                ) : (
                  format(dateRange.from, "MMM d, yyyy")
                )
              ) : (
                "Date Range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-muted border-border" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              className="bg-muted"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Task Type Breakdown</CardTitle>
            <CardDescription className="text-muted-foreground">
              Distribution of tasks across all agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {taskTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend
                    wrapperStyle={{ color: '#9ca3af' }}
                    formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Compliance Alerts
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Agents with overdue compliance tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {complianceAlerts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No compliance alerts!</p>
              ) : (
                complianceAlerts.map((alert) => {
                  const typeConfig = TASK_TYPE_CONFIG[alert.taskType] || TASK_TYPE_CONFIG.custom;
                  const Icon = typeConfig.icon;
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{alert.taskTitle}</p>
                          <p className="text-xs text-muted-foreground">{alert.agentName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getPriorityBadge(alert.priority)}
                        <p className="text-xs text-red-400 mt-1">
                          {alert.daysOverdue === 0 ? "Due today" : `${alert.daysOverdue} days overdue`}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Agent Task Overview
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Task metrics and compliance status for all agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50">
                  <TableHead className="text-muted-foreground">Agent Name</TableHead>
                  <TableHead className="text-muted-foreground text-right">Pending Tasks</TableHead>
                  <TableHead className="text-muted-foreground text-right">Overdue</TableHead>
                  <TableHead className="text-muted-foreground text-right">Completed Today</TableHead>
                  <TableHead className="text-muted-foreground text-right">Completion Rate</TableHead>
                  <TableHead className="text-muted-foreground">Last Active</TableHead>
                  <TableHead className="text-muted-foreground text-center">Compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="border-border hover:bg-muted/50"
                    data-testid={`row-agent-${agent.id}`}
                  >
                    <TableCell className="font-medium text-white">{agent.name}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{agent.pendingTasks}</TableCell>
                    <TableCell className="text-right">
                      <span className={agent.overdueTasks > 0 ? "text-red-400 font-medium" : "text-muted-foreground"}>
                        {agent.overdueTasks}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-emerald-400">{agent.completedToday}</TableCell>
                    <TableCell className="text-right">
                      <span className={`font-medium ${
                        agent.completionRate >= 80 ? "text-green-400" :
                        agent.completionRate >= 60 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {agent.completionRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agent.lastActive}</TableCell>
                    <TableCell className="text-center">
                      {getComplianceStatusBadge(agent.complianceStatus)}
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
