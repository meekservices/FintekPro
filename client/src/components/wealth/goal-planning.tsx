import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
  Shield,
  Trash2,
  Edit,
  CheckCircle2,
  Clock
} from "lucide-react";

interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  goalType: 'short_term' | 'medium_term' | 'long_term';
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
  priority: 'high' | 'medium' | 'low';
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  recommendedInvestments?: string[];
  monthlyContribution?: string;
  currentProgress?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

const goalIcons: Record<string, any> = {
  home_purchase: Home,
  education: GraduationCap,
  car: Car,
  travel: Plane,
  wedding: Heart,
  emergency: Target,
  retirement: Shield,
  wealth: Building2,
  other: Target
};

const categoryLabels: Record<string, string> = {
  home_purchase: "Home Purchase",
  education: "Education",
  car: "Car",
  travel: "Travel",
  wedding: "Wedding",
  emergency: "Emergency Fund",
  retirement: "Retirement",
  wealth: "Wealth Creation",
  other: "Other"
};

export function GoalPlanning() {
  const { toast } = useToast();
  const [newGoal, setNewGoal] = useState({
    name: "",
    description: "",
    category: "other",
    goalType: "medium_term" as const,
    targetAmount: "",
    targetDate: "",
    priority: "medium" as const,
    riskProfile: "moderate" as const
  });
  const [contributionGoalId, setContributionGoalId] = useState<string | null>(null);
  const [contribution, setContribution] = useState({
    amount: "",
    contributionDate: new Date().toISOString().split('T')[0],
    contributionType: "manual",
    notes: "",
    source: ""
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContributionDialogOpen, setIsContributionDialogOpen] = useState(false);

  // Fetch goals from API
  const { data: goals, isLoading } = useQuery<FinancialGoal[]>({
    queryKey: ['/api/goals'],
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goal: typeof newGoal) => {
      return await apiRequest('POST', '/api/goals', {
        body: goal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      toast({
        title: "Goal created",
        description: "Your financial goal has been created successfully",
      });
      setIsDialogOpen(false);
      setNewGoal({
        name: "",
        description: "",
        category: "other",
        goalType: "medium_term",
        targetAmount: "",
        targetDate: "",
        priority: "medium",
        riskProfile: "moderate"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      });
    },
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: string) => {
      return await apiRequest('DELETE', `/api/goals/${goalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      toast({
        title: "Goal deleted",
        description: "Your goal has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete goal",
        variant: "destructive",
      });
    },
  });

  // Add contribution mutation
  const addContributionMutation = useMutation({
    mutationFn: async ({ goalId, contribution: contrib }: { goalId: string; contribution: typeof contribution }) => {
      return await apiRequest('POST', `/api/goals/${goalId}/contributions`, {
        body: contrib,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      
      // Check for milestone achievements
      if (data.milestonesReached && data.milestonesReached.length > 0) {
        toast({
          title: "Milestone Achieved! 🎉",
          description: `You've reached ${data.milestonesReached.join('%, ')}% of your goal!`,
        });
      } else {
        toast({
          title: "Contribution added",
          description: "Your contribution has been recorded successfully",
        });
      }
      
      setIsContributionDialogOpen(false);
      setContributionGoalId(null);
      setContribution({
        amount: "",
        contributionDate: new Date().toISOString().split('T')[0],
        contributionType: "manual",
        notes: "",
        source: ""
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add contribution",
        variant: "destructive",
      });
    },
  });

  const calculateProgress = (current: string | number, target: string | number) => {
    const curr = typeof current === 'string' ? parseFloat(current) : current;
    const targ = typeof target === 'string' ? parseFloat(target) : target;
    return Math.min((curr / targ) * 100, 100);
  };

  const calculateMonthsToGoal = (targetDate: string) => {
    const target = new Date(targetDate);
    const now = new Date();
    const diffTime = target.getTime() - now.getTime();
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
    return Math.max(diffMonths, 0);
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const handleAddGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount || !newGoal.targetDate) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createGoalMutation.mutate(newGoal);
  };

  const handleAddContribution = () => {
    if (!contributionGoalId || !contribution.amount) {
      toast({
        title: "Missing fields",
        description: "Please enter contribution amount",
        variant: "destructive",
      });
      return;
    }

    addContributionMutation.mutate({ goalId: contributionGoalId, contribution });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const activeGoals = goals?.filter(g => g.isActive !== false) || [];

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
          <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <DialogHeader>
              <DialogTitle>Create Financial Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Goal Name *</Label>
                <Input
                  id="goal-name"
                  data-testid="input-goal-name"
                  placeholder="e.g., Dream Home, Child Education"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({...newGoal, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-category">Category *</Label>
                <Select value={newGoal.category} onValueChange={(value) => setNewGoal({...newGoal, category: value})}>
                  <SelectTrigger data-testid="select-goal-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-type">Goal Type *</Label>
                  <Select value={newGoal.goalType} onValueChange={(value: any) => setNewGoal({...newGoal, goalType: value})}>
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
                  <Label htmlFor="goal-priority">Priority *</Label>
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
                  <Label htmlFor="target-amount">Target Amount (₹) *</Label>
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
                  <Label htmlFor="target-date">Target Date *</Label>
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
                <Label htmlFor="risk-profile">Risk Profile *</Label>
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

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  data-testid="input-description"
                  placeholder="Add notes about this goal"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                />
              </div>

              <Button 
                onClick={handleAddGoal} 
                className="w-full" 
                data-testid="button-create-goal"
                disabled={createGoalMutation.isPending}
              >
                {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contribution Dialog */}
      <Dialog open={isContributionDialogOpen} onOpenChange={setIsContributionDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contrib-amount">Amount (₹) *</Label>
              <Input
                id="contrib-amount"
                data-testid="input-contribution-amount"
                type="number"
                placeholder="10000"
                value={contribution.amount}
                onChange={(e) => setContribution({...contribution, amount: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-date">Date *</Label>
              <Input
                id="contrib-date"
                data-testid="input-contribution-date"
                type="date"
                value={contribution.contributionDate}
                onChange={(e) => setContribution({...contribution, contributionDate: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-type">Type</Label>
              <Select value={contribution.contributionType} onValueChange={(value) => setContribution({...contribution, contributionType: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="sip">SIP</SelectItem>
                  <SelectItem value="lumpsum">Lumpsum</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-source">Source (Optional)</Label>
              <Input
                id="contrib-source"
                data-testid="input-contribution-source"
                placeholder="e.g., Salary, Bonus, Gift"
                value={contribution.source}
                onChange={(e) => setContribution({...contribution, source: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contrib-notes">Notes (Optional)</Label>
              <Input
                id="contrib-notes"
                data-testid="input-contribution-notes"
                placeholder="Add any notes"
                value={contribution.notes}
                onChange={(e) => setContribution({...contribution, notes: e.target.value})}
              />
            </div>

            <Button 
              onClick={handleAddContribution} 
              className="w-full"
              disabled={addContributionMutation.isPending}
            >
              {addContributionMutation.isPending ? "Adding..." : "Add Contribution"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goals Grid */}
      {activeGoals.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Target className="w-16 h-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-xl font-semibold">No Goals Yet</h3>
              <p className="text-muted-foreground mt-2">Start by creating your first financial goal</p>
            </div>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Goal
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeGoals.map((goal) => {
            const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
            const monthsRemaining = calculateMonthsToGoal(goal.targetDate);
            const remainingAmount = parseFloat(goal.targetAmount) - parseFloat(goal.currentAmount);
            const Icon = goalIcons[goal.category] || Target;

            // Determine which milestones have been reached
            const milestones = [25, 50, 75, 100];
            const reachedMilestones = milestones.filter(m => progress >= m);

            return (
              <Card key={goal.id} className="hover:shadow-lg transition-shadow" data-testid={`card-goal-${goal.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        goal.priority === 'high' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' :
                        goal.priority === 'medium' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{goal.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 flex-wrap mt-1">
                          <Badge variant={goal.priority === 'high' ? 'destructive' : goal.priority === 'medium' ? 'default' : 'secondary'} className="text-xs">
                            {goal.priority} priority
                          </Badge>
                          <Badge variant="outline" className="text-xs">{goal.goalType.replace('_', ' ')}</Badge>
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this goal?')) {
                          deleteGoalMutation.mutate(goal.id);
                        }
                      }}
                      data-testid={`button-delete-goal-${goal.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{progress.toFixed(1)}%</span>
                        {reachedMilestones.length > 0 && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
                    </div>
                  </div>

                  {/* Milestones */}
                  {reachedMilestones.length > 0 && (
                    <div className="flex gap-1">
                      {milestones.map(m => (
                        <div
                          key={m}
                          className={`flex-1 h-2 rounded ${
                            reachedMilestones.includes(m) 
                              ? 'bg-green-500' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}

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

                  {goal.monthlyContribution && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Recommended Monthly SIP</span>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(goal.monthlyContribution)}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Based on 12% expected returns</p>
                      </div>
                    </div>
                  )}

                  {goal.recommendedInvestments && goal.recommendedInvestments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">Investment Recommendations</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {goal.recommendedInvestments.slice(0, 4).map((investment, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {investment}
                          </Badge>
                        ))}
                        {goal.recommendedInvestments.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{goal.recommendedInvestments.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => {
                        setContributionGoalId(goal.id);
                        setIsContributionDialogOpen(true);
                      }}
                      data-testid={`button-add-contribution-${goal.id}`}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Money
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      data-testid={`button-start-investing-${goal.id}`}
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Invest
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Goal Summary */}
      {activeGoals.length > 0 && (
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
                <p className="text-2xl font-bold text-blue-600">{activeGoals.length}</p>
                <p className="text-sm text-muted-foreground">Total Goals</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(activeGoals.reduce((sum, goal) => sum + parseFloat(goal.targetAmount), 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Target Amount</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(activeGoals.reduce((sum, goal) => sum + (parseFloat(goal.monthlyContribution || "0")), 0))}
                </p>
                <p className="text-sm text-muted-foreground">Monthly Investment Needed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Allocation & Timeline Visualizations */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Goal Allocation Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                Goal Allocation by Target Amount
              </CardTitle>
              <CardDescription>
                Distribution of your financial goals by target amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={activeGoals.map(goal => ({
                        name: goal.name,
                        value: parseFloat(goal.targetAmount),
                        category: goal.category
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {activeGoals.map((_, index) => {
                        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Goal Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Goal Timeline
              </CardTitle>
              <CardDescription>
                Upcoming goal deadlines sorted by date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeGoals
                  .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
                  .slice(0, 5)
                  .map((goal) => {
                    const Icon = goalIcons[goal.category] || Target;
                    const monthsRemaining = calculateMonthsToGoal(goal.targetDate);
                    const progress = calculateProgress(goal.currentAmount, goal.targetAmount);
                    const isUrgent = monthsRemaining <= 6;
                    const isNear = monthsRemaining <= 12;

                    return (
                      <div key={goal.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors">
                        <div className={`p-3 rounded-lg ${
                          isUrgent ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300' :
                          isNear ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-300' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold">{goal.name}</h4>
                            <Badge variant={isUrgent ? 'destructive' : isNear ? 'default' : 'secondary'}>
                              {monthsRemaining} months
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <Progress value={progress} className="h-1.5" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{formatCurrency(goal.currentAmount)} saved</span>
                              <span className="font-medium">{progress.toFixed(0)}% complete</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {activeGoals.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground pt-2">
                    +{activeGoals.length - 5} more goals
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
