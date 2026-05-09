import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Calculator, Save, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface AssessmentQuestion {
  id: string;
  category: string;
  question: string;
  questionType: string;
  options: Array<{
    value: string;
    label: string;
    score: number;
  }>;
  weightage: number;
  isActive: boolean;
}

const riskAssessmentSchema = z.object({
  userId: z.string().min(1, "Please select a customer"),
  age: z.number().min(18, "Age must be at least 18").max(100, "Age must be less than 100"),
  dependents: z.number().min(0, "Dependents cannot be negative"),
  monthlyIncome: z.string().min(1, "Monthly income is required"),
  monthlyExpenses: z.string().min(1, "Monthly expenses is required"),
  existingAssets: z.string().min(1, "Existing assets value is required"),
  existingLiabilities: z.string().min(1, "Existing liabilities value is required"),
  notes: z.string().optional(),
});

type RiskAssessmentForm = z.infer<typeof riskAssessmentSchema>;

export function RiskAssessmentForm() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});
  const [calculatedScore, setCalculatedScore] = useState<number>(0);

  const form = useForm<RiskAssessmentForm>({
    resolver: zodResolver(riskAssessmentSchema),
    defaultValues: {
      userId: "",
      age: 30,
      dependents: 0,
      monthlyIncome: "",
      monthlyExpenses: "",
      existingAssets: "",
      existingLiabilities: "",
      notes: "",
    },
  });

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  // Fetch assessment questions
  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["/api/risk-assessment-questions"],
  });

  // Create risk profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest("POST", "/api/risk-profiles", profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-profiles"] });
      toast({
        title: "Risk profile created",
        description: "Customer risk assessment has been successfully completed.",
      });
      // Reset form
      form.reset();
      setCurrentStep(1);
      setQuestionnaireAnswers({});
      setCalculatedScore(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Assessment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate risk score based on questionnaire answers
  const calculateRiskScore = () => {
    let totalScore = 0;
    let totalWeightage = 0;

    questions.forEach((question: AssessmentQuestion) => {
      const answer = questionnaireAnswers[question.id];
      if (answer) {
        const option = question.options.find(opt => opt.value === answer);
        if (option) {
          totalScore += option.score * question.weightage;
          totalWeightage += question.weightage;
        }
      }
    });

    const finalScore = totalWeightage > 0 ? Math.round(totalScore / totalWeightage) : 0;
    setCalculatedScore(finalScore);
    return finalScore;
  };

  // Handle questionnaire answer change
  const handleAnswerChange = (questionId: string, value: string) => {
    setQuestionnaireAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Determine risk characteristics based on score
  const getRiskCharacteristics = (score: number) => {
    if (score <= 30) return {
      tolerance: "conservative",
      horizon: "short",
      experience: "beginner",
      stability: "stable",
      liquidity: "high"
    };
    if (score <= 50) return {
      tolerance: "moderate",
      horizon: "medium",
      experience: "intermediate",
      stability: "stable",
      liquidity: "medium"
    };
    if (score <= 70) return {
      tolerance: "balanced",
      horizon: "medium",
      experience: "intermediate",
      stability: "stable",
      liquidity: "medium"
    };
    if (score <= 85) return {
      tolerance: "growth",
      horizon: "long",
      experience: "advanced",
      stability: "variable",
      liquidity: "low"
    };
    return {
      tolerance: "aggressive",
      horizon: "long",
      experience: "expert",
      stability: "variable",
      liquidity: "low"
    };
  };

  const onSubmit = (data: RiskAssessmentForm) => {
    const score = calculateRiskScore();
    const characteristics = getRiskCharacteristics(score);

    const profileData = {
      userId: data.userId,
      riskTolerance: characteristics.tolerance,
      investmentHorizon: characteristics.horizon,
      investmentExperience: characteristics.experience,
      incomeStability: characteristics.stability,
      liquidityNeeds: characteristics.liquidity,
      age: data.age,
      dependents: data.dependents,
      monthlyIncome: data.monthlyIncome,
      monthlyExpenses: data.monthlyExpenses,
      existingAssets: data.existingAssets,
      existingLiabilities: data.existingLiabilities,
      questionnaire: questionnaireAnswers,
      riskScore: score,
      assessedBy: "current-user", // In real app, this would be the current admin/support user
      assessmentDate: new Date(),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      notes: data.notes,
    };

    createProfileMutation.mutate(profileData);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <User className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Customer Information</h3>
              <p className="text-muted-foreground">Basic details about the customer</p>
            </div>

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} data-testid="select-customer-assessment">
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose customer to assess" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user: User) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName} (${user.email})`
                            : `${user.username || user.email}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                        data-testid="input-age"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dependents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Dependents</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                        data-testid="input-dependents"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Calculator className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Financial Information</h3>
              <p className="text-muted-foreground">Customer's financial situation</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthlyIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Income (₹)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="50000" data-testid="input-monthly-income" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyExpenses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Expenses (₹)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="35000" data-testid="input-monthly-expenses" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="existingAssets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Existing Assets (₹)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1000000" data-testid="input-existing-assets" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="existingLiabilities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Existing Liabilities (₹)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="500000" data-testid="input-existing-liabilities" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <ClipboardCheck className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Risk Assessment Questionnaire</h3>
              <p className="text-muted-foreground">Answer questions to determine risk profile</p>
            </div>

            {questions.map((question: AssessmentQuestion, index: number) => (
              <Card key={question.id} className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">
                      {index + 1}. {question.question}
                    </Label>
                    <Badge variant="outline" className="ml-2">
                      {question.category.replace('_', ' ')}
                    </Badge>
                  </div>
                  <RadioGroup
                    value={questionnaireAnswers[question.id] || ""}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                    data-testid={`radio-group-${question.id}`}
                  >
                    {question.options.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                        <Label
                          htmlFor={`${question.id}-${option.value}`}
                          className="flex-1 cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </Card>
            ))}

            {Object.keys(questionnaireAnswers).length === questions.length && (
              <Card className="p-4 bg-muted">
                <div className="text-center space-y-2">
                  <h4 className="font-semibold">Calculated Risk Score</h4>
                  <div className="flex items-center justify-center gap-4">
                    <Progress value={calculateRiskScore()} className="h-3 flex-1 max-w-xs" />
                    <Badge variant="outline" className="text-lg px-4 py-2" data-testid="badge-calculated-score">
                      {calculateRiskScore()}/100
                    </Badge>
                  </div>
                </div>
              </Card>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Save className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Additional Notes</h3>
              <p className="text-muted-foreground">Any additional observations or comments</p>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assessment Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add any additional notes about this customer's financial situation, investment goals, or risk preferences..."
                      className="min-h-[120px]"
                      data-testid="textarea-assessment-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (usersLoading || questionsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4">Loading assessment form...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="risk-assessment-form">
      {/* Progress Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment Progress</CardTitle>
          <CardDescription>Step {currentStep} of 4</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Progress value={(currentStep / 4) * 100} className="flex-1" />
            <span className="text-sm font-medium">{Math.round((currentStep / 4) * 100)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Assessment Form */}
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                  disabled={currentStep === 1}
                  data-testid="button-previous-step"
                >
                  Previous
                </Button>

                {currentStep < 4 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      // Validate current step before proceeding
                      const isValid = 
                        currentStep === 1 ? form.getValues("userId") && 
                                          form.getValues("age") >= 18 : 
                        currentStep === 2 ? form.getValues("monthlyIncome") &&
                                          form.getValues("monthlyExpenses") &&
                                          form.getValues("existingAssets") &&
                                          form.getValues("existingLiabilities") :
                        currentStep === 3 ? Object.keys(questionnaireAnswers).length === questions.length :
                        true;

                      if (isValid) {
                        setCurrentStep(prev => Math.min(4, prev + 1));
                      } else {
                        toast({
                          title: "Please complete this step",
                          description: "Fill in all required fields before proceeding.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-next-step"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={createProfileMutation.isPending}
                    data-testid="button-submit-assessment"
                  >
                    {createProfileMutation.isPending ? "Creating Profile..." : "Complete Assessment"}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}