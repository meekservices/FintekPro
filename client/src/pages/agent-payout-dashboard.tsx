import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Wallet,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Banknote,
  Receipt,
  PieChart,
  BarChart3,
  CreditCard,
  Building,
  ChevronRight,
  Send
} from "lucide-react";
import { format } from "date-fns";

interface EarningEntry {
  id: string;
  date: string;
  clientName: string;
  productType: string;
  transactionType: string;
  transactionValue: number;
  commissionRate: number;
  grossCommission: number;
  platformFee: number;
  netCommission: number;
  status: 'pending' | 'approved' | 'paid';
}

interface PayoutRequest {
  id: string;
  requestDate: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  bankDetails: string;
  processedDate?: string;
  referenceNumber?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatCompact = (amount: number) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toString();
};


export default function AgentPayoutDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [dateRange, setDateRange] = useState("this_month");

  const { data: earningsData, isLoading: isLoadingEarnings } = useQuery<EarningEntry[]>({
    queryKey: [`/api/agent/earnings?period=${dateRange}`],
  });

  const { data: payoutRequestsData, isLoading: isLoadingPayouts } = useQuery<PayoutRequest[]>({
    queryKey: ['/api/agent/payout-requests'],
  });

  const earnings = Array.isArray(earningsData) ? earningsData : (earningsData as any)?.earnings || [];
  const payoutRequests = Array.isArray(payoutRequestsData) ? payoutRequestsData : (payoutRequestsData as any)?.requests || [];

  const metrics = useMemo(() => {
    const totalEarnings = earnings.reduce((sum, e) => sum + e.netCommission, 0);
    const pendingEarnings = earnings.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.netCommission, 0);
    const approvedEarnings = earnings.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.netCommission, 0);
    const paidEarnings = earnings.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.netCommission, 0);
    const withdrawable = approvedEarnings;
    const pendingPayouts = payoutRequests.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    
    return {
      totalEarnings,
      pendingEarnings,
      approvedEarnings,
      paidEarnings,
      withdrawable,
      pendingPayouts,
      totalTransactions: earnings.length,
      avgCommission: earnings.length > 0 ? totalEarnings / earnings.length : 0
    };
  }, [earnings, payoutRequests]);

  const handleRequestPayout = () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (amount > metrics.withdrawable) {
      toast({ title: "Error", description: "Amount exceeds available balance", variant: "destructive" });
      return;
    }
    toast({ title: "Payout Requested", description: `Payout of ${formatCurrency(amount)} has been submitted for processing` });
    setShowPayoutDialog(false);
    setPayoutAmount("");
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      paid: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600">
              <Wallet className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Earnings & Payouts</h1>
              <p className="text-muted-foreground">Track your commissions and request withdrawals</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]" data-testid="select-date-range">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="this_quarter">This Quarter</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-download">
              <Download className="w-4 h-4 mr-2" /> Statement
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Withdrawable Balance</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.withdrawable)}</p>
              </div>
              <Banknote className="w-10 h-10 text-green-400" />
            </div>
            <Button 
              size="sm" 
              className="w-full mt-3 bg-green-600 hover:bg-green-700"
              onClick={() => setShowPayoutDialog(true)}
              disabled={metrics.withdrawable <= 0}
              data-testid="button-withdraw"
            >
              <Send className="w-4 h-4 mr-2" /> Withdraw
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Earnings</p>
                <p className="text-xl font-bold">{formatCurrency(metrics.totalEarnings)}</p>
              </div>
              <IndianRupee className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-xs text-blue-600 mt-1">{metrics.totalTransactions} transactions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending Approval</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(metrics.pendingEarnings)}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Processing within 48 hrs</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Already Paid</p>
                <p className="text-xl font-bold text-muted-foreground">{formatCurrency(metrics.paidEarnings)}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lifetime payouts</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <PieChart className="w-4 h-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="earnings" className="flex items-center gap-2" data-testid="tab-earnings">
            <Receipt className="w-4 h-4" /> Commission Details
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2" data-testid="tab-payouts">
            <Wallet className="w-4 h-4" /> Payout History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Commission Waterfall
                </CardTitle>
                <CardDescription>Breakdown of your earnings flow</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Gross Commission</span>
                    <span className="font-bold text-lg">{formatCurrency(earnings.reduce((s, e) => s + e.grossCommission, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-muted-foreground">Platform Fee (10%)</span>
                    <span className="font-medium text-red-600">-{formatCurrency(earnings.reduce((s, e) => s + e.platformFee, 0))}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="font-medium">Net Commission</span>
                    <span className="font-bold text-lg text-green-600">{formatCurrency(metrics.totalEarnings)}</span>
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      Pending Approval
                    </span>
                    <span>{formatCurrency(metrics.pendingEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      Approved & Withdrawable
                    </span>
                    <span>{formatCurrency(metrics.approvedEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      Already Paid
                    </span>
                    <span>{formatCurrency(metrics.paidEarnings)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  Bank Account
                </CardTitle>
                <CardDescription>Your registered payout account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                  <div className="flex items-center gap-4">
                    <Building className="w-12 h-12 text-green-600" />
                    <div>
                      <p className="font-medium text-lg">HDFC Bank</p>
                      <p className="text-muted-foreground">Account ending in 1234</p>
                      <p className="text-sm text-muted-foreground">IFSC: HDFC0001234</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Badge variant="outline" className="bg-card">Primary Account</Badge>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Verified</Badge>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200 mb-2">Payout Schedule</h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Minimum withdrawal: ₹500</li>
                    <li>• Processing time: 1-3 business days</li>
                    <li>• Payouts processed every Tuesday & Friday</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {earnings.slice(0, 5).map((earning) => (
                      <TableRow key={earning.id}>
                        <TableCell>{format(new Date(earning.date), 'dd MMM')}</TableCell>
                        <TableCell className="font-medium">{earning.clientName}</TableCell>
                        <TableCell>{earning.productType}</TableCell>
                        <TableCell className="text-right">{formatCurrency(earning.transactionValue)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(earning.netCommission)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(earning.status)}>{earning.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="earnings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Commission Details
              </CardTitle>
              <CardDescription>Detailed breakdown of all your earnings</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earning) => (
                    <TableRow key={earning.id} data-testid={`earning-row-${earning.id}`}>
                      <TableCell>{format(new Date(earning.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium">{earning.clientName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{earning.productType}</Badge>
                      </TableCell>
                      <TableCell>{earning.transactionType}</TableCell>
                      <TableCell className="text-right">{formatCurrency(earning.transactionValue)}</TableCell>
                      <TableCell className="text-right">{earning.commissionRate}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(earning.grossCommission)}</TableCell>
                      <TableCell className="text-right text-red-600">-{formatCurrency(earning.platformFee)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(earning.netCommission)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadge(earning.status)}>{earning.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <div className="flex justify-between items-center w-full">
                <p className="text-muted-foreground">
                  Total Net Earnings: <span className="font-bold text-green-600">{formatCurrency(metrics.totalEarnings)}</span>
                </p>
                <Button variant="outline" data-testid="button-download-statement">
                  <Download className="w-4 h-4 mr-2" /> Download Statement
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Payout History
                  </CardTitle>
                  <CardDescription>Track your withdrawal requests</CardDescription>
                </div>
                <Button 
                  onClick={() => setShowPayoutDialog(true)}
                  disabled={metrics.withdrawable <= 0}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-new-payout"
                >
                  <Send className="w-4 h-4 mr-2" /> Request Payout
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payoutRequests.map((payout) => (
                  <div 
                    key={payout.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`payout-row-${payout.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        payout.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                        payout.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900' :
                        payout.status === 'processing' ? 'bg-blue-100 dark:bg-blue-900' :
                        'bg-red-100 dark:bg-red-900'
                      }`}>
                        {payout.status === 'completed' ? <CheckCircle className="w-6 h-6 text-green-600" /> :
                         payout.status === 'pending' ? <Clock className="w-6 h-6 text-yellow-600" /> :
                         payout.status === 'processing' ? <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" /> :
                         <AlertCircle className="w-6 h-6 text-red-600" />}
                      </div>
                      <div>
                        <p className="font-medium">{formatCurrency(payout.amount)}</p>
                        <p className="text-sm text-muted-foreground">Requested: {payout.requestDate && !isNaN(new Date(payout.requestDate).getTime()) ? format(new Date(payout.requestDate), 'dd MMM yyyy') : 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{payout.bankDetails}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusBadge(payout.status)}>{payout.status}</Badge>
                      {payout.processedDate && !isNaN(new Date(payout.processedDate).getTime()) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Processed: {format(new Date(payout.processedDate), 'dd MMM')}
                        </p>
                      )}
                      {payout.referenceNumber && (
                        <p className="text-xs text-muted-foreground">{payout.referenceNumber}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>Withdraw your available earnings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(metrics.withdrawable)}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Withdrawal Amount</Label>
              <Input 
                type="number"
                placeholder="Enter amount"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                data-testid="input-payout-amount"
              />
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPayoutAmount((metrics.withdrawable * 0.5).toString())}
                >
                  50%
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPayoutAmount((metrics.withdrawable * 0.75).toString())}
                >
                  75%
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPayoutAmount(metrics.withdrawable.toString())}
                >
                  Max
                </Button>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Payout To:</p>
              <div className="flex items-center gap-3">
                <Building className="w-8 h-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">HDFC Bank ***1234</p>
                  <p className="text-xs text-muted-foreground">Processing time: 1-3 business days</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayoutDialog(false)}>Cancel</Button>
            <Button onClick={handleRequestPayout} className="bg-green-600 hover:bg-green-700" data-testid="button-confirm-payout">
              Request Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
