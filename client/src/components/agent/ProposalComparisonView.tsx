import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  PieChart,
  Target,
  Shield,
  Info,
  Lightbulb,
} from "lucide-react";

interface Holding {
  name: string;
  type: string;
  currentValue: number;
  allocation?: number;
  returns1Y?: number;
  recommendation?: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  rationale?: string;
}

interface PortfolioData {
  totalValue: number;
  holdings: Holding[];
  assetAllocation: Record<string, number>;
}

interface ProposalData {
  recommendations: Array<{
    productName: string;
    productType: string;
    category?: string;
    recommendedAmount: number;
    allocationPercentage: number;
    recommendationType?: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
    rationale?: string;
    selectionReason?: string;
  }>;
  totalInvestmentAmount: number;
  projectedReturns?: number;
  targetAllocation?: Record<string, number>;
}

interface ProposalComparisonViewProps {
  currentPortfolio?: PortfolioData;
  proposedPortfolio: ProposalData;
  showRiskImpact?: boolean;
}

const ASSET_COLORS: Record<string, string> = {
  equity: "bg-blue-500",
  mutual_fund: "bg-indigo-500",
  bond: "bg-amber-500",
  debt: "bg-amber-500",
  gold: "bg-yellow-500",
  fd: "bg-green-500",
  pms: "bg-purple-500",
  aif: "bg-pink-500",
  real_estate: "bg-stone-500",
  cash: "bg-muted",
  other: "bg-muted-foreground",
};

export function ProposalComparisonView({
  currentPortfolio,
  proposedPortfolio,
  showRiskImpact = true,
}: ProposalComparisonViewProps) {
  const currentTotal = currentPortfolio?.totalValue || 0;
  const proposedTotal = proposedPortfolio.totalInvestmentAmount || 0;
  
  const currentAllocation = currentPortfolio?.assetAllocation || {};
  const proposedAllocation = proposedPortfolio.targetAllocation || {};

  const allAssetClasses = new Set([
    ...Object.keys(currentAllocation),
    ...Object.keys(proposedAllocation),
  ]);

  const calculateRiskScore = (allocation: Record<string, number>): number => {
    const equityWeight = (allocation.equity || 0) + (allocation.mutual_fund || 0) * 0.6;
    const debtWeight = (allocation.bond || 0) + (allocation.debt || 0) + (allocation.fd || 0);
    return Math.round(equityWeight * 0.8 + (100 - debtWeight) * 0.2);
  };

  const currentRisk = calculateRiskScore(currentAllocation);
  const proposedRisk = calculateRiskScore(proposedAllocation);
  const riskChange = proposedRisk - currentRisk;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Current Portfolio
            </CardTitle>
            <CardDescription>
              {currentPortfolio ? `${currentPortfolio.holdings.length} holdings` : 'No existing portfolio'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentPortfolio ? (
              <div className="space-y-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">₹{currentTotal.toLocaleString('en-IN')}</p>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Asset Allocation</p>
                  {Array.from(allAssetClasses).map(asset => {
                    const percentage = currentAllocation[asset] || 0;
                    return (
                      <div key={asset} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${ASSET_COLORS[asset] || ASSET_COLORS.other}`} />
                        <span className="text-sm capitalize flex-1">{asset.replace(/_/g, ' ')}</span>
                        <Progress value={percentage} className="w-20 h-2" />
                        <span className="text-sm font-medium w-12 text-right">{percentage.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No existing portfolio data</p>
                <p className="text-sm">Fresh investment proposal</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Proposed Portfolio
              <Badge variant="outline" className="ml-auto">AI Recommended</Badge>
            </CardTitle>
            <CardDescription>
              {proposedPortfolio.recommendations?.length || 0} recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-primary/10 rounded-lg">
                <p className="text-2xl font-bold text-primary">₹{proposedTotal.toLocaleString('en-IN')}</p>
                <p className="text-sm text-muted-foreground">Recommended Investment</p>
                {proposedPortfolio.projectedReturns && (
                  <p className="text-sm text-green-600 mt-1">
                    Expected: {proposedPortfolio.projectedReturns}% p.a.
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Target Allocation</p>
                {Array.from(allAssetClasses).map(asset => {
                  const currentPct = currentAllocation[asset] || 0;
                  const proposedPct = proposedAllocation[asset] || 0;
                  const change = proposedPct - currentPct;
                  return (
                    <div key={asset} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${ASSET_COLORS[asset] || ASSET_COLORS.other}`} />
                      <span className="text-sm capitalize flex-1">{asset.replace(/_/g, ' ')}</span>
                      <Progress value={proposedPct} className="w-20 h-2" />
                      <span className="text-sm font-medium w-12 text-right">{proposedPct.toFixed(0)}%</span>
                      {currentPortfolio && change !== 0 && (
                        <span className={`text-xs ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {change > 0 ? '+' : ''}{change.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showRiskImpact && currentPortfolio && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Risk Impact Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Risk Level</p>
                <Progress value={currentRisk} className="h-3 mb-2" />
                <p className="font-bold">{currentRisk}/100</p>
                <p className="text-xs text-muted-foreground">
                  {currentRisk < 40 ? 'Conservative' : currentRisk < 70 ? 'Moderate' : 'Aggressive'}
                </p>
              </div>
              <div className="p-4 flex items-center justify-center">
                <ArrowRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className={`p-4 rounded-lg text-center ${
                riskChange > 10 ? 'bg-red-50 dark:bg-red-950' :
                riskChange < -10 ? 'bg-green-50 dark:bg-green-950' :
                'bg-muted'
              }`}>
                <p className="text-sm text-muted-foreground mb-1">Proposed Risk Level</p>
                <Progress value={proposedRisk} className="h-3 mb-2" />
                <p className="font-bold">{proposedRisk}/100</p>
                <div className="flex items-center justify-center gap-1 text-xs">
                  {riskChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-amber-500" />
                  ) : riskChange < 0 ? (
                    <TrendingDown className="h-3 w-3 text-green-500" />
                  ) : (
                    <Scale className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={
                    riskChange > 10 ? 'text-red-600' :
                    riskChange < -10 ? 'text-green-600' :
                    'text-muted-foreground'
                  }>
                    {riskChange > 0 ? '+' : ''}{riskChange} points
                  </span>
                </div>
              </div>
            </div>
            
            {Math.abs(riskChange) > 15 && (
              <Alert className={`mt-4 ${riskChange > 0 ? 'border-amber-200 dark:border-amber-800' : 'border-green-200 dark:border-green-800'}`}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {riskChange > 0 
                    ? 'This proposal increases portfolio risk significantly. Ensure client understands the higher volatility potential.'
                    : 'This proposal reduces portfolio risk, which may result in more stable but potentially lower returns.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface TalkingPoint {
  title: string;
  content: string;
  type: 'rationale' | 'disclosure' | 'benefit' | 'risk';
}

interface GuidedWalkthroughProps {
  recommendations: Array<{
    productName: string;
    productType: string;
    recommendedAmount: number;
    allocationPercentage: number;
    selectionReason?: string;
    rationale?: string;
    riskRating?: string;
  }>;
  clientName: string;
  investmentGoal?: string;
  riskProfile?: string;
}

export function GuidedWalkthroughPanel({
  recommendations,
  clientName,
  investmentGoal,
  riskProfile,
}: GuidedWalkthroughProps) {
  const talkingPoints: TalkingPoint[] = [
    {
      title: "Opening Statement",
      content: `Thank you for considering this investment proposal, ${clientName}. Based on your ${riskProfile || 'risk profile'} and goal of ${investmentGoal || 'wealth creation'}, I've prepared a diversified portfolio recommendation.`,
      type: 'rationale',
    },
    ...recommendations.slice(0, 5).map((rec) => ({
      title: `${rec.productName}`,
      content: rec.selectionReason || rec.rationale || `Allocated ${rec.allocationPercentage}% (₹${rec.recommendedAmount.toLocaleString('en-IN')}) to ${rec.productType.replace(/_/g, ' ')}`,
      type: 'rationale' as const,
    })),
    {
      title: "Risk Disclosure",
      content: "All investments carry risk. Past performance is not indicative of future results. The recommendations are based on current market conditions and may need periodic review.",
      type: 'disclosure',
    },
    {
      title: "Regulatory Disclosure",
      content: "This proposal is advisory in nature. Final investment decisions are made by you with my assistance as a licensed agent. I am registered with relevant regulatory bodies.",
      type: 'disclosure',
    },
    {
      title: "Next Steps",
      content: "If you're comfortable with this proposal, we can proceed with the documentation and execution. You'll need to acknowledge the risk disclosures before we execute any transactions.",
      type: 'benefit',
    },
  ];

  const getTypeIcon = (type: TalkingPoint['type']) => {
    switch (type) {
      case 'rationale': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'disclosure': return <Shield className="h-4 w-4 text-amber-500" />;
      case 'benefit': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'risk': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getTypeBg = (type: TalkingPoint['type']) => {
    switch (type) {
      case 'rationale': return 'bg-blue-50 dark:bg-blue-950 border-blue-200';
      case 'disclosure': return 'bg-amber-50 dark:bg-amber-950 border-amber-200';
      case 'benefit': return 'bg-green-50 dark:bg-green-950 border-green-200';
      case 'risk': return 'bg-red-50 dark:bg-red-950 border-red-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Guided Walkthrough
        </CardTitle>
        <CardDescription>
          Talking points for your client presentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Use these talking points during your client meeting. Each point includes rationale and required disclosures.
          </AlertDescription>
        </Alert>
        
        {talkingPoints.map((point, idx) => (
          <div key={idx} className={`p-3 rounded-lg border ${getTypeBg(point.type)}`}>
            <div className="flex items-start gap-2">
              {getTypeIcon(point.type)}
              <div className="flex-1">
                <p className="font-medium text-sm">{point.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{point.content}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {point.type}
              </Badge>
            </div>
          </div>
        ))}

        <Separator className="my-4" />

        <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Mandatory Disclosure</p>
              <p className="text-xs text-muted-foreground mt-1">
                "The analysis and proposals shared are advisory in nature. Final investment decisions are made by you with the assistance of a licensed agent."
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
