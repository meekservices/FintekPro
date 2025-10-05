import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function KYCWarningBanner() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  const hasFullKyc = user && 
    user.panNumber && 
    user.dateOfBirth && 
    user.address && 
    user.city && 
    user.state && 
    user.pincode;

  if (hasFullKyc) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50" data-testid="kyc-warning-banner">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-amber-800">
        <strong>Full KYC Required:</strong> All financial transactions require Full KYC verification regardless of investment amount. 
        Please ensure your profile is complete before placing orders.
      </AlertDescription>
    </Alert>
  );
}
