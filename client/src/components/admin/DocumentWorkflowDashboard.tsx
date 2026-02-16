import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, Search, Filter, Clock, CheckCircle, XCircle, 
  AlertTriangle, Users, Eye, History, Send, RefreshCw,
  Download, Shield, FileSignature, Calendar
} from 'lucide-react';

interface WorkflowSummary {
  id: string;
  documentNumber: string;
  documentName: string;
  proposalType: string;
  status: string;
  currentVersion: number;
  negotiationRound: number;
  createdAt: string;
  deadline?: string;
  participantCount: number;
  signedCount: number;
  createdByRole: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actionCategory: string;
  description: string;
  actorName?: string;
  actorRole?: string;
  timestamp: string;
  ipAddress?: string;
  deviceType?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  pending_edit: { label: 'Pending Edit', variant: 'outline', icon: Clock },
  pending_approval: { label: 'Pending Approval', variant: 'outline', icon: Clock },
  pending_signature: { label: 'Awaiting Signature', variant: 'default', icon: FileSignature },
  partially_signed: { label: 'Partially Signed', variant: 'default', icon: Users },
  completed: { label: 'Completed', variant: 'default', icon: CheckCircle },
  declined: { label: 'Declined', variant: 'destructive', icon: XCircle },
  expired: { label: 'Expired', variant: 'destructive', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', variant: 'secondary', icon: XCircle },
};

export default function DocumentWorkflowDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const { data: userWorkflows, isLoading, refetch } = useQuery({
    queryKey: ['/api/proposal-esign/user/workflows'],
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['/api/proposal-esign/user/pending-approvals'],
  });

  const { data: workflowDetails } = useQuery({
    queryKey: ['/api/proposal-esign/workflows', selectedWorkflow],
    enabled: !!selectedWorkflow,
  });

  const { data: auditLog } = useQuery<{ success: boolean; auditLog: AuditLogEntry[] }>({
    queryKey: ['/api/proposal-esign/workflows', selectedWorkflow, 'audit'],
    enabled: !!selectedWorkflow,
  });

  const workflows = userWorkflows as any;
  const allWorkflows = [
    ...(workflows?.created || []),
    ...(workflows?.participating || []),
  ];

  const filteredWorkflows = allWorkflows.filter((w: WorkflowSummary) => {
    const matchesSearch = 
      w.documentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: allWorkflows.length,
    pending: allWorkflows.filter((w: any) => ['pending_edit', 'pending_approval', 'pending_signature'].includes(w.status)).length,
    completed: allWorkflows.filter((w: any) => w.status === 'completed').length,
    declined: allWorkflows.filter((w: any) => w.status === 'declined').length,
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const, icon: Clock };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6" />
            Document Workflow Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage document approvals, signatures, and audit trails
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Declined</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Document Workflows</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_edit">Pending Edit</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="pending_signature">Awaiting Signature</SelectItem>
                  <SelectItem value="partially_signed">Partially Signed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="created">Created by Me</TabsTrigger>
              <TabsTrigger value="participating">Assigned to Me</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredWorkflows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Participants</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWorkflows.map((workflow: any) => (
                      <TableRow key={workflow.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{workflow.documentName}</div>
                            <div className="text-xs text-muted-foreground">{workflow.documentNumber}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{workflow.proposalType || 'Investment'}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(workflow.status)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            v{workflow.currentVersion} (Round {workflow.negotiationRound})
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{workflow.signedCount || 0}/{workflow.participantCount || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(workflow.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedWorkflow(workflow.id)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh]">
                                <DialogHeader>
                                  <DialogTitle>Document Details</DialogTitle>
                                  <DialogDescription>
                                    {workflow.documentNumber} - {workflow.documentName}
                                  </DialogDescription>
                                </DialogHeader>
                                <Tabs defaultValue="details">
                                  <TabsList>
                                    <TabsTrigger value="details">Details</TabsTrigger>
                                    <TabsTrigger value="participants">Participants</TabsTrigger>
                                    <TabsTrigger value="audit">Audit Log</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="details">
                                    <div className="grid grid-cols-2 gap-4 py-4">
                                      <div>
                                        <label className="text-sm text-muted-foreground">Status</label>
                                        <div className="mt-1">{getStatusBadge(workflowDetails?.workflow?.status || workflow.status)}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm text-muted-foreground">Current Version</label>
                                        <div className="mt-1 font-medium">Version {workflowDetails?.workflow?.currentVersion || workflow.currentVersion}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm text-muted-foreground">Negotiation Round</label>
                                        <div className="mt-1 font-medium">Round {workflowDetails?.workflow?.negotiationRound || workflow.negotiationRound}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm text-muted-foreground">Deadline</label>
                                        <div className="mt-1 font-medium">{workflowDetails?.workflow?.deadline ? formatDate(workflowDetails.workflow.deadline) : 'No deadline'}</div>
                                      </div>
                                      <div>
                                        <label className="text-sm text-muted-foreground">Retention Until</label>
                                        <div className="mt-1 font-medium flex items-center gap-1">
                                          <Shield className="h-4 w-4 text-green-600" />
                                          {workflowDetails?.workflow?.retentionExpiresAt ? formatDate(workflowDetails.workflow.retentionExpiresAt) : '8 Years'}
                                        </div>
                                      </div>
                                    </div>
                                  </TabsContent>
                                  <TabsContent value="participants">
                                    <ScrollArea className="h-[300px]">
                                      <div className="space-y-3 py-4">
                                        {(workflowDetails?.workflow?.participants || []).map((p: any) => (
                                          <div key={p.id} className="flex items-center justify-between p-3 border rounded-lg">
                                            <div>
                                              <div className="font-medium">{p.externalName || 'User'}</div>
                                              <div className="text-sm text-muted-foreground">{p.externalEmail || p.role}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Badge variant="outline">{p.role}</Badge>
                                              {p.hasSigned && (
                                                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                                                  <CheckCircle className="h-3 w-3 mr-1" />
                                                  Signed
                                                </Badge>
                                              )}
                                              {p.hasDeclined && (
                                                <Badge variant="destructive">
                                                  <XCircle className="h-3 w-3 mr-1" />
                                                  Declined
                                                </Badge>
                                              )}
                                              {!p.hasSigned && !p.hasDeclined && p.canSign && (
                                                <Badge variant="secondary">
                                                  <Clock className="h-3 w-3 mr-1" />
                                                  Pending
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </TabsContent>
                                  <TabsContent value="audit">
                                    <ScrollArea className="h-[300px]">
                                      <div className="space-y-2 py-4">
                                        {(auditLog?.auditLog || []).map((log) => (
                                          <div key={log.id} className="flex gap-3 p-2 text-sm border-b">
                                            <div className="flex-shrink-0 w-32 text-muted-foreground">
                                              {new Date(log.timestamp).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </div>
                                            <div className="flex-1">
                                              <span className="font-medium">{log.actorName || 'System'}</span>
                                              <span className="text-muted-foreground"> - </span>
                                              <span>{log.description}</span>
                                            </div>
                                            <div className="flex-shrink-0">
                                              <Badge variant="outline" className="text-xs">{log.actionCategory}</Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </TabsContent>
                                </Tabs>
                              </DialogContent>
                            </Dialog>
                            <Button size="sm" variant="outline">
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(pendingApprovals as any)?.pending?.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5" />
              Pending Your Action
            </CardTitle>
            <CardDescription>
              Documents waiting for your review or signature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(pendingApprovals as any)?.pending?.map((item: any) => (
                <div key={item.participant.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div>
                    <div className="font-medium">{item.workflow.documentName}</div>
                    <div className="text-sm text-muted-foreground">
                      {item.participant.role === 'signer' ? 'Signature required' : 'Approval required'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.participant.actionRequiredBy && (
                      <span className="text-xs text-orange-600 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Due: {formatDate(item.participant.actionRequiredBy)}
                      </span>
                    )}
                    <Button size="sm">
                      Take Action
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
