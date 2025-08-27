import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Award,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Trophy,
  Target
} from "lucide-react";

type LearningLesson = {
  id: string;
  moduleId: string;
  title: string;
  content: string;
  contentType: 'text' | 'video' | 'interactive';
  orderIndex: number;
  estimatedMinutes: number;
  pointsReward: number;
};

type LearningQuiz = {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  pointsReward: number;
};

interface LessonViewerProps {
  lesson: LearningLesson;
  quiz?: LearningQuiz;
  isCompleted?: boolean;
  onComplete?: (score: number) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  currentIndex?: number;
  totalLessons?: number;
}

export function LessonViewer({
  lesson,
  quiz,
  isCompleted = false,
  onComplete,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  currentIndex = 1,
  totalLessons = 1
}: LessonViewerProps) {
  const { toast } = useToast();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [lessonCompleted, setLessonCompleted] = useState(isCompleted);

  const completeQuizMutation = useMutation({
    mutationFn: async ({ quizId, answer }: { quizId: string; answer: number }) => {
      const response = await apiRequest("POST", `/api/learning/quiz/${quizId}/submit`, { answer });
      return response.json();
    },
    onSuccess: (data) => {
      setShowResults(true);
      setQuizScore(data.score);
      queryClient.invalidateQueries({ queryKey: ["/api/learning/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learning/progress"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Quiz Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const response = await apiRequest("POST", `/api/learning/lesson/${lessonId}/complete`);
      return response.json();
    },
    onSuccess: (data) => {
      setLessonCompleted(true);
      if (onComplete) {
        onComplete(data.score || 100);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/learning/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/learning/progress"] });
      toast({
        title: "Lesson Completed!",
        description: `You earned ${data.pointsEarned || lesson.pointsReward} points!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Lesson Completion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuizSubmit = () => {
    if (selectedAnswer === null || !quiz) return;
    
    completeQuizMutation.mutate({
      quizId: quiz.id,
      answer: selectedAnswer
    });
  };

  const handleLessonComplete = () => {
    completeLessonMutation.mutate(lesson.id);
  };

  const progress = (currentIndex / totalLessons) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-white">
                Lesson {currentIndex} of {totalLessons}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>{lesson.estimatedMinutes} min</span>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Lesson Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{lesson.title}</CardTitle>
            {lessonCompleted && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="h-4 w-4 mr-1" />
                Completed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lesson Content */}
          <div className="prose dark:prose-invert max-w-none">
            {lesson.contentType === 'text' ? (
              <div 
                dangerouslySetInnerHTML={{ __html: lesson.content }}
                className="text-gray-700 dark:text-gray-300 leading-relaxed"
              />
            ) : lesson.contentType === 'video' ? (
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Video content: {lesson.content}</p>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Interactive Content
                </h4>
                <div dangerouslySetInnerHTML={{ __html: lesson.content }} />
              </div>
            )}
          </div>

          {/* Quiz Section */}
          {quiz && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center">
                  <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
                  Knowledge Check
                </h3>
                
                <Card className="border-yellow-200 dark:border-yellow-800">
                  <CardContent className="p-6">
                    <h4 className="font-medium mb-4">{quiz.question}</h4>
                    
                    <div className="space-y-3">
                      {quiz.options.map((option, index) => (
                        <button
                          key={index}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedAnswer === index
                              ? showResults
                                ? index === quiz.correctAnswer
                                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                  : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : showResults && index === quiz.correctAnswer
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => !showResults && setSelectedAnswer(index)}
                          disabled={showResults}
                        >
                          <div className="flex items-center justify-between">
                            <span>{option}</span>
                            {showResults && (
                              <>
                                {index === quiz.correctAnswer && (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                )}
                                {selectedAnswer === index && index !== quiz.correctAnswer && (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                )}
                              </>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {!showResults && selectedAnswer !== null && (
                      <Button 
                        onClick={handleQuizSubmit}
                        disabled={completeQuizMutation.isPending}
                        className="w-full mt-4"
                        data-testid="submit-quiz"
                      >
                        {completeQuizMutation.isPending ? "Submitting..." : "Submit Answer"}
                      </Button>
                    )}

                    {showResults && quiz.explanation && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h5 className="font-medium mb-2">Explanation:</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{quiz.explanation}</p>
                        {quizScore !== null && (
                          <div className="mt-3 flex items-center text-sm">
                            <Award className="h-4 w-4 mr-1 text-yellow-500" />
                            <span>You earned {quiz.pointsReward} points!</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Completion Button */}
          {!lessonCompleted && (!quiz || showResults) && (
            <div className="flex justify-center">
              <Button 
                onClick={handleLessonComplete}
                disabled={completeLessonMutation.isPending}
                size="lg"
                data-testid="complete-lesson"
              >
                {completeLessonMutation.isPending ? "Completing..." : (
                  <>
                    Complete Lesson
                    <Award className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={!hasPrevious}
          data-testid="previous-lesson"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous Lesson
        </Button>

        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <span>{currentIndex} / {totalLessons}</span>
        </div>

        <Button
          onClick={onNext}
          disabled={!hasNext || (!lessonCompleted && !showResults)}
          data-testid="next-lesson"
        >
          Next Lesson
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}