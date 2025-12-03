import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CreditCard, 
  Home, 
  Car,
  Calendar,
  IndianRupee,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Shield,
  RefreshCw,
  Loader2,
  Zap,
  Smartphone,
  Building,
  Bell,
  Sparkles,
  Clock,
  ArrowRight,
  FileText,
  PieChart,
  TrendingUp,
  Wifi
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { FinancialObligation } from "@shared/schema";

interface CibilReportData {
  creditScore?: number;
  creditGrade?: string;
  creditAccounts?: any[];
  creditUtilization?: any;
  paymentHistory?: any;
  reportId?: string;
}

interface BbpsBill {
  id: string;
  billerName?: string;
  billAmount: string;
  dueDate: string;
  billFetchStatus: string;
  categoryName?: string;
}

interface BudgetData {
  id: string;
  budgetName: string;
  category: string;
  budgetAmount: string;
  spentAmount?: string;
  period: string;
}

const categoryIcons: Record<string, any> = {
  ELECTRICITY: Zap,
  GAS: Home,
  WATER: Home,
  TELECOM_POSTPAID: Smartphone,
  TELECOM_PREPAID: Smartphone,
  DTH: Wifi,
  BROADBAND: Wifi,
  INSURANCE: Shield,
  LOAN_REPAYMENT: Building,
  CREDIT_CARD: CreditCard,
  HOME_LOAN: Home,
  CAR_LOAN: Car,
};

export function ObligationMapping() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("cibil");

  const [cibilData, setCibilData] = useState<CibilReportData | null>(null);
  const [userInfo, setUserInfo] = useState({
    fullName: "",
    mobileNumber: "",
    dateOfBirth: "",
    panNumber: "",
    email: ""
  });
  const [isCibilDialogOpen, setIsCibilDialogOpen] = useState(false);

  const { data: obligations = [], isLoading: obligationsLoading, refetch: refetchObligations } = useQuery<FinancialObligation[]>({
    queryKey: ['/api/financial-obligations'],
  });

  const { data: bbpsBills = [], isLoading: bbpsLoading } = useQuery<BbpsBill[]>({
    queryKey: ['/api/bbps/bills'],
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<BudgetData[]>({
    queryKey: ['/api/budgets', { isActive: true }],
  });

  const { data: insights = [], isLoading: insightsLoading } = useQuery<any[]>({
    queryKey: ['/api/insights'],
  });

  const cibilObligations = obligations.filter(o => o.fromCibil);

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
      toast({
        title: "Sync failed",
        description: error.userMessage || error.message || "Failed to sync CIBIL data.",
        variant: "destructive",
      });
    },
  });

  const generateInsightsMutation = useMutation({
    mutationFn: async () => apiRequest('/api/insights/generate', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
      toast({ title: 'Success', description: 'AI insights generated for your obligations' });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTotalMonthlyObligations = () => {
    return cibilObligations
      .filter(o => o.status === 'active')
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  };

  const getUpcomingPayments = () => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const cibilUpcoming = cibilObligations
      .filter(o => {
        const dueDate = new Date(o.dueDate);
        return dueDate >= now && dueDate <= sevenDaysFromNow;
      })
      .map(o => ({ ...o, source: 'CIBIL' }));

    const bbpsUpcoming = bbpsBills
      .filter(b => {
        const dueDate = new Date(b.dueDate);
        return dueDate >= now && dueDate <= sevenDaysFromNow && b.billFetchStatus === 'SUCCESS';
      })
      .map(b => ({
        id: b.id,
        name: b.billerName || 'Bill Payment',
        amount: b.billAmount,
        dueDate: b.dueDate,
        type: 'utility',
        source: 'BBPS'
      }));

    return [...cibilUpcoming, ...bbpsUpcoming].sort((a, b) => 
      new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  };

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (obligationsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Credit Obligations Dashboard</h2>
          <p className="text-muted-foreground">Your CIBIL credit obligations synced with BBPS bills and budgets</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => generateInsightsMutation.mutate()}
            disabled={generateInsightsMutation.isPending}
            data-testid="button-generate-insights"
          >
            {generateInsightsMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            AI Analysis
          </Button>
          
          <Dialog open={isCibilDialogOpen} onOpenChange={setIsCibilDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-sync-cibil">
                <Shield className="w-4 h-4 mr-2" />
                Sync CIBIL
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Sync Credit Obligations from CIBIL</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Securely fetch your loans, credit cards, and EMIs directly from your CIBIL report
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label htmlFor="cibil-name">Full Name (as per PAN)</Label>
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
                  className="w-full"
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-credit-score">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Credit Score</p>
                <p className="text-3xl font-bold text-blue-600">{cibilData?.creditScore || 'N/A'}</p>
                {cibilData?.creditGrade && (
                  <Badge variant="secondary" className="mt-1">{cibilData.creditGrade}</Badge>
                )}
              </div>
              <Shield className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-obligations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Obligations</p>
                <p className="text-2xl font-bold">{formatCurrency(getTotalMonthlyObligations())}</p>
                <p className="text-xs text-muted-foreground mt-1">{cibilObligations.length} from CIBIL</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-bills">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Upcoming (7 days)</p>
                <p className="text-2xl font-bold">{getUpcomingPayments().length}</p>
                <p className="text-xs text-muted-foreground mt-1">payments due</p>
              </div>
              <Calendar className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-bbps-bills">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">BBPS Bills</p>
                <p className="text-2xl font-bold">{bbpsBills.length}</p>
                <Link href="/bbps" className="text-xs text-blue-600 hover:underline flex items-center mt-1">
                  View all <ArrowRight className="w-3 h-3 ml-1" />
                </Link>
              </div>
              <Zap className="w-10 h-10 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payment Alerts */}
      {getUpcomingPayments().length > 0 && (
        <Alert className="bg-orange-50 border-orange-200" data-testid="alert-upcoming-payments">
          <Bell className="w-4 h-4 text-orange-600" />
          <AlertTitle className="text-orange-900">Upcoming Payments</AlertTitle>
          <AlertDescription className="text-orange-800">
            <div className="mt-2 space-y-2">
              {getUpcomingPayments().slice(0, 3).map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between bg-white rounded-md p-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={payment.source === 'CIBIL' ? 'default' : 'secondary'} className="text-xs">
                      {payment.source}
                    </Badge>
                    <span className="font-medium">{payment.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{formatCurrency(Number(payment.amount))}</span>
                    <Badge variant={getDaysUntilDue(payment.dueDate) <= 2 ? 'destructive' : 'outline'}>
                      {getDaysUntilDue(payment.dueDate)} days
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollableTabsList className="grid w-full grid-cols-4 gap-1">
          <TabsTrigger value="cibil" data-testid="tab-cibil">
            <Shield className="w-4 h-4 mr-2" />
            CIBIL Obligations
          </TabsTrigger>
          <TabsTrigger value="bbps" data-testid="tab-bbps">
            <Zap className="w-4 h-4 mr-2" />
            BBPS Bills
          </TabsTrigger>
          <TabsTrigger value="budgets" data-testid="tab-budgets">
            <PieChart className="w-4 h-4 mr-2" />
            Budget Sync
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </ScrollableTabsList>

        {/* CIBIL Obligations Tab */}
        <TabsContent value="cibil" className="space-y-4">
          {cibilData?.creditUtilization && (
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-900">Credit Utilization</span>
                  <span className="text-lg font-bold text-blue-700">{cibilData.creditUtilization.utilizationRatio}%</span>
                </div>
                <Progress 
                  value={cibilData.creditUtilization.utilizationRatio} 
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-blue-600 mt-2">
                  <span>Used: {formatCurrency(cibilData.creditUtilization.totalUsed)}</span>
                  <span>Limit: {formatCurrency(cibilData.creditUtilization.totalLimit)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {cibilObligations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No CIBIL Obligations Found</h3>
                <p className="text-muted-foreground mb-4">
                  Sync your CIBIL report to automatically import your loans, credit cards, and EMIs.
                </p>
                <Button onClick={() => setIsCibilDialogOpen(true)}>
                  <Shield className="w-4 h-4 mr-2" />
                  Sync CIBIL Report
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cibilObligations.map((obligation) => {
                const Icon = obligation.type === 'loan' ? Home : 
                             obligation.type === 'emi' ? Car : CreditCard;
                const daysUntil = getDaysUntilDue(obligation.dueDate);
                
                return (
                  <Card key={obligation.id} className="hover:shadow-md transition-shadow" data-testid={`obligation-${obligation.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-blue-100 rounded-lg">
                            <Icon className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{obligation.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {obligation.type?.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                CIBIL Verified
                              </Badge>
                            </div>
                            {obligation.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{obligation.notes}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-2xl font-bold">{formatCurrency(Number(obligation.amount))}</p>
                          <p className="text-sm text-muted-foreground">{obligation.frequency}</p>
                          <div className="flex items-center justify-end gap-1 mt-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className={`text-sm font-medium ${daysUntil <= 3 ? 'text-red-600' : daysUntil <= 7 ? 'text-orange-600' : 'text-green-600'}`}>
                              {daysUntil <= 0 ? 'Due today' : `Due in ${daysUntil} days`}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {obligation.creditLimit && obligation.utilizationRate && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Credit Utilization</span>
                            <span className="font-medium">{obligation.utilizationRate}%</span>
                          </div>
                          <Progress value={Number(obligation.utilizationRate)} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* BBPS Bills Tab */}
        <TabsContent value="bbps" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Utility bills and recurring payments from BBPS
            </p>
            <Link href="/bbps">
              <Button variant="outline" size="sm">
                <Zap className="w-4 h-4 mr-2" />
                Go to BBPS
              </Button>
            </Link>
          </div>

          {bbpsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : bbpsBills.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No BBPS Bills Found</h3>
                <p className="text-muted-foreground mb-4">
                  Add your utility bills and recurring payments in BBPS to track them here.
                </p>
                <Link href="/bbps">
                  <Button>
                    <Zap className="w-4 h-4 mr-2" />
                    Add Bills in BBPS
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {bbpsBills.map((bill) => {
                const CategoryIcon = categoryIcons[bill.categoryName || ''] || Zap;
                const daysUntil = getDaysUntilDue(bill.dueDate);
                
                return (
                  <Card key={bill.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-yellow-100 rounded-lg">
                            <CategoryIcon className="w-6 h-6 text-yellow-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{bill.billerName || 'Bill Payment'}</h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {bill.categoryName || 'Utility'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatCurrency(Number(bill.billAmount))}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className={`text-sm ${daysUntil <= 3 ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {daysUntil <= 0 ? 'Due today' : `Due in ${daysUntil} days`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Budget Sync Tab */}
        <TabsContent value="budgets" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Your budgets linked to obligations and spending
            </p>
            <Link href="/expenses-budgets">
              <Button variant="outline" size="sm">
                <PieChart className="w-4 h-4 mr-2" />
                Manage Budgets
              </Button>
            </Link>
          </div>

          {budgetsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <PieChart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Budgets Set</h3>
                <p className="text-muted-foreground mb-4">
                  Create budgets to track your spending against your obligations.
                </p>
                <Link href="/expenses-budgets">
                  <Button>
                    <PieChart className="w-4 h-4 mr-2" />
                    Create Budget
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {budgets.map((budget: any) => {
                const spent = Number(budget.spentAmount || 0);
                const total = Number(budget.budgetAmount);
                const percentage = total > 0 ? (spent / total) * 100 : 0;
                const isOverBudget = percentage > 100;
                
                return (
                  <Card key={budget.id} className={isOverBudget ? 'border-red-300 bg-red-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{budget.budgetName}</h3>
                          <Badge variant="outline" className="text-xs mt-1">{budget.category}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">{budget.period}</p>
                          <p className={`text-lg font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(spent)} / {formatCurrency(total)}
                          </p>
                        </div>
                      </div>
                      <Progress 
                        value={Math.min(percentage, 100)} 
                        className={`h-2 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {percentage.toFixed(0)}% used
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              AI-powered analysis of your obligations and payment patterns
            </p>
            <Button 
              onClick={() => generateInsightsMutation.mutate()} 
              disabled={generateInsightsMutation.isPending}
              size="sm"
            >
              {generateInsightsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Insights
            </Button>
          </div>

          {insightsLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : insights.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Insights Available</h3>
                <p className="text-muted-foreground mb-4">
                  Generate AI insights to get personalized payment reminders and recommendations.
                </p>
                <Button onClick={() => generateInsightsMutation.mutate()}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Insights
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {insights.map((insight: any, index: number) => (
                <Card key={index} className={`
                  ${insight.type === 'warning' ? 'bg-orange-50 border-orange-200' : ''}
                  ${insight.type === 'success' ? 'bg-green-50 border-green-200' : ''}
                  ${insight.type === 'info' ? 'bg-blue-50 border-blue-200' : ''}
                `}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        insight.type === 'warning' ? 'bg-orange-100' :
                        insight.type === 'success' ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        {insight.type === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                        ) : insight.type === 'success' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Sparkles className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold">{insight.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                        {insight.action && (
                          <Button variant="link" className="p-0 h-auto mt-2 text-sm">
                            {insight.action} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Payment Reminder Section */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                Payment Reminders
              </CardTitle>
              <CardDescription>
                Upcoming payments that need your attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getUpcomingPayments().length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming payments in the next 7 days
                  </p>
                ) : (
                  getUpcomingPayments().map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          getDaysUntilDue(payment.dueDate) <= 2 ? 'bg-red-500' :
                          getDaysUntilDue(payment.dueDate) <= 5 ? 'bg-orange-500' : 'bg-green-500'
                        }`} />
                        <div>
                          <p className="font-medium">{payment.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.dueDate).toLocaleDateString('en-IN', { 
                              day: 'numeric', month: 'short', year: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(Number(payment.amount))}</p>
                        <Badge variant="outline" className="text-xs">{payment.source}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
