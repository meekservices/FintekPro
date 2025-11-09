import { useState, useEffect } from "react";
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
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

type UserType = "individual" | "corporate" | "nri";

type WorkflowStep =
  | "user_type_selection"
  | "pan_verification"
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
        // Move to KRA check
        setCurrentStep("kra_check");
      } else {
        // PAN not found, need to verify via Sandbox
        toast({
          title: "PAN Verification Required",
          description: "Please verify your PAN details",
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
    onSuccess: (data) => {
      if (data.success) {
        setPanVerified(true);
        setPanData(data.panData);
        toast({
          title: "PAN Verified",
          description: "Your PAN has been verified and saved",
        });
        // Move to KRA check
        setCurrentStep("kra_check");
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

  // Calculate progress percentage
  const getProgressPercentage = () => {
    const stepOrder: WorkflowStep[] = [
      "user_type_selection",
      "pan_verification",
      "kra_check",
      "cashfree_ekyc",
      "cersai_submission",
      "bse_ucc",
      "completed",
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  };

  if (!user) {
    return null;
  }

  // Render User Type Selection
  if (currentStep === "user_type_selection") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
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

  // Render PAN Verification
  if (currentStep === "pan_verification") {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">PAN Verification</CardTitle>
                <CardDescription>
                  Verify your PAN to proceed with KYC
                </CardDescription>
              </div>
              <Badge variant="outline">{userType.toUpperCase()}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress value={getProgressPercentage()} className="h-2" />

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
                />
              </div>

              <div>
                <Label htmlFor="pan-name">Full Name (as per PAN)</Label>
                <Input
                  id="pan-name"
                  data-testid="input-pan-name"
                  placeholder="Enter your full name"
                  value={panFullName}
                  onChange={(e) => setPanFullName(e.target.value)}
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
                  onClick={() => checkPanMutation.mutate(panNumber)}
                  disabled={
                    !panNumber || panNumber.length !== 10 || checkPanMutation.isPending
                  }
                  className="flex-1"
                  data-testid="button-check-pan"
                >
                  {checkPanMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check PAN"
                  )}
                </Button>

                {!checkPanMutation.data?.exists && (
                  <Button
                    onClick={() => verifyPanMutation.mutate()}
                    disabled={
                      !panNumber ||
                      !panFullName ||
                      !panDob ||
                      verifyPanMutation.isPending
                    }
                    variant="default"
                    className="flex-1"
                    data-testid="button-verify-pan"
                  >
                    {verifyPanMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify PAN"
                    )}
                  </Button>
                )}
              </div>
            </div>
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

  return null;
}
