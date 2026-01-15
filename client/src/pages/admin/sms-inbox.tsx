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
  Bell
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

export default function SmsInbox() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'all' | 'sms' | 'whatsapp'>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<InboundMessage | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data: unreadCount, refetch: refetchUnread } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/twilio/admin/messages/unread-count'],
    refetchInterval: 30000,
  });

  const { data: messagesData, isLoading, refetch } = useQuery<MessagesResponse>({
    queryKey: ['/api/twilio/admin/messages', activeTab, filterUnread, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('channel', activeTab);
      if (filterUnread) params.set('isRead', 'false');
      if (searchQuery) params.set('fromNumber', searchQuery);
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());
      
      const response = await fetch(`/api/twilio/admin/messages?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
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

  const handleMessageClick = (message: InboundMessage) => {
    setSelectedMessage(message);
    if (!message.isRead) {
      markReadMutation.mutate(message.id);
    }
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
      case 'whatsapp': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">WhatsApp</Badge>;
      case 'sms': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">SMS</Badge>;
      default: return <Badge variant="outline">{channel}</Badge>;
    }
  };

  const totalPages = Math.ceil((messagesData?.total || 0) / pageSize);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Inbox className="h-8 w-8 text-primary" />
            Message Inbox
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage incoming SMS and WhatsApp messages
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(unreadCount?.unreadCount ?? 0) > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {unreadCount?.unreadCount} unread
            </Badge>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending || (unreadCount?.unreadCount ?? 0) === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{unreadCount?.unreadCount || 0}</div>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="all">All Messages</TabsTrigger>
              <TabsTrigger value="sms">SMS Only</TabsTrigger>
              <TabsTrigger value="whatsapp">WhatsApp Only</TabsTrigger>
            </TabsList>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
