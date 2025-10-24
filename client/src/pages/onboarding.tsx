import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Shield,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type WizardStep = 'pan_verification' | 'aadhaar_otp' | 'aadhaar_verification' | 'data_collection' | 'completed';

interface SessionData {
  id: string;
  currentStep: WizardStep;
  panVerified: boolean;
  aadhaarOtpSent: boolean;
  aadhaarOtpVerified: boolean;
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
  
  // Start or resume session
  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/kyc/wizard/start');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.session) {
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
  
  // PAN Verification
  const verifyPanMutation = useMutation({
    mutationFn: async () => {
      // Defensive check: ensure sessionId exists before making request
      if (!sessionId) {
        throw new Error("Session not initialized. Please refresh the page.");
      }
      
      const res = await apiRequest('POST', '/api/kyc/wizard/verify-pan', {
        body: {
          sessionId,
          panNumber: panNumber.toUpperCase(),
          fullName: panFullName,
          dob: panDob
        }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPanData(data.data);
        setCurrentStep('aadhaar_otp');
        toast({
          title: "Success",
          description: `PAN verified successfully for ${data.data.name}`,
        });
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
      const res = await apiRequest('POST', '/api/kyc/wizard/send-aadhaar-otp', {
        body: {
          sessionId,
          aadhaarNumber
        }
      });
      return res.json();
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
    }
  });
  
  // Verify Aadhaar OTP
  const verifyAadhaarOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/kyc/wizard/verify-aadhaar-otp', {
        body: {
          sessionId,
          transactionId: aadhaarTransactionId,
          otp: aadhaarOtp
        }
      });
      return res.json();
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
    }
  });
  
  // Complete KYC
  const completeKycMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/kyc/wizard/complete', {
        body: {
          sessionId
        }
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCurrentStep('completed');
        toast({
          title: "Success",
          description: "Smart KYC completed successfully!",
        });
      }
    }
  });
  
  // Start session on mount
  useEffect(() => {
    startSessionMutation.mutate();
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
  
  const getStepProgress = () => {
    const steps: WizardStep[] = ['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'completed'];
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
            OTP will be sent to your registered mobile number
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
                All required information has been automatically collected and verified. You can now complete your KYC process.
              </AlertDescription>
            </Alert>
            
            <Button
              data-testid="button-complete-kyc"
              onClick={() => completeKycMutation.mutate()}
              disabled={completeKycMutation.isPending}
              className="w-full"
            >
              {completeKycMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  Complete Smart KYC
                  <CheckCircle className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
  
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
          onClick={() => startSessionMutation.mutate()}
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Smart KYC Onboarding</h1>
        <p className="text-muted-foreground">
          Complete your KYC verification in just a few simple steps
        </p>
      </div>
      
      <div className="mb-8">
        <Progress value={getStepProgress()} className="h-2" />
        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
          <span>Step {['pan_verification', 'aadhaar_otp', 'aadhaar_verification', 'data_collection', 'completed'].indexOf(currentStep) + 1} of 5</span>
          <span>{Math.round(getStepProgress())}% Complete</span>
        </div>
      </div>
      
      {renderSessionTimer()}
      
      {currentStep === 'pan_verification' && renderPanVerificationStep()}
      {currentStep === 'aadhaar_otp' && renderAadhaarOtpStep()}
      {currentStep === 'aadhaar_verification' && renderAadhaarVerificationStep()}
      {currentStep === 'data_collection' && renderDataCollectionStep()}
      {currentStep === 'completed' && renderCompletedStep()}
    </div>
  );
}
