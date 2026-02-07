import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Calculator, IndianRupee, TrendingUp, Shield, Bike, PiggyBank, Target, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface EMIResult {
  emi: number;
  totalAmount: number;
  totalInterest: number;
  breakdown: Array<{
    month: number;
    emi: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

interface LoanResult {
  emi: number;
  interestRate: number;
  processingFee: number;
  totalAmount: number;
}

interface FDResult {
  maturityAmount: number;
  interestEarned: number;
  interestRate: number;
}

interface EligibilityResult {
  eligible: boolean;
  maxLoanAmount: number;
  reason?: string;
}

export default function BajajFinance() {
  const [emiForm, setEmiForm] = useState({
    principal: "",
    interestRate: "",
    tenure: ""
  });

  const [personalLoanForm, setPersonalLoanForm] = useState({
    amount: "",
    tenure: ""
  });

  const [businessLoanForm, setBusinessLoanForm] = useState({
    amount: "",
    tenure: "",
    businessType: ""
  });

  const [fdForm, setFdForm] = useState({
    amount: "",
    tenure: "",
    fdType: "regular"
  });

  const [eligibilityForm, setEligibilityForm] = useState({
    salary: "",
    age: "",
    loanType: ""
  });

  const [emiResult, setEmiResult] = useState<EMIResult | null>(null);
  const [personalLoanResult, setPersonalLoanResult] = useState<LoanResult | null>(null);
  const [businessLoanResult, setBusinessLoanResult] = useState<any>(null);
  const [fdResult, setFdResult] = useState<FDResult | null>(null);
  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null);

  // Get Interest Rates
  const { data: interestRates, isLoading: ratesLoading } = useQuery({
    queryKey: ['/api/bajaj-finance/interest-rates'],
  });

  // Calculate EMI
  const calculateEMI = async () => {
    if (!emiForm.principal || !emiForm.interestRate || !emiForm.tenure) return;
    
    const response = await fetch('/api/bajaj-finance/calculate-emi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emiForm)
    });
    
    const result = await response.json();
    if (result.success) {
      setEmiResult(result.data);
    }
  };

  // Calculate Personal Loan
  const calculatePersonalLoan = async () => {
    if (!personalLoanForm.amount || !personalLoanForm.tenure) return;
    
    const response = await fetch('/api/bajaj-finance/personal-loan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personalLoanForm)
    });
    
    const result = await response.json();
    if (result.success) {
      setPersonalLoanResult(result.data);
    }
  };

  // Calculate Business Loan
  const calculateBusinessLoan = async () => {
    if (!businessLoanForm.amount || !businessLoanForm.tenure || !businessLoanForm.businessType) return;
    
    const response = await fetch('/api/bajaj-finance/business-loan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(businessLoanForm)
    });
    
    const result = await response.json();
    if (result.success) {
      setBusinessLoanResult(result.data);
    }
  };

  // Calculate Fixed Deposit
  const calculateFD = async () => {
    if (!fdForm.amount || !fdForm.tenure) return;
    
    const response = await fetch('/api/bajaj-finance/fixed-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fdForm)
    });
    
    const result = await response.json();
    if (result.success) {
      setFdResult(result.data);
    }
  };

  // Check Eligibility
  const checkEligibility = async () => {
    if (!eligibilityForm.salary || !eligibilityForm.age || !eligibilityForm.loanType) return;
    
    const response = await fetch('/api/bajaj-finance/check-eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eligibilityForm)
    });
    
    const result = await response.json();
    if (result.success) {
      setEligibilityResult(result.data);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Bajaj Finance Services
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Comprehensive financial solutions including loans, fixed deposits, insurance, and investment calculators
          </p>
        </div>

        {/* Current Interest Rates */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-6 w-6 mr-2 text-blue-600" />
              Current Interest Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ratesLoading ? (
              <div className="text-center py-4">Loading rates...</div>
            ) : interestRates?.success ? (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900">Personal Loan</h4>
                  <p className="text-blue-700">{interestRates.data.personalLoan.min}% - {interestRates.data.personalLoan.max}%</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900">Business Loan</h4>
                  <p className="text-green-700">{interestRates.data.businessLoan.min}% - {interestRates.data.businessLoan.max}%</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900">Home Loan</h4>
                  <p className="text-purple-700">{interestRates.data.homeLoan.min}% - {interestRates.data.homeLoan.max}%</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-900">Fixed Deposit</h4>
                  <p className="text-orange-700">{interestRates.data.fixedDeposit.regular}% - {interestRates.data.fixedDeposit.seniorCitizen}%</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-900">Auto Loan</h4>
                  <p className="text-red-700">{interestRates.data.autoLoan.min}% - {interestRates.data.autoLoan.max}%</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">Unable to load rates</div>
            )}
          </CardContent>
        </Card>

        {/* Financial Calculators */}
        <Tabs defaultValue="emi" className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <ScrollableTabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="emi" className="flex-shrink-0">EMI Calculator</TabsTrigger>
              <TabsTrigger value="personal-loan" className="flex-shrink-0">Personal Loan</TabsTrigger>
              <TabsTrigger value="business-loan" className="flex-shrink-0">Business Loan</TabsTrigger>
              <TabsTrigger value="fixed-deposit" className="flex-shrink-0">Fixed Deposit</TabsTrigger>
              <TabsTrigger value="eligibility" className="flex-shrink-0">Eligibility</TabsTrigger>
            </ScrollableTabsList>
          </div>

          {/* EMI Calculator */}
          <TabsContent value="emi">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calculator className="h-6 w-6 mr-2" />
                    EMI Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="principal">Loan Amount (₹)</Label>
                    <Input
                      id="principal"
                      type="number"
                      placeholder="e.g., 500000"
                      value={emiForm.principal}
                      onChange={(e) => setEmiForm({...emiForm, principal: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="interestRate">Interest Rate (%)</Label>
                    <Input
                      id="interestRate"
                      type="number"
                      step="0.1"
                      placeholder="e.g., 12.5"
                      value={emiForm.interestRate}
                      onChange={(e) => setEmiForm({...emiForm, interestRate: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tenure">Tenure (Months)</Label>
                    <Input
                      id="tenure"
                      type="number"
                      placeholder="e.g., 36"
                      value={emiForm.tenure}
                      onChange={(e) => setEmiForm({...emiForm, tenure: e.target.value})}
                    />
                  </div>
                  <Button onClick={calculateEMI} className="w-full">
                    Calculate EMI
                  </Button>
                </CardContent>
              </Card>

              {emiResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>EMI Calculation Result</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Monthly EMI</h4>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(emiResult.emi)}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Total Amount</h4>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(emiResult.totalAmount)}</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-900">Total Interest</h4>
                      <p className="text-xl font-bold text-orange-700">{formatCurrency(emiResult.totalInterest)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Personal Loan Calculator */}
          <TabsContent value="personal-loan">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <IndianRupee className="h-6 w-6 mr-2" />
                    Personal Loan Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="loan-amount">Loan Amount (₹)</Label>
                    <Input
                      id="loan-amount"
                      type="number"
                      placeholder="e.g., 300000"
                      value={personalLoanForm.amount}
                      onChange={(e) => setPersonalLoanForm({...personalLoanForm, amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-tenure">Tenure (Months)</Label>
                    <Select
                      value={personalLoanForm.tenure}
                      onValueChange={(value) => setPersonalLoanForm({...personalLoanForm, tenure: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 months</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={calculatePersonalLoan} className="w-full">
                    Calculate Personal Loan
                  </Button>
                </CardContent>
              </Card>

              {personalLoanResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Loan Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Monthly EMI</h4>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(personalLoanResult.emi)}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Interest Rate</h4>
                        <p className="text-xl font-bold text-green-700">{personalLoanResult.interestRate}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-orange-900">Processing Fee</h4>
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(personalLoanResult.processingFee)}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-900">Total Amount</h4>
                        <p className="text-lg font-bold text-purple-700">{formatCurrency(personalLoanResult.totalAmount)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Business Loan Calculator */}
          <TabsContent value="business-loan">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="h-6 w-6 mr-2" />
                    Business Loan Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="business-amount">Loan Amount (₹)</Label>
                    <Input
                      id="business-amount"
                      type="number"
                      placeholder="e.g., 1000000"
                      value={businessLoanForm.amount}
                      onChange={(e) => setBusinessLoanForm({...businessLoanForm, amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="business-tenure">Tenure (Months)</Label>
                    <Select
                      value={businessLoanForm.tenure}
                      onValueChange={(value) => setBusinessLoanForm({...businessLoanForm, tenure: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 months</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                        <SelectItem value="84">84 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="business-type">Business Type</Label>
                    <Select
                      value={businessLoanForm.businessType}
                      onValueChange={(value) => setBusinessLoanForm({...businessLoanForm, businessType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                        <SelectItem value="trading">Trading</SelectItem>
                        <SelectItem value="services">Services</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={calculateBusinessLoan} className="w-full">
                    Calculate Business Loan
                  </Button>
                </CardContent>
              </Card>

              {businessLoanResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Business Loan Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Monthly EMI</h4>
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(businessLoanResult.emi)}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Interest Rate</h4>
                        <p className="text-xl font-bold text-green-700">{businessLoanResult.interestRate}%</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-orange-900">Processing Fee</h4>
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(businessLoanResult.processingFee)}</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-red-900">Collateral Required</h4>
                        <p className="text-lg font-bold text-red-700">
                          {businessLoanResult.collateralRequired ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Fixed Deposit Calculator */}
          <TabsContent value="fixed-deposit">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <PiggyBank className="h-6 w-6 mr-2" />
                    Fixed Deposit Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="fd-amount">Investment Amount (₹)</Label>
                    <Input
                      id="fd-amount"
                      type="number"
                      placeholder="e.g., 100000"
                      value={fdForm.amount}
                      onChange={(e) => setFdForm({...fdForm, amount: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fd-tenure">Tenure (Months)</Label>
                    <Select
                      value={fdForm.tenure}
                      onValueChange={(value) => setFdForm({...fdForm, tenure: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenure" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">12 months</SelectItem>
                        <SelectItem value="24">24 months</SelectItem>
                        <SelectItem value="36">36 months</SelectItem>
                        <SelectItem value="48">48 months</SelectItem>
                        <SelectItem value="60">60 months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fd-type">FD Type</Label>
                    <Select
                      value={fdForm.fdType}
                      onValueChange={(value) => setFdForm({...fdForm, fdType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select FD type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="senior-citizen">Senior Citizen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={calculateFD} className="w-full">
                    Calculate FD Returns
                  </Button>
                </CardContent>
              </Card>

              {fdResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fixed Deposit Returns</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-green-900">Maturity Amount</h4>
                        <p className="text-2xl font-bold text-green-700">{formatCurrency(fdResult.maturityAmount)}</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">Interest Rate</h4>
                        <p className="text-xl font-bold text-blue-700">{fdResult.interestRate}%</p>
                      </div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-orange-900">Interest Earned</h4>
                      <p className="text-xl font-bold text-orange-700">{formatCurrency(fdResult.interestEarned)}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Eligibility Checker */}
          <TabsContent value="eligibility">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    Loan Eligibility Checker
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="salary">Monthly Salary (₹)</Label>
                    <Input
                      id="salary"
                      type="number"
                      placeholder="e.g., 50000"
                      value={eligibilityForm.salary}
                      onChange={(e) => setEligibilityForm({...eligibilityForm, salary: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="e.g., 30"
                      value={eligibilityForm.age}
                      onChange={(e) => setEligibilityForm({...eligibilityForm, age: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="loan-type">Loan Type</Label>
                    <Select
                      value={eligibilityForm.loanType}
                      onValueChange={(value) => setEligibilityForm({...eligibilityForm, loanType: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                        <SelectItem value="business">Business Loan</SelectItem>
                        <SelectItem value="home">Home Loan</SelectItem>
                        <SelectItem value="auto">Auto Loan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={checkEligibility} className="w-full">
                    Check Eligibility
                  </Button>
                </CardContent>
              </Card>

              {eligibilityResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Eligibility Result</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className={`p-4 rounded-lg ${eligibilityResult.eligible ? 'bg-green-50' : 'bg-red-50'}`}>
                      <h4 className={`font-semibold ${eligibilityResult.eligible ? 'text-green-900' : 'text-red-900'}`}>
                        {eligibilityResult.eligible ? 'Eligible' : 'Not Eligible'}
                      </h4>
                      {eligibilityResult.eligible ? (
                        <div>
                          <p className="text-green-700 mb-2">Maximum loan amount:</p>
                          <p className="text-2xl font-bold text-green-700">
                            {formatCurrency(eligibilityResult.maxLoanAmount)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-red-700">{eligibilityResult.reason}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}