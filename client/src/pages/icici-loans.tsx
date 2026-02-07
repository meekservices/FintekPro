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
import { CreditCard, IndianRupee, Send, CheckCircle, AlertCircle, Clock, Eye, Download, RefreshCw, Building2, Calculator, FileText, Shield, Users, TrendingUp, PlusCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";

// Form validation schemas
const eligibilityCheckSchema = z.object({
  loanType: z.string().min(1, "Please select loan type"),
  monthlyIncome: z.number().min(10000, "Minimum monthly income should be ₹10,000"),
  existingEmi: z.number().min(0, "EMI cannot be negative"),
  loanAmount: z.number().min(50000, "Minimum loan amount is ₹50,000"),
  tenure: z.number().min(6, "Minimum tenure is 6 months").max(360, "Maximum tenure is 360 months")
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
    loanAmount: z.number().min(50000, "Minimum loan amount is ₹50,000"),
    tenure: z.number().min(6, "Minimum tenure is 6 months").max(360, "Maximum tenure is 360 months"),
    purpose: z.string().min(1, "Please specify loan purpose")
  }),
  employmentDetails: z.object({
    employmentType: z.string().min(1, "Please select employment type"),
    companyName: z.string().min(1, "Company name is required"),
    monthlyIncome: z.number().min(10000, "Minimum monthly income should be ₹10,000"),
    workExperience: z.number().min(1, "Work experience is required")
  }),
  cibilConsent: z.boolean().refine(val => val === true, "CIBIL consent is required"),
  termsAccepted: z.boolean().refine(val => val === true, "Please accept terms and conditions")
});

type EligibilityForm = z.infer<typeof eligibilityCheckSchema>;
type LoanApplicationForm = z.infer<typeof loanApplicationSchema>;

export default function ICICILoans() {
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

  // Get user's loan applications
  const { data: myApplications, isLoading: applicationsLoading } = useQuery({
    queryKey: ['/api/icici/loans/my-applications'],
    queryFn: async () => {
      return await apiRequest("GET", "/api/icici/loans/my-applications");
    }
  });

  // Eligibility check mutation
  const eligibilityCheckMutation = useMutation({
    mutationFn: async (data: EligibilityForm) => {
      return apiRequest("POST", "/api/icici/loans/eligibility", data);
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Eligibility Check Complete",
          description: data.data.message || "You are eligible for the loan!",
        });
        if (data.data.eligible) {
          setShowApplication(true);
          setActiveTab("application");
        }
      } else {
        toast({
          title: "Eligibility Check Failed",
          description: data.error || "Unable to check eligibility",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to check eligibility. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Loan application mutation
  const loanApplicationMutation = useMutation({
    mutationFn: async (data: LoanApplicationForm) => {
      return apiRequest("POST", "/api/icici/loans/apply", {
        ...data,
        addressDetails: {
          currentAddress: "Default Address", // In real app, collect this
          permanentAddress: "Default Address",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400001"
        },
        bankingDetails: {
          bankName: "ICICI Bank",
          accountNumber: "1234567890",
          ifscCode: "ICIC0000123"
        },
        documents: []
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Application Submitted Successfully",
          description: `Application ID: ${data.data.applicationId}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/icici/loans/my-applications'] });
        setActiveTab("applications");
        applicationForm.reset();
      } else {
        toast({
          title: "Application Failed",
          description: data.error || "Unable to submit application",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive"
      });
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
      'submitted': 'bg-blue-100 text-blue-800',
      'under_review': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'disbursed': 'bg-purple-100 text-purple-800'
    };
    return statusColors[status] || 'bg-muted text-foreground';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 dark:from-background dark:to-card p-4" data-testid="icici-loans-page">
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-600 rounded-lg">
              <Building2 className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">ICICI Bank Loans</h1>
              <p className="text-muted-foreground">Personal, Home & Business Loan Solutions</p>
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
                  <Calculator className="w-5 h-5 mr-2 text-orange-600" />
                  Check Your Loan Eligibility
                </CardTitle>
                <CardDescription>
                  Get instant pre-qualification based on your income and requirements
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
                                placeholder="e.g. 50000"
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
                                placeholder="e.g. 500000"
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
                                placeholder="e.g. 60"
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
                                placeholder="e.g. 15000"
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
                      className="w-full bg-orange-600 hover:bg-orange-700"
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

          {/* Loan Application Tab */}
          <TabsContent value="application" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-orange-600" />
                  Loan Application Form
                </CardTitle>
                <CardDescription>
                  Complete your loan application with accurate information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...applicationForm}>
                  <form onSubmit={applicationForm.handleSubmit(handleLoanApplication)} className="space-y-6">
                    {/* Applicant Details Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-orange-600">Applicant Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter first name" data-testid="input-first-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter last name" data-testid="input-last-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.dateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input type="date" data-testid="input-dob" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.panNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PAN Number</FormLabel>
                              <FormControl>
                                <Input placeholder="ABCDE1234F" data-testid="input-pan" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.mobileNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mobile Number</FormLabel>
                              <FormControl>
                                <Input placeholder="9876543210" data-testid="input-mobile" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="applicantDetails.emailId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email Address</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="email@example.com" data-testid="input-email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Employment Details Section */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-orange-600">Employment Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={applicationForm.control}
                          name="employmentDetails.employmentType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Employment Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-employment-type">
                                    <SelectValue placeholder="Select employment type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="salaried">Salaried</SelectItem>
                                  <SelectItem value="self-employed">Self-Employed</SelectItem>
                                  <SelectItem value="business">Business Owner</SelectItem>
                                  <SelectItem value="professional">Professional</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="employmentDetails.companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter company name" data-testid="input-company" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="employmentDetails.monthlyIncome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monthly Income (₹)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g. 50000"
                                  data-testid="input-employment-income"
                                  {...field}
                                  onChange={e => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={applicationForm.control}
                          name="employmentDetails.workExperience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Work Experience (years)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="e.g. 5"
                                  data-testid="input-experience"
                                  {...field}
                                  onChange={e => field.onChange(Number(e.target.value))}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Consents */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-orange-600">Consents & Declarations</h3>
                      
                      <FormField
                        control={applicationForm.control}
                        name="cibilConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-cibil-consent"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                I authorize ICICI Bank to access my CIBIL credit report for loan processing
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={applicationForm.control}
                        name="termsAccepted"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-terms"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                I accept the terms and conditions and privacy policy
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      disabled={loanApplicationMutation.isPending}
                      data-testid="button-submit-application"
                    >
                      {loanApplicationMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Submitting Application...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit Loan Application
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Applications Tab */}
          <TabsContent value="applications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-orange-600" />
                  My Loan Applications
                </CardTitle>
                <CardDescription>
                  Track the status of your loan applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Loading applications...</span>
                  </div>
                ) : myApplications?.data?.length > 0 ? (
                  <div className="space-y-4">
                    {myApplications.data.map((application: any) => (
                      <Card key={application.id} className="border-l-4 border-l-orange-600">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <h4 className="font-semibold">{application.applicationId}</h4>
                                <Badge className={getStatusBadge(application.status)}>
                                  {application.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {application.loanType} - ₹{Number(application.requestedAmount).toLocaleString('en-IN')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Applied on: {format(new Date(application.createdAt), 'dd MMM yyyy, hh:mm a')}
                              </p>
                            </div>
                            <Button variant="outline" size="sm" data-testid={`button-view-${application.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No loan applications found</p>
                    <Button
                      className="mt-4 bg-orange-600 hover:bg-orange-700"
                      onClick={() => setActiveTab("eligibility")}
                      data-testid="button-start-application"
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Start New Application
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-orange-600">Personal Loan</CardTitle>
                  <CardDescription>Instant approval, minimal documentation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: ₹50,000 - ₹40,00,000</li>
                    <li>• Interest rate: 10.85% - 16.00% p.a.</li>
                    <li>• Tenure: 12 - 60 months</li>
                    <li>• Processing time: 24-48 hours</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-orange-600">Home Loan</CardTitle>
                  <CardDescription>Best rates for your dream home</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to ₹10 Crores</li>
                    <li>• Interest rate: 8.50% - 9.65% p.a.</li>
                    <li>• Tenure: Up to 30 years</li>
                    <li>• Processing fee: 0.25% of loan amount</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-orange-600">Business Loan</CardTitle>
                  <CardDescription>Fuel your business growth</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: ₹1,00,000 - ₹75,00,000</li>
                    <li>• Interest rate: 11.25% - 20.00% p.a.</li>
                    <li>• Tenure: 12 - 60 months</li>
                    <li>• Minimal documentation required</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-orange-600">Vehicle Loan</CardTitle>
                  <CardDescription>Drive your dream vehicle home</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to 100% of vehicle cost</li>
                    <li>• Interest rate: 7.85% - 9.80% p.a.</li>
                    <li>• Tenure: Up to 7 years</li>
                    <li>• Quick approval process</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-orange-600">Education Loan</CardTitle>
                  <CardDescription>Invest in your future</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Loan amount: Up to ₹1.5 Crores</li>
                    <li>• Interest rate: 9.50% - 11.50% p.a.</li>
                    <li>• Tenure: Up to 15 years</li>
                    <li>• Moratorium period available</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}