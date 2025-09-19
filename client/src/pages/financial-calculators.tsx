import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, TrendingUp, PiggyBank, Home, Car, Receipt, IndianRupee, FileText } from 'lucide-react';
import { EnhancedNavigation } from '@/components/layout/enhanced-navigation';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';

interface TaxCalculationResult {
  grossIncome: number;
  taxableIncome: number;
  incomeTax: number;
  cess: number;
  totalTax: number;
  netIncome: number;
  effectiveRate: number;
  marginalRate: number;
  regime: string;
  deductions: {
    section80C: number;
    section80D: number;
    standardDeduction: number;
    total: number;
  };
  slabBreakdown: Array<{
    slab: string;
    rate: string;
    taxableAmount: number;
    tax: number;
  }>;
}

interface SipResult {
  totalInvestment: number;
  expectedReturns: number;
  maturityAmount: number;
  totalGainPercent: number;
}

interface EmiResult {
  monthlyEmi: number;
  totalInterest: number;
  totalAmount: number;
  schedule: Array<{
    month: number;
    emi: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

export default function FinancialCalculators() {
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
  
  // Tax Calculator State
  const [taxForm, setTaxForm] = useState({
    annualIncome: '',
    regime: 'new',
    section80C: '',
    section80D: '',
    houseRent: '',
    homeLoanInterest: '',
    age: 'below60'
  });

  // SIP Calculator State
  const [sipForm, setSipForm] = useState({
    monthlyInvestment: '',
    expectedReturn: '12',
    timePeriod: '10'
  });

  // EMI Calculator State
  const [emiForm, setEmiForm] = useState({
    loanAmount: '',
    interestRate: '',
    tenure: ''
  });

  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null);
  const [sipResult, setSipResult] = useState<SipResult | null>(null);
  const [emiResult, setEmiResult] = useState<EmiResult | null>(null);

  // Tax Calculation using Income Tax API integration
  const calculateTaxMutation = useMutation({
    mutationFn: async (formData: typeof taxForm) => {
      // Integration with Quicko Sandbox API (mock implementation)
      // In production, this would call the actual Quicko Sandbox API
      const annualIncome = parseFloat(formData.annualIncome);
      const section80C = parseFloat(formData.section80C || '0');
      const section80D = parseFloat(formData.section80D || '0');
      const standardDeduction = formData.regime === 'new' ? 50000 : 50000;
      
      // Mock API response structure
      const mockApiResponse = await new Promise<TaxCalculationResult>((resolve) => {
        setTimeout(() => {
          let taxableIncome = annualIncome - standardDeduction;
          
          if (formData.regime === 'old') {
            taxableIncome = taxableIncome - section80C - section80D;
          }

          let incomeTax = 0;
          let slabBreakdown: any[] = [];

          if (formData.regime === 'new') {
            // New Tax Regime (2024-25)
            if (taxableIncome > 300000) {
              const slab1 = Math.min(taxableIncome - 300000, 300000);
              incomeTax += slab1 * 0.05;
              slabBreakdown.push({
                slab: '₹3,00,001 - ₹6,00,000',
                rate: '5%',
                taxableAmount: slab1,
                tax: slab1 * 0.05
              });
            }
            if (taxableIncome > 600000) {
              const slab2 = Math.min(taxableIncome - 600000, 300000);
              incomeTax += slab2 * 0.10;
              slabBreakdown.push({
                slab: '₹6,00,001 - ₹9,00,000',
                rate: '10%',
                taxableAmount: slab2,
                tax: slab2 * 0.10
              });
            }
            if (taxableIncome > 900000) {
              const slab3 = Math.min(taxableIncome - 900000, 300000);
              incomeTax += slab3 * 0.15;
              slabBreakdown.push({
                slab: '₹9,00,001 - ₹12,00,000',
                rate: '15%',
                taxableAmount: slab3,
                tax: slab3 * 0.15
              });
            }
            if (taxableIncome > 1200000) {
              const slab4 = Math.min(taxableIncome - 1200000, 300000);
              incomeTax += slab4 * 0.20;
              slabBreakdown.push({
                slab: '₹12,00,001 - ₹15,00,000',
                rate: '20%',
                taxableAmount: slab4,
                tax: slab4 * 0.20
              });
            }
            if (taxableIncome > 1500000) {
              const slab5 = taxableIncome - 1500000;
              incomeTax += slab5 * 0.30;
              slabBreakdown.push({
                slab: 'Above ₹15,00,000',
                rate: '30%',
                taxableAmount: slab5,
                tax: slab5 * 0.30
              });
            }
          } else {
            // Old Tax Regime
            if (taxableIncome > 250000) {
              const slab1 = Math.min(taxableIncome - 250000, 250000);
              incomeTax += slab1 * 0.05;
              slabBreakdown.push({
                slab: '₹2,50,001 - ₹5,00,000',
                rate: '5%',
                taxableAmount: slab1,
                tax: slab1 * 0.05
              });
            }
            if (taxableIncome > 500000) {
              const slab2 = Math.min(taxableIncome - 500000, 500000);
              incomeTax += slab2 * 0.20;
              slabBreakdown.push({
                slab: '₹5,00,001 - ₹10,00,000',
                rate: '20%',
                taxableAmount: slab2,
                tax: slab2 * 0.20
              });
            }
            if (taxableIncome > 1000000) {
              const slab3 = taxableIncome - 1000000;
              incomeTax += slab3 * 0.30;
              slabBreakdown.push({
                slab: 'Above ₹10,00,000',
                rate: '30%',
                taxableAmount: slab3,
                tax: slab3 * 0.30
              });
            }
          }

          const cess = incomeTax * 0.04;
          const totalTax = incomeTax + cess;
          const netIncome = annualIncome - totalTax;

          resolve({
            grossIncome: annualIncome,
            taxableIncome,
            incomeTax,
            cess,
            totalTax,
            netIncome,
            effectiveRate: (totalTax / annualIncome) * 100,
            marginalRate: taxableIncome > 1500000 ? 30 : taxableIncome > 1200000 ? 20 : taxableIncome > 900000 ? 15 : taxableIncome > 600000 ? 10 : 5,
            regime: formData.regime,
            deductions: {
              section80C,
              section80D,
              standardDeduction,
              total: section80C + section80D + standardDeduction
            },
            slabBreakdown
          });
        }, 1000);
      });

      return mockApiResponse;
    },
    onSuccess: (result) => {
      setTaxResult(result);
      toast({
        title: "Tax Calculated Successfully",
        description: `Your estimated annual tax is ₹${result.totalTax.toLocaleString('en-IN')}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Calculation Failed",
        description: "Unable to calculate tax. Please check your inputs.",
        variant: "destructive"
      });
    }
  });

  // SIP Calculation
  const calculateSip = () => {
    const monthlyAmount = parseFloat(sipForm.monthlyInvestment);
    const annualReturn = parseFloat(sipForm.expectedReturn) / 100;
    const months = parseFloat(sipForm.timePeriod) * 12;
    const monthlyReturn = annualReturn / 12;

    const maturityAmount = monthlyAmount * (((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn) * (1 + monthlyReturn));
    const totalInvestment = monthlyAmount * months;
    const expectedReturns = maturityAmount - totalInvestment;

    setSipResult({
      totalInvestment,
      expectedReturns,
      maturityAmount,
      totalGainPercent: (expectedReturns / totalInvestment) * 100
    });

    toast({
      title: "SIP Calculation Complete",
      description: `Maturity amount: ₹${maturityAmount.toLocaleString('en-IN')}`
    });
  };

  // EMI Calculation
  const calculateEmi = () => {
    const principal = parseFloat(emiForm.loanAmount);
    const rate = parseFloat(emiForm.interestRate) / 100 / 12;
    const tenure = parseFloat(emiForm.tenure) * 12;

    const emi = (principal * rate * Math.pow(1 + rate, tenure)) / (Math.pow(1 + rate, tenure) - 1);
    const totalAmount = emi * tenure;
    const totalInterest = totalAmount - principal;

    // Generate EMI schedule for first 12 months
    let balance = principal;
    const schedule = [];
    for (let i = 1; i <= Math.min(12, tenure); i++) {
      const interestPayment = balance * rate;
      const principalPayment = emi - interestPayment;
      balance -= principalPayment;
      
      schedule.push({
        month: i,
        emi: Math.round(emi),
        principal: Math.round(principalPayment),
        interest: Math.round(interestPayment),
        balance: Math.round(balance)
      });
    }

    setEmiResult({
      monthlyEmi: emi,
      totalInterest,
      totalAmount,
      schedule
    });

    toast({
      title: "EMI Calculation Complete",
      description: `Monthly EMI: ₹${emi.toLocaleString('en-IN')}`
    });
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
    <>
      <EnhancedNavigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Financial Calculators</h1>
          <p className="text-gray-600">Plan your finances with our comprehensive calculator suite</p>
        </div>

        <Tabs defaultValue="tax" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tax" data-testid="tab-tax-calculator">
              <Receipt className="w-4 h-4 mr-2" />
              Tax Calculator
            </TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-sip-calculator">
              <TrendingUp className="w-4 h-4 mr-2" />
              SIP Calculator
            </TabsTrigger>
            <TabsTrigger value="emi" data-testid="tab-emi-calculator">
              <Home className="w-4 h-4 mr-2" />
              EMI Calculator
            </TabsTrigger>
          </TabsList>

          {/* Tax Calculator Tab */}
          <TabsContent value="tax" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tax Calculator Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Income Tax Calculator 2024-25
                  </CardTitle>
                  <CardDescription>
                    Calculate your income tax using official Income Tax Department rates
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="annual-income">Annual Income</Label>
                    <Input
                      id="annual-income"
                      type="number"
                      placeholder="Enter your annual income"
                      value={taxForm.annualIncome}
                      onChange={(e) => setTaxForm({ ...taxForm, annualIncome: e.target.value })}
                      data-testid="input-annual-income"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="tax-regime">Tax Regime</Label>
                    <Select value={taxForm.regime} onValueChange={(value) => setTaxForm({ ...taxForm, regime: value })}>
                      <SelectTrigger data-testid="select-tax-regime">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New Tax Regime (2024-25)</SelectItem>
                        <SelectItem value="old">Old Tax Regime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {taxForm.regime === 'old' && (
                    <>
                      <div>
                        <Label htmlFor="section80c">Section 80C Deductions</Label>
                        <Input
                          id="section80c"
                          type="number"
                          placeholder="EPF, PPF, ELSS, etc. (Max ₹1,50,000)"
                          value={taxForm.section80C}
                          onChange={(e) => setTaxForm({ ...taxForm, section80C: e.target.value })}
                          data-testid="input-section80c"
                        />
                      </div>

                      <div>
                        <Label htmlFor="section80d">Section 80D Deductions</Label>
                        <Input
                          id="section80d"
                          type="number"
                          placeholder="Health Insurance Premium"
                          value={taxForm.section80D}
                          onChange={(e) => setTaxForm({ ...taxForm, section80D: e.target.value })}
                          data-testid="input-section80d"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="age-group">Age Group</Label>
                    <Select value={taxForm.age} onValueChange={(value) => setTaxForm({ ...taxForm, age: value })}>
                      <SelectTrigger data-testid="select-age-group">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="below60">Below 60 years</SelectItem>
                        <SelectItem value="60to80">60-80 years</SelectItem>
                        <SelectItem value="above80">Above 80 years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => calculateTaxMutation.mutate(taxForm)}
                    disabled={calculateTaxMutation.isPending || !taxForm.annualIncome}
                    data-testid="button-calculate-tax"
                  >
                    {calculateTaxMutation.isPending ? "Calculating..." : "Calculate Tax"}
                  </Button>
                </CardContent>
              </Card>

              {/* Tax Results */}
              {taxResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Calculation Results</CardTitle>
                    <Badge variant="outline">{taxResult.regime.toUpperCase()} Tax Regime</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Gross Income:</span>
                        <span className="font-semibold">{formatCurrency(taxResult.grossIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Taxable Income:</span>
                        <span className="font-semibold">{formatCurrency(taxResult.taxableIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Income Tax:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(taxResult.incomeTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Health & Education Cess (4%):</span>
                        <span className="font-semibold text-red-600">{formatCurrency(taxResult.cess)}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between">
                        <span className="font-medium">Total Tax:</span>
                        <span className="font-bold text-red-600">{formatCurrency(taxResult.totalTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Net Income:</span>
                        <span className="font-bold text-green-600">{formatCurrency(taxResult.netIncome)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Effective Tax Rate:</span>
                        <span className="font-semibold">{taxResult.effectiveRate.toFixed(2)}%</span>
                      </div>
                    </div>

                    {taxResult.slabBreakdown.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-semibold mb-3">Tax Slab Breakdown</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Income Slab</TableHead>
                              <TableHead>Rate</TableHead>
                              <TableHead>Tax</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {taxResult.slabBreakdown.map((slab, index) => (
                              <TableRow key={index}>
                                <TableCell className="text-sm">{slab.slab}</TableCell>
                                <TableCell>{slab.rate}</TableCell>
                                <TableCell>{formatCurrency(slab.tax)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* SIP Calculator Tab */}
          <TabsContent value="sip" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    SIP Calculator
                  </CardTitle>
                  <CardDescription>
                    Calculate returns on your Systematic Investment Plan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="monthly-investment">Monthly Investment Amount</Label>
                    <Input
                      id="monthly-investment"
                      type="number"
                      placeholder="Enter monthly SIP amount"
                      value={sipForm.monthlyInvestment}
                      onChange={(e) => setSipForm({ ...sipForm, monthlyInvestment: e.target.value })}
                      data-testid="input-monthly-investment"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="expected-return">Expected Annual Return (%)</Label>
                    <Input
                      id="expected-return"
                      type="number"
                      placeholder="12"
                      value={sipForm.expectedReturn}
                      onChange={(e) => setSipForm({ ...sipForm, expectedReturn: e.target.value })}
                      data-testid="input-expected-return"
                    />
                  </div>

                  <div>
                    <Label htmlFor="time-period">Investment Period (Years)</Label>
                    <Input
                      id="time-period"
                      type="number"
                      placeholder="10"
                      value={sipForm.timePeriod}
                      onChange={(e) => setSipForm({ ...sipForm, timePeriod: e.target.value })}
                      data-testid="input-time-period"
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={calculateSip}
                    disabled={!sipForm.monthlyInvestment || !sipForm.expectedReturn || !sipForm.timePeriod}
                    data-testid="button-calculate-sip"
                  >
                    Calculate SIP Returns
                  </Button>
                </CardContent>
              </Card>

              {sipResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>SIP Calculation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm">Total Investment:</span>
                        <span className="font-semibold">{formatCurrency(sipResult.totalInvestment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Expected Returns:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(sipResult.expectedReturns)}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between">
                        <span className="font-medium">Maturity Amount:</span>
                        <span className="font-bold text-green-600">{formatCurrency(sipResult.maturityAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Total Gain:</span>
                        <span className="font-semibold">{sipResult.totalGainPercent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* EMI Calculator Tab */}
          <TabsContent value="emi" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    EMI Calculator
                  </CardTitle>
                  <CardDescription>
                    Calculate your loan EMI and payment schedule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="loan-amount">Loan Amount</Label>
                    <Input
                      id="loan-amount"
                      type="number"
                      placeholder="Enter loan amount"
                      value={emiForm.loanAmount}
                      onChange={(e) => setEmiForm({ ...emiForm, loanAmount: e.target.value })}
                      data-testid="input-loan-amount"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="interest-rate">Interest Rate (% per annum)</Label>
                    <Input
                      id="interest-rate"
                      type="number"
                      step="0.1"
                      placeholder="8.5"
                      value={emiForm.interestRate}
                      onChange={(e) => setEmiForm({ ...emiForm, interestRate: e.target.value })}
                      data-testid="input-interest-rate"
                    />
                  </div>

                  <div>
                    <Label htmlFor="tenure">Loan Tenure (Years)</Label>
                    <Input
                      id="tenure"
                      type="number"
                      placeholder="15"
                      value={emiForm.tenure}
                      onChange={(e) => setEmiForm({ ...emiForm, tenure: e.target.value })}
                      data-testid="input-tenure"
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={calculateEmi}
                    disabled={!emiForm.loanAmount || !emiForm.interestRate || !emiForm.tenure}
                    data-testid="button-calculate-emi"
                  >
                    Calculate EMI
                  </Button>
                </CardContent>
              </Card>

              {emiResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>EMI Calculation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between">
                        <span className="font-medium">Monthly EMI:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(emiResult.monthlyEmi)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Total Interest:</span>
                        <span className="font-semibold text-red-600">{formatCurrency(emiResult.totalInterest)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Total Amount Payable:</span>
                        <span className="font-semibold">{formatCurrency(emiResult.totalAmount)}</span>
                      </div>
                    </div>

                    <h4 className="font-semibold mb-3">Payment Schedule (First 12 months)</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>EMI</TableHead>
                          <TableHead>Principal</TableHead>
                          <TableHead>Interest</TableHead>
                          <TableHead>Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emiResult.schedule.map((payment) => (
                          <TableRow key={payment.month}>
                            <TableCell>{payment.month}</TableCell>
                            <TableCell>{formatCurrency(payment.emi)}</TableCell>
                            <TableCell>{formatCurrency(payment.principal)}</TableCell>
                            <TableCell>{formatCurrency(payment.interest)}</TableCell>
                            <TableCell>{formatCurrency(payment.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}