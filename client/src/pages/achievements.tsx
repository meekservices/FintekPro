import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SocialSharing from '@/components/social-sharing';
import { 
  Award,
  Trophy,
  Star,
  TrendingUp,
  BookOpen,
  Target,
  Users,
  Crown,
  Loader2
} from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  badgeImage?: string;
  points: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  category: string;
  shareTemplate?: string;
}

interface UserAchievement {
  id: string;
  achievementId: string;
  userId: string;
  earnedAt: string;
  progress: string;
  isCompleted: boolean;
  sharedCount: number;
  lastSharedAt?: string;
  achievement?: Achievement;
}

interface AchievementStats {
  totalPoints: number;
  completedAchievements: number;
  categories: Record<string, number>;
}

interface LeaderboardEntry {
  userId: string;
  totalPoints: number;
  completedAchievements: number;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function AchievementsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const userId = 'demo-user-1'; // In real app, get from auth context

  // Mock data for development
  const { data: userAchievements, isLoading } = useQuery<UserAchievement[]>({
    queryKey: ['/api/achievements', userId],
    queryFn: async () => {
      // Mock data until backend is implemented
      return [
        {
          id: '1',
          achievementId: 'first-portfolio',
          userId: userId,
          earnedAt: new Date().toISOString(),
          progress: '100',
          isCompleted: true,
          sharedCount: 2,
          achievement: {
            id: 'first-portfolio',
            name: 'Portfolio Pioneer',
            description: 'Created your first investment portfolio',
            points: 100,
            difficulty: 'beginner',
            category: 'Portfolio Management',
            shareTemplate: '🎯 Just created my first investment portfolio on FintekPro!'
          }
        },
        {
          id: '2',
          achievementId: 'portfolio-diversifier',
          userId: userId,
          earnedAt: new Date().toISOString(),
          progress: '75',
          isCompleted: false,
          sharedCount: 0,
          achievement: {
            id: 'portfolio-diversifier',
            name: 'Diversification Master',
            description: 'Diversify your portfolio across 5 different asset classes',
            points: 250,
            difficulty: 'intermediate',
            category: 'Portfolio Management'
          }
        },
        {
          id: '3',
          achievementId: 'learning-streak',
          userId: userId,
          earnedAt: new Date().toISOString(),
          progress: '100',
          isCompleted: true,
          sharedCount: 1,
          achievement: {
            id: 'learning-streak',
            name: 'Knowledge Seeker',
            description: 'Completed 10 financial learning modules',
            points: 200,
            difficulty: 'intermediate',
            category: 'Learning & Education'
          }
        }
      ];
    }
  });

  const { data: stats } = useQuery<AchievementStats>({
    queryKey: ['/api/achievements/stats', userId],
    queryFn: async () => {
      // Mock stats
      return {
        totalPoints: 300,
        completedAchievements: 2,
        categories: {
          'Portfolio Management': 1,
          'Learning & Education': 1
        }
      };
    }
  });

  const { data: leaderboard } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/achievements/leaderboard'],
    queryFn: async () => {
      // Mock leaderboard
      return [
        {
          userId: 'user-1',
          totalPoints: 1250,
          completedAchievements: 8,
          user: { id: 'user-1', firstName: 'Alex', lastName: 'Johnson', email: 'alex@example.com' }
        },
        {
          userId: userId,
          totalPoints: 300,
          completedAchievements: 2,
          user: { id: userId, firstName: 'Demo', lastName: 'User', email: 'demo@example.com' }
        },
        {
          userId: 'user-3',
          totalPoints: 180,
          completedAchievements: 3,
          user: { id: 'user-3', firstName: 'Sarah', lastName: 'Wilson', email: 'sarah@example.com' }
        }
      ];
    }
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-blue-100 text-blue-800';
      case 'advanced': return 'bg-orange-100 text-orange-800';
      case 'expert': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'portfolio management': return <TrendingUp className="h-5 w-5" />;
      case 'learning & education': return <BookOpen className="h-5 w-5" />;
      case 'trading': return <Target className="h-5 w-5" />;
      default: return <Award className="h-5 w-5" />;
    }
  };

  const categories = [
    'all',
    'Portfolio Management',
    'Learning & Education',
    'Trading',
    'Risk Management',
    'Market Analysis'
  ];

  const filteredAchievements = userAchievements?.filter(ua => 
    selectedCategory === 'all' || ua.achievement?.category === selectedCategory
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Investment Learning Achievements</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Track your learning progress, earn achievement badges, and share your investment knowledge milestones with the community.
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="h-6 w-6 text-yellow-500" />
                <span className="text-2xl font-bold">{stats.totalPoints}</span>
              </div>
              <p className="text-sm text-muted-foreground">Total Points Earned</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Award className="h-6 w-6 text-green-500" />
                <span className="text-2xl font-bold">{stats.completedAchievements}</span>
              </div>
              <p className="text-sm text-muted-foreground">Achievements Unlocked</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Target className="h-6 w-6 text-blue-500" />
                <span className="text-2xl font-bold">{Object.keys(stats.categories).length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Categories Mastered</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="achievements" className="space-y-6">
        <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
          <TabsTrigger value="achievements">My Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="gap-2"
                data-testid={`filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category !== 'all' && getCategoryIcon(category)}
                {category === 'all' ? 'All Categories' : category}
              </Button>
            ))}
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map(userAchievement => {
              const achievement = userAchievement.achievement;
              if (!achievement) return null;

              return (
                <Card key={userAchievement.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${
                          userAchievement.isCompleted 
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-500' 
                            : 'bg-gray-300'
                        }`}>
                          {getCategoryIcon(achievement.category)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{achievement.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                      {userAchievement.isCompleted && (
                        <Crown className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {!userAchievement.isCompleted && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{userAchievement.progress}%</span>
                        </div>
                        <Progress value={parseFloat(userAchievement.progress)} />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge className={getDifficultyColor(achievement.difficulty)}>
                          {achievement.difficulty}
                        </Badge>
                        <Badge variant="secondary">
                          {achievement.points} pts
                        </Badge>
                      </div>
                      
                      {userAchievement.isCompleted && (
                        <SocialSharing 
                          achievement={achievement}
                          userAchievement={userAchievement}
                          userId={userId}
                        />
                      )}
                    </div>

                    {userAchievement.isCompleted && (
                      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                        Earned on {new Date(userAchievement.earnedAt).toLocaleDateString()}
                        {userAchievement.sharedCount > 0 && (
                          <span className="ml-2">• Shared {userAchievement.sharedCount} times</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Achievement Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaderboard?.map((entry, index) => (
                  <div 
                    key={entry.userId}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      entry.userId === userId ? 'bg-blue-50 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-semibold">
                        {entry.user?.firstName} {entry.user?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {entry.completedAchievements} achievements completed
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="font-bold text-lg">{entry.totalPoints}</div>
                      <div className="text-sm text-muted-foreground">points</div>
                    </div>
                    
                    {entry.userId === userId && (
                      <Badge variant="outline" className="ml-2">You</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}