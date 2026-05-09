import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, 
  Plus, 
  Send, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Settings,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface SMSServiceStatus {
  configured: boolean;
  messagingServiceSid: string;
  fromNumber: string;
  capabilities: string[];
}

interface AudienceStats {
  totalUsers: number;
  consentedUsers: number;
  optedOutUsers: number;
  byKycTier: Record<string, number>;
}

interface BulkSendResult {
  sent: number;
  failed: number;
  results: Array<{
    mobile: string;
    success: boolean;
    messageSid?: string;
    error?: string;
  }>;
}

export default function SMSCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [audienceFilter, setAudienceFilter] = useState<string>('all');
  const [customMessage, setCustomMessage] = useState('');

  const { data: serviceStatus, isLoading: statusLoading } = useQuery<SMSServiceStatus>({
    queryKey: ['/api/admin/marketing/sms/status']
  });

  const { data: audienceStats, isLoading: audienceLoading } = useQuery<AudienceStats>({
    queryKey: ['/api/admin/marketing/audience/stats']
  });

  const { data: consentedUsers, isLoading: usersLoading } = useQuery<Array<{
    userId: string;
    mobile: string;
    name: string;
    kycTier: string;
  }>>({
    queryKey: ['/api/admin/marketing/audience', audienceFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/marketing/audience?filter=${audienceFilter}&consentOnly=true`);
      if (!response.ok) throw new Error('Failed to fetch audience');
      return response.json();
    }
  });

  const sendBulkSMSMutation = useMutation({
    mutationFn: async (data: { recipients: Array<{ mobile: string; name: string }>; message: string }) => {
      return apiRequest('/api/admin/marketing/sms/bulk', 'POST', data);
    },
    onSuccess: (result: BulkSendResult) => {
      toast({ 
        title: `SMS Campaign Sent`,
        description: `${result.sent} sent, ${result.failed} failed`
      });
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send campaign',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const sendPromotionalSMSMutation = useMutation({
    mutationFn: async (data: { to: string; productType: string; details: Record<string, any> }) => {
      return apiRequest('/api/admin/marketing/sms/promotional', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Promotional SMS sent successfully' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to send SMS',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleSendBulkSMS = () => {
    if (!consentedUsers || consentedUsers.length === 0) {
      toast({ title: 'No recipients selected', variant: 'destructive' });
      return;
    }
    if (!customMessage.trim()) {
      toast({ title: 'Please enter a message', variant: 'destructive' });
      return;
    }

    const recipients = consentedUsers.map(u => ({
      mobile: u.mobile,
      name: u.name
    }));

    sendBulkSMSMutation.mutate({
      recipients,
      message: customMessage
    });
  };

  if (statusLoading) {
    return <LoadingState variant="stats" />;
  }

  const isConfigured = serviceStatus?.configured ?? false;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Marketing</h1>
          <p className="text-muted-foreground">
            Send bulk SMS campaigns via Twilio Messaging Service
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/sms/status'] })}
            data-testid="button-refresh-status"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!isConfigured} data-testid="button-create-sms-campaign">
                <Plus className="mr-2 h-4 w-4" />
                New SMS Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create SMS Campaign</DialogTitle>
                <DialogDescription>
                  Send bulk SMS to users who have consented to marketing communications
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Audience Filter</Label>
                  <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                    <SelectTrigger data-testid="select-audience-filter">
                      <SelectValue placeholder="Select audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Consented Users</SelectItem>
                      <SelectItem value="basic">Basic KYC Users</SelectItem>
                      <SelectItem value="enhanced">Enhanced KYC Users</SelectItem>
                      <SelectItem value="accredited">Accredited Investors</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {usersLoading ? 'Loading...' : `${consentedUsers?.length || 0} recipients selected`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Quick Templates</Label>
                  <Select value={selectedTemplate} onValueChange={(val) => {
                    setSelectedTemplate(val);
                    switch (val) {
                      case 'ipo':
                        setCustomMessage('🎯 FintekPro IPO Alert!\n\n[Company] IPO opens [Date].\nPrice: ₹[Min]-₹[Max]\nApply now on FintekPro!\n\nReply STOP to opt-out.');
                        break;
                      case 'mf':
                        setCustomMessage('📈 FintekPro MF Update!\n\n[Fund] delivered [X]% returns.\nStart SIP from ₹500/month.\n\nReply STOP to opt-out.');
                        break;
                      case 'kyc':
                        setCustomMessage('🔐 FintekPro KYC Reminder\n\nComplete your KYC to unlock all features.\n- Stocks & MFs\n- IPOs\n- Loans & more\n\nComplete now: fintekpro.in/kyc\n\nReply STOP to opt-out.');
                        break;
                      case 'custom':
                        setCustomMessage('');
                        break;
                    }
                  }}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template or write custom" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ipo">IPO Alert</SelectItem>
                      <SelectItem value="mf">Mutual Fund Update</SelectItem>
                      <SelectItem value="kyc">KYC Reminder</SelectItem>
                      <SelectItem value="custom">Custom Message</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message Content</Label>
                  <Textarea
                    id="message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter your SMS message..."
                    rows={6}
                    data-testid="input-message"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{customMessage.length} characters</span>
                    <span className={customMessage.length > 160 ? 'text-orange-500' : ''}>
                      {Math.ceil(customMessage.length / 160)} SMS segment(s)
                    </span>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">TRAI Compliance Notice</p>
                      <p className="text-amber-700 dark:text-amber-300">
                        Only users who have opted in to marketing communications will receive this SMS.
                        All messages include opt-out instructions.
                      </p>
                    </div>
                  </div>
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
                    onClick={handleSendBulkSMS}
                    disabled={sendBulkSMSMutation.isPending || !consentedUsers?.length}
                    data-testid="button-send-campaign"
                  >
                    {sendBulkSMSMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send to {consentedUsers?.length || 0} Recipients
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
              {serviceStatus?.messagingServiceSid || 'Twilio not configured'}
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

        <Card data-testid="card-opted-out">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opted Out</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {audienceLoading ? '...' : audienceStats?.optedOutUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Unsubscribed users</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="quick-send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quick-send" data-testid="tab-quick-send">Quick Send</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Campaign History</TabsTrigger>
        </TabsList>

        <TabsContent value="quick-send">
          <Card>
            <CardHeader>
              <CardTitle>Quick Promotional SMS</CardTitle>
              <CardDescription>Send a promotional SMS to a single user</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickSendForm onSend={sendPromotionalSMSMutation.mutate} isPending={sendPromotionalSMSMutation.isPending} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>SMS Templates</CardTitle>
              <CardDescription>Pre-approved message templates for different product types</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { type: 'ipo', title: 'IPO Alert', icon: '🎯', preview: 'IPO opens [Date]. Price: ₹[Min]-₹[Max]' },
                  { type: 'mutual_fund', title: 'Mutual Fund Update', icon: '📈', preview: '[Fund] delivered [X]% returns' },
                  { type: 'stock_tip', title: 'Stock Alert', icon: '💹', preview: '[Symbol]: [Action] @ ₹[Price]' },
                  { type: 'loan', title: 'Loan Offer', icon: '🏦', preview: 'Pre-approved loan up to ₹[Amount]' },
                  { type: 'kyc_reminder', title: 'KYC Reminder', icon: '🔐', preview: 'Complete your KYC to unlock features' },
                  { type: 'portfolio_update', title: 'Portfolio Update', icon: '📊', preview: 'Your portfolio: ₹[Value], Today: [Change]%' }
                ].map((template) => (
                  <div key={template.type} className="border rounded-lg p-4 hover:bg-accent transition-colors" data-testid={`template-${template.type}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{template.icon}</span>
                      <h3 className="font-semibold">{template.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{template.preview}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      All messages include "Reply STOP to opt-out"
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Campaign History</CardTitle>
              <CardDescription>View past SMS campaigns and their performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Campaign history will appear here after you send your first campaign.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickSendForm({ onSend, isPending }: { onSend: (data: any) => void; isPending: boolean }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [productType, setProductType] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend({ to: phoneNumber, productType, details });
  };

  const getDetailsFields = () => {
    switch (productType) {
      case 'ipo':
        return ['companyName', 'openDate', 'priceMin', 'priceMax'];
      case 'mutual_fund':
        return ['fundName', 'returns', 'minSip'];
      case 'stock_tip':
        return ['symbol', 'action', 'price', 'target'];
      case 'loan':
        return ['loanType', 'amount', 'rate'];
      case 'kyc_reminder':
        return ['link'];
      case 'portfolio_update':
        return ['value', 'change', 'link'];
      default:
        return ['message'];
    }
  };

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
          <Label>Product Type</Label>
          <Select value={productType} onValueChange={setProductType}>
            <SelectTrigger data-testid="select-product-type">
              <SelectValue placeholder="Select product type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ipo">IPO Alert</SelectItem>
              <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
              <SelectItem value="stock_tip">Stock Tip</SelectItem>
              <SelectItem value="loan">Loan Offer</SelectItem>
              <SelectItem value="kyc_reminder">KYC Reminder</SelectItem>
              <SelectItem value="portfolio_update">Portfolio Update</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {productType && (
        <div className="grid gap-4 md:grid-cols-2">
          {getDetailsFields().map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Label>
              <Input
                id={field}
                value={details[field] || ''}
                onChange={(e) => setDetails({ ...details, [field]: e.target.value })}
                placeholder={`Enter ${field}`}
                data-testid={`input-${field}`}
              />
            </div>
          ))}
        </div>
      )}

      <Button type="submit" disabled={isPending || !phoneNumber || !productType} data-testid="button-send-quick">
        {isPending ? 'Sending...' : 'Send SMS'}
      </Button>
    </form>
  );
}
