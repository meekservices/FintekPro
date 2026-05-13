import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, LucideShield as LucideShield, TrendingUp, Calculator, AlertTriangle, 
  CheckCircle, Info, Zap, Lock
} from "lucide-react";

interface FeeModeSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModeSelected?: () => void;
}

type FeeMode = 'ADVISORY_PLATFORM' | 'PLATFORM_ONLY';

export function FeeModeSelectionModal({ open, onOpenChange, onModeSelected }: FeeModeSelectionModalProps) {
  const [selectedMode, setSelectedMode] = useState<FeeMode | null>(null);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const { toast } = useToast();

  const { data: currentSettings } = useQuery<{
    success: boolean;
    feeMode: string | null;
    platformOnlyEnabled: boolean;
    selfSelectionAllowed: boolean;
  }>({
    queryKey: ["/api/fee-mode/current"],
    enabled: open
  });

  const selectModeMutation = useMutation({
    mutationFn: async (data: { feeMode: FeeMode; disclaimerAcknowledged: boolean }) => {
      const response = await apiRequest("POST", "/api/fee-mode/select", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Fee Mode Selected",
        description: "Your investment mode has been saved successfully."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fee-mode"] });
      onModeSelected?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Selection Failed",
        description: error.message || "Failed to save your selection. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (!selectedMode || !disclaimerAcknowledged) return;
    selectModeMutation.mutate({ feeMode: selectedMode, disclaimerAcknowledged });
  };

  const isSubmitDisabled = !selectedMode || !disclaimerAcknowledged || selectModeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="fee-mode-selection-modal">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Choose Your Investment Mode
          </DialogTitle>
          <DialogDescription>
            Select how you'd like to invest in Global Markets. This choice affects the services and fees applicable to you.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Card 
            className={`cursor-pointer transition-all border-2 ${
              selectedMode === 'ADVISORY_PLATFORM' 
                ? 'border-primary bg-primary/5' 
                : 'border-muted hover:border-primary/50'
            }`}
            onClick={() => setSelectedMode('ADVISORY_PLATFORM')}
            data-testid="option-advisory-platform"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  Advisory + Platform
                </CardTitle>
                <Badge variant="default" className="bg-amber-500">Recommended</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Get personalized AI-powered recommendations and expert advisory services for your global investments.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>AI-powered investment recommendations</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>"Recommended for You" personalized picks</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Portfolio analysis and insights</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Search and trade all securities</span>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calculator className="h-4 w-4" />
                  <span>Advisory Fee + Platform Fee applicable</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {currentSettings?.platformOnlyEnabled && (
            <Card 
              className={`cursor-pointer transition-all border-2 ${
                selectedMode === 'PLATFORM_ONLY' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => setSelectedMode('PLATFORM_ONLY')}
              data-testid="option-platform-only"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-blue-500" />
                  Platform-Only (Execution-Only)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use our platform for self-directed trading without advisory services. You make your own investment decisions.
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Search and trade all securities</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Real-time market data</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span>AI recommendations disabled</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span>"Recommended for You" hidden</span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calculator className="h-4 w-4" />
                    <span>Platform Fee only (no advisory fee)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedMode === 'PLATFORM_ONLY' && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Execution-Only Disclaimer</AlertTitle>
              <AlertDescription className="text-sm">
                By selecting Platform-Only mode, you acknowledge that:
                <ul className="list-disc ml-4 mt-2 space-y-1">
                  <li>You will make investment decisions independently</li>
                  <li>No personalized recommendations will be provided</li>
                  <li>AI-powered features will be disabled</li>
                  <li>FintekPro is not responsible for your investment choices</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-start space-x-3 pt-4 border-t">
            <Checkbox 
              id="disclaimer" 
              checked={disclaimerAcknowledged}
              onCheckedChange={(checked) => setDisclaimerAcknowledged(checked as boolean)}
              data-testid="checkbox-disclaimer"
            />
            <label htmlFor="disclaimer" className="text-sm leading-tight cursor-pointer">
              I understand and acknowledge the fee structure and service offerings for my selected mode. 
              I confirm this selection is made voluntarily.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={selectModeMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            data-testid="button-submit-fee-mode"
          >
            {selectModeMutation.isPending ? "Saving..." : "Confirm Selection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
