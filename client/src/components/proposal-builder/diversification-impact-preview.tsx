import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiversificationImpact {
  currentScore: number;
  projectedScore: number;
  netImprovement: number;
  changesApplied: string[];
}

interface DiversificationImpactPreviewProps {
  impact: DiversificationImpact;
  compact?: boolean;
}

function ScoreDisplay({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "text-green-600" : score >= 60 ? "text-blue-600" : score >= 40 ? "text-amber-600" : "text-red-600";
  const bg = score >= 75 ? "bg-green-50" : score >= 60 ? "bg-blue-50" : score >= 40 ? "bg-amber-50" : "bg-red-50";
  
  return (
    <div className={cn("p-4 rounded-lg text-center", bg)}>
      <div className={cn("text-3xl font-bold", color)}>{score}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export function DiversificationImpactPreview({ impact, compact = false }: DiversificationImpactPreviewProps) {
  const { currentScore, projectedScore, netImprovement, changesApplied } = impact;
  
  const improvementColor = netImprovement > 0 
    ? "text-green-600 bg-green-50" 
    : netImprovement < 0 
    ? "text-red-600 bg-red-50" 
    : "text-gray-600 bg-gray-50";
  
  const ImprovementIcon = netImprovement > 0 ? TrendingUp : netImprovement < 0 ? TrendingDown : Minus;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
        <span className="text-sm font-medium">{currentScore}</span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{projectedScore}</span>
        <Badge variant="outline" className={cn("text-xs ml-auto", improvementColor)}>
          <ImprovementIcon className="h-3 w-3 mr-1" />
          {netImprovement > 0 ? "+" : ""}{netImprovement}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3 bg-blue-50 dark:bg-blue-950/30">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          Diversification Impact Preview
        </CardTitle>
        <CardDescription>
          Before and after comparison of proposed changes
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-4">
          <ScoreDisplay score={currentScore} label="Current Score" />
          
          <div className="flex flex-col items-center gap-2">
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
            <div className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full font-medium",
              improvementColor
            )}>
              <ImprovementIcon className="h-4 w-4" />
              <span>
                {netImprovement > 0 ? "+" : ""}{netImprovement}
              </span>
            </div>
          </div>
          
          <ScoreDisplay score={projectedScore} label="Projected Score" />
        </div>

        {changesApplied.length > 0 && (
          <div className="mt-4 pt-4 border-t">
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

        {netImprovement > 0 && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              The proposed changes improve your diversification score by {netImprovement} points
              without changing your risk profile.
            </p>
          </div>
        )}
        
        {netImprovement < 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              Warning: The proposed changes would reduce your diversification score by {Math.abs(netImprovement)} points.
              Consider alternative options.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DiversificationImpactPreview;
