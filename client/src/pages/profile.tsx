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
import { User, Shield, AlertTriangle, CheckCircle, FileText, Building2, Globe, Star, Award, Lock, Heart, MapPin, Phone, Mail, CreditCard, Banknote, Users, Calendar, RefreshCw, ShieldCheck, Crown, CheckCircle2, XCircle, Edit, ArrowRight, Unlock, TrendingUp, Clock, AlertCircle, Sparkles, Home, BarChart3, Briefcase, IndianRupee, LineChart, Receipt, ExternalLink, ChevronRight, Package, ShoppingCart, Info, Settings, Activity, Copy, Eye, EyeOff, LogOut, ChevronDown } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Role detection
  const userRole = (user as any)?.role || (user as any)?.roles?.[0] || 'user';
  const isAdmin = ['admin', 'superadmin'].includes(userRole);
  const isAgent = ['agent', 'sub_agent', 'associate'].includes(userRole);
  const isPartner = ['partner', 'master_agent', 'distributor'].includes(userRole);
  const isCompliance = ['compliance_officer', 'regulatory_auditor'].includes(userRole);
  const isClient = !isAdmin && !isAgent && !isPartner && !isCompliance;

  // Masking helpers
  const maskPan = (pan: string) => pan ? pan.substring(0, 2) + 'XXXXX' + pan.slice(-2) : '—';
  const maskMobile = (mobile: string) => mobile ? 'XXXXX' + mobile.slice(-4) : '—';
  const maskEmail = (email: string) => {
    if (!email) return '—';
    const [local, domain] = email.split('@');
    return local.charAt(0) + 'XXXXX' + local.slice(-1) + '@' + domain;
  };
  const maskAadhaar = (a: string) => a ? 'XXXX-XXXX-' + a.slice(-4) : '—';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <ChevronDown className={`h-5 w-5 transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {isAdmin ? 'Admin Profile & KYC' : isAgent ? 'Agent Profile' : isPartner ? 'Partner Profile' : 'My Profile & KYC'}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                {isAdmin ? 'PMLA-compliant admin identity management' : isAgent ? 'ARN-linked agent profile & compliance' : 'Manage your identity, accounts & investments'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500">
              <span>Profile</span>
              <Progress value={profileCompleteness} className="w-20 h-2" />
              <span className="font-semibold text-gray-700 dark:text-gray-300">{profileCompleteness}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Pre-Approved Loan Offers — client only */}
        {isClient && <div className="mb-4"><LoanOffersCard /></div>}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── LEFT SIDEBAR ── */}
          <aside className={`lg:w-72 flex-shrink-0 space-y-4 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
            {/* Identity Card */}
            {(() => {
              const kycProfileData = (kycProfile as any)?.data;
              const fullName = kycProfileData?.fullName || (user as any)?.username || 'User';
              const kycStatus = kycProfileData?.kycStatus;
              const kycTier = kycProfileData?.kycTier;
              const isVerified = kycStatus === 'approved';
              const initials = fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

              return (
                <Card className="overflow-hidden border-0 shadow-sm">
                  {/* Avatar Banner */}
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold border-2 border-white/40">
                        {initials}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isVerified ? (
                          <span className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 className="h-3 w-3" /> KYC Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                            <Clock className="h-3 w-3" /> KYC Pending
                          </span>
                        )}
                        {kycTier && (
                          <span className="flex items-center gap-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                            {kycTier === 'accredited_investor' ? <Crown className="h-3 w-3" /> : kycTier === 'enhanced' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                            {kycTier === 'accredited_investor' ? 'Accredited' : kycTier === 'enhanced' ? 'Enhanced' : 'Standard'} KYC
                          </span>
                        )}
                        {/* Role badge */}
                        <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full capitalize">
                          {isAdmin ? '⚙ Admin' : isAgent ? '🤝 Agent' : isPartner ? '🏢 Partner' : isCompliance ? '⚖ Compliance' : '👤 Client'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-lg leading-tight">{fullName}</p>
                      <p className="text-blue-200 text-xs mt-0.5">UID: {kycProfileData?.userId || (user as any)?.id || '—'}</p>
                      {(user as any)?.createdAt && (
                        <p className="text-blue-200 text-xs mt-0.5">Member since {new Date((user as any).createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                      )}
                    </div>
                  </div>
                  {/* Completeness */}
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Profile Completeness</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{profileCompleteness}%</span>
                    </div>
                    <Progress value={profileCompleteness} className="h-1.5" />
                  </div>
                </Card>
              );
            })()}

            {/* Sidebar Navigation */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-2">
                {[
                  { id: 'overview', icon: <Home className="h-4 w-4" />, label: 'Personal Details', testId: 'tab-overview' },
                  { id: 'kyc-dashboard', icon: <Award className="h-4 w-4" />, label: 'KYC Dashboard', testId: 'tab-kyc-dashboard' },
                  { id: 'kyc-verification', icon: <Shield className="h-4 w-4" />, label: 'Verifications', testId: 'tab-kyc-verification' },
                  { id: 'accounts', icon: <CreditCard className="h-4 w-4" />, label: 'Bank & Demat', testId: 'tab-accounts' },
                  { id: 'compliance', icon: <FileText className="h-4 w-4" />, label: 'Compliance', testId: 'tab-compliance' },
                ].map(nav => (
                  <button
                    key={nav.id}
                    data-testid={nav.testId}
                    onClick={() => { setActiveTab(nav.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                      activeTab === nav.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className={activeTab === nav.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}>{nav.icon}</span>
                    {nav.label}
                    {activeTab === nav.id && <ChevronRight className="h-3 w-3 ml-auto text-blue-500" />}
                  </button>
                ))}

                <Separator className="my-2" />

                {/* Role-specific quick links */}
                {isClient && (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">Quick Access</p>
                    {[
                      { label: 'My Portfolio', icon: <LineChart className="h-4 w-4" />, path: '/portfolio' },
                      { label: 'Trade US Stocks', icon: <TrendingUp className="h-4 w-4" />, path: '/domestic-trading' },
                      { label: 'Mutual Funds', icon: <BarChart3 className="h-4 w-4" />, path: '/mutual-funds' },
                      { label: 'Tax Filing', icon: <Receipt className="h-4 w-4" />, path: '/tax-itr-self' },
                    ].map(link => (
                      <button key={link.path} onClick={() => setLocation(link.path)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                        <span className="text-gray-400">{link.icon}</span>{link.label}
                      </button>
                    ))}
                  </>
                )}
                {isAdmin && (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">Admin Tools</p>
                    {[
                      { label: 'KYC Management', icon: <Shield className="h-4 w-4" />, path: '/kyc-dashboard' },
                      { label: 'User Management', icon: <Users className="h-4 w-4" />, path: '/users' },
                      { label: 'Audit Logs', icon: <FileText className="h-4 w-4" />, path: '/audit-logs' },
                      { label: 'System Settings', icon: <Settings className="h-4 w-4" />, path: '/settings' },
                    ].map(link => (
                      <button key={link.path} onClick={() => setLocation(link.path)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                        <span className="text-gray-400">{link.icon}</span>{link.label}
                      </button>
                    ))}
                  </>
                )}
                {isAgent && (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">Agent Tools</p>
                    {[
                      { label: 'My Clients', icon: <Users className="h-4 w-4" />, path: '/clients' },
                      { label: 'Onboard Client', icon: <ShieldCheck className="h-4 w-4" />, path: '/onboarding' },
                      { label: 'Commission Report', icon: <IndianRupee className="h-4 w-4" />, path: '/commissions' },
                    ].map(link => (
                      <button key={link.path} onClick={() => setLocation(link.path)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                        <span className="text-gray-400">{link.icon}</span>{link.label}
                      </button>
                    ))}
                  </>
                )}
                {isPartner && (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">Partner Tools</p>
                    {[
                      { label: 'Distribution Metrics', icon: <BarChart3 className="h-4 w-4" />, path: '/partner-dashboard' },
                      { label: 'Sub-Agents', icon: <Users className="h-4 w-4" />, path: '/sub-agents' },
                      { label: 'Revenue', icon: <IndianRupee className="h-4 w-4" />, path: '/revenue' },
                    ].map(link => (
                      <button key={link.path} onClick={() => setLocation(link.path)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                        <span className="text-gray-400">{link.icon}</span>{link.label}
                      </button>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* ── RIGHT MAIN CONTENT ── */}
          <div className="flex-1 min-w-0">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            {/* Mobile scrollable tab bar — visible on mobile only */}
            <div className="lg:hidden">
              <ScrollableTabsList>
                <TabsTrigger value="overview" data-testid="tab-overview-mobile" className="flex-shrink-0">
                  <Home className="h-4 w-4 mr-1" />Overview
                </TabsTrigger>
                <TabsTrigger value="kyc-dashboard" data-testid="tab-kyc-dashboard-mobile" className="flex-shrink-0">
                  <Award className="h-4 w-4 mr-1" />Dashboard
                </TabsTrigger>
                <TabsTrigger value="kyc-verification" data-testid="tab-kyc-verification-mobile" className="flex-shrink-0">
                  <Shield className="h-4 w-4 mr-1" />Verify
                </TabsTrigger>
                <TabsTrigger value="accounts" data-testid="tab-accounts-mobile" className="flex-shrink-0">
                  <CreditCard className="h-4 w-4 mr-1" />Accounts
                </TabsTrigger>
                <TabsTrigger value="compliance" data-testid="tab-compliance-mobile" className="flex-shrink-0">
                  <FileText className="h-4 w-4 mr-1" />Compliance
                </TabsTrigger>
              </ScrollableTabsList>
            </div>

            {/* Overview Tab — ICICI-inspired Personal Details */}
            <TabsContent value="overview" className="space-y-4">
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
                    const fullName = kycProfileData?.fullName || (user as any)?.username || '';
                    const panNum = kycProfileData?.panNumber || form.getValues('panNumber') || '';
                    const mobileNum = kycProfileData?.mobile || form.getValues('mobile') || '';
                    const emailAddr = kycProfileData?.email || form.getValues('email') || '';
                    const aadhaarLast4 = kycProfileData?.aadhaarLast4 || '';
                    const ckycId = kycProfileData?.ckycNumber || kycProfileData?.ckycId || '';
                    const kraRef = kycProfileData?.kraRefNumber || '';
                    const dob = form.getValues('dateOfBirth') || kycProfileData?.dateOfBirth || '';
                    const gender = form.getValues('gender') || kycProfileData?.gender || '';
                    const fatherName = form.getValues('fatherName') || kycProfileData?.fatherName || '';
                    const occupation = form.getValues('occupation') || kycProfileData?.occupation || '';
                    const fatcaStatus = form.getValues('fatcaStatus') || kycProfileData?.fatcaStatus || '';
                    const pepStatus = form.getValues('pepStatus') || kycProfileData?.pepStatus || '';
                    const riskTolerance = form.getValues('riskTolerance') || kycProfileData?.riskTolerance || '';
                    const annualIncome = form.getValues('annualIncome') || kycProfileData?.annualIncome || '';
                    const presentAddress = form.getValues('presentAddress') || '';
                    const presentCity = form.getValues('presentCity') || '';
                    const presentState = form.getValues('presentState') || '';
                    const presentPincode = form.getValues('presentPincode') || '';
                    const address = [presentAddress, presentCity, presentState, presentPincode]
                      .filter(Boolean).join(', ') || kycProfileData?.address || '';
                    const permanentAddress = [
                      form.getValues('permanentAddress'),
                      form.getValues('permanentCity'),
                      form.getValues('permanentState'),
                      form.getValues('permanentPincode')
                    ].filter(Boolean).join(', ');
                    const amlRisk = kycProfileData?.amlRiskLevel || 'LOW';
                    const riskCategory = kycProfileData?.riskCategory || 'low';
                    // Update URLs — all go through self-service wizard, no manual re-KYC
                    const wizardStep = (step: string) => `/onboarding?mode=edit&step=${step}`;

                    return (
                      <>
                        {/* RBI/SEBI Regulatory Notice */}
                        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <AlertDescription className="text-amber-800 dark:text-amber-300 text-sm">
                            As per <strong>RBI/SEBI guidelines</strong>, you are required to keep your profile details accurate and up to date.
                            {!isKycComplete && <> Please <button className="underline font-semibold ml-1" onClick={() => setLocation('/onboarding')}>complete your KYC</button> to unlock all services.</>}
                          </AlertDescription>
                        </Alert>

                        {/* ── PERSONAL DETAILS CARD (ICICI-style) ── */}
                        <Card className="border-0 shadow-sm">
                          <CardHeader className="pb-2 pt-5 px-6">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">{fullName || 'Your Name'}</CardTitle>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                  {isAdmin ? 'Administrator Account' : isAgent ? 'Agent Account' : isPartner ? 'Partner Account' : 'Individual Investor'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isKycComplete ? (
                                  <>
                                    <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-200 dark:border-green-800">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> KYC Verified
                                    </span>
                                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setLocation('/onboarding?mode=edit')}>
                                      <Edit className="h-3 w-3 mr-1" /> Edit KYC
                                    </Button>
                                  </>
                                ) : (
                                  <Button size="sm" onClick={() => setLocation('/onboarding')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3">
                                    Complete KYC
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="px-6 pb-6">
                            {/* Section header */}
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Identity & Contact</p>
                              <button onClick={() => setLocation(wizardStep('profile_completion'))}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1">
                                <Edit className="h-3 w-3" /> Edit All
                              </button>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">

                              {/* Full Name */}
                              <ProfileDetailRow
                                label="Full Name"
                                value={fullName || '—'}
                                icon={<User className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Date of Birth */}
                              <ProfileDetailRow
                                label="Date of Birth"
                                value={dob ? new Date(dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                icon={<Calendar className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Gender */}
                              <ProfileDetailRow
                                label="Gender"
                                value={gender ? gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase() : '—'}
                                icon={<User className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Father's Name */}
                              <ProfileDetailRow
                                label="Father / Guardian Name"
                                value={fatherName || '—'}
                                icon={<Users className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Primary Account / UID */}
                              <ProfileDetailRow
                                label="Primary Account (UID)"
                                value={(user as any)?.id?.toString() || '—'}
                                icon={<Globe className="h-4 w-4" />}
                              />

                              {/* CKYC ID — prominent */}
                              <ProfileDetailRow
                                label="CKYC ID"
                                value={ckycId || 'Not yet fetched'}
                                icon={<Award className="h-4 w-4" />}
                                highlight={!!ckycId}
                                action={ckycId
                                  ? { label: 'Know More', onClick: () => setActiveTab('kyc-dashboard') }
                                  : { label: 'Fetch CKYC', onClick: () => setLocation('/onboarding?step=ckyc_kra_check') }}
                              />

                              {/* KRA Reference */}
                              <ProfileDetailRow
                                label="KRA Reference"
                                value={kraRef || 'Not registered'}
                                icon={<FileText className="h-4 w-4" />}
                                action={kraRef
                                  ? { label: 'Know More', onClick: () => setActiveTab('kyc-dashboard') }
                                  : { label: 'Register', onClick: () => setLocation('/onboarding?step=ckyc_kra_check') }}
                              />

                              {/* PAN Number — masked */}
                              <ProfileDetailRow
                                label="PAN Number"
                                value={panNum ? maskPan(panNum) : 'Not verified'}
                                icon={<CreditCard className="h-4 w-4" />}
                                verified={isPanVerified}
                                action={!isPanVerified
                                  ? { label: 'Verify Now', onClick: () => setLocation('/onboarding?step=pan_verification') }
                                  : { label: 'Update', onClick: () => setLocation('/onboarding?mode=edit&step=pan_verification') }}
                              />

                              {/* Aadhaar — masked */}
                              <ProfileDetailRow
                                label="Aadhaar Number"
                                value={aadhaarLast4 ? maskAadhaar(aadhaarLast4) : 'Not verified'}
                                icon={<Shield className="h-4 w-4" />}
                                verified={kycProfileData?.aadhaarVerified}
                                action={!kycProfileData?.aadhaarVerified
                                  ? { label: 'Verify Now', onClick: () => setLocation('/onboarding?step=aadhaar_otp') }
                                  : { label: 'Re-verify', onClick: () => setLocation('/onboarding?mode=edit&step=aadhaar_otp') }}
                              />

                              {/* Mobile Number — masked */}
                              <ProfileDetailRow
                                label="Mobile Number"
                                value={mobileNum ? maskMobile(mobileNum) : '—'}
                                icon={<Phone className="h-4 w-4" />}
                                verified={isMobileVerified}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Email — masked */}
                              <ProfileDetailRow
                                label="Email ID"
                                value={emailAddr ? maskEmail(emailAddr) : '—'}
                                icon={<Mail className="h-4 w-4" />}
                                verified={isEmailVerified}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />
                            </div>

                            {/* Section: Financial & Compliance */}
                            <div className="flex items-center justify-between mt-5 mb-3">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Financial & Compliance</p>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">

                              {/* Occupation */}
                              <ProfileDetailRow
                                label="Occupation"
                                value={occupation ? occupation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '—'}
                                icon={<Briefcase className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Annual Income */}
                              <ProfileDetailRow
                                label="Annual Income Band"
                                value={annualIncome ? annualIncome.replace(/_/g, ' ') : '—'}
                                icon={<IndianRupee className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* Risk Profile */}
                              <ProfileDetailRow
                                label="Risk Profile"
                                value={riskTolerance ? riskTolerance.charAt(0).toUpperCase() + riskTolerance.slice(1).toLowerCase() : riskCategory.charAt(0).toUpperCase() + riskCategory.slice(1)}
                                icon={<Activity className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('risk_profiling')) }}
                              />

                              {/* FATCA Status */}
                              <ProfileDetailRow
                                label="FATCA Declaration"
                                value={fatcaStatus === 'Y' ? 'US Person / Reportable' : fatcaStatus === 'N' ? 'Non-US (Not Reportable)' : '— Not declared'}
                                icon={<Globe className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('fatca_signature')) }}
                              />

                              {/* PEP Status */}
                              <ProfileDetailRow
                                label="PEP Status"
                                value={pepStatus === 'Y' ? 'Politically Exposed Person' : pepStatus === 'N' ? 'Not a PEP' : '— Not declared'}
                                icon={<Star className="h-4 w-4" />}
                                action={{ label: 'Update', onClick: () => setLocation(wizardStep('profile_completion')) }}
                              />

                              {/* KYC Status */}
                              <div className="py-3 flex items-center gap-3">
                                <span className="text-gray-400 dark:text-gray-500 w-5 flex-shrink-0"><ShieldCheck className="h-4 w-4" /></span>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">KYC Status</p>
                                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                                    isKycComplete ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                  }`}>
                                    <span className={`h-2 w-2 rounded-full ${isKycComplete ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                    {kycProfileData?.kycStatus === 'approved' ? 'Verified & Approved' : kycProfileData?.kycStatus === 'in_progress' ? 'In Progress' : 'Pending'}
                                  </span>
                                </div>
                                <button
                                  onClick={() => isKycComplete ? setActiveTab('kyc-dashboard') : setLocation('/onboarding')}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex-shrink-0">
                                  {isKycComplete ? 'View Report' : 'Complete KYC'}
                                </button>
                              </div>

                              {/* AML Risk */}
                              <div className="py-3 flex items-center gap-3">
                                <span className="text-gray-400 dark:text-gray-500 w-5 flex-shrink-0"><AlertTriangle className="h-4 w-4" /></span>
                                <div className="flex-1">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">AML Risk Level</p>
                                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
                                    amlRisk === 'LOW' ? 'text-green-600 dark:text-green-400' : amlRisk === 'MEDIUM' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                  }`}>
                                    <span className={`h-2 w-2 rounded-full ${amlRisk === 'LOW' ? 'bg-green-500' : amlRisk === 'MEDIUM' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                                    {amlRisk} Risk
                                  </span>
                                </div>
                                {amlRisk !== 'LOW' && (
                                  <button onClick={() => setActiveTab('kyc-verification')}
                                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium flex-shrink-0">
                                    Re-Screen
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Section: Addresses */}
                            <div className="flex items-center justify-between mt-5 mb-3">
                              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Addresses</p>
                            </div>
                            <div className="divide-y divide-gray-100 dark:divide-gray-800">
                              {/* Communication Address */}
                              <div className="py-3 flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0 w-5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Communication Address</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                                    {address || <span className="text-gray-400 dark:text-gray-500 italic">Not provided</span>}
                                  </p>
                                </div>
                                <button onClick={() => setLocation(wizardStep('profile_completion'))}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex-shrink-0">Update</button>
                              </div>

                              {/* Permanent Address */}
                              <div className="py-3 flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0 w-5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Permanent Address</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                                    {permanentAddress || <span className="text-gray-400 dark:text-gray-500 italic">Same as communication address</span>}
                                  </p>
                                </div>
                                <button onClick={() => setLocation(wizardStep('profile_completion'))}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex-shrink-0">Update</button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* ── CLIENT: Portfolio Stats + Quick Actions ── */}
                        {isClient && (
                          <>
                            {/* Portfolio Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {[
                                { label: 'Total Invested', value: `₹${((stats?.totalAmount || 0) / 100000).toFixed(2)}L`, icon: <IndianRupee className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                                { label: 'Holdings Value', value: `₹${((stats?.completedAmount || stats?.totalAmount || 0) / 100000).toFixed(2)}L`, icon: <LineChart className="h-4 w-4" />, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
                                { label: 'Total Orders', value: String(stats?.totalOrders || 0), icon: <Package className="h-4 w-4" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                                { label: 'Pending', value: String(stats?.pendingOrders || 0), icon: <Clock className="h-4 w-4" />, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
                              ].map(stat => (
                                <Card key={stat.label} className="border-0 shadow-sm">
                                  <CardContent className="p-4">
                                    <div className={`h-8 w-8 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color} mb-2`}>
                                      {stat.icon}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {/* Favourite Activities (Quick Actions) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Favourite Activities</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-1">
                                  {[
                                    { label: 'Trade US Stocks', icon: <TrendingUp className="h-4 w-4 text-blue-500" />, path: '/domestic-trading' },
                                    { label: 'Mutual Funds', icon: <BarChart3 className="h-4 w-4 text-green-500" />, path: '/mutual-funds' },
                                    { label: 'IPO Applications', icon: <Briefcase className="h-4 w-4 text-purple-500" />, path: '/ipo' },
                                    { label: 'Bonds & Fixed Income', icon: <Receipt className="h-4 w-4 text-indigo-500" />, path: '/bonds' },
                                    { label: 'Tax Filing (ITR)', icon: <FileText className="h-4 w-4 text-red-500" />, path: '/tax-itr-self' },
                                    { label: 'Family Dashboard', icon: <Users className="h-4 w-4 text-pink-500" />, path: '/family-dashboard' },
                                  ].map(item => (
                                    <button key={item.path} onClick={() => setLocation(item.path)}
                                      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300 text-left group">
                                      {item.icon}
                                      {item.label}
                                      <ChevronRight className="h-3 w-3 ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
                                    </button>
                                  ))}
                                </CardContent>
                              </Card>

                              {/* Linked Accounts */}
                              <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Linked Accounts</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0 space-y-2">
                                  {[
                                    { label: 'Bank Account', verified: kycProfileData?.bankVerified, icon: <Banknote className="h-4 w-4" />, action: () => setActiveTab('accounts') },
                                    { label: 'Demat Account', verified: kycProfileData?.dematLinked, icon: <Building2 className="h-4 w-4" />, action: () => setActiveTab('accounts') },
                                    { label: 'PAN', verified: isPanVerified, icon: <CreditCard className="h-4 w-4" />, action: () => setActiveTab('kyc-verification') },
                                    { label: 'Aadhaar OTP', verified: kycProfileData?.aadhaarVerified, icon: <Shield className="h-4 w-4" />, action: () => setActiveTab('kyc-verification') },
                                  ].map(acc => (
                                    <div key={acc.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                      <div className="flex items-center gap-3">
                                        <span className={`${acc.verified ? 'text-blue-500' : 'text-gray-400'}`}>{acc.icon}</span>
                                        <div>
                                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{acc.label}</p>
                                          <p className="text-xs text-gray-400">{acc.verified ? 'Linked & Verified' : 'Not Linked'}</p>
                                        </div>
                                      </div>
                                      <button onClick={acc.action}>
                                        {acc.verified
                                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          : <ExternalLink className="h-4 w-4 text-gray-400 hover:text-blue-500" />}
                                      </button>
                                    </div>
                                  ))}
                                  <Button variant="outline" className="w-full mt-2 text-sm h-8" onClick={() => setActiveTab('accounts')}>
                                    Manage Accounts <ChevronRight className="h-3 w-3 ml-1" />
                                  </Button>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Recent Orders */}
                            <Card className="border-0 shadow-sm">
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Recent Orders
                                  </CardTitle>
                                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setActiveTab('kyc-dashboard')}>
                                    View All <ChevronRight className="h-3 w-3 ml-1" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {recentOrdersLoading ? (
                                  <div className="space-y-2 animate-pulse">
                                    {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
                                  </div>
                                ) : orders.length === 0 ? (
                                  <div className="text-center py-6">
                                    <Package className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                    <p className="text-sm text-gray-500">No orders yet. Start investing!</p>
                                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation('/mutual-funds')}>Explore Products</Button>
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {orders.slice(0, 5).map((order: any, idx: number) => (
                                      <div key={order.id || idx} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-3">
                                          <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${order.orderType === 'sell' || order.orderType === 'redemption' ? 'bg-red-100 dark:bg-red-950/50' : 'bg-green-100 dark:bg-green-950/50'}`}>
                                            <ArrowRight className={`h-3.5 w-3.5 ${order.orderType === 'sell' ? 'text-red-500 rotate-45' : 'text-green-500 -rotate-45'}`} />
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{order.productName || 'Order'}</p>
                                            <p className="text-xs text-gray-400 capitalize">{order.orderType} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '—'}</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">₹{(order.amount || 0).toLocaleString('en-IN')}</p>
                                          <Badge variant={order.status === 'completed' || order.status === 'executed' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                                            {order.status || 'pending'}
                                          </Badge>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </>
                        )}

                        {/* ── ADMIN: Admin-specific overview ── */}
                        {isAdmin && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="border-0 shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Admin Tools</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-1">
                                {[
                                  { label: 'KYC Management', icon: <Shield className="h-4 w-4 text-blue-500" />, path: '/kyc-dashboard' },
                                  { label: 'User Management', icon: <Users className="h-4 w-4 text-purple-500" />, path: '/users' },
                                  { label: 'Audit Logs', icon: <Activity className="h-4 w-4 text-green-500" />, path: '/audit-logs' },
                                  { label: 'Rejections & Re-KYC', icon: <XCircle className="h-4 w-4 text-red-500" />, path: '/kyc-rejections' },
                                  { label: 'AML Screening', icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, path: '/aml-screening' },
                                ].map(item => (
                                  <button key={item.path} onClick={() => setLocation(item.path)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm text-gray-700 dark:text-gray-300 text-left group">
                                    {item.icon}{item.label}
                                    <ChevronRight className="h-3 w-3 ml-auto text-gray-300 group-hover:text-gray-500" />
                                  </button>
                                ))}
                              </CardContent>
                            </Card>
                            <Card className="border-0 shadow-sm">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Your Identity Verification</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0 space-y-2">
                                {[
                                  { label: 'PAN', verified: isPanVerified, note: 'PMLA §12 required' },
                                  { label: 'Aadhaar OTP', verified: kycProfileData?.aadhaarVerified, note: 'Digital identity' },
                                  { label: 'CKYC', verified: kycProfileData?.ckycVerified, note: 'CERSAI record' },
                                  { label: 'AML Clear', verified: kycProfileData?.amlStatus === 'clear', note: 'PMLA screening' },
                                ].map(item => (
                                  <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                    <div>
                                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                                      <p className="text-xs text-gray-400">{item.note}</p>
                                    </div>
                                    {item.verified ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* ── AGENT: Agent-specific overview ── */}
                        {isAgent && (
                          <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Agent Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                  { label: 'Onboard Client', icon: <ShieldCheck className="h-5 w-5 text-blue-500" />, path: '/onboarding' },
                                  { label: 'My Clients', icon: <Users className="h-5 w-5 text-purple-500" />, path: '/clients' },
                                  { label: 'Commission Report', icon: <IndianRupee className="h-5 w-5 text-green-500" />, path: '/commissions' },
                                  { label: 'Pending KYCs', icon: <Clock className="h-5 w-5 text-amber-500" />, path: '/kyc-dashboard' },
                                  { label: 'SEBI Compliance', icon: <FileText className="h-5 w-5 text-indigo-500" />, path: '/compliance' },
                                ].map(item => (
                                  <button key={item.path} onClick={() => setLocation(item.path)}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm text-gray-700 dark:text-gray-300">
                                    {item.icon}<span>{item.label}</span>
                                  </button>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* ── PARTNER: Partner-specific overview ── */}
                        {isPartner && (
                          <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Partner Dashboard</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                  { label: 'Distribution Metrics', icon: <BarChart3 className="h-5 w-5 text-blue-500" />, path: '/partner-dashboard' },
                                  { label: 'Sub-Agents', icon: <Users className="h-5 w-5 text-purple-500" />, path: '/sub-agents' },
                                  { label: 'Revenue Report', icon: <IndianRupee className="h-5 w-5 text-green-500" />, path: '/revenue' },
                                  { label: 'Compliance', icon: <FileText className="h-5 w-5 text-indigo-500" />, path: '/compliance' },
                                ].map(item => (
                                  <button key={item.path} onClick={() => setLocation(item.path)}
                                    className="flex flex-col items-center gap-2 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm text-gray-700 dark:text-gray-300">
                                    {item.icon}<span>{item.label}</span>
                                  </button>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

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
                        {/* KYC Dashboard Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100" data-testid="heading-kyc-dashboard">KYC Dashboard</h1>
                              {kycProfileData?.fullName && (
                                <span className="text-lg text-gray-500 dark:text-gray-400" data-testid="greeting-message">— {kycProfileData.fullName}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">UID: {kycProfileData?.userId || '—'} · Manage your verification, tier, and product access</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getTierColor(kycProfileData?.kycTier || 'basic')} text-white px-3 py-1.5 text-sm font-semibold`} data-testid="badge-kyc-tier">
                              {getTierIcon(kycProfileData?.kycTier || 'basic')}
                              <span className="ml-1.5">{formatTierName(kycProfileData?.kycTier || 'basic')}</span>
                            </Badge>
                            {kycProfileData?.kycStatus === 'approved' ? (
                              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setLocation('/onboarding?mode=edit')}>
                                <Edit className="h-3 w-3 mr-1" /> Edit KYC
                              </Button>
                            ) : (
                              <Button size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setLocation('/onboarding')}>
                                Complete KYC
                              </Button>
                            )}
                          </div>
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
                                <p className="font-semibold font-mono" data-testid="text-email">{maskEmail(kycProfileData?.email || '')}</p>
                              </div>

                              {/* Mobile */}
                              <div>
                                <p className="text-sm text-muted-foreground">Mobile</p>
                                <p className="font-semibold font-mono" data-testid="text-mobile">{maskMobile(kycProfileData?.mobile || '')}</p>
                              </div>

                              {/* PAN Number */}
                              <div>
                                <p className="text-sm text-muted-foreground">PAN Number</p>
                                <p className="font-semibold font-mono" data-testid="text-pan">{kycProfileData?.panNumber ? maskPan(kycProfileData.panNumber) : 'Not verified'}</p>
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
                              {kycProfileData?.kycStatus === 'approved' ? (
                                <Button 
                                  variant="outline" 
                                  className="gap-2" 
                                  data-testid="button-edit-kyc"
                                  onClick={() => setLocation('/onboarding?mode=edit')}
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit KYC Details
                                </Button>
                              ) : (
                                <Button 
                                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
                                  data-testid="button-complete-kyc"
                                  onClick={() => setLocation('/onboarding')}
                                >
                                  <Edit className="h-4 w-4" />
                                  Complete KYC
                                </Button>
                              )}
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
        </div>
      </div>
    </div>
  );
}

// ── PROFILE DETAIL ROW (ICICI-style) ──
interface ProfileDetailRowProps {
  label: string;
  value: string;
  icon?: JSX.Element;
  verified?: boolean;
  highlight?: boolean;
  multiline?: boolean;
  action?: { label: string; onClick: () => void };
}

function ProfileDetailRow({ label, value, icon, verified, highlight, action }: ProfileDetailRowProps) {
  return (
    <div className="py-3 flex items-center gap-3">
      {icon && (
        <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 w-5">{icon}</span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className={`text-sm font-semibold truncate ${
          highlight ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {value}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {verified === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
        {verified === false && <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {action.label}
          </button>
        )}
      </div>
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