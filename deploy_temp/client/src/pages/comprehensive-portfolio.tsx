import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { RefreshCw, TrendingUp, TrendingDown, Calendar, PieChart, BarChart3, Database, Wallet, Building, Shield, Landmark } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ComprehensiveHolding {
  symbol: string;
  assetName: string;
  assetType: string;
  assetClass: string;
  quantity?: number;
  units?: number;
  currentPrice?: number;
  marketValue: number;
  investedValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  dataSource: string;
  sourceAccountNumber?: string;
  folio?: string;
  dematAccountNumber?: string;
  metadata?: any;
}

interface ComprehensivePortfolio {
  portfolioId: string;
  userId: string;
  snapshotDate: string;
  totalValue: number;
  totalEquityValue: number;
  totalDebtValue: number;
  totalMutualFundValue: number;
  totalGovernmentSchemeValue: number;
  totalAlternativeValue: number;
  totalCashValue: number;
  epfValue: number;
  ppfValue: number;
  epsValue: number;
  apyValue: number;
  npsValue: number;
  insuranceValue: number;
  holdings: ComprehensiveHolding[];
  assetBreakdown: {
    equities: number;
    mutualFunds: number;
    governmentSchemes: number;
    debt: number;
    alternatives: number;
    cash: number;
    insurance: number;
  };
}

interface PopulateSettings {
  includeGovernmentSchemes: boolean;
  includeMutualFunds: boolean;
  includeEquities: boolean;
  includeInsurance: boolean;
}

export default function ComprehensivePortfolioPage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [populateSettings, setPopulateSettings] = useState<PopulateSettings>({
    includeGovernmentSchemes: true,
    includeMutualFunds: true,
    includeEquities: true,
    includeInsurance: true
  });

  const { user } = useAuth();
  const userId = user?.id || '';
  const { data: portfolios } = useQuery({
    queryKey: ['/api/portfolios', userId],
    enabled: !!userId,
  });
  const portfolioId = (portfolios && Array.isArray(portfolios) && portfolios.length > 0) ? portfolios[0]?.id : '';

  // Populate comprehensive portfolio
  const populatePortfolioMutation = useMutation({
    mutationFn: async (settings: PopulateSettings & { date: string }) => {
      const response = await fetch("/api/portfolios/comprehensive/populate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          ...settings
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comprehensive-portfolio"] });
    }
  });

  // Fetch comprehensive portfolio data
  const { data: portfolioData, isLoading, error } = useQuery<ComprehensivePortfolio>({
    queryKey: ["comprehensive-portfolio", userId, selectedDate],
    queryFn: async () => {
      // First try to get existing data, if not found, populate it
      try {
        if (!portfolioId) return null;
        const response = await fetch(`/api/portfolios/${portfolioId}/comprehensive/${selectedDate}`);
        if (!response.ok) {
          if (response.status === 404) {
            // Portfolio not found, trigger population
            await populatePortfolioMutation.mutateAsync({
              ...populateSettings,
              date: selectedDate
            });
            // Retry fetching
            const retryResponse = await fetch(`/api/portfolios/${portfolioId}/comprehensive/${selectedDate}`);
            const retryData = await retryResponse.json();
            return retryData.data;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.data;
      } catch (error: any) {
        console.error('Error fetching comprehensive portfolio:', error);
        throw error;
      }
    },
    enabled: !!userId && !!selectedDate
  });

  const handlePopulatePortfolio = () => {
    populatePortfolioMutation.mutate({
      ...populateSettings,
      date: selectedDate
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const getDataSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'cams': return <Database className="h-4 w-4" />;
      case 'kfintech': return <Wallet className="h-4 w-4" />;
      case 'nsdl':
      case 'cdsl': return <Building className="h-4 w-4" />;
      case 'epf':
      case 'ppf':
      case 'eps': return <Landmark className="h-4 w-4" />;
      case 'insurance': return <Shield className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const groupedHoldings = Array.isArray(portfolioData?.holdings) 
    ? portfolioData.holdings.reduce((acc, holding) => {
        const source = holding.dataSource;
        if (!acc[source]) acc[source] = [];
        acc[source].push(holding);
        return acc;
      }, {} as Record<string, ComprehensiveHolding[]>) 
    : {};

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="comprehensive-portfolio-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="title-comprehensive-portfolio">Comprehensive Portfolio</h1>
          <p className="text-muted-foreground">
            Unified view of all your holdings across mutual funds, equities, government schemes, and insurance
          </p>
        </div>
        <Button
          onClick={handlePopulatePortfolio}
          disabled={populatePortfolioMutation.isPending}
          data-testid="button-refresh-portfolio"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${populatePortfolioMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Portfolio
        </Button>
      </div>

      {/* Date Selection & Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Settings</CardTitle>
          <CardDescription>Select date and data sources to include</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="portfolio-date">Portfolio Date</Label>
              <Input
                id="portfolio-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-portfolio-date"
              />
            </div>
            <div className="space-y-4">
              <Label>Data Sources</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={populateSettings.includeMutualFunds}
                    onCheckedChange={(checked) => 
                      setPopulateSettings(prev => ({ ...prev, includeMutualFunds: checked }))
                    }
                    data-testid="switch-mutual-funds"
                  />
                  <Label>Mutual Funds</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={populateSettings.includeEquities}
                    onCheckedChange={(checked) => 
                      setPopulateSettings(prev => ({ ...prev, includeEquities: checked }))
                    }
                    data-testid="switch-equities"
                  />
                  <Label>Equities</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={populateSettings.includeGovernmentSchemes}
                    onCheckedChange={(checked) => 
                      setPopulateSettings(prev => ({ ...prev, includeGovernmentSchemes: checked }))
                    }
                    data-testid="switch-government-schemes"
                  />
                  <Label>Govt. Schemes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={populateSettings.includeInsurance}
                    onCheckedChange={(checked) => 
                      setPopulateSettings(prev => ({ ...prev, includeInsurance: checked }))
                    }
                    data-testid="switch-insurance"
                  />
                  <Label>Insurance</Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert>
          <AlertDescription>
            Error loading portfolio: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {portfolioData && (
        <>
          {/* Portfolio Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-portfolio-value">
                  {formatCurrency(portfolioData.totalValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  As of {new Date(selectedDate).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Mutual Funds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-mutual-funds-value">
                  {formatCurrency(portfolioData.totalMutualFundValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {((portfolioData.totalMutualFundValue / portfolioData.totalValue) * 100).toFixed(1)}% of portfolio
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Government Schemes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-govt-schemes-value">
                  {formatCurrency(portfolioData.totalGovernmentSchemeValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  EPF: {formatCurrency(portfolioData.epfValue)} | PPF: {formatCurrency(portfolioData.ppfValue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Holdings Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-holdings-count">
                  {portfolioData.holdings.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {Object.keys(groupedHoldings).length} data sources
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Holdings by Data Source */}
          <Tabs defaultValue="all" className="space-y-4">
            <ScrollableTabsList>
              <TabsTrigger value="all" data-testid="tab-all-holdings">All Holdings</TabsTrigger>
              {Object.keys(groupedHoldings).map(source => (
                <TabsTrigger key={source} value={source} data-testid={`tab-${source}`}>
                  {source.toUpperCase()} ({groupedHoldings[source].length})
                </TabsTrigger>
              ))}
            </ScrollableTabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Holdings</CardTitle>
                  <CardDescription>Complete list of holdings across all data sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolioData.holdings.map((holding, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`holding-${index}`}>
                        <div className="flex items-center space-x-3">
                          {getDataSourceIcon(holding.dataSource)}
                          <div>
                            <div className="font-medium">{holding.assetName}</div>
                            <div className="text-sm text-muted-foreground">
                              {holding.symbol} • {holding.assetType}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(holding.marketValue)}</div>
                          {holding.gainLossPercent && (
                            <div className={`text-sm flex items-center ${holding.gainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {holding.gainLossPercent >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {formatPercent(holding.gainLossPercent)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {Object.entries(groupedHoldings).map(([source, holdings]) => (
              <TabsContent key={source} value={source}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      {getDataSourceIcon(source)}
                      <span>{source.toUpperCase()} Holdings</span>
                    </CardTitle>
                    <CardDescription>
                      {holdings.length} holdings from {source}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {holdings.map((holding, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`${source}-holding-${index}`}>
                          <div>
                            <div className="font-medium">{holding.assetName}</div>
                            <div className="text-sm text-muted-foreground">
                              {holding.symbol} • {holding.assetClass}
                              {holding.folio && ` • Folio: ${holding.folio}`}
                              {holding.sourceAccountNumber && ` • Account: ${holding.sourceAccountNumber}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(holding.marketValue)}</div>
                            {holding.units && (
                              <div className="text-sm text-muted-foreground">
                                {holding.units.toFixed(3)} units
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}