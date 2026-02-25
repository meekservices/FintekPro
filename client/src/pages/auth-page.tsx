import { useState, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, markUserAuthenticated } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useSubdomain } from "@/hooks/useSubdomain";
import { SessionConflictDialog } from "@/components/SessionConflictDialog";
import { useSession } from "@/contexts/session-context";
import { Loader2, Eye, EyeOff, Shield, TrendingUp, BarChart3, MessageSquare, CheckCircle2, Mail, Smartphone, User, Info, Clock, RefreshCw, AlertCircle, Phone, LogIn, Users } from "lucide-react";
import { usePortalMeta, PortalLogo } from "@/components/portal/PortalLogo";

const loginSchema = z.object({
  identifier: z.string().min(1, "Email, mobile, or User ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
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

const PORTAL_DESCRIPTIONS: Record<string, { hero: string; features: { icon: string; title: string; desc: string }[] }> = {
  main: {
    hero: "Your intelligent financial services platform with AI-powered tax filing, portfolio management, and comprehensive investment tools.",
    features: [
      { icon: "shield", title: "Secure Authentication", desc: "Multiple sign-in options for your convenience" },
      { icon: "trending", title: "ITR & Tax Services", desc: "AI-powered tax filing with expert assistance" },
      { icon: "chart", title: "Portfolio Management", desc: "Track and manage your investments" },
      { icon: "message", title: "Real-time Insights", desc: "Live market data and AI recommendations" },
    ],
  },
  partner: {
    hero: "Your dedicated partner portal for managing commissions, client relationships, and growing your financial advisory business.",
    features: [
      { icon: "shield", title: "Partner Dashboard", desc: "Track commissions, payouts, and performance" },
      { icon: "trending", title: "Client Management", desc: "Manage your client portfolio efficiently" },
      { icon: "chart", title: "Commission Tracking", desc: "Real-time earnings and payout statements" },
      { icon: "message", title: "Growth Tools", desc: "Marketing and lead management resources" },
    ],
  },
  agent: {
    hero: "Empower your clients with expert financial advice. Access portfolio tools, KYC management, and comprehensive advisory features.",
    features: [
      { icon: "shield", title: "Client Advisory", desc: "Comprehensive tools for client management" },
      { icon: "trending", title: "KYC & Onboarding", desc: "Streamlined client verification workflows" },
      { icon: "chart", title: "Portfolio Analysis", desc: "Deep insights into client portfolios" },
      { icon: "message", title: "AI Recommendations", desc: "Smart suggestions for client investments" },
    ],
  },
  admin: {
    hero: "Platform administration and control center. Manage users, monitor compliance, and oversee all system operations.",
    features: [
      { icon: "shield", title: "User Management", desc: "Control access and manage platform users" },
      { icon: "trending", title: "Compliance Monitor", desc: "SEBI/RBI regulatory compliance tracking" },
      { icon: "chart", title: "System Analytics", desc: "Platform health and performance metrics" },
      { icon: "message", title: "Audit Logs", desc: "Complete audit trail for all operations" },
    ],
  },
};

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { isAdminPortal, withPortalParams } = useSubdomain();
  const { toast } = useToast();
  const { clearSessionExpired } = useSession();
  const { data: portalMeta } = usePortalMeta();
  const portalType = portalMeta?.portal_type || "main";
  const portalLabel = portalMeta?.label || "FintekPro";
  const portalTagline = portalMeta?.tagline || "Your Financial Future, Simplified";
  const portalColor = portalMeta?.primary_color || "#2563EB";
  const portalDesc = PORTAL_DESCRIPTIONS[portalType] || PORTAL_DESCRIPTIONS.main;
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [accountType, setAccountType] = useState<'user' | 'agent'>('user');
  const effectivePortalType = portalType === 'main' && accountType === 'agent' ? 'agent' : portalType;
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetPasswordStep, setResetPasswordStep] = useState<"request" | "reset">("request");
  const [resetIdentifier, setResetIdentifier] = useState("");
  
  // OTP Dialog States
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [otpChannel, setOtpChannel] = useState<string>("");
  const [otpTimer, setOtpTimer] = useState(300); // 5 minutes in seconds
  const [canResendOtp, setCanResendOtp] = useState(false);
  const [otpSending, setOtpSending] = useState(false);

  // Registration OTP States
  const [registrationOtpDialogOpen, setRegistrationOtpDialogOpen] = useState(false);
  const [registrationIdentifier, setRegistrationIdentifier] = useState("");
  const [registrationOtpChannel, setRegistrationOtpChannel] = useState<string>("");
  const [registrationOtpTimer, setRegistrationOtpTimer] = useState(300);
  const [canResendRegistrationOtp, setCanResendRegistrationOtp] = useState(false);
  const [registrationOtpSending, setRegistrationOtpSending] = useState(false);
  const [registrationToken, setRegistrationToken] = useState<string>("");

  // Registration Success State
  const [registeredUserId, setRegisteredUserId] = useState<string>("");
  const [showUserIdDialog, setShowUserIdDialog] = useState(false);

  // Duplicate Warning States
  const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);

  // Progress indicator
  const [loginStep, setLoginStep] = useState<"credentials" | "otp" | "complete">("credentials");
  const [registrationStep, setRegistrationStep] = useState<"details" | "otp" | "complete">("details");

  // Session Conflict States
  const [sessionConflictOpen, setSessionConflictOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [pendingLoginData, setPendingLoginData] = useState<LoginFormData | null>(null);

  // OTP Timer Countdown (Login)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpDialogOpen && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            setCanResendOtp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpDialogOpen, otpTimer]);

  // OTP Timer Countdown (Registration)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (registrationOtpDialogOpen && registrationOtpTimer > 0) {
      interval = setInterval(() => {
        setRegistrationOtpTimer((prev) => {
          if (prev <= 1) {
            setCanResendRegistrationOtp(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [registrationOtpDialogOpen, registrationOtpTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      fullName: "",
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

  // Check for active sessions before attempting login
  const sessionCheckMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const response = await apiRequest("/api/sessions/check", {
        method: "POST",
        body: JSON.stringify({ identifier })
      });
      return response;
    },
    onSuccess: (data, identifier) => {
      const loginData = pendingLoginData || loginForm.getValues();
      
      if (data.hasActiveSession) {
        // User has active session - show conflict dialog
        setSessionCount(data.sessionCount || 1);
        setSessionConflictOpen(true);
      } else {
        // No active session - proceed with normal login
        loginMutation.mutate(loginData);
      }
    },
    onError: (error: Error) => {
      // If session check fails, proceed with login anyway (fail gracefully)
      console.error("Session check failed:", error);
      const loginData = pendingLoginData || loginForm.getValues();
      loginMutation.mutate(loginData);
    },
  });

  // Force logout all sessions for the user
  const forceLogoutMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const response = await apiRequest("/api/sessions/force-logout", {
        method: "POST",
        body: JSON.stringify({ identifier })
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Sessions Terminated",
        description: `${data.destroyedSessions || 0} session(s) terminated successfully`,
      });
      
      // Close the conflict dialog
      setSessionConflictOpen(false);
      
      // Proceed with login using the pending credentials
      if (pendingLoginData) {
        loginMutation.mutate(pendingLoginData);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Force logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: data.identifier,
          password: data.password
        })
      });
      return response;
    },
    onSuccess: (response) => {
      // Backend wraps response in { success: true, data: {...} }
      const data = response.data || response;
      
      // /api/login ALWAYS requires OTP verification (no bypass allowed)
      if (!data.requiresOtp) {
        console.error("Security Error: Login response missing requiresOtp flag");
        toast({
          title: "Login Error",
          description: "Invalid login response. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Proceed to OTP verification step
      setLoginStep("otp");
      setLoginIdentifier(data.identifier || loginForm.getValues("identifier"));
      setOtpChannel(data.otpSentTo || "your registered email/mobile");
      otpForm.setValue("identifier", data.identifier || loginForm.getValues("identifier"));
      if (data.devOtp) {
        otpForm.setValue("otp", data.devOtp);
      }
      setOtpTimer(300); // Reset timer to 5 minutes
      setCanResendOtp(false);
      setOtpDialogOpen(true);
      toast({
        title: data.devOtp ? "Dev Mode - OTP Auto-Filled" : "OTP Sent",
        description: data.devOtp 
          ? `Development OTP: ${data.devOtp} (auto-filled)` 
          : `Verification code sent to ${data.otpSentTo || "your registered email/mobile"}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      setOtpSending(true);
      const response = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: loginIdentifier,
          password: loginForm.getValues("password")
        })
      });
      return response;
    },
    onSuccess: (response) => {
      const data = response.data || response;
      setOtpSending(false);
      setOtpTimer(300); // Reset timer to 5 minutes
      setCanResendOtp(false);
      toast({
        title: "OTP Resent",
        description: `New verification code sent to ${data.otpSentTo || otpChannel}`,
      });
    },
    onError: (error: Error) => {
      setOtpSending(false);
      toast({
        title: "Failed to resend OTP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const otpVerificationMutation = useMutation({
    mutationFn: async (data: OtpVerificationFormData) => {
      const response = await apiRequest("/api/login/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          identifier: data.identifier,
          otp: data.otp
        })
      });
      return response;
    },
    onSuccess: (response) => {
      const data = response.data || response;
      setLoginStep("complete");
      // Mark user as authenticated BEFORE setting query data to prevent session expired popup race condition
      markUserAuthenticated();
      queryClient.setQueryData(["/api/user"], data);
      setOtpDialogOpen(false);
      otpForm.reset();
      clearSessionExpired();

      // If an agent logs in from the main portal, redirect them to agent.fintekpro.com
      const userRoles: string[] = data.roles || [];
      const isAgentOnMainPortal = userRoles.includes('agent') && portalType === 'main';
      if (isAgentOnMainPortal) {
        toast({
          title: "Welcome back, Agent!",
          description: "Redirecting you to the Agent Portal…",
        });
        setTimeout(() => {
          window.location.href = 'https://agent.fintekpro.com';
        }, 1500);
        return;
      }

      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      navigate(withPortalParams("/"));
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
      const response = await apiRequest("/api/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          mobile: data.mobile,
          password: data.password,
          portalType: effectivePortalType
        })
      });
      return response;
    },
    onSuccess: (data, variables) => {
      // Check for duplicate warnings first
      if (data.warnings?.hasDuplicates && data.warnings.duplicates?.length > 0) {
        // Show duplicate warning dialog
        setDuplicateWarnings(data.warnings.duplicates);
        setPendingRegistrationData(data);
        setDuplicateWarningOpen(true);
        return;
      }
      
      if (data.requiresOtp) {
        // Registration requires OTP verification
        setRegistrationStep("otp");
        setRegistrationIdentifier(data.identifier || variables.email);
        setRegistrationOtpChannel(data.otpSentTo || "your email and mobile");
        setRegistrationToken(data.registrationToken || ""); // Store secure token (NOT password)
        setRegistrationOtpTimer(300); // Reset timer to 5 minutes
        setCanResendRegistrationOtp(false);
        setRegistrationOtpDialogOpen(true);
        toast({
          title: "Verification Code Sent",
          description: `Please check ${data.otpSentTo || "your email and mobile"} for the verification code`,
        });
      } else {
        // Old flow (shouldn't happen with new backend)
        const userId = data.userId || data.user?.id || 'N/A';
        setRegisteredUserId(userId);
        setShowUserIdDialog(true);
        registerForm.reset();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendRegistrationOtpMutation = useMutation({
    mutationFn: async () => {
      if (!registrationIdentifier || !registrationToken) {
        throw new Error("No registration session found");
      }
      setRegistrationOtpSending(true);
      const response = await apiRequest("/api/register/resend-otp", {
        method: "POST",
        body: JSON.stringify({
          identifier: registrationIdentifier,
          registrationToken: registrationToken
        })
      });
      return response;
    },
    onSuccess: (data) => {
      setRegistrationOtpSending(false);
      setRegistrationOtpTimer(300); // Reset timer to 5 minutes
      setCanResendRegistrationOtp(false);
      toast({
        title: "OTP Resent",
        description: `New verification code sent to ${data.otpSentTo || registrationOtpChannel}`,
      });
    },
    onError: (error: Error) => {
      setRegistrationOtpSending(false);
      toast({
        title: "Failed to resend OTP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registrationOtpVerificationMutation = useMutation({
    mutationFn: async (otp: string) => {
      const response = await apiRequest("/api/register/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          identifier: registrationIdentifier,
          otp: otp
        })
      });
      return response;
    },
    onSuccess: async (data) => {
      setRegistrationStep("complete");
      setRegistrationOtpDialogOpen(false);
      const userId = data.userId || 'N/A';
      setRegisteredUserId(userId);
      setShowUserIdDialog(true);
      registerForm.reset();
      setRegistrationToken(""); // Clear secure token
      
      // Mark user as authenticated BEFORE setting query data to prevent session expired popup race condition
      markUserAuthenticated();
      
      // Auto-login the user and verify session
      queryClient.setQueryData(["/api/user"], data);
      
      // Check if user registered as agent from main portal — redirect them to agent portal
      const registeredRoles: string[] = data.roles || [];
      const isAgentFromMainPortal = registeredRoles.includes('agent') && portalType === 'main';
      
      // Force refetch to verify session persists
      try {
        await queryClient.refetchQueries({ queryKey: ["/api/user"] });
        if (isAgentFromMainPortal) {
          toast({
            title: "Agent Account Created!",
            description: "Redirecting you to the Agent Portal…",
          });
          setTimeout(() => {
            window.location.href = 'https://agent.fintekpro.com';
          }, 2500);
        } else {
          toast({
            title: "Registration successful!",
            description: "Your account has been created and verified",
          });
        }
      } catch (error) {
        console.error("Session verification failed:", error);
        toast({
          title: "Registration successful but session error",
          description: "Please log in manually to continue",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "OTP verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: data.identifier })
      });
      return response;
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
      const response = await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          identifier: data.identifier,
          otp: data.otp,
          newPassword: data.newPassword
        })
      });
      return response;
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
  useEffect(() => {
    if (!isAuthLoading && user) {
      navigate(withPortalParams("/"));
    }
  }, [isAuthLoading, user, navigate, withPortalParams]);

  if (isAuthLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" data-testid="loader-auth" />
      </div>
    );
  }

  const onLoginSubmit = (data: LoginFormData) => {
    // Store login data for potential use after session conflict resolution
    setPendingLoginData(data);
    
    // Check for active sessions first
    sessionCheckMutation.mutate(data.identifier);
  };

  // Handle session conflict - continue with existing session
  const handleContinueSession = () => {
    setSessionConflictOpen(false);
    setPendingLoginData(null);
    clearSessionExpired();
    
    // Redirect to dashboard
    toast({
      title: "Continuing with existing session",
      description: "Redirecting you to the dashboard...",
    });
    navigate(withPortalParams("/"));
  };

  // Handle session conflict - force logout and login fresh
  const handleForceLogout = () => {
    if (pendingLoginData) {
      forceLogoutMutation.mutate(pendingLoginData.identifier);
    }
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

  const handleResendOtp = () => {
    resendOtpMutation.mutate();
  };

  const featureIcons = {
    shield: Shield,
    trending: TrendingUp,
    chart: BarChart3,
    message: MessageSquare,
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${portalColor}08 0%, ${portalColor}15 100%)` }}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Hero Section */}
          <div className="lg:pr-8">
            <div className="text-center lg:text-left">
              <div className="mb-6">
                <PortalLogo size="lg" showTagline={false} />
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Welcome to <span style={{ color: portalColor }}>{portalLabel}</span>
              </h1>
              <p className="text-sm font-medium mb-4" style={{ color: portalColor }}>{portalTagline}</p>
              <p className="text-xl text-muted-foreground mb-8">
                {portalDesc.hero}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {portalDesc.features.map((feature, index) => {
                  const IconComponent = featureIcons[feature.icon as keyof typeof featureIcons] || Shield;
                  return (
                    <div key={index} className="flex items-start space-x-3">
                      <IconComponent className="h-6 w-6 mt-1 flex-shrink-0" style={{ color: portalColor }} />
                      <div>
                        <h3 className="font-semibold text-foreground">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Authentication Card */}
          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md shadow-lg">
              <CardHeader className="space-y-1 text-center">
                <div className="flex items-center justify-center mb-4">
                  <Shield className="h-12 w-12" style={{ color: portalColor }} />
                </div>
                <CardTitle className="text-2xl">Sign In to {portalLabel}</CardTitle>
                <CardDescription>
                  {portalType === 'admin' ? 'Access the platform control center' :
                   portalType === 'partner' ? 'Access your partner dashboard' :
                   portalType === 'agent' ? 'Access your agent workspace' :
                   'Access your financial services platform'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as "login" | "register")} className="space-y-4">
                      <ScrollableTabsList className={`grid w-full ${isAdminPortal ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                        {!isAdminPortal && <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>}
                      </ScrollableTabsList>

                      {/* Login Form */}
                      <TabsContent value="login" className="space-y-4">
                        {/* Progress Indicator */}
                        {loginStep !== "credentials" && (
                          <div className="space-y-2 p-3 rounded-lg border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Credentials
                              </span>
                              <span className="flex items-center gap-1 font-medium" style={{ color: loginStep === "complete" ? '#16a34a' : portalColor }}>
                                {loginStep === "complete" ? <CheckCircle2 className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                OTP Verification
                              </span>
                              <span className={`flex items-center gap-1 ${loginStep === "complete" ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                                <CheckCircle2 className="h-4 w-4" />
                                Success
                              </span>
                            </div>
                            <Progress value={loginStep === "otp" ? 66 : 100} className="h-2" />
                          </div>
                        )}

                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                          <div>
                            <Label htmlFor="login-identifier" className="flex items-center gap-2">
                              Email, Mobile, or User ID
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                            <Input
                              id="login-identifier"
                              {...loginForm.register("identifier")}
                              placeholder="example@email.com / 9876543210 / FTP001234"
                              autoFocus
                              data-testid="input-login-identifier"
                            />
                            {loginForm.formState.errors.identifier && (
                              <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.identifier.message}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Email
                              </Badge>
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                Mobile
                              </Badge>
                              <Badge variant="outline" className="text-xs flex items-center gap-1">
                                <User className="h-3 w-3" />
                                User ID
                              </Badge>
                            </div>
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

                          <Alert className="border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
                            <Shield className="h-4 w-4" style={{ color: portalColor }} />
                            <AlertDescription className="text-sm" style={{ color: portalColor }}>
                              After entering credentials, you'll receive a 6-digit OTP via email/SMS for verification.
                            </AlertDescription>
                          </Alert>

                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loginMutation.isPending}
                            data-testid="button-login"
                          >
                            {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continue to OTP
                          </Button>

                          {/* Forgot Password Link */}
                          <div className="text-center mt-2">
                            <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="link" 
                                  className="text-sm"
                                  style={{ color: portalColor }}
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
                                        autoFocus
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
                                        autoFocus
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
                      <TabsContent value="register" className="space-y-4">
                        {/* Pending OTP verification banner — shows if dialog was closed before completing */}
                        {registrationStep === "otp" && !registrationOtpDialogOpen && registrationIdentifier && (
                          <Alert className="border-2" style={{ backgroundColor: "#FEF3C708", borderColor: "#F59E0B" }}>
                            <Clock className="h-4 w-4 text-amber-500" />
                            <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                              <strong>Verification pending!</strong> A 6-digit code was sent to <strong>{registrationOtpChannel}</strong>. You must enter it to complete registration.
                              <Button
                                type="button"
                                size="sm"
                                className="mt-2 w-full"
                                style={{ backgroundColor: "#F59E0B", color: "white" }}
                                onClick={() => setRegistrationOtpDialogOpen(true)}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Enter Verification Code
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}

                        {portalType === 'main' && (
                          <div className="rounded-lg border overflow-hidden" style={{ borderColor: `${portalColor}40` }}>
                            <p className="text-xs font-medium px-3 pt-2 pb-1" style={{ color: portalColor }}>I am registering as a:</p>
                            <div className="flex">
                              <button
                                type="button"
                                onClick={() => setAccountType('user')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${accountType === 'user' ? 'text-white' : 'text-gray-600 bg-white hover:bg-gray-50'}`}
                                style={accountType === 'user' ? { backgroundColor: portalColor } : {}}
                              >
                                <User className="h-4 w-4" />
                                Investor / Client
                              </button>
                              <button
                                type="button"
                                onClick={() => setAccountType('agent')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors border-l ${accountType === 'agent' ? 'text-white' : 'text-gray-600 bg-white hover:bg-gray-50'}`}
                                style={accountType === 'agent' ? { backgroundColor: '#059669' } : { borderColor: `${portalColor}40` }}
                              >
                                <Users className="h-4 w-4" />
                                Financial Agent
                              </button>
                            </div>
                          </div>
                        )}

                        <Alert className="border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
                          <Info className="h-4 w-4" style={{ color: portalColor }} />
                          <AlertDescription className="text-sm" style={{ color: portalColor }}>
                            {(portalType === 'agent' || effectivePortalType === 'agent')
                              ? <>You'll receive a unique Agent ID on registration. Your account will be active immediately — use your email or ID to log in.</>
                              : portalType === 'partner'
                              ? <>Partner accounts are created with <strong>Pending</strong> approval status. Admin will verify and activate your account.</>
                              : <>Upon registration, you'll receive a unique User ID in the format <strong>FTP001234</strong>. Save it for future logins!</>
                            }
                          </AlertDescription>
                        </Alert>

                        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                          <div>
                            <Label htmlFor="register-fullName">
                              {portalType === 'partner' ? 'Company Name' : 'Full Name'}
                            </Label>
                            <Input
                              id="register-fullName"
                              {...registerForm.register("fullName")}
                              type="text"
                              placeholder={portalType === 'partner' ? 'Your company name' : portalType === 'agent' ? 'Your full name' : 'Your full name'}
                              autoFocus
                              data-testid="input-register-fullname"
                            />
                            {registerForm.formState.errors.fullName && (
                              <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.fullName.message}</p>
                            )}
                          </div>

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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Enhanced OTP Verification Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-otp-verification">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: portalColor }} />
              Enter Verification Code
            </DialogTitle>
            <DialogDescription>
              We've sent a 6-digit code to <strong>{otpChannel}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            {/* Timer Display */}
            <div className="p-3 rounded-lg border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: portalColor }} />
                  <span className="text-sm font-medium" style={{ color: portalColor }}>
                    {otpTimer > 0 ? `Code expires in ${formatTime(otpTimer)}` : "Code expired"}
                  </span>
                </div>
                {canResendOtp && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={otpSending}
                    style={{ color: portalColor }}
                    data-testid="button-resend-otp"
                  >
                    {otpSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Resend
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="otp-code">6-Digit Code</Label>
              <Input
                id="otp-code"
                {...otpForm.register("otp")}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
                data-testid="input-otp-code"
              />
              {otpForm.formState.errors.otp && (
                <p className="text-sm text-red-600 mt-1">
                  {otpForm.formState.errors.otp.message}
                </p>
              )}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Didn't receive the code? Check your spam folder or click Resend after the timer expires.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOtpDialogOpen(false);
                  otpForm.reset();
                  setLoginStep("credentials");
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
                Verify Code
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Registration OTP Verification Dialog */}
      <Dialog open={registrationOtpDialogOpen} onOpenChange={setRegistrationOtpDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-testid="dialog-registration-otp"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" style={{ color: portalColor }} />
              Verify Your Email & Mobile
            </DialogTitle>
            <DialogDescription>
              We've sent a 6-digit code to <strong>{registrationOtpChannel}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const otp = formData.get('registration-otp') as string;
            if (otp && otp.length === 6) {
              registrationOtpVerificationMutation.mutate(otp);
            }
          }} className="space-y-4">
            {/* Timer Display */}
            <div className="p-3 rounded-lg border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: portalColor }} />
                  <span className="text-sm font-medium" style={{ color: portalColor }}>
                    {registrationOtpTimer > 0 ? `Code expires in ${formatTime(registrationOtpTimer)}` : "Code expired"}
                  </span>
                </div>
                {canResendRegistrationOtp && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => resendRegistrationOtpMutation.mutate()}
                    disabled={registrationOtpSending}
                    style={{ color: portalColor }}
                    data-testid="button-resend-registration-otp"
                  >
                    {registrationOtpSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Resend
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="registration-otp">6-Digit Code</Label>
              <Input
                id="registration-otp"
                name="registration-otp"
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="text-center text-2xl tracking-widest font-mono"
                data-testid="input-registration-otp"
                required
              />
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Didn't receive the code? Check your spam folder or click Resend after the timer expires.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setRegistrationOtpDialogOpen(false);
                  setRegistrationStep("details");
                }}
                data-testid="button-cancel-registration-otp"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={registrationOtpVerificationMutation.isPending}
                data-testid="button-verify-registration-otp"
              >
                {registrationOtpVerificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Create Account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User ID Success Dialog */}
      <Dialog open={showUserIdDialog} onOpenChange={setShowUserIdDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-user-id-success">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Registration Successful!</DialogTitle>
            <DialogDescription className="text-center">
              Welcome to {portalLabel}! Your account has been created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border-2" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}40` }}>
              <p className="text-sm text-muted-foreground mb-2 text-center">Your unique User ID:</p>
              <div className="flex items-center justify-center gap-2">
                <Badge className="text-lg px-4 py-2 text-white" style={{ backgroundColor: portalColor }}>
                  {registeredUserId}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Save this ID - you can use it to login along with email or mobile
              </p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You can now sign in using your email, mobile number, or this User ID with your password.
              </AlertDescription>
            </Alert>

            <Button 
              className="w-full" 
              onClick={() => {
                setShowUserIdDialog(false);
                navigate(withPortalParams("/"));
              }}
              data-testid="button-proceed-to-dashboard"
            >
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <Dialog open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-duplicate-warning">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Possible Duplicate Account</DialogTitle>
            <DialogDescription className="text-center">
              We found {duplicateWarnings.length} existing {duplicateWarnings.length === 1 ? 'account' : 'accounts'} with similar contact information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* List of duplicate matches */}
            <div className="border rounded-lg divide-y">
              {duplicateWarnings.map((duplicate, index) => (
                <div key={index} className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{duplicate.name || "Unknown User"}</span>
                    <Badge variant="outline" className="text-xs">
                      User ID: {duplicate.userId}
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {duplicate.emailMatch && (
                      <Badge variant="secondary" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Email Match
                      </Badge>
                    )}
                    {duplicate.mobileMatch && (
                      <Badge variant="secondary" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        Mobile Match
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {duplicate.message}
                  </p>
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                If this is your existing account, please login instead. If you're a family member, you can link your account to the existing one.
              </AlertDescription>
            </Alert>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <Button 
                variant="default"
                className="w-full" 
                onClick={() => {
                  setDuplicateWarningOpen(false);
                  setAuthMode("login");
                  toast({
                    title: "Switched to Login",
                    description: "Please login with your existing account",
                  });
                }}
                data-testid="button-login-instead"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login Instead
              </Button>
              
              <Button 
                variant="outline"
                className="w-full" 
                onClick={() => {
                  setDuplicateWarningOpen(false);
                  toast({
                    title: "Family Linking",
                    description: "This feature will be available after account creation",
                    variant: "default",
                  });
                  // Proceed with OTP flow
                  if (pendingRegistrationData?.requiresOtp) {
                    setRegistrationStep("otp");
                    setRegistrationIdentifier(pendingRegistrationData.identifier || pendingRegistrationData.user?.email);
                    setRegistrationOtpChannel(pendingRegistrationData.otpSentTo || "your email and mobile");
                    setRegistrationToken(pendingRegistrationData.registrationToken || "");
                    setRegistrationOtpTimer(300);
                    setCanResendRegistrationOtp(false);
                    setRegistrationOtpDialogOpen(true);
                  }
                }}
                data-testid="button-link-family"
              >
                <Users className="h-4 w-4 mr-2" />
                Link as Family Member
              </Button>
              
              <Button 
                variant="ghost"
                className="w-full" 
                onClick={() => {
                  setDuplicateWarningOpen(false);
                  // Proceed with OTP flow
                  if (pendingRegistrationData?.requiresOtp) {
                    setRegistrationStep("otp");
                    setRegistrationIdentifier(pendingRegistrationData.identifier || pendingRegistrationData.user?.email);
                    setRegistrationOtpChannel(pendingRegistrationData.otpSentTo || "your email and mobile");
                    setRegistrationToken(pendingRegistrationData.registrationToken || "");
                    setRegistrationOtpTimer(300);
                    setCanResendRegistrationOtp(false);
                    setRegistrationOtpDialogOpen(true);
                  }
                }}
                data-testid="button-continue-anyway"
              >
                Continue Anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Session Conflict Dialog */}
      <SessionConflictDialog
        open={sessionConflictOpen}
        onContinue={handleContinueSession}
        onForceLogout={handleForceLogout}
        sessionCount={sessionCount}
      />
    </div>
  );
}
