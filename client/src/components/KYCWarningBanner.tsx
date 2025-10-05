import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function KYCWarningBanner() {
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
