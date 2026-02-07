import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

interface TaskOversightStats {
  totalTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  dueToday: number;
  completionRate: number;
  agentCount: number;
}

interface AgentTaskOverview {
  id: string;
  name: string;
  email: string;
  pendingTasks: number;
  overdueTasks: number;
  completedToday: number;
  totalTasks: number;
  completionRate: number;
  lastActive: string;
  complianceStatus: "compliant" | "at_risk" | "non_compliant";
}

interface ComplianceAlert {
  id: string;
  agentId: string;
  agentName: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  dueDate: string;
  daysOverdue: number;
  priority: "high" | "medium" | "low";
  clientName?: string;
}

interface TaskTypeBreakdown {
  name: string;
  value: number;
  color: string;
}

const TASK_TYPE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  kyc_renewal: { label: 'KYC Renewal', icon: Shield, color: 'bg-indigo-500/20 text-indigo-400' },
  document_submission: { label: 'Document', icon: FileText, color: 'bg-amber-500/20 text-amber-400' },
  payment_due: { label: 'Payment Due', icon: Bell, color: 'bg-red-500/20 text-red-400' },
  review_scheduled: { label: 'Review', icon: Video, color: 'bg-purple-500/20 text-purple-400' },
  action_required: { label: 'Action Required', icon: Target, color: 'bg-orange-500/20 text-orange-400' },
  follow_up: { label: 'Follow Up', icon: Phone, color: 'bg-blue-500/20 text-blue-400' },
  call: { label: 'Phone Call', icon: Phone, color: 'bg-emerald-500/20 text-emerald-400' },
  video_call: { label: 'Video Call', icon: Video, color: 'bg-purple-500/20 text-purple-400' },
  in_person: { label: 'In Person', icon: Users, color: 'bg-teal-500/20 text-teal-400' },
  office_visit: { label: 'Office Visit', icon: Users, color: 'bg-indigo-500/20 text-indigo-400' },
  meeting: { label: 'Meeting', icon: Video, color: 'bg-violet-500/20 text-violet-400' },
  custom: { label: 'Other', icon: Target, color: 'bg-muted/20 text-muted-foreground' }
};

export default function AdminTaskOversight() {
  const [searchTerm, setSearchTerm] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const queryClient = useQueryClient();

  const { data: statsResponse, isLoading: statsLoading } = useQuery<{ success: boolean; stats: TaskOversightStats }>({
    queryKey: ["/api/admin/task-oversight/stats"],
  });

  const { data: agentsResponse, isLoading: agentsLoading, refetch: refetchAgents } = useQuery<{ success: boolean; agents: AgentTaskOverview[] }>({
    queryKey: ["/api/admin/task-oversight/agents"],
  });

  const { data: alertsResponse, isLoading: alertsLoading } = useQuery<{ success: boolean; alerts: ComplianceAlert[] }>({
    queryKey: ["/api/admin/task-oversight/alerts"],
  });

  const { data: breakdownResponse, isLoading: breakdownLoading } = useQuery<{ success: boolean; breakdown: TaskTypeBreakdown[] }>({
    queryKey: ["/api/admin/task-oversight/breakdown"],
  });

  const isLoading = statsLoading || agentsLoading;
  const stats = statsResponse?.stats;
  const agentOverview = agentsResponse?.agents || [];
  const complianceAlerts = alertsResponse?.alerts || [];
  const taskTypeData = breakdownResponse?.breakdown || [];

  const filteredAgents = agentOverview.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          agent.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAgent = agentFilter === "all" || agent.id === agentFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "compliant" && agent.complianceStatus === "compliant") ||
      (statusFilter === "at_risk" && agent.complianceStatus === "at_risk") ||
      (statusFilter === "non_compliant" && agent.complianceStatus === "non_compliant");
    return matchesSearch && matchesAgent && matchesStatus;
  });
  
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/task-oversight/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/task-oversight/agents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/task-oversight/alerts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/task-oversight/breakdown"] });
  };

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
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Task Oversight</h1>
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
            {statsLoading ? <Skeleton className="h-8 w-16 bg-muted" /> : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-tasks">{stats?.totalTasks || 0}</div>
            )}
            <p className="text-xs text-green-400 mt-1">Across {stats?.agentCount || 0} agents</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16 bg-muted" /> : (
              <div className="text-2xl font-bold text-red-400" data-testid="text-overdue-tasks">{stats?.overdueTasks || 0}</div>
            )}
            <p className="text-xs text-red-400 mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Due Today</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16 bg-muted" /> : (
              <div className="text-2xl font-bold text-amber-400" data-testid="text-due-today">{stats?.dueToday || 0}</div>
            )}
            <p className="text-xs text-amber-400 mt-1">Must be completed today</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-8 w-16 bg-muted" /> : (
              <div className="text-2xl font-bold text-emerald-400" data-testid="text-completion-rate">{stats?.completionRate?.toFixed(1) || 0}%</div>
            )}
            <p className="text-xs text-green-400 mt-1">{stats?.completedToday || 0} completed today</p>
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
            className="pl-10 bg-muted border-border text-foreground w-56"
            data-testid="input-search"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-agent-filter">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Agents</SelectItem>
            {agentOverview.map(agent => (
              <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-type-filter">
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
          <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-status-filter">
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
            <Button variant="outline" className="border-border bg-muted text-muted-foreground hover:bg-muted" data-testid="button-date-range">
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
              Distribution of pending tasks across all agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {breakdownLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : taskTypeData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mb-2 text-green-400" />
                  <p>No pending tasks</p>
                </div>
              ) : (
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
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Compliance Alerts
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Overdue tasks requiring immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {alertsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : complianceAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-400" />
                  <p className="text-muted-foreground">No compliance alerts - all tasks on track!</p>
                </div>
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
                          <p className="font-medium text-foreground text-sm">{alert.taskTitle}</p>
                          <p className="text-xs text-muted-foreground">{alert.agentName}</p>
                          {alert.clientName && (
                            <p className="text-xs text-muted-foreground">Client: {alert.clientName}</p>
                          )}
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
          <CardTitle className="text-foreground flex items-center gap-2">
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
                {agentsLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredAgents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No agents found matching the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgents.map((agent) => (
                    <TableRow
                      key={agent.id}
                      className="border-border hover:bg-muted/50"
                      data-testid={`row-agent-${agent.id}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.email}</p>
                        </div>
                      </TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
