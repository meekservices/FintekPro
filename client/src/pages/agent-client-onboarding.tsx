import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  User,
  CreditCard,
  MapPin,
  Building2,
  Target,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield as LucideShield,
  Upload,
  FileText,
  AlertCircle,
  Sparkles,
  Save,
  Check,
  PartyPopper,
  ExternalLink,
  RefreshCw
} from "lucide-react";

const basicInfoSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["M", "F", "O"], { required_error: "Please select a gender" }),
});

const panVerificationSchema = z.object({
  panNumber: z.string()
    .min(10, "PAN must be 10 characters")
    .max(10, "PAN must be 10 characters")
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  panVerified: z.boolean().optional(),
  panHolderName: z.string().optional(),
});

const addressSchema = z.object({
  aadhaarNumber: z.string().length(12, "Aadhaar must be 12 digits").optional(),
  addressLine1: z.string().min(5, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().min(6, "Pincode must be 6 digits").max(6),
  addressProofType: z.string().min(1, "Please select address proof type"),
  addressProofUrl: z.string().optional(),
});

const bankDetailsSchema = z.object({
  accountNumber: z.string().min(9, "Account number must be at least 9 digits").max(18),
  confirmAccountNumber: z.string().min(9, "Please confirm account number"),
  ifscCode: z.string()
    .min(11, "IFSC must be 11 characters")
    .max(11, "IFSC must be 11 characters")
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format"),
  bankName: z.string().min(2, "Bank name is required"),
  branchName: z.string().optional(),
  accountType: z.enum(["savings", "current"], { required_error: "Please select account type" }),
}).refine((data) => data.accountNumber === data.confirmAccountNumber, {
  message: "Account numbers don't match",
  path: ["confirmAccountNumber"],
});

const riskProfileSchema = z.object({
  investmentGoal: z.enum(["wealth_creation", "retirement", "tax_saving", "child_education", "emergency_fund", "regular_income"], 
    { required_error: "Please select your investment goal" }),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"], 
    { required_error: "Please select your risk tolerance" }),
  investmentHorizon: z.enum(["short", "medium", "long"], 
    { required_error: "Please select your investment horizon" }),
  annualIncome: z.enum(["below_5l", "5l_10l", "10l_25l", "25l_50l", "above_50l"], 
    { required_error: "Please select your annual income range" }),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"], 
    { required_error: "Please select your investment experience" }),
});

const fullFormSchema = basicInfoSchema
  .merge(panVerificationSchema)
  .merge(addressSchema)
  .merge(bankDetailsSchema)
  .merge(riskProfileSchema);

type FormData = z.infer<typeof fullFormSchema>;

const STEPS = [
  { id: 1, name: "Basic Info", icon: User, description: "Personal details" },
  { id: 2, name: "PAN Verification", icon: CreditCard, description: "Identity verification" },
  { id: 3, name: "Address & KYC", icon: MapPin, description: "Address & Aadhaar" },
  { id: 4, name: "Bank Details", icon: Building2, description: "Account information" },
  { id: 5, name: "Risk Profile", icon: Target, description: "Investment preferences" },
  { id: 6, name: "Review", icon: CheckCircle2, description: "Final confirmation" },
];

const DRAFT_KEY = "agent_client_onboarding_draft";

export default function AgentClientOnboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [panVerificationStatus, setPanVerificationStatus] = useState<"idle" | "verifying" | "verified" | "failed">("idle");
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(fullFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      dateOfBirth: "",
      gender: undefined,
      panNumber: "",
      panVerified: false,
      panHolderName: "",
      aadhaarNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      addressProofType: "",
      addressProofUrl: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: "",
      bankName: "",
      branchName: "",
      accountType: undefined,
      investmentGoal: undefined,
      riskTolerance: undefined,
      investmentHorizon: undefined,
      annualIncome: undefined,
      investmentExperience: undefined,
    },
    mode: "onChange",
  });

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        Object.keys(draft).forEach((key) => {
          form.setValue(key as keyof FormData, draft[key]);
        });
        toast({
          title: "Draft Restored",
          description: "Your previous progress has been restored",
        });
      } catch (e) {
        console.error("Failed to restore draft:", e);
      }
    }
  }, []);

  const saveDraft = useCallback(() => {
    const values = form.getValues();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  }, [form]);

  useEffect(() => {
    const subscription = form.watch(() => {
      saveDraft();
    });
    return () => subscription.unsubscribe();
  }, [form, saveDraft]);

  const panVerificationMutation = useMutation<any>({
    mutationFn: async (panNumber: string) => {
      return await apiRequest("/api/kyc/verify-pan", {
        method: "POST",
        body: JSON.stringify({ panNumber }),
      });
    },
    onSuccess: (data: any) => {
      if (data.success && data.verified) {
        setPanVerificationStatus("verified");
        if (data.name) {
          form.setValue("panHolderName", data.name);
        }
        form.setValue("panVerified", true);
        toast({
          title: "PAN Verified",
          description: `PAN verified successfully for ${data.name || "holder"}`,
        });
      } else {
        setPanVerificationStatus("failed");
        toast({
          title: "Verification Failed",
          description: data.message || "Could not verify PAN. Please check and try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setPanVerificationStatus("failed");
      toast({
        title: "Verification Error",
        description: error.message || "Failed to verify PAN",
        variant: "destructive",
      });
    },
  });

  const documentUploadMutation = useMutation<any>({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("/api/kyc/upload-document", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data: any) => {
      if (data.success && data.url) {
        form.setValue("addressProofUrl", data.url);
        toast({
          title: "Document Uploaded",
          description: "Address proof uploaded successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const onboardClientMutation = useMutation<any>({
    mutationFn: async (data: FormData) => {
      return await apiRequest("/api/agent/clients/onboard", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      localStorage.removeItem(DRAFT_KEY);
      setCreatedClientId(data.clientId);
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/agent/clients"] });
      toast({
        title: "Client Onboarded Successfully!",
        description: "The client has been registered and can now access their portfolio",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Onboarding Failed",
        description: error.message || "Failed to onboard client",
        variant: "destructive",
      });
    },
  });

  const verifyPAN = () => {
    const panNumber = form.getValues("panNumber");
    if (panNumber.length === 10) {
      setPanVerificationStatus("verifying");
      panVerificationMutation.mutate(panNumber);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload a file smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploadingDocument(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentType", "address_proof");
    
    try {
      await documentUploadMutation.mutateAsync(formData as any);
    } finally {
      setUploadingDocument(false);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    const values = form.getValues();
    
    switch (currentStep) {
      case 1:
        const basicResult = basicInfoSchema.safeParse(values);
        if (!basicResult.success) {
          basicResult.error.issues.forEach((issue) => {
            form.setError(issue.path[0] as keyof FormData, { message: issue.message });
          });
          return false;
        }
        return true;
      
      case 2:
        if (!values.panNumber || values.panNumber.length !== 10) {
          form.setError("panNumber", { message: "Please enter a valid PAN" });
          return false;
        }
        return true;
      
      case 3:
        const addressResult = addressSchema.safeParse(values);
        if (!addressResult.success) {
          addressResult.error.issues.forEach((issue) => {
            form.setError(issue.path[0] as keyof FormData, { message: issue.message });
          });
          return false;
        }
        return true;
      
      case 4:
        const bankResult = bankDetailsSchema.safeParse(values);
        if (!bankResult.success) {
          bankResult.error.issues.forEach((issue) => {
            form.setError(issue.path[0] as keyof FormData, { message: issue.message });
          });
          return false;
        }
        return true;
      
      case 5:
        const riskResult = riskProfileSchema.safeParse(values);
        if (!riskResult.success) {
          riskResult.error.issues.forEach((issue) => {
            form.setError(issue.path[0] as keyof FormData, { message: issue.message });
          });
          return false;
        }
        return true;
      
      default:
        return true;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onboardClientMutation.mutateAsync(form.getValues());
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-emerald-500/20 bg-gradient-to-br from-slate-900 to-emerald-950">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <PartyPopper className="w-10 h-10 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl text-foreground">Client Onboarded Successfully!</CardTitle>
            <CardDescription className="text-muted-foreground">
              The client has been registered and their KYC process has been initiated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-card/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                What's Next
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">1</span>
                  <span>Client will receive a welcome email with login credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">2</span>
                  <span>Complete video KYC verification (if required)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-emerald-500/20 text-emerald-400 rounded-full w-5 h-5 flex items-center justify-center text-xs mt-0.5">3</span>
                  <span>Start investing based on risk profile recommendations</span>
                </li>
              </ul>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-amber-400 flex items-center gap-2">
                <LucideShield className="w-4 h-4" />
                Agent-Restricted KYC Steps
              </h4>
              <p className="text-xs text-muted-foreground">
                The following steps must be completed by the customer directly and cannot be performed by agents:
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {['Aadhaar OTP', 'Aadhaar Verification', 'FATCA Signature', 'Compliance Sign-off'].map((step: any) => (
                  <span key={step} className="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {step}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                A secure KYC link will be sent to the customer to complete these steps.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {createdClientId && (
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => navigate(`/clients/${createdClientId}`)}
                  data-testid="button-view-client"
                >
                  View Client Profile
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full border-border text-foreground hover:bg-card"
                onClick={() => {
                  setIsSuccess(false);
                  setCurrentStep(1);
                  form.reset();
                }}
                data-testid="button-onboard-another"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Onboard Another Client
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => navigate("/clients")}
                data-testid="button-back-to-clients"
              >
                Back to Client List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboard New Client</h1>
          <p className="text-muted-foreground">Complete the KYC process to register a new client</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={saveDraft}
          className="border-border text-muted-foreground hover:bg-card"
          data-testid="button-save-draft"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Draft
        </Button>
      </div>

      <Card className="border-border bg-background/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Step {currentStep} of {STEPS.length}</span>
            <span className="text-sm text-emerald-400">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-2 bg-card" />
          
          <div className="flex items-center justify-between mt-6 overflow-x-auto pb-2">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div 
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center min-w-[80px]",
                    index < STEPS.length - 1 && "flex-1"
                  )}
                >
                  <div className="flex items-center w-full">
                    <button
                      type="button"
                      onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                      disabled={currentStep <= step.id}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                        isCompleted && "bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600",
                        isCurrent && "bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500",
                        !isCompleted && !isCurrent && "bg-card text-muted-foreground"
                      )}
                      data-testid={`step-${step.id}`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </button>
                    {index < STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-2",
                        isCompleted ? "bg-emerald-500" : "bg-muted"
                      )} />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 text-center",
                    isCurrent ? "text-emerald-400 font-medium" : "text-muted-foreground"
                  )}>
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">Basic Information</h3>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">First Name *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter first name"
                              className="bg-card border-border text-foreground"
                              data-testid="input-first-name"
                            />
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
                          <FormLabel className="text-muted-foreground">Last Name *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter last name"
                              className="bg-card border-border text-foreground"
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Email Address *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="client@example.com"
                              className="bg-card border-border text-foreground"
                              data-testid="input-email"
                            />
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
                          <FormLabel className="text-muted-foreground">Mobile Number *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              placeholder="9876543210"
                              className="bg-card border-border text-foreground"
                              data-testid="input-mobile"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Date of Birth *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              className="bg-card border-border text-foreground"
                              data-testid="input-dob"
                            />
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
                          <FormLabel className="text-muted-foreground">Gender *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-gender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="M">Male</SelectItem>
                              <SelectItem value="F">Female</SelectItem>
                              <SelectItem value="O">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">PAN Verification</h3>
                  </div>

                  <Alert className="bg-blue-500/10 border-blue-500/20">
                    <LucideShield className="w-4 h-4 text-blue-400" />
                    <AlertTitle className="text-blue-400">Identity Verification</AlertTitle>
                    <AlertDescription className="text-blue-300/80">
                      PAN verification is mandatory for KYC compliance. The details will be verified using Cashfree APIs.
                    </AlertDescription>
                  </Alert>

                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">PAN Number *</FormLabel>
                        <div className="flex gap-3">
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ABCDE1234F"
                              className="bg-card border-border text-foreground uppercase"
                              maxLength={10}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              data-testid="input-pan"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            onClick={verifyPAN}
                            disabled={field.value.length !== 10 || panVerificationStatus === "verifying"}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            data-testid="button-verify-pan"
                          >
                            {panVerificationStatus === "verifying" ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Verify"
                            )}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {panVerificationStatus === "verified" && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 animate-in fade-in-50">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-medium">PAN Verified Successfully</span>
                      </div>
                      {form.getValues("panHolderName") && (
                        <p className="text-muted-foreground mt-2">
                          Name: <span className="text-foreground font-medium">{form.getValues("panHolderName")}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {panVerificationStatus === "failed" && (
                    <Alert variant="destructive" className="bg-red-500/10 border-red-500/20">
                      <AlertCircle className="w-4 h-4" />
                      <AlertTitle>Verification Failed</AlertTitle>
                      <AlertDescription>
                        Could not verify PAN. Please check the number and try again.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">Address & KYC Details</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="aadhaarNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Aadhaar Number (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter 12-digit Aadhaar number"
                            maxLength={12}
                            className="bg-card border-border text-foreground"
                            data-testid="input-aadhaar"
                          />
                        </FormControl>
                        <FormDescription className="text-muted-foreground">
                          Aadhaar is optional but helps in faster KYC verification
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="addressLine1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Address Line 1 *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="House/Flat No., Building Name, Street"
                            className="bg-card border-border text-foreground"
                            data-testid="input-address1"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="addressLine2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Address Line 2</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Area, Landmark (Optional)"
                            className="bg-card border-border text-foreground"
                            data-testid="input-address2"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">City *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="City"
                              className="bg-card border-border text-foreground"
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">State *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="State"
                              className="bg-card border-border text-foreground"
                              data-testid="input-state"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pincode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Pincode *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="123456"
                              maxLength={6}
                              className="bg-card border-border text-foreground"
                              data-testid="input-pincode"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator className="bg-muted" />

                  <div className="space-y-4">
                    <h4 className="font-medium text-foreground">Address Proof</h4>
                    
                    <FormField
                      control={form.control}
                      name="addressProofType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Document Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-address-proof">
                                <SelectValue placeholder="Select document type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="aadhaar">Aadhaar Card</SelectItem>
                              <SelectItem value="passport">Passport</SelectItem>
                              <SelectItem value="voter_id">Voter ID</SelectItem>
                              <SelectItem value="driving_license">Driving License</SelectItem>
                              <SelectItem value="utility_bill">Utility Bill (Latest)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <input
                        type="file"
                        id="address-proof"
                        accept="image/*,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        data-testid="input-file-upload"
                      />
                      <label
                        htmlFor="address-proof"
                        className="cursor-pointer flex flex-col items-center"
                      >
                        {uploadingDocument ? (
                          <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                        ) : form.getValues("addressProofUrl") ? (
                          <>
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                            <span className="text-emerald-400 mt-2">Document Uploaded</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-muted-foreground" />
                            <span className="text-muted-foreground mt-2">Click to upload document</span>
                            <span className="text-muted-foreground text-sm">PNG, JPG or PDF (max 5MB)</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">Bank Details</h3>
                  </div>

                  <Alert className="bg-amber-500/10 border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <AlertTitle className="text-amber-400">Important</AlertTitle>
                    <AlertDescription className="text-amber-300/80">
                      Please ensure the bank account is in the client's name. This will be used for investments and redemptions.
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="accountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Account Number *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter account number"
                              className="bg-card border-border text-foreground"
                              data-testid="input-account-number"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Confirm Account Number *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Re-enter account number"
                              className="bg-card border-border text-foreground"
                              data-testid="input-confirm-account"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="ifscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">IFSC Code *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="SBIN0001234"
                              className="bg-card border-border text-foreground uppercase"
                              maxLength={11}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              data-testid="input-ifsc"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Bank Name *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Bank name"
                              className="bg-card border-border text-foreground"
                              data-testid="input-bank-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="branchName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Branch Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Branch name (optional)"
                              className="bg-card border-border text-foreground"
                              data-testid="input-branch-name"
                            />
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
                          <FormLabel className="text-muted-foreground">Account Type *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-account-type">
                                <SelectValue placeholder="Select account type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="savings">Savings Account</SelectItem>
                              <SelectItem value="current">Current Account</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <Target className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">Risk Profile</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="investmentGoal"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-muted-foreground">Investment Goal *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-2 md:grid-cols-3 gap-3"
                          >
                            {[
                              { value: "wealth_creation", label: "Wealth Creation" },
                              { value: "retirement", label: "Retirement Planning" },
                              { value: "tax_saving", label: "Tax Saving" },
                              { value: "child_education", label: "Child Education" },
                              { value: "emergency_fund", label: "Emergency Fund" },
                              { value: "regular_income", label: "Regular Income" },
                            ].map((goal) => (
                              <div key={goal.value}>
                                <RadioGroupItem
                                  value={goal.value}
                                  id={goal.value}
                                  className="peer sr-only"
                                />
                                <Label
                                  htmlFor={goal.value}
                                  className="flex items-center justify-center rounded-lg border-2 border-border bg-card p-3 hover:bg-muted peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10 cursor-pointer transition-all text-sm text-muted-foreground peer-data-[state=checked]:text-emerald-400"
                                  data-testid={`radio-goal-${goal.value}`}
                                >
                                  {goal.label}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="riskTolerance"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="text-muted-foreground">Risk Tolerance *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-3 gap-3"
                          >
                            <div>
                              <RadioGroupItem value="conservative" id="conservative" className="peer sr-only" />
                              <Label
                                htmlFor="conservative"
                                className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-4 hover:bg-muted peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10 cursor-pointer transition-all"
                                data-testid="radio-risk-conservative"
                              >
                                <span className="text-2xl mb-1">🛡️</span>
                                <span className="text-muted-foreground peer-data-[state=checked]:text-emerald-400">Conservative</span>
                                <span className="text-xs text-muted-foreground">Low risk, stable returns</span>
                              </Label>
                            </div>
                            <div>
                              <RadioGroupItem value="moderate" id="moderate" className="peer sr-only" />
                              <Label
                                htmlFor="moderate"
                                className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-4 hover:bg-muted peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10 cursor-pointer transition-all"
                                data-testid="radio-risk-moderate"
                              >
                                <span className="text-2xl mb-1">⚖️</span>
                                <span className="text-muted-foreground peer-data-[state=checked]:text-emerald-400">Moderate</span>
                                <span className="text-xs text-muted-foreground">Balanced approach</span>
                              </Label>
                            </div>
                            <div>
                              <RadioGroupItem value="aggressive" id="aggressive" className="peer sr-only" />
                              <Label
                                htmlFor="aggressive"
                                className="flex flex-col items-center justify-center rounded-lg border-2 border-border bg-card p-4 hover:bg-muted peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-500/10 cursor-pointer transition-all"
                                data-testid="radio-risk-aggressive"
                              >
                                <span className="text-2xl mb-1">🚀</span>
                                <span className="text-muted-foreground peer-data-[state=checked]:text-emerald-400">Aggressive</span>
                                <span className="text-xs text-muted-foreground">High risk, high potential</span>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="investmentHorizon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Investment Horizon *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-horizon">
                                <SelectValue placeholder="Select horizon" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="short">Short Term (&lt;3 years)</SelectItem>
                              <SelectItem value="medium">Medium Term (3-7 years)</SelectItem>
                              <SelectItem value="long">Long Term (7+ years)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="annualIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Annual Income *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-income">
                                <SelectValue placeholder="Select range" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="below_5l">Below ₹5 Lakhs</SelectItem>
                              <SelectItem value="5l_10l">₹5 - 10 Lakhs</SelectItem>
                              <SelectItem value="10l_25l">₹10 - 25 Lakhs</SelectItem>
                              <SelectItem value="25l_50l">₹25 - 50 Lakhs</SelectItem>
                              <SelectItem value="above_50l">Above ₹50 Lakhs</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="investmentExperience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Experience *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground" data-testid="select-experience">
                                <SelectValue placeholder="Select experience" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner (0-2 years)</SelectItem>
                              <SelectItem value="intermediate">Intermediate (2-5 years)</SelectItem>
                              <SelectItem value="experienced">Experienced (5+ years)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-lg font-medium text-foreground">Review & Submit</h3>
                  </div>

                  <Alert className="bg-emerald-500/10 border-emerald-500/20">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <AlertTitle className="text-emerald-400">Almost Done!</AlertTitle>
                    <AlertDescription className="text-emerald-300/80">
                      Please review all the information before submitting. You can go back to any step to make changes.
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="bg-card/50 border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <User className="w-4 h-4" /> Basic Info
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p className="text-foreground">{form.getValues("firstName")} {form.getValues("lastName")}</p>
                        <p className="text-muted-foreground">{form.getValues("email")}</p>
                        <p className="text-muted-foreground">{form.getValues("mobile")}</p>
                        <p className="text-muted-foreground">DOB: {form.getValues("dateOfBirth")}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> PAN Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p className="text-foreground">{form.getValues("panNumber")}</p>
                        {panVerificationStatus === "verified" && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                          </Badge>
                        )}
                        {form.getValues("panHolderName") && (
                          <p className="text-muted-foreground">{form.getValues("panHolderName")}</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <MapPin className="w-4 h-4" /> Address & KYC
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        {form.getValues("aadhaarNumber") && (
                          <p className="text-foreground">Aadhaar: ****{form.getValues("aadhaarNumber").slice(-4)}</p>
                        )}
                        <p className="text-foreground">{form.getValues("addressLine1")}</p>
                        {form.getValues("addressLine2") && <p className="text-muted-foreground">{form.getValues("addressLine2")}</p>}
                        <p className="text-muted-foreground">{form.getValues("city")}, {form.getValues("state")} - {form.getValues("pincode")}</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> Bank Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p className="text-foreground">{form.getValues("bankName")}</p>
                        <p className="text-muted-foreground">A/C: ****{form.getValues("accountNumber").slice(-4)}</p>
                        <p className="text-muted-foreground">IFSC: {form.getValues("ifscCode")}</p>
                        <p className="text-muted-foreground capitalize">{form.getValues("accountType")} Account</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-card/50 border-border md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                          <Target className="w-4 h-4" /> Risk Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Goal</p>
                          <p className="text-foreground capitalize">{form.getValues("investmentGoal")?.replace(/_/g, " ")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Risk</p>
                          <p className="text-foreground capitalize">{form.getValues("riskTolerance")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Horizon</p>
                          <p className="text-foreground capitalize">{form.getValues("investmentHorizon")} Term</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Income</p>
                          <p className="text-foreground">{form.getValues("annualIncome")?.replace(/_/g, " ").replace(/l/g, "L")}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Experience</p>
                          <p className="text-foreground capitalize">{form.getValues("investmentExperience")}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="border-border text-muted-foreground hover:bg-card"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                {currentStep < 6 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="button-next"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 min-w-[150px]"
                    data-testid="button-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Submit & Onboard
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
