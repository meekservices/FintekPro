import { useAuth } from "@/hooks/useAuth";
import { type SchemeType } from "@/hooks/use-consent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

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

export function ConsentAwareSchemeTab({ 
  schemeType, 
  children, 
  onRequestConsent 
}: ConsentAwareSchemeTabProps) {
  const { user } = useAuth();

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
              <Shield className="h-5 w-5 text-orange-600" />
              <span>PAN Verification Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">PAN Number Required</h3>
              <p className="text-gray-600 mb-4">
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
              <Shield className="h-5 w-5 text-blue-600" />
              <span>Consent Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Data Access Permission Needed
              </h3>
              <p className="text-gray-600 mb-4 max-w-md mx-auto">
                {SCHEME_DESCRIPTIONS[schemeType]} for PAN number {user.panNumber}.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
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

  // Consent granted - show the actual scheme data
  return (
    <div className="space-y-8">
      {/* Consent Status Indicator */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Authorized access to {SCHEME_NAMES[schemeType]} data for PAN {user.panNumber}
          </span>
        </div>
      </div>
      
      {children}
    </div>
  );
}