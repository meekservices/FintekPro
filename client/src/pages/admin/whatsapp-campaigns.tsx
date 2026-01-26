import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Settings,
  RefreshCw,
  Eye,
  Mail,
  Phone,
  Smartphone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface WhatsAppServiceStatus {
  configured: boolean;
  fromNumber: string;
  availableTemplates: string[];
}

interface AudienceStats {
  totalUsers: number;
  consentedUsers: number;
  optedOutUsers: number;
  byKycTier: Record<string, number>;
}

interface BulkSendResult {
  totalRecipients: number;
  sent: number;
  failed: number;
  templateUsed: boolean;
  results: Array<{
    mobile: string;
    success: boolean;
    messageSid?: string;
    error?: string;
  }>;
}

const TEMPLATE_TYPES = [
  { id: 'welcome', name: 'Welcome Message', description: 'Greet new users joining the platform', category: 'business' },
  { id: 'ipo_alert', name: 'IPO Alert', description: 'Notify users about upcoming IPO opportunities', category: 'business' },
  { id: 'portfolio_update', name: 'Portfolio Update', description: 'Send portfolio performance updates', category: 'business' },
  { id: 'kyc_reminder', name: 'KYC Reminder', description: 'Remind users to complete KYC verification', category: 'business' },
  { id: 'promotion', name: 'Promotional Offer', description: 'Share special offers and promotions', category: 'business' },
  { id: 'mutual_fund', name: 'Mutual Fund Update', description: 'Send mutual fund performance alerts', category: 'business' },
  { id: 'dividend_alert', name: 'Dividend Alert', description: 'Notify about dividend announcements', category: 'business' },
  { id: 'order_update', name: 'Order Update', description: 'Send order status updates', category: 'business' },
  { id: 'diwali_greeting', name: 'Diwali Greeting', description: 'Send Diwali festival wishes to clients', category: 'festive' },
  { id: 'holi_greeting', name: 'Holi Greeting', description: 'Send Holi festival wishes to clients', category: 'festive' },
  { id: 'eid_greeting', name: 'Eid Greeting', description: 'Send Eid Mubarak wishes to clients', category: 'festive' },
  { id: 'christmas_greeting', name: 'Christmas Greeting', description: 'Send Christmas wishes to clients', category: 'festive' },
  { id: 'new_year_greeting', name: 'New Year Greeting', description: 'Send New Year wishes to clients', category: 'festive' },
  { id: 'independence_day', name: 'Independence Day', description: 'Send Independence Day greetings', category: 'festive' },
  { id: 'republic_day', name: 'Republic Day', description: 'Send Republic Day greetings', category: 'festive' },
  { id: 'dussehra_greeting', name: 'Dussehra Greeting', description: 'Send Dussehra wishes to clients', category: 'festive' },
  { id: 'ganesh_chaturthi', name: 'Ganesh Chaturthi', description: 'Send Ganesh Chaturthi wishes to clients', category: 'festive' },
  { id: 'pongal_greeting', name: 'Pongal Greeting', description: 'Send Pongal wishes to clients', category: 'festive' },
  { id: 'onam_greeting', name: 'Onam Greeting', description: 'Send Onam wishes to clients', category: 'festive' },
  { id: 'raksha_bandhan', name: 'Raksha Bandhan', description: 'Send Raksha Bandhan wishes to clients', category: 'festive' },
  { id: 'navratri_greeting', name: 'Navratri Greeting', description: 'Send Navratri wishes to clients', category: 'festive' },
  { id: 'makar_sankranti', name: 'Makar Sankranti', description: 'Send Makar Sankranti wishes to clients', category: 'festive' },
  { id: 'baisakhi_greeting', name: 'Baisakhi Greeting', description: 'Send Baisakhi wishes to clients', category: 'festive' },
  { id: 'guru_nanak_jayanti', name: 'Guru Nanak Jayanti', description: 'Send Guru Nanak Jayanti wishes', category: 'festive' },
  { id: 'birthday_greeting', name: 'Birthday Greeting', description: 'Send birthday wishes to clients', category: 'festive' }
];

export default function WhatsAppCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [audienceFilter, setAudienceFilter] = useState<string>('all_consented');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<{ whatsapp: boolean; sms: boolean; email: boolean }>({
    whatsapp: true,
    sms: false,
    email: false
  });

  const { data: serviceStatus, isLoading: statusLoading } = useQuery<WhatsAppServiceStatus>({
    queryKey: ['/api/admin/marketing/whatsapp/status']
  });

  const { data: audienceStats, isLoading: audienceLoading } = useQuery<AudienceStats>({
    queryKey: ['/api/admin/marketing/audience/stats']
  });

  const isConsentRequired = audienceFilter.startsWith('consented_') || audienceFilter === 'all_consented';
  const actualFilter = audienceFilter.replace('consented_', '').replace('all_consented', 'all');
  
  const { data: audienceContacts, isLoading: usersLoading } = useQuery<Array<{
    id: string;
    mobile: string;
    email: string;
    name: string;
    type: 'client' | 'prospect' | 'lead';
    kycTier?: string;
  }>>({
    queryKey: ['/api/admin/marketing/audience/all', audienceFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/marketing/audience/all?filter=${actualFilter}&consentOnly=${isConsentRequired}`);
      if (!response.ok) throw new Error('Failed to fetch audience');
      return response.json();
    }
  });

  const sendMultiChannelMutation = useMutation({
    mutationFn: async (data: { 
      recipients: Array<{ mobile?: string; email?: string; name?: string }>; 
      templateType: string;
      variables: Record<string, string>;
      channels: { whatsapp: boolean; sms: boolean; email: boolean };
    }) => {
      return apiRequest('/api/admin/marketing/multi-channel/bulk', 'POST', { body: data });
    },
    onSuccess: (result: any) => {
      const channelResults = [];
      if (result.whatsapp) channelResults.push(`WhatsApp: ${result.whatsapp.sent}/${result.whatsapp.total}`);
      if (result.sms) channelResults.push(`SMS: ${result.sms.sent}/${result.sms.total}`);
      if (result.email) channelResults.push(`Email: ${result.email.sent}/${result.email.total}`);
      
      toast({ 
        title: `Campaign Sent Successfully`,
        description: channelResults.join(', ')
      });
      setIsCreateOpen(false);
      setTemplateVariables({});
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send campaign',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const sendSingleWhatsAppMutation = useMutation({
    mutationFn: async (data: { to: string; templateType: string; variables: Record<string, string> }) => {
      return apiRequest('/api/admin/marketing/multi-channel/bulk', 'POST', { body: {
        recipients: [{ mobile: data.to, name: 'Customer' }],
        templateType: data.templateType,
        variables: data.variables,
        channels: { whatsapp: true, sms: false, email: false }
      }});
    },
    onSuccess: () => {
      toast({ title: 'Message sent successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSendMultiChannel = () => {
    if (!audienceContacts || audienceContacts.length === 0) {
      toast({ title: 'No recipients selected', variant: 'destructive' });
      return;
    }
    if (!selectedTemplate) {
      toast({ title: 'Please select a template', variant: 'destructive' });
      return;
    }
    if (!channels.whatsapp && !channels.sms && !channels.email) {
      toast({ title: 'Please select at least one channel', variant: 'destructive' });
      return;
    }

    const recipients = audienceContacts.map(u => ({
      mobile: u.mobile,
      email: u.email,
      name: u.name
    }));

    sendMultiChannelMutation.mutate({
      recipients,
      templateType: selectedTemplate,
      variables: templateVariables,
      channels
    });
  };

  const getTemplateFields = (templateType: string): string[] => {
    switch (templateType) {
      case 'welcome':
        return ['customer_name'];
      case 'ipo_alert':
        return ['company_name', 'open_date', 'price_range'];
      case 'portfolio_update':
        return ['portfolio_value', 'change_percent'];
      case 'kyc_reminder':
        return ['customer_name', 'pending_step'];
      case 'promotion':
        return ['offer_title', 'offer_details', 'cta_link'];
      case 'mutual_fund':
        return ['fund_name', 'returns', 'min_investment'];
      case 'dividend_alert':
        return ['company_name', 'dividend_amount', 'ex_date'];
      case 'order_update':
        return ['order_id', 'order_status', 'order_details'];
      case 'diwali_greeting':
      case 'holi_greeting':
      case 'eid_greeting':
      case 'christmas_greeting':
      case 'new_year_greeting':
      case 'dussehra_greeting':
      case 'ganesh_chaturthi':
      case 'pongal_greeting':
      case 'onam_greeting':
      case 'raksha_bandhan':
      case 'navratri_greeting':
      case 'makar_sankranti':
      case 'baisakhi_greeting':
      case 'guru_nanak_jayanti':
        return ['customer_name', 'festival_year', 'custom_message'];
      case 'independence_day':
      case 'republic_day':
        return ['customer_name', 'year'];
      case 'birthday_greeting':
        return ['customer_name', 'birthday_message'];
      default:
        return [];
    }
  };

  const businessTemplates = TEMPLATE_TYPES.filter(t => t.category === 'business');
  const festiveTemplates = TEMPLATE_TYPES.filter(t => t.category === 'festive');

  if (statusLoading) {
    return <LoadingState variant="stats" />;
  }

  const isConfigured = serviceStatus?.configured ?? false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Channel Campaigns</h1>
          <p className="text-muted-foreground">
            Send festive greetings and campaigns via WhatsApp, SMS, and Email
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/whatsapp/status'] })}
            data-testid="button-refresh-status"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-campaign">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Multi-Channel Campaign</DialogTitle>
                <DialogDescription>
                  Send festive greetings or messages via WhatsApp, SMS, and Email
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Communication Channels</Label>
                  <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-whatsapp"
                        checked={channels.whatsapp}
                        onCheckedChange={(checked) => setChannels({ ...channels, whatsapp: !!checked })}
                      />
                      <Label htmlFor="channel-whatsapp" className="flex items-center gap-1 cursor-pointer">
                        <Smartphone className="h-4 w-4 text-green-600" />
                        WhatsApp
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-sms"
                        checked={channels.sms}
                        onCheckedChange={(checked) => setChannels({ ...channels, sms: !!checked })}
                      />
                      <Label htmlFor="channel-sms" className="flex items-center gap-1 cursor-pointer">
                        <Phone className="h-4 w-4 text-blue-600" />
                        SMS
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="channel-email"
                        checked={channels.email}
                        onCheckedChange={(checked) => setChannels({ ...channels, email: !!checked })}
                      />
                      <Label htmlFor="channel-email" className="flex items-center gap-1 cursor-pointer">
                        <Mail className="h-4 w-4 text-orange-600" />
                        Email
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                    <SelectTrigger data-testid="select-audience-filter">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Consented (Marketing Opt-in)</div>
                      <SelectItem value="all_consented">All Consented Users</SelectItem>
                      <SelectItem value="consented_clients">Consented Clients Only</SelectItem>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">All Contacts (Greetings)</div>
                      <SelectItem value="all_contacts">All Contacts</SelectItem>
                      <SelectItem value="all_clients">All Clients</SelectItem>
                      <SelectItem value="all_prospects">All Prospects</SelectItem>
                      <SelectItem value="all_leads">All Leads</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {usersLoading ? 'Loading...' : `${audienceContacts?.length || 0} recipients selected`}
                  </p>
                </div>

                {!isConsentRequired && (
                  <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">Compliance Notice</p>
                        <p className="text-amber-700 dark:text-amber-300">
                          You are sending to contacts who may not have opted in to marketing. 
                          Use this only for festive greetings or transactional messages.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Select value={selectedTemplate} onValueChange={(val) => {
                    setSelectedTemplate(val);
                    setTemplateVariables({});
                  }}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Business Templates</div>
                      {businessTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Festive Greetings</div>
                      {festiveTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      {TEMPLATE_TYPES.find(t => t.id === selectedTemplate)?.description}
                    </p>
                  )}
                </div>

                {selectedTemplate && getTemplateFields(selectedTemplate).length > 0 && (
                  <div className="space-y-3">
                    <Label>Template Variables</Label>
                    <div className="grid gap-3 md:grid-cols-2">
                      {getTemplateFields(selectedTemplate).map((field) => (
                        <div key={field} className="space-y-1">
                          <Label htmlFor={field} className="text-xs">
                            {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Label>
                          <Input
                            id={field}
                            value={templateVariables[field] || ''}
                            onChange={(e) => setTemplateVariables({ 
                              ...templateVariables, 
                              [field]: e.target.value 
                            })}
                            placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                            data-testid={`input-${field}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isConsentRequired && (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800 dark:text-green-200">Marketing Compliance</p>
                        <p className="text-green-700 dark:text-green-300">
                          Messages will only be sent to users who have opted in to marketing communications.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                    onClick={handleSendMultiChannel}
                    disabled={sendMultiChannelMutation.isPending || !audienceContacts?.length || !selectedTemplate || (!channels.whatsapp && !channels.sms && !channels.email)}
                    data-testid="button-send-campaign"
                  >
                    {sendMultiChannelMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send to {audienceContacts?.length || 0} Recipients
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-service-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {isConfigured ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">Active</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 font-medium">Not Configured</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {serviceStatus?.fromNumber || 'Twilio WhatsApp not configured'}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {audienceLoading ? '...' : audienceStats?.totalUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card data-testid="card-consented-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marketing Consent</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {audienceLoading ? '...' : audienceStats?.consentedUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Opted-in users</p>
          </CardContent>
        </Card>

        <Card data-testid="card-templates">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {TEMPLATE_TYPES.length}
            </div>
            <p className="text-xs text-muted-foreground">Pre-approved templates</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="quick-send" data-testid="tab-quick-send">Quick Send</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Campaign History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Pre-Approved Templates</CardTitle>
              <CardDescription>
                WhatsApp Business Policy requires using pre-approved templates for marketing messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {TEMPLATE_TYPES.map((template) => (
                  <div 
                    key={template.id} 
                    className="border rounded-lg p-4 hover:bg-accent transition-colors"
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-green-500" />
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="outline" className="ml-auto">Approved</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {getTemplateFields(template.id).map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {`{{${field}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quick-send">
          <Card>
            <CardHeader>
              <CardTitle>Quick Send</CardTitle>
              <CardDescription>Send a single WhatsApp message to a specific user</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickSendForm 
                templates={TEMPLATE_TYPES}
                getFields={getTemplateFields}
                onSend={sendSingleWhatsAppMutation.mutate} 
                isPending={sendSingleWhatsAppMutation.isPending} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>View past WhatsApp campaigns and their performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Campaign history will appear here after you send your first campaign.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickSendForm({ 
  templates, 
  getFields,
  onSend, 
  isPending 
}: { 
  templates: typeof TEMPLATE_TYPES;
  getFields: (type: string) => string[];
  onSend: (data: any) => void; 
  isPending: boolean;
}) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend({ to: phoneNumber, templateType, variables });
  };

  const fields = templateType ? getFields(templateType) : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+91 9876543210"
            required
            data-testid="input-phone"
          />
        </div>

        <div className="space-y-2">
          <Label>Template</Label>
          <Select value={templateType} onValueChange={(val) => {
            setTemplateType(val);
            setVariables({});
          }}>
            <SelectTrigger data-testid="select-template-quick">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={`quick-${field}`}>
                {field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </Label>
              <Input
                id={`quick-${field}`}
                value={variables[field] || ''}
                onChange={(e) => setVariables({ ...variables, [field]: e.target.value })}
                placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                data-testid={`input-quick-${field}`}
              />
            </div>
          ))}
        </div>
      )}

      <Button 
        type="submit" 
        disabled={isPending || !phoneNumber || !templateType} 
        data-testid="button-send-quick"
      >
        {isPending ? 'Sending...' : 'Send WhatsApp Message'}
      </Button>
    </form>
  );
}
