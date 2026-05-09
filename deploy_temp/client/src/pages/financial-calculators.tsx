import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calculator, TrendingUp, PiggyBank, Home, Car, Receipt, IndianRupee, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { 
  calculateIncomeTax, 
  calculateSipReturns, 
  calculateEmiSchedule,
  type TaxCalculationResult,
  type SipCalculationResult,
  type EmiCalculationResult
} from '@shared/calculations';

// Type aliases for imported types
type SipResult = SipCalculationResult;
type EmiResult = EmiCalculationResult;

// Zod schemas for form validation
const taxCalculatorSchema = z.object({
  annualIncome: z.string()
    .min(1, "Annual income is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Annual income must be a positive number"
    }),
  regime: z.enum(['new', 'old'], {
    required_error: "Please select a tax regime"
  }),
  section80C: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "Section 80C deduction must be a valid number"
    }),
  section80D: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "Section 80D deduction must be a valid number"
    }),
  houseRent: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "House rent allowance must be a valid number"
    }),
  homeLoanInterest: z.string()
    .optional()
    .refine((val) => !val || (!isNaN(Number(val)) && Number(val) >= 0), {
      message: "Home loan interest must be a valid number"
    }),
  age: z.enum(['below60', '60to80', 'above80'], {
    required_error: "Please select your age group"
  })
});

const sipCalculatorSchema = z.object({
  monthlyInvestment: z.string()
    .min(1, "Monthly investment amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 100, {
      message: "Monthly investment must be at least ₹100"
    }),
  expectedReturn: z.string()
    .min(1, "Expected return is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 50, {
      message: "Expected return must be between 1% and 50%"
    }),
  timePeriod: z.string()
    .min(1, "Investment period is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 50, {
      message: "Investment period must be between 1 and 50 years"
    })
});

const emiCalculatorSchema = z.object({
  loanAmount: z.string()
    .min(1, "Loan amount is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 10000, {
      message: "Loan amount must be at least ₹10,000"
    }),
  interestRate: z.string()
    .min(1, "Interest rate is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 50, {
      message: "Interest rate must be between 0.1% and 50%"
    }),
  tenure: z.string()
    .min(1, "Loan tenure is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 480, {
      message: "Loan tenure must be between 1 and 480 months"
    })
});

type TaxFormData = z.infer<typeof taxCalculatorSchema>;
type SipFormData = z.infer<typeof sipCalculatorSchema>;
type EmiFormData = z.infer<typeof emiCalculatorSchema>;

export default function FinancialCalculators() {
  const [location, setLocation] = useLocation();
  
  // Get current tool from URL parameter
  const getToolFromUrl = () => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const tool = urlParams.get('tool');
    return ['tax', 'sip', 'emi'].includes(tool || '') ? (tool || 'tax') : 'tax';
  };

  // Update URL when tab changes
  const updateUrlWithTool = (tool: string) => {
    const currentPath = location.split('?')[0];
    const newUrl = `${currentPath}?tool=${tool}`;
    setLocation(newUrl);
  };

  // Current active tab state
  const [activeTab, setActiveTab] = useState(getToolFromUrl);

  // Update active tab when URL changes
  useEffect(() => {
    const newTool = getToolFromUrl();
    if (newTool !== activeTab) {
      setActiveTab(newTool);
    }
  }, [location]);

  const { toast } = useToast();
  
  // Form instances with validation
  const taxForm = useForm<TaxFormData>({
    resolver: zodResolver(taxCalculatorSchema),
    defaultValues: {
      annualIncome: '',
      regime: 'new',
      section80C: '',
      section80D: '',
      houseRent: '',
      homeLoanInterest: '',
      age: 'below60'
    }
  });

  const sipForm = useForm<SipFormData>({
    resolver: zodResolver(sipCalculatorSchema),
    defaultValues: {
      monthlyInvestment: '',
      expectedReturn: '12',
      timePeriod: '10'
    }
  });

  const emiForm = useForm<EmiFormData>({
    resolver: zodResolver(emiCalculatorSchema),
    defaultValues: {
      loanAmount: '',
      interestRate: '',
      tenure: ''
    }
  });

  const [taxResult, setTaxResult] = useState<TaxCalculationResult | null>(null);
  const [sipResult, setSipResult] = useState<SipResult | null>(null);
  const [emiResult, setEmiResult] = useState<EmiResult | null>(null);
  const [sipLoading, setSipLoading] = useState(false);
  const [emiLoading, setEmiLoading] = useState(false);

  // Tax Calculation using Income Tax API integration
  const calculateTaxMutation = useMutation({
    mutationFn: async (formData: TaxFormData) => {
      // Integration with Quicko Sandbox API (mock implementation)
      // In production, this would call the actual Quicko Sandbox API
      const annualIncome = parseFloat(formData.annualIncome);
      const section80C = parseFloat(formData.section80C || '0');
      const section80D = parseFloat(formData.section80D || '0');
      const standardDeduction = formData.regime === 'new' ? 50000 : 50000;
      
      // Mock API response structure
      const mockApiResponse = await new Promise<TaxCalculationResult>((resolve) => {
        setTimeout(() => {
          const input = {
            annualIncome,
            regime: formData.regime as 'new' | 'old',
            section80C,
            section80D,
            age: formData.age as 'below60' | '60to80' | 'above80'
          };

          const result = calculateIncomeTax(input);
          resolve(result);
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

  // Form submission handlers
  const onTaxSubmit = (data: TaxFormData) => {
    calculateTaxMutation.mutate(data);
  };

  const onSipSubmit = async (data: SipFormData) => {
    setSipLoading(true);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const input = {
        monthlyInvestment: parseFloat(data.monthlyInvestment),
        expectedReturn: parseFloat(data.expectedReturn),
        timePeriod: parseFloat(data.timePeriod)
      };

      const result = calculateSipReturns(input);
      setSipResult(result);

      toast({
        title: "SIP Calculation Complete",
        description: `Maturity amount: ₹${result.maturityAmount.toLocaleString('en-IN')}`
      });
    } finally {
      setSipLoading(false);
    }
  };

  const onEmiSubmit = async (data: EmiFormData) => {
    setEmiLoading(true);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const input = {
        loanAmount: parseFloat(data.loanAmount),
        interestRate: parseFloat(data.interestRate),
        tenure: parseFloat(data.tenure)
      };

      const result = calculateEmiSchedule(input);
      setEmiResult(result);

      toast({
        title: "EMI Calculation Complete",
        description: `Monthly EMI: ₹${result.monthlyEmi.toLocaleString('en-IN')}`
      });
    } finally {
      setEmiLoading(false);
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

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    updateUrlWithTool(value);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto pb-2">
            <ScrollableTabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="tax" data-testid="tab-tax-calculator" className="flex-shrink-0">
                <Receipt className="w-4 h-4 mr-2" />
                Tax Calculator
              </TabsTrigger>
              <TabsTrigger value="sip" data-testid="tab-sip-calculator" className="flex-shrink-0">
                <TrendingUp className="w-4 h-4 mr-2" />
                SIP Calculator
              </TabsTrigger>
              <TabsTrigger value="emi" data-testid="tab-emi-calculator" className="flex-shrink-0">
                <Home className="w-4 h-4 mr-2" />
                EMI Calculator
              </TabsTrigger>
            </ScrollableTabsList>
          </div>

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
                <CardContent>
                  <Form {...taxForm}>
                    <form onSubmit={taxForm.handleSubmit(onTaxSubmit)} className="space-y-4">
                      <FormField
                        control={taxForm.control}
                        name="annualIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Annual Income</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Enter your annual income"
                                data-testid="input-annual-income"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={taxForm.control}
                        name="regime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tax Regime</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-tax-regime">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="new">New Tax Regime (2024-25)</SelectItem>
                                <SelectItem value="old">Old Tax Regime</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {taxForm.watch('regime') === 'old' && (
                        <>
                          <FormField
                            control={taxForm.control}
                            name="section80C"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Section 80C Deductions</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="EPF, PPF, ELSS, etc. (Max ₹1,50,000)"
                                    data-testid="input-section80c"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={taxForm.control}
                            name="section80D"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Section 80D Deductions</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="Health Insurance Premium"
                                    data-testid="input-section80d"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}

                      <FormField
                        control={taxForm.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Age Group</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-age-group">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="below60">Below 60 years</SelectItem>
                                <SelectItem value="60to80">60-80 years</SelectItem>
                                <SelectItem value="above80">Above 80 years</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit"
                        className="w-full" 
                        disabled={calculateTaxMutation.isPending}
                        data-testid="button-calculate-tax"
                      >
                        {calculateTaxMutation.isPending ? "Calculating..." : "Calculate Tax"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Tax Results */}
              {taxResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tax Calculation Results</CardTitle>
                    <Badge variant="outline">{(taxResult.regime || 'new').toUpperCase()} Tax Regime</Badge>
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

                    {/* Tax Optimization Suggestions */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border">
                      <h4 className="font-semibold mb-3 text-blue-800 dark:text-blue-200">💡 Tax Optimization Tips</h4>
                      <div className="space-y-3 text-sm">
                        {taxResult.effectiveRate > 20 && (
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>Your effective tax rate is {taxResult.effectiveRate.toFixed(1)}%. Consider maximizing Section 80C investments (ELSS, PPF, EPF) to reduce taxable income.</span>
                          </div>
                        )}
                        
                        {taxResult.regime === 'new' && taxResult.totalTax > 50000 && (
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>You might benefit from the old tax regime with deductions. Consider recalculating with the old regime option.</span>
                          </div>
                        )}
                        
                        {taxResult.regime === 'old' && taxResult.deductions.section80C < 150000 && (
                          <div className="flex items-start gap-2">
                            <span className="text-blue-600">•</span>
                            <span>You can save up to ₹{formatCurrency(150000 - taxResult.deductions.section80C)} more under Section 80C to reduce your tax liability.</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <span className="text-blue-600">•</span>
                          <span>Consider SIP investments in ELSS mutual funds for tax savings with growth potential.</span>
                        </div>
                      </div>
                    </div>
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
                <CardContent>
                  <Form {...sipForm}>
                    <form onSubmit={sipForm.handleSubmit(onSipSubmit)} className="space-y-4">
                      <FormField
                        control={sipForm.control}
                        name="monthlyInvestment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Investment Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Enter monthly SIP amount"
                                data-testid="input-monthly-investment"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={sipForm.control}
                        name="expectedReturn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Expected Annual Return (%)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="12"
                                data-testid="input-expected-return"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={sipForm.control}
                        name="timePeriod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investment Period (Years)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="10"
                                data-testid="input-time-period"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit"
                        className="w-full" 
                        disabled={sipLoading}
                        data-testid="button-calculate-sip"
                      >
                        {sipLoading ? "Calculating..." : "Calculate SIP Returns"}
                      </Button>
                    </form>
                  </Form>
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

                    {/* SIP Investment Suggestions */}
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg border">
                      <h4 className="font-semibold mb-3 text-green-800 dark:text-green-200">🎯 Investment Growth Tips</h4>
                      <div className="space-y-3 text-sm">
                        {sipResult.totalGainPercent > 300 && (
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">•</span>
                            <span>Excellent! Your SIP can grow by {sipResult.totalGainPercent.toFixed(0)}%. Start with large-cap equity mutual funds for stable returns.</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">•</span>
                          <span>Try increasing your SIP by just ₹1,000 to see how it significantly impacts your final corpus through compound growth.</span>
                        </div>
                        
                        {sipResult.maturityAmount > 1000000 && (
                          <div className="flex items-start gap-2">
                            <span className="text-green-600">•</span>
                            <span>Great! You'll cross ₹10 lakh. Consider diversifying across equity, debt, and international funds for balanced growth.</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">•</span>
                          <span>Set up automatic SIP payments on the 1st or 5th of each month for optimal rupee cost averaging.</span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">•</span>
                          <span>Review and rebalance your SIP portfolio annually to maintain your target asset allocation.</span>
                        </div>
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
                <CardContent>
                  <Form {...emiForm}>
                    <form onSubmit={emiForm.handleSubmit(onEmiSubmit)} className="space-y-4">
                      <FormField
                        control={emiForm.control}
                        name="loanAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="Enter loan amount"
                                data-testid="input-loan-amount"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emiForm.control}
                        name="interestRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Interest Rate (% per annum)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="8.5"
                                data-testid="input-interest-rate"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={emiForm.control}
                        name="tenure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Tenure (Years)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="15"
                                data-testid="input-tenure"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit"
                        className="w-full" 
                        disabled={emiLoading}
                        data-testid="button-calculate-emi"
                      >
                        {emiLoading ? "Calculating..." : "Calculate EMI"}
                      </Button>
                    </form>
                  </Form>
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

                    {/* EMI Optimization Suggestions */}
                    <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border">
                      <h4 className="font-semibold mb-3 text-orange-800 dark:text-orange-200">💰 Loan Optimization Tips</h4>
                      <div className="space-y-3 text-sm">
                        {emiResult.totalInterest > emiResult.totalAmount * 0.4 && (
                          <div className="flex items-start gap-2">
                            <span className="text-orange-600">•</span>
                            <span>Your total interest is ₹{formatCurrency(emiResult.totalInterest)}. Consider making prepayments to reduce interest burden significantly.</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <span className="text-orange-600">•</span>
                          <span>Making an annual prepayment of just ₹50,000 can reduce your loan tenure by 2-3 years and save lakhs in interest.</span>
                        </div>
                        
                        {emiResult.monthlyEmi > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-orange-600">•</span>
                            <span>Follow the 40% rule: Your total EMIs shouldn't exceed 40% of your monthly income for healthy financial planning.</span>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-2">
                          <span className="text-orange-600">•</span>
                          <span>Compare loan offers from different banks and choose the one with the lowest processing fees and best interest rates.</span>
                        </div>
                        
                        <div className="flex items-start gap-2">
                          <span className="text-orange-600">•</span>
                          <span>Set up automatic EMI payments to avoid late fees and maintain a good credit score for future loans.</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  );
}