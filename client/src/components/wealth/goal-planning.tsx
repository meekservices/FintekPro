import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
  PieChart,
  Building2,
  Star,
  Crown,
  Shield,
  Briefcase,
  Pencil
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    type: 'short_term' | 'medium_term' | 'long_term';
    targetAmount: string;
    currentAmount: string;
    targetDate: string;
    priority: 'high' | 'medium' | 'low';
    riskProfile: 'conservative' | 'moderate' | 'aggressive';
  }>({
    name: "",
    type: "medium_term",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    priority: "medium",
    riskProfile: "moderate"
  });

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
    
    // Short-term goals (< 1 year) - Capital preservation focus
    if (monthsToGoal <= 12) {
      return ["Liquid Funds", "Ultra Short Duration Funds", "Premium Corporate Bonds", "Fixed Deposits"];
    } 
    // Medium-term goals (1-3 years) - Stability with modest growth
    else if (monthsToGoal <= 36) {
      return ["Short Duration Funds", "Conservative Hybrid Funds", "High-Grade Corporate Bonds", "REITs (for income)"];
    } 
    // Medium-long term (3-5 years) - Balanced approach
    else if (monthsToGoal <= 60) {
      return ["Balanced Advantage Funds", "Multi Asset Funds", "REITs", "InvITs (for yield)"];
    } 
    // Long-term goals (5+ years) - Include premium investments based on goal type and amount
    else {
      let baseRecommendations: string[] = [];
      let premiumRecommendations: string[] = [];
      
      // Base recommendations by risk profile
      if (goal.riskProfile === "aggressive") {
        baseRecommendations = ["Large Cap Funds", "Flexi Cap Funds", "Mid Cap Funds", "ELSS"];
      } else if (goal.riskProfile === "moderate") {
        baseRecommendations = ["Large Cap Funds", "Balanced Advantage Funds", "REITs", "InvITs"];
      } else {
        baseRecommendations = ["Conservative Hybrid Funds", "High-Grade Corporate Bonds", "PPF", "REITs"];
      }
      
      // Add premium investment recommendations based on goal specifics
      if (goal.targetAmount >= 5000000) { // ₹50L+ goals
        if (goal.name.toLowerCase().includes('retirement')) {
          premiumRecommendations = ["PMS (Conservative)", "REITs Portfolio", "Premium Bonds"];
        } else if (goal.name.toLowerCase().includes('wealth') || goal.name.toLowerCase().includes('corpus')) {
          premiumRecommendations = ["PMS (Growth)", "AIF Category I/II", "International REITs"];
        } else if (goal.name.toLowerCase().includes('home') || goal.name.toLowerCase().includes('property')) {
          premiumRecommendations = ["REITs (Real Estate)", "Infrastructure InvITs", "PMS (Real Estate Focus)"];
        } else if (goal.name.toLowerCase().includes('education')) {
          premiumRecommendations = ["Education-focused PMS", "International Funds", "REITs (Stable Income)"];
        }
      } else if (goal.targetAmount >= 1000000) { // ₹10L+ goals
        premiumRecommendations = ["REITs (Diversified)", "InvITs (Infrastructure)", "Premium Corporate Bonds"];
      }
      
      return [...baseRecommendations, ...premiumRecommendations].slice(0, 6); // Limit to 6 recommendations
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

  const handleStartEdit = (goal: FinancialGoal) => {
    setEditingGoal(goal);
    setEditFormData({
      name: goal.name,
      type: goal.type,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate,
      priority: goal.priority,
      riskProfile: goal.riskProfile
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateGoal = () => {
    if (!editingGoal || !editFormData.name || !editFormData.targetAmount || !editFormData.targetDate) return;

    const updatedGoal: FinancialGoal = {
      ...editingGoal,
      name: editFormData.name,
      type: editFormData.type,
      targetAmount: parseInt(editFormData.targetAmount),
      currentAmount: parseInt(editFormData.currentAmount) || 0,
      targetDate: editFormData.targetDate,
      priority: editFormData.priority,
      riskProfile: editFormData.riskProfile,
      recommendedInvestments: []
    };

    updatedGoal.recommendedInvestments = getInvestmentRecommendations(updatedGoal);
    
    setGoals(goals.map(g => g.id === editingGoal.id ? updatedGoal : g));
    setEditingGoal(null);
    setIsEditDialogOpen(false);
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
              <DialogDescription>Set a target amount, timeline, and priority for your financial goal.</DialogDescription>
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

      {/* Edit Goal Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update the details of your financial goal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-goal-name">Goal Name</Label>
              <Input
                id="edit-goal-name"
                data-testid="input-edit-goal-name"
                placeholder="e.g., Dream Home, Child Education"
                value={editFormData.name}
                onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-goal-type">Goal Type</Label>
                <Select value={editFormData.type} onValueChange={(value: any) => setEditFormData({...editFormData, type: value})}>
                  <SelectTrigger data-testid="select-edit-goal-type">
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
                <Label htmlFor="edit-goal-priority">Priority</Label>
                <Select value={editFormData.priority} onValueChange={(value: any) => setEditFormData({...editFormData, priority: value})}>
                  <SelectTrigger data-testid="select-edit-goal-priority">
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
                <Label htmlFor="edit-target-amount">Target Amount (₹)</Label>
                <Input
                  id="edit-target-amount"
                  data-testid="input-edit-target-amount"
                  type="number"
                  placeholder="1000000"
                  value={editFormData.targetAmount}
                  onChange={(e) => setEditFormData({...editFormData, targetAmount: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-current-amount">Current Amount (₹)</Label>
                <Input
                  id="edit-current-amount"
                  data-testid="input-edit-current-amount"
                  type="number"
                  placeholder="0"
                  value={editFormData.currentAmount}
                  onChange={(e) => setEditFormData({...editFormData, currentAmount: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-target-date">Target Date</Label>
              <Input
                id="edit-target-date"
                data-testid="input-edit-target-date"
                type="date"
                value={editFormData.targetDate}
                onChange={(e) => setEditFormData({...editFormData, targetDate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-risk-profile">Risk Profile</Label>
              <Select value={editFormData.riskProfile} onValueChange={(value: any) => setEditFormData({...editFormData, riskProfile: value})}>
                <SelectTrigger data-testid="select-edit-risk-profile">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative (Low Risk)</SelectItem>
                  <SelectItem value="moderate">Moderate (Medium Risk)</SelectItem>
                  <SelectItem value="aggressive">Aggressive (High Risk)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleUpdateGoal} className="w-full" data-testid="button-update-goal">
              Update Goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStartEdit(goal)}
                    data-testid={`button-edit-goal-${goal.id}`}
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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

      {/* Premium Investment Allocation Guidance */}
      <Card data-testid="card-premium-allocation-guidance" className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-900">
            <Star className="w-5 h-5 text-purple-600" />
            Premium Investment Allocation by Objective
          </CardTitle>
          <CardDescription className="text-purple-700">
            Optimize your goal achievement with strategic premium investment allocations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Retirement Planning */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">Retirement Planning</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-green-800">Optimal Allocation:</p>
                      <ul className="text-green-700 space-y-1 ml-4">
                        <li>• 40% REITs/InvITs (steady income)</li>
                        <li>• 30% PMS Conservative</li>
                        <li>• 20% Premium Bonds</li>
                        <li>• 10% Equity Funds</li>
                      </ul>
                    </div>
                    <div className="bg-green-100 p-3 rounded-lg">
                      <p className="text-xs text-green-800">
                        <strong>Target:</strong> ₹2Cr+ corpus<br/>
                        <strong>Timeline:</strong> 15-20 years<br/>
                        <strong>Monthly:</strong> ₹45,000-60,000
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wealth Creation */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Wealth Creation</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-blue-800">Optimal Allocation:</p>
                      <ul className="text-blue-700 space-y-1 ml-4">
                        <li>• 50% Growth PMS</li>
                        <li>• 25% AIF Category II</li>
                        <li>• 15% International REITs</li>
                        <li>• 10% Tech/Innovation Funds</li>
                      </ul>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <p className="text-xs text-blue-800">
                        <strong>Target:</strong> ₹5Cr+ corpus<br/>
                        <strong>Timeline:</strong> 10-15 years<br/>
                        <strong>Monthly:</strong> ₹72,000 (current surplus)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Income Generation */}
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-orange-600" />
                    <h4 className="font-semibold text-orange-900">Income Generation</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-orange-800">Optimal Allocation:</p>
                      <ul className="text-orange-700 space-y-1 ml-4">
                        <li>• 60% REITs (dividend yield)</li>
                        <li>• 25% Infrastructure InvITs</li>
                        <li>• 10% Premium Corporate Bonds</li>
                        <li>• 5% Dividend-focused PMS</li>
                      </ul>
                    </div>
                    <div className="bg-orange-100 p-3 rounded-lg">
                      <p className="text-xs text-orange-800">
                        <strong>Target:</strong> ₹50L-1Cr corpus<br/>
                        <strong>Yield:</strong> 7-9% annually<br/>
                        <strong>Monthly Income:</strong> ₹30,000-75,000
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real Estate Goals */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-900">Property Purchase</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-amber-800">Optimal Allocation:</p>
                      <ul className="text-amber-700 space-y-1 ml-4">
                        <li>• 40% Commercial REITs</li>
                        <li>• 30% Real Estate PMS</li>
                        <li>• 20% Infrastructure InvITs</li>
                        <li>• 10% Large Cap Funds</li>
                      </ul>
                    </div>
                    <div className="bg-amber-100 p-3 rounded-lg">
                      <p className="text-xs text-amber-800">
                        <strong>Target:</strong> ₹1Cr+ property<br/>
                        <strong>Timeline:</strong> 7-10 years<br/>
                        <strong>Leverage:</strong> Real estate expertise
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Education Planning */}
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-purple-600" />
                    <h4 className="font-semibold text-purple-900">Education Planning</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-purple-800">Optimal Allocation:</p>
                      <ul className="text-purple-700 space-y-1 ml-4">
                        <li>• 40% Education-focused PMS</li>
                        <li>• 30% International Funds</li>
                        <li>• 20% REITs (stability)</li>
                        <li>• 10% Child Education Plans</li>
                      </ul>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <p className="text-xs text-purple-800">
                        <strong>Target:</strong> ₹50L-1Cr corpus<br/>
                        <strong>Timeline:</strong> 10-18 years<br/>
                        <strong>Focus:</strong> Global education access
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ultra HNI Goals */}
            <Card className="border-indigo-200 bg-indigo-50">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-semibold text-indigo-900">Ultra HNI Portfolio</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <p className="font-medium text-indigo-800">Optimal Allocation:</p>
                      <ul className="text-indigo-700 space-y-1 ml-4">
                        <li>• 40% AIF Category III</li>
                        <li>• 30% Multi-Manager PMS</li>
                        <li>• 20% Global REITs/InvITs</li>
                        <li>• 10% Alternative Investments</li>
                      </ul>
                    </div>
                    <div className="bg-indigo-100 p-3 rounded-lg">
                      <p className="text-xs text-indigo-800">
                        <strong>Target:</strong> ₹10Cr+ portfolio<br/>
                        <strong>Timeline:</strong> Path to ₹1Cr first<br/>
                        <strong>Strategy:</strong> Aggressive wealth multiplication
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Surplus Integration */}
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Your ₹72,000 Monthly Surplus Optimization
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <h5 className="font-medium text-green-800">🎯 Immediate (0-2 years)</h5>
                <div className="space-y-1 text-green-700">
                  <div>• ₹20,000 → REITs/InvITs</div>
                  <div>• ₹15,000 → Premium Bonds</div>
                  <div>• ₹10,000 → Emergency fund top-up</div>
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-blue-800">📈 Medium-term (2-6 years)</h5>
                <div className="space-y-1 text-blue-700">
                  <div>• ₹72,000 → PMS eligibility path</div>
                  <div>• Build ₹50L corpus systematically</div>
                  <div>• Professional portfolio management</div>
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-purple-800">🏆 Long-term (6+ years)</h5>
                <div className="space-y-1 text-purple-700">
                  <div>• ₹72,000 → AIF qualification (₹1Cr)</div>
                  <div>• Alternative investment strategies</div>
                  <div>• Ultra HNI wealth creation</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}