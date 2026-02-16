import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  IndianRupee,
  Calendar,
  Shield,
  BarChart3,
  Lightbulb,
  ArrowRight,
  Clock,
  PieChart,
  FileText,
  Send
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProposalItem {
  id: string;
  type: 'sip' | 'lumpsum' | 'switch' | 'redeem';
  schemeName: string;
  schemeCode: string;
  amount: number;
  folioNumber?: string;
  recommendedBy: 'agent' | 'smart_system';
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  expectedReturns: string;
  riskLevel: string;
  investmentHorizon: string;
  taxBenefits?: string;
  status: 'pending' | 'processing' | 'executed' | 'failed';
  createdAt: string;
}

interface ProposalsProps {
  portfolioId?: string;
}

export function Proposals({ portfolioId }: ProposalsProps) {
  const [selectedProposals, setSelectedProposals] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch investment proposals
  const { data: proposals, isLoading, error, refetch } = useQuery<ProposalItem[]>({
    queryKey: ["/api/proposals", portfolioId],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Execute proposals mutation
  const executeProposalsMutation = useMutation({
    mutationFn: async (proposalIds: string[]) => {
      const response = await fetch(`/api/proposals/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalIds, portfolioId })
      });
      if (!response.ok) throw new Error('Failed to execute proposals');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", portfolioId] });
      setSelectedProposals([]);
      alert("Proposals executed successfully! Your investment orders have been placed through MF Central.");
    },
    onError: (error) => {
      console.error("Failed to execute proposals:", error);
      alert("Failed to execute proposals. Please try again.");
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sip':
        return <Calendar className="w-4 h-4" />;
      case 'lumpsum':
        return <IndianRupee className="w-4 h-4" />;
      case 'switch':
        return <ArrowRight className="w-4 h-4" />;
      case 'redeem':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'processing':
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'executed':
        return 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'failed':
        return 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleProposalSelect = (proposalId: string) => {
    setSelectedProposals(prev => 
      prev.includes(proposalId) 
        ? prev.filter(id => id !== proposalId)
        : [...prev, proposalId]
    );
  };

  const handleExecuteSelected = () => {
    if (selectedProposals.length === 0) {
      alert("Please select at least one proposal to execute.");
      return;
    }
    
    const selectedItems = proposals?.filter(p => selectedProposals.includes(p.id)) || [];
    const totalAmount = selectedItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (confirm(`Execute ${selectedProposals.length} proposals with total amount ${formatCurrency(totalAmount)}?`)) {
      executeProposalsMutation.mutate(selectedProposals);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Investment Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !proposals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Investment Proposals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load investment proposals. Please try again.
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const executedProposals = proposals.filter(p => p.status === 'executed');
  const totalPendingAmount = pendingProposals.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card data-testid="card-proposals-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Investment Proposals
          </CardTitle>
          <CardDescription>
            Execute AI-recommended investment orders through MF Central API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-2xl font-bold text-yellow-600">{pendingProposals.length}</div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Pending Proposals</p>
              <p className="text-xs text-yellow-600">{formatCurrency(totalPendingAmount)}</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">{executedProposals.length}</div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Executed This Month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">{selectedProposals.length}</div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Selected for Execution</p>
            </div>
          </div>
          
          {selectedProposals.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button 
                onClick={handleExecuteSelected}
                disabled={executeProposalsMutation.isPending}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-foreground"
                data-testid="button-execute-proposals"
              >
                <Send className="w-4 h-4 mr-2" />
                {executeProposalsMutation.isPending ? "Executing..." : `Execute ${selectedProposals.length} Proposals`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Proposals */}
      {pendingProposals.length > 0 && (
        <Card data-testid="card-pending-proposals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Pending Investment Proposals
            </CardTitle>
            <CardDescription>
              Review and execute these AI-recommended investments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingProposals.map((proposal, index) => (
              <div 
                key={proposal.id} 
                className={`border rounded-lg p-4 space-y-3 cursor-pointer transition-colors ${
                  selectedProposals.includes(proposal.id) 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                    : 'border-border hover:border-border'
                }`}
                onClick={() => handleProposalSelect(proposal.id)}
                data-testid={`proposal-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded ${selectedProposals.includes(proposal.id) ? 'bg-blue-200 dark:bg-blue-800/30' : 'bg-muted'}`}>
                      {getTypeIcon(proposal.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{proposal.schemeName}</h4>
                        <Badge variant={getPriorityColor(proposal.priority)}>
                          {proposal.priority.toUpperCase()}
                        </Badge>
                        <Badge variant="outline">
                          {proposal.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Code: {proposal.schemeCode} • Recommended by {proposal.recommendedBy === 'agent' ? 'Agent' : 'Smart System'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(proposal.amount)}</p>
                    <div className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(proposal.status)}`}>
                      {proposal.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Expected Returns</p>
                    <p className="font-medium text-green-600">{proposal.expectedReturns}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Risk Level</p>
                    <p className="font-medium">{proposal.riskLevel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Investment Horizon</p>
                    <p className="font-medium">{proposal.investmentHorizon}</p>
                  </div>
                  {proposal.taxBenefits && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Tax Benefits</p>
                      <p className="font-medium text-green-600">{proposal.taxBenefits}</p>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Investment Rationale</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">{proposal.rationale}</p>
                    </div>
                  </div>
                </div>

                {selectedProposals.includes(proposal.id) && (
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-200 text-center">
                    ✓ Selected for execution
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Executions */}
      {executedProposals.length > 0 && (
        <Card data-testid="card-executed-proposals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Recently Executed Proposals
            </CardTitle>
            <CardDescription>
              Successfully processed investment orders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {executedProposals.slice(0, 5).map((proposal, index) => (
              <div 
                key={proposal.id} 
                className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                data-testid={`executed-proposal-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-200 dark:bg-green-800/30 rounded">
                      {getTypeIcon(proposal.type)}
                    </div>
                    <div>
                      <h4 className="font-medium">{proposal.schemeName}</h4>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Executed • {formatCurrency(proposal.amount)}
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {proposals.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Investment Proposals</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Investment proposals will appear here when generated by the AI system or agent recommendations
            </p>
            <Button variant="outline" onClick={() => refetch()}>
              Refresh Proposals
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}