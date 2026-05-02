import { PortfolioV3Dashboard } from "@/components/portfolio/PortfolioV3Dashboard";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { RebalanceDashboard } from "@/components/dashboard/rebalance-dashboard";
import { RebalancingSuggestions } from "@/components/rebalancing-suggestions";
import { PiChatSummaries } from "@/components/portfolio/pi-chat-summaries";
import { CommodityTracker } from "@/components/portfolio/commodity-tracker";
import { PortfolioPerformanceWidgets } from "@/components/portfolio/PortfolioPerformanceWidgets";
import { PortfolioHero } from "@/components/portfolio/PortfolioHero";
import { PortfolioPerformanceChart } from "@/components/portfolio/PortfolioPerformanceChart";
import { AssetAllocationChart } from "@/components/portfolio/AssetAllocationChart";
import { QuickInsights } from "@/components/portfolio/QuickInsights";
import { ExternalPortfolioSync } from "@/components/portfolio-sync/ExternalPortfolioSync";
import { UnifiedFinancialProfile } from "@/components/dashboard/UnifiedFinancialProfile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePortfoliosByPan, useEnhancedPortfolioHoldings, usePortfolioPerformance, useEpfHoldings, usePpfHoldings, useEpsHoldings, useInsuranceHoldings, useNpsAccounts, useApyAccounts } from "@/hooks/use-portfolio";
import { LoadingState } from "@/components/LoadingState";
import { Plus, TrendingUp, TrendingDown, RefreshCw, Bot, Coins, CreditCard, PiggyBank, Shield, Target, Calculator, AlertTriangle, Building2, ExternalLink, Briefcase, History, FileText, CheckCircle2, Clock, XCircle, Loader2, ChevronDown, Landmark } from "lucide-react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useEffect, Suspense } from "react";
import { useConsent, type SchemeType } from "@/hooks/use-consent";
import { ConsentDialog } from "@/components/ConsentDialog";
import { ConsentAwareSchemeTab } from "@/components/ConsentAwareSchemeTab";
import { useAuth } from "@/hooks/useAuth";
import { CurrencySelector } from "@/components/CurrencySelector";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";
import { useNetworkState } from "@/hooks/use-network-state";

interface UnifiedOrder {
  id: string;
  orderNumber: string;
  productType: string;
  productName: string;
  orderType: string;
  amount: string;
  quantity?: string;
  status: string;
  paymentStatus: string;
  executionStatus: string;
  createdAt: string;
  completedAt?: string;
}

// Portfolio source types for SEBI compliance
type PortfolioSource = 'FINTEKPRO' | 'EXTERNAL';
type PortfolioView = 'FINTEKPRO' | 'TRACKER' | 'EXTERNAL';

interface EnhancedHoldingWithSource {
  id: string;
  symbol: string;
  assetType?: string;
  quantity: number;
  avgPrice: string;
  currentValue: string;
  investedValue: string;
  gainLoss: string;
  gainLossPercent: string;
  exchange?: string;
  isin?: string;
  folioNumber?: string;
  dematId?: string;
  source: PortfolioSource;
  portfolioView: PortfolioView;
  [key: string]: any;
}

// Compute FintekPro holdings from completed orders with multiple matching keys
function computeFintekProHoldings(orders: UnifiedOrder[] | undefined): Map<string, { quantity: number; investedValue: number; productName: string; productType: string; normalizedKeys: string[] }> {
  const holdingsMap = new Map();
  if (!orders) return holdingsMap;
  
  orders
    .filter(o => o.status === 'completed')
    .forEach(order => {
      // Create multiple normalized keys for matching
      const productName = order.productName || '';
      const primaryKey = productName.toUpperCase().replace(/\s+/g, '_');
      
      // Generate normalized matching keys
      const normalizedKeys: string[] = [
        primaryKey,
        productName.toUpperCase().replace(/[^A-Z0-9]/g, ''), // Alphanumeric only
        productName.split(/[-\s]+/)[0]?.toUpperCase() || '', // First word (often ticker)
      ].filter(Boolean);
      
      const existing = holdingsMap.get(primaryKey) || { 
        quantity: 0, 
        investedValue: 0, 
        productName: order.productName, 
        productType: order.productType,
        normalizedKeys 
      };
      existing.quantity += parseFloat(order.quantity || '1');
      existing.investedValue += parseFloat(order.amount || '0');
      holdingsMap.set(primaryKey, existing);
    });
  
  return holdingsMap;
}

// Match holdings using symbol, ISIN, name, or fuzzy matching
function matchHolding(holding: any, fintekproHoldings: Map<string, any>): boolean {
  // Check if holding already has source metadata from backend
  if (holding.source === 'FINTEKPRO' || holding.transactionSource === 'fintekpro' || holding.platform === 'fintekpro') {
    return true;
  }
  
  // If no FintekPro orders exist, cannot match
  if (fintekproHoldings.size === 0) return false;
  
  const holdingSymbol = (holding.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const holdingName = (holding.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // Check all FintekPro holdings for matches
  const fpHoldingsArray = Array.from(fintekproHoldings.values());
  for (let i = 0; i < fpHoldingsArray.length; i++) {
    const fpHolding = fpHoldingsArray[i];
    const fpName = (fpHolding.productName || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Exact ISIN match (highest priority)
    if (holding.isin && fpHolding.isin && holding.isin === fpHolding.isin) return true;
    
    // Symbol contained in FintekPro product name or vice versa
    if (holdingSymbol && fpName.includes(holdingSymbol)) return true;
    if (holdingSymbol && holdingSymbol.includes(fpName.split(/[^A-Z0-9]/)[0])) return true;
    
    // Name similarity check
    if (holdingName && fpName && (holdingName.includes(fpName) || fpName.includes(holdingName))) return true;
    
    // Check normalized keys
    if (fpHolding.normalizedKeys) {
      for (let j = 0; j < fpHolding.normalizedKeys.length; j++) {
        const key = fpHolding.normalizedKeys[j];
        if (holdingSymbol === key || holdingName.includes(key) || key.includes(holdingSymbol)) return true;
      }
    }
  }
  
  return false;
}

// Compute External Portfolio = Tracker - FintekPro (DERIVED, NEVER STORED)
function computeExternalPortfolio(
  trackerHoldings: any[] | undefined, 
  fintekproHoldings: Map<string, any>
): EnhancedHoldingWithSource[] {
  if (!trackerHoldings) return [];
  
  return trackerHoldings
    .filter(holding => !matchHolding(holding, fintekproHoldings))
    .map(holding => ({
      ...holding,
      source: 'EXTERNAL' as PortfolioSource,
      portfolioView: 'EXTERNAL' as PortfolioView
    }));
}

// Tag all Tracker holdings with their source
function tagTrackerHoldings(
  trackerHoldings: any[] | undefined, 
  fintekproHoldings: Map<string, any>
): EnhancedHoldingWithSource[] {
  if (!trackerHoldings) return [];
  
  return trackerHoldings.map(holding => ({
    ...holding,
    source: matchHolding(holding, fintekproHoldings) ? 'FINTEKPRO' as PortfolioSource : 'EXTERNAL' as PortfolioSource,
    portfolioView: 'TRACKER' as PortfolioView
  }));
}

function HoldingsTableSection({ portfolioId }: { portfolioId: string }) {
  const { data: enhancedHoldings } = useSuspenseQuery<import("@/hooks/use-portfolio").EnhancedHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings', 'enhanced'],
    refetchInterval: 30000,
    select: (data: any) => Array.isArray(data) ? data : [],
  });

  if (!enhancedHoldings || enhancedHoldings.length === 0) {
    return (
      <div className="text-center py-8" data-testid="empty-holdings">
        <p className="text-muted-foreground mb-4">No holdings found</p>
        <Button variant="outline">Add Your First Investment</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="holdings-list">
      {Object.entries(
        enhancedHoldings.reduce((groups: Record<string, typeof enhancedHoldings>, holding) => {
          const assetType = holding.assetType;
          if (!groups[assetType]) groups[assetType] = [];
          groups[assetType].push(holding);
          return groups;
        }, {})
      ).map(([assetType, holdings]) => {
        const totalInvested = Array.isArray(holdings) ? holdings.reduce((sum, h) => sum + parseFloat(h.investedValue || '0'), 0) : 0;
        const totalCurrent = Array.isArray(holdings) ? holdings.reduce((sum, h) => sum + parseFloat(h.currentValue || '0'), 0) : 0;
        const totalGainLoss = totalCurrent - totalInvested;
        const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
        const assetTypeLabel = assetType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        return (
          <div key={assetType} className="bg-muted/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-foreground capitalize">{assetTypeLabel}</h3>
                <p className="text-sm text-muted-foreground">{holdings?.length || 0} holding{(holdings?.length || 0) !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">₹{totalCurrent.toLocaleString()}</p>
                <div className={`text-sm flex items-center justify-end ${totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalGainLoss >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {totalGainLoss >= 0 ? '+' : ''}₹{totalGainLoss.toFixed(0)} ({totalGainLossPercent.toFixed(1)}%)
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {holdings?.map((holding) => (
                <div key={holding.id} className="flex justify-between items-center p-3 bg-background rounded-md" data-testid={`holding-${holding.symbol}`}>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-foreground">{holding.symbol}</h4>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-0.5 rounded">{holding.exchange}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Qty: {holding.quantity} @ ₹{holding.avgPrice}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">₹{parseFloat(holding.currentValue).toLocaleString()}</p>
                    <div className={`text-sm ${parseFloat(holding.gainLoss) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {parseFloat(holding.gainLoss) >= 0 ? '+' : ''}{parseFloat(holding.gainLossPercent).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioChartSection({ portfolioId }: { portfolioId: string }) {
  const { data: performance } = useSuspenseQuery<import("@/hooks/use-portfolio").PortfolioPerformance>({
    queryKey: ['/api/portfolios', portfolioId, 'performance'],
    refetchInterval: 30000,
  });
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <PortfolioPerformanceChart
        currentValue={performance?.totalCurrentValue ? parseFloat(performance.totalCurrentValue) : 0}
        investedValue={performance?.totalInvestedValue ? parseFloat(performance.totalInvestedValue) : 0}
        isLoading={false}
      />
      <AssetAllocationChart
        assets={(performance?.assetBreakdown ?? []).map((asset: any, _index: number) => ({
          name: asset.name,
          value: asset.value,
          percentage: parseFloat(asset.percentage),
          color: asset.color,
          changePercent: parseFloat(asset.changePercent || '0'),
        }))}
        totalValue={performance?.totalCurrentValue ? parseFloat(performance.totalCurrentValue) : 0}
        isLoading={false}
      />
    </div>
  );
}

function FintekproOrdersSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data: fintekproOrders } = useSuspenseQuery<import("@shared/schema").UnifiedOrder[]>({
    queryKey: ["/api/unified-orders"],
    enabled: isAuthenticated,
  });
  if (!Array.isArray(fintekproOrders) || fintekproOrders.length === 0) {
    return (
      <div className="text-center py-16" data-testid="fintekpro-empty">
        <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">No FintekPro Investments</h3>
        <p className="text-muted-foreground text-center max-w-md mx-auto mb-6">
          You haven't made any investments through FintekPro yet. Start investing to see your portfolio here.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="stat-total-orders">
          <div className="text-sm text-muted-foreground">Total Orders</div>
          <div className="text-2xl font-bold text-blue-600">{fintekproOrders.length}</div>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid="stat-completed-orders">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {fintekproOrders.filter(o => o.status === 'completed').length}
          </div>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg" data-testid="stat-pending-orders">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">
            {fintekproOrders.filter(o => o.status === 'processing' || o.status === 'initiated').length}
          </div>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg" data-testid="stat-total-invested">
          <div className="text-sm text-muted-foreground">Total Invested</div>
          <div className="text-2xl font-bold text-purple-600">
            ₹{fintekproOrders.reduce((sum, o) => sum + parseFloat(o.amount || '0'), 0).toLocaleString()}
          </div>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fintekproOrders.map((order) => (
              <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                <TableCell className="font-medium">{order.orderNumber}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{order.productName}</div>
                    <div className="text-xs text-muted-foreground capitalize">{order.productType?.replace('_', ' ')}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">{order.orderType}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  ₹{parseFloat(order.amount || '0').toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={
                    order.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                    order.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                    order.status === 'cancelled' || order.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                    'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  }>
                    {order.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {order.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {(order.status === 'initiated' || order.status === 'pending') && <Clock className="h-3 w-3 mr-1" />}
                    {(order.status === 'cancelled' || order.status === 'failed') && <XCircle className="h-3 w-3 mr-1" />}
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function Portfolio() {

  // Get portfolios linked to user's PAN card for enhanced security
  const { data: portfolios, isLoading: portfoliosLoading, error: portfoliosError } = usePortfoliosByPan();
  const portfolioId = portfolios?.[0]?.id;
  const { user, isAuthenticated } = useAuth();


  // Feature flag for Portfolio V3
  const { enabled: portfolioV3Enabled } = useFeatureFlag("portfolio_v3");
  // Consent management state
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [currentSchemeType, setCurrentSchemeType] = useState<SchemeType>("epf");
  const { checkConsent, grantConsent } = useConsent();

  // Currency state
  const defaultCurrency = portfolios?.[0]?.baseCurrency || "INR";
  const [selectedCurrency, setSelectedCurrency] = useState(defaultCurrency);

  const { data: enhancedHoldings, isLoading: holdingsLoading, refetch: refetchHoldings } = useEnhancedPortfolioHoldings(portfolioId || "");
  const { data: performance, isLoading: performanceLoading, refetch: refetchPerformance } = usePortfolioPerformance(portfolioId || "");

  // Portfolio conversion query
  const { data: convertedPortfolio, isLoading: conversionLoading } = useQuery({
    queryKey: ["/api/portfolios", portfolioId, "convert", selectedCurrency],
    queryFn: async () => {
      const response = await fetch(`/api/portfolios/${portfolioId}/convert?targetCurrency=${selectedCurrency}`);
      if (!response.ok) throw new Error("Failed to convert portfolio");
      return response.json();
    },
    enabled: !!portfolioId && selectedCurrency !== defaultCurrency,
  });

  // Government Scheme Holdings data - will be conditionally fetched based on consent
  const { data: epfHoldings, isLoading: epfLoading } = useEpfHoldings();
  const { data: ppfHoldings, isLoading: ppfLoading } = usePpfHoldings();
  const { data: epsHoldings, isLoading: epsLoading } = useEpsHoldings();
  
  // Insurance Holdings data from NSDL/CDSL
  const { data: insuranceHoldings, isLoading: insuranceLoading } = useInsuranceHoldings();

  // NPS and APY data
  const { data: npsAccounts, isLoading: npsLoading } = useNpsAccounts();
  const { data: apyAccounts, isLoading: apyLoading } = useApyAccounts();

  // FintekPro Orders - Internal transactions done through platform
  const { data: fintekproOrders, isLoading: ordersLoading } = useQuery<UnifiedOrder[]>({
    queryKey: ["/api/unified-orders"],
    enabled: isAuthenticated,
  });
  
  // PORTFOLIO SEGREGATION (SEBI Compliance)
  // 1. FintekPro Portfolio: Investments executed through FintekPro (from orders)
  // 2. Tracker Portfolio: PAN-level consolidated holdings (all holdings with source tags)
  // 3. External Portfolio: DERIVED as (Tracker - FintekPro), NEVER STORED
  const fintekproHoldingsMap = computeFintekProHoldings(fintekproOrders);
  const taggedTrackerHoldings = tagTrackerHoldings(enhancedHoldings, fintekproHoldingsMap);
  const externalHoldings = computeExternalPortfolio(enhancedHoldings, fintekproHoldingsMap);
  
  // Separate FintekPro holdings from Tracker for display
  const fintekproHoldingsFromTracker = taggedTrackerHoldings.filter(h => h.source === 'FINTEKPRO');
  
  const isLoading = portfoliosLoading || holdingsLoading || performanceLoading;
  const totalValue = performance ? parseFloat(performance.totalCurrentValue) : 0;

  // Compute dynamic portfolio analytics
  const computePortfolioWeight = (schemeBalance: number) => {
    if (!totalValue || totalValue === 0 || !schemeBalance) return null;
    return ((schemeBalance / totalValue) * 100).toFixed(1);
  };

  // EPF analytics - sum of all EPF balances
  const totalEpfBalance = (epfHoldings || []).reduce((sum, epf) => sum + parseFloat(epf.totalBalance || '0'), 0);
  const epfPortfolioWeight = computePortfolioWeight(totalEpfBalance);

  // PPF analytics - sum of all PPF balances  
  const totalPpfBalance = (ppfHoldings || []).reduce((sum, ppf) => sum + parseFloat(ppf.totalBalance || '0'), 0);
  const ppfPortfolioWeight = computePortfolioWeight(totalPpfBalance);

  // Insurance analytics - aggregate from holdings
  const insuranceAnalytics = {
    totalPremium: (insuranceHoldings || []).reduce((sum, ins) => sum + parseFloat((ins as any).annualPremium || ins.premiumAmount || '0'), 0),
    lifeCoverage: (insuranceHoldings || []).filter(ins => ins.policyType === 'life').reduce((sum, ins) => sum + parseFloat(ins.sumAssured || '0'), 0),
    healthCoverage: (insuranceHoldings || []).filter(ins => ins.policyType === 'health').reduce((sum, ins) => sum + parseFloat(ins.sumAssured || '0'), 0),
    motorCoverage: (insuranceHoldings || []).filter(ins => ins.policyType === 'motor').reduce((sum, ins) => sum + parseFloat(ins.sumAssured || '0'), 0),
    ulipValue: (insuranceHoldings || []).filter(ins => ins.policyType === 'ulip').reduce((sum, ins) => sum + parseFloat(ins.fundValue || '0'), 0)
  };

  // Calculate projected retirement value (compound growth formula)
  const calculateProjectedValue = (currentBalance: number, interestRate: number, yearsToRetirement: number = 25) => {
    if (!currentBalance || !interestRate) return null;
    const projectedValue = currentBalance * Math.pow(1 + interestRate / 100, yearsToRetirement);
    return projectedValue;
  };

  // Update selected currency when portfolio changes
  useEffect(() => {
    if (portfolios?.[0]?.baseCurrency) {
      setSelectedCurrency(portfolios[0].baseCurrency);
    }
  }, [portfolios]);

  // Handle consent request for government scheme access
  const handleRequestConsent = (schemeType: SchemeType) => {
    setCurrentSchemeType(schemeType);
    setConsentDialogOpen(true);
  };

  const handleConsentGranted = () => {
    // Refresh the government scheme data after consent is granted
    window.location.reload(); // Simple refresh for now
  };

  // Handle unauthenticated users
  if (!isAuthenticated && !portfoliosLoading) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0">
          <div className="text-center py-16">
            <Shield className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Sign In Required</h1>
            <p className="text-muted-foreground mb-4">
              Please sign in to view your portfolio holdings and performance
            </p>
            <Button 
              className="bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => window.location.href = '/auth'}
            >
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Handle PAN-related errors
  if (portfoliosError && !portfoliosLoading) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0">
          <div className="text-center py-16">
            <Shield className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">PAN Card Required</h1>
            <p className="text-muted-foreground mb-4">
              Complete your KYC by adding your PAN card to access portfolio data
            </p>
            <Button className="bg-orange-500 text-white hover:bg-orange-600">
              Complete KYC
            </Button>
          </div>
        </main>

      </div>
    );
  }

  // Handle no portfolios found
  if (!portfoliosLoading && portfolios && portfolios.length === 0) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0">
          <div className="text-center py-16">
            <TrendingUp className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">No Portfolios Found</h1>
            <p className="text-muted-foreground mb-4">
              No investment portfolios are linked to your PAN card yet
            </p>
            <Button className="bg-blue-500 text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </div>
        </main>

      </div>
    );
  }

  const networkState = useNetworkState();


  // Portfolio V3 Dashboard (feature flag controlled)
  if (portfolioV3Enabled) {
    return (
      <div className="space-y-8 p-4 lg:p-6" data-testid="portfolio-page">
        <NetworkStatusBanner />
        <PortfolioV3Dashboard
          portfolioId={portfolioId || ""}
          performance={performance}
          holdings={enhancedHoldings || []}
          isLoading={isLoading}
          onRefresh={() => {
            refetchHoldings();
            refetchPerformance();
          }}
        />
      </div>
    );
  }
  return (
    <div className="space-y-8" data-testid="portfolio-page">
      {/* Network Status Banner for Offline Resilience */}
      <NetworkStatusBanner />
      
      {/* Sync Status Indicator */}
      <div className="flex justify-end px-4">
        <SyncStatusIndicator status="synced" />
      </div>

      {/* Unified MPAL Financial Profile */}
      <div className="px-4 lg:px-0">
        <UnifiedFinancialProfile />
      </div>

      <div className="space-y-6">
        

        {/* Enhanced Portfolio with Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <ScrollableTabsList>
            <TabsTrigger value="overview" className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4" />
              <span>Portfolio Overview</span>
            </TabsTrigger>
            <TabsTrigger value="fintekpro" className="flex items-center space-x-1" data-testid="tab-fintekpro-portfolio">
              <Building2 className="h-4 w-4" />
              <span>FintekPro Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="tracker" className="flex items-center space-x-1" data-testid="tab-tracker-portfolio">
              <FileText className="h-4 w-4" />
              <span>Tracker Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="external" className="flex items-center space-x-1" data-testid="tab-external-portfolio">
              <ExternalLink className="h-4 w-4" />
              <span>External Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="insurance" className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>Insurance</span>
            </TabsTrigger>
            <TabsTrigger value="epf" className="flex items-center space-x-1">
              <CreditCard className="h-4 w-4" />
              <span>EPF Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="ppf" className="flex items-center space-x-1">
              <PiggyBank className="h-4 w-4" />
              <span>PPF Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="eps" className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>EPS Pension</span>
            </TabsTrigger>
            <TabsTrigger value="nps" className="flex items-center space-x-1">
              <Target className="h-4 w-4" />
              <span>NPS</span>
            </TabsTrigger>
            <TabsTrigger value="apy" className="flex items-center space-x-1">
              <PiggyBank className="h-4 w-4" />
              <span>APY</span>
            </TabsTrigger>
            <TabsTrigger value="commodities" className="flex items-center space-x-1">
              <Coins className="h-4 w-4" />
              <span>Commodities</span>
            </TabsTrigger>
            <TabsTrigger value="pi-chat" className="flex items-center space-x-1">
              <Bot className="h-4 w-4" />
              <span>AI Insights</span>
            </TabsTrigger>
            <TabsTrigger value="rebalance">AI Rebalancing</TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Hero Section with Net Worth */}
            <PortfolioHero
              totalValue={performance?.totalCurrentValue ? parseFloat(performance.totalCurrentValue) : 0}
              investedValue={performance?.totalInvestedValue ? parseFloat(performance.totalInvestedValue) : 0}
              dayChange={performance?.dayChange ? parseFloat(performance.dayChange) : 0}
              dayChangePercent={performance?.dayChangePercent ? parseFloat(performance.dayChangePercent) : 0}
              totalGain={performance?.totalGainLoss ? parseFloat(performance.totalGainLoss) : 0}
              totalGainPercent={performance?.totalGainLossPercent ? parseFloat(performance.totalGainLossPercent) : 0}
              holdingsCount={enhancedHoldings?.length || 0}
              isLoading={isLoading}
              onRefresh={() => { refetchHoldings(); refetchPerformance(); }}
              panVerified={true}
            />

            {/* Quick Insights - SIPs, Dividends, Alerts */}
            <QuickInsights isLoading={isLoading} />

            {/* Performance Chart and Asset Allocation */}
            {portfolioId ? (
              <Suspense fallback={<LoadingState variant="section-chart" />}>
                <PortfolioChartSection portfolioId={portfolioId} />
              </Suspense>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <PortfolioPerformanceChart currentValue={0} investedValue={0} isLoading={isLoading} />
                <AssetAllocationChart assets={[]} totalValue={0} isLoading={isLoading} />
              </div>
            )}

            {/* Government Schemes Summary Card */}
            <Card className="border-l-4 border-green-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center text-green-700 dark:text-green-300">
                    <Landmark className="h-5 w-5 mr-2" />
                    Government Schemes Summary
                  </CardTitle>
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                    {(ppfHoldings?.length || 0) + (npsAccounts?.length || 0) + (apyAccounts?.length || 0) + (epsHoldings?.length || 0)} Accounts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const ppfTotal = ppfHoldings?.reduce((sum, h) => sum + parseFloat(h.totalBalance || '0'), 0) || 0;
                  const npsTotal = npsAccounts?.reduce((sum, h) => sum + parseFloat(h.totalBalance || '0'), 0) || 0;
                  const apyTotal = apyAccounts?.reduce((sum, h) => sum + parseFloat(h.totalBalance || '0'), 0) || 0;
                  const epsTotal = epsHoldings?.reduce((sum, h) => sum + parseFloat(h.accumulatedPension || '0'), 0) || 0;
                  const govtTotal = ppfTotal + npsTotal + apyTotal + epsTotal;
                  const estimatedPension = epsHoldings?.[0]?.estimatedMonthlyPension || '0';
                  
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                        <p className="text-lg font-bold text-green-600">₹{govtTotal.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">PPF</p>
                        <p className="text-lg font-bold text-blue-600">₹{ppfTotal.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">NPS</p>
                        <p className="text-lg font-bold text-purple-600">₹{npsTotal.toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">APY + EPS</p>
                        <p className="text-lg font-bold text-amber-600">₹{(apyTotal + epsTotal).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground mb-1">Est. Pension</p>
                        <p className="text-lg font-bold text-emerald-600">₹{parseFloat(estimatedPension).toLocaleString('en-IN')}/mo</p>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Portfolio Overview - Holdings Table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" data-testid="portfolio-overview">
              <div className="lg:col-span-2">
                {/* Holdings Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Holdings by Asset Class</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portfolioId ? (
                      <Suspense fallback={<LoadingState variant="section-table" count={5} />}>
                        <HoldingsTableSection portfolioId={portfolioId} />
                      </Suspense>
                    ) : (
                      <div className="text-center py-8" data-testid="empty-holdings">
                        <p className="text-muted-foreground mb-4">No portfolio selected</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {portfolios?.[0]?.userId && <PortfolioSummary userId={portfolios[0].userId} />}
            </div>
          </TabsContent>

          <TabsContent value="pi-chat" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <PiChatSummaries portfolioId={portfolioId || ""} />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-blue-600" />
                      <span>AI Portfolio Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">Overall Portfolio Health</div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          Your portfolio shows strong diversification with good risk-adjusted returns. 
                          Consider the commodity allocation recommendations for better inflation protection.
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="font-medium text-green-900 dark:text-green-100 mb-2">Performance Score</div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          <span className="text-2xl font-bold">8.2/10</span> - Excellent performance 
                          with balanced risk exposure across asset classes.
                        </div>
                      </div>
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                        <div className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Next Actions</div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          Review commodity exposure and consider rebalancing equity allocation 
                          for optimal yield generation.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <RebalancingSuggestions portfolioId={portfolioId || ""} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="commodities" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <CommodityTracker className="xl:col-span-1" />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Coins className="h-5 w-5 text-yellow-600" />
                      <span>Commodity Portfolio Impact</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                        <div className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Current Allocation</div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          10% of your portfolio (₹1,34,785) is allocated to commodities, 
                          providing good inflation protection.
                        </div>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                        <div className="font-medium text-orange-900 dark:text-orange-100 mb-2">Diversification Benefits</div>
                        <div className="text-sm text-orange-700 dark:text-orange-300">
                          Commodity exposure reduces portfolio correlation and provides 
                          hedge against economic uncertainty.
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="font-medium text-green-900 dark:text-green-100 mb-2">Performance</div>
                        <div className="text-sm text-green-700 dark:text-green-300">
                          +1.75% today • Outperforming broader market with gold and silver gains.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* FintekPro Portfolio Tab - Internal transactions done through platform */}
          <TabsContent value="fintekpro" className="space-y-8">
            <Suspense fallback={<LoadingState variant="section-table" count={6} />}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <span>FintekPro Portfolio</span>
                    </CardTitle>
                    <CardDescription>
                      All transactions and investments made through FintekPro platform
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                    <Shield className="h-3 w-3 mr-1" />
                    PAN Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <FintekproOrdersSection isAuthenticated={isAuthenticated} />
              </CardContent>
            </Card>

            {/* FintekPro Holdings Summary */}
            {enhancedHoldings && enhancedHoldings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <History className="h-5 w-5 text-green-600" />
                    <span>FintekPro Holdings</span>
                  </CardTitle>
                  <CardDescription>
                    Current holdings from investments made through FintekPro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {enhancedHoldings.slice(0, 10).map((holding: any) => (
                      <div 
                        key={holding.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
                        data-testid={`holding-${holding.id}`}
                      >
                        <div>
                          <div className="font-medium">{holding.symbol || holding.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {holding.quantity} units @ ₹{parseFloat(holding.averageCost || '0').toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">₹{parseFloat(holding.currentValue || '0').toLocaleString()}</div>
                          <div className={`text-sm ${parseFloat(holding.unrealizedGain || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(holding.unrealizedGain || '0') >= 0 ? '+' : ''}
                            {parseFloat(holding.unrealizedGainPercent || '0').toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* SEBI Risk Disclosure Footer */}
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="sebi-disclosure-fintekpro">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">SEBI Risk Disclosure</p>
                  <p className="text-xs leading-relaxed">
                    Investments in securities market are subject to market risks. Read all scheme related documents carefully before investing. 
                    Past performance is not indicative of future returns. FintekPro is a SEBI registered investment platform. 
                    {networkState !== 'online' && (
                      <span className="block mt-2 font-medium text-red-600 dark:text-red-400">
                        Note: Trading and order execution are disabled while offline or on slow networks to ensure transaction integrity.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            </Suspense>
          </TabsContent>

          {/* Tracker Portfolio Tab - PAN-level consolidated holdings from NSDL/CDSL */}
          <TabsContent value="tracker" className="space-y-8">
            <Suspense fallback={<LoadingState variant="section-table" count={6} />}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-teal-600" />
                      <span>Tracker Portfolio</span>
                    </CardTitle>
                    <CardDescription>
                      PAN-level consolidated holdings from all your demat accounts (NSDL/CDSL)
                    </CardDescription>
                  </div>
                  <Badge className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800">
                    <Shield className="h-3 w-3 mr-1" />
                    PAN Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="table" count={5} />
                ) : Array.isArray(enhancedHoldings) && enhancedHoldings.length > 0 ? (
                  <div className="space-y-6">
                    {/* Tracker Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-teal-50 dark:bg-teal-950/30 rounded-lg" data-testid="stat-total-holdings">
                        <div className="text-sm text-muted-foreground">Total Holdings</div>
                        <div className="text-2xl font-bold text-teal-600">{enhancedHoldings.length}</div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid="stat-total-value">
                        <div className="text-sm text-muted-foreground">Total Value</div>
                        <div className="text-2xl font-bold text-green-600">
                          ₹{enhancedHoldings.reduce((sum, h) => sum + parseFloat(h.currentValue || '0'), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="stat-total-invested">
                        <div className="text-sm text-muted-foreground">Total Invested</div>
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{enhancedHoldings.reduce((sum, h) => sum + parseFloat(h.investedValue || '0'), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg" data-testid="stat-total-gain">
                        <div className="text-sm text-muted-foreground">Total Gain/Loss</div>
                        <div className={`text-2xl font-bold ${
                          enhancedHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0) >= 0 
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {enhancedHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0) >= 0 ? '+' : ''}
                          ₹{Math.abs(enhancedHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Holdings by Depository */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-center">
                        <p className="text-sm font-medium text-purple-600">NSDL Holdings</p>
                        <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                          {enhancedHoldings.filter(h => h.exchange === 'NSE' || (h as any).depository === 'NSDL').length}
                        </p>
                      </div>
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-center">
                        <p className="text-sm font-medium text-indigo-600">CDSL Holdings</p>
                        <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                          {enhancedHoldings.filter(h => h.exchange === 'BSE' || (h as any).depository === 'CDSL').length}
                        </p>
                      </div>
                    </div>

                    {/* Holdings by Source */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                        <p className="text-sm font-medium text-blue-600">FintekPro Holdings</p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                          {taggedTrackerHoldings.filter(h => h.source === 'FINTEKPRO').length}
                        </p>
                      </div>
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                        <p className="text-sm font-medium text-orange-600">External Holdings</p>
                        <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                          {taggedTrackerHoldings.filter(h => h.source === 'EXTERNAL').length}
                        </p>
                      </div>
                    </div>

                    {/* Holdings Table with Source Badges */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Asset Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right">Current Value</TableHead>
                            <TableHead className="text-right">Gain/Loss</TableHead>
                            <TableHead>Exchange</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {taggedTrackerHoldings.map((holding) => (
                            <TableRow key={holding.id} data-testid={`row-tracker-${holding.id}`}>
                              <TableCell className="font-medium">{holding.symbol}</TableCell>
                              <TableCell>
                                <Badge 
                                  className={holding.source === 'FINTEKPRO' 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800' 
                                    : 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800'
                                  }
                                  data-testid={`source-badge-${holding.source.toLowerCase()}`}
                                >
                                  {holding.source === 'FINTEKPRO' ? (
                                    <><Building2 className="h-3 w-3 mr-1" /> FintekPro</>
                                  ) : (
                                    <><ExternalLink className="h-3 w-3 mr-1" /> External</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {holding.assetType?.replace('_', ' ') || 'Equity'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{holding.quantity}</TableCell>
                              <TableCell className="text-right">₹{parseFloat(holding.avgPrice || '0').toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">
                                ₹{parseFloat(holding.currentValue || '0').toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={parseFloat(holding.gainLoss || '0') >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {parseFloat(holding.gainLoss || '0') >= 0 ? '+' : ''}
                                  {parseFloat(holding.gainLossPercent || '0').toFixed(2)}%
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={holding.exchange === 'NSE' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'}>
                                  {holding.exchange || 'NSE'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12" data-testid="empty-tracker">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No Holdings Found</h3>
                    <p className="text-muted-foreground mb-4">
                      Your PAN-linked demat holdings will appear here once connected
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => window.location.href = '/settings/demat'}
                      data-testid="button-connect-demat"
                    >
                      Connect Demat Account
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* SEBI Risk Disclosure Footer for Tracker */}
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="sebi-disclosure-tracker">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">SEBI Compliance Notice</p>
                  <p className="text-xs leading-relaxed">
                    This consolidated view is sourced from NSDL/CDSL via your PAN card. Data accuracy depends on depository updates.
                    {networkState !== 'online' && (
                      <span className="block mt-2 font-medium text-red-600 dark:text-red-400">
                        You are currently {networkState}. Portfolio data shown is from cache. Refresh when online for latest values.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            </Suspense>
          </TabsContent>

          {/* External Portfolio Tab - DERIVED as (Tracker - FintekPro) */}
          <TabsContent value="external" className="space-y-8">
            <Suspense fallback={<LoadingState variant="section-table" count={6} />}>
            {/* SEBI Compliance Disclosure Banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg" data-testid="external-portfolio-disclosure">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Advisory Only - No Transaction Capability</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  External holdings are shown for information and analysis purposes only. These holdings cannot be transacted through FintekPro unless migrated to the platform.
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <ExternalLink className="h-5 w-5 text-orange-600" />
                      <span>External Portfolio</span>
                    </CardTitle>
                    <CardDescription>
                      Holdings from external brokers (Derived: Tracker Portfolio − FintekPro Portfolio)
                    </CardDescription>
                  </div>
                  <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Derived View
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="table" count={5} />
                ) : Array.isArray(externalHoldings) && externalHoldings.length > 0 ? (
                  <div className="space-y-6">
                    {/* External Portfolio Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg" data-testid="stat-external-holdings">
                        <div className="text-sm text-muted-foreground">External Holdings</div>
                        <div className="text-2xl font-bold text-orange-600">{externalHoldings.length}</div>
                      </div>
                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid="stat-external-value">
                        <div className="text-sm text-muted-foreground">Total Value</div>
                        <div className="text-2xl font-bold text-green-600">
                          ₹{externalHoldings.reduce((sum, h) => sum + parseFloat(h.currentValue || '0'), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg" data-testid="stat-external-invested">
                        <div className="text-sm text-muted-foreground">Total Invested</div>
                        <div className="text-2xl font-bold text-blue-600">
                          ₹{externalHoldings.reduce((sum, h) => sum + parseFloat(h.investedValue || '0'), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg" data-testid="stat-external-gain">
                        <div className="text-sm text-muted-foreground">Total Gain/Loss</div>
                        <div className={`text-2xl font-bold ${
                          externalHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0) >= 0 
                            ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {externalHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0) >= 0 ? '+' : ''}
                          ₹{Math.abs(externalHoldings.reduce((sum, h) => sum + parseFloat(h.gainLoss || '0'), 0)).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* External Holdings Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Asset Type</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Avg Price</TableHead>
                            <TableHead className="text-right">Current Value</TableHead>
                            <TableHead className="text-right">Gain/Loss</TableHead>
                            <TableHead>Exchange</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {externalHoldings.map((holding) => (
                            <TableRow key={holding.id} data-testid={`row-external-${holding.id}`}>
                              <TableCell className="font-medium">{holding.symbol}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {holding.assetType?.replace('_', ' ') || 'Equity'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">{holding.quantity}</TableCell>
                              <TableCell className="text-right">₹{parseFloat(holding.avgPrice || '0').toFixed(2)}</TableCell>
                              <TableCell className="text-right font-medium">
                                ₹{parseFloat(holding.currentValue || '0').toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={parseFloat(holding.gainLoss || '0') >= 0 ? 'text-green-600' : 'text-red-600'}>
                                  {parseFloat(holding.gainLoss || '0') >= 0 ? '+' : ''}
                                  {parseFloat(holding.gainLossPercent || '0').toFixed(2)}%
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge className={holding.exchange === 'NSE' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200'}>
                                  {holding.exchange || 'NSE'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-muted text-muted-foreground border-border">
                                  View Only
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Migration CTA */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-200">Migrate to FintekPro</p>
                          <p className="text-sm text-blue-600">Transfer external holdings to FintekPro for full transaction capability and AI recommendations</p>
                        </div>
                        <Button variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30" data-testid="button-migrate-holdings">
                          Learn More
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12" data-testid="empty-external">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">All Holdings on FintekPro</h3>
                    <p className="text-muted-foreground mb-4">
                      Great news! All your demat holdings are managed through FintekPro
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Aggregator Sync Option */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <RefreshCw className="h-5 w-5 text-teal-600" />
                  <span>Sync External Holdings</span>
                </CardTitle>
                <CardDescription>
                  Connect via Account Aggregator to automatically fetch holdings from other brokers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExternalPortfolioSync />
              </CardContent>
            </Card>
            </Suspense>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="insurance" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  Insurance holdings verified with your PAN card for secure access
                </span>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Insurance Holdings Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span>Insurance Holdings Overview</span>
                    </CardTitle>
                    <CardDescription>
                      Holdings data from NSDL & CDSL depository accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insuranceLoading ? (
                      <LoadingState variant="card" count={3} />
                    ) : (
                    <div className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Policies</div>
                          <div className="text-2xl font-bold text-blue-600">{insuranceHoldings?.length || 0}</div>
                        </div>
                        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Coverage</div>
                          <div className="text-2xl font-bold text-green-600">
                            ₹{Array.isArray(insuranceHoldings) ? insuranceHoldings.reduce((sum, policy) => sum + parseFloat(policy.sumAssured || '0'), 0).toLocaleString() : "0"}
                          </div>
                        </div>
                      </div>

                      {/* Policy Breakdown */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-foreground">Policy Categories</h4>
                        <div className="space-y-2">
                          {insuranceHoldings && insuranceHoldings.length > 0 ? (
                            Array.from(new Set(insuranceHoldings.map(p => p.policyType))).map(policyType => {
                              const count = insuranceHoldings.filter(p => p.policyType === policyType).length;
                              return (
                                <div key={policyType} className="flex justify-between items-center p-2 bg-muted rounded">
                                  <span className="text-sm">{policyType.charAt(0).toUpperCase() + policyType.slice(1)} Insurance</span>
                                  <span className="font-medium">{count} {count === 1 ? 'policy' : 'policies'}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center text-muted-foreground py-4">
                              <p className="text-sm">No policy categories to display</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Depository Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-foreground">Depository Details</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                            <p className="text-sm font-medium text-purple-600">NSDL Holdings</p>
                            <p className="text-xs text-purple-600">{insuranceHoldings?.filter(p => p.depositoryName === 'NSDL').length || 0} policies</p>
                          </div>
                          <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                            <p className="text-sm font-medium text-indigo-600">CDSL Holdings</p>
                            <p className="text-xs text-indigo-600">{insuranceHoldings?.filter(p => p.depositoryName === 'CDSL').length || 0} policies</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detailed Policy List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      <span>Active Insurance Policies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insuranceLoading ? (
                      <LoadingState variant="card" count={3} />
                    ) : (
                    <div className="space-y-4">
                      {insuranceHoldings && insuranceHoldings.length > 0 ? (
                        insuranceHoldings.map((policy) => (
                          <div key={policy.id} className="border rounded-lg p-4" data-testid={`insurance-policy-${policy.id}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-medium text-foreground">{policy.policyName}</h4>
                                <p className="text-sm text-muted-foreground">Policy No: {policy.policyNumber}</p>
                                <p className="text-xs text-muted-foreground">{policy.insuranceCompany}</p>
                              </div>
                              <Badge className={(policy.policyStatus || '') === 'active' ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" : "bg-muted text-white"}>
                                {policy.policyStatus ? policy.policyStatus.charAt(0).toUpperCase() + policy.policyStatus.slice(1) : 'Unknown'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Sum Assured</p>
                                <p className="font-medium">₹{parseFloat(policy.sumAssured).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Premium</p>
                                <p className="font-medium">₹{parseFloat(policy.premiumAmount).toLocaleString()}/{policy.premiumFrequency}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {policy.policyMaturityDate ? 'Maturity Date' : 'Premium Due'}
                                </p>
                                <p className="font-medium">
                                  {policy.policyMaturityDate 
                                    ? new Date(policy.policyMaturityDate).toLocaleDateString()
                                    : policy.premiumDueDate ? new Date(policy.premiumDueDate).toLocaleDateString() : 'N/A'
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Depository</p>
                                <p className={`font-medium ${policy.depositoryName === 'NSDL' ? 'text-purple-600' : 'text-indigo-600'}`}>
                                  {policy.depositoryName}
                                </p>
                              </div>
                              {policy.fundValue && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Fund Value</p>
                                  <p className="font-medium text-green-600">₹{parseFloat(policy.fundValue).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p>No insurance policies found</p>
                          <p className="text-sm">Connect your NSDL/CDSL account to view your insurance holdings</p>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Insurance Portfolio Analytics */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <span>Insurance Portfolio Analytics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Coverage Adequacy */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Coverage Adequacy</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">85%</div>
                        <p className="text-sm text-muted-foreground">of recommended coverage</p>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>

                    {/* Annual Premium */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Annual Premium</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Premium</span>
                          <span className="text-sm font-medium">{insuranceAnalytics.totalPremium > 0 ? `₹${insuranceAnalytics.totalPremium.toLocaleString('en-IN')}` : 'Not available'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">% of Income</span>
                          <span className="text-sm font-medium text-muted-foreground">Not available</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Next Due</span>
                          <span className="text-sm font-medium text-muted-foreground">Not available</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Protection */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Risk Protection</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Life Coverage</span>
                          <span className="text-sm font-medium">{insuranceAnalytics.lifeCoverage > 0 ? `₹${(insuranceAnalytics.lifeCoverage / 10000000).toFixed(1)}Cr` : 'Not available'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Health Coverage</span>
                          <span className="text-sm font-medium">{insuranceAnalytics.healthCoverage > 0 ? `₹${(insuranceAnalytics.healthCoverage / 100000).toFixed(0)}L` : 'Not available'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Motor Coverage</span>
                          <span className="text-sm font-medium">{insuranceAnalytics.motorCoverage > 0 ? `₹${(insuranceAnalytics.motorCoverage / 100000).toFixed(0)}L` : 'Not available'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Portfolio Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Portfolio Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{insuranceAnalytics.ulipValue > 0 ? `₹${(insuranceAnalytics.ulipValue / 100000).toFixed(2)}L` : 'Not available'}</div>
                          <p className="text-sm text-muted-foreground">ULIP Fund Value</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Part of investment portfolio
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm" data-testid="button-view-policies">
                      View All Policies
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-pay-premium">
                      Pay Premium
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-claim-status">
                      Claim Status
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-download-certificates">
                      Download Certificates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="epf" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="epf" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  EPF data verified with your PAN card and UAN for secure access
                </span>
              </div>
              
              {epfLoading ? (
                <LoadingState variant="card" count={2} />
              ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {epfHoldings?.map((epf) => (
                  <div key={epf.id} className="contents">
                    {/* EPF Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <CreditCard className="h-5 w-5 text-blue-600" />
                            <div className="flex flex-col">
                              <span>{epf.employerName}</span>
                              <span className="text-xs text-muted-foreground font-normal">{epf.epfAccountNumber}</span>
                            </div>
                          </CardTitle>
                          <Badge variant="outline" className={epf.isActive ? "text-green-600 border-green-600" : "text-muted-foreground border-border"}>
                            {epf.isActive ? 'Active' : 'Previous'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Account Number</p>
                              <p className="font-medium">{epf.epfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Employer</p>
                              <p className="font-medium">{epf.employerName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Date of Joining</p>
                              <p className="font-medium">{epf.dateOfJoining ? new Date(epf.dateOfJoining).toLocaleDateString('en-IN') : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Interest Rate</p>
                              <p className="font-medium text-green-600">{epf.interestRate}%</p>
                            </div>
                          </div>

                          {/* Balance Breakdown */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-foreground">Balance Breakdown</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Employee Contribution</span>
                                <span className="font-bold text-blue-900 dark:text-blue-100">₹{parseFloat(epf.employeeContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                                <span className="text-sm font-medium text-green-900 dark:text-green-100">Employer Contribution</span>
                                <span className="font-bold text-green-900 dark:text-green-100">₹{parseFloat(epf.employerContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Pension Fund (EPS)</span>
                                <span className="font-bold text-purple-900 dark:text-purple-100">₹{parseFloat(epf.pensionContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                                <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Interest Earned</span>
                                <span className="font-bold text-orange-900 dark:text-orange-100">₹{parseFloat(epf.interestEarned || '0').toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Total Balance */}
                          <div className="pt-4 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-semibold text-foreground">Total EPF Balance</span>
                              <span className="text-2xl font-bold text-green-600">₹{parseFloat(epf.totalBalance || '0').toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              As of {epf.lastUpdated ? new Date(epf.lastUpdated).toLocaleDateString('en-IN') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* EPF Performance & Growth */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <span>EPF Performance & Growth</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Monthly Contribution */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-foreground">Monthly Contribution</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">Employee (12%)</p>
                                <p className="text-lg font-bold text-foreground">₹7,200</p>
                              </div>
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">Employer (12%)</p>
                                <p className="text-lg font-bold text-foreground">₹7,200</p>
                              </div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                              <p className="text-sm text-muted-foreground">Total Monthly Addition</p>
                              <p className="text-xl font-bold text-green-600">₹14,400</p>
                            </div>
                          </div>

                          {/* Growth Statistics */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-foreground">Growth Statistics</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Current Year Interest</span>
                                <span className="font-medium text-green-600">₹{parseFloat(epf.interestEarned || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Account Status</span>
                                <span className="font-medium text-green-600">{epf.isActive ? 'Active' : 'Inactive'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Annual Interest Rate</span>
                                <span className="font-medium text-green-600">{epf.interestRate}%</span>
                              </div>
                            </div>
                          </div>

                    {/* Withdrawal Options */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Withdrawal Information</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Partial Withdrawal</p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">Available after 5 years for specific purposes</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Full Withdrawal</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">Available after employment termination or retirement</p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Nominee Details</h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{(epf as any).nomineeName || 'Not available'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">{(epf as any).nomineeRelation || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EPF Portfolio Integration */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <span>EPF in Your Overall Portfolio</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Portfolio Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Portfolio Weight</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{epfPortfolioWeight ? `${epfPortfolioWeight}%` : 'Not available'}</div>
                        <p className="text-sm text-muted-foreground">of total wealth</p>
                      </div>
                      {epfPortfolioWeight && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(parseFloat(epfPortfolioWeight), 100)}%` }}></div>
                        </div>
                      )}
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Risk Profile</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk Level</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Low</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Volatility</span>
                          <span className="text-sm font-medium">Very Low</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Liquidity</span>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">Restricted</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Retirement Planning */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Retirement Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          {(() => {
                            const projectedValue = calculateProjectedValue(totalEpfBalance, parseFloat(epf.interestRate || '8.15'));
                            return projectedValue ? (
                              <div className="text-2xl font-bold text-blue-600">₹{(projectedValue / 100000).toFixed(1)}L</div>
                            ) : (
                              <div className="text-2xl font-bold text-muted-foreground">Not available</div>
                            );
                          })()}
                          <p className="text-sm text-muted-foreground">Projected at 60</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Based on current contributions and {epf.interestRate || '8.15'}% annual growth
                        </div>
                      </div>
                    </div>

                          {/* Action Buttons */}
                          <div className="flex gap-4 mt-6 pt-4 border-t">
                            <Button variant="outline" size="sm">
                              View Passbook
                            </Button>
                            <Button variant="outline" size="sm">
                              Download Statement
                            </Button>
                            <Button variant="outline" size="sm">
                              Update Nominee
                            </Button>
                            <Button variant="outline" size="sm">
                              Check Claim Status
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="ppf" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="ppf" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  PPF data verified with your PAN card and PPF account number for secure access
                </span>
              </div>
              
              {ppfLoading ? (
              <LoadingState variant="card" count={2} />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {ppfHoldings?.map((ppf) => (
                  <div key={ppf.id} className="contents">
                    {/* PPF Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <PiggyBank className="h-5 w-5 text-purple-600" />
                            <span>PPF Account Summary</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {ppf.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Account Number</p>
                              <p className="font-medium">{ppf.ppfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Bank & Branch</p>
                              <p className="font-medium">{ppf.bankName} - {ppf.branchName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Account Opening Date</p>
                              <p className="font-medium">{new Date(ppf.accountOpenDate).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Maturity Date</p>
                              <p className="font-medium text-blue-600">{new Date(ppf.maturityDate).toLocaleDateString('en-IN')}</p>
                            </div>
                          </div>

                    {/* Current Status */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Current Status & Timeline</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Years Completed</p>
                          <p className="text-2xl font-bold text-blue-600">9</p>
                          <p className="text-xs text-blue-600">6 years remaining</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Interest Rate (2024-25)</p>
                          <p className="text-2xl font-bold text-green-600">8.2%</p>
                          <p className="text-xs text-green-600">Tax-free returns</p>
                        </div>
                      </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Balance Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Contribution</span>
                          <span className="font-bold text-purple-900 dark:text-purple-100">{(ppf as any).totalContribution ? `₹${parseFloat((ppf as any).totalContribution).toLocaleString('en-IN')}` : 'Not available'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <span className="text-sm font-medium text-orange-900 dark:text-orange-100">Interest Earned</span>
                          <span className="font-bold text-orange-900 dark:text-orange-100">{(ppf as any).interestEarned ? `₹${parseFloat((ppf as any).interestEarned).toLocaleString('en-IN')}` : 'Not available'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">Current Balance</span>
                          <span className="font-bold text-green-900 dark:text-green-100">{ppf.totalBalance ? `₹${parseFloat(ppf.totalBalance).toLocaleString('en-IN')}` : 'Not available'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Maturity Projection */}
                    <div className="pt-4 border-t">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-foreground">Projected Maturity Value</span>
                          {(() => {
                            const yearsToMaturity = ppf.maturityDate ? Math.ceil((new Date(ppf.maturityDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                            const projectedValue = calculateProjectedValue(parseFloat(ppf.totalBalance || '0'), parseFloat((ppf as any).interestRate || '7.1'), yearsToMaturity);
                            return projectedValue ? (
                              <span className="text-2xl font-bold text-purple-600">₹{(projectedValue / 100000).toFixed(1)}L</span>
                            ) : (
                              <span className="text-2xl font-bold text-muted-foreground">Not available</span>
                            );
                          })()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Based on current balance and {(ppf as any).interestRate || '7.1'}% annual growth
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PPF Contribution & Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Contribution & Benefits</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* This Year's Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">FY 2024-25 Contribution</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Contributed So Far</p>
                          <p className="text-lg font-bold text-foreground">₹1,20,000</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Remaining Limit</p>
                          <p className="text-lg font-bold text-orange-600">₹30,000</p>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        80% of annual limit utilized (₹1.5L max per year)
                      </p>
                    </div>

                    {/* Tax Benefits */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Tax Benefits</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <span className="text-sm">Section 80C Deduction</span>
                          <span className="font-medium text-green-600">₹1,20,000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <span className="text-sm">Tax Saved (30% bracket)</span>
                          <span className="font-medium text-blue-600">₹36,000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                          <span className="text-sm">Interest & Maturity</span>
                          <span className="font-medium text-purple-600">Tax-Free</span>
                        </div>
                      </div>
                    </div>

                    {/* Available Features */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Available Features</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">✓ Loan Available</p>
                          <p className="text-xs text-green-700 dark:text-green-300">
                            Up to ₹3.87L (20% of balance) - From 3rd year onwards
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">✓ Partial Withdrawal</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Up to ₹9.67L (50% of balance) - From 7th year onwards
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">⏳ Extension Option</p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            Available after maturity - 5-year blocks without contribution
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Information */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Nominee Details</h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{(ppf as any).nomineeName || 'Not available'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">{(ppf as any).nomineeRelation || 'Not specified'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PPF Portfolio Integration & Analytics */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PiggyBank className="h-5 w-5 text-purple-600" />
                    <span>PPF in Your Investment Portfolio</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Portfolio Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Portfolio Weight</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">{ppfPortfolioWeight ? `${ppfPortfolioWeight}%` : 'Not available'}</div>
                        <p className="text-sm text-muted-foreground">of total wealth</p>
                      </div>
                      {ppfPortfolioWeight && (
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${Math.min(parseFloat(ppfPortfolioWeight), 100)}%` }}></div>
                        </div>
                      )}
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Risk & Returns</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk Level</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Zero Risk</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Current Return</span>
                          <span className="text-sm font-medium text-green-600">8.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Tax Status</span>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">EEE</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Liquidity Status */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Liquidity</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Lock-in Period</span>
                          <span className="text-sm font-medium">15 years</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Loan Access</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Partial Withdrawal</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Retirement Planning Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Retirement Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          {(() => {
                            const yearsToMaturity = (ppfHoldings?.[0]?.maturityDate) ? Math.ceil((new Date(ppfHoldings[0].maturityDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
                            const projectedValue = calculateProjectedValue(totalPpfBalance, 7.1, yearsToMaturity);
                            return projectedValue ? (
                              <div className="text-2xl font-bold text-purple-600">₹{(projectedValue / 100000).toFixed(1)}L</div>
                            ) : (
                              <div className="text-2xl font-bold text-muted-foreground">Not available</div>
                            );
                          })()}
                          <p className="text-sm text-muted-foreground">At maturity ({ppfHoldings?.[0]?.maturityDate ? new Date(ppfHoldings[0].maturityDate).getFullYear() : 'N/A'})</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Provides stable, tax-free retirement corpus
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Yearly Contribution History Chart Placeholder */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-foreground mb-4">9-Year Contribution & Growth History</h4>
                    <div className="grid grid-cols-9 gap-2">
                      {Array.from({ length: 9 }, (_, i) => (
                        <div key={i} className="text-center">
                          <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-2 mb-2">
                            <div className="text-xs text-muted-foreground">FY {2016 + i}</div>
                            <div className="text-sm font-bold text-purple-600">₹{1.5 - (Math.random() * 0.3)}L</div>
                          </div>
                          <div className="bg-purple-600 mx-auto rounded" 
                               style={{ 
                                 width: '100%', 
                                 height: `${20 + i * 8}px` 
                               }}>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View Passbook
                    </Button>
                    <Button variant="outline" size="sm">
                      Make Contribution
                    </Button>
                    <Button variant="outline" size="sm">
                      Apply for Loan
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Statement
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Nominee
                    </Button>
                  </div>
                </CardContent>
              </Card>
                  </div>
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="eps" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="eps" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  EPS pension data verified with your PAN card and UAN for secure access
                </span>
              </div>
              
              {epsLoading ? (
              <LoadingState variant="card" count={2} />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {epsHoldings?.map((eps) => (
                  <div key={eps.id} className="contents">
                    {/* EPS Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <span>EPS Pension Account</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">{eps.schemeType?.toUpperCase() || 'EPS-95'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">EPF Account Number</p>
                              <p className="font-medium">{eps.epfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Pension Account</p>
                              <p className="font-medium">{eps.pensionAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Current Employer</p>
                              <p className="font-medium">{eps.currentEmployer}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Employer Code</p>
                              <p className="font-medium">{eps.employerCode}</p>
                            </div>
                          </div>

                    {/* Service Details */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Service Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Service Start Date</p>
                          <p className="font-bold text-blue-600">01-Jun-2015</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Service</p>
                          <p className="font-bold text-green-600">9 Years 8 Months</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Current Salary</p>
                          <p className="font-bold text-purple-600">₹85,000</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Pensionable Wage</p>
                          <p className="font-bold text-orange-600">₹15,000</p>
                          <p className="text-xs text-orange-600">Max ceiling</p>
                        </div>
                      </div>
                    </div>

                    {/* Vesting Status */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Vesting & Eligibility Status</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                          <div>
                            <p className="font-medium text-green-900 dark:text-green-100">✓ Vested</p>
                            <p className="text-xs text-green-700 dark:text-green-300">Completed 10+ years minimum service</p>
                          </div>
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">Eligible</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                          <div>
                            <p className="font-medium text-yellow-900 dark:text-yellow-100">⏳ Pension Eligibility</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">Available from age 58 (Currently 35)</p>
                          </div>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">23 years</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Expected Retirement */}
                    <div className="pt-4 border-t">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-foreground">Expected Retirement Date</span>
                          <span className="text-xl font-bold text-blue-600">01-Jun-2038</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Based on 58 years age eligibility (32 years total service)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EPS Pension Calculation & Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Pension Calculation & Benefits</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Current Contribution Status */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Monthly Contribution (FY 2024-25)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Contribution Rate</p>
                          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">8.33%</p>
                          <p className="text-xs text-blue-600">of pensionable wage</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                          <p className="text-lg font-bold text-green-900 dark:text-green-100">₹1,249</p>
                          <p className="text-xs text-green-600">8.33% of ₹15,000</p>
                        </div>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Total Contributions Till Date</span>
                          <span className="font-bold text-purple-900 dark:text-purple-100">₹1,45,104</span>
                        </div>
                        <p className="text-xs text-purple-600 mt-1">9 years 8 months of contributions</p>
                      </div>
                    </div>

                    {/* Pension Formula & Calculation */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Pension Formula (EPS-95)</h4>
                      <div className="p-4 bg-muted rounded-lg border">
                        <p className="text-sm font-medium text-center text-muted-foreground">
                          Pension = (Pensionable Salary × Service) ÷ 70
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-muted-foreground">Average Salary</p>
                            <p className="font-bold">₹15,000</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Expected Service</p>
                            <p className="font-bold">32 years</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Factor</p>
                            <p className="font-bold">70</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Projected Pension */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Projected Monthly Pension</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">At Current Service (9.8 years)</span>
                          <span className="font-bold text-green-900 dark:text-green-100">₹2,103</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">At Retirement (32 years)</span>
                          <span className="font-bold text-blue-900 dark:text-blue-100">₹6,857</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Annual Pension (at retirement)</span>
                          <span className="font-bold text-purple-900 dark:text-purple-100">₹82,286</span>
                        </div>
                      </div>
                    </div>

                    {/* Pension Benefits */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Additional Benefits</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">✓ Lifelong Pension</p>
                          <p className="text-xs text-green-700 dark:text-green-300">Monthly pension for entire lifetime</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">✓ Family Pension</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">50% pension to spouse after member's death</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                          <p className="text-sm font-medium text-purple-900 dark:text-purple-100">✓ Medical Benefits</p>
                          <p className="text-xs text-purple-700 dark:text-purple-300">CGHS/ESI medical coverage continuation</p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Information */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Nominee Details</h4>
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{(eps as any).nomineeName || 'Not available'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">{(eps as any).nomineeRelation || 'Not specified'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Share</p>
                            <p className="font-medium">{(eps as any).nomineeShare || '100%'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* APY (Atal Pension Yojana) Integration */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      <span>APY - Atal Pension Yojana</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-green-600 border-green-600">Enrolled</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* APY Account Overview */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Account Details</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">APY Account</p>
                          <p className="font-bold text-green-900 dark:text-green-100">APY/SBI/001/789123</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Bank Partner</p>
                          <p className="font-bold text-blue-900 dark:text-blue-100">State Bank of India</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Enrollment Date</p>
                          <p className="font-bold text-purple-900 dark:text-purple-100">01-Sep-2018</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Current Age</p>
                          <p className="font-bold text-orange-900 dark:text-orange-100">35 Years</p>
                        </div>
                      </div>
                    </div>

                    {/* Chosen Pension Plan */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Pension Plan</h4>
                      <div className="space-y-3">
                        <div className="text-center p-4 bg-gradient-to-br from-green-100 dark:from-green-900/30 to-green-200 rounded-lg border-2 border-green-300 dark:border-green-700">
                          <p className="text-sm text-green-700 dark:text-green-300 font-medium">Guaranteed Monthly Pension</p>
                          <p className="text-3xl font-bold text-green-800 dark:text-green-200">₹3,000</p>
                          <p className="text-xs text-green-600">from age 60</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded border">
                            <p className="text-xs text-muted-foreground">Annual Pension</p>
                            <p className="font-bold text-blue-900 dark:text-blue-100">₹36,000</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded border">
                            <p className="text-xs text-muted-foreground">Maturity Age</p>
                            <p className="font-bold text-purple-900 dark:text-purple-100">60 Years</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Contributions */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Contributions (FY 2024-25)</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">₹168</p>
                          <p className="text-xs text-blue-600">Auto-debit from salary</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Govt Co-contribution</p>
                          <p className="text-lg font-bold text-green-900 dark:text-green-100">₹84</p>
                          <p className="text-xs text-green-600">50% govt support</p>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Monthly</p>
                          <p className="text-lg font-bold text-purple-900 dark:text-purple-100">₹252</p>
                          <p className="text-xs text-purple-600">Your + Government</p>
                        </div>
                      </div>
                    </div>

                    {/* Contribution Progress */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Contribution Progress</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">Years Contributed</p>
                          <p className="text-lg font-bold text-foreground">6.3 Years</p>
                        </div>
                        <div className="w-full bg-muted rounded-full h-3">
                          <div className="bg-green-500 h-3 rounded-full" style={{ width: '25.2%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Age 35</span>
                          <span className="font-medium">25 years to go</span>
                          <span className="text-muted-foreground">Age 60</span>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Contributed</p>
                          <p className="text-lg font-bold text-orange-900 dark:text-orange-100">₹1,27,008</p>
                          <p className="text-xs text-orange-600">Your + Govt contributions</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY Benefits Overview */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-foreground mb-4">APY Benefits & Features</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-3">
                        <h5 className="font-medium text-foreground">Pension Benefits</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">✓ Guaranteed Pension</p>
                            <p className="text-xs text-green-700 dark:text-green-300">₹3,000/month from age 60</p>
                          </div>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">✓ Spouse Pension</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">Same pension amount to spouse</p>
                          </div>
                          <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border-l-4 border-purple-500">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">✓ Death Benefit</p>
                            <p className="text-xs text-purple-700 dark:text-purple-300">Corpus return to nominee</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-medium text-foreground">Government Support</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-500">
                            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">✓ Co-contribution</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">50% govt support (up to ₹1,000)</p>
                          </div>
                          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">✓ Tax Benefits</p>
                            <p className="text-xs text-green-700 dark:text-green-300">80CCD(1B) deduction up to ₹50,000</p>
                          </div>
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border-l-4 border-indigo-500">
                            <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">✓ Govt Guarantee</p>
                            <p className="text-xs text-indigo-700 dark:text-indigo-300">Returns backed by Government of India</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-medium text-foreground">Account Features</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border-l-4 border-orange-500">
                            <p className="text-sm font-medium text-orange-900 dark:text-orange-100">✓ Auto-Debit</p>
                            <p className="text-xs text-orange-700 dark:text-orange-300">Monthly contributions from salary</p>
                          </div>
                          <div className="p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg border-l-4 border-teal-500">
                            <p className="text-sm font-medium text-teal-900 dark:text-teal-100">✓ Portability</p>
                            <p className="text-xs text-teal-700 dark:text-teal-300">Transfer across banks/employers</p>
                          </div>
                          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border-l-4 border-red-500">
                            <p className="text-sm font-medium text-red-900 dark:text-red-100">⚠ Exit Clause</p>
                            <p className="text-xs text-red-700 dark:text-red-300">Penalties for early exit</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY vs Other Pension Plans Comparison */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-foreground mb-4">Your Complete Pension Portfolio</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-blue-900 dark:text-blue-100">EPS-95</h5>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Government</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">₹6,857</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">Monthly at age 58</p>
                          <p className="text-xs text-muted-foreground">Based on salary & service</p>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-green-900 dark:text-green-100">APY</h5>
                          <Badge variant="outline" className="text-green-600 border-green-600">Government</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-green-900 dark:text-green-100">₹3,000</p>
                          <p className="text-sm text-green-700 dark:text-green-300">Monthly at age 60</p>
                          <p className="text-xs text-muted-foreground">Guaranteed pension amount</p>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-purple-900 dark:text-purple-100">Combined</h5>
                          <Badge variant="outline" className="text-purple-600 border-purple-600">Total</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">₹9,857</p>
                          <p className="text-sm text-purple-700 dark:text-purple-300">Monthly pension income</p>
                          <p className="text-xs text-muted-foreground">EPS + APY combined</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View APY Statement
                    </Button>
                    <Button variant="outline" size="sm">
                      Contribution History
                    </Button>
                    <Button variant="outline" size="sm">
                      Change Pension Amount
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Bank Details
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* EPS Portfolio Integration & Retirement Planning */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span>EPS in Your Retirement Planning</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Retirement Income Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Monthly Income</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">₹6,857</div>
                        <p className="text-sm text-muted-foreground">at retirement</p>
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        Guaranteed lifelong pension
                      </div>
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Security Level</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Government Backed</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Inflation Protection</span>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Periodic DA</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Tax Status</span>
                          <Badge variant="outline" className="text-purple-600 border-purple-600">Tax-Free</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Service Progress */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Service Progress</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Completed</span>
                          <span className="text-sm font-medium">9.8 years</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30.6%' }}></div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Projected Total</span>
                          <span className="text-sm font-medium">32 years</span>
                        </div>
                      </div>
                    </div>

                    {/* Family Security */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Family Security</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">₹3,428</div>
                          <p className="text-sm text-muted-foreground">Family pension</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          50% pension to spouse
                        </div>
                      </div>
                    </div>

                    {/* Retirement Corpus Equivalent */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-foreground">Corpus Equivalent</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">₹17.1L</div>
                          <p className="text-sm text-muted-foreground">@4% withdrawal</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                          Equivalent corpus needed for same income
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contribution Timeline Chart */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-foreground mb-4">9+ Year Contribution History</h4>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="text-center">
                          <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2 mb-2">
                            <div className="text-xs text-muted-foreground">{2015 + i}</div>
                            <div className="text-sm font-bold text-blue-600">₹{Math.floor(12000 + i * 1500)}</div>
                          </div>
                          <div className="bg-blue-600 mx-auto rounded" 
                               style={{ 
                                 width: '100%', 
                                 height: `${15 + i * 3}px` 
                               }}>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Future Projections */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-foreground mb-4">Pension Growth Projection</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-blue-100 dark:to-blue-900/30 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">Year 15</p>
                        <p className="text-xl font-bold text-blue-800 dark:text-blue-200">₹3,214</p>
                        <p className="text-xs text-blue-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 dark:from-green-950/30 to-green-100 dark:to-green-900/30 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Year 20</p>
                        <p className="text-xl font-bold text-green-800 dark:text-green-200">₹4,286</p>
                        <p className="text-xs text-green-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-purple-50 dark:from-purple-950/30 to-purple-100 dark:to-purple-900/30 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">Year 25</p>
                        <p className="text-xl font-bold text-purple-800 dark:text-purple-200">₹5,357</p>
                        <p className="text-xs text-purple-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-orange-50 dark:from-orange-950/30 to-orange-100 dark:to-orange-900/30 rounded-lg">
                        <p className="text-sm text-orange-600 font-medium">Retirement</p>
                        <p className="text-xl font-bold text-orange-800 dark:text-orange-200">₹6,857</p>
                        <p className="text-xs text-orange-600">Monthly pension</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View Pension Passbook
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Certificate
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Nominee
                    </Button>
                    <Button variant="outline" size="sm">
                      Calculate Pension
                    </Button>
                    <Button variant="outline" size="sm">
                      Transfer Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
                  </div>
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          {/* NPS - National Pension System Tab */}
          <TabsContent value="nps" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="nps" 
              onRequestConsent={handleRequestConsent}
            >
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  NPS data verified with your PAN and PRAN for secure access
                </span>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      <span>NPS Account Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">PRAN Number</p>
                          <p className="font-bold text-blue-900 dark:text-blue-100">1100XXXXXXXXXX</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Account Type</p>
                          <p className="font-bold text-green-900 dark:text-green-100">Tier I (Mandatory)</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Corpus</p>
                          <p className="font-bold text-purple-900 dark:text-purple-100">₹12,45,678</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Returns (CAGR)</p>
                          <p className="font-bold text-orange-900 dark:text-orange-100">10.2%</p>
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-100 dark:from-blue-900/30 to-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Estimated Monthly Pension at 60</p>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">₹45,000 - ₹55,000</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calculator className="h-5 w-5 text-green-600" />
                      <span>Fund Allocation</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Equity (E)</span>
                          <span className="font-bold text-green-700 dark:text-green-300">50%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '50%' }}></div>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Corporate Bonds (C)</span>
                          <span className="font-bold text-blue-700 dark:text-blue-300">30%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                        </div>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Government Securities (G)</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">20%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '20%' }}></div>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-4">
                        <Button variant="outline" size="sm">View Statement</Button>
                        <Button variant="outline" size="sm">Change Allocation</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ConsentAwareSchemeTab>
          </TabsContent>

          {/* APY - Atal Pension Yojana Tab */}
          <TabsContent value="apy" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="apy" 
              onRequestConsent={handleRequestConsent}
            >
              <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  APY data verified with your PAN and Aadhaar for secure access
                </span>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PiggyBank className="h-5 w-5 text-green-600" />
                      <span>APY Account Overview</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">APY Account</p>
                          <p className="font-bold text-green-900 dark:text-green-100">APY/SBI/001/789123</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Bank Partner</p>
                          <p className="font-bold text-blue-900 dark:text-blue-100">State Bank of India</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Enrollment Date</p>
                          <p className="font-bold text-purple-900 dark:text-purple-100">01-Sep-2018</p>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Current Age</p>
                          <p className="font-bold text-orange-900 dark:text-orange-100">35 Years</p>
                        </div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-green-100 dark:from-green-900/30 to-green-200 rounded-lg text-center">
                        <p className="text-sm text-green-700 dark:text-green-300">Guaranteed Monthly Pension</p>
                        <p className="text-3xl font-bold text-green-800 dark:text-green-200">₹3,000</p>
                        <p className="text-xs text-green-600">from age 60</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calculator className="h-5 w-5 text-blue-600" />
                      <span>Contribution & Benefits</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                          <p className="font-bold text-blue-900 dark:text-blue-100">₹376</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Contributed</p>
                          <p className="font-bold text-green-900 dark:text-green-100">₹27,072</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm font-medium text-green-900 dark:text-green-100">Spouse Pension Benefit</p>
                          <p className="text-xs text-green-700 dark:text-green-300">100% pension continues to spouse</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Corpus Return</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">₹1.7 lakh returned to nominee</p>
                        </div>
                      </div>
                      <div className="flex gap-4 mt-4">
                        <Button variant="outline" size="sm">View Statement</Button>
                        <Button variant="outline" size="sm">Contribution History</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="rebalance" className="space-y-8">
            {/* PAN Verification Banner */}
            <div className="flex items-center mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <Shield className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-green-700 dark:text-green-300">
                AI rebalancing analysis using your PAN-verified portfolio data for secure recommendations
              </span>
            </div>

            {/* Enhanced AI Rebalancing Dashboard */}
            <div className="space-y-8">
              {/* Portfolio Risk & Performance Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                      Risk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-2">7.3/10</div>
                    <p className="text-sm text-muted-foreground mb-3">Moderate-High Risk</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '73%' }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Based on asset allocation & volatility</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <Target className="h-5 w-5 text-green-600 mr-2" />
                      Diversification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-2">85%</div>
                    <p className="text-sm text-muted-foreground mb-3">Well Diversified</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Across 4 asset classes & sectors</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                      Rebalance Urgency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600 mb-2">Medium</div>
                    <p className="text-sm text-muted-foreground mb-3">Action Recommended</p>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-orange-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">2 allocations need adjustment</p>
                  </CardContent>
                </Card>
              </div>

              {/* Smart Rebalancing Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <Bot className="h-6 w-6 text-purple-600 mr-3" />
                    AI-Powered Rebalancing Recommendations
                  </CardTitle>
                  <p className="text-muted-foreground">Intelligent suggestions based on market conditions, risk profile, and tax efficiency</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Equity Rebalancing */}
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                          <h4 className="font-semibold text-foreground">Equity Allocation</h4>
                          <Badge variant="outline" className="text-orange-600 border-orange-600">Action Needed</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Current: 72% | Target: 65%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Value</p>
                          <p className="font-bold text-blue-600">₹32,88,880</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Target Value</p>
                          <p className="font-bold text-green-600">₹29,69,128</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Action Required</p>
                          <p className="font-bold text-red-600">Sell ₹3,19,752</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                          <span>Current vs Target</span>
                          <span>72% → 65%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full relative" style={{ width: '72%' }}>
                            <div className="absolute right-0 top-0 w-1 h-2 bg-green-600"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground"><strong>AI Recommendation:</strong> Reduce exposure to large-cap stocks, focus on profit booking in overvalued positions</p>
                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-600">
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* Debt Rebalancing */}
                    <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-green-600 rounded-full"></div>
                          <h4 className="font-semibold text-foreground">Debt Allocation</h4>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Increase</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Current: 18% | Target: 25%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Value</p>
                          <p className="font-bold text-blue-600">₹8,22,220</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Target Value</p>
                          <p className="font-bold text-green-600">₹11,41,972</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Action Required</p>
                          <p className="font-bold text-green-600">Buy ₹3,19,752</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
                          <span>Current vs Target</span>
                          <span>18% → 25%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full relative" style={{ width: '25%' }}>
                            <div className="absolute left-0 top-0 h-2 bg-green-400" style={{ width: '72%' }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground"><strong>AI Recommendation:</strong> Invest in high-grade corporate bonds and government securities for stability</p>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-600">
                          View Options
                        </Button>
                      </div>
                    </div>

                    {/* Gold & Alternative Investments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                            <h5 className="font-semibold text-foreground">Gold</h5>
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Optimal</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Current: 5% | Target: 5%</p>
                        <p className="text-xs text-muted-foreground">No action needed. Maintain current allocation.</p>
                      </div>

                      <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                            <h5 className="font-semibold text-foreground">Alternatives</h5>
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Optimal</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">Current: 5% | Target: 5%</p>
                        <p className="text-xs text-muted-foreground">REITs and commodities well balanced.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Rebalancing Simulator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <Calculator className="h-6 w-6 text-indigo-600 mr-3" />
                    Rebalancing Simulator & Scenario Analysis
                  </CardTitle>
                  <p className="text-muted-foreground">Test different allocation strategies and see projected outcomes</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Scenario Selection */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-4">Choose Rebalancing Scenario</h4>
                      <div className="space-y-3">
                        <div className="p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-blue-900 dark:text-blue-100">Conservative (Risk Score: 5.5)</h5>
                              <p className="text-sm text-blue-700 dark:text-blue-300">Equity: 55% | Debt: 35% | Gold: 7% | Alt: 3%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-blue-600" defaultChecked />
                          </div>
                        </div>
                        <div className="p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-foreground">Balanced (Risk Score: 7.0)</h5>
                              <p className="text-sm text-muted-foreground">Equity: 65% | Debt: 25% | Gold: 5% | Alt: 5%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-muted-foreground" />
                          </div>
                        </div>
                        <div className="p-3 border border-border rounded-lg cursor-pointer hover:bg-muted">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-foreground">Aggressive (Risk Score: 8.5)</h5>
                              <p className="text-sm text-muted-foreground">Equity: 80% | Debt: 15% | Gold: 3% | Alt: 2%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Projected Outcomes */}
                    <div>
                      <h4 className="font-semibold text-foreground mb-4">Projected Outcomes (Conservative)</h4>
                      <div className="space-y-4">
                        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-900 dark:text-green-100">Expected Annual Return</span>
                            <span className="font-bold text-green-600">10.5%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-900 dark:text-green-100">Risk Level</span>
                            <span className="font-bold text-green-600">Low-Medium</span>
                          </div>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Portfolio Value (5 years)</span>
                            <span className="font-bold text-blue-600">₹74.2L</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Potential Gain</span>
                            <span className="font-bold text-blue-600">+₹28.5L</span>
                          </div>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Tax Efficiency</span>
                            <span className="font-bold text-yellow-600">High</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Estimated Tax Savings</span>
                            <span className="font-bold text-yellow-600">₹1.2L/year</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-foreground">Tax-Efficient Rebalancing Timeline</h5>
                        <p className="text-sm text-muted-foreground">Optimal execution to minimize tax impact</p>
                      </div>
                      <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
                        Generate Execution Plan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Execution Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <TrendingUp className="h-6 w-6 text-green-600 mr-3" />
                    Execute Rebalancing
                  </CardTitle>
                  <p className="text-muted-foreground">One-click execution with built-in safeguards</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total Sell Orders</p>
                      <p className="text-2xl font-bold text-red-600">₹3.19L</p>
                      <p className="text-xs text-muted-foreground">2 transactions</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Total Buy Orders</p>
                      <p className="text-2xl font-bold text-green-600">₹3.19L</p>
                      <p className="text-xs text-muted-foreground">3 transactions</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Estimated Fees</p>
                      <p className="text-2xl font-bold text-blue-600">₹850</p>
                      <p className="text-xs text-muted-foreground">All inclusive</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="confirm-execution" className="rounded border-border" />
                        <label htmlFor="confirm-execution" className="text-sm text-muted-foreground">
                          I understand the tax implications and execution costs
                        </label>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <Button variant="outline">
                        Save as Draft
                      </Button>
                      <Button className="bg-green-600 text-white hover:bg-green-700" disabled>
                        Execute Rebalancing
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      </div>

      {/* Consent Dialog */}
      {user?.panNumber && (
        <ConsentDialog
          isOpen={consentDialogOpen}
          onOpenChange={setConsentDialogOpen}
          panNumber={user.panNumber}
          schemeType={currentSchemeType}
          onConsentGranted={handleConsentGranted}
        />
      )}
    </div>
  );
}
