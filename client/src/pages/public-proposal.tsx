import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  TrendingUp, 
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
  ExternalLink
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your personalized proposal...</p>
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
            <p className="text-gray-600 dark:text-gray-400">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">FintekPro</span>
          </div>
          <Button 
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
            onClick={handleGetStarted}
            data-testid="btn-get-started-header"
          >
            Get Started <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
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
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
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
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Goal</p>
                  <p className="font-medium">{GOAL_TYPE_LABELS[proposal.investmentGoals.goalType] || proposal.investmentGoals.goalType}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Time Horizon</p>
                  <p className="font-medium capitalize">{proposal.investmentGoals.timeHorizon?.replace('_', ' ')}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">Risk Tolerance</p>
                  <p className="font-medium capitalize">{proposal.investmentGoals.riskTolerance}</p>
                </div>
                {proposal.investmentGoals.targetAmount && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Target Amount</p>
                    <p className="font-medium">₹{parseFloat(proposal.investmentGoals.targetAmount).toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Analysis */}
        {proposal.currentAnalysis && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">{proposal.currentAnalysis}</p>
            </CardContent>
          </Card>
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
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{asset}</p>
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
                            <Badge className={RISK_COLORS[rec.riskRating] || "bg-gray-100 text-gray-700"} variant="outline">
                              {rec.riskRating}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          {rec.amc && `${rec.amc} • `}{rec.category}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{rec.selectionReason}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Investment</p>
                          <p className="font-bold text-lg">₹{rec.recommendedAmount?.toLocaleString('en-IN')}</p>
                          <p className="text-xs text-gray-500">{rec.allocationPercentage}% allocation</p>
                        </div>
                        {rec.investmentType === 'sip' && rec.sipAmount && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Monthly SIP</p>
                            <p className="font-bold text-lg text-green-600">₹{rec.sipAmount?.toLocaleString('en-IN')}</p>
                          </div>
                        )}
                        {(rec.returns1Y || rec.returns3Y || rec.returns5Y) && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Returns</p>
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
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Fully compliant with regulatory guidelines</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h4 className="font-semibold mb-1">Secure Platform</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Bank-grade security for your investments</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="font-semibold mb-1">Expert Guidance</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">Personalized advice from certified professionals</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">This proposal is generated for informational purposes only and does not constitute investment advice.</p>
          <p>Past performance is not indicative of future results. Please read all scheme-related documents carefully before investing.</p>
          <p className="mt-4">© {new Date().getFullYear()} FintekPro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
