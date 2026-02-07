import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ImportedHoldingsReview } from "./ImportedHoldingsReview";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  TrendingUp,
  BarChart3,
  Wallet,
  Building2,
  PiggyBank,
  CreditCard,
  AlertCircle,
  Info,
  Smartphone,
  Lock
} from "lucide-react";

interface ConsentSession {
  id: string;
  status: string;
  assetTypes: string[];
  expiresAt: string;
  lastDataFetchAt: string | null;
  aaProvider: string;
}

interface SyncSummary {
  mutualFundsCount: number;
  dematHoldingsCount: number;
  npsCount: number;
  epfCount: number;
  ppfCount: number;
  loansCount: number;
  fetchedAt: string;
}

const ASSET_TYPES = [
  { id: "MF", label: "Mutual Funds", icon: TrendingUp, description: "CAMS, KFinTech holdings" },
  { id: "DEMAT", label: "Stocks & ETFs", icon: BarChart3, description: "NSDL/CDSL demat account" },
  { id: "NPS", label: "NPS", icon: PiggyBank, description: "National Pension System" },
  { id: "EPF", label: "EPF/PPF", icon: Building2, description: "Provident Fund accounts" },
  { id: "PPF", label: "PPF", icon: Wallet, description: "Public Provident Fund" },
  { id: "LOANS", label: "Loans", icon: CreditCard, description: "Outstanding liabilities" },
];

export function ExternalPortfolioSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedAssets, setSelectedAssets] = useState<string[]>(["MF", "DEMAT", "NPS", "EPF"]);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'consenting' | 'fetching' | 'syncing' | 'complete' | 'error'>('idle');

  const userPAN = (user as any)?.pan || (user as any)?.panNumber || '';
  const userId = user?.id || '';

  const { data: activeConsent, isLoading: consentLoading, refetch: refetchConsent } = useQuery<{ 
    hasActiveConsent: boolean; 
    session: ConsentSession | null 
  }>({
    queryKey: ['/api/aa/consent/active', userId],
    enabled: !!userId,
  });

  const { data: pendingStagingSession } = useQuery<{
    id: string | null;
    holdings: any[];
    status: string;
  }>({
    queryKey: ['/api/portfolio/staging', userId],
    enabled: !!userId && !showReviewUI,
  });

  const hasPendingStaging = pendingStagingSession?.holdings?.length > 0 && 
    pendingStagingSession?.status !== 'synced';

  const createConsentMutation = useMutation({
    mutationFn: async () => {
      setSyncStatus('consenting');
      setSyncProgress(10);
      
      const response = await apiRequest('/api/aa/consent/create', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          panNumber: userPAN,
          assetTypes: selectedAssets,
          validityDays: 90,
          syncFrequencyDays: 30
        })
      });
      return response;
    },
    onSuccess: (data: any) => {
      setSyncProgress(25);
      toast({
        title: "Consent Created",
        description: "Redirecting to AA portal for OTP verification...",
      });
      
      // In production, redirect to AA portal
      // For development, simulate approval
      if (data.redirectUrl?.includes('mock=true')) {
        simulateConsentApproval(data.consentHandleId);
      } else {
        window.open(data.redirectUrl, '_blank');
      }
    },
    onError: (error: any) => {
      setSyncStatus('error');
      toast({
        title: "Consent Failed",
        description: error.message || "Failed to create consent request",
        variant: "destructive"
      });
    }
  });

  const [showReviewUI, setShowReviewUI] = useState(false);

  const fetchDataMutation = useMutation({
    mutationFn: async (consentSessionId: string) => {
      setSyncStatus('fetching');
      setSyncProgress(50);
      
      const response = await apiRequest('/api/aa/data/fetch', {
        method: 'POST',
        body: JSON.stringify({ consentSessionId, userId, useStaging: true })
      });
      return response;
    },
    onSuccess: (data: any) => {
      setSyncProgress(75);
      toast({
        title: "Data Fetched",
        description: `Found ${data.summary?.mutualFundsCount || 0} MF, ${data.summary?.dematHoldingsCount || 0} stocks`,
      });
      
      if (data.requiresReview && data.mode === 'staging') {
        setSyncProgress(100);
        setSyncStatus('complete');
        setShowReviewUI(true);
        setConsentDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['/api/portfolio/staging', userId] });
        toast({
          title: "Review Holdings",
          description: `${data.holdingsCount} holdings ready for review. Please approve before syncing.`,
        });
      } else {
        setSyncProgress(100);
        setSyncStatus('complete');
        queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
        queryClient.invalidateQueries({ queryKey: ['/api/aa/consent/active', userId] });
        setConsentDialogOpen(false);
        toast({
          title: "Portfolio Synced!",
          description: `Successfully synced ${data.storedCount} holdings to your portfolio`,
        });
      }
    },
    onError: (error: any) => {
      setSyncStatus('error');
      toast({
        title: "Fetch Failed",
        description: error.message || "Failed to fetch aggregated data",
        variant: "destructive"
      });
    }
  });

  const syncToPortfolioMutation = useMutation({
    mutationFn: async (consentSessionId: string) => {
      setSyncStatus('syncing');
      setSyncProgress(90);
      
      const response = await apiRequest('/api/aa/sync-to-portfolio', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          portfolioId: 'default',
          consentSessionId
        })
      });
      return response;
    },
    onSuccess: (data: any) => {
      setSyncProgress(100);
      setSyncStatus('complete');
      
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consent/active', userId] });
      
      toast({
        title: "Portfolio Synced!",
        description: `Successfully synced ${data.syncedCount} holdings to your portfolio`,
      });
      
      setConsentDialogOpen(false);
    },
    onError: (error: any) => {
      setSyncStatus('error');
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync to portfolio",
        variant: "destructive"
      });
    }
  });

  const simulateConsentApproval = async (consentHandleId: string) => {
    setSyncProgress(30);
    
    // Simulate OTP approval delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Call callback to simulate approval
    await apiRequest('/api/aa/consent/callback', {
      method: 'POST',
      body: JSON.stringify({
        consentHandleId,
        status: 'APPROVED'
      })
    });
    
    setSyncProgress(40);
    await refetchConsent();
    
    // Fetch data after approval
    const updatedConsent = await queryClient.fetchQuery({
      queryKey: ['/api/aa/consent/active', userId]
    }) as { session: ConsentSession | null };
    
    if (updatedConsent?.session?.id) {
      fetchDataMutation.mutate(updatedConsent.session.id);
    }
  };

  const handleStartSync = () => {
    if (!userPAN) {
      toast({
        title: "PAN Required",
        description: "Please complete PAN verification before syncing portfolio",
        variant: "destructive"
      });
      return;
    }
    
    if (activeConsent?.hasActiveConsent && activeConsent.session?.id) {
      // Use existing consent
      fetchDataMutation.mutate(activeConsent.session.id);
    } else {
      // Need new consent
      setConsentDialogOpen(true);
    }
  };

  const handleRefreshData = () => {
    if (activeConsent?.session?.id) {
      fetchDataMutation.mutate(activeConsent.session.id);
    }
  };

  const toggleAssetType = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(a => a !== assetId)
        : [...prev, assetId]
    );
  };

  const isLoading = createConsentMutation.isPending || 
                    fetchDataMutation.isPending || 
                    syncToPortfolioMutation.isPending;

  if (showReviewUI) {
    return (
      <ImportedHoldingsReview
        userId={userId}
        onSyncComplete={() => {
          setShowReviewUI(false);
          setSyncStatus('idle');
          setSyncProgress(0);
          queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
          queryClient.invalidateQueries({ queryKey: ['/api/aa/consent/active', userId] });
        }}
        onCancel={() => {
          setShowReviewUI(false);
          setSyncStatus('idle');
          setSyncProgress(0);
        }}
      />
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 border-indigo-200 dark:border-indigo-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <RefreshCw className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-xl text-indigo-900 dark:text-indigo-100">
                Sync External Portfolio
              </CardTitle>
              <CardDescription className="text-indigo-700 dark:text-indigo-300">
                Auto-import holdings via Account Aggregator (AA)
              </CardDescription>
            </div>
          </div>
          
          {activeConsent?.hasActiveConsent && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Consent Active
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Pending Staging Alert */}
        {hasPendingStaging && (
          <Alert className="bg-blue-50 border-blue-200">
            <RefreshCw className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 flex items-center justify-between">
              <span>
                You have {pendingStagingSession?.holdings?.length || 0} holdings pending review.
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowReviewUI(true)}
                className="ml-3"
              >
                Resume Review
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Status Alert */}
        {!userPAN && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Complete PAN verification in your KYC dashboard to enable portfolio sync.
            </AlertDescription>
          </Alert>
        )}

        {/* Active Consent Info */}
        {activeConsent?.hasActiveConsent && activeConsent.session && (
          <div className="bg-background rounded-lg p-4 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">Active Consent</h4>
              <Badge variant="outline" className="text-xs">
                via {activeConsent.session.aaProvider}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Asset Types:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(activeConsent.session.assetTypes as string[])?.map(type => (
                    <Badge key={type} variant="secondary" className="text-xs">
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>
                <p className="text-foreground">
                  {new Date(activeConsent.session.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Sync:</span>
                <p className="text-foreground">
                  {activeConsent.session.lastDataFetchAt 
                    ? new Date(activeConsent.session.lastDataFetchAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sync Progress */}
        {syncStatus !== 'idle' && syncStatus !== 'complete' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {syncStatus === 'consenting' && 'Creating consent request...'}
                {syncStatus === 'fetching' && 'Fetching data from sources...'}
                {syncStatus === 'syncing' && 'Syncing to portfolio...'}
                {syncStatus === 'error' && 'Error occurred'}
              </span>
              <span className="font-medium">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </div>
        )}

        {/* Success Message */}
        {syncStatus === 'complete' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Portfolio sync completed successfully! Your holdings have been updated.
            </AlertDescription>
          </Alert>
        )}

        {/* Data Sources */}
        <div className="bg-background rounded-lg p-4 border border-border">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            Supported Data Sources
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ASSET_TYPES.map(asset => (
              <div 
                key={asset.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted"
              >
                <asset.icon className="w-4 h-4 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">{asset.label}</p>
                  <p className="text-xs text-muted-foreground">{asset.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              This uses RBI-regulated Account Aggregator framework. You'll approve data sharing 
              via OTP on the AA portal. Your data is encrypted and fetched directly from 
              CAMS, KFinTech, NSDL, CDSL, NPS CRA, and EPFO.
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3">
        {activeConsent?.hasActiveConsent ? (
          <>
            <Button 
              className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              onClick={handleRefreshData}
              disabled={isLoading}
              data-testid="refresh-portfolio-button"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh Portfolio Data
            </Button>
            <Button 
              variant="outline"
              onClick={() => setConsentDialogOpen(true)}
              disabled={isLoading}
              data-testid="new-consent-button"
            >
              New Consent
            </Button>
          </>
        ) : (
          <Button 
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            onClick={handleStartSync}
            disabled={isLoading || !userPAN}
            data-testid="sync-portfolio-button"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync My External Portfolio
          </Button>
        )}
      </CardFooter>

      {/* Consent Dialog */}
      <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              Consent for Portfolio Access
            </DialogTitle>
            <DialogDescription>
              Select the account types you want to sync. You'll verify via OTP on the AA portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Asset Type Selection */}
            <div className="space-y-3">
              {ASSET_TYPES.map(asset => (
                <div 
                  key={asset.id}
                  className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted"
                >
                  <Checkbox
                    id={asset.id}
                    checked={selectedAssets.includes(asset.id)}
                    onCheckedChange={() => toggleAssetType(asset.id)}
                    data-testid={`checkbox-${asset.id.toLowerCase()}`}
                  />
                  <Label htmlFor={asset.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <asset.icon className="w-4 h-4 text-indigo-500" />
                      <span className="font-medium">{asset.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{asset.description}</p>
                  </Label>
                </div>
              ))}
            </div>

            {/* Consent Info */}
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">One-Time OTP Verification</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">
                    After clicking continue, you'll be redirected to the Account Aggregator 
                    portal to approve access via OTP. This consent is valid for 90 days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createConsentMutation.mutate()}
              disabled={selectedAssets.length === 0 || createConsentMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-blue-600"
              data-testid="confirm-consent-button"
            >
              {createConsentMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Continue to AA Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
