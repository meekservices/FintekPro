import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Lightbulb, 
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  PieChart,
  BarChart3
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { QuickInsights } from "@/components/portfolio/QuickInsights";

export default function PortfolioAIInsights() {
  const { user } = useAuth();

  const { data: insights, isLoading } = useQuery({
    queryKey: ['/api/ai/portfolio-insights'],
    enabled: !!user?.id,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['/api/ai/investment-recommendations'],
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-yellow-500" />
          AI Insights
        </h1>
        <p className="text-muted-foreground">AI-powered analysis of your portfolio and market opportunities</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Portfolio Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">Good</div>
            <p className="text-sm text-muted-foreground mt-1">Your portfolio is well-diversified</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Goal Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">72%</div>
            <p className="text-sm text-muted-foreground mt-1">On track to meet your goals</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">3</div>
            <p className="text-sm text-muted-foreground mt-1">Recommendations pending review</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Quick Insights
          </CardTitle>
          <CardDescription>AI-generated portfolio analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <QuickInsights />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Investment Opportunities
          </CardTitle>
          <CardDescription>AI-identified opportunities based on your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Increase Equity Allocation</p>
                  <p className="text-sm text-muted-foreground">Your equity allocation is below optimal for your age and risk profile</p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">High Impact</Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <PieChart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Diversify into International Funds</p>
                  <p className="text-sm text-muted-foreground">Add global exposure to reduce country-specific risk</p>
                </div>
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-600">Medium Impact</Badge>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Optimize Tax Efficiency</p>
                  <p className="text-sm text-muted-foreground">Consider tax-saving instruments to reduce tax liability</p>
                </div>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-600">Tax Saving</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
