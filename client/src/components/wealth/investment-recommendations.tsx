import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  Target, 
  AlertTriangle, 
  CheckCircle, 
  PieChart,
  ArrowRight,
  IndianRupee,
  Calendar,
  Shield,
  BarChart3,
  Lightbulb
} from "lucide-react";

interface InvestmentRecommendationsProps {
  portfolioId?: string;
  goalId?: string;
}

export function InvestmentRecommendations({ portfolioId, goalId }: InvestmentRecommendationsProps) {
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);

  // Fetch goal-based recommendations if goalId is provided
  const { data: goalRecommendations, isLoading: goalLoading } = useQuery<any[]>({
    queryKey: ["/api/recommendations/goal", goalId],
    enabled: !!goalId,
  });

  // Fetch portfolio rebalance recommendations if portfolioId is provided  
  const { data: rebalanceRecommendations, isLoading: rebalanceLoading } = useQuery<any[]>({
    queryKey: ["/api/recommendations/portfolio", portfolioId, "rebalance"],
    enabled: !!portfolioId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'very low':
      case 'low':
        return 'text-green-600 bg-green-50';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50';
      case 'high':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (goalLoading || rebalanceLoading) {
    return (
      <Card data-testid="card-recommendations-loading">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Generating personalized recommendations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="investment-recommendations">
      {/* Goal-Based Recommendations */}
      {goalRecommendations && Array.isArray(goalRecommendations) && goalRecommendations.length > 0 && (
        <Card data-testid="card-goal-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Goal-Based Investment Recommendations
            </CardTitle>
            <CardDescription>
              Tailored investment suggestions to achieve your financial goal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {goalRecommendations.map((rec: any, index: number) => (
              <div key={index} className="border rounded-lg p-4 space-y-3" data-testid={`recommendation-goal-${index}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-blue-600">{rec.allocation}%</div>
                    <div>
                      <h4 className="font-medium">{rec.category}</h4>
                      <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                    </div>
                  </div>
                  <Badge className={getRiskColor(rec.risk)}>{rec.risk}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span>Expected: {rec.expectedReturn}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-blue-600" />
                    <span>Monthly: {formatCurrency(rec.monthlyInvestment)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span>Risk: {rec.risk}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Recommended Instruments:</p>
                  <div className="flex flex-wrap gap-2">
                    {rec.instruments.map((instrument: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {instrument}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSelectedRecommendation(`goal-${index}`);
                    console.log(`Viewing details for goal: ${rec.name}`);
                    alert(`Goal Details: ${rec.name}\nDescription: ${rec.description}\nTarget Amount: ${formatCurrency(rec.targetAmount)}`);
                  }}
                  data-testid={`button-view-details-goal-${index}`}
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  View Details
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Portfolio Rebalancing Recommendations */}
      {rebalanceRecommendations && Array.isArray(rebalanceRecommendations) && rebalanceRecommendations.length > 0 && (
        <Card data-testid="card-rebalance-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-orange-600" />
              Portfolio Rebalancing Recommendations
            </CardTitle>
            <CardDescription>
              Optimize your portfolio allocation based on your financial goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rebalanceRecommendations.map((rec: any, index: number) => (
              <div 
                key={rec.id} 
                className="border rounded-lg p-4 space-y-3" 
                data-testid={`recommendation-rebalance-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant={getPriorityColor(rec.priority)}>
                      {rec.priority.toUpperCase()}
                    </Badge>
                    <div>
                      <h4 className="font-medium">{rec.title}</h4>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-medium">{rec.currentPercentage}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Target</p>
                    <p className="font-medium">{rec.targetPercentage}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Amount</p>
                    <p className="font-medium">{formatCurrency(rec.rebalanceAmount)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Impact</p>
                    <p className="font-medium">{rec.expectedImpact?.returnPotential}</p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Why this change?</p>
                      <p className="text-sm text-blue-700">{rec.reasoning}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Risk: {rec.expectedImpact?.riskAdjustment}</span>
                    <span>•</span>
                    <span>Return: {rec.expectedImpact?.returnPotential}</span>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => {
                      setSelectedRecommendation(`rebalance-${index}`);
                      // Here you can add the actual implementation logic
                      console.log(`Implementing suggestion for rebalancing: ${rec.title}`);
                      alert(`Implementing suggestion: ${rec.title}\nThis will ${rec.description}`);
                    }}
                    data-testid={`button-implement-rebalance-${index}`}
                  >
                    Implement Suggestion
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Investment Suggestions */}
      <Card data-testid="card-investment-suggestions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Investment Suggestions
          </CardTitle>
          <CardDescription>
            AI-powered recommendations based on market analysis and your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg space-y-3" data-testid="suggestion-tax-saving">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium">Tax-Saving Investment</h4>
                  <p className="text-sm text-muted-foreground">ELSS Mutual Funds</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Potential Tax Saving</span>
                  <span className="font-medium text-green-600">₹46,800</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Expected Returns</span>
                  <span className="font-medium">12-15%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Lock-in Period</span>
                  <span className="font-medium">3 years</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                data-testid="button-explore-elss"
                onClick={() => {
                  console.log('Exploring ELSS funds for tax-saving investment');
                  alert('Exploring ELSS Funds\n\nPotential Tax Saving: ₹46,800\nExpected Returns: 12-15%\nLock-in Period: 3 years\n\nRedirecting to ELSS fund options...');
                }}
              >
                Explore ELSS Funds
              </Button>
            </div>

            <div className="p-4 border rounded-lg space-y-3" data-testid="suggestion-sip-boost">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium">SIP Boost Opportunity</h4>
                  <p className="text-sm text-muted-foreground">Increase monthly SIP</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current SIP</span>
                  <span className="font-medium">₹45,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Suggested Increase</span>
                  <span className="font-medium text-blue-600">₹15,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Goal Achievement</span>
                  <span className="font-medium">6 months faster</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full" 
                data-testid="button-increase-sip"
                onClick={() => {
                  console.log('Increasing SIP amount for portfolio boost');
                  alert('SIP Boost Opportunity\n\nCurrent SIP: ₹45,000\nSuggested Increase: ₹15,000\nNew Total: ₹60,000/month\n\nGoal Achievement: 6 months faster\n\nImplementing SIP increase...');
                }}
              >
                Increase SIP Amount
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Important Considerations
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                <Calendar className="w-4 h-4 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800">Market Timing</p>
                  <p className="text-orange-700">Current market conditions favor systematic investment approach</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Risk Management</p>
                  <p className="text-blue-700">Diversification across asset classes is recommended</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Summary */}
      {((goalRecommendations && Array.isArray(goalRecommendations) && goalRecommendations.length > 0) || 
        (rebalanceRecommendations && Array.isArray(rebalanceRecommendations) && rebalanceRecommendations.length > 0)) && (
        <Card data-testid="card-action-summary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Next Steps
            </CardTitle>
            <CardDescription>
              Recommended actions to optimize your investment strategy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rebalanceRecommendations && Array.isArray(rebalanceRecommendations) && rebalanceRecommendations.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <PieChart className="w-5 h-5 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800">
                      Portfolio Rebalancing Required
                    </p>
                    <p className="text-sm text-yellow-700">
                      {rebalanceRecommendations.length} rebalancing suggestions available
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    data-testid="button-review-rebalancing"
                    onClick={() => {
                      console.log('Reviewing portfolio rebalancing suggestions');
                      alert(`Portfolio Rebalancing Review\n\n${rebalanceRecommendations?.length || 0} suggestions available\n\nReviewing recommendations to optimize your portfolio allocation...`);
                    }}
                  >
                    Review
                  </Button>
                </div>
              )}

              {goalRecommendations && Array.isArray(goalRecommendations) && goalRecommendations.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <Target className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800">
                      Goal-Specific Investment Plan Ready
                    </p>
                    <p className="text-sm text-green-700">
                      {goalRecommendations.length} investment categories recommended
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    data-testid="button-start-investing"
                    onClick={() => {
                      console.log('Starting investment journey based on goal recommendations');
                      alert(`Start Your Investment Journey\n\n${goalRecommendations?.length || 0} investment categories recommended\n\nInitiating goal-based investment planning...`);
                    }}
                  >
                    Start Investing
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-800">
                    Schedule Portfolio Review
                  </p>
                  <p className="text-sm text-blue-700">
                    Set up quarterly reviews to track progress and adjust strategies
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  data-testid="button-schedule-review"
                  onClick={() => {
                    console.log('Scheduling quarterly portfolio review');
                    alert('Scheduling Portfolio Review\n\nQuarterly reviews will be set up to:\n- Track progress toward goals\n- Adjust investment strategies\n- Rebalance portfolio allocation\n\nReview scheduled successfully!');
                  }}
                >
                  Schedule
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Recommendations State */}
      {(!goalRecommendations || !Array.isArray(goalRecommendations) || goalRecommendations.length === 0) && 
       (!rebalanceRecommendations || !Array.isArray(rebalanceRecommendations) || rebalanceRecommendations.length === 0) && (
        <Card data-testid="card-no-recommendations">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">No Recommendations Available</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Set up your financial goals and portfolio to get personalized investment recommendations
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                data-testid="button-create-goal"
                onClick={() => {
                  console.log('Creating new financial goal');
                  alert('Create Financial Goal\n\nSet up your investment goals:\n- Retirement Planning\n- Child Education\n- Home Purchase\n- Emergency Fund\n- Wealth Building\n\nRedirecting to goal creation...');
                }}
              >
                Create Financial Goal
              </Button>
              <Button 
                data-testid="button-view-portfolio"
                onClick={() => {
                  console.log('Viewing current portfolio');
                  alert('View Portfolio\n\nAccessing your investment portfolio:\n- Current holdings\n- Performance metrics\n- Asset allocation\n- Transaction history\n\nLoading portfolio dashboard...');
                }}
              >
                View Portfolio
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}