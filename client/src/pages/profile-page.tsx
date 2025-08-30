import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { User, Shield, CreditCard, Building, TrendingUp, Database, FileText, Eye, Phone, Mail, Users, Link, Info } from "lucide-react";

const profileSchema = z.object({
  // Enhanced KYC Fields
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional().or(z.literal("")),
  aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhaar must be 12 digits").optional().or(z.literal("")),
  passportNumber: z.string().optional(),
  drivingLicense: z.string().optional(),
  voterIdNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseName: z.string().optional(),
  maritalStatus: z.string().optional(),
  // Address Information
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be 6 digits").optional().or(z.literal("")),
  country: z.string().optional(),
  // Financial Information
  occupation: z.string().optional(),
  annualIncome: z.string().optional(),
  investmentExperience: z.string().optional(),
  riskTolerance: z.string().optional(),
  // Additional KYC for API Integration
  bankAccountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  nomineeDetails: z.string().optional(),
  nomineeRelation: z.string().optional(),
  // EUIN and API Integration
  euinNumber: z.string().optional(),
  enableCamsApi: z.boolean().optional(),
  enableKfintechApi: z.boolean().optional(),
  enableNsdlApi: z.boolean().optional(),
  enableCdslApi: z.boolean().optional(),
  // Registry Preferences
  preferredCamsRegistration: z.boolean().optional(),
  preferredKfintechRegistration: z.boolean().optional(),
  preferredNsdlRegistration: z.boolean().optional(),
  preferredCdslRegistration: z.boolean().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

type ProfileData = {
  // Enhanced KYC Fields
  panNumber?: string | null;
  aadharNumber?: string | null;
  passportNumber?: string | null;
  drivingLicense?: string | null;
  voterIdNumber?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  maritalStatus?: string | null;
  // Address Information
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  // Financial Information
  occupation?: string | null;
  annualIncome?: string | null;
  investmentExperience?: string | null;
  riskTolerance?: string | null;
  // Additional KYC for API Integration
  bankAccountNumber?: string | null;
  ifscCode?: string | null;
  nomineeDetails?: string | null;
  nomineeRelation?: string | null;
  // Registry Preferences
  preferredCamsRegistration?: boolean | null;
  preferredKfintechRegistration?: boolean | null;
  preferredNsdlRegistration?: boolean | null;
  preferredCdslRegistration?: boolean | null;
};

const states = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"
];

const maritalStatuses = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated"
];

const nationalities = [
  "Indian",
  "American",
  "British",
  "Canadian",
  "Australian",
  "Other"
];

const nomineeRelations = [
  "Father",
  "Mother",
  "Spouse",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Other"
];

const incomeRanges = [
  "Below ₹2.5 Lakh",
  "₹2.5 - ₹5 Lakh",
  "₹5 - ₹10 Lakh",
  "₹10 - ₹25 Lakh",
  "₹25 - ₹50 Lakh",
  "Above ₹50 Lakh"
];

const experienceLevels = [
  "Beginner (0-1 years)",
  "Intermediate (1-3 years)",
  "Experienced (3-5 years)",
  "Expert (5+ years)"
];

const riskTolerances = [
  "Conservative",
  "Moderate",
  "Aggressive"
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      // Enhanced KYC Fields
      panNumber: "",
      aadharNumber: "",
      passportNumber: "",
      drivingLicense: "",
      voterIdNumber: "",
      dateOfBirth: "",
      nationality: "",
      fatherName: "",
      motherName: "",
      spouseName: "",
      maritalStatus: "",
      // Address Information
      address: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      // Financial Information
      occupation: "",
      annualIncome: "",
      investmentExperience: "",
      riskTolerance: "",
      // Additional KYC for API Integration
      bankAccountNumber: "",
      ifscCode: "",
      nomineeDetails: "",
      nomineeRelation: "",
      // Registry Preferences
      preferredCamsRegistration: false,
      preferredKfintechRegistration: false,
      preferredNsdlRegistration: false,
      preferredCdslRegistration: false,
    }
  });

  useEffect(() => {
    if (profileData) {
      form.reset({
        // Enhanced KYC Fields
        panNumber: profileData.panNumber || "",
        aadharNumber: profileData.aadharNumber || "",
        passportNumber: profileData.passportNumber || "",
        drivingLicense: profileData.drivingLicense || "",
        voterIdNumber: profileData.voterIdNumber || "",
        dateOfBirth: profileData.dateOfBirth || "",
        nationality: profileData.nationality || "",
        fatherName: profileData.fatherName || "",
        motherName: profileData.motherName || "",
        spouseName: profileData.spouseName || "",
        maritalStatus: profileData.maritalStatus || "",
        // Address Information
        address: profileData.address || "",
        city: profileData.city || "",
        state: profileData.state || "",
        pincode: profileData.pincode || "",
        country: profileData.country || "India",
        // Financial Information
        occupation: profileData.occupation || "",
        annualIncome: profileData.annualIncome || "",
        investmentExperience: profileData.investmentExperience || "",
        riskTolerance: profileData.riskTolerance || "",
        // Additional KYC for API Integration
        bankAccountNumber: profileData.bankAccountNumber || "",
        ifscCode: profileData.ifscCode || "",
        nomineeDetails: profileData.nomineeDetails || "",
        nomineeRelation: profileData.nomineeRelation || "",
        // Registry Preferences
        preferredCamsRegistration: profileData.preferredCamsRegistration || false,
        preferredKfintechRegistration: profileData.preferredKfintechRegistration || false,
        preferredNsdlRegistration: profileData.preferredNsdlRegistration || false,
        preferredCdslRegistration: profileData.preferredCdslRegistration || false,
      });
    }
  }, [profileData, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("PUT", "/api/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile Settings</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Complete your profile to enable advanced portfolio features and API integrations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Overview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-lg">
                  {user?.firstName} {user?.middleName && user.middleName + ' '}{user?.lastName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.email || user?.mobile}
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  <span>KYC Status:</span>
                  <span className={`font-medium ${profileData?.panNumber ? 'text-green-600' : 'text-orange-600'}`}>
                    {profileData?.panNumber ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  <span>API Integration:</span>
                  <span className={`font-medium ${profileData?.panNumber ? 'text-green-600' : 'text-gray-600'}`}>
                    {profileData?.panNumber ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* KYC Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  KYC Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="panNumber">PAN Number *</Label>
                    <Input
                      id="panNumber"
                      {...form.register("panNumber")}
                      placeholder="ABCDE1234F"
                      disabled={!isEditing}
                      className="uppercase"
                      data-testid="input-pan-number"
                    />
                    {form.formState.errors.panNumber && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.panNumber.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="aadharNumber">Aadhaar Number *</Label>
                    <Input
                      id="aadharNumber"
                      {...form.register("aadharNumber")}
                      placeholder="123456789012"
                      disabled={!isEditing}
                      data-testid="input-aadhar-number"
                    />
                    {form.formState.errors.aadharNumber && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.aadharNumber.message}</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="passportNumber">Passport Number</Label>
                    <Input
                      id="passportNumber"
                      {...form.register("passportNumber")}
                      placeholder="A1234567"
                      disabled={!isEditing}
                      data-testid="input-passport-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="drivingLicense">Driving License</Label>
                    <Input
                      id="drivingLicense"
                      {...form.register("drivingLicense")}
                      placeholder="DL1420110012345"
                      disabled={!isEditing}
                      data-testid="input-driving-license"
                    />
                  </div>
                  <div>
                    <Label htmlFor="voterIdNumber">Voter ID Number</Label>
                    <Input
                      id="voterIdNumber"
                      {...form.register("voterIdNumber")}
                      placeholder="ABC1234567"
                      disabled={!isEditing}
                      data-testid="input-voter-id-number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      {...form.register("dateOfBirth")}
                      disabled={!isEditing}
                      data-testid="input-date-of-birth"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nationality">Nationality</Label>
                    <Select
                      value={form.watch("nationality")}
                      onValueChange={(value) => form.setValue("nationality", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-nationality">
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                      <SelectContent>
                        {nationalities.map((nationality) => (
                          <SelectItem key={nationality} value={nationality}>
                            {nationality}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <Select
                      value={form.watch("maritalStatus")}
                      onValueChange={(value) => form.setValue("maritalStatus", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-marital-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {maritalStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="fatherName">Father's Name</Label>
                    <Input
                      id="fatherName"
                      {...form.register("fatherName")}
                      placeholder="Father's full name"
                      disabled={!isEditing}
                      data-testid="input-father-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="motherName">Mother's Name</Label>
                    <Input
                      id="motherName"
                      {...form.register("motherName")}
                      placeholder="Mother's full name"
                      disabled={!isEditing}
                      data-testid="input-mother-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="spouseName">Spouse's Name</Label>
                    <Input
                      id="spouseName"
                      {...form.register("spouseName")}
                      placeholder="Spouse's full name"
                      disabled={!isEditing}
                      data-testid="input-spouse-name"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Address Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    {...form.register("address")}
                    placeholder="Complete address"
                    disabled={!isEditing}
                    rows={3}
                    data-testid="input-address"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...form.register("city")}
                      placeholder="City"
                      disabled={!isEditing}
                      data-testid="input-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Select
                      value={form.watch("state")}
                      onValueChange={(value) => form.setValue("state", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-state">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      {...form.register("pincode")}
                      placeholder="123456"
                      disabled={!isEditing}
                      data-testid="input-pincode"
                    />
                    {form.formState.errors.pincode && (
                      <p className="text-sm text-red-600 mt-1">{form.formState.errors.pincode.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      {...form.register("country")}
                      placeholder="India"
                      disabled={!isEditing}
                      data-testid="input-country"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Financial Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    {...form.register("occupation")}
                    placeholder="e.g., Software Engineer, Business Owner"
                    disabled={!isEditing}
                    data-testid="input-occupation"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="annualIncome">Annual Income</Label>
                    <Select
                      value={form.watch("annualIncome")}
                      onValueChange={(value) => form.setValue("annualIncome", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-annual-income">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeRanges.map((range) => (
                          <SelectItem key={range} value={range}>
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="euinNumber">EUIN Number (Mutual Fund Distributor Code)</Label>
                    <Input
                      id="euinNumber"
                      {...form.register("euinNumber")}
                      placeholder="E123456"
                      disabled={!isEditing}
                      className="uppercase"
                      data-testid="input-euin-number"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Employee Unique Identification Number (if advised by distributor)
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="investmentExperience">Investment Experience</Label>
                    <Select
                      value={form.watch("investmentExperience")}
                      onValueChange={(value) => form.setValue("investmentExperience", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-investment-experience">
                        <SelectValue placeholder="Select experience" />
                      </SelectTrigger>
                      <SelectContent>
                        {experienceLevels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="riskTolerance">Risk Tolerance</Label>
                    <Select
                      value={form.watch("riskTolerance")}
                      onValueChange={(value) => form.setValue("riskTolerance", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-risk-tolerance">
                        <SelectValue placeholder="Select tolerance" />
                      </SelectTrigger>
                      <SelectContent>
                        {riskTolerances.map((tolerance) => (
                          <SelectItem key={tolerance} value={tolerance}>
                            {tolerance}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* API Integration Information */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    API Integration Preferences
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enableCamsApi"
                          {...form.register("enableCamsApi")}
                          disabled={!isEditing}
                          data-testid="checkbox-enable-cams-api"
                        />
                        <Label htmlFor="enableCamsApi" className="text-sm cursor-pointer">
                          Enable CAMS API Integration
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enableKfintechApi"
                          {...form.register("enableKfintechApi")}
                          disabled={!isEditing}
                          data-testid="checkbox-enable-kfintech-api"
                        />
                        <Label htmlFor="enableKfintechApi" className="text-sm cursor-pointer">
                          Enable KFintech API Integration
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enableNsdlApi"
                          {...form.register("enableNsdlApi")}
                          disabled={!isEditing}
                          data-testid="checkbox-enable-nsdl-api"
                        />
                        <Label htmlFor="enableNsdlApi" className="text-sm cursor-pointer">
                          Enable NSDL API Integration
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="enableCdslApi"
                          {...form.register("enableCdslApi")}
                          disabled={!isEditing}
                          data-testid="checkbox-enable-cdsl-api"
                        />
                        <Label htmlFor="enableCdslApi" className="text-sm cursor-pointer">
                          Enable CDSL API Integration
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      <strong>Note:</strong> API integrations allow automatic synchronization of your portfolio data, 
                      transactions, and statements from respective registries. Enable only the services you use.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Banking & Nominee Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Banking & Nominee Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bankAccountNumber">Bank Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      {...form.register("bankAccountNumber")}
                      placeholder="Enter bank account number"
                      disabled={!isEditing}
                      data-testid="input-bank-account-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifscCode">IFSC Code</Label>
                    <Input
                      id="ifscCode"
                      {...form.register("ifscCode")}
                      placeholder="SBIN0001234"
                      disabled={!isEditing}
                      className="uppercase"
                      data-testid="input-ifsc-code"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomineeDetails">Nominee Details</Label>
                    <Textarea
                      id="nomineeDetails"
                      {...form.register("nomineeDetails")}
                      placeholder="Nominee full name and other details"
                      disabled={!isEditing}
                      rows={2}
                      data-testid="input-nominee-details"
                    />
                  </div>
                  <div>
                    <Label htmlFor="nomineeRelation">Nominee Relation</Label>
                    <Select
                      value={form.watch("nomineeRelation")}
                      onValueChange={(value) => form.setValue("nomineeRelation", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger data-testid="select-nominee-relation">
                        <SelectValue placeholder="Select relation" />
                      </SelectTrigger>
                      <SelectContent>
                        {nomineeRelations.map((relation) => (
                          <SelectItem key={relation} value={relation}>
                            {relation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Registry Integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Registry Integrations
                </CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose your preferred registries for mutual fund and demat account operations
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* CAMS Integration */}
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <input
                    type="checkbox"
                    id="preferredCamsRegistration"
                    {...form.register("preferredCamsRegistration")}
                    disabled={!isEditing}
                    className="mt-1"
                    data-testid="checkbox-cams-registration"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <Label htmlFor="preferredCamsRegistration" className="font-medium cursor-pointer">
                        CAMS (Computer Age Management Services)
                      </Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Leading registrar for mutual funds. Access portfolio, transactions, and SIP details.
                    </p>
                  </div>
                </div>

                {/* KFintech Integration */}
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <input
                    type="checkbox"
                    id="preferredKfintechRegistration"
                    {...form.register("preferredKfintechRegistration")}
                    disabled={!isEditing}
                    className="mt-1"
                    data-testid="checkbox-kfintech-registration"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <Label htmlFor="preferredKfintechRegistration" className="font-medium cursor-pointer">
                        KFintech (Karvy Fintech)
                      </Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Major registrar and transfer agent. Manage your mutual fund investments efficiently.
                    </p>
                  </div>
                </div>

                {/* NSDL Integration */}
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <input
                    type="checkbox"
                    id="preferredNsdlRegistration"
                    {...form.register("preferredNsdlRegistration")}
                    disabled={!isEditing}
                    className="mt-1"
                    data-testid="checkbox-nsdl-registration"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-purple-600" />
                      <Label htmlFor="preferredNsdlRegistration" className="font-medium cursor-pointer">
                        NSDL (National Securities Depository Limited)
                      </Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      India's first depository. Access demat holdings, pledge shares, and loan against securities.
                    </p>
                  </div>
                </div>

                {/* CDSL Integration */}
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <input
                    type="checkbox"
                    id="preferredCdslRegistration"
                    {...form.register("preferredCdslRegistration")}
                    disabled={!isEditing}
                    className="mt-1"
                    data-testid="checkbox-cdsl-registration"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-orange-600" />
                      <Label htmlFor="preferredCdslRegistration" className="font-medium cursor-pointer">
                        CDSL (Central Depository Services Limited)
                      </Label>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Leading depository service. Manage demat accounts, eDIS consent, and margin pledging.
                    </p>
                  </div>
                </div>

                {/* Registry Integration Note */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Registry Integration Status
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Your selected registries will be used for portfolio synchronization and transaction processing. 
                        Direct access to registry services is available through their official websites.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {!isEditing ? (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  data-testid="button-edit-profile"
                >
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    data-testid="button-save-profile"
                  >
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      form.reset();
                    }}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}