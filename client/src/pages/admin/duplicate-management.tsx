import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, AlertTriangle, Mail, Phone, CreditCard, TrendingUp, CheckCircle, XCircle, Merge } from "lucide-react";
import { format } from "date-fns";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DuplicateUser {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  firstName: string | null;
  lastName: string | null;
  panNumber: string | null;
  createdAt: Date | null;
}

interface DuplicateMatch {
  user1: DuplicateUser;
  user2: DuplicateUser;
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number;
  reasons: string[];
  nameSimilarity: number;
  autoMergeRecommended: boolean;
}

interface DuplicateStats {
  totalDuplicates: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  autoMergeRecommended: number;
}

export default function DuplicateManagementPage() {
  const { toast } = useToast();

  const { data: statsData, isLoading: statsLoading } = useQuery<DuplicateStats>({
    queryKey: ['/api/admin/duplicate-stats'],
  });

  const { data: duplicatesData, isLoading: duplicatesLoading, error } = useQuery<{ duplicates: DuplicateMatch[] }>({
    queryKey: ['/api/admin/duplicates'],
  });

  const mergeMutation = useMutation({
    mutationFn: async (params: { keepUserId: string; mergeUserId: string }) => {
      return await apiRequest('POST', '/api/admin/merge-accounts', { body: params });
    },
    onSuccess: () => {
      toast({
        title: "Duplicate Account Deactivated",
        description: "The duplicate account has been deactivated. Note: Data transfer must be done manually.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/duplicate-stats'] });
    },
    onError: () => {
      toast({
        title: "Merge Failed",
        description: "Failed to merge accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  const duplicates = duplicatesData?.duplicates || [];
  const highRiskDuplicates = duplicates.filter(d => d.riskLevel === 'high');
  const mediumRiskDuplicates = duplicates.filter(d => d.riskLevel === 'medium');
  const lowRiskDuplicates = duplicates.filter(d => d.riskLevel === 'low');

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-red-900/50 text-red-300 border-red-800';
      case 'medium':
        return 'bg-orange-900/50 text-orange-300 border-orange-800';
      case 'low':
        return 'bg-yellow-900/50 text-yellow-300 border-yellow-800';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getFullName = (user: DuplicateUser) => {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'N/A';
  };

  const handleMerge = (keepUser: DuplicateUser, mergeUser: DuplicateUser) => {
    if (window.confirm(
      `Are you sure you want to deactivate this duplicate account?\n\n` +
      `KEEP: ${getFullName(keepUser)} (${keepUser.userId})\n` +
      `DEACTIVATE: ${getFullName(mergeUser)} (${mergeUser.userId})\n\n` +
      `WARNING: This will only deactivate the duplicate account. Data transfer (transactions, portfolios, etc.) must be done manually if needed.`
    )) {
      mergeMutation.mutate({
        keepUserId: keepUser.id,
        mergeUserId: mergeUser.id,
      });
    }
  };

  if (statsLoading || duplicatesLoading) {
    return <LoadingState variant="card" count={3} />;
  }

  if (error) {
    return (
      <Alert variant="destructive" className="bg-red-900/20 border-red-900">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-red-400">
          Failed to load duplicate data. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const renderDuplicateCard = (match: DuplicateMatch, index: number) => (
    <Card key={`${match.user1.id}-${match.user2.id}`} className="bg-card border-border">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={getRiskBadgeColor(match.riskLevel)}>
                {(match.riskLevel || 'medium').toUpperCase()} RISK
              </Badge>
              <span className="text-muted-foreground text-sm" data-testid={`risk-score-${index}`}>
                Risk Score: {match.riskScore}/100
              </span>
              {match.autoMergeRecommended && (
                <Badge className="bg-purple-900/50 text-purple-300 border-purple-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Auto-Merge Recommended
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {match.reasons.map((reason, idx) => (
                <span key={idx} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User 1 */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white">Account 1</h4>
              <span className="text-xs text-muted-foreground">
                {match.user1.createdAt 
                  ? format(new Date(match.user1.createdAt), 'MMM dd, yyyy')
                  : 'Unknown date'
                }
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <span className="text-white ml-2 font-mono" data-testid={`user1-id-${index}`}>
                  {match.user1.userId}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="text-white ml-2">{getFullName(match.user1)}</span>
              </div>
              {match.user1.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user1.email}</span>
                </div>
              )}
              {match.user1.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user1.mobile}</span>
                </div>
              )}
              {match.user1.panNumber && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user1.panNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* User 2 */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-white">Account 2</h4>
              <span className="text-xs text-muted-foreground">
                {match.user2.createdAt 
                  ? format(new Date(match.user2.createdAt), 'MMM dd, yyyy')
                  : 'Unknown date'
                }
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">User ID:</span>
                <span className="text-white ml-2 font-mono" data-testid={`user2-id-${index}`}>
                  {match.user2.userId}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="text-white ml-2">{getFullName(match.user2)}</span>
              </div>
              {match.user2.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user2.email}</span>
                </div>
              )}
              {match.user2.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user2.mobile}</span>
                </div>
              )}
              {match.user2.panNumber && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{match.user2.panNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMerge(match.user1, match.user2)}
            disabled={mergeMutation.isPending}
            data-testid={`merge-button-keep-1-${index}`}
          >
            <Merge className="h-4 w-4 mr-1" />
            Keep Account 1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMerge(match.user2, match.user1)}
            disabled={mergeMutation.isPending}
            data-testid={`merge-button-keep-2-${index}`}
          >
            <Merge className="h-4 w-4 mr-1" />
            Keep Account 2
          </Button>
        </div>

        {match.nameSimilarity > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            Name similarity: {match.nameSimilarity}%
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="page-duplicate-management">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white" data-testid="heading-page-title">
          Duplicate Account Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Intelligent duplicate detection with risk scoring and fuzzy name matching
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Duplicates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="stat-total">
              {statsData?.totalDuplicates || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-red-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-300" data-testid="stat-high-risk">
              {statsData?.highRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-orange-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-400">Medium Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-300" data-testid="stat-medium-risk">
              {statsData?.mediumRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-yellow-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-400">Low Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-300" data-testid="stat-low-risk">
              {statsData?.lowRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-purple-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Auto-Merge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-300" data-testid="stat-auto-merge">
              {statsData?.autoMergeRecommended || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {duplicates.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No Duplicate Accounts Found"
          description="All user accounts are unique. The intelligent duplicate detection system found no matches."
        />
      ) : (
        <Tabs defaultValue="high" className="w-full">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="high" data-testid="tab-high-risk">
              High Risk ({highRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger value="medium" data-testid="tab-medium-risk">
              Medium Risk ({mediumRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger value="low" data-testid="tab-low-risk">
              Low Risk ({lowRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">
              All ({duplicates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="high" className="space-y-4 mt-6">
            {highRiskDuplicates.length === 0 ? (
              <EmptyState
                icon={XCircle}
                title="No High Risk Duplicates"
                description="No high-risk duplicate accounts detected."
              />
            ) : (
              highRiskDuplicates.map((match, idx) => renderDuplicateCard(match, idx))
            )}
          </TabsContent>

          <TabsContent value="medium" className="space-y-4 mt-6">
            {mediumRiskDuplicates.length === 0 ? (
              <EmptyState
                icon={XCircle}
                title="No Medium Risk Duplicates"
                description="No medium-risk duplicate accounts detected."
              />
            ) : (
              mediumRiskDuplicates.map((match, idx) => renderDuplicateCard(match, idx))
            )}
          </TabsContent>

          <TabsContent value="low" className="space-y-4 mt-6">
            {lowRiskDuplicates.length === 0 ? (
              <EmptyState
                icon={XCircle}
                title="No Low Risk Duplicates"
                description="No low-risk duplicate accounts detected."
              />
            ) : (
              lowRiskDuplicates.map((match, idx) => renderDuplicateCard(match, idx))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4 mt-6">
            {duplicates.map((match, idx) => renderDuplicateCard(match, idx))}
          </TabsContent>
        </Tabs>
      )}

      {/* Info Alert */}
      <Alert className="bg-blue-900/20 border-blue-900">
        <AlertTriangle className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300">
          <strong>How it works:</strong> This system uses intelligent algorithms to detect duplicates based on PAN numbers, 
          email addresses, mobile numbers, and fuzzy name matching. High-risk duplicates (same PAN + similar name) are likely 
          the same person registering twice. Low-risk duplicates (same contact but different names) might be legitimate family members.
        </AlertDescription>
      </Alert>
    </div>
  );
}
