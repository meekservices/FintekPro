import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Brain,
  User,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Loader2,
  Eye,
  Target,
  Briefcase,
  PieChart,
  Layers,
  Filter,
  RefreshCw,
  ChevronRight
} from "lucide-react";

type ProposalSource = 'ai_rebalancing' | 'ai_retirement' | 'ai_goals' | 'agent' | 'self';
type ProposalStatus = 'draft' | 'sent' | 'pending_review' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'partially_approved' | 'executed';
type ProductCategory = 'mutual_fund' | 'equity' | 'bond' | 'ipo' | 'unlisted' | 'insurance' | 'loan' | 'aif' | 'pms';

interface ProposalItem {
  id: string;
  proposalId: string;
  productType: ProductCategory;
  productId?: string;
  productName: string;
  isin?: string;
  actionType?: 'BUY' | 'SELL' | 'SWITCH' | 'HOLD';
  amount: number;
  units?: number;
  rationale?: string;
  status: string;
}

interface UnifiedProposal {
  id: string;
  clientId: string;
  clientName?: string;
  agentId?: string;
  agentName?: string;
  title: string;
  description?: string;
  proposalSource: ProposalSource;
  aiSubSource?: 'rebalancing' | 'retirement' | 'goals';
  status: ProposalStatus;
  totalAmount: number;
  validUntil?: string;
  createdAt: string;
  updatedAt?: string;
  items: ProposalItem[];
  approvedItemsCount?: number;
  rejectedItemsCount?: number;
  addedToCart?: boolean;
}

const sourceConfig: Record<ProposalSource, { label: string; icon: any; color: string; bgColor: string }> = {
  ai_rebalancing: { label: "AI Rebalancing", icon: Brain, color: "text-purple-700", bgColor: "bg-purple-100 dark:bg-purple-900" },
  ai_retirement: { label: "AI Retirement", icon: Target, color: "text-blue-700", bgColor: "bg-blue-100 dark:bg-blue-900" },
  ai_goals: { label: "AI Goals", icon: Briefcase, color: "text-green-700", bgColor: "bg-green-100 dark:bg-green-900" },
  agent: { label: "Agent", icon: User, color: "text-orange-700", bgColor: "bg-orange-100 dark:bg-orange-900" },
  self: { label: "Self Requested", icon: FileText, color: "text-muted-foreground", bgColor: "bg-muted" },
};

const statusConfig: Record<ProposalStatus, { label: string; icon: any; color: string }> = {
  draft: { label: "Draft", icon: Clock, color: "bg-muted text-foreground" },
  sent: { label: "Sent", icon: FileText, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  pending_review: { label: "Pending Review", icon: Clock, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  viewed: { label: "Viewed", icon: Eye, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  accepted: { label: "Accepted", icon: CheckCircle, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  rejected: { label: "Rejected", icon: AlertCircle, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  expired: { label: "Expired", icon: AlertCircle, color: "bg-muted text-muted-foreground" },
  partially_approved: { label: "Partial", icon: CheckCircle, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  executed: { label: "Executed", icon: CheckCircle, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
};

const categoryLabels: Record<ProductCategory, string> = {
  mutual_fund: "Mutual Funds",
  equity: "Equities",
  bond: "Bonds",
  ipo: "IPO",
  unlisted: "Unlisted",
  insurance: "Insurance",
  loan: "Loans",
  aif: "AIF",
  pms: "PMS",
};

export default function MyProposalsPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("ai");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [aiSubFilter, setAiSubFilter] = useState<string>("all");
  const [selectedProposal, setSelectedProposal] = useState<UnifiedProposal | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [orderType, setOrderType] = useState<'LUMPSUM' | 'SIP'>('LUMPSUM');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: proposals = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/unified-proposals'],
    queryFn: async () => {
      const response = await fetch('/api/unified-proposals', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch proposals');
      return response.json() as Promise<UnifiedProposal[]>;
    },
  });

  const acceptProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('PUT', `/api/unified-proposals/${proposalId}/accept`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Proposal accepted", description: "You can now add it to your cart." });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-proposals'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to accept proposal" });
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await apiRequest('PUT', `/api/unified-proposals/${proposalId}/reject`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Proposal declined" });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-proposals'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to decline proposal" });
    },
  });

  const addToCartMutation = useMutation({
    mutationFn: async ({ proposalId, orderType }: { proposalId: string; orderType: string }) => {
      const response = await apiRequest('POST', `/api/unified-proposals/${proposalId}/add-to-cart`, { orderType });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Added to cart", description: "Go to cart to complete your purchase." });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-proposals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to add to cart" });
    },
  });

  const filterProposals = (source: 'ai' | 'agent' | 'self' | 'all') => {
    let filtered = proposals;

    if (source === 'ai') {
      filtered = filtered.filter(p => 
        p.proposalSource === 'ai_rebalancing' || 
        p.proposalSource === 'ai_retirement' || 
        p.proposalSource === 'ai_goals'
      );
      if (aiSubFilter !== 'all') {
        filtered = filtered.filter(p => p.proposalSource === `ai_${aiSubFilter}`);
      }
    } else if (source === 'agent') {
      filtered = filtered.filter(p => p.proposalSource === 'agent');
    } else if (source === 'self') {
      filtered = filtered.filter(p => p.proposalSource === 'self');
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => 
        p.items?.some(item => item.productType === categoryFilter)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.items?.some(item => item.productName.toLowerCase().includes(term))
      );
    }

    return filtered;
  };

  const summaryStats = useMemo(() => {
    const aiProposals = proposals.filter(p => 
      p.proposalSource === 'ai_rebalancing' || 
      p.proposalSource === 'ai_retirement' || 
      p.proposalSource === 'ai_goals'
    );
    const agentProposals = proposals.filter(p => p.proposalSource === 'agent');
    const selfProposals = proposals.filter(p => p.proposalSource === 'self');
    const pending = proposals.filter(p => ['sent', 'pending_review', 'viewed'].includes(p.status));
    const accepted = proposals.filter(p => p.status === 'accepted');
    const cartReady = accepted.filter(p => !p.addedToCart);
    const totalValue = pending.reduce((sum, p) => sum + p.totalAmount, 0);

    return { aiProposals, agentProposals, selfProposals, pending, accepted, cartReady, totalValue };
  }, [proposals]);

  const handleAddToCart = (proposal: UnifiedProposal) => {
    if (proposal.status !== 'accepted') {
      toast({ variant: "destructive", title: "Please accept the proposal first" });
      return;
    }
    addToCartMutation.mutate({ proposalId: proposal.id, orderType });
  };

  const renderSourceBadge = (proposal: UnifiedProposal) => {
    const config = sourceConfig[proposal.proposalSource];
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.bgColor} ${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderStatusBadge = (status: ProposalStatus) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const renderProposalCard = (proposal: UnifiedProposal) => {
    const isAccepted = proposal.status === 'accepted';
    const canAddToCart = isAccepted && !proposal.addedToCart;
    const isPending = ['sent', 'pending_review', 'viewed'].includes(proposal.status);

    return (
      <Card key={proposal.id} className="hover:shadow-md transition-shadow" data-testid={`proposal-card-${proposal.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">{proposal.title}</CardTitle>
              {proposal.description && (
                <CardDescription className="line-clamp-2">{proposal.description}</CardDescription>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {renderSourceBadge(proposal)}
              {renderStatusBadge(proposal.status)}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Amount</span>
              <span className="font-semibold text-lg">₹{proposal.totalAmount.toLocaleString('en-IN')}</span>
            </div>

            {proposal.items && proposal.items.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Products ({proposal.items.length})</div>
                <div className="flex flex-wrap gap-1">
                  {[...new Set(proposal.items.map(item => item.productType))].map(category => (
                    <Badge key={category} variant="secondary" className="text-xs">
                      {categoryLabels[category] || category}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Created: {new Date(proposal.createdAt).toLocaleDateString('en-IN')}</span>
              {proposal.validUntil && (
                <span>Valid until: {new Date(proposal.validUntil).toLocaleDateString('en-IN')}</span>
              )}
            </div>

            <Separator />

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProposal(proposal);
                  setIsDetailDialogOpen(true);
                }}
                data-testid={`view-proposal-${proposal.id}`}
              >
                <Eye className="h-4 w-4 mr-1" />
                View Details
              </Button>

              {isPending && (
                <>
                  <Button
                    size="sm"
                    onClick={() => acceptProposalMutation.mutate(proposal.id)}
                    disabled={acceptProposalMutation.isPending}
                    data-testid={`accept-proposal-${proposal.id}`}
                  >
                    {acceptProposalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    Accept
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => rejectProposalMutation.mutate(proposal.id)}
                    disabled={rejectProposalMutation.isPending}
                    data-testid={`reject-proposal-${proposal.id}`}
                  >
                    Decline
                  </Button>
                </>
              )}

              {canAddToCart && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleAddToCart(proposal)}
                  disabled={addToCartMutation.isPending}
                  data-testid={`add-to-cart-${proposal.id}`}
                >
                  {addToCartMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 mr-1" />
                  )}
                  Add to Cart
                </Button>
              )}

              {proposal.addedToCart && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/cart')}
                  data-testid={`go-to-cart-${proposal.id}`}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
                  Go to Cart
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProposalList = (source: 'ai' | 'agent' | 'self' | 'all') => {
    const filtered = filterProposals(source);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No proposals found</h3>
          <p className="text-muted-foreground">
            {source === 'ai' && "AI recommendations will appear here based on your portfolio analysis."}
            {source === 'agent' && "Proposals from your advisor will appear here."}
            {source === 'self' && "Your requested proposals will appear here."}
            {source === 'all' && "All your proposals will appear here."}
          </p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(renderProposalCard)}
      </div>
    );
  };

  const renderFilters = (showAiSubFilter: boolean = false) => (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search proposals..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="search-proposals"
        />
      </div>

      {showAiSubFilter && (
        <Select value={aiSubFilter} onValueChange={setAiSubFilter}>
          <SelectTrigger className="w-[160px]" data-testid="ai-source-filter">
            <SelectValue placeholder="AI Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All AI Sources</SelectItem>
            <SelectItem value="rebalancing">Rebalancing</SelectItem>
            <SelectItem value="retirement">Retirement</SelectItem>
            <SelectItem value="goals">Goals</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px]" data-testid="status-filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending_review">Pending</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="executed">Executed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-[160px]" data-testid="category-filter">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
          <SelectItem value="equity">Equities</SelectItem>
          <SelectItem value="bond">Bonds</SelectItem>
          <SelectItem value="ipo">IPO</SelectItem>
          <SelectItem value="unlisted">Unlisted</SelectItem>
          <SelectItem value="insurance">Insurance</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" onClick={() => refetch()} data-testid="refresh-proposals">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Proposals</h1>
        <p className="text-muted-foreground">Review and manage investment recommendations from AI, your advisor, and your own requests.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Brain className="h-5 w-5 text-purple-700 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.aiProposals.length}</p>
                <p className="text-sm text-muted-foreground">AI Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-lg">
                <User className="h-5 w-5 text-orange-700 dark:text-orange-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.agentProposals.length}</p>
                <p className="text-sm text-muted-foreground">Agent Proposals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-700 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryStats.cartReady.length}</p>
                <p className="text-sm text-muted-foreground">Ready for Cart</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold">₹{(summaryStats.totalValue / 100000).toFixed(1)}L</p>
                <p className="text-sm text-muted-foreground">Pending Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai-proposals">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Proposals</span>
            <span className="sm:hidden">AI</span>
            {summaryStats.aiProposals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{summaryStats.aiProposals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="agent" className="flex items-center gap-2" data-testid="tab-agent-proposals">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Agent Proposals</span>
            <span className="sm:hidden">Agent</span>
            {summaryStats.agentProposals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{summaryStats.agentProposals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="self" className="flex items-center gap-2" data-testid="tab-self-proposals">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">My Requests</span>
            <span className="sm:hidden">Self</span>
            {summaryStats.selfProposals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{summaryStats.selfProposals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unified" className="flex items-center gap-2" data-testid="tab-unified-view">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Unified View</span>
            <span className="sm:hidden">All</span>
            {proposals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{proposals.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <Brain className="h-3 w-3 mr-1" />
              Rebalancing
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              <Target className="h-3 w-3 mr-1" />
              Retirement Planning
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Briefcase className="h-3 w-3 mr-1" />
              Goal Planning
            </Badge>
          </div>
          {renderFilters(true)}
          {renderProposalList('ai')}
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          {renderFilters()}
          {renderProposalList('agent')}
        </TabsContent>

        <TabsContent value="self" className="space-y-4">
          {renderFilters()}
          {renderProposalList('self')}
        </TabsContent>

        <TabsContent value="unified" className="space-y-4">
          {renderFilters()}
          {renderProposalList('all')}
        </TabsContent>
      </Tabs>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProposal?.title}
              {selectedProposal && renderSourceBadge(selectedProposal)}
            </DialogTitle>
            <DialogDescription>{selectedProposal?.description}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            {selectedProposal?.items && selectedProposal.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProposal.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          {item.isin && <p className="text-xs text-muted-foreground">{item.isin}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{categoryLabels[item.productType] || item.productType}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.actionType && (
                          <Badge variant={item.actionType === 'BUY' ? 'default' : item.actionType === 'SELL' ? 'destructive' : 'secondary'}>
                            {item.actionType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{item.amount.toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">No items in this proposal</p>
            )}
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Order Type:</span>
              <Select value={orderType} onValueChange={(v) => setOrderType(v as 'LUMPSUM' | 'SIP')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LUMPSUM">Lumpsum</SelectItem>
                  <SelectItem value="SIP">SIP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {selectedProposal?.status === 'accepted' && !selectedProposal.addedToCart && (
                <Button onClick={() => selectedProposal && handleAddToCart(selectedProposal)} disabled={addToCartMutation.isPending}>
                  {addToCartMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
                  Add to Cart
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
