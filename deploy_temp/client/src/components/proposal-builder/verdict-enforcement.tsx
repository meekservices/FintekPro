import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Minus, 
  TrendingDown,
  Loader2 
} from "lucide-react";

type Verdict = 'BUY' | 'HOLD' | 'SELL';

interface VerdictValidation {
  valid: boolean;
  totalInstruments: number;
  withVerdict: number;
  withoutVerdict: number;
  instrumentsMissing: string[];
  errors: string[];
}

interface VerdictSummary {
  proposalId: string;
  buyCount: number;
  holdCount: number;
  sellCount: number;
  buyTotal: number;
  holdTotal: number;
  sellTotal: number;
  exitLoadImpact: number;
  taxImpact: number;
  verdicts: Array<{
    instrumentType: string;
    instrumentIsin?: string;
    instrumentName: string;
    verdict: Verdict;
    rationale: string;
    currentValue?: number;
    targetValue?: number;
    exitLoadApplicable?: boolean;
    capitalGainsType?: string;
  }>;
}

interface VerdictEnforcementProps {
  proposalId: string;
  onVerdictComplete?: () => void;
}

const VERDICT_CONFIG: Record<Verdict, { label: string; color: string; icon: React.ReactNode }> = {
  BUY: { 
    label: 'BUY', 
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: <TrendingUp className="h-3 w-3" />
  },
  HOLD: { 
    label: 'HOLD', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Minus className="h-3 w-3" />
  },
  SELL: { 
    label: 'SELL', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: <TrendingDown className="h-3 w-3" />
  }
};

export function VerdictEnforcement({ proposalId, onVerdictComplete }: VerdictEnforcementProps) {
  const { toast } = useToast();
  const [selectedInstrument, setSelectedInstrument] = useState<string | null>(null);
  const [verdictValue, setVerdictValue] = useState<Verdict>('HOLD');
  const [rationale, setRationale] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  const { data: validation } = useQuery<VerdictValidation>({
    queryKey: ['/api/proposal-builder/verdicts', proposalId, 'validate'],
    queryFn: async () => {
      const response = await fetch(`/api/proposal-builder/verdicts/${proposalId}/validate`);
      if (!response.ok) throw new Error('Failed to fetch validation');
      return response.json();
    },
    enabled: !!proposalId
  });

  const { data: summary, isLoading } = useQuery<VerdictSummary>({
    queryKey: ['/api/proposal-builder/verdicts', proposalId, 'summary'],
    queryFn: async () => {
      const response = await fetch(`/api/proposal-builder/verdicts/${proposalId}/summary`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      return response.json();
    },
    enabled: !!proposalId
  });

  const assignVerdict = useMutation({
    mutationFn: async (data: { instrumentName: string; verdict: Verdict; rationale: string }) => {
      return apiRequest(`/api/proposal-builder/verdicts/${proposalId}`, {
        method: 'POST',
        body: JSON.stringify({
          instrumentType: 'mutual_fund',
          instrumentName: data.instrumentName,
          verdict: data.verdict,
          rationale: data.rationale
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposal-builder/verdicts', proposalId] });
      setShowDialog(false);
      setSelectedInstrument(null);
      setRationale('');
      toast({
        title: 'Verdict Assigned',
        description: 'Instrument verdict has been updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Assignment Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const handleAssignClick = (instrumentName: string, currentVerdict?: Verdict) => {
    setSelectedInstrument(instrumentName);
    setVerdictValue(currentVerdict || 'HOLD');
    setShowDialog(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Verdict Assignment
        </CardTitle>
        <CardDescription>
          Assign BUY/HOLD/SELL verdicts to each instrument
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {validation && !validation.valid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {validation.withoutVerdict} instrument(s) missing verdicts. 
              Complete all verdicts to proceed.
            </AlertDescription>
          </Alert>
        )}

        {validation?.valid && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-600">
              All instruments have verdicts assigned. Ready to proceed.
            </AlertDescription>
          </Alert>
        )}

        {summary && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.buyCount}</div>
              <div className="text-xs text-muted-foreground">BUY</div>
              <div className="text-sm font-medium">{formatCurrency(summary.buyTotal)}</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{summary.holdCount}</div>
              <div className="text-xs text-muted-foreground">HOLD</div>
              <div className="text-sm font-medium">{formatCurrency(summary.holdTotal)}</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{summary.sellCount}</div>
              <div className="text-xs text-muted-foreground">SELL</div>
              <div className="text-sm font-medium">{formatCurrency(summary.sellTotal)}</div>
            </div>
          </div>
        )}

        {summary?.verdicts && summary.verdicts.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instrument</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Target Value</TableHead>
                <TableHead className="text-center">Verdict</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.verdicts.map((verdict) => {
                const config = VERDICT_CONFIG[verdict.verdict];
                return (
                  <TableRow key={verdict.instrumentName}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{verdict.instrumentName}</div>
                        {verdict.instrumentIsin && (
                          <div className="text-xs text-muted-foreground">{verdict.instrumentIsin}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(verdict.currentValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(verdict.targetValue)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={config.color}>
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignClick(verdict.instrumentName, verdict.verdict)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {validation?.instrumentsMissing && validation.instrumentsMissing.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-destructive">Missing Verdicts:</h4>
            <div className="flex flex-wrap gap-2">
              {validation.instrumentsMissing.map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive"
                  onClick={() => handleAssignClick(name)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Verdict</DialogTitle>
              <DialogDescription>Select a verdict for this instrument</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="font-medium">{selectedInstrument}</div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Verdict</label>
                <Select value={verdictValue} onValueChange={(v) => setVerdictValue(v as Verdict)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        BUY - Recommend purchasing
                      </div>
                    </SelectItem>
                    <SelectItem value="HOLD">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-blue-600" />
                        HOLD - Maintain position
                      </div>
                    </SelectItem>
                    <SelectItem value="SELL">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        SELL - Recommend selling
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Rationale</label>
                <Textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Enter reasoning for this verdict..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedInstrument) {
                    assignVerdict.mutate({
                      instrumentName: selectedInstrument,
                      verdict: verdictValue,
                      rationale
                    });
                  }
                }}
                disabled={assignVerdict.isPending}
              >
                {assignVerdict.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign Verdict
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
