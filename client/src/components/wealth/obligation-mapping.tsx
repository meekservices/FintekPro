import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Home, 
  GraduationCap, 
  Heart, 
  Car,
  Plus,
  Calendar,
  IndianRupee,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Shield,
  FileText,
  RefreshCw,
  Trash2,
  Loader2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FinancialObligation } from "@shared/schema";

interface CibilReportData {
  creditScore?: number;
  creditGrade?: string;
  creditAccounts?: any[];
  creditUtilization?: any;
  paymentHistory?: any;
  reportId?: string;
}

const obligationIcons: Record<string, any> = {
  loan: Home,
  emi: Car,
  rent: Home,
  insurance: CheckCircle,
  subscription: CreditCard,
  tax: IndianRupee,
  other: AlertTriangle
};

export function ObligationMapping() {
  const { toast } = useToast();

  const { data: obligations = [], isLoading, refetch } = useQuery<FinancialObligation[]>({
    queryKey: ['/api/financial-obligations'],
  });

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

  const createObligationMutation = useMutation({
    mutationFn: async (data: Partial<FinancialObligation>) => {
      return apiRequest('/api/financial-obligations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-obligations'] });
      toast({
        title: "Obligation added",
        description: "Your financial obligation has been added successfully.",
      });
      setIsDialogOpen(false);
      setNewObligation({
        name: "",
        type: "other",
        amount: "",
        frequency: "monthly",
        dueDate: "",
        priority: "important",
        autoDebit: false
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add obligation",
        variant: "destructive",
      });
    },
  });

  const deleteObligationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/financial-obligations/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-obligations'] });
      toast({
        title: "Obligation deleted",
        description: "Your financial obligation has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete obligation",
        variant: "destructive",
      });
    },
  });

  const { mutate: getCreditScore, isPending: scorePending } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/cibil/credit-score", {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setCibilData(data.data);
        if (data.data.creditScore) {
          localStorage.setItem('userCreditScore', data.data.creditScore.toString());
        }
        getDetailedReport({ reportId: data.data.reportId, userConsent: true });
      }
    }
  });

  const { mutate: getDetailedReport, isPending: reportPending } = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/cibil/detailed-report", {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setCibilData(prev => ({ ...prev, ...data.data }));
        syncCibilObligations(data.data);
      }
    }
  });

  const syncCibilMutation = useMutation({
    mutationFn: async (cibilAccounts: any[]) => {
      return apiRequest('/api/financial-obligations/sync-cibil', {
        method: 'POST',
        body: JSON.stringify({ cibilAccounts }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-obligations'] });
      toast({
        title: "CIBIL synced",
        description: `Successfully imported ${data.synced || 0} credit obligations from CIBIL.`,
      });
    },
    onError: (error: any) => {
      console.error("CIBIL sync error:", error);
      toast({
        title: "Sync failed",
        description: error.userMessage || error.message || "Failed to sync CIBIL data. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncCibilObligations = (reportData: any) => {
    if (reportData.creditAccounts && reportData.creditAccounts.length > 0) {
      syncCibilMutation.mutate(reportData.creditAccounts);
    }
  };

  const handleCibilSync = () => {
    if (!userInfo.fullName || !userInfo.mobileNumber || !userInfo.dateOfBirth || !userInfo.panNumber) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields to sync with CIBIL",
        variant: "destructive",
      });
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
          (Number(obligation.creditLimit) * Number(obligation.utilizationRate) / 100) : 0);
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
        return sum + calculateMonthlyEquivalent(Number(obligation.amount), obligation.frequency);
      }, 0);
  };

  const getObligationsByType = () => {
    const types = obligations.reduce((acc, obligation) => {
      const monthlyAmount = calculateMonthlyEquivalent(Number(obligation.amount), obligation.frequency);
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
    if (!newObligation.name || !newObligation.amount || !newObligation.dueDate) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(newObligation.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    const dueDateFormatted = new Date(newObligation.dueDate).toISOString().split('T')[0];

    createObligationMutation.mutate({
      name: newObligation.name.trim(),
      type: newObligation.type,
      amount: amountNum.toString(),
      frequency: newObligation.frequency,
      dueDate: dueDateFormatted,
      priority: newObligation.priority,
      status: "active",
      autoDebit: newObligation.autoDebit,
      fromCibil: false
    });
  };

  const handleDeleteObligation = (id: string) => {
    deleteObligationMutation.mutate(id);
  };

  const getUpcomingPayments = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return obligations.filter(obligation => {
      const dueDate = new Date(obligation.dueDate);
      return dueDate >= now && dueDate <= thirtyDaysFromNow;
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

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
                  {scorePending || reportPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Fetching CIBIL Data...
                    </>
                  ) : "Fetch Credit Obligations"}
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

                <Button 
                  onClick={handleAddObligation} 
                  className="w-full" 
                  data-testid="button-create-obligation"
                  disabled={createObligationMutation.isPending}
                >
                  {createObligationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : "Add Obligation"}
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

      {/* Empty State */}
      {obligations.length === 0 && (
        <Card className="border-dashed" data-testid="card-empty-state">
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No obligations yet</h3>
            <p className="text-muted-foreground mb-4">
              Start tracking your financial commitments by adding an obligation or syncing with CIBIL.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => setIsCibilDialogOpen(true)}>
                <Shield className="w-4 h-4 mr-2" />
                Sync CIBIL
              </Button>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Obligation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                const Icon = obligationIcons[obligation.type] || AlertTriangle;
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
                      <p className="font-bold">{formatCurrency(Number(obligation.amount))}</p>
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
      {obligations.length > 0 && (
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
                  const Icon = obligationIcons[obligation.type] || AlertTriangle;
                  const monthlyAmount = calculateMonthlyEquivalent(Number(obligation.amount), obligation.frequency);
                  
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
                                <span>Limit: ₹{Number(obligation.creditLimit).toLocaleString()}</span>
                              </div>
                              <Progress value={Number(obligation.utilizationRate) || 0} className="h-1" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(Number(obligation.amount))}</p>
                          <p className="text-sm text-muted-foreground">
                            ({formatCurrency(monthlyAmount)}/month)
                          </p>
                          {obligation.lastPaymentDate && (
                            <p className="text-xs text-gray-500">
                              Last: {new Date(obligation.lastPaymentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {!obligation.fromCibil && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteObligation(obligation.id)}
                            disabled={deleteObligationMutation.isPending}
                            data-testid={`button-delete-obligation-${obligation.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Impact */}
      {obligations.length > 0 && (
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
      )}
    </div>
  );
}
