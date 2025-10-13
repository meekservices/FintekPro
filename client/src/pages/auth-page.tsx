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
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Eye, EyeOff, Shield, TrendingUp, BarChart3, MessageSquare } from "lucide-react";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email, mobile, or User ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  mobile: z.string().regex(/^[0-9]{10}$/, "Mobile number must be exactly 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const otpVerificationSchema = z.object({
  identifier: z.string().min(1, "Identifier is required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or mobile number is required"),
});

const resetPasswordSchema = z.object({
  identifier: z.string().min(1, "Email or mobile number is required"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type OtpVerificationFormData = z.infer<typeof otpVerificationSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetPasswordStep, setResetPasswordStep] = useState<"request" | "reset">("request");
  const [resetIdentifier, setResetIdentifier] = useState("");
  
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [otpChannel, setOtpChannel] = useState<string>("");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    }
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      mobile: "",
      password: "",
      confirmPassword: ""
    }
  });

  const otpForm = useForm<OtpVerificationFormData>({
    resolver: zodResolver(otpVerificationSchema),
    defaultValues: {
      identifier: "",
      otp: "",
    }
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    }
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      identifier: "",
      otp: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/login", {
        body: {
          identifier: data.identifier,
          password: data.password
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.requiresOtp) {
        setLoginIdentifier(data.identifier || loginForm.getValues("identifier"));
        setOtpChannel(data.otpSentTo || "your registered email/mobile");
        otpForm.setValue("identifier", data.identifier || loginForm.getValues("identifier"));
        setOtpDialogOpen(true);
        toast({
          title: "OTP Sent",
          description: `Verification code sent to ${data.otpSentTo || "your registered email/mobile"}`,
        });
      } else {
        queryClient.setQueryData(["/api/user"], data);
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });
        navigate("/");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const otpVerificationMutation = useMutation({
    mutationFn: async (data: OtpVerificationFormData) => {
      const response = await apiRequest("POST", "/api/login/verify-otp", {
        body: {
          identifier: data.identifier,
          otp: data.otp
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      setOtpDialogOpen(false);
      otpForm.reset();
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      navigate("/");
    },
    onError: (error: Error) => {
      toast({
        title: "OTP verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await apiRequest("POST", "/api/register", {
        body: {
          email: data.email,
          mobile: data.mobile,
          password: data.password
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration successful",
        description: `Welcome to FintekPro! Your User ID is: ${data.userId || data.user?.userId || 'N/A'}`,
        duration: 7000,
      });
      registerForm.reset();
      setAuthMode("login");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", {
        body: { identifier: data.identifier }
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      setResetIdentifier(variables.identifier);
      setResetPasswordStep("reset");
      resetPasswordForm.setValue("identifier", variables.identifier);
      toast({
        title: "OTP Sent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", {
        body: {
          identifier: data.identifier,
          otp: data.otp,
          newPassword: data.newPassword
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Password reset successfully. Please login with your new password.",
      });
      setForgotPasswordOpen(false);
      setResetPasswordStep("request");
      forgotPasswordForm.reset();
      resetPasswordForm.reset();
      setResetIdentifier("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const onLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const onOtpSubmit = (data: OtpVerificationFormData) => {
    otpVerificationMutation.mutate(data);
  };

  const onForgotPasswordSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  const onResetPasswordSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate(data);
  };

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
                Your intelligent financial services platform with AI-powered tax filing, 
                portfolio management, and comprehensive investment tools.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-start space-x-3">
                  <Shield className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Secure Authentication</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Multiple sign-in options for your convenience</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">ITR & Tax Services</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">AI-powered tax filing with expert assistance</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <BarChart3 className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Portfolio Management</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Track and manage your investments</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Real-time Insights</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Live market data and AI recommendations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Authentication Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md">
              <CardHeader className="space-y-1 text-center">
                <div className="flex items-center justify-center mb-4">
                  <Shield className="h-12 w-12 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Sign In to FintekPro</CardTitle>
                <CardDescription>
                  Choose your preferred authentication method
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="social" className="space-y-4">
                  <ScrollableTabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="social" data-testid="tab-social-login">Social Login</TabsTrigger>
                    <TabsTrigger value="traditional" data-testid="tab-traditional-login">Traditional</TabsTrigger>
                  </ScrollableTabsList>

                  {/* Social Login Tab */}
                  <TabsContent value="social" className="space-y-4">
                    <div className="space-y-3">
                      {/* Replit Auth */}
                      <a href="/api/login" data-testid="link-replit-login">
                        <Button 
                          variant="outline" 
                          className="w-full h-12 text-base bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                        >
                          <Shield className="w-5 h-5 mr-3" />
                          Continue with One-Click Sign In
                        </Button>
                      </a>
                      
                      {/* WhatsApp Sign In */}
                      <Link href="/whatsapp-login" data-testid="link-whatsapp-login">
                        <Button 
                          variant="outline" 
                          className="w-full h-12 text-base bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:border-green-800 dark:text-green-400"
                        >
                          <MessageSquare className="w-5 h-5 mr-3" />
                          Continue with WhatsApp
                        </Button>
                      </Link>
                    </div>

                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
                      🔒 Quick, secure, and password-free authentication
                    </p>
                  </TabsContent>

                  {/* Traditional Login Tab */}
                  <TabsContent value="traditional">
                    <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as "login" | "register")} className="space-y-4">
                      <ScrollableTabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                        <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
                      </ScrollableTabsList>

                      {/* Login Form */}
                      <TabsContent value="login">
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                          <div>
                            <Label htmlFor="login-identifier">Email, Mobile, or User ID</Label>
                            <Input
                              id="login-identifier"
                              {...loginForm.register("identifier")}
                              placeholder="Email, Mobile, or User ID"
                              data-testid="input-login-identifier"
                            />
                            {loginForm.formState.errors.identifier && (
                              <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.identifier.message}</p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="login-password">Password</Label>
                            <div className="relative">
                              <Input
                                id="login-password"
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

                          {/* Forgot Password Link */}
                          <div className="text-center mt-2">
                            <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="link" 
                                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                  data-testid="button-forgot-password"
                                >
                                  Forgot Password?
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md" data-testid="dialog-forgot-password">
                                <DialogHeader>
                                  <DialogTitle>
                                    {resetPasswordStep === "request" ? "Reset Password" : "Enter OTP & New Password"}
                                  </DialogTitle>
                                  <DialogDescription>
                                    {resetPasswordStep === "request" 
                                      ? "Enter your email or mobile number to receive a password reset OTP"
                                      : "Enter the OTP sent to your email/mobile and your new password"
                                    }
                                  </DialogDescription>
                                </DialogHeader>

                                {resetPasswordStep === "request" ? (
                                  <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                                    <div>
                                      <Label htmlFor="forgot-identifier">Email or Mobile Number</Label>
                                      <Input
                                        id="forgot-identifier"
                                        {...forgotPasswordForm.register("identifier")}
                                        placeholder="user@example.com or 9876543210"
                                        data-testid="input-forgot-identifier"
                                      />
                                      {forgotPasswordForm.formState.errors.identifier && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {forgotPasswordForm.formState.errors.identifier.message}
                                        </p>
                                      )}
                                    </div>

                                    <Button 
                                      type="submit" 
                                      className="w-full" 
                                      disabled={forgotPasswordMutation.isPending}
                                      data-testid="button-send-otp"
                                    >
                                      {forgotPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Send OTP
                                    </Button>
                                  </form>
                                ) : (
                                  <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                                    <div>
                                      <Label htmlFor="reset-otp">OTP (6 digits)</Label>
                                      <Input
                                        id="reset-otp"
                                        {...resetPasswordForm.register("otp")}
                                        placeholder="123456"
                                        maxLength={6}
                                        data-testid="input-reset-otp"
                                      />
                                      {resetPasswordForm.formState.errors.otp && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {resetPasswordForm.formState.errors.otp.message}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <Label htmlFor="reset-new-password">New Password</Label>
                                      <Input
                                        id="reset-new-password"
                                        {...resetPasswordForm.register("newPassword")}
                                        type="password"
                                        placeholder="Enter new password"
                                        data-testid="input-reset-new-password"
                                      />
                                      {resetPasswordForm.formState.errors.newPassword && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {resetPasswordForm.formState.errors.newPassword.message}
                                        </p>
                                      )}
                                    </div>

                                    <div>
                                      <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
                                      <Input
                                        id="reset-confirm-password"
                                        {...resetPasswordForm.register("confirmPassword")}
                                        type="password"
                                        placeholder="Confirm new password"
                                        data-testid="input-reset-confirm-password"
                                      />
                                      {resetPasswordForm.formState.errors.confirmPassword && (
                                        <p className="text-sm text-red-600 mt-1">
                                          {resetPasswordForm.formState.errors.confirmPassword.message}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex gap-2">
                                      <Button 
                                        type="button" 
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => {
                                          setResetPasswordStep("request");
                                          resetPasswordForm.reset();
                                        }}
                                        data-testid="button-back-to-request"
                                      >
                                        Back
                                      </Button>
                                      <Button 
                                        type="submit" 
                                        className="flex-1" 
                                        disabled={resetPasswordMutation.isPending}
                                        data-testid="button-reset-password"
                                      >
                                        {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Reset Password
                                      </Button>
                                    </div>
                                  </form>
                                )}
                              </DialogContent>
                            </Dialog>
                          </div>
                        </form>
                      </TabsContent>

                      {/* Register Form */}
                      <TabsContent value="register">
                        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                          <div>
                            <Label htmlFor="register-email">Email Address</Label>
                            <Input
                              id="register-email"
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
                            <Label htmlFor="register-mobile">Mobile Number</Label>
                            <Input
                              id="register-mobile"
                              {...registerForm.register("mobile")}
                              type="tel"
                              placeholder="9876543210"
                              maxLength={10}
                              data-testid="input-register-mobile"
                            />
                            {registerForm.formState.errors.mobile && (
                              <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.mobile.message}</p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="register-password">Password</Label>
                            <div className="relative">
                              <Input
                                id="register-password"
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
                            <Label htmlFor="register-confirmPassword">Confirm Password</Label>
                            <Input
                              id="register-confirmPassword"
                              {...registerForm.register("confirmPassword")}
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              data-testid="input-register-confirm-password"
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
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* OTP Verification Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-otp-verification">
          <DialogHeader>
            <DialogTitle>Enter OTP</DialogTitle>
            <DialogDescription>
              Please enter the 6-digit verification code sent to {otpChannel}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="otp-code">OTP (6 digits)</Label>
              <Input
                id="otp-code"
                {...otpForm.register("otp")}
                placeholder="123456"
                maxLength={6}
                autoFocus
                data-testid="input-otp-code"
              />
              {otpForm.formState.errors.otp && (
                <p className="text-sm text-red-600 mt-1">
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOtpDialogOpen(false);
                  otpForm.reset();
                }}
                data-testid="button-cancel-otp"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={otpVerificationMutation.isPending}
                data-testid="button-verify-otp"
              >
                {otpVerificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify OTP
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
