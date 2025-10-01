import { useState } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, 
  Users, 
  TrendingUp, 
  Target,
  IndianRupee,
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  Lightbulb,
  UserCheck,
  Zap,
  BarChart3,
  FileText,
  AlertTriangle,
  ShoppingCart,
  Plus,
  User,
  Filter
} from "lucide-react";

interface InvestmentProposal {
  id: string;
  proposalSource: 'ai' | 'agent' | 'client' | 'hybrid';
  clientId: string;
  agentId?: string;
  title: string;
  description?: string;
  analysisRationale?: string;
  totalInvestmentAmount?: number;
  riskProfile?: string;
  timeHorizon?: string;
  expectedReturns?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'accepted' | 'rejected' | 'in_cart' | 'completed';
  createdAt: string;
  updatedAt: string;
  validUntil?: string;
}

export default function ProposalsPage() {
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Form state for creating proposals
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    analysisRationale: '',
    totalInvestmentAmount: '',
    riskProfile: 'moderate',
    timeHorizon: '',
    expectedReturns: '',
    priority: 'medium'
  });

  // Fetch investment proposals from the API
  const { data: proposals, isLoading: proposalsLoading, error: proposalsError } = useQuery<InvestmentProposal[]>({
    queryKey: ['/api/proposals'],
    enabled: true,
    retry: 1
  });

  // Create proposal mutation
  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/proposals', { body: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        analysisRationale: '',
        totalInvestmentAmount: '',
        riskProfile: 'moderate',
        timeHorizon: '',
        expectedReturns: '',
        priority: 'medium'
      });
      toast({
        title: "Proposal Created",
        description: "Your investment proposal has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Accept proposal mutation
  const acceptProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest('PUT', `/api/proposals/${proposalId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Proposal Accepted",
        description: "The investment proposal has been accepted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Acceptance Failed",
        description: "Failed to accept the proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest('POST', `/api/proposals/${proposalId}/add-to-cart`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Added to Cart",
        description: "Proposal has been added to your cart for checkout.",
      });
    },
    onError: (error) => {
      toast({
        title: "Add to Cart Failed",
        description: "Failed to add proposal to cart. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Reject proposal mutation
  const rejectProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return apiRequest('PUT', `/api/proposals/${proposalId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      toast({
        title: "Proposal Rejected",
        description: "The proposal has been rejected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Rejection Failed",
        description: "Failed to reject the proposal. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Handle form submission
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const proposalData = {
      ...formData,
      totalInvestmentAmount: formData.totalInvestmentAmount ? parseFloat(formData.totalInvestmentAmount) : undefined,
      expectedReturns: formData.expectedReturns ? parseFloat(formData.expectedReturns) : undefined,
    };
    
    await createProposalMutation.mutateAsync(proposalData);
  };

  // Filter proposals by source
  const filteredProposals = proposals?.filter(p => {
    if (selectedTab === 'all') return true;
    return p.proposalSource === selectedTab;
  }) || [];

  // Calculate counts
  const aiCount = proposals?.filter(p => p.proposalSource === 'ai').length || 0;
  const agentCount = proposals?.filter(p => p.proposalSource === 'agent').length || 0;
  const clientCount = proposals?.filter(p => p.proposalSource === 'client').length || 0;
  const pendingCount = proposals?.filter(p => p.status === 'pending').length || 0;
  const highPriorityCount = proposals?.filter(p => p.priority === 'high').length || 0;

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai':
        return <Bot className="w-4 h-4" />;
      case 'agent':
        return <Users className="w-4 h-4" />;
      case 'client':
        return <User className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'ai':
        return 'bg-purple-100 text-purple-600';
      case 'agent':
        return 'bg-blue-100 text-blue-600';
      case 'client':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-gray-100 text-gray-600';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'accepted':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'in_cart':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'completed':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const renderProposalCard = (proposal: InvestmentProposal) => (
    <Card key={proposal.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary" data-testid={`card-proposal-${proposal.id}`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-3 flex-1">
            <div className={`p-2 rounded-lg ${getSourceColor(proposal.proposalSource)}`}>
              {getSourceIcon(proposal.proposalSource)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="font-mono text-xs" data-testid={`badge-id-${proposal.id}`}>
                  {proposal.id}
                </Badge>
                <Badge className={`text-xs px-2 py-0.5 border ${getStatusColor(proposal.status)}`} data-testid={`badge-status-${proposal.id}`}>
                  {proposal.status.toUpperCase()}
                </Badge>
              </div>
              <CardTitle className="text-lg" data-testid={`text-title-${proposal.id}`}>{proposal.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getPriorityColor(proposal.priority)}>
                  {proposal.priority.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {proposal.proposalSource} Generated
                </Badge>
              </div>
            </div>
          </div>
          {proposal.totalInvestmentAmount && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Investment</div>
              <div className="text-xl font-bold text-primary" data-testid={`text-amount-${proposal.id}`}>
                {formatCurrency(proposal.totalInvestmentAmount)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {proposal.description && (
          <p className="text-gray-700">{proposal.description}</p>
        )}
        
        {proposal.analysisRationale && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">Rationale</p>
                <p className="text-sm text-gray-700">{proposal.analysisRationale}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {proposal.riskProfile && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Risk Profile</p>
              <p className="font-medium capitalize">{proposal.riskProfile}</p>
            </div>
          )}
          {proposal.timeHorizon && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Time Horizon</p>
              <p className="font-medium">{proposal.timeHorizon}</p>
            </div>
          )}
          {proposal.expectedReturns && (
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Expected Returns</p>
              <p className="font-medium text-green-600">{proposal.expectedReturns}% p.a.</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 pt-4 border-t">
          {proposal.status === 'pending' && (
            <>
              <Button 
                className="flex-1" 
                variant="default"
                onClick={() => acceptProposalMutation.mutate(proposal.id)}
                disabled={acceptProposalMutation.isPending}
                data-testid={`button-accept-${proposal.id}`}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept
              </Button>
              <Button 
                variant="outline"
                onClick={() => addToCartMutation.mutate(proposal.id)}
                disabled={addToCartMutation.isPending}
                data-testid={`button-add-cart-${proposal.id}`}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => rejectProposalMutation.mutate(proposal.id)}
                disabled={rejectProposalMutation.isPending}
                data-testid={`button-reject-${proposal.id}`}
              >
                Reject
              </Button>
            </>
          )}
          {proposal.status === 'accepted' && (
            <Button 
              className="flex-1"
              variant="default"
              onClick={() => addToCartMutation.mutate(proposal.id)}
              disabled={addToCartMutation.isPending}
              data-testid={`button-add-cart-${proposal.id}`}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
          )}
          {proposal.status === 'in_cart' && (
            <Button 
              className="flex-1"
              variant="secondary"
              onClick={() => window.location.href = '/cart'}
              data-testid={`button-view-cart-${proposal.id}`}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              View in Cart
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Investment Proposals</h1>
            <p className="text-xl text-muted-foreground">
              AI, Agent, and Client-generated investment recommendations
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" data-testid="button-create-proposal">
                <Plus className="w-5 h-5 mr-2" />
                Create Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Investment Proposal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    data-testid="input-title"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="analysisRationale">Analysis & Rationale</Label>
                  <Textarea
                    id="analysisRationale"
                    value={formData.analysisRationale}
                    onChange={(e) => setFormData({ ...formData, analysisRationale: e.target.value })}
                    rows={3}
                    data-testid="input-rationale"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalInvestmentAmount">Investment Amount (₹)</Label>
                    <Input
                      id="totalInvestmentAmount"
                      type="number"
                      value={formData.totalInvestmentAmount}
                      onChange={(e) => setFormData({ ...formData, totalInvestmentAmount: e.target.value })}
                      data-testid="input-amount"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="expectedReturns">Expected Returns (%)</Label>
                    <Input
                      id="expectedReturns"
                      type="number"
                      step="0.1"
                      value={formData.expectedReturns}
                      onChange={(e) => setFormData({ ...formData, expectedReturns: e.target.value })}
                      data-testid="input-returns"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="riskProfile">Risk Profile</Label>
                    <Select
                      value={formData.riskProfile}
                      onValueChange={(value) => setFormData({ ...formData, riskProfile: value })}
                    >
                      <SelectTrigger id="riskProfile" data-testid="select-risk">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Conservative</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="aggressive">Aggressive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger id="priority" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="timeHorizon">Time Horizon</Label>
                  <Input
                    id="timeHorizon"
                    placeholder="e.g., 3-5 years"
                    value={formData.timeHorizon}
                    onChange={(e) => setFormData({ ...formData, timeHorizon: e.target.value })}
                    data-testid="input-time-horizon"
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={createProposalMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit-proposal"
                  >
                    {createProposalMutation.isPending ? 'Creating...' : 'Create Proposal'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-proposal"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Bot className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600" data-testid="text-ai-count">{aiCount}</p>
                  <p className="text-sm font-medium text-purple-800">AI Generated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600" data-testid="text-agent-count">{agentCount}</p>
                  <p className="text-sm font-medium text-blue-800">Agent Created</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <User className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-client-count">{clientCount}</p>
                  <p className="text-sm font-medium text-green-800">Client Created</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">{pendingCount}</p>
                  <p className="text-sm font-medium text-yellow-800">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600" data-testid="text-high-priority-count">{highPriorityCount}</p>
                  <p className="text-sm font-medium text-orange-800">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabbed Interface */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
              <Filter className="w-4 h-4" />
              All ({proposals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai">
              <Bot className="w-4 h-4" />
              AI ({aiCount})
            </TabsTrigger>
            <TabsTrigger value="agent" className="flex items-center gap-2" data-testid="tab-agent">
              <Users className="w-4 h-4" />
              Agent ({agentCount})
            </TabsTrigger>
            <TabsTrigger value="client" className="flex items-center gap-2" data-testid="tab-client">
              <User className="w-4 h-4" />
              Client ({clientCount})
            </TabsTrigger>
          </TabsList>
          
          {proposalsLoading ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading proposals...</p>
              </CardContent>
            </Card>
          ) : proposalsError ? (
            <Card>
              <CardContent className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Unable to load proposals</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please try again later or contact support if the problem persists.
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : (
            <TabsContent value={selectedTab} className="space-y-6">
              {filteredProposals.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    {getSourceIcon(selectedTab === 'all' ? 'ai' : selectedTab)}
                    <h3 className="text-lg font-medium text-muted-foreground mb-2 mt-4">
                      No {selectedTab === 'all' ? '' : selectedTab + ' '} proposals found
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedTab === 'client' 
                        ? 'Create your first proposal using the "Create Proposal" button above.' 
                        : 'Proposals will appear here when available.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {filteredProposals.map(proposal => renderProposalCard(proposal))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
