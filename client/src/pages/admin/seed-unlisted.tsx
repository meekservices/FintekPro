import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Link, useLocation } from "wouter";
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

interface UnifiedSearchResult {
  id: string;
  name: string;
  isin?: string;
  cin?: string;
  pan?: string;
  sector?: string;
  status?: string;
  incorporationDate?: string;
  source: 'moneycontrol' | 'probe42' | 'mca' | 'internal';
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  isInFintekPro: boolean;
  fintekProId?: string;
  dataQuality?: number;
  rawData: any;
}

interface SourceError {
  code: number;
  message: string;
  troubleshooting: string;
  isRetryable: boolean;
}

interface SourceStatus {
  searched: boolean;
  resultCount: number;
  error?: SourceError;
  usedMockData?: boolean;
}

interface UnifiedSearchResponse {
  query: string;
  totalResults: number;
  results: UnifiedSearchResult[];
  sources: {
    moneycontrol: number;
    mca: number;
    probe42: number;
  };
  sourceStatuses?: {
    moneycontrol: SourceStatus;
    mca: SourceStatus;
    probe42: SourceStatus;
  };
}

const getSourceBadge = (source: string, dataQuality?: number) => {
  const sourceConfig: Record<string, { label: string; color: string; description: string }> = {
    mca: { 
      label: 'MCA', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      description: 'Official government filings via Sandbox API'
    },
    moneycontrol: { 
      label: 'MoneyControl', 
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      description: 'Real-time price data'
    },
    probe42: { 
      label: 'Probe42', 
      color: 'bg-muted text-foreground',
      description: 'Legacy source (deprecated)'
    },
    internal: { 
      label: 'FintekPro', 
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      description: 'Internal database'
    },
    fintekpro: { 
      label: 'FintekPro', 
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      description: 'Internal database'
    },
    calculated: { 
      label: 'Calculated', 
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      description: 'Derived from financial data'
    },
    unavailable: { 
      label: 'N/A', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      description: 'Data not available'
    },
  };
  
  const config = sourceConfig[source] || sourceConfig.internal;
  
  return (
    <Badge 
      variant="secondary" 
      className={`${config.color} text-xs font-medium`}
      title={config.description}
    >
      {config.label}
      {dataQuality && <span className="ml-1 opacity-70">({dataQuality}%)</span>}
    </Badge>
  );
};

export default function SeedUnlistedPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [publishingCompanyId, setPublishingCompanyId] = useState<string | null>(null);
  const [companyPrices, setCompanyPrices] = useState<Record<string, CompanyPriceState>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [syncingCompanies, setSyncingCompanies] = useState<Set<string>>(new Set());
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  
  // Unified search state
  const [unifiedSearchQuery, setUnifiedSearchQuery] = useState("");
  const [debouncedUnifiedSearch, setDebouncedUnifiedSearch] = useState("");
  const [selectedSearchResult, setSelectedSearchResult] = useState<UnifiedSearchResult | null>(null);
  const [publishPrices, setPublishPrices] = useState({ buyPrice: '', sellPrice: '' });
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Manual add state for when external sources don't have data
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddData, setManualAddData] = useState({
    name: '',
    cin: '',
    sector: 'Unknown',
    industry: '',
    description: ''
  });
  const [isManualAdding, setIsManualAdding] = useState(false);
  
  // Helper to check if query looks like a CIN
  const isValidCINFormat = (query: string) => {
    const cinPattern = /^[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/i;
    return cinPattern.test(query.trim());
  };

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

  // Debounce unified search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUnifiedSearch(unifiedSearchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [unifiedSearchQuery]);

  // Unified search query
  const { data: unifiedSearchData, isLoading: isSearching } = useQuery<UnifiedSearchResponse>({
    queryKey: ['/api/unlisted/admin/unified-search', debouncedUnifiedSearch],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/admin/unified-search?q=${encodeURIComponent(debouncedUnifiedSearch)}`);
      if (!response.ok) throw new Error('Failed to search companies');
      const result = await response.json();
      return result.data;
    },
    enabled: debouncedUnifiedSearch.length >= 2,
    staleTime: 1000 * 60 * 2,
  });

  const handleAddToFintekPro = async () => {
    if (!selectedSearchResult) return;
    
    setIsPublishing(true);
    try {
      const response = await apiRequest('/api/unlisted/admin/add-to-fintekpro', {
        method: 'POST',
        body: JSON.stringify({
          name: selectedSearchResult.name,
          isin: selectedSearchResult.isin,
          cin: selectedSearchResult.cin,
          pan: selectedSearchResult.pan,
          sector: selectedSearchResult.sector,
          status: selectedSearchResult.status,
          incorporationDate: selectedSearchResult.incorporationDate,
          currentPrice: selectedSearchResult.currentPrice,
          source: selectedSearchResult.source,
          probe42CompanyId: selectedSearchResult.source === 'probe42' 
            ? selectedSearchResult.id.replace('p42_', '') 
            : undefined,
        })
      });
      
      toast({
        title: 'Added to FintekPro',
        description: `${selectedSearchResult.name} has been added. Review price sources below and publish to store when ready.`
      });
      
      setSelectedSearchResult(null);
      setPublishPrices({ buyPrice: '', sellPrice: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/unified-search'] });
    } catch (error: any) {
      toast({
        title: 'Failed to add',
        description: error.message || 'Failed to add company to FintekPro',
        variant: 'destructive'
      });
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Handle manual add when external sources don't have data
  const handleManualAdd = async () => {
    if (!manualAddData.name.trim()) {
      toast({
        title: 'Company name required',
        description: 'Please enter the company name',
        variant: 'destructive'
      });
      return;
    }
    
    setIsManualAdding(true);
    try {
      const response = await apiRequest('/api/unlisted/admin/add-to-fintekpro', {
        method: 'POST',
        body: JSON.stringify({
          name: manualAddData.name.trim(),
          cin: manualAddData.cin.trim() || undefined,
          sector: manualAddData.sector || 'Unknown',
          industry: manualAddData.industry.trim() || undefined,
          description: manualAddData.description.trim() || `Manually added by admin`,
          source: 'manual',
        })
      });
      
      toast({
        title: 'Company Added',
        description: `${manualAddData.name} has been added to FintekPro. You can now set prices and publish to the store.`
      });
      
      setShowManualAdd(false);
      setManualAddData({ name: '', cin: '', sector: 'Unknown', industry: '', description: '' });
      setUnifiedSearchQuery('');
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
    } catch (error: any) {
      toast({
        title: 'Failed to add company',
        description: error.message || 'Failed to add company manually',
        variant: 'destructive'
      });
    } finally {
      setIsManualAdding(false);
    }
  };

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

  const handleSaveAndPreview = (companyId: string) => {
    const prices = companyPrices[companyId];
    if (!prices?.buyPrice || !prices?.sellPrice) {
      toast({
        title: 'Prices required',
        description: 'Please set both buy and sell prices before previewing',
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

    navigate(`/admin/unlisted/preview/${companyId}?buyPrice=${prices.buyPrice}&sellPrice=${prices.sellPrice}`);
  };

  const handleSyncSuggestion = async (suggestion: ReconciliationSuggestion) => {
    if (isBulkSyncing) return;
    
    const isin = suggestion.externalCompany.isin;
    setSyncingCompanies(prev => new Set(prev).add(isin));
    
    try {
      const response = await fetch('/api/unlisted/admin/reconciliation/sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          companies: [{
            ...suggestion.externalCompany,
            scrapedAt: typeof suggestion.externalCompany.scrapedAt === 'string' 
              ? suggestion.externalCompany.scrapedAt 
              : new Date().toISOString()
          }]
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success && result.data?.success?.length > 0) {
        toast({
          title: 'Company synced',
          description: `${suggestion.externalCompany.name} has been added to FintekPro`
        });
        
        setSelectedSuggestions(prev => {
          const next = new Set(prev);
          next.delete(isin);
          return next;
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
        queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/reconciliation/moneycontrol'] });
        refetchReconciliation();
      } else {
        const errorMsg = result.data?.failed?.[0]?.reason || result.message || 'Failed to sync company';
        toast({
          title: 'Sync failed',
          description: errorMsg,
          variant: 'destructive'
        });
      }
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
    if (isBulkSyncing) return;
    
    const toSync = reconciliationData?.suggestions.filter(s => selectedSuggestions.has(s.externalCompany.isin)) || [];
    if (toSync.length === 0) return;

    setIsBulkSyncing(true);
    const allIsins = toSync.map(s => s.externalCompany.isin);
    setSyncingCompanies(new Set(allIsins));
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const failedIsins = new Set<string>();
    
    try {
      const BATCH_SIZE = 25;
      const batches: typeof toSync[] = [];
      for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
        batches.push(toSync.slice(i, i + BATCH_SIZE));
      }
      
      for (const batch of batches) {
        const companies = batch.map(s => ({
          ...s.externalCompany,
          scrapedAt: typeof s.externalCompany.scrapedAt === 'string' 
            ? s.externalCompany.scrapedAt 
            : new Date().toISOString()
        }));
        
        try {
          const response = await fetch('/api/unlisted/admin/reconciliation/sync-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ companies })
          });
          
          const result = await response.json();
          
          if (response.ok && result.success && result.data) {
            totalSuccess += result.data.success?.length || 0;
            totalFailed += result.data.failed?.length || 0;
            result.data.failed?.forEach((f: any) => failedIsins.add(f.isin || f.name));
          } else {
            totalFailed += batch.length;
            batch.forEach(s => failedIsins.add(s.externalCompany.isin));
          }
        } catch {
          totalFailed += batch.length;
          batch.forEach(s => failedIsins.add(s.externalCompany.isin));
        }
      }
      
      if (failedIsins.size > 0) {
        setSelectedSuggestions(failedIsins);
        toast({
          title: 'Bulk sync partially completed',
          description: `${totalSuccess} companies synced. ${totalFailed} failed - they remain selected for review.`,
          variant: 'destructive'
        });
      } else {
        setSelectedSuggestions(new Set());
        toast({
          title: 'Bulk sync completed',
          description: `${totalSuccess} companies synced successfully`
        });
      }
    } finally {
      setIsBulkSyncing(false);
      setSyncingCompanies(new Set());
      
      if (totalSuccess > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
        queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/reconciliation/moneycontrol'] });
        refetchReconciliation();
      }
    }
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
      default: return 'bg-muted/20 text-muted-foreground';
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
      default: return <Badge className="bg-muted/20 text-muted-foreground">N/A</Badge>;
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined) return '—';
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const PriceSuggestionPanel = ({ company, prices }: { company: UnlistedCompany; prices: CompanyPriceState }) => {
    const suggestion = prices.priceSuggestion;
    if (!suggestion) return null;

    const handleRefreshAllPrices = async () => {
      await fetchPriceSuggestions(company.id);
      toast({ title: 'Price data refreshed' });
    };

    return (
      <div className="p-4 bg-muted/50 border-t border-border space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">
            Review price sources and set final prices before publishing
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-blue-400 border-blue-500/50"
            onClick={handleRefreshAllPrices}
            data-testid={`button-refresh-all-prices-${company.id}`}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh All Prices
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MoneyControl Source */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-400">
                <ExternalLink className="w-4 h-4" />
                MoneyControl
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestion.moneyControl.available ? (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {formatPrice(suggestion.moneyControl.price)}
                  </div>
                  {suggestion.moneyControl.changePercent !== null && (
                    <div className={`text-sm ${suggestion.moneyControl.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {suggestion.moneyControl.changePercent >= 0 ? '+' : ''}{suggestion.moneyControl.changePercent.toFixed(2)}%
                    </div>
                  )}
                  {suggestion.moneyControl.matchedName && (
                    <div className="text-xs text-muted-foreground">
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
                <div className="text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {suggestion.moneyControl.error || 'Not available'}
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => refreshMoneyControlPrice(company.id)}
                data-testid={`refresh-mc-${company.id}`}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Refresh
              </Button>
            </CardContent>
          </Card>

          {/* Internal Calculation Source */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
                <Calculator className="w-4 h-4" />
                Internal Calculation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestion.internalCalculation.available ? (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {formatPrice(suggestion.internalCalculation.suggestedPrice)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Range: {formatPrice(suggestion.internalCalculation.minPrice)} - {formatPrice(suggestion.internalCalculation.maxPrice)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confidence:</span>
                    {getConfidenceBadge(suggestion.internalCalculation.confidence)}
                  </div>
                  {suggestion.internalCalculation.methodology && (
                    <div className="text-xs text-muted-foreground">
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
                <div className="text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {suggestion.internalCalculation.error || 'Insufficient data'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Marketplace Source */}
          <Card className="bg-card border-border">
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
                      <div className="text-muted-foreground text-xs">Best Bid</div>
                      <div className="font-bold text-green-400">{formatPrice(suggestion.marketplace.bestBid)}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.marketplace.bidVolume} shares</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Best Ask</div>
                      <div className="font-bold text-red-400">{formatPrice(suggestion.marketplace.bestAsk)}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.marketplace.askVolume} shares</div>
                    </div>
                  </div>
                  {suggestion.marketplace.recentClearingPrice && (
                    <div className="text-xs text-muted-foreground">
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
                <div className="text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  No marketplace activity
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                {suggestion.marketplace.activeBuyRequests} buy requests, {suggestion.marketplace.activeSellListings} sell listings
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommended Prices & Input */}
        <div className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground mb-1">Recommended</div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Buy:</span>
                <span className="ml-1 font-bold text-green-400">{formatPrice(suggestion.recommendedBuyPrice)}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Sell:</span>
                <span className="ml-1 font-bold text-red-400">{formatPrice(suggestion.recommendedSellPrice)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Confidence:</span>
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
              <label className="text-xs text-muted-foreground block mb-1">Buy Price (₹)</label>
              <Input
                type="number"
                step="0.01"
                value={prices.buyPrice}
                onChange={(e) => updatePrice(company.id, 'buyPrice', e.target.value)}
                placeholder="Enter buy price"
                className="bg-muted border-border"
                data-testid={`input-buy-price-${company.id}`}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sell Price (₹)</label>
              <Input
                type="number"
                step="0.01"
                value={prices.sellPrice}
                onChange={(e) => updatePrice(company.id, 'sellPrice', e.target.value)}
                placeholder="Enter sell price"
                className="bg-muted border-border"
                data-testid={`input-sell-price-${company.id}`}
              />
            </div>
          </div>
          <Button
            onClick={() => handleSaveAndPreview(company.id)}
            disabled={!prices.buyPrice || !prices.sellPrice}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid={`button-save-preview-${company.id}`}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Save Price & Preview
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
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Store Management
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sprout className="w-6 h-6 text-emerald-400" />
              Seed Unlisted Stocks
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
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

      {/* Unified Search - Search MoneyControl + Probe42 */}
      <Card className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-blue-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            Add New Unlisted Stock
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Search across MoneyControl and Probe42 to find companies and publish them to the store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search company by name, ISIN, or CIN..."
                value={unifiedSearchQuery}
                onChange={(e) => setUnifiedSearchQuery(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground"
                data-testid="input-unified-search"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-blue-400" />
              )}
            </div>
            
            {unifiedSearchData && unifiedSearchData.results.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                <span>Found {unifiedSearchData.totalResults} results:</span>
                {unifiedSearchData.sources.mca > 0 && (
                  <Badge variant="outline" className="text-green-400 border-green-400/50">
                    MCA: {unifiedSearchData.sources.mca}
                  </Badge>
                )}
                {unifiedSearchData.sources.moneycontrol > 0 && (
                  <Badge variant="outline" className="text-purple-400 border-purple-400/50">
                    MoneyControl: {unifiedSearchData.sources.moneycontrol}
                  </Badge>
                )}
                {unifiedSearchData.sources.probe42 > 0 && (
                  <Badge variant="outline" className="text-muted-foreground border-border">
                    Probe42: {unifiedSearchData.sources.probe42}
                  </Badge>
                )}
              </div>
            )}

            {/* Search Results */}
            {unifiedSearchData && unifiedSearchData.results.length > 0 && (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {unifiedSearchData.results.map((result) => (
                    <div
                      key={result.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSearchResult?.id === result.id
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-muted/50 border-border hover:bg-muted'
                      } ${result.isInFintekPro ? 'opacity-60' : ''}`}
                      onClick={() => !result.isInFintekPro && setSelectedSearchResult(result)}
                      data-testid={`search-result-${result.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{result.name}</span>
                            {getSourceBadge(result.source, result.dataQuality)}
                            {result.isInFintekPro && (
                              <Badge className="bg-green-500/20 text-green-400 text-xs">
                                Already in FintekPro
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                            {result.isin && <span>ISIN: {result.isin}</span>}
                            {result.cin && <span>CIN: {result.cin}</span>}
                            {result.sector && <span>Sector: {result.sector}</span>}
                          </div>
                        </div>
                        {result.currentPrice && (
                          <div className="text-right">
                            <div className="text-foreground font-medium">₹{result.currentPrice.toLocaleString()}</div>
                            {result.priceChangePercent !== undefined && (
                              <div className={`text-xs ${result.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {result.priceChangePercent >= 0 ? '+' : ''}{result.priceChangePercent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {debouncedUnifiedSearch.length >= 2 && !isSearching && unifiedSearchData?.results.length === 0 && (
              <div className="py-6">
                <div className="text-center text-muted-foreground mb-4">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No companies found matching "{debouncedUnifiedSearch}"</p>
                </div>
                
                {/* Detailed Source Error Information */}
                {unifiedSearchData?.sourceStatuses && (
                  <div className="space-y-2 mb-4 max-w-xl mx-auto">
                    {/* MCA Status */}
                    {unifiedSearchData.sourceStatuses.mca && (
                      <div className={`p-3 rounded-lg border text-left ${
                        unifiedSearchData.sourceStatuses.mca.error 
                          ? 'bg-red-900/20 border-red-500/30' 
                          : 'bg-muted/50 border-border'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-green-400 border-green-400/50 text-xs">MCA</Badge>
                          <span className="text-xs text-muted-foreground">
                            {unifiedSearchData.sourceStatuses.mca.searched 
                              ? `${unifiedSearchData.sourceStatuses.mca.resultCount} results`
                              : 'Not searched'}
                          </span>
                          {unifiedSearchData.sourceStatuses.mca.error && (
                            <Badge variant="destructive" className="text-xs">
                              Error {unifiedSearchData.sourceStatuses.mca.error.code}
                            </Badge>
                          )}
                        </div>
                        {unifiedSearchData.sourceStatuses.mca.error && (
                          <p className="text-xs text-red-300">
                            {unifiedSearchData.sourceStatuses.mca.error.troubleshooting}
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Probe42 Status */}
                    {unifiedSearchData.sourceStatuses.probe42 && (
                      <div className={`p-3 rounded-lg border text-left ${
                        unifiedSearchData.sourceStatuses.probe42.error && !unifiedSearchData.sourceStatuses.probe42.usedMockData
                          ? 'bg-red-900/20 border-red-500/30' 
                          : unifiedSearchData.sourceStatuses.probe42.usedMockData
                            ? 'bg-yellow-900/20 border-yellow-500/30'
                            : 'bg-muted/50 border-border'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-muted-foreground border-border text-xs">Probe42</Badge>
                          <span className="text-xs text-muted-foreground">
                            {unifiedSearchData.sourceStatuses.probe42.searched 
                              ? `${unifiedSearchData.sourceStatuses.probe42.resultCount} results`
                              : 'Not searched'}
                          </span>
                          {unifiedSearchData.sourceStatuses.probe42.usedMockData && (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/50 text-xs">
                              Mock Data
                            </Badge>
                          )}
                          {unifiedSearchData.sourceStatuses.probe42.error && !unifiedSearchData.sourceStatuses.probe42.usedMockData && (
                            <Badge variant="destructive" className="text-xs">
                              Error {unifiedSearchData.sourceStatuses.probe42.error.code}
                            </Badge>
                          )}
                        </div>
                        {unifiedSearchData.sourceStatuses.probe42.error && !unifiedSearchData.sourceStatuses.probe42.usedMockData && (
                          <p className="text-xs text-red-300">
                            {unifiedSearchData.sourceStatuses.probe42.error.troubleshooting}
                          </p>
                        )}
                        {unifiedSearchData.sourceStatuses.probe42.usedMockData && (
                          <p className="text-xs text-yellow-300">
                            Using mock data in development mode. Real API authentication failed.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* MoneyControl Status */}
                    {unifiedSearchData.sourceStatuses.moneycontrol && (
                      <div className={`p-3 rounded-lg border text-left ${
                        unifiedSearchData.sourceStatuses.moneycontrol.error 
                          ? 'bg-red-900/20 border-red-500/30' 
                          : 'bg-muted/50 border-border'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-purple-400 border-purple-400/50 text-xs">MoneyControl</Badge>
                          <span className="text-xs text-muted-foreground">
                            {unifiedSearchData.sourceStatuses.moneycontrol.searched 
                              ? `${unifiedSearchData.sourceStatuses.moneycontrol.resultCount} results`
                              : 'Not searched'}
                          </span>
                          {unifiedSearchData.sourceStatuses.moneycontrol.error && (
                            <Badge variant="destructive" className="text-xs">
                              Error {unifiedSearchData.sourceStatuses.moneycontrol.error.code}
                            </Badge>
                          )}
                        </div>
                        {unifiedSearchData.sourceStatuses.moneycontrol.error && (
                          <p className="text-xs text-red-300">
                            {unifiedSearchData.sourceStatuses.moneycontrol.error.troubleshooting}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Manual Add Option */}
                {!showManualAdd ? (
                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowManualAdd(true);
                        // Pre-fill CIN if the search query looks like a CIN
                        if (isValidCINFormat(debouncedUnifiedSearch)) {
                          setManualAddData(prev => ({ ...prev, cin: debouncedUnifiedSearch.toUpperCase() }));
                        }
                      }}
                      className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                      data-testid="button-manual-add"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Company Manually
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <h4 className="text-foreground font-medium mb-4 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" />
                      Add Company Manually
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-muted-foreground text-sm">Company Name *</Label>
                        <Input
                          value={manualAddData.name}
                          onChange={(e) => setManualAddData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter company name"
                          className="mt-1 bg-muted border-border text-foreground"
                          data-testid="input-manual-company-name"
                        />
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">CIN (21 characters)</Label>
                        <Input
                          value={manualAddData.cin}
                          onChange={(e) => setManualAddData(prev => ({ ...prev, cin: e.target.value.toUpperCase() }))}
                          placeholder="e.g., U72900KA2008PLC045316"
                          maxLength={21}
                          className="mt-1 bg-muted border-border text-foreground font-mono"
                          data-testid="input-manual-cin"
                        />
                        {manualAddData.cin && !isValidCINFormat(manualAddData.cin) && manualAddData.cin.length === 21 && (
                          <p className="text-xs text-yellow-400 mt-1">CIN format may be incorrect</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Sector</Label>
                        <select
                          value={manualAddData.sector}
                          onChange={(e) => setManualAddData(prev => ({ ...prev, sector: e.target.value }))}
                          className="mt-1 w-full bg-muted border border-border text-foreground rounded-md px-3 py-2"
                          data-testid="select-manual-sector"
                        >
                          <option value="Unknown">Unknown</option>
                          <option value="Technology">Technology</option>
                          <option value="Financial Services">Financial Services</option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Consumer Goods">Consumer Goods</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Energy">Energy</option>
                          <option value="Materials">Materials</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Communication Services">Communication Services</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-sm">Industry</Label>
                        <Input
                          value={manualAddData.industry}
                          onChange={(e) => setManualAddData(prev => ({ ...prev, industry: e.target.value }))}
                          placeholder="e.g., Software Development"
                          className="mt-1 bg-muted border-border text-foreground"
                          data-testid="input-manual-industry"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <Label className="text-muted-foreground text-sm">Description (optional)</Label>
                      <Input
                        value={manualAddData.description}
                        onChange={(e) => setManualAddData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief company description"
                        className="mt-1 bg-muted border-border text-foreground"
                        data-testid="input-manual-description"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={handleManualAdd}
                        disabled={isManualAdding || !manualAddData.name.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="button-confirm-manual-add"
                      >
                        {isManualAdding ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="w-4 h-4 mr-2" />
                        )}
                        Add to FintekPro
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowManualAdd(false);
                          setManualAddData({ name: '', cin: '', sector: 'Unknown', industry: '', description: '' });
                        }}
                        className="text-muted-foreground border-border"
                        data-testid="button-cancel-manual-add"
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      After adding, you can enrich data from the preview page and set prices before publishing.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Selected Company Preview & Add to FintekPro */}
            {selectedSearchResult && (
              <div className="mt-4 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Add to FintekPro: {selectedSearchResult.name}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <span className="ml-2 text-foreground capitalize">{selectedSearchResult.source}</span>
                  </div>
                  {selectedSearchResult.isin && (
                    <div>
                      <span className="text-muted-foreground">ISIN:</span>
                      <span className="ml-2 text-foreground">{selectedSearchResult.isin}</span>
                    </div>
                  )}
                  {selectedSearchResult.cin && (
                    <div>
                      <span className="text-muted-foreground">CIN:</span>
                      <span className="ml-2 text-foreground">{selectedSearchResult.cin}</span>
                    </div>
                  )}
                  {selectedSearchResult.currentPrice && (
                    <div>
                      <span className="text-muted-foreground">Current Price:</span>
                      <span className="ml-2 text-foreground">₹{selectedSearchResult.currentPrice.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg border border-border mb-4">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-blue-400 font-medium">Step 1:</span> Add to FintekPro database for internal review
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-emerald-400 font-medium">Step 2:</span> Review price sources below, then publish to store with your set prices
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleAddToFintekPro}
                    disabled={isPublishing}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-add-to-fintekpro"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Add to FintekPro
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedSearchResult(null);
                      setPublishPrices({ buyPrice: '', sellPrice: '' });
                    }}
                    className="text-muted-foreground border-border"
                    data-testid="button-cancel-publish"
                  >
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Company will appear in the list below after adding
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MoneyControl Suggestions Panel */}
      {showSuggestions && (
        <Card className="bg-orange-900/10 border-orange-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Globe className="w-5 h-5 text-orange-400" />
                  MoneyControl Suggestions
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Companies found on MoneyControl that are not yet in FintekPro
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {reconciliationData?.cacheInfo && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
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
                    disabled={isBulkSyncing}
                    data-testid="button-bulk-sync"
                  >
                    {isBulkSyncing ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-1" />
                    )}
                    {isBulkSyncing ? 'Syncing...' : `Add ${selectedSuggestions.size} Selected`}
                  </Button>
                )}
              </div>
            </div>
            {reconciliationData?.cacheInfo && (
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="text-muted-foreground">
                  MoneyControl: <span className="text-orange-400 font-medium">{reconciliationData.cacheInfo.totalMoneyControlCompanies}</span>
                </span>
                <span className="text-muted-foreground">
                  FintekPro: <span className="text-blue-400 font-medium">{reconciliationData.cacheInfo.totalFintekProCompanies}</span>
                </span>
                <span className="text-muted-foreground">
                  Already Synced: <span className="text-green-400 font-medium">{reconciliationData.cacheInfo.matchedCount}</span>
                </span>
                <span className="text-muted-foreground">
                  New to Add: <span className="text-yellow-400 font-medium">{reconciliationData.cacheInfo.unmatchedCount}</span>
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingReconciliation ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-orange-400 mr-2" />
                <span className="text-muted-foreground">Fetching MoneyControl data...</span>
              </div>
            ) : !reconciliationData?.suggestions?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p>All MoneyControl companies are already synced!</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {reconciliationData.suggestions.map((suggestion) => (
                    <div 
                      key={suggestion.externalCompany.isin}
                      className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border border-border hover:border-orange-500/30"
                    >
                      <Checkbox
                        checked={selectedSuggestions.has(suggestion.externalCompany.isin)}
                        onCheckedChange={() => toggleSuggestionSelect(suggestion.externalCompany.isin)}
                        data-testid={`checkbox-suggestion-${suggestion.externalCompany.isin}`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{suggestion.externalCompany.name}</span>
                          {suggestion.matchConfidence !== 'none' && (
                            <Badge variant="outline" className={
                              suggestion.matchConfidence === 'partial' 
                                ? 'text-yellow-400 border-yellow-500/30' 
                                : 'text-muted-foreground border-border'
                            }>
                              {suggestion.matchConfidence === 'partial' ? 'Possible duplicate' : 'Low match'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
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
                        disabled={isBulkSyncing || syncingCompanies.has(suggestion.externalCompany.isin)}
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

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-400" />
                Available Companies
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Click on a company row to view price suggestions from MoneyControl, Internal Calculation, and Marketplace
              </CardDescription>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by company name, CIN, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border text-foreground"
              data-testid="input-search-companies"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCompanies ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-muted-foreground">Loading companies...</span>
            </div>
          ) : availableCompanies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="text-lg font-medium text-foreground">All companies are already published!</p>
              <p className="text-sm mt-2">No more unlisted companies available to seed</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {availableCompanies.map((company) => {
                  const prices = companyPrices[company.id] || { buyPrice: '', sellPrice: '', expanded: false, loading: false, priceSuggestion: null };
                  
                  return (
                    <div key={company.id} className="border border-border rounded-lg overflow-hidden">
                      {/* Company Header Row */}
                      <div 
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleExpanded(company.id)}
                        data-testid={`row-company-${company.id}`}
                      >
                        <div className="flex items-center justify-center w-8">
                          {prices.loading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                          ) : prices.expanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                            <span className="font-medium text-foreground">{company.name}</span>
                            <Badge className={getStageBadgeColor(company.listingStage)}>
                              {getStageLabel(company.listingStage)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {company.cin || 'No CIN'} • {company.sector || 'No sector'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {prices.buyPrice && prices.sellPrice && (
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Prices Set</div>
                              <div className="text-sm">
                                <span className="text-green-400">₹{prices.buyPrice}</span>
                                <span className="text-muted-foreground mx-1">/</span>
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
                            <div className="p-8 flex items-center justify-center bg-muted/30 border-t border-border">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
                              <span className="text-muted-foreground">Loading price suggestions...</span>
                            </div>
                          ) : prices.priceSuggestion ? (
                            <PriceSuggestionPanel company={company} prices={prices} />
                          ) : (
                            <div className="p-8 flex items-center justify-center bg-muted/30 border-t border-border">
                              <AlertCircle className="w-6 h-6 text-yellow-400 mr-2" />
                              <span className="text-muted-foreground">No price data available</span>
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
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Already Published ({alreadyPublishedCompanies.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              These companies are already available in the Store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Company Name</TableHead>
                    <TableHead className="text-muted-foreground">Sector</TableHead>
                    <TableHead className="text-muted-foreground">Stage</TableHead>
                    <TableHead className="text-right text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alreadyPublishedCompanies.map((company) => (
                    <TableRow 
                      key={company.id} 
                      className="border-border hover:bg-muted/50"
                    >
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {company.sector || 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {company.listingStage || 'Unlisted'}
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
