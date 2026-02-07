import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Shield, Calendar, BarChart3, IndianRupee, Search, RefreshCw,
  ShoppingCart, ClipboardList, Wallet, Package, FileText, Calculator,
  ThumbsUp, ThumbsDown, Bot, UserCheck, Trash2, CreditCard, AlertOctagon,
  Sparkles, PieChart, Target, Award, Info
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import { ExpressInterestButton } from "@/components/ExpressInterestDialog";

const PRODUCT_TYPE = "mld";

function ProposalsTab({ productType, onApprove }: { productType: string; onApprove: () => void }) {
  const { toast } = useToast();
  const { data: proposals, isLoading, refetch } = useQuery<any[]>({ queryKey: ['/api/proposals', { productType }] });

  const approveMutation = useMutation({
    mutationFn: async (proposalId: string) => apiRequest(`/api/proposals/${proposalId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Proposal Approved", description: "Added to your investment cart" });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      onApprove();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (proposalId: string) => apiRequest(`/api/proposals/${proposalId}/reject`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: "Proposal Rejected" });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
    },
  });

  const pendingProposals = proposals?.filter(p => p.status === 'pending' && p.productType === productType) || [];
  
  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-teal-600" /></div>;

  if (pendingProposals.length === 0) {
    return (
      <Card className="border-dashed border-2 border-teal-200 bg-teal-50/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Bot className="w-16 h-16 text-teal-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Pending MLD Proposals</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">AI and agent recommendations for Market Linked Debentures will appear here.</p>
          <Button variant="outline" onClick={() => refetch()} className="border-teal-300 text-teal-600"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingProposals.map((proposal) => (
        <Card key={proposal.id} className="overflow-hidden hover:shadow-lg" data-testid={`mld-proposal-${proposal.id}`}>
          <CardContent className="p-0">
            <div className="flex">
              <div className={`w-2 ${proposal.proposalSource === 'ai' ? 'bg-gradient-to-b from-teal-500 to-cyan-600' : 'bg-gradient-to-b from-emerald-500 to-green-600'}`} />
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {proposal.proposalSource === 'ai' ? (
                        <Badge className="bg-teal-100 text-teal-700"><Bot className="w-3 h-3 mr-1" />AI Generated</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700"><UserCheck className="w-3 h-3 mr-1" />Agent Recommended</Badge>
                      )}
                      <Badge variant="outline" className="bg-teal-50 text-teal-700">MLD</Badge>
                    </div>
                    <h3 className="text-lg font-semibold">{proposal.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{proposal.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold flex items-center justify-end"><IndianRupee className="w-5 h-5" />{parseFloat(proposal.totalInvestmentAmount || '0').toLocaleString('en-IN')}</p>
                    <p className="text-sm text-muted-foreground">Investment Amount</p>
                  </div>
                </div>

                {proposal.analysisRationale && (
                  <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-teal-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-teal-800 text-sm">Investment Rationale</p>
                        <p className="text-sm text-teal-700 mt-1">{proposal.analysisRationale}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-muted rounded-lg">
                  <div className="text-center"><p className="text-sm text-muted-foreground">Capital Protection</p><p className="text-lg font-bold text-green-600">{proposal.capitalProtection || '100%'}</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Participation</p><p className="text-lg font-bold">{proposal.participationRate || '80%'}</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Tenure</p><p className="text-lg font-bold">{proposal.tenure || '3 Years'}</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Underlying</p><p className="text-lg font-bold text-blue-600">{proposal.underlyingIndex || 'NIFTY 50'}</p></div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveMutation.mutate(proposal.id)} disabled={approveMutation.isPending} data-testid={`approve-mld-${proposal.id}`}>
                    {approveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-2" />}Approve & Add to Cart
                  </Button>
                  <Button variant="outline" className="border-red-300 text-red-600" onClick={() => rejectMutation.mutate(proposal.id)} data-testid={`reject-mld-${proposal.id}`}>
                    <ThumbsDown className="w-4 h-4 mr-2" />Reject
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CartTab({ productType, onCheckout }: { productType: string; onCheckout: () => void }) {
  const { toast } = useToast();
  const { data: cartData, isLoading } = useQuery<any>({ queryKey: ['/api/cart', { productCategory: productType }] });

  const removeFromCartMutation = useMutation({
    mutationFn: async (itemId: string) => apiRequest(`/api/cart/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => { toast({ title: "Removed from Cart" }); queryClient.invalidateQueries({ queryKey: ['/api/cart'] }); },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      for (const item of cartItems) {
        if (item.proposalId) {
          await apiRequest(`/api/proposals/${item.proposalId}/complete-order`, { method: 'POST', body: JSON.stringify({ orderType: 'LUMPSUM', productType: 'mld' }) });
          await apiRequest(`/api/cart/items/${item.id}`, { method: 'DELETE' });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Order Placed!", description: "Your MLD investment order has been submitted" });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/mld/orders'] });
      onCheckout();
    },
  });

  const cartItems = cartData?.items?.filter((item: any) => item.productCategory === productType || item.category === productType) || [];
  const totalValue = cartItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
  
  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-teal-600" /></div>;

  if (cartItems.length === 0) {
    return (
      <Card className="border-dashed border-2 border-teal-200 bg-teal-50/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ShoppingCart className="w-16 h-16 text-teal-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Your MLD Cart is Empty</h3>
          <p className="text-muted-foreground text-center max-w-md">Approve proposals to add them to cart.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {cartItems.map((item: any, index: number) => (
          <Card key={item.id || index} data-testid={`mld-cart-item-${index}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-teal-600" />
                    <h4 className="font-semibold">{item.productName || 'MLD Investment'}</h4>
                    <Badge className="bg-teal-100 text-teal-700">MLD</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold flex items-center justify-end"><IndianRupee className="w-4 h-4" />{parseFloat(item.amount || '0').toLocaleString('en-IN')}</p>
                  <Button variant="ghost" size="sm" className="text-red-500 mt-2" onClick={() => removeFromCartMutation.mutate(item.id)}>
                    <Trash2 className="w-4 h-4 mr-1" />Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="lg:col-span-1">
        <Card className="sticky top-4 border-2 border-teal-200 bg-gradient-to-b from-teal-50 to-cyan-50">
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-teal-600" />Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Items</span><span className="font-medium">{cartItems.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">₹{totalValue.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-teal-600">₹{totalValue.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="bg-amber-100 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600 mt-0.5" />
                <div><p className="font-medium text-amber-800">MLD Notice</p><p className="text-amber-700 text-xs">Minimum ₹1 Lakh. Principal protection at maturity.</p></div>
              </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-foreground font-semibold py-6" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending} data-testid="mld-checkout-btn">
              {checkoutMutation.isPending ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Processing...</> : <><CreditCard className="w-5 h-5 mr-2" />Proceed to Payment</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ productType }: { productType: string }) {
  const { data: orders, isLoading } = useQuery<any[]>({ queryKey: ['/api/store/mld/orders'] });

  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin" /></div>;

  if (!orders || orders.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No MLD Orders Yet</h3>
          <p className="text-muted-foreground">Your orders will appear here once placed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order: any) => (
        <Card key={order.id} data-testid={`mld-order-${order.id}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div><h4 className="font-semibold text-lg">{order.productName || order.schemeName}</h4><p className="text-sm text-muted-foreground">Order #{order.id?.slice(-8)}</p></div>
              <Badge className={order.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{order.status}</Badge>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">₹{parseFloat(order.amount || '0').toLocaleString('en-IN')}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-semibold">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A'}</p></div>
              <div><span className="text-muted-foreground">Tenure</span><p className="font-semibold">{order.tenure || '3 Years'}</p></div>
              <div><span className="text-muted-foreground">Payment</span><p className="font-semibold">{order.paymentStatus || 'Pending'}</p></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PortfolioTab({ productType }: { productType: string }) {
  const { data: holdings, isLoading } = useQuery<any[]>({ queryKey: ['/api/portfolio/holdings', { productType }] });

  if (isLoading) return <LoadingState variant="card" count={3} />;

  if (!holdings || holdings.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Wallet className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No MLD Holdings</h3>
          <p className="text-muted-foreground">Your investments will appear here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {holdings.map((holding: any) => (
        <Card key={holding.id}>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div><h4 className="font-semibold">{holding.productName}</h4><p className="text-sm text-muted-foreground">{holding.issuer}</p></div>
              <div className="text-right">
                <p className="text-xl font-bold">₹{parseFloat(holding.currentValue || '0').toLocaleString('en-IN')}</p>
                <p className="text-sm text-muted-foreground">Maturity: {holding.maturityDate || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function MLDs() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("schemes");
  const [selectedProtection, setSelectedProtection] = useState("all");
  const [selectedTenure, setSelectedTenure] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: mldProducts, isLoading } = useQuery<any[]>({
    queryKey: ['/api/store/mld', { protection: selectedProtection !== "all" ? selectedProtection : undefined, tenure: selectedTenure !== "all" ? selectedTenure : undefined, search: searchQuery || undefined }],
    refetchInterval: 60000,
  });

  const { data: cartData } = useQuery<any>({ queryKey: ['/api/cart'] });
  const { data: proposalData } = useQuery<any[]>({ queryKey: ['/api/proposals'] });

  const displayData = mldProducts || [];
  const pendingProposals = proposalData?.filter(p => p.status === 'pending' && p.productType === 'mld')?.length || 0;
  const cartCount = cartData?.items?.filter((i: any) => i.productCategory === 'mld')?.length || 0;

  const statistics = {
    totalProducts: displayData.length,
    avgProtection: '95%',
    avgParticipation: '80%',
    activeTenures: 3
  };

  if (isLoading) return <div className="min-h-screen bg-finance-light p-8" data-testid="mlds-page"><LoadingState variant="card" count={4} /></div>;

  return (
    <div className="min-h-screen bg-finance-light" data-testid="mlds-page">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Market Linked Debentures (MLDs)</h1>
          <p className="text-muted-foreground text-lg">Structured debt instruments linked to market indices with capital protection options.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total MLDs</p><p className="text-3xl font-bold text-teal-600">{statistics.totalProducts}</p></div><BarChart3 className="w-10 h-10 text-teal-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Avg. Protection</p><p className="text-3xl font-bold text-green-600">{statistics.avgProtection}</p></div><Shield className="w-10 h-10 text-green-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Avg. Participation</p><p className="text-3xl font-bold text-blue-600">{statistics.avgParticipation}</p></div><TrendingUp className="w-10 h-10 text-blue-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Tenure Options</p><p className="text-3xl font-bold text-purple-600">{statistics.activeTenures}</p></div><Calendar className="w-10 h-10 text-purple-600" /></div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-6 mb-6">
            <TabsTrigger value="schemes" data-testid="tab-schemes"><BarChart3 className="w-4 h-4 mr-1" />MLDs</TabsTrigger>
            <TabsTrigger value="proposals" data-testid="tab-proposals"><ClipboardList className="w-4 h-4 mr-1" />Proposals{pendingProposals > 0 && <Badge className="ml-1 bg-teal-500 text-white text-xs">{pendingProposals}</Badge>}</TabsTrigger>
            <TabsTrigger value="cart" data-testid="tab-cart"><ShoppingCart className="w-4 h-4 mr-1" />Cart{cartCount > 0 && <Badge className="ml-1 bg-orange-500 text-white text-xs">{cartCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders"><FileText className="w-4 h-4 mr-1" />Orders</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio"><Wallet className="w-4 h-4 mr-1" />Portfolio</TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools"><Calculator className="w-4 h-4 mr-1" />Tools</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="schemes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card><CardHeader><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-finance-blue" /><CardTitle className="text-lg">Market Linked Returns</CardTitle></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">Returns based on underlying index performance (NIFTY, SENSEX, etc.)</p></CardContent></Card>
              <Card><CardHeader><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-finance-green" /><CardTitle className="text-lg">Capital Protection</CardTitle></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">Options with 100%, 90%, or 80% principal protection at maturity</p></CardContent></Card>
              <Card><CardHeader><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-finance-purple" /><CardTitle className="text-lg">Structured Payoffs</CardTitle></div></CardHeader><CardContent><p className="text-sm text-muted-foreground">Digital, range accrual, or step-up payoff structures</p></CardContent></Card>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Search MLDs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="search-mld" /></div>
              </div>
              <Select value={selectedProtection} onValueChange={setSelectedProtection}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Protection" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Protection</SelectItem>
                  <SelectItem value="100">100% Protected</SelectItem>
                  <SelectItem value="90">90% Protected</SelectItem>
                  <SelectItem value="80">80% Protected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedTenure} onValueChange={setSelectedTenure}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tenure" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tenures</SelectItem>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayData.length > 0 ? displayData.map((product: any) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow" data-testid={`mld-${product.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start"><CardTitle className="text-lg">{product.name}</CardTitle>{product.badge && <Badge variant="secondary">{product.badge}</Badge>}</div>
                    <p className="text-sm text-muted-foreground">{product.issuer || product.provider}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Underlying Index:</span><span className="font-semibold">{product.benchmarkIndex || 'NIFTY 50'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Capital Protection:</span><span className="font-semibold text-finance-green">{product.capitalProtection || '100%'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Participation Rate:</span><span className="font-semibold">{product.participationRate || '80%'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tenure:</span><span className="font-semibold">{product.tenure || '3 years'}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Min Investment:</span><span className="font-semibold">₹{product.minInvestment?.toLocaleString() || '100,000'}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <ExpressInterestButton productId={product.id} productType="mld" productName={product.name} />
                      <Button variant="outline" size="sm" onClick={() => navigate(`/mld/${product.id}`)} data-testid={`button-details-${product.id}`}><Info className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full text-center py-12"><p className="text-muted-foreground">No MLDs available. Check back soon!</p></div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="proposals"><ProposalsTab productType={PRODUCT_TYPE} onApprove={() => setActiveTab("cart")} /></TabsContent>
          <TabsContent value="cart"><CartTab productType={PRODUCT_TYPE} onCheckout={() => setActiveTab("orders")} /></TabsContent>
          <TabsContent value="orders"><OrdersTab productType={PRODUCT_TYPE} /></TabsContent>
          <TabsContent value="portfolio"><PortfolioTab productType={PRODUCT_TYPE} /></TabsContent>

          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg cursor-pointer" onClick={() => navigate('/calculators')}><CardContent className="p-6 text-center"><Calculator className="w-12 h-12 text-teal-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">MLD Calculator</h3><p className="text-sm text-muted-foreground">Calculate potential returns</p></CardContent></Card>
              <Card className="hover:shadow-lg cursor-pointer"><CardContent className="p-6 text-center"><PieChart className="w-12 h-12 text-green-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">Payoff Simulator</h3><p className="text-sm text-muted-foreground">Simulate different scenarios</p></CardContent></Card>
              <Card className="hover:shadow-lg cursor-pointer"><CardContent className="p-6 text-center"><Target className="w-12 h-12 text-blue-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">Risk Analyzer</h3><p className="text-sm text-muted-foreground">Understand risk-return</p></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>

        <Card className="mt-8">
          <CardHeader><CardTitle>Understanding Market Linked Debentures</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><h3 className="font-semibold mb-2">What are MLDs?</h3><p className="text-sm text-muted-foreground">Market Linked Debentures are structured debt securities where returns are linked to the performance of underlying market indices like NIFTY 50, SENSEX, or sectoral indices. They offer a blend of debt security with equity-like upside potential.</p></div>
            <div><h3 className="font-semibold mb-2">Key Features:</h3><ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside"><li>Capital protection options (100%, 90%, or 80% of principal)</li><li>Participation in index upside with defined participation rate</li><li>Fixed tenure (typically 1-5 years)</li><li>Tax efficiency for long-term holdings</li></ul></div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
