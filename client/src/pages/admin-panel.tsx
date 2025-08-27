import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Users, Activity, TrendingUp, MessageSquare, Settings, Search, Filter, Shield } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RiskProfileViewer } from "@/components/risk-profiling/risk-profile-viewer";
import { RiskAssessmentForm } from "@/components/risk-profiling/risk-assessment-form";

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalLogins: number;
  avgSessionTime: number;
}

interface ActivityMetrics {
  pageViews: number;
  apiCalls: number;
  trades: number;
  portfolioViews: number;
  topActions: Array<{ action: string; count: number }>;
}

interface PlatformInsights {
  userGrowth: Array<{ date: string; count: number }>;
  popularFeatures: Array<{ feature: string; usage: number }>;
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
  };
  systemHealth: {
    uptime: string;
    errorRate: number;
    responseTime: number;
  };
}

interface User {
  id: string;
  email: string;
  mobile: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [guidanceDialog, setGuidanceDialog] = useState(false);
  const [guidanceForm, setGuidanceForm] = useState({
    title: "",
    message: "",
    type: "guidance",
    priority: "medium",
    actionUrl: ""
  });

  // Fetch dashboard data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ["/api/admin/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch users with filtering
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users", { searchTerm, role: roleFilter, isActive: statusFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('searchTerm', searchTerm);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter);
      
      return fetch(`/api/admin/users?${params}`).then(res => res.json());
    }
  });

  // Fetch platform insights
  const { data: insights } = useQuery({
    queryKey: ["/api/admin/insights"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/admin/activities"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/admin/users/${userId}/status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send guidance mutation
  const sendGuidanceMutation = useMutation({
    mutationFn: async ({ userId, guidance }: { userId: string; guidance: any }) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/guidance`, guidance);
      return response.json();
    },
    onSuccess: () => {
      setGuidanceDialog(false);
      setGuidanceForm({
        title: "",
        message: "",
        type: "guidance",
        priority: "medium",
        actionUrl: ""
      });
      toast({
        title: "Success",
        description: "Guidance sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const { userStats, activityMetrics, platformInsights: dashboardInsights } = dashboardData || {
    userStats: { totalUsers: 0, activeUsers: 0, newUsersToday: 0, totalLogins: 0, avgSessionTime: 0 },
    activityMetrics: { pageViews: 0, apiCalls: 0, trades: 0, portfolioViews: 0, topActions: [] },
    platformInsights: { systemHealth: { uptime: "0h 0m", errorRate: 0, responseTime: 0 } }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-panel">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Panel</h1>
          <p className="text-muted-foreground" data-testid="text-admin-subtitle">
            Monitor and manage platform activity
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-admin-status">Admin Access</Badge>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="w-4 h-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity className="w-4 h-4 mr-2" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Settings className="w-4 h-4 mr-2" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="risk-profiling" data-testid="tab-risk-profiling">
            <Shield className="w-4 h-4 mr-2" />
            Risk Profiles
          </TabsTrigger>
          <TabsTrigger value="guidance" data-testid="tab-guidance">
            <MessageSquare className="w-4 h-4 mr-2" />
            Guidance
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-users">
                  {userStats?.totalUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{userStats?.newUsersToday || 0} new today
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-active-users">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-users">
                  {userStats?.activeUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 7 days
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-total-logins">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-logins">
                  {userStats?.totalLogins || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  All time
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-session">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Session</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-session">
                  {userStats?.avgSessionTime || 0}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Average duration
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-activity-metrics">
              <CardHeader>
                <CardTitle>Activity Metrics</CardTitle>
                <CardDescription>Last 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Page Views</span>
                  <span className="font-bold" data-testid="text-page-views">
                    {activityMetrics?.pageViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>API Calls</span>
                  <span className="font-bold" data-testid="text-api-calls">
                    {activityMetrics?.apiCalls || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Portfolio Views</span>
                  <span className="font-bold" data-testid="text-portfolio-views">
                    {activityMetrics?.portfolioViews || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trades</span>
                  <span className="font-bold" data-testid="text-trades">
                    {activityMetrics?.trades || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Current status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span className="font-bold" data-testid="text-uptime">
                    {dashboardInsights?.systemHealth?.uptime || "0h 0m"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-bold" data-testid="text-error-rate">
                    {dashboardInsights?.systemHealth?.errorRate || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Response Time</span>
                  <span className="font-bold" data-testid="text-response-time">
                    {dashboardInsights?.systemHealth?.responseTime || 0}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800" data-testid="badge-system-status">
                    Healthy
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card data-testid="card-users-table">
            <CardHeader>
              <CardTitle>Users Management</CardTitle>
              <CardDescription>
                Manage user roles and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users?.map((user: User) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium" data-testid={`text-username-${user.id}`}>
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground" data-testid={`text-email-${user.id}`}>
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                            data-testid={`select-role-${user.id}`}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="super_admin">Super Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "secondary" : "destructive"} data-testid={`badge-status-${user.id}`}>
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-last-login-${user.id}`}>
                          {user.lastLoginAt 
                            ? format(new Date(user.lastLoginAt), "MMM d, yyyy")
                            : "Never"
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={user.isActive ? "destructive" : "secondary"}
                              onClick={() => updateStatusMutation.mutate({ 
                                userId: user.id, 
                                isActive: !user.isActive 
                              })}
                              data-testid={`button-toggle-status-${user.id}`}
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setGuidanceDialog(true);
                              }}
                              data-testid={`button-send-guidance-${user.id}`}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <Card data-testid="card-recent-activities">
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Live activity feed from all users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(activities || []).slice(0, 20).map((activity: UserActivity, index: number) => (
                  <div key={activity.id || index} className="flex items-start gap-3 p-3 border rounded-lg" data-testid={`activity-${index}`}>
                    <Activity className="w-4 h-4 mt-1 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" data-testid={`text-activity-action-${index}`}>
                          {activity.action?.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {activity.resource && (
                          <Badge variant="outline" data-testid={`badge-activity-resource-${index}`}>
                            {activity.resource}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-activity-details-${index}`}>
                        User: {activity.userId} • {format(new Date(activity.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="card-user-engagement">
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
                <CardDescription>Active users breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Daily Active</span>
                  <span className="font-bold" data-testid="text-daily-active">
                    {(insights as any)?.userEngagement?.dailyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Weekly Active</span>
                  <span className="font-bold" data-testid="text-weekly-active">
                    {(insights as any)?.userEngagement?.weeklyActiveUsers || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Active</span>
                  <span className="font-bold" data-testid="text-monthly-active">
                    {(insights as any)?.userEngagement?.monthlyActiveUsers || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-popular-features">
              <CardHeader>
                <CardTitle>Popular Features</CardTitle>
                <CardDescription>Most used features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.popularFeatures || []).slice(0, 5).map((feature: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`popular-feature-${index}`}>
                    <span className="text-sm">{feature.feature}</span>
                    <span className="font-bold">{feature.usage}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-user-growth">
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {((insights as any)?.userGrowth || []).slice(-7).map((growth: any, index: number) => (
                  <div key={index} className="flex justify-between" data-testid={`user-growth-${index}`}>
                    <span className="text-sm">{format(new Date(growth.date), "MMM d")}</span>
                    <span className="font-bold">+{growth.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Guidance Tab */}
        <TabsContent value="guidance" className="space-y-6">
          <Card data-testid="card-guidance-tools">
            <CardHeader>
              <CardTitle>User Guidance Tools</CardTitle>
              <CardDescription>
                Send personalized guidance and notifications to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Select a user from the Users tab to send personalized guidance messages.
                Messages can include tips, alerts, or actionable recommendations.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Profiling Tab */}
        <TabsContent value="risk-profiling" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Profile Viewer */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Customer Risk Profiles
                  </CardTitle>
                  <CardDescription>
                    View and manage customer investment risk assessments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskProfileViewer />
                </CardContent>
              </Card>
            </div>

            {/* Risk Assessment Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    New Risk Assessment
                  </CardTitle>
                  <CardDescription>
                    Conduct risk assessment for new or existing customers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RiskAssessmentForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Guidance Dialog */}
      <Dialog open={guidanceDialog} onOpenChange={setGuidanceDialog}>
        <DialogContent data-testid="dialog-send-guidance">
          <DialogHeader>
            <DialogTitle>Send Guidance</DialogTitle>
            <DialogDescription>
              Send personalized guidance to {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={guidanceForm.title}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, title: e.target.value })}
                placeholder="Enter guidance title"
                data-testid="input-guidance-title"
              />
            </div>
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={guidanceForm.message}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, message: e.target.value })}
                placeholder="Enter your guidance message"
                rows={4}
                data-testid="textarea-guidance-message"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={guidanceForm.type}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, type: value })}
                >
                  <SelectTrigger data-testid="select-guidance-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="guidance">Guidance</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="alert">Alert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={guidanceForm.priority}
                  onValueChange={(value) => setGuidanceForm({ ...guidanceForm, priority: value })}
                >
                  <SelectTrigger data-testid="select-guidance-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="actionUrl">Action URL (Optional)</Label>
              <Input
                id="actionUrl"
                value={guidanceForm.actionUrl}
                onChange={(e) => setGuidanceForm({ ...guidanceForm, actionUrl: e.target.value })}
                placeholder="https://example.com/action"
                data-testid="input-guidance-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGuidanceDialog(false)} data-testid="button-cancel-guidance">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedUser && guidanceForm.title && guidanceForm.message) {
                  sendGuidanceMutation.mutate({
                    userId: selectedUser.id,
                    guidance: guidanceForm
                  });
                }
              }}
              disabled={!guidanceForm.title || !guidanceForm.message || sendGuidanceMutation.isPending}
              data-testid="button-send-guidance"
            >
              {sendGuidanceMutation.isPending ? "Sending..." : "Send Guidance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}