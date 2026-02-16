import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  FileText,
  CreditCard,
  Video,
  Shield,
  Bell,
  ArrowRight,
  ListTodo,
  Loader2,
  RefreshCw
} from "lucide-react";

interface ClientTask {
  id: string;
  title: string;
  description: string;
  type: 'kyc_renewal' | 'document_submission' | 'payment_due' | 'review_scheduled' | 'action_required';
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'overdue';
  dueDate: string;
  actionLabel?: string;
  actionRoute?: string;
}

interface TaskStats {
  pending: number;
  completedThisMonth: number;
  overdue: number;
  dueThisWeek: number;
}

const TASK_TYPE_CONFIG = {
  kyc_renewal: { label: 'KYC Renewal', icon: Shield, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  document_submission: { label: 'Document Upload', icon: FileText, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  payment_due: { label: 'Payment Due', icon: CreditCard, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  review_scheduled: { label: 'Review Meeting', icon: Video, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  action_required: { label: 'Action Required', icon: Bell, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' }
};

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' },
  medium: { label: 'Medium', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  low: { label: 'Low', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground border-border' },
  completed: { label: 'Completed', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  overdue: { label: 'Overdue', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' }
};

export default function ClientTasks() {
  const [activeTab, setActiveTab] = useState("all");

  const { data: tasksResponse, isLoading, refetch } = useQuery<{ tasks: ClientTask[] }>({
    queryKey: ['/api/tasks/user'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/tasks/user');
        return data;
      } catch {
        return { tasks: [] };
      }
    },
  });

  const tasks: ClientTask[] = tasksResponse?.tasks || [];

  const stats: TaskStats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    completedThisMonth: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
    dueThisWeek: tasks.filter(t => {
      const today = new Date();
      const dueDate = new Date(t.dueDate);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return t.status === 'pending' && dueDate >= today && dueDate <= weekFromNow;
    }).length
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'all') return true;
    return task.status === activeTab;
  });

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

  function getDueDateLabel(dateStr: string, status: string) {
    if (status === 'completed') return 'Completed';
    const days = getDaysUntilDue(dateStr);
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }

  function getDueDateColor(dateStr: string, status: string) {
    if (status === 'completed') return 'text-emerald-600';
    const days = getDaysUntilDue(dateStr);
    if (days < 0) return 'text-red-600';
    if (days === 0) return 'text-orange-600';
    if (days <= 3) return 'text-amber-600';
    return 'text-muted-foreground';
  }

  return (
    <div className="min-h-screen bg-muted p-6" data-testid="client-tasks-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
              <ListTodo className="h-7 w-7 text-blue-600" />
              My Tasks
            </h1>
            <p className="text-muted-foreground mt-1">Track your pending actions and deadlines</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border shadow-sm" data-testid="card-pending-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Pending Tasks</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-pending-count">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm" data-testid="card-completed-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Completed This Month</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-completed-count">{stats.completedThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm" data-testid="card-overdue-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Overdue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-overdue-count">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm" data-testid="card-due-week-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Due This Week</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-due-week-count">{stats.dueThisWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-card border border-border shadow-sm">
            <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-all">
              All Tasks
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-pending">
              Pending
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-completed">
              Completed
            </TabsTrigger>
            <TabsTrigger value="overdue" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-overdue">
              Overdue
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const typeConfig = TASK_TYPE_CONFIG[task.type];
                    const Icon = typeConfig.icon;
                    return (
                      <div
                        key={task.id}
                        className="p-4 hover:bg-muted transition-colors"
                        data-testid={`task-card-${task.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg border ${typeConfig.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className={`font-medium ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`} data-testid={`task-title-${task.id}`}>
                                    {task.title}
                                  </p>
                                  <Badge variant="outline" className={typeConfig.color} data-testid={`task-type-${task.id}`}>
                                    {typeConfig.label}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground text-sm mb-2" data-testid={`task-description-${task.id}`}>
                                  {task.description}
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className={`text-sm font-medium ${getDueDateColor(task.dueDate, task.status)}`} data-testid={`task-due-${task.id}`}>
                                    {getDueDateLabel(task.dueDate, task.status)}
                                  </span>
                                  <span className="text-muted-foreground text-sm">•</span>
                                  <span className="text-muted-foreground text-sm">{formatDate(task.dueDate)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="outline" className={PRIORITY_CONFIG[task.priority].color} data-testid={`task-priority-${task.id}`}>
                                  {PRIORITY_CONFIG[task.priority].label}
                                </Badge>
                                <Badge variant="outline" className={STATUS_CONFIG[task.status].color} data-testid={`task-status-${task.id}`}>
                                  {STATUS_CONFIG[task.status].label}
                                </Badge>
                                {task.actionLabel && task.status !== 'completed' && (
                                  <Button 
                                    size="sm" 
                                    className="bg-blue-600 hover:bg-blue-700 text-white ml-2"
                                    data-testid={`task-action-${task.id}`}
                                  >
                                    {task.actionLabel}
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Need Help?</h3>
                <p className="text-muted-foreground text-sm">Contact your advisor for assistance with any pending tasks.</p>
              </div>
              <Button variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30" data-testid="button-contact-advisor">
                Contact Advisor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
