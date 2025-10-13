import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  FileText, 
  MapPin, 
  DollarSign, 
  Shield, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Upload,
  Eye,
  Info,
  Lock,
  Loader2,
  XCircle,
  Sparkles
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface OnboardingData {
  // Basic Information
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  fatherName: string;
  motherName: string;
  
  // Contact Information
  email: string;
  phone: string;
  alternatePhone?: string;
  
  // Identity Information
  pan: string;
  aadhar: string;
  nationality: string;
  placeOfBirth: string;
  residencyStatus: string;
  
  // Address Information
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  
  // Financial Information
  occupation: string;
  employerName?: string;
  annualIncome: string;
  netWorth: string;
  sourceOfWealth: string;
  
  // Investment Profile
  investmentExperience: string;
  riskTolerance: string;
  investmentObjective: string;
  
  // Banking Information
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: string;
  
  // Demat Account
  dematProvider?: string;
  dematAccountNumber?: string;
  
  // Documents
  documents: {
    panCard?: string;
    aadharCard?: string;
    addressProof?: string;
    incomeProof?: string;
    bankStatement?: string;
    photograph?: string;
    signature?: string;
  };
  
  // Compliance
  pepDeclaration: boolean;
  fatcaDeclaration: boolean;
  crsDeclaration: boolean;
  
  // Consents
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

const initialData: OnboardingData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  maritalStatus: "",
  fatherName: "",
  motherName: "",
  email: "",
  phone: "",
  pan: "",
  aadhar: "",
  nationality: "Indian",
  placeOfBirth: "",
  residencyStatus: "Resident",
  addressLine1: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  occupation: "",
  annualIncome: "",
  netWorth: "",
  sourceOfWealth: "",
  investmentExperience: "",
  riskTolerance: "",
  investmentObjective: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  accountType: "",
  documents: {},
  pepDeclaration: false,
  fatcaDeclaration: false,
  crsDeclaration: false,
  terms: false,
  privacy: false,
  marketing: false
};

const LOCALSTORAGE_KEY = 'kyc_onboarding_draft';

export default function OnboardingPage() {
  const [formData, setFormData] = useState<OnboardingData>(initialData);
  const [currentStep, setCurrentStep] = useState("basic");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoadingPAN, setIsLoadingPAN] = useState(false);
  const [isLoadingAadhaar, setIsLoadingAadhaar] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validatePAN = (pan: string): { isValid: boolean; message: string } => {
    if (!pan) return { isValid: true, message: "" };
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (panRegex.test(pan)) {
      return { isValid: true, message: "Valid PAN format" };
    }
    return { isValid: false, message: "PAN format: AAAAA0000A (5 letters + 4 digits + 1 letter)" };
  };

  const validateAadhaar = (aadhaar: string): { isValid: boolean; message: string } => {
    if (!aadhaar) return { isValid: true, message: "" };
    const aadhaarRegex = /^[0-9]{12}$/;
    if (aadhaarRegex.test(aadhaar)) {
      return { isValid: true, message: "Valid Aadhaar format" };
    }
    return { isValid: false, message: "Aadhaar must be exactly 12 digits" };
  };

  const validateEmail = (email: string): { isValid: boolean; message: string } => {
    if (!email) return { isValid: true, message: "" };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      return { isValid: true, message: "Valid email format" };
    }
    return { isValid: false, message: "Please enter a valid email address" };
  };

  const validatePhone = (phone: string): { isValid: boolean; message: string } => {
    if (!phone) return { isValid: true, message: "" };
    const phoneRegex = /^[6-9][0-9]{9}$/;
    if (phoneRegex.test(phone)) {
      return { isValid: true, message: "Valid phone number" };
    }
    return { isValid: false, message: "Phone must be 10 digits starting with 6-9" };
  };

  const validatePincode = (pincode: string): { isValid: boolean; message: string } => {
    if (!pincode) return { isValid: true, message: "" };
    const pincodeRegex = /^[0-9]{6}$/;
    if (pincodeRegex.test(pincode)) {
      return { isValid: true, message: "Valid pincode" };
    }
    return { isValid: false, message: "Pincode must be exactly 6 digits" };
  };

  const mockFetchPANDetails = async (pan: string): Promise<{ firstName: string; lastName: string; dateOfBirth: string }> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      firstName: "Rajesh",
      lastName: "Kumar",
      dateOfBirth: "1990-05-15"
    };
  };

  const mockFetchAadhaarDetails = async (aadhaar: string): Promise<{ addressLine1: string; city: string; state: string; pincode: string }> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      addressLine1: "123 MG Road, Sector 14",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001"
    };
  };

  const handlePANAutoFill = async (pan: string) => {
    const validation = validatePAN(pan);
    if (validation.isValid && pan.length === 10) {
      setIsLoadingPAN(true);
      try {
        const details = await mockFetchPANDetails(pan);
        setFormData(prev => ({
          ...prev,
          firstName: details.firstName,
          lastName: details.lastName,
          dateOfBirth: details.dateOfBirth
        }));
        setAutoFilledFields(prev => {
          const newSet = new Set(prev);
          newSet.add('firstName');
          newSet.add('lastName');
          newSet.add('dateOfBirth');
          return newSet;
        });
        toast({
          title: "Auto-filled from PAN",
          description: "Name and DOB have been automatically populated from PAN records.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Auto-fill failed",
          description: "Could not fetch details from PAN. Please enter manually.",
        });
      } finally {
        setIsLoadingPAN(false);
      }
    }
  };

  const handleAadhaarAutoFill = async (aadhaar: string) => {
    const validation = validateAadhaar(aadhaar);
    if (validation.isValid && aadhaar.length === 12) {
      setIsLoadingAadhaar(true);
      try {
        const details = await mockFetchAadhaarDetails(aadhaar);
        setFormData(prev => ({
          ...prev,
          addressLine1: details.addressLine1,
          city: details.city,
          state: details.state,
          pincode: details.pincode
        }));
        setAutoFilledFields(prev => {
          const newSet = new Set(prev);
          newSet.add('addressLine1');
          newSet.add('city');
          newSet.add('state');
          newSet.add('pincode');
          return newSet;
        });
        toast({
          title: "Auto-filled from Aadhaar",
          description: "Address details have been automatically populated from Aadhaar records.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Auto-fill failed",
          description: "Could not fetch details from Aadhaar. Please enter manually.",
        });
      } finally {
        setIsLoadingAadhaar(false);
      }
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
        toast({
          title: "Draft restored",
          description: "Your previous progress has been loaded.",
        });
      } catch (error) {
        console.error("Failed to load saved data:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(formData));
      setLastSaved(new Date());
      setIsSaving(false);
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData]);

  useEffect(() => {
    const errors: Record<string, string> = {};
    
    const panValidation = validatePAN(formData.pan);
    if (!panValidation.isValid) errors.pan = panValidation.message;
    
    const aadhaarValidation = validateAadhaar(formData.aadhar);
    if (!aadhaarValidation.isValid) errors.aadhar = aadhaarValidation.message;
    
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) errors.email = emailValidation.message;
    
    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.isValid) errors.phone = phoneValidation.message;
    
    const pincodeValidation = validatePincode(formData.pincode);
    if (!pincodeValidation.isValid) errors.pincode = pincodeValidation.message;
    
    setValidationErrors(errors);
  }, [formData.pan, formData.aadhar, formData.email, formData.phone, formData.pincode]);

  const getTimeSinceLastSave = (): string => {
    if (!lastSaved) return "";
    const seconds = Math.floor((new Date().getTime() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  };

  const steps = [
    { id: "basic", label: "Basic Info", icon: User, fields: ["firstName", "lastName", "dateOfBirth", "gender"] },
    { id: "identity", label: "Identity & KYC", icon: FileText, fields: ["pan", "aadhar", "nationality"] },
    { id: "address", label: "Address", icon: MapPin, fields: ["addressLine1", "city", "state", "pincode"] },
    { id: "financial", label: "Financial Profile", icon: DollarSign, fields: ["occupation", "annualIncome", "netWorth"] },
    { id: "compliance", label: "Compliance", icon: Shield, fields: ["pepDeclaration", "fatcaDeclaration"] },
    { id: "banking", label: "Banking & Demat", icon: CreditCard, fields: ["bankName", "accountNumber", "ifscCode"] }
  ];

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (field === 'pan' && value.length === 10) {
      handlePANAutoFill(value);
    }

    if (field === 'aadhar' && value.length === 12) {
      handleAadhaarAutoFill(value);
    }
  };

  const updateDocument = (docType: string, documentPath: string) => {
    setFormData(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        [docType]: documentPath
      }
    }));
  };

  const getUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/objects/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.uploadURL
    };
  };

  const handleDocumentComplete = async (result: { uploadURL: string; file: File }, docType: string) => {
    try {
      const response = await apiRequest('PUT', '/api/documents', {
        body: {
          documentURL: result.uploadURL,
          documentType: docType,
          documentName: result.file.name
        }
      });
      const data = await response.json();

      if (data.success) {
        updateDocument(docType, data.objectPath);
        toast({
          title: "Document uploaded successfully",
          description: `${docType} has been uploaded and secured.`
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to process document upload."
      });
    }
  };

  const validateStep = (stepId: string): boolean => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return true;

    return step.fields.every(field => {
      const value = formData[field as keyof OnboardingData];
      return value !== undefined && value !== "" && value !== false;
    });
  };

  const calculateProgress = (): number => {
    const totalFields = steps.reduce((acc, step) => acc + step.fields.length, 0);
    const completedFields = steps.reduce((acc, step) => {
      return acc + step.fields.filter(field => {
        const value = formData[field as keyof OnboardingData];
        return value !== undefined && value !== "" && value !== false;
      }).length;
    }, 0);
    
    return Math.round((completedFields / totalFields) * 100);
  };

  const progress = calculateProgress();

  const saveOnboardingMutation = useMutation({
    mutationFn: async (data: OnboardingData) => {
      const response = await apiRequest('POST', '/api/onboarding', { body: data });
      return response.json();
    },
    onSuccess: () => {
      localStorage.removeItem(LOCALSTORAGE_KEY);
      setLastSaved(null);
      toast({
        title: "Onboarding completed successfully!",
        description: "Your profile has been submitted for review."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: "Please check your information and try again."
      });
    }
  });

  const handleSubmit = () => {
    if (progress < 80) {
      toast({
        variant: "destructive",
        title: "Profile incomplete",
        description: "Please complete at least 80% of your profile before submitting."
      });
      return;
    }

    if (!formData.terms || !formData.privacy) {
      toast({
        variant: "destructive",
        title: "Consent required",
        description: "Please accept terms and privacy policy to continue."
      });
      return;
    }

    saveOnboardingMutation.mutate(formData);
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Smart KYC Onboarding</h1>
          <p className="text-muted-foreground mb-4">
            Complete your profile to access our financial services
          </p>
          
          {/* Smart Mode Status Bar */}
          <div className="mb-6 max-w-2xl mx-auto">
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-blue-600 hover:bg-blue-700" data-testid="badge-smart-mode">
                      <Sparkles className="h-3 w-3 mr-1" />
                      SMART MODE ACTIVE
                    </Badge>
                    {(isLoadingPAN || isLoadingAadhaar) && (
                      <Badge variant="secondary" className="animate-pulse" data-testid="badge-fetching">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Fetching data...
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {isSaving ? (
                      <span className="flex items-center gap-1 animate-pulse text-blue-600 dark:text-blue-400" data-testid="text-saving">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    ) : lastSaved ? (
                      <span className="flex items-center gap-1" data-testid="text-last-saved">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        Last saved: {getTimeSinceLastSave()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Guidance Alert */}
          <Alert className="mb-6 text-left max-w-2xl mx-auto">
            <Info className="h-4 w-4" />
            <AlertTitle>Best for Individual Investors</AlertTitle>
            <AlertDescription>
              This AI-assisted wizard provides auto-fill, progressive save, and smart validation for individual investors. 
              <strong className="block mt-2">
                <span className="block">• Corporate entities: Use <a href="/manual-kyc?type=corporate" className="text-blue-600 underline font-semibold">Manual KYC - Corporate</a></span>
                <span className="block">• NRI investors: Use <a href="/manual-kyc?type=nri" className="text-blue-600 underline font-semibold">Manual KYC - NRI</a></span>
              </strong>
            </AlertDescription>
          </Alert>

          <div className="w-full max-w-md mx-auto">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Progress</span>
              <span>{progress}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" data-testid="progress-onboarding" />
          </div>
        </div>

      <Tabs value={currentStep} onValueChange={setCurrentStep} className="space-y-6">
        <ScrollableTabsList>
          {steps.map((step) => {
            const Icon = step.icon;
            const isCompleted = validateStep(step.id);
            return (
              <TabsTrigger 
                key={step.id} 
                value={step.id} 
                className="flex flex-col items-center space-y-1 p-2 min-w-[120px]"
                data-testid={`tab-${step.id}`}
              >
                <Icon className={`h-4 w-4 ${isCompleted ? 'text-green-500' : ''}`} />
                <span className="text-xs whitespace-nowrap">{step.label}</span>
                {isCompleted && <CheckCircle className="h-3 w-3 text-green-500" />}
              </TabsTrigger>
            );
          })}
        </ScrollableTabsList>

        {/* Basic Information */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Provide your personal details as per official documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="flex items-center gap-2">
                    First Name *
                    {autoFilledFields.has('firstName') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from PAN</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateFormData("firstName", e.target.value)}
                      placeholder="Enter first name"
                      data-testid="input-firstName"
                      className={autoFilledFields.has('firstName') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                    />
                    {autoFilledFields.has('firstName') && formData.firstName && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middleName">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName || ""}
                    onChange={(e) => updateFormData("middleName", e.target.value)}
                    placeholder="Enter middle name"
                    data-testid="input-middleName"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="flex items-center gap-2">
                    Last Name *
                    {autoFilledFields.has('lastName') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from PAN</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateFormData("lastName", e.target.value)}
                      placeholder="Enter last name"
                      data-testid="input-lastName"
                      className={autoFilledFields.has('lastName') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                    />
                    {autoFilledFields.has('lastName') && formData.lastName && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                    Date of Birth *
                    {autoFilledFields.has('dateOfBirth') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from PAN</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                      data-testid="input-dateOfBirth"
                      className={autoFilledFields.has('dateOfBirth') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                    />
                    {autoFilledFields.has('dateOfBirth') && formData.dateOfBirth && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => updateFormData("gender", value)}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status *</Label>
                  <Select value={formData.maritalStatus} onValueChange={(value) => updateFormData("maritalStatus", value)}>
                    <SelectTrigger data-testid="select-maritalStatus">
                      <SelectValue placeholder="Select marital status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single">Single</SelectItem>
                      <SelectItem value="Married">Married</SelectItem>
                      <SelectItem value="Divorced">Divorced</SelectItem>
                      <SelectItem value="Widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => updateFormData("nationality", e.target.value)}
                    placeholder="Enter nationality"
                    data-testid="input-nationality"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <Input
                    id="fatherName"
                    value={formData.fatherName}
                    onChange={(e) => updateFormData("fatherName", e.target.value)}
                    placeholder="Enter father's name"
                    data-testid="input-fatherName"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motherName">Mother's Name</Label>
                  <Input
                    id="motherName"
                    value={formData.motherName}
                    onChange={(e) => updateFormData("motherName", e.target.value)}
                    placeholder="Enter mother's name"
                    data-testid="input-motherName"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder="Enter email address"
                      data-testid="input-email"
                      className={validationErrors.email ? 'border-red-500' : formData.email && validateEmail(formData.email).isValid ? 'border-green-500' : ''}
                    />
                    {formData.email && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {validateEmail(formData.email).isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-email-valid" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" data-testid="icon-email-invalid" />
                        )}
                      </div>
                    )}
                  </div>
                  {validationErrors.email && (
                    <p className="text-xs text-red-500" data-testid="text-email-error">{validationErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <div className="relative">
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormData("phone", e.target.value)}
                      placeholder="Enter phone number"
                      data-testid="input-phone"
                      className={validationErrors.phone ? 'border-red-500' : formData.phone && validatePhone(formData.phone).isValid ? 'border-green-500' : ''}
                    />
                    {formData.phone && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {validatePhone(formData.phone).isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-phone-valid" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" data-testid="icon-phone-invalid" />
                        )}
                      </div>
                    )}
                  </div>
                  {validationErrors.phone && (
                    <p className="text-xs text-red-500" data-testid="text-phone-error">{validationErrors.phone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Identity & KYC */}
        <TabsContent value="identity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Identity & KYC Documents
              </CardTitle>
              <CardDescription>
                Upload your identity documents for verification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN Number *</Label>
                  <div className="relative">
                    <Input
                      id="pan"
                      value={formData.pan}
                      onChange={(e) => updateFormData("pan", e.target.value.toUpperCase())}
                      placeholder="AAAAA0000A"
                      maxLength={10}
                      data-testid="input-pan"
                      className={validationErrors.pan ? 'border-red-500' : formData.pan && validatePAN(formData.pan).isValid ? 'border-green-500' : ''}
                      disabled={isLoadingPAN}
                    />
                    {isLoadingPAN ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" data-testid="icon-pan-loading" />
                      </div>
                    ) : formData.pan && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {validatePAN(formData.pan).isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-pan-valid" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" data-testid="icon-pan-invalid" />
                        )}
                      </div>
                    )}
                  </div>
                  {validationErrors.pan ? (
                    <p className="text-xs text-red-500" data-testid="text-pan-error">{validationErrors.pan}</p>
                  ) : formData.pan && validatePAN(formData.pan).isValid ? (
                    <p className="text-xs text-green-600" data-testid="text-pan-success">Valid PAN format</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Format: AAAAA0000A (5 letters + 4 digits + 1 letter)</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aadhar">Aadhaar Number *</Label>
                  <div className="relative">
                    <Input
                      id="aadhar"
                      value={formData.aadhar}
                      onChange={(e) => updateFormData("aadhar", e.target.value)}
                      placeholder="Enter 12-digit Aadhaar"
                      maxLength={12}
                      data-testid="input-aadhar"
                      className={validationErrors.aadhar ? 'border-red-500' : formData.aadhar && validateAadhaar(formData.aadhar).isValid ? 'border-green-500' : ''}
                      disabled={isLoadingAadhaar}
                    />
                    {isLoadingAadhaar ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" data-testid="icon-aadhar-loading" />
                      </div>
                    ) : formData.aadhar && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {validateAadhaar(formData.aadhar).isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-aadhar-valid" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" data-testid="icon-aadhar-invalid" />
                        )}
                      </div>
                    )}
                  </div>
                  {validationErrors.aadhar ? (
                    <p className="text-xs text-red-500" data-testid="text-aadhar-error">{validationErrors.aadhar}</p>
                  ) : formData.aadhar && validateAadhaar(formData.aadhar).isValid ? (
                    <p className="text-xs text-green-600" data-testid="text-aadhar-success">Valid Aadhaar format</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Enter 12-digit Aadhaar number</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Document Uploads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* PAN Card Upload */}
                  <div className="space-y-3">
                    <Label className="flex items-center justify-between">
                      <span>PAN Card *</span>
                      {formData.documents.panCard && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                      )}
                    </Label>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      acceptedTypes={["image/", "application/pdf"]}
                      onGetUploadParameters={getUploadParameters}
                      onComplete={(result) => handleDocumentComplete(result, "panCard")}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>{formData.documents.panCard ? "Replace PAN Card" : "Upload PAN Card"}</span>
                      </div>
                    </ObjectUploader>
                  </div>

                  {/* Aadhar Card Upload */}
                  <div className="space-y-3">
                    <Label className="flex items-center justify-between">
                      <span>Aadhar Card *</span>
                      {formData.documents.aadharCard && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                      )}
                    </Label>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={5242880} // 5MB
                      acceptedTypes={["image/", "application/pdf"]}
                      onGetUploadParameters={getUploadParameters}
                      onComplete={(result) => handleDocumentComplete(result, "aadharCard")}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>{formData.documents.aadharCard ? "Replace Aadhar Card" : "Upload Aadhar Card"}</span>
                      </div>
                    </ObjectUploader>
                  </div>

                  {/* Photograph Upload */}
                  <div className="space-y-3">
                    <Label className="flex items-center justify-between">
                      <span>Photograph</span>
                      {formData.documents.photograph && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                      )}
                    </Label>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={2097152} // 2MB
                      acceptedTypes={["image/"]}
                      onGetUploadParameters={getUploadParameters}
                      onComplete={(result) => handleDocumentComplete(result, "photograph")}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>{formData.documents.photograph ? "Replace Photograph" : "Upload Photograph"}</span>
                      </div>
                    </ObjectUploader>
                  </div>

                  {/* Signature Upload */}
                  <div className="space-y-3">
                    <Label className="flex items-center justify-between">
                      <span>Signature</span>
                      {formData.documents.signature && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Uploaded
                        </Badge>
                      )}
                    </Label>
                    <ObjectUploader
                      maxNumberOfFiles={1}
                      maxFileSize={1048576} // 1MB
                      acceptedTypes={["image/"]}
                      onGetUploadParameters={getUploadParameters}
                      onComplete={(result) => handleDocumentComplete(result, "signature")}
                      buttonClassName="w-full"
                    >
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>{formData.documents.signature ? "Replace Signature" : "Upload Signature"}</span>
                      </div>
                    </ObjectUploader>
                  </div>

                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Information */}
        <TabsContent value="address" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address Information
              </CardTitle>
              <CardDescription>
                Provide your current residential address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1" className="flex items-center gap-2">
                  Address Line 1 *
                  {autoFilledFields.has('addressLine1') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-blue-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Auto-filled from Aadhaar</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="addressLine1"
                    value={formData.addressLine1}
                    onChange={(e) => updateFormData("addressLine1", e.target.value)}
                    placeholder="Enter address line 1"
                    data-testid="input-addressLine1"
                    className={autoFilledFields.has('addressLine1') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                  />
                  {autoFilledFields.has('addressLine1') && formData.addressLine1 && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2 || ""}
                  onChange={(e) => updateFormData("addressLine2", e.target.value)}
                  placeholder="Enter address line 2"
                  data-testid="input-addressLine2"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="flex items-center gap-2">
                    City *
                    {autoFilledFields.has('city') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from Aadhaar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                      placeholder="Enter city"
                      data-testid="input-city"
                      className={autoFilledFields.has('city') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                    />
                    {autoFilledFields.has('city') && formData.city && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="flex items-center gap-2">
                    State *
                    {autoFilledFields.has('state') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from Aadhaar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateFormData("state", e.target.value)}
                      placeholder="Enter state"
                      data-testid="input-state"
                      className={autoFilledFields.has('state') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                    />
                    {autoFilledFields.has('state') && formData.state && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pincode" className="flex items-center gap-2">
                    Pincode *
                    {autoFilledFields.has('pincode') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Auto-filled from Aadhaar</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="pincode"
                      value={formData.pincode}
                      onChange={(e) => updateFormData("pincode", e.target.value)}
                      placeholder="Enter 6-digit pincode"
                      maxLength={6}
                      data-testid="input-pincode"
                      className={`${autoFilledFields.has('pincode') ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''} ${validationErrors.pincode ? 'border-red-500' : formData.pincode && validatePincode(formData.pincode).isValid ? 'border-green-500' : ''}`}
                    />
                    {autoFilledFields.has('pincode') && formData.pincode ? (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <CheckCircle className="h-4 w-4 text-blue-500" />
                      </div>
                    ) : formData.pincode && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {validatePincode(formData.pincode).isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" data-testid="icon-pincode-valid" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" data-testid="icon-pincode-invalid" />
                        )}
                      </div>
                    )}
                  </div>
                  {validationErrors.pincode && (
                    <p className="text-xs text-red-500" data-testid="text-pincode-error">{validationErrors.pincode}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => updateFormData("country", e.target.value)}
                    placeholder="Enter country"
                    data-testid="input-country"
                  />
                </div>
              </div>

              {/* Address Proof Upload */}
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>Address Proof Document</span>
                  {formData.documents.addressProof && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </Label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880} // 5MB
                  acceptedTypes={["image/", "application/pdf"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={(result) => handleDocumentComplete(result, "addressProof")}
                  buttonClassName="w-full max-w-md"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{formData.documents.addressProof ? "Replace Address Proof" : "Upload Address Proof"}</span>
                  </div>
                </ObjectUploader>
                <p className="text-sm text-muted-foreground">
                  Utility bill, bank statement, or government-issued address proof
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Profile */}
        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Profile
              </CardTitle>
              <CardDescription>
                Provide your financial and investment information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation *</Label>
                  <Input
                    id="occupation"
                    value={formData.occupation}
                    onChange={(e) => updateFormData("occupation", e.target.value)}
                    placeholder="Enter occupation"
                    data-testid="input-occupation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employerName">Employer Name</Label>
                  <Input
                    id="employerName"
                    value={formData.employerName || ""}
                    onChange={(e) => updateFormData("employerName", e.target.value)}
                    placeholder="Enter employer name"
                    data-testid="input-employerName"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="annualIncome">Annual Income *</Label>
                  <Select value={formData.annualIncome} onValueChange={(value) => updateFormData("annualIncome", value)}>
                    <SelectTrigger data-testid="select-annualIncome">
                      <SelectValue placeholder="Select annual income" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Below 1 Lakh">Below ₹1 Lakh</SelectItem>
                      <SelectItem value="1-5 Lakhs">₹1-5 Lakhs</SelectItem>
                      <SelectItem value="5-10 Lakhs">₹5-10 Lakhs</SelectItem>
                      <SelectItem value="10-25 Lakhs">₹10-25 Lakhs</SelectItem>
                      <SelectItem value="25-50 Lakhs">₹25-50 Lakhs</SelectItem>
                      <SelectItem value="Above 50 Lakhs">Above ₹50 Lakhs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="netWorth">Net Worth *</Label>
                  <Select value={formData.netWorth} onValueChange={(value) => updateFormData("netWorth", value)}>
                    <SelectTrigger data-testid="select-netWorth">
                      <SelectValue placeholder="Select net worth" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Below 5 Lakhs">Below ₹5 Lakhs</SelectItem>
                      <SelectItem value="5-10 Lakhs">₹5-10 Lakhs</SelectItem>
                      <SelectItem value="10-25 Lakhs">₹10-25 Lakhs</SelectItem>
                      <SelectItem value="25-50 Lakhs">₹25-50 Lakhs</SelectItem>
                      <SelectItem value="50 Lakhs - 1 Crore">₹50 Lakhs - 1 Crore</SelectItem>
                      <SelectItem value="Above 1 Crore">Above ₹1 Crore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceOfWealth">Source of Wealth *</Label>
                <Select value={formData.sourceOfWealth} onValueChange={(value) => updateFormData("sourceOfWealth", value)}>
                  <SelectTrigger data-testid="select-sourceOfWealth">
                    <SelectValue placeholder="Select source of wealth" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Investments">Investments</SelectItem>
                    <SelectItem value="Inheritance">Inheritance</SelectItem>
                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="investmentExperience">Investment Experience *</Label>
                  <Select value={formData.investmentExperience} onValueChange={(value) => updateFormData("investmentExperience", value)}>
                    <SelectTrigger data-testid="select-investmentExperience">
                      <SelectValue placeholder="Select experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="No Experience">No Experience</SelectItem>
                      <SelectItem value="1-3 years">1-3 years</SelectItem>
                      <SelectItem value="3-5 years">3-5 years</SelectItem>
                      <SelectItem value="5-10 years">5-10 years</SelectItem>
                      <SelectItem value="Above 10 years">Above 10 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="riskTolerance">Risk Tolerance *</Label>
                  <Select value={formData.riskTolerance} onValueChange={(value) => updateFormData("riskTolerance", value)}>
                    <SelectTrigger data-testid="select-riskTolerance">
                      <SelectValue placeholder="Select risk tolerance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Conservative">Conservative</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investmentObjective">Investment Objective *</Label>
                <Select value={formData.investmentObjective} onValueChange={(value) => updateFormData("investmentObjective", value)}>
                  <SelectTrigger data-testid="select-investmentObjective">
                    <SelectValue placeholder="Select investment objective" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Capital Preservation">Capital Preservation</SelectItem>
                    <SelectItem value="Income Generation">Income Generation</SelectItem>
                    <SelectItem value="Capital Growth">Capital Growth</SelectItem>
                    <SelectItem value="Tax Saving">Tax Saving</SelectItem>
                    <SelectItem value="Retirement Planning">Retirement Planning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Income Proof Upload */}
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>Income Proof Document</span>
                  {formData.documents.incomeProof && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </Label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880} // 5MB
                  acceptedTypes={["image/", "application/pdf"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={(result) => handleDocumentComplete(result, "incomeProof")}
                  buttonClassName="w-full max-w-md"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{formData.documents.incomeProof ? "Replace Income Proof" : "Upload Income Proof"}</span>
                  </div>
                </ObjectUploader>
                <p className="text-sm text-muted-foreground">
                  Salary slips, ITR, or other income verification documents
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance */}
        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance & Declarations
              </CardTitle>
              <CardDescription>
                Required regulatory compliance declarations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="pepDeclaration"
                    checked={formData.pepDeclaration}
                    onCheckedChange={(checked) => updateFormData("pepDeclaration", checked)}
                    data-testid="checkbox-pepDeclaration"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="pepDeclaration" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      PEP Declaration *
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I declare that I am not a Politically Exposed Person (PEP) or an immediate family member or close associate of a PEP.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="fatcaDeclaration"
                    checked={formData.fatcaDeclaration}
                    onCheckedChange={(checked) => updateFormData("fatcaDeclaration", checked)}
                    data-testid="checkbox-fatcaDeclaration"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="fatcaDeclaration" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      FATCA Declaration *
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I declare my tax residency status and confirm compliance with FATCA requirements.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="crsDeclaration"
                    checked={formData.crsDeclaration}
                    onCheckedChange={(checked) => updateFormData("crsDeclaration", checked)}
                    data-testid="checkbox-crsDeclaration"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="crsDeclaration" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      CRS Declaration
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I confirm my tax residency status for Common Reporting Standard (CRS) compliance.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Terms & Consents</h3>
                
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={formData.terms}
                    onCheckedChange={(checked) => updateFormData("terms", checked)}
                    data-testid="checkbox-terms"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Terms & Conditions *
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I accept the terms and conditions of service.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="privacy"
                    checked={formData.privacy}
                    onCheckedChange={(checked) => updateFormData("privacy", checked)}
                    data-testid="checkbox-privacy"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="privacy" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Privacy Policy *
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I acknowledge and consent to the privacy policy.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="marketing"
                    checked={formData.marketing}
                    onCheckedChange={(checked) => updateFormData("marketing", checked)}
                    data-testid="checkbox-marketing"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="marketing" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Marketing Communications
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I consent to receive marketing communications and promotional offers.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banking & Demat */}
        <TabsContent value="banking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Banking & Demat Information
              </CardTitle>
              <CardDescription>
                Link your bank account and demat account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Bank Account Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => updateFormData("bankName", e.target.value)}
                      placeholder="Enter bank name"
                      data-testid="input-bankName"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountType">Account Type *</Label>
                    <Select value={formData.accountType} onValueChange={(value) => updateFormData("accountType", value)}>
                      <SelectTrigger data-testid="select-accountType">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Savings">Savings</SelectItem>
                        <SelectItem value="Current">Current</SelectItem>
                        <SelectItem value="NRO">NRO</SelectItem>
                        <SelectItem value="NRE">NRE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber}
                      onChange={(e) => updateFormData("accountNumber", e.target.value)}
                      placeholder="Enter account number"
                      data-testid="input-accountNumber"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifscCode">IFSC Code *</Label>
                    <Input
                      id="ifscCode"
                      value={formData.ifscCode}
                      onChange={(e) => updateFormData("ifscCode", e.target.value.toUpperCase())}
                      placeholder="Enter IFSC code"
                      data-testid="input-ifscCode"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Demat Account (Optional)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dematProvider">Demat Provider</Label>
                    <Select value={formData.dematProvider || ""} onValueChange={(value) => updateFormData("dematProvider", value)}>
                      <SelectTrigger data-testid="select-dematProvider">
                        <SelectValue placeholder="Select demat provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CDSL">CDSL</SelectItem>
                        <SelectItem value="NSDL">NSDL</SelectItem>
                        <SelectItem value="Zerodha">Zerodha</SelectItem>
                        <SelectItem value="Upstox">Upstox</SelectItem>
                        <SelectItem value="Angel Broking">Angel Broking</SelectItem>
                        <SelectItem value="HDFC Securities">HDFC Securities</SelectItem>
                        <SelectItem value="ICICI Direct">ICICI Direct</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dematAccountNumber">Demat Account Number</Label>
                    <Input
                      id="dematAccountNumber"
                      value={formData.dematAccountNumber || ""}
                      onChange={(e) => updateFormData("dematAccountNumber", e.target.value)}
                      placeholder="Enter demat account number"
                      data-testid="input-dematAccountNumber"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Statement Upload */}
              <Separator />
              <div className="space-y-3">
                <Label className="flex items-center justify-between">
                  <span>Bank Statement (Last 3 months)</span>
                  {formData.documents.bankStatement && (
                    <Badge variant="secondary" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Uploaded
                    </Badge>
                  )}
                </Label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760} // 10MB
                  acceptedTypes={["application/pdf"]}
                  onGetUploadParameters={getUploadParameters}
                  onComplete={(result) => handleDocumentComplete(result, "bankStatement")}
                  buttonClassName="w-full max-w-md"
                >
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span>{formData.documents.bankStatement ? "Replace Bank Statement" : "Upload Bank Statement"}</span>
                  </div>
                </ObjectUploader>
                <p className="text-sm text-muted-foreground">
                  Bank statement for the last 3 months (PDF format only)
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Section */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {progress < 80 ? (
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Complete at least 80% of your profile to submit
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Profile ready for submission
                </span>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={progress < 80 || !formData.terms || !formData.privacy || saveOnboardingMutation.isPending}
              size="lg"
              data-testid="button-submit-onboarding"
            >
              {saveOnboardingMutation.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}