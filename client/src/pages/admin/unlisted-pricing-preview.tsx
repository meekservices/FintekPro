import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  ArrowLeft,
  Building2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield as LucideShield,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  FileText,
  AlertCircle,
  DollarSign,
  Activity,
  Eye,
  Send,
  BarChart3,
  Minus,
  Info
} from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  cin?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  status: string;
  pricingStatus?: string;
  tradingSuspended?: boolean;
  draftBuyPrice?: string;
  draftSellPrice?: string;
  lastPublishedBuyPrice?: string;
  lastPublishedSellPrice?: string;
  complianceStatus?: string;
  riskScore?: number;
  complianceLastChecked?: string;
  complianceFlags?: ComplianceFlag[];
  faceValue?: string;
  totalShares?: number;
  marketCap?: string;
  description?: string;
  riskDisclosures?: string[];
}

interface ComplianceFlag {
  id: string;
  type: 'blocking' | 'warning' | 'info';
  code: string;
  message: string;
  createdAt?: string;
}

interface PriceValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
  spreadPercent?: number;
  priceChangePercent?: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  userId?: string;
  userName?: string;
  timestamp: string;
  details?: {
    oldBuyPrice?: string;
    newBuyPrice?: string;
    oldSellPrice?: string;
    newSellPrice?: string;
    [key: string]: any;
  };
}

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const getPricingStatusBadge = (status: string | undefined) => {
  switch (status?.toLowerCase()) {
    case 'published':
      return <Badge className="bg-green-600 text-white" data-testid="badge-pricing-published"><CheckCircle className="w-3 h-3 mr-1" />Published</Badge>;
    case 'pending_review':
      return <Badge className="bg-yellow-600 text-white" data-testid="badge-pricing-pending"><Clock className="w-3 h-3 mr-1" />Pending Review</Badge>;
    case 'draft':
    default:
      return <Badge className="bg-muted text-foreground" data-testid="badge-pricing-draft"><FileText className="w-3 h-3 mr-1" />Draft</Badge>;
  }
};

const getComplianceStatusBadge = (status: string | undefined, riskScore: number | undefined) => {
  const score = riskScore ?? 0;
  if (status === 'blocked' || score > 70) {
    return <Badge className="bg-red-600 text-white" data-testid="badge-compliance-blocked"><XCircle className="w-3 h-3 mr-1" />Blocked ({score})</Badge>;
  } else if (status === 'warning' || score > 40) {
    return <Badge className="bg-yellow-600 text-white" data-testid="badge-compliance-warning"><AlertTriangle className="w-3 h-3 mr-1" />Warning ({score})</Badge>;
  }
  return <Badge className="bg-green-600 text-white" data-testid="badge-compliance-clear"><CheckCircle className="w-3 h-3 mr-1" />Clear ({score})</Badge>;
};

const getSpreadColor = (spreadPercent: number | undefined) => {
  if (spreadPercent === undefined) return 'text-muted-foreground';
  if (spreadPercent > 20) return 'text-red-500';
  if (spreadPercent >= 15) return 'text-yellow-500';
  return 'text-green-500';
};

export default function UnlistedPricingPreviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const buyPrice = searchParams.get('buyPrice') || '';
  const sellPrice = searchParams.get('sellPrice') || '';

  const { data: company, isLoading: isLoadingCompany, refetch: refetchCompany } = useQuery<CompanyData>({
    queryKey: ['/api/unlisted/companies', companyId],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch company');
      const result = await response.json();
      return result.data;
    },
    enabled: !!companyId,
  });

  const effectiveBuyPrice = buyPrice || company?.draftBuyPrice || '';
  const effectiveSellPrice = sellPrice || company?.draftSellPrice || '';

  const { data: priceValidation, isLoading: isValidatingPrices, refetch: refetchValidation } = useQuery<PriceValidation>({
    queryKey: ['/api/unlisted/companies', companyId, 'validate-prices', effectiveBuyPrice, effectiveSellPrice],
    queryFn: async () => {
      if (!effectiveBuyPrice || !effectiveSellPrice) {
        return { valid: false, warnings: [], errors: ['Buy and sell prices are required'] };
      }
      const response = await fetch(
        `/api/unlisted/companies/${companyId}/validate-prices?buyPrice=${effectiveBuyPrice}&sellPrice=${effectiveSellPrice}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        return { valid: false, warnings: [], errors: ['Failed to validate prices'] };
      }
      const result = await response.json();
      return result.data || { valid: true, warnings: [], errors: [] };
    },
    enabled: !!companyId && (!!effectiveBuyPrice || !!effectiveSellPrice),
  });

  const { data: auditLog, isLoading: isLoadingAudit } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/unlisted/companies', companyId, 'audit-log'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${companyId}/audit-log?limit=10`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!companyId,
  });

  const refreshPricesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/unlisted/admin/refresh-company-data/${companyId}`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      refetchCompany();
      refetchValidation();
      toast({
        title: 'Prices Refreshed',
        description: 'Latest price data has been fetched from external sources.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Refresh Failed',
        description: error.message || 'Failed to refresh price data.',
        variant: 'destructive',
      });
    },
  });

  const checkComplianceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/unlisted/companies/${companyId}/check-compliance`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      refetchCompany();
      toast({
        title: 'Compliance Checked',
        description: 'Compliance status has been updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Compliance Check Failed',
        description: error.message || 'Failed to check compliance.',
        variant: 'destructive',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/unlisted/companies/${companyId}/publish-prices`, {
        method: 'POST',
        body: JSON.stringify({
          buyPrice: effectiveBuyPrice,
          sellPrice: effectiveSellPrice,
        }),
      });
      return response;
    },
    onSuccess: () => {
      setShowPublishDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/unlisted/companies'] });
      toast({
        title: 'Published Successfully',
        description: `${company?.name} is now live on the marketplace.`,
      });
      navigate('/admin/store/seed-unlisted');
    },
    onError: (error: any) => {
      toast({
        title: 'Publish Failed',
        description: error.message || 'Failed to publish to marketplace.',
        variant: 'destructive',
      });
    },
  });

  const spreadPercent = priceValidation?.spreadPercent ?? 
    (effectiveBuyPrice && effectiveSellPrice 
      ? ((parseFloat(effectiveSellPrice) - parseFloat(effectiveBuyPrice)) / parseFloat(effectiveBuyPrice)) * 100 
      : undefined);

  const priceChangePercent = priceValidation?.priceChangePercent ?? 
    (company?.lastPublishedBuyPrice && effectiveBuyPrice 
      ? ((parseFloat(effectiveBuyPrice) - parseFloat(company.lastPublishedBuyPrice)) / parseFloat(company.lastPublishedBuyPrice)) * 100 
      : undefined);

  const isBlocked = company?.complianceStatus === 'blocked' || (company?.riskScore ?? 0) > 70;
  const canPublish = !isBlocked && priceValidation?.valid !== false && effectiveBuyPrice && effectiveSellPrice;

  if (isLoadingCompany) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-state">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-muted-foreground">Loading pricing preview...</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="p-8 text-center" data-testid="not-found-state">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Company Not Found</h2>
        <p className="text-muted-foreground mb-4">The company you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/admin/store/seed-unlisted')} variant="outline" data-testid="button-back-not-found">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Companies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pricing-preview-page">
      {/* Header Section */}
      <div className="sticky top-0 z-10 bg-background border-b border-border -mx-6 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/admin/store/seed-unlisted')}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Edit
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-400" />
                <h1 className="text-xl font-bold text-foreground" data-testid="text-company-name">{company.name}</h1>
              </div>
              {company.cin && (
                <p className="text-sm text-muted-foreground mt-1" data-testid="text-company-cin">CIN: {company.cin}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {getPricingStatusBadge(company.pricingStatus)}
            {getComplianceStatusBadge(company.complianceStatus, company.riskScore)}
            {company.tradingSuspended && (
              <Badge className="bg-red-800 text-white" data-testid="badge-trading-suspended">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Trading Suspended
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Trading Suspended Warning */}
      {company.tradingSuspended && (
        <Alert className="border-red-600 bg-red-950/20" data-testid="alert-trading-suspended">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-400">Trading Suspended</AlertTitle>
          <AlertDescription className="text-red-300">
            Trading for this company has been suspended. Publishing is not allowed until the suspension is lifted.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price Preview Card */}
        <Card className="bg-card border-border" data-testid="card-price-preview">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Price Preview
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Draft prices that will be published to the marketplace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Buy Price</p>
                <p className="text-2xl font-bold text-green-400" data-testid="text-buy-price">
                  {effectiveBuyPrice ? `₹${parseFloat(effectiveBuyPrice).toLocaleString('en-IN')}` : '—'}
                </p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Sell Price</p>
                <p className="text-2xl font-bold text-red-400" data-testid="text-sell-price">
                  {effectiveSellPrice ? `₹${parseFloat(effectiveSellPrice).toLocaleString('en-IN')}` : '—'}
                </p>
              </div>
            </div>

            {/* Spread Percentage */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Spread</span>
                <span className={`text-lg font-semibold ${getSpreadColor(spreadPercent)}`} data-testid="text-spread-percent">
                  {spreadPercent !== undefined ? `${spreadPercent.toFixed(2)}%` : '—'}
                </span>
              </div>
              {spreadPercent !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {spreadPercent > 20 ? '⚠️ High spread - may reduce client interest' : 
                   spreadPercent >= 15 ? '⚠️ Moderate spread' : 
                   '✓ Healthy spread range'}
                </p>
              )}
            </div>

            {/* Price Change from Last Published */}
            {company.lastPublishedBuyPrice && priceChangePercent !== undefined && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Change from Last Published</span>
                  <span className={`flex items-center gap-1 text-lg font-semibold ${priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="text-price-change">
                    {priceChangePercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Previous: ₹{parseFloat(company.lastPublishedBuyPrice).toLocaleString('en-IN')}
                </p>
              </div>
            )}

            {/* Price Validation Warnings/Errors */}
            {(priceValidation?.errors?.length ?? 0) > 0 && (
              <Alert className="border-red-600 bg-red-950/20" data-testid="alert-price-errors">
                <XCircle className="h-4 w-4 text-red-500" />
                <AlertTitle className="text-red-400">Validation Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-red-300 text-sm">
                    {priceValidation?.errors?.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {(priceValidation?.warnings?.length ?? 0) > 0 && (
              <Alert className="border-yellow-600 bg-yellow-950/20" data-testid="alert-price-warnings">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-400">Validation Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-yellow-300 text-sm">
                    {priceValidation?.warnings?.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              className="w-full border-blue-600 text-blue-400 hover:bg-blue-600/20"
              onClick={() => refreshPricesMutation.mutate()}
              disabled={refreshPricesMutation.isPending}
              data-testid="button-refresh-prices"
            >
              {refreshPricesMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Prices
            </Button>
          </CardContent>
        </Card>

        {/* Client View Simulation */}
        <Card className="bg-card border-border" data-testid="card-client-view">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              Client View Simulation
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Exactly what clients will see on the marketplace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Simulated Marketplace Card */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground" data-testid="client-view-name">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">{company.sector || 'Unlisted'} • {company.industry || 'N/A'}</p>
                  </div>
                  <Badge variant="outline" className="border-blue-500 text-blue-400">
                    Unlisted
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Buy Price</p>
                    <p className="text-xl font-bold text-green-400">
                      {effectiveBuyPrice ? `₹${parseFloat(effectiveBuyPrice).toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sell Price</p>
                    <p className="text-xl font-bold text-red-400">
                      {effectiveSellPrice ? `₹${parseFloat(effectiveSellPrice).toLocaleString('en-IN')}` : '—'}
                    </p>
                  </div>
                </div>

                <Separator className="bg-muted my-4" />

                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Face Value</p>
                    <p className="text-foreground font-medium">{company.faceValue ? `₹${company.faceValue}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Shares</p>
                    <p className="text-foreground font-medium">{company.totalShares?.toLocaleString() || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Spread</p>
                    <p className={`font-medium ${getSpreadColor(spreadPercent)}`}>
                      {spreadPercent !== undefined ? `${spreadPercent.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>

                {/* Risk Disclosures Preview */}
                {(company.riskDisclosures?.length ?? 0) > 0 && (
                  <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800/50 rounded">
                    <p className="text-xs text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Risk Disclosures
                    </p>
                    <ul className="text-xs text-yellow-300/80 mt-1 space-y-0.5">
                      {company.riskDisclosures?.slice(0, 2).map((disclosure, i) => (
                        <li key={i}>• {disclosure}</li>
                      ))}
                      {(company.riskDisclosures?.length ?? 0) > 2 && (
                        <li className="text-yellow-500">+{(company.riskDisclosures?.length ?? 0) - 2} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Summary */}
        <Card className="bg-card border-border" data-testid="card-compliance-summary">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <LucideShield className="w-5 h-5 text-blue-400" />
              Compliance Summary
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Regulatory and compliance checks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Risk Score Meter */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted-foreground">Risk Score</span>
                <span className="text-lg font-semibold text-foreground" data-testid="text-risk-score">{company.riskScore ?? 0}/100</span>
              </div>
              <Progress 
                value={company.riskScore ?? 0} 
                className="h-3"
                data-testid="progress-risk-score"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {(company.riskScore ?? 0) <= 40 ? '✓ Low risk' : (company.riskScore ?? 0) <= 70 ? '⚠️ Moderate risk' : '⚠️ High risk - Review required'}
              </p>
            </div>

            {/* Last Checked */}
            {company.complianceLastChecked && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Last checked: {format(new Date(company.complianceLastChecked), 'PPp')}</span>
              </div>
            )}

            {/* Compliance Flags */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Compliance Flags</p>
              {company.complianceFlags?.length ? (
                <div className="space-y-2">
                  {company.complianceFlags.map((flag) => (
                    <div 
                      key={flag.id}
                      className={`p-3 rounded-lg border ${
                        flag.type === 'blocking' ? 'bg-red-950/20 border-red-800' :
                        flag.type === 'warning' ? 'bg-yellow-950/20 border-yellow-800' :
                        'bg-blue-950/20 border-blue-800'
                      }`}
                      data-testid={`flag-${flag.code}`}
                    >
                      <div className="flex items-start gap-2">
                        {flag.type === 'blocking' ? <XCircle className="w-4 h-4 text-red-500 mt-0.5" /> :
                         flag.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" /> :
                         <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
                        <div>
                          <p className={`text-sm font-medium ${
                            flag.type === 'blocking' ? 'text-red-400' :
                            flag.type === 'warning' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`}>
                            {flag.code}
                          </p>
                          <p className="text-xs text-muted-foreground">{flag.message}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`ml-auto text-xs ${
                            flag.type === 'blocking' ? 'border-red-600 text-red-400' :
                            flag.type === 'warning' ? 'border-yellow-600 text-yellow-400' :
                            'border-blue-600 text-blue-400'
                          }`}
                        >
                          {flag.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 p-3 bg-green-950/20 border border-green-800 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">No compliance issues found</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full border-purple-600 text-purple-400 hover:bg-purple-600/20"
              onClick={() => checkComplianceMutation.mutate()}
              disabled={checkComplianceMutation.isPending}
              data-testid="button-recheck-compliance"
            >
              {checkComplianceMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LucideShield className="w-4 h-4 mr-2" />
              )}
              Re-check Compliance
            </Button>
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card className="bg-card border-border" data-testid="card-audit-trail">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-400" />
              Audit Trail
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Recent activity and changes for this company
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAudit ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : auditLog?.length ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {auditLog.map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                    data-testid={`audit-entry-${entry.id}`}
                  >
                    <div className="p-2 bg-muted rounded-full">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.action}</p>
                      {entry.details && (entry.details.oldBuyPrice || entry.details.newBuyPrice) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Price: {entry.details.oldBuyPrice || '—'} → {entry.details.newBuyPrice || '—'}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {entry.userName && (
                          <>
                            <User className="w-3 h-3" />
                            <span>{entry.userName}</span>
                            <span>•</span>
                          </>
                        )}
                        <Clock className="w-3 h-3" />
                        <span>{format(new Date(entry.timestamp), 'PPp')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Activity className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No audit entries yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <Card className="bg-card border-border" data-testid="card-actions">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/store/seed-unlisted')}
              data-testid="button-back-to-edit"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Edit
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/admin/unlisted/preview/${companyId}?buyPrice=${effectiveBuyPrice}&sellPrice=${effectiveSellPrice}`)}
                data-testid="button-view-full-preview"
              >
                <Eye className="w-4 h-4 mr-2" />
                Full Preview
              </Button>

              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowPublishDialog(true)}
                disabled={!canPublish || company.tradingSuspended}
                data-testid="button-publish"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish to Marketplace
              </Button>
            </div>
          </div>

          {!canPublish && !company.tradingSuspended && (
            <p className="text-xs text-amber-400 mt-3 text-right">
              {isBlocked ? '⚠️ Cannot publish: Compliance issues detected' : 
               !effectiveBuyPrice || !effectiveSellPrice ? '⚠️ Cannot publish: Prices required' :
               '⚠️ Cannot publish: Price validation failed'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Publish Confirmation Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="bg-card border-border" data-testid="dialog-publish-confirm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Publication</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You are about to publish {company.name} to the marketplace with the following prices:
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Buy Price</p>
                <p className="text-xl font-bold text-green-400">₹{parseFloat(effectiveBuyPrice || '0').toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Sell Price</p>
                <p className="text-xl font-bold text-red-400">₹{parseFloat(effectiveSellPrice || '0').toLocaleString('en-IN')}</p>
              </div>
            </div>

            <Alert className="border-amber-600 bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-amber-300 text-sm">
                This action will make the company visible to all clients on the marketplace. 
                Make sure all compliance checks have passed.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
              data-testid="button-cancel-publish"
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirm & Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
