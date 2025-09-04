import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUserProfileSchema, type UserProfile } from "@shared/schema";
import { User, Settings, CreditCard, Target, TrendingUp, Building2, CheckCircle, Shield, AlertCircle, FileText, Users, Banknote, Calendar, MapPin, Phone, Mail, Globe, Star, Award, Lock, Heart } from "lucide-react";

// Comprehensive profile form schema for regulatory compliance
const profileFormSchema = z.object({
  // Basic Information
  clientId: z.string(),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  
  // Identity Documents - KYC Required
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format"),
  aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits").optional(),
  passportNumber: z.string().optional(),
  drivingLicense: z.string().optional(),
  voterIdNumber: z.string().optional(),
  
  // Personal Details
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed", "separated"]).optional(),
  fatherName: z.string().min(1, "Father's name is required"),
  motherName: z.string().min(1, "Mother's name is required"),
  spouseName: z.string().optional(),
  
  // Present Address Information
  presentAddress: z.string().min(1, "Present address is required"),
  presentCity: z.string().min(1, "City is required"),
  presentState: z.string().min(1, "State is required"),
  presentPincode: z.string().regex(/^[0-9]{6}$/, "PIN code must be 6 digits"),
  presentCountry: z.string().default("India"),
  
  // Permanent Address Information
  permanentAddress: z.string().optional(),
  permanentCity: z.string().optional(),
  permanentState: z.string().optional(),
  permanentPincode: z.string().optional(),
  permanentCountry: z.string().optional(),
  isAddressSame: z.boolean().default(false),
  
  // Financial Information
  occupation: z.string().min(1, "Occupation is required"),
  annualIncome: z.string().min(1, "Annual income is required"),
  sourceOfWealth: z.string().optional(),
  netWorth: z.string().optional(),
  
  // Investment Profile
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"]),
  investmentObjective: z.enum(["capital_appreciation", "income", "balanced"]),
  investmentHorizon: z.enum(["short", "medium", "long"]),
  
  // Banking Details
  bankAccountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  bankName: z.string().optional(),
  
  // Regulatory Compliance
  residentStatus: z.enum(["resident", "nri", "pio", "oci"]),
  countryOfResidence: z.string().optional(),
  taxResidencyCountry: z.string().optional(),
  
  // FATCA & CRS
  fatcaStatus: z.enum(["us_person", "non_us_person"]).optional(),
  fatcaTinNumber: z.string().optional(),
  
  // PEP Declaration
  pepStatus: z.enum(["yes", "no"]),
  pepDetails: z.string().optional(),
  
  // Nominee Information
  nomineeDetails: z.string().optional(),
  nomineeRelation: z.string().optional(),
  
  // Consent & Declarations
  kycConsent: z.boolean().refine(val => val === true, "KYC consent is required"),
  fatcaDeclaration: z.boolean().refine(val => val === true, "FATCA declaration is required"),
  investmentRiskConsent: z.boolean().refine(val => val === true, "Investment risk consent is required"),
  termsConditions: z.boolean().refine(val => val === true, "Terms and conditions acceptance is required")
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const investmentGoalsOptions = [
  "retirement",
  "wealth_creation",
  "tax_saving",
  "child_education", 
  "emergency_fund",
  "house_purchase",
  "short_term_goals"
];

// KYC Status Types
type KYCStatus = "pending" | "in_progress" | "completed" | "rejected";

interface KYCStatusData {
  mutualFundKyc: KYCStatus;
  brokingKyc: KYCStatus;
  kraKyc: KYCStatus;
  lastUpdated: string;
  completionPercentage: number;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"overview" | "personal" | "financial" | "compliance" | "documents">("overview");
  const [panVerifiedName, setPanVerifiedName] = useState<string | null>(null);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);

  const { data: profile, isLoading } = useQuery<any>({
    queryKey: ["/api/profile"],
    retry: false,
  });

  // Query to get PAN verified name
  const { data: panNameData } = useQuery({
    queryKey: ["/api/pan/verify-name", profile?.panNumber],
    enabled: !!profile?.panNumber,
    retry: false,
  });

  // Query to get KYC status data
  const { data: kycStatusData, isLoading: isKycLoading } = useQuery<KYCStatusData>({
    queryKey: ["/api/kyc/status"],
    retry: false,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      clientId: "demo-user-1",
      firstName: profile?.firstName || "",
      middleName: profile?.middleName || "",
      lastName: profile?.lastName || "",
      email: profile?.email || "",
      mobile: profile?.mobile || "",
      dateOfBirth: profile?.dateOfBirth || "",
      panNumber: profile?.panNumber || "",
      aadharNumber: profile?.aadharNumber || "",
      passportNumber: profile?.passportNumber || "",
      drivingLicense: profile?.drivingLicense || "",
      voterIdNumber: profile?.voterIdNumber || "",
      gender: profile?.gender || "male",
      maritalStatus: profile?.maritalStatus || "single",
      fatherName: profile?.fatherName || "",
      motherName: profile?.motherName || "",
      spouseName: profile?.spouseName || "",
      presentAddress: profile?.presentAddress || "",
      presentCity: profile?.presentCity || "",
      presentState: profile?.presentState || "",
      presentPincode: profile?.presentPincode || "",
      presentCountry: profile?.presentCountry || "India",
      permanentAddress: profile?.permanentAddress || "",
      permanentCity: profile?.permanentCity || "",
      permanentState: profile?.permanentState || "",
      permanentPincode: profile?.permanentPincode || "",
      permanentCountry: profile?.permanentCountry || "India",
      isAddressSame: profile?.isAddressSame || false,
      occupation: profile?.occupation || "",
      annualIncome: profile?.annualIncome || "",
      sourceOfWealth: profile?.sourceOfWealth || "",
      netWorth: profile?.netWorth || "",
      riskTolerance: profile?.riskTolerance || "moderate",
      investmentExperience: profile?.investmentExperience || "beginner",
      investmentObjective: profile?.investmentObjective || "balanced",
      investmentHorizon: profile?.investmentHorizon || "medium",
      bankAccountNumber: profile?.bankAccountNumber || "",
      ifscCode: profile?.ifscCode || "",
      bankName: profile?.bankName || "",
      residentStatus: profile?.residentStatus || "resident",
      countryOfResidence: profile?.countryOfResidence || "",
      taxResidencyCountry: profile?.taxResidencyCountry || "",
      fatcaStatus: profile?.fatcaStatus || "non_us_person",
      fatcaTinNumber: profile?.fatcaTinNumber || "",
      pepStatus: profile?.pepStatus || "no",
      pepDetails: profile?.pepDetails || "",
      nomineeDetails: profile?.nomineeDetails || "",
      nomineeRelation: profile?.nomineeRelation || "",
      kycConsent: false,
      fatcaDeclaration: false,
      investmentRiskConsent: false,
      termsConditions: false
    },
  });

  // Update pan verified name when data is available
  useEffect(() => {
    if (panNameData && typeof panNameData === 'object' && 'success' in panNameData && 'verifiedName' in panNameData) {
      if (panNameData.success && panNameData.verifiedName) {
        setPanVerifiedName(panNameData.verifiedName as string);
      }
    }
  }, [panNameData]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("POST", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({
        title: "Profile updated successfully",
        description: "Your profile information has been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto py-8 max-w-6xl" data-testid="profile-page">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2" data-testid="profile-title">
              Client Onboarding & KYC
            </h1>
            {panVerifiedName && (
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-xl font-semibold text-gray-900 dark:text-white">
                  {panVerifiedName}
                </span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Shield className="h-3 w-3 mr-1" />
                  Identity Verified
                </Badge>
              </div>
            )}
            <p className="text-gray-600 dark:text-gray-400 text-lg" data-testid="profile-description">
              Complete your regulatory compliance and KYC verification for seamless investment services
            </p>
          </div>
          
          {profile?.panNumber && (
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">PAN: {profile.panNumber}</span>
              </div>
              {panVerifiedName ? (
                <Badge className="bg-green-100 text-green-800 border border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified Identity
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pending Verification
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-8" data-testid="profile-tabs">
        {[
          { key: "overview", label: "KYC Overview", icon: Award },
          { key: "personal", label: "Personal Info", icon: User },
          { key: "financial", label: "Financial Profile", icon: Banknote },
          { key: "compliance", label: "Compliance", icon: Shield },
          { key: "documents", label: "Documents", icon: FileText },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
            data-testid={`tab-${key}`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {/* KYC Overview Dashboard */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KYC Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-900 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Mutual Fund KYC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant={kycStatusData?.mutualFundKyc === 'completed' ? 'default' : 'secondary'}
                      className={kycStatusData?.mutualFundKyc === 'completed' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {kycStatusData?.mutualFundKyc === 'completed' ? 'Completed' : 
                       kycStatusData?.mutualFundKyc === 'in_progress' ? 'In Progress' :
                       kycStatusData?.mutualFundKyc === 'rejected' ? 'Rejected' : 'Pending'}
                    </Badge>
                    {kycStatusData?.mutualFundKyc === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Required for mutual fund investments</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-purple-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Broking KYC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant={kycStatusData?.brokingKyc === 'completed' ? 'default' : 'secondary'}
                      className={kycStatusData?.brokingKyc === 'completed' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {kycStatusData?.brokingKyc === 'completed' ? 'Completed' : 
                       kycStatusData?.brokingKyc === 'in_progress' ? 'In Progress' :
                       kycStatusData?.brokingKyc === 'rejected' ? 'Rejected' : 'Pending'}
                    </Badge>
                    {kycStatusData?.brokingKyc === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Required for equity trading</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-green-900 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    KRA CKYC
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-2">
                    <Badge 
                      variant={kycStatusData?.kraKyc === 'completed' ? 'default' : 'secondary'}
                      className={kycStatusData?.kraKyc === 'completed' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {kycStatusData?.kraKyc === 'completed' ? 'Completed' : 
                       kycStatusData?.kraKyc === 'in_progress' ? 'In Progress' :
                       kycStatusData?.kraKyc === 'rejected' ? 'Rejected' : 'Pending'}
                    </Badge>
                    {kycStatusData?.kraKyc === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">Centralized KYC verification</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Overall Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-600" />
                  KYC Completion Progress
                </CardTitle>
                <CardDescription>
                  Complete your KYC verification to access all investment services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Overall Progress</span>
                    <span className="font-semibold">{kycStatusData?.completionPercentage || 0}%</span>
                  </div>
                  <Progress value={kycStatusData?.completionPercentage || 0} className="h-3" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Completed Steps
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      {panVerifiedName && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          PAN Verification
                        </li>
                      )}
                      {kycStatusData?.mutualFundKyc === 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Mutual Fund KYC
                        </li>
                      )}
                      {kycStatusData?.brokingKyc === 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Broking KYC
                        </li>
                      )}
                      {kycStatusData?.kraKyc === 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          KRA CKYC
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      Pending Actions
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      {!panVerifiedName && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Complete PAN Verification
                        </li>
                      )}
                      {kycStatusData?.mutualFundKyc !== 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Submit Mutual Fund KYC
                        </li>
                      )}
                      {kycStatusData?.brokingKyc !== 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Complete Broking KYC
                        </li>
                      )}
                      {kycStatusData?.kraKyc !== 'completed' && (
                        <li className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                          Verify KRA CKYC
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                
                {kycStatusData?.lastUpdated && (
                  <div className="text-xs text-gray-500 mt-4">
                    Last updated: {new Date(kycStatusData.lastUpdated).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Complete these actions to expedite your KYC verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab("personal")}
                  >
                    <User className="h-6 w-6" />
                    <span className="text-sm">Update Profile</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab("documents")}
                  >
                    <FileText className="h-6 w-6" />
                    <span className="text-sm">Upload Documents</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab("financial")}
                  >
                    <Banknote className="h-6 w-6" />
                    <span className="text-sm">Financial Info</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab("compliance")}
                  >
                    <Shield className="h-6 w-6" />
                    <span className="text-sm">Compliance</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            {activeTab === "personal" && (
            <Card data-testid="personal-info-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </CardTitle>
                <CardDescription>
                  Basic information used for account identification and communication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {panVerifiedName && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-semibold text-green-800 dark:text-green-200">PAN Verified Name</span>
                    </div>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mb-1">
                      {panVerifiedName}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      This name is verified against your PAN card records and will be used for all official communications.
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your first name" {...field} data-testid="input-first-name" />
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
                          <Input placeholder="Middle name (optional)" {...field} data-testid="input-middle-name" />
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
                          <Input placeholder="Enter your last name" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="your.email@example.com" {...field} data-testid="input-email" />
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
                          <Input placeholder="+91 XXXXX XXXXX" {...field} data-testid="input-mobile" />
                        </FormControl>
                        <FormDescription>Used for account security and notifications</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date-of-birth" />
                        </FormControl>
                        <FormDescription>Required for investment compliance</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Demographic Information
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger data-testid="select-gender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
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
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger data-testid="select-marital-status">
                                <SelectValue placeholder="Select marital status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="single">Single</SelectItem>
                                <SelectItem value="married">Married</SelectItem>
                                <SelectItem value="divorced">Divorced</SelectItem>
                                <SelectItem value="widowed">Widowed</SelectItem>
                                <SelectItem value="separated">Separated</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {form.watch('maritalStatus') === 'married' && (
                    <FormField
                      control={form.control}
                      name="spouseName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Spouse Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter spouse's full name" {...field} data-testid="input-spouse-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Family Details
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fatherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Father's Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter father's full name" {...field} data-testid="input-father-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="motherName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mother's Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter mother's full name" {...field} data-testid="input-mother-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Address Information
                  </h4>
                  
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100">Present Address</h5>
                      
                      <FormField
                        control={form.control}
                        name="presentAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Present Address *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter your current residential address"
                                {...field}
                                data-testid="input-present-address"
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField
                          control={form.control}
                          name="presentCity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City *</FormLabel>
                              <FormControl>
                                <Input placeholder="City" {...field} data-testid="input-present-city" />
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
                              <FormLabel>State *</FormLabel>
                              <FormControl>
                                <Input placeholder="State" {...field} data-testid="input-present-state" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="presentPincode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>PIN Code *</FormLabel>
                              <FormControl>
                                <Input placeholder="PIN Code" {...field} data-testid="input-present-pincode" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <FormField
                        control={form.control}
                        name="isAddressSame"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-same-address"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Permanent address is same as present address</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    {!form.watch('isAddressSame') && (
                      <div className="space-y-4">
                        <h5 className="font-semibold text-gray-900 dark:text-gray-100">Permanent Address</h5>
                        
                        <FormField
                          control={form.control}
                          name="permanentAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Permanent Address *</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Enter your permanent address"
                                  {...field}
                                  data-testid="input-permanent-address"
                                  rows={3}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <FormField
                            control={form.control}
                            name="permanentCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City *</FormLabel>
                                <FormControl>
                                  <Input placeholder="City" {...field} data-testid="input-permanent-city" />
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
                                <FormLabel>State *</FormLabel>
                                <FormControl>
                                  <Input placeholder="State" {...field} data-testid="input-permanent-state" />
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
                                <FormLabel>PIN Code *</FormLabel>
                                <FormControl>
                                  <Input placeholder="PIN Code" {...field} data-testid="input-permanent-pincode" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financial Profile */}
          {activeTab === "financial" && (
            <Card data-testid="investment-profile-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Investment Profile</span>
                </CardTitle>
                <CardDescription>
                  Help us personalize your portfolio recommendations based on your investment profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="riskTolerance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Risk Tolerance</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-risk-tolerance">
                              <SelectValue placeholder="Select your risk tolerance" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="conservative">Conservative - Low risk, stable returns</SelectItem>
                            <SelectItem value="moderate">Moderate - Balanced risk and returns</SelectItem>
                            <SelectItem value="aggressive">Aggressive - High risk, high returns</SelectItem>
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
                        <FormLabel>Investment Experience</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-investment-experience">
                              <SelectValue placeholder="Select your experience level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner - New to investing</SelectItem>
                            <SelectItem value="intermediate">Intermediate - Some experience</SelectItem>
                            <SelectItem value="experienced">Experienced - Well versed in markets</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="investmentHorizon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Investment Horizon</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-investment-horizon">
                              <SelectValue placeholder="Select your investment timeline" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="short">Short term - Less than 3 years</SelectItem>
                            <SelectItem value="medium">Medium term - 3-10 years</SelectItem>
                            <SelectItem value="long">Long term - More than 10 years</SelectItem>
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
                        <FormLabel>Annual Income</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 5,00,000"
                            {...field}
                            data-testid="input-annual-income"
                          />
                        </FormControl>
                        <FormDescription>Your yearly income in rupees</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occupation</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Software Engineer" {...field} data-testid="input-occupation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sourceOfWealth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source of Wealth</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Employment, Business, Investment" {...field} data-testid="input-source-wealth" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance */}
          {activeTab === "compliance" && (
            <Card data-testid="kyc-integration-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>KYC & Identity Verification</span>
                </CardTitle>
                <CardDescription>
                  Complete your KYC verification for regulatory compliance and enhanced services
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Identity Verification</h3>
                  <FormField
                    control={form.control}
                    name="panNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PAN Number</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ABCDE1234F"
                            className="uppercase"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-pan-number"
                          />
                        </FormControl>
                        <FormDescription>Required for KYC compliance and investment services</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {panVerifiedName && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 mt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-800 dark:text-green-200">PAN Verification Status</span>
                      </div>
                      <p className="text-lg font-bold text-green-900 dark:text-green-100 mb-1">
                        Verified Name: {panVerifiedName}
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Your identity has been successfully verified with the Income Tax Department.
                      </p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Demat Account Information</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Add your demat account details to fetch real holdings data from your broker
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note:</strong> This feature will be available soon. We're working on integrations with major brokers
                      to fetch your actual holdings and portfolio data.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance */}
          {activeTab === "compliance" && (
            <Card data-testid="preferences-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Regulatory Compliance</span>
                </CardTitle>
                <CardDescription>
                  Mandatory regulatory information for investment services compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    FATCA & CRS Declaration
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fatcaStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>FATCA Status</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger data-testid="select-fatca-status">
                                <SelectValue placeholder="Select FATCA status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="us_person">US Person</SelectItem>
                                <SelectItem value="non_us_person">Non-US Person</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription>Required for US tax compliance</FormDescription>
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
                          <FormControl>
                            <Input placeholder="e.g., India" {...field} data-testid="input-tax-country" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {form.watch('fatcaStatus') === 'us_person' && (
                    <FormField
                      control={form.control}
                      name="fatcaTinNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>US TIN Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter US Tax Identification Number" {...field} data-testid="input-tin" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    PEP Declaration
                  </h4>
                  
                  <FormField
                    control={form.control}
                    name="pepStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Are you a Politically Exposed Person (PEP)? *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger data-testid="select-pep-status">
                              <SelectValue placeholder="Select PEP status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          PEP includes senior government officials, their family members, and close associates
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {form.watch('pepStatus') === 'yes' && (
                    <FormField
                      control={form.control}
                      name="pepDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PEP Details</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Please provide details about your political exposure" 
                              {...field} 
                              data-testid="input-pep-details"
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Consent & Declarations
                  </h4>
                  
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="kycConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-kyc-consent"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              I consent to KYC verification and data processing *
                            </FormLabel>
                            <FormDescription>
                              I authorize the collection and verification of my identity documents for regulatory compliance.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="fatcaDeclaration"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-fatca-declaration"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              I confirm the accuracy of FATCA declaration *
                            </FormLabel>
                            <FormDescription>
                              I declare that the information provided for FATCA compliance is true and accurate.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="investmentRiskConsent"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-risk-consent"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm font-normal">
                              I understand investment risks *
                            </FormLabel>
                            <FormDescription>
                              I acknowledge that investments are subject to market risks and may lose value.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="termsConditions"
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
                            <FormLabel className="text-sm font-normal">
                              I agree to Terms & Conditions *
                            </FormLabel>
                            <FormDescription>
                              I have read and agree to the platform's terms of service and privacy policy.
                            </FormDescription>
                            <FormMessage />
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-6" data-testid="save-section">
            <Button
              type="submit"
              className="px-8"
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </Form>
      </div>
      </div>
    </div>
  );
}