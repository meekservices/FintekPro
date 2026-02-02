import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Target,
  Info,
  Edit,
  Loader2,
  HelpCircle,
  CheckCircle2
} from "lucide-react";

interface BenchmarkSelection {
  benchmarkCode: string;
  benchmarkName: string;
  rationale: string;
  isDefault: boolean;
  overriddenBy?: string;
}

interface BenchmarkTransparencyProps {
  goalType: string;
  riskProfile: string;
  horizonYears: number;
  isAdmin?: boolean;
  onBenchmarkChange?: (benchmark: BenchmarkSelection) => void;
}

export function BenchmarkTransparency({ 
  goalType, 
  riskProfile, 
  horizonYears,
  isAdmin = false,
  onBenchmarkChange 
}: BenchmarkTransparencyProps) {
  const { toast } = useToast();
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [newBenchmarkCode, setNewBenchmarkCode] = useState('');
  const [newBenchmarkName, setNewBenchmarkName] = useState('');
  const [newRationale, setNewRationale] = useState('');

  const { data, isLoading, error } = useQuery<{ benchmark: BenchmarkSelection; explanation: string }>({
    queryKey: ['/api/proposal-builder/benchmarks/select', { goalType, riskProfile, horizonYears }],
    queryFn: async () => {
      const params = new URLSearchParams({ goalType, riskProfile, horizonYears: String(horizonYears) });
      const response = await fetch(`/api/proposal-builder/benchmarks/select?${params}`);
      if (!response.ok) throw new Error('Failed to fetch benchmark');
      return response.json();
    },
    enabled: !!goalType && !!riskProfile && !!horizonYears
  });

  const overrideBenchmark = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/proposal-builder/benchmarks/override', {
        method: 'POST',
        body: JSON.stringify({
          goalType,
          riskProfile,
          horizonYearsMin: horizonYears,
          benchmarkCode: newBenchmarkCode,
          benchmarkName: newBenchmarkName,
          rationale: newRationale,
          overriddenBy: 'admin'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposal-builder/benchmarks/select'] });
      setShowOverrideDialog(false);
      toast({
        title: 'Benchmark Updated',
        description: 'The benchmark has been overridden successfully'
      });
      if (onBenchmarkChange && data?.benchmark) {
        onBenchmarkChange({
          benchmarkCode: newBenchmarkCode,
          benchmarkName: newBenchmarkName,
          rationale: newRationale,
          isDefault: false,
          overriddenBy: 'admin'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Override Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading benchmark...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.benchmark) {
    return null;
  }

  const { benchmark, explanation } = data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Performance Benchmark
        </CardTitle>
        <CardDescription>
          Benchmark selected based on your investment profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-medium">{benchmark.benchmarkName}</div>
              <div className="text-sm text-muted-foreground">{benchmark.benchmarkCode}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!benchmark.isDefault && (
              <Badge variant="secondary">
                <Edit className="h-3 w-3 mr-1" />
                Custom
              </Badge>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-sm">
                  <p className="font-medium mb-1">Why this benchmark?</p>
                  <p className="text-sm">{explanation}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            {benchmark.rationale}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div className="p-2 bg-muted rounded">
            <div className="font-medium capitalize">{goalType.replace(/_/g, ' ')}</div>
            <div className="text-xs text-muted-foreground">Goal</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-medium capitalize">{riskProfile}</div>
            <div className="text-xs text-muted-foreground">Risk Profile</div>
          </div>
          <div className="p-2 bg-muted rounded">
            <div className="font-medium">{horizonYears} Years</div>
            <div className="text-xs text-muted-foreground">Horizon</div>
          </div>
        </div>

        {isAdmin && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              setNewBenchmarkCode(benchmark.benchmarkCode);
              setNewBenchmarkName(benchmark.benchmarkName);
              setNewRationale(benchmark.rationale);
              setShowOverrideDialog(true);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Override Benchmark (Admin)
          </Button>
        )}

        <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override Benchmark</DialogTitle>
              <DialogDescription>
                Set a custom benchmark for this goal/risk/horizon combination
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Benchmark Code</label>
                <Input
                  value={newBenchmarkCode}
                  onChange={(e) => setNewBenchmarkCode(e.target.value)}
                  placeholder="e.g., NIFTY50, SENSEX"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Benchmark Name</label>
                <Input
                  value={newBenchmarkName}
                  onChange={(e) => setNewBenchmarkName(e.target.value)}
                  placeholder="e.g., NIFTY 50 TRI"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rationale</label>
                <Textarea
                  value={newRationale}
                  onChange={(e) => setNewRationale(e.target.value)}
                  placeholder="Explain why this benchmark is appropriate..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowOverrideDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => overrideBenchmark.mutate()}
                disabled={overrideBenchmark.isPending || !newBenchmarkCode || !newBenchmarkName}
              >
                {overrideBenchmark.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
