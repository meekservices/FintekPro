import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/hooks/use-cart";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Trash2, 
  Minus, 
  Plus, 
  ShoppingCart, 
  ArrowLeft, 
  CreditCard,
  Bot,
  Users,
  User,
  Filter,
  Plus as PlusIcon,
  CheckCircle,
  Lightbulb,
  Clock,
  Zap,
  AlertTriangle,
  TrendingUp,
  Building2,
  Coins,
  FileText,
  Landmark,
  Package,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { UnifiedCartItem, ProductCategory } from "@shared/schema";
import { FeeBreakdownCard } from "@/components/FeeBreakdownCard";
import { useFeeBreakdown, useAggregatedFeeBreakdown, type CartItem as FeeCartItem } from "@/hooks/use-fee-breakdown";

interface InvestmentProposal {
  id: string;
  proposalSource: 'ai' | 'agent' | 'client' | 'hybrid';
  clientId: string;
  agentId?: string;
  title: string;
  description?: string;
  analysisRationale?: string;
  totalInvestmentAmount?: number;
  riskProfile?: string;
  timeHorizon?: string;
  expectedReturns?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'in_cart' | 'completed';
  createdAt: string;
  updatedAt: string;
  validUntil?: string;
}

interface BondOrder {
  id: string;
  userId: string;
  bondType: string;
  bondId: string;
  isin: string;
  bondName: string;
  orderType: string;
  quantity: number;
  orderPrice: string;
  totalAmount: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentReference?: string;
  settlementStatus?: string;
  settlementDate?: string;
  dematAccount?: string;
  exchange?: string;
  rejectionReason?: string;
  notes?: string;
  complianceChecked?: boolean;
  suitabilityPassed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Cart() {
  const { cart: _cart, isLoading, updateCartItem, removeFromCart, clearCart, isUpdatingCartItem, isRemovingFromCart } = useCart();
  const cart = _cart as any;
  const { 
    items: unifiedCartItems, 
    isLoading: unifiedCartLoading, 
    removeItem: removeUnifiedItem,
    approveItem: approveUnifiedItem,
    checkout: checkoutUnifiedItems,
    isRemovingItem: isRemovingUnifiedItem,
    isCheckingOut: isCheckingOutUnified
  } = useUnifiedCart();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [updatingItems, setUpdatingItems] = useState<Record<string, boolean>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cashfree" | "phonepe">("cashfree");
  
  // Proposals tab state
  const [selectedProposalTab, setSelectedProposalTab] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  // Form state for creating proposals
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    analysisRationale: '',
    totalInvestmentAmount: '',
    riskProfile: 'moderate',
    timeHorizon: '',
    expectedReturns: '',
    priority: 'medium'
  });

  // Fetch fee breakdown for cart summary
  const { feeBreakdown: cartFeeBreakdown, isLoading: cartFeesLoading, error: cartFeesError, refetch: refetchCartFees } = useFeeBreakdown({
    transactionAmount: cart?.totalValue || 0,
    productType: 'all',
    investorTier: 'retail',
    enabled: (cart?.totalValue || 0) > 0
  });
  
  // Determine if fee calculation is ready for checkout
  const feesReady = !cartFeesLoading && cartFeeBreakdown?.summary !== undefined;

  // Fetch fee breakdown for unified investments using aggregated calculation
  const unifiedTotalValue = unifiedCartItems.reduce((sum: any, item: any) => sum + Number(item.amount || 0) * (item.quantity || 1), 0);
  
  // Map product categories to fee calculator product types
  const categoryToProductType: Record<string, string> = {
    'mutual_funds': 'mutual_fund',
    'stocks': 'equity',
    'bonds': 'bond',
    'unlisted': 'unlisted',
    'ipo': 'ipo',
    'pms': 'pms',
    'aif': 'aif',
    'derivatives': 'derivatives',
    'loans': 'loan',
    'tax_services': 'tax_services',
  };
  
  // Build aggregated fee items from cart items with per-category amounts
  const aggregatedFeeItems: FeeCartItem[] = unifiedCartItems.reduce((acc: any, item: any) => {
    const productType = categoryToProductType[item.productCategory] || item.productCategory;
    const amount = Number(item.amount || 0) * (item.quantity || 1);
    
    // Find existing item with same product type
    const existing = acc.find(i => i.productType === productType);
    if (existing) {
      existing.amount += amount;
    } else {
      acc.push({ productType, amount });
    }
    return acc;
  }, [] as FeeCartItem[]);
  
  // Use aggregated fee breakdown for mixed-category baskets
  const { feeBreakdown: investmentFeeBreakdown, isLoading: investmentFeesLoading, error: investmentFeesError, refetch: refetchInvestmentFees } = useAggregatedFeeBreakdown({
    items: aggregatedFeeItems,
    investorTier: 'retail',
    enabled: unifiedTotalValue > 0 && aggregatedFeeItems.length > 0
  });
  
  // Determine if investment fees are ready for checkout
  const investmentFeesReady = !investmentFeesLoading && investmentFeeBreakdown?.summary !== undefined;

  // Parse URL to determine active tab and sync with URL changes
  const [activeTab, setActiveTab] = useState<string>(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    return urlParams.get('tab') || 'cart';
  });

  // Sync activeTab with URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tabFromUrl = urlParams.get('tab') || 'cart';
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location]);

  // Handle tab change and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/cart?tab=${value}`);
  };

  // Fetch investment proposals
  const { data: proposals, isLoading: proposalsLoading, error: proposalsError } = useQuery<InvestmentProposal[]>({
    queryKey: ['/api/proposals'],
    enabled: true,
    retry: 1
  });

  // Fetch pending bond orders
  const { data: bondOrdersData, isLoading: bondOrdersLoading } = useQuery<{ status: string; data: BondOrder[]; count: number }>({
    queryKey: ['/api/bonds/orders'],
    enabled: true,
    retry: 1
  });

  const pendingBondOrders = bondOrdersData?.data?.filter(
    (order) => order.orderStatus === 'pending' || order.paymentStatus === 'pending'
  ) || [];

  // Cart operations
  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    setUpdatingItems(prev => ({ ...prev, [itemId]: true }));
    updateCartItem({ itemId, quantity: newQuantity }, {
      onSuccess: () => {
        setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
      },
      onError: () => {
        setUpdatingItems(prev => ({ ...prev, [itemId]: false }));
        toast({
          title: "Error",
          description: "Failed to update quantity",
          variant: "destructive",
        });
      }
    });
  };

  const handleInvestmentAmountChange = async (itemId: string, newAmount: string) => {
    updateCartItem({ itemId, investmentAmount: newAmount }, {
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to update investment amount",
          variant: "destructive",
        });
      }
    });
  };

  const handleRemoveItem = (itemId: string) => {
    removeFromCart(itemId, {
      onSuccess: () => {
        toast({
          title: "Removed",
          description: "Item removed from cart",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to remove item",
          variant: "destructive",
        });
      }
    });
  };

  const handleClearCart = () => {
    clearCart(undefined, {
      onSuccess: () => {
        toast({
          title: "Cart Cleared",
          description: "All items removed from cart",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to clear cart",
          variant: "destructive",
        });
      }
    });
  };

  // Calculate total payable including fees
  const cartPayableTotal = (cart?.totalValue || 0) + (cartFeeBreakdown?.summary.grandTotal || 0);

  const checkoutMutation = useMutation({
    mutationFn: async (method: "cashfree" | "phonepe") => {
      const payableAmount = cartPayableTotal;
      const feeBreakdownData = cartFeeBreakdown ? {
        subtotal: cartFeeBreakdown.summary.subtotal,
        gst: cartFeeBreakdown.summary.totalGst,
        waivers: cartFeeBreakdown.summary.totalWaivers,
        grandTotal: cartFeeBreakdown.summary.grandTotal,
        fees: cartFeeBreakdown.fees.map((f: any) => ({
          code: f.feeCode,
          name: f.feeName,
          amount: f.netAmount
        }))
      } : null;

      if (method === "cashfree") {
        const response: any = await apiRequest("/api/payments/cashfree/create-order", {
          method: "POST",
          body: JSON.stringify({
            amount: payableAmount,
            baseAmount: cart?.totalValue || 0,
            feesAmount: cartFeeBreakdown?.summary.grandTotal || 0,
            feeBreakdown: feeBreakdownData
          })
        });
        return { ...response, method: "cashfree" };
      } else {
        const response: any = await apiRequest("/api/payments/phonepe/create-order", {
          method: "POST",
          body: JSON.stringify({
            amount: payableAmount,
            baseAmount: cart?.totalValue || 0,
            feesAmount: cartFeeBreakdown?.summary.grandTotal || 0,
            feeBreakdown: feeBreakdownData,
            cartId: cart?.cart?.id,
          })
        });
        return { ...response, method: "phonepe" };
      }
    },
    onSuccess: (data: any) => {
      if (data.method === "cashfree" && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.method === "phonepe" && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast({
          title: "Checkout Error",
          description: "Payment gateway redirect URL not received",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
    }
  });

  const handleCheckout = () => {
    if (!cart || cart.totalValue === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please add items to your cart",
        variant: "destructive",
      });
      return;
    }
    
    if (!feesReady) {
      toast({
        title: "Fee Calculation Pending",
        description: "Please wait while we calculate applicable fees",
        variant: "destructive",
      });
      refetchCartFees();
      return;
    }
    
    checkoutMutation.mutate(paymentMethod);
  };

  // Proposal operations
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/proposals', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        analysisRationale: '',
        totalInvestmentAmount: '',
        riskProfile: 'moderate',
        timeHorizon: '',
        expectedReturns: '',
        priority: 'medium'
      });
      toast({
        title: "Proposal Created",
        description: "Your investment proposal has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  const acceptProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest(`/api/proposals/${proposalId}/accept`, { method: 'PUT' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Proposal Accepted",
        description: "The investment proposal has been accepted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Acceptance Failed",
        description: "Failed to accept the proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  const addToCartMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest(`/api/proposals/${proposalId}/add-to-cart`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Added to Cart",
        description: "Proposal has been added to your cart for checkout.",
      });
    },
    onError: (error) => {
      toast({
        title: "Add to Cart Failed",
        description: "Failed to add proposal to cart. Please try again.",
        variant: "destructive",
      });
    }
  });

  const rejectProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest(`/api/proposals/${proposalId}/reject`, { method: 'PUT' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Proposal Rejected",
        description: "The proposal has been rejected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject the proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const proposalData = {
      ...formData,
      totalInvestmentAmount: formData.totalInvestmentAmount ? parseFloat(formData.totalInvestmentAmount) : undefined,
      expectedReturns: formData.expectedReturns ? parseFloat(formData.expectedReturns) : undefined,
    };
    
    await createProposalMutation.mutateAsync(proposalData);
  };

  // Bond order payment mutation
  const bondPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = pendingBondOrders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');
      
      return apiRequest("/api/payments/cashfree/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(order.totalAmount),
          orderId: orderId,
          orderType: 'bond'
        })
      });
    },
    onSuccess: (data: any) => {
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        toast({
          title: "Payment Initiated",
          description: "Payment process started. Please complete the payment.",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: "Failed to initiate payment. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Proposal filtering and counts
  const filteredProposals = proposals?.filter((p: any) => {
    if (selectedProposalTab === 'all') return true;
    return p.proposalSource === selectedProposalTab;
  }) || [];

  const aiCount = proposals?.filter((p: any) => p.proposalSource === 'ai').length || 0;
  const agentCount = proposals?.filter((p: any) => p.proposalSource === 'agent').length || 0;
  const clientCount = proposals?.filter((p: any) => p.proposalSource === 'client').length || 0;
  const pendingCount = proposals?.filter((p: any) => p.status === 'pending').length || 0;
  const highPriorityCount = proposals?.filter((p: any) => p.priority === 'high').length || 0;

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai':
        return <Bot className="w-4 h-4" />;
      case 'agent':
        return <Users className="w-4 h-4" />;
      case 'client':
        return <User className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'ai':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600';
      case 'agent':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600';
      case 'client':
        return 'bg-green-100 dark:bg-green-900/30 text-green-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'accepted':
        return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'in_cart':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'rejected':
        return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'completed':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const renderProposalCard = (proposal: InvestmentProposal) => (
    <Card key={proposal.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary" data-testid={`card-proposal-${proposal.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3 flex-1">
            <div className={`p-2 rounded-lg ${getSourceColor(proposal.proposalSource)}`}>
              {getSourceIcon(proposal.proposalSource)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-id-${proposal.id}`}>
                  {proposal.id}
                </Badge>
                <Badge className={`text-xs px-2 py-0.5 border ${getStatusColor(proposal.status || '')}`} data-testid={`badge-status-${proposal.id}`}>
                  {(proposal.status || 'pending').toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="text-lg" data-testid={`text-title-${proposal.id}`}>{proposal.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getPriorityColor(proposal.priority || 'medium')}>
                  {(proposal.priority || 'medium').toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {proposal.proposalSource} Generated
                </Badge>
              </div>
            </div>
          </div>
          {proposal.totalInvestmentAmount && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Investment</div>
              <div className="text-xl font-bold text-primary" data-testid={`text-amount-${proposal.id}`}>
                {formatCurrency(proposal.totalInvestmentAmount)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {proposal.description && (
          <p className="text-muted-foreground">{proposal.description}</p>
        )}
        
        {proposal.analysisRationale && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Rationale</p>
                <p className="text-sm text-muted-foreground">{proposal.analysisRationale}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {proposal.riskProfile && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Risk Profile</p>
              <p className="font-medium capitalize">{proposal.riskProfile}</p>
            </div>
          )}
          {proposal.timeHorizon && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Time Horizon</p>
              <p className="font-medium">{proposal.timeHorizon}</p>
            </div>
          )}
          {proposal.expectedReturns && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Expected Returns</p>
              <p className="font-medium text-green-600">{proposal.expectedReturns}% p.a.</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 pt-4 border-t">
          {proposal.status === 'pending' && (
            <>
              <Button 
                className="flex-1" 
                variant="default"
                onClick={() => acceptProposalMutation.mutate(proposal.id)}
                disabled={acceptProposalMutation.isPending}
                data-testid={`button-accept-${proposal.id}`}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept
              </Button>
              <Button 
                variant="outline"
                onClick={() => addToCartMutation.mutate(proposal.id)}
                disabled={addToCartMutation.isPending}
                data-testid={`button-add-cart-${proposal.id}`}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => rejectProposalMutation.mutate(proposal.id)}
                disabled={rejectProposalMutation.isPending}
                data-testid={`button-reject-${proposal.id}`}
              >
                Reject
              </Button>
            </>
          )}
          {proposal.status === 'accepted' && (
            <Button 
              className="flex-1"
              variant="default"
              onClick={() => addToCartMutation.mutate(proposal.id)}
              disabled={addToCartMutation.isPending}
              data-testid={`button-add-cart-${proposal.id}`}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          )}
          {proposal.status === 'in_cart' && (
            <Button 
              className="flex-1"
              variant="secondary"
              onClick={() => handleTabChange('cart')}
              data-testid={`button-view-cart-${proposal.id}`}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              View in Cart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="cart-page">
        <div className="mb-6">
          <Link href="/store">
            <Button variant="ghost" className="mb-4" data-testid="button-back-to-store">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Cart & Proposals</h1>
          <p className="text-muted-foreground">Manage your cart items and review investment proposals</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cart" className="flex items-center gap-2" data-testid="tab-cart">
              <ShoppingCart className="w-4 h-4" />
              Cart ({cart?.totalItems || 0})
            </TabsTrigger>
            <TabsTrigger value="investments" className="flex items-center gap-2" data-testid="tab-investments">
              <TrendingUp className="w-4 h-4" />
              Investments ({unifiedCartItems.length})
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2" data-testid="tab-proposals">
              <Lightbulb className="w-4 h-4" />
              Proposals ({proposals?.length || 0})
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Cart Tab */}
          <TabsContent value="cart" className="space-y-6">
            {!cart || cart.items.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">Your cart is empty</h2>
                  <p className="text-muted-foreground mb-6">Add financial products or proposals to get started</p>
                  <div className="flex gap-4 justify-center">
                    <Link href="/store">
                      <Button className="bg-finance-blue hover:bg-finance-blue/90" data-testid="button-browse-products">
                        Browse Products
                      </Button>
                    </Link>
                    <Button variant="outline" onClick={() => handleTabChange('proposals')} data-testid="button-view-proposals">
                      View Proposals
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Cart Items */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Cart Items ({cart.totalItems})</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearCart}
                      data-testid="button-clear-cart"
                    >
                      Clear Cart
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {cart.items.map((item) => {
                        const isInvestment = item.itemType === "investment";
                        const itemName = isInvestment ? item.metadata?.name : item.product?.name;
                        const itemDescription = isInvestment ? item.metadata?.description : item.product?.shortDescription;
                        const itemId = item.productId || item.investmentId || item.id;
                        
                        return (
                          <div 
                            key={item.id} 
                            className="flex items-center justify-between p-4 border rounded-lg"
                            data-testid={`cart-item-${itemId}`}
                          >
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{itemName}</h3>
                              <p className="text-sm text-muted-foreground">{itemDescription}</p>
                              <div className="flex items-center gap-4 mt-2">
                                {isInvestment ? (
                                  <>
                                    <Badge variant="outline">{item.metadata?.investmentType || "Investment"}</Badge>
                                    <span className="text-sm text-muted-foreground">{item.metadata?.fundHouse}</span>
                                    {item.metadata?.frequency && (
                                      <Badge>{item.metadata.frequency}</Badge>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <Badge variant="outline">{item.product?.category}</Badge>
                                    <span className="text-sm text-muted-foreground">by {item.product?.provider}</span>
                                    <Badge className={
                                      item.product?.riskLevel === "low" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" :
                                      item.product?.riskLevel === "medium" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" :
                                      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                    }>
                                      {item.product?.riskLevel} risk
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {/* Quantity Controls - only for products */}
                              {!isInvestment && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                    disabled={item.quantity <= 1 || updatingItems[item.id]}
                                    data-testid={`button-decrease-quantity-${itemId}`}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                    disabled={updatingItems[item.id]}
                                    data-testid={`button-increase-quantity-${itemId}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}

                              {/* Investment Amount */}
                              {isInvestment && (
                                <div className="w-32">
                                  <div className="text-center">
                                    <span className="font-medium text-lg">₹{parseInt(item.investmentAmount || '0').toLocaleString()}</span>
                                    <p className="text-xs text-muted-foreground">Amount</p>
                                  </div>
                                </div>
                              )}

                              {!isInvestment && (
                                <div className="w-32">
                                  <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={item.investmentAmount || item.product?.minimumInvestment || ''}
                                    onChange={(e) => handleInvestmentAmountChange(item.id, e.target.value)}
                                    min={item.product?.minimumInvestment || undefined}
                                    data-testid={`input-investment-amount-${itemId}`}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Min: ₹{parseInt(item.product?.minimumInvestment || '0').toLocaleString()}
                                  </p>
                                </div>
                              )}

                              {/* Remove Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={isRemovingFromCart}
                                data-testid={`button-remove-${itemId}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Cart Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Cart Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total Items:</span>
                        <span className="font-medium">{cart.totalItems}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Investment:</span>
                        <span className="font-medium">₹{cart.totalValue.toLocaleString()}</span>
                      </div>
                      
                      {/* Fee Breakdown */}
                      {cart.totalValue > 0 && (
                        <div className="border-t pt-3">
                          <FeeBreakdownCard
                            feeBreakdown={cartFeeBreakdown}
                            isLoading={cartFeesLoading}
                            showDetails={true}
                          />
                        </div>
                      )}
                      
                      <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Investment Value:</span>
                          <span>₹{cart.totalValue.toLocaleString()}</span>
                        </div>
                        {cartFeeBreakdown && cartFeeBreakdown.summary.grandTotal > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Fees & Charges:</span>
                            <span>+₹{cartFeeBreakdown.summary.grandTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                          <span>Total Payable:</span>
                          <span data-testid="text-cart-total-payable">
                            ₹{(cart.totalValue + (cartFeeBreakdown?.summary.grandTotal || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Fees calculated based on your investor profile
                        </p>
                      </div>
                    </div>

                    {/* Payment Method Selection */}
                    <div className="mt-6 space-y-3">
                      <Label className="text-base font-semibold">Select Payment Method</Label>
                      <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "cashfree" | "phonepe")}>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                          <RadioGroupItem value="cashfree" id="cashfree" data-testid="radio-cashfree" />
                          <Label htmlFor="cashfree" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">Cashfree</div>
                              <Badge variant="secondary">Primary</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">UPI, Cards & more payment options</div>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                          <RadioGroupItem value="phonepe" id="phonepe" data-testid="radio-phonepe" />
                          <Label htmlFor="phonepe" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <div className="font-medium">PhonePe</div>
                              <Badge variant="outline">UPI</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">UPI, Wallets & Net Banking</div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                    
                    <div className="mt-6 space-y-3">
                      <Button 
                        className="w-full bg-finance-blue hover:bg-finance-blue/90"
                        size="lg"
                        onClick={handleCheckout}
                        disabled={checkoutMutation.isPending || !feesReady}
                        data-testid="button-proceed-to-checkout"
                      >
                        <CreditCard className="h-5 w-5 mr-2" />
                        {cartFeesLoading ? "Calculating fees..." : checkoutMutation.isPending ? "Processing..." : "Proceed to Checkout"}
                      </Button>
                      {cartFeesLoading && (
                        <p className="text-xs text-center text-muted-foreground">
                          Please wait while we calculate applicable fees...
                        </p>
                      )}
                      {cartFeesError && (
                        <div className="text-xs text-center text-red-500">
                          <span>Fee calculation failed. </span>
                          <button 
                            onClick={() => refetchCartFees()}
                            className="underline hover:text-red-700 dark:text-red-300"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                      <Link href="/store">
                        <Button variant="outline" className="w-full" data-testid="button-continue-shopping">
                          Continue Shopping
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="space-y-6">
            {unifiedCartLoading ? (
              <Card>
                <CardContent className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading investments...</p>
                </CardContent>
              </Card>
            ) : unifiedCartItems.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-foreground mb-2">No investment items</h2>
                  <p className="text-muted-foreground mb-6">Add investments from mutual funds, bonds, NCDs, IPOs, or unlisted shares</p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <Link href="/mutual-funds">
                      <Button variant="outline" data-testid="button-browse-mf">
                        <Coins className="w-4 h-4 mr-2" />
                        Mutual Funds
                      </Button>
                    </Link>
                    <Link href="/bonds">
                      <Button variant="outline" data-testid="button-browse-bonds">
                        <FileText className="w-4 h-4 mr-2" />
                        Bonds
                      </Button>
                    </Link>
                    <Link href="/unlisted">
                      <Button variant="outline" data-testid="button-browse-unlisted">
                        <Building2 className="w-4 h-4 mr-2" />
                        Unlisted
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Group items by category - dynamically from actual data */}
                {Array.from(new Set(unifiedCartItems.map((item: any) => item.productCategory))).map((category) => {
                  const categoryItems = unifiedCartItems.filter((item: any) => item.productCategory === category);
                  
                  const getCategoryIcon = (cat: ProductCategory) => {
                    switch (cat) {
                      case 'mutual_fund': return <Coins className="w-5 h-5" />;
                      case 'bond': return <FileText className="w-5 h-5" />;
                      case 'ncd': return <Landmark className="w-5 h-5" />;
                      case 'ipo': return <TrendingUp className="w-5 h-5" />;
                      case 'unlisted': return <Building2 className="w-5 h-5" />;
                      case 'store': return <Package className="w-5 h-5" />;
                      default: return <ShoppingCart className="w-5 h-5" />;
                    }
                  };
                  
                  const getCategoryLabel = (cat: ProductCategory) => {
                    switch (cat) {
                      case 'mutual_fund': return 'Mutual Funds';
                      case 'bond': return 'Bonds';
                      case 'ncd': return 'NCDs';
                      case 'ipo': return 'IPOs';
                      case 'unlisted': return 'Unlisted Shares';
                      case 'store': return 'Store Products';
                      default: return cat;
                    }
                  };

                  const getCategoryColor = (cat: ProductCategory) => {
                    switch (cat) {
                      case 'mutual_fund': return 'border-l-blue-500';
                      case 'bond': return 'border-l-green-500';
                      case 'ncd': return 'border-l-purple-500';
                      case 'ipo': return 'border-l-orange-500';
                      case 'unlisted': return 'border-l-amber-500';
                      case 'store': return 'border-l-gray-500';
                      default: return 'border-l-primary';
                    }
                  };

                  return (
                    <Card key={category} className={`border-l-4 ${getCategoryColor(category as ProductCategory)}`}>
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          {getCategoryIcon(category as ProductCategory)}
                          <CardTitle>{getCategoryLabel(category as ProductCategory)}</CardTitle>
                          <Badge variant="secondary">{categoryItems.length} items</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {categoryItems.map((item) => (
                            <div 
                              key={item.id}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
                              data-testid={`unified-cart-item-${item.id}`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold" data-testid={`text-name-${item.id}`}>{item.displayName || 'Investment Item'}</h3>
                                  {/* Source Badge */}
                                  <Badge 
                                    className={`text-xs ${
                                      item.source === 'ai' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                                      item.source === 'agent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    }`}
                                    data-testid={`badge-source-${item.id}`}
                                  >
                                    {item.source === 'ai' && <Bot className="w-3 h-3 mr-1" />}
                                    {item.source === 'agent' && <Users className="w-3 h-3 mr-1" />}
                                    {item.source === 'client' && <User className="w-3 h-3 mr-1" />}
                                    {(item.source || 'client').toUpperCase()}
                                  </Badge>
                                  {/* Status Badge */}
                                  <Badge 
                                    variant={item.status === 'approved' ? 'default' : 'outline'}
                                    className={
                                      item.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800' :
                                      item.status === 'approved' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' :
                                      ''
                                    }
                                    data-testid={`badge-status-${item.id}`}
                                  >
                                    {item.status || 'active'}
                                  </Badge>
                                </div>
                                {item.metadata && Object.keys(item.metadata).length > 0 && (
                                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${item.id}`}>
                                    {(item.metadata as any)?.description || (item.metadata as any)?.fundHouse || (item.metadata as any)?.companyName || ''}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <span data-testid={`text-qty-${item.id}`}>Qty: {item.quantity || 1}</span>
                                  <span data-testid={`text-price-${item.id}`}>₹{Number(item.amount || 0).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold" data-testid={`text-total-${item.id}`}>
                                    ₹{(Number(item.amount || 0) * (item.quantity || 1)).toLocaleString()}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Total</p>
                                </div>
                                
                                {/* Approve button for agent/AI items */}
                                {item.status === 'pending' && (item.source === 'ai' || item.source === 'agent') && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      approveUnifiedItem(item.id);
                                      toast({
                                        title: "Approved",
                                        description: "Investment item approved for checkout",
                                      });
                                    }}
                                    data-testid={`button-approve-${item.id}`}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                )}
                                
                                {/* Remove button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    removeUnifiedItem(item.id);
                                    toast({
                                      title: "Removed",
                                      description: "Item removed from investments",
                                    });
                                  }}
                                  disabled={isRemovingUnifiedItem}
                                  data-testid={`button-remove-unified-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Summary Card */}
                <Card data-testid="card-investment-summary">
                  <CardHeader>
                    <CardTitle>Investment Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total Items:</span>
                        <span className="font-medium" data-testid="text-summary-total-items">{unifiedCartItems.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Approved Items:</span>
                        <span className="font-medium text-green-600" data-testid="text-summary-approved">
                          {unifiedCartItems.filter((i: any) => i.status === 'approved').length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pending Approval:</span>
                        <span className="font-medium text-yellow-600" data-testid="text-summary-pending">
                          {unifiedCartItems.filter((i: any) => i.status === 'pending').length}
                        </span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-sm">
                          <span>Investment Value:</span>
                          <span data-testid="text-summary-total-value">₹{unifiedTotalValue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {/* Fee Breakdown for Investments */}
                      {unifiedCartItems.length > 0 && (
                        <div className="border-t pt-3">
                          <FeeBreakdownCard
                            feeBreakdown={investmentFeeBreakdown}
                            isLoading={investmentFeesLoading}
                            showDetails={true}
                          />
                        </div>
                      )}
                      
                      {/* Total Payable */}
                      <div className="border-t pt-3 space-y-2">
                        {investmentFeeBreakdown && investmentFeeBreakdown.summary.grandTotal > 0 && (
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Fees & Charges:</span>
                            <span>+₹{investmentFeeBreakdown.summary.grandTotal.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Total Payable:</span>
                          <span data-testid="text-investment-total-payable">
                            ₹{(unifiedTotalValue + (investmentFeeBreakdown?.summary.grandTotal || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="pt-4 space-y-2">
                        <Button
                          className="w-full bg-finance-blue hover:bg-finance-blue/90"
                          size="lg"
                          onClick={async () => {
                            const activeItems = unifiedCartItems.filter((i: any) => i.status === 'active');
                            if (activeItems.length === 0) {
                              toast({
                                title: "No items to checkout",
                                description: "Add or approve items before checkout",
                                variant: "destructive"
                              });
                              return;
                            }
                            if (!investmentFeesReady) {
                              toast({
                                title: "Fee Calculation Pending",
                                description: "Please wait while we calculate applicable fees",
                                variant: "destructive"
                              });
                              refetchInvestmentFees();
                              return;
                            }
                            try {
                              const result = await checkoutUnifiedItems(activeItems.map((i: any) => i.id));
                              toast({
                                title: "Checkout Successful",
                                description: `${result.count} order(s) created. View them in Portfolio.`,
                              });
                              setLocation('/portfolio?tab=fintekpro');
                            } catch (error) {
                              toast({
                                title: "Checkout Failed",
                                description: "Failed to process checkout",
                                variant: "destructive"
                              });
                            }
                          }}
                          disabled={isCheckingOutUnified || unifiedCartItems.filter((i: any) => i.status === 'active').length === 0 || !investmentFeesReady}
                          data-testid="button-checkout-investments"
                        >
                          <CreditCard className="h-5 w-5 mr-2" />
                          {investmentFeesLoading ? "Calculating fees..." : isCheckingOutUnified ? "Processing..." : `Checkout ${unifiedCartItems.filter((i: any) => i.status === 'active').length} Investment(s)`}
                        </Button>
                        {investmentFeesLoading && (
                          <p className="text-xs text-center text-muted-foreground">
                            Please wait while we calculate applicable fees...
                          </p>
                        )}
                        {investmentFeesError && (
                          <div className="text-xs text-center text-red-500">
                            <span>Fee calculation failed. </span>
                            <button 
                              onClick={() => refetchInvestmentFees()}
                              className="underline hover:text-red-700 dark:text-red-300"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-lg text-muted-foreground">
                  AI, Agent, and Client-generated investment recommendations
                </p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" data-testid="button-create-proposal">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create Proposal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Investment Proposal</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateProposal} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        data-testid="input-title"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        data-testid="input-description"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="analysisRationale">Analysis & Rationale</Label>
                      <Textarea
                        id="analysisRationale"
                        value={formData.analysisRationale}
                        onChange={(e) => setFormData({ ...formData, analysisRationale: e.target.value })}
                        rows={3}
                        data-testid="input-rationale"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="totalInvestmentAmount">Investment Amount (₹)</Label>
                        <Input
                          id="totalInvestmentAmount"
                          type="number"
                          value={formData.totalInvestmentAmount}
                          onChange={(e) => setFormData({ ...formData, totalInvestmentAmount: e.target.value })}
                          data-testid="input-amount"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="expectedReturns">Expected Returns (%)</Label>
                        <Input
                          id="expectedReturns"
                          type="number"
                          step="0.1"
                          value={formData.expectedReturns}
                          onChange={(e) => setFormData({ ...formData, expectedReturns: e.target.value })}
                          data-testid="input-returns"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="riskProfile">Risk Profile</Label>
                        <Select
                          value={formData.riskProfile}
                          onValueChange={(value) => setFormData({ ...formData, riskProfile: value })}
                        >
                          <SelectTrigger id="riskProfile" data-testid="select-risk">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conservative">Conservative</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="aggressive">Aggressive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value) => setFormData({ ...formData, priority: value })}
                        >
                          <SelectTrigger id="priority" data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="timeHorizon">Time Horizon</Label>
                      <Input
                        id="timeHorizon"
                        placeholder="e.g., 3-5 years"
                        value={formData.timeHorizon}
                        onChange={(e) => setFormData({ ...formData, timeHorizon: e.target.value })}
                        data-testid="input-time-horizon"
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        disabled={createProposalMutation.isPending}
                        className="flex-1"
                        data-testid="button-submit-proposal"
                      >
                        {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateDialogOpen(false)}
                        data-testid="button-cancel-proposal"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <Card className="bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-blue-50 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Bot className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600" data-testid="text-ai-count">{aiCount}</p>
                      <p className="text-sm font-medium text-purple-800 dark:text-purple-200">AI Generated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-agent-count">{agentCount}</p>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Agent Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <User className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-client-count">{clientCount}</p>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">Client Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-yellow-50 dark:from-yellow-950/30 to-amber-50 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">{pendingCount}</p>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-red-50 dark:to-red-950/30 border-orange-200 dark:border-orange-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Zap className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-orange-600" data-testid="text-high-priority-count">{highPriorityCount}</p>
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">High Priority</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Proposals Filtering Tabs */}
            <Tabs value={selectedProposalTab} onValueChange={setSelectedProposalTab} className="space-y-6">
              <ScrollableTabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
                  <Filter className="w-4 h-4" />
                  All ({proposals?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai">
                  <Bot className="w-4 h-4" />
                  AI ({aiCount})
                </TabsTrigger>
                <TabsTrigger value="agent" className="flex items-center gap-2" data-testid="tab-agent">
                  <Users className="w-4 h-4" />
                  Agent ({agentCount})
                </TabsTrigger>
                <TabsTrigger value="client" className="flex items-center gap-2" data-testid="tab-client">
                  <User className="w-4 h-4" />
                  Client ({clientCount})
                </TabsTrigger>
              </ScrollableTabsList>
              
              {proposalsLoading ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading proposals...</p>
                  </CardContent>
                </Card>
              ) : proposalsError ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">Unable to load proposals</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Please try again later or contact support if the problem persists.
                    </p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <TabsContent value={selectedProposalTab} className="space-y-6">
                  {filteredProposals.length === 0 ? (
                    <Card>
                      <CardContent className="text-center py-12">
                        {getSourceIcon(selectedProposalTab === 'all' ? 'ai' : selectedProposalTab)}
                        <h3 className="text-lg font-medium text-muted-foreground mb-2 mt-4">
                          No {selectedProposalTab === 'all' ? '' : selectedProposalTab + ' '} proposals found
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {selectedProposalTab === 'client' 
                            ? 'Create your first proposal using the "Create Proposal" button above.' 
                            : 'Proposals will appear here when available.'}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-6">
                      {filteredProposals.map((proposal: any) => renderProposalCard(proposal))}
                    </div>
                  )}
                </TabsContent>
              )}
            </Tabs>

            {/* Pending Bond Orders Section */}
            {pendingBondOrders.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <h3 className="text-xl font-semibold">Pending Bond Orders</h3>
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                    {pendingBondOrders.length} Awaiting Payment
                  </Badge>
                </div>
                <div className="grid gap-4">
                  {pendingBondOrders.map((order) => (
                    <Card key={order.id} className="border-l-4 border-l-amber-500" data-testid={`card-bond-order-${order.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="outline" className="font-mono text-xs mb-2" data-testid={`badge-order-id-${order.id}`}>
                              {order.id.slice(0, 8)}...
                            </Badge>
                            <CardTitle className="text-lg" data-testid={`text-bond-name-${order.id}`}>
                              {order.bondName || order.isin}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {order.bondType?.toUpperCase()} | ISIN: {order.isin}
                            </CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Total Amount</div>
                            <div className="text-xl font-bold text-primary" data-testid={`text-order-amount-${order.id}`}>
                              {formatCurrency(parseFloat(order.totalAmount))}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Order Type</p>
                            <p className="font-medium capitalize">{order.orderType}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Quantity</p>
                            <p className="font-medium">{order.quantity} units</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Price</p>
                            <p className="font-medium">{formatCurrency(parseFloat(order.orderPrice))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Status</p>
                            <Badge className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                              {order.orderStatus?.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Order placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <Button
                            onClick={() => bondPaymentMutation.mutate(order.id)}
                            disabled={bondPaymentMutation.isPending}
                            className="bg-finance-blue hover:bg-finance-blue/90"
                            data-testid={`button-pay-bond-${order.id}`}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {bondPaymentMutation.isPending ? 'Processing...' : 'Pay Now'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
