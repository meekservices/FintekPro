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
import { User, Shield, CreditCard, Building, TrendingUp } from "lucide-react";

const profileSchema = z.object({
  panNumber: z.string().optional(),
  aadharNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  occupation: z.string().optional(),
  annualIncome: z.string().optional(),
  investmentExperience: z.string().optional(),
  riskTolerance: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

type ProfileData = {
  panNumber?: string | null;
  aadharNumber?: string | null;
  dateOfBirth?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  occupation?: string | null;
  annualIncome?: string | null;
  investmentExperience?: string | null;
  riskTolerance?: string | null;
};

const states = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh"
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
      panNumber: "",
      aadharNumber: "",
      dateOfBirth: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      occupation: "",
      annualIncome: "",
      investmentExperience: "",
      riskTolerance: "",
    }
  });

  useEffect(() => {
    if (profileData) {
      form.reset({
        panNumber: profileData.panNumber || "",
        aadharNumber: profileData.aadharNumber || "",
        dateOfBirth: profileData.dateOfBirth || "",
        address: profileData.address || "",
        city: profileData.city || "",
        state: profileData.state || "",
        pincode: profileData.pincode || "",
        occupation: profileData.occupation || "",
        annualIncome: profileData.annualIncome || "",
        investmentExperience: profileData.investmentExperience || "",
        riskTolerance: profileData.riskTolerance || "",
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
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="panNumber">PAN Number</Label>
                    <Input
                      id="panNumber"
                      {...form.register("panNumber")}
                      placeholder="ABCDE1234F"
                      disabled={!isEditing}
                      className="uppercase"
                      data-testid="input-pan-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="aadharNumber">Aadhar Number</Label>
                    <Input
                      id="aadharNumber"
                      {...form.register("aadharNumber")}
                      placeholder="1234 5678 9012"
                      disabled={!isEditing}
                      data-testid="input-aadhar-number"
                    />
                  </div>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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