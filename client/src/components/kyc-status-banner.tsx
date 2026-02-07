import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  X, 
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Lock,
  Unlock
} from "lucide-react";

export function KYCStatusBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: {
      kycLevel: string;
      kycLevelName: string;
      accessibleProducts: any[];
      blockedProducts: any[];
      canAccessLoans: boolean;
      canAccessInsurance: boolean;
      canAccessInvestments: boolean;
      nextAction: string | null;
      profile: {
        panVerified: boolean;
        ckycFetched: boolean;
        kraVerified: boolean;
      };
    };
  }>({
    queryKey: ["/api/kyc/status"],
    retry: false,
  });

  useEffect(() => {
    const dismissed = localStorage.getItem("kyc-banner-dismissed");
    if (dismissed) {
      const dismissedData = JSON.parse(dismissed);
      if (dismissedData.timestamp) {
        const daysSinceDismiss = (Date.now() - dismissedData.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceDismiss < 7) {
          setIsDismissed(true);
        } else {
          localStorage.removeItem("kyc-banner-dismissed");
        }
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(
      "kyc-banner-dismissed",
      JSON.stringify({ timestamp: Date.now() })
    );
  };

  if (isLoading) {
    return (
      <div className="mb-6" data-testid="kyc-banner-loading">
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data?.success) {
    return null;
  }

  const kycData = data.data;
  const kycLevel = parseInt(kycData.kycLevel);

  if (kycLevel >= 2 || isDismissed) {
    return null;
  }

  const getBannerConfig = () => {
    switch (kycLevel) {
      case 0:
        return {
          variant: "default" as const,
          icon: AlertCircle,
          bgColor: "bg-yellow-50 border-yellow-300 dark:bg-yellow-950/20 dark:border-yellow-800",
          iconColor: "text-yellow-600 dark:text-yellow-500",
          titleColor: "text-yellow-900 dark:text-yellow-400",
          textColor: "text-yellow-800 dark:text-yellow-300",
          progressColor: "bg-yellow-500",
          badgeColor: "bg-yellow-500 text-white",
          title: "Complete Your Profile",
          progress: 33,
          message: "Get started with basic investments",
          benefits: [
            { icon: Unlock, text: "View mutual funds & basic products", available: true },
            { icon: Lock, text: "Investments & trading", available: false },
            { icon: Lock, text: "Loans & credit products", available: false },
          ],
        };
      case 1:
        return {
          variant: "default" as const,
          icon: Info,
          bgColor: "bg-blue-50 border-blue-300 dark:bg-blue-950/20 dark:border-blue-800",
          iconColor: "text-blue-600 dark:text-blue-500",
          titleColor: "text-blue-900 dark:text-blue-400",
          textColor: "text-blue-800 dark:text-blue-300",
          progressColor: "bg-blue-500",
          badgeColor: "bg-blue-500 text-white",
          title: "Complete Full KYC",
          progress: 66,
          message: "Unlock all investment products",
          benefits: [
            { icon: CheckCircle2, text: "Basic investments enabled", available: true },
            { icon: Unlock, text: "Loans & credit available", available: true },
            { icon: Lock, text: "Full investment access", available: false },
          ],
        };
      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="mb-6" data-testid="kyc-status-banner">
      <Alert className={`relative ${config.bgColor} border-2`}>
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-full p-1 hover:bg-black/5 dark:hover:bg-card/10 transition-colors"
          aria-label="Dismiss banner"
          data-testid="dismiss-banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-8">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex-shrink-0">
              <div className={`p-3 rounded-full bg-card/50/10`}>
                <Icon className={`w-6 h-6 ${config.iconColor}`} />
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <AlertTitle className={`text-xl font-bold ${config.titleColor} m-0`}>
                    {config.title}
                  </AlertTitle>
                  <Badge className={config.badgeColor} data-testid="kyc-level-badge">
                    Level {kycLevel}: {kycData.kycLevelName}
                  </Badge>
                </div>

                <AlertDescription className={`${config.textColor} mb-4`}>
                  <p className="text-base mb-3">{config.message}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span>KYC Completion</span>
                      <span>{config.progress}%</span>
                    </div>
                    <Progress 
                      value={config.progress} 
                      className="h-2" 
                      data-testid="kyc-progress"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {config.benefits.map((benefit, index) => {
                      const BenefitIcon = benefit.icon;
                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-2 text-sm ${
                            benefit.available 
                              ? 'text-green-700 dark:text-green-400' 
                              : 'text-muted-foreground'
                          }`}
                          data-testid={`benefit-${index}`}
                        >
                          <BenefitIcon className="w-4 h-4 flex-shrink-0" />
                          <span>{benefit.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {kycData.nextAction && (
                    <div className="bg-card/70/5 rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <TrendingUp className={`w-4 h-4 mt-0.5 ${config.iconColor}`} />
                        <div>
                          <p className="font-semibold text-sm">Next Step:</p>
                          <p className="text-sm">{kycData.nextAction}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/onboarding">
                  <Button
                    className={`${
                      kycLevel === 0
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-foreground font-semibold shadow-lg`}
                    data-testid="complete-kyc-button"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Complete KYC Now
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>

                <div className="text-xs text-muted-foreground flex items-center">
                  <Info className="w-3 h-3 mr-1" />
                  Takes only 5-10 minutes
                </div>
              </div>
            </div>
          </div>
        </div>
      </Alert>
    </div>
  );
}
