import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield as LucideShield, 
  Sparkles,
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { RetirementPlanning } from "@/components/wealth/retirement-planning";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PortfolioRetirement() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateProposalMutation = useMutation({
    mutationFn: async (retirementData: any) => {
      const response = await apiRequest('/api/ai/generate-retirement-proposal', {
        method: 'POST',
        body: JSON.stringify(retirementData)
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Proposal Generated",
        description: "AI has created a retirement investment proposal. Check My Proposals to review.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      setIsGenerating(false);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate proposal. Please try again.",
        variant: "destructive"
      });
      setIsGenerating(false);
    }
  });

  const handleExecute = () => {
    setIsGenerating(true);
    generateProposalMutation.mutate({
      type: 'retirement_planning',
      requestedAt: new Date().toISOString()
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <LucideShield className="w-6 h-6 text-green-600" />
            Retirement Planning
          </h1>
          <p className="text-muted-foreground">Build your retirement corpus with AI-optimized investments</p>
        </div>
        <Button 
          size="lg" 
          onClick={handleExecute}
          disabled={isGenerating}
          className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
          data-testid="button-execute-retirement-plan"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Execute with AI
            </>
          )}
        </Button>
      </div>

      <Card className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
              <Sparkles className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 dark:text-green-100">AI-Powered Retirement Planning</h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Click "Execute with AI" to generate an optimal retirement investment proposal
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Review in Proposals</span>
              <ArrowRight className="w-4 h-4" />
              <span>Approve</span>
              <ArrowRight className="w-4 h-4" />
              <span>Add to Cart</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <RetirementPlanning />
    </div>
  );
}
