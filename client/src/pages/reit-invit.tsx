import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Target, 
  Brain, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronRight,
  Filter,
  RefreshCw,
  Zap,
  Shield as LucideShield,
  BarChart3,
  MapPin,
  Calendar,
  Percent,
  IndianRupee,
  Clock,
  Building,
  Power,
  Car,
  Wifi,
  Info,
  Star,
  Lock,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ReitData = {
  id: string;
  symbol: string;
  name: string;
  sponsor: string;
  sector: string;
  geography: string;
  totalProperties: number;
  occupancyRate: string;
  currentPrice: string;
  nav: string;
  premiumToNav: string;
  distributionYield: string;
  returns1Y: string;
  riskLevel: string;
  creditRating: string;
  aiSignal: string;
  aiConfidence: string;
  aiRationale: string;
  aiTargetPrice: string;
};

type InvitData = {
  id: string;
  symbol: string;
  name: string;
  sponsor: string;
  sector: string;
  geography: string;
  totalAssets: number;
  concessionLife: string;
  currentPrice: string;
  nav: string;
  premiumToNav: string;
  distributionYield: string;
  returns1Y: string;
  riskLevel: string;
  creditRating: string;
  aiSignal: string;
  aiConfidence: string;
  aiRationale: string;
  aiTargetPrice: string;
};

type Recommendation = {
  type: 'reit' | 'invit';
  symbol: string;
  name: string;
  sector: string;
  currentPrice: string;
  distributionYield: string;
  aiSignal: string;
  aiConfidence: string;
  aiRationale: string;
  aiTargetPrice: string;
  riskLevel: string;
};

const REIT_SECTORS = [
  { value: 'all', label: 'All Sectors' },
  { value: 'office', label: 'Office' },
  { value: 'retail', label: 'Retail' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'mixed', label: 'Mixed Use' },
];

const INVIT_SECTORS = [
  { value: 'all', label: 'All Sectors' },
  { value: 'power', label: 'Power Transmission' },
  { value: 'roads', label: 'Roads & Highways' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'gas_pipelines', label: 'Gas Pipelines' },
  { value: 'renewable_energy', label: 'Renewable Energy' },
];

const RISK_LEVELS = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'low', label: 'Low Risk' },
  { value: 'moderate', label: 'Moderate Risk' },
  { value: 'high', label: 'High Risk' },
];

const AI_SIGNALS = [
  { value: 'all', label: 'All Signals' },
  { value: 'buy', label: 'Buy' },
  { value: 'hold', label: 'Hold' },
  { value: 'sell', label: 'Sell' },
];

function getSectorIcon(sector: string) {
  switch (sector) {
    case 'office': return <Building className="h-4 w-4" />;
    case 'retail': return <Building2 className="h-4 w-4" />;
    case 'power': return <Power className="h-4 w-4" />;
    case 'roads': return <Car className="h-4 w-4" />;
    case 'telecom': return <Wifi className="h-4 w-4" />;
    default: return <Building2 className="h-4 w-4" />;
  }
}

function getSignalColor(signal: string) {
  switch (signal) {
    case 'buy': return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'hold': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    case 'sell': return 'bg-red-500/10 text-red-600 border-red-500/20';
    default: return 'bg-muted/10 text-muted-foreground border-border';
  }
}

function getRiskColor(risk: string) {
  switch (risk) {
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-foreground/30';
  }
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatMarketCap(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 10000000000) {
    return `₹${(num / 10000000).toFixed(0)} Cr`;
  }
  return `₹${(num / 10000000).toFixed(2)} Cr`;
}

function formatPercent(value: string | number | null) {
  if (value === null) return 'N/A';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function buildQueryString(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all') {
      params.append(key, value);
    }
  });
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export default function ReitInvitPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedReit, setSelectedReit] = useState<ReitData | null>(null);
  const [selectedInvit, setSelectedInvit] = useState<InvitData | null>(null);
  const [reitFilters, setReitFilters] = useState({ sector: 'all', riskLevel: 'all', aiSignal: 'all' });
  const [invitFilters, setInvitFilters] = useState({ sector: 'all', riskLevel: 'all', aiSignal: 'all' });
  const [unlistedReitSearch, setUnlistedReitSearch] = useState('');
  const [unlistedInvitSearch, setUnlistedInvitSearch] = useState('');
  const [unlistedInvitIndustry, setUnlistedInvitIndustry] = useState('all');
  const { toast } = useToast();

  const { data: marketOverview, isLoading: overviewLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/market-overview'],
  });

  const { data: reitsData, isLoading: reitsLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/reits', reitFilters],
    queryFn: async () => {
      const queryStr = buildQueryString(reitFilters);
      const response = await fetch(`/api/reit-invit/reits${queryStr}`);
      if (!response.ok) throw new Error('Failed to fetch REITs');
      return response.json();
    },
  });

  const { data: invitsData, isLoading: invitsLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/invits', invitFilters],
    queryFn: async () => {
      const queryStr = buildQueryString(invitFilters);
      const response = await fetch(`/api/reit-invit/invits${queryStr}`);
      if (!response.ok) throw new Error('Failed to fetch InvITs');
      return response.json();
    },
  });

  const { data: aiRecommendations, isLoading: recommendationsLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/ai-recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/reit-invit/ai-recommendations?riskProfile=moderate');
      if (!response.ok) throw new Error('Failed to fetch AI recommendations');
      return response.json();
    },
  });

  const { data: unlistedReitsData, isLoading: unlistedReitsLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/unlisted-reits', unlistedReitSearch],
    queryFn: async () => {
      const qs = unlistedReitSearch ? `?search=${encodeURIComponent(unlistedReitSearch)}` : '';
      const res = await fetch(`/api/reit-invit/unlisted-reits${qs}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: unlistedInvitsData, isLoading: unlistedInvitsLoading } = useQuery<any>({
    queryKey: ['/api/reit-invit/unlisted-invits', unlistedInvitSearch, unlistedInvitIndustry],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (unlistedInvitSearch) params.set('search', unlistedInvitSearch);
      if (unlistedInvitIndustry !== 'all') params.set('industry', unlistedInvitIndustry);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/reit-invit/unlisted-invits${qs}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const reits = reitsData?.data || [];
  const invits = invitsData?.data || [];
  const unlistedReits: any[] = unlistedReitsData?.data || [];
  const unlistedInvits: any[] = unlistedInvitsData?.data || [];
  const recommendations = aiRecommendations?.recommendations || [];
  const overview = marketOverview;

  const handleInvest = (asset: ReitData | InvitData, type: 'reit' | 'invit') => {
    toast({
      title: 'Investment Order',
      description: `Opening investment form for ${asset.symbol}...`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="reit-invit-page">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
          <Building2 className="h-8 w-8 text-primary" />
          REIT & InvIT Investments
        </h1>
        <p className="text-muted-foreground">
          Invest in India's premier real estate and infrastructure trusts with AI-powered recommendations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="reits" data-testid="tab-reits">
            <Building className="h-4 w-4 mr-2" />
            REITs
          </TabsTrigger>
          <TabsTrigger value="invits" data-testid="tab-invits">
            <Power className="h-4 w-4 mr-2" />
            InvITs
          </TabsTrigger>
          <TabsTrigger value="unlisted-reits" data-testid="tab-unlisted-reits">
            <Lock className="h-4 w-4 mr-2" />
            Unlisted REITs
          </TabsTrigger>
          <TabsTrigger value="unlisted-invits" data-testid="tab-unlisted-invits">
            <Lock className="h-4 w-4 mr-2" />
            Unlisted InvITs
          </TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Brain className="h-4 w-4 mr-2" />
            AI Picks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card data-testid="reit-overview-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-blue-500" />
                      REITs Overview
                    </CardTitle>
                    <CardDescription>Real Estate Investment Trusts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Listed REITs</p>
                        <p className="text-2xl font-bold">{overview.reits?.count || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Yield</p>
                        <p className="text-2xl font-bold text-green-600">{overview.reits?.avgYield}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Occupancy</p>
                        <p className="text-2xl font-bold">{overview.reits?.avgOccupancy}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Market Cap</p>
                        <p className="text-2xl font-bold">{formatMarketCap(overview.reits?.totalMarketCap || 0)}</p>
                      </div>
                    </div>
                    {overview.reits?.topPerformer && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Top Performer (1Y)</p>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{overview.reits.topPerformer.symbol}</span>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">
                            {formatPercent(overview.reits.topPerformer.returns1Y)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="invit-overview-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Power className="h-5 w-5 text-orange-500" />
                      InvITs Overview
                    </CardTitle>
                    <CardDescription>Infrastructure Investment Trusts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Listed InvITs</p>
                        <p className="text-2xl font-bold">{overview.invits?.count || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Yield</p>
                        <p className="text-2xl font-bold text-green-600">{overview.invits?.avgYield}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Concession Life</p>
                        <p className="text-2xl font-bold">{overview.invits?.avgConcessionLife} yrs</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Market Cap</p>
                        <p className="text-2xl font-bold">{formatMarketCap(overview.invits?.totalMarketCap || 0)}</p>
                      </div>
                    </div>
                    {overview.invits?.topPerformer && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Top Performer (1Y)</p>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{overview.invits.topPerformer.symbol}</span>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600">
                            {formatPercent(overview.invits.topPerformer.returns1Y)}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" />
                    Understanding REITs & InvITs
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">REITs (Real Estate Investment Trusts)</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Own income-generating commercial real estate
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Required to distribute 90% of income as dividends
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Sectors: Office, Retail, Industrial, Hospitality
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Typical yields: 5-8% annually
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg">InvITs (Infrastructure Investment Trusts)</h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Own income-generating infrastructure assets
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Cash flows from toll roads, power transmission, telecom
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Long-term concession agreements (15-30 years)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        Typical yields: 8-12% annually
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="reits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter REITs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Sector</Label>
                  <Select 
                    value={reitFilters.sector} 
                    onValueChange={(v) => setReitFilters(f => ({ ...f, sector: v }))}
                  >
                    <SelectTrigger data-testid="reit-sector-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REIT_SECTORS.map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk Level</Label>
                  <Select 
                    value={reitFilters.riskLevel} 
                    onValueChange={(v) => setReitFilters(f => ({ ...f, riskLevel: v }))}
                  >
                    <SelectTrigger data-testid="reit-risk-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_LEVELS.map((r: any) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>AI Signal</Label>
                  <Select 
                    value={reitFilters.aiSignal} 
                    onValueChange={(v) => setReitFilters(f => ({ ...f, aiSignal: v }))}
                  >
                    <SelectTrigger data-testid="reit-signal-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_SIGNALS.map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {reitsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i: any) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reits.map((reit: ReitData) => (
                <Card key={reit.id} className="hover:shadow-lg transition-shadow" data-testid={`reit-card-${reit.symbol}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{reit.symbol}</CardTitle>
                        <CardDescription className="line-clamp-1">{reit.name}</CardDescription>
                      </div>
                      <Badge className={getSignalColor(reit.aiSignal)}>
                        {reit.aiSignal.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getSectorIcon(reit.sector)}
                      <span className="capitalize">{reit.sector}</span>
                      <span className="mx-2">•</span>
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{reit.geography}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Price</p>
                        <p className="text-lg font-semibold">{formatCurrency(reit.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Distribution Yield</p>
                        <p className="text-lg font-semibold text-green-600">{reit.distributionYield}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">NAV Discount</p>
                        <p className={`text-sm font-medium ${parseFloat(reit.premiumToNav) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(reit.premiumToNav)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">1Y Returns</p>
                        <p className={`text-sm font-medium ${parseFloat(reit.returns1Y || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(reit.returns1Y)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getRiskColor(reit.riskLevel)}>
                        <LucideShield className="h-3 w-3 mr-1" />
                        {reit.riskLevel}
                      </Badge>
                      <Badge variant="outline">
                        <Star className="h-3 w-3 mr-1" />
                        {reit.creditRating}
                      </Badge>
                      <Badge variant="outline">
                        <Building className="h-3 w-3 mr-1" />
                        {reit.totalProperties} Properties
                      </Badge>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Analysis</span>
                        <span className="text-xs text-muted-foreground">({reit.aiConfidence}% confidence)</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{reit.aiRationale}</p>
                      {reit.aiTargetPrice && (
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Target:</span>{' '}
                          <span className="font-medium text-primary">{formatCurrency(reit.aiTargetPrice)}</span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => handleInvest(reit, 'reit')}
                      data-testid={`invest-reit-${reit.symbol}`}
                    >
                      Invest Now
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter InvITs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Sector</Label>
                  <Select 
                    value={invitFilters.sector} 
                    onValueChange={(v) => setInvitFilters(f => ({ ...f, sector: v }))}
                  >
                    <SelectTrigger data-testid="invit-sector-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVIT_SECTORS.map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Risk Level</Label>
                  <Select 
                    value={invitFilters.riskLevel} 
                    onValueChange={(v) => setInvitFilters(f => ({ ...f, riskLevel: v }))}
                  >
                    <SelectTrigger data-testid="invit-risk-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_LEVELS.map((r: any) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>AI Signal</Label>
                  <Select 
                    value={invitFilters.aiSignal} 
                    onValueChange={(v) => setInvitFilters(f => ({ ...f, aiSignal: v }))}
                  >
                    <SelectTrigger data-testid="invit-signal-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_SIGNALS.map((s: any) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {invitsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i: any) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invits.map((invit: InvitData) => (
                <Card key={invit.id} className="hover:shadow-lg transition-shadow" data-testid={`invit-card-${invit.symbol}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{invit.symbol}</CardTitle>
                        <CardDescription className="line-clamp-1">{invit.name}</CardDescription>
                      </div>
                      <Badge className={getSignalColor(invit.aiSignal)}>
                        {invit.aiSignal.toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {getSectorIcon(invit.sector)}
                      <span className="capitalize">{invit.sector}</span>
                      <span className="mx-2">•</span>
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{invit.geography}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Current Price</p>
                        <p className="text-lg font-semibold">{formatCurrency(invit.currentPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Distribution Yield</p>
                        <p className="text-lg font-semibold text-green-600">{invit.distributionYield}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">NAV Discount</p>
                        <p className={`text-sm font-medium ${parseFloat(invit.premiumToNav) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(invit.premiumToNav)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">1Y Returns</p>
                        <p className={`text-sm font-medium ${parseFloat(invit.returns1Y || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(invit.returns1Y)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getRiskColor(invit.riskLevel)}>
                        <LucideShield className="h-3 w-3 mr-1" />
                        {invit.riskLevel}
                      </Badge>
                      <Badge variant="outline">
                        <Star className="h-3 w-3 mr-1" />
                        {invit.creditRating}
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {invit.concessionLife} yrs
                      </Badge>
                      <Badge variant="outline">
                        <Zap className="h-3 w-3 mr-1" />
                        {invit.totalAssets} Assets
                      </Badge>
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">AI Analysis</span>
                        <span className="text-xs text-muted-foreground">({invit.aiConfidence}% confidence)</span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{invit.aiRationale}</p>
                      {invit.aiTargetPrice && (
                        <p className="text-sm mt-1">
                          <span className="text-muted-foreground">Target:</span>{' '}
                          <span className="font-medium text-primary">{formatCurrency(invit.aiTargetPrice)}</span>
                        </p>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      onClick={() => handleInvest(invit, 'invit')}
                      data-testid={`invest-invit-${invit.symbol}`}
                    >
                      Invest Now
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Unlisted REITs ─────────────────────────────── */}
        <TabsContent value="unlisted-reits" className="space-y-6">
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <Lock className="h-5 w-5" />
                Unlisted & Pre-IPO REITs
              </CardTitle>
              <CardDescription>
                SEBI-registered REITs not yet listed on exchanges. Register your interest to be notified when they open for investment.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search unlisted REITs…"
                value={unlistedReitSearch}
                onChange={e => setUnlistedReitSearch(e.target.value)}
              />
            </div>
            <Badge variant="secondary">{unlistedReits.length} found</Badge>
          </div>

          {unlistedReitsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i: any) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : unlistedReits.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No unlisted REITs found.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlistedReits.map((r: any) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{r.name}</CardTitle>
                      <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/30 capitalize text-[10px]">
                        {r.listingStage?.replace('_', ' ') || 'Unlisted'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-4 w-4 shrink-0" />
                      <span>{r.industry || r.sector || 'Real Estate'}</span>
                    </div>
                    {r.sector && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="capitalize">{r.sector}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700"
                      onClick={() => toast({ title: 'Interest Registered', description: `We'll notify you when ${r.name} opens for investment.` })}
                    >
                      Register Interest
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Unlisted InvITs ─────────────────────────────── */}
        <TabsContent value="unlisted-invits" className="space-y-6">
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-300">
                <Lock className="h-5 w-5" />
                Unlisted & Pre-IPO InvITs
              </CardTitle>
              <CardDescription>
                SEBI-registered infrastructure investment trusts not yet listed on exchanges. Covering roads, energy, telecom, logistics and more.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search unlisted InvITs…"
                value={unlistedInvitSearch}
                onChange={e => setUnlistedInvitSearch(e.target.value)}
              />
            </div>
            <Select value={unlistedInvitIndustry} onValueChange={setUnlistedInvitIndustry}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All sectors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                <SelectItem value="roads">Roads & Highways</SelectItem>
                <SelectItem value="energy">Energy</SelectItem>
                <SelectItem value="renewable">Renewable Energy</SelectItem>
                <SelectItem value="telecom">Telecom & Digital</SelectItem>
                <SelectItem value="logistics">Logistics & Warehousing</SelectItem>
                <SelectItem value="education">Education Infrastructure</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">{unlistedInvits.length} found</Badge>
          </div>

          {unlistedInvitsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i: any) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : unlistedInvits.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No unlisted InvITs found.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlistedInvits.map((r: any) => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{r.name}</CardTitle>
                      <Badge variant="outline" className="shrink-0 text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-950/30 capitalize text-[10px]">
                        {r.listingStage?.replace('_', ' ') || 'Unlisted'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Power className="h-4 w-4 shrink-0" />
                      <span>{r.industry || r.sector || 'Infrastructure'}</span>
                    </div>
                    {r.sector && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="capitalize">{r.sector}</span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700"
                      onClick={() => toast({ title: 'Interest Registered', description: `We'll notify you when ${r.name} opens for investment.` })}
                    >
                      Register Interest
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI-Powered Investment Recommendations
              </CardTitle>
              <CardDescription>
                Personalized picks based on your risk profile and investment goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiRecommendations?.summary && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-background rounded-lg">
                    <p className="text-3xl font-bold text-primary">{aiRecommendations.summary.totalRecommendations}</p>
                    <p className="text-sm text-muted-foreground">Recommendations</p>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{aiRecommendations.summary.avgYield}%</p>
                    <p className="text-sm text-muted-foreground">Avg. Yield</p>
                  </div>
                  <div className="text-center p-4 bg-background rounded-lg">
                    <p className="text-3xl font-bold">{aiRecommendations.summary.avgConfidence}%</p>
                    <p className="text-sm text-muted-foreground">Avg. Confidence</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {recommendationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i: any) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec: Recommendation, index: number) => (
                <Card key={rec.symbol} className="hover:shadow-lg transition-shadow" data-testid={`ai-pick-${rec.symbol}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-xl shrink-0">
                        #{index + 1}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{rec.symbol}</h3>
                              <Badge variant="outline" className="text-xs uppercase">
                                {rec.type}
                              </Badge>
                              <Badge className={getSignalColor(rec.aiSignal)}>
                                {rec.aiSignal.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold">{formatCurrency(rec.currentPrice)}</p>
                            <p className="text-sm text-green-600">{rec.distributionYield}% yield</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className={getRiskColor(rec.riskLevel)}>
                            <LucideShield className="h-3 w-3 mr-1" />
                            {rec.riskLevel} risk
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">AI Confidence:</span>
                            <Progress value={parseFloat(rec.aiConfidence)} className="w-24 h-2" />
                            <span className="text-sm font-medium">{rec.aiConfidence}%</span>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground">{rec.aiRationale}</p>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            <span className="text-sm">Target: {formatCurrency(rec.aiTargetPrice)}</span>
                            <span className="text-xs text-green-600">
                              ({formatPercent((parseFloat(rec.aiTargetPrice) - parseFloat(rec.currentPrice)) / parseFloat(rec.currentPrice) * 100)} upside)
                            </span>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleInvest(rec as any, rec.type)}
                            data-testid={`invest-ai-${rec.symbol}`}
                          >
                            Invest
                            <ArrowUpRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
