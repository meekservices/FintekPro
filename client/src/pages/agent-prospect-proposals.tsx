import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Plus,
  FileText,
  Send,
  Eye,
  Copy,
  ExternalLink,
  Trash2,
  TrendingUp,
  Target,
  Wallet,
  Users,
  BarChart3,
  RefreshCw,
  Mail,
  MessageSquare,
  Link2,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  PieChart,
  Building2,
  User
} from "lucide-react";

interface ProspectProposal {
  id: string;
  shareToken: string;
  prospectName: string;
  prospectEmail?: string;
  prospectMobile?: string;
  proposalType: string;
  proposalTitle: string;
  executiveSummary?: string;
  currentAnalysis?: string;
  recommendations?: any[];
  totalInvestmentAmount?: string;
  projectedReturns?: string;
  projectedValue?: string;
  targetAllocation?: Record<string, number>;
  samplePortfolio?: any;
  investmentGoals?: any;
  referralCode?: string;
  viewCount: number;
  status: string;
  createdAt: string;
  validUntil?: string;
  sharedViaEmail?: boolean;
  sharedViaWhatsApp?: boolean;
  firstViewedAt?: string;
  lastViewedAt?: string;
}

interface ProposalStats {
  total: number;
  draft: number;
  shared: number;
  viewed: number;
  converted: number;
  totalViews: number;
}

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  shared: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  converted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const GOAL_TYPE_OPTIONS = [
  { value: "retirement", label: "Retirement Planning" },
  { value: "child_education", label: "Child Education" },
  { value: "wealth_creation", label: "Wealth Creation" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "tax_saving", label: "Tax Saving" },
  { value: "regular_income", label: "Regular Income" },
  { value: "custom", label: "Custom Goal" },
];

export default function AgentProspectProposalsPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<ProspectProposal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  
  // Create proposal form state
  const [proposalType, setProposalType] = useState<"sample_portfolio" | "fresh_investment">("fresh_investment");
  const [prospectName, setProspectName] = useState("");
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectMobile, setProspectMobile] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  
  // Sample portfolio fields
  const [portfolioValue, setPortfolioValue] = useState("");
  const [holdingsText, setHoldingsText] = useState("");
  
  // Fresh investment fields
  const [goalType, setGoalType] = useState("wealth_creation");
  const [targetAmount, setTargetAmount] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("medium_term");
  const [monthlyInvestment, setMonthlyInvestment] = useState("");
  const [lumpsum, setLumpsum] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  
  // Generated proposal
  const [generatedProposal, setGeneratedProposal] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: proposalsData, isLoading } = useQuery<{ proposals: ProspectProposal[]; stats: ProposalStats }>({
    queryKey: ["/api/agent/prospect-proposals", filterStatus],
  });

  const proposals = proposalsData?.proposals || [];
  const stats = proposalsData?.stats || { total: 0, draft: 0, shared: 0, viewed: 0, converted: 0, totalViews: 0 };

  const filteredProposals = proposals.filter(p =>
    p.prospectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.proposalTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.prospectEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generateProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/agent/prospect-proposals/generate", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedProposal(data.generated);
        toast({ title: "Proposal Generated", description: "AI recommendations are ready for review" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    }
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/agent/prospect-proposals", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Proposal Created", description: "You can now share it with the prospect" });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
        resetForm();
        setShowCreateDialog(false);
        setSelectedProposal(data.proposal);
        setShowShareDialog(true);
      }
    },
    onError: (error: any) => {
      toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
    }
  });

  const shareProposalMutation = useMutation({
    mutationFn: async ({ id, shareVia }: { id: string; shareVia: string }) => {
      const res = await apiRequest(`/api/agent/prospect-proposals/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ shareVia }),
        headers: { "Content-Type": "application/json" }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Proposal Shared", description: "The prospect can now view the proposal" });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
        setShowShareDialog(false);
      }
    },
    onError: (error: any) => {
      toast({ title: "Share Failed", description: error.message, variant: "destructive" });
    }
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/agent/prospect-proposals/${id}`, {
        method: "DELETE"
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Proposal Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/prospect-proposals"] });
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setProposalType("fresh_investment");
    setProspectName("");
    setProspectEmail("");
    setProspectMobile("");
    setProposalTitle("");
    setPortfolioValue("");
    setHoldingsText("");
    setGoalType("wealth_creation");
    setTargetAmount("");
    setTimeHorizon("medium_term");
    setMonthlyInvestment("");
    setLumpsum("");
    setRiskTolerance("moderate");
    setGeneratedProposal(null);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    
    let data: any = { proposalType };
    
    if (proposalType === "sample_portfolio") {
      const holdings = holdingsText.split("\n").filter(h => h.trim()).map((line, idx) => {
        const parts = line.split(",").map(p => p.trim());
        return {
          name: parts[0] || `Holding ${idx + 1}`,
          type: "mutual_fund",
          currentValue: parseFloat(parts[1]) || 100000,
          allocation: 0,
          returns1Y: parseFloat(parts[2]) || 10,
        };
      });
      
      const totalValue = parseFloat(portfolioValue) || holdings.reduce((sum, h) => sum + h.currentValue, 0);
      holdings.forEach(h => { h.allocation = (h.currentValue / totalValue) * 100; });
      
      data.samplePortfolio = {
        totalValue,
        holdings,
        assetAllocation: {}
      };
    } else {
      data.investmentGoals = {
        goalType,
        targetAmount: parseFloat(targetAmount) || undefined,
        timeHorizon,
        monthlyInvestment: parseFloat(monthlyInvestment) || undefined,
        lumpsum: parseFloat(lumpsum) || undefined,
        riskTolerance,
      };
    }
    
    generateProposalMutation.mutate(data, {
      onSettled: () => setIsGenerating(false)
    });
  };

  const handleCreate = () => {
    if (!prospectName || !proposalTitle) {
      toast({ title: "Missing Information", description: "Please provide prospect name and proposal title", variant: "destructive" });
      return;
    }

    if (!generatedProposal) {
      toast({ title: "Generate First", description: "Please generate AI recommendations before creating the proposal", variant: "destructive" });
      return;
    }

    const data: any = {
      prospectName,
      prospectEmail,
      prospectMobile,
      proposalType,
      proposalTitle,
      executiveSummary: generatedProposal.executiveSummary,
      currentAnalysis: generatedProposal.currentAnalysis,
      recommendations: generatedProposal.recommendations,
      totalInvestmentAmount: generatedProposal.totalInvestmentAmount,
      projectedReturns: generatedProposal.projectedReturns,
      projectedValue: generatedProposal.projectedValue,
      targetAllocation: generatedProposal.targetAllocation,
    };

    if (proposalType === "sample_portfolio") {
      const holdings = holdingsText.split("\n").filter(h => h.trim()).map((line, idx) => {
        const parts = line.split(",").map(p => p.trim());
        return {
          name: parts[0] || `Holding ${idx + 1}`,
          type: "mutual_fund",
          currentValue: parseFloat(parts[1]) || 100000,
          allocation: 0,
        };
      });
      const totalValue = parseFloat(portfolioValue) || holdings.reduce((sum, h) => sum + h.currentValue, 0);
      data.samplePortfolio = { totalValue, holdings, assetAllocation: {} };
    } else {
      data.investmentGoals = {
        goalType,
        targetAmount: parseFloat(targetAmount) || undefined,
        timeHorizon,
        monthlyInvestment: parseFloat(monthlyInvestment) || undefined,
        lumpsum: parseFloat(lumpsum) || undefined,
        riskTolerance,
      };
    }

    createProposalMutation.mutate(data);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6 p-6" data-testid="prospect-proposals-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Demo Proposals</h1>
          <p className="text-gray-500 dark:text-gray-400">Create and share investment proposals to acquire new clients</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
          onClick={() => setShowCreateDialog(true)}
          data-testid="btn-create-proposal"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Proposal
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Draft</p>
                <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
              </div>
              <Clock className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Shared</p>
                <p className="text-2xl font-bold text-blue-600">{stats.shared}</p>
              </div>
              <Send className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Viewed</p>
                <p className="text-2xl font-bold text-green-600">{stats.viewed}</p>
              </div>
              <Eye className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Converted</p>
                <p className="text-2xl font-bold text-purple-600">{stats.converted}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Views</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.totalViews}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Proposals</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search proposals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
                data-testid="input-search"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32" data-testid="select-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No proposals yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Create your first proposal to start acquiring new clients</p>
              <Button onClick={() => setShowCreateDialog(true)} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create First Proposal
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => (
                  <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{proposal.prospectName}</p>
                        <p className="text-xs text-gray-500">{proposal.prospectEmail || proposal.prospectMobile || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-48 truncate" title={proposal.proposalTitle}>
                      {proposal.proposalTitle}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {proposal.proposalType === 'sample_portfolio' ? 'Portfolio Analysis' : 'Fresh Investment'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={PROPOSAL_STATUS_COLORS[proposal.status]}>
                        {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-gray-400" />
                        <span>{proposal.viewCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                          onClick={() => {
                            setSelectedProposal(proposal);
                            setShowPreviewDialog(true);
                          }}
                          data-testid={`btn-preview-${proposal.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                          onClick={() => {
                            setSelectedProposal(proposal);
                            setShowShareDialog(true);
                          }}
                          data-testid={`btn-share-${proposal.id}`}
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          onClick={() => copyToClipboard(`${baseUrl}/proposal/${proposal.shareToken}`, "Proposal link")}
                          data-testid={`btn-copy-${proposal.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          onClick={() => deleteProposalMutation.mutate(proposal.id)}
                          data-testid={`btn-delete-${proposal.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Proposal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Portfolio Demo Proposal</DialogTitle>
            <DialogDescription>
              Create a personalized investment proposal to share with prospective clients
            </DialogDescription>
          </DialogHeader>

          <Tabs value={proposalType} onValueChange={(v) => setProposalType(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fresh_investment" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Fresh Investment
              </TabsTrigger>
              <TabsTrigger value="sample_portfolio" className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Portfolio Analysis
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prospect Name *</Label>
                  <Input 
                    value={prospectName} 
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="Enter prospect's name"
                    data-testid="input-prospect-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={prospectEmail} 
                    onChange={(e) => setProspectEmail(e.target.value)}
                    placeholder="prospect@email.com"
                    data-testid="input-prospect-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mobile</Label>
                  <Input 
                    value={prospectMobile} 
                    onChange={(e) => setProspectMobile(e.target.value)}
                    placeholder="+91 XXXXXXXXXX"
                    data-testid="input-prospect-mobile"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Proposal Title *</Label>
                <Input 
                  value={proposalTitle} 
                  onChange={(e) => setProposalTitle(e.target.value)}
                  placeholder="e.g., Personalized Wealth Creation Strategy"
                  data-testid="input-proposal-title"
                />
              </div>

              <Separator />

              <TabsContent value="fresh_investment" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Investment Goal</Label>
                    <Select value={goalType} onValueChange={setGoalType}>
                      <SelectTrigger data-testid="select-goal-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOAL_TYPE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Amount (Optional)</Label>
                    <Input 
                      type="number"
                      value={targetAmount} 
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="₹ 50,00,000"
                      data-testid="input-target-amount"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Time Horizon</Label>
                    <Select value={timeHorizon} onValueChange={setTimeHorizon}>
                      <SelectTrigger data-testid="select-time-horizon">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_term">Short Term (1-3 years)</SelectItem>
                        <SelectItem value="medium_term">Medium Term (3-7 years)</SelectItem>
                        <SelectItem value="long_term">Long Term (7+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly SIP (Optional)</Label>
                    <Input 
                      type="number"
                      value={monthlyInvestment} 
                      onChange={(e) => setMonthlyInvestment(e.target.value)}
                      placeholder="₹ 25,000"
                      data-testid="input-monthly-sip"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lumpsum (Optional)</Label>
                    <Input 
                      type="number"
                      value={lumpsum} 
                      onChange={(e) => setLumpsum(e.target.value)}
                      placeholder="₹ 5,00,000"
                      data-testid="input-lumpsum"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Risk Tolerance</Label>
                  <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                    <SelectTrigger data-testid="select-risk-tolerance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative - Capital preservation focus</SelectItem>
                      <SelectItem value="moderate">Moderate - Balanced growth and stability</SelectItem>
                      <SelectItem value="aggressive">Aggressive - Maximum growth potential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="sample_portfolio" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Current Portfolio Value</Label>
                  <Input 
                    type="number"
                    value={portfolioValue} 
                    onChange={(e) => setPortfolioValue(e.target.value)}
                    placeholder="₹ 25,00,000"
                    data-testid="input-portfolio-value"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Holdings (One per line: Name, Value, 1Y Return%)</Label>
                  <Textarea 
                    value={holdingsText} 
                    onChange={(e) => setHoldingsText(e.target.value)}
                    placeholder="HDFC Top 100 Fund, 500000, 12.5
SBI Bluechip Fund, 300000, 10.2
Axis Midcap Fund, 200000, 18.5"
                    rows={5}
                    data-testid="input-holdings"
                  />
                  <p className="text-xs text-gray-500">Format: Fund Name, Current Value, 1Y Return %</p>
                </div>
              </TabsContent>

              <Separator />

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating || generateProposalMutation.isPending}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  data-testid="btn-generate"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate AI Recommendations"}
                </Button>
              </div>

              {generatedProposal && (
                <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 border-indigo-200 dark:border-indigo-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      AI-Generated Proposal Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Executive Summary</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{generatedProposal.executiveSummary}</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Total Investment</p>
                        <p className="text-lg font-bold text-indigo-600">
                          ₹{(generatedProposal.totalInvestmentAmount || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Expected Returns</p>
                        <p className="text-lg font-bold text-green-600">{generatedProposal.projectedReturns}% p.a.</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Projected Value (5Y)</p>
                        <p className="text-lg font-bold text-purple-600">
                          ₹{(generatedProposal.projectedValue || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Recommended Products ({generatedProposal.recommendations?.length || 0})</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {generatedProposal.recommendations?.map((rec: any, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{rec.productName}</p>
                              <p className="text-xs text-gray-500">{rec.category} • {rec.riskRating}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">₹{rec.recommendedAmount.toLocaleString('en-IN')}</p>
                              <p className="text-xs text-gray-500">{rec.allocationPercentage}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </Tabs>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { resetForm(); setShowCreateDialog(false); }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!generatedProposal || createProposalMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
              data-testid="btn-create-final"
            >
              {createProposalMutation.isPending ? "Creating..." : "Create & Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProposal?.proposalTitle}</DialogTitle>
            <DialogDescription>
              Proposal for {selectedProposal?.prospectName}
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" /> {selectedProposal.viewCount} views
                </span>
                <Badge className={PROPOSAL_STATUS_COLORS[selectedProposal.status]}>
                  {selectedProposal.status}
                </Badge>
                {selectedProposal.sharedViaEmail && <Badge variant="outline"><Mail className="w-3 h-3 mr-1" />Email</Badge>}
                {selectedProposal.sharedViaWhatsApp && <Badge variant="outline"><MessageSquare className="w-3 h-3 mr-1" />WhatsApp</Badge>}
              </div>

              {selectedProposal.executiveSummary && (
                <div>
                  <h4 className="font-medium mb-1">Executive Summary</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedProposal.executiveSummary}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Total Investment</p>
                    <p className="text-lg font-bold">₹{parseFloat(selectedProposal.totalInvestmentAmount || '0').toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Expected Returns</p>
                    <p className="text-lg font-bold text-green-600">{selectedProposal.projectedReturns}% p.a.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-500">Projected Value</p>
                    <p className="text-lg font-bold text-purple-600">₹{parseFloat(selectedProposal.projectedValue || '0').toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
              </div>

              {selectedProposal.recommendations && selectedProposal.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Allocation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProposal.recommendations.map((rec: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{rec.productName}</TableCell>
                          <TableCell>{rec.category}</TableCell>
                          <TableCell>₹{rec.recommendedAmount?.toLocaleString('en-IN')}</TableCell>
                          <TableCell>{rec.allocationPercentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
            <Button 
              onClick={() => {
                setShowPreviewDialog(false);
                setShowShareDialog(true);
              }}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Share Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Proposal</DialogTitle>
            <DialogDescription>
              Share this proposal with {selectedProposal?.prospectName}
            </DialogDescription>
          </DialogHeader>

          {selectedProposal && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proposal Link</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${baseUrl}/proposal/${selectedProposal.shareToken}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${baseUrl}/proposal/${selectedProposal.shareToken}`, "Proposal link")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Onboarding Link (for signup)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={`${baseUrl}/onboarding?ref=${selectedProposal.referralCode}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${baseUrl}/onboarding?ref=${selectedProposal.referralCode}`, "Onboarding link")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                  onClick={() => shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'email' })}
                  disabled={shareProposalMutation.isPending}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Share via Email
                </Button>
                <Button
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-950"
                  onClick={() => {
                    const message = encodeURIComponent(`Hi ${selectedProposal.prospectName}, I've prepared a personalized investment proposal for you. View it here: ${baseUrl}/proposal/${selectedProposal.shareToken}`);
                    const phone = selectedProposal.prospectMobile?.replace(/[^0-9]/g, '') || '';
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                    shareProposalMutation.mutate({ id: selectedProposal.id, shareVia: 'whatsapp' });
                  }}
                  disabled={!selectedProposal.prospectMobile}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Share via WhatsApp
                </Button>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950 rounded-lg p-4">
                <h4 className="font-medium text-sm text-indigo-800 dark:text-indigo-200 mb-2">How it works</h4>
                <ol className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1 list-decimal list-inside">
                  <li>Share the proposal link with your prospect</li>
                  <li>They view the personalized investment plan</li>
                  <li>They click "Get Started" to begin onboarding</li>
                  <li>You get notified when they sign up</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
