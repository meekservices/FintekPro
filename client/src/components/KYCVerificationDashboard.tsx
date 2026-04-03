import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Building2, 
  User, 
  ExternalLink,
  Smartphone,
  ArrowRight,
  Lock,
  Globe,
  Edit,
  TrendingUp,
  CreditCard,
  Package
} from "lucide-react";
import { ProductVerificationStatus } from "@/components/ProductVerificationStatus";
import { KYCProductAccessPanel } from "@/components/KYCProductAccessPanel";
import { Link } from "wouter";

interface KYCStatus {
  userId: string;
  currentLevel: "none" | "basic" | "full" | "enhanced";
  isActive: boolean;
  requiresReKYC: boolean;
  canTradeMutualFunds: boolean;
  canTradeBroking: boolean;
  canTradeInternational: boolean;
  pendingActions: string[];
}

interface UserProfile {
  clientType: "individual" | "non_individual";
  entityType?: string;
  isProfileCompleted: boolean;
  digilockerVerified?: boolean;
  sandboxVerified?: boolean;
  companyName?: string;
  firstName?: string;
  lastName?: string;
}

interface VerifiedKYCData {
  fullName: string | null;
  panNumber: string | null;
  kycTier: string;
  panVerified: boolean;
  aadhaarVerified: boolean;
  verificationDate: string | null;
  smartKycCompleted: boolean;
}

interface ProductAccess {
  tier: string;
  unlockedProducts: string[];
  tierProducts: {
    basic: string[];
    enhanced: string[];
    accredited_investor: string[];
  };
}

export function KYCVerificationDashboard() {
  const { data: kycStatus } = useQuery<{ success: boolean; data: KYCStatus }>({
    queryKey: ["/api/profile/kyc-status"],
  });

  const { data: profileData } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  // Fetch verified KYC profile data
  const { data: verifiedKYCData } = useQuery<{ success: boolean; data: VerifiedKYCData }>({
    queryKey: ["/api/profile/kyc-verified-data"],
  });

  // Fetch product access based on tier
  const { data: productAccessData } = useQuery<{ success: boolean; data: ProductAccess }>({
    queryKey: ["/api/profile/kyc-tier/product-access"],
  });

  const profile = profileData;
  const status = kycStatus?.data;
  const verifiedKYC = verifiedKYCData?.data;
  const productAccess = productAccessData?.data;

  // Show loading state only if critical data (profile or status) is missing
  // Verified KYC and product access are optional enhancements
  if (!profile || !status) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>KYC Verification Dashboard</CardTitle>
            <CardDescription>Loading verification status...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const getKYCLevelBadge = () => {
    const level = status.currentLevel;
    
    if (level === "enhanced") {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white" data-testid="kyc-level-enhanced">
          <Shield className="h-3 w-3 mr-1" />
          Enhanced KYC
        </Badge>
      );
    } else if (level === "full") {
      return (
        <Badge className="bg-green-600 hover:bg-green-700" data-testid="kyc-level-full">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Full KYC
        </Badge>
      );
    } else if (level === "basic") {
      return (
        <Badge variant="outline" className="border-yellow-600 text-yellow-700 dark:text-yellow-300" data-testid="kyc-level-basic">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Basic KYC (Upgrade Required)
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive" data-testid="kyc-level-none">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Not Verified
        </Badge>
      );
    }
  };

  const getKYCProgress = () => {
    if (status.currentLevel === "enhanced") return 100;
    if (status.currentLevel === "full") return 66;
    if (status.currentLevel === "basic") return 33;
    return 0;
  };

  // Helper functions for product display names
  const getProductDisplayName = (productCode: string): string => {
    const displayNames: Record<string, string> = {
      mutual_funds_regular: "Mutual Funds (Regular)",
      mutual_funds_direct: "Mutual Funds (Direct)",
      equity_cash_limited: "Equity Cash (Limited ₹50K)",
      equity_cash_unlimited: "Equity Cash (Unlimited)",
      equity_delivery: "Equity Delivery",
      ipo_retail: "IPO (Retail)",
      government_securities: "Government Securities",
      fixed_deposits: "Fixed Deposits",
      savings_products: "Savings Products",
      derivatives_fo: "Futures & Options",
      commodities_trading: "Commodities",
      currency_derivatives: "Currency Derivatives",
      global_trading: "Global Trading",
      unlisted_securities: "Unlisted Securities",
      bonds_ncds: "Bonds & NCDs",
      mlds: "Market Linked Debentures",
      etf_trading: "ETF Trading",
      margin_trading: "Margin Trading",
      aif_cat1: "AIF Category I",
      aif_cat2: "AIF Category II",
      aif_cat3: "AIF Category III",
      pms: "Portfolio Management",
      pre_ipo_investments: "Pre-IPO Investments",
      structured_products: "Structured Products",
      offshore_investments: "Offshore Investments",
      private_equity: "Private Equity",
      venture_capital: "Venture Capital",
      real_estate_investment_trusts: "REITs",
      invoice_discounting: "Invoice Discounting",
      startup_investments: "Startup Investments",
    };
    return displayNames[productCode] || productCode;
  };

  const getTierDisplayName = (tier: string): string => {
    if (tier === "basic") return "Basic KYC";
    if (tier === "enhanced") return "Enhanced KYC";
    if (tier === "accredited_investor") return "Accredited Investor";
    return tier;
  };

  const getTierBadgeColor = (tier: string) => {
    if (tier === "basic") return "bg-yellow-600 hover:bg-yellow-700";
    if (tier === "enhanced") return "bg-purple-600 hover:bg-purple-700";
    if (tier === "accredited_investor") return "bg-green-600 hover:bg-green-700";
    return "bg-muted";
  };

  return (
    <div className="space-y-6" data-testid="kyc-verification-dashboard">
      {/* Verified Profile Card */}
      {verifiedKYC && verifiedKYC.panVerified && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <User className="h-6 w-6 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl">{verifiedKYC.fullName || "User"}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Verified Profile
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-edit-profile">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">PAN Number</p>
                <p className="font-semibold text-lg" data-testid="text-pan-number">
                  {verifiedKYC.panNumber || "Not Available"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">KYC Tier</p>
                <Badge className={getTierBadgeColor(verifiedKYC.kycTier)} data-testid="badge-kyc-tier">
                  {getTierDisplayName(verifiedKYC.kycTier)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Verified On</p>
                <p className="font-medium" data-testid="text-verification-date">
                  {verifiedKYC.verificationDate 
                    ? new Date(verifiedKYC.verificationDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : "Not Available"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade CTA for non-accredited investors */}
      {productAccess && productAccess.tier !== "accredited_investor" && (
        <Alert className="border-purple-200 dark:border-purple-900 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
          <TrendingUp className="h-5 w-5 text-purple-600" />
          <AlertTitle className="text-lg font-semibold">Unlock Premium Investment Products</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {productAccess.tier === "basic" 
                ? "Upgrade to Enhanced KYC to access advanced investment products including direct mutual funds, F&O trading, and international markets."
                : "Become an Accredited Investor to unlock exclusive products like AIFs, PMS, and private equity."}
            </p>
            <Link href="/profile">
              <Button variant="default" className="bg-purple-600 hover:bg-purple-700" data-testid="button-upgrade-tier">
                <Shield className="h-4 w-4 mr-2" />
                {productAccess.tier === "basic" ? "Upgrade to Enhanced KYC" : "Apply for Accredited Status"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* KYC Product Access Panel — shows what's unlocked and what's still needed */}
      <KYCProductAccessPanel />

      {/* Overall KYC Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                KYC Verification Status
              </CardTitle>
              <CardDescription>
                {profile.clientType === "individual" 
                  ? `Individual Account - ${profile.firstName || ""} ${profile.lastName || ""}`
                  : `${profile.entityType || "Entity"} Account - ${profile.companyName || "Company"}`
                }
              </CardDescription>
            </div>
            {getKYCLevelBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Verification Level</span>
              <span className="font-medium">{getKYCProgress()}% Complete</span>
            </div>
            <Progress value={getKYCProgress()} className="h-2" />
          </div>

          {status.requiresReKYC && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Re-KYC Required</AlertTitle>
              <AlertDescription>
                Your KYC has expired. Please complete re-verification to continue trading.
              </AlertDescription>
            </Alert>
          )}

          {status.pendingActions && status.pendingActions.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pending Actions</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {status.pendingActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Verification Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Digital Verification Methods</CardTitle>
          <CardDescription>
            Choose the appropriate verification method based on your account type
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.clientType === "individual" ? (
            <>
              {/* DigiLocker for Individuals */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">DigiLocker Verification</h3>
                      {profile.digilockerVerified && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Instantly verify your identity using Aadhaar, PAN, and other government documents from DigiLocker
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Instant verification (2-3 minutes)</li>
                      <li>✓ Auto-populate KYC details</li>
                      <li>✓ Government-backed authentication</li>
                      <li>✓ Secure document sharing</li>
                    </ul>
                  </div>
                  <div className="ml-4">
                    <Link href="/digilocker">
                      <Button variant="default" data-testid="button-digilocker-verify">
                        {profile.digilockerVerified ? "Manage Documents" : "Verify Now"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Manual Upload Option */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Manual Document Upload</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload identity and address proof documents manually for verification
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Processing time: 2-3 business days
                    </p>
                  </div>
                  <div className="ml-4">
                    <Link href="/profile">
                      <Button variant="outline" data-testid="button-manual-upload">
                        Upload Documents
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Corporate KYC for Non-Individual Entities */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Corporate KYC Verification</h3>
                      {profile.sandboxVerified && (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Verify your entity using MCA, GSTIN, Corporate PAN/TAN verification via Sandbox API
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Real-time entity verification (CIN/GSTIN/PAN/TAN)</li>
                      <li>✓ Automated director/authorized signatory validation</li>
                      <li>✓ UBO (Ultimate Beneficial Owner) disclosure</li>
                      <li>✓ MCA and GST database integration</li>
                    </ul>
                  </div>
                  <div className="ml-4">
                    <Link href="/corporate-kyc">
                      <Button variant="default" data-testid="button-corporate-verify">
                        {profile.sandboxVerified ? "Update Details" : "Verify Entity"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Manual Corporate Document Upload */}
              <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Manual Entity Documentation</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Upload entity documents: MOA/AOA, Board Resolution, Partnership Deed, Trust Deed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Processing time: 3-5 business days
                    </p>
                  </div>
                  <div className="ml-4">
                    <Link href="/profile">
                      <Button variant="outline" data-testid="button-entity-upload">
                        Upload Documents
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Product Verification Status */}
      <ProductVerificationStatus
        currentKYCLevel={status.currentLevel}
        clientType={profile.clientType}
        entityType={profile.entityType}
        isProfileCompleted={profile.isProfileCompleted}
      />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Need Help?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {profile.clientType === "individual" 
              ? "For individual KYC queries, contact support or refer to our verification guide."
              : "For entity verification queries, contact our corporate onboarding team."
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@fintekpro.com">
                Contact Support
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/help/kyc" target="_blank">
                KYC Guide <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
