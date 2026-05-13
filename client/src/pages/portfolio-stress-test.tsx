import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  BarChart3,
  PieChart,
  Activity,
  Zap,
  RefreshCw,
  Download,
  Info,
  LucideShield as LucideShield,
  Target,
  ArrowDown,
  ArrowUp,
  Minus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface StressScenario {
  id: string;
  name: string;
  description: string;
  type: 'market_crash' | 'sector_rotation' | 'interest_rate' | 'currency' | 'inflation' | 'custom';
  parameters: {
    equityChange: number;
    debtChange: number;
    goldChange: number;
    realEstateChange: number;
  };
  severity: 'low' | 'medium' | 'high' | 'extreme';
}

interface PortfolioHolding {
  name: string;
  type: 'equity' | 'debt' | 'gold' | 'real_estate' | 'cash';
  value: number;
  allocation: number;
}

const predefinedScenarios: StressScenario[] = [
  {
    id: 'market_crash_2008',
    name: '2008 Financial Crisis',
    description: 'Simulate a market crash similar to the 2008 financial crisis',
    type: 'market_crash',
    parameters: { equityChange: -55, debtChange: -5, goldChange: 25, realEstateChange: -30 },
    severity: 'extreme'
  },
  {
    id: 'covid_crash',
    name: 'COVID-19 Crash (Mar 2020)',
    description: 'Rapid market decline similar to early pandemic',
    type: 'market_crash',
    parameters: { equityChange: -35, debtChange: 5, goldChange: 8, realEstateChange: -10 },
    severity: 'high'
  },
  {
    id: 'rate_hike',
    name: 'Interest Rate Hike',
    description: 'Central bank aggressively raises interest rates',
    type: 'interest_rate',
    parameters: { equityChange: -15, debtChange: -8, goldChange: -5, realEstateChange: -12 },
    severity: 'medium'
  },
  {
    id: 'sector_rotation_tech',
    name: 'Tech Sector Crash',
    description: 'Technology sector experiences significant correction',
    type: 'sector_rotation',
    parameters: { equityChange: -25, debtChange: 2, goldChange: 5, realEstateChange: 0 },
    severity: 'high'
  },
  {
    id: 'inflation_surge',
    name: 'High Inflation Environment',
    description: 'Inflation rises to 10%+ levels',
    type: 'inflation',
    parameters: { equityChange: -10, debtChange: -15, goldChange: 20, realEstateChange: 5 },
    severity: 'medium'
  },
  {
    id: 'currency_crisis',
    name: 'Rupee Depreciation',
    description: 'INR depreciates 20% against USD',
    type: 'currency',
    parameters: { equityChange: -8, debtChange: -3, goldChange: 15, realEstateChange: 2 },
    severity: 'medium'
  }
];

export default function PortfolioStressTest() {
  const { user, isAuthenticated } = useAuth();
  const [selectedScenario, setSelectedScenario] = useState<StressScenario | null>(null);
  const [customParameters, setCustomParameters] = useState({
    equityChange: 0,
    debtChange: 0,
    goldChange: 0,
    realEstateChange: 0
  });
  const [isRunning, setIsRunning] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const { data: portfolioData, isLoading: isLoadingPortfolio } = useQuery<PortfolioHolding[]>({
    queryKey: ['/api/portfolio/stress-test-holdings'],
    enabled: isAuthenticated,
  });

  const portfolio = portfolioData || [];
  const totalPortfolioValue = portfolio.reduce((sum, h) => sum + h.value, 0);
  
  const stressedPortfolio = useMemo(() => {
    if (!selectedScenario && !showResults) return null;
    
    const params = selectedScenario?.parameters || customParameters;
    
    return portfolio.map(holding => {
      let changePercent = 0;
      switch (holding.type) {
        case 'equity': changePercent = params.equityChange; break;
        case 'debt': changePercent = params.debtChange; break;
        case 'gold': changePercent = params.goldChange; break;
        case 'real_estate': changePercent = params.realEstateChange; break;
        default: changePercent = 0;
      }
      
      const newValue = holding.value * (1 + changePercent / 100);
      return {
        ...holding,
        originalValue: holding.value,
        stressedValue: newValue,
        change: newValue - holding.value,
        changePercent
      };
    });
  }, [selectedScenario, customParameters, showResults]);

  const stressedTotal = stressedPortfolio?.reduce((sum, h) => sum + h.stressedValue, 0) || 0;
  const totalImpact = stressedTotal - totalPortfolioValue;
  const totalImpactPercent = (totalImpact / totalPortfolioValue) * 100;

  const runStressTest = async () => {
    setIsRunning(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setShowResults(true);
    setIsRunning(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'extreme': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
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
            <Activity className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to access portfolio stress testing.</p>
            <Link href="/auth">
              <Button data-testid="stress-test-login-btn">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6" data-testid="portfolio-stress-test-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-orange-500" />
            Portfolio Stress Testing
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze how your portfolio would perform under various market conditions
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          Portfolio: {formatCurrency(totalPortfolioValue)}
        </Badge>
      </div>

      <Tabs defaultValue="scenarios" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scenarios" data-testid="scenarios-tab">
            <BarChart3 className="h-4 w-4 mr-2" />
            Scenarios
          </TabsTrigger>
          <TabsTrigger value="custom" data-testid="custom-tab">
            <Zap className="h-4 w-4 mr-2" />
            Custom Test
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predefinedScenarios.map((scenario) => (
              <Card 
                key={scenario.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedScenario?.id === scenario.id 
                    ? 'ring-2 ring-blue-500 border-blue-500' 
                    : 'hover:border-border'
                }`}
                onClick={() => {
                  setSelectedScenario(scenario);
                  setShowResults(false);
                }}
                data-testid={`scenario-${scenario.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <AlertTriangle className={`h-5 w-5 ${
                      scenario.severity === 'extreme' ? 'text-red-500' :
                      scenario.severity === 'high' ? 'text-orange-500' :
                      scenario.severity === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`} />
                    <Badge className={getSeverityColor(scenario.severity)}>
                      {(scenario.severity || 'medium').toUpperCase()}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Equity</span>
                      <span className={scenario.parameters.equityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {scenario.parameters.equityChange > 0 ? '+' : ''}{scenario.parameters.equityChange}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Debt</span>
                      <span className={scenario.parameters.debtChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {scenario.parameters.debtChange > 0 ? '+' : ''}{scenario.parameters.debtChange}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Gold</span>
                      <span className={scenario.parameters.goldChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {scenario.parameters.goldChange > 0 ? '+' : ''}{scenario.parameters.goldChange}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Real Estate</span>
                      <span className={scenario.parameters.realEstateChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {scenario.parameters.realEstateChange > 0 ? '+' : ''}{scenario.parameters.realEstateChange}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Stress Parameters</CardTitle>
              <CardDescription>Adjust asset class returns to create your own scenario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Equity Change</span>
                    <span className={customParameters.equityChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {customParameters.equityChange > 0 ? '+' : ''}{customParameters.equityChange}%
                    </span>
                  </div>
                  <Slider
                    value={[customParameters.equityChange]}
                    onValueChange={([v]) => setCustomParameters(p => ({ ...p, equityChange: v }))}
                    min={-60}
                    max={60}
                    step={1}
                    data-testid="equity-slider"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Debt Change</span>
                    <span className={customParameters.debtChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {customParameters.debtChange > 0 ? '+' : ''}{customParameters.debtChange}%
                    </span>
                  </div>
                  <Slider
                    value={[customParameters.debtChange]}
                    onValueChange={([v]) => setCustomParameters(p => ({ ...p, debtChange: v }))}
                    min={-30}
                    max={30}
                    step={1}
                    data-testid="debt-slider"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Gold Change</span>
                    <span className={customParameters.goldChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {customParameters.goldChange > 0 ? '+' : ''}{customParameters.goldChange}%
                    </span>
                  </div>
                  <Slider
                    value={[customParameters.goldChange]}
                    onValueChange={([v]) => setCustomParameters(p => ({ ...p, goldChange: v }))}
                    min={-30}
                    max={50}
                    step={1}
                    data-testid="gold-slider"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Real Estate Change</span>
                    <span className={customParameters.realEstateChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {customParameters.realEstateChange > 0 ? '+' : ''}{customParameters.realEstateChange}%
                    </span>
                  </div>
                  <Slider
                    value={[customParameters.realEstateChange]}
                    onValueChange={([v]) => setCustomParameters(p => ({ ...p, realEstateChange: v }))}
                    min={-40}
                    max={40}
                    step={1}
                    data-testid="real-estate-slider"
                  />
                </div>
              </div>
              <Button 
                onClick={() => {
                  setSelectedScenario(null);
                  runStressTest();
                }}
                disabled={isRunning}
                className="w-full"
                data-testid="run-custom-test-btn"
              >
                {isRunning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Run Custom Stress Test
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedScenario && !showResults && (
        <div className="flex justify-center">
          <Button 
            size="lg"
            onClick={runStressTest}
            disabled={isRunning}
            className="px-8"
            data-testid="run-stress-test-btn"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Activity className="h-5 w-5 mr-2" />
                Run Stress Test: {selectedScenario.name}
              </>
            )}
          </Button>
        </div>
      )}

      {showResults && stressedPortfolio && (
        <div className="space-y-6" data-testid="stress-test-results">
          <Card className={`border-2 ${totalImpact >= 0 ? 'border-green-500 bg-green-50/50 dark:bg-green-950/50' : 'border-red-500 bg-red-50/50 dark:bg-red-950/50'}`}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPortfolioValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Stressed Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(stressedTotal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Impact</p>
                  <p className={`text-2xl font-bold ${totalImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalImpact >= 0 ? '+' : ''}{formatCurrency(totalImpact)}
                    <span className="text-lg ml-2">
                      ({totalImpactPercent >= 0 ? '+' : ''}{totalImpactPercent.toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Holding-wise Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stressedPortfolio.map((holding, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        holding.type === 'equity' ? 'bg-blue-500' :
                        holding.type === 'debt' ? 'bg-green-500' :
                        holding.type === 'gold' ? 'bg-yellow-500' :
                        'bg-purple-500'
                      }`} />
                      <div>
                        <p className="font-medium">{holding.name}</p>
                        <p className="text-sm text-muted-foreground">{(holding.type || 'equity').toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(holding.stressedValue)}</p>
                      <p className={`text-sm ${holding.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {holding.change >= 0 ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />}
                        {holding.changePercent >= 0 ? '+' : ''}{holding.changePercent}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline"
              onClick={() => {
                setShowResults(false);
                setSelectedScenario(null);
              }}
              data-testid="reset-test-btn"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button data-testid="download-report-btn">
              <Download className="h-4 w-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
