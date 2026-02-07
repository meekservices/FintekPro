import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalSkeleton } from "@/components/PortalSkeleton";
import type { AgentProfile, AgentStats, AgentPartner } from "@shared/schema";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { SubAgentDashboard } from "@/components/SubAgentDashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Users, 
  UserPlus, 
  Building2, 
  CreditCard, 
  TrendingUp, 
  FileText, 
  Settings, 
  Shield, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus,
  Search,
  Download,
  Upload,
  BarChart3,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info
} from "lucide-react";

// Form validation schemas
const partnerFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactEmail: z.string().email("Valid email is required"),
  contactPhone: z.string().min(1, "Phone number is required"),
  address: z.string().optional(),
  website: z.string().url("Valid URL required").optional().or(z.literal("")),
  partnerType: z.enum(["product_provider", "service_provider", "both"]),
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
  euinNumber: z.string().optional(),
  arnCode: z.string().optional(),
  hasEuinArn: z.boolean().default(false)
});

const clientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  mobile: z.string().min(10, "Valid mobile number is required"),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Valid PAN number is required"),
  assignedAgent: z.string().optional(),
  masterAgentEuin: z.string().optional()
});

type PartnerFormData = z.infer<typeof partnerFormSchema>;
type ClientFormData = z.infer<typeof clientFormSchema>;

// Client Profile Completion Component
function ClientProfileCompletion() {
  const { toast } = useToast();
  
  // Fetch current user profile
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['/api/user/profile'],
  });

  // Profile completion form  
  const profileFormSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Valid PAN number is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().min(1, "Pincode is required"),
    occupation: z.string().min(1, "Occupation is required"),
    annualIncome: z.string().min(1, "Annual income is required"),
    bankAccountNumber: z.string().min(1, "Bank account number is required"),
    ifscCode: z.string().min(1, "IFSC code is required"),
  });

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      panNumber: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      occupation: "",
      annualIncome: "",
      bankAccountNumber: "",
      ifscCode: "",
    }
  });

  // Reset form when userProfile data loads
  useEffect(() => {
    if (userProfile) {
      profileForm.reset({
        firstName: (userProfile as any)?.firstName || "",
        lastName: (userProfile as any)?.lastName || "",
        dateOfBirth: (userProfile as any)?.dateOfBirth || "",
        panNumber: (userProfile as any)?.panNumber || "",
        address: (userProfile as any)?.address || "",
        city: (userProfile as any)?.city || "",
        state: (userProfile as any)?.state || "",
        pincode: (userProfile as any)?.pincode || "",
        occupation: (userProfile as any)?.occupation || "",
        annualIncome: (userProfile as any)?.annualIncome || "",
        bankAccountNumber: (userProfile as any)?.bankAccountNumber || "",
        ifscCode: (userProfile as any)?.ifscCode || "",
      });
    }
  }, [userProfile, profileForm]);

  // Update profile mutation using apiRequest
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/user/profile', { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }),
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update profile", variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30" data-testid="client-profile">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Complete Your Profile</h1>
            <p className="text-muted-foreground">Please provide the required information to complete your profile</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Complete your profile to access all features</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your first name" data-testid="input-client-first-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your last name" data-testid="input-client-last-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-client-dob" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="ABCDE1234F" data-testid="input-client-pan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={profileForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter your complete address" data-testid="textarea-client-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="City" data-testid="input-client-city" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input placeholder="State" data-testid="input-client-state" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="pincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode *</FormLabel>
                        <FormControl>
                          <Input placeholder="123456" data-testid="input-client-pincode" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occupation *</FormLabel>
                        <FormControl>
                          <Input placeholder="Your occupation" data-testid="input-client-occupation" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="annualIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Annual Income *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger data-testid="select-client-income">
                              <SelectValue placeholder="Select income range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="below_1_lakh">Below ₹1 Lakh</SelectItem>
                              <SelectItem value="1_5_lakh">₹1-5 Lakh</SelectItem>
                              <SelectItem value="5_10_lakh">₹5-10 Lakh</SelectItem>
                              <SelectItem value="10_25_lakh">₹10-25 Lakh</SelectItem>
                              <SelectItem value="25_50_lakh">₹25-50 Lakh</SelectItem>
                              <SelectItem value="above_50_lakh">Above ₹50 Lakh</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="bankAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Account Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="Account number" data-testid="input-client-account" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="ifscCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IFSC Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="IFSC Code" data-testid="input-client-ifsc" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-update-profile"
                  >
                    {updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AgentPortal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // All hooks must be called before any conditional returns (React Rules of Hooks)
  // State management
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddPartnerDialog, setShowAddPartnerDialog] = useState(false);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form management using react-hook-form + Zod
  const partnerForm = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: {
      companyName: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      website: "",
      partnerType: "product_provider",
      businessLicense: "",
      taxId: "",
      euinNumber: "",
      arnCode: "",
      hasEuinArn: false
    }
  });
  
  const clientForm = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      panNumber: "",
      assignedAgent: "",
      masterAgentEuin: ""
    }
  });
  
  // Get current user role from session with proper error handling
  const { data: currentUser, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['/api/user/profile'],
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry on auth failures
  });

  // Fetch agent profile and data (enabled only when authenticated)
  const { data: agentProfile } = useQuery<AgentProfile>({
    queryKey: ['/api/agent/profile'],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  // Fetch agent's partners (enabled only when authenticated)
  const { data: partnersData = [], isLoading: partnersLoading } = useQuery<AgentPartner[]>({
    queryKey: ['/api/agent/partners'],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  // Fetch agent's clients (enabled only when authenticated)
  const { data: clientsData = [], isLoading: clientsLoading } = useQuery<any[]>({
    queryKey: ['/api/agent/clients', { searchTerm }],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  // Fetch agent statistics (enabled only when authenticated)
  const { data: agentStats } = useQuery<AgentStats>({
    queryKey: ['/api/agent/stats'],
    refetchInterval: 30000,
    enabled: !!currentUser,
  });

  // Partner management mutations using apiRequest
  const addPartnerMutation = useMutation({
    mutationFn: (partnerData: PartnerFormData) => 
      apiRequest('/api/agent/partners', { 
        method: 'POST', 
        body: JSON.stringify(partnerData),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Partner added successfully" });
      setShowAddPartnerDialog(false);
      partnerForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/agent/partners'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/stats'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add partner", variant: "destructive" });
    }
  });

  // Client management mutations using apiRequest
  const addClientMutation = useMutation({
    mutationFn: (clientData: ClientFormData) => 
      apiRequest('/api/agent/clients', { 
        method: 'POST', 
        body: JSON.stringify(clientData),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Client added successfully" });
      setShowAddClientDialog(false);
      clientForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/agent/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/stats'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add client", variant: "destructive" });
    }
  });

  // Show login prompt if not authenticated (after all hooks)
  if (userError || (!userLoading && !currentUser)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30 flex items-center justify-center" data-testid="agent-portal-login">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Partner Portal Access
            </CardTitle>
            <CardDescription>
              Please log in to access the Partner Portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The Partner Portal provides tools for managing clients, partners, and commissions.
            </p>
            <Button 
              className="w-full" 
              onClick={() => window.location.href = '/login'}
              data-testid="button-login"
            >
              <Shield className="w-4 h-4 mr-2" />
              Log In to Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state with skeleton
  if (userLoading) {
    return <PortalSkeleton variant="agent" />;
  }

  const handleAddPartner = (data: PartnerFormData) => {
    // If partner doesn't have EUIN/ARN, use master agent EUIN
    const partnerData = {
      ...data,
      masterAgentEuin: !data.hasEuinArn ? agentProfile?.euinNumber || "" : ""
    };
    addPartnerMutation.mutate(partnerData);
  };

  const handleAddClient = (data: ClientFormData) => {
    // If no specific agent assigned, use master agent EUIN
    const clientData = {
      ...data,
      masterAgentEuin: !data.assignedAgent ? agentProfile?.euinNumber || "" : ""
    };
    addClientMutation.mutate(clientData);
  };

  // Role-based access control
  const userRoles = (currentUser as any)?.roles || [];
  const canManagePartners = userRoles.some((role: string) => ['agent', 'partner', 'admin', 'superadmin'].includes(role));
  const canManageClients = userRoles.some((role: string) => ['agent', 'partner', 'admin', 'superadmin'].includes(role));
  const isClientOnly = userRoles.includes('client') && !canManagePartners;

  // If user is client-only, show client profile completion interface
  if (isClientOnly) {
    return <ClientProfileCompletion />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30" data-testid="agent-portal">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground" data-testid="title-partner-portal">
                Partner Portal
              </h1>
              <p className="text-muted-foreground mt-1">
                Welcome back, {agentProfile?.fullName || 'Partner'}
              </p>
              {agentProfile?.euinNumber && (
                <div className="flex items-center gap-4 mt-2">
                  <Badge className="bg-blue-100 text-blue-800">
                    EUIN: {agentProfile.euinNumber}
                  </Badge>
                  {agentProfile.arnCode && (
                    <Badge className="bg-green-100 text-green-800">
                      ARN: {agentProfile.arnCode}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">partner.fintekpro.com</p>
              <p className="text-xs text-muted-foreground">Partner ID: {agentProfile?.employeeId}</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="partners" data-testid="tab-partners">
              <Building2 className="w-4 h-4 mr-2" />
              Partners
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              <Users className="w-4 h-4 mr-2" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">
              <FileText className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {(agentProfile as any)?.agentLevel === 'sub_agent' ? (
              <SubAgentDashboard agentId={agentProfile?.id || ''} />
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card data-testid="card-total-partners">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-partners">
                        {agentStats?.totalPartners ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agentStats?.activePartners ?? 0} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-total-clients">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-clients">
                        {agentStats?.totalClients ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agentStats?.activeClients ?? 0} active
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-monthly-commissions">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Monthly Commissions</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-monthly-commissions">
                        ₹{agentStats?.monthlyCommissions ?? '0'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        +{agentStats?.commissionGrowth ?? 0}% from last month
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-pending-tasks">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pending-tasks">
                        {agentStats?.pendingTasks ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {agentStats?.urgentTasks ?? 0} urgent
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Activity */}
                <Card data-testid="card-recent-activity">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Your latest actions and updates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {agentStats?.recentActivity?.map((activity: any, index: number) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                          </div>
                        </div>
                      )) || (
                        <p className="text-sm text-muted-foreground">No recent activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Partners Tab */}
          <TabsContent value="partners" className="space-y-6">
            <Card data-testid="card-partners-management">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Partners Management</CardTitle>
                    <CardDescription>Add and manage partners with or without EUIN/ARN numbers</CardDescription>
                  </div>
                  <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" onClick={() => setShowAddPartnerDialog(true)} data-testid="button-add-partner">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Partner
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>EUIN/ARN Status</TableHead>
                      <TableHead>Master Agent</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnersData.map((partner: any, index: number) => (
                      <TableRow key={partner.id} data-testid={`partner-row-${index + 1}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{partner.companyName}</div>
                            <div className="text-sm text-muted-foreground">{partner.website}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-sm">{partner.contactEmail}</div>
                            <div className="text-xs text-muted-foreground">{partner.contactPhone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge>{partner.partnerType.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          {partner.euinNumber ? (
                            <div>
                              <Badge className="bg-green-100 text-green-800">
                                EUIN: {partner.euinNumber}
                              </Badge>
                              {partner.arnCode && (
                                <Badge className="bg-blue-100 text-blue-800 mt-1">
                                  ARN: {partner.arnCode}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">
                              No EUIN/ARN
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {partner.masterAgentEuin ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              {partner.masterAgentEuin}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950" onClick={() => { setSelectedPartner(partner); navigate("/profile"); }} data-testid={`button-view-partner-${partner.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950" onClick={() => { setSelectedPartner(partner); setShowAddPartnerDialog(true); }} data-testid={`button-edit-partner-${partner.id}`}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <Card data-testid="card-clients-management">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Clients Management</CardTitle>
                    <CardDescription>Manage client relationships and EUIN assignments</CardDescription>
                  </div>
                  <Button className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground shadow-md" onClick={() => setShowAddClientDialog(true)} data-testid="button-add-client">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex items-center space-x-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>PAN Number</TableHead>
                      <TableHead>Assigned Agent</TableHead>
                      <TableHead>EUIN Assignment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsData.map((client: any, index: number) => (
                      <TableRow key={client.id} data-testid={`client-row-${index + 1}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.firstName} {client.lastName}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {client.panNumber}
                          </code>
                        </TableCell>
                        <TableCell>
                          {client.assignedAgent ? (
                            <Badge className="bg-blue-100 text-blue-800">
                              {client.assignedAgent}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {client.euinNumber ? (
                            <Badge className="bg-green-100 text-green-800">
                              {client.euinNumber}
                            </Badge>
                          ) : client.masterAgentEuin ? (
                            <Badge className="bg-purple-100 text-purple-800">
                              Master: {client.masterAgentEuin}
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800">
                              No EUIN
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={client.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                            {client.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950" onClick={() => { setSelectedClient(client); navigate("/agent-client-onboarding"); }} data-testid={`button-view-client-${client.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950" onClick={() => { setSelectedClient(client); setShowAddClientDialog(true); }} data-testid={`button-edit-client-${client.id}`}>
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card data-testid="card-reports">
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Download reports and view analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-20 flex-col border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:hover:bg-blue-950" onClick={() => { toast({ title: "Generating Report", description: "Preparing Partner Report..." }); navigate("/reports"); }} data-testid="button-partner-report">
                    <Download className="w-6 h-6 mb-2 text-blue-600" />
                    <span className="text-blue-700 dark:text-blue-300">Partner Report</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col border-green-200 hover:bg-green-50 hover:border-green-300 dark:border-green-800 dark:hover:bg-green-950" onClick={() => { toast({ title: "Generating Report", description: "Preparing Client Report..." }); navigate("/reports"); }} data-testid="button-client-report">
                    <Download className="w-6 h-6 mb-2 text-green-600" />
                    <span className="text-green-700 dark:text-green-300">Client Report</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col border-purple-200 hover:bg-purple-50 hover:border-purple-300 dark:border-purple-800 dark:hover:bg-purple-950" onClick={() => { toast({ title: "Generating Report", description: "Preparing Commission Report..." }); navigate("/reports"); }} data-testid="button-commission-report">
                    <Download className="w-6 h-6 mb-2 text-purple-600" />
                    <span className="text-purple-700 dark:text-purple-300">Commission Report</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-800 dark:hover:bg-amber-950" onClick={() => { toast({ title: "Generating Report", description: "Preparing Activity Report..." }); navigate("/reports"); }} data-testid="button-activity-report">
                    <Download className="w-6 h-6 mb-2 text-amber-600" />
                    <span className="text-amber-700 dark:text-amber-300">Activity Report</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Partner Dialog */}
        <Dialog open={showAddPartnerDialog} onOpenChange={setShowAddPartnerDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Partner</DialogTitle>
              <DialogDescription>Add a new partner with or without EUIN/ARN numbers</DialogDescription>
            </DialogHeader>
            <Form {...partnerForm}>
              <form onSubmit={partnerForm.handleSubmit(handleAddPartner)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={partnerForm.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter company name" data-testid="input-company-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={partnerForm.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="contact@company.com" data-testid="input-contact-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={partnerForm.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 9876543210" data-testid="input-contact-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={partnerForm.control}
                    name="partnerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Partner Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-partner-type">
                              <SelectValue placeholder="Select partner type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product_provider">Product Provider</SelectItem>
                            <SelectItem value="service_provider">Service Provider</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={partnerForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter complete address" data-testid="textarea-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={partnerForm.control}
                  name="hasEuinArn"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-has-euin-arn"
                        />
                      </FormControl>
                      <FormLabel>Partner has EUIN/ARN Number</FormLabel>
                    </FormItem>
                  )}
                />

                {partnerForm.watch("hasEuinArn") && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={partnerForm.control}
                      name="euinNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>EUIN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter EUIN number" data-testid="input-euin-number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={partnerForm.control}
                      name="arnCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ARN Code</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter ARN code" data-testid="input-arn-code" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {!partnerForm.watch("hasEuinArn") && (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-yellow-600" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        This partner will be mapped under your master EUIN: <strong>{agentProfile?.euinNumber}</strong>
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" className="border-border text-muted-foreground hover:bg-muted" onClick={() => setShowAddPartnerDialog(false)} data-testid="button-cancel-partner">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" disabled={addPartnerMutation.isPending} data-testid="button-submit-partner">
                    {addPartnerMutation.isPending ? "Adding..." : "Add Partner"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Client Dialog */}
        <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Add New Client</DialogTitle>
              <DialogDescription>Add a new client and assign EUIN mapping</DialogDescription>
            </DialogHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit(handleAddClient)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" data-testid="input-first-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" data-testid="input-last-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={clientForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="client@example.com" data-testid="input-email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clientForm.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 9876543210" data-testid="input-mobile" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={clientForm.control}
                  name="panNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN Number</FormLabel>
                      <FormControl>
                        <Input placeholder="ABCDE1234F" data-testid="input-pan-number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={clientForm.control}
                  name="assignedAgent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Agent (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Leave empty to use master agent" data-testid="input-assigned-agent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!clientForm.watch("assignedAgent") && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        This client will be assigned to your master EUIN: <strong>{agentProfile?.euinNumber}</strong>
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" className="border-border text-muted-foreground hover:bg-muted" onClick={() => setShowAddClientDialog(false)} data-testid="button-cancel-client">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-foreground" disabled={addClientMutation.isPending} data-testid="button-submit-client">
                    {addClientMutation.isPending ? "Adding..." : "Add Client"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}