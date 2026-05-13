import { AIAdvisoryDisclosure } from "@/components/regulatory/AIAdvisoryDisclosure";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Brain,
  TrendingUp,
  BarChart3,
  PieChart,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Lightbulb,
  ArrowRight,
  Calculator,
  Scale,
  Calendar,
  Percent,
  ShieldCheck,
  Zap,
  Building2,
  Landmark,
  Coins,
  DollarSign,
  LucideShield as LucideShield,
  BadgeCheck,
  ChevronRight,
  ArrowUpRight,
  TrendingDown,
  Info,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface BondRecommendation {
  id: string;
  bondType: 'government' | 'corporate';
  isin: string;
  name: string;
  issuer: string;
  bondCategory: string;
  currentPrice: number;
  yieldToMaturity: number;
  couponRate: number;
  couponFrequency: string;
  maturityDate: string;
  daysToMaturity: number;
  creditRating: string;
  suggestedAllocation: number;
  suggestedAmount: number;
  expectedAnnualIncome: number;
  taxEfficiency: 'high' | 'medium' | 'low';
  riskScore: number;
  suitabilityScore: number;
  aiRationale: string;
  pros: string[];
  cons: string[];
  taxImplications: string;
  duration: number;
  modifiedDuration: number;
}

interface BondPortfolioSummary {
  totalInvestment: number;
  weightedYield: number;
  weightedDuration: number;
  averageRating: string;
  expectedAnnualIncome: number;
  taxEfficiency: string;
  diversificationScore: number;
  recommendations: BondRecommendation[];
  portfolioRationale: string;
  riskAnalysis: {
    interestRateRisk: 'low' | 'medium' | 'high';
    creditRisk: 'low' | 'medium' | 'high';
    liquidityRisk: 'low' | 'medium' | 'high';
    reinvestmentRisk: 'low' | 'medium' | 'high';
  };
  ladderStrategy?: {
    enabled: boolean;
    buckets: Array<{
      maturityRange: string;
      percentage: number;
      bonds: string[];
    }>;
  };
}

interface RecommendationParams {
  investmentAmount: number;
  investmentHorizon: string;
  riskTolerance: string;
  taxBracket: string;
  preferredBondTypes: string[];
  minimumRating: string;
  yieldPreference: string;
  liquidityNeeds: string;
  taxOptimization: boolean;
  inflationProtection: boolean;
  monthlyIncomeNeeded: boolean;
}

const BOND_TYPES = [
  { value: 'g_sec', label: 'Government Securities', icon: Landmark },
  { value: 'sdl', label: 'State Development Loans', icon: Building2 },
  { value: 't_bill', label: 'Treasury Bills', icon: DollarSign },
  { value: 'sgb', label: 'Sovereign Gold Bonds', icon: Coins },
  { value: 'corporate_bond', label: 'Corporate Bonds', icon: Building2 },
  { value: 'ncd', label: 'NCDs', icon: Layers },
  { value: 'tax_free_bond', label: 'Tax-Free Bonds', icon: BadgeCheck },
  { value: 'infrastructure_bond', label: 'Infrastructure Bonds', icon: Target }
];

const QUICK_PROFILES = [
  { id: 'conservative', label: 'Conservative', description: 'Safety-first approach with government securities', icon: LucideShield, color: 'text-blue-500' },
  { id: 'balanced', label: 'Balanced', description: 'Mix of safety and yield optimization', icon: Scale, color: 'text-green-500' },
  { id: 'income', label: 'Income Focus', description: 'Maximize regular income from bond portfolio', icon: DollarSign, color: 'text-amber-500' },
  { id: 'tax_saver', label: 'Tax Saver', description: 'Optimize for post-tax returns', icon: BadgeCheck, color: 'text-purple-500' }
];

export default function AgentBondRecommendations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generator");
  const [params, setParams] = useState<RecommendationParams>({
    investmentAmount: 500000,
    investmentHorizon: 'medium',
    riskTolerance: 'moderate',
    taxBracket: '30',
    preferredBondTypes: ['g_sec', 'corporate_bond', 'ncd', 'tax_free_bond'],
    minimumRating: 'AA',
    yieldPreference: 'balanced',
    liquidityNeeds: 'medium',
    taxOptimization: true,
    inflationProtection: false,
    monthlyIncomeNeeded: false
  });
  const [recommendations, setRecommendations] = useState<BondPortfolioSummary | null>(null);

  const { data: parameters, isLoading: parametersLoading } = useQuery<any>({
    queryKey: ['/api/bond-recommendations/parameters']
  });

  const generateMutation = useMutation({
    mutationFn: async (requestParams: RecommendationParams) => {
      return await apiRequest('/api/bond-recommendations/generate', {
        method: 'POST',
        body: JSON.stringify(requestParams)
      });
    },
    onSuccess: (data) => {
      if (data?.data) {
        setRecommendations(data.data);
        setActiveTab("results");
        toast({
          title: "Recommendations Generated",
          description: `Found ${data.data.recommendations?.length || 0} bond recommendations for your criteria`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate recommendations",
        variant: "destructive"
      });
    }
  });

  const quickPickMutation = useMutation({
    mutationFn: async (profile: string) => {
      return await apiRequest(`/api/bond-recommendations/quick-picks?profile=${profile}`);
    },
    onSuccess: (data) => {
      if (data?.data) {
        setRecommendations(data.data);
        setActiveTab("results");
        toast({
          title: "Quick Picks Generated",
          description: `${data.profile || 'Custom'} portfolio with ${data.data.recommendations?.length || 0} bonds`
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate quick picks",
        variant: "destructive"
      });
    }
  });

  const handleBondTypeToggle = (bondType: string) => {
    setParams(prev => ({
      ...prev,
      preferredBondTypes: prev.preferredBondTypes.includes(bondType)
        ? prev.preferredBondTypes.filter(t => t !== bondType)
        : [...prev.preferredBondTypes, bondType]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      default: return 'outline';
    }
  };

  const getRatingColor = (rating: string) => {
    if (rating.startsWith('AAA')) return 'text-green-600';
    if (rating.startsWith('AA')) return 'text-blue-600';
    if (rating.startsWith('A')) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="page-title">
              <Brain className="h-8 w-8 text-blue-400" />
              AI Bond Recommendations
            </h1>
            <p className="text-muted-foreground mt-1">
              Intelligent fixed-income portfolio construction with customizable parameters
            </p>
          </div>
          <Badge className="bg-blue-600/20 text-blue-400 border-blue-600/50">
            <Zap className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollableTabsList className="bg-background/50 border border-border">
            <TabsTrigger value="generator" className="data-[state=active]:bg-blue-600" data-testid="tab-generator">
              <Calculator className="h-4 w-4 mr-2" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="quick-picks" className="data-[state=active]:bg-blue-600" data-testid="tab-quick-picks">
              <Zap className="h-4 w-4 mr-2" />
              Quick Picks
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-blue-600" data-testid="tab-results">
              <BarChart3 className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="generator" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-400" />
                      Investment Parameters
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Configure your bond investment preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Investment Amount</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            value={params.investmentAmount}
                            onChange={(e) => setParams(prev => ({ ...prev, investmentAmount: parseInt(e.target.value) || 0 }))}
                            className="bg-card border-border text-foreground pl-8"
                            data-testid="input-investment-amount"
                          />
                        </div>
                        <Slider
                          value={[params.investmentAmount]}
                          min={10000}
                          max={10000000}
                          step={10000}
                          onValueChange={([value]) => setParams(prev => ({ ...prev, investmentAmount: value }))}
                          className="mt-2"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Investment Horizon</Label>
                        <Select
                          value={params.investmentHorizon}
                          onValueChange={(value) => setParams(prev => ({ ...prev, investmentHorizon: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-investment-horizon">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {parameters?.investmentHorizon?.map((option: any) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            )) || (
                              <>
                                <SelectItem value="short">Short Term (&lt; 3 years)</SelectItem>
                                <SelectItem value="medium">Medium Term (3-7 years)</SelectItem>
                                <SelectItem value="long">Long Term (&gt; 7 years)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Risk Tolerance</Label>
                        <Select
                          value={params.riskTolerance}
                          onValueChange={(value) => setParams(prev => ({ ...prev, riskTolerance: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-risk-tolerance">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conservative">Conservative</SelectItem>
                            <SelectItem value="moderately_conservative">Moderately Conservative</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="moderately_aggressive">Moderately Aggressive</SelectItem>
                            <SelectItem value="aggressive">Aggressive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Tax Bracket</Label>
                        <Select
                          value={params.taxBracket}
                          onValueChange={(value) => setParams(prev => ({ ...prev, taxBracket: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-tax-bracket">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">No Tax (0%)</SelectItem>
                            <SelectItem value="5">5% Bracket</SelectItem>
                            <SelectItem value="10">10% Bracket</SelectItem>
                            <SelectItem value="15">15% Bracket</SelectItem>
                            <SelectItem value="20">20% Bracket</SelectItem>
                            <SelectItem value="25">25% Bracket</SelectItem>
                            <SelectItem value="30">30% Bracket</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Minimum Credit Rating</Label>
                        <Select
                          value={params.minimumRating}
                          onValueChange={(value) => setParams(prev => ({ ...prev, minimumRating: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-minimum-rating">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AAA">AAA Only</SelectItem>
                            <SelectItem value="AA+">AA+ and above</SelectItem>
                            <SelectItem value="AA">AA and above</SelectItem>
                            <SelectItem value="AA-">AA- and above</SelectItem>
                            <SelectItem value="A+">A+ and above</SelectItem>
                            <SelectItem value="A">A and above</SelectItem>
                            <SelectItem value="BBB">Investment Grade (BBB+)</SelectItem>
                            <SelectItem value="any">Any Rating</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Yield Preference</Label>
                        <Select
                          value={params.yieldPreference}
                          onValueChange={(value) => setParams(prev => ({ ...prev, yieldPreference: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-yield-preference">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="safety_first">Safety First</SelectItem>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="high_yield">High Yield</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Liquidity Needs</Label>
                        <Select
                          value={params.liquidityNeeds}
                          onValueChange={(value) => setParams(prev => ({ ...prev, liquidityNeeds: value }))}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-liquidity-needs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High - May need quick access</SelectItem>
                            <SelectItem value="medium">Medium - Some flexibility</SelectItem>
                            <SelectItem value="low">Low - Can hold to maturity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="bg-muted" />

                    <div className="space-y-4">
                      <Label className="text-muted-foreground">Preferred Bond Types</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {BOND_TYPES.map((bondType) => {
                          const Icon = bondType.icon;
                          const isSelected = params.preferredBondTypes.includes(bondType.value);
                          return (
                            <button
                              key={bondType.value}
                              onClick={() => handleBondTypeToggle(bondType.value)}
                              className={`p-3 rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                  : 'bg-card border-border text-muted-foreground hover:border-border'
                              }`}
                              data-testid={`bond-type-${bondType.value}`}
                            >
                              <Icon className="h-5 w-5 mx-auto mb-1" />
                              <span className="text-xs">{bondType.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Separator className="bg-muted" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2">
                          <BadgeCheck className="h-5 w-5 text-green-400" />
                          <Label className="text-muted-foreground cursor-pointer">Tax Optimization</Label>
                        </div>
                        <Switch
                          checked={params.taxOptimization}
                          onCheckedChange={(checked) => setParams(prev => ({ ...prev, taxOptimization: checked }))}
                          data-testid="switch-tax-optimization"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2">
                          <LucideShield className="h-5 w-5 text-amber-400" />
                          <Label className="text-muted-foreground cursor-pointer">Inflation Protection</Label>
                        </div>
                        <Switch
                          checked={params.inflationProtection}
                          onCheckedChange={(checked) => setParams(prev => ({ ...prev, inflationProtection: checked }))}
                          data-testid="switch-inflation-protection"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-purple-400" />
                          <Label className="text-muted-foreground cursor-pointer">Monthly Income</Label>
                        </div>
                        <Switch
                          checked={params.monthlyIncomeNeeded}
                          onCheckedChange={(checked) => setParams(prev => ({ ...prev, monthlyIncomeNeeded: checked }))}
                          data-testid="switch-monthly-income"
                        />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={() => generateMutation.mutate(params)}
                      disabled={generateMutation.isPending || params.preferredBondTypes.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-generate"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating Recommendations...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Generate AI Recommendations
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2 text-lg">
                      <Lightbulb className="h-5 w-5 text-amber-400" />
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Investment</span>
                        <span className="text-foreground font-semibold">{formatCurrency(params.investmentAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Horizon</span>
                        <span className="text-foreground capitalize">{params.investmentHorizon} Term</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Risk Profile</span>
                        <Badge variant="outline" className="capitalize">{params.riskTolerance.replace('_', ' ')}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Min. Rating</span>
                        <span className={`font-semibold ${getRatingColor(params.minimumRating)}`}>{params.minimumRating}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bond Types</span>
                        <span className="text-foreground">{params.preferredBondTypes.length} selected</span>
                      </div>
                    </div>

                    <Separator className="bg-muted" />

                    <div className="space-y-2">
                      <h4 className="text-muted-foreground font-medium">Active Features</h4>
                      <div className="flex flex-wrap gap-2">
                        {params.taxOptimization && (
                          <Badge className="bg-green-600/20 text-green-400 border-green-600/50">Tax Opt.</Badge>
                        )}
                        {params.inflationProtection && (
                          <Badge className="bg-amber-600/20 text-amber-400 border-amber-600/50">Inflation Prot.</Badge>
                        )}
                        {params.monthlyIncomeNeeded && (
                          <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/50">Monthly Income</Badge>
                        )}
                        {!params.taxOptimization && !params.inflationProtection && !params.monthlyIncomeNeeded && (
                          <span className="text-muted-foreground text-sm">No special features</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-900/50 to-slate-900 border-blue-800/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-foreground text-lg flex items-center gap-2">
                      <Info className="h-5 w-5 text-blue-400" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">
                      Our AI engine analyzes real-time bond data, credit ratings, yield curves, 
                      and your personal preferences to construct an optimal fixed-income portfolio.
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Duration matching for your horizon
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Credit quality screening
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Tax-efficient allocation
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        Laddering strategy options
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="quick-picks" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {QUICK_PROFILES.map((profile) => {
                const Icon = profile.icon;
                return (
                  <Card
                    key={profile.id}
                    className="bg-background border-border hover:border-blue-600 transition-colors cursor-pointer group"
                    onClick={() => quickPickMutation.mutate(profile.id)}
                    data-testid={`quick-pick-${profile.id}`}
                  >
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-full bg-card flex items-center justify-center mb-2 group-hover:bg-blue-600/20 transition-colors`}>
                        <Icon className={`h-6 w-6 ${profile.color}`} />
                      </div>
                      <CardTitle className="text-foreground text-lg">{profile.label}</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {profile.description}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full border-border text-muted-foreground group-hover:border-blue-600 group-hover:text-blue-400"
                        disabled={quickPickMutation.isPending}
                      >
                        {quickPickMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        Generate
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            <Alert className="mt-6 bg-background border-border">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-muted-foreground">
                Quick picks use pre-configured parameters optimized for common investment goals. 
                For custom requirements, use the Generator tab.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="results" className="mt-6">
            {!recommendations ? (
              <Card className="bg-background border-border">
                <CardContent className="py-12 text-center">
                  <PieChart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Recommendations Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate recommendations using the Generator or Quick Picks tabs
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("generator")}
                    className="border-border"
                  >
                    Go to Generator
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Total Investment</p>
                        <p className="text-2xl font-bold text-foreground">{formatCurrency(recommendations.totalInvestment)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Weighted Yield</p>
                        <p className="text-2xl font-bold text-green-400">{recommendations.weightedYield.toFixed(2)}%</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Avg. Duration</p>
                        <p className="text-2xl font-bold text-blue-400">{recommendations.weightedDuration.toFixed(1)}Y</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Annual Income</p>
                        <p className="text-2xl font-bold text-amber-400">{formatCurrency(recommendations.expectedAnnualIncome)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Avg. Rating</p>
                        <p className={`text-2xl font-bold ${getRatingColor(recommendations.averageRating)}`}>{recommendations.averageRating}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-background border-border">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-muted-foreground text-sm">Diversification</p>
                        <p className="text-2xl font-bold text-purple-400">{recommendations.diversificationScore}/100</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="bg-background border-border lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Brain className="h-5 w-5 text-blue-400" />
                        AI Portfolio Rationale
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{recommendations.portfolioRationale}</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-background border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                        Risk Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Interest Rate Risk</span>
                        <Badge variant={getRiskBadgeVariant(recommendations.riskAnalysis.interestRateRisk)}>
                          {recommendations.riskAnalysis.interestRateRisk}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Credit Risk</span>
                        <Badge variant={getRiskBadgeVariant(recommendations.riskAnalysis.creditRisk)}>
                          {recommendations.riskAnalysis.creditRisk}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Liquidity Risk</span>
                        <Badge variant={getRiskBadgeVariant(recommendations.riskAnalysis.liquidityRisk)}>
                          {recommendations.riskAnalysis.liquidityRisk}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Reinvestment Risk</span>
                        <Badge variant={getRiskBadgeVariant(recommendations.riskAnalysis.reinvestmentRisk)}>
                          {recommendations.riskAnalysis.reinvestmentRisk}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {recommendations.ladderStrategy?.enabled && (
                  <Card className="bg-background border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Layers className="h-5 w-5 text-purple-400" />
                        Bond Ladder Strategy
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Staggered maturities to manage reinvestment risk
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {recommendations.ladderStrategy.buckets.map((bucket, index) => (
                          <div key={index} className="p-4 rounded-lg bg-card border border-border">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-muted-foreground font-medium">{bucket.maturityRange}</span>
                              <Badge variant="outline">{bucket.percentage}%</Badge>
                            </div>
                            <Progress value={bucket.percentage} className="h-2 mb-2" />
                            <p className="text-muted-foreground text-sm">{bucket.bonds.length} bond(s)</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-background border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-green-400" />
                      Recommended Bonds ({recommendations.recommendations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-4">
                        {recommendations.recommendations.map((bond, index) => (
                          <Accordion type="single" collapsible key={bond.id}>
                            <AccordionItem value={bond.id} className="border border-border rounded-lg bg-card/50">
                              <AccordionTrigger className="px-4 py-3 hover:no-underline" data-testid={`bond-item-${index}`}>
                                <div className="flex items-center gap-4 w-full text-left">
                                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    {bond.bondType === 'government' ? (
                                      <Landmark className="h-5 w-5 text-green-400" />
                                    ) : (
                                      <Building2 className="h-5 w-5 text-blue-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-foreground font-medium truncate">{bond.name}</h4>
                                    <p className="text-muted-foreground text-sm">{bond.issuer} • {bond.bondCategory}</p>
                                  </div>
                                  <div className="text-right hidden md:block">
                                    <p className="text-green-400 font-semibold">{bond.yieldToMaturity.toFixed(2)}% YTM</p>
                                    <p className="text-muted-foreground text-sm">{bond.suggestedAllocation}% allocation</p>
                                  </div>
                                  <Badge className={getRatingColor(bond.creditRating)} variant="outline">
                                    {bond.creditRating}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-4 pb-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Suggested Amount</p>
                                    <p className="text-foreground font-semibold">{formatCurrency(bond.suggestedAmount)}</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Current Price</p>
                                    <p className="text-foreground font-semibold">₹{bond.currentPrice.toFixed(2)}</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Coupon Rate</p>
                                    <p className="text-foreground font-semibold">{bond.couponRate}%</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Annual Income</p>
                                    <p className="text-amber-400 font-semibold">{formatCurrency(bond.expectedAnnualIncome)}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Maturity Date</p>
                                    <p className="text-foreground font-semibold">{new Date(bond.maturityDate).toLocaleDateString()}</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Days to Maturity</p>
                                    <p className="text-foreground font-semibold">{bond.daysToMaturity}</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Duration</p>
                                    <p className="text-foreground font-semibold">{bond.duration.toFixed(2)} yrs</p>
                                  </div>
                                  <div className="p-3 rounded bg-muted/50">
                                    <p className="text-muted-foreground text-sm">Mod. Duration</p>
                                    <p className="text-foreground font-semibold">{bond.modifiedDuration.toFixed(2)}</p>
                                  </div>
                                </div>

                                <div className="mb-4 p-4 rounded bg-blue-600/10 border border-blue-600/30">
                                  <h5 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                                    <Brain className="h-4 w-4" />
                                    AI Rationale
                                  </h5>
                                  <p className="text-muted-foreground text-sm">{bond.aiRationale}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <h5 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                                      <TrendingUp className="h-4 w-4" />
                                      Pros
                                    </h5>
                                    <ul className="space-y-1">
                                      {bond.pros.map((pro, i) => (
                                        <li key={i} className="text-muted-foreground text-sm flex items-start gap-2">
                                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                          {pro}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <div>
                                    <h5 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                                      <TrendingDown className="h-4 w-4" />
                                      Cons
                                    </h5>
                                    <ul className="space-y-1">
                                      {bond.cons.map((con, i) => (
                                        <li key={i} className="text-muted-foreground text-sm flex items-start gap-2">
                                          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                          {con}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>

                                <div className="p-3 rounded bg-muted/50">
                                  <h5 className="text-muted-foreground font-medium mb-1 flex items-center gap-2">
                                    <BadgeCheck className="h-4 w-4 text-purple-400" />
                                    Tax Implications
                                  </h5>
                                  <p className="text-muted-foreground text-sm">{bond.taxImplications}</p>
                                </div>

                                <div className="flex gap-2 mt-4">
                                  <div className="flex-1 flex items-center gap-2">
                                    <span className="text-muted-foreground text-sm">Suitability:</span>
                                    <Progress value={bond.suitabilityScore} className="flex-1 h-2" />
                                    <span className="text-foreground font-medium">{bond.suitabilityScore}%</span>
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={bond.taxEfficiency === 'high' ? 'text-green-400 border-green-400/50' : 
                                      bond.taxEfficiency === 'medium' ? 'text-amber-400 border-amber-400/50' : 'text-red-400 border-red-400/50'}
                                  >
                                    {bond.taxEfficiency} tax efficiency
                                  </Badge>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
