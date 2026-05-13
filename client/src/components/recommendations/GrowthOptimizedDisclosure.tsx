import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Shield as LucideShield, Info } from "lucide-react";

interface GrowthOptimizedDisclosureProps {
  variant?: "banner" | "card" | "inline";
  showFooter?: boolean;
  className?: string;
}

const DISCLOSURE_TEXT = {
  banner: "This recommendation emphasizes growth opportunities within your risk profile. Returns may vary.",
  footer: "This recommendation emphasizes growth opportunities within your risk profile. Returns may vary. Past performance is not indicative of future results. Please consult your financial advisor before making investment decisions.",
};

export function GrowthOptimizedDisclosure({
  variant = "banner",
  showFooter = true,
  className = "",
}: GrowthOptimizedDisclosureProps) {
  if (variant === "banner") {
    return (
      <Alert
        className={`border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 ${className}`}
        data-testid="growth-disclosure-banner"
      >
        <TrendingUp className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800 dark:text-orange-200 font-medium flex items-center gap-2">
          Growth-Optimized Recommendation
          <Badge variant="outline" className="text-xs border-orange-400 text-orange-700 dark:text-orange-300">
            Higher Upside Weighting
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-300 mt-1">
          {DISCLOSURE_TEXT.banner}
        </AlertDescription>
      </Alert>
    );
  }

  if (variant === "card") {
    return (
      <Card className={`border-orange-200 dark:border-orange-800 ${className}`} data-testid="growth-disclosure-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/50">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                  Growth-Optimized Mode Active
                </h4>
                <Badge variant="outline" className="text-xs border-orange-400 text-orange-700 dark:text-orange-300">
                  55% Upside / 45% Suitability
                </Badge>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {DISCLOSURE_TEXT.banner}
              </p>
              
              {showFooter && (
                <div className="pt-2 border-t border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      {DISCLOSURE_TEXT.footer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 ${className}`}
      data-testid="growth-disclosure-inline"
    >
      <TrendingUp className="h-4 w-4 text-orange-600 flex-shrink-0" />
      <span className="text-sm text-orange-700 dark:text-orange-300">
        Growth-Optimized • {DISCLOSURE_TEXT.banner}
      </span>
    </div>
  );
}

interface RecommendationFooterProps {
  mode: string;
  className?: string;
}

export function RecommendationFooter({ mode, className = "" }: RecommendationFooterProps) {
  if (mode !== "growth_optimized") {
    return null;
  }

  return (
    <div
      className={`mt-4 p-3 rounded-md bg-background border border-border ${className}`}
      data-testid="recommendation-footer"
    >
      <div className="flex items-start gap-2">
        <LucideShield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">
            Important Disclosure
          </p>
          <p className="text-xs text-muted-foreground">
            {DISCLOSURE_TEXT.footer}
          </p>
        </div>
      </div>
    </div>
  );
}

interface ScoringExplanationProps {
  suitabilityScore: number;
  upsideScore: number;
  finalScore: number;
  mode: string;
  className?: string;
}

export function ScoringExplanation({
  suitabilityScore,
  upsideScore,
  finalScore,
  mode,
  className = "",
}: ScoringExplanationProps) {
  const getWeightings = () => {
    switch (mode) {
      case "conservative":
        return { suitability: 85, upside: 15 };
      case "balanced":
        return { suitability: 70, upside: 30 };
      case "growth_optimized":
        return { suitability: 55, upside: 45 };
      default:
        return { suitability: 70, upside: 30 };
    }
  };

  const weightings = getWeightings();

  return (
    <Card className={className} data-testid="scoring-explanation">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">Score Breakdown</h4>
          <Badge variant="secondary" className="text-xs capitalize">
            {mode.replace("_", " ")} Mode
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Suitability Score</span>
              <span className="font-medium">{suitabilityScore}/100 × {weightings.suitability}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${suitabilityScore}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Upside Score</span>
              <span className="font-medium">{upsideScore}/100 × {weightings.upside}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${upsideScore}%` }}
              />
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Final Score</span>
              <span className="text-lg font-bold text-primary">{finalScore}/100</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              = ({suitabilityScore} × {weightings.suitability/100}) + ({upsideScore} × {weightings.upside/100})
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
