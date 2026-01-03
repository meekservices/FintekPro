import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle,
  Circle,
  AlertCircle,
  Bell,
  Phone,
  Mail,
  Video,
  FileText,
  Shield,
  TrendingUp,
  RefreshCw,
  MoreHorizontal,
  ChevronRight,
  Loader2,
  Star,
  Flag,
  Filter,
  SortAsc,
  Target,
  Users,
  IndianRupee
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'kyc_renewal' | 'follow_up' | 'review_meeting' | 'proposal' | 'document' | 'alert' | 'custom';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  dueDate: string;
  clientId?: string;
  clientName?: string;
  reminderDate?: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
}

const TASK_TYPE_CONFIG = {
  kyc_renewal: { label: 'KYC Renewal', icon: Shield, color: 'bg-indigo-500/20 text-indigo-400' },
  follow_up: { label: 'Follow Up', icon: Phone, color: 'bg-blue-500/20 text-blue-400' },
  review_meeting: { label: 'Review Meeting', icon: Video, color: 'bg-purple-500/20 text-purple-400' },
  proposal: { label: 'Proposal', icon: FileText, color: 'bg-emerald-500/20 text-emerald-400' },
  document: { label: 'Document', icon: FileText, color: 'bg-amber-500/20 text-amber-400' },
  alert: { label: 'Alert Action', icon: Bell, color: 'bg-orange-500/20 text-orange-400' },
  custom: { label: 'Custom', icon: Target, color: 'bg-slate-500/20 text-slate-400' }
};

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  medium: { label: 'Medium', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  low: { label: 'Low', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-slate-500/20 text-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-400' }
};

export default function AgentTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'follow_up',
    priority: 'medium',
    dueDate: '',
    clientName: '',
    recurring: 'none',
    notes: ''
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/agent/tasks']
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<TaskStats>({
    queryKey: ['/api/agent/tasks/stats']
  });

  const tasks = tasksData || [];
  const stats = statsData || {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    dueToday: tasks.filter(t => isToday(t.dueDate)).length,
    dueThisWeek: tasks.filter(t => isThisWeek(t.dueDate)).length
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.clientName && task.clientName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || task.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesTab = activeTab === 'all' ||
      (activeTab === 'today' && isToday(task.dueDate)) ||
      (activeTab === 'week' && isThisWeek(task.dueDate)) ||
      (activeTab === 'overdue' && task.status === 'overdue') ||
      (activeTab === 'completed' && task.status === 'completed');
    return matchesSearch && matchesType && matchesPriority && matchesTab;
  });

  function isToday(dateStr: string) {
    const today = new Date();
    const date = new Date(dateStr);
    return date.toDateString() === today.toDateString();
  }

  function isThisWeek(dateStr: string) {
    const today = new Date();
    const date = new Date(dateStr);
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return date >= today && date <= weekFromNow;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function getDaysUntilDue(dateStr: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function getDueDateColor(dateStr: string, status: string) {
    if (status === 'completed') return 'text-emerald-400';
    const days = getDaysUntilDue(dateStr);
    if (days < 0) return 'text-red-400';
    if (days === 0) return 'text-orange-400';
    if (days <= 3) return 'text-amber-400';
    return 'text-slate-400';
  }

  function getDueDateLabel(dateStr: string, status: string) {
    if (status === 'completed') return 'Completed';
    const days = getDaysUntilDue(dateStr);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
              Task Management
            </h1>
            <p className="text-slate-400 mt-1">Track tasks, reminders, and follow-ups</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-slate-800 border-slate-700 text-white"
                data-testid="input-search-tasks"
              />
            </div>
            <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-add-task">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription className="text-slate-400">Add a new task or reminder</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="title" className="text-slate-300">Title *</Label>
                    <Input
                      id="title"
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      className="mt-1 bg-slate-800 border-slate-700"
                      placeholder="Task title"
                      data-testid="input-task-title"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Type</Label>
                      <Select value={newTask.type} onValueChange={(value) => setNewTask({ ...newTask, type: value })}>
                        <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {Object.entries(TASK_TYPE_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>{config.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Priority</Label>
                      <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                        <SelectTrigger className="mt-1 bg-slate-800 border-slate-700" data-testid="select-task-priority">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-300">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full mt-1 justify-start border-slate-700 bg-slate-800 text-left">
                            <CalendarIcon className="h-4 w-4 mr-2 text-slate-400" />
                            {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="bg-slate-800"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-slate-300">Recurring</Label>
                      <Select value={newTask.recurring} onValueChange={(value) => setNewTask({ ...newTask, recurring: value })}>
                        <SelectTrigger className="mt-1 bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="none">No repeat</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="client" className="text-slate-300">Client (optional)</Label>
                    <Input
                      id="client"
                      value={newTask.clientName}
                      onChange={(e) => setNewTask({ ...newTask, clientName: e.target.value })}
                      className="mt-1 bg-slate-800 border-slate-700"
                      placeholder="Client name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-slate-300">Description</Label>
                    <Textarea
                      id="description"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="mt-1 bg-slate-800 border-slate-700"
                      placeholder="Task details..."
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => setShowAddTask(false)} className="border-slate-600">Cancel</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-save-task">
                      Create Task
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Total Tasks</p>
              <p className="text-2xl font-bold text-white" data-testid="text-total-tasks">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Due Today</p>
              <p className="text-2xl font-bold text-orange-400" data-testid="text-due-today">{stats.dueToday}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">This Week</p>
              <p className="text-2xl font-bold text-amber-400">{stats.dueThisWeek}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">In Progress</p>
              <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Overdue</p>
              <p className="text-2xl font-bold text-red-400" data-testid="text-overdue-tasks">{stats.overdue}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Completed</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Tabs */}
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-slate-800 border-slate-700">
              <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600">All</TabsTrigger>
              <TabsTrigger value="today" className="data-[state=active]:bg-emerald-600">Today</TabsTrigger>
              <TabsTrigger value="week" className="data-[state=active]:bg-emerald-600">This Week</TabsTrigger>
              <TabsTrigger value="overdue" className="data-[state=active]:bg-emerald-600">Overdue</TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-emerald-600">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                <Filter className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TASK_TYPE_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
                <Flag className="h-4 w-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-slate-700">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const typeConfig = TASK_TYPE_CONFIG[task.type];
                    const Icon = typeConfig.icon;
                    return (
                      <div
                        key={task.id}
                        className="p-4 hover:bg-slate-900/50 transition-colors flex items-start gap-4"
                        data-testid={`task-item-${task.id}`}
                      >
                        <div className="pt-1">
                          <Checkbox
                            checked={task.status === 'completed'}
                            className="border-slate-600 data-[state=checked]:bg-emerald-600"
                            data-testid={`checkbox-task-${task.id}`}
                          />
                        </div>
                        <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className={`font-medium ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                                {task.title}
                              </p>
                              <p className="text-slate-400 text-sm mt-0.5">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={PRIORITY_CONFIG[task.priority].color}>
                                {PRIORITY_CONFIG[task.priority].label}
                              </Badge>
                              <Badge className={STATUS_CONFIG[task.status].color}>
                                {STATUS_CONFIG[task.status].label}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {task.clientName && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <User className="h-3 w-3" />
                                {task.clientName}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 ${getDueDateColor(task.dueDate, task.status)}`}>
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(task.dueDate)}
                              <span className="text-xs">({getDueDateLabel(task.dueDate, task.status)})</span>
                            </span>
                            {task.recurring && task.recurring !== 'none' && (
                              <span className="flex items-center gap-1 text-slate-400">
                                <RefreshCw className="h-3 w-3" />
                                {task.recurring.charAt(0).toUpperCase() + task.recurring.slice(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700 border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Upcoming KYC Renewals</p>
                  <p className="text-slate-400 text-sm">3 clients have KYC expiring in 30 days</p>
                </div>
                <Button size="sm" variant="outline" className="border-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700 border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Pending Exit Alerts</p>
                  <p className="text-slate-400 text-sm">5 stocks require action based on exit signals</p>
                </div>
                <Button size="sm" variant="outline" className="border-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700 border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Scheduled Meetings</p>
                  <p className="text-slate-400 text-sm">2 client meetings this week</p>
                </div>
                <Button size="sm" variant="outline" className="border-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
