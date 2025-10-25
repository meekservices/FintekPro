import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MessageSquare, Shield, CheckCircle, Clock, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface WhatsAppLoginProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

export function WhatsAppLogin({ onSuccess, onError }: WhatsAppLoginProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [step, setStep] = useState<"phone" | "verification" | "success">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  // Check WhatsApp service status
  const { data: serviceStatus } = useQuery<{ isReady: boolean; hasQrCode?: boolean }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 10000, // Check every 10 seconds
    retry: 2,
  });

  // Countdown timer for resending code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // If it doesn't start with country code, assume it's Indian number
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('+91') && cleaned.length === 13) {
      return cleaned;
    }
    
    return phone; // Return as-is if format is unclear
  };

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const response = await apiRequest("POST", "/api/whatsapp/auth/phone-login", {
        body: { phoneNumber: formattedPhone }
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setStep("verification");
        setCountdown(300); // 5 minutes countdown
        
        toast({
          title: "Verification Code Sent",
          description: "Please check your WhatsApp for the 6-digit verification code.",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to send verification code");
        onError?.(errorData.error || "Failed to send verification code");
      }
    } catch (err) {
      const errorMsg = "Network error. Please check your connection.";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/whatsapp/auth/verify", {
        body: { sessionId, code: verificationCode }
      });

      if (response.ok) {
        const data = await response.json();
        setStep("success");
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${data.user.firstName || 'User'}!`,
        });

        onSuccess?.(data.user);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Invalid verification code");
      }
    } catch (err) {
      const errorMsg = "Network error. Please try again.";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    setVerificationCode("");
    setError("");
    setCountdown(0);
    handleSendCode();
  };

  const resetLogin = () => {
    setPhoneNumber("");
    setVerificationCode("");
    setSessionId("");
    setStep("phone");
    setError("");
    setCountdown(0);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
            <MessageSquare className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <CardTitle className="text-xl font-semibold">
          WhatsApp Login
        </CardTitle>
        <CardDescription>
          {step === "phone" && "Enter your phone number to receive a verification code"}
          {step === "verification" && "Enter the 6-digit code sent to your WhatsApp"}
          {step === "success" && "Login successful! Redirecting..."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!serviceStatus?.isReady && (
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {serviceStatus?.hasQrCode ? (
                <>
                  WhatsApp login is currently unavailable. The system is waiting for authentication. 
                  Please try again later or use email login.
                </>
              ) : (
                <>
                  WhatsApp login is currently being set up. 
                  Please use email login or contact support.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {step === "phone" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                data-testid="input-phone-number"
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                We'll send a verification code to your WhatsApp
              </p>
            </div>
            
            <Button 
              onClick={handleSendCode}
              disabled={isLoading || !phoneNumber.trim() || !serviceStatus?.isReady}
              className="w-full"
              data-testid="button-send-code"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending Code...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Verification Code
                </>
              )}
            </Button>
          </div>
        )}

        {step === "verification" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                data-testid="input-verification-code"
                disabled={isLoading}
                className="text-center text-lg tracking-wider"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Code sent to {phoneNumber}</span>
                {countdown > 0 && (
                  <span className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
            
            <Button 
              onClick={handleVerifyCode}
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full"
              data-testid="button-verify-code"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Verify & Login
                </>
              )}
            </Button>

            <div className="flex justify-between text-sm">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={resetLogin}
                data-testid="button-change-number"
              >
                Change Number
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleResendCode}
                disabled={countdown > 0 || isLoading}
                data-testid="button-resend-code"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {countdown > 0 ? `Resend (${countdown}s)` : "Resend Code"}
              </Button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-green-600 dark:text-green-400 font-medium">
              Successfully logged in!
            </p>
            <p className="text-sm text-muted-foreground">
              You will be redirected to your dashboard shortly.
            </p>
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground border-t pt-4">
          <p className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3" />
            Secure authentication via WhatsApp
          </p>
        </div>
      </CardContent>
    </Card>
  );
}