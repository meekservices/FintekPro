import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, IndianRupee, TrendingUp, ArrowUpRight, Search, BarChart3, 
  PieChart, Clock, Shield, Award, Target, Star, Eye, RefreshCw, ShoppingCart,
  ClipboardList, Wallet, Package, FileText, CheckCircle2, AlertTriangle,
  ThumbsUp, ThumbsDown, Bot, UserCheck, Trash2, CreditCard, AlertOctagon,
  Sparkles, Calculator, ChevronRight, Zap
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ExpressInterestButton } from "@/components/ExpressInterestDialog";
import { LoadingState } from "@/components/LoadingState";

const PRODUCT_TYPE = "pms";

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
  
  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /></div>;

  if (pendingProposals.length === 0) {
    return (
      <Card className="border-dashed border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Bot className="w-16 h-16 text-purple-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Pending PMS Proposals</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">AI and agent recommendations for Portfolio Management Services will appear here.</p>
          <Button variant="outline" onClick={() => refetch()} className="border-purple-300 dark:border-purple-700 text-purple-600"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {pendingProposals.map((proposal) => (
        <Card key={proposal.id} className="overflow-hidden hover:shadow-lg" data-testid={`pms-proposal-${proposal.id}`}>
          <CardContent className="p-0">
            <div className="flex">
              <div className={`w-2 ${proposal.proposalSource === 'ai' ? 'bg-gradient-to-b from-purple-500 to-pink-600' : 'bg-gradient-to-b from-teal-500 to-cyan-600'}`} />
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {proposal.proposalSource === 'ai' ? (
                        <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"><Bot className="w-3 h-3 mr-1" />AI Generated</Badge>
                      ) : (
                        <Badge className="bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"><UserCheck className="w-3 h-3 mr-1" />Agent Recommended</Badge>
                      )}
                      <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300">PMS</Badge>
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
                  <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-pink-50 dark:to-pink-950/30 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-purple-800 dark:text-purple-200 text-sm">Investment Rationale</p>
                        <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">{proposal.analysisRationale}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-muted rounded-lg">
                  <div className="text-center"><p className="text-sm text-muted-foreground">Expected Return</p><p className="text-lg font-bold text-emerald-600">{proposal.expectedReturns || 'N/A'}%</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Strategy</p><p className="text-lg font-bold">{proposal.strategy || 'Multicap'}</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Lock-in</p><p className="text-lg font-bold">{proposal.lockIn || 'None'}</p></div>
                  <div className="text-center"><p className="text-sm text-muted-foreground">Risk</p><p className="text-lg font-bold text-amber-600">{proposal.riskProfile || 'Moderate'}</p></div>
                </div>

                <div className="flex gap-3">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => approveMutation.mutate(proposal.id)} disabled={approveMutation.isPending} data-testid={`approve-pms-${proposal.id}`}>
                    {approveMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ThumbsUp className="w-4 h-4 mr-2" />}Approve & Add to Cart
                  </Button>
                  <Button variant="outline" className="border-red-300 dark:border-red-700 text-red-600" onClick={() => rejectMutation.mutate(proposal.id)} data-testid={`reject-pms-${proposal.id}`}>
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
          await apiRequest(`/api/proposals/${item.proposalId}/complete-order`, { method: 'POST', body: JSON.stringify({ orderType: 'LUMPSUM', productType: 'pms' }) });
          await apiRequest(`/api/cart/items/${item.id}`, { method: 'DELETE' });
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Order Placed!", description: "Your PMS investment order has been submitted" });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/pms/orders'] });
      onCheckout();
    },
  });

  const cartItems = cartData?.items?.filter((item: any) => item.productCategory === productType || item.category === productType) || [];
  const totalValue = cartItems.reduce((sum: number, item: any) => sum + parseFloat(item.amount || '0'), 0);
  
  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /></div>;

  if (cartItems.length === 0) {
    return (
      <Card className="border-dashed border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ShoppingCart className="w-16 h-16 text-purple-400 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Your PMS Cart is Empty</h3>
          <p className="text-muted-foreground text-center max-w-md">Approve proposals to add them to cart.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {cartItems.map((item: any, index: number) => (
          <Card key={item.id || index} data-testid={`pms-cart-item-${index}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold">{item.productName || 'PMS Investment'}</h4>
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">PMS</Badge>
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
        <Card className="sticky top-4 border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-b from-purple-50 dark:from-purple-950/30 to-pink-50 dark:to-pink-950/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-purple-600" />Order Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Items</span><span className="font-medium">{cartItems.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">₹{totalValue.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span className="text-purple-600">₹{totalValue.toLocaleString('en-IN')}</span></div>
            </div>
            <div className="bg-amber-100 dark:bg-amber-900/30 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600 mt-0.5" />
                <div><p className="font-medium text-amber-800 dark:text-amber-200">PMS Notice</p><p className="text-amber-700 dark:text-amber-300 text-xs">Minimum ₹50 Lakhs. Advisory fees apply.</p></div>
              </div>
            </div>
            <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-foreground font-semibold py-6" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending} data-testid="pms-checkout-btn">
              {checkoutMutation.isPending ? <><RefreshCw className="w-5 h-5 mr-2 animate-spin" />Processing...</> : <><CreditCard className="w-5 h-5 mr-2" />Proceed to Payment</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ productType }: { productType: string }) {
  const { data: orders, isLoading } = useQuery<any[]>({ queryKey: ['/api/store/pms/orders'] });

  if (isLoading) return <div className="flex items-center justify-center py-12"><RefreshCw className="w-8 h-8 animate-spin" /></div>;

  if (!orders || orders.length === 0) {
    return (
      <Card className="border-dashed border-2 border-border">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No PMS Orders Yet</h3>
          <p className="text-muted-foreground">Your orders will appear here once placed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order: any) => (
        <Card key={order.id} data-testid={`pms-order-${order.id}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div><h4 className="font-semibold text-lg">{order.schemeName || order.productName}</h4><p className="text-sm text-muted-foreground">Order #{order.id?.slice(-8)}</p></div>
              <Badge className={order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}>{order.status}</Badge>
            </div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Amount</span><p className="font-semibold">₹{parseFloat(order.amount || '0').toLocaleString('en-IN')}</p></div>
              <div><span className="text-muted-foreground">Date</span><p className="font-semibold">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A'}</p></div>
              <div><span className="text-muted-foreground">Type</span><p className="font-semibold">{order.orderType || 'Lumpsum'}</p></div>
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
          <h3 className="text-xl font-semibold mb-2">No PMS Holdings</h3>
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
              <div><h4 className="font-semibold">{holding.schemeName}</h4><p className="text-sm text-muted-foreground">{holding.fundHouse}</p></div>
              <div className="text-right">
                <p className="text-xl font-bold">₹{parseFloat(holding.currentValue || '0').toLocaleString('en-IN')}</p>
                <p className={`text-sm ${parseFloat(holding.returns || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>{parseFloat(holding.returns || '0') >= 0 ? '+' : ''}{holding.returns}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PMS() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("schemes");
  const [selectedStrategy, setSelectedStrategy] = useState("all");
  const [selectedStyle, setSelectedStyle] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: pmsResponse, isLoading } = useQuery<{ schemes: any[]; pagination: any }>({
    queryKey: ["/api/store/pms", { status: selectedStatus, strategy: selectedStrategy !== "all" ? selectedStrategy : undefined, style: selectedStyle !== "all" ? selectedStyle : undefined, search: searchQuery || undefined }],
    refetchInterval: 300000,
  });

  const { data: cartData } = useQuery<any>({ queryKey: ['/api/cart'] });
  const { data: proposalData } = useQuery<any[]>({ queryKey: ['/api/proposals'] });

  const displayData = pmsResponse?.schemes || [];
  const pendingProposals = proposalData?.filter(p => p.status === 'pending' && p.productType === 'pms')?.length || 0;
  const cartCount = cartData?.items?.filter((i: any) => i.productCategory === 'pms')?.length || 0;

  const statistics = {
    totalFunds: pmsResponse?.pagination?.total || displayData.length,
    totalAUM: displayData.reduce((sum: number, fund: any) => sum + (parseFloat(fund.aum || '0') || 0), 0),
    averageReturns: displayData.length > 0 ? displayData.reduce((sum: number, f: any) => sum + (parseFloat(f.return1Y || '0') || 0), 0) / displayData.length : 0,
    activeProviders: new Set(displayData.map((f: any) => f.fundHouseName).filter(Boolean)).size
  };

  if (isLoading) return <div className="min-h-screen bg-finance-light p-8" data-testid="pms-page"><LoadingState variant="card" count={4} /></div>;

  return (
    <div className="min-h-screen bg-finance-light" data-testid="pms-page">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Portfolio Management Services (PMS)</h1>
          <p className="text-muted-foreground text-lg max-w-3xl">Professional portfolio management with customized strategies from SEBI-registered portfolio managers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total PMS Schemes</p><p className="text-3xl font-bold text-purple-600">{statistics.totalFunds}</p></div><Briefcase className="w-10 h-10 text-purple-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total AUM</p><p className="text-3xl font-bold text-green-600">₹{(statistics.totalAUM / 10000000).toFixed(0)} Cr</p></div><IndianRupee className="w-10 h-10 text-green-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Avg. 1Y Returns</p><p className="text-3xl font-bold text-blue-600">+{statistics.averageReturns.toFixed(1)}%</p></div><BarChart3 className="w-10 h-10 text-blue-600" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Active Providers</p><p className="text-3xl font-bold text-amber-600">{statistics.activeProviders}</p></div><Award className="w-10 h-10 text-amber-600" /></div></CardContent></Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-7 mb-6">
            <TabsTrigger value="schemes" data-testid="tab-schemes"><Briefcase className="w-4 h-4 mr-1" />Schemes</TabsTrigger>
            <TabsTrigger value="proposals" data-testid="tab-proposals"><ClipboardList className="w-4 h-4 mr-1" />Proposals{pendingProposals > 0 && <Badge className="ml-1 bg-purple-500 text-white text-xs">{pendingProposals}</Badge>}</TabsTrigger>
            <TabsTrigger value="cart" data-testid="tab-cart"><ShoppingCart className="w-4 h-4 mr-1" />Cart{cartCount > 0 && <Badge className="ml-1 bg-orange-500 text-white text-xs">{cartCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders"><FileText className="w-4 h-4 mr-1" />Orders</TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-sip"><Zap className="w-4 h-4 mr-1" />SIP</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio"><Wallet className="w-4 h-4 mr-1" />Portfolio</TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools"><Calculator className="w-4 h-4 mr-1" />Tools</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="schemes" className="space-y-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px]">
                <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" /><Input placeholder="Search PMS schemes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="search-pms" /></div>
              </div>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Strategy" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  <SelectItem value="largecap">Large Cap</SelectItem>
                  <SelectItem value="midcap">Mid Cap</SelectItem>
                  <SelectItem value="smallcap">Small Cap</SelectItem>
                  <SelectItem value="multicap">Multi-Cap</SelectItem>
                  <SelectItem value="flexicap">Flexi Cap</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="thematic">Thematic</SelectItem>
                  <SelectItem value="quality">Quality</SelectItem>
                  <SelectItem value="momentum">Momentum</SelectItem>
                  <SelectItem value="esg">ESG</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Style" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Styles</SelectItem>
                  <SelectItem value="discretionary">Discretionary</SelectItem>
                  <SelectItem value="non_discretionary">Non-Discretionary</SelectItem>
                  <SelectItem value="advisory">Advisory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayData.map((scheme: any) => (
                <Card key={scheme.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate(`/pms/${scheme.id}`)} data-testid={`pms-scheme-${scheme.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start"><CardTitle className="text-lg">{scheme.name}</CardTitle><Badge variant="outline">{scheme.strategy || 'Multicap'}</Badge></div>
                    <CardDescription>{scheme.fundHouseName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Min Investment</span><span className="font-semibold">₹{(parseFloat(scheme.minInvestment || '5000000') / 100000).toFixed(0)} L</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">1Y Returns</span><span className={`font-semibold ${parseFloat(scheme.return1Y || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>{parseFloat(scheme.return1Y || '0') >= 0 ? '+' : ''}{scheme.return1Y || 'N/A'}%</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">AUM</span><span className="font-semibold">₹{(parseFloat(scheme.aum || '0') / 10000000).toFixed(0)} Cr</span></div>
                      <ExpressInterestButton productId={scheme.id} productType="pms" productName={scheme.name} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="proposals"><ProposalsTab productType={PRODUCT_TYPE} onApprove={() => setActiveTab("cart")} /></TabsContent>
          <TabsContent value="cart"><CartTab productType={PRODUCT_TYPE} onCheckout={() => setActiveTab("orders")} /></TabsContent>
          <TabsContent value="orders"><OrdersTab productType={PRODUCT_TYPE} /></TabsContent>
          
          <TabsContent value="sip">
            <Card className="border-dashed border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30/50">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Zap className="w-16 h-16 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">PMS SIP Coming Soon</h3>
                <p className="text-muted-foreground text-center max-w-md">Systematic Investment Plans for PMS will be available soon. Get notified when it launches.</p>
                <Button className="mt-4" variant="outline">Notify Me</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio"><PortfolioTab productType={PRODUCT_TYPE} /></TabsContent>

          <TabsContent value="tools">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg cursor-pointer" onClick={() => navigate('/calculators')}><CardContent className="p-6 text-center"><Calculator className="w-12 h-12 text-purple-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">Investment Calculator</h3><p className="text-sm text-muted-foreground">Calculate PMS returns</p></CardContent></Card>
              <Card className="hover:shadow-lg cursor-pointer"><CardContent className="p-6 text-center"><PieChart className="w-12 h-12 text-green-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">Risk Assessment</h3><p className="text-sm text-muted-foreground">Evaluate risk tolerance</p></CardContent></Card>
              <Card className="hover:shadow-lg cursor-pointer"><CardContent className="p-6 text-center"><Target className="w-12 h-12 text-blue-600 mx-auto mb-4" /><h3 className="font-semibold text-lg mb-2">Goal Planning</h3><p className="text-sm text-muted-foreground">Plan investment goals</p></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
