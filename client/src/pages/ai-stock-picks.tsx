import { AIAdvisoryDisclosure } from "@/components/regulatory/AIAdvisoryDisclosure";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Target, 
  Shield as LucideShield, 
  Clock, 
  BarChart3, 
  Brain,
  RefreshCcw,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  IndianRupee,
  Percent,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface StockRecommendation {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  marketCap: string;
  currentPrice: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  fintekproRating: number;
  confidence: number;
  riskScore: number;
  expectedReturn: number;
  timeHorizon: string;
  timeHorizonDays: number;
  fundamentals: {
    peRatio?: number;
    pbRatio?: number;
    roe?: number;
    roce?: number;
    eps?: number;
    dividendYield?: number;
  };
  technicals: {
    rsi: number;
    macd: string;
    movingAvg50: number;
    movingAvg200: number;
    weekHigh52: number;
    weekLow52: number;
    volumeTrend: string;
  };
  returns: {
    returns1M?: number;
    returns3M?: number;
    returns6M?: number;
    returns1Y?: number;
  };
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  taxImplications: {
    holdingPeriod: string;
    stcgRate: number;
    ltcgRate: number;
    ltcgExemption: number;
    taxTip: string;
  };
  generatedAt: string;
}

interface FiltersData {
  sectors: string[];
  marketCaps: string[];
  riskLevels: string[];
  timeHorizons: string[];
}

export default function AIStockPicks() {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedMarketCap, setSelectedMarketCap] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState("moderate");
  const [timeHorizon, setTimeHorizon] = useState("medium_term");
  const [investmentAmount, setInvestmentAmount] = useState([100000]);
  const [includeAI, setIncludeAI] = useState(true);
  const [selectedStock, setSelectedStock] = useState<StockRecommendation | null>(null);

  const { data: filtersData } = useQuery<{ success: boolean; sectors: string[]; marketCaps: string[]; riskLevels: string[]; timeHorizons: string[] }>({
    queryKey: ['/api/ai-stock-recommendations/filters']
  });

  const generateMutation = useMutation({
    mutationFn: async (filters: any) => {
      return apiRequest('/api/ai-stock-recommendations/generate', {
        method: 'POST',
        body: JSON.stringify(filters),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const { data: quickRecs, isLoading: quickLoading } = useQuery<{ success: boolean; recommendations: StockRecommendation[] }>({
    queryKey: ['/api/ai-stock-recommendations/quick']
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      sectors: selectedSectors.length > 0 ? selectedSectors : undefined,
      marketCap: selectedMarketCap.length > 0 ? selectedMarketCap : undefined,
      riskLevel,
      timeHorizon,
      investmentAmount: investmentAmount[0],
      includeAIAnalysis: includeAI,
      maxResults: 10
    });
  };

  const recommendations = generateMutation.data?.recommendations || quickRecs?.recommendations || [];

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'strong_buy': return 'bg-green-600 text-white';
      case 'buy': return 'bg-green-500 text-white';
      case 'hold': return 'bg-yellow-500 text-black dark:text-black';
      case 'sell': return 'bg-red-500 text-white';
      case 'strong_sell': return 'bg-red-700 text-white';
      default: return 'bg-muted text-foreground';
    }
  };

  const getSignalText = (signal: string) => {
    switch (signal) {
      case 'strong_buy': return 'Strong Buy';
      case 'buy': return 'Buy';
      case 'hold': return 'Hold';
      case 'sell': return 'Sell';
      case 'strong_sell': return 'Strong Sell';
      default: return signal;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5" data-testid={`rating-stars-${rating}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="page-title">
            <Brain className="h-8 w-8 text-primary" />
            AI Stock Picks
          </h1>
          <p className="text-muted-foreground mt-1">
            Intelligent stock recommendations powered by FintekPro AI
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Gemini AI Powered
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Risk Level</Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger data-testid="select-risk-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                  <SelectItem value="very_aggressive">Very Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time Horizon</Label>
              <Select value={timeHorizon} onValueChange={setTimeHorizon}>
                <SelectTrigger data-testid="select-time-horizon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="intraday">Intraday</SelectItem>
                  <SelectItem value="short_term">Short Term (1-3 months)</SelectItem>
                  <SelectItem value="medium_term">Medium Term (3-12 months)</SelectItem>
                  <SelectItem value="long_term">Long Term (1+ year)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sector</Label>
              <Select 
                value={selectedSectors[0] || "all"} 
                onValueChange={(v) => setSelectedSectors(v === "all" ? [] : [v])}
              >
                <SelectTrigger data-testid="select-sector">
                  <SelectValue placeholder="All Sectors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {filtersData?.sectors?.map((sector) => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Market Cap</Label>
              <Select 
                value={selectedMarketCap[0] || "all"} 
                onValueChange={(v) => setSelectedMarketCap(v === "all" ? [] : [v])}
              >
                <SelectTrigger data-testid="select-market-cap">
                  <SelectValue placeholder="All Market Caps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Market Caps</SelectItem>
                  <SelectItem value="Large Cap">Large Cap</SelectItem>
                  <SelectItem value="Mid Cap">Mid Cap</SelectItem>
                  <SelectItem value="Small Cap">Small Cap</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Investment Amount: {formatCurrency(investmentAmount[0])}</Label>
              <Slider
                value={investmentAmount}
                onValueChange={setInvestmentAmount}
                min={10000}
                max={1000000}
                step={10000}
                data-testid="slider-investment"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="ai-toggle">AI Analysis</Label>
              <Switch 
                id="ai-toggle" 
                checked={includeAI} 
                onCheckedChange={setIncludeAI}
                data-testid="switch-ai-analysis"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              data-testid="button-generate"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Picks
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {(generateMutation.isPending || quickLoading) && (
            <Card>
              <CardContent className="py-12 text-center">
                <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing market data with AI...</p>
              </CardContent>
            </Card>
          )}

          {!generateMutation.isPending && !quickLoading && recommendations.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Recommendations Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Configure your preferences and click "Generate Picks" to get AI-powered stock recommendations.
                </p>
              </CardContent>
            </Card>
          )}

          {recommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((stock) => (
                <Card 
                  key={stock.id} 
                  className={`cursor-pointer transition-all hover:shadow-lg ${selectedStock?.id === stock.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedStock(stock)}
                  data-testid={`stock-card-${stock.symbol}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {stock.symbol}
                          <Badge className={getSignalColor(stock.signal)}>
                            {getSignalText(stock.signal)}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="line-clamp-1">
                          {stock.companyName}
                        </CardDescription>
                      </div>
                      {renderStars(stock.fintekproRating)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="font-semibold">{formatCurrency(stock.currentPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="font-semibold text-green-600">{formatCurrency(stock.targetPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Stop Loss</p>
                        <p className="font-semibold text-red-600">{formatCurrency(stock.stopLoss)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Expected Return</span>
                      <span className={`font-medium ${Number(stock.expectedReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(stock.expectedReturn ?? 0) >= 0 ? '+' : ''}{Number(stock.expectedReturn ?? 0)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Confidence</span>
                      <div className="flex items-center gap-2 w-32">
                        <Progress value={Number(stock.confidence ?? 0)} className="h-2" />
                        <span className="text-xs font-medium">{Number(stock.confidence ?? 0)}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {stock.sector}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {stock.marketCap}
                      </Badge>
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stock.timeHorizon.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedStock && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {selectedStock.symbol} - Detailed Analysis
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStock(null)}>
                    Close
                  </Button>
                </div>
                <CardDescription>{selectedStock.companyName}</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
                    <TabsTrigger value="technicals">Technicals</TabsTrigger>
                    <TabsTrigger value="tax">Tax Impact</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4 mt-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        AI Rationale
                      </h4>
                      <p className="text-sm text-muted-foreground">{selectedStock.rationale}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Key Factors
                        </h4>
                        <ul className="space-y-1">
                          {selectedStock.keyFactors.map((factor, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-green-600" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          Risk Factors
                        </h4>
                        <ul className="space-y-1">
                          {selectedStock.riskFactors.map((risk, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 text-amber-600" />
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Entry Price</p>
                        <p className="font-semibold">{formatCurrency(selectedStock.entryPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Target Price</p>
                        <p className="font-semibold text-green-600">{formatCurrency(selectedStock.targetPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Stop Loss</p>
                        <p className="font-semibold text-red-600">{formatCurrency(selectedStock.stopLoss)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                        <p className="font-semibold">{selectedStock.riskScore}/10</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="fundamentals" className="mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">P/E Ratio</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.peRatio?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">P/B Ratio</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.pbRatio?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">ROE</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.roe?.toFixed(1) || 'N/A'}%</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">ROCE</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.roce?.toFixed(1) || 'N/A'}%</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">EPS</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.eps?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Dividend Yield</p>
                        <p className="text-xl font-bold">{selectedStock.fundamentals.dividendYield?.toFixed(2) || 'N/A'}%</p>
                      </div>
                    </div>

                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold mb-2">Historical Returns</h4>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">1 Month</p>
                          <p className={`font-semibold ${(selectedStock.returns.returns1M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(selectedStock.returns.returns1M)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">3 Months</p>
                          <p className={`font-semibold ${(selectedStock.returns.returns3M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(selectedStock.returns.returns3M)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">6 Months</p>
                          <p className={`font-semibold ${(selectedStock.returns.returns6M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(selectedStock.returns.returns6M)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">1 Year</p>
                          <p className={`font-semibold ${(selectedStock.returns.returns1Y || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercent(selectedStock.returns.returns1Y)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="technicals" className="mt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">RSI</p>
                        <p className={`text-xl font-bold ${
                          selectedStock.technicals.rsi > 70 ? 'text-red-600' : 
                          selectedStock.technicals.rsi < 30 ? 'text-green-600' : ''
                        }`}>
                          {selectedStock.technicals.rsi.toFixed(0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedStock.technicals.rsi > 70 ? 'Overbought' : 
                           selectedStock.technicals.rsi < 30 ? 'Oversold' : 'Neutral'}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">MACD</p>
                        <p className={`text-xl font-bold ${
                          selectedStock.technicals.macd === 'Bullish' ? 'text-green-600' : 
                          selectedStock.technicals.macd === 'Bearish' ? 'text-red-600' : ''
                        }`}>
                          {selectedStock.technicals.macd}
                        </p>
                      </div>
                      <div className="p-4 border rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Volume Trend</p>
                        <p className="text-xl font-bold">{selectedStock.technicals.volumeTrend}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">Moving Averages</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">50 DMA</span>
                            <span className="font-medium">{formatCurrency(selectedStock.technicals.movingAvg50)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">200 DMA</span>
                            <span className="font-medium">{formatCurrency(selectedStock.technicals.movingAvg200)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-2">52 Week Range</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">High</span>
                            <span className="font-medium text-green-600">{formatCurrency(selectedStock.technicals.weekHigh52)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Low</span>
                            <span className="font-medium text-red-600">{formatCurrency(selectedStock.technicals.weekLow52)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="tax" className="mt-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Budget 2024 Tax Implications
                      </h4>
                      <p className="text-sm">{selectedStock.taxImplications.taxTip}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-3">Short-Term Capital Gains (STCG)</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Holding Period</span>
                            <span className="font-medium">≤ 12 months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tax Rate</span>
                            <span className="font-medium text-red-600">{selectedStock.taxImplications.stcgRate}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-semibold mb-3">Long-Term Capital Gains (LTCG)</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Holding Period</span>
                            <span className="font-medium">&gt; 12 months</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Tax Rate</span>
                            <span className="font-medium text-green-600">{selectedStock.taxImplications.ltcgRate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Exemption</span>
                            <span className="font-medium">{formatCurrency(selectedStock.taxImplications.ltcgExemption)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
