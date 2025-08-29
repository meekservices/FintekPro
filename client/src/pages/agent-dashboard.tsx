import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Bell, 
  Users, 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Plus,
  Send,
  Eye,
  FileText,
  Filter,
  User,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CkycClient {
  id: string;
  userId: string;
  ckycNumber?: string;
  verificationStatus: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  mobileNumber: string;
  panNumber: string;
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

export default function AgentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<CkycClient | null>(null);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch CKYC clients for care agents
  const { data: ckycClients, isLoading: clientsLoading } = useQuery<CkycClient[]>({
    queryKey: ["/api/agent/ckyc-clients"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agent/ckyc-clients");
      return response.json();
    }
  });

  // Fetch agent's notification triggers
  const { data: notificationTriggers, isLoading: triggersLoading } = useQuery<NotificationTrigger[]>({
    queryKey: ["/api/agent/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agent/notifications");
      return response.json();
    }
  });

  // Create notification trigger mutation
  const createNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/agent/ckyc/notifications", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Notification sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/notifications"] });
      setNotificationDialog(false);
      setSelectedClient(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      verified: { variant: "default", icon: CheckCircle },
      rejected: { variant: "destructive", icon: XCircle },
      under_review: { variant: "secondary", icon: AlertCircle }
    };

    const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getNotificationStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      sent: { variant: "default", icon: CheckCircle },
      failed: { variant: "destructive", icon: XCircle }
    };

    const config = statusConfig[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const filteredClients = ckycClients?.filter(client => {
    const matchesStatus = statusFilter === "all" || client.verificationStatus === statusFilter;
    const matchesSearch = !searchTerm || 
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.emailAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.mobileNumber.includes(searchTerm) ||
      client.panNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesSearch;
  }) || [];

  const pendingNotifications = notificationTriggers?.filter(trigger => trigger.status === "pending").length || 0;
  const sentNotifications = notificationTriggers?.filter(trigger => trigger.status === "sent").length || 0;
  const failedNotifications = notificationTriggers?.filter(trigger => trigger.status === "failed").length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Care Agent Dashboard
          </h1>
          <p className="text-gray-600">Manage CKYC client communications and support</p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <User size={16} />
          Agent Portal
        </Badge>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ckycClients?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Active CKYC records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Notifications</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingNotifications}</div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentNotifications}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Notifications</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedNotifications}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <Users size={16} />
            CKYC Clients
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell size={16} />
            Notifications History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CKYC Client Management</CardTitle>
                  <CardDescription>Monitor and communicate with CKYC clients</CardDescription>
                </div>
                <Button 
                  onClick={() => setNotificationDialog(true)}
                  className="flex items-center gap-2"
                  disabled={!selectedClient}
                >
                  <Send size={16} />
                  Send Notification
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="search">Search Clients</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, email, mobile, or PAN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-40">
                  <Label htmlFor="status-filter">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
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

              {/* Client List */}
              {clientsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No CKYC clients found matching your criteria
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClients.map((client) => (
                    <div 
                      key={client.id} 
                      className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedClient?.id === client.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{client.firstName} {client.lastName}</h3>
                            {getStatusBadge(client.verificationStatus)}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Mail size={14} />
                                {client.emailAddress}
                              </span>
                              <span className="flex items-center gap-1">
                                <Phone size={14} />
                                {client.mobileNumber}
                              </span>
                            </div>
                            <div>PAN: {client.panNumber}</div>
                            {client.ckycNumber && <div>CKYC: {client.ckycNumber}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(client);
                              setNotificationDialog(true);
                            }}
                          >
                            <MessageSquare size={16} className="mr-1" />
                            Notify
                          </Button>
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
              <CardTitle>Notification History</CardTitle>
              <CardDescription>Track all sent notifications and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {triggersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : notificationTriggers?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No notifications sent yet</div>
              ) : (
                <div className="space-y-4">
                  {notificationTriggers?.map((trigger) => (
                    <div key={trigger.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{trigger.subject}</h4>
                            {getNotificationStatusBadge(trigger.status)}
                          </div>
                          <div className="text-sm text-gray-600">
                            <div>Type: {trigger.triggerType.replace("_", " ")}</div>
                            <div>Method: {trigger.notificationMethod}</div>
                            <div>Recipient: {trigger.recipientEmail || trigger.recipientMobile}</div>
                            <div>Created: {new Date(trigger.createdAt).toLocaleString()}</div>
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
      </Tabs>

      {/* Notification Dialog */}
      <NotificationDialog 
        open={notificationDialog}
        onOpenChange={setNotificationDialog}
        selectedClient={selectedClient}
        onSubmit={(data) => createNotificationMutation.mutate(data)}
        isLoading={createNotificationMutation.isPending}
      />
    </div>
  );
}

// Notification Dialog Component
interface NotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClient: CkycClient | null;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function NotificationDialog({ open, onOpenChange, selectedClient, onSubmit, isLoading }: NotificationDialogProps) {
  const [formData, setFormData] = useState({
    triggerType: "care_agent_followup",
    notificationMethod: "email",
    recipientEmail: "",
    recipientMobile: "",
    subject: "",
    message: "",
    triggerredBy: "care_agent"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    onSubmit({
      ...formData,
      ckycRecordId: selectedClient.id,
      recipientEmail: formData.notificationMethod === "email" || formData.notificationMethod === "both" 
        ? (formData.recipientEmail || selectedClient.emailAddress) : undefined,
      recipientMobile: formData.notificationMethod === "sms" || formData.notificationMethod === "both"
        ? (formData.recipientMobile || selectedClient.mobileNumber) : undefined
    });
  };

  // Reset form when client changes
  React.useEffect(() => {
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        recipientEmail: selectedClient.emailAddress,
        recipientMobile: selectedClient.mobileNumber
      }));
    }
  }, [selectedClient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Client Notification</DialogTitle>
          <DialogDescription>
            {selectedClient ? 
              `Send a notification to ${selectedClient.firstName} ${selectedClient.lastName}` :
              "Select a client to send notifications"
            }
          </DialogDescription>
        </DialogHeader>
        
        {selectedClient ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="triggerType">Notification Type</Label>
              <Select 
                value={formData.triggerType} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, triggerType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="care_agent_followup">Follow-up</SelectItem>
                  <SelectItem value="document_reminder">Document Reminder</SelectItem>
                  <SelectItem value="status_update">Status Update</SelectItem>
                  <SelectItem value="verification_required">Verification Required</SelectItem>
                  <SelectItem value="general_inquiry">General Inquiry</SelectItem>
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
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="sms">SMS Only</SelectItem>
                  <SelectItem value="both">Both Email & SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                placeholder="Your message to the client..."
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Notification"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4 text-gray-500">
            Please select a client from the list to send notifications
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}