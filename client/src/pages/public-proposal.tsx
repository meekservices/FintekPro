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

interface PortfolioMetrics {
  totalValue: number;
  expectedReturn: number;
  volatility: number | null;
  beta: number | null;
  alpha: number | null;
  sharpeRatio: number | null;
  treynorRatio: number | null;
  sortinoRatio: number | null;
  informationRatio: number | null;
  maxDrawdown: number | null;
  diversificationScore: number;
  riskScore: number;
  assetAllocation: {
    equity: number;
    debt: number;
    hybrid: number;
    gold: number;
    silver: number;
    others: number;
  };
}

interface PortfolioComparison {
  currentPortfolio: PortfolioMetrics;
  proposedPortfolio: PortfolioMetrics;
  improvements: Array<{
    metric: string;
    current: number | null;
    proposed: number | null;
    change: number | null;
    interpretation: string;
    isImprovement: boolean;
  }>;
}

interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: Array<{ type: 'warning' | 'suggestion' | 'opportunity'; message: string; action?: string }>;
  topPerformers: Array<{ productType: string; productName: string; quantity: number; currentValue: number; category?: string }>;
  underperformers: Array<{ productType: string; productName: string; quantity: number; currentValue: number; category?: string }>;
  portfolioComparison?: PortfolioComparison;
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

interface ProposalError extends Error {
  status?: number;
  errorType?: 'expired' | 'not_found' | 'unknown';
}

export default function PublicProposalPage() {
  const params = useParams();
  const shareToken = params.shareToken;
  const [onboardingLink, setOnboardingLink] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ proposal: ProposalData; onboardingLink: string }, ProposalError>({
    queryKey: ["/api/public/proposal", shareToken],
    queryFn: async () => {
      const res = await fetch(`/api/public/proposal/${shareToken}`);
      if (!res.ok) {
        const err = await res.json();
        const proposalError: ProposalError = new Error(err.error || "Failed to load proposal");
        proposalError.status = res.status;
        proposalError.errorType = res.status === 410 ? 'expired' : res.status === 404 ? 'not_found' : 'unknown';
        throw proposalError;
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
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = 0;
      
      const formatRs = (val: number | string) => {
        const num = typeof val === 'string' ? parseFloat(val) : val;
        if (isNaN(num)) return 'Rs. 0';
        if (num >= 10000000) return `Rs. ${(num / 10000000).toFixed(2)} Cr`;
        if (num >= 100000) return `Rs. ${(num / 100000).toFixed(2)} L`;
        return `Rs. ${num.toLocaleString('en-IN')}`;
      };
      
      const sanitizeText = (text: string) => {
        if (!text) return '';
        return text.replace(/₹/g, 'Rs. ').replace(/\*\*/g, '');
      };
      
      const checkPageBreak = (neededHeight: number) => {
        if (yPos + neededHeight > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // Header
      pdf.setFillColor(79, 70, 229);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FintekPro', margin, 22);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Investment Proposal', pageWidth - margin - 35, 22);
      
      yPos = 45;
      
      // Title
      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(sanitizeText(proposal.proposalTitle || 'Investment Proposal'), margin, yPos);
      yPos += 8;
      
      // Executive Summary
      if (proposal.executiveSummary) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(80, 80, 80);
        const summaryLines = pdf.splitTextToSize(sanitizeText(proposal.executiveSummary), pageWidth - (margin * 2));
        pdf.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 4 + 8;
      }
      
      // Key Metrics Box
      const metricsBoxHeight = 28;
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), metricsBoxHeight, 3, 3, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), metricsBoxHeight, 3, 3, 'S');
      
      const col3Width = (pageWidth - (margin * 2)) / 3;
      
      // Total Investment
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Total Investment', margin + 8, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(30, 30, 30);
      pdf.text(formatRs(proposal.totalInvestmentAmount || 0), margin + 8, yPos + 20);
      
      // Expected Returns
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Expected Returns', margin + col3Width + 5, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(22, 163, 74);
      pdf.text(`${proposal.projectedReturns || '12'}% p.a.`, margin + col3Width + 5, yPos + 20);
      
      // Projected Value
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('5-Year Value', margin + (col3Width * 2) + 5, yPos + 9);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(124, 58, 237);
      pdf.text(formatRs(proposal.projectedValue || 0), margin + (col3Width * 2) + 5, yPos + 20);
      
      yPos += metricsBoxHeight + 12;
      
      // Portfolio Health Section
      const pdfAnalysis = parseAnalysis(proposal.currentAnalysis);
      if (pdfAnalysis) {
        checkPageBreak(70);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Portfolio Health Analysis', margin, yPos);
        yPos += 10;
        
        const halfWidth = (pageWidth - (margin * 2) - 10) / 2;
        
        // Risk Score Card
        const riskScore = pdfAnalysis.riskScore || 0;
        pdf.setFillColor(riskScore > 70 ? 254 : riskScore > 50 ? 254 : 240, 
                        riskScore > 70 ? 242 : riskScore > 50 ? 249 : 253, 
                        riskScore > 70 ? 242 : riskScore > 50 ? 235 : 244);
        pdf.roundedRect(margin, yPos, halfWidth, 35, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Risk Score', margin + 8, yPos + 10);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(riskScore > 70 ? 185 : riskScore > 50 ? 202 : 22, 
                        riskScore > 70 ? 28 : riskScore > 50 ? 138 : 163, 
                        riskScore > 70 ? 28 : riskScore > 50 ? 4 : 74);
        pdf.text(`${riskScore}`, margin + 8, yPos + 25);
        pdf.setFontSize(10);
        pdf.text('/100', margin + 25, yPos + 25);
        
        const riskLabel = riskScore > 70 ? 'High Risk' : riskScore > 50 ? 'Moderate' : 'Low Risk';
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(riskLabel, margin + 8, yPos + 32);
        
        // Diversification Score Card
        const divScore = pdfAnalysis.diversificationScore || 0;
        pdf.setFillColor(divScore >= 70 ? 240 : divScore >= 50 ? 254 : 254, 
                        divScore >= 70 ? 253 : divScore >= 50 ? 249 : 242, 
                        divScore >= 70 ? 244 : divScore >= 50 ? 235 : 242);
        pdf.roundedRect(margin + halfWidth + 10, yPos, halfWidth, 35, 2, 2, 'F');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Diversification Score', margin + halfWidth + 18, yPos + 10);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.setTextColor(divScore >= 70 ? 22 : divScore >= 50 ? 202 : 185, 
                        divScore >= 70 ? 163 : divScore >= 50 ? 138 : 28, 
                        divScore >= 70 ? 74 : divScore >= 50 ? 4 : 28);
        pdf.text(`${divScore}`, margin + halfWidth + 18, yPos + 25);
        pdf.setFontSize(10);
        pdf.text('/100', margin + halfWidth + 35, yPos + 25);
        
        const divLabel = divScore >= 70 ? 'Well Diversified' : divScore >= 50 ? 'Moderate' : 'Needs Work';
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(divLabel, margin + halfWidth + 18, yPos + 32);
        
        yPos += 42;
        
        // Asset Allocation Bar
        if (pdfAnalysis.assetAllocation) {
          checkPageBreak(45);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 30, 30);
          pdf.text('Current Asset Allocation', margin, yPos);
          yPos += 8;
          
          const allocationColors: Record<string, number[]> = {
            equity: [79, 70, 229],
            debt: [34, 197, 94],
            hybrid: [245, 158, 11],
            gold: [234, 179, 8],
            silver: [148, 163, 184],
            others: [107, 114, 128]
          };
          
          const allocEntries = Object.entries(pdfAnalysis.assetAllocation)
            .filter(([_, data]: [string, any]) => data.percentage > 0)
            .sort((a: any, b: any) => b[1].percentage - a[1].percentage);
          
          const barWidth = pageWidth - (margin * 2);
          const barHeight = 12;
          let xOffset = margin;
          
          allocEntries.forEach(([key, data]: [string, any]) => {
            const segmentWidth = (data.percentage / 100) * barWidth;
            const color = allocationColors[key] || [107, 114, 128];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.rect(xOffset, yPos, segmentWidth, barHeight, 'F');
            xOffset += segmentWidth;
          });
          
          yPos += barHeight + 6;
          
          // Legend
          let legendX = margin;
          allocEntries.forEach(([key, data]: [string, any]) => {
            const color = allocationColors[key] || [107, 114, 128];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.rect(legendX, yPos, 8, 8, 'F');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            const label = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${data.percentage.toFixed(1)}%`;
            pdf.text(label, legendX + 10, yPos + 6);
            legendX += 45;
            if (legendX > pageWidth - 60) {
              legendX = margin;
              yPos += 10;
            }
          });
          
          yPos += 15;
        }
        
        // Key Insights
        if (pdfAnalysis.recommendations?.length > 0) {
          checkPageBreak(30);
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 30, 30);
          pdf.text('Key Insights', margin, yPos);
          yPos += 8;
          
          pdfAnalysis.recommendations.slice(0, 4).forEach((insight) => {
            checkPageBreak(15);
            const iconColor = insight.type === 'warning' ? [234, 88, 12] : insight.type === 'opportunity' ? [22, 163, 74] : [59, 130, 246];
            pdf.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
            pdf.circle(margin + 3, yPos + 2, 2, 'F');
            
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            const insightLines = pdf.splitTextToSize(insight.message, pageWidth - (margin * 2) - 12);
            pdf.text(insightLines.slice(0, 2), margin + 10, yPos + 3);
            yPos += Math.min(insightLines.length, 2) * 4 + 4;
          });
          
          yPos += 8;
        }
      }
      
      // Recommendations
      const recommendations = proposal.recommendations || [];
      const rebalancingRecs = recommendations.filter((r: any) => r.action === 'SELL' || r.action === 'BUY' || r.action === 'SWITCH' || r.action === 'HOLD');
      const freshInvestmentRecs = recommendations.filter((r: any) => r.suggestedAmount !== undefined && !r.action);
      
      // Rebalancing Section
      if (rebalancingRecs.length > 0) {
        checkPageBreak(25);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Rebalancing Recommendations', margin, yPos);
        yPos += 10;
        
        rebalancingRecs.forEach((rec: any) => {
          const hasTargetFund = rec.action === 'SWITCH' && rec.targetFund;
          const hasRationale = rec.rationale?.length > 0;
          const rationaleLines = hasRationale ? pdf.splitTextToSize(sanitizeText(rec.rationale), pageWidth - (margin * 2) - 12) : [];
          const showLines = Math.min(rationaleLines.length, 4);
          const boxHeight = hasTargetFund ? 48 : (22 + (showLines * 4));
          
          checkPageBreak(boxHeight + 5);
          
          pdf.setFillColor(250, 250, 252);
          pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), boxHeight, 2, 2, 'F');
          
          const actionColor = rec.action === 'SELL' ? [220, 38, 38] : rec.action === 'BUY' ? [22, 163, 74] : [234, 88, 12];
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.rect(margin, yPos, 4, boxHeight, 'F');
          
          // Action badge
          pdf.setFillColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.roundedRect(margin + 8, yPos + 4, 28, 10, 2, 2, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.text(rec.action, margin + 12, yPos + 11);
          
          // Product name
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          const productName = rec.productName?.length > 45 ? rec.productName.substring(0, 45) + '...' : rec.productName;
          pdf.text(productName || '', margin + 40, yPos + 11);
          
          // Current value
          if (rec.currentValue) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Current: ${formatRs(rec.currentValue)}`, pageWidth - margin - 45, yPos + 11);
          }
          
          // Amount change
          pdf.setTextColor(actionColor[0], actionColor[1], actionColor[2]);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          if (rec.action === 'SWITCH' && rec.switchAmount) {
            pdf.text(`Switch: ${formatRs(rec.switchAmount)}`, margin + 8, yPos + 20);
          } else if (rec.changeAmount !== undefined) {
            const sign = rec.changeAmount < 0 ? '-' : '+';
            pdf.text(`${sign} ${formatRs(Math.abs(rec.changeAmount))}`, margin + 8, yPos + 20);
          }
          
          // Target fund for SWITCH
          if (hasTargetFund) {
            pdf.setTextColor(22, 163, 74);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            const targetName = rec.targetFund.name?.length > 50 ? rec.targetFund.name.substring(0, 50) + '...' : rec.targetFund.name;
            pdf.text(`-> ${targetName}`, margin + 8, yPos + 30);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`${rec.targetFund.returns3Y}% 3Y returns | ${rec.targetFund.risk} risk`, margin + 8, yPos + 38);
          } else if (hasRationale) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(rationaleLines.slice(0, showLines), margin + 8, yPos + 28);
          }
          
          yPos += boxHeight + 4;
        });
      }
      
      // Fresh Investments Section
      if (freshInvestmentRecs.length > 0) {
        yPos += 6;
        checkPageBreak(25);
        
        pdf.setTextColor(30, 30, 30);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Fresh Investment Suggestions', margin, yPos);
        yPos += 10;
        
        freshInvestmentRecs.forEach((inv: any) => {
          const hasRationale = inv.rationale?.length > 0;
          const rationaleLines = hasRationale ? pdf.splitTextToSize(sanitizeText(inv.rationale), pageWidth - (margin * 2) - 12) : [];
          const showLines = Math.min(rationaleLines.length, 4);
          const boxHeight = 24 + (showLines * 4);
          
          checkPageBreak(boxHeight + 5);
          
          pdf.setFillColor(250, 250, 252);
          pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), boxHeight, 2, 2, 'F');
          
          pdf.setFillColor(79, 70, 229);
          pdf.rect(margin, yPos, 4, boxHeight, 'F');
          
          // Product name
          pdf.setTextColor(30, 30, 30);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          const productName = inv.productName?.length > 50 ? inv.productName.substring(0, 50) + '...' : inv.productName;
          pdf.text(productName || '', margin + 8, yPos + 10);
          
          // Amount
          pdf.setTextColor(22, 163, 74);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text(formatRs(inv.suggestedAmount), pageWidth - margin - 35, yPos + 10);
          
          // Metrics row
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          const riskLevel = inv.riskLevel?.toLowerCase().includes('high') ? 'High' : inv.riskLevel?.toLowerCase().includes('low') ? 'Low' : 'Moderate';
          pdf.text(`Expected: ${inv.expectedReturn} | Risk: ${riskLevel} | Match: ${inv.matchScore}%`, margin + 8, yPos + 18);
          
          // Rationale
          if (hasRationale) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(80, 80, 80);
            pdf.text(rationaleLines.slice(0, showLines), margin + 8, yPos + 26);
          }
          
          yPos += boxHeight + 4;
        });
      }
      
      // Agent Contact Footer
      if (proposal.agentName || proposal.agentMobile || proposal.agentEmail) {
        checkPageBreak(35);
        yPos += 10;
        
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), 28, 3, 3, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margin, yPos, pageWidth - (margin * 2), 28, 3, 3, 'S');
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Your Financial Advisor', margin + 8, yPos + 10);
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);
        const contactInfo = [
          proposal.agentName,
          proposal.agentMobile ? `Tel: ${proposal.agentMobile}` : null,
          proposal.agentEmail ? `Email: ${proposal.agentEmail}` : null
        ].filter(Boolean).join(' | ');
        pdf.text(contactInfo, margin + 8, yPos + 20);
      }
      
      // Footer on all pages
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(150, 150, 150);
        pdf.text('This proposal is for informational purposes only. Investment in securities market are subject to market risks.', margin, pageHeight - 10);
        
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        pdf.text(`Generated: ${dateStr} | Page ${i} of ${pageCount}`, pageWidth - margin - 45, pageHeight - 10);
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
    const proposalError = error as ProposalError;
    const isExpired = proposalError?.errorType === 'expired';
    const isNotFound = proposalError?.errorType === 'not_found';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <div className={`w-16 h-16 ${isExpired ? 'bg-amber-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {isExpired ? (
                <Clock className="w-8 h-8 text-amber-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h2 className="text-xl font-bold mb-2">
              {isExpired ? 'Proposal Expired' : isNotFound ? 'Proposal Not Found' : 'Unable to Load Proposal'}
            </h2>
            <p className="text-muted-foreground dark:text-muted-foreground mb-4">
              {isExpired 
                ? "This investment proposal has expired. Please contact your financial advisor for an updated proposal."
                : isNotFound 
                  ? "We couldn't find this proposal. The link may be incorrect or the proposal may have been removed."
                  : proposalError?.message || "Something went wrong. Please try again later."
              }
            </p>
            {(isExpired || isNotFound) && (
              <p className="text-sm text-muted-foreground">
                Need help? Contact support at <a href="mailto:support@fintekpro.com" className="text-indigo-600 hover:underline">support@fintekpro.com</a>
              </p>
            )}
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

            {/* Portfolio Comparison Section - Current vs Proposed */}
            {analysis.portfolioComparison && (
              <Card className="mb-8" data-testid="card-portfolio-comparison">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Portfolio Comparison: Current vs Proposed
                  </CardTitle>
                  <CardDescription>
                    See how our recommended portfolio compares to your current holdings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border">
                      <h4 className="font-medium text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Current Portfolio
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Expected Return</p>
                          <p className="text-lg font-bold">{analysis.portfolioComparison.currentPortfolio.expectedReturn.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Risk Score</p>
                          <p className="text-lg font-bold">{analysis.portfolioComparison.currentPortfolio.riskScore.toFixed(0)}/100</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <h4 className="font-medium text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Proposed Portfolio
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-green-600 dark:text-green-400">Expected Return</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">{analysis.portfolioComparison.proposedPortfolio.expectedReturn.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-green-600 dark:text-green-400">Risk Score</p>
                          <p className="text-lg font-bold text-green-700 dark:text-green-300">{analysis.portfolioComparison.proposedPortfolio.riskScore.toFixed(0)}/100</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Metrics Comparison Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          <TableHead className="text-center">Current</TableHead>
                          <TableHead className="text-center">Proposed</TableHead>
                          <TableHead className="text-center">Change</TableHead>
                          <TableHead className="hidden md:table-cell">What This Means</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.portfolioComparison.improvements.map((item, idx) => (
                          <TableRow key={idx} data-testid={`row-comparison-${idx}`}>
                            <TableCell className="font-medium">{item.metric}</TableCell>
                            <TableCell className="text-center">
                              {item.current !== null ? item.current.toFixed(2) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {item.proposed !== null ? item.proposed.toFixed(2) : 'N/A'}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.change !== null ? (
                                <span className={`flex items-center justify-center gap-1 font-medium ${
                                  item.isImprovement ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {item.isImprovement ? (
                                    <TrendingUp className="w-4 h-4" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4" />
                                  )}
                                  {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {item.interpretation}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Asset Allocation Comparison */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-medium mb-4">Asset Allocation Shift</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Current Allocation</p>
                        <div className="space-y-2">
                          {Object.entries(analysis.portfolioComparison.currentPortfolio.assetAllocation)
                            .filter(([_, val]) => val > 0)
                            .map(([asset, val]) => (
                              <div key={asset} className="flex items-center gap-2">
                                <span className="w-16 text-xs capitalize">{asset}</span>
                                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                  <div 
                                    className="bg-gray-500 h-2 rounded-full" 
                                    style={{ width: `${Math.min(val, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs w-12 text-right">{val.toFixed(0)}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-green-600 dark:text-green-400 mb-2">Proposed Allocation</p>
                        <div className="space-y-2">
                          {Object.entries(analysis.portfolioComparison.proposedPortfolio.assetAllocation)
                            .filter(([_, val]) => val > 0)
                            .map(([asset, val]) => (
                              <div key={asset} className="flex items-center gap-2">
                                <span className="w-16 text-xs capitalize">{asset}</span>
                                <div className="flex-1 bg-green-100 dark:bg-green-900 rounded-full h-2">
                                  <div 
                                    className="bg-green-500 h-2 rounded-full" 
                                    style={{ width: `${Math.min(val, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs w-12 text-right text-green-600">{val.toFixed(0)}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Legend */}
                  <div className="mt-6 pt-6 border-t">
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" />
                        Understanding the Metrics
                        <span className="text-xs text-muted-foreground">(click to expand)</span>
                      </summary>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Alpha (Jensen's Alpha)</p>
                          <p className="text-muted-foreground">Measures excess returns compared to benchmark. Positive alpha means outperformance.</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Beta</p>
                          <p className="text-muted-foreground">Measures market sensitivity. Beta of 1 means same volatility as market, less than 1 is more stable.</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Sharpe Ratio</p>
                          <p className="text-muted-foreground">Risk-adjusted returns. Higher is better - measures return earned per unit of total risk.</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Treynor Ratio</p>
                          <p className="text-muted-foreground">Returns per unit of market risk (beta). Useful for comparing diversified portfolios.</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Sortino Ratio</p>
                          <p className="text-muted-foreground">Like Sharpe but only considers downside risk. Better for asymmetric return distributions.</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="font-medium">Max Drawdown</p>
                          <p className="text-muted-foreground">Maximum potential loss from peak to trough. Lower is better for capital preservation.</p>
                        </div>
                      </div>
                    </details>
                  </div>
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
