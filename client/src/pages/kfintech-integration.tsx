import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, TrendingUp, TrendingDown, Calendar, DollarSign, FileText, Activity, Search, PlusCircle, MinusCircle, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface KFintechFolioDetails {
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  units: number;
  nav: number;
  currentValue: number;
  investmentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
}

interface KFintechPortfolio {
  investorId: string;
  investorName: string;
  pan: string;
  folios: KFintechFolioDetails[];
}

interface KFintechTransaction {
  transactionId: string;
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  transactionType: 'PURCHASE' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'STP' | 'SWP';
  amount: number;
  units: number;
  nav: number;
  transactionDate: string;
  settlementDate: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

interface KFintechSIP {
  sipId: string;
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  amount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  nextInstallmentDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  totalInstallments: number;
  executedInstallments: number;
}

export default function KFintechIntegration() {
  const [selectedPan, setSelectedPan] = useState('');
  const [activeTab, setActiveTab] = useState('portfolio');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Portfolio query
  const { data: portfolioData, isLoading: portfolioLoading, error: portfolioError } = useQuery({
    queryKey: ['/api/kfintech/portfolio', selectedPan],
    enabled: !!selectedPan,
    retry: false,
  });

  // Transaction history query
  const [transactionDates, setTransactionDates] = useState({
    fromDate: '2024-01-01',
    toDate: new Date().toISOString().split('T')[0]
  });

  const { data: transactionData, isLoading: transactionLoading } = useQuery({
    queryKey: ['/api/kfintech/transactions', selectedPan, transactionDates.fromDate, transactionDates.toDate],
    enabled: !!selectedPan && !!transactionDates.fromDate && !!transactionDates.toDate,
    retry: false,
  });

  // SIP Details query
  const { data: sipData, isLoading: sipLoading } = useQuery({
    queryKey: ['/api/kfintech/sip', selectedPan],
    enabled: !!selectedPan,
    retry: false,
  });

  // Investor validation mutation
  const validateInvestorMutation = useMutation({
    mutationFn: async (pan: string) => {
      const response = await apiRequest('GET', `/api/kfintech/investor/validate/${pan}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data.isValid) {
        toast({
          title: "Investor Validated",
          description: `Welcome ${data.data.investorName}! KFintech registry verified.`,
        });
        setSelectedPan(data.data.details?.pan || selectedPan);
      } else {
        toast({
          title: "Validation Failed",
          description: "Invalid PAN or investor not found in KFintech registry",
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation Error",
        description: "Failed to validate investor with KFintech",
        variant: "destructive"
      });
    }
  });

  // Purchase transaction mutation
  const [purchaseForm, setPurchaseForm] = useState({
    schemeCode: '',
    amount: '',
    folioNumber: '',
    investorName: '',
    bankAccount: '',
    ifscCode: ''
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: typeof purchaseForm) => {
      const response = await apiRequest('POST', '/api/kfintech/transactions/purchase', {
        ...data,
        pan: selectedPan,
        amount: parseFloat(data.amount)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Your mutual fund purchase has been initiated through KFintech",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/portfolio'] });
      setPurchaseForm({
        schemeCode: '',
        amount: '',
        folioNumber: '',
        investorName: '',
        bankAccount: '',
        ifscCode: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to create purchase transaction",
        variant: "destructive"
      });
    }
  });

  // SIP setup mutation
  const [sipForm, setSipForm] = useState({
    schemeCode: '',
    amount: '',
    frequency: 'MONTHLY' as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    startDate: '',
    endDate: '',
    installments: '',
    bankAccount: '',
    ifscCode: ''
  });

  const sipSetupMutation = useMutation({
    mutationFn: async (data: typeof sipForm) => {
      const requestData = {
        ...data,
        pan: selectedPan,
        amount: parseFloat(data.amount),
        ...(data.installments && { installments: parseInt(data.installments) })
      };
      const response = await apiRequest('POST', '/api/kfintech/sip/setup', requestData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SIP Setup Successful",
        description: "Your SIP has been set up successfully through KFintech",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/sip'] });
      setSipForm({
        schemeCode: '',
        amount: '',
        frequency: 'MONTHLY',
        startDate: '',
        endDate: '',
        installments: '',
        bankAccount: '',
        ifscCode: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "SIP Setup Failed",
        description: error.message || "Failed to setup SIP",
        variant: "destructive"
      });
    }
  });

  // SIP cancellation mutation
  const sipCancelMutation = useMutation({
    mutationFn: async ({ sipId }: { sipId: string }) => {
      const response = await apiRequest('POST', '/api/kfintech/sip/cancel', {
        pan: selectedPan,
        sipId
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SIP Cancelled",
        description: "SIP has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/kfintech/sip'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel SIP",
        variant: "destructive"
      });
    }
  });

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'PURCHASE':
        return 'bg-green-100 text-green-800';
      case 'REDEMPTION':
        return 'bg-red-100 text-red-800';
      case 'SWITCH_IN':
      case 'SWITCH_OUT':
        return 'bg-blue-100 text-blue-800';
      case 'STP':
      case 'SWP':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">KFintech Integration</h1>
        <p className="text-muted-foreground">
          KFintech - Complete mutual fund transaction processing and registry services
        </p>
      </div>

      {/* PAN Validation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Investor Validation
          </CardTitle>
          <CardDescription>
            Enter your PAN to validate and access your mutual fund portfolio through KFintech registry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                placeholder="Enter PAN (e.g., ABCDE1234F)"
                value={selectedPan}
                onChange={(e) => setSelectedPan(e.target.value.toUpperCase())}
                data-testid="input-pan"
              />
            </div>
            <Button
              onClick={() => validateInvestorMutation.mutate(selectedPan)}
              disabled={!selectedPan || validateInvestorMutation.isPending}
              data-testid="button-validate-investor"
            >
              {validateInvestorMutation.isPending ? "Validating..." : "Validate"}
            </Button>
          </div>
          {portfolioError && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to fetch data from KFintech. Please check your PAN and try again.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {selectedPan && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="sips">SIPs</TabsTrigger>
            <TabsTrigger value="purchase">Purchase</TabsTrigger>
            <TabsTrigger value="sip-setup">SIP Setup</TabsTrigger>
          </TabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Portfolio Holdings (KFintech Registry)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {portfolioLoading ? (
                  <div className="text-center py-8">Loading portfolio...</div>
                ) : portfolioData && (portfolioData as any)?.success && (portfolioData as any)?.data?.folios?.length > 0 ? (
                  <div className="space-y-4">
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold text-blue-900">Investor Details</h3>
                      <p className="text-blue-700">Name: {((portfolioData as any).data as KFintechPortfolio).investorName}</p>
                      <p className="text-blue-700">PAN: {((portfolioData as any).data as KFintechPortfolio).pan}</p>
                      <p className="text-blue-700">Investor ID: {((portfolioData as any).data as KFintechPortfolio).investorId}</p>
                    </div>
                    
                    {((portfolioData as any).data as KFintechPortfolio).folios.map((folio, index) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="font-semibold">{folio.schemeName}</h4>
                              <p className="text-sm text-muted-foreground">Folio: {folio.folioNumber}</p>
                              <p className="text-sm text-muted-foreground">Scheme: {folio.schemeCode}</p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-sm text-muted-foreground">Units:</span>
                                <span className="ml-2 font-medium">{folio.units.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">NAV:</span>
                                <span className="ml-2 font-medium">₹{folio.nav.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">Investment:</span>
                                <span className="ml-2 font-medium">₹{folio.investmentValue.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">
                                ₹{folio.currentValue.toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">Current Value</div>
                              <div className={`text-sm font-medium mt-1 ${folio.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {folio.gainLoss >= 0 ? '+' : ''}₹{folio.gainLoss.toLocaleString()} 
                                ({folio.gainLossPercentage >= 0 ? '+' : ''}{folio.gainLossPercentage.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No portfolio holdings found in KFintech registry
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Transaction History (KFintech)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={transactionDates.fromDate}
                      onChange={(e) => setTransactionDates(prev => ({ ...prev, fromDate: e.target.value }))}
                      data-testid="input-from-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={transactionDates.toDate}
                      onChange={(e) => setTransactionDates(prev => ({ ...prev, toDate: e.target.value }))}
                      data-testid="input-to-date"
                    />
                  </div>
                </div>

                {transactionLoading ? (
                  <div className="text-center py-8">Loading transactions...</div>
                ) : transactionData && (transactionData as any)?.success && (transactionData as any)?.data?.transactions?.length > 0 ? (
                  <div className="space-y-3">
                    {((transactionData as any).data.transactions as KFintechTransaction[]).map((transaction, index) => (
                      <Card key={index} className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium">{transaction.schemeName}</div>
                              <div className="text-muted-foreground">Folio: {transaction.folioNumber}</div>
                              <div className="text-muted-foreground">ID: {transaction.transactionId}</div>
                            </div>
                            <div>
                              <Badge className={getTransactionTypeColor(transaction.transactionType)}>
                                {transaction.transactionType}
                              </Badge>
                              <div className="mt-1">
                                <Badge variant={transaction.status === 'SUCCESS' ? 'default' : 'secondary'}>
                                  {transaction.status}
                                </Badge>
                              </div>
                            </div>
                            <div>
                              <div>Amount: ₹{transaction.amount.toLocaleString()}</div>
                              <div>Units: {transaction.units.toLocaleString()}</div>
                              <div>NAV: ₹{transaction.nav.toLocaleString()}</div>
                            </div>
                            <div className="text-right">
                              <div>{transaction.transactionDate}</div>
                              <div className="text-muted-foreground text-xs">
                                Settlement: {transaction.settlementDate}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for the selected period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIPs Tab */}
          <TabsContent value="sips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Active SIPs (KFintech)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sipLoading ? (
                  <div className="text-center py-8">Loading SIPs...</div>
                ) : sipData && (sipData as any)?.success && (sipData as any)?.data?.sips?.length > 0 ? (
                  <div className="space-y-4">
                    {((sipData as any).data.sips as KFintechSIP[]).map((sip, index) => (
                      <Card key={index} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="font-medium">{sip.schemeName}</div>
                              <div className="text-sm text-muted-foreground">SIP ID: {sip.sipId}</div>
                              <div className="text-sm text-muted-foreground">Folio: {sip.folioNumber}</div>
                            </div>
                            <div className="space-y-1">
                              <div><span className="text-muted-foreground">Amount:</span> ₹{sip.amount.toLocaleString()}</div>
                              <div><span className="text-muted-foreground">Frequency:</span> {sip.frequency}</div>
                              <div><span className="text-muted-foreground">Start:</span> {sip.startDate}</div>
                              <div><span className="text-muted-foreground">Next:</span> {sip.nextInstallmentDate}</div>
                            </div>
                            <div className="text-right">
                              <Badge variant={sip.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {sip.status}
                              </Badge>
                              <div className="text-sm mt-2">
                                <div>{sip.executedInstallments}/{sip.totalInstallments} completed</div>
                                {sip.endDate && (
                                  <div className="text-muted-foreground">End: {sip.endDate}</div>
                                )}
                              </div>
                              {sip.status === 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2"
                                  onClick={() => sipCancelMutation.mutate({ sipId: sip.sipId })}
                                  disabled={sipCancelMutation.isPending}
                                  data-testid={`button-cancel-sip-${index}`}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No active SIPs found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Tab */}
          <TabsContent value="purchase" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5" />
                  Purchase Mutual Fund (KFintech)
                </CardTitle>
                <CardDescription>
                  Create a new mutual fund purchase transaction through KFintech registry
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="schemeCode">Scheme Code</Label>
                    <Input
                      id="schemeCode"
                      placeholder="Enter KFintech scheme code"
                      value={purchaseForm.schemeCode}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, schemeCode: e.target.value }))}
                      data-testid="input-scheme-code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={purchaseForm.amount}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, amount: e.target.value }))}
                      data-testid="input-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="folioNumber">Folio Number (Optional)</Label>
                    <Input
                      id="folioNumber"
                      placeholder="Leave blank for new folio"
                      value={purchaseForm.folioNumber}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, folioNumber: e.target.value }))}
                      data-testid="input-folio-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="investorName">Investor Name</Label>
                    <Input
                      id="investorName"
                      placeholder="Enter investor name"
                      value={purchaseForm.investorName}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, investorName: e.target.value }))}
                      data-testid="input-investor-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankAccount">Bank Account Number</Label>
                    <Input
                      id="bankAccount"
                      placeholder="Enter bank account number"
                      value={purchaseForm.bankAccount}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                      data-testid="input-bank-account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      placeholder="Enter IFSC code"
                      value={purchaseForm.ifscCode}
                      onChange={(e) => setPurchaseForm(prev => ({ ...prev, ifscCode: e.target.value }))}
                      data-testid="input-ifsc-code"
                    />
                  </div>
                </div>
                <Separator className="my-4" />
                <Button
                  onClick={() => purchaseMutation.mutate(purchaseForm)}
                  disabled={purchaseMutation.isPending || !purchaseForm.schemeCode || !purchaseForm.amount}
                  className="w-full"
                  data-testid="button-submit-purchase"
                >
                  {purchaseMutation.isPending ? "Processing..." : "Create Purchase Transaction"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SIP Setup Tab */}
          <TabsContent value="sip-setup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Setup New SIP (KFintech)
                </CardTitle>
                <CardDescription>
                  Set up a new Systematic Investment Plan through KFintech registry
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sipSchemeCode">Scheme Code</Label>
                    <Input
                      id="sipSchemeCode"
                      placeholder="Enter KFintech scheme code"
                      value={sipForm.schemeCode}
                      onChange={(e) => setSipForm(prev => ({ ...prev, schemeCode: e.target.value }))}
                      data-testid="input-sip-scheme-code"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sipAmount">SIP Amount (₹)</Label>
                    <Input
                      id="sipAmount"
                      type="number"
                      placeholder="Enter SIP amount"
                      value={sipForm.amount}
                      onChange={(e) => setSipForm(prev => ({ ...prev, amount: e.target.value }))}
                      data-testid="input-sip-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={sipForm.frequency}
                      onValueChange={(value) => setSipForm(prev => ({ ...prev, frequency: value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY' }))}
                    >
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={sipForm.startDate}
                      onChange={(e) => setSipForm(prev => ({ ...prev, startDate: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End Date (Optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={sipForm.endDate}
                      onChange={(e) => setSipForm(prev => ({ ...prev, endDate: e.target.value }))}
                      data-testid="input-end-date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="installments">Total Installments (Optional)</Label>
                    <Input
                      id="installments"
                      type="number"
                      placeholder="Leave blank for perpetual"
                      value={sipForm.installments}
                      onChange={(e) => setSipForm(prev => ({ ...prev, installments: e.target.value }))}
                      data-testid="input-installments"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sipBankAccount">Bank Account Number</Label>
                    <Input
                      id="sipBankAccount"
                      placeholder="Enter bank account number"
                      value={sipForm.bankAccount}
                      onChange={(e) => setSipForm(prev => ({ ...prev, bankAccount: e.target.value }))}
                      data-testid="input-sip-bank-account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sipIfscCode">IFSC Code</Label>
                    <Input
                      id="sipIfscCode"
                      placeholder="Enter IFSC code"
                      value={sipForm.ifscCode}
                      onChange={(e) => setSipForm(prev => ({ ...prev, ifscCode: e.target.value }))}
                      data-testid="input-sip-ifsc-code"
                    />
                  </div>
                </div>
                <Separator className="my-4" />
                <Button
                  onClick={() => sipSetupMutation.mutate(sipForm)}
                  disabled={sipSetupMutation.isPending || !sipForm.schemeCode || !sipForm.amount || !sipForm.startDate}
                  className="w-full"
                  data-testid="button-setup-sip"
                >
                  {sipSetupMutation.isPending ? "Setting up..." : "Setup SIP"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}