import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CreditCard, IndianRupee, Send, CheckCircle, AlertCircle, Clock, Eye, Download, RefreshCw, Building2, Calculator, FileText, Shield as LucideShield, Users, TrendingUp, PlusCircle, Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Form validation schemas
const eligibilityCheckSchema = z.object({
  loanType: z.string().min(1, "Please select loan type"),
  monthlyIncome: z.number().min(15000, "Minimum monthly income should be ₹15,000"),
  existingEmi: z.number().min(0, "EMI cannot be negative"),
  loanAmount: z.number().min(100000, "Minimum loan amount is ₹1,00,000"),
  tenure: z.number().min(12, "Minimum tenure is 12 months").max(360, "Maximum tenure is 360 months")
});

const loanApplicationSchema = z.object({
  loanType: z.string().min(1, "Please select loan type"),
  applicantDetails: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format"),
    mobileNumber: z.string().regex(/^[0-9]{10}$/, "Invalid mobile number"),
    emailId: z.string().email("Invalid email address"),
    maritalStatus: z.string().min(1, "Please select marital status")
  }),
  loanDetails: z.object({
    loanAmount: z.number().min(100000, "Minimum loan amount is ₹1,00,000"),
    tenure: z.number().min(12, "Minimum tenure is 12 months").max(360, "Maximum tenure is 360 months"),
    purpose: z.string().min(1, "Please specify loan purpose")
  }),
  employmentDetails: z.object({
    employmentType: z.string().min(1, "Please select employment type"),
    companyName: z.string().min(1, "Company name is required"),
    monthlyIncome: z.number().min(15000, "Minimum monthly income should be ₹15,000"),
    workExperience: z.number().min(2, "Minimum 2 years work experience required")
  }),
  cibilConsent: z.boolean().refine(val => val === true, "CIBIL consent is required"),
  termsAccepted: z.boolean().refine(val => val === true, "Please accept terms and conditions")
});

type EligibilityForm = z.infer<typeof eligibilityCheckSchema>;
type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

export default function HDFCLoans() {
  const [activeTab, setActiveTab] = useState("eligibility");
  const [showApplication, setShowApplication] = useState(false);
  const { toast } = useToast();

  // Eligibility check form
  const eligibilityForm = useForm<EligibilityForm>({
    resolver: zodResolver(eligibilityCheckSchema),
    defaultValues: {
      loanType: "",
      monthlyIncome: 0,
      existingEmi: 0,
      loanAmount: 0,
      tenure: 0
    }
  });

  // Loan application form
  const applicationForm = useForm<LoanApplicationForm>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      loanType: "",
      applicantDetails: {
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        panNumber: "",
        mobileNumber: "",
        emailId: "",
        maritalStatus: ""
      },
      loanDetails: {
        loanAmount: 0,
        tenure: 0,
        purpose: ""
      },
      employmentDetails: {
        employmentType: "",
        companyName: "",
        monthlyIncome: 0,
        workExperience: 0
      },
      cibilConsent: false,
      termsAccepted: false
    }
  });

  // Get user's loan applications (mock data for now)
  const { data: myApplications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/hdfc/loans/my-applications'],
    queryFn: async () => ({
      success: true,
      data: [] // HDFC loan applications would be fetched here
    })
  });

  // Eligibility check mutation (mock implementation)
  const eligibilityCheckMutation = useMutation({
    mutationFn: async (data: EligibilityForm) => {
      // Mock HDFC eligibility check
      await new Promise(resolve => setTimeout(resolve, 2000));
      const eligible = data.monthlyIncome >= 25000 && data.loanAmount <= data.monthlyIncome * 60;
      return {
        success: true,
        data: {
          eligible,
          maxLoanAmount: data.monthlyIncome * 60,
          approvedAmount: Math.min(data.loanAmount, data.monthlyIncome * 60),
          interestRate: 10.75,
          processingFee: data.loanAmount * 0.005,
          message: eligible ? "Congratulations! You are eligible for HDFC Bank loan." : "Your application needs additional documentation."
        }
      };
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Eligibility Check Complete",
          description: data.data.message,
        });
        if (data.data.eligible) {
          setShowApplication(true);
          setActiveTab("application");
        }
      } else {
        toast({
          title: "Eligibility Check Failed",
          description: "Unable to check eligibility",
          variant: "destructive"
        });
      }
    }
  });

  // Loan application mutation (mock implementation)
  const loanApplicationMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      // Mock HDFC loan application
      await new Promise(resolve => setTimeout(resolve, 3000));
      const applicationId = `HDFC${Date.now()}`;
      return {
        success: true,
        data: {
          applicationId,
          status: "submitted",
          message: "Your loan application has been submitted successfully"
        }
      };
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Application Submitted Successfully",
          description: `Application ID: ${data.data.applicationId}`,
        });
        setActiveTab("applications");
        applicationForm.reset();
      } else {
        toast({
          title: "Application Failed",
          description: "Unable to submit application",
          variant: "destructive"
        });
      }
    }
  });

  const handleEligibilityCheck = (data: EligibilityForm) => {
    eligibilityCheckMutation.mutate(data);
  };

  const handleLoanApplication = (data: LoanApplicationForm) => {
    loanApplicationMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'submitted': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      'under_review': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
      'approved': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
      'rejected': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      'disbursed': 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
    };
    return statusColors[status] || 'bg-muted text-foreground';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card p-4" data-testid="hdfc-loans-page">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-600 rounded-lg">
              <Wallet className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">HDFC Bank Loans</h1>
              <p className="text-muted-foreground">Trusted banking partner for all loan needs</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <ScrollableTabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="eligibility" data-testid="tab-eligibility" className="flex-shrink-0">
                <Calculator className="w-4 h-4 mr-2" />
                Eligibility Check
              </TabsTrigger>
              <TabsTrigger value="application" disabled={!showApplication} data-testid="tab-application" className="flex-shrink-0">
                <FileText className="w-4 h-4 mr-2" />
                Apply for Loan
              </TabsTrigger>
              <TabsTrigger value="applications" data-testid="tab-applications" className="flex-shrink-0">
                <Eye className="w-4 h-4 mr-2" />
                My Applications
              </TabsTrigger>
              <TabsTrigger value="products" data-testid="tab-products" className="flex-shrink-0">
                <CreditCard className="w-4 h-4 mr-2" />
                Loan Products
              </TabsTrigger>
            </ScrollableTabsList>
          </div>

          {/* Eligibility Check Tab */}
          <TabsContent value="eligibility" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calculator className="w-5 h-5 mr-2 text-red-600" />
                  Check Your Loan Eligibility
                </CardTitle>
                <CardDescription>
                  Get pre-approval with HDFC Bank's advanced eligibility assessment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...eligibilityForm}>
                  <form onSubmit={eligibilityForm.handleSubmit(handleEligibilityCheck)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={eligibilityForm.control}
                        name="loanType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-loan-type">
                                  <SelectValue placeholder="Select loan type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="personal">Personal Loan</SelectItem>
                                <SelectItem value="home">Home Loan</SelectItem>
                                <SelectItem value="business">Business Loan</SelectItem>
                                <SelectItem value="education">Education Loan</SelectItem>
                                <SelectItem value="vehicle">Vehicle Loan</SelectItem>
                                <SelectItem value="gold">Gold Loan</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={eligibilityForm.control}
                        name="monthlyIncome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Income (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g. 60000"
                                data-testid="input-monthly-income"
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={eligibilityForm.control}
                        name="loanAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Amount (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g. 1000000"
                                data-testid="input-loan-amount"
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={eligibilityForm.control}
                        name="tenure"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tenure (months)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g. 84"
                                data-testid="input-tenure"
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={eligibilityForm.control}
                        name="existingEmi"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Existing EMI (₹)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="e.g. 20000"
                                data-testid="input-existing-emi"
                                {...field}
                                onChange={e => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-red-600 hover:bg-red-700"
                      disabled={eligibilityCheckMutation.isPending}
                      data-testid="button-check-eligibility"
                    >
                      {eligibilityCheckMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Checking Eligibility...
                        </>
                      ) : (
                        <>
                          <Calculator className="w-4 h-4 mr-2" />
                          Check Eligibility
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Personal Loan</CardTitle>
                  <CardDescription>Instant approval, quick disbursal</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: ₹1,00,000 - ₹40,00,000</li>
                    <li>• Interest rate: 10.75% - 24.00% p.a.</li>
                    <li>• Tenure: 12 - 60 months</li>
                    <li>• Processing time: 10 minutes</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Home Loan</CardTitle>
                  <CardDescription>India's most trusted home loan</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to ₹10 Crores</li>
                    <li>• Interest rate: 8.40% - 9.40% p.a.</li>
                    <li>• Tenure: Up to 30 years</li>
                    <li>• Zero processing fee*</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Business Loan</CardTitle>
                  <CardDescription>Grow your business with us</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: ₹1,00,000 - ₹1 Crore</li>
                    <li>• Interest rate: 11.00% - 21.00% p.a.</li>
                    <li>• Tenure: 12 - 60 months</li>
                    <li>• Flexible repayment options</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Vehicle Loan</CardTitle>
                  <CardDescription>Your ride, your way</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to 90% of vehicle cost</li>
                    <li>• Interest rate: 7.75% - 9.50% p.a.</li>
                    <li>• Tenure: Up to 7 years</li>
                    <li>• No hidden charges</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Education Loan</CardTitle>
                  <CardDescription>Secure your future today</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to ₹1.5 Crores</li>
                    <li>• Interest rate: 9.25% - 13.25% p.a.</li>
                    <li>• Tenure: Up to 15 years</li>
                    <li>• Study loan with tax benefits</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-600">
                <CardHeader>
                  <CardTitle className="text-red-600">Gold Loan</CardTitle>
                  <CardDescription>Unlock the value of your gold</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to ₹1 Crore</li>
                    <li>• Interest rate: 9.50% - 17.00% p.a.</li>
                    <li>• Tenure: 6 - 36 months</li>
                    <li>• Instant approval & disbursal</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Application and Applications tabs would be similar to ICICI with HDFC-specific styling */}
          <TabsContent value="application" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-red-600" />
                  HDFC Bank Loan Application
                </CardTitle>
                <CardDescription>
                  Complete your loan application with HDFC Bank
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loan application form will be available here</p>
                  <p className="text-sm text-muted-foreground mt-2">This feature is under development</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-red-600" />
                  My HDFC Loan Applications
                </CardTitle>
                <CardDescription>
                  Track your loan applications with HDFC Bank
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No HDFC loan applications found</p>
                  <Button
                    className="mt-4 bg-red-600 hover:bg-red-700"
                    onClick={() => setActiveTab("eligibility")}
                    data-testid="button-start-application"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Start New Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}