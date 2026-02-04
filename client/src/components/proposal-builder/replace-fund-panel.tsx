import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AlternativeFund {
  isin: string;
  name: string;
  category: string;
  overlapReduction: number;
  diversificationGain: number;
  expenseRatio?: number;
  sharpeRatio?: number;
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

interface ReplaceFundPanelProps {
  suggestions: ReplaceFundSuggestion[];
  onViewImpact?: (suggestion: ReplaceFundSuggestion, alternative?: AlternativeFund) => void;
  onApplySwitch?: (suggestion: ReplaceFundSuggestion, alternative: AlternativeFund) => void;
}

const actionConfig = {
  SWITCH: { color: "bg-red-100 text-red-700 border-red-200", label: "Switch" },
  REDUCE: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Reduce" },
  REVIEW: { color: "bg-blue-100 text-blue-700 border-blue-200", label: "Review" },
};

function ReplaceFundCard({
  suggestion,
  onViewImpact,
  onApplySwitch,
}: {
  suggestion: ReplaceFundSuggestion;
  onViewImpact?: (suggestion: ReplaceFundSuggestion, alternative?: AlternativeFund) => void;
  onApplySwitch?: (suggestion: ReplaceFundSuggestion, alternative: AlternativeFund) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = actionConfig[suggestion.suggestedAction];

  return (
    <div className="border rounded-lg overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">{suggestion.fundToReplace}</p>
                <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {suggestion.overlapPercentage.toFixed(0)}% overlap
              </Badge>
              <Badge variant="outline" className={cn("text-xs", config.color)}>
                {config.label}
              </Badge>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/30">
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Fund to Replace</p>
                <p className="font-medium text-sm">{suggestion.fundToReplace}</p>
                <p className="text-xs text-red-600 mt-1">
                  Overlaps with {suggestion.overlapWith}
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Metrics Comparison</p>
                <p className="text-sm">{suggestion.metricsComparison || "Lower portfolio contribution"}</p>
              </div>
            </div>

            {suggestion.alternatives.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Suggested Alternatives
                </h4>
                <div className="space-y-2">
                  {suggestion.alternatives.map((alt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-4 w-4 text-green-600" />
                          <p className="font-medium text-sm">{alt.name}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs">
                          <span className="text-muted-foreground">{alt.category}</span>
                          {alt.expenseRatio && (
                            <span className="text-muted-foreground">TER: {alt.expenseRatio}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-green-600">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-sm font-medium">+{alt.diversificationGain}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">diversification</p>
                        </div>
                        <div className="flex gap-1">
                          {onViewImpact && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onViewImpact(suggestion, alt)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Impact
                            </Button>
                          )}
                          {onApplySwitch && (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => onApplySwitch(suggestion, alt)}
                            >
                              <RefreshCw className="h-3.5 w-3.5 mr-1" />
                              Switch
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestion.alternatives.length === 0 && (
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  No low-overlap alternatives found in the same category.
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function ReplaceFundPanel({
  suggestions,
  onViewImpact,
  onApplySwitch,
}: ReplaceFundPanelProps) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3 bg-amber-50 dark:bg-amber-950/30">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-amber-600" />
          Replace Fund Recommendations
        </CardTitle>
        <CardDescription>
          {suggestions.length} fund(s) identified for potential replacement due to high overlap
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {suggestions.map((suggestion, idx) => (
          <ReplaceFundCard
            key={idx}
            suggestion={suggestion}
            onViewImpact={onViewImpact}
            onApplySwitch={onApplySwitch}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default ReplaceFundPanel;
