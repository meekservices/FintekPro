import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Target, 
  TrendingUp, 
  Shield,
  Calculator,
  PieChart,
  CreditCard,
  BarChart3,
  Users,
  Building2,
  Home,
  GraduationCap,
  Heart,
  Calendar,
  IndianRupee,
  Briefcase,
  Zap,
  CheckCircle,
  Lightbulb,
  Clock,
  FileText,
  Star
} from "lucide-react";
import { GoalPlanning } from "@/components/wealth/goal-planning";
import { ObligationMapping } from "@/components/wealth/obligation-mapping";
import { RetirementPlanning } from "@/components/wealth/retirement-planning";
import { RiskAssessment } from "@/components/wealth/risk-assessment";
import { InvestmentRecommendations } from "@/components/wealth/investment-recommendations";
import { Proposals } from "@/components/wealth/proposals";
import { PortfolioConfetti } from "@/components/portfolio/PortfolioConfetti";
import { ConfettiTestPanel } from "@/components/confetti/ConfettiTestPanel";

export default function InvestSmart() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [confettiEnabled, setConfettiEnabled] = useState(true);

  // Investment capacity analysis based on CIBIL obligations
  const financialAnalysis = {
    monthlyIncome: 180000,
    monthlyObligations: 63000, // From CIBIL report
    availableForInvestment: 117000, // Income - Obligations
    currentInvestments: 45000,
    additionalCapacity: 72000, // Available - Current
    obligationRatio: 35, // Obligations as % of income
    creditScore: 785,
    totalPortfolioValue: 2850000,
    totalReturns: 650000,
    returnPercentage: 29.5
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">FintekPro InvestSmart</h1>
          <p className="text-xl text-muted-foreground">Transform your ₹72,000 monthly surplus into ₹4.2 crores - Your CIBIL profile is perfect for wealth building</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              <PieChart className="w-4 h-4 mr-2" />
              Risk Profile
            </TabsTrigger>
            <TabsTrigger value="obligations" data-testid="tab-obligations">
              <CreditCard className="w-4 h-4 mr-2" />
              Credit Obligations
            </TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">
              <Target className="w-4 h-4 mr-2" />
              Goal Planning
            </TabsTrigger>
            <TabsTrigger value="retirement" data-testid="tab-retirement">
              <Shield className="w-4 h-4 mr-2" />
              Retirement
            </TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">
              <Lightbulb className="w-4 h-4 mr-2" />
              Expert Insights
            </TabsTrigger>
            <TabsTrigger value="confetti-test" data-testid="tab-confetti-test">
              <Star className="w-4 h-4 mr-2" />
              Confetti
            </TabsTrigger>
          </TabsList>

          {/* Investment Opportunity Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            
            {/* Investment Capacity Analysis */}
            <Card data-testid="card-investment-capacity" className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  🚀 Your Investment Opportunity
                </CardTitle>
                <CardDescription className="text-green-700">
                  Based on CIBIL analysis, you have significant untapped investment potential
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-white rounded-lg border border-green-200">
                    <div className="text-3xl font-bold text-green-600 mb-2">{formatCurrency(financialAnalysis.additionalCapacity)}</div>
                    <p className="text-sm font-medium text-green-800">Available for New Investments</p>
                    <p className="text-xs text-green-600 mt-1">Monthly surplus after obligations</p>
                  </div>
                  
                  <div className="text-center p-4 bg-white rounded-lg border border-blue-200">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{financialAnalysis.obligationRatio}%</div>
                    <p className="text-sm font-medium text-blue-800">Obligation Ratio</p>
                    <p className="text-xs text-blue-600 mt-1">Healthy debt-to-income ratio</p>
                  </div>
                  
                  <div className="text-center p-4 bg-white rounded-lg border border-purple-200">
                    <div className="text-3xl font-bold text-purple-600 mb-2">{financialAnalysis.creditScore}</div>
                    <p className="text-sm font-medium text-purple-800">Credit Score</p>
                    <p className="text-xs text-purple-600 mt-1">Excellent for investment loans</p>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    onClick={() => setActiveTab("recommendations")}
                    data-testid="button-start-investing"
                  >
                    <IndianRupee className="w-5 h-5 mr-2" />
                    Start Investing Your Surplus ₹72,000/month
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Current Portfolio Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="card-total-portfolio-value">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Portfolio</p>
                      <p className="text-2xl font-bold">{formatCurrency(financialAnalysis.totalPortfolioValue)}</p>
                      <p className="text-xs text-green-600">+{financialAnalysis.returnPercentage}% returns</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-income" className="border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Income</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialAnalysis.monthlyIncome)}</p>
                      <p className="text-xs text-blue-600">Verified income</p>
                    </div>
                    <Briefcase className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-obligations" className="border-red-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Obligations</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(financialAnalysis.monthlyObligations)}</p>
                      <p className="text-xs text-red-600">From CIBIL report</p>
                    </div>
                    <CreditCard className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-investment-surplus" className="border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Investment Surplus</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(financialAnalysis.availableForInvestment)}</p>
                      <p className="text-xs text-green-600">Available monthly</p>
                    </div>
                    <IndianRupee className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Credit & Obligations Overview */}
            <Card data-testid="card-credit-obligations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Credit Obligations Overview
                </CardTitle>
                <CardDescription>Real-time CIBIL data integration for comprehensive obligation tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-900">Credit Cards</p>
                        <p className="text-sm text-blue-700">Active accounts & utilization</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-credit-cards"
                      className="w-full border-blue-300 text-blue-700 hover:bg-blue-100"
                    >
                      View Details
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Loans & EMIs</p>
                        <p className="text-sm text-green-700">Active loans from CIBIL</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-loans"
                      className="w-full border-green-300 text-green-700 hover:bg-green-100"
                    >
                      Sync CIBIL Data
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="w-6 h-6 text-purple-600" />
                      <div>
                        <p className="font-semibold text-purple-900">Credit Health</p>
                        <p className="text-sm text-purple-700">Score & payment history</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-credit-health"
                      className="w-full border-purple-300 text-purple-700 hover:bg-purple-100"
                    >
                      Check Score
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* InvestSmart Actions */}
            <Card data-testid="card-wealth-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Smart Wealth Actions
                </CardTitle>
                <CardDescription>AI-powered recommendations based on your CIBIL obligations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="default" 
                    className="h-20 flex flex-col gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    onClick={() => setActiveTab("recommendations")}
                    data-testid="button-smart-recommendations"
                  >
                    <Lightbulb className="w-6 h-6" />
                    <span className="text-sm">Smart Recommendations</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("goals")}
                    data-testid="button-plan-goals"
                  >
                    <Target className="w-6 h-6" />
                    <span className="text-sm">Financial Goals</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("risk")}
                    data-testid="button-assess-risk"
                  >
                    <PieChart className="w-6 h-6" />
                    <span className="text-sm">Risk Assessment</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CIBIL-Based Financial Health */}
            <Card data-testid="card-cibil-financial-health">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  CIBIL-Based Financial Health
                </CardTitle>
                <CardDescription>Real-time credit health analysis from your CIBIL report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">785</div>
                    <Badge variant="default" className="text-sm bg-blue-600">Very Good Credit Score</Badge>
                    <p className="text-sm text-gray-600 mt-2">Based on latest CIBIL report</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Credit Strengths</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Excellent payment history (100%)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Low credit utilization (28%)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Diverse credit mix</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Obligation Insights</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">₹2.4L total monthly obligations</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">5 active credit accounts</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Obligation ratio: 35% of income</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <Button 
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-full-obligations"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      View Complete Obligation Analysis
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Opportunities to Accelerate Goals */}
            <Card data-testid="card-investment-opportunities">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  🏆 Accelerate Your Goals with Smart Investments
                </CardTitle>
                <CardDescription>
                  With ₹72,000 monthly surplus, you can significantly boost your goal achievement timeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-600 text-white rounded-lg">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-blue-900">Home Purchase Goal</p>
                        <p className="text-sm text-blue-700">₹50L target by 2028</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm text-gray-600">Current Progress: 17%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '17%' }}></div>
                        </div>
                      </div>
                      <div className="bg-green-100 p-3 rounded border border-green-200">
                        <p className="text-sm font-medium text-green-800">With additional ₹30K SIP:</p>
                        <p className="text-lg font-bold text-green-900">Achieve goal 2 years earlier!</p>
                        <p className="text-xs text-green-600">Projected completion: 2026</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-600 text-white rounded-lg">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-green-900">Child Education</p>
                        <p className="text-sm text-green-700">₹25L target by 2035</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm text-gray-600">Current Progress: 13%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '13%' }}></div>
                        </div>
                      </div>
                      <div className="bg-blue-100 p-3 rounded border border-blue-200">
                        <p className="text-sm font-medium text-blue-800">With additional ₹20K SIP:</p>
                        <p className="text-lg font-bold text-blue-900">Ensure full coverage!</p>
                        <p className="text-xs text-blue-600">Zero education loan needed</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-purple-900">Retirement Fund</p>
                        <p className="text-sm text-purple-700">₹1.2Cr target by 2055</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm text-gray-600">Current Progress: 4%</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '4%' }}></div>
                        </div>
                      </div>
                      <div className="bg-orange-100 p-3 rounded border border-orange-200">
                        <p className="text-sm font-medium text-orange-800">With additional ₹22K SIP:</p>
                        <p className="text-lg font-bold text-orange-900">Retire comfortably!</p>
                        <p className="text-xs text-orange-600">Maintain current lifestyle</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-6 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg text-white">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl font-bold">💰 Start Your Wealth Acceleration Today!</h3>
                    <p className="text-emerald-100">Your excellent credit profile and surplus income make this the perfect time to invest</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("goals")}
                        data-testid="button-set-investment-goals"
                        className="bg-white text-green-700 hover:bg-gray-100"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Set Investment Goals
                      </Button>
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("recommendations")}
                        data-testid="button-get-recommendations"
                        className="bg-white text-green-700 hover:bg-gray-100"
                      >
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Get AI Recommendations
                      </Button>
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("risk")}
                        data-testid="button-assess-risk-profile"
                        className="bg-white text-green-700 hover:bg-gray-100"
                      >
                        <PieChart className="w-4 h-4 mr-2" />
                        Assess Risk Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High-Impact Investment Opportunities */}
            <Card data-testid="card-high-impact-investments">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  🚀 High-Impact Investment Opportunities
                </CardTitle>
                <CardDescription>
                  Maximize your ₹72,000 monthly surplus with these proven wealth-building strategies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-emerald-800">🎯 Recommended Investment Mix</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">Large Cap Equity Funds</span>
                          <span className="font-bold">₹25,000/month</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm opacity-90">Expected Return: 12-15% annually</p>
                          <p className="text-sm opacity-90">Risk: Moderate | Perfect for your credit profile</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">Mid Cap Growth Funds</span>
                          <span className="font-bold">₹20,000/month</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm opacity-90">Expected Return: 15-18% annually</p>
                          <p className="text-sm opacity-90">Risk: Higher | Ideal for long-term goals</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">Hybrid Debt Funds</span>
                          <span className="font-bold">₹15,000/month</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm opacity-90">Expected Return: 8-10% annually</p>
                          <p className="text-sm opacity-90">Risk: Low | Stable wealth building</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold">Gold/REIT Funds</span>
                          <span className="font-bold">₹12,000/month</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm opacity-90">Expected Return: 10-12% annually</p>
                          <p className="text-sm opacity-90">Risk: Moderate | Inflation hedge</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-emerald-800">💰 Projected Wealth Growth</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-100 rounded-lg border border-emerald-200">
                        <div className="text-center mb-3">
                          <div className="text-3xl font-bold text-emerald-700">₹4.2 Crores</div>
                          <p className="text-sm text-emerald-600 font-medium">Projected wealth in 10 years</p>
                          <p className="text-xs text-emerald-500">vs ₹1.8 Cr with current investments only</p>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Total Investment</span>
                            <span className="font-medium">₹1.38 Cr</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Returns</span>
                            <span className="font-bold text-emerald-700">₹2.82 Cr</span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-bold">
                            <span className="text-emerald-800">Extra Wealth Created</span>
                            <span className="text-emerald-700">₹2.4 Cr</span>
                          </div>
                        </div>
                        <div className="mt-3 p-2 bg-yellow-100 rounded text-center">
                          <p className="text-xs font-bold text-yellow-800">🔥 204% additional wealth with smart investing!</p>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                        <h5 className="font-bold text-blue-800 mb-2">Why Start Now?</h5>
                        <div className="space-y-2 text-sm text-blue-700">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span>Credit score of 785 = Best fund options</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span>Low obligation ratio = High investment capacity</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span>Market timing = Favorable for SIP entry</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span>Tax benefits = Section 80C, ELSS savings</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    onClick={() => setActiveTab("recommendations")}
                    data-testid="button-get-personalized-plan"
                  >
                    <Lightbulb className="w-5 h-5 mr-2" />
                    Get My Personalized Investment Plan
                  </Button>
                  
                  <Button 
                    size="lg"
                    variant="outline"
                    className="border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => setActiveTab("goals")}
                    data-testid="button-start-goal-planning"
                  >
                    <Target className="w-5 h-5 mr-2" />
                    Start Goal-Based Investing
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Urgent Investment Call-to-Action */}
            <Card data-testid="card-investment-urgency" className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Clock className="w-6 h-6 text-red-600" />
                    <h3 className="text-2xl font-bold text-red-800">⚡ Time is Money!</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-red-200">
                      <h4 className="font-bold text-red-800 mb-2">Delaying 1 Year</h4>
                      <div className="text-2xl font-bold text-red-600">-₹18 Lakhs</div>
                      <p className="text-sm text-red-600">Lost compound growth</p>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border border-orange-200">
                      <h4 className="font-bold text-orange-800 mb-2">Delaying 3 Years</h4>
                      <div className="text-2xl font-bold text-orange-600">-₹65 Lakhs</div>
                      <p className="text-sm text-orange-600">Massive opportunity loss</p>
                    </div>
                    
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <h4 className="font-bold text-green-800 mb-2">Starting Today</h4>
                      <div className="text-2xl font-bold text-green-600">+₹2.4 Cr</div>
                      <p className="text-sm text-green-600">Extra wealth in 10 years</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg">
                    <p className="text-lg font-bold mb-2">🎯 Your CIBIL Profile is Perfect for Wealth Building!</p>
                    <p className="text-emerald-100 mb-4">
                      With 785 credit score and only 35% obligation ratio, you're in the top 5% of investors. 
                      Start your ₹72,000 monthly SIP today and secure your financial future.
                    </p>
                    <Button 
                      size="lg"
                      variant="secondary"
                      className="bg-white text-green-700 hover:bg-gray-100 font-bold"
                      onClick={() => setActiveTab("recommendations")}
                      data-testid="button-start-investing-now"
                    >
                      🚀 Start My Investment Journey Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Recommendations Preview */}
            <InvestmentRecommendations portfolioId="demo-portfolio-1" />
          </TabsContent>

          {/* Investment Recommendations Tab */}
          <TabsContent value="recommendations">
            <InvestmentRecommendations portfolioId="demo-portfolio-1" />
          </TabsContent>

          {/* Goal Planning Tab */}
          <TabsContent value="goals">
            <GoalPlanning />
          </TabsContent>

          {/* Obligation Mapping Tab */}
          <TabsContent value="obligations">
            <ObligationMapping />
          </TabsContent>

          {/* Retirement Planning Tab */}
          <TabsContent value="retirement">
            <RetirementPlanning />
          </TabsContent>

          {/* Risk Assessment Tab */}
          <TabsContent value="risk">
            <RiskAssessment />
          </TabsContent>

          <TabsContent value="confetti-test">
            <ConfettiTestPanel 
              confettiEnabled={confettiEnabled}
              onToggleConfetti={setConfettiEnabled}
            />
          </TabsContent>

        </Tabs>
        
        {/* Real-time Portfolio Performance Confetti */}
        <PortfolioConfetti 
          portfolioId="demo-portfolio-1" 
          enabled={confettiEnabled} 
        />
      </div>
    </div>
  );
}