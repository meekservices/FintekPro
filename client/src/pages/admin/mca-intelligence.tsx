import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Search, Building2, TrendingUp, Download, Calendar, IndianRupee, 
  CheckCircle2, AlertTriangle, Wallet, FileText, Database, Activity,
  Filter, RefreshCw, Upload, Eye, ArrowUpDown, Loader2, BarChart3,
  Shield as LucideShield, Scale, Clock, Users, Landmark, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ApiUsageInfo {
  paymentMode: string;
  billingProvider: string;
  totalRequests: number;
  requestsThisMonth: number;
  lastRequestDate?: string;
  message: string;
}

interface DashboardStats {
  totalCompanies: number;
  totalFilings: number;
  totalQueries: number;
  profitableCompanies: number;
  apiRequestsThisMonth: number;
  recentQueries: any[];
}

interface ProfitableCompany {
  cin: string;
  companyName: string;
  profitAfterTax: number;
  financialYear: string;
  revenue?: number;
  netWorth?: number;
  state?: string;
  industry?: string;
}

interface QueryLogEntry {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  queryType: string;
  cin?: string;
  companyName?: string;
  actionTaken?: string;
  responseSummary?: string;
  success: boolean;
  createdAt: string;
}

export default function McaIntelligence() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Handle payment callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const amount = params.get('amount');
    const message = params.get('message');
    
    if (payment) {
      if (payment === 'success') {
        toast({ 
          title: 'Payment Successful', 
          description: amount ? `API credits added: ₹${amount}` : 'API credits have been added',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/wallet'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/dashboard'] });
      } else if (payment === 'failed') {
        toast({ 
          title: 'Payment Failed', 
          description: message || 'Payment was not completed',
          variant: 'destructive',
        });
      } else if (payment === 'pending') {
        toast({ 
          title: 'Payment Pending', 
          description: 'Your payment is being processed. It will be credited shortly.',
        });
      } else if (payment === 'error') {
        toast({ 
          title: 'Payment Error', 
          description: message || 'An error occurred during payment',
          variant: 'destructive',
        });
      }
      // Clear query params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);
  
  // Query Console State
  const [queryType, setQueryType] = useState('company_lookup');
  const [queryCin, setQueryCin] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // Profitable Radar State
  const [patMin, setPatMin] = useState('10000000');
  const [stateFilter, setStateFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  
  // Ingest State (legacy XBRL)
  const [ingestCin, setIngestCin] = useState('');
  const [ingestYear, setIngestYear] = useState('');
  const [ingestXbrl, setIngestXbrl] = useState('');
  const [showIngestDialog, setShowIngestDialog] = useState(false);
  
  // Direct Data Ingest State
  const [ingestSubTab, setIngestSubTab] = useState('company');
  
  // Company Ingest Form
  const [companyForm, setCompanyForm] = useState({
    cin: '',
    companyName: '',
    companyStatus: 'Active',
    registeredState: '',
    registeredCity: '',
    industry: '',
    authorizedCapital: '',
    paidUpCapital: '',
    lastFilingYear: '',
  });
  
  // Financial Ingest Form
  const [financialForm, setFinancialForm] = useState({
    cin: '',
    financialYear: '',
    revenue: '',
    profitBeforeTax: '',
    profitAfterTax: '',
    netWorth: '',
    totalAssets: '',
    totalLiabilities: '',
    longTermBorrowing: '',
    shortTermBorrowing: '',
  });
  
  // Bulk Ingest State
  const [bulkJson, setBulkJson] = useState('');
  const [bulkPreview, setBulkPreview] = useState<any>(null);
  const [bulkError, setBulkError] = useState('');
  
  // API Usage State (direct pay-per-request via Sandbox.co.in)

  // Fetch Dashboard Stats
  const { data: dashboardResponse, isLoading: loadingStats } = useQuery<{
    success: boolean;
    data: DashboardStats;
  }>({
    queryKey: ['/api/mca/dashboard'],
  });
  const dashboardStats = dashboardResponse?.data;

  // Fetch API Usage Stats (direct pay-per-request mode)
  const { data: apiUsageData } = useQuery<{ success: boolean; data: ApiUsageInfo }>({
    queryKey: ['/api/mca/wallet'],
  });

  // Fetch Profitable Companies
  const { data: profitableData, isLoading: loadingProfitable, refetch: refetchProfitable } = useQuery<{
    success: boolean;
    result: ProfitableCompany[];
  }>({
    queryKey: ['/api/mca/profitable-companies', patMin, stateFilter, industryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (patMin) params.set('pat_min', patMin);
      if (stateFilter) params.set('state', stateFilter);
      if (industryFilter) params.set('industry', industryFilter);
      const res = await fetch(`/api/mca/profitable-companies?${params}`);
      return res.json();
    },
  });

  // Fetch Audit Log
  const { data: auditData, isLoading: loadingAudit } = useQuery<{
    success: boolean;
    data: QueryLogEntry[];
  }>({
    queryKey: ['/api/mca/audit-log'],
  });

  // Query Mutation
  const queryMutation = useMutation({
    mutationFn: async (params: { queryType: string; cin?: string }) => {
      // Filter out empty strings
      const cleanParams: Record<string, any> = { queryType: params.queryType };
      if (params.cin && params.cin.trim().length > 0) {
        cleanParams.cin = params.cin.trim();
      }
      return await apiRequest('/api/mca/query', {
        method: 'POST',
        body: JSON.stringify(cleanParams),
      });
    },
    onSuccess: (data) => {
      setQueryResult(data);
      if (data.success) {
        toast({ title: 'Query executed successfully' });
      } else {
        toast({ title: 'Query failed', description: data.message, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Query error', description: error.message, variant: 'destructive' });
    },
  });

  // Ingest Mutation (legacy XBRL)
  const ingestMutation = useMutation({
    mutationFn: async (params: { cin: string; financialYear: string; xbrlContent: string }) => {
      return await apiRequest('/api/mca/ingest', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'XBRL ingested successfully', description: data.message });
        setShowIngestDialog(false);
        setIngestCin('');
        setIngestYear('');
        setIngestXbrl('');
        queryClient.invalidateQueries({ queryKey: ['/api/mca/dashboard'] });
      } else {
        toast({ title: 'Ingestion failed', description: data.message, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Ingestion error', description: error.message, variant: 'destructive' });
    },
  });

  // Company Master Ingest Mutation
  const companyIngestMutation = useMutation({
    mutationFn: async (params: typeof companyForm) => {
      return await apiRequest('/api/mca/ingest-company', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Company ingested successfully', description: `${data.data?.companyName} added to database` });
        setCompanyForm({
          cin: '',
          companyName: '',
          companyStatus: 'Active',
          registeredState: '',
          registeredCity: '',
          industry: '',
          authorizedCapital: '',
          paidUpCapital: '',
          lastFilingYear: '',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/profitable-companies'] });
      } else {
        toast({ title: 'Company ingest failed', description: data.error, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Company ingest error', description: error.message, variant: 'destructive' });
    },
  });

  // Financial Data Ingest Mutation
  const financialIngestMutation = useMutation({
    mutationFn: async (params: typeof financialForm) => {
      return await apiRequest('/api/mca/ingest-financials', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Financial data ingested', description: `FY ${data.data?.financialYear} added` });
        setFinancialForm({
          cin: '',
          financialYear: '',
          revenue: '',
          profitBeforeTax: '',
          profitAfterTax: '',
          netWorth: '',
          totalAssets: '',
          totalLiabilities: '',
          longTermBorrowing: '',
          shortTermBorrowing: '',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/profitable-companies'] });
      } else {
        toast({ title: 'Financial ingest failed', description: data.error, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Financial ingest error', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk Ingest Mutation
  const bulkIngestMutation = useMutation({
    mutationFn: async (params: any) => {
      return await apiRequest('/api/mca/ingest-bulk', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        const r = data.results;
        toast({ 
          title: 'Bulk ingest completed', 
          description: `Companies: ${r.companiesIngested}/${r.companiesIngested + r.companiesFailed}, Financials: ${r.financialsIngested}/${r.financialsIngested + r.financialsFailed + r.financialsSkipped}`,
        });
        setBulkJson('');
        setBulkPreview(null);
        queryClient.invalidateQueries({ queryKey: ['/api/mca/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/mca/profitable-companies'] });
      } else {
        toast({ title: 'Bulk ingest failed', description: data.error, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Bulk ingest error', description: error.message, variant: 'destructive' });
    },
  });

  // Handle bulk JSON preview
  const handleBulkJsonChange = (value: string) => {
    setBulkJson(value);
    setBulkError('');
    setBulkPreview(null);
    
    if (value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.companies || parsed.financials) {
          setBulkPreview({
            companiesCount: parsed.companies?.length || 0,
            financialsCount: parsed.financials?.length || 0,
            data: parsed,
          });
        } else {
          setBulkError('JSON must contain "companies" and/or "financials" arrays');
        }
      } catch (e) {
        setBulkError('Invalid JSON format');
      }
    }
  };

  const apiUsage = apiUsageData?.data;
  const stats = dashboardStats;

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleExecuteQuery = () => {
    queryMutation.mutate({ queryType, cin: queryCin });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Landmark className="h-8 w-8" />
            MCA Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Ministry of Corporate Affairs data intelligence and query console
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm py-1 px-3">
            <BarChart3 className="h-4 w-4 mr-1" />
            API Requests: {apiUsage?.requestsThisMonth || stats?.totalQueries || 0} this month
          </Badge>
          <Badge variant="outline" className="text-xs py-1 px-2">
            Direct Billing via Sandbox.co.in
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="query" className="flex items-center gap-1">
            <Search className="h-4 w-4" />
            Query Console
          </TabsTrigger>
          <TabsTrigger value="radar" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Profitable Radar
          </TabsTrigger>
          <TabsTrigger value="ingest" className="flex items-center gap-1">
            <Database className="h-4 w-4" />
            Data Ingest
          </TabsTrigger>
          <TabsTrigger value="filings" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Filing Tracker
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <LucideShield className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {loadingStats ? (
            <LoadingState message="Loading MCA statistics..." />
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Companies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalCompanies || 0}</div>
                    <p className="text-xs text-muted-foreground">In database</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Filings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalFilings || 0}</div>
                    <p className="text-xs text-muted-foreground">Tracked downloads</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Queries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalQueries || 0}</div>
                    <p className="text-xs text-muted-foreground">Total executed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Profitable</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats?.profitableCompanies || 0}</div>
                    <p className="text-xs text-muted-foreground">PAT &gt; ₹1 Cr</p>
                  </CardContent>
                </Card>
              </div>

              {/* API Usage Status - Direct Pay-Per-Request via Sandbox.co.in */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    MCA API Usage
                  </CardTitle>
                  <CardDescription>
                    Direct pay-per-request billing via Sandbox.co.in
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Requests This Month</p>
                      <p className="text-xl font-bold text-blue-600">
                        {apiUsage?.requestsThisMonth || stats?.apiRequestsThisMonth || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Requests</p>
                      <p className="text-xl font-bold">{apiUsage?.totalRequests || stats?.totalQueries || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Billing Provider</p>
                      <p className="text-xl font-bold text-green-600">Sandbox.co.in</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Direct Billing:</strong> Each MCA API request is billed directly to your Sandbox.co.in account.
                      Add credits at <a href="https://dashboard.sandbox.co.in/billing" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">dashboard.sandbox.co.in</a>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  <Button onClick={() => setActiveTab('query')}>
                    <Search className="h-4 w-4 mr-2" />
                    New Query
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('ingest')}>
                    <Database className="h-4 w-4 mr-2" />
                    Data Ingest
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('radar')}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Profitable Radar
                  </Button>
                  <Button variant="ghost" onClick={() => setShowIngestDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    XBRL (Legacy)
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Query Console Tab */}
        <TabsContent value="query" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                MCA Query Console
              </CardTitle>
              <CardDescription>
                Execute queries against MCA data. All queries are logged for audit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Query Type</Label>
                  <Select value={queryType} onValueChange={setQueryType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company_lookup">Company Lookup</SelectItem>
                      <SelectItem value="financial_availability">Financial Availability</SelectItem>
                      <SelectItem value="last_filed_aoc4">Last Filed AOC-4</SelectItem>
                      <SelectItem value="profit_check">Profit Check (&gt;₹1 Cr)</SelectItem>
                      <SelectItem value="filing_status">Filing Status</SelectItem>
                      <SelectItem value="wallet_check">API Usage Stats</SelectItem>
                      <SelectItem value="charges_analysis">Charges Analysis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CIN (if applicable)</Label>
                  <Input 
                    value={queryCin} 
                    onChange={(e) => setQueryCin(e.target.value.toUpperCase())}
                    placeholder="U12345AB1234ABC123456"
                    maxLength={21}
                  />
                </div>
              </div>
              <Button 
                onClick={handleExecuteQuery} 
                disabled={queryMutation.isPending}
              >
                {queryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Execute Query
              </Button>

              {queryResult && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {queryResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">Query Result</span>
                  </div>
                  <pre className="text-sm overflow-auto max-h-96 bg-background p-3 rounded">
                    {JSON.stringify(queryResult.result, null, 2)}
                  </pre>
                  {queryResult.message && (
                    <p className="text-xs text-muted-foreground mt-2">{queryResult.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profitable Radar Tab */}
        <TabsContent value="radar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Profitable Company Radar
              </CardTitle>
              <CardDescription>
                Find companies with Profit After Tax above threshold
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Min PAT (₹)</Label>
                  <Input 
                    type="number"
                    value={patMin} 
                    onChange={(e) => setPatMin(e.target.value)}
                    placeholder="10000000"
                  />
                </div>
                <div>
                  <Label>State</Label>
                  <Input 
                    value={stateFilter} 
                    onChange={(e) => setStateFilter(e.target.value)}
                    placeholder="Maharashtra"
                  />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input 
                    value={industryFilter} 
                    onChange={(e) => setIndustryFilter(e.target.value)}
                    placeholder="IT Services"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => refetchProfitable()} disabled={loadingProfitable}>
                    {loadingProfitable ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Filter className="h-4 w-4 mr-2" />
                    )}
                    Apply Filters
                  </Button>
                </div>
              </div>

              {/* Results Table */}
              {loadingProfitable ? (
                <LoadingState message="Searching profitable companies..." />
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>CIN</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">PAT</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead>FY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profitableData?.result && profitableData.result.length > 0 ? (
                        profitableData.result.map((company: ProfitableCompany, index: number) => (
                          <TableRow key={`${company.cin}-${company.financialYear}-${index}`}>
                            <TableCell className="font-medium">{company.companyName}</TableCell>
                            <TableCell className="font-mono text-xs">{company.cin}</TableCell>
                            <TableCell>{company.state || '-'}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(company.profitAfterTax)}
                            </TableCell>
                            <TableCell className="text-right">
                              {company.revenue ? formatCurrency(company.revenue) : '-'}
                            </TableCell>
                            <TableCell>{company.financialYear}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No profitable companies found. Try adjusting filters or ingest more data.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Ingest Tab */}
        <TabsContent value="ingest" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Ingest Console
              </CardTitle>
              <CardDescription>
                Ingest company and financial data directly via JSON. No XBRL parsing required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={ingestSubTab} onValueChange={setIngestSubTab}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="company" className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Company Master
                  </TabsTrigger>
                  <TabsTrigger value="financial" className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    Financial Data
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="flex items-center gap-1">
                    <Upload className="h-4 w-4" />
                    Bulk Import
                  </TabsTrigger>
                </TabsList>

                {/* Company Master Form */}
                <TabsContent value="company" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>CIN (21 characters) *</Label>
                      <Input 
                        value={companyForm.cin} 
                        onChange={(e) => setCompanyForm({...companyForm, cin: e.target.value.toUpperCase()})}
                        placeholder="L12345MH1990PLC123456"
                        maxLength={21}
                      />
                    </div>
                    <div>
                      <Label>Company Name *</Label>
                      <Input 
                        value={companyForm.companyName} 
                        onChange={(e) => setCompanyForm({...companyForm, companyName: e.target.value})}
                        placeholder="Acme Corporation Limited"
                      />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select 
                        value={companyForm.companyStatus} 
                        onValueChange={(v) => setCompanyForm({...companyForm, companyStatus: v})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Strike Off">Strike Off</SelectItem>
                          <SelectItem value="Under Liquidation">Under Liquidation</SelectItem>
                          <SelectItem value="Dormant">Dormant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Registered State</Label>
                      <Input 
                        value={companyForm.registeredState} 
                        onChange={(e) => setCompanyForm({...companyForm, registeredState: e.target.value})}
                        placeholder="Maharashtra"
                      />
                    </div>
                    <div>
                      <Label>Registered City</Label>
                      <Input 
                        value={companyForm.registeredCity} 
                        onChange={(e) => setCompanyForm({...companyForm, registeredCity: e.target.value})}
                        placeholder="Mumbai"
                      />
                    </div>
                    <div>
                      <Label>Industry</Label>
                      <Input 
                        value={companyForm.industry} 
                        onChange={(e) => setCompanyForm({...companyForm, industry: e.target.value})}
                        placeholder="Information Technology Services"
                      />
                    </div>
                    <div>
                      <Label>Authorized Capital</Label>
                      <Input 
                        type="number"
                        value={companyForm.authorizedCapital} 
                        onChange={(e) => setCompanyForm({...companyForm, authorizedCapital: e.target.value})}
                        placeholder="100000000"
                      />
                    </div>
                    <div>
                      <Label>Paid-up Capital</Label>
                      <Input 
                        type="number"
                        value={companyForm.paidUpCapital} 
                        onChange={(e) => setCompanyForm({...companyForm, paidUpCapital: e.target.value})}
                        placeholder="50000000"
                      />
                    </div>
                    <div>
                      <Label>Last Filing Year</Label>
                      <Input 
                        value={companyForm.lastFilingYear} 
                        onChange={(e) => setCompanyForm({...companyForm, lastFilingYear: e.target.value})}
                        placeholder="2024-25"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={() => companyIngestMutation.mutate(companyForm)}
                    disabled={companyIngestMutation.isPending || !companyForm.cin || !companyForm.companyName || companyForm.cin.length !== 21}
                    className="mt-4"
                  >
                    {companyIngestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Ingest Company
                  </Button>
                </TabsContent>

                {/* Financial Data Form */}
                <TabsContent value="financial" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>CIN (21 characters) *</Label>
                      <Input 
                        value={financialForm.cin} 
                        onChange={(e) => setFinancialForm({...financialForm, cin: e.target.value.toUpperCase()})}
                        placeholder="L12345MH1990PLC123456"
                        maxLength={21}
                      />
                    </div>
                    <div>
                      <Label>Financial Year (YYYY-YY) *</Label>
                      <Input 
                        value={financialForm.financialYear} 
                        onChange={(e) => setFinancialForm({...financialForm, financialYear: e.target.value})}
                        placeholder="2023-24"
                      />
                    </div>
                    <div>
                      <Label>Revenue</Label>
                      <Input 
                        type="number"
                        value={financialForm.revenue} 
                        onChange={(e) => setFinancialForm({...financialForm, revenue: e.target.value})}
                        placeholder="1000000000"
                      />
                    </div>
                    <div>
                      <Label>Profit Before Tax</Label>
                      <Input 
                        type="number"
                        value={financialForm.profitBeforeTax} 
                        onChange={(e) => setFinancialForm({...financialForm, profitBeforeTax: e.target.value})}
                        placeholder="100000000"
                      />
                    </div>
                    <div>
                      <Label>Profit After Tax *</Label>
                      <Input 
                        type="number"
                        value={financialForm.profitAfterTax} 
                        onChange={(e) => setFinancialForm({...financialForm, profitAfterTax: e.target.value})}
                        placeholder="75000000"
                      />
                    </div>
                    <div>
                      <Label>Net Worth</Label>
                      <Input 
                        type="number"
                        value={financialForm.netWorth} 
                        onChange={(e) => setFinancialForm({...financialForm, netWorth: e.target.value})}
                        placeholder="500000000"
                      />
                    </div>
                    <div>
                      <Label>Total Assets</Label>
                      <Input 
                        type="number"
                        value={financialForm.totalAssets} 
                        onChange={(e) => setFinancialForm({...financialForm, totalAssets: e.target.value})}
                        placeholder="800000000"
                      />
                    </div>
                    <div>
                      <Label>Total Liabilities</Label>
                      <Input 
                        type="number"
                        value={financialForm.totalLiabilities} 
                        onChange={(e) => setFinancialForm({...financialForm, totalLiabilities: e.target.value})}
                        placeholder="300000000"
                      />
                    </div>
                    <div>
                      <Label>Long-term Borrowing</Label>
                      <Input 
                        type="number"
                        value={financialForm.longTermBorrowing} 
                        onChange={(e) => setFinancialForm({...financialForm, longTermBorrowing: e.target.value})}
                        placeholder="150000000"
                      />
                    </div>
                    <div>
                      <Label>Short-term Borrowing</Label>
                      <Input 
                        type="number"
                        value={financialForm.shortTermBorrowing} 
                        onChange={(e) => setFinancialForm({...financialForm, shortTermBorrowing: e.target.value})}
                        placeholder="50000000"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Company must exist in database before adding financial data.</span>
                  </div>
                  <Button 
                    onClick={() => financialIngestMutation.mutate(financialForm)}
                    disabled={financialIngestMutation.isPending || !financialForm.cin || !financialForm.financialYear || financialForm.cin.length !== 21 || !/^\d{4}-\d{2}$/.test(financialForm.financialYear)}
                    className="mt-4"
                  >
                    {financialIngestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Ingest Financial Data
                  </Button>
                </TabsContent>

                {/* Bulk Import Form */}
                <TabsContent value="bulk" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Upload JSON File</Label>
                      <Input 
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const content = event.target?.result as string;
                              handleBulkJsonChange(content);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Or paste JSON below</p>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setBulkJson('');
                          setBulkPreview(null);
                          setBulkError('');
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Bulk JSON Data</Label>
                    <Textarea 
                      value={bulkJson} 
                      onChange={(e) => handleBulkJsonChange(e.target.value)}
                      placeholder={`{
  "companies": [
    {
      "cin": "L12345MH1990PLC123456",
      "companyName": "Acme Corp Ltd",
      "registeredState": "Maharashtra",
      "industry": "IT Services"
    }
  ],
  "financials": [
    {
      "cin": "L12345MH1990PLC123456",
      "financialYear": "2023-24",
      "revenue": "1000000000",
      "profitAfterTax": "75000000"
    }
  ]
}`}
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>

                  {bulkError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>{bulkError}</span>
                    </div>
                  )}

                  {bulkPreview && (
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Preview:</p>
                        <Badge variant="default" className="bg-green-500">Ready to Import</Badge>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {bulkPreview.companiesCount} Companies
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {bulkPreview.financialsCount} Financial Records
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Data Quality: <Badge variant="secondary" className="text-xs">DIRECT_INGEST</Badge>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg text-sm">
                    <Activity className="h-4 w-4 text-blue-500" />
                    <span>Bulk ingest processes companies first, then financials. Partial success is possible.</span>
                  </div>

                  <Button 
                    onClick={() => bulkPreview?.data && bulkIngestMutation.mutate(bulkPreview.data)}
                    disabled={bulkIngestMutation.isPending || !bulkPreview}
                    className="mt-4"
                  >
                    {bulkIngestMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Execute Bulk Import
                  </Button>
                </TabsContent>
              </Tabs>

              {/* Recent Ingest History */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Ingest Activity
                  </h3>
                  <Badge variant="outline" className="text-xs">Last 24 hours</Badge>
                </div>
                {auditData?.data ? (
                  <div className="space-y-2">
                    {auditData.data
                      .filter((log: any) => 
                        log.queryType === 'ingest_company' || 
                        log.queryType === 'ingest_financials' || 
                        log.queryType === 'bulk_ingest'
                      )
                      .slice(0, 5)
                      .map((log: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                          <div className="flex items-center gap-2">
                            {log.queryType === 'bulk_ingest' ? (
                              <Upload className="h-4 w-4 text-blue-500" />
                            ) : log.queryType === 'ingest_company' ? (
                              <Building2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-purple-500" />
                            )}
                            <span>{log.cin || 'Bulk Import'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                              {log.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    {auditData.data.filter((log: any) => 
                      log.queryType === 'ingest_company' || 
                      log.queryType === 'ingest_financials' || 
                      log.queryType === 'bulk_ingest'
                    ).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No recent ingest activity. Use the forms above to add data.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Loading ingest history...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Filing Tracker Tab */}
        <TabsContent value="filings" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Filing Download Tracker
                </CardTitle>
                <CardDescription>
                  Track all MCA filing downloads and processing status
                </CardDescription>
              </div>
              <Button onClick={() => setShowIngestDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Ingest XBRL
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No filings tracked yet.</p>
                <p className="text-sm">Use "Ingest XBRL" to add financial data from AOC-4 filings.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LucideShield className="h-5 w-5" />
                Query Audit Log
              </CardTitle>
              <CardDescription>
                Complete audit trail of all MCA queries. SEBI-compliant logging.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAudit ? (
                <LoadingState message="Loading audit log..." />
              ) : auditData?.data && auditData.data.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Query Type</TableHead>
                        <TableHead>CIN</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData.data.map((log: QueryLogEntry) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs">
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{log.userName || 'System'}</p>
                              <p className="text-xs text-muted-foreground">{log.userRole || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.queryType}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.cin || '-'}
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge variant="default" className="bg-green-500">Success</Badge>
                            ) : (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.actionTaken || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <LucideShield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No queries logged yet.</p>
                  <p className="text-sm">Execute queries to see audit trail.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* XBRL Ingest Dialog */}
      <Dialog open={showIngestDialog} onOpenChange={setShowIngestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingest XBRL Filing</DialogTitle>
            <DialogDescription>
              Upload XBRL content to extract financial metrics. Admin/Ops only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>CIN</Label>
              <Input 
                value={ingestCin} 
                onChange={(e) => setIngestCin(e.target.value.toUpperCase())}
                placeholder="U12345AB1234ABC123456"
                maxLength={21}
              />
            </div>
            <div>
              <Label>Financial Year (YYYY-YY)</Label>
              <Input 
                value={ingestYear} 
                onChange={(e) => setIngestYear(e.target.value)}
                placeholder="2023-24"
              />
            </div>
            <div>
              <Label>XBRL Content</Label>
              <Textarea 
                value={ingestXbrl} 
                onChange={(e) => setIngestXbrl(e.target.value)}
                placeholder="Paste XBRL content here..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIngestDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => ingestMutation.mutate({
                cin: ingestCin,
                financialYear: ingestYear,
                xbrlContent: ingestXbrl,
              })}
              disabled={ingestMutation.isPending || !ingestCin || !ingestYear || !ingestXbrl}
            >
              {ingestMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Ingest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attribution Footer */}
      <div className="text-center text-xs text-muted-foreground py-4">
        Derived from statutory public filings sourced from MCA.
      </div>
    </div>
  );
}
