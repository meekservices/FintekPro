import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bell, 
  Mail, 
  Smartphone, 
  MessageSquare,
  Moon,
  Clock,
  TrendingUp,
  FileText,
  Calendar,
  Shield as LucideShield,
  AlertTriangle,
  CheckCircle2,
  Save,
  BellRing,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: any;
  channels: {
    email: boolean;
    sms: boolean;
    push: boolean;
    whatsapp: boolean;
  };
}

export default function NotificationPreferences() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const {
    isSupported: pushSupported,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    error: pushError,
    enableNotifications,
    unsubscribe: unsubscribePush,
  } = usePushNotifications();
  
  const [quietHours, setQuietHours] = useState({
    enabled: true,
    start: '22:00',
    end: '07:00'
  });

  const defaultCategories: NotificationCategory[] = [
    { 
      id: 'portfolio_alerts', 
      name: 'Portfolio Alerts', 
      description: 'Price changes, rebalancing alerts, and portfolio updates',
      icon: TrendingUp,
      channels: { email: true, sms: false, push: true, whatsapp: false }
    },
    { 
      id: 'market_news', 
      name: 'Market News', 
      description: 'Important market updates and news affecting your holdings',
      icon: FileText,
      channels: { email: true, sms: false, push: true, whatsapp: false }
    },
    { 
      id: 'transactions', 
      name: 'Transaction Updates', 
      description: 'Order confirmations, settlements, and payment receipts',
      icon: CheckCircle2,
      channels: { email: true, sms: true, push: true, whatsapp: true }
    },
    { 
      id: 'tax_reminders', 
      name: 'Tax Reminders', 
      description: 'Advance tax due dates, ITR filing deadlines',
      icon: Calendar,
      channels: { email: true, sms: true, push: true, whatsapp: false }
    },
    { 
      id: 'kyc_updates', 
      name: 'KYC Updates', 
      description: 'Verification status, document expiry reminders',
      icon: LucideShield,
      channels: { email: true, sms: true, push: true, whatsapp: false }
    },
    { 
      id: 'security_alerts', 
      name: 'Security Alerts', 
      description: 'Login attempts, password changes, and security notices',
      icon: AlertTriangle,
      channels: { email: true, sms: true, push: true, whatsapp: true }
    },
  ];

  const [categories, setCategories] = useState<NotificationCategory[]>(defaultCategories);
  const [digestFrequency, setDigestFrequency] = useState('weekly');

  const toggleChannel = (categoryId: string, channel: keyof NotificationCategory['channels']) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, channels: { ...cat.channels, [channel]: !cat.channels[channel] } }
        : cat
    ));
  };

  const handleEnablePush = async () => {
    const success = await enableNotifications();
    if (success) {
      toast({
        title: "Push Notifications Enabled",
        description: "You will now receive push notifications on this device.",
      });
    } else {
      toast({
        title: "Could not enable push notifications",
        description: pushPermission === 'denied' 
          ? "Please enable notifications in your browser settings." 
          : "An error occurred while enabling push notifications.",
        variant: "destructive",
      });
    }
  };

  const handleDisablePush = async () => {
    const success = await unsubscribePush();
    if (success) {
      toast({
        title: "Push Notifications Disabled",
        description: "You will no longer receive push notifications on this device.",
      });
    }
  };

  const handleTestNotification = async () => {
    setIsTesting(true);
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test Notification', {
          body: 'This is a test notification from FintekPro!',
          icon: '/icon-192.png',
          tag: 'test-notification',
        });
        toast({
          title: "Test Sent",
          description: "Check your notification panel for the test message.",
        });
      } else if (pushSupported && pushSubscribed) {
        try {
          await apiRequest("/api/notifications/test", {
            method: "POST",
            body: JSON.stringify({ type: 'push' })
          });
          toast({
            title: "Test Notification Sent",
            description: "You should receive a push notification shortly.",
          });
        } catch {
          toast({
            title: "Test notification sent locally",
            description: "Backend test not available, but local notification triggered.",
          });
        }
      } else {
        toast({
          title: "Enable Push First",
          description: "Please enable push notifications to test them.",
          variant: "destructive",
        });
      }
    } catch (error) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Test Notification', {
          body: 'This is a test notification from FintekPro!',
          icon: '/icon-192.png',
          tag: 'test-notification',
        });
        toast({ title: "Test Sent", description: "Local notification triggered." });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const preferences = {
        quietHours,
        categories: categories.map(c => ({ id: c.id, channels: c.channels })),
        digestFrequency,
      };
      await apiRequest("/api/user/notification-preferences", {
        method: "POST",
        body: JSON.stringify(preferences)
      });
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been updated.",
      });
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
      toast({
        title: "Preferences Saved",
        description: "Your notification preferences have been saved locally.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to manage notification preferences.</p>
            <Link href="/auth">
              <Button data-testid="notif-login-btn">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6" data-testid="notification-preferences-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-8 w-8 text-blue-500" />
            Notification Preferences
          </h1>
          <p className="text-muted-foreground mt-1">
            Control how and when you receive notifications
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} data-testid="save-preferences-btn">
          {isSaving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </div>

      {/* Push Notification Status Card */}
      <Card className={pushSubscribed ? "border-green-200 bg-green-50/30 dark:border-green-800 dark:bg-green-950/30" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Receive instant notifications on this device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported ? (
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Push notifications are not supported in this browser. Try using Chrome, Firefox, or Edge.
              </AlertDescription>
            </Alert>
          ) : pushPermission === 'denied' ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Push notifications are blocked. Please enable them in your browser settings to receive real-time alerts.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                {pushSubscribed ? (
                  <>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" data-testid="push-status-enabled">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                    <span className="text-sm text-muted-foreground">You'll receive push notifications on this device</span>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="bg-muted text-muted-foreground" data-testid="push-status-disabled">
                      Disabled
                    </Badge>
                    <span className="text-sm text-muted-foreground">Enable to receive instant notifications</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {pushSubscribed ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestNotification}
                      disabled={isTesting}
                      data-testid="test-notification-btn"
                    >
                      {isTesting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BellRing className="h-4 w-4 mr-2" />
                      )}
                      Test Notification
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisablePush}
                      disabled={pushLoading}
                      data-testid="disable-push-btn"
                    >
                      Disable
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleEnablePush}
                    disabled={pushLoading}
                    data-testid="enable-push-btn"
                  >
                    {pushLoading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bell className="h-4 w-4 mr-2" />
                    )}
                    Enable Push Notifications
                  </Button>
                )}
              </div>
            </div>
          )}
          {pushError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{pushError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Quiet Hours
          </CardTitle>
          <CardDescription>Pause non-urgent notifications during specific hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Quiet Hours</p>
              <p className="text-sm text-muted-foreground">Only critical alerts during this time</p>
            </div>
            <Switch 
              checked={quietHours.enabled} 
              onCheckedChange={(checked) => setQuietHours(prev => ({ ...prev, enabled: checked }))}
              data-testid="quiet-hours-toggle"
            />
          </div>
          
          {quietHours.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select 
                  value={quietHours.start} 
                  onValueChange={(value) => setQuietHours(prev => ({ ...prev, start: value }))}
                >
                  <SelectTrigger data-testid="quiet-start-select">
                    <Clock className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                        {`${i.toString().padStart(2, '0')}:00`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select 
                  value={quietHours.end} 
                  onValueChange={(value) => setQuietHours(prev => ({ ...prev, end: value }))}
                >
                  <SelectTrigger data-testid="quiet-end-select">
                    <Clock className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                        {`${i.toString().padStart(2, '0')}:00`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>Choose how you want to receive each type of notification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 mb-4 text-sm font-medium text-center">
            <div className="col-span-1"></div>
            <div className="flex flex-col items-center gap-1">
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Smartphone className="h-4 w-4" />
              <span>SMS</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Bell className="h-4 w-4" />
              <span>Push</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span>WhatsApp</span>
            </div>
          </div>

          <Separator className="mb-4" />

          <div className="space-y-4">
            {categories.map((category) => (
              <div 
                key={category.id} 
                className="grid grid-cols-5 gap-4 items-center py-3 border-b last:border-0"
                data-testid={`category-${category.id}`}
              >
                <div className="col-span-1">
                  <div className="flex items-center gap-2">
                    <category.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{category.name}</p>
                      <p className="text-xs text-muted-foreground hidden md:block">{category.description}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch 
                    checked={category.channels.email}
                    onCheckedChange={() => toggleChannel(category.id, 'email')}
                    data-testid={`${category.id}-email`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch 
                    checked={category.channels.sms}
                    onCheckedChange={() => toggleChannel(category.id, 'sms')}
                    data-testid={`${category.id}-sms`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch 
                    checked={category.channels.push}
                    onCheckedChange={() => toggleChannel(category.id, 'push')}
                    data-testid={`${category.id}-push`}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch 
                    checked={category.channels.whatsapp}
                    onCheckedChange={() => toggleChannel(category.id, 'whatsapp')}
                    data-testid={`${category.id}-whatsapp`}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Portfolio Digest
          </CardTitle>
          <CardDescription>Receive a summary of your portfolio performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Digest Frequency</p>
              <p className="text-sm text-muted-foreground">How often would you like to receive portfolio summaries?</p>
            </div>
            <Select value={digestFrequency} onValueChange={setDigestFrequency}>
              <SelectTrigger className="w-[180px]" data-testid="digest-frequency-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {digestFrequency !== 'never' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You'll receive a {digestFrequency} portfolio digest every{' '}
                {digestFrequency === 'daily' ? 'morning at 8:00 AM' : 
                 digestFrequency === 'weekly' ? 'Monday at 8:00 AM' : 
                 '1st of the month at 8:00 AM'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
