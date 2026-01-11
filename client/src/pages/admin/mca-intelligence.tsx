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
  Shield, Scale, Clock, Users, Landmark, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface WalletInfo {
  currentBalance: number;
  monthlySpend: number;
  totalSpentAllTime: number;
  monthlyBudget: number;
  alertThreshold: number;
  isLowBalance: boolean;
  lastRechargeDate?: string;
}

interface DashboardStats {
  totalCompanies: number;
  totalFilings: number;
  totalQueries: number;
  profitableCompanies: number;
  walletBalance: number;
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
          description: amount ? `Wallet credited with ₹${amount}` : 'Wallet has been recharged',
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
  
  // Ingest State
  const [ingestCin, setIngestCin] = useState('');
  const [ingestYear, setIngestYear] = useState('');
  const [ingestXbrl, setIngestXbrl] = useState('');
  const [showIngestDialog, setShowIngestDialog] = useState(false);
  
  // Wallet State
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);

  // Fetch Dashboard Stats
  const { data: dashboardResponse, isLoading: loadingStats } = useQuery<{
    success: boolean;
    data: DashboardStats;
  }>({
    queryKey: ['/api/mca/dashboard'],
  });
  const dashboardStats = dashboardResponse?.data;

  // Fetch Wallet Status
  const { data: walletData } = useQuery<{ success: boolean; data: WalletInfo }>({
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

  // Ingest Mutation
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

  // Wallet Recharge Mutation - initiates Cashfree payment
  const rechargeMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest('/api/mca/wallet/recharge/initiate', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: (data) => {
      if (data.success && data.data?.paymentUrl) {
        toast({ 
          title: 'Redirecting to payment...', 
          description: `Amount: ₹${data.data.amount}`,
        });
        setShowRechargeDialog(false);
        setRechargeAmount('');
        // Redirect to Cashfree payment page
        window.location.href = data.data.paymentUrl;
      } else {
        toast({ 
          title: 'Payment initiation failed', 
          description: data.error || 'Could not create payment order',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Recharge failed', description: error.message, variant: 'destructive' });
    },
  });

  const wallet = walletData?.data;
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
          <Badge variant={wallet?.isLowBalance ? 'destructive' : 'default'} className="text-sm py-1 px-3">
            <Wallet className="h-4 w-4 mr-1" />
            Balance: {formatCurrency(wallet?.currentBalance || 0)}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setShowRechargeDialog(true)}>
            <IndianRupee className="h-4 w-4 mr-1" />
            Recharge
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="filings" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            Filing Tracker
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
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

              {/* Wallet Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    MCA Wallet Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Balance</p>
                      <p className={`text-xl font-bold ${wallet?.isLowBalance ? 'text-red-500' : 'text-green-600'}`}>
                        {formatCurrency(wallet?.currentBalance || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Spend</p>
                      <p className="text-xl font-bold">{formatCurrency(wallet?.monthlySpend || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Budget</p>
                      <p className="text-xl font-bold">{formatCurrency(wallet?.monthlyBudget || 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">All-Time Spend</p>
                      <p className="text-xl font-bold">{formatCurrency(wallet?.totalSpentAllTime || 0)}</p>
                    </div>
                  </div>
                  {wallet && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Budget Usage</span>
                        <span>{((wallet.monthlySpend / wallet.monthlyBudget) * 100).toFixed(0)}%</span>
                      </div>
                      <Progress 
                        value={(wallet.monthlySpend / wallet.monthlyBudget) * 100} 
                        className="h-2"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                  <Button onClick={() => setActiveTab('query')}>
                    <Search className="h-4 w-4 mr-2" />
                    New Query
                  </Button>
                  <Button variant="outline" onClick={() => setShowIngestDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Ingest XBRL
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('radar')}>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Profitable Radar
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
                      <SelectItem value="wallet_check">Wallet Status</SelectItem>
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
                        profitableData.result.map((company: ProfitableCompany) => (
                          <TableRow key={company.cin}>
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
                <Shield className="h-5 w-5" />
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
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
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

      {/* Wallet Recharge Dialog */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recharge MCA Wallet</DialogTitle>
            <DialogDescription>
              Add funds to your MCA API wallet.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Amount (₹)</Label>
            <Input 
              type="number"
              value={rechargeAmount} 
              onChange={(e) => setRechargeAmount(e.target.value)}
              placeholder="10000"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRechargeDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => rechargeMutation.mutate(parseFloat(rechargeAmount))}
              disabled={rechargeMutation.isPending || !rechargeAmount}
            >
              {rechargeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <IndianRupee className="h-4 w-4 mr-2" />
              )}
              Recharge
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
