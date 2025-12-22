import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ListTodo
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
  kyc_renewal: { label: 'KYC Renewal', icon: Shield, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  document_submission: { label: 'Document Upload', icon: FileText, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  payment_due: { label: 'Payment Due', icon: CreditCard, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  review_scheduled: { label: 'Review Meeting', icon: Video, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  action_required: { label: 'Action Required', icon: Bell, color: 'bg-orange-100 text-orange-700 border-orange-200' }
};

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function ClientTasks() {
  const [activeTab, setActiveTab] = useState("all");

  const sampleTasks: ClientTask[] = [
    {
      id: '1',
      title: 'Complete KYC Renewal',
      description: 'Your KYC documents are expiring on January 15, 2025. Please update your documents to continue trading.',
      type: 'kyc_renewal',
      priority: 'high',
      status: 'pending',
      dueDate: '2025-01-15',
      actionLabel: 'Update KYC',
      actionRoute: '/kyc-dashboard'
    },
    {
      id: '2',
      title: 'Upload PAN Card Copy',
      description: 'Please upload a clear copy of your PAN card for account verification.',
      type: 'document_submission',
      priority: 'medium',
      status: 'pending',
      dueDate: '2024-12-28',
      actionLabel: 'Upload Document',
      actionRoute: '/profile'
    },
    {
      id: '3',
      title: 'SIP Payment Due',
      description: 'Your monthly SIP payment of ₹25,000 is scheduled for debit.',
      type: 'payment_due',
      priority: 'high',
      status: 'pending',
      dueDate: '2024-12-25',
      actionLabel: 'View Details',
      actionRoute: '/mutual-funds'
    },
    {
      id: '4',
      title: 'Quarterly Portfolio Review',
      description: 'Your Q4 portfolio review meeting is scheduled with your advisor.',
      type: 'review_scheduled',
      priority: 'medium',
      status: 'pending',
      dueDate: '2024-12-30',
      actionLabel: 'Join Meeting',
      actionRoute: '/portfolio'
    },
    {
      id: '5',
      title: 'Review Exit Alert - HDFC Bank',
      description: 'Your stock has reached the target price. Review and take action on the exit recommendation.',
      type: 'action_required',
      priority: 'high',
      status: 'pending',
      dueDate: '2024-12-23',
      actionLabel: 'Review Alert',
      actionRoute: '/portfolio'
    },
    {
      id: '6',
      title: 'Portfolio Rebalancing Needed',
      description: 'Your equity allocation has drifted from target. Consider rebalancing your portfolio.',
      type: 'action_required',
      priority: 'medium',
      status: 'pending',
      dueDate: '2024-12-27',
      actionLabel: 'View Suggestions',
      actionRoute: '/portfolio'
    },
    {
      id: '7',
      title: 'Nominee Details Update',
      description: 'Nominee details submission was completed successfully.',
      type: 'document_submission',
      priority: 'low',
      status: 'completed',
      dueDate: '2024-12-10',
      actionLabel: 'View Details',
      actionRoute: '/profile'
    },
    {
      id: '8',
      title: 'Tax Statement Download',
      description: 'Annual tax statement for FY 2023-24 was overdue. Please download now.',
      type: 'document_submission',
      priority: 'high',
      status: 'overdue',
      dueDate: '2024-12-15',
      actionLabel: 'Download',
      actionRoute: '/capital-gains'
    },
    {
      id: '9',
      title: 'Insurance Premium Due',
      description: 'Your term insurance premium payment was pending.',
      type: 'payment_due',
      priority: 'high',
      status: 'overdue',
      dueDate: '2024-12-18',
      actionLabel: 'Pay Now',
      actionRoute: '/insurance'
    },
    {
      id: '10',
      title: 'Annual Review Completed',
      description: 'Your annual portfolio review meeting with advisor was successfully completed.',
      type: 'review_scheduled',
      priority: 'medium',
      status: 'completed',
      dueDate: '2024-12-05'
    }
  ];

  const stats: TaskStats = {
    pending: sampleTasks.filter(t => t.status === 'pending').length,
    completedThisMonth: sampleTasks.filter(t => t.status === 'completed').length,
    overdue: sampleTasks.filter(t => t.status === 'overdue').length,
    dueThisWeek: sampleTasks.filter(t => {
      const today = new Date();
      const dueDate = new Date(t.dueDate);
      const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return t.status === 'pending' && dueDate >= today && dueDate <= weekFromNow;
    }).length
  };

  const filteredTasks = sampleTasks.filter(task => {
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
    return 'text-gray-600';
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="client-tasks-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
              <ListTodo className="h-7 w-7 text-blue-600" />
              My Tasks
            </h1>
            <p className="text-gray-600 mt-1">Track your pending actions and deadlines</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-pending-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Pending Tasks</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-pending-count">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-completed-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Completed This Month</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-completed-count">{stats.completedThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-overdue-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-overdue-count">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-due-week-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Due This Week</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-due-week-count">{stats.dueThisWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white border border-gray-200 shadow-sm">
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

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-gray-100">
                {filteredTasks.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No tasks found</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => {
                    const typeConfig = TASK_TYPE_CONFIG[task.type];
                    const Icon = typeConfig.icon;
                    return (
                      <div
                        key={task.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
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
                                  <p className={`font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`} data-testid={`task-title-${task.id}`}>
                                    {task.title}
                                  </p>
                                  <Badge variant="outline" className={typeConfig.color} data-testid={`task-type-${task.id}`}>
                                    {typeConfig.label}
                                  </Badge>
                                </div>
                                <p className="text-gray-600 text-sm mb-2" data-testid={`task-description-${task.id}`}>
                                  {task.description}
                                </p>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className={`text-sm font-medium ${getDueDateColor(task.dueDate, task.status)}`} data-testid={`task-due-${task.id}`}>
                                    {getDueDateLabel(task.dueDate, task.status)}
                                  </span>
                                  <span className="text-gray-400 text-sm">•</span>
                                  <span className="text-gray-500 text-sm">{formatDate(task.dueDate)}</span>
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

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Need Help?</h3>
                <p className="text-gray-600 text-sm">Contact your advisor for assistance with any pending tasks.</p>
              </div>
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" data-testid="button-contact-advisor">
                Contact Advisor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
