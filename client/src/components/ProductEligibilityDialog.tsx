import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Lock, 
  Shield, 
  ShieldCheck, 
  Crown, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  TrendingUp
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";

interface ProductEligibilityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productCategory: string;
  requiredTier: "basic" | "enhanced" | "accredited_investor";
  currentTier: "basic" | "enhanced" | "accredited_investor";
  currentTierName: string;
  requiredTierName: string;
  requiredTierDescription: string;
  missingVerifications: Array<{code: string; name: string; completed: boolean}>;
  eligibleForUpgrade: boolean;
  upgradeRequestedAt: string | null;
}

const tierIcons = {
  basic: Shield,
  enhanced: ShieldCheck,
  accredited_investor: Crown,
};

const tierColors = {
  basic: "bg-blue-500 text-white",
  enhanced: "bg-green-500 text-white",
  accredited_investor: "bg-purple-500 text-white",
};

const tierBorderColors = {
  basic: "border-blue-200 dark:border-blue-800",
  enhanced: "border-green-200 dark:border-green-800",
  accredited_investor: "border-purple-200 dark:border-purple-800",
};

export function ProductEligibilityDialog({
  isOpen,
  onClose,
  productName,
  productCategory,
  requiredTier,
  currentTier,
  currentTierName,
  requiredTierName,
  requiredTierDescription,
  missingVerifications,
  eligibleForUpgrade,
  upgradeRequestedAt,
}: ProductEligibilityDialogProps) {
  const [, setLocation] = useLocation();

  const RequiredTierIcon = tierIcons[requiredTier];
  const CurrentTierIcon = tierIcons[currentTier];

  const handleUpgrade = () => {
    onClose();
    setLocation("/kyc-dashboard");
  };

  const isAlreadyUpgrading = upgradeRequestedAt !== null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-product-eligibility">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/20">
              <Lock className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl" data-testid="text-product-name">
                {productName}
              </DialogTitle>
              <DialogDescription data-testid="text-product-category">
                {productCategory} · Tier Upgrade Required
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-4" />

        {/* Tier Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Current Tier */}
          <div className={`p-4 rounded-lg border-2 ${tierBorderColors[currentTier]} bg-gray-50 dark:bg-gray-900/50`}>
            <p className="text-xs text-muted-foreground mb-2">Your Current Tier</p>
            <div className="flex items-center gap-2">
              <CurrentTierIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-semibold dark:text-white" data-testid="text-current-tier">{currentTierName}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </div>

          {/* Required Tier */}
          <div className={`p-4 rounded-lg border-2 ${tierBorderColors[requiredTier]} bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900`}>
            <p className="text-xs text-muted-foreground mb-2">Required Tier</p>
            <div className="flex items-center gap-2">
              <RequiredTierIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold dark:text-white" data-testid="text-required-tier">{requiredTierName}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  Unlock Access
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Product Access Message */}
        <Alert className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/10" data-testid="alert-tier-requirement">
          <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription>
            <p className="font-semibold text-orange-900 dark:text-orange-200 mb-1">
              This product requires {requiredTierName}
            </p>
            <p className="text-sm text-orange-800 dark:text-orange-300">
              {requiredTierDescription}
            </p>
          </AlertDescription>
        </Alert>

        {/* Upgrade Path */}
        {!eligibleForUpgrade && missingVerifications.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 dark:text-white">
              <TrendingUp className="h-4 w-4" />
              Complete These Verifications to Upgrade
            </h3>
            <div className="space-y-2">
              {missingVerifications.slice(0, 5).map((verification, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded bg-gray-50 dark:bg-gray-900/50"
                  data-testid={`verification-${verification.code}`}
                >
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium dark:text-white">{verification.name}</p>
                    <p className="text-xs text-muted-foreground">Required for {requiredTierName}</p>
                  </div>
                </div>
              ))}
              {missingVerifications.length > 5 && (
                <p className="text-xs text-muted-foreground pl-6">
                  +{missingVerifications.length - 5} more verification(s) required
                </p>
              )}
            </div>
          </div>
        )}

        {/* Eligible for Upgrade */}
        {eligibleForUpgrade && !isAlreadyUpgrading && (
          <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 mt-4" data-testid="alert-eligible-upgrade">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription>
              <p className="font-semibold text-green-900 dark:text-green-200">
                You're eligible to upgrade to {requiredTierName}!
              </p>
              <p className="text-sm text-green-800 dark:text-green-300">
                All verifications complete. Request your tier upgrade to access this product.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Upgrade Already Requested */}
        {isAlreadyUpgrading && (
          <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 mt-4" data-testid="alert-upgrade-pending">
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription>
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                Upgrade Request Pending
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Your upgrade to {requiredTierName} is under review. You'll be notified once approved.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-4" />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
            data-testid="button-cancel"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            className="w-full sm:w-auto"
            data-testid="button-view-upgrade"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            {isAlreadyUpgrading
              ? "View Upgrade Status"
              : eligibleForUpgrade
              ? "Request Upgrade Now"
              : "View Requirements"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
