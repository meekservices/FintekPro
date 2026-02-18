import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { 
  ShoppingCart, IndianRupee, RefreshCw, Trash2, CreditCard, AlertOctagon,
  Package, CheckCircle2, Building2, Briefcase, BarChart3, FileText, 
  TrendingUp, ArrowRight, Clock, Shield
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";

const PRODUCT_TYPES = {
  aif: { label: "AIF", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", icon: Building2, gradient: "from-blue-500 to-indigo-500" },
  pms: { label: "PMS", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300", icon: Briefcase, gradient: "from-purple-500 to-pink-500" },
  mld: { label: "MLD", color: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300", icon: BarChart3, gradient: "from-teal-500 to-cyan-500" },
  mutual_fund: { label: "Mutual Fund", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300", icon: TrendingUp, gradient: "from-orange-500 to-amber-500" },
  etf: { label: "ETF", color: "bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300", icon: TrendingUp, gradient: "from-lime-500 to-green-500" },
};

export default function UnifiedCart() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const { data: cartData, isLoading: cartLoading } = useQuery<any>({
    queryKey: ['/api/cart'],
  });

  const { data: proposalData, isLoading: proposalsLoading } = useQuery<any[]>({
    queryKey: ['/api/proposals'],
  });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest(`/api/cart/items/${itemId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({ title: "Removed from Cart" });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (items: any[]) => {
      const results = [];
      for (const item of items) {
        if (item.proposalId) {
          const result = await apiRequest(`/api/proposals/${item.proposalId}/complete-order`, { 
            method: 'POST',
            body: JSON.stringify({ 
              orderType: 'LUMPSUM', 
              productType: item.productCategory || item.category,
              auditLog: {
                action: 'checkout',
                timestamp: new Date().toISOString(),
                amount: item.amount,
                source: 'unified_cart'
              }
            })
          });
          results.push(result);
          await apiRequest(`/api/cart/items/${item.id}`, { method: 'DELETE' });
        }
      }
      return results;
    },
    onSuccess: () => {
      toast({ title: "Orders Placed!", description: "Your investment orders have been submitted for processing" });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/aif/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/pms/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/mld/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/mf/orders'] });
      navigate('/investments');
    },
    onError: (error: any) => {
      toast({ 
        title: "Checkout Error", 
        description: error?.message || "Some items could not be processed", 
        variant: "destructive" 
      });
    }
  });

  const cartItems = cartData?.items || [];
  const approvedProposals = proposalData?.filter(p => p.status === 'approved') || [];
  
  const getItemsByCategory = (category: string) => {
    if (category === 'all') return cartItems;
    return cartItems.filter((item: any) => 
      item.productCategory === category || item.category === category
    );
  };

  const categoryCounts = {
    all: cartItems.length,
    aif: cartItems.filter((i: any) => i.productCategory === 'aif' || i.category === 'aif').length,
    pms: cartItems.filter((i: any) => i.productCategory === 'pms' || i.category === 'pms').length,
    mld: cartItems.filter((i: any) => i.productCategory === 'mld' || i.category === 'mld').length,
    mutual_fund: cartItems.filter((i: any) => i.productCategory === 'mutual_fund' || i.category === 'mutual_fund').length,
  };

  const totalValue = cartItems.reduce((sum: number, item: any) => 
    sum + parseFloat(item.amount || item.quantity || '0'), 0
  );

  const filteredItems = getItemsByCategory(activeTab);

  if (cartLoading || proposalsLoading) {
    return (
      <div className="min-h-screen bg-finance-light p-8" data-testid="unified-cart-page">
        <LoadingState variant="card" count={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-finance-light" data-testid="unified-cart-page">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center gap-3">
            <ShoppingCart className="w-10 h-10 text-primary" />
            Investment Cart
          </h1>
          <p className="text-muted-foreground text-lg">
            Review and checkout your approved investment proposals across all product categories.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">AIF Items</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{categoryCounts.aif}</p>
                </div>
                <Building2 className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-50 dark:from-purple-950/30 to-pink-50 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">PMS Items</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{categoryCounts.pms}</p>
                </div>
                <Briefcase className="w-10 h-10 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-teal-50 dark:from-teal-950/30 to-cyan-50 dark:to-cyan-950/30 border-teal-200 dark:border-teal-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-600">MLD Items</p>
                  <p className="text-3xl font-bold text-teal-700 dark:text-teal-300">{categoryCounts.mld}</p>
                </div>
                <BarChart3 className="w-10 h-10 text-teal-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-50 dark:from-orange-950/30 to-amber-50 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Total Value</p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">₹{totalValue.toLocaleString('en-IN')}</p>
                </div>
                <IndianRupee className="w-10 h-10 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <ScrollableTabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({categoryCounts.all})
                </TabsTrigger>
                <TabsTrigger value="aif" data-testid="tab-aif">
                  AIF ({categoryCounts.aif})
                </TabsTrigger>
                <TabsTrigger value="pms" data-testid="tab-pms">
                  PMS ({categoryCounts.pms})
                </TabsTrigger>
                <TabsTrigger value="mld" data-testid="tab-mld">
                  MLD ({categoryCounts.mld})
                </TabsTrigger>
                <TabsTrigger value="mutual_fund" data-testid="tab-mf">
                  MF ({categoryCounts.mutual_fund})
                </TabsTrigger>
              </ScrollableTabsList>

              {['all', 'aif', 'pms', 'mld', 'mutual_fund'].map(tab => (
                <TabsContent key={tab} value={tab} className="space-y-4">
                  {getItemsByCategory(tab).length === 0 ? (
                    <Card className="border-dashed border-2 border-border">
                      <CardContent className="flex flex-col items-center justify-center py-16">
                        <ShoppingCart className="w-16 h-16 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          {tab === 'all' ? 'Your Cart is Empty' : `No ${tab.toUpperCase()} Items`}
                        </h3>
                        <p className="text-muted-foreground text-center max-w-md mb-4">
                          Approve investment proposals to add them to your cart.
                        </p>
                        <Button variant="outline" onClick={() => navigate('/investments')}>
                          Browse Investments
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    getItemsByCategory(tab).map((item: any, index: number) => {
                      const productType = item.productCategory || item.category || 'mutual_fund';
                      const config = PRODUCT_TYPES[productType as keyof typeof PRODUCT_TYPES] || PRODUCT_TYPES.mutual_fund;
                      const IconComponent = config.icon;

                      return (
                        <Card key={item.id || index} className="overflow-hidden hover:shadow-md transition-shadow" data-testid={`cart-item-${productType}-${index}`}>
                          <CardContent className="p-0">
                            <div className="flex">
                              <div className={`w-2 bg-gradient-to-b ${config.gradient}`} />
                              <div className="flex-1 p-6">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <IconComponent className="w-5 h-5 text-muted-foreground" />
                                      <h4 className="font-semibold text-foreground">
                                        {item.productName || item.schemeName || 'Investment Item'}
                                      </h4>
                                      <Badge className={config.color}>{config.label}</Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      {item.fundHouse && <span>{item.fundHouse}</span>}
                                      {item.orderType && <span className="capitalize">{item.orderType}</span>}
                                      {item.proposalId && (
                                        <Badge variant="outline" className="text-xs">
                                          <CheckCircle2 className="w-3 h-3 mr-1" />
                                          Approved Proposal
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xl font-bold text-foreground flex items-center justify-end">
                                      <IndianRupee className="w-4 h-4" />
                                      {parseFloat(item.amount || item.quantity || '0').toLocaleString('en-IN')}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30 mt-2"
                                      onClick={() => removeFromCartMutation.mutate(item.id)}
                                      disabled={removeFromCartMutation.isPending}
                                      data-testid={`remove-${productType}-${index}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4 border-2 border-primary/20 bg-gradient-to-b from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Order Summary
                </CardTitle>
                <CardDescription>
                  Review your investments before checkout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {categoryCounts.aif > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Building2 className="w-4 h-4" />AIF ({categoryCounts.aif})
                      </span>
                      <span className="font-medium">
                        ₹{cartItems.filter((i: any) => i.productCategory === 'aif').reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {categoryCounts.pms > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />PMS ({categoryCounts.pms})
                      </span>
                      <span className="font-medium">
                        ₹{cartItems.filter((i: any) => i.productCategory === 'pms').reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {categoryCounts.mld > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />MLD ({categoryCounts.mld})
                      </span>
                      <span className="font-medium">
                        ₹{cartItems.filter((i: any) => i.productCategory === 'mld').reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {categoryCounts.mutual_fund > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />Mutual Funds ({categoryCounts.mutual_fund})
                      </span>
                      <span className="font-medium">
                        ₹{cartItems.filter((i: any) => i.productCategory === 'mutual_fund').reduce((s: number, i: any) => s + parseFloat(i.amount || '0'), 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Investment</span>
                    <span className="flex items-center text-primary">
                      <IndianRupee className="w-5 h-5" />
                      {totalValue.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">Regulatory Compliance</p>
                      <p className="text-amber-700 dark:text-amber-400 text-xs">
                        All transactions are logged for audit purposes per SEBI guidelines.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-300">Processing Time</p>
                      <p className="text-blue-700 dark:text-blue-400 text-xs">
                        Orders processed within 1-3 business days after payment confirmation.
                      </p>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-foreground font-semibold py-6"
                  onClick={() => checkoutMutation.mutate(cartItems)}
                  disabled={checkoutMutation.isPending || cartItems.length === 0}
                  data-testid="unified-checkout-btn"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Proceed to Payment
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Secure payment powered by Cashfree & PhonePe
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
