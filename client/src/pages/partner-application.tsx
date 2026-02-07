import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Upload, FileText, User, Building, CreditCard, DollarSign, Calendar, AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { DocumentUploadField } from "@/components/DocumentUploadField";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Form validation schema
const applicationSchema = z.object({
  // Personal Information
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"), 
  panNumber: z.string().length(10, "PAN must be 10 characters"),
  aadharNumber: z.string().length(12, "Aadhaar must be 12 digits").optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
  email: z.string().email("Invalid email address"),
  mobile: z.string().length(10, "Mobile number must be 10 digits"),
  
  // Address Information
  currentAddress: z.string().min(10, "Address must be at least 10 characters"),
  currentCity: z.string().min(2, "City is required"),
  currentState: z.string().min(2, "State is required"), 
  currentPincode: z.string().length(6, "Pincode must be 6 digits"),
  addressType: z.enum(["owned", "rented", "family"]),
  
  // Employment Information
  employmentType: z.enum(["salaried", "self_employed", "business", "professional"]),
  employerName: z.string().min(2, "Employer name is required").optional(),
  designation: z.string().min(2, "Designation is required").optional(),
  workExperience: z.coerce.number().min(0, "Work experience must be positive"),
  monthlyIncome: z.coerce.number().min(1, "Monthly income is required"),
  
  // Banking Information
  bankName: z.string().min(2, "Bank name is required"),
  accountNumber: z.string().min(8, "Account number must be at least 8 characters").optional(),
  accountType: z.enum(["savings", "current"]).optional(),
  
  // Loan Information
  loanAmount: z.coerce.number().min(1, "Loan amount is required"),
  tenure: z.coerce.number().min(6, "Minimum tenure is 6 months"),
  loanPurpose: z.string().min(5, "Loan purpose is required"),
  
  // Document IDs (references to uploaded documents)
  documentIds: z.object({
    panCard: z.array(z.string()).optional(),
    aadharCard: z.array(z.string()).optional(),
    salarySlips: z.array(z.string()).optional(),
    bankStatements: z.array(z.string()).optional(),
    employmentLetter: z.array(z.string()).optional()
  }).optional()
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

interface LenderInfo {
  name: string;
  displayName: string;
  requiredFields: string[];
  fieldMappings: Record<string, string>;
}

interface ApplicationData extends ApplicationFormData {
  lender: string;
  recommendationId?: string;
}

export default function PartnerApplicationPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/partner-application/:lender");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, any[]>>({
    panCard: [],
    aadharCard: [],
    salarySlips: [],
    bankStatements: [],
    employmentLetter: []
  });
  
  const lender = params?.lender;
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const recommendationId = urlParams.get('recommendation');

  // Get lender information
  const { data: lendersData, isLoading: loadingLenders } = useQuery({
    queryKey: ['/api/partner-applications/lenders'],
    enabled: !!lender
  });

  // Get prefill data
  const { data: prefillData, isLoading: loadingPrefill } = useQuery({
    queryKey: ['/api/partner-applications/prefill', lender],
    enabled: !!lender
  });

  const currentLender = lendersData?.data?.find((l: LenderInfo) => l.name === lender);
  
  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      panNumber: "",
      aadharNumber: "",
      dateOfBirth: "",
      gender: "male",
      maritalStatus: "single",
      email: "",
      mobile: "",
      currentAddress: "",
      currentCity: "",
      currentState: "",
      currentPincode: "",
      addressType: "owned",
      employmentType: "salaried",
      employerName: "",
      designation: "",
      workExperience: 5,
      monthlyIncome: 50000,
      bankName: "",
      accountNumber: "",
      accountType: "savings",
      loanAmount: 500000,
      tenure: 36,
      loanPurpose: "",
      documentIds: {
        panCard: [],
        aadharCard: [],
        salarySlips: [],
        bankStatements: [],
        employmentLetter: []
      }
    }
  });

  // Pre-fill form when data loads
  useEffect(() => {
    if (prefillData?.data) {
      const data = prefillData.data;
      form.reset({
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        panNumber: data.panNumber || "",
        aadharNumber: data.aadharNumber || "",
        dateOfBirth: data.dateOfBirth || "",
        gender: data.gender || "male",
        maritalStatus: data.maritalStatus || "single",
        email: data.email || "",
        mobile: data.mobile || "",
        currentAddress: data.currentAddress || "",
        currentCity: data.currentCity || "",
        currentState: data.currentState || "",
        currentPincode: data.currentPincode || "",
        addressType: data.addressType || "owned",
        employmentType: data.employmentType || "salaried", 
        employerName: data.employerName || "",
        designation: data.designation || "",
        workExperience: data.workExperience || 5,
        monthlyIncome: data.monthlyIncome ?? 50000,
        bankName: data.bankName || "",
        accountNumber: data.accountNumber || "",
        accountType: data.accountType || "savings",
        loanAmount: data.loanAmount || 500000,
        tenure: data.tenure || 36,
        loanPurpose: data.loanPurpose || ""
      });
    }
  }, [prefillData, form]);

  // Create application mutation
  const createApplicationMutation = useMutation({
    mutationFn: async (data: ApplicationData) => {
      return apiRequest('/api/partner-applications', {
        method: 'POST',
        body: {
          lender: data.lender,
          loanType: 'personal',
          recommendationId: data.recommendationId,
          applicationData: data,
          status: 'draft'
        }
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner-applications'] });
      toast({
        title: "Application Created",
        description: "Your loan application has been saved successfully."
      });
      // Navigate to applications list or continue to submit
      setLocation('/loan-recommendations?applied=true');
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create application",
        variant: "destructive"
      });
    }
  });

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest(`/api/partner-applications/${applicationId}/submit`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partner-applications'] });
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted to the lender successfully."
      });
      setLocation('/loan-recommendations?submitted=true');
    },
    onError: (error: any) => {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to submit application",
        variant: "destructive"
      });
    }
  });

  const onSubmit = async (data: ApplicationFormData) => {
    if (!lender) return;
    
    setIsSubmitting(true);
    try {
      const applicationData: ApplicationData = {
        ...data,
        lender,
        recommendationId: recommendationId || undefined
      };

      await createApplicationMutation.mutateAsync(applicationData);
    } catch (error) {
      console.error('Error submitting application:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 'personal', title: 'Personal Info', icon: User },
    { id: 'address', title: 'Address', icon: Building },
    { id: 'employment', title: 'Employment', icon: Building },
    { id: 'banking', title: 'Banking', icon: CreditCard },
    { id: 'loan', title: 'Loan Details', icon: DollarSign },
    { id: 'documents', title: 'Documents', icon: FileText },
    { id: 'review', title: 'Review', icon: CheckCircle }
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  if (!match || !lender) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invalid lender specified. Please go back to loan recommendations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loadingLenders || loadingPrefill) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!currentLender) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Lender not found. Please select a valid lender from loan recommendations.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl" data-testid="partner-application-page">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/loan-recommendations')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Recommendations
          </Button>
          <Badge variant="outline" data-testid="badge-lender">
            {currentLender.displayName}
          </Badge>
        </div>
        
        <h1 className="text-3xl font-bold mb-2" data-testid="title-application">
          Loan Application - {currentLender.displayName}
        </h1>
        <p className="text-muted-foreground mb-6" data-testid="text-description">
          Complete your loan application with pre-filled information from your profile.
        </p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium" data-testid="text-progress">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" data-testid="progress-bar" />
        </div>

        {/* Step Indicators */}
        <div className="flex justify-between mb-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            
            return (
              <div 
                key={step.id} 
                className={`flex flex-col items-center cursor-pointer transition-colors ${
                  isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
                }`}
                onClick={() => setCurrentStep(index)}
                data-testid={`step-${step.id}`}
              >
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 ${
                  isActive ? 'border-primary bg-primary text-primary-foreground' : 
                  isCompleted ? 'border-green-500 bg-green-500 text-white' : 
                  'border-muted-foreground'
                }`}>
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Step 0: Personal Information */}
          {currentStep === 0 && (
            <Card data-testid="card-personal-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Provide your basic personal details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-firstName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-lastName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ABCDE1234F" data-testid="input-panNumber" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aadharNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aadhaar Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="123456789012" data-testid="input-aadharNumber" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-dateOfBirth" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marital Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-maritalStatus">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="9876543210" data-testid="input-mobile" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Address Information */}
          {currentStep === 1 && (
            <Card data-testid="card-address-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Address Information
                </CardTitle>
                <CardDescription>
                  Provide your current residential address
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="currentAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Address *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter complete address" data-testid="textarea-currentAddress" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="currentCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-currentCity" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentState"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-currentState" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentPincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="110001" data-testid="input-currentPincode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="addressType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residence Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-addressType">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="owned">Owned</SelectItem>
                          <SelectItem value="rented">Rented</SelectItem>
                          <SelectItem value="family">Family Owned</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 2: Employment Information */}
          {currentStep === 2 && (
            <Card data-testid="card-employment-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Employment Information
                </CardTitle>
                <CardDescription>
                  Provide your employment and income details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employmentType">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="salaried">Salaried</SelectItem>
                            <SelectItem value="self_employed">Self Employed</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer/Company Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-employerName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="designation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Designation</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-designation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work Experience (Years) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-workExperience"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthlyIncome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Income (₹) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-monthlyIncome"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Banking Information */}
          {currentStep === 3 && (
            <Card data-testid="card-banking-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Banking Information
                </CardTitle>
                <CardDescription>
                  Provide your primary banking details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bank Name *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-bankName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-accountType">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="savings">Savings</SelectItem>
                            <SelectItem value="current">Current</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional - for faster processing" data-testid="input-accountNumber" />
                        </FormControl>
                        <FormDescription>
                          Account number is optional but helps in faster processing
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Loan Details */}
          {currentStep === 4 && (
            <Card data-testid="card-loan-details">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Loan Details
                </CardTitle>
                <CardDescription>
                  Specify your loan requirements
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="loanAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Loan Amount (₹) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-loanAmount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tenure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenure (Months) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-tenure"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="loanPurpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Purpose *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe the purpose of your loan" data-testid="textarea-loanPurpose" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 5: Documents */}
          {currentStep === 5 && (
            <Card data-testid="card-documents">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Upload
                </CardTitle>
                <CardDescription>
                  Upload required documents for loan processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <DocumentUploadField
                    documentType="panCard"
                    label="PAN Card"
                    required={true}
                    multiple={false}
                    accept="image/*,.pdf"
                    existingDocuments={uploadedDocuments.panCard}
                    onUploadComplete={(doc) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        panCard: [...prev.panCard, doc]
                      }));
                      // Update form with document ID
                      const currentIds = form.getValues('documentIds.panCard') || [];
                      form.setValue('documentIds.panCard', [...currentIds, doc.id]);
                    }}
                    onRemove={(docId) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        panCard: prev.panCard.filter(doc => doc.id !== docId)
                      }));
                      // Update form by removing document ID
                      const currentIds = form.getValues('documentIds.panCard') || [];
                      form.setValue('documentIds.panCard', currentIds.filter(id => id !== docId));
                    }}
                  />

                  <DocumentUploadField
                    documentType="aadharCard"
                    label="Aadhaar Card"
                    required={false}
                    multiple={false}
                    accept="image/*,.pdf"
                    existingDocuments={uploadedDocuments.aadharCard}
                    onUploadComplete={(doc) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        aadharCard: [...prev.aadharCard, doc]
                      }));
                      const currentIds = form.getValues('documentIds.aadharCard') || [];
                      form.setValue('documentIds.aadharCard', [...currentIds, doc.id]);
                    }}
                    onRemove={(docId) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        aadharCard: prev.aadharCard.filter(doc => doc.id !== docId)
                      }));
                      const currentIds = form.getValues('documentIds.aadharCard') || [];
                      form.setValue('documentIds.aadharCard', currentIds.filter(id => id !== docId));
                    }}
                  />

                  <DocumentUploadField
                    documentType="salarySlips"
                    label="Salary Slips (Last 3 months)"
                    required={false}
                    multiple={true}
                    accept="image/*,.pdf"
                    existingDocuments={uploadedDocuments.salarySlips}
                    onUploadComplete={(doc) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        salarySlips: [...prev.salarySlips, doc]
                      }));
                      const currentIds = form.getValues('documentIds.salarySlips') || [];
                      form.setValue('documentIds.salarySlips', [...currentIds, doc.id]);
                    }}
                    onRemove={(docId) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        salarySlips: prev.salarySlips.filter(doc => doc.id !== docId)
                      }));
                      const currentIds = form.getValues('documentIds.salarySlips') || [];
                      form.setValue('documentIds.salarySlips', currentIds.filter(id => id !== docId));
                    }}
                  />

                  <DocumentUploadField
                    documentType="bankStatements"
                    label="Bank Statements (Last 6 months)"
                    required={false}
                    multiple={true}
                    accept="image/*,.pdf"
                    existingDocuments={uploadedDocuments.bankStatements}
                    onUploadComplete={(doc) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        bankStatements: [...prev.bankStatements, doc]
                      }));
                      const currentIds = form.getValues('documentIds.bankStatements') || [];
                      form.setValue('documentIds.bankStatements', [...currentIds, doc.id]);
                    }}
                    onRemove={(docId) => {
                      setUploadedDocuments(prev => ({
                        ...prev,
                        bankStatements: prev.bankStatements.filter(doc => doc.id !== docId)
                      }));
                      const currentIds = form.getValues('documentIds.bankStatements') || [];
                      form.setValue('documentIds.bankStatements', currentIds.filter(id => id !== docId));
                    }}
                  />
                </div>

                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Document upload is optional at this stage. You can submit your application and upload documents later when requested by the lender.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <Card data-testid="card-review">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Review Application
                </CardTitle>
                <CardDescription>
                  Please review your information before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please review all information carefully. Once submitted, you cannot modify the application.
                  </AlertDescription>
                </Alert>

                {/* Application Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-semibold mb-3">Personal Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Name:</strong> {form.watch('firstName')} {form.watch('lastName')}</div>
                      <div><strong>PAN:</strong> {form.watch('panNumber')}</div>
                      <div><strong>Email:</strong> {form.watch('email')}</div>
                      <div><strong>Mobile:</strong> {form.watch('mobile')}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Employment</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Type:</strong> {form.watch('employmentType')}</div>
                      <div><strong>Company:</strong> {form.watch('employerName')}</div>
                      <div><strong>Income:</strong> ₹{form.watch('monthlyIncome')?.toLocaleString()}/month</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Loan Details</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Amount:</strong> ₹{form.watch('loanAmount')?.toLocaleString()}</div>
                      <div><strong>Tenure:</strong> {form.watch('tenure')} months</div>
                      <div><strong>Purpose:</strong> {form.watch('loanPurpose')}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Banking</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Bank:</strong> {form.watch('bankName')}</div>
                      <div><strong>Type:</strong> {form.watch('accountType')}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              data-testid="button-previous"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                data-testid="button-next"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting || createApplicationMutation.isPending}
                data-testid="button-submit"
              >
                {isSubmitting ? "Submitting..." : "Submit Application"}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}