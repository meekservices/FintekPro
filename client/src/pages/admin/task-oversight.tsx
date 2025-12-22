import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  AlertCircle
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

const sampleAgentOverview: AgentTaskOverview[] = [
  { id: 1, name: "Rajesh Kumar", pendingTasks: 8, overdueTasks: 1, completedToday: 3, totalTasks: 45, completionRate: 82.2, lastActive: "2 hours ago", complianceStatus: "compliant" },
  { id: 2, name: "Priya Sharma", pendingTasks: 5, overdueTasks: 0, completedToday: 4, totalTasks: 38, completionRate: 89.5, lastActive: "1 hour ago", complianceStatus: "compliant" },
  { id: 3, name: "Amit Patel", pendingTasks: 12, overdueTasks: 3, completedToday: 2, totalTasks: 52, completionRate: 71.2, lastActive: "30 mins ago", complianceStatus: "at_risk" },
  { id: 4, name: "Sneha Reddy", pendingTasks: 6, overdueTasks: 0, completedToday: 5, totalTasks: 35, completionRate: 91.4, lastActive: "4 hours ago", complianceStatus: "compliant" },
  { id: 5, name: "Vikram Singh", pendingTasks: 15, overdueTasks: 5, completedToday: 1, totalTasks: 48, completionRate: 58.3, lastActive: "1 day ago", complianceStatus: "non_compliant" },
  { id: 6, name: "Anita Desai", pendingTasks: 7, overdueTasks: 2, completedToday: 2, totalTasks: 32, completionRate: 75.0, lastActive: "3 hours ago", complianceStatus: "at_risk" },
  { id: 7, name: "Kiran Mehta", pendingTasks: 9, overdueTasks: 4, completedToday: 0, totalTasks: 28, completionRate: 53.6, lastActive: "3 days ago", complianceStatus: "non_compliant" },
  { id: 8, name: "Suresh Nair", pendingTasks: 4, overdueTasks: 1, completedToday: 3, totalTasks: 25, completionRate: 80.0, lastActive: "5 hours ago", complianceStatus: "compliant" },
];

const complianceAlerts: ComplianceAlert[] = [
  { id: 1, agentName: "Vikram Singh", taskTitle: "KYC Renewal - Mahesh Gupta", taskType: "kyc_renewal", dueDate: "2024-12-18", daysOverdue: 4, priority: "high" },
  { id: 2, agentName: "Kiran Mehta", taskTitle: "Quarterly Review - Anand Shah", taskType: "review_meeting", dueDate: "2024-12-19", daysOverdue: 3, priority: "high" },
  { id: 3, agentName: "Vikram Singh", taskTitle: "Compliance Document Submission", taskType: "document", dueDate: "2024-12-20", daysOverdue: 2, priority: "medium" },
  { id: 4, agentName: "Amit Patel", taskTitle: "Client Risk Assessment Update", taskType: "alert", dueDate: "2024-12-21", daysOverdue: 1, priority: "high" },
  { id: 5, agentName: "Kiran Mehta", taskTitle: "Follow up - Investment Proposal", taskType: "follow_up", dueDate: "2024-12-21", daysOverdue: 1, priority: "medium" },
  { id: 6, agentName: "Anita Desai", taskTitle: "KYC Update - Ravi Kumar", taskType: "kyc_renewal", dueDate: "2024-12-22", daysOverdue: 0, priority: "high" },
];

const taskTypeData = [
  { name: "KYC Renewal", value: 45, color: "#6366f1" },
  { name: "Follow Up", value: 82, color: "#3b82f6" },
  { name: "Review Meeting", value: 38, color: "#8b5cf6" },
  { name: "Proposal", value: 25, color: "#10b981" },
  { name: "Document", value: 32, color: "#f59e0b" },
  { name: "Alert Action", value: 18, color: "#f97316" },
];

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

  const totalTasks = sampleAgentOverview.reduce((sum, agent) => sum + agent.totalTasks, 0);
  const totalOverdue = sampleAgentOverview.reduce((sum, agent) => sum + agent.overdueTasks, 0);
  const totalDueToday = 12;
  const overallCompletionRate = sampleAgentOverview.reduce((sum, agent) => sum + agent.completionRate, 0) / sampleAgentOverview.length;

  const filteredAgents = sampleAgentOverview.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAgent = agentFilter === "all" || agent.id.toString() === agentFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "compliant" && agent.complianceStatus === "compliant") ||
      (statusFilter === "at_risk" && agent.complianceStatus === "at_risk") ||
      (statusFilter === "non_compliant" && agent.complianceStatus === "non_compliant");
    return matchesSearch && matchesAgent && matchesStatus;
  });

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
          <p className="text-gray-400 mt-1">Monitor all agents' tasks and compliance status</p>
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
            <CardTitle className="text-sm font-medium text-gray-400">Total Tasks (All Agents)</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-total-tasks">{totalTasks}</div>
            <p className="text-xs text-green-400 mt-1">Across {sampleAgentOverview.length} agents</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400" data-testid="text-overdue-tasks">{totalOverdue}</div>
            <p className="text-xs text-red-400 mt-1">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Tasks Due Today</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400" data-testid="text-due-today">{totalDueToday}</div>
            <p className="text-xs text-amber-400 mt-1">Must be completed today</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Completion Rate</CardTitle>
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white w-56"
            data-testid="input-search"
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-agent-filter">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Agents</SelectItem>
            {sampleAgentOverview.map(agent => (
              <SelectItem key={agent.id} value={agent.id.toString()}>{agent.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-type-filter">
            <SelectValue placeholder="Task Type" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TASK_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
            <SelectItem value="non_compliant">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" data-testid="button-date-range">
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
          <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-700" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              className="bg-gray-800"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Task Type Breakdown</CardTitle>
            <CardDescription className="text-gray-400">
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
                    formatter={(value) => <span className="text-gray-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Compliance Alerts
            </CardTitle>
            <CardDescription className="text-gray-400">
              Agents with overdue compliance tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {complianceAlerts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No compliance alerts!</p>
              ) : (
                complianceAlerts.map((alert) => {
                  const typeConfig = TASK_TYPE_CONFIG[alert.taskType] || TASK_TYPE_CONFIG.custom;
                  const Icon = typeConfig.icon;
                  return (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                      data-testid={`alert-item-${alert.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{alert.taskTitle}</p>
                          <p className="text-xs text-gray-400">{alert.agentName}</p>
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

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            Agent Task Overview
          </CardTitle>
          <CardDescription className="text-gray-400">
            Task metrics and compliance status for all agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-700 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 bg-gray-800/50">
                  <TableHead className="text-gray-300">Agent Name</TableHead>
                  <TableHead className="text-gray-300 text-right">Pending Tasks</TableHead>
                  <TableHead className="text-gray-300 text-right">Overdue</TableHead>
                  <TableHead className="text-gray-300 text-right">Completed Today</TableHead>
                  <TableHead className="text-gray-300 text-right">Completion Rate</TableHead>
                  <TableHead className="text-gray-300">Last Active</TableHead>
                  <TableHead className="text-gray-300 text-center">Compliance</TableHead>
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
                    <TableCell className="text-right text-gray-300">{agent.pendingTasks}</TableCell>
                    <TableCell className="text-right">
                      <span className={agent.overdueTasks > 0 ? "text-red-400 font-medium" : "text-gray-300"}>
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
                    <TableCell className="text-gray-400">{agent.lastActive}</TableCell>
                    <TableCell className="text-center">
                      {getComplianceStatusBadge(agent.complianceStatus)}
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
