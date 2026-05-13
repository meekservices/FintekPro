import { useState, useEffect } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  LucideShield as LucideShield,
  Clock,
  Calculator,
  FileText,
  CheckCircle,
  AlertTriangle,
  Star,
  Home,
  Car,
  Building2,
  CreditCard,
  Briefcase,
  Target,
  User,
  DollarSign,
  PieChart,
  Activity,
  Award,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LoanRecommendation {
  loanType: 'personal' | 'home' | 'business' | 'car' | 'against_property' | 'against_securities';
  priority: 'high' | 'medium' | 'low';
  eligibilityScore: number;
  recommendedAmount: number;
  interestRate: number;
  tenure: number;
  emi: number;
  processingFee: number;
  lenderName: string;
  rationale: string;
  keyBenefits: string[];
  riskFactors: string[];
  actionRequired: string[];
  urgency: 'immediate' | 'within_month' | 'future_consideration';
  expectedApprovalTime: string;
  requiredDocuments: string[];
  specialOffers?: string[];
}

interface RecommendationData {
  recommendations: LoanRecommendation[];
  totalCount: number;
  highPriorityCount: number;
  generatedAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

function getLoanTypeIcon(loanType: string) {
  const icons = {
    personal: CreditCard,
    home: Home,
    business: Briefcase,
    car: Car,
    against_property: Building2,
    against_securities: TrendingUp
  };
  return icons[loanType as keyof typeof icons] || CreditCard;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
    case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700';
    default: return 'bg-muted text-foreground border-border';
  }
}

function getUrgencyColor(urgency: string) {
  switch (urgency) {
    case 'immediate': return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
    case 'within_month': return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300';
    case 'future_consideration': return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300';
    default: return 'bg-muted border-border text-muted-foreground';
  }
}

function LoanRecommendationCard({ recommendation, onApplyClick }: { 
  recommendation: LoanRecommendation; 
  onApplyClick: (recommendation: LoanRecommendation) => void;
}) {
  const LoanIcon = getLoanTypeIcon(recommendation.loanType);
  
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:bg-blue-800/30 transition-colors">
              <LoanIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-foreground capitalize">
                {recommendation.loanType.replace('_', ' ')} Loan
              </CardTitle>
              <CardDescription className="text-muted-foreground font-medium">
                {recommendation.lenderName}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Badge className={`${getPriorityColor(recommendation.priority)} border font-medium`}>
              {recommendation.priority.toUpperCase()} PRIORITY
            </Badge>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-current" />
              <span className="text-sm font-bold text-muted-foreground">
                {recommendation.eligibilityScore}/100
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-6">
        {/* Loan Details Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-card rounded-lg border border-border">
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(recommendation.recommendedAmount)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Loan Amount</div>
          </div>
          <div className="text-center p-3 bg-card rounded-lg border border-border">
            <div className="text-2xl font-bold text-green-600">
              {recommendation.interestRate.toFixed(2)}%
            </div>
            <div className="text-xs text-muted-foreground font-medium">Interest Rate</div>
          </div>
          <div className="text-center p-3 bg-card rounded-lg border border-border">
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(recommendation.emi)}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Monthly EMI</div>
          </div>
          <div className="text-center p-3 bg-card rounded-lg border border-border">
            <div className="text-2xl font-bold text-orange-600">
              {recommendation.tenure} months
            </div>
            <div className="text-xs text-muted-foreground font-medium">Tenure</div>
          </div>
        </div>

        {/* Rationale */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Why This Loan?
          </h4>
          <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">{recommendation.rationale}</p>
        </div>

        {/* Key Benefits */}
        <div>
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            Key Benefits
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recommendation.keyBenefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        {/* Urgency and Special Offers */}
        <div className="flex gap-4">
          <div className={`flex-1 p-3 rounded-lg border ${getUrgencyColor(recommendation.urgency)}`}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4" />
              <span className="font-semibold text-sm">Urgency</span>
            </div>
            <div className="text-sm capitalize">{recommendation.urgency.replace('_', ' ')}</div>
          </div>
          
          {recommendation.specialOffers && recommendation.specialOffers.length > 0 && (
            <div className="flex-1 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-green-600" />
                <span className="font-semibold text-sm text-green-800 dark:text-green-200">Special Offers</span>
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                {recommendation.specialOffers.join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            onClick={() => onApplyClick(recommendation)}
            data-testid={`apply-${recommendation.loanType}`}
          >
            <FileText className="w-4 h-4 mr-2" />
            Apply Now
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 hover:bg-muted"
            data-testid={`details-${recommendation.loanType}`}
          >
            <Calculator className="w-4 h-4 mr-2" />
            EMI Calculator
          </Button>
        </div>
        
        {/* Processing Info */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Expected approval time: {recommendation.expectedApprovalTime} • 
          Processing fee: {formatCurrency(recommendation.processingFee)}
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialProfileOverview() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Your Financial Profile
        </CardTitle>
        <CardDescription>
          AI-analyzed profile used for personalized loan recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Credit Health</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">CIBIL Score</span>
                  <span className="text-sm font-bold text-green-600">750</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">Credit Utilization</span>
                  <span className="text-sm font-bold text-blue-600">35%</span>
                </div>
                <Progress value={35} className="h-2" />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Income & EMIs</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Monthly Income</span>
                <span className="text-sm font-bold">₹1,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Existing EMIs</span>
                <span className="text-sm font-bold">₹25,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Available for EMI</span>
                <span className="text-sm font-bold text-green-600">₹45,000</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Assets & Liabilities</h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Net Worth</span>
                <span className="text-sm font-bold">₹20,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Assets</span>
                <span className="text-sm font-bold">₹15,00,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Liabilities</span>
                <span className="text-sm font-bold">₹5,00,000</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoanRecommendationsPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("all");
  const [, setLocation] = useLocation();
  
  const { data: recommendationData, isLoading, error, refetch } = useQuery<{ data: RecommendationData }>({
    queryKey: ['/api/loans/personalized-recommendations'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const trackRecommendationAction = useMutation({
    mutationFn: async (data: {
      recommendationId: string;
      action: 'view' | 'apply' | 'compare' | 'save' | 'dismiss';
      metadata?: any;
    }) => {
      return await apiRequest('/api/loans/track-recommendation', {
        method: 'POST',
        body: data
      });
    }
  });

  // Map lender display names to adapter names
  const getLenderAdapterName = (lenderName: string): string => {
    const lenderMapping: { [key: string]: string } = {
      'Bajaj Finance': 'bajaj_finance',
      'Bajaj Finserv': 'bajaj_finance', 
      'Tata Capital': 'tata_capital',
      'HDFC Bank': 'hdfc_bank',
      'ICICI Bank': 'icici_bank'
    };
    return lenderMapping[lenderName] || 'bajaj_finance'; // Default fallback
  };

  const handleApplyClick = (recommendation: LoanRecommendation) => {
    // Track apply action
    trackRecommendationAction.mutate({
      recommendationId: `${recommendation.loanType}-${recommendation.lenderName}`,
      action: 'apply',
      metadata: {
        amount: recommendation.recommendedAmount,
        rate: recommendation.interestRate,
        priority: recommendation.priority
      }
    });

    // Get the adapter name for routing
    const lenderAdapter = getLenderAdapterName(recommendation.lenderName);
    const recommendationId = `${recommendation.loanType}-${recommendation.lenderName}-${Date.now()}`;
    
    toast({
      title: "Application Started",
      description: `Redirecting to ${recommendation.lenderName} unified application for ${recommendation.loanType} loan.`,
    });
    
    // Navigate to unified partner application page
    setLocation(`/partner-application/${lenderAdapter}?recommendation=${recommendationId}&amount=${recommendation.recommendedAmount}&tenure=${recommendation.tenure}&type=${recommendation.loanType}`);
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Recommendations Updated",
      description: "Your loan recommendations have been refreshed based on latest data.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-48 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load loan recommendations. Please try again later.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const recommendations = recommendationData?.data?.recommendations || [];
  const filteredRecommendations = selectedTab === "all" 
    ? recommendations 
    : recommendations.filter(r => r.priority === selectedTab);

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Personalized Loan Recommendations
              </h1>
              <p className="text-xl text-muted-foreground">
                AI-powered loan suggestions tailored to your financial profile
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh} data-testid="refresh-recommendations">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          
          {recommendationData?.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {recommendationData.data.totalCount}
                      </div>
                      <div className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                        Total Recommendations
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-red-50 dark:from-red-950/30 to-pink-50 dark:to-pink-950/30 border-red-200 dark:border-red-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {recommendationData.data.highPriorityCount}
                      </div>
                      <div className="text-sm text-red-800 dark:text-red-200 font-medium">
                        High Priority
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                      <LucideShield className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        AI Powered
                      </div>
                      <div className="text-sm text-green-800 dark:text-green-200 font-medium">
                        Recommendation Engine
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Financial Profile Overview */}
        <FinancialProfileOverview />

        {/* Filter Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-6">
          <ScrollableTabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({recommendations.length})
            </TabsTrigger>
            <TabsTrigger value="high" data-testid="tab-high">
              High Priority ({recommendations.filter(r => r.priority === 'high').length})
            </TabsTrigger>
            <TabsTrigger value="medium" data-testid="tab-medium">
              Medium Priority ({recommendations.filter(r => r.priority === 'medium').length})
            </TabsTrigger>
            <TabsTrigger value="low" data-testid="tab-low">
              Low Priority ({recommendations.filter(r => r.priority === 'low').length})
            </TabsTrigger>
          </ScrollableTabsList>
        </Tabs>

        {/* Recommendations Grid */}
        {filteredRecommendations.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filteredRecommendations.map((recommendation, index) => (
              <LoanRecommendationCard
                key={`${recommendation.loanType}-${index}`}
                recommendation={recommendation}
                onApplyClick={handleApplyClick}
              />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No recommendations found
              </h3>
              <p className="text-muted-foreground">
                {selectedTab === "all" 
                  ? "Complete your financial profile to get personalized loan recommendations."
                  : `No ${selectedTab} priority recommendations available.`
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}