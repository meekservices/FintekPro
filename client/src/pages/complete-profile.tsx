import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, AlertCircle, User, MapPin, Banknote, Shield, FileText, Building } from "lucide-react";

// Form validation schema for mandatory profile completion
const profileSchema = z.object({
  // Basic Information
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  nationality: z.string().min(1, "Nationality is required"),
  
  // KYC Documents
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  aadharNumber: z.string().regex(/^[0-9]{12}$/, "Aadhar must be 12 digits"),
  
  // Address Information
  address: z.string().min(10, "Address must be at least 10 characters"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Pincode must be 6 digits"),
  country: z.string().default("India"),
  
  // Financial Information
  occupation: z.string().min(2, "Occupation is required"),
  annualIncome: z.string().min(1, "Annual income is required"),
  
  // Banking Information
  bankAccountNumber: z.string().min(8, "Bank account number is required"),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format"),
  
  // Compliance Declarations
  pepStatus: z.string().default("N"),
  fatcaStatus: z.string().default("N"),
  isUSPerson: z.boolean().default(false),
  
  // Consents
  dataProcessingConsent: z.boolean().refine((val) => val === true, "Data processing consent is required"),
  marketingConsent: z.boolean().default(false),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function CompleteProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [currentTab, setCurrentTab] = useState("basic");
  
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      nationality: "Indian",
      panNumber: "",
      aadharNumber: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      occupation: "",
      annualIncome: "",
      bankAccountNumber: "",
      ifscCode: "",
      pepStatus: "N",
      fatcaStatus: "N",
      isUSPerson: false,
      dataProcessingConsent: false,
      marketingConsent: false,
    },
  });

  // Calculate form completion percentage
  const watchedFields = form.watch();
  const totalFields = Object.keys(profileSchema.shape).length;
  const completedFields = Object.values(watchedFields).filter(value => 
    value !== "" && value !== undefined && value !== false
  ).length;
  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  const submitProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return apiRequest("/api/profile/complete", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          isProfileCompleted: true,
          profileCompletedAt: new Date().toISOString(),
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Completed Successfully!",
        description: "Your KYC profile has been completed. You now have full access to all features.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error Completing Profile",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    submitProfileMutation.mutate(data);
  };

  const tabs = [
    { id: "basic", label: "Basic Info", icon: User, fields: ["firstName", "lastName", "dateOfBirth", "gender", "nationality"] },
    { id: "kyc", label: "KYC Documents", icon: FileText, fields: ["panNumber", "aadharNumber"] },
    { id: "address", label: "Address", icon: MapPin, fields: ["address", "city", "state", "pincode", "country"] },
    { id: "financial", label: "Financial Info", icon: Banknote, fields: ["occupation", "annualIncome"] },
    { id: "banking", label: "Banking", icon: Building, fields: ["bankAccountNumber", "ifscCode"] },
    { id: "compliance", label: "Compliance", icon: Shield, fields: ["pepStatus", "fatcaStatus", "isUSPerson", "dataProcessingConsent"] },
  ];

  const getTabCompletion = (tabFields: string[]) => {
    const completedTabFields = tabFields.filter(field => {
      const value = watchedFields[field as keyof ProfileFormData];
      return value !== "" && value !== undefined && value !== false;
    }).length;
    return Math.round((completedTabFields / tabFields.length) * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8" data-testid="page-complete-profile">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-900">
              Complete Your KYC Profile
            </CardTitle>
            <CardDescription className="text-lg">
              Please fill in all required information to comply with financial regulations
            </CardDescription>
            
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-3" />
            </div>
          </CardHeader>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
              {/* Tab Navigation */}
              <TabsList className="grid w-full grid-cols-6">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const tabCompletion = getTabCompletion(tab.fields);
                  return (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id} 
                      className="flex flex-col items-center p-3"
                      data-testid={`tab-${tab.id}`}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-xs">{tab.label}</span>
                      <div className="w-full h-1 bg-gray-200 rounded mt-1">
                        <div 
                          className="h-full bg-blue-600 rounded transition-all duration-300"
                          style={{ width: `${tabCompletion}%` }}
                        />
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-date-of-birth" />
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
                          <FormLabel>Gender *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-gender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter nationality" {...field} data-testid="input-nationality" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* KYC Documents Tab */}
              <TabsContent value="kyc" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      KYC Documents
                    </CardTitle>
                    <CardDescription>
                      Provide your government-issued identification documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="panNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PAN Number *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="ABCDE1234F" 
                              {...field} 
                              style={{ textTransform: 'uppercase' }}
                              data-testid="input-pan-number"
                            />
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
                          <FormLabel>Aadhar Number *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="123456789012" 
                              {...field}
                              maxLength={12}
                              data-testid="input-aadhar-number"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <MapPin className="h-5 w-5 mr-2" />
                      Address Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address *</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter your full address" 
                              {...field}
                              rows={3}
                              data-testid="input-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter city" {...field} data-testid="input-city" />
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
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter state" {...field} data-testid="input-state" />
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
                            <FormLabel>Pincode *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="123456" 
                                {...field}
                                maxLength={6}
                                data-testid="input-pincode"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Financial Information Tab */}
              <TabsContent value="financial" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Banknote className="h-5 w-5 mr-2" />
                      Financial Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your occupation" {...field} data-testid="input-occupation" />
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-annual-income">
                                <SelectValue placeholder="Select annual income range" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="below_2_5_lakh">Below ₹2.5 Lakh</SelectItem>
                              <SelectItem value="2_5_to_5_lakh">₹2.5 - 5 Lakh</SelectItem>
                              <SelectItem value="5_to_10_lakh">₹5 - 10 Lakh</SelectItem>
                              <SelectItem value="10_to_25_lakh">₹10 - 25 Lakh</SelectItem>
                              <SelectItem value="25_to_50_lakh">₹25 - 50 Lakh</SelectItem>
                              <SelectItem value="above_50_lakh">Above ₹50 Lakh</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Banking Information Tab */}
              <TabsContent value="banking" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Banking Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Account Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter bank account number" {...field} data-testid="input-bank-account" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="ifscCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IFSC Code *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="ABCD0123456"
                              {...field}
                              style={{ textTransform: 'uppercase' }}
                              data-testid="input-ifsc-code"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Compliance Tab */}
              <TabsContent value="compliance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="h-5 w-5 mr-2" />
                      Compliance & Consents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="dataProcessingConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-data-processing-consent"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                Data Processing Consent * (Required)
                              </FormLabel>
                              <p className="text-xs text-gray-600">
                                I consent to the processing of my personal data for KYC compliance and regulatory requirements.
                              </p>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="marketingConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-marketing-consent"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-sm font-medium">
                                Marketing Communications (Optional)
                              </FormLabel>
                              <p className="text-xs text-gray-600">
                                I agree to receive marketing communications and product updates.
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">Final Step</h4>
                      <p className="text-sm text-blue-800">
                        After clicking "Complete Profile", your information will be securely stored and 
                        you will gain full access to all FintekPro features. This is a one-time process.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Navigation and Submit */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
                      if (currentIndex > 0) {
                        setCurrentTab(tabs[currentIndex - 1].id);
                      }
                    }}
                    disabled={tabs.findIndex(tab => tab.id === currentTab) === 0}
                    data-testid="button-previous"
                  >
                    Previous
                  </Button>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">
                      Step {tabs.findIndex(tab => tab.id === currentTab) + 1} of {tabs.length}
                    </p>
                    <div className="text-sm font-medium">
                      {completionPercentage}% Complete
                    </div>
                  </div>
                  
                  {tabs.findIndex(tab => tab.id === currentTab) === tabs.length - 1 ? (
                    <Button
                      type="submit"
                      disabled={submitProfileMutation.isPending || !form.formState.isValid}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-submit-profile"
                    >
                      {submitProfileMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Completing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Complete Profile
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        const currentIndex = tabs.findIndex(tab => tab.id === currentTab);
                        if (currentIndex < tabs.length - 1) {
                          setCurrentTab(tabs[currentIndex + 1].id);
                        }
                      }}
                      data-testid="button-next"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}