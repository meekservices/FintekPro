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
  CheckCircle,
  Shield,
  FileText,
  RefreshCw
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  creditLimit?: number;
  utilizationRate?: number;
  lastPayment?: string;
  paymentStatus?: string;
  bank?: string;
  accountType?: string;
  fromCibil?: boolean;
}

interface CibilReportData {
  creditScore?: number;
  creditGrade?: string;
  creditAccounts?: any[];
  creditUtilization?: any;
  paymentHistory?: any;
  reportId?: string;
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
      remainingPayments: 180,
      fromCibil: false
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
      remainingPayments: 36,
      fromCibil: false
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
      autoDebit: false,
      fromCibil: false
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
      autoDebit: false,
      fromCibil: false
    }
  ]);

  const [cibilData, setCibilData] = useState<CibilReportData | null>(null);
  const [userInfo, setUserInfo] = useState({
    fullName: "",
    mobileNumber: "",
    dateOfBirth: "",
    panNumber: "",
    email: ""
  });

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
  const [isCibilDialogOpen, setIsCibilDialogOpen] = useState(false);

  // CIBIL integration mutations
  const { mutate: getCreditScore, isPending: scorePending } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cibil/credit-score", data);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setCibilData(data.data);
        // Save credit score to localStorage
        if (data.data.creditScore) {
          localStorage.setItem('userCreditScore', data.data.creditScore.toString());
        }
        // Get detailed report automatically
        getDetailedReport({ reportId: data.data.reportId, userConsent: true });
      }
    }
  });

  const { mutate: getDetailedReport, isPending: reportPending } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cibil/detailed-report", data);
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setCibilData(prev => ({ ...prev, ...data.data }));
        syncCibilObligations(data.data);
      }
    }
  });

  const syncCibilObligations = (reportData: any) => {
    if (reportData.creditAccounts) {
      const cibilObligations: FinancialObligation[] = reportData.creditAccounts.map((account: any) => {
        // Calculate estimated EMI based on account type and balance
        let estimatedEMI = 0;
        if (account.accountType === "Personal Loan" || account.accountType === "Home Loan" || account.accountType === "Auto Loan") {
          // Estimate EMI as 3% of current balance (typical for loans)
          estimatedEMI = Math.round(account.currentBalance * 0.03);
        } else if (account.accountType === "Credit Card") {
          // Minimum payment for credit cards (typically 5% of outstanding)
          estimatedEMI = Math.round(account.currentBalance * 0.05);
        }

        const priority = account.paymentStatus === "30 Days Late" ? "critical" : 
                        account.currentBalance > account.creditLimit * 0.8 ? "important" : "important";

        return {
          id: account.accountId,
          name: `${account.accountType} - ${account.bank}`,
          type: account.accountType.toLowerCase().includes("loan") ? "loan" as const : 
                account.accountType === "Credit Card" ? "emi" as const : "other" as const,
          amount: estimatedEMI,
          frequency: "monthly" as const,
          dueDate: new Date(Date.now() + Math.floor(Math.random() * 25) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          priority: priority as "critical" | "important" | "optional",
          status: "active" as const,
          autoDebit: Math.random() > 0.5,
          creditLimit: account.creditLimit,
          utilizationRate: account.creditLimit > 0 ? Math.round((account.currentBalance / account.creditLimit) * 100) : 0,
          lastPayment: account.lastPayment,
          paymentStatus: account.paymentStatus,
          bank: account.bank,
          accountType: account.accountType,
          fromCibil: true
        };
      });

      // Replace CIBIL obligations and keep manual ones
      const manualObligations = obligations.filter(o => !o.fromCibil);
      setObligations([...manualObligations, ...cibilObligations]);
    }
  };

  const handleCibilSync = () => {
    if (!userInfo.fullName || !userInfo.mobileNumber || !userInfo.dateOfBirth || !userInfo.panNumber) {
      alert("Please fill in all required fields to sync with CIBIL");
      return;
    }
    
    getCreditScore(userInfo);
    setIsCibilDialogOpen(false);
  };

  const getCibilObligationsCount = () => {
    return obligations.filter(o => o.fromCibil).length;
  };

  const getTotalCibilDebt = () => {
    return obligations
      .filter(o => o.fromCibil && o.status === 'active')
      .reduce((sum, obligation) => {
        return sum + (obligation.creditLimit && obligation.utilizationRate ? 
          (obligation.creditLimit * obligation.utilizationRate / 100) : 0);
      }, 0);
  };

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
      autoDebit: newObligation.autoDebit,
      fromCibil: false
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
        
        <div className="flex gap-2">
          <Dialog open={isCibilDialogOpen} onOpenChange={setIsCibilDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-sync-cibil">
                <Shield className="w-4 h-4 mr-2" />
                Sync CIBIL Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Sync Credit Obligations from CIBIL</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <Shield className="w-4 h-4 inline mr-1" />
                    Securely fetch your credit obligations directly from your CIBIL report
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cibil-name">Full Name</Label>
                  <Input
                    id="cibil-name"
                    placeholder="Full name as per PAN card"
                    value={userInfo.fullName}
                    onChange={(e) => setUserInfo({...userInfo, fullName: e.target.value})}
                    data-testid="input-cibil-name"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cibil-mobile">Mobile Number</Label>
                    <Input
                      id="cibil-mobile"
                      placeholder="10-digit mobile"
                      value={userInfo.mobileNumber}
                      onChange={(e) => setUserInfo({...userInfo, mobileNumber: e.target.value})}
                      data-testid="input-cibil-mobile"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cibil-dob">Date of Birth</Label>
                    <Input
                      id="cibil-dob"
                      type="date"
                      value={userInfo.dateOfBirth}
                      onChange={(e) => setUserInfo({...userInfo, dateOfBirth: e.target.value})}
                      data-testid="input-cibil-dob"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cibil-pan">PAN Number</Label>
                    <Input
                      id="cibil-pan"
                      placeholder="ABCDE1234F"
                      value={userInfo.panNumber}
                      onChange={(e) => setUserInfo({...userInfo, panNumber: e.target.value.toUpperCase()})}
                      data-testid="input-cibil-pan"
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cibil-email">Email</Label>
                    <Input
                      id="cibil-email"
                      type="email"
                      placeholder="email@example.com"
                      value={userInfo.email}
                      onChange={(e) => setUserInfo({...userInfo, email: e.target.value})}
                      data-testid="input-cibil-email"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleCibilSync}
                  disabled={scorePending || reportPending}
                  className="w-full bg-finance-blue hover:bg-blue-700"
                  data-testid="button-fetch-cibil"
                >
                  {scorePending || reportPending ? "Fetching CIBIL Data..." : "Fetch Credit Obligations"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
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
      </div>

      {/* CIBIL Integration Status */}
      {cibilData && (
        <Card className="mb-6 border-blue-200 bg-blue-50" data-testid="card-cibil-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Shield className="w-5 h-5" />
              CIBIL Credit Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{cibilData.creditScore || 'N/A'}</div>
                <div className="text-sm text-gray-600">Credit Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{getCibilObligationsCount()}</div>
                <div className="text-sm text-gray-600">Credit Accounts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">₹{getTotalCibilDebt().toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Debt</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{cibilData.creditGrade || 'N/A'}</div>
                <div className="text-sm text-gray-600">Credit Grade</div>
              </div>
            </div>
            
            {cibilData.creditUtilization && (
              <div className="mt-4 p-3 bg-white rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Credit Utilization</span>
                  <span className="text-sm font-bold">{cibilData.creditUtilization.utilizationRatio}%</span>
                </div>
                <Progress value={cibilData.creditUtilization.utilizationRatio} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Used: ₹{cibilData.creditUtilization.totalUsed.toLocaleString()}</span>
                  <span>Limit: ₹{cibilData.creditUtilization.totalLimit.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-monthly-obligations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Monthly Obligations</p>
                <p className="text-2xl font-bold">{formatCurrency(getTotalMonthlyObligations())}</p>
                {getCibilObligationsCount() > 0 && (
                  <p className="text-xs text-blue-600">Including {getCibilObligationsCount()} from CIBIL</p>
                )}
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
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{obligation.name}</p>
                          {obligation.fromCibil && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              <Shield className="w-3 h-3 mr-1" />
                              CIBIL
                            </Badge>
                          )}
                        </div>
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
                  <div key={obligation.id} className={`flex items-center justify-between p-3 border rounded-lg ${
                    obligation.fromCibil ? 'border-blue-200 bg-blue-50' : ''
                  }`} data-testid={`obligation-${obligation.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        obligation.status === 'active' ? 'bg-green-100 text-green-600' :
                        obligation.status === 'upcoming' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{obligation.name}</p>
                          {obligation.fromCibil && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              <Shield className="w-3 h-3 mr-1" />
                              CIBIL
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={obligation.priority === 'critical' ? 'destructive' : obligation.priority === 'important' ? 'default' : 'secondary'} className="text-xs">
                            {obligation.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {obligation.frequency}
                          </Badge>
                          {obligation.paymentStatus && (
                            <Badge variant={obligation.paymentStatus === 'Current' ? 'default' : 'destructive'} className="text-xs">
                              {obligation.paymentStatus}
                            </Badge>
                          )}
                          {obligation.remainingPayments && (
                            <span className="text-xs text-muted-foreground">
                              {obligation.remainingPayments} payments left
                            </span>
                          )}
                        </div>
                        {obligation.fromCibil && obligation.creditLimit && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-gray-600 mb-1">
                              <span>Utilization: {obligation.utilizationRate}%</span>
                              <span>Limit: ₹{obligation.creditLimit.toLocaleString()}</span>
                            </div>
                            <Progress value={obligation.utilizationRate || 0} className="h-1" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(obligation.amount)}</p>
                      <p className="text-sm text-muted-foreground">
                        ({formatCurrency(monthlyAmount)}/month)
                      </p>
                      {obligation.lastPayment && (
                        <p className="text-xs text-gray-500">
                          Last: {new Date(obligation.lastPayment).toLocaleDateString()}
                        </p>
                      )}
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
            
            {cibilData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">CIBIL Insights</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Credit Score:</span>
                      <span className="font-bold">{cibilData.creditScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Credit Grade:</span>
                      <span className="font-bold">{cibilData.creditGrade}</span>
                    </div>
                    {cibilData.creditUtilization && (
                      <div className="flex justify-between">
                        <span>Utilization:</span>
                        <span className="font-bold">{cibilData.creditUtilization.utilizationRatio}%</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Recommendations</h4>
                  <div className="text-sm text-green-800 space-y-1">
                    {getTotalCibilDebt() > 0 && (
                      <p>• Focus on reducing high-utilization credit cards</p>
                    )}
                    <p>• Maintain on-time payments for all obligations</p>
                    <p>• Consider debt consolidation if beneficial</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground space-y-2">
              <p>💡 <strong>Recommendation:</strong> Ensure your emergency fund covers at least 6 months of obligations ({formatCurrency(getTotalMonthlyObligations() * 6)})</p>
              <p>📊 Consider setting up automatic investments after accounting for these fixed obligations</p>
              {getCibilObligationsCount() > 0 && (
                <p>🔗 <strong>CIBIL Integration:</strong> {getCibilObligationsCount()} obligations synced from your credit report</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}