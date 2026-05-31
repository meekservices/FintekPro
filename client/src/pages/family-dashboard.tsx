import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/LoadingState';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  TrendingUp,
  Target,
  DollarSign,
  Plus,
  ArrowLeft,
  Crown,
  Shield as LucideShield,
  Eye,
  User,
  MoreVertical,
  Trash2,
  Mail,
  Activity,
  MessageSquare,
  Calendar,
  PieChart,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistance } from 'date-fns';
import type {
  FamilyGroup,
  FamilyMember,
  FamilyGoal,
  FamilyBudget,
  FamilyActivityLog,
  FamilyDiscussion,
  InsertFamilyGoal,
  InsertFamilyBudget,
  InsertFamilyMember,
  InsertFamilyDiscussion,
  InsertFamilyGoalContribution,
} from '@shared/schema';

// Form schemas
const inviteMemberSchema = z.object({
  email: z.string().email('Valid email required'),
  role: z.enum(['admin', 'member', 'view_only']).default('member'),
});

const createGoalSchema = z.object({
  goalName: z.string().min(1, 'Goal name is required'),
  goalType: z.string().min(1, 'Goal type is required'),
  targetAmount: z.coerce.number().min(1, 'Target amount must be positive'),
  targetDate: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  description: z.string().optional(),
});

const contributeGoalSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be positive'),
  note: z.string().optional(),
});

const createBudgetSchema = z.object({
  budgetName: z.string().min(1, 'Budget name is required'),
  category: z.string().min(1, 'Category is required'),
  monthlyLimit: z.coerce.number().min(1, 'Monthly limit must be positive'),
  period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).default('monthly'),
  startDate: z.string().min(1, 'Start date is required'),
  alertThreshold: z.coerce.number().min(1).max(100).default(80),
});

const createDiscussionSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  topicType: z.enum(['general', 'goal', 'portfolio', 'budget', 'investment']).default('general'),
  topicId: z.string().optional(),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;
type CreateGoalFormData = z.infer<typeof createGoalSchema>;
type ContributeGoalFormData = z.infer<typeof contributeGoalSchema>;
type CreateBudgetFormData = z.infer<typeof createBudgetSchema>;
type CreateDiscussionFormData = z.infer<typeof createDiscussionSchema>;

interface DashboardStats {
  totalNetWorth: number;
  memberCount: number;
  activeGoalsCount: number;
  totalMonthlyBudget: number;
}

interface FamilyMemberWithUser extends FamilyMember {
  userName?: string;
  userEmail?: string;
}

interface FamilyGoalWithProgress extends FamilyGoal {
  progressPercentage?: number;
}

interface FamilyBudgetWithProgress extends FamilyBudget {
  progressPercentage?: number;
  isOverBudget?: boolean;
}

interface FamilyActivityWithUser extends FamilyActivityLog {
  userName?: string;
}

interface FamilyDiscussionWithDetails extends FamilyDiscussion {
  authorName?: string;
  replyCount?: number;
}

export default function FamilyDashboard() {
  const [match, params] = useRoute('/families/:id');
  const [, setLocation] = useLocation();
  const familyId = params?.id;
  const { toast } = useToast();

  const [selectedTab, setSelectedTab] = useState('overview');
  const [isInviteMemberOpen, setIsInviteMemberOpen] = useState(false);
  const [isCreateGoalOpen, setIsCreateGoalOpen] = useState(false);
  const [isCreateBudgetOpen, setIsCreateBudgetOpen] = useState(false);
  const [isCreateDiscussionOpen, setIsCreateDiscussionOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FamilyGoal | null>(null);
  const [isContributeOpen, setIsContributeOpen] = useState(false);

  // Forms
  const inviteMemberForm = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const createGoalForm = useForm<CreateGoalFormData>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: {
      goalName: '',
      goalType: 'education',
      priority: 'medium',
      targetAmount: 0,
    },
  });

  const contributeGoalForm = useForm<ContributeGoalFormData>({
    resolver: zodResolver(contributeGoalSchema),
    defaultValues: { amount: 0, note: '' },
  });

  const createBudgetForm = useForm<CreateBudgetFormData>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: {
      budgetName: '',
      category: 'housing',
      period: 'monthly',
      monthlyLimit: 0,
      alertThreshold: 80,
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  const createDiscussionForm = useForm<CreateDiscussionFormData>({
    resolver: zodResolver(createDiscussionSchema),
    defaultValues: {
      subject: '',
      content: '',
      topicType: 'general',
    },
  });

  // Queries
  const { data: family, isLoading: loadingFamily } = useQuery<FamilyGroup>({
    queryKey: ['/api/families', familyId],
    enabled: !!familyId,
  });

  const { data: dashboardStats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ['/api/families', familyId, 'dashboard'],
    enabled: !!familyId,
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery<FamilyMemberWithUser[]>({
    queryKey: ['/api/families', familyId, 'members'],
    enabled: !!familyId,
  });

  const { data: goals = [], isLoading: loadingGoals } = useQuery<FamilyGoalWithProgress[]>({
    queryKey: ['/api/families', familyId, 'goals'],
    enabled: !!familyId,
  });

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery<FamilyBudgetWithProgress[]>({
    queryKey: ['/api/families', familyId, 'budgets'],
    enabled: !!familyId,
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery<FamilyActivityWithUser[]>({
    queryKey: ['/api/families', familyId, 'activities'],
    enabled: !!familyId,
  });

  const { data: discussions = [], isLoading: loadingDiscussions } = useQuery<FamilyDiscussionWithDetails[]>({
    queryKey: ['/api/families', familyId, 'discussions'],
    enabled: !!familyId,
  });

  // Get current user's role
  const currentUserRole = members.find((m) => m.invitationStatus === 'accepted')?.role || 'view_only';
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: async (data: InviteMemberFormData) => {
      return apiRequest(`/api/families/${familyId}/members/invite`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'members'] });
      toast({ title: 'Invitation Sent', description: 'Member invitation has been sent successfully.' });
      setIsInviteMemberOpen(false);
      inviteMemberForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to invite member', variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      return apiRequest(`/api/families/${familyId}/members/${memberId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'members'] });
      toast({ title: 'Role Updated', description: 'Member role has been updated successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to update role', variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return apiRequest(`/api/families/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'members'] });
      toast({ title: 'Member Removed', description: 'Member has been removed from the family.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to remove member', variant: 'destructive' });
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: CreateGoalFormData) => {
      return apiRequest(`/api/families/${familyId}/goals`, {
        method: 'POST',
        body: JSON.stringify({ ...data, familyId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'dashboard'] });
      toast({ title: 'Goal Created', description: 'Family goal has been created successfully.' });
      setIsCreateGoalOpen(false);
      createGoalForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create goal', variant: 'destructive' });
    },
  });

  const contributeGoalMutation = useMutation({
    mutationFn: async (data: ContributeGoalFormData) => {
      return apiRequest(`/api/families/${familyId}/goals/${selectedGoal?.id}/contribute`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'dashboard'] });
      toast({ title: 'Contribution Added', description: 'Your contribution has been recorded successfully.' });
      setIsContributeOpen(false);
      setSelectedGoal(null);
      contributeGoalForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to add contribution', variant: 'destructive' });
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (data: CreateBudgetFormData) => {
      return apiRequest(`/api/families/${familyId}/budgets`, {
        method: 'POST',
        body: JSON.stringify({ ...data, familyId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'budgets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'dashboard'] });
      toast({ title: 'Budget Created', description: 'Family budget has been created successfully.' });
      setIsCreateBudgetOpen(false);
      createBudgetForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create budget', variant: 'destructive' });
    },
  });

  const createDiscussionMutation = useMutation({
    mutationFn: async (data: CreateDiscussionFormData) => {
      return apiRequest(`/api/families/${familyId}/discussions`, {
        method: 'POST',
        body: JSON.stringify({ ...data, familyId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', familyId, 'discussions'] });
      toast({ title: 'Discussion Created', description: 'Discussion thread has been created successfully.' });
      setIsCreateDiscussionOpen(false);
      createDiscussionForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message || 'Failed to create discussion', variant: 'destructive' });
    },
  });

  // Utility functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <LucideShield className="h-4 w-4" />;
      case 'member':
        return <User className="h-4 w-4" />;
      case 'view_only':
        return <Eye className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'view_only':
        return 'bg-muted text-foreground';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-muted text-foreground';
    }
  };

  if (!match) {
    return null;
  }

  if (loadingFamily) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <LoadingState variant="card" count={2} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => setLocation('/families')}
            data-testid="button-back-to-families"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Families
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground flex items-center gap-3" data-testid="title-family-dashboard">
                <Users className="h-10 w-10 text-blue-600" />
                {family?.name || 'Family Dashboard'}
              </h1>
              <p className="text-muted-foreground mt-2">
                {family?.description || 'Collaborate with your family on financial planning'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <ScrollableTabsList className="grid grid-cols-6 w-full" data-testid="tabs-family-dashboard">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <PieChart className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">
              <Target className="h-4 w-4 mr-2" />
              Goals
            </TabsTrigger>
            <TabsTrigger value="budgets" data-testid="tab-budgets">
              <DollarSign className="h-4 w-4 mr-2" />
              Budgets
            </TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">
              <Activity className="h-4 w-4 mr-2" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="discussions" data-testid="tab-discussions">
              <MessageSquare className="h-4 w-4 mr-2" />
              Discussions
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-l-4 border-l-blue-500" data-testid="card-net-worth">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Family Net Worth</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-net-worth">
                        {formatCurrency(dashboardStats?.totalNetWorth || 0)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500" data-testid="card-member-count">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Family Members</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-member-count">
                        {dashboardStats?.memberCount || 0}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500" data-testid="card-active-goals">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Goals</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-active-goals">
                        {dashboardStats?.activeGoalsCount || 0}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500" data-testid="card-monthly-budget">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Budget</p>
                      <p className="text-2xl font-bold text-foreground" data-testid="text-monthly-budget">
                        {formatCurrency(dashboardStats?.totalMonthlyBudget || 0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity Preview */}
            <Card data-testid="card-recent-activity-overview">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest family financial activities</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingActivities ? (
                  <LoadingState variant="list" count={3} />
                ) : activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-activities">
                    No activities yet
                  </p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-4">
                      {activities.slice(0, 5).map((activity, index) => (
                        <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-item-${index}`}>
                          <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {activity.action}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {activity.userName} •{' '}
                              {activity.createdAt
                                ? formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })
                                : 'Recently'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">Family Members</h2>
              {isAdmin && (
                <Dialog open={isInviteMemberOpen} onOpenChange={setIsInviteMemberOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-invite-member">
                      <Mail className="h-4 w-4" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-invite-member">
                    <DialogHeader>
                      <DialogTitle>Invite Family Member</DialogTitle>
                      <DialogDescription>Send an invitation to join this family group</DialogDescription>
                    </DialogHeader>
                    <Form {...inviteMemberForm}>
                      <form onSubmit={inviteMemberForm.handleSubmit((data) => inviteMemberMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={inviteMemberForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder="member@example.com"
                                  data-testid="input-member-email"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={inviteMemberForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-member-role">
                                    <SelectValue placeholder="Select a role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="admin">Admin - Full access</SelectItem>
                                  <SelectItem value="member">Member - Can view and contribute</SelectItem>
                                  <SelectItem value="view_only">Viewer - Read-only access</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsInviteMemberOpen(false)}
                            data-testid="button-cancel-invite"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={inviteMemberMutation.isPending}
                            data-testid="button-submit-invite"
                          >
                            {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {loadingMembers ? (
              <LoadingState variant="card" count={3} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Card key={member.id} data-testid={`card-member-${member.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold text-foreground" data-testid={`text-member-name-${member.id}`}>
                              {member.displayName || member.userName || 'Unknown'}
                            </p>
                            <Badge className={`gap-1 ${getRoleBadgeColor(member.role || 'member')}`} data-testid={`badge-member-role-${member.id}`}>
                              {getRoleIcon(member.role || 'member')}
                              {member.role?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground" data-testid={`text-member-email-${member.id}`}>
                            {member.userEmail || 'No email'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {member.invitationStatus === 'pending' && (
                              <Badge variant="outline" className="text-yellow-600">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            )}
                            {member.invitationStatus === 'accepted' && member.joinedAt && (
                              <span>
                                Joined {formatDistance(new Date(member.joinedAt), new Date(), { addSuffix: true })}
                              </span>
                            )}
                          </p>
                        </div>
                        {isAdmin && member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-member-actions-${member.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: 'admin' })}
                                data-testid={`action-promote-admin-${member.id}`}
                              >
                                <LucideShield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: 'member' })}
                                data-testid={`action-demote-member-${member.id}`}
                              >
                                <User className="h-4 w-4 mr-2" />
                                Make Member
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: 'view_only' })}
                                data-testid={`action-make-viewer-${member.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Make Viewer
                              </DropdownMenuItem>
                              <Separator />
                              <DropdownMenuItem
                                onClick={() => removeMemberMutation.mutate(member.id)}
                                className="text-red-600"
                                data-testid={`action-remove-member-${member.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">Family Goals</h2>
              <Dialog open={isCreateGoalOpen} onOpenChange={setIsCreateGoalOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-create-goal">
                    <Plus className="h-4 w-4" />
                    Add Goal
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-goal">
                  <DialogHeader>
                    <DialogTitle>Create Family Goal</DialogTitle>
                    <DialogDescription>Set a new financial goal for your family</DialogDescription>
                  </DialogHeader>
                  <Form {...createGoalForm}>
                    <form onSubmit={createGoalForm.handleSubmit((data) => createGoalMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={createGoalForm.control}
                        name="goalName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Goal Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., College Education Fund" data-testid="input-goal-name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createGoalForm.control}
                        name="goalType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Goal Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-goal-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="education">Education</SelectItem>
                                <SelectItem value="retirement">Retirement</SelectItem>
                                <SelectItem value="home_purchase">Home Purchase</SelectItem>
                                <SelectItem value="vacation">Vacation</SelectItem>
                                <SelectItem value="emergency_fund">Emergency Fund</SelectItem>
                                <SelectItem value="debt_payoff">Debt Payoff</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createGoalForm.control}
                        name="targetAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Amount (₹)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" placeholder="100000" data-testid="input-goal-target" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createGoalForm.control}
                        name="targetDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Date (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" data-testid="input-goal-date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createGoalForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-goal-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createGoalForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Goal description" data-testid="input-goal-description" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsCreateGoalOpen(false)} data-testid="button-cancel-goal">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createGoalMutation.isPending} data-testid="button-submit-goal">
                          {createGoalMutation.isPending ? 'Creating...' : 'Create Goal'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingGoals ? (
              <LoadingState variant="card" count={3} />
            ) : goals.length === 0 ? (
              <Card className="text-center py-12" data-testid="card-no-goals">
                <CardContent>
                  <Target className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Goals Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create your first family goal to start tracking progress
                  </p>
                  <Button onClick={() => setIsCreateGoalOpen(true)} className="gap-2" data-testid="button-create-first-goal">
                    <Plus className="h-4 w-4" />
                    Create Your First Goal
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {goals.map((goal) => (
                  <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-foreground" data-testid={`text-goal-name-${goal.id}`}>
                              {goal.goalName}
                            </h3>
                            <Badge className={getPriorityBadgeColor(goal.priority || 'medium')} data-testid={`badge-goal-priority-${goal.id}`}>
                              {goal.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">{goal.goalType?.replace('_', ' ')}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedGoal(goal);
                            setIsContributeOpen(true);
                          }}
                          data-testid={`button-contribute-goal-${goal.id}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Contribute
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold" data-testid={`text-goal-progress-${goal.id}`}>
                            {formatCurrency(Number(goal.currentAmount) || 0)} / {formatCurrency(Number(goal.targetAmount))}
                          </span>
                        </div>
                        <Progress value={goal.progressPercentage || 0} className="h-2" data-testid={`progress-goal-${goal.id}`} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{goal.progressPercentage || 0}% complete</span>
                          {goal.targetDate && (
                            <span>Target: {new Date(goal.targetDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      {goal.description && (
                        <p className="mt-4 text-sm text-muted-foreground" data-testid={`text-goal-description-${goal.id}`}>
                          {goal.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Contribute Dialog */}
            <Dialog open={isContributeOpen} onOpenChange={setIsContributeOpen}>
              <DialogContent data-testid="dialog-contribute-goal">
                <DialogHeader>
                  <DialogTitle>Contribute to {selectedGoal?.goalName}</DialogTitle>
                  <DialogDescription>Add your contribution to this family goal</DialogDescription>
                </DialogHeader>
                <Form {...contributeGoalForm}>
                  <form onSubmit={contributeGoalForm.handleSubmit((data) => contributeGoalMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={contributeGoalForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" placeholder="1000" data-testid="input-contribute-amount" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contributeGoalForm.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Add a note..." data-testid="input-contribute-note" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsContributeOpen(false);
                          setSelectedGoal(null);
                        }}
                        data-testid="button-cancel-contribute"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={contributeGoalMutation.isPending} data-testid="button-submit-contribute">
                        {contributeGoalMutation.isPending ? 'Adding...' : 'Add Contribution'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">Family Budgets</h2>
              {isAdmin && (
                <Dialog open={isCreateBudgetOpen} onOpenChange={setIsCreateBudgetOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-create-budget">
                      <Plus className="h-4 w-4" />
                      Add Budget
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-create-budget">
                    <DialogHeader>
                      <DialogTitle>Create Family Budget</DialogTitle>
                      <DialogDescription>Set a new budget category for your family</DialogDescription>
                    </DialogHeader>
                    <Form {...createBudgetForm}>
                      <form onSubmit={createBudgetForm.handleSubmit((data) => createBudgetMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={createBudgetForm.control}
                          name="budgetName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Budget Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Monthly Groceries" data-testid="input-budget-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createBudgetForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-budget-category">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="housing">Housing</SelectItem>
                                  <SelectItem value="food">Food</SelectItem>
                                  <SelectItem value="transportation">Transportation</SelectItem>
                                  <SelectItem value="utilities">Utilities</SelectItem>
                                  <SelectItem value="entertainment">Entertainment</SelectItem>
                                  <SelectItem value="healthcare">Healthcare</SelectItem>
                                  <SelectItem value="education">Education</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createBudgetForm.control}
                          name="monthlyLimit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Budget Limit (₹)</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" placeholder="10000" data-testid="input-budget-limit" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createBudgetForm.control}
                          name="period"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Period</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-budget-period">
                                    <SelectValue placeholder="Select period" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="quarterly">Quarterly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createBudgetForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" data-testid="input-budget-start-date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createBudgetForm.control}
                          name="alertThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Alert Threshold (%)</FormLabel>
                              <FormControl>
                                <Input type="number" min="1" max="100" placeholder="80" data-testid="input-budget-threshold" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsCreateBudgetOpen(false)} data-testid="button-cancel-budget">
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createBudgetMutation.isPending} data-testid="button-submit-budget">
                            {createBudgetMutation.isPending ? 'Creating...' : 'Create Budget'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {loadingBudgets ? (
              <LoadingState variant="card" count={3} />
            ) : budgets.length === 0 ? (
              <Card className="text-center py-12" data-testid="card-no-budgets">
                <CardContent>
                  <DollarSign className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Budgets Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    {isAdmin ? 'Create your first family budget to track spending' : 'No budgets have been created yet'}
                  </p>
                  {isAdmin && (
                    <Button onClick={() => setIsCreateBudgetOpen(true)} className="gap-2" data-testid="button-create-first-budget">
                      <Plus className="h-4 w-4" />
                      Create Your First Budget
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => (
                  <Card key={budget.id} data-testid={`card-budget-${budget.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground" data-testid={`text-budget-name-${budget.id}`}>
                            {budget.budgetName}
                          </h3>
                          <p className="text-sm text-muted-foreground capitalize">{budget.category} • {budget.period}</p>
                        </div>
                        {budget.isOverBudget && (
                          <Badge variant="destructive" data-testid={`badge-over-budget-${budget.id}`}>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Over Budget
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Spent</span>
                          <span className="font-semibold" data-testid={`text-budget-spend-${budget.id}`}>
                            {formatCurrency(Number(budget.currentSpend) || 0)} / {formatCurrency(Number(budget.monthlyLimit))}
                          </span>
                        </div>
                        <Progress
                          value={budget.progressPercentage || 0}
                          className={`h-2 ${budget.isOverBudget ? 'bg-red-200 dark:bg-red-800/30' : ''}`}
                          data-testid={`progress-budget-${budget.id}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{budget.progressPercentage || 0}% used</span>
                          <span>Alert at {budget.alertThreshold}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Family Activity</h2>
            {loadingActivities ? (
              <LoadingState variant="list" count={5} />
            ) : activities.length === 0 ? (
              <Card className="text-center py-12" data-testid="card-no-activities">
                <CardContent>
                  <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Activities Yet</h3>
                  <p className="text-muted-foreground">
                    Family activities will appear here as members interact
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card data-testid="card-activity-timeline">
                <CardContent className="p-6">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-6">
                      {activities.map((activity, index) => (
                        <div key={activity.id} className="flex gap-4" data-testid={`activity-${index}`}>
                          <div className="flex flex-col items-center">
                            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                              <Activity className="h-5 w-5 text-blue-600" />
                            </div>
                            {index < activities.length - 1 && (
                              <div className="w-px h-full bg-muted mt-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-6">
                            <p className="font-medium text-foreground" data-testid={`activity-action-${index}`}>
                              {activity.action}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <span data-testid={`activity-user-${index}`}>{activity.userName || 'Unknown User'}</span>
                              <span>•</span>
                              <span data-testid={`activity-time-${index}`}>
                                {activity.createdAt
                                  ? formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })
                                  : 'Recently'}
                              </span>
                            </div>
                            {activity.metadata && typeof activity.metadata === 'object' ? (
                              <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                                <pre className="text-xs text-muted-foreground">
                                  {JSON.stringify(activity.metadata, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Discussions Tab */}
          <TabsContent value="discussions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-foreground">Family Discussions</h2>
              <Dialog open={isCreateDiscussionOpen} onOpenChange={setIsCreateDiscussionOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="button-create-discussion">
                    <MessageSquare className="h-4 w-4" />
                    Create Discussion
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-discussion">
                  <DialogHeader>
                    <DialogTitle>Create Discussion</DialogTitle>
                    <DialogDescription>Start a new discussion thread with your family</DialogDescription>
                  </DialogHeader>
                  <Form {...createDiscussionForm}>
                    <form onSubmit={createDiscussionForm.handleSubmit((data) => createDiscussionMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={createDiscussionForm.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <Input placeholder="Discussion topic" data-testid="input-discussion-subject" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createDiscussionForm.control}
                        name="topicType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Topic Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-discussion-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="goal">Goal Related</SelectItem>
                                <SelectItem value="portfolio">Portfolio Related</SelectItem>
                                <SelectItem value="budget">Budget Related</SelectItem>
                                <SelectItem value="investment">Investment Discussion</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createDiscussionForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Message</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Share your thoughts..." rows={5} data-testid="input-discussion-content" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsCreateDiscussionOpen(false)} data-testid="button-cancel-discussion">
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createDiscussionMutation.isPending} data-testid="button-submit-discussion">
                          {createDiscussionMutation.isPending ? 'Creating...' : 'Create Discussion'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingDiscussions ? (
              <LoadingState variant="card" count={3} />
            ) : discussions.length === 0 ? (
              <Card className="text-center py-12" data-testid="card-no-discussions">
                <CardContent>
                  <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No Discussions Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start a discussion to collaborate with your family members
                  </p>
                  <Button onClick={() => setIsCreateDiscussionOpen(true)} className="gap-2" data-testid="button-create-first-discussion">
                    <MessageSquare className="h-4 w-4" />
                    Create First Discussion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {discussions.map((discussion) => (
                  <Card key={discussion.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-discussion-${discussion.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-foreground mb-1" data-testid={`text-discussion-subject-${discussion.id}`}>
                            {discussion.subject}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span data-testid={`text-discussion-author-${discussion.id}`}>{discussion.authorName || 'Unknown'}</span>
                            <span>•</span>
                            <span data-testid={`text-discussion-time-${discussion.id}`}>
                              {discussion.createdAt
                                ? formatDistance(new Date(discussion.createdAt), new Date(), { addSuffix: true })
                                : 'Recently'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {discussion.isPinned && (
                            <Badge variant="outline" className="text-blue-600">
                              Pinned
                            </Badge>
                          )}
                          {discussion.isResolved && (
                            <Badge variant="outline" className="text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-muted-foreground text-sm mb-3" data-testid={`text-discussion-content-${discussion.id}`}>
                        {discussion.content}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <Badge variant="outline" className="capitalize">
                          {discussion.topicType?.replace('_', ' ')}
                        </Badge>
                        {discussion.replyCount !== undefined && discussion.replyCount > 0 && (
                          <span className="flex items-center gap-1" data-testid={`text-discussion-replies-${discussion.id}`}>
                            <MessageSquare className="h-4 w-4" />
                            {discussion.replyCount} {discussion.replyCount === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
