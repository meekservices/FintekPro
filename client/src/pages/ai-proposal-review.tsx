import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Loader2,
  PieChart,
  BarChart3,
  AlertTriangle,
  LucideShield as LucideShield,
  ShoppingCart,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Info
} from "lucide-react";

interface ProposalItem {
  id: string;
  proposalId: string;
  actionType: "BUY" | "SELL" | "SWITCH" | "HOLD";
  assetClass: string;
  isin?: string;
  schemeName: string;
  amcName?: string;
  amount?: number;
  currentValue?: number;
  switchFromSchemeName?: string;
  rationale: string;
  problemIdentified?: string;
  riskInvolved?: string;
  portfolioImpactSummary?: string;
  riskImpactPercent?: string;
  status: string;
  priority?: number;
  clientApprovedAt?: string;
  clientRejectedAt?: string;
  clientRejectionReason?: string;
}

interface Proposal {
  id: string;
  clientId: string;
  agentId?: string;
  diagnosticsId: string;
  title: string;
  sebiDisclaimer: string;
  status: string;
  approvedItemsCount: number;
  rejectedItemsCount: number;
  totalRecommendations: number;
  createdAt: string;
  submittedAt?: string;
}

interface PortfolioDiagnostics {
  id: string;
  healthScore: number;
  healthSummary: string;
  allocationDeviation: Record<string, { current: number; target: number; deviation: number }>;
  portfolioRiskScore: string;
  clientRiskTolerance: string;
}

const actionTypeIcons: Record<string, any> = {
  BUY: TrendingUp,
  SELL: TrendingDown,
  SWITCH: ArrowRightLeft,
  HOLD: Clock,
};

const actionTypeColors: Record<string, string> = {
  BUY: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  SELL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  SWITCH: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  HOLD: "bg-muted text-foreground",
};

export default function AIProposalReviewPage() {
  const { id } = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<PortfolioDiagnostics | null>(null);
  const [rejectingItem, setRejectingItem] = useState<ProposalItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proposals = [], isLoading: loadingProposals } = useQuery({
    queryKey: ['/api/ai-proposals/proposals'],
    queryFn: async () => {
      const res = await fetch('/api/ai-proposals/proposals', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch proposals');
      return res.json() as Promise<Proposal[]>;
    },
  });

  useEffect(() => {
    if (id) {
      loadProposalDetails(id);
    }
  }, [id]);

  const loadProposalDetails = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/ai-proposals/proposals/${proposalId}`, { credentials: 'include' });
      const data = await res.json();
      setSelectedProposal(data.proposal);
      setProposalItems(data.items || []);

      if (data.proposal?.diagnosticsId) {
        const diagRes = await fetch(`/api/ai-proposals/diagnostics/${data.proposal.diagnosticsId}`, { credentials: 'include' });
        const diagData = await diagRes.json();
        setDiagnostics(diagData);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load proposal details",
      });
    }
  };

  const approveItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest(`/api/ai-proposals/items/${itemId}/approve`, { 
        method: 'POST', 
        body: JSON.stringify({}) 
      });
    },
    onSuccess: (data) => {
      setProposalItems(items => items.map(item => item.id === data.id ? data : item));
      toast({ title: "Recommendation Approved" });
      if (selectedProposal) loadProposalDetails(selectedProposal.id);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const rejectItemMutation = useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      return await apiRequest(`/api/ai-proposals/items/${itemId}/reject`, { 
        method: 'POST', 
        body: JSON.stringify({ reason }) 
      });
    },
    onSuccess: (data) => {
      setProposalItems(items => items.map(item => item.id === data.id ? data : item));
      setRejectingItem(null);
      setRejectReason("");
      toast({ title: "Recommendation Declined" });
      if (selectedProposal) loadProposalDetails(selectedProposal.id);
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest(`/api/ai-proposals/proposals/${proposalId}/finalize`, { 
        method: 'POST', 
        body: JSON.stringify({}) 
      });
    },
    onSuccess: () => {
      setShowFinalizeDialog(false);
      toast({
        title: "Proposal Finalized",
        description: "Approved items have been added to your cart",
      });
      navigate("/cart");
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const handleApproveItem = (itemId: string) => {
    approveItemMutation.mutate(itemId);
  };

  const handleRejectItem = () => {
    if (!rejectingItem || !rejectReason.trim()) return;
    rejectItemMutation.mutate({ itemId: rejectingItem.id, reason: rejectReason });
  };

  const handleFinalize = () => {
    if (!selectedProposal || !disclaimerAccepted) return;
    finalizeMutation.mutate(selectedProposal.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const pendingItems = proposalItems.filter(i => i.status === "pending");
  const approvedItems = proposalItems.filter(i => i.status === "approved");
  const rejectedItems = proposalItems.filter(i => i.status === "rejected");

  const pendingProposals = proposals.filter(p => p.status === "pending_review");

  if (!selectedProposal && !id) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Investment Proposals</h1>
          </div>
          <p className="text-muted-foreground">
            Review personalized investment recommendations from your advisor
          </p>
        </div>

        {loadingProposals ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Loading proposals...</p>
            </CardContent>
          </Card>
        ) : pendingProposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Proposals</h3>
              <p className="text-muted-foreground">
                Your advisor hasn't sent any AI proposals for review yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingProposals.map((proposal) => (
              <Card key={proposal.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/ai-proposal-review/${proposal.id}`)} data-testid={`card-proposal-${proposal.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        {proposal.title}
                      </CardTitle>
                      <CardDescription>
                        {new Date(proposal.createdAt).toLocaleDateString()} • {proposal.totalRecommendations} recommendations
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!selectedProposal) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading proposal...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/ai-proposal-review")} className="mb-4" data-testid="button-back">
          ← Back to Proposals
        </Button>
        <div className="flex items-center gap-3 mb-2">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{selectedProposal.title}</h1>
        </div>
        <p className="text-muted-foreground">
          Created: {new Date(selectedProposal.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingItems.length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{approvedItems.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Declined</p>
                <p className="text-2xl font-bold text-red-600">{rejectedItems.length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {diagnostics && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Portfolio Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold" style={{ color: diagnostics.healthScore >= 70 ? "#22c55e" : diagnostics.healthScore >= 50 ? "#eab308" : "#ef4444" }}>
                  {diagnostics.healthScore}/100
                </p>
                <p className="text-sm text-muted-foreground">Health Score</p>
              </div>
              <Separator orientation="vertical" className="h-16" />
              <div className="flex-1">
                <p className="text-sm">{diagnostics.healthSummary}</p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-sm">
              {Object.entries(diagnostics.allocationDeviation || {}).map(([asset, data]) => (
                <div key={asset} className="text-center p-2 bg-muted rounded">
                  <p className="font-medium capitalize">{asset}</p>
                  <p className={data.deviation > 5 ? "text-orange-600" : data.deviation < -5 ? "text-red-600" : "text-green-600"}>
                    {data.current?.toFixed(0)}%
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Alert className="mb-6 bg-amber-50 dark:bg-amber-950 border-amber-200">
        <LucideShield className="h-4 w-4" />
        <AlertTitle>SEBI Compliance Disclaimer</AlertTitle>
        <AlertDescription className="text-xs mt-2">
          {selectedProposal.sebiDisclaimer}
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Review Recommendations</CardTitle>
          <CardDescription>
            Approve or decline each recommendation. Approved items will be added to your cart.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {proposalItems.map((item) => {
                const ActionIcon = actionTypeIcons[item.actionType] || Clock;
                const isApproved = item.status === "approved";
                const isRejected = item.status === "rejected";

                return (
                  <Card key={item.id} className={`border-l-4 ${isApproved ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/20" : isRejected ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/20" : ""}`} style={{ borderLeftColor: !isApproved && !isRejected ? (item.actionType === "BUY" ? "#22c55e" : item.actionType === "SELL" ? "#ef4444" : item.actionType === "SWITCH" ? "#3b82f6" : "#6b7280") : undefined }} data-testid={`card-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={actionTypeColors[item.actionType]}>
                            <ActionIcon className="h-3 w-3 mr-1" />
                            {item.actionType}
                          </Badge>
                          {isApproved && <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>}
                          {isRejected && <Badge variant="outline" className="text-red-600 border-red-600"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>}
                        </div>
                      </div>

                      <h4 className="font-semibold mb-1">{item.schemeName}</h4>
                      {item.amcName && <p className="text-sm text-muted-foreground mb-2">{item.amcName}</p>}

                      {item.switchFromSchemeName && (
                        <div className="flex items-center gap-2 text-sm mb-2 p-2 bg-blue-50 dark:bg-blue-950 rounded">
                          <span className="text-muted-foreground">Switch from:</span>
                          <span>{item.switchFromSchemeName}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        {item.currentValue && (
                          <div>
                            <span className="text-muted-foreground">Current Value: </span>
                            <span className="font-medium">{formatCurrency(item.currentValue)}</span>
                          </div>
                        )}
                        {item.amount && (
                          <div>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                        )}
                      </div>

                      <Separator className="my-3" />

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-primary">Why this recommendation:</span>
                          <p className="text-muted-foreground mt-1">{item.rationale}</p>
                        </div>
                        {item.problemIdentified && (
                          <div className="p-2 bg-orange-50 dark:bg-orange-950 rounded">
                            <span className="font-medium text-orange-600">Issue Found:</span>
                            <p className="text-muted-foreground mt-1">{item.problemIdentified}</p>
                          </div>
                        )}
                        {item.riskInvolved && (
                          <div className="p-2 bg-red-50 dark:bg-red-950 rounded">
                            <span className="font-medium text-red-600">Risk to Consider:</span>
                            <p className="text-muted-foreground mt-1">{item.riskInvolved}</p>
                          </div>
                        )}
                        {item.portfolioImpactSummary && (
                          <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                            <span className="font-medium text-green-600">Expected Impact:</span>
                            <p className="text-muted-foreground mt-1">{item.portfolioImpactSummary}</p>
                          </div>
                        )}
                      </div>

                      {item.status === "pending" && (
                        <div className="flex gap-2 mt-4 pt-4 border-t">
                          <Button onClick={() => handleApproveItem(item.id)} disabled={approveItemMutation.isPending} className="flex-1" data-testid={`button-approve-${item.id}`}>
                            {approveItemMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
                            Approve
                          </Button>
                          <Button variant="outline" onClick={() => setRejectingItem(item)} className="flex-1" data-testid={`button-reject-${item.id}`}>
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {isRejected && item.clientRejectionReason && (
                        <div className="mt-3 p-2 bg-red-100 dark:bg-red-900 rounded text-sm">
                          <span className="font-medium">Your reason: </span>{item.clientRejectionReason}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-muted-foreground">
            {approvedItems.length} of {proposalItems.length} recommendations approved
          </p>
          <Button onClick={() => setShowFinalizeDialog(true)} disabled={approvedItems.length === 0} data-testid="button-finalize">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Finalize & Add to Cart
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={!!rejectingItem} onOpenChange={(open) => !open && setRejectingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Recommendation</DialogTitle>
            <DialogDescription>
              Please provide a reason for declining this recommendation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea id="reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="E.g., Already have similar investment, Not aligned with my goals..." rows={3} data-testid="input-reject-reason" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingItem(null)}>Cancel</Button>
            <Button onClick={handleRejectItem} disabled={!rejectReason.trim() || rejectItemMutation.isPending} data-testid="button-confirm-reject">
              {rejectItemMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize Investment Proposal</DialogTitle>
            <DialogDescription>
              You are about to add {approvedItems.length} approved recommendations to your cart
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium mb-2">Summary:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Approved: <span className="font-medium text-green-600">{approvedItems.length}</span></div>
                <div>Declined: <span className="font-medium text-red-600">{rejectedItems.length}</span></div>
                <div>Total Amount: <span className="font-medium">{formatCurrency(approvedItems.reduce((sum, i) => sum + (i.amount || 0), 0))}</span></div>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {selectedProposal.sebiDisclaimer}
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-2">
              <Checkbox id="disclaimer" checked={disclaimerAccepted} onCheckedChange={(checked) => setDisclaimerAccepted(!!checked)} data-testid="checkbox-disclaimer" />
              <Label htmlFor="disclaimer" className="text-sm leading-tight">
                I have read and understood the disclaimer. I understand that the recommendations are AI-generated suggestions and not financial advice. Final investment decision is mine.
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>Cancel</Button>
            <Button onClick={handleFinalize} disabled={!disclaimerAccepted || finalizeMutation.isPending} data-testid="button-confirm-finalize">
              {finalizeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm & Add to Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
