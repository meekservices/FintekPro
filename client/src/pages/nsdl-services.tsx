import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, FileText, TrendingUp, IndianRupee, Shield, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface DematAccount {
  clientId: string;
  demateAccountNumber: string;
  dpId: string;
  dpName: string;
  clientName: string;
  pan: string;
  mobile: string;
  email: string;
  status: string;
  accountType: string;
  openingDate: string;
  kycStatus: string;
}

interface Holdings {
  accountNumber: string;
  dpId: string;
  clientName: string;
  asOfDate: string;
  holdings: {
    isin: string;
    securityName: string;
    quantity: number;
    marketValue: string;
    freeQuantity: number;
    lockedQuantity: number;
    pledgedQuantity: number;
  }[];
  totalMarketValue: string;
}

interface PledgeData {
  pledgeId: string;
  accountNumber: string;
  isin: string;
  quantity: string;
  pledgeeCode: string;
  purpose: string;
  status: string;
  pledgeDate: string;
  collateralValue: string;
  haircut: string;
  eligibleValue: string;
}

interface LoanApplication {
  applicationId: string;
  accountNumber: string;
  loanAmount: string;
  bankCode: string;
  purpose: string;
  status: string;
  applicationDate: string;
  interestRate: string;
  tenure: string;
  eligibleLoanAmount: string;
}

export default function NSDLServices() {
  // Navigation state for responsive layout
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Listen for navigation state changes
  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccountNumber, setSelectedAccountNumber] = useState("1234567890123456");
  const [otpRequests, setOtpRequests] = useState<{[key: string]: boolean}>({});

  // Account Opening Form State
  const [accountForm, setAccountForm] = useState({
    clientName: "",
    pan: "",
    mobile: "",
    email: ""
  });

  // eDIS Form State
  const [edisForm, setEdisForm] = useState({
    accountNumber: selectedAccountNumber,
    isin: "",
    quantity: "",
    brokerCode: "",
    tradeDate: "",
    otp: ""
  });

  // Margin Pledge Form State
  const [pledgeForm, setPledgeForm] = useState({
    accountNumber: selectedAccountNumber,
    isin: "",
    quantity: "",
    pledgeeCode: "",
    purpose: "MARGIN",
    otp: ""
  });

  // Loan Application Form State
  const [loanForm, setLoanForm] = useState({
    accountNumber: selectedAccountNumber,
    loanAmount: "",
    bankCode: "",
    purpose: "PERSONAL",
    collateralSecurities: [{ isin: "", quantity: "" }]
  });

  // Fetch Holdings
  const { data: holdings, isLoading: holdingsLoading } = useQuery<Holdings>({
    queryKey: ['/api/nsdl/demat/holdings', selectedAccountNumber],
    enabled: !!selectedAccountNumber
  });

  // Account Opening Mutation
  const accountOpeningMutation = useMutation({
    mutationFn: async (data: typeof accountForm) => {
      const response = await fetch("/api/nsdl/demat/account/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: "Demat account opened successfully!" });
      setAccountForm({ clientName: "", pan: "", mobile: "", email: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/nsdl/demat/holdings'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to open demat account", variant: "destructive" });
    }
  });

  // OTP Generation Mutation
  const otpMutation = useMutation({
    mutationFn: async (data: { accountNumber: string; mobile: string }) => {
      const response = await fetch("/api/nsdl/edis/otp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({ title: "OTP Sent", description: "OTP sent to your registered mobile number" });
      setOtpRequests(prev => ({ ...prev, [variables.accountNumber]: true }));
    }
  });

  // eDIS Instruction Mutation
  const edisMutation = useMutation({
    mutationFn: async (data: typeof edisForm) => {
      const response = await fetch("/api/nsdl/edis/instruction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "eDIS instruction submitted successfully!" });
      setEdisForm({ ...edisForm, otp: "" });
    }
  });

  // Margin Pledge Mutation
  const pledgeMutation = useMutation({
    mutationFn: async (data: typeof pledgeForm) => {
      const response = await fetch("/api/nsdl/margin/pledge/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Margin pledge created successfully!" });
      setPledgeForm({ ...pledgeForm, otp: "" });
      queryClient.invalidateQueries({ queryKey: ['/api/nsdl/demat/holdings'] });
    }
  });

  // Loan Application Mutation
  const loanMutation = useMutation({
    mutationFn: async (data: typeof loanForm) => {
      const response = await fetch("/api/nsdl/las/loan/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Loan application submitted successfully!" });
    }
  });

  return (
    <div className="min-h-screen bg-finance-light" data-testid="nsdl-services-page">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">NSDL Securities Services</h1>
          <p className="text-muted-foreground mt-2">
            Complete depository services including demat accounts, electronic trading, margin pledges, and loan facilities
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="stat-demat-accounts">
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="h-8 w-8 text-finance-blue" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Active Accounts</p>
                  <p className="text-2xl font-bold">410M+</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-custody-value">
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-finance-green" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Custody Value</p>
                  <p className="text-2xl font-bold">₹503L Cr</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-service-centers">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-finance-purple" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Service Centers</p>
                  <p className="text-2xl font-bold">55,702</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-processing-time">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-finance-orange" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Processing</p>
                  <p className="text-2xl font-bold">Instant</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Services Tabs */}
        <Tabs defaultValue="holdings" className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="holdings" data-testid="tab-holdings">Holdings</TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">Account</TabsTrigger>
            <TabsTrigger value="edis" data-testid="tab-edis">eDIS</TabsTrigger>
            <TabsTrigger value="pledge" data-testid="tab-pledge">Margin Pledge</TabsTrigger>
            <TabsTrigger value="loans" data-testid="tab-loans">Loans</TabsTrigger>
          </ScrollableTabsList>

          {/* Holdings Tab */}
          <TabsContent value="holdings" className="space-y-6">
            <Card data-testid="holdings-card">
              <CardHeader>
                <CardTitle>Securities Holdings</CardTitle>
                <CardDescription>
                  View your demat account holdings and current market values
                </CardDescription>
                <div className="flex items-center space-x-4">
                  <Label htmlFor="account-select">Account Number:</Label>
                  <Input
                    id="account-select"
                    value={selectedAccountNumber}
                    onChange={(e) => setSelectedAccountNumber(e.target.value)}
                    placeholder="Enter account number"
                    className="w-60"
                    data-testid="account-number-input"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {holdingsLoading ? (
                  <div data-testid="holdings-loading">Loading holdings...</div>
                ) : holdings ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">Total Market Value</p>
                          <p className="text-2xl font-bold text-finance-green">
                            ₹{parseFloat(holdings.totalMarketValue).toLocaleString()}
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">Total Securities</p>
                          <p className="text-2xl font-bold">{holdings.holdings?.length || 0}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">DP ID</p>
                          <p className="text-2xl font-bold">{holdings.dpId}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-3">
                      {holdings.holdings?.map((holding) => (
                        <Card key={holding.isin} data-testid={`holding-${holding.isin}`}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg">{holding.securityName}</h3>
                                <p className="text-sm text-muted-foreground">ISIN: {holding.isin}</p>
                                <div className="flex space-x-4 mt-2">
                                  <Badge variant="outline">Qty: {holding.quantity}</Badge>
                                  <Badge variant="outline">Free: {holding.freeQuantity}</Badge>
                                  {holding.pledgedQuantity > 0 && (
                                    <Badge variant="secondary">Pledged: {holding.pledgedQuantity}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-finance-green">
                                  ₹{parseFloat(holding.marketValue).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div data-testid="no-holdings">No holdings data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Opening Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card data-testid="account-opening-card">
              <CardHeader>
                <CardTitle>Open NSDL Demat Account</CardTitle>
                <CardDescription>
                  Instant demat account opening with digital KYC
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="client-name">Full Name</Label>
                    <Input
                      id="client-name"
                      value={accountForm.clientName}
                      onChange={(e) => setAccountForm({...accountForm, clientName: e.target.value})}
                      placeholder="Enter full name"
                      data-testid="input-client-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pan">PAN Number</Label>
                    <Input
                      id="pan"
                      value={accountForm.pan}
                      onChange={(e) => setAccountForm({...accountForm, pan: e.target.value.toUpperCase()})}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      data-testid="input-pan"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <Input
                      id="mobile"
                      value={accountForm.mobile}
                      onChange={(e) => setAccountForm({...accountForm, mobile: e.target.value})}
                      placeholder="9876543210"
                      maxLength={10}
                      data-testid="input-mobile"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={accountForm.email}
                      onChange={(e) => setAccountForm({...accountForm, email: e.target.value})}
                      placeholder="email@example.com"
                      data-testid="input-email"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-6" 
                  onClick={() => accountOpeningMutation.mutate(accountForm)}
                  disabled={accountOpeningMutation.isPending}
                  data-testid="button-open-account"
                >
                  {accountOpeningMutation.isPending ? "Processing..." : "Open Demat Account"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* eDIS Tab */}
          <TabsContent value="edis" className="space-y-6">
            <Card data-testid="edis-card">
              <CardHeader>
                <CardTitle>Electronic Delivery Instruction Slip (eDIS)</CardTitle>
                <CardDescription>
                  Authorize securities transfer without Power of Attorney
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edis-account">Account Number</Label>
                    <Input
                      id="edis-account"
                      value={edisForm.accountNumber}
                      onChange={(e) => setEdisForm({...edisForm, accountNumber: e.target.value})}
                      data-testid="input-edis-account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edis-isin">ISIN</Label>
                    <Input
                      id="edis-isin"
                      value={edisForm.isin}
                      onChange={(e) => setEdisForm({...edisForm, isin: e.target.value.toUpperCase()})}
                      placeholder="INE002A01018"
                      data-testid="input-edis-isin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edis-quantity">Quantity</Label>
                    <Input
                      id="edis-quantity"
                      type="number"
                      value={edisForm.quantity}
                      onChange={(e) => setEdisForm({...edisForm, quantity: e.target.value})}
                      data-testid="input-edis-quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edis-broker">Broker Code</Label>
                    <Input
                      id="edis-broker"
                      value={edisForm.brokerCode}
                      onChange={(e) => setEdisForm({...edisForm, brokerCode: e.target.value})}
                      placeholder="DEMO123"
                      data-testid="input-edis-broker"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={() => otpMutation.mutate({ accountNumber: edisForm.accountNumber, mobile: "9876543210" })}
                    disabled={otpMutation.isPending}
                    variant="outline"
                    data-testid="button-generate-edis-otp"
                  >
                    {otpMutation.isPending ? "Sending..." : "Generate OTP"}
                  </Button>
                </div>

                {otpRequests[edisForm.accountNumber] && (
                  <div>
                    <Label htmlFor="edis-otp">Enter OTP</Label>
                    <Input
                      id="edis-otp"
                      value={edisForm.otp}
                      onChange={(e) => setEdisForm({...edisForm, otp: e.target.value})}
                      placeholder="123456"
                      maxLength={6}
                      data-testid="input-edis-otp"
                    />
                    <Button
                      className="mt-2"
                      onClick={() => edisMutation.mutate(edisForm)}
                      disabled={edisMutation.isPending}
                      data-testid="button-submit-edis"
                    >
                      {edisMutation.isPending ? "Processing..." : "Submit eDIS Instruction"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Margin Pledge Tab */}
          <TabsContent value="pledge" className="space-y-6">
            <Card data-testid="pledge-card">
              <CardHeader>
                <CardTitle>Margin Pledge</CardTitle>
                <CardDescription>
                  Pledge securities for margin trading requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pledge-account">Account Number</Label>
                    <Input
                      id="pledge-account"
                      value={pledgeForm.accountNumber}
                      onChange={(e) => setPledgeForm({...pledgeForm, accountNumber: e.target.value})}
                      data-testid="input-pledge-account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pledge-isin">ISIN</Label>
                    <Input
                      id="pledge-isin"
                      value={pledgeForm.isin}
                      onChange={(e) => setPledgeForm({...pledgeForm, isin: e.target.value.toUpperCase()})}
                      placeholder="INE002A01018"
                      data-testid="input-pledge-isin"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pledge-quantity">Quantity</Label>
                    <Input
                      id="pledge-quantity"
                      type="number"
                      value={pledgeForm.quantity}
                      onChange={(e) => setPledgeForm({...pledgeForm, quantity: e.target.value})}
                      data-testid="input-pledge-quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pledge-code">Pledgee Code</Label>
                    <Input
                      id="pledge-code"
                      value={pledgeForm.pledgeeCode}
                      onChange={(e) => setPledgeForm({...pledgeForm, pledgeeCode: e.target.value})}
                      placeholder="DEMO123"
                      data-testid="input-pledge-code"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button
                    onClick={() => otpMutation.mutate({ accountNumber: pledgeForm.accountNumber, mobile: "9876543210" })}
                    disabled={otpMutation.isPending}
                    variant="outline"
                    data-testid="button-generate-pledge-otp"
                  >
                    {otpMutation.isPending ? "Sending..." : "Generate OTP"}
                  </Button>
                </div>

                {otpRequests[pledgeForm.accountNumber] && (
                  <div>
                    <Label htmlFor="pledge-otp">Enter OTP</Label>
                    <Input
                      id="pledge-otp"
                      value={pledgeForm.otp}
                      onChange={(e) => setPledgeForm({...pledgeForm, otp: e.target.value})}
                      placeholder="123456"
                      maxLength={6}
                      data-testid="input-pledge-otp"
                    />
                    <Button
                      className="mt-2"
                      onClick={() => pledgeMutation.mutate(pledgeForm)}
                      disabled={pledgeMutation.isPending}
                      data-testid="button-create-pledge"
                    >
                      {pledgeMutation.isPending ? "Processing..." : "Create Margin Pledge"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loans Tab */}
          <TabsContent value="loans" className="space-y-6">
            <Card data-testid="loan-card">
              <CardHeader>
                <CardTitle>Loan Against Securities (LAS)</CardTitle>
                <CardDescription>
                  Apply for loans using your securities as collateral
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="loan-account">Account Number</Label>
                    <Input
                      id="loan-account"
                      value={loanForm.accountNumber}
                      onChange={(e) => setLoanForm({...loanForm, accountNumber: e.target.value})}
                      data-testid="input-loan-account"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-amount">Loan Amount (₹)</Label>
                    <Input
                      id="loan-amount"
                      type="number"
                      value={loanForm.loanAmount}
                      onChange={(e) => setLoanForm({...loanForm, loanAmount: e.target.value})}
                      placeholder="500000"
                      data-testid="input-loan-amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-bank">Bank Code</Label>
                    <Input
                      id="loan-bank"
                      value={loanForm.bankCode}
                      onChange={(e) => setLoanForm({...loanForm, bankCode: e.target.value})}
                      placeholder="HDFC0001234"
                      data-testid="input-loan-bank"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-purpose">Purpose</Label>
                    <Input
                      id="loan-purpose"
                      value={loanForm.purpose}
                      onChange={(e) => setLoanForm({...loanForm, purpose: e.target.value})}
                      data-testid="input-loan-purpose"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Collateral Securities</Label>
                  {loanForm.collateralSecurities.map((security, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        value={security.isin}
                        onChange={(e) => {
                          const updated = [...loanForm.collateralSecurities];
                          updated[index].isin = e.target.value.toUpperCase();
                          setLoanForm({...loanForm, collateralSecurities: updated});
                        }}
                        placeholder="ISIN (e.g., INE002A01018)"
                        data-testid={`input-collateral-isin-${index}`}
                      />
                      <Input
                        type="number"
                        value={security.quantity}
                        onChange={(e) => {
                          const updated = [...loanForm.collateralSecurities];
                          updated[index].quantity = e.target.value;
                          setLoanForm({...loanForm, collateralSecurities: updated});
                        }}
                        placeholder="Quantity"
                        data-testid={`input-collateral-quantity-${index}`}
                      />
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => loanMutation.mutate(loanForm)}
                  disabled={loanMutation.isPending}
                  data-testid="button-apply-loan"
                >
                  {loanMutation.isPending ? "Processing..." : "Apply for Loan"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  );
}