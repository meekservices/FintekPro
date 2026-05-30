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
import { apiRequest, queryClient, markUserAuthenticated, storeSessionId } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useSubdomain } from "@/hooks/useSubdomain";
import { SessionConflictDialog } from "@/components/SessionConflictDialog";
import { useSession } from "@/contexts/session-context";
import { Loader2, Eye, EyeOff, Shield as LucideShield, TrendingUp, BarChart3, MessageSquare, CheckCircle2, Mail, Smartphone, User, Info, Clock, RefreshCw, AlertCircle, Phone, LogIn, Users, Lock } from "lucide-react";
import { usePortalMeta } from "@/components/portal/PortalLogo";
import { PORTAL_BRAND_CONFIG, resolvePortalType } from "@shared/portal";
import mainLogoImg from "@assets/fintekpro_main_1772539048013.png";
import adminLogoImg from "@assets/fintekpro_admin_1772539048012.png";
import agentLogoImg from "@assets/fintekpro_agent_1772539048012.png";
import partnerLogoImg from "@assets/fintekpro_partners_1772539048013.png";

const PORTAL_LOGO_MAP: Record<string, string> = {
  main: mainLogoImg,
  admin: adminLogoImg,
  agent: agentLogoImg,
  partner: partnerLogoImg,
};

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
  const { isAdminPortal, withPortalParams, subdomain } = useSubdomain();
  const { toast } = useToast();
  const { clearSessionExpired } = useSession();
  usePortalMeta();
  const portalType = subdomain || "main";

  // After login, go to /?agent=true (or /?admin=true etc.) so the portal
  // query param is preserved and detectSubdomain() keeps returning the right portal.
  const portalHomeRoute = withPortalParams("/");
  const portalConfig = PORTAL_BRAND_CONFIG[resolvePortalType(portalType)];
  const portalLabel = portalConfig.label;
  const portalTagline = portalConfig.tagline;
  const portalColor = portalConfig.primaryColor;
  const portalDesc = PORTAL_DESCRIPTIONS[portalType] || PORTAL_DESCRIPTIONS.main;
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "register" ? "register" : "login";
  });
  const effectivePortalType = portalType;
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
  const [loginStep, setLoginStep] = useState<"credentials" | "otp" | "pin-entry" | "pin-setup" | "complete">("credentials");
  const [registrationStep, setRegistrationStep] = useState<"details" | "otp" | "complete">("details");

  // PIN Dialog States
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinSetupDialogOpen, setPinSetupDialogOpen] = useState(false);
  const [pinIdentifier, setPinIdentifier] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [pinSetupValue, setPinSetupValue] = useState("");
  const [pinSetupConfirm, setPinSetupConfirm] = useState("");
  const [pinError, setPinError] = useState("");

  // Session Conflict States
  const [sessionConflictOpen, setSessionConflictOpen] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [pendingLoginData, setPendingLoginData] = useState<LoginFormData | null>(null);

  // Agent portal OTP Login (passwordless) states
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpLoginEmail, setOtpLoginEmail] = useState('');

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

  // Set page title dynamically per portal
  useEffect(() => {
    document.title = portalType === 'main'
      ? 'FintekPro — Sign In'
      : `${portalLabel} Portal — Sign In`;
    return () => { document.title = 'FintekPro - Smart Financial Services Platform'; };
  }, [portalType, portalLabel]);

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

      // Trusted device shortcut: backend skips OTP, asks for PIN directly
      if (data.requiresPin) {
        setLoginStep("pin-entry");
        setPinIdentifier(data.identifier || loginForm.getValues("identifier"));
        setPinValue("");
        setPinError("");
        setPinDialogOpen(true);
        toast({
          title: "Enter your PIN",
          description: "Trusted device recognised — enter your 4-digit PIN to continue",
        });
        return;
      }

      // Standard flow: OTP required
      if (!data.requiresOtp) {
        console.error("Security Error: Login response missing requiresOtp/requiresPin flag");
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
      const allowDevOtpHints = import.meta.env.DEV;
      if (allowDevOtpHints && data.devOtp) {
        otpForm.setValue("otp", data.devOtp);
      }
      setOtpTimer(300); // Reset timer to 5 minutes
      setCanResendOtp(false);
      setOtpDialogOpen(true);
      toast({
        title: allowDevOtpHints && data.devOtp ? "Dev Mode - OTP Auto-Filled" : "OTP Sent",
        description: allowDevOtpHints && data.devOtp
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

      // Store session ID for cookie-bypass fallback
      if (response.sessionId) {
        storeSessionId(response.sessionId);
      } else if (data.sessionId) {
        storeSessionId(data.sessionId);
      }

      // If PIN not yet set, show PIN setup screen before navigating
      if (data.requiresPinSetup) {
        setLoginStep("pin-setup");
        setPinSetupValue("");
        setPinSetupConfirm("");
        setPinError("");
        // Store user data in cache so /api/user resolves
        markUserAuthenticated();
        queryClient.setQueryData(["/api/user"], data);
        setOtpDialogOpen(false);
        otpForm.reset();
        clearSessionExpired();
        setPinSetupDialogOpen(true);
        toast({
          title: "Set your PIN",
          description: "Create a 4-digit PIN for faster logins on this device",
        });
        return;
      }

      setLoginStep("complete");
      // Mark user as authenticated BEFORE setting query data to prevent session expired popup race condition
      markUserAuthenticated();
      queryClient.setQueryData(["/api/user"], data);
      setOtpDialogOpen(false);
      otpForm.reset();
      clearSessionExpired();

      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      navigate(portalHomeRoute);
    },
    onError: (error: Error) => {
      toast({
        title: "OTP verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // PIN entry mutation — trusted device login (skips OTP entirely)
  const pinEntryMutation = useMutation({
    mutationFn: async ({ identifier, pin }: { identifier: string; pin: string }) => {
      const response = await apiRequest("/api/login/verify-pin", {
        method: "POST",
        body: JSON.stringify({ identifier, pin }),
      });
      return response;
    },
    onSuccess: (response) => {
      const data = response.data || response;

      // Store session ID for cookie-bypass fallback
      if (response.sessionId) {
        storeSessionId(response.sessionId);
      } else if (data.sessionId) {
        storeSessionId(data.sessionId);
      }

      setLoginStep("complete");
      markUserAuthenticated();
      queryClient.setQueryData(["/api/user"], data);
      setPinDialogOpen(false);
      setPinValue("");
      clearSessionExpired();
      toast({ title: "Login successful", description: "Welcome back!" });
      navigate(portalHomeRoute);
    },
    onError: (error: Error) => {
      setPinError(error.message || "Invalid PIN. Please try again.");
      setPinValue("");
      toast({ title: "Incorrect PIN", description: error.message, variant: "destructive" });
    },
  });

  // PIN setup mutation — called after first OTP verify when user has no PIN yet
  const pinSetupMutation = useMutation({
    mutationFn: async (pin: string) => {
      const response = await apiRequest("/api/login/set-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      return response;
    },
    onSuccess: () => {
      setLoginStep("complete");
      setPinSetupDialogOpen(false);
      setPinSetupValue("");
      setPinSetupConfirm("");
      toast({ title: "PIN created!", description: "Next time you log in on this device, just use your PIN." });
      navigate(portalHomeRoute);
    },
    onError: (error: Error) => {
      setPinError(error.message || "Failed to set PIN");
      toast({ title: "PIN setup failed", description: error.message, variant: "destructive" });
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
    onSuccess: (response, variables) => {
      // Unwrap the API response envelope: { success, data, message }
      const data = (response as any)?.data || response;

      // Check for duplicate warnings first
      if (data.warnings?.hasDuplicates && data.warnings.duplicates?.length > 0) {
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
        setRegistrationToken(data.registrationToken || "");
        setRegistrationOtpTimer(300);
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
    onSuccess: (response) => {
      const data = (response as any)?.data || response;
      setRegistrationOtpSending(false);
      setRegistrationOtpTimer(300);
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
    onSuccess: async (response) => {
      // Unwrap the API response envelope: { success, data, message }
      const data = (response as any)?.data || response;

      setRegistrationStep("complete");
      setRegistrationOtpDialogOpen(false);
      const userId = data.userId || 'N/A';
      setRegisteredUserId(userId);
      setShowUserIdDialog(true);
      registerForm.reset();
      setRegistrationToken("");

      // Mark user as authenticated BEFORE setting query data
      markUserAuthenticated();
      queryClient.setQueryData(["/api/user"], data);

      try {
        await queryClient.refetchQueries({ queryKey: ["/api/user"] });
        toast({
          title: "Registration successful!",
          description: "Your account has been created and verified",
        });
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

  // Passwordless OTP request (agent portal OTP Login tab)
  const requestOtpMutation = useMutation({
    mutationFn: async (identifier: string) => {
      const response = await apiRequest("/api/login/request-otp", {
        method: "POST",
        body: JSON.stringify({ identifier }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      const sentTo = data?.otpSentTo || "your registered mobile";
      const resolvedIdentifier = data?.identifier || otpLoginEmail;
      setLoginIdentifier(resolvedIdentifier);
      setOtpChannel(sentTo);
      setOtpTimer(300);
      setCanResendOtp(false);
      otpForm.setValue("identifier", resolvedIdentifier);
      setOtpDialogOpen(true);
      setLoginStep("otp");
      toast({ title: "OTP Sent", description: `Verification code sent to ${sentTo}` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Redirect if already authenticated and not in a PIN flow
  const isPinFlow = loginStep === "pin-setup" || loginStep === "pin-entry" || pinDialogOpen || pinSetupDialogOpen;

  useEffect(() => {
    if (!isAuthLoading && user && !isPinFlow) {
      navigate(portalHomeRoute);
    }
  }, [isAuthLoading, user, navigate, portalHomeRoute, isPinFlow]);

  if (isAuthLoading || (user && !isPinFlow)) {
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
    navigate(portalHomeRoute);
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
    shield: LucideShield,
    trending: TrendingUp,
    chart: BarChart3,
    message: MessageSquare,
  };

  // ── Agent Portal: dedicated full-page layout ──────────────────────────────
  if (portalType === 'agent') {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* ── Left Panel – dark navy with network pattern ── */}
        <div className="lg:w-5/12 flex flex-col justify-between p-6 sm:p-10 lg:p-16 relative overflow-hidden min-h-[200px] sm:min-h-[260px] lg:min-h-screen" style={{ background: '#0d1b2e' }}>
          {/* Network / constellation SVG background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#3b82f6" strokeOpacity="0.12" strokeWidth="1">
              <line x1="60" y1="90" x2="190" y2="170" /><line x1="190" y1="170" x2="330" y2="75" />
              <line x1="330" y1="75" x2="490" y2="130" /><line x1="490" y1="130" x2="610" y2="55" />
              <line x1="610" y1="55" x2="720" y2="145" /><line x1="60" y1="90" x2="110" y2="260" />
              <line x1="110" y1="260" x2="210" y2="305" /><line x1="210" y1="305" x2="310" y2="255" />
              <line x1="310" y1="255" x2="330" y2="75" /><line x1="410" y1="195" x2="460" y2="355" />
              <line x1="460" y1="355" x2="560" y2="285" /><line x1="560" y1="285" x2="660" y2="225" />
              <line x1="660" y1="225" x2="720" y2="145" /><line x1="110" y1="260" x2="185" y2="455" />
              <line x1="185" y1="455" x2="285" y2="385" /><line x1="285" y1="385" x2="385" y2="455" />
              <line x1="490" y1="505" x2="585" y2="425" /><line x1="585" y1="425" x2="685" y2="385" />
              <line x1="685" y1="385" x2="760" y2="305" /><line x1="125" y1="555" x2="225" y2="525" />
              <line x1="225" y1="525" x2="325" y2="560" /><line x1="325" y1="560" x2="490" y2="505" />
            </g>
            <g fill="#60a5fa" fillOpacity="0.35">
              <circle cx="60" cy="90" r="3" /><circle cx="190" cy="170" r="2.5" /><circle cx="330" cy="75" r="3" />
              <circle cx="490" cy="130" r="2" /><circle cx="610" cy="55" r="3" /><circle cx="720" cy="145" r="2.5" />
              <circle cx="110" cy="260" r="2" /><circle cx="210" cy="305" r="3" /><circle cx="310" cy="255" r="2" />
              <circle cx="410" cy="195" r="2.5" /><circle cx="460" cy="355" r="3" /><circle cx="560" cy="285" r="2" />
              <circle cx="660" cy="225" r="2.5" /><circle cx="185" cy="455" r="2" /><circle cx="285" cy="385" r="3" />
              <circle cx="385" cy="455" r="2" /><circle cx="490" cy="505" r="2.5" /><circle cx="585" cy="425" r="2" />
              <circle cx="685" cy="385" r="3" /><circle cx="760" cy="305" r="2" /><circle cx="125" cy="555" r="2.5" />
              <circle cx="225" cy="525" r="2" /><circle cx="325" cy="560" r="3" />
            </g>
          </svg>

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <img src={agentLogoImg} alt="FintekPro Agent Portal" className="h-12 sm:h-16 lg:h-20 object-contain" />
            <span className="lg:hidden text-white font-bold text-base sm:text-lg tracking-tight">FintekPro<br /><span className="text-blue-300 font-normal text-sm">Agent Portal</span></span>
          </div>

          {/* Hero content – hidden on very small mobile to keep panel compact */}
          <div className="relative z-10 mt-auto pt-4 sm:pt-8 lg:pt-12">
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-3">
              Empower your<br />advisory business.
            </h1>
            <p className="hidden sm:block text-blue-200/65 text-sm lg:text-base mb-6 sm:mb-10 leading-relaxed max-w-sm">
              The complete toolkit for SEBI-registered distributors and advisors.
              Manage clients, execute trades, and grow your AUM efficiently.
            </p>
            {/* Stats */}
            <div className="flex gap-6 sm:gap-10">
              <div>
                <div className="text-white text-lg sm:text-2xl font-bold">₹5k+ Cr</div>
                <div className="text-blue-300/55 text-[10px] sm:text-xs uppercase tracking-widest mt-0.5">AUM Managed</div>
              </div>
              <div>
                <div className="text-white text-lg sm:text-2xl font-bold">10k+</div>
                <div className="text-blue-300/55 text-[10px] sm:text-xs uppercase tracking-widest mt-0.5">Active Agents</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel – white login form ── */}
        <div className="lg:w-7/12 bg-white flex flex-col items-center justify-center px-4 py-8 sm:px-8 sm:py-10 relative min-h-[500px]">
          {/* SSL badge */}
          <div className="absolute top-4 right-5 flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <LucideShield className="h-3.5 w-3.5" />
            Secure SSL Connection
          </div>

          <div className="w-full max-w-sm">
            {authMode === "login" ? (
              <>
                {/* Logo above title */}
                <div className="flex justify-center mb-4">
                  <img src={agentLogoImg} alt="FintekPro" className="h-16 w-16 object-contain" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 text-center">{portalLabel} | Agent Portal</h2>
                <p className="text-sm text-gray-500 mb-7 text-center">Sign in to manage your practice</p>

                {/* Method toggle */}
                <div className="bg-gray-100 rounded-lg p-1 flex mb-6 gap-1">
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'password' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setLoginMethod('password')}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${loginMethod === 'otp' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setLoginMethod('otp')}
                  >
                    OTP Login
                  </button>
                </div>

                {/* Password login form */}
                {loginMethod === 'password' && (
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <div>
                      <Label htmlFor="agent-pw-id" className="text-gray-700 text-sm font-medium">Email Address</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="agent-pw-id"
                          {...loginForm.register("identifier")}
                          placeholder="agent@fintekpro.in"
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                      {loginForm.formState.errors.identifier && (
                        <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.identifier.message}</p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="agent-pw-pass" className="text-gray-700 text-sm font-medium">Password</Label>
                        <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => setForgotPasswordOpen(true)}>
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="agent-pw-pass"
                          {...loginForm.register("password")}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-9 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-red-600 mt-1">{loginForm.formState.errors.password.message}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      disabled={loginMutation.isPending || sessionCheckMutation.isPending}
                    >
                      {(loginMutation.isPending || sessionCheckMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                  </form>
                )}

                {/* OTP Login (passwordless) form */}
                {loginMethod === 'otp' && (
                  <form onSubmit={(e) => { e.preventDefault(); if (otpLoginEmail.trim()) requestOtpMutation.mutate(otpLoginEmail.trim()); }} className="space-y-4">
                    <div>
                      <Label htmlFor="agent-otp-id" className="text-gray-700 text-sm font-medium">Mobile or Email</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="agent-otp-id"
                          value={otpLoginEmail}
                          onChange={(e) => setOtpLoginEmail(e.target.value)}
                          placeholder="9876543210 or agent@email.com"
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      disabled={requestOtpMutation.isPending || !otpLoginEmail.trim()}
                    >
                      {requestOtpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send OTP
                    </Button>
                  </form>
                )}

                <p className="text-center text-sm text-gray-400 mt-7">
                  Need an agent account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("register")}
                    className="text-blue-600 font-medium hover:underline cursor-pointer"
                  >
                    Apply to register
                  </button>
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 text-center">{portalLabel} — Register</h2>
                <p className="text-sm text-gray-500 mb-5 text-center">Create your agent account</p>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-5 text-sm text-blue-700 flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>You'll receive a unique Agent ID on registration. Your account will be active immediately — use your email or ID to log in.</span>
                </div>

                {registrationStep === "otp" && !registrationOtpDialogOpen && registrationIdentifier && (
                  <div className="mb-4 p-3 rounded-lg border-2 border-amber-400 bg-amber-50 text-sm text-amber-700">
                    <strong>Verification pending!</strong> A 6-digit code was sent to <strong>{registrationOtpChannel}</strong>.{" "}
                    <button type="button" className="underline font-medium" onClick={() => setRegistrationOtpDialogOpen(true)}>Enter code</button>
                  </div>
                )}

                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="agent-reg-name" className="text-gray-700 text-sm font-medium">Full Name</Label>
                    <Input id="agent-reg-name" {...registerForm.register("fullName")} placeholder="Your full name" autoFocus />
                    {registerForm.formState.errors.fullName && (
                      <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.fullName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="agent-reg-email" className="text-gray-700 text-sm font-medium">Email Address</Label>
                    <Input id="agent-reg-email" {...registerForm.register("email")} type="email" placeholder="agent@example.com" />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="agent-reg-mobile" className="text-gray-700 text-sm font-medium">Mobile Number</Label>
                    <Input id="agent-reg-mobile" {...registerForm.register("mobile")} type="tel" placeholder="9876543210" maxLength={10} />
                    {registerForm.formState.errors.mobile && (
                      <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.mobile.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="agent-reg-pass" className="text-gray-700 text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="agent-reg-pass"
                        {...registerForm.register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="agent-reg-confirm" className="text-gray-700 text-sm font-medium">Confirm Password</Label>
                    <Input
                      id="agent-reg-confirm"
                      {...registerForm.register("confirmPassword")}
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                    />
                    {registerForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600 mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Agent Account
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-400 mt-6">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setAuthMode("login")}
                    className="text-blue-600 font-medium hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Shared dialogs */}
        {/* Forgot Password Dialog */}
        <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{resetPasswordStep === "request" ? "Reset Password" : "Enter OTP & New Password"}</DialogTitle>
              <DialogDescription>
                {resetPasswordStep === "request"
                  ? "Enter your email or mobile number to receive a password reset OTP"
                  : "Enter the OTP sent to your email/mobile and your new password"}
              </DialogDescription>
            </DialogHeader>
            {resetPasswordStep === "request" ? (
              <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="agent-forgot-id">Email or Mobile Number</Label>
                  <Input id="agent-forgot-id" {...forgotPasswordForm.register("identifier")} placeholder="user@example.com or 9876543210" />
                  {forgotPasswordForm.formState.errors.identifier && (
                    <p className="text-sm text-red-600 mt-1">{forgotPasswordForm.formState.errors.identifier.message}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setForgotPasswordOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={forgotPasswordMutation.isPending}>
                    {forgotPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send OTP
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
                <div>
                  <Label>OTP Code</Label>
                  <Input {...resetPasswordForm.register("otp")} placeholder="6-digit OTP" maxLength={6} />
                  {resetPasswordForm.formState.errors.otp && <p className="text-sm text-red-600 mt-1">{resetPasswordForm.formState.errors.otp.message}</p>}
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input {...resetPasswordForm.register("newPassword")} type="password" placeholder="New password" />
                  {resetPasswordForm.formState.errors.newPassword && <p className="text-sm text-red-600 mt-1">{resetPasswordForm.formState.errors.newPassword.message}</p>}
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input {...resetPasswordForm.register("confirmPassword")} type="password" placeholder="Confirm password" />
                  {resetPasswordForm.formState.errors.confirmPassword && <p className="text-sm text-red-600 mt-1">{resetPasswordForm.formState.errors.confirmPassword.message}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setResetPasswordStep("request")}>Back</Button>
                  <Button type="submit" className="flex-1" disabled={resetPasswordMutation.isPending}>
                    {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reset Password
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* OTP Verification Dialog */}
        <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LucideShield className="h-5 w-5 text-blue-600" />
                Enter Verification Code
              </DialogTitle>
              <DialogDescription>We've sent a 6-digit code to <strong>{otpChannel}</strong></DialogDescription>
            </DialogHeader>
            <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <Clock className="h-4 w-4" />
                  {otpTimer > 0 ? `Code expires in ${formatTime(otpTimer)}` : "Code expired"}
                </div>
                {canResendOtp && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleResendOtp} disabled={otpSending} className="text-blue-600 h-auto p-0 hover:bg-transparent">
                    {otpSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-3 w-3 mr-1" />Resend</>}
                  </Button>
                )}
              </div>
              <div>
                <Label>6-Digit Code</Label>
                <Input {...otpForm.register("otp")} placeholder="000000" maxLength={6} autoFocus className="text-center text-2xl tracking-widest font-mono mt-1" />
                {otpForm.formState.errors.otp && <p className="text-sm text-red-600 mt-1">{otpForm.formState.errors.otp.message}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setOtpDialogOpen(false); otpForm.reset(); setLoginStep("credentials"); }}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={otpVerificationMutation.isPending}>
                  {otpVerificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Code
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <SessionConflictDialog
          open={sessionConflictOpen}
          sessionCount={sessionCount}
          onContinue={handleContinueSession}
          onForceLogout={handleForceLogout}
        />

        {/* Registration OTP Verification Dialog */}
        <Dialog open={registrationOtpDialogOpen} onOpenChange={setRegistrationOtpDialogOpen}>
          <DialogContent
            className="sm:max-w-md"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LucideShield className="h-5 w-5 text-blue-600" />
                Verify Your Email & Mobile
              </DialogTitle>
              <DialogDescription>
                We've sent a 6-digit code to <strong>{registrationOtpChannel}</strong>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const otp = formData.get('agent-registration-otp') as string;
              if (otp && otp.length === 6) {
                registrationOtpVerificationMutation.mutate(otp);
              }
            }} className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
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
                      className="text-blue-600"
                    >
                      {registrationOtpSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <><RefreshCw className="h-3 w-3 mr-1" />Resend</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="agent-registration-otp">6-Digit Code</Label>
                <Input
                  id="agent-registration-otp"
                  name="agent-registration-otp"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  className="text-center text-2xl tracking-widest font-mono mt-1"
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
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={registrationOtpVerificationMutation.isPending}
                >
                  {registrationOtpVerificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify & Create Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Registration Success — show Agent User ID */}
        <Dialog open={showUserIdDialog} onOpenChange={setShowUserIdDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <DialogTitle className="text-center">Registration Successful!</DialogTitle>
              <DialogDescription className="text-center">
                Welcome to FintekPro Agent Portal! Your account has been created.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50">
                <p className="text-sm text-muted-foreground mb-2 text-center">Your unique Agent ID:</p>
                <div className="flex items-center justify-center gap-2">
                  <Badge className="text-lg px-4 py-2 bg-blue-600 text-white">
                    {registeredUserId}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Save this ID — you can use it to login along with email or mobile
                </p>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  You can now sign in using your email, mobile number, or this Agent ID with your password.
                </AlertDescription>
              </Alert>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  setShowUserIdDialog(false);
                  navigate(portalHomeRoute);
                }}
              >
                Go to Agent Dashboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Duplicate account warning */}
        <Dialog open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-yellow-100 p-3">
                  <AlertCircle className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
              <DialogTitle className="text-center">Possible Duplicate Account</DialogTitle>
              <DialogDescription className="text-center">
                We found {duplicateWarnings.length} existing {duplicateWarnings.length === 1 ? 'account' : 'accounts'} with similar contact information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border rounded-lg divide-y">
                {duplicateWarnings.map((duplicate, index) => (
                  <div key={index} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{duplicate.name || "Unknown User"}</span>
                      <Badge variant="outline" className="text-xs">User ID: {duplicate.userId}</Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {duplicate.emailMatch && (
                        <Badge variant="secondary" className="text-xs"><Mail className="h-3 w-3 mr-1" />Email Match</Badge>
                      )}
                      {duplicate.mobileMatch && (
                        <Badge variant="secondary" className="text-xs"><Phone className="h-3 w-3 mr-1" />Mobile Match</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{duplicate.message}</p>
                  </div>
                ))}
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  If this is your existing account, please login instead. If you're a different agent, you can still proceed.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => {
                    setDuplicateWarningOpen(false);
                    setAuthMode("login");
                    toast({ title: "Switched to Login", description: "Please login with your existing account" });
                  }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Login Instead
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setDuplicateWarningOpen(false);
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
                >
                  Proceed Anyway
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  // ── End Agent Portal layout ───────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(135deg, ${portalColor}08 0%, ${portalColor}15 100%)` }}>
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Hero Section */}
          <div className="lg:pr-8">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Welcome to <span style={{ color: portalColor }}>{portalLabel}</span>
              </h1>
              <p className="text-sm font-medium mb-4" style={{ color: portalColor }}>{portalTagline}</p>
              <p className="text-xl text-muted-foreground mb-8">
                {portalDesc.hero}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {portalDesc.features.map((feature, index) => {
                  const IconComponent = featureIcons[feature.icon as keyof typeof featureIcons] || LucideShield;
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
                  <img
                    src={PORTAL_LOGO_MAP[portalType] || PORTAL_LOGO_MAP.main}
                    alt={portalLabel}
                    className="h-16 object-contain"
                  />
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
                                {loginStep === "complete" ? <CheckCircle2 className="h-4 w-4" /> : <LucideShield className="h-4 w-4" />}
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
                            <LucideShield className="h-4 w-4" style={{ color: portalColor }} />
                            <AlertDescription className="text-sm" style={{ color: portalColor }}>
                              After entering credentials, you'll receive a 6-digit OTP via email/SMS for verification.
                            </AlertDescription>
                          </Alert>

                          {portalType === 'main' && (
                            <p className="text-xs text-center text-muted-foreground">
                              Financial Agent?{" "}
                              <a href="https://agent.fintekpro.com" className="font-medium underline" style={{ color: portalColor }}>
                                Agent Portal
                              </a>
                            </p>
                          )}
                          {(portalType === 'agent' || portalType === 'partner') && (
                            <p className="text-xs text-center text-muted-foreground">
                              Investor / Client?{" "}
                              <a href="https://fintekpro.com" className="font-medium underline" style={{ color: portalColor }}>
                                Login on FintekPro
                              </a>
                            </p>
                          )}

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
                                <LucideShield className="h-4 w-4 mr-2" />
                                Enter Verification Code
                              </Button>
                            </AlertDescription>
                          </Alert>
                        )}

                        <Alert className="border" style={{ backgroundColor: `${portalColor}08`, borderColor: `${portalColor}30` }}>
                          <Info className="h-4 w-4" style={{ color: portalColor }} />
                          <AlertDescription className="text-sm" style={{ color: portalColor }}>
                            {portalType === 'agent'
                              ? <>You'll receive a unique Agent ID on registration. Your account will be active immediately — use your email or ID to log in.</>
                              : portalType === 'partner'
                              ? <>Partner accounts are created with <strong>Pending</strong> approval status. Admin will verify and activate your account.</>
                              : <>Upon registration, you'll receive a unique User ID in the format <strong>FTP001234</strong>. Save it for future logins!</>
                            }
                          </AlertDescription>
                        </Alert>

                        {portalType === 'main' && (
                          <p className="text-xs text-center text-muted-foreground">
                            Financial Agent?{" "}
                            <a href="https://agent.fintekpro.com?mode=register" className="font-medium underline" style={{ color: portalColor }}>
                              Register on the Agent Portal
                            </a>
                          </p>
                        )}
                        {(portalType === 'agent' || portalType === 'partner') && (
                          <p className="text-xs text-center text-muted-foreground">
                            Client/Investor?{" "}
                            <a href="https://fintekpro.com" className="font-medium underline" style={{ color: portalColor }}>
                              Register on FintekPro
                            </a>
                          </p>
                        )}

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
              <LucideShield className="h-5 w-5" style={{ color: portalColor }} />
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
              <LucideShield className="h-5 w-5" style={{ color: portalColor }} />
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
                navigate(portalHomeRoute);
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

      {/* ── PIN Entry Dialog (trusted device login) ── */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => { if (!open) { setPinDialogOpen(false); setLoginStep("credentials"); setPinValue(""); setPinError(""); } }}>
        <DialogContent className="sm:max-w-[380px] text-center">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                <Lock className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold">Enter your PIN</DialogTitle>
            <DialogDescription>
              Trusted device recognised. Enter your 4-digit PIN to log in instantly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 4-digit PIN input boxes */}
            <div className="flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  id={`pin-digit-${i}`}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-blue-500 focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                  value={pinValue[i] || ""}
                  onChange={(e) => {
                    const digit = e.target.value.replace(/\D/g, "").slice(-1);
                    const next = (pinValue + "").split("");
                    next[i] = digit;
                    const updated = next.join("").slice(0, 4);
                    setPinValue(updated);
                    setPinError("");
                    // Auto-advance
                    if (digit && i < 3) {
                      document.getElementById(`pin-digit-${i + 1}`)?.focus();
                    }
                    // Auto-submit when all 4 entered
                    if (updated.length === 4) {
                      pinEntryMutation.mutate({ identifier: pinIdentifier, pin: updated });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !pinValue[i] && i > 0) {
                      document.getElementById(`pin-digit-${i - 1}`)?.focus();
                    }
                  }}
                  data-testid={`pin-digit-${i}`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-sm text-red-500 flex items-center justify-center gap-1">
                <AlertCircle className="h-4 w-4" /> {pinError}
              </p>
            )}

            <Button
              className="w-full"
              disabled={pinValue.length !== 4 || pinEntryMutation.isPending}
              onClick={() => pinEntryMutation.mutate({ identifier: pinIdentifier, pin: pinValue })}
              data-testid="button-submit-pin"
            >
              {pinEntryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Verify PIN
            </Button>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
              onClick={() => {
                setPinDialogOpen(false);
                setPinValue("");
                setPinError("");
                setLoginStep("credentials");
                // Trigger OTP flow by re-submitting credentials
                const creds = loginForm.getValues();
                if (creds.identifier && creds.password) {
                  // Force OTP path by submitting again — backend will send OTP for unrecognised flow
                  loginMutation.mutate(creds);
                }
              }}
              data-testid="link-use-otp-instead"
            >
              Forgot PIN? Use OTP instead
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PIN Setup Dialog (after first OTP verification) ── */}
      <Dialog open={pinSetupDialogOpen} onOpenChange={(open) => { if (!open) { setPinSetupDialogOpen(false); navigate(portalHomeRoute); } }}>
        <DialogContent className="sm:max-w-[400px] text-center">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <LucideShield className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold">Create your Login PIN</DialogTitle>
            <DialogDescription>
              Set a 4-digit PIN for faster, OTP-free logins on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-4">
              {/* PIN input */}
              <div>
                <p className="text-sm font-medium text-left mb-2">Choose a 4-digit PIN</p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      id={`pin-setup-digit-${i}`}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-green-500 focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                      value={pinSetupValue[i] || ""}
                      onChange={(e) => {
                        const digit = e.target.value.replace(/\D/g, "").slice(-1);
                        const next = pinSetupValue.split("");
                        next[i] = digit;
                        setPinSetupValue(next.join("").slice(0, 4));
                        setPinError("");
                        if (digit && i < 3) document.getElementById(`pin-setup-digit-${i + 1}`)?.focus();
                        if (i === 3 && digit) document.getElementById("pin-confirm-digit-0")?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pinSetupValue[i] && i > 0) {
                          document.getElementById(`pin-setup-digit-${i - 1}`)?.focus();
                        }
                      }}
                      data-testid={`pin-setup-digit-${i}`}
                    />
                  ))}
                </div>
              </div>

              {/* Confirm PIN */}
              <div>
                <p className="text-sm font-medium text-left mb-2">Confirm your PIN</p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      id={`pin-confirm-digit-${i}`}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:border-green-500 focus:outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white transition-all"
                      value={pinSetupConfirm[i] || ""}
                      onChange={(e) => {
                        const digit = e.target.value.replace(/\D/g, "").slice(-1);
                        const next = pinSetupConfirm.split("");
                        next[i] = digit;
                        setPinSetupConfirm(next.join("").slice(0, 4));
                        setPinError("");
                        if (digit && i < 3) document.getElementById(`pin-confirm-digit-${i + 1}`)?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pinSetupConfirm[i] && i > 0) {
                          document.getElementById(`pin-confirm-digit-${i - 1}`)?.focus();
                        }
                      }}
                      data-testid={`pin-confirm-digit-${i}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {pinError && (
              <p className="text-sm text-red-500 flex items-center justify-center gap-1">
                <AlertCircle className="h-4 w-4" /> {pinError}
              </p>
            )}

            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={pinSetupValue.length !== 4 || pinSetupConfirm.length !== 4 || pinSetupMutation.isPending}
              onClick={() => {
                if (pinSetupValue !== pinSetupConfirm) {
                  setPinError("PINs do not match. Please try again.");
                  setPinSetupConfirm("");
                  return;
                }
                pinSetupMutation.mutate(pinSetupValue);
              }}
              data-testid="button-set-pin"
            >
              {pinSetupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LucideShield className="h-4 w-4 mr-2" />}
              Set PIN & Continue
            </Button>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
              onClick={() => { setPinSetupDialogOpen(false); navigate(portalHomeRoute); }}
              data-testid="link-skip-pin"
            >
              Skip for now
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
