import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, Shield as LucideShield, TrendingUp, Globe, Building2, Landmark, Coins, Briefcase } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProductVerificationItem {
  name: string;
  verified: boolean;
  required: "full" | "enhanced";
  icon: any;
  description: string;
  entityTypes?: string[];
}

interface ProductVerificationStatusProps {
  currentKYCLevel: "none" | "basic" | "full" | "enhanced";
  clientType: "individual" | "non_individual";
  entityType?: string;
  isProfileCompleted: boolean;
}

export function ProductVerificationStatus({ 
  currentKYCLevel, 
  clientType, 
  entityType,
  isProfileCompleted 
}: ProductVerificationStatusProps) {
  
  const products: ProductVerificationItem[] = [
    {
      name: "Mutual Funds",
      verified: currentKYCLevel === "full" || currentKYCLevel === "enhanced",
      required: "full",
      icon: TrendingUp,
      description: "Full KYC required for mutual fund investments",
      entityTypes: ["all"]
    },
    {
      name: "Stock Broking",
      verified: currentKYCLevel === "full" || currentKYCLevel === "enhanced",
      required: "full",
      icon: Coins,
      description: "Full KYC required for stock trading",
      entityTypes: ["all"]
    },
    {
      name: "Bonds & G-Sec",
      verified: currentKYCLevel === "full" || currentKYCLevel === "enhanced",
      required: "full",
      icon: Landmark,
      description: "Full KYC required for bond and government securities",
      entityTypes: ["all"]
    },
    {
      name: "AIF (Alternative Investment Funds)",
      verified: currentKYCLevel === "enhanced",
      required: "enhanced",
      icon: LucideShield,
      description: "Enhanced KYC required for alternative investments",
      entityTypes: ["all"]
    },
    {
      name: "PMS (Portfolio Management Services)",
      verified: currentKYCLevel === "enhanced",
      required: "enhanced",
      icon: Briefcase,
      description: "Enhanced KYC required for portfolio management",
      entityTypes: ["all"]
    },
    {
      name: "Global Investments",
      verified: currentKYCLevel === "enhanced",
      required: "enhanced",
      icon: Globe,
      description: "Enhanced KYC with FATCA/CRS compliance for international investments",
      entityTypes: ["all"]
    }
  ];

  const getStatusIcon = (verified: boolean, required: string) => {
    if (verified && isProfileCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    } else if (currentKYCLevel === "none" || currentKYCLevel === "basic") {
      return <XCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (verified: boolean, required: string) => {
    if (verified && isProfileCompleted) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700" data-testid={`badge-verified`}>
          Verified
        </Badge>
      );
    } else if (currentKYCLevel === "none") {
      return (
        <Badge variant="destructive" data-testid={`badge-not-verified`}>
          Not Verified
        </Badge>
      );
    } else if (currentKYCLevel === "basic") {
      return (
        <Badge variant="destructive" data-testid={`badge-insufficient`}>
          Insufficient KYC
        </Badge>
      );
    } else if (required === "enhanced" && currentKYCLevel === "full") {
      return (
        <Badge variant="outline" className="border-yellow-600 text-yellow-700 dark:text-yellow-300" data-testid={`badge-upgrade-required`}>
          Enhanced KYC Required
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" data-testid={`badge-pending`}>
          Pending Verification
        </Badge>
      );
    }
  };

  const getRequirementMessage = (required: string) => {
    if (clientType === "non_individual") {
      if (required === "full") {
        return "Requires: Entity verification, Directors/Authorized Signatories, Bank Account";
      } else {
        return "Requires: Enhanced verification, UBO disclosure, Audited financials";
      }
    } else {
      if (required === "full") {
        return "Requires: PAN verification, Address proof, Bank account details";
      } else {
        return "Requires: Video KYC, Income proof, Enhanced documentation";
      }
    }
  };

  return (
    <Card data-testid="product-verification-status-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LucideShield className="h-5 w-5" />
          Product Verification Status
        </CardTitle>
        <CardDescription>
          {clientType === "non_individual" 
            ? `Entity Type: ${entityType || "Not specified"} - Verification status for investment products`
            : "Your eligibility for various investment products based on KYC level"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {products.map((product) => {
            const Icon = product.icon;
            return (
              <div
                key={product.name}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`product-item-${product.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{product.name}</h4>
                      {getStatusIcon(product.verified, product.required)}
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm text-muted-foreground cursor-help">
                            {getRequirementMessage(product.required)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">{product.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div>
                  {getStatusBadge(product.verified, product.required)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Message */}
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            {currentKYCLevel === "none" && (
              <>⚠️ Complete your KYC verification to start investing in any product</>
            )}
            {currentKYCLevel === "basic" && (
              <>⚠️ Upgrade to Full KYC to access investment products. Basic KYC is no longer sufficient for financial transactions.</>
            )}
            {currentKYCLevel === "full" && (
              <>✅ You can invest in Mutual Funds, Stocks, and Bonds. Upgrade to Enhanced KYC for AIF, PMS, and Global investments.</>
            )}
            {currentKYCLevel === "enhanced" && (
              <>✅ All investment products are available to you. You have the highest KYC verification level.</>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
