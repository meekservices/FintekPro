import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, AlertTriangle, Mail, Phone, CreditCard, TrendingUp, CheckCircle, XCircle, Merge, Info, Shield as LucideShield } from "lucide-react";
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
        return 'bg-red-600 text-white border-red-500';
      case 'medium':
        return 'bg-orange-600 text-white border-orange-500';
      case 'low':
        return 'bg-yellow-600 text-white border-yellow-500';
      default:
        return 'bg-muted text-foreground';
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
    return (
      <div className="p-6">
        <LoadingState variant="card" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200 ml-2 text-base font-medium">
            Failed to load duplicate data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const renderDuplicateCard = (match: DuplicateMatch, index: number) => (
    <Card key={`${match.user1.id}-${match.user2.id}`} className="bg-card border-2 border-border shadow-lg">
      <CardHeader className="bg-muted/50 border-b border-border">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${getRiskBadgeColor(match.riskLevel)} text-sm px-3 py-1`}>
                {(match.riskLevel || 'medium').toUpperCase()} RISK
              </Badge>
              <span className="text-foreground text-sm font-medium" data-testid={`risk-score-${index}`}>
                Risk Score: <span className="font-bold">{match.riskScore}/100</span>
              </span>
              {match.autoMergeRecommended && (
                <Badge className="bg-purple-600 text-white text-sm px-3 py-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Auto-Merge Recommended
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {match.reasons.map((reason, idx) => (
                <span key={idx} className="text-xs bg-muted text-foreground px-3 py-1.5 rounded-full font-medium">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User 1 */}
          <div className="space-y-4 p-5 bg-blue-50 dark:bg-blue-950/30 rounded-xl border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg text-blue-900 dark:text-blue-100">Account 1</h4>
              <span className="text-sm text-muted-foreground bg-card px-2 py-1 rounded">
                {match.user1.createdAt 
                  ? format(new Date(match.user1.createdAt), 'MMM dd, yyyy')
                  : 'Unknown date'
                }
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium w-20">User ID:</span>
                <span className="text-foreground font-mono bg-card px-2 py-1 rounded" data-testid={`user1-id-${index}`}>
                  {match.user1.userId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium w-20">Name:</span>
                <span className="text-foreground font-semibold">{getFullName(match.user1)}</span>
              </div>
              {match.user1.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-foreground">{match.user1.email}</span>
                </div>
              )}
              {match.user1.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-foreground">{match.user1.mobile}</span>
                </div>
              )}
              {match.user1.panNumber && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-foreground font-mono">{match.user1.panNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* User 2 */}
          <div className="space-y-4 p-5 bg-orange-50 dark:bg-orange-950/30 rounded-xl border-2 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg text-orange-900 dark:text-orange-100">Account 2</h4>
              <span className="text-sm text-muted-foreground bg-card px-2 py-1 rounded">
                {match.user2.createdAt 
                  ? format(new Date(match.user2.createdAt), 'MMM dd, yyyy')
                  : 'Unknown date'
                }
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium w-20">User ID:</span>
                <span className="text-foreground font-mono bg-card px-2 py-1 rounded" data-testid={`user2-id-${index}`}>
                  {match.user2.userId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium w-20">Name:</span>
                <span className="text-foreground font-semibold">{getFullName(match.user2)}</span>
              </div>
              {match.user2.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-foreground">{match.user2.email}</span>
                </div>
              )}
              {match.user2.mobile && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-foreground">{match.user2.mobile}</span>
                </div>
              )}
              {match.user2.panNumber && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-foreground font-mono">{match.user2.panNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3 justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMerge(match.user1, match.user2)}
            disabled={mergeMutation.isPending}
            className="bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
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
            className="bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50"
            data-testid={`merge-button-keep-2-${index}`}
          >
            <Merge className="h-4 w-4 mr-1" />
            Keep Account 2
          </Button>
        </div>

        {match.nameSimilarity > 0 && (
          <div className="mt-4 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-lg inline-block">
            Name similarity: <span className="font-bold text-foreground">{match.nameSimilarity}%</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto" data-testid="page-duplicate-management">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-yellow-500/10 dark:from-red-500/20 dark:via-orange-500/20 dark:to-yellow-500/20 rounded-xl p-6 border border-red-200/50 dark:border-red-800/50">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <Users className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="heading-page-title">
              Duplicate Account Management
            </h1>
            <p className="text-muted-foreground mt-1 text-base">
              Intelligent duplicate detection with risk scoring and fuzzy name matching
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-muted to-background border-2 border-border shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Total Duplicates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground" data-testid="stat-total">
              {statsData?.totalDuplicates || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/40 dark:to-background border-2 border-red-200 dark:border-red-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 uppercase tracking-wide">
              <AlertTriangle className="h-4 w-4" />
              High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700 dark:text-red-300" data-testid="stat-high-risk">
              {statsData?.highRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/40 dark:to-background border-2 border-orange-200 dark:border-orange-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
              Medium Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300" data-testid="stat-medium-risk">
              {statsData?.mediumRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-950/40 dark:to-background border-2 border-yellow-200 dark:border-yellow-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 uppercase tracking-wide">
              Low Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300" data-testid="stat-low-risk">
              {statsData?.lowRisk || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/40 dark:to-background border-2 border-purple-200 dark:border-purple-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2 uppercase tracking-wide">
              <TrendingUp className="h-4 w-4" />
              Auto-Merge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300" data-testid="stat-auto-merge">
              {statsData?.autoMergeRecommended || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {duplicates.length === 0 ? (
        <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-background border-2 border-green-200 dark:border-green-800">
          <CardContent className="py-16">
            <EmptyState
              icon={Shield}
              title="No Duplicate Accounts Found"
              description="All user accounts are unique. The intelligent duplicate detection system found no matches."
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="high" className="w-full">
          <TabsList className="bg-card border-2 border-border p-1">
            <TabsTrigger 
              value="high" 
              className="data-[state=active]:bg-red-100 data-[state=active]:text-red-800 dark:data-[state=active]:bg-red-900/50 dark:data-[state=active]:text-red-200"
              data-testid="tab-high-risk"
            >
              High Risk ({highRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger 
              value="medium"
              className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-800 dark:data-[state=active]:bg-orange-900/50 dark:data-[state=active]:text-orange-200"
              data-testid="tab-medium-risk"
            >
              Medium Risk ({mediumRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger 
              value="low"
              className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800 dark:data-[state=active]:bg-yellow-900/50 dark:data-[state=active]:text-yellow-200"
              data-testid="tab-low-risk"
            >
              Low Risk ({lowRiskDuplicates.length})
            </TabsTrigger>
            <TabsTrigger 
              value="all"
              className="data-[state=active]:bg-muted data-[state=active]:text-foreground dark:data-[state=active]:bg-muted dark:data-[state=active]:text-foreground"
              data-testid="tab-all"
            >
              All ({duplicates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="high" className="space-y-4 mt-6">
            {highRiskDuplicates.length === 0 ? (
              <Card className="bg-card border-2 border-border">
                <CardContent className="py-12">
                  <EmptyState
                    icon={CheckCircle}
                    title="No High Risk Duplicates"
                    description="No high-risk duplicate accounts detected."
                  />
                </CardContent>
              </Card>
            ) : (
              highRiskDuplicates.map((match, idx) => renderDuplicateCard(match, idx))
            )}
          </TabsContent>

          <TabsContent value="medium" className="space-y-4 mt-6">
            {mediumRiskDuplicates.length === 0 ? (
              <Card className="bg-card border-2 border-border">
                <CardContent className="py-12">
                  <EmptyState
                    icon={CheckCircle}
                    title="No Medium Risk Duplicates"
                    description="No medium-risk duplicate accounts detected."
                  />
                </CardContent>
              </Card>
            ) : (
              mediumRiskDuplicates.map((match, idx) => renderDuplicateCard(match, idx))
            )}
          </TabsContent>

          <TabsContent value="low" className="space-y-4 mt-6">
            {lowRiskDuplicates.length === 0 ? (
              <Card className="bg-card border-2 border-border">
                <CardContent className="py-12">
                  <EmptyState
                    icon={CheckCircle}
                    title="No Low Risk Duplicates"
                    description="No low-risk duplicate accounts detected."
                  />
                </CardContent>
              </Card>
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
      <Alert className="bg-blue-50 dark:bg-blue-950/50 border-2 border-blue-200 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 ml-2 text-base">
          <span className="font-bold">How it works:</span> This system uses intelligent algorithms to detect duplicates based on PAN numbers, 
          email addresses, mobile numbers, and fuzzy name matching. High-risk duplicates (same PAN + similar name) are likely 
          the same person registering twice. Low-risk duplicates (same contact but different names) might be legitimate family members.
        </AlertDescription>
      </Alert>
    </div>
  );
}
