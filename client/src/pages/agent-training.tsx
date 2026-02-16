import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Play,
  Award,
  AlertTriangle,
  Lock,
  ChevronRight,
  GraduationCap
} from "lucide-react";

interface Playbook {
  id: string;
  title: string;
  description: string;
  modules: number;
  estimatedTime: string;
  isRequired: boolean;
  completionStatus: "not_started" | "in_progress" | "completed";
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}


export default function AgentTrainingPage() {
  const { toast } = useToast();
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  const { data: playbooks, isLoading } = useQuery<Playbook[]>({
    queryKey: ["/api/agent/training/playbooks"],
  });

  const { data: certifications } = useQuery({
    queryKey: ["/api/agent/certification/growth_optimized"],
  });

  const { data: quizQuestions } = useQuery<QuizQuestion[]>({
    queryKey: ['/api/agent/training/quiz-questions', selectedPlaybook?.id],
    enabled: showQuiz && !!selectedPlaybook,
  });

  const questions = quizQuestions || [];

  const submitQuizMutation = useMutation({
    mutationFn: (data: { playbookId: string; answers: Record<string, number> }) =>
      apiRequest("/api/agent/training/submit-quiz", { method: "POST", headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    onSuccess: (result: any) => {
      setQuizResult({ score: result.score, passed: result.passed });
      setQuizSubmitted(true);
      if (result.passed) {
        queryClient.invalidateQueries({ queryKey: ["/api/agent/certification/growth_optimized"] });
        queryClient.invalidateQueries({ queryKey: ["/api/agent/training/playbooks"] });
      }
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Play className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">In Progress</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const handleStartQuiz = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setShowQuiz(true);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
  };

  const handleSubmitQuiz = () => {
    if (selectedPlaybook) {
      submitQuizMutation.mutate({
        playbookId: selectedPlaybook.id,
        answers: quizAnswers,
      });
    }
  };

  const allQuestionsAnswered = questions.length > 0 && Object.keys(quizAnswers).length === questions.length;

  return (
    <AgentLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-primary" />
              Training & Certification
            </h1>
            <p className="text-muted-foreground mt-2">
              Complete training modules to unlock advanced features
            </p>
          </div>
          {(certifications as any)?.isCertified && (
            <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2">
              <Award className="h-4 w-4 mr-2" />
              Growth-Optimized Certified
            </Badge>
          )}
        </div>

        <Tabs defaultValue="playbooks">
          <TabsList>
            <TabsTrigger value="playbooks">Training Playbooks</TabsTrigger>
            <TabsTrigger value="certifications">My Certifications</TabsTrigger>
          </TabsList>

          <TabsContent value="playbooks" className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {playbooks?.map((playbook) => (
                  <Card key={playbook.id} className="relative" data-testid={`playbook-card-${playbook.id}`}>
                    {playbook.isRequired && (
                      <Badge className="absolute top-4 right-4 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                        Required
                      </Badge>
                    )}
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        {getStatusIcon(playbook.completionStatus)}
                        <div className="flex-1">
                          <CardTitle className="text-lg">{playbook.title}</CardTitle>
                          <CardDescription className="mt-1">{playbook.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          {playbook.modules} modules
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {playbook.estimatedTime}
                        </div>
                      </div>
                      {playbook.completionStatus === "in_progress" && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>60%</span>
                          </div>
                          <Progress value={60} className="h-2" />
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-between items-center">
                      {getStatusBadge(playbook.completionStatus)}
                      {playbook.completionStatus === "completed" ? (
                        <Button variant="outline" size="sm" disabled>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Completed
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleStartQuiz(playbook)}
                          data-testid={`start-playbook-${playbook.id}`}
                        >
                          {playbook.completionStatus === "in_progress" ? "Continue" : "Start"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="certifications" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className={(certifications as any)?.isCertified ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30/50" : ""}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {(certifications as any)?.isCertified ? (
                      <Award className="h-10 w-10 text-green-500" />
                    ) : (
                      <Lock className="h-10 w-10 text-muted-foreground" />
                    )}
                    <div>
                      <CardTitle>Growth-Optimized Mode</CardTitle>
                      <CardDescription>Advanced recommendation certification</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(certifications as any)?.isCertified ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Active</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Certified</span>
                        <span>{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires</span>
                        <span>{new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Complete the Growth-Optimized training to unlock this certification
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={showQuiz} onOpenChange={setShowQuiz}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                {selectedPlaybook?.title} - Certification Quiz
              </DialogTitle>
              <DialogDescription>
                Answer all questions correctly to earn your certification. You need 80% or higher to pass.
              </DialogDescription>
            </DialogHeader>

            {quizSubmitted && quizResult ? (
              <div className="py-8 text-center">
                {quizResult.passed ? (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">Congratulations!</h3>
                    <p className="text-muted-foreground mb-4">
                      You scored {quizResult.score}% and earned your certification.
                    </p>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2">
                      <Award className="h-4 w-4 mr-2" />
                      Growth-Optimized Certified
                    </Badge>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">Not Passed</h3>
                    <p className="text-muted-foreground mb-4">
                      You scored {quizResult.score}%. You need 80% or higher to pass.
                      Please review the training material and try again.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {questions.map((q, index) => (
                  <div key={q.id} className="space-y-3">
                    <Label className="text-base font-medium">
                      {index + 1}. {q.question}
                    </Label>
                    <RadioGroup
                      value={quizAnswers[q.id]?.toString()}
                      onValueChange={(value) => setQuizAnswers({ ...quizAnswers, [q.id]: parseInt(value) })}
                    >
                      {q.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={optIndex.toString()}
                            id={`${q.id}-${optIndex}`}
                            data-testid={`quiz-option-${q.id}-${optIndex}`}
                          />
                          <Label htmlFor={`${q.id}-${optIndex}`} className="font-normal cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              {quizSubmitted ? (
                <Button onClick={() => setShowQuiz(false)}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setShowQuiz(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={!allQuestionsAnswered || submitQuizMutation.isPending}
                    data-testid="submit-quiz-btn"
                  >
                    Submit Quiz
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AgentLayout>
  );
}
