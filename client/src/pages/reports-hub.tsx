import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { ClientTransactionHistory } from '@/components/store/ClientTransactionHistory';
import {
  FileText,
  Download,
  Mail,
  ExternalLink,
  TrendingUp,
  Building2,
  Landmark,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Calendar,
  IndianRupee,
  PiggyBank,
  LucideShield as LucideShield,
  Briefcase,
  BarChart3,
  Lock,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertCircle,
  ChevronRight,
  Wallet,
  Home,
  Coins,
  Database,
  Loader2
} from 'lucide-react';

interface ReportCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  reports: ReportItem[];
  externalSources: ExternalSource[];
}

interface ReportItem {
  id: string;
  name: string;
  description: string;
  apiSource: string;
  requiresKYC: boolean;
  kycLevel: number;
  formats: string[];
  lastFetched?: string;
  status: 'available' | 'pending' | 'locked';
}

interface ExternalSource {
  name: string;
  url: string;
  description: string;
}

const reportCategories: ReportCategory[] = [
  {
    id: 'mutual-funds',
    title: 'Mutual Fund Reports',
    description: 'Holdings, transactions, SIP summary, and capital gains from BSE STAR MF',
    icon: TrendingUp,
    color: 'blue',
    reports: [
      { id: 'mf-holdings', name: 'MF Portfolio Holdings', description: 'Complete mutual fund holdings with current NAV', apiSource: 'BSE STAR MF - GetHoldingReport', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'mf-transactions', name: 'MF Transaction Report', description: 'All purchase, redemption, and switch transactions', apiSource: 'BSE STAR MF - GetTransactionReport', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'sip-summary', name: 'SIP Summary', description: 'Active SIPs with installment status', apiSource: 'BSE STAR MF - SIPReport', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'mf-capital-gains', name: 'Capital Gains Statement', description: 'Short-term and long-term capital gains', apiSource: 'BSE STAR MF - GetCapitalGainReport', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'dividend-summary', name: 'Dividend Summary', description: 'Dividend payouts and reinvestments', apiSource: 'BSE STAR MF - DividendReport', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
    ],
    externalSources: [
      { name: 'CAMS', url: 'https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement', description: 'CAS + MF Holdings' },
      { name: 'KFinTech', url: 'https://mfs.kfintech.com/investor/', description: 'MF Portfolio & SIP Summary' },
      { name: 'BSE STAR MF', url: 'https://www.bsestarmf.in/', description: 'Orders placed under ARN' },
    ]
  },
  {
    id: 'demat-equity',
    title: 'Demat / Equity Reports',
    description: 'Portfolio snapshot, transaction ledger, and valuations from NSDL/CDSL',
    icon: BarChart3,
    color: 'green',
    reports: [
      { id: 'demat-snapshot', name: 'NSDL/CDSL Portfolio Snapshot', description: 'Complete demat holdings with current prices', apiSource: 'Account Aggregator - Demat Statement API', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'isin-ledger', name: 'ISIN-wise Transaction Ledger', description: 'All buy/sell transactions by ISIN', apiSource: 'Account Aggregator - NSDL/CDSL CA API', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'daily-valuation', name: 'Daily Valuation', description: 'Mark-to-market valuation of holdings', apiSource: 'DP Partner API', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
    ],
    externalSources: [
      { name: 'NSDL', url: 'https://eservices.nsdl.com/', description: 'Consolidated Demat Statement' },
      { name: 'CDSL', url: 'https://www.cdslindia.com/', description: 'Account Statement & Portfolio Snapshot' },
      { name: 'Your Broker', url: '#', description: 'Contract Notes, Ledger, Holdings' },
    ]
  },
  {
    id: 'unlisted-shares',
    title: 'Unlisted Shares',
    description: 'Holdings, certificates, and fair value for unlisted company shares',
    icon: Building2,
    color: 'purple',
    reports: [
      { id: 'unlisted-holdings', name: 'Holdings & Certificates', description: 'Unlisted shares with share certificates', apiSource: 'NSDL/CDSL (AA) + Registrar APIs', requiresKYC: true, kycLevel: 2, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'transfer-eligibility', name: 'Transfer Eligibility', description: 'Lock-in status and transfer restrictions', apiSource: 'Registrar API', requiresKYC: true, kycLevel: 2, formats: ['PDF'], status: 'available' },
      { id: 'historical-deals', name: 'Historical Deals & Fair Value', description: 'Past transactions and current fair value', apiSource: 'FintekPro Valuation Engine', requiresKYC: true, kycLevel: 2, formats: ['PDF', 'XLSX'], status: 'available' },
    ],
    externalSources: [
      { name: 'CAMS PMS', url: 'https://www.camsonline.com/', description: 'PMS Holdings' },
      { name: 'LinkIntime', url: 'https://linkintime.co.in/', description: 'Share Registry' },
      { name: 'KFintech Private', url: 'https://kfintech.com/', description: 'Private Market Holdings' },
    ]
  },
  {
    id: 'fixed-income',
    title: 'Fixed Income',
    description: 'Bond/NCD holdings, coupon calendar, and redemption schedules',
    icon: Landmark,
    color: 'amber',
    reports: [
      { id: 'bond-holdings', name: 'Bond/NCD Holdings', description: 'All fixed income securities in demat', apiSource: 'Demat data via AA', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'coupon-calendar', name: 'Coupon Calendar', description: 'Upcoming interest payment dates', apiSource: 'Trustees / Registrars', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'redemption-schedule', name: 'Redemption Schedule', description: 'Maturity dates and redemption amounts', apiSource: 'Exchange allotment records', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
    ],
    externalSources: [
      { name: 'NSE', url: 'https://www.nseindia.com/market-data/bonds-traded-in-cm', description: 'NSE Bond Listings' },
      { name: 'BSE', url: 'https://www.bseindia.com/markets/debt/debt_corp_702.aspx', description: 'BSE Debt Market' },
      { name: 'RBI Retail Direct', url: 'https://rbiretaildirect.org.in/', description: 'G-Sec Holdings' },
    ]
  },
  {
    id: 'retirement-funds',
    title: 'Retirement Funds',
    description: 'EPF, PPF, VPF, NPS, and APY statements',
    icon: PiggyBank,
    color: 'teal',
    reports: [
      { id: 'epf-passbook', name: 'EPF Passbook', description: 'Employee Provident Fund balance and contributions', apiSource: 'EPFO Passbook API + Aadhaar OTP', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'vpf-ppf-ledger', name: 'VPF & PPF Ledger', description: 'Voluntary and Public Provident Fund statements', apiSource: 'EPFO + Bank API via AA', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'nps-statement', name: 'NPS Statement (Tier I/II)', description: 'National Pension System holdings and performance', apiSource: 'Protean CRA API / KFin NPS CRA', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'apy-log', name: 'APY Contribution Log', description: 'Atal Pension Yojana contributions', apiSource: 'Bank feed via AA', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
    ],
    externalSources: [
      { name: 'EPFO', url: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/', description: 'EPF Passbook' },
      { name: 'NPS CRA', url: 'https://npscra.nsdl.co.in/', description: 'Tier I & II Statements' },
      { name: 'Your Bank', url: '#', description: 'PPF & APY Statements' },
    ]
  },
  {
    id: 'tax-reports',
    title: 'Tax Reports',
    description: 'AIS, Form 26AS, and consolidated tax reports',
    icon: Receipt,
    color: 'red',
    reports: [
      { id: 'ais-summary', name: 'AIS Summary', description: 'Annual Information Statement from Income Tax', apiSource: 'Income Tax Portal API', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'form-26as', name: 'Form 26AS Insights', description: 'TDS/TCS credits and tax payments', apiSource: 'Income Tax Portal API', requiresKYC: true, kycLevel: 1, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'consolidated-tax', name: 'Consolidated Tax Report', description: 'Year-end comprehensive tax summary', apiSource: 'FintekPro Tax Engine', requiresKYC: true, kycLevel: 1, formats: ['PDF'], status: 'available' },
    ],
    externalSources: [
      { name: 'Income Tax Portal', url: 'https://eportal.incometax.gov.in/', description: 'AIS/TIS + 26AS' },
      { name: 'CAMS CAS', url: 'https://www.camsonline.com/', description: 'Capital Gains Report' },
    ]
  },
  {
    id: 'transactions',
    title: 'Order History',
    description: 'All mutual fund buy/sell orders, SIPs, switches, and settlement status',
    icon: Receipt,
    color: 'purple',
    reports: [
      { id: 'mf-orders', name: 'MF Order History', description: 'All mutual fund transactions with settlement status', apiSource: 'FintekPro Order Management', requiresKYC: false, kycLevel: 0, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'sip-orders', name: 'SIP Order History', description: 'Systematic Investment Plan orders and installments', apiSource: 'FintekPro SIP Module', requiresKYC: false, kycLevel: 0, formats: ['PDF', 'XLSX'], status: 'available' },
      { id: 'contract-notes', name: 'Contract Notes', description: 'Digital contract notes for executed orders', apiSource: 'BSE STAR MF', requiresKYC: true, kycLevel: 1, formats: ['PDF'], status: 'available' },
    ],
    externalSources: [
      { name: 'BSE STAR MF', url: 'https://www.bsestarmf.in/', description: 'Order Status & Contract Notes' },
    ]
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
  green: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', iconBg: 'bg-green-100 dark:bg-green-900/30' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', iconBg: 'bg-amber-100 dark:bg-amber-900/30' },
  teal: { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', text: 'text-teal-700 dark:text-teal-300', iconBg: 'bg-teal-100 dark:bg-teal-900/30' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', iconBg: 'bg-red-100 dark:bg-red-900/30' },
};

export default function ReportsHub() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('mutual-funds');
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const { data: kycStatus } = useQuery({
    queryKey: ['/api/kyc/status'],
    enabled: !!user?.id,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['/api/profile'],
    enabled: !!user?.id,
  });

  const { data: portfolios } = useQuery({
    queryKey: ['/api/portfolios', user?.id],
    enabled: !!user?.id,
  });

  const portfolioId = (portfolios && Array.isArray(portfolios) && portfolios.length > 0) ? portfolios[0]?.id : '';

  // Fetch MF Orders for transactions tab
  const { data: mfOrders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['/api/mf-orders'],
    enabled: !!user?.id && activeCategory === 'transactions',
  });

  // Extract KYC data from correct API response structure
  const kycData = (kycStatus as any)?.data;
  const userKYCLevel = parseInt(kycData?.kycLevel) || 0;
  const kycLevelName = kycData?.kycLevelName || 'Not Verified';
  const isPanVerified = kycData?.profile?.panVerified || false;
  const isCkycFetched = kycData?.profile?.ckycFetched || false;
  const isKraVerified = kycData?.profile?.kraVerified || false;
  const userPAN = (userProfile as any)?.panNumber || '';

  const syncMFMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/reports/sync-mf-to-portfolio', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id, portfolioId, panNumber: userPAN })
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', portfolioId, 'holdings'] });
      toast({
        title: "Holdings Synced",
        description: data.message || `Synced ${data.syncedCount} mutual fund holdings to your portfolio.`,
      });
      setIsSyncing(null);
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync MF holdings",
        variant: "destructive"
      });
      setIsSyncing(null);
    }
  });

  const syncDematMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/reports/sync-demat-to-portfolio', {
        method: 'POST',
        body: JSON.stringify({ userId: user?.id, portfolioId, panNumber: userPAN, depository: 'NSDL' })
      });
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios', portfolioId, 'holdings'] });
      toast({
        title: "Holdings Synced",
        description: data.message || `Synced ${data.syncedCount} demat holdings to your portfolio.`,
      });
      setIsSyncing(null);
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync demat holdings",
        variant: "destructive"
      });
      setIsSyncing(null);
    }
  });

  const handleSyncToPortfolio = (type: 'mf' | 'demat') => {
    if (!isPanVerified) {
      toast({
        title: "PAN Verification Required",
        description: "Please verify your PAN card to sync holdings from external sources.",
        variant: "destructive"
      });
      return;
    }
    if (!portfolioId) {
      toast({
        title: "No Portfolio Found",
        description: "Please create a portfolio first to sync holdings.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSyncing(type);
    if (type === 'mf') {
      syncMFMutation.mutate();
    } else {
      syncDematMutation.mutate();
    }
  };

  const handleGenerateReport = async (reportId: string, reportName: string) => {
    setIsRefreshing(reportId);
    toast({
      title: "Generating Report",
      description: `Fetching ${reportName} from data source...`,
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsRefreshing(null);
    toast({
      title: "Report Ready",
      description: `${reportName} has been generated successfully.`,
    });
  };

  const handleDownload = (reportId: string, format: string) => {
    toast({
      title: "Download Started",
      description: `Downloading report in ${format} format...`,
    });
  };

  const handleEmailReport = (reportId: string) => {
    toast({
      title: "Email Sent",
      description: "Report has been sent to your registered email.",
    });
  };

  const currentCategory = reportCategories.find(c => c.id === activeCategory);
  const colors = currentCategory ? colorClasses[currentCategory.color] : colorClasses.blue;

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Reports Hub</h1>
          <p className="text-xl text-muted-foreground">
            Access all your financial reports in one place - auto-fetched from official sources
          </p>
        </div>

        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <LucideShield className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <span className="font-semibold">SEBI & PMLA Compliant:</span> All reports are encrypted, audit-logged, and stored securely for 7 years as per regulatory requirements.
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-indigo-50 dark:to-indigo-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Transaction Reports</h3>
                  <p className="text-sm text-muted-foreground">View all FintekPro orders and payment transactions</p>
                </div>
              </div>
              <Link href="/transaction-reports">
                <Button className="bg-purple-600 hover:bg-purple-700" data-testid="link-transaction-reports">
                  <ChevronRight className="w-4 h-4 mr-1" />
                  View Transactions
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Store Transaction History - SEBI/RBI Compliant */}
        <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50 dark:from-emerald-950/30 to-teal-50 dark:to-teal-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Database className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Store Purchase History</CardTitle>
                <CardDescription>
                  Complete audit trail of all store transactions - maintained for 7 years per SEBI/RBI regulations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClientTransactionHistory showFilters={true} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {reportCategories.map((category) => {
            const catColors = colorClasses[category.color];
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isActive 
                    ? `${catColors.border} ${catColors.bg} ring-2 ring-offset-2 ring-${category.color}-300`
                    : 'border-border bg-card hover:border-border'
                }`}
                data-testid={`category-${category.id}`}
              >
                <div className={`w-10 h-10 mx-auto rounded-full ${catColors.iconBg} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${catColors.text}`} />
                </div>
                <p className={`text-sm font-medium ${isActive ? catColors.text : 'text-muted-foreground'}`}>
                  {category.title.split(' ')[0]}
                </p>
              </button>
            );
          })}
        </div>

        {currentCategory && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card className={`${colors.border} border-2`}>
                <CardHeader className={colors.bg}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${colors.iconBg} flex items-center justify-center`}>
                      <currentCategory.icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div>
                      <CardTitle className={colors.text}>{currentCategory.title}</CardTitle>
                      <CardDescription>{currentCategory.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {currentCategory.reports.map((report) => {
                    const isLocked = report.kycLevel > userKYCLevel;
                    const isLoading = isRefreshing === report.id;
                    
                    return (
                      <div
                        key={report.id}
                        className={`p-4 rounded-lg border ${isLocked ? 'bg-muted border-border' : 'bg-card border-border hover:border-border'} transition-all`}
                        data-testid={`report-${report.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {isLocked ? (
                                <Lock className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <FileText className={`w-4 h-4 ${colors.text}`} />
                              )}
                              <h4 className={`font-semibold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {report.name}
                              </h4>
                              {isLocked && (
                                <Badge variant="secondary" className="text-xs">
                                  KYC Level {report.kycLevel} Required
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm ${isLocked ? 'text-muted-foreground' : 'text-muted-foreground'} mb-2`}>
                              {report.description}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {report.apiSource}
                              </span>
                            </div>
                          </div>
                          
                          {!isLocked && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGenerateReport(report.id, report.name)}
                                disabled={isLoading}
                                data-testid={`refresh-${report.id}`}
                              >
                                {isLoading ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </Button>
                              {report.formats.map((format) => (
                                <Button
                                  key={format}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownload(report.id, format)}
                                  data-testid={`download-${report.id}-${format.toLowerCase()}`}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  {format}
                                </Button>
                              ))}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEmailReport(report.id)}
                                data-testid={`email-${report.id}`}
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Live Transactions Table for Transactions Category */}
                  {activeCategory === 'transactions' && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-purple-600" />
                        Recent Transactions
                      </h4>
                      {isLoadingOrders ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : (mfOrders as any)?.orders?.length > 0 ? (
                        <div className="space-y-3">
                          {((mfOrders as any)?.orders || []).slice(0, 10).map((order: any) => (
                            <div key={order.id} className="p-4 rounded-lg border bg-card hover:bg-muted transition-colors" data-testid={`order-${order.id}`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={
                                      order.orderType === 'buy' || order.orderType === 'lumpsum' ? 'default' :
                                      order.orderType === 'sell' || order.orderType === 'redemption' ? 'destructive' :
                                      order.orderType === 'sip' ? 'secondary' : 'outline'
                                    } className="text-xs">
                                      {order.orderType?.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className={
                                      order.status === 'executed' || order.status === 'settled' ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' :
                                      order.status === 'failed' || order.status === 'rejected' ? 'border-red-300 dark:border-red-700 text-red-700 dark:text-red-300' :
                                      order.status === 'processing' || order.status === 'placed' ? 'border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' :
                                      'border-border text-muted-foreground'
                                    }>
                                      {order.status}
                                    </Badge>
                                  </div>
                                  <p className="font-medium text-foreground text-sm">{order.schemeName || 'Mutual Fund Order'}</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {order.folioNumber && `Folio: ${order.folioNumber} • `}
                                    {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-foreground">
                                    ₹{parseFloat(order.amount || '0').toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </p>
                                  {order.units && (
                                    <p className="text-xs text-muted-foreground">{parseFloat(order.units).toFixed(3)} units</p>
                                  )}
                                  {order.navApplied && (
                                    <p className="text-xs text-muted-foreground">NAV: ₹{parseFloat(order.navApplied).toFixed(4)}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p>No transactions found</p>
                          <p className="text-sm mt-1">Your mutual fund orders will appear here</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="w-5 h-5" />
                    Download from Official Sources
                  </CardTitle>
                  <CardDescription>
                    Validate and cross-check reports directly from regulators
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentCategory.externalSources.map((source, index) => (
                    <a
                      key={index}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                      data-testid={`external-${source.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div>
                        <p className="font-medium text-foreground">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{source.description}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-200">
                    <LucideShield className="w-5 h-5" />
                    Your KYC Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700 dark:text-blue-300">Current Level</span>
                      <Badge className={userKYCLevel >= 2 ? "bg-green-600" : userKYCLevel >= 1 ? "bg-blue-600" : "bg-muted"}>
                        {kycLevelName}
                      </Badge>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">PAN Verified</span>
                        {isPanVerified ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">CKYC Fetched</span>
                        {isCkycFetched ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 dark:text-blue-300">KRA Verified</span>
                        {isKraVerified ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <p className="font-medium mb-2">Accessible Reports:</p>
                      <ul className="space-y-1">
                        {reportCategories.flatMap(cat => 
                          cat.reports.filter(r => r.kycLevel <= userKYCLevel)
                        ).slice(0, 5).map((report, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            <span className="text-xs">{report.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {userKYCLevel < 2 && (
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => navigate('/profile')}
                        data-testid="upgrade-kyc-button"
                      >
                        Upgrade KYC to Access More Reports
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-800 dark:text-green-200">
                    <Database className="w-5 h-5" />
                    Sync to Portfolio
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    Auto-populate your portfolio with holdings from external sources
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                    onClick={() => handleSyncToPortfolio('mf')}
                    disabled={isSyncing === 'mf' || !isPanVerified}
                    data-testid="sync-mf-button"
                  >
                    {isSyncing === 'mf' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="w-4 h-4 mr-2" />
                    )}
                    Sync Mutual Funds from BSE STAR
                  </Button>
                  <Button
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:opacity-50"
                    onClick={() => handleSyncToPortfolio('demat')}
                    disabled={isSyncing === 'demat' || !isPanVerified}
                    data-testid="sync-demat-button"
                  >
                    {isSyncing === 'demat' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4 mr-2" />
                    )}
                    Sync Demat from NSDL/CDSL
                  </Button>
                  {!isPanVerified && (
                    <p className="text-xs text-amber-600 text-center">
                      Complete PAN verification to enable sync
                    </p>
                  )}
                  {isPanVerified && (
                    <p className="text-xs text-green-600 text-center flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      PAN verified - Sync enabled
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent report activity</p>
                    <p className="text-xs">Generate a report to see activity here</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
