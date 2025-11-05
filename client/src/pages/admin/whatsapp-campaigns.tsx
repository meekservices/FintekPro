import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Send, Eye, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface WhatsAppCampaign {
  id: string;
  name: string;
  whatsappTemplateName: string | null;
  whatsappMessage: string | null;
  status: string;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  recipientCount: number;
  createdAt: string;
}

export default function WhatsAppCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<WhatsAppCampaign[]>({
    queryKey: ['/api/admin/marketing/campaigns', 'whatsapp'],
    queryFn: async () => {
      const response = await fetch('/api/admin/marketing/campaigns?type=whatsapp');
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/admin/marketing/campaigns', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns', 'whatsapp'] });
      setIsCreateOpen(false);
      toast({ title: 'WhatsApp campaign created successfully' });
    },
    onError: () => {
      toast({ 
        title: 'Failed to create campaign',
        variant: 'destructive'
      });
    }
  });

  const sendCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, sendNow }: { campaignId: string; sendNow: boolean }) => {
      const response = await fetch(`/api/admin/marketing/campaigns/${campaignId}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendNow })
      });
      if (!response.ok) throw new Error('Failed to send campaign');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns', 'whatsapp'] });
      toast({ title: 'WhatsApp broadcast initiated successfully' });
    },
    onError: () => {
      toast({
        title: 'Failed to send broadcast',
        variant: 'destructive'
      });
    }
  });

  const syncAnalyticsMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/admin/marketing/campaigns/${campaignId}/sync-analytics`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/campaigns', 'whatsapp'] });
      toast({ title: 'Analytics synced successfully' });
    }
  });

  const handleCreateCampaign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createCampaignMutation.mutate({
      name: formData.get('name'),
      description: formData.get('description'),
      campaignType: 'whatsapp',
      whatsappTemplateName: formData.get('whatsappTemplateName'),
      whatsappMessage: formData.get('whatsappMessage'),
      whatsappMediaUrl: formData.get('whatsappMediaUrl')
    });
  };

  if (isLoading) {
    return <LoadingState variant="list" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WhatsApp Campaigns</h1>
          <p className="text-muted-foreground">
            Send template-based WhatsApp broadcasts via AiSensy Business API
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-whatsapp-campaign">
              <Plus className="mr-2 h-4 w-4" />
              Create WhatsApp Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <DialogHeader>
              <DialogTitle>Create WhatsApp Campaign</DialogTitle>
              <DialogDescription>
                Create a WhatsApp broadcast using approved templates from AiSensy
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Q4 Investment Opportunities WhatsApp Blast"
                  required
                  data-testid="input-campaign-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of the campaign"
                  data-testid="input-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappTemplateName">WhatsApp Template Name</Label>
                <Input
                  id="whatsappTemplateName"
                  name="whatsappTemplateName"
                  placeholder="investment_alert_v2"
                  required
                  data-testid="input-template-name"
                />
                <p className="text-xs text-muted-foreground">
                  Use an approved template from your AiSensy account. Templates must be pre-approved by WhatsApp.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappMessage">Message Preview</Label>
                <Textarea
                  id="whatsappMessage"
                  name="whatsappMessage"
                  placeholder="Hello! Check out our latest investment opportunities..."
                  rows={5}
                  data-testid="input-message"
                />
                <p className="text-xs text-muted-foreground">
                  This is for preview only. Actual message will use the approved template.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappMediaUrl">Media URL (Optional)</Label>
                <Input
                  id="whatsappMediaUrl"
                  name="whatsappMediaUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  data-testid="input-media-url"
                />
                <p className="text-xs text-muted-foreground">
                  URL for image, video, or document attachment (if template supports media)
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createCampaignMutation.isPending}
                  data-testid="button-submit-campaign"
                >
                  {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaign Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-campaigns">
              {campaigns?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sent">
              {campaigns?.reduce((sum, c) => sum + c.sentCount, 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-delivery-rate">
              {campaigns && campaigns.length > 0
                ? ((campaigns.reduce((sum, c) => sum + (c.sentCount > 0 ? (c.deliveredCount / c.sentCount) : 0), 0) / campaigns.length) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Read Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-read-rate">
              {campaigns && campaigns.length > 0
                ? ((campaigns.reduce((sum, c) => sum + (c.sentCount > 0 ? (c.openedCount / c.sentCount) : 0), 0) / campaigns.length) * 100).toFixed(1)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>All WhatsApp Campaigns</CardTitle>
          <CardDescription>Manage and track your WhatsApp broadcasts</CardDescription>
        </CardHeader>
        <CardContent>
          {!campaigns || campaigns.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No WhatsApp campaigns yet</p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                  data-testid={`campaign-${campaign.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold" data-testid={`text-campaign-name-${campaign.id}`}>
                          {campaign.name}
                        </h3>
                        <Badge variant={
                          campaign.status === 'sent' ? 'default' :
                          campaign.status === 'sending' ? 'secondary' :
                          campaign.status === 'scheduled' ? 'outline' :
                          'secondary'
                        }>
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Template: {campaign.whatsappTemplateName || 'Not set'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Recipients: {campaign.recipientCount}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => sendCampaignMutation.mutate({ 
                            campaignId: campaign.id, 
                            sendNow: true 
                          })}
                          disabled={sendCampaignMutation.isPending}
                          data-testid={`button-send-${campaign.id}`}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Now
                        </Button>
                      )}
                      {(campaign.status === 'sent' || campaign.status === 'sending') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncAnalyticsMutation.mutate(campaign.id)}
                          disabled={syncAnalyticsMutation.isPending}
                          data-testid={`button-sync-${campaign.id}`}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Analytics
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  {campaign.sentCount > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <Send className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-semibold">{campaign.sentCount}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                      <div className="text-center">
                        <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-semibold">
                          {campaign.deliveredCount} 
                          <span className="text-xs text-muted-foreground ml-1">
                            ({campaign.sentCount > 0 ? ((campaign.deliveredCount / campaign.sentCount) * 100).toFixed(1) : 0}%)
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Delivered</p>
                      </div>
                      <div className="text-center">
                        <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-semibold">
                          {campaign.openedCount}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1) : 0}%)
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">Read</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
