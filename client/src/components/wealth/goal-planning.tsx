import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Home, 
  GraduationCap, 
  Car, 
  Plane, 
  Heart, 
  Plus,
  TrendingUp,
  Calendar,
  IndianRupee,
  PieChart
} from "lucide-react";

interface FinancialGoal {
  id: string;
  name: string;
  type: 'short_term' | 'medium_term' | 'long_term';
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  priority: 'high' | 'medium' | 'low';
  recommendedInvestments: string[];
  monthlyContribution: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

const goalIcons = {
  home: Home,
  education: GraduationCap,
  car: Car,
  travel: Plane,
  wedding: Heart,
  emergency: Target,
  retirement: Target
};

export function GoalPlanning() {
  const [goals, setGoals] = useState<FinancialGoal[]>([
    {
      id: "1",
      name: "Home Purchase",
      type: "long_term",
      targetAmount: 5000000,
      currentAmount: 850000,
      targetDate: "2028-12-31",
      priority: "high",
      recommendedInvestments: ["Equity Mutual Funds", "ELSS", "Large Cap Funds"],
      monthlyContribution: 35000,
      riskProfile: "moderate"
    },
    {
      id: "2", 
      name: "Child Education",
      type: "long_term",
      targetAmount: 2500000,
      currentAmount: 320000,
      targetDate: "2035-06-30",
      priority: "high",
      recommendedInvestments: ["Child Education Plans", "Equity Funds", "PPF"],
      monthlyContribution: 15000,
      riskProfile: "aggressive"
    },
    {
      id: "3",
      name: "Emergency Fund",
      type: "short_term", 
      targetAmount: 600000,
      currentAmount: 450000,
      targetDate: "2025-12-31",
      priority: "high",
      recommendedInvestments: ["Liquid Funds", "Short Term Debt Funds", "FD"],
      monthlyContribution: 12000,
      riskProfile: "conservative"
    }
  ]);

  const [newGoal, setNewGoal] = useState({
    name: "",
    type: "medium_term" as const,
    targetAmount: "",
    targetDate: "",
    priority: "medium" as const,
    riskProfile: "moderate" as const
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const calculateMonthsToGoal = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return Math.max(diffMonths, 0);
  };

  const getInvestmentRecommendations = (goal: FinancialGoal) => {
    const monthsToGoal = calculateMonthsToGoal(goal.targetDate);
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    
    if (monthsToGoal <= 12) {
      return ["Liquid Funds", "Ultra Short Duration Funds", "Fixed Deposits"];
    } else if (monthsToGoal <= 36) {
      return ["Short Duration Funds", "Conservative Hybrid Funds", "Arbitrage Funds"];
    } else if (monthsToGoal <= 60) {
      return ["Balanced Advantage Funds", "Multi Asset Funds", "Equity Savings Funds"];
    } else {
      if (goal.riskProfile === "aggressive") {
        return ["Large Cap Funds", "Flexi Cap Funds", "Mid Cap Funds", "ELSS"];
      } else if (goal.riskProfile === "moderate") {
        return ["Large Cap Funds", "Balanced Advantage Funds", "Conservative Hybrid Funds"];
      } else {
        return ["Conservative Hybrid Funds", "Short Duration Funds", "PPF", "NSC"];
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate) return;

    const goal: FinancialGoal = {
      id: Date.now().toString(),
      name: newGoal.name,
      type: newGoal.type,
      targetAmount: parseInt(newGoal.targetAmount),
      currentAmount: 0,
      targetDate: newGoal.targetDate,
      priority: newGoal.priority,
      recommendedInvestments: [],
      monthlyContribution: 0,
      riskProfile: newGoal.riskProfile
    };

    goal.recommendedInvestments = getInvestmentRecommendations(goal);
    setGoals([...goals, goal]);
    setNewGoal({
      name: "",
      type: "medium_term",
      targetAmount: "",
      targetDate: "",
      priority: "medium",
      riskProfile: "moderate"
    });
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Financial Goal Planning</h2>
          <p className="text-muted-foreground">Plan and track your financial objectives with personalized investment recommendations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-goal">
              <Plus className="w-4 h-4 mr-2" />
              Add New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Financial Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Goal Name</Label>
                <Input
                  id="goal-name"
                  data-testid="input-goal-name"
                  placeholder="e.g., Dream Home, Child Education"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-type">Goal Type</Label>
                  <Select value={newGoal.type} onValueChange={(value: any) => setNewGoal({...newGoal, type: value})}>
                    <SelectTrigger data-testid="select-goal-type">
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
                  <Label htmlFor="goal-priority">Priority</Label>
                  <Select value={newGoal.priority} onValueChange={(value: any) => setNewGoal({...newGoal, priority: value})}>
                    <SelectTrigger data-testid="select-goal-priority">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target-amount">Target Amount (₹)</Label>
                  <Input
                    id="target-amount"
                    data-testid="input-target-amount"
                    type="number"
                    placeholder="1000000"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({...newGoal, targetAmount: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="target-date">Target Date</Label>
                  <Input
                    id="target-date"
                    data-testid="input-target-date"
                    type="date"
                    value={newGoal.targetDate}
                    onChange={(e) => setNewGoal({...newGoal, targetDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-profile">Risk Profile</Label>
                <Select value={newGoal.riskProfile} onValueChange={(value: any) => setNewGoal({...newGoal, riskProfile: value})}>
                  <SelectTrigger data-testid="select-risk-profile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative (Low Risk)</SelectItem>
                    <SelectItem value="moderate">Moderate (Medium Risk)</SelectItem>
                    <SelectItem value="aggressive">Aggressive (High Risk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAddGoal} className="w-full" data-testid="button-create-goal">
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
          const monthsRemaining = calculateMonthsToGoal(goal.targetDate);
          const remainingAmount = goal.targetAmount - goal.currentAmount;
          const Icon = goalIcons[goal.name.toLowerCase().includes('home') ? 'home' : 
                                goal.name.toLowerCase().includes('education') ? 'education' :
                                goal.name.toLowerCase().includes('car') ? 'car' :
                                goal.name.toLowerCase().includes('travel') ? 'travel' :
                                goal.name.toLowerCase().includes('wedding') ? 'wedding' :
                                goal.name.toLowerCase().includes('emergency') ? 'emergency' : 'retirement'];

          return (
            <Card key={goal.id} className="hover:shadow-lg transition-shadow" data-testid={`card-goal-${goal.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      goal.priority === 'high' ? 'bg-red-100 text-red-600' :
                      goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{goal.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant={goal.priority === 'high' ? 'destructive' : goal.priority === 'medium' ? 'default' : 'secondary'}>
                          {goal.priority} priority
                        </Badge>
                        <Badge variant="outline">{goal.type.replace('_', ' ')}</Badge>
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(goal.currentAmount)}</span>
                    <span>{formatCurrency(goal.targetAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{monthsRemaining} months</p>
                      <p className="text-muted-foreground">remaining</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{formatCurrency(remainingAmount)}</p>
                      <p className="text-muted-foreground">needed</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Recommended Monthly SIP</span>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(goal.monthlyContribution)}</p>
                    <p className="text-xs text-blue-600">Based on 12% expected returns</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">Investment Recommendations</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {goal.recommendedInvestments.map((investment, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {investment}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button className="w-full" variant="outline" data-testid={`button-start-investing-${goal.id}`}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Start Investing
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Goal Summary */}
      <Card data-testid="card-goal-summary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Goal Planning Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{goals.length}</p>
              <p className="text-sm text-muted-foreground">Total Goals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(goals.reduce((sum, goal) => sum + goal.targetAmount, 0))}
              </p>
              <p className="text-sm text-muted-foreground">Total Target Amount</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(goals.reduce((sum, goal) => sum + goal.monthlyContribution, 0))}
              </p>
              <p className="text-sm text-muted-foreground">Monthly Investment Needed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}