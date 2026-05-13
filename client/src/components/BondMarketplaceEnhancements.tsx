import { useState, useMemo, type CSSProperties } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  LucideShield as LucideShield, 
  TrendingUp, 
  Calendar, 
  IndianRupee, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Star, 
  Bell, 
  Lock,
  Unlock,
  Info,
  ArrowUpRight,
  FileText,
  BarChart3,
  RefreshCw,
  Eye,
  Plus,
  Minus,
  Scale,
  Target
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

interface EligibilityInfo {
  bondId: string;
  eligible: boolean;
  kycTierRequired: string;
  userKycTier: string;
  restrictions: string[];
  upgradeRequired: boolean;
  eligibilityDetails: {
    minimumInvestmentMet: boolean;
    kycCompliant: boolean;
    riskProfileMatch: boolean;
  };
}

interface RiskDisclosure {
  id: string;
  riskType: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  regulatoryReference?: string;
}

interface NetYieldInfo {
  bondId: string;
  grossYield: number;
  netYield: number;
  feeImpactBps: number;
  feeBreakdown: {
    brokerage: number;
    platformFee: number;
    gst: number;
    totalFees: number;
  };
  holdingPeriodYears: number;
}

interface BondSuitability {
  bondId: string;
  suitabilityScore: number;
  matchReasons: string[];
  mismatchReasons: string[];
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  recommended: boolean;
}

interface WatchlistItem {
  id: string;
  bondId: string;
  bondName: string;
  addedAt: Date;
}

interface BondAlert {
  id: string;
  bondId: string;
  alertType: 'yield_change' | 'price_change' | 'new_listing';
  threshold: number;
  isActive: boolean;
}

export function KYCTierBadge({ tier }: { tier: string }) {
  const getBadgeConfig = (kycTier: string) => {
    switch (kycTier) {
      case 'accredited_investor':
      case 'tier_3':
        return { label: 'Accredited', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800', icon: Star };
      case 'enhanced':
      case 'tier_2':
        return { label: 'Enhanced KYC', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', icon: LucideShield };
      case 'basic':
      case 'tier_1':
      default:
        return { label: 'Basic KYC', color: 'bg-muted text-muted-foreground border-border', icon: CheckCircle2 };
    }
  };

  const config = getBadgeConfig(tier);
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1 text-xs font-medium`} variant="outline">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function EligibilityBadge({ 
  eligible, 
  kycTierRequired, 
  onUpgradeClick 
}: { 
  eligible: boolean; 
  kycTierRequired: string; 
  onUpgradeClick?: () => void;
}) {
  if (eligible) {
    return (
      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 flex items-center gap-1" variant="outline">
        <Unlock className="h-3 w-3" />
        Eligible
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span onClick={onUpgradeClick} data-testid="upgrade-kyc-badge" className="cursor-pointer">
            <Badge 
              className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 flex items-center gap-1 hover:bg-amber-200 dark:bg-amber-800/30 transition-colors" 
              variant="outline"
            >
              <Lock className="h-3 w-3" />
              Upgrade KYC
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Requires {kycTierRequired} KYC tier to invest</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function DataFreshnessIndicator({ lastUpdated, source }: { lastUpdated: Date | null; source: string }) {
  const now = new Date();
  const freshness = lastUpdated ? (now.getTime() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60) : null;
  
  let freshnessStatus: 'fresh' | 'stale' | 'outdated' = 'fresh';
  if (freshness === null || freshness > 24) freshnessStatus = 'outdated';
  else if (freshness > 4) freshnessStatus = 'stale';
  
  const getStatusConfig = () => {
    switch (freshnessStatus) {
      case 'fresh':
        return { color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', label: 'Live' };
      case 'stale':
        return { color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30', label: 'Updated recently' };
      case 'outdated':
        return { color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-950/30', label: 'May be outdated' };
    }
  };

  const config = getStatusConfig();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs ${config.color} ${config.bgColor} px-2 py-1 rounded-full`}>
            <RefreshCw className="h-3 w-3" />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p>Source: {source === 'government_securities' ? 'RBI/ReDIES' : 'NSE/BSE'}</p>
            {lastUpdated && (
              <p>Updated: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function NetYieldDisplay({ 
  grossYield, 
  netYield, 
  feeBreakdown,
  onDetailsClick
}: { 
  grossYield: number; 
  netYield: number; 
  feeBreakdown: NetYieldInfo['feeBreakdown'];
  onDetailsClick?: () => void;
}) {
  const yieldImpact = grossYield - netYield;
  
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-muted-foreground">Net Yield</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={onDetailsClick}
                data-testid="net-yield-info"
              >
                <Info className="h-4 w-4 text-blue-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="w-64">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Gross Yield:</span>
                  <span className="font-medium">{grossYield.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Brokerage:</span>
                  <span>-₹{feeBreakdown.brokerage.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform Fee:</span>
                  <span>-₹{feeBreakdown.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST:</span>
                  <span>-₹{feeBreakdown.gst.toFixed(2)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-medium">
                  <span>Net Yield:</span>
                  <span className="text-green-600">{netYield.toFixed(2)}%</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-green-600 dark:text-green-400">
          {netYield.toFixed(2)}%
        </span>
        <span className="text-sm text-muted-foreground line-through">
          {grossYield.toFixed(2)}%
        </span>
        <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-800">
          -{yieldImpact.toFixed(2)}% fees
        </Badge>
      </div>
    </div>
  );
}

export function SuitabilityScore({ 
  suitabilityScore, 
  matchReasons, 
  mismatchReasons, 
  recommended 
}: BondSuitability) {
  const getScoreColor = () => {
    if (suitabilityScore >= 80) return 'text-green-600';
    if (suitabilityScore >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProgressColor = () => {
    if (suitabilityScore >= 80) return 'bg-green-500';
    if (suitabilityScore >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-card p-4 rounded-lg border border-border space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          <span className="font-medium text-foreground">Suitability Match</span>
        </div>
        {recommended && (
          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
            <Star className="h-3 w-3 mr-1" />
            Recommended
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={suitabilityScore} className="h-2" />
        </div>
        <span className={`text-lg font-bold ${getScoreColor()}`}>{suitabilityScore}%</span>
      </div>
      
      {matchReasons.length > 0 && (
        <div className="space-y-1">
          {matchReasons.slice(0, 3).map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
      
      {mismatchReasons.length > 0 && (
        <div className="space-y-1">
          {mismatchReasons.slice(0, 2).map((reason, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RiskDisclosureModal({ 
  bondId, 
  bondName,
  onAttest,
  isAttesting
}: { 
  bondId: string; 
  bondName: string;
  onAttest: () => void;
  isAttesting: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  
  const { data: disclosures, isLoading } = useQuery<RiskDisclosure[]>({
    queryKey: ['/api/bonds/risk-disclosures', bondId],
  });

  const allAcknowledged = disclosures?.every(d => acknowledged[d.id]) ?? false;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'medium': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';
      default: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">SEBI Mandatory Risk Disclosure</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
          Before proceeding with your investment in {bondName}, you must acknowledge the following risks as mandated by SEBI regulations.
        </AlertDescription>
      </Alert>

      <div className="max-h-[400px] overflow-y-auto space-y-3">
        {disclosures?.map((disclosure) => (
          <div 
            key={disclosure.id}
            className={`p-4 rounded-lg border ${getSeverityColor(disclosure.severity)}`}
          >
            <div className="flex items-start gap-3">
              <Checkbox 
                id={`disclosure-${disclosure.id}`}
                checked={acknowledged[disclosure.id] || false}
                onCheckedChange={(checked) => 
                  setAcknowledged(prev => ({ ...prev, [disclosure.id]: !!checked }))
                }
                data-testid={`disclosure-checkbox-${disclosure.id}`}
              />
              <div className="flex-1 space-y-2">
                <Label 
                  htmlFor={`disclosure-${disclosure.id}`}
                  className="font-medium cursor-pointer"
                >
                  {disclosure.riskType}
                </Label>
                <p className="text-sm opacity-80">{disclosure.description}</p>
                {disclosure.regulatoryReference && (
                  <p className="text-xs opacity-60">Reference: {disclosure.regulatoryReference}</p>
                )}
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {disclosure.severity}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t">
        <Checkbox 
          id="final-acknowledgment"
          checked={allAcknowledged}
          disabled
          data-testid="final-acknowledgment"
        />
        <Label htmlFor="final-acknowledgment" className="text-sm text-muted-foreground">
          I have read and understood all risk disclosures above
        </Label>
      </div>

      <Button 
        className="w-full" 
        disabled={!allAcknowledged || isAttesting}
        onClick={onAttest}
        data-testid="attest-risks-button"
      >
        {isAttesting ? (
          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mr-2" />
        )}
        {isAttesting ? 'Processing...' : 'I Acknowledge All Risks & Proceed'}
      </Button>
    </div>
  );
}

export function WatchlistButton({ 
  bondId, 
  bondName,
  isWatched,
  onToggle
}: { 
  bondId: string; 
  bondName: string;
  isWatched: boolean;
  onToggle: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`p-2 ${isWatched ? 'text-amber-500' : 'text-muted-foreground'}`}
            onClick={onToggle}
            data-testid={`watchlist-button-${bondId}`}
          >
            <Star className={`h-4 w-4 ${isWatched ? 'fill-current' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isWatched ? 'Remove from Watchlist' : 'Add to Watchlist'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AlertButton({ 
  bondId,
  hasAlert,
  onManageAlert
}: { 
  bondId: string;
  hasAlert: boolean;
  onManageAlert: () => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`p-2 ${hasAlert ? 'text-blue-500' : 'text-muted-foreground'}`}
            onClick={onManageAlert}
            data-testid={`alert-button-${bondId}`}
          >
            <Bell className={`h-4 w-4 ${hasAlert ? 'fill-current' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasAlert ? 'Manage Price Alert' : 'Set Price Alert'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BondFilters {
  creditRating?: string[];
  maturityRange?: [number, number];
  yieldRange?: [number, number];
  minInvestment?: number;
  taxFree?: boolean;
  instrumentType?: string[];
  sortBy?: string;
}

// Credit rating color utility - returns explicit Tailwind classes (purge-safe)
const getFilterCreditRatingColors = (rating: string, isSelected: boolean): string => {
  const r = rating.toUpperCase();
  if (isSelected) {
    // Selected state - darker, more prominent colors
    if (r === 'SOV' || r === 'AAA') return 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700';
    if (r.startsWith('AA')) return 'bg-green-600 text-white border-green-700 hover:bg-green-700';
    if (r.startsWith('A')) return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700';
    if (r.startsWith('BBB')) return 'bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-600';
    return 'bg-muted text-foreground border-border hover:bg-muted';
  } else {
    // Unselected state - lighter background with colored text/border
    if (r === 'SOV' || r === 'AAA') return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30';
    if (r.startsWith('AA')) return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:bg-green-900/30';
    if (r.startsWith('A')) return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:bg-blue-900/30';
    if (r.startsWith('BBB')) return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30';
    return 'bg-muted text-muted-foreground border-border hover:bg-muted';
  }
};

// Progressive color utility for sliders - interpolates from green → yellow → orange → red
// Returns HSL color string for dynamic inline styling
const getProgressiveColor = (value: number, min: number, max: number): string => {
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Hue: 120 (green) → 60 (yellow) → 30 (orange) → 0 (red)
  const hue = 120 - (percentage * 120);
  // Saturation: stays high (70-80%)
  const saturation = 70 + (percentage * 10);
  // Lightness: 45-50% for good visibility
  const lightness = 45;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Get lighter version for track background
const getProgressiveColorLight = (value: number, min: number, max: number): string => {
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = 120 - (percentage * 120);
  return `hsl(${hue}, 60%, 90%)`;
};

// Get label color based on value (darker version)
const getProgressiveLabelColor = (value: number, min: number, max: number): string => {
  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = 120 - (percentage * 120);
  return `hsl(${hue}, 70%, 35%)`;
};

// Instrument type color utility - returns explicit Tailwind classes (purge-safe)
const getFilterInstrumentTypeColors = (type: string, isSelected: boolean): string => {
  const t = type.toLowerCase();
  if (isSelected) {
    // Selected state - darker, more prominent colors
    if (t === 'gsec' || t === 'government') return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700';
    if (t === 'sdl' || t === 'state') return 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700';
    if (t === 'tbill') return 'bg-sky-600 text-white border-sky-700 hover:bg-sky-700';
    if (t === 'sgb' || t === 'gold') return 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700';
    if (t === 'corporate') return 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700';
    if (t === 'ncd') return 'bg-orange-600 text-white border-orange-700 hover:bg-orange-700';
    if (t === 'infrastructure') return 'bg-teal-600 text-white border-teal-700 hover:bg-teal-700';
    if (t === 'tax_free') return 'bg-green-600 text-white border-green-700 hover:bg-green-700';
    return 'bg-muted text-foreground border-border hover:bg-muted';
  } else {
    // Unselected state - lighter background with colored text/border
    if (t === 'gsec' || t === 'government') return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:bg-blue-900/30';
    if (t === 'sdl' || t === 'state') return 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900/30';
    if (t === 'tbill') return 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:bg-sky-900/30';
    if (t === 'sgb' || t === 'gold') return 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:bg-amber-900/30';
    if (t === 'corporate') return 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:bg-purple-900/30';
    if (t === 'ncd') return 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:bg-orange-900/30';
    if (t === 'infrastructure') return 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:bg-teal-900/30';
    if (t === 'tax_free') return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:bg-green-900/30';
    return 'bg-muted text-muted-foreground border-border hover:bg-muted';
  }
};

export function EnhancedBondFilters({
  filters,
  onFiltersChange
}: {
  filters: BondFilters;
  onFiltersChange: (filters: BondFilters) => void;
}) {
  const creditRatings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'SOV'];
  const instrumentTypes = ['gsec', 'sdl', 'tbill', 'sgb', 'corporate', 'ncd', 'infrastructure', 'tax_free'];

  const toggleCreditRating = (rating: string) => {
    const current = filters.creditRating || [];
    const updated = current.includes(rating)
      ? current.filter(r => r !== rating)
      : [...current, rating];
    onFiltersChange({ ...filters, creditRating: updated });
  };

  const toggleInstrumentType = (type: string) => {
    const current = filters.instrumentType || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    onFiltersChange({ ...filters, instrumentType: updated });
  };

  return (
    <div className="space-y-6 p-4 bg-card rounded-xl border border-border">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-foreground">Advanced Filters</h3>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onFiltersChange({})}
          data-testid="clear-all-filters"
        >
          Clear All
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium mb-2 block">Credit Rating</Label>
          <div className="flex flex-wrap gap-2">
            {creditRatings.map(rating => {
              const isSelected = filters.creditRating?.includes(rating) || false;
              return (
                <Badge
                  key={rating}
                  variant="outline"
                  className={`cursor-pointer transition-colors ${getFilterCreditRatingColors(rating, isSelected)}`}
                  onClick={() => toggleCreditRating(rating)}
                  data-testid={`filter-rating-${rating}`}
                >
                  {rating}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <Label 
            className="text-sm font-medium mb-2 block transition-colors"
            style={{ color: getProgressiveLabelColor(filters.maturityRange?.[1] || 30, 0, 30) }}
          >
            Maturity Range: <span className="font-bold">{filters.maturityRange?.[0] || 0} - {filters.maturityRange?.[1] || 30} years</span>
          </Label>
          <div 
            className="py-4 px-2 rounded-lg"
            style={{
              '--slider-track-bg': getProgressiveColorLight(filters.maturityRange?.[1] || 30, 0, 30),
              '--slider-range-bg': getProgressiveColor(filters.maturityRange?.[1] || 30, 0, 30),
              '--slider-thumb-border': getProgressiveColor(filters.maturityRange?.[1] || 30, 0, 30),
              background: `linear-gradient(to right, hsl(120, 60%, 92%), hsl(60, 60%, 92%), hsl(30, 60%, 92%), hsl(0, 60%, 92%))`,
            } as CSSProperties}
          >
            <Slider
              value={filters.maturityRange || [0, 30]}
              onValueChange={(value) => onFiltersChange({ ...filters, maturityRange: value as [number, number] })}
              min={0}
              max={30}
              step={1}
              className="[&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-track]]:h-3 [&_[data-radix-slider-track]]:border [&_[data-radix-slider-track]]:border-border [&_[data-radix-slider-track]]:shadow-sm [&_[data-radix-slider-range]]:bg-[var(--slider-range-bg)] [&_[data-radix-slider-range]]:h-3 [&_[data-radix-slider-thumb]]:border-[var(--slider-thumb-border)] [&_[data-radix-slider-thumb]]:border-3 [&_[data-radix-slider-thumb]]:bg-card [&_[data-radix-slider-thumb]]:shadow-lg [&_[data-radix-slider-thumb]]:h-6 [&_[data-radix-slider-thumb]]:w-6"
              data-testid="filter-maturity-slider"
            />
          </div>
        </div>

        <div>
          <Label 
            className="text-sm font-medium mb-2 block transition-colors"
            style={{ color: getProgressiveLabelColor(filters.yieldRange?.[1] || 15, 0, 15) }}
          >
            Yield Range: <span className="font-bold">{filters.yieldRange?.[0] || 0}% - {filters.yieldRange?.[1] || 15}%</span>
          </Label>
          <div 
            className="py-4 px-2 rounded-lg"
            style={{
              '--slider-track-bg': getProgressiveColorLight(filters.yieldRange?.[1] || 15, 0, 15),
              '--slider-range-bg': getProgressiveColor(filters.yieldRange?.[1] || 15, 0, 15),
              '--slider-thumb-border': getProgressiveColor(filters.yieldRange?.[1] || 15, 0, 15),
              background: `linear-gradient(to right, hsl(120, 60%, 92%), hsl(60, 60%, 92%), hsl(30, 60%, 92%), hsl(0, 60%, 92%))`,
            } as CSSProperties}
          >
            <Slider
              value={filters.yieldRange || [0, 15]}
              onValueChange={(value) => onFiltersChange({ ...filters, yieldRange: value as [number, number] })}
              min={0}
              max={15}
              step={0.25}
              className="[&_[data-radix-slider-track]]:bg-muted [&_[data-radix-slider-track]]:h-3 [&_[data-radix-slider-track]]:border [&_[data-radix-slider-track]]:border-border [&_[data-radix-slider-track]]:shadow-sm [&_[data-radix-slider-range]]:bg-[var(--slider-range-bg)] [&_[data-radix-slider-range]]:h-3 [&_[data-radix-slider-thumb]]:border-[var(--slider-thumb-border)] [&_[data-radix-slider-thumb]]:border-3 [&_[data-radix-slider-thumb]]:bg-card [&_[data-radix-slider-thumb]]:shadow-lg [&_[data-radix-slider-thumb]]:h-6 [&_[data-radix-slider-thumb]]:w-6"
              data-testid="filter-yield-slider"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Minimum Investment</Label>
          <Select
            value={filters.minInvestment?.toString() || "any"}
            onValueChange={(v) => onFiltersChange({ 
              ...filters, 
              minInvestment: v === "any" ? undefined : parseInt(v) 
            })}
          >
            <SelectTrigger data-testid="filter-min-investment">
              <SelectValue placeholder="Any amount" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any amount</SelectItem>
              <SelectItem value="10000">Up to ₹10,000</SelectItem>
              <SelectItem value="50000">Up to ₹50,000</SelectItem>
              <SelectItem value="100000">Up to ₹1,00,000</SelectItem>
              <SelectItem value="500000">Up to ₹5,00,000</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Instrument Types</Label>
          <div className="flex flex-wrap gap-2">
            {instrumentTypes.map(type => {
              const isSelected = filters.instrumentType?.includes(type) || false;
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className={`cursor-pointer transition-colors capitalize ${getFilterInstrumentTypeColors(type, isSelected)}`}
                  onClick={() => toggleInstrumentType(type)}
                  data-testid={`filter-type-${type}`}
                >
                  {type.replace('_', ' ')}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="tax-free-filter"
            checked={filters.taxFree || false}
            onCheckedChange={(checked) => onFiltersChange({ ...filters, taxFree: !!checked })}
            data-testid="filter-tax-free"
          />
          <Label htmlFor="tax-free-filter" className="text-sm cursor-pointer">
            Tax-Free Bonds Only
          </Label>
        </div>

        <div>
          <Label className="text-sm font-medium mb-2 block">Sort By</Label>
          <Select
            value={filters.sortBy || "yield_desc"}
            onValueChange={(v) => onFiltersChange({ ...filters, sortBy: v })}
          >
            <SelectTrigger data-testid="filter-sort-by">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yield_desc">Highest Yield First</SelectItem>
              <SelectItem value="yield_asc">Lowest Yield First</SelectItem>
              <SelectItem value="maturity_asc">Earliest Maturity</SelectItem>
              <SelectItem value="maturity_desc">Latest Maturity</SelectItem>
              <SelectItem value="rating_desc">Highest Rating</SelectItem>
              <SelectItem value="min_investment_asc">Lowest Investment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function MaturityLadderView({ bonds }: { bonds: UnifiedBond[] }) {
  const ladderData = useMemo(() => {
    const now = new Date();
    const buckets = [
      { label: '< 1 Year', min: 0, max: 1, bonds: [] as UnifiedBond[] },
      { label: '1-3 Years', min: 1, max: 3, bonds: [] as UnifiedBond[] },
      { label: '3-5 Years', min: 3, max: 5, bonds: [] as UnifiedBond[] },
      { label: '5-10 Years', min: 5, max: 10, bonds: [] as UnifiedBond[] },
      { label: '> 10 Years', min: 10, max: Infinity, bonds: [] as UnifiedBond[] },
    ];

    bonds.forEach(bond => {
      if (bond.yearsToMaturity !== null) {
        const bucket = buckets.find(b => 
          bond.yearsToMaturity! >= b.min && bond.yearsToMaturity! < b.max
        );
        if (bucket) bucket.bonds.push(bond);
      }
    });

    return buckets;
  }, [bonds]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-foreground">Maturity Ladder</h3>
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        {ladderData.map((bucket, index) => (
          <div key={bucket.label} className="space-y-2">
            <div className="text-center">
              <div 
                className="h-32 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg flex items-end justify-center transition-all"
                style={{ 
                  height: `${Math.max(30, Math.min(150, bucket.bonds.length * 30))}px` 
                }}
              >
                <span className="text-foreground font-bold text-lg mb-2">
                  {bucket.bonds.length}
                </span>
              </div>
              <div className="bg-muted p-2 rounded-b-lg">
                <p className="text-xs font-medium text-muted-foreground">
                  {bucket.label}
                </p>
                {bucket.bonds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {(bucket.bonds.reduce((sum, b) => 
                      sum + (parseFloat(b.yieldToMaturity || '0') || 0), 0
                    ) / bucket.bonds.length).toFixed(2)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BondComparisonTable({ 
  selectedBonds,
  onRemove 
}: { 
  selectedBonds: UnifiedBond[];
  onRemove: (bondId: string) => void;
}) {
  if (selectedBonds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select bonds to compare their features side-by-side</p>
      </div>
    );
  }

  const attributes = [
    { label: 'Issuer', key: 'issuerName' },
    { label: 'Type', key: 'displayType' },
    { label: 'Credit Rating', key: 'creditRating' },
    { label: 'Coupon Rate', key: 'couponRate', format: (v: string) => v ? `${v}%` : '-' },
    { label: 'Yield to Maturity', key: 'yieldToMaturity', format: (v: string) => v ? `${v}%` : '-' },
    { label: 'Years to Maturity', key: 'yearsToMaturity', format: (v: number) => v ? `${v.toFixed(1)} yrs` : '-' },
    { label: 'Min Investment', key: 'minInvestment', format: (v: number) => `₹${v.toLocaleString()}` },
    { label: 'Face Value', key: 'faceValue', format: (v: number) => `₹${v.toLocaleString()}` },
    { label: 'Tax Status', key: 'isTaxFree', format: (v: boolean) => v ? 'Tax Free' : 'Taxable' },
    { label: 'Exchange', key: 'exchange' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-3 bg-muted font-semibold">Attribute</th>
            {selectedBonds.map(bond => (
              <th key={bond.id} className="text-left p-3 bg-muted">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{bond.bondName}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={() => onRemove(bond.id)}
                    data-testid={`remove-compare-${bond.id}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map(attr => (
            <tr key={attr.key} className="border-t border-border">
              <td className="p-3 font-medium text-muted-foreground text-sm">
                {attr.label}
              </td>
              {selectedBonds.map(bond => {
                const bondRecord = bond as unknown as Record<string, unknown>;
                const value = bondRecord[attr.key];
                const formatted = attr.format ? (attr.format as (v: unknown) => string)(value) : (value ?? '-');
                return (
                  <td key={bond.id} className="p-3 text-sm">
                    {String(formatted)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useEnhancedBondMarketplace(userId?: string) {
  const { toast } = useToast();

  const { data: eligibility, isLoading: loadingEligibility } = useQuery({
    queryKey: ['/api/bonds/eligibility', userId],
    enabled: !!userId,
  });

  const { data: watchlist, isLoading: loadingWatchlist } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/bonds/watchlist', userId],
    enabled: !!userId,
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<BondAlert[]>({
    queryKey: ['/api/bonds/alerts', userId],
    enabled: !!userId,
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (bondId: string) => {
      return apiRequest('/api/bonds/watchlist', {
        method: 'POST',
        body: JSON.stringify({ bondId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/watchlist'] });
      toast({ title: 'Added to watchlist' });
    },
    onError: () => {
      toast({ title: 'Failed to add to watchlist', variant: 'destructive' });
    },
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (bondId: string) => {
      return apiRequest(`/api/bonds/watchlist/${bondId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/watchlist'] });
      toast({ title: 'Removed from watchlist' });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async (params: { bondId: string; alertType: string; threshold: number }) => {
      return apiRequest('/api/bonds/alerts', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bonds/alerts'] });
      toast({ title: 'Alert created' });
    },
  });

  const attestRisksMutation = useMutation({
    mutationFn: async (params: { bondId: string; disclosureIds: string[] }) => {
      return apiRequest('/api/bonds/risk-attestation', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      toast({ title: 'Risk disclosure acknowledged' });
    },
  });

  const isWatched = (bondId: string) => watchlist?.some(w => w.bondId === bondId) ?? false;
  const hasAlert = (bondId: string) => alerts?.some(a => a.bondId === bondId && a.isActive) ?? false;

  const toggleWatchlist = (bondId: string) => {
    if (isWatched(bondId)) {
      removeFromWatchlistMutation.mutate(bondId);
    } else {
      addToWatchlistMutation.mutate(bondId);
    }
  };

  return {
    eligibility,
    watchlist,
    alerts,
    isWatched,
    hasAlert,
    toggleWatchlist,
    createAlert: createAlertMutation.mutate,
    attestRisks: attestRisksMutation.mutate,
    isAttesting: attestRisksMutation.isPending,
    loading: loadingEligibility || loadingWatchlist || loadingAlerts,
  };
}
