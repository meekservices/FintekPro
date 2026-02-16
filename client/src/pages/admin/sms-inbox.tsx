import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Smartphone,
  Phone,
  Mail,
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  Filter,
  Clock,
  User,
  MessageCircle,
  CheckCheck,
  StickyNote,
  Inbox,
  Bell,
  Reply,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format, formatDistanceToNow } from 'date-fns';

interface InboundMessage {
  id: string;
  messageSid: string;
  channel: 'sms' | 'whatsapp';
  direction: string;
  fromNumber: string;
  toNumber: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
  userId: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  parsedCommand: string | null;
  commandArgs: string[];
  autoReplyResponse: string | null;
  processed: boolean;
  adminNotes: string | null;
  isRead: boolean;
  readAt: string | null;
  readBy: string | null;
  receivedAt: string;
  createdAt: string;
}

interface MessagesResponse {
  messages: InboundMessage[];
  total: number;
}

interface CallLog {
  id: string;
  callSid: string;
  direction: string;
  status: string;
  callerNumber: string;
  calledNumber: string;
  callerCity: string | null;
  callerState: string | null;
  callerCountry: string | null;
  duration: number | null;
  userId: string | null;
  assignedAgentId: string | null;
  callbackRequested: boolean;
  callbackStatus: string | null;
  callbackScheduledAt: string | null;
  callbackCompletedAt: string | null;
  recordingUrl: string | null;
  adminNotes: string | null;
  isRead: boolean;
  readAt: string | null;
  readBy: string | null;
  greetingPlayed: string | null;
  callStartedAt: string;
  callEndedAt: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
}

interface CallsResponse {
  calls: CallLog[];
  total: number;
}

interface CombinedUnreadCount {
  unreadCount: number;
  messageCount: number;
  callCount: number;
}

export default function SmsInbox() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'sms' | 'whatsapp' | 'calls'>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboundMessage | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [page, setPage] = useState(0);
  const [callbackDialogOpen, setCallbackDialogOpen] = useState(false);
  const [callbackStatus, setCallbackStatus] = useState('');
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const pageSize = 20;

  const { data: combinedUnreadCount, refetch: refetchUnread } = useQuery<CombinedUnreadCount>({
    queryKey: ['/api/twilio/admin/inbox/unread-count'],
    refetchInterval: 30000,
  });

  const { data: messagesData, isLoading, refetch } = useQuery<MessagesResponse>({
    queryKey: ['/api/twilio/admin/messages', activeTab, filterUnread, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all' && activeTab !== 'calls') params.set('channel', activeTab);
      if (filterUnread) params.set('isRead', 'false');
      if (searchQuery) params.set('fromNumber', searchQuery);
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());
      
      const response = await fetch(`/api/twilio/admin/messages?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: activeTab !== 'calls',
  });

  const { data: callsData, isLoading: isLoadingCalls, refetch: refetchCalls } = useQuery<CallsResponse>({
    queryKey: ['/api/twilio/admin/calls', filterUnread, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterUnread) params.set('isRead', 'false');
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());
      
      const response = await fetch(`/api/twilio/admin/calls?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch calls');
      return response.json();
    },
    enabled: activeTab === 'calls',
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest(`/api/twilio/admin/messages/${messageId}/read`, {
        method: 'POST',
        body: JSON.stringify({ readBy: 'admin' }),
      });
    },
    onSuccess: () => {
      refetch();
      refetchUnread();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/twilio/admin/messages/mark-all-read', {
        method: 'POST',
        body: JSON.stringify({ readBy: 'admin' }),
      });
    },
    onSuccess: () => {
      toast({ title: 'All messages marked as read' });
      refetch();
      refetchUnread();
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ messageId, note }: { messageId: string; note: string }) => {
      return apiRequest(`/api/twilio/admin/messages/${messageId}/note`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Note added successfully' });
      setNoteDialogOpen(false);
      setAdminNote('');
      refetch();
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ messageId, message }: { messageId: string; message: string }) => {
      return apiRequest(`/api/twilio/admin/messages/${messageId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Reply sent successfully', 
        description: `Message sent via ${data.channel} to ${data.recipient}` 
      });
      setReplyDialogOpen(false);
      setReplyMessage('');
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send reply', 
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    },
  });

  const markCallReadMutation = useMutation({
    mutationFn: async (callId: string) => {
      return apiRequest(`/api/twilio/admin/calls/${callId}/read`, {
        method: 'POST',
        body: JSON.stringify({ readBy: 'admin' }),
      });
    },
    onSuccess: () => {
      refetchCalls();
      refetchUnread();
    },
  });

  const updateCallbackMutation = useMutation({
    mutationFn: async ({ callId, status, notes }: { callId: string; status: string; notes?: string }) => {
      return apiRequest(`/api/twilio/admin/calls/${callId}/callback`, {
        method: 'POST',
        body: JSON.stringify({ status, notes }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Callback status updated' });
      setCallbackDialogOpen(false);
      setCallbackStatus('');
      refetchCalls();
    },
  });

  const addCallNoteMutation = useMutation({
    mutationFn: async ({ callId, note }: { callId: string; note: string }) => {
      return apiRequest(`/api/twilio/admin/calls/${callId}/note`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Note added successfully' });
      setNoteDialogOpen(false);
      setAdminNote('');
      refetchCalls();
    },
  });

  const handleMessageClick = (message: InboundMessage) => {
    setSelectedMessage(message);
    setSelectedCall(null);
    if (!message.isRead) {
      markReadMutation.mutate(message.id);
    }
  };

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
    setSelectedMessage(null);
    if (!call.isRead) {
      markCallReadMutation.mutate(call.id);
    }
  };

  const getCallbackStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800">Pending</Badge>;
      case 'scheduled': return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">Scheduled</Badge>;
      case 'completed': return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">Completed</Badge>;
      case 'cancelled': return <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Cancelled</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-green-500" />;
      case 'sms': return <Smartphone className="h-4 w-4 text-blue-500" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getChannelBadge = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">WhatsApp</Badge>;
      case 'sms': return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">SMS</Badge>;
      default: return <Badge variant="outline">{channel}</Badge>;
    }
  };

  const totalPages = activeTab === 'calls' 
    ? Math.ceil((callsData?.total || 0) / pageSize)
    : Math.ceil((messagesData?.total || 0) / pageSize);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Inbox className="h-8 w-8 text-primary" />
            Communication Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage incoming SMS, WhatsApp messages, and voice calls
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(combinedUnreadCount?.unreadCount ?? 0) > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {combinedUnreadCount?.unreadCount} unread
            </Badge>
          )}
          <Button variant="outline" onClick={() => { refetch(); refetchCalls(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || (combinedUnreadCount?.messageCount ?? 0) === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{messagesData?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{combinedUnreadCount?.messageCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-500" /> SMS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messagesData?.messages.filter(m => m.channel === 'sms').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-500" /> WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {messagesData?.messages.filter(m => m.channel === 'whatsapp').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-purple-500" /> Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {callsData?.total || 0}
              {(combinedUnreadCount?.callCount || 0) > 0 && (
                <span className="text-sm text-orange-600 ml-2">({combinedUnreadCount?.callCount} new)</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Incoming Messages</CardTitle>
              <CardDescription>All SMS and WhatsApp replies received on your Twilio number</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by phone number..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button 
                variant={filterUnread ? "default" : "outline"} 
                size="sm"
                onClick={() => setFilterUnread(!filterUnread)}
              >
                {filterUnread ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {filterUnread ? 'Showing Unread' : 'Show Unread Only'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setPage(0); setSelectedMessage(null); setSelectedCall(null); }}>
            <TabsList className="grid w-full max-w-xl grid-cols-4">
              <TabsTrigger value="all">All Messages</TabsTrigger>
              <TabsTrigger value="sms">SMS Only</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp Only</TabsTrigger>
              <TabsTrigger value="calls" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Calls
                {(combinedUnreadCount?.callCount || 0) > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {combinedUnreadCount?.callCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {activeTab !== 'calls' && ( <>
              <TabsContent value={activeTab} className="mt-4">
              {isLoading ? (
                <LoadingState variant="list" count={5} />
              ) : !messagesData?.messages.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages found</p>
                  <p className="text-sm mt-2">When users reply to your SMS or WhatsApp messages, they will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ScrollArea className="h-[500px] border rounded-lg">
                    <div className="divide-y">
                      {messagesData.messages.map((message) => (
                        <div
                          key={message.id}
                          onClick={() => handleMessageClick(message)}
                          className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                            selectedMessage?.id === message.id ? 'bg-muted' : ''
                          } ${!message.isRead ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-1">
                              {getChannelIcon(message.channel)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{message.fromNumber}</span>
                                {!message.isRead && (
                                  <Badge variant="default" className="text-xs">New</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {message.body}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(message.receivedAt), { addSuffix: true })}
                                {message.parsedCommand && (
                                  <Badge variant="secondary" className="text-xs">
                                    {message.parsedCommand}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="border rounded-lg p-4">
                    {selectedMessage ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getChannelBadge(selectedMessage.channel)}
                            {selectedMessage.isRead ? (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Read
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs">Unread</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="default" size="sm">
                                  <Reply className="h-4 w-4 mr-2" />
                                  Reply
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reply to Message</DialogTitle>
                                  <DialogDescription>
                                    Send a reply to {selectedMessage.fromNumber} via {selectedMessage.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="p-3 bg-muted rounded-lg text-sm">
                                    <p className="text-muted-foreground mb-1">Original message:</p>
                                    <p className="line-clamp-3">{selectedMessage.body}</p>
                                  </div>
                                  <Textarea
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    placeholder="Type your reply..."
                                    rows={4}
                                  />
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setReplyDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={() => replyMutation.mutate({ 
                                      messageId: selectedMessage.id, 
                                      message: replyMessage 
                                    })}
                                    disabled={!replyMessage.trim() || replyMutation.isPending}
                                  >
                                    {replyMutation.isPending ? (
                                      <>Sending...</>
                                    ) : (
                                      <>
                                        <Send className="h-4 w-4 mr-2" />
                                        Send Reply
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <StickyNote className="h-4 w-4 mr-2" />
                                  Add Note
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Add Admin Note</DialogTitle>
                                  <DialogDescription>Add a note to this message for future reference.</DialogDescription>
                                </DialogHeader>
                                <Textarea
                                  value={adminNote}
                                  onChange={(e) => setAdminNote(e.target.value)}
                                  placeholder="Enter your note..."
                                  rows={4}
                                />
                                <DialogFooter>
                                  <Button 
                                    onClick={() => addNoteMutation.mutate({ 
                                      messageId: selectedMessage.id, 
                                      note: adminNote 
                                    })}
                                    disabled={!adminNote || addNoteMutation.isPending}
                                  >
                                    Save Note
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">From</label>
                            <p className="font-medium">{selectedMessage.fromNumber}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">To</label>
                            <p>{selectedMessage.toNumber}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Received</label>
                            <p>{format(new Date(selectedMessage.receivedAt), 'PPpp')}</p>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <label className="text-sm font-medium text-muted-foreground">Message</label>
                          <div className="mt-2 p-3 bg-muted rounded-lg">
                            <p className="whitespace-pre-wrap">{selectedMessage.body}</p>
                          </div>
                        </div>

                        {selectedMessage.parsedCommand && (
                          <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Detected Command</label>
                            <Badge variant="secondary" className="mt-1">{selectedMessage.parsedCommand}</Badge>
                          </div>
                        )}

                        {selectedMessage.autoReplyResponse && (
                          <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Auto-Reply Sent</label>
                            <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="whitespace-pre-wrap text-sm">{selectedMessage.autoReplyResponse}</p>
                            </div>
                          </div>
                        )}

                        {selectedMessage.adminNotes && (
                          <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Admin Notes</label>
                            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                              <p className="whitespace-pre-wrap text-sm">{selectedMessage.adminNotes}</p>
                            </div>
                          </div>
                        )}

                        {selectedMessage.userId && (
                          <div className="border-t pt-4">
                            <label className="text-sm font-medium text-muted-foreground">Associated User</label>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-4 w-4" />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {selectedMessage.userFirstName || selectedMessage.userLastName 
                                    ? `${selectedMessage.userFirstName || ''} ${selectedMessage.userLastName || ''}`.trim()
                                    : 'Unknown User'}
                                </span>
                                {selectedMessage.userEmail && (
                                  <span className="text-sm text-muted-foreground">{selectedMessage.userEmail}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a message to view details</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                  </Button>
                </div>
              )}
            </TabsContent>
            </> )}

            {activeTab === 'calls' && ( <>
              <TabsContent value="calls" className="mt-4">
                {isLoadingCalls ? (
                  <LoadingState variant="list" count={5} />
                ) : !callsData?.calls.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No calls found</p>
                    <p className="text-sm mt-2">When users call your Twilio number, they will appear here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ScrollArea className="h-[500px] border rounded-lg">
                      <div className="divide-y">
                        {callsData.calls.map((call) => (
                          <div
                            key={call.id}
                            onClick={() => handleCallClick(call)}
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                              selectedCall?.id === call.id ? 'bg-muted' : ''
                            } ${!call.isRead ? 'bg-purple-50 dark:bg-purple-950' : ''}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                <Phone className="h-4 w-4 text-purple-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {call.userFirstName || call.userLastName 
                                      ? `${call.userFirstName || ''} ${call.userLastName || ''}`.trim()
                                      : call.callerNumber}
                                  </span>
                                  {!call.isRead && (
                                    <Badge variant="default" className="text-xs">New</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {call.callerCity && call.callerState ? `${call.callerCity}, ${call.callerState}` : 'Unknown location'}
                                  {call.duration ? ` - ${formatDuration(call.duration)}` : ''}
                                </p>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(call.callStartedAt), { addSuffix: true })}
                                  {call.callbackRequested && getCallbackStatusBadge(call.callbackStatus)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="border rounded-lg p-4">
                      {selectedCall ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">Voice Call</Badge>
                              {selectedCall.isRead ? (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Read
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Dialog open={callbackDialogOpen} onOpenChange={setCallbackDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Phone className="h-4 w-4 mr-2" />
                                    Update Callback
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Update Callback Status</DialogTitle>
                                    <DialogDescription>Update the callback status for this call.</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="flex gap-2 flex-wrap">
                                      {['pending', 'scheduled', 'completed', 'cancelled'].map((status) => (
                                        <Button
                                          key={status}
                                          variant={callbackStatus === status ? 'default' : 'outline'}
                                          size="sm"
                                          onClick={() => setCallbackStatus(status)}
                                        >
                                          {status.charAt(0).toUpperCase() + status.slice(1)}
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      onClick={() => updateCallbackMutation.mutate({ 
                                        callId: selectedCall.id, 
                                        status: callbackStatus 
                                      })}
                                      disabled={!callbackStatus || updateCallbackMutation.isPending}
                                    >
                                      Update Status
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <StickyNote className="h-4 w-4 mr-2" />
                                    Add Note
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Add Admin Note</DialogTitle>
                                    <DialogDescription>Add a note to this call for future reference.</DialogDescription>
                                  </DialogHeader>
                                  <Textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="Enter your note..."
                                    rows={4}
                                  />
                                  <DialogFooter>
                                    <Button 
                                      onClick={() => addCallNoteMutation.mutate({ 
                                        callId: selectedCall.id, 
                                        note: adminNote 
                                      })}
                                      disabled={!adminNote || addCallNoteMutation.isPending}
                                    >
                                      Save Note
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Caller</label>
                              <p className="font-medium">{selectedCall.callerNumber}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Called Number</label>
                              <p>{selectedCall.calledNumber}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Call Time</label>
                                <p>{format(new Date(selectedCall.callStartedAt), 'PPpp')}</p>
                              </div>
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Duration</label>
                                <p>{formatDuration(selectedCall.duration)}</p>
                              </div>
                            </div>
                            {(selectedCall.callerCity || selectedCall.callerState || selectedCall.callerCountry) && (
                              <div>
                                <label className="text-sm font-medium text-muted-foreground">Location</label>
                                <p>
                                  {[selectedCall.callerCity, selectedCall.callerState, selectedCall.callerCountry]
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              </div>
                            )}
                          </div>

                          {selectedCall.callbackRequested && (
                            <div className="border-t pt-4">
                              <label className="text-sm font-medium text-muted-foreground">Callback Status</label>
                              <div className="mt-2 flex items-center gap-2">
                                {getCallbackStatusBadge(selectedCall.callbackStatus)}
                                {selectedCall.callbackScheduledAt && (
                                  <span className="text-sm text-muted-foreground">
                                    Scheduled for {format(new Date(selectedCall.callbackScheduledAt), 'PPp')}
                                  </span>
                                )}
                                {selectedCall.callbackCompletedAt && (
                                  <span className="text-sm text-muted-foreground">
                                    Completed at {format(new Date(selectedCall.callbackCompletedAt), 'PPp')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {selectedCall.greetingPlayed && (
                            <div className="border-t pt-4">
                              <label className="text-sm font-medium text-muted-foreground">Greeting Played</label>
                              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="whitespace-pre-wrap text-sm">{selectedCall.greetingPlayed}</p>
                              </div>
                            </div>
                          )}

                          {selectedCall.adminNotes && (
                            <div className="border-t pt-4">
                              <label className="text-sm font-medium text-muted-foreground">Admin Notes</label>
                              <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <p className="whitespace-pre-wrap text-sm">{selectedCall.adminNotes}</p>
                              </div>
                            </div>
                          )}

                          {selectedCall.userId && (
                            <div className="border-t pt-4">
                              <label className="text-sm font-medium text-muted-foreground">Associated User</label>
                              <div className="flex items-center gap-2 mt-1">
                                <User className="h-4 w-4" />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {selectedCall.userFirstName || selectedCall.userLastName 
                                      ? `${selectedCall.userFirstName || ''} ${selectedCall.userLastName || ''}`.trim()
                                      : 'Unknown User'}
                                  </span>
                                  {selectedCall.userEmail && (
                                    <span className="text-sm text-muted-foreground">{selectedCall.userEmail}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Select a call to view details</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </TabsContent>
            </> )}
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure these webhook URLs in your Twilio Console to receive incoming messages
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <label className="text-sm font-medium">SMS Webhook URL</label>
              <div className="mt-2 p-2 bg-muted rounded font-mono text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/twilio/sms/webhook` : '/api/twilio/sms/webhook'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set this URL in Twilio Console → Phone Numbers → +17623851291 → Messaging
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <label className="text-sm font-medium">WhatsApp Webhook URL</label>
              <div className="mt-2 p-2 bg-muted rounded font-mono text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/twilio/whatsapp/webhook` : '/api/twilio/whatsapp/webhook'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set this URL in Twilio Console → Messaging → WhatsApp Senders
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <label className="text-sm font-medium">Voice Webhook URL</label>
              <div className="mt-2 p-2 bg-muted rounded font-mono text-sm break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/twilio/voice/webhook` : '/api/twilio/voice/webhook'}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Set this URL in Twilio Console → Phone Numbers → +17623851291 → Voice
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
