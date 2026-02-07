import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskMetrics {
  diversificationScore: number;
  overlapRisk: number; // 0-100, higher = more overlap
  sectorConcentration: number; // 0-100, higher = more concentrated
  fundCrowding: number; // Count of stocks in >3 funds
}

interface BeforeAfterRiskBarsProps {
  current: RiskMetrics;
  proposed: RiskMetrics;
  changesApplied?: string[];
}

function RiskBar({
  label,
  currentValue,
  proposedValue,
  inverse = false,
}: {
  label: string;
  currentValue: number;
  proposedValue: number;
  inverse?: boolean; // If true, lower is better
}) {
  const improvement = inverse ? currentValue - proposedValue : proposedValue - currentValue;
  const isImproved = improvement > 0;
  const isWorse = improvement < 0;

  const getBarColor = (value: number) => {
    if (inverse) {
      // For overlap/concentration: lower is better
      if (value < 30) return "bg-green-500";
      if (value < 60) return "bg-amber-500";
      return "bg-red-500";
    } else {
      // For diversification: higher is better
      if (value >= 70) return "bg-green-500";
      if (value >= 40) return "bg-amber-500";
      return "bg-red-500";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{currentValue}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={cn(
            "text-sm font-medium",
            isImproved ? "text-green-600" : isWorse ? "text-red-600" : "text-muted-foreground"
          )}>
            {proposedValue}
          </span>
          {improvement !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                isImproved ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
              )}
            >
              {isImproved ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {Math.abs(improvement)}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Current</div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full transition-all", getBarColor(currentValue))}
              style={{ width: `${Math.min(currentValue, 100)}%` }}
            />
          </div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Proposed</div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                getBarColor(proposedValue),
                isImproved && "animate-pulse"
              )}
              style={{ width: `${Math.min(proposedValue, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BeforeAfterRiskBars({ current, proposed, changesApplied }: BeforeAfterRiskBarsProps) {
  const netImprovement = proposed.diversificationScore - current.diversificationScore;
  const isOverallImproved = netImprovement > 0;

  return (
    <Card className={cn(
      "border-2",
      isOverallImproved ? "border-green-200" : netImprovement < 0 ? "border-red-200" : "border-border"
    )}>
      <CardHeader className={cn(
        "pb-3",
        isOverallImproved ? "bg-green-50 dark:bg-green-950/30" :
        netImprovement < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/30"
      )}>
        <CardTitle className="text-base flex items-center gap-2">
          {isOverallImproved ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : netImprovement < 0 ? (
            <TrendingDown className="h-5 w-5 text-red-600" />
          ) : (
            <Minus className="h-5 w-5 text-muted-foreground" />
          )}
          Before vs After Risk Analysis
        </CardTitle>
        <CardDescription>
          Side-by-side comparison of portfolio risk metrics
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        <RiskBar
          label="Diversification Score"
          currentValue={current.diversificationScore}
          proposedValue={proposed.diversificationScore}
          inverse={false}
        />

        <RiskBar
          label="Overlap Risk"
          currentValue={current.overlapRisk}
          proposedValue={proposed.overlapRisk}
          inverse={true}
        />

        <RiskBar
          label="Sector Concentration"
          currentValue={current.sectorConcentration}
          proposedValue={proposed.sectorConcentration}
          inverse={true}
        />

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <span className="text-sm font-medium">Fund Crowding</span>
            <p className="text-xs text-muted-foreground">Stocks held by &gt;3 funds</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{current.fundCrowding}</Badge>
            <ArrowRight className="h-3 w-3" />
            <Badge
              variant="outline"
              className={cn(
                proposed.fundCrowding < current.fundCrowding
                  ? "bg-green-50 text-green-700"
                  : proposed.fundCrowding > current.fundCrowding
                  ? "bg-red-50 text-red-700"
                  : ""
              )}
            >
              {proposed.fundCrowding}
            </Badge>
          </div>
        </div>

        {changesApplied && changesApplied.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Changes Applied
            </h4>
            <div className="space-y-1">
              {changesApplied.map((change, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{change}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={cn(
          "p-4 rounded-lg text-center",
          isOverallImproved ? "bg-green-50 dark:bg-green-950/30" :
          netImprovement < 0 ? "bg-red-50 dark:bg-red-950/30" : "bg-muted/50"
        )}>
          <p className={cn(
            "text-lg font-bold",
            isOverallImproved ? "text-green-700" : netImprovement < 0 ? "text-red-700" : "text-muted-foreground"
          )}>
            {isOverallImproved ? `+${netImprovement}` : netImprovement} Point{Math.abs(netImprovement) !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {isOverallImproved
              ? "Net improvement in diversification"
              : netImprovement < 0
              ? "Reduction in diversification"
              : "No change in diversification"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default BeforeAfterRiskBars;
