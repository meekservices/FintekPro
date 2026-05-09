import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { LoadingState } from "@/components/LoadingState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, Users, IndianRupee, TrendingUp, Plus, Search, 
  RefreshCw, Pencil, Trash2, UserPlus, ArrowUpDown, Calendar,
  Briefcase, Phone, Mail, MapPin, Award, FileText, DollarSign,
  PieChart, BarChart3, Clock, CheckCircle, XCircle, AlertTriangle,
  ArrowRightLeft, LogOut, UserMinus, ChevronUp
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";

const staffSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Valid phone required"),
  designation: z.string().min(1, "Designation required"),
  branch: z.string().optional(),
  region: z.string().optional(),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface LenderStaff {
  id: string;
  providerId: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  branch?: string;
  region?: string;
  status: string;
  joinedAt: string;
}

interface LoanProvider {
  providerKey: string;
  name: string;
  logo?: string;
  description: string;
  isActive: boolean;
  products: ProviderProduct[];
}

interface ProviderProduct {
  productKey: string;
  productName: string;
  commissionRate: number;
  isActive: boolean;
  minAmount?: number;
  maxAmount?: number;
}

interface CommissionConfig {
  fintekProShare: number;
  partnerShare: number;
  agentShare: number;
}

interface RevenueSummary {
  totalCommissions: number;
  totalPayouts: number;
  netRevenue: number;
  monthlyBreakdown: { month: string; revenue: number; payouts: number }[];
}

export default function AdminLoanManagement() {
  const [activeTab, setActiveTab] = useState("lenders");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<LenderStaff | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const staffForm = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      designation: "",
      branch: "",
      region: "",
    },
  });

  const { data: loanProducts, isLoading: productsLoading } = useQuery<any>({
    queryKey: ["/api/marketplace/loan-products"],
  });

  const { data: loanProviders, isLoading: providersLoading } = useQuery<any>({
    queryKey: ["/api/marketplace/loan-providers"],
  });

  const { data: revenueDashboard, isLoading: revenueLoading } = useQuery<any>({
    queryKey: ["/api/admin/loan-marketplace/revenue-dashboard"],
  });

  const { data: payoutConfig } = useQuery<any>({
    queryKey: ["/api/admin/loan-marketplace/payout-config"],
  });

  const { data: lenderStaff, isLoading: staffLoading } = useQuery<any>({
    queryKey: ["/api/admin/loan-marketplace/staff", selectedProvider],
    enabled: !!selectedProvider,
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: StaffFormData) => {
      const response = await apiRequest("POST", `/api/admin/loan-marketplace/providers/${selectedProvider}/staff`, {
        ...data,
        providerId: selectedProvider,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Staff Added", description: "Staff member has been added successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loan-marketplace/staff", selectedProvider] });
      setIsAddStaffOpen(false);
      staffForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add staff member.", variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ staffId, data }: { staffId: string; data: Partial<StaffFormData> }) => {
      const response = await apiRequest("PUT", `/api/admin/loan-marketplace/staff/${staffId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Staff Updated", description: "Staff member has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loan-marketplace/staff", selectedProvider] });
      setEditingStaff(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update staff member.", variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/loan-marketplace/staff/${staffId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Staff Removed", description: "Staff member has been removed successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loan-marketplace/staff", selectedProvider] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove staff member.", variant: "destructive" });
    },
  });

  const handleEditStaff = (staff: LenderStaff) => {
    setEditingStaff(staff);
    staffForm.setValue("name", staff.name);
    staffForm.setValue("email", staff.email);
    staffForm.setValue("phone", staff.phone);
    staffForm.setValue("designation", staff.designation);
    staffForm.setValue("branch", staff.branch || "");
    staffForm.setValue("region", staff.region || "");
  };

  const handleUpdateStaff = (data: StaffFormData) => {
    if (editingStaff) {
      updateStaffMutation.mutate({ staffId: editingStaff.id, data });
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (confirm("Are you sure you want to remove this staff member?")) {
      deleteStaffMutation.mutate(staffId);
    }
  };

  const updatePayoutConfigMutation = useMutation({
    mutationFn: async (config: CommissionConfig) => {
      const response = await apiRequest("PUT", "/api/admin/loan-marketplace/payout-config", config);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Configuration Updated", description: "Payout configuration has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loan-marketplace/payout-config"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update configuration.", variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'inactive': return 'bg-muted text-foreground';
      case 'on_leave': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'resigned': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'terminated': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const handleAddStaff = (data: StaffFormData) => {
    createStaffMutation.mutate(data);
  };

  const providers = loanProviders?.data || [];
  const products = loanProducts?.data || [];
  const staff: LenderStaff[] = lenderStaff?.data || [];

  const filteredStaff = staff.filter((s: any) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="admin-loan-management">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Loan Marketplace Management</h1>
          <p className="text-muted-foreground">Manage partner lenders, staff, commissions, and revenue</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries()} data-testid="refresh-btn">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{providers.length}</p>
              <p className="text-xs text-muted-foreground">Partner Lenders</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
              <FileText className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{products.length}</p>
              <p className="text-xs text-muted-foreground">Loan Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-3">
              <IndianRupee className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(revenueDashboard?.data?.totalCommissions || 0)}</p>
              <p className="text-xs text-muted-foreground">Total Commissions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(revenueDashboard?.data?.netRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground">Net Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList>
          <TabsTrigger value="lenders" data-testid="tab-lenders">Partner Lenders</TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">Loan Products</TabsTrigger>
          <TabsTrigger value="staff" data-testid="tab-staff">Lender Staff</TabsTrigger>
          <TabsTrigger value="commissions" data-testid="tab-commissions">Commission Config</TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue Dashboard</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="lenders" className="space-y-6" data-testid="lenders-content">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Partner Lenders</h2>
          </div>

          {providersLoading ? (
            <LoadingState variant="card" count={4} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((provider: LoanProvider) => (
                <Card key={provider.providerKey} className="hover:shadow-md transition-shadow" data-testid={`lender-${provider.providerKey}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-blue-600" />
                      </div>
                      <Badge variant={provider.isActive ? "default" : "secondary"}>
                        {provider.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{provider.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Products:</span>
                        <span className="font-semibold">{provider.products?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Commission Range:</span>
                        <span className="font-semibold text-green-600">
                          {provider.products?.length > 0 
                            ? `${Math.min(...provider.products.map((p: any) => p.commissionRate))}% - ${Math.max(...provider.products.map((p: any) => p.commissionRate))}%`
                            : "N/A"
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setSelectedProvider(provider.providerKey);
                          setActiveTab("staff");
                        }}
                        data-testid={`view-staff-${provider.providerKey}`}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        View Staff
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-6" data-testid="products-content">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Loan Products</h2>
          </div>

          {productsLoading ? (
            <LoadingState variant="card" count={6} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product: any) => (
                <Card key={product.key} className="hover:shadow-md transition-shadow" data-testid={`product-admin-${product.key}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                      <Badge variant={product.isActive !== false ? "default" : "secondary"}>
                        {product.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-lg mb-2">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Interest Rate:</span>
                        <span className="font-semibold text-green-600">
                          {product.minInterestRate}% - {product.maxInterestRate}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount Range:</span>
                        <span className="font-semibold">
                          {formatCurrency(product.minAmount)} - {formatCurrency(product.maxAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tenure:</span>
                        <span className="font-semibold">{product.minTenure} - {product.maxTenure} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Processing Fee:</span>
                        <span className="font-semibold">{product.processingFee}%</span>
                      </div>
                    </div>

                    {product.eligibility && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Eligibility Requirements</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs">
                            Min Income: {formatCurrency(product.eligibility.minMonthlyIncome || 0)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            CIBIL: {product.eligibility.minCibilScore || 650}+
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="staff" className="space-y-6" data-testid="staff-content">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">Lender Staff</h2>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[200px]" data-testid="select-provider">
                  <SelectValue placeholder="Select Lender" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p: LoanProvider) => (
                    <SelectItem key={p.providerKey} value={p.providerKey}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px]"
                  data-testid="search-staff"
                />
              </div>
              {selectedProvider && (
                <>
                <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-staff-btn">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Staff Member</DialogTitle>
                    </DialogHeader>
                    <Form {...staffForm}>
                      <form onSubmit={staffForm.handleSubmit(handleAddStaff)} className="space-y-4">
                        <FormField
                          control={staffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter full name" data-testid="staff-name-input" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" placeholder="email@example.com" data-testid="staff-email-input" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="+91 9876543210" data-testid="staff-phone-input" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={staffForm.control}
                          name="designation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Designation</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger data-testid="staff-designation-select">
                                    <SelectValue placeholder="Select designation" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="relationship_manager">Relationship Manager</SelectItem>
                                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                                  <SelectItem value="credit_officer">Credit Officer</SelectItem>
                                  <SelectItem value="zonal_head">Zonal Head</SelectItem>
                                  <SelectItem value="regional_head">Regional Head</SelectItem>
                                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={staffForm.control}
                            name="branch"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Branch (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Branch name" data-testid="staff-branch-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={staffForm.control}
                            name="region"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Region (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Region" data-testid="staff-region-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsAddStaffOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={createStaffMutation.isPending} data-testid="submit-staff-btn">
                            {createStaffMutation.isPending ? "Adding..." : "Add Staff"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                {/* Edit Staff Dialog */}
                <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Staff Member</DialogTitle>
                    </DialogHeader>
                    <Form {...staffForm}>
                      <form onSubmit={staffForm.handleSubmit(handleUpdateStaff)} className="space-y-4">
                        <FormField
                          control={staffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="John Doe" data-testid="edit-staff-name-input" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={staffForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input {...field} type="email" placeholder="john@bank.com" data-testid="edit-staff-email-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={staffForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="9876543210" data-testid="edit-staff-phone-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={staffForm.control}
                          name="designation"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Designation</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="edit-staff-designation-select">
                                    <SelectValue placeholder="Select designation" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="relationship_manager">Relationship Manager</SelectItem>
                                  <SelectItem value="branch_manager">Branch Manager</SelectItem>
                                  <SelectItem value="credit_officer">Credit Officer</SelectItem>
                                  <SelectItem value="zonal_head">Zonal Head</SelectItem>
                                  <SelectItem value="regional_head">Regional Head</SelectItem>
                                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={staffForm.control}
                            name="branch"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Branch (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Branch name" data-testid="edit-staff-branch-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={staffForm.control}
                            name="region"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Region (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Region" data-testid="edit-staff-region-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setEditingStaff(null)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={updateStaffMutation.isPending} data-testid="update-staff-btn">
                            {updateStaffMutation.isPending ? "Updating..." : "Update Staff"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                </>
              )}
            </div>
          </div>

          {!selectedProvider ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Lender</h3>
                <p className="text-muted-foreground">Choose a partner lender to view and manage their staff</p>
              </CardContent>
            </Card>
          ) : staffLoading ? (
            <LoadingState variant="table" count={5} />
          ) : filteredStaff.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
                <p className="text-muted-foreground mb-4">Add staff members for this lender</p>
                <Button onClick={() => setIsAddStaffOpen(true)} data-testid="add-first-staff-btn">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Staff Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Designation</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Branch</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((member) => (
                    <tr key={member.id} className="border-t hover:bg-muted" data-testid={`staff-row-${member.id}`}>
                      <td className="py-3 px-4">
                        <div className="font-medium">{member.name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{(member.designation || 'staff').replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {member.email}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {member.phone}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          {member.branch && <div>{member.branch}</div>}
                          {member.region && <div className="text-muted-foreground">{member.region}</div>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(member.status)}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleEditStaff(member)}
                            data-testid={`edit-staff-${member.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30"
                            onClick={() => handleDeleteStaff(member.id)}
                            data-testid={`delete-staff-${member.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="commissions" className="space-y-6" data-testid="commissions-content">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Revenue Split Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Configure how commission revenue is split between FintekPro, partners, and agents.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">FintekPro Share</span>
                      <span className="text-sm font-bold text-blue-600">{payoutConfig?.data?.fintekProShare || 40}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full" 
                        style={{ width: `${payoutConfig?.data?.fintekProShare || 40}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Partner Share</span>
                      <span className="text-sm font-bold text-green-600">{payoutConfig?.data?.partnerShare || 30}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-600 rounded-full" 
                        style={{ width: `${payoutConfig?.data?.partnerShare || 30}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Agent Share</span>
                      <span className="text-sm font-bold text-purple-600">{payoutConfig?.data?.agentShare || 30}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-600 rounded-full" 
                        style={{ width: `${payoutConfig?.data?.agentShare || 30}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-4">
                    Total must equal 100%. Changes will affect all new commission calculations.
                  </p>
                  <Button variant="outline" className="w-full" data-testid="edit-split-btn">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Split Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Product Commission Rates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {providers.slice(0, 3).map((provider: LoanProvider) => (
                    <div key={provider.providerKey} className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">{provider.name}</h4>
                      <div className="space-y-2">
                        {provider.products?.slice(0, 4).map((product) => (
                          <div key={product.productKey} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{product.productName}</span>
                            <Badge variant="outline" className="text-green-600">
                              {product.commissionRate}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6" data-testid="revenue-content">
          {revenueLoading ? (
            <LoadingState variant="card" count={4} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Commissions</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(revenueDashboard?.data?.totalCommissions || 0)}
                        </p>
                      </div>
                      <IndianRupee className="h-8 w-8 text-green-200" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Partner Payouts</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(revenueDashboard?.data?.partnerPayouts || 0)}
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-blue-200" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Agent Payouts</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrency(revenueDashboard?.data?.agentPayouts || 0)}
                        </p>
                      </div>
                      <Briefcase className="h-8 w-8 text-purple-200" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Net Revenue</p>
                        <p className="text-2xl font-bold text-orange-600">
                          {formatCurrency(revenueDashboard?.data?.netRevenue || 0)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-orange-200" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Lead Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                            <Clock className="h-4 w-4 text-blue-600" />
                          </div>
                          <span>Total Leads</span>
                        </div>
                        <span className="font-bold">{revenueDashboard?.data?.leadAnalytics?.totalLeads || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          </div>
                          <span>In Processing</span>
                        </div>
                        <span className="font-bold">{revenueDashboard?.data?.leadAnalytics?.processing || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <span>Sanctioned</span>
                        </div>
                        <span className="font-bold">{revenueDashboard?.data?.leadAnalytics?.sanctioned || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center">
                            <IndianRupee className="h-4 w-4 text-purple-600" />
                          </div>
                          <span>Disbursed</span>
                        </div>
                        <span className="font-bold">{revenueDashboard?.data?.leadAnalytics?.disbursed || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded flex items-center justify-center">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </div>
                          <span>Rejected</span>
                        </div>
                        <span className="font-bold">{revenueDashboard?.data?.leadAnalytics?.rejected || 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Top Performing Products
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(revenueDashboard?.data?.topProducts || [
                        { name: "Personal Loan", leads: 45, conversion: 65 },
                        { name: "Home Loan", leads: 32, conversion: 72 },
                        { name: "Business Loan", leads: 28, conversion: 58 },
                        { name: "Car Loan", leads: 22, conversion: 70 },
                      ]).map((product: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.leads} leads</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{product.conversion}%</p>
                            <p className="text-xs text-muted-foreground">conversion</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
