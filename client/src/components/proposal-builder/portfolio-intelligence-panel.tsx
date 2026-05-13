import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  Brain,
  RefreshCw,
  Shield as LucideShield,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import { DiversificationScoreWidget } from "./diversification-score-widget";
import { ReplaceFundPanel } from "./replace-fund-panel";
import { AdvisorTalkingPoints } from "./advisor-talking-points";
import { DiversificationImpactPreview } from "./diversification-impact-preview";

interface PortfolioFund {
  mfIsin: string;
  name: string;
  portfolioWeight: number;
  currentValue?: number;
  category?: string;
  expenseRatio?: number;
  sharpeRatio?: number;
}

interface DiversificationPenalty {
  type: "STOCK_OVERLAP" | "SECTOR_CONCENTRATION" | "FUND_CROWDING";
  entity: string;
  exposure?: number;
  fundCount?: number;
  impact: number;
  description: string;
}

interface DiversificationScore {
  score: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  penalties: DiversificationPenalty[];
}

interface AlternativeFund {
  isin: string;
  name: string;
  category: string;
  overlapReduction: number;
  diversificationGain: number;
  expenseRatio?: number;
}

interface ReplaceFundSuggestion {
  fundToReplace: string;
  fundIsin: string;
  reason: string;
  overlapWith: string;
  overlapPercentage: number;
  metricsComparison: string;
  suggestedAction: "SWITCH" | "REDUCE" | "REVIEW";
  alternatives: AlternativeFund[];
}

interface AdvisorTalkingPoint {
  type: "OVERLAP_RISK" | "REPLACE_FUND" | "DIVERSIFICATION" | "SECTOR_CONCENTRATION";
  priority: "HIGH" | "MEDIUM" | "LOW";
  text: string;
  data?: Record<string, any>;
}

interface DiversificationImpact {
  currentScore: number;
  projectedScore: number;
  netImprovement: number;
  changesApplied: string[];
}

interface OverlapIntelligenceResult {
  diversificationScore: DiversificationScore;
  replaceFundSuggestions: ReplaceFundSuggestion[];
  advisorTalkingPoints: AdvisorTalkingPoint[];
}

interface PortfolioIntelligencePanelProps {
  holdings: PortfolioFund[];
  onIntelligenceReady?: (result: OverlapIntelligenceResult) => void;
  onTalkingPointsChange?: (points: AdvisorTalkingPoint[]) => void;
  onApplySwitch?: (fundIsin: string, replacementIsin: string) => void;
}

export function PortfolioIntelligencePanel({
  holdings,
  onIntelligenceReady,
  onTalkingPointsChange,
  onApplySwitch,
}: PortfolioIntelligencePanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [impactPreview, setImpactPreview] = useState<DiversificationImpact | null>(null);
  const [editableTalkingPoints, setEditableTalkingPoints] = useState<AdvisorTalkingPoint[]>([]);

  const funds = holdings
    .filter((h) => h.mfIsin)
    .map((h) => ({
      mfIsin: h.mfIsin,
      name: h.name,
      portfolioWeight: h.portfolioWeight || 0,
      currentValue: h.currentValue,
      category: h.category,
      expenseRatio: h.expenseRatio,
      sharpeRatio: h.sharpeRatio,
    }));

  const {
    data: intelligence,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery<OverlapIntelligenceResult>({
    queryKey: ["/api/portfolio/intelligence", funds.map((f) => f.mfIsin).join(",")],
    queryFn: async () => {
      const response = await fetch("/api/portfolio/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funds }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: funds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (intelligence) {
      setEditableTalkingPoints(intelligence.advisorTalkingPoints);
      if (onIntelligenceReady) {
        onIntelligenceReady(intelligence);
      }
    }
  }, [intelligence, onIntelligenceReady]);

  const simulateImpactMutation = useMutation({
    mutationFn: async (changes: { action: string; fundIsin: string; replacementIsin?: string }[]) => {
      const response = await fetch("/api/portfolio/simulate-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPortfolio: funds, changes }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result.data as DiversificationImpact;
    },
    onSuccess: (data) => {
      setImpactPreview(data);
    },
    onError: (error: any) => {
      toast({
        title: "Impact Simulation Failed",
        description: error.message || "Could not simulate the diversification impact.",
        variant: "destructive",
      });
    },
  });

  const handleViewImpact = (suggestion: ReplaceFundSuggestion, alternative?: AlternativeFund) => {
    if (alternative) {
      simulateImpactMutation.mutate([
        { action: "REPLACE", fundIsin: suggestion.fundIsin, replacementIsin: alternative.isin },
      ]);
    }
  };

  const handleApplySwitch = (suggestion: ReplaceFundSuggestion, alternative: AlternativeFund) => {
    if (onApplySwitch) {
      onApplySwitch(suggestion.fundIsin, alternative.isin);
      toast({
        title: "Switch Applied",
        description: `Replaced ${suggestion.fundToReplace} with ${alternative.name}`,
      });
    }
  };

  const handleTalkingPointsChange = (points: AdvisorTalkingPoint[]) => {
    setEditableTalkingPoints(points);
    if (onTalkingPointsChange) {
      onTalkingPointsChange(points);
    }
  };

  if (funds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Portfolio Intelligence
          </CardTitle>
          <CardDescription>
            Import portfolio holdings to enable overlap-aware intelligence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <p className="text-sm text-muted-foreground">
              No mutual fund holdings with ISIN data found.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Portfolio Intelligence
          </CardTitle>
          <CardDescription>Analyzing portfolio for overlap and diversification...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !intelligence) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Portfolio Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">
                Failed to analyze portfolio intelligence.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Portfolio Intelligence
            </CardTitle>
            <CardDescription>
              Overlap-aware analysis with actionable recommendations
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs">
              <LucideShield className="h-3.5 w-3.5 mr-1" />
              Score
            </TabsTrigger>
            <TabsTrigger value="replace" className="text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Replace
              {intelligence.replaceFundSuggestions.length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 rounded-full">
                  {intelligence.replaceFundSuggestions.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="impact" className="text-xs">
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              Impact
            </TabsTrigger>
            <TabsTrigger value="talking" className="text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <DiversificationScoreWidget data={intelligence.diversificationScore} />
          </TabsContent>

          <TabsContent value="replace" className="mt-0">
            {intelligence.replaceFundSuggestions.length > 0 ? (
              <ReplaceFundPanel
                suggestions={intelligence.replaceFundSuggestions}
                onViewImpact={handleViewImpact}
                onApplySwitch={handleApplySwitch}
              />
            ) : (
              <div className="p-6 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                <LucideShield className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="font-medium text-green-700 dark:text-green-300">
                  No Redundant Funds Detected
                </p>
                <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                  Your portfolio funds have healthy diversification with minimal overlap.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="impact" className="mt-0">
            {impactPreview ? (
              <DiversificationImpactPreview impact={impactPreview} />
            ) : (
              <div className="p-6 bg-muted/50 rounded-lg text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="font-medium">No Impact Preview Available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a replacement option in the "Replace" tab to see the diversification impact.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="talking" className="mt-0">
            <AdvisorTalkingPoints
              talkingPoints={editableTalkingPoints}
              editable={true}
              onPointsChange={handleTalkingPointsChange}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PortfolioIntelligencePanel;
