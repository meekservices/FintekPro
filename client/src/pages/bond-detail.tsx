import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { 
  ArrowLeft, 
  Building2,
  Shield,
  TrendingUp,
  Calendar,
  IndianRupee,
  Percent,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  FileText,
  BarChart3,
  Star,
  ShoppingCart,
  Download,
  ExternalLink,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUnifiedCart } from "@/contexts/UnifiedCartContext";
import { OneClickBondInvest } from "@/components/OneClickBondInvest";

export default function BondDetailPage() {
  const [, params] = useRoute("/bonds/detail/:isin");
  const [, navigate] = useLocation();
  const isin = params?.isin || "";
  const { toast } = useToast();
  const { addItem: addToUnifiedCart, isAddingItem } = useUnifiedCart();
  
  const [quantity, setQuantity] = useState("1");
  const [orderType, setOrderType] = useState("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const { data: bondResponse, isLoading, error } = useQuery({
    queryKey: ["/api/bonds/detail", isin],
  });

  const bond = (bondResponse as any)?.data || bondResponse;

  const { data: commissionConfig } = useQuery({
    queryKey: ["/api/bonds/commission-rates", bond?.bondType || "corporate"],
    enabled: !!bond?.bondType,
  });

  const { data: documentsResponse, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/bonds/documents", isin],
    enabled: !!isin,
  });

  const documents = (documentsResponse as any)?.data || [];

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest("/api/bonds/orders", {
        method: "POST",
        body: JSON.stringify(orderData),
      });
    },
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your bond order has been submitted for processing.",
      });
      setShowOrderDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stamp duty rates as per Indian Stamp Act 1899 (amended 2019)
  const STAMP_DUTY_RATES: Record<string, { rate: number; isExempt: boolean; reason?: string }> = {
    g_sec: { rate: 0, isExempt: true, reason: 'Government Securities exempt under Section 9' },
    t_bill: { rate: 0, isExempt: true, reason: 'Treasury Bills exempt as Government Securities' },
    sdl: { rate: 0, isExempt: true, reason: 'State Development Loans exempt as Government Securities' },
    sgb: { rate: 0, isExempt: true, reason: 'Sovereign Gold Bonds exempt as RBI-issued securities' },
    corporate: { rate: 0.01, isExempt: false },
    corporate_bond: { rate: 0.01, isExempt: false },
    ncd: { rate: 0.01, isExempt: false },
    debenture: { rate: 0.01, isExempt: false },
    tax_free: { rate: 0.01, isExempt: false },
    infrastructure: { rate: 0.01, isExempt: false },
  };

  const calculateFees = () => {
    if (!bond || !commissionConfig) return null;
    
    const price = parseFloat(limitPrice) || bond.currentPrice || bond.lastPrice || bond.lastTradedPrice || 1000;
    const qty = parseInt(quantity) || 1;
    const orderAmount = price * qty;
    
    const config = commissionConfig as any;
    const brokerageBps = parseFloat(config?.brokerageBps || "100") / 10000;
    const platformFeePercent = parseFloat(config?.platformFeePercent || "1") / 100;
    const gstRate = parseFloat(config?.gstRate || "18") / 100;
    
    const brokerage = orderAmount * brokerageBps;
    const platformFee = orderAmount * platformFeePercent;
    
    // Calculate stamp duty based on bond type
    const bondType = (bond.bondType || bond.type || 'corporate').toLowerCase().replace(/[- ]/g, '_');
    const stampDutyInfo = STAMP_DUTY_RATES[bondType] || STAMP_DUTY_RATES.corporate;
    const stampDutyRate = stampDutyInfo.isExempt ? 0 : stampDutyInfo.rate;
    const stampDuty = (orderAmount * stampDutyRate) / 100;
    
    // GST only on brokerage and platform fee (not on stamp duty)
    const gst = (brokerage + platformFee) * gstRate;
    const total = orderAmount + brokerage + platformFee + stampDuty + gst;
    
    return {
      orderAmount,
      brokerage,
      platformFee,
      stampDuty,
      stampDutyExempt: stampDutyInfo.isExempt,
      stampDutyReason: stampDutyInfo.reason,
      gst,
      total
    };
  };

  const fees = calculateFees();

  const getRatingColor = (rating: string) => {
    if (!rating) return "bg-muted text-muted-foreground";
    if (rating.includes("AAA") || rating === "SOV") return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    if (rating.includes("AA")) return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
    if (rating.includes("A")) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300";
    return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300";
  };

  const handlePlaceOrder = () => {
    if (!bond) return;
    
    const orderData = {
      isin: bond.isin,
      bondType: bond.bondType || bond.type,
      quantity: parseInt(quantity),
      orderType,
      limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
      price: bond.currentPrice || bond.lastPrice || bond.lastTradedPrice,
    };
    
    orderMutation.mutate(orderData);
  };

  const handleAddToCart = async () => {
    if (!bond) return;
    
    const price = parseFloat(limitPrice) || bond.currentPrice || bond.lastPrice || bond.lastTradedPrice || 0;
    const qty = parseInt(quantity) || 1;
    const orderAmount = price * qty;
    
    // Determine if this is NCD or bond based on type
    const bondType = (bond.bondType || bond.type || 'corporate').toLowerCase();
    const isNcd = bondType.includes('ncd') || bondType.includes('debenture');
    const productCategory = isNcd ? 'ncd' : 'bond';
    
    try {
      await addToUnifiedCart({
        bondIsin: isNcd ? undefined : bond.isin,
        ncdIsin: isNcd ? bond.isin : undefined,
        displayName: bond.name || bond.bondName || bond.securityName || bond.issuer || 'Bond Investment',
        amount: orderAmount.toString(),
        quantity: qty,
        productCategory: productCategory,
        source: 'client',
        metadata: {
          isin: bond.isin,
          bondType: bond.bondType || bond.type,
          rating: bond.rating || bond.creditRating,
          yieldToMaturity: bond.yieldToMaturity || bond.ytm,
          faceValue: bond.faceValue,
          maturityDate: bond.maturityDate,
          couponRate: bond.couponRate,
          issuer: bond.issuer,
          orderType,
          unitPrice: price,
        } as Record<string, any>,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/unified-cart"] });
      toast({
        title: "Added to Cart",
        description: `${bond.name || bond.bondName || 'Bond'} added to your cart successfully`,
      });
    } catch (err) {
      console.error("Failed to add to cart:", err);
      toast({
        title: "Error",
        description: "Failed to add to cart. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !bond) {
    return (
      <div className="min-h-screen bg-muted p-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Bond Not Found</h2>
            <p className="text-muted-foreground mb-4">The bond with ISIN {isin} could not be found.</p>
            <Button onClick={() => navigate("/bonds")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Bonds
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bondName = bond.name || bond.bondName || bond.securityName || bond.issuer || "Unknown Bond";
  const currentPrice = bond.currentPrice || bond.lastPrice || bond.lastTradedPrice || 0;
  const yieldValue = bond.yieldToMaturity || bond.ytm || bond.currentYield || bond.indicativeYield || "N/A";

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-foreground">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            className="text-foreground hover:bg-card/20 mb-4"
            onClick={() => navigate("/bonds")}
            data-testid="back-to-bonds"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bonds
          </Button>
          
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl lg:text-3xl font-bold">{bondName}</h1>
                <Badge className={`${getRatingColor(bond.rating || bond.creditRating)} border-0`}>
                  {bond.rating || bond.creditRating || "NR"}
                </Badge>
              </div>
              <p className="text-foreground/80">ISIN: {bond.isin}</p>
              {bond.issuer && <p className="text-foreground/80">Issuer: {bond.issuer}</p>}
              
              <div className="flex flex-wrap gap-2 mt-4">
                {bond.bondType && (
                  <Badge className="bg-card/20 text-foreground border-0">
                    {bond.bondType || bond.type}
                  </Badge>
                )}
                {bond.couponFrequency && (
                  <Badge className="bg-card/20 text-foreground border-0">
                    {bond.couponFrequency} Coupon
                  </Badge>
                )}
                {bond.tradingStatus && (
                  <Badge className="bg-card/20 text-foreground border-0">
                    {bond.tradingStatus}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="bg-card/10 rounded-xl p-6 min-w-[280px]">
              <div className="text-center">
                <p className="text-foreground/70 text-sm">Current Price</p>
                <p className="text-4xl font-bold">₹{currentPrice.toLocaleString()}</p>
                <p className="text-green-300 text-lg mt-1">
                  Yield: {yieldValue}%
                </p>
              </div>
              
              <div className="flex flex-col gap-2 mt-4">
                <OneClickBondInvest 
                  bond={bond} 
                  size="lg" 
                  className="w-full bg-card text-green-600 hover:bg-muted" 
                />
                <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-white text-foreground hover:bg-card/10" size="lg" data-testid="buy-bond-btn">
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Advanced Order
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Place Bond Order</DialogTitle>
                    <DialogDescription>
                      Buy {bondName}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <span className="text-muted-foreground">Bond</span>
                        <span className="font-medium">{bondName}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-muted-foreground">ISIN</span>
                        <span className="font-medium">{bond.isin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Face Value</span>
                        <span className="font-medium">₹{(bond.faceValue || 1000).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="input-quantity"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orderType">Order Type</Label>
                        <Select value={orderType} onValueChange={setOrderType}>
                          <SelectTrigger id="orderType" data-testid="select-order-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="market">Market</SelectItem>
                            <SelectItem value="limit">Limit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {orderType === "limit" && (
                      <div className="space-y-2">
                        <Label htmlFor="limitPrice">Limit Price (₹)</Label>
                        <Input
                          id="limitPrice"
                          type="number"
                          placeholder={`Current: ₹${currentPrice}`}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          data-testid="input-limit-price"
                        />
                      </div>
                    )}
                    
                    {fees && (
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Order Amount</span>
                          <span>₹{fees.orderAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Brokerage (1%)</span>
                          <span>₹{fees.brokerage.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Platform Fee (1%)</span>
                          <span>₹{fees.platformFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            Stamp Duty (0.01%)
                            {fees.stampDutyExempt && (
                              <Badge variant="secondary" className="text-xs px-1 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Exempt</Badge>
                            )}
                          </span>
                          {fees.stampDutyExempt ? (
                            <span className="text-green-600" title={fees.stampDutyReason}>₹0.00</span>
                          ) : (
                            <span>₹{fees.stampDuty.toFixed(2)}</span>
                          )}
                        </div>
                        {fees.stampDutyExempt && (
                          <div className="text-xs text-green-600 italic ml-2">
                            {fees.stampDutyReason}
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">GST (18%)</span>
                          <span>₹{fees.gst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold pt-2 border-t">
                          <span>Total Payable</span>
                          <span className="text-blue-600">₹{fees.total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handlePlaceOrder}
                      disabled={orderMutation.isPending}
                      data-testid="confirm-order-btn"
                    >
                      {orderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                    </Button>
                  </div>
                </DialogContent>
                </Dialog>
                
                <Button 
                  variant="outline"
                  className="w-full border-white text-foreground hover:bg-card/10" 
                  size="lg" 
                  onClick={handleAddToCart}
                  disabled={isAddingItem}
                  data-testid="add-bond-to-cart-btn"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {isAddingItem ? "Adding..." : "Add to Cart"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-4 gap-2">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials">Financials</TabsTrigger>
            <TabsTrigger value="trading" data-testid="tab-trading">Trading Info</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Key Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5" />
                    Key Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Face Value</p>
                      <p className="font-semibold">₹{(bond.faceValue || 1000).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Price</p>
                      <p className="font-semibold">₹{currentPrice.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Issue Date</p>
                      <p className="font-semibold">
                        {bond.issueDate ? new Date(bond.issueDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Maturity Date</p>
                      <p className="font-semibold">
                        {bond.maturityDate ? new Date(bond.maturityDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Credit Rating</p>
                      <Badge className={getRatingColor(bond.rating || bond.creditRating)}>
                        {bond.rating || bond.creditRating || "NR"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rating Agency</p>
                      <p className="font-semibold">{bond.ratingAgency || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Coupon Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Coupon Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Coupon Rate</p>
                      <p className="font-semibold text-green-600">
                        {bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : "Zero Coupon"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Coupon Type</p>
                      <p className="font-semibold">{bond.couponType || "Fixed"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Frequency</p>
                      <p className="font-semibold">{bond.couponFrequency || "Semi-Annual"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Next Coupon Date</p>
                      <p className="font-semibold">
                        {bond.nextCouponDate ? new Date(bond.nextCouponDate).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Yield Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Yield Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Yield to Maturity</p>
                      <p className="font-semibold text-green-600">{yieldValue}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Yield</p>
                      <p className="font-semibold">{bond.currentYield || yieldValue}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">{bond.duration || "N/A"} years</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Modified Duration</p>
                      <p className="font-semibold">{bond.modifiedDuration || "N/A"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Issuer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Issuer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Issuer Name</p>
                      <p className="font-semibold">{bond.issuer || bondName}</p>
                    </div>
                    {bond.segment && (
                      <div>
                        <p className="text-sm text-muted-foreground">Sector/Segment</p>
                        <p className="font-semibold">{bond.segment}</p>
                      </div>
                    )}
                    {bond.securityCode && (
                      <div>
                        <p className="text-sm text-muted-foreground">Security Code</p>
                        <p className="font-semibold">{bond.securityCode}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="financials">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
                <CardDescription>
                  Key financial metrics and risk indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">Valuation</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Face Value</span>
                        <span className="font-medium">₹{(bond.faceValue || 1000).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Price</span>
                        <span className="font-medium">₹{currentPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Premium/Discount</span>
                        <span className={`font-medium ${currentPrice > (bond.faceValue || 1000) ? "text-green-600" : "text-red-600"}`}>
                          {((currentPrice / (bond.faceValue || 1000) - 1) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">Returns</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">YTM</span>
                        <span className="font-medium text-green-600">{yieldValue}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Current Yield</span>
                        <span className="font-medium">{bond.currentYield || yieldValue}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coupon Rate</span>
                        <span className="font-medium">
                          {bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : "Zero Coupon"}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">Risk Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">{bond.duration || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Rating</span>
                        <Badge className={getRatingColor(bond.rating || bond.creditRating)}>
                          {bond.rating || bond.creditRating || "NR"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time to Maturity</span>
                        <span className="font-medium">
                          {bond.maturityDate 
                            ? `${Math.ceil((new Date(bond.maturityDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000))} years`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="trading">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Trading Information
                </CardTitle>
                <CardDescription>
                  Market data and trading activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">Market Data</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Traded Price</span>
                        <span className="font-medium">₹{currentPrice.toLocaleString()}</span>
                      </div>
                      {bond.prevClose && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Previous Close</span>
                          <span className="font-medium">₹{parseFloat(bond.prevClose).toLocaleString()}</span>
                        </div>
                      )}
                      {bond.change !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Change</span>
                          <span className={`font-medium ${parseFloat(bond.change) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {parseFloat(bond.change) >= 0 ? "+" : ""}₹{parseFloat(bond.change).toFixed(2)} 
                            ({parseFloat(bond.changePercent || 0).toFixed(2)}%)
                          </span>
                        </div>
                      )}
                      {bond.volume && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Volume</span>
                          <span className="font-medium">{bond.volume}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold border-b pb-2">Order Book</h4>
                    <div className="space-y-3">
                      {bond.bidPrice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Best Bid</span>
                          <span className="font-medium text-green-600">₹{parseFloat(bond.bidPrice).toLocaleString()}</span>
                        </div>
                      )}
                      {bond.askPrice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Best Ask</span>
                          <span className="font-medium text-red-600">₹{parseFloat(bond.askPrice).toLocaleString()}</span>
                        </div>
                      )}
                      {bond.minimumLotSize && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Minimum Lot Size</span>
                          <span className="font-medium">{bond.minimumLotSize}</span>
                        </div>
                      )}
                      {bond.exchange && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Exchange</span>
                          <Badge variant="outline">{bond.exchange}</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Related Documents
                </CardTitle>
                <CardDescription>
                  Offering documents and disclosures
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="ml-2 text-muted-foreground">Loading documents...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No documents available for this bond</p>
                  </div>
                ) : (
                  <>
                    <div className="grid md:grid-cols-2 gap-4">
                      {documents.map((doc: any) => {
                        const getDocColor = (type: string) => {
                          switch (type) {
                            case 'im': return 'text-blue-600';
                            case 'rating': return 'text-green-600';
                            case 'termsheet': return 'text-purple-600';
                            case 'trustdeed': return 'text-orange-600';
                            case 'annual_report': return 'text-red-600';
                            case 'kid': return 'text-teal-600';
                            case 'notification': return 'text-blue-600';
                            case 'results': return 'text-green-600';
                            case 'factsheet': return 'text-indigo-600';
                            default: return 'text-muted-foreground';
                          }
                        };
                        
                        const getCategoryBadge = (category: string) => {
                          switch (category) {
                            case 'Legal': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
                            case 'Rating': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
                            case 'Product': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
                            case 'Regulatory': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
                            case 'Issuer': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
                            default: return 'bg-muted text-muted-foreground';
                          }
                        };
                        
                        return (
                          <div 
                            key={doc.id} 
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                            data-testid={`document-${doc.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <FileText className={`h-8 w-8 ${getDocColor(doc.type)}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{doc.name}</p>
                                  <Badge className={`text-xs ${getCategoryBadge(doc.category)}`}>
                                    {doc.category}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">{doc.description}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <span>{doc.fileType?.toUpperCase()}</span>
                                  <span>•</span>
                                  <span>{doc.fileSize}</span>
                                  <span>•</span>
                                  <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="ml-2 shrink-0"
                              onClick={() => window.open(doc.url, '_blank')}
                              data-testid={`view-document-${doc.id}`}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                      Documents are sourced from official exchanges and rating agencies. Click to view on source website.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
