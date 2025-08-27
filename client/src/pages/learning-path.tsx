import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { 
  BookOpen, 
  Trophy, 
  Target, 
  Clock, 
  Star, 
  TrendingUp,
  Users,
  Award,
  ChevronRight,
  Play,
  CheckCircle,
  Lock
} from "lucide-react";

type LearningModule = {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  orderIndex: number;
  estimatedMinutes: number;
  isActive: boolean;
  lessonsCount?: number;
  completedLessons?: number;
  progress?: number;
  isLocked?: boolean;
};

type UserStats = {
  totalPoints: number;
  currentStreak: number;
  maxStreak: number;
  modulesCompleted: number;
  lessonsCompleted: number;
  averageScore: number;
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'basics': return <BookOpen className="h-5 w-5" />;
    case 'trading': return <TrendingUp className="h-5 w-5" />;
    case 'risk-management': return <Target className="h-5 w-5" />;
    case 'market-analysis': return <Users className="h-5 w-5" />;
    default: return <BookOpen className="h-5 w-5" />;
  }
};

export default function LearningPath() {
  const { user, isAuthenticated } = useAuth();

  const { data: modules, isLoading: modulesLoading } = useQuery<LearningModule[]>({
    queryKey: ["/api/learning/modules"],
    enabled: !!user,
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/learning/stats"],
    enabled: !!user,
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Learning Path
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please sign in to access the gamified learning path for agricultural commodity trading
          </p>
          <Link href="/auth">
            <Button size="lg">
              Sign In to Continue
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (modulesLoading || statsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const overallProgress = modules ? 
    modules.reduce((acc, module) => acc + (module.progress || 0), 0) / modules.length : 0;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Agricultural Commodity Trading Learning Path
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Master the art of agricultural commodity trading through interactive lessons and gamified learning
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Trophy className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Points</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userStats?.totalPoints?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Streak</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userStats?.currentStreak || 0} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Lessons Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userStats?.lessonsCompleted || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Star className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Score</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userStats?.averageScore ? Math.round(Number(userStats.averageScore)) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Course Completion
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Learning Modules */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Learning Modules
        </h2>

        {modules && modules.length > 0 ? (
          <div className="space-y-4">
            {modules.map((module, index) => (
              <Card key={module.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`p-3 rounded-lg ${
                        module.progress === 100 
                          ? 'bg-green-100 dark:bg-green-900' 
                          : module.isLocked 
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        {module.progress === 100 ? (
                          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        ) : module.isLocked ? (
                          <Lock className="h-6 w-6 text-gray-400" />
                        ) : (
                          getCategoryIcon(module.category)
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {module.title}
                          </h3>
                          <Badge className={getDifficultyColor(module.difficulty)}>
                            {module.difficulty}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {module.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4" />
                            <span>{module.estimatedMinutes} min</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{module.lessonsCount || 0} lessons</span>
                          </div>
                          {module.completedLessons !== undefined && (
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>{module.completedLessons} completed</span>
                            </div>
                          )}
                        </div>
                        
                        {module.progress !== undefined && module.progress > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                Progress
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-white">
                                {Math.round(module.progress)}%
                              </span>
                            </div>
                            <Progress value={module.progress} className="h-1" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {module.isLocked ? (
                        <Button disabled variant="outline">
                          <Lock className="h-4 w-4 mr-2" />
                          Locked
                        </Button>
                      ) : (
                        <Link href={`/learning/module/${module.id}`}>
                          <Button 
                            className="min-w-[120px]"
                            data-testid={`button-start-module-${module.id}`}
                          >
                            {module.progress === 100 ? (
                              <>
                                <Award className="h-4 w-4 mr-2" />
                                Review
                              </>
                            ) : module.progress && module.progress > 0 ? (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Continue
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Start
                              </>
                            )}
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Learning Modules Available
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Learning modules are being prepared. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}