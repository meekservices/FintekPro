import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, Building2, TrendingUp, Calendar, IndianRupee, 
  CheckCircle2, AlertTriangle, Users, Landmark, RefreshCw, 
  Loader2, BarChart3, Shield as LucideShield, MapPin, Mail, FileText,
  ChevronLeft, ExternalLink, Clock, AlertCircle, CircleDollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CompanyProfile {
  company: {
    cin: string;
    name: string;
    status: string;
    category: string;
    subCategory: string;
    class: string;
    incorporationDate: string;
    registeredAddress: string;
    registeredState: string;
    registeredCity: string;
    email: string;
    industry: string;
    authorizedCapital: string;
    paidUpCapital: string;
    lastAnnualReturn: string;
    lastBalanceSheet: string;
    lastFilingYear: string;
  };
  directors: {
    din: string;
    name: string;
    designation: string;
    status: string;
    totalAppointments: number;
    activeAppointments: number;
  }[];
  charges: {
    chargeId: string;
    holder: string;
    holderType: string;
    amount: string;
    type: string;
    creationDate: string;
    satisfactionDate: string;
    status: string;
  }[];
  financials: {
    financialYear: string;
    revenue: string;
    profitBeforeTax: string;
    profitAfterTax: string;
    netWorth: string;
    totalAssets: string;
    totalLiabilities: string;
    shareCapital: string;
    reserves: string;
    longTermBorrowing: string;
    shortTermBorrowing: string;
    source: string;
    isVerified: boolean;
  }[];
  summary: {
    totalDirectors: number;
    activeCharges: number;
    financialYears: number;
  };
}

interface ProfileMeta {
  fromCache: boolean;
  cacheAgeHours: string;
  apiCallMade: boolean;
  dataSource: string;
  lastUpdated: string;
}

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  const statusLower = status?.toLowerCase() || '';
  if (statusLower.includes('active')) {
    return { variant: 'default', label: 'Active' };
  } else if (statusLower.includes('strike') || statusLower.includes('dormant')) {
    return { variant: 'destructive', label: status };
  } else if (statusLower.includes('under')) {
    return { variant: 'secondary', label: status };
  }
  return { variant: 'outline', label: status || 'Unknown' };
}

function getRatioBadge(value: number | null, type: 'margin' | 'roe' | 'roa' | 'de' | 'cagr'): { color: string; label: string } {
  if (value === null) return { color: 'text-muted-foreground', label: '—' };
  
  switch (type) {
    case 'margin':
    case 'roe':
    case 'roa':
      if (value >= 20) return { color: 'text-green-600', label: 'Excellent' };
      if (value >= 10) return { color: 'text-blue-600', label: 'Good' };
      if (value >= 0) return { color: 'text-yellow-600', label: 'Moderate' };
      return { color: 'text-red-600', label: 'Poor' };
    case 'de':
      if (value <= 0.5) return { color: 'text-green-600', label: 'Low Risk' };
      if (value <= 1) return { color: 'text-blue-600', label: 'Moderate' };
      if (value <= 2) return { color: 'text-yellow-600', label: 'High' };
      return { color: 'text-red-600', label: 'Very High' };
    case 'cagr':
      if (value >= 20) return { color: 'text-green-600', label: 'Strong Growth' };
      if (value >= 10) return { color: 'text-blue-600', label: 'Good Growth' };
      if (value >= 0) return { color: 'text-yellow-600', label: 'Slow Growth' };
      return { color: 'text-red-600', label: 'Declining' };
    default:
      return { color: 'text-muted-foreground', label: '—' };
  }
}

interface FinancialRatiosData {
  cin: string;
  companyName?: string;
  hasData: boolean;
  latestYear?: string;
  metrics?: {
    revenue: number | null;
    profitAfterTax: number | null;
    netWorth: number | null;
    totalAssets: number | null;
    totalLiabilities: number | null;
    totalBorrowing: number | null;
  };
  ratios?: {
    patMargin: number | null;
    returnOnEquity: number | null;
    returnOnAssets: number | null;
    debtToEquity: number | null;
    assetTurnover: number | null;
  };
  growth?: {
    revenueCAGR: number | null;
    patCAGR: number | null;
    revenueYoY: number | null;
    patYoY: number | null;
    yearsOfData: number;
  };
}

interface RiskScoreData {
  cin: string;
  companyName?: string;
  hasData: boolean;
  overallScore: number;
  riskGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    profitConsistency: { score: number; weight: number; details: string };
    leverage: { score: number; weight: number; details: string };
    complianceFreshness: { score: number; weight: number; details: string };
    companyStatus: { score: number; weight: number; details: string };
    operatingMargins: { score: number; weight: number; details: string };
  };
  calculatedAt: string;
}

function getRiskGradeStyle(grade: string): { bg: string; text: string; label: string } {
  switch (grade) {
    case 'A': return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Low Risk' };
    case 'B': return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Moderate' };
    case 'C': return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Medium' };
    case 'D': return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'High' };
    case 'F': return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Very High' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Unknown' };
  }
}

function RiskScoreCard({ cin }: { cin: string }) {
  const { data, isLoading } = useQuery<{ success: boolean; hasData: boolean; data: RiskScoreData }>({
    queryKey: ['/api/mca/company', cin, 'risk-score'],
    enabled: !!cin && cin.length === 21,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasData || !data?.data) {
    return null;
  }

  const { overallScore, riskGrade, components } = data.data;
  const gradeStyle = getRiskGradeStyle(riskGrade);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <LucideShield className="w-5 h-5 text-primary" />
          Risk Assessment
        </CardTitle>
        <CardDescription>Composite risk score based on financial and compliance metrics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6 mb-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${gradeStyle.bg}`}>
            <div className="text-center">
              <div className={`text-3xl font-bold ${gradeStyle.text}`}>{riskGrade}</div>
              <div className={`text-xs ${gradeStyle.text}`}>{overallScore}/100</div>
            </div>
          </div>
          <div>
            <div className={`text-lg font-semibold ${gradeStyle.text}`}>{gradeStyle.label} Risk</div>
            <div className="text-sm text-muted-foreground">
              Lower score indicates safer investment
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(components).map(([key, comp]) => {
            const label = {
              profitConsistency: 'Profit Consistency',
              leverage: 'Leverage Risk',
              complianceFreshness: 'Filing Freshness',
              companyStatus: 'Company Status',
              operatingMargins: 'Operating Margins',
            }[key] || key;

            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={
                    comp.score <= 30 ? 'text-green-600' : 
                    comp.score <= 60 ? 'text-yellow-600' : 'text-red-600'
                  }>
                    {comp.score}/100 ({(comp.weight * 100).toFixed(0)}% weight)
                  </span>
                </div>
                <Progress value={100 - comp.score} className="h-2" />
                <div className="text-xs text-muted-foreground">{comp.details}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialRatiosCard({ cin }: { cin: string }) {
  const { data, isLoading } = useQuery<{ success: boolean; hasData: boolean; data: FinancialRatiosData }>({
    queryKey: ['/api/mca/company', cin, 'financials'],
    enabled: !!cin && cin.length === 21,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.hasData || !data?.data?.ratios) {
    return null;
  }

  const { ratios, growth, latestYear } = data.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Financial Ratios
          {latestYear && <Badge variant="outline" className="ml-2 text-xs">FY {latestYear}</Badge>}
        </CardTitle>
        <CardDescription>Key performance metrics and growth indicators</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">PAT Margin</div>
            <div className={`text-2xl font-bold ${getRatioBadge(ratios.patMargin, 'margin').color}`}>
              {ratios.patMargin !== null ? `${ratios.patMargin.toFixed(1)}%` : '—'}
            </div>
            <Badge variant="outline" className={`text-xs mt-1 ${getRatioBadge(ratios.patMargin, 'margin').color}`}>
              {getRatioBadge(ratios.patMargin, 'margin').label}
            </Badge>
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Return on Equity</div>
            <div className={`text-2xl font-bold ${getRatioBadge(ratios.returnOnEquity, 'roe').color}`}>
              {ratios.returnOnEquity !== null ? `${ratios.returnOnEquity.toFixed(1)}%` : '—'}
            </div>
            <Badge variant="outline" className={`text-xs mt-1 ${getRatioBadge(ratios.returnOnEquity, 'roe').color}`}>
              {getRatioBadge(ratios.returnOnEquity, 'roe').label}
            </Badge>
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Return on Assets</div>
            <div className={`text-2xl font-bold ${getRatioBadge(ratios.returnOnAssets, 'roa').color}`}>
              {ratios.returnOnAssets !== null ? `${ratios.returnOnAssets.toFixed(1)}%` : '—'}
            </div>
            <Badge variant="outline" className={`text-xs mt-1 ${getRatioBadge(ratios.returnOnAssets, 'roa').color}`}>
              {getRatioBadge(ratios.returnOnAssets, 'roa').label}
            </Badge>
          </div>

          <div className="p-4 bg-muted rounded-lg text-center">
            <div className="text-sm text-muted-foreground mb-1">Debt/Equity</div>
            <div className={`text-2xl font-bold ${getRatioBadge(ratios.debtToEquity, 'de').color}`}>
              {ratios.debtToEquity !== null ? ratios.debtToEquity.toFixed(2) : '—'}
            </div>
            <Badge variant="outline" className={`text-xs mt-1 ${getRatioBadge(ratios.debtToEquity, 'de').color}`}>
              {getRatioBadge(ratios.debtToEquity, 'de').label}
            </Badge>
          </div>
        </div>

        {growth && (growth.revenueCAGR !== null || growth.patCAGR !== null) && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Growth Metrics ({growth.yearsOfData} years of data)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {growth.revenueCAGR !== null && (
                <div className="flex items-center gap-2">
                  <div className={`text-lg font-semibold ${getRatioBadge(growth.revenueCAGR, 'cagr').color}`}>
                    {growth.revenueCAGR >= 0 ? '▲' : '▼'} {Math.abs(growth.revenueCAGR).toFixed(1)}%
                  </div>
                  <span className="text-sm text-muted-foreground">Revenue CAGR</span>
                </div>
              )}
              {growth.patCAGR !== null && (
                <div className="flex items-center gap-2">
                  <div className={`text-lg font-semibold ${getRatioBadge(growth.patCAGR, 'cagr').color}`}>
                    {growth.patCAGR >= 0 ? '▲' : '▼'} {Math.abs(growth.patCAGR).toFixed(1)}%
                  </div>
                  <span className="text-sm text-muted-foreground">PAT CAGR</span>
                </div>
              )}
              {growth.revenueYoY !== null && (
                <div className="flex items-center gap-2">
                  <div className={`text-lg font-semibold ${growth.revenueYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growth.revenueYoY >= 0 ? '▲' : '▼'} {Math.abs(growth.revenueYoY).toFixed(1)}%
                  </div>
                  <span className="text-sm text-muted-foreground">Revenue YoY</span>
                </div>
              )}
              {growth.patYoY !== null && (
                <div className="flex items-center gap-2">
                  <div className={`text-lg font-semibold ${growth.patYoY >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {growth.patYoY >= 0 ? '▲' : '▼'} {Math.abs(growth.patYoY).toFixed(1)}%
                  </div>
                  <span className="text-sm text-muted-foreground">PAT YoY</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function McaCompanyProfile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute('/admin/mca-company/:cin');
  const [searchCin, setSearchCin] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const cin = params?.cin || '';

  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    success: boolean;
    data: CompanyProfile;
    meta: ProfileMeta;
    attribution: string;
  }>({
    queryKey: ['/api/mca/company', cin],
    enabled: !!cin && cin.length === 21,
  });

  const handleSearch = () => {
    if (searchCin.length === 21) {
      setLocation(`/admin/mca-company/${searchCin}`);
    } else {
      toast({
        title: 'Invalid CIN',
        description: 'CIN must be exactly 21 characters',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader className="text-center">
              <Building2 className="w-16 h-16 mx-auto text-primary mb-4" />
              <CardTitle className="text-2xl">MCA Company Profile</CardTitle>
              <CardDescription>
                Enter a 21-character CIN to view comprehensive company details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 max-w-xl mx-auto">
                <Input
                  placeholder="Enter CIN (e.g., U74999DL2016PTC303010)"
                  value={searchCin}
                  onChange={(e) => setSearchCin(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="font-mono"
                  maxLength={21}
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
              <p className="text-center text-muted-foreground text-sm mt-4">
                {searchCin.length}/21 characters
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => setLocation('/admin/mca-intelligence')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to MCA Intelligence
          </Button>
          <Card className="border-destructive">
            <CardHeader className="text-center">
              <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
              <CardTitle>Company Not Found</CardTitle>
              <CardDescription>
                Unable to retrieve data for CIN: {cin}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                The company may not exist in the MCA database, or there was an error fetching the data.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={() => setLocation('/admin/mca-company')}>
                  Search Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { company, directors, charges, financials, summary } = data.data;
  const meta = data.meta;
  const statusBadge = getStatusBadge(company.status);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setLocation('/admin/mca-intelligence')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to MCA Intelligence
          </Button>
          <div className="flex items-center gap-2">
            {meta.fromCache && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Cached ({meta.cacheAgeHours}h ago)
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-primary" />
                  <div>
                    <CardTitle className="text-2xl">{company.name}</CardTitle>
                    <p className="font-mono text-sm text-muted-foreground">{company.cin}</p>
                  </div>
                </div>
              </div>
              <Badge variant={statusBadge.variant} className="text-sm">
                {statusBadge.label}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline">{company.category}</Badge>
              {company.subCategory && <Badge variant="outline">{company.subCategory}</Badge>}
              {company.class && <Badge variant="outline">{company.class}</Badge>}
              {company.industry && <Badge variant="outline">{company.industry}</Badge>}
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="directors">Directors ({summary.totalDirectors})</TabsTrigger>
            <TabsTrigger value="charges">Charges ({summary.activeCharges})</TabsTrigger>
            <TabsTrigger value="financials">Financials ({summary.financialYears})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-muted-foreground" />
                    Company Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Incorporation Date</span>
                    <span className="font-medium flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(company.incorporationDate)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last AGM</span>
                    <span className="font-medium">{company.lastFilingYear || '—'}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Balance Sheet</span>
                    <span className="font-medium">{formatDate(company.lastBalanceSheet)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Annual Return</span>
                    <span className="font-medium">{formatDate(company.lastAnnualReturn)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CircleDollarSign className="w-5 h-5 text-muted-foreground" />
                    Capital Structure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Authorized Capital</span>
                    <span className="font-medium text-primary">
                      {formatCurrency(company.authorizedCapital)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid-Up Capital</span>
                    <span className="font-medium text-primary">
                      {formatCurrency(company.paidUpCapital)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital Utilization</span>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={
                          company.authorizedCapital && company.paidUpCapital
                            ? (parseFloat(company.paidUpCapital) / parseFloat(company.authorizedCapital)) * 100
                            : 0
                        } 
                        className="w-20 h-2" 
                      />
                      <span className="text-sm">
                        {company.authorizedCapital && company.paidUpCapital
                          ? `${((parseFloat(company.paidUpCapital) / parseFloat(company.authorizedCapital)) * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-muted-foreground" />
                    Registered Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{company.registeredAddress || 'Not available'}</p>
                  <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                    {company.registeredCity && <span>{company.registeredCity}</span>}
                    {company.registeredState && <span>{company.registeredState}</span>}
                    {company.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {company.email}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <Users className="w-8 h-8 mx-auto text-primary mb-2" />
                    <div className="text-2xl font-bold">{summary.totalDirectors}</div>
                    <div className="text-sm text-muted-foreground">Directors</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <LucideShield className="w-8 h-8 mx-auto text-orange-500 mb-2" />
                    <div className="text-2xl font-bold">{summary.activeCharges}</div>
                    <div className="text-sm text-muted-foreground">Active Charges</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <FileText className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                    <div className="text-2xl font-bold">{summary.financialYears}</div>
                    <div className="text-sm text-muted-foreground">Financial Years</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <TrendingUp className="w-8 h-8 mx-auto text-green-500 mb-2" />
                    <div className="text-2xl font-bold">
                      {financials[0]?.profitAfterTax 
                        ? formatCurrency(financials[0].profitAfterTax)
                        : '—'}
                    </div>
                    <div className="text-sm text-muted-foreground">Latest PAT</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <RiskScoreCard cin={cin} />
          </TabsContent>

          <TabsContent value="directors">
            <Card>
              <CardHeader>
                <CardTitle>Board of Directors</CardTitle>
                <CardDescription>Current and past directors/signatories</CardDescription>
              </CardHeader>
              <CardContent>
                {directors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No director information available</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>DIN</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Appointments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directors.map((director, idx) => (
                        <TableRow key={director.din || idx}>
                          <TableCell className="font-medium">{director.name}</TableCell>
                          <TableCell className="font-mono text-sm">{director.din}</TableCell>
                          <TableCell>{director.designation}</TableCell>
                          <TableCell>
                            <Badge variant={director.status === 'active' ? 'default' : 'secondary'}>
                              {director.status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {director.activeAppointments} / {director.totalAppointments}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="charges">
            <Card>
              <CardHeader>
                <CardTitle>Charges & Borrowings</CardTitle>
                <CardDescription>Securities registered with the Registrar of Companies</CardDescription>
              </CardHeader>
              <CardContent>
                {charges.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LucideShield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No charges registered</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Charge Holder</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Creation Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {charges.map((charge, idx) => (
                        <TableRow key={charge.chargeId || idx}>
                          <TableCell className="font-medium">
                            {charge.holder}
                            {charge.holderType && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({charge.holderType})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{formatCurrency(charge.amount)}</TableCell>
                          <TableCell>{formatDate(charge.creationDate)}</TableCell>
                          <TableCell>
                            <Badge variant={charge.status === 'active' ? 'default' : 'secondary'}>
                              {charge.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            {financials.length > 0 && (
              <FinancialRatiosCard cin={cin} />
            )}
            <Card>
              <CardHeader>
                <CardTitle>Financial History</CardTitle>
                <CardDescription>Year-wise financial performance data with YoY growth</CardDescription>
              </CardHeader>
              <CardContent>
                {financials.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No financial data available</p>
                    <p className="text-sm mt-2">Financial details will be populated when AOC-4 filings are ingested</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Financial Year</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                          <TableHead className="text-right">PAT</TableHead>
                          <TableHead className="text-right">Net Worth</TableHead>
                          <TableHead className="text-right">Total Assets</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {financials.map((f, idx) => {
                          const prevF = financials[idx + 1];
                          const revenueGrowth = prevF && parseFloat(prevF.revenue || '0') > 0
                            ? ((parseFloat(f.revenue || '0') - parseFloat(prevF.revenue || '0')) / parseFloat(prevF.revenue || '1')) * 100
                            : null;
                          const patGrowth = prevF && parseFloat(prevF.profitAfterTax || '0') > 0
                            ? ((parseFloat(f.profitAfterTax || '0') - parseFloat(prevF.profitAfterTax || '0')) / parseFloat(prevF.profitAfterTax || '1')) * 100
                            : null;
                          
                          return (
                            <TableRow key={f.financialYear || idx}>
                              <TableCell className="font-medium">{f.financialYear}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(f.revenue)}</span>
                                  {revenueGrowth !== null && (
                                    <span className={`text-xs ${revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(revenueGrowth).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end">
                                  <span className={parseFloat(f.profitAfterTax || '0') >= 0 ? 'text-green-600' : 'text-red-600'}>
                                    {formatCurrency(f.profitAfterTax)}
                                  </span>
                                  {patGrowth !== null && (
                                    <span className={`text-xs ${patGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {patGrowth >= 0 ? '▲' : '▼'} {Math.abs(patGrowth).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(f.netWorth)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(f.totalAssets)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {f.source || 'MCA'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{data.attribution}</span>
              <span>
                Last updated: {formatDate(meta.lastUpdated)} | Source: {meta.dataSource}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
