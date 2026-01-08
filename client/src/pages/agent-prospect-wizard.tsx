import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, ArrowRight, ArrowLeft, Check, Target, PieChart, Scale, 
  TrendingUp, TrendingDown, Sparkles, Share2, Mail, MessageSquare, 
  Copy, ExternalLink, Plus, Trash2, Loader2, CheckCircle, AlertTriangle,
  IndianRupee, Percent, Clock, Shield, Zap, RefreshCw, Search, Users, Download,
  Upload, Link, FileText, AlertCircle
} from "lucide-react";
import jsPDF from "jspdf";

interface PortfolioHolding {
  productType: string;
  productName: string;
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  isin?: string;
  category?: string;
}

interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short_term' | 'medium_term' | 'long_term';
  primaryGoal: string;
  monthlyIncome?: number;
  existingInvestments?: number;
  liquidityNeeds?: 'low' | 'medium' | 'high';
}

interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: { type: string; message: string; action?: string }[];
  topPerformers: PortfolioHolding[];
  underperformers: PortfolioHolding[];
}

interface RebalanceRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string;
}

interface FreshInvestmentSuggestion {
  productType: string;
  productName: string;
  productId?: string;
  suggestedAmount: number;
  expectedReturn: string;
  riskLevel: string;
  matchScore: number;
  rationale: string;
  highlights: string[];
}

interface CombinedProposal {
  prospectId: string;
  proposalId: string;
  shareToken: string;
  analysis: PortfolioAnalysis;
  rebalancing: RebalanceRecommendation[];
  freshInvestments: FreshInvestmentSuggestion[];
  totalSellAmount: number;
  totalBuyAmount: number;
  netInvestmentRequired: number;
  projectedValue: number;
  projectedReturn: string;
  executiveSummary: string;
}

const PRODUCT_TYPES = [
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "equity", label: "Stocks" },
  { value: "bond", label: "Bonds/NCDs" },
  { value: "fd", label: "Fixed Deposit" },
  { value: "gold", label: "Gold/SGB" },
  { value: "etf", label: "ETF" },
  { value: "pms", label: "PMS" },
  { value: "aif", label: "AIF" },
  { value: "insurance", label: "Insurance/ULIP" },
  { value: "other", label: "Other" }
];

const GOAL_OPTIONS = [
  { value: "wealth_creation", label: "Wealth Creation" },
  { value: "retirement", label: "Retirement Planning" },
  { value: "child_education", label: "Child Education" },
  { value: "home_purchase", label: "Home Purchase" },
  { value: "tax_saving", label: "Tax Saving" },
  { value: "regular_income", label: "Regular Income" },
  { value: "emergency_fund", label: "Emergency Fund" }
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

interface ExistingProspect {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  pan?: string;
  state?: string;
  createdAt?: string;
}

export default function AgentProspectWizard() {
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const urlProspectId = urlParams.get('prospectId');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [prospectMode, setProspectMode] = useState<'new' | 'existing'>(urlProspectId ? 'existing' : 'new');
  const [prospectSearch, setProspectSearch] = useState('');
  
  const [prospectData, setProspectData] = useState({
    name: "",
    email: "",
    mobile: "",
    pan: "",
    notes: ""
  });

  const [riskProfile, setRiskProfile] = useState<RiskProfile>({
    riskTolerance: 'moderate',
    investmentHorizon: 'medium_term',
    primaryGoal: 'wealth_creation',
    monthlyIncome: 0,
    existingInvestments: 0,
    liquidityNeeds: 'medium'
  });

  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [newHolding, setNewHolding] = useState<Partial<PortfolioHolding>>({
    productType: "mutual_fund",
    productName: "",
    quantity: 1,
    currentValue: 0
  });

  const [freshInvestmentAmount, setFreshInvestmentAmount] = useState(0);
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  
  // Portfolio Import State
  const [importMode, setImportMode] = useState<'manual' | 'upload' | 'url'>('manual');
  const [importUrl, setImportUrl] = useState('');
  const [importResult, setImportResult] = useState<{
    success: boolean;
    holdings: any[];
    brokerDetected: string | null;
    confidenceScore: number;
    errors: string[];
  } | null>(null);
  const [rebalancing, setRebalancing] = useState<RebalanceRecommendation[]>([]);
  const [freshInvestments, setFreshInvestments] = useState<FreshInvestmentSuggestion[]>([]);
  const [proposal, setProposal] = useState<CombinedProposal | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(urlProspectId);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const generateProposalPDF = () => {
    if (!proposal || !analysis) return;
    
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = 20;

      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FintekPro', margin, 25);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Investment Proposal', pageWidth - margin - 40, 25);
      
      yPos = 55;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Investment Proposal for ${prospectData.name}`, margin, yPos);
      
      if (proposal.executiveSummary) {
        yPos += 12;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        const summaryLines = pdf.splitTextToSize(proposal.executiveSummary, pageWidth - (margin * 2));
        pdf.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 5 + 10;
      }
      
      yPos += 5;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, yPos, pageWidth - (margin * 2), 35, 'F');
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      const colWidth = (pageWidth - (margin * 2)) / 4;
      
      pdf.text('Total Sell', margin + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(220, 38, 38);
      pdf.text(formatCurrency(proposal.totalSellAmount), margin + 5, yPos + 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Total Buy', margin + colWidth + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(34, 197, 94);
      pdf.text(formatCurrency(proposal.totalBuyAmount), margin + colWidth + 5, yPos + 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Net Investment', margin + (colWidth * 2) + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text(formatCurrency(proposal.netInvestmentRequired), margin + (colWidth * 2) + 5, yPos + 20);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Projected Value', margin + (colWidth * 3) + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(79, 70, 229);
      pdf.text(formatCurrency(proposal.projectedValue), margin + (colWidth * 3) + 5, yPos + 20);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(proposal.projectedReturn, margin + (colWidth * 3) + 5, yPos + 28);
      
      yPos += 50;
      
      if (proposal.rebalancing && proposal.rebalancing.length > 0) {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Rebalancing Recommendations', margin, yPos);
        yPos += 10;
        
        proposal.rebalancing.forEach((rec) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 20, 'F');
          
          const actionColor = rec.action === 'SELL' ? [220, 38, 38] : rec.action === 'BUY' ? [34, 197, 94] : [245, 158, 11];
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.rect(margin, yPos, 3, 20, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${rec.action}: ${rec.productName}`, margin + 8, yPos + 8);
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          const changeText = rec.changeAmount < 0 ? `-${formatCurrency(Math.abs(rec.changeAmount))}` : `+${formatCurrency(rec.changeAmount)}`;
          pdf.text(changeText, margin + 8, yPos + 16);
          
          yPos += 25;
        });
      }
      
      if (proposal.freshInvestments && proposal.freshInvestments.length > 0) {
        yPos += 5;
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fresh Investment Suggestions', margin, yPos);
        yPos += 10;
        
        proposal.freshInvestments.forEach((inv) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 25, 'F');
          pdf.setFillColor(79, 70, 229);
          pdf.rect(margin, yPos, 3, 25, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(inv.productName, margin + 8, yPos + 8);
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`${formatCurrency(inv.suggestedAmount)} | ${inv.expectedReturn} | Match: ${inv.matchScore}%`, margin + 8, yPos + 18);
          
          yPos += 30;
        });
      }
      
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          'This proposal is for informational purposes only. Please consult your financial advisor.',
          margin, 
          pdf.internal.pageSize.getHeight() - 10
        );
        pdf.text(
          `Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i} of ${pageCount}`,
          pageWidth - margin - 50,
          pdf.internal.pageSize.getHeight() - 10
        );
      }
      
      pdf.save(`Proposal_${prospectData.name.replace(/\s+/g, '_')}_${proposal.proposalId}.pdf`);
      
      toast({
        title: "PDF Downloaded",
        description: "Investment proposal has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Download Failed",
        description: "Unable to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const { data: existingProspectsData, isLoading: loadingProspects } = useQuery<{ success: boolean; prospects: ExistingProspect[] }>({
    queryKey: ["/api/agent-wizard/prospects"],
    enabled: prospectMode === 'existing'
  });

  const existingProspects = existingProspectsData?.prospects || [];
  const searchLower = prospectSearch.toLowerCase();
  const filteredProspects = existingProspects.filter(p => 
    (p.name || '').toLowerCase().includes(searchLower) ||
    (p.email || '').toLowerCase().includes(searchLower) ||
    (p.pan || '').toLowerCase().includes(searchLower)
  );

  const selectExistingProspect = (prospect: ExistingProspect, autoAdvance = false) => {
    setProspectId(prospect.id);
    setProspectData({
      name: prospect.name || "",
      email: prospect.email || "",
      mobile: prospect.mobile || "",
      pan: prospect.pan || "",
      notes: ""
    });
    if (autoAdvance) {
      setCurrentStep(2);
      toast({ title: "Prospect Loaded", description: `${prospect.name} loaded. Configure risk profile.` });
    } else {
      toast({ title: "Prospect Selected", description: `${prospect.name} selected. Continue to Risk Profile.` });
    }
  };

  useEffect(() => {
    if (urlProspectId && existingProspects.length > 0 && currentStep === 1) {
      const found = existingProspects.find(p => p.id === urlProspectId);
      if (found) {
        selectExistingProspect(found, true);
      }
    }
  }, [urlProspectId, existingProspects]);

  const createProspectMutation = useMutation({
    mutationFn: async (data: typeof prospectData) => {
      const res = await apiRequest("/api/agent-wizard/prospects", {
        method: "POST",
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setProspectId(data.prospectId);
        toast({ title: "Prospect Created", description: "Prospect profile saved successfully." });
        setCurrentStep(2);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create prospect.", variant: "destructive" });
    }
  });

  // Portfolio upload mutation
  const uploadPortfolioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('portfolio', file);
      const res = await fetch(`/api/agent/prospects/${prospectId}/portfolio/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          const mappedHoldings: PortfolioHolding[] = data.holdings.map((h: any) => ({
            productType: h.assetType || 'mutual_fund',
            productName: h.name,
            quantity: h.units || 1,
            currentValue: h.currentValue,
            isin: h.isin,
            category: h.category
          }));
          setHoldings(prev => [...prev, ...mappedHoldings]);
          toast({ 
            title: "Portfolio Imported", 
            description: `Detected ${data.brokerDetected || 'portfolio'}: ${data.holdings.length} holdings imported with ${data.confidenceScore}% confidence.` 
          });
        }
      } else {
        toast({ title: "Import Failed", description: data.error || "Could not parse portfolio file.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Upload Error", description: "Failed to upload portfolio file.", variant: "destructive" });
    }
  });

  // Portfolio URL import mutation
  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await apiRequest(`/api/agent/prospects/${prospectId}/portfolio/import-url`, {
        method: 'POST',
        body: JSON.stringify({ portfolioUrl: url })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setImportResult(data);
        if (data.holdings && data.holdings.length > 0) {
          const mappedHoldings: PortfolioHolding[] = data.holdings.map((h: any) => ({
            productType: h.assetType || 'mutual_fund',
            productName: h.name,
            quantity: h.units || 1,
            currentValue: h.currentValue,
            isin: h.isin,
            category: h.category
          }));
          setHoldings(prev => [...prev, ...mappedHoldings]);
          toast({ 
            title: "Portfolio Imported", 
            description: `${data.holdings.length} holdings imported from ${data.brokerDetected || 'URL'}.` 
          });
        }
      } else {
        toast({ title: "Import Failed", description: data.error || "Could not parse portfolio from URL.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "URL Import Error", description: "Failed to import from URL.", variant: "destructive" });
    }
  });

  const analyzePortfolioMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agent-wizard/analyze-portfolio", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setAnalysis(data.analysis);
        toast({ title: "Analysis Complete", description: "Portfolio analyzed successfully." });
        setCurrentStep(4);
      }
    }
  });

  const getRebalancingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agent-wizard/rebalancing-suggestions", {
        method: "POST",
        body: JSON.stringify({ holdings, riskProfile, analysis })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setRebalancing(data.suggestions);
        setCurrentStep(5);
      }
    }
  });

  const getFreshInvestmentsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agent-wizard/fresh-investment-suggestions", {
        method: "POST",
        body: JSON.stringify({ 
          riskProfile, 
          investmentAmount: freshInvestmentAmount,
          existingHoldings: holdings 
        })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setFreshInvestments(data.suggestions);
        setCurrentStep(6);
      }
    }
  });

  const generateProposalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("/api/agent-wizard/generate-proposal", {
        method: "POST",
        body: JSON.stringify({
          prospectId,
          prospectData,
          holdings,
          riskProfile,
          freshInvestmentAmount
        })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setProposal(data.proposal);
        toast({ title: "Proposal Generated", description: "Investment proposal ready to share!" });
        setCurrentStep(7);
      }
    }
  });

  const shareProposalMutation = useMutation({
    mutationFn: async (channel: 'email' | 'whatsapp' | 'sms') => {
      if (!proposal) return;
      const res = await apiRequest(`/api/agent-wizard/proposals/${proposal.proposalId}/share`, {
        method: "POST",
        body: JSON.stringify({ channel })
      });
      return res.json();
    },
    onSuccess: (data, channel) => {
      if (data.success) {
        toast({ 
          title: "Proposal Shared", 
          description: `Proposal link sent via ${channel}. Share URL copied to clipboard.` 
        });
        navigator.clipboard.writeText(data.shareUrl);
        setShowShareDialog(false);
      }
    }
  });

  const addHolding = () => {
    if (!newHolding.productName || !newHolding.currentValue) {
      toast({ title: "Missing Fields", description: "Enter product name and value.", variant: "destructive" });
      return;
    }
    setHoldings([...holdings, newHolding as PortfolioHolding]);
    setNewHolding({ productType: "mutual_fund", productName: "", quantity: 1, currentValue: 0 });
  };

  const removeHolding = (index: number) => {
    setHoldings(holdings.filter((_, i) => i !== index));
  };

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  const steps = [
    { num: 1, title: "Add Prospect", icon: User },
    { num: 2, title: "Risk Profile", icon: Target },
    { num: 3, title: "Portfolio", icon: PieChart },
    { num: 4, title: "Analysis", icon: Sparkles },
    { num: 5, title: "Rebalance", icon: Scale },
    { num: 6, title: "Fresh Invest", icon: TrendingUp },
    { num: 7, title: "Share", icon: Share2 }
  ];

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Prospect Onboarding Wizard
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete workflow: Add prospect → Analyze portfolio → Generate AI recommendations → Share proposal
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                currentStep >= step.num 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground/30 text-muted-foreground'
              }`}>
                {currentStep > step.num ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-8 md:w-16 h-0.5 mx-1 ${currentStep > step.num ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map(step => (
            <span key={step.num} className="w-12 md:w-20 text-center">{step.title}</span>
          ))}
        </div>
      </div>

      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Select or Add Prospect</CardTitle>
            <CardDescription>Choose an existing prospect or create a new one</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={prospectMode} onValueChange={(v) => setProspectMode(v as 'new' | 'existing')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="flex items-center gap-2" data-testid="tab-existing-prospect">
                  <Users className="h-4 w-4" /> Existing Prospect
                </TabsTrigger>
                <TabsTrigger value="new" className="flex items-center gap-2" data-testid="tab-new-prospect">
                  <Plus className="h-4 w-4" /> New Prospect
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="existing" className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name, email, or PAN..."
                    value={prospectSearch}
                    onChange={(e) => setProspectSearch(e.target.value)}
                    className="pl-10"
                    data-testid="prospect-search-input"
                  />
                </div>
                
                {loadingProspects ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredProspects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No prospects found. Add a new prospect to get started.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-64 rounded-md border">
                    <div className="p-2 space-y-2">
                      {filteredProspects.map(prospect => (
                        <div
                          key={prospect.id}
                          onClick={() => selectExistingProspect(prospect, false)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted ${
                            prospectId === prospect.id ? 'border-primary bg-primary/5' : ''
                          }`}
                          data-testid={`prospect-item-${prospect.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{prospect.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {prospect.email || prospect.mobile || 'No contact info'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {prospect.pan && (
                                <Badge variant="outline" className="text-xs">{prospect.pan}</Badge>
                              )}
                              {prospectId === prospect.id && (
                                <CheckCircle className="h-5 w-5 text-primary" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {prospectId && prospectMode === 'existing' && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium text-primary">Selected: {prospectData.name}</p>
                    <p className="text-xs text-muted-foreground">{prospectData.email || prospectData.mobile}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="new" className="mt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name *</Label>
                    <Input 
                      placeholder="Rajesh Kumar"
                      value={prospectData.name}
                      onChange={(e) => setProspectData({ ...prospectData, name: e.target.value })}
                      data-testid="prospect-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PAN</Label>
                    <Input 
                      placeholder="ABCDE1234F"
                      value={prospectData.pan}
                      onChange={(e) => setProspectData({ ...prospectData, pan: e.target.value.toUpperCase() })}
                      maxLength={10}
                      data-testid="prospect-pan-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      placeholder="client@email.com"
                      value={prospectData.email}
                      onChange={(e) => setProspectData({ ...prospectData, email: e.target.value })}
                      data-testid="prospect-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mobile</Label>
                    <Input 
                      placeholder="+91 9876543210"
                      value={prospectData.mobile}
                      onChange={(e) => setProspectData({ ...prospectData, mobile: e.target.value })}
                      data-testid="prospect-mobile-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    placeholder="Any additional notes about the client..."
                    value={prospectData.notes}
                    onChange={(e) => setProspectData({ ...prospectData, notes: e.target.value })}
                    data-testid="prospect-notes-input"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="justify-end">
            {prospectMode === 'existing' ? (
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!prospectId}
                data-testid="continue-existing-btn"
              >
                Continue to Risk Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={() => createProspectMutation.mutate(prospectData)}
                disabled={!prospectData.name || createProspectMutation.isPending}
                data-testid="create-prospect-btn"
              >
                {createProspectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Continue to Risk Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Risk Profile</CardTitle>
            <CardDescription>Understand {prospectData.name}'s investment preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Risk Tolerance</Label>
              <RadioGroup 
                value={riskProfile.riskTolerance}
                onValueChange={(v: any) => setRiskProfile({ ...riskProfile, riskTolerance: v })}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {['conservative', 'moderate', 'aggressive', 'very_aggressive'].map(risk => (
                  <Label key={risk} htmlFor={risk} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.riskTolerance === risk ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value={risk} id={risk} />
                    <span className="capitalize">{risk.replace('_', ' ')}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Investment Horizon</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setRiskProfile({ ...riskProfile, investmentHorizon: 'short_term' })}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.investmentHorizon === 'short_term' ? 'border-primary bg-primary/5' : ''}`}
                  data-testid="horizon-short-term"
                >
                  <Clock className="h-6 w-6 mb-1" />
                  <span className="font-medium">Short Term</span>
                  <span className="text-xs text-muted-foreground">&lt; 3 years</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRiskProfile({ ...riskProfile, investmentHorizon: 'medium_term' })}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.investmentHorizon === 'medium_term' ? 'border-primary bg-primary/5' : ''}`}
                  data-testid="horizon-medium-term"
                >
                  <Clock className="h-6 w-6 mb-1" />
                  <span className="font-medium">Medium Term</span>
                  <span className="text-xs text-muted-foreground">3-7 years</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRiskProfile({ ...riskProfile, investmentHorizon: 'long_term' })}
                  className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${riskProfile.investmentHorizon === 'long_term' ? 'border-primary bg-primary/5' : ''}`}
                  data-testid="horizon-long-term"
                >
                  <Clock className="h-6 w-6 mb-1" />
                  <span className="font-medium">Long Term</span>
                  <span className="text-xs text-muted-foreground">7+ years</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Primary Investment Goal</Label>
              <Select value={riskProfile.primaryGoal} onValueChange={(v) => setRiskProfile({ ...riskProfile, primaryGoal: v })}>
                <SelectTrigger data-testid="goal-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map(goal => (
                    <SelectItem key={goal.value} value={goal.value}>{goal.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(1)} data-testid="back-to-prospect-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={() => setCurrentStep(3)} data-testid="continue-to-portfolio-btn">
              Continue to Portfolio <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> Current Portfolio</CardTitle>
            <CardDescription>Import or manually enter existing investments for analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Import Mode Selection */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={importMode === 'manual' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('manual')}
                data-testid="mode-manual-btn"
              >
                <Plus className="h-4 w-4 mr-1" /> Manual Entry
              </Button>
              <Button 
                variant={importMode === 'upload' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('upload')}
                data-testid="mode-upload-btn"
              >
                <Upload className="h-4 w-4 mr-1" /> Upload PDF
              </Button>
              <Button 
                variant={importMode === 'url' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setImportMode('url')}
                data-testid="mode-url-btn"
              >
                <Link className="h-4 w-4 mr-1" /> Import from URL
              </Button>
            </div>

            {/* Upload PDF Section */}
            {importMode === 'upload' && (
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/20">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a portfolio statement PDF from Zerodha, Groww, ICICI Direct, HDFC Securities, Kotak, or other brokers
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  id="portfolio-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && prospectId) {
                      uploadPortfolioMutation.mutate(file);
                    } else if (!prospectId) {
                      toast({ title: "Error", description: "Please create prospect first.", variant: "destructive" });
                    }
                  }}
                  data-testid="portfolio-file-input"
                />
                <label htmlFor="portfolio-upload">
                  <Button 
                    variant="secondary" 
                    disabled={uploadPortfolioMutation.isPending || !prospectId}
                    asChild
                  >
                    <span>
                      {uploadPortfolioMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Parsing...</>
                      ) : (
                        <><Upload className="h-4 w-4 mr-2" /> Choose PDF File</>
                      )}
                    </span>
                  </Button>
                </label>
                {importResult && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                    {importResult.success ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Detected {importResult.brokerDetected} • {importResult.holdings.length} holdings • {importResult.confidenceScore}% confidence
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {importResult.errors?.[0] || 'Failed to parse portfolio'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* URL Import Section */}
            {importMode === 'url' && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <p className="text-sm text-muted-foreground mb-3">
                  Import portfolio from Wealthy.in, MF Central, or other supported platforms
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://wealthy.in/share/portfolio/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="flex-1"
                    data-testid="portfolio-url-input"
                  />
                  <Button
                    onClick={() => {
                      if (importUrl && prospectId) {
                        importUrlMutation.mutate(importUrl);
                      } else if (!prospectId) {
                        toast({ title: "Error", description: "Please create prospect first.", variant: "destructive" });
                      }
                    }}
                    disabled={importUrlMutation.isPending || !importUrl || !prospectId}
                    data-testid="import-url-btn"
                  >
                    {importUrlMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Import</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Supported: Wealthy.in public share links, MF Central export URLs
                </p>
              </div>
            )}

            {/* Manual Entry Section */}
            {importMode === 'manual' && (
            <div className="grid md:grid-cols-5 gap-3 items-end p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select value={newHolding.productType} onValueChange={(v) => setNewHolding({ ...newHolding, productType: v })}>
                  <SelectTrigger data-testid="product-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Product Name</Label>
                <Input 
                  placeholder="HDFC Flexi Cap Fund"
                  value={newHolding.productName}
                  onChange={(e) => setNewHolding({ ...newHolding, productName: e.target.value })}
                  data-testid="product-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Current Value (₹)</Label>
                <Input 
                  type="number"
                  placeholder="100000"
                  value={newHolding.currentValue || ''}
                  onChange={(e) => setNewHolding({ ...newHolding, currentValue: parseFloat(e.target.value) || 0 })}
                  data-testid="product-value-input"
                />
              </div>
              <Button onClick={addHolding} data-testid="add-holding-btn">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            )}

            {/* Holdings Table - Always visible */}
            {holdings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{holding.productName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{PRODUCT_TYPES.find(t => t.value === holding.productType)?.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(holding.currentValue)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeHolding(idx)} data-testid={`remove-holding-${idx}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">Total Portfolio Value</TableCell>
                    <TableCell className="text-right font-bold text-lg">{formatCurrency(totalPortfolioValue)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No holdings added yet. Add investments above or proceed for fresh investment recommendations.</p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Fresh Investment Amount (Optional)</Label>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="number"
                  placeholder="500000"
                  value={freshInvestmentAmount || ''}
                  onChange={(e) => setFreshInvestmentAmount(parseFloat(e.target.value) || 0)}
                  className="max-w-xs"
                  data-testid="fresh-investment-input"
                />
              </div>
              <p className="text-sm text-muted-foreground">Enter amount for new investment recommendations</p>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(2)} data-testid="back-to-risk-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => analyzePortfolioMutation.mutate()}
              disabled={analyzePortfolioMutation.isPending}
              data-testid="analyze-portfolio-btn"
            >
              {analyzePortfolioMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Analyze Portfolio
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 4 && analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Portfolio Analysis</CardTitle>
            <CardDescription>AI-powered insights for {prospectData.name}'s portfolio</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCurrency(analysis.totalValue)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Diversification Score</p>
                  <p className="text-2xl font-bold">{analysis.diversificationScore}/100</p>
                  <Progress value={analysis.diversificationScore} className="mt-2" />
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border-amber-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Risk Score</p>
                  <p className="text-2xl font-bold">{analysis.riskScore}/100</p>
                  <Progress value={analysis.riskScore} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(analysis.assetAllocation).map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <Progress value={data.percentage} className="w-24" />
                          <span className="text-sm font-medium w-12 text-right">{data.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.recommendations.map((rec, idx) => (
                      <div key={idx} className={`p-2 rounded-lg text-sm ${
                        rec.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30' :
                        rec.type === 'suggestion' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        'bg-green-100 dark:bg-green-900/30'
                      }`}>
                        {rec.type === 'warning' && <AlertTriangle className="h-4 w-4 inline mr-1" />}
                        {rec.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(3)} data-testid="back-to-portfolio-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => getRebalancingMutation.mutate()}
              disabled={getRebalancingMutation.isPending}
              data-testid="get-rebalancing-btn"
            >
              {getRebalancingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Scale className="h-4 w-4 mr-2" /> Get Rebalancing Suggestions
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Rebalancing Recommendations</CardTitle>
            <CardDescription>AI-suggested portfolio adjustments based on {riskProfile.riskTolerance} risk profile</CardDescription>
          </CardHeader>
          <CardContent>
            {rebalancing.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="font-medium">Portfolio is well-balanced!</p>
                <p>No immediate rebalancing needed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rebalancing.map((rec, idx) => (
                  <Card key={idx} className={`${
                    rec.action === 'SELL' ? 'border-l-4 border-l-red-500' :
                    rec.action === 'BUY' ? 'border-l-4 border-l-green-500' :
                    'border-l-4 border-l-amber-500'
                  }`}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.action === 'SELL' ? 'destructive' : rec.action === 'BUY' ? 'default' : 'secondary'}>
                            {rec.action}
                          </Badge>
                          <span className="font-medium">{rec.productName}</span>
                          <Badge variant="outline">{rec.priority}</Badge>
                        </div>
                        <span className={`font-bold ${rec.changeAmount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {rec.changeAmount < 0 ? '-' : '+'}{formatCurrency(Math.abs(rec.changeAmount))}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                      {rec.taxImplications && (
                        <p className="text-xs text-amber-600 mt-1">Tax Note: {rec.taxImplications}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(4)} data-testid="back-to-analysis-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => getFreshInvestmentsMutation.mutate()}
              disabled={getFreshInvestmentsMutation.isPending}
              data-testid="get-fresh-investments-btn"
            >
              {getFreshInvestmentsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <TrendingUp className="h-4 w-4 mr-2" /> Fresh Investment Ideas
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Fresh Investment Suggestions</CardTitle>
            <CardDescription>
              AI-curated opportunities for {freshInvestmentAmount > 0 ? formatCurrency(freshInvestmentAmount) : 'optimal allocation'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {freshInvestments.map((inv, idx) => (
                <Card key={idx} className="border-l-4 border-l-primary">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium">{inv.productName}</span>
                        <Badge variant="outline" className="ml-2">{PRODUCT_TYPES.find(t => t.value === inv.productType)?.label}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(inv.suggestedAmount)}</p>
                        <p className="text-xs text-muted-foreground">Match: {inv.matchScore}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-2">
                      <span className="flex items-center gap-1">
                        <Percent className="h-4 w-4" /> {inv.expectedReturn}
                      </span>
                      <Badge variant={inv.riskLevel === 'low' ? 'secondary' : inv.riskLevel === 'high' ? 'destructive' : 'outline'}>
                        {inv.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{inv.rationale}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(5)} data-testid="back-to-rebalance-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={() => generateProposalMutation.mutate()}
              disabled={generateProposalMutation.isPending}
              data-testid="generate-proposal-btn"
            >
              {generateProposalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Sparkles className="h-4 w-4 mr-2" /> Generate Proposal
            </Button>
          </CardFooter>
        </Card>
      )}

      {currentStep === 7 && proposal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Proposal Ready!</CardTitle>
                <CardDescription>Investment proposal for {prospectData.name}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  onClick={generateProposalPDF}
                  disabled={isGeneratingPdf}
                  data-testid="download-pdf-btn"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download PDF
                </Button>
                <Button onClick={() => setShowShareDialog(true)} data-testid="share-proposal-btn">
                  <Share2 className="h-4 w-4 mr-2" /> Share with Client
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-2">Executive Summary</p>
                <p className="text-muted-foreground">{proposal.executiveSummary}</p>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Sell</p>
                  <p className="text-xl font-bold text-red-600">{formatCurrency(proposal.totalSellAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Buy</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(proposal.totalBuyAmount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Net Investment</p>
                  <p className="text-xl font-bold">{formatCurrency(proposal.netInvestmentRequired)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Projected Value</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(proposal.projectedValue)}</p>
                  <p className="text-xs text-muted-foreground">{proposal.projectedReturn}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm">Share Link:</span>
              <code className="flex-1 text-sm bg-background px-2 py-1 rounded">
                {`${window.location.origin}/proposal/${proposal.shareToken}`}
              </code>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal.shareToken}`);
                  toast({ title: "Copied!", description: "Link copied to clipboard" });
                }}
                data-testid="copy-share-link-btn"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(6)} data-testid="back-to-fresh-invest-btn">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button variant="outline" onClick={() => window.open(`/proposal/${proposal.shareToken}`, '_blank')} data-testid="preview-proposal-btn">
              <ExternalLink className="h-4 w-4 mr-2" /> Preview Proposal
            </Button>
          </CardFooter>
        </Card>
      )}

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Proposal</DialogTitle>
            <DialogDescription>Choose how you want to share this proposal with {prospectData.name}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => shareProposalMutation.mutate('email')}
              disabled={shareProposalMutation.isPending}
              data-testid="share-email-btn"
            >
              <Mail className="h-8 w-8" />
              <span>Email</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => shareProposalMutation.mutate('whatsapp')}
              disabled={shareProposalMutation.isPending}
              data-testid="share-whatsapp-btn"
            >
              <MessageSquare className="h-8 w-8" />
              <span>WhatsApp</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex flex-col h-24 gap-2"
              onClick={() => {
                if (proposal) {
                  navigator.clipboard.writeText(`${window.location.origin}/proposal/${proposal.shareToken}`);
                  toast({ title: "Link Copied", description: "Share link copied to clipboard" });
                  setShowShareDialog(false);
                }
              }}
              data-testid="copy-link-btn"
            >
              <Copy className="h-8 w-8" />
              <span>Copy Link</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
