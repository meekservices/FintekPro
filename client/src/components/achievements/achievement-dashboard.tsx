import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from '@/components/ScrollableTabsList';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  Trophy,
  Target,
  Star,
  Crown,
  Medal,
  Award,
  TrendingUp,
  BookOpen,
  IndianRupee,
  Users,
  Share2,
  Zap,
  Flame
} from 'lucide-react';
import { SocialSharing } from '@/components/social-sharing';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  badgeImage?: string;
  points: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  categoryId: string;
  category: {
    name: string;
    color?: string;
    icon?: string;
  };
  shareTemplate?: string;
  isActive: boolean;
}

interface UserAchievement {
  id: string;
  achievementId: string;
  userId: string;
  earnedAt: string;
  progress: number;
  isCompleted: boolean;
  sharedCount: number;
  lastSharedAt?: string;
  achievement: Achievement;
}

interface UserStats {
  totalPoints: number;
  completedAchievements: number;
  currentLevel: number;
  pointsToNextLevel: number;
  rank: string;
  streakDays: number;
}

export function AchievementDashboard({ userId }: { userId: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: userAchievements = [], isLoading: achievementsLoading } = useQuery<UserAchievement[]>({
    queryKey: ['/api/achievements', userId],
    enabled: !!userId,
  });

  const { data: userStats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ['/api/user-stats', userId],
    enabled: !!userId,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['/api/achievements/leaderboard', { limit: 10 }],
  });

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return <Star className="h-4 w-4 text-green-500" />;
      case 'intermediate': return <Target className="h-4 w-4 text-blue-500" />;
      case 'advanced': return <Zap className="h-4 w-4 text-orange-500" />;
      case 'expert': return <Crown className="h-4 w-4 text-purple-500" />;
      default: return <Medal className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'advanced': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expert': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case 'portfolio': return <TrendingUp className="h-5 w-5" />;
      case 'learning': return <BookOpen className="h-5 w-5" />;
      case 'trading': return <IndianRupee className="h-5 w-5" />;
      case 'social': return <Users className="h-5 w-5" />;
      default: return <Award className="h-5 w-5" />;
    }
  };

  const getRankBadge = (rank: string) => {
    const rankColors = {
      'Bronze': 'bg-amber-100 text-amber-800 border-amber-200',
      'Silver': 'bg-muted text-foreground border-border',
      'Gold': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Platinum': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Diamond': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return rankColors[rank as keyof typeof rankColors] || 'bg-muted text-foreground border-border';
  };

  const categories = [
    { id: 'all', name: 'All Achievements', icon: <Trophy className="h-4 w-4" /> },
    { id: 'portfolio', name: 'Portfolio', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'learning', name: 'Learning', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'trading', name: 'Trading', icon: <IndianRupee className="h-4 w-4" /> },
    { id: 'social', name: 'Social', icon: <Users className="h-4 w-4" /> },
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? userAchievements 
    : userAchievements.filter(ua => ua.achievement.categoryId === selectedCategory);

  const completedAchievements = filteredAchievements.filter(ua => ua.isCompleted);
  const inProgressAchievements = filteredAchievements.filter(ua => !ua.isCompleted && ua.progress > 0);
  const lockedAchievements = filteredAchievements.filter(ua => !ua.isCompleted && ua.progress === 0);

  if (achievementsLoading || statsLoading) {
    return <div className="flex items-center justify-center h-64">Loading achievements...</div>;
  }

  return (
    <div className="space-y-6" data-testid="achievement-dashboard">
      {/* User Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 font-medium">Total Points</p>
                <p className="text-3xl font-bold text-yellow-800">{userStats?.totalPoints || 0}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Current Level</p>
                <p className="text-3xl font-bold text-blue-800">{userStats?.currentLevel || 1}</p>
              </div>
              <Star className="h-8 w-8 text-blue-600" />
            </div>
            {userStats && (
              <div className="mt-3">
                <Progress value={(userStats.pointsToNextLevel / 1000) * 100} className="h-2" />
                <p className="text-xs text-blue-600 mt-1">{userStats.pointsToNextLevel} points to next level</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Achievements</p>
                <p className="text-3xl font-bold text-green-800">{userStats?.completedAchievements || 0}</p>
              </div>
              <Medal className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Current Rank</p>
                <Badge className={`${getRankBadge(userStats?.rank || 'Bronze')} text-sm px-2 py-1`}>
                  {userStats?.rank || 'Bronze'}
                </Badge>
              </div>
              <Crown className="h-8 w-8 text-purple-600" />
            </div>
            {userStats?.streakDays && (
              <div className="mt-3 flex items-center">
                <Flame className="h-4 w-4 text-orange-500 mr-1" />
                <span className="text-sm text-purple-700">{userStats.streakDays} day streak!</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <ScrollableTabsList className="grid w-full grid-cols-5">
          {categories.map(category => (
            <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
              {category.icon}
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </ScrollableTabsList>

        <TabsContent value={selectedCategory} className="space-y-6">
          {/* Achievement Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">Completed</span>
                  <Badge className="bg-green-100 text-green-800">{completedAchievements.length}</Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">In Progress</span>
                  <Badge className="bg-blue-100 text-blue-800">{inProgressAchievements.length}</Badge>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Locked</span>
                  <Badge className="bg-muted text-foreground">{lockedAchievements.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Completed Achievements */}
          {completedAchievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
                Completed Achievements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedAchievements.map((userAchievement) => (
                  <Card key={userAchievement.id} className="border-2 border-green-200 bg-green-50/50" data-testid={`achievement-${userAchievement.achievementId}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            {getCategoryIcon(userAchievement.achievement.category?.name || '')}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-foreground">
                              {userAchievement.achievement.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              {getDifficultyIcon(userAchievement.achievement.difficulty)}
                              <Badge className={`text-xs ${getDifficultyColor(userAchievement.achievement.difficulty)}`}>
                                {userAchievement.achievement.difficulty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          +{userAchievement.achievement.points}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-4">
                        {userAchievement.achievement.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600">
                          Completed on {new Date(userAchievement.earnedAt).toLocaleDateString()}
                        </span>
                        
                        <div className="flex items-center space-x-2">
                          {userAchievement.sharedCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Share2 className="h-3 w-3 mr-1" />
                              {userAchievement.sharedCount}
                            </Badge>
                          )}
                          <SocialSharing 
                            achievement={userAchievement.achievement}
                            userAchievement={userAchievement}
                            userId={userId}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* In Progress Achievements */}
          {inProgressAchievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Target className="h-5 w-5 text-blue-500 mr-2" />
                In Progress
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inProgressAchievements.map((userAchievement) => (
                  <Card key={userAchievement.id} className="border-2 border-blue-200 bg-blue-50/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {getCategoryIcon(userAchievement.achievement.category?.name || '')}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-foreground">
                              {userAchievement.achievement.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              {getDifficultyIcon(userAchievement.achievement.difficulty)}
                              <Badge className={`text-xs ${getDifficultyColor(userAchievement.achievement.difficulty)}`}>
                                {userAchievement.achievement.difficulty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                          +{userAchievement.achievement.points}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        {userAchievement.achievement.description}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Progress</span>
                          <span className="font-medium">{userAchievement.progress}%</span>
                        </div>
                        <Progress value={userAchievement.progress} className="h-2 bg-blue-100" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                <Medal className="h-5 w-5 text-muted-foreground mr-2" />
                Locked Achievements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lockedAchievements.slice(0, 6).map((userAchievement) => (
                  <Card key={userAchievement.id} className="border-border bg-muted/50 opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-muted rounded-lg">
                            {getCategoryIcon(userAchievement.achievement.category?.name || '')}
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-muted-foreground">
                              {userAchievement.achievement.name}
                            </CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              {getDifficultyIcon(userAchievement.achievement.difficulty)}
                              <Badge className="text-xs bg-muted text-muted-foreground border-border">
                                {userAchievement.achievement.difficulty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-muted text-muted-foreground text-xs">
                          +{userAchievement.achievement.points}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        {userAchievement.achievement.description}
                      </p>
                      <p className="text-xs text-muted-foreground">🔒 Complete requirements to unlock</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Crown className="h-5 w-5 text-purple-500 mr-2" />
              Investment Learning Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.map((entry: any, index: number) => (
                <div key={entry.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center space-x-3">
                    <Badge className={`${index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-muted text-white'}`}>
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.user?.firstName || 'Anonymous'} {entry.user?.lastName || 'User'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.completedAchievements} achievements completed
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-yellow-600">{entry.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}