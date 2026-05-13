import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  Building2, 
  LucideShield as LucideShield, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Lock,
  Unlock,
  FileText,
  TrendingUp,
  AlertTriangle,
  IndianRupee,
  User,
  Calendar,
  Briefcase,
  Heart
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";

type SchemeType = 'epf' | 'eps' | 'ppf' | 'nps' | 'apy' | 'insurance';

interface ConsentStatus {
  schemeType: SchemeType;
  status: 'pending' | 'verified' | 'expired' | 'revoked' | 'none';
  expiresAt?: string;
  lastFetched?: string;
}

interface EpfHolding {
  id: string;
  epfAccountNumber: string;
  memberName: string;
  employerName: string;
  totalBalance: string;
  employeeContribution: string;
  employerContribution: string;
  pensionContribution: string;
  interestEarned: string;
  interestRate: string;
  dateOfJoining?: string;
  isActive: boolean;
  nomineeName?: string;
}

interface NpsAccount {
  id: string;
  pranNumber: string;
  tier1Balance: string;
  tier2Balance: string;
  tier1Contribution: string;
  tier2Contribution: string;
  fundManager: string;
  schemeName: string;
  equityAllocation: string;
  corporateBondAllocation: string;
  governmentBondAllocation: string;
  returnPercentage: string;
}

interface PpfHolding {
  id: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
  currentBalance: string;
  maturityDate?: string;
  interestRate: string;
  lastDepositDate?: string;
  lastDepositAmount?: string;
}

interface ApyAccount {
  id: string;
  pranNumber: string;
  pensionAmount: string;
  monthlyContribution: string;
  bankName: string;
  accountStatus: string;
  maturityAge: number;
  governmentContribution: string;
}

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  policyType: string;
  insurerName: string;
  sumAssured: string;
  premiumAmount: string;
  premiumFrequency: string;
  maturityDate?: string;
  status: string;
  nomineeName?: string;
}

const schemeInfo: Record<SchemeType, { title: string; description: string; icon: any; source: string }> = {
  epf: {
    title: "Employee Provident Fund",
    description: "View your EPF balance, contributions, and employer details from EPFO",
    icon: Building2,
    source: "EPFO"
  },
  eps: {
    title: "Employee Pension Scheme",
    description: "Check your EPS service history and expected pension from EPFO",
    icon: Heart,
    source: "EPFO"
  },
  ppf: {
    title: "Public Provident Fund",
    description: "Access your PPF account balance and deposit history",
    icon: Wallet,
    source: "Post Office/Bank"
  },
  nps: {
    title: "National Pension System",
    description: "View NPS holdings, asset allocation, and returns from NSDL CRA",
    icon: TrendingUp,
    source: "NSDL CRA"
  },
  apy: {
    title: "Atal Pension Yojana",
    description: "Check your APY contribution status and pension details from PFRDA",
    icon: LucideShield,
    source: "PFRDA"
  },
  insurance: {
    title: "Insurance Policies",
    description: "View all your life and health insurance policies",
    icon: Heart,
    source: "Insurance Repository"
  }
};

export default function GovernmentSchemes() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SchemeType>("epf");
  const [otpInput, setOtpInput] = useState("");
  const [pendingChallenge, setPendingChallenge] = useState<{ schemeType: SchemeType; challengeId: string } | null>(null);

  const userId = (user as any)?.id;

  const { data: consentsData, isLoading: loadingConsents } = useQuery<ConsentStatus[]>({
    queryKey: ['/api/government-schemes/consents', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/consents`);
      if (!response.ok) throw new Error('Failed to fetch consents');
      return response.json();
    },
    enabled: isAuthenticated && !!userId,
  });

  const { data: epfData, isLoading: loadingEpf } = useQuery<EpfHolding[], Error, EpfHolding[]>({
    queryKey: ['/api/government-schemes/epf', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/epf`);
      if (!response.ok) throw new Error('Failed to fetch EPF data');
      const result = await response.json();
      const raw = result?.data ?? result;
      return Array.isArray(raw) ? raw : [];
    },
    select: (data) => Array.isArray(data) ? data : [],
    enabled: isAuthenticated && !!userId && activeTab === 'epf',
  });

  const { data: npsData, isLoading: loadingNps } = useQuery<NpsAccount[], Error, NpsAccount[]>({
    queryKey: ['/api/government-schemes/nps', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/nps`);
      if (!response.ok) throw new Error('Failed to fetch NPS data');
      const result = await response.json();
      const raw = result?.data ?? result;
      return Array.isArray(raw) ? raw : [];
    },
    select: (data) => Array.isArray(data) ? data : [],
    enabled: isAuthenticated && !!userId && activeTab === 'nps',
  });

  const { data: ppfData, isLoading: loadingPpf } = useQuery<PpfHolding[], Error, PpfHolding[]>({
    queryKey: ['/api/government-schemes/ppf', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/ppf`);
      if (!response.ok) throw new Error('Failed to fetch PPF data');
      const result = await response.json();
      const raw = result?.data ?? result;
      return Array.isArray(raw) ? raw : [];
    },
    select: (data) => Array.isArray(data) ? data : [],
    enabled: isAuthenticated && !!userId && activeTab === 'ppf',
  });

  const { data: apyData, isLoading: loadingApy } = useQuery<ApyAccount[], Error, ApyAccount[]>({
    queryKey: ['/api/government-schemes/apy', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/apy`);
      if (!response.ok) throw new Error('Failed to fetch APY data');
      const result = await response.json();
      const raw = result?.data ?? result;
      return Array.isArray(raw) ? raw : [];
    },
    select: (data) => Array.isArray(data) ? data : [],
    enabled: isAuthenticated && !!userId && activeTab === 'apy',
  });

  const { data: insuranceData, isLoading: loadingInsurance } = useQuery<InsurancePolicy[], Error, InsurancePolicy[]>({
    queryKey: ['/api/government-schemes/insurance', userId],
    queryFn: async () => {
      const response = await fetch(`/api/government-schemes/insurance`);
      if (!response.ok) throw new Error('Failed to fetch insurance data');
      const result = await response.json();
      const raw = result?.data ?? result;
      return Array.isArray(raw) ? raw : [];
    },
    select: (data) => Array.isArray(data) ? data : [],
    enabled: isAuthenticated && !!userId && activeTab === 'insurance',
  });

  const initiateConsentMutation = useMutation({
    mutationFn: async (schemeType: SchemeType) => {
      const response = await apiRequest('/api/government-schemes/consent/initiate', {
        method: 'POST',
        body: JSON.stringify({ schemeType, channel: 'mobile' }),
      });
      return response;
    },
    onSuccess: (data: any, schemeType) => {
      setPendingChallenge({ schemeType, challengeId: data.challengeId });
      toast({
        title: "OTP Sent",
        description: data.message || "Please enter the OTP sent to your registered mobile.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate consent",
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ challengeId, otp }: { challengeId: string; otp: string }) => {
      const response = await apiRequest('/api/government-schemes/consent/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, otp }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      setPendingChallenge(null);
      setOtpInput("");
      queryClient.invalidateQueries({ queryKey: ['/api/government-schemes/consents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/government-schemes'] });
      toast({
        title: "Consent Granted",
        description: `Data fetched: ${data.dataFetched?.recordsCreated || 0} records retrieved.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    },
  });

  const refreshDataMutation = useMutation({
    mutationFn: async (schemeType: SchemeType) => {
      const response = await apiRequest(`/api/government-schemes/${schemeType}/refresh`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: (_, schemeType) => {
      queryClient.invalidateQueries({ queryKey: [`/api/government-schemes/${schemeType}`] });
      toast({
        title: "Data Refreshed",
        description: "Latest data has been fetched from the source.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh data",
        variant: "destructive",
      });
    },
  });

  const getConsentStatus = (schemeType: SchemeType): ConsentStatus => {
    return consentsData?.find(c => c.schemeType === schemeType) || { schemeType, status: 'none' };
  };

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (!amount) return '₹0';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(num);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background p-6">
        <EmptyState
          icon={Lock}
          title="Authentication Required"
          description="Please log in to access your government scheme data"
        />
      </div>
    );
  }

  if (loadingConsents) {
    return (
      <div className="min-h-screen bg-background p-6">
        <LoadingState variant="card" count={3} />
      </div>
    );
  }

  const renderConsentCard = (schemeType: SchemeType) => {
    const info = schemeInfo[schemeType];
    const consent = getConsentStatus(schemeType);
    const Icon = info.icon;
    const isPending = pendingChallenge?.schemeType === schemeType;

    return (
      <Card key={schemeType} className="relative" data-testid={`consent-card-${schemeType}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{info.title}</CardTitle>
                <CardDescription className="text-xs">Source: {info.source}</CardDescription>
              </div>
            </div>
            {consent.status === 'verified' ? (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : consent.status === 'expired' ? (
              <Badge variant="secondary">
                <Clock className="h-3 w-3 mr-1" />
                Expired
              </Badge>
            ) : consent.status === 'pending' ? (
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Badge>
            ) : (
              <Badge variant="outline">
                <Lock className="h-3 w-3 mr-1" />
                Not Linked
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{info.description}</p>
          
          {consent.status === 'verified' && consent.expiresAt && (
            <div className="text-xs text-muted-foreground">
              Consent expires: {format(new Date(consent.expiresAt), 'dd MMM yyyy')}
            </div>
          )}

          {isPending ? (
            <div className="space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>OTP Verification Required</AlertTitle>
                <AlertDescription>
                  Enter the OTP sent to your registered mobile number.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  maxLength={6}
                  className="flex-1"
                  data-testid={`otp-input-${schemeType}`}
                />
                <Button
                  onClick={() => verifyOtpMutation.mutate({ 
                    challengeId: pendingChallenge.challengeId, 
                    otp: otpInput 
                  })}
                  disabled={otpInput.length !== 6 || verifyOtpMutation.isPending}
                  data-testid={`verify-otp-${schemeType}`}
                >
                  {verifyOtpMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
            </div>
          ) : consent.status !== 'verified' ? (
            <Button
              onClick={() => initiateConsentMutation.mutate(schemeType)}
              disabled={initiateConsentMutation.isPending}
              className="w-full"
              data-testid={`grant-consent-${schemeType}`}
            >
              {initiateConsentMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Unlock className="h-4 w-4 mr-2" />
              )}
              Grant Consent & Fetch Data
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => refreshDataMutation.mutate(schemeType)}
              disabled={refreshDataMutation.isPending}
              className="w-full"
              data-testid={`refresh-${schemeType}`}
            >
              {refreshDataMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Data
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEpfData = () => {
    if (loadingEpf) return <LoadingState variant="card" count={2} />;
    if (!epfData || epfData.length === 0) {
      return (
        <EmptyState
          icon={Building2}
          title="No EPF Data Found"
          description="Grant consent to fetch your EPF records from EPFO"
        />
      );
    }

    const totalBalance = epfData.reduce((sum, h) => sum + parseFloat(h.totalBalance || '0'), 0);

    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total EPF Balance</p>
                <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
              </div>
              <Wallet className="h-12 w-12 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {epfData.map((holding) => (
            <Card key={holding.id} data-testid={`epf-holding-${holding.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{holding.memberName}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {holding.employerName}
                    </CardDescription>
                  </div>
                  <Badge variant={holding.isActive ? "default" : "secondary"}>
                    {holding.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Account No.</p>
                    <p className="font-medium">{holding.epfAccountNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Balance</p>
                    <p className="font-semibold text-green-600">{formatCurrency(holding.totalBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employee Share</p>
                    <p className="font-medium">{formatCurrency(holding.employeeContribution)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Employer Share</p>
                    <p className="font-medium">{formatCurrency(holding.employerContribution)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pension Fund</p>
                    <p className="font-medium">{formatCurrency(holding.pensionContribution)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Interest Earned</p>
                    <p className="font-medium text-blue-600">{formatCurrency(holding.interestEarned)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Interest Rate</p>
                    <p className="font-medium">{holding.interestRate}%</p>
                  </div>
                  {holding.nomineeName && (
                    <div>
                      <p className="text-muted-foreground">Nominee</p>
                      <p className="font-medium">{holding.nomineeName}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const renderNpsData = () => {
    if (loadingNps) return <LoadingState variant="card" count={2} />;
    if (!npsData || npsData.length === 0) {
      return (
        <EmptyState
          icon={TrendingUp}
          title="No NPS Data Found"
          description="Grant consent to fetch your NPS records from NSDL CRA"
        />
      );
    }

    return (
      <div className="space-y-6">
        {npsData.map((account) => {
          const totalBalance = parseFloat(account.tier1Balance || '0') + parseFloat(account.tier2Balance || '0');
          return (
            <Card key={account.id} data-testid={`nps-account-${account.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>PRAN: {account.pranNumber}</CardTitle>
                    <CardDescription>{account.schemeName} - {account.fundManager}</CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {account.returnPercentage}% Returns
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Tier 1 Balance</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(account.tier1Balance)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Tier 2 Balance</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(account.tier2Balance)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-xl font-bold">{formatCurrency(totalBalance)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Asset Allocation</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">Equity</span>
                      <Progress value={parseFloat(account.equityAllocation)} className="flex-1" />
                      <span className="text-xs w-12 text-right">{account.equityAllocation}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">Corp Bonds</span>
                      <Progress value={parseFloat(account.corporateBondAllocation)} className="flex-1" />
                      <span className="text-xs w-12 text-right">{account.corporateBondAllocation}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">Govt Bonds</span>
                      <Progress value={parseFloat(account.governmentBondAllocation)} className="flex-1" />
                      <span className="text-xs w-12 text-right">{account.governmentBondAllocation}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderPpfData = () => {
    if (loadingPpf) return <LoadingState variant="card" count={1} />;
    if (!ppfData || ppfData.length === 0) {
      return (
        <EmptyState
          icon={Wallet}
          title="No PPF Data Found"
          description="Grant consent to fetch your PPF records"
        />
      );
    }

    return (
      <div className="space-y-4">
        {ppfData.map((holding) => (
          <Card key={holding.id} data-testid={`ppf-holding-${holding.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>PPF Account</CardTitle>
                  <CardDescription>{holding.bankName} - {holding.branchName}</CardDescription>
                </div>
                <Badge>{holding.interestRate}% p.a.</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Account No.</p>
                  <p className="font-medium">{holding.accountNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Balance</p>
                  <p className="font-semibold text-green-600">{formatCurrency(holding.currentBalance)}</p>
                </div>
                {holding.maturityDate && (
                  <div>
                    <p className="text-muted-foreground">Maturity Date</p>
                    <p className="font-medium">{format(new Date(holding.maturityDate), 'dd MMM yyyy')}</p>
                  </div>
                )}
                {holding.lastDepositDate && (
                  <div>
                    <p className="text-muted-foreground">Last Deposit</p>
                    <p className="font-medium">{formatCurrency(holding.lastDepositAmount)} on {format(new Date(holding.lastDepositDate), 'dd MMM')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderApyData = () => {
    if (loadingApy) return <LoadingState variant="card" count={1} />;
    if (!apyData || apyData.length === 0) {
      return (
        <EmptyState
          icon={LucideShield}
          title="No APY Data Found"
          description="Grant consent to fetch your APY records from PFRDA"
        />
      );
    }

    return (
      <div className="space-y-4">
        {apyData.map((account) => (
          <Card key={account.id} data-testid={`apy-account-${account.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>APY Account</CardTitle>
                  <CardDescription>PRAN: {account.pranNumber}</CardDescription>
                </div>
                <Badge variant={account.accountStatus === 'active' ? 'default' : 'secondary'}>
                  {account.accountStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Monthly Pension</p>
                  <p className="font-semibold text-green-600">{formatCurrency(account.pensionAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly Contribution</p>
                  <p className="font-medium">{formatCurrency(account.monthlyContribution)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Govt. Contribution</p>
                  <p className="font-medium text-blue-600">{formatCurrency(account.governmentContribution)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bank</p>
                  <p className="font-medium">{account.bankName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderInsuranceData = () => {
    if (loadingInsurance) return <LoadingState variant="card" count={2} />;
    if (!insuranceData || insuranceData.length === 0) {
      return (
        <EmptyState
          icon={Heart}
          title="No Insurance Policies Found"
          description="Grant consent to fetch your insurance policy details"
        />
      );
    }

    return (
      <div className="space-y-4">
        {insuranceData.map((policy) => (
          <Card key={policy.id} data-testid={`insurance-policy-${policy.id}`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base">{policy.insurerName}</CardTitle>
                  <CardDescription>{policy.policyType} - {policy.policyNumber}</CardDescription>
                </div>
                <Badge variant={policy.status === 'active' ? 'default' : 'secondary'}>
                  {policy.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Sum Assured</p>
                  <p className="font-semibold text-green-600">{formatCurrency(policy.sumAssured)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Premium</p>
                  <p className="font-medium">{formatCurrency(policy.premiumAmount)} / {policy.premiumFrequency}</p>
                </div>
                {policy.maturityDate && (
                  <div>
                    <p className="text-muted-foreground">Maturity Date</p>
                    <p className="font-medium">{format(new Date(policy.maturityDate), 'dd MMM yyyy')}</p>
                  </div>
                )}
                {policy.nomineeName && (
                  <div>
                    <p className="text-muted-foreground">Nominee</p>
                    <p className="font-medium">{policy.nomineeName}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="government-schemes-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Government Scheme Data</h1>
          <p className="text-muted-foreground">
            Securely access your EPF, NPS, PPF, APY, and insurance data from official government sources
          </p>
        </div>

        <Alert>
          <LucideShield className="h-4 w-4" />
          <AlertTitle>Secure Data Access</AlertTitle>
          <AlertDescription>
            Your data is fetched directly from government sources (EPFO, NSDL CRA, PFRDA) using OTP-based consent. 
            All data is encrypted and stored in compliance with PMLA/RBI regulations.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(['epf', 'nps', 'ppf', 'apy', 'insurance'] as SchemeType[]).map(renderConsentCard)}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SchemeType)} className="w-full">
          <ScrollableTabsList>
            <TabsTrigger value="epf" data-testid="tab-epf">
              <Building2 className="h-4 w-4 mr-2" />
              EPF
            </TabsTrigger>
            <TabsTrigger value="nps" data-testid="tab-nps">
              <TrendingUp className="h-4 w-4 mr-2" />
              NPS
            </TabsTrigger>
            <TabsTrigger value="ppf" data-testid="tab-ppf">
              <Wallet className="h-4 w-4 mr-2" />
              PPF
            </TabsTrigger>
            <TabsTrigger value="apy" data-testid="tab-apy">
              <LucideShield className="h-4 w-4 mr-2" />
              APY
            </TabsTrigger>
            <TabsTrigger value="insurance" data-testid="tab-insurance">
              <Heart className="h-4 w-4 mr-2" />
              Insurance
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="epf" className="mt-6">
            {renderEpfData()}
          </TabsContent>
          <TabsContent value="nps" className="mt-6">
            {renderNpsData()}
          </TabsContent>
          <TabsContent value="ppf" className="mt-6">
            {renderPpfData()}
          </TabsContent>
          <TabsContent value="apy" className="mt-6">
            {renderApyData()}
          </TabsContent>
          <TabsContent value="insurance" className="mt-6">
            {renderInsuranceData()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
