import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  Calendar,
  CheckCircle,
  Mail,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Clock,
  Receipt,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

interface TaxReminder {
  id: string;
  quarter: string;
  financialYear: string;
  dueDate: string;
  estimatedSTCG: string;
  estimatedLTCG: string;
  totalTaxLiability: string;
  status: string;
  reminderSentAt?: string;
}

interface UserSubscription {
  id: string;
  userId: string;
  itrFormType: string;
  subscriptionStatus: string;
  pricingTier: string;
  annualPrice: string;
  isFree: boolean;
  validFrom: string;
  validUntil: string;
  reminderChannels: string[];
}

export default function TaxReminderDashboard() {
  const { user } = useAuth();

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscription>({
    queryKey: ['/api/tax/reminder-subscription', user?.id],
    enabled: !!user
  });

  const { data: reminders, isLoading: remindersLoading } = useQuery<TaxReminder[]>({
    queryKey: ['/api/tax/capital-gains-reminders', user?.id],
    enabled: !!user && !!subscription
  });

  if (subscriptionLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card className="border-dashed" data-testid="card-no-subscription">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Bell className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle>No Active Subscription</CardTitle>
          <CardDescription>
            Subscribe to our quarterly tax reminder service to stay on top of your advance tax payments
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/tax-reminder-subscription">
            <Button data-testid="button-subscribe-now">
              Subscribe Now
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const upcomingReminder = reminders?.find(r => r.status === 'pending');
  const pastReminders = reminders?.filter(r => r.status !== 'pending') || [];
  
  const daysUntilNext = upcomingReminder 
    ? Math.ceil((new Date(upcomingReminder.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6" data-testid="tax-reminder-dashboard">
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-900 border-blue-200 dark:border-blue-800" data-testid="card-subscription-status">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Active Subscription
              </CardTitle>
              <CardDescription>Your tax reminder service is currently active</CardDescription>
            </div>
            <Badge 
              variant={subscription.isFree ? "default" : "secondary"}
              className={subscription.isFree ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
              data-testid="badge-subscription-tier"
            >
              {subscription.isFree ? "FREE TIER" : subscription.itrFormType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div data-testid="subscription-plan-info">
              <div className="text-sm text-muted-foreground">Plan Type</div>
              <div className="text-lg font-semibold">{subscription.itrFormType}</div>
            </div>
            <div data-testid="subscription-validity-info">
              <div className="text-sm text-muted-foreground">Valid Until</div>
              <div className="text-lg font-semibold">
                {new Date(subscription.validUntil).toLocaleDateString()}
              </div>
            </div>
            <div data-testid="subscription-channels-info">
              <div className="text-sm text-muted-foreground">Notification Channels</div>
              <div className="flex gap-2 mt-1">
                {subscription.reminderChannels.includes('email') && (
                  <Badge variant="outline" className="text-xs">
                    <Mail className="h-3 w-3 mr-1" />
                    Email
                  </Badge>
                )}
                {subscription.reminderChannels.includes('sms') && (
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    SMS
                  </Badge>
                )}
                {subscription.reminderChannels.includes('whatsapp') && (
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-next-reminder">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Next Reminder
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingReminder ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Quarter</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {upcomingReminder.quarter} - FY {upcomingReminder.financialYear}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Due Date</div>
                  <div className="text-lg font-semibold">
                    {new Date(upcomingReminder.dueDate).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                  {daysUntilNext !== null && (
                    <div className="text-sm text-orange-600 flex items-center gap-1 mt-1">
                      <Clock className="h-4 w-4" />
                      {daysUntilNext > 0 ? `${daysUntilNext} days remaining` : 'Due today!'}
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-2">Estimated Tax Liability</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">STCG (20%)</div>
                      <div className="text-lg font-bold text-orange-600">
                        ₹{parseFloat(upcomingReminder.estimatedSTCG).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">LTCG (12.5%)</div>
                      <div className="text-lg font-bold text-green-600">
                        ₹{parseFloat(upcomingReminder.estimatedLTCG).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Tax Due</span>
                      <span className="text-xl font-bold text-blue-600">
                        ₹{parseFloat(upcomingReminder.totalTaxLiability).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No upcoming reminders</p>
                {remindersLoading && <Skeleton className="h-4 w-32 mx-auto mt-2" />}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-notification-settings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Notification Settings
            </CardTitle>
            <CardDescription>Manage your reminder preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between" data-testid="setting-email">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="email-notifications">Email Notifications</Label>
              </div>
              <Switch 
                id="email-notifications" 
                checked={subscription.reminderChannels.includes('email')}
              />
            </div>
            <div className="flex items-center justify-between" data-testid="setting-sms">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="sms-notifications">SMS Notifications</Label>
              </div>
              <Switch 
                id="sms-notifications" 
                checked={subscription.reminderChannels.includes('sms')}
              />
            </div>
            <div className="flex items-center justify-between" data-testid="setting-whatsapp">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="whatsapp-notifications">WhatsApp Notifications</Label>
              </div>
              <Switch 
                id="whatsapp-notifications" 
                checked={subscription.reminderChannels.includes('whatsapp')}
              />
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Reminders are sent 7 days before each advance tax due date
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-past-reminders">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Past Reminders
          </CardTitle>
          <CardDescription>History of your tax reminders</CardDescription>
        </CardHeader>
        <CardContent>
          {remindersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : pastReminders.length > 0 ? (
            <div className="space-y-3">
              {pastReminders.map((reminder) => (
                <div 
                  key={reminder.id}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  data-testid={`past-reminder-${reminder.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      reminder.status === 'paid' ? 'bg-green-100' : 
                      reminder.status === 'sent' ? 'bg-blue-100' : 'bg-muted'
                    }`}>
                      {reminder.status === 'paid' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : reminder.status === 'sent' ? (
                        <Bell className="h-4 w-4 text-blue-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {reminder.quarter} - FY {reminder.financialYear}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Due: {new Date(reminder.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-foreground">
                      ₹{parseFloat(reminder.totalTaxLiability).toLocaleString()}
                    </div>
                    <Badge variant={reminder.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                      {reminder.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No past reminders yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
