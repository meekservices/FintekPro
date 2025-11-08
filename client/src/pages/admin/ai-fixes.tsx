import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Bot, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap, 
  Code, 
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Rocket,
  FileCode
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIFixSuggestion {
  id: string;
  errorType: string;
  endpoint?: string;
  errorMessage: string;
  stackTrace?: string;
  severity: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  aiRootCause?: string;
  aiConfidence?: number;
  aiSummary?: string;
  suggestedFix?: string;
  suggestedCode?: string;
  fixCategory?: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  deployedBy?: string;
  deployedAt?: string;
  deploymentStatus?: string;
  deploymentNotes?: string;
  resolvedAt?: string;
  resolutionMethod?: string;
}

export default function AIFixSuggestions() {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [deploymentNotes, setDeploymentNotes] = useState("");
  const { toast } = useToast();

  // Query for AI fix suggestions
  const { data: suggestionsData, isLoading } = useQuery<{ suggestions: AIFixSuggestion[]; count: number }>({
    queryKey: ['/api/admin/ai-fixes'],
    refetchInterval: 30000, // Refresh every 30s
  });

  // Query for statistics
  const { data: stats } = useQuery<{
    total: number;
    pending: number;
    approved: number;
    deployed: number;
    resolved: number;
    averageConfidence: number;
  }>({
    queryKey: ['/api/admin/ai-fixes/stats'],
  });

  // Review mutation
  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes: string }) =>
      apiRequest('PATCH', `/api/admin/ai-fixes/${id}/review`, { body: { status, reviewNotes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes/stats'] });
      toast({
        title: "Success",
        description: "Fix suggestion reviewed successfully",
      });
      setReviewNotes("");
      setSelectedSuggestion(null);
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: ({ id, deploymentNotes }: { id: string; deploymentNotes: string }) =>
      apiRequest('POST', `/api/admin/ai-fixes/${id}/deploy`, { body: { deploymentNotes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes/stats'] });
      toast({
        title: "Success",
        description: "Fix deployed successfully",
      });
      setDeploymentNotes("");
      setSelectedSuggestion(null);
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: ({ id, resolutionMethod }: { id: string; resolutionMethod: string }) =>
      apiRequest('POST', `/api/admin/ai-fixes/${id}/resolve`, { body: { resolutionMethod } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ai-fixes/stats'] });
      toast({
        title: "Success",
        description: "Issue marked as resolved",
      });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-500';
      case 'approved': return 'text-green-500';
      case 'rejected': return 'text-red-500';
      case 'deployed': return 'text-blue-500';
      case 'resolved': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'deployed': return <Rocket className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const pendingSuggestions = suggestionsData?.suggestions.filter(s => s.status === 'pending') || [];
  const approvedSuggestions = suggestionsData?.suggestions.filter(s => s.status === 'approved') || [];
  const deployedSuggestions = suggestionsData?.suggestions.filter(s => s.status === 'deployed') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Fix Suggestions</h1>
          <p className="text-gray-400 mt-1">Auto-debug assistant with Gemini-powered error analysis</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-500">{stats?.approved || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Deployed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{stats?.deployed || 0}</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{stats?.averageConfidence || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different statuses */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList className="bg-gray-800 border border-gray-700 p-1">
          <TabsTrigger 
            value="pending" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-pending"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pending ({pendingSuggestions.length})
          </TabsTrigger>
          <TabsTrigger 
            value="approved" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-approved"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approved ({approvedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger 
            value="deployed" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-deployed"
          >
            <Rocket className="h-4 w-4 mr-2" />
            Deployed ({deployedSuggestions.length})
          </TabsTrigger>
          <TabsTrigger 
            value="all" 
            className="data-[state=active]:bg-gray-700"
            data-testid="tab-all"
          >
            All ({suggestionsData?.count || 0})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-700 animate-pulse rounded" />
              ))}
            </div>
          ) : pendingSuggestions.length > 0 ? (
            pendingSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(suggestion.severity)}>
                        {suggestion.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-900 border-gray-600">
                        {suggestion.errorType}
                      </Badge>
                      {suggestion.endpoint && (
                        <span className="text-sm text-gray-400 font-mono">{suggestion.endpoint}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-900/20 border-yellow-700">
                        {suggestion.occurrenceCount}x occurrences
                      </Badge>
                      {suggestion.aiConfidence && (
                        <Badge variant="outline" className={cn(
                          "border-gray-600",
                          suggestion.aiConfidence > 80 ? "bg-green-900/20 text-green-400" :
                          suggestion.aiConfidence > 60 ? "bg-yellow-900/20 text-yellow-400" :
                          "bg-red-900/20 text-red-400"
                        )}>
                          <Zap className="h-3 w-3 mr-1" />
                          {suggestion.aiConfidence}% confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Error Message */}
                  <div>
                    <p className="text-sm font-medium text-gray-400 mb-2">Error Message:</p>
                    <pre className="p-3 bg-gray-900 rounded text-sm text-red-400 overflow-x-auto">
                      {suggestion.errorMessage}
                    </pre>
                  </div>

                  {/* AI Analysis */}
                  {suggestion.aiRootCause && (
                    <div className="p-4 bg-blue-900/20 border border-blue-700 rounded">
                      <div className="flex items-start gap-2 mb-3">
                        <Bot className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-blue-300 mb-1">AI Root Cause Analysis</h3>
                          <p className="text-sm text-gray-300">{suggestion.aiRootCause}</p>
                        </div>
                      </div>
                      
                      {suggestion.aiSummary && (
                        <p className="text-sm text-gray-400 mb-3">
                          <span className="font-medium">Summary:</span> {suggestion.aiSummary}
                        </p>
                      )}

                      {suggestion.suggestedFix && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-blue-300 mb-2">Suggested Fix:</p>
                          <p className="text-sm text-gray-300">{suggestion.suggestedFix}</p>
                        </div>
                      )}

                      {suggestion.suggestedCode && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            Code Patch:
                          </p>
                          <pre className="p-3 bg-gray-950 rounded text-sm text-gray-300 overflow-x-auto">
                            {suggestion.suggestedCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review Actions */}
                  <div className="flex items-start gap-4 pt-4 border-t border-gray-700">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Add review notes..."
                        value={selectedSuggestion === suggestion.id ? reviewNotes : ""}
                        onChange={(e) => {
                          setSelectedSuggestion(suggestion.id);
                          setReviewNotes(e.target.value);
                        }}
                        className="bg-gray-900 border-gray-700 text-white"
                        rows={3}
                        data-testid={`textarea-review-notes-${suggestion.id}`}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => reviewMutation.mutate({
                          id: suggestion.id,
                          status: 'approved',
                          reviewNotes: selectedSuggestion === suggestion.id ? reviewNotes : ''
                        })}
                        disabled={reviewMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid={`button-approve-${suggestion.id}`}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reviewMutation.mutate({
                          id: suggestion.id,
                          status: 'rejected',
                          reviewNotes: selectedSuggestion === suggestion.id ? reviewNotes : ''
                        })}
                        disabled={reviewMutation.isPending}
                        data-testid={`button-reject-${suggestion.id}`}
                      >
                        <ThumbsDown className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No pending fix suggestions</p>
              <p className="text-sm">All issues have been reviewed</p>
            </div>
          )}
        </TabsContent>

        {/* Approved Tab */}
        <TabsContent value="approved" className="space-y-4">
          {approvedSuggestions.length > 0 ? (
            approvedSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(suggestion.severity)}>
                        {suggestion.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-green-900/20 border-green-700 text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        APPROVED
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-gray-400 mt-2">
                    {suggestion.errorMessage}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestion.reviewNotes && (
                    <div className="mb-4 p-3 bg-gray-900 rounded">
                      <p className="text-sm text-gray-400 mb-1">Review Notes:</p>
                      <p className="text-sm text-gray-300">{suggestion.reviewNotes}</p>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <Textarea
                        placeholder="Add deployment notes..."
                        value={selectedSuggestion === suggestion.id ? deploymentNotes : ""}
                        onChange={(e) => {
                          setSelectedSuggestion(suggestion.id);
                          setDeploymentNotes(e.target.value);
                        }}
                        className="bg-gray-900 border-gray-700 text-white"
                        rows={2}
                        data-testid={`textarea-deployment-notes-${suggestion.id}`}
                      />
                    </div>
                    <Button
                      onClick={() => deployMutation.mutate({
                        id: suggestion.id,
                        deploymentNotes: selectedSuggestion === suggestion.id ? deploymentNotes : ''
                      })}
                      disabled={deployMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid={`button-deploy-${suggestion.id}`}
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Deploy Fix
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No approved fixes</p>
            </div>
          )}
        </TabsContent>

        {/* Deployed Tab */}
        <TabsContent value="deployed" className="space-y-4">
          {deployedSuggestions.length > 0 ? (
            deployedSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(suggestion.severity)}>
                        {suggestion.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-900/20 border-blue-700 text-blue-400">
                        <Rocket className="h-3 w-3 mr-1" />
                        DEPLOYED
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate({
                        id: suggestion.id,
                        resolutionMethod: 'deployed_and_verified'
                      })}
                      className="bg-gray-900 border-gray-700"
                      data-testid={`button-resolve-${suggestion.id}`}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Resolved
                    </Button>
                  </div>
                  <CardDescription className="text-gray-400 mt-2">
                    {suggestion.errorMessage}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suggestion.deploymentNotes && (
                      <div className="p-3 bg-gray-900 rounded">
                        <p className="text-sm text-gray-400 mb-1">Deployment Notes:</p>
                        <p className="text-sm text-gray-300">{suggestion.deploymentNotes}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>Deployed: {new Date(suggestion.deployedAt!).toLocaleString()}</span>
                      {suggestion.deploymentStatus && (
                        <Badge variant="outline" className="bg-gray-900 border-gray-600">
                          {suggestion.deploymentStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Rocket className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No deployed fixes</p>
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-700 animate-pulse rounded" />
              ))}
            </div>
          ) : suggestionsData && suggestionsData.suggestions.length > 0 ? (
            suggestionsData.suggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={getSeverityColor(suggestion.severity)}>
                        {suggestion.severity.toUpperCase()}
                      </Badge>
                      <div className={cn("flex items-center gap-2", getStatusColor(suggestion.status))}>
                        {getStatusIcon(suggestion.status)}
                        <span className="text-sm font-medium">{suggestion.status.toUpperCase()}</span>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      Last seen: {new Date(suggestion.lastSeenAt).toLocaleString()}
                    </span>
                  </div>
                  <CardDescription className="text-gray-400 mt-2">
                    {suggestion.errorMessage}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>{suggestion.occurrenceCount} occurrences</span>
                    {suggestion.aiConfidence && (
                      <span>AI Confidence: {suggestion.aiConfidence}%</span>
                    )}
                    {suggestion.fixCategory && (
                      <Badge variant="outline" className="bg-gray-900 border-gray-600">
                        {suggestion.fixCategory}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No AI fix suggestions yet</p>
              <p className="text-sm">The system will automatically analyze errors and suggest fixes</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
