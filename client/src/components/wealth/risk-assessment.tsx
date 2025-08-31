import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  TrendingUp, 
  Target,
  AlertTriangle,
  CheckCircle,
  PieChart,
  BarChart3,
  Zap,
  Calculator,
  Clock
} from "lucide-react";

interface RiskQuestion {
  id: string;
  question: string;
  options: { value: string; label: string; score: number }[];
}

interface InvestmentRecommendation {
  category: string;
  instruments: string[];
  allocation: number;
  riskLevel: string;
  expectedReturn: string;
  liquidity: string;
}

const riskQuestions: RiskQuestion[] = [
  {
    id: "1",
    question: "What is your investment experience?",
    options: [
      { value: "beginner", label: "Beginner - Just starting out", score: 1 },
      { value: "some", label: "Some experience with basic investments", score: 2 },
      { value: "experienced", label: "Experienced with various investment types", score: 3 },
      { value: "expert", label: "Expert with complex investment strategies", score: 4 }
    ]
  },
  {
    id: "2", 
    question: "How would you react to a 20% drop in your portfolio value?",
    options: [
      { value: "panic", label: "Panic and sell immediately", score: 1 },
      { value: "concerned", label: "Very concerned but hold", score: 2 },
      { value: "wait", label: "Wait for recovery", score: 3 },
      { value: "buy_more", label: "See it as buying opportunity", score: 4 }
    ]
  },
  {
    id: "3",
    question: "What is your investment time horizon?",
    options: [
      { value: "short", label: "Less than 3 years", score: 1 },
      { value: "medium", label: "3-7 years", score: 2 },
      { value: "long", label: "7-15 years", score: 3 },
      { value: "very_long", label: "More than 15 years", score: 4 }
    ]
  },
  {
    id: "4",
    question: "What percentage of your income can you invest?",
    options: [
      { value: "low", label: "Less than 10%", score: 1 },
      { value: "moderate", label: "10-20%", score: 2 },
      { value: "high", label: "20-30%", score: 3 },
      { value: "very_high", label: "More than 30%", score: 4 }
    ]
  },
  {
    id: "5",
    question: "Your primary investment goal is:",
    options: [
      { value: "preservation", label: "Capital preservation", score: 1 },
      { value: "income", label: "Regular income generation", score: 2 },
      { value: "growth", label: "Long-term wealth creation", score: 3 },
      { value: "aggressive_growth", label: "Aggressive wealth multiplication", score: 4 }
    ]
  }
];

export function RiskAssessment() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [riskScore, setRiskScore] = useState(0);

  const calculateRiskProfile = () => {
    const totalScore = Object.entries(answers).reduce((sum, [questionId, answer]) => {
      const question = riskQuestions.find(q => q.id === questionId);
      const option = question?.options.find(o => o.value === answer);
      return sum + (option?.score || 0);
    }, 0);

    setRiskScore(totalScore);

    if (totalScore <= 8) {
      setRiskProfile('conservative');
    } else if (totalScore <= 15) {
      setRiskProfile('moderate');
    } else {
      setRiskProfile('aggressive');
    }

    setShowResults(true);
  };

  const getInvestmentRecommendations = (): InvestmentRecommendation[] => {
    if (riskProfile === 'conservative') {
      return [
        {
          category: "Fixed Income",
          instruments: ["PPF", "NSC", "Bank FDs", "Conservative Hybrid Funds"],
          allocation: 60,
          riskLevel: "Low",
          expectedReturn: "7-9%",
          liquidity: "Low to Medium"
        },
        {
          category: "Equity - Large Cap", 
          instruments: ["Large Cap Mutual Funds", "Index Funds", "Blue Chip Stocks"],
          allocation: 30,
          riskLevel: "Medium",
          expectedReturn: "10-12%",
          liquidity: "High"
        },
        {
          category: "Gold",
          instruments: ["Gold ETFs", "Gold Mutual Funds", "Digital Gold"],
          allocation: 10,
          riskLevel: "Low",
          expectedReturn: "8-10%",
          liquidity: "High"
        }
      ];
    } else if (riskProfile === 'moderate') {
      return [
        {
          category: "Equity - Diversified",
          instruments: ["Flexi Cap Funds", "Large Cap Funds", "Mid Cap Funds"],
          allocation: 60,
          riskLevel: "Medium",
          expectedReturn: "12-15%",
          liquidity: "High"
        },
        {
          category: "Fixed Income",
          instruments: ["Balanced Funds", "Corporate Bond Funds", "Medium Duration Funds"],
          allocation: 30,
          riskLevel: "Low to Medium",
          expectedReturn: "8-10%",
          liquidity: "Medium"
        },
        {
          category: "Alternative Investments",
          instruments: ["REITs", "Gold ETFs", "International Funds"],
          allocation: 10,
          riskLevel: "Medium",
          expectedReturn: "10-12%",
          liquidity: "Medium"
        }
      ];
    } else {
      return [
        {
          category: "High Growth Equity",
          instruments: ["Small Cap Funds", "Mid Cap Funds", "Sectoral Funds", "Thematic Funds"],
          allocation: 70,
          riskLevel: "High",
          expectedReturn: "15-20%",
          liquidity: "High"
        },
        {
          category: "Emerging Markets",
          instruments: ["International Funds", "Emerging Market Funds", "Technology Funds"],
          allocation: 20,
          riskLevel: "High",
          expectedReturn: "12-18%",
          liquidity: "Medium"
        },
        {
          category: "Alternative Assets",
          instruments: ["REITs", "AIFs", "PMS", "Crypto (through MFs)"],
          allocation: 10,
          riskLevel: "Very High",
          expectedReturn: "15-25%",
          liquidity: "Low to Medium"
        }
      ];
    }
  };

  const getRiskProfileDescription = () => {
    switch (riskProfile) {
      case 'conservative':
        return {
          title: "Conservative Investor",
          description: "You prioritize capital preservation over growth. You prefer stable, predictable returns even if they are lower.",
          characteristics: ["Low risk tolerance", "Prefers guaranteed returns", "Short to medium investment horizon", "Values liquidity"],
          color: "green"
        };
      case 'moderate':
        return {
          title: "Moderate Investor", 
          description: "You seek balanced growth with reasonable risk. You can tolerate some volatility for better returns.",
          characteristics: ["Moderate risk tolerance", "Balanced approach", "Medium to long investment horizon", "Comfortable with some volatility"],
          color: "blue"
        };
      case 'aggressive':
        return {
          title: "Aggressive Investor",
          description: "You prioritize wealth creation and can handle significant volatility for higher potential returns.",
          characteristics: ["High risk tolerance", "Growth focused", "Long investment horizon", "Can handle market volatility"],
          color: "purple"
        };
    }
  };

  const allQuestionsAnswered = riskQuestions.every(q => answers[q.id]);
  const profileInfo = getRiskProfileDescription();
  const recommendations = getInvestmentRecommendations();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Risk Profile Assessment</h2>
        <p className="text-muted-foreground">Discover your investment personality and get personalized recommendations</p>
      </div>

      {!showResults ? (
        <Card data-testid="card-risk-questionnaire">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Investment Risk Questionnaire
            </CardTitle>
            <CardDescription>Answer these questions to determine your ideal investment strategy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {riskQuestions.map((question, questionIndex) => (
              <div key={question.id} className="space-y-3" data-testid={`question-${question.id}`}>
                <Label className="text-base font-medium">
                  {questionIndex + 1}. {question.question}
                </Label>
                <RadioGroup
                  value={answers[question.id] || ""}
                  onValueChange={(value) => setAnswers({...answers, [question.id]: value})}
                >
                  {question.options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} data-testid={`option-${question.id}-${option.value}`} />
                      <Label htmlFor={option.value} className="cursor-pointer">{option.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}

            <Button 
              onClick={calculateRiskProfile}
              disabled={!allQuestionsAnswered}
              className="w-full"
              data-testid="button-calculate-risk-profile"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculate My Risk Profile
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Risk Profile Result */}
          <Card data-testid="card-risk-profile-result">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className={`w-5 h-5 text-${profileInfo.color}-600`} />
                Your Risk Profile: {profileInfo.title}
              </CardTitle>
              <CardDescription>{profileInfo.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Risk Score</span>
                  <Badge variant={profileInfo.color === 'green' ? 'secondary' : profileInfo.color === 'blue' ? 'default' : 'destructive'}>
                    {riskScore} / 20
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <Label>Key Characteristics</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {profileInfo.characteristics.map((char, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded" data-testid={`characteristic-${index}`}>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{char}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  onClick={() => setShowResults(false)}
                  data-testid="button-retake-assessment"
                >
                  Retake Assessment
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Investment Recommendations */}
          <Card data-testid="card-investment-recommendations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                Personalized Investment Recommendations
              </CardTitle>
              <CardDescription>Based on your {profileInfo.title.toLowerCase()} risk profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Asset Allocation Chart */}
                <div className="space-y-4">
                  <h4 className="font-medium">Recommended Asset Allocation</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recommendations.map((rec, index) => (
                      <div key={index} className="text-center p-4 border rounded-lg" data-testid={`allocation-${index}`}>
                        <div className="text-2xl font-bold text-blue-600">{rec.allocation}%</div>
                        <div className="font-medium">{rec.category}</div>
                        <div className="text-xs text-muted-foreground mt-1">{rec.expectedReturn} returns</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Recommendations */}
                <div className="space-y-4">
                  <h4 className="font-medium">Investment Instruments</h4>
                  <div className="space-y-3">
                    {recommendations.map((rec, index) => (
                      <Card key={index} className="p-4" data-testid={`recommendation-${index}`}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                rec.riskLevel === 'Low' ? 'bg-green-100 text-green-600' :
                                rec.riskLevel === 'Medium' ? 'bg-blue-100 text-blue-600' :
                                rec.riskLevel === 'High' ? 'bg-orange-100 text-orange-600' :
                                'bg-red-100 text-red-600'
                              }`}>
                                {rec.riskLevel === 'Low' ? <Shield className="w-4 h-4" /> :
                                 rec.riskLevel === 'Medium' ? <BarChart3 className="w-4 h-4" /> :
                                 rec.riskLevel === 'High' ? <TrendingUp className="w-4 h-4" /> :
                                 <Zap className="w-4 h-4" />}
                              </div>
                              <div>
                                <h5 className="font-medium">{rec.category}</h5>
                                <p className="text-sm text-muted-foreground">{rec.allocation}% allocation</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{rec.riskLevel} Risk</Badge>
                              <p className="text-sm text-muted-foreground mt-1">{rec.expectedReturn}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Recommended Instruments:</Label>
                            <div className="flex flex-wrap gap-2">
                              {rec.instruments.map((instrument, instIndex) => (
                                <Badge key={instIndex} variant="secondary" className="text-xs" data-testid={`instrument-${index}-${instIndex}`}>
                                  {instrument}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Expected Returns:</span>
                              <span className="font-medium">{rec.expectedReturn}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Liquidity:</span>
                              <span className="font-medium">{rec.liquidity}</span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Risk Management Tips */}
                <Card data-testid="card-risk-management-tips">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Risk Management Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {riskProfile === 'conservative' && (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Focus on Capital Protection</p>
                              <p className="text-sm text-muted-foreground">Prioritize government securities and high-grade corporate bonds</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Emergency Fund Priority</p>
                              <p className="text-sm text-muted-foreground">Maintain 12 months of expenses in liquid funds</p>
                            </div>
                          </div>
                        </>
                      )}

                      {riskProfile === 'moderate' && (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                            <Target className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Balanced Diversification</p>
                              <p className="text-sm text-muted-foreground">Mix growth and stability with 60:40 equity to debt ratio</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
                            <PieChart className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Regular Portfolio Review</p>
                              <p className="text-sm text-muted-foreground">Rebalance annually to maintain target allocation</p>
                            </div>
                          </div>
                        </>
                      )}

                      {riskProfile === 'aggressive' && (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Growth-Oriented Strategy</p>
                              <p className="text-sm text-muted-foreground">Focus on equity and growth assets for wealth multiplication</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div>
                              <p className="font-medium">Volatility Management</p>
                              <p className="text-sm text-muted-foreground">Stay invested during market downturns, use SIP for rupee cost averaging</p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                        <Clock className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div>
                          <p className="font-medium">Long-term Perspective</p>
                          <p className="text-sm text-muted-foreground">Stick to your strategy and avoid emotional decisions based on short-term market movements</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Plan */}
                <Card data-testid="card-investment-action-plan">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-600" />
                      Your Investment Action Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h5 className="font-medium">Step 1: Emergency Fund</h5>
                          <p className="text-sm text-muted-foreground">Build 6-12 months of expenses in liquid funds before investing</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium">Step 2: Tax Planning</h5>
                          <p className="text-sm text-muted-foreground">Maximize ELSS and PPF contributions for tax benefits</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium">Step 3: Core Portfolio</h5>
                          <p className="text-sm text-muted-foreground">Start SIPs in recommended categories based on allocation</p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-medium">Step 4: Review & Rebalance</h5>
                          <p className="text-sm text-muted-foreground">Annual review and rebalancing to maintain target allocation</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button data-testid="button-start-sip">
                          <TrendingUp className="w-4 h-4 mr-2" />
                          Start SIP
                        </Button>
                        <Button variant="outline" data-testid="button-explore-funds">
                          <PieChart className="w-4 h-4 mr-2" />
                          Explore Funds
                        </Button>
                        <Button variant="outline" data-testid="button-book-consultation">
                          <Target className="w-4 h-4 mr-2" />
                          Book Consultation
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}