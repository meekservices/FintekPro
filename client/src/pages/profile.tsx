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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUserProfileSchema, type UserProfile } from "@shared/schema";
import { User, Settings, CreditCard, Target, TrendingUp, Building2, CheckCircle, Shield, AlertCircle } from "lucide-react";

// Create a simplified form schema for the profile form based on the users table schema
const profileFormSchema = z.object({
  clientId: z.string(),
  firstName: z.string().min(1, "First name is required").optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits").optional(),
  dateOfBirth: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format").optional().or(z.literal("")),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"]).optional(),
  annualIncome: z.string().optional(),
  occupation: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
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

export default function ProfilePage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"personal" | "investment" | "kyc" | "preferences">("personal");
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

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      clientId: "demo-user-1", // Temporary demo client ID
      firstName: profile?.firstName || "",
      middleName: profile?.middleName || "",
      lastName: profile?.lastName || "",
      email: profile?.email || "",
      mobile: profile?.mobile || "",
      dateOfBirth: profile?.dateOfBirth || "",
      panNumber: profile?.panNumber || "",
      riskTolerance: profile?.riskTolerance || "moderate",
      investmentExperience: profile?.investmentExperience || "beginner",
      annualIncome: profile?.annualIncome || "",
      occupation: profile?.occupation || "",
      address: profile?.address || "",
      city: profile?.city || "",
      state: profile?.state || "",
      pincode: profile?.pincode || "",
      country: profile?.country || "India",
    },
  });

  // Update pan verified name when data is available
  useEffect(() => {
    if (panNameData?.success && panNameData?.verifiedName) {
      setPanVerifiedName(panNameData.verifiedName);
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
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="profile-title">
              Client Profile
            </h1>
            {panVerifiedName && (
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {panVerifiedName}
                </span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  PAN Verified
                </Badge>
              </div>
            )}
            <p className="text-gray-600 dark:text-gray-400" data-testid="profile-description">
              Manage your profile information and API integrations for personalized portfolio data
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
          { key: "personal", label: "Personal Info", icon: User },
          { key: "investment", label: "Investment Profile", icon: TrendingUp },
          { key: "kyc", label: "KYC & Identity", icon: Shield },
          { key: "preferences", label: "Preferences", icon: Settings },
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 XXXXX XXXXX" {...field} data-testid="input-mobile" />
                        </FormControl>
                        <FormDescription>Used for account security and notifications</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date-of-birth" />
                        </FormControl>
                        <FormDescription>Required for investment compliance</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Investment Profile */}
          {activeTab === "investment" && (
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
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Mumbai" {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* KYC & Identity */}
          {activeTab === "kyc" && (
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

          {/* Preferences */}
          {activeTab === "preferences" && (
            <Card data-testid="preferences-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Platform Preferences</span>
                </CardTitle>
                <CardDescription>
                  Customize your platform experience and notification settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="preferredCurrency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Currency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-currency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="INR">INR (₹) - Indian Rupee</SelectItem>
                          <SelectItem value="USD">USD ($) - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR (€) - Euro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Notification Preferences</h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Notification settings will be available in the next version. You'll be able to configure
                      alerts for portfolio changes, market movements, and investment opportunities.
                    </p>
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
  );
}