import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Bell,
  Calendar,
  CheckCircle,
  Mail,
  MessageSquare,
  Receipt,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  Loader2
} from "lucide-react";
import { useLocation } from "wouter";
import { loadStripe } from "@stripe/stripe-js";

interface PricingTier {
  id: string;
  formType: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  recommended?: boolean;
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

const PRICING_TIERS: PricingTier[] = [
  {
    id: "itr1",
    formType: "ITR-1",
    name: "ITR-1 (Sahaj)",
    price: 299,
    description: "For salaried individuals",
    features: [
      "Income from salary/pension",
      "One house property",
      "Other sources (interest, etc.)",
      "Quarterly advance tax reminders",
      "Email & SMS notifications"
    ]
  },
  {
    id: "itr2",
    formType: "ITR-2",
    name: "ITR-2",
    price: 599,
    description: "For capital gains & multiple properties",
    features: [
      "Multiple house properties",
      "Capital gains tracking",
      "Foreign income/assets",
      "Quarterly advance tax reminders",
      "Email, SMS & WhatsApp alerts",
      "Tax liability breakdown"
    ],
    recommended: true
  },
  {
    id: "itr3",
    formType: "ITR-3",
    name: "ITR-3",
    price: 1299,
    description: "For business & professional income",
    features: [
      "Business/professional income",
      "Partnership firms",
      "Presumptive taxation",
      "Quarterly advance tax reminders",
      "All notification channels",
      "Tax liability breakdown",
      "Challan generation assistance"
    ]
  },
  {
    id: "itr4plus",
    formType: "ITR-4+",
    name: "ITR-4+",
    price: 1999,
    description: "For complex returns",
    features: [
      "Complex returns (ITR-4, 5, 6, 7)",
      "Trusts, companies, political parties",
      "Quarterly advance tax reminders",
      "Priority notifications",
      "Tax liability breakdown",
      "Challan generation assistance",
      "Dedicated tax consultant support"
    ]
  }
];

const ADVANCE_TAX_DATES = [
  { quarter: "Q1", date: "June 15", percentage: "15%" },
  { quarter: "Q2", date: "Sept 15", percentage: "45%" },
  { quarter: "Q3", date: "Dec 15", percentage: "75%" },
  { quarter: "Q4", date: "March 15", percentage: "100%" }
];

export default function TaxReminderSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const { data: subscription, isLoading: subscriptionLoading } = useQuery<UserSubscription>({
    queryKey: ['/api/tax/reminder-subscription', user?.id],
    enabled: !!user
  });

  const { data: hasExpertFiling, isLoading: expertFilingLoading } = useQuery<{ hasExpertFiling: boolean }>({
    queryKey: ['/api/tax/check-expert-filing', user?.id],
    enabled: !!user
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const sessionId = searchParams.get('session_id');

    if (success === 'true') {
      toast({
        title: "Payment Successful!",
        description: "Your tax reminder subscription has been activated. Quarterly reminders have been generated.",
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tax/reminder-subscription'] });
      window.history.replaceState({}, '', '/tax-reminder-subscription');
    } else if (canceled === 'true') {
      toast({
        title: "Payment Canceled",
        description: "You can retry payment whenever you're ready.",
        variant: "default",
      });
      window.history.replaceState({}, '', '/tax-reminder-subscription');
    }
  }, [toast]);

  const subscriptionMutation = useMutation({
    mutationFn: (data: { itrFormType: string; pricingTier: string; annualPrice: number; isFree: boolean }) =>
      apiRequest('POST', '/api/tax/reminder-subscription', { body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax/reminder-subscription'] });
      toast({
        title: "Subscription Activated",
        description: "Your tax reminder service is now active!"
      });
      setSelectedTier(null);
    },
    onError: () => {
      toast({
        title: "Subscription Failed",
        description: "Failed to activate subscription. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubscribe = (tier: PricingTier) => {
    if (subscription) {
      toast({
        title: "Already Subscribed",
        description: "You already have an active subscription.",
        variant: "default"
      });
      return;
    }

    const isFree = hasExpertFiling?.hasExpertFiling || false;

    if (isFree) {
      subscriptionMutation.mutate({
        itrFormType: tier.formType,
        pricingTier: tier.id,
        annualPrice: 0,
        isFree: true
      });
    } else {
      setSelectedTier(tier);
    }
  };

  const handleStripeCheckout = async () => {
    if (!selectedTier || !user) return;

    setIsProcessingPayment(true);

    try {
      if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
        toast({
          title: "Payment Unavailable",
          description: "Stripe is not configured. Please contact support.",
          variant: "destructive"
        });
        setIsProcessingPayment(false);
        return;
      }

      const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);
      
      if (!stripe) {
        throw new Error('Failed to load Stripe');
      }

      const response = await apiRequest('POST', '/api/tax/create-checkout-session', {
        body: {
          userId: user.id,
          itrFormType: selectedTier.formType,
          annualPrice: selectedTier.price
        }
      });

      const { sessionId, url } = await response.json();

      if (url) {
        window.location.href = url;
      } else if (sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        
        if (error) {
          throw new Error(error.message || 'Failed to redirect to checkout');
        }
      }
    } catch (error) {
      console.error('Stripe checkout error:', error);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to initialize payment. Please try again.",
        variant: "destructive"
      });
      setIsProcessingPayment(false);
    }
  };

  if (subscriptionLoading || expertFilingLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl" data-testid="tax-reminder-subscription-page">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900 rounded-2xl p-8 mb-8">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid="badge-hero">
            <Sparkles className="h-3 w-3 mr-1" />
            Never Miss a Tax Deadline
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4" data-testid="heading-hero">
            Quarterly Capital Gains Tax Reminder Service
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Stay compliant with advance tax payments. Get timely reminders for STCG (20%) and LTCG (12.5% above ₹1.25L)
          </p>

          {hasExpertFiling?.hasExpertFiling && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 mb-6" data-testid="alert-free-tier">
              <Sparkles className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200 font-medium">
                🎉 FREE for Expert ITR Filing Subscribers - Enjoy complimentary tax reminder service!
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            {ADVANCE_TAX_DATES.map((date) => (
              <div
                key={date.quarter}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
                data-testid={`advance-tax-date-${date.quarter}`}
              >
                <div className="text-sm text-gray-600 dark:text-gray-400">{date.quarter}</div>
                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">{date.date}</div>
                <div className="text-xs text-blue-600 dark:text-blue-400">{date.percentage}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {subscription ? (
        <Card className="mb-8 border-green-200 dark:border-green-800" data-testid="card-active-subscription">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
              <CheckCircle className="h-5 w-5" />
              Active Subscription
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Your tax reminder service is currently active
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div data-testid="subscription-plan">
                <div className="text-sm text-gray-600 dark:text-gray-400">Plan</div>
                <div className="text-lg font-semibold">{subscription.itrFormType}</div>
              </div>
              <div data-testid="subscription-status">
                <div className="text-sm text-gray-600 dark:text-gray-400">Status</div>
                <div className="flex items-center gap-2">
                  <Badge variant={subscription.isFree ? "default" : "secondary"}>
                    {subscription.isFree ? "Free Tier" : "Paid"}
                  </Badge>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {subscription.subscriptionStatus}
                  </Badge>
                </div>
              </div>
              <div data-testid="subscription-validity">
                <div className="text-sm text-gray-600 dark:text-gray-400">Valid Until</div>
                <div className="text-lg font-semibold">
                  {new Date(subscription.validUntil).toLocaleDateString()}
                </div>
              </div>
            </div>
            <Button
              onClick={() => setLocation('/intelligent-tax-hub')}
              className="mt-6"
              data-testid="button-view-dashboard"
            >
              View Dashboard
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div>
          <h2 className="text-3xl font-bold text-center mb-8" data-testid="heading-pricing">
            Choose Your Plan
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className={`relative ${
                  tier.recommended
                    ? 'border-2 border-blue-500 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                data-testid={`pricing-card-${tier.id}`}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white" data-testid="badge-recommended">
                      Recommended
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="mt-4">
                    {hasExpertFiling?.hasExpertFiling ? (
                      <div>
                        <div className="text-3xl font-bold text-green-600">FREE</div>
                        <div className="text-sm text-gray-600 line-through">₹{tier.price}/year</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-3xl font-bold">₹{tier.price}</div>
                        <div className="text-sm text-gray-600">/year</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleSubscribe(tier)}
                    disabled={subscriptionMutation.isPending}
                    className="w-full"
                    variant={tier.recommended ? "default" : "outline"}
                    data-testid={`button-subscribe-${tier.id}`}
                  >
                    {subscriptionMutation.isPending ? "Processing..." : "Subscribe Now"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card data-testid="feature-card-reminders">
          <CardHeader>
            <Bell className="h-8 w-8 text-blue-500 mb-2" />
            <CardTitle>Quarterly Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Receive timely alerts before each advance tax deadline - June 15, Sept 15, Dec 15, and March 15
            </p>
          </CardContent>
        </Card>

        <Card data-testid="feature-card-calculation">
          <CardHeader>
            <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
            <CardTitle>Auto Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Automatic capital gains calculation based on your portfolio holdings and transactions
            </p>
          </CardContent>
        </Card>

        <Card data-testid="feature-card-channels">
          <CardHeader>
            <MessageSquare className="h-8 w-8 text-purple-500 mb-2" />
            <CardTitle>Multi-Channel Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Get notifications via Email, SMS, and WhatsApp to ensure you never miss a deadline
            </p>
          </CardContent>
        </Card>

        <Card data-testid="feature-card-breakdown">
          <CardHeader>
            <Receipt className="h-8 w-8 text-orange-500 mb-2" />
            <CardTitle>Tax Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Detailed breakdown of STCG and LTCG liabilities with section-wise calculations
            </p>
          </CardContent>
        </Card>

        <Card data-testid="feature-card-challan">
          <CardHeader>
            <Download className="h-8 w-8 text-red-500 mb-2" />
            <CardTitle>Challan Assistance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Step-by-step guidance for challan generation and online payment of advance tax
            </p>
          </CardContent>
        </Card>

        <Card data-testid="feature-card-compliance">
          <CardHeader>
            <Shield className="h-8 w-8 text-indigo-500 mb-2" />
            <CardTitle>Stay Compliant</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Avoid interest penalties under section 234B and 234C by paying advance tax on time
            </p>
          </CardContent>
        </Card>
      </div>

      {selectedTier && !hasExpertFiling?.hasExpertFiling && (
        <Card className="border-blue-200 dark:border-blue-800" data-testid="card-payment-checkout">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Complete Your Subscription
            </CardTitle>
            <CardDescription>
              You selected {selectedTier.name} - ₹{selectedTier.price}/year
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Alert data-testid="alert-payment-info">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your subscription will be activated immediately after successful payment.
                  You will start receiving quarterly reminders for advance tax payments.
                </AlertDescription>
              </Alert>
              <div className="flex gap-4">
                <Button
                  onClick={handleStripeCheckout}
                  disabled={isProcessingPayment || subscriptionMutation.isPending}
                  className="flex-1"
                  data-testid="button-proceed-payment"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : (
                    "Proceed to Payment"
                  )}
                </Button>
                <Button
                  onClick={() => setSelectedTier(null)}
                  variant="outline"
                  disabled={isProcessingPayment || subscriptionMutation.isPending}
                  data-testid="button-cancel-payment"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
