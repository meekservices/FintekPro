import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, TrendingUp, Calendar, IndianRupee, Building2, Calculator, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { LoadingState } from "@/components/LoadingState";
import { useMemo } from "react";

// Fee calculation hook for bond orders
interface CommissionConfig {
  bondType: string;
  brokerageBps: number;
  platformFeeFixed: number;
  platformFeePercent: number;
  gstRate: number;
  minFee: number;
  maxFee: number;
}

interface FeeBreakdown {
  principal: number;
  brokerage: number;
  platformFee: number;
  gst: number;
  totalFees: number;
  grandTotal: number;
}

function useCommissionConfig() {
  return useQuery<CommissionConfig[]>({
    queryKey: ["/api/admin/bond-commission"],
    staleTime: 300000, // 5 minutes
  });
}

function calculateFees(amount: number, config: CommissionConfig | undefined): FeeBreakdown {
  if (!config || amount <= 0) {
    return {
      principal: amount || 0,
      brokerage: 0,
      platformFee: 0,
      gst: 0,
      totalFees: 0,
      grandTotal: amount || 0,
    };
  }

  // Calculate brokerage (in basis points, 100 bps = 1%)
  let brokerage = (amount * config.brokerageBps) / 10000;
  
  // Apply min/max limits
  brokerage = Math.max(config.minFee, Math.min(config.maxFee, brokerage));
  
  // Calculate platform fee
  const platformFee = config.platformFeeFixed + (amount * config.platformFeePercent / 100);
  
  // Calculate GST on fees
  const gst = ((brokerage + platformFee) * config.gstRate) / 100;
  
  const totalFees = brokerage + platformFee + gst;
  
  return {
    principal: amount,
    brokerage: Math.round(brokerage * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    grandTotal: Math.round((amount + totalFees) * 100) / 100,
  };
}

// Fee Breakdown Component for order dialogs
function FeeBreakdownDisplay({ 
  amount, 
  bondType,
  commissionData 
}: { 
  amount: number; 
  bondType: string;
  commissionData: CommissionConfig[] | undefined;
}) {
  const config = useMemo(() => {
    if (!commissionData) return undefined;
    return commissionData.find(c => c.bondType === bondType);
  }, [commissionData, bondType]);

  const fees = useMemo(() => calculateFees(amount, config), [amount, config]);

  if (!config) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-xs text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          <span>Fee details will be calculated at checkout</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg space-y-2 text-sm border border-blue-200 dark:border-blue-700">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <Calculator className="h-3 w-3" /> Principal Amount
        </span>
        <span className="font-semibold">₹{fees.principal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Brokerage ({config.brokerageBps} bps)</span>
        <span>₹{fees.brokerage.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Platform Fee</span>
        <span>₹{fees.platformFee.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">GST ({config.gstRate}%)</span>
        <span>₹{fees.gst.toLocaleString()}</span>
      </div>
      <div className="border-t border-blue-200 dark:border-blue-700 pt-2 flex justify-between font-semibold">
        <span>Total Payable</span>
        <span className="text-finance-blue">₹{fees.grandTotal.toLocaleString()}</span>
      </div>
    </div>
  );
}

// Bond Categories Component with Real-time Data
function BondCategoriesSection({ onCategoryClick }: { onCategoryClick?: (categoryId: string) => void }) {
  const { data: bondCategories, isLoading } = useQuery<Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    yieldRange: string;
    minInvestment: string;
    count: number;
    riskLevel: string;
  }>>({
    queryKey: ["/api/bonds/categories"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: liveRates } = useQuery({
    queryKey: ["/api/bonds/live-rates"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !bondCategories) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Bond Categories</h2>
        <LoadingState variant="card" count={4} />
      </section>
    );
  }

  const getIcon = (iconName: string) => {
    const icons = { Shield, TrendingUp, Building2, IndianRupee };
    return icons[iconName as keyof typeof icons] || Shield;
  };

  const handleCategoryClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    } else {
      const sectionId = `section-${categoryId}`;
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Bond Categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {bondCategories.map((category: any) => {
          const IconComponent = getIcon(category.icon);
          return (
            <Card 
              key={category.id} 
              className="hover:shadow-md transition-shadow cursor-pointer hover:border-finance-blue" 
              data-testid={`${category.id}-bonds`}
              onClick={() => handleCategoryClick(category.id)}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 bg-${category.color}-100 rounded-lg flex items-center justify-center mb-4`}>
                  <IconComponent className={`h-6 w-6 text-${category.color === 'blue' ? 'finance-blue' : category.color === 'green' ? 'finance-green' : category.color}-600`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{category.name}</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {category.description}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Yield:</span>
                    <span className="font-semibold text-finance-green">{category.yieldRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Investment:</span>
                    <span className="font-semibold">{category.minInvestment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-semibold text-finance-blue">{category.count} bonds</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center mt-2">
                    {category.riskLevel} Risk
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// Government Securities Display Component
function GovernmentSecurities() {
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const { toast } = useToast();

  const { data: gsecs, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/gsec/auctions"],
  });

  const { data: commissionData } = useCommissionConfig();

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("/api/bonds/trading/gsec/orders", { method: "POST", body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your G-Sec order has been submitted for processing.",
      });
      setSelectedBond(null);
      setBidAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order. Please check your KYC status.",
      });
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (gsecs as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Government Securities</h3>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Shield className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No government securities available for auction</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card key={bond.isin} className="hover:shadow-md transition-shadow" data-testid={`gsec-${bond.isin}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{bond.securityName}</h4>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {bond.securityType}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.indicativeYield}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Coupon</p>
                      <p className="font-semibold">{bond.couponRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Min Investment</p>
                      <p className="font-semibold">₹{bond.minimumBidAmount?.toLocaleString()}</p>
                    </div>
                  </div>

                  {bond.auctionDate && (
                    <p className="text-xs text-gray-500 mt-3">
                      Auction Date: {new Date(bond.auctionDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => !open && setSelectedBond(null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedBond(bond)} size="sm" data-testid={`invest-${bond.isin}`}>
                      Place Bid
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place Non-Competitive Bid</DialogTitle>
                      <DialogDescription>
                        Place your bid for {bond.securityName}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <KYCWarningBanner />

                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Bid Amount (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Min: ${bond.minimumBidAmount}`}
                          value={bidAmount}
                          onChange={(e) => setBidAmount(e.target.value)}
                          data-testid="bid-amount-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Minimum: ₹{bond.minimumBidAmount?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Security:</span>
                          <span className="font-medium">{bond.securityName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Yield:</span>
                          <span className="font-medium text-finance-green">{bond.indicativeYield}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Maturity:</span>
                          <span className="font-medium">{new Date(bond.maturityDate).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {parseFloat(bidAmount) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={parseFloat(bidAmount)} 
                          bondType={bond.securityType === 'g_sec' ? 'g_sec' : bond.securityType === 't_bill' ? 't_bill' : 'sdl'}
                          commissionData={commissionData}
                        />
                      )}

                      <Button
                        className="w-full"
                        onClick={() => {
                          const amount = parseFloat(bidAmount);
                          if (!amount || amount < bond.minimumBidAmount) {
                            toast({
                              variant: "destructive",
                              title: "Invalid Amount",
                              description: `Minimum bid amount is ₹${bond.minimumBidAmount?.toLocaleString()}`,
                            });
                            return;
                          }
                          placeOrderMutation.mutate({
                            isin: bond.isin,
                            bidAmount: amount,
                          });
                        }}
                        disabled={placeOrderMutation.isPending}
                        data-testid="confirm-bid-button"
                      >
                        {placeOrderMutation.isPending ? "Placing Bid..." : "Confirm Bid"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Corporate Bonds Display Component
function CorporateBonds() {
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const { toast } = useToast();

  const { data: corporateBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/corporate"],
  });

  const { data: commissionData } = useCommissionConfig();

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("/api/bonds/trading/corporate/orders", { method: "POST", body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your corporate bond order has been submitted.",
      });
      setSelectedBond(null);
      setQuantity("");
      setLimitPrice("");
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order. Please ensure you have Full KYC.",
      });
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (corporateBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Corporate Bonds</h3>
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No corporate bonds available for trading</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card key={bond.isin} className="hover:shadow-md transition-shadow" data-testid={`corp-bond-${bond.isin}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{bond.issuerName}</h4>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {bond.rating}
                    </Badge>
                    <Badge variant="outline">
                      {bond.bondType}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.currentYield}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Coupon</p>
                      <p className="font-semibold">{bond.couponRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>Last Price: ₹{bond.lastPrice?.toLocaleString()}</span>
                    {bond.accruedInterest && <span>Accrued: ₹{bond.accruedInterest?.toLocaleString()}</span>}
                  </div>
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => !open && setSelectedBond(null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedBond(bond)} size="sm" data-testid={`buy-${bond.isin}`}>
                      Buy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place Corporate Bond Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.issuerName} bonds
                      </DialogDescription>
                    </DialogHeader>
                    
                    <KYCWarningBanner />

                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          placeholder="Number of bonds"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          data-testid="limit-price-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Last traded price: ₹{bond.lastPrice?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estimated Cost:</span>
                          <span className="font-semibold">
                            ₹{((parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Yield:</span>
                          <span className="font-medium text-finance-green">{bond.currentYield}%</span>
                        </div>
                      </div>

                      {(parseFloat(quantity) || 0) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={(parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)}
                          bondType="corporate"
                          commissionData={commissionData}
                        />
                      )}

                      <Button
                        className="w-full"
                        onClick={() => {
                          const qty = parseInt(quantity);
                          const price = parseFloat(limitPrice);
                          if (!qty || qty <= 0) {
                            toast({
                              variant: "destructive",
                              title: "Invalid Quantity",
                              description: "Please enter a valid quantity",
                            });
                            return;
                          }
                          placeOrderMutation.mutate({
                            isin: bond.isin,
                            orderType: "buy",
                            quantity: qty,
                            orderCategory: price ? "limit" : "market",
                            limitPrice: price || bond.lastPrice,
                          });
                        }}
                        disabled={placeOrderMutation.isPending}
                        data-testid="confirm-buy-button"
                      >
                        {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// NCD Bonds Display Component
function NCDBonds() {
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const { toast } = useToast();

  const { data: ncdBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/ncd"],
  });

  const { data: commissionData } = useCommissionConfig();

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("/api/bonds/trading/ncd/orders", { method: "POST", body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your NCD order has been submitted.",
      });
      setSelectedBond(null);
      setQuantity("");
      setLimitPrice("");
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order. Please ensure you have Full KYC.",
      });
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (ncdBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Non-Convertible Debentures (NCDs)</h3>
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No NCDs available for trading currently</p>
            <p className="text-xs text-gray-400 mt-2">Check back during NCD issue periods</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card key={bond.isin} className="hover:shadow-md transition-shadow" data-testid={`ncd-bond-${bond.isin}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{bond.issuerName}</h4>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {bond.rating}
                    </Badge>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">
                      NCD
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.currentYield}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Coupon</p>
                      <p className="font-semibold">{bond.couponRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>Last Price: ₹{bond.lastPrice?.toLocaleString()}</span>
                    {bond.accruedInterest && <span>Accrued: ₹{bond.accruedInterest?.toLocaleString()}</span>}
                  </div>
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => !open && setSelectedBond(null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedBond(bond)} size="sm" data-testid={`buy-ncd-${bond.isin}`}>
                      Buy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place NCD Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.issuerName} NCDs
                      </DialogDescription>
                    </DialogHeader>
                    
                    <KYCWarningBanner />

                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          placeholder="Number of NCDs"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="ncd-quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          data-testid="ncd-limit-price-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Last traded price: ₹{bond.lastPrice?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estimated Cost:</span>
                          <span className="font-semibold">
                            ₹{((parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Yield:</span>
                          <span className="font-medium text-finance-green">{bond.currentYield}%</span>
                        </div>
                      </div>

                      {(parseFloat(quantity) || 0) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={(parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)}
                          bondType="ncd"
                          commissionData={commissionData}
                        />
                      )}

                      <Button
                        className="w-full"
                        onClick={() => {
                          const qty = parseInt(quantity);
                          const price = parseFloat(limitPrice);
                          if (!qty || qty <= 0) {
                            toast({
                              variant: "destructive",
                              title: "Invalid Quantity",
                              description: "Please enter a valid quantity",
                            });
                            return;
                          }
                          placeOrderMutation.mutate({
                            isin: bond.isin,
                            orderType: "buy",
                            quantity: qty,
                            orderCategory: price ? "limit" : "market",
                            limitPrice: price || bond.lastPrice,
                          });
                        }}
                        disabled={placeOrderMutation.isPending}
                        data-testid="confirm-ncd-buy-button"
                      >
                        {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Tax Free Bonds Display Component
function TaxFreeBonds() {
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const { toast } = useToast();

  const { data: taxFreeBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/tax-free"],
  });

  const { data: commissionData } = useCommissionConfig();

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("/api/bonds/trading/tax-free/orders", { method: "POST", body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your tax-free bond order has been submitted.",
      });
      setSelectedBond(null);
      setQuantity("");
      setLimitPrice("");
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order. Please ensure you have Full KYC.",
      });
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (taxFreeBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Tax Free Bonds</h3>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <IndianRupee className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500">No tax-free bonds available in secondary market</p>
            <p className="text-xs text-gray-400 mt-2">Tax-free bonds are available when PSUs issue them</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card key={bond.isin} className="hover:shadow-md transition-shadow" data-testid={`tax-free-bond-${bond.isin}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{bond.issuerName}</h4>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                      {bond.rating}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Tax Free
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Tax-Free Yield</p>
                      <p className="font-semibold text-finance-green">{bond.currentYield}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Coupon</p>
                      <p className="font-semibold">{bond.couponRate}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span>Last Price: ₹{bond.lastPrice?.toLocaleString()}</span>
                    <span className="text-green-600 font-medium">Interest exempt under Section 10(15)</span>
                  </div>
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => !open && setSelectedBond(null)}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedBond(bond)} size="sm" data-testid={`buy-tax-free-${bond.isin}`}>
                      Buy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place Tax-Free Bond Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.issuerName} tax-free bonds - Interest is tax exempt
                      </DialogDescription>
                    </DialogHeader>
                    
                    <KYCWarningBanner />

                    <div className="space-y-4 mt-4">
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          placeholder="Number of bonds"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          data-testid="tax-free-quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                          data-testid="tax-free-limit-price-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Last traded price: ₹{bond.lastPrice?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estimated Cost:</span>
                          <span className="font-semibold">
                            ₹{((parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax-Free Yield:</span>
                          <span className="font-medium text-finance-green">{bond.currentYield}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-700 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Interest income is tax-exempt under Section 10(15)</span>
                        </div>
                      </div>

                      {(parseFloat(quantity) || 0) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={(parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)}
                          bondType="tax_free"
                          commissionData={commissionData}
                        />
                      )}

                      <Button
                        className="w-full"
                        onClick={() => {
                          const qty = parseInt(quantity);
                          const price = parseFloat(limitPrice);
                          if (!qty || qty <= 0) {
                            toast({
                              variant: "destructive",
                              title: "Invalid Quantity",
                              description: "Please enter a valid quantity",
                            });
                            return;
                          }
                          placeOrderMutation.mutate({
                            isin: bond.isin,
                            orderType: "buy",
                            quantity: qty,
                            orderCategory: price ? "limit" : "market",
                            limitPrice: price || bond.lastPrice,
                          });
                        }}
                        disabled={placeOrderMutation.isPending}
                        data-testid="confirm-tax-free-buy-button"
                      >
                        {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Bond Holdings Component
function BondHoldings() {
  const { data: holdings, isLoading } = useQuery({
    queryKey: ["/api/bonds/holdings"],
  });

  if (isLoading) {
    return <LoadingState variant="card" count={1} />;
  }

  const bonds = (holdings as any)?.data || [];

  if (bonds.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bond Holdings</h3>
          <p className="text-gray-500 text-center">
            Your bond investments will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalValue = bonds.reduce((sum: number, bond: any) => sum + (bond.currentValue || 0), 0);
  const totalInvested = bonds.reduce((sum: number, bond: any) => sum + (bond.purchaseValue || 0), 0);
  const totalGain = totalValue - totalInvested;
  const gainPercentage = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">My Bond Holdings</h3>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          {bonds.length} Holdings
        </Badge>
      </div>

      {/* Portfolio Summary */}
      <Card className="bg-gradient-to-br from-finance-blue to-blue-600 text-white">
        <CardContent className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-blue-100 text-sm">Total Value</p>
              <p className="text-2xl font-bold">₹{totalValue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">Invested</p>
              <p className="text-2xl font-bold">₹{totalInvested.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">Returns</p>
              <p className="text-2xl font-bold">
                {gainPercentage > 0 ? '+' : ''}{gainPercentage.toFixed(2)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holdings List */}
      {bonds.map((holding: any) => (
        <Card key={holding.id} data-testid={`holding-${holding.id}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-semibold text-gray-900">{holding.bondName}</h4>
                  <Badge variant="outline">
                    {holding.bondType}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-semibold">{holding.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Current Yield</p>
                    <p className="font-semibold text-finance-green">{holding.currentYield}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Maturity</p>
                    <p className="font-semibold">{new Date(holding.maturityDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Current Value</p>
                    <p className="font-semibold">₹{holding.currentValue?.toLocaleString()}</p>
                  </div>
                </div>

                {holding.nextCouponDate && (
                  <p className="text-xs text-gray-500 mt-3">
                    Next Coupon: {new Date(holding.nextCouponDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">P&L</p>
                <p className={`text-lg font-semibold ${(holding.currentValue - holding.purchaseValue) >= 0 ? 'text-finance-green' : 'text-red-600'}`}>
                  {((holding.currentValue - holding.purchaseValue) >= 0 ? '+' : '')}
                  ₹{(holding.currentValue - holding.purchaseValue).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Bond Orders Component
function BondOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/bonds/orders"],
  });

  if (isLoading) {
    return <div className="mt-6"><LoadingState variant="list" count={1} /></div>;
  }

  const orderList = (orders as any)?.data || [];

  if (orderList.length === 0) {
    return (
      <Card className="border-dashed mt-6">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Clock className="h-10 w-10 text-gray-400 mb-3" />
          <p className="text-gray-500">No recent orders</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'executed': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'executed': return <CheckCircle2 className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'rejected': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
      
      {orderList.map((order: any) => (
        <Card key={order.id} data-testid={`order-${order.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-medium text-gray-900">{order.bondName}</p>
                  <Badge variant="outline" className={getStatusColor(order.status)}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-medium">{order.orderType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Quantity</p>
                    <p className="font-medium">{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-medium">₹{order.orderAmount?.toLocaleString()}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Placed on {new Date(order.orderDate).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Bonds() {
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [bondYield, setBondYield] = useState("");
  const [tenure, setTenure] = useState("");
  
  // Filter state
  const [bondType, setBondType] = useState<string>("");
  const [yieldRange, setYieldRange] = useState<string>("");
  const [tenureFilter, setTenureFilter] = useState<string>("");
  const [ratingFilter, setRatingFilter] = useState<string>("");
  
  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedBonds, setSelectedBonds] = useState<string[]>([]);

  const calculateReturns = () => {
    const principal = parseFloat(investmentAmount) || 0;
    const rate = parseFloat(bondYield) / 100 || 0;
    const years = parseFloat(tenure) || 0;
    
    if (principal && rate && years) {
      const maturityAmount = principal * Math.pow(1 + rate, years);
      const interestEarned = maturityAmount - principal;
      return { maturityAmount, interestEarned };
    }
    return { maturityAmount: 0, interestEarned: 0 };
  };

  const { maturityAmount, interestEarned } = calculateReturns();
  
  // Toggle bond selection for comparison
  const toggleBondSelection = (isin: string) => {
    setSelectedBonds(prev => 
      prev.includes(isin) 
        ? prev.filter(id => id !== isin)
        : prev.length < 3 ? [...prev, isin] : prev
    );
  };
  
  // Clear comparison
  const clearComparison = () => {
    setSelectedBonds([]);
    setCompareMode(false);
  };

  return (
    <div className="space-y-8" data-testid="bonds-page">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="mb-8" data-testid="bonds-header">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bonds & NCDs</h1>
          <p className="text-gray-600 text-lg">
            Fixed income investments with guaranteed returns
          </p>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <ScrollableTabsList>
            <TabsTrigger value="explore" data-testid="tab-explore" className="flex-shrink-0">Explore Bonds</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator" className="flex-shrink-0">Bond Calculator</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio" className="flex-shrink-0">My Bonds</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education" className="flex-shrink-0">Learn</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-bonds">
            
            {/* Filter Section */}
            <div className="p-6 bg-white rounded-xl border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Filter Bonds</h3>
                {compareMode && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50">
                      {selectedBonds.length} selected
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={clearComparison}
                      data-testid="clear-comparison"
                    >
                      Clear
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          disabled={selectedBonds.length < 2}
                          data-testid="compare-bonds-button"
                        >
                          Compare ({selectedBonds.length})
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Bond Comparison</DialogTitle>
                          <DialogDescription>
                            Compare key features of selected bonds
                          </DialogDescription>
                        </DialogHeader>
                        <div className={`grid gap-4 ${
                          selectedBonds.length === 2 ? 'grid-cols-2' : 
                          selectedBonds.length === 3 ? 'grid-cols-3' : 
                          'grid-cols-1'
                        }`}>
                          {/* Comparison will be implemented with actual bond data */}
                          <p className="text-sm text-gray-500">Comparison view coming soon</p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Select value={bondType} onValueChange={setBondType}>
                  <SelectTrigger data-testid="bond-type-select">
                    <SelectValue placeholder="Bond Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bonds</SelectItem>
                    <SelectItem value="government">Government Bonds</SelectItem>
                    <SelectItem value="corporate">Corporate Bonds</SelectItem>
                    <SelectItem value="ncd">NCDs</SelectItem>
                    <SelectItem value="tax-free">Tax Free Bonds</SelectItem>
                    <SelectItem value="sgb">Sovereign Gold Bonds</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure Bonds</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={yieldRange} onValueChange={setYieldRange}>
                  <SelectTrigger data-testid="yield-range-select">
                    <SelectValue placeholder="Yield Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Yields</SelectItem>
                    <SelectItem value="0-5">0% - 5%</SelectItem>
                    <SelectItem value="5-7">5% - 7%</SelectItem>
                    <SelectItem value="7-9">7% - 9%</SelectItem>
                    <SelectItem value="9-12">9% - 12%</SelectItem>
                    <SelectItem value="12+">12%+</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tenureFilter} onValueChange={setTenureFilter}>
                  <SelectTrigger data-testid="tenure-select">
                    <SelectValue placeholder="Tenure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenures</SelectItem>
                    <SelectItem value="0-1">0-1 Year</SelectItem>
                    <SelectItem value="1-2">1-2 Years</SelectItem>
                    <SelectItem value="2-5">2-5 Years</SelectItem>
                    <SelectItem value="5-10">5-10 Years</SelectItem>
                    <SelectItem value="10+">10+ Years</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger data-testid="rating-select">
                    <SelectValue placeholder="Credit Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="AAA">AAA</SelectItem>
                    <SelectItem value="AA">AA+/AA/AA-</SelectItem>
                    <SelectItem value="A">A+/A/A-</SelectItem>
                    <SelectItem value="BBB">BBB+/BBB/BBB-</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant={compareMode ? "default" : "outline"}
                  onClick={() => setCompareMode(!compareMode)}
                  data-testid="toggle-compare-mode"
                  className="w-full"
                >
                  {compareMode ? "Exit Compare" : "Compare Bonds"}
                </Button>
              </div>
            </div>

            {/* Bond Categories - Real-time data */}
            <BondCategoriesSection />

            {/* KYC Warning */}
            <KYCWarningBanner />

            {/* Government Securities */}
            <div id="section-government">
              <GovernmentSecurities />
            </div>

            {/* Corporate Bonds */}
            <div id="section-corporate">
              <CorporateBonds />
            </div>

            {/* NCDs */}
            <div id="section-ncd">
              <NCDBonds />
            </div>

            {/* Tax Free Bonds */}
            <div id="section-tax-free">
              <TaxFreeBonds />
            </div>

          </TabsContent>

          <TabsContent value="calculator" className="space-y-6" data-testid="bond-calculator">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    Bond Returns Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Investment Amount (₹)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="1,00,000" 
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      data-testid="investment-amount"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Annual Yield (%)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="8.5" 
                      value={bondYield}
                      onChange={(e) => setBondYield(e.target.value)}
                      data-testid="bond-yield"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Tenure (Years)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="5" 
                      value={tenure}
                      onChange={(e) => setTenure(e.target.value)}
                      data-testid="bond-tenure"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Returns Projection</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="text-center p-6 bg-blue-50 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Maturity Amount</h3>
                      <p className="text-3xl font-bold text-finance-blue" data-testid="maturity-amount">
                        ₹{maturityAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Principal</h4>
                        <p className="text-lg font-bold text-finance-green" data-testid="principal-amount">
                          ₹{parseFloat(investmentAmount || "0").toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Interest Earned</h4>
                        <p className="text-lg font-bold text-purple-600" data-testid="interest-earned">
                          ₹{interestEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>

                    {investmentAmount && bondYield && tenure && (
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-semibold text-gray-900 mb-2">Investment Summary</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Monthly Interest: ₹{((parseFloat(investmentAmount) * parseFloat(bondYield)) / 100 / 12).toLocaleString()}</p>
                          <p>Annual Interest: ₹{((parseFloat(investmentAmount) * parseFloat(bondYield)) / 100).toLocaleString()}</p>
                          <p>Total Returns: {((interestEarned / parseFloat(investmentAmount)) * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="bonds-portfolio">
            <BondHoldings />
            <BondOrders />
          </TabsContent>

          <TabsContent value="education" className="space-y-6" data-testid="bonds-education">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">What are Bonds?</h3>
                  <p className="text-gray-600 mb-4">
                    Bonds are debt securities where you lend money to an issuer (government or corporation) 
                    for a defined period at a fixed interest rate.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li>• Fixed income with predictable returns</li>
                    <li>• Lower risk compared to equity investments</li>
                    <li>• Regular interest payments</li>
                    <li>• Principal amount returned at maturity</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Benefits of Bond Investment</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-finance-blue mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Capital Protection</h4>
                        <p className="text-sm text-gray-600">Your principal is protected</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IndianRupee className="h-5 w-5 text-finance-green mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Regular Income</h4>
                        <p className="text-sm text-gray-600">Fixed periodic interest payments</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-gray-900">Portfolio Diversification</h4>
                        <p className="text-sm text-gray-600">Reduce overall portfolio risk</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
