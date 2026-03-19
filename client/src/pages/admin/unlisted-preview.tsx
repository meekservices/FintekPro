import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Building2, 
  TrendingUp, 
  IndianRupee, 
  Calendar, 
  ArrowLeft,
  DollarSign,
  Activity,
  BarChart3,
  Zap,
  Database,
  AlertTriangle,
  RefreshCw,
  Package,
  Loader2,
  CheckCircle,
  Users,
  Lightbulb,
  TrendingDown,
  Shield,
  Target,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useState, useEffect, useRef } from "react";
import type { UnlistedCompany, CompanyFinancials, CompanyRatios } from "@shared/schema";

const getDataSourceLabel = (source: string | null | undefined) => {
  const sourceConfig: Record<string, { label: string; color: string; description: string }> = {
    fintekpro: { 
      label: 'FintekPro', 
      color: 'text-amber-500',
      description: 'Primary internal database'
    },
    mca: { 
      label: 'MCA', 
      color: 'text-green-500',
      description: 'Official government filings via Sandbox API'
    },
    moneycontrol: { 
      label: 'MoneyControl', 
      color: 'text-purple-500',
      description: 'Market price data'
    },
  };
  
  const config = sourceConfig[source?.toLowerCase() || ''] || sourceConfig.fintekpro;
  return config;
};

const DataSourceBadge = ({ source }: { source: string | null | undefined }) => {
  const config = getDataSourceLabel(source);
  
  return (
    <TooltipProvider>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 text-xs ${config.color} cursor-help`}>
            <Database className="h-3 w-3" />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.description}</p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
};

interface DataQualityInfo {
  fallbackUsed: boolean;
  fallbackReason?: string;
  warnings: string[];
  primarySourceFailed: boolean;
  sourcesUsed: string[];
  overallScore: number;
  missingData?: string[];
  lastUpdated?: string;
}

const DataQualityWarning = ({ quality }: { quality: DataQualityInfo | null | undefined }) => {
  if (!quality) return null;
  
  const hasWarnings = quality.fallbackUsed || quality.warnings.length > 0 || (quality.missingData && quality.missingData.length > 0);
  if (!hasWarnings) return null;

  const isWarning = quality.fallbackUsed || quality.primarySourceFailed;

  return (
    <Alert className={`mb-4 ${isWarning ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'}`} data-testid="alert-data-quality">
      <AlertTriangle className={`h-4 w-4 ${isWarning ? 'text-amber-500' : 'text-blue-500'}`} />
      <AlertTitle className="text-sm font-medium">
        {quality.primarySourceFailed ? 'Using Fallback Data Sources' : 'Data Quality Notice'}
      </AlertTitle>
      <AlertDescription className="text-xs mt-1">
        {quality.fallbackReason && (
          <p className="mb-1">{quality.fallbackReason}</p>
        )}
        {quality.warnings.length > 0 && (
          <ul className="list-disc list-inside space-y-0.5">
            {quality.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        )}
        {quality.missingData && quality.missingData.length > 0 && (
          <p className="mt-1 text-muted-foreground">
            Missing: {quality.missingData.join(', ')}
          </p>
        )}
        <p className="mt-2 text-muted-foreground">
          Sources: {quality.sourcesUsed.join(', ')} | Quality Score: {quality.overallScore}%
        </p>
      </AlertDescription>
    </Alert>
  );
};

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatPercent = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return `${num.toFixed(2)}%`;
};

interface ListedPeer {
  name: string;
  ticker: string;
  exchange: string;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  evEbitda?: number;
  roe?: number;
  roce?: number;
  debtEquity?: number;
  revenueGrowth?: number;
}

const emptyPeer: ListedPeer = {
  name: '',
  ticker: '',
  exchange: 'NSE',
  peRatio: undefined,
  pbRatio: undefined,
  evEbitda: undefined,
  roe: undefined,
  roce: undefined,
  debtEquity: undefined,
  revenueGrowth: undefined,
};

export default function UnlistedPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPeerDialogOpen, setIsPeerDialogOpen] = useState(false);
  const [editingPeerIndex, setEditingPeerIndex] = useState<number | null>(null);
  const [currentPeer, setCurrentPeer] = useState<ListedPeer>(emptyPeer);
  const [isSavingPeers, setIsSavingPeers] = useState(false);
  const [isAutoEnriching, setIsAutoEnriching] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState<{
    enrichedFields: { field: string; oldValue: string | null; newValue: string; source: string }[];
    enrichmentSource: string;
  } | null>(null);
  const hasAttemptedEnrichRef = useRef(false);
  const [manualCIN, setManualCIN] = useState('');
  const [isSavingCIN, setIsSavingCIN] = useState(false);
  const [isManualFinancialsOpen, setIsManualFinancialsOpen] = useState(false);
  const [isSavingFinancials, setIsSavingFinancials] = useState(false);
  const [manualFinancials, setManualFinancials] = useState({
    financialYear: 'FY2023-24',
    revenue: '',
    ebitda: '',
    netProfit: '',
    networth: '',
    totalAssets: '',
    totalDebt: '',
  });
  
  const searchParams = new URLSearchParams(window.location.search);
  const buyPrice = searchParams.get('buyPrice') || '';
  const sellPrice = searchParams.get('sellPrice') || '';

  const { data: company, isLoading: isLoadingCompany, isError: isCompanyError, refetch: refetchCompany } = useQuery<UnlistedCompany | null>({
    queryKey: ['/api/unlisted/admin/companies', id],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/admin/companies/${id}`, {
        credentials: 'include',
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Failed to fetch company');
      const result = await response.json();
      return result.data;
    },
    retry: (failureCount, error) => {
      if (error?.message?.includes('404') || error?.message?.includes('not found')) return false;
      return failureCount < 2;
    },
  });

  const { data: financials, isLoading: isLoadingFinancials, refetch: refetchFinancials } = useQuery<CompanyFinancials[]>({
    queryKey: ['/api/unlisted/admin/companies', id, 'financials'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/admin/companies/${id}/financials`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!id && !!company,
  });

  const { data: ratios, isLoading: isLoadingRatios, refetch: refetchRatios } = useQuery<CompanyRatios[]>({
    queryKey: ['/api/unlisted/admin/companies', id, 'ratios'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/admin/companies/${id}/ratios`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!id && !!company,
  });

  const { data: dataQuality, refetch: refetchDataQuality } = useQuery<DataQualityInfo>({
    queryKey: ['/api/unlisted/admin/companies', id, 'data-quality'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/admin/companies/${id}/data-quality`, {
        credentials: 'include',
      });
      if (!response.ok) {
        return {
          fallbackUsed: false,
          warnings: [],
          primarySourceFailed: false,
          sourcesUsed: ['fintekpro'],
          overallScore: 100,
        };
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !!id && !!company,
  });

  // Auto-enrich missing metadata (sector, industry, name) from MCA/Credhive
  useEffect(() => {
    const autoEnrichCompany = async () => {
      if (!company || !id || hasAttemptedEnrichRef.current) return;
      
      const needsSectorEnrich = !company.sector || (company.sector as string).toLowerCase().includes('unknown');
      const needsIndustryEnrich = !company.industry || (company.industry as string).toLowerCase().includes('unknown');
      
      if (!needsSectorEnrich && !needsIndustryEnrich) return;
      
      hasAttemptedEnrichRef.current = true;
      setIsAutoEnriching(true);
      
      try {
        const response = await apiRequest(`/api/unlisted/admin/auto-enrich/${id}`, { method: 'POST' });
        
        if (response?.data?.enrichedFields?.length > 0) {
          setEnrichmentResult({
            enrichedFields: response.data.enrichedFields,
            enrichmentSource: response.data.enrichmentSource,
          });
          
          // Refetch company data to get updated values
          await refetchCompany();
          
          toast({
            title: 'Company Data Enriched',
            description: `Updated ${response.data.enrichedFields.length} field(s) from ${response.data.enrichmentSource}`,
          });
        } else if (response?.data?.enrichmentSource === 'none') {
          // No data found from external sources
          toast({
            title: 'No Enrichment Data Available',
            description: 'Could not find sector/industry from MCA or Credhive. Consider updating manually.',
            variant: 'destructive',
          });
        }
      } catch (error: any) {
        console.error('[Auto-Enrich] Error:', error);
        toast({
          title: 'Auto-Enrichment Failed',
          description: error.message || 'Could not fetch company data from external sources',
          variant: 'destructive',
        });
      } finally {
        setIsAutoEnriching(false);
      }
    };
    
    autoEnrichCompany();
  }, [company, id, toast, refetchCompany]);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const result = await apiRequest(`/api/unlisted/admin/refresh-company-data/${id}`, { method: 'POST' });
      
      await Promise.all([
        refetchCompany(),
        refetchFinancials(),
        refetchRatios(),
        refetchDataQuality(),
      ]);
      
      const successfulSources = result?.data?.results
        ?.filter((r: any) => r.status === 'success')
        ?.map((r: any) => r.source)
        ?.join(', ') || 'none';
      
      toast({
        title: 'Data refreshed',
        description: successfulSources !== 'none' 
          ? `Updated from: ${successfulSources}` 
          : 'No new data found from external sources',
      });
    } catch (error: any) {
      toast({
        title: 'Refresh failed',
        description: error.message || 'Failed to refresh company data',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveManualFinancials = async () => {
    if (!manualFinancials.financialYear) {
      toast({ title: 'Financial year required', variant: 'destructive' });
      return;
    }
    
    setIsSavingFinancials(true);
    try {
      await apiRequest(`/api/unlisted/admin/companies/${id}/financials`, {
        method: 'POST',
        body: JSON.stringify({
          financialYear: manualFinancials.financialYear,
          revenue: manualFinancials.revenue ? parseFloat(manualFinancials.revenue) * 10000000 : null, // Convert Cr to actual value
          ebitda: manualFinancials.ebitda ? parseFloat(manualFinancials.ebitda) * 10000000 : null,
          netProfit: manualFinancials.netProfit ? parseFloat(manualFinancials.netProfit) * 10000000 : null,
          networth: manualFinancials.networth ? parseFloat(manualFinancials.networth) * 10000000 : null,
          totalAssets: manualFinancials.totalAssets ? parseFloat(manualFinancials.totalAssets) * 10000000 : null,
          totalDebt: manualFinancials.totalDebt ? parseFloat(manualFinancials.totalDebt) * 10000000 : null,
        }),
      });
      
      await refetchFinancials();
      await refetchDataQuality();
      
      toast({
        title: 'Financial data saved',
        description: `Added ${manualFinancials.financialYear} financials for ${company?.name}`,
      });
      
      setIsManualFinancialsOpen(false);
      setManualFinancials({
        financialYear: 'FY2023-24',
        revenue: '',
        ebitda: '',
        netProfit: '',
        networth: '',
        totalAssets: '',
        totalDebt: '',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save',
        description: error.message || 'Could not save financial data',
        variant: 'destructive',
      });
    } finally {
      setIsSavingFinancials(false);
    }
  };

  const handlePublish = async () => {
    if (!buyPrice || !sellPrice) {
      toast({
        title: 'Prices required',
        description: 'Buy and sell prices are required to publish',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);
    try {
      await apiRequest(`/api/unlisted/companies/${id}/publish-to-store-with-prices`, {
        method: 'POST',
        body: JSON.stringify({ buyPrice, sellPrice, priceSource: 'admin' }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/admin/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/store/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/store/products'] });
      
      toast({
        title: 'Published to Store',
        description: `${company?.name} is now live in the marketplace`,
      });
      
      navigate('/admin/store/seed-unlisted');
    } catch (error: any) {
      toast({
        title: 'Publish failed',
        description: error.message || 'Failed to publish to store',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleBack = () => {
    navigate('/admin/store/seed-unlisted');
  };

  const getCurrentPeers = (): ListedPeer[] => {
    if (!company?.listedPeers || !Array.isArray(company.listedPeers)) return [];
    return company.listedPeers as ListedPeer[];
  };

  const handleAddPeer = () => {
    setEditingPeerIndex(null);
    setCurrentPeer({ ...emptyPeer });
    setIsPeerDialogOpen(true);
  };

  const handleEditPeer = (index: number) => {
    const peers = getCurrentPeers();
    if (peers[index]) {
      setEditingPeerIndex(index);
      setCurrentPeer({ ...peers[index] });
      setIsPeerDialogOpen(true);
    }
  };

  const handleDeletePeer = async (index: number) => {
    const peers = getCurrentPeers();
    const updatedPeers = peers.filter((_, i) => i !== index);
    await savePeers(updatedPeers);
  };

  const handleSavePeer = async () => {
    if (!currentPeer.name || !currentPeer.ticker) {
      toast({
        title: 'Required fields missing',
        description: 'Company name and ticker are required',
        variant: 'destructive',
      });
      return;
    }

    const peers = getCurrentPeers();
    let updatedPeers: ListedPeer[];

    if (editingPeerIndex !== null) {
      updatedPeers = [...peers];
      updatedPeers[editingPeerIndex] = currentPeer;
    } else {
      updatedPeers = [...peers, currentPeer];
    }

    await savePeers(updatedPeers);
    setIsPeerDialogOpen(false);
    setCurrentPeer({ ...emptyPeer });
    setEditingPeerIndex(null);
  };

  const savePeers = async (peers: ListedPeer[]) => {
    setIsSavingPeers(true);
    try {
      await apiRequest(`/api/unlisted/admin/companies/${id}/peers`, {
        method: 'PUT',
        body: JSON.stringify({ listedPeers: peers }),
      });
      
      await refetchCompany();
      
      toast({
        title: 'Peers updated',
        description: 'Listed peer companies have been saved',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to save peers',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPeers(false);
    }
  };

  const [isAutoFetchingPeers, setIsAutoFetchingPeers] = useState(false);

  const handleAutoFetchPeers = async () => {
    setIsAutoFetchingPeers(true);
    try {
      const result = await apiRequest(`/api/unlisted/admin/companies/${id}/auto-fetch-peers`, {
        method: 'POST',
        body: JSON.stringify({ maxPeers: 5 }),
      });
      
      await refetchCompany();
      
      const data = result as { peersAdded: number; totalPeers: number; referenceSymbol: string };
      
      if (data.peersAdded > 0) {
        toast({
          title: 'Peers auto-fetched',
          description: `Added ${data.peersAdded} peer companies based on sector analysis`,
        });
      } else {
        toast({
          title: 'No new peers found',
          description: 'Could not find additional peer companies for this sector',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Auto-fetch failed',
        description: error.message || 'Could not auto-fetch peer companies',
        variant: 'destructive',
      });
    } finally {
      setIsAutoFetchingPeers(false);
    }
  };

  const handleSaveCIN = async () => {
    if (!manualCIN.trim()) {
      toast({
        title: 'CIN Required',
        description: 'Please enter a valid CIN (Corporate Identification Number)',
        variant: 'destructive',
      });
      return;
    }

    // Validate CIN format (21 characters, alphanumeric)
    const cinPattern = /^[A-Z][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
    if (!cinPattern.test(manualCIN.trim().toUpperCase())) {
      toast({
        title: 'Invalid CIN Format',
        description: 'CIN must be 21 characters (e.g., U12345AB1234ABC123456)',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingCIN(true);
    try {
      await apiRequest(`/api/unlisted/admin/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ cin: manualCIN.trim().toUpperCase() }),
      });
      
      toast({
        title: 'CIN Saved',
        description: 'Now fetching company data from MCA...',
      });
      
      // Refetch company data
      await refetchCompany();
      
      // Reset enrichment state to allow re-enrichment with new CIN
      hasAttemptedEnrichRef.current = false;
      setEnrichmentResult(null);
      
      // Trigger auto-enrich with the new CIN
      setIsAutoEnriching(true);
      try {
        const response = await apiRequest(`/api/unlisted/admin/auto-enrich/${id}`, { method: 'POST' });
        
        if (response?.data?.enrichedFields?.length > 0) {
          setEnrichmentResult({
            enrichedFields: response.data.enrichedFields,
            enrichmentSource: response.data.enrichmentSource,
          });
          await refetchCompany();
          toast({
            title: 'Company Data Enriched',
            description: `Updated ${response.data.enrichedFields.length} field(s) from ${response.data.enrichmentSource}`,
          });
        } else {
          toast({
            title: 'CIN Saved',
            description: 'No additional data found from MCA for this CIN',
          });
        }
      } catch (enrichError: any) {
        console.error('[Manual CIN] Enrich error:', enrichError);
      } finally {
        setIsAutoEnriching(false);
      }
      
      setManualCIN('');
    } catch (error: any) {
      toast({
        title: 'Failed to save CIN',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCIN(false);
    }
  };

  if (isLoadingCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-muted-foreground">Loading company preview...</span>
      </div>
    );
  }

  if (!company && !isLoadingCompany) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Company Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The company ID "{id}" does not exist. It may have been removed or the URL is outdated.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleBack} variant="outline" data-testid="button-back-not-found">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pricing
          </Button>
          <Link href="/admin/unlisted/companies">
            <Button variant="default" data-testid="button-browse-companies">
              Browse Companies
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const latestFinancials = financials && financials.length > 0 ? financials[0] : null;
  const latestRatios = ratios && ratios.length > 0 ? ratios[0] : null;

  const financialChartData = financials?.slice(0, 5).reverse().map(f => ({
    year: f.financialYear,
    revenue: parseFloat(f.revenue?.toString() || '0') / 10000000,
    profit: parseFloat(f.netProfit?.toString() || '0') / 10000000,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-background border-b border-border -mx-6 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Pricing
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                Preview: {company.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Review how this company will appear to clients before publishing
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right mr-4">
              <div className="text-sm text-muted-foreground">Set Prices</div>
              <div className="flex items-center gap-3">
                <span className="text-green-400 font-medium">Buy: ₹{buyPrice}</span>
                <span className="text-red-400 font-medium">Sell: ₹{sellPrice}</span>
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
              data-testid="button-refresh-data"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Data
            </Button>
            
            <Button
              onClick={handlePublish}
              disabled={isPublishing || !buyPrice || !sellPrice}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="button-publish"
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Package className="w-4 h-4 mr-2" />
              )}
              Publish to Store
            </Button>
          </div>
        </div>
      </div>

      <DataQualityWarning quality={dataQuality} />

      {/* Auto-Enrichment Status */}
      {isAutoEnriching && (
        <Alert className="mb-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20" data-testid="alert-auto-enriching">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          <AlertTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Auto-Enriching Company Data
          </AlertTitle>
          <AlertDescription className="text-xs text-blue-600 dark:text-blue-400">
            Fetching missing sector and industry information from MCA/Credhive...
          </AlertDescription>
        </Alert>
      )}

      {/* Enrichment Result Notification */}
      {enrichmentResult && enrichmentResult.enrichedFields.length > 0 && (
        <Alert className="mb-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" data-testid="alert-enriched">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Company Data Enriched from {enrichmentResult.enrichmentSource}
          </AlertTitle>
          <AlertDescription className="text-xs text-emerald-600 dark:text-emerald-400">
            <div className="mt-2 space-y-1">
              {enrichmentResult.enrichedFields.map((field: { field: string; oldValue: string | null; newValue: string; source: string }, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium capitalize">{String(field.field)}:</span>
                  <span className="text-muted-foreground line-through">{String(field.oldValue || 'Empty')}</span>
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">{String(field.newValue)}</span>
                  <Badge variant="outline" className="text-xs">{String(field.source)}</Badge>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{company.name}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {company.sector || 'Unknown Sector'} • {company.industry || 'Unknown Industry'}
                    </CardDescription>
                  </div>
                </div>
                <Badge 
                  className={`${
                    company.listingStage === 'pre_ipo' 
                      ? 'bg-blue-600/20 text-blue-400' 
                      : company.listingStage === 'growth'
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'bg-muted/20 text-muted-foreground'
                  }`}
                >
                  {company.listingStage === 'pre_ipo' ? 'Pre-IPO' : 
                   company.listingStage === 'growth' ? 'Growth' : 'Unlisted'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {company.cin ? (
                  <div>
                    <span className="text-muted-foreground">CIN</span>
                    <p className="text-foreground font-mono text-xs">{company.cin}</p>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs mb-1 block">CIN (Required for MCA data)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={manualCIN}
                        onChange={(e) => setManualCIN(e.target.value.toUpperCase())}
                        placeholder="U12345AB1234ABC123456"
                        className="bg-muted border-border text-foreground font-mono text-xs h-8"
                        maxLength={21}
                        data-testid="input-manual-cin"
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveCIN}
                        disabled={isSavingCIN || isAutoEnriching || !manualCIN.trim()}
                        className="bg-blue-600 hover:bg-blue-700 h-8 px-3"
                        data-testid="button-save-cin"
                      >
                        {isSavingCIN || isAutoEnriching ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Find CIN at <a href="https://www.mca.gov.in/content/mca/global/en/mca/fo-llp-services/findCinFinalSingleCom.html" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">mca.gov.in</a>
                    </p>
                  </div>
                )}
                {company.isin && (
                  <div>
                    <span className="text-muted-foreground">ISIN</span>
                    <p className="text-foreground font-mono">{company.isin}</p>
                  </div>
                )}
                {company.faceValue && (
                  <div>
                    <span className="text-muted-foreground">Face Value</span>
                    <p className="text-foreground">₹{company.faceValue}</p>
                  </div>
                )}
                {company.totalShares && (
                  <div>
                    <span className="text-muted-foreground">Total Shares</span>
                    <p className="text-foreground">{Number(company.totalShares).toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Financial Performance
                {latestFinancials?.dataSource && (
                  <DataSourceBadge source={latestFinancials.dataSource} />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFinancials ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : financialChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="year" stroke="#9CA3AF" fontSize={12} />
                      <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${v}Cr`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value: number) => [`₹${value.toFixed(2)} Cr`, '']}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" />
                      <Bar dataKey="profit" name="Net Profit" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="mb-3">No financial data available</p>
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshData}
                        disabled={isRefreshing}
                        className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                        data-testid="button-fetch-financial-data"
                      >
                        {isRefreshing ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Fetch Data
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsManualFinancialsOpen(true)}
                        className="text-green-400 border-green-500/50 hover:bg-green-500/10"
                        data-testid="button-add-manual-financials"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Manually
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {latestFinancials && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-amber-400" />
                  Financial Highlights ({latestFinancials.financialYear})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(latestFinancials.revenue)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">EBITDA</div>
                    <div className="text-lg font-bold text-blue-400">
                      {formatCurrency(latestFinancials.ebitda)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Net Profit (PAT)</div>
                    <div className={`text-lg font-bold ${
                      (parseFloat(latestFinancials.netProfit?.toString() || latestFinancials.pat?.toString() || '0') >= 0) 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {formatCurrency(latestFinancials.netProfit || latestFinancials.pat)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Net Worth</div>
                    <div className={`text-lg font-bold ${
                      (parseFloat(latestFinancials.networth?.toString() || '0') >= 0) 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {formatCurrency(latestFinancials.networth)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Assets</div>
                    <div className="text-lg font-bold text-foreground">
                      {formatCurrency(latestFinancials.totalAssets)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Total Debt</div>
                    <div className={`text-lg font-bold ${
                      (parseFloat(latestFinancials.totalDebt?.toString() || '0') > parseFloat(latestFinancials.networth?.toString() || '1')) 
                        ? 'text-red-400' 
                        : 'text-amber-400'
                    }`}>
                      {formatCurrency(latestFinancials.totalDebt)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">EBITDA Margin</div>
                    <div className={`text-lg font-bold ${
                      latestRatios && parseFloat(latestRatios.marginEbitda?.toString() || '0') >= 0.15 
                        ? 'text-green-400' 
                        : 'text-foreground'
                    }`}>
                      {latestRatios?.marginEbitda ? `${(parseFloat(latestRatios.marginEbitda.toString()) * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">PAT Margin</div>
                    <div className={`text-lg font-bold ${
                      latestRatios && parseFloat(latestRatios.marginPat?.toString() || '0') >= 0.08 
                        ? 'text-green-400' 
                        : 'text-foreground'
                    }`}>
                      {latestRatios?.marginPat ? `${(parseFloat(latestRatios.marginPat.toString()) * 100).toFixed(1)}%` : '—'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Growth Metrics Card - YoY Changes Only */}
          {latestRatios && (latestRatios.revenueGrowth || latestRatios.profitGrowth) && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Year-on-Year Growth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-card/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Revenue Growth</div>
                    <div className={`text-lg font-bold ${
                      parseFloat(latestRatios.revenueGrowth?.toString() || '0') >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {latestRatios.revenueGrowth 
                        ? `${parseFloat(latestRatios.revenueGrowth.toString()) >= 0 ? '+' : ''}${(parseFloat(latestRatios.revenueGrowth.toString()) * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-3 bg-card/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Profit Growth</div>
                    <div className={`text-lg font-bold ${
                      parseFloat(latestRatios.profitGrowth?.toString() || '0') >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {latestRatios.profitGrowth 
                        ? `${parseFloat(latestRatios.profitGrowth.toString()) >= 0 ? '+' : ''}${(parseFloat(latestRatios.profitGrowth.toString()) * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Store Pricing
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Prices that will be visible to clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-card/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground">Buy Price</span>
                  <span className="text-2xl font-bold text-green-400">₹{buyPrice}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Sell Price</span>
                  <span className="text-2xl font-bold text-red-400">₹{sellPrice}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Spread: ₹{(parseFloat(sellPrice) - parseFloat(buyPrice)).toFixed(2)} ({((parseFloat(sellPrice) - parseFloat(buyPrice)) / parseFloat(buyPrice) * 100).toFixed(2)}%)
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Key Ratios
                {latestRatios?.dataSource && (
                  <DataSourceBadge source={latestRatios.dataSource} />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestRatios ? (
                <>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-muted-foreground text-sm">ROE</span>
                    <span className={`font-medium ${
                      (parseFloat(latestRatios.roe?.toString() || '0') >= 0.15) 
                        ? 'text-green-400' 
                        : 'text-foreground'
                    }`}>
                      {latestRatios.roe ? `${(parseFloat(latestRatios.roe.toString()) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-muted-foreground text-sm">ROCE</span>
                    <span className={`font-medium ${
                      (parseFloat(latestRatios.roce?.toString() || '0') >= 0.15) 
                        ? 'text-green-400' 
                        : 'text-foreground'
                    }`}>
                      {latestRatios.roce ? `${(parseFloat(latestRatios.roce.toString()) * 100).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-muted-foreground text-sm">Debt/Equity</span>
                    <span className={`font-medium ${
                      (parseFloat(latestRatios.debtEquity?.toString() || '0') > 1) 
                        ? 'text-red-400' 
                        : 'text-green-400'
                    }`}>
                      {latestRatios.debtEquity?.toString() || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded">
                    <span className="text-muted-foreground text-sm">Current Ratio</span>
                    <span className={`font-medium ${
                      (parseFloat(latestRatios.currentRatio?.toString() || '0') >= 1.5) 
                        ? 'text-green-400' 
                        : (parseFloat(latestRatios.currentRatio?.toString() || '0') < 1) 
                          ? 'text-red-400' 
                          : 'text-amber-400'
                    }`}>
                      {latestRatios.currentRatio?.toString() || '—'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Activity className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">No ratio data available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                    data-testid="button-fetch-ratio-data"
                  >
                    {isRefreshing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Fetch Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Valuation Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestRatios?.peRatio && (
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-muted-foreground text-sm">P/E Ratio</span>
                  <span className="text-foreground font-medium">{latestRatios.peRatio}</span>
                </div>
              )}
              {latestRatios?.pbRatio && (
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-muted-foreground text-sm">P/B Ratio</span>
                  <span className="text-foreground font-medium">{latestRatios.pbRatio}</span>
                </div>
              )}
              {latestRatios?.evEbitda && (
                <div className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-muted-foreground text-sm">EV/EBITDA</span>
                  <span className="text-foreground font-medium">{latestRatios.evEbitda}</span>
                </div>
              )}
              {!latestRatios?.peRatio && !latestRatios?.pbRatio && !latestRatios?.evEbitda && (
                <div className="text-center text-muted-foreground py-4">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-3">Valuation data not available</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshData}
                    disabled={isRefreshing}
                    className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                    data-testid="button-fetch-valuation-data"
                  >
                    {isRefreshing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Fetch Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Directors Section */}
      {company?.directors && Array.isArray(company.directors) && (company.directors as Array<{name?: string; din?: string; designation?: string}>).length > 0 && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              Board of Directors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(company.directors as Array<{name?: string; din?: string; designation?: string}>).map((director, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <div className="text-foreground font-medium">{director.name || 'Unknown'}</div>
                  <div className="text-sm text-muted-foreground">{director.designation || 'Director'}</div>
                  {director.din && (
                    <div className="text-xs text-muted-foreground mt-1">DIN: {director.din}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listed Peers Comparison Section */}
      {company?.listedPeers && Array.isArray(company.listedPeers) && (company.listedPeers as Array<{
        name?: string;
        ticker?: string;
        exchange?: string;
        marketCap?: number;
        peRatio?: number;
        pbRatio?: number;
        evEbitda?: number;
        roe?: number;
        roce?: number;
        debtEquity?: number;
        revenueGrowth?: number;
      }>).length > 0 && latestRatios && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              Comparison with Listed Peers
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Side-by-side comparison with similar publicly traded companies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground font-medium">Metric</TableHead>
                    <TableHead className="text-amber-400 font-medium">
                      {company.name}
                      <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-xs">Unlisted</Badge>
                    </TableHead>
                    {(company.listedPeers as Array<{name?: string; ticker?: string; exchange?: string}>).map((peer, index) => (
                      <TableHead key={index} className="text-muted-foreground font-medium">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            {peer.name}
                            <Badge className="ml-2 bg-blue-500/20 text-blue-400 text-xs">{peer.exchange || 'NSE'}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPeer(index)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-400"
                              data-testid={`button-edit-peer-${index}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePeer(index)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                              data-testid={`button-delete-peer-${index}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* P/E Ratio */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">P/E Ratio</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.peRatio ? parseFloat(latestRatios.peRatio.toString()).toFixed(1) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{peRatio?: number}>).map((peer, index) => {
                      const companyPE = latestRatios.peRatio ? parseFloat(latestRatios.peRatio.toString()) : null;
                      const peerPE = peer.peRatio;
                      const diff = companyPE && peerPE ? ((companyPE - peerPE) / peerPE) * 100 : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerPE?.toFixed(1) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff < -10 ? 'text-green-400' : diff > 10 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(diff).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* P/B Ratio */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">P/B Ratio</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.pbRatio ? parseFloat(latestRatios.pbRatio.toString()).toFixed(2) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{pbRatio?: number}>).map((peer, index) => {
                      const companyPB = latestRatios.pbRatio ? parseFloat(latestRatios.pbRatio.toString()) : null;
                      const peerPB = peer.pbRatio;
                      const diff = companyPB && peerPB ? ((companyPB - peerPB) / peerPB) * 100 : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerPB?.toFixed(2) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff < -10 ? 'text-green-400' : diff > 10 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(diff).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* EV/EBITDA */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">EV/EBITDA</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.evEbitda ? parseFloat(latestRatios.evEbitda.toString()).toFixed(1) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{evEbitda?: number}>).map((peer, index) => {
                      const companyEV = latestRatios.evEbitda ? parseFloat(latestRatios.evEbitda.toString()) : null;
                      const peerEV = peer.evEbitda;
                      const diff = companyEV && peerEV ? ((companyEV - peerEV) / peerEV) * 100 : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerEV?.toFixed(1) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff < -10 ? 'text-green-400' : diff > 10 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {Math.abs(diff).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* ROE */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">ROE (%)</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.roe ? (parseFloat(latestRatios.roe.toString()) * 100).toFixed(1) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{roe?: number}>).map((peer, index) => {
                      const companyROE = latestRatios.roe ? parseFloat(latestRatios.roe.toString()) * 100 : null;
                      const peerROE = peer.roe;
                      const diff = companyROE !== null && peerROE ? companyROE - peerROE : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerROE?.toFixed(1) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff > 2 ? 'text-green-400' : diff < -2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* ROCE */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">ROCE (%)</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.roce ? (parseFloat(latestRatios.roce.toString()) * 100).toFixed(1) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{roce?: number}>).map((peer, index) => {
                      const companyROCE = latestRatios.roce ? parseFloat(latestRatios.roce.toString()) * 100 : null;
                      const peerROCE = peer.roce;
                      const diff = companyROCE !== null && peerROCE ? companyROCE - peerROCE : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerROCE?.toFixed(1) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff > 2 ? 'text-green-400' : diff < -2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* Debt/Equity */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">Debt/Equity</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.debtEquity || 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{debtEquity?: number}>).map((peer, index) => {
                      const companyDE = latestRatios.debtEquity ? parseFloat(latestRatios.debtEquity.toString()) : null;
                      const peerDE = peer.debtEquity;
                      const diff = companyDE !== null && peerDE !== undefined ? companyDE - peerDE : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerDE?.toFixed(2) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff < -0.2 ? 'text-green-400' : diff > 0.2 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  {/* Revenue Growth */}
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableCell className="text-muted-foreground">Revenue Growth (%)</TableCell>
                    <TableCell className="text-foreground font-medium">
                      {latestRatios.revenueGrowth ? (parseFloat(latestRatios.revenueGrowth.toString()) * 100).toFixed(1) : 'N/A'}
                    </TableCell>
                    {(company.listedPeers as Array<{revenueGrowth?: number}>).map((peer, index) => {
                      const companyGrowth = latestRatios.revenueGrowth ? parseFloat(latestRatios.revenueGrowth.toString()) * 100 : null;
                      const peerGrowth = peer.revenueGrowth;
                      const diff = companyGrowth !== null && peerGrowth !== undefined ? companyGrowth - peerGrowth : null;
                      return (
                        <TableCell key={index} className="text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{peerGrowth?.toFixed(1) || 'N/A'}</span>
                            {diff !== null && (
                              <span className={`text-xs flex items-center ${diff > 5 ? 'text-green-400' : diff < -5 ? 'text-red-400' : 'text-muted-foreground'}`}>
                                {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg flex items-start justify-between">
              <div className="flex items-start gap-2">
                <Scale className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <span className="text-green-400">Green</span> indicates the unlisted company is trading at a discount or outperforming peers. 
                  <span className="text-red-400 ml-1">Red</span> indicates premium valuation or underperformance. 
                  <span className="text-muted-foreground ml-1">pp = percentage points</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddPeer}
                className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10 flex-shrink-0"
                data-testid="button-add-peer"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Peer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Peers Section (when no peers exist) */}
      {latestRatios && (!company?.listedPeers || !Array.isArray(company.listedPeers) || (company.listedPeers as ListedPeer[]).length === 0) && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              Comparison with Listed Peers
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Add comparable listed companies to help investors assess valuation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Scale className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No listed peers added yet</p>
              <p className="text-sm text-muted-foreground mb-6">Add comparable publicly-traded companies to show relative valuation metrics</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  variant="default"
                  onClick={handleAutoFetchPeers}
                  disabled={isAutoFetchingPeers}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-auto-fetch-peers"
                >
                  {isAutoFetchingPeers ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fetching Peers...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Auto-Fetch Peers
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddPeer}
                  className="text-blue-400 border-blue-500/50 hover:bg-blue-500/10"
                  data-testid="button-add-first-peer"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manually
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Investment Thesis Section */}
      {latestFinancials && latestRatios && (
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Investment Thesis
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Key investment highlights and risk factors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                  <Target className="w-4 h-4" />
                  Investment Highlights
                </div>
                <ul className="space-y-2">
                  {latestRatios.roe && parseFloat(latestRatios.roe.toString()) >= 0.15 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Strong ROE of {(parseFloat(latestRatios.roe.toString()) * 100).toFixed(1)}% indicates efficient capital utilization</span>
                    </li>
                  )}
                  {latestRatios.roce && parseFloat(latestRatios.roce.toString()) >= 0.15 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Healthy ROCE of {(parseFloat(latestRatios.roce.toString()) * 100).toFixed(1)}% shows good return on capital employed</span>
                    </li>
                  )}
                  {latestRatios.debtEquity && parseFloat(latestRatios.debtEquity.toString()) < 0.5 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Conservative leverage with debt-to-equity of {latestRatios.debtEquity}</span>
                    </li>
                  )}
                  {latestRatios.revenueGrowth && parseFloat(latestRatios.revenueGrowth.toString()) > 0.2 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Strong revenue growth of {(parseFloat(latestRatios.revenueGrowth.toString()) * 100).toFixed(1)}% YoY</span>
                    </li>
                  )}
                  {latestFinancials.networth && parseFloat(latestFinancials.networth.toString()) > 0 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Positive net worth of {formatCurrency(latestFinancials.networth)}</span>
                    </li>
                  )}
                  {latestRatios.currentRatio && parseFloat(latestRatios.currentRatio.toString()) >= 1.5 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>Healthy liquidity with current ratio of {latestRatios.currentRatio}</span>
                    </li>
                  )}
                </ul>
              </div>
              
              {/* Risk Factors */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                  <Shield className="w-4 h-4" />
                  Risk Factors
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Unlisted shares have limited liquidity compared to publicly traded stocks</span>
                  </li>
                  {latestRatios.debtEquity && parseFloat(latestRatios.debtEquity.toString()) > 1 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>High leverage with debt-to-equity of {latestRatios.debtEquity}</span>
                    </li>
                  )}
                  {latestRatios.profitGrowth && parseFloat(latestRatios.profitGrowth.toString()) < 0 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>Profit decline of {(Math.abs(parseFloat(latestRatios.profitGrowth.toString())) * 100).toFixed(1)}% YoY</span>
                    </li>
                  )}
                  {latestFinancials.networth && parseFloat(latestFinancials.networth.toString()) < 0 && (
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <span>Negative net worth indicates accumulated losses</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span>Share price depends on company performance and market conditions</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-muted-foreground">
              Ready to publish <span className="font-medium text-foreground">{company.name}</span> at 
              <span className="text-green-400 ml-1">₹{buyPrice}</span> / 
              <span className="text-red-400 ml-1">₹{sellPrice}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              data-testid="button-back-footer"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Prices
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
              data-testid="button-publish-footer"
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Package className="w-4 h-4 mr-2" />
              )}
              Publish to Store
            </Button>
          </div>
        </div>
      </div>

      <div className="h-20" />

      {/* Manual Financials Dialog */}
      <Dialog open={isManualFinancialsOpen} onOpenChange={setIsManualFinancialsOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-amber-400" />
              Add Financial Data Manually
            </DialogTitle>
            <DialogDescription>
              Enter financial data when external APIs are unavailable. All values in Crores (₹).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="financialYear">Financial Year *</Label>
                <Select 
                  value={manualFinancials.financialYear} 
                  onValueChange={(v) => setManualFinancials(f => ({ ...f, financialYear: v }))}
                >
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder="Select FY" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FY2024-25">FY2024-25</SelectItem>
                    <SelectItem value="FY2023-24">FY2023-24</SelectItem>
                    <SelectItem value="FY2022-23">FY2022-23</SelectItem>
                    <SelectItem value="FY2021-22">FY2021-22</SelectItem>
                    <SelectItem value="FY2020-21">FY2020-21</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="revenue">Revenue (Cr)</Label>
                <Input 
                  id="revenue"
                  type="number"
                  placeholder="e.g., 500"
                  value={manualFinancials.revenue}
                  onChange={(e) => setManualFinancials(f => ({ ...f, revenue: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
              
              <div>
                <Label htmlFor="ebitda">EBITDA (Cr)</Label>
                <Input 
                  id="ebitda"
                  type="number"
                  placeholder="e.g., 100"
                  value={manualFinancials.ebitda}
                  onChange={(e) => setManualFinancials(f => ({ ...f, ebitda: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
              
              <div>
                <Label htmlFor="netProfit">Net Profit/PAT (Cr)</Label>
                <Input 
                  id="netProfit"
                  type="number"
                  placeholder="e.g., 50"
                  value={manualFinancials.netProfit}
                  onChange={(e) => setManualFinancials(f => ({ ...f, netProfit: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
              
              <div>
                <Label htmlFor="networth">Net Worth (Cr)</Label>
                <Input 
                  id="networth"
                  type="number"
                  placeholder="e.g., 200"
                  value={manualFinancials.networth}
                  onChange={(e) => setManualFinancials(f => ({ ...f, networth: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
              
              <div>
                <Label htmlFor="totalAssets">Total Assets (Cr)</Label>
                <Input 
                  id="totalAssets"
                  type="number"
                  placeholder="e.g., 800"
                  value={manualFinancials.totalAssets}
                  onChange={(e) => setManualFinancials(f => ({ ...f, totalAssets: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
              
              <div>
                <Label htmlFor="totalDebt">Total Debt (Cr)</Label>
                <Input 
                  id="totalDebt"
                  type="number"
                  placeholder="e.g., 150"
                  value={manualFinancials.totalDebt}
                  onChange={(e) => setManualFinancials(f => ({ ...f, totalDebt: e.target.value }))}
                  className="bg-muted border-border"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualFinancialsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveManualFinancials}
              disabled={isSavingFinancials || !manualFinancials.financialYear}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSavingFinancials ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Save Financials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Peer Management Dialog */}
      <Dialog open={isPeerDialogOpen} onOpenChange={setIsPeerDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-400" />
              {editingPeerIndex !== null ? 'Edit Listed Peer' : 'Add Listed Peer'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter the financial metrics of a comparable publicly-traded company
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peer-name" className="text-muted-foreground">Company Name *</Label>
                <Input
                  id="peer-name"
                  value={currentPeer.name}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, name: e.target.value })}
                  placeholder="e.g., HDFC Bank"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-ticker" className="text-muted-foreground">Ticker Symbol *</Label>
                <Input
                  id="peer-ticker"
                  value={currentPeer.ticker}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, ticker: e.target.value.toUpperCase() })}
                  placeholder="e.g., HDFCBANK"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-ticker"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peer-exchange" className="text-muted-foreground">Exchange</Label>
                <Select
                  value={currentPeer.exchange}
                  onValueChange={(value) => setCurrentPeer({ ...currentPeer, exchange: value })}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground" data-testid="select-peer-exchange">
                    <SelectValue placeholder="Select exchange" />
                  </SelectTrigger>
                  <SelectContent className="bg-muted border-border">
                    <SelectItem value="NSE">NSE</SelectItem>
                    <SelectItem value="BSE">BSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-pe" className="text-muted-foreground">P/E Ratio</Label>
                <Input
                  id="peer-pe"
                  type="number"
                  step="0.1"
                  value={currentPeer.peRatio || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, peRatio: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 25.5"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-pe"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peer-pb" className="text-muted-foreground">P/B Ratio</Label>
                <Input
                  id="peer-pb"
                  type="number"
                  step="0.01"
                  value={currentPeer.pbRatio || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, pbRatio: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 3.2"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-pb"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-ev" className="text-muted-foreground">EV/EBITDA</Label>
                <Input
                  id="peer-ev"
                  type="number"
                  step="0.1"
                  value={currentPeer.evEbitda || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, evEbitda: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 15.8"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-ev"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-de" className="text-muted-foreground">Debt/Equity</Label>
                <Input
                  id="peer-de"
                  type="number"
                  step="0.01"
                  value={currentPeer.debtEquity || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, debtEquity: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 0.5"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-de"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peer-roe" className="text-muted-foreground">ROE (%)</Label>
                <Input
                  id="peer-roe"
                  type="number"
                  step="0.1"
                  value={currentPeer.roe || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, roe: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 18.5"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-roe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-roce" className="text-muted-foreground">ROCE (%)</Label>
                <Input
                  id="peer-roce"
                  type="number"
                  step="0.1"
                  value={currentPeer.roce || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, roce: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 22.3"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-roce"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peer-growth" className="text-muted-foreground">Revenue Growth (%)</Label>
                <Input
                  id="peer-growth"
                  type="number"
                  step="0.1"
                  value={currentPeer.revenueGrowth || ''}
                  onChange={(e) => setCurrentPeer({ ...currentPeer, revenueGrowth: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g., 15.2"
                  className="bg-muted border-border text-foreground"
                  data-testid="input-peer-growth"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPeerDialogOpen(false)}
              className="border-border text-muted-foreground"
              data-testid="button-cancel-peer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePeer}
              disabled={isSavingPeers}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-save-peer"
            >
              {isSavingPeers ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingPeerIndex !== null ? 'Update Peer' : 'Add Peer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
