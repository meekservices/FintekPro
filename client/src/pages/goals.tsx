import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, Plus, Home, GraduationCap, Car, Heart, Plane, Shield, TrendingUp, 
  Gem, Umbrella, Calendar, IndianRupee, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, Sparkles, PieChart, Trophy
} from "lucide-react";
import { format, differenceInMonths } from "date-fns";

const GOAL_CATEGORIES = {
  retirement: { icon: Umbrella, color: "#f97316", name: "Retirement", defaultReturn: 10, defaultInflation: 6 },
  education: { icon: GraduationCap, color: "#8b5cf6", name: "Child Education", defaultReturn: 12, defaultInflation: 8 },
  home_purchase: { icon: Home, color: "#22c55e", name: "Home Purchase", defaultReturn: 12, defaultInflation: 7 },
  car: { icon: Car, color: "#3b82f6", name: "Car Purchase", defaultReturn: 10, defaultInflation: 5 },
  wedding: { icon: Heart, color: "#ec4899", name: "Wedding", defaultReturn: 10, defaultInflation: 8 },
  child_marriage: { icon: Gem, color: "#d946ef", name: "Child Marriage", defaultReturn: 10, defaultInflation: 8 },
  emergency: { icon: Shield, color: "#ef4444", name: "Emergency Fund", defaultReturn: 6, defaultInflation: 6 },
  travel: { icon: Plane, color: "#06b6d4", name: "Dream Vacation", defaultReturn: 8, defaultInflation: 5 },
  wealth_building: { icon: TrendingUp, color: "#10b981", name: "Wealth Building", defaultReturn: 12, defaultInflation: 6 },
  custom: { icon: Target, color: "#6b7280", name: "Custom Goal", defaultReturn: 10, defaultInflation: 6 },
};

const goalFormSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  category: z.string().min(1, "Category is required"),
  targetAmount: z.string().min(1, "Target amount is required"),
  currentAmount: z.string().optional(),
  targetDate: z.string().min(1, "Target date is required"),
  riskProfile: z.enum(["conservative", "moderate", "aggressive"]),
  priority: z.enum(["low", "medium", "high"]).optional(),
  inflationRate: z.string().optional(),
  expectedReturnRate: z.string().optional(),
});

type GoalFormData = z.infer<typeof goalFormSchema>;

interface SIPCalculation {
  requiredSipAmount: number;
  totalInvestment: number;
  expectedCorpus: number;
  inflationAdjustedTarget: number;
  monthsRemaining: number;
  yearsRemaining: number;
}

interface AllocationSuggestion {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
  reasoning: string;
}

function formatCurrency(amount: number | string | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(num);
}

function GoalCard({ goal }: { goal: any }) {
  const category = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
  const IconComponent = category.icon;
  const progress = parseFloat(goal.currentProgress || "0");
  
  const statusColors = {
    on_track: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    ahead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    behind: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    at_risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const statusLabels = {
    on_track: "On Track",
    ahead: "Ahead",
    behind: "Behind",
    at_risk: "At Risk",
  };

  return (
    <Card className="hover:shadow-lg transition-shadow" data-testid={`goal-card-${goal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg" 
              style={{ backgroundColor: `${category.color}20` }}
            >
              <IconComponent className="h-5 w-5" style={{ color: category.color }} />
            </div>
            <div>
              <CardTitle className="text-lg">{goal.name}</CardTitle>
              <CardDescription>{category.name}</CardDescription>
            </div>
          </div>
          <Badge className={statusColors[goal.onTrackStatus as keyof typeof statusColors] || statusColors.on_track}>
            {statusLabels[goal.onTrackStatus as keyof typeof statusLabels] || "On Track"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress.toFixed(1)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Current</p>
              <p className="font-semibold">{formatCurrency(goal.currentAmount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Target</p>
              <p className="font-semibold">{formatCurrency(goal.targetAmount)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(goal.targetDate), "MMM yyyy")}</span>
            </div>
            {goal.suggestedSipAmount && (
              <div className="flex items-center gap-1 text-primary">
                <IndianRupee className="h-4 w-4" />
                <span className="font-medium">{formatCurrency(goal.suggestedSipAmount)}/mo</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateGoalWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [sipCalculation, setSipCalculation] = useState<SIPCalculation | null>(null);
  const [allocation, setAllocation] = useState<AllocationSuggestion | null>(null);
  const { toast } = useToast();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: "",
      category: "",
      targetAmount: "",
      currentAmount: "0",
      targetDate: "",
      riskProfile: "moderate",
      priority: "medium",
    },
  });

  const calculateSipMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/goals/calculate-sip", data);
      return res.json();
    },
    onSuccess: (data) => {
      setSipCalculation(data);
    },
  });

  const getAllocationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/goals/suggest-allocation", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAllocation(data);
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: GoalFormData) => {
      const userId = "demo-user";
      const categoryDefaults = GOAL_CATEGORIES[data.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
      
      const goalData = {
        ...data,
        userId,
        goalType: getGoalType(data.targetDate),
        inflationRate: data.inflationRate || categoryDefaults.defaultInflation.toString(),
        expectedReturnRate: data.expectedReturnRate || categoryDefaults.defaultReturn.toString(),
      };
      
      const res = await apiRequest("POST", "/api/goals", goalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user/demo-user"] });
      toast({ title: "Goal Created!", description: "Your financial goal has been set up successfully." });
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function getGoalType(targetDate: string): string {
    const months = differenceInMonths(new Date(targetDate), new Date());
    if (months <= 36) return "short_term";
    if (months <= 84) return "medium_term";
    return "long_term";
  }

  const handleNextStep = async () => {
    if (step === 1) {
      const valid = await form.trigger(["name", "category"]);
      if (valid) setStep(2);
    } else if (step === 2) {
      const valid = await form.trigger(["targetAmount", "targetDate", "riskProfile"]);
      if (valid) {
        const values = form.getValues();
        const categoryDefaults = GOAL_CATEGORIES[values.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
        const months = differenceInMonths(new Date(values.targetDate), new Date());
        
        calculateSipMutation.mutate({
          targetAmount: values.targetAmount,
          currentSavings: values.currentAmount || "0",
          monthsRemaining: months,
          expectedReturnRate: categoryDefaults.defaultReturn,
          inflationRate: categoryDefaults.defaultInflation,
        });

        getAllocationMutation.mutate({
          yearsRemaining: months / 12,
          riskProfile: values.riskProfile,
        });

        setStep(3);
      }
    }
  };

  const selectedCategory = form.watch("category");
  const CategoryIcon = selectedCategory ? GOAL_CATEGORIES[selectedCategory as keyof typeof GOAL_CATEGORIES]?.icon || Target : Target;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s === step ? "bg-primary text-primary-foreground" : 
              s < step ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
            }`}>
              {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-1 mx-1 ${s < step ? "bg-green-500" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => createGoalMutation.mutate(data))}>
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">What's your goal?</h3>
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Type</FormLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(GOAL_CATEGORIES).map(([key, value]) => {
                        const Icon = value.icon;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => field.onChange(key)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              field.value === key 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-primary/50"
                            }`}
                            data-testid={`goal-category-${key}`}
                          >
                            <Icon className="h-5 w-5 mb-1" style={{ color: value.color }} />
                            <p className="text-sm font-medium">{value.name}</p>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Dream Home, Child's Education" {...field} data-testid="input-goal-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Set your target</h3>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <CategoryIcon className="h-6 w-6" style={{ color: GOAL_CATEGORIES[selectedCategory as keyof typeof GOAL_CATEGORIES]?.color }} />
                <span className="font-medium">{form.getValues("name")}</span>
              </div>

              <FormField
                control={form.control}
                name="targetAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 5000000" {...field} data-testid="input-target-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Savings (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} data-testid="input-current-amount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Date</FormLabel>
                    <FormControl>
                      <Input type="date" min={format(new Date(), "yyyy-MM-dd")} {...field} data-testid="input-target-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="riskProfile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Appetite</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-risk-profile">
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="conservative">Conservative (Lower risk, steady returns)</SelectItem>
                        <SelectItem value="moderate">Moderate (Balanced approach)</SelectItem>
                        <SelectItem value="aggressive">Aggressive (Higher risk, higher potential)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Your Investment Plan
              </h3>

              {(calculateSipMutation.isPending || getAllocationMutation.isPending) ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {sipCalculation && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Recommended SIP</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(sipCalculation.requiredSipAmount)}/mo</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Inflation-Adjusted Target</p>
                            <p className="text-xl font-semibold">{formatCurrency(sipCalculation.inflationAdjustedTarget)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Time Horizon</p>
                            <p className="font-medium">{sipCalculation.yearsRemaining} years</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Investment</p>
                            <p className="font-medium">{formatCurrency(sipCalculation.totalInvestment)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {allocation && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <PieChart className="h-4 w-4" />
                          Suggested Asset Allocation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm flex-1">Equity</span>
                            <span className="font-medium">{allocation.equity}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1">Debt</span>
                            <span className="font-medium">{allocation.debt}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <span className="text-sm flex-1">Gold</span>
                            <span className="font-medium">{allocation.gold}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-400" />
                            <span className="text-sm flex-1">Cash</span>
                            <span className="font-medium">{allocation.cash}%</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">{allocation.reasoning}</p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex justify-between mt-6">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <div className="ml-auto">
              {step < 3 ? (
                <Button type="button" onClick={handleNextStep} data-testid="button-next-step">
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={createGoalMutation.isPending} data-testid="button-create-goal">
                  {createGoalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trophy className="h-4 w-4 mr-2" />
                  )}
                  Create Goal
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default function GoalsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const userId = "demo-user";

  const { data: goals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/goals/user", userId],
  });

  const activeGoals = goals?.filter(g => !g.isCompleted) || [];
  const completedGoals = goals?.filter(g => g.isCompleted) || [];

  const totalProgress = activeGoals.length > 0
    ? activeGoals.reduce((sum, g) => sum + parseFloat(g.currentProgress || "0"), 0) / activeGoals.length
    : 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Financial Goals
          </h1>
          <p className="text-muted-foreground">Plan and track your financial milestones</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-new-goal">
              <Plus className="h-4 w-4 mr-2" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Financial Goal</DialogTitle>
              <DialogDescription>
                Set up a goal and get personalized investment recommendations
              </DialogDescription>
            </DialogHeader>
            <CreateGoalWizard onClose={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {activeGoals.length > 0 && (
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{totalProgress.toFixed(1)}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Active Goals</p>
                <p className="text-2xl font-bold">{activeGoals.length}</p>
              </div>
            </div>
            <Progress value={totalProgress} className="h-2 mt-3" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Goals ({activeGoals.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedGoals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activeGoals.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No goals yet</h3>
                <p className="text-muted-foreground mb-4">Start planning your financial future by creating your first goal</p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completedGoals.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No completed goals yet</h3>
                <p className="text-muted-foreground">Keep working on your active goals!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
