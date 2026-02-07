import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Users, 
  BarChart3, 
  Download, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  ArrowLeftRight,
  Percent
} from 'lucide-react';
import { 
  useKfintechPortfolio, 
  useKfintechTransactions, 
  useKfintechSips, 
  useKfintechSchemes, 
  useKfintechInvestorValidation,
  useKfintechPurchase,
  useKfintechRedemption,
  useKfintechSipSetup,
  useKfintechSipCancel,
  useKfintechStatementGeneration,
  useKfintechSwitchTransaction
} from '@/hooks/use-kfintech';
import { useToast } from '@/hooks/use-toast';

const panSchema = z.object({
  pan: z.string().min(10, 'PAN must be 10 characters').max(10, 'PAN must be 10 characters')
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
});

const purchaseSchema = z.object({
  schemeCode: z.string().min(1, 'Scheme is required'),
  amount: z.number().min(100, 'Minimum investment is ₹100'),
  folioNumber: z.string().optional(),
  investorName: z.string().min(1, 'Investor name is required'),
  bankAccount: z.string().min(1, 'Bank account is required'),
  ifscCode: z.string().min(11, 'Valid IFSC code required').max(11, 'Valid IFSC code required'),
});

const sipSchema = z.object({
  schemeCode: z.string().min(1, 'Scheme is required'),
  amount: z.number().min(100, 'Minimum SIP amount is ₹100'),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  folioNumber: z.string().optional(),
  investorName: z.string().min(1, 'Investor name is required'),
  bankAccount: z.string().min(1, 'Bank account is required'),
  ifscCode: z.string().min(11, 'Valid IFSC code required').max(11, 'Valid IFSC code required'),
});

const switchSchema = z.object({
  fromSchemeCode: z.string().min(1, 'Source scheme is required'),
  toSchemeCode: z.string().min(1, 'Target scheme is required'),
  fromFolioNumber: z.string().min(1, 'Source folio is required'),
  toFolioNumber: z.string().optional(),
  amount: z.number().min(100, 'Minimum switch amount is ₹100').optional(),
  units: z.number().min(0.001, 'Minimum units is 0.001').optional(),
  switchType: z.enum(['FULL', 'PARTIAL']),
});

export default function KfintechServices() {
  const [selectedPan, setSelectedPan] = useState<string>('');
  const [activeTab, setActiveTab] = useState('portfolio');
  const { toast } = useToast();

  // Form setups
  const panForm = useForm<z.infer<typeof panSchema>>({
    resolver: zodResolver(panSchema),
    defaultValues: { pan: '' }
  });

  const purchaseForm = useForm<z.infer<typeof purchaseSchema>>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      schemeCode: '',
      amount: 100,
      folioNumber: '',
      investorName: '',
      bankAccount: '',
      ifscCode: ''
    }
  });

  const sipForm = useForm<z.infer<typeof sipSchema>>({
    resolver: zodResolver(sipSchema),
    defaultValues: {
      schemeCode: '',
      amount: 100,
      frequency: 'MONTHLY',
      startDate: '',
      endDate: '',
      folioNumber: '',
      investorName: '',
      bankAccount: '',
      ifscCode: ''
    }
  });

  const switchForm = useForm<z.infer<typeof switchSchema>>({
    resolver: zodResolver(switchSchema),
    defaultValues: {
      fromSchemeCode: '',
      toSchemeCode: '',
      fromFolioNumber: '',
      toFolioNumber: '',
      switchType: 'PARTIAL'
    }
  });

  // API hooks
  const { data: portfolioData, isLoading: portfolioLoading, error: portfolioError } = useKfintechPortfolio(selectedPan);
  const { data: transactionData, isLoading: transactionLoading } = useKfintechTransactions(selectedPan);
  const { data: sipData, isLoading: sipLoading } = useKfintechSips(selectedPan);
  const { data: schemes, isLoading: schemesLoading } = useKfintechSchemes();
  const { data: investorValidation, isLoading: validationLoading } = useKfintechInvestorValidation(selectedPan);

  // Mutations
  const purchaseMutation = useKfintechPurchase();
  const redemptionMutation = useKfintechRedemption();
  const sipSetupMutation = useKfintechSipSetup();
  const sipCancelMutation = useKfintechSipCancel();
  const statementMutation = useKfintechStatementGeneration();
  const switchMutation = useKfintechSwitchTransaction();

  const handlePanSubmit = (data: z.infer<typeof panSchema>) => {
    setSelectedPan(data.pan);
    toast({
      title: "PAN Updated",
      description: `Now showing data for PAN: ${data.pan}`,
    });
  };

  const handlePurchase = (data: z.infer<typeof purchaseSchema>) => {
    purchaseMutation.mutate({
      pan: selectedPan,
      ...data
    }, {
      onSuccess: () => {
        toast({
          title: "Purchase Order Submitted",
          description: "Your mutual fund purchase order has been submitted successfully.",
        });
        purchaseForm.reset();
      },
      onError: (error) => {
        toast({
          title: "Purchase Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleSipSetup = (data: z.infer<typeof sipSchema>) => {
    sipSetupMutation.mutate({
      pan: selectedPan,
      ...data
    }, {
      onSuccess: () => {
        toast({
          title: "SIP Setup Successful",
          description: "Your SIP has been set up successfully.",
        });
        sipForm.reset();
      },
      onError: (error) => {
        toast({
          title: "SIP Setup Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleSwitch = (data: z.infer<typeof switchSchema>) => {
    switchMutation.mutate({
      pan: selectedPan,
      ...data
    }, {
      onSuccess: () => {
        toast({
          title: "Switch Order Submitted",
          description: "Your fund switch order has been submitted successfully.",
        });
        switchForm.reset();
      },
      onError: (error) => {
        toast({
          title: "Switch Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleGenerateStatement = () => {
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    statementMutation.mutate({
      pan: selectedPan,
      fromDate: oneYearAgo.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0],
      format: 'PDF'
    }, {
      onSuccess: () => {
        toast({
          title: "Statement Generated",
          description: "Your account statement has been generated and will be sent to your registered email.",
        });
      },
      onError: (error) => {
        toast({
          title: "Statement Generation Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': case 'STOPPED': return 'bg-red-100 text-red-800';
      case 'PAUSED': return 'bg-blue-100 text-blue-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Kfintech Services</h1>
          <p className="text-muted-foreground mt-2" data-testid="page-description">
            Advanced mutual fund registrar services and portfolio management
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-purple-600" />
          <span className="text-lg font-semibold text-purple-600">Kfintech</span>
        </div>
      </div>

      {/* PAN Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>Investor Lookup</span>
          </CardTitle>
          <CardDescription>
            Enter your PAN to access Kfintech mutual fund services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...panForm}>
            <form onSubmit={panForm.handleSubmit(handlePanSubmit)} className="flex items-end space-x-4">
              <FormField
                control={panForm.control}
                name="pan"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>PAN Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="ABCDE1234F" 
                        className="uppercase"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        data-testid="input-pan"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" data-testid="button-submit-pan">
                Search
              </Button>
            </form>
          </Form>

          {/* Investor Validation Status */}
          {selectedPan && (
            <div className="mt-4">
              {validationLoading ? (
                <Alert>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <AlertTitle>Validating...</AlertTitle>
                  <AlertDescription>Verifying investor details with Kfintech</AlertDescription>
                </Alert>
              ) : investorValidation ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Valid Investor</AlertTitle>
                  <AlertDescription className="text-green-700">
                    PAN verified with Kfintech records
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Invalid PAN</AlertTitle>
                  <AlertDescription className="text-red-700">
                    PAN not found in Kfintech records
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      {selectedPan && investorValidation && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-sip">SIP</TabsTrigger>
            <TabsTrigger value="purchase" data-testid="tab-purchase">Purchase</TabsTrigger>
            <TabsTrigger value="switch" data-testid="tab-switch">Switch</TabsTrigger>
            <TabsTrigger value="schemes" data-testid="tab-schemes">Schemes</TabsTrigger>
            <TabsTrigger value="statements" data-testid="tab-statements">Statements</TabsTrigger>
          </ScrollableTabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            {portfolioLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Loading portfolio...</span>
              </div>
            ) : portfolioError ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Error Loading Portfolio</AlertTitle>
                <AlertDescription className="text-red-700">
                  Unable to fetch portfolio data. Please try again.
                </AlertDescription>
              </Alert>
            ) : portfolioData ? (
              <>
                {/* Portfolio Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Current Value</p>
                          <p className="text-2xl font-bold" data-testid="text-portfolio-value">
                            {formatCurrency(portfolioData.totalPortfolioValue)}
                          </p>
                        </div>
                        <Wallet className="h-8 w-8 text-purple-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Investment Value</p>
                          <p className="text-2xl font-bold" data-testid="text-investment-value">
                            {formatCurrency(portfolioData.totalInvestmentValue)}
                          </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                          <p className={`text-2xl font-bold ${portfolioData.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`} 
                             data-testid="text-gain-loss">
                            {formatCurrency(portfolioData.totalGainLoss)}
                          </p>
                        </div>
                        {portfolioData.totalGainLoss >= 0 ? (
                          <TrendingUp className="h-8 w-8 text-green-600" />
                        ) : (
                          <TrendingDown className="h-8 w-8 text-red-600" />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Return %</p>
                          <p className={`text-2xl font-bold ${portfolioData.totalGainLossPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}
                             data-testid="text-return-percentage">
                            {portfolioData.totalGainLossPercentage.toFixed(2)}%
                          </p>
                        </div>
                        <Percent className="h-8 w-8 text-indigo-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Holdings List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio Holdings</CardTitle>
                    <CardDescription>Your mutual fund investments with Kfintech</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {portfolioData.folios.map((folio, index) => (
                        <div key={index} className="border rounded-lg p-4" data-testid={`card-holding-${index}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{folio.schemeName}</h3>
                            <Badge variant="outline">{folio.amc}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Folio:</span>
                              <span className="ml-2 font-medium">{folio.folioNumber}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Units:</span>
                              <span className="ml-2 font-medium">{folio.units.toFixed(3)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">NAV:</span>
                              <span className="ml-2 font-medium">₹{folio.nav.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Current Value:</span>
                              <span className="ml-2 font-medium">{formatCurrency(folio.currentValue)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Gain/Loss:</span>
                              <span className={`ml-2 font-medium ${folio.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(folio.gainLoss)} ({folio.gainLossPercentage.toFixed(2)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Portfolio Data</h3>
                  <p className="text-muted-foreground">No mutual fund holdings found for this PAN.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {transactionLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Loading transactions...</span>
              </div>
            ) : transactionData && transactionData.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                  <CardDescription>Recent mutual fund transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactionData.map((transaction, index) => (
                      <div key={transaction.transactionId} className="border rounded-lg p-4" data-testid={`card-transaction-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {transaction.transactionType.includes('PURCHASE') || transaction.transactionType.includes('SWITCH_IN') ? (
                              <ArrowUpRight className="h-4 w-4 text-green-600" />
                            ) : transaction.transactionType.includes('SWITCH') ? (
                              <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-semibold">{transaction.transactionType.replace('_', ' ')}</span>
                          </div>
                          <Badge className={getStatusColor(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </div>
                        <h4 className="font-medium mb-2">{transaction.schemeName}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Folio:</span>
                            <span className="ml-2 font-medium">{transaction.folioNumber}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="ml-2 font-medium">{formatCurrency(transaction.amount)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Units:</span>
                            <span className="ml-2 font-medium">{transaction.units.toFixed(3)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">NAV:</span>
                            <span className="ml-2 font-medium">₹{transaction.nav.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Date:</span>
                            <span className="ml-2 font-medium">
                              {new Date(transaction.transactionDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Transactions</h3>
                  <p className="text-muted-foreground">No transaction history found for this PAN.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* SIP Tab */}
          <TabsContent value="sip" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active SIPs */}
              <Card>
                <CardHeader>
                  <CardTitle>Active SIPs</CardTitle>
                  <CardDescription>Your systematic investment plans</CardDescription>
                </CardHeader>
                <CardContent>
                  {sipLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      <span>Loading SIPs...</span>
                    </div>
                  ) : sipData && sipData.length > 0 ? (
                    <div className="space-y-4">
                      {sipData.map((sip, index) => (
                        <div key={sip.sipId} className="border rounded-lg p-4" data-testid={`card-sip-${index}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{sip.schemeName}</h4>
                            <Badge className={getStatusColor(sip.status)}>
                              {sip.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Amount:</span>
                              <span className="ml-2 font-medium">{formatCurrency(sip.amount)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Frequency:</span>
                              <span className="ml-2 font-medium">{sip.frequency}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Next Date:</span>
                              <span className="ml-2 font-medium">
                                {new Date(sip.nextInstallmentDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Progress:</span>
                              <span className="ml-2 font-medium">{sip.executedInstallments}/{sip.totalInstallments}</span>
                            </div>
                          </div>
                          {sip.status === 'ACTIVE' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => sipCancelMutation.mutate({ sipId: sip.sipId, pan: selectedPan })}
                              data-testid={`button-cancel-sip-${index}`}
                            >
                              Cancel SIP
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No active SIPs found</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Setup New SIP */}
              <Card>
                <CardHeader>
                  <CardTitle>Setup New SIP</CardTitle>
                  <CardDescription>Start a systematic investment plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...sipForm}>
                    <form onSubmit={sipForm.handleSubmit(handleSipSetup)} className="space-y-4">
                      <FormField
                        control={sipForm.control}
                        name="schemeCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Scheme</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-sip-scheme">
                                  <SelectValue placeholder="Select scheme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {schemes?.filter(s => s.sipAvailable).slice(0, 15).map((scheme) => (
                                  <SelectItem key={scheme.schemeCode} value={scheme.schemeCode}>
                                    {scheme.schemeName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={sipForm.control}
                          name="amount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Amount (₹)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field}
                                  onChange={(e) => field.onChange(Number(e.target.value))}
                                  data-testid="input-sip-amount"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={sipForm.control}
                          name="frequency"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-sip-frequency">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                  <SelectItem value="YEARLY">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={sipForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-sip-start-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={sipForm.control}
                        name="investorName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investor Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-sip-investor-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={sipForm.control}
                          name="bankAccount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Bank Account</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-sip-bank-account" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={sipForm.control}
                          name="ifscCode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IFSC Code</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  className="uppercase"
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                  data-testid="input-sip-ifsc"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={sipSetupMutation.isPending}
                        data-testid="button-setup-sip"
                      >
                        {sipSetupMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Setting up SIP...
                          </>
                        ) : (
                          'Setup SIP'
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Purchase Tab */}
          <TabsContent value="purchase" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Mutual Fund</CardTitle>
                <CardDescription>Invest in mutual fund schemes</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...purchaseForm}>
                  <form onSubmit={purchaseForm.handleSubmit(handlePurchase)} className="space-y-4">
                    <FormField
                      control={purchaseForm.control}
                      name="schemeCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scheme</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-purchase-scheme">
                                <SelectValue placeholder="Select scheme to invest" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {schemes?.slice(0, 20).map((scheme) => (
                                <SelectItem key={scheme.schemeCode} value={scheme.schemeCode}>
                                  <div className="flex flex-col">
                                    <span>{scheme.schemeName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {scheme.amc} | NAV: ₹{scheme.nav} | Min: {formatCurrency(scheme.minimumInvestment)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={purchaseForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investment Amount (₹)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                                data-testid="input-purchase-amount"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={purchaseForm.control}
                        name="folioNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Folio Number (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Existing folio number" data-testid="input-purchase-folio" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={purchaseForm.control}
                      name="investorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Investor Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-purchase-investor-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={purchaseForm.control}
                        name="bankAccount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Account Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-purchase-bank-account" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={purchaseForm.control}
                        name="ifscCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IFSC Code</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                className="uppercase"
                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                data-testid="input-purchase-ifsc"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={purchaseMutation.isPending}
                      data-testid="button-submit-purchase"
                    >
                      {purchaseMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Processing Purchase...
                        </>
                      ) : (
                        'Submit Purchase Order'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Switch Tab */}
          <TabsContent value="switch" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  <span>Fund Switch</span>
                </CardTitle>
                <CardDescription>Switch between mutual fund schemes</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...switchForm}>
                  <form onSubmit={switchForm.handleSubmit(handleSwitch)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={switchForm.control}
                        name="fromSchemeCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Scheme</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-from-scheme">
                                  <SelectValue placeholder="Select source scheme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {portfolioData?.folios.map((folio) => (
                                  <SelectItem key={folio.schemeCode} value={folio.schemeCode}>
                                    {folio.schemeName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={switchForm.control}
                        name="toSchemeCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>To Scheme</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-to-scheme">
                                  <SelectValue placeholder="Select target scheme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {schemes?.slice(0, 15).map((scheme) => (
                                  <SelectItem key={scheme.schemeCode} value={scheme.schemeCode}>
                                    {scheme.schemeName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={switchForm.control}
                        name="fromFolioNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Folio Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Source folio number" data-testid="input-from-folio" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={switchForm.control}
                        name="toFolioNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>To Folio Number (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Target folio number" data-testid="input-to-folio" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={switchForm.control}
                      name="switchType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Switch Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-switch-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FULL">Full Switch</SelectItem>
                              <SelectItem value="PARTIAL">Partial Switch</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={switchForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (₹) - Optional</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Switch amount"
                                data-testid="input-switch-amount"
                              />
                            </FormControl>
                            <FormDescription>Leave blank for full switch or specify units instead</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={switchForm.control}
                        name="units"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Units - Optional</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.001"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="Switch units"
                                data-testid="input-switch-units"
                              />
                            </FormControl>
                            <FormDescription>Specify either amount or units</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={switchMutation.isPending}
                      data-testid="button-submit-switch"
                    >
                      {switchMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Processing Switch...
                        </>
                      ) : (
                        'Submit Switch Order'
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schemes Tab */}
          <TabsContent value="schemes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available Schemes</CardTitle>
                <CardDescription>Browse mutual fund schemes available through Kfintech</CardDescription>
              </CardHeader>
              <CardContent>
                {schemesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading schemes...</span>
                  </div>
                ) : schemes && schemes.length > 0 ? (
                  <div className="space-y-4">
                    {schemes.slice(0, 12).map((scheme, index) => (
                      <div key={scheme.schemeCode} className="border rounded-lg p-4" data-testid={`card-scheme-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{scheme.schemeName}</h4>
                          <Badge variant="outline">{scheme.amc}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">NAV:</span>
                            <span className="ml-2 font-medium">₹{scheme.nav.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Min Investment:</span>
                            <span className="ml-2 font-medium">{formatCurrency(scheme.minimumInvestment)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">SIP Minimum:</span>
                            <span className="ml-2 font-medium">{formatCurrency(scheme.sipMinimum)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Risk Level:</span>
                            <span className="ml-2 font-medium">{scheme.riskLevel}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expense Ratio:</span>
                            <span className="ml-2 font-medium">{scheme.expenseRatio}%</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          {scheme.sipAvailable && (
                            <Badge className="bg-green-100 text-green-800">SIP Available</Badge>
                          )}
                          <Badge variant="outline">{scheme.category}</Badge>
                          {scheme.exitLoad && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800">
                              Exit Load: {scheme.exitLoad}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Schemes Available</h3>
                    <p className="text-muted-foreground">Unable to load scheme data at this time.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statements Tab */}
          <TabsContent value="statements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Statements</CardTitle>
                <CardDescription>Generate and download account statements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-8">
                  <Download className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">Generate Statement</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate your Kfintech account statement for the last 12 months
                  </p>
                  <Button 
                    onClick={handleGenerateStatement}
                    disabled={statementMutation.isPending}
                    data-testid="button-generate-statement"
                  >
                    {statementMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Generate PDF Statement
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}