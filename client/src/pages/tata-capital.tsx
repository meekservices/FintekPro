import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Calculator, CreditCard, Home, Building, Car, TrendingUp, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

interface PersonalLoanResult {
  emi: number;
  interestRate: number;
  processingFee: number;
  totalAmount: number;
  eligibility: boolean;
}

interface HomeLoanResult {
  emi: number;
  interestRate: number;
  processingFee: number;
  totalAmount: number;
  maxLoanAmount: number;
}

interface BusinessLoanResult {
  emi: number;
  interestRate: number;
  processingFee: number;
  collateralRequired: boolean;
  eligibility: boolean;
}

interface UsedCarLoanResult {
  loanAmount: number;
  emi: number;
  interestRate: number;
  processingFee: number;
  maxLoanToValue: number;
  vehicleValuation: number;
}

interface LoanAgainstPropertyResult {
  emi: number;
  interestRate: number;
  maxLoanAmount: number;
  loanToValue: number;
  processingFee: number;
}

interface InterestRates {
  personalLoan: { min: number; max: number };
  homeLoan: { min: number; max: number };
  businessLoan: { min: number; max: number };
  usedCarLoan: { min: number; max: number };
  loanAgainstProperty: { min: number; max: number };
  loanAgainstSecurities: { min: number; max: number };
}

export default function TataCapital() {
  const [personalLoanData, setPersonalLoanData] = useState({ principal: '', tenure: '', employmentType: '' });
  const [personalLoanResult, setPersonalLoanResult] = useState<PersonalLoanResult | null>(null);
  const [personalLoanLoading, setPersonalLoanLoading] = useState(false);

  const [homeLoanData, setHomeLoanData] = useState({ principal: '', tenure: '', propertyType: '' });
  const [homeLoanResult, setHomeLoanResult] = useState<HomeLoanResult | null>(null);
  const [homeLoanLoading, setHomeLoanLoading] = useState(false);

  const [businessLoanData, setBusinessLoanData] = useState({ principal: '', tenure: '', businessVintage: '', turnover: '' });
  const [businessLoanResult, setBusinessLoanResult] = useState<BusinessLoanResult | null>(null);
  const [businessLoanLoading, setBusinessLoanLoading] = useState(false);

  const [carLoanData, setCarLoanData] = useState({ vehiclePrice: '', vehicleAge: '', downPayment: '', tenure: '' });
  const [carLoanResult, setCarLoanResult] = useState<UsedCarLoanResult | null>(null);
  const [carLoanLoading, setCarLoanLoading] = useState(false);

  const [lapData, setLapData] = useState({ propertyValue: '', loanAmount: '', tenure: '', propertyType: '' });
  const [lapResult, setLapResult] = useState<LoanAgainstPropertyResult | null>(null);
  const [lapLoading, setLapLoading] = useState(false);

  // Fetch interest rates
  const { data: interestRates } = useQuery<{ success: boolean; data: InterestRates }>({
    queryKey: ['/api/tata-capital/interest-rates'],
  });

  const calculatePersonalLoan = async () => {
    if (!personalLoanData.principal || !personalLoanData.tenure || !personalLoanData.employmentType) return;
    
    setPersonalLoanLoading(true);
    try {
      const response = await apiRequest('POST', '/api/tata-capital/personal-loan', {
        principal: parseInt(personalLoanData.principal),
        tenure: parseInt(personalLoanData.tenure),
        employmentType: personalLoanData.employmentType
      });
      const result = await response.json();
      setPersonalLoanResult(result.data);
    } catch (error) {
      console.error('Error calculating personal loan:', error);
    } finally {
      setPersonalLoanLoading(false);
    }
  };

  const calculateHomeLoan = async () => {
    if (!homeLoanData.principal || !homeLoanData.tenure || !homeLoanData.propertyType) return;
    
    setHomeLoanLoading(true);
    try {
      const response = await apiRequest('POST', '/api/tata-capital/home-loan', {
        principal: parseInt(homeLoanData.principal),
        tenure: parseInt(homeLoanData.tenure),
        propertyType: homeLoanData.propertyType
      });
      const result = await response.json();
      setHomeLoanResult(result.data);
    } catch (error) {
      console.error('Error calculating home loan:', error);
    } finally {
      setHomeLoanLoading(false);
    }
  };

  const calculateBusinessLoan = async () => {
    if (!businessLoanData.principal || !businessLoanData.tenure || !businessLoanData.businessVintage || !businessLoanData.turnover) return;
    
    setBusinessLoanLoading(true);
    try {
      const response = await apiRequest('POST', '/api/tata-capital/business-loan', {
        principal: parseInt(businessLoanData.principal),
        tenure: parseInt(businessLoanData.tenure),
        businessVintage: parseInt(businessLoanData.businessVintage),
        turnover: parseInt(businessLoanData.turnover)
      });
      const result = await response.json();
      setBusinessLoanResult(result.data);
    } catch (error) {
      console.error('Error calculating business loan:', error);
    } finally {
      setBusinessLoanLoading(false);
    }
  };

  const calculateCarLoan = async () => {
    if (!carLoanData.vehiclePrice || !carLoanData.vehicleAge || !carLoanData.downPayment || !carLoanData.tenure) return;
    
    setCarLoanLoading(true);
    try {
      const response = await apiRequest('POST', '/api/tata-capital/used-car-loan', {
        vehiclePrice: parseInt(carLoanData.vehiclePrice),
        vehicleAge: parseInt(carLoanData.vehicleAge),
        downPayment: parseInt(carLoanData.downPayment),
        tenure: parseInt(carLoanData.tenure)
      });
      const result = await response.json();
      setCarLoanResult(result.data);
    } catch (error) {
      console.error('Error calculating car loan:', error);
    } finally {
      setCarLoanLoading(false);
    }
  };

  const calculateLAP = async () => {
    if (!lapData.propertyValue || !lapData.loanAmount || !lapData.tenure || !lapData.propertyType) return;
    
    setLapLoading(true);
    try {
      const response = await apiRequest('POST', '/api/tata-capital/loan-against-property', {
        propertyValue: parseInt(lapData.propertyValue),
        loanAmount: parseInt(lapData.loanAmount),
        tenure: parseInt(lapData.tenure),
        propertyType: lapData.propertyType
      });
      const result = await response.json();
      setLapResult(result.data);
    } catch (error) {
      console.error('Error calculating LAP:', error);
    } finally {
      setLapLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Building className="w-6 h-6 text-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Tata Capital
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Comprehensive financial services with advanced loan calculators, credit analysis, and digital banking solutions
          </p>
        </div>

        {/* Current Interest Rates */}
        {interestRates?.data && (
          <Card className="mb-8 border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <TrendingUp className="w-5 h-5" />
                Current Interest Rates
              </CardTitle>
              <CardDescription>Latest interest rates across all loan products</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Personal Loan</p>
                  <p className="text-lg font-bold text-blue-600">{interestRates.data.personalLoan.min}% - {interestRates.data.personalLoan.max}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Home Loan</p>
                  <p className="text-lg font-bold text-green-600">{interestRates.data.homeLoan.min}% - {interestRates.data.homeLoan.max}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Business Loan</p>
                  <p className="text-lg font-bold text-purple-600">{interestRates.data.businessLoan.min}% - {interestRates.data.businessLoan.max}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Used Car Loan</p>
                  <p className="text-lg font-bold text-orange-600">{interestRates.data.usedCarLoan.min}% - {interestRates.data.usedCarLoan.max}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Loan Against Property</p>
                  <p className="text-lg font-bold text-red-600">{interestRates.data.loanAgainstProperty.min}% - {interestRates.data.loanAgainstProperty.max}%</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                  <p className="text-sm font-medium text-muted-foreground">Loan Against Securities</p>
                  <p className="text-lg font-bold text-indigo-600">{interestRates.data.loanAgainstSecurities.min}% - {interestRates.data.loanAgainstSecurities.max}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="personal-loan" className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-5 bg-card border border-border">
            <TabsTrigger value="personal-loan" className="data-[state=active]:bg-blue-100 dark:bg-blue-900/30 data-[state=active]:text-blue-800 dark:text-blue-200">
              <CreditCard className="w-4 h-4 mr-2" />
              Personal Loan
            </TabsTrigger>
            <TabsTrigger value="home-loan" className="data-[state=active]:bg-green-100 dark:bg-green-900/30 data-[state=active]:text-green-800 dark:text-green-200">
              <Home className="w-4 h-4 mr-2" />
              Home Loan
            </TabsTrigger>
            <TabsTrigger value="business-loan" className="data-[state=active]:bg-purple-100 dark:bg-purple-900/30 data-[state=active]:text-purple-800 dark:text-purple-200">
              <Building className="w-4 h-4 mr-2" />
              Business Loan
            </TabsTrigger>
            <TabsTrigger value="car-loan" className="data-[state=active]:bg-orange-100 dark:bg-orange-900/30 data-[state=active]:text-orange-800 dark:text-orange-200">
              <Car className="w-4 h-4 mr-2" />
              Used Car Loan
            </TabsTrigger>
            <TabsTrigger value="property-loan" className="data-[state=active]:bg-red-100 dark:bg-red-900/30 data-[state=active]:text-red-800 dark:text-red-200">
              <Shield className="w-4 h-4 mr-2" />
              Loan Against Property
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Personal Loan Calculator */}
          <TabsContent value="personal-loan">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <CreditCard className="w-5 h-5" />
                  Personal Loan Calculator
                </CardTitle>
                <CardDescription>Calculate EMI for personal loans with competitive interest rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="personal-principal">Loan Amount (₹)</Label>
                    <Input
                      id="personal-principal"
                      type="number"
                      placeholder="e.g., 500000"
                      value={personalLoanData.principal}
                      onChange={(e) => setPersonalLoanData(prev => ({ ...prev, principal: e.target.value }))}
                      data-testid="input-personal-loan-principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personal-tenure">Tenure (Months)</Label>
                    <Input
                      id="personal-tenure"
                      type="number"
                      placeholder="e.g., 36"
                      value={personalLoanData.tenure}
                      onChange={(e) => setPersonalLoanData(prev => ({ ...prev, tenure: e.target.value }))}
                      data-testid="input-personal-loan-tenure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personal-employment">Employment Type</Label>
                    <Select value={personalLoanData.employmentType} onValueChange={(value) => setPersonalLoanData(prev => ({ ...prev, employmentType: value }))}>
                      <SelectTrigger data-testid="select-personal-loan-employment">
                        <SelectValue placeholder="Select employment type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaried">Salaried</SelectItem>
                        <SelectItem value="self-employed">Self-Employed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={calculatePersonalLoan} 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={personalLoanLoading}
                  data-testid="button-calculate-personal-loan"
                >
                  {personalLoanLoading ? 'Calculating...' : 'Calculate Personal Loan EMI'}
                </Button>

                {personalLoanResult && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Monthly EMI</p>
                      <p className="text-xl font-bold text-blue-600" data-testid="text-personal-loan-emi">{formatCurrency(personalLoanResult.emi)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      <p className="text-xl font-bold text-blue-600" data-testid="text-personal-loan-rate">{personalLoanResult.interestRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Processing Fee</p>
                      <p className="text-xl font-bold text-blue-600" data-testid="text-personal-loan-fee">{formatCurrency(personalLoanResult.processingFee)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-bold text-blue-600" data-testid="text-personal-loan-total">{formatCurrency(personalLoanResult.totalAmount)}</p>
                    </div>
                    <div className="col-span-2 md:col-span-4 flex items-center justify-center gap-2">
                      {personalLoanResult.eligibility ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Eligible
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Not Eligible
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Home Loan Calculator */}
          <TabsContent value="home-loan">
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Home className="w-5 h-5" />
                  Home Loan Calculator
                </CardTitle>
                <CardDescription>Calculate EMI for home loans with attractive interest rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-principal">Loan Amount (₹)</Label>
                    <Input
                      id="home-principal"
                      type="number"
                      placeholder="e.g., 2500000"
                      value={homeLoanData.principal}
                      onChange={(e) => setHomeLoanData(prev => ({ ...prev, principal: e.target.value }))}
                      data-testid="input-home-loan-principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-tenure">Tenure (Months)</Label>
                    <Input
                      id="home-tenure"
                      type="number"
                      placeholder="e.g., 240"
                      value={homeLoanData.tenure}
                      onChange={(e) => setHomeLoanData(prev => ({ ...prev, tenure: e.target.value }))}
                      data-testid="input-home-loan-tenure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="home-property-type">Property Type</Label>
                    <Select value={homeLoanData.propertyType} onValueChange={(value) => setHomeLoanData(prev => ({ ...prev, propertyType: value }))}>
                      <SelectTrigger data-testid="select-home-loan-property-type">
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ready">Ready to Move</SelectItem>
                        <SelectItem value="under-construction">Under Construction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={calculateHomeLoan} 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={homeLoanLoading}
                  data-testid="button-calculate-home-loan"
                >
                  {homeLoanLoading ? 'Calculating...' : 'Calculate Home Loan EMI'}
                </Button>

                {homeLoanResult && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Monthly EMI</p>
                      <p className="text-xl font-bold text-green-600" data-testid="text-home-loan-emi">{formatCurrency(homeLoanResult.emi)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      <p className="text-xl font-bold text-green-600" data-testid="text-home-loan-rate">{homeLoanResult.interestRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Processing Fee</p>
                      <p className="text-xl font-bold text-green-600" data-testid="text-home-loan-fee">{formatCurrency(homeLoanResult.processingFee)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Amount</p>
                      <p className="text-xl font-bold text-green-600" data-testid="text-home-loan-total">{formatCurrency(homeLoanResult.totalAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Max Loan Amount</p>
                      <p className="text-xl font-bold text-green-600" data-testid="text-home-loan-max">{formatCurrency(homeLoanResult.maxLoanAmount)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Loan Calculator */}
          <TabsContent value="business-loan">
            <Card className="border-purple-200 dark:border-purple-800">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                  <Building className="w-5 h-5" />
                  Business Loan Calculator
                </CardTitle>
                <CardDescription>Calculate EMI for business loans based on business profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="business-principal">Loan Amount (₹)</Label>
                    <Input
                      id="business-principal"
                      type="number"
                      placeholder="e.g., 1000000"
                      value={businessLoanData.principal}
                      onChange={(e) => setBusinessLoanData(prev => ({ ...prev, principal: e.target.value }))}
                      data-testid="input-business-loan-principal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-tenure">Tenure (Months)</Label>
                    <Input
                      id="business-tenure"
                      type="number"
                      placeholder="e.g., 60"
                      value={businessLoanData.tenure}
                      onChange={(e) => setBusinessLoanData(prev => ({ ...prev, tenure: e.target.value }))}
                      data-testid="input-business-loan-tenure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-vintage">Business Vintage (Years)</Label>
                    <Input
                      id="business-vintage"
                      type="number"
                      placeholder="e.g., 3"
                      value={businessLoanData.businessVintage}
                      onChange={(e) => setBusinessLoanData(prev => ({ ...prev, businessVintage: e.target.value }))}
                      data-testid="input-business-loan-vintage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="business-turnover">Annual Turnover (₹)</Label>
                    <Input
                      id="business-turnover"
                      type="number"
                      placeholder="e.g., 5000000"
                      value={businessLoanData.turnover}
                      onChange={(e) => setBusinessLoanData(prev => ({ ...prev, turnover: e.target.value }))}
                      data-testid="input-business-loan-turnover"
                    />
                  </div>
                </div>

                <Button 
                  onClick={calculateBusinessLoan} 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={businessLoanLoading}
                  data-testid="button-calculate-business-loan"
                >
                  {businessLoanLoading ? 'Calculating...' : 'Calculate Business Loan EMI'}
                </Button>

                {businessLoanResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Monthly EMI</p>
                        <p className="text-xl font-bold text-purple-600" data-testid="text-business-loan-emi">{formatCurrency(businessLoanResult.emi)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="text-xl font-bold text-purple-600" data-testid="text-business-loan-rate">{businessLoanResult.interestRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Processing Fee</p>
                        <p className="text-xl font-bold text-purple-600" data-testid="text-business-loan-fee">{formatCurrency(businessLoanResult.processingFee)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                      {businessLoanResult.eligibility ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Eligible
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Not Eligible
                        </Badge>
                      )}
                      {businessLoanResult.collateralRequired && (
                        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          <Shield className="w-4 h-4 mr-1" />
                          Collateral Required
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Used Car Loan Calculator */}
          <TabsContent value="car-loan">
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <Car className="w-5 h-5" />
                  Used Car Loan Calculator
                </CardTitle>
                <CardDescription>Calculate EMI for used car loans with VAHAN integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="car-price">Vehicle Price (₹)</Label>
                    <Input
                      id="car-price"
                      type="number"
                      placeholder="e.g., 800000"
                      value={carLoanData.vehiclePrice}
                      onChange={(e) => setCarLoanData(prev => ({ ...prev, vehiclePrice: e.target.value }))}
                      data-testid="input-car-loan-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="car-age">Vehicle Age (Years)</Label>
                    <Input
                      id="car-age"
                      type="number"
                      placeholder="e.g., 3"
                      value={carLoanData.vehicleAge}
                      onChange={(e) => setCarLoanData(prev => ({ ...prev, vehicleAge: e.target.value }))}
                      data-testid="input-car-loan-age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="car-down-payment">Down Payment (₹)</Label>
                    <Input
                      id="car-down-payment"
                      type="number"
                      placeholder="e.g., 150000"
                      value={carLoanData.downPayment}
                      onChange={(e) => setCarLoanData(prev => ({ ...prev, downPayment: e.target.value }))}
                      data-testid="input-car-loan-down-payment"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="car-tenure">Tenure (Months)</Label>
                    <Input
                      id="car-tenure"
                      type="number"
                      placeholder="e.g., 60"
                      value={carLoanData.tenure}
                      onChange={(e) => setCarLoanData(prev => ({ ...prev, tenure: e.target.value }))}
                      data-testid="input-car-loan-tenure"
                    />
                  </div>
                </div>

                <Button 
                  onClick={calculateCarLoan} 
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  disabled={carLoanLoading}
                  data-testid="button-calculate-car-loan"
                >
                  {carLoanLoading ? 'Calculating...' : 'Calculate Used Car Loan EMI'}
                </Button>

                {carLoanResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Monthly EMI</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-emi">{formatCurrency(carLoanResult.emi)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-rate">{carLoanResult.interestRate}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Loan Amount</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-amount">{formatCurrency(carLoanResult.loanAmount)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Vehicle Valuation</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-valuation">{formatCurrency(carLoanResult.vehicleValuation)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">LTV Ratio</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-ltv">{carLoanResult.maxLoanToValue}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Processing Fee</p>
                        <p className="text-xl font-bold text-orange-600" data-testid="text-car-loan-fee">{formatCurrency(carLoanResult.processingFee)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Against Property Calculator */}
          <TabsContent value="property-loan">
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <Shield className="w-5 h-5" />
                  Loan Against Property Calculator
                </CardTitle>
                <CardDescription>Calculate EMI for loans against residential and commercial property</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lap-property-value">Property Value (₹)</Label>
                    <Input
                      id="lap-property-value"
                      type="number"
                      placeholder="e.g., 5000000"
                      value={lapData.propertyValue}
                      onChange={(e) => setLapData(prev => ({ ...prev, propertyValue: e.target.value }))}
                      data-testid="input-lap-property-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lap-loan-amount">Requested Loan Amount (₹)</Label>
                    <Input
                      id="lap-loan-amount"
                      type="number"
                      placeholder="e.g., 3000000"
                      value={lapData.loanAmount}
                      onChange={(e) => setLapData(prev => ({ ...prev, loanAmount: e.target.value }))}
                      data-testid="input-lap-loan-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lap-tenure">Tenure (Months)</Label>
                    <Input
                      id="lap-tenure"
                      type="number"
                      placeholder="e.g., 180"
                      value={lapData.tenure}
                      onChange={(e) => setLapData(prev => ({ ...prev, tenure: e.target.value }))}
                      data-testid="input-lap-tenure"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lap-property-type">Property Type</Label>
                    <Select value={lapData.propertyType} onValueChange={(value) => setLapData(prev => ({ ...prev, propertyType: value }))}>
                      <SelectTrigger data-testid="select-lap-property-type">
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={calculateLAP} 
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={lapLoading}
                  data-testid="button-calculate-lap"
                >
                  {lapLoading ? 'Calculating...' : 'Calculate Loan Against Property EMI'}
                </Button>

                {lapResult && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Monthly EMI</p>
                      <p className="text-xl font-bold text-red-600" data-testid="text-lap-emi">{formatCurrency(lapResult.emi)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Interest Rate</p>
                      <p className="text-xl font-bold text-red-600" data-testid="text-lap-rate">{lapResult.interestRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Max Loan Amount</p>
                      <p className="text-xl font-bold text-red-600" data-testid="text-lap-max-amount">{formatCurrency(lapResult.maxLoanAmount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">LTV Ratio</p>
                      <p className="text-xl font-bold text-red-600" data-testid="text-lap-ltv">{lapResult.loanToValue}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Processing Fee</p>
                      <p className="text-xl font-bold text-red-600" data-testid="text-lap-fee">{formatCurrency(lapResult.processingFee)}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Key Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <Calculator className="w-5 h-5" />
                Advanced Calculators
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Personal & Business Loans
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Home & Property Loans
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Vehicle Finance Solutions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Loan Against Securities
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                <Shield className="w-5 h-5" />
                Digital KYC & Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  CKYC Integration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  GST Verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  PAN Verification
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Bank Statement Analysis
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <TrendingUp className="w-5 h-5" />
                Smart Financial Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Credit Eligibility Check
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Account Aggregator
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Instant Disbursement
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Loan Management System
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* API Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-center text-foreground">Tata Capital API Integration</CardTitle>
            <CardDescription className="text-center">
              Comprehensive financial services API with real-time data processing and advanced analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3 text-blue-800 dark:text-blue-200">Available API Endpoints:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Personal Loan Calculator</li>
                  <li>• Home Loan Calculator</li>
                  <li>• Business Loan Calculator</li>
                  <li>• Used Car Loan Calculator</li>
                  <li>• Loan Against Property</li>
                  <li>• Loan Against Securities</li>
                  <li>• Credit Eligibility Check</li>
                  <li>• GST Verification</li>
                  <li>• Bank Statement Analysis</li>
                  <li>• CKYC Verification</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3 text-purple-800 dark:text-purple-200">Key Features:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Real-time interest rate calculations</li>
                  <li>• Automated eligibility checking</li>
                  <li>• Document upload and verification</li>
                  <li>• Lead management system</li>
                  <li>• Outstanding balance tracking</li>
                  <li>• Foreclosure calculations</li>
                  <li>• Account aggregator integration</li>
                  <li>• Instant disbursement processing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}