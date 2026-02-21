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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, AlertTriangle, CheckCircle, FileText, Building2, Globe, Star, Award, Lock, Heart, MapPin, Phone, Mail, CreditCard, Banknote, Users, Calendar, RefreshCw, ShieldCheck, Crown, CheckCircle2, XCircle, Edit, ArrowRight, Unlock, TrendingUp, Clock, AlertCircle, Sparkles, Home, BarChart3, Briefcase, IndianRupee, LineChart, Receipt, ExternalLink, ChevronRight, Package, ShoppingCart } from "lucide-react";
import { useLocation } from 'wouter';
import { BankingTab } from "@/components/BankingDematTab";
import { DematTab } from "@/components/DematTab";
import { KYCVerificationDashboard } from "@/components/KYCVerificationDashboard";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { CurrencySelector } from "@/components/CurrencySelector";
import { CurrencyDisplay } from "@/components/CurrencyDisplay";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanOffersCard } from "@/components/LoanOffersCard";
import { ProductAccountPreferences } from "@/components/ProductAccountPreferences";

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
    return <div className="text-sm text-muted-foreground">Loading exchange rates...</div>;
  }

  if (!ratesData || !ratesData.rates) {
    return <div className="text-sm text-muted-foreground">No exchange rates available</div>;
  }

  const rates = Object.entries(ratesData.rates) as [string, number][];

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
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
              <TableCell className="text-right text-sm text-muted-foreground">
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
    if (tabParam && ['overview', 'kyc-dashboard', 'basic', 'enhanced', 'accredited', 'identity', 'address', 'financial', 'compliance', 'banking', 'demat'].includes(tabParam)) {
      return tabParam;
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [isAmlScreening, setIsAmlScreening] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch existing profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
    retry: false,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      // Client Type
      clientType: "individual",
      
      // Individual Information
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: undefined,
      fatherName: "",
      motherName: "",
      spouseName: "",
      maritalStatus: undefined,
      
      // Non-Individual Entity Information
      entityType: undefined,
      companyName: "",
      entityRegistrationNumber: "",
      incorporationDate: "",
      businessNature: "",
      companyPanNumber: "",
      
      // Common Contact Information
      email: "",
      mobile: "",
      alternateContactNumber: "",
      
      // Identity Documents
      panNumber: "",
      aadharNumber: "",
      passportNumber: "",
      passportCountry: "",
      passportExpiryDate: "",
      drivingLicense: "",
      voterIdNumber: "",
      
      // Residency Status
      residentStatus: "resident_indian",
      countryOfResidence: "India",
      countryOfCitizenship: "India",
      countryOfBirth: "",
      taxResidencyCountry: "",
      
      // NRI and Foreign National Specific Information
      nriSubType: undefined,
      visaType: "",
      permanentResidenceStatus: undefined,
      nriRepatriationType: undefined,
      overseasTaxId: "",
      
      // Address Information
      presentAddress: "",
      presentCity: "",
      presentState: "",
      presentPincode: "",
      presentCountry: "India",
      permanentAddress: "",
      permanentCity: "",
      permanentState: "",
      permanentPincode: "",
      permanentCountry: "",
      isAddressSame: false,
      
      // Financial Profile
      occupation: "",
      employer: "",
      designation: "",
      workExperience: "",
      annualIncome: undefined,
      sourceOfWealth: "",
      netWorth: "",
      
      // Investment Profile
      riskTolerance: "moderate",
      investmentExperience: "beginner",
      investmentObjective: "balanced",
      investmentHorizon: "medium",
      
      // Banking and Account Details
      bankAccountNumber: "",
      ifscCode: "",
      bankName: "",
      branchAddress: "",
      accountType: undefined,
      
      // Demat Account Information
      nsdlDpId: "",
      nsdlClientId: "",
      cdslBoId: "",
      cdslDpId: "",
      krvNumber: "",
      cvlKycNumber: "",
      
      // Regulatory Compliance - FATCA & CRS
      fatcaStatus: "non_us_person",
      fatcaTinNumber: "",
      fatcaCountryOfTaxResidence: "",
      crsStatus: undefined,
      crsTaxResidentCountries: [],
      crsTinNumbers: [],
      
      // PEP Declaration
      pepStatus: "no",
      pepDetails: "",
      pepRelatedPersonStatus: undefined,
      pepRelationshipDetails: "",
      
      // UBO - For Non-Individuals
      isUbo: false,
      uboDetails: "",
      beneficialOwnershipPercentage: "",
      
      // Nominee Information
      nomineeDetails: "",
      nomineeRelation: "",
      nomineeContactNumber: "",
      guardianDetails: "",
      
      // Professional Qualifications
      educationalQualifications: "",
      professionalCertifications: "",
      
      // Consent and Declarations
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
    mutationFn: (data: ProfileFormData) => apiRequest("/api/profile", { method: "PUT", body: JSON.stringify(data) }),
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
    mutationFn: (data: any) => apiRequest("/api/aml/screen", { method: "POST", body: JSON.stringify(data) }),
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

  // KYC Dashboard State and Queries
  // Fetch user's KYC profile
  const { data: kycProfile, isLoading: kycProfileLoading } = useQuery({
    queryKey: ['/api/kyc/my-profile'],
    enabled: !!user
  });

  // Extract verification status from KYC profile
  const kycData = (kycProfile as any)?.data;
  const isPanVerified = kycData?.panVerified || false;
  const isEmailVerified = kycData?.email ? true : false; // Email is verified if present in KYC profile
  const isMobileVerified = kycData?.mobile ? true : false; // Mobile is verified if present in KYC profile

  // Fetch product eligibility
  const { data: eligibilityData, isLoading: eligibilityLoading } = useQuery({
    queryKey: ['/api/kyc/product-eligibility'],
    enabled: !!user
  });

  const { data: orderStats, isLoading: orderStatsLoading } = useQuery({
    queryKey: ['/api/orders/stats'],
    enabled: !!user,
  });

  const { data: recentOrders, isLoading: recentOrdersLoading } = useQuery({
    queryKey: ['/api/orders', { limit: 5 }],
    queryFn: async () => {
      const response = await fetch('/api/orders?limit=5', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!user,
  });

  // KYC Helper Functions
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic':
        return <Shield className="h-5 w-5" />;
      case 'enhanced':
        return <ShieldCheck className="h-5 w-5" />;
      case 'accredited_investor':
        return <Crown className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'bg-blue-500';
      case 'enhanced':
        return 'bg-green-500';
      case 'accredited_investor':
        return 'bg-purple-500';
      default:
        return 'bg-muted';
    }
  };

  const getTierBadgeVariant = (tier: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (tier) {
      case 'basic':
        return 'default';
      case 'enhanced':
        return 'secondary';
      case 'accredited_investor':
        return 'outline';
      default:
        return 'default';
    }
  };

  const formatTierName = (tier: string) => {
    return tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

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

  // Pre-fill form with KYC profile data when available
  useEffect(() => {
    if (kycProfile && !kycProfileLoading) {
      const kycData = (kycProfile as any)?.data;
      if (kycData) {
        // Pre-fill email if available
        if (kycData.email && !form.getValues('email')) {
          form.setValue('email', kycData.email);
        }
        
        // Pre-fill mobile if available
        if (kycData.mobile && !form.getValues('mobile')) {
          form.setValue('mobile', kycData.mobile);
        }
        
        // Pre-fill name fields from fullName if available
        if (kycData.fullName && !form.getValues('firstName')) {
          const nameParts = kycData.fullName.trim().split(' ');
          if (nameParts.length === 1) {
            form.setValue('firstName', nameParts[0]);
          } else if (nameParts.length === 2) {
            form.setValue('firstName', nameParts[0]);
            form.setValue('lastName', nameParts[1]);
          } else if (nameParts.length >= 3) {
            form.setValue('firstName', nameParts[0]);
            form.setValue('middleName', nameParts.slice(1, -1).join(' '));
            form.setValue('lastName', nameParts[nameParts.length - 1]);
          }
        }
        
        // Pre-fill PAN if available
        if (kycData.panNumber && !form.getValues('panNumber')) {
          form.setValue('panNumber', kycData.panNumber);
        }
        
        calculateCompleteness();
      }
    }
  }, [kycProfile, kycProfileLoading, form, calculateCompleteness]);

  if (profileLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
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
          <p className="text-muted-foreground mt-2">
            Complete your profile for regulatory compliance and enhanced services
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Profile Completeness</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={profileCompleteness} className="w-32" />
              <span className="text-sm font-medium">{profileCompleteness}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-Approved Loan Offers */}
      <LoanOffersCard />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <ScrollableTabsList>
              <TabsTrigger value="overview" data-testid="tab-overview" className="flex-shrink-0">
                <Home className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="kyc-dashboard" data-testid="tab-kyc-dashboard" className="flex-shrink-0">
                <Award className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="kyc-verification" data-testid="tab-kyc-verification" className="flex-shrink-0">
                <Shield className="h-4 w-4 mr-2" />
                Verifications
              </TabsTrigger>
              <TabsTrigger value="accounts" data-testid="tab-accounts" className="flex-shrink-0">
                <CreditCard className="h-4 w-4 mr-2" />
                Accounts
              </TabsTrigger>
              <TabsTrigger value="compliance" data-testid="tab-compliance" className="flex-shrink-0">
                <FileText className="h-4 w-4 mr-2" />
                Compliance
              </TabsTrigger>
            </ScrollableTabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {!user ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please log in to view your account overview</AlertDescription>
                </Alert>
              ) : (
                <>
                  {(() => {
                    const kycProfileData = (kycProfile as any)?.data;
                    const stats = (orderStats as any)?.stats;
                    const orders = (recentOrders as any)?.orders || [];
                    const isKycComplete = kycProfileData?.kycStatus === 'approved';

                    return (
                      <>
                        {/* 1. Account Summary Hero Card */}
                        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                          <CardContent className="p-6">
                            {kycProfileLoading ? (
                              <div className="animate-pulse flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-muted"></div>
                                <div className="space-y-2 flex-1">
                                  <div className="h-6 bg-muted rounded w-48"></div>
                                  <div className="h-4 bg-muted rounded w-32"></div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                                    {(kycProfileData?.fullName || user?.username || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                      {kycProfileData?.fullName || user?.username || 'User'}
                                    </h2>
                                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                                      UID: {kycProfileData?.userId || user?.id || '—'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant={clientType === 'non_individual' ? 'secondary' : 'outline'} className="text-xs">
                                        <Building2 className="h-3 w-3 mr-1" />
                                        {clientType === 'non_individual' ? 'Corporate' : 'Individual'}
                                      </Badge>
                                      {user?.createdAt && (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant={isKycComplete ? 'default' : 'secondary'}
                                    className={`px-3 py-1 ${isKycComplete ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'} text-white`}
                                  >
                                    {isKycComplete ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                    {kycProfileData?.kycStatus === 'approved' ? 'Verified' : kycProfileData?.kycStatus === 'in_progress' ? 'In Progress' : 'Pending'}
                                  </Badge>
                                  {kycProfileData?.kycTier && (
                                    <Badge variant="outline" className="px-3 py-1">
                                      {getTierIcon(kycProfileData.kycTier)}
                                      <span className="ml-1">{formatTierName(kycProfileData.kycTier)}</span>
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 2. Portfolio Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {orderStatsLoading ? (
                            <>
                              {[1, 2, 3, 4].map((i) => (
                                <Card key={i} className="animate-pulse">
                                  <CardContent className="p-6">
                                    <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                                    <div className="h-8 bg-muted rounded w-32"></div>
                                  </CardContent>
                                </Card>
                              ))}
                            </>
                          ) : (
                            <>
                              <Card className="border-l-4 border-l-blue-500">
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Total Investment</p>
                                      <p className="text-2xl font-bold">₹{((stats?.totalAmount || 0) / 100000).toFixed(2)}L</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <IndianRupee className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-green-500">
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Holdings Value</p>
                                      <p className="text-2xl font-bold">₹{((stats?.completedAmount || stats?.totalAmount || 0) / 100000).toFixed(2)}L</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                                      <LineChart className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-purple-500">
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Total Orders</p>
                                      <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                                      <ShoppingCart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="border-l-4 border-l-orange-500">
                                <CardContent className="p-6">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Pending Actions</p>
                                      <p className="text-2xl font-bold">{stats?.pendingOrders || 0}</p>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                                      <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </>
                          )}
                        </div>

                        {/* 3. Quick Actions Grid */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Sparkles className="h-5 w-5" />
                              Quick Actions
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-3 overflow-x-auto pb-2">
                              {!isKycComplete && (
                                <Button
                                  variant="outline"
                                  className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px] border-dashed border-yellow-400 dark:border-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                                  onClick={() => setLocation('/onboarding')}
                                >
                                  <ShieldCheck className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                                  <span className="text-xs font-medium">Complete KYC</span>
                                </Button>
                              )}
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/domestic-trading')}>
                                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs font-medium">Start Trading</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/mutual-funds')}>
                                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium">Mutual Funds</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/ipo')}>
                                <Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                <span className="text-xs font-medium">IPO</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/bonds')}>
                                <Receipt className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                <span className="text-xs font-medium">Bonds</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/tax-itr-self')}>
                                <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                                <span className="text-xs font-medium">Tax Filing</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/portfolio')}>
                                <LineChart className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                <span className="text-xs font-medium">Portfolio</span>
                              </Button>
                              <Button variant="outline" className="flex-shrink-0 h-auto py-3 px-4 flex flex-col items-center gap-2 min-w-[100px]" onClick={() => setLocation('/family-dashboard')}>
                                <Users className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                                <span className="text-xs font-medium">Family</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 4. Recent Orders Card */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Package className="h-5 w-5" />
                              Recent Orders
                            </CardTitle>
                            <CardDescription>Your latest transactions</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {recentOrdersLoading ? (
                              <div className="animate-pulse space-y-3">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                                    <div className="space-y-1">
                                      <div className="h-4 bg-muted rounded w-40"></div>
                                      <div className="h-3 bg-muted rounded w-24"></div>
                                    </div>
                                    <div className="h-6 bg-muted rounded w-20"></div>
                                  </div>
                                ))}
                              </div>
                            ) : orders.length === 0 ? (
                              <div className="text-center py-8">
                                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                                <p className="text-muted-foreground">No orders yet</p>
                                <p className="text-sm text-muted-foreground mt-1">Start investing to see your orders here</p>
                                <Button variant="outline" className="mt-4" onClick={() => setLocation('/mutual-funds')}>
                                  Explore Products
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {orders.slice(0, 5).map((order: any, idx: number) => (
                                  <div key={order.id || idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${order.orderType === 'sell' || order.orderType === 'redemption' ? 'bg-red-100 dark:bg-red-900' : 'bg-green-100 dark:bg-green-900'}`}>
                                        {order.orderType === 'sell' || order.orderType === 'redemption' ? (
                                          <ArrowRight className="h-4 w-4 text-red-600 dark:text-red-400 rotate-45" />
                                        ) : (
                                          <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400 -rotate-45" />
                                        )}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">{order.productName || 'Order'}</p>
                                        <p className="text-xs text-muted-foreground capitalize">
                                          {order.orderType} · {order.productType?.replace(/_/g, ' ')} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '—'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                      <span className="font-semibold text-sm">₹{(order.amount || 0).toLocaleString('en-IN')}</span>
                                      <Badge
                                        variant={order.status === 'completed' || order.status === 'executed' ? 'default' : order.status === 'cancelled' || order.status === 'failed' ? 'destructive' : 'secondary'}
                                        className="text-xs capitalize"
                                      >
                                        {order.status || 'pending'}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                                <Separator className="my-2" />
                                <Button variant="ghost" className="w-full text-sm" onClick={() => setActiveTab('kyc-dashboard')}>
                                  View All Orders
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 5. Account Details Snapshot Card */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <CreditCard className="h-5 w-5" />
                              Account Details
                            </CardTitle>
                            <CardDescription>Linked accounts and verification status</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Banknote className="h-5 w-5 text-blue-500" />
                                  <div>
                                    <p className="text-sm font-medium">Bank Account</p>
                                    <p className="text-xs text-muted-foreground">{kycProfileData?.bankVerified ? 'Linked & Verified' : 'Not Linked'}</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setActiveTab('accounts')}>
                                  {kycProfileData?.bankVerified ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ExternalLink className="h-4 w-4" />}
                                </Button>
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Building2 className="h-5 w-5 text-purple-500" />
                                  <div>
                                    <p className="text-sm font-medium">Demat Account</p>
                                    <p className="text-xs text-muted-foreground">{kycProfileData?.dematLinked ? 'Linked' : 'Not Linked'}</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setActiveTab('accounts')}>
                                  {kycProfileData?.dematLinked ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ExternalLink className="h-4 w-4" />}
                                </Button>
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <CreditCard className="h-5 w-5 text-green-500" />
                                  <div>
                                    <p className="text-sm font-medium">PAN</p>
                                    <p className="text-xs text-muted-foreground">{isPanVerified ? 'Verified' : 'Not Verified'}</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setActiveTab('kyc-verification')}>
                                  {isPanVerified ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ExternalLink className="h-4 w-4" />}
                                </Button>
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                  <Shield className="h-5 w-5 text-orange-500" />
                                  <div>
                                    <p className="text-sm font-medium">Aadhaar</p>
                                    <p className="text-xs text-muted-foreground">{kycProfileData?.aadhaarVerified ? 'Verified' : 'Not Verified'}</p>
                                  </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setActiveTab('kyc-verification')}>
                                  {kycProfileData?.aadhaarVerified ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <ExternalLink className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    );
                  })()}
                </>
              )}
            </TabsContent>

            {/* KYC Dashboard Tab */}
            <TabsContent value="kyc-dashboard" className="space-y-6">
              {/* KYC Dashboard Implementation */}
              {!user ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please log in to view your KYC dashboard</AlertDescription>
                </Alert>
              ) : kycProfileLoading || eligibilityLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-muted rounded-lg"></div>
                  <div className="h-64 bg-muted rounded-lg"></div>
                </div>
              ) : (
                <>
                  {(() => {
                    const kycProfileData = (kycProfile as any)?.data;
                    const eligibility = (eligibilityData as any)?.data;

                    return (
                      <>
                        {/* Personalized Greeting */}
                        {kycProfileData?.fullName && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-4 mb-2">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold">
                                {kycProfileData.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="greeting-message">
                                  Welcome, {kycProfileData.fullName}!
                                </h2>
                                <p className="text-blue-700 dark:text-blue-300 text-sm">
                                  UID: {kycProfileData?.userId} | PAN Verified Account
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Header Section */}
                        <div className="flex justify-between items-center">
                          <div>
                            <h1 className="text-3xl font-bold" data-testid="heading-kyc-dashboard">My KYC Dashboard</h1>
                            <p className="text-muted-foreground">Manage your verification and access</p>
                          </div>
                          <Badge className={`${getTierColor(kycProfileData?.kycTier || 'basic')} text-foreground px-4 py-2 text-lg`} data-testid="badge-kyc-tier">
                            {getTierIcon(kycProfileData?.kycTier || 'basic')}
                            <span className="ml-2">{formatTierName(kycProfileData?.kycTier || 'basic')}</span>
                          </Badge>
                        </div>

                        {/* KYC Profile Overview */}
                        <Card data-testid="card-kyc-profile">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              KYC Profile Overview
                            </CardTitle>
                            <CardDescription>Your unique identification and verification status</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Email */}
                              <div>
                                <p className="text-sm text-muted-foreground">Email</p>
                                <p className="font-semibold" data-testid="text-email">{kycProfileData?.email}</p>
                              </div>

                              {/* Mobile */}
                              <div>
                                <p className="text-sm text-muted-foreground">Mobile</p>
                                <p className="font-semibold" data-testid="text-mobile">{kycProfileData?.mobile}</p>
                              </div>

                              {/* PAN Number */}
                              <div>
                                <p className="text-sm text-muted-foreground">PAN Number</p>
                                <p className="font-semibold" data-testid="text-pan">{kycProfileData?.panNumber || 'Not verified'}</p>
                              </div>

                              {/* KYC Status */}
                              <div>
                                <p className="text-sm text-muted-foreground">KYC Status</p>
                                <Badge variant={kycProfileData?.kycStatus === 'approved' ? 'default' : 'secondary'} data-testid="badge-kyc-status">
                                  {kycProfileData?.kycStatus || 'pending'}
                                </Badge>
                              </div>
                            </div>

                            {kycProfileData?.kycTierStatus && (
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Tier Status:</span>
                                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${kycProfileData.kycTierStatus === 'final' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                                    {kycProfileData.kycTierStatus === 'final' ? 'Final' : 'Provisional'}
                                  </span>
                                </div>
                                {kycProfileData?.amlRiskLevel && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">AML Risk:</span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${kycProfileData.amlRiskLevel === 'LOW' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : kycProfileData.amlRiskLevel === 'MEDIUM' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}`}>
                                      {kycProfileData.amlRiskLevel}
                                    </span>
                                  </div>
                                )}
                                {kycProfileData?.entityType && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Entity:</span>
                                    <span className="text-sm font-medium">{kycProfileData.entityType}</span>
                                    {kycProfileData?.entityTypeLocked && (
                                      <Shield className="h-3 w-3 text-blue-500" />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <Separator />

                            {/* Verification Progress */}
                            <div>
                              <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold">Verification Progress</h3>
                                {(() => {
                                  const summary = kycProfileData?.verificationSummary;
                                  const completed = summary?.completedVerifications ?? [
                                    kycProfileData?.panVerified,
                                    kycProfileData?.aadhaarVerified,
                                    kycProfileData?.bankVerified,
                                    kycProfileData?.videoKycCompleted,
                                    kycProfileData?.ckycVerified,
                                    kycProfileData?.kraVerified
                                  ].filter(Boolean).length;
                                  const total = summary?.totalVerifications ?? 6;
                                  return (
                                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                      {completed}/{total} Complete
                                    </span>
                                  );
                                })()}
                              </div>
                              <Progress 
                                value={(() => {
                                  const summary = kycProfileData?.verificationSummary;
                                  const completed = summary?.completedVerifications ?? [
                                    kycProfileData?.panVerified,
                                    kycProfileData?.aadhaarVerified,
                                    kycProfileData?.bankVerified,
                                    kycProfileData?.videoKycCompleted,
                                    kycProfileData?.ckycVerified,
                                    kycProfileData?.kraVerified
                                  ].filter(Boolean).length;
                                  const total = summary?.totalVerifications ?? 6;
                                  return (completed / total) * 100;
                                })()} 
                                className="h-2 mb-4" 
                              />
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <VerificationBadge 
                                  label="PAN" 
                                  verified={kycProfileData?.panVerified} 
                                  testId="status-pan-verified"
                                />
                                <VerificationBadge 
                                  label="Aadhaar" 
                                  verified={kycProfileData?.aadhaarVerified} 
                                  testId="status-aadhaar-verified"
                                />
                                <VerificationBadge 
                                  label="Bank" 
                                  verified={kycProfileData?.bankVerified} 
                                  testId="status-bank-verified"
                                />
                                <VerificationBadge 
                                  label="Video KYC" 
                                  verified={kycProfileData?.videoKycCompleted} 
                                  testId="status-video-kyc"
                                />
                                <VerificationBadge 
                                  label="CKYC" 
                                  verified={kycProfileData?.ckycVerified} 
                                  testId="status-ckyc-verified"
                                />
                                <VerificationBadge 
                                  label="KRA" 
                                  verified={kycProfileData?.kraVerified} 
                                  testId="status-kra-verified"
                                />
                              </div>
                            </div>

                            {/* Compliance Status */}
                            <div>
                              <h3 className="font-semibold mb-3">Compliance Status</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <ComplianceItem 
                                  label="Risk Category" 
                                  value={kycProfileData?.riskCategory || 'low'} 
                                  testId="text-risk-category"
                                />
                                <ComplianceItem 
                                  label="PEP Status" 
                                  value={kycProfileData?.pepStatus === 'Y' ? 'Yes' : 'No'} 
                                  testId="text-pep-status"
                                />
                                <ComplianceItem 
                                  label="FATCA Status" 
                                  value={kycProfileData?.fatcaStatus === 'Y' ? 'Declared' : 'Not Applicable'} 
                                  testId="text-fatca-status"
                                />
                                <ComplianceItem 
                                  label="AML Status" 
                                  value={kycProfileData?.amlStatus || 'clear'} 
                                  testId="text-aml-status"
                                />
                              </div>
                            </div>

                            {/* Edit KYC Button */}
                            <div className="flex justify-end">
                              <Button 
                                variant="outline" 
                                className="gap-2" 
                                data-testid="button-edit-kyc"
                                onClick={() => setLocation('/onboarding?mode=edit')}
                              >
                                <Edit className="h-4 w-4" />
                                Edit KYC Details
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Current Tier Benefits & Upgrade */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Current Tier Benefits */}
                          <Card data-testid="card-current-tier">
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                {getTierIcon(kycProfileData?.kycTier || 'basic')}
                                Your Current Tier
                              </CardTitle>
                              <CardDescription>{kycProfileData?.kycTierMetadata?.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  <span className="text-sm" data-testid="text-products-unlocked">
                                    {eligibility?.totalProductsAccessible || 0} Products Unlocked
                                  </span>
                                </div>
                                {kycProfileData?.kycTierMetadata?.maxAnnualInvestment && (
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-blue-500" />
                                    <span className="text-sm" data-testid="text-max-investment">
                                      Max Investment: ₹{(kycProfileData.kycTierMetadata.maxAnnualInvestment / 100000).toFixed(0)} Lakh/year
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Award className="h-5 w-5 text-purple-500" />
                                  <span className="text-sm" data-testid="text-kyc-level">
                                    KYC Level: {kycProfileData?.kycLevel || '1'}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Upgrade Option */}
                          {eligibility?.nextTier && (
                            <Card className="border-2 border-primary" data-testid="card-upgrade-tier">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <ArrowRight className="h-5 w-5" />
                                  Upgrade to {formatTierName(eligibility.nextTier)}
                                </CardTitle>
                                <CardDescription>Complete your KYC in minutes with our smart wizard</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <Button 
                                  className="w-full gap-2" 
                                  onClick={() => setLocation('/onboarding')}
                                  data-testid="button-start-smart-kyc"
                                >
                                  <Sparkles className="h-4 w-4" />
                                  Start Smart KYC Onboarding
                                </Button>
                                <p className="text-sm text-muted-foreground mt-3 text-center">
                                  Our smart wizard will auto-detect your verified data and guide you through only the missing steps
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Product Eligibility */}
                        <Card data-testid="card-product-eligibility">
                          <CardHeader>
                            <CardTitle>Product Eligibility</CardTitle>
                            <CardDescription>Products you can access based on your KYC tier</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-6">
                              {/* Accessible Products */}
                              <div>
                                <h3 className="font-semibold mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
                                  <Unlock className="h-5 w-5" />
                                  Unlocked Products ({eligibility?.totalProductsAccessible || 0})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                                  {eligibility?.accessibleProducts?.map((product: any) => (
                                    <ProductCard 
                                      key={product.productCode}
                                      product={product}
                                      isAccessible={true}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Locked Products */}
                              {eligibility?.lockedProducts && eligibility.lockedProducts.length > 0 && (
                                <div>
                                  <h3 className="font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                                    <Lock className="h-5 w-5" />
                                    Locked Products ({eligibility?.totalProductsLocked || 0})
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                                    {eligibility?.lockedProducts?.map((product: any) => (
                                      <ProductCard 
                                        key={product.productCode}
                                        product={product}
                                        isAccessible={false}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Re-KYC Information (if applicable) */}
                        {kycProfileData?.riskNextReview && (
                          <Alert data-testid="alert-rekyc">
                            <Clock className="h-4 w-4" />
                            <AlertDescription>
                              Next KYC Review Due: {new Date(kycProfileData.riskNextReview).toLocaleDateString('en-IN')}
                            </AlertDescription>
                          </Alert>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
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
                                  <div className="text-sm text-muted-foreground">Personal account</div>
                                </div>
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2 border rounded-lg p-4">
                              <RadioGroupItem value="non_individual" id="non_individual" />
                              <Label htmlFor="non_individual" className="cursor-pointer">
                                <div>
                                  <div className="font-medium">Non-Individual</div>
                                  <div className="text-sm text-muted-foreground">Business/Entity account</div>
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
                          <FormLabel className="flex items-center gap-2">
                            Email Address *
                            {isEmailVerified && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email" 
                              placeholder="Enter email address" 
                              disabled={isEmailVerified}
                              className={isEmailVerified ? "bg-muted cursor-not-allowed" : ""}
                            />
                          </FormControl>
                          {isEmailVerified && (
                            <FormDescription className="text-xs text-muted-foreground">
                              This field is verified and cannot be edited
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            Mobile Number *
                            {isMobileVerified && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter mobile number" 
                              disabled={isMobileVerified}
                              className={isMobileVerified ? "bg-muted cursor-not-allowed" : ""}
                            />
                          </FormControl>
                          {isMobileVerified && (
                            <FormDescription className="text-xs text-muted-foreground">
                              This field is verified and cannot be edited
                            </FormDescription>
                          )}
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
                          <FormLabel className="flex items-center gap-2">
                            PAN Number *
                            {isPanVerified && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="ABCDE1234F" 
                              className={`uppercase ${isPanVerified ? "bg-muted cursor-not-allowed" : ""}`}
                              disabled={isPanVerified}
                            />
                          </FormControl>
                          {isPanVerified && (
                            <FormDescription className="text-xs text-muted-foreground">
                              This field is verified and cannot be edited
                            </FormDescription>
                          )}
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

            {/* Accounts Tab - Banking & Demat */}
            <TabsContent value="accounts" className="space-y-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Bank Accounts
                    </CardTitle>
                    <CardDescription>Your linked bank accounts for transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <BankingTab />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Demat Accounts
                    </CardTitle>
                    <CardDescription>Your linked demat accounts for securities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DematTab />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Product Preferences
                    </CardTitle>
                    <CardDescription>Customize your investment product settings and preferences</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProductAccountPreferences />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center gap-2">
              {isAmlScreening && (
                <>
                  <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-muted-foreground">Running AML screening...</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ["overview", "kyc-dashboard", "kyc-verification", "accounts", "compliance"];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1]);
                  }
                }}
                disabled={activeTab === "overview"}
              >
                Previous
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ["overview", "kyc-dashboard", "kyc-verification", "accounts", "compliance"];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1]);
                  }
                }}
                disabled={activeTab === "compliance"}
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

// KYC Dashboard Helper Components

// Verification Badge Component
function VerificationBadge({ label, verified, testId }: { label: string; verified: boolean; testId: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg" data-testid={testId}>
      {verified ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

// Compliance Item Component
function ComplianceItem({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold capitalize" data-testid={testId}>{value}</p>
    </div>
  );
}

// Product Card Component
function ProductCard({ product, isAccessible }: { product: any; isAccessible: boolean }) {
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isAccessible 
          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
          : 'bg-muted border-border'
      }`}
      data-testid={`card-product-${product.productCode}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-semibold text-sm">{product.productName}</p>
          {!isAccessible && (
            <Badge variant="outline" className="mt-1 text-xs">
              Requires: {product.requiredUpgrade?.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
        {isAccessible ? (
          <Unlock className="h-4 w-4 text-green-500" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}