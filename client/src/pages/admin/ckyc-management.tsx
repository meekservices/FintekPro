import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Users,
  FileText,
  Settings,
  Play,
  Pause,
  Trash2,
  Eye,
  Send
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CkycRecord {
  id: string;
  userId: string;
  ckycNumber?: string;
  verificationStatus: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  address: string;
  panNumber: string;
  aadharNumber: string;
  mobileNumber: string;
  emailAddress: string;
  documentType: string;
  documentNumber: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationTrigger {
  id: string;
  ckycRecordId: string;
  triggerType: string;
  notificationMethod: string;
  recipientEmail?: string;
  recipientMobile?: string;
  subject: string;
  message: string;
  status: string;
  scheduledAt?: string;
  sentAt?: string;
  failureReason?: string;
  triggerredBy: string;
  metadata?: any;
  createdAt: string;
}

interface ProgressStep {
  id: string;
  ckycRecordId: string;
  stepName: string;
  stepStatus: string;
  stepDescription?: string;
  completedAt?: string;
  completedBy?: string;
  estimatedCompletionTime?: number;
  actualCompletionTime?: number;
  stepOrder: number;
  isActive: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface ActionLog {
  id: string;
  ckycRecordId: string;
  actionType: string;
  actionBy: string;
  actionByType: string;
  actionDetails: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  actionAt: string;
}

export default function CkycManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRecord, setSelectedRecord] = useState<CkycRecord | null>(null);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [progressDialog, setProgressDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch CKYC records
  const { data: ckycRecords, isLoading: recordsLoading } = useQuery<CkycRecord[]>({
    queryKey: ["/api/admin/ckyc"],
  });

  // Fetch notification triggers
  const { data: notificationTriggers } = useQuery<NotificationTrigger[]>({
    queryKey: ["/api/admin/ckyc/notifications"],
  });

  // Fetch action logs
  const { data: actionLogs } = useQuery<ActionLog[]>({
    queryKey: ["/api/admin/ckyc/action-logs"],
  });

  // Create notification trigger mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/ckyc/notifications", { 
        method: "POST", 
        body: JSON.stringify(data) 
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification trigger created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ckyc/notifications"] });
      setNotificationDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Create progress step mutation
  const createProgressStepMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/admin/ckyc/progress-steps", { 
        method: "POST", 
        body: JSON.stringify(data) 
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Progress step created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ckyc"] });
      setProgressDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Update CKYC status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      return await apiRequest(`/api/admin/ckyc/${userId}/status`, { 
        method: "PATCH",
        body: JSON.stringify({ verificationStatus: status })
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "CKYC status updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ckyc"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  // Process pending notifications mutation
  const processNotificationsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/admin/ckyc/process-notifications", { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Pending notifications processed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ckyc/notifications"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string | undefined) => {
    const safeStatus = status || 'pending';
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      verified: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      under_review: { variant: "secondary", icon: AlertCircle }
    };

    const config = statusConfig[safeStatus] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {safeStatus.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getNotificationStatusBadge = (status: string | undefined) => {
    const safeStatus = status || 'pending';
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      sent: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle }
    };

    const config = statusConfig[safeStatus] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {safeStatus.toUpperCase()}
      </Badge>
    );
  };

  const filteredRecords = ckycRecords?.filter(record => 
    statusFilter === "all" || record.verificationStatus === statusFilter
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CKYC Management</h1>
          <p className="text-muted-foreground">Manage CKYC records, monitor progress, and trigger notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => processNotificationsMutation.mutate()}
            disabled={processNotificationsMutation.isPending}
            className="flex items-center gap-2"
          >
            <Send size={16} />
            {processNotificationsMutation.isPending ? "Processing..." : "Process Notifications"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <ScrollableTabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="records" className="flex items-center gap-2 flex-shrink-0">
              <Users size={16} />
              Records
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 flex-shrink-0">
              <Bell size={16} />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2 flex-shrink-0">
              <FileText size={16} />
              Progress Tracking
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2 flex-shrink-0">
              <Settings size={16} />
              Action Logs
            </TabsTrigger>
          </ScrollableTabsList>
        </div>

        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CKYC Records</CardTitle>
                  <CardDescription>Manage and monitor CKYC verification records</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="status-filter">Filter by status:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recordsLoading ? (
                <div className="text-center py-8">Loading CKYC records...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No CKYC records found</div>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4 hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{record.firstName} {record.lastName}</h3>
                            {getStatusBadge(record.verificationStatus)}
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>Email: {record.emailAddress}</div>
                            <div>Mobile: {record.mobileNumber}</div>
                            <div>PAN: {record.panNumber}</div>
                            {record.ckycNumber && <div>CKYC: {record.ckycNumber}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(record)}>
                                <Eye size={16} className="mr-1" />
                                View Details
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>CKYC Record Details</DialogTitle>
                                <DialogDescription>
                                  Complete information for {record.firstName} {record.lastName}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid grid-cols-2 gap-4 py-4">
                                <div>
                                  <Label>Full Name</Label>
                                  <div className="text-sm">{record.firstName} {record.lastName}</div>
                                </div>
                                <div>
                                  <Label>Status</Label>
                                  <div>{getStatusBadge(record.verificationStatus)}</div>
                                </div>
                                <div>
                                  <Label>Email</Label>
                                  <div className="text-sm">{record.emailAddress}</div>
                                </div>
                                <div>
                                  <Label>Mobile</Label>
                                  <div className="text-sm">{record.mobileNumber}</div>
                                </div>
                                <div>
                                  <Label>Date of Birth</Label>
                                  <div className="text-sm">{new Date(record.dateOfBirth).toLocaleDateString()}</div>
                                </div>
                                <div>
                                  <Label>PAN Number</Label>
                                  <div className="text-sm">{record.panNumber}</div>
                                </div>
                                <div>
                                  <Label>Aadhar Number</Label>
                                  <div className="text-sm">{record.aadharNumber}</div>
                                </div>
                                {record.ckycNumber && (
                                  <div>
                                    <Label>CKYC Number</Label>
                                    <div className="text-sm">{record.ckycNumber}</div>
                                  </div>
                                )}
                                <div className="col-span-2">
                                  <Label>Address</Label>
                                  <div className="text-sm">{record.address}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 pt-4">
                                <Select 
                                  defaultValue={record.verificationStatus}
                                  onValueChange={(status) => 
                                    updateStatusMutation.mutate({ userId: record.userId, status })
                                  }
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="under_review">Under Review</SelectItem>
                                    <SelectItem value="verified">Verified</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button 
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setNotificationDialog(true);
                                  }}
                                  variant="outline"
                                  className="flex items-center gap-2"
                                >
                                  <Bell size={16} />
                                  Send Notification
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Notification Triggers</CardTitle>
                  <CardDescription>Monitor and manage notification triggers</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {notificationTriggers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No notification triggers found</div>
              ) : (
                <div className="space-y-4">
                  {notificationTriggers?.map((trigger) => (
                    <div key={trigger.id} className="border rounded-lg p-4 hover:bg-muted">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{trigger.subject}</h4>
                            {getNotificationStatusBadge(trigger.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>Type: {trigger.triggerType.replace("_", " ")}</div>
                            <div>Method: {trigger.notificationMethod}</div>
                            <div>Recipient: {trigger.recipientEmail || trigger.recipientMobile}</div>
                            {trigger.scheduledAt && (
                              <div>Scheduled: {new Date(trigger.scheduledAt).toLocaleString()}</div>
                            )}
                            {trigger.sentAt && (
                              <div>Sent: {new Date(trigger.sentAt).toLocaleString()}</div>
                            )}
                            {trigger.failureReason && (
                              <div className="text-red-600">Failure: {trigger.failureReason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Progress Tracking</CardTitle>
                  <CardDescription>Monitor CKYC verification progress steps</CardDescription>
                </div>
                <Button 
                  onClick={() => setProgressDialog(true)}
                  className="flex items-center gap-2"
                >
                  <FileText size={16} />
                  Add Progress Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Select a CKYC record to view progress steps
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Action Logs</CardTitle>
              <CardDescription>Track all CKYC-related administrative actions</CardDescription>
            </CardHeader>
            <CardContent>
              {actionLogs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No action logs found</div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {actionLogs?.map((log) => (
                    <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium">{log.actionDetails}</div>
                          <div className="text-sm text-muted-foreground">
                            <div>Action: {log.actionType.replace("_", " ")}</div>
                            <div>By: {log.actionBy} ({log.actionByType})</div>
                            <div>Time: {new Date(log.actionAt).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Notification Creation Dialog */}
      <NotificationDialog 
        open={notificationDialog}
        onOpenChange={setNotificationDialog}
        selectedRecord={selectedRecord}
        onSubmit={(data) => createNotificationMutation.mutate(data)}
        isLoading={createNotificationMutation.isPending}
      />

      {/* Progress Step Creation Dialog */}
      <ProgressStepDialog
        open={progressDialog}
        onOpenChange={setProgressDialog}
        selectedRecord={selectedRecord}
        onSubmit={(data) => createProgressStepMutation.mutate(data)}
        isLoading={createProgressStepMutation.isPending}
      />
    </div>
  );
}

// Notification Dialog Component
interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecord: CkycRecord | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function NotificationDialog({ open, onOpenChange, selectedRecord, onSubmit, isLoading }: NotificationDialogProps) {
  const [formData, setFormData] = useState({
    triggerType: "manual_trigger",
    notificationMethod: "email",
    recipientEmail: "",
    recipientMobile: "",
    subject: "",
    message: "",
    scheduledAt: "",
    triggerredBy: "admin"
  });

  useEffect(() => {
    if (selectedRecord) {
      setFormData(prev => ({
        ...prev,
        recipientEmail: selectedRecord.emailAddress,
        recipientMobile: selectedRecord.mobileNumber
      }));
    }
  }, [selectedRecord]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    onSubmit({
      ...formData,
      ckycRecordId: selectedRecord.id,
      scheduledAt: formData.scheduledAt || undefined
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogDescription>
            Create a notification trigger for {selectedRecord?.firstName} {selectedRecord?.lastName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="triggerType">Trigger Type</Label>
            <Select 
              value={formData.triggerType} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_trigger">Manual Trigger</SelectItem>
                <SelectItem value="status_change">Status Change</SelectItem>
                <SelectItem value="document_required">Document Required</SelectItem>
                <SelectItem value="verification_pending">Verification Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notificationMethod">Notification Method</Label>
            <Select 
              value={formData.notificationMethod} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, notificationMethod: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.notificationMethod === "email" || formData.notificationMethod === "both") && (
            <div>
              <Label htmlFor="recipientEmail">Recipient Email</Label>
              <Input 
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                required
              />
            </div>
          )}

          {(formData.notificationMethod === "sms" || formData.notificationMethod === "both") && (
            <div>
              <Label htmlFor="recipientMobile">Recipient Mobile</Label>
              <Input 
                type="tel"
                value={formData.recipientMobile}
                onChange={(e) => setFormData(prev => ({ ...prev, recipientMobile: e.target.value }))}
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input 
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              required
              placeholder="Notification subject"
            />
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea 
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              required
              placeholder="Notification message content"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="scheduledAt">Schedule Time (Optional)</Label>
            <Input 
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData(prev => ({ ...prev, scheduledAt: e.target.value }))}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Trigger"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Progress Step Dialog Component
interface ProgressStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRecord: CkycRecord | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function ProgressStepDialog({ open, onOpenChange, selectedRecord, onSubmit, isLoading }: ProgressStepDialogProps) {
  const [formData, setFormData] = useState({
    stepName: "",
    stepDescription: "",
    stepOrder: 1,
    estimatedCompletionTime: 24,
    completedBy: "admin"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    onSubmit({
      ...formData,
      ckycRecordId: selectedRecord.id
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Progress Step</DialogTitle>
          <DialogDescription>
            Create a new progress tracking step for CKYC verification
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="stepName">Step Name</Label>
            <Select 
              value={formData.stepName} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, stepName: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a step" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="application_received">Application Received</SelectItem>
                <SelectItem value="documents_uploaded">Documents Uploaded</SelectItem>
                <SelectItem value="verification_in_progress">Verification In Progress</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="stepDescription">Step Description</Label>
            <Textarea 
              value={formData.stepDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, stepDescription: e.target.value }))}
              placeholder="Detailed description of this step"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="stepOrder">Step Order</Label>
            <Input 
              type="number"
              value={formData.stepOrder}
              onChange={(e) => setFormData(prev => ({ ...prev, stepOrder: parseInt(e.target.value) }))}
              min={1}
              required
            />
          </div>

          <div>
            <Label htmlFor="estimatedCompletionTime">Estimated Completion Time (hours)</Label>
            <Input 
              type="number"
              value={formData.estimatedCompletionTime}
              onChange={(e) => setFormData(prev => ({ ...prev, estimatedCompletionTime: parseInt(e.target.value) }))}
              min={1}
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Step"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}