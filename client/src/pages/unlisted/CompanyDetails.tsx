import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Calendar, 
  DollarSign,
  BarChart3,
  ArrowLeft,
  ShoppingCart,
  Store,
  Lock,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { AddToCartButton } from '@/components/UnlistedCart';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

type UnlistedCompany = {
  id: string;
  name: string;
  cin?: string;
  isin?: string;
  sector?: string;
  status: 'active' | 'inactive' | 'delisted';
  listedDate?: string;
  delistingDate?: string;
  probe42CompanyId?: string;
  lastSyncedAt?: string;
  createdAt: string;
};

type CompanyFinancials = {
  id: string;
  companyId: string;
  financialYear: string;
  revenue?: number;
  netProfit?: number;
  ebitda?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  equity?: number;
  cashFlow?: number;
};

type CompanyRatios = {
  id: string;
  companyId: string;
  financialYear: string;
  peRatio?: number;
  pbRatio?: number;
  debtToEquity?: number;
  currentRatio?: number;
  roe?: number;
  roa?: number;
  npm?: number;
  evToEbitda?: number;
};

type PriceHistory = {
  id: string;
  companyId: string;
  date: string;
  price: number;
  quantity?: number;
  source: 'deal' | 'seller_feed' | 'admin_input';
};

export default function CompanyDetails() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  // Fetch company details
  const { data: company, isLoading: isLoadingCompany } = useQuery<UnlistedCompany>({
    queryKey: ['/api/unlisted/companies', id],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${id}`);
      if (!response.ok) throw new Error('Failed to fetch company');
      const result = await response.json();
      return result.data;
    },
  });

  // Fetch financials (available to authenticated users for due diligence)
  const { data: financials, error: financialsError } = useQuery<CompanyFinancials[]>({
    queryKey: ['/api/unlisted/companies', id, 'financials'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${id}/financials`);
      if (!response.ok) {
        if (response.status === 401) throw { status: 401, message: 'Please sign in to view financial data' };
        throw new Error('Failed to fetch financials');
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!id,
    retry: false,
  });

  // Fetch ratios (available to authenticated users for due diligence)
  const { data: ratios, error: ratiosError } = useQuery<CompanyRatios[]>({
    queryKey: ['/api/unlisted/companies', id, 'ratios'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${id}/ratios`);
      if (!response.ok) {
        if (response.status === 401) throw { status: 401, message: 'Please sign in to view ratio data' };
        throw new Error('Failed to fetch ratios');
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!id,
    retry: false,
  });

  // Fetch price history (available to authenticated users for due diligence)
  const { data: priceHistory, error: priceHistoryError } = useQuery<PriceHistory[]>({
    queryKey: ['/api/unlisted/companies', id, 'price-history'],
    queryFn: async () => {
      const response = await fetch(`/api/unlisted/companies/${id}/price-history?limit=50`);
      if (!response.ok) {
        if (response.status === 401) throw { status: 401, message: 'Please sign in to view price history' };
        throw new Error('Failed to fetch price history');
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!id,
    retry: false,
  });

  // Fetch trading eligibility status (determines if user can place orders)
  const { data: eligibilityData } = useQuery<{ success: boolean; data: { eligible: boolean; maxTradeValue: number; reasons?: string[] } }>({
    queryKey: ['/api/unlisted/eligibility/check'],
    retry: false,
  });
  
  // Check if user needs to login
  const financialsErrorData = financialsError as any;
  const isNotLoggedIn = financialsErrorData?.status === 401;
  
  // KYC blocked status - financial data viewable by authenticated users for due diligence
  const isKycBlocked = isNotLoggedIn;
  
  // Trading eligibility (Enhanced KYC + risk acknowledgment required for orders)
  const canTrade = eligibilityData?.data?.eligible === true;
  const eligibilityReasons = eligibilityData?.data?.reasons || [];

  if (isLoadingCompany) {
    return <LoadingState />;
  }

  if (!company) {
    return (
      <EmptyState
        icon={Building2}
        title="Company not found"
        description="The company you're looking for doesn't exist"
      />
    );
  }

  const latestPrice = priceHistory?.[0]?.price;
  const sortedFinancials = [...(financials || [])].sort((a, b) => 
    b.financialYear.localeCompare(a.financialYear)
  );
  const latestFinancials = sortedFinancials[0];
  const latestRatios = ratios?.find(r => r.financialYear === latestFinancials?.financialYear);

  // Prepare chart data
  const financialChartData = sortedFinancials.slice(0, 5).reverse().map(f => ({
    year: f.financialYear,
    revenue: f.revenue ? f.revenue / 10000000 : 0, // Convert to Cr
    netProfit: f.netProfit ? f.netProfit / 10000000 : 0,
    ebitda: f.ebitda ? f.ebitda / 10000000 : 0,
  }));

  const ratioChartData = [...(ratios || [])]
    .sort((a, b) => a.financialYear.localeCompare(b.financialYear))
    .slice(-5)
    .map(r => ({
      year: r.financialYear,
      peRatio: r.peRatio || 0,
      pbRatio: r.pbRatio || 0,
      roe: r.roe || 0,
      debtToEquity: r.debtToEquity || 0,
    }));

  const priceChartData = [...(priceHistory || [])]
    .slice(0, 30)
    .reverse()
    .map(p => ({
      date: format(new Date(p.date), 'MMM yyyy'),
      price: p.price,
    }));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => setLocation('/unlisted/browse')}
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Browse
      </Button>

      {/* Company Header */}
      <Card data-testid="card-company-header">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-8 h-8 text-primary" />
                <CardTitle className="text-2xl md:text-3xl" data-testid="text-company-name">
                  {company.name}
                </CardTitle>
              </div>
              <CardDescription className="space-y-1">
                {company.cin && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">CIN:</span>
                    <span data-testid="text-cin">{company.cin}</span>
                  </div>
                )}
                {company.isin && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">ISIN:</span>
                    <span data-testid="text-isin">{company.isin}</span>
                  </div>
                )}
                {company.sector && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Sector:</span>
                    <Badge variant="outline" data-testid="badge-sector">{company.sector}</Badge>
                  </div>
                )}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2">
              <Badge 
                variant={company.status === 'active' ? 'default' : 'secondary'}
                className="w-fit"
                data-testid="badge-status"
              >
                {company.status}
              </Badge>
              {latestPrice && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Latest Price</div>
                  <div className="text-2xl font-bold" data-testid="text-latest-price">
                    ₹{latestPrice.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Login Required Alert */}
      {isNotLoggedIn && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30" data-testid="alert-login-required">
          <Lock className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-400">Sign In Required</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            <p className="mb-3">
              Please sign in to view detailed company financials, ratios, and price history for your research.
            </p>
            <Button 
              size="sm" 
              onClick={() => setLocation('/auth')}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-sign-in"
            >
              <Lock className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Trading Eligibility Info Banner */}
      {!isNotLoggedIn && !canTrade && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30" data-testid="alert-trading-eligibility">
          <Shield className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">Trading Eligibility Required</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p className="mb-3">
              You can view all company data for research purposes. To place buy/sell orders, SEBI regulations require:
            </p>
            <ul className="text-sm list-disc list-inside space-y-1 mb-3">
              <li>Enhanced KYC verification (Tier 3)</li>
              <li>Risk disclosure acknowledgment</li>
              <li>Accredited Investor status for trades above ₹50 Lakhs</li>
            </ul>
            {eligibilityReasons.length > 0 && (
              <div className="mb-3 p-3 bg-amber-100 dark:bg-amber-900/50 rounded-md">
                <p className="text-sm font-medium mb-2">Pending Requirements:</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  {eligibilityReasons.map((reason: string, index: number) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                size="sm" 
                onClick={() => setLocation('/kyc-dashboard')}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="button-complete-kyc"
              >
                <Lock className="w-4 h-4 mr-2" />
                Complete Verification
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setLocation('/profile?tab=kyc')}
                className="border-amber-600 text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
                data-testid="button-view-kyc-status"
              >
                View Status
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button 
          size="lg" 
          onClick={() => setLocation(`/unlisted/buy?company=${company.id}`)}
          disabled={!canTrade}
          data-testid="button-place-buy-request"
        >
          <ShoppingCart className="w-5 h-5 mr-2" />
          {canTrade ? 'Place Buy Request' : 'Complete Verification to Buy'}
        </Button>
        <AddToCartButton 
          companyId={company.id} 
          companyName={company.name}
          className="h-11"
        />
        <Button 
          size="lg" 
          variant="outline"
          onClick={() => setLocation(`/unlisted/sell?company=${company.id}`)}
          disabled={!canTrade}
          data-testid="button-create-sell-listing"
        >
          <Store className="w-5 h-5 mr-2" />
          {canTrade ? 'Create Sell Listing' : 'Complete Verification to Sell'}
        </Button>
      </div>

      {/* Key Metrics */}
      {latestFinancials && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-metric-revenue">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{((latestFinancials.revenue || 0) / 10000000).toFixed(2)} Cr
              </div>
              <p className="text-xs text-muted-foreground">FY {latestFinancials.financialYear}</p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-net-profit">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{((latestFinancials.netProfit || 0) / 10000000).toFixed(2)} Cr
              </div>
              <p className="text-xs text-muted-foreground">FY {latestFinancials.financialYear}</p>
            </CardContent>
          </Card>

          {latestRatios?.roe != null && (
            <Card data-testid="card-metric-roe">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">ROE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                  {Number(latestRatios.roe).toFixed(2)}%
                  {Number(latestRatios.roe) > 15 ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">FY {latestRatios.financialYear}</p>
              </CardContent>
            </Card>
          )}

          {latestRatios?.peRatio != null && (
            <Card data-testid="card-metric-pe">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">P/E Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Number(latestRatios.peRatio).toFixed(2)}x
                </div>
                <p className="text-xs text-muted-foreground">FY {latestRatios.financialYear}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="financials" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="financials" data-testid="tab-financials">
            <BarChart3 className="w-4 h-4 mr-2" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="ratios" data-testid="tab-ratios">
            <Activity className="w-4 h-4 mr-2" />
            Ratios
          </TabsTrigger>
          <TabsTrigger value="price" data-testid="tab-price">
            <DollarSign className="w-4 h-4 mr-2" />
            Price History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financials" className="space-y-4">
          {isKycBlocked ? (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="w-16 h-16 text-amber-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">KYC Required</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Complete Level 2 KYC verification to access detailed financial statements and analysis.
                </p>
                <Button onClick={() => setLocation('/kyc-dashboard')} data-testid="button-complete-kyc-financials">
                  Complete KYC Verification
                </Button>
              </CardContent>
            </Card>
          ) : financialChartData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Financial Performance Trends</CardTitle>
                  <CardDescription>Revenue, Net Profit, and EBITDA over time (in Crores)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={financialChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                      <Bar dataKey="netProfit" fill="#10b981" name="Net Profit" />
                      <Bar dataKey="ebitda" fill="#f59e0b" name="EBITDA" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Financials</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sortedFinancials.map((f) => (
                      <div key={f.id} className="border-b pb-4 last:border-0" data-testid={`financial-${f.financialYear}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-semibold">FY {f.financialYear}</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Revenue:</span>
                            <div className="font-medium">₹{((f.revenue || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Net Profit:</span>
                            <div className="font-medium">₹{((f.netProfit || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">EBITDA:</span>
                            <div className="font-medium">₹{((f.ebitda || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Assets:</span>
                            <div className="font-medium">₹{((f.totalAssets || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Liabilities:</span>
                            <div className="font-medium">₹{((f.totalLiabilities || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Equity:</span>
                            <div className="font-medium">₹{((f.equity || 0) / 10000000).toFixed(2)} Cr</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={BarChart3}
              title="No financial data"
              description="Financial data will appear here once synced from Credhive"
            />
          )}
        </TabsContent>

        <TabsContent value="ratios" className="space-y-4">
          {isKycBlocked ? (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="w-16 h-16 text-amber-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">KYC Required</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Complete Level 2 KYC verification to access valuation ratios and financial analysis.
                </p>
                <Button onClick={() => setLocation('/kyc-dashboard')} data-testid="button-complete-kyc-ratios">
                  Complete KYC Verification
                </Button>
              </CardContent>
            </Card>
          ) : ratioChartData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Valuation Ratios Trend</CardTitle>
                  <CardDescription>P/E and P/B ratios over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ratioChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="peRatio" stroke="#3b82f6" name="P/E Ratio" />
                      <Line type="monotone" dataKey="pbRatio" stroke="#10b981" name="P/B Ratio" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profitability & Leverage</CardTitle>
                  <CardDescription>ROE and Debt-to-Equity over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ratioChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="roe" stroke="#f59e0b" name="ROE %" />
                      <Line type="monotone" dataKey="debtToEquity" stroke="#ef4444" name="Debt/Equity" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Ratios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...(ratios || [])].sort((a, b) => b.financialYear.localeCompare(a.financialYear)).map((r) => (
                      <div key={r.id} className="border-b pb-4 last:border-0" data-testid={`ratio-${r.financialYear}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <h3 className="font-semibold">FY {r.financialYear}</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {r.peRatio != null && (
                            <div>
                              <span className="text-muted-foreground">P/E:</span>
                              <div className="font-medium">{Number(r.peRatio).toFixed(2)}x</div>
                            </div>
                          )}
                          {r.pbRatio != null && (
                            <div>
                              <span className="text-muted-foreground">P/B:</span>
                              <div className="font-medium">{Number(r.pbRatio).toFixed(2)}x</div>
                            </div>
                          )}
                          {r.roe != null && (
                            <div>
                              <span className="text-muted-foreground">ROE:</span>
                              <div className="font-medium">{Number(r.roe).toFixed(2)}%</div>
                            </div>
                          )}
                          {r.roa != null && (
                            <div>
                              <span className="text-muted-foreground">ROA:</span>
                              <div className="font-medium">{Number(r.roa).toFixed(2)}%</div>
                            </div>
                          )}
                          {r.npm != null && (
                            <div>
                              <span className="text-muted-foreground">NPM:</span>
                              <div className="font-medium">{Number(r.npm).toFixed(2)}%</div>
                            </div>
                          )}
                          {r.debtToEquity != null && (
                            <div>
                              <span className="text-muted-foreground">D/E:</span>
                              <div className="font-medium">{Number(r.debtToEquity).toFixed(2)}</div>
                            </div>
                          )}
                          {r.currentRatio != null && (
                            <div>
                              <span className="text-muted-foreground">Current Ratio:</span>
                              <div className="font-medium">{Number(r.currentRatio).toFixed(2)}</div>
                            </div>
                          )}
                          {r.evToEbitda != null && (
                            <div>
                              <span className="text-muted-foreground">EV/EBITDA:</span>
                              <div className="font-medium">{Number(r.evToEbitda).toFixed(2)}x</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={Activity}
              title="No ratio data"
              description="Ratio data will appear here once synced from Credhive"
            />
          )}
        </TabsContent>

        <TabsContent value="price" className="space-y-4">
          {isKycBlocked ? (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="w-16 h-16 text-amber-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">KYC Required</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Complete Level 2 KYC verification to access price history and market data.
                </p>
                <Button onClick={() => setLocation('/kyc-dashboard')} data-testid="button-complete-kyc-price">
                  Complete KYC Verification
                </Button>
              </CardContent>
            </Card>
          ) : priceChartData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Price Movement</CardTitle>
                  <CardDescription>Historical pricing from deals and seller feeds</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={priceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="price" stroke="#8b5cf6" name="Price (₹)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Price History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {priceHistory?.slice(0, 10).map((p) => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between py-2 border-b last:border-0"
                        data-testid={`price-${p.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{format(new Date(p.date), 'dd MMM yyyy')}</span>
                          {p.source && (
                            <Badge variant="outline" className="text-xs">
                              {p.source.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <div className="font-semibold">
                          ₹{Number(p.price).toLocaleString('en-IN')}
                          {p.quantity && <span className="text-xs text-muted-foreground ml-2">({p.quantity} shares)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState
              icon={DollarSign}
              title="No price data"
              description="Price history will appear here from deals and seller feeds"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
