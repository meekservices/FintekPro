import { Trophy, TrendingUp, Target, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AchievementDashboard } from "@/components/achievements/achievement-dashboard";

export default function AchievementsPage() {
  // Mock user ID - in real app this would come from auth context
  const userId = 'mock-user-id';

  return (
    <div className="min-h-screen bg-muted" data-testid="achievements-page">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Trophy className="h-8 w-8 text-yellow-500 mr-3" />
            <h1 className="text-3xl font-bold text-foreground">Investment Learning Achievements</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Track your progress, unlock achievements, and compete with other investors on your learning journey.
          </p>
        </div>

        {/* Achievement Categories Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-green-700 dark:text-green-300">
                <TrendingUp className="h-5 w-5 mr-2" />
                Portfolio Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-600">
                Master the art of building and managing investment portfolios with diversification and risk management.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded">Asset Allocation</span>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded">Rebalancing</span>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded">Risk Assessment</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
                <Target className="h-5 w-5 mr-2" />
                Investment Learning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-600">
                Expand your knowledge through educational content, quizzes, and practical investment scenarios.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded">Market Basics</span>
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded">Analysis Tools</span>
                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded">Strategy Guide</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 dark:from-orange-950/30 to-red-50 dark:to-red-950/30 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-orange-700 dark:text-orange-300">
                <Zap className="h-5 w-5 mr-2" />
                Trading Excellence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-orange-600">
                Develop trading skills through practice trades, technical analysis, and market timing strategies.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs px-2 py-1 rounded">Technical Analysis</span>
                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs px-2 py-1 rounded">Paper Trading</span>
                <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs px-2 py-1 rounded">Market Timing</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 dark:from-purple-950/30 to-violet-50 dark:to-violet-950/30 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-purple-700 dark:text-purple-300">
                <Trophy className="h-5 w-5 mr-2" />
                Social Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-600">
                Share your achievements, engage with the community, and inspire others on their investment journey.
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded">Share Milestones</span>
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded">Community</span>
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-2 py-1 rounded">Mentoring</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Dashboard */}
        <AchievementDashboard userId={userId} />
      </div>
    </div>
  );
}