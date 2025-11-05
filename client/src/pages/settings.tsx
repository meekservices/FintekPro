import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Link as LinkIcon,
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Check,
  TrendingUp
} from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductAccountPreferences } from "@/components/ProductAccountPreferences";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RebalancingPreferences } from "@shared/schema";

const accountFormSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  language: z.string(),
  timezone: z.string(),
});

const securityFormSchema = z.object({
  currentPassword: z.string().min(8, "Password must be at least 8 characters"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const rebalancePreferencesSchema = z.object({
  toleranceThreshold: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 100;
  }, "Must be between 0 and 100"),
  minimumTransactionAmount: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Must be a positive number"),
  transactionCostPercentage: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 10;
  }, "Must be between 0 and 10"),
  autoRebalanceEnabled: z.boolean(),
  rebalanceFrequency: z.string(),
  notifyOnDrift: z.boolean(),
});

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(true);
  const [portfolioUpdates, setPortfolioUpdates] = useState(true);
  const [newsAlerts, setNewsAlerts] = useState(false);
  
  // OTP Delivery Preferences
  const [otpEmail, setOtpEmail] = useState(user?.otpPreferenceEmail ?? true);
  const [otpSms, setOtpSms] = useState(user?.otpPreferenceSms ?? false);
  const [otpWhatsapp, setOtpWhatsapp] = useState(user?.otpPreferenceWhatsapp ?? true);

  const accountForm = useForm<z.infer<typeof accountFormSchema>>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.mobile || "",
      language: "en",
      timezone: "Asia/Kolkata",
    },
  });

  const securityForm = useForm<z.infer<typeof securityFormSchema>>({
    resolver: zodResolver(securityFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Query rebalancing preferences
  const { data: rebalancePrefs, isLoading: isLoadingPrefs } = useQuery<RebalancingPreferences>({
    queryKey: ["/api/user/rebalance-preferences"],
    enabled: !!user?.id,
  });

  const rebalancePreferencesForm = useForm<z.infer<typeof rebalancePreferencesSchema>>({
    resolver: zodResolver(rebalancePreferencesSchema),
    defaultValues: {
      toleranceThreshold: rebalancePrefs?.toleranceThreshold?.toString() || "5.00",
      minimumTransactionAmount: rebalancePrefs?.minimumTransactionAmount?.toString() || "1000.00",
      transactionCostPercentage: rebalancePrefs?.transactionCostPercentage?.toString() || "0.10",
      autoRebalanceEnabled: rebalancePrefs?.autoRebalanceEnabled ?? false,
      rebalanceFrequency: rebalancePrefs?.rebalanceFrequency || "quarterly",
      notifyOnDrift: rebalancePrefs?.notifyOnDrift ?? true,
    },
    values: rebalancePrefs ? {
      toleranceThreshold: rebalancePrefs.toleranceThreshold?.toString() || "5.00",
      minimumTransactionAmount: rebalancePrefs.minimumTransactionAmount?.toString() || "1000.00",
      transactionCostPercentage: rebalancePrefs.transactionCostPercentage?.toString() || "0.10",
      autoRebalanceEnabled: rebalancePrefs.autoRebalanceEnabled ?? false,
      rebalanceFrequency: rebalancePrefs.rebalanceFrequency || "quarterly",
      notifyOnDrift: rebalancePrefs.notifyOnDrift ?? true,
    } : undefined,
  });

  const saveOtpPreferencesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/user/otp-preferences", {
        body: {
          otpPreferenceEmail: otpEmail,
          otpPreferenceSms: otpSms,
          otpPreferenceWhatsapp: otpWhatsapp,
        }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "OTP Preferences Updated",
        description: "Your OTP delivery preferences have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save preferences",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveRebalancePreferencesMutation = useMutation({
    mutationFn: async (data: z.infer<typeof rebalancePreferencesSchema>) => {
      const response = await apiRequest("POST", "/api/user/rebalance-preferences", {
        body: {
          userId: user?.id,
          toleranceThreshold: data.toleranceThreshold.toString(),
          minimumTransactionAmount: data.minimumTransactionAmount.toString(),
          transactionCostPercentage: data.transactionCostPercentage.toString(),
          autoRebalanceEnabled: data.autoRebalanceEnabled,
          rebalanceFrequency: data.rebalanceFrequency,
          notifyOnDrift: data.notifyOnDrift,
        }
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/rebalance-preferences"] });
      toast({
        title: "Rebalancing Preferences Updated",
        description: "Your portfolio rebalancing settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save preferences",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onAccountSubmit = (values: z.infer<typeof accountFormSchema>) => {
    toast({
      title: "Account Updated",
      description: "Your account settings have been saved successfully.",
    });
  };

  const onSecuritySubmit = (values: z.infer<typeof securityFormSchema>) => {
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully.",
    });
    securityForm.reset();
  };

  const onRebalancePreferencesSubmit = (values: z.infer<typeof rebalancePreferencesSchema>) => {
    saveRebalancePreferencesMutation.mutate(values);
  };
  
  const handleSaveNotifications = () => {
    // Save OTP preferences
    saveOtpPreferencesMutation.mutate();
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold" data-testid="settings-title">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your account settings, notifications, security, and connected services
        </p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <ScrollableTabsList>
          <TabsTrigger value="account" data-testid="tab-account">
            <User className="h-4 w-4 mr-2" />
            Account Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">
            <Shield className="h-4 w-4 mr-2" />
            Security & Privacy
          </TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <LinkIcon className="h-4 w-4 mr-2" />
            Connected Accounts
          </TabsTrigger>
          <TabsTrigger value="product-preferences" data-testid="tab-product-preferences">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Product Accounts
          </TabsTrigger>
          <TabsTrigger value="rebalancing" data-testid="tab-rebalancing">
            <TrendingUp className="h-4 w-4 mr-2" />
            Portfolio Rebalancing
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Account Settings Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...accountForm}>
                <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={accountForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={accountForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={accountForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormDescription>This email will be used for account notifications</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={accountForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={accountForm.control}
                      name="language"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Language</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-language">
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="en">English</SelectItem>
                              <SelectItem value="hi">Hindi</SelectItem>
                              <SelectItem value="mr">Marathi</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={accountForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timezone</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timezone">
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                              <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                              <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" data-testid="button-save-account">
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Notification Channels</h3>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive updates via email</p>
                    </div>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} data-testid="switch-email" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS Notifications</p>
                      <p className="text-sm text-muted-foreground">Receive text messages</p>
                    </div>
                  </div>
                  <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} data-testid="switch-sms" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Browser and app notifications</p>
                    </div>
                  </div>
                  <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} data-testid="switch-push" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">OTP Delivery Preferences</h3>
                <p className="text-sm text-muted-foreground">Choose how you want to receive verification codes (OTP) for login and transactions</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email OTP</p>
                      <p className="text-sm text-muted-foreground">Receive verification codes via email</p>
                    </div>
                  </div>
                  <Switch checked={otpEmail} onCheckedChange={setOtpEmail} data-testid="switch-otp-email" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">SMS OTP</p>
                      <p className="text-sm text-muted-foreground">Receive verification codes via SMS</p>
                    </div>
                  </div>
                  <Switch checked={otpSms} onCheckedChange={setOtpSms} data-testid="switch-otp-sms" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">WhatsApp OTP</p>
                      <p className="text-sm text-muted-foreground">Receive verification codes via WhatsApp</p>
                    </div>
                  </div>
                  <Switch checked={otpWhatsapp} onCheckedChange={setOtpWhatsapp} data-testid="switch-otp-whatsapp" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t">
                <h3 className="text-lg font-semibold">Alert Types</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Market Alerts</p>
                    <p className="text-sm text-muted-foreground">Price movements and market events</p>
                  </div>
                  <Switch checked={marketAlerts} onCheckedChange={setMarketAlerts} data-testid="switch-market" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Portfolio Updates</p>
                    <p className="text-sm text-muted-foreground">Holdings and performance changes</p>
                  </div>
                  <Switch checked={portfolioUpdates} onCheckedChange={setPortfolioUpdates} data-testid="switch-portfolio" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">News Alerts</p>
                    <p className="text-sm text-muted-foreground">Financial news and updates</p>
                  </div>
                  <Switch checked={newsAlerts} onCheckedChange={setNewsAlerts} data-testid="switch-news" />
                </div>
              </div>

              <Button 
                onClick={handleSaveNotifications}
                disabled={saveOtpPreferencesMutation.isPending}
                data-testid="button-save-notifications"
              >
                <Check className="h-4 w-4 mr-2" />
                {saveOtpPreferencesMutation.isPending ? "Saving..." : "Save Notification Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...securityForm}>
                <form onSubmit={securityForm.handleSubmit(onSecuritySubmit)} className="space-y-6">
                  <FormField
                    control={securityForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              {...field} 
                              data-testid="input-current-password" 
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={securityForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={securityForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm New Password</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} data-testid="input-confirm-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" data-testid="button-change-password">
                    <Lock className="h-4 w-4 mr-2" />
                    Change Password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable 2FA</p>
                  <p className="text-sm text-muted-foreground">Require authentication code in addition to password</p>
                </div>
                <Switch checked={twoFactorEnabled} onCheckedChange={setTwoFactorEnabled} data-testid="switch-2fa" />
              </div>
              {twoFactorEnabled && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm">Setup instructions will be sent to your registered email</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible account actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" data-testid="button-delete-account">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                This action cannot be undone. All your data will be permanently deleted.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connected Accounts Tab */}
        <TabsContent value="connections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>Manage your linked bank accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">HDFC Bank ****1234</p>
                    <p className="text-sm text-muted-foreground">Linked 3 months ago</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-remove-hdfc">Remove</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">ICICI Bank ****5678</p>
                    <p className="text-sm text-muted-foreground">Linked 1 month ago</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-remove-icici">Remove</Button>
              </div>

              <Button variant="outline" className="w-full" data-testid="button-add-bank">
                <LinkIcon className="h-4 w-4 mr-2" />
                Link New Bank Account
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demat Accounts</CardTitle>
              <CardDescription>Connected demat and trading accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <LinkIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Zerodha - DP12345678</p>
                    <p className="text-sm text-muted-foreground">Active</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-remove-zerodha">Remove</Button>
              </div>

              <Button variant="outline" className="w-full" data-testid="button-add-demat">
                <LinkIcon className="h-4 w-4 mr-2" />
                Link Demat Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Product Account Preferences Tab */}
        <TabsContent value="product-preferences" className="space-y-6">
          <ProductAccountPreferences />
        </TabsContent>

        {/* Portfolio Rebalancing Tab */}
        <TabsContent value="rebalancing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Rebalancing Preferences</CardTitle>
              <CardDescription>
                Customize your portfolio rebalancing strategy and automation settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPrefs ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Loading preferences...</p>
                </div>
              ) : (
                <Form {...rebalancePreferencesForm}>
                  <form onSubmit={rebalancePreferencesForm.handleSubmit(onRebalancePreferencesSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="toleranceThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tolerance Threshold (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="5.00" 
                                {...field} 
                                data-testid="input-tolerance-threshold" 
                              />
                            </FormControl>
                            <FormDescription>
                              Maximum percentage deviation allowed before triggering rebalance alert
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="minimumTransactionAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Transaction Amount (₹)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="100" 
                                placeholder="1000.00" 
                                {...field} 
                                data-testid="input-min-transaction" 
                              />
                            </FormControl>
                            <FormDescription>
                              Skip transactions below this amount to reduce costs
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="transactionCostPercentage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transaction Cost (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                placeholder="0.10" 
                                {...field} 
                                data-testid="input-transaction-cost" 
                              />
                            </FormControl>
                            <FormDescription>
                              Expected transaction cost as percentage of amount
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="rebalanceFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rebalancing Frequency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-rebalance-frequency">
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="semi_annually">Semi-Annually</SelectItem>
                                <SelectItem value="annually">Annually</SelectItem>
                                <SelectItem value="manual">Manual Only</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              How often to check for rebalancing opportunities
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold">Automation Settings</h3>
                      
                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="autoRebalanceEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Auto-Rebalance
                              </FormLabel>
                              <FormDescription>
                                Automatically execute rebalancing when conditions are met
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-auto-rebalance"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={rebalancePreferencesForm.control}
                        name="notifyOnDrift"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Drift Notifications
                              </FormLabel>
                              <FormDescription>
                                Receive alerts when portfolio drifts beyond tolerance threshold
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-notify-drift"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      disabled={saveRebalancePreferencesMutation.isPending}
                      data-testid="button-save-rebalancing"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {saveRebalancePreferencesMutation.isPending ? "Saving..." : "Save Rebalancing Preferences"}
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
