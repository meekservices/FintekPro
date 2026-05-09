import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { 
  Target, 
  TrendingUp, 
  Calendar,
  IndianRupee,
  PieChart,
  Calculator,
  Shield,
  Clock,
  Briefcase,
  Building,
  CheckCircle
} from "lucide-react";

interface RetirementPlan {
  currentAge: number;
  retirementAge: number;
  currentSalary: number;
  currentSavings: number;
  monthlyExpenses: number;
  inflationRate: number;
  expectedReturn: number;
  salaryGrowth: number;
  retirementCorpus: number;
  monthlyInvestmentNeeded: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

export function RetirementPlanning() {
  const [plan, setPlan] = useState<RetirementPlan>({
    currentAge: 30,
    retirementAge: 60,
    currentSalary: 1200000,
    currentSavings: 500000,
    monthlyExpenses: 60000,
    inflationRate: 6,
    expectedReturn: 12,
    salaryGrowth: 8,
    retirementCorpus: 0,
    monthlyInvestmentNeeded: 0,
    riskProfile: 'moderate'
  });

  const [showCalculation, setShowCalculation] = useState(false);

  // Calculate retirement corpus and monthly investment needed
  useEffect(() => {
    const yearsToRetirement = plan.retirementAge - plan.currentAge;
    const futureMonthlyExpenses = plan.monthlyExpenses * Math.pow(1 + plan.inflationRate / 100, yearsToRetirement);
    const requiredCorpus = futureMonthlyExpenses * 12 * 25; // 25 years post retirement
    
    // Calculate monthly SIP needed
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyRate = plan.expectedReturn / 100 / 12;
    const futureValueOfCurrentSavings = plan.currentSavings * Math.pow(1 + plan.expectedReturn / 100, yearsToRetirement);
    const remainingCorpus = requiredCorpus - futureValueOfCurrentSavings;
    
    const sipAmount = remainingCorpus / (((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate) * (1 + monthlyRate));
    
    setPlan(prev => ({
      ...prev,
      retirementCorpus: requiredCorpus,
      monthlyInvestmentNeeded: Math.max(sipAmount, 0)
    }));
  }, [plan.currentAge, plan.retirementAge, plan.currentSalary, plan.currentSavings, plan.monthlyExpenses, plan.inflationRate, plan.expectedReturn]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getInvestmentRecommendations = () => {
    const yearsToRetirement = plan.retirementAge - plan.currentAge;
    
    if (yearsToRetirement <= 5) {
      return {
        equity: 30,
        debt: 60,
        gold: 10,
        instruments: ["Conservative Hybrid Funds", "Short Duration Funds", "Equity Savings Funds", "Gold ETFs"]
      };
    } else if (yearsToRetirement <= 15) {
      if (plan.riskProfile === 'aggressive') {
        return {
          equity: 70,
          debt: 25,
          gold: 5,
          instruments: ["Large Cap Funds", "Mid Cap Funds", "Flexi Cap Funds", "GILT Funds"]
        };
      } else if (plan.riskProfile === 'moderate') {
        return {
          equity: 60,
          debt: 35,
          gold: 5,
          instruments: ["Large Cap Funds", "Balanced Advantage Funds", "Medium Duration Funds", "Index Funds"]
        };
      } else {
        return {
          equity: 40,
          debt: 55,
          gold: 5,
          instruments: ["Conservative Hybrid Funds", "Large Cap Funds", "Corporate Bond Funds", "Gold ETFs"]
        };
      }
    } else {
      if (plan.riskProfile === 'aggressive') {
        return {
          equity: 80,
          debt: 15,
          gold: 5,
          instruments: ["Flexi Cap Funds", "Small Cap Funds", "ELSS", "International Funds", "REITs"]
        };
      } else if (plan.riskProfile === 'moderate') {
        return {
          equity: 70,
          debt: 25,
          gold: 5,
          instruments: ["Large Cap Funds", "Flexi Cap Funds", "ELSS", "Balanced Advantage Funds"]
        };
      } else {
        return {
          equity: 50,
          debt: 45,
          gold: 5,
          instruments: ["Large Cap Funds", "Conservative Hybrid Funds", "PPF", "EPF", "NSC"]
        };
      }
    }
  };

  const getProgressToGoal = () => {
    const currentValue = plan.currentSavings;
    const targetValue = plan.retirementCorpus;
    return Math.min((currentValue / targetValue) * 100, 100);
  };

  const getRetirementReadiness = () => {
    const progress = getProgressToGoal();
    if (progress >= 80) return { status: 'excellent', color: 'green', message: 'On track for comfortable retirement' };
    if (progress >= 60) return { status: 'good', color: 'blue', message: 'Good progress, minor adjustments needed' };
    if (progress >= 40) return { status: 'moderate', color: 'yellow', message: 'Moderate progress, increase contributions' };
    return { status: 'needs attention', color: 'red', message: 'Urgent action needed for retirement goals' };
  };

  const recommendations = getInvestmentRecommendations();
  const readiness = getRetirementReadiness();
  const yearsToRetirement = plan.retirementAge - plan.currentAge;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Retirement Planning</h2>
          <p className="text-muted-foreground">Plan your retirement with personalized investment strategies</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowCalculation(!showCalculation)}
          data-testid="button-toggle-calculation"
        >
          <Calculator className="w-4 h-4 mr-2" />
          {showCalculation ? 'Hide' : 'Show'} Calculator
        </Button>
      </div>

      {/* Retirement Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-retirement-corpus">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Required Corpus</p>
                <p className="text-xl font-bold">{formatCurrency(plan.retirementCorpus)}</p>
              </div>
              <Target className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-investment">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Investment</p>
                <p className="text-xl font-bold">{formatCurrency(plan.monthlyInvestmentNeeded)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-years-to-retirement">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Years to Retirement</p>
                <p className="text-xl font-bold">{yearsToRetirement}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-retirement-readiness">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Retirement Readiness</p>
                <Badge variant={readiness.color === 'green' ? 'default' : readiness.color === 'red' ? 'destructive' : 'secondary'}>
                  {readiness.status}
                </Badge>
              </div>
              <Shield className={`w-8 h-8 text-${readiness.color}-500`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Retirement Calculator */}
      {showCalculation && (
        <Card data-testid="card-retirement-calculator">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              Retirement Calculator
            </CardTitle>
            <CardDescription>Adjust your parameters to see the impact on your retirement planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current-age">Current Age</Label>
                <Input
                  id="current-age"
                  data-testid="input-current-age"
                  type="number"
                  value={plan.currentAge}
                  onChange={(e) => setPlan({...plan, currentAge: parseInt(e.target.value) || 30})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="retirement-age">Retirement Age</Label>
                <Input
                  id="retirement-age"
                  data-testid="input-retirement-age"
                  type="number"
                  value={plan.retirementAge}
                  onChange={(e) => setPlan({...plan, retirementAge: parseInt(e.target.value) || 60})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-salary">Current Annual Salary (₹)</Label>
                <Input
                  id="current-salary"
                  data-testid="input-current-salary"
                  type="number"
                  value={plan.currentSalary}
                  onChange={(e) => setPlan({...plan, currentSalary: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current-savings">Current Savings (₹)</Label>
                <Input
                  id="current-savings"
                  data-testid="input-current-savings"
                  type="number"
                  value={plan.currentSavings}
                  onChange={(e) => setPlan({...plan, currentSavings: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly-expenses">Monthly Expenses (₹)</Label>
                <Input
                  id="monthly-expenses"
                  data-testid="input-monthly-expenses"
                  type="number"
                  value={plan.monthlyExpenses}
                  onChange={(e) => setPlan({...plan, monthlyExpenses: parseInt(e.target.value) || 0})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-profile">Risk Profile</Label>
                <Select value={plan.riskProfile} onValueChange={(value: any) => setPlan({...plan, riskProfile: value})}>
                  <SelectTrigger data-testid="select-retirement-risk-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative (8-10% returns)</SelectItem>
                    <SelectItem value="moderate">Moderate (10-12% returns)</SelectItem>
                    <SelectItem value="aggressive">Aggressive (12-15% returns)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retirement Progress */}
      <Card data-testid="card-retirement-progress">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Retirement Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Progress to Goal</span>
                <span className="text-lg font-bold">{getProgressToGoal().toFixed(1)}%</span>
              </div>
              <Progress value={getProgressToGoal()} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Current: {formatCurrency(plan.currentSavings)}</span>
                <span>Target: {formatCurrency(plan.retirementCorpus)}</span>
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              readiness.color === 'green' ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800' :
              readiness.color === 'blue' ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800' :
              readiness.color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800' :
              'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
            }`}>
              <p className={`font-medium text-${readiness.color}-700`}>{readiness.message}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="allocation" className="space-y-4">
        <ScrollableTabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="allocation" data-testid="tab-asset-allocation">Asset Allocation</TabsTrigger>
          <TabsTrigger value="instruments" data-testid="tab-investment-instruments">Investment Instruments</TabsTrigger>
          <TabsTrigger value="schemes" data-testid="tab-retirement-schemes">Retirement Schemes</TabsTrigger>
        </ScrollableTabsList>

        {/* Asset Allocation */}
        <TabsContent value="allocation">
          <Card data-testid="card-recommended-allocation">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-green-600" />
                Recommended Asset Allocation
              </CardTitle>
              <CardDescription>Based on your age ({plan.currentAge}) and risk profile ({plan.riskProfile})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{recommendations.equity}%</div>
                    <div className="text-sm text-blue-600">Equity</div>
                    <div className="text-xs text-muted-foreground mt-1">Growth focused</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{recommendations.debt}%</div>
                    <div className="text-sm text-green-600">Debt</div>
                    <div className="text-xs text-muted-foreground mt-1">Stability focused</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">{recommendations.gold}%</div>
                    <div className="text-sm text-yellow-600">Gold</div>
                    <div className="text-xs text-muted-foreground mt-1">Hedge against inflation</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Monthly Investment Breakdown</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                      <span>Equity Investments</span>
                      <span className="font-bold">{formatCurrency(plan.monthlyInvestmentNeeded * recommendations.equity / 100)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-green-50 dark:bg-green-950/30 rounded">
                      <span>Debt Investments</span>
                      <span className="font-bold">{formatCurrency(plan.monthlyInvestmentNeeded * recommendations.debt / 100)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded">
                      <span>Gold Investments</span>
                      <span className="font-bold">{formatCurrency(plan.monthlyInvestmentNeeded * recommendations.gold / 100)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investment Instruments */}
        <TabsContent value="instruments">
          <Card data-testid="card-recommended-instruments">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-purple-600" />
                Recommended Investment Instruments
              </CardTitle>
              <CardDescription>Curated investment options based on your retirement timeline and risk profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.instruments.map((instrument, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`instrument-${index}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <span className="font-medium">{instrument}</span>
                    </div>
                    <Button size="sm" variant="outline" data-testid={`button-invest-${index}`}>
                      Invest
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retirement Schemes */}
        <TabsContent value="schemes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card data-testid="card-government-schemes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-green-600" />
                  Government Retirement Schemes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <div>
                      <p className="font-medium">Employee Provident Fund (EPF)</p>
                      <p className="text-sm text-muted-foreground">Currently earning 8.25% interest</p>
                    </div>
                    <Badge variant="outline">Tax Free</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div>
                      <p className="font-medium">Public Provident Fund (PPF)</p>
                      <p className="text-sm text-muted-foreground">15-year lock-in, tax benefits</p>
                    </div>
                    <Badge variant="outline">7.1% returns</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <div>
                      <p className="font-medium">National Pension System (NPS)</p>
                      <p className="text-sm text-muted-foreground">Market-linked returns, low cost</p>
                    </div>
                    <Badge variant="outline">₹50K extra deduction</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-private-schemes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  Private Retirement Solutions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div>
                      <p className="font-medium">ELSS Mutual Funds</p>
                      <p className="text-sm text-muted-foreground">3-year lock-in, tax saving</p>
                    </div>
                    <Badge variant="outline">₹1.5L deduction</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                    <div>
                      <p className="font-medium">Retirement Mutual Funds</p>
                      <p className="text-sm text-muted-foreground">Target date funds</p>
                    </div>
                    <Badge variant="outline">Age-based allocation</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">Pension Plans</p>
                      <p className="text-sm text-muted-foreground">Guaranteed pension income</p>
                    </div>
                    <Badge variant="outline">Annuity options</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Plan */}
      <Card data-testid="card-retirement-action-plan">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            Your Retirement Action Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-lg">Immediate Actions</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Start SIP of {formatCurrency(plan.monthlyInvestmentNeeded)}/month</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Maximize EPF contribution (12% of salary)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <span className="text-sm">Open PPF account for tax benefits</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-lg">Long-term Strategy</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm">Review and rebalance portfolio annually</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded">
                    <Shield className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm">Gradually shift to conservative allocation near retirement</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-pink-50 dark:bg-pink-950/30 rounded">
                    <IndianRupee className="w-4 h-4 text-pink-600" />
                    <span className="text-sm">Consider partial withdrawal options post 60</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> This is a basic retirement projection. Actual returns may vary based on market conditions. 
                Consider consulting with a financial advisor for personalized advice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}