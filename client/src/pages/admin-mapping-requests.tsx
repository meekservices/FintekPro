import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, Users, ArrowLeft, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

interface MappingRequest {
  id: string;
  agentId: string;
  agentName: string | null;
  clientId: string | null;
  clientPan: string | null;
  clientEmail: string | null;
  clientMobile: string | null;
  clientName: string | null;
  currentAgentId: string | null;
  currentAgentName: string | null;
  status: string;
  requestReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export default function AdminMappingRequestsPage() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<MappingRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: requestsData, isLoading, refetch } = useQuery<{ success: boolean; requests: MappingRequest[] }>({
    queryKey: ["/api/agent-wizard/admin/mapping-requests"],
  });

  const requests = requestsData?.requests || [];

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest(`/api/agent-wizard/admin/mapping-requests/${requestId}/approve`, {
        method: "POST"
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Approved", description: "The agent has been mapped to the client." });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/admin/mapping-requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve request", variant: "destructive" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const res = await apiRequest(`/api/agent-wizard/admin/mapping-requests/${requestId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: reason })
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request Rejected", description: "The mapping request has been rejected." });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ["/api/agent-wizard/admin/mapping-requests"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject request", variant: "destructive" });
    }
  });

  const handleReject = (request: MappingRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({ requestId: selectedRequest.id, reason: rejectionReason });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Agent-Client Mapping Requests
            </h1>
            <p className="text-muted-foreground">Review and approve agent requests to be mapped to existing clients</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>
            {requests.length === 0 
              ? "No pending mapping requests" 
              : `${requests.length} request(s) awaiting approval`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending mapping requests at this time.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requesting Agent</TableHead>
                  <TableHead>Client Details</TableHead>
                  <TableHead>Current Assignment</TableHead>
                  <TableHead>Requested On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">{request.agentName || 'Unknown Agent'}</div>
                      <div className="text-sm text-muted-foreground">ID: {request.agentId.slice(0, 8)}...</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {request.clientName && <div className="font-medium">{request.clientName}</div>}
                        {request.clientPan && <div className="text-sm">PAN: {request.clientPan}</div>}
                        {request.clientEmail && <div className="text-sm text-muted-foreground">{request.clientEmail}</div>}
                        {request.clientMobile && <div className="text-sm text-muted-foreground">{request.clientMobile}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.currentAgentName ? (
                        <div>
                          <div className="font-medium">{request.currentAgentName}</div>
                          <div className="text-sm text-muted-foreground">Currently assigned</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(request.createdAt), 'dd MMM yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(request.createdAt), 'HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        request.status === 'pending' ? 'outline' :
                        request.status === 'approved' ? 'default' : 'destructive'
                      }>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(request.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`approve-request-${request.id}`}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request)}
                            disabled={rejectMutation.isPending}
                            data-testid={`reject-request-${request.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Mapping Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this request. The agent will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                data-testid="rejection-reason-input"
              />
            </div>
            {selectedRequest && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <p><strong>Agent:</strong> {selectedRequest.agentName}</p>
                <p><strong>Client:</strong> {selectedRequest.clientName || selectedRequest.clientPan || 'Unknown'}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
              data-testid="confirm-reject-btn"
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
