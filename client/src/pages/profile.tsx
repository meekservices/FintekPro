import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, AlertTriangle, CheckCircle, FileText, Building2, Globe, Star, Award, Lock, Heart, MapPin, Phone, Mail, CreditCard, Banknote, Users, Calendar, RefreshCw } from "lucide-react";
import { BankingTab } from "@/components/BankingDematTab";
import { DematTab } from "@/components/DematTab";
import { KYCStatusCard } from "@/components/KYCStatusCard";
import { KYCVerificationDashboard } from "@/components/KYCVerificationDashboard";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { CurrencySelector } from "@/components/CurrencySelector";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanOffersCard } from "@/components/LoanOffersCard";

// Exchange Rates Table Component
function ExchangeRatesTable({ baseCurrency }: { baseCurrency: string }) {
  const { data: ratesData, isLoading } = useQuery({
    queryKey: ["/api/currencies/rates", baseCurrency],
    queryFn: async () => {
      const response = await fetch(`/api/currencies/rates?base=${baseCurrency}`);
      if (!response.ok) throw new Error("Failed to fetch exchange rates");
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading exchange rates...</div>;
  }

  if (!ratesData || !ratesData.rates) {
    return <div className="text-sm text-gray-500">No exchange rates available</div>;
  }

  const rates = Object.entries(ratesData.rates) as [string, number][];

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500">
        Last updated: {new Date(ratesData.lastUpdated).toLocaleString()}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Currency</TableHead>
            <TableHead className="text-right">Exchange Rate</TableHead>
            <TableHead className="text-right">Sample Conversion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rates.map(([currency, rate]) => (
            <TableRow key={currency}>
              <TableCell className="font-medium">{currency}</TableCell>
              <TableCell className="text-right">
                <CurrencyDisplay amount={rate} currency={baseCurrency} showSymbol={false} />
              </TableCell>
              <TableCell className="text-right text-sm text-gray-600">
                1 {baseCurrency} = {rate.toFixed(4)} {currency}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Enhanced profile form schema for comprehensive KYC compliance
const profileFormSchema = z.object({
  // Client Type Selection - First Decision Point
  clientType: z.enum(["individual", "non_individual"], {
    required_error: "Please select client type",
  }),
  
  // Individual Information (conditional)
  firstName: z.string().optional(),
  middleName: z.string().optional(), 
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseName: z.string().optional(),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed", "separated"]).optional(),
  
  // Non-Individual Entity Information (conditional)
  entityType: z.enum(["company", "partnership", "trust", "society", "huf", "llp", "cooperative", "foundation", "association"]).optional(),
  companyName: z.string().optional(),
  entityRegistrationNumber: z.string().optional(),
  incorporationDate: z.string().optional(),
  businessNature: z.string().optional(),
  companyPanNumber: z.string().optional(),
  
  // Common Contact Information
  email: z.string().email("Invalid email address"),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  alternateContactNumber: z.string().optional(),
  
  // Identity Documents - Universal KYC Requirements
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format"),
  aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits").optional(),
  passportNumber: z.string().optional(),
  passportCountry: z.string().optional(),
  passportExpiryDate: z.string().optional(),
  drivingLicense: z.string().optional(),
  voterIdNumber: z.string().optional(),
  
  // Comprehensive Residency Status Classification
  residentStatus: z.enum([
    "resident_indian",
    "nri_ordinary", 
    "nri_non_ordinary",
    "oci",
    "pio",
    "foreign_national"
  ], {
    required_error: "Please select residency status",
  }),
  
  // Country Classifications
  countryOfResidence: z.string().min(1, "Country of residence is required"),
  countryOfCitizenship: z.string().min(1, "Country of citizenship is required"),
  countryOfBirth: z.string().optional(),
  taxResidencyCountry: z.string().optional(),
  
  // NRI and Foreign National Specific Information
  nriSubType: z.enum(["usa", "canada", "australia", "uk", "singapore", "uae", "germany", "france", "japan", "other"]).optional(),
  visaType: z.string().optional(),
  permanentResidenceStatus: z.enum(["green_card", "pr_card", "citizenship", "work_permit", "other", "none"]).optional(),
  nriRepatriationType: z.enum(["repatriable", "non_repatriable"]).optional(),
  overseasTaxId: z.string().optional(),
  
  // Address Information - Enhanced for Global Compliance
  presentAddress: z.string().min(1, "Present address is required"),
  presentCity: z.string().min(1, "City is required"),
  presentState: z.string().min(1, "State/Province is required"), 
  presentPincode: z.string().min(1, "PIN/ZIP code is required"),
  presentCountry: z.string().min(1, "Country is required"),
  
  // Permanent Address
  permanentAddress: z.string().optional(),
  permanentCity: z.string().optional(),
  permanentState: z.string().optional(),
  permanentPincode: z.string().optional(),
  permanentCountry: z.string().optional(),
  isAddressSame: z.boolean().default(false),
  
  // Financial Profile - Enhanced for AML Compliance
  occupation: z.string().min(1, "Occupation is required"),
  employer: z.string().optional(),
  designation: z.string().optional(),
  workExperience: z.string().optional(),
  annualIncome: z.enum([
    "below_1_lakh",
    "1_to_5_lakh", 
    "5_to_10_lakh",
    "10_to_25_lakh",
    "25_to_50_lakh",
    "50_lakh_to_1_crore",
    "above_1_crore"
  ], {
    required_error: "Please select annual income range",
  }),
  sourceOfWealth: z.string().min(1, "Source of wealth is required"),
  netWorth: z.string().optional(),
  
  // Investment Profile
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"], {
    required_error: "Please select risk tolerance",
  }),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"], {
    required_error: "Please select investment experience",
  }),
  investmentObjective: z.enum(["capital_appreciation", "income", "balanced", "speculation"], {
    required_error: "Please select investment objective",
  }),
  investmentHorizon: z.enum(["short", "medium", "long"], {
    required_error: "Please select investment horizon",
  }),
  
  // Banking and Account Details
  bankAccountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  bankName: z.string().optional(),
  branchAddress: z.string().optional(),
  accountType: z.enum(["savings", "current", "nro", "nre", "fcnr"]).optional(),
  
  // Demat Account Information - CVL/KRA Integration
  nsdlDpId: z.string().optional(),
  nsdlClientId: z.string().optional(),
  cdslBoId: z.string().optional(),
  cdslDpId: z.string().optional(),
  krvNumber: z.string().optional(), // KRA Registration Number
  cvlKycNumber: z.string().optional(), // CVL KYC Number
  
  // Regulatory Compliance - FATCA & CRS
  fatcaStatus: z.enum(["us_person", "non_us_person", "specified_us_person"], {
    required_error: "FATCA status is required",
  }),
  fatcaTinNumber: z.string().optional(),
  fatcaCountryOfTaxResidence: z.string().optional(),
  
  // CRS (Common Reporting Standard)
  crsStatus: z.enum(["applicable", "not_applicable"]).optional(),
  crsTaxResidentCountries: z.array(z.string()).optional(),
  crsTinNumbers: z.array(z.string()).optional(),
  
  // PEP (Politically Exposed Person) Declaration
  pepStatus: z.enum(["yes", "no"], {
    required_error: "PEP status declaration is required",
  }),
  pepDetails: z.string().optional(),
  pepRelatedPersonStatus: z.enum(["yes", "no"]).optional(),
  pepRelationshipDetails: z.string().optional(),
  
  // UBO (Ultimate Beneficial Owner) - For Non-Individuals
  isUbo: z.boolean().default(false),
  uboDetails: z.string().optional(),
  beneficialOwnershipPercentage: z.string().optional(),
  
  // Nominee Information
  nomineeDetails: z.string().optional(),
  nomineeRelation: z.string().optional(),
  nomineeContactNumber: z.string().optional(),
  guardianDetails: z.string().optional(), // For minors
  
  // Professional Qualifications
  educationalQualifications: z.string().optional(),
  professionalCertifications: z.string().optional(),
  
  // Consent and Declarations
  panVerificationConsent: z.boolean().default(false),
  amlScreeningConsent: z.boolean().default(false),
  fatcaDeclarationConsent: z.boolean().default(false),
  termsAndConditionsConsent: z.boolean().default(false),
  dataProcessingConsent: z.boolean().default(false),
  regulatoryReportingConsent: z.boolean().default(false),
}).refine((data) => {
  // Individual specific validations
  if (data.clientType === "individual") {
    return data.firstName && data.lastName && data.dateOfBirth && 
           data.fatherName && data.motherName && data.gender;
  }
  // Non-individual specific validations
  if (data.clientType === "non_individual") {
    return data.companyName && data.entityType && data.entityRegistrationNumber &&
           data.businessNature && data.companyPanNumber;
  }
  return true;
}, {
  message: "Required fields based on client type are missing",
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

// Country list for dropdowns
const countries = [
  "India", "United States", "Canada", "Australia", "United Kingdom", "Singapore", 
  "United Arab Emirates", "Germany", "France", "Japan", "Switzerland", "Netherlands",
  "Sweden", "Norway", "Denmark", "New Zealand", "South Africa", "Hong Kong", "Other"
];

// Enhanced states/provinces for global coverage
const statesProvinces = {
  "India": [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"
  ],
  "United States": [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"
  ],
  "Canada": [
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
    "Quebec", "Saskatchewan", "Yukon"
  ],
  // Add more as needed
  "Other": ["Other"]
};

export default function ProfilePage() {
  // Read URL parameter for initial tab (support ?tab=kyc redirection from KYC status card)
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    // Map "kyc" to "identity" since that's the actual tab name
    if (tabParam === 'kyc') return 'identity';
    if (tabParam && ['kyc-dashboard', 'basic', 'enhanced', 'accredited', 'identity', 'address', 'financial', 'compliance', 'banking', 'demat'].includes(tabParam)) {
      return tabParam;
    }
    return 'kyc-dashboard'; // Default to dashboard for progressive workflow
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [isAmlScreening, setIsAmlScreening] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch existing profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
    retry: false,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      clientType: "individual",
      residentStatus: "resident_indian",
      countryOfResidence: "India",
      countryOfCitizenship: "India",
      presentCountry: "India",
      fatcaStatus: "non_us_person",
      pepStatus: "no",
      riskTolerance: "moderate",
      investmentExperience: "beginner",
      investmentObjective: "balanced",
      investmentHorizon: "medium",
      isAddressSame: false,
      panVerificationConsent: false,
      amlScreeningConsent: false,
      fatcaDeclarationConsent: false,
      termsAndConditionsConsent: false,
      dataProcessingConsent: false,
      regulatoryReportingConsent: false,
    }
  });

  const clientType = form.watch("clientType");
  const residentStatus = form.watch("residentStatus");
  const presentCountry = form.watch("presentCountry");
  const isAddressSame = form.watch("isAddressSame");

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: (data: ProfileFormData) => apiRequest("PUT", "/api/profile", { body: data }),
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      calculateCompleteness();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // AML Screening mutation
  const amlScreeningMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/aml/screen", { body: data }),
    onSuccess: () => {
      toast({
        title: "AML Screening Complete",
        description: "Customer screening completed successfully.",
      });
      setIsAmlScreening(false);
    },
    onError: () => {
      toast({
        title: "AML Screening Failed",
        description: "AML screening could not be completed.",
        variant: "destructive",
      });
      setIsAmlScreening(false);
    },
  });

  // Calculate profile completeness
  const calculateCompleteness = useCallback(() => {
    const values = form.getValues();
    const requiredFields = [
      'clientType', 'email', 'mobile', 'panNumber', 'residentStatus',
      'countryOfResidence', 'countryOfCitizenship', 'presentAddress',
      'presentCity', 'presentState', 'presentPincode', 'presentCountry',
      'occupation', 'annualIncome', 'sourceOfWealth', 'riskTolerance',
      'investmentExperience', 'investmentObjective', 'investmentHorizon',
      'fatcaStatus', 'pepStatus'
    ];
    
    // Add conditional required fields
    if (values.clientType === 'individual') {
      requiredFields.push('firstName', 'lastName', 'dateOfBirth', 'fatherName', 'motherName', 'gender');
    }
    
    if (values.clientType === 'non_individual') {
      requiredFields.push('companyName', 'entityType', 'entityRegistrationNumber', 'businessNature', 'companyPanNumber');
    }

    const filledFields = requiredFields.filter(field => {
      const value = (values as any)[field];
      return value && value !== "" && value !== false;
    });

    const percentage = Math.round((filledFields.length / requiredFields.length) * 100);
    setProfileCompleteness(percentage);
  }, [form]);

  // Handle form submission
  const onSubmit = async (data: ProfileFormData) => {
    try {
      await profileMutation.mutateAsync(data);
      
      // Trigger AML screening if consent given
      if (data.amlScreeningConsent) {
        setIsAmlScreening(true);
        const screeningData = {
          firstName: data.firstName || data.companyName?.split(' ')[0] || '',
          lastName: data.lastName || data.companyName?.split(' ').slice(1).join(' ') || '',
          dateOfBirth: data.dateOfBirth || data.incorporationDate || '',
          nationality: data.countryOfCitizenship,
          countryOfResidence: data.countryOfResidence,
          passportNumber: data.passportNumber || ''
        };
        
        await amlScreeningMutation.mutateAsync(screeningData);
      }
    } catch (error) {
      console.error("Profile update error:", error);
    }
  };

  // Auto-calculate completeness on form changes
  useEffect(() => {
    calculateCompleteness();
  }, [form.watch, calculateCompleteness]);

  // Load profile data when available
  useEffect(() => {
    if (profile && !profileLoading) {
      Object.keys(profile).forEach(key => {
        const value = (profile as any)[key];
        if (value !== null && value !== undefined) {
          form.setValue(key as any, value);
        }
      });
      calculateCompleteness();
    }
  }, [profile, profileLoading, form, calculateCompleteness]);

  if (profileLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <User className="h-8 w-8" />
            Client Profile & KYC Onboarding
          </h1>
          {user?.id && (
            <p className="text-sm text-gray-500 mt-1" data-testid="profile-user-id">
              User ID: {user.id}
            </p>
          )}
          <p className="text-gray-600 mt-2">
            Complete your profile for regulatory compliance and enhanced services
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Profile Completeness</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={profileCompleteness} className="w-32" />
              <span className="text-sm font-medium">{profileCompleteness}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* KYC Status Card - Prominently displayed */}
      <KYCStatusCard />

      {/* Pre-Approved Loan Offers */}
      <LoanOffersCard />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <ScrollableTabsList>
              <TabsTrigger value="kyc-dashboard" data-testid="tab-kyc-dashboard" className="flex-shrink-0">
                <Award className="h-4 w-4 mr-2" />
                KYC Dashboard
              </TabsTrigger>
              <TabsTrigger value="basic" data-testid="tab-basic" className="flex-shrink-0">
                <User className="h-4 w-4 mr-2" />
                Basic KYC (Tier 1)
              </TabsTrigger>
              <TabsTrigger value="kyc-verification" data-testid="tab-kyc-verification" className="flex-shrink-0">
                <Shield className="h-4 w-4 mr-2" />
                KYC & Verification
              </TabsTrigger>
              <TabsTrigger value="identity" data-testid="tab-identity" className="flex-shrink-0">
                <FileText className="h-4 w-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="address" data-testid="tab-address" className="flex-shrink-0">
                <MapPin className="h-4 w-4 mr-2" />
                Address
              </TabsTrigger>
              <TabsTrigger value="financial" data-testid="tab-financial" className="flex-shrink-0">
                <Banknote className="h-4 w-4 mr-2" />
                Financial Info
              </TabsTrigger>
              <TabsTrigger value="compliance" data-testid="tab-compliance" className="flex-shrink-0">
                <Shield className="h-4 w-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="banking" data-testid="tab-banking" className="flex-shrink-0">
                <CreditCard className="h-4 w-4 mr-2" />
                Banking
              </TabsTrigger>
              <TabsTrigger value="demat" data-testid="tab-demat" className="flex-shrink-0">
                <Building2 className="h-4 w-4 mr-2" />
                Demat
              </TabsTrigger>
              <TabsTrigger value="preferences" data-testid="tab-preferences" className="flex-shrink-0">
                <Globe className="h-4 w-4 mr-2" />
                Preferences
              </TabsTrigger>
            </ScrollableTabsList>

            {/* KYC Dashboard Tab */}
            <TabsContent value="kyc-dashboard" className="space-y-6">
              <KYCVerificationDashboard />
            </TabsContent>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Client Type Selection</CardTitle>
                  <CardDescription>
                    Select whether you are registering as an individual or representing a business entity
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="clientType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Type *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="grid grid-cols-2 gap-4"
                          >
                            <div className="flex items-center space-x-2 border rounded-lg p-4">
                              <RadioGroupItem value="individual" id="individual" />
                              <Label htmlFor="individual" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Individual</div>
                                  <div className="text-sm text-gray-500">Personal account</div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 border rounded-lg p-4">
                              <RadioGroupItem value="non_individual" id="non_individual" />
                              <Label htmlFor="non_individual" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Non-Individual</div>
                                  <div className="text-sm text-gray-500">Business/Entity account</div>
                                </div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Individual Information */}
                  {clientType === "individual" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter first name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="middleName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Middle Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter middle name" />
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
                              <Input {...field} placeholder="Enter last name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Non-Individual Information */}
                  {clientType === "non_individual" && (
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="entityType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Entity Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select entity type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="company">Company</SelectItem>
                                <SelectItem value="partnership">Partnership</SelectItem>
                                <SelectItem value="trust">Trust</SelectItem>
                                <SelectItem value="society">Society</SelectItem>
                                <SelectItem value="huf">Hindu Undivided Family (HUF)</SelectItem>
                                <SelectItem value="llp">Limited Liability Partnership</SelectItem>
                                <SelectItem value="cooperative">Cooperative Society</SelectItem>
                                <SelectItem value="foundation">Foundation</SelectItem>
                                <SelectItem value="association">Association</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company/Entity Name *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter entity name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="entityRegistrationNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Registration Number *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter registration number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Common Contact Information */}
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="Enter email address" />
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
                            <Input {...field} placeholder="Enter mobile number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* KYC & Verification Dashboard Tab */}
            <TabsContent value="kyc-verification" className="space-y-6">
              <KYCVerificationDashboard />
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="identity" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Identity Documents & Residency Status</CardTitle>
                  <CardDescription>
                    Provide identity documents and residency information for KYC compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Residency Status */}
                  <FormField
                    control={form.control}
                    name="residentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residency Status *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select residency status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="resident_indian">Resident Indian</SelectItem>
                            <SelectItem value="nri_ordinary">NRI - Ordinary Resident</SelectItem>
                            <SelectItem value="nri_non_ordinary">NRI - Non-Ordinary Resident</SelectItem>
                            <SelectItem value="oci">Overseas Citizen of India (OCI)</SelectItem>
                            <SelectItem value="pio">Person of Indian Origin (PIO)</SelectItem>
                            <SelectItem value="foreign_national">Foreign National</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Country Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="countryOfResidence"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country of Residence *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="countryOfCitizenship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country of Citizenship *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="taxResidencyCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Residency Country</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Identity Documents */}
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="panNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="ABCDE1234F" className="uppercase" />
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
                            <Input {...field} placeholder="123456789012" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Additional identity documents for NRI/Foreign Nationals */}
                  {(residentStatus !== "resident_indian") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="passportNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter passport number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="passportCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Passport Issuing Country</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {countries.map((country) => (
                                  <SelectItem key={country} value={country}>
                                    {country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Address Information</CardTitle>
                  <CardDescription>
                    Provide your current and permanent address details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Present Address */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Present Address</h3>
                    <FormField
                      control={form.control}
                      name="presentAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address Line 1 *</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Enter complete address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="presentCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="presentState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State/Province *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(statesProvinces[presentCountry as keyof typeof statesProvinces] || []).map((state) => (
                                  <SelectItem key={state} value={state}>
                                    {state}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="presentPincode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PIN/ZIP Code *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="PIN/ZIP" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="presentCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {countries.map((country) => (
                                  <SelectItem key={country} value={country}>
                                    {country}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Same as Present Address Checkbox */}
                  <FormField
                    control={form.control}
                    name="isAddressSame"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Permanent address is same as present address
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Permanent Address - only show if not same as present */}
                  {!isAddressSame && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Permanent Address</h3>
                      <FormField
                        control={form.control}
                        name="permanentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Enter permanent address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <FormField
                          control={form.control}
                          name="permanentCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="permanentState"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State/Province</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="permanentPincode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PIN/ZIP Code</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="PIN/ZIP" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="permanentCountry"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Enter country" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Financial Info Tab */}
            <TabsContent value="financial" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Info</CardTitle>
                  <CardDescription>
                    Provide financial information for risk assessment and compliance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Enter occupation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="annualIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Income *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select income range" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="below_1_lakh">Below ₹1 Lakh</SelectItem>
                              <SelectItem value="1_to_5_lakh">₹1 - 5 Lakh</SelectItem>
                              <SelectItem value="5_to_10_lakh">₹5 - 10 Lakh</SelectItem>
                              <SelectItem value="10_to_25_lakh">₹10 - 25 Lakh</SelectItem>
                              <SelectItem value="25_to_50_lakh">₹25 - 50 Lakh</SelectItem>
                              <SelectItem value="50_lakh_to_1_crore">₹50 Lakh - 1 Crore</SelectItem>
                              <SelectItem value="above_1_crore">Above ₹1 Crore</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="sourceOfWealth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source of Wealth *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Describe your source of wealth" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />
                  
                  {/* Investment Profile */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Investment Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="riskTolerance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Risk Tolerance *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select risk tolerance" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="conservative">Conservative</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="aggressive">Aggressive</SelectItem>
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
                            <FormLabel>Investment Experience *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select experience level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="experienced">Experienced</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Regulatory Compliance</CardTitle>
                  <CardDescription>
                    Complete regulatory declarations for FATCA, PEP status, and other compliance requirements
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* FATCA Declaration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">FATCA Declaration</h3>
                    <FormField
                      control={form.control}
                      name="fatcaStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Are you a US Person for tax purposes? *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select FATCA status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="us_person">Yes, I am a US Person</SelectItem>
                              <SelectItem value="non_us_person">No, I am not a US Person</SelectItem>
                              <SelectItem value="specified_us_person">Specified US Person</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* PEP Declaration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">PEP Declaration</h3>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Politically Exposed Person (PEP)</AlertTitle>
                      <AlertDescription>
                        A PEP is someone who holds a prominent public position or has family/close associates who do.
                      </AlertDescription>
                    </Alert>
                    
                    <FormField
                      control={form.control}
                      name="pepStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Are you a Politically Exposed Person (PEP)? *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select PEP status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />

                  {/* Consent Declarations */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Consent & Declarations</h3>
                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="amlScreeningConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm">
                              I consent to AML screening and monitoring of my account for compliance purposes
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="panVerificationConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm">
                              I authorize verification of my PAN details with income tax authorities
                            </FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dataProcessingConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-sm">
                              I consent to processing of my personal data for KYC and compliance purposes
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Banking Tab */}
            <TabsContent value="banking" className="space-y-6">
              <BankingTab />
            </TabsContent>

            {/* Demat Tab */}
            <TabsContent value="demat" className="space-y-6">
              <DematTab />
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Currency Preferences</CardTitle>
                  <CardDescription>
                    Set your preferred base currency for displaying portfolio values and market data
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="base-currency">Base Currency</Label>
                      <p className="text-sm text-gray-500 mb-2">
                        All portfolio values and market data will be displayed in this currency
                      </p>
                      <CurrencySelector 
                        value={form.watch("baseCurrency") || "INR"}
                        onChange={(value) => form.setValue("baseCurrency", value)}
                        className="w-48"
                      />
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Current Exchange Rates</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await apiRequest("POST", "/api/currencies/refresh", { 
                                baseCurrency: form.watch("baseCurrency") || "INR"
                              });
                              toast({ 
                                title: "Success", 
                                description: "Exchange rates refreshed successfully" 
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/currencies/rates"] });
                            } catch (error) {
                              toast({ 
                                title: "Error", 
                                description: "Failed to refresh exchange rates",
                                variant: "destructive" 
                              });
                            }
                          }}
                          data-testid="button-refresh-rates"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh Rates
                        </Button>
                      </div>

                      <ExchangeRatesTable baseCurrency={form.watch("baseCurrency") || "INR"} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-2">
              {isAmlScreening && (
                <>
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Running AML screening...</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ["basic", "identity", "address", "financial", "compliance", "banking", "demat"];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1]);
                  }
                }}
                disabled={activeTab === "basic"}
              >
                Previous
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ["basic", "identity", "address", "financial", "compliance", "banking", "demat"];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1]);
                  }
                }}
                disabled={activeTab === "demat"}
              >
                Next
              </Button>
              
              <Button
                type="submit"
                disabled={profileMutation.isPending || isAmlScreening}
                data-testid="button-save-profile"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {profileMutation.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}