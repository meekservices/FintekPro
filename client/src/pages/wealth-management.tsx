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
  DollarSign,
  Briefcase,
  Zap,
  CheckCircle,
  Lightbulb
} from "lucide-react";
import { GoalPlanning } from "@/components/wealth/goal-planning";
import { ObligationMapping } from "@/components/wealth/obligation-mapping";
import { RetirementPlanning } from "@/components/wealth/retirement-planning";
import { RiskAssessment } from "@/components/wealth/risk-assessment";
import { InvestmentRecommendations } from "@/components/wealth/investment-recommendations";

export default function WealthManagement() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Sample portfolio data
  const portfolioSummary = {
    totalValue: 2850000,
    totalInvestment: 2200000,
    totalReturns: 650000,
    returnPercentage: 29.5,
    monthlyInvestment: 45000,
    goalProgress: 68
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
          <h1 className="text-4xl font-bold text-gray-900">FintekPro Wealth Management</h1>
          <p className="text-xl text-muted-foreground">Comprehensive financial planning for your future</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="obligations" data-testid="tab-obligations">
              <CreditCard className="w-4 h-4 mr-2" />
              Credit Obligations
            </TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">
              <Lightbulb className="w-4 h-4 mr-2" />
              Smart Recommendations
            </TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">
              <Target className="w-4 h-4 mr-2" />
              Goal Planning
            </TabsTrigger>
            <TabsTrigger value="retirement" data-testid="tab-retirement">
              <Shield className="w-4 h-4 mr-2" />
              Retirement
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              <PieChart className="w-4 h-4 mr-2" />
              Risk Profile
            </TabsTrigger>
          </TabsList>

          {/* Wealth Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Portfolio Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="card-total-portfolio-value">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Portfolio Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(portfolioSummary.totalValue)}</p>
                      <p className="text-xs text-green-600">+{portfolioSummary.returnPercentage}% overall</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-total-investment">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Investment</p>
                      <p className="text-2xl font-bold">{formatCurrency(portfolioSummary.totalInvestment)}</p>
                      <p className="text-xs text-blue-600">Principal amount</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-total-returns">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Returns</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(portfolioSummary.totalReturns)}</p>
                      <p className="text-xs text-green-600">Profit earned</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-investment">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly SIP</p>
                      <p className="text-2xl font-bold">{formatCurrency(portfolioSummary.monthlyInvestment)}</p>
                      <p className="text-xs text-purple-600">Active investments</p>
                    </div>
                    <Calendar className="w-8 h-8 text-purple-500" />
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
            
            {/* Wealth Management Actions */}
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

            {/* Goal Progress Overview */}
            <Card data-testid="card-goal-progress-overview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Goal Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">Home Purchase</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(5000000)} by 2028</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>17%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '17%' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">Child Education</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(2500000)} by 2035</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>13%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '13%' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">Retirement Fund</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(12000000)} by 2055</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>4%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '4%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <Button onClick={() => setActiveTab("goals")} data-testid="button-view-all-goals">
                    <Target className="w-4 h-4 mr-2" />
                    View All Goals
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Obligation-Based Wealth Recommendations */}
            <Card data-testid="card-obligation-wealth-recommendations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Obligation-Optimized Wealth Strategy
                </CardTitle>
                <CardDescription>Smart recommendations based on your CIBIL obligations and credit profile</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Debt Optimization Actions</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                        <CreditCard className="w-5 h-5 text-red-600" />
                        <div className="flex-1">
                          <p className="font-medium text-red-800">High Credit Card Utilization</p>
                          <p className="text-sm text-red-700">Reduce utilization from 78% to below 30%</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" data-testid="button-reduce-utilization">
                          Optimize
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <Building2 className="w-5 h-5 text-orange-600" />
                        <div className="flex-1">
                          <p className="font-medium text-orange-800">Loan Consolidation Opportunity</p>
                          <p className="text-sm text-orange-700">Save ₹8,500/month by consolidating 3 loans</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100" data-testid="button-consolidate-loans">
                          Analyze
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800">EMI Restructuring</p>
                          <p className="text-sm text-blue-700">Optimize payment schedules for better cash flow</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" data-testid="button-restructure-emi">
                          Plan
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Investment Strategy Based on Obligations</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg bg-green-50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-green-800">Recommended Allocation</span>
                          <Badge variant="outline" className="border-green-300 text-green-700">Obligation-Adjusted</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Emergency Fund (Priority 1)</span>
                            <span className="font-medium text-green-700">25%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Debt Mutual Funds</span>
                            <span className="font-medium text-green-700">35%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Equity (Conservative)</span>
                            <span className="font-medium text-green-700">35%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Gold/Alternative</span>
                            <span className="font-medium text-green-700">5%</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">Priority: Debt Management</p>
                            <p className="text-sm text-yellow-700">Focus on reducing high-interest obligations before aggressive investing</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-800">Conservative Strategy</p>
                            <p className="text-sm text-blue-700">Given obligation ratio of 35%, prioritize stability over growth</p>
                          </div>
                        </div>
                      </div>
                    </div>
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

        </Tabs>
      </div>
    </div>
  );
}