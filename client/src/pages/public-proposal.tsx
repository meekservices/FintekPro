import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { 
  TrendingUp, 
  TrendingDown,
  Target, 
  PieChart, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Mail,
  Building2,
  Sparkles,
  Shield,
  BarChart3,
  Wallet,
  Calendar,
  User,
  ExternalLink,
  Download,
  Loader2,
  AlertTriangle,
  Lightbulb,
  Award,
  AlertCircle
} from "lucide-react";

interface ProposalData {
  id: string;
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
  agentName?: string;
  agentMobile?: string;
  agentEmail?: string;
  validUntil?: string;
  createdAt: string;
}

interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: Array<{ type: 'warning' | 'suggestion' | 'opportunity'; message: string; action?: string }>;
  topPerformers: Array<{ productType: string; productName: string; quantity: number; currentValue: number; category?: string }>;
  underperformers: Array<{ productType: string; productName: string; quantity: number; currentValue: number; category?: string }>;
}

function parseAnalysis(analysisStr?: string): PortfolioAnalysis | null {
  if (!analysisStr) return null;
  try {
    return JSON.parse(analysisStr);
  } catch {
    return null;
  }
}

function getRiskLabel(score: number): { label: string; color: string } {
  if (score <= 30) return { label: 'Low Risk', color: 'text-green-600' };
  if (score <= 50) return { label: 'Moderate Risk', color: 'text-yellow-600' };
  if (score <= 70) return { label: 'High Risk', color: 'text-orange-600' };
  return { label: 'Very High Risk', color: 'text-red-600' };
}

function getDiversificationLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Well Diversified', color: 'text-green-600' };
  if (score >= 50) return { label: 'Moderately Diversified', color: 'text-yellow-600' };
  if (score >= 30) return { label: 'Under-Diversified', color: 'text-orange-600' };
  return { label: 'Poorly Diversified', color: 'text-red-600' };
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  retirement: "Retirement Planning",
  child_education: "Child Education",
  wealth_creation: "Wealth Creation",
  home_purchase: "Home Purchase",
  emergency_fund: "Emergency Fund",
  tax_saving: "Tax Saving",
  regular_income: "Regular Income",
  custom: "Custom Goal",
};

const RISK_COLORS: Record<string, string> = {
  "Very Low": "text-green-600 bg-green-50",
  "Low": "text-green-600 bg-green-50",
  "Moderate": "text-yellow-600 bg-yellow-50",
  "Moderately High": "text-orange-600 bg-orange-50",
  "High": "text-red-600 bg-red-50",
  "Very High": "text-red-700 bg-red-50",
};

export default function PublicProposalPage() {
  const params = useParams();
  const shareToken = params.shareToken;
  const [onboardingLink, setOnboardingLink] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ proposal: ProposalData; onboardingLink: string }>({
    queryKey: ["/api/public/proposal", shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/public/proposal/${shareToken}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load proposal");
      }
      return res.json();
    },
    enabled: !!shareToken,
  });

  useEffect(() => {
    if (data?.onboardingLink) {
      setOnboardingLink(data.onboardingLink);
    }
  }, [data]);

  const trackClickMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/public/proposal/${shareToken}/onboarding-click`, {
        method: "POST",
      });
    },
  });

  const handleGetStarted = () => {
    trackClickMutation.mutate();
    if (onboardingLink) {
      window.location.href = onboardingLink;
    }
  };

  const generatePDF = async () => {
    if (!data?.proposal) return;
    
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const proposal = data.proposal;
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
      pdf.text(proposal.proposalTitle || 'Investment Proposal', margin, yPos);
      
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
      pdf.rect(margin, yPos, pageWidth - (margin * 2), 30, 'F');
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      
      const colWidth = (pageWidth - (margin * 2)) / 3;
      
      pdf.text('Total Investment', margin + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text(`₹${parseFloat(proposal.totalInvestmentAmount || '0').toLocaleString('en-IN')}`, margin + 5, yPos + 20);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Expected Returns', margin + colWidth + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(34, 197, 94);
      pdf.text(`${proposal.projectedReturns || '12'}% p.a.`, margin + colWidth + 5, yPos + 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Projected Value (5Y)', margin + (colWidth * 2) + 5, yPos + 10);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(147, 51, 234);
      pdf.text(`₹${parseFloat(proposal.projectedValue || '0').toLocaleString('en-IN')}`, margin + (colWidth * 2) + 5, yPos + 20);
      
      yPos += 45;
      
      // Portfolio Analysis Section
      const pdfAnalysis = parseAnalysis(proposal.currentAnalysis);
      if (pdfAnalysis) {
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Portfolio Health Analysis', margin, yPos);
        yPos += 12;
        
        // Risk and Diversification Scores
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos, (pageWidth - (margin * 2)) / 2 - 5, 25, 'F');
        pdf.rect(margin + (pageWidth - (margin * 2)) / 2 + 5, yPos, (pageWidth - (margin * 2)) / 2 - 5, 25, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Risk Score', margin + 5, yPos + 8);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(pdfAnalysis.riskScore > 70 ? 220 : pdfAnalysis.riskScore > 50 ? 234 : 34, 
                        pdfAnalysis.riskScore > 70 ? 38 : pdfAnalysis.riskScore > 50 ? 179 : 197, 
                        pdfAnalysis.riskScore > 70 ? 38 : pdfAnalysis.riskScore > 50 ? 8 : 94);
        pdf.text(`${pdfAnalysis.riskScore}/100`, margin + 5, yPos + 18);
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Diversification Score', margin + (pageWidth - (margin * 2)) / 2 + 10, yPos + 8);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(pdfAnalysis.diversificationScore >= 70 ? 34 : pdfAnalysis.diversificationScore >= 50 ? 234 : 220, 
                        pdfAnalysis.diversificationScore >= 70 ? 197 : pdfAnalysis.diversificationScore >= 50 ? 179 : 38, 
                        pdfAnalysis.diversificationScore >= 70 ? 94 : pdfAnalysis.diversificationScore >= 50 ? 8 : 38);
        pdf.text(`${pdfAnalysis.diversificationScore}/100`, margin + (pageWidth - (margin * 2)) / 2 + 10, yPos + 18);
        
        yPos += 35;
        
        // Key Insights
        if (pdfAnalysis.recommendations && pdfAnalysis.recommendations.length > 0) {
          if (yPos > 240) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Key Insights', margin, yPos);
          yPos += 8;
          
          pdfAnalysis.recommendations.forEach((insight) => {
            if (yPos > 270) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            const icon = insight.type === 'warning' ? '⚠' : insight.type === 'opportunity' ? '✓' : '💡';
            const insightLines = pdf.splitTextToSize(`${icon} ${insight.message}`, pageWidth - (margin * 2) - 10);
            pdf.text(insightLines, margin + 5, yPos);
            yPos += insightLines.length * 4 + 4;
          });
          
          yPos += 10;
        }
        
        // Top Performers
        if (pdfAnalysis.topPerformers && pdfAnalysis.topPerformers.length > 0) {
          if (yPos > 220) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Top Performing Holdings', margin, yPos);
          yPos += 8;
          
          pdfAnalysis.topPerformers.slice(0, 3).forEach((holding) => {
            if (yPos > 270) {
              pdf.addPage();
              yPos = 20;
            }
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(34, 197, 94);
            pdf.text(`▲ ${holding.productName}`, margin + 5, yPos);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`₹${holding.currentValue.toLocaleString('en-IN')}`, pageWidth - margin - 30, yPos);
            yPos += 6;
          });
          
          yPos += 10;
        }
      }
      
      const recommendations = proposal.recommendations || [];
      if (recommendations.length > 0) {
        if (yPos > 200) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Investment Recommendations', margin, yPos);
        yPos += 10;
        
        recommendations.forEach((rec: any, index: number) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos, pageWidth - (margin * 2), 25, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(rec.productName || rec.name || `Investment ${index + 1}`, margin + 5, yPos + 8);
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          const amount = rec.suggestedAmount || rec.amount || 0;
          pdf.text(`Amount: ₹${parseFloat(amount).toLocaleString('en-IN')}`, margin + 5, yPos + 18);
          
          if (rec.expectedReturn || rec.returns) {
            pdf.text(`Expected: ${rec.expectedReturn || rec.returns}`, margin + 80, yPos + 18);
          }
          
          // Add AMC and category info
          if (rec.amc || rec.category) {
            pdf.text(`${rec.amc || ''} ${rec.category ? '• ' + rec.category : ''}`, pageWidth - margin - 60, yPos + 18);
          }
          
          yPos += 30;
        });
      }
      
      if (proposal.agentName || proposal.agentEmail) {
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }
        
        yPos += 10;
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Your Financial Advisor', margin, yPos);
        yPos += 8;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        if (proposal.agentName) {
          pdf.text(proposal.agentName, margin, yPos);
          yPos += 6;
        }
        if (proposal.agentEmail) {
          pdf.text(`Email: ${proposal.agentEmail}`, margin, yPos);
          yPos += 6;
        }
        if (proposal.agentMobile) {
          pdf.text(`Mobile: ${proposal.agentMobile}`, margin, yPos);
        }
      }
      
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          'This proposal is for informational purposes only. Past performance is not indicative of future results.',
          margin, 
          pdf.internal.pageSize.getHeight() - 10
        );
        pdf.text(
          `Generated on ${new Date().toLocaleDateString('en-IN')} | Page ${i} of ${pageCount}`,
          pageWidth - margin - 50,
          pdf.internal.pageSize.getHeight() - 10
        );
      }
      
      pdf.save(`Investment_Proposal_${proposal.id || shareToken}.pdf`);
      
      toast({
        title: "PDF Downloaded",
        description: "Your investment proposal has been downloaded successfully.",
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground dark:text-muted-foreground">Loading your personalized proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Proposal Not Found</h2>
            <p className="text-muted-foreground dark:text-muted-foreground">
              {(error as Error)?.message || "This proposal may have expired or been removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const proposal = data.proposal;
  const recommendations = proposal.recommendations || [];
  const targetAllocation = proposal.targetAllocation || {};
  const analysis = parseAnalysis(proposal.currentAnalysis);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">FintekPro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={generatePDF}
              disabled={isGeneratingPdf}
              data-testid="btn-download-pdf"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>
            <Button 
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
              onClick={handleGetStarted}
              data-testid="btn-get-started-header"
            >
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Badge className="bg-indigo-100 text-indigo-700 mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            Personalized for You
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            {proposal.proposalTitle}
          </h1>
          {proposal.executiveSummary && (
            <p className="text-lg text-muted-foreground dark:text-muted-foreground max-w-3xl mx-auto">
              {proposal.executiveSummary}
            </p>
          )}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-indigo-100 text-sm">Total Investment</p>
                  <p className="text-2xl font-bold">
                    ₹{parseFloat(proposal.totalInvestmentAmount || '0').toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-green-100 text-sm">Expected Returns</p>
                  <p className="text-2xl font-bold">{proposal.projectedReturns}% p.a.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-purple-100 text-sm">Projected Value (5Y)</p>
                  <p className="text-2xl font-bold">
                    ₹{parseFloat(proposal.projectedValue || '0').toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investment Goals / Sample Portfolio Info */}
        {proposal.proposalType === 'fresh_investment' && proposal.investmentGoals && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" />
                Your Investment Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted dark:bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Goal</p>
                  <p className="font-medium">{GOAL_TYPE_LABELS[proposal.investmentGoals.goalType] || proposal.investmentGoals.goalType}</p>
                </div>
                <div className="bg-muted dark:bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Time Horizon</p>
                  <p className="font-medium capitalize">{proposal.investmentGoals.timeHorizon?.replace('_', ' ')}</p>
                </div>
                <div className="bg-muted dark:bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Risk Tolerance</p>
                  <p className="font-medium capitalize">{proposal.investmentGoals.riskTolerance}</p>
                </div>
                {proposal.investmentGoals.targetAmount && (
                  <div className="bg-muted dark:bg-muted rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Target Amount</p>
                    <p className="font-medium">₹{parseFloat(proposal.investmentGoals.targetAmount).toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portfolio Analysis Section */}
        {analysis && (
          <>
            {/* Portfolio Health Scores */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Portfolio Health Analysis
                </CardTitle>
                <CardDescription>
                  Comprehensive analysis of your current portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risk Score */}
                  <div className="bg-muted/50 dark:bg-muted/30 rounded-xl p-6" data-testid="card-risk-score">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <span className="font-medium">Risk Score</span>
                      </div>
                      <span className={`font-bold ${getRiskLabel(analysis.riskScore).color}`} data-testid="text-risk-score-value">
                        {analysis.riskScore}/100
                      </span>
                    </div>
                    <Progress value={analysis.riskScore} className="h-3 mb-2" data-testid="progress-risk-score" />
                    <p className={`text-sm font-medium ${getRiskLabel(analysis.riskScore).color}`} data-testid="text-risk-score-label">
                      {getRiskLabel(analysis.riskScore).label}
                    </p>
                  </div>

                  {/* Diversification Score */}
                  <div className="bg-muted/50 dark:bg-muted/30 rounded-xl p-6" data-testid="card-diversification-score">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-blue-500" />
                        <span className="font-medium">Diversification Score</span>
                      </div>
                      <span className={`font-bold ${getDiversificationLabel(analysis.diversificationScore).color}`} data-testid="text-diversification-score-value">
                        {analysis.diversificationScore}/100
                      </span>
                    </div>
                    <Progress value={analysis.diversificationScore} className="h-3 mb-2" data-testid="progress-diversification-score" />
                    <p className={`text-sm font-medium ${getDiversificationLabel(analysis.diversificationScore).color}`} data-testid="text-diversification-score-label">
                      {getDiversificationLabel(analysis.diversificationScore).label}
                    </p>
                  </div>
                </div>

                {/* Asset Allocation Breakdown */}
                {Object.keys(analysis.assetAllocation).length > 0 && (
                  <div className="mt-6" data-testid="section-asset-allocation">
                    <h4 className="font-medium mb-4">Current Asset Allocation</h4>
                    <div className="space-y-3">
                      {Object.entries(analysis.assetAllocation).map(([asset, data]) => (
                        <div key={asset} className="flex items-center gap-4" data-testid={`row-allocation-${asset}`}>
                          <div className="w-32 text-sm font-medium capitalize" data-testid={`text-allocation-name-${asset}`}>{asset.replace('_', ' ')}</div>
                          <div className="flex-1">
                            <Progress value={data.percentage} className="h-2" />
                          </div>
                          <div className="w-24 text-right text-sm">
                            <span className="font-medium" data-testid={`text-allocation-percent-${asset}`}>{data.percentage.toFixed(1)}%</span>
                            <span className="text-muted-foreground ml-2" data-testid={`text-allocation-value-${asset}`}>
                              (₹{data.value.toLocaleString('en-IN')})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Insights / Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <Card className="mb-8" data-testid="card-key-insights">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                    Key Insights & Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        data-testid={`card-insight-${idx}`}
                        className={`flex items-start gap-3 p-4 rounded-lg ${
                          rec.type === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                            : rec.type === 'opportunity'
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {rec.type === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        ) : rec.type === 'opportunity' ? (
                          <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid={`text-insight-message-${idx}`}>{rec.message}</p>
                          {rec.action && (
                            <Badge variant="outline" className="mt-2" data-testid={`badge-insight-action-${idx}`}>
                              Recommended: {rec.action}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Top Performers */}
            {analysis.topPerformers && analysis.topPerformers.length > 0 && (
              <Card className="mb-8" data-testid="card-top-performers">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-green-600" />
                    Top Performing Holdings
                  </CardTitle>
                  <CardDescription>Your best performing investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fund Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.topPerformers.map((holding, idx) => (
                        <TableRow key={idx} data-testid={`row-top-performer-${idx}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-green-500" />
                              <span data-testid={`text-top-performer-name-${idx}`}>{holding.productName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize" data-testid={`badge-top-performer-category-${idx}`}>
                              {holding.category || holding.productType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600" data-testid={`text-top-performer-value-${idx}`}>
                            ₹{holding.currentValue.toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Underperformers */}
            {analysis.underperformers && analysis.underperformers.length > 0 && (
              <Card className="mb-8" data-testid="card-underperformers">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    Holdings Requiring Attention
                  </CardTitle>
                  <CardDescription>Consider reviewing these investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fund Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.underperformers.map((holding, idx) => (
                        <TableRow key={idx} data-testid={`row-underperformer-${idx}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="w-4 h-4 text-amber-500" />
                              <span data-testid={`text-underperformer-name-${idx}`}>{holding.productName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize" data-testid={`badge-underperformer-category-${idx}`}>
                              {holding.category || holding.productType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-amber-600" data-testid={`text-underperformer-value-${idx}`}>
                            ₹{holding.currentValue.toLocaleString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Target Allocation */}
        {Object.keys(targetAllocation).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                Recommended Asset Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(targetAllocation).map(([asset, percentage]) => (
                  <div key={asset} className="text-center">
                    <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900 flex items-center justify-center">
                      <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{percentage}%</span>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground dark:text-muted-foreground">{asset}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Recommended Investments
              </CardTitle>
              <CardDescription>
                Carefully selected products based on your profile and goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{rec.productName}</h4>
                          {rec.riskRating && (
                            <Badge className={RISK_COLORS[rec.riskRating] || "bg-muted text-muted-foreground"} variant="outline">
                              {rec.riskRating}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {rec.amc && `${rec.amc} • `}{rec.category}
                        </p>
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground">{rec.selectionReason}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Investment</p>
                          <p className="font-bold text-lg">₹{rec.recommendedAmount?.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-muted-foreground">{rec.allocationPercentage}% allocation</p>
                        </div>
                        {rec.investmentType === 'sip' && rec.sipAmount && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Monthly SIP</p>
                            <p className="font-bold text-lg text-green-600">₹{rec.sipAmount?.toLocaleString('en-IN')}</p>
                          </div>
                        )}
                        {(rec.returns1Y || rec.returns3Y || rec.returns5Y) && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Returns</p>
                            <div className="flex gap-2 text-sm">
                              {rec.returns1Y && <span className="text-green-600">1Y: {rec.returns1Y}%</span>}
                              {rec.returns3Y && <span className="text-green-600">3Y: {rec.returns3Y}%</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Section */}
        <Card className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white border-0 mb-8">
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Start Your Investment Journey?</h2>
            <p className="text-indigo-100 mb-6 max-w-xl mx-auto">
              Join FintekPro today and let us help you achieve your financial goals with expert guidance and personalized strategies.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg"
                className="bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg"
                onClick={handleGetStarted}
                data-testid="btn-get-started-cta"
              >
                Start Investing Now <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Advisor Contact */}
        {(proposal.agentName || proposal.agentEmail || proposal.agentMobile) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Your Financial Advisor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-lg">{proposal.agentName || "Your Advisor"}</h4>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                    {proposal.agentEmail && (
                      <a href={`mailto:${proposal.agentEmail}`} className="flex items-center gap-1 hover:text-indigo-600">
                        <Mail className="w-4 h-4" /> {proposal.agentEmail}
                      </a>
                    )}
                    {proposal.agentMobile && (
                      <a href={`tel:${proposal.agentMobile}`} className="flex items-center gap-1 hover:text-indigo-600">
                        <Phone className="w-4 h-4" /> {proposal.agentMobile}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trust Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <h4 className="font-semibold mb-1">SEBI Registered</h4>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Fully compliant with regulatory guidelines</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-semibold mb-1">Secure Platform</h4>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Bank-grade security for your investments</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="font-semibold mb-1">Expert Guidance</h4>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground">Personalized advice from certified professionals</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted dark:bg-card border-t py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground dark:text-muted-foreground">
          <p className="mb-2">This proposal is generated for informational purposes only and does not constitute investment advice.</p>
          <p>Past performance is not indicative of future results. Please read all scheme-related documents carefully before investing.</p>
          <p className="mt-4">© {new Date().getFullYear()} FintekPro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
