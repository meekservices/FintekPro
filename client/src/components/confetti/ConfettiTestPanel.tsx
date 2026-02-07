import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { triggerCelebrationConfetti } from "@/components/portfolio/PortfolioConfetti";
import { 
  Sparkles, 
  TrendingUp, 
  Target,
  IndianRupee,
  Percent,
  Crown,
  Settings
} from "lucide-react";

interface ConfettiTestPanelProps {
  confettiEnabled: boolean;
  onToggleConfetti: (enabled: boolean) => void;
}

export function ConfettiTestPanel({ confettiEnabled, onToggleConfetti }: ConfettiTestPanelProps) {
  const [lastTriggered, setLastTriggered] = useState<string | null>(null);

  const handleTriggerConfetti = (type: "profit" | "percentage" | "milestone", label: string) => {
    if (confettiEnabled) {
      triggerCelebrationConfetti(type);
      setLastTriggered(`${label} - ${new Date().toLocaleTimeString()}`);
    }
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-800">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Portfolio Confetti Controls
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-sm text-purple-700">Enable Celebrations:</span>
          <Switch 
            checked={confettiEnabled} 
            onCheckedChange={onToggleConfetti}
            data-testid="toggle-confetti"
          />
          <Badge variant={confettiEnabled ? "default" : "secondary"}>
            {confettiEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Test Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTriggerConfetti("profit", "Profit Milestone")}
            disabled={!confettiEnabled}
            className="flex items-center gap-2 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            data-testid="trigger-profit-confetti"
          >
            <IndianRupee className="w-4 h-4" />
            Test Profit Milestone
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={() => handleTriggerConfetti("percentage", "Percentage Gain")}
            disabled={!confettiEnabled}
            className="flex items-center gap-2 border-green-300 text-green-700 hover:bg-green-50"
            data-testid="trigger-percentage-confetti"
          >
            <Percent className="w-4 h-4" />
            Test Percentage Gain
          </Button>
          
          <Button
            variant="outline"
            size="sm" 
            onClick={() => handleTriggerConfetti("milestone", "All-Time High")}
            disabled={!confettiEnabled}
            className="flex items-center gap-2 border-pink-300 text-pink-700 hover:bg-pink-50"
            data-testid="trigger-milestone-confetti"
          >
            <Crown className="w-4 h-4" />
            Test All-Time High
          </Button>
        </div>

        {/* Status Display */}
        {lastTriggered && (
          <div className="p-3 bg-purple-100 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-800">Last Celebration:</span>
            </div>
            <p className="text-sm text-purple-700 mt-1">{lastTriggered}</p>
          </div>
        )}

        {/* Real-time Performance Indicators */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-purple-800 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Celebration Triggers
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-card rounded border">
              <div className="font-medium text-muted-foreground">Profit Milestones</div>
              <div className="text-muted-foreground">₹1L, ₹5L, ₹10L, ₹25L, ₹50L, ₹1Cr+</div>
            </div>
            <div className="p-2 bg-card rounded border">
              <div className="font-medium text-muted-foreground">Percentage Gains</div>
              <div className="text-muted-foreground">10%, 25%, 50%, 75%, 100%+</div>
            </div>
            <div className="p-2 bg-card rounded border">
              <div className="font-medium text-muted-foreground">Daily Gains</div>
              <div className="text-muted-foreground">₹10K+ or 2%+ today</div>
            </div>
            <div className="p-2 bg-card rounded border">
              <div className="font-medium text-muted-foreground">All-Time Highs</div>
              <div className="text-muted-foreground">₹50K+ portfolio increase</div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <Settings className="w-4 h-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">How it Works</p>
              <p className="text-xs text-blue-700 mt-1">
                The portfolio confetti system automatically triggers celebrations when your portfolio hits positive milestones. 
                Real-time data updates every 2 seconds, watching for profit thresholds, percentage gains, and significant value increases.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}