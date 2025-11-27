import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Shield,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  Info,
  FileText,
  Pen
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WizardStep = 'pan_verification' | 'aadhaar_otp' | 'aadhaar_verification' | 'data_collection' | 'risk_profiling' | 'compliance_signoff' | 'completed';

interface SessionData {
  id: string;
  currentStep: WizardStep;
  panVerified: boolean;
  aadhaarOtpSent: boolean;
  aadhaarOtpVerified: boolean;
  aadhaarNumber?: string;
  expiresAt?: string;
  panVerificationData?: {
    name: string;
    fatherName: string;
  };
  aadhaarVerificationData?: {
    name: string;
    dob: string;
    gender: string;
    address: {
      house: string;
      street: string;
      locality: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
}

export default function SmartKYCOnboarding() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<WizardStep>('pan_verification');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionError, setSessionError] = useState<string>('');
  
  // Resume Session Dialog State
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(null);
  
  // Session Timer State
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showFiveMinWarning, setShowFiveMinWarning] = useState(false);
  const [showOneMinWarning, setShowOneMinWarning] = useState(false);
  const [sessionExpiredShown, setSessionExpiredShown] = useState(false);
  
  // Pan Verification State
  const [panNumber, setPanNumber] = useState('');
  const [panFullName, setPanFullName] = useState('');
  const [panDob, setPanDob] = useState('');
  const [panData, setPanData] = useState<any>(null);
  
  // Aadhaar Verification State
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarTransactionId, setAadhaarTransactionId] = useState('');
  const [aadhaarMasked, setAadhaarMasked] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [aadhaarData, setAadhaarData] = useState<any>(null);
  
  // Risk Profiling State
  const [riskProfileAnswers, setRiskProfileAnswers] = useState({
    investmentObjective: '',
    investmentHorizon: '',
    riskTolerance: '',
    incomeLevel: '',
    tradingExperience: ''
  });
  
  // Compliance Sign-off State
  const [fatcaDeclaration, setFatcaDeclaration] = useState(false);
  const [riskAcknowledgment, setRiskAcknowledgment] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [taxResidencyCountry, setTaxResidencyCountry] = useState('India');
  const [tinNumber, setTinNumber] = useState('');
  const [digitalSignature, setDigitalSignature] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Start or resume session
  const startSessionMutation = useMutation({
    mutationFn: async (forceNew: boolean = false) => {
      return await apiRequest('/api/kyc/wizard/start', {
        method: 'POST',
        body: JSON.stringify({ forceNew })
      });
    },
    onSuccess: (data) => {
      if (data.success && data.session) {
        // Check if this is a resumable session
        if (data.resumable && !data.session.panVerified) {
          // Show resume dialog only if user hasn't completed PAN yet
          setPendingSession(data.session);
          setShowResumeDialog(true);
          return;
        }
        
        // Otherwise, load the session normally
        setSessionId(data.session.id);
        setCurrentStep(data.session.currentStep);
        setSessionError(''); // Clear any previous errors
        
        // Set session expiry time and reset warning flags
        if (data.session.expiresAt) {
          setSessionExpiresAt(new Date(data.session.expiresAt));
          setShowFiveMinWarning(false);
          setShowOneMinWarning(false);
          setSessionExpiredShown(false);
        }
        
        // Restore state if resuming
        if (data.session.panVerified) {
          setPanData(data.session.panVerificationData);
        }
        if (data.session.aadhaarOtpSent) {
          setAadhaarMasked(data.session.aadhaarNumber || '');
        }
        if (data.session.aadhaarOtpVerified) {
          setAadhaarData(data.session.aadhaarVerificationData);
        }
        
        toast({
          title: "Session Ready",
          description: data.resumable ? "Resuming your KYC session" : "New KYC session started",
        });
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to start KYC session. Please try again.";
      setSessionError(errorMessage);
      toast({
        title: "Session Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });
  
  // Handle resuming existing session
  const handleResumeSession = () => {
    if (pendingSession) {
      setSessionId(pendingSession.id);
      setCurrentStep(pendingSession.currentStep);
      setSessionError('');
      
      if (pendingSession.expiresAt) {
        setSessionExpiresAt(new Date(pendingSession.expiresAt));
        setShowFiveMinWarning(false);
        setShowOneMinWarning(false);
        setSessionExpiredShown(false);
      }
      
      if (pendingSession.panVerified) {
        setPanData(pendingSession.panVerificationData);
      }
      if (pendingSession.aadhaarOtpSent) {
        setAadhaarMasked(pendingSession.aadhaarNumber || '');
      }
      if (pendingSession.aadhaarOtpVerified) {
        setAadhaarData(pendingSession.aadhaarVerificationData);
      }
      
      setShowResumeDialog(false);
      setPendingSession(null);
      
      toast({
        title: "Session Resumed",
        description: "Continuing from where you left off",
      });
    }
  };
  
  // Handle starting fresh (cancel old session and create new)
  const handleStartFresh = () => {
    setShowResumeDialog(false);
    setPendingSession(null);
    startSessionMutation.mutate(true); // Pass forceNew=true
  };
  
  // KRA Status Check
  const checkKraStatusMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/check-kra-status', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          panNumber: panNumber.toUpperCase(),
          dateOfBirth: panDob,
          fullName: panFullName
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        if (data.kraStatus === 'VERIFIED') {
          // KYC already verified - skip Aadhaar verification
          toast({
            title: "KYC Already Verified!",
            description: "Your KYC is already verified in the registry. Skipping Aadhaar verification.",
          });
          // Move to completion step
          setCurrentStep('data_collection');
        } else if (data.kraStatus === 'ONHOLD') {
          toast({
            title: "KYC On Hold",
            description: "Your KYC is on hold. Please complete Aadhaar verification.",
            variant: "default"
          });
          setCurrentStep('aadhaar_otp');
        } else {
          // NOT_FOUND or REJECTED - proceed with Aadhaar verification
          toast({
            title: "KYC Not Found",
            description: "No existing KYC found. Please complete Aadhaar verification.",
          });
          setCurrentStep('aadhaar_otp');
        }
      }
    },
    onError: (error) => {
      console.error('KRA check error:', error);
      // On error, proceed with Aadhaar verification anyway
      setCurrentStep('aadhaar_otp');
      toast({
        title: "Continuing with verification",
        description: "Proceeding to Aadhaar verification",
      });
    }
  });

  // PAN Verification
  const verifyPanMutation = useMutation({
    mutationFn: async () => {
      // Defensive check: ensure sessionId exists before making request
      if (!sessionId) {
        throw new Error("Session not initialized. Please refresh the page.");
      }
      
      return await apiRequest('/api/kyc/wizard/verify-pan', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          panNumber: panNumber.toUpperCase(),
          fullName: panFullName,
          dob: panDob
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setPanData(data.data);
        toast({
          title: "Success",
          description: `PAN verified successfully for ${data.data.name}`,
        });
        
        // After PAN verification, check KRA status
        checkKraStatusMutation.mutate();
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid PAN or Date of Birth",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "PAN verification failed. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Send Aadhaar OTP
  const sendAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/send-aadhaar-otp', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          aadhaarNumber
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setAadhaarTransactionId(data.transactionId);
        setAadhaarMasked(data.maskedAadhaar);
        setCurrentStep('aadhaar_verification');
        toast({
          title: "OTP Sent",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send OTP. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Verify Aadhaar OTP
  const verifyAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/verify-aadhaar-otp', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          transactionId: aadhaarTransactionId,
          otp: aadhaarOtp
        })
      });
    },
    onSuccess: (data) => {
      if (data.success && data.verified) {
        setAadhaarData(data.data);
        setCurrentStep('data_collection');
        toast({
          title: "Success",
          description: "Aadhaar verified successfully!",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid OTP",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to verify OTP. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Submit Risk Profiling
  const submitRiskProfilingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/risk-profiling', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          ...riskProfileAnswers
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('compliance_signoff');
        toast({
          title: "Success",
          description: "Risk profile saved successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save risk profile. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Submit Compliance Sign-off
  const submitComplianceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/compliance-signoff', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          fatcaDeclaration,
          riskAcknowledgment,
          termsAndConditions,
          privacyPolicy,
          taxResidencyCountry,
          tinNumber: tinNumber || undefined,
          digitalSignature: digitalSignature || undefined
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('completed');
        toast({
          title: "Success",
          description: "Compliance declarations accepted successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit compliance. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Complete KYC
  const completeKycMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/kyc/wizard/complete', {
        method: 'POST',
        body: JSON.stringify({
          sessionId
        })
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('completed');
        toast({
          title: "Success",
          description: "Smart KYC completed successfully!",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete KYC. Please try again.",
        variant: "destructive"
      });
    }
  });
  
  // Start session on mount
  useEffect(() => {
    startSessionMutation.mutate(false);
  }, []);
  
  // Session countdown timer
  useEffect(() => {
    if (!sessionExpiresAt || currentStep === 'completed') return;
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiryTime = sessionExpiresAt.getTime();
      const remaining = Math.max(0, expiryTime - now);
      
      setTimeRemaining(remaining);
      
      // Check for warnings
      const minutesRemaining = Math.floor(remaining / 60000);
      
      if (minutesRemaining === 5 && !showFiveMinWarning) {
        setShowFiveMinWarning(true);
        toast({
          title: "Session Expiring Soon",
          description: "Your KYC session will expire in 5 minutes. Please complete the verification process.",
          variant: "destructive"
        });
      }
      
      if (minutesRemaining === 1 && !showOneMinWarning) {
        setShowOneMinWarning(true);
        toast({
          title: "Session Expiring",
          description: "Your KYC session will expire in 1 minute! Please complete verification immediately.",
          variant: "destructive"
        });
      }
      
      if (remaining === 0 && !sessionExpiredShown) {
        setSessionExpiredShown(true);
        setSessionExpiresAt(null); // Hide timer after expiry
        toast({
          title: "Session Expired",
          description: "Your KYC session has expired. Please start a new session.",
          variant: "destructive"
        });
      }
    };
    
    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [sessionExpiresAt, currentStep, showFiveMinWarning, showOneMinWarning, sessionExpiredShown]);
  
  // Set up digital signature canvas
  useEffect(() => {
    if (currentStep !== 'compliance_signoff' || !signatureCanvasRef.current) return;
    
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 150;
    
    // Configure drawing style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    let isDrawing = false;
    
    const startDrawing = (e: MouseEvent) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };
    
    const draw = (e: MouseEvent) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasSignature(true);
    };
    
    const stopDrawing = () => {
      if (isDrawing) {
        isDrawing = false;
        // Capture signature after drawing
        const dataUrl = canvas.toDataURL();
        setDigitalSignature(dataUrl);
      }
    };
    
    // Add event listeners
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [currentStep]);
  
  const getStepProgress = () => {
    const steps: WizardStep[] = ['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'risk_profiling', 'compliance_signoff', 'completed'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };
  
  const formatTimeRemaining = () => {
    if (timeRemaining === 0) return "Expired";
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const getTimerColor = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    if (minutes <= 1) return "text-red-600 dark:text-red-400";
    if (minutes <= 5) return "text-orange-600 dark:text-orange-400";
    return "text-green-600 dark:text-green-400";
  };
  
  const renderSessionTimer = () => {
    if (!sessionExpiresAt || currentStep === 'completed') return null;
    
    return (
      <Alert className="mb-4">
        <Clock className={`h-4 w-4 ${getTimerColor()}`} />
        <AlertDescription className="flex items-center justify-between">
          <span>Session Time Remaining:</span>
          <span className={`font-mono font-bold ${getTimerColor()}`} data-testid="text-session-timer">
            {formatTimeRemaining()}
          </span>
        </AlertDescription>
      </Alert>
    );
  };
  
  const renderPanVerificationStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 1: PAN Verification</CardTitle>
        </div>
        <CardDescription>
          Enter your PAN number and date of birth to verify your identity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessionId && (
          <Alert className="bg-blue-50 border-blue-200">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Session Active:</strong> Your KYC session is ready
            </AlertDescription>
          </Alert>
        )}
        
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription>
            Smart KYC will automatically fetch your details from government databases after verification
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="pan">PAN Number</Label>
          <Input
            id="pan"
            data-testid="input-pan"
            placeholder="ABCDE1234F"
            value={panNumber}
            onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
            maxLength={10}
            className="uppercase"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name (as per PAN)</Label>
          <Input
            id="fullName"
            data-testid="input-fullname"
            placeholder="John Doe"
            value={panFullName}
            onChange={(e) => setPanFullName(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Enter your name exactly as it appears on your PAN card
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input
            id="dob"
            data-testid="input-dob"
            type="date"
            value={panDob}
            onChange={(e) => setPanDob(e.target.value)}
          />
        </div>
        
        <Button
          data-testid="button-verify-pan"
          onClick={() => verifyPanMutation.mutate()}
          disabled={!sessionId || !panNumber || !panFullName || !panDob || verifyPanMutation.isPending}
          className="w-full"
        >
          {verifyPanMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Verify PAN
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
  
  const renderAadhaarOtpStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 2: Aadhaar Verification</CardTitle>
        </div>
        <CardDescription>
          Enter your Aadhaar number to receive OTP for verification
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {panData && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>PAN Verified:</strong> {panData.name}
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            <strong>Important:</strong> OTP will be sent by UIDAI to the mobile number linked with your Aadhaar card, not the number you registered with on FintekPro. Please ensure you have access to your Aadhaar-registered mobile.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="aadhaar">Aadhaar Number</Label>
          <Input
            id="aadhaar"
            data-testid="input-aadhaar"
            placeholder="1234 5678 9012"
            value={aadhaarNumber}
            onChange={(e) => setAadhaarNumber(e.target.value.replace(/\s/g, ''))}
            maxLength={12}
          />
          <p className="text-sm text-muted-foreground">
            Enter your 12-digit Aadhaar number (without spaces)
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="button-back-pan"
            onClick={() => setCurrentStep('pan_verification')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            data-testid="button-send-otp"
            onClick={() => sendAadhaarOtpMutation.mutate()}
            disabled={aadhaarNumber.length !== 12 || sendAadhaarOtpMutation.isPending}
            className="flex-1"
          >
            {sendAadhaarOtpMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                Send OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderAadhaarVerificationStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <CardTitle>Step 3: Verify OTP</CardTitle>
        </div>
        <CardDescription>
          Enter the OTP sent to your mobile number ending with {aadhaarMasked.slice(-4)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            For demo purposes, the OTP is logged in the console. Check browser developer tools or backend logs.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <Label htmlFor="otp">Enter OTP</Label>
          <Input
            id="otp"
            data-testid="input-otp"
            placeholder="Enter 6-digit OTP"
            value={aadhaarOtp}
            onChange={(e) => setAadhaarOtp(e.target.value)}
            maxLength={6}
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="button-resend-otp"
            onClick={() => {
              setCurrentStep('aadhaar_otp');
              setAadhaarOtp('');
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            data-testid="button-verify-otp"
            onClick={() => verifyAadhaarOtpMutation.mutate()}
            disabled={aadhaarOtp.length !== 6 || verifyAadhaarOtpMutation.isPending}
            className="flex-1"
          >
            {verifyAadhaarOtpMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                Verify OTP
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderDataCollectionStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <CardTitle>Step 4: Auto-Populated Information</CardTitle>
        </div>
        <CardDescription>
          Review your information fetched from verified sources
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aadhaarData && (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Both verifications completed successfully!</strong>
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Name (from PAN)</Label>
                <p className="font-medium">{panData?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Name (from Aadhaar)</Label>
                <p className="font-medium">{aadhaarData?.name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Date of Birth</Label>
                <p className="font-medium">{aadhaarData?.dob || panDob}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Gender</Label>
                <p className="font-medium">{aadhaarData?.gender || 'N/A'}</p>
              </div>
            </div>
            
            <div>
              <Label className="text-muted-foreground">Address (from Aadhaar)</Label>
              <p className="font-medium">
                {aadhaarData?.address?.house}, {aadhaarData?.address?.street}<br />
                {aadhaarData?.address?.locality}, {aadhaarData?.address?.city}<br />
                {aadhaarData?.address?.state} - {aadhaarData?.address?.pincode}
              </p>
            </div>
            
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                All required information has been automatically collected and verified. Proceed to complete your risk profile and compliance declarations.
              </AlertDescription>
            </Alert>
            
            <Button
              data-testid="button-proceed-risk-profile"
              onClick={() => setCurrentStep('risk_profiling')}
              className="w-full"
            >
              Proceed to Risk Profiling
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  const renderRiskProfilingStep = () => {
    const isFormValid = 
      riskProfileAnswers.investmentObjective &&
      riskProfileAnswers.investmentHorizon &&
      riskProfileAnswers.riskTolerance &&
      riskProfileAnswers.incomeLevel &&
      riskProfileAnswers.tradingExperience;
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <CardTitle>Step 5: Risk Profiling</CardTitle>
          </div>
          <CardDescription>
            Help us understand your investment profile and risk appetite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Investment Objective</Label>
            <RadioGroup
              value={riskProfileAnswers.investmentObjective}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, investmentObjective: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="capital_appreciation" id="cap-app" data-testid="radio-cap-app" />
                <Label htmlFor="cap-app" className="font-normal">Capital Appreciation</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="regular_income" id="reg-inc" data-testid="radio-reg-inc" />
                <Label htmlFor="reg-inc" className="font-normal">Regular Income</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="balanced" id="balanced" data-testid="radio-balanced" />
                <Label htmlFor="balanced" className="font-normal">Balanced Growth & Income</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Investment Horizon</Label>
            <RadioGroup
              value={riskProfileAnswers.investmentHorizon}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, investmentHorizon: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="short_term" id="short" data-testid="radio-short" />
                <Label htmlFor="short" className="font-normal">Short Term (Less than 3 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium_term" id="medium" data-testid="radio-medium" />
                <Label htmlFor="medium" className="font-normal">Medium Term (3-5 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="long_term" id="long" data-testid="radio-long" />
                <Label htmlFor="long" className="font-normal">Long Term (More than 5 years)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Risk Tolerance</Label>
            <RadioGroup
              value={riskProfileAnswers.riskTolerance}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, riskTolerance: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="conservative" id="conservative" data-testid="radio-conservative" />
                <Label htmlFor="conservative" className="font-normal">Conservative (Low Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="moderate" data-testid="radio-moderate" />
                <Label htmlFor="moderate" className="font-normal">Moderate (Medium Risk)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aggressive" id="aggressive" data-testid="radio-aggressive" />
                <Label htmlFor="aggressive" className="font-normal">Aggressive (High Risk)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label>Annual Income</Label>
            <Select value={riskProfileAnswers.incomeLevel} onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, incomeLevel: value})}>
              <SelectTrigger data-testid="select-income">
                <SelectValue placeholder="Select your income range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="below_5l">Below ₹5 Lakhs</SelectItem>
                <SelectItem value="5l_to_10l">₹5-10 Lakhs</SelectItem>
                <SelectItem value="10l_to_25l">₹10-25 Lakhs</SelectItem>
                <SelectItem value="25l_to_1cr">₹25 Lakhs - ₹1 Crore</SelectItem>
                <SelectItem value="above_1cr">Above ₹1 Crore</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Trading Experience</Label>
            <RadioGroup
              value={riskProfileAnswers.tradingExperience}
              onValueChange={(value) => setRiskProfileAnswers({...riskProfileAnswers, tradingExperience: value})}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="beginner" id="beginner" data-testid="radio-beginner" />
                <Label htmlFor="beginner" className="font-normal">Beginner (Less than 1 year)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="intermediate" id="intermediate" data-testid="radio-intermediate" />
                <Label htmlFor="intermediate" className="font-normal">Intermediate (1-3 years)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="experienced" id="experienced" data-testid="radio-experienced" />
                <Label htmlFor="experienced" className="font-normal">Experienced (More than 3 years)</Label>
              </div>
            </RadioGroup>
          </div>
          
          <Button
            data-testid="button-submit-risk-profile"
            onClick={() => submitRiskProfilingMutation.mutate()}
            disabled={!isFormValid || submitRiskProfilingMutation.isPending}
            className="w-full"
          >
            {submitRiskProfilingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Continue to Compliance
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  const renderComplianceSignoffStep = () => {
    const clearSignature = () => {
      if (signatureCanvasRef.current) {
        const ctx = signatureCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, signatureCanvasRef.current.width, signatureCanvasRef.current.height);
        }
      }
      setDigitalSignature('');
      setHasSignature(false);
    };
    
    const isFormValid = fatcaDeclaration && riskAcknowledgment && termsAndConditions && privacyPolicy;
    const missingDeclarations = [
      !fatcaDeclaration && 'FATCA Declaration',
      !riskAcknowledgment && 'Risk Acknowledgment',
      !termsAndConditions && 'Terms & Conditions',
      !privacyPolicy && 'Privacy Policy'
    ].filter(Boolean);
    
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle>Step 6: Compliance & Declarations</CardTitle>
          </div>
          <CardDescription>
            Review and accept the required compliance declarations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isFormValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required:</strong> Please accept all {missingDeclarations.length} remaining declaration(s): {missingDeclarations.join(', ')}
              </AlertDescription>
            </Alert>
          )}
          
          {isFormValid && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                All mandatory declarations accepted. You may now submit your compliance sign-off.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="fatca"
                data-testid="checkbox-fatca"
                checked={fatcaDeclaration}
                onCheckedChange={(checked) => setFatcaDeclaration(checked as boolean)}
              />
              <Label htmlFor="fatca" className="font-normal leading-relaxed cursor-pointer">
                <strong>FATCA Declaration:</strong> I confirm that I am not a US citizen/resident for tax purposes and I am a tax resident of India.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="risk-ack"
                data-testid="checkbox-risk"
                checked={riskAcknowledgment}
                onCheckedChange={(checked) => setRiskAcknowledgment(checked as boolean)}
              />
              <Label htmlFor="risk-ack" className="font-normal leading-relaxed cursor-pointer">
                <strong>Risk Acknowledgment:</strong> I understand that investments in securities markets are subject to market risks and I am responsible for my investment decisions.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                data-testid="checkbox-terms"
                checked={termsAndConditions}
                onCheckedChange={(checked) => setTermsAndConditions(checked as boolean)}
              />
              <Label htmlFor="terms" className="font-normal leading-relaxed cursor-pointer">
                <strong>Terms & Conditions:</strong> I have read and agree to the Terms and Conditions of FintekPro.
              </Label>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox
                id="privacy"
                data-testid="checkbox-privacy"
                checked={privacyPolicy}
                onCheckedChange={(checked) => setPrivacyPolicy(checked as boolean)}
              />
              <Label htmlFor="privacy" className="font-normal leading-relaxed cursor-pointer">
                <strong>Privacy Policy:</strong> I acknowledge and consent to the Privacy Policy and data usage terms.
              </Label>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-country">Tax Residency Country</Label>
              <Input
                id="tax-country"
                data-testid="input-tax-country"
                value={taxResidencyCountry}
                onChange={(e) => setTaxResidencyCountry(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tin">TIN/Tax ID (Optional)</Label>
              <Input
                id="tin"
                data-testid="input-tin"
                placeholder="Enter your TIN number"
                value={tinNumber}
                onChange={(e) => setTinNumber(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Digital Signature (Optional)</Label>
            <div className="border rounded-md p-4 bg-gray-50">
              <canvas
                ref={signatureCanvasRef}
                className="w-full border border-dashed border-gray-300 rounded cursor-crosshair bg-white"
                style={{ height: '150px' }}
                data-testid="canvas-signature"
              />
              <div className="mt-2 flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {hasSignature ? '✓ Signature captured' : 'Sign above using your mouse or touchpad'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  data-testid="button-clear-signature"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          
          {!isFormValid && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Complete all required declarations above to enable submission
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            data-testid="button-submit-compliance"
            onClick={() => {
              // Final validation before submission
              if (!isFormValid) {
                toast({
                  title: "Incomplete Declarations",
                  description: `Please accept: ${missingDeclarations.join(', ')}`,
                  variant: "destructive"
                });
                return;
              }
              submitComplianceMutation.mutate();
            }}
            disabled={!isFormValid || submitComplianceMutation.isPending}
            className="w-full"
          >
            {submitComplianceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : !isFormValid ? (
              <>
                Accept All Declarations to Continue
                <AlertCircle className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Submit & Complete KYC
                <CheckCircle className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };
  
  const renderCompletedStep = () => (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <CardTitle>KYC Completed Successfully!</CardTitle>
        </div>
        <CardDescription>
          Your Smart KYC verification is now complete
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>Congratulations!</strong> Your account is now fully verified and you can access all FintekPro services.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <h3 className="font-semibold">What's Next?</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            <li>Explore investment products and portfolios</li>
            <li>Set up your investment preferences</li>
            <li>Connect your bank accounts</li>
            <li>Start building your wealth</li>
          </ul>
        </div>
        
        <Button
          data-testid="button-dashboard"
          onClick={() => window.location.href = '/'}
          className="w-full"
        >
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
  
  // Show loading state while session initializes
  if (startSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing KYC session...</p>
      </div>
    );
  }
  
  // Show error state if session failed to initialize
  if (sessionError && !startSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {sessionError}
          </AlertDescription>
        </Alert>
        <Button 
          onClick={() => startSessionMutation.mutate(false)}
          data-testid="button-retry-session"
        >
          Retry
        </Button>
      </div>
    );
  }
  
  // Show loading if session hasn't been created yet
  if (!sessionId && !sessionError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Initializing KYC session...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Resume Session Dialog */}
      <AlertDialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resume KYC Session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an incomplete KYC session from earlier. Would you like to continue where you left off or start fresh?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStartFresh}>
              Start Fresh
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleResumeSession}>
              Resume Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Smart KYC Onboarding</h1>
        <p className="text-muted-foreground">
          Complete your KYC verification in just a few simple steps
        </p>
      </div>
      
      <div className="mb-8">
        <Progress value={getStepProgress()} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>Step {['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'risk_profiling', 'compliance_signoff', 'completed'].indexOf(currentStep) + 1} of 7</span>
          <span>{Math.round(getStepProgress())}% Complete</span>
        </div>
      </div>
      
      {renderSessionTimer()}
      
      {currentStep === 'pan_verification' && renderPanVerificationStep()}
      {currentStep === 'aadhaar_otp' && renderAadhaarOtpStep()}
      {currentStep === 'aadhaar_verification' && renderAadhaarVerificationStep()}
      {currentStep === 'data_collection' && renderDataCollectionStep()}
      {currentStep === 'risk_profiling' && renderRiskProfilingStep()}
      {currentStep === 'compliance_signoff' && renderComplianceSignoffStep()}
      {currentStep === 'completed' && renderCompletedStep()}
    </div>
  );
}
