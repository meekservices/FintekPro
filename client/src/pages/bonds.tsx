import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield as LucideShield, TrendingUp, Calendar, IndianRupee, Building2, Calculator, AlertCircle, CheckCircle2, Clock, ChevronRight, Database } from "lucide-react";
import { ClientTransactionHistory } from "@/components/store/ClientTransactionHistory";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrderGuard } from "@/hooks/use-order-guard";
import { OrderBlocker } from "@/components/OrderBlocker";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { LoadingState } from "@/components/LoadingState";
import { useMemo } from "react";
import { 
  EnhancedBondFilters, 
  MaturityLadderView, 
  BondComparisonTable,
  KYCTierBadge,
  EligibilityBadge,
  DataFreshnessIndicator,
  NetYieldDisplay,
  SuitabilityScore,
  WatchlistButton,
  AlertButton,
  RiskDisclosureModal,
  useEnhancedBondMarketplace
} from "@/components/BondMarketplaceEnhancements";
import { InvestorClassificationCard, TransactionCostCalculator } from "@/components/regulatory/InvestorClassificationCard";
import { BondCalendar } from "@/components/BondCalendar";
import { OneClickBondInvest } from "@/components/OneClickBondInvest";

// Fee calculation hook for bond orders
interface CommissionConfig {
  bondType: string;
  brokerageBps: number;
  platformFeeFixed: number;
  platformFeePercent: number;
  gstRate: number;
  minFee: number;
  maxFee: number;
  stampDutyBps?: number;
}

interface FeeBreakdown {
  principal: number;
  brokerage: number;
  platformFee: number;
  stampDuty: number;
  stampDutyExempt: boolean;
  stampDutyReason?: string;
  gst: number;
  totalFees: number;
  grandTotal: number;
}

// Credit rating color utility for consistent badge styling
const getCreditRatingColors = (rating: string | null | undefined): string => {
  if (!rating) return 'bg-muted text-muted-foreground border-border';
  const r = rating.toUpperCase();
  if (r === 'SOV' || r === 'AAA') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
  if (r.startsWith('AA')) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
  if (r.startsWith('A')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  if (r.startsWith('BBB')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
  if (r.startsWith('BB') || r.startsWith('B')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
  if (r.startsWith('C') || r.startsWith('D')) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
  return 'bg-muted text-muted-foreground border-border';
};

// Bond type display colors (includes border for outline badges)
const getBondTypeColors = (type: string | null | undefined): string => {
  if (!type) return 'bg-muted text-muted-foreground border-border';
  const t = type.toLowerCase();
  if (t.includes('gsec') || t.includes('government')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
  if (t.includes('corporate')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  if (t.includes('ncd')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
  if (t.includes('tax') && t.includes('free')) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
  if (t.includes('infrastructure')) return 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800';
  if (t.includes('sgb') || t.includes('gold')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
  if (t.includes('sdl') || t.includes('state')) return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
  if (t.includes('debenture')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  if (t.includes('perpetual')) return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
  if (t.includes('floating')) return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
  if (t.includes('zero')) return 'bg-muted text-muted-foreground border-border';
  return 'bg-muted text-muted-foreground border-border';
};

// Risk level colors (includes border for outline badges)
const getRiskLevelColors = (level: string | null | undefined): string => {
  if (!level) return 'bg-muted text-muted-foreground border-border';
  const l = level.toLowerCase();
  if (l.includes('low') || l === 'conservative') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
  if (l.includes('medium') || l.includes('moderate') || l === 'balanced') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
  if (l.includes('high') || l === 'aggressive') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
  return 'bg-muted text-muted-foreground border-border';
};

// Stamp duty rates as per Indian Stamp Act 1899 (amended 2019)
const STAMP_DUTY_RATES: Record<string, { rate: number; isExempt: boolean; reason?: string; payerSide: string }> = {
  g_sec: { rate: 0, isExempt: true, reason: 'Government Securities exempt under Section 9', payerSide: 'buyer' },
  t_bill: { rate: 0, isExempt: true, reason: 'Treasury Bills exempt as Government Securities', payerSide: 'buyer' },
  sdl: { rate: 0, isExempt: true, reason: 'State Development Loans exempt as Government Securities', payerSide: 'buyer' },
  sgb: { rate: 0, isExempt: true, reason: 'Sovereign Gold Bonds exempt as RBI-issued securities', payerSide: 'buyer' },
  corporate: { rate: 0.01, isExempt: false, payerSide: 'transferor' }, // 0.0001%
  ncd: { rate: 0.01, isExempt: false, payerSide: 'transferor' }, // 0.0001%
  tax_free: { rate: 0.01, isExempt: false, payerSide: 'transferor' }, // 0.0001%
  infrastructure: { rate: 0.01, isExempt: false, payerSide: 'transferor' }, // 0.0001%
  unlisted_shares: { rate: 1.5, isExempt: false, payerSide: 'seller' }, // 0.015%
};

function useCommissionConfig() {
  return useQuery<CommissionConfig[]>({
    queryKey: ["/api/admin/bond-commission"],
    staleTime: 300000, // 5 minutes
  });
}

function calculateFees(amount: number, config: CommissionConfig | undefined, bondType?: string): FeeBreakdown {
  if (!config || amount <= 0) {
    return {
      principal: amount || 0,
      brokerage: 0,
      platformFee: 0,
      stampDuty: 0,
      stampDutyExempt: false,
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
  
  // Calculate stamp duty based on product type (regulatory rates)
  const stampDutyInfo = bondType ? STAMP_DUTY_RATES[bondType] : undefined;
  const isExempt = stampDutyInfo?.isExempt ?? false;
  const stampDutyRate = isExempt ? 0 : (stampDutyInfo?.rate ?? 0);
  const stampDuty = (amount * stampDutyRate) / 10000; // Rate is in basis points
  
  // Calculate GST on fees (stamp duty is not subject to GST)
  const gst = ((brokerage + platformFee) * config.gstRate) / 100;
  
  const totalFees = brokerage + platformFee + gst + stampDuty;
  
  return {
    principal: amount,
    brokerage: Math.round(brokerage * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    stampDuty: Math.round(stampDuty * 100) / 100,
    stampDutyExempt: isExempt,
    stampDutyReason: isExempt ? stampDutyInfo?.reason : undefined,
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

  const fees = useMemo(() => calculateFees(amount, config, bondType), [amount, config, bondType]);
  const stampDutyInfo = STAMP_DUTY_RATES[bondType];

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
        <span className="text-muted-foreground flex items-center gap-1">
          <Calculator className="h-3 w-3" /> Principal Amount
        </span>
        <span className="font-semibold">₹{fees.principal.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Brokerage ({config.brokerageBps} bps)</span>
        <span>₹{fees.brokerage.toLocaleString()}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Platform Fee</span>
        <span>₹{fees.platformFee.toLocaleString()}</span>
      </div>
      
      {/* Stamp Duty Section */}
      <div className="flex justify-between text-xs items-center">
        <span className="text-muted-foreground flex items-center gap-1">
          Stamp Duty
          {fees.stampDutyExempt && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
              Exempt
            </span>
          )}
          {!fees.stampDutyExempt && stampDutyInfo && (
            <span className="text-muted-foreground">({stampDutyInfo.rate} bps)</span>
          )}
        </span>
        <span className={fees.stampDutyExempt ? "text-green-600 dark:text-green-400" : ""}>
          {fees.stampDutyExempt ? "₹0.00" : `₹${fees.stampDuty.toLocaleString()}`}
        </span>
      </div>
      {fees.stampDutyExempt && fees.stampDutyReason && (
        <div className="text-[10px] text-green-600 dark:text-green-400 italic pl-2">
          {fees.stampDutyReason}
        </div>
      )}
      
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">GST ({config.gstRate}%)</span>
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
  const [, navigate] = useLocation();
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
        <h2 className="text-2xl font-bold text-foreground mb-6">Bond Categories</h2>
        <LoadingState variant="card" count={4} />
      </section>
    );
  }

  const getIcon = (iconName: string) => {
    const icons = { Shield, TrendingUp, Building2, IndianRupee };
    return icons[iconName as keyof typeof icons] || Shield;
  };

  const getCategoryColors = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600', border: 'border-blue-200 dark:border-blue-800' },
      green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600', border: 'border-green-200 dark:border-green-800' },
      purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600', border: 'border-purple-200 dark:border-purple-800' },
      orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600', border: 'border-orange-200 dark:border-orange-800' },
      indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600', border: 'border-indigo-200 dark:border-indigo-800' },
      teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600', border: 'border-teal-200 dark:border-teal-800' },
      amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600', border: 'border-amber-200 dark:border-amber-800' },
      rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600', border: 'border-rose-200 dark:border-rose-800' },
    };
    return colorMap[color] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
  };

  const handleCategoryClick = (categoryId: string) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    } else {
      navigate(`/bonds/category/${categoryId}`);
    }
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground mb-6">Bond Categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {bondCategories.map((category: any) => {
          const IconComponent = getIcon(category.icon);
          const colors = getCategoryColors(category.color);
          return (
            <Card 
              key={category.id} 
              className={`hover:shadow-lg transition-all cursor-pointer hover:border-finance-blue group ${colors.border}`}
              data-testid={`${category.id}-bonds`}
              onClick={() => handleCategoryClick(category.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center mb-4`}>
                    <IconComponent className={`h-6 w-6 ${colors.text}`} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-finance-blue transition-colors" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{category.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">
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
                  <Badge variant="outline" className={`w-full justify-center mt-2 ${getRiskLevelColors(category.riskLevel)}`}>
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

// Eligibility Summary Hook for bond sections
function useEligibilitySummary() {
  return useQuery<{
    currentTier: string;
    tierDisplayName: string;
    eligibleCategories: Array<{ id: string; name: string; tier: string }>;
    restrictedCategories: Array<{ id: string; name: string; tier: string; requiredTier: string }>;
    nextTier: string | null;
    upgradeUrl: string;
  }>({
    queryKey: ['/api/bonds/my-eligibility-summary'],
    staleTime: 300000,
  });
}

// Government Securities Display Component
function GovernmentSecurities() {
  const [selectedBond, setSelectedBond] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [orderError, setOrderError] = useState<any>(null);
  const [showRiskDisclosure, setShowRiskDisclosure] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const orderGuard = useOrderGuard();

  const { data: gsecs, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/gsec/auctions"],
  });

  const { data: commissionData } = useCommissionConfig();
  const { data: eligibilitySummary } = useEligibilitySummary();
  
  // Government securities eligibility - check for gsec, t_bill, sdl, or sgb
  const govtSecurityIds = ['gsec', 't_bill', 'sdl', 'sgb'];
  const isGSecEligible = eligibilitySummary?.eligibleCategories?.some(c => govtSecurityIds.includes(c.id)) ?? false;

  const riskAttestMutation = useMutation({
    mutationFn: (attestData: any) => apiRequest("/api/bonds/risk-attestation", { method: "POST", body: JSON.stringify(attestData) }),
    onSuccess: () => {
      setRiskAcknowledged(true);
      setShowRiskDisclosure(false);
      toast({
        title: "Risk Disclosures Acknowledged",
        description: "You can now proceed with your order.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Attestation Failed",
        description: "Failed to record risk acknowledgment. Please try again.",
      });
    },
  });

  const placeOrderMutation = useMutation({
    mutationFn: (orderData: any) => apiRequest("/api/bonds/trading/gsec/orders", { method: "POST", body: JSON.stringify(orderData) }),
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: "Your G-Sec order has been submitted for processing.",
      });
      setSelectedBond(null);
      setBidAmount("");
      setRiskAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      const parsedError = orderGuard.handleError(error, false);
      setOrderError(parsedError);
    },
  });
  
  const handleRiskAttest = (bond: any) => {
    riskAttestMutation.mutate({
      isin: bond.isin,
      bondName: bond.securityName,
      instrumentType: bond.securityType || 'g_sec',
      transactionValue: parseFloat(bidAmount) || bond.minimumBidAmount,
      disclosuresAcknowledged: true,
      orderType: 'buy'
    });
  };

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (gsecs as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Government Securities</h3>
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <LucideShield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No government securities available for auction</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card 
            key={bond.isin} 
            className="hover:shadow-md transition-shadow cursor-pointer group" 
            data-testid={`gsec-${bond.isin}`}
            onClick={() => navigate(`/bonds/detail/${bond.isin}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-foreground group-hover:text-finance-blue transition-colors">{bond.securityName}</h4>
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">
                      {bond.securityType}
                    </Badge>
                    <EligibilityBadge 
                      eligible={isGSecEligible} 
                      kycTierRequired="Basic" 
                      onUpgradeClick={() => navigate('/kyc/upgrade')} 
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-finance-blue transition-colors ml-auto" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.indicativeYield}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coupon</p>
                      <p className="font-semibold">{bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : 'Zero Coupon'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min Investment</p>
                      <p className="font-semibold">₹{bond.minimumBidAmount?.toLocaleString()}</p>
                    </div>
                  </div>

                  {bond.auctionDate && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Auction Date: {new Date(bond.auctionDate).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => { if (!open) { setSelectedBond(null); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); } }}>
                  <DialogTrigger asChild>
                    <Button onClick={(e) => { e.stopPropagation(); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); setSelectedBond(bond); }} size="sm" data-testid={`invest-${bond.isin}`}>
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
                          onChange={(e) => { setBidAmount(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="bid-amount-input"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Minimum: ₹{bond.minimumBidAmount?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
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

                      {orderError && (
                        <OrderBlocker 
                          error={orderError} 
                          onDismiss={() => setOrderError(null)}
                          variant="inline"
                        />
                      )}

                      {/* Risk Disclosure Section */}
                      {showRiskDisclosure ? (
                        <RiskDisclosureModal
                          bondId={bond.isin}
                          bondName={bond.securityName}
                          onAttest={() => handleRiskAttest(bond)}
                          isAttesting={riskAttestMutation.isPending}
                        />
                      ) : (
                        <>
                          {!riskAcknowledged && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setShowRiskDisclosure(true)}
                              disabled={!parseFloat(bidAmount) || parseFloat(bidAmount) < (bond.minimumBidAmount || 0)}
                              data-testid="review-risks-button"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Review Risk Disclosures
                            </Button>
                          )}
                          
                          {riskAcknowledged && (
                            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                                Risk disclosures acknowledged. You can proceed with your order.
                              </AlertDescription>
                            </Alert>
                          )}

                          <Button
                            className="w-full"
                            onClick={() => {
                              setOrderError(null);
                              const amount = parseFloat(bidAmount);
                              if (!amount || amount < bond.minimumBidAmount) {
                                toast({
                                  variant: "destructive",
                                  title: "Invalid Amount",
                                  description: `Minimum bid amount is ₹${bond.minimumBidAmount?.toLocaleString()}`,
                                });
                                return;
                              }
                              if (!riskAcknowledged) {
                                toast({
                                  variant: "destructive",
                                  title: "Risk Disclosure Required",
                                  description: "Please review and acknowledge the risk disclosures before proceeding.",
                                });
                                setShowRiskDisclosure(true);
                                return;
                              }
                              placeOrderMutation.mutate({
                                isin: bond.isin,
                                bidAmount: amount,
                              });
                            }}
                            disabled={placeOrderMutation.isPending || !!orderError}
                            data-testid="confirm-bid-button"
                          >
                            {placeOrderMutation.isPending ? "Placing Bid..." : "Confirm Bid"}
                          </Button>
                        </>
                      )}
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
  const [orderError, setOrderError] = useState<any>(null);
  const [showRiskDisclosure, setShowRiskDisclosure] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const orderGuard = useOrderGuard();

  const { data: corporateBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/corporate"],
  });

  const { data: commissionData } = useCommissionConfig();
  const { data: eligibilitySummary } = useEligibilitySummary();
  
  const isCorporateEligible = eligibilitySummary?.eligibleCategories?.some(c => c.id === 'corporate_listed') ?? false;

  const riskAttestMutation = useMutation({
    mutationFn: (attestData: any) => apiRequest("/api/bonds/risk-attestation", { method: "POST", body: JSON.stringify(attestData) }),
    onSuccess: () => {
      setRiskAcknowledged(true);
      setShowRiskDisclosure(false);
      toast({
        title: "Risk Disclosures Acknowledged",
        description: "You can now proceed with your order.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Attestation Failed",
        description: "Failed to record risk acknowledgment.",
      });
    },
  });

  const handleRiskAttest = (bond: any) => {
    riskAttestMutation.mutate({
      isin: bond.isin,
      bondName: bond.name || bond.issuerName || bond.bondName,
      instrumentType: 'corporate',
      transactionValue: parseFloat(quantity) * (parseFloat(limitPrice) || bond.lastPrice || 0),
      disclosuresAcknowledged: true,
      orderType: 'buy'
    });
  };

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
      setRiskAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      const parsedError = orderGuard.handleError(error, false);
      setOrderError(parsedError);
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (corporateBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Corporate Bonds</h3>
        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No corporate bonds available for trading</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card 
            key={bond.isin} 
            className="hover:shadow-md transition-shadow cursor-pointer group" 
            data-testid={`corp-bond-${bond.isin}`}
            onClick={() => navigate(`/bonds/detail/${bond.isin}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="font-semibold text-foreground group-hover:text-finance-blue transition-colors">{bond.name || bond.issuerName || bond.issuer || bond.bondName || 'Unknown Bond'}</h4>
                    <Badge variant="outline" className={getCreditRatingColors(bond.rating || bond.creditRating)}>
                      {bond.rating || bond.creditRating || 'NR'}
                    </Badge>
                    <Badge variant="outline" className={getBondTypeColors(bond.bondType || bond.type)}>
                      {bond.bondType || bond.type || 'Bond'}
                    </Badge>
                    <EligibilityBadge 
                      eligible={isCorporateEligible} 
                      kycTierRequired="Tier 1" 
                      onUpgradeClick={() => navigate('/kyc/upgrade')} 
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-finance-blue transition-colors ml-auto" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coupon</p>
                      <p className="font-semibold">{bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : 'Zero Coupon'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>Last Price: ₹{(bond.lastPrice || bond.currentPrice || bond.lastTradedPrice || 0).toLocaleString()}</span>
                    {(bond.accruedInterest || bond.accrued) && <span>Accrued: ₹{(bond.accruedInterest || bond.accrued || 0).toLocaleString()}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                  <OneClickBondInvest bond={bond} size="sm" />
                  <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => { if (!open) { setSelectedBond(null); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); } }}>
                    <DialogTrigger asChild>
                      <Button onClick={(e) => { e.stopPropagation(); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); setSelectedBond(bond); }} size="sm" variant="outline" data-testid={`buy-${bond.isin}`}>
                        Details
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place Corporate Bond Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.name || bond.issuerName || bond.issuer || 'these'} bonds
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
                          onChange={(e) => { setQuantity(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => { setLimitPrice(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="limit-price-input"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Last traded price: ₹{bond.lastPrice?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estimated Cost:</span>
                          <span className="font-semibold">
                            ₹{((parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Yield:</span>
                          <span className="font-medium text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</span>
                        </div>
                      </div>

                      {(parseFloat(quantity) || 0) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={(parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)}
                          bondType="corporate"
                          commissionData={commissionData}
                        />
                      )}

                      {orderError && (
                        <OrderBlocker 
                          error={orderError} 
                          onDismiss={() => setOrderError(null)}
                          variant="inline"
                        />
                      )}

                      {/* Risk Disclosure Section */}
                      {showRiskDisclosure ? (
                        <RiskDisclosureModal
                          bondId={bond.isin}
                          bondName={bond.name || bond.issuerName || bond.bondName || 'Corporate Bond'}
                          onAttest={() => handleRiskAttest(bond)}
                          isAttesting={riskAttestMutation.isPending}
                        />
                      ) : (
                        <>
                          {!riskAcknowledged && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setShowRiskDisclosure(true)}
                              disabled={!parseInt(quantity) || parseInt(quantity) <= 0 || (!parseFloat(limitPrice) && !bond.lastPrice)}
                              data-testid="review-corp-risks-button"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Review Risk Disclosures
                            </Button>
                          )}
                          
                          {riskAcknowledged && (
                            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                                Risk disclosures acknowledged.
                              </AlertDescription>
                            </Alert>
                          )}

                          <Button
                            className="w-full"
                            onClick={() => {
                              setOrderError(null);
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
                              if (!riskAcknowledged) {
                                toast({
                                  variant: "destructive",
                                  title: "Risk Disclosure Required",
                                  description: "Please review and acknowledge the risk disclosures before proceeding.",
                                });
                                setShowRiskDisclosure(true);
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
                            disabled={placeOrderMutation.isPending || !!orderError}
                            data-testid="confirm-buy-button"
                          >
                            {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
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
  const [orderError, setOrderError] = useState<any>(null);
  const [showRiskDisclosure, setShowRiskDisclosure] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const orderGuard = useOrderGuard();

  const { data: ncdBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/ncd"],
  });

  const { data: commissionData } = useCommissionConfig();
  const { data: eligibilitySummary } = useEligibilitySummary();
  
  const isNCDEligible = eligibilitySummary?.eligibleCategories?.some(c => c.id === 'ncd_listed') ?? false;

  const riskAttestMutation = useMutation({
    mutationFn: (attestData: any) => apiRequest("/api/bonds/risk-attestation", { method: "POST", body: JSON.stringify(attestData) }),
    onSuccess: () => {
      setRiskAcknowledged(true);
      setShowRiskDisclosure(false);
      toast({ title: "Risk Disclosures Acknowledged" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Attestation Failed" });
    },
  });

  const handleRiskAttest = (bond: any) => {
    riskAttestMutation.mutate({
      isin: bond.isin,
      bondName: bond.name || bond.issuerName || bond.bondName,
      instrumentType: 'ncd',
      transactionValue: parseFloat(quantity) * (parseFloat(limitPrice) || bond.lastPrice || 0),
      disclosuresAcknowledged: true,
      orderType: 'buy'
    });
  };

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
      setRiskAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      const parsedError = orderGuard.handleError(error, false);
      setOrderError(parsedError);
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (ncdBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Non-Convertible Debentures (NCDs)</h3>
        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No NCDs available for trading currently</p>
            <p className="text-xs text-muted-foreground mt-2">Check back during NCD issue periods</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card 
            key={bond.isin} 
            className="hover:shadow-md transition-shadow cursor-pointer group" 
            data-testid={`ncd-bond-${bond.isin}`}
            onClick={() => navigate(`/bonds/detail/${bond.isin}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="font-semibold text-foreground group-hover:text-finance-blue transition-colors">{bond.name || bond.issuerName || bond.issuer || bond.bondName || 'Unknown Bond'}</h4>
                    <Badge variant="outline" className={getCreditRatingColors(bond.rating)}>
                      {bond.rating || 'NR'}
                    </Badge>
                    <Badge variant="outline" className={getBondTypeColors('ncd')}>
                      NCD
                    </Badge>
                    <EligibilityBadge 
                      eligible={isNCDEligible} 
                      kycTierRequired="Tier 1" 
                      onUpgradeClick={() => navigate('/kyc/upgrade')} 
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-finance-blue transition-colors ml-auto" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Yield</p>
                      <p className="font-semibold text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coupon</p>
                      <p className="font-semibold">{bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : 'Zero Coupon'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>Last Price: ₹{(bond.lastPrice || bond.currentPrice || bond.lastTradedPrice || 0).toLocaleString()}</span>
                    {(bond.accruedInterest || bond.accrued) && <span>Accrued: ₹{(bond.accruedInterest || bond.accrued || 0).toLocaleString()}</span>}
                  </div>
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => { if (!open) { setSelectedBond(null); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); } }}>
                  <DialogTrigger asChild>
                    <Button onClick={(e) => { e.stopPropagation(); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); setSelectedBond(bond); }} size="sm" data-testid={`buy-ncd-${bond.isin}`}>
                      Buy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place NCD Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.name || bond.issuerName || bond.issuer || 'these'} NCDs
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
                          onChange={(e) => { setQuantity(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="ncd-quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => { setLimitPrice(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="ncd-limit-price-input"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Last traded price: ₹{bond.lastPrice?.toLocaleString()}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Estimated Cost:</span>
                          <span className="font-semibold">
                            ₹{((parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Yield:</span>
                          <span className="font-medium text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</span>
                        </div>
                      </div>

                      {(parseFloat(quantity) || 0) > 0 && (
                        <FeeBreakdownDisplay 
                          amount={(parseFloat(quantity) || 0) * (parseFloat(limitPrice) || bond.lastPrice)}
                          bondType="ncd"
                          commissionData={commissionData}
                        />
                      )}

                      {orderError && (
                        <OrderBlocker 
                          error={orderError} 
                          onDismiss={() => setOrderError(null)}
                          variant="inline"
                        />
                      )}

                      {/* Risk Disclosure Section */}
                      {showRiskDisclosure ? (
                        <RiskDisclosureModal
                          bondId={bond.isin}
                          bondName={bond.name || bond.issuerName || 'NCD'}
                          onAttest={() => handleRiskAttest(bond)}
                          isAttesting={riskAttestMutation.isPending}
                        />
                      ) : (
                        <>
                          {!riskAcknowledged && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setShowRiskDisclosure(true)}
                              disabled={!parseInt(quantity) || parseInt(quantity) <= 0 || (!parseFloat(limitPrice) && !bond.lastPrice)}
                              data-testid="review-ncd-risks-button"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Review Risk Disclosures
                            </Button>
                          )}
                          
                          {riskAcknowledged && (
                            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                                Risk disclosures acknowledged.
                              </AlertDescription>
                            </Alert>
                          )}

                          <Button
                            className="w-full"
                            onClick={() => {
                              setOrderError(null);
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
                              if (!riskAcknowledged) {
                                toast({
                                  variant: "destructive",
                                  title: "Risk Disclosure Required",
                                  description: "Please review and acknowledge the risk disclosures.",
                                });
                                setShowRiskDisclosure(true);
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
                            disabled={placeOrderMutation.isPending || !!orderError}
                            data-testid="confirm-ncd-buy-button"
                          >
                            {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                          </Button>
                        </>
                      )}
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
  const [orderError, setOrderError] = useState<any>(null);
  const [showRiskDisclosure, setShowRiskDisclosure] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const orderGuard = useOrderGuard();

  const { data: taxFreeBonds, isLoading } = useQuery({
    queryKey: ["/api/bonds/trading/tax-free"],
  });

  const { data: commissionData } = useCommissionConfig();
  const { data: eligibilitySummary } = useEligibilitySummary();
  
  const isTaxFreeEligible = eligibilitySummary?.eligibleCategories?.some(c => c.id === 'tax_free') ?? false;

  const riskAttestMutation = useMutation({
    mutationFn: (attestData: any) => apiRequest("/api/bonds/risk-attestation", { method: "POST", body: JSON.stringify(attestData) }),
    onSuccess: () => {
      setRiskAcknowledged(true);
      setShowRiskDisclosure(false);
      toast({ title: "Risk Disclosures Acknowledged" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Attestation Failed" });
    },
  });

  const handleRiskAttest = (bond: any) => {
    riskAttestMutation.mutate({
      isin: bond.isin,
      bondName: bond.name || bond.issuerName || bond.bondName,
      instrumentType: 'tax_free',
      transactionValue: parseFloat(quantity) * (parseFloat(limitPrice) || bond.lastPrice || 0),
      disclosuresAcknowledged: true,
      orderType: 'buy'
    });
  };

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
      setRiskAcknowledged(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: any) => {
      const parsedError = orderGuard.handleError(error, false);
      setOrderError(parsedError);
    },
  });

  if (isLoading) {
    return <LoadingState variant="list" count={2} />;
  }

  const bonds = (taxFreeBonds as any)?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Tax Free Bonds</h3>
        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
          {bonds.length} Available
        </Badge>
      </div>

      {bonds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <IndianRupee className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No tax-free bonds available in secondary market</p>
            <p className="text-xs text-muted-foreground mt-2">Tax-free bonds are available when PSUs issue them</p>
          </CardContent>
        </Card>
      ) : (
        bonds.map((bond: any) => (
          <Card 
            key={bond.isin} 
            className="hover:shadow-md transition-shadow cursor-pointer group" 
            data-testid={`tax-free-bond-${bond.isin}`}
            onClick={() => navigate(`/bonds/detail/${bond.isin}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h4 className="font-semibold text-foreground group-hover:text-finance-blue transition-colors">{bond.name || bond.issuerName || bond.issuer || bond.bondName || 'Unknown Bond'}</h4>
                    <Badge variant="outline" className={getCreditRatingColors(bond.rating)}>
                      {bond.rating || 'NR'}
                    </Badge>
                    <Badge variant="outline" className={getBondTypeColors('tax_free')}>
                      Tax Free
                    </Badge>
                    <EligibilityBadge 
                      eligible={isTaxFreeEligible} 
                      kycTierRequired="Tier 1" 
                      onUpgradeClick={() => navigate('/kyc/upgrade')} 
                    />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-finance-blue transition-colors ml-auto" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">ISIN: {bond.isin}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tax-Free Yield</p>
                      <p className="font-semibold text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Coupon</p>
                      <p className="font-semibold">{bond.couponRate && parseFloat(bond.couponRate) > 0 ? `${bond.couponRate}%` : 'Zero Coupon'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Maturity</p>
                      <p className="font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Face Value</p>
                      <p className="font-semibold">₹{bond.faceValue?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                    <span>Last Price: ₹{(bond.lastPrice || bond.currentPrice || bond.lastTradedPrice || 0).toLocaleString()}</span>
                    <span className="text-green-600 font-medium">Interest exempt under Section 10(15)</span>
                  </div>
                </div>

                <Dialog open={selectedBond?.isin === bond.isin} onOpenChange={(open) => { if (!open) { setSelectedBond(null); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); } }}>
                  <DialogTrigger asChild>
                    <Button onClick={(e) => { e.stopPropagation(); setOrderError(null); setShowRiskDisclosure(false); setRiskAcknowledged(false); setSelectedBond(bond); }} size="sm" data-testid={`buy-tax-free-${bond.isin}`}>
                      Buy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Place Tax-Free Bond Order</DialogTitle>
                      <DialogDescription>
                        Buy {bond.name || bond.issuerName || bond.issuer || 'these'} tax-free bonds - Interest is tax exempt
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
                          onChange={(e) => { setQuantity(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="tax-free-quantity-input"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Limit Price (₹)</label>
                        <Input
                          type="number"
                          placeholder={`Last: ${bond.lastPrice}`}
                          value={limitPrice}
                          onChange={(e) => { setLimitPrice(e.target.value); if (riskAcknowledged) setRiskAcknowledged(false); }}
                          data-testid="tax-free-limit-price-input"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
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
                          <span className="font-medium text-finance-green">{bond.yieldToMaturity || bond.currentYield || 'N/A'}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-700 dark:text-green-300 text-xs">
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

                      {orderError && (
                        <OrderBlocker 
                          error={orderError} 
                          onDismiss={() => setOrderError(null)}
                          variant="inline"
                        />
                      )}

                      {/* Risk Disclosure Section */}
                      {showRiskDisclosure ? (
                        <RiskDisclosureModal
                          bondId={bond.isin}
                          bondName={bond.name || bond.issuerName || 'Tax-Free Bond'}
                          onAttest={() => handleRiskAttest(bond)}
                          isAttesting={riskAttestMutation.isPending}
                        />
                      ) : (
                        <>
                          {!riskAcknowledged && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => setShowRiskDisclosure(true)}
                              disabled={!parseInt(quantity) || parseInt(quantity) <= 0 || (!parseFloat(limitPrice) && !bond.lastPrice)}
                              data-testid="review-taxfree-risks-button"
                            >
                              <AlertCircle className="h-4 w-4 mr-2" />
                              Review Risk Disclosures
                            </Button>
                          )}
                          
                          {riskAcknowledged && (
                            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                                Risk disclosures acknowledged.
                              </AlertDescription>
                            </Alert>
                          )}

                          <Button
                            className="w-full"
                            onClick={() => {
                              setOrderError(null);
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
                              if (!riskAcknowledged) {
                                toast({
                                  variant: "destructive",
                                  title: "Risk Disclosure Required",
                                  description: "Please review and acknowledge the risk disclosures.",
                                });
                                setShowRiskDisclosure(true);
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
                            disabled={placeOrderMutation.isPending || !!orderError}
                            data-testid="confirm-tax-free-buy-button"
                          >
                            {placeOrderMutation.isPending ? "Placing Order..." : "Confirm Order"}
                          </Button>
                        </>
                      )}
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

// Bond Marketplace Component - Sell Listings and Buy Requests with SEBI Compliance
function BondMarketplace() {
  const { toast } = useToast();
  const [showCreateSellDialog, setShowCreateSellDialog] = useState(false);
  const [showBuyDialog, setShowBuyDialog] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState('');
  const [riskAcknowledgments, setRiskAcknowledgments] = useState<Record<string, boolean>>({});
  const [sellRiskAcknowledgments, setSellRiskAcknowledgments] = useState<Record<string, boolean>>({});
  const [tierCheckStatus, setTierCheckStatus] = useState<'idle' | 'checking' | 'done'>('idle');
  const [tierError, setTierError] = useState<string | null>(null);
  
  const [sellForm, setSellForm] = useState({
    isin: '',
    bondName: '',
    bondType: 'corporate',
    instrumentType: 'corporate_bond',
    faceValue: '',
    quantity: '',
    askPrice: '',
    floorPrice: '',
    couponRate: '',
    maturityDate: '',
    creditRating: 'AA',
    isListed: true,
    dematAccountNumber: '',
  });
  
  const requiredRiskCategories = ['credit', 'liquidity', 'interest_rate', 'default', 'regulatory'];
  
  const { data: sellListingsRaw, isLoading: loadingSell } = useQuery<any>({
    queryKey: ['/api/bonds/sell-listings'],
  });
  
  const { data: myListingsRaw, isLoading: loadingMyListings } = useQuery<any>({
    queryKey: ['/api/bonds/sell-listings/my'],
  });
  
  const { data: myRequestsRaw, isLoading: loadingMyRequests } = useQuery<any>({
    queryKey: ['/api/bonds/buy-requests/my'],
  });
  
  const { data: eligibilityRaw } = useQuery<any>({
    queryKey: ['/api/bonds/trading-eligibility'],
  });
  
  // Extract data from API response wrapper
  const sellListings = Array.isArray(sellListingsRaw) ? sellListingsRaw : (sellListingsRaw?.data || []);
  const myListings = Array.isArray(myListingsRaw) ? myListingsRaw : (myListingsRaw?.data || []);
  const myRequests = Array.isArray(myRequestsRaw) ? myRequestsRaw : (myRequestsRaw?.data || []);
  const eligibility = eligibilityRaw?.data || eligibilityRaw;

  const allSellRisksAcknowledged = requiredRiskCategories.every(cat => sellRiskAcknowledgments[cat]);

  const createSellListingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/bonds/sell-listings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Sell listing created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/sell-listings/my'] });
      setShowCreateSellDialog(false);
      setSellForm({
        isin: '', bondName: '', bondType: 'corporate', instrumentType: 'corporate_bond',
        faceValue: '', quantity: '', askPrice: '', floorPrice: '', couponRate: '',
        maturityDate: '', creditRating: 'AA', isListed: true, dematAccountNumber: '',
      });
      setSellRiskAcknowledgments({});
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to create sell listing', 
        description: error.message || 'Please ensure you meet KYC requirements and acknowledge all risks' 
      });
    },
  });

  const handleSubmitSellListing = () => {
    if (!sellForm.isin || !sellForm.bondName || !sellForm.faceValue || !sellForm.quantity || !sellForm.askPrice || !sellForm.floorPrice) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in all required fields' });
      return;
    }
    
    const transactionValue = parseFloat(sellForm.askPrice) * parseInt(sellForm.quantity);
    const requiresRiskAck = !sellForm.isListed || transactionValue > 5000000;
    
    if (requiresRiskAck && !allSellRisksAcknowledged) {
      toast({
        variant: 'destructive',
        title: 'Risk Acknowledgment Required',
        description: 'Please acknowledge all mandatory risk disclosures before proceeding',
      });
      return;
    }
    
    createSellListingMutation.mutate({
      ...sellForm,
      faceValue: sellForm.faceValue,
      quantity: parseInt(sellForm.quantity),
      askPrice: sellForm.askPrice,
      floorPrice: sellForm.floorPrice,
      couponRate: sellForm.couponRate ? parseFloat(sellForm.couponRate) : null,
      riskAcknowledgments: sellRiskAcknowledgments,
    });
  };

  const toggleSellRiskAck = (category: string) => {
    setSellRiskAcknowledgments(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const createBuyRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/bonds/buy-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Buy request created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/buy-requests/my'] });
      setShowBuyDialog(false);
      setSelectedListing(null);
      setBuyQuantity('');
      setRiskAcknowledgments({});
    },
    onError: (error: any) => {
      toast({ 
        variant: 'destructive', 
        title: 'Failed to create buy request', 
        description: error.message || 'Please ensure you meet KYC requirements and acknowledge all risks' 
      });
    },
  });

  const handleBuyClick = (listing: any) => {
    setSelectedListing(listing);
    setShowBuyDialog(true);
    setTierCheckStatus('idle');
    setTierError(null);
    setRiskAcknowledgments({});
    setBuyQuantity('1');
  };

  const allRisksAcknowledged = requiredRiskCategories.every(cat => riskAcknowledgments[cat]);
  
  const handleSubmitBuyRequest = () => {
    if (!selectedListing || !buyQuantity) return;
    
    const transactionValue = parseFloat(selectedListing.askPrice) * parseInt(buyQuantity);
    const requiresRiskAck = !selectedListing.isListed || transactionValue > 5000000;
    
    if (requiresRiskAck && !allRisksAcknowledged) {
      toast({
        variant: 'destructive',
        title: 'Risk Acknowledgment Required',
        description: 'Please acknowledge all mandatory risk disclosures before proceeding',
      });
      return;
    }
    
    createBuyRequestMutation.mutate({
      instrumentType: selectedListing.instrumentType,
      isin: selectedListing.isin,
      bondName: selectedListing.bondName,
      bondType: selectedListing.bondType,
      couponRate: selectedListing.couponRate,
      maturityDate: selectedListing.maturityDate,
      creditRating: selectedListing.creditRating,
      isListed: selectedListing.isListed,
      faceValue: selectedListing.faceValue,
      quantity: parseInt(buyQuantity),
      maxPrice: selectedListing.askPrice,
      targetPrice: selectedListing.askPrice,
      riskAcknowledged: allRisksAcknowledged,
      riskAcknowledgments: riskAcknowledgments,
    });
  };

  const toggleRiskAck = (category: string) => {
    setRiskAcknowledgments(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  return (
    <div className="space-y-6">
      {/* KYC Eligibility Status Banner */}
      {eligibility && (
        <Alert className={(eligibility as any)?.eligible ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"}>
          <LucideShield className="h-4 w-4" />
          <AlertDescription>
            {(eligibility as any)?.eligible 
              ? `You are eligible to trade bonds. KYC Tier: ${(eligibility as any)?.tier || 'Basic'}`
              : `Complete your KYC to access bond trading. ${(eligibility as any)?.reason || ''}`
            }
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Bond Marketplace</h3>
          <p className="text-muted-foreground text-sm">Buy and sell bonds in our secondary market</p>
        </div>
        <Dialog open={showCreateSellDialog} onOpenChange={setShowCreateSellDialog}>
          <DialogTrigger asChild>
            <Button data-testid="btn-create-sell-listing">
              <TrendingUp className="h-4 w-4 mr-2" />
              Sell My Bonds
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Sell Listing</DialogTitle>
              <DialogDescription>
                List your bonds for sale in the marketplace. A buyer will be matched to your listing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Eligibility Banner */}
              {eligibility && (
                <Alert className={(eligibility as any)?.eligible ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"}>
                  <LucideShield className="h-4 w-4" />
                  <AlertDescription>
                    {(eligibility as any)?.eligible 
                      ? `KYC Tier: ${(eligibility as any)?.tier || 'Basic'} - You are eligible to create sell listings`
                      : `Complete your KYC to create sell listings. ${(eligibility as any)?.reason || ''}`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sell-isin">ISIN *</Label>
                  <Input id="sell-isin" value={sellForm.isin} onChange={(e) => setSellForm(p => ({ ...p, isin: e.target.value }))} placeholder="e.g., INE123A01234" data-testid="input-sell-isin" />
                </div>
                <div>
                  <Label htmlFor="sell-bondName">Bond Name *</Label>
                  <Input id="sell-bondName" value={sellForm.bondName} onChange={(e) => setSellForm(p => ({ ...p, bondName: e.target.value }))} placeholder="e.g., HDFC NCD 2028" data-testid="input-sell-bondName" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sell-bondType">Bond Type</Label>
                  <Select value={sellForm.bondType} onValueChange={(v) => setSellForm(p => ({ ...p, bondType: v, instrumentType: v === 'government' ? 'government_security' : 'corporate_bond' }))}>
                    <SelectTrigger data-testid="select-sell-bondType"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corporate">Corporate Bond</SelectItem>
                      <SelectItem value="ncd">NCD</SelectItem>
                      <SelectItem value="government">Government Security</SelectItem>
                      <SelectItem value="tax-free">Tax-Free Bond</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sell-creditRating">Credit Rating</Label>
                  <Select value={sellForm.creditRating} onValueChange={(v) => setSellForm(p => ({ ...p, creditRating: v }))}>
                    <SelectTrigger data-testid="select-sell-creditRating"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AAA">AAA</SelectItem>
                      <SelectItem value="AA+">AA+</SelectItem>
                      <SelectItem value="AA">AA</SelectItem>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="BBB">BBB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="sell-faceValue">Face Value *</Label>
                  <Input id="sell-faceValue" type="number" value={sellForm.faceValue} onChange={(e) => setSellForm(p => ({ ...p, faceValue: e.target.value }))} placeholder="e.g., 1000" data-testid="input-sell-faceValue" />
                </div>
                <div>
                  <Label htmlFor="sell-quantity">Quantity *</Label>
                  <Input id="sell-quantity" type="number" value={sellForm.quantity} onChange={(e) => setSellForm(p => ({ ...p, quantity: e.target.value }))} placeholder="e.g., 100" data-testid="input-sell-quantity" />
                </div>
                <div>
                  <Label htmlFor="sell-couponRate">Coupon Rate (%)</Label>
                  <Input id="sell-couponRate" type="number" step="0.01" value={sellForm.couponRate} onChange={(e) => setSellForm(p => ({ ...p, couponRate: e.target.value }))} placeholder="e.g., 8.5" data-testid="input-sell-couponRate" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sell-askPrice">Ask Price (₹) *</Label>
                  <Input id="sell-askPrice" type="number" value={sellForm.askPrice} onChange={(e) => setSellForm(p => ({ ...p, askPrice: e.target.value }))} placeholder="e.g., 1050" data-testid="input-sell-askPrice" />
                </div>
                <div>
                  <Label htmlFor="sell-floorPrice">Floor Price (₹) *</Label>
                  <Input id="sell-floorPrice" type="number" value={sellForm.floorPrice} onChange={(e) => setSellForm(p => ({ ...p, floorPrice: e.target.value }))} placeholder="e.g., 1000" data-testid="input-sell-floorPrice" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sell-maturityDate">Maturity Date</Label>
                  <Input id="sell-maturityDate" type="date" value={sellForm.maturityDate} onChange={(e) => setSellForm(p => ({ ...p, maturityDate: e.target.value }))} data-testid="input-sell-maturityDate" />
                </div>
                <div>
                  <Label htmlFor="sell-dematAccount">Demat Account Number</Label>
                  <Input id="sell-dematAccount" value={sellForm.dematAccountNumber} onChange={(e) => setSellForm(p => ({ ...p, dematAccountNumber: e.target.value }))} placeholder="e.g., 1234567890123456" data-testid="input-sell-dematAccount" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="sell-isListed" checked={sellForm.isListed} onChange={(e) => setSellForm(p => ({ ...p, isListed: e.target.checked }))} data-testid="checkbox-sell-isListed" />
                <Label htmlFor="sell-isListed">Bond is listed on exchange</Label>
              </div>

              {/* SEBI Risk Disclosure Acknowledgments for Sell Listing */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  SEBI Risk Disclosures (Seller)
                </h4>
                <p className="text-sm text-muted-foreground">
                  You must acknowledge the following risks before listing bonds for sale:
                </p>
                <div className="space-y-2">
                  {requiredRiskCategories.map((category) => (
                    <div key={category} className="flex items-start gap-2">
                      <input type="checkbox" id={`sell-risk-${category}`} checked={sellRiskAcknowledgments[category] || false} onChange={() => toggleSellRiskAck(category)} className="mt-1" data-testid={`checkbox-sell-risk-${category}`} />
                      <label htmlFor={`sell-risk-${category}`} className="text-sm">
                        <span className="font-medium capitalize">{category.replace('_', ' ')} Risk:</span>{' '}
                        {category === 'credit' && 'I understand pricing may reflect issuer credit changes.'}
                        {category === 'liquidity' && 'I understand my listing may not attract buyers immediately.'}
                        {category === 'interest_rate' && 'I understand bond values fluctuate with rates.'}
                        {category === 'default' && 'I confirm the bond has no current defaults.'}
                        {category === 'regulatory' && 'I confirm compliance with SEBI/RBI regulations.'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSubmitSellListing} disabled={createSellListingMutation.isPending || !allSellRisksAcknowledged} className="w-full" data-testid="btn-submit-sell-listing">
                {createSellListingMutation.isPending ? 'Submitting...' : 'Create Sell Listing'}
              </Button>
              
              {!allSellRisksAcknowledged && (
                <p className="text-sm text-amber-600 text-center">Please acknowledge all risk disclosures to proceed</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Buy Dialog with Risk Acknowledgments */}
      <Dialog open={showBuyDialog} onOpenChange={setShowBuyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buy Bonds</DialogTitle>
            <DialogDescription>
              Create a buy request for {selectedListing?.bondName}
            </DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bond:</span>
                  <span className="font-medium">{selectedListing.bondName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ask Price:</span>
                  <span className="font-bold text-green-600">₹{parseFloat(selectedListing.askPrice).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available:</span>
                  <span>{selectedListing.quantity} units</span>
                </div>
              </div>
              
              <div>
                <Label htmlFor="buy-qty">Quantity</Label>
                <Input
                  id="buy-qty"
                  type="number"
                  min="1"
                  max={selectedListing.quantity}
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(e.target.value)}
                  data-testid="input-buy-quantity"
                />
              </div>

              {/* SEBI Risk Disclosure Acknowledgments */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  SEBI Risk Disclosures
                </h4>
                <p className="text-sm text-muted-foreground">
                  You must acknowledge the following risks before proceeding with this transaction:
                </p>
                <div className="space-y-2">
                  {requiredRiskCategories.map((category) => (
                    <div key={category} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`risk-${category}`}
                        checked={riskAcknowledgments[category] || false}
                        onChange={() => toggleRiskAck(category)}
                        className="mt-1"
                        data-testid={`checkbox-risk-${category}`}
                      />
                      <label htmlFor={`risk-${category}`} className="text-sm">
                        <span className="font-medium capitalize">{category.replace('_', ' ')} Risk:</span>{' '}
                        {category === 'credit' && 'The issuer may default on payments.'}
                        {category === 'liquidity' && 'Bonds may be difficult to sell before maturity.'}
                        {category === 'interest_rate' && 'Bond values fluctuate with interest rate changes.'}
                        {category === 'default' && 'There is a risk of complete loss of principal.'}
                        {category === 'regulatory' && 'Regulatory changes may affect bond value or taxability.'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmitBuyRequest}
                disabled={createBuyRequestMutation.isPending || !allRisksAcknowledged || !buyQuantity}
                className="w-full"
                data-testid="btn-confirm-buy-request"
              >
                {createBuyRequestMutation.isPending ? 'Submitting...' : 'Submit Buy Request'}
              </Button>
              
              {!allRisksAcknowledged && (
                <p className="text-sm text-amber-600 text-center">
                  Please acknowledge all risk disclosures to proceed
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Active Sell Listings in Market */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Available Bonds for Sale
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSell ? (
            <LoadingState variant="list" count={3} />
          ) : !sellListings || sellListings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No bonds currently listed for sale</p>
              <p className="text-sm">Check back later or create a sell listing</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sellListings.map((listing: any) => (
                <div key={listing.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-foreground">{listing.bondName}</h4>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{listing.bondType}</Badge>
                      <span className="text-sm text-muted-foreground">ISIN: {listing.isin}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">₹{parseFloat(listing.askPrice).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{listing.quantity} units available</p>
                    <Button 
                      size="sm" 
                      className="mt-2" 
                      onClick={() => handleBuyClick(listing)}
                      data-testid={`btn-buy-${listing.id}`}
                    >
                      Buy Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Listings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            My Sell Listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMyListings ? (
            <LoadingState variant="list" count={2} />
          ) : !myListings || myListings.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">You haven't created any sell listings yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map((listing: any) => (
                <div key={listing.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{listing.bondName}</h4>
                    <p className="text-sm text-muted-foreground">{listing.quantity} units @ ₹{parseFloat(listing.askPrice).toLocaleString()}</p>
                  </div>
                  <Badge variant={
                    listing.status === 'active' ? 'default' :
                    listing.status === 'pending' ? 'outline' :
                    listing.status === 'matched' ? 'secondary' : 'destructive'
                  }>
                    {listing.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Buy Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LucideShield className="h-5 w-5 text-purple-600" />
            My Buy Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMyRequests ? (
            <LoadingState variant="list" count={2} />
          ) : !myRequests || myRequests.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">You haven't placed any buy requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myRequests.map((request: any) => (
                <div key={request.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">{request.bondName}</h4>
                    <p className="text-sm text-muted-foreground">{request.quantity} units @ max ₹{parseFloat(request.maxPrice).toLocaleString()}</p>
                  </div>
                  <Badge variant={
                    request.status === 'active' ? 'default' :
                    request.status === 'pending' ? 'outline' :
                    request.status === 'matched' ? 'secondary' : 'destructive'
                  }>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Bond Holdings</h3>
          <p className="text-muted-foreground text-center">
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
        <h3 className="text-lg font-semibold text-foreground">My Bond Holdings</h3>
        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
          {bonds.length} Holdings
        </Badge>
      </div>

      {/* Portfolio Summary */}
      <Card className="bg-gradient-to-br from-finance-blue to-blue-600 text-foreground">
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
                  <h4 className="font-semibold text-foreground">{holding.bondName}</h4>
                  <Badge variant="outline">
                    {holding.bondType}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-muted-foreground">Quantity</p>
                    <p className="font-semibold">{holding.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Yield</p>
                    <p className="font-semibold text-finance-green">{holding.yieldToMaturity || holding.currentYield || 'N/A'}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Maturity</p>
                    <p className="font-semibold">{new Date(holding.maturityDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Value</p>
                    <p className="font-semibold">₹{holding.currentValue?.toLocaleString()}</p>
                  </div>
                </div>

                {holding.nextCouponDate && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Next Coupon: {new Date(holding.nextCouponDate).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-sm text-muted-foreground">P&L</p>
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
function OrderProgressTracker({ status, settlementDate }: { status: string; settlementDate?: string }) {
  const steps = [
    { key: 'placed', label: 'Order Placed', icon: Clock },
    { key: 'processing', label: 'Processing', icon: TrendingUp },
    { key: 'settlement', label: 'Settlement', icon: Building2 },
    { key: 'credited', label: 'Credited', icon: CheckCircle2 },
  ];

  const getStepIndex = (s: string): number => {
    switch (s?.toLowerCase()) {
      case 'placed':
      case 'pending':
        return 0;
      case 'processing':
      case 'confirmed':
        return 1;
      case 'settlement':
      case 'awaiting_settlement':
        return 2;
      case 'credited':
      case 'executed':
      case 'allotted':
        return 3;
      case 'rejected':
      case 'failed':
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  const currentStep = getStepIndex(status);
  const isFailed = currentStep === -1;

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <span className="text-sm font-medium text-red-700 dark:text-red-300">
          Order {status === 'cancelled' ? 'Cancelled' : 'Failed'}
        </span>
      </div>
    );
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-green-500 transition-all duration-500"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />
        
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = index <= currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.key} className="relative flex flex-col items-center z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isCompleted 
                  ? 'bg-green-500 text-white' 
                  : 'bg-muted text-muted-foreground'
              } ${isCurrent ? 'ring-2 ring-green-300 ring-offset-2' : ''}`}>
                <StepIcon className="h-4 w-4" />
              </div>
              <span className={`text-xs mt-2 font-medium ${
                isCompleted ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {settlementDate && currentStep < 3 && (
        <p className="text-xs text-center text-muted-foreground mt-3">
          Expected settlement: {new Date(settlementDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

function BondOrders() {
  const { toast } = useToast();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["/api/bonds/orders"],
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest(`/api/bonds/orders/${orderId}/cancel`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Cancelled",
        description: "Your bond order has been cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bonds/orders"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancel Failed",
        description: error.message || "Could not cancel the order.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="mt-6"><LoadingState variant="list" count={1} /></div>;
  }

  const orderList = (orders as any)?.data || [];

  if (orderList.length === 0) {
    return (
      <Card className="border-dashed mt-6">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Clock className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No recent orders</p>
          <p className="text-xs text-muted-foreground mt-1">Your bond orders will appear here</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'executed':
      case 'credited':
      case 'allotted':
        return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'pending':
      case 'placed':
        return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'processing':
      case 'confirmed':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'settlement':
      case 'awaiting_settlement':
        return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'rejected':
      case 'failed':
        return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'cancelled':
        return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const canCancel = (status: string) => {
    return ['pending', 'placed'].includes(status?.toLowerCase());
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Recent Orders</h3>
        <Badge variant="outline">{orderList.length} Orders</Badge>
      </div>
      
      {orderList.map((order: any) => (
        <Card key={order.id} data-testid={`order-${order.id}`} className="overflow-hidden">
          <CardContent className="p-0">
            <div className="p-4 border-b bg-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-foreground">{order.bondName}</p>
                  <Badge variant="outline" className={getStatusColor(order.orderStatus || order.status)}>
                    {order.orderStatus || order.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {canCancel(order.orderStatus || order.status) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 dark:text-red-300 hover:bg-red-50 dark:bg-red-950/30"
                      onClick={() => cancelOrderMutation.mutate(order.id)}
                      disabled={cancelOrderMutation.isPending}
                      data-testid={`cancel-order-${order.id}`}
                    >
                      {cancelOrderMutation.isPending ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    #{order.orderNumber || order.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="px-4 py-2">
              <OrderProgressTracker 
                status={order.orderStatus || order.status} 
                settlementDate={order.settlementDate}
              />
            </div>
            
            <div className="p-4 pt-0">
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
                  <p className="text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-green-600">₹{parseFloat(order.netAmount || order.grossAmount || order.orderAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order Date</p>
                  <p className="font-medium">{new Date(order.orderDate || order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              {order.settlementDate && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Settlement expected by {new Date(order.settlementDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface UnifiedBond {
  id: string;
  isin: string;
  bondName: string;
  issuerName: string;
  instrumentType: string;
  displayType: string;
  couponRate: string | null;
  yieldToMaturity: string | null;
  maturityDate: string | null;
  yearsToMaturity: number | null;
  creditRating: string | null;
  ratingAgency: string | null;
  minInvestment: number;
  faceValue: number;
  taxCategory: string;
  isTaxFree: boolean;
  isListed: boolean;
  exchange: string;
  lastUpdated: Date | null;
  lastPrice?: number;
  source: 'government_securities' | 'corporate_bonds';
}

interface BondFiltersState {
  creditRating?: string[];
  maturityRange?: [number, number];
  yieldRange?: [number, number];
  minInvestment?: number;
  taxFree?: boolean;
  instrumentType?: string[];
  sortBy?: string;
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
  
  // Enhanced filters state - no default filters so all bonds are shown initially
  const [enhancedFilters, setEnhancedFilters] = useState<BondFiltersState>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedBonds, setSelectedBonds] = useState<string[]>([]);
  
  // Fetch unified bonds catalog for enhanced features
  interface EnhancedCatalogResponse {
    bonds: UnifiedBond[];
    total: number;
    filters: Record<string, unknown>;
    pagination: Record<string, unknown>;
  }
  
  // Build query string from enhanced filters
  const catalogQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (enhancedFilters.creditRating?.length) {
      params.set('creditRating', enhancedFilters.creditRating.join(','));
    }
    if (enhancedFilters.maturityRange) {
      params.set('minMaturity', String(enhancedFilters.maturityRange[0]));
      params.set('maxMaturity', String(enhancedFilters.maturityRange[1]));
    }
    if (enhancedFilters.yieldRange) {
      params.set('minYield', String(enhancedFilters.yieldRange[0]));
      params.set('maxYield', String(enhancedFilters.yieldRange[1]));
    }
    if (enhancedFilters.minInvestment) {
      params.set('maxMinInvestment', String(enhancedFilters.minInvestment));
    }
    if (enhancedFilters.taxFree) {
      params.set('taxFree', 'true');
    }
    if (enhancedFilters.instrumentType?.length) {
      params.set('instrumentType', enhancedFilters.instrumentType.join(','));
    }
    if (enhancedFilters.sortBy) {
      params.set('sortBy', enhancedFilters.sortBy);
    }
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }, [enhancedFilters]);
  
  const { data: catalogData, isLoading: loadingUnifiedBonds } = useQuery<EnhancedCatalogResponse>({
    queryKey: ['/api/bonds/enhanced-catalog', catalogQueryString],
    queryFn: async () => {
      const response = await fetch(`/api/bonds/enhanced-catalog${catalogQueryString}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch bonds catalog');
      }
      return response.json();
    },
    staleTime: 60000,
  });
  
  const rawBonds = (catalogData as any)?.data?.bonds ?? catalogData?.bonds ?? [];
  // Deduplicate bonds by ISIN to prevent duplicate key warnings
  const unifiedBonds = useMemo(() => {
    const seen = new Set<string>();
    return rawBonds.filter((bond: any) => {
      const key = bond.isin || bond.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawBonds]);
  
  // Get selected bonds for comparison
  const selectedBondsData = useMemo(() => {
    return unifiedBonds.filter((bond: any) => selectedBonds.includes(bond.isin));
  }, [unifiedBonds, selectedBonds]);

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
          <h1 className="text-3xl font-bold text-foreground mb-4">Bonds & NCDs</h1>
          <p className="text-muted-foreground text-lg">
            Fixed income investments with guaranteed returns
          </p>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <ScrollableTabsList>
            <TabsTrigger value="explore" data-testid="tab-explore" className="flex-shrink-0">Explore Bonds</TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar" className="flex-shrink-0">Calendar</TabsTrigger>
            <TabsTrigger value="marketplace" data-testid="tab-marketplace" className="flex-shrink-0">Marketplace</TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator" className="flex-shrink-0">Bond Calculator</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio" className="flex-shrink-0">My Bonds</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education" className="flex-shrink-0">Learn</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history" className="flex-shrink-0">
              <Database className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-bonds">
            
            {/* Bond Categories - Click to explore */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Explore Bond Categories</h2>
              <p className="text-muted-foreground">Click on a category to view available bonds</p>
            </div>
            
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

          <TabsContent value="calendar" className="space-y-6" data-testid="bond-calendar">
            <BondCalendar />
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
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
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
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
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
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
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
                    <div className="text-center p-6 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Maturity Amount</h3>
                      <p className="text-3xl font-bold text-finance-blue" data-testid="maturity-amount">
                        ₹{maturityAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Principal</h4>
                        <p className="text-lg font-bold text-finance-green" data-testid="principal-amount">
                          ₹{parseFloat(investmentAmount || "0").toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                        <h4 className="text-sm font-medium text-muted-foreground mb-1">Interest Earned</h4>
                        <p className="text-lg font-bold text-purple-600" data-testid="interest-earned">
                          ₹{interestEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>

                    {investmentAmount && bondYield && tenure && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Investment Summary</h4>
                        <div className="space-y-1 text-sm text-muted-foreground">
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

          <TabsContent value="marketplace" className="space-y-6" data-testid="bonds-marketplace">
            {/* Filter Section with Apply Button */}
            <div className="p-6 bg-card rounded-xl border border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Filter & Compare Bonds</h3>
                {compareMode && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30">
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
                      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Bond Comparison</DialogTitle>
                          <DialogDescription>
                            Compare key features of selected bonds side-by-side
                          </DialogDescription>
                        </DialogHeader>
                        <BondComparisonTable 
                          selectedBonds={selectedBondsData}
                          onRemove={(bondId) => {
                            const bond = selectedBondsData.find((b: any) => b.id === bondId);
                            if (bond) {
                              setSelectedBonds(prev => prev.filter(isin => isin !== bond.isin));
                            }
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
              </div>
              
              {/* Advanced Filters Toggle */}
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  data-testid="toggle-advanced-filters"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-200"
                >
                  {showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    variant={compareMode ? "default" : "outline"}
                    onClick={() => setCompareMode(!compareMode)}
                    data-testid="toggle-compare-mode"
                    size="sm"
                  >
                    {compareMode ? "Exit Compare" : "Compare Bonds"}
                  </Button>
                </div>
              </div>
              
              {showAdvancedFilters && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <EnhancedBondFilters
                    filters={enhancedFilters}
                    onFiltersChange={setEnhancedFilters}
                  />
                </div>
              )}
            </div>
            
            {/* Maturity Ladder Visualization */}
            {unifiedBonds.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <MaturityLadderView bonds={unifiedBonds} />
                </CardContent>
              </Card>
            )}
            
            {/* Filtered Bonds List with Checkboxes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Available Bonds ({unifiedBonds.length})</span>
                  {compareMode && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Select bonds using checkboxes to compare
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {unifiedBonds.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No bonds match your filters</p>
                    <p className="text-sm">Try adjusting your filter criteria</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unifiedBonds.map((bond: any, index: number) => (
                      <div 
                        key={`${bond.isin || bond.id}-${index}`}
                        className={`p-4 border rounded-lg hover:shadow-md transition-shadow ${
                          selectedBonds.includes(bond.isin) 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox for comparison */}
                          {compareMode && (
                            <input
                              type="checkbox"
                              checked={selectedBonds.includes(bond.isin)}
                              onChange={() => toggleBondSelection(bond.isin)}
                              className="mt-1 h-5 w-5 rounded border-border text-blue-600 focus:ring-blue-500"
                              data-testid={`checkbox-bond-${bond.isin}`}
                            />
                          )}
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-foreground">
                                  {bond.issuerName || bond.bondName}
                                </h4>
                                <p className="text-sm text-muted-foreground">{bond.isin}</p>
                              </div>
                              <div className="flex gap-2">
                                <Badge className={getCreditRatingColors(bond.creditRating)}>
                                  {bond.creditRating || 'NR'}
                                </Badge>
                                <Badge className={getBondTypeColors(bond.bondType)}>
                                  {bond.bondType}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                              <div>
                                <span className="text-xs text-muted-foreground">Coupon Rate</span>
                                <p className="font-semibold text-green-600">{bond.couponRate}%</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">YTM</span>
                                <p className="font-semibold text-blue-600">{bond.ytm || bond.couponRate}%</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Maturity</span>
                                <p className="font-semibold">{bond.maturityDate ? new Date(bond.maturityDate).toLocaleDateString() : 'N/A'}</p>
                              </div>
                              <div>
                                <span className="text-xs text-muted-foreground">Min Investment</span>
                                <p className="font-semibold">₹{(bond.minInvestment || bond.faceValue || 10000).toLocaleString()}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-4">
                              {bond.riskLevel && (
                                <Badge className={getRiskLevelColors(bond.riskLevel)}>
                                  {bond.riskLevel} Risk
                                </Badge>
                              )}
                              <Button variant="outline" size="sm" data-testid={`view-bond-${bond.isin}`}>
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Investor Classification & Eligibility */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BondMarketplace />
              </div>
              <div className="space-y-6">
                <InvestorClassificationCard />
              </div>
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
                  <h3 className="font-bold text-foreground mb-4">What are Bonds?</h3>
                  <p className="text-muted-foreground mb-4">
                    Bonds are debt securities where you lend money to an issuer (government or corporation) 
                    for a defined period at a fixed interest rate.
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Fixed income with predictable returns</li>
                    <li>• Lower risk compared to equity investments</li>
                    <li>• Regular interest payments</li>
                    <li>• Principal amount returned at maturity</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-foreground mb-4">Benefits of Bond Investment</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <LucideShield className="h-5 w-5 text-finance-blue mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Capital Protection</h4>
                        <p className="text-sm text-muted-foreground">Your principal is protected</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <IndianRupee className="h-5 w-5 text-finance-green mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Regular Income</h4>
                        <p className="text-sm text-muted-foreground">Fixed periodic interest payments</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-purple-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Portfolio Diversification</h4>
                        <p className="text-sm text-muted-foreground">Reduce overall portfolio risk</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6" data-testid="bonds-history">
            <ClientTransactionHistory category="bond" />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
