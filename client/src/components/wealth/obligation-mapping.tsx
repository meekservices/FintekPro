import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Home, 
  GraduationCap, 
  Heart, 
  Car,
  Plus,
  Calendar,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface FinancialObligation {
  id: string;
  name: string;
  type: 'loan' | 'emi' | 'rent' | 'insurance' | 'subscription' | 'tax' | 'other';
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annually';
  dueDate: string;
  priority: 'critical' | 'important' | 'optional';
  status: 'active' | 'upcoming' | 'completed';
  autoDebit: boolean;
  remainingPayments?: number;
}

const obligationIcons = {
  loan: Home,
  emi: Car,
  rent: Home,
  insurance: CheckCircle,
  subscription: CreditCard,
  tax: DollarSign,
  other: AlertTriangle
};

export function ObligationMapping() {
  const [obligations, setObligations] = useState<FinancialObligation[]>([
    {
      id: "1",
      name: "Home Loan EMI",
      type: "loan",
      amount: 45000,
      frequency: "monthly",
      dueDate: "2025-09-05",
      priority: "critical",
      status: "active",
      autoDebit: true,
      remainingPayments: 180
    },
    {
      id: "2",
      name: "Car Loan EMI", 
      type: "emi",
      amount: 18000,
      frequency: "monthly",
      dueDate: "2025-09-10",
      priority: "important",
      status: "active",
      autoDebit: true,
      remainingPayments: 36
    },
    {
      id: "3",
      name: "Life Insurance Premium",
      type: "insurance", 
      amount: 24000,
      frequency: "annually",
      dueDate: "2025-12-15",
      priority: "important",
      status: "upcoming",
      autoDebit: false
    },
    {
      id: "4",
      name: "Income Tax (Q3)",
      type: "tax",
      amount: 75000,
      frequency: "quarterly", 
      dueDate: "2025-12-15",
      priority: "critical",
      status: "upcoming",
      autoDebit: false
    }
  ]);

  const [newObligation, setNewObligation] = useState({
    name: "",
    type: "other" as const,
    amount: "",
    frequency: "monthly" as const,
    dueDate: "",
    priority: "important" as const,
    autoDebit: false
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const calculateMonthlyEquivalent = (amount: number, frequency: string) => {
    switch (frequency) {
      case 'monthly': return amount;
      case 'quarterly': return amount / 3;
      case 'annually': return amount / 12;
      default: return amount;
    }
  };

  const getTotalMonthlyObligations = () => {
    return obligations
      .filter(o => o.status === 'active')
      .reduce((sum, obligation) => {
        return sum + calculateMonthlyEquivalent(obligation.amount, obligation.frequency);
      }, 0);
  };

  const getObligationsByType = () => {
    const types = obligations.reduce((acc, obligation) => {
      const monthlyAmount = calculateMonthlyEquivalent(obligation.amount, obligation.frequency);
      if (obligation.status === 'active') {
        acc[obligation.type] = (acc[obligation.type] || 0) + monthlyAmount;
      }
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(types).map(([type, amount]) => ({
      type: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      amount
    }));
  };

  const handleAddObligation = () => {
    if (!newObligation.name || !newObligation.amount || !newObligation.dueDate) return;

    const obligation: FinancialObligation = {
      id: Date.now().toString(),
      name: newObligation.name,
      type: newObligation.type,
      amount: parseInt(newObligation.amount),
      frequency: newObligation.frequency,
      dueDate: newObligation.dueDate,
      priority: newObligation.priority,
      status: "active",
      autoDebit: newObligation.autoDebit
    };

    setObligations([...obligations, obligation]);
    setNewObligation({
      name: "",
      type: "other",
      amount: "",
      frequency: "monthly",
      dueDate: "",
      priority: "important",
      autoDebit: false
    });
    setIsDialogOpen(false);
  };

  const getUpcomingPayments = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return obligations.filter(obligation => {
      const dueDate = new Date(obligation.dueDate);
      return dueDate >= now && dueDate <= thirtyDaysFromNow;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Financial Obligation Mapping</h2>
          <p className="text-muted-foreground">Track and manage your financial commitments and recurring expenses</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-obligation">
              <Plus className="w-4 h-4 mr-2" />
              Add Obligation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Financial Obligation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="obligation-name">Obligation Name</Label>
                <Input
                  id="obligation-name"
                  data-testid="input-obligation-name"
                  placeholder="e.g., Home Loan EMI, Insurance Premium"
                  value={newObligation.name}
                  onChange={(e) => setNewObligation({...newObligation, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="obligation-type">Type</Label>
                  <Select value={newObligation.type} onValueChange={(value: any) => setNewObligation({...newObligation, type: value})}>
                    <SelectTrigger data-testid="select-obligation-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="emi">EMI</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="tax">Tax</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="obligation-frequency">Frequency</Label>
                  <Select value={newObligation.frequency} onValueChange={(value: any) => setNewObligation({...newObligation, frequency: value})}>
                    <SelectTrigger data-testid="select-obligation-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="obligation-amount">Amount (₹)</Label>
                  <Input
                    id="obligation-amount"
                    data-testid="input-obligation-amount"
                    type="number"
                    placeholder="25000"
                    value={newObligation.amount}
                    onChange={(e) => setNewObligation({...newObligation, amount: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="obligation-due-date">Next Due Date</Label>
                  <Input
                    id="obligation-due-date"
                    data-testid="input-obligation-due-date"
                    type="date"
                    value={newObligation.dueDate}
                    onChange={(e) => setNewObligation({...newObligation, dueDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obligation-priority">Priority</Label>
                <Select value={newObligation.priority} onValueChange={(value: any) => setNewObligation({...newObligation, priority: value})}>
                  <SelectTrigger data-testid="select-obligation-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAddObligation} className="w-full" data-testid="button-create-obligation">
                Add Obligation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-monthly-obligations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Monthly Obligations</p>
                <p className="text-2xl font-bold">{formatCurrency(getTotalMonthlyObligations())}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-obligations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Obligations</p>
                <p className="text-2xl font-bold">{obligations.filter(o => o.status === 'active').length}</p>
              </div>
              <CreditCard className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-payments">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming Payments</p>
                <p className="text-2xl font-bold">{getUpcomingPayments().length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-auto-debit-enabled">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Auto-Debit Enabled</p>
                <p className="text-2xl font-bold">{obligations.filter(o => o.autoDebit).length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payments */}
      {getUpcomingPayments().length > 0 && (
        <Card data-testid="card-upcoming-payments-list">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Upcoming Payments (Next 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getUpcomingPayments().map((obligation) => {
                const Icon = obligationIcons[obligation.type];
                const daysUntilDue = Math.ceil((new Date(obligation.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={obligation.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg" data-testid={`upcoming-payment-${obligation.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        obligation.priority === 'critical' ? 'bg-red-100 text-red-600' :
                        obligation.priority === 'important' ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{obligation.name}</p>
                        <p className="text-sm text-muted-foreground">Due in {daysUntilDue} days</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(obligation.amount)}</p>
                      {obligation.autoDebit && (
                        <Badge variant="outline" className="text-xs">Auto-debit</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Obligations by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-obligations-by-category">
          <CardHeader>
            <CardTitle>Obligations by Category</CardTitle>
            <CardDescription>Monthly breakdown of your financial commitments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getObligationsByType().map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="font-medium">{category.type}</span>
                  <span className="text-lg font-bold">{formatCurrency(category.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Obligations List */}
        <Card data-testid="card-all-obligations">
          <CardHeader>
            <CardTitle>All Obligations</CardTitle>
            <CardDescription>Complete list of your financial commitments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {obligations.map((obligation) => {
                const Icon = obligationIcons[obligation.type];
                const monthlyAmount = calculateMonthlyEquivalent(obligation.amount, obligation.frequency);
                
                return (
                  <div key={obligation.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`obligation-${obligation.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        obligation.status === 'active' ? 'bg-green-100 text-green-600' :
                        obligation.status === 'upcoming' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium">{obligation.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={obligation.priority === 'critical' ? 'destructive' : obligation.priority === 'important' ? 'default' : 'secondary'} className="text-xs">
                            {obligation.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {obligation.frequency}
                          </Badge>
                          {obligation.remainingPayments && (
                            <span className="text-xs text-muted-foreground">
                              {obligation.remainingPayments} payments left
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(obligation.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        ({formatCurrency(monthlyAmount)}/month)
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Impact */}
      <Card data-testid="card-cash-flow-impact">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Monthly Cash Flow Impact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <span className="font-medium">Total Monthly Outflow</span>
              <span className="text-2xl font-bold text-red-600">{formatCurrency(getTotalMonthlyObligations())}</span>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-2">
              <p>💡 <strong>Recommendation:</strong> Ensure your emergency fund covers at least 6 months of obligations ({formatCurrency(getTotalMonthlyObligations() * 6)})</p>
              <p>📊 Consider setting up automatic investments after accounting for these fixed obligations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}