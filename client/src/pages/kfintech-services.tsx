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
  Percent,
  Repeat,
  UserCog,
  Landmark,
  Shield,
  Phone,
  Mail,
  CreditCard,
  FileBarChart,
  UserPlus,
  Briefcase,
  Bell,
  Link,
  Activity,
  Target,
  ListFilter,
  BookOpen,
  Zap,
  Send,
  Eye,
  Trash2,
  ExternalLink,
  Info,
  FileCheck,
  GitCompare,
  Layers
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
  useIrisStp,
  useIrisSwp,
  useIrisStpCancel,
  useIrisSwpCancel,
  useIrisFdProducts,
  useIrisFdOrder,
  useIrisFdOrders,
  useIrisNpsSubscriber,
  useIrisNpsPortfolio,
  useIrisNpsOnboarding,
  useIrisNpsContribution,
  useIrisUpdateNominee,
  useIrisUpdateEmail,
  useIrisUpdateMobile,
  useIrisUpdateFatca,
  useIrisUpdateIdcw,
  useIrisUpdateBank,
  useIrisManageBankMandate,
  useIrisSubBrokers,
  useIrisAddEmployee,
  useIrisSipMaturityCalendar,
  useIrisDividendTracker,
  useIrisCreateMandate,
  // Phase 1
  useIrisSwitch,
  useIrisListEnach,
  useIrisCreateEnach,
  useIrisCancelEnach,
  useIrisRegenerateEnachLink,
  useIrisListUpiMandates,
  useIrisCreateUpiMandate,
  useIrisCancelUpiMandate,
  useIrisFolios,
  useIrisFolioTransactions,
  useIrisSendPortalLink,
  // Phase 2
  useIrisCommission,
  useIrisTrailCommission,
  useIrisCommissionSummary,
  useIrisOnboardingApplications,
  useIrisInitiateOnboarding,
  useIrisResendOnboardingLink,
  useIrisCasStatement,
  useIrisGenerateCas,
  useIrisPortfolioXirr,
  // Phase 3
  useIrisTopPerformers,
  useIrisSchemeCategories,
  useIrisInvestorRiskProfile,
  useIrisRiskQuestionnaire,
  useIrisSubmitRiskProfile,
  useIrisApplications,
  useIrisAlerts,
  useIrisCreateAlert,
  useIrisDeleteAlert,
  useIrisComplianceReport,
  useIrisPmlaReport,
  useIrisSendWhatsapp,
  useIrisNotificationTemplates,
  useIrisNotificationHistory,
  useIrisNfoSchemes,
  useIrisApplyNfo,
  useIrisNfoApplications,
  useIrisCancelNfo,
  useIrisCompareSchemes,
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
  const [nftPan, setNftPan] = useState<string>('');
  const [nftType, setNftType] = useState<string>('nominee');
  const [pranInput, setPranInput] = useState<string>('');
  const [fdPan, setFdPan] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [selectedFdProduct, setSelectedFdProduct] = useState<any>(null);
  const [nftFormData, setNftFormData] = useState<Record<string, string>>({});
  const [employeeFormData, setEmployeeFormData] = useState<Record<string, string>>({
    name: '', euinCode: '', mobile: '', email: '', role: 'AGENT'
  });
  const [activeTab, setActiveTab] = useState('portfolio');
  // Phase 1–3 state
  const [enachForm, setEnachForm] = useState<Record<string, string>>({ bankAccount: '', ifsc: '', bankName: '', accountHolder: '', amount: '', startDate: '' });
  const [upiForm, setUpiForm] = useState<Record<string, string>>({ upiId: '', amount: '', frequency: 'MONTHLY' });
  const [selectedFolio, setSelectedFolio] = useState<string>('');
  const [onboardingForm, setOnboardingForm] = useState<Record<string, string>>({ name: '', email: '', mobile: '', pan: '' });
  const [casParams, setCasParams] = useState<Record<string, string>>({ fromDate: '', toDate: '', type: 'DETAILED' });
  const [commissionParams, setCommissionParams] = useState<Record<string, string>>({ fromDate: '', toDate: '' });
  const [schemeResearchCode, setSchemeResearchCode] = useState<string>('');
  const [compareCodes, setCompareCodes] = useState<string>('');
  const [alertForm, setAlertForm] = useState<Record<string, string>>({ type: 'NAV', schemeCode: '', threshold: '', direction: 'ABOVE' });
  const [nfoApplyForm, setNfoApplyForm] = useState<Record<string, string>>({ schemeCode: '', amount: '', folioNumber: '' });
  const [whatsappForm, setWhatsappForm] = useState<Record<string, string>>({ mobile: '', template: '', message: '' });
  const [trackOrderId, setTrackOrderId] = useState<string>('');
  const [riskAnswers, setRiskAnswers] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // IRIS API hooks
  const stpMutation = useIrisStp();
  const swpMutation = useIrisSwp();
  const stpCancelMutation = useIrisStpCancel();
  const swpCancelMutation = useIrisSwpCancel();
  const fdOrderMutation = useIrisFdOrder();
  const npsOnboardingMutation = useIrisNpsOnboarding();
  const npsContributionMutation = useIrisNpsContribution();
  const updateNomineeMutation = useIrisUpdateNominee();
  const updateEmailMutation = useIrisUpdateEmail();
  const updateMobileMutation = useIrisUpdateMobile();
  const updateFatcaMutation = useIrisUpdateFatca();
  const updateIdcwMutation = useIrisUpdateIdcw();
  const updateBankMutation = useIrisUpdateBank();
  const manageBankMandateMutation = useIrisManageBankMandate();
  const addEmployeeMutation = useIrisAddEmployee();
  const createMandateMutation = useIrisCreateMandate();

  const fdProducts = useIrisFdProducts();
  const fdOrders = useIrisFdOrders(fdPan);
  const npsSubscriber = useIrisNpsSubscriber(pranInput);
  const npsPortfolio = useIrisNpsPortfolio(pranInput);
  const subBrokers = useIrisSubBrokers(employeeSearch ? { search: employeeSearch } : undefined);
  const sipMaturity = useIrisSipMaturityCalendar();
  const dividendTracker = useIrisDividendTracker();

  // Phase 1: Switch / eNACH / UPI / Folios
  const switchMutation = useIrisSwitch();
  const enachList = useIrisListEnach(selectedPan);
  const createEnachMutation = useIrisCreateEnach();
  const cancelEnachMutation = useIrisCancelEnach();
  const regenerateEnachMutation = useIrisRegenerateEnachLink();
  const upiList = useIrisListUpiMandates(selectedPan);
  const createUpiMutation = useIrisCreateUpiMandate();
  const cancelUpiMutation = useIrisCancelUpiMandate();
  const folioList = useIrisFolios(selectedPan);
  const folioTxns = useIrisFolioTransactions(selectedPan, selectedFolio);
  const sendPortalLinkMutation = useIrisSendPortalLink();

  // Phase 2: Commission / Onboarding / CAS / XIRR
  const commission = useIrisCommission(commissionParams.fromDate ? commissionParams : undefined);
  const trailCommission = useIrisTrailCommission(commissionParams.fromDate ? commissionParams : undefined);
  const commissionSummary = useIrisCommissionSummary();
  const onboardingApps = useIrisOnboardingApplications();
  const initiateOnboardingMutation = useIrisInitiateOnboarding();
  const resendOnboardingMutation = useIrisResendOnboardingLink();
  const casStatement = useIrisCasStatement(selectedPan, casParams.fromDate ? casParams : undefined);
  const generateCasMutation = useIrisGenerateCas();
  const portfolioXirr = useIrisPortfolioXirr(selectedPan);

  // Phase 3: Research / Risk / Tracking / Alerts / Compliance / WhatsApp / NFO
  const topPerformers = useIrisTopPerformers();
  const schemeCategories = useIrisSchemeCategories();
  const riskProfile = useIrisInvestorRiskProfile(selectedPan);
  const riskQuestionnaire = useIrisRiskQuestionnaire();
  const submitRiskMutation = useIrisSubmitRiskProfile();
  const applications = useIrisApplications();
  const alerts = useIrisAlerts(selectedPan);
  const createAlertMutation = useIrisCreateAlert();
  const deleteAlertMutation = useIrisDeleteAlert();
  const complianceReport = useIrisComplianceReport();
  const pmlaReport = useIrisPmlaReport();
  const sendWhatsappMutation = useIrisSendWhatsapp();
  const notificationTemplates = useIrisNotificationTemplates();
  const notificationHistory = useIrisNotificationHistory(selectedPan);
  const nfoSchemes = useIrisNfoSchemes();
  const applyNfoMutation = useIrisApplyNfo();
  const nfoApplications = useIrisNfoApplications(selectedPan);
  const cancelNfoMutation = useIrisCancelNfo();
  const compareSchemesMutation = useIrisCompareSchemes();

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
      case 'SUCCESS': case 'ACTIVE': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'PENDING': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'FAILED': case 'STOPPED': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'PAUSED': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
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
                <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800 dark:text-green-200">Valid Investor</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">
                    PAN verified with Kfintech records
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800 dark:text-red-200">Invalid PAN</AlertTitle>
                  <AlertDescription className="text-red-700 dark:text-red-300">
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
            <TabsTrigger value="enach-mandates" data-testid="tab-enach">eNACH & UPI</TabsTrigger>
            <TabsTrigger value="folios" data-testid="tab-folios">Folios</TabsTrigger>
            <TabsTrigger value="schemes" data-testid="tab-schemes">Schemes</TabsTrigger>
            <TabsTrigger value="scheme-research" data-testid="tab-scheme-research">Research</TabsTrigger>
            <TabsTrigger value="nfo" data-testid="tab-nfo">NFO</TabsTrigger>
            <TabsTrigger value="statements" data-testid="tab-statements">Statements</TabsTrigger>
            <TabsTrigger value="cas-xirr" data-testid="tab-cas-xirr">CAS & XIRR</TabsTrigger>
            <TabsTrigger value="stp-swp" data-testid="tab-stp-swp">STP / SWP</TabsTrigger>
            <TabsTrigger value="non-financial" data-testid="tab-non-financial">Non-Financial</TabsTrigger>
            <TabsTrigger value="nps" data-testid="tab-nps">NPS</TabsTrigger>
            <TabsTrigger value="fd-orders" data-testid="tab-fd-orders">FD Orders</TabsTrigger>
            <TabsTrigger value="risk-profile" data-testid="tab-risk">Risk Profile</TabsTrigger>
            <TabsTrigger value="portal-onboarding" data-testid="tab-onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="commission" data-testid="tab-commission">Commission</TabsTrigger>
            <TabsTrigger value="order-tracking" data-testid="tab-tracking">Order Track</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">WhatsApp</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
            <TabsTrigger value="hierarchy" data-testid="tab-hierarchy">Hierarchy</TabsTrigger>
            <TabsTrigger value="bulk-reports" data-testid="tab-bulk-reports">Bulk Reports</TabsTrigger>
          </ScrollableTabsList>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio" className="space-y-6">
            {portfolioLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                <span>Loading portfolio...</span>
              </div>
            ) : portfolioError ? (
              <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800 dark:text-red-200">Error Loading Portfolio</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
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
                            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">SIP Available</Badge>
                          )}
                          <Badge variant="outline">{scheme.category}</Badge>
                          {scheme.exitLoad && (
                            <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
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

          {/* STP / SWP Tab */}
          <TabsContent value="stp-swp" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Repeat className="h-5 w-5 text-blue-600" />Systematic Transfer Plan (STP)</CardTitle>
                  <CardDescription>Transfer fixed amount from one scheme to another on a regular basis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Investor PAN</Label>
                    <Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" onChange={e => setNftPan(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label>Source Scheme Code</Label>
                    <Input placeholder="e.g. HDFC001G" onChange={e => setNftFormData(p => ({ ...p, fromSchemeCode: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Scheme Code</Label>
                    <Input placeholder="e.g. HDFC002G" onChange={e => setNftFormData(p => ({ ...p, toSchemeCode: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Source Folio Number</Label>
                    <Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, fromFolioNumber: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" placeholder="1000" onChange={e => setNftFormData(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, frequency: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                          <SelectItem value="WEEKLY">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" onChange={e => setNftFormData(p => ({ ...p, startDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date (optional)</Label>
                      <Input type="date" onChange={e => setNftFormData(p => ({ ...p, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={stpMutation.isPending}
                    onClick={() => stpMutation.mutate({ pan: nftPan, ...nftFormData }, {
                      onSuccess: () => toast({ title: 'STP Registered', description: 'Your STP has been registered successfully.' }),
                      onError: (e: any) => toast({ title: 'STP Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >
                    {stpMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Processing...</> : 'Register STP'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-orange-600" />Systematic Withdrawal Plan (SWP)</CardTitle>
                  <CardDescription>Withdraw a fixed amount from your MF investment at regular intervals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Investor PAN</Label>
                    <Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" onChange={e => setNftPan(e.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label>Scheme Code</Label>
                    <Input placeholder="e.g. HDFC001G" onChange={e => setNftFormData(p => ({ ...p, swpSchemeCode: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Folio Number</Label>
                    <Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, swpFolioNumber: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Account (for credit)</Label>
                    <Input placeholder="Bank account number" onChange={e => setNftFormData(p => ({ ...p, swpBankAccount: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input type="number" placeholder="5000" onChange={e => setNftFormData(p => ({ ...p, swpAmount: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, swpFrequency: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" onChange={e => setNftFormData(p => ({ ...p, swpStartDate: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date (optional)</Label>
                      <Input type="date" onChange={e => setNftFormData(p => ({ ...p, swpEndDate: e.target.value }))} />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={swpMutation.isPending}
                    onClick={() => swpMutation.mutate({
                      pan: nftPan, schemeCode: nftFormData.swpSchemeCode, folioNumber: nftFormData.swpFolioNumber,
                      bankAccount: nftFormData.swpBankAccount, amount: Number(nftFormData.swpAmount),
                      frequency: nftFormData.swpFrequency, startDate: nftFormData.swpStartDate, endDate: nftFormData.swpEndDate,
                    }, {
                      onSuccess: () => toast({ title: 'SWP Registered', description: 'Your SWP has been registered successfully.' }),
                      onError: (e: any) => toast({ title: 'SWP Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >
                    {swpMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Processing...</> : 'Register SWP'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cancel / Pause Systematic Plans</CardTitle>
                <CardDescription>Stop or pause an active STP or SWP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Type</Label>
                    <Select defaultValue="STP">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STP">STP</SelectItem>
                        <SelectItem value="SWP">SWP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Plan / Registration Number</Label>
                    <Input placeholder="Plan ID" onChange={e => setNftFormData(p => ({ ...p, cancelPlanId: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Investor PAN</Label>
                    <Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" onChange={e => setNftFormData(p => ({ ...p, cancelPan: e.target.value.toUpperCase() }))} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="destructive" disabled={stpCancelMutation.isPending || swpCancelMutation.isPending}
                    onClick={() => stpCancelMutation.mutate({ planId: nftFormData.cancelPlanId, pan: nftFormData.cancelPan }, {
                      onSuccess: () => toast({ title: 'Plan Cancelled' }),
                      onError: (e: any) => toast({ title: 'Cancel Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >Cancel Plan</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Non-Financial Transactions Tab */}
          <TabsContent value="non-financial" className="space-y-6">
            <Alert>
              <UserCog className="h-4 w-4" />
              <AlertTitle>Non-Financial Transactions</AlertTitle>
              <AlertDescription>Update investor account details without any monetary movement. All changes are subject to AMC verification.</AlertDescription>
            </Alert>

            <div className="space-y-2 mb-4">
              <Label>Investor PAN (for all non-financial updates)</Label>
              <div className="flex gap-2">
                <Input placeholder="ABCDE1234F" maxLength={10} className="uppercase max-w-xs"
                  value={nftPan} onChange={e => setNftPan(e.target.value.toUpperCase())} />
                <Select value={nftType} onValueChange={setNftType}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nominee">Update Nominee</SelectItem>
                    <SelectItem value="email">Change Email</SelectItem>
                    <SelectItem value="mobile">Change Mobile</SelectItem>
                    <SelectItem value="fatca">FATCA / CRS</SelectItem>
                    <SelectItem value="idcw">Change IDCW Option</SelectItem>
                    <SelectItem value="bank">Change Bank Details</SelectItem>
                    <SelectItem value="bank-mandate">Bank Mandate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {nftType === 'nominee' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Update Nominee</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nominee Name</Label><Input placeholder="Full name" onChange={e => setNftFormData(p => ({ ...p, nomineeName: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Relationship</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, relationship: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SPOUSE">Spouse</SelectItem>
                          <SelectItem value="CHILD">Child</SelectItem>
                          <SelectItem value="PARENT">Parent</SelectItem>
                          <SelectItem value="SIBLING">Sibling</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" onChange={e => setNftFormData(p => ({ ...p, nomineeDob: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, nomineeFolio: e.target.value }))} /></div>
                  </div>
                  <Button disabled={updateNomineeMutation.isPending}
                    onClick={() => updateNomineeMutation.mutate({ pan: nftPan, nomineeName: nftFormData.nomineeName, relationship: nftFormData.relationship, dateOfBirth: nftFormData.nomineeDob, folioNumber: nftFormData.nomineeFolio }, {
                      onSuccess: () => toast({ title: 'Nominee Updated', description: 'Nominee updated successfully. AMC verification pending.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateNomineeMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Updating...</> : 'Update Nominee'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'email' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-green-600" />Change Email Address</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>New Email Address</Label><Input type="email" placeholder="investor@email.com" onChange={e => setNftFormData(p => ({ ...p, newEmail: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, emailFolio: e.target.value }))} /></div>
                  <Button disabled={updateEmailMutation.isPending}
                    onClick={() => updateEmailMutation.mutate({ pan: nftPan, email: nftFormData.newEmail, folioNumber: nftFormData.emailFolio }, {
                      onSuccess: () => toast({ title: 'Email Updated', description: 'Email change request submitted. OTP verification may be required.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateEmailMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Updating...</> : 'Update Email'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'mobile' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-purple-600" />Change Mobile Number</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>New Mobile Number</Label><Input placeholder="10-digit mobile" maxLength={10} onChange={e => setNftFormData(p => ({ ...p, newMobile: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, mobileFolio: e.target.value }))} /></div>
                  <Button disabled={updateMobileMutation.isPending}
                    onClick={() => updateMobileMutation.mutate({ pan: nftPan, mobile: nftFormData.newMobile, folioNumber: nftFormData.mobileFolio }, {
                      onSuccess: () => toast({ title: 'Mobile Updated', description: 'Mobile update request submitted. OTP verification required.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateMobileMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Updating...</> : 'Update Mobile'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'fatca' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-600" />FATCA / CRS Declaration</CardTitle>
                <CardDescription>Foreign Account Tax Compliance Act — required for investors with foreign tax residency</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Tax Residency Country</Label><Input placeholder="e.g. IN" onChange={e => setNftFormData(p => ({ ...p, taxCountry: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Tax Identification Number (TIN)</Label><Input placeholder="TIN / SSN / NIN" onChange={e => setNftFormData(p => ({ ...p, tin: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Place of Birth</Label><Input placeholder="City, Country" onChange={e => setNftFormData(p => ({ ...p, placeOfBirth: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Nationality</Label><Input placeholder="e.g. Indian" onChange={e => setNftFormData(p => ({ ...p, nationality: e.target.value }))} /></div>
                  </div>
                  <Button disabled={updateFatcaMutation.isPending}
                    onClick={() => updateFatcaMutation.mutate({ pan: nftPan, taxResidencyCountry: nftFormData.taxCountry, tin: nftFormData.tin, placeOfBirth: nftFormData.placeOfBirth, nationality: nftFormData.nationality }, {
                      onSuccess: () => toast({ title: 'FATCA Updated', description: 'FATCA/CRS declaration submitted successfully.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateFatcaMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Submitting...</> : 'Submit FATCA Declaration'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'idcw' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-yellow-600" />Change IDCW Option</CardTitle>
                <CardDescription>Change Income Distribution cum Capital Withdrawal (dividend) preference</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, idcwFolio: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>IDCW Option</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, idcwOption: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select IDCW option" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAYOUT">Payout (receive in bank)</SelectItem>
                        <SelectItem value="REINVESTMENT">Reinvestment (buy more units)</SelectItem>
                        <SelectItem value="GROWTH">Growth (no dividend)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button disabled={updateIdcwMutation.isPending}
                    onClick={() => updateIdcwMutation.mutate({ pan: nftPan, folioNumber: nftFormData.idcwFolio, idcwOption: nftFormData.idcwOption }, {
                      onSuccess: () => toast({ title: 'IDCW Updated', description: 'Dividend preference changed successfully.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateIdcwMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Updating...</> : 'Update IDCW Option'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'bank' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-indigo-600" />Change Bank Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Bank Account Number</Label><Input placeholder="Account number" onChange={e => setNftFormData(p => ({ ...p, bankAccNo: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>IFSC Code</Label><Input placeholder="SBIN0000001" maxLength={11} className="uppercase" onChange={e => setNftFormData(p => ({ ...p, bankIfsc: e.target.value.toUpperCase() }))} /></div>
                    <div className="space-y-2"><Label>Bank Name</Label><Input placeholder="Bank name" onChange={e => setNftFormData(p => ({ ...p, bankName: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Account Type</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, bankAccType: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SAVINGS">Savings</SelectItem>
                          <SelectItem value="CURRENT">Current</SelectItem>
                          <SelectItem value="NRE">NRE</SelectItem>
                          <SelectItem value="NRO">NRO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, bankFolio: e.target.value }))} /></div>
                  <Button disabled={updateBankMutation.isPending}
                    onClick={() => updateBankMutation.mutate({ pan: nftPan, accountNumber: nftFormData.bankAccNo, ifscCode: nftFormData.bankIfsc, bankName: nftFormData.bankName, accountType: nftFormData.bankAccType, folioNumber: nftFormData.bankFolio }, {
                      onSuccess: () => toast({ title: 'Bank Updated', description: 'Bank change request submitted. Verification pending.' }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{updateBankMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Updating...</> : 'Update Bank Details'}</Button>
                </CardContent>
              </Card>
            )}

            {nftType === 'bank-mandate' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-teal-600" />Manage Bank Mandates</CardTitle>
                <CardDescription>Add or remove bank accounts linked to your MF folios</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Action</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, mandateAction: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADD">Add Bank Mandate</SelectItem>
                          <SelectItem value="DELETE">Delete Bank Mandate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Bank Account Number</Label><Input placeholder="Account number" onChange={e => setNftFormData(p => ({ ...p, mandateBankAcc: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>IFSC Code</Label><Input placeholder="SBIN0000001" maxLength={11} className="uppercase" onChange={e => setNftFormData(p => ({ ...p, mandateIfsc: e.target.value.toUpperCase() }))} /></div>
                    <div className="space-y-2"><Label>Folio Number</Label><Input placeholder="Folio number" onChange={e => setNftFormData(p => ({ ...p, mandateFolio: e.target.value }))} /></div>
                  </div>
                  <Button disabled={manageBankMandateMutation.isPending}
                    onClick={() => manageBankMandateMutation.mutate({ pan: nftPan, action: nftFormData.mandateAction, accountNumber: nftFormData.mandateBankAcc, ifscCode: nftFormData.mandateIfsc, folioNumber: nftFormData.mandateFolio }, {
                      onSuccess: () => toast({ title: 'Mandate Updated', description: `Bank mandate ${nftFormData.mandateAction === 'ADD' ? 'added' : 'removed'} successfully.` }),
                      onError: (e: any) => toast({ title: 'Update Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{manageBankMandateMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Processing...</> : 'Submit Request'}</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* NPS Tab */}
          <TabsContent value="nps" className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>National Pension System (NPS)</AlertTitle>
              <AlertDescription>KFintech is India's largest NPS CRA. Access subscriber lookup, onboarding, and contribution via the IRIS NPS API stack. PFRDA-approved POP required for live transactions.</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Subscriber Lookup</CardTitle>
                  <CardDescription>Look up NPS subscriber details by PRAN</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="12-digit PRAN" maxLength={12} value={pranInput} onChange={e => setPranInput(e.target.value)} className="font-mono" />
                    <Button variant="outline" onClick={() => npsSubscriber.refetch()} disabled={npsSubscriber.isFetching}><Search className="h-4 w-4" /></Button>
                  </div>
                  {npsSubscriber.isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                  {npsSubscriber.data && (
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Name</span><span className="font-medium">{npsSubscriber.data.subscriberName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">PRAN</span><span className="font-mono">{npsSubscriber.data.pran}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">POP</span><span className="font-medium">{npsSubscriber.data.popName}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Account Type</span><Badge>{npsSubscriber.data.accountType ?? 'Tier-I'}</Badge></div>
                      <div className="flex justify-between"><span className="text-muted-foreground text-sm">Status</span>
                        <Badge variant={npsSubscriber.data.status === 'ACTIVE' ? 'default' : 'secondary'}>{npsSubscriber.data.status}</Badge>
                      </div>
                    </div>
                  )}
                  {npsPortfolio.data && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-sm font-medium text-muted-foreground">Portfolio</p>
                      {Array.isArray(npsPortfolio.data?.funds) && npsPortfolio.data.funds.map((fund: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{fund.fundName}</span>
                          <span className="font-medium">₹{fund.currentValue?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Corpus</span>
                        <span>₹{npsPortfolio.data?.totalValue?.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Place NPS Contribution</CardTitle>
                  <CardDescription>Make Tier-I or Tier-II contribution for a subscriber</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>PRAN</Label><Input placeholder="12-digit PRAN" maxLength={12} onChange={e => setNftFormData(p => ({ ...p, npsContribPran: e.target.value }))} className="font-mono" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Account Type</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, npsAccType: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TIER1">Tier-I (Pension)</SelectItem>
                          <SelectItem value="TIER2">Tier-II (Savings)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" placeholder="500" onChange={e => setNftFormData(p => ({ ...p, npsContribAmount: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-2"><Label>Payment Reference</Label><Input placeholder="UTR / Transaction ref" onChange={e => setNftFormData(p => ({ ...p, npsPaymentRef: e.target.value }))} /></div>
                  <Button className="w-full" disabled={npsContributionMutation.isPending}
                    onClick={() => npsContributionMutation.mutate({ pran: nftFormData.npsContribPran, accountType: nftFormData.npsAccType, amount: Number(nftFormData.npsContribAmount), paymentReference: nftFormData.npsPaymentRef }, {
                      onSuccess: () => toast({ title: 'Contribution Placed', description: 'NPS contribution submitted successfully.' }),
                      onError: (e: any) => toast({ title: 'Contribution Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{npsContributionMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Processing...</> : 'Place Contribution'}</Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>New Subscriber Onboarding</CardTitle>
                <CardDescription>Register a new NPS subscriber (PFRDA-registered POP required)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input placeholder="As per Aadhaar" onChange={e => setNftFormData(p => ({ ...p, npsName: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>PAN</Label><Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" onChange={e => setNftFormData(p => ({ ...p, npsPan: e.target.value.toUpperCase() }))} /></div>
                  <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" onChange={e => setNftFormData(p => ({ ...p, npsDob: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Mobile</Label><Input placeholder="10-digit" maxLength={10} onChange={e => setNftFormData(p => ({ ...p, npsMobile: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@example.com" onChange={e => setNftFormData(p => ({ ...p, npsEmail: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Account Type</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, npsNewAccType: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TIER1">Tier-I Only</SelectItem>
                        <SelectItem value="TIER1_TIER2">Tier-I + Tier-II</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button disabled={npsOnboardingMutation.isPending}
                  onClick={() => npsOnboardingMutation.mutate({ name: nftFormData.npsName, pan: nftFormData.npsPan, dateOfBirth: nftFormData.npsDob, mobile: nftFormData.npsMobile, email: nftFormData.npsEmail, accountType: nftFormData.npsNewAccType }, {
                    onSuccess: () => toast({ title: 'Onboarding Initiated', description: 'NPS subscriber onboarding process started. Aadhaar eKYC will be triggered.' }),
                    onError: (e: any) => toast({ title: 'Onboarding Failed', description: e.message, variant: 'destructive' }),
                  })}
                >{npsOnboardingMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Initiating...</> : <><UserPlus className="h-4 w-4 mr-2" />Initiate Onboarding</>}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FD Orders Tab */}
          <TabsContent value="fd-orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-green-600" />Fixed Deposit Products</CardTitle>
                <CardDescription>Browse available FD products from empanelled providers and place investments</CardDescription>
              </CardHeader>
              <CardContent>
                {fdProducts.isLoading && <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                {fdProducts.data && Array.isArray(fdProducts.data) && fdProducts.data.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fdProducts.data.map((product: any, i: number) => (
                      <div key={i} className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedFdProduct?.productId === product.productId ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                        onClick={() => setSelectedFdProduct(product)}>
                        <div className="font-semibold text-sm">{product.bankName || product.issuerName}</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">{product.interestRate}%</div>
                        <div className="text-xs text-muted-foreground">p.a. for {product.tenure}</div>
                        <div className="text-xs mt-2">Min: ₹{product.minimumAmount?.toLocaleString('en-IN') || '10,000'}</div>
                        {product.seniorCitizenRate && <Badge variant="secondary" className="mt-2 text-xs">Senior: {product.seniorCitizenRate}%</Badge>}
                      </div>
                    ))}
                  </div>
                ) : !fdProducts.isLoading && (
                  <div className="text-center py-8 text-muted-foreground">No FD products available. Complete FD empanelment first.</div>
                )}
              </CardContent>
            </Card>

            {selectedFdProduct && (
              <Card>
                <CardHeader>
                  <CardTitle>Place FD Order — {selectedFdProduct.bankName || selectedFdProduct.issuerName}</CardTitle>
                  <CardDescription>{selectedFdProduct.interestRate}% p.a. for {selectedFdProduct.tenure}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Investor PAN</Label><Input placeholder="ABCDE1234F" maxLength={10} className="uppercase" value={fdPan} onChange={e => setFdPan(e.target.value.toUpperCase())} /></div>
                    <div className="space-y-2"><Label>Investment Amount (₹)</Label><Input type="number" placeholder="10000" onChange={e => setNftFormData(p => ({ ...p, fdAmount: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Tenure</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, fdTenure: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select tenure" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6M">6 Months</SelectItem>
                          <SelectItem value="1Y">1 Year</SelectItem>
                          <SelectItem value="2Y">2 Years</SelectItem>
                          <SelectItem value="3Y">3 Years</SelectItem>
                          <SelectItem value="5Y">5 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Interest Payout</Label>
                      <Select onValueChange={v => setNftFormData(p => ({ ...p, fdInterestPayout: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select payout" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MONTHLY">Monthly</SelectItem>
                          <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                          <SelectItem value="CUMULATIVE">Cumulative (at maturity)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Bank Account</Label><Input placeholder="Account number for interest credit" onChange={e => setNftFormData(p => ({ ...p, fdBankAcc: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>IFSC Code</Label><Input placeholder="SBIN0000001" maxLength={11} className="uppercase" onChange={e => setNftFormData(p => ({ ...p, fdIfsc: e.target.value.toUpperCase() }))} /></div>
                  </div>
                  <Button className="w-full" disabled={fdOrderMutation.isPending}
                    onClick={() => fdOrderMutation.mutate({ pan: fdPan, productId: selectedFdProduct.productId, amount: Number(nftFormData.fdAmount), tenure: nftFormData.fdTenure, interestPayout: nftFormData.fdInterestPayout, bankAccount: nftFormData.fdBankAcc, ifscCode: nftFormData.fdIfsc }, {
                      onSuccess: () => toast({ title: 'FD Order Placed', description: 'Fixed Deposit order submitted successfully. Confirmation will be sent via email.' }),
                      onError: (e: any) => toast({ title: 'Order Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{fdOrderMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Placing Order...</> : <><Landmark className="h-4 w-4 mr-2" />Place FD Order</>}</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle>My FD Orders</CardTitle><CardDescription>Track FD investments placed through IRIS</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Enter PAN to view FD orders" maxLength={10} className="uppercase max-w-xs"
                    value={fdPan} onChange={e => setFdPan(e.target.value.toUpperCase())} />
                </div>
                {fdOrders.data && Array.isArray(fdOrders.data) && fdOrders.data.length > 0 ? (
                  <div className="space-y-3">
                    {fdOrders.data.map((order: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                        <div>
                          <div className="font-medium">{order.bankName}</div>
                          <div className="text-sm text-muted-foreground">{order.tenure} | {order.interestRate}% p.a.</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₹{order.amount?.toLocaleString('en-IN')}</div>
                          <Badge variant={order.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1">{order.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : fdPan.length === 10 && !fdOrders.isLoading ? (
                  <div className="text-center py-6 text-muted-foreground">No FD orders found for this PAN.</div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Hierarchy Tab */}
          <TabsContent value="hierarchy" className="space-y-6">
            <Alert>
              <Briefcase className="h-4 w-4" />
              <AlertTitle>Business Hierarchy Management</AlertTitle>
              <AlertDescription>Manage sub-brokers, employees and service managers under your ARN. Each employee gets a unique EUIN code for MF transaction tracking as per SEBI guidelines.</AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Sub-Brokers & Employees</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input placeholder="Search by name or EUIN" value={employeeSearch}
                      onChange={e => setEmployeeSearch(e.target.value)} />
                    <Button variant="outline" onClick={() => subBrokers.refetch()} disabled={subBrokers.isFetching}><RefreshCw className={`h-4 w-4 ${subBrokers.isFetching ? 'animate-spin' : ''}`} /></Button>
                  </div>
                  {subBrokers.isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                  {subBrokers.data && Array.isArray(subBrokers.data) && subBrokers.data.length > 0 ? (
                    <div className="space-y-2">
                      {subBrokers.data.map((broker: any, i: number) => (
                        <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <div className="font-medium">{broker.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">EUIN: {broker.euinCode}</div>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{broker.role}</Badge>
                            <div className="text-xs text-muted-foreground mt-1">{broker.mobile}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !subBrokers.isLoading && (
                    <div className="text-center py-6 text-muted-foreground">No sub-brokers found. Add employees to get started.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-green-600" />Add Employee / Sub-Broker</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Full Name</Label><Input placeholder="Employee full name" value={employeeFormData.name} onChange={e => setEmployeeFormData(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Mobile</Label><Input placeholder="10-digit mobile" maxLength={10} value={employeeFormData.mobile} onChange={e => setEmployeeFormData(p => ({ ...p, mobile: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="employee@firm.com" value={employeeFormData.email} onChange={e => setEmployeeFormData(p => ({ ...p, email: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>EUIN Code (if existing)</Label><Input placeholder="E-123456" value={employeeFormData.euinCode} onChange={e => setEmployeeFormData(p => ({ ...p, euinCode: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Role</Label>
                    <Select value={employeeFormData.role} onValueChange={v => setEmployeeFormData(p => ({ ...p, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AGENT">Agent</SelectItem>
                        <SelectItem value="SUB_BROKER">Sub-Broker</SelectItem>
                        <SelectItem value="SERVICE_MANAGER">Service Manager</SelectItem>
                        <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" disabled={addEmployeeMutation.isPending}
                    onClick={() => addEmployeeMutation.mutate(employeeFormData, {
                      onSuccess: () => { toast({ title: 'Employee Added', description: 'Employee added. EUIN will be assigned by AMFI.' }); setEmployeeFormData({ name: '', euinCode: '', mobile: '', email: '', role: 'AGENT' }); },
                      onError: (e: any) => toast({ title: 'Add Failed', description: e.message, variant: 'destructive' }),
                    })}
                  >{addEmployeeMutation.isPending ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Adding...</> : <><UserPlus className="h-4 w-4 mr-2" />Add Employee</>}</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Bulk Reports Tab */}
          <TabsContent value="bulk-reports" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-blue-600" />Bulk Capital Gains</CardTitle>
                  <CardDescription>Generate capital gains statements for all clients under your ARN</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Financial Year</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, cgFy: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select FY" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2024-25">FY 2024-25</SelectItem>
                        <SelectItem value="2023-24">FY 2023-24</SelectItem>
                        <SelectItem value="2022-23">FY 2022-23</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Report Format</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, cgFormat: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="EXCEL">Excel</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" variant="outline" onClick={() => toast({ title: 'Report Queued', description: 'Bulk capital gains report will be emailed to your registered email.' })}>
                    <Download className="h-4 w-4 mr-2" />Generate Bulk CG Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-orange-600" />SIP Maturity Calendar</CardTitle>
                  <CardDescription>View upcoming SIP payment dates across all investor accounts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Next N Days</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, sipMaturityDays: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">Next 7 days</SelectItem>
                        <SelectItem value="15">Next 15 days</SelectItem>
                        <SelectItem value="30">Next 30 days</SelectItem>
                        <SelectItem value="90">Next 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {sipMaturity.isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                  {sipMaturity.data && Array.isArray(sipMaturity.data) && sipMaturity.data.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {sipMaturity.data.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm border-b pb-1">
                          <span>{item.investorName}</span>
                          <span className="text-muted-foreground">{item.nextSipDate} — ₹{item.sipAmount?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">Select a range to view upcoming SIP dates</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-600" />Dividend Tracker</CardTitle>
                  <CardDescription>Track dividend payouts and reinvestments across all client folios</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label>From Date</Label><Input type="date" onChange={e => setNftFormData(p => ({ ...p, divFromDate: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>To Date</Label><Input type="date" onChange={e => setNftFormData(p => ({ ...p, divToDate: e.target.value }))} /></div>
                  </div>
                  {dividendTracker.isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                  {dividendTracker.data && Array.isArray(dividendTracker.data) && dividendTracker.data.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {dividendTracker.data.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm border-b pb-1">
                          <div><div>{item.schemeName}</div><div className="text-xs text-muted-foreground">{item.investorName}</div></div>
                          <div className="text-right"><div className="font-medium text-green-600">₹{item.dividendAmount?.toLocaleString('en-IN')}</div><div className="text-xs text-muted-foreground">{item.payoutDate}</div></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">Select date range to view dividends</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bulk Portfolio Report</CardTitle>
                <CardDescription>Export complete portfolio summary for all investors under your ARN</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>As of Date</Label><Input type="date" onChange={e => setNftFormData(p => ({ ...p, portfolioAsOf: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Report Format</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, portfolioFormat: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF</SelectItem>
                        <SelectItem value="EXCEL">Excel</SelectItem>
                        <SelectItem value="CSV">CSV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Group By</Label>
                    <Select onValueChange={v => setNftFormData(p => ({ ...p, portfolioGroupBy: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select grouping" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INVESTOR">By Investor</SelectItem>
                        <SelectItem value="AMC">By AMC</SelectItem>
                        <SelectItem value="CATEGORY">By Category</SelectItem>
                        <SelectItem value="EUIN">By EUIN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => toast({ title: 'Report Queued', description: 'Bulk portfolio report will be generated and emailed to your registered address.' })}>
                  <Download className="h-4 w-4 mr-2" />Generate Bulk Portfolio Report
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── eNACH & UPI Mandates Tab ─────────────────────────────────────── */}
          <TabsContent value="enach-mandates" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* eNACH Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />eNACH Mandates</CardTitle>
                  <CardDescription>Electronic NACH — net banking auto-debit for SIPs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {enachList.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : enachList.data?.length > 0 ? (
                    <div className="space-y-2">
                      {enachList.data.map((m: any) => (
                        <div key={m.mandateId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{m.bankName} — ****{m.accountNo?.slice(-4)}</p>
                            <p className="text-xs text-muted-foreground">₹{m.amount?.toLocaleString()} | {m.status}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => regenerateEnachMutation.mutate(m.mandateId)}>
                              <Link className="h-3 w-3 mr-1" />Link
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => cancelEnachMutation.mutate(m.mandateId)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No eNACH mandates found</p>
                  )}
                  <Separator />
                  <p className="text-xs font-semibold">Register New eNACH</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[['Bank Account No.', 'bankAccount'], ['IFSC Code', 'ifsc'], ['Bank Name', 'bankName'], ['Account Holder', 'accountHolder']].map(([label, key]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input className="h-8 text-sm" value={enachForm[key]} onChange={e => setEnachForm(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <Label className="text-xs">Max Amount (₹)</Label>
                      <Input className="h-8 text-sm" type="number" value={enachForm.amount} onChange={e => setEnachForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Start Date</Label>
                      <Input className="h-8 text-sm" type="date" value={enachForm.startDate} onChange={e => setEnachForm(p => ({ ...p, startDate: e.target.value }))} />
                    </div>
                  </div>
                  <Button className="w-full" disabled={createEnachMutation.isPending} onClick={() => createEnachMutation.mutate({ pan: selectedPan, ...enachForm }, {
                    onSuccess: () => toast({ title: 'eNACH Initiated', description: 'Mandate registration link sent. Investor must authorize via net banking.' }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {createEnachMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Register eNACH Mandate
                  </Button>
                </CardContent>
              </Card>

              {/* UPI Autopay Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" />UPI Autopay Mandates</CardTitle>
                  <CardDescription>UPI recurring mandate for SIP payments (post-2022 mandatory)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {upiList.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : upiList.data?.length > 0 ? (
                    <div className="space-y-2">
                      {upiList.data.map((m: any) => (
                        <div key={m.umrn} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{m.upiId}</p>
                            <p className="text-xs text-muted-foreground">₹{m.amount?.toLocaleString()} | {m.frequency} | {m.status}</p>
                          </div>
                          <Button size="sm" variant="destructive" onClick={() => cancelUpiMutation.mutate(m.umrn)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No UPI mandates found</p>
                  )}
                  <Separator />
                  <p className="text-xs font-semibold">Create UPI Autopay Mandate</p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">UPI ID (e.g. name@upi)</Label>
                      <Input className="h-8 text-sm" value={upiForm.upiId} onChange={e => setUpiForm(p => ({ ...p, upiId: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Amount (₹)</Label>
                        <Input className="h-8 text-sm" type="number" value={upiForm.amount} onChange={e => setUpiForm(p => ({ ...p, amount: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Frequency</Label>
                        <Select value={upiForm.frequency} onValueChange={v => setUpiForm(p => ({ ...p, frequency: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                            <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" disabled={createUpiMutation.isPending} onClick={() => createUpiMutation.mutate({ pan: selectedPan, ...upiForm }, {
                    onSuccess: () => toast({ title: 'UPI Mandate Created', description: 'Mandate request sent to investor\'s UPI app for approval.' }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {createUpiMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Create UPI Autopay
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Folios Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="folios" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5" />Folio Management</CardTitle>
                <CardDescription>View all folios, scheme-level holdings and folio transactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {folioList.isLoading ? (
                  <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                ) : folioList.data?.length > 0 ? (
                  <div className="space-y-2">
                    {folioList.data.map((f: any) => (
                      <div key={f.folioNumber} className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedFolio === f.folioNumber ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedFolio(f.folioNumber)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{f.folioNumber}</p>
                            <p className="text-xs text-muted-foreground">{f.schemeName}</p>
                            <p className="text-xs text-muted-foreground">{f.amcName} | {f.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-sm">₹{f.currentValue?.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{f.units?.toFixed(3)} units</p>
                            <Badge variant={f.gainLoss >= 0 ? 'default' : 'destructive'} className="text-xs mt-1">
                              {f.gainLoss >= 0 ? '+' : ''}{f.gainLossPercentage?.toFixed(2)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No folios found for this PAN</p>
                  </div>
                )}
                {selectedFolio && (
                  <>
                    <Separator />
                    <p className="text-xs font-semibold">Transactions — Folio {selectedFolio}</p>
                    {folioTxns.isLoading ? (
                      <div className="flex justify-center py-4"><RefreshCw className="h-4 w-4 animate-spin" /></div>
                    ) : folioTxns.data?.length > 0 ? (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {folioTxns.data.map((t: any, i: number) => (
                          <div key={i} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                            <span>{t.date} — {t.type}</span>
                            <span className="font-medium">₹{t.amount?.toLocaleString()} ({t.units} units @ ₹{t.nav})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">No transactions for this folio</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Scheme Research Tab ─────────────────────────────────────────── */}
          <TabsContent value="scheme-research" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Scheme Explorer</CardTitle>
                  <CardDescription>NAV history, performance, holdings, factsheet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Enter scheme code (e.g. 120503)" value={schemeResearchCode} onChange={e => setSchemeResearchCode(e.target.value)} />
                    <Button variant="outline" size="sm" onClick={() => setSchemeResearchCode(schemeResearchCode)}><Search className="h-4 w-4" /></Button>
                  </div>
                  {schemeResearchCode && (
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: 'NAV History', description: `Fetching NAV history for ${schemeResearchCode}` })}>
                          <BarChart3 className="h-3 w-3 mr-1" />NAV History
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: 'Performance', description: `Fetching performance for ${schemeResearchCode}` })}>
                          <TrendingUp className="h-3 w-3 mr-1" />Performance
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: 'Holdings', description: `Fetching portfolio holdings for ${schemeResearchCode}` })}>
                          <PieChart className="h-3 w-3 mr-1" />Holdings
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => toast({ title: 'Factsheet', description: `Fetching factsheet for ${schemeResearchCode}` })}>
                          <FileCheck className="h-3 w-3 mr-1" />Factsheet
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><GitCompare className="h-5 w-5" />Compare Schemes</CardTitle>
                  <CardDescription>Side-by-side comparison of 2–4 schemes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scheme Codes (comma-separated)</Label>
                    <Input placeholder="e.g. 120503,119598,118989" value={compareCodes} onChange={e => setCompareCodes(e.target.value)} />
                  </div>
                  <Button className="w-full" disabled={compareSchemesMutation.isPending} onClick={() => {
                    const codes = compareCodes.split(',').map(c => c.trim()).filter(Boolean);
                    if (codes.length < 2) { toast({ title: 'Enter at least 2 scheme codes', variant: 'destructive' }); return; }
                    compareSchemesMutation.mutate(codes, {
                      onSuccess: (d: any) => toast({ title: 'Comparison Ready', description: `Compared ${codes.length} schemes successfully` }),
                      onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                    });
                  }}>
                    {compareSchemesMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <GitCompare className="h-4 w-4 mr-2" />}
                    Compare Schemes
                  </Button>
                  {compareSchemesMutation.data && (
                    <div className="mt-3 p-3 bg-muted/30 rounded-lg text-sm">
                      <p className="font-semibold mb-2">Comparison Result</p>
                      <pre className="text-xs overflow-auto max-h-48">{JSON.stringify(compareSchemesMutation.data, null, 2)}</pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Top Performers</CardTitle>
                  <CardDescription>Best performing schemes across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  {topPerformers.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : topPerformers.data?.length > 0 ? (
                    <div className="space-y-2">
                      {topPerformers.data.slice(0, 10).map((s: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-2 bg-muted/30 rounded text-sm">
                          <div>
                            <p className="font-medium">{s.schemeName}</p>
                            <p className="text-xs text-muted-foreground">{s.category} | NAV ₹{s.nav}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-600 font-semibold">{s.returns1Y?.toFixed(2)}%</p>
                            <p className="text-xs text-muted-foreground">1Y return</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No performance data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ListFilter className="h-5 w-5" />Scheme Categories</CardTitle>
                  <CardDescription>SEBI scheme taxonomy — category-wise listing</CardDescription>
                </CardHeader>
                <CardContent>
                  {schemeCategories.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : schemeCategories.data?.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {schemeCategories.data.map((cat: any, i: number) => (
                        <Badge key={i} variant="outline" className="cursor-pointer text-xs" onClick={() => toast({ title: cat.name, description: `${cat.schemeCount} schemes` })}>
                          {cat.name} ({cat.schemeCount})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <ListFilter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Category data will load here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── NFO Tab ─────────────────────────────────────────────────────── */}
          <TabsContent value="nfo" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Active NFOs</CardTitle>
                  <CardDescription>New Fund Offers currently open for subscription</CardDescription>
                </CardHeader>
                <CardContent>
                  {nfoSchemes.isLoading ? (
                    <div className="flex justify-center py-8"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : nfoSchemes.data?.length > 0 ? (
                    <div className="space-y-3">
                      {nfoSchemes.data.map((nfo: any) => (
                        <div key={nfo.schemeCode} className={`p-3 border rounded-lg cursor-pointer transition-colors ${nfoApplyForm.schemeCode === nfo.schemeCode ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                          onClick={() => setNfoApplyForm(p => ({ ...p, schemeCode: nfo.schemeCode }))}>
                          <div className="flex justify-between">
                            <div>
                              <p className="font-medium text-sm">{nfo.schemeName}</p>
                              <p className="text-xs text-muted-foreground">{nfo.amcName} | {nfo.category}</p>
                              <p className="text-xs text-muted-foreground">Closes: {nfo.closureDate}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">Min: ₹{nfo.minimumAmount?.toLocaleString()}</p>
                              <Badge variant="default" className="text-xs mt-1">OPEN</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No active NFOs at this time</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Apply for NFO</CardTitle>
                  <CardDescription>Subscribe to a New Fund Offer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Scheme Code</Label>
                      <Input className="h-8 text-sm" value={nfoApplyForm.schemeCode} onChange={e => setNfoApplyForm(p => ({ ...p, schemeCode: e.target.value }))} placeholder="Select from list or enter code" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Investment Amount (₹)</Label>
                      <Input className="h-8 text-sm" type="number" value={nfoApplyForm.amount} onChange={e => setNfoApplyForm(p => ({ ...p, amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Folio Number (optional)</Label>
                      <Input className="h-8 text-sm" value={nfoApplyForm.folioNumber} onChange={e => setNfoApplyForm(p => ({ ...p, folioNumber: e.target.value }))} placeholder="Leave blank for new folio" />
                    </div>
                  </div>
                  <Button className="w-full" disabled={applyNfoMutation.isPending} onClick={() => applyNfoMutation.mutate({ pan: selectedPan, ...nfoApplyForm }, {
                    onSuccess: () => toast({ title: 'NFO Application Submitted', description: 'Your NFO subscription has been placed.' }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {applyNfoMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                    Apply for NFO
                  </Button>
                  {nfoApplications.data?.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold">Your NFO Applications</p>
                      <div className="space-y-2">
                        {nfoApplications.data.map((app: any) => (
                          <div key={app.applicationId} className="flex justify-between items-center p-2 bg-muted/30 rounded text-sm">
                            <div>
                              <p className="font-medium text-xs">{app.schemeName}</p>
                              <p className="text-xs text-muted-foreground">₹{app.amount?.toLocaleString()} | {app.status}</p>
                            </div>
                            {app.status === 'PENDING' && (
                              <Button size="sm" variant="destructive" onClick={() => cancelNfoMutation.mutate(app.applicationId)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── CAS & XIRR Tab ──────────────────────────────────────────────── */}
          <TabsContent value="cas-xirr" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" />CAS Statement</CardTitle>
                  <CardDescription>Consolidated Account Statement across all RTAs (CAMS + KFintech)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">From Date</Label>
                      <Input className="h-8 text-sm" type="date" value={casParams.fromDate} onChange={e => setCasParams(p => ({ ...p, fromDate: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Date</Label>
                      <Input className="h-8 text-sm" type="date" value={casParams.toDate} onChange={e => setCasParams(p => ({ ...p, toDate: e.target.value }))} />
                    </div>
                  </div>
                  <Select value={casParams.type} onValueChange={v => setCasParams(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DETAILED">Detailed</SelectItem>
                      <SelectItem value="SUMMARY">Summary</SelectItem>
                    </SelectContent>
                  </Select>
                  {casStatement.isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>}
                  {casStatement.data && (
                    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Total Value</span>
                        <span className="font-bold">₹{casStatement.data?.totalValue?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Cost</span>
                        <span>₹{casStatement.data?.totalCost?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>P&L</span>
                        <span className={casStatement.data?.pnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          ₹{casStatement.data?.pnl?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button className="w-full" variant="outline" disabled={generateCasMutation.isPending} onClick={() => generateCasMutation.mutate({ pan: selectedPan, ...casParams }, {
                    onSuccess: () => toast({ title: 'CAS Generated', description: 'Statement emailed to registered email address.' }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {generateCasMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Generate & Email CAS
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />XIRR & Returns</CardTitle>
                  <CardDescription>Portfolio-level XIRR and annualised returns analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {portfolioXirr.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : portfolioXirr.data ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg text-center">
                        <p className="text-3xl font-bold text-primary">{portfolioXirr.data?.xirr?.toFixed(2)}%</p>
                        <p className="text-sm text-muted-foreground mt-1">Portfolio XIRR (Annualised)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ['Invested', `₹${portfolioXirr.data?.invested?.toLocaleString()}`],
                          ['Current Value', `₹${portfolioXirr.data?.currentValue?.toLocaleString()}`],
                          ['Absolute Return', `${portfolioXirr.data?.absoluteReturn?.toFixed(2)}%`],
                          ['Gain/Loss', `₹${portfolioXirr.data?.gainLoss?.toLocaleString()}`],
                        ].map(([k, v]) => (
                          <div key={k} className="p-2 bg-muted/30 rounded text-center">
                            <p className="text-xs text-muted-foreground">{k}</p>
                            <p className="font-semibold text-sm">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">XIRR data will appear here once transactions are loaded</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Risk Profile Tab ─────────────────────────────────────────────── */}
          <TabsContent value="risk-profile" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Investor Risk Profile</CardTitle>
                  <CardDescription>SEBI-mandated risk profiling — maps to suitable scheme categories</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {riskProfile.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : riskProfile.data ? (
                    <div className="space-y-3">
                      <div className="p-4 text-center border rounded-lg">
                        <p className="text-2xl font-bold text-primary">{riskProfile.data?.riskCategory}</p>
                        <p className="text-sm text-muted-foreground">Risk Category</p>
                        <p className="text-xs mt-1 text-muted-foreground">Score: {riskProfile.data?.score}/100</p>
                        <p className="text-xs text-muted-foreground">Last updated: {riskProfile.data?.updatedAt}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-semibold mb-2">Recommended Allocation</p>
                        {riskProfile.data?.recommendedAllocation && Object.entries(riskProfile.data.recommendedAllocation).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-sm">
                            <span>{k}</span><span className="font-medium">{v as string}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No risk profile found. Complete the questionnaire.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5" />Risk Questionnaire</CardTitle>
                  <CardDescription>Complete investor risk assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {riskQuestionnaire.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : riskQuestionnaire.data?.questions?.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                      {riskQuestionnaire.data.questions.map((q: any) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm font-medium">{q.question}</p>
                          <div className="space-y-1">
                            {q.options.map((opt: any) => (
                              <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="radio" name={q.id} value={opt.value} checked={riskAnswers[q.id] === opt.value}
                                  onChange={() => setRiskAnswers(p => ({ ...p, [q.id]: opt.value }))} />
                                {opt.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                      <Button className="w-full" disabled={submitRiskMutation.isPending} onClick={() => submitRiskMutation.mutate({ pan: selectedPan, body: { answers: riskAnswers } }, {
                        onSuccess: () => toast({ title: 'Risk Profile Submitted', description: 'Profile has been saved and scheme recommendations updated.' }),
                        onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                      })}>
                        {submitRiskMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Submit Risk Profile
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Questionnaire not available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Portal & Onboarding Tab ──────────────────────────────────────── */}
          <TabsContent value="portal-onboarding" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ExternalLink className="h-5 w-5" />Investor Self-Service Portal</CardTitle>
                  <CardDescription>Generate one-time link for investor to access KFintech portal directly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Portal Link</AlertTitle>
                    <AlertDescription>The generated link is valid for 24 hours and allows the investor to view holdings, statements, and request non-financial updates independently.</AlertDescription>
                  </Alert>
                  <Button className="w-full" disabled={sendPortalLinkMutation.isPending} onClick={() => sendPortalLinkMutation.mutate({ pan: selectedPan }, {
                    onSuccess: (d: any) => toast({ title: 'Portal Link Sent', description: d?.message ?? 'Link sent to investor\'s registered email and mobile.' }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {sendPortalLinkMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                    Send Portal Link to Investor
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Digital Investor Onboarding</CardTitle>
                  <CardDescription>Initiate eKYC + account opening via IRIS digital flow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[['Full Name', 'name'], ['PAN', 'pan'], ['Email', 'email'], ['Mobile', 'mobile']].map(([label, key]) => (
                      <div key={key} className="space-y-1">
                        <Label className="text-xs">{label}</Label>
                        <Input className="h-8 text-sm" value={onboardingForm[key]} onChange={e => setOnboardingForm(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" disabled={initiateOnboardingMutation.isPending} onClick={() => initiateOnboardingMutation.mutate(onboardingForm, {
                    onSuccess: (d: any) => toast({ title: 'Onboarding Initiated', description: `Application ID: ${d?.applicationId}. Link sent to investor.` }),
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {initiateOnboardingMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Initiate Onboarding
                  </Button>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Onboarding Applications</CardTitle>
                </CardHeader>
                <CardContent>
                  {onboardingApps.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : onboardingApps.data?.length > 0 ? (
                    <div className="space-y-2">
                      {onboardingApps.data.map((app: any) => (
                        <div key={app.applicationId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{app.name} — {app.pan}</p>
                            <p className="text-xs text-muted-foreground">App ID: {app.applicationId} | {app.createdAt}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={app.status === 'COMPLETED' ? 'default' : app.status === 'PENDING' ? 'secondary' : 'destructive'}>
                              {app.status}
                            </Badge>
                            {app.status === 'PENDING' && (
                              <Button size="sm" variant="outline" onClick={() => resendOnboardingMutation.mutate(app.applicationId, {
                                onSuccess: () => toast({ title: 'Link Resent', description: `Onboarding link resent to ${app.email}` }),
                              })}>
                                <Send className="h-3 w-3 mr-1" />Resend
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No onboarding applications found</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Commission Tab ───────────────────────────────────────────────── */}
          <TabsContent value="commission" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" />Commission & Trail Summary</CardTitle>
                <CardDescription>Upfront + trail commissions from AMCs — SEBI AMFI reporting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">From Date</Label>
                    <Input className="h-8 text-sm" type="date" value={commissionParams.fromDate} onChange={e => setCommissionParams(p => ({ ...p, fromDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">To Date</Label>
                    <Input className="h-8 text-sm" type="date" value={commissionParams.toDate} onChange={e => setCommissionParams(p => ({ ...p, toDate: e.target.value }))} />
                  </div>
                </div>
                {commissionSummary.data && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Total Upfront', `₹${commissionSummary.data?.totalUpfront?.toLocaleString()}`],
                      ['Total Trail', `₹${commissionSummary.data?.totalTrail?.toLocaleString()}`],
                      ['This Month', `₹${commissionSummary.data?.thisMonth?.toLocaleString()}`],
                      ['This Year', `₹${commissionSummary.data?.thisYear?.toLocaleString()}`],
                    ].map(([k, v]) => (
                      <div key={k} className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">{k}</p>
                        <p className="font-bold text-sm">{v}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-3">
                  {commission.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : commission.data?.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {commission.data.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm p-2 bg-muted/20 rounded">
                          <span>{c.amcName} — {c.schemeName}</span>
                          <span className="font-medium">₹{c.amount?.toLocaleString()} ({c.type})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Percent className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a date range to view commission details</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Order Tracking Tab ───────────────────────────────────────────── */}
          <TabsContent value="order-tracking" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Track Order</CardTitle>
                  <CardDescription>Real-time order status with live updates every 15s</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Enter Order / Application ID" value={trackOrderId} onChange={e => setTrackOrderId(e.target.value)} />
                    <Button variant="outline" size="sm" onClick={() => setTrackOrderId(trackOrderId)}><Search className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Recent Applications</CardTitle>
                  <CardDescription>All pending and recent MF orders — auto-refreshes every 30s</CardDescription>
                </CardHeader>
                <CardContent>
                  {applications.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : applications.data?.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {applications.data.map((app: any) => (
                        <div key={app.applicationId} className="p-2 border rounded-lg text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{app.schemeName}</span>
                            <Badge variant={app.status === 'PROCESSED' ? 'default' : app.status === 'PENDING' ? 'secondary' : 'destructive'} className="text-xs">
                              {app.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{app.applicationId} | ₹{app.amount?.toLocaleString()} | {app.type}</p>
                          <p className="text-xs text-muted-foreground">{app.date}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No pending applications</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Alerts Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="alerts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Active Alerts</CardTitle>
                  <CardDescription>NAV, portfolio value, and SIP reminders</CardDescription>
                </CardHeader>
                <CardContent>
                  {alerts.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : alerts.data?.length > 0 ? (
                    <div className="space-y-2">
                      {alerts.data.map((alert: any) => (
                        <div key={alert.alertId} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{alert.type} Alert — {alert.schemeCode ?? 'Portfolio'}</p>
                            <p className="text-xs text-muted-foreground">
                              {alert.direction} ₹{alert.threshold} | {alert.active ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                          <Button size="sm" variant="destructive" onClick={() => deleteAlertMutation.mutate(alert.alertId)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No alerts configured</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Create Alert</CardTitle>
                  <CardDescription>Get notified when NAV or portfolio crosses thresholds</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Alert Type</Label>
                      <Select value={alertForm.type} onValueChange={v => setAlertForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NAV">NAV Alert</SelectItem>
                          <SelectItem value="PORTFOLIO">Portfolio Value</SelectItem>
                          <SelectItem value="SIP">SIP Reminder</SelectItem>
                          <SelectItem value="DIVIDEND">Dividend Declared</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Scheme Code (optional for portfolio alerts)</Label>
                      <Input className="h-8 text-sm" value={alertForm.schemeCode} onChange={e => setAlertForm(p => ({ ...p, schemeCode: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Threshold Value (₹)</Label>
                        <Input className="h-8 text-sm" type="number" value={alertForm.threshold} onChange={e => setAlertForm(p => ({ ...p, threshold: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Direction</Label>
                        <Select value={alertForm.direction} onValueChange={v => setAlertForm(p => ({ ...p, direction: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ABOVE">Above threshold</SelectItem>
                            <SelectItem value="BELOW">Below threshold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" disabled={createAlertMutation.isPending} onClick={() => createAlertMutation.mutate({ pan: selectedPan, ...alertForm }, {
                    onSuccess: () => { toast({ title: 'Alert Created', description: 'You will be notified via email and push when the condition is met.' }); setAlertForm({ type: 'NAV', schemeCode: '', threshold: '', direction: 'ABOVE' }); },
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {createAlertMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                    Create Alert
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── WhatsApp Notifications Tab ───────────────────────────────────── */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Send WhatsApp Notification</CardTitle>
                  <CardDescription>Send templated WhatsApp messages to investors via KFintech Business API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Mobile Number (with country code)</Label>
                      <Input className="h-8 text-sm" placeholder="+919876543210" value={whatsappForm.mobile} onChange={e => setWhatsappForm(p => ({ ...p, mobile: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Template</Label>
                      <Select value={whatsappForm.template} onValueChange={v => setWhatsappForm(p => ({ ...p, template: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select template" /></SelectTrigger>
                        <SelectContent>
                          {notificationTemplates.data?.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                          <SelectItem value="SIP_REMINDER">SIP Payment Reminder</SelectItem>
                          <SelectItem value="NAV_ALERT">NAV Alert</SelectItem>
                          <SelectItem value="PORTFOLIO_STATEMENT">Portfolio Statement</SelectItem>
                          <SelectItem value="TRANSACTION_CONFIRMATION">Transaction Confirmation</SelectItem>
                          <SelectItem value="REDEMPTION_PROCESSED">Redemption Processed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custom Message (optional)</Label>
                      <Input className="h-8 text-sm" value={whatsappForm.message} onChange={e => setWhatsappForm(p => ({ ...p, message: e.target.value }))} placeholder="Additional message parameters" />
                    </div>
                  </div>
                  <Button className="w-full" disabled={sendWhatsappMutation.isPending} onClick={() => sendWhatsappMutation.mutate({ pan: selectedPan, ...whatsappForm }, {
                    onSuccess: () => { toast({ title: 'WhatsApp Sent', description: 'Message delivered via KFintech Business API.' }); setWhatsappForm({ mobile: '', template: '', message: '' }); },
                    onError: (e: any) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
                  })}>
                    {sendWhatsappMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Send WhatsApp Message
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Notification History</CardTitle>
                  <CardDescription>All outbound communications for this investor</CardDescription>
                </CardHeader>
                <CardContent>
                  {notificationHistory.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : notificationHistory.data?.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {notificationHistory.data.map((n: any, i: number) => (
                        <div key={i} className="p-2 bg-muted/30 rounded text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{n.template}</span>
                            <Badge variant={n.status === 'DELIVERED' ? 'default' : 'secondary'} className="text-xs">{n.status}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{n.channel} | {n.sentAt}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications sent yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Compliance / AML Tab ─────────────────────────────────────────── */}
          <TabsContent value="compliance" className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Compliance Reports — Admin Only</AlertTitle>
              <AlertDescription>PMLA/AML reports are generated for regulatory filing. All access is logged.</AlertDescription>
            </Alert>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />PMLA / AML Report</CardTitle>
                  <CardDescription>Prevention of Money Laundering Act compliance data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pmlaReport.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : pmlaReport.data ? (
                    <div className="p-3 bg-muted/30 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between"><span>High Value Txns (&gt;₹10L)</span><span className="font-semibold">{pmlaReport.data?.highValueCount}</span></div>
                      <div className="flex justify-between"><span>Suspicious Patterns</span><span className="font-semibold text-red-600">{pmlaReport.data?.suspiciousCount}</span></div>
                      <div className="flex justify-between"><span>STR Filed</span><span className="font-semibold">{pmlaReport.data?.strFiled}</span></div>
                      <div className="flex justify-between"><span>Period</span><span>{pmlaReport.data?.period}</span></div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">PMLA report data will load here</p>
                    </div>
                  )}
                  <Button className="w-full" variant="outline" onClick={() => toast({ title: 'AML Report', description: 'Generating full AML report for regulatory submission...' })}>
                    <Download className="h-4 w-4 mr-2" />Download PMLA Report
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5" />Compliance Summary</CardTitle>
                  <CardDescription>Overall compliance health and pending actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {complianceReport.isLoading ? (
                    <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                  ) : complianceReport.data ? (
                    <div className="space-y-2 text-sm">
                      {[
                        ['KYC Expiring (30d)', complianceReport.data?.kycExpiring, 'text-yellow-600'],
                        ['KYC Expired', complianceReport.data?.kycExpired, 'text-red-600'],
                        ['FATCA Pending', complianceReport.data?.fatcaPending, 'text-orange-600'],
                        ['Nominee Missing', complianceReport.data?.nomineeMissing, 'text-orange-600'],
                        ['Compliant Investors', complianceReport.data?.compliant, 'text-green-600'],
                      ].map(([k, v, cls]) => (
                        <div key={k} className="flex justify-between p-2 bg-muted/20 rounded">
                          <span>{k}</span><span className={`font-semibold ${cls}`}>{v ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileBarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Compliance data will load here</p>
                    </div>
                  )}
                  <Button className="w-full" variant="outline" onClick={() => toast({ title: 'Compliance Report', description: 'Generating compliance summary report...' })}>
                    <Download className="h-4 w-4 mr-2" />Download Compliance Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}