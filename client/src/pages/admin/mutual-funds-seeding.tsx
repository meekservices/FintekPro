import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Package, Search, Loader2, Plus, Edit, Trash2, ArrowLeft, 
  Shield, Sparkles, TrendingUp, Banknote, PieChart, AlertCircle, CheckCircle2, Lock
} from "lucide-react";
import { Link } from "wouter";

const mutualFundSchema = z.object({
  name: z.string().min(1, "Fund name is required"),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  planType: z.enum(["direct", "regular"]),
  amfiCode: z.string().optional(),
  isinCode: z.string().optional(),
  expenseRatio: z.string().optional(),
  trailCommission: z.string().optional(),
  minInvestment: z.string().optional(),
  exitLoad: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high", "very_high"]).optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  fundHouse: z.string().optional(),
  nav: z.string().optional(),
  aum: z.string().optional(),
  returns1y: z.string().optional(),
  returns3y: z.string().optional(),
  returns5y: z.string().optional(),
});

type MutualFundFormData = z.infer<typeof mutualFundSchema>;

interface MutualFund {
  id: string;
  name: string;
  shortDescription?: string;
  description?: string;
  planType: 'direct' | 'regular';
  amfiCode?: string;
  isinCode?: string;
  expenseRatio?: string;
  trailCommission?: string;
  minInvestment?: string;
  exitLoad?: string;
  riskLevel?: string;
  category?: string;
  subcategory?: string;
  fundHouse?: string;
  nav?: string;
  aum?: string;
  returns1y?: string;
  returns3y?: string;
  returns5y?: string;
  isActive: boolean;
  createdAt?: string;
}

interface Category {
  id: string;
  name: string;
  slug?: string;
  isEnabled?: boolean;
  comingSoonMessage?: string;
}

export default function MutualFundsSeeding() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("funds");
  const [searchQuery, setSearchQuery] = useState("");
  const [planTypeFilter, setPlanTypeFilter] = useState<"all" | "direct" | "regular">("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFund, setEditingFund] = useState<MutualFund | null>(null);
  const [deleteDialogFund, setDeleteDialogFund] = useState<MutualFund | null>(null);

  const form = useForm<MutualFundFormData>({
    resolver: zodResolver(mutualFundSchema),
    defaultValues: {
      name: "",
      planType: "regular",
      shortDescription: "",
      description: "",
      amfiCode: "",
      isinCode: "",
      expenseRatio: "",
      trailCommission: "",
      minInvestment: "",
      exitLoad: "",
      riskLevel: "medium",
      category: "",
      subcategory: "",
      fundHouse: "",
      nav: "",
      aum: "",
      returns1y: "",
      returns3y: "",
      returns5y: "",
    },
  });

  const { data: fundsData, isLoading: isLoadingFunds } = useQuery<{ funds: MutualFund[] }>({
    queryKey: ['/api/admin/mutual-funds'],
  });

  const { data: categoriesData } = useQuery<{ categories: Category[] }>({
    queryKey: ['/api/admin/mutual-funds/categories'],
  });

  const funds: MutualFund[] = fundsData?.funds || [];
  const categories: Category[] = categoriesData?.categories || [];

  const filteredFunds = funds.filter(fund => {
    const matchesSearch = fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.amfiCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.isinCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.fundHouse?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlanType = planTypeFilter === "all" || fund.planType === planTypeFilter;
    return matchesSearch && matchesPlanType;
  });

  const directFundsCount = funds.filter(f => f.planType === "direct").length;
  const regularFundsCount = funds.filter(f => f.planType === "regular").length;

  const createFundMutation = useMutation({
    mutationFn: (data: MutualFundFormData) =>
      apiRequest('/api/admin/mutual-funds', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mutual-funds'] });
      toast({ title: "Fund Created", description: "Mutual fund has been added successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create fund", variant: "destructive" });
    },
  });

  const updateFundMutation = useMutation({
    mutationFn: (data: MutualFundFormData & { id: string }) =>
      apiRequest(`/api/admin/mutual-funds/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mutual-funds'] });
      toast({ title: "Fund Updated", description: "Mutual fund has been updated successfully" });
      setEditingFund(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update fund", variant: "destructive" });
    },
  });

  const deleteFundMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/mutual-funds/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mutual-funds'] });
      toast({ title: "Fund Deleted", description: "Mutual fund has been removed" });
      setDeleteDialogFund(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete fund", variant: "destructive" });
    },
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isEnabled, comingSoonMessage }: { id: string; isEnabled: boolean; comingSoonMessage?: string }) =>
      apiRequest(`/api/admin/mutual-funds/categories/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ isEnabled, comingSoonMessage }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mutual-funds/categories'] });
      toast({ title: "Category Updated", description: "Category visibility has been updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update category", variant: "destructive" });
    },
  });

  const onSubmit = (data: MutualFundFormData) => {
    if (editingFund) {
      updateFundMutation.mutate({ ...data, id: editingFund.id });
    } else {
      createFundMutation.mutate(data);
    }
  };

  const openEditDialog = (fund: MutualFund) => {
    setEditingFund(fund);
    form.reset({
      name: fund.name,
      planType: fund.planType,
      shortDescription: fund.shortDescription || "",
      description: fund.description || "",
      amfiCode: fund.amfiCode || "",
      isinCode: fund.isinCode || "",
      expenseRatio: fund.expenseRatio || "",
      trailCommission: fund.trailCommission || "",
      minInvestment: fund.minInvestment || "",
      exitLoad: fund.exitLoad || "",
      riskLevel: (fund.riskLevel as any) || "medium",
      category: fund.category || "",
      subcategory: fund.subcategory || "",
      fundHouse: fund.fundHouse || "",
      nav: fund.nav || "",
      aum: fund.aum || "",
      returns1y: fund.returns1y || "",
      returns3y: fund.returns3y || "",
      returns5y: fund.returns5y || "",
    });
  };

  const getRiskBadge = (risk?: string) => {
    const colors: Record<string, string> = {
      low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      very_high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    };
    return colors[risk || "medium"] || colors.medium;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="link-back-admin">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mutual Funds Seeding</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage mutual fund products with Direct and Regular plan variants</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-funds">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{funds.length}</div>
            </CardContent>
          </Card>
          <Card data-testid="card-direct-funds">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Direct Funds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{directFundsCount}</div>
              <p className="text-xs text-gray-500">Advisory subscribers only</p>
            </CardContent>
          </Card>
          <Card data-testid="card-regular-funds">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Regular Funds
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{regularFundsCount}</div>
              <p className="text-xs text-gray-500">Available to all clients</p>
            </CardContent>
          </Card>
          <Card data-testid="card-categories">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Active Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.filter(c => c.isEnabled !== false).length}</div>
            </CardContent>
          </Card>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Access Control:</strong> Direct funds are only visible to clients with an active Advisory Subscription. 
            Regular funds are visible to all clients. Categories can be toggled on/off to show a "Coming Soon" page.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="funds" data-testid="tab-funds">
              <Package className="h-4 w-4 mr-2" />
              Mutual Funds
            </TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <PieChart className="h-4 w-4 mr-2" />
              Category Controls
            </TabsTrigger>
          </TabsList>

          <TabsContent value="funds" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Fund Catalog</CardTitle>
                    <CardDescription>Manage Direct and Regular plan mutual fund products</CardDescription>
                  </div>
                  <Dialog open={isAddDialogOpen || !!editingFund} onOpenChange={(open) => {
                    if (!open) {
                      setIsAddDialogOpen(false);
                      setEditingFund(null);
                      form.reset();
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-fund">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Fund
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingFund ? "Edit Mutual Fund" : "Add New Mutual Fund"}</DialogTitle>
                        <DialogDescription>
                          {editingFund ? "Update fund details" : "Add a new mutual fund product to the catalog"}
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem className="col-span-2">
                                  <FormLabel>Fund Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="HDFC Mid-Cap Opportunities Fund" {...field} data-testid="input-fund-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="planType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Plan Type *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-plan-type">
                                        <SelectValue placeholder="Select plan type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="direct">
                                        <div className="flex items-center gap-2">
                                          <Lock className="h-4 w-4 text-blue-600" />
                                          Direct (Advisory Only)
                                        </div>
                                      </SelectItem>
                                      <SelectItem value="regular">
                                        <div className="flex items-center gap-2">
                                          <Sparkles className="h-4 w-4 text-green-600" />
                                          Regular (All Clients)
                                        </div>
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    {field.value === "direct" 
                                      ? "Only visible to Advisory subscribers" 
                                      : "Visible to all clients"}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="fundHouse"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Fund House</FormLabel>
                                  <FormControl>
                                    <Input placeholder="HDFC AMC" {...field} data-testid="input-fund-house" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="amfiCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>AMFI Code</FormLabel>
                                  <FormControl>
                                    <Input placeholder="112345" {...field} data-testid="input-amfi-code" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="isinCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>ISIN Code</FormLabel>
                                  <FormControl>
                                    <Input placeholder="INF179K01LZ8" {...field} data-testid="input-isin-code" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="nav"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>NAV (₹)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="125.50" {...field} data-testid="input-nav" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="aum"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>AUM (Cr)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="25000" {...field} data-testid="input-aum" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="expenseRatio"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Expense Ratio (%)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0.85" {...field} data-testid="input-expense-ratio" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="trailCommission"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Trail Commission (%)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="0.50" {...field} data-testid="input-trail-commission" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="minInvestment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Min Investment (₹)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="5000" {...field} data-testid="input-min-investment" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="exitLoad"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Exit Load</FormLabel>
                                  <FormControl>
                                    <Input placeholder="1% if redeemed within 1 year" {...field} data-testid="input-exit-load" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="riskLevel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Risk Level</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-risk-level">
                                        <SelectValue placeholder="Select risk level" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="very_high">Very High</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Equity" {...field} data-testid="input-category" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="subcategory"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Subcategory</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Mid Cap" {...field} data-testid="input-subcategory" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="returns1y"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>1Y Returns (%)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="18.5" {...field} data-testid="input-returns-1y" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="returns3y"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>3Y Returns (%)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="22.3" {...field} data-testid="input-returns-3y" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="returns5y"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>5Y Returns (%)</FormLabel>
                                  <FormControl>
                                    <Input placeholder="16.8" {...field} data-testid="input-returns-5y" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="shortDescription"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Short Description</FormLabel>
                                <FormControl>
                                  <Input placeholder="Brief fund description..." {...field} data-testid="input-short-description" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Description</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Detailed fund description with investment objective, strategy, etc." 
                                    {...field} 
                                    rows={4}
                                    data-testid="input-description" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setIsAddDialogOpen(false);
                                setEditingFund(null);
                                form.reset();
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createFundMutation.isPending || updateFundMutation.isPending}
                              data-testid="button-submit-fund"
                            >
                              {(createFundMutation.isPending || updateFundMutation.isPending) && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              {editingFund ? "Update Fund" : "Add Fund"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, AMFI code, ISIN, or fund house..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-funds"
                    />
                  </div>
                  <Select value={planTypeFilter} onValueChange={(value: any) => setPlanTypeFilter(value)}>
                    <SelectTrigger className="w-48" data-testid="select-plan-filter">
                      <SelectValue placeholder="Filter by plan type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="direct">Direct Only</SelectItem>
                      <SelectItem value="regular">Regular Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoadingFunds ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredFunds.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No mutual funds found</p>
                    <Button 
                      onClick={() => setIsAddDialogOpen(true)} 
                      className="mt-4"
                      data-testid="button-add-first-fund"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Fund
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fund Name</TableHead>
                          <TableHead>Plan Type</TableHead>
                          <TableHead>Fund House</TableHead>
                          <TableHead>NAV</TableHead>
                          <TableHead>Expense Ratio</TableHead>
                          <TableHead>Risk</TableHead>
                          <TableHead>1Y Returns</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFunds.map((fund) => (
                          <TableRow key={fund.id} data-testid={`row-fund-${fund.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{fund.name}</p>
                                {fund.amfiCode && (
                                  <p className="text-xs text-gray-500">AMFI: {fund.amfiCode}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={fund.planType === "direct" ? "default" : "secondary"}
                                className={fund.planType === "direct" 
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" 
                                  : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"}
                              >
                                {fund.planType === "direct" ? (
                                  <><Lock className="h-3 w-3 mr-1" />Direct</>
                                ) : (
                                  <><Sparkles className="h-3 w-3 mr-1" />Regular</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>{fund.fundHouse || "-"}</TableCell>
                            <TableCell>₹{fund.nav || "-"}</TableCell>
                            <TableCell>{fund.expenseRatio ? `${fund.expenseRatio}%` : "-"}</TableCell>
                            <TableCell>
                              {fund.riskLevel && (
                                <Badge className={getRiskBadge(fund.riskLevel)}>
                                  {fund.riskLevel.replace("_", " ")}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {fund.returns1y && (
                                <span className={Number(fund.returns1y) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {Number(fund.returns1y) >= 0 ? "+" : ""}{fund.returns1y}%
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(fund)}
                                  data-testid={`button-edit-fund-${fund.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteDialogFund(fund)}
                                  className="text-red-600 hover:text-red-700"
                                  data-testid={`button-delete-fund-${fund.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Category Controls</CardTitle>
                <CardDescription>
                  Toggle categories on/off. Disabled categories show a "Coming Soon" page to clients.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categories.length === 0 ? (
                  <div className="text-center py-12">
                    <PieChart className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No categories found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categories.map((category) => (
                      <Card key={category.id} data-testid={`card-category-${category.id}`}>
                        <CardContent className="flex items-center justify-between py-4">
                          <div className="flex items-center gap-4">
                            <Switch
                              checked={category.isEnabled !== false}
                              onCheckedChange={(checked) => 
                                toggleCategoryMutation.mutate({ id: category.id, isEnabled: checked })
                              }
                              data-testid={`switch-category-${category.id}`}
                            />
                            <div>
                              <p className="font-medium">{category.name}</p>
                              {category.isEnabled === false && (
                                <p className="text-sm text-gray-500">
                                  {category.comingSoonMessage || "Coming Soon"}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={category.isEnabled !== false ? "default" : "secondary"}>
                            {category.isEnabled !== false ? (
                              <><CheckCircle2 className="h-3 w-3 mr-1" />Active</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 mr-1" />Coming Soon</>
                            )}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!deleteDialogFund} onOpenChange={() => setDeleteDialogFund(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Fund</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteDialogFund?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogFund(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteDialogFund && deleteFundMutation.mutate(deleteDialogFund.id)}
                disabled={deleteFundMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteFundMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
