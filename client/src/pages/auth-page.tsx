import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Mail, Phone, Eye, EyeOff, Shield } from "lucide-react";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or mobile number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  loginType: z.enum(["email", "mobile"])
});

const registerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile number must be 10 digits").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
}).refine((data) => data.email || data.mobile, {
  message: "Either email or mobile number is required",
  path: ["email"]
});

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits")
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpType, setOtpType] = useState("");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      loginType: "email"
    }
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: ""
    }
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const endpoint = data.loginType === "email" ? "/api/login/email" : "/api/login/mobile";
      const payload = data.loginType === "email" 
        ? { email: data.identifier, password: data.password }
        : { mobile: data.identifier, password: data.password };
      
      const response = await apiRequest("POST", endpoint, payload);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await apiRequest("POST", "/api/register", {
        firstName: data.firstName,
        middleName: data.middleName,
        lastName: data.lastName,
        email: data.email || undefined,
        mobile: data.mobile || undefined,
        password: data.password
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({
        title: "Registration successful",
        description: "Welcome to FintekPro!",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async ({ identifier, type }: { identifier: string; type: string }) => {
      const response = await apiRequest("POST", "/api/otp/send", { identifier, type });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "OTP sent",
        description: "Check your phone for the verification code",
      });
      setShowOtpForm(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send OTP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: OtpFormData) => {
      const response = await apiRequest("POST", "/api/otp/verify", {
        identifier: otpIdentifier,
        type: otpType,
        otp: data.otp
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Mobile verified",
        description: "Your mobile number has been verified successfully",
      });
      setShowOtpForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Redirect if already authenticated
  if (!isAuthLoading && user) {
    navigate("/");
    return null;
  }

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const onOtpSubmit = (data: OtpFormData) => {
    verifyOtpMutation.mutate(data);
  };

  const sendOtp = (identifier: string, type: string) => {
    setOtpIdentifier(identifier);
    setOtpType(type);
    sendOtpMutation.mutate({ identifier, type });
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (showOtpForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Verify Mobile Number</CardTitle>
            <CardDescription>
              Enter the 6-digit OTP sent to {otpIdentifier}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  {...otpForm.register("otp")}
                  placeholder="123456"
                  className="text-center text-lg tracking-wider"
                  data-testid="input-otp"
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-sm text-red-600 mt-1">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={verifyOtpMutation.isPending}
                  data-testid="button-verify-otp"
                >
                  {verifyOtpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify OTP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => sendOtp(otpIdentifier, otpType)}
                  disabled={sendOtpMutation.isPending}
                  data-testid="button-resend-otp"
                >
                  Resend OTP
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowOtpForm(false)}
                  data-testid="button-back-to-auth"
                >
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Hero Section */}
          <div className="lg:pr-8">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to <span className="text-blue-600">FintekPro</span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
                Your comprehensive financial services platform for portfolio management, 
                market data tracking, and investment tools.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <Shield className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Secure Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Login with email or mobile number</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Mail className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Portfolio Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Track and manage your investments</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Phone className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Real-time Market Data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Live quotes and market insights</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Shield className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Investment Tools</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Advanced analytics and recommendations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Authentication Forms */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl">Get Started</CardTitle>
                <CardDescription>
                  Sign in to your account or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                    <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="loginType">Login with</Label>
                        <Tabs 
                          value={loginForm.watch("loginType")} 
                          onValueChange={(value) => loginForm.setValue("loginType", value as "email" | "mobile")}
                        >
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="email" data-testid="login-type-email">Email</TabsTrigger>
                            <TabsTrigger value="mobile" data-testid="login-type-mobile">Mobile</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>

                      <div>
                        <Label htmlFor="identifier">
                          {loginForm.watch("loginType") === "email" ? "Email Address" : "Mobile Number"}
                        </Label>
                        <Input
                          id="identifier"
                          {...loginForm.register("identifier")}
                          placeholder={loginForm.watch("loginType") === "email" ? "client@example.com" : "9876543210"}
                          type={loginForm.watch("loginType") === "email" ? "email" : "tel"}
                          data-testid="input-login-identifier"
                        />
                        {loginForm.formState.errors.identifier && (
                          <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.identifier.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            {...loginForm.register("password")}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            data-testid="input-login-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.password.message}</p>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Sign In
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register">
                    <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            {...registerForm.register("firstName")}
                            placeholder="John"
                            data-testid="input-first-name"
                          />
                          {registerForm.formState.errors.firstName && (
                            <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.firstName.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="middleName">Middle Name (Optional)</Label>
                          <Input
                            id="middleName"
                            {...registerForm.register("middleName")}
                            placeholder="Michael"
                            data-testid="input-middle-name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name (Optional)</Label>
                          <Input
                            id="lastName"
                            {...registerForm.register("lastName")}
                            placeholder="Doe"
                            data-testid="input-last-name"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="email">Email Address (Optional)</Label>
                        <Input
                          id="email"
                          {...registerForm.register("email")}
                          type="email"
                          placeholder="client@example.com"
                          data-testid="input-register-email"
                        />
                        {registerForm.formState.errors.email && (
                          <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.email.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="mobile">Mobile Number (Optional)</Label>
                        <div className="flex">
                          <Input
                            id="mobile"
                            {...registerForm.register("mobile")}
                            type="tel"
                            placeholder="9876543210"
                            className="flex-1"
                            data-testid="input-register-mobile"
                          />
                          {registerForm.watch("mobile") && (
                            <Button
                              type="button"
                              variant="outline"
                              className="ml-2"
                              onClick={() => sendOtp(registerForm.getValues("mobile"), "mobile")}
                              disabled={!registerForm.watch("mobile") || sendOtpMutation.isPending}
                              data-testid="button-send-mobile-otp"
                            >
                              {sendOtpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                            </Button>
                          )}
                        </div>
                        {registerForm.formState.errors.mobile && (
                          <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.mobile.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="registerPassword">Password</Label>
                        <div className="relative">
                          <Input
                            id="registerPassword"
                            {...registerForm.register("password")}
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a password"
                            data-testid="input-register-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-register-password"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        {registerForm.formState.errors.password && (
                          <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.password.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          {...registerForm.register("confirmPassword")}
                          type="password"
                          placeholder="Confirm your password"
                          data-testid="input-confirm-password"
                        />
                        {registerForm.formState.errors.confirmPassword && (
                          <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Account
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}