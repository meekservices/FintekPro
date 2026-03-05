import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from '@/components/ScrollableTabsList';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Sparkles,
  PieChart,
  AlertCircle,
  Filter,
  Download,
  Trash2,
  Edit,
  Receipt
} from 'lucide-react';

const expenseCategories = [
  'food_dining',
  'transportation',
  'shopping',
  'entertainment',
  'utilities',
  'healthcare',
  'education',
  'travel',
  'groceries',
  'rent',
  'insurance',
  'investment',
  'other'
];

const budgetPeriods = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const expenseFormSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  description: z.string().min(1, 'Description is required'),
  transactionDate: z.string().min(1, 'Date is required'),
  category: z.string().optional(),
  merchantName: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const budgetFormSchema = z.object({
  budgetName: z.string().min(1, 'Budget name is required'),
  category: z.string().min(1, 'Category is required'),
  budgetAmount: z.string().min(1, 'Budget amount is required'),
  period: z.string().min(1, 'Period is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  alertThreshold: z.string().optional(),
});

export default function ExpensesBudgetsPage() {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);

  // Fetch expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['/api/expenses'],
    select: (data: any) => Array.isArray(data) ? data : (data?.expenses || []),
  });

  // Fetch budgets
  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['/api/budgets'],
    select: (data: any) => Array.isArray(data) ? data : (data?.budgets || []),
  });

  // Fetch category summary
  const { data: categoryData = [], isLoading: categoryLoading } = useQuery({
    queryKey: ['/api/expenses/by-category'],
    select: (data: any) => Array.isArray(data) ? data : (data?.categories || []),
  });

  // Fetch insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ['/api/insights'],
    select: (data: any) => Array.isArray(data) ? data : (data?.insights || []),
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/budgets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/by-category'] });
      toast({ title: 'Success', description: 'Expense added successfully' });
      setExpenseDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add expense', variant: 'destructive' });
    },
  });

  // Create budget mutation
  const createBudgetMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/budgets', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets'] });
      toast({ title: 'Success', description: 'Budget created successfully' });
      setBudgetDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create budget', variant: 'destructive' });
    },
  });

  // Generate insights mutation
  const generateInsightsMutation = useMutation({
    mutationFn: async () => apiRequest('/api/insights/generate', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      toast({ title: 'Success', description: 'AI insights generated successfully' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate insights', variant: 'destructive' });
    },
  });

  const expenseForm = useForm({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      amount: '',
      description: '',
      transactionDate: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      merchantName: '',
      paymentMethod: '',
      notes: '',
    },
  });

  const budgetForm = useForm({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      budgetName: '',
      category: '',
      budgetAmount: '',
      period: 'monthly',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      alertThreshold: '80',
    },
  });

  const handleExpenseSubmit = (data: any) => {
    createExpenseMutation.mutate({
      ...data,
      amount: parseFloat(data.amount),
    });
  };

  const handleBudgetSubmit = (data: any) => {
    createBudgetMutation.mutate({
      ...data,
      budgetAmount: parseFloat(data.budgetAmount),
      alertThreshold: data.alertThreshold ? parseFloat(data.alertThreshold) : undefined,
    });
  };

  const filteredExpenses = selectedCategory === 'all' 
    ? expenses 
    : (expenses as any[]).filter((e: any) => e.category === selectedCategory);

  const totalSpent = (expenses as any[]).reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
  const totalBudget = (budgets as any[]).reduce((sum: number, b: any) => sum + parseFloat(b.budgetAmount || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Expenses & Budgets
          </h1>
          <p className="text-muted-foreground">Track your spending with AI-powered insights</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-expense">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
              </DialogHeader>
              <Form {...expenseForm}>
                <form onSubmit={expenseForm.handleSubmit(handleExpenseSubmit)} className="space-y-4">
                  <FormField
                    control={expenseForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1500.00" data-testid="input-amount" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Lunch at restaurant" data-testid="input-description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="transactionDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category (AI will suggest if empty)</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-category">
                              <SelectValue placeholder="Let AI categorize" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {expenseCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.replace('_', ' ').toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="merchantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Merchant (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Swiggy" data-testid="input-merchant" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method (Optional)</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="debit_card">Debit Card</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="net_banking">Net Banking</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={expenseForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Additional details..." data-testid="input-notes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createExpenseMutation.isPending}
                    data-testid="button-submit-expense"
                  >
                    {createExpenseMutation.isPending ? 'Adding...' : 'Add Expense'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-budget">
                <PieChart className="h-4 w-4 mr-2" />
                Create Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Budget</DialogTitle>
              </DialogHeader>
              <Form {...budgetForm}>
                <form onSubmit={budgetForm.handleSubmit(handleBudgetSubmit)} className="space-y-4">
                  <FormField
                    control={budgetForm.control}
                    name="budgetName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Monthly Food Budget" data-testid="input-budget-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={budgetForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-budget-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {expenseCategories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat.replace('_', ' ').toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={budgetForm.control}
                    name="budgetAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Amount (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="15000.00" data-testid="input-budget-amount" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={budgetForm.control}
                    name="period"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-budget-period">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {budgetPeriods.map((period) => (
                              <SelectItem key={period} value={period}>
                                {period.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={budgetForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-budget-start-date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={budgetForm.control}
                    name="alertThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alert Threshold (%)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="80" data-testid="input-alert-threshold" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={createBudgetMutation.isPending}
                    data-testid="button-submit-budget"
                  >
                    {createBudgetMutation.isPending ? 'Creating...' : 'Create Budget'}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-spent">₹{totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-budget">₹{totalBudget.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">{(budgets as any[]).length} active budgets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBudget - totalSpent < 0 ? 'text-red-500' : ''}`} data-testid="text-remaining">
              ₹{(totalBudget - totalSpent).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% used` : 'No budgets set'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="expenses" className="space-y-4">
        <ScrollableTabsList>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
          <TabsTrigger value="budgets" data-testid="tab-budgets">Budgets</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            AI Insights
            {(insights as any[]).length > 0 && (
              <Badge className="ml-2" variant="secondary">{(insights as any[]).length}</Badge>
            )}
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="expenses" className="space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/bbps'}
              className="gap-2"
              data-testid="button-pay-bills"
            >
              <Receipt className="h-4 w-4" />
              Pay Utility Bills (BBPS)
            </Button>
          </div>

          {/* Category Filter */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Recent Expenses</CardTitle>
                  <CardDescription>{(filteredExpenses as any[]).length} transactions</CardDescription>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-category">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (filteredExpenses as any[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No expenses found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(filteredExpenses as any[]).map((expense: any) => (
                    <div key={expense.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors" data-testid={`expense-item-${expense.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium" data-testid={`text-expense-description-${expense.id}`}>{expense.description}</h4>
                          {expense.isBbpsPayment && (
                            <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              <Receipt className="h-3 w-3 mr-1" />
                              BBPS
                            </Badge>
                          )}
                          {expense.aiCategorized && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span data-testid={`text-expense-category-${expense.id}`}>{(expense.category || 'other').replace('_', ' ').toUpperCase()}</span>
                          <span>•</span>
                          <span>{format(new Date(expense.transactionDate), 'MMM dd, yyyy')}</span>
                          {expense.merchantName && (
                            <>
                              <span>•</span>
                              <span>{expense.merchantName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold" data-testid={`text-expense-amount-${expense.id}`}>
                          ₹{parseFloat(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        {expense.paymentMethod && (
                          <div className="text-xs text-muted-foreground">{expense.paymentMethod.replace('_', ' ').toUpperCase()}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-4">
          {budgetsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : (budgets as any[]).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">No budgets created yet</p>
                <Button className="mt-4" onClick={() => setBudgetDialogOpen(true)} data-testid="button-create-first-budget">
                  Create Your First Budget
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(budgets as any[]).map((budget: any) => {
                const spent = parseFloat(budget.currentSpend || 0);
                const total = parseFloat(budget.budgetAmount);
                const percentage = Math.min((spent / total) * 100, 100);
                const alertThreshold = budget.alertThreshold ? parseFloat(budget.alertThreshold) : 80;
                const isOverBudget = spent > total;
                const isNearLimit = percentage >= alertThreshold;

                return (
                  <Card key={budget.id} data-testid={`budget-card-${budget.id}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-budget-name-${budget.id}`}>{budget.budgetName}</CardTitle>
                          <CardDescription data-testid={`text-budget-category-${budget.id}`}>
                            {(budget.category || 'general').replace('_', ' ').toUpperCase()} • {(budget.period || 'monthly').toUpperCase()}
                          </CardDescription>
                        </div>
                        {isOverBudget && (
                          <Badge variant="destructive">Over Budget</Badge>
                        )}
                        {!isOverBudget && isNearLimit && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Alert
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Spent</span>
                        <span className={isOverBudget ? 'text-red-500 font-semibold' : ''} data-testid={`text-budget-spent-${budget.id}`}>
                          ₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className={isOverBudget ? 'bg-red-100 dark:bg-red-900/30' : isNearLimit ? 'bg-orange-100 dark:bg-orange-900/30' : ''} 
                      />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{Math.round(percentage)}% used</span>
                        <span data-testid={`text-budget-total-${budget.id}`}>of ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>AI-Powered Insights</CardTitle>
                  <CardDescription>Smart recommendations based on your spending</CardDescription>
                </div>
                <Button 
                  onClick={() => generateInsightsMutation.mutate()} 
                  disabled={generateInsightsMutation.isPending}
                  data-testid="button-generate-insights"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generateInsightsMutation.isPending ? 'Generating...' : 'Generate Insights'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : (insights as any[]).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No insights available</p>
                  <p className="text-sm mt-2">Click "Generate Insights" to analyze your spending</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(insights as any[]).map((insight: any) => (
                    <Card key={insight.id} className={`${
                      insight.priority === 'high' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30/50' : 
                      insight.priority === 'medium' ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30/50' : 
                      'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30/50'
                    }`} data-testid={`insight-card-${insight.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base" data-testid={`text-insight-title-${insight.id}`}>{insight.title}</CardTitle>
                              <Badge variant={
                                insight.priority === 'high' ? 'destructive' : 
                                insight.priority === 'medium' ? 'default' : 
                                'secondary'
                              }>
                                {insight.priority?.toUpperCase()}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1" data-testid={`text-insight-description-${insight.id}`}>
                              {insight.description}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {insight.aiAnalysis && (
                          <div className="text-sm mb-3 p-3 bg-card/80 rounded-md">
                            <strong>AI Analysis:</strong> {insight.aiAnalysis}
                          </div>
                        )}
                        {insight.recommendations && insight.recommendations.length > 0 && (
                          <div className="text-sm">
                            <strong>Recommendations:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {insight.recommendations.map((rec: string, idx: number) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {insight.potentialSavings && (
                          <div className="mt-3 p-2 bg-green-100 dark:bg-green-900/30 rounded-md text-sm font-semibold text-green-700 dark:text-green-300">
                            Potential Savings: ₹{parseFloat(insight.potentialSavings).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
