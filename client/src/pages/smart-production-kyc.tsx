import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle,
  Loader2,
  AlertCircle,
  Shield,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  User,
  Building,
  Globe,
  Upload,
  FileText,
  Award,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDropzone } from "react-dropzone";

type UserType = "individual" | "corporate" | "nri";

type WorkflowStep =
  | "user_type_selection"
  | "pan_verification"
  | "entity_details" // For corporate/NRI additional details
  | "kra_check"
  | "cashfree_ekyc"
  | "cersai_submission"
  | "bse_ucc"
  | "completed";

interface ProductionKycSession {
  id: string;
  currentStep: string;
  panNumber?: string;
  panVerified?: boolean;
  kraVerified?: boolean;
  cashfreeVerified?: boolean;
  cersaiSubmitted?: boolean;
  uccCreated?: boolean;
  uccNumber?: string;
  expiresAt?: string;
}

interface TierStatusResponse {
  currentTier: string | null;
  currentTierName: string | null;
  currentTierDescription: string | null;
  eligibleForUpgrade: boolean;
  nextTier: string | null;
  nextTierName: string | null;
  nextTierDescription: string | null;
  completedVerifications: Array<{ code: string; name: string }>;
  missingVerifications: Array<{ code: string; name: string }>;
  unlockedFeatures: string[];
}

export default function SmartProductionKYCOnboarding() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // User type selection
  const [userType, setUserType] = useState<UserType>("individual");
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("user_type_selection");

  // PAN verification state
  const [panNumber, setPanNumber] = useState("");
  const [panFullName, setPanFullName] = useState("");
  const [panDob, setPanDob] = useState("");
  const [panVerified, setPanVerified] = useState(false);
  const [panData, setPanData] = useState<any>(null);
  
  // PAN sub-step state machine (check → verify)
  const [panSubStep, setPanSubStep] = useState<"check" | "verify">("check");

  // Production KYC session
  const [sessionId, setSessionId] = useState<string>("");
  const [productionSession, setProductionSession] = useState<ProductionKycSession | null>(null);

  // Aadhaar eKYC state
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [aadhaarOtp, setAadhaarOtp] = useState("");
  const [aadhaarOtpSent, setAadhaarOtpSent] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [transactionId, setTransactionId] = useState("");

  // Polling for KRA status
  const [kraPollingEnabled, setKraPollingEnabled] = useState(false);

  // Corporate-specific state
  const [entityType, setEntityType] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cin, setCin] = useState("");
  const [gstin, setGstin] = useState("");
  const [incorporationDate, setIncorporationDate] = useState("");
  const [entityRegistrationNumber, setEntityRegistrationNumber] = useState("");

  // NRI-specific state
  const [residentStatus, setResidentStatus] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [overseasAddress, setOverseasAddress] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [repatriationType, setRepatriationType] = useState("");

  // Session management
  const [existingSessionDialogOpen, setExistingSessionDialogOpen] = useState(false);
  const [existingSession, setExistingSession] = useState<any>(null);

  // Tier 3: Accredited Investor state
  const [aiVerificationId, setAiVerificationId] = useState("");
  const [aiCurrentStep, setAiCurrentStep] = useState<"init" | "ca_upload" | "esign" | "bse_submit" | "completed">("init");
  const [aiVerificationBasis, setAiVerificationBasis] = useState<"networth" | "income" | "both">("networth");
  const [aiNetWorthAmount, setAiNetWorthAmount] = useState("");
  const [aiAnnualIncomeAmount, setAiAnnualIncomeAmount] = useState("");
  const [aiCaCertificates, setAiCaCertificates] = useState<File[]>([]);
  const [aiCaCertificateName, setAiCaCertificateName] = useState("");
  const [aiCaCertificateNumber, setAiCaCertificateNumber] = useState("");
  const [aiESignTransactionId, setAiESignTransactionId] = useState("");
  const [aiCertificateNumber, setAiCertificateNumber] = useState("");
  const [aiCertificateId, setAiCertificateId] = useState("");
  const [aiCertificateUrl, setAiCertificateUrl] = useState("");
  const [aiExpiryDate, setAiExpiryDate] = useState("");
  const [showAiWorkflow, setShowAiWorkflow] = useState(false);

  // Authentication guard
  useEffect(() => {
    if (!isLoading && !user) {
      toast({
        title: "Authentication Required",
        description: "Please login to access KYC onboarding",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [user, isLoading, setLocation, toast]);

  // Check for existing session on page load
  useEffect(() => {
    if (user && !isLoading) {
      checkExistingSession();
    }
  }, [user, isLoading]);

  // Handle browser back button for PAN sub-step navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.panSubStep) {
        setPanSubStep(event.state.panSubStep);
      } else if (panSubStep === "verify") {
        // Back button pressed from verify step
        setPanSubStep("check");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [panSubStep]);

  // Check for existing in-progress session
  const checkExistingSession = async () => {
    try {
      const response = await apiRequest("POST", "/api/kyc/production/check-session", {});
      if (response.hasSession && response.session) {
        setExistingSession(response.session);
        setExistingSessionDialogOpen(true);
      }
    } catch (error) {
      // No session or error, proceed normally
      console.error("Session check error:", error);
    }
  };

  // Resume existing session
  const handleResumeSession = () => {
    if (existingSession) {
      // Restore session state
      setSessionId(existingSession.id);
      setUserType(existingSession.userType || "individual");
      setCurrentStep(existingSession.currentStep || "pan_verification");
      setPanNumber(existingSession.panNumber || "");
      setPanVerified(existingSession.panVerified || false);
      
      // Close dialog
      setExistingSessionDialogOpen(false);
      
      toast({
        title: "Session Resumed",
        description: `Continuing from ${existingSession.currentStep} step`,
      });
    }
  };

  // Cancel existing session mutation
  const cancelSessionMutation = useMutation({
    mutationFn: async (sessionIdToCancel: string) => {
      return await apiRequest("POST", "/api/kyc/production/cancel-session", {
        body: { sessionId: sessionIdToCancel },
      });
    },
    onSuccess: () => {
      setExistingSession(null);
      setExistingSessionDialogOpen(false);
      toast({
        title: "Session Cancelled",
        description: "Previous KYC session has been cancelled. You can start a new one.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel session",
        variant: "destructive",
      });
    },
  });

  // Handle cancel session
  const handleCancelSession = () => {
    if (existingSession?.id) {
      cancelSessionMutation.mutate(existingSession.id);
    }
  };

  // Check if PAN exists in database
  const checkPanMutation = useMutation({
    mutationFn: async (pan: string) => {
      return await apiRequest("POST", "/api/kyc/production/check-pan", {
        body: { panNumber: pan },
      });
    },
    onSuccess: (data) => {
      if (data.exists) {
        // PAN exists, use stored data
        setPanVerified(true);
        setPanData(data.panData);
        toast({
          title: "PAN Found",
          description: "Using your verified PAN details from our records",
        });
        // Move to next step based on user type
        if (userType === "individual") {
          setCurrentStep("kra_check");
        } else {
          setCurrentStep("entity_details");
        }
      } else {
        // PAN not found, transition to verify sub-step
        setPanSubStep("verify");
        // Push history state for back button support
        window.history.pushState({ panSubStep: "verify" }, "");
        toast({
          title: "PAN Not Found",
          description: "Please enter your details to verify your PAN",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to check PAN",
        variant: "destructive",
      });
    },
  });

  // Verify PAN via Sandbox API
  const verifyPanMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/verify-pan", {
        body: {
          panNumber: panNumber.toUpperCase(),
          fullName: panFullName,
          dob: panDob,
        },
      });
    },
    onSuccess: (response) => {
      // Backend wraps response as { success: true, data: { success: true, panData: {...} } }
      const { success, panData } = response.data;
      if (success) {
        setPanVerified(true);
        setPanData(panData);
        toast({
          title: "PAN Verified",
          description: "Your PAN has been verified and saved",
        });
        // Move to next step based on user type
        if (userType === "individual") {
          setCurrentStep("kra_check");
        } else {
          setCurrentStep("entity_details");
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "PAN Verification Failed",
        description: error.message || "Failed to verify PAN",
        variant: "destructive",
      });
    },
  });

  // Fetch KYC Tier Status
  const { data: tierStatus, isLoading: tierStatusLoading, refetch: refetchTierStatus } = useQuery<TierStatusResponse>({
    queryKey: ["/api/kyc/production/tier-status"],
    enabled: !!user && !isLoading,
  });

  // Initiate Tier Upgrade
  const upgradeTierMutation = useMutation({
    mutationFn: async (targetTier: string) => {
      return await apiRequest("POST", "/api/kyc/production/upgrade", {
        body: { targetTier },
      });
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast({
          title: "Upgrade Initiated",
          description: `Successfully upgraded to ${data.newTier}. Let's complete additional verifications.`,
        });
        
        // Refetch tier status to get fresh missingVerifications
        const updatedStatus = await refetchTierStatus();
        const missing = updatedStatus.data?.missingVerifications || [];
        
        // Dynamically determine next step based on missing verifications
        // Priority mapping: PAN → KRA → AADHAAR → BANK_ACCOUNT → VIDEO_KYC → INCOME_PROOF → FATCA
        const stepMapping: Record<string, WorkflowStep> = {
          "PAN": "pan_verification",
          "KRA": "kra_check",
          "AADHAAR": "cashfree_ekyc",
          "BANK_ACCOUNT": "cashfree_ekyc",
          "VIDEO_KYC": "cashfree_ekyc",
          "INCOME_PROOF": "entity_details",
          "NET_WORTH_PROOF": "entity_details",
          "FATCA": "entity_details",
          "CERSAI": "cersai_submission",
          "UCC": "bse_ucc",
        };
        
        // Find the first missing verification and route to corresponding step
        if (missing.length > 0) {
          for (const verification of missing) {
            const step = stepMapping[verification.code];
            if (step) {
              setCurrentStep(step);
              toast({
                title: "Next Step",
                description: `Please complete ${verification.name}`,
              });
              return;
            }
          }
        }
        
        // If no missing verifications or no mapping found, mark as completed
        toast({
          title: "Upgrade Complete",
          description: "All verifications completed for this tier!",
        });
        setCurrentStep("completed");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Failed to initiate tier upgrade",
        variant: "destructive",
      });
    },
  });

  // Start production KYC workflow (KRA check)
  const startKycWorkflowMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/start", {
        body: {
          panNumber: panNumber.toUpperCase(),
          panDob,
          userType,
        },
      });
    },
    onSuccess: (data: any) => {
      if (data.success && data.session) {
        setSessionId(data.session.id);
        setProductionSession(data.session);
        
        // Check current step from session
        const step = data.session.currentStep;
        
        if (step === "kra_verified") {
          toast({
            title: "KRA Verified",
            description: "Your KRA is already verified. Proceeding to account setup...",
          });
          setCurrentStep("bse_ucc");
        } else if (step === "kra_check_pending") {
          toast({
            title: "KRA Check In Progress",
            description: "KRA verification is being processed. This may take up to 48 hours.",
          });
          setKraPollingEnabled(true);
        } else if (step === "kra_not_found" || step === "kra_timeout") {
          toast({
            title: "KRA Not Found",
            description: "Proceeding with Aadhaar eKYC verification",
          });
          setCurrentStep("cashfree_ekyc");
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start KYC workflow",
        variant: "destructive",
      });
    },
  });

  // Poll KRA status (auto-refresh every 15 seconds when pending)
  const { data: kycStatus } = useQuery({
    queryKey: ["/api/kyc/production/status", sessionId],
    enabled: !!sessionId && kraPollingEnabled,
    refetchInterval: 15000, // Poll every 15 seconds
  });

  // Update UI based on KRA polling results
  useEffect(() => {
    const statusData = kycStatus as any;
    if (statusData && statusData.session) {
      const step = statusData.session.currentStep;
      setProductionSession(statusData.session);

      if (step === "kra_verified") {
        setKraPollingEnabled(false);
        toast({
          title: "KRA Verified",
          description: "Your KRA has been verified successfully!",
        });
        setCurrentStep("bse_ucc");
      } else if (step === "kra_timeout" || step === "kra_not_found") {
        setKraPollingEnabled(false);
        toast({
          title: "KRA Verification Timeout",
          description: "Proceeding with alternate verification method",
        });
        setCurrentStep("cashfree_ekyc");
      }
    }
  }, [kycStatus, toast]);

  // Send Aadhaar OTP via Cashfree
  const sendAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/cashfree/init", {
        body: {
          sessionId,
          aadhaarNumber: aadhaarNumber.replace(/\s/g, ""),
        },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAadhaarOtpSent(true);
        setTransactionId(data.transactionId || "");
        toast({
          title: "OTP Sent",
          description: "Please check your registered mobile number for OTP",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP",
        variant: "destructive",
      });
    },
  });

  // Verify Aadhaar OTP and complete eKYC
  const verifyAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/cashfree/verify-otp", {
        body: {
          sessionId,
          otp: aadhaarOtp,
        },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Aadhaar Verified",
          description: "Your Aadhaar has been verified successfully",
        });
        setCurrentStep("cersai_submission");
        // Auto-submit to CERSAI
        submitCersaiMutation.mutate();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
    },
  });

  // Submit to CERSAI
  const submitCersaiMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/cersai/submit", {
        body: { sessionId },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "CKYC Uploaded",
          description: "Your KYC data has been uploaded to CERSAI",
        });
        setCurrentStep("bse_ucc");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload to CERSAI",
        variant: "destructive",
      });
    },
  });

  // Create BSE UCC
  const createUccMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/bse/create-ucc", {
        body: { sessionId },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Account Created",
          description: `Your BSE account has been created. UCC: ${data.uccNumber}`,
        });
        setCurrentStep("completed");
        queryClient.invalidateQueries({ queryKey: ["/api/kyc/my-profile"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create BSE account",
        variant: "destructive",
      });
    },
  });

  // ==================== TIER 3: ACCREDITED INVESTOR MUTATIONS ====================

  // Initiate AI verification
  const initiateAiVerificationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/accredited-investor/initiate", {
        body: {
          verificationBasis: aiVerificationBasis,
          netWorthAmount: aiNetWorthAmount ? parseFloat(aiNetWorthAmount) : undefined,
          annualIncomeAmount: aiAnnualIncomeAmount ? parseFloat(aiAnnualIncomeAmount) : undefined,
        },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAiVerificationId(data.verificationId);
        setAiCurrentStep("ca_upload");
        toast({
          title: "Verification Initiated",
          description: "Please upload your CA certificate to proceed",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate AI verification",
        variant: "destructive",
      });
    },
  });

  // Upload CA certificate with real file upload
  const uploadCaCertificateMutation = useMutation({
    mutationFn: async () => {
      // Upload files to object storage first
      const uploadedUrls: string[] = [];
      
      for (const file of aiCaCertificates) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload file to object storage
        const uploadResponse = await fetch('/api/kyc/production/accredited-investor/upload-file', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.message || 'File upload failed');
        }
        
        const uploadData = await uploadResponse.json();
        uploadedUrls.push(uploadData.fileUrl);
      }
      
      // Use the first uploaded file URL (primary certificate)
      const caCertificateUrl = uploadedUrls[0];
      
      // Now submit metadata to the upload-ca endpoint
      return await apiRequest("POST", "/api/kyc/production/accredited-investor/upload-ca", {
        body: {
          verificationId: aiVerificationId,
          caCertificateUrl,
          caCertificateName: aiCaCertificateName,
          caCertificateNumber: aiCaCertificateNumber,
        },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAiCurrentStep("esign");
        toast({
          title: "Certificate Uploaded",
          description: `${aiCaCertificates.length} file(s) uploaded successfully. Proceeding to eSign risk declaration.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CA certificate",
        variant: "destructive",
      });
    },
  });

  // Initiate eSign
  const initiateESignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/accredited-investor/esign-initiate", {
        body: { verificationId: aiVerificationId },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAiESignTransactionId(data.transactionId);
        toast({
          title: "eSign Initiated",
          description: data.message || "Digital signature initiated successfully",
        });
        // In simulation mode, eSign completes immediately
        // In production, user would be redirected to eSign provider
        setTimeout(() => {
          setAiCurrentStep("bse_submit");
          submitBseMutation.mutate();
        }, 2000);
      }
    },
    onError: (error: any) => {
      toast({
        title: "eSign Failed",
        description: error.message || "Failed to initiate eSign",
        variant: "destructive",
      });
    },
  });

  // Submit to BSE
  const submitBseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/kyc/production/accredited-investor/submit-bse", {
        body: { verificationId: aiVerificationId },
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAiCertificateNumber(data.certificateNumber || "");
        setAiCertificateId(data.certificateId || "");
        setAiCertificateUrl(data.certificateUrl || "");
        setAiExpiryDate(data.expiryDate || "");
        setAiCurrentStep("completed");
        toast({
          title: "AI Certificate Issued!",
          description: `Certificate Number: ${data.certificateNumber}`,
        });
        // Refresh tier status
        refetchTierStatus();
      }
    },
    onError: (error: any) => {
      toast({
        title: "BSE Submission Failed",
        description: error.message || "Failed to submit to BSE",
        variant: "destructive",
      });
    },
  });

  // Calculate progress percentage
  const getProgressPercentage = () => {
    // Different flow for individual vs corporate/NRI
    const individualSteps: WorkflowStep[] = [
      "user_type_selection",
      "pan_verification",
      "kra_check",
      "cashfree_ekyc",
      "cersai_submission",
      "bse_ucc",
      "completed",
    ];
    
    const corporateNriSteps: WorkflowStep[] = [
      "user_type_selection",
      "pan_verification",
      "entity_details",
      "kra_check",
      "cashfree_ekyc",
      "cersai_submission",
      "bse_ucc",
      "completed",
    ];
    
    const stepOrder = userType === "individual" ? individualSteps : corporateNriSteps;
    const currentIndex = stepOrder.indexOf(currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  };

  if (!user) {
    return null;
  }

  // Render KYC Status Card (if user has existing KYC)
  if (currentStep === "user_type_selection" && tierStatus?.currentTier) {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        {/* Current KYC Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Shield className="h-6 w-6 text-green-600" />
                  Your KYC Status
                </CardTitle>
                <CardDescription>
                  Current verification level and available features
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-4 py-2">
                {tierStatus.currentTierName}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tier Description */}
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Active KYC Tier</AlertTitle>
              <AlertDescription>{tierStatus.currentTierDescription}</AlertDescription>
            </Alert>

            {/* Completed Verifications */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Completed Verifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {tierStatus.completedVerifications?.map((verification: any) => (
                  <div
                    key={verification.code}
                    className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                    data-testid={`verification-${verification.code}`}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm">{verification.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlocked Features */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">
                Unlocked Products & Services
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {tierStatus.unlockedFeatures?.map((feature: string) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                    data-testid={`feature-${feature.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade Section */}
            {tierStatus.eligibleForUpgrade && tierStatus.nextTier && (
              <div className="space-y-3 pt-4 border-t">
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Upgrade Available
                </h3>
                <Alert>
                  <ArrowRight className="h-4 w-4" />
                  <AlertTitle>{tierStatus.nextTierName}</AlertTitle>
                  <AlertDescription>{tierStatus.nextTierDescription}</AlertDescription>
                </Alert>

                {/* Missing Verifications for Upgrade */}
                {tierStatus.missingVerifications && tierStatus.missingVerifications.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Additional verifications required:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {tierStatus.missingVerifications.map((verification: any) => (
                        <div
                          key={verification.code}
                          className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                          data-testid={`missing-${verification.code}`}
                        >
                          <Clock className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                          <span className="text-sm">{verification.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (tierStatus?.nextTier) {
                      upgradeTierMutation.mutate(tierStatus.nextTier);
                    }
                  }}
                  disabled={upgradeTierMutation.isPending}
                  className="w-full"
                  data-testid="button-upgrade-tier"
                >
                  {upgradeTierMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Upgrade to {tierStatus.nextTierName}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Already at Highest Tier */}
            {!tierStatus.eligibleForUpgrade && tierStatus.currentTier === "tier_3" && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle>Maximum KYC Level Achieved</AlertTitle>
                <AlertDescription>
                  You have completed the highest level of KYC verification. You have access to all premium features and products.
                </AlertDescription>
              </Alert>
            )}

            {/* Tier 3: Accredited Investor Upgrade (for tier_2 users) */}
            {tierStatus.currentTier === "tier_2" && (
              <div className="space-y-4 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-600" />
                      Tier 3: Accredited Investor
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unlock premium investment products (AIF, PMS, Structured Products)
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                    Premium
                  </Badge>
                </div>

                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>SEBI Eligibility Criteria</AlertTitle>
                  <AlertDescription className="text-sm space-y-1">
                    <div>✓ Annual Income: ₹2 Crore or above</div>
                    <div>✓ Net Worth: ₹7.5 Crore (excluding primary residence)</div>
                    <div>✓ CA Certified Net Worth/Income Statement required</div>
                  </AlertDescription>
                </Alert>

                {!showAiWorkflow ? (
                  <Button
                    onClick={() => setShowAiWorkflow(true)}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    data-testid="button-start-ai-upgrade"
                  >
                    <Award className="mr-2 h-4 w-4" />
                    Upgrade to Accredited Investor
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {/* Step Progress Indicator */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Verification Progress</span>
                        <span className="text-muted-foreground">
                          Step {aiCurrentStep === "init" ? 1 : aiCurrentStep === "ca_upload" ? 2 : aiCurrentStep === "esign" ? 3 : aiCurrentStep === "bse_submit" ? 4 : 5} of 5
                        </span>
                      </div>
                      <Progress 
                        value={
                          aiCurrentStep === "init" ? 20 :
                          aiCurrentStep === "ca_upload" ? 40 :
                          aiCurrentStep === "esign" ? 60 :
                          aiCurrentStep === "bse_submit" ? 80 :
                          100
                        } 
                        className="h-2" 
                      />
                    </div>

                    {/* Step 1: Initialize */}
                    {aiCurrentStep === "init" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Step 1: Verification Basis</CardTitle>
                          <CardDescription>
                            Select how you qualify as an Accredited Investor
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <Label>Verification Basis</Label>
                            <select
                              value={aiVerificationBasis}
                              onChange={(e) => setAiVerificationBasis(e.target.value as any)}
                              className="w-full p-2 border rounded-md"
                              data-testid="select-verification-basis"
                            >
                              <option value="networth">Net Worth (₹7.5 Cr+)</option>
                              <option value="income">Annual Income (₹2 Cr+)</option>
                              <option value="both">Both</option>
                            </select>
                          </div>

                          {(aiVerificationBasis === "networth" || aiVerificationBasis === "both") && (
                            <div>
                              <Label htmlFor="net-worth">Net Worth Amount (₹)</Label>
                              <Input
                                id="net-worth"
                                type="number"
                                placeholder="75000000"
                                value={aiNetWorthAmount}
                                onChange={(e) => setAiNetWorthAmount(e.target.value)}
                                data-testid="input-net-worth"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Excluding value of primary residence
                              </p>
                            </div>
                          )}

                          {(aiVerificationBasis === "income" || aiVerificationBasis === "both") && (
                            <div>
                              <Label htmlFor="annual-income">Annual Income Amount (₹)</Label>
                              <Input
                                id="annual-income"
                                type="number"
                                placeholder="20000000"
                                value={aiAnnualIncomeAmount}
                                onChange={(e) => setAiAnnualIncomeAmount(e.target.value)}
                                data-testid="input-annual-income"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Gross annual income for the current financial year
                              </p>
                            </div>
                          )}

                          <Button
                            onClick={() => initiateAiVerificationMutation.mutate()}
                            disabled={
                              initiateAiVerificationMutation.isPending ||
                              ((aiVerificationBasis === "networth" || aiVerificationBasis === "both") && !aiNetWorthAmount) ||
                              ((aiVerificationBasis === "income" || aiVerificationBasis === "both") && !aiAnnualIncomeAmount)
                            }
                            className="w-full"
                            data-testid="button-initiate-ai"
                          >
                            {initiateAiVerificationMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Initiating...
                              </>
                            ) : (
                              <>
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Step 2: CA Certificate Upload */}
                    {aiCurrentStep === "ca_upload" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Step 2: Upload CA Certificate</CardTitle>
                          <CardDescription>
                            Upload CA-certified Net Worth/Income statement (PDF only, max 5MB)
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-3">
                            <div>
                              <Label htmlFor="ca-name">CA Name</Label>
                              <Input
                                id="ca-name"
                                placeholder="e.g., CA Rajesh Kumar"
                                value={aiCaCertificateName}
                                onChange={(e) => setAiCaCertificateName(e.target.value)}
                                data-testid="input-ca-name"
                              />
                            </div>

                            <div>
                              <Label htmlFor="ca-number">CA Membership Number</Label>
                              <Input
                                id="ca-number"
                                placeholder="e.g., 123456"
                                value={aiCaCertificateNumber}
                                onChange={(e) => setAiCaCertificateNumber(e.target.value)}
                                data-testid="input-ca-number"
                              />
                            </div>

                            {/* PDF File Upload with react-dropzone */}
                            <div>
                              <Label>CA Certificate (PDF)</Label>
                              <div
                                className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                                  ${aiCaCertificates.length > 0 ? "border-green-300 bg-green-50 dark:bg-green-900/10" : "border-gray-300 hover:border-gray-400"}`}
                                onClick={() => {
                                  const input = document.createElement("input");
                                  input.type = "file";
                                  input.accept = ".pdf";
                                  input.multiple = true;
                                  input.onchange = (e: any) => {
                                    const files = Array.from(e.target.files || []) as File[];
                                    const validFiles = files.filter(
                                      (file) => file.type === "application/pdf" && file.size <= 5 * 1024 * 1024
                                    );
                                    if (validFiles.length !== files.length) {
                                      toast({
                                        title: "Invalid Files",
                                        description: "Some files were rejected. Only PDF files under 5MB are allowed.",
                                        variant: "destructive",
                                      });
                                    }
                                    setAiCaCertificates((prev) => [...prev, ...validFiles]);
                                  };
                                  input.click();
                                }}
                                data-testid="dropzone-ca-certificate"
                              >
                                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Click to upload PDF files (max 5MB each)
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Multiple files supported
                                </p>
                              </div>

                              {/* Uploaded Files Preview */}
                              {aiCaCertificates.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {aiCaCertificates.map((file, index) => (
                                    <div
                                      key={index}
                                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
                                      data-testid={`file-preview-${index}`}
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        <FileText className="h-4 w-4 text-red-600" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">{file.name}</p>
                                          <p className="text-xs text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                          </p>
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAiCaCertificates((prev) =>
                                            prev.filter((_, i) => i !== index)
                                          );
                                        }}
                                        data-testid={`button-remove-file-${index}`}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            onClick={() => uploadCaCertificateMutation.mutate()}
                            disabled={
                              uploadCaCertificateMutation.isPending ||
                              !aiCaCertificateName ||
                              !aiCaCertificateNumber ||
                              aiCaCertificates.length === 0
                            }
                            className="w-full"
                            data-testid="button-upload-ca"
                          >
                            {uploadCaCertificateMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                              </>
                            ) : (
                              <>
                                Upload & Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Step 3: eSign */}
                    {aiCurrentStep === "esign" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Step 3: Digital Signature (eSign)</CardTitle>
                          <CardDescription>
                            Sign the Risk Declaration document digitally
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertTitle>Risk Declaration</AlertTitle>
                            <AlertDescription>
                              You will digitally sign a declaration acknowledging the risks associated with
                              high-risk investment products including AIFs, PMS, and structured debt.
                            </AlertDescription>
                          </Alert>

                          <Button
                            onClick={() => initiateESignMutation.mutate()}
                            disabled={initiateESignMutation.isPending}
                            className="w-full"
                            data-testid="button-esign"
                          >
                            {initiateESignMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                Sign Document
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Step 4: BSE Submission */}
                    {aiCurrentStep === "bse_submit" && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Step 4: BSE API Submission</CardTitle>
                          <CardDescription>
                            Submitting to BSE for Accredited Investor certification
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertTitle>Processing...</AlertTitle>
                            <AlertDescription>
                              Your application is being submitted to BSE. This typically takes a few seconds.
                            </AlertDescription>
                          </Alert>
                        </CardContent>
                      </Card>
                    )}

                    {/* Step 5: Completed */}
                    {aiCurrentStep === "completed" && (
                      <Card className="border-green-200 bg-green-50 dark:bg-green-900/10">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                            <Award className="h-6 w-6" />
                            Accredited Investor Certificate Issued!
                          </CardTitle>
                          <CardDescription>
                            Congratulations! You are now a SEBI-certified Accredited Investor
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Certificate Number</p>
                              <p className="font-mono font-semibold" data-testid="text-cert-number">
                                {aiCertificateNumber}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Certificate ID</p>
                              <p className="font-mono font-semibold" data-testid="text-cert-id">
                                {aiCertificateId}
                              </p>
                            </div>
                          </div>

                          {aiExpiryDate && (
                            <div>
                              <p className="text-sm text-muted-foreground">Valid Until</p>
                              <p className="font-semibold" data-testid="text-cert-expiry">
                                {new Date(aiExpiryDate).toLocaleDateString("en-IN", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          )}

                          {aiCertificateUrl && (
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => window.open(aiCertificateUrl, "_blank")}
                              data-testid="button-download-cert"
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download Certificate
                            </Button>
                          )}

                          <Alert className="border-green-200">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertTitle>Tier 3 Unlocked</AlertTitle>
                            <AlertDescription>
                              You now have access to premium investment products including AIFs, PMS, 
                              structured products, and unlisted securities.
                            </AlertDescription>
                          </Alert>

                          <Button
                            onClick={() => {
                              setShowAiWorkflow(false);
                              setCurrentStep("user_type_selection");
                              refetchTierStatus();
                            }}
                            className="w-full"
                            data-testid="button-back-to-dashboard"
                          >
                            Back to Dashboard
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render User Type Selection
  if (currentStep === "user_type_selection") {
    return (
      <div className="container mx-auto p-6 max-w-4xl space-y-6">
        {/* KYC Tier Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Shield className="h-5 w-5" />
              3-Tier KYC System
            </CardTitle>
            <CardDescription>
              Progressive verification levels unlocking different products and services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier 1 */}
              <div className="p-4 border rounded-lg space-y-3 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/40">
                    Tier 1
                  </Badge>
                  <span className="text-xs text-muted-foreground">Basic KYC</span>
                </div>
                <h4 className="font-semibold text-sm">Essential Trading</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Stocks & Equity
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Mutual Funds
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    ETFs
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: PAN + KRA Verification
                </p>
              </div>

              {/* Tier 2 */}
              <div className="p-4 border rounded-lg space-y-3 bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/40">
                    Tier 2
                  </Badge>
                  <span className="text-xs text-muted-foreground">Enhanced KYC</span>
                </div>
                <h4 className="font-semibold text-sm">Advanced Products</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    All Tier 1 +
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    IPO Applications
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Bonds & Debentures
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    F&O Trading
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: Aadhaar + Bank Account
                </p>
              </div>

              {/* Tier 3 */}
              <div className="p-4 border rounded-lg space-y-3 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40">
                    Tier 3
                  </Badge>
                  <span className="text-xs text-muted-foreground">Accredited Investor</span>
                </div>
                <h4 className="font-semibold text-sm">Premium Access</h4>
                <ul className="text-xs space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    All Tier 2 +
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Private Equity
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Alternative Investments
                  </li>
                  <li className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    Structured Products
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Required: Income/Net Worth Proof
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Start Your KYC Journey</CardTitle>
            <CardDescription>
              Select your account type to begin the verification process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  setUserType("individual");
                  setCurrentStep("pan_verification");
                }}
                className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
                data-testid="button-select-individual"
              >
                <User className="h-12 w-12 mx-auto text-primary" />
                <h3 className="font-semibold">Individual</h3>
                <p className="text-sm text-muted-foreground">
                  For personal investments
                </p>
              </button>

              <button
                onClick={() => {
                  setUserType("corporate");
                  setCurrentStep("pan_verification");
                }}
                className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
                data-testid="button-select-corporate"
              >
                <Building className="h-12 w-12 mx-auto text-primary" />
                <h3 className="font-semibold">Corporate</h3>
                <p className="text-sm text-muted-foreground">
                  For businesses and entities
                </p>
              </button>

              <button
                onClick={() => {
                  setUserType("nri");
                  setCurrentStep("pan_verification");
                }}
                className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-all text-center space-y-3"
                data-testid="button-select-nri"
              >
                <Globe className="h-12 w-12 mx-auto text-primary" />
                <h3 className="font-semibold">NRI</h3>
                <p className="text-sm text-muted-foreground">
                  For Non-Resident Indians
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render PAN Verification (Two-Page Flow)
  if (currentStep === "pan_verification") {
    // Page 1: Check PAN (Database Lookup)
    if (panSubStep === "check") {
      return (
        <div className="container mx-auto p-6 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Check PAN</CardTitle>
                  <CardDescription>
                    Enter your PAN to check if it's already verified
                  </CardDescription>
                </div>
                <Badge variant="outline">{userType.toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress value={getProgressPercentage()} className="h-2" />

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Fast Database Lookup</AlertTitle>
                <AlertDescription>
                  We'll check if your PAN is already in our records. If found, you'll skip manual verification!
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="pan-number">PAN Number</Label>
                  <Input
                    id="pan-number"
                    data-testid="input-pan-number"
                    placeholder="ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="uppercase"
                    autoFocus
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Enter your 10-character PAN number
                  </p>
                </div>

                <Button
                  onClick={() => checkPanMutation.mutate(panNumber)}
                  disabled={
                    !panNumber || panNumber.length !== 10 || checkPanMutation.isPending
                  }
                  className="w-full"
                  data-testid="button-check-pan"
                >
                  {checkPanMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Check PAN
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Page 2: Verify PAN (API Verification)
    if (panSubStep === "verify") {
      return (
        <div className="container mx-auto p-6 max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Verify PAN</CardTitle>
                  <CardDescription>
                    Complete your PAN verification with government records
                  </CardDescription>
                </div>
                <Badge variant="outline">{userType.toUpperCase()}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Progress value={getProgressPercentage()} className="h-2" />

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Secure API Verification</AlertTitle>
                <AlertDescription>
                  Your details will be verified against Income Tax Department records via Sandbox API
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="pan-number-readonly">PAN Number</Label>
                  <Input
                    id="pan-number-readonly"
                    data-testid="input-pan-number-readonly"
                    value={panNumber}
                    readOnly
                    disabled
                    className="uppercase bg-muted"
                  />
                </div>

                <div>
                  <Label htmlFor="pan-name">Full Name (as per PAN)</Label>
                  <Input
                    id="pan-name"
                    data-testid="input-pan-name"
                    placeholder="Enter your full name exactly as on PAN card"
                    value={panFullName}
                    onChange={(e) => setPanFullName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <Label htmlFor="pan-dob">Date of Birth</Label>
                  <Input
                    id="pan-dob"
                    data-testid="input-pan-dob"
                    type="date"
                    value={panDob}
                    onChange={(e) => setPanDob(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setPanSubStep("check");
                      window.history.back();
                    }}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back-to-check"
                  >
                    <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                    Back
                  </Button>

                  <Button
                    onClick={() => verifyPanMutation.mutate()}
                    disabled={
                      !panNumber ||
                      !panFullName ||
                      !panDob ||
                      verifyPanMutation.isPending
                    }
                    className="flex-1"
                    data-testid="button-verify-pan"
                  >
                    {verifyPanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Verify PAN
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  // Render Entity Details (for Corporate and NRI)
  if (currentStep === "entity_details") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  {userType === "corporate" ? "Entity Details" : "Residency Information"}
                </CardTitle>
                <CardDescription>
                  {userType === "corporate"
                    ? "Provide your company/entity information"
                    : "Provide your residency and passport details"}
                </CardDescription>
              </div>
              <Badge variant="outline">{userType.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

            {userType === "corporate" ? (
              // Corporate Entity Fields
              <div className="space-y-4">
                <div>
                  <Label htmlFor="entity-type">Entity Type</Label>
                  <select
                    id="entity-type"
                    data-testid="select-entity-type"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select Entity Type</option>
                    <option value="company">Company/Private Limited</option>
                    <option value="partnership">Partnership Firm</option>
                    <option value="llp">Limited Liability Partnership (LLP)</option>
                    <option value="trust">Trust</option>
                    <option value="society">Society</option>
                    <option value="huf">Hindu Undivided Family (HUF)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="company-name">Company/Entity Name</Label>
                  <Input
                    id="company-name"
                    data-testid="input-company-name"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="cin">Corporate Identification Number (CIN)</Label>
                  <Input
                    id="cin"
                    data-testid="input-cin"
                    placeholder="L12345MH1234PLC123456"
                    value={cin}
                    onChange={(e) => setCin(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>

                <div>
                  <Label htmlFor="gstin">GSTIN (GST Number)</Label>
                  <Input
                    id="gstin"
                    data-testid="input-gstin"
                    placeholder="22AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    maxLength={15}
                    className="uppercase"
                  />
                </div>

                <div>
                  <Label htmlFor="incorporation-date">Incorporation Date</Label>
                  <Input
                    id="incorporation-date"
                    data-testid="input-incorporation-date"
                    type="date"
                    value={incorporationDate}
                    onChange={(e) => setIncorporationDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="registration-number">Entity Registration Number</Label>
                  <Input
                    id="registration-number"
                    data-testid="input-registration-number"
                    placeholder="Enter registration number"
                    value={entityRegistrationNumber}
                    onChange={(e) => setEntityRegistrationNumber(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              // NRI Fields
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resident-status">Residency Status</Label>
                  <select
                    id="resident-status"
                    data-testid="select-resident-status"
                    value={residentStatus}
                    onChange={(e) => setResidentStatus(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select Residency Status</option>
                    <option value="nri_ordinary">NRI - Ordinary Resident</option>
                    <option value="nri_non_ordinary">NRI - Non-Ordinary Resident</option>
                    <option value="oci">Overseas Citizen of India (OCI)</option>
                    <option value="pio">Person of Indian Origin (PIO)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="passport-number">Passport Number</Label>
                  <Input
                    id="passport-number"
                    data-testid="input-passport-number"
                    placeholder="Enter passport number"
                    value={passportNumber}
                    onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>

                <div>
                  <Label htmlFor="country-residence">Country of Residence</Label>
                  <Input
                    id="country-residence"
                    data-testid="input-country-residence"
                    placeholder="e.g., United States, United Kingdom"
                    value={countryOfResidence}
                    onChange={(e) => setCountryOfResidence(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="overseas-address">Overseas Address</Label>
                  <textarea
                    id="overseas-address"
                    data-testid="textarea-overseas-address"
                    placeholder="Enter your complete overseas address"
                    value={overseasAddress}
                    onChange={(e) => setOverseasAddress(e.target.value)}
                    className="w-full p-2 border rounded-md min-h-[80px]"
                  />
                </div>

                <div>
                  <Label htmlFor="repatriation-type">Repatriation Type</Label>
                  <select
                    id="repatriation-type"
                    data-testid="select-repatriation-type"
                    value={repatriationType}
                    onChange={(e) => setRepatriationType(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Select Repatriation Type</option>
                    <option value="repatriable">Repatriable (NRE)</option>
                    <option value="non_repatriable">Non-Repatriable (NRO)</option>
                  </select>
                </div>
              </div>
            )}

            <Button
              onClick={() => {
                // Validate fields based on user type
                if (userType === "corporate") {
                  if (!entityType || !companyName) {
                    toast({
                      title: "Missing Information",
                      description: "Please fill in all required fields",
                      variant: "destructive",
                    });
                    return;
                  }
                } else if (userType === "nri") {
                  if (!residentStatus || !passportNumber || !countryOfResidence) {
                    toast({
                      title: "Missing Information",
                      description: "Please fill in all required fields",
                      variant: "destructive",
                    });
                    return;
                  }
                }
                
                // Proceed to KRA check
                setCurrentStep("kra_check");
                toast({
                  title: "Details Saved",
                  description: "Proceeding to KRA verification",
                });
              }}
              className="w-full"
              data-testid="button-continue-entity-details"
            >
              Continue to KYC Verification
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render KRA Check
  if (currentStep === "kra_check") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">KRA Status Check</CardTitle>
            <CardDescription>
              Checking your KRA registration status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

            {panVerified && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>PAN Verified</AlertTitle>
                <AlertDescription>
                  PAN: {panNumber} | Name: {panData?.name || panFullName}
                </AlertDescription>
              </Alert>
            )}

            {!sessionId && (
              <Button
                onClick={() => startKycWorkflowMutation.mutate()}
                disabled={startKycWorkflowMutation.isPending}
                className="w-full"
                data-testid="button-start-kra-check"
              >
                {startKycWorkflowMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking KRA Status...
                  </>
                ) : (
                  <>
                    Start KYC Verification
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}

            {kraPollingEnabled && (
              <Alert>
                <Clock className="h-4 w-4 animate-pulse" />
                <AlertTitle>KRA Verification In Progress</AlertTitle>
                <AlertDescription>
                  Your KRA verification is being processed. This may take up to 48 hours.
                  We're checking every 15 seconds for updates.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Cashfree Aadhaar eKYC
  if (currentStep === "cashfree_ekyc") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Aadhaar eKYC Verification</CardTitle>
            <CardDescription>
              Verify your identity using Aadhaar OTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

            <div className="space-y-4">
              <div>
                <Label htmlFor="aadhaar-number">Aadhaar Number</Label>
                <Input
                  id="aadhaar-number"
                  data-testid="input-aadhaar-number"
                  placeholder="XXXX XXXX XXXX"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value)}
                  maxLength={14}
                  disabled={aadhaarOtpSent}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="consent"
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(!!checked)}
                  data-testid="checkbox-aadhaar-consent"
                />
                <label
                  htmlFor="consent"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I consent to Aadhaar-based verification
                </label>
              </div>

              {!aadhaarOtpSent ? (
                <Button
                  onClick={() => sendAadhaarOtpMutation.mutate()}
                  disabled={
                    !aadhaarNumber ||
                    !consentGiven ||
                    sendAadhaarOtpMutation.isPending
                  }
                  className="w-full"
                  data-testid="button-send-aadhaar-otp"
                >
                  {sendAadhaarOtpMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              ) : (
                <>
                  <div>
                    <Label htmlFor="aadhaar-otp">Enter OTP</Label>
                    <Input
                      id="aadhaar-otp"
                      data-testid="input-aadhaar-otp"
                      placeholder="Enter 6-digit OTP"
                      value={aadhaarOtp}
                      onChange={(e) => setAadhaarOtp(e.target.value)}
                      maxLength={6}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => verifyAadhaarOtpMutation.mutate()}
                      disabled={
                        !aadhaarOtp ||
                        aadhaarOtp.length !== 6 ||
                        verifyAadhaarOtpMutation.isPending
                      }
                      className="flex-1"
                      data-testid="button-verify-aadhaar-otp"
                    >
                      {verifyAadhaarOtpMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify OTP"
                      )}
                    </Button>

                    <Button
                      onClick={() => {
                        setAadhaarOtpSent(false);
                        setAadhaarOtp("");
                      }}
                      variant="outline"
                      data-testid="button-resend-otp"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render CERSAI Submission
  if (currentStep === "cersai_submission") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">CKYC Upload</CardTitle>
            <CardDescription>
              Uploading your KYC data to CERSAI
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Processing...</AlertTitle>
              <AlertDescription>
                Your KYC data is being uploaded to the central registry
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render BSE UCC Creation
  if (currentStep === "bse_ucc") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Account Creation</CardTitle>
            <CardDescription>
              Creating your BSE trading account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

            <Button
              onClick={() => createUccMutation.mutate()}
              disabled={createUccMutation.isPending}
              className="w-full"
              data-testid="button-create-ucc"
            >
              {createUccMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create BSE Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Completion
  if (currentStep === "completed") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              KYC Completed Successfully!
            </CardTitle>
            <CardDescription>
              Your account is now fully verified and ready to use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={100} className="h-2" />

            {productionSession?.uccNumber && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>BSE Account Created</AlertTitle>
                <AlertDescription>
                  Your UCC Number: <strong>{productionSession.uccNumber}</strong>
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={() => setLocation("/dashboard")}
              className="w-full"
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session Management Dialog
  return (
    <>
      <Dialog open={existingSessionDialogOpen} onOpenChange={setExistingSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existing KYC Session Found</DialogTitle>
            <DialogDescription>
              You have an incomplete KYC session. Would you like to resume where you left off or start fresh?
            </DialogDescription>
          </DialogHeader>
          
          {existingSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">User Type</p>
                  <p className="font-medium capitalize">{existingSession.userType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Step</p>
                  <p className="font-medium capitalize">{existingSession.currentStep?.replace(/_/g, " ")}</p>
                </div>
              </div>
              
              {existingSession.panNumber && (
                <div>
                  <p className="text-sm text-muted-foreground">PAN Number</p>
                  <p className="font-medium">{existingSession.panNumber}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Started {new Date(existingSession.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelSession}
              disabled={cancelSessionMutation.isPending}
              data-testid="button-cancel-session"
            >
              {cancelSessionMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Start Fresh
                </>
              )}
            </Button>
            <Button
              onClick={handleResumeSession}
              data-testid="button-resume-session"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Resume Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
