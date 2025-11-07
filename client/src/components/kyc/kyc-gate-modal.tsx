import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Shield, TrendingUp, Wallet } from "lucide-react";
import { useLocation } from "wouter";

interface KycGateModalProps {
  isOpen: boolean;
  onClose?: () => void;
  kycProgress?: number;
}

export function KycGateModal({ isOpen, onClose, kycProgress = 0 }: KycGateModalProps) {
  const [, setLocation] = useLocation();

  const handleStartKyc = () => {
    setLocation("/onboarding");
    onClose?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" data-testid="kyc-gate-modal">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Complete KYC to Unlock This Feature</DialogTitle>
          <DialogDescription className="text-center">
            To access investment features and start building your portfolio, please complete our quick KYC verification process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {kycProgress > 0 && kycProgress < 100 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">KYC Progress</span>
                <span className="font-medium">{kycProgress}%</span>
              </div>
              <Progress value={kycProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                You're almost there! Complete your verification to continue.
              </p>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">What you'll unlock:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Investment Access</p>
                  <p className="text-xs text-muted-foreground">Buy stocks, mutual funds, bonds, and IPOs</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Portfolio Management</p>
                  <p className="text-xs text-muted-foreground">Track holdings, rebalance, and optimize returns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Secure Transactions</p>
                  <p className="text-xs text-muted-foreground">Protected payments and regulatory compliance</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              ⏱️ <strong>Takes only 2 minutes</strong> • Fully digital • No paperwork required
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleStartKyc} 
            className="w-full"
            data-testid="button-start-kyc"
          >
            {kycProgress > 0 ? "Continue KYC Verification" : "Start KYC Verification"}
          </Button>
          {onClose && (
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="w-full"
              data-testid="button-close-modal"
            >
              Browse Demo Features
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
