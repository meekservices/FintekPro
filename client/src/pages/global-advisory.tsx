import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  Globe, 
  DollarSign, 
  PieChart, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
  RefreshCw,
  BarChart3,
  Shield,
  FileText
} from "lucide-react";

interface GlobalRecommendation {
  symbol: string;
  name: string;
  assetClass: string;
  market: string;
  exchange: string;
  currency: string;
  recommendation: string;
  fintekproRating: number;
  confidenceScore: number;
  riskScore: number;
  currentPrice: number;
  currentPriceInr: number;
  targetPrice: number;
  targetPriceInr: number;
  expectedReturn: number;
  timeHorizon: string;
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  taxImplications: {
    stcgRate: number;
    ltcgRate: number;
    dtaaRate?: number;
    taxTip: string;
  };
  lrsConsiderations: string;
  suitabilityScore: number;
}

interface Market {
  code: string;
  name: string;
  exchanges: string[];
  currency: string;
  isEnabled: boolean;
  dtaaRate: number;
}

interface LrsStatus {
  financialYear: string;
  lrsLimitUsd: number;
  totalRemittedUsd: number;
  remainingLimitUsd: number;
  transactionCount: number;
  fatcaStatus: string;
  w8benStatus: string;
  taxImplications: {
    tcsRate: number;
    tcsThreshold: number;
    note: string;
  };
}

const getRecommendationBadge = (rec: string) => {
  const colors: Record<string, string> = {
    'strong_buy': 'bg-green-600 text-white',
    'buy': 'bg-green-500 text-white',
    'hold': 'bg-yellow-500 text-white',
    'sell': 'bg-red-500 text-white',
    'strong_sell': 'bg-red-600 text-white',
  };
  return colors[rec] || 'bg-muted text-foreground';
};

const getRecommendationIcon = (rec: string) => {
  if (rec.includes('buy')) return <ArrowUpRight className="h-4 w-4" />;
  if (rec.includes('sell')) return <ArrowDownRight className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
};

const formatCurrency = (value: number, currency: string = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? 'text-yellow-400' : 'text-muted-foreground'}>
          ★
        </span>
      ))}
    </div>
  );
};

function RecommendationCard({ rec }: { rec: GlobalRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {rec.symbol}
              <Badge variant="outline" className="text-xs">{rec.exchange}</Badge>
            </CardTitle>
            <CardDescription className="line-clamp-1">{rec.name}</CardDescription>
          </div>
          <Badge className={getRecommendationBadge(rec.recommendation)}>
            {getRecommendationIcon(rec.recommendation)}
            <span className="ml-1">{rec.recommendation.replace('_', ' ').toUpperCase()}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Current Price</p>
            <p className="font-semibold">{formatCurrency(rec.currentPrice, rec.currency)}</p>
            <p className="text-xs text-muted-foreground">₹{rec.currentPriceInr.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Target Price</p>
            <p className="font-semibold text-green-600">{formatCurrency(rec.targetPrice, rec.currency)}</p>
            <p className="text-xs text-muted-foreground">₹{rec.targetPriceInr.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Expected Return</p>
            <p className={`font-semibold ${rec.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {rec.expectedReturn >= 0 ? '+' : ''}{rec.expectedReturn.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Time Horizon</p>
            <p className="font-medium">{rec.timeHorizon.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rating</p>
            <StarRating rating={rec.fintekproRating} />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Confidence</p>
            <Progress value={rec.confidenceScore} className="h-2" />
            <p className="text-xs text-right">{rec.confidenceScore.toFixed(0)}%</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-1">Risk</p>
            <Progress value={rec.riskScore} className="h-2 bg-red-100" />
            <p className="text-xs text-right">{rec.riskScore.toFixed(0)}%</p>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <p className="text-sm font-medium mb-1">Analysis</p>
              <p className="text-sm text-muted-foreground">{rec.rationale}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Key Factors</p>
              <div className="flex flex-wrap gap-1">
                {rec.keyFactors.map((factor, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{factor}</Badge>
                ))}
              </div>
            </div>
            {rec.riskFactors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1 text-red-600">Risk Factors</p>
                <div className="flex flex-wrap gap-1">
                  {rec.riskFactors.map((factor, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{factor}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium mb-1 flex items-center gap-1">
                <FileText className="h-4 w-4" /> Tax Implications
              </p>
              <p className="text-xs text-muted-foreground">
                STCG: {rec.taxImplications.stcgRate}% | LTCG: {rec.taxImplications.ltcgRate}%
                {rec.taxImplications.dtaaRate && ` | DTAA: ${rec.taxImplications.dtaaRate}%`}
              </p>
              <p className="text-xs text-blue-600 mt-1">{rec.taxImplications.taxTip}</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm font-medium mb-1 flex items-center gap-1">
                <Shield className="h-4 w-4" /> LRS Considerations
              </p>
              <p className="text-xs text-muted-foreground">{rec.lrsConsiderations}</p>
            </div>
          </div>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show More Details'}
        </Button>
      </CardContent>
    </Card>
  );
}

function GlobalAdvisoryPage() {
  const [riskLevel, setRiskLevel] = useState<string>('moderate');
  const [activeTab, setActiveTab] = useState('stocks');

  const { data: marketsData, isLoading: marketsLoading } = useQuery<{ success: boolean; data: Market[] }>({
    queryKey: ['/api/global-advisory/advisory/markets'],
  });

  const { data: lrsData, isLoading: lrsLoading } = useQuery<{ success: boolean; data: LrsStatus }>({
    queryKey: ['/api/global-advisory/lrs/status'],
  });

  const { data: stocksData, isLoading: stocksLoading, refetch: refetchStocks } = useQuery<{ success: boolean; data: GlobalRecommendation[] }>({
    queryKey: ['/api/global-advisory/advisory/stocks', { riskLevel, maxResults: 10 }],
    enabled: activeTab === 'stocks',
  });

  const { data: etfsData, isLoading: etfsLoading, refetch: refetchEtfs } = useQuery<{ success: boolean; data: GlobalRecommendation[] }>({
    queryKey: ['/api/global-advisory/advisory/etfs', { riskLevel, maxResults: 10 }],
    enabled: activeTab === 'etfs',
  });

  const { data: bondsData, isLoading: bondsLoading, refetch: refetchBonds } = useQuery<{ success: boolean; data: GlobalRecommendation[] }>({
    queryKey: ['/api/global-advisory/advisory/bonds', { riskLevel, maxResults: 10 }],
    enabled: activeTab === 'bonds',
  });

  const markets = marketsData?.data || [];
  const lrsStatus = lrsData?.data;
  const stocks = stocksData?.data || [];
  const etfs = etfsData?.data || [];
  const bonds = bondsData?.data || [];

  const lrsUtilizationPercent = lrsStatus 
    ? (lrsStatus.totalRemittedUsd / lrsStatus.lrsLimitUsd) * 100 
    : 0;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-blue-600" />
            Global Investment Advisory
          </h1>
          <p className="text-muted-foreground">
            AI-powered recommendations for global stocks, ETFs, bonds, and mutual funds
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={riskLevel} onValueChange={setRiskLevel}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="aggressive">Aggressive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              LRS Limit Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lrsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : lrsStatus ? (
              <div>
                <p className="text-2xl font-bold">${(lrsStatus.remainingLimitUsd / 1000).toFixed(0)}K</p>
                <p className="text-xs text-muted-foreground">Remaining of $250K</p>
                <Progress value={lrsUtilizationPercent} className="h-2 mt-2" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              FATCA Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lrsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div>
                <Badge variant={lrsStatus?.fatcaStatus === 'compliant' ? 'default' : 'secondary'}>
                  {lrsStatus?.fatcaStatus || 'Pending'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">W-8BEN: {lrsStatus?.w8benStatus || 'Not filed'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-purple-600" />
              Available Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {marketsLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="flex flex-wrap gap-1">
                {markets.slice(0, 6).map((market) => (
                  <Badge key={market.code} variant="outline" className="text-xs">
                    {market.code}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              TCS Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {lrsStatus?.taxImplications?.tcsRate || 20}% TCS on remittances
            </p>
            <p className="text-xs text-muted-foreground">
              Above ₹{((lrsStatus?.taxImplications?.tcsThreshold || 700000) / 100000).toFixed(0)} lakhs/FY
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="stocks" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Stocks
          </TabsTrigger>
          <TabsTrigger value="etfs" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            ETFs
          </TabsTrigger>
          <TabsTrigger value="bonds" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Bonds
          </TabsTrigger>
          <TabsTrigger value="rebalancing" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Rebalancing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stocks">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">US Stock Recommendations</h2>
            <Button variant="outline" size="sm" onClick={() => refetchStocks()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          {stocksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : stocks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stocks.map((rec) => (
                <RecommendationCard key={rec.symbol} rec={rec} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No stock recommendations available. Try refreshing.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="etfs">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Global ETF Recommendations</h2>
            <Button variant="outline" size="sm" onClick={() => refetchEtfs()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          {etfsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : etfs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {etfs.map((rec) => (
                <RecommendationCard key={rec.symbol} rec={rec} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No ETF recommendations available. Try refreshing.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bonds">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Global Bond Recommendations</h2>
            <Button variant="outline" size="sm" onClick={() => refetchBonds()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          {bondsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
            </div>
          ) : bonds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bonds.map((rec) => (
                <RecommendationCard key={rec.symbol} rec={rec} />
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No bond recommendations available. Try refreshing.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rebalancing">
          <Card className="p-8">
            <div className="text-center">
              <PieChart className="h-16 w-16 mx-auto text-blue-600 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Portfolio Rebalancing</h2>
              <p className="text-muted-foreground mb-6">
                Add your global holdings to get AI-powered rebalancing recommendations with buy/hold/sell signals
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-6">
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">1. Add Holdings</h3>
                  <p className="text-sm text-muted-foreground">
                    Enter your global stock, ETF, and bond positions
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">2. Set Targets</h3>
                  <p className="text-sm text-muted-foreground">
                    Define your target allocation for each asset class
                  </p>
                </Card>
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">3. Get Signals</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive buy/hold/sell recommendations with LRS compliance
                  </p>
                </Card>
              </div>
              <Button size="lg" className="gap-2">
                <PieChart className="h-5 w-5" />
                Start Rebalancing Analysis
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Investment Disclaimer
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                These recommendations are for informational purposes only and do not constitute investment advice. 
                Past performance is not indicative of future results. Investments in global markets involve currency risk, 
                regulatory risk, and market volatility. Please consult with a SEBI-registered investment advisor before 
                making investment decisions. LRS remittances are subject to RBI guidelines and TCS provisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GlobalAdvisoryPage;
