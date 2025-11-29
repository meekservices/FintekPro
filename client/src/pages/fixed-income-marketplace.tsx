import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, TrendingUp, Calendar, IndianRupee, Building2, Calculator, 
  AlertCircle, CheckCircle2, Clock, Search, Filter, Star, StarOff,
  Briefcase, Wallet, Bell, FileText, TrendingDown, ArrowRight,
  Landmark, Coins, Receipt, ShieldCheck, Info, ChevronRight, PlusCircle
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { Label } from "@/components/ui/label";

interface Bond {
  id: string;
  isin: string;
  securityName: string;
  issuer: string;
  couponRate: number;
  yieldToMaturity: number | null;
  faceValue: number;
  currentPrice: number | null;
  maturityDate: string;
  securityType: string;
  creditRating: string | null;
  taxStatus: string;
  bondType: 'government' | 'corporate';
  riskLevel: string;
  minInvestment: number;
}

interface NcdIssue {
  id: string;
  issueCode: string;
  issuer: string;
  issueSize: number;
  pricePerNcd: number;
  couponRate: number;
  tenure: number;
  tenureUnit: string;
  creditRating: string;
  issueOpenDate: string;
  issueCloseDate: string;
  allotmentDate: string | null;
  listingDate: string | null;
  listingExchange: string;
  minApplicationAmount: number;
  maxApplicationAmount: number | null;
  interestPaymentFrequency: string;
  status: string;
}

interface SgbIssue {
  id: string;
  seriesName: string;
  tranche: string;
  issueDate: string;
  subscriptionOpenDate: string;
  subscriptionCloseDate: string;
  issuePrice: number;
  goldPriceReference: number;
  maturityDate: string;
  interestRate: number;
  minQuantity: number;
  maxQuantity: number;
  status: string;
}

interface SuitabilityCheck {
  id: string;
  kycVerified: boolean;
  kycLevel: string;
  suitabilityResult: string;
  riskProfile: string;
  notes: string;
  checkedAt: string;
}

function SuitabilityCheckBanner() {
  const { toast } = useToast();
  
  const { data: suitabilityStatus, isLoading } = useQuery<{
    hasSuitability: boolean;
    suitability: SuitabilityCheck | null;
    canTrade: boolean;
  }>({
    queryKey: ['/api/fixed-income/suitability-status'],
  });

  const performCheckMutation = useMutation({
    mutationFn: () => apiRequest('/api/fixed-income/suitability-check', { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Suitability Check Complete",
        description: "Your trading eligibility has been verified.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/suitability-status'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Check Failed",
        description: error.message || "Failed to complete suitability check.",
      });
    }
  });

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (suitabilityStatus?.canTrade) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Eligible to Trade</AlertTitle>
        <AlertDescription className="text-green-700">
          Your suitability check is valid. Risk Profile: {suitabilityStatus.suitability?.riskProfile || 'Standard'}
        </AlertDescription>
      </Alert>
    );
  }

  if (suitabilityStatus?.hasSuitability && suitabilityStatus?.suitability?.suitabilityResult === 'rejected') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Trading Restricted</AlertTitle>
        <AlertDescription>
          {suitabilityStatus.suitability?.notes || 'Please complete your KYC to enable trading.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800">Suitability Check Required</AlertTitle>
      <AlertDescription className="text-amber-700 flex items-center justify-between">
        <span>Complete a suitability assessment to start trading fixed income securities.</span>
        <Button 
          size="sm" 
          onClick={() => performCheckMutation.mutate()}
          disabled={performCheckMutation.isPending}
          data-testid="btn-suitability-check"
        >
          {performCheckMutation.isPending ? "Checking..." : "Run Check"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function PortfolioSummaryCard() {
  const { data: summary, isLoading } = useQuery<{
    totalInvested: number;
    currentValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    totalCouponsReceived: number;
    pendingCoupons: number;
    holdingsCount: number;
    avgYield: number;
    avgMaturity: number;
  }>({
    queryKey: ['/api/fixed-income/portfolio-summary'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.holdingsCount === 0) {
    return (
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100">
              <Briefcase className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Start Your Fixed Income Portfolio</h3>
              <p className="text-gray-600 text-sm">Explore bonds, NCDs, and government securities to build stable returns.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-emerald-600" />
          Portfolio Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Invested</p>
            <p className="text-lg font-bold text-gray-900">₹{(summary.totalInvested / 100000).toFixed(2)}L</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Current Value</p>
            <p className="text-lg font-bold text-gray-900">₹{(summary.currentValue / 100000).toFixed(2)}L</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Unrealized P&L</p>
            <p className={`text-lg font-bold ${summary.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.unrealizedPnL >= 0 ? '+' : ''}₹{Math.abs(summary.unrealizedPnL).toLocaleString()}
              <span className="text-xs ml-1">({summary.unrealizedPnLPercent.toFixed(2)}%)</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Avg Yield</p>
            <p className="text-lg font-bold text-emerald-600">{summary.avgYield.toFixed(2)}%</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-200">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{summary.holdingsCount}</p>
            <p className="text-xs text-gray-500">Holdings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">₹{summary.totalCouponsReceived.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Coupons Received</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">₹{summary.pendingCoupons.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Pending Coupons</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BondCard({ bond, onSelect, isWatchlisted, onToggleWatchlist }: { 
  bond: Bond; 
  onSelect: (bond: Bond) => void;
  isWatchlisted: boolean;
  onToggleWatchlist: (bond: Bond) => void;
}) {
  const getRatingColor = (rating: string | null) => {
    if (!rating) return 'bg-gray-100 text-gray-700';
    if (rating.startsWith('AAA')) return 'bg-green-100 text-green-700';
    if (rating.startsWith('AA')) return 'bg-emerald-100 text-emerald-700';
    if (rating.startsWith('A')) return 'bg-blue-100 text-blue-700';
    if (rating.startsWith('BBB')) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  const getBondTypeIcon = () => {
    if (bond.bondType === 'government') return <Landmark className="h-5 w-5 text-blue-600" />;
    return <Building2 className="h-5 w-5 text-purple-600" />;
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group"
      data-testid={`bond-card-${bond.isin}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {getBondTypeIcon()}
            <div>
              <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{bond.securityName}</h4>
              <p className="text-xs text-gray-500">{bond.issuer}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchlist(bond);
            }}
            data-testid={`watchlist-toggle-${bond.isin}`}
          >
            {isWatchlisted ? (
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="h-4 w-4 text-gray-400 group-hover:text-amber-500" />
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className={getRatingColor(bond.creditRating)}>
            {bond.creditRating || 'Unrated'}
          </Badge>
          <Badge variant="outline" className="bg-slate-50">
            {bond.securityType}
          </Badge>
          {bond.taxStatus === 'tax_free' && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Tax Free
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p className="text-gray-500 text-xs">Coupon Rate</p>
            <p className="font-semibold text-gray-900">{bond.couponRate}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">YTM</p>
            <p className="font-semibold text-emerald-600">{bond.yieldToMaturity?.toFixed(2) || '-'}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Price</p>
            <p className="font-semibold">₹{bond.currentPrice?.toLocaleString() || bond.faceValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Maturity</p>
            <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="text-xs">
            <span className="text-gray-500">Min: </span>
            <span className="font-semibold">₹{bond.minInvestment.toLocaleString()}</span>
          </div>
          <Button 
            size="sm" 
            onClick={() => onSelect(bond)}
            data-testid={`btn-invest-${bond.isin}`}
          >
            Invest <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NcdIssueCard({ issue, onApply }: { issue: NcdIssue; onApply: (issue: NcdIssue) => void }) {
  const isOpen = issue.status === 'open';
  const daysLeft = isOpen ? Math.ceil((new Date(issue.issueCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Card className="hover:shadow-lg transition-all" data-testid={`ncd-card-${issue.issueCode}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{issue.issuer}</CardTitle>
            <CardDescription>{issue.issueCode}</CardDescription>
          </div>
          <Badge variant={isOpen ? "default" : "secondary"} className={isOpen ? "bg-green-600" : ""}>
            {isOpen ? `${daysLeft} days left` : issue.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Coupon Rate</p>
            <p className="font-bold text-lg text-emerald-600">{issue.couponRate}%</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Tenure</p>
            <p className="font-semibold">{issue.tenure} {issue.tenureUnit}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Issue Size</p>
            <p className="font-semibold">₹{(issue.issueSize / 10000000).toFixed(0)} Cr</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Rating</p>
            <Badge variant="outline" className="bg-green-50 text-green-700">{issue.creditRating}</Badge>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="text-xs">
            <span className="text-gray-500">Min Application: </span>
            <span className="font-semibold">₹{issue.minApplicationAmount.toLocaleString()}</span>
          </div>
          <Button 
            size="sm" 
            disabled={!isOpen}
            onClick={() => onApply(issue)}
            data-testid={`btn-apply-ncd-${issue.issueCode}`}
          >
            Apply Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SgbIssueCard({ issue, onApply }: { issue: SgbIssue; onApply: (issue: SgbIssue) => void }) {
  const isOpen = issue.status === 'open';
  const daysLeft = isOpen ? Math.ceil((new Date(issue.subscriptionCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <Card className="hover:shadow-lg transition-all bg-gradient-to-br from-amber-50 to-yellow-50" data-testid={`sgb-card-${issue.seriesName}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-amber-100">
              <Coins className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">{issue.seriesName}</CardTitle>
              <CardDescription>Tranche: {issue.tranche}</CardDescription>
            </div>
          </div>
          <Badge variant={isOpen ? "default" : "secondary"} className={isOpen ? "bg-amber-600" : ""}>
            {isOpen ? `${daysLeft} days left` : issue.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Issue Price</p>
            <p className="font-bold text-lg">₹{issue.issuePrice.toLocaleString()}/gm</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Interest Rate</p>
            <p className="font-semibold text-emerald-600">{issue.interestRate}% p.a.</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Gold Reference</p>
            <p className="font-semibold">₹{issue.goldPriceReference.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Maturity</p>
            <p className="font-semibold">{new Date(issue.maturityDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="text-xs">
            <span className="text-gray-500">Qty: </span>
            <span className="font-semibold">{issue.minQuantity} - {issue.maxQuantity} grams</span>
          </div>
          <Button 
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            disabled={!isOpen}
            onClick={() => onApply(issue)}
            data-testid={`btn-apply-sgb-${issue.seriesName}`}
          >
            Subscribe
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BondOrderDialog({ 
  bond, 
  open, 
  onClose 
}: { 
  bond: Bond | null; 
  open: boolean; 
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState('');

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest('/api/fixed-income/orders', { method: 'POST', body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your bond order has been submitted.",
      });
      onClose();
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/holdings'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Order Failed",
        description: error.message || "Failed to place order.",
      });
    }
  });

  if (!bond) return null;

  const unitPrice = bond.currentPrice || bond.faceValue;
  const totalAmount = quantity * unitPrice;

  const handleSubmit = () => {
    placeOrderMutation.mutate({
      bondId: bond.id,
      bondType: bond.bondType,
      orderType: 'buy',
      priceType: orderType,
      quantity,
      price: orderType === 'limit' ? parseFloat(limitPrice) : unitPrice,
      settlementType: 'T+1',
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place Order</DialogTitle>
          <DialogDescription>{bond.securityName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-sm">
            <div>
              <p className="text-gray-500">ISIN</p>
              <p className="font-semibold">{bond.isin}</p>
            </div>
            <div>
              <p className="text-gray-500">Coupon</p>
              <p className="font-semibold">{bond.couponRate}%</p>
            </div>
            <div>
              <p className="text-gray-500">YTM</p>
              <p className="font-semibold text-emerald-600">{bond.yieldToMaturity?.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-500">Unit Price</p>
              <p className="font-semibold">₹{unitPrice.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Order Type</Label>
            <Select value={orderType} onValueChange={(v) => setOrderType(v as any)}>
              <SelectTrigger data-testid="select-order-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">Market Order</SelectItem>
                <SelectItem value="limit">Limit Order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {orderType === 'limit' && (
            <div className="space-y-2">
              <Label>Limit Price (₹)</Label>
              <Input 
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="Enter limit price"
                data-testid="input-limit-price"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Quantity</Label>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                data-testid="btn-qty-decrease"
              >-</Button>
              <Input 
                type="number" 
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center"
                data-testid="input-quantity"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                data-testid="btn-qty-increase"
              >+</Button>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-center text-lg font-semibold">
            <span>Total Amount</span>
            <span className="text-emerald-600">₹{totalAmount.toLocaleString()}</span>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Settlement: T+1. Securities will be credited to your demat account post settlement.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-order">
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={placeOrderMutation.isPending}
            data-testid="btn-confirm-order"
          >
            {placeOrderMutation.isPending ? "Placing..." : "Confirm Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BondsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [bondType, setBondType] = useState<string>('all');
  const [creditRating, setCreditRating] = useState<string>('all');
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const { toast } = useToast();

  const { data: bondsData, isLoading } = useQuery<{
    bonds: Bond[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ['/api/fixed-income/bonds', bondType, creditRating],
  });

  const { data: watchlist } = useQuery<Array<{ bondId: string }>>({
    queryKey: ['/api/fixed-income/watchlist'],
  });

  const watchlistIds = useMemo(() => 
    new Set(watchlist?.map(w => w.bondId) || []), 
    [watchlist]
  );

  const addToWatchlistMutation = useMutation({
    mutationFn: (bond: Bond) => apiRequest('/api/fixed-income/watchlist', { 
      method: 'POST',
      body: JSON.stringify({ bondId: bond.id, bondType: bond.bondType, isin: bond.isin }) 
    }),
    onSuccess: () => {
      toast({ title: "Added to Watchlist" });
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/watchlist'] });
    }
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: (watchlistId: string) => apiRequest(`/api/fixed-income/watchlist/${watchlistId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({ title: "Removed from Watchlist" });
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/watchlist'] });
    }
  });

  const handleToggleWatchlist = (bond: Bond) => {
    if (watchlistIds.has(bond.id)) {
      const item = watchlist?.find(w => w.bondId === bond.id);
      if (item) removeFromWatchlistMutation.mutate((item as any).id);
    } else {
      addToWatchlistMutation.mutate(bond);
    }
  };

  const filteredBonds = useMemo(() => {
    if (!bondsData?.bonds) return [];
    return bondsData.bonds.filter(bond => {
      const matchesSearch = !searchTerm || 
        bond.securityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bond.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bond.isin.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [bondsData?.bonds, searchTerm]);

  if (isLoading) {
    return <LoadingState variant="card" count={6} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, issuer, or ISIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-bond-search"
          />
        </div>
        <Select value={bondType} onValueChange={setBondType}>
          <SelectTrigger className="w-[160px]" data-testid="select-bond-type">
            <SelectValue placeholder="Bond Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="government">Government</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={creditRating} onValueChange={setCreditRating}>
          <SelectTrigger className="w-[160px]" data-testid="select-credit-rating">
            <SelectValue placeholder="Credit Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="AAA">AAA</SelectItem>
            <SelectItem value="AA">AA+/AA/AA-</SelectItem>
            <SelectItem value="A">A+/A/A-</SelectItem>
            <SelectItem value="BBB">BBB & Below</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredBonds.length === 0 ? (
        <EmptyState 
          icon={Briefcase}
          title="No bonds found"
          description="Try adjusting your filters or search term"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBonds.map(bond => (
            <BondCard
              key={bond.id}
              bond={bond}
              onSelect={setSelectedBond}
              isWatchlisted={watchlistIds.has(bond.id)}
              onToggleWatchlist={handleToggleWatchlist}
            />
          ))}
        </div>
      )}

      <BondOrderDialog 
        bond={selectedBond}
        open={!!selectedBond}
        onClose={() => setSelectedBond(null)}
      />
    </div>
  );
}

function NcdTab() {
  const [selectedIssue, setSelectedIssue] = useState<NcdIssue | null>(null);
  const [status, setStatus] = useState('open');
  
  const { data: issues, isLoading } = useQuery<NcdIssue[]>({
    queryKey: ['/api/fixed-income/ncd-issues', status],
  });

  if (isLoading) {
    return <LoadingState variant="card" count={4} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Public NCD Issues</h3>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]" data-testid="select-ncd-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!issues || issues.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={`No ${status} NCD issues`}
          description={status === 'open' ? "Check upcoming issues for new opportunities" : "New issues will appear here when announced"}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.map(issue => (
            <NcdIssueCard 
              key={issue.id} 
              issue={issue}
              onApply={setSelectedIssue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SgbTab() {
  const [status, setStatus] = useState('open');
  
  const { data: issues, isLoading } = useQuery<SgbIssue[]>({
    queryKey: ['/api/fixed-income/sgb-issues', status],
  });

  if (isLoading) {
    return <LoadingState variant="card" count={4} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-semibold">Sovereign Gold Bonds</h3>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]" data-testid="select-sgb-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Alert className="bg-amber-50 border-amber-200">
        <Coins className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">About Sovereign Gold Bonds</AlertTitle>
        <AlertDescription className="text-amber-700 text-sm">
          SGBs are government securities denominated in grams of gold. They offer interest of 2.5% p.a. and capital gains are tax-free on redemption.
        </AlertDescription>
      </Alert>

      {!issues || issues.length === 0 ? (
        <EmptyState
          icon={Coins}
          title={`No ${status} SGB issues`}
          description="RBI announces new SGB series periodically"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {issues.map(issue => (
            <SgbIssueCard 
              key={issue.id}
              issue={issue}
              onApply={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HoldingsTab() {
  const { data: holdings, isLoading } = useQuery<Array<{
    id: string;
    bondId: string;
    bondType: string;
    isin: string;
    securityName: string;
    quantity: number;
    averagePrice: number;
    currentValue: number;
    unrealizedPnL: number;
    couponRate: number;
    nextCouponDate: string | null;
    maturityDate: string;
  }>>({
    queryKey: ['/api/fixed-income/holdings'],
  });

  if (isLoading) {
    return <LoadingState variant="list" count={5} />;
  }

  if (!holdings || holdings.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No holdings yet"
        description="Your fixed income holdings will appear here after you make your first investment"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Your Holdings</h3>
        <Badge variant="outline">{holdings.length} Securities</Badge>
      </div>

      <div className="space-y-3">
        {holdings.map(holding => (
          <Card key={holding.id} data-testid={`holding-${holding.isin}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{holding.securityName}</h4>
                  <p className="text-sm text-gray-500">{holding.isin}</p>
                </div>
                <Badge variant="outline" className={holding.unrealizedPnL >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                  {holding.unrealizedPnL >= 0 ? '+' : ''}₹{holding.unrealizedPnL.toLocaleString()}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Qty</p>
                  <p className="font-semibold">{holding.quantity}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Avg Price</p>
                  <p className="font-semibold">₹{holding.averagePrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Current Value</p>
                  <p className="font-semibold">₹{holding.currentValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Coupon</p>
                  <p className="font-semibold text-emerald-600">{holding.couponRate}%</p>
                </div>
              </div>
              {holding.nextCouponDate && (
                <div className="mt-3 pt-3 border-t flex items-center text-sm text-gray-600">
                  <Calendar className="h-4 w-4 mr-2" />
                  Next Coupon: {new Date(holding.nextCouponDate).toLocaleDateString('en-IN')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WatchlistTab() {
  const { data: watchlist, isLoading } = useQuery<Array<{
    id: string;
    bondId: string;
    bondType: string;
    isin: string;
    addedAt: string;
  }>>({
    queryKey: ['/api/fixed-income/watchlist'],
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/fixed-income/watchlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fixed-income/watchlist'] });
    }
  });

  if (isLoading) {
    return <LoadingState variant="list" count={3} />;
  }

  if (!watchlist || watchlist.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="Your watchlist is empty"
        description="Add bonds to your watchlist to track them easily"
      />
    );
  }

  return (
    <div className="space-y-3">
      {watchlist.map(item => (
        <Card key={item.id} data-testid={`watchlist-item-${item.isin}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold">{item.isin}</p>
              <p className="text-sm text-gray-500">Added {new Date(item.addedAt).toLocaleDateString()}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => removeMutation.mutate(item.id)}
              data-testid={`btn-remove-watchlist-${item.isin}`}
            >
              Remove
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function FixedIncomeMarketplace() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fixed Income Marketplace</h1>
          <p className="text-gray-600">Browse and invest in bonds, NCDs, G-Secs, and Sovereign Gold Bonds</p>
        </div>
        <Button variant="outline" className="gap-2" data-testid="btn-calculator">
          <Calculator className="h-4 w-4" />
          Yield Calculator
        </Button>
      </div>

      <KYCWarningBanner />
      <SuitabilityCheckBanner />
      <PortfolioSummaryCard />

      <Tabs defaultValue="bonds" className="w-full">
        <ScrollableTabsList>
          <TabsTrigger value="bonds" data-testid="tab-bonds">
            <Landmark className="h-4 w-4 mr-2" />
            Bonds
          </TabsTrigger>
          <TabsTrigger value="ncd" data-testid="tab-ncd">
            <Receipt className="h-4 w-4 mr-2" />
            NCDs
          </TabsTrigger>
          <TabsTrigger value="sgb" data-testid="tab-sgb">
            <Coins className="h-4 w-4 mr-2" />
            SGBs
          </TabsTrigger>
          <TabsTrigger value="holdings" data-testid="tab-holdings">
            <Briefcase className="h-4 w-4 mr-2" />
            Holdings
          </TabsTrigger>
          <TabsTrigger value="watchlist" data-testid="tab-watchlist">
            <Star className="h-4 w-4 mr-2" />
            Watchlist
          </TabsTrigger>
        </ScrollableTabsList>

        <div className="mt-6">
          <TabsContent value="bonds">
            <BondsTab />
          </TabsContent>
          <TabsContent value="ncd">
            <NcdTab />
          </TabsContent>
          <TabsContent value="sgb">
            <SgbTab />
          </TabsContent>
          <TabsContent value="holdings">
            <HoldingsTab />
          </TabsContent>
          <TabsContent value="watchlist">
            <WatchlistTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
