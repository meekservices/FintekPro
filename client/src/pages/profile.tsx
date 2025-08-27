import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertUserProfileSchema, type UserProfile } from "@shared/schema";
import { User, Settings, CreditCard, Target, TrendingUp, Building2 } from "lucide-react";

// Create a simplified form schema for the profile form
const profileFormSchema = z.object({
  clientId: z.string(),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").optional(),
  dateOfBirth: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN number format").optional().or(z.literal("")),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  investmentExperience: z.enum(["beginner", "intermediate", "experienced"]).optional(),
  investmentHorizon: z.enum(["short", "medium", "long"]).optional(),
  annualIncome: z.number().optional(),
  investmentGoals: z.array(z.string()).optional(),
  mutualFundDistributor: z.string().optional(),
  preferredCurrency: z.string().default("INR"),
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
  const [activeTab, setActiveTab] = useState<"personal" | "investment" | "api" | "preferences">("personal");

  const { data: profile, isLoading } = useQuery<UserProfile | undefined>({
    queryKey: ["/api/profile"],
    retry: false,
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      clientId: "demo-user-1", // Temporary demo client ID
      fullName: profile?.fullName || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      dateOfBirth: profile?.dateOfBirth || "",
      panNumber: profile?.panNumber || "",
      riskTolerance: profile?.riskTolerance as any || "moderate",
      investmentExperience: profile?.investmentExperience as any || "beginner",
      investmentHorizon: profile?.investmentHorizon as any || "medium",
      annualIncome: profile?.annualIncome ? parseFloat(profile.annualIncome.toString()) : undefined,
      investmentGoals: profile?.investmentGoals || [],
      mutualFundDistributor: profile?.mutualFundDistributor || "",
      preferredCurrency: profile?.preferredCurrency || "INR",
    },
  });

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
    <div className="container mx-auto py-8 max-w-6xl" data-testid="profile-page">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="profile-title">
          Client Profile
        </h1>
        <p className="text-gray-600 dark:text-gray-400" data-testid="profile-description">
          Manage your profile information and API integrations for personalized portfolio data
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-8" data-testid="profile-tabs">
        {[
          { key: "personal", label: "Personal Info", icon: User },
          { key: "investment", label: "Investment Profile", icon: TrendingUp },
          { key: "api", label: "API Integration", icon: Building2 },
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your full name" {...field} data-testid="input-full-name" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 XXXXX XXXXX" {...field} data-testid="input-phone" />
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
                        <FormLabel>Annual Income (₹)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 500000"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                            data-testid="input-annual-income"
                          />
                        </FormControl>
                        <FormDescription>Used to suggest appropriate investment amounts</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* API Integration */}
          {activeTab === "api" && (
            <Card data-testid="api-integration-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-5 w-5" />
                  <span>API Integration Data</span>
                </CardTitle>
                <CardDescription>
                  Connect your financial accounts to get real portfolio data instead of demo information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <FormDescription>Required for mutual fund and stock investments</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="mutualFundDistributor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mutual Fund Distributor Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., ARN-12345" {...field} data-testid="input-mf-distributor" />
                        </FormControl>
                        <FormDescription>Your mutual fund distributor's ARN code</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
  );
}