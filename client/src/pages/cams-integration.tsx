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
import { AlertCircle, TrendingUp, TrendingDown, Calendar, DollarSign, FileText, Activity, Search, PlusCircle, MinusCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface FolioDetails {
  folio: string;
  schemeCode: string;
  schemeName: string;
  currentUnits: number;
  currentValue: number;
  nav: number;
  navDate: string;
  investorDetails: {
    folio: string;
    investorName: string;
    pan: string;
    email?: string;
    mobile?: string;
    kycStatus: string;
  };
}

interface TransactionDetails {
  folio: string;
  scheme: string;
  amount: number;
  units?: number;
  nav?: number;
  transactionType: string;
  transactionDate: string;
  settlementDate?: string;
  investorName: string;
  pan: string;
}

interface SipDetails {
  sipId: string;
  folio: string;
  schemeCode: string;
  amount: number;
  frequency: string;
  startDate: string;
  endDate?: string;
  nextInstallmentDate: string;
  status: string;
}

export default function CamsIntegration() {
  const [selectedPan, setSelectedPan] = useState('');
  const [activeTab, setActiveTab] = useState('portfolio');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Portfolio query
  const { data: portfolioData, isLoading: portfolioLoading, error: portfolioError } = useQuery({
    queryKey: ['/api/cams/portfolio', selectedPan],
    enabled: !!selectedPan,
    retry: false,
  });

  // Transaction history query
  const [transactionDates, setTransactionDates] = useState({
    fromDate: '2024-01-01',
    toDate: new Date().toISOString().split('T')[0]
  });

  const { data: transactionData, isLoading: transactionLoading } = useQuery({
    queryKey: ['/api/cams/transactions', selectedPan, transactionDates.fromDate, transactionDates.toDate],
    enabled: !!selectedPan && !!transactionDates.fromDate && !!transactionDates.toDate,
    retry: false,
  });

  // SIP Details query
  const { data: sipData, isLoading: sipLoading } = useQuery({
    queryKey: ['/api/cams/sip', selectedPan],
    enabled: !!selectedPan,
    retry: false,
  });

  // Investor validation mutation
  const validateInvestorMutation = useMutation({
    mutationFn: async (pan: string) => {
      const response = await apiRequest('GET', `/api/cams/investor/validate/${pan}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.data.isValid) {
        toast({
          title: "Investor Validated",
          description: `Welcome ${data.data.investorName}!`,
        });
        setSelectedPan(data.data.details?.pan || selectedPan);
      } else {
        toast({
          title: "Validation Failed",
          description: "Invalid PAN or investor not found in CAMS",
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation Error",
        description: "Failed to validate investor",
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
      const response = await apiRequest('POST', '/api/cams/transactions/purchase', {
        ...data,
        pan: selectedPan,
        amount: parseFloat(data.amount)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Purchase Successful",
        description: "Your mutual fund purchase has been initiated",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cams/portfolio'] });
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
    frequency: 'MONTHLY',
    startDate: '',
    endDate: '',
    bankAccount: '',
    ifscCode: ''
  });

  const sipSetupMutation = useMutation({
    mutationFn: async (data: typeof sipForm) => {
      const response = await apiRequest('POST', '/api/cams/sip/setup', {
        ...data,
        pan: selectedPan,
        amount: parseFloat(data.amount)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "SIP Setup Successful",
        description: "Your SIP has been set up successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cams/sip'] });
      setSipForm({
        schemeCode: '',
        amount: '',
        frequency: 'MONTHLY',
        startDate: '',
        endDate: '',
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">CAMS Integration</h1>
        <p className="text-muted-foreground">
          Computer Age Management Services - Comprehensive mutual fund operations and investor services
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
            Enter your PAN to validate and access your mutual fund portfolio through CAMS
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
                Unable to fetch data from CAMS. Please check your PAN and try again.
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
                  Portfolio Holdings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {portfolioLoading ? (
                  <div className="text-center py-8">Loading portfolio...</div>
                ) : portfolioData && (portfolioData as any)?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {((portfolioData as any).data as FolioDetails[]).map((folio, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="font-semibold">{folio.schemeName}</h4>
                              <p className="text-sm text-muted-foreground">Folio: {folio.folio}</p>
                              <Badge variant={folio.investorDetails.kycStatus === 'VERIFIED' ? 'default' : 'secondary'}>
                                KYC: {folio.investorDetails.kycStatus}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <span className="text-sm text-muted-foreground">Units:</span>
                                <span className="ml-2 font-medium">{folio.currentUnits.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">NAV:</span>
                                <span className="ml-2 font-medium">₹{folio.nav.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-sm text-muted-foreground">NAV Date:</span>
                                <span className="ml-2 text-sm">{folio.navDate}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">
                                ₹{folio.currentValue.toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">Current Value</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No portfolio holdings found
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
                  Transaction History
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
                ) : transactionData && (transactionData as any)?.data?.length > 0 ? (
                  <div className="space-y-3">
                    {((transactionData as any).data as TransactionDetails[]).map((transaction, index) => (
                      <Card key={index} className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="font-medium">{transaction.scheme}</div>
                              <div className="text-muted-foreground">Folio: {transaction.folio}</div>
                            </div>
                            <div>
                              <Badge variant={transaction.transactionType === 'PURCHASE' ? 'default' : 'secondary'}>
                                {transaction.transactionType}
                              </Badge>
                            </div>
                            <div>
                              <div>Amount: ₹{transaction.amount.toLocaleString()}</div>
                              {transaction.units && <div>Units: {transaction.units}</div>}
                              {transaction.nav && <div>NAV: ₹{transaction.nav}</div>}
                            </div>
                            <div className="text-right">
                              <div>{transaction.transactionDate}</div>
                              {transaction.settlementDate && (
                                <div className="text-muted-foreground text-xs">
                                  Settlement: {transaction.settlementDate}
                                </div>
                              )}
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
                  Active SIPs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sipLoading ? (
                  <div className="text-center py-8">Loading SIPs...</div>
                ) : sipData && (sipData as any)?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {((sipData as any).data as SipDetails[]).map((sip, index) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="font-medium">Scheme: {sip.schemeCode}</div>
                              <div className="text-sm text-muted-foreground">SIP ID: {sip.sipId}</div>
                              <div className="text-sm text-muted-foreground">Folio: {sip.folio}</div>
                            </div>
                            <div className="space-y-1">
                              <div><span className="text-muted-foreground">Amount:</span> ₹{sip.amount.toLocaleString()}</div>
                              <div><span className="text-muted-foreground">Frequency:</span> {sip.frequency}</div>
                              <div><span className="text-muted-foreground">Start Date:</span> {sip.startDate}</div>
                              <div><span className="text-muted-foreground">Next Date:</span> {sip.nextInstallmentDate}</div>
                            </div>
                            <div className="text-right">
                              <Badge variant={sip.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {sip.status}
                              </Badge>
                              {sip.endDate && (
                                <div className="text-sm text-muted-foreground mt-2">
                                  End Date: {sip.endDate}
                                </div>
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
                  Purchase Mutual Fund
                </CardTitle>
                <CardDescription>
                  Create a new mutual fund purchase transaction through CAMS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="schemeCode">Scheme Code</Label>
                    <Input
                      id="schemeCode"
                      placeholder="Enter scheme code"
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
                  Setup New SIP
                </CardTitle>
                <CardDescription>
                  Set up a new Systematic Investment Plan through CAMS
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sipSchemeCode">Scheme Code</Label>
                    <Input
                      id="sipSchemeCode"
                      placeholder="Enter scheme code"
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
                      onValueChange={(value) => setSipForm(prev => ({ ...prev, frequency: value }))}
                    >
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        <SelectItem value="ANNUALLY">Annually</SelectItem>
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