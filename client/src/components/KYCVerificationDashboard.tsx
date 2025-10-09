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
  Globe
} from "lucide-react";
import { ProductVerificationStatus } from "@/components/ProductVerificationStatus";
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

export function KYCVerificationDashboard() {
  const { data: kycStatus } = useQuery<{ success: boolean; data: KYCStatus }>({
    queryKey: ["/api/profile/kyc-status"],
  });

  const { data: profileData } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const profile = profileData;
  const status = kycStatus?.data;

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
        <Badge variant="outline" className="border-yellow-600 text-yellow-700" data-testid="kyc-level-basic">
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

  return (
    <div className="space-y-6" data-testid="kyc-verification-dashboard">
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
