import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Send, Users, Mail, MessageSquare, Calendar, Check, Clock, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface FestivalTemplate {
  id: string;
  name: string;
  emoji: string;
  category: 'major' | 'regional';
}

const festivals: FestivalTemplate[] = [
  { id: 'diwali', name: 'Diwali', emoji: '🪔', category: 'major' },
  { id: 'holi', name: 'Holi', emoji: '🎨', category: 'major' },
  { id: 'eid', name: 'Eid', emoji: '🌙', category: 'major' },
  { id: 'christmas', name: 'Christmas', emoji: '🎄', category: 'major' },
  { id: 'ganesh-chaturthi', name: 'Ganesh Chaturthi', emoji: '🐘', category: 'major' },
  { id: 'durga-puja', name: 'Durga Puja', emoji: '🪷', category: 'major' },
  { id: 'onam', name: 'Onam', emoji: '🌸', category: 'major' },
  { id: 'pongal', name: 'Pongal', emoji: '🌾', category: 'major' },
  { id: 'new-year', name: 'New Year', emoji: '🎆', category: 'major' },
  { id: 'ugadi', name: 'Ugadi', emoji: '🌿', category: 'regional' },
  { id: 'vishu', name: 'Vishu', emoji: '🌻', category: 'regional' },
  { id: 'bihu', name: 'Bihu', emoji: '🎋', category: 'regional' },
  { id: 'baisakhi', name: 'Baisakhi', emoji: '🌾', category: 'regional' },
  { id: 'lohri', name: 'Lohri', emoji: '🔥', category: 'regional' },
  { id: 'makar-sankranti', name: 'Makar Sankranti', emoji: '🪁', category: 'regional' },
  { id: 'raksha-bandhan', name: 'Raksha Bandhan', emoji: '🎀', category: 'regional' },
  { id: 'navratri', name: 'Navratri', emoji: '🙏', category: 'regional' },
];

interface Campaign {
  id: string;
  festivalId: string;
  festivalName: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  channel: 'email' | 'whatsapp' | 'both';
  recipientCount: number;
  sentCount: number;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
}

export default function FestivalMarketing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFestival, setSelectedFestival] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

  // Fetch all clients count
  const { data: clientStats } = useQuery({
    queryKey: ['/api/admin/users/stats'],
  });

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['/api/admin/agents'],
  });

  // Fetch campaigns history
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/admin/festival-marketing/campaigns'],
  });

  // Send bulk greetings mutation
  const sendGreetingsMutation = useMutation({
    mutationFn: async (data: { festivalId: string; channel: string; agentIds: string[] }) => {
      return apiRequest('/api/admin/festival-marketing/send-bulk', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/festival-marketing/campaigns'] });
      toast({
        title: 'Greetings Sent!',
        description: `Festival greetings are being sent to ${data.recipientCount || 'all'} clients.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send greetings. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendGreetings = () => {
    if (!selectedFestival) {
      toast({
        title: 'Select Festival',
        description: 'Please select a festival template first.',
        variant: 'destructive',
      });
      return;
    }

    sendGreetingsMutation.mutate({
      festivalId: selectedFestival,
      channel: selectedChannel,
      agentIds: selectedAgents,
    });
  };

  const totalClients = (clientStats as any)?.totalClients || 0;
  const selectedFestivalData = festivals.find(f => f.id === selectedFestival);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          Festival Marketing
        </h1>
        <p className="text-muted-foreground">
          Send festival greetings to all clients on behalf of master agent
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Festival Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Festival</CardTitle>
              <CardDescription>Choose a festival to send greetings for</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="major">
                <TabsList className="mb-4">
                  <TabsTrigger value="major">Major Festivals</TabsTrigger>
                  <TabsTrigger value="regional">Regional Festivals</TabsTrigger>
                </TabsList>
                
                <TabsContent value="major">
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {festivals.filter(f => f.category === 'major').map((festival) => (
                      <Button
                        key={festival.id}
                        variant={selectedFestival === festival.id ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setSelectedFestival(festival.id)}
                      >
                        <span className="text-2xl mb-1">{festival.emoji}</span>
                        <span className="text-xs">{festival.name}</span>
                      </Button>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="regional">
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {festivals.filter(f => f.category === 'regional').map((festival) => (
                      <Button
                        key={festival.id}
                        variant={selectedFestival === festival.id ? 'default' : 'outline'}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setSelectedFestival(festival.id)}
                      >
                        <span className="text-2xl mb-1">{festival.emoji}</span>
                        <span className="text-xs">{festival.name}</span>
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Channel Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Channel</CardTitle>
              <CardDescription>How should the greetings be sent?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant={selectedChannel === 'email' ? 'default' : 'outline'}
                  className="flex flex-col h-auto py-4"
                  onClick={() => setSelectedChannel('email')}
                >
                  <Mail className="h-6 w-6 mb-2" />
                  <span>Email</span>
                </Button>
                <Button
                  variant={selectedChannel === 'whatsapp' ? 'default' : 'outline'}
                  className="flex flex-col h-auto py-4"
                  onClick={() => setSelectedChannel('whatsapp')}
                >
                  <MessageSquare className="h-6 w-6 mb-2" />
                  <span>WhatsApp</span>
                </Button>
                <Button
                  variant={selectedChannel === 'both' ? 'default' : 'outline'}
                  className="flex flex-col h-auto py-4"
                  onClick={() => setSelectedChannel('both')}
                >
                  <Users className="h-6 w-6 mb-2" />
                  <span>Both</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Selection (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Selection (Optional)</CardTitle>
              <CardDescription>Select specific agents or leave empty for master agent</CardDescription>
            </CardHeader>
            <CardContent>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All clients (Master Agent)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients (Master Agent)</SelectItem>
                  {(agents as any[])?.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.fullName} ({agent.activeClients || 0} clients)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Summary & Actions */}
        <div className="space-y-6">
          {/* Campaign Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Festival:</span>
                <span className="font-medium">
                  {selectedFestivalData ? (
                    <span>{selectedFestivalData.emoji} {selectedFestivalData.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Not selected</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Channel:</span>
                <Badge variant="secondary">{selectedChannel.toUpperCase()}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Recipients:</span>
                <span className="font-medium">{totalClients} clients</span>
              </div>
              
              <Button 
                className="w-full mt-4" 
                size="lg"
                onClick={handleSendGreetings}
                disabled={!selectedFestival || sendGreetingsMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {sendGreetingsMutation.isPending ? 'Sending...' : 'Send Greetings Now'}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Campaigns */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No campaigns sent yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.slice(0, 5).map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{campaign.festivalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sentCount} sent
                        </p>
                      </div>
                      <Badge variant={
                        campaign.status === 'sent' ? 'default' :
                        campaign.status === 'scheduled' ? 'secondary' :
                        campaign.status === 'failed' ? 'destructive' : 'outline'
                      }>
                        {campaign.status === 'sent' && <Check className="h-3 w-3 mr-1" />}
                        {campaign.status === 'scheduled' && <Clock className="h-3 w-3 mr-1" />}
                        {campaign.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
