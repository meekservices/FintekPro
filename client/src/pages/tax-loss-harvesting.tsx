import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  TrendingDown, 
  ArrowRight, 
  DollarSign, 
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowUpDown,
  Lightbulb,
  Calculator
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface LossPosition {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  unrealizedLoss: number;
  lossPercent: number;
  holdingPeriod: 'short_term' | 'long_term';
  sector: string;
}

interface SwapSuggestion {
  sellSymbol: string;
  sellName: string;
  buySymbol: string;
  buyName: string;
  taxSavings: number;
  correlation: number;
  reason: string;
}

const mockLossPositions: LossPosition[] = [
  { id: '1', symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', quantity: 150, buyPrice: 520, currentPrice: 450, unrealizedLoss: -10500, lossPercent: -13.5, holdingPeriod: 'short_term', sector: 'Auto' },
  { id: '2', symbol: 'TATASTEEL', name: 'Tata Steel Ltd', quantity: 200, buyPrice: 135, currentPrice: 115, unrealizedLoss: -4000, lossPercent: -14.8, holdingPeriod: 'long_term', sector: 'Metals' },
  { id: '3', symbol: 'BHARTIARTL', name: 'Bharti Airtel', quantity: 50, buyPrice: 850, currentPrice: 780, unrealizedLoss: -3500, lossPercent: -8.2, holdingPeriod: 'short_term', sector: 'Telecom' },
  { id: '4', symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', quantity: 80, buyPrice: 980, currentPrice: 920, unrealizedLoss: -4800, lossPercent: -6.1, holdingPeriod: 'long_term', sector: 'Banking' },
];

const mockSwapSuggestions: SwapSuggestion[] = [
  { sellSymbol: 'TATAMOTORS', sellName: 'Tata Motors', buySymbol: 'MARUTI', buyName: 'Maruti Suzuki', taxSavings: 3150, correlation: 0.85, reason: 'Similar sector exposure with stronger fundamentals' },
  { sellSymbol: 'TATASTEEL', sellName: 'Tata Steel', buySymbol: 'JSWSTEEL', buyName: 'JSW Steel', taxSavings: 400, correlation: 0.92, reason: 'High correlation, maintains metals exposure' },
  { sellSymbol: 'BHARTIARTL', sellName: 'Bharti Airtel', buySymbol: 'RELIANCE', buyName: 'Reliance (Jio)', taxSavings: 1050, correlation: 0.78, reason: 'Telecom exposure via diversified conglomerate' },
];

export default function TaxLossHarvesting() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const totalUnrealizedLoss = mockLossPositions.reduce((sum, p) => sum + p.unrealizedLoss, 0);
  const shortTermLosses = mockLossPositions.filter(p => p.holdingPeriod === 'short_term').reduce((sum, p) => sum + p.unrealizedLoss, 0);
  const longTermLosses = mockLossPositions.filter(p => p.holdingPeriod === 'long_term').reduce((sum, p) => sum + p.unrealizedLoss, 0);
  
  const potentialTaxSavings = useMemo(() => {
    const shortTermRate = 0.30;
    const longTermRate = 0.10;
    return Math.abs(shortTermLosses * shortTermRate) + Math.abs(longTermLosses * longTermRate);
  }, [shortTermLosses, longTermLosses]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setShowResults(true);
    setIsAnalyzing(false);
    toast({
      title: "Analysis Complete",
      description: "Found 3 tax-loss harvesting opportunities",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center">
          <CardContent className="pt-6">
            <TrendingDown className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to access tax loss harvesting tools.</p>
            <Link href="/auth">
              <Button data-testid="tlh-login-btn">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6" data-testid="tax-loss-harvesting-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            Tax Loss Harvesting AI
          </h1>
          <p className="text-muted-foreground mt-1">
            Identify opportunities to offset capital gains with strategic losses
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-4 py-2">
          FY 2024-25
        </Badge>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">How it works</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Tax loss harvesting involves selling securities at a loss to offset capital gains taxes. 
          Our AI suggests similar investments to maintain your portfolio allocation while capturing the tax benefit.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Unrealized Loss</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {formatCurrency(totalUnrealizedLoss)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Short-Term Losses</p>
                <p className="text-2xl font-bold">{formatCurrency(shortTermLosses)}</p>
                <p className="text-xs text-muted-foreground">30% tax rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Long-Term Losses</p>
                <p className="text-2xl font-bold">{formatCurrency(longTermLosses)}</p>
                <p className="text-xs text-muted-foreground">10% tax rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Potential Tax Savings</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(potentialTaxSavings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="positions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="positions" data-testid="positions-tab">
            <TrendingDown className="h-4 w-4 mr-2" />
            Loss Positions
          </TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="suggestions-tab">
            <Lightbulb className="h-4 w-4 mr-2" />
            AI Swap Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Positions with Unrealized Losses</CardTitle>
              <CardDescription>Select positions to analyze for tax-loss harvesting opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockLossPositions.map((position) => (
                  <div 
                    key={position.id}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg hover:bg-muted transition-colors"
                    data-testid={`loss-position-${position.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={selectedPositions.includes(position.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPositions([...selectedPositions, position.id]);
                          } else {
                            setSelectedPositions(selectedPositions.filter(id => id !== position.id));
                          }
                        }}
                        data-testid={`select-position-${position.id}`}
                      />
                      <div>
                        <p className="font-medium">{position.symbol}</p>
                        <p className="text-sm text-muted-foreground">{position.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Quantity</p>
                        <p className="font-medium">{position.quantity}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Buy Price</p>
                        <p className="font-medium">{formatCurrency(position.buyPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Current</p>
                        <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Loss</p>
                        <p className="font-bold text-red-600">{formatCurrency(position.unrealizedLoss)}</p>
                        <p className="text-xs text-red-500">({position.lossPercent.toFixed(1)}%)</p>
                      </div>
                      <Badge variant={position.holdingPeriod === 'short_term' ? 'destructive' : 'secondary'}>
                        {position.holdingPeriod === 'short_term' ? 'STCG' : 'LTCG'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center mt-6">
                <Button 
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || selectedPositions.length === 0}
                  className="px-8"
                  data-testid="analyze-tlh-btn"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Analyze {selectedPositions.length > 0 ? `${selectedPositions.length} Positions` : 'Selected'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          {showResults ? (
            <div className="space-y-4">
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <Lightbulb className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-200">AI Analysis Complete</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Found {mockSwapSuggestions.length} tax-efficient swap opportunities that maintain your portfolio exposure.
                </AlertDescription>
              </Alert>

              {mockSwapSuggestions.map((suggestion, idx) => (
                <Card key={idx} data-testid={`swap-suggestion-${idx}`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                          <p className="text-xs text-muted-foreground">SELL</p>
                          <p className="font-bold text-red-600">{suggestion.sellSymbol}</p>
                          <p className="text-xs text-muted-foreground">{suggestion.sellName}</p>
                        </div>
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                        <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <p className="text-xs text-muted-foreground">BUY</p>
                          <p className="font-bold text-green-600">{suggestion.buySymbol}</p>
                          <p className="text-xs text-muted-foreground">{suggestion.buyName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Correlation</p>
                          <p className="font-bold">{(suggestion.correlation * 100).toFixed(0)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Tax Savings</p>
                          <p className="font-bold text-green-600">{formatCurrency(suggestion.taxSavings)}</p>
                        </div>
                        <Button data-testid={`execute-swap-${idx}`}>
                          Execute Swap
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 p-3 bg-muted rounded">
                      <Info className="h-4 w-4 inline mr-2" />
                      {suggestion.reason}
                    </p>
                  </CardContent>
                </Card>
              ))}

              <div className="text-center text-sm text-muted-foreground">
                <p>Note: Wash sale rules apply. Wait 30 days before repurchasing the same security.</p>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Analysis Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Select positions from the Loss Positions tab and run the AI analysis
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
