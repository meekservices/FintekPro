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
  ArrowRight, Sparkles, PieChart, Trophy, Flag, ChevronRight, Eye, Trash2,
  TrendingDown, Clock
} from "lucide-react";
import { format, differenceInMonths, addMonths } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart as RechartsPie, Pie, Cell } from "recharts";

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

interface GoalMilestone {
  id: string;
  name: string;
  description?: string;
  targetPercentage: string;
  targetAmount: string;
  targetDate: string;
  isAchieved: boolean;
  achievedAt?: string;
  celebrationType?: string;
}

interface GoalDetails {
  goal: any;
  milestones: GoalMilestone[];
  investments: any[];
  projection: {
    currentValue: number;
    projectedValue: number;
    targetAmount: number;
    progressPercentage: number;
    onTrackStatus: string;
    shortfall: number;
    additionalSipNeeded: number;
  };
}

const ALLOCATION_COLORS = ["#22c55e", "#3b82f6", "#eab308", "#9ca3af"];

function generateProjectionData(goal: any) {
  const data = [];
  const now = new Date();
  const targetDate = new Date(goal.targetDate);
  const totalMonths = Math.max(1, differenceInMonths(targetDate, now));
  const monthlyRate = parseFloat(goal.expectedReturnRate || "10") / 100 / 12;
  const currentAmount = parseFloat(goal.currentAmount || "0");
  const sipAmount = parseFloat(goal.suggestedSipAmount || "0");
  const targetAmount = parseFloat(goal.inflationAdjustedTarget || goal.targetAmount || "0");
  
  const intervals = Math.min(12, totalMonths);
  const stepSize = Math.floor(totalMonths / intervals);
  
  for (let i = 0; i <= intervals; i++) {
    const month = i * stepSize;
    const date = addMonths(now, month);
    
    let projectedValue = currentAmount * Math.pow(1 + monthlyRate, month);
    if (monthlyRate > 0 && month > 0) {
      projectedValue += sipAmount * (Math.pow(1 + monthlyRate, month) - 1) / monthlyRate;
    } else {
      projectedValue += sipAmount * month;
    }
    
    const targetProgress = (targetAmount / totalMonths) * month;
    
    data.push({
      month: format(date, "MMM yy"),
      projected: Math.round(projectedValue),
      target: Math.round(targetProgress + (targetAmount / totalMonths) * month * 0.1),
    });
  }
  
  return data;
}

const investmentLinkFormSchema = z.object({
  investmentType: z.string().min(1, "Investment type is required"),
  investmentName: z.string().min(1, "Investment name is required"),
  currentValue: z.string().min(1, "Current value is required"),
  monthlyContribution: z.string().optional(),
  allocationPercentage: z.string().optional(),
});

function InvestmentLinkingSection({ goalId, investments }: { goalId: string; investments: any[] }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(investmentLinkFormSchema),
    defaultValues: {
      investmentType: "",
      investmentName: "",
      currentValue: "",
      monthlyContribution: "",
      allocationPercentage: "100",
    },
  });

  const addInvestmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/goals/${goalId}/investments`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals", goalId] });
      toast({ title: "Investment Linked", description: "Investment has been linked to this goal." });
      setShowAddForm(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const unlinkInvestmentMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await apiRequest("DELETE", `/api/goals/${goalId}/investments/${linkId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals", goalId] });
      toast({ title: "Investment Unlinked", description: "Investment has been removed from this goal." });
    },
  });

  const investmentTypes = [
    { value: "mutual_fund_sip", label: "Mutual Fund SIP" },
    { value: "mutual_fund_lumpsum", label: "Mutual Fund Lumpsum" },
    { value: "stocks", label: "Stocks" },
    { value: "ppf", label: "PPF" },
    { value: "nps", label: "NPS" },
    { value: "fd", label: "Fixed Deposit" },
    { value: "rd", label: "Recurring Deposit" },
    { value: "gold", label: "Gold / SGB" },
    { value: "real_estate", label: "Real Estate" },
    { value: "other", label: "Other" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Linked Investments
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-investment">
            <Plus className="h-4 w-4 mr-1" />
            Link Investment
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAddForm && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => addInvestmentMutation.mutate(data))} className="space-y-3 mb-4 p-3 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="investmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Investment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-investment-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {investmentTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="investmentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., HDFC Flexi Cap" {...field} data-testid="input-investment-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="currentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Current Value (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-investment-value" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthlyContribution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Monthly SIP (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} data-testid="input-monthly-contribution" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addInvestmentMutation.isPending} data-testid="button-save-investment">
                  {addInvestmentMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        )}

        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No investments linked yet. Link your SIPs and investments to track progress.
          </p>
        ) : (
          <div className="space-y-2">
            {investments.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50" data-testid={`investment-link-${inv.id}`}>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{inv.investmentName}</p>
                    <p className="text-xs text-muted-foreground">{(inv.investmentType || 'investment').replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(inv.currentValue)}</p>
                    {inv.monthlyContribution && parseFloat(inv.monthlyContribution) > 0 && (
                      <p className="text-xs text-primary">{formatCurrency(inv.monthlyContribution)}/mo</p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => unlinkInvestmentMutation.mutate(inv.id)}
                    disabled={unlinkInvestmentMutation.isPending}
                    data-testid={`button-unlink-${inv.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalDetailDialog({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const { toast } = useToast();
  
  const { data: details, isLoading } = useQuery<GoalDetails>({
    queryKey: ["/api/goals", goalId],
    enabled: !!goalId,
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/goals/${goalId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user/central-test-user"] });
      toast({ title: "Goal Deleted", description: "Your goal has been removed." });
      onClose();
    },
  });

  const completeGoalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/goals/${goalId}/complete`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user/central-test-user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/goals", goalId] });
      toast({ title: "Congratulations!", description: "Your goal has been marked as complete!" });
    },
  });

  if (isLoading || !details) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { goal, milestones, projection } = details;
  const category = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
  const IconComponent = category.icon;
  const chartData = generateProjectionData(goal);
  
  const allocation = goal.suggestedAllocation || { equity: 60, debt: 30, gold: 7, cash: 3 };
  const allocationData = [
    { name: "Equity", value: allocation.equity },
    { name: "Debt", value: allocation.debt },
    { name: "Gold", value: allocation.gold },
    { name: "Cash", value: allocation.cash },
  ].filter(d => d.value > 0);

  const statusColors: Record<string, string> = {
    on_track: "text-green-600 dark:text-green-400",
    ahead: "text-blue-600 dark:text-blue-400",
    behind: "text-yellow-600 dark:text-yellow-400",
    at_risk: "text-red-600 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div 
          className="p-3 rounded-xl" 
          style={{ backgroundColor: `${category.color}20` }}
        >
          <IconComponent className="h-8 w-8" style={{ color: category.color }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{goal.name}</h2>
          <p className="text-muted-foreground">{category.name}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={`${statusColors[projection.onTrackStatus]} bg-opacity-20`}>
              {projection.onTrackStatus === "ahead" && <TrendingUp className="h-3 w-3 mr-1" />}
              {projection.onTrackStatus === "behind" && <TrendingDown className="h-3 w-3 mr-1" />}
              {projection.onTrackStatus === "at_risk" && <AlertTriangle className="h-3 w-3 mr-1" />}
              {(projection.onTrackStatus || 'on_track').replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(goal.targetDate), "dd MMM yyyy")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold">{formatCurrency(goal.currentAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="text-lg font-bold">{formatCurrency(goal.targetAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Monthly SIP</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(goal.suggestedSipAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="text-lg font-bold">{projection.progressPercentage.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Projected Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64" data-testid="projection-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis 
                  tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} 
                  tick={{ fontSize: 11 }} 
                  className="text-muted-foreground"
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="projected" 
                  stroke="#22c55e" 
                  fill="#22c55e" 
                  fillOpacity={0.2} 
                  name="Projected Value"
                />
                <Area 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.1} 
                  strokeDasharray="5 5"
                  name="Target Path"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground">No milestones defined</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone, idx) => (
                  <div 
                    key={milestone.id} 
                    className={`flex items-start gap-3 p-2 rounded-lg ${
                      milestone.isAchieved ? "bg-green-50 dark:bg-green-950" : "bg-muted/50"
                    }`}
                    data-testid={`milestone-${milestone.id}`}
                  >
                    <div className={`mt-0.5 p-1 rounded-full ${
                      milestone.isAchieved ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}>
                      {milestone.isAchieved ? (
                        <CheckCircle2 className="h-4 w-4 text-foreground" />
                      ) : (
                        <Flag className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${milestone.isAchieved ? "text-green-700 dark:text-green-300" : ""}`}>
                        {milestone.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatCurrency(milestone.targetAmount)}</span>
                        <span>•</span>
                        <span>{format(new Date(milestone.targetDate), "MMM yyyy")}</span>
                      </div>
                      {milestone.isAchieved && milestone.achievedAt && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Achieved on {format(new Date(milestone.achievedAt), "dd MMM yyyy")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Asset Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {allocationData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value}%`} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {allocationData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: ALLOCATION_COLORS[index] }}
                  />
                  <span>{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {projection.shortfall > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Projected Shortfall</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  You may fall short by {formatCurrency(projection.shortfall)}. 
                  Consider increasing your SIP by {formatCurrency(projection.additionalSipNeeded)}/month.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <InvestmentLinkingSection goalId={goalId} investments={details.investments} />

      <div className="flex justify-between pt-2">
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => deleteGoalMutation.mutate()}
          disabled={deleteGoalMutation.isPending}
          data-testid="button-delete-goal"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
        {!goal.isCompleted && projection.progressPercentage >= 100 && (
          <Button 
            onClick={() => completeGoalMutation.mutate()}
            disabled={completeGoalMutation.isPending}
            data-testid="button-complete-goal"
          >
            <Trophy className="h-4 w-4 mr-1" />
            Mark Complete
          </Button>
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal, onClick }: { goal: any; onClick: () => void }) {
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
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer group" 
      data-testid={`goal-card-${goal.id}`}
      onClick={onClick}
    >
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
              <CardTitle className="text-lg flex items-center gap-1">
                {goal.name}
                <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </CardTitle>
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
      const userId = "central-test-user";
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
      queryClient.invalidateQueries({ queryKey: ["/api/goals/user/central-test-user"] });
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
                            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
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

function SmartAlertsSection({ goals, onViewGoal }: { goals: any[]; onViewGoal: (id: string) => void }) {
  const alertGoals = goals.filter(g => 
    !g.isCompleted && (g.onTrackStatus === "behind" || g.onTrackStatus === "at_risk")
  );

  if (alertGoals.length === 0) return null;

  const getAlertConfig = (status: string) => {
    if (status === "at_risk") {
      return {
        bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        title: "At Risk",
        color: "text-red-800 dark:text-red-200",
      };
    }
    return {
      bg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800",
      icon: <TrendingDown className="h-5 w-5 text-yellow-600" />,
      title: "Behind Schedule",
      color: "text-yellow-800 dark:text-yellow-200",
    };
  };

  const getRecommendation = (goal: any) => {
    const progress = parseFloat(goal.currentProgress || "0");
    const suggestedSip = parseFloat(goal.suggestedSipAmount || "0");
    const monthsToTarget = Math.max(1, differenceInMonths(new Date(goal.targetDate), new Date()));
    
    if (progress < 10 && monthsToTarget > 12) {
      return `Start investing ${formatCurrency(suggestedSip)}/month to get on track.`;
    } else if (goal.onTrackStatus === "at_risk") {
      const increasedSip = Math.ceil(suggestedSip * 1.3);
      return `Consider increasing SIP to ${formatCurrency(increasedSip)}/month or adding a lumpsum.`;
    } else {
      const increasedSip = Math.ceil(suggestedSip * 1.15);
      return `Increase SIP by 15% to ${formatCurrency(increasedSip)}/month to catch up.`;
    }
  };

  return (
    <Card className="mb-6 border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <AlertTriangle className="h-4 w-4" />
          Smart Alerts ({alertGoals.length})
        </CardTitle>
        <CardDescription>Goals that need your attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertGoals.map((goal) => {
            const config = getAlertConfig(goal.onTrackStatus);
            const category = GOAL_CATEGORIES[goal.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
            const IconComponent = category.icon;
            
            return (
              <div 
                key={goal.id} 
                className={`p-3 rounded-lg border ${config.bg} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => onViewGoal(goal.id)}
                data-testid={`alert-goal-${goal.id}`}
              >
                <div className="flex items-start gap-3">
                  {config.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <IconComponent className="h-4 w-4" style={{ color: category.color }} />
                      <span className={`font-medium ${config.color}`}>{goal.name}</span>
                      <Badge variant="outline" className="text-xs">{config.title}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Progress: {parseFloat(goal.currentProgress || "0").toFixed(1)}% | 
                      Target: {format(new Date(goal.targetDate), "MMM yyyy")}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-primary font-medium">Recommendation:</span>
                      <span>{getRecommendation(goal)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoalsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const userId = "central-test-user";

  const { data: goals, isLoading } = useQuery<any[]>({
    queryKey: ["/api/goals/user", userId],
  });

  const activeGoals = goals?.filter(g => !g.isCompleted) || [];
  const completedGoals = goals?.filter(g => g.isCompleted) || [];

  const totalProgress = activeGoals.length > 0
    ? activeGoals.reduce((sum, g) => sum + parseFloat(g.currentProgress || "0"), 0) / activeGoals.length
    : 0;
  
  const totalTarget = activeGoals.reduce((sum, g) => sum + parseFloat(g.targetAmount || "0"), 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + parseFloat(g.currentAmount || "0"), 0);

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Overall Progress</p>
                <p className="text-2xl font-bold">{totalProgress.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Goals</p>
                <p className="text-2xl font-bold">{activeGoals.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Target</p>
                <p className="text-2xl font-bold">{formatCurrency(totalTarget)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCurrent)}</p>
              </div>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <SmartAlertsSection goals={activeGoals} onViewGoal={setSelectedGoalId} />

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
                <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoalId(goal.id)} />
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
                <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoalId(goal.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedGoalId} onOpenChange={(open) => !open && setSelectedGoalId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Goal Details</DialogTitle>
            <DialogDescription>
              Track your progress, milestones, and projected growth
            </DialogDescription>
          </DialogHeader>
          {selectedGoalId && (
            <GoalDetailDialog goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
