import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { type SchemeType } from "@/hooks/use-consent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield as LucideShield, Lock, CheckCircle, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ConsentAwareSchemeTabProps {
  schemeType: SchemeType;
  children: React.ReactNode;
  onRequestConsent: (schemeType: SchemeType) => void;
}

const SCHEME_NAMES: Record<SchemeType, string> = {
  epf: "Employee Provident Fund (EPF)",
  ppf: "Public Provident Fund (PPF)",
  eps: "Employee Pension Scheme (EPS)",
  nps: "National Pension System (NPS)",
  apy: "Atal Pension Yojana (APY)",
  insurance: "Insurance Policies"
};

const SCHEME_DESCRIPTIONS: Record<SchemeType, string> = {
  epf: "Access your EPF account balance, contribution history, and withdrawal options",
  ppf: "View your PPF account details, maturity information, and investment tracking",
  eps: "Check your pension benefits, monthly amounts, and service records",
  nps: "View your NPS account details, fund allocation, and retirement corpus",
  apy: "Check your APY pension scheme details and guaranteed pension amount",
  insurance: "View your insurance policies, premium details, and coverage information"
};

const SCHEME_SOURCES: Record<SchemeType, string> = {
  epf: "EPFO (Employees' Provident Fund Organisation)",
  ppf: "India Post / Bank",
  eps: "EPFO (Employees' Provident Fund Organisation)",
  nps: "NSDL CRA (Central Recordkeeping Agency)",
  apy: "PFRDA (Pension Fund Regulatory and Development Authority)",
  insurance: "Insurance Providers"
};

export function ConsentAwareSchemeTab({ 
  schemeType, 
  children, 
  onRequestConsent 
}: ConsentAwareSchemeTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: consentStatus, isLoading: isCheckingConsent, error } = useQuery({
    queryKey: ['government-schemes', 'consent', user?.panNumber, schemeType],
    queryFn: async () => {
      if (!user?.panNumber) {
        throw new Error("PAN number not available");
      }
      const response = await fetch(`/api/government-schemes/consent/${user.panNumber}/${schemeType}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to check consent: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!user?.panNumber,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1
  });

  const initiateRefreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/government-schemes/${schemeType}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          channel: 'mobile'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate refresh');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setChallengeId(data.challengeId);
        setExpiresAt(new Date(data.expiresAt));
        setShowOtpDialog(true);
        toast({
          title: "OTP Sent",
          description: data.message || "Please enter the OTP sent to your registered mobile"
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to initiate refresh",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate refresh",
        variant: "destructive"
      });
    }
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      if (!challengeId || !otp) {
        throw new Error('Missing challenge ID or OTP');
      }
      
      const response = await fetch(`/api/government-schemes/${schemeType}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          challengeId,
          otp
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify OTP');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setShowOtpDialog(false);
        setOtp("");
        setChallengeId(null);
        setIsRefreshing(false);
        
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            if (Array.isArray(key)) {
              const keyStr = key.join('/');
              return keyStr.includes(`government-schemes/${schemeType}`) || 
                     keyStr.includes('government-schemes') ||
                     keyStr.includes('insurance-holdings');
            }
            return false;
          }
        });
        
        queryClient.invalidateQueries({ queryKey: ['government-schemes', 'consent'] });
        queryClient.invalidateQueries({ queryKey: ['government-schemes'] });
        
        toast({
          title: "Refresh Complete",
          description: "Your data has been refreshed from government sources"
        });
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid OTP. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify OTP",
        variant: "destructive"
      });
    }
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    initiateRefreshMutation.mutate();
  };

  const handleVerifyOtp = () => {
    verifyOtpMutation.mutate();
  };

  const hasConsent = consentStatus?.hasConsent ?? false;

  if (isCheckingConsent) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user?.panNumber) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LucideShield className="h-5 w-5 text-orange-600" />
              <span>PAN Verification Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">PAN Number Required</h3>
              <p className="text-muted-foreground mb-4">
                To access {SCHEME_NAMES[schemeType]} data, please complete your KYC 
                by adding your PAN card in your profile.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/profile"}>
                Update Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasConsent) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LucideShield className="h-5 w-5 text-blue-600" />
              <span>Consent Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Data Access Permission Needed
              </h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                {SCHEME_DESCRIPTIONS[schemeType]} for PAN number {user.panNumber}.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <LucideShield className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-left">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Secure & Compliant Access
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Your data is accessed through secure government APIs. We only retrieve 
                      the information necessary for portfolio management and never store sensitive data.
                    </p>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => onRequestConsent(schemeType)}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid={`button-request-consent-${schemeType}`}
              >
                Grant Permission to Access {SCHEME_NAMES[schemeType]}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex-1 mr-4">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Authorized access to {SCHEME_NAMES[schemeType]} data for PAN {user.panNumber}
            </span>
          </div>
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mt-1">
            <Clock className="h-3 w-3" />
            <span className="text-xs">
              Data source: {SCHEME_SOURCES[schemeType]}
            </span>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || initiateRefreshMutation.isPending}
          data-testid={`button-refresh-${schemeType}`}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing || initiateRefreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Data
        </Button>
      </div>
      
      {children}

      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LucideShield className="h-5 w-5 text-blue-600" />
              OTP Verification Required
            </DialogTitle>
            <DialogDescription>
              To refresh your {SCHEME_NAMES[schemeType]} data from {SCHEME_SOURCES[schemeType]}, 
              please enter the OTP sent to your registered mobile number.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Consent Recording</p>
                  <p className="text-xs">
                    This verification will be recorded in our audit log as per RBI/PMLA compliance requirements.
                    Data retention period: 8 years.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest"
                data-testid="input-otp"
              />
              {expiresAt && (
                <p className="text-xs text-muted-foreground text-center">
                  OTP expires at {expiresAt.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowOtpDialog(false);
                setOtp("");
                setChallengeId(null);
                setIsRefreshing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || verifyOtpMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-verify-otp"
            >
              {verifyOtpMutation.isPending ? "Verifying..." : "Verify & Refresh"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
