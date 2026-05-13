import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText,
  Search,
  Filter,
  Eye,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Unlock,
  ArrowRight,
  Edit3,
  Share2,
  Download,
  Trash2,
  MessageSquare,
  Mail,
  BarChart3,
  Target,
  User,
  Calendar,
  Briefcase,
  ChevronRight,
  AlertCircle,
  XCircle,
  Copy,
  ExternalLink,
  TrendingUp,
  PieChart,
  Wallet,
  Shield as LucideShield
} from "lucide-react";

interface Proposal {
  id: string;
  clientId: string;
  clientName: string;
  sessionId?: string;
  sessionPurpose?: string;
  status: 'draft' | 'pending_review' | 'shared' | 'client_viewed' | 'approved' | 'rejected' | 'executed' | 'expired';
  workflowState: string;
  investmentAmount: number;
  suitabilityScore?: number;
  suitabilityPassed: boolean;
  createdAt: string;
  updatedAt: string;
  sharedAt?: string;
  clientActionAt?: string;
  expiresAt?: string;
  source?: 'proposal_builder' | 'wizard';
  shareToken?: string;
  prospectEmail?: string;
}

interface ProposalItem {
  id: string;
  proposalId: string;
  assetClass: string;
  instrumentType: string;
  instrumentName: string;
  isin?: string;
  allocationPercentage: number;
  recommendedAmount: number;
  rationale: string;
  riskCategory: string;
  expectedReturn?: number;
  timeHorizon?: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-status-warning text-status-warning-fg",
  shared: "bg-status-info text-status-info-fg",
  client_viewed: "bg-status-viewed text-status-viewed-fg",
  approved: "bg-status-success text-status-success-fg",
  rejected: "bg-destructive/15 text-destructive",
  executed: "bg-status-executed text-status-executed-fg",
  expired: "bg-status-expired text-status-expired-fg",
};

const WORKFLOW_STEPS = [
  { key: 'purpose_selection', label: 'Purpose', icon: Target },
  { key: 'suitability_check', label: 'Suitability', icon: LucideShield },
  { key: 'optimization', label: 'Optimization', icon: TrendingUp },
  { key: 'draft_review', label: 'Draft Review', icon: FileText },
  { key: 'client_sharing', label: 'Share', icon: Share2 },
  { key: 'client_action', label: 'Client Action', icon: User },
  { key: 'execution', label: 'Execution', icon: CheckCircle2 }
];

export default function AgentProposalsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showAddNoteDialog, setShowAddNoteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteType, setNoteType] = useState("explanation");

  const { data: proposals, isLoading: proposalsLoading } = useQuery<Proposal[]>({
    queryKey: ['/api/agent/proposals'],
  });

  const { data: proposalItems } = useQuery<ProposalItem[]>({
    queryKey: ['/api/agent/proposals', selectedProposal?.id, 'items'],
    enabled: !!selectedProposal,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: { proposalId: string; noteType: string; content: string }) => {
      return apiRequest(`/api/agent/proposals/${data.proposalId}/notes`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Note added to proposal" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/proposals'] });
      setShowAddNoteDialog(false);
      setNoteContent("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add note", 
        variant: "destructive" 
      });
    }
  });

  const shareProposalMutation = useMutation({
    mutationFn: async (data: { proposalId: string; shareMethod: string }) => {
      return apiRequest(`/api/agent/proposals/${data.proposalId}/share`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Proposal shared with client" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/proposals'] });
      setShowShareDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to share proposal", 
        variant: "destructive" 
      });
    }
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest(`/api/agent/proposals/${proposalId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Proposal deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/agent/proposals'] });
      setShowDeleteDialog(false);
      setProposalToDelete(null);
      if (selectedProposal?.id === proposalToDelete?.id) {
        setSelectedProposal(null);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete proposal", 
        variant: "destructive" 
      });
    }
  });

  const handleEditProposal = (proposal: Proposal) => {
    if (proposal.source === 'wizard') {
      // Wizard proposals should be edited through the prospect wizard
      setLocation(`/agent-prospect-wizard?edit=${proposal.id}`);
    } else {
      // Proposal builder proposals (default for proposals without source field)
      setLocation(`/agent/proposal-builder?edit=${proposal.id}`);
    }
  };

  const handleDeleteClick = (proposal: Proposal, e: React.MouseEvent) => {
    e.stopPropagation();
    setProposalToDelete(proposal);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (proposalToDelete) {
      deleteProposalMutation.mutate(proposalToDelete.id);
    }
  };

  const filteredProposals = proposals?.filter(proposal => {
    const matchesSearch = !searchQuery || 
      proposal.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proposal.id?.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "draft") return matchesSearch && proposal.status === "draft";
    if (activeTab === "shared") return matchesSearch && ["shared", "client_viewed"].includes(proposal.status);
    if (activeTab === "action_required") return matchesSearch && ["approved", "rejected"].includes(proposal.status);
    if (activeTab === "executed") return matchesSearch && proposal.status === "executed";
    return matchesSearch;
  }) || [];

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return "₹0";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getWorkflowProgress = (currentState: string) => {
    const stateIndex = WORKFLOW_STEPS.findIndex(s => s.key === currentState);
    return ((stateIndex + 1) / WORKFLOW_STEPS.length) * 100;
  };

  if (proposalsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <div className="text-lg">Loading proposals...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/30 to-indigo-50/30 dark:from-background dark:via-blue-950/30 dark:to-indigo-950/30" data-testid="agent-proposals-page">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Investment Proposals
            </h1>
            <p className="text-muted-foreground">
              Manage AI-generated proposals and client recommendations
            </p>
          </div>
          <Alert className="max-w-md">
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Proposals are system-generated. You can add notes but cannot modify allocations.
            </AlertDescription>
          </Alert>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{proposals?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Client Action</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {proposals?.filter(p => ["shared", "client_viewed"].includes(p.status)).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Client Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {proposals?.filter(p => p.status === "approved").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Executed Value</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  proposals
                    ?.filter(p => p.status === "executed")
                    .reduce((sum, p) => sum + (p.investmentAmount || 0), 0)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Proposals</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search proposals..." 
                      className="pl-10 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-proposals"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <ScrollableTabsList>
                    <TabsTrigger value="all" data-testid="tab-all-proposals">All</TabsTrigger>
                    <TabsTrigger value="draft" data-testid="tab-draft-proposals">Draft</TabsTrigger>
                    <TabsTrigger value="shared" data-testid="tab-shared-proposals">Shared</TabsTrigger>
                    <TabsTrigger value="action_required" data-testid="tab-action-proposals">Action Required</TabsTrigger>
                    <TabsTrigger value="executed" data-testid="tab-executed-proposals">Executed</TabsTrigger>
                  </ScrollableTabsList>

                  <TabsContent value={activeTab} className="mt-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Purpose</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Workflow</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProposals.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No proposals found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredProposals.map((proposal) => (
                              <TableRow 
                                key={proposal.id} 
                                className={`cursor-pointer ${selectedProposal?.id === proposal.id ? 'bg-muted' : ''}`}
                                onClick={() => setSelectedProposal(proposal)}
                                data-testid={`row-proposal-${proposal.id}`}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                      <User className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-medium">{proposal.clientName}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="capitalize text-sm">
                                    {proposal.sessionPurpose?.replace(/_/g, ' ') || 'N/A'}
                                  </span>
                                </TableCell>
                                <TableCell>{formatCurrency(proposal.investmentAmount)}</TableCell>
                                <TableCell>
                                  <Badge className={STATUS_COLORS[proposal.status]}>
                                    {proposal.status.replace(/_/g, ' ').toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="w-20">
                                    <Progress value={getWorkflowProgress(proposal.workflowState)} className="h-2" />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedProposal(proposal);
                                      }}
                                      data-testid={`button-view-proposal-${proposal.id}`}
                                      title="View"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {proposal.shareToken && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Share via WhatsApp"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = `${window.location.origin}/proposal/${proposal.shareToken}`;
                                          const msg = `Hi ${proposal.clientName || 'there'}, your investment proposal is ready. Please review it here: ${link}`;
                                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                                        }}
                                      >
                                        <MessageSquare className="h-4 w-4 text-green-600" />
                                      </Button>
                                    )}
                                    {proposal.prospectEmail && proposal.shareToken && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Share via Email"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = `${window.location.origin}/proposal/${proposal.shareToken}`;
                                          const msg = `Hi ${proposal.clientName || 'there'},\n\nYour investment proposal is ready for your review.\n\nPlease click the link below to view it:\n${link}\n\nFor any questions, please reach out to your financial advisor.`;
                                          window.location.href = `mailto:${proposal.prospectEmail}?subject=${encodeURIComponent('Your Investment Proposal')}&body=${encodeURIComponent(msg)}`;
                                        }}
                                      >
                                        <Mail className="h-4 w-4 text-blue-600" />
                                      </Button>
                                    )}
                                    {['draft', 'pending_review'].includes(proposal.status) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditProposal(proposal);
                                        }}
                                        data-testid={`button-edit-proposal-${proposal.id}`}
                                        title="Edit"
                                      >
                                        <Edit3 className="h-4 w-4" />
                                      </Button>
                                    )}
                                    {!['executed', 'approved'].includes(proposal.status) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => handleDeleteClick(proposal, e)}
                                        data-testid={`button-delete-proposal-${proposal.id}`}
                                        title="Delete"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedProposal ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Proposal Details</span>
                      <Badge className={STATUS_COLORS[selectedProposal.status]}>
                        {selectedProposal.status.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{selectedProposal.clientName}</h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          {selectedProposal.sessionPurpose?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Workflow Progress</p>
                      <div className="flex items-center gap-1">
                        {WORKFLOW_STEPS.map((step, index) => {
                          const isCompleted = WORKFLOW_STEPS.findIndex(s => s.key === selectedProposal.workflowState) > index;
                          const isCurrent = step.key === selectedProposal.workflowState;
                          const StepIcon = step.icon;
                          return (
                            <div 
                              key={step.key}
                              className={`flex-1 h-8 flex items-center justify-center rounded ${
                                isCompleted ? 'bg-green-100 dark:bg-green-900' :
                                isCurrent ? 'bg-primary/20' : 'bg-muted'
                              }`}
                              title={step.label}
                            >
                              <StepIcon className={`h-4 w-4 ${
                                isCompleted ? 'text-green-600' :
                                isCurrent ? 'text-primary' : 'text-muted-foreground'
                              }`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Investment Amount</p>
                        <p className="font-bold text-lg">{formatCurrency(selectedProposal.investmentAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Suitability Score</p>
                        <p className="font-bold text-lg flex items-center gap-1">
                          {selectedProposal.suitabilityScore || 'N/A'}
                          {selectedProposal.suitabilityPassed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm">{new Date(selectedProposal.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Last Updated</p>
                        <p className="text-sm">{new Date(selectedProposal.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {selectedProposal.sharedAt && (
                      <Alert>
                        <Send className="h-4 w-4" />
                        <AlertDescription>
                          Shared on {new Date(selectedProposal.sharedAt).toLocaleDateString()}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowAddNoteDialog(true)}
                      data-testid="button-add-note"
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                    {selectedProposal.status === "draft" && (
                      <Button 
                        className="flex-1"
                        onClick={() => setShowShareDialog(true)}
                        data-testid="button-share-proposal"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    )}
                    {selectedProposal.status === "approved" && (
                      <Button 
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        data-testid="button-execute-proposal"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Execute
                      </Button>
                    )}
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PieChart className="h-4 w-4" />
                      Allocation Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-3">
                      <Lock className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Allocations are system-generated and locked
                      </AlertDescription>
                    </Alert>
                    {proposalItems && proposalItems.length > 0 ? (
                      <div className="space-y-2">
                        {proposalItems.map((item) => (
                          <div 
                            key={item.id} 
                            className="flex items-center justify-between p-2 border rounded-md"
                            data-testid={`allocation-${item.id}`}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.instrumentName}</p>
                              <p className="text-xs text-muted-foreground capitalize">{item.assetClass}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{item.allocationPercentage}%</p>
                              <p className="text-xs text-muted-foreground">{formatCurrency(item.recommendedAmount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Allocation details will appear after optimization
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a proposal to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showAddNoteDialog} onOpenChange={setShowAddNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note to Proposal</DialogTitle>
            <DialogDescription>
              Add an explanatory note to help the client understand the recommendation.
              Notes are visible to the client but do not modify the allocation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Note Type</Label>
              <select 
                className="w-full mt-1 p-2 border rounded-md"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value)}
              >
                <option value="introduction">Introduction</option>
                <option value="explanation">Explanation</option>
                <option value="goal_context">Goal Context</option>
                <option value="market_outlook">Market Outlook</option>
                <option value="disclaimer_addition">Additional Disclaimer</option>
              </select>
            </div>

            <div>
              <Label>Note Content</Label>
              <Textarea
                placeholder="Enter your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={5}
                data-testid="textarea-note-content"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Notes are logged in the compliance audit trail with your agent credentials.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNoteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedProposal && noteContent) {
                  addNoteMutation.mutate({
                    proposalId: selectedProposal.id,
                    noteType,
                    content: noteContent
                  });
                }
              }}
              disabled={!noteContent || addNoteMutation.isPending}
              data-testid="button-confirm-add-note"
            >
              {addNoteMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4 mr-2" />
              )}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Proposal with Client</DialogTitle>
            <DialogDescription>
              Choose how to share this proposal. The client will receive a secure view-only link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => shareProposalMutation.mutate({ 
                  proposalId: selectedProposal!.id, 
                  shareMethod: 'secure_link' 
                })}
                data-testid="button-share-link"
              >
                <ExternalLink className="h-6 w-6 mb-2" />
                <span>Secure Link</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => shareProposalMutation.mutate({ 
                  proposalId: selectedProposal!.id, 
                  shareMethod: 'email' 
                })}
                data-testid="button-share-email"
              >
                <Send className="h-6 w-6 mb-2" />
                <span>Email</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => shareProposalMutation.mutate({ 
                  proposalId: selectedProposal!.id, 
                  shareMethod: 'pdf' 
                })}
                data-testid="button-share-pdf"
              >
                <Download className="h-6 w-6 mb-2" />
                <span>PDF Download</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col items-center justify-center"
                onClick={() => shareProposalMutation.mutate({ 
                  proposalId: selectedProposal!.id, 
                  shareMethod: 'whatsapp' 
                })}
                data-testid="button-share-whatsapp"
              >
                <MessageSquare className="h-6 w-6 mb-2" />
                <span>WhatsApp</span>
              </Button>
            </div>

            <Alert>
              <LucideShield className="h-4 w-4" />
              <AlertDescription>
                All shares are logged and tracked. Client actions (view, approve, reject) 
                are recorded for compliance.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proposal for {proposalToDelete?.clientName}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setProposalToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProposalMutation.isPending}
            >
              {deleteProposalMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
