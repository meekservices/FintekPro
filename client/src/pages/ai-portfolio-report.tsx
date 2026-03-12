import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  Download, 
  Share2, 
  Calendar,
  TrendingUp,
  TrendingDown,
  PieChart,
  Target,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ArrowUp,
  ArrowDown,
  FileText,
  RefreshCw,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface AIInsight {
  category: 'strength' | 'opportunity' | 'risk' | 'action';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export default function AIPortfolioReport() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: insightsData, isLoading: isLoadingInsights, refetch } = useQuery<AIInsight[]>({
    queryKey: ['/api/portfolio/ai-insights'],
    enabled: isAuthenticated,
  });

  const insights = insightsData || [];
  const reportGenerated = insights.length > 0;

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      await refetch();
      toast({
        title: "Report Generated",
        description: "Your AI-powered portfolio analysis is ready.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'strength': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'opportunity': return <Lightbulb className="h-5 w-5 text-blue-600" />;
      case 'risk': return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'action': return <Target className="h-5 w-5 text-purple-600" />;
      default: return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength': return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'opportunity': return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      case 'risk': return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
      case 'action': return 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800';
      default: return '';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Sparkles className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to generate AI portfolio reports.</p>
            <Link href="/auth">
              <Button data-testid="report-login-btn">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6" data-testid="ai-portfolio-report-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            AI Portfolio Report
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered insights and recommendations for your portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="share-report-btn">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" data-testid="download-report-btn">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button onClick={handleGenerateReport} disabled={isGenerating} data-testid="generate-report-btn">
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {isGenerating && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <Bot className="h-8 w-8 text-purple-500 animate-pulse" />
              <div className="flex-1">
                <p className="font-medium">Analyzing your portfolio with AI...</p>
                <p className="text-sm text-muted-foreground">This may take a few moments</p>
              </div>
            </div>
            <Progress value={65} className="h-2" />
          </CardContent>
        </Card>
      )}

      {reportGenerated && !isGenerating && (
        <>
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="h-6 w-6 text-purple-600" />
                <Badge variant="secondary">Powered by Google Gemini</Badge>
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  December 2024
                </Badge>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-lg">
                  Based on my analysis of your portfolio, you have a <span className="font-semibold text-green-600">well-balanced</span> investment strategy 
                  with a few areas for optimization. Your portfolio has grown <span className="font-semibold text-green-600">+18.5%</span> this year, 
                  outperforming the NIFTY 50 by 3.2%. Here are my key findings and recommendations:
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Portfolio Health</p>
                <p className="text-3xl font-bold text-green-600">85/100</p>
                <Badge className="mt-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Excellent</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Risk Score</p>
                <p className="text-3xl font-bold text-yellow-600">62/100</p>
                <Badge className="mt-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">Moderate</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Goal Alignment</p>
                <p className="text-3xl font-bold text-blue-600">78%</p>
                <Badge className="mt-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">On Track</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Tax Efficiency</p>
                <p className="text-3xl font-bold text-purple-600">91%</p>
                <Badge className="mt-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">Optimal</Badge>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="insights" className="space-y-6">
            <TabsList>
              <TabsTrigger value="insights" data-testid="insights-tab">
                <Lightbulb className="h-4 w-4 mr-2" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="performance" data-testid="performance-tab">
                <TrendingUp className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="recommendations-tab">
                <Target className="h-4 w-4 mr-2" />
                Actions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, idx) => (
                  <Card 
                    key={idx} 
                    className={`border ${getCategoryColor(insight.category)}`}
                    data-testid={`insight-${idx}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {getCategoryIcon(insight.category)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold">{insight.title}</p>
                            <Badge variant="outline" className={
                              insight.impact === 'high' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' :
                              insight.impact === 'medium' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                              'bg-muted text-muted-foreground'
                            }>
                              {(insight.impact || 'low').toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                          <ArrowUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Portfolio Return</p>
                          <p className="text-sm text-muted-foreground">vs NIFTY 50: +3.2%</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-green-600">+18.5%</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
                          <PieChart className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Sharpe Ratio</p>
                          <p className="text-sm text-muted-foreground">Risk-adjusted return</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">1.42</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded">
                          <TrendingDown className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium">Max Drawdown</p>
                          <p className="text-sm text-muted-foreground">Largest peak-to-trough decline</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-orange-600">-8.3%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Recommended Actions
                  </CardTitle>
                  <CardDescription>AI-generated action items for your portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.filter(i => i.category === 'action' || i.category === 'opportunity').map((action, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getCategoryIcon(action.category)}
                          <div>
                            <p className="font-medium">{action.title}</p>
                            <p className="text-sm text-muted-foreground">{action.description}</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" data-testid={`action-btn-${idx}`}>
                          Take Action
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
