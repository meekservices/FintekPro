import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  ArrowRight,
  Sparkles,
  BarChart3,
  Landmark,
  Building2,
  Globe,
  Coins,
} from "lucide-react";

interface DailyPick {
  id: number;
  category: string;
  instrumentName: string;
  symbol?: string;
  recoDate: string;
  recoPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  currentPrice?: number;
  status: string;
  returnPct?: number;
  rationale: string;
  riskLevel: string;
  keyMetrics?: Record<string, any>;
  timeHorizon?: 'short_term' | 'medium_term' | 'long_term';
  confidenceScore?: number;
  sectorCategory?: string;
}

const getConfidenceColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const getConfidenceDot = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
};

// Currency helper for global stocks (USD) vs domestic (INR)
const formatPrice = (price: number, category: string): string => {
  const symbol = category === 'global_stocks' ? '$' : '₹';
  return `${symbol}${price.toLocaleString()}`;
};

const categoryIcons: Record<string, any> = {
  listed_stocks: TrendingUp,
  mutual_funds: BarChart3,
  bonds: Landmark,
  unlisted: Building2,
  global_stocks: Globe,
  etfs: Coins,
  reits_invits: Building2,
  fixed_deposits: Shield,
  sgb: Coins,
};

const categoryLabels: Record<string, string> = {
  listed_stocks: "Stock",
  mutual_funds: "Mutual Fund",
  bonds: "Bond",
  unlisted: "Unlisted",
  global_stocks: "Global Stock",
  etfs: "ETF",
  reits_invits: "REIT/InvIT",
  fixed_deposits: "Fixed Deposit",
  sgb: "Sovereign Gold Bond",
};

const statusColors: Record<string, string> = {
  live: "bg-green-500",
  target_hit: "bg-blue-500",
  stoploss_hit: "bg-red-500",
  expired: "bg-muted",
};

export default function PickOfTheDayWidget() {
  const { data, isLoading } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/today"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Pick of the Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const picks = data?.picks || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Pick of the Day
          </CardTitle>
          <Link href="/agent/picks">
            <Button variant="ghost" size="sm" className="text-xs">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {picks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No picks available yet</p>
            <p className="text-xs mt-1">Check back later for today's recommendations</p>
          </div>
        ) : (
          picks.slice(0, 4).map((pick) => {
            const Icon = categoryIcons[pick.category] || TrendingUp;
            const upside = ((pick.targetPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1);
            const currentReturn = pick.currentPrice 
              ? ((pick.currentPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1)
              : null;

            return (
              <div
                key={pick.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {pick.instrumentName}
                    </span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {categoryLabels[pick.category] || pick.category}
                    </Badge>
                    {pick.confidenceScore !== undefined && (
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${getConfidenceColor(pick.confidenceScore)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getConfidenceDot(pick.confidenceScore)}`} />
                        {pick.confidenceScore}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      +{upside}%
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {formatPrice(pick.stoplossPrice, pick.category)}
                    </span>
                    {currentReturn && (
                      <span className={`flex items-center gap-1 ${parseFloat(currentReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(currentReturn) >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {currentReturn}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {pick.rationale}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${statusColors[pick.status]}`} />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
