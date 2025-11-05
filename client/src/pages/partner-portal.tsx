import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';

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

export default function PartnerPortal() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const queryClient = useQueryClient();

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
      draft: 'bg-gray-100 text-gray-800',
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
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.open;
  };

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="partner-portal-title">
                Partner Portal
              </h1>
              <p className="text-sm text-gray-600">
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
          <ScrollableTabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
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
                        <p className="text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-2xl font-bold text-gray-900">
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
                        <p className="text-sm font-medium text-gray-600">Support Tickets</p>
                        <p className="text-2xl font-bold text-gray-900">
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
                        <p className="text-sm font-medium text-gray-600">Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">
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
                        <p className="text-sm font-medium text-gray-600">Commission</p>
                        <p className="text-2xl font-bold text-gray-900">
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
                        <p className="text-sm text-gray-600">{product.category}</p>
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
                        <p className="text-sm text-gray-600">{ticket.clientName}</p>
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
              <h2 className="text-xl font-bold text-gray-900">Product Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-product">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
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
                          <p className="text-sm text-gray-600">{product.category} • {product.subCategory}</p>
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
                      <p className="text-gray-700 mb-4">{product.description}</p>
                      
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
                        <div className="text-sm text-gray-600">
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

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Client Support</h2>
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
                          <p className="text-sm text-gray-600">
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
                      <p className="text-gray-700 mb-4">{ticket.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
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
            <h2 className="text-xl font-bold text-gray-900">Analytics & Insights</h2>
            
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
                          <p className="text-sm text-gray-600">{product.category}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center text-green-600">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            <span className="text-sm">+15%</span>
                          </div>
                          <p className="text-xs text-gray-500">vs last month</p>
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
                      <span className="text-sm text-gray-600">Average Response Time</span>
                      <span className="font-medium">2.3 hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Resolution Rate</span>
                      <span className="font-medium">89%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Customer Satisfaction</span>
                      <span className="font-medium">4.6/5</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Tickets</span>
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
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
    </div>
  );
}