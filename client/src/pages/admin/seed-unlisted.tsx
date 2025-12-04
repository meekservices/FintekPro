import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Loader2, Building2, CheckCircle, 
  AlertCircle, Sprout, TrendingUp, Package, ChevronDown, ChevronRight,
  DollarSign, RefreshCw, BarChart3, Users, Calculator, ExternalLink,
  Globe, Plus, Download, Clock
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

interface UnlistedCompany {
  id: string;
  name: string;
  cin?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  status: string;
  listingStage?: string;
  faceValue?: string;
  totalShares?: number;
  lastSyncedAt?: string;
  createdAt?: string;
}

interface StoreProduct {
  id: string;
  name: string;
  sourceCompanyId?: string;
  buyPrice?: string;
  sellPrice?: string;
}

interface MoneyControlPrice {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  lastUpdated: string | null;
  available: boolean;
  error?: string;
  matchedName?: string;
  matchScore?: number;
}

interface InternalCalculation {
  suggestedPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  confidence: 'high' | 'medium' | 'low' | null;
  methodology: string | null;
  rationale: string[];
  available: boolean;
  error?: string;
}

interface MarketplacePrice {
  bestBid: number | null;
  bestAsk: number | null;
  bidVolume: number;
  askVolume: number;
  recentClearingPrice: number | null;
  recentDealCount: number;
  activeBuyRequests: number;
  activeSellListings: number;
  available: boolean;
}

interface PriceSuggestion {
  companyId: string;
  companyName: string;
  moneyControl: MoneyControlPrice;
  internalCalculation: InternalCalculation;
  marketplace: MarketplacePrice;
  recommendedBuyPrice: number | null;
  recommendedSellPrice: number | null;
  priceConfidence: 'high' | 'medium' | 'low';
}

interface CompanyPriceState {
  buyPrice: string;
  sellPrice: string;
  expanded: boolean;
  loading: boolean;
  priceSuggestion: PriceSuggestion | null;
}

interface MoneyControlExternalCompany {
  name: string;
  isin: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  sector?: string;
  scrapedAt: string;
}

interface ReconciliationSuggestion {
  externalCompany: MoneyControlExternalCompany;
  matchConfidence: 'none' | 'low' | 'partial';
  possibleMatches: {
    companyId: string;
    companyName: string;
    matchScore: number;
  }[];
  status: 'new' | 'ignored' | 'synced';
}

interface ReconciliationData {
  suggestions: ReconciliationSuggestion[];
  cacheInfo: {
    scrapedAt: string;
    expiresAt: string;
    totalMoneyControlCompanies: number;
    totalFintekProCompanies: number;
    matchedCount: number;
    unmatchedCount: number;
  };
}

export default function SeedUnlistedPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [publishingCompanyId, setPublishingCompanyId] = useState<string | null>(null);
  const [companyPrices, setCompanyPrices] = useState<Record<string, CompanyPriceState>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [syncingCompanies, setSyncingCompanies] = useState<Set<string>>(new Set());

  const { data: companiesData, isLoading: isLoadingCompanies } = useQuery<UnlistedCompany[]>({
    queryKey: ['/api/unlisted/admin/companies'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/companies?status=active');
      if (!response.ok) throw new Error('Failed to fetch companies');
      const result = await response.json();
      return result.data || [];
    },
  });

  const { data: storeProductsData } = useQuery<{ products: StoreProduct[] }>({
    queryKey: ['/api/admin/store/products'],
  });

  const { data: reconciliationData, isLoading: isLoadingReconciliation, refetch: refetchReconciliation } = useQuery<ReconciliationData>({
    queryKey: ['/api/unlisted/admin/reconciliation/moneycontrol'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/admin/reconciliation/moneycontrol');
      if (!response.ok) throw new Error('Failed to fetch MoneyControl suggestions');
      const result = await response.json();
      return result.data;
    },
    enabled: showSuggestions,
    staleTime: 1000 * 60 * 5,
  });

  const companies = companiesData || [];
  const storeProducts = storeProductsData?.products || [];

  const publishedCompanyIds = new Set(
    storeProducts
      .filter(p => p.sourceCompanyId)
      .map(p => p.sourceCompanyId)
  );

  const filteredCompanies = companies.filter(company => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(query) ||
      company.cin?.toLowerCase().includes(query) ||
      company.sector?.toLowerCase().includes(query)
    );
  });

  const availableCompanies = filteredCompanies.filter(c => !publishedCompanyIds.has(c.id));
  const alreadyPublishedCompanies = filteredCompanies.filter(c => publishedCompanyIds.has(c.id));

  const fetchPriceSuggestions = async (companyId: string) => {
    setCompanyPrices(prev => ({
      ...prev,
      [companyId]: { 
        buyPrice: prev[companyId]?.buyPrice || '',
        sellPrice: prev[companyId]?.sellPrice || '',
        expanded: true, 
        loading: true,
        priceSuggestion: prev[companyId]?.priceSuggestion || null
      }
    }));

    try {
      const response = await fetch(`/api/unlisted/admin/price-suggestions/${companyId}`);
      if (!response.ok) throw new Error('Failed to fetch price suggestions');
      const result = await response.json();
      const suggestion = result.data as PriceSuggestion;

      setCompanyPrices(prev => ({
        ...prev,
        [companyId]: {
          buyPrice: prev[companyId]?.buyPrice || (suggestion.recommendedBuyPrice?.toString() || ''),
          sellPrice: prev[companyId]?.sellPrice || (suggestion.recommendedSellPrice?.toString() || ''),
          expanded: true,
          loading: false,
          priceSuggestion: suggestion,
        }
      }));
    } catch (error: any) {
      toast({
        title: 'Failed to fetch prices',
        description: error.message,
        variant: 'destructive'
      });
      setCompanyPrices(prev => ({
        ...prev,
        [companyId]: { 
          buyPrice: prev[companyId]?.buyPrice || '',
          sellPrice: prev[companyId]?.sellPrice || '',
          expanded: true,
          loading: false,
          priceSuggestion: null
        }
      }));
    }
  };

  const refreshMoneyControlPrice = async (companyId: string) => {
    try {
      const response = await apiRequest(`/api/unlisted/admin/refresh-moneycontrol/${companyId}`, { method: 'POST' });
      toast({ title: 'MoneyControl price refreshed' });
      await fetchPriceSuggestions(companyId);
    } catch (error: any) {
      toast({
        title: 'Failed to refresh price',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleExpanded = (companyId: string) => {
    const current = companyPrices[companyId];
    if (!current?.priceSuggestion && !current?.loading) {
      fetchPriceSuggestions(companyId);
    } else {
      setCompanyPrices(prev => ({
        ...prev,
        [companyId]: { ...prev[companyId], expanded: !prev[companyId]?.expanded }
      }));
    }
  };

  const applyPrice = (companyId: string, field: 'buyPrice' | 'sellPrice', value: number) => {
    setCompanyPrices(prev => ({
      ...prev,
      [companyId]: { ...prev[companyId], [field]: value.toString() }
    }));
  };

  const updatePrice = (companyId: string, field: 'buyPrice' | 'sellPrice', value: string) => {
    setCompanyPrices(prev => ({
      ...prev,
      [companyId]: { ...prev[companyId], [field]: value }
    }));
  };

  const publishMutation = useMutation({
    mutationFn: async ({ companyId, buyPrice, sellPrice }: { companyId: string; buyPrice: string; sellPrice: string }) => {
      setPublishingCompanyId(companyId);
      return apiRequest(`/api/unlisted/companies/${companyId}/publish-to-store-with-prices`, { 
        method: 'POST',
        body: JSON.stringify({ buyPrice, sellPrice, priceSource: 'admin' })
      });
    },
    onSuccess: (data: any, { companyId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/products'] });
      setSelectedCompanies(prev => {
        const next = new Set(prev);
        next.delete(companyId);
        return next;
      });
      toast({ 
        title: 'Published to Store', 
        description: data?.data?.message || 'Company is now available in the Store with your set prices'
      });
      setPublishingCompanyId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Publish failed',
        description: error.message || 'Failed to publish company to store',
        variant: 'destructive'
      });
      setPublishingCompanyId(null);
    }
  });

  const handlePublish = (companyId: string) => {
    const prices = companyPrices[companyId];
    if (!prices?.buyPrice || !prices?.sellPrice) {
      toast({
        title: 'Prices required',
        description: 'Please set both buy and sell prices before publishing',
        variant: 'destructive'
      });
      if (!prices?.priceSuggestion) {
        fetchPriceSuggestions(companyId);
      }
      return;
    }

    const buy = parseFloat(prices.buyPrice);
    const sell = parseFloat(prices.sellPrice);

    if (isNaN(buy) || isNaN(sell) || buy <= 0 || sell <= 0) {
      toast({
        title: 'Invalid prices',
        description: 'Please enter valid positive numbers for prices',
        variant: 'destructive'
      });
      return;
    }

    if (buy >= sell) {
      toast({
        title: 'Invalid price range',
        description: 'Buy price must be less than sell price',
        variant: 'destructive'
      });
      return;
    }

    publishMutation.mutate({ companyId, buyPrice: prices.buyPrice, sellPrice: prices.sellPrice });
  };

  const handleSyncSuggestion = async (suggestion: ReconciliationSuggestion) => {
    const isin = suggestion.externalCompany.isin;
    setSyncingCompanies(prev => new Set(prev).add(isin));
    
    try {
      const response = await apiRequest('/api/unlisted/admin/reconciliation/sync', {
        method: 'POST',
        body: JSON.stringify({ company: suggestion.externalCompany })
      });
      
      toast({
        title: 'Company synced',
        description: `${suggestion.externalCompany.name} has been added to FintekPro`
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/reconciliation/moneycontrol'] });
      setSelectedSuggestions(prev => {
        const next = new Set(prev);
        next.delete(isin);
        return next;
      });
    } catch (error: any) {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync company',
        variant: 'destructive'
      });
    } finally {
      setSyncingCompanies(prev => {
        const next = new Set(prev);
        next.delete(isin);
        return next;
      });
    }
  };

  const handleBulkSync = async () => {
    const toSync = reconciliationData?.suggestions.filter(s => selectedSuggestions.has(s.externalCompany.isin)) || [];
    if (toSync.length === 0) return;

    for (const suggestion of toSync) {
      await handleSyncSuggestion(suggestion);
    }
    setSelectedSuggestions(new Set());
  };

  const toggleSuggestionSelect = (isin: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(isin)) {
        next.delete(isin);
      } else {
        next.add(isin);
      }
      return next;
    });
  };

  const handleRefreshReconciliation = async () => {
    try {
      const response = await fetch('/api/unlisted/admin/reconciliation/moneycontrol?refresh=true');
      if (!response.ok) throw new Error('Failed to refresh');
      await refetchReconciliation();
      toast({ title: 'MoneyControl data refreshed' });
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedCompanies.size === availableCompanies.length) {
      setSelectedCompanies(new Set());
    } else {
      setSelectedCompanies(new Set(availableCompanies.map(c => c.id)));
    }
  };

  const toggleSelectCompany = (companyId: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const getStageBadgeColor = (stage?: string) => {
    switch (stage) {
      case 'pre_ipo': return 'bg-blue-600/20 text-blue-400';
      case 'growth': return 'bg-purple-600/20 text-purple-400';
      case 'mature': return 'bg-cyan-600/20 text-cyan-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  const getStageLabel = (stage?: string) => {
    switch (stage) {
      case 'pre_ipo': return 'Pre-IPO';
      case 'growth': return 'Growth';
      case 'mature': return 'Mature';
      default: return 'Unlisted';
    }
  };

  const getConfidenceBadge = (confidence: string | null) => {
    switch (confidence) {
      case 'high': return <Badge className="bg-green-600/20 text-green-400">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-600/20 text-yellow-400">Medium</Badge>;
      case 'low': return <Badge className="bg-red-600/20 text-red-400">Low</Badge>;
      default: return <Badge className="bg-gray-600/20 text-gray-400">N/A</Badge>;
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '—';
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const PriceSuggestionPanel = ({ company, prices }: { company: UnlistedCompany; prices: CompanyPriceState }) => {
    const suggestion = prices.priceSuggestion;
    if (!suggestion) return null;

    return (
      <div className="p-4 bg-gray-800/50 border-t border-gray-700 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MoneyControl Source */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
                <ExternalLink className="w-4 h-4" />
                MoneyControl
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestion.moneyControl.available ? (
                <>
                  <div className="text-2xl font-bold text-white">
                    {formatPrice(suggestion.moneyControl.price)}
                  </div>
                  {suggestion.moneyControl.changePercent !== null && (
                    <div className={`text-sm ${suggestion.moneyControl.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {suggestion.moneyControl.changePercent >= 0 ? '+' : ''}{suggestion.moneyControl.changePercent.toFixed(2)}%
                    </div>
                  )}
                  {suggestion.moneyControl.matchedName && (
                    <div className="text-xs text-gray-400">
                      Matched: {suggestion.moneyControl.matchedName}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => applyPrice(company.id, 'buyPrice', suggestion.moneyControl.price! * 0.95)}
                      data-testid={`apply-mc-buy-${company.id}`}
                    >
                      Apply -5% Buy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => applyPrice(company.id, 'sellPrice', suggestion.moneyControl.price!)}
                      data-testid={`apply-mc-sell-${company.id}`}
                    >
                      Apply Sell
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {suggestion.moneyControl.error || 'Not available'}
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-gray-400 hover:text-white"
                onClick={() => refreshMoneyControlPrice(company.id)}
                data-testid={`refresh-mc-${company.id}`}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </CardContent>
          </Card>

          {/* Internal Calculation Source */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                <Calculator className="w-4 h-4" />
                Internal Calculation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestion.internalCalculation.available ? (
                <>
                  <div className="text-2xl font-bold text-white">
                    {formatPrice(suggestion.internalCalculation.suggestedPrice)}
                  </div>
                  <div className="text-xs text-gray-400">
                    Range: {formatPrice(suggestion.internalCalculation.minPrice)} - {formatPrice(suggestion.internalCalculation.maxPrice)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Confidence:</span>
                    {getConfidenceBadge(suggestion.internalCalculation.confidence)}
                  </div>
                  {suggestion.internalCalculation.methodology && (
                    <div className="text-xs text-gray-500">
                      {suggestion.internalCalculation.methodology}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => applyPrice(company.id, 'buyPrice', suggestion.internalCalculation.minPrice!)}
                      data-testid={`apply-internal-buy-${company.id}`}
                    >
                      Apply Min Buy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => applyPrice(company.id, 'sellPrice', suggestion.internalCalculation.maxPrice!)}
                      data-testid={`apply-internal-sell-${company.id}`}
                    >
                      Apply Max Sell
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {suggestion.internalCalculation.error || 'Insufficient data'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marketplace Source */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-400">
                <Users className="w-4 h-4" />
                Marketplace
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestion.marketplace.available ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs">Best Bid</div>
                      <div className="font-bold text-green-400">{formatPrice(suggestion.marketplace.bestBid)}</div>
                      <div className="text-xs text-gray-500">{suggestion.marketplace.bidVolume} shares</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs">Best Ask</div>
                      <div className="font-bold text-red-400">{formatPrice(suggestion.marketplace.bestAsk)}</div>
                      <div className="text-xs text-gray-500">{suggestion.marketplace.askVolume} shares</div>
                    </div>
                  </div>
                  {suggestion.marketplace.recentClearingPrice && (
                    <div className="text-xs text-gray-400">
                      Recent avg: {formatPrice(suggestion.marketplace.recentClearingPrice)} ({suggestion.marketplace.recentDealCount} deals)
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    {suggestion.marketplace.bestBid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => applyPrice(company.id, 'buyPrice', suggestion.marketplace.bestBid!)}
                        data-testid={`apply-mp-buy-${company.id}`}
                      >
                        Apply Bid
                      </Button>
                    )}
                    {suggestion.marketplace.bestAsk && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => applyPrice(company.id, 'sellPrice', suggestion.marketplace.bestAsk!)}
                        data-testid={`apply-mp-sell-${company.id}`}
                      >
                        Apply Ask
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  No marketplace activity
                </div>
              )}
              <div className="text-xs text-gray-500">
                {suggestion.marketplace.activeBuyRequests} buy requests, {suggestion.marketplace.activeSellListings} sell listings
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommended Prices & Input */}
        <div className="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">Recommended</div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-gray-500">Buy:</span>
                <span className="ml-1 font-bold text-green-400">{formatPrice(suggestion.recommendedBuyPrice)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Sell:</span>
                <span className="ml-1 font-bold text-red-400">{formatPrice(suggestion.recommendedSellPrice)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Confidence:</span>
                {getConfidenceBadge(suggestion.priceConfidence)}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (suggestion.recommendedBuyPrice) applyPrice(company.id, 'buyPrice', suggestion.recommendedBuyPrice);
              if (suggestion.recommendedSellPrice) applyPrice(company.id, 'sellPrice', suggestion.recommendedSellPrice);
            }}
            disabled={!suggestion.recommendedBuyPrice || !suggestion.recommendedSellPrice}
            data-testid={`apply-recommended-${company.id}`}
          >
            Apply Recommended
          </Button>
        </div>

        {/* Admin Price Input */}
        <div className="flex items-center gap-4 p-4 bg-emerald-900/20 rounded-lg border border-emerald-700/30">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Buy Price (₹)</label>
              <Input
                type="number"
                value={prices.buyPrice}
                onChange={(e) => updatePrice(company.id, 'buyPrice', e.target.value)}
                placeholder="Enter buy price"
                className="bg-gray-800 border-gray-700"
                data-testid={`input-buy-price-${company.id}`}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Sell Price (₹)</label>
              <Input
                type="number"
                value={prices.sellPrice}
                onChange={(e) => updatePrice(company.id, 'sellPrice', e.target.value)}
                placeholder="Enter sell price"
                className="bg-gray-800 border-gray-700"
                data-testid={`input-sell-price-${company.id}`}
              />
            </div>
          </div>
          <Button
            onClick={() => handlePublish(company.id)}
            disabled={publishingCompanyId === company.id || !prices.buyPrice || !prices.sellPrice}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid={`button-publish-with-prices-${company.id}`}
          >
            {publishingCompanyId === company.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Package className="w-4 h-4 mr-2" />
                Publish with Prices
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/store-management">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Store Management
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sprout className="w-6 h-6 text-emerald-400" />
              Seed Unlisted Stocks
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Set buy/sell prices and publish unlisted companies to the Store
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className={showSuggestions ? "bg-orange-600/20 text-orange-400 border-orange-500" : "text-orange-400 border-orange-500/50"}
            onClick={() => setShowSuggestions(!showSuggestions)}
            data-testid="button-toggle-suggestions"
          >
            <Globe className="w-4 h-4 mr-2" />
            MoneyControl Sync
          </Button>
          <Badge variant="outline" className="text-blue-400 border-blue-400">
            {availableCompanies.length} Available
          </Badge>
          <Badge variant="outline" className="text-green-400 border-green-400">
            {alreadyPublishedCompanies.length} Already Published
          </Badge>
        </div>
      </div>

      {/* MoneyControl Suggestions Panel */}
      {showSuggestions && (
        <Card className="bg-orange-900/10 border-orange-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-orange-400" />
                  MoneyControl Suggestions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Companies found on MoneyControl that are not yet in FintekPro
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {reconciliationData?.cacheInfo && (
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last scraped: {format(new Date(reconciliationData.cacheInfo.scrapedAt), 'MMM d, HH:mm')}
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-orange-400 border-orange-500/50"
                  onClick={handleRefreshReconciliation}
                  disabled={isLoadingReconciliation}
                  data-testid="button-refresh-suggestions"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingReconciliation ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {selectedSuggestions.size > 0 && (
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleBulkSync}
                    data-testid="button-bulk-sync"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add {selectedSuggestions.size} Selected
                  </Button>
                )}
              </div>
            </div>
            {reconciliationData?.cacheInfo && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-gray-400">
                  MoneyControl: <span className="text-orange-400 font-medium">{reconciliationData.cacheInfo.totalMoneyControlCompanies}</span>
                </span>
                <span className="text-gray-400">
                  FintekPro: <span className="text-blue-400 font-medium">{reconciliationData.cacheInfo.totalFintekProCompanies}</span>
                </span>
                <span className="text-gray-400">
                  Already Synced: <span className="text-green-400 font-medium">{reconciliationData.cacheInfo.matchedCount}</span>
                </span>
                <span className="text-gray-400">
                  New to Add: <span className="text-yellow-400 font-medium">{reconciliationData.cacheInfo.unmatchedCount}</span>
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingReconciliation ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-400 mr-2" />
                <span className="text-gray-400">Fetching MoneyControl data...</span>
              </div>
            ) : !reconciliationData?.suggestions?.length ? (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p>All MoneyControl companies are already synced!</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {reconciliationData.suggestions.map((suggestion) => (
                    <div 
                      key={suggestion.externalCompany.isin}
                      className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-orange-500/30"
                    >
                      <Checkbox
                        checked={selectedSuggestions.has(suggestion.externalCompany.isin)}
                        onCheckedChange={() => toggleSuggestionSelect(suggestion.externalCompany.isin)}
                        data-testid={`checkbox-suggestion-${suggestion.externalCompany.isin}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{suggestion.externalCompany.name}</span>
                          {suggestion.matchConfidence !== 'none' && (
                            <Badge variant="outline" className={
                              suggestion.matchConfidence === 'partial' 
                                ? 'text-yellow-400 border-yellow-500/30' 
                                : 'text-gray-400 border-gray-600'
                            }>
                              {suggestion.matchConfidence === 'partial' ? 'Possible duplicate' : 'Low match'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          ISIN: {suggestion.externalCompany.isin} • 
                          Price: <span className="text-green-400">₹{suggestion.externalCompany.price.toLocaleString('en-IN')}</span>
                          {suggestion.externalCompany.changePercent !== 0 && (
                            <span className={suggestion.externalCompany.changePercent >= 0 ? 'text-green-400 ml-2' : 'text-red-400 ml-2'}>
                              {suggestion.externalCompany.changePercent >= 0 ? '+' : ''}{suggestion.externalCompany.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        {suggestion.possibleMatches.length > 0 && (
                          <div className="text-xs text-yellow-400/80 mt-1">
                            Similar to: {suggestion.possibleMatches[0].companyName} ({suggestion.possibleMatches[0].matchScore}% match)
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-orange-400 border-orange-500/50"
                        onClick={() => handleSyncSuggestion(suggestion)}
                        disabled={syncingCompanies.has(suggestion.externalCompany.isin)}
                        data-testid={`button-sync-${suggestion.externalCompany.isin}`}
                      >
                        {syncingCompanies.has(suggestion.externalCompany.isin) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-1" />
                            Add to FintekPro
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Available Companies
              </CardTitle>
              <CardDescription className="text-gray-400">
                Click on a company row to view price suggestions from MoneyControl, Internal Calculation, and Marketplace
              </CardDescription>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by company name, CIN, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white"
              data-testid="input-search-companies"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCompanies ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-gray-400">Loading companies...</span>
            </div>
          ) : availableCompanies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium text-white">All companies are already published!</p>
              <p className="text-sm mt-2">No more unlisted companies available to seed</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {availableCompanies.map((company) => {
                  const prices = companyPrices[company.id] || { buyPrice: '', sellPrice: '', expanded: false, loading: false, priceSuggestion: null };
                  
                  return (
                    <div key={company.id} className="border border-gray-800 rounded-lg overflow-hidden">
                      {/* Company Header Row */}
                      <div 
                        className="flex items-center gap-4 p-4 hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => toggleExpanded(company.id)}
                        data-testid={`row-company-${company.id}`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {prices.loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          ) : prices.expanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <Checkbox
                          checked={selectedCompanies.has(company.id)}
                          onCheckedChange={() => toggleSelectCompany(company.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-company-${company.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-400" />
                            <span className="font-medium text-white">{company.name}</span>
                            <Badge className={getStageBadgeColor(company.listingStage)}>
                              {getStageLabel(company.listingStage)}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {company.cin || 'No CIN'} • {company.sector || 'No sector'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {prices.buyPrice && prices.sellPrice && (
                            <div className="text-right">
                              <div className="text-xs text-gray-400">Prices Set</div>
                              <div className="text-sm">
                                <span className="text-green-400">₹{prices.buyPrice}</span>
                                <span className="text-gray-500 mx-1">/</span>
                                <span className="text-red-400">₹{prices.sellPrice}</span>
                              </div>
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-blue-600/20 text-blue-400 border-blue-500/30"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(company.id);
                            }}
                            data-testid={`button-expand-${company.id}`}
                          >
                            <BarChart3 className="w-4 h-4 mr-1" />
                            {prices.expanded ? 'Hide' : 'View'} Prices
                          </Button>
                        </div>
                      </div>
                      
                      {/* Expandable Price Suggestion Panel */}
                      {prices.expanded && (
                        <>
                          {prices.loading ? (
                            <div className="p-8 flex items-center justify-center bg-gray-800/30 border-t border-gray-700">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
                              <span className="text-gray-400">Loading price suggestions...</span>
                            </div>
                          ) : prices.priceSuggestion ? (
                            <PriceSuggestionPanel company={company} prices={prices} />
                          ) : (
                            <div className="p-8 flex items-center justify-center bg-gray-800/30 border-t border-gray-700">
                              <AlertCircle className="w-6 h-6 text-yellow-400 mr-2" />
                              <span className="text-gray-400">No price data available</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {alreadyPublishedCompanies.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Already Published ({alreadyPublishedCompanies.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              These companies are already available in the Store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800 hover:bg-transparent">
                    <TableHead className="text-gray-400">Company Name</TableHead>
                    <TableHead className="text-gray-400">Sector</TableHead>
                    <TableHead className="text-gray-400">Stage</TableHead>
                    <TableHead className="text-right text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alreadyPublishedCompanies.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="border-gray-800 hover:bg-gray-800/50"
                    >
                      <TableCell className="font-medium text-gray-400">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStageBadgeColor(company.listingStage)}>
                          {getStageLabel(company.listingStage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
