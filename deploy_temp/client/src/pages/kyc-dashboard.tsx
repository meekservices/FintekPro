import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, ShieldCheck, Crown, CheckCircle2, XCircle, AlertCircle, Lock, Unlock, Edit, ArrowRight, FileCheck, TrendingUp, Clock, Video, AlertTriangle } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { differenceInDays, differenceInMonths, format } from 'date-fns';

export default function KYCDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedTier, setSelectedTier] = useState<string>('');

  // Fetch current user
  const { data: user } = useQuery({ queryKey: ["/api/user"], retry: false });

  // Fetch user's KYC profile
  const { data: kycProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/kyc/my-profile'],
    enabled: !!user
  });

  // Fetch product eligibility
  const { data: eligibilityData, isLoading: eligibilityLoading } = useQuery({
    queryKey: ['/api/kyc/product-eligibility'],
    enabled: !!user
  });

  // Fetch vault status (includes V-CIP expiry)
  const { data: vaultStatus } = useQuery<{
    success: boolean;
    verifiedFields: {
      videoKycCompleted: boolean;
      videoKycCompletedAt: string | null;
      videoKycExpiryDate: string | null;
      videoKycExpired: boolean;
    };
  }>({
    queryKey: ['/api/kyc/vault-status'],
    enabled: !!user,
  });

  // KYC upgrade request mutation
  const upgradeMutation = useMutation({
    mutationFn: async (targetTier: string) => {
      return await apiRequest('POST', '/api/kyc/request-upgrade', { body: { targetTier } });
    },
    onSuccess: (data) => {
      toast({
        title: 'Upgrade Requested',
        description: data.message || 'Your KYC tier upgrade request has been submitted.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/kyc/my-profile'] });
      setSelectedTier('');
    },
    onError: (error: any) => {
      toast({
        title: 'Upgrade Failed',
        description: error.message || 'Failed to request KYC upgrade',
        variant: 'destructive',
      });
    }
  });

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please log in to view your KYC dashboard</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (profileLoading || eligibilityLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  const profile = (kycProfile as any)?.data;
  const eligibility = (eligibilityData as any)?.data;

  // KYC Tier Icon and Color
  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic':
        return <Shield className="h-5 w-5" />;
      case 'enhanced':
        return <ShieldCheck className="h-5 w-5" />;
      case 'accredited_investor':
        return <Crown className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic':
        return 'bg-blue-500';
      case 'enhanced':
        return 'bg-green-500';
      case 'accredited_investor':
        return 'bg-purple-500';
      default:
        return 'bg-muted';
    }
  };

  const getTierBadgeVariant = (tier: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (tier) {
      case 'basic':
        return 'default';
      case 'enhanced':
        return 'secondary';
      case 'accredited_investor':
        return 'outline';
      default:
        return 'default';
    }
  };

  const formatTierName = (tier: string) => {
    return tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-kyc-dashboard">My KYC Dashboard</h1>
          <p className="text-muted-foreground">Manage your verification and access</p>
        </div>
        <Badge className={`${getTierColor(profile?.kycTier || 'basic')} text-foreground px-4 py-2 text-lg`} data-testid="badge-kyc-tier">
          {getTierIcon(profile?.kycTier || 'basic')}
          <span className="ml-2">{formatTierName(profile?.kycTier || 'basic')}</span>
        </Badge>
      </div>

      {/* KYC Profile Overview */}
      <Card data-testid="card-kyc-profile">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            KYC Profile Overview
          </CardTitle>
          <CardDescription>Your unique identification and verification status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* User ID */}
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-semibold" data-testid="text-user-id">{profile?.userId}</p>
            </div>

            {/* Full Name */}
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-semibold" data-testid="text-full-name">{profile?.fullName || 'Not provided'}</p>
            </div>

            {/* Email */}
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-semibold" data-testid="text-email">{profile?.email}</p>
            </div>

            {/* Mobile */}
            <div>
              <p className="text-sm text-muted-foreground">Mobile</p>
              <p className="font-semibold" data-testid="text-mobile">{profile?.mobile}</p>
            </div>

            {/* PAN Number */}
            <div>
              <p className="text-sm text-muted-foreground">PAN Number</p>
              <p className="font-semibold" data-testid="text-pan">{profile?.panNumber || 'Not verified'}</p>
            </div>

            {/* KYC Status */}
            <div>
              <p className="text-sm text-muted-foreground">KYC Status</p>
              <Badge variant={profile?.kycStatus === 'approved' ? 'default' : 'secondary'} data-testid="badge-kyc-status">
                {profile?.kycStatus || 'pending'}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Verification Status */}
          <div>
            <h3 className="font-semibold mb-3">Verification Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <VerificationBadge 
                label="PAN" 
                verified={profile?.panVerified} 
                testId="status-pan-verified"
              />
              <VerificationBadge 
                label="Aadhaar" 
                verified={profile?.aadhaarVerified} 
                testId="status-aadhaar-verified"
              />
              <VerificationBadge 
                label="Bank" 
                verified={profile?.bankVerified} 
                testId="status-bank-verified"
              />
              <VerificationBadge 
                label="Video KYC" 
                verified={profile?.videoKycCompleted} 
                testId="status-video-kyc"
              />
              <VerificationBadge 
                label="CKYC" 
                verified={profile?.ckycVerified} 
                testId="status-ckyc-verified"
              />
            </div>
          </div>

          {/* V-CIP Expiry Status */}
          {vaultStatus?.verifiedFields?.videoKycCompleted && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Video className="h-4 w-4" />
                Video KYC (V-CIP) Status
              </h3>
              <VcipExpiryBadge
                expiryDate={vaultStatus.verifiedFields.videoKycExpiryDate}
                expired={vaultStatus.verifiedFields.videoKycExpired}
              />
            </div>
          )}

          {/* Compliance Status */}
          <div>
            <h3 className="font-semibold mb-3">Compliance Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ComplianceItem 
                label="Risk Category" 
                value={profile?.riskCategory || 'low'} 
                testId="text-risk-category"
              />
              <ComplianceItem 
                label="PEP Status" 
                value={profile?.pepStatus === 'Y' ? 'Yes' : 'No'} 
                testId="text-pep-status"
              />
              <ComplianceItem 
                label="FATCA Status" 
                value={profile?.fatcaStatus === 'Y' ? 'Declared' : 'Not Applicable'} 
                testId="text-fatca-status"
              />
              <ComplianceItem 
                label="AML Status" 
                value={profile?.amlStatus || 'clear'} 
                testId="text-aml-status"
              />
            </div>
          </div>

          {/* Edit KYC Button */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              className="gap-2" 
              data-testid="button-edit-kyc"
              onClick={() => setLocation('/onboarding?mode=edit')}
            >
              <Edit className="h-4 w-4" />
              Edit KYC Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Tier Benefits & Upgrade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Tier Benefits */}
        <Card data-testid="card-current-tier">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTierIcon(profile?.kycTier || 'basic')}
              Your Current Tier
            </CardTitle>
            <CardDescription>{profile?.kycTierMetadata?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm">
                  {profile?.kycTierMetadata?.productsUnlocked?.length || 0} Products Unlocked
                </span>
              </div>
              {profile?.kycTierMetadata?.maxAnnualInvestment && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">
                    Max Investment: ₹{(profile.kycTierMetadata.maxAnnualInvestment / 1000).toFixed(0)}K/year
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Option */}
        {eligibility?.nextTier && (
          <Card className="border-2 border-primary" data-testid="card-upgrade-tier">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Upgrade to {formatTierName(eligibility.nextTier)}
              </CardTitle>
              <CardDescription>Unlock more investment products and higher limits</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full" 
                    onClick={() => setSelectedTier(eligibility.nextTier)}
                    data-testid="button-upgrade-tier"
                  >
                    Request Upgrade
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request KYC Tier Upgrade</DialogTitle>
                    <DialogDescription>
                      You are requesting an upgrade to {formatTierName(eligibility.nextTier)}. 
                      Our compliance team will review your request within 24-48 hours.
                    </DialogDescription>
                  </DialogHeader>
                  <Button 
                    onClick={() => upgradeMutation.mutate(eligibility.nextTier)}
                    disabled={upgradeMutation.isPending}
                    data-testid="button-confirm-upgrade"
                  >
                    {upgradeMutation.isPending ? 'Submitting...' : 'Confirm Upgrade Request'}
                  </Button>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Eligibility */}
      <Card data-testid="card-product-eligibility">
        <CardHeader>
          <CardTitle>Product Eligibility</CardTitle>
          <CardDescription>Products you can access based on your KYC tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Accessible Products */}
            <div>
              <h3 className="font-semibold mb-3 text-green-600 dark:text-green-400 flex items-center gap-2">
                <Unlock className="h-5 w-5" />
                Unlocked Products ({eligibility?.totalProductsAccessible || 0})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {eligibility?.accessibleProducts?.slice(0, 6).map((product: any) => (
                  <ProductCard 
                    key={product.productCode}
                    product={product}
                    isAccessible={true}
                  />
                ))}
              </div>
            </div>

            {/* Locked Products */}
            {eligibility?.lockedProducts && eligibility.lockedProducts.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 text-muted-foreground flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Locked Products ({eligibility?.totalProductsLocked || 0})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {eligibility?.lockedProducts?.slice(0, 6).map((product: any) => (
                    <ProductCard 
                      key={product.productCode}
                      product={product}
                      isAccessible={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Re-KYC Information (if applicable) */}
      {profile?.riskNextReview && (
        <Alert data-testid="alert-rekyc">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Next KYC Review Due: {new Date(profile.riskNextReview).toLocaleDateString('en-IN')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// V-CIP Expiry Badge Component
function VcipExpiryBadge({ expiryDate, expired }: { expiryDate: string | null; expired: boolean }) {
  if (!expiryDate) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Expiry date not set</span>
      </div>
    );
  }

  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysLeft = differenceInDays(expiry, now);
  const monthsLeft = differenceInMonths(expiry, now);

  if (expired || daysLeft <= 0) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">V-CIP Expired</p>
          <p className="text-xs text-red-600 dark:text-red-400">Expired on {format(expiry, 'dd MMM yyyy')} — please renew your Video KYC</p>
        </div>
        <Badge variant="destructive" className="ml-auto shrink-0">Expired</Badge>
      </div>
    );
  }

  if (daysLeft <= 30) {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Expiry date: {format(expiry, 'dd MMM yyyy')}</p>
        </div>
        <Badge variant="destructive" className="ml-auto shrink-0">Expires in {daysLeft}d</Badge>
      </div>
    );
  }

  if (monthsLeft <= 6) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <Clock className="h-5 w-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Expires in {monthsLeft} month{monthsLeft !== 1 ? 's' : ''}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400">Expiry date: {format(expiry, 'dd MMM yyyy')}</p>
        </div>
        <Badge className="ml-auto shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Expires in {monthsLeft}mo</Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">Expires in {monthsLeft} month{monthsLeft !== 1 ? 's' : ''}</p>
        <p className="text-xs text-green-600 dark:text-green-400">Expiry date: {format(expiry, 'dd MMM yyyy')}</p>
      </div>
      <Badge className="ml-auto shrink-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Expires in {monthsLeft}mo</Badge>
    </div>
  );
}

// Verification Badge Component
function VerificationBadge({ label, verified, testId }: { label: string; verified: boolean; testId: string }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-lg" data-testid={testId}>
      {verified ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}

// Compliance Item Component
function ComplianceItem({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="p-3 bg-muted rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold capitalize" data-testid={testId}>{value}</p>
    </div>
  );
}

// Product Card Component
function ProductCard({ product, isAccessible }: { product: any; isAccessible: boolean }) {
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isAccessible 
          ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
          : 'bg-muted border-border'
      }`}
      data-testid={`card-product-${product.productCode}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-semibold text-sm">{product.productName}</p>
          {!isAccessible && (
            <Badge variant="outline" className="mt-1 text-xs">
              Requires: {product.requiredUpgrade?.replace(/_/g, ' ')}
            </Badge>
          )}
        </div>
        {isAccessible ? (
          <Unlock className="h-4 w-4 text-green-500" />
        ) : (
          <Lock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
