import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Sparkles,
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { GoalPlanning } from "@/components/wealth/goal-planning";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function PortfolioGoals() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateProposalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      const response = await apiRequest('/api/ai/generate-goal-proposal', {
        method: 'POST',
        body: JSON.stringify(goalData)
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Proposal Generated",
        description: "AI has created an investment proposal for your goals. Check My Proposals to review.",
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
      type: 'goal_planning',
      goals: [],
      requestedAt: new Date().toISOString()
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Goal Planning
          </h1>
          <p className="text-muted-foreground">Plan and achieve your financial goals with AI-powered insights</p>
        </div>
        <Button 
          size="lg" 
          onClick={handleExecute}
          disabled={isGenerating}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          data-testid="button-execute-goal-plan"
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

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">AI-Powered Goal Planning</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Click "Execute with AI" to generate a tailored investment proposal based on your goals
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

      <GoalPlanning />
    </div>
  );
}
