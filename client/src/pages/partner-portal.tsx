import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Package, 
  MessageCircle, 
  BarChart3, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  TrendingUp, 
  Users,
  IndianRupee,
  Target,
  Clock,
  UserPlus,
  Link2,
  Copy,
  Mail,
  Phone,
  Send,
  RefreshCw,
  CheckCircle2,
  FileText,
  Building2,
  User
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Mock authentication for demo
const PARTNER_AUTH = btoa('partner@fintech.com:partner123');

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  subCategory: z.string().optional(),
  basePrice: z.string().optional(),
  interestRate: z.string().optional(),
  features: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
  documents: z.string().optional(),
  status: z.string().default('draft'),
  isPublic: z.boolean().default(false),
  priority: z.number().default(0),
  tags: z.string().optional(),
  imageUrl: z.string().optional()
});

type ProductFormData = z.infer<typeof productSchema>;

const ticketMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  messageType: z.string().default('text'),
  isInternal: z.boolean().default(false)
});

type TicketMessageFormData = z.infer<typeof ticketMessageSchema>;

interface OnboardingInvitation {
  id: string;
  referralCode: string;
  inviterId: string;
  inviterType: string;
  inviterName: string | null;
  clientEmail: string | null;
  clientMobile: string | null;
  clientName: string | null;
  suggestedEntityType: string | null;
  suggestedMode: string | null;
  status: string;
  currentStep: string | null;
  completedSteps: string[];
  progressPercentage: number;
  createdAt: string;
  expiresAt: string | null;
}

const INVITATION_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  opened: "bg-yellow-100 text-yellow-700",
  started: "bg-indigo-100 text-indigo-700",
  in_progress: "bg-cyan-100 text-cyan-700",
  completed: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
};

const ENTITY_TYPE_OPTIONS = [
  { value: "individual", label: "Individual", icon: User },
  { value: "company", label: "Company", icon: Building2 },
  { value: "huf", label: "HUF", icon: Users },
  { value: "firm", label: "Firm/LLP", icon: Building2 },
  { value: "trust", label: "Trust/AOP", icon: Building2 },
];

export default function PartnerPortal() {
  const [location] = useLocation();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  // Read tab from URL query params
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'dashboard';
    }
    return 'dashboard';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Sync tab with URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [location]);
  
  // Invitation state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteClientName, setInviteClientName] = useState("");
  const [inviteClientEmail, setInviteClientEmail] = useState("");
  const [inviteClientMobile, setInviteClientMobile] = useState("");
  const [inviteEntityType, setInviteEntityType] = useState("");
  const [inviteMode, setInviteMode] = useState("smart");
  const [inviteNotes, setInviteNotes] = useState("");
  const [generatedReferralLink, setGeneratedReferralLink] = useState("");

  // Partner Dashboard Data
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['/api/partner/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/partner/dashboard', {
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    }
  });

  // Products Data
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/partner/products'],
    queryFn: async () => {
      const response = await fetch('/api/partner/products', {
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    }
  });

  // Support Tickets Data
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/partner/support/tickets'],
    queryFn: async () => {
      const response = await fetch('/api/partner/support/tickets', {
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    }
  });

  // Partner Invitations Data
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery<{ invitations: OnboardingInvitation[], total: number }>({
    queryKey: ['/api/partner/onboarding-invitations'],
    queryFn: async () => {
      const response = await fetch('/api/partner/onboarding-invitations', {
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch invitations');
      return response.json();
    }
  });

  const { data: invitationStats } = useQuery<{ stats: Record<string, number> }>({
    queryKey: ['/api/partner/onboarding-invitations/stats'],
    queryFn: async () => {
      const response = await fetch('/api/partner/onboarding-invitations/stats', {
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  const createInvitation = useMutation({
    mutationFn: async (data: { 
      clientName: string; 
      clientEmail?: string; 
      clientMobile?: string; 
      suggestedEntityType?: string; 
      suggestedMode?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/partner/onboarding-invitations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Basic ${PARTNER_AUTH}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create invitation');
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Invitation Created", description: "Client invitation has been generated" });
      setGeneratedReferralLink(data.referralLink || `${window.location.origin}/onboarding?ref=${data.invitation.referralCode}`);
      queryClient.invalidateQueries({ queryKey: ['/api/partner/onboarding-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/onboarding-invitations/stats'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create invitation", 
        variant: "destructive" 
      });
    }
  });

  const resendInvitation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/partner/onboarding-invitations/${id}/resend`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to resend');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation Resent", description: "The invitation has been resent" });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/onboarding-invitations'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to resend invitation", 
        variant: "destructive" 
      });
    }
  });

  // Product mutations
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const response = await fetch('/api/partner/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${PARTNER_AUTH}`
        },
        body: JSON.stringify({
          ...data,
          features: data.features ? JSON.parse(data.features) : {},
          eligibilityCriteria: data.eligibilityCriteria ? JSON.parse(data.eligibilityCriteria) : {},
          documents: data.documents ? data.documents.split(',').map(d => d.trim()) : [],
          tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
          basePrice: data.basePrice ? parseFloat(data.basePrice) : null,
          interestRate: data.interestRate ? parseFloat(data.interestRate) : null
        })
      });
      if (!response.ok) throw new Error('Failed to create product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/dashboard'] });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProductFormData }) => {
      const response = await fetch(`/api/partner/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${PARTNER_AUTH}`
        },
        body: JSON.stringify({
          ...data,
          features: data.features ? JSON.parse(data.features) : {},
          eligibilityCriteria: data.eligibilityCriteria ? JSON.parse(data.eligibilityCriteria) : {},
          documents: data.documents ? data.documents.split(',').map(d => d.trim()) : [],
          tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
          basePrice: data.basePrice ? parseFloat(data.basePrice) : null,
          interestRate: data.interestRate ? parseFloat(data.interestRate) : null
        })
      });
      if (!response.ok) throw new Error('Failed to update product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/products'] });
      setSelectedProduct(null);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/partner/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${PARTNER_AUTH}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partner/dashboard'] });
    }
  });

  // Support ticket mutations
  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, status, resolution }: { id: string; status: string; resolution?: string }) => {
      const response = await fetch(`/api/partner/support/tickets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${PARTNER_AUTH}`
        },
        body: JSON.stringify({ status, resolution })
      });
      if (!response.ok) throw new Error('Failed to update ticket');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/support/tickets'] });
    }
  });

  const addMessageMutation = useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: TicketMessageFormData }) => {
      const response = await fetch(`/api/partner/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${PARTNER_AUTH}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to add message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner/support/tickets'] });
    }
  });

  // Forms
  const productForm = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
      subCategory: '',
      status: 'draft',
      isPublic: false,
      priority: 0
    }
  });

  const messageForm = useForm<TicketMessageFormData>({
    resolver: zodResolver(ticketMessageSchema),
    defaultValues: {
      message: '',
      messageType: 'text',
      isInternal: false
    }
  });

  // Event handlers
  const handleCreateProduct = (data: ProductFormData) => {
    createProductMutation.mutate(data);
    productForm.reset();
  };

  const handleUpdateProduct = (data: ProductFormData) => {
    if (selectedProduct) {
      updateProductMutation.mutate({ id: selectedProduct.id, data });
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleUpdateTicketStatus = (ticketId: string, status: string, resolution?: string) => {
    updateTicketMutation.mutate({ id: ticketId, status, resolution });
  };

  const handleAddMessage = (data: TicketMessageFormData) => {
    if (selectedTicket) {
      addMessageMutation.mutate({ ticketId: selectedTicket.id, data });
      messageForm.reset();
    }
  };

  const openEditProduct = (product: any) => {
    setSelectedProduct(product);
    productForm.reset({
      name: product.name,
      description: product.description || '',
      category: product.category,
      subCategory: product.subCategory || '',
      basePrice: product.basePrice?.toString() || '',
      interestRate: product.interestRate?.toString() || '',
      features: JSON.stringify(product.features || {}),
      eligibilityCriteria: JSON.stringify(product.eligibilityCriteria || {}),
      documents: Array.isArray(product.documents) ? product.documents.join(', ') : '',
      status: product.status,
      isPublic: product.isPublic,
      priority: product.priority,
      tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
      imageUrl: product.imageUrl || ''
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-muted text-foreground',
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-yellow-100 text-yellow-800',
      discontinued: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || colors.draft;
  };

  const getTicketStatusColor = (status: string) => {
    const colors = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-orange-100 text-orange-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-muted text-foreground'
    };
    return colors[status as keyof typeof colors] || colors.open;
  };

  const handleCreateInvitation = () => {
    if (!inviteClientEmail && !inviteClientMobile) {
      toast({
        title: "Error",
        description: "Please provide either email or mobile number",
        variant: "destructive"
      });
      return;
    }

    createInvitation.mutate({
      clientName: inviteClientName,
      clientEmail: inviteClientEmail || undefined,
      clientMobile: inviteClientMobile || undefined,
      suggestedEntityType: inviteEntityType || undefined,
      suggestedMode: inviteMode,
      notes: inviteNotes || undefined,
    });
  };

  const handleCopyReferralLink = () => {
    navigator.clipboard.writeText(generatedReferralLink);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  const resetInviteForm = () => {
    setInviteClientName("");
    setInviteClientEmail("");
    setInviteClientMobile("");
    setInviteEntityType("");
    setInviteMode("smart");
    setInviteNotes("");
    setGeneratedReferralLink("");
  };

  const invitations = invitationsData?.invitations || [];

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  if (dashboardLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading partner portal...</div>;
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="partner-portal-title">
                Partner Portal
              </h1>
              <p className="text-sm text-muted-foreground">
                {dashboardData?.partner?.companyName} • {dashboardData?.partner?.partnerType}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="bg-green-50 text-green-700">
                Active Partner
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
            <TabsTrigger value="referrals" data-testid="tab-referrals">Referrals</TabsTrigger>
            <TabsTrigger value="support" data-testid="tab-support">Support</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </ScrollableTabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {dashboardData?.stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card data-testid="dashboard-products-card">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Package className="h-8 w-8 text-blue-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                        <p className="text-2xl font-bold text-foreground">
                          {dashboardData.stats.totalProducts}
                        </p>
                        <p className="text-xs text-green-600">
                          {dashboardData.stats.activeProducts} active
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="dashboard-tickets-card">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <MessageCircle className="h-8 w-8 text-orange-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Support Tickets</p>
                        <p className="text-2xl font-bold text-foreground">
                          {dashboardData.stats.totalTickets}
                        </p>
                        <p className="text-xs text-orange-600">
                          {dashboardData.stats.openTickets} open
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="dashboard-revenue-card">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <IndianRupee className="h-8 w-8 text-green-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                        <p className="text-2xl font-bold text-foreground">
                          ₹{dashboardData.stats.revenue.toLocaleString()}
                        </p>
                        <p className="text-xs text-green-600">
                          +12% from last month
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="dashboard-commission-card">
                  <CardContent className="p-6">
                    <div className="flex items-center">
                      <Target className="h-8 w-8 text-purple-600" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-muted-foreground">Commission</p>
                        <p className="text-2xl font-bold text-foreground">
                          ₹{dashboardData.stats.commission.toLocaleString()}
                        </p>
                        <p className="text-xs text-purple-600">
                          2.5% rate
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Products</CardTitle>
                </CardHeader>
                <CardContent>
                  {products.slice(0, 5).map((product: any) => (
                    <div key={product.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.category}</p>
                      </div>
                      <Badge className={getStatusColor(product.status)}>
                        {product.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Support Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  {tickets.slice(0, 5).map((ticket: any) => (
                    <div key={ticket.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground">{ticket.clientName}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <Badge className={getTicketStatusColor(ticket.status)}>
                          {ticket.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Product Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-product">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Product</DialogTitle>
                  </DialogHeader>
                  <Form {...productForm}>
                    <form onSubmit={productForm.handleSubmit(handleCreateProduct)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={productForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-product-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={productForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-product-category">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                                  <SelectItem value="insurance">Insurance</SelectItem>
                                  <SelectItem value="loan">Loan</SelectItem>
                                  <SelectItem value="credit_card">Credit Card</SelectItem>
                                  <SelectItem value="deposit">Deposit</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={productForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} data-testid="textarea-product-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={productForm.control}
                          name="subCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sub Category</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-product-subcategory" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={productForm.control}
                          name="interestRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Interest Rate (%)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" data-testid="input-product-interest-rate" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={productForm.control}
                        name="features"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Features (JSON)</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                placeholder='{"expenseRatio": 1.2, "minInvestment": 500}'
                                data-testid="textarea-product-features"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={productForm.control}
                        name="tags"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags (comma-separated)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="equity, growth, sip" data-testid="input-product-tags" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={productForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-product-status">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="draft">Draft</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
                                  <SelectItem value="discontinued">Discontinued</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={productForm.control}
                          name="priority"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Priority</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  value={field.value?.toString() || '0'}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  data-testid="input-product-priority"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={productForm.control}
                          name="isPublic"
                          render={({ field }) => (
                            <FormItem className="flex flex-col justify-end">
                              <div className="flex items-center space-x-2 h-10">
                                <input
                                  type="checkbox"
                                  checked={field.value}
                                  onChange={(e) => field.onChange(e.target.checked)}
                                  data-testid="checkbox-product-public"
                                />
                                <FormLabel className="text-sm">Public</FormLabel>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button type="submit" data-testid="button-create-product">
                          Create Product
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-6">
              {productsLoading ? (
                <div>Loading products...</div>
              ) : (
                products.map((product: any) => (
                  <Card key={product.id} data-testid={`product-card-${product.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{product.category} • {product.subCategory}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(product.status)}>
                            {product.status}
                          </Badge>
                          {product.isPublic && (
                            <Badge variant="outline">Public</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{product.description}</p>
                      
                      {product.tags && product.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {product.tags.map((tag: string, index: number) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Priority: {product.priority} | Created: {new Date(product.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditProduct(product)}
                            data-testid={`button-edit-product-${product.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Referrals Tab - Partner Monitoring View */}
          <TabsContent value="referrals" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Client Invitations</h2>
                <p className="text-sm text-muted-foreground">Invite clients and track onboarding progress</p>
              </div>
              <Button 
                onClick={() => { resetInviteForm(); setShowInviteDialog(true); }}
                data-testid="button-invite-client"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite New Client
              </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{invitationStats?.stats?.total || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Invitations</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-yellow-600">{invitationStats?.stats?.pending || 0}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-blue-600">{invitationStats?.stats?.in_progress || 0}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-bold text-green-600">{invitationStats?.stats?.completed || 0}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
            </div>

            {/* Invitations Table */}
            {invitationsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UserPlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No Invitations Yet</h3>
                  <p className="text-muted-foreground mb-4">Start inviting clients to track their onboarding progress</p>
                  <Button onClick={() => { resetInviteForm(); setShowInviteDialog(true); }}>
                    Create First Invitation
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id} data-testid={`row-invitation-${inv.id}`}>
                        <TableCell className="font-medium">
                          {inv.clientName || "—"}
                          {inv.suggestedEntityType && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {inv.suggestedEntityType}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {inv.clientEmail && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{inv.clientEmail}</div>}
                            {inv.clientMobile && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{inv.clientMobile}</div>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={INVITATION_STATUS_COLORS[inv.status] || ""}>
                            {(inv.status || 'pending').replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <Progress value={inv.progressPercentage} className="h-2" />
                            <span className="text-xs text-muted-foreground">{inv.progressPercentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = `${window.location.origin}/onboarding?ref=${inv.referralCode}`;
                                navigator.clipboard.writeText(link);
                                toast({ title: "Copied!", description: "Link copied to clipboard" });
                              }}
                              data-testid={`button-copy-${inv.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {(inv.status === "pending" || inv.status === "expired") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resendInvitation.mutate(inv.id)}
                                disabled={resendInvitation.isPending}
                                data-testid={`button-resend-${inv.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 ${resendInvitation.isPending ? "animate-spin" : ""}`} />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">Client Support</h2>
                <p className="text-sm text-muted-foreground">Manage client support requests with step-by-step workflows</p>
              </div>
              <a href="/partner/ca-support">
                <Button className="gap-2" data-testid="button-open-ca-dashboard">
                  <MessageCircle className="h-4 w-4" />
                  Open CA Support Dashboard
                </Button>
              </a>
            </div>

            <div className="grid gap-6">
              {ticketsLoading ? (
                <div>Loading support tickets...</div>
              ) : (
                tickets.map((ticket: any) => (
                  <Card key={ticket.id} data-testid={`ticket-card-${ticket.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {ticket.ticketNumber} • {ticket.clientName} • {ticket.clientEmail}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                          <Badge className={getTicketStatusColor(ticket.status)}>
                            {ticket.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{ticket.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          {ticket.category} • Created: {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          {ticket.status === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'in_progress')}
                              data-testid={`button-start-ticket-${ticket.id}`}
                            >
                              Start Work
                            </Button>
                          )}
                          {ticket.status === 'in_progress' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateTicketStatus(ticket.id, 'resolved', 'Issue resolved by partner')}
                              data-testid={`button-resolve-ticket-${ticket.id}`}
                            >
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Analytics & Insights</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Product Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {products.slice(0, 3).map((product: any) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center text-green-600">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            <span className="text-sm">+15%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">vs last month</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Support Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Average Response Time</span>
                      <span className="font-medium">2.3 hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Resolution Rate</span>
                      <span className="font-medium">89%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Customer Satisfaction</span>
                      <span className="font-medium">4.6/5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Tickets</span>
                      <span className="font-medium">{tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Product Dialog */}
      {selectedProduct && (
        <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Product: {selectedProduct.name}</DialogTitle>
            </DialogHeader>
            <Form {...productForm}>
              <form onSubmit={productForm.handleSubmit(handleUpdateProduct)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={productForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={productForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="loan">Loan</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="deposit">Deposit</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={productForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={productForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="discontinued">Discontinued</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={productForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="number" 
                            value={field.value?.toString() || '0'}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={productForm.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex flex-col justify-end">
                        <div className="flex items-center space-x-2 h-10">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                          <FormLabel className="text-sm">Public</FormLabel>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setSelectedProduct(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Update Product
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Invite Client Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => { if (!open) resetInviteForm(); setShowInviteDialog(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              Invite Client for Onboarding
            </DialogTitle>
          </DialogHeader>

          {!generatedReferralLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Client Name</label>
                <Input
                  placeholder="Enter client's full name"
                  value={inviteClientName}
                  onChange={(e) => setInviteClientName(e.target.value)}
                  data-testid="input-invite-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={inviteClientEmail}
                    onChange={(e) => setInviteClientEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile</label>
                  <Input
                    placeholder="+91 9999999999"
                    value={inviteClientMobile}
                    onChange={(e) => setInviteClientMobile(e.target.value)}
                    data-testid="input-invite-mobile"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Entity Type (Optional)</label>
                <Select value={inviteEntityType} onValueChange={setInviteEntityType}>
                  <SelectTrigger data-testid="select-entity-type">
                    <SelectValue placeholder="Select entity type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Onboarding Mode</label>
                <Select value={inviteMode} onValueChange={setInviteMode}>
                  <SelectTrigger data-testid="select-onboarding-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Smart Mode (Recommended)
                      </div>
                    </SelectItem>
                    <SelectItem value="manual">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Manual Mode
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Internal)</label>
                <Textarea
                  placeholder="Add any internal notes about this client..."
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  rows={2}
                  data-testid="textarea-invite-notes"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateInvitation}
                  disabled={createInvitation.isPending || (!inviteClientEmail && !inviteClientMobile)}
                  data-testid="button-create-invitation"
                >
                  {createInvitation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Invitation Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Invitation Created!</AlertTitle>
                <AlertDescription className="text-green-700">
                  Share this link with {inviteClientName || "your client"} to start their onboarding.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label className="text-sm font-medium">Referral Link</label>
                <div className="flex gap-2">
                  <Input
                    value={generatedReferralLink}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-referral-link"
                  />
                  <Button onClick={handleCopyReferralLink} data-testid="button-copy-link">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    window.open(`mailto:${inviteClientEmail}?subject=Complete Your FintekPro Onboarding&body=Dear ${inviteClientName || "Client"},%0D%0A%0D%0APlease complete your onboarding by clicking the link below:%0D%0A${generatedReferralLink}%0D%0A%0D%0ABest regards`);
                  }}
                  disabled={!inviteClientEmail}
                  data-testid="button-send-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email Client
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    window.open(`https://wa.me/${inviteClientMobile?.replace(/[^0-9]/g, '')}?text=Dear ${inviteClientName || "Client"},%0A%0APlease complete your FintekPro onboarding:%0A${encodeURIComponent(generatedReferralLink)}`);
                  }}
                  disabled={!inviteClientMobile}
                  data-testid="button-send-whatsapp"
                >
                  <Send className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => { resetInviteForm(); setShowInviteDialog(false); }}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}