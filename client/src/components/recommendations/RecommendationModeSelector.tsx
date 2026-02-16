import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, TrendingUp, AlertTriangle, Scale, Info, Lock } from "lucide-react";

interface RecommendationMode {
  id: string;
  name: string;
  description: string;
  weightings: {
    suitability: number;
    upside: number;
  };
  available: boolean;
  isDefault?: boolean;
  disabledReason?: string;
  requiresDisclosure?: boolean;
}

interface RecommendationModeSelectorProps {
  selectedMode: string;
  onModeChange: (mode: string) => void;
  disabled?: boolean;
  className?: string;
}

export function RecommendationModeSelector({
  selectedMode,
  onModeChange,
  disabled = false,
  className = "",
}: RecommendationModeSelectorProps) {
  const { data, isLoading, error } = useQuery<{
    success: boolean;
    modes: RecommendationMode[];
    killSwitchStatus: { active: boolean; reason?: string };
  }>({
    queryKey: ["/api/recommendations/modes"],
    queryFn: async () => {
      const response = await fetch("/api/recommendations/modes");
      if (!response.ok) throw new Error("Failed to fetch modes");
      return response.json();
    },
  });

  const getModeIcon = (modeId: string) => {
    switch (modeId) {
      case "conservative":
        return <Shield className="h-5 w-5 text-blue-500" />;
      case "balanced":
        return <Scale className="h-5 w-5 text-green-500" />;
      case "growth_optimized":
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getWeightingDisplay = (weightings: { suitability: number; upside: number }) => {
    return (
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span>Suitability: {Math.round(weightings.suitability * 100)}%</span>
        <span>|</span>
        <span>Upside: {Math.round(weightings.upside * 100)}%</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.success) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load recommendation modes</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Recommendation Mode
        </CardTitle>
        <CardDescription>
          Select how recommendations should be weighted for this client
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.killSwitchStatus.active && (
          <Alert variant="destructive" className="mb-4" data-testid="kill-switch-alert">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Growth-Optimized mode is temporarily disabled: {data.killSwitchStatus.reason}
            </AlertDescription>
          </Alert>
        )}

        <RadioGroup
          value={selectedMode}
          onValueChange={onModeChange}
          disabled={disabled}
          className="space-y-3"
        >
          {data.modes.map((mode) => (
            <TooltipProvider key={mode.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-start space-x-3 p-4 rounded-lg border transition-colors
                      ${selectedMode === mode.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
                      ${!mode.available || disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                    onClick={() => mode.available && !disabled && onModeChange(mode.id)}
                    data-testid={`mode-option-${mode.id}`}
                  >
                    <RadioGroupItem
                      value={mode.id}
                      id={mode.id}
                      disabled={!mode.available || disabled}
                      className="mt-1"
                      data-testid={`radio-${mode.id}`}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        {getModeIcon(mode.id)}
                        <Label
                          htmlFor={mode.id}
                          className="text-base font-medium cursor-pointer"
                        >
                          {mode.name}
                        </Label>
                        {mode.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                        {mode.requiresDisclosure && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 dark:border-orange-700">
                            Requires Disclosure
                          </Badge>
                        )}
                        {!mode.available && (
                          <Badge variant="destructive" className="text-xs">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{mode.description}</p>
                      {getWeightingDisplay(mode.weightings)}
                    </div>
                  </div>
                </TooltipTrigger>
                {!mode.available && mode.disabledReason && (
                  <TooltipContent>
                    <p>{mode.disabledReason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </RadioGroup>

        {selectedMode === "growth_optimized" && (
          <Alert className="mt-4 border-orange-200 bg-orange-50 dark:bg-orange-950/20" data-testid="growth-mode-warning">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              Growth-Optimized mode emphasizes upside potential within the client's risk profile.
              A disclosure will be shown to the client with all recommendations.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
