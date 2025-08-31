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
  CheckCircle
} from "lucide-react";
import { GoalPlanning } from "@/components/wealth/goal-planning";
import { ObligationMapping } from "@/components/wealth/obligation-mapping";
import { RetirementPlanning } from "@/components/wealth/retirement-planning";
import { RiskAssessment } from "@/components/wealth/risk-assessment";
import { LoanDashboard } from "@/components/loan/loan-dashboard";

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
            <TabsTrigger value="goals" data-testid="tab-goals">
              <Target className="w-4 h-4 mr-2" />
              Goal Planning
            </TabsTrigger>
            <TabsTrigger value="obligations" data-testid="tab-obligations">
              <CreditCard className="w-4 h-4 mr-2" />
              Obligations
            </TabsTrigger>
            <TabsTrigger value="retirement" data-testid="tab-retirement">
              <Shield className="w-4 h-4 mr-2" />
              Retirement
            </TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">
              <PieChart className="w-4 h-4 mr-2" />
              Risk Profile
            </TabsTrigger>
            <TabsTrigger value="loans" data-testid="tab-loans">
              <Building2 className="w-4 h-4 mr-2" />
              Loans
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

            {/* Quick Actions */}
            <Card data-testid="card-quick-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common wealth management tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("goals")}
                    data-testid="button-plan-goals"
                  >
                    <Target className="w-6 h-6" />
                    <span className="text-sm">Plan Goals</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("obligations")}
                    data-testid="button-track-obligations"
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm">Track Obligations</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("retirement")}
                    data-testid="button-retirement-plan"
                  >
                    <Shield className="w-6 h-6" />
                    <span className="text-sm">Retirement Plan</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("risk")}
                    data-testid="button-assess-risk"
                  >
                    <PieChart className="w-6 h-6" />
                    <span className="text-sm">Assess Risk</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Financial Health Score */}
            <Card data-testid="card-financial-health">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Financial Health Score
                </CardTitle>
                <CardDescription>Overall assessment of your financial well-being</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600 mb-2">78/100</div>
                    <Badge variant="default" className="text-sm">Good Financial Health</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Strengths</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Diversified investment portfolio</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Regular SIP investments</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Good savings rate (20%+)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Areas for Improvement</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                          <Target className="w-4 h-4 text-orange-600" />
                          <span className="text-sm">Increase emergency fund to 8 months</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                          <Shield className="w-4 h-4 text-orange-600" />
                          <span className="text-sm">Add term insurance coverage</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                          <Calculator className="w-4 h-4 text-orange-600" />
                          <span className="text-sm">Start retirement planning</span>
                        </div>
                      </div>
                    </div>
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

            {/* Wealth Building Recommendations */}
            <Card data-testid="card-wealth-recommendations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Personalized Wealth Building Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Immediate Actions</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <Calculator className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium">Complete Risk Assessment</p>
                          <p className="text-sm text-muted-foreground">Get personalized investment recommendations</p>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab("risk")} data-testid="button-start-risk-assessment">
                          Start
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                        <Target className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium">Set Financial Goals</p>
                          <p className="text-sm text-muted-foreground">Define clear objectives with timelines</p>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab("goals")} data-testid="button-set-goals">
                          Plan
                        </Button>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                        <Shield className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="font-medium">Plan Retirement</p>
                          <p className="text-sm text-muted-foreground">Ensure comfortable retirement lifestyle</p>
                        </div>
                        <Button size="sm" onClick={() => setActiveTab("retirement")} data-testid="button-plan-retirement">
                          Calculate
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Portfolio Optimization</h4>
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Asset Allocation</span>
                          <Badge variant="outline">Recommended</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Equity</span>
                            <span className="font-medium">60%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Debt</span>
                            <span className="font-medium">35%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Gold</span>
                            <span className="font-medium">5%</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">Rebalancing Needed</p>
                            <p className="text-sm text-yellow-700">Your equity allocation is 75%. Consider moving some to debt funds.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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

          {/* Loans Tab */}
          <TabsContent value="loans">
            <LoanDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}