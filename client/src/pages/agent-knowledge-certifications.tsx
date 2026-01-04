import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Shield,
  ChevronLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Play,
  Trophy,
  Target,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface CertificationLevel {
  level: number;
  name: string;
  description: string;
  requirements: string[];
  quizId?: string;
}

interface AgentCertification {
  id: string;
  agentId: string;
  certificationLevel: number;
  certificationName: string;
  status: string;
  completedAt?: string;
  expiresAt?: string;
  score?: number;
}

interface Quiz {
  id: string;
  title: string;
  level: number;
  questions: {
    id: string;
    question: string;
    options: string[];
  }[];
  passingScore: number;
  timeLimit: number;
}

const certificationLevels: CertificationLevel[] = [
  {
    level: 0,
    name: "L0 - Foundation",
    description: "Basic understanding of financial products and regulations",
    requirements: [
      "Complete platform onboarding",
      "Understand basic investment concepts",
      "Know SEBI regulations overview",
    ],
  },
  {
    level: 1,
    name: "L1 - Associate",
    description: "Intermediate knowledge of financial instruments",
    requirements: [
      "Pass L1 assessment (70% minimum)",
      "Understand mutual funds, stocks, and bonds",
      "Know suitability requirements",
    ],
  },
  {
    level: 2,
    name: "L2 - Professional",
    description: "Advanced knowledge of complex products",
    requirements: [
      "Pass L2 assessment (75% minimum)",
      "Understand AIF, PMS, and structured products",
      "Master risk profiling techniques",
    ],
  },
  {
    level: 3,
    name: "L3 - Expert",
    description: "Expert-level knowledge across all categories",
    requirements: [
      "Pass L3 assessment (80% minimum)",
      "Demonstrate expertise in all asset classes",
      "Understand regulatory compliance in depth",
    ],
  },
];

const getLevelBadgeColor = (level: number) => {
  switch (level) {
    case 0:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    case 1:
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case 2:
      return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case 3:
      return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
};

export default function AgentKnowledgeCertifications() {
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<{ passed: boolean; score: number } | null>(null);
  const { toast } = useToast();

  const { data: myCerts, isLoading: certsLoading } = useQuery<AgentCertification[]>({
    queryKey: ["/api/knowledge-hub/certifications/my"],
  });

  const { data: quizzes } = useQuery<Quiz[]>({
    queryKey: ["/api/knowledge-hub/quizzes"],
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ quizId, answers }: { quizId: string; answers: Record<string, string> }) => {
      const response = await apiRequest("POST", `/api/knowledge-hub/quizzes/${quizId}/submit`, {
        answers,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setQuizResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/certifications/my"] });
      if (data.passed) {
        toast({
          title: "Congratulations! 🎉",
          description: `You passed with ${data.score}%`,
        });
      } else {
        toast({
          title: "Not quite there",
          description: `You scored ${data.score}%. Keep learning and try again!`,
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentLevel = myCerts?.reduce((max, cert) => Math.max(max, cert.certificationLevel), -1) ?? -1;
  const nextLevel = Math.min(currentLevel + 1, 3);

  const startQuiz = (level: number) => {
    const quiz = quizzes?.find((q) => q.level === level);
    if (quiz) {
      setSelectedQuiz(quiz);
      setAnswers({});
      setQuizResult(null);
    } else {
      toast({
        title: "Quiz not available",
        description: "This certification quiz is being prepared.",
      });
    }
  };

  const handleSubmitQuiz = () => {
    if (!selectedQuiz) return;
    submitQuizMutation.mutate({ quizId: selectedQuiz.id, answers });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/agent/knowledge-hub">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="h-7 w-7 text-purple-500" />
            My Certifications
          </h1>
          <p className="text-slate-400 mt-1">Track your knowledge certifications (optional)</p>
        </div>
      </div>

      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-400">Optional Certifications</AlertTitle>
        <AlertDescription className="text-blue-200/80 text-sm">
          Certifications are optional and for self-improvement. They do not restrict your access to any
          platform features. Complete them at your own pace to enhance your knowledge.
        </AlertDescription>
      </Alert>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">Current Level</span>
                <Badge className={getLevelBadgeColor(currentLevel)}>
                  {currentLevel >= 0 ? certificationLevels[currentLevel]?.name : "None"}
                </Badge>
              </div>
              <Progress value={((currentLevel + 1) / 4) * 100} className="h-2" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {certificationLevels.map((level) => {
              const isCompleted = currentLevel >= level.level;
              const isCurrent = currentLevel === level.level - 1;
              return (
                <div
                  key={level.level}
                  className={`p-2 rounded-lg text-center ${
                    isCompleted
                      ? "bg-emerald-500/20 border border-emerald-500/30"
                      : isCurrent
                      ? "bg-blue-500/20 border border-blue-500/30"
                      : "bg-slate-800/50 border border-slate-700"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" />
                  ) : (
                    <Target className="h-5 w-5 text-slate-500 mx-auto" />
                  )}
                  <p className="text-xs text-slate-400 mt-1">L{level.level}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {certsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificationLevels.map((level) => {
            const cert = myCerts?.find((c) => c.certificationLevel === level.level);
            const isCompleted = !!cert;
            const canAttempt = currentLevel === level.level - 1;

            return (
              <Card
                key={level.level}
                className={`bg-slate-900 border-slate-700 ${
                  isCompleted ? "border-emerald-500/30" : ""
                }`}
                data-testid={`card-level-${level.level}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Award
                        className={`h-5 w-5 ${
                          isCompleted ? "text-emerald-500" : "text-slate-500"
                        }`}
                      />
                      <CardTitle className="text-white">{level.name}</CardTitle>
                    </div>
                    {isCompleted ? (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Completed
                      </Badge>
                    ) : canAttempt ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-0">
                        <Target className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-slate-600 text-slate-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-slate-400">
                    {level.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1 mb-4">
                    {level.requirements.map((req, idx) => (
                      <li key={idx} className="text-slate-400 text-sm flex items-start gap-2">
                        <span className="text-slate-500 mt-1">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>

                  {isCompleted && cert ? (
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Score</span>
                        <span className="text-emerald-400 font-medium">{cert.score}%</span>
                      </div>
                      {cert.completedAt && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-400">Completed</span>
                          <span className="text-slate-300">
                            {format(new Date(cert.completedAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : canAttempt ? (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => startQuiz(level.level)}
                      data-testid={`button-start-quiz-${level.level}`}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Assessment
                    </Button>
                  ) : (
                    <Button className="w-full" disabled>
                      Complete Previous Level First
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!selectedQuiz}
        onOpenChange={() => {
          setSelectedQuiz(null);
          setQuizResult(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] bg-slate-900 border-slate-700">
          {selectedQuiz && !quizResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-white">{selectedQuiz.title}</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Answer all questions. You need {selectedQuiz.passingScore}% to pass.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 max-h-[60vh] overflow-y-auto">
                {selectedQuiz.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-800 rounded-lg">
                    <p className="text-white font-medium mb-3">
                      {idx + 1}. {q.question}
                    </p>
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={(value) => setAnswers({ ...answers, [q.id]: value })}
                    >
                      {q.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex items-center space-x-2">
                          <RadioGroupItem value={option} id={`${q.id}-${optIdx}`} />
                          <Label htmlFor={`${q.id}-${optIdx}`} className="text-slate-300">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={
                  Object.keys(answers).length !== selectedQuiz.questions.length ||
                  submitQuizMutation.isPending
                }
                onClick={handleSubmitQuiz}
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? "Submitting..." : "Submit Quiz"}
              </Button>
            </>
          )}

          {quizResult && (
            <div className="text-center py-8">
              {quizResult.passed ? (
                <>
                  <Trophy className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Congratulations! 🎉</h3>
                  <p className="text-slate-400 mb-4">
                    You passed with a score of {quizResult.score}%
                  </p>
                  <Badge className="bg-emerald-500/20 text-emerald-400 text-lg px-4 py-2">
                    Certification Earned!
                  </Badge>
                </>
              ) : (
                <>
                  <Target className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-2">Keep Learning!</h3>
                  <p className="text-slate-400 mb-4">
                    You scored {quizResult.score}%. Review the material and try again.
                  </p>
                </>
              )}
              <Button
                variant="outline"
                className="mt-4 border-slate-700"
                onClick={() => {
                  setSelectedQuiz(null);
                  setQuizResult(null);
                }}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
