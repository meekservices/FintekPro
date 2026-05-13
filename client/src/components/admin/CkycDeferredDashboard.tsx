import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Clock, UserCheck, XCircle, Shield as LucideShield, RefreshCw, Eye, Play, VideoIcon, Ban } from "lucide-react";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface AgingBuckets {
  lessThan24h: number;
  between24And72h: number;
  moreThan72h: number;
  total: number;
  breached: number;
}

interface DeferredCase {
  id: string;
  userId: string;
  panNumber: string;
  status: string;
  deferralCode: string;
  deferralMessage: string | null;
  lastProviderAttempted: string | null;
  slaStartedAt: string;
  slaDeadline: string;
  slaBreach: boolean;
  agingBucket: '<24h' | '24-72h' | '>72h';
  assignedToAdmin: string | null;
  createdAt: string;
}

interface DashboardStats {
  agingBuckets: AgingBuckets;
  environmentMode: string;
  blockedAttemptsCount: number;
  mockProviderAllowed: boolean;
}

export function CkycDeferredDashboard() {
  const [selectedCase, setSelectedCase] = useState<DeferredCase | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [actionReason, setActionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ckyc_deferred');

  const { data: statsData, isLoading: statsLoading } = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ['/api/admin/ckyc-deferred/dashboard-stats'],
  });

  const { data: casesData, isLoading: casesLoading, refetch: refetchCases } = useQuery<{ success: boolean; data: { cases: DeferredCase[]; total: number } }>({
    queryKey: ['/api/admin/ckyc-deferred/cases', statusFilter],
  });

  const checkSlaMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/ckyc-deferred/check-sla-breaches', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ckyc-deferred'] });
      refetchCases();
    },
  });

  const actionMutation = useMutation({
    mutationFn: (data: { caseId: string; action: string; reason: string }) =>
      apiRequest(`/api/admin/ckyc-deferred/cases/${data.caseId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action: data.action, reason: data.reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/ckyc-deferred'] });
      setSelectedCase(null);
      setActionType('');
      setActionReason('');
      refetchCases();
    },
  });

  const stats = statsData?.data;
  const cases = casesData?.data?.cases || [];

  const getAgingBadgeColor = (bucket: string) => {
    switch (bucket) {
      case '<24h': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case '24-72h': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case '>72h': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ckyc_deferred':
        return <Badge variant="destructive" data-testid="badge-status-deferred">Deferred</Badge>;
      case 'manual_review_in_progress':
        return <Badge variant="secondary" data-testid="badge-status-review">In Review</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-600" data-testid="badge-status-resolved">Resolved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" data-testid="badge-status-rejected">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleAction = () => {
    if (selectedCase && actionType && actionReason.length >= 10) {
      actionMutation.mutate({
        caseId: selectedCase.id,
        action: actionType,
        reason: actionReason,
      });
    }
  };

  return (
    <div className="space-y-6" data-testid="ckyc-deferred-dashboard">
      {/* Environment Status Alert */}
      {stats && (
        <Alert variant={stats.environmentMode === 'PROD' ? 'default' : 'destructive'} data-testid="alert-environment">
          <LucideShield className="h-4 w-4" />
          <AlertTitle>CKYC Environment: {stats.environmentMode}</AlertTitle>
          <AlertDescription>
            {stats.environmentMode === 'PROD' 
              ? 'Mock provider is DISABLED. All CKYC operations use real providers only.'
              : 'Mock provider is allowed in this environment. Not for production use.'}
            {stats.blockedAttemptsCount > 0 && (
              <span className="ml-2 text-red-600 font-semibold">
                {stats.blockedAttemptsCount} mock attempts blocked
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Aging Buckets Dashboard Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="aging-buckets-grid">
        <Card data-testid="card-less-than-24h">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              &lt; 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats?.agingBuckets.lessThan24h || 0}</div>
            <p className="text-xs text-muted-foreground">Fresh cases</p>
          </CardContent>
        </Card>

        <Card data-testid="card-24-72h">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              24-72 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats?.agingBuckets.between24And72h || 0}</div>
            <p className="text-xs text-muted-foreground">Approaching SLA</p>
          </CardContent>
        </Card>

        <Card data-testid="card-more-than-72h">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              &gt; 72 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats?.agingBuckets.moreThan72h || 0}</div>
            <p className="text-xs text-muted-foreground">SLA at risk</p>
          </CardContent>
        </Card>

        <Card data-testid="card-breached">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-800 dark:text-red-200" />
              SLA Breached
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-800 dark:text-red-200">{stats?.agingBuckets.breached || 0}</div>
            <p className="text-xs text-muted-foreground">Escalated cases</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ckyc_deferred">Deferred</SelectItem>
              <SelectItem value="manual_review_in_progress">In Review</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetchCases()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => checkSlaMutation.mutate()}
            disabled={checkSlaMutation.isPending}
            data-testid="button-check-sla"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Check SLA Breaches
          </Button>
        </div>
      </div>

      {/* Cases Table */}
      <Card data-testid="card-cases-table">
        <CardHeader>
          <CardTitle>Deferred CKYC Cases</CardTitle>
          <CardDescription>
            Total: {casesData?.data?.total || 0} cases
          </CardDescription>
        </CardHeader>
        <CardContent>
          {casesLoading ? (
            <div className="text-center py-8">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deferred cases found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PAN</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deferral Code</TableHead>
                  <TableHead>Last Provider</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead>SLA Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id} data-testid={`row-case-${c.id}`}>
                    <TableCell className="font-mono">{c.panNumber}</TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.deferralCode}</Badge>
                    </TableCell>
                    <TableCell>{c.lastProviderAttempted || '-'}</TableCell>
                    <TableCell>
                      <Badge className={getAgingBadgeColor(c.agingBucket)}>
                        {c.agingBucket}
                      </Badge>
                      {c.slaBreach && (
                        <Badge variant="destructive" className="ml-1">BREACHED</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(c.slaDeadline), 'MMM dd, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCase(c)}
                            data-testid={`button-action-${c.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Action
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg" data-testid="dialog-action">
                          <DialogHeader>
                            <DialogTitle>Take Action on Case</DialogTitle>
                            <DialogDescription>
                              PAN: {c.panNumber} | Code: {c.deferralCode}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4 py-4">
                            <div>
                              <label className="text-sm font-medium">Deferral Reason</label>
                              <p className="text-sm text-muted-foreground mt-1">
                                {c.deferralMessage || 'No message available'}
                              </p>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Select Action</label>
                              <Select value={actionType} onValueChange={setActionType}>
                                <SelectTrigger className="mt-1" data-testid="select-action-type">
                                  <SelectValue placeholder="Choose an action" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="manual_kyc_initiated">
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="h-4 w-4" />
                                      Initiate Manual CKYC
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="vkyc_scheduled">
                                    <div className="flex items-center gap-2">
                                      <VideoIcon className="h-4 w-4" />
                                      Schedule V-KYC
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="resolved">
                                    <div className="flex items-center gap-2">
                                      <Play className="h-4 w-4" />
                                      Mark Resolved
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="rejected">
                                    <div className="flex items-center gap-2">
                                      <Ban className="h-4 w-4" />
                                      Reject Onboarding
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="text-sm font-medium">Reason (Required)</label>
                              <Textarea
                                placeholder="Enter reason for this action (minimum 10 characters)"
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                                className="mt-1"
                                rows={3}
                                data-testid="textarea-action-reason"
                              />
                              {actionReason.length < 10 && actionReason.length > 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                  Reason must be at least 10 characters
                                </p>
                              )}
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              onClick={handleAction}
                              disabled={!actionType || actionReason.length < 10 || actionMutation.isPending}
                              data-testid="button-submit-action"
                            >
                              {actionMutation.isPending ? 'Processing...' : 'Apply Action'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CkycDeferredDashboard;
