import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy,
  Star,
  Crown,
  Medal,
  X,
  Share2,
  Sparkles,
  Target
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
  shareTemplate?: string;
}

interface AchievementNotificationProps {
  achievement: Achievement;
  isVisible: boolean;
  onClose: () => void;
  userId?: string;
}

export function AchievementNotification({ 
  achievement, 
  isVisible, 
  onClose,
  userId 
}: AchievementNotificationProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      // Auto-hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return <Star className="h-6 w-6 text-green-500" />;
      case 'intermediate': return <Target className="h-6 w-6 text-blue-500" />;
      case 'advanced': return <Medal className="h-6 w-6 text-orange-500" />;
      case 'expert': return <Crown className="h-6 w-6 text-purple-500" />;
      default: return <Trophy className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'from-green-400 to-green-600';
      case 'intermediate': return 'from-blue-400 to-blue-600';
      case 'advanced': return 'from-orange-400 to-orange-600';
      case 'expert': return 'from-purple-400 to-purple-600';
      default: return 'from-yellow-400 to-yellow-600';
    }
  };

  const confettiColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            {/* Confetti Animation */}
            {showConfetti && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {Array.from({ length: 50 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded"
                    style={{
                      backgroundColor: confettiColors[i % confettiColors.length],
                      left: `${Math.random() * 100}%`,
                      top: '-10px',
                    }}
                    initial={{ y: -10, opacity: 1 }}
                    animate={{
                      y: window.innerHeight + 10,
                      opacity: 0,
                      x: Math.random() * 200 - 100,
                    }}
                    transition={{
                      duration: 3,
                      delay: Math.random() * 2,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Achievement Card */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Card className="overflow-hidden border-0 shadow-2xl">
                <div className={`bg-gradient-to-r ${getDifficultyColor(achievement.difficulty)} p-6 text-foreground relative`}>
                  {/* Close Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 text-foreground hover:bg-card/20"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  {/* Sparkle Animations */}
                  <div className="absolute inset-0 overflow-hidden">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        animate={{
                          scale: [0, 1, 0],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: Math.random() * 2,
                        }}
                      >
                        <Sparkles className="h-4 w-4 text-foreground/60" />
                      </motion.div>
                    ))}
                  </div>

                  <div className="text-center relative z-10">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className="mb-4"
                    >
                      <div className="w-20 h-20 bg-card/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm border border-white/30">
                        {getDifficultyIcon(achievement.difficulty)}
                      </div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <h2 className="text-2xl font-bold mb-2">🎉 Achievement Unlocked!</h2>
                      <h3 className="text-xl font-semibold mb-2">{achievement.name}</h3>
                      <Badge className="bg-card/20 text-foreground border-white/30">
                        +{achievement.points} points
                      </Badge>
                    </motion.div>
                  </div>
                </div>

                <CardContent className="p-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="text-center space-y-4"
                  >
                    <p className="text-muted-foreground">{achievement.description}</p>
                    
                    <div className="flex items-center justify-center space-x-2">
                      {getDifficultyIcon(achievement.difficulty)}
                      <Badge className={`${
                        achievement.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                        achievement.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                        achievement.difficulty === 'advanced' ? 'bg-orange-100 text-orange-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {achievement.difficulty.charAt(0).toUpperCase() + achievement.difficulty.slice(1)} Level
                      </Badge>
                    </div>

                    <div className="flex flex-col space-y-3 pt-4">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 }}
                      >
                        {userId && (
                          <SocialSharing 
                            achievement={achievement}
                            userId={userId}
                          />
                        )}
                      </motion.div>
                      
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                      >
                        <Button onClick={onClose} className="w-full">
                          Continue Learning
                        </Button>
                      </motion.div>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Achievement Toast for smaller notifications
export function AchievementToast({ achievement, onClose }: { 
  achievement: Achievement; 
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Auto-close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed top-4 right-4 z-50 max-w-sm"
    >
      <Card className="border-l-4 border-l-yellow-500 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <Trophy className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">Achievement Progress!</p>
                <p className="text-xs text-muted-foreground">{achievement.name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}